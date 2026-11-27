// SetSod Data — optional fine split (แยกละเอียด).
// DrumSep v2 (inagoy / Gridshift, MIT) — drums → kick, snare, cymbals, toms.
// UVR-MDX-NET KARA 2 (Ultimate Vocal Remover, MIT) — vocals → lead, backing.
// Guitar 1.0.51 — DSP center/side lead↔rhythm (no big model). Parent fold keeps sum = original guitar.
// Hosted on Hugging Face like htdemucs_6s (GitHub Pages is 100 MB/file). Cache API: bp-ai-models-v4.
// STFT/iSTFT run in JS (HDemucs contract for DrumSep; UVR/audio-separator contract for KARA 2).
const ORT='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
const CACHE='bp-ai-models-v4';
const MODELS={
  drums:{
    url:'https://huggingface.co/Acapellas/drumsep-v2-onnx/resolve/main/drumsep_v2_w10_f16w.onnx',
    bytes:168050967,
    sha:'b05779ea756870f3fe359c63ac501dd12caf3b24d66237b1404bb4dd5b32839a',
    src:['kick','snare','cymbals','toms']
  },
  vocals:{
    url:'https://huggingface.co/TheDailyOWO/splitwave-models/resolve/main/mdx_kara_2.onnx',
    bytes:52786726,
    sha:'bf32e15105a09c0f7dddd2b67346146334d6f3ecb399ed7638eba2ab07cbf5f4',
    src:['lead','backing']
  },
  guitar:{
    url:null,bytes:0,sha:null,
    src:['grhythm','glead']
  }
};

function hex(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function modelBytes(url, expect, sha){
  const c=await caches.open(CACHE);let r=await c.match(url);
  if(!r){
    const n=await fetch(url);if(!n.ok)throw Error('model '+n.status);
    const len=+(n.headers.get('content-length')||expect||0);
    const rd=n.body.getReader(),parts=[];let got=0;
    for(;;){const{done,value}=await rd.read();if(done)break;parts.push(value);got+=value.length;postMessage({t:'dl',p:len?got/len:0})}
    const b=new Blob(parts);r=new Response(b,{headers:{'Content-Type':'application/octet-stream'}});await c.put(url,r);r=await c.match(url);
  }
  const u8=new Uint8Array(await r.arrayBuffer());
  if(sha&&crypto.subtle){
    const got=hex(await crypto.subtle.digest('SHA-256',u8));
    if(got!==sha)throw Error('model sha mismatch');
  }
  return u8;
}

/* ---------- FFT (radix-2 + Bluestein for 5120) ---------- */
function bitrev(re,im){
  const n=re.length;let j=0;
  for(let i=1;i<n;i++){
    let b=n>>1;
    for(;j&b;b>>=1)j^=b;j^=b;
    if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}
  }
}
function fft2(re,im,inv){
  const n=re.length;bitrev(re,im);
  for(let len=2;len<=n;len<<=1){
    const ang=(inv?2:-2)*Math.PI/len,wre=Math.cos(ang),wim=Math.sin(ang);
    for(let i=0;i<n;i+=len){
      let ur=1,ui=0;
      for(let j=0;j<len/2;j++){
        const p=i+j,q=p+len/2;
        const tr=ur*re[q]-ui*im[q],ti=ur*im[q]+ui*re[q];
        re[q]=re[p]-tr;im[q]=im[p]-ti;re[p]+=tr;im[p]+=ti;
        const nr=ur*wre-ui*wim;ui=ur*wim+ui*wre;ur=nr;
      }
    }
  }
  if(inv){const s=1/n;for(let i=0;i<n;i++){re[i]*=s;im[i]*=s}}
}
function nextPow2(n){let p=1;while(p<n)p<<=1;return p}
const bluCache=new Map();
// Chirp z-transform DFT: X[k] = c[k] * ( (x*c) conv b ), c=exp(-jπk²/n), b=exp(+jπm²/n)
function bluesteinFwd(re,im){
  const n=re.length,m=nextPow2(2*n-1);
  let C=bluCache.get(n);
  if(!C){
    const cr=new Float64Array(n),ci=new Float64Array(n);
    const br=new Float64Array(m),bi=new Float64Array(m);
    for(let k=0;k<n;k++){
      const a=Math.PI*k*k/n;
      cr[k]=Math.cos(-a);ci[k]=Math.sin(-a);
      const bp=Math.cos(a),bq=Math.sin(a);
      br[k]=bp;bi[k]=bq;if(k){br[m-k]=bp;bi[m-k]=bq}
    }
    fft2(br,bi,false);C={cr,ci,br,bi,m};bluCache.set(n,C);
  }
  const ar=new Float64Array(m),ai=new Float64Array(m);
  for(let k=0;k<n;k++){
    ar[k]=re[k]*C.cr[k]-im[k]*C.ci[k];
    ai[k]=re[k]*C.ci[k]+im[k]*C.cr[k];
  }
  fft2(ar,ai,false);
  for(let k=0;k<m;k++){const rr=ar[k]*C.br[k]-ai[k]*C.bi[k],ii=ar[k]*C.bi[k]+ai[k]*C.br[k];ar[k]=rr;ai[k]=ii}
  fft2(ar,ai,true);
  for(let k=0;k<n;k++){
    const rr=ar[k]*C.cr[k]-ai[k]*C.ci[k],ii=ar[k]*C.ci[k]+ai[k]*C.cr[k];
    re[k]=rr;im[k]=ii;
  }
}
function fftC(re,im,inv){
  const n=re.length;
  if((n&(n-1))===0){fft2(re,im,inv);return}
  if(inv){
    for(let i=0;i<n;i++)im[i]=-im[i];
    bluesteinFwd(re,im);
    const s=1/n;for(let i=0;i<n;i++){im[i]=-im[i];re[i]*=s;im[i]*=s}
  }else bluesteinFwd(re,im);
}

