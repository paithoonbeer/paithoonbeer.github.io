/**
 * Data 1.0.38 (t325u) — live output on the audio thread.
 * The page mixes ahead (≈0.5 s) and posts chunks {f0,L,R} (stream frame index f0); this processor only copies them
 * out, so page work (scrolling, fine split, waveform drawing) can stall the main thread without a click or dropout.
 * {t:'cut',from} drops everything queued from stream frame `from` on (a mute/EQ/seek change is re-mixed from there,
 * ≈30 ms after the tap instead of after the whole look-ahead). Reports {t:'pos',p,ct,under} every ~1024 frames.
 * No data yet at start → wait (silence, clock not advanced); a gap while playing → silence and count it as underrun.
 */
class SsdOut extends AudioWorkletProcessor{
  constructor(){
    super();this.q=[];this.p=0;this.started=false;this.under=0;this.alive=true;this.rep=0;
    this.port.onmessage=e=>{const m=e.data;if(!m)return;
      if(m.t==='chunk')this.q.push(m);
      else if(m.t==='cut'){const F=Math.max(m.from|0,this.p);this.q=this.q.filter(c=>c.f0<F);const l=this.q[this.q.length-1];
        if(l&&l.f0+l.L.length>F){const n=F-l.f0;l.L=l.L.subarray(0,n);l.R=l.R.subarray(0,n)}}
      else if(m.t==='stop'){this.alive=false;this.q=[]}};
  }
  process(_in,outs){
    if(!this.alive)return false;
    const o=outs[0],L=o[0],R=o[1]||o[0],n=L.length;let i=0;
    if(!this.started){if(!this.q.length){L.fill(0);if(R!==L)R.fill(0);return true}this.started=true;this.p=this.q[0].f0}
    while(i<n){
      while(this.q.length&&this.q[0].f0+this.q[0].L.length<=this.p)this.q.shift();
      const c=this.q[0];
      if(!c||c.f0>this.p){const k=c?Math.min(n-i,c.f0-this.p):n-i;L.fill(0,i,i+k);if(R!==L)R.fill(0,i,i+k);i+=k;this.p+=k;this.under+=k;continue}
      const off=this.p-c.f0,k=Math.min(n-i,c.L.length-off);L.set(c.L.subarray(off,off+k),i);if(R!==L)R.set(c.R.subarray(off,off+k),i);i+=k;this.p+=k;
    }
    if((this.rep+=n)>=1024){this.rep=0;this.port.postMessage({t:'pos',p:this.p,ct:currentTime,under:this.under})}
    return true;
  }
}
registerProcessor('ssd-out',SsdOut);
