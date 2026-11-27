/* SetSod Data 1.0.43 — clean mute / solo / volume / per-lane EQ on AI stems + deep residual denoise.
 * Source = mix + Σ (G_k(f) − 1)·S_k   (1.0.33 "mix − muted stem", now per frequency: G = gain × lane EQ)
 * then a soft mask per STFT bin cleans what the AI lanes left behind of the stems that were turned off:
 *   keep = Σ G²·|S_k|²      cut = Σ w(G)·γ·cutMul_k(f)·|S_k|²      w = ((1−G)·max(0,1−4G))²  (0 from 25 % up)
 *   M = max(floor·floorMul(f), keep/(keep+cut))
 * 1.0.37: keep/cut are smoothed over 5 frames × 5 bins (≈58 ms × 108 Hz) and the mask has a floor (−14 dB) — the
 * per-bin mask of 1.0.35 flickered ("alien"/watery sound). A muted lane's 🎚 = how much MORE to remove per band, 0…24 dB
 * (γ × 10^(dB/20), floor × 10^(−dB/40): 24 dB → γ 48, floor −26 dB — stronger means more damage to the music in that band).
 * 1.0.39 (t328u): by default the mask only cleans the residual (mix − Σ lanes) and the heard lanes are added back exactly
 * (kept instruments/คอรัส keep their level, no watery sound); with ✂ extra cut / ✂max the mask may touch the kept lanes (old way).
 * 1.0.43: CLEAN preset (FLOOR 0.08 / GAMMA 4.5 / stronger soft) + denoiseBed() spectral gate on residual hiss after unmix.
 * All gains 1 and EQ flat → output = the mix exactly. Renders progressively from any start point (playhead first)
 * so playback can switch to it hop by hop; pure JS, yields every ~8 ms (keeps the audio thread fed). */
export const UNMIX={N:2048,H:512,GAMMA:3,FLOOR:0.2,TF:5,FF:5,RESID:1,SOFT:1,SOFT_FLOOR:0.5,SOFT_EXP:0.5};
/** 1.0.43: aggressive residual cleanup for 🧹 สะอาด (still soft enough to avoid alien bed) */
export const UNMIX_CLEAN={GAMMA:4.5,FLOOR:0.08,SOFT:1,SOFT_FLOOR:0.38,SOFT_EXP:0.7};
export const UNMIX_DEFAULT={GAMMA:3,FLOOR:0.2,SOFT:1,SOFT_FLOOR:0.5,SOFT_EXP:0.5};
const EQF={lo:180,mid:1200,hi:6000};
/** 3-band lane EQ (dB) → dB at frequency f: low ≲180 Hz, mid around 1.2 kHz, high ≳6 kHz, smooth crossfades between (no phase) */
export function eqDb(eq,f){
  if(!eq)return 0;const lo=+eq.lo||0,mid=+eq.mid||0,hi=+eq.hi||0;if(!lo&&!mid&&!hi)return 0;
  const ff=Math.max(f,1),wl=1/(1+(ff/EQF.lo)**2),wh=1/(1+(EQF.hi/ff)**2),x=Math.log2(ff/EQF.mid),wm=Math.exp(-x*x/(2*1.1*1.1));
  return (lo*wl+mid*wm+hi*wh)/(wl+wm+wh); // weights normalised: all three bands equal = flat
}
export const eqFlat=eq=>!eq||(!+eq.lo&&!+eq.mid&&!+eq.hi);
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
 * @param o.mix    {L,R} Float32Array (the original song)
 * @param o.stems  [{L,R,g,scale,eq:{lo,mid,hi},cut:{lo,mid,hi}}]  g = heard gain, eq = tone (audible lane), cut = extra removal dB (muted lane)
 * @param o.sr     sample rate (EQ frequencies)
 * @param o.startSec render from here first (then the beginning) — playback uses it hop by hop
 * @param o.target optional {L,R,ready} to fill (created if missing) — readable while rendering: ready[h]=1 → samples h·H … h·H+H−1 final
 * @returns the target (or null if cancelled)
 */