/* ---------- signal helpers ---------- */
function hannPeriodic(n){const w=new Float32Array(n);for(let i=0;i<n;i++)w[i]=0.5-0.5*Math.cos(2*Math.PI*i/n);return w}
function atReflect(y,n,idx){
  if(n<=1)return y[0]||0;
  const p=2*(n-1);let t=((idx%p)+p)%p;if(t>=n)t=p-t;return y[t];
}
function pad1dReflect(x,left,right){
  let y=x,L=left|0,R=right|0,n=x.length;
  const maxp=Math.max(L,R);
  if(n<=maxp){
    const extra=maxp-n+1,er=Math.min(R,extra),el=extra-er;
    const z=new Float32Array(n+el+er);if(n)z.set(x,el);
    y=z;n=y.length;L-=el;R-=er;
  }
  const out=new Float32Array(n+L+R);
  out.set(y,L);
  for(let i=0;i<L;i++)out[i]=atReflect(y,n,i-L);
  for(let i=0;i<R;i++)out[L+n+i]=atReflect(y,n,n+i);
  return out;
}

// onesided STFT matching torch.stft(center, pad_mode, normalized, periodic hann already passed)
function stftOnesided(x,nfft,hop,win,opt){
  opt=opt||{};
  const center=opt.center!==false, norm=!!opt.normalized, mode=opt.padMode||'reflect';
  let y=x;
  if(center){
    const p=nfft>>1;
    y=mode==='reflect'?pad1dReflect(x,p,p):(()=>{const z=new Float32Array(x.length+2*p);z.set(x,p);return z})();
  }
  const nFrames=1+Math.floor((y.length-nfft)/hop);
  const nBins=(nfft>>1)+1;
  const Re=new Float32Array(nBins*nFrames),Im=new Float32Array(nBins*nFrames);
  const scale=norm?1/Math.sqrt(nfft):1;
  const re=new Float64Array(nfft),im=new Float64Array(nfft);
  for(let f=0;f<nFrames;f++){
    const o=f*hop;re.fill(0);im.fill(0);
    for(let i=0;i<nfft;i++)re[i]=(y[o+i]||0)*win[i]*scale;
    fftC(re,im,false);
    for(let k=0;k<nBins;k++){Re[k*nFrames+f]=re[k];Im[k*nFrames+f]=im[k]}
  }
  return{Re,Im,nBins,nFrames};
}
function istftOnesided(Re,Im,nfft,hop,win,nFrames,length,opt){
  opt=opt||{};
  const center=opt.center!==false, norm=!!opt.normalized;
  const scale=norm?Math.sqrt(nfft):1; // undo forward * 1/sqrt + ifft 1/n already in fftC inv
  // output length if center: (nFrames-1)*hop + nfft, then crop nfft/2 from each side
  const rawLen=(nFrames-1)*hop+nfft;
  const acc=new Float64Array(rawLen),wacc=new Float64Array(rawLen);
  const re=new Float64Array(nfft),im=new Float64Array(nfft);
  const nBins=(nfft>>1)+1;
  for(let f=0;f<nFrames;f++){
    re.fill(0);im.fill(0);
    for(let k=0;k<nBins;k++){re[k]=Re[k*nFrames+f];im[k]=Im[k*nFrames+f]}
    // hermitian
    for(let k=1;k<nBins-1;k++){re[nfft-k]=re[k];im[nfft-k]=-im[k]}
    fftC(re,im,true);
    const o=f*hop;
    for(let i=0;i<nfft;i++){
      const w=win[i];
      acc[o+i]+=re[i]*w*scale;wacc[o+i]+=w*w;
    }
  }
  const start=center?(nfft>>1):0;
  const n=length!=null?length:(center?rawLen-nfft:rawLen);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){const j=start+i;out[i]=wacc[j]>1e-12?acc[j]/wacc[j]:acc[j]}
  return out;
}

