// SetSod — AI stem splitter worker. htdemucs 6s (MIT) via onnxruntime-web.
// Demucs v4 htdemucs_6s output order (Meta release notes):
//   drums · bass · other · vocals · piano · guitar
// (piano BEFORE guitar — swapping these dumps electric guitar into the wrong lane)
const ORT='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
const MODEL='https://huggingface.co/alfajgjK/stemstudio-htdemucs-onnx/resolve/main/htdemucs_6s.opt.fp16.istft.s2s.onnx';
const N=343980,OV=N>>2,ST=N-OV,SRC=['drums','bass','other','vocals','piano','guitar'];
const NS=SRC.length;
let ort,sess,ep;
async function model(url){const c=await caches.open('bp-ai-models-v3');let r=await c.match(url);
  if(!r){const n=await fetch(url);if(!n.ok)throw Error('model '+n.status);const len=+n.headers.get('content-length')||142604923;
    const rd=n.body.getReader(),parts=[];let got=0;for(;;){const{done,value}=await rd.read();if(done)break;parts.push(value);got+=value.length;postMessage({t:'dl',p:got/len})}
    const b=new Blob(parts);await c.put(url,new Response(b));return new Uint8Array(await b.arrayBuffer())}
  return new Uint8Array(await r.arrayBuffer())}
async function init(o){if(sess)return;ort=await import(o.ort||ORT+(o.wasmOnly?'ort.wasm.min.mjs':'ort.webgpu.min.mjs'));ort.env.wasm.wasmPaths=o.ortBase||ORT;
  ort.env.wasm.numThreads=self.crossOriginIsolated?Math.min(8,navigator.hardwareConcurrency||4):1;
  const buf=await model(o.model||MODEL);const t=performance.now();
  for(const e of (o.eps||['webgpu','wasm'])){try{sess=await ort.InferenceSession.create(buf,{executionProviders:[e],graphOptimizationLevel:o.opt||'all',enableMemPattern:false});ep=e;break}catch(x){postMessage({t:'log',m:e+' failed: '+x.message})}}
  if(!sess)throw Error('no backend');postMessage({t:'ready',ep,threads:ort.env.wasm.numThreads,loadMs:performance.now()-t,src:SRC})}
async function sep(L,R){const T=L.length,n=Math.max(1,Math.ceil((T-OV)/ST)),w=new Float32Array(N);
  for(let i=0;i<N;i++)w[i]=i<OV?(i+1)/OV:i>=N-OV?(N-i)/OV:1;
  const out=SRC.map(()=>[new Float32Array(T),new Float32Array(T)]),wt=new Float32Array(T),t0=performance.now();
  for(let c=0;c<n;c++){const s=c*ST,e=Math.min(s+N,T),len=e-s,x=new Float32Array(2*N);x.set(L.subarray(s,e),0);x.set(R.subarray(s,e),N);
    const r=await sess.run({[sess.inputNames[0]]:new ort.Tensor('float32',x,[1,2,N])});const y=r[sess.outputNames[0]].data;// (1,NS,2,N)
    for(let k=0;k<NS;k++)for(let ch=0;ch<2;ch++){const o=out[k][ch],b=(k*2+ch)*N;for(let i=0;i<len;i++)o[s+i]+=y[b+i]*w[i]}
    for(let i=0;i<len;i++)wt[s+i]+=w[i];postMessage({t:'prog',p:(c+1)/n,ms:performance.now()-t0})}
  for(const st of out)for(const o of st)for(let i=0;i<T;i++)o[i]/=wt[i]||1;return out}
onmessage=async({data:d})=>{try{await init(d.opt||{});if(d.L){const o=await sep(d.L,d.R);postMessage({t:'done',src:SRC,out:o},o.flat().map(a=>a.buffer))}
}catch(e){postMessage({t:'err',m:String(e&&e.message||e)})}};