export async function renderHeard(o){
  const RESID=o.resid!=null?!!o.resid:!!UNMIX.RESID,SOFT=o.soft!=null?!!o.soft:!!UNMIX.SOFT,SOFT_FLOOR=o.softFloor!=null?+o.softFloor:UNMIX.SOFT_FLOOR,SOFT_EXP=o.softExp!=null?+o.softExp:UNMIX.SOFT_EXP,N=o.N||UNMIX.N,H=o.H||UNMIX.H,GAMMA=o.gamma!=null?o.gamma:UNMIX.GAMMA,FLOOR=o.floor!=null?o.floor:UNMIX.FLOOR;
  const TF=Math.max(1,o.tf||UNMIX.TF)|0,FF=Math.max(1,o.ff||UNMIX.FF)|0,TR=TF>>1,FR=FF>>1,sr=o.sr||44100;
  const mL=o.mix.L,mR=o.mix.R||o.mix.L,n=mL.length,st=o.stems.filter(s=>s&&s.L),K=st.length,B=N/2+1;
  const pl=fftPlan(N),win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
  const frames=Math.ceil((n+N/2)/H)+1,hops=Math.ceil(n/H),R=N/(2*H);
  const T=o.target||{L:new Float32Array(n),R:new Float32Array(n),ready:new Uint8Array(hops),H,n};
  const outL=T.L,outR=T.R,ready=T.ready;
  // per-sample Σw² (OLA normalisation) and per-hop frame coverage
  const wsum=new Float32Array(n);
  for(let f=0;f<frames;f++){const s0=f*H-N/2;for(let i=0;i<N;i++){const j=s0+i;if(j>=0&&j<n)wsum[j]+=win[i]*win[i]}}
  const need=new Uint8Array(hops),cnt=new Uint8Array(hops);
  for(let h=0;h<hops;h++){let c=0;for(let f=h+1-R;f<=h+R;f++)if(f>=0&&f<frames)c++;need[h]=c}
  // per-stem per-bin gains (EQ) and removal weights
  const G=[],C=[],FM=new Float32Array(B).fill(Infinity);let anyCut=false,anyExtra=false,anyHeard=false;
  for(let k=0;k<K;k++){
    const s=st[k],g=Math.max(0,+s.g||0),gk=new Float32Array(B),ck=new Float32Array(B);
    for(let q=0;q<B;q++){
      const f=q*sr/N,Gq=g*Math.pow(10,(g>0?eqDb(s.eq,f):0)/20);gk[q]=Gq;
      const w=(Math.max(0,1-Gq)*Math.max(0,1-Gq/0.25))**2;
      if(w>0){const cd=Math.max(0,Math.min(24,eqDb(s.cut,f)));if(cd>0.01)anyExtra=true;ck[q]=w*GAMMA*Math.pow(10,cd/20);FM[q]=Math.min(FM[q],Math.pow(10,-cd/40));anyCut=true}
    }
    if(g>0)anyHeard=true;G.push(gk);C.push(ck);
  }
  for(let q=0;q<B;q++)if(!isFinite(FM[q]))FM[q]=1;
  // 1.0.40: every lane muted → nothing should be heard: no floor on the residual (it left the separation error at ≈ −30 dB)
  if(!anyHeard)FM.fill(0);
  // ring of TF frames: stem spectra (packed L+iR) + keep/cut powers per channel
  const RS=TF,slotF=new Int32Array(RS).fill(-1);
  const sRe=[],sIm=[],kL=[],kR=[],cL=[],cR=[];
  for(let r=0;r<RS;r++){sRe.push(st.map(()=>new Float32Array(N)));sIm.push(st.map(()=>new Float32Array(N)));kL.push(new Float32Array(B));kR.push(new Float32Array(B));cL.push(new Float32Array(B));cR.push(new Float32Array(B))}
  function analyse(f){
    const r=f%RS;if(slotF[r]===f)return;slotF[r]=f;
    const start=f*H-N/2,KL=kL[r],KR=kR[r],CL=cL[r],CR=cR[r];KL.fill(0);KR.fill(0);CL.fill(0);CR.fill(0);
    for(let k=0;k<K;k++){
      const s=st[k],L=s.L,Rr=s.R||s.L,sc=(s.scale!=null?+s.scale:1),a=sRe[r][k],b=sIm[r][k],gk=G[k],ck=C[k];
      for(let i=0;i<N;i++){const j=start+i;if(j>=0&&j<L.length){a[i]=L[j]*win[i]*sc;b[i]=Rr[j]*win[i]*sc}else{a[i]=0;b[i]=0}}
      fft(pl,a,b,false);
      for(let q=0;q<B;q++){
        const q2=(N-q)%N,lr=0.5*(a[q]+a[q2]),li=0.5*(b[q]-b[q2]),rr=0.5*(b[q]+b[q2]),ri=-0.5*(a[q]-a[q2]);
        const pL=lr*lr+li*li,pR=rr*rr+ri*ri,g2=gk[q]*gk[q];
        KL[q]+=g2*pL;KR[q]+=g2*pR;if(ck[q]>0){CL[q]+=ck[q]*pL;CR[q]+=ck[q]*pR}
      }
    }
  }
  const re=new Float32Array(N),im=new Float32Array(N),tKL=new Float32Array(B),tKR=new Float32Array(B),tCL=new Float32Array(B),tCR=new Float32Array(B);
  const gainL=new Float32Array(B),gainR=new Float32Array(B),softL=new Float32Array(B),softR=new Float32Array(B),kRe=new Float32Array(N),kIm=new Float32Array(N);
  const boxF=(src,dst)=>{let acc=0;for(let q=0;q<Math.min(FR,B);q++)acc+=src[q];for(let q=0;q<B;q++){const add=q+FR,sub=q-FR-1;if(add<B)acc+=src[add];if(sub>=0)acc-=src[sub];const lo=Math.max(0,q-FR),hi=Math.min(B-1,q+FR);dst[q]=acc/(hi-lo+1)}};
  const sm1=new Float32Array(B);
  /** packed L+iR spectrum → per-channel mask gains (gainL/gainR) → packed again */
  function unpackGain(re,im,gL,gR){gL=gL||gainL;gR=gR||gainR;
    for(let q=0;q<B;q++){
      const q2=(N-q)%N;
      const lr=0.5*(re[q]+re[q2])*gL[q],li=0.5*(im[q]-im[q2])*gL[q];
      const rr=0.5*(im[q]+im[q2])*gR[q],ri=-0.5*(re[q]-re[q2])*gR[q];
      const zr=lr-ri,zi=li+rr,zr2=lr+ri,zi2=-li+rr;
      if(q===0||q===N/2){re[q]=zr;im[q]=zi}else{re[q]=zr;im[q]=zi;re[q2]=zr2;im[q2]=zi2}
    }
  }
  function doFrame(f){
    for(let d=-TR;d<=TR;d++){const x=f+d;if(x>=0&&x<frames)analyse(x)}
    tKL.fill(0);tKR.fill(0);tCL.fill(0);tCR.fill(0);let nT=0;
    for(let d=-TR;d<=TR;d++){const x=f+d;if(x<0||x>=frames)continue;const r=x%RS;nT++;
      const a=kL[r],b=kR[r],c=cL[r],e=cR[r];for(let q=0;q<B;q++){tKL[q]+=a[q];tKR[q]+=b[q];tCL[q]+=c[q];tCR[q]+=e[q]}}
    if(anyCut){
      boxF(tKL,sm1);tKL.set(sm1);boxF(tKR,sm1);tKR.set(sm1);boxF(tCL,sm1);tCL.set(sm1);boxF(tCR,sm1);tCR.set(sm1);
      for(let q=0;q<B;q++){
        const fl=Math.min(1,FLOOR*FM[q]);
        gainL[q]=tCL[q]>0?Math.max(fl,tKL[q]/(tKL[q]+tCL[q]+1e-30)):1;
        gainR[q]=tCR[q]>0?Math.max(fl,tKR[q]/(tKR[q]+tCR[q]+1e-30)):1;
      }
    }else{gainL.fill(1);gainR.fill(1)}
    // source = mix + Σ (G_k(f) − 1)·S_k, then the masks
    const start=f*H-N/2,r=f%RS;
    for(let i=0;i<N;i++){const j=start+i;if(j>=0&&j<n){re[i]=mL[j]*win[i];im[i]=mR[j]*win[i]}else{re[i]=0;im[i]=0}}
    fft(pl,re,im,false);
    if(RESID&&anyCut&&!anyExtra){ // ✂ extra cut / ✂max = opt-in: the mask may then reach into the kept lanes too (old way)
      // 1.0.39 (t328u): the masks only clean what NO lane holds (residual = mix − Σ lanes); the lanes that are heard are added
      // back untouched at G·S. The 1.0.35–1.0.38 mask also hit the kept lanes wherever a muted lane was loud (kick under the
      // bass, lead under the chorus) → kept instruments −3…−6 dB and watery/phasey.
      for(let k=0;k<K;k++){const a=sRe[r][k],b=sIm[r][k];for(let i=0;i<N;i++){re[i]-=a[i];im[i]-=b[i]}}
      unpackGain(re,im);
      for(let k=0;k<K;k++){const gk=G[k],a=sRe[r][k],b=sIm[r][k];
        for(let q=0;q<=N/2;q++){const g=gk[q];if(g===0)continue;re[q]+=g*a[q];im[q]+=g*b[q];if(q>0&&q<N/2){const q2=N-q;re[q2]+=g*a[q2];im[q2]+=g*b[q2]}}}
    }else if(RESID&&SOFT&&anyCut){
      // 1.0.40 (t333u): ✂ extra cut / ✂max no longer runs the deep mask over the whole bed ("alien" sound). The residual
      // (what no lane holds) gets the deep mask; the heard lanes only a SOFT one: gain^SOFT_EXP, never below SOFT_FLOOR
      // (−6 dB), so the drum bleed inside them is turned down without the bubbling/watery musical noise.
      for(let q=0;q<B;q++){softL[q]=Math.max(SOFT_FLOOR,Math.pow(gainL[q],SOFT_EXP));softR[q]=Math.max(SOFT_FLOOR,Math.pow(gainR[q],SOFT_EXP))}
      kRe.fill(0);kIm.fill(0);
      for(let k=0;k<K;k++){const gk=G[k],a=sRe[r][k],b=sIm[r][k];for(let i=0;i<N;i++){re[i]-=a[i];im[i]-=b[i]}
        for(let q=0;q<=N/2;q++){const g=gk[q];if(g===0)continue;kRe[q]+=g*a[q];kIm[q]+=g*b[q];if(q>0&&q<N/2){const q2=N-q;kRe[q2]+=g*a[q2];kIm[q2]+=g*b[q2]}}}
      unpackGain(re,im);unpackGain(kRe,kIm,softL,softR);
      for(let i=0;i<N;i++){re[i]+=kRe[i];im[i]+=kIm[i]}
    }else{
    for(let k=0;k<K;k++){
      const gk=G[k],a=sRe[r][k],b=sIm[r][k];let flat=true;for(let q=0;q<B;q++)if(Math.abs(gk[q]-1)>1e-6){flat=false;break}
      if(flat)continue;
      for(let q=0;q<B;q++){const d=gk[q]-1;if(d===0)continue;re[q]+=d*a[q];im[q]+=d*b[q];if(q>0&&q<N/2){const q2=N-q;re[q2]+=d*a[q2];im[q2]+=d*b[q2]}}
    }
    unpackGain(re,im);
    }
    fft(pl,re,im,true);
    for(let i=0;i<N;i++){const j=start+i;if(j<0||j>=n)continue;const w=win[i];outL[j]+=re[i]/N*w;outR[j]+=im[i]/N*w}
    for(let h=f-R;h<=f+R-1;h++){if(h<0||h>=hops)continue;if(++cnt[h]===need[h]){const a=h*H,b=Math.min(n,a+H);for(let j=a;j<b;j++){const w=wsum[j]>1e-6?wsum[j]:1;outL[j]/=w;outR[j]/=w}ready[h]=1}}
  }
  const f0=Math.max(0,Math.min(frames-1,Math.floor((+o.startSec||0)*sr/H)));
  let t0=performance.now(),done=0;
  for(const [a,b] of [[f0,frames],[0,f0]]){
    for(let f=a;f<b;f++){
      doFrame(f);done++;
      if(o.onProgress&&(done&63)===0)o.onProgress(done/frames);
      if(performance.now()-t0>8){await new Promise(r=>setTimeout(r,0));t0=performance.now();if(o.cancelled&&o.cancelled())return null}
    }
  }
  T.done=true;return T;
}

