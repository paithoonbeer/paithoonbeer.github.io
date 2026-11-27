/** SetSod Data 1.0.30 — นอมแบบไฟล์ตัวอย่าง (pure DSP helpers, no DOM).
 * Measured from the user's reference (ref.wav, 48 kHz dual-mono):
 *  L = music ≈ −10.5 LUFS · R = nom: a ~240 ms beep (≈450 Hz + ≈1.2 kHz) every 2 beats,
 *  no accent, spoken "one . two . one two three four" over the 8 clicks before each section,
 *  click stops before the outro, no pre-roll count-in (counts sit over the intro).
 */
export const REF_PRESET={style:'ref',rate:2,accent:false,ciMode:'over',ci:1,cues:true,endAuto:true,
  sr:48000,loud:true,lufs:-11,tpDb:-1,clickPeakDb:-0.5,guide:{on:false,stems:['guitar','vocals'],db:-28}};
// counting unit = click → 8 clicks before a marker
export const CUE_PATTERN=['one',null,'two',null,'one','two','three','four'];
/** 1.0.47: stretch a cue pattern for slow (½) counting — insert a null after every slot so words span 2× clicks. */
export function stretchCue(pat,pace){if(+pace!==2)return pat;const out=[];for(const w of pat){out.push(w);out.push(null)}return out}
/** Slots (clicks) a count of n words occupies at the given pace. */
export function countSlots(n,pace){return (+n===4?4:8)*(+pace===2?2:1)}

/** ref beep: fast attack (2 ms), two partials with a slight downward glide, hard cut at ~240 ms (3 ms fade). */
export function beepAt(L,R,at,sr,amp,accent){
  const n=L.length,len=Math.floor(0.24*sr),atk=Math.max(1,Math.floor(0.002*sr)),cut=Math.max(1,Math.floor(0.003*sr));
  const k=accent?1.5:1;let p1=0,p2=0;
  for(let i=0;i<len&&at+i<n;i++){
    if(at+i<0)continue;
    const t=i/sr,u=i/len;
    const f1=(450-40*u)*k,f2=(1250-100*u)*k;
    p1+=2*Math.PI*f1/sr;p2+=2*Math.PI*f2/sr;
    let env=Math.exp(-2.2*t); // gentle decay, still loud at the cut (like ref)
    if(i<atk)env*=i/atk;
    if(i>len-cut)env*=(len-i)/cut;
    const v=(0.55*Math.sin(p1)+0.6*Math.sin(p2))*env*amp;
    L[at+i]+=v;R[at+i]+=v;
  }
}
/** Click grid in seconds (song timeline, before any lead-in offset). */
export function clickGrid(t0,bpm,rate,endT){
  const step=60/Math.max(40,Math.min(240,+bpm||120))*(rate===2?2:1),out=[];
  for(let k=0;;k++){const t=(+t0||0)+k*step;if(t>endT+0.03)break;out.push(t)}
  return out;
}
/** Index of the click a marker lands on (nearest grid point). */
export function markerClickIdx(t,t0,bpm,rate){const step=60/bpm*(rate===2?2:1);return Math.round((t-t0)/step)}
/** Which clicks carry a spoken word: Map clickIdx → word. markers: [{t,kind}] song-time. */
export const COUNT4=['one','two','three','four'];
/** Which clicks carry a spoken word: Map clickIdx → word.
    markers (song time): {kind:'count',t,n:8|4} = count STARTS on the click at t (1.0.31 count tool);
    legacy {kind:'section',t} = 8-click count ENDING right before t (1.0.30 pins); 'end' ignored. */
