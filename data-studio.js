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
    undo:[],redo:[],dirty:false,clipBoard:null
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
  // min/max + RMS peaks. Mild global normalize only — never per-window boost
  // (that turned demucs near-silence into solid filled blocks).
  // Bins below ~2.5% of peak = true silence → stay flat.
  function peaksOf(buf,bins){
    const L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L;
    const n=L.length;
    const nb=Math.max(1200,Math.min(bins||Math.ceil(buf.duration*400),12000));
    const step=Math.max(1,Math.floor(n/nb)),out=new Float32Array(Math.ceil(n/step)*2);
    let peak=0;
    for(let i=0,o=0;i<n;i+=step,o+=2){
      let mn=1,mx=-1,ss=0,cnt=0;const e=Math.min(n,i+step);
      for(let j=i;j<e;j+=2){
        const v=(L[j]+(R[j]||L[j]))*0.5;
        if(v<mn)mn=v;if(v>mx)mx=v;ss+=v*v;cnt++;
      }
      if(mn>mx){mn=0;mx=0}
      const rms=cnt?Math.sqrt(ss/cnt):0;
      const span=Math.max(Math.abs(mn),Math.abs(mx),rms*1.4);
      out[o]=-span;out[o+1]=span;
      if(span>peak)peak=span;
    }
    const floor=peak*0.025;
    const g=(peak>1e-4&&peak<0.35)?Math.min(0.75/peak,3.5):1;
    for(let i=0;i<out.length;i+=2){
      const s=Math.max(Math.abs(out[i]),Math.abs(out[i+1]));
      if(s<floor){out[i]=0;out[i+1]=0;continue}
      if(g!==1){out[i]=clamp(out[i]*g,-1,1);out[i+1]=clamp(out[i+1]*g,-1,1)}
    }
    return out;
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
      by.bass={L,R};
    }catch(e){}
  }
  /**
   * Rebuild EVERY named stem so graphs/audio are continuous for ทำดาต้า.
   * Named stem K = soft blend of demucs[K] with (mix − other named stems).
   * Excludes "other" from the subtract so energy Demucs dumped there comes back.
   * Then other = mix − Σnamed so the set still sums ≈ mix.
   */
  function rebuildStemsComplete(by,mix){
    try{
      if(!mix||!mix.L||!by)return;
      const named=['drums','bass','guitar','piano','vocals'];
      const n=mix.L.length;
      const mR=mix.R&&mix.R.length===n?mix.R:mix.L;
      const src={};
      for(const k of [...named,'other']){
        if(!by[k]||!by[k].L||by[k].L.length!==n)continue;
        src[k]={L:by[k].L,R:(by[k].R&&by[k].R.length===n)?by[k].R:by[k].L};
      }
      if(Object.keys(src).length<2)return;
      let mixPeak=0;const step=Math.max(1,(n/200000)|0);
      for(let i=0;i<n;i+=step){
        const a=mix.L[i]<0?-mix.L[i]:mix.L[i],b=mR[i]<0?-mR[i]:mR[i];
        if(a>mixPeak)mixPeak=a;if(b>mixPeak)mixPeak=b;
      }
      if(mixPeak<1e-4)return;
      const thr=mixPeak*0.035;
      for(const k of named){
        if(!src[k])continue;
        const L=src[k].L,R=src[k].R;
        const oL=new Float32Array(n),oR=new Float32Array(n);
        let env=0;const atk=0.12,rel=0.008;
        for(let i=0;i<n;i++){
          let aL=mix.L[i],aR=mR[i];
          for(const j of named){
            if(j===k||!src[j])continue;
            aL-=src[j].L[i];aR-=src[j].R[i];
          }
          const sL=L[i],sR=R[i];
          const sMag=Math.max(sL<0?-sL:sL,sR<0?-sR:sR);
          const aMag=Math.max(aL<0?-aL:aL,aR<0?-aR:aR);
          env+=(sMag>env?atk:rel)*(sMag-env);
          // Demucs loud → keep it; Demucs quiet → take complement (continuous graph)
          let keep=1;
          if(env<thr)keep=Math.max(0.05,env/thr)*0.35;
          else if(env<thr*2.5)keep=0.35+(env-thr)/(thr*1.5)*0.65;
          else keep=1;
          if(aMag<thr*0.3)keep=1; // nothing useful in complement
          const g=1-keep;
          oL[i]=clamp(sL*keep+aL*g,-1,1);
          oR[i]=clamp(sR*keep+aR*g,-1,1);
        }
        by[k]={L:oL,R:oR};
      }
      // other = residual so Σ ≈ mix
      const oL=new Float32Array(n),oR=new Float32Array(n);
      for(let i=0;i<n;i++){
        let aL=mix.L[i],aR=mR[i];
        for(const j of named){
          if(!by[j])continue;
          aL-=by[j].L[i];aR-=by[j].R[i];
        }
        oL[i]=clamp(aL,-1,1);oR[i]=clamp(aR,-1,1);
      }
      by.other={L:oL,R:oR};
    }catch(e){}
  }
  function loadStemChannels({title,src,channels,sampleRate,mix}){
    mark();state.title=title||state.title;state.tracks=[];
    const by={};src.forEach((s,i)=>{by[s]=channels[i]});
    fillQuietBass(by,mix);
    rebuildStemsComplete(by,mix); // every named lane gets continuous audio+graph for ทำดาต้า
    // Mild boost only when a stem is quiet end-to-end
    for(const k of Object.keys(by))by[k]=peakNormLR(by[k],0.75);
    const sr=sampleRate||44100;
    // Keep original mix — mix-minus muted stems beats summing demucs parts for clean beds
    state.mixBuf=null;
    try{
      if(mix&&mix.L){
        const R=mix.R&&mix.R.length===mix.L.length?mix.R:mix.L;
        state.mixBuf=bufFromLR(mix.L,R,sr);
      }
    }catch(e){state.mixBuf=null}
    // Always show full-song reference (unmuted optional) — not forced through demucs gaps
    if(state.mixBuf){
      const t=addAudioTrack('ต้นฉบับ (เต็มเพลง)','#85909b');
      t.stem='mix';t.mute=true;t.vol=100;
      const id=uid();state.buffers.set(id,state.mixBuf);
      t.clips.push({id:uid(),buf:id,start:0,offset:0,dur:state.mixBuf.duration,gain:1,peaks:peaksOf(state.mixBuf),name:'mix'});
    }
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
        const ci=+(typeof document!=='undefined'&&document.getElementById('rCi')?.value)||0;
        const feel=(typeof document!=='undefined'&&document.getElementById('rFeel')?.value)||'normal';
        const flourish=!!(typeof document!=='undefined'&&document.getElementById('rFlourish')?.checked);
        syncGuideTracks({bpm:state.bpm,t0:state.t0||0,ci,feel,flourish,metroOn:!!state.metro,preview:true});
      }catch(e){}
    }
  }
  // Live mute/solo/vol — pull mixer reads tr.mute/vol/solo each quantum (no GainNode lag).
  function applyLiveMix(){
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
      return state._pull.from+(state._pull.frame/ac().sampleRate);
    }
    if(state.playing)return ac().currentTime-state.t0+state.offset;
    return state.offset;
  }
  // Sample helper for pull mixer
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
          gain:c.gain||1,len:L.length,guide:isGuide,role
        });
      }
    }
    const keep=a.createConstantSource();keep.offset.value=0;
    try{keep.start()}catch(e){}
    const sp=a.createScriptProcessor(2048,1,2);
    const pull={from:playFrom,frame:0,alive:true,sp,keep,mixMode};
    state._pull=pull;
    const lrOn=()=>!!state.listenLR;
    const nomRight=()=>(state.nomSide||'R')!=='L';
    sp.onaudioprocess=e=>{
      if(!state.playing||!pull.alive){pull.alive=false;return}
      const oL=e.outputBuffer.getChannelData(0);
      const oR=e.outputBuffer.getChannelData(1);
      oL.fill(0);oR.fill(0);
      const ctxSr=a.sampleRate,N=oL.length;
      const anySolo=state.tracks.some(t=>t.solo);
      const split=lrOn();
      const musicIsL=nomRight();
      const base=pull.from;
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
            if(split){gL+=xL;gR+=xR}else{mL+=xL;mR+=xR}
            continue;
          }
          if(cl.role==='sub'){
            // Subtract stem when it should NOT be heard (mute, or not solo while others solo)
            const shouldHear=!(tr.mute||(anySolo&&!tr.solo));
            if(shouldHear)continue; // keep it in the bed
            const vol=Math.max(0,(tr.vol||100)/100)*(cl.gain||1);
            mL-=sL*vol;mR-=sR*vol;
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
        if(split){
          const music=(mL+mR)*0.707,guide=(gL+gR)*0.707;
          if(musicIsL){oL[i]=music;oR[i]=guide}
          else{oL[i]=guide;oR[i]=music}
        }else{oL[i]=mL;oR[i]=mR}
      }
      pull.frame+=N;
    };
    sp.connect(masterBus);
    state.nodes.push(sp,keep);
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
    if(playT-(state._lastReseed||0)>=RESEED_EVERY){softReseed(playT);return}
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
    state.t0=when;state.playing=true;
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
    // free buffers only used by this track's clips
    const keep=new Set();
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

  /* ---------- render UI ---------- */
  function renderAll(){renderTracks();renderArrange();renderMixer();renderPiano();ui.onProject?.(state)}

  function renderTracks(){
    const box=$('trackHeads');if(!box)return;box.innerHTML='';
    state.tracks.forEach((tr,i)=>{
      const el=document.createElement('div');el.className='thead'+(state.sel.track===i?' on':'');el.dataset.i=i;
      const wz=+(tr.waveZoom||1);
      el.innerHTML=`<div class="tn"><i style="background:${tr.color}"></i><input value="${escAttr(tr.name)}" data-rn="${i}"><b>${tr.type==='midi'?'MIDI':'AUD'}</b>
          <button type="button" class="tb del" data-deltr="${i}" title="ลบแทร็กนี้">✕</button></div>
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
    const dpr=devicePixelRatio||1,h=wrap.clientHeight||72;
    cv.style.width=W+'px';cv.width=Math.round(W*dpr);cv.height=Math.round(h*dpr);
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    g.fillStyle='#0a0e14';g.fillRect(0,0,W,h);
    if(!buf){g.fillStyle='#445';g.font='12px NotoThai,sans-serif';g.fillText('ยังไม่มีเพลง — ลากไฟล์แยก AI หรือนำเข้าช่องจากไฟล์',12,h/2+4);return}
    let pk=state._mixPeaks;
    if(!pk||state._mixPeaksFor!==buf){pk=peaksOf(buf);state._mixPeaks=pk;state._mixPeaksFor=buf}
    const pairs=pk.length>=4&&pk.length%2===0;const bins=pairs?pk.length/2:pk.length;
    const mid=h/2,pad=3;
    let loc=0;
    for(let x=0;x<W;x+=Math.max(1,(W/600)|0)){
      const u=x/(W-1||1);const bi=Math.min(bins-1,Math.floor(u*bins));
      const mx=pairs?Math.max(Math.abs(pk[bi*2]),Math.abs(pk[bi*2+1])):(pk[bi]||0);
      if(mx>loc)loc=mx;
    }
    const amp=(mid-pad)*(loc>0.02&&loc<0.45?Math.min(0.75/loc,2.5):1);
    g.beginPath();g.moveTo(0,mid);
    for(let x=0;x<W;x++){
      const u=x/(W-1||1);const bi=Math.min(bins-1,Math.floor(u*bins));
      const mx=pairs?Math.max(Math.abs(pk[bi*2]),Math.abs(pk[bi*2+1])):(pk[bi]||0);
      g.lineTo(x,mid-mx*amp);
    }
    for(let x=W-1;x>=0;x--){
      const u=x/(W-1||1);const bi=Math.min(bins-1,Math.floor(u*bins));
      const mx=pairs?Math.max(Math.abs(pk[bi*2]),Math.abs(pk[bi*2+1])):(pk[bi]||0);
      g.lineTo(x,mid+mx*amp);
    }
    g.closePath();
    g.fillStyle='rgba(61,186,138,.45)';g.fill();
    g.strokeStyle='#3dba8a';g.lineWidth=1;g.stroke();
    // playhead mark on master
    const t=playheadT();
    g.fillStyle='var(--play,#ff6b3d)';g.fillStyle='#ff6b3d';
    g.fillRect(Math.max(0,t)*state.pxPerSec-1,0,2,h);
  }

  function drawClipWave(cv,clip,color,waveZoom){
    const parent=cv.parentElement;if(!parent)return;
    const dpr=devicePixelRatio||1,w=parent.clientWidth||Math.round(clip.dur*state.pxPerSec),h=parent.clientHeight||100;
    if(w<2)return;cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);cv.style.width=w+'px';cv.style.height=h+'px';
    const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    g.clearRect(0,0,w,h);
    let pk=clip.peaks;
    if(!pk||!pk.length){
      const buf0=state.buffers.get(clip.buf);
      if(buf0){pk=peaksOf(buf0);clip.peaks=pk}
    }
    if(!pk||!pk.length)return;
    const z=clamp(+(waveZoom||1),0.5,8);
    const mid=h/2,pad=2;
    const buf=state.buffers.get(clip.buf);const total=buf?buf.duration:clip.dur;
    const a0=clip.offset/total,a1=(clip.offset+clip.dur)/total;
    const pairs=pk.length>=4&&pk.length%2===0;
    const bins=pairs?pk.length/2:pk.length;
    // One amp for the visible clip — quiet mid gaps stay thin (real demucs silence)
    let loc=0;
    for(let x=0;x<w;x+=Math.max(1,(w/500)|0)){
      const u=a0+(a1-a0)*(x/(w-1||1));const bi=Math.min(bins-1,Math.floor(u*bins));
      const mx=pairs?Math.max(Math.abs(pk[bi*2]),Math.abs(pk[bi*2+1])):(pk[bi]||0);
      if(mx>loc)loc=mx;
    }
    const amp=(mid-pad)*z*(loc>0.02&&loc<0.4?Math.min(0.7/loc,2.8):1);
    const floor=loc*0.03;
    g.beginPath();g.moveTo(0,mid);
    for(let x=0;x<w;x++){
      const u=a0+(a1-a0)*(x/(w-1||1));const bi=Math.min(bins-1,Math.floor(u*bins));
      let mx=pairs?Math.max(Math.abs(pk[bi*2]),Math.abs(pk[bi*2+1])):(pk[bi]||0);
      if(mx<floor)mx=0;
      g.lineTo(x,mid-Math.max(mx>1e-5?1:0,mx*amp));
    }
    for(let x=w-1;x>=0;x--){
      const u=a0+(a1-a0)*(x/(w-1||1));const bi=Math.min(bins-1,Math.floor(u*bins));
      let mx=pairs?Math.max(Math.abs(pk[bi*2]),Math.abs(pk[bi*2+1])):(pk[bi]||0);
      if(mx<floor)mx=0;
      g.lineTo(x,mid+Math.max(mx>1e-5?1:0,mx*amp));
    }
    g.closePath();
    g.globalAlpha=.55;g.fillStyle=color;g.fill();
    g.beginPath();
    for(let x=0;x<w;x++){
      const u=a0+(a1-a0)*(x/(w-1||1));const bi=Math.min(bins-1,Math.floor(u*bins));
      let mx=pairs?Math.max(Math.abs(pk[bi*2]),Math.abs(pk[bi*2+1])):(pk[bi]||0);
      if(mx<floor)mx=0;
      const y=mid-mx*amp;if(x)g.lineTo(x,y);else g.moveTo(x,y);
    }
    g.globalAlpha=.95;g.strokeStyle=color;g.lineWidth=1;g.stroke();
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
        <div class="eqcol">
          <label class="eqrow"><span>Lo</span><input type="range" min="-12" max="12" step="1" value="${tr.eq.lo}" data-eq="lo" data-i="${i}"><b data-eqv="lo">${eqLabel(tr.eq.lo)}</b></label>
          <label class="eqrow"><span>Mid</span><input type="range" min="-12" max="12" step="1" value="${tr.eq.mid}" data-eq="mid" data-i="${i}"><b data-eqv="mid">${eqLabel(tr.eq.mid)}</b></label>
          <label class="eqrow"><span>Hi</span><input type="range" min="-12" max="12" step="1" value="${tr.eq.hi}" data-eq="hi" data-i="${i}"><b data-eqv="hi">${eqLabel(tr.eq.hi)}</b></label>
          <label class="eqrow"><span>Rv</span><input type="range" min="0" max="100" step="1" value="${(tr.rev||0)*100|0}" data-rev="${i}"><b data-eqv="rv">${(tr.rev||0)*100|0}</b></label>
        </div>
        <div class="fader-wrap"><input class="fader" type="range" min="0" max="200" value="${tr.vol}" data-vol="${i}" title="ระดับ ${tr.name}${tr.mute?' (มิวต์ — ค่าจะใช้ตอนเปิด M)':''}"></div>
        <span class="fader-val">${tr.vol}${tr.mute?' ·M':''}</span>
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
    $('chkLoop').onchange=e=>{state.loop=e.target.checked;renderArrange()};
    $('chkSnap').onchange=e=>state.snap=e.target.checked;
    $('bpm').onchange=e=>{mark();state.bpm=clamp(+e.target.value||120,40,240);renderArrange()};
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
    $('btnLoad').onclick=()=>$('fileProj').click();
    $('fileProj').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await loadProjectFile(f)};
    $('btnMixdown').onclick=()=>mixdown();
    $('btnNew').onclick=()=>{if(!state.dirty||confirm('เริ่มโปรเจกต์ใหม่?'))newProject()};

    $('trackHeads').onclick=e=>{
      const del=e.target.closest('[data-deltr]');if(del){deleteTrack(+del.dataset.deltr);return}
      const wz=e.target.closest('[data-wz]');if(wz){setTrackWaveZoom(+wz.dataset.wz,+wz.dataset.d);return}
      const m=e.target.closest('[data-m]');if(m){mark();const i=+m.dataset.m;state.tracks[i].mute=!state.tracks[i].mute;if(state.playOnly)state.playOnly=null;applyLiveMix();renderTracks();renderMixer();return}
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
      };
    }
    const nomSel=document.getElementById('rNom');
    if(nomSel){
      state.nomSide=nomSel.value==='L'?'L':'R';
      nomSel.addEventListener('change',()=>{
        state.nomSide=nomSel.value==='L'?'L':'R';
        // Live flag only — startPlay here caused freeze on every menu change
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
      const m=e.target.closest('[data-m]');if(m){mark();state.tracks[+m.dataset.m].mute=!state.tracks[+m.dataset.m].mute;if(state.playOnly)state.playOnly=null;applyLiveMix();renderTracks();renderMixer();return}
      const s=e.target.closest('[data-s]');if(s){mark();state.tracks[+s.dataset.s].solo=!state.tracks[+s.dataset.s].solo;if(state.playOnly)state.playOnly=null;applyLiveMix();renderTracks();renderMixer();return}
    };

    // arrange interactions + draggable red playhead
    const wrap=$('lanesWrap');
    const timeFromClientX=(clientX)=>{
      const lanes=$('lanes');if(!lanes)return 0;
      const rect=lanes.getBoundingClientRect();
      return clamp((clientX-rect.left+wrap.scrollLeft)/state.pxPerSec,0,dur());
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
    wrap.addEventListener('click',e=>{
      if(phDrag)return;
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
        const at=(e.clientX-rect.left+wrap.scrollLeft)/state.pxPerSec;
        try{await importAudioToTrack(ti,f,snapT(at))}catch(_){}};
      input.click();
    });

    // drag clips — blocked while scrubbing playhead so tracks don't slide with the red line
    let drag=null;
    wrap.addEventListener('pointerdown',e=>{
      if(phDrag)return;
      if(e.button!=null&&e.button!==0)return;
      if(e.target&&(e.target.id==='playhead'||e.target.closest?.('#playhead')))return;
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
    state._pull.from=want;
    state._pull.frame=0;
    state.t0=ac().currentTime;
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
      if(tr.stem==='click'||tr.stem==='countin'||tr.stem==='mix')continue;
      tr.mute=!!(tr.stem&&set.has(tr.stem));
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
  async function renderMusicMono(tracks,sr,padLead,totalDur){
    sr=sr||nativeSr();
    const pad=Math.max(0,+padLead||0);
    const length=Math.max(1,Math.ceil((totalDur||dur())*sr));
    const mutedMusic=state.tracks.filter(t=>t.type==='audio'&&t.mute&&t.stem&&t.stem!=='click'&&t.stem!=='countin'&&t.stem!=='mix'&&t.clips.length);
    const useMixMinus=!!(state.mixBuf&&mutedMusic.length&&mutedMusic.length<6);
    const off=new OfflineAudioContext(1,length,sr);
    const merge=off.createGain();merge.gain.value=1;merge.connect(off.destination);
    function scheduleBuf(buf,gain,at){
      if(!buf)return;
      const src=off.createBufferSource();src.buffer=buf;
      const g=off.createGain();g.gain.value=gain;
      src.connect(g);g.connect(merge);
      const maxOff=Math.max(0,buf.duration-1e-4);
      const dur0=Math.max(0.001,Math.min(buf.duration,maxOff));
      try{src.start(at,0,dur0)}catch(e){}
    }
    if(useMixMinus){
      // Clean bed: original mix − each muted stem (phase-aligned demucs cancel)
      scheduleBuf(state.mixBuf,1,pad);
      for(const tr of mutedMusic){
        for(const c of tr.clips){
          const buf=state.buffers.get(c.buf);if(!buf)continue;
          scheduleBuf(buf,-(tr.vol||100)/100,pad+(c.start||0));
        }
      }
      // Also add any unmuted stem that isn't in the mix path? All music stems are in mix.
      // If user lowered an unmuted stem's vol below 100, remix by scaling: skip for now (mute-centric).
    }else{
      for(const tr of tracks){
        if(!tr||tr.type!=='audio'||tr.mute||!tr.clips.length)continue;
        if(tr.stem==='click'||tr.stem==='countin'||tr.stem==='mix')continue;
        for(const c of tr.clips){
          const buf=state.buffers.get(c.buf);if(!buf)continue;
          const src=off.createBufferSource();src.buffer=buf;
          const g=off.createGain();g.gain.value=(tr.vol||100)/100*(c.gain||1);
          src.connect(g);g.connect(merge);
          const maxOff=Math.max(0,buf.duration-1e-4);
          const off0=clamp(c.offset||0,0,maxOff);
          const dur0=Math.min(Math.max(0.001,c.dur||0),Math.max(0.001,buf.duration-off0));
          try{src.start(pad,off0,dur0)}catch(e){}
        }
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
      // Louder transient clicks like reference「เด๋อ」nom channel
      if(speak||!hasVoice){
        if(b4===0)hitAt(L,R,at,sr,2200,spoke?0.55:1.25,18);
        else if(speak)hitAt(L,R,at,sr,1650,spoke?0.38:0.95,12);
      }
    }
    // —— song clicks (after count-in), grid locked to music t0 ——
    const songBars=Math.ceil(Math.max(0,musicDur-t0)/(spb*4))+1;
    for(let beat=0;;beat++){
      const t=ciSec+t0+beat*spb;if(t>=total-1e-6)break;
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
      }else{
        const accent=b4===0;hitAt(L,R,at,sr,accent?2100:1300,accent?1.2:0.78,13);
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
  // Nudge click-grid phase (t0). Replace click buffer in place — never full syncGuideTracks
  // while playing (that rebuilt tracks mid-mix and killed nom).
  function nudgeNom(deltaSec){
    state.t0=Math.max(0,Math.round(((+state.t0||0)+(+deltaSec||0))*1000)/1000);
    try{
      const bpm=state.bpm||120;
      const ci=+(typeof document!=='undefined'&&document.getElementById('rCi')?.value)||0;
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
      const click=makeClickBuf(musicDur,bpm,sr,{style:'normal',flourish:false,t0:state.t0});
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
      if(bpmEl)bpmEl.value=String(Math.round(g.bpm));
      const ci=+(typeof document!=='undefined'&&document.getElementById('rCi')?.value)||0;
      syncGuideTracks({bpm:g.bpm,t0:g.t0,ci,metroOn:true,preview:true});
      state.metro=true;
      const m=typeof document!=='undefined'&&document.getElementById('chkMetro');if(m)m.checked=true;
    }catch(e){}
    return g;
  }
  // Beat grid: same onset idea as live SetSod detectBpm — prefer full mix (like analyzing the song
  // channel), then drums/bass. Returns {bpm, t0} where t0 = first downbeat (sec).
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
    const rmsOf=b=>{
      if(!b)return 0;const d=b.getChannelData(0);let s=0,step=Math.max(1,(d.length/8000)|0);
      for(let i=0;i<d.length;i+=step){const v=d[i];s+=v*v}return s;
    };
    // Auto like SetSod web: lock from the whole song first (mix), not a sparse demucs drum lane
    let buf=state.mixBuf||null;
    if(buf&&rmsOf(buf)<1e-6)buf=null;
    if(!buf&&preferStem){buf=pick(preferStem);if(buf&&rmsOf(buf)<1e-6)buf=null}
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
      // Snap phase to strong onsets (prefer early kicks within first ~8 bars)
      let snap=bestOff;let snapSc=-1;
      const early=onsets.filter(o=>o<spb*32).slice(0,80);
      for(const o of (early.length?early:onsets.slice(0,40))){
        // Candidate: shift bestOff so a grid line lands on this onset
        const cand=o-Math.round((o-bestOff)/spb)*spb;
        const d=Math.abs(cand-bestOff);if(d>spb*0.55)continue;
        const i=Math.floor(o/hopSec);
        // Prefer downbeats (beat 0) and earlier song position
        const b4=((Math.round((o-cand)/spb)%4)+4)%4;
        const sc=(flux[i]||0)*(b4===0?1.8:b4===2?1.15:0.7)+1/(1+d*8)+1/(1+o);
        if(sc>snapSc){snapSc=sc;snap=Math.max(0,cand)}
      }
      // Micro-fit: maximize flux on beat-1 over first 16 bars around snap
      let fine=snap,fineSc=-1;
      for(let d=-8;d<=8;d++){
        const off=snap+d*(spb/64);if(off<0)continue;let sc=0;
        for(let bi=0;bi<64;bi++){
          const i=Math.floor((off+bi*spb)/hopSec);if(i>=n)break;
          const b4=bi%4;sc+=flux[i]*(b4===0?2:b4===2?1.1:0.35);
        }
        if(sc>fineSc){fineSc=sc;fine=off}
      }
      t0=Math.round(Math.max(0,fine)*1000)/1000;
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
    const t0=Math.max(0,+(opts.t0!=null?opts.t0:state.t0)||0);
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
    const click=makeClickBuf(musicDur,bpm,sr,{style:clickStyle,flourish:clickFlour,t0});
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
    applyStemMutes,renderTrackWav,renderMusicMono,makeDualMonoBlob,makeExportClickBuf,
    makeClickWav,makeFlourishWav,bufToWavBlob,nativeSr,detectBeatGrid,relockBeat,nudgeNom,playheadT,
    copySelected,pasteClipboard,ensureMidiInst,MIDI_INST,scrubTo,
    syncGuideTracks,makeCountInBuf,makeClickBuf,loadCiVoices,setNomAudible,
    async boot(){bind();
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