/**
 * 1.0.43: post-unmix spectral gate — estimate per-bin noise from the quietest frames, then Wiener-attenuate.
 * Aimed at residual hiss / soft AI bleed after mute, not at rewriting the musical bed.
 * @param {Float32Array} L
 * @param {Float32Array} [R]
 * @param {number} sr
 * @param {{strength?:number,floor?:number,hfBoost?:number,N?:number,H?:number,cancelled?:()=>boolean,onProgress?:(p:number)=>void}} [opt]
 */
export async function denoiseBed(L,R,sr,opt){
  opt=opt||{};const N=opt.N||2048,H=opt.H||512,B=N/2+1,n=L.length,Rr=R||L;
  const strength=Math.max(0,Math.min(1,opt.strength!=null?+opt.strength:0.75));
  const floor=Math.max(0.015,Math.min(0.5,opt.floor!=null?+opt.floor:0.12)); // never mute bins totally
  const hfBoost=opt.hfBoost!=null?+opt.hfBoost:1.6; // clean highs a bit more (hiss lives there)
  if(!(strength>0.01)||n<N*4)return {L,R:Rr};
  const pl=fftPlan(N),win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
  const frames=Math.max(1,Math.floor((n-N)/H)+1);
  const pL=new Float32Array(frames*B),pR=new Float32Array(frames*B);
  const re=new Float32Array(N),im=new Float32Array(N);
  // pass 1: power spectrogram + frame energy
  const eF=new Float32Array(frames);
  for(let f=0;f<frames;f++){
    const s0=f*H;
    for(let i=0;i<N;i++){const j=s0+i;re[i]=(j<n?L[j]:0)*win[i];im[i]=(j<n?Rr[j]:0)*win[i]}
    fft(pl,re,im,false);
    let e=0;const o=f*B;
    for(let q=0;q<B;q++){
      const q2=(N-q)%N;
      const lr=0.5*(re[q]+re[q2]),li=0.5*(im[q]-im[q2]),rr=0.5*(im[q]+im[q2]),ri=-0.5*(re[q]-re[q2]);
      const a=lr*lr+li*li,b=rr*rr+ri*ri;pL[o+q]=a;pR[o+q]=b;e+=a+b;
    }
    eF[f]=e;
    if(opt.onProgress&&(f&63)===0)opt.onProgress(0.35*f/frames);
    if((f&31)===0){await new Promise(r=>setTimeout(r,0));if(opt.cancelled&&opt.cancelled())return null}
  }
  // noise = ~18th percentile frame power per bin (quiet parts) + per-bin spectral minimum (tracks steady hiss)
  const order=Array.from({length:frames},(_,i)=>i).sort((a,b)=>eF[a]-eF[b]);
  const nTake=Math.max(4,Math.floor(frames*0.18));
  const nL=new Float32Array(B),nR=new Float32Array(B),minL=new Float32Array(B).fill(Infinity),minR=new Float32Array(B).fill(Infinity);
  for(let f=0;f<frames;f++){const o=f*B;for(let q=0;q<B;q++){if(pL[o+q]<minL[q])minL[q]=pL[o+q];if(pR[o+q]<minR[q])minR[q]=pR[o+q]}}
  for(let q=0;q<B;q++){let a=0,b=0;for(let i=0;i<nTake;i++){const o=order[i]*B+q;a+=pL[o];b+=pR[o]}nL[q]=Math.max(a/nTake,minL[q]*1.4);nR[q]=Math.max(b/nTake,minR[q]*1.4)}
  // detect lossy brick-wall (energy cliff) — hard-gate bins above it (hiss / empty ultrasonics).
  // 1.0.44: only look ≥12 kHz and compare to a local shelf (~2 kHz below), not the loud 2–8 kHz midband —
  // otherwise pop beds (BLVCKHEART etc.) falsely brick at ~8 kHz and kill musical highs.
  const avg=new Float32Array(B);for(let q=0;q<B;q++){let s=0;for(let f=0;f<frames;f++)s+=pL[f*B+q]+pR[f*B+q];avg[q]=s/frames}
  let brick=B; // bin index of first "empty" zone
  {const lo=Math.max(2,Math.floor(12000*N/sr)),hi=Math.min(B-2,Math.floor(19000*N/sr)),back=Math.max(1,Math.floor(2000*N/sr));
    let peak=0;for(let q=0;q<B;q++)if(avg[q]>peak)peak=avg[q];peak+=1e-30;
    for(let q=lo;q<hi;q++){const shelf=avg[Math.max(0,q-back)]+1e-30;
      if(avg[q]<shelf*0.03&&avg[q+1]<shelf*0.03&&avg[q]<peak*2e-4){brick=q;break}}}
  // pass 2: Wiener gains + OLA rewrite
  const outL=new Float32Array(n),outR=new Float32Array(n),wsum=new Float32Array(n);
  for(let f=0;f<frames;f++){
    const s0=f*H,o=f*B;
    for(let i=0;i<N;i++){const j=s0+i;re[i]=(j<n?L[j]:0)*win[i];im[i]=(j<n?Rr[j]:0)*win[i]}
    fft(pl,re,im,false);
    for(let q=0;q<B;q++){
      const freq=q*sr/N,boost=freq>=6000?hfBoost:freq>=3000?1+0.4*(hfBoost-1):1;
      const a=pL[o+q],b=pR[o+q];
      let gL=a/(a+boost*strength*nL[q]+1e-30),gR=b/(b+boost*strength*nR[q]+1e-30);
      gL=Math.max(floor,Math.min(1,gL));gR=Math.max(floor,Math.min(1,gR));
      // above brick-wall: kill residual hash (lossy empty zone — keep tiny OLA floor)
      if(q>=brick){gL=Math.min(gL,0.03);gR=Math.min(gR,0.03)}
      const q2=(N-q)%N;
      const lr=0.5*(re[q]+re[q2])*gL,li=0.5*(im[q]-im[q2])*gL;
      const rr=0.5*(im[q]+im[q2])*gR,ri=-0.5*(re[q]-re[q2])*gR;
      const zr=lr-ri,zi=li+rr,zr2=lr+ri,zi2=-li+rr;
      if(q===0||q===N/2){re[q]=zr;im[q]=zi}else{re[q]=zr;im[q]=zi;re[q2]=zr2;im[q2]=zi2}
    }
    fft(pl,re,im,true);
    for(let i=0;i<N;i++){const j=s0+i;if(j<0||j>=n)continue;const w=win[i];outL[j]+=re[i]/N*w;outR[j]+=im[i]/N*w;wsum[j]+=w*w}
    if(opt.onProgress&&(f&63)===0)opt.onProgress(0.35+0.65*f/frames);
    if((f&31)===0){await new Promise(r=>setTimeout(r,0));if(opt.cancelled&&opt.cancelled())return null}
  }
  for(let i=0;i<n;i++){const w=wsum[i]>1e-6?wsum[i]:1;outL[i]/=w;outR[i]/=w}
  return {L:outL,R:outR};
}
