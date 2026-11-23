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
      mute:false,solo:false,vol:100,pan:0,eq:{lo:0,mid:0,hi:0},rev:0,clips:[],notes:[]};
    state.tracks.push(t);return t;
  }
  function addMidiTrack(name){
    const t={id:uid(),type:'midi',name:name||('MIDI '+(state.tracks.length+1)),color:COLS[state.tracks.length%COLS.length],
      mute:false,solo:false,vol:100,pan:0,eq:{lo:0,mid:0,hi:0},rev:0.15,clips:[],notes:[]};
    state.tracks.push(t);return t;
  }

  async function decodeFile(file){
    const ab=await file.arrayBuffer();
    return await ac().decodeAudioData(ab.slice(0));
  }
  function putBuf(buf){const id=uid();state.buffers.set(id,buf);return id}
  function peaksOf(buf,bins=1200){
    const L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L;
    const n=L.length,step=Math.max(1,Math.floor(n/bins)),out=new Float32Array(Math.ceil(n/step));
    for(let i=0,o=0;i<n;i+=step,o++){let m=0;const e=Math.min(n,i+step);for(let j=i;j<e;j+=8)m=Math.max(m,Math.abs(L[j]),Math.abs(R[j]));out[o]=m}
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

  function loadStemChannels({title,src,channels,sampleRate}){
    mark();state.title=title||state.title;
    // replace tracks with stem tracks — keep prior buffers so Undo can restore previous clips
    state.tracks=[];
    const a=ac();
    src.forEach((s,i)=>{
      const {L,R}=channels[i];
      const n=L.length,b=a.createBuffer(2,n,sampleRate||44100);
      b.copyToChannel(L,0);b.copyToChannel(R.length===n?R:L,1);
      const id=putBuf(b);
      const names={drums:'กลอง',bass:'เบส',other:'ดนตรีอื่นๆ',vocals:'ร้อง'};
      const t=addAudioTrack(names[s]||s,COLS[i%COLS.length]);
      t.clips.push({id:uid(),buf:id,start:0,offset:0,dur:b.duration,gain:1,peaks:peaksOf(b),name:s});
    });
    addMidiTrack('เมโลดี้');
    renderAll();
  }

  /* ---------- FX graph helpers ---------- */
  function makeTrackChain(tr){
    const a=ac();
    const g=a.createGain();g.gain.value=tr.vol/100;
    const p=a.createStereoPanner();p.pan.value=tr.pan||0;
    // simple shelving via biquads
    const lo=a.createBiquadFilter();lo.type='lowshelf';lo.frequency.value=180;lo.gain.value=tr.eq.lo;
    const mid=a.createBiquadFilter();mid.type='peaking';mid.frequency.value=1200;mid.Q.value=0.8;mid.gain.value=tr.eq.mid;
    const hi=a.createBiquadFilter();hi.type='highshelf';hi.frequency.value=6000;hi.gain.value=tr.eq.hi;
    const dry=a.createGain();dry.gain.value=1-(tr.rev||0)*0.7;
    const wet=a.createGain();wet.gain.value=(tr.rev||0)*0.7;
    const conv=a.createConvolver();
    // synthetic impulse
    if(!state._imp){const len=a.sampleRate*1.2,imp=a.createBuffer(2,len,a.sampleRate);for(let c=0;c<2;c++){const d=imp.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.8)}state._imp=imp}
    conv.buffer=state._imp;
    g.connect(lo);lo.connect(mid);mid.connect(hi);hi.connect(p);
    p.connect(dry);p.connect(wet);wet.connect(conv);
    return {input:g,dry,conv,nodes:[g,p,lo,mid,hi,dry,wet,conv]};
  }

  function stopPlay(){
    cancelAnimationFrame(state._raf);
    if(state.playing)state.offset=clamp(ac().currentTime-state.t0+state.offset,0,dur());
    for(const n of state.nodes){try{n.stop?.()}catch(e){}try{n.disconnect?.()}catch(e){}}
    for(const x of state.fx){try{x.nodes.forEach(n=>n.disconnect())}catch(e){}}
    state.nodes=[];state.fx=[];state.playing=false;
    ui.onTransport?.(state);
  }

  function scheduleAudioClip(tr,clip,chain,when,playFrom){
    const buf=state.buffers.get(clip.buf);if(!buf)return;
    const a=ac();
    const src=a.createBufferSource();src.buffer=buf;
    const g=a.createGain();g.gain.value=clip.gain||1;
    src.connect(g);g.connect(chain.input);
    // clip window — clamp offset into [0, buf.duration] so bad trims never throw RangeError
    const local=Math.max(0,playFrom-clip.start);
    if(local>=clip.dur)return;
    const maxOff=Math.max(0,buf.duration-1e-4);
    const off=clamp(clip.offset+local,0,maxOff);
    const remain=Math.min(Math.max(0.001,clip.dur-local),Math.max(0.001,buf.duration-off));
    try{src.start(when,off,remain);state.nodes.push(src)}catch(e){console.warn('clip schedule',e)}
  }

  function scheduleMidi(tr,chain,when,playFrom){
    const a=ac();
    for(const n of tr.notes){
      const start=n.t,end=n.t+n.d;
      if(end<=playFrom)continue;
      const delay=Math.max(0,start-playFrom);
      const durN=end-Math.max(start,playFrom);
      const osc=a.createOscillator();osc.type='sawtooth';osc.frequency.value=midiHz(n.n);
      const g=a.createGain();
      const t0=when+delay;
      g.gain.setValueAtTime(0,t0);
      g.gain.linearRampToValueAtTime(0.18*(n.v||1),t0+0.01);
      g.gain.exponentialRampToValueAtTime(0.001,t0+Math.max(0.05,durN));
      const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=2200;
      osc.connect(f);f.connect(g);g.connect(chain.input);
      osc.start(t0);osc.stop(t0+durN+0.05);
      state.nodes.push(osc);
    }
  }

  function startPlay(from){
    stopPlay();
    const a=ac();if(a.state==='suspended')a.resume();
    state.offset=from!=null?from:state.offset;
    state.t0=a.currentTime;state.playing=true;
    const master=a.createGain();master.gain.value=1;
    const merge=a.createGain();
    // shared reverb bus
    const revGain=a.createGain();revGain.gain.value=1;
    const conv=a.createConvolver();
    if(!state._imp){const len=a.sampleRate*1.2,imp=a.createBuffer(2,len,a.sampleRate);for(let c=0;c<2;c++){const d=imp.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.8)}state._imp=imp}
    conv.buffer=state._imp;
    revGain.connect(conv);conv.connect(master);
    merge.connect(master);master.connect(a.destination);

    const anySolo=state.tracks.some(t=>t.solo);
    const when=a.currentTime+0.03;
    state.tracks.forEach(tr=>{
      if(tr.mute||(anySolo&&!tr.solo))return;
      const chain=makeTrackChain(tr);
      chain.dry.connect(merge);
      chain.conv.connect(revGain);
      state.fx.push(chain);
      if(tr.type==='audio')tr.clips.forEach(c=>scheduleAudioClip(tr,c,chain,when,state.offset));
      else scheduleMidi(tr,chain,when,state.offset);
    });
    if(state.metro)scheduleMetro(when,state.offset);
    ui.onTransport?.(state);tick();
  }

  function scheduleMetro(when,playFrom){
    const a=ac();const bs=beatSec();
    const startBeat=Math.ceil(playFrom/bs-1e-6);
    for(let b=startBeat;b<startBeat+64;b++){
      const t=b*bs;if(t<playFrom)continue;
      const osc=a.createOscillator();const g=a.createGain();
      osc.frequency.value=(b%4===0)?1200:800;
      const at=when+(t-playFrom);
      g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(0.2,at+0.005);g.gain.exponentialRampToValueAtTime(0.001,at+0.08);
      osc.connect(g);g.connect(a.destination);osc.start(at);osc.stop(at+0.1);state.nodes.push(osc);
    }
  }

  function tick(){
    if(!state.playing)return;
    let t=ac().currentTime-state.t0+state.offset;
    if(state.loop&&t>=state.loopB){startPlay(state.loopA);return}
    if(t>=dur()+0.05){stopPlay();state.offset=0;ui.onTransport?.(state);renderArrange();return}
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
      el.innerHTML=`<div class="tn"><i style="background:${tr.color}"></i><input value="${tr.name}" data-rn="${i}"><b>${tr.type==='midi'?'MIDI':'AUD'}</b></div>
        <div class="tops">
          <button type="button" class="tb ${tr.mute?'on':''}" data-m="${i}">M</button>
          <button type="button" class="tb ${tr.solo?'on':''}" data-s="${i}">S</button>
          <button type="button" class="tb" data-arm="${i}" title="เลือกแทร็ก">◎</button>
        </div>`;
      box.appendChild(el);
    });
  }

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
    lanes.innerHTML='';
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
          requestAnimationFrame(()=>drawClipWave(cv,c,tr.color));
        });
      }else{
        // MIDI blocks overview
        tr.notes.forEach(n=>{
          const x=n.t*state.pxPerSec,w=Math.max(3,n.d*state.pxPerSec);
          const y=((84-n.n)/48)*70+8;
          const note=document.createElement('div');note.className='mblock';note.style.cssText=`left:${x}px;width:${w}px;top:${y}px;background:${tr.color}`;
          lane.appendChild(note);
        });
      }
      lanes.appendChild(lane);
    });
    renderPlayhead(state.playing?ac().currentTime-state.t0+state.offset:state.offset);
  }

  function drawClipWave(cv,clip,color){
    const dpr=devicePixelRatio||1,w=cv.parentElement.clientWidth,h=56;
    if(w<2)return;cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.width=w+'px';cv.style.height=h+'px';
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    g.clearRect(0,0,w,h);g.fillStyle=color;g.globalAlpha=.9;
    const pk=clip.peaks;if(!pk||!pk.length)return;
    const mid=h/2,buf=state.buffers.get(clip.buf);const total=buf?buf.duration:clip.dur;
    const a0=clip.offset/total,a1=(clip.offset+clip.dur)/total;
    for(let x=0;x<w;x++){
      const u=a0+(a1-a0)*(x/w);const i=Math.min(pk.length-1,Math.floor(u*pk.length));
      const y=pk[i]* (mid-3);g.fillRect(x,mid-y,1,Math.max(1,y*2));
    }
  }

  function renderPlayhead(t){
    const ph=$('playhead');if(!ph)return;ph.style.left=(Math.max(0,t)*state.pxPerSec)+'px';
  }

  function renderMixer(){
    const box=$('mixer');if(!box)return;box.innerHTML='';
    state.tracks.forEach((tr,i)=>{
      const el=document.createElement('div');el.className='strip';el.dataset.i=i;
      el.innerHTML=`<div class="lab">${tr.name}</div>
        <label class="fx">Lo <input type="range" min="-12" max="12" value="${tr.eq.lo}" data-eq="lo" data-i="${i}"></label>
        <label class="fx">Mid <input type="range" min="-12" max="12" value="${tr.eq.mid}" data-eq="mid" data-i="${i}"></label>
        <label class="fx">Hi <input type="range" min="-12" max="12" value="${tr.eq.hi}" data-eq="hi" data-i="${i}"></label>
        <label class="fx">Rev <input type="range" min="0" max="100" value="${(tr.rev||0)*100}" data-rev="${i}"></label>
        <input class="fader" type="range" min="0" max="100" value="${tr.vol}" data-vol="${i}">
        <div class="ms"><button type="button" class="tb ${tr.mute?'on':''}" data-m="${i}">M</button>
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
      if(state.playing){stopPlay();renderPlayhead(state.offset);return}
      // if parked at/past the end, restart from 0 (DAW-style)
      if(state.offset>=dur()-0.05)state.offset=0;
      startPlay();
    };
    $('btnStop').onclick=()=>{stopPlay();state.offset=0;renderPlayhead(0);ui.onTransport?.(state)};
    $('btnRec').onclick=()=>toggleRecord();
    $('btnUndo').onclick=undo;$('btnRedo').onclick=redo;
    $('btnSplit').onclick=()=>{state.tool='split';syncTools()};
    $('btnSelect').onclick=()=>{state.tool='select';syncTools()};
    $('btnDraw').onclick=()=>{state.tool='draw';syncTools()};
    $('chkMetro').onchange=e=>state.metro=e.target.checked;
    $('chkLoop').onchange=e=>{state.loop=e.target.checked;renderArrange()};
    $('chkSnap').onchange=e=>state.snap=e.target.checked;
    $('bpm').onchange=e=>{mark();state.bpm=clamp(+e.target.value||120,40,240);renderArrange()};
    $('zoom').oninput=e=>{state.pxPerSec=+e.target.value;renderArrange();renderPiano()};
    $('btnAddAud').onclick=()=>{mark();addAudioTrack();renderAll()};
    $('btnAddMidi').onclick=()=>{mark();addMidiTrack();renderAll()};
    $('btnDel').onclick=deleteSelected;
    $('btnSave').onclick=()=>saveProject();
    $('btnLoad').onclick=()=>$('fileProj').click();
    $('fileProj').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await loadProjectFile(f)};
    $('btnMixdown').onclick=()=>mixdown();
    $('btnNew').onclick=()=>{if(!state.dirty||confirm('เริ่มโปรเจกต์ใหม่?'))newProject()};

    $('trackHeads').onclick=e=>{
      const rn=e.target.closest('[data-rn]');
      const m=e.target.closest('[data-m]');if(m){mark();const i=+m.dataset.m;state.tracks[i].mute=!state.tracks[i].mute;renderAll();return}
      const s=e.target.closest('[data-s]');if(s){mark();const i=+s.dataset.s;state.tracks[i].solo=!state.tracks[i].solo;renderAll();return}
      const arm=e.target.closest('[data-arm]');if(arm){state.sel.track=+arm.dataset.arm;renderAll();return}
      const th=e.target.closest('.thead');if(th){state.sel.track=+th.dataset.i;renderAll()}
    };
    $('trackHeads').onchange=e=>{const rn=e.target.closest('[data-rn]');if(rn){state.tracks[+rn.dataset.rn].name=rn.value;renderMixer()}};

    $('mixer').oninput=e=>{
      const i=+e.target.dataset.i;
      if(e.target.dataset.vol!=null){state.tracks[+e.target.dataset.vol].vol=+e.target.value}
      if(e.target.dataset.eq){state.tracks[i].eq[e.target.dataset.eq]=+e.target.value}
      if(e.target.dataset.rev!=null){state.tracks[+e.target.dataset.rev].rev=+e.target.value/100}
    };
    $('mixer').onclick=e=>{
      const m=e.target.closest('[data-m]');if(m){mark();state.tracks[+m.dataset.m].mute=!state.tracks[+m.dataset.m].mute;renderAll()}
      const s=e.target.closest('[data-s]');if(s){mark();state.tracks[+s.dataset.s].solo=!state.tracks[+s.dataset.s].solo;renderAll()}
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
    stopPlay();state.tracks=[];state.buffers.clear();state.title='Untitled';state.bpm=120;state.offset=0;state.dirty=false;
    state.undo.length=0;state.redo.length=0;
    addAudioTrack('แทร็ก 1');addMidiTrack('เมโลดี้');renderAll();
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
  async function bufToWavArray(buf){
    const n=buf.length,ch=buf.numberOfChannels,sr=buf.sampleRate;
    const b=new DataView(new ArrayBuffer(44+n*ch*2));
    const w=(o,s)=>[...s].forEach((c,i)=>b.setUint8(o+i,c.charCodeAt(0)));
    w(0,'RIFF');b.setUint32(4,36+n*ch*2,true);w(8,'WAVEfmt ');
    b.setUint32(16,16,true);b.setUint16(20,1,true);b.setUint16(22,ch,true);
    b.setUint32(24,sr,true);b.setUint32(28,sr*ch*2,true);b.setUint16(32,ch*2,true);b.setUint16(34,16,true);
    w(36,'data');b.setUint32(40,n*ch*2,true);
    let o=44;for(let i=0;i<n;i++)for(let c=0;c<ch;c++){b.setInt16(o,clamp(buf.getChannelData(c)[i],-1,1)*32767,true);o+=2}
    return Array.from(new Uint8Array(b.buffer));
  }

  async function mixdown(){
    ui.toast?.('กำลังมิกซ์ดาวน์…');
    const length=Math.ceil(dur()*ac().sampleRate)||ac().sampleRate;
    const off=new OfflineAudioContext(2,length,ac().sampleRate);
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
    const wav=await bufToWavArray(rendered);
    const blob=new Blob([new Uint8Array(wav)],{type:'audio/wav'});
    const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=(state.title||'mix')+'-mixdown.wav';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    ui.toast?.('มิกซ์ดาวน์เสร็จ');
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

  function syncToolsInit(){syncTools()}

  // public API
  const api={
    state,newProject,loadStemChannels,importAudioToTrack,startPlay,stopPlay,seek,saveProject,mixdown,
    addAudioTrack,addMidiTrack,renderAll,toggleRecord,getDur:dur,fmt,
    async boot(){bind();
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
