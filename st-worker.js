// v1.81.2: SoundTouch (pitch/tempo) runs here, off the page's main thread.
import {SoundTouch,SimpleFilter} from './soundtouch.js';
let st=null,f=null,len=0,segs=[],cov=0,asked=0,out=null,pend=0,eof=false;
const SEG_AHEAD=15*44100;
const srcObj={extract(t,n,p){let got=0;while(got<n){const q=p+got;const s=segs.find(s=>q>=s.a&&q<s.a+s.L.length);if(!s)break;const o=q-s.a,k=Math.min(n-got,s.L.length-o);for(let i=0;i<k;i++){t[(got+i)*2]=s.L[o+i];t[(got+i)*2+1]=s.R[o+i]}got+=k}return got}};
function more(){if(cov<len&&asked<=cov&&cov-(f?f.sourcePosition:0)<SEG_AHEAD){asked=cov+1;postMessage({t:'more',from:cov})}}
function ready(){return f&&(cov>=len||cov-f.sourcePosition>16384*2)}
function produce(){if(!out||!pend||eof||!ready())return;const B=4096,tmp=new Float32Array(B*2);
 while(pend>0&&ready()){const s0=f.sourcePosition,n=f.extract(tmp,B);if(n===0){if(cov>=len){eof=true;out.postMessage({t:'eof'})}break}
  const L=new Float32Array(n),R=new Float32Array(n);for(let i=0;i<n;i++){L[i]=tmp[i*2];R[i]=tmp[i*2+1]}
  out.postMessage({t:'chunk',L,R,s0,s1:f.sourcePosition},[L.buffer,R.buffer]);pend-=n}
 segs=segs.filter(s=>s.a+s.L.length>f.sourcePosition-44100);more()}
onmessage=e=>{const d=e.data;
 if(d.t=='port'){out=e.ports[0];out.onmessage=m=>{if(m.data.t=='need'){pend=Math.max(pend,m.data.n);produce()}}}
 else if(d.t=='init'){len=d.len;st=new SoundTouch();st.tempo=d.tempo;st.pitchSemitones=d.pitch;f=new SimpleFilter(srcObj,st,()=>{});f.sourcePosition=d.pos;cov=d.pos;segs=[];more()}
 else if(d.t=='seg'){segs.push({a:d.a,L:d.L,R:d.R});cov=Math.max(cov,d.a+d.L.length);produce();more()}
 else if(d.t=='set'){if(st){if('tempo' in d)st.tempo=d.tempo;if('pitch' in d)st.pitchSemitones=d.pitch}}};
