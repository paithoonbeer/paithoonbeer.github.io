// SetSod — AI stem splitter worker. htdemucs 6s (MIT) via onnxruntime-web.
// ONNX output order verified on real songs (index 4 = guitar energy, index 5 = piano):
//   drums · bass · other · vocals · guitar · piano
const ORT='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
const MODEL='https://huggingface.co/alfajgjK/stemstudio-htdemucs-onnx/resolve/main/htdemucs_6s.opt.fp16.istft.s2s.onnx';
const N=343980,OV=N>>2,ST=N-OV,SRC=['drums','bass','other','vocals','guitar','piano'];
const NS=SRC.length;
let ort,sess,ep;
async function model(url){const c=await caches.open('bp-ai-models-v4');let r=await c.match(url);
  if(!r){const n=await fetch(url);if(!n.ok)throw Error('model '+n.status);const len=+n.headers.get('content-length')||142604923;
    const rd=n.body.getReader(),parts=[];let got=0;for(;;){const{done,value}=await rd.read();if(done)break;parts.push(value);got+=value.length;postMessage({t:'dl',p:got/len})}
    const b=new Blob(parts);await c.put(url,new Response(b));return new Uint8Array(await b.arrayBuffer())}
  return new Uint8Array(await r.arrayBuffer())}
async function init(o){if(sess)return;ort=await import(o.ort||ORT+(o.wasmOnly?'ort.wasm.min.mjs':'ort.webgpu.min.mjs'));ort.env.wasm.wasmPaths=o.ortBase||ORT;
  ort.env.wasm.numThreads=self.crossOriginIsolated?Math.min(8,navigator.hardwareConcurrency||4):1;
  const buf=await model(o.model||MODEL);MBUF=buf;const t=performance.now();
  for(const e of (o.eps||['webgpu','wasm'])){try{sess=await ort.InferenceSession.create(buf,{executionProviders:[e],graphOptimizationLevel:o.opt||'all',enableMemPattern:false});ep=e;break}catch(x){postMessage({t:'log',m:e+' failed: '+x.message})}}
  if(!sess)throw Error('no backend');postMessage({t:'ready',ep,threads:ort.env.wasm.numThreads,loadMs:performance.now()-t,src:SRC})}
// Data 1.0.29: guard each chunk. WebGPU fp16 can return NaN/Inf or an all-zero chunk;
// NaN poisons the overlap-add (silent audio, broken/blocky graph for ~8 s). Retry that
// chunk on WASM, and as a last resort zero only the non-finite samples.
let wasmSess=null,MBUF=null;
function chunkBad(x,y,len){let nf=0,ein=0,eout=0,pk=0;
  for(let i=0;i<len;i++){const a=x[i],b=x[N+i];ein+=a*a+b*b}
  for(let k=0;k<NS*2;k++){const o=k*N;for(let i=0;i<len;i++){const v=y[o+i];if(!Number.isFinite(v)){nf++;continue}eout+=v*v;const a=v<0?-v:v;if(a>pk)pk=a}}
  return nf>0||pk>8||(ein>len*1e-6&&eout<ein*1e-4)?{nf,pk,ratio:ein?eout/ein:0}:null}
async function runChunk(x,len){
  const feed=s=>s.run({[s.inputNames[0]]:new ort.Tensor('float32',x,[1,2,N])}).then(r=>r[s.outputNames[0]].data);
  let y=await feed(sess),bad=chunkBad(x,y,len);
  if(bad&&ep!=='wasm'){
    postMessage({t:'log',m:'chunk bad on '+ep+' '+JSON.stringify(bad)+' → retry wasm'});
    try{if(!wasmSess)wasmSess=await ort.InferenceSession.create(MBUF,{executionProviders:['wasm'],graphOptimizationLevel:'all',enableMemPattern:false}); // same ORT bundle has the wasm EP
      y=await feed(wasmSess);bad=chunkBad(x,y,len)}catch(e){postMessage({t:'log',m:'wasm retry failed: '+e.message})}
  }
  if(bad&&bad.nf){y=Float32Array.from(y);for(let i=0;i<y.length;i++)if(!Number.isFinite(y[i]))y[i]=0}
  return y}
async function sep(L,R){const T=L.length,n=Math.max(1,Math.ceil((T-OV)/ST)),w=new Float32Array(N);
  for(let i=0;i<N;i++)w[i]=i<OV?(i+1)/OV:i>=N-OV?(N-i)/OV:1;
  const out=SRC.map(()=>[new Float32Array(T),new Float32Array(T)]),wt=new Float32Array(T),t0=performance.now();
  for(let c=0;c<n;c++){const s=c*ST,e=Math.min(s+N,T),len=e-s,x=new Float32Array(2*N);x.set(L.subarray(s,e),0);x.set(R.subarray(s,e),N);
    const y=await runChunk(x,len);// (1,NS,2,N)
    for(let k=0;k<NS;k++)for(let ch=0;ch<2;ch++){const o=out[k][ch],b=(k*2+ch)*N;for(let i=0;i<len;i++)o[s+i]+=y[b+i]*w[i]}
    for(let i=0;i<len;i++)wt[s+i]+=w[i];postMessage({t:'prog',p:(c+1)/n,ms:performance.now()-t0})}
  for(const st of out)for(const o of st)for(let i=0;i<T;i++)o[i]/=wt[i]||1;return out}
// Send stems one-by-one so large songs don't truncate on a single giant postMessage
onmessage=async({data:d})=>{try{await init(d.opt||{});if(d.L){
  const T=d.L.length,sr=d.sr||44100;
  postMessage({t:'sepStart',n:T,sec:T/sr,sr,src:SRC});
  const o=await sep(d.L,d.R);
  for(let k=0;k<NS;k++){
    const L=o[k][0],R=o[k][1];
    postMessage({t:'stem',i:k,name:SRC[k],L,R,n:T},[L.buffer,R.buffer]);
  }
  postMessage({t:'done',src:SRC,n:T,sr});
}}catch(e){postMessage({t:'err',m:String(e&&e.message||e)})}};
