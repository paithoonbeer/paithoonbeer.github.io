// SetSod offline key/tempo renderer (module worker)
import {SoundTouch,SimpleFilter} from './soundtouch.js';
onmessage=e=>{const {id,L,R,key,tempo,sr}=e.data;try{
 const st=new SoundTouch();st.pitchSemitones=key||0;st.tempo=tempo||1;
 const src={_p:0,get position(){return this._p},set position(v){this._p=v},extract(t,n,pos=0){this._p=pos;const m=Math.max(0,Math.min(n,L.length-pos));for(let i=0;i<m;i++){t[i*2]=L[i+pos];t[i*2+1]=R[i+pos]}return m}};
 const f=new SimpleFilter(src,st);const cap=Math.ceil(L.length/(tempo||1))+sr*2;const oL=new Float32Array(cap),oR=new Float32Array(cap);
 const N=8192,buf=new Float32Array(N*2);let w=0,last=0;
 for(;;){const n=f.extract(buf,N);if(!n)break;const m=Math.min(n,cap-w);for(let i=0;i<m;i++){oL[w+i]=buf[i*2];oR[w+i]=buf[i*2+1]}w+=m;if(w>=cap)break;
  const pr=f.sourcePosition/L.length;if(pr-last>.02){last=pr;postMessage({id,pr})}}
 postMessage({id,done:true,L:oL,R:oR,n:w},[oL.buffer,oR.buffer])}catch(err){postMessage({id,err:String(err)})}};
