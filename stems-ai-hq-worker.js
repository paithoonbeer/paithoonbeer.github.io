// SetSod Data 1.0.41 (named stems-ai-* so the app service worker never caches it, like stems-ai-worker.js) — คุณภาพสูง (high-quality) AI stem splitter: BS-RoFormer-SW 6-stem via onnxruntime-web.
// Model: jarredou/BS-ROFO-SW-Fixed, ONNX export by elicwhite/bs-roformer-sw-6stem-onnx (code MIT; the weights were
// re-hosted without a stated license — the owner accepted this, t347u). Same message protocol and stem names as
// stems-ai-worker.js (htdemucs_6s), so lanes / mute / ✂ / guide / export work unchanged.
// Graph: STFT outside (n_fft 2048, hop 512, periodic Hann, centre/reflect), 4 s chunks (176400 samples, T=345),
// output [1,6,2,1025,T] masked spectra in the order bass·drums·other·vocals·guitar·piano.
const ORT='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
const MODEL='https://huggingface.co/elicwhite/bs-roformer-sw-6stem-onnx/resolve/a744f80957374e1735ad70fa122670b7961da8cc/bs_roformer_sw_6stem_fp16.onnx';
const MODEL_BYTES=352778874;
const NF=2048,HOP=512,FB=NF/2+1,C=176400,T=345,STEP=C*3/4,OVL=C-STEP;
const MORDER=['bass','drums','other','vocals','guitar','piano'];   // model output order
const SRC=['drums','bass','other','vocals','guitar','piano'];      // what the page expects (same as htdemucs_6s)
const MAP=SRC.map(k=>MORDER.indexOf(k)),NS=6;
let ort,sess,ep,MBUF=null,wasmSess=null;
async function model(url){const c=await caches.open('bp-ai-models-v4');let r=await c.match(url);
  if(r){const b=new Uint8Array(await r.arrayBuffer());if(b.length===MODEL_BYTES)return b;await c.delete(url)}
  const n=await fetch(url);if(!n.ok)throw Error('model '+n.status);const len=+n.headers.get('content-length')||MODEL_BYTES;
  const rd=n.body.getReader(),out=new Uint8Array(len);let got=0;
  for(;;){const{done,value}=await rd.read();if(done)break;if(got+value.length>out.length)throw Error('model size');out.set(value,got);got+=value.length;postMessage({t:'dl',p:got/len})}
  if(got!==MODEL_BYTES)throw Error('model incomplete '+got);
  try{await c.put(url,new Response(new Blob([out])))}catch(e){postMessage({t:'log',m:'cache put failed (no space?) — will download again next time: '+e.message});postMessage({t:'nocache'})}
  return out}
async function init(o){if(sess)return;ort=await import(o.ort||ORT+(o.wasmOnly?'ort.wasm.min.mjs':'ort.webgpu.min.mjs'));ort.env.wasm.wasmPaths=o.ortBase||ORT;
  ort.env.wasm.numThreads=self.crossOriginIsolated?Math.min(8,navigator.hardwareConcurrency||4):1;
  const buf=await model(o.model||MODEL);MBUF=buf;const t=performance.now();
  for(const e of (o.eps||['webgpu','wasm'])){try{sess=await ort.InferenceSession.create(buf,{executionProviders:[e],graphOptimizationLevel:'all',enableMemPattern:false});ep=e;break}catch(x){postMessage({t:'log',m:e+' failed: '+x.message})}}
  if(!sess)throw Error('no backend');postMessage({t:'ready',ep,threads:ort.env.wasm.numThreads,loadMs:performance.now()-t,src:SRC,hq:1})}