function fadeWindow(n,ov){
  const w=new Float32Array(n);for(let i=0;i<n;i++)w[i]=i<ov?(i+1)/ov:i>=n-ov?(n-i)/ov:1;return w;
}
function overlapPlan(T,N,OV){const ST=N-OV;const n=Math.max(1,Math.ceil((T-OV)/ST));const sp=[];for(let c=0;c<n;c++){const s=c*ST;sp.push([s,Math.min(s+N,T)])}return{n,ST,sp}}

/* ---------- DrumSep v2 (HDemucs 10 s) ---------- */
const DRUM_N=441000,NFFT_D=4096,HOP_D=1024;
function drumSpec(mix /* [2][DRUM_N] */){
  const hl=HOP_D,nfft=NFFT_D,len=mix[0].length;
  const le=Math.ceil(len/hl),pad=hl/2*3,right=pad+le*hl-len;
  const x0=pad1dReflect(mix[0],pad,right),x1=pad1dReflect(mix[1],pad,right);
  const win=hannPeriodic(nfft);
  const a=stftOnesided(x0,nfft,hl,win,{center:true,normalized:true,padMode:'reflect'});
  const b=stftOnesided(x1,nfft,hl,win,{center:true,normalized:true,padMode:'reflect'});
  // drop Nyquist, then take frames [2, 2+le)
  const F=2048,T=le; // nBins was 2049
  if(a.nFrames<le+4)throw Error('drum stft frames '+a.nFrames);
  const mag=new Float32Array(1*4*F*T);
  // pack Lre,Lim,Rre,Rim — layout [1,4,F,T] row-major
  const pack=(ch,reim,srcRe,srcIm)=>{
    for(let f=0;f<F;f++)for(let t=0;t<T;t++){
      const srcFrame=2+t,srcBin=f; // drop last bin already by F=2048
      const v=reim?srcIm[srcBin*a.nFrames+srcFrame]:srcRe[srcBin*a.nFrames+srcFrame];
      mag[((ch*2+reim)*F+f)*T+t]=v;
    }
  };
  pack(0,0,a.Re,a.Im);pack(0,1,a.Re,a.Im);pack(1,0,b.Re,b.Im);pack(1,1,b.Re,b.Im);
  return{mag,le};
}
function drumIspec(freq /* [4][4][2048][T] flat or typed */, Tframes, length){
  // freq_out: [1,4,4,2048,T] — stems, CAC (Lre Lim Rre Rim), F, T
  const stems=4,F=2048,hl=HOP_D,nfft=NFFT_D,win=hannPeriodic(nfft);
  const out=new Array(stems);
  for(let s=0;s<stems;s++){
    const chs=[];
    for(let ch=0;ch<2;ch++){
      const Re=new Float32Array((F+1)* (Tframes+4)); // Nyquist + 2 pad each side
      const Im=new Float32Array(Re.length);
      const nFrames=Tframes+4,nBins=F+1;
      for(let t=0;t<Tframes;t++){
        const tt=t+2;
        const oRe=s*4*F*Tframes + (ch*2)*F*Tframes; // Lre or Rre
        const oIm=s*4*F*Tframes + (ch*2+1)*F*Tframes;
        for(let f=0;f<F;f++){
          Re[f*nFrames+tt]=freq[oRe+f*Tframes+t];
          Im[f*nFrames+tt]=freq[oIm+f*Tframes+t];
        }
      }
      const pad=hl/2*3;
      const le=hl*Math.ceil(length/hl)+2*pad;
      const wav=istftOnesided(Re,Im,nfft,hl,win,nFrames,le,{center:true,normalized:true});
      chs.push(wav.subarray(pad,pad+length));
    }
    out[s]=chs;
  }
  return out;
}
async function runDrumsep(L,R,sess){
  const T=L.length,OV=DRUM_N>>2,{n,sp}=overlapPlan(T,DRUM_N,OV);
  const w=fadeWindow(DRUM_N,OV);
  const acc=Array.from({length:4},()=>[new Float32Array(T),new Float32Array(T)]);
  const wt=new Float32Array(T),t0=performance.now();
  for(let c=0;c<n;c++){
    const[s,e]=sp[c],ln=e-s;
    const mix0=new Float32Array(DRUM_N),mix1=new Float32Array(DRUM_N);
    mix0.set(L.subarray(s,e));mix1.set(R.subarray(s,e));
    const{mag}=drumSpec([mix0,mix1]);
    const mix=new Float32Array(2*DRUM_N);mix.set(mix0,0);mix.set(mix1,DRUM_N);
    const r=await sess.run({
      mix:new ort.Tensor('float32',mix,[1,2,DRUM_N]),
      mag:new ort.Tensor('float32',mag,[1,4,2048,431])
    });
    const freq=r.freq_out.data, time=r.time_out.data;
    const wavs=drumIspec(freq,431,DRUM_N);
    for(let k=0;k<4;k++){
      const tOff=k*2*DRUM_N;
      for(let ch=0;ch<2;ch++){
        const src=wavs[k][ch];
        const o=acc[k][ch];
        for(let i=0;i<ln;i++)o[s+i]+=(src[i]+time[tOff+ch*DRUM_N+i])*w[i];
      }
    }
    for(let i=0;i<ln;i++)wt[s+i]+=w[i];
    postMessage({t:'prog',p:(c+1)/n,ms:performance.now()-t0});
  }
  for(const st of acc)for(const o of st)for(let i=0;i<T;i++)o[i]/=wt[i]||1;
  return acc;
}

