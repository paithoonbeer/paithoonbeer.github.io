// v1.65 MP3 encoder worker (lamejs, LGPL). in: {ch:[Float32Array..], sr, kbps} out: {p} progress, {mp3:Uint8Array} or {err}
importScripts('lame.min.js');
onmessage=e=>{try{const {ch,sr,kbps}=e.data;const enc=new lamejs.Mp3Encoder(ch.length,sr,kbps);
 const n=ch[0].length,B=1152*20,out=[];let tot=0;const i16=c=>{const a=new Int16Array(c.length);for(let i=0;i<c.length;i++){const v=Math.max(-1,Math.min(1,c[i]));a[i]=v<0?v*32768:v*32767}return a};
 for(let i=0;i<n;i+=B){const l=i16(ch[0].subarray(i,i+B));const r=ch.length>1?i16(ch[1].subarray(i,i+B)):null;const b=r?enc.encodeBuffer(l,r):enc.encodeBuffer(l);if(b.length){out.push(new Uint8Array(b));tot+=b.length}
  if((i/B)%40==0)postMessage({p:i/n})}
 const f=enc.flush();if(f.length){out.push(new Uint8Array(f));tot+=f.length}
 const m=new Uint8Array(tot);let o=0;for(const b of out){m.set(b,o);o+=b.length}postMessage({mp3:m},[m.buffer])}catch(x){postMessage({err:String(x&&x.message||x)})}};
