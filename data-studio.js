/* SetSod Data Studio — arrangement, MIDI piano roll, record, FX, project save */
const NOTES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const COLS=['#e8a54b','#5b8def','#6fbf73','#d67bb8','#45c4d4','#c97b5a','#9b8af0','#d4c35a'];
const uid=()=>'c'+Math.random().toString(36).slice(2,9);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=t=>{t=Math.max(0,t);const m=Math.floor(t/60),s=t%60;return m+':'+s.toFixed(1).padStart(4,'0')};
const midiHz=n=>440*Math.pow(2,(n-69)/12);

export function createStudio(ui){
  const $=id=>ui.root.querySelector('#'+id)||document.getElementById(id);
  const state={
    title:'Untitled',bpm:120,sr:44100,
    tracks:[],buffers:new Map(), // id -> AudioBuffer
    sel:{track:0,clip:null,notes:[]},
    tool:'select', // select | split | draw
    pxPerSec:80,scrollX:0,
    playing:false,recording:false,t0:0,offset:0,loop:false,loopA:0,loopB:8,
    metro:false,snap:true,
    ac:null,nodes:[],fx:[],rec:{stream:null,proc:null,chunks:[],start:0},
    undo:[],redo:[],dirty:false
  };

  function ac(){if(!state.ac)state.ac=new (window.AudioContext||window.webkitAudioContext)();return state.ac}
  function dur(){
    let d=4;
    for(const t of state.tracks){
      for(const c of t.clips)d=Math.max(d,c.start+c.dur);
      for(const n of t.notes)d=Math.max(d,(n.t||0)+(n.d||0));
    }
    return d;
  }
  function beatSec(){return 60/state.bpm}
  function snapT(t){if(!state.snap)return t;const g=beatSec()/4;return Math.round(t/g)*g}
  function mark(){state.undo.push(snapshot());if(state.undo.length>40)state.undo.shift();state.redo.length=0;state.dirty=true}
  function snapshot(){return JSON.stringify({title:state.title,bpm:state.bpm,tracks:state.tracks.map(t=>({...t,clips:t.clips.map(c=>({...c})),notes:t.notes.map(n=>({...n}))}))})}
  function restore(j){const o=JSON.parse(j);state.title=o.title;state.bpm=o.bpm;state.tracks=o.tracks;renderAll()}
  function undo(){if(!state.undo.length)return;state.redo.push(snapshot());restore(state.undo.pop())}
  function redo(){if(!state.redo.length)return;state.undo.push(snapshot());restore(state.redo.pop())}

  function addAudioTrack(name,color){
    const t={id:uid(),type:'audio',name:name||('แทร็ก '+(state.tracks.length+1)),color:color||COLS[state.tracks.length%COLS.length],
      mute:false,solo:false,vol:100,pan:0,eq:{lo:0,mid:0,hi:0},rev:0,waveZoom:1,clips:[],notes:[]};
    state.tracks.push(t);return t;
  }
  function addMidiTrack(name){
    const t={id:uid(),type:'midi',name:name||('MIDI '+(state.tracks.length+1)),color:COLS[state.tracks.length%COLS.length],
      mute:false,solo:false,vol:100,pan:0,eq:{lo:0,mid:0,hi:0},rev:0.15,waveZoom:1,clips:[],notes:[]};
    state.tracks.push(t);return t;
  }
  function setTrackWaveZoom(i,delta){
    const tr=state.tracks[i];if(!tr)return;
    tr.waveZoom=clamp(+(tr.waveZoom||1)*(delta>0?1.35:1/1.35),0.5,8);
    renderArrange();renderTracks();
  }
  function setNomVol(v){
    v=clamp(+v||0,0,200);
    state.nomVol=v;
    const ck=state.tracks.find(t=>t.stem==='click');
    if(ck){ck.vol=v;applyLiveMix();renderMixer()}
    try{localStorage.setItem('ssd-nomvol',String(v))}catch(e){}
  }

  async function decodeFile(file){
    const ab=await file.arrayBuffer();
    return await ac().decodeAudioData(ab.slice(0));
  }
  function putBuf(buf){const id=uid();state.buffers.set(id,buf);return id}
  // denser min/max peaks for smoother waveforms (pairs: min,max per bin)
  // Auto-normalize quiet stems so bass/guitar graphs stay visible when separation is weak
  function peaksOf(buf,bins){
    const L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L;
    const n=L.length;
    const nb=Math.max(800,Math.min(bins||Math.ceil(buf.duration*400),12000));
    const step=Math.max(1,Math.floor(n/nb)),out=new Float32Array(Math.ceil(n/step)*2);
    let peak=0;
    for(let i=0,o=0;i<n;i+=step,o+=2){
      let mn=1,mx=-1;const e=Math.min(n,i+step);
      for(let j=i;j<e;j+=2){const v=(L[j]+(R[j]||L[j]))*0.5;if(v<mn)mn=v;if(v>mx)mx=v}
      if(mn>mx){mn=0;mx=0}out[o]=mn;out[o+1]=mx;
      const a=mx>-mn?-mx:mn;const aa=a<0?-a:a;if(aa>peak)peak=aa;
    }
    // Boost display of quiet stems (keep true silence flat)
    if(peak>1e-4&&peak<0.22){
      const g=Math.min(0.85/peak,12);
      for(let i=0;i<out.length;i++)out[i]=clamp(out[i]*g,-1,1);
    }
    return out;
  }

  function importAudioToTrack(trackIdx,file,atTime){
    return decodeFile(file).then(buf=>{
      mark();
      const id=putBuf(buf);
      const tr=state.tracks[trackIdx]||addAudioTrack(file.name.replace(/\.[^.]+$/,''));
      const t=state.tracks.find(x=>x.id===tr.id)||tr;
      t.clips.push({id:uid(),buf:id,start:snapT(atTime||0),offset:0,dur:buf.duration,gain:1,peaks:peaksOf(buf),name:file.name});
      state.dirty=true;renderAll();return t;
    }).catch(e=>{
      ui.toast?.('นำเข้าเสียงไม่ได้: '+(e.message||e.name||'ไฟล์ไม่รองรับ'));
      throw e;
    });
  }

  function bufFromLR(L,R,sampleRate){
    const a=ac(),n=L.length,b=a.createBuffer(2,n,sampleRate||44100);
    b.copyToChannel(L,0);b.copyToChannel((R&&R.length===n)?R:L,1);return b;
  }
  function mixLR(a,b){
    const n=a.L.length,L=new Float32Array(n),R=new Float32Array(n);
    for(let i=0;i<n;i++){L[i]=clamp((a.L[i]||0)+(b.L[i]||0),-1,1);R[i]=clamp((a.R[i]||0)+(b.R[i]||0),-1,1)}
    return {L,R};
  }
  // Fixed band layout: กลอง · เบส · กีตาร์ · คีย์ · อื่นๆ · ร้อง  (+ นอม/นับเข้า ทีหลัง)
  // AI (htdemucs 6s ONNX) → drums/bass/other/vocals/guitar/piano  (index 4 = guitar)
  function rmsLR(ch){if(!ch||!ch.L)return 0;let s=0,n=ch.L.length,step=Math.max(1,(n/12000)|0);for(let i=0;i<n;i+=step){const v=(ch.L[i]+(ch.R&&ch.R[i]||0))*0.5;s+=v*v}return s}
  // If demucs left bass nearly empty, rebuild a usable bass lane from low end of the mix
  function fillQuietBass(by,mix){
    try{
      if(!by.bass||!by.bass.L)return;
      const br=rmsLR(by.bass);let mx=br;
      for(const k of ['drums','guitar','other','vocals','piano'])mx=Math.max(mx,rmsLR(by[k]));
      if(br>mx*0.06)return; // bass already has content
      const src=mix&&mix.L?mix:(by.guitar&&rmsLR(by.guitar)>rmsLR(by.other)?by.guitar:by.other);
      if(!src||!src.L)return;
      const n=src.L.length,L=new Float32Array(n),R=new Float32Array(n);
      // one-pole lowpass ~180 Hz @ 44.1k (coef≈0.025)
      let aL=0,aR=0,c=0.025;
      for(let i=0;i<n;i++){
        const xL=src.L[i],xR=(src.R&&src.R[i])||xL;
        aL+=c*(xL-aL);aR+=c*(xR-aR);
        L[i]=aL*1.6;R[i]=aR*1.6;
      }
      by.bass={L,R};
    }catch(e){}
  }
  function loadStemChannels({title,src,channels,sampleRate,mix}){
    mark();state.title=title||state.title;state.tracks=[];
    const by={};src.forEach((s,i)=>{by[s]=channels[i]});
    fillQuietBass(by,mix);
    const sr=sampleRate||44100;
    const layout=[
      {key:'drums',name:'กลอง',ch:by.drums,color:COLS[0]},
      {key:'bass',name:'เบส',ch:by.bass,color:COLS[1]},
      {key:'guitar',name:'กีตาร์',ch:by.guitar,color:COLS[5]},
      {key:'keys',name:'คีย์บอร์ด',ch:by.piano,color:COLS[7]},
      {key:'other',name:'ดนตรีอื่นๆ',ch:by.other,color:COLS[2]},
      {key:'vocals',name:'ร้อง',ch:by.vocals,color:COLS[3]}
    ];
    layout.forEach(row=>{
      const t=addAudioTrack(row.name,row.color);t.stem=row.key;
      if(row.ch&&row.ch.L){
        const b=bufFromLR(row.ch.L,row.ch.R,sr);const id=putBuf(b);
        t.clips.push({id:uid(),buf:id,start:0,offset:0,dur:b.duration,gain:1,peaks:peaksOf(b),name:row.key});
      }
    });
    renderAll();
  }

  /* ---------- FX graph helpers ---------- */
  function makeTrackChain(tr){
    const a=ac();
    const g=a.createGain();g.gain.value=tr.vol/100;
    const p=a.createStereoPanner();p.pan.value=tr.pan||0;
    // EQ defaults flat (0 dB) — never boost unless user moves the fader
    const lo=a.createBiquadFilter();lo.type='lowshelf';lo.frequency.value=180;lo.gain.value=tr.eq.lo||0;
    const mid=a.createBiquadFilter();mid.type='peaking';mid.frequency.value=1200;mid.Q.value=0.8;mid.gain.value=tr.eq.mid||0;
    const hi=a.createBiquadFilter();hi.type='highshelf';hi.frequency.value=6000;hi.gain.value=tr.eq.hi||0;
    const dry=a.createGain();
    const wet=a.createGain();
    const revAmt=Math.max(0,Math.min(1,tr.rev||0));
    dry.gain.value=1-revAmt*0.7;wet.gain.value=revAmt*0.7;
    const nodes=[g,p,lo,mid,hi,dry,wet];
    g.connect(lo);lo.connect(mid);mid.connect(hi);hi.connect(p);p.connect(dry);
    let conv=null;
    // Only build convolver when reverb is actually on (saves CPU on long songs)
    if(revAmt>0.001){
      conv=a.createConvolver();
      if(!state._imp){const len=a.sampleRate*1.2,imp=a.createBuffer(2,len,a.sampleRate);for(let c=0;c<2;c++){const d=imp.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.8)}state._imp=imp}
      conv.buffer=state._imp;p.connect(wet);wet.connect(conv);nodes.push(conv);
    }
    return {input:g,dry,conv,lo,mid,hi,wet,nodes};
  }

  function stopPlay(){
    cancelAnimationFrame(state._raf);
    if(state.playing)state.offset=clamp(ac().currentTime-state.t0+state.offset,0,dur());
    for(const n of state.nodes){try{n.stop?.()}catch(e){}try{n.disconnect?.()}catch(e){}}
    for(const x of state.fx){try{x.nodes.forEach(n=>n.disconnect())}catch(e){}}
    state.nodes=[];state.fx=[];state.live=null;state.playing=false;state.playOnly=null;state._midi=null;state._metroJob=null;
    ui.onTransport?.(state);
  }
  // Live mute/solo/vol — schedule every track, silence via gain (so M mid-play actually cuts)
  function applyLiveMix(){
    if(!state.playing||!state.live)return;
    const a=ac(),t=a.currentTime;
    const anySolo=state.tracks.some(x=>x.solo);
    for(const tr of state.tracks){
      const L=state.live.get(tr.id);if(!L)continue;
      const silent=tr.mute||(anySolo&&!tr.solo);
      try{L.muteG.gain.setTargetAtTime(silent?0:1,t,0.02)}catch(e){}
      try{L.volG.gain.setTargetAtTime((tr.vol||0)/100,t,0.02)}catch(e){}
    }
  }

  // One BufferSource per clip, start ≈ now (or after short count-in).
  // Do NOT pre-schedule many future chunk starts — browsers drop those around ~60–80s
  // while the playhead (driven by currentTime) keeps moving → silent graph.
  function clipAbsDur(clip,buf){
    if(!buf)return Math.max(0.001,clip.dur||0);
    const d=Math.max(clip.dur||0, buf.duration-(clip.offset||0));
    if((clip.dur||0)<buf.duration-0.05)clip.dur=buf.duration-(clip.offset||0);
    return Math.max(0.001,d);
  }
  function scheduleAudioClip(tr,clip,chain,when,playFrom){
    const a=ac();
    const buf=state.buffers.get(clip.buf);if(!buf)return;
    const clipDur=clipAbsDur(clip,buf);
    if(clip.start+clipDur<=playFrom+1e-4)return;
    const localOff=Math.max(0,playFrom-clip.start);
    const remain=clipDur-localOff;
    if(!(remain>0.001))return;
    const maxOff=Math.max(0,buf.duration-1e-4);
    const bufOff=clamp((clip.offset||0)+localOff,0,maxOff);
    const playLen=Math.min(remain,buf.duration-bufOff);
    if(!(playLen>0.001))return;
    const delay=Math.max(0,clip.start-playFrom); // count-in only (seconds, not minutes)
    const tWhen=when+delay;
    const src=a.createBufferSource();src.buffer=buf;
    const g=a.createGain();g.gain.value=clip.gain||1;
    src.connect(g);g.connect(chain.input);
    try{src.start(tWhen,bufOff,playLen);state.nodes.push(src)}
    catch(e){console.warn('clip schedule',e)}
  }

  // MIDI notes also drop if started minutes ahead — look-ahead refill on tick
  const MIDI_LOOK=10;
  function scheduleMidi(tr,chain,when,playFrom){
    if(!state._midi)state._midi=[];
    const notes=[...tr.notes].sort((a,b)=>a.t-b.t);
    state._midi.push({tr,chain,when,playFrom,notes,i:0});
    pumpMidi();
  }
  function pumpMidi(){
    if(!state.playing||!state._midi||!state._midi.length)return;
    const a=ac();
    const playT=a.currentTime-state.t0+state.offset;
    const until=playT+MIDI_LOOK;
    for(const job of state._midi){
      const {chain,when,playFrom,notes}=job;
      while(job.i<notes.length){
        const n=notes[job.i];
        const end=n.t+(n.d||0);
        if(end<=playFrom){job.i++;continue}
        if(n.t>=until)break;
        const delay=Math.max(0,n.t-playFrom);
        const durN=end-Math.max(n.t,playFrom);
        const t0=when+delay;
        if(t0+durN<a.currentTime-0.05){job.i++;continue}
        const osc=a.createOscillator();osc.type='sawtooth';osc.frequency.value=midiHz(n.n);
        const g=a.createGain();
        const at=Math.max(t0,a.currentTime+0.005);
        g.gain.setValueAtTime(0,at);
        g.gain.linearRampToValueAtTime(0.18*(n.v||1),at+0.01);
        g.gain.exponentialRampToValueAtTime(0.001,at+Math.max(0.05,durN));
        const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=2200;
        osc.connect(f);f.connect(g);g.connect(chain.input);
        try{osc.start(at);osc.stop(at+durN+0.05);state.nodes.push(osc)}catch(e){}
        job.i++;
      }
    }
  }

  function startPlay(from,opt){
    stopPlay();
    const a=ac();if(a.state==='suspended')a.resume();
    state.offset=from!=null?from:state.offset;
    state.playOnly=null; // multi-track play uses mute/solo only (same as mixer)
    if(opt&&opt.onlyTrackId){
      // legacy single-track: map to solo so graph ▶ matches mixer S behaviour
      state.tracks.forEach(t=>{t.solo=(t.id===opt.onlyTrackId)});
    }
    state.live=new Map();
    state._midi=[];
    const master=a.createGain();master.gain.value=1;
    const merge=a.createGain();
    const revGain=a.createGain();revGain.gain.value=1;
    const conv=a.createConvolver();
    if(!state._imp){const len=a.sampleRate*1.2,imp=a.createBuffer(2,len,a.sampleRate);for(let c=0;c<2;c++){const d=imp.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.8)}state._imp=imp}
    conv.buffer=state._imp;
    revGain.connect(conv);conv.connect(master);
    merge.connect(master);master.connect(a.destination);

    const anySolo=state.tracks.some(t=>t.solo);
    const when=a.currentTime+0.02;
    // Playhead clock starts at the same instant audio is scheduled (fixes graph≠sound drift)
    state.t0=when;state.playing=true;
    // One BufferSource per audio clip (full remainder from playhead) — no far-future chunks
    state.tracks.forEach(tr=>{
      const chain=makeTrackChain(tr);
      const muteG=a.createGain();
      const silent=tr.mute||(anySolo&&!tr.solo);
      muteG.gain.value=silent?0:1;
      chain.dry.connect(muteG);muteG.connect(merge);
      if(chain.conv)chain.conv.connect(revGain);
      state.fx.push(chain);
      state.live.set(tr.id,{muteG,volG:chain.input,lo:chain.lo,mid:chain.mid,hi:chain.hi});
      if(tr.type==='audio')tr.clips.forEach(c=>scheduleAudioClip(tr,c,chain,when,state.offset));
      else scheduleMidi(tr,chain,when,state.offset);
    });
    // Metro: unmute existing นอม track only — never stack a second click source
    if(state.metro){
      const ck=state.tracks.find(t=>t.stem==='click');
      if(ck){
        ck.mute=false;
        if(state.nomVol!=null)ck.vol=state.nomVol;
        const live=state.live.get(ck.id);if(live){live.muteG.gain.value=(anySolo&&!ck.solo)?0:1;live.volG.gain.value=(ck.vol||100)/100}
      }
      else scheduleMetro(when,state.offset);
    }
    ui.onTransport?.(state);tick();
  }
  const LANE_H=120;
  // Graph-tab ▶ = toggle Solo (same as mixer S). Multi-solo then main ▶ plays all solos together.
  function playTrack(i){
    const tr=state.tracks[i];if(!tr)return;
    mark();state.sel.track=i;
    tr.solo=!tr.solo;
    state.playOnly=null;
    if(state.playing&&state.live){applyLiveMix();renderTracks();renderMixer();return}
    if(state.offset>=dur()-0.05)state.offset=0;
    startPlay(state.offset);
    renderTracks();renderMixer();
  }

  function scheduleMetro(when,playFrom){
    // Fallback click if no click track — look-ahead style (64 beats was cutting long songs)
    if(!state._metroJob)state._metroJob={when,playFrom,nextBeat:Math.ceil(playFrom/beatSec()-1e-6)};
    pumpMetro();
  }
  function pumpMetro(){
    if(!state.playing||!state._metroJob)return;
    const a=ac();const bs=beatSec();
    const {when,playFrom}=state._metroJob;
    const playT=a.currentTime-state.t0+state.offset;
    const until=playT+8;
    const vol=(state.nomVol!=null?state.nomVol:140)/100*0.22;
    while(true){
      const b=state._metroJob.nextBeat;
      const t=b*bs;
      if(t>=until)break;
      if(t<playFrom){state._metroJob.nextBeat++;continue}
      const at=when+(t-playFrom);
      if(at+0.1<a.currentTime-0.05){state._metroJob.nextBeat++;continue}
      const osc=a.createOscillator();const g=a.createGain();
      osc.frequency.value=(b%4===0)?1200:800;
      const startAt=Math.max(at,a.currentTime+0.005);
      g.gain.setValueAtTime(0,startAt);g.gain.linearRampToValueAtTime(vol,startAt+0.005);g.gain.exponentialRampToValueAtTime(0.001,startAt+0.08);
      osc.connect(g);g.connect(a.destination);osc.start(startAt);osc.stop(startAt+0.1);state.nodes.push(osc);
      state._metroJob.nextBeat++;
    }
  }

  function tick(){
    if(!state.playing)return;
    let t=ac().currentTime-state.t0+state.offset;
    if(state.loop&&t>=state.loopB){startPlay(state.loopA);return}
    if(t>=dur()+0.05){stopPlay();state.offset=0;ui.onTransport?.(state);renderArrange();return}
    try{pumpMidi();pumpMetro()}catch(e){}
    ui.onTransport?.(state);renderPlayhead(t);
    state._raf=requestAnimationFrame(tick);
  }

  /* ---------- recording ---------- */
  async function toggleRecord(){
    if(state.recording){await stopRecord();return}
    mark();
    let tr=state.tracks[state.sel.track];
    if(!tr||tr.type!=='audio'){tr=addAudioTrack('อัดเสียง');state.sel.track=state.tracks.length-1;renderTracks()}
    let stream;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false}});
    }catch(e){
      ui.toast?.('ไมโครโฟนไม่พร้อม: '+(e.message||e.name||e));
      ui.onTransport?.(state);
      return;
    }
    const a=ac();if(a.state==='suspended')await a.resume();
    const src=a.createMediaStreamSource(stream);
    const rec=a.createScriptProcessor(4096,1,1);
    const chunks=[];const silent=a.createGain();silent.gain.value=0;
    rec.onaudioprocess=e=>{if(!state.recording)return;chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))};
    src.connect(rec);rec.connect(silent);silent.connect(a.destination);
    state.recording=true;state.rec={stream,proc:rec,src,chunks,start:state.offset,tr:tr.id};
    if(!state.playing)startPlay(state.offset);
    ui.onTransport?.(state);
  }
  async function stopRecord(){
    if(!state.recording)return;
    state.recording=false;
    const {stream,proc,src,chunks,start,tr}=state.rec||{};
    try{proc?.disconnect();src?.disconnect();stream?.getTracks?.().forEach(t=>t.stop())}catch(e){}
    if(!chunks?.length){state.rec={};ui.onTransport?.(state);return}
    const len=chunks.reduce((a,c)=>a+c.length,0);
    const buf=ac().createBuffer(1,len,ac().sampleRate);
    const d=buf.getChannelData(0);let o=0;for(const c of chunks){d.set(c,o);o+=c.length}
    const id=putBuf(buf);
    const track=state.tracks.find(t=>t.id===tr)||addAudioTrack('อัดเสียง');
    track.clips.push({id:uid(),buf:id,start:snapT(start||0),offset:0,dur:buf.duration,gain:1,peaks:peaksOf(buf),name:'อัด'});
    state.rec={};ui.onTransport?.(state);renderAll();
  }

  /* ---------- clip ops ---------- */
  function splitAt(time){
    const tr=state.tracks[state.sel.track];if(!tr||tr.type!=='audio')return;
    const clip=tr.clips.find(c=>time>c.start+0.01&&time<c.start+c.dur-0.01);if(!clip)return;
    mark();
    const local=time-clip.start;
    const right={id:uid(),buf:clip.buf,start:time,offset:clip.offset+local,dur:clip.dur-local,gain:clip.gain,peaks:clip.peaks,name:clip.name};
    clip.dur=local;
    tr.clips.push(right);renderAll();
  }
  function deleteSelected(){
    const tr=state.tracks[state.sel.track];if(!tr)return;
    mark();
    if(tr.type==='midi'&&state.sel.notes.length){const set=new Set(state.sel.notes);tr.notes=tr.notes.filter(n=>!set.has(n.id));state.sel.notes=[];}
    else if(state.sel.clip){tr.clips=tr.clips.filter(c=>c.id!==state.sel.clip);state.sel.clip=null}
    renderAll();
  }

  /* ---------- render UI ---------- */
  function renderAll(){renderTracks();renderArrange();renderMixer();renderPiano();ui.onProject?.(state)}

  function renderTracks(){
    const box=$('trackHeads');if(!box)return;box.innerHTML='';
    state.tracks.forEach((tr,i)=>{
      const el=document.createElement('div');el.className='thead'+(state.sel.track===i?' on':'');el.dataset.i=i;
      const wz=+(tr.waveZoom||1);
      el.innerHTML=`<div class="tn"><i style="background:${tr.color}"></i><input value="${escAttr(tr.name)}" data-rn="${i}"><b>${tr.type==='midi'?'MIDI':'AUD'}</b></div>
        <div class="tops">
          <button type="button" class="tb ${tr.mute?'on':''}" data-m="${i}" title="ปิดเสียง">M</button>
          <button type="button" class="tb ${tr.solo?'on':''}" data-s="${i}" title="โซโล่">S</button>
          <span class="wz" title="ซูมกราฟแทร็กนี้">
            <button type="button" class="tb" data-wz="${i}" data-d="-1" aria-label="ซูมออก">−</button>
            <b>${wz>=1?wz.toFixed(1):wz.toFixed(2)}×</b>
            <button type="button" class="tb" data-wz="${i}" data-d="1" aria-label="ซูมเข้า">+</button>
          </span>
        </div>`;
      box.appendChild(el);
    });
  }
  function escAttr(s){return String(s??'').replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]))}

  function renderArrange(){
    const lanes=$('lanes'),ruler=$('ruler');if(!lanes)return;
    const W=Math.max(1200,Math.ceil((dur()+4)*state.pxPerSec));
    lanes.style.width=W+'px';
    // ruler
    if(ruler){
      const dpr=devicePixelRatio||1;ruler.style.width=W+'px';ruler.width=Math.round(W*dpr);ruler.height=Math.round(28*dpr);
      const g=ruler.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
      g.fillStyle='#0a0c0f';g.fillRect(0,0,W,28);
      g.font='11px JetMono,monospace';g.fillStyle='#7a8490';
      const bs=beatSec();
      for(let b=0;b*bs<=dur()+4;b++){
        const x=b*bs*state.pxPerSec;const bar=b%4===0;
        g.fillStyle=bar?'#9aa3ad':'#3a4450';g.fillRect(x,bar?10:16,1,bar?18:12);
        if(bar){g.fillStyle='#8a949e';g.fillText(String(1+b/4|0),x+4,12)}
      }
      // loop region
      if(state.loop){g.fillStyle='rgba(61,186,138,.12)';g.fillRect(state.loopA*state.pxPerSec,0,(state.loopB-state.loopA)*state.pxPerSec,28)}
    }
    const phKeep=$('playhead');
    lanes.innerHTML='';
    // Playhead lives inside .lanes so it scrolls with tracks and spans full height
    const ph=phKeep||document.createElement('div');ph.id='playhead';ph.className='playhead';
    lanes.appendChild(ph);
    state.tracks.forEach((tr,ti)=>{
      const lane=document.createElement('div');lane.className='lane'+(state.sel.track===ti?' on':'');lane.dataset.ti=ti;
      if(tr.type==='audio'){
        tr.clips.forEach(c=>{
          const x=c.start*state.pxPerSec,w=Math.max(4,c.dur*state.pxPerSec);
          const clip=document.createElement('div');clip.className='clip'+(state.sel.clip===c.id?' sel':'');
          clip.style.left=x+'px';clip.style.width=w+'px';clip.style.background=tr.color+'33';clip.style.borderColor=tr.color;
          clip.dataset.cid=c.id;clip.dataset.ti=ti;
          const cv=document.createElement('canvas');cv.className='cw';clip.appendChild(cv);
          const lab=document.createElement('span');lab.className='clab';lab.textContent=c.name||tr.name;clip.appendChild(lab);
          const hL=document.createElement('i');hL.className='hndl L';clip.appendChild(hL);
          const hR=document.createElement('i');hR.className='hndl R';clip.appendChild(hR);
          lane.appendChild(clip);
          requestAnimationFrame(()=>drawClipWave(cv,c,tr.color,tr.waveZoom));
        });
      }else{
        // MIDI blocks overview
        tr.notes.forEach(n=>{
          const x=n.t*state.pxPerSec,w=Math.max(3,n.d*state.pxPerSec);
          const y=((84-n.n)/48)*100+10;
          const note=document.createElement('div');note.className='mblock';note.style.cssText=`left:${x}px;width:${w}px;top:${y}px;background:${tr.color}`;
          lane.appendChild(note);
        });
      }
      lanes.appendChild(lane);
    });
    const totalH=Math.max(LANE_H,state.tracks.length*LANE_H);
    ph.style.height=totalH+'px';
    renderPlayhead(state.playing?ac().currentTime-state.t0+state.offset:state.offset);
  }

  function drawClipWave(cv,clip,color,waveZoom){
    const dpr=devicePixelRatio||1,w=cv.parentElement.clientWidth,h=cv.parentElement.clientHeight||100;
    if(w<2)return;cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.width=w+'px';cv.style.height=h+'px';
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    g.clearRect(0,0,w,h);
    const pk=clip.peaks;if(!pk||!pk.length)return;
    const z=clamp(+(waveZoom||1),0.5,8);
    const mid=h/2,pad=2,amp=(mid-pad)*z;
    const buf=state.buffers.get(clip.buf);const total=buf?buf.duration:clip.dur;
    const a0=clip.offset/total,a1=(clip.offset+clip.dur)/total;
    const pairs=pk.length>=4&&pk.length%2===0; // min/max pairs
    const bins=pairs?pk.length/2:pk.length;
    // soft fill
    g.beginPath();g.moveTo(0,mid);
    for(let x=0;x<w;x++){
      const u=a0+(a1-a0)*(x/(w-1||1));const bi=Math.min(bins-1,Math.floor(u*bins));
      let mx;if(pairs)mx=Math.max(Math.abs(pk[bi*2]),Math.abs(pk[bi*2+1]));else mx=pk[bi]||0;
      g.lineTo(x,mid-Math.max(0.5,mx*amp));
    }
    for(let x=w-1;x>=0;x--){
      const u=a0+(a1-a0)*(x/(w-1||1));const bi=Math.min(bins-1,Math.floor(u*bins));
      let mn;if(pairs)mn=-Math.max(Math.abs(pk[bi*2]),Math.abs(pk[bi*2+1]));else mn=-(pk[bi]||0);
      g.lineTo(x,mid-Math.min(-0.5,mn*amp));
    }
    g.closePath();
    g.globalAlpha=.55;g.fillStyle=color;g.fill();
    // crisp center stroke
    g.beginPath();
    for(let x=0;x<w;x++){
      const u=a0+(a1-a0)*(x/(w-1||1));const bi=Math.min(bins-1,Math.floor(u*bins));
      let mx;if(pairs)mx=Math.max(Math.abs(pk[bi*2]),Math.abs(pk[bi*2+1]));else mx=pk[bi]||0;
      const y=mid-mx*amp;if(x)g.lineTo(x,y);else g.moveTo(x,y);
    }
    g.globalAlpha=.95;g.strokeStyle=color;g.lineWidth=1;g.stroke();
  }

  function renderPlayhead(t){
    const ph=$('playhead');if(!ph)return;ph.style.left=(Math.max(0,t)*state.pxPerSec)+'px';
  }

  function eqLabel(v){v=+v||0;return (v>0?'+':'')+v}
  function renderMixer(){
    const box=$('mixer');if(!box)return;box.innerHTML='';
    state.tracks.forEach((tr,i)=>{
      const el=document.createElement('div');el.className='strip';el.dataset.i=i;
      const labBg=tr.color||'#85909b';
      el.innerHTML=`<div class="lab" style="background:${labBg}" title="${escAttr(tr.name)}">${tr.name}</div>
        <div class="eqcol">
          <label class="eqrow"><span>Lo</span><input type="range" min="-12" max="12" step="1" value="${tr.eq.lo}" data-eq="lo" data-i="${i}"><b data-eqv="lo">${eqLabel(tr.eq.lo)}</b></label>
          <label class="eqrow"><span>Mid</span><input type="range" min="-12" max="12" step="1" value="${tr.eq.mid}" data-eq="mid" data-i="${i}"><b data-eqv="mid">${eqLabel(tr.eq.mid)}</b></label>
          <label class="eqrow"><span>Hi</span><input type="range" min="-12" max="12" step="1" value="${tr.eq.hi}" data-eq="hi" data-i="${i}"><b data-eqv="hi">${eqLabel(tr.eq.hi)}</b></label>
          <label class="eqrow"><span>Rv</span><input type="range" min="0" max="100" step="1" value="${(tr.rev||0)*100|0}" data-rev="${i}"><b data-eqv="rv">${(tr.rev||0)*100|0}</b></label>
        </div>
        <div class="fader-wrap"><input class="fader" type="range" min="0" max="150" value="${tr.vol}" data-vol="${i}" title="ระดับ ${tr.name}"></div>
        <span class="fader-val">${tr.vol}</span>
        <div class="ms">
        <button type="button" class="tb ${tr.mute?'on':''}" data-m="${i}">M</button>
        <button type="button" class="tb ${tr.solo?'on':''}" data-s="${i}">S</button></div>`;
      box.appendChild(el);
    });
  }

  /* piano roll */
  function renderPiano(){
    const roll=$('pianoRoll');if(!roll)return;
    const tr=state.tracks[state.sel.track];
    const show=!!(tr&&tr.type==='midi');
    roll.hidden=!show;
    roll.classList.toggle('on',show);
    ui.onTransport?.(state);
    if(!show)return;
    const grid=$('pianoGrid'),keys=$('pianoKeys');
    const W=Math.max(1200,Math.ceil((dur()+4)*state.pxPerSec));
    const keyH=14,midiLo=36,midiHi=84,rows=midiHi-midiLo;
    keys.innerHTML='';grid.innerHTML='';grid.style.width=W+'px';grid.style.height=(rows*keyH)+'px';
    for(let n=midiHi-1;n>=midiLo;n--){
      const k=document.createElement('div');k.className='pkey'+(NOTES[n%12].includes('#')?' blk':'');k.style.height=keyH+'px';
      k.textContent=NOTES[n%12]+(Math.floor(n/12)-1);k.dataset.n=n;keys.appendChild(k);
    }
    // grid lines
    const cv=document.createElement('canvas');cv.width=W;cv.height=rows*keyH;grid.appendChild(cv);
    const g=cv.getContext('2d');g.fillStyle='#10141a';g.fillRect(0,0,W,cv.height);
    for(let n=0;n<rows;n++){
      const black=NOTES[(midiHi-1-n)%12].includes('#');
      g.fillStyle=black?'#0c0f14':'#12171e';g.fillRect(0,n*keyH,W,keyH);
      g.strokeStyle='#1a222b';g.beginPath();g.moveTo(0,(n+1)*keyH);g.lineTo(W,(n+1)*keyH);g.stroke();
    }
    const bs=beatSec();
    for(let b=0;b*bs<=dur()+4;b++){const x=b*bs*state.pxPerSec;g.strokeStyle=b%4===0?'#2a3848':'#1a222b';g.beginPath();g.moveTo(x,0);g.lineTo(x,cv.height);g.stroke()}
    tr.notes.forEach(n=>{
      const el=document.createElement('div');el.className='pnote'+(state.sel.notes.includes(n.id)?' sel':'');
      el.style.left=(n.t*state.pxPerSec)+'px';el.style.width=Math.max(4,n.d*state.pxPerSec)+'px';
      el.style.top=((midiHi-1-n.n)*keyH)+'px';el.style.height=(keyH-2)+'px';el.dataset.id=n.id;
      grid.appendChild(el);
    });
  }

  /* events wiring */
  function bind(){
    $('btnPlay').onclick=()=>{
      if(state.playing){
        stopPlay();renderPlayhead(state.offset);return
      }
      // if parked at/past the end, restart from 0 (DAW-style)
      if(state.offset>=dur()-0.05)state.offset=0;
      state.playOnly=null;
      startPlay();
      renderTracks();renderMixer();
    };
    // Collapsible mixer — more room for tall waveforms
    const foldMix=$('btnMixerFold'), mixWrap=$('mixerWrap');
    if(foldMix&&mixWrap){
      try{if(localStorage.getItem('ssd-mixfold')==='1'){mixWrap.classList.add('folded');foldMix.setAttribute('aria-expanded','false');const c=$('mixerChev');if(c)c.textContent='▸'}}catch(e){}
      foldMix.onclick=()=>{
        const on=mixWrap.classList.toggle('folded');
        foldMix.setAttribute('aria-expanded',on?'false':'true');
        const c=$('mixerChev');if(c)c.textContent=on?'▸':'▾';
        try{localStorage.setItem('ssd-mixfold',on?'1':'0')}catch(e){}
      };
    }
    $('btnStop').onclick=()=>{stopPlay();state.offset=0;renderPlayhead(0);ui.onTransport?.(state)};
    $('btnRec').onclick=()=>toggleRecord();
    $('btnUndo').onclick=undo;$('btnRedo').onclick=redo;
    $('btnSplit').onclick=()=>{state.tool='split';syncTools()};
    $('btnSelect').onclick=()=>{state.tool='select';syncTools()};
    $('btnDraw').onclick=()=>{state.tool='draw';syncTools()};
    $('chkMetro').onchange=e=>{
      // Toggle นอม anytime without rebuilding the whole timeline (avoids click bursts / disappearing)
      state.metro=!!e.target.checked;
      setNomAudible(state.metro);
    };
    $('chkLoop').onchange=e=>{state.loop=e.target.checked;renderArrange()};
    $('chkSnap').onchange=e=>state.snap=e.target.checked;
    $('bpm').onchange=e=>{mark();state.bpm=clamp(+e.target.value||120,40,240);renderArrange()};
    $('zoom').oninput=e=>{state.pxPerSec=+e.target.value;renderArrange();renderPiano()};
    const nomVolEl=$('nomVol');
    if(nomVolEl){
      try{const nv=+localStorage.getItem('ssd-nomvol');if(nv>0){state.nomVol=nv;nomVolEl.value=String(nv)}}catch(e){}
      if(state.nomVol==null)state.nomVol=+nomVolEl.value||140;
      nomVolEl.oninput=e=>setNomVol(e.target.value);
    }else if(state.nomVol==null)state.nomVol=140;
    $('btnAddAud').onclick=()=>{mark();addAudioTrack();state.sel.track=state.tracks.length-1;renderAll();ui.toast?.('เพิ่มช่องเสียงแล้ว — ดับเบิลคลิกเลนหรือกดนำเข้าไฟล์')};
    $('btnAddMidi').onclick=()=>{mark();addMidiTrack();state.sel.track=state.tracks.length-1;renderAll()};
    const fNew=$('fAudNew');
    if(fNew)fNew.onchange=async e=>{
      const f=e.target.files[0];e.target.value='';if(!f)return;
      try{
        const t=addAudioTrack(f.name.replace(/\.[^.]+$/,''));
        state.sel.track=state.tracks.length-1;
        await importAudioToTrack(state.tracks.length-1,f,state.offset);
        ui.toast?.('เพิ่มช่องจากไฟล์แล้ว');
      }catch(_){}
    };
    $('btnDel').onclick=deleteSelected;
    $('btnSave').onclick=()=>saveProject();
    $('btnLoad').onclick=()=>$('fileProj').click();
    $('fileProj').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await loadProjectFile(f)};
    $('btnMixdown').onclick=()=>mixdown();
    $('btnNew').onclick=()=>{if(!state.dirty||confirm('เริ่มโปรเจกต์ใหม่?'))newProject()};

    $('trackHeads').onclick=e=>{
      const wz=e.target.closest('[data-wz]');if(wz){setTrackWaveZoom(+wz.dataset.wz,+wz.dataset.d);return}
      const m=e.target.closest('[data-m]');if(m){mark();const i=+m.dataset.m;state.tracks[i].mute=!state.tracks[i].mute;if(state.playOnly)state.playOnly=null;applyLiveMix();renderTracks();renderMixer();return}
      const s=e.target.closest('[data-s]');if(s){mark();const i=+s.dataset.s;state.tracks[i].solo=!state.tracks[i].solo;if(state.playOnly)state.playOnly=null;applyLiveMix();renderTracks();renderMixer();return}
      const th=e.target.closest('.thead');if(th&&!e.target.closest('input,button')){state.sel.track=+th.dataset.i;renderAll()}
    };
    $('trackHeads').onchange=e=>{const rn=e.target.closest('[data-rn]');if(rn){state.tracks[+rn.dataset.rn].name=rn.value;renderMixer()}};

    $('mixer').oninput=e=>{
      const i=+e.target.dataset.i;
      if(e.target.dataset.vol!=null){
        const ti=+e.target.dataset.vol;state.tracks[ti].vol=+e.target.value;applyLiveMix();
        const strip=e.target.closest('.strip');const lab=strip&&strip.querySelector('.fader-val');
        if(lab)lab.textContent=String(e.target.value|0);
      }
      if(e.target.dataset.eq){
        const k=e.target.dataset.eq;state.tracks[i].eq[k]=+e.target.value;
        const b=e.target.parentElement&&e.target.parentElement.querySelector('[data-eqv="'+k+'"]');
        if(b)b.textContent=eqLabel(e.target.value);
        try{
          const live=state.live&&state.live.get(state.tracks[i].id);
          if(live&&live[k])live[k].gain.setTargetAtTime(+e.target.value,ac().currentTime,0.02);
        }catch(err){}
      }
      if(e.target.dataset.rev!=null){
        const ti=+e.target.dataset.rev;state.tracks[ti].rev=+e.target.value/100;applyLiveMix();
        const b=e.target.parentElement&&e.target.parentElement.querySelector('[data-eqv="rv"]');
        if(b)b.textContent=String(e.target.value|0);
      }
    };
    $('mixer').onclick=e=>{
      const m=e.target.closest('[data-m]');if(m){mark();state.tracks[+m.dataset.m].mute=!state.tracks[+m.dataset.m].mute;if(state.playOnly)state.playOnly=null;applyLiveMix();renderTracks();renderMixer();return}
      const s=e.target.closest('[data-s]');if(s){mark();state.tracks[+s.dataset.s].solo=!state.tracks[+s.dataset.s].solo;if(state.playOnly)state.playOnly=null;applyLiveMix();renderTracks();renderMixer();return}
    };

    // arrange interactions
    const wrap=$('lanesWrap');
    wrap.addEventListener('click',e=>{
      if(e.target.closest('.clip,.hndl,.mblock'))return;
      const rect=$('lanes').getBoundingClientRect();
      const t=(e.clientX-rect.left+wrap.scrollLeft)/state.pxPerSec;
      if(state.tool==='split'){state.sel.track=+e.target.closest('.lane')?.dataset.ti||state.sel.track;splitAt(snapT(t));return}
      seek(snapT(t));
    });
    wrap.addEventListener('dblclick',e=>{
      const lane=e.target.closest('.lane');if(!lane)return;
      const ti=+lane.dataset.ti;state.sel.track=ti;
      const tr=state.tracks[ti];
      if(tr&&tr.type==='midi'){renderAll();return} // MIDI lanes: select only
      const input=document.createElement('input');input.type='file';input.accept='audio/*';
      input.onchange=async()=>{const f=input.files[0];if(!f)return;const rect=$('lanes').getBoundingClientRect();
        const at=(e.clientX-rect.left+wrap.scrollLeft)/state.pxPerSec;
        try{await importAudioToTrack(ti,f,snapT(at))}catch(_){}};
      input.click();
    });

    // drag clips
    let drag=null;
    wrap.addEventListener('pointerdown',e=>{
      const h=e.target.closest('.hndl');const clipEl=e.target.closest('.clip');
      if(!clipEl)return;
      const ti=+clipEl.dataset.ti,cid=clipEl.dataset.cid;
      const tr=state.tracks[ti];const clip=tr.clips.find(c=>c.id===cid);
      state.sel.track=ti;state.sel.clip=cid;renderArrange();
      const mode=h?h.classList.contains('L')?'L':'R':'move';
      mark(); // snapshot before drag/trim so undo can revert
      drag={ti,cid,mode,x0:e.clientX,start0:clip.start,dur0:clip.dur,off0:clip.offset,moved:false};
      clipEl.setPointerCapture(e.pointerId);
    });
    wrap.addEventListener('pointermove',e=>{
      if(!drag)return;
      const dx=(e.clientX-drag.x0)/state.pxPerSec;
      if(Math.abs(dx)<1e-4)return;
      drag.moved=true;
      const tr=state.tracks[drag.ti];const clip=tr.clips.find(c=>c.id===drag.cid);if(!clip)return;
      const buf=state.buffers.get(clip.buf);const maxDur=buf?buf.duration:Infinity;
      if(drag.mode==='move'){clip.start=snapT(Math.max(0,drag.start0+dx))}
      else if(drag.mode==='R'){
        const nd=snapT(Math.max(0.05,drag.dur0+dx));
        clip.dur=Math.min(nd,Math.max(0.05,maxDur-clip.offset));
      }
      else if(drag.mode==='L'){
        const ns=snapT(Math.max(0,drag.start0+dx));const delta=ns-drag.start0;
        const noff=Math.max(0,drag.off0+delta);
        const ndur=drag.dur0-delta;
        if(ndur>0.05&&noff+ndur<=maxDur+1e-6){clip.start=ns;clip.offset=noff;clip.dur=ndur}
      }
      renderArrange();
    });
    wrap.addEventListener('pointerup',()=>{
      if(!drag)return;
      // if never moved, drop the empty undo snapshot
      if(!drag.moved&&state.undo.length)state.undo.pop();
      else state.dirty=true;
      drag=null;
    });

    // piano roll draw
    const grid=$('pianoGrid');
    grid.addEventListener('pointerdown',e=>{
      const tr=state.tracks[state.sel.track];if(!tr||tr.type!=='midi')return;
      const noteEl=e.target.closest('.pnote');
      if(noteEl){state.sel.notes=[noteEl.dataset.id];renderPiano();return}
      // only Draw tool creates notes — Select just clears selection / seeks
      if(state.tool!=='draw'){
        if(state.tool==='select'){state.sel.notes=[];const rect=grid.getBoundingClientRect();
          seek(snapT((e.clientX-rect.left+grid.parentElement.scrollLeft)/state.pxPerSec));renderPiano()}
        return;
      }
      const rect=grid.getBoundingClientRect();
      const x=e.clientX-rect.left+grid.parentElement.scrollLeft;
      const y=e.clientY-rect.top+grid.parentElement.scrollTop;
      const t=snapT(x/state.pxPerSec);
      const keyH=14,midiHi=84;const n=midiHi-1-Math.floor(y/keyH);
      mark();
      const note={id:uid(),n:clamp(n,36,83),t,d:beatSec()/2,v:0.9};
      tr.notes.push(note);state.sel.notes=[note.id];renderArrange();renderPiano();
      previewNote(note.n);
    });
    $('pianoKeys').onmousedown=e=>{const k=e.target.closest('[data-n]');if(k)previewNote(+k.dataset.n)};
  }

  function previewNote(n){
    const a=ac();const osc=a.createOscillator();const g=a.createGain();
    osc.type='sawtooth';osc.frequency.value=midiHz(n);
    g.gain.value=0.15;osc.connect(g);g.connect(a.destination);
    osc.start();g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+0.3);osc.stop(a.currentTime+0.32);
  }

  function syncTools(){
    const map={select:'btnSelect',split:'btnSplit',draw:'btnDraw'};
    Object.entries(map).forEach(([tool,id])=>{const b=$(id);if(b)b.classList.toggle('on',state.tool===tool)});
  }

  function seek(t){const was=state.playing;stopPlay();state.offset=clamp(t,0,dur());renderPlayhead(state.offset);ui.onTransport?.(state);if(was)startPlay(state.offset)}

  function newProject(){
    stopPlay();state.tracks=[];state.buffers.clear();state.title='Untitled';state.bpm=120;state.t0=0;state.offset=0;state.dirty=false;
    state.undo.length=0;state.redo.length=0;
    [['กลอง',COLS[0],'drums'],['เบส',COLS[1],'bass'],['กีตาร์',COLS[5],'guitar'],['คีย์บอร์ด',COLS[7],'keys'],['ดนตรีอื่นๆ',COLS[2],'other'],['ร้อง',COLS[3],'vocals']]
      .forEach(([n,c,k])=>{const t=addAudioTrack(n,c);t.stem=k});
    renderAll();
  }

  /* persistence — buffers as wav in idb */
  function idb(){return new Promise((ok,no)=>{const r=indexedDB.open('setsod-data-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
  async function saveProject(){
    const bufs={};
    for(const [id,buf] of state.buffers){bufs[id]=await bufToWavArray(buf)}
    const proj={v:1,title:state.title,bpm:state.bpm,tracks:state.tracks,bufs,savedAt:Date.now()};
    const db=await idb();
    await new Promise((ok,no)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(proj,'current');tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});
    // also download .ssd.json sidecar without audio for safety + full blob download
    const blob=new Blob([JSON.stringify(proj)],{type:'application/json'});
    const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=(state.title||'project')+'.setsod-project.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    state.dirty=false;ui.toast?.('บันทึกโปรเจกต์แล้ว');
  }
  async function loadProjectFile(file){
    try{
      const proj=JSON.parse(await file.text());
      if(!proj||typeof proj!=='object')throw new Error('ไฟล์ไม่ใช่โปรเจกต์ SetSod Data');
      stopPlay();state.buffers.clear();state.tracks=proj.tracks||[];state.title=proj.title||'Untitled';state.bpm=proj.bpm||120;
      const a=ac();
      for(const id of Object.keys(proj.bufs||{})){
        const raw=proj.bufs[id];
        const u8=raw instanceof Uint8Array?raw:new Uint8Array(raw);
        const buf=await a.decodeAudioData(u8.buffer.slice(u8.byteOffset,u8.byteOffset+u8.byteLength));
        state.buffers.set(id,buf);
      }
      for(const tr of state.tracks)for(const c of tr.clips){const b=state.buffers.get(c.buf);if(b)c.peaks=peaksOf(b)}
      state.dirty=false;renderAll();ui.toast?.('โหลดโปรเจกต์แล้ว');
    }catch(e){ui.toast?.('เปิดโปรเจกต์ไม่ได้: '+(e.message||e))}
  }
  // Project/export sample rate: keep source SR (usually 44.1/48k) — never silently drop to a fixed 44.1
  function nativeSr(){
    let sr=0;
    for(const b of state.buffers.values())if(b&&b.sampleRate>sr)sr=b.sampleRate|0;
    if(!sr)try{sr=ac().sampleRate|0}catch(e){}
    if(!sr||sr<44100)sr=44100;
    if(sr>96000)sr=96000;
    return sr;
  }
  function softLimit(x){
    const a=Math.abs(x);if(a<=0.95)return x;
    const s=x<0?-1:1;return s*(0.95+0.05*Math.tanh((a-0.95)/0.05*1.4));
  }
  // PCM16 stereo/mono WAV: peak-normalize + soft limit + TPDF dither (no hard-clip hash)
  function encodeWavPCM16(chans,sr,opt){
    opt=opt||{};const ch=chans.length,n=chans[0].length;
    let pk=0;for(let c=0;c<ch;c++){const d=chans[c];for(let i=0;i<n;i++){const v=d[i]<0?-d[i]:d[i];if(v>pk)pk=v}}
    const target=opt.targetPeak!=null?opt.targetPeak:0.89; // ≈ −1 dBFS
    const maxG=opt.maxGain!=null?opt.maxGain:4; // ≤ +12 dB boost for quiet stems
    const gain=pk>1e-8?Math.min(target/pk,maxG):1;
    const dataBytes=n*ch*2;
    const b=new DataView(new ArrayBuffer(44+dataBytes));
    const w=(o,s)=>[...s].forEach((c,i)=>b.setUint8(o+i,c.charCodeAt(0)));
    w(0,'RIFF');b.setUint32(4,36+dataBytes,true);w(8,'WAVEfmt ');
    b.setUint32(16,16,true);b.setUint16(20,1,true);b.setUint16(22,ch,true);
    b.setUint32(24,sr,true);b.setUint32(28,sr*ch*2,true);b.setUint16(32,ch*2,true);b.setUint16(34,16,true);
    w(36,'data');b.setUint32(40,dataBytes,true);
    let o=44;
    for(let i=0;i<n;i++)for(let c=0;c<ch;c++){
      const x=softLimit(chans[c][i]*gain);
      const dither=Math.random()+Math.random()-1; // TPDF ±1 LSB
      let s=Math.round(x*32767+dither);if(s>32767)s=32767;else if(s<-32768)s=-32768;
      b.setInt16(o,s,true);o+=2;
    }
    return b.buffer;
  }
  async function bufToWavArray(buf,opt){
    const ch=[];for(let c=0;c<buf.numberOfChannels;c++)ch.push(buf.getChannelData(c));
    return Array.from(new Uint8Array(encodeWavPCM16(ch,buf.sampleRate,opt)));
  }

  async function mixdown(){
    ui.toast?.('กำลังมิกซ์ดาวน์…');
    const sr=nativeSr();
    const length=Math.ceil(dur()*sr)||sr;
    const off=new OfflineAudioContext(2,length,sr);
    // schedule into offline — simplified dry mix
    const anySolo=state.tracks.some(t=>t.solo);
    for(const tr of state.tracks){
      if(tr.mute||(anySolo&&!tr.solo))continue;
      const g=off.createGain();g.gain.value=tr.vol/100;g.connect(off.destination);
      if(tr.type==='audio'){
        for(const c of tr.clips){
          const buf=state.buffers.get(c.buf);if(!buf)continue;
          const src=off.createBufferSource();src.buffer=buf;const cg=off.createGain();cg.gain.value=c.gain||1;
          src.connect(cg);cg.connect(g);
          const maxOff=Math.max(0,buf.duration-1e-4);
          const off0=clamp(c.offset||0,0,maxOff);
          const dur0=Math.min(Math.max(0.001,c.dur||0),Math.max(0.001,buf.duration-off0));
          try{src.start(c.start,off0,dur0)}catch(e){}
        }
      }else{
        for(const n of tr.notes){
          const osc=off.createOscillator();osc.type='sawtooth';osc.frequency.value=midiHz(n.n);
          const ng=off.createGain();ng.gain.setValueAtTime(0,n.t);ng.gain.linearRampToValueAtTime(0.15,n.t+0.01);ng.gain.exponentialRampToValueAtTime(0.001,n.t+n.d);
          osc.connect(ng);ng.connect(g);osc.start(n.t);osc.stop(n.t+n.d+0.05);
        }
      }
    }
    const rendered=await off.startRendering();
    const wav=await bufToWavArray(rendered,{targetPeak:0.89,maxGain:2});
    const blob=new Blob([new Uint8Array(wav)],{type:'audio/wav'});
    const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=(state.title||'mix')+'-mixdown.wav';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    ui.toast?.('มิกซ์ดาวน์เสร็จ · WAV 16-bit '+sr+' Hz');
  }

  // export stems for SetSod
  function exportStemFiles(){
    const files=[];
    for(const tr of state.tracks){
      if(tr.type!=='audio'||!tr.clips.length)continue;
      // if single clip full buffer, export buffer; else skip complex for now — mix track
    }
    return files;
  }

  // mute by stem key for ทำดาต้า presets — never auto-mute click/countin here
  function applyStemMutes(muteKeys){
    const set=new Set(muteKeys||[]);
    for(const tr of state.tracks){
      if(tr.type!=='audio')continue;
      if(tr.stem==='click'||tr.stem==='countin')continue;
      tr.mute=!!(tr.stem&&set.has(tr.stem));
    }
    applyLiveMix();renderAll();
  }

  async function renderTrackWav(tr,sr,opt){
    if(!tr||tr.type!=='audio'||!tr.clips.length)return null;
    opt=opt||{};sr=sr||nativeSr();
    const pad=Math.max(0,+opt.padLead||0); // leading silence (count-in gap), sec
    let end=pad;
    for(const c of tr.clips)end=Math.max(end,pad+(c.start||0)+(c.dur||0));
    if(opt.totalDur!=null)end=Math.max(end,+opt.totalDur);
    const length=Math.max(1,Math.ceil(end*sr));
    const off=new OfflineAudioContext(2,length,sr);
    const g=off.createGain();g.gain.value=(tr.vol||100)/100;g.connect(off.destination);
    for(const c of tr.clips){
      const buf=state.buffers.get(c.buf);if(!buf)continue;
      const src=off.createBufferSource();src.buffer=buf;
      const cg=off.createGain();cg.gain.value=c.gain||1;
      src.connect(cg);cg.connect(g);
      const maxOff=Math.max(0,buf.duration-1e-4);
      const off0=clamp(c.offset||0,0,maxOff);
      const dur0=Math.min(Math.max(0.001,c.dur||0),Math.max(0.001,buf.duration-off0));
      try{src.start(pad+(c.start||0),off0,dur0)}catch(e){}
    }
    const rendered=await off.startRendering();
    // Stems: loudness-match to −1 dBFS so quiet demucs lanes aren't thin
    return bufToWavBlob(rendered,{targetPeak:0.89,maxGain:4});
  }

  /** Mix unmuted audio stems → mono music bed (for dual-mono ready file). */
  async function renderMusicMono(tracks,sr,padLead,totalDur){
    sr=sr||nativeSr();
    const pad=Math.max(0,+padLead||0);
    const length=Math.max(1,Math.ceil((totalDur||dur())*sr));
    const off=new OfflineAudioContext(1,length,sr);
    const merge=off.createGain();merge.gain.value=1;merge.connect(off.destination);
    for(const tr of tracks){
      if(!tr||tr.type!=='audio'||tr.mute||!tr.clips.length)continue;
      if(tr.stem==='click'||tr.stem==='countin')continue;
      const g=off.createGain();g.gain.value=(tr.vol||100)/100;g.connect(merge);
      for(const c of tr.clips){
        const buf=state.buffers.get(c.buf);if(!buf)continue;
        const src=off.createBufferSource();src.buffer=buf;
        const cg=off.createGain();cg.gain.value=c.gain||1;
        src.connect(cg);cg.connect(g);
        const maxOff=Math.max(0,buf.duration-1e-4);
        const off0=clamp(c.offset||0,0,maxOff);
        const dur0=Math.min(Math.max(0.001,c.dur||0),Math.max(0.001,buf.duration-off0));
        // Export: music starts after count-in pad (clip.start forced 0)
        try{src.start(pad,off0,dur0)}catch(e){}
      }
    }
    return await off.startRendering();
  }

  /**
   * Dual-mono ready WAV like reference「เด๋อ E」:
   * nom side = click+count-in only; other side = mono music only.
   * side 'R' → L=music R=nom (most common); 'L' → opposite.
   */
  function makeDualMonoBlob(musicMonoBuf,clickBuf,side,opt){
    opt=opt||{};
    const sr=clickBuf.sampleRate||musicMonoBuf.sampleRate||nativeSr();
    const n=Math.max(musicMonoBuf.length,clickBuf.length);
    const outL=new Float32Array(n),outR=new Float32Array(n);
    const m=musicMonoBuf.numberOfChannels>1
      ?(()=>{const a=musicMonoBuf.getChannelData(0),b=musicMonoBuf.getChannelData(1);const o=new Float32Array(musicMonoBuf.length);for(let i=0;i<o.length;i++)o[i]=0.5*(a[i]+b[i]);return o})()
      :musicMonoBuf.getChannelData(0);
    const c0=clickBuf.getChannelData(0);
    const c1=clickBuf.numberOfChannels>1?clickBuf.getChannelData(1):c0;
    const ck=new Float32Array(clickBuf.length);
    for(let i=0;i<ck.length;i++)ck[i]=0.5*(c0[i]+c1[i]);
    const nomRight=side!=='L';
    for(let i=0;i<n;i++){
      const mv=i<m.length?m[i]:0, cv=i<ck.length?ck[i]:0;
      if(nomRight){outL[i]=mv;outR[i]=cv}else{outL[i]=cv;outR[i]=mv}
    }
    const buf=ac().createBuffer(2,n,sr);buf.copyToChannel(outL,0);buf.copyToChannel(outR,1);
    return bufToWavBlob(buf,{targetPeak:opt.targetPeak!=null?opt.targetPeak:0.95,maxGain:opt.maxGain!=null?opt.maxGain:1.5});
  }

  /**
   * Export click track for full timeline: spoken count-in baked at head, then song clicks.
   * Matches working dual-mono packs (count-in lives on the nom channel, not a separate short file).
   */
  function makeExportClickBuf(musicDur,bpm,sr,opt){
    opt=opt||{};sr=sr||nativeSr();bpm=Math.max(40,Math.min(240,+bpm||120));
    const ci=Math.max(0,Math.min(4,+(opt.ci||0)|0));
    const style=opt.style||'normal',flourish=!!opt.flourish,t0=Math.max(0,+opt.t0||0);
    const spb=60/bpm,ciSec=ci*4*spb,total=ciSec+Math.max(0.5,+musicDur||1);
    const n=Math.max(1,Math.ceil(total*sr));
    const L=new Float32Array(n),R=new Float32Array(n);
    const hasVoice=CI_WORDS.some(w=>CI_VOICE[w]);
    // —— count-in (baked) ——
    // 2 bars: bar1 "one … two …" (beats 1+3), bar2 "one two three four" — like reference เด๋อ
    for(let bi=0;bi<ci*4;bi++){
      const at=Math.floor(bi*spb*sr),b4=bi%4,bar=Math.floor(bi/4);
      const word=CI_WORDS[b4];
      let speak=true;
      if(ci>=2&&bar===0&&(b4===1||b4===3))speak=false; // half-time first bar
      let spoke=false;
      if(speak&&hasVoice)spoke=mixVoiceAt(L,R,at,word,sr,b4===0?1.15:1.0);
      if(speak||!hasVoice){
        if(b4===0)hitAt(L,R,at,sr,2100,spoke?0.35:1.0,16);
        else if(speak)hitAt(L,R,at,sr,1550,spoke?0.22:0.75,11);
      }
    }
    // —— song clicks (after count-in), grid locked to music t0 ——
    const songBars=Math.ceil(Math.max(0,musicDur-t0)/(spb*4))+1;
    for(let beat=0;;beat++){
      const t=ciSec+t0+beat*spb;if(t>=total-1e-6)break;
      const at=Math.floor(t*sr);if(at>=n)break;
      const b4=beat%4;
      if(style==='rock'){
        if(b4===0)hitAt(L,R,at,sr,1800,0.78,14);
        else if(b4===2)hitAt(L,R,at,sr,1600,0.5,12);
        if(b4===1||b4===3)hitAt(L,R,at,sr,900,0.58,10);
      }else if(style==='samcha'){
        if(b4===0)hitAt(L,R,at,sr,2000,0.72,14);
        else if(b4===1){hitAt(L,R,at,sr,1400,0.35,9);hitAt(L,R,at+Math.floor(spb*0.5*sr),sr,1500,0.45,9);hitAt(L,R,at+Math.floor(spb*0.75*sr),sr,1500,0.45,9)}
        else if(b4===2){hitAt(L,R,at,sr,1300,0.32,9);hitAt(L,R,at+Math.floor(spb*0.5*sr),sr,1450,0.42,9);hitAt(L,R,at+Math.floor(spb*0.75*sr),sr,1450,0.42,9)}
        else hitAt(L,R,at,sr,1200,0.38,10);
      }else if(style==='slow'){
        if(b4===0)hitAt(L,R,at,sr,1500,0.7,16);
        else if(b4===2)hitAt(L,R,at,sr,1100,0.35,12);
      }else{
        const accent=b4===0;hitAt(L,R,at,sr,accent?2000:1200,accent?0.95:0.58,12);
      }
    }
    if(flourish){
      for(let bar=7;bar<songBars;bar+=8){
        const tf=ciSec+t0+(bar*4+3)*spb;
        for(let k=0;k<6;k++){
          const at=Math.floor((tf+k*(spb/6))*sr);if(at<0||at>=n)break;
          hitAt(L,R,at,sr,2200-k*120,0.42+k*0.04,8);
        }
      }
    }
    const buf=floatToBuf(L,R,sr);
    return{buf,ciSec,totalDur:total,sr};
  }

  function bufToWavBlob(buf,opt){
    const ch=[];for(let c=0;c<buf.numberOfChannels;c++)ch.push(buf.getChannelData(c));
    return new Blob([encodeWavPCM16(ch,buf.sampleRate,opt||{})],{type:'audio/wav'});
  }

  function hitAt(L,R,at,sr,freq,amp,ms){
    const n=L.length,len=Math.max(1,Math.floor((ms||12)*sr/1000));
    for(let i=0;i<len&&at+i<n;i++){
      // exponential decay — less click/alias than linear ramp
      const env=Math.exp(-3.2*i/len),v=Math.sin(2*Math.PI*freq*i/sr)*env*amp;
      L[at+i]+=v;R[at+i]+=v;
    }
  }
  // Beat grid from drums (prefer) / bass mix: {bpm, t0} — t0 = first downbeat (sec).
  // Onset-interval method (same idea as live app detectBpm) — more stable than autocorr for rock.
  function detectBeatGrid(preferStem){
    const pick=stem=>{const tr=state.tracks.find(t=>t.stem===stem&&t.clips[0]);return tr?state.buffers.get(tr.clips[0].buf):null};
    const loudest=()=>{
      let best=null,bestR=-1;
      for(const tr of state.tracks){
        if(tr.type!=='audio'||!tr.clips[0]||tr.stem==='click'||tr.stem==='countin')continue;
        const b=state.buffers.get(tr.clips[0].buf);if(!b)continue;
        const d=b.getChannelData(0);let s=0,step=Math.max(1,(d.length/8000)|0);
        for(let i=0;i<d.length;i+=step){const v=d[i];s+=v*v}
        if(s>bestR){bestR=s;best=b}
      }
      return best;
    };
    let buf=preferStem?pick(preferStem):null;
    // If preferred stem is near-silent (common when drums empty on acoustic songs), fall back
    if(buf){
      const d=buf.getChannelData(0);let s=0,step=Math.max(1,(d.length/8000)|0);
      for(let i=0;i<d.length;i+=step){const v=d[i];s+=v*v}
      if(s<1e-6)buf=null;
    }
    if(!buf)buf=pick('drums')||pick('bass')||pick('guitar')||loudest();
    if(!buf)return{bpm:state.bpm||120,t0:0};
    const sr=buf.sampleRate,ch0=buf.getChannelData(0),ch1=buf.numberOfChannels>1?buf.getChannelData(1):ch0;
    // Mix drums+bass when available for stronger kick pulse
    let mixL=ch0,mixR=ch1;
    try{
      const other=preferStem==='drums'?pick('bass'):(preferStem==='bass'?pick('drums'):pick('drums'));
      if(other&&other.sampleRate===sr&&other.length===buf.length){
        const o0=other.getChannelData(0),o1=other.numberOfChannels>1?other.getChannelData(1):o0;
        mixL=new Float32Array(ch0.length);mixR=new Float32Array(ch0.length);
        for(let i=0;i<ch0.length;i++){mixL[i]=ch0[i]+o0[i]*0.85;mixR[i]=ch1[i]+o1[i]*0.85}
      }
    }catch(e){}
    const hopSec=0.005,fr=Math.max(1,Math.round(sr*hopSec)),n=Math.floor(mixL.length/fr);
    if(n<200)return{bpm:state.bpm||120,t0:0};
    const env=new Float32Array(n);
    for(let i=0;i<n;i++){
      let m=0,a=i*fr,z=Math.min(mixL.length,(i+1)*fr);
      for(let j=a;j<z;j+=2){const v=((mixL[j]+mixR[j])*0.5);const a=v<0?-v:v;if(a>m)m=a}
      env[i]=m;
    }
    const srt=Float32Array.from(env).sort(),hi=srt[Math.floor(n*0.995)]||0;
    if(hi<0.015)return{bpm:state.bpm||120,t0:0};
    const thr=hi*0.28,minGap=Math.round(0.18/hopSec);
    const onsets=[];let last=-1e9;
    for(let i=1;i<n;i++){if(env[i]>=thr&&env[i-1]<thr&&i-last>=minGap){onsets.push(i*hopSec);last=i}}
    let bpm=state.bpm||120,t0=0;
    if(onsets.length>=8){
      const iv=[];for(let i=1;i<onsets.length;i++)iv.push(onsets[i]-onsets[i-1]);
      const sv=[...iv].sort((a,b)=>a-b),med=sv[Math.floor(sv.length/2)]||0.5;
      const tFirst=onsets[0];let sx=0,sy=0,sxx=0,sxy=0,k=0;
      for(const t of onsets){const idx=Math.round((t-tFirst)/med);if(Math.abs((t-tFirst)-idx*med)<med*0.2){sx+=idx;sy+=t;sxx+=idx*idx;sxy+=idx*t;k++}}
      let per=med;if(k>8&&(k*sxx-sx*sx)>0)per=(k*sxy-sx*sy)/(k*sxx-sx*sx);
      bpm=60/Math.max(1e-4,per);
      while(bpm<70)bpm*=2;while(bpm>180)bpm/=2;
      if(bpm>140)bpm/=2;if(bpm<85)bpm*=2;
      bpm=Math.round(bpm*10)/10;
      // Phase: absolute time of first strong downbeat (prefer kick on 1 & 3)
      const spb=60/bpm;
      const flux=new Float32Array(n);for(let i=1;i<n;i++)flux[i]=Math.max(0,env[i]-env[i-1]);
      let fmax=0;for(let i=0;i<n;i++)if(flux[i]>fmax)fmax=flux[i];
      if(fmax>0)for(let i=0;i<n;i++)flux[i]/=fmax;
      let bestOff=onsets[0],bestSc=-1;
      const searchN=256,win=Math.min(48,Math.floor((n*hopSec-spb)/spb));
      for(let k=0;k<searchN;k++){
        const off=spb*4*k/searchN;let sc=0;
        for(let bi=0;bi<win;bi++){
          const i=Math.floor((off+bi*spb)/hopSec);if(i>=n)break;
          const b4=bi%4;sc+=flux[i]*(b4===0?1.6:b4===2?1.2:0.45);
        }
        if(sc>bestSc){bestSc=sc;bestOff=off}
      }
      // Snap phase near first strong onset within ±½ beat
      let snap=bestOff;let snapSc=-1;
      for(const o of onsets.slice(0,40)){
        const cand=o-Math.round((o-bestOff)/spb)*spb;
        const d=Math.abs(cand-bestOff);if(d>spb*0.55)continue;
        const i=Math.floor(o/hopSec);const sc=(flux[i]||0)+1/(1+d*8);
        if(sc>snapSc){snapSc=sc;snap=Math.max(0,cand)}
      }
      t0=Math.round(Math.max(0,snap)*1000)/1000;
    }else{
      // Fallback autocorr if few onsets
      const hop=256,nn=Math.floor(mixL.length/hop);
      const on=new Float32Array(nn);
      for(let i=0;i<nn;i++){let s=0,a=i*hop,z=a+hop;for(let j=a;j<z&&j<mixL.length;j++){const v=(mixL[j]+mixR[j])*0.5;s+=v<0?-v:v}on[i]=s/hop}
      for(let i=nn-1;i>0;i--)on[i]=Math.max(0,on[i]-on[i-1]);on[0]=0;
      let omax=0;for(let i=0;i<nn;i++)if(on[i]>omax)omax=on[i];if(omax>0)for(let i=0;i<nn;i++)on[i]/=omax;
      const a0=Math.min(nn-10,Math.floor(8*sr/hop)),a1=Math.min(nn,Math.floor(90*sr/hop));
      let best=120,bestS=-1;
      for(let b=80;b<=160;b+=0.5){const lag=Math.round(60/b*sr/hop);if(lag<2)continue;let s=0;for(let i=a0;i<a1-lag;i++)s+=on[i]*on[i+lag];if(s>bestS){bestS=s;best=b}}
      bpm=best>140?best/2:best<90?best*2:best;bpm=Math.round(bpm*10)/10;
      t0=0;
    }
    return{bpm,t0};
  }

  // style: normal | rock | samcha | slow — always on beat grid (opt.t0 = first downbeat)
  function makeClickWav(durSec,bpm,sr,opt){
    opt=opt||{};sr=sr||nativeSr();bpm=Math.max(40,Math.min(240,+bpm||120));
    const style=opt.style||'normal',flourish=!!opt.flourish,t0=Math.max(0,+opt.t0||0);
    const n=Math.max(1,Math.ceil((durSec||1)*sr));
    const L=new Float32Array(n),R=new Float32Array(n);
    const spb=60/bpm;
    const bars=Math.ceil(Math.max(0,(durSec||1)-t0)/(spb*4))+1;
    for(let beat=0;;beat++){
      const t=t0+beat*spb;if(t>=durSec+1e-6)break;
      const at=Math.floor(t*sr);if(at>=n)break;
      const b4=beat%4;
      if(style==='rock'){
        if(b4===0)hitAt(L,R,at,sr,1800,0.62,14);
        else if(b4===2)hitAt(L,R,at,sr,1600,0.4,12);
        if(b4===1||b4===3)hitAt(L,R,at,sr,900,0.48,10); // backbeat
      }else if(style==='samcha'){
        // สามช่า: เน้น 1 · cha-cha บน 2& และ 3&
        if(b4===0)hitAt(L,R,at,sr,2000,0.58,14);
        else if(b4===1){hitAt(L,R,at,sr,1400,0.28,9);hitAt(L,R,at+Math.floor(spb*0.5*sr),sr,1500,0.38,9);hitAt(L,R,at+Math.floor(spb*0.75*sr),sr,1500,0.38,9)}
        else if(b4===2){hitAt(L,R,at,sr,1300,0.26,9);hitAt(L,R,at+Math.floor(spb*0.5*sr),sr,1450,0.36,9);hitAt(L,R,at+Math.floor(spb*0.75*sr),sr,1450,0.36,9)}
        else hitAt(L,R,at,sr,1200,0.3,10);
      }else if(style==='slow'){
        // half-time accents on same grid (does not stretch the song)
        if(b4===0)hitAt(L,R,at,sr,1500,0.45,16);
        else if(b4===2)hitAt(L,R,at,sr,1100,0.22,12);
      }else{
        const accent=b4===0;hitAt(L,R,at,sr,accent?2000:1200,accent?0.85:0.5,12);
      }
    }
    if(flourish){
      for(let bar=7;bar<bars;bar+=8){
        const tf=t0+(bar*4+3)*spb; // ท้ายห้องที่ 8 on grid
        for(let k=0;k<6;k++){
          const at=Math.floor((tf+k*(spb/6))*sr);if(at<0||at>=n)break;
          hitAt(L,R,at,sr,2200-k*120,0.35+k*0.04,8);
        }
      }
    }
    const buf=ac().createBuffer(2,n,sr);buf.copyToChannel(L,0);buf.copyToChannel(R,1);
    // Click below stem peak so music stays full; soft limit inside encoder
    return bufToWavBlob(buf,{targetPeak:0.72,maxGain:1});
  }
  // แทร็กลูกเล่นแยก (percussion accents) — ส่งเป็น stem ชื่อลูกเล่น
  function makeFlourishWav(durSec,bpm,sr,style,t0){
    sr=sr||nativeSr();bpm=Math.max(40,Math.min(240,+bpm||120));t0=Math.max(0,+t0||0);
    const n=Math.max(1,Math.ceil((durSec||1)*sr));
    const L=new Float32Array(n),R=new Float32Array(n);
    const spb=60/bpm;
    for(let beat=0;;beat++){
      const t=t0+beat*spb;if(t>=durSec+1e-6)break;
      const at=Math.floor(t*sr);if(at>=n)break;
      const b4=beat%4;
      if(style==='rock'&&(b4===1||b4===3))hitAt(L,R,at,sr,700,0.22,18);
      if(style==='samcha'&&(b4===1||b4===2)){
        hitAt(L,R,at+Math.floor(spb*0.5*sr),sr,600,0.18,14);
        hitAt(L,R,at+Math.floor(spb*0.75*sr),sr,650,0.18,14);
      }
      if(style==='slow'&&b4===0)hitAt(L,R,at,sr,500,0.12,24);
    }
    const buf=ac().createBuffer(2,n,sr);buf.copyToChannel(L,0);buf.copyToChannel(R,1);
    return bufToWavBlob(buf,{targetPeak:0.55,maxGain:1});
  }

  function floatToBuf(L,R,sr){
    const n=L.length,buf=ac().createBuffer(2,n,sr||nativeSr());
    buf.copyToChannel(L instanceof Float32Array?L:Float32Array.from(L),0);
    buf.copyToChannel(R instanceof Float32Array?R:Float32Array.from(R),1);
    return buf;
  }
  // Spoken one–two–three–four (same sfx as live SetSod). Lead-in so attack lands on the beat.
  const CI_WORDS=['one','two','three','four'];
  const CI_VOICE={};const CI_LEAD=0.012;let CI_LOAD=null;
  function loadCiVoices(){
    if(CI_LOAD)return CI_LOAD;
    CI_LOAD=(async()=>{
      try{
        const a=ac();
        await Promise.all(CI_WORDS.map(async w=>{
          try{
            const r=await fetch('sfx/ci-'+w+'.mp3');if(!r.ok)return;
            CI_VOICE[w]=await a.decodeAudioData((await r.arrayBuffer()).slice(0));
          }catch(e){}
        }));
      }catch(e){}
      return CI_VOICE;
    })();
    return CI_LOAD;
  }
  function mixVoiceAt(L,R,at,word,sr,amp){
    const src=CI_VOICE[word];if(!src)return false;
    const s0=src.getChannelData(0),s1=src.numberOfChannels>1?src.getChannelData(1):s0;
    const lead=Math.floor(CI_LEAD*sr);
    const start=Math.max(0,at-lead);
    const gain=amp==null?1:amp;
    const ratio=src.sampleRate/sr;
    const outLen=Math.ceil(s0.length/ratio);
    for(let i=0;i<outLen&&start+i<L.length;i++){
      const x=i*ratio,i0=x|0,f=x-i0,i1=Math.min(i0+1,s0.length-1);
      L[start+i]+=(s0[i0]*(1-f)+s0[i1]*f)*gain;
      R[start+i]+=(s1[i0]*(1-f)+s1[i1]*f)*gain;
    }
    return true;
  }
  // Loud spoken 1–2–3–4 count-in for ci bars (before music). Returns AudioBuffer.
  function makeCountInBuf(bars,bpm,sr){
    bars=Math.max(0,Math.min(4,+bars||0));sr=sr||nativeSr();bpm=Math.max(40,Math.min(240,+bpm||120));
    if(!bars)return null;
    const spb=60/bpm,sec=bars*4*spb,n=Math.max(1,Math.ceil(sec*sr));
    const L=new Float32Array(n),R=new Float32Array(n);
    const hasVoice=CI_WORDS.some(w=>CI_VOICE[w]);
    for(let bi=0;bi<bars*4;bi++){
      const at=Math.floor(bi*spb*sr),b4=bi%4,word=CI_WORDS[b4];
      let spoke=false;
      if(hasVoice)spoke=mixVoiceAt(L,R,at,word,sr,b4===0?1.05:0.95);
      // Soft click under the word (or alone if samples missing) so the beat stays clear
      if(b4===0)hitAt(L,R,at,sr,2100,spoke?0.28:1.0,16);
      else hitAt(L,R,at,sr,1550,spoke?0.16:0.7,11);
    }
    return floatToBuf(L,R,sr);
  }
  // Build click AudioBuffer on beat grid (same rules as makeClickWav)
  function makeClickBuf(durSec,bpm,sr,opt){
    opt=opt||{};sr=sr||nativeSr();bpm=Math.max(40,Math.min(240,+bpm||120));
    const style=opt.style||'normal',flourish=!!opt.flourish,t0=Math.max(0,+opt.t0||0);
    const n=Math.max(1,Math.ceil((durSec||1)*sr));
    const L=new Float32Array(n),R=new Float32Array(n);
    const spb=60/bpm,bars=Math.ceil(Math.max(0,(durSec||1)-t0)/(spb*4))+1;
    for(let beat=0;;beat++){
      const t=t0+beat*spb;if(t>=durSec+1e-6)break;
      const at=Math.floor(t*sr);if(at>=n)break;
      const b4=beat%4;
      if(style==='rock'){
        if(b4===0)hitAt(L,R,at,sr,1800,0.62,14);
        else if(b4===2)hitAt(L,R,at,sr,1600,0.4,12);
        if(b4===1||b4===3)hitAt(L,R,at,sr,900,0.48,10);
      }else if(style==='samcha'){
        if(b4===0)hitAt(L,R,at,sr,2000,0.58,14);
        else if(b4===1){hitAt(L,R,at,sr,1400,0.28,9);hitAt(L,R,at+Math.floor(spb*0.5*sr),sr,1500,0.38,9);hitAt(L,R,at+Math.floor(spb*0.75*sr),sr,1500,0.38,9)}
        else if(b4===2){hitAt(L,R,at,sr,1300,0.26,9);hitAt(L,R,at+Math.floor(spb*0.5*sr),sr,1450,0.36,9);hitAt(L,R,at+Math.floor(spb*0.75*sr),sr,1450,0.36,9)}
        else hitAt(L,R,at,sr,1200,0.3,10);
      }else if(style==='slow'){
        if(b4===0)hitAt(L,R,at,sr,1500,0.5,16);
        else if(b4===2)hitAt(L,R,at,sr,1100,0.25,12);
      }else{
        const accent=b4===0;hitAt(L,R,at,sr,accent?2000:1200,accent?0.85:0.5,12);
      }
    }
    if(flourish){
      for(let bar=7;bar<bars;bar+=8){
        const tf=t0+(bar*4+3)*spb;
        for(let k=0;k<6;k++){
          const at=Math.floor((tf+k*(spb/6))*sr);if(at<0||at>=n)break;
          hitAt(L,R,at,sr,2200-k*120,0.35+k*0.04,8);
        }
      }
    }
    return floatToBuf(L,R,sr);
  }

  // Turn นอม on/off live (mute only — no rebuild, no click bursts)
  function setNomAudible(on){
    state.metro=!!on;
    let ck=state.tracks.find(t=>t.stem==='click');
    if(!ck&&on&&state.tracks.some(t=>t.clips&&t.clips.length&&t.stem&&t.stem!=='countin')){
      try{syncGuideTracks({metroOn:true,ci:0,preview:true})}catch(e){}
      ck=state.tracks.find(t=>t.stem==='click');
    }
    if(ck){ck.mute=!on;applyLiveMix();renderTracks();renderMixer()}
    const el=typeof document!=='undefined'&&document.getElementById('chkMetro');
    if(el)el.checked=!!on;
  }
  /**
   * Rebuild visible เมโทรนอม/นอม + นับเข้า tracks (waveform + audible on Play).
   * opts: {bpm,t0,ci,feel,flourish,metroOn,preview}
   * Studio preview uses clean quarter-note clicks only (no flourish/samcha bursts).
   */
  function syncGuideTracks(opts){
    opts=opts||{};
    const bpm=Math.max(40,Math.min(240,+(opts.bpm!=null?opts.bpm:state.bpm)||120));
    const t0=Math.max(0,+(opts.t0!=null?opts.t0:state.t0)||0);
    const ci=Math.max(0,Math.min(4,+(opts.ci!=null?opts.ci:0)|0));
    const feel=opts.feel||'normal',flourish=!!opts.flourish;
    const metroOn=opts.metroOn!=null?!!opts.metroOn:!!state.metro;
    const preview=opts.preview!==false; // default: studio-safe click
    state.bpm=bpm;state.t0=t0;
    const sr=nativeSr();
    const spb=60/bpm,ciSec=ci*4*spb;

    // Drop previous guide tracks
    state.tracks=state.tracks.filter(t=>t.stem!=='click'&&t.stem!=='countin');

    // Music stems after count-in; keep clip.dur = buffer.duration (never shrink)
    let musicDur=1;
    for(const tr of state.tracks){
      if(tr.type!=='audio'||!tr.stem)continue;
      for(const c of tr.clips){
        const b=state.buffers.get(c.buf);
        if(b){c.dur=b.duration;musicDur=Math.max(musicDur,b.duration)}
        else musicDur=Math.max(musicDur,c.dur||0);
        c.start=ciSec;
      }
    }

    if(ci>0){
      const cib=makeCountInBuf(ci,bpm,sr);
      if(cib){
        const id=putBuf(cib);
        const t=addAudioTrack('นับเข้า', '#ffd60a');t.stem='countin';t.vol=110;t.mute=false;
        t.clips.push({id:uid(),buf:id,start:0,offset:0,dur:cib.duration,gain:1,peaks:peaksOf(cib),name:'countin'});
      }
    }
    // Audition nom: plain 1-2-3-4 quarter clicks only (export still uses feel/flourish)
    const clickStyle=preview?'normal':feel;
    const clickFlour=preview?false:flourish;
    const click=makeClickBuf(musicDur,bpm,sr,{style:clickStyle,flourish:clickFlour,t0});
    const cid=putBuf(click);
    const nomV=state.nomVol!=null?state.nomVol:140;
    const ct=addAudioTrack('เมโทรนอม / นอม', '#45c4d4');ct.stem='click';ct.vol=nomV;ct.mute=!metroOn;
    ct.clips.push({id:uid(),buf:cid,start:ciSec,offset:0,dur:click.duration,gain:1,peaks:peaksOf(click),name:'click'});

    renderAll();
    return{bpm,t0,ci,ciSec,feel,musicDur};
  }

  function syncToolsInit(){syncTools()}

  // public API
  const api={
    state,newProject,loadStemChannels,importAudioToTrack,startPlay,stopPlay,seek,saveProject,mixdown,
    playTrack,applyLiveMix,addAudioTrack,addMidiTrack,setTrackWaveZoom,setNomVol,renderAll,toggleRecord,getDur:dur,fmt,
    applyStemMutes,renderTrackWav,renderMusicMono,makeDualMonoBlob,makeExportClickBuf,
    makeClickWav,makeFlourishWav,bufToWavBlob,nativeSr,detectBeatGrid,
    syncGuideTracks,makeCountInBuf,makeClickBuf,loadCiVoices,setNomAudible,
    async boot(){bind();
      // Preload spoken one–two–three–four for Data count-in
      try{loadCiVoices()}catch(e){}
      // scroll sync: track headers follow the lane vertical scroll
      try{const wrap=$('lanesWrap'),heads=$('trackHeads');
        if(wrap&&heads)wrap.addEventListener('scroll',()=>{heads.scrollTop=wrap.scrollTop},{passive:true})}catch(e){}
      // restore last saved project from IndexedDB when present; else empty project
      let restored=false;
      try{
        const db=await idb();
        const proj=await new Promise((ok,no)=>{const tx=db.transaction('projects','readonly');const g=tx.objectStore('projects').get('current');g.onsuccess=()=>ok(g.result);g.onerror=()=>no(g.error)});
        if(proj&&proj.tracks&&proj.bufs){
          stopPlay();state.buffers.clear();state.tracks=proj.tracks||[];state.title=proj.title||'Untitled';state.bpm=proj.bpm||120;
          const a=ac();
          for(const id of Object.keys(proj.bufs||{})){
            const raw=proj.bufs[id];const u8=raw instanceof Uint8Array?raw:new Uint8Array(raw);
            const buf=await a.decodeAudioData(u8.buffer.slice(u8.byteOffset,u8.byteOffset+u8.byteLength));
            state.buffers.set(id,buf);
          }
          for(const tr of state.tracks)for(const c of tr.clips){const b=state.buffers.get(c.buf);if(b)c.peaks=peaksOf(b)}
          state.dirty=false;restored=true;renderAll();
          ui.toast?.('โหลดโปรเจกต์ล่าสุด: '+(state.title||'Untitled'));
        }
      }catch(e){}
      if(!restored)newProject();
      syncToolsInit();
      // keyboard — guard non-Element targets (Document/Window) that lack .matches
      addEventListener('keydown',e=>{
        const t=e.target;
        if(t&&typeof t.matches==='function'&&t.matches('input,textarea'))return;
        if(e.code==='Space'){e.preventDefault();$('btnPlay').click()}
        if(e.key==='Delete'||e.key==='Backspace')deleteSelected();
        if(e.key==='s'&&!e.metaKey&&!e.ctrlKey){state.tool='split';syncTools();splitAt(state.offset)}
        if(e.key==='v'){state.tool='select';syncTools()}
        if(e.key==='d'){state.tool='draw';syncTools()}
        if((e.metaKey||e.ctrlKey)&&e.key==='z'){e.preventDefault();undo()}
        if((e.metaKey||e.ctrlKey)&&e.key==='y'){e.preventDefault();redo()}
      });
    }
  };
  return api;
}