/* ---------- UVR KARA 2 ---------- */
const KARA_NFFT=5120,KARA_HOP=1024,KARA_DIMF=2048,KARA_DIMT=256;
const KARA_N=KARA_HOP*(KARA_DIMT-1),KARA_TRIM=KARA_NFFT>>1,KARA_GEN=KARA_N-2*KARA_TRIM,KARA_COMP=1.065;
function karaPack(L,R){
  const win=hannPeriodic(KARA_NFFT);
  const a=stftOnesided(L,KARA_NFFT,KARA_HOP,win,{center:true,normalized:false,padMode:'constant'});
  const b=stftOnesided(R,KARA_NFFT,KARA_HOP,win,{center:true,normalized:false,padMode:'constant'});
  const F=KARA_DIMF,T=KARA_DIMT;
  if(a.nFrames<T)throw Error('kara frames '+a.nFrames);
  const inp=new Float32Array(4*F*T);
  const put=(ch,reim,srcRe,srcIm)=>{
    for(let f=0;f<F;f++)for(let t=0;t<T;t++){
      let v=reim?srcIm[f*a.nFrames+t]:srcRe[f*a.nFrames+t];
      if(f<3)v=0;
      inp[((ch*2+reim)*F+f)*T+t]=v;
    }
  };
  put(0,0,a.Re,a.Im);put(0,1,a.Re,a.Im);put(1,0,b.Re,b.Im);put(1,1,b.Re,b.Im);
  return inp;
}
function karaUnpack(out,length){
  // out [4,F,T] → two channels via iSTFT with high bins zero
  const F=KARA_DIMF,T=KARA_DIMT,nfft=KARA_NFFT,nBins=(nfft>>1)+1,win=hannPeriodic(nfft);
  const chs=[];
  for(let ch=0;ch<2;ch++){
    const Re=new Float32Array(nBins*T),Im=new Float32Array(nBins*T);
    const oRe= (ch*2)*F*T, oIm=(ch*2+1)*F*T;
    for(let f=0;f<F;f++)for(let t=0;t<T;t++){
      Re[f*T+t]=out[oRe+f*T+t];Im[f*T+t]=out[oIm+f*T+t];
    }
    chs.push(istftOnesided(Re,Im,nfft,KARA_HOP,win,T,length,{center:true,normalized:false}));
  }
  return chs;
}
function hannNz(n){const w=new Float32Array(n);for(let i=0;i<n;i++)w[i]=0.5-0.5*Math.cos(2*Math.PI*i/(n-1||1));return w} // np.hanning
async function runKara2(L,R,sess){
  const T0=L.length;
  // peak-normalize
  let pk=1e-8;for(let i=0;i<T0;i++){const a=L[i]<0?-L[i]:L[i],b=R[i]<0?-R[i]:R[i];if(a>pk)pk=a;if(b>pk)pk=b}
  const Ls=new Float32Array(T0),Rs=new Float32Array(T0);
  for(let i=0;i<T0;i++){Ls[i]=L[i]/pk;Rs[i]=R[i]/pk}
  const pad=KARA_GEN+KARA_TRIM-(T0%KARA_GEN);
  const tot=KARA_TRIM+T0+pad;
  const mL=new Float32Array(tot),mR=new Float32Array(tot);
  mL.set(Ls,KARA_TRIM);mR.set(Rs,KARA_TRIM);
  const overlap=0.25,step=Math.max(1,(KARA_N*(1-overlap))|0);
  const accL=new Float32Array(tot),accR=new Float32Array(tot),wt=new Float32Array(tot);
  const t0=performance.now();let c=0,nEst=Math.ceil(tot/step);
  for(let i=0;i<tot;i+=step){
    const start=i,end=Math.min(i+KARA_N,tot),actual=end-start;
    const pL=new Float32Array(KARA_N),pR=new Float32Array(KARA_N);
    pL.set(mL.subarray(start,end));pR.set(mR.subarray(start,end));
    const inp=karaPack(pL,pR);
    const pred=(await sess.run({input:new ort.Tensor('float32',inp,[1,4,KARA_DIMF,KARA_DIMT])})).output.data;
    const wav=karaUnpack(pred,KARA_N);
    const win=hannNz(actual);
    for(let k=0;k<actual;k++){accL[start+k]+=wav[0][k]*win[k];accR[start+k]+=wav[1][k]*win[k];wt[start+k]+=win[k]}
    c++;postMessage({t:'prog',p:Math.min(1,c/nEst),ms:performance.now()-t0});
  }
  const primaryL=new Float32Array(T0),primaryR=new Float32Array(T0);
  for(let i=0;i<T0;i++){
    const j=KARA_TRIM+i,d=wt[j]>1e-8?wt[j]:1;
    primaryL[i]=accL[j]/d*pk;primaryR[i]=accR[j]/d*pk;
  }
  const leadL=new Float32Array(T0),leadR=new Float32Array(T0);
  for(let i=0;i<T0;i++){leadL[i]=L[i]-KARA_COMP*primaryL[i];leadR[i]=R[i]-KARA_COMP*primaryR[i]}
  return[[leadL,leadR],[primaryL,primaryR]];
}

