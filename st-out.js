// v1.81.2: pitch/tempo playback output on the audio thread. Samples are made ahead by st-worker.js (a Worker),
// so a busy page (tab switch, big list) can no longer starve the audio.
class StOut extends AudioWorkletProcessor{
 constructor(){super();this.q=[];this.qf=0;this.off=0;this.eof=false;this.ended=false;this.req=false;this.src=0;this.n=0;this.wp=null;this.tgt=Math.round(sampleRate*0.6);this.started=false;this.under=0;
  this.port.onmessage=e=>{const d=e.data;if(d.t=='port'){this.wp=e.ports[0];this.wp.onmessage=m=>{const x=m.data;if(x.t=='chunk'){this.q.push(x);this.qf+=x.L.length;this.req=false}else if(x.t=='eof'){this.eof=true;this.req=false}}}else if(d.t=='stop'){this.ended=true}}}
 process(_i,out){if(this.ended)return false;const o=out[0],L=o[0],R=o[1]||o[0],N=L.length;let i=0;
  while(i<N&&this.q.length){const c=this.q[0],k=Math.min(N-i,c.L.length-this.off);L.set(c.L.subarray(this.off,this.off+k),i);R.set(c.R.subarray(this.off,this.off+k),i);
   this.src=c.s0+(c.s1-c.s0)*((this.off+k)/c.L.length);i+=k;this.off+=k;this.qf-=k;if(this.off>=c.L.length){this.q.shift();this.off=0}}
  if(i>0)this.started=true;if(i<N&&this.started&&!this.eof)this.under++;
  if(!this.eof&&!this.req&&this.qf<this.tgt&&this.wp){this.req=true;this.wp.postMessage({t:'need',n:this.tgt-this.qf+8192})}
  if((this.n++&31)==0)this.port.postMessage({t:'pos',s:this.src,u:this.under,q:this.qf});
  if(this.eof&&!this.q.length){this.port.postMessage({t:'end',s:this.src});this.ended=true;return false}
  return true}}
registerProcessor('st-out',StOut);