/* ---- radix-2 FFT (in place, N=2048) ---- */
const rev=new Uint32Array(NF),cosT=new Float64Array(NF/2),sinT=new Float64Array(NF/2);
{const b=Math.log2(NF);for(let i=0;i<NF;i++){let r=0;for(let j=0;j<b;j++)r|=((i>>j)&1)<<(b-1-j);rev[i]=r}for(let i=0;i<NF/2;i++){cosT[i]=Math.cos(2*Math.PI*i/NF);sinT[i]=Math.sin(2*Math.PI*i/NF)}}
function fft(re,im,inv){for(let i=0;i<NF;i++){const j=rev[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
  for(let s=2;s<=NF;s<<=1){const h=s>>1,st=NF/s;for(let i=0;i<NF;i+=s)for(let k=0;k<h;k++){const c=cosT[k*st],sn=inv?sinT[k*st]:-sinT[k*st];
    const a=i+k,b=a+h,xr=re[b]*c-im[b]*sn,xi=re[b]*sn+im[b]*c;re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi}}}
const win=new Float64Array(NF);for(let i=0;i<NF;i++)win[i]=0.5-0.5*Math.cos(2*Math.PI*i/NF); // periodic Hann (torch.hann_window)
const fre=new Float64Array(NF),fim=new Float64Array(NF);
/** chunk [2][C] → spec_real/spec_imag [1,2,1025,T] (torch.stft centre=True reflect, not normalised) */
function stft(xL,xR,SR,SI){const P=NF/2,get=(x,j)=>{if(j<0)j=-j;else if(j>=C)j=2*(C-1)-j;return x[j]};
  for(let t=0;t<T;t++){const o=t*HOP-P;for(let i=0;i<NF;i++){fre[i]=get(xL,o+i)*win[i];fim[i]=get(xR,o+i)*win[i]}fft(fre,fim,false);
    for(let k=0;k<FB;k++){const k2=(NF-k)%NF,zr=fre[k],zi=fim[k],wr=fre[k2],wi=fim[k2];
      SR[k*T+t]=0.5*(zr+wr);SI[k*T+t]=0.5*(zi-wi);           // L = (Z[k]+conj Z[N-k])/2
      SR[(FB+k)*T+t]=0.5*(zi+wi);SI[(FB+k)*T+t]=-0.5*(zr-wr)}}} // R = (Z[k]-conj Z[N-k])/2i
/** masked spectra of one stem (offset into [6,2,1025,T]) → time [2][C] (torch.istft centre=True) */
const olL=new Float64Array(NF+HOP*(T-1)),olR=new Float64Array(NF+HOP*(T-1)),wsq=new Float64Array(NF+HOP*(T-1));
{for(let t=0;t<T;t++)for(let i=0;i<NF;i++)wsq[t*HOP+i]+=win[i]*win[i]}
function istft(OR,OI,base,outL,outR){olL.fill(0);olR.fill(0);const bL=base,bR=base+FB*T;
  for(let t=0;t<T;t++){for(let k=0;k<FB;k++){const ar=OR[bL+k*T+t],ai=OI[bL+k*T+t],br=OR[bR+k*T+t],bi=OI[bR+k*T+t];
      fre[k]=ar-bi;fim[k]=ai+br;if(k>0&&k<NF/2){fre[NF-k]=ar+bi;fim[NF-k]=-ai+br}}   // Z = L + iR (Hermitian parts)
    fft(fre,fim,true);const o=t*HOP;for(let i=0;i<NF;i++){const w=win[i]/NF;olL[o+i]+=fre[i]*w;olR[o+i]+=fim[i]*w}}
  const P=NF/2;for(let i=0;i<C;i++){const d=wsq[P+i]>1e-10?wsq[P+i]:1;outL[i]=olL[P+i]/d;outR[i]=olR[P+i]/d}}
function bad(y){let nf=0,pk=0;for(let i=0;i<y.length;i+=7){const v=y[i];if(!Number.isFinite(v))nf++;else{const a=v<0?-v:v;if(a>pk)pk=a}}return nf>0||pk>1e4}
async function runChunk(SR,SI){
  const feed=s=>s.run({spec_real:new ort.Tensor('float32',SR,[1,2,FB,T]),spec_imag:new ort.Tensor('float32',SI,[1,2,FB,T])}).then(r=>[r.out_spec_real.data,r.out_spec_imag.data]);
  let y;try{y=await feed(sess)}catch(e){if(ep==='wasm')throw e;postMessage({t:'log',m:'HQ '+ep+' run failed → wasm: '+e.message});
    sess=await ort.InferenceSession.create(MBUF,{executionProviders:['wasm'],graphOptimizationLevel:'all',enableMemPattern:false});ep='wasm';y=await feed(sess)}
  if((bad(y[0])||bad(y[1]))&&ep!=='wasm'){postMessage({t:'log',m:'HQ chunk bad on '+ep+' → retry wasm'});
    try{if(!wasmSess)wasmSess=await ort.InferenceSession.create(MBUF,{executionProviders:['wasm'],graphOptimizationLevel:'all',enableMemPattern:false});y=await feed(wasmSess)}catch(e){postMessage({t:'log',m:'wasm retry failed: '+e.message})}}
  for(const a of y)if(bad(a))for(let i=0;i<a.length;i++)if(!Number.isFinite(a[i]))a[i]=0;
  return y}
async function sep(L,R){const N=L.length,pad=OVL,tot=pad+N,n=Math.max(1,Math.ceil((tot-OVL)/STEP));
  const fade=new Float32Array(C);for(let i=0;i<C;i++)fade[i]=Math.min(1,(i+1)/OVL,(C-i)/OVL);
  const out=SRC.map(()=>[new Float32Array(N),new Float32Array(N)]),wt=new Float32Array(N),t0=performance.now();
  const xL=new Float32Array(C),xR=new Float32Array(C),SR=new Float32Array(2*FB*T),SI=new Float32Array(2*FB*T),oL=new Float32Array(C),oR=new Float32Array(C);
  for(let c=0;c<n;c++){const s=c*STEP-pad;xL.fill(0);xR.fill(0);
    for(let i=0;i<C;i++){const j=s+i;if(j>=0&&j<N){xL[i]=L[j];xR[i]=R[j]}}
    stft(xL,xR,SR,SI);const[OR,OI]=await runChunk(SR,SI);
    for(let k=0;k<NS;k++){istft(OR,OI,MAP[k]*2*FB*T,oL,oR);const a=out[k][0],b=out[k][1];
      for(let i=0;i<C;i++){const j=s+i;if(j<0||j>=N)continue;a[j]+=oL[i]*fade[i];b[j]+=oR[i]*fade[i]}}
    for(let i=0;i<C;i++){const j=s+i;if(j>=0&&j<N)wt[j]+=fade[i]}
    postMessage({t:'prog',p:(c+1)/n,ms:performance.now()-t0,ep})}
  for(const st of out)for(const o of st)for(let i=0;i<N;i++)o[i]/=wt[i]||1;return out}
onmessage=async({data:d})=>{try{await init(d.opt||{});if(d.L){
  const N=d.L.length,sr=d.sr||44100;
  postMessage({t:'sepStart',n:N,sec:N/sr,sr,src:SRC,hq:1});
  const o=await sep(d.L,d.R);
  for(let k=0;k<NS;k++){const L=o[k][0],R=o[k][1];postMessage({t:'stem',i:k,name:SRC[k],L,R,n:N},[L.buffer,R.buffer])}
  postMessage({t:'done',src:SRC,n:N,sr,hq:1});
}}catch(e){postMessage({t:'err',m:String(e&&e.message||e)})}};