export function cueWords(grid,markers,t0,bpm,rate,opt){
  opt=opt||{};const words=new Map();
  const defPace=+opt.pace===2?2:1;
  const put=(startIdx,pat)=>{for(let j=0;j<pat.length;j++){const w=pat[j];const i=startIdx+j;if(w&&i>=0&&i<grid.length)words.set(i,w)}};
  // count over the intro first: ci cycles from the first click (1.0.47: pace stretches each cycle)
  if(opt.ciMode==='over'){const pat=stretchCue(CUE_PATTERN,defPace),span=pat.length;for(let c=0;c<(opt.ci|0);c++)put(span*c,pat)}
  if(opt.cues!==false)for(const m of markers||[]){
    if(!m||!isFinite(m.t))continue;
    const k=markerClickIdx(m.t,t0,bpm,rate);
    const pace=+m.pace===2?2:(+m.pace===1?1:defPace);
    if(m.kind==='count')put(k,stretchCue((+m.n===4)?COUNT4:CUE_PATTERN,pace));
    else if(m.kind==='section')put(k-countSlots(8,pace),stretchCue(CUE_PATTERN,pace));
  }
  return words;
}
/* ---------- loudness (ITU-R BS.1770 K-weighting, gated) ---------- */
function biq(x,b0,b1,b2,a1,a2){const y=new Float32Array(x.length);let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<x.length;i++){const v=x[i];const o=b0*v+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=v;y2=y1;y1=o;y[i]=o}return y}
export function kWeight(x,sr){
  let K=Math.tan(Math.PI*1681.974450955533/sr);const Q=0.7071752369554196,Vh=Math.pow(10,3.999843853973347/20),Vb=Math.pow(Vh,0.4996667741545416);
  let a0=1+K/Q+K*K;
  const s1=biq(x,(Vh+Vb*K/Q+K*K)/a0,2*(K*K-Vh)/a0,(Vh-Vb*K/Q+K*K)/a0,2*(K*K-1)/a0,(1-K/Q+K*K)/a0);
  K=Math.tan(Math.PI*38.13547087602444/sr);const Q2=0.5003270373238773;a0=1+K/Q2+K*K;
  return biq(s1,1,-2,1,2*(K*K-1)/a0,(1-K/Q2+K*K)/a0);
}
/** Integrated loudness (LUFS) of one channel. */
export function lufs(x,sr){
  const y=kWeight(x,sr),blk=Math.floor(0.4*sr),hop=Math.floor(0.1*sr),z=[];
  for(let s=0;s+blk<=y.length;s+=hop){let q=0;for(let i=s;i<s+blk;i++)q+=y[i]*y[i];z.push(q/blk)}
  if(!z.length)return -70;
  const L=v=>-0.691+10*Math.log10(v+1e-20);
  let g=z.filter(v=>L(v)>-70);if(!g.length)return -70;
  const rel=L(g.reduce((a,b)=>a+b,0)/g.length)-10;g=g.filter(v=>L(v)>rel);
  return g.length?L(g.reduce((a,b)=>a+b,0)/g.length):-70;
}
/** Look-ahead peak limiter (offline). Includes cubic mid-sample estimates → true-peak safe-ish. Returns {y,grDb}. */
export function limit(x,sr,ceilDb){
  const n=x.length,ceil=Math.pow(10,ceilDb/20),look=Math.max(1,Math.floor(0.005*sr)),rel=Math.exp(-1/(0.08*sr));
  const need=new Float32Array(n);
  for(let i=0;i<n;i++){
    let a=Math.abs(x[i]);
    if(i>0&&i<n-2){const p0=x[i-1],p1=x[i],p2=x[i+1],p3=x[i+2];const m=(-p0+9*p1+9*p2-p3)/16;const am=Math.abs(m);if(am>a)a=am}
    need[i]=a>ceil?ceil/a:1;
  }
  // forward min over look-ahead window (sliding)
  const g=new Float32Array(n);const dq=[];let h=0;
  for(let i=n-1;i>=0;i--){ // window [i, i+look]
    while(dq.length>h&&need[dq[dq.length-1]]>=need[i])dq.pop();dq.push(i);
    while(dq[h]>i+look)h++;
    g[i]=need[dq[h]];
  }
  // backward attack ramp (linear over look) then forward release
  for(let i=n-2;i>=0;i--){const lim=g[i+1]+(1-g[i+1])/look;if(g[i]>lim)g[i]=lim}
  let cur=1,minG=1;const y=new Float32Array(n);
  for(let i=0;i<n;i++){cur=Math.min(g[i],1-(1-cur)*rel);if(cur>g[i])cur=g[i];if(cur<minG)minG=cur;y[i]=x[i]*cur}
  return{y,grDb:20*Math.log10(minG)};
}
/** True-peak estimate (4× windowed-sinc, 16 taps) — only evaluated around loud samples. */
export function truePeak(x,thr){
  thr=thr==null?0.5*peakAbs(x):thr;let tp=0;const H=8,ph=[0.25,0.5,0.75],taps=ph.map(f=>{const w=[];for(let k=-H+1;k<=H;k++){const d=k-f;const sinc=Math.abs(d)<1e-9?1:Math.sin(Math.PI*d)/(Math.PI*d);w.push(sinc*(0.5+0.5*Math.cos(Math.PI*d/H)))}return w});
  for(let i=H;i<x.length-H;i++){const a=x[i]<0?-x[i]:x[i];if(a>tp)tp=a;if(a<thr)continue;
    for(const w of taps){let v=0;for(let k=-H+1,j=0;k<=H;k++,j++)v+=x[i+k]*w[j];v=v<0?-v:v;if(v>tp)tp=v}}
  return tp;
}
/** Static trim so the true peak sits at/below ceilDb. */
export function tpTrim(y,ceilDb){const c=Math.pow(10,ceilDb/20),tp=truePeak(y);if(tp>c){const g=c/tp;for(let i=0;i<y.length;i++)y[i]*=g}return y}
export function rmsDb(x){let q=0;for(let i=0;i<x.length;i++)q+=x[i]*x[i];return 10*Math.log10(q/Math.max(1,x.length)+1e-20)}
export function peakAbs(x){let p=0;for(let i=0;i<x.length;i++){const a=x[i]<0?-x[i]:x[i];if(a>p)p=a}return p}
/** Music side: gain toward target LUFS, then limit to tpDb.
 * 1.0.40 (t331u "เสียงแตกๆ"): the old version pushed gain until the LIMITED output reached the target (up to +12 dB
 * extra) → 9–18 dB of peak limiting on every song (even clean multitracks) = crackle/distortion on every transient.
 * Now the gain is capped so the loudest 0.01 % of samples need at most GR_BUDGET dB of limiting; the file may end up
 * a bit quieter than the target on dynamic songs, but it stays clean (measured: crackle frames 26–93 % → <0.5 %). */
