/* SetSod Data 1.0.35 — clean mute / solo / volume on AI stems (t317u).
 * 1.0.33 played "mix + Σ (gain−1)·stem" (mix − muted stem). That leaves whatever the AI drum lane missed, so drum
 * hits stayed clearly audible. Here that same signal is cleaned per STFT bin with a soft mask built from the stems:
 *   keep = Σ g²·|S_k|²   (what should be heard)      cut = Σ w(g)·|S_k|²   (stems muted / turned nearly off;
 *   w = ((1−g)·max(0,1−4g))² → 1 at mute, 0 from 25 % up, so a fader keeps its exact level)
 *   M = keep^P / (keep^P + (GAMMA·cut)^P)
 * so a bin where the muted drums are present is pushed down further, bins of the remaining music are untouched.
 * All gains 1 → output = the mix exactly. Pure JS, no deps; runs in slices so the page never freezes. */
export const UNMIX={N:2048,H:512,P:1,GAMMA:3};
function fftPlan(N){
  const lev=Math.log2(N)|0,rev=new Uint32Array(N),cos=new Float32Array(N/2),sin=new Float32Array(N/2);
  for(let i=0;i<N;i++){let r=0,x=i;for(let b=0;b<lev;b++){r=(r<<1)|(x&1);x>>=1}rev[i]=r}
  for(let i=0;i<N/2;i++){cos[i]=Math.cos(2*Math.PI*i/N);sin[i]=-Math.sin(2*Math.PI*i/N)}
  return{N,rev,cos,sin};
}
/** in-place complex FFT (inv → conjugate twiddles, no 1/N) */
function fft(pl,re,im,inv){
  const {N,rev,cos,sin}=pl;
  for(let i=0;i<N;i++){const j=rev[i];if(j>i){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t}}
  for(let size=2;size<=N;size<<=1){
    const half=size>>1,step=N/size;
    for(let s=0;s<N;s+=size){
      for(let k=0,t=0;k<half;k++,t+=step){
        const wr=cos[t],wi=inv?-sin[t]:sin[t],a=s+k,b=a+half;
        const xr=re[b]*wr-im[b]*wi,xi=re[b]*wi+im[b]*wr;
        re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi;
      }
    }
  }
}
/**
 * @param o.mix   {L,R} Float32Array (the original song)
 * @param o.stems [{L,R,g,scale}] g = heard gain (0 = muted, vol/100 …), scale = stem's share of the mix (usually 1)
 * @returns {L,R} Float32Array, same length as the mix
 */
export async function renderHeard(o){
  const N=o.N||UNMIX.N,H=o.H||UNMIX.H,P=o.P||UNMIX.P,GAMMA=o.gamma||UNMIX.GAMMA;
  const mL=o.mix.L,mR=o.mix.R||o.mix.L,n=mL.length,st=o.stems.filter(s=>s&&s.L);
  const pl=fftPlan(N),win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
  const outL=new Float32Array(n),outR=new Float32Array(n),wsum=new Float32Array(n+N);
  const K=st.length,gs=st.map(s=>Math.max(0,+s.g||0)),g2=gs.map(g=>g*g),c2=gs.map(g=>(Math.max(0,1-g)*Math.max(0,1-g/0.25))**2); // only stems turned (nearly) off get cleaned; a fader at ≥25 % keeps its exact level
  const mgain=(kp,cp)=>{if(cp<=0)return 1;const c=GAMMA*cp;if(P===1)return kp/(kp+c+1e-30);const a=Math.pow(kp,P);return a/(a+Math.pow(c,P)+1e-30)};
  const re=new Float32Array(N),im=new Float32Array(N);
  const sRe=st.map(()=>new Float32Array(N)),sIm=st.map(()=>new Float32Array(N));
  const gainL=new Float32Array(N/2+1),gainR=new Float32Array(N/2+1);
  const frames=Math.ceil((n+N/2)/H)+1;let t0=performance.now();
  for(let f=0;f<frames;f++){
    const start=f*H-N/2;
    // stems: pack L + iR in one complex FFT
    for(let k=0;k<K;k++){
      const s=st[k],L=s.L,R=s.R||s.L,sc=(s.scale!=null?+s.scale:1),a=sRe[k],b=sIm[k];
      for(let i=0;i<N;i++){const j=start+i;if(j>=0&&j<L.length){a[i]=L[j]*win[i]*sc;b[i]=R[j]*win[i]*sc}else{a[i]=0;b[i]=0}}
      fft(pl,a,b,false);
    }
    // per-bin gains for each channel
    for(let q=0;q<=N/2;q++){
      const q2=(N-q)%N;let kL=0,cL=0,kR=0,cR=0;
      for(let k=0;k<K;k++){
        const a=sRe[k],b=sIm[k];
        const lr=0.5*(a[q]+a[q2]),li=0.5*(b[q]-b[q2]); // left  = (Z[q] + conj Z[N−q]) / 2
        const rr=0.5*(b[q]+b[q2]),ri=-0.5*(a[q]-a[q2]); // right = (Z[q] − conj Z[N−q]) / 2i
        const pL=lr*lr+li*li,pR=rr*rr+ri*ri;
        kL+=g2[k]*pL;kR+=g2[k]*pR;cL+=c2[k]*pL;cR+=c2[k]*pR;
      }
      gainL[q]=mgain(kL,cL);gainR[q]=mgain(kR,cR);
    }
    // source = mix + Σ (g−1)·stem (linear, in the packed spectrum), then the per-channel masks
    for(let i=0;i<N;i++){const j=start+i;if(j>=0&&j<n){re[i]=mL[j]*win[i];im[i]=mR[j]*win[i]}else{re[i]=0;im[i]=0}}
    fft(pl,re,im,false);
    for(let k=0;k<K;k++){const d=gs[k]-1;if(Math.abs(d)<1e-6)continue;const a=sRe[k],b=sIm[k];for(let i=0;i<N;i++){re[i]+=d*a[i];im[i]+=d*b[i]}}
    for(let q=0;q<=N/2;q++){
      const q2=(N-q)%N;
      const lr=0.5*(re[q]+re[q2])*gainL[q],li=0.5*(im[q]-im[q2])*gainL[q];
      const rr=0.5*(im[q]+im[q2])*gainR[q],ri=-0.5*(re[q]-re[q2])*gainR[q];
      // rebuild Z = Lspec + i·Rspec at q and N−q (both are Hermitian)
      const zr=lr-ri,zi=li+rr,zr2=lr+ri,zi2=-li+rr;
      if(q===0||q===N/2){re[q]=zr;im[q]=zi}else{re[q]=zr;im[q]=zi;re[q2]=zr2;im[q2]=zi2}
    }
    fft(pl,re,im,true);
    for(let i=0;i<N;i++){const j=start+i;if(j<0||j>=n)continue;const w=win[i];outL[j]+=re[i]/N*w;outR[j]+=im[i]/N*w;wsum[j]+=w*w}
    if(o.onProgress&&(f&63)===0)o.onProgress(f/frames);
    if(performance.now()-t0>12){await new Promise(r=>setTimeout(r,0));t0=performance.now();if(o.cancelled&&o.cancelled())return null}
  }
  for(let j=0;j<n;j++){const w=wsum[j]>1e-6?wsum[j]:1;outL[j]/=w;outR[j]/=w}
  return{L:outL,R:outR};
}
