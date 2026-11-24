/* SetSod Data 1.0.31 — beat grid detector (BPM + downbeat phase) for the nom.
   Replaces the 1.0.x median-gap detector (it was off by 5–40% in BPM on real songs → nom drifted off the music).
   Pipeline: log-spectral flux onset envelope (22 kHz, 11.6 ms hop) → tempo autocorrelation with a
   log-normal prior around 120 BPM → Ellis dynamic-programming beat tracking → robust constant-tempo fit
   over the WHOLE song → fine period/phase search (no drift) → beats-1&3 parity from kick vs snare bands.
   Pure functions, no DOM. */
const HOP=256,NFFT=1024;
function fftR(re,im){ // in-place radix-2 complex FFT
  const n=re.length;
  for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
  for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a),h=len>>1;
    for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<h;k++){const p=i+k,q=p+h;const tr=re[q]*cr-im[q]*ci,ti=re[q]*ci+im[q]*cr;
      re[q]=re[p]-tr;im[q]=im[p]-ti;re[p]+=tr;im[p]+=ti;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr}}}
}
/** Onset envelopes: all-band, low (kick, <150 Hz) and mid (snare, 150–4000 Hz). fr = frames/s. */
export function onsetEnvelopes(x,sr){
  // to ~22 kHz mono
  let y=x,s=sr;
  while(s>=32000){const h=new Float32Array(y.length>>1);for(let i=0;i<h.length;i++)h[i]=0.5*(y[2*i]+y[2*i+1]);y=h;s/=2}
  const nF=Math.max(1,Math.floor((y.length-NFFT)/HOP)+1),half=NFFT/2;
  const win=new Float32Array(NFFT);for(let i=0;i<NFFT;i++)win[i]=0.5-0.5*Math.cos(2*Math.PI*i/NFFT);
  const kLow=Math.max(2,Math.round(150*NFFT/s)),kMid=Math.round(4000*NFFT/s),kTop=Math.min(half,Math.round(10000*NFFT/s));
  const all=new Float32Array(nF),low=new Float32Array(nF),mid=new Float32Array(nF);
  const re=new Float64Array(NFFT),im=new Float64Array(NFFT);let prev=new Float32Array(half),cur=new Float32Array(half);
  for(let f=0;f<nF;f++){
    const o=f*HOP;for(let i=0;i<NFFT;i++){re[i]=(y[o+i]||0)*win[i];im[i]=0}
    fftR(re,im);
    let a=0,l=0,m=0;
    for(let k=1;k<kTop;k++){const v=Math.log(1+100*Math.hypot(re[k],im[k]));cur[k]=v;const d=v-prev[k];if(d>0){a+=d;if(k<kLow)l+=d;else if(k<kMid)m+=d}}
    all[f]=a;low[f]=l;mid[f]=m;const t=prev;prev=cur;cur=t;
  }
  // frame f is centred at (f*HOP+NFFT/2)/s
  return{all,low,mid,fr:s/HOP,t0:(NFFT/2)/s};
}
function hpNorm(e,fr){ // remove local mean (±0.4 s), half-wave, unit std
  const n=e.length,w=Math.max(1,Math.round(0.4*fr)),o=new Float32Array(n);let acc=0;const cs=new Float64Array(n+1);
  for(let i=0;i<n;i++){acc+=e[i];cs[i+1]=acc}
  let s2=0;for(let i=0;i<n;i++){const a=Math.max(0,i-w),b=Math.min(n,i+w+1);const v=e[i]-(cs[b]-cs[a])/(b-a);o[i]=v>0?v:0;s2+=o[i]*o[i]}
  const sd=Math.sqrt(s2/Math.max(1,n))||1;for(let i=0;i<n;i++)o[i]/=sd;return o;
}
/** Tempo (BPM) from envelope autocorrelation, log-normal prior around 120 BPM (σ = 1 octave). */
export function tempoOf(o,fr,opt){
  opt=opt||{};const lo=opt.min||55,hi=opt.max||210,ctr=opt.center||120;
  const Lmin=Math.floor(60*fr/hi),Lmax=Math.ceil(60*fr/lo),n=o.length;
  const ac=new Float64Array(Lmax+2);
  for(let L=Lmin-1;L<=Lmax+1;L++){let s=0;for(let i=L;i<n;i++)s+=o[i]*o[i-L];ac[L]=s/(n-L)}
  let best=-1,bL=Lmin;const sc=new Float64Array(Lmax+2);
  for(let L=Lmin;L<=Lmax;L++){const bpm=60*fr/L,pr=Math.exp(-0.5*Math.pow(Math.log2(bpm/ctr)/1.0,2));
    // comb: also reward the half-tempo lag (bar structure)
    const v=(ac[L]+0.5*(2*L<=Lmax+1?ac[2*L]||0:0))*pr;sc[L]=v;if(v>best){best=v;bL=L}}
  // parabolic refine
  const a=sc[bL-1]||0,b=sc[bL],c=sc[bL+1]||0,den=a-2*b+c;const d=den!==0?0.5*(a-c)/den:0;
  return 60*fr/(bL+Math.max(-0.5,Math.min(0.5,d)));
}
/** Ellis DP beat tracker. Returns beat frame indices. */
export function trackBeats(o,fr,bpm,tight){
  const n=o.length,P=60*fr/bpm,al=tight||100;
  const C=new Float64Array(n),B=new Int32Array(n).fill(-1);
  const jmin=Math.round(P/2),jmax=Math.round(2*P);
  for(let i=0;i<n;i++){
    let best=-Infinity,bj=-1;
    for(let d=jmin;d<=jmax;d++){const j=i-d;if(j<0)break;const pen=Math.log(d/P);const v=C[j]-al*pen*pen;if(v>best){best=v;bj=j}}
    C[i]=o[i]+(bj>=0?Math.max(0,best):0);B[i]=bj>=0&&best>0?bj:-1;
  }
  // end: best score among the last period
  let e=n-1,bv=-Infinity;for(let i=Math.max(0,n-Math.round(P));i<n;i++)if(C[i]>bv){bv=C[i];e=i}
  const out=[];for(let i=e;i>=0;i=B[i]){out.push(i);if(B[i]<0)break}
  return out.reverse();
}
function interp(o,x){const i=Math.floor(x);if(i<0||i+1>=o.length)return 0;const f=x-i;return o[i]*(1-f)+o[i+1]*f}
/** Robust constant-tempo fit of beat times → {per,b0,resid} (s). */
function fitGrid(bt,per0){
  if(bt.length<4)return{per:per0,b0:bt[0]||0,resid:1};
  let per=per0,b0=bt[0],keep=bt.map(()=>true);
  for(let it=0;it<4;it++){
    const k=bt.map(t=>Math.round((t-b0)/per));
    let sx=0,sy=0,sxx=0,sxy=0,m=0;for(let i=0;i<bt.length;i++)if(keep[i]){sx+=k[i];sy+=bt[i];sxx+=k[i]*k[i];sxy+=k[i]*bt[i];m++}
    const dn=m*sxx-sx*sx;if(m<4||dn<=0)break;per=(m*sxy-sx*sy)/dn;b0=(sy-per*sx)/m;
    const r=bt.map((t,i)=>Math.abs(t-(b0+k[i]*per)));const srt=[...r].sort((a,b)=>a-b);const th=Math.max(0.02,3*srt[Math.floor(srt.length/2)]);
    keep=r.map(v=>v<=th);
  }
  const k=bt.map(t=>Math.round((t-b0)/per));const r=bt.map((t,i)=>Math.abs(t-(b0+k[i]*per))).sort((a,b)=>a-b);
  return{per,b0,resid:r[Math.floor(r.length*0.9)]||0};
}
/** Autocorrelation peaks (BPM) in range, strongest first. */
function tempoPeaks(o,fr,lo,hi,k){
  const Lmin=Math.floor(60*fr/hi),Lmax=Math.ceil(60*fr/lo),n=o.length,ac=new Float64Array(Lmax+2);
  for(let L=Lmin-1;L<=Lmax+1;L++){let s=0;for(let i=L;i<n;i++)s+=o[i]*o[i-L];ac[L]=s/(n-L)}
  const pk=[];for(let L=Lmin;L<=Lmax;L++)if(ac[L]>ac[L-1]&&ac[L]>=ac[L+1]){const a=ac[L-1],b=ac[L],c=ac[L+1],den=a-2*b+c,d=den?0.5*(a-c)/den:0;pk.push({bpm:60*fr/(L+d),v:b})}
  return pk.sort((x,y)=>y.v-x.v).slice(0,k).map(p=>p.bpm);
}
/** Fit one tempo hypothesis over the whole song → {per,b0,score,contrast,resid}. */
function fitTempo(o,fr,Et0,dur,bpm0,tight){
  const bf=trackBeats(o,fr,bpm0,tight);const bt=bf.map(f=>f/fr+Et0);
  let {per,b0,resid}=fitGrid(bt,60/bpm0);
  const at=(p,ph,sh)=>{let s=0,m=0;const k0=Math.ceil((0-ph)/p);for(let t=ph+k0*p+sh;t<dur;t+=p){s+=interp(o,(t-Et0)*fr);m++}return m?s/m:0};
  let bp=per,bph=b0,bs=at(per,b0,0);
  for(let pass=0;pass<2;pass++){
    const pr=pass?0.0005:0.004,ps=pass?0.002:0.02;const P0=bp,H0=bph;
    for(let dp=-pr;dp<=pr+1e-12;dp+=pr/20){const p=P0*(1+dp);
      for(let dh=-ps*10;dh<=ps*10+1e-9;dh+=ps){const s=at(p,H0+dh,0);if(s>bs){bs=s;bp=p;bph=H0+dh}}}
  }
  let mean=0;for(let i=0;i<o.length;i++)mean+=o[i];mean/=Math.max(1,o.length);
  const contrast=bs-mean;
  return{per:bp,b0:bph,score:bs,contrast,resid,bpm0};
}
/** Main entry. x = mono Float32Array, sr. Returns {bpm,t0,conf,resid,...} (seconds, song time). */
export function detectBeat(x,sr,opt){
  opt=opt||{};
  const E=onsetEnvelopes(x,sr),fr=E.fr,o=hpNorm(E.all,fr),lo=hpNorm(E.low,fr);
  const dur=x.length/sr,LO=opt.min||60,HI=opt.max||200;
  let cands;
  if(opt.bpm)cands=[opt.bpm];
  else{
    const base=tempoPeaks(o,fr,LO,HI,4),set=[];
    for(const b of base)for(const m of [1,2,0.5,1.5,2/3]){const v=b*m;if(v>=LO&&v<=HI&&!set.some(u=>Math.abs(u/v-1)<0.03))set.push(v)}
    cands=set.slice(0,14);
  }
  let best=null;const tried=[],fits=[];
  for(const c of cands){const f=fitTempo(o,fr,E.t0,dur,c,opt.tight||100);
    // mild preference for 80–160 BPM (Thai pop/ลูกทุ่ง counting range)
    const bpm=60/f.per,pr=Math.exp(-0.5*Math.pow(Math.log2(bpm/118)/1.4,2));f.rank=f.contrast*pr;fits.push(f);tried.push([Math.round(bpm*10)/10,Math.round(f.contrast*100)/100]);
    if(!best||f.rank>best.rank)best=f}
  // octave rule: prefer the faster of an octave pair when it still fits well and stays ≤165 BPM
  {const bb=60/best.per;
   const dbl=fits.find(f=>Math.abs(60/f.per/(2*bb)-1)<0.03),half=fits.find(f=>Math.abs(60/f.per/(bb/2)-1)<0.03);
   if(dbl&&2*bb<=165&&dbl.contrast>=0.6*best.contrast)best=dbl;
   else if(half&&bb>165&&half.contrast>=0.6*best.contrast)best=half;}
  // final: least-squares through the actual onset peaks near each grid beat (weighted) → exact tempo, no drift
  let per=best.per,b0=best.b0;
  for(let it=0;it<2;it++){
    let sw=0,sx=0,sy=0,sxx=0,sxy=0;const win=Math.min(0.06,per*0.15)*fr,k0=Math.ceil((0-b0)/per);
    for(let k=k0;;k++){const t=b0+k*per;if(t>dur)break;const c=(t-E.t0)*fr;let bi=-1,bv=0;
      for(let i=Math.max(1,Math.floor(c-win));i<=Math.min(o.length-2,Math.ceil(c+win));i++)if(o[i]>bv&&o[i]>=o[i-1]&&o[i]>=o[i+1]){bv=o[i];bi=i}
      if(bi<0||bv<0.5)continue;const a1=o[bi-1],a2=o[bi],a3=o[bi+1],dn=a1-2*a2+a3,d=dn?0.5*(a1-a3)/dn:0;
      const tp=(bi+d)/fr+E.t0,w=bv;sw+=w;sx+=w*k;sy+=w*tp;sxx+=w*k*k;sxy+=w*k*tp}
    const dn=sw*sxx-sx*sx;if(sw<8||dn<=0)break;const np=(sw*sxy-sx*sy)/dn;if(Math.abs(np/per-1)>0.002)break;per=np;b0=(sy-per*sx)/sw;
  }
  // beats 1&3: the kick (low band) sits on the click beats; bar start = strongest kick+onset
  const kFirst=Math.ceil((0-b0)/per),par=[0,0],bar=[0,0,0,0];
  for(let k=kFirst;;k++){const t=b0+k*per;if(t>dur)break;const f=(t-E.t0)*fr;
    const L=interp(lo,f);par[((k%2)+2)%2]+=L;bar[((k%4)+4)%4]+=L+0.3*interp(o,f)}
  const p=par[0]>=par[1]?0:1;const q=bar[p]>=bar[p+2]?p:p+2;
  const ms=musicStartSec(x,sr);
  const BIAS=0.0106; // flux-peak → attack start (calibrated on synthetic drums, 90–150 BPM)
  let t0=b0+BIAS+q*per;while(t0-2*per>=ms-per*0.5)t0-=2*per;while(t0<ms-per*0.5)t0+=2*per;
  if(t0<0)t0+=2*per;
  const bpm=60/per;
  return{bpm:Math.round(bpm*1000)/1000,t0:Math.round(t0*10000)/10000,resid:Math.round(best.resid*1000)/1000,
    conf:Math.round(best.contrast*100)/100,tried,parity:par.map(v=>Math.round(v))};
}
export function musicStartSec(x,sr){const w=Math.floor(0.05*sr),thr=Math.pow(10,-36/20);
  for(let s=0;s+w<=x.length;s+=w){let q=0;for(let i=s;i<s+w;i+=4)q+=x[i]*x[i];if(Math.sqrt(q/(w/4))>thr)return s/sr}return 0}