/* ---------- Guitar lead / rhythm (DSP, no ONNX) ----------
   Lead ≈ center (mid) content gated by center-vs-side envelopes (typical rock: solo center, rhythm wide).
   Rhythm = residual (mutates L/R in place). Studio foldResidual restores exact parent sum when both unmuted.
   1.0.52: yield + single done{stems} — long songs used to hit ~97% then “ไม่ครบสเต็ม” (multi stem postMessage drops). */
async function runGuitarSep(L,R,sr){
  const n=L.length,sr0=Math.max(8000,+sr||44100);
  const leadL=new Float32Array(n),leadR=new Float32Array(n);
  const aEnv=Math.exp(-1/(sr0*0.028));
  const hpA=Math.exp(-2*Math.PI*180/sr0); // gentle HPF on mid → solo body
  let envM=0,envS=0,hp=0;
  const t0=performance.now();let lastP=0;
  for(let i=0;i<n;i++){
    const mid=0.5*(L[i]+R[i]),side=0.5*(L[i]-R[i]);
    hp=hpA*hp+(1-hpA)*mid;const midHp=mid-hp;
    const am=midHp<0?-midHp:midHp,as=side<0?-side:side;
    envM=aEnv*envM+(1-aEnv)*am;envS=aEnv*envS+(1-aEnv)*as;
    // Center-dominant → more lead; cap so rhythm always keeps some body
    let g=envM/(envM+envS*1.55+1e-6);
    g=Math.min(0.82,Math.max(0.04,g));
    g=g*g*(3-2*g); // smoothstep — avoid brittle gating
    const l=midHp*g;
    leadL[i]=l;leadR[i]=l;
    L[i]-=l;R[i]-=l; // rhythm = residual in place (saves 2 full buffers)
    if((i&131071)===0){
      const p=i/n;if(p-lastP>=0.02){lastP=p;postMessage({t:'prog',p,ms:performance.now()-t0})}
      // yield so mobile/Safari don't kill the worker on long songs
      await new Promise(r=>setTimeout(r,0));
    }
  }
  postMessage({t:'prog',p:1,ms:performance.now()-t0});
  return[[L,R],[leadL,leadR]];
}