export const GR_BUDGET=3;
export function masterMusic(x,sr,target,tpDb,opt){
  const budget=opt&&opt.grBudget!=null?+opt.grBudget:GR_BUDGET;
  let g=Math.pow(10,(target-lufs(x,sr))/20);if(!isFinite(g))g=1;
  const n=x.length,step=Math.max(1,Math.floor(n/400000)),a=new Float32Array(Math.ceil(n/step));
  for(let i=0,j=0;i<n;i+=step,j++){const v=x[i];a[j]=v<0?-v:v}
  a.sort();const p=a[Math.min(a.length-1,Math.floor(a.length*0.9999))];
  if(p>1e-6){const cap=Math.pow(10,(tpDb+budget)/20)/p;if(g>cap)g=cap}
  const r=limit(x.map(v=>v*g),sr,tpDb);tpTrim(r.y,tpDb);
  return{y:r.y,grDb:r.grDb,lufs:lufs(r.y,sr),gainDb:20*Math.log10(g)};
}
/** Nom side: click/voice to peakDb, optional guide bed at guideDb RMS, final limit at peakDb. */
export function masterNom(nom,sr,peakDb,guide,guideDb){
  const pk=peakAbs(nom),g=pk>1e-9?Math.pow(10,peakDb/20)/pk:1;
  const y=nom.map(v=>v*g);
  if(guide&&guide.length){
    const gr=Math.pow(10,(guideDb-rmsDb(guide))/20);
    for(let i=0;i<y.length&&i<guide.length;i++)y[i]+=guide[i]*(isFinite(gr)?gr:0);
  }
  return tpTrim(limit(y,sr,peakDb).y,peakDb);
}
/** 16-bit PCM WAV, no normalize (already mastered), TPDF dither, hard clamp as last resort. */
export function wav16(chans,sr){
  const ch=chans.length,n=chans[0].length,bytes=n*ch*2,b=new DataView(new ArrayBuffer(44+bytes));
  const w=(o,s)=>{for(let i=0;i<s.length;i++)b.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');b.setUint32(4,36+bytes,true);w(8,'WAVEfmt ');b.setUint32(16,16,true);b.setUint16(20,1,true);b.setUint16(22,ch,true);
  b.setUint32(24,sr,true);b.setUint32(28,sr*ch*2,true);b.setUint16(32,ch*2,true);b.setUint16(34,16,true);w(36,'data');b.setUint32(40,bytes,true);
  let o=44;
  for(let i=0;i<n;i++)for(let c=0;c<ch;c++){let s=Math.round(chans[c][i]*32767+Math.random()+Math.random()-1);if(s>32767)s=32767;else if(s<-32768)s=-32768;b.setInt16(o,s,true);o+=2}
  return b.buffer;
}
/** Auto end: last click-bar boundary (4 clicks) before the music falls below −40 dBFS for good. */
export function autoEnd(music,sr,t0,bpm,rate){
  const win=Math.floor(0.4*sr),thr=Math.pow(10,-40/20);let last=0;
  for(let s=0;s+win<=music.length;s+=win){let q=0;for(let i=s;i<s+win;i+=4)q+=music[i]*music[i];if(Math.sqrt(q/(win/4))>thr)last=(s+win)/sr}
  const bar=60/bpm*(rate===2?2:1)*4;
  return Math.max(t0+bar,t0+Math.floor((last-t0)/bar)*bar);
}
