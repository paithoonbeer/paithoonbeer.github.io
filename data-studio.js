/* SetSod Data Studio — arrangement, MIDI piano roll, record, FX, project save */
import {beepAt,clickGrid,cueWords,masterMusic,masterNom,wav16,autoEnd,peakAbs} from './data-nom.js?v=1.0.40';
import {detectBeat,musicStartSec as nomMusicStart} from './data-beat.js?v=1.0.33';
import {renderHeard,denoiseBed,UNMIX,UNMIX_CLEAN,UNMIX_DEFAULT,eqFlat} from './data-unmix.js?v=1.0.44';
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
    metro:true,snap:true,playT0:0,
    ac:null,nodes:[],fx:[],rec:{stream:null,proc:null,chunks:[],start:0},
    undo:[],redo:[],dirty:false,clipBoard:null,
    // Data 1.0.30: section markers {id,t(song s),name,kind:'section'|'end',src:'manual'|'auto'} + per-song recipe
    markers:[],recipe:null,nomOpt:null
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
  function snapT(t){if(!state.snap)return t;const g=beatSec()/4,o=((musicStart()+(+state.t0||0))%g+g)%g;return o+Math.round((t-o)/g)*g}
  function mark(){state.undo.push(snapshot());if(state.undo.length>40)state.undo.shift();state.redo.length=0;state.dirty=true}
  function snapshot(){return JSON.stringify({title:state.title,bpm:state.bpm,markers:state.markers,tracks:state.tracks.map(t=>({...t,clips:t.clips.map(c=>({...c,peaks:undefined})),notes:t.notes.map(n=>({...n}))}))})}
  function restore(j){const o=JSON.parse(j);state.title=o.title;state.bpm=o.bpm;state.tracks=o.tracks;state.markers=o.markers||[];renderAll()}
  function undo(){if(!state.undo.length)return;state.redo.push(snapshot());restore(state.undo.pop())}
  function redo(){if(!state.redo.length)return;state.undo.push(snapshot());restore(state.redo.pop())}

  const MIDI_INST=[
    {id:'drums',name:'กลอง',color:'#e8a54b'},
    {id:'bass',name:'เบส',color:'#5b8def'},
    {id:'guitar',name:'กีตาร์',color:'#c97b5a'},
    {id:'keys',name:'คีย์บอร์ด',color:'#d4c35a'},
    {id:'pad',name:'แพด',color:'#9b8af0'},
    {id:'lead',name:'ลีด',color:'#d67bb8'},
    {id:'synth',name:'ซินธ์',color:'#45c4d4'}
  ];
  function instOf(tr){return MIDI_INST.find(x=>x.id===(tr&&tr.inst))||MIDI_INST[3]}
  function addAudioTrack(name,color){
    const t={id:uid(),type:'audio',name:name||('แทร็ก '+(state.tracks.length+1)),color:color||COLS[state.tracks.length%COLS.length],
      mute:false,solo:false,vol:100,pan:0,eq:{lo:0,mid:0,hi:0},rev:0,waveZoom:1,clips:[],notes:[]};
    state.tracks.push(t);return t;
  }
  function addMidiTrack(name,inst){
    const meta=MIDI_INST.find(x=>x.id===inst)||MIDI_INST[3];
    const t={id:uid(),type:'midi',name:name||('MIDI · '+meta.name),color:meta.color||COLS[state.tracks.length%COLS.length],
      mute:false,solo:false,vol:100,pan:0,eq:{lo:0,mid:0,hi:0},rev:0.15,waveZoom:1,clips:[],notes:[],inst:meta.id};
    state.tracks.push(t);return t;
  }
  // Ensure a MIDI track for an instrument exists and is selected (for drawing notes)
  function ensureMidiInst(instId){
    const meta=MIDI_INST.find(x=>x.id===instId)||MIDI_INST[3];
    let i=state.tracks.findIndex(t=>t.type==='midi'&&t.inst===meta.id);
    if(i<0){const t=addMidiTrack('MIDI · '+meta.name,meta.id);i=state.tracks.length-1;renderAll()}
    else if(state.tracks[i].inst!==meta.id)state.tracks[i].inst=meta.id;
    state.sel.track=i;state.tool='draw';syncTools();renderAll();
    return state.tracks[i];
  }
  function setTrackWaveZoom(i,delta){
    const tr=state.tracks[i];if(!tr)return;
    tr.waveZoom=clamp(+(tr.waveZoom||1)*(delta>0?1.35:1/1.35),0.5,8);
    renderArrange();renderTracks();
  }
  function setNomVol(v){
    v=clamp(+v||0,0,300);
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
  // Raw min/max peaks at a FIXED time resolution (PEAK_BPS bins per second ≥ max zoom px/s).
  // Data 1.0.29: no gain, no floor-zeroing, no 12000-bin cap — the old cap made long songs
  // blocky when zoomed and the 2.5% floor erased real (quiet) sound. Non-finite samples → 0.
  const PEAK_BPS=200;
  function peaksOf(buf){
    const L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L;
    const n=L.length,sr=buf.sampleRate||44100;
    const step=Math.max(1,Math.round(sr/PEAK_BPS)),nb=Math.max(1,Math.ceil(n/step));
    const out=new Float32Array(nb*2);
    for(let b=0,i=0;b<nb;b++,i+=step){
      let mn=0,mx=0;const e=Math.min(n,i+step);
      for(let j=i;j<e;j++){
        const v=(L[j]+R[j])*0.5;
        if(v<mn)mn=v;else if(v>mx)mx=v; // NaN fails both → ignored
      }
      out[b*2]=mn;out[b*2+1]=mx;
    }
    return out;
  }
  // Canvas backing-store guard: Safari blanks canvases > ~16.7M px, Chrome > 32767 px wide.
  function safeDpr(w,h){
    const d=devicePixelRatio||1;
    return Math.max(0.25,Math.min(d,32000/Math.max(1,w),Math.sqrt(16e6/Math.max(1,w*h))));
  }
  const WAVE_FLOOR=0.001; // −60 dB below the lane's own peak = true silence (flat)
  function peakAbsMax(pk){let p=0;for(let i=0;i<pk.length;i++){const v=pk[i]<0?-pk[i]:pk[i];if(v>p)p=v}return p}
  /** Per-pixel envelope (0..1): max |amp| over ALL bins under the pixel (no aliasing),
   *  sqrt-scaled vs the lane peak (−20 dB → 32%, −40 dB → 10%) so quiet-but-real sound
   *  stays visible; only true silence (< −60 dB) is flat. */
  function waveEnvelope(pk,u0,u1,w){
    const bins=pk.length>>1,env=new Float32Array(w);
    const ref=peakAbsMax(pk);if(!(ref>1e-6)||!bins)return {env,ref};
    for(let x=0;x<w;x++){
      let b0=Math.floor((u0+(u1-u0)*(x/w))*bins),b1=Math.floor((u0+(u1-u0)*((x+1)/w))*bins);
      b0=clamp(b0,0,bins-1);b1=clamp(Math.max(b1,b0+1),1,bins);
      let m=0;for(let b=b0;b<b1;b++){const a=-pk[b*2],c=pk[b*2+1];if(a>m)m=a;if(c>m)m=c}
      const r=m/ref;env[x]=r<WAVE_FLOOR?0:Math.sqrt(r)
    }
    return {env,ref};
  }
  // Mild peak-norm only when the WHOLE stem is quiet (not mid-song gaps)
  function peakNormLR(ch,target){
    if(!ch||!ch.L)return ch;
    target=target==null?0.75:target;
    const n=ch.L.length,R=ch.R&&ch.R.length===n?ch.R:ch.L;
    let peak=0;const step=Math.max(1,(n/250000)|0);
    for(let i=0;i<n;i+=step){
      const a=ch.L[i]<0?-ch.L[i]:ch.L[i],b=R[i]<0?-R[i]:R[i];
      if(a>peak)peak=a;if(b>peak)peak=b;
    }
    if(!(peak>1e-4)||peak>=0.22)return ch; // already usable, or near-empty
    const g=Math.min(target/peak,4);
    const oL=new Float32Array(n),oR=new Float32Array(n);
    for(let i=0;i<n;i++){oL[i]=clamp(ch.L[i]*g,-1,1);oR[i]=clamp(R[i]*g,-1,1)}
    return{L:oL,R:oR};
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
      by.bass={L,R};by.__bassSynth=true; // = 1.6 × low end of the mix → its share of the mix is 1/1.6
    }catch(e){}
  }
  function loadStemChannels({title,src,channels,sampleRate,mix}){
    mark();state.title=title||state.title;state.tracks=[];
    const by={};src.forEach((s,i)=>{by[s]=channels[i]});
    // 1.0.35: no synthetic bass any more (it was 1.6 × the low end of the WHOLE mix → kick drum + everything
    // low came back in the bass lane, and a muted kick stayed audible). The bass lane is the real AI output.
    // Data 1.0.29: no mix-complement gap-fill — it pasted the whole mix into every lane
    // (graphs looked like the mix, mix−stem data was wrong). Lanes now = real AI output.
    // Mild boost only when a stem is quiet end-to-end
    // 1.0.33 (t315u): stems are kept at their TRUE level. The old peak-normalise (up to ×4 on quiet stems) made
    // "mix − muted stem" subtract the wrong amount → drums/vocals stayed in (inverted) and the file sounded doubled.
    const sr=sampleRate||44100;
    // Keep original mix — mix-minus muted stems beats summing demucs parts for clean beds
    state.mixBuf=null;state.ghosts=[];
    try{
      if(mix&&mix.L){
        const R=mix.R&&mix.R.length===mix.L.length?mix.R:mix.L;
        state.mixBuf=bufFromLR(mix.L,R,sr);
      }
    }catch(e){state.mixBuf=null}
    // 1.0.31: the original mix is kept internally only (beat detection, mix−minus bed, export) — no 'เพลงเต็ม' track row
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
        t.clips.push({id:uid(),buf:id,start:0,offset:0,dur:b.duration,gain:1,peaks:peaksOf(b),name:row.key,mixScale:1}); // AI stems sum to the mix at unit gain
      }
    });
    renderAll();
  }

  /* ---------- แยกละเอียด: DrumSep v2 (กลอง) · UVR KARA 2 (ร้อง) ---------- */
  const FINE={
    drums:{
      kind:'drums',bytes:168050967,
      url:'https://huggingface.co/Acapellas/drumsep-v2-onnx/resolve/main/drumsep_v2_w10_f16w.onnx',
      title:'แยกกลองเป็น กระเดื่อง / สแนร์ / ทอม / ฉาบ?',
      note:'ฉาบ รวมไฮแฮต แครช และไรด์',
      fold:'kick',
      parts:[
        {key:'kick',name:'กระเดื่อง',color:'#e08a2a'},
        {key:'snare',name:'สแนร์',color:'#f0c36a'},
        {key:'toms',name:'ทอม',color:'#c97b5a'},
        {key:'cymbals',name:'ฉาบ',color:'#d4c35a',tip:'ฉาบ รวมไฮแฮต แครช และไรด์'}
      ]
    },
    vocals:{
      kind:'vocals',bytes:52786726,
      url:'https://huggingface.co/TheDailyOWO/splitwave-models/resolve/main/mdx_kara_2.onnx',
      title:'แยกเสียงร้องเป็น นำ / คอรัส?',
      note:'คุณภาพขึ้นกับเพลง',
      fold:'backing',
      parts:[
        {key:'lead',name:'นำ',color:'#d67bb8',tip:'คุณภาพขึ้นกับเพลง'},
        {key:'backing',name:'คอรัส',color:'#9b8af0',tip:'คุณภาพขึ้นกับเพลง'}
      ]
    }
  };
  const FINE_CHILD={kick:'drums',snare:'drums',toms:'drums',cymbals:'drums',lead:'vocals',backing:'vocals'};
  function isFineParent(tr){return !!(tr&&FINE[tr.stem]&&!tr.fineOf&&!state.tracks.some(x=>x.fineOf===tr.stem))}
  function foldResidual(parent,parts,foldKey){
    const n=parent.L.length,sL=new Float32Array(n),sR=new Float32Array(n);
    for(const p of parts){const L=p.L,R=p.R||L;for(let i=0;i<n;i++){sL[i]+=L[i]||0;sR[i]+=(R[i]||0)}}
    const t=parts.find(p=>p.key===foldKey)||parts[0];
    const TL=t.L,TR=t.R||t.L,PL=parent.L,PR=parent.R||parent.L;
    for(let i=0;i<n;i++){TL[i]+=PL[i]-sL[i];TR[i]+=PR[i]-sR[i]}
  }
  async function modelCached(url){try{const c=await caches.open('bp-ai-models-v4');return !!(await c.match(url))}catch(e){return false}}
  // 1.0.36 (t319u): one fine-split at a time (saves memory). Second click is queued;
  // each parent row shows its own status; the global #sAi line is labeled and never mixes two %.
  const fineState=Object.create(null); // stem -> {phase,line,row}
  const fineQueue=[];
  let fineRunning=false;
  function fineLabel(kind){return kind==='vocals'?'ร้อง':'กลอง'}
  function paintFineStatus(){
    const kinds=['drums','vocals'];
    const run=kinds.map(k=>fineState[k]).find(s=>s&&s.phase==='run');
    const q=kinds.filter(k=>fineState[k]&&fineState[k].phase==='queued').map(fineLabel);
    let line=run&&run.line||'';
    if(q.length)line=(line?line+' · ':'⏳ ')+q.join(' และ ')+'รอคิว';
    if(!line){const last=[...kinds].reverse().map(k=>fineState[k]).find(s=>s&&(s.phase==='done'||s.phase==='err'));if(last)line=last.line||''}
    if(line)ui.onFineProg?.(line); // never blank #sAi (6-stem / other status lives there too)
    const box=$('trackHeads');if(!box)return;
    box.querySelectorAll('.thead[data-stem]').forEach(el=>{
      const st=fineState[el.dataset.stem],btn=el.querySelector('.tb.fine');
      let slot=el.querySelector('.fine-prog');
      if(!st||st.phase==='done'||st.phase==='err'){if(slot)slot.remove();if(btn)btn.hidden=false;return}
      if(!slot){slot=document.createElement('span');slot.className='fine-prog';if(btn){btn.hidden=true;btn.after(slot)}else el.querySelector('.tn')?.appendChild(slot)}
      else if(btn)btn.hidden=true;
      slot.textContent=st.phase==='queued'?'รอคิว':(st.row||'กำลังแยก…');
      slot.title=st.line||'';
    });
  }
  function setFineStatus(stem,phase,line,row){fineState[stem]={phase,line,row:row||''};paintFineStatus()}
  async function fineSplit(trackIdx){
    const tr=state.tracks[trackIdx];if(!isFineParent(tr))return;
    if(fineState[tr.stem]&&(fineState[tr.stem].phase==='queued'||fineState[tr.stem].phase==='run'))return;
    const spec=FINE[tr.stem],clip=tr.clips&&tr.clips[0],buf=clip&&state.buffers.get(clip.buf);
    if(!buf){ui.toast?.('ไม่มีเสียงในเลนนี้');return}
    const sec=buf.duration||clip.dur||0,phone=!!(ui.isPhone&&ui.isPhone()),cached=await modelCached(spec.url);
    const lo=Math.max(1,Math.round(sec/120)||1),hi=Math.max(lo+1,Math.round(sec/40)||2);
    const lines=[spec.title,
      cached?('โมเดลพร้อมแล้ว · แยกในเครื่องนี้ เพลง ~'+Math.round(sec)+' วินาที ประมาณ '+lo+'–'+hi+' นาที (ขึ้นกับเครื่อง)'):('ครั้งแรกจะโหลดโมเดล '+(spec.bytes/1e6|0)+' MB จาก Hugging Face แล้วแยกในเครื่อง · ประมาณ '+lo+'–'+hi+' นาที (ขึ้นกับเครื่อง)'),
      spec.note+(spec.kind==='vocals'?'':''),
      phone?'บนมือถืออาจช้าหรือหน่วยความจำไม่พอ — แนะนำใช้คอมพิวเตอร์':'โมเดล MIT ทำงานในเบราว์เซอร์ เสียงไม่ออกเครื่อง'];
    if(!confirm(lines.join('\n\n')))return;
    if(state.playing)stopPlay();
    const sr=buf.sampleRate||44100;
    const pL=Float32Array.from(buf.getChannelData(0));
    const pR=buf.numberOfChannels>1?Float32Array.from(buf.getChannelData(1)):pL.slice();
    fineQueue.push({
      stem:tr.stem,id:tr.id,spec,clip,buf,sr,
      parent:{L:pL.slice(),R:pR.slice()},wL:pL.slice(),wR:pR.slice(),
      start:clip.start||0,mute:!!tr.mute,vol:tr.vol||100,
      parentScale:clip.mixScale!=null?+clip.mixScale:1
    });
    setFineStatus(tr.stem,'queued','⏳ '+fineLabel(tr.stem)+'รอคิว','รอคิว');
    pumpFineQueue();
  }
  async function pumpFineQueue(){
    if(fineRunning)return;
    const job=fineQueue.shift();if(!job)return;
    fineRunning=true;
    try{await runFineJob(job)}
    finally{fineRunning=false;pumpFineQueue()}
  }
  async function runFineJob(job){
    const {spec,clip,buf,sr,parent,wL,wR,start,mute,vol,parentScale}=job;
    const lab=fineLabel(job.stem);
    const tr=state.tracks.find(t=>t.id===job.id);
    if(!tr||!isFineParent(tr)){setFineStatus(job.stem,'err','❌ แยก'+lab+'ไม่สำเร็จ — ไม่มีเลนนี้','');return}
    const prog=(line,row)=>setFineStatus(job.stem,'run',line,row);
    prog('⏳ แยก'+lab+'…','กำลังแยก…');
    const w=new Worker('stems-fine-worker.js?v=1.0.36');
    let stems;
    try{
      stems=await new Promise((ok,no)=>{
        const got=[];
        w.onmessage=({data:m})=>{
          if(m.t==='dl')prog('⏳ โหลดโมเดลแยก'+lab+' '+(m.p*100|0)+'%','โหลด '+(m.p*100|0)+'%');
          else if(m.t==='ready'||m.t==='sepStart')prog('⏳ กำลังแยก'+lab+'…','กำลังแยก…');
          else if(m.t==='prog')prog('⏳ แยก'+lab+' '+(m.p*100|0)+'%','แยก '+(m.p*100|0)+'%');
          else if(m.t==='log')try{console.warn(m.m)}catch(e){}
          else if(m.t==='stem')got[m.i]={key:m.name,L:m.L,R:m.R};
          else if(m.t==='err'){try{w.terminate()}catch(e){};no(new Error(m.m))}
          else if(m.t==='done'){try{w.terminate()}catch(e){};ok(got)}
        };
        w.onerror=e=>{try{w.terminate()}catch(err){};no(e.error||e)};
        const useGpu=!!(ui.gpuF16&&ui.gpuF16());
        w.postMessage({kind:spec.kind,L:wL,R:wR,sr,opt:{wasmOnly:!useGpu,eps:useGpu?['webgpu','wasm']:['wasm']}},[wL.buffer,wR.buffer]);
      });
    }catch(e){setFineStatus(job.stem,'err','❌ แยก'+lab+'ไม่สำเร็จ: '+(e.message||e),'');ui.toast?.('❌ แยกละเอียดไม่สำเร็จ: '+(e.message||e));return}
    if(!stems||stems.filter(Boolean).length!==spec.parts.length){setFineStatus(job.stem,'err','❌ แยก'+lab+'ไม่ครบสเต็ม','');ui.toast?.('แยกไม่ครบสเต็ม');return}
    const parts=spec.parts.map(meta=>{
      const g=stems.find(x=>x&&x.key===meta.key);if(!g)throw new Error('missing '+meta.key);
      return{key:meta.key,L:g.L,R:g.R};
    });
    foldResidual(parent,parts,spec.fold);
    mark();
    const now=state.tracks.find(t=>t.id===job.id);if(!now){setFineStatus(job.stem,'err','❌ แยก'+lab+'ไม่สำเร็จ — ไม่มีเลนนี้','');return}
    const idx=state.tracks.indexOf(now);
    state.tracks.splice(idx,1);
    parts.forEach((p,i)=>{
      const meta=spec.parts[i];
      const t={id:uid(),type:'audio',name:meta.name,color:meta.color||now.color,
        mute,solo:false,vol,pan:now.pan||0,eq:{lo:0,mid:0,hi:0},rev:0,waveZoom:now.waveZoom||1,clips:[],notes:[],
        stem:meta.key,fineOf:spec.kind,fineTip:meta.tip||spec.note||''};
      state.tracks.splice(idx+i,0,t);
      const b=bufFromLR(p.L,p.R,sr);const id=putBuf(b);
      t.clips.push({id:uid(),buf:id,start,offset:0,dur:b.duration,gain:1,peaks:peaksOf(b),name:meta.key,mixScale:parentScale});
    });
    state.sel.track=idx;state.dirty=true;renderAll();
    const names=spec.parts.map(p=>p.name).join(' / ');
    setFineStatus(job.stem,'done','✅ แยก'+lab+'แล้ว — '+names,'');
    ui.toast?.('แยกละเอียดแล้ว · '+names);
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
    if(state._watch){clearInterval(state._watch);state._watch=null}
    if(state.playing)state.offset=clamp(playheadT(),0,dur());
    state._scrubUI=null;
    if(state._pull){state._pull.alive=false;state._pull=null}
    for(const n of state.nodes){try{n.onended=null;n.onaudioprocess=null;n.stop?.()}catch(e){}try{n.disconnect?.()}catch(e){}}
    for(const x of state.fx){try{x.nodes.forEach(n=>n.disconnect())}catch(e){}}
    try{state._meter?.disconnect()}catch(e){}
    state.nodes=[];state.fx=[];state.live=null;state.playing=false;state.playOnly=null;
    state._midi=null;state._metroJob=null;state._sched=null;
    state._meter=null;state._meterTd=null;state._silentMs=0;state._master=null;
    ui.onTransport?.(state);
    // Recipe/BPM changes while playing were deferred — apply now
    if(state._guidesDirty){
      state._guidesDirty=false;
      try{
        const ci=preCi();
        const feel=(typeof document!=='undefined'&&document.getElementById('rFeel')?.value)||'normal';
        const flourish=!!(typeof document!=='undefined'&&document.getElementById('rFlourish')?.checked);
        syncGuideTracks({bpm:state.bpm,t0:state.t0||0,ci,feel,flourish,metroOn:!!state.metro,preview:true});
      }catch(e){}
    }
  }
  // Live mute/solo/vol — pull mixer reads tr.mute/vol/solo each quantum (no GainNode lag).
  function applyLiveMix(){
    scheduleHeard();
    if(state.playing&&state._pull&&state._pull.rewind)state._pull.rewind(); // 1.0.38: hear the change now, not after the look-ahead
    // MIDI chains still use muteG if present
    if(!state.playing||!state.live)return;
    const a=ac(),t=a.currentTime;
    const anySolo=state.tracks.some(x=>x.solo);
    for(const tr of state.tracks){
      const L=state.live.get(tr.id);if(!L||!L.muteG)continue;
      const silent=tr.mute||(anySolo&&!tr.solo);
      const vol=Math.max(0,(tr.vol||0)/100);
      try{
        L.volG.gain.cancelScheduledValues(t);
        L.volG.gain.setValueAtTime(1,t);
        L.muteG.gain.cancelScheduledValues(t);
        L.muteG.gain.setValueAtTime(silent?0:vol,t);
      }catch(e){}
    }
  }

  // Playback (Data): never use AudioBufferSourceNode for long clips (Chromium ~60–90s death).
  // 1.0.19 used ScriptProcessor(…,0,2) — Chrome often STOPS calling onaudioprocess after a few
  // seconds when inputCount=0 (user saw music die ~0:07 while playhead kept walking).
  // Fix: one mixer SP with ConstantSource keepalive (inputCount≥1) + playhead driven by
  // the mixer’s frame count (not ctx.currentTime alone).
  const RESEED_EVERY=120;
  function clipAbsDur(clip,buf){
    if(!buf)return Math.max(0.001,clip.dur||0);
    const d=Math.max(clip.dur||0, buf.duration-(clip.offset||0));
    if((clip.dur||0)<buf.duration-0.05)clip.dur=buf.duration-(clip.offset||0);
    return Math.max(0.001,d);
  }
  function expectedRmsAt(playT){
    // Mix-minus bed: expect energy from original mix (stems may be quiet mid-song)
    if(state.mixBuf){
      let mixStart=0;
      for(const tr of state.tracks){
        if(tr.type!=='audio'||!tr.stem||tr.stem==='click'||tr.stem==='countin'||tr.stem==='mix')continue;
        if(tr.clips[0]){mixStart=tr.clips[0].start||0;break}
      }
      const local=playT-mixStart;
      if(local>=0&&local<state.mixBuf.duration){
        const ch=state.mixBuf.getChannelData(0),sr=state.mixBuf.sampleRate;
        const i0=Math.floor(local*sr);
        if(i0>=0&&i0<ch.length){
          let s=0,cnt=0,n=Math.min(ch.length,i0+2048);
          for(let i=i0;i<n;i+=8){const v=ch[i];s+=v*v;cnt++}
          if(cnt)return Math.sqrt(s/cnt);
        }
      }
    }
    let best=0;
    for(const tr of state.tracks){
      if(tr.type!=='audio'||tr.mute||tr.stem==='mix')continue;
      for(const c of tr.clips){
        const buf=state.buffers.get(c.buf);if(!buf)continue;
        const local=playT-c.start;
        if(local<0||local>=(c.dur||buf.duration))continue;
        const off=(c.offset||0)+local;
        const sr=buf.sampleRate, i0=Math.floor(off*sr);
        if(i0<0||i0>=buf.length)continue;
        const ch=buf.getChannelData(0);const n=Math.min(ch.length,i0+2048);
        let s=0,cnt=0;for(let i=i0;i<n;i+=8){const v=ch[i];s+=v*v;cnt++}
        if(cnt)best=Math.max(best,Math.sqrt(s/cnt));
      }
    }
    return best;
  }
  function playheadT(){
    // While user drags the red line, freeze displayed/seek time to the scrub target
    if(state._scrubUI!=null)return state._scrubUI;
    if(state.playing&&state._pull&&state._pull.alive){
      if(state._pull.playedT)return state._pull.playedT(); // 1.0.38 worklet: what is audible now, not what is mixed ahead
      return state._pull.from+((state._pull.frame-state._pull.f0)/ac().sampleRate);
    }
    if(state.playing)return ac().currentTime-state.playT0+state.offset;
    return state.offset;
  }
  // Sample helper for pull mixer
  /* ---------- 1.0.35: clean mute (t317u) — "what you hear" render from the original mix by soft spectral masks ---------- */
  function musicTracks(){return state.tracks.filter(t=>t.type==='audio'&&t.stem&&t.stem!=='click'&&t.stem!=='countin'&&t.stem!=='mix'&&t.clips.length).concat(ghostTracks())}
  /** 1.0.38 (t326u): an AI lane deleted with ✕ is still inside the original mix that every bed starts from — it used to
   *  keep playing at full level and could never be muted again (M on every lane left it on). Its stem is kept as a
   *  hidden, permanently silent lane ("ghost") so preview, ทำดาต้า and mixdown subtract it. Undo brings the lane back. */
  function ghostTracks(){return (state.ghosts||[]).filter(g=>g&&g.clips&&g.clips.length&&!state.tracks.some(t=>t.id===g.id)&&g.clips.every(c=>state.buffers.has(c.buf)))}
  /** all stems line up 1:1 with the mix (fresh AI split / restored project) → the mask render applies */
  function canUnmix(){
    const mb=state.mixBuf;if(!mb)return false;const mt=musicTracks();if(!mt.length)return false;
    const st0=mt[0].clips[0].start||0;
    return mt.every(t=>t.clips.length===1&&Math.abs((t.clips[0].start||0)-st0)<1e-6&&!(+t.clips[0].offset>0)&&(()=>{const b=state.buffers.get(t.clips[0].buf);return b&&b.sampleRate===mb.sampleRate&&Math.abs(b.length-mb.length)<=2}));
  }
  const eqKey=e=>eqFlat(e)?'':[+e.lo||0,+e.mid||0,+e.hi||0].join(',');
  /** 1.0.38 ✂ ตัดแรงสุด: one switch — every muted lane (incl. fine sub-lanes) gets the full 24 dB extra cut; the lanes' own
   *  cut values stay untouched underneath (switch off = back to them). Lanes that are heard are never affected. */
  const MAXCUT={lo:24,mid:24,hi:24};
  function cutOf(t){return state.maxCut&&heardGain(t,t.clips[0])<0.25?MAXCUT:t.cut}
  function setMaxCut(on){state.maxCut=!!on;state.dirty=true;applyLiveMix();renderTracks();return state.maxCut}
  /** 1.0.43: 🧹 สะอาด — ✂max + stronger residual mask + post spectral gate (cuts hiss / soft AI bleed) */
  function setDeepClean(on){
    state.deepClean=!!on;
    if(state.deepClean){state.maxCut=true;Object.assign(UNMIX,UNMIX_CLEAN)}
    else{Object.assign(UNMIX,UNMIX_DEFAULT)}
    state._heard=null;state.dirty=true;applyLiveMix();renderTracks();scheduleHeard();return state.deepClean}
  function heardKey(){
    const mt=musicTracks();return mt.map(t=>t.id+':'+heardGain(t,t.clips[0]).toFixed(3)+':'+(t.clips[0].mixScale!=null?(+t.clips[0].mixScale).toFixed(4):'1')+':'+t.clips[0].buf+':'+eqKey(t.eq)+':'+eqKey(cutOf(t))).join('|')+'#'+(state.mixBuf?state.mixBuf.length:0)+'#'+[UNMIX.GAMMA,UNMIX.FLOOR,UNMIX.TF,UNMIX.FF,UNMIX.RESID,UNMIX.SOFT,UNMIX.SOFT_FLOOR,UNMIX.SOFT_EXP,state.deepClean?1:0].join('/');
  }
  /** the clean render is needed when a lane is muted / below 25 % (extra cleaning) or an audible lane has EQ (1.0.37);
   *  otherwise mix + (g−1)·stem is exact */
  /** 1.0.43: 🧹 สะอาด always runs the heard pipeline (even with every lane open) so denoiseBed can scrub hiss */
  function needsHeard(){return canUnmix()&&(!!state.deepClean||musicTracks().some(t=>{const g=heardGain(t,t.clips[0]);return g<0.25-1e-6||(g>0&&!eqFlat(t.eq))}))}
  function heardReady(){const h=state._heard;return needsHeard()&&h&&h.buf&&h.key===heardKey()?h.buf:null}
  /** what the live mixer may crossfade to: the (possibly still rendering) target of the current state */
  function heardLive(){const h=state._heard;return h&&h.T&&h.key===state._wantKey?h:null}
  /** render (or reuse) the clean bed; resolves the finished AudioBuffer (null when not needed / cancelled).
   *  Renders from the playhead first, so playback crossfades into it within a moment (1.0.37). */
  async function ensureHeard(){
    if(!needsHeard())return null;
    const key=heardKey();state._wantKey=key;
    if(state._heard&&state._heard.key===key){if(state._heard.buf)return state._heard.buf;if(state._heard.p)return state._heard.p}
    const mb=state.mixBuf,mt=musicTracks(),n=mb.length;
    const job={key,buf:null,p:null,T:{L:new Float32Array(n),R:new Float32Array(n),ready:new Uint8Array(Math.ceil(n/UNMIX.H)),H:UNMIX.H,n},start:mt[0].clips[0].start||0,sr:mb.sampleRate};
    state._heard=job;
    const from=state.playing?Math.max(0,playheadT()-job.start+0.3):0; // a bit ahead of the playhead
    job.p=(async()=>{
      ui.onUnmix?.(0);
      const out=await renderHeard({mix:{L:mb.getChannelData(0),R:mb.numberOfChannels>1?mb.getChannelData(1):mb.getChannelData(0)},sr:mb.sampleRate,startSec:from,target:job.T,
        stems:mt.map(t=>{const b=state.buffers.get(t.clips[0].buf);return{L:b.getChannelData(0),R:b.numberOfChannels>1?b.getChannelData(1):b.getChannelData(0),g:heardGain(t,t.clips[0]),scale:t.clips[0].mixScale!=null?+t.clips[0].mixScale:1,eq:t.eq,cut:cutOf(t)}}),
        onProgress:p=>{if(state._heard===job)ui.onUnmix?.(Math.min(0.85,p*0.85))},cancelled:()=>state._heard!==job});
      if(!out||state._heard!==job){return null}
      let L=out.L,R=out.R;
      if(state.deepClean){
        const d=await denoiseBed(L,R,mb.sampleRate,{strength:0.88,floor:0.05,hfBoost:2.2,
          onProgress:p=>{if(state._heard===job)ui.onUnmix?.(0.85+0.15*p)},cancelled:()=>state._heard!==job});
        if(!d||state._heard!==job)return null;L=d.L;R=d.R;
      }
      const b=ac().createBuffer(2,n,mb.sampleRate);b.copyToChannel(L,0);b.copyToChannel(R,1);
      job.buf=b;ui.onUnmix?.(1);
      return b;
    })();
    return job.p;
  }
  function scheduleHeard(){
    // 1.0.37: no reseed — the live mixer crossfades (≈120 ms) back to mix − stem at once and into the new render as it arrives
    state._wantKey=needsHeard()?heardKey():null;
    clearTimeout(state._heardT);state._heardT=setTimeout(()=>{if(needsHeard())ensureHeard().catch(()=>{});else ui.onUnmix?.(-1)},200)}
  /** 1.0.33: the ONE rule for what is heard (preview, ทำดาต้า, มิกซ์ดาวน์): gain of a music stem, 0 = silent */
  function heardGain(tr,c){const anySolo=state.tracks.some(t=>t.solo&&t.type==='audio'&&t.stem!=='click'&&t.stem!=='countin');
    if(tr.mute||(anySolo&&!tr.solo))return 0;return Math.max(0,(tr.vol!=null?+tr.vol:100)/100)*((c&&c.gain)||1)}
  function sampleJobAt(cl,t){
    const local=t-cl.start;
    if(local<0||local>=cl.dur)return null;
    const idx=(cl.offset+local)*cl.sr;
    const i0=idx|0;
    if(i0<0||i0>=cl.len)return null;
    const f=idx-i0;
    const s0=cl.L[i0],s1=i0+1<cl.len?cl.L[i0+1]:s0;
    const r0=cl.R[i0],r1=i0+1<cl.len?cl.R[i0+1]:r0;
    return[(s0+(s1-s0)*f),(r0+(r1-r0)*f)];
  }
  // One mixer — when mixBuf exists (after AI), play like MUSE: full mix − muted stems.
  // Never sum broken demucs lanes (that caused mid-song silence / flat graphs feeling "dead").
  function attachPullMixer(playFrom,masterBus){
    const a=ac();
    const jobs=[];
    const mixMode=!!state.mixBuf;
    // Bed: original mix (MUSE-style continuous song)
    if(mixMode){
      const buf=state.mixBuf;
      const L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L;
      // Align with first music clip start (count-in offset)
      let mixStart=0;
      for(const tr of state.tracks){
        if(tr.type!=='audio'||!tr.stem||tr.stem==='click'||tr.stem==='countin'||tr.stem==='mix')continue;
        if(tr.clips[0]){mixStart=tr.clips[0].start||0;break}
      }
      jobs.push({
        tr:{mute:false,solo:false,vol:100,pan:0,stem:'__mixbed'},
        L,R,sr:buf.sampleRate,start:mixStart,offset:0,dur:buf.duration,
        gain:1,len:L.length,guide:false,role:'bed'
      });
    }
    for(const tr of state.tracks){
      if(tr.type!=='audio')continue;
      // Skip mix lane (display-only) — bed already uses mixBuf
      if(tr.stem==='mix')continue;
      // In mix-minus mode skip unmuted demucs stems as additive sources (they'd double/gap)
      const isGuide=tr.stem==='click'||tr.stem==='countin';
      for(const c of tr.clips||[]){
        const buf=state.buffers.get(c.buf);if(!buf)continue;
        const clipDur=clipAbsDur(c,buf);
        if(c.start+clipDur<=playFrom+1e-4)continue;
        const L=buf.getChannelData(0);
        const R=buf.numberOfChannels>1?buf.getChannelData(1):L;
        let role='add';
        if(mixMode&&!isGuide)role='sub'; // subtract when this stem should be silent
        if(!mixMode)role='add';
        jobs.push({
          tr,L,R,sr:buf.sampleRate,start:c.start,offset:c.offset||0,dur:clipDur,
          gain:c.gain||1,len:L.length,guide:isGuide,role,clip:c,scale:c.mixScale!=null?+c.mixScale:1
        });
      }
    }
    if(mixMode)for(const tr of ghostTracks())for(const c of tr.clips){ // 1.0.38: deleted AI lanes stay out of the bed
      const buf=state.buffers.get(c.buf);if(!buf)continue;const L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L;
      jobs.push({tr,L,R,sr:buf.sampleRate,start:c.start,offset:c.offset||0,dur:clipAbsDur(c,buf),gain:c.gain||1,len:L.length,guide:false,role:'sub',clip:c,scale:c.mixScale!=null?+c.mixScale:1});
    }
    const keep=a.createConstantSource();keep.offset.value=0;
    try{keep.start()}catch(e){}
    // 1.0.38: AudioWorklet output (mix ahead on the page, play on the audio thread) — ScriptProcessor fallback
    const useWl=!!(state._wl&&state._wl.ready&&wlWanted());
    const sp=useWl?null:a.createScriptProcessor(2048,1,2);
    const pull={from:playFrom,frame:0,f0:0,alive:true,sp,keep,mixMode,hw:0,hj:null,wl:null};
    state._pull=pull;
    const lrOn=()=>!!state.listenLR;
    const nomRight=()=>(state.nomSide||'R')!=='L';
    const mixBlock=(oL,oR)=>{
      const ctxSr=a.sampleRate,N=oL.length;
      const anySolo=state.tracks.some(t=>t.solo);
      const split=lrOn();
      const musicIsL=nomRight();
      const base=pull.from-pull.f0/ctxSr; // stream frame f0 = song time pull.from (seek while playing re-bases)
      // 1.0.33 nom too quiet: a 13 ms click summed onto a mastered song was squashed by the soft limiter
      // (music already ≈ full scale). Preview only: boost the guide and make headroom by dipping the
      // music bed while the nom is audible. Export is mastered separately (music −11 LUFS / nom −0.5 dBFS).
      for(const c of jobs)if(c.role==='sub')c._g=heardGain(c.tr,c.clip);
      // 1.0.37: clean render overlay — music = (1−w)·(mix + Σ(g−1)·stem) + w·clean, w ramps ≈120 ms (no clicks, no reseed)
      const hl=mixMode?heardLive():null;
      if(hl&&(!pull.hj||(pull.hj.T!==hl.T&&pull.hw<=0)))pull.hj={T:hl.T,job:{L:hl.T.L,R:hl.T.R,sr:hl.sr,start:hl.start,offset:0,dur:hl.T.n/hl.sr,len:hl.T.n}}; // a new render takes over only after the old one faded out
      const hj=pull.hj,hOn=!!(hl&&hj&&hj.T===hl.T),hStep=1/(0.12*ctxSr);const gStep=1/(0.03*ctxSr);
      const nomOn=jobs.some(c=>c.guide&&!c.tr.mute&&(c.tr.vol||0)>0&&!(anySolo&&!c.tr.solo));
      const nb=nomOn?NOM_PREVIEW_BOOST:1,dk=nomOn&&!split?NOM_PREVIEW_DUCK:1;
      for(let i=0;i<N;i++){
        const t=base+(pull.frame+i)/ctxSr;
        let mL=0,mR=0,gL=0,gR=0;
        for(let j=0;j<jobs.length;j++){
          const cl=jobs[j],tr=cl.tr;
          const sm=sampleJobAt(cl,t);if(!sm)continue;
          let [sL,sR]=sm;
          if(cl.role==='bed'){
            // Always include bed; stem mutes handled via subtract jobs
            mL+=sL;mR+=sR;
            continue;
          }
          if(cl.guide){
            const silent=tr.mute||(anySolo&&!tr.solo);
            if(silent)continue;
            const vol=Math.max(0,(tr.vol||0)/100)*(cl.gain||1);
            const pan=clamp(tr.pan||0,-1,1);
            const pl=Math.cos((pan+1)*Math.PI/4),pr=Math.sin((pan+1)*Math.PI/4);
            const xL=sL*vol*pl,xR=sR*vol*pr;
            gL+=xL;gR+=xR;
            continue;
          }
          if(cl.role==='sub'){
            // 1.0.33: bed = mix + Σ (heard gain − 1)·(stem at its true level) — mute = 0, solo, volume all exact
            // 1.0.37: gain glides ≈30 ms (M/S/fader while playing → no click)
            const tg=(cl._g!=null?cl._g:heardGain(tr,cl.clip));if(cl._cur==null)cl._cur=tg;
            if(cl._cur!==tg)cl._cur+=tg>cl._cur?Math.min(gStep,tg-cl._cur):-Math.min(gStep,cl._cur-tg);
            const d=cl._cur-1;
            if(d>-1e-6&&d<1e-6)continue;
            mL+=sL*d*cl.scale;mR+=sR*d*cl.scale;
            continue;
          }
          // Legacy sum mode (no mixBuf)
          const silent=tr.mute||(anySolo&&!tr.solo);
          if(silent)continue;
          const vol=Math.max(0,(tr.vol||0)/100)*(cl.gain||1);
          const pan=clamp(tr.pan||0,-1,1);
          const pl=Math.cos((pan+1)*Math.PI/4),pr=Math.sin((pan+1)*Math.PI/4);
          mL+=sL*vol*pl;mR+=sR*vol*pr;
        }
        if(hj&&(hOn||pull.hw>0)){
          let tgt=0,hs=null;const li=((t-hj.job.start)*hj.job.sr)|0,rdy=li>=0&&li+1<hj.T.n&&hj.T.ready[(li/hj.T.H)|0]&&hj.T.ready[((li+1)/hj.T.H)|0];
          // fade in only while ≈150 ms ahead is rendered too → if the playhead catches up with a slow render the overlay has already faded out (no jump)
          const la=Math.min(hj.T.n-1,li+((0.15*hj.job.sr)|0));if(hOn&&rdy&&(la<=li+1||hj.T.ready[(la/hj.T.H)|0]))tgt=1;
          pull.hw+=tgt>pull.hw?Math.min(hStep,tgt-pull.hw):-Math.min(hStep,pull.hw-tgt);
          if(pull.hw>0&&rdy&&(hs=sampleJobAt(hj.job,t))){const w=pull.hw;mL=mL*(1-w)+hs[0]*w;mR=mR*(1-w)+hs[1]*w}
          if(!hOn&&pull.hw<=0)pull.hj=null;
        }
        if(split){
          const music=(mL+mR)*0.707,guide=(gL+gR)*0.707; // nom alone on its side is already full-scale
          if(musicIsL){oL[i]=softLimit(music);oR[i]=softLimit(guide)}
          else{oL[i]=softLimit(guide);oR[i]=softLimit(music)}
        }else{oL[i]=softLimit(mL*dk+gL*nb);oR[i]=softLimit(mR*dk+gR*nb)} // 1.0.32: music+nom summed to ~2.0 → hard clipping at the speaker
      }
      pull.frame+=N;
    };
    if(!useWl){
      sp.onaudioprocess=e=>{
        if(!state.playing||!pull.alive){pull.alive=false;return}
        const oL=e.outputBuffer.getChannelData(0),oR=e.outputBuffer.getChannelData(1);
        oL.fill(0);oR.fill(0);mixBlock(oL,oR);
      };
      sp.connect(masterBus);
      state.nodes.push(sp,keep);
      return;
    }
    const node=new AudioWorkletNode(a,'ssd-out',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
    const sr=a.sampleRate,CH=1024,LOOK=Math.round(0.5*sr);
    const W=pull.wl={node,played:0,ct:a.currentTime,under:0,cuts:0};
    const pump=()=>{
      if(!state.playing||!pull.alive)return;
      const est=W.played+Math.max(0,Math.round((a.currentTime-W.ct)*sr));
      let k=0;
      while(pull.frame<est+LOOK&&k++<64){
        const f0=pull.frame,L=new Float32Array(CH),R=new Float32Array(CH);
        mixBlock(L,R);node.port.postMessage({t:'chunk',f0,L,R},[L.buffer,R.buffer]);
      }
    };
    node.port.onmessage=e=>{const m=e.data;if(m&&m.t==='pos'){W.played=m.p;W.ct=m.ct;W.under=m.under;pump()}};
    /** re-mix from ≈30 ms ahead of what is playing now (mute/solo/vol/EQ/seek) — the queued look-ahead is dropped */
    pull.rewind=(newFrom)=>{
      if(!pull.alive)return;
      const F=W.played+Math.max(0,Math.round((a.currentTime-W.ct)*sr))+Math.round(0.03*sr);
      if(F>=pull.frame&&newFrom==null)return;
      node.port.postMessage({t:'cut',from:F});W.cuts++;
      if(newFrom!=null){pull.from=newFrom;pull.f0=F}
      pull.frame=Math.max(0,F);pump();
    };
    pull.playedT=()=>{const p=W.played+Math.max(0,(a.currentTime-W.ct)*sr);return pull.from+(Math.min(p,pull.frame)-pull.f0)/sr};
    pump();
    node.connect(masterBus);
    state.nodes.push({stop(){try{node.port.postMessage({t:'stop'})}catch(e){}},disconnect(){try{node.disconnect()}catch(e){}}},keep);
  }
  /* 1.0.38: load the output worklet once (AudioContext may start suspended — fine); unavailable → ScriptProcessor path */
  function wlWanted(){try{return localStorage.getItem('ssd-mixer')!=='sp'}catch(e){return true}}
  function warmWorklet(){
    try{
      if(state._wl)return state._wl.p;const a=ac();
      if(!a.audioWorklet||typeof AudioWorkletNode==='undefined'){state._wl={ready:false,p:Promise.resolve(false)};return state._wl.p}
      const w=state._wl={ready:false,p:null};
      w.p=a.audioWorklet.addModule(new URL('./data-mixer-worklet.js?v=1.0.38',import.meta.url).href).then(()=>(w.ready=true)).catch(e=>{w.err=String(e);return false});
      return w.p;
    }catch(e){state._wl={ready:false,p:Promise.resolve(false),err:String(e)};return state._wl.p}
  }
  function softReseed(at){
    if(!state.playing||state._reseeding)return;
    state._reseeding=true;
    try{
      cancelAnimationFrame(state._raf);
      if(state._watch){clearInterval(state._watch);state._watch=null}
      if(state._pull)state._pull.alive=false;
      for(const n of state.nodes){try{n.onended=null;n.stop?.();n.onaudioprocess=null}catch(e){}try{n.disconnect?.()}catch(e){}}
      for(const x of state.fx){try{x.nodes.forEach(n=>n.disconnect())}catch(e){}}
      state.nodes=[];state.fx=[];state.live=null;state._pull=null;
      state._midi=null;state._metroJob=null;state._sched=null;
      state.playing=false;
      startPlay(at,{reseed:true});
    }finally{state._reseeding=false}
  }
  function watchAudioHealth(){
    if(!state.playing||state._reseeding)return;
    const a=ac();
    if(state._reseedGuard && a.currentTime<state._reseedGuard)return;
    const playT=playheadT();
    if(playT<1||playT>=dur()-0.5)return;
    // If mixer stopped advancing while clock would still move → force reseed
    if(state._pull&&!state._pull.alive){softReseed(playT);return}
    if(!state._pull?.wl&&playT-(state._lastReseed||0)>=RESEED_EVERY){softReseed(playT);return} // 1.0.38: the worklet path needs no periodic restart
    const an=state._meter;
    if(!an||!state._meterTd)return;
    an.getByteTimeDomainData(state._meterTd);
    let peak=0;const td=state._meterTd;
    for(let i=0;i<td.length;i++){const v=td[i]-128;if(v>peak)peak=v;else if(-v>peak)peak=-v}
    if(peak>=3){state._silentMs=0;return}
    const expect=expectedRmsAt(playT);
    if(expect<0.01){state._silentMs=0;return}
    state._silentMs=(state._silentMs||0)+250;
    if(state._silentMs>=600){state._silentMs=0;softReseed(playT)}
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
    const playT=playheadT();
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
        const at=Math.max(t0,a.currentTime+0.005);
        try{voiceNote(chain.input,n.n,durN,at,job.tr.inst||'keys',n.v||0.9)}catch(e){}
        job.i++;
      }
    }
  }
  // Simple built-in instrument voices (no sample pack needed)
  function voiceNote(dest,midiN,durN,at,inst,vel){
    const a=ac();vel=clamp(vel==null?0.9:+vel,0,1.5);inst=inst||'keys';
    const start=Math.max(at,a.currentTime+0.002);
    const stop=start+Math.max(0.04,durN);
    if(inst==='drums'){
      const kind=midiN<42?'kick':midiN<50?'snare':midiN<60?'tom':'hat';
      if(kind==='kick'){
        const o=a.createOscillator(),g=a.createGain();
        o.frequency.setValueAtTime(140,start);o.frequency.exponentialRampToValueAtTime(40,start+0.12);
        g.gain.setValueAtTime(0.0001,start);g.gain.exponentialRampToValueAtTime(0.9*vel,start+0.005);g.gain.exponentialRampToValueAtTime(0.0001,start+0.28);
        o.connect(g);g.connect(dest);o.start(start);o.stop(start+0.3);state.nodes.push(o);
      }else if(kind==='snare'){
        const len=Math.floor(a.sampleRate*0.2),buf=a.createBuffer(1,len,a.sampleRate),d=buf.getChannelData(0);
        for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(len*0.25));
        const src=a.createBufferSource();src.buffer=buf;const g=a.createGain(),bp=a.createBiquadFilter();
        bp.type='bandpass';bp.frequency.value=1800;bp.Q.value=0.8;
        g.gain.setValueAtTime(0.55*vel,start);g.gain.exponentialRampToValueAtTime(0.0001,start+0.18);
        src.connect(bp);bp.connect(g);g.connect(dest);src.start(start);src.stop(start+0.2);state.nodes.push(src);
      }else if(kind==='tom'){
        const o=a.createOscillator(),g=a.createGain();
        o.frequency.setValueAtTime(midiHz(midiN)*0.5,start);o.frequency.exponentialRampToValueAtTime(60,start+0.15);
        g.gain.setValueAtTime(0.0001,start);g.gain.exponentialRampToValueAtTime(0.55*vel,start+0.005);g.gain.exponentialRampToValueAtTime(0.0001,start+0.25);
        o.connect(g);g.connect(dest);o.start(start);o.stop(start+0.28);state.nodes.push(o);
      }else{
        const len=Math.floor(a.sampleRate*0.08),buf=a.createBuffer(1,len,a.sampleRate),d=buf.getChannelData(0);
        for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(len*0.2));
        const src=a.createBufferSource();src.buffer=buf;const g=a.createGain(),hp=a.createBiquadFilter();
        hp.type='highpass';hp.frequency.value=6000;
        g.gain.setValueAtTime(0.35*vel,start);g.gain.exponentialRampToValueAtTime(0.0001,start+0.06);
        src.connect(hp);hp.connect(g);g.connect(dest);src.start(start);src.stop(start+0.08);state.nodes.push(src);
      }
      return;
    }
    const o=a.createOscillator(),g=a.createGain(),f=a.createBiquadFilter();
    o.type=inst==='bass'?'sine':inst==='keys'?'triangle':inst==='pad'?'sine':inst==='guitar'?'sawtooth':'sawtooth';
    o.frequency.value=midiHz(midiN);
    f.type='lowpass';
    f.frequency.value=inst==='bass'?800:inst==='pad'?1400:inst==='guitar'?3200:inst==='lead'?4500:2200;
    const peak=inst==='bass'?0.28:inst==='pad'?0.14:0.2;
    g.gain.setValueAtTime(0,start);
    g.gain.linearRampToValueAtTime(peak*vel,start+(inst==='pad'?0.08:0.012));
    g.gain.exponentialRampToValueAtTime(0.0001,stop);
    o.connect(f);f.connect(g);g.connect(dest);
    try{o.start(start);o.stop(stop+0.05);state.nodes.push(o)}catch(e){}
  }

  // Sum a stereo node to mono, then feed only left (0) or right (1) of a ChannelMerger
  function connectMonoToChannel(srcNode,merger,ch){
    const a=ac();
    const split=a.createChannelSplitter(2);
    const mid=a.createGain();mid.gain.value=0.707;
    srcNode.connect(split);
    try{split.connect(mid,0);split.connect(mid,1)}catch(e){srcNode.connect(mid)}
    mid.connect(merger,0,ch|0);
  }

  function startPlay(from,opt){
    stopPlay();
    const a=ac();if(a.state==='suspended')a.resume();
    warmWorklet();
    state.offset=from!=null?from:state.offset;
    state.playOnly=null;
    if(opt&&opt.onlyTrackId){
      state.tracks.forEach(t=>{t.solo=(t.id===opt.onlyTrackId)});
    }
    state.live=new Map();
    state._midi=[];
    state._sched=null;
    state._silentMs=0;
    state._lastReseed=state.offset;
    state._reseedGuard=a.currentTime+1.2;
    const master=a.createGain();master.gain.value=1;
    state._master=master;
    const meter=a.createAnalyser();meter.fftSize=2048;meter.smoothingTimeConstant=0.2;
    master.connect(meter);meter.connect(a.destination);
    state._meter=meter;state._meterTd=new Uint8Array(meter.fftSize);

    if(state.metro){
      const ck=state.tracks.find(t=>t.stem==='click');
      if(ck){ck.mute=false;if(state.nomVol!=null)ck.vol=state.nomVol}
    }
    const when=a.currentTime+0.02;
    state.playT0=when;state.playing=true; // 1.0.32: was state.t0 = nom phase → ▶ overwrote the beat grid with AudioContext time
    // Audio clips → single keepalive mixer (must start AFTER playing=true)
    attachPullMixer(state.offset,master);
    // MIDI still uses short oscillators (look-ahead) into master
    state.tracks.forEach(tr=>{
      if(tr.type!=='midi')return;
      const chain=makeTrackChain(tr);
      try{chain.input.gain.value=1}catch(e){}
      const muteG=a.createGain();
      const anySolo=state.tracks.some(t=>t.solo);
      const silent=tr.mute||(anySolo&&!tr.solo);
      muteG.gain.value=silent?0:Math.max(0,(tr.vol||0)/100);
      chain.dry.connect(muteG);muteG.connect(master);
      state.fx.push(chain);
      state.live.set(tr.id,{muteG,volG:chain.input,lo:chain.lo,mid:chain.mid,hi:chain.hi});
      scheduleMidi(tr,chain,when,state.offset);
    });
    if(state.metro&&!state.tracks.some(t=>t.stem==='click'))scheduleMetro(when,state.offset);
    state._watch=setInterval(()=>{if(state.playing){try{pumpMidi();pumpMetro();watchAudioHealth()}catch(e){}}},200);
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
    const playT=playheadT();
    const until=playT+8;
    const vol=(state.nomVol!=null?state.nomVol:140)/100*0.4; // 1.0.33: was 0.22 (too quiet)
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
    let t=playheadT();
    if(state.loop&&t>=state.loopB){startPlay(state.loopA);return}
    if(t>=dur()+0.05){stopPlay();state.offset=0;ui.onTransport?.(state);renderArrange();return}
    try{pumpMidi();pumpMetro()}catch(e){}
    ui.onTransport?.(state);renderPlayhead(t);
    state._raf=requestAnimationFrame(tick);
  }

  function deleteTrack(i){
    const tr=state.tracks[i];if(!tr)return;
    if(!confirm('ลบแทร็ก "'+tr.name+'" ?'))return;
    mark();
    // 1.0.38: an AI lane is part of the original mix → keep it as a silent ghost (its buffers stay) instead of letting it play forever
    const ghost=!!(state.mixBuf&&tr.type==='audio'&&tr.stem&&!['click','countin','mix'].includes(tr.stem)&&tr.clips.length);
    if(ghost){state.ghosts=(state.ghosts||[]).filter(g=>g.id!==tr.id);state.ghosts.push({id:tr.id,name:tr.name,stem:tr.stem,fineOf:tr.fineOf||null,type:'audio',mute:true,solo:false,vol:0,ghost:true,clips:tr.clips.map(c=>({...c,peaks:null}))})}
    // free buffers only used by this track's clips
    const keep=new Set();if(ghost)tr.clips.forEach(c=>keep.add(c.buf));
    state.tracks.forEach((t,ti)=>{if(ti===i)return;t.clips.forEach(c=>keep.add(c.buf))});
    tr.clips.forEach(c=>{if(!keep.has(c.buf))state.buffers.delete(c.buf)});
    state.tracks.splice(i,1);
    state.sel.track=Math.max(0,Math.min(i,state.tracks.length-1));
    state.sel.clip=null;state.sel.notes=[];
    if(state.playing){const at=state.offset;stopPlay();if(state.tracks.length)startPlay(at)}
    renderAll();
  }

  /* ---------- recording: mic | bus (no mic) | blank clip ---------- */
  function recMode(){
    try{return (document.getElementById('recMode')||{}).value||'mic'}catch(e){return'mic'}
  }
  async function toggleRecord(){
    if(state.recording){await stopRecord();return}
    const mode=recMode();
    mark();
    let tr=state.tracks[state.sel.track];
    if(!tr||tr.type!=='audio'){tr=addAudioTrack(mode==='blank'?'คลิปว่าง':'อัดเสียง');state.sel.track=state.tracks.length-1;renderTracks()}
    if(mode==='blank'){
      const bars=2,sec=bars*4*beatSec(),sr=ac().sampleRate;
      const buf=ac().createBuffer(1,Math.max(1,Math.floor(sec*sr)),sr);
      const id=putBuf(buf);
      tr.clips.push({id:uid(),buf:id,start:snapT(state.offset),offset:0,dur:buf.duration,gain:1,peaks:peaksOf(buf),name:'ว่าง'});
      state.sel.clip=tr.clips[tr.clips.length-1].id;
      ui.toast?.('สร้างคลิปว่าง '+bars+' ห้องที่หัวเล่น');
      renderAll();return;
    }
    const a=ac();if(a.state==='suspended')await a.resume();
    const chunksL=[],chunksR=[];
    let stream=null,src=null,proc=null,tap=null;
    if(mode==='mic'){
      try{
        stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false}});
      }catch(e){
        ui.toast?.('ไมโครโฟนไม่พร้อม: '+(e.message||e.name||e)+' — ลองโหมด「จากเครื่องเล่น」หรือ「คลิปว่าง」');
        ui.onTransport?.(state);return;
      }
      src=a.createMediaStreamSource(stream);
      proc=a.createScriptProcessor(4096,1,1);
      const silent=a.createGain();silent.gain.value=0;
      proc.onaudioprocess=e=>{if(!state.recording)return;chunksL.push(new Float32Array(e.inputBuffer.getChannelData(0)))};
      src.connect(proc);proc.connect(silent);silent.connect(a.destination);
    }else{
      // Record studio output (no microphone) — tap master while playing
      if(!state.playing)startPlay(state.offset);
      const master=state._master;if(!master){ui.toast?.('ยังไม่มีสัญญาณเครื่องเล่น');return}
      proc=a.createScriptProcessor(4096,2,2);
      const silent=a.createGain();silent.gain.value=0;
      proc.onaudioprocess=e=>{
        if(!state.recording)return;
        chunksL.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        chunksR.push(new Float32Array(e.inputBuffer.getChannelData(1)||e.inputBuffer.getChannelData(0)));
      };
      master.connect(proc);proc.connect(silent);silent.connect(a.destination);
      tap=master;
    }
    state.recording=true;
    state.rec={mode,stream,proc,src,tap,chunksL,chunksR,start:state.offset,tr:tr.id};
    if(mode==='mic'&&!state.playing)startPlay(state.offset);
    ui.toast?.(mode==='mic'?'อัดจากไมค์… กด ● อีกครั้งเพื่อหยุด':'อัดจากเครื่องเล่น (ไม่มีไมค์)… กด ● เพื่อหยุด');
    ui.onTransport?.(state);
  }
  async function stopRecord(){
    if(!state.recording)return;
    state.recording=false;
    const {mode,stream,proc,src,tap,chunksL,chunksR,start,tr}=state.rec||{};
    try{proc?.disconnect();src?.disconnect();if(tap&&proc)try{tap.disconnect(proc)}catch(e){}stream?.getTracks?.().forEach(t=>t.stop())}catch(e){}
    const L=chunksL||[];
    if(!L.length){state.rec={};ui.onTransport?.(state);return}
    const len=L.reduce((a,c)=>a+c.length,0);
    const ch=(chunksR&&chunksR.length===L.length)?2:1;
    const buf=ac().createBuffer(ch,len,ac().sampleRate);
    const d0=buf.getChannelData(0);let o=0;for(const c of L){d0.set(c,o);o+=c.length}
    if(ch>1){const d1=buf.getChannelData(1);o=0;for(const c of chunksR){d1.set(c,o);o+=c.length}}
    const id=putBuf(buf);
    const track=state.tracks.find(t=>t.id===tr)||addAudioTrack('อัดเสียง');
    track.clips.push({id:uid(),buf:id,start:snapT(start||0),offset:0,dur:buf.duration,gain:1,peaks:peaksOf(buf),name:mode==='bus'?'อัดเครื่องเล่น':'อัดไมค์'});
    state.sel.clip=track.clips[track.clips.length-1].id;
    state.rec={};ui.onTransport?.(state);renderAll();
    ui.toast?.('บันทึกคลิปแล้ว · '+buf.duration.toFixed(1)+' วิ');
  }

  /* ---------- clip / note clipboard (Ctrl+C / X / V) ---------- */
  function copySelected(cut){
    const tr=state.tracks[state.sel.track];if(!tr)return false;
    if(tr.type==='midi'&&state.sel.notes.length){
      const set=new Set(state.sel.notes);
      const notes=tr.notes.filter(n=>set.has(n.id)).map(n=>({...n}));
      if(!notes.length)return false;
      const t0=Math.min(...notes.map(n=>n.t));
      state.clipBoard={kind:'notes',inst:tr.inst||'keys',notes:notes.map(n=>({n:n.n,t:n.t-t0,d:n.d,v:n.v})),t0};
      if(cut){mark();tr.notes=tr.notes.filter(n=>!set.has(n.id));state.sel.notes=[];renderAll()}
      ui.toast?.(cut?'ตัดโน้ตแล้ว · Ctrl+V วาง':'คัดลอกโน้ตแล้ว · Ctrl+V วาง');
      return true;
    }
    if(tr.type==='audio'&&state.sel.clip){
      const clip=tr.clips.find(c=>c.id===state.sel.clip);if(!clip)return false;
      state.clipBoard={kind:'clip',clip:{buf:clip.buf,offset:clip.offset,dur:clip.dur,gain:clip.gain,peaks:clip.peaks,name:clip.name},fromTrack:tr.id};
      if(cut){mark();tr.clips=tr.clips.filter(c=>c.id!==clip.id);state.sel.clip=null;renderAll()}
      ui.toast?.(cut?'ตัดคลิปแล้ว · Ctrl+V วางที่หัวเล่น':'คัดลอกคลิปแล้ว · Ctrl+V วางที่หัวเล่น');
      return true;
    }
    ui.toast?.('เลือกคลิปหรือโน้ตก่อน');return false;
  }
  function pasteClipboard(){
    const board=state.clipBoard;if(!board){ui.toast?.('ยังไม่มีสิ่งที่คัดลอก');return}
    mark();
    if(board.kind==='clip'){
      let tr=state.tracks[state.sel.track];
      if(!tr||tr.type!=='audio'){tr=addAudioTrack('วางคลิป');state.sel.track=state.tracks.length-1}
      const c=board.clip;
      const neu={id:uid(),buf:c.buf,start:snapT(state.offset),offset:c.offset,dur:c.dur,gain:c.gain||1,peaks:c.peaks,name:(c.name||'คลิป')+' · สำเนา'};
      tr.clips.push(neu);state.sel.clip=neu.id;renderAll();
      ui.toast?.('วางคลิปที่ '+fmt(neu.start));return;
    }
    if(board.kind==='notes'){
      let tr=state.tracks[state.sel.track];
      if(!tr||tr.type!=='midi'){tr=ensureMidiInst(board.inst||'keys')}
      const base=snapT(state.offset);
      const ids=[];
      for(const n of board.notes){
        const neu={id:uid(),n:n.n,t:base+(n.t||0),d:n.d||beatSec()/2,v:n.v||0.9};
        tr.notes.push(neu);ids.push(neu.id);
      }
      state.sel.notes=ids;state.tool='draw';syncTools();renderAll();
      ui.toast?.('วางโน้ต '+ids.length+' ตัวที่ '+fmt(base));
    }
  }

  /* ---------- clip ops ---------- */
  function splitAt(time){
    const tr=state.tracks[state.sel.track];if(!tr||tr.type!=='audio')return;
    const clip=tr.clips.find(c=>time>c.start+0.01&&time<c.start+c.dur-0.01);if(!clip)return;
    mark();
    const local=time-clip.start;
    const right={id:uid(),buf:clip.buf,start:time,offset:clip.offset+local,dur:clip.dur-local,gain:clip.gain,peaks:clip.peaks,name:clip.name};
    clip.dur=local;
    tr.clips.push(right);state.sel.clip=right.id;renderAll();
  }
  function deleteSelected(){
    const tr=state.tracks[state.sel.track];if(!tr)return;
    mark();
    if(tr.type==='midi'&&state.sel.notes.length){const set=new Set(state.sel.notes);tr.notes=tr.notes.filter(n=>!set.has(n.id));state.sel.notes=[];}
    else if(state.sel.clip){tr.clips=tr.clips.filter(c=>c.id!==state.sel.clip);state.sel.clip=null}
    renderAll();
  }

  /* ---------- counts (Data 1.0.31) — replace 1.0.30 section/end pins ----------
     state.markers = [{id,kind:'count',t(song s, on a nom click),n:8|4,src:'manual'}]  (legacy 'section' still read by export) */
  function musicStart(){
    for(const tr of state.tracks){
      if(tr.type!=='audio'||!tr.stem||tr.stem==='click'||tr.stem==='countin'||!tr.clips.length)continue;
      return tr.clips[0].start||0;
    }
    return 0;
  }
  /** 1.0.32: t0 must be a song time inside the music; older builds saved the ▶ AudioContext time (e.g. 143 s) */
  function saneT0(t0,bpm,musicDur){
    t0=+t0||0;const spb=60/(+bpm||120),d=musicDur||dur()||0;
    if(!(t0>=0)||!isFinite(t0))return 0;
    if(d>0&&t0>Math.min(d-0.5,60)){const p=2*spb;t0=((t0%p)+p)%p}
    return Math.round(t0*10000)/10000;
  }
  function clickStep(){const r=state.nomOpt&&state.nomOpt.rate===2?2:1;return 60/(state.bpm||120)*r}
  function snapClick(t){const st=clickStep(),t0=saneT0(state.t0,state.bpm);const k=Math.max(0,Math.round((t-t0)/st));return Math.round((t0+k*st)*10000)/10000}
  function countLen(m){return (+m.n===4?4:8)*clickStep()}
  function sortMarkers(){state.markers.sort((a,b)=>a.t-b.t)}
  function countAt(t){return state.markers.find(m=>m.kind==='count'&&t>=m.t-clickStep()*0.5&&t<m.t+countLen(m)-clickStep()*0.5)||null}
  function changed(){state.dirty=true;sortMarkers();renderArrange();renderCountBlocks();ui.onMarkers?.(state.markers)}
  /** Tap on the timeline (song time): remove the count under it, else add one starting on the nearest nom click. */
  function toggleCountAt(t,n){
    const hit=countAt(t);mark();
    if(hit){state.markers=state.markers.filter(m=>m!==hit);changed();return null}
    const m={id:uid(),kind:'count',t:snapClick(t),n:+n===4?4:8,src:'manual'};
    state.markers=state.markers.filter(x=>!(x.kind==='count'&&Math.abs(x.t-m.t)<1e-3));
    state.markers.push(m);changed();return m;
  }
  function addCount(t,n){const m={id:uid(),kind:'count',t:snapClick(t!=null?t:playheadT()-musicStart()),n:+n===4?4:8,src:'manual'};mark();state.markers.push(m);changed();return m}
  function moveCount(id,t){const m=state.markers.find(x=>x.id===id);if(!m)return;mark();
    if(m.kind!=='count'){m.kind='count';m.n=8} // legacy pin → real count group once it's moved
    m.t=snapClick(Math.max(0,t));
    state.markers=state.markers.filter(x=>x===m||!(x.kind==='count'&&Math.abs(x.t-m.t)<1e-3)); // dropped onto another → merge
    changed()}
  function deleteCount(id){mark();state.markers=state.markers.filter(x=>x.id!==id);changed()}
  function setMarkers(list){
    state.markers=(list||[]).filter(m=>m&&m.kind!=='end'&&isFinite(+m.t)).map(m=>m.kind==='count'
      ?{id:m.id||uid(),kind:'count',t:+m.t,n:+m.n===4?4:8,src:m.src||'manual'}
      :{id:m.id||uid(),kind:'section',t:+m.t,src:m.src||'manual'}); // legacy 1.0.30 pin → 8-click count before it
    sortMarkers();renderArrange();renderCountBlocks();
  }
  /** count spans in song time (legacy 'section' = 8 clicks before its t) */
  function countSpans(){const st=clickStep();return state.markers.filter(m=>m.kind==='count'||m.kind==='section').map(m=>{
    const start=m.kind==='count'?m.t:Math.max(0,m.t-8*st);return{m,start,end:start+(m.kind==='count'?countLen(m):8*st),n:m.kind==='count'?(+m.n===4?4:8):8}})}
  function drawMarkers(g){
    g.font='bold 10px NotoThai,sans-serif';const ms=musicStart();
    for(const c of countSpans()){
      const x=(ms+c.start)*state.pxPerSec,w=Math.max(6,(c.end-c.start)*state.pxPerSec);
      g.fillStyle='rgba(255,214,10,.22)';g.fillRect(x,0,w,28);g.fillStyle='#ffd60a';g.fillRect(x,0,2,28);
      g.fillStyle='#ffd60a';g.fillText(c.n===4?'🗣 1234':'🗣 1·2·1234',x+5,24);
    }
  }
  function markerAtClientX(){return null}
  /* tap-to-align: a tap on beat 1 sets the nom phase (snapped to the nearest attack in the song ±80 ms) */
  function attackNear(tSong){
    const buf=state.mixBuf||(()=>{for(const tr of state.tracks){if(tr.type!=='audio'||!tr.stem||tr.stem==='click'||tr.stem==='countin'||!tr.clips[0])continue;const b=state.buffers.get(tr.clips[0].buf);if(b)return b}return null})();
    if(!buf)return tSong;
    const sr=buf.sampleRate,d=buf.getChannelData(0),h=Math.round(0.002*sr),w=Math.round(0.01*sr);
    const a=Math.max(0,Math.round((tSong-0.1)*sr)),z=Math.min(d.length-w,Math.round((tSong+0.1)*sr));
    let best=tSong,bv=0,prev=-1;
    for(let i=a;i<z;i+=h){let q=0;for(let j=i;j<i+w;j+=2)q+=d[j]*d[j];q=Math.sqrt(q/(w/2));if(prev>=0){const r=q-prev;const dist=Math.abs(i/sr-tSong);const sc=r*(1-dist/0.12);if(sc>bv){bv=sc;best=i/sr}}prev=q}
    return Math.abs(best-tSong)<=0.08?best:tSong;
  }
  function tapDownbeat(tSong){
    const t=attackNear(tSong),spb=60/(state.bpm||120);
    let ms=0;try{ms=state.mixBuf?nomMusicStart(state.mixBuf.getChannelData(0),state.mixBuf.sampleRate):0}catch(e){}
    let t0=t;while(t0-2*spb>=ms-spb*0.5)t0-=2*spb;if(t0<0)t0+=2*spb;
    state.t0=Math.round(t0*10000)/10000;nudgeNom(0);renderArrange();return{t0:state.t0,tap:t};
  }
  /** keyboard/button tap while playing: playhead minus what the ear hears late (output latency + mixer block) */
  function tapNow(){const a=ac();const lat=(a.baseLatency||0)+(a.outputLatency||0)+2048/a.sampleRate;return tapDownbeat(Math.max(0,playheadT()-lat-musicStart()))}

  /* ---------- render UI ---------- */
  function renderAll(){renderTracks();renderArrange();renderMixer();renderPiano();ui.onProject?.(state)}

  function renderTracks(){
    {const mc=typeof document!=='undefined'&&document.getElementById('btnMaxCut');if(mc){mc.classList.toggle('on',!!state.maxCut);mc.setAttribute('aria-pressed',state.maxCut?'true':'false')}
     const dc=typeof document!=='undefined'&&document.getElementById('btnDeepClean');if(dc){dc.classList.toggle('on',!!state.deepClean);dc.setAttribute('aria-pressed',state.deepClean?'true':'false')}}
    const box=$('trackHeads');if(!box)return;box.innerHTML='';
    state.tracks.forEach((tr,i)=>{
      const el=document.createElement('div');el.className='thead'+(state.sel.track===i?' on':'')+(tr.fineOf?' fine':'');el.dataset.i=i;if(tr.stem)el.dataset.stem=tr.stem;
      if(tr.fineTip)el.title=tr.fineTip;
      const fine=isFineParent(tr)?`<button type="button" class="tb fine" data-fine="${i}" title="${tr.stem==='drums'?'แยกละเอียด — กระเดื่อง สแนร์ ทอม ฉาบ':'แยกละเอียด — นำ / คอรัส (คุณภาพขึ้นกับเพลง)'}">✂</button>`:'';
      el.innerHTML=`<div class="tn"><i style="background:${tr.color}"></i><input value="${escAttr(tr.name)}" data-rn="${i}">${fine}<b>${tr.type==='midi'?'MIDI':'AUD'}</b>
          <button type="button" class="tb del" data-deltr="${i}" title="ลบแทร็กนี้">✕</button></div>
        <div class="tops">
          <button type="button" class="tb ${tr.mute?'on':''}" data-m="${i}" title="${tr.stem==='click'?'ปิด/เปิดเสียงนอมตอนฟัง':'ปิดเครื่องนี้ (มีผลกับไฟล์ดาต้าด้วย)'}">M</button>
          <button type="button" class="tb ${tr.solo?'on':''}" data-s="${i}" title="โซโล่">S</button>
          ${isMusicLane(tr)?`<button type="button" class="tb eqb ${(!eqFlat(tr.eq)||(tr.mute&&(state.maxCut||!eqFlat(tr.cut))))?'on':''}" data-eqo="${i}" title="${tr.mute?'ตัดเสียงที่หลงเหลือเพิ่ม (ต่ำ/กลาง/แหลม)':'EQ ต่ำ/กลาง/แหลม (ได้ทั้งตอนฟังและในไฟล์ดาต้า)'}">🎚</button>`:''}
        </div>`;
      box.appendChild(el);
    });
    const wrap=$('lanesWrap');if(wrap)box.scrollTop=wrap.scrollTop;
    paintFineStatus();
    if(state._eqOpen!=null)paintEqPop();
  }
  /* ---------- 1.0.37 (t320u): per-lane EQ popup — audible lane: tone EQ · muted lane: remove MORE of what is left, per band ---------- */
  function isMusicLane(tr){return tr&&tr.type==='audio'&&tr.stem&&!['click','countin','mix'].includes(tr.stem)&&tr.clips.length}
  const EQB=[['lo','🔈','ต่ำ'],['mid','🔉','กลาง'],['hi','🔊','แหลม']];
  function paintEqPop(){
    let pop=document.getElementById('eqPop');const tr=state.tracks.find(t=>t.id===state._eqOpen);
    if(!tr||!isMusicLane(tr)){if(pop)pop.remove();state._eqOpen=null;return}
    if(!pop){pop=document.createElement('div');pop.id='eqPop';pop.className='eqpop';document.body.appendChild(pop);
      pop.addEventListener('pointerdown',e=>{if(e.target.matches('input[type=range]'))mark()});
      pop.addEventListener('input',e=>{const r=e.target.closest('input[data-band]');if(!r)return;const t=state.tracks.find(x=>x.id===state._eqOpen);if(!t)return;
        const f=r.dataset.field;t[f]={lo:0,mid:0,hi:0,...(t[f]||{})};t[f][r.dataset.band]=+r.value;
        const v=r.parentElement.querySelector('output');if(v)v.textContent=(f==='cut'?'−':(+r.value>0?'+':''))+Math.abs(+r.value)+' dB';
        state.dirty=true;applyLiveMix();const b=document.querySelector(`#trackHeads [data-eqo="${state.tracks.indexOf(t)}"]`);if(b)b.classList.toggle('on',!eqFlat(t.eq)||(t.mute&&!eqFlat(t.cut)))});
      pop.addEventListener('click',e=>{if(e.target.closest('[data-eqx]')){state._eqOpen=null;pop.remove();return}
        if(e.target.closest('[data-eqreset]')){const t=state.tracks.find(x=>x.id===state._eqOpen);if(!t)return;mark();const f=t.mute?'cut':'eq';t[f]={lo:0,mid:0,hi:0};applyLiveMix();renderTracks()}});
    }
    const muted=heardGain(tr,tr.clips[0])<0.25,f=muted?'cut':'eq',vals={lo:0,mid:0,hi:0,...(tr[f]||{})};
    pop.dataset.field=f;pop.dataset.track=tr.id;
    pop.innerHTML=`<div class="eqh"><b>${muted?'✂':'🎚'} ${escAttr(tr.name)}</b><button type="button" class="tb" data-eqx title="ปิด">✕</button></div>
      <div class="eqsub">${muted?(state.maxCut?'✂ ตัดแรงสุดเปิดอยู่ — ตอนนี้ตัด 24 dB ทุกแถบ (ปิดปุ่มแล้วกลับมาใช้ค่าด้านล่าง)':'ปิดอยู่ — ลากเพื่อตัดเสียงที่ยังหลงเหลือเพิ่ม (ตอนฟัง = ไฟล์ดาต้า)'):'ปรับเสียงเครื่องนี้ (ตอนฟัง = ไฟล์ดาต้า)'}</div>`+
      EQB.map(([k,ic,lab])=>`<label class="eqr"><span title="${lab}">${ic} ${lab}</span><input type="range" data-field="${f}" data-band="${k}" min="${muted?0:-24}" max="${muted?24:12}" step="1" value="${+vals[k]||0}"><output>${muted?'−':(+vals[k]>0?'+':'')}${Math.abs(+vals[k]||0)} dB</output></label>`).join('')+
      `<div class="eqf"><button type="button" class="tb" data-eqreset>↺ รีเซ็ต</button></div>`;
    const b=document.querySelector(`#trackHeads [data-eqo="${state.tracks.indexOf(tr)}"]`);
    if(b){const r=b.getBoundingClientRect();pop.style.left=Math.min(innerWidth-270,r.right+6)+'px';pop.style.top=Math.max(8,Math.min(innerHeight-220,r.top-10))+'px'}
  }
  function escAttr(s){return String(s??'').replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]))}

  /** count blocks (+ automatic intro block) — cheap DOM-only, also while playing (1.0.32: blocks didn't show until ■) */
  function renderCountBlocks(){
    const lanes=$('lanes');if(!lanes)return;
    lanes.querySelectorAll('.cblock,.cband').forEach(el=>el.remove());
    // 1.0.32: faint full-height band over every lane — the nom lane is often scrolled out of view (blocks looked like "nothing happened")
    {const ms0=musicStart(),H=Math.max(lanes.scrollHeight,lanes.clientHeight);
     for(const c of countSpans()){const d=document.createElement('div');d.className='cband';d.style.left=((ms0+c.start)*state.pxPerSec)+'px';
       d.style.width=Math.max(8,(c.end-c.start)*state.pxPerSec)+'px';d.style.height=H+'px';d.dataset.mid=c.m.id;
       // 1.0.33: chip = drag handle (mouse + touch) · ✕ = remove
       d.innerHTML=`<b class="cgrip" title="ลาก = ย้ายจุดนับ (ติดจังหวะนอม)">⠿ 🗣 ${c.n===4?'1 2 3 4':'1 · 2 · 1 2 3 4'}<i class="cdel" title="ลบจุดนับ" aria-label="ลบจุดนับ">✕</i></b>`;lanes.appendChild(d)}}
    const els=lanes.querySelectorAll('.lane');if(!els.length)return;
    let ti=state.tracks.findIndex(t=>t.stem==='click');if(ti<0)ti=els.length-1;
    const lane=els[ti];if(!lane)return;
    const ms=musicStart(),no=state.nomOpt||{},st=clickStep(),t0=saneT0(state.t0,state.bpm);
    if(no.ciMode==='over'&&(+no.ci||0)>0&&state.tracks.some(t=>t.stem==='click')){
      const b=document.createElement('div');b.className='cblock intro';
      b.style.left=((ms+t0)*state.pxPerSec)+'px';b.style.width=Math.max(8,8*(+no.ci)*st*state.pxPerSec)+'px';
      b.innerHTML=`<b>🗣 นับเข้า ×${+no.ci}</b>`;b.title='นับเข้าอัตโนมัติ — เปลี่ยนที่ "นับเข้า"';lane.appendChild(b);
    }
    for(const c of countSpans()){
      const b=document.createElement('div');b.className='cblock';b.dataset.mid=c.m.id;
      b.style.left=((ms+c.start)*state.pxPerSec)+'px';b.style.width=Math.max(8,(c.end-c.start)*state.pxPerSec)+'px';
      b.innerHTML=`<b>🗣 ${c.n===4?'one two three four':'one · two · one two three four'}</b>`;b.title='แตะ = ลบ · ลาก = ย้าย';
      lane.appendChild(b);
    }
  }
  function renderArrange(opt){
    opt=opt||{};
    // While playing: NEVER rebuild lanes/canvases (MUSE-smooth — any DOM wipe = stutter)
    if(state.playing&&!opt.force){
      try{
        const lanes=$('lanes');
        if(lanes)lanes.querySelectorAll('.lane').forEach((el,i)=>el.classList.toggle('on',state.sel.track===i));
        renderMasterWave();
      }catch(e){}
      return;
    }
    clearTimeout(state._arrDeb);state._arrDeb=null;
    const lanes=$('lanes'),ruler=$('ruler');if(!lanes)return;
    const W=Math.max(1200,Math.ceil((dur()+4)*state.pxPerSec));
    lanes.style.width=W+'px';
    // ruler
    if(ruler){
      const dpr=devicePixelRatio||1;ruler.style.width=W+'px';ruler.width=Math.round(W*dpr);ruler.height=Math.round(28*dpr);
      const g=ruler.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
      g.fillStyle='#0a0c0f';g.fillRect(0,0,W,28);
      g.font='11px JetMono,monospace';g.fillStyle='#7a8490';
      // beat ticks follow the nom grid (t0), bar 1 = first nom downbeat
      const bs=beatSec(),o=musicStart()+(+state.t0||0),b0=-Math.floor(o/bs);
      for(let b=b0;(o+b*bs)<=dur()+4;b++){
        const x=(o+b*bs)*state.pxPerSec;if(x<0)continue;const bar=((b%4)+4)%4===0;
        g.fillStyle=bar?'#9aa3ad':'#3a4450';g.fillRect(x,bar?10:16,1,bar?18:12);
        if(bar&&b>=0){g.fillStyle='#8a949e';g.fillText(String(1+b/4|0),x+4,12)}
      }
      drawMarkers(g);
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
          const wk=waveKey(c,tr.color,w),wu=waveImgCache.get(wk);
          if(wu){const im=new Image();im.className='cw';im.alt='';im.decoding='async';im.draggable=false;im.src=wu;cv.replaceWith(im)}
          const lab=document.createElement('span');lab.className='clab';lab.textContent=c.name||tr.name;clip.appendChild(lab);
          const hL=document.createElement('i');hL.className='hndl L';clip.appendChild(hL);
          const hR=document.createElement('i');hR.className='hndl R';clip.appendChild(hR);
          lane.appendChild(clip);
          if(!wu)requestAnimationFrame(()=>{drawClipWave(cv,c,tr.color,1);waveToImg(cv,waveKey(c,tr.color,w))});
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
    renderCountBlocks();
    const totalH=Math.max(LANE_H,state.tracks.length*LANE_H);
    ph.style.height=totalH+'px';
    renderPlayhead(playheadT());
    renderMasterWave();
  }

  // MUSE-style: one continuous full-song wave (always from mixBuf / loudest bed)
  function renderMasterWave(){
    const cv=$('masterWave');if(!cv)return;
    const wrap=cv.parentElement;if(!wrap)return;
    let buf=state.mixBuf;
    if(!buf){
      for(const tr of state.tracks){
        if(tr.type!=='audio'||!tr.clips[0]||tr.stem==='click'||tr.stem==='countin')continue;
        buf=state.buffers.get(tr.clips[0].buf);if(buf)break;
      }
    }
    const W=Math.max(1200,Math.ceil((dur()+4)*state.pxPerSec));
    const h=wrap.clientHeight||72,dpr=safeDpr(W,h);
    cv.style.width=W+'px';cv.width=Math.round(W*dpr);cv.height=Math.round(h*dpr);
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    g.fillStyle='#0a0e14';g.fillRect(0,0,W,h);
    if(!buf){g.fillStyle='#445';g.font='12px NotoThai,sans-serif';g.fillText('ยังไม่มีเพลง — ลากไฟล์แยก AI หรือนำเข้าช่องจากไฟล์',12,h/2+4);return}
    let pk=state._mixPeaks;
    if(!pk||state._mixPeaksFor!==buf||pk.length<2){pk=peaksOf(buf);state._mixPeaks=pk;state._mixPeaksFor=buf}
    const mid=h/2,pad=3;
    // master spans the whole timeline (dur()+4 s) — map pixels to the buffer's own seconds
    const wBuf=Math.max(1,Math.min(W,Math.round(buf.duration*state.pxPerSec)));
    const {env}=waveEnvelope(pk,0,1,wBuf);
    const amp=mid-pad;
    g.beginPath();g.moveTo(0,mid);
    for(let x=0;x<wBuf;x++)g.lineTo(x,mid-env[x]*amp);
    for(let x=wBuf-1;x>=0;x--)g.lineTo(x,mid+env[x]*amp);
    g.closePath();
    g.fillStyle='rgba(61,186,138,.45)';g.fill();
    g.strokeStyle='#3dba8a';g.lineWidth=1;g.stroke();
    // playhead mark on master
    const t=playheadT();
    g.fillStyle='var(--play,#ff6b3d)';g.fillStyle='#ff6b3d';
    g.fillRect(Math.max(0,t)*state.pxPerSec-1,0,2,h);
  }

  // 1.0.33 scroll jank: a big live <canvas> per clip (song length × px/s wide) is re-uploaded to the
  // compositor on every scroll frame (Canvas2DResourceProvider::ProduceCanvasResource ≈ 50 ms/frame on a
  // slow PC). Waveforms never change while shown, so we draw once, freeze to a cached PNG <img> (tiled and
  // rastered once by the compositor) and reuse it on every re-render of the lanes.
  const waveImgCache=new Map();
  function waveKey(c,color,w){return [c.buf,(+c.offset||0).toFixed(4),(+c.dur||0).toFixed(4),Math.round(w),color,(c.peaks&&c.peaks.length)||0].join('|')}
  function waveToImg(cv,key){
    if(!cv||!cv.isConnected||!cv.width||!cv.toBlob)return;
    try{cv.toBlob(b=>{
      if(!b)return;const url=URL.createObjectURL(b);
      waveImgCache.set(key,url);
      if(waveImgCache.size>96){const k0=waveImgCache.keys().next().value;URL.revokeObjectURL(waveImgCache.get(k0));waveImgCache.delete(k0)}
      if(!cv.isConnected)return;
      const im=new Image();im.className='cw';im.alt='';im.draggable=false;im.src=url;
      (im.decode?im.decode():Promise.resolve()).catch(()=>{}).then(()=>{if(cv.isConnected){im.style.cssText=cv.style.cssText;cv.replaceWith(im)}});
    },'image/png')}catch(e){}
  }
  function drawClipWave(cv,clip,color,waveZoom){
    const parent=cv.parentElement;if(!parent)return;
    const w=parent.clientWidth||Math.round(clip.dur*state.pxPerSec),h=parent.clientHeight||100;
    if(w<2)return;const dpr=safeDpr(w,h);
    cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.width=w+'px';cv.style.height=h+'px';
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    g.clearRect(0,0,w,h);
    let pk=clip.peaks;
    if(!pk||!(pk.length>=2)){
      const buf0=state.buffers.get(clip.buf);
      if(buf0){pk=peaksOf(buf0);clip.peaks=pk}
    }
    if(!pk||!(pk.length>=2))return;
    const z=clamp(+(waveZoom||1),0.5,8);
    const mid=h/2,pad=2;
    const buf=state.buffers.get(clip.buf);const total=buf?buf.duration:clip.dur;
    const a0=clip.offset/total,a1=(clip.offset+clip.dur)/total;
    const {env,ref}=waveEnvelope(pk,a0,a1,w);
    const amp=(mid-pad)*z;
    // centre line always visible so a silent stretch reads as "no sound", not "broken"
    g.globalAlpha=.5;g.fillStyle=color;g.fillRect(0,mid-0.5,w,1);
    if(!(ref>1e-3)){ // whole clip below −60 dBFS
      g.globalAlpha=.75;g.fillStyle='#9aa4b0';g.font='11px NotoThai,sans-serif';
      g.fillText('AI ไม่พบเสียงเครื่องนี้ในช่วงนี้',8,mid-6);
      if(!(ref>1e-6)){g.globalAlpha=1;return}
    }
    const y=x=>Math.min(mid-pad,env[x]*amp);
    g.beginPath();g.moveTo(0,mid);
    for(let x=0;x<w;x++)g.lineTo(x,mid-y(x));
    for(let x=w-1;x>=0;x--)g.lineTo(x,mid+y(x));
    g.closePath();
    g.globalAlpha=.55;g.fillStyle=color;g.fill();
    g.beginPath();
    for(let x=0;x<w;x++){const yy=mid-y(x);if(x)g.lineTo(x,yy);else g.moveTo(x,yy)}
    g.globalAlpha=.95;g.strokeStyle=color;g.lineWidth=1;g.stroke();
    g.globalAlpha=1;
  }

  function renderPlayhead(t){
    const x=(Math.max(0,t)*state.pxPerSec)+'px';
    const ph=$('playhead');if(ph)ph.style.left=x;
    const mph=$('masterPh');if(mph)mph.style.left=x;
  }

  function eqLabel(v){v=+v||0;return (v>0?'+':'')+v}
  function renderMixer(){
    const box=$('mixer');if(!box)return;box.innerHTML='';
    state.tracks.forEach((tr,i)=>{
      const el=document.createElement('div');el.className='strip';el.dataset.i=i;
      const labBg=tr.color||'#85909b';
      el.classList.toggle('muted',!!tr.mute);
      el.innerHTML=`<div class="lab" style="background:${labBg}" title="${escAttr(tr.name)}">${tr.name}</div>
        <div class="fader-wrap"><input class="fader" type="range" min="0" max="200" value="${tr.vol}" data-vol="${i}" title="ระดับ ${escAttr(tr.name)} — ไฟล์ดาต้าได้ตามที่ได้ยิน"></div>
        <span class="fader-val">${tr.vol}${tr.mute?' ·ปิด':''}</span>`;
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
    const instSel=$('midiInst');
    if(instSel){
      if(!instSel.options.length){
        instSel.innerHTML=MIDI_INST.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
      }
      if(show)instSel.value=tr.inst||'keys';
    }
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

  /** 1.0.37 (t320u): M changes ONLY the clicked lane (header or mixer). The page just mirrors it into the recipe chips —
   *  it no longer re-applies every chip over all lanes (that flipped คอรัส/นำ and other lanes on/off by themselves). */
  function toggleLaneMute(i){
    const tr=state.tracks[i];if(!tr)return;
    if(tr.stem==='click'&&ui.onNomMute){ui.onNomMute(!tr.mute);return}
    mark();tr.mute=!tr.mute;if(state.playOnly)state.playOnly=null;applyLiveMix();renderTracks();renderMixer();
    if(tr.stem&&!['click','countin','mix'].includes(tr.stem))ui.onStemMute?.(tr.stem,tr.mute);
  }
  /* events wiring */
  function bind(){
    document.addEventListener('pointerdown',e=>{if(state._eqOpen!=null&&!e.target.closest('#eqPop,[data-eqo]')){state._eqOpen=null;document.getElementById('eqPop')?.remove()}});
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
      try{if(localStorage.getItem('ssd-mixfold')!=='0'){mixWrap.classList.add('folded');foldMix.setAttribute('aria-expanded','false');const c=$('mixerChev');if(c)c.textContent='▸'}}catch(e){}
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
    $('btnSplit').onclick=()=>{state.tool='split';syncTools();splitAt(state.offset)};
    $('btnSelect').onclick=()=>{state.tool='select';syncTools()};
    $('btnDraw').onclick=()=>{
      state.tool='draw';syncTools();
      const tr=state.tracks[state.sel.track];
      if(!tr||tr.type!=='midi'){
        const inst=(($('midiInst')||{}).value)||'keys';
        ensureMidiInst(inst);
        ui.toast?.('เปิดแทร็ก MIDI · '+instOf(state.tracks[state.sel.track]).name+' — วาดโน้ตได้เลย');
      }
    };
    const btnCopy=$('btnCopy');if(btnCopy)btnCopy.onclick=()=>copySelected(false);
    const btnCut=$('btnCut');if(btnCut)btnCut.onclick=()=>copySelected(true);
    const btnPaste=$('btnPaste');if(btnPaste)btnPaste.onclick=()=>pasteClipboard();
    const midiInst=$('midiInst');
    if(midiInst){
      midiInst.onchange=()=>{
        const id=midiInst.value;
        const tr=state.tracks[state.sel.track];
        if(tr&&tr.type==='midi'){
          mark();tr.inst=id;const meta=instOf(tr);tr.name='MIDI · '+meta.name;tr.color=meta.color;
          renderAll();previewNote(60);
        }else ensureMidiInst(id);
      };
    }
    $('chkMetro').onchange=e=>{
      // Toggle นอม anytime without rebuilding the whole timeline (avoids click bursts / disappearing)
      state.metro=!!e.target.checked;
      setNomAudible(state.metro);
    };
    
    {const sn=$('chkSnap');if(sn)sn.onchange=e=>state.snap=e.target.checked;}
    $('bpm').onchange=e=>{mark();state.bpm=Math.round(clamp(+e.target.value||120,40,240)*1000)/1000;renderArrange()};
    $('zoom').oninput=e=>{
      state.pxPerSec=+e.target.value;
      if(state.playing){renderMasterWave();renderPlayhead(playheadT());return}
      renderArrange();renderPiano();
    };
    const nomVolEl=$('nomVol');
    if(nomVolEl){
      try{const nv=+localStorage.getItem('ssd-nomvol');if(nv>0){state.nomVol=nv;nomVolEl.value=String(nv)}}catch(e){}
      if(state.nomVol==null)state.nomVol=+nomVolEl.value||140;
      nomVolEl.oninput=e=>setNomVol(e.target.value);
    }else if(state.nomVol==null)state.nomVol=140;
    $('btnAddAud').onclick=()=>{mark();addAudioTrack();state.sel.track=state.tracks.length-1;renderAll();ui.toast?.('เพิ่มช่องเสียงแล้ว — ดับเบิลคลิกเลนหรือกดนำเข้าไฟล์')};
    $('btnAddMidi').onclick=()=>{
      mark();
      const inst=(($('midiInst')||{}).value)||'keys';
      ensureMidiInst(inst);
      ui.toast?.('เพิ่ม MIDI · '+instOf(state.tracks[state.sel.track]).name);
    };
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
    {const ex=$('btnExportProj');if(ex)ex.onclick=()=>exportProjectFile();}
    $('btnLoad').onclick=()=>$('fileProj').click();
    $('fileProj').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await loadProjectFile(f)};
    $('btnMixdown').onclick=()=>mixdown();
    $('btnNew').onclick=()=>{if(!state.dirty||confirm('เริ่มโปรเจกต์ใหม่?'))newProject()};

    $('trackHeads').onclick=e=>{
      const fine=e.target.closest('[data-fine]');if(fine){fineSplit(+fine.dataset.fine);return}
      const eqo=e.target.closest('[data-eqo]');if(eqo){const t=state.tracks[+eqo.dataset.eqo];state._eqOpen=state._eqOpen===t.id?null:t.id;if(state._eqOpen==null)document.getElementById('eqPop')?.remove();else paintEqPop();return}
      const del=e.target.closest('[data-deltr]');if(del){const tr=state.tracks[+del.dataset.deltr];if(tr&&confirm('ลบแทร็ก「'+tr.name+'」?'))deleteTrack(+del.dataset.deltr);return}
      const wz=e.target.closest('[data-wz]');if(wz){setTrackWaveZoom(+wz.dataset.wz,+wz.dataset.d);return}
      const m=e.target.closest('[data-m]');if(m){const i=+m.dataset.m,trm=state.tracks[i];
        toggleLaneMute(i);return}
      const s=e.target.closest('[data-s]');if(s){mark();const i=+s.dataset.s;state.tracks[i].solo=!state.tracks[i].solo;if(state.playOnly)state.playOnly=null;applyLiveMix();renderTracks();renderMixer();return}
      const th=e.target.closest('.thead');if(th&&!e.target.closest('input,button')){
        state.sel.track=+th.dataset.i;
        // Don't renderAll while playing — selection class only
        renderTracks();
        try{
          const lanes=$('lanes');
          if(lanes)lanes.querySelectorAll('.lane').forEach((el,i)=>el.classList.toggle('on',state.sel.track===i));
        }catch(e){}
        renderPiano();
      }
    };
    const lrEl=$('chkListenLR');
    if(lrEl){
      try{state.listenLR=localStorage.getItem('ssd-listenlr')==='1';lrEl.checked=!!state.listenLR}catch(e){}
      lrEl.onchange=e=>{
        state.listenLR=!!e.target.checked;
        try{localStorage.setItem('ssd-listenlr',state.listenLR?'1':'0')}catch(err){}
        // pick nom side from recipe if present
        const nomSel=document.getElementById('rNom');
        if(nomSel)state.nomSide=nomSel.value==='L'?'L':'R';
        // Mixer reads listenLR live — never restart playback
        state._pull?.rewind?.();
      };
    }
    const nomSel=document.getElementById('rNom');
    if(nomSel){
      state.nomSide=nomSel.value==='L'?'L':'R';
      nomSel.addEventListener('change',()=>{
        state.nomSide=nomSel.value==='L'?'L':'R';
        // Live flag only — startPlay here caused freeze on every menu change
        state._pull?.rewind?.();
      });
    }
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
      const m=e.target.closest('[data-m]');if(m){toggleLaneMute(+m.dataset.m);return}
      const s=e.target.closest('[data-s]');if(s){mark();state.tracks[+s.dataset.s].solo=!state.tracks[+s.dataset.s].solo;if(state.playOnly)state.playOnly=null;applyLiveMix();renderTracks();renderMixer();return}
    };

    // arrange interactions + draggable red playhead
    const wrap=$('lanesWrap');
    const timeFromClientX=(clientX)=>{
      const lanes=$('lanes');if(!lanes)return 0;
      const rect=lanes.getBoundingClientRect();
      return clamp((clientX-rect.left)/state.pxPerSec,0,Math.max(dur(),rect.width/state.pxPerSec)); // rect moves with the scroll · no song → still the clicked time
    };
    let phDrag=null;
    const nearPlayhead=(clientX)=>{
      const t=timeFromClientX(clientX),ph=playheadT();
      // ~14px hit slop so grabbing the red line doesn't grab the clip under it
      return Math.abs(t-ph)<=(14/Math.max(1,state.pxPerSec));
    };
    const phMove=e=>{
      if(!phDrag)return;
      e.preventDefault();
      phDrag.moved=true;
      // Visual only while dragging — audio jumps once on release (avoids stutter every pixel)
      scrubTo(timeFromClientX(e.clientX),{snap:false,dragging:true,visualOnly:!!phDrag.wasPlaying});
    };
    const phUp=()=>{
      if(!phDrag)return;
      const was=phDrag.wasPlaying;
      const t=state._scrubUI!=null?state._scrubUI:state.offset;
      phDrag=null;
      window.removeEventListener('pointermove',phMove);
      window.removeEventListener('pointerup',phUp);
      window.removeEventListener('pointercancel',phUp);
      // Commit audio seek once (clears _scrubUI)
      scrubTo(t,{snap:false});
      if(was&&!state.playing){/* softReseed/stop edge */}
    };
    const startPhDrag=(e)=>{
      e.preventDefault();e.stopPropagation();
      phDrag={wasPlaying:!!state.playing,pid:e.pointerId,moved:false};
      try{(e.target||wrap).setPointerCapture?.(e.pointerId)}catch(_){}
      // First touch: visual if already playing (keep music going until release)
      scrubTo(timeFromClientX(e.clientX),{snap:false,dragging:true,visualOnly:!!state.playing});
      window.addEventListener('pointermove',phMove,{passive:false});
      window.addEventListener('pointerup',phUp);
      window.addEventListener('pointercancel',phUp);
    };
    wrap.addEventListener('pointerdown',e=>{
      if(e.button!=null&&e.button!==0)return;
      if(ui.countArmed?.()||ui.tapArmed?.())return;
      if(e.target&&(e.target.id==='playhead'||e.target.closest?.('#playhead'))){startPhDrag(e);return}
      // Click near the red line → scrub, never move the clip under it
      if(nearPlayhead(e.clientX)&&!e.target.closest('.hndl')){startPhDrag(e);return}
    });
    // Ruler / master-wave drag/click seeks (MUSE-style main wave)
    const rulerWrap=document.querySelector('.ruler-wrap');
    if(rulerWrap){
      rulerWrap.style.cursor='ew-resize';
      rulerWrap.addEventListener('pointerdown',e=>{
        if(e.button!=null&&e.button!==0)return;
        if(ui.countArmed?.()){e.preventDefault();e.stopPropagation();const t=timeFromClientX(e.clientX)-musicStart();toggleCountAt(t,ui.countN?.()||8);return}
        if(ui.tapArmed?.()){e.preventDefault();e.stopPropagation();ui.onTapAt?.(tapDownbeat(timeFromClientX(e.clientX)-musicStart()));return}
        startPhDrag(e);
      });
    }
    const masterWrap=$('masterWrap');
    if(masterWrap){
      masterWrap.addEventListener('pointerdown',e=>{
        if(e.button!=null&&e.button!==0)return;
        if(e.target&&e.target.id==='masterPh'){startPhDrag(e);return}
        startPhDrag(e);
      });
    }
    // count groups: drag the 🗣 chip on any lane (or the block on the nom lane, or anywhere inside a band while 🗣 is on)
    // = move the whole 1-2-3-4 group, snapped live to the nom clicks · tap block/band in 🗣 mode = remove · ✕ = remove
    let cntSwallowClick=0;
    wrap.addEventListener('pointerdown',e=>{
      if(e.button!=null&&e.button!==0)return;
      const tg=e.target;
      if(tg.closest&&tg.closest('.cdel')){e.preventDefault();e.stopPropagation();cntSwallowClick=performance.now();
        const id=tg.closest('.cband')?.dataset.mid;if(id)deleteCount(id);return}
      let id=null,tapDel=false;
      const grip=tg.closest&&tg.closest('.cgrip'),cb=tg.closest&&tg.closest('.cblock:not(.intro)');
      if(grip)id=grip.closest('.cband')?.dataset.mid;
      else if(cb){id=cb.dataset.mid;tapDel=true}
      else if(ui.countArmed?.()&&!phDrag){const hit=countAt(timeFromClientX(e.clientX)-musicStart());if(hit){id=hit.id;tapDel=true}}
      if(!id)return;
      const m=state.markers.find(x=>x.id===id);if(!m)return;
      e.preventDefault();e.stopPropagation();
      const pid=e.pointerId;try{(grip||cb||wrap).setPointerCapture?.(pid)}catch(_){}
      const x0=e.clientX,sl0=wrap.scrollLeft,t0m=m.kind==='count'?m.t:Math.max(0,m.t-8*clickStep());let moved=false,nt=t0m;
      const els=()=>[...$('lanes').querySelectorAll(`.cband[data-mid="${id}"],.cblock[data-mid="${id}"]`)];
      const live=els();live.forEach(el=>el.classList.add('cdrag'));
      const mv=ev=>{if(ev.pointerId!==pid)return;const dx=ev.clientX-x0+(wrap.scrollLeft-sl0);if(Math.abs(dx)>5)moved=true;if(!moved)return;
        nt=snapClick(Math.max(0,t0m+dx/state.pxPerSec));const px=(nt-t0m)*state.pxPerSec;
        live.forEach(el=>{el.style.transform=`translateX(${px}px)`})};
      const end=(ev,cancel)=>{if(ev.pointerId!==pid)return;removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',cc);
        live.forEach(el=>{el.classList.remove('cdrag');el.style.transform=''});cntSwallowClick=performance.now();
        if(cancel)return;
        if(!moved){if(tapDel)deleteCount(id);return}
        if(Math.abs(nt-t0m)>1e-4)moveCount(id,nt);else renderCountBlocks()};
      const up=ev=>end(ev,false),cc=ev=>end(ev,true);
      addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',cc);
    },true);
    wrap.addEventListener('click',e=>{
      if(phDrag)return;
      if(performance.now()-cntSwallowClick<400)return; // the click that ends a count drag/tap must not add a new count
      if(e.target.closest('.cblock'))return;
      if(ui.countArmed?.()){toggleCountAt(timeFromClientX(e.clientX)-musicStart(),ui.countN?.()||8);return}
      if(ui.tapArmed?.()){ui.onTapAt?.(tapDownbeat(timeFromClientX(e.clientX)-musicStart()));return}
      if(e.target.closest('.clip,.hndl,.mblock,#playhead'))return;
      const t=timeFromClientX(e.clientX);
      if(state.tool==='split'){state.sel.track=+e.target.closest('.lane')?.dataset.ti||state.sel.track;splitAt(snapT(t));return}
      scrubTo(t); // click-to-seek without restart glitch
    });
    wrap.addEventListener('dblclick',e=>{
      const lane=e.target.closest('.lane');if(!lane)return;
      const ti=+lane.dataset.ti;state.sel.track=ti;
      const tr=state.tracks[ti];
      if(tr&&tr.type==='midi'){renderAll();return} // MIDI lanes: select only
      const input=document.createElement('input');input.type='file';input.accept='audio/*';
      input.onchange=async()=>{const f=input.files[0];if(!f)return;const rect=$('lanes').getBoundingClientRect();
        const at=(e.clientX-rect.left)/state.pxPerSec;
        try{await importAudioToTrack(ti,f,snapT(at))}catch(_){}};
      input.click();
    });

    // drag clips — blocked while scrubbing playhead so tracks don't slide with the red line
    let drag=null;
    wrap.addEventListener('pointerdown',e=>{
      if(phDrag)return;
      if(e.button!=null&&e.button!==0)return;
      if(e.target&&(e.target.id==='playhead'||e.target.closest?.('#playhead')))return;
      if(ui.countArmed?.()||ui.tapArmed?.())return;
      if(nearPlayhead(e.clientX)&&!e.target.closest('.hndl'))return;
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
      if(phDrag||!drag)return;
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
      const moved=drag.moved;
      // if never moved, drop the empty undo snapshot
      if(!moved&&state.undo.length)state.undo.pop();
      else state.dirty=true;
      drag=null;
      // Clip moved while playing → retarget mixer (jobs captured old start times)
      if(moved&&state.playing)scrubTo(playheadT(),{snap:false});
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
          seek(snapT((e.clientX-rect.left)/state.pxPerSec));renderPiano()}
        return;
      }
      const rect=grid.getBoundingClientRect();
      const x=e.clientX-rect.left;
      const y=e.clientY-rect.top;
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
    const a=ac();if(a.state==='suspended')a.resume();
    const tr=state.tracks[state.sel.track];
    const g=a.createGain();g.gain.value=1;g.connect(a.destination);
    const nodesBefore=state.nodes.length;
    voiceNote(g,n,0.28,a.currentTime+0.01,(tr&&tr.inst)||'keys',0.9);
    // preview voices auto-stop; drop refs after a beat
    setTimeout(()=>{try{g.disconnect()}catch(e){};state.nodes.length=Math.min(state.nodes.length,nodesBefore)},500);
  }

  function syncTools(){
    const map={select:'btnSelect',split:'btnSplit',draw:'btnDraw'};
    Object.entries(map).forEach(([tool,id])=>{const b=$(id);if(b)b.classList.toggle('on',state.tool===tool)});
  }

  // Live scrub. While dragging during play: hold UI at target (state._scrubUI) and keep
  // audio running; commit audio once on pointer-up. Retargeting every mousemove = stutter.
  function scrubTo(t,opt){
    opt=opt||{};
    let want=clamp(t,0,dur());
    if(opt.snap===true||(opt.snap!==false&&state.snap&&!opt.dragging))want=snapT(want);
    state.offset=want;
    if(opt.visualOnly){
      state._scrubUI=want;
      renderPlayhead(want);
      ui.onTransport?.(state);
      return want;
    }
    state._scrubUI=null;
    renderPlayhead(want);
    ui.onTransport?.(state);
    if(!(state.playing&&state._pull&&state._pull.alive))return want;
    // Retarget pull mixer in place (onaudioprocess reads pull.from)
    if(state._pull.rewind)state._pull.rewind(want); // 1.0.38 worklet: re-base the stream ≈30 ms ahead
    else{state._pull.from=want;state._pull.frame=0;state._pull.f0=0}
    state.playT0=ac().currentTime;
    state._lastReseed=want;
    state._silentMs=0;
    state._reseedGuard=ac().currentTime+1.5;
    if(state._midi){
      for(const job of state._midi){
        job.playFrom=want;job.when=ac().currentTime;job.i=0;
        while(job.i<job.notes.length){
          const n=job.notes[job.i];
          if((n.t+(n.d||0))>want)break;
          job.i++;
        }
      }
    }
    if(state._metroJob){
      state._metroJob.playFrom=want;
      state._metroJob.when=ac().currentTime;
      state._metroJob.nextBeat=Math.ceil(want/beatSec()-1e-6);
    }
    try{pumpMidi();pumpMetro()}catch(e){}
    return want;
  }
  function seek(t){
    // Prefer live scrub while playing — full stop/start caused a glitch on every click
    if(state.playing&&state._pull&&state._pull.alive){scrubTo(t);return}
    stopPlay();state.offset=clamp(state.snap?snapT(t):t,0,dur());
    renderPlayhead(state.offset);ui.onTransport?.(state);
  }

  function newProject(){
    stopPlay();state.tracks=[];state.buffers.clear();state.mixBuf=null;state.ghosts=[];state.title='Untitled';state.bpm=120;state.t0=0;state.offset=0;state.dirty=false;state.markers=[];
    state.undo.length=0;state.redo.length=0;
    [['กลอง',COLS[0],'drums'],['เบส',COLS[1],'bass'],['กีตาร์',COLS[5],'guitar'],['คีย์บอร์ด',COLS[7],'keys'],['ดนตรีอื่นๆ',COLS[2],'other'],['ร้อง',COLS[3],'vocals']]
      .forEach(([n,c,k])=>{const t=addAudioTrack(n,c);t.stem=k});
    renderAll();
  }

  /* persistence — buffers as wav in idb */
  function idb(){return new Promise((ok,no)=>{const r=indexedDB.open('setsod-data-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
  async function saveProject(){
    const bufs={};
    // 1.0.32: Uint8Array (structured clone) — a plain number array of every byte blew up memory on long songs
    const used=new Set();for(const t of state.tracks.concat(ghostTracks()))for(const c of t.clips||[])used.add(c.buf);
    const RAW={targetPeak:1e9,maxGain:1}; // 1.0.35: store TRUE levels (peak-normalising every stem on save broke mix − stem after reload)
    for(const [id,buf] of state.buffers){if(used.has(id))bufs[id]=bufToWavU8(buf,RAW)} // skip stale click buffers from every nom rebuild (was saved too → 95 MB for 30 s)
    if(state.mixBuf)bufs.__mix=bufToWavU8(state.mixBuf,RAW);
    const proj={v:1,beatV:132,lvl:1,title:state.title,bpm:state.bpm,t0:saneT0(state.t0,state.bpm),markers:state.markers||[],recipe:state.recipe||null,maxCut:!!state.maxCut,deepClean:!!state.deepClean,ghosts:ghostTracks(),tracks:state.tracks.map(t=>({...t,clips:t.clips.map(c=>({...c,peaks:null}))})),bufs,savedAt:Date.now()};
    const db=await idb();
    await new Promise((ok,no)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(proj,'current');tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});
    state.dirty=false;ui.toast?.('บันทึกในเบราว์เซอร์แล้ว');
    return proj;
  }
  /** 📁 → ส่งออกไฟล์โปรเจกต์ (JSON with audio) — separate from บันทึก since 1.0.31 */
  // 1.0.32: binary container (JSON header + raw WAV bytes) — JSON.stringify of the audio threw "Invalid string length" on long songs
  async function exportProjectFile(){
    const proj=await saveProject();
    const idx={},parts=[];let off=0;
    for(const [id,u8] of Object.entries(proj.bufs||{})){idx[id]=[off,u8.byteLength];parts.push(u8);off+=u8.byteLength}
    const head=new TextEncoder().encode(JSON.stringify({...proj,bufs:undefined,bufIndex:idx}));
    const pre=new Uint8Array(12);pre.set(new TextEncoder().encode('SSDPROJ1'),0);new DataView(pre.buffer).setUint32(8,head.byteLength,true);
    const blob=new Blob([pre,head,...parts],{type:'application/octet-stream'});
    const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=(state.title||'project')+'.setsod-project';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  /** restore the hidden original mix: 1.0.31 bufs.__mix · older projects had a muted 'mix' track → adopt it and drop the row */
  /** 1.0.33: projects saved ≤1.0.32 hold peak-normalised stems — recover each stem's true scale inside the mix
   *  (least squares: mix ≈ Σ a_k·stem_k on a decimated mono copy) so mute = exact mix − stem. */
  function ensureMixScales(){
    try{
      if(!state.mixBuf)return;
      const rows=[];
      for(const tr of state.tracks){if(tr.type!=='audio'||!tr.stem||tr.stem==='click'||tr.stem==='countin'||tr.stem==='mix')continue;
        for(const c of tr.clips){if(c.mixScale==null&&state.buffers.get(c.buf))rows.push({c,b:state.buffers.get(c.buf)})}}
      if(!rows.length)return;
      const all=[];for(const tr of state.tracks){if(tr.type!=='audio'||!tr.stem||['click','countin','mix'].includes(tr.stem))continue;for(const c of tr.clips){const b=state.buffers.get(c.buf);if(b)all.push({c,b})}}
      const mb=state.mixBuf,sr=mb.sampleRate,step=Math.max(4,Math.floor(mb.length/250000)),K=all.length;
      const mono=(b,i)=>{const a=b.getChannelData(0),r=b.numberOfChannels>1?b.getChannelData(1):a;return 0.5*(a[i]+r[i])};
      const AtA=Array.from({length:K},()=>new Float64Array(K)),Atb=new Float64Array(K),x=new Float64Array(K);
      for(let i=0;i<mb.length;i+=step){const t=i/sr;let ok=true;
        for(let k=0;k<K;k++){const {c,b}=all[k];const j=Math.round((t-(c.start||0)+(c.offset||0))*b.sampleRate);x[k]=j>=0&&j<b.length?mono(b,j):0}
        const y=mono(mb,i);for(let a=0;a<K;a++){Atb[a]+=x[a]*y;for(let q=a;q<K;q++)AtA[a][q]+=x[a]*x[q]}}
      for(let a=0;a<K;a++){for(let q=0;q<a;q++)AtA[a][q]=AtA[q][a];AtA[a][a]+=1e-6+AtA[a][a]*1e-4}
      // Gaussian elimination
      const M=AtA.map((r,i)=>[...r,Atb[i]]);
      for(let i=0;i<K;i++){let p=i;for(let r=i+1;r<K;r++)if(Math.abs(M[r][i])>Math.abs(M[p][i]))p=r;[M[i],M[p]]=[M[p],M[i]];const d=M[i][i]||1e-12;
        for(let r=0;r<K;r++){if(r===i)continue;const f=M[r][i]/d;for(let q=i;q<=K;q++)M[r][q]-=f*M[i][q]}}
      all.forEach(({c},k)=>{const a=M[k][K]/(M[k][k]||1e-12);if(c.mixScale==null)c.mixScale=isFinite(a)?Math.max(0,Math.min(4,a)):1});
      state.dirty=true;
    }catch(e){}
  }
  function adoptMix(){
    if(state.buffers.has('__mix')){state.mixBuf=state.buffers.get('__mix');state.buffers.delete('__mix')}
    const i=state.tracks.findIndex(t=>t.stem==='mix');
    if(i>=0){const tr=state.tracks[i];const b=tr.clips[0]&&state.buffers.get(tr.clips[0].buf);if(b&&!state.mixBuf)state.mixBuf=b;for(const c of tr.clips)state.buffers.delete(c.buf);state.tracks.splice(i,1);if(state.sel)state.sel.track=Math.min(state.sel.track||0,Math.max(0,state.tracks.length-1))}
  }
  async function loadProjectFile(file){
    try{
      const ab=await file.arrayBuffer();const mg=new TextDecoder().decode(new Uint8Array(ab,0,Math.min(8,ab.byteLength)));let proj;
      if(mg==='SSDPROJ1'){const hl=new DataView(ab).getUint32(8,true);proj=JSON.parse(new TextDecoder().decode(new Uint8Array(ab,12,hl)));const base=12+hl;proj.bufs={};
        for(const [id,[o,l]] of Object.entries(proj.bufIndex||{}))proj.bufs[id]=new Uint8Array(ab,base+o,l)}
      else proj=JSON.parse(new TextDecoder().decode(new Uint8Array(ab)));
      if(!proj||typeof proj!=='object')throw new Error('ไฟล์ไม่ใช่โปรเจกต์ SetSod Data');
      stopPlay();state.buffers.clear();state.mixBuf=null;state.tracks=proj.tracks||[];state.title=proj.title||'Untitled';state.bpm=proj.bpm||120;state.markers=Array.isArray(proj.markers)?proj.markers:[];state.recipe=proj.recipe||null;state.maxCut=!!proj.maxCut;state.deepClean=!!proj.deepClean;if(state.deepClean){state.maxCut=true;Object.assign(UNMIX,UNMIX_CLEAN)}else Object.assign(UNMIX,UNMIX_DEFAULT);state.ghosts=Array.isArray(proj.ghosts)?proj.ghosts:[];if(proj.t0!=null)state.t0=+proj.t0||0;
      const a=ac();
      for(const id of Object.keys(proj.bufs||{})){
        const raw=proj.bufs[id];
        const u8=raw instanceof Uint8Array?raw:new Uint8Array(raw);
        const buf=await a.decodeAudioData(u8.buffer.slice(u8.byteOffset,u8.byteOffset+u8.byteLength));
        state.buffers.set(id,buf);
      }
      adoptMix();if(proj.lvl!==1)for(const t of state.tracks)for(const c of t.clips||[])c.mixScale=null; // saved ≤1.0.34: stems were peak-normalised on save
          ensureMixScales();
      for(const tr of state.tracks)for(const c of tr.clips){const b=state.buffers.get(c.buf);if(b)c.peaks=peaksOf(b)}
      state.dirty=false;renderAll();ui.onProjectLoaded?.(proj);ui.toast?.('โหลดโปรเจกต์แล้ว');
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
  let NOM_PREVIEW_BOOST=2.0,NOM_PREVIEW_DUCK=0.71; // +6 dB nom, −3 dB music bed while nom plays (preview only)
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
  function bufToWavU8(buf,opt){const ch=[];for(let c=0;c<buf.numberOfChannels;c++)ch.push(buf.getChannelData(c));return new Uint8Array(encodeWavPCM16(ch,buf.sampleRate,opt))}
  async function bufToWavArray(buf,opt){
    const ch=[];for(let c=0;c<buf.numberOfChannels;c++)ch.push(buf.getChannelData(c));
    return Array.from(new Uint8Array(encodeWavPCM16(ch,buf.sampleRate,opt)));
  }

  async function mixdown(){
    ui.toast?.('กำลังมิกซ์ดาวน์…');
    const sr=nativeSr();
    const length=Math.ceil(dur()*sr)||sr;
    // 1.0.33: music = exactly what is heard (mix − muted stems, solo, volume) — summing AI lanes ≠ the song
    const musicBuf=await renderMusicMono(null,sr,0,length/sr,2);
    const off=new OfflineAudioContext(2,length,sr);
    {const s0=off.createBufferSource();s0.buffer=musicBuf;s0.connect(off.destination);s0.start(0)}
    const anySolo=state.tracks.some(t=>t.solo);
    for(const tr of state.tracks){
      if(tr.type==='audio'&&tr.stem&&tr.stem!=='click'&&tr.stem!=='countin')continue; // already in musicBuf
      if(tr.mute||(anySolo&&!tr.solo&&tr.type!=='audio'))continue;
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
  function applyStemMutes(muteKeys,opt){
    const set=new Set(muteKeys||[]),preserve=!!(opt&&opt.preserveFine),only=opt&&opt.only?new Set(opt.only):null;
    for(const tr of state.tracks){
      if(tr.type!=='audio')continue;
      if(tr.stem==='click'||tr.stem==='countin'||tr.stem==='mix')continue;
      if(only&&!only.has(tr.stem)&&!only.has(tr.fineOf))continue; // 1.0.37: one chip changed → only its lane (+ its sub-lanes)
      const byParent=!!(tr.fineOf&&(set.has(tr.fineOf)||set.has(FINE_CHILD[tr.stem])));
      if(tr.fineOf&&preserve&&!byParent)continue; // keep a locally muted sub-stem (kick etc.)
      tr.mute=!!(tr.stem&&(set.has(tr.stem)||set.has(tr.fineOf)||set.has(FINE_CHILD[tr.stem])));
    }
    // Light UI only — renderAll during play freezes ScriptProcessor audio
    applyLiveMix();renderTracks();renderMixer();
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

  /**
   * Mix unmuted audio stems → mono music bed (for dual-mono ready file).
   * Prefer original-mix minus muted stems when available — much cleaner than
   * summing demucs parts (matches reference dual-mono packs like「เด๋อ」).
   */
  /** Music exactly as heard (1.0.33, t315u): with the original mix → mix + Σ (heard gain − 1)·stem·scale, sample-aligned
   *  the same way the preview mixer aligns them (bed at the first stem's start); without it → Σ heard stems.
   *  `tracks` is ignored for selection (kept for callers) — mute/solo/volume of the studio decide. */
  async function renderMusicMono(tracks,sr,padLead,totalDur,channels){
    sr=sr||nativeSr();
    const pad=Math.max(0,+padLead||0),nch=channels===2?2:1;
    const length=Math.max(1,Math.ceil((totalDur||dur())*sr));
    const music=musicTracks(); // incl. deleted AI lanes (ghosts, always silent)
    const off=new OfflineAudioContext(nch,length,sr);
    const merge=off.createGain();merge.gain.value=1;merge.connect(off.destination);
    function sched(buf,gain,at,offset,d){
      if(!buf||!(Math.abs(gain)>1e-6))return;
      const src=off.createBufferSource();src.buffer=buf;
      const g=off.createGain();g.gain.value=gain;src.connect(g);g.connect(merge);
      const maxOff=Math.max(0,buf.duration-1e-4),o=clamp(offset||0,0,maxOff);
      const dd=Math.min(d!=null?Math.max(0.001,d):buf.duration,Math.max(0.001,buf.duration-o));
      let t=at;let oo=o;if(t<0){oo+= -t;t=0}
      try{src.start(t,oo,Math.max(0.001,dd-(oo-o)))}catch(e){}
    }
    const heard=music.some(tr=>tr.clips.some(c=>heardGain(tr,c)>0));
    const clean=heard&&needsHeard()?await ensureHeard():null; // 1.0.35: clean mute (soft masks) — same bed as the preview
    if(clean){
      sched(clean,1,pad+(music[0].clips[0].start||0),0,null);
    }else if(state.mixBuf&&music.length){
      if(heard){
        const mixStart=music[0].clips[0]?music[0].clips[0].start||0:0; // same rule as the preview bed
        sched(state.mixBuf,1,pad+mixStart,0,null);
        for(const tr of music)for(const c of tr.clips){
          const buf=state.buffers.get(c.buf);if(!buf)continue;
          const d=heardGain(tr,c)-1;if(Math.abs(d)<1e-6)continue;
          sched(buf,d*(c.mixScale!=null?+c.mixScale:1),pad+(c.start||0),c.offset||0,c.dur);
        }
      }
    }else{
      for(const tr of music)for(const c of tr.clips){
        const g=heardGain(tr,c);if(!(g>0))continue;
        sched(state.buffers.get(c.buf),g,pad+(c.start||0),c.offset||0,c.dur);
      }
    }
    return await off.startRendering();
  }

  /**
   * Dual-mono ready WAV like reference「เด๋อ E」:
   * nom side = click+count-in only; other side = mono music only.
   * side 'R' → L=music R=nom (most common); 'L' → opposite.
   */
  /** 1.0.33: split a PCM16 stereo WAV into two mono PCM16 WAVs with the very same samples (L file, R file). */
  async function splitDualWav(blob){
    const ab=await blob.arrayBuffer(),dv=new DataView(ab);
    let p=12,fmt=null,data=null;
    while(p+8<=dv.byteLength){const id=String.fromCharCode(dv.getUint8(p),dv.getUint8(p+1),dv.getUint8(p+2),dv.getUint8(p+3)),sz=dv.getUint32(p+4,true);
      if(id==='fmt ')fmt={ch:dv.getUint16(p+10,true),sr:dv.getUint32(p+12,true),bits:dv.getUint16(p+22,true)};
      if(id==='data'){data={o:p+8,n:Math.min(sz,dv.byteLength-p-8)};break}
      p+=8+sz+(sz&1)}
    if(!fmt||!data||fmt.ch!==2||fmt.bits!==16)throw new Error('dual wav format');
    const frames=data.n>>2,src=new Int16Array(ab,data.o,frames*2);
    const one=c=>{const b=new ArrayBuffer(44+frames*2),v=new DataView(b),w=(o,t)=>{for(let i=0;i<4;i++)v.setUint8(o+i,t.charCodeAt(i))};
      w(0,'RIFF');v.setUint32(4,36+frames*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
      v.setUint32(24,fmt.sr,true);v.setUint32(28,fmt.sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,frames*2,true);
      const o=new Int16Array(b,44,frames);for(let i=0;i<frames;i++)o[i]=src[2*i+c];return new Blob([b],{type:'audio/wav'})};
    return[one(0),one(1)];
  }
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
    const ciMode=opt.ciMode==='over'?'over':'pre';
    const ci=Math.max(0,Math.min(4,+(opt.ci||0)|0));
    const style=opt.style||'normal',flourish=!!opt.flourish,t0=Math.max(0,+opt.t0||0);
    const rate=opt.rate===2?2:1,accent=opt.accent!==false;
    const spb=60/bpm,ciSec=ciMode==='pre'?ci*4*spb:0,total=ciSec+Math.max(0.5,+musicDur||1);
    const endT=Math.min(+musicDur||1,opt.endT!=null&&isFinite(opt.endT)?+opt.endT:Infinity); // song-time click stop
    const n=Math.max(1,Math.ceil(total*sr));
    const L=new Float32Array(n),R=new Float32Array(n);
    const hasVoice=CI_WORDS.some(w=>CI_VOICE[w]);
    // —— count-in (baked, pre-roll — old เด๋อ mode) ——
    // 2 bars: bar1 "one … two …" (beats 1+3), bar2 "one two three four" — like reference เด๋อ
    if(ciMode==='pre')for(let bi=0;bi<ci*4;bi++){
      const at=Math.floor(bi*spb*sr),b4=bi%4,bar=Math.floor(bi/4);
      const word=CI_WORDS[b4];
      let speak=true;
      if(ci>=2&&bar===0&&(b4===1||b4===3))speak=false; // half-time first bar
      let spoke=false;
      if(speak&&hasVoice)spoke=mixVoiceAt(L,R,at,word,sr,b4===0?1.15:1.0);
      // Louder transient clicks like reference「เด๋อ」nom channel
      if(speak||!hasVoice){
        if(b4===0)hitAt(L,R,at,sr,2200,spoke?0.55:1.25,18);
        else if(speak)hitAt(L,R,at,sr,1650,spoke?0.38:0.95,12);
      }
    }
    // —— song clicks (after any pre-roll), grid locked to music t0 ——
    const songBars=Math.ceil(Math.max(0,musicDur-t0)/(spb*4))+1;
    if(style==='ref'||style==='normal'){
      // Data 1.0.30: generic grid — rate (every beat / every 2 beats) · accent on/off · spoken cues
      const grid=clickGrid(t0,bpm,rate,endT);
      const words=cueWords(grid,opt.markers,t0,bpm,rate,{cues:!!opt.cues,ciMode,ci});
      grid.forEach((t,k)=>{
        const at=Math.floor((ciSec+t)*sr);if(at>=n)return;
        const acc=accent&&k%4===0,w=words.get(k);
        let spoke=false;if(w&&hasVoice)spoke=mixVoiceAt(L,R,at,w,sr,1.1);
        const amp=spoke?0.35:1;
        if(style==='ref')beepAt(L,R,at,sr,amp*(acc?1:0.9),acc);
        else hitAt(L,R,at,sr,acc?2100:1300,(acc?1.2:0.78)*amp,13);
      });
    }else for(let beat=0;;beat++){
      const t=ciSec+t0+beat*spb;if(t>=total-1e-6||t-ciSec>=endT)break;
      const at=Math.floor(t*sr);if(at>=n)break;
      const b4=beat%4;
      if(style==='rock'){
        if(b4===0)hitAt(L,R,at,sr,1900,1.05,15);
        else if(b4===2)hitAt(L,R,at,sr,1650,0.72,12);
        if(b4===1||b4===3)hitAt(L,R,at,sr,950,0.78,10);
      }else if(style==='samcha'){
        if(b4===0)hitAt(L,R,at,sr,2100,1.0,15);
        else if(b4===1){hitAt(L,R,at,sr,1450,0.48,9);hitAt(L,R,at+Math.floor(spb*0.5*sr),sr,1550,0.58,9);hitAt(L,R,at+Math.floor(spb*0.75*sr),sr,1550,0.58,9)}
        else if(b4===2){hitAt(L,R,at,sr,1350,0.42,9);hitAt(L,R,at+Math.floor(spb*0.5*sr),sr,1500,0.55,9);hitAt(L,R,at+Math.floor(spb*0.75*sr),sr,1500,0.55,9)}
        else hitAt(L,R,at,sr,1250,0.5,10);
      }else if(style==='slow'){
        if(b4===0)hitAt(L,R,at,sr,1600,0.95,18);
        else if(b4===2)hitAt(L,R,at,sr,1150,0.48,13);
      }
    }
    if(flourish&&style!=='ref'){
      for(let bar=7;bar<songBars;bar+=8){
        const tf=ciSec+t0+(bar*4+3)*spb;if(tf-ciSec>=endT)break;
        for(let k=0;k<6;k++){
          const at=Math.floor((tf+k*(spb/6))*sr);if(at<0||at>=n)break;
          hitAt(L,R,at,sr,2200-k*120,0.42+k*0.04,8);
        }
      }
    }
    const buf=floatToBuf(L,R,sr);
    return{buf,ciSec,totalDur:total,sr};
  }
  /** Studio preview opts from the recipe (Data 1.0.30) — same generator as export, no pre-roll shift unless 'pre'. */
  // pre-roll count-in bars that shift the music (0 when counting over the intro)
  function preCi(){const v=+(typeof document!=='undefined'&&document.getElementById('rCi')?.value)||0;return state.nomOpt&&state.nomOpt.ciMode==='over'?0:v}
  function previewNomOpt(){
    const o=state.nomOpt||{};
    return{style:o.style==='ref'?'ref':'normal',rate:o.rate===2?2:1,accent:o.accent!==false,ciMode:o.ciMode==='pre'?'pre':'over',
      ci:o.ciMode==='over'?(o.ci|0):0,cues:!!o.cues,markers:state.markers,endT:o.endT};
  }
  /** Mono sum of chosen stems (for the quiet guide bed on the nom side), regardless of mute. */
  async function renderStemsMono(keys,sr,padLead,totalDur){
    const set=new Set(keys||[]);
    const trs=state.tracks.filter(t=>t.type==='audio'&&t.stem&&t.clips.length&&(set.has(t.stem)||set.has(t.fineOf)||set.has(FINE_CHILD[t.stem])));
    if(!trs.length)return null;
    const length=Math.max(1,Math.ceil((totalDur||dur())*sr));
    const off=new OfflineAudioContext(1,length,sr);
    for(const tr of trs)for(const c of tr.clips){
      const buf=state.buffers.get(c.buf);if(!buf)continue;
      const src=off.createBufferSource();src.buffer=buf;src.connect(off.destination);
      try{src.start(Math.max(0,+padLead||0),clamp(c.offset||0,0,Math.max(0,buf.duration-1e-4)))}catch(e){}
    }
    return await off.startRendering();
  }
  /** Mastered dual-mono like the reference: music −11 LUFS (TP-safe limit), nom peaks −0.5 dBFS, optional guide bed. */
  function makeRefDualBlob(musicMonoBuf,nomBuf,side,opt){
    opt=opt||{};const sr=nomBuf.sampleRate;
    const mono=b=>{if(!b)return null;if(b.numberOfChannels<2)return b.getChannelData(0);const a=b.getChannelData(0),c=b.getChannelData(1),o=new Float32Array(b.length);for(let i=0;i<o.length;i++)o[i]=0.5*(a[i]+c[i]);return o};
    const n=Math.max(musicMonoBuf.length,nomBuf.length);
    const pad=x=>{if(!x)return null;if(x.length===n)return x;const o=new Float32Array(n);o.set(x.subarray(0,Math.min(n,x.length)));return o};
    const music=pad(mono(musicMonoBuf)),nom=pad(mono(nomBuf)),guide=opt.guideBuf?pad(mono(opt.guideBuf)):null;
    const mm=opt.loud!==false?masterMusic(music,sr,opt.lufs!=null?opt.lufs:-11,opt.tpDb!=null?opt.tpDb:-1):{y:music,grDb:0,lufs:null};
    const nm=masterNom(nom,sr,opt.clickPeakDb!=null?opt.clickPeakDb:-0.5,guide,opt.guideDb!=null?opt.guideDb:-28);
    const chans=side==='L'?[nm,mm.y]:[mm.y,nm];
    const blob=new Blob([wav16(chans,sr)],{type:'audio/wav'});
    return{blob,report:{lufs:mm.lufs,grDb:mm.grDb,musicPeak:peakAbs(mm.y),nomPeak:peakAbs(nm),sr}};
  }
  /** Auto end marker time (song s) from the rendered music. */
  function autoEndT(musicMonoBuf,t0,bpm,rate,lead){
    const x=musicMonoBuf.getChannelData(0),sr=musicMonoBuf.sampleRate,skip=Math.floor((lead||0)*sr);
    return autoEnd(skip?x.subarray(skip):x,sr,t0,bpm,rate);
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
  // Nudge click-grid phase (t0). Replace click buffer in place — never full syncGuideTracks
  // while playing (that rebuilt tracks mid-mix and killed nom).
  function nudgeNom(deltaSec){
    state.t0=Math.max(0,Math.round(((+state.t0||0)+(+deltaSec||0))*1000)/1000);
    try{
      const bpm=state.bpm||120;
      const ci=preCi();
      const sr=nativeSr();
      const spb=60/bpm,ciSec=ci*4*spb;
      let musicDur=1;
      for(const tr of state.tracks){
        if(tr.type!=='audio'||!tr.stem||tr.stem==='click'||tr.stem==='countin')continue;
        for(const c of tr.clips){
          const b=state.buffers.get(c.buf);
          musicDur=Math.max(musicDur,b?b.duration:c.dur||0);
        }
      }
      const click=state.nomOpt?makeExportClickBuf(musicDur,bpm,sr,{...previewNomOpt(),t0:state.t0}).buf:makeClickBuf(musicDur,bpm,sr,{style:'normal',flourish:false,t0:state.t0});
      const cid=putBuf(click);
      let ct=state.tracks.find(t=>t.stem==='click');
      if(!ct){
        const nomV=state.nomVol!=null?state.nomVol:140;
        ct=addAudioTrack('เมโทรนอม / นอม','#45c4d4');ct.stem='click';ct.vol=nomV;
      }
      ct.mute=!state.metro;
      ct.clips=[{id:uid(),buf:cid,start:ciSec,offset:0,dur:click.duration,gain:1,peaks:peaksOf(click),name:'click'}];
      renderArrange();renderTracks();renderMixer();
      // Must reseed so new click buffer enters the mixer (once per nudge — not every menu)
      if(state.playing)softReseed(playheadT());
    }catch(e){}
    return state.t0;
  }
  // Re-run onset detect + rebuild nom so clicks lock to the song again
  function relockBeat(){
    const g=detectBeatGrid('drums');
    state.bpm=g.bpm;state.t0=g.t0;
    try{
      const bpmEl=typeof document!=='undefined'&&document.getElementById('bpm');
      if(bpmEl)bpmEl.value=String(Math.round(g.bpm*100)/100);
      const ci=preCi();
      syncGuideTracks({bpm:g.bpm,t0:g.t0,ci,metroOn:true,preview:true});
      state.metro=true;
      const m=typeof document!=='undefined'&&document.getElementById('chkMetro');if(m)m.checked=true;
    }catch(e){}
    return g;
  }
  // Beat grid: same onset idea as live SetSod detectBpm — prefer full mix (like analyzing the song
  // channel), then drums/bass. Returns {bpm, t0} where t0 = first downbeat (sec).
  // Data 1.0.31: whole-song beat grid (data-beat.js) — precise BPM (3 dp) + downbeat phase on beats 1&3.
  // Source = original mix (always present after AI split), else the loudest music track.
  function detectBeatGrid(){
    let buf=state.mixBuf||null;
    if(!buf){let best=null,bestR=-1;
      for(const tr of state.tracks){if(tr.type!=='audio'||!tr.clips[0]||tr.stem==='click'||tr.stem==='countin')continue;
        const b=state.buffers.get(tr.clips[0].buf);if(!b)continue;const d=b.getChannelData(0);let q=0;for(let i=0;i<d.length;i+=97)q+=d[i]*d[i];if(q>bestR){bestR=q;best=b}}
      buf=best}
    if(!buf)return{bpm:state.bpm||120,t0:+state.t0||0,conf:0};
    const L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L,m=new Float32Array(L.length);
    for(let i=0;i<m.length;i++)m[i]=0.5*(L[i]+R[i]);
    const r=detectBeat(m,buf.sampleRate);
    state.beatInfo=r;
    return{bpm:r.bpm,t0:r.t0,conf:r.conf};
  }
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
  const CI_VOICE={};const CI_LEAD=0.001;let CI_LOAD=null; // voices are lead-trimmed at load (1 ms kept) — 1.0.31
  function loadCiVoices(){
    if(CI_LOAD)return CI_LOAD;
    CI_LOAD=(async()=>{
      try{
        const a=ac();
        await Promise.all(CI_WORDS.map(async w=>{
          try{
            const r=await fetch('sfx/ci-'+w+'.mp3');if(!r.ok)return;
            const b=await a.decodeAudioData((await r.arrayBuffer()).slice(0));
            // 1.0.31: trim decoder priming / lead silence so the word attack lands on the nom click (Chromium kept ~13 ms of mp3 delay)
            const d0=b.getChannelData(0);let k=0;while(k<d0.length&&Math.abs(d0[k])<0.01)k++;k=Math.max(0,k-Math.round(0.001*b.sampleRate));
            if(k>0&&k<d0.length-64){const nb=a.createBuffer(b.numberOfChannels,b.length-k,b.sampleRate);for(let c=0;c<b.numberOfChannels;c++)nb.getChannelData(c).set(b.getChannelData(c).subarray(k));CI_VOICE[w]=nb}else CI_VOICE[w]=b;
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
    if(!ck&&on&&state.tracks.some(t=>t.clips&&t.clips.length&&t.stem&&t.stem!=='countin'&&t.stem!=='mix')){
      // Build click without ripping the mix while playing
      if(state.playing){try{nudgeNom(0);ck=state.tracks.find(t=>t.stem==='click')}catch(e){}}
      else{try{syncGuideTracks({metroOn:true,ci:0,preview:true});ck=state.tracks.find(t=>t.stem==='click')}catch(e){}}
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
    const t0=saneT0(Math.max(0,+(opts.t0!=null?opts.t0:state.t0)||0),bpm,(()=>{let m=0;for(const tr of state.tracks){if(tr.type!=='audio'||!tr.stem||tr.stem==='click'||tr.stem==='countin')continue;for(const c of tr.clips){const b=state.buffers.get(c.buf);m=Math.max(m,b?b.duration:(c.dur||0))}}return m})());
    const ci=Math.max(0,Math.min(4,+(opts.ci!=null?opts.ci:0)|0));
    const feel=opts.feel||'normal',flourish=!!opts.flourish;
    const metroOn=opts.metroOn!=null?!!opts.metroOn:!!state.metro;
    const preview=opts.preview!==false; // default: studio-safe click
    opts._wasPlaying=!!state.playing;
    // Pause mixer before ripping guide tracks out from under it
    if(state.playing){
      state.offset=playheadT();
      stopPlay();
      opts._wasPlaying=true;
    }
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
    const click=state.nomOpt?makeExportClickBuf(musicDur,bpm,sr,{...previewNomOpt(),t0}).buf:makeClickBuf(musicDur,bpm,sr,{style:clickStyle,flourish:clickFlour,t0});
    const cid=putBuf(click);
    const nomV=state.nomVol!=null?state.nomVol:140;
    const ct=addAudioTrack('เมโทรนอม / นอม', '#45c4d4');ct.stem='click';ct.vol=nomV;ct.mute=!metroOn;
    ct.clips.push({id:uid(),buf:cid,start:ciSec,offset:0,dur:click.duration,gain:1,peaks:peaksOf(click),name:'click'});

    renderAll();
    // If transport was running, rebuild mixer against new guide clips (don't leave orphan jobs)
    if(state.playing||opts._wasPlaying){
      const at=Math.max(0,state.offset||0);
      try{softReseed(at)}catch(e){}
    }
    return{bpm,t0,ci,ciSec,feel,musicDur};
  }

  function syncToolsInit(){syncTools()}

  // public API
  const api={
    state,newProject,loadStemChannels,importAudioToTrack,startPlay,stopPlay,seek,saveProject,mixdown,
    playTrack,applyLiveMix,addAudioTrack,addMidiTrack,deleteTrack,setTrackWaveZoom,setNomVol,renderAll,toggleRecord,getDur:dur,fmt,
    fineSplit,applyStemMutes,renderTrackWav,renderMusicMono,splitDualWav,heardGain,ensureMixScales,ensureHeard,needsHeard,heardReady,setMaxCut,getMaxCut:()=>!!state.maxCut,setDeepClean,getDeepClean:()=>!!state.deepClean,mixerInfo:()=>{const p=state._pull;return{mode:p?(p.wl?'worklet':'scriptprocessor'):null,wlReady:!!(state._wl&&state._wl.ready),wlErr:state._wl?.err||null,under:p?.wl?p.wl.under:null,cuts:p?.wl?p.wl.cuts:null}},setUnmix(o){Object.assign(UNMIX,o||{});state._heard=null;scheduleHeard();return{...UNMIX}},makeDualMonoBlob,makeExportClickBuf,
    makeClickWav,makeFlourishWav,bufToWavBlob,nativeSr,detectBeatGrid,relockBeat,nudgeNom,playheadT,
    copySelected,pasteClipboard,ensureMidiInst,MIDI_INST,scrubTo,
    syncGuideTracks,makeCountInBuf,makeClickBuf,loadCiVoices,setNomAudible,
    setNomPreview(b,d){if(b!=null)NOM_PREVIEW_BOOST=+b;if(d!=null)NOM_PREVIEW_DUCK=+d;return[NOM_PREVIEW_BOOST,NOM_PREVIEW_DUCK]},
    addCount,toggleCountAt,moveCount,deleteCount,setMarkers,countSpans,snapClick,clickStep,tapDownbeat,tapNow,exportProjectFile,musicStart,renderStemsMono,makeRefDualBlob,autoEndT,
    async boot(){bind();
      try{warmWorklet()}catch(e){} // 1.0.38: audio-thread output ready before the first ▶
      // Preload spoken one–two–three–four for Data count-in
      try{loadCiVoices()}catch(e){}
      // scroll sync: track headers follow the lane vertical scroll
      try{
        const wrap=$('lanesWrap'),heads=$('trackHeads'),mw=$('masterWrap'),rw=document.querySelector('.ruler-wrap');
        if(wrap&&heads)wrap.addEventListener('scroll',()=>{
          heads.scrollTop=wrap.scrollTop;
          if(mw)mw.scrollLeft=wrap.scrollLeft;
          if(rw)rw.scrollLeft=wrap.scrollLeft;
        },{passive:true});
      }catch(e){}
      // restore last saved project from IndexedDB when present; else empty project
      let restored=false;
      try{
        const db=await idb();
        const proj=await new Promise((ok,no)=>{const tx=db.transaction('projects','readonly');const g=tx.objectStore('projects').get('current');g.onsuccess=()=>ok(g.result);g.onerror=()=>no(g.error)});
        if(proj&&proj.tracks&&proj.bufs){
          stopPlay();state.buffers.clear();state.mixBuf=null;state.tracks=proj.tracks||[];state.title=proj.title||'Untitled';state.bpm=proj.bpm||120;state.markers=Array.isArray(proj.markers)?proj.markers:[];state.recipe=proj.recipe||null;state.maxCut=!!proj.maxCut;state.deepClean=!!proj.deepClean;if(state.deepClean){state.maxCut=true;Object.assign(UNMIX,UNMIX_CLEAN)}else Object.assign(UNMIX,UNMIX_DEFAULT);state.ghosts=Array.isArray(proj.ghosts)?proj.ghosts:[];if(proj.t0!=null)state.t0=+proj.t0||0;
          const a=ac();
          for(const id of Object.keys(proj.bufs||{})){
            const raw=proj.bufs[id];const u8=raw instanceof Uint8Array?raw:new Uint8Array(raw);
            const buf=await a.decodeAudioData(u8.buffer.slice(u8.byteOffset,u8.byteOffset+u8.byteLength));
            state.buffers.set(id,buf);
          }
          adoptMix();if(proj.lvl!==1)for(const t of state.tracks)for(const c of t.clips||[])c.mixScale=null; // saved ≤1.0.34: stems were peak-normalised on save
          ensureMixScales();
          for(const tr of state.tracks)for(const c of tr.clips){const b=state.buffers.get(c.buf);if(b)c.peaks=peaksOf(b)}
          state.dirty=false;restored=true;renderAll();ui.onProjectLoaded?.(proj);
          ui.toast?.('โหลดโปรเจกต์ล่าสุด: '+(state.title||'Untitled'));
        }
      }catch(e){}
      if(!restored)newProject();
      syncToolsInit();
      // keyboard — guard non-Element targets (Document/Window) that lack .matches
      addEventListener('keydown',e=>{
        const t=e.target;
        if(t&&typeof t.matches==='function'&&t.matches('input,textarea,select'))return;
        if(e.code==='Space'){e.preventDefault();$('btnPlay').click()}
        if(e.key==='Delete'||e.key==='Backspace')deleteSelected();
        if(e.key==='s'&&!e.metaKey&&!e.ctrlKey){state.tool='split';syncTools();splitAt(state.offset)}
        if(e.key==='v'&&!e.metaKey&&!e.ctrlKey){state.tool='select';syncTools()}
        if(e.key==='d'&&!e.metaKey&&!e.ctrlKey){state.tool='draw';syncTools()}
        if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&(e.key==='c'||e.key==='C')){e.preventDefault();copySelected(false)}
        if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&(e.key==='x'||e.key==='X')){e.preventDefault();copySelected(true)}
        if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&(e.key==='v'||e.key==='V')){e.preventDefault();pasteClipboard()}
        if((e.metaKey||e.ctrlKey)&&e.key==='z'){e.preventDefault();undo()}
        if((e.metaKey||e.ctrlKey)&&e.key==='y'){e.preventDefault();redo()}
      });
    }
  };
  return api;
}