/* ---------- session ---------- */
let ort;
async function makeSess(buf,eps){
  let sess=null,ep=null;
  for(const e of eps){
    try{sess=await ort.InferenceSession.create(buf,{executionProviders:[e],graphOptimizationLevel:'all',enableMemPattern:false});ep=e;break}
    catch(x){postMessage({t:'log',m:e+' failed: '+x.message})}
  }
  if(!sess)throw Error('no backend');
  return{sess,ep};
}

onmessage=async({data:d})=>{
  try{
    const kind=d.kind==='vocals'?'vocals':d.kind==='guitar'?'guitar':'drums';
    const spec=MODELS[kind];
    const L=d.L,R=d.R,sr=d.sr||44100,n=L.length;
    if(kind==='guitar'){
      postMessage({t:'ready',ep:'dsp',threads:1,loadMs:0,src:spec.src,kind});
      postMessage({t:'sepStart',n,sec:n/sr,sr,src:spec.src,kind});
      const out=await runGuitarSep(L,R,sr);
      // One done payload (not N stem posts) — large multi-transfer drops caused “ไม่ครบสเต็ม” near the end
      const stems=out.map(([a,b],k)=>({i:k,name:spec.src[k],L:a,R:b}));
      const xfer=[];
      for(const s of stems){if(s.L&&s.L.buffer)xfer.push(s.L.buffer);if(s.R&&s.R.buffer&&s.R.buffer!==s.L.buffer)xfer.push(s.R.buffer)}
      postMessage({t:'done',src:spec.src,n,sr,kind,stems},xfer);
      return;
    }
    ort=await import(d.opt&&d.opt.ort||ORT+(d.opt&&d.opt.wasmOnly?'ort.wasm.min.mjs':'ort.webgpu.min.mjs'));
    ort.env.wasm.wasmPaths=d.opt&&d.opt.ortBase||ORT;
    ort.env.wasm.numThreads=self.crossOriginIsolated?Math.min(8,navigator.hardwareConcurrency||4):1;
    const buf=await modelBytes(d.opt&&d.opt.model||spec.url,spec.bytes,spec.sha);
    const tLoad=performance.now();
    const{sess,ep}=await makeSess(buf,d.opt&&d.opt.eps||['webgpu','wasm']);
    postMessage({t:'ready',ep,threads:ort.env.wasm.numThreads,loadMs:performance.now()-tLoad,src:spec.src,kind});
    postMessage({t:'sepStart',n,sec:n/sr,sr,src:spec.src,kind});
    const out=kind==='drums'?await runDrumsep(L,R,sess):await runKara2(L,R,sess);
    try{sess.release&&sess.release()}catch(e){}
    for(let k=0;k<out.length;k++){
      const a=out[k][0],b=out[k][1];
      postMessage({t:'stem',i:k,name:spec.src[k],L:a,R:b,n},[a.buffer,b.buffer]);
    }
    postMessage({t:'done',src:spec.src,n,sr,kind});
  }catch(e){postMessage({t:'err',m:String(e&&e.message||e)})}
};
