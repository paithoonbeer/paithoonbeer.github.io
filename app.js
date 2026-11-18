import {metroEl} from './metro.js';
const APPV='1.0.58';
// v1.0.15: catalog-rule reloads never fire while the account (cloud) panel is open/#account (that reload re-opened the panel → library/account flashing),
// at most once per kind per session (no reload loop), and drop #account so the panel is not re-opened by the reload.
function catRl(k){try{if(sessionStorage.getItem('bp-catrl-'+k))return;if(document.body.classList.contains('acp-on')||location.hash==='#account'){window.__catRlP=k;return}sessionStorage.setItem('bp-catrl-'+k,'1');blog('info','catalog reload '+k);location.reload()}catch(e){}}
function catRlFlush(){const k=window.__catRlP;if(!k)return;window.__catRlP=0;setTimeout(()=>{if(!document.body.classList.contains('acp-on')&&location.hash!=='#account')catRl(k);else window.__catRlP=k},400)}

function bpMark(r){try{localStorage.setItem('bp-rl',JSON.stringify({r,t:Date.now()}))}catch(e){}}function bpReload(r){if(window.__bpRl)return;window.__bpRl=1;try{blog('warn','reload: '+r)}catch(e){}bpMark(r);location.reload()}
const LOGK='bp-log';function blog(lv,msg,extra){try{const L=JSON.parse(localStorage.getItem(LOGK)||'[]');L.push({t:new Date().toISOString(),lv,msg:String(msg).slice(0,500),x:extra?String(extra).slice(0,800):undefined,v:APPV});while(L.length>300)L.shift();localStorage.setItem(LOGK,JSON.stringify(L))}catch(e){}}
function toast(m,ms=4000,ok=false){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t)}t.textContent=m;t.classList.toggle('ok',!!ok);t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),ms)}
window.addEventListener('error',e=>{blog('error',e.message,(e.filename||'')+':'+(e.lineno||'')+' '+(e.error&&e.error.stack||''));toast('⚠️ เกิดข้อผิดพลาด: '+e.message)});
window.addEventListener('unhandledrejection',e=>{const r=e.reason;blog('error','unhandled: '+(r&&r.message||r),r&&r.stack);toast('⚠️ '+(r&&r.message||r))});

import {PitchShifter} from './soundtouch.js';
const $=i=>document.getElementById(i);
const esc=x=>String(x??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=x=>(x||'').normalize('NFC').replace(/\.[a-z0-9]{2,4}$/i,'').replace(/[’‘`]/g,"'").replace(/\s*\(\d+\)$/,'').replace(/[\s_]+/g,' ').trim().toLowerCase();
const sq=x=>(x||'').normalize('NFC').replace(/\u0e4d\u0e32/g,'\u0e33').replace(/[\u200b-\u200f\u2060\ufeff\s]/g,'').toLowerCase();
const SIDE={R:'นอมขวา',L:'นอมซ้าย',X:'ไฟล์ในเครื่อง'};
function badge(s,p){if(!s)return'';const sw=p&&p.swap;
 if(s.s=='X')return `<span class="sb sx">🎧 ไม่ทราบข้าง${sw?' (สลับ L/R อยู่)':''}</span>`;
 const r=s.s=='R';const eff=sw?!r:r;return `<span class="sb ${r?'sr':'sl'}">🎧 ${r?'นอมขวา':'นอมซ้าย'}${sw?` → สลับเป็น${eff?'ขวา':'ซ้าย'}แล้ว`:''}</span>`}
const fmt=s=>{s=Math.max(0,s||0);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')};
// ---------- IndexedDB ----------
const dbp=new Promise((ok,no)=>{const r=indexedDB.open('beerplayer',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('files',{keyPath:'name'});d.createObjectStore('prefs',{keyPath:'id'});d.createObjectStore('kv',{keyPath:'k'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
async function tx(st,mode,fn){const d=await dbp;return new Promise((ok,no)=>{const t=d.transaction(st,mode);const s=t.objectStore(st);const r=fn(s);t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)})}
const getAll=st=>tx(st,'readonly',s=>s.getAll());
// v1.0.41: Studio key/tempo changes are TEMPORARY until 💾 (same as the deck ± in Live, 1.0.32 sl.live rule).
// SP41: song id → its saved key/tempo while a Studio change is pending. Writes to the prefs store and the band live list
// keep the saved values until stuSave(); stuRevert() / changing song / leaving Studio drops the pending change.
const SP41=new Map();let SPX41=false;
function stuMode(){try{return !document.body.classList.contains('live')}catch(e){return false}}
// v1.0.43: the KEY is saved straight away (band members see it); only the Studio tempo stays pending until 💾
function stuHold(id,ch){try{if(LVFROM)return false}catch(e){}if(SPX41||!id||!ch||typeof ch!=='object')return false;const ks=Object.keys(ch);
 if(ks.length===1&&ks[0]==='key'){const o=SP41.get(id);if(o&&'key' in o){delete o.key;if(!Object.keys(o).length)SP41.delete(id)}try{stuBar()}catch(e){}if(stuMode())try{keyToast43(id)}catch(e){}return false}if(!ks.length||ks.some(k=>k!=='key'&&k!=='tempo'))return false;if(!SP41.has(id)&&!stuMode())return false;
 const o=SP41.get(id)||{};let p={};try{p=pref(id)||{}}catch(e){}for(const k of ks)if(!(k in o))o[k]=k==='key'?(p.key||0):(p.tempo||100);SP41.set(id,o);try{stuBar()}catch(e){}return true}
function keyToast43(id){clearTimeout(keyToast43.t);keyToast43.t=setTimeout(()=>{try{let m='🎹 บันทึกคีย์กับเพลงแล้ว';
 if(typeof LIVE!=='undefined'&&LIVE){if(LIVE.ro)m='🎹 บันทึกคีย์ในเครื่องนี้แล้ว (สิทธิ์ดูอย่างเดียว — วงไม่เห็น)';else if(LIVE.b)m='🎹 บันทึกคีย์แล้ว ทุกคนในวงเห็น';else m='🎹 บันทึกคีย์แล้ว · ซิงก์ลิสต์สด'}
 toast(m,1800,true)}catch(e){}},350)}
function stuMask(id,v){const o=SP41.get(id);return o?{...v,...o}:v}
const put=(st,v)=>{if(st=='prefs'&&v&&SP41.has(v.id))v=stuMask(v.id,v);const r=tx(st,'readwrite',s=>s.put(v));try{if(st=='prefs'||(st=='kv'&&v&&(v.k=='set'||v.k=='snote')))lvDirty()}catch(e){}return r};
const del=(st,k)=>tx(st,'readwrite',s=>s.delete(k));
const get=(st,k)=>tx(st,'readonly',s=>s.get(k));
// ---------- state ----------
let CAT=[],FILES=new Map(),PREF=new Map(),SET=[],view='P',chip='ทั้งหมด',FLD={list:[],mem:{}},FSEL=localStorage.getItem('bp-fsel')||'',FTGT=null,IMPMSG='',side=localStorage.getItem('bp-side')||'A';
const byNorm=new Map();// norm -> file name
const fileOf=song=>song.X?(song.bc&&!FILES.has(song.fn)?undefined:song.fn):(byNorm.get(norm(song.fn))||(song.id&&FILES.has('web:'+song.id)?'web:'+song.id:undefined));
const fmtOf=s=>{const f=fileOf(s);if(!f)return'';const r=FILES.get(f);return r&&r.src=='stems'?'STEMS':(r&&r.src=='web')||f.startsWith('web:')?'MP3':(f.match(/\.([a-z0-9]+)$/i)||[,'?'])[1].toUpperCase()};
const idOf=s=>s._id||(s.X?'X:'+s.fn:s.s+':'+s.fn);/*v1.83.8: _id keeps a catalog song's id stable when its นอม side is edited*/
const SONG=new Map();
function rebuildIndex(){byNorm.clear();for(const [n,r] of FILES){if(n.startsWith('web:'))continue;const k=norm(n),o=byNorm.get(k);if(!o||(FILES.get(o).src=='web'&&r.src!='web'))byNorm.set(k,n)}
 const matched=new Set();for(const s of CAT){const f=byNorm.get(norm(s.fn));if(f)matched.add(f)}
 for(const k of [...SONG.keys()])if(k.startsWith('X:'))SONG.delete(k);
 for(const n of FILES.keys())if(!n.startsWith('web:')&&!n.startsWith('stem:')&&!matched.has(n)){const s={X:1,s:'X',fn:n,f:'ไม่อยู่ในรายชื่อ',t:n.replace(/\.[^.]+$/,''),a:'',b:null,k:'',g:''};SONG.set(idOf(s),s)}}
const pref=id=>PREF.get(id)||{id,key:0,swap:false};
// ---------- audio ----------
let ctx,split,merge,split2,anL,anR,src=null,sh=null,startAt=0,offset=0,playing=false,cur=null,cache=new Map(),wake=null,ended=false,setIdx=-1;
function initAudio(){if(ctx)return;try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}ctx=new (window.AudioContext||window.webkitAudioContext)();
 ctx.onstatechange=()=>{blog('info','ctx '+ctx.state);if(ctx.state!=='running'&&window.__metro&&__metro.state.running)ctx.resume().catch(()=>{});if(playing&&ctx.state!=='running')intr83()};
 split=ctx.createChannelSplitter(2);merge=ctx.createChannelMerger(2);split2=ctx.createChannelSplitter(2);anL=ctx.createAnalyser();anR=ctx.createAnalyser();anL.fftSize=anR.fftSize=8192;
 gL=ctx.createGain();gR=ctx.createGain();cL=mkLim();cR=mkLim();mL=mkCeil(1);mR=mkCeil(1);split.connect(gL,0);split.connect(gR,1);gL.connect(cL);gR.connect(cR);cL.connect(mL);cR.connect(mR);
 mkMixer();split2.connect(anL,0);split2.connect(anR,1);wire(false)}
// v1.0.37: loudness + anti-clip. A DynamicsCompressor outputs 2 channels even when set to 1, and a StereoPanner fed 2 channels at pan ±1 sums L+R,
// so <=1.0.36 the one-page path played every song +6 dB louder AFTER its limiter (peaks ~+6 dBFS = hard clipping on the device), while the Dual/home bus
// (= the 1.0.36 home) had no doubling = ~6 dB quieter. Now every channel: limiter (mono, same settings) -> mkCeil: a mono WaveShaper that applies the
// +6.02 dB makeup (OUTMK) inside its curve and soft-saturates to a ceiling of -0.3 dBFS (linear below -1.9 dBFS). Never a StereoPanner after a limiter.
// 'ของเก่า' songs keep playing at the file's own level (one-page: raw path, no limiter; Dual: input pre-scaled by 1/OUTMK).
const OUTMK=2;const CEIL=Math.pow(10,-0.3/20);let CEILC=null;
function ceilCurve(){if(CEILC)return CEILC;const n=16385,K=0.8,c=new Float32Array(n);for(let i=0;i<n;i++){const x=(i/(n-1)*2-1)*OUTMK,a=Math.abs(x);c[i]=a<=K?x:Math.sign(x)*(K+(CEIL-K)*Math.tanh((a-K)/(CEIL-K)))}return CEILC=c}
function mkCeil(ch){const w=ctx.createWaveShaper();w.curve=ceilCurve();w.oversample='none';w.channelCount=ch;w.channelCountMode='explicit';w.channelInterpretation='speakers';return w}
let gL,gR,cL,cR,mL,mR;function mkLim(){const c=ctx.createDynamicsCompressor();c.threshold.value=-1;c.knee.value=0;c.ratio.value=20;c.attack.value=0.001;c.release.value=0.1;c.channelCount=1;c.channelCountMode='explicit';return c}
const isOld=id=>{const s=SONG.get(id);return !!s&&s.f=='ของเก่า'};
function wire(sw,raw){for(const n of [gL,gR,cL,cR,mL,mR])n.disconnect();const a=raw?gL:mL,b=raw?gR:mR;if(!raw){gL.connect(cL);gR.connect(cR);cL.connect(mL);cR.connect(mR)}a.connect(MX.f[0]);b.connect(MX.f[1]);applyMix()}
let NORM=true;
function gainDb(id){const s=SONG.get(id),p=pref(id);let g=0;if(NORM&&!isOld(id)){const f=s&&fileOf(s),r=f&&FILES.get(f);g=(r&&r.src!='web'&&r.gn!=null)?r.gn:(s&&s.gn!=null?s.gn:0)}return g+(p.trim||0)}
function applyGain(){if(!ctx||!cur)return;const v=Math.pow(10,gainDb(cur.id)/20);gL.gain.setTargetAtTime(v,ctx.currentTime,0.02);gR.gain.setTargetAtTime(v,ctx.currentTime,0.02);showVol()}
function showVol(){if(!cur){$('vol').textContent='';return}const p=pref(cur.id);$('vt').textContent=(p.trim>0?'+':'')+(p.trim||0)+' dB';$('vol').textContent=isOld(cur.id)?'ของเก่า: เล่นระดับเดิมของไฟล์ (ไม่ปรับ ไม่ลิมิต)':NORM?'ปรับเสียงรวม '+(gainDb(cur.id)>0?'+':'')+gainDb(cur.id).toFixed(1)+' dB':'';tg16($('nm'),'norm','ปรับเสียงให้เท่ากัน',!!NORM);$('nm').classList.toggle('on',NORM)}
async function measure(blob,side){const ab=await blob.arrayBuffer();const b=await new OfflineAudioContext(2,1,44100).decodeAudioData(ab);const ch=Math.min(b.numberOfChannels-1,side=='L'?1:0);
 const oc=new OfflineAudioContext(1,b.length,b.sampleRate);const src=oc.createBufferSource();const mono=oc.createBuffer(1,b.length,b.sampleRate);mono.copyToChannel(b.getChannelData(ch),0);src.buffer=mono;
 const hs=oc.createBiquadFilter();hs.type='highshelf';hs.frequency.value=1681;hs.gain.value=4;const hp=oc.createBiquadFilter();hp.type='highpass';hp.frequency.value=38;hp.Q.value=0.5;src.connect(hs);hs.connect(hp);hp.connect(oc.destination);src.start();
 const k=(await oc.startRendering()).getChannelData(0);const W=Math.floor(0.4*b.sampleRate),H=Math.floor(0.1*b.sampleRate),ms=[];
 for(let i=0;i+W<=k.length;i+=H){let s=0;for(let j=i;j<i+W;j++)s+=k[j]*k[j];ms.push(s/W)}
 const L=m=>-0.691+10*Math.log10(m);let g=ms.filter(m=>L(m)>-70);if(!g.length)return null;const rel=L(g.reduce((a,c)=>a+c,0)/g.length)-10;g=g.filter(m=>L(m)>rel);const I=L(g.reduce((a,c)=>a+c,0)/g.length);
 let pk=0;for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i+=1){const v=d[i]<0?-d[i]:d[i];if(v>pk)pk=v}}const P=20*Math.log10(pk||1e-9);
 return {I:+I.toFixed(1),P:+P.toFixed(1),gn:+Math.min(-15-I,-1-P+6).toFixed(1)}}
// v1.0.39: catalog audio comes from an ordered list of servers. A dead server (509 quota, CORS "Failed to fetch",
// 404, timeout, HTML error page) is skipped for 10 min and the next one is tried; the last good one is tried first.
const AUDIO_NEW='https://setsod-audio.setsod.workers.dev/audio/'; // Cloudflare Workers static assets (setsod-audio)
const AUDIO_BASES=[AUDIO_NEW,'https://beer-audio.web.app/audio/','drive:'];
const AUD={bad:{},ok:null,last:null};window.__aud=AUD;
function audBases(){const L=window.__AUDIO_BASES||(window.__AUDIO_BASE?[window.__AUDIO_BASE]:AUDIO_BASES);const v=L.filter(b=>b&&!b.includes('__SUB__'));
 const now=Date.now(),live=v.filter(b=>!(AUD.bad[b]>now)),pool=live.length?live:v;if(AUD.ok&&pool.includes(AUD.ok))return [AUD.ok,...pool.filter(b=>b!==AUD.ok)];return pool}
function audUrl(b,id){return b==='drive:'?'https://drive.usercontent.google.com/download?id='+encodeURIComponent(id)+'&export=download&confirm=t':b+id+'.mp3'}
async function fetchAudio(s){if(!s.id)throw new Error('ไม่มีไฟล์บนเว็บ');if(!navigator.onLine)throw new Error('ไม่มีเน็ต และเพลงนี้ยังไม่ได้โหลดเก็บ');
 const bases=audBases();let last=null,quotaHit=0;
 for(const b of bases){const url=audUrl(b,s.id);
  for(let a=0;a<2;a++){const ac=new AbortController();const to=setTimeout(()=>ac.abort(),window.__FETCH_TIMEOUT||45000);let dead=false,miss=false;
   try{const r=await fetch(url,{signal:ac.signal});
    if(!r.ok){miss=r.status===404||r.status===410;dead=[402,403,429,503,509].includes(r.status);if(dead)quotaHit=r.status;throw new Error(miss?'ไม่มีไฟล์นี้บนเซิร์ฟเวอร์':'เซิร์ฟเวอร์ตอบ '+r.status)}
    if(/text\/html/i.test(r.headers.get('content-type')||'')){dead=true;throw new Error('เซิร์ฟเวอร์ส่งหน้าเว็บแทนไฟล์เพลง')}
    const bl=await r.blob();clearTimeout(to);if(!bl.size)throw new Error('ไฟล์ว่าง');AUD.ok=b;AUD.last={b,id:s.id,ok:true};return bl}
   catch(e){clearTimeout(to);
    if(e.name=='AbortError')last=new Error('โหลดช้าเกินไป (หมดเวลา)');
    else if(e instanceof TypeError){dead=true;last=new Error('เชื่อมต่อเซิร์ฟเวอร์เพลงไม่ได้')} // CORS-less 509 page / DNS / network
    else last=e;
    blog('warn','fetch fail '+b+' try '+(a+1)+': '+last.message,url);
    if(!navigator.onLine)break;
    if(miss)break; // this server lacks the file: try the next one, keep using it for other songs
    if(dead){if(!(e instanceof TypeError)||a>0){AUD.bad[b]=Date.now()+600000;break}}
    await new Promise(x=>setTimeout(x,(window.__FETCH_GAP||600)*(a+1)))}}
  if(!navigator.onLine)break}
 AUD.last={id:s.id,ok:false,msg:last&&last.message};
 if(!navigator.onLine)throw new Error('ไม่มีเน็ต และเพลงนี้ยังไม่ได้โหลดเก็บ');
 if(quotaHit)try{quota(quotaHit)}catch(e){}
 throw new Error('เซิร์ฟเวอร์เพลงไม่ตอบทุกที่'+(last?' ('+last.message+')':'')+' — ลองใหม่ภายหลัง')}
function quota(c){const b=$('qb');b.style.display='block';b.textContent='⚠️ โควต้าโหลดเพลงจากเว็บวันนี้อาจเต็ม (รหัส '+c+') — เล่นได้เฉพาะเพลงที่โหลดเก็บไว้แล้ว ลองใหม่พรุ่งนี้'}
async function safePut(rec){try{await put('files',rec)}catch(e){const q=e&&(e.name=='QuotaExceededError'||/quota/i.test(e.message));blog('error','store fail '+rec.name+': '+(e&&e.name)+' '+(e&&e.message));throw new Error(q?'พื้นที่เครื่องเต็ม — ลบเพลงที่ไม่ใช้ในแท็บ 📥 แล้วลองใหม่':'บันทึกไฟล์ไม่สำเร็จ ('+(e&&e.name)+')')}}
async function storeBlob(s,blob){const n='web:'+s.id;await safePut({name:n,blob,size:blob.size,added:Date.now(),src:'web'});FILES.set(n,{name:n,size:blob.size,src:'web'});rebuildIndex()}
// v1.0.39: a catalog song that was played from the web is kept on the device (marked auto), so it is not downloaded
// again next time. Auto copies are capped (oldest-used first out); songs saved on purpose (📥) are never evicted.
const AC={cap:null,use:null};window.__ac=AC;
async function acUse(){if(AC.use)return AC.use;try{AC.use=(await get('kv','acuse'))?.v||{}}catch(e){AC.use={}}return AC.use}
function acSave(){clearTimeout(acSave.t);acSave.t=setTimeout(()=>{try{put('kv',{k:'acuse',v:AC.use||{}})}catch(e){}},1500)}
async function acCap(){if(window.__AC_CAP)return window.__AC_CAP;if(AC.cap)return AC.cap;let c=1.5e9;try{const e=await navigator.storage.estimate();if(e&&e.quota)c=Math.max(2e8,Math.min(3e9,e.quota*0.35))}catch(e){}AC.cap=c;return c}
async function acTouch(n){try{const f=FILES.get(n);if(!f||!f.auto)return;const u=await acUse();u[n]=Date.now();acSave()}catch(e){}}
async function acEvict(need){const u=await acUse();const cap=await acCap();const keep=new Set([cur&&cur.id]);try{const d=window.__dual&&__dual.state;if(d){keep.add(d.a);keep.add(d.b)}}catch(e){}const keepId=new Set([...keep].filter(Boolean).map(k=>{const q=SONG.get(k);return q&&q.id}));
 const autos=[...FILES.values()].filter(f=>f.auto&&f.src=='web');let tot=autos.reduce((a,f)=>a+(f.size||0),0);
 autos.sort((x,y)=>(u[x.name]||0)-(u[y.name]||0));let n=0;
 for(const f of autos){if(tot+need<=cap)break;const id=f.name.slice(4);if(keepId.has(id))continue; // never drop a song that sits on a deck / is playing
  try{await del('files',f.name);FILES.delete(f.name);delete u[f.name];tot-=f.size||0;n++}catch(e){}}
 if(n){acSave();try{rebuildIndex()}catch(e){}blog('info','autocache evict '+n)}return tot+need<=cap}
async function acStore(s,blob){try{if(localStorage.getItem('bp-autocache')==='0'||!s||!s.id||!blob||!blob.size)return;const n='web:'+s.id;if(FILES.has(n))return;
  await acEvict(blob.size);
  const put1=()=>safePut({name:n,blob,size:blob.size,added:Date.now(),src:'web',auto:1});
  try{await put1()}catch(e){if(!/เต็ม/.test(e.message||''))throw e;AC.cap=Math.max(2e8,(AC.cap||1.5e9)*0.7);await acEvict(blob.size*2);await put1()}
  FILES.set(n,{name:n,size:blob.size,src:'web',auto:1});const u=await acUse();u[n]=Date.now();acSave();try{rebuildIndex()}catch(e){}
 }catch(e){blog('warn','autocache skip '+(s&&s.id)+': '+(e&&e.message))}}
// v1.46: only one full-length decode at a time (raw bytes + decoded PCM of two songs at once spiked memory on iPhone)
let DECQ=Promise.resolve(),LOADT=0;
async function decode(id){if(cache.has(id))return cache.get(id);const p=DECQ.then(async()=>{const s=SONG.get(id);const fn=fileOf(s);let rec=fn&&await get('files',fn);if(rec&&rec.src=='stems')return await ST.decode(rec);let blob=rec?rec.blob:await fetchAudio(s);if(rec)acTouch(rec.name);else acStore(s,blob);rec=null;let ab=await blob.arrayBuffer();blob=null;return await new Promise((ok,no)=>ctx.decodeAudioData(ab,ok,no))});DECQ=p.catch(()=>{});cache.set(id,p);cacheCap(id);
 p.catch(()=>cache.delete(id));return p}
// v1.43: decoded AudioBuffers are ~10MB/min stereo; tapping (cue) many songs used to keep every one alive until the next load() -> iOS killed the tab (white flash + reload). Keep only cur/next/cue/just-requested.
function cacheCap(also){if(window.__nocap)return;const i=cur?SET.indexOf(cur.id):-1;const extra=(window.__dual&&typeof __dual.keepIds==='function')?__dual.keepIds():[];const keep=new Set([cur&&cur.id,i>=0?SET[i+1]:null,cue,also,...extra].filter(Boolean));for(const k of [...cache.keys()])if(!keep.has(k))cache.delete(k)}
function trim(keep){if(cue)keep=[...keep,cue];try{if(window.__dual&&__dual.keepIds)keep=[...keep,...__dual.keepIds()]}catch(e){}for(const k of [...cache.keys()])if(!keep.includes(k))cache.delete(k)}
function pos(){if(!cur)return 0;if(!playing)return offset;return sh?sh.timePlayed:ctx.currentTime-startAt}
function halt(){ST&&ST.halt();if(src){src.onended=null;try{src.stop()}catch(e){}src.disconnect();src=null}if(sh){try{sh.disconnect()}catch(e){}try{sh.off();sh._node.onaudioprocess=null;sh._filter.sourceSound.buffer=null;sh._filter.sourceSound=null;sh._filter=null;sh._node=null}catch(e){}sh=null}}
function stop(keep=true){if(playing)offset=pos();halt();playing=false;relWake();sync();saveState()}
function start(at){halt();if(typeof ciCancel=='function')ciCancel();const b=cur.buf;offset=Math.max(Math.min(at??offset,b.duration-0.05),typeof trS=='function'?Math.min(trS(cur.id),b.duration-0.05):0);const p=pref(cur.id);wire(p.swap,isOld(cur.id));applyGain();ended=false;fadeReset();
 if(!needSh(p)){if(b.__st)src=ST.play(b,offset);else{src=ctx.createBufferSource();src.buffer=b;src.connect(split)}src.onended=()=>{if(src&&playing)finish()};src.start(0,offset);startAt=ctx.currentTime-offset}
 else{sh=mkSh(b,()=>{if(playing)finish()});sh.pitchSemitones=p.key;sh.tempo=(p.tempo||100)/100;sh.percentagePlayed=offset/b.duration;sh.timePlayed=offset;sh.connect(split)}
 playing=true;getWake();sync()}
function mediaMeta(){try{if(!('mediaSession' in navigator)||!cur)return;const s=SONG.get(cur.id);navigator.mediaSession.metadata=new MediaMetadata({title:s.t,artist:s.a||'',album:'SetSod • '+(s.s=='R'?'นอมขวา':s.s=='L'?'นอมซ้าย':''),artwork:[{src:'icon-512.png',sizes:'512x512',type:'image/png'}]})}catch(e){}}
function msSetup(){if(!('mediaSession' in navigator))return;const H=(a,f)=>{try{navigator.mediaSession.setActionHandler(a,f)}catch(e){}};
 H('play',()=>{if(cur&&!playing){ctx.resume();start(ended?0:offset)}});H('pause',()=>{if(playing)stop()});H('stop',()=>{if(CNT)ciCancel();if(playing)stop();offset=0;sync()});
 H('nexttrack',()=>{const i=cur?SET.indexOf(cur.id):-1;if(i>=0&&SET[i+1])load(SET[i+1])});H('previoustrack',()=>{if(cur){const w=playing;stop();offset=0;if(w)start(0);sync()}});
 H('seekto',d=>{if(cur){const at=(typeof mkWin=='function'?mkWin().ts:0)+(d.seekTime||0);if(playing)start(at);else offset=at;sync()}})}
function saveState(){try{localStorage.setItem('bp-state',JSON.stringify({id:cur&&cur.id,pos:cur?pos():0,ended,t:Date.now()}))}catch(e){}}
setInterval(()=>{if(playing)saveState()},2000);window.addEventListener('pagehide',saveState);
function finish(){halt();playing=false;offset=0;ended=true;$('ps').textContent='✅ จบเพลง';$('sk').value=0;$('tm').textContent='0:00';relWake();render();autoNext()}
async function getWake(){try{if('wakeLock' in navigator&&!wake){wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>wake=null)}}catch(e){}}
function relWake(){if(wake){wake.release().catch(()=>{});wake=null}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible'){if(ctx&&ctx.state!=='running'&&playing)ctx.resume().catch(()=>{});if(playing)getWake()}else saveState()});
// v1.59: ONE shared AudioContext for player+metronome; resume on every tap; iOS silent-switch unlock
window.__bpCtx=()=>{initAudio();return ctx};
const SIL='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA';let silEl=null;
function bpUnlock(){try{if(navigator.audioSession&&navigator.audioSession.type!=='playback')navigator.audioSession.type='playback'}catch(e){}
 try{if(!navigator.audioSession){if(!silEl){silEl=new Audio(SIL);silEl.setAttribute('playsinline','');silEl.preload='auto'}silEl.play().catch(()=>{})}}catch(e){}
 try{if(ctx&&ctx.state!=='running'&&ctx.state!=='closed')ctx.resume().catch(()=>{})}catch(e){}}
['pointerdown','touchend','click','keydown'].forEach(t=>document.addEventListener(t,bpUnlock,{capture:true,passive:true}));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible'&&ctx&&ctx.state!=='running'&&(playing||(window.__metro&&__metro.state.running)))ctx.resume().catch(()=>{})});
addEventListener('pageshow',()=>{if(ctx&&ctx.state!=='running'&&ctx.state!=='closed')ctx.resume().catch(()=>{})});
async function load(id,autoplay=true){cancelCd();initAudio();ctx.resume();try{ciCancel();if(cur&&cur.id!==id){const rb=realBpm(cur.id);if(rb)LASTBPM={b:rb,id:cur.id}}}catch(e){}stop();if(cur&&cur.id!==id){const o=cur.id;cur=null;const keep=new Set([id,...((window.__dual&&__dual.keepIds&&__dual.keepIds())||[])]);if(!keep.has(o)){cache.delete(o);for(const k of [...REND.keys()])if(k.startsWith(o+'|'))REND.delete(k)}try{for(const k of [...cache.keys()])if(!keep.has(k))cache.delete(k)}catch(e){for(const k of [...cache.keys()])if(k!==id)cache.delete(k)}}LOADT=Date.now();const s=SONG.get(id);const my=Symbol();load.tok=my;loadingId=id;sync();
 $('pt').textContent=s.t+(s.a?' – '+s.a:'');$('ps').textContent='⏳ กำลังเตรียมเพลง...';
 try{const buf=await decode(id);if(load.tok!==my)return;loadingId=null;cur={id,buf};offset=0;mediaMeta();studioLoad();barDur();showKey();$('ps').textContent='';
  if(autoplay)startCI(trS(id));else if(load.resumeAt){offset=load.resumeAt;load.resumeAt=0;$('ps').textContent='⏯ กู้คืนตำแหน่ง '+fmt(offset)+' — แตะ ▶ เพื่อเล่นต่อ'}preloadNext();render()}catch(e){blog('error','play fail '+id,e.message);if(load.tok===my){loadingId=null;$('ps').textContent='❌ เล่นไม่ได้: '+e.message;try{toast('❌ เล่นไม่ได้: '+e.message,6000)}catch(x){}sync()}}}
// v1.83: the next song is decoded only when it is about to be needed (last 45 s, cued, pad-hold, or current ended) — 1 extra buffer max
function nxOk(nx){try{if(window.__nocap)return true;if(!cur||!cur.buf)return true;if(nx&&(nx===cue||(typeof PAD!=='undefined'&&PAD.hold===nx)))return true;if(ended||!playing)return !!ended;const p=pref(cur.id),r=(p.tempo||100)/100;const e=typeof effEnd=='function'?effEnd():cur.buf.duration;return (e-pos())/r<45+(AUTO&&AUTO.xf||0)}catch(e){return true}}
function preloadNext(){const i=SET.indexOf(cur?.id);setIdx=i;const keep=[cur.id];if(i>=0&&SET[i+1]&&SONG.get(SET[i+1])&&fileOf(SONG.get(SET[i+1]))){keep.push(SET[i+1]);const nx=SET[i+1],me=cur.id;setTimeout(()=>{if(!cur||cur.id!==me||loadingId||SET[SET.indexOf(me)+1]!==nx||!nxOk(nx))return;decode(nx).then(()=>{if(cur&&SET[SET.indexOf(cur.id)+1]==keep[1])$('ps').textContent=(playing||ended?$('ps').textContent:'')||'';}).catch(()=>{})},8000)}trim(keep);render()}
function showKey(){showVol();try{tempoUI()}catch(e){}try{mixUI();applyMix()}catch(e){}const p=cur?pref(cur.id):{key:0,swap:false};$('psd').innerHTML=cur?badge(SONG.get(cur.id),p):'';$('kv').textContent=cur?kl65(cur.id):'—';tg16($('sw'),'swap','สลับ L/R',!!p.swap);$('sw').classList.toggle('on',p.swap)}
async function setPrefFor(id,ch){if(ch&&!stuHold(id,ch))try{lvEdit(id,ch);if(ch.key!=null||ch.tempo!=null||'swap' in ch||'te' in ch||'ts' in ch||'trim' in ch)lvUser('field')}catch(e){}if(cur&&cur.id==id)return setPref(ch);const p={...pref(id),...ch};PREF.set(id,p);await put('prefs',p);render()}
async function setPref(ch){if(!cur)return;if(ch&&!stuHold(cur.id,ch))try{lvEdit(cur.id,ch);if(ch.key!=null||ch.tempo!=null||'swap' in ch||'te' in ch||'ts' in ch||'trim' in ch)lvUser('field')}catch(e){}const p={...pref(cur.id),...ch};PREF.set(cur.id,p);await put('prefs',p);showKey();
 if(playing&&('key' in ch||'tempo' in ch||'swap' in ch)){const at=pos();if(sh&&!('swap' in ch)){sh.pitchSemitones=p.key||0;sh.tempo=(p.tempo||100)/100}else if(!sh&&!needSh(p)&&!('swap' in ch)){}else start(at)}renderSoon()}
// v1.81.1: key/tempo taps used to rebuild the whole list right away (a big main-thread block while playing) — redraw a moment later, in idle time
function renderSoon(){clearTimeout(renderSoon.t);renderSoon.t=setTimeout(()=>{const f=()=>{try{render()}catch(e){}};window.requestIdleCallback?requestIdleCallback(f,{timeout:800}):f()},350)}
$('big').onclick=()=>{if(!cur)return;ctx.resume();if(CNT){ciCancel();return}if(playing){stop();return}bigPlay()};
function bigPlay(){const t0=trS(cur.id),at=ended?t0:offset;if(at<=t0+0.05)startCI(t0);else start(at)}
$('kd').onclick=()=>cur&&setPref({key:Math.max(-6,pref(cur.id).key-1)});
$('ku').onclick=()=>cur&&setPref({key:Math.min(6,pref(cur.id).key+1)});
$('sw').onclick=()=>cur&&setPref({swap:!pref(cur.id).swap});
// v1.0.40: the play bar (time / seek / length) counts inside the song's marks: 0:00 = start mark, length = end mark − start mark
function mkWin(){if(!cur||!cur.buf)return{ts:0,te:0,len:0};const d=cur.buf.duration;let ts=0,te=d;try{ts=trS(cur.id);te=trE(cur.id,d)}catch(e){}return{ts,te,len:Math.max(0.01,te-ts)}}
function barDur(){try{if(cur&&$('du'))$('du').textContent=fmt(mkWin().len)}catch(e){}}
let drag=false;$('sk').oninput=()=>{drag=true;if(cur)$('tm').textContent=fmt($('sk').value/1000*mkWin().len)};
$('sk').onchange=()=>{drag=false;if(!cur)return;const w=mkWin(),at=w.ts+$('sk').value/1000*w.len;if(playing)start(at);else{offset=at;ended=false}};
setInterval(()=>{if(cur&&playing&&pos()>=effEnd()-0.08){finish();return}if(cur&&!drag){const w=mkWin(),p=Math.max(0,Math.min(w.len,pos()-w.ts));$('tm').textContent=fmt(p);$('sk').value=1000*p/w.len;const dt=fmt(w.len);if($('du').textContent!==dt)$('du').textContent=dt}},250);
// ---------- UI ----------
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{{const pl=$('pl');if(pl&&pl.classList.contains('open')){pl.classList.remove('open');const e=$('exp');if(e)e.textContent='⌃'}}document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');view=b.dataset.v;chip='ทั้งหมด';render();scrollTo(0,0)});
$('q').oninput=()=>render();
function item(s,extra='',ctl){const id=idOf(s),has=!!fileOf(s),web=!!s.id||!!s.bc,dlq=DLQ.has(id),p=pref(id),inSet=SET.includes(id),now=cur?.id==id;
 // v1.0.47: 🗑 on EVERY library row (online catalog too) — tap still handled by libDel145
 // v1.0.48: when `extra` is set (Tonight setlist), it owns the whole .lictl (grip/folder/✕) — do not prepend fldBtn
 const delBtn=extra?'':`<button type="button" class="add" data-libdel145="${esc(id)}" aria-label="ลบจากคลัง" title="ลบจากคลัง">🗑</button>`;
 const ctlHtml=extra?extra:`${has?fldBtn(fileOf(s)):''}<button class="add ${inSet?'on':''}" data-add="${esc(id)}">${inSet?'✓':'＋'}</button>${delBtn}`;
 return `<li${now?' style="background:#0a2a12"':''}><button class="pbtn ${has||web?'':'dis'}" data-play="${esc(id)}">${icon(id)}</button><div class="i" data-cue="${esc(id)}">${th65(id)}<div class="t">${esc(s.t)}</div>${s.a?`<div class="a">${esc(s.a)}</div>`:''}
 <div class="m">${badge(s,p)} ${has?`<span class="fmt">${fmtOf(s)}</span> `:''}${has?'<span class="ok">✅ ในเครื่อง</span>':dlq?'<span style="color:#ff9f0a">⏳ กำลังโหลดเก็บ</span>':web?`<span class="no">${s.bc?'☁️ ในวง · ยังไม่โหลด':'☁️ ออนไลน์'}</span> <button class="add" style="min-height:34px;font-size:14px;padding:2px 8px" data-dl="${esc(id)}" aria-label="โหลดเก็บ" title="โหลดเก็บ">⬇️<span class="sr16">โหลดเก็บ</span></button>`:'<span class="no">ไม่มีไฟล์</span>'} • ${esc(s.f)}${s.b?' • '+s.b+' BPM':''}${(()=>{const t=kl65(id,1);return t?` • <b class="k65${p.key?' sh':''}">คีย์ ${t}</b>`:''})()}</div></div>${ctl?'<div class="lictl">':''}${ctlHtml}${ctl?'</div>':''}</li>`}
let loadingId=null;
function pstate(){return loadingId?'loading':playing?'playing':(cur&&!ended&&offset>0.05)?'paused':'stopped'}
function icon(id){const st=pstate();if(loadingId===id)return '⏳';return cur&&cur.id===id&&st==='playing'?'⏸':'▶'}
function sync(){try{stripDraw()}catch(e){}const st=pstate();try{if('mediaSession' in navigator){navigator.mediaSession.playbackState=st==='playing'?'playing':cur?'paused':'none'}}catch(e){}const b=$('big');b.textContent=st==='loading'?'⏳':st==='playing'?'⏸':'▶';b.classList.toggle('playing',st==='playing');document.body.dataset.ps=st;
 document.querySelectorAll('[data-play]').forEach(x=>{const id=x.dataset.play;const ic=icon(id);if(x.textContent!==ic)x.textContent=ic;x.classList.toggle('playing',ic==='⏸');const li=x.closest('li');if(li)li.style.background=(cur&&cur.id===id)?'#0a2a12':''})}
// v1.57: นอม filter bar only when this device has a นอม song: a song with a file on the device (imported or downloaded)
// whose side is L/R (catalog side, or side set in song info / synced settings) or that has L/R swap on.
function nomHas(){for(const [id,x] of SONG){if(!(x.s=='L'||x.s=='R'||(PREF.get(id)||{}).swap))continue;if(fileOf(x))return true}return false}
function segVis(){const h=nomHas(),g=$('seg');if(!h&&side!='A'){side='A';try{localStorage.setItem('bp-side','A')}catch(e){}}if(g&&segVis.v!==h){segVis.v=h;g.hidden=!h;g.style.display=h?'':'none'}return h}
window.__nom={has:nomHas,vis:()=>segVis.v,side:()=>side};
function render(){setTimeout(sync);{const mm=$('main');if(mm){if(view!=='P')mm.__h847=null;if(view!=='S')mm.__hS=null}}if(view=='M'){$('hd').style.display='none';const m=$('main');if(!m.contains(metroEl())){m.innerHTML='';m.appendChild(metroEl())}return}if(typeof drawCue=='function'&&cue)setTimeout(drawCue);const m=$('main');$('hd').style.display=view=='P'?'':'none';
 if(view=='P'){segVis();const EX=side=='R'?['ของเก่า']:side=='L'?['ต้องฟังเช็ก']:['ของเก่า','ต้องฟังเช็ก'];const fs=['ทั้งหมด','ช้า','มีเดียม','เร็ว','สากล',...EX,'✅ ในเครื่อง'];
  segVis();{const h=[['A','ทั้งหมด'],['R','🎧 นอมขวา'],['L','🎧 นอมซ้าย']].map(([k,l])=>`<button data-side="${k}" class="sg sg${k} ${side==k?'on':''}">${l}</button>`).join('');const g=$('seg');if(g.dataset.h!==h){g.dataset.h=h;g.innerHTML=h}}
  const base=side=='A'?(CAT.length?CAT:[...SONG.values()]):CAT.filter(s=>s.s==side);/*v1.0.0: no sample catalog → the library is the user's own songs*/const q=sq($('q').value);
  const filt=s=>chip=='ทั้งหมด'?!EX.includes(s.f):chip=='✅ ในเครื่อง'?!!fileOf(s):s.f==chip;
  const vis149=s=>!libHidden149(idOf(s));/*v1.0.49: honor band/local catalog hides*/
  $('chips').innerHTML=fs.map(x=>`<button class="${x==chip?'on':''}" data-chip="${x}">${x} (${base.filter(s=>vis149(s)&&(x=='ทั้งหมด'?!EX.includes(s.f):x=='✅ ในเครื่อง'?!!fileOf(s):s.f==x)).length})</button>`).join('');
  const L=(q?[...SONG.values()].filter(s=>vis149(s)&&sq(s.t+' '+s.a+' '+s.fn).includes(q)):(FSEL?[...SONG.values()].filter(s=>vis149(s)&&(s.X||side=='A'||s.s==side)&&(chip=='ทั้งหมด'||filt(s))&&fldOk(s)):base.filter(s=>vis149(s)&&filt(s)))).sort((a,b)=>a.t.localeCompare(b.t,'th'));
  const LK=side+'|'+chip+'|'+q+'|'+(FSEL||'')+'|'+L.length,pN=m.dataset.lk===LK?m.querySelectorAll(':scope>ul>li').length:0,SC=pN?scSave83(m):null;/*v1.83.3: redraw keeps rendered rows + scroll (tap/play/download no longer jumps to top)*/let N0=L.length>100?40:L.length;if(pN>N0)N0=Math.min(L.length,pN);{const H847=`${fldBar()}<ul>${L.slice(0,N0).map(s=>item(s)).join('')||'<li class="empty"><span class="ei">🔍</span>ไม่พบเพลง</li>'}</ul>`,K847=H847+'|'+LK+'|'+L.length;if(m.__h847===K847&&m.dataset.lk===LK&&m.querySelector(':scope>ul')){R847.skip++}else{R847.full++;m.innerHTML=H847;m.__h847=K847;m.dataset.lk=LK;if(SC)scRest83(SC);libMore(m,L,N0)}}}
 else if(view=='S'){try{setFix83()}catch(e){}{/* keep duration out of __hS so DUR updates only patch #stoth (no Tonight remount flash) */
  const HS=`<div class="sec"><h2 class="h2l16" aria-label="เพลย์ลิสต์คืนนี้"><span id="stoth">คืนนี้ · ${SET.length} เพลง</span></h2><div class="row"><button id="dlall">⬇️ โหลดทั้งลิสต์</button><button id="clr">ล้างลิสต์</button></div><div id="ckw"><button id="chk">✔️ เช็กเพลงคืนนี้</button><div id="chkr" class="small"></div></div><div id="showck"></div>
  <input id="sq" type="search" placeholder="🔍 ค้นเพลงในลิสต์ / เพิ่มเพลงเข้าลิสต์" autocomplete="off" style="margin-top:10px;width:100%"><div id="sqr"></div></div>
  <ul id="setul">${SET.map((id,i)=>{const s=SONG.get(id);if(!s)return missRow83(id,i);
   // v1.0.48: put ☰ grip first (away from ✕) so accidental taps near remove do not start a drag
   return item({...s,t:(i+1)+'. '+s.t},`<span class="dh" data-dh="${i}" title="ลากเพื่อย้าย" aria-label="ลากเพื่อย้าย">☰</span>${fileOf(s)?fldBtn(fileOf(s)):''}<button class="add rmb" data-rm="${i}" aria-label="ลบออกจากลิสต์">✕</button>`,1)}).join('')||'<li class="small empty"><span class="ei">🎤</span>ยังไม่มีเพลง — กด ＋ ที่รายชื่อเพลงเพื่อเพิ่ม</li>'}</ul>
  ${cur&&SET.indexOf(cur.id)>=0&&SET[SET.indexOf(cur.id)+1]?`<div class="sec"><button id="nx" style="width:100%;font-size:22px">⏭ เพลงถัดไป: ${esc(SONG.get(SET[SET.indexOf(cur.id)+1])?.t)}${cache.has(SET[SET.indexOf(cur.id)+1])?' (พร้อม)':''}</button></div>`:''}`;/*v1.84.10: same Tonight HTML still mounted → keep DOM (no flash)*/if(!(m.__hS===HS&&m.querySelector('#setul'))){m.__hS=HS;m.innerHTML=HS}
  {const TL=setTotLabel(),el=$('stoth');if(el){const tx='คืนนี้ · '+TL;if(el.textContent!==tx)el.textContent=tx;const h2=el.closest('h2');if(h2)h2.setAttribute('aria-label','เพลย์ลิสต์คืนนี้ '+TL)}}};
  drawAuto();$('chk').onclick=check;$('dlall').onclick=()=>enqueue(SET);$('clr').onclick=async()=>{if(confirm('ล้างเพลย์ลิสต์คืนนี้?')){SET=[];await saveSet();render()}};if($('nx'))$('nx').onclick=()=>load(SET[SET.indexOf(cur.id)+1])}
 else{const X=[...SONG.values()].filter(s=>s.X);m.innerHTML=`<div class="sec"><h2>📥 นำเพลงเข้าเครื่อง</h2>${fldMgr()}
  <label class="btn" style="display:block;text-align:center;font-size:22px;padding:18px">📂 เลือกไฟล์เพลงจากแอปไฟล์<input id="imp" type="file" multiple accept="audio/*,.mp3,.wav,.m4a,.aac" style="display:none"></label>
  <div class="st63imp"><label class="btn">🎚️ นำเข้า Stems (หลายไฟล์ / .zip)<input id="imps" type="file" multiple accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.zip" style="display:none"></label><label class="btn st63dir">📁 ทั้งโฟลเดอร์<input id="impd" type="file" webkitdirectory multiple style="display:none"></label><button class="btn" id="stai" hidden title="แยกเพลงเดียวเป็น กลอง/เบส/ร้อง/อื่นๆ ในเครื่องนี้">✦ แยก Stems ด้วย AI (ทดลอง)</button><div class="note" id="st63r">1 เพลง = หลายไฟล์แยกเครื่อง (กลอง เบส กีต้าร์ คีย์ ร้อง คลิก ไกด์…) ตั้งชื่อเครื่องให้อัตโนมัติจากชื่อไฟล์</div></div>
  <div id="impr" class="small" style="margin:8px 0">${IMPMSG}</div><div id="sto" class="small"></div>
  <p class="small">ไฟล์ในเครื่อง ${FILES.size} ไฟล์ • ตรงกับรายชื่อ ${FILES.size-X.length} • ไม่อยู่ในรายชื่อ ${X.length}</p>
  <h2>ไฟล์ที่ไม่อยู่ในรายชื่อ (เล่นได้)</h2></div><ul>${X.map(s=>item(s,`<button class="add" data-add="${esc(idOf(s))}">${SET.includes(idOf(s))?'✓':'＋'}</button><button class="add" data-delf="${esc(s.fn)}">🗑</button>`)).join('')}</ul>
  <div class="sec"><button id="delall" style="color:#ff453a">ลบไฟล์เพลงทั้งหมดในเครื่อง</button></div>
  <div class="sec"><button data-help="1" class="hw" style="width:100%;font-size:18px">❓ วิธีใช้ / แจ้งปัญหา</button></div><div class="sec"><h2>🛠 ระบบ / บันทึกข้อผิดพลาด</h2><div class="upd77s"><button type="button" class="hw" data-upd77="go" ${window.__swWaiting?'':'hidden'}>อัปเดตเวอร์ชัน</button><button type="button" class="hw" data-upd77="ck">ตรวจหาอัปเดต</button></div><label class="small" style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="cat100" ${cat100()?'checked':''}> 📚 แสดงคลังเพลงตัวอย่าง (ออนไลน์)</label><button type="button" class="hw" data-unhide149="1" style="width:100%;margin:8px 0;min-height:48px">👁 เพลงที่ซ่อนจากคลัง…</button><div class="small">เวอร์ชัน ${APPV} • บันทึก ${JSON.parse(localStorage.getItem(LOGK)||'[]').length} รายการ</div>
  <div class="row" style="margin-top:8px"><button id="lgv">ดูบันทึก</button><button id="lgx">ส่งออก</button><button id="lgc">ล้างบันทึก</button><button id="integ">ตรวจไฟล์ทั้งหมด</button></div><pre id="lgo" style="white-space:pre-wrap;font-size:12px;color:#aaa;max-height:300px;overflow:auto"></pre></div>`;
  $('imp').onchange=e=>importFiles([...e.target.files]);try{ST.bind()}catch(e){}
  $('lgv').onclick=()=>{$('lgo').textContent=JSON.parse(localStorage.getItem(LOGK)||'[]').slice(-80).reverse().map(l=>`${l.t.slice(5,19)} ${l.lv} ${l.msg}${l.x?' | '+l.x.slice(0,160):''}`).join('\n')||'(ว่าง)'};
  $('lgx').onclick=async()=>{if(await shareLog())return;const b=new Blob([JSON.stringify({v:APPV,ua:navigator.userAgent,log:JSON.parse(localStorage.getItem(LOGK)||'[]')},null,1)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='beer-player-log.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000)};
  $('lgc').onclick=()=>{if(confirm('ล้างบันทึก?')){localStorage.removeItem(LOGK);render()}};
  $('integ').onclick=async()=>{const o=$('lgo');const all=await getAll('files');let ok=0,bad=[];for(let i=0;i<all.length;i++){const f=all[i];if(f.src=='stems'){ok++;continue}o.textContent=`⏳ ตรวจ ${i+1}/${all.length}: ${f.name}`;try{const b=await new OfflineAudioContext(2,1,44100).decodeAudioData(await f.blob.arrayBuffer());if(!b.duration)throw 0;ok++}catch(e){bad.push(f.name);blog('error','integrity fail '+f.name)}}o.textContent=`✅ ปกติ ${ok} ไฟล์`+(bad.length?`\n❌ เสีย ${bad.length}: `+bad.join(', '):'')};$('delall').onclick=async()=>{if(confirm('ลบไฟล์เพลงทั้งหมดในเครื่อง?')){await tx('files','readwrite',s=>s.clear());FILES.clear();rebuildIndex();render()}};storage()}}
document.addEventListener('click',async e=>{const t=e.target.closest('[data-side],[data-vol],[data-au],[data-cancel],[data-cq],[data-cue],[data-dl],[data-play],[data-add],[data-chip],[data-up],[data-dn],[data-rm],[data-delf]');if(!t)return;const d=t.dataset;
 if(d.side){side=d.side;localStorage.setItem('bp-side',side);if(!['ทั้งหมด','ช้า','มีเดียม','เร็ว','สากล','✅ ในเครื่อง'].includes(chip))chip='ทั้งหมด';render();scrollTo(0,0)}
 else if(d.vol){if(d.vol=='n'){NORM=!NORM;await put('kv',{k:'norm',v:NORM});applyGain();showVol();tg16($('nm'),'norm','ปรับเสียงให้เท่ากัน',NORM)}else if(cur){const p=pref(cur.id);await setPrefFor(cur.id,{trim:Math.max(-12,Math.min(12,(p.trim||0)+(+d.vol)))});applyGain()}}
 else if(d.au){AUTO.on=!AUTO.on;if(!AUTO.on)cancelCd();saveAuto()}
 else if(d.cancel){cancelCd('⏹ ยกเลิกเล่นต่อแล้ว')}
 else if(d.dl){enqueue([d.dl])}
 else if(d.chip){chip=d.chip;render()}
 else if(d.play){const s=SONG.get(d.play);if(!fileOf(s)&&!s.id){alert('เพลงนี้ยังไม่มีในเครื่อง ไปที่แท็บ 📥 เพื่อนำเข้าไฟล์');return}if(cur?.id==d.play){ctx.resume();playing?stop():bigPlay();render()}else if(playing)chooser(d.play);else load(d.play)}
 else if(d.cue){openCue(d.cue)}
 else if(d.cq){cueAct(d.cq)}
 else if(d.add){const i=SET.indexOf(d.add);i>=0?SET.splice(i,1):SET.push(d.add);await saveSet();render();autoSet()}
 else if(d.up&&+d.up>0){const i=+d.up;[SET[i-1],SET[i]]=[SET[i],SET[i-1]];await saveSet();render()}
 else if(d.dn&&+d.dn<SET.length-1){const i=+d.dn;[SET[i+1],SET[i]]=[SET[i],SET[i+1]];await saveSet();render()}
 else if(d.rm){SET.splice(+d.rm,1);await saveSet();render()}
 else if(d.delf){if(confirm('ลบไฟล์ '+d.delf+'?')){try{bc65Del(d.delf)}catch(e){}await del('files',d.delf);FILES.delete(d.delf);if(FLD.mem[d.delf]){delete FLD.mem[d.delf];fldSave()}rebuildIndex();render()}}});
const saveSet=()=>{try{localStorage.setItem('bp-set',JSON.stringify({v:SET,t:Date.now()}))}catch(e){}try{lvUser('list')}catch(e){}return put('kv',{k:'set',v:SET})};
async function check(){const r=$('chkr');const rows=[],bad=[];let ok=0,i=0;
 for(const id of SET){i++;const s=SONG.get(id);r.innerHTML=`⏳ กำลังเช็ก ${i}/${SET.length}: ${esc(s?s.t:id)}`;const fn=s&&fileOf(s);let rec=null;try{rec=fn&&await get('files',fn)}catch(e){}
  if(!rec||!rec.blob||!rec.blob.size){bad.push(`❌ ${esc(s?s.t:id)} — ยังไม่ได้โหลดเก็บ`);continue}
  try{const ab=await rec.blob.arrayBuffer();const b=await new OfflineAudioContext(2,1,44100).decodeAudioData(ab);if(!b.duration)throw new Error('ความยาว 0');ok++}
  catch(e){blog('error','decode check fail '+fn,e&&e.message);bad.push(`❌ ${esc(s.t)} — ไฟล์เสีย/เปิดไม่ได้ (ลบแล้วโหลดใหม่)`)}}
 const p=navigator.storage?.persisted?await navigator.storage.persisted():false;let est='';try{const e=await navigator.storage.estimate();est=`${(e.usage/1e9).toFixed(2)} / ~${(e.quota/1e9).toFixed(1)} GB`}catch(e){}
 const L=[bad.length?`<span class="warn" style="font-size:19px">❌ มีปัญหา ${bad.length} เพลง</span><br>${bad.join('<br>')}`:`<span class="ok" style="font-size:20px">✅ เพลงครบ ${ok}/${SET.length} เปิดได้ทุกเพลง เล่นได้แบบไม่ต้องใช้เน็ต</span>`,
  p?'✅ ล็อกพื้นที่เก็บถาวรแล้ว':'⚠️ ยังไม่ล็อกพื้นที่ถาวร — ติดตั้งแอปไว้หน้าจอโฮม',
  'wakeLock' in navigator?'✅ กันจอดับได้ระหว่างเล่น':'⚠️ เครื่องนี้กันจอดับไม่ได้ — ตั้ง "ล็อกอัตโนมัติ: ไม่เลย" ในตั้งค่า iPhone',
  '🔊 เช็กเสียง: ปิดโหมดเงียบ เปิดเสียงเครื่องให้พอดี และลองเล่นสัก 3 วินาที',`💾 พื้นที่: ${est}`,netLine(bad.filter(x=>x.includes('ยังไม่ได้โหลดเก็บ')).length)];
 r.innerHTML=L.join('<br>');drawShowck();blog('info','precheck ok='+ok+' bad='+bad.length)}
async function importFiles(fs){const r=$('impr')||{};{const sc=r.closest&&r.closest('.acc-c');if(sc){const h=sc.querySelector(':scope>.acch');if(h)h.click()}}let n=0,mt=0;
 try{if(navigator.storage?.persist)await navigator.storage.persist()}catch(e){}
 for(const f of fs){r.textContent=`⏳ กำลังนำเข้า ${n+1}/${fs.length}: ${f.name}`;
  try{const blob=new Blob([await f.arrayBuffer()],{type:f.type||'audio/mpeg'});await safePut({name:f.name,blob,size:f.size,added:Date.now(),src:'import'});FILES.set(f.name,{name:f.name,size:f.size,src:'import'});{const ms=CAT.find(c=>norm(c.fn)==norm(f.name));r.textContent=`⏳ วัดความดัง ${n+1}/${fs.length}: ${f.name}`;try{const m=await measure(blob,ms?ms.s:'R');if(m){await put('files',{name:f.name,blob,size:f.size,added:Date.now(),src:'import',gn:m.gn,I:m.I,P:m.P});FILES.get(f.name).gn=m.gn}}catch(e){}}for(const c of CAT)if(norm(c.fn)==norm(f.name)){cache.delete(idOf(c));if(c.id&&FILES.has('web:'+c.id)){await del('files','web:'+c.id);FILES.delete('web:'+c.id)}}n++;if(CAT.some(s=>norm(s.fn)==norm(f.name)))mt++}
  catch(e){blog('error','import fail '+f.name,e.message);r.textContent='❌ นำเข้าไม่ได้: '+f.name+' ('+e.message+')';await new Promise(x=>setTimeout(x,1500))}}
 rebuildIndex();render();const r2=$('impr');if(!r2)toast(`✅ นำเข้าแล้ว ${n} ไฟล์`,2500,true);IMPMSG=`✅ นำเข้าแล้ว ${n} ไฟล์ (ตรงกับรายชื่อ ${mt}, ไม่อยู่ในรายชื่อ ${n-mt})`;if(r2)r2.innerHTML=`✅ นำเข้าแล้ว ${n} ไฟล์ (ตรงกับรายชื่อ ${mt}, ไม่อยู่ในรายชื่อ ${n-mt})`}
async function storage(){const el=$('sto');if(!el)return;let t='';try{const e=await navigator.storage.estimate();t=`พื้นที่ที่ใช้ ${(e.usage/1e9).toFixed(2)} GB จากที่ใช้ได้ ~${(e.quota/1e9).toFixed(1)} GB`}catch(e){}
 let p=false;try{p=await navigator.storage.persisted()}catch(e){}el.innerHTML=t+'<br>'+(p?'🔒 ล็อกพื้นที่เก็บถาวรแล้ว':'⚠️ ยังไม่ล็อกพื้นที่ถาวร (ติดตั้งไว้หน้าจอโฮม แล้วนำเข้าเพลงอีกครั้ง)')}
// ---------- auto-continue ----------
let AUTO={on:false,gap:3},cd=null;
function autoCtl(){return `<span class="row" style="gap:6px"><button data-au="1" class="${AUTO.on?'on':''}">เล่นต่ออัตโนมัติ: ${AUTO.on?'เปิด':'ปิด'}</button><select class="gapsel" style="font-size:18px;min-height:44px;border-radius:10px;background:#222;color:#fff">${[0,3,5,10].map(g=>`<option value="${g}" ${g==AUTO.gap?'selected':''}>${g}s</option>`).join('')}</select><select class="xfsel" style="font-size:18px;min-height:44px;border-radius:10px;background:#222;color:#fff">${[0,2,4,6,8].map(g=>`<option value="${g}" ${g==(AUTO.xf||0)?'selected':''}>${g?'XF '+g+'s':'XF off'}</option>`).join('')}</select></span>`}
function syncOpAuto(){const b=$('op-auto');if(!b)return;const on=!!AUTO.on;b.classList.toggle('on',on);if(b.getAttribute('aria-pressed')!==(on?'true':'false'))b.setAttribute('aria-pressed',on?'true':'false')}
function drawAuto(){$('auto').innerHTML=autoCtl();const a=$('auto2');if(a)a.innerHTML=autoCtl();try{syncOpAuto()}catch(e){}}
async function saveAuto(){await put('kv',{k:'auto',v:AUTO});drawAuto()}
function cancelCd(msg){if(cd){clearInterval(cd);cd=null}if(msg!==undefined)$('ps').innerHTML=msg}
function autoNext(){if(!AUTO.on||!cur)return;const i=SET.indexOf(cur.id),nx=i>=0?SET[i+1]:null;
 if(!nx){$('ps').textContent='✅ จบเพลง (ไม่มีเพลงถัดไปในลิสต์)';return}const s=SONG.get(nx);
 if(!s||!(cache.has(nx)||fileOf(s))){$('ps').textContent='⚠️ เพลงถัดไป "'+(s?s.t:nx)+'" ยังไม่ได้โหลดเก็บ — ไม่เล่นต่อ';return}
 let left=AUTO.gap;const show=()=>{$('ps').innerHTML=`⏭ เล่นต่อ "${esc(s.t)}" ใน <b style="font-size:22px">${left}</b> วิ <button data-cancel="1" style="background:#ff453a;border:0">ยกเลิก</button>`};
 cancelCd();if(left<=0){load(nx);return}show();cd=setInterval(()=>{left--;if(left<=0){cancelCd('');load(nx)}else show()},1000)}
document.addEventListener('change',e=>{if(e.target.classList.contains('gapsel')){AUTO.gap=+e.target.value;saveAuto()}if(e.target.classList.contains('xfsel')){AUTO.xf=+e.target.value;saveAuto()}});
// ---------- cue panel ----------
let cue=null;
function openCue(id){cue=id;cacheCap();const s=SONG.get(id);if(s&&(fileOf(s)||s.id)&&ctx)decode(id).then(()=>drawCue()).catch(()=>{});drawCue()}
function drawCue(){const el=$('cue');if(!cue){el.style.display='none';return}const s=SONG.get(cue),p=pref(cue),inSet=SET.includes(cue),nx=cur&&SET[SET.indexOf(cur.id)+1]==cue;
 el.style.display='block';el.innerHTML=`<div class="row" style="justify-content:space-between"><span class="small">⚙️ ตั้งค่าเพลงถัดไป (เพลงที่เล่นอยู่ไม่หยุด)</span><button data-cq="x">✕</button></div>
 ${cueSyncLine(cue)}<div style="font-size:20px;font-weight:800">${esc(s.t)}${s.a?' – '+esc(s.a):''}</div><div>${badge(s,p)} ${fileOf(s)?'<span class="fmt">'+fmtOf(s)+'</span>':''} ${cache.has(cue)?'<span class="ok small">พร้อมเล่น</span>':''}</div>
 <div class="row" style="margin-top:6px"><span>คีย์</span><button data-cq="kd">−</button><span style="font-size:24px;font-weight:800;min-width:56px;text-align:center">${kl65(cue)}</span><button data-cq="ku">+</button><button data-cq="sw" class="${p.swap?'on':''}">สลับ L/R: ${p.swap?'เปิด':'ปิด'}</button></div>
 <div class="row" style="margin-top:6px"><button data-cq="add" class="${inSet?'on':''}">${inSet?'✓ ในลิสต์':'＋ เข้าลิสต์'}</button>${cur&&cur.id!==cue?`<button data-cq="nx" class="${nx?'on':''}">⏭ ${nx?'เป็นเพลงถัดไปแล้ว':'ตั้งเป็นเพลงถัดไป'}</button>`:`<button data-cq="play" style="background:#30d158;color:#000;font-weight:800">▶ เล่นเลย</button>`}</div>`}
async function cueAct(a){const id=cue;if(!id)return;const p=pref(id);
 if(a=='x'){cue=null}
 else if(a=='kd')await setPrefFor(id,{key:Math.max(-6,p.key-1)});else if(a=='ku')await setPrefFor(id,{key:Math.min(6,p.key+1)});else if(a=='sw')await setPrefFor(id,{swap:!p.swap});
 else if(a=='add'){const i=SET.indexOf(id);i>=0?SET.splice(i,1):SET.push(id);await saveSet();autoSet()}
 else if(a=='nx'){const i=SET.indexOf(id);if(i>=0)SET.splice(i,1);const c=cur?SET.indexOf(cur.id):-1;if(c>=0)SET.splice(c+1,0,id);else{if(cur)SET.unshift(cur.id);SET.splice(cur?1:0,0,id)}await saveSet();autoSet()}
 else if(a=='play'){cue=null;drawCue();return load(id)}
 render();drawCue()}
// ---------- download queue ----------
const DLQ=new Set();let dlRun=false;
function enqueue(ids){for(const id of ids){const s=SONG.get(id);if(s&&(s.id||s.bc)&&!fileOf(s))DLQ.add(id)}render();runQ()}
async function runQ(){if(dlRun)return;dlRun=true;try{if(navigator.storage?.persist)await navigator.storage.persist()}catch(e){}
 while(DLQ.size){const id=[...DLQ][0];const s=SONG.get(id);try{if(s.bc)await bcGet(s);else{const b=await fetchAudio(s);await storeBlob(s,b)}}catch(e){$('ps').textContent='❌ โหลดเก็บไม่ได้: '+s.t+' ('+e.message+')';DLQ.clear();break}DLQ.delete(id);render()}
 dlRun=false;render()}
function autoSet(){if(navigator.onLine)enqueue(SET)}
window.addEventListener('online',autoSet);
// ---------- debug hooks for tests ----------
window.__bp={get acc(){return ACC},get beat(){return cur?{base:baseBpm(cur.id),src:bpmSrc(cur.id),det:BPMD[cur.id]||null,sig:sigOf(cur.id),t0:t0Of(cur.id),n:BEATN,flash:BFL,real:cur&&baseBpm(cur.id)?baseBpm(cur.id)*(pref(cur.id).tempo||100)/100:null}:null},detectBpm:(id)=>{const b=id?null:cur&&cur.buf;return b?detectBpm(b,clickCh(cur.id)):null},durOf:()=>cur?cur.buf.duration:0,get tempo(){return{sh:!!sh,t:sh?sh._soundtouch.virtualTempo:1,p:cur&&(pref(cur.id).tempo||100)}},get marks(){return cur?pref(cur.id).mk||[]:[]},get fadeG(){return MX.fade?MX.fade.gain.value:null},get xfTail(){return !!TAIL},get mix(){return mixState()},setList:async ids=>{SET=[...ids];await saveSet();render()},get MX(){return MX},peaksOf:id=>PEAKS.has(id),studioSeek:f=>seekFrac(f),blog,get cacheSize(){return cache.size},sync,get ps(){return pstate()},measure,get state(){return{raw:cur&&isOld(cur.id),norm:NORM,gdb:cur&&gainDb(cur.id),gl:gL&&gL.gain.value,trim:cur&&pref(cur.id).trim,auto:AUTO,cd:!!cd,playing,cur:cur&&cur.id,pos:pos(),key:cur&&pref(cur.id).key,swap:cur&&pref(cur.id).swap,shifter:!!sh,cached:[...cache.keys()],set:SET}},
 levels(){const a=new Float32Array(anL.fftSize),b=new Float32Array(anR.fftSize);anL.getFloatTimeDomainData(a);anR.getFloatTimeDomainData(b);const rms=x=>Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length);
  const pk=an=>{const f=new Float32Array(an.frequencyBinCount);an.getFloatFrequencyData(f);let m=0;for(let i=1;i<f.length;i++)if(f[i]>f[m])m=i;return m*ctx.sampleRate/an.fftSize};return{L:rms(a),R:rms(b),fL:pk(anL),fR:pk(anR)}}};
// ---------- boot ----------
// v1.0.0: the 717-song online sample catalog is opt-in (settings) — new users start with an empty library. The owner account turns it on automatically.
function cat100(){const v=localStorage.getItem('bp-cat');return v==='1'||(v!=='0'&&!!navigator.webdriver)}
document.addEventListener('change',e=>{if(e.target&&e.target.id==='cat100'){localStorage.setItem('bp-cat',e.target.checked?'1':'0');location.reload()}});
// v1.0.1: the catalog stays ON for everyone who used it before 1.0.0 — only brand-new accounts/devices start empty.
const CAT101=Date.parse('2026-11-04T16:00:00Z');
async function old100(){try{const st=JSON.parse(localStorage.getItem('bp-state')||'null');if(st&&/^[RL]:/.test(st.id||''))return true;if(/"[RL]:/.test(localStorage.getItem('bp-set')||''))return true;
 for(const p of await getAll('prefs'))if(/^[RL]:/.test(p.id||''))return true;const kv=await get('kv','set');if(kv&&(kv.v||[]).some(x=>/^[RL]:/.test(String(x&&x.id||x))))return true;
}catch(e){}return false}
const OWN106='sxX1gJmcMihYXzP1nl1HDw03Hq73';function cat101on(why){const v=localStorage.getItem('bp-cat');if(v!==null&&!(v==='0'&&localStorage.getItem('bp-cat106')==='rev'))return;localStorage.removeItem('bp-cat106');localStorage.setItem('bp-cat','1');blog('info','catalog on: '+why);if(!CAT.length)catRl('cat101')}
function catApply(rows){CAT=Array.isArray(rows)?rows:[];for(const s of CAT){let i=idOf(s);if(SONG.has(i)&&SONG.get(i)!==s&&!s._id){let n=2;while(SONG.has(i+'~'+n))n++;s._id=i+'~'+n;i=s._id}SONG.set(i,s)}}
async function catFromCache(){try{const kv=await get('kv','catalog');if(kv&&Array.isArray(kv.v)&&kv.v.length)return kv.v}catch(e){}return null}
async function catFetchNet(){const m=CLD.mod||await accMod();if(!CLD.user&&!(m&&m.me&&m.me()))return null;const rows=await m.catGet();if(!Array.isArray(rows)||!rows.length)return null;try{await tx('kv','readwrite',s=>s.put({k:'catalog',v:rows}))}catch(e){}return rows}
function catWaitUser(ms=8000){return new Promise(ok=>{const t0=Date.now();const tick=()=>{if(CLD.user)return ok(CLD.user);if(CLD.st==='ready'&&CLD.mod&&Date.now()-t0>400)return ok(null);if(Date.now()-t0>ms)return ok(null);setTimeout(tick,100)};if(navigator.onLine&&!CLD.mod)accMod().catch(()=>{});tick()})}
async function catRefresh(force){if(!cat100())return false;try{const rows=await catFetchNet();if(!rows)return false;if(force||rows.length!==CAT.length){catApply(rows);try{rebuildIndex();render()}catch(e){}}return true}catch(e){blog('warn','catalog fetch',e.message||String(e));return false}}
(async()=>{try{if(localStorage.getItem('bp-cat')===null&&!navigator.webdriver&&await old100())localStorage.setItem('bp-cat','1');
 if(cat100()){const cached=await catFromCache();if(cached)catApply(cached);else{await catWaitUser();await catRefresh(true)}}else{CAT=[]}
 window.__catok=1;window.__catLen=()=>CAT.length;/*v1.84.3 + v1.0.17: catalog comes from Firestore (signed-in) + IndexedDB cache; data.json is no longer public*/

 for(const f of await getAll('files'))if(!f.name.startsWith('stem:'))FILES.set(f.name,{name:f.name,size:f.size,gn:f.gn,bv:f.bv,src:f.src||(f.name.startsWith('web:')?'web':'import'),auto:f.auto?1:undefined});for(const p of await getAll('prefs'))PREF.set(p.id,p);
 {const kv=await get('kv','set');if(!window.__lvSetApplied){SET=kv?.v||[];if(!kv){try{const m=JSON.parse(localStorage.getItem('bp-set')||'null');if(m&&Array.isArray(m.v)&&m.v.length){SET=m.v;put('kv',{k:'set',v:SET});blog('warn','set restored from mirror')}}catch(e){}}}window.__setok=1}NORM=(await get('kv','norm'))?.v??true;AUTO={...AUTO,...((await get('kv','auto'))?.v||{})};try{META=(await get('kv','meta'))?.v||{}}catch(e){}try{const o=(await get('kv','folders'))?.v;if(o&&Array.isArray(o.list))FLD={list:o.list,mem:o.mem||{}}}catch(e){}if(FSEL&&FSEL!='_none'&&!FLD.list.some(f=>f.id==FSEL))FSEL='';drawAuto();rebuildIndex();render();autoSet();msSetup();
 try{if(navigator.storage&&navigator.storage.persist&&!(await navigator.storage.persisted()))navigator.storage.persist().then(p=>blog('info','persist '+p))}catch(e){}
 try{const st=JSON.parse(localStorage.getItem('bp-state')||'null');if(st&&st.id&&SONG.get(st.id)&&!st.ended){const s=SONG.get(st.id);if(fileOf(s)||(s.id&&navigator.onLine)){load.resumeAt=st.pos||0;document.addEventListener('pointerdown',function f(){document.removeEventListener('pointerdown',f,true)},true);initAudio();load(st.id,false)}}}catch(e){blog('warn','restore fail',e.message)}
 if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js',{updateViaCache:'none'})}finally{window.__setok=1}})();

// ===== Studio (v1.19): mixer, waveform, setlist strip, live mode =====
const MX={f:[],p:[],a:[],m:null};
function mkMixer(){for(let c=0;c<2;c++){const f=ctx.createGain(),pn=ctx.createStereoPanner(),sp=ctx.createChannelSplitter(2),aL=ctx.createAnalyser(),aR=ctx.createAnalyser();aL.fftSize=aR.fftSize=1024;
  f.connect(pn);pn.connect(sp);sp.connect(aL,0);sp.connect(aR,1);MX.f[c]=f;MX.p[c]=pn;MX.a[c]=[aL,aR]}
 MX.m=ctx.createGain();MX.p[0].connect(MX.m);MX.p[1].connect(MX.m);MX.fade=ctx.createGain();MX.m.connect(MX.fade);MX.fade.connect(ctx.destination);MX.fade.connect(split2)}
const db2=d=>d<=-60?0:Math.pow(10,d/20);
const DEFMIX=()=>({c:{v:0,m:false,s:false,o:null},u:{v:0,m:false,s:false,o:null},M:0});
// which source channel is click: นอมขวา => ch1, นอมซ้าย => ch0
const clickCh=id=>{const x=SONG.get(id);return x&&x.s=='L'?0:1};
function mixOf(id){const p=pref(id);const d=DEFMIX();const m=p.mix||{};return{c:{...d.c,...(m.c||{})},u:{...d.u,...(m.u||{})},M:m.M??0}}
function outDef(ch,sw){return ch==0?(sw?'R':'L'):(sw?'L':'R')}
function stripOf(id,ch){const m=mixOf(id);return ch==clickCh(id)?m.c:m.u}
function applyMix(){if(!ctx||!MX.m)return;const id=cur&&cur.id;const m=id?mixOf(id):DEFMIX();const sw=id?pref(id).swap:false;const t=ctx.currentTime;
 const solo=m.c.s||m.u.s;
 for(let ch=0;ch<2;ch++){const st=id?stripOf(id,ch):m.u;const g=(st.m||(solo&&!st.s))?0:db2(st.v);MX.f[ch].gain.setTargetAtTime(g,t,0.015);
  const o=st.o||outDef(ch,sw);MX.p[ch].pan.setTargetAtTime(o=='L'?-1:o=='R'?1:0,t,0.015)}
 MX.m.gain.setTargetAtTime(db2(m.M),t,0.015)}
function mixState(){if(!MX.m)return null;return{f:MX.f.map(g=>+g.gain.value.toFixed(3)),pan:MX.p.map(p=>p.pan.value),M:+MX.m.gain.value.toFixed(3),mix:cur&&mixOf(cur.id),clickCh:cur&&clickCh(cur.id)}}
let mixT;async function setMix(fn){if(!cur)return;const m=mixOf(cur.id);fn(m);const p={...pref(cur.id),mix:m};PREF.set(cur.id,p);applyMix();mixUI();clearTimeout(mixT);mixT=setTimeout(()=>put('prefs',p).catch(e=>blog('error','mix save',e.message)),300)}
// --- UI build ---
function studioBuild(){const plx=$('plx');if($('studio'))return;
 const st=document.createElement('div');st.id='studio';
 st.innerHTML=`<div class="stbar"><div class="ssum" id="ssum">SETLIST</div><span class="row" style="gap:6px"><button data-help="1" class="hw" aria-label="วิธีใช้">❓</button></span></div>
 <div id="strip" class="strip"></div>
 <div class="wavebox"><canvas id="wave" height="110"></canvas></div>
 <div class="mkbar" id="mkbar"></div>
 <div class="fdrow" id="fdrow"><button id="fadeb" class="hw">🔉 เฟด</button><select id="fades">${[2,4,6,8].map(x=>`<option value="${x}">${x} วิ</option>`).join('')}</select><select id="fadem"><option value="stop">แล้วหยุด</option><option value="next">แล้วเล่นเพลงถัดไป</option></select></div>
 <div class="counter"><div class="ctr" id="ctr">00:00</div><div class="ctr2" id="ctr2">-00:00 / 00:00</div></div>
 <div class="mixer" id="mixer">${['c','u'].map(k=>`<div class="chs" data-ch="${k}"><div class="chn">${k=='c'?'🥁 นอม':'🎵 เพลง'}</div>
  <div class="lcr">${['L','C','R'].map(o=>`<button data-o="${o}">${o}</button>`).join('')}</div>
  <div class="fz"><div class="vu"><i></i><b></b><i></i><b></b></div><input type="range" class="fd" min="-60" max="6" step="0.5" value="0" orient="vertical"></div>
  <div class="dbv">0.0 dB</div><div class="ms"><button data-mute>M</button><button data-solo>S</button></div></div>`).join('')}
  <div class="chs mst"><div class="chn">MASTER</div><button id="mxr" class="hw rst">↺ รีเซ็ต</button>
  <div class="fz"><div class="vu"><i></i><b></b><i></i><b></b></div><input type="range" class="fd" id="mfd" min="-60" max="6" step="0.5" value="0"></div><div class="dbv" id="mdb">0.0 dB</div><div class="ms"><span class="small">ปรับเสียงเท่ากันยังทำงาน</span></div></div></div>`;
 plx.insertBefore(st,plx.firstChild);
 const lv=document.createElement('div');lv.id='livelist';document.body.appendChild(lv);
 
 $('mxr').onclick=()=>setMix(m=>{const d=DEFMIX();m.c=d.c;m.u=d.u;m.M=0});
 $('mfd').oninput=e=>setMix(m=>m.M=+e.target.value);
 st.querySelectorAll('.chs[data-ch]').forEach(el=>{const k=el.dataset.ch;
  el.querySelector('.fd').oninput=e=>setMix(m=>m[k].v=+e.target.value);
  el.querySelector('[data-mute]').onclick=()=>setMix(m=>m[k].m=!m[k].m);
  el.querySelector('[data-solo]').onclick=()=>setMix(m=>m[k].s=!m[k].s);
  el.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>setMix(m=>{const ch=k=='c'?clickCh(cur.id):1-clickCh(cur.id);const d=outDef(ch,pref(cur.id).swap);m[k].o=b.dataset.o==d?null:b.dataset.o}))});
 // fader double-tap = 0 dB
 st.querySelectorAll('.fd').forEach(f=>f.ondblclick=()=>{f.value=0;f.oninput({target:f})});
 const cv=$('wave');let wd=false;const sk=e=>{const r=cv.getBoundingClientRect();seekFrac(Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)))};
 cv.onpointerdown=e=>{wd=true;cv.setPointerCapture(e.pointerId);sk(e)};cv.onpointermove=e=>{if(wd)sk(e)};cv.onpointerup=()=>wd=false;
 $('strip').onclick=e=>{const c=e.target.closest('[data-sid]');if(c)load(c.dataset.sid)};
 lv.onclick=e=>{const rm=e.target.closest('[data-lvrm]');if(rm){e.stopPropagation();lvRm839(rm.dataset.lvrm);return}const c=e.target.closest('[data-sid]');if(c){const id=c.dataset.sid;if(cur&&cur.id==id&&!loadingId){$('big').click()}else lvTap842(id);return}if(e.target.closest('#lvx'))setLive(false);if(e.target.closest('#lvp'))$('big').click()};
 if(localStorage.getItem('bp-live')!=='0')setLive(true);mixUI();meterLoop()}
function setLive(on){document.body.classList.toggle('live',on);document.documentElement.classList.toggle('op18-live',!!on);localStorage.setItem('bp-live',on?'1':'0');stripDraw()}
// v1.0.41: pending Studio key/tempo — 💾 saves (prefs + band list), ↺ / other song / back to Live drops it
function stuRevert(id,quiet){const o=SP41.get(id);if(!o)return;SP41.delete(id);SPX41=true;try{if(cur&&cur.id===id){setPref({...o});if('tempo' in o)try{tempoLive(o.tempo)}catch(e){}}else{PREF.set(id,{...pref(id),...o})}}finally{SPX41=false}
 try{tempoUI()}catch(e){}try{showKey()}catch(e){}stripKey='';try{stripDraw()}catch(e){}stuBar();if(!quiet)toast('↺ คืนคีย์/เทมโปที่บันทึกไว้',1500,true)}
function stuRevertAll(quiet){const n=SP41.size;for(const id of [...SP41.keys()])stuRevert(id,true);if(n&&!quiet)toast('↺ คีย์/เทมโปที่ยังไม่บันทึก ถูกคืนค่าเดิม',2200,true)}
async function stuSave(){const ids=[...SP41.keys()];for(const id of ids){const o=SP41.get(id)||{},p=pref(id),ch={};for(const k of Object.keys(o))ch[k]=k==='key'?(p.key||0):(p.tempo||100);SP41.delete(id);await put('prefs',pref(id));try{lvEdit(id,ch);lvUser('field')}catch(e){}}
 stuBar();if(ids.length)toast('💾 บันทึกคีย์/เทมโปกับเพลงแล้ว',1600,true)}
// v1.0.42: the bar sits IN the Studio page flow right under the visible key/tempo controls (Studio counter row #tp62, or the key/tempo cards when shown) (never floating over the mixer / M-S buttons)
function stuPlace(b){const vz=e=>e&&e.parentNode&&e.getClientRects().length>0,k=$('kd'),kg=k&&k.closest('.grid'),tp=$('tp62'),tc=tp&&(tp.closest('.counter')||tp);const g=vz(kg)?kg:vz(tc)?tc:null;if(g){if(b.previousElementSibling!==g)g.after(b);b.classList.remove('flt42')}else{if(b.parentNode!==document.body)document.body.appendChild(b);b.classList.add('flt42')}}
function stuBar(){let b=$('stusave');if(b)stuPlace(b);const on=SP41.size>0&&stuMode();if(!on){if(b)b.hidden=true;return}
 if(!b){b=document.createElement('div');b.id='stusave';b.setAttribute('role','status');b.innerHTML='<span class="t">คีย์/เทมโปยังไม่บันทึก</span><button type="button" id="stusv" class="hw">💾 บันทึก</button><button type="button" id="sturv" class="hw" aria-label="คืนค่าที่บันทึกไว้">↺ คืนค่า</button>';stuPlace(b);
  $('stusv').onclick=e=>{e.stopPropagation();stuSave()};$('sturv').onclick=e=>{e.stopPropagation();stuRevertAll(true);toast('↺ คืนคีย์/เทมโปที่บันทึกไว้',1500,true)}}
 const id=cur&&SP41.has(cur.id)?cur.id:[...SP41.keys()][0],p=pref(id),o=SP41.get(id)||{};let d=[];try{if('key' in o)d.push('คีย์ '+(kl65(id,1)||((p.key>0?'+':'')+(p.key||0))));if('tempo' in o)d.push((typeof realBpm=='function'&&realBpm(id)?Math.round(realBpm(id))+' BPM':(p.tempo||100)+'%'))}catch(e){}
 b.querySelector('.t').textContent='ยังไม่บันทึก: '+(d.join(' · ')||'คีย์/เทมโป');b.hidden=false}
{const _sl=setLive;setLive=function(on){if(on&&SP41.size)stuRevertAll();const r=_sl.apply(this,arguments);try{stuBar()}catch(e){}return r}}
function seekFrac(f){if(!cur)return;const at=f*cur.buf.duration;if(playing)start(at);else{offset=at;ended=false}waveDraw()}
function mixUI(){if(!$('studio'))return;const ok=!!cur;const m=ok?mixOf(cur.id):DEFMIX();const sw=ok&&pref(cur.id).swap;
 $('studio').querySelectorAll('.chs[data-ch]').forEach(el=>{const k=el.dataset.ch,s2=m[k];const ch=ok?(k=='c'?clickCh(cur.id):1-clickCh(cur.id)):(k=='c'?1:0);const o=s2.o||outDef(ch,sw);
  el.querySelector('.fd').value=s2.v;el.querySelector('.dbv').textContent=s2.v<=-60?'-∞':(s2.v>0?'+':'')+s2.v.toFixed(1)+' dB';
  el.querySelector('[data-mute]').classList.toggle('on',s2.m);el.querySelector('[data-solo]').classList.toggle('on',s2.s);
  el.querySelectorAll('[data-o]').forEach(b=>b.classList.toggle('on',b.dataset.o==o));el.classList.toggle('dim',s2.m||((m.c.s||m.u.s)&&!s2.s))});
 $('mfd').value=m.M;$('mdb').textContent=m.M<=-60?'-∞':(m.M>0?'+':'')+m.M.toFixed(1)+' dB'}
// --- durations + setlist strip ---
const DUR=JSON.parse(localStorage.getItem('bp-dur')||'{}');
const f2=s=>{s=Math.max(0,Math.round(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+':'+String(m).padStart(2,'0'):String(m).padStart(2,'0'))+':'+String(x).padStart(2,'0')};
/* total length of the arranged set — ~ when some songs have no known duration yet */
function setTot(){const known=SET.filter(i=>DUR[i]),tot=known.reduce((a,i)=>a+(DUR[i]|0),0);return{n:SET.length,known:known.length,tot,approx:known.length<SET.length&&SET.length>0}}
function setTotLabel(){const t=setTot();if(!t.n)return'0 เพลง';return t.n+' เพลง · '+(t.approx?'~':'')+f2(t.tot)}
window.__setTot={of:setTot,label:setTotLabel,f2};
// v1.0.44: Studio #strip patches like #livelist — full innerHTML only when SET membership/order changes.
// Old stripKey bundled pstate + DUR length → play/pause / duration / key-BPM analysis wiped the strip every few seconds (flicker while arranging).
let stripKey='';
function scChipPatch(root){if(!root)return;root.querySelectorAll('.sc[data-sid]').forEach(c=>{const o=c.querySelector('.scc');if(!o)return;const t=document.createElement('div');t.innerHTML=scChips(c.dataset.sid);const n=t.querySelector('.scc');if(n&&o.outerHTML!==n.outerHTML)o.replaceWith(n)})}
function stripDraw(){if(!$('strip'))return;
 const T=setTot(),known=T.known,tot=T.tot,ci=cur?SET.indexOf(cur.id):-1;
 const sk=SET.join('|'),sp=$('strip'),setTx=(e,t)=>{if(e&&e.textContent!==t)e.textContent=t};
 {const h=`<b>SETLIST</b> <span>♪ ${ci>=0?ci+1+'/':''}${SET.length} เพลง</span> <span>⏱ ${T.approx?'~':''}${f2(tot)}</span>`;const ss=$('ssum');if(ss&&ss.dataset.h!==h){ss.dataset.h=h;ss.innerHTML=h}}
 const card=(i,n)=>{const x=SONG.get(i);if(!x)return'';const on=cur&&cur.id==i;return `<div class="sc ${on?'on':''} ${fileOf(x)?'':'nf'}" data-sid="${esc(i)}"><div class="scn">${n+1}</div><div class="sct">${esc(x.t)}</div><div class="sca">${esc(x.a||'')}${DUR[i]?' · '+f2(DUR[i]):''}</div>${scChips(i)}${on&&playing?'<div class="eq"><i></i><i></i><i></i></div>':''}</div>`};
 const mkCard=(i,n)=>{const t=document.createElement('div');t.innerHTML=card(i,n);return t.firstElementChild};
 let struct=false;
 if(sp.dataset.sk!==sk||(SET.length?!sp.querySelector('.sc[data-sid]'):!sp.querySelector('.empty'))){
  struct=true;sp.dataset.sk=sk;stripKey=sk;
  if(!SET.length){sp.innerHTML='<div class="small empty" style="padding:10px">ยังไม่มีเพลงในคืนนี้ — กด ➕ ที่รายชื่อเพลง</div>'}
  else{const map=new Map();sp.querySelectorAll('.sc[data-sid]').forEach(c=>map.set(c.dataset.sid,c));
   sp.querySelectorAll(':scope>.empty,:scope>.small.empty').forEach(e=>e.remove());
   SET.forEach((i,n)=>{let el=map.get(i);if(el){map.delete(i);const scn=el.querySelector('.scn');if(scn)setTx(scn,String(n+1))}else el=mkCard(i,n);if(el)sp.appendChild(el)});
   map.forEach(el=>el.remove())}}
 // state: active / duration / EQ — never wipe the strip for these
 sp.querySelectorAll('.sc[data-sid]').forEach(c=>{const i=c.dataset.sid,x=SONG.get(i),on=!!cur&&cur.id==i;
  if(x){const a=c.querySelector('.sca');if(a)setTx(a,(x.a||'')+(DUR[i]?' · '+f2(DUR[i]):''));const t=c.querySelector('.sct');if(t)setTx(t,x.t);c.classList.toggle('nf',!fileOf(x))}
  if(c.classList.contains('on')!==on)c.classList.toggle('on',on);
  const eq=c.querySelector('.eq');if(on&&playing&&!eq){const d=document.createElement('div');d.className='eq';d.innerHTML='<i></i><i></i><i></i>';c.appendChild(d)}else if(eq&&!(on&&playing))eq.remove()});
 const lv=$('livelist');if(lv){const ps=pstate();
  // v1.52: rebuild the live list only when its content changes; keep scroll; play/pause/active = targeted updates (iPhone landscape scroll jump fix)
  if(lv.dataset.sk!==sk||!lv.querySelector('.lvl')){const l0=lv.querySelector('.lvl'),y0=l0?l0.scrollTop:0,y1=lv.scrollTop;lv.dataset.sk=sk;lv.innerHTML=`<div class="lvh"><b>🎤 LIVE</b><span class="lvhs"></span><button id="lvx" class="hw">🎛 Studio</button></div>
  <div class="lvnow"><button id="lvp" class="lvbig"></button><button class="rs831 lvrs" data-rs831 aria-label="เริ่มเพลงใหม่"></button><div><div class="lvt"></div><div class="lvc" id="lvc"></div></div></div>
  <div class="lvl">${SET.map((i,n)=>card(i,n).replace(/<\/div>$/,`<button type="button" class="lvrm" data-lvrm="${esc(i)}" aria-label="ลบออกจากลิสต์">✕</button></div>`)).join('')}</div>`;const l1=lv.querySelector('.lvl');if(l1)l1.scrollTop=y0;lv.scrollTop=y1}
  setTx(lv.querySelector('.lvhs'),setTotLabel());setTx(lv.querySelector('#lvp'),ps=='playing'?'⏸':ps=='loading'?'⏳':'▶');setTx(lv.querySelector('.lvt'),cur?(SONG.get(cur.id)||{}).t||'เลือกเพลงด้านล่าง':'เลือกเพลงด้านล่าง');setTx($('lvc'),cur?f2(pos())+' / '+f2(cur.buf.duration):'');
  lv.querySelectorAll('.lvl .sc').forEach(c=>{{const x=SONG.get(c.dataset.sid),a=c.querySelector('.sca');if(x&&a)setTx(a,(x.a||'')+(DUR[c.dataset.sid]?' · '+f2(DUR[c.dataset.sid]):''))}const on=!!cur&&cur.id==c.dataset.sid;if(c.classList.contains('on')!==on)c.classList.toggle('on',on);const eq=c.querySelector('.eq');if(on&&playing&&!eq){const d=document.createElement('div');d.className='eq';d.innerHTML='<i></i><i></i><i></i>';c.appendChild(d)}else if(eq&&!(on&&playing))eq.remove()})}
 if(struct&&!document.body.classList.contains('live')){const on=sp.querySelector('.sc.on');if(on){const r=on.getBoundingClientRect(),q=sp.getBoundingClientRect();sp.scrollLeft+=(r.left+r.width/2)-(q.left+q.width/2)}}}
/* DUR updates: patch Dual list header/rows only — never full paint() (avoids list remount flicker) */
try{if(window.__bp){window.__bp.stripDraw=stripDraw;window.__bp.scChipPatch=scChipPatch;window.__bp.setDur=(id,sec)=>{DUR[id]=Math.max(1,sec|0);try{stripDraw()}catch(e){}try{if(window.__dual&&typeof window.__dual.refreshDur==='function')window.__dual.refreshDur()}catch(e){}}}}catch(e){}
// --- waveform peaks ---
const PEAKS=new Map(),NB=800;
function peaks(id,b){if(PEAKS.has(id))return PEAKS.get(id);const out=[];for(let c=0;c<Math.min(2,b.numberOfChannels);c++){const d=b.getChannelData(c),n=d.length,st=Math.floor(n/NB)||1,a=new Float32Array(NB);
  for(let i=0;i<NB;i++){let m=0;const e=Math.min(n,(i+1)*st);for(let j=i*st;j<e;j+=4){const v=d[j]<0?-d[j]:d[j];if(v>m)m=v}a[i]=m}out.push(a)}
 if(out.length==1)out.push(out[0]);PEAKS.set(id,out);if(PEAKS.size>60)PEAKS.delete(PEAKS.keys().next().value);return out}
function studioLoad(){MKSEL=-1;mkUI();try{beatLoad()}catch(e){blog('warn','beat',e.message)}try{DUR[cur.id]=Math.max(1,Math.round(effEnd()-trS(cur.id)));localStorage.setItem('bp-dur',JSON.stringify(DUR))}catch(e){}peaks(cur.id,cur.buf);stripDraw();mixUI();applyMix();waveDraw()}
function waveDraw(){const cv=$('wave');if(!cv||!cv.offsetWidth)return;const W=cv.width=cv.offsetWidth*devicePixelRatio,H=cv.height=cv.offsetHeight*devicePixelRatio;const g=cv.getContext('2d');g.clearRect(0,0,W,H);
 g.fillStyle='#0a0c10';g.fillRect(0,0,W,H);g.strokeStyle='rgba(255,255,255,.05)';for(let x=0;x<W;x+=W/16){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()}
 if(!cur)return;const P=PEAKS.get(cur.id);if(!P)return;const ci=clickCh(cur.id),fr=pos()/cur.buf.duration,px=fr*W;
 const lane=(arr,y0,h,col,col2)=>{for(let x=0;x<W;x++){const v=arr[Math.floor(x/W*NB)]||0,hh=Math.max(1,v*h*0.95);g.fillStyle=x<px?col:col2;g.fillRect(x,y0+h/2-hh/2,1,hh)}};
 lane(P[1-ci],0,H*0.62,'#5ac8fa','#24506a');lane(P[ci],H*0.66,H*0.34,'#ff9f0a','#5a3a10');
 g.fillStyle='rgba(255,255,255,.5)';g.font=(10*devicePixelRatio)+'px system-ui';g.fillText('เพลง',4*devicePixelRatio,12*devicePixelRatio);g.fillText('นอม',4*devicePixelRatio,H*0.66+12*devicePixelRatio);
 drawMarks(g,W,H);g.fillStyle='#fff';g.fillRect(px-1,0,2*devicePixelRatio,H);g.fillStyle='#30d158';g.beginPath();g.moveTo(px-6,0);g.lineTo(px+6,0);g.lineTo(px,8);g.fill()}
// --- meters + counter loop ---
const tbuf=new Float32Array(1024),MPK=[];
function lvl(an){an.getFloatTimeDomainData(tbuf);let p=0;for(let i=0;i<tbuf.length;i+=2){const v=Math.abs(tbuf[i]);if(v>p)p=v}return p}
function meterSet(el,ps){const vs=el.querySelectorAll('.vu i'),pk=el.querySelectorAll('.vu b');ps.forEach((p,i)=>{const db=p>0?20*Math.log10(p):-90,f=Math.max(0,Math.min(1,(db+48)/51));
  const k=el.dataset.k||(el.dataset.k=Math.random());MPK[k+i]=Math.max(f,(MPK[k+i]||0)-0.012);vs[i].style.transform=`scaleY(${f})`;pk[i].style.bottom=(MPK[k+i]*100)+'%';pk[i].classList.toggle('clip',db>-0.5)})}
const setTx=(e,t)=>{if(e&&e.textContent!==t)e.textContent=t};let lastW=0;function meterLoop(){requestAnimationFrame(meterLoop);if(document.hidden)return;const vis=$('plx').offsetParent!==null&&!document.body.classList.contains('live');
 if(cur){const p=pos(),d=cur.buf.duration;if(vis){setTx($('ctr'),f2(p));setTx($('ctr2'),'-'+f2(d-p)+' / '+f2(d))}setTx($('lvc'),f2(p)+' / '+f2(d))}
 if(!vis||!MX.m)return;const now=performance.now();if(now-lastW>100){lastW=now;waveDraw()}
 const z=[0,0];const els=$('studio').querySelectorAll('.chs');if(!playing){els.forEach(e=>meterSet(e,z));return}
 const ci=cur?clickCh(cur.id):1;meterSet(els[0],MX.a[ci].map(lvl));meterSet(els[1],MX.a[1-ci].map(lvl));meterSet(els[2],[lvl(anL),lvl(anR)])}
let RFW=innerWidth;const reflowR=()=>{if(innerWidth===RFW)return;RFW=innerWidth;reflow()};const reflow=()=>{stripKey='';requestAnimationFrame(()=>{waveDraw();stripDraw();if(typeof drawCue=='function'&&cue)drawCue()})};window.addEventListener('resize',reflowR);window.addEventListener('orientationchange',()=>setTimeout(reflow,250));try{matchMedia('(orientation:landscape)').addEventListener('change',reflow)}catch(e){}
studioBuild();

// ===== Batch A (v1.22) =====
function needSh(p){return (p.key||0)!=0||(p.tempo||100)!=100}
// --- tempo ---
function tempoUI(){const v=$('tv');if(!v)return;const p=cur?pref(cur.id):{tempo:100};const t=p.tempo||100,b=cur&&baseBpm(cur.id);
 v.textContent=b?(Math.round(b*t/10)/10).toString().replace(/\.0$/,'')+' BPM':t+'%';v.title=t+'%';$('tv').dataset.pct=t;
 const kb=$('kbpm2');if(kb)kb.textContent=b?'เดิม '+b+' BPM':''}
function tempoStep(d){if(!cur)return;const p=pref(cur.id),b=baseBpm(cur.id);let t=p.tempo||100;
 if(b){const nb=Math.round(b*t/100)+d;t=nb/b*100}else t=t+d;t=Math.max(50,Math.min(150,t));setPref({tempo:t})}
try{$('td').onclick=()=>tempoStep(-1);$('tu').onclick=()=>tempoStep(1);$('tv').onclick=()=>{if(cur)setPref({tempo:100})}}catch(e){blog('error','tempo ui missing (stale index?)',e.message)}
// --- markers ---
const PRESETS=['Intro','Verse','Pre','Chorus','Solo','Outro','Ending'];let MKSEL=-1;
const marks=()=>cur?[...(pref(cur.id).mk||[])].sort((a,b)=>a.t-b.t):[];
async function setMarks(mk,extra={}){if(!cur)return;mk.sort((a,b)=>a.t-b.t);await setPref({mk,...extra});mkUI();waveDraw()}
function secOf(mk,i){return[mk[i].t,i+1<mk.length?mk[i+1].t:cur.buf.duration]}
function mkUI(){const el=$('mkbar');if(!el)return;if(!cur){el.innerHTML='';return}const mk=marks(),p=pref(cur.id);
 el.innerHTML=`<div class="mkchips">${mk.map((m,i)=>`<button class="mkc ${i==MKSEL?'sel':''} ${m.sk?'sk':''} ${p.lp===i?'lp':''}" data-mk="${i}">${p.lp===i?'🔁 ':''}${m.sk?'⏭ ':''}${esc(m.n)} <small>${fmt(m.t)}</small></button>`).join('')}
 <span class="mkadd"><select id="mkp">${PRESETS.map(x=>`<option>${x}</option>`).join('')}</select><button id="mka" class="hw">＋ มาร์ก</button></span></div>
 ${MKSEL>=0&&mk[MKSEL]?`<div class="mked"><span class="small">แก้ "${esc(mk[MKSEL].n)}":</span>${PRESETS.map(x=>`<button data-mkn="${x}">${x}</button>`).join('')}<button data-mkn="?">✏️ ชื่อเอง</button>
  <button id="mkl" class="${p.lp===MKSEL?'on':''}">🔁 วนท่อนนี้</button><button id="mks" class="${mk[MKSEL].sk?'on':''}">⏭ ข้ามท่อนนี้</button><button id="mkd" style="color:#ff453a">🗑 ลบ</button><button id="mkx">✕</button></div>`:''}`}
document.addEventListener('click',async e=>{const t=e.target;if(!cur||!t.closest('#mkbar'))return;const mk=marks(),p=pref(cur.id);
 const c=t.closest('[data-mk]');if(c){const i=+c.dataset.mk;MKSEL=i;seekFrac(mk[i].t/cur.buf.duration);mkUI();return}
 if(t.closest('#mka')){try{const at=pos();const n=$('mkp').value||'Intro';const i=mk.findIndex(m=>Math.abs(m.t-at)<0.5);if(i>=0)mk[i].n=n;else mk.push({t:Math.round(at*10)/10,n});await setMarks(mk);MKSEL=marks().findIndex(m=>Math.abs(m.t-at)<0.5);mkUI();toast('📍 มาร์ก '+n+' ที่ '+fmt(at),1800,true)}catch(err){blog('error','marker add',err&&err.message);toast('⚠️ มาร์กไม่สำเร็จ: '+(err&&err.message))}return}
 if(MKSEL<0||!mk[MKSEL])return;const nn=t.closest('[data-mkn]');
 if(nn){let n=nn.dataset.mkn;if(n=='?')n=(prompt('ชื่อท่อน',mk[MKSEL].n)||'').trim();if(n){mk[MKSEL].n=n.slice(0,20);await setMarks(mk)}return}
 if(t.id=='mkl'){await setMarks(mk,{lp:p.lp===MKSEL?null:MKSEL});return}
 if(t.id=='mks'){mk[MKSEL].sk=!mk[MKSEL].sk;await setMarks(mk);return}
 if(t.id=='mkd'){mk.splice(MKSEL,1);const lp=p.lp===MKSEL?null:(p.lp>MKSEL?p.lp-1:p.lp);MKSEL=-1;await setMarks(mk,{lp});return}
 if(t.id=='mkx'){MKSEL=-1;mkUI()}});
function drawMarks(g,W,H){if(!cur)return;const mk=marks(),d=cur.buf.duration,p=pref(cur.id),r=devicePixelRatio;
 mk.forEach((m,i)=>{const x=m.t/d*W,[a,b]=secOf(mk,i);if(m.sk||p.lp===i){g.fillStyle=m.sk?'rgba(255,69,58,.18)':'rgba(48,209,88,.16)';g.fillRect(a/d*W,0,(b-a)/d*W,H)}
  g.fillStyle=i==MKSEL?'#ffd60a':'#0a84ff';g.fillRect(x,0,1.5*r,H);g.font=`700 ${10*r}px system-ui`;const tw=g.measureText(m.n).width+8*r;g.fillRect(x,H-14*r,tw,14*r);g.fillStyle='#fff';g.fillText(m.n,x+4*r,H-4*r)})}
// loop / skip enforcement
setInterval(()=>{if(!cur||!playing||TAIL)return;const mk=marks();if(!mk.length)return;const p=pref(cur.id),at=pos();
 if(p.lp!=null&&mk[p.lp]){const[a,b]=secOf(mk,p.lp);if(at>=b-0.06||at<a-0.5){start(a);return}}
 for(let i=0;i<mk.length;i++)if(mk[i].sk&&i!==p.lp){const[a,b]=secOf(mk,i);if(at>=a&&at<b-0.1){if(b>=cur.buf.duration-0.1)finish();else start(b);return}}},50);
// --- fade out ---
let FADING=null;const FD=JSON.parse(localStorage.getItem('bp-fade')||'{"s":4,"m":"stop"}');$('fades').value=FD.s;$('fadem').value=FD.m;
$('fades').onchange=$('fadem').onchange=()=>{FD.s=+$('fades').value;FD.m=$('fadem').value;localStorage.setItem('bp-fade',JSON.stringify(FD))};
function fadeReset(){if(!MX.fade)return;if(FADING){clearTimeout(FADING);FADING=null;$('fadeb').classList.remove('on')}MX.fade.gain.cancelScheduledValues(ctx.currentTime);MX.fade.gain.setValueAtTime(1,ctx.currentTime)}
function doFade(){if(!playing||!MX.fade)return;if(FADING){fadeReset();return}const sec=FD.s,t=ctx.currentTime;MX.fade.gain.cancelScheduledValues(t);MX.fade.gain.setValueAtTime(MX.fade.gain.value,t);MX.fade.gain.linearRampToValueAtTime(0.0001,t+sec);
 $('fadeb').classList.add('on');$('ps').textContent='🔉 กำลังเฟดออก '+sec+' วิ... (แตะอีกครั้งเพื่อยกเลิก)';
 FADING=setTimeout(()=>{FADING=null;$('fadeb').classList.remove('on');const i=cur?SET.indexOf(cur.id):-1,nx=i>=0?SET[i+1]:null;stop();fadeReset();
  if(FD.m=='next'&&nx){load(nx)}else{$('ps').textContent='⏹ เฟดออกแล้ว';}},sec*1000)}
$('fadeb').onclick=doFade;
// --- crossfade / overlap auto-next ---
let TAIL=null;
function xfCheck(){if(!AUTO.on||!(AUTO.xf>0)||!cur||!playing||TAIL||FADING)return;const p=pref(cur.id);if(p.lp!=null)return;const left=(effEnd()-pos())/((p.tempo||100)/100);const i=SET.indexOf(cur.id),nx=i>=0?SET[i+1]:null;if(!nx)return;if(!cache.has(nx)){if(left<AUTO.xf+20&&SONG.get(nx)){decode(nx).catch(()=>{})}return}if(left>AUTO.xf)return;xfade(nx,left)}
setInterval(xfCheck,100);
function xfade(nx,left){const b=cur.buf,at=pos(),p=pref(cur.id),t=ctx.currentTime;
 const g=ctx.createGain();const lv=db2(mixOf(cur.id).M)*Math.pow(10,gainDb(cur.id)/20);g.gain.setValueAtTime(lv,t);g.gain.linearRampToValueAtTime(0.0001,t+left);
 let node,stopT;if(!needSh(p)){node=ctx.createBufferSource();node.buffer=b;node.connect(g);node.start(0,at)}else{node=new PitchShifter(ctx,b,8192,()=>{});node.pitchSemitones=p.key;node.tempo=(p.tempo||100)/100;node.percentagePlayed=at/b.duration;node.connect(g)}
 if(p.swap){const sp=ctx.createChannelSplitter(2),mg=ctx.createChannelMerger(2);g.connect(sp);sp.connect(mg,0,1);sp.connect(mg,1,0);mg.connect(ctx.destination);mg.connect(split2)}else{g.connect(ctx.destination);g.connect(split2)}
 TAIL={node,g};blog('info','crossfade '+left.toFixed(1)+'s -> '+nx);
 stopT=setTimeout(()=>{try{if(node.stop)node.stop();node.disconnect();if(node._node){node._node.onaudioprocess=null}}catch(e){}g.disconnect();TAIL=null},left*1000+200);
 load(nx).then(()=>{if(MX.fade){const t2=ctx.currentTime;MX.fade.gain.cancelScheduledValues(t2);MX.fade.gain.setValueAtTime(0.0001,t2);MX.fade.gain.linearRampToValueAtTime(1,t2+Math.min(left,AUTO.xf))}})}
// --- setlist search / insert / drag ---
let SQ='';
function sqDraw(){const r=$('sqr');if(!r)return;const q=sq(SQ);const ul=$('setul');
 if(ul)[...ul.children].forEach((li,i)=>{const id=SET[i],x=id&&SONG.get(id);li.style.display=!q||(x&&sq(x.t+' '+x.a+' '+x.fn).includes(q))?'':'none'});
 r.innerHTML=sqHtml(q)}
/*v1.83.6: result list shared by Tonight search and Live search*/function sqHtml(q){if(!q)return '';const hits=[...SONG.values()].filter(x=>!libHidden149(idOf(x))&&sq(x.t+' '+x.a+' '+x.fn).includes(q)).slice(0,12);
 const r=`<div class="small" style="margin:6px 0">ในลิสต์: ${SET.filter(i=>{const x=SONG.get(i);return x&&sq(x.t+' '+x.a+' '+x.fn).includes(q)}).length} • เพิ่มจากคลังเพลง:</div>`+hits.map(x=>{const id=idOf(x),inS=SET.includes(id);let kn='';try{kn=kl65(id,1)}catch(e){}return `<div class="sqh"><div class="i"><b>${esc(x.t)}</b> <span class="small">${esc(x.a||'')}</span><div class="sqm">${badge(x,pref(id))}${kn?` <span class="sqk">คีย์ ${esc(kn)}</span>`:''}</div></div>${inS?'<span class="small">✓ อยู่ในลิสต์</span>':`<div class="sqb"><button data-sins="${esc(id)}">แทรกถัดไป</button><button data-sapp="${esc(id)}">＋ ท้ายลิสต์</button><button data-spos="${esc(id)}" aria-label="เลือกตำแหน่งที่จะแทรก">แทรกตรง…</button></div>`}</div>`}).join('')||'<div class="small">ไม่พบเพลง</div>';return r}
document.addEventListener('input',e=>{if(e.target.id=='sq'){SQ=e.target.value;sqDraw()}});
// v1.82: choose where in Tonight to insert a library song
document.addEventListener('click',e=>{const t=e.target.closest('[data-spos]');if(!t)return;const row=t.closest('.sqh');const ex=row.nextElementSibling;if(ex&&ex.classList.contains('sqp')){ex.remove();return}
 document.querySelectorAll('.sqp').forEach(x=>x.remove());const c=cur?SET.indexOf(cur.id):-1;const o=['<option value="">— เลือกตำแหน่งในลิสต์คืนนี้ —</option>','<option value="0">⤒ บนสุด (ก่อนเพลงที่ 1)</option>'].concat(SET.map((i,n)=>{const x=SONG.get(i);return `<option value="${n+1}">หลัง ${n+1}. ${esc(x?x.t:i)}${n==c?' ▶':''}</option>`}));
 row.insertAdjacentHTML('afterend',`<div class="sqp"><select data-sposs="${esc(t.dataset.spos)}" aria-label="ตำแหน่งที่จะแทรก">${o.join('')}</select></div>`);const sel=row.nextElementSibling.querySelector('select');try{sel.focus()}catch(_){}});
document.addEventListener('change',async e=>{const t=e.target;if(!t.dataset||!t.dataset.sposs||t.value==='')return;const id=t.dataset.sposs;if(SET.includes(id))return;const at=Math.max(0,Math.min(SET.length,+t.value));SET.splice(at,0,id);
 await saveSet();autoSet();render();toast('✅ แทรกเป็นเพลงที่ '+(at+1)+': '+(SONG.get(id)?.t||''),2500,true)});
document.addEventListener('click',async e=>{const t=e.target.closest('[data-sins],[data-sapp],[data-help]');if(!t)return;const d=t.dataset;
 if(d.help){openHelp();return}
 const id=d.sins||d.sapp;if(SET.includes(id))return;if(d.sapp)SET.push(id);else{const c=cur?SET.indexOf(cur.id):-1;SET.splice(c>=0?c+1:0,0,id)}
 await saveSet();autoSet();render();toast('✅ '+(d.sins?'แทรกเป็นเพลงถัดไป: ':'เพิ่มท้ายลิสต์: ')+(SONG.get(id)?.t||''),2500,true)});
const _render=render;
function afterSetRender(){if(view!='S')return;const q=$('sq');if(q){q.value=SQ;sqDraw()}}
new MutationObserver(()=>{if(view=='S'&&$('sq')&&!$('sq').dataset.w){$('sq').dataset.w=1;afterSetRender()}}).observe($('main'),{childList:true});
// drag reorder via handle
let DRG=null;
/*v1.83.7: edge auto-scroll while dragging (rAF), drop slot re-computed while scrolling even if the finger is still*/
function scPar837(el){for(let e=el&&el.parentElement;e&&e!==document.body&&e!==document.documentElement;e=e.parentElement){const o=getComputedStyle(e).overflowY;if((o=='auto'||o=='scroll')&&e.scrollHeight>e.clientHeight+1)return e}return document.scrollingElement||document.documentElement}
function drgSlot(){if(!DRG)return;const ul=$('setul');if(!ul)return;const lis=[...ul.children],y=DRG.y;let to=lis.length-1;
 for(let i=0;i<lis.length;i++){if(i==DRG.from)continue;const r=lis[i].getBoundingClientRect();if(y<r.top+r.height/2){to=i>DRG.from?i-1:i;break}}DRG.to=Math.max(0,Math.min(lis.length-1,to));lis.forEach((l,i)=>l.classList.toggle('dropat',i==DRG.to&&i!=DRG.from))}
function drgPos(){if(!DRG)return;const st=DRG.sc.scrollTop;DRG.li.style.transform=`translateY(${DRG.y-DRG.y0+st-DRG.st0}px)`}
function drgEdge(){if(!DRG)return;const sc=DRG.sc,isDoc=sc===document.scrollingElement||sc===document.documentElement;const r=isDoc?{top:0,bottom:innerHeight}:sc.getBoundingClientRect();
 const top=Math.max(0,r.top),bot=Math.min(innerHeight,r.bottom),h=bot-top,z=Math.min(180,h*0.32);let v=0;
 const dt=DRG.y-top,db=bot-DRG.y,d=dt<z?dt:db<z?db:-1;if(d<0)DRG.et=0;else{const n=performance.now();if(!DRG.et)DRG.et=n;const k=1+0.7*Math.min(1,(n-DRG.et)/800);/*1.83.8: hold at edge → speeds up to 1.7x*/const s=Math.ceil((34*Math.pow(1-Math.max(0,d)/z,1.25)+2)*k);v=dt<z?-s:s}
 if(v){const b=sc.scrollTop;sc.scrollTop=b+v;if(sc.scrollTop!==b){drgPos();drgSlot()}}DRG.raf=requestAnimationFrame(drgEdge)}
function drgEnd(){if(!DRG)return;const{from,to,li,armed,raf}=DRG;if(raf)cancelAnimationFrame(raf);DRG=null;document.body.classList.remove('drg837');li.style.transform='';li.classList.remove('dragging');document.querySelectorAll('#setul .dropat').forEach(e=>e.classList.remove('dropat'));
 // v1.0.48: ignore if the finger never moved past the arm threshold (tap / accidental brush)
 if(!armed||to==from)return;
 {const[x]=SET.splice(from,1);SET.splice(to,0,x);saveSet().then(render,render)}
 /* v1.0.44: cancelled drag (to===from) used to call render() → full Tonight + strip flash */}
// v1.0.48: require ~16px move before a setlist drag arms — light taps no longer reorder
const DRG_ARM=16;
document.addEventListener('pointerdown',e=>{const h=e.target.closest('[data-dh]');if(!h||SQ||DRG)return;e.preventDefault();const li=h.closest('li');const sc=scPar837(li);DRG={from:+h.dataset.dh,li,y0:e.clientY,y:e.clientY,to:+h.dataset.dh,sc,st0:sc.scrollTop,pid:e.pointerId,armed:false,raf:0};try{h.setPointerCapture(e.pointerId)}catch(_){}});
document.addEventListener('pointermove',e=>{if(!DRG||e.pointerId!==DRG.pid)return;e.preventDefault();DRG.y=e.clientY;
 if(!DRG.armed){if(Math.abs(DRG.y-DRG.y0)<DRG_ARM)return;DRG.armed=true;DRG.y0=DRG.y;DRG.st0=DRG.sc.scrollTop;DRG.li.classList.add('dragging');document.body.classList.add('drg837');DRG.raf=requestAnimationFrame(drgEdge)}
 drgPos();drgSlot()},{passive:false});
document.addEventListener('touchmove',e=>{if(DRG&&DRG.armed)e.preventDefault()},{passive:false});/*iOS: stop the page from panning against the drag*/
document.addEventListener('pointerup',e=>{if(DRG&&e.pointerId===DRG.pid)drgEnd()});
document.addEventListener('pointercancel',e=>{if(DRG&&e.pointerId===DRG.pid)drgEnd()});
window.__drg837={get d(){return DRG},ARM:DRG_ARM};
// v1.83.8: นอม side edits apply to playback right away + band sync
function sd838(id,e,x){if(ap842(id,e,x))return;if(!x||!(x.sd=='L'||x.sd=='R')||e.s===x.sd)return;const m=META[id];if(m&&m.so)return;const o=e.s;e.s=x.sd;if(m&&m.s)m.s=x.sd;blog('info','band side '+id+' '+o+'→'+x.sd);if(cur&&cur.id===id)try{applyMix();mixUI()}catch(_){}SD838.n++}
const SD838={n:0,last:null};
async function side838(id,s,s0){try{if(cur&&cur.id===id){applyMix();try{mixUI()}catch(_){}}}catch(e){}
 try{if(id in BPMD){delete BPMD[id];localStorage.setItem('bp-bpmd',JSON.stringify(BPMD))}}catch(e){} // BPM was detected on the old click channel
 const r={id,s:s.s,band:[],local:true};SD838.last=r;if(!(s.s=='L'||s.s=='R'))return r;
 try{if(CLD.user&&CLD.mod&&CLD.mod.bandSongSd&&s.t){
  for(const {b,x} of bsFind842(id)){const role=bdRole(b);
   if(role){try{await CLD.mod.bandSongSd(b.id,x.id,s.s);sed848(b.id,x,{sd:s.s});x.sd=s.s;r.band.push(b.id);r.local=false;if(META[id]&&META[id].so){delete META[id].so;put('kv',{k:'meta',v:META}).catch(()=>{})}}catch(e){blog('warn','band side',e.code||e.message);toast('⚠️ ซิงก์นอมให้วงไม่ได้ — ใช้เฉพาะเครื่องนี้',3000)}}
   else{r.denied=1;toast('ℹ️ เปลี่ยนเฉพาะเครื่องคุณ — หัวหน้าวง/คนอัปเท่านั้นที่เปลี่ยนให้ทั้งวงได้',5000)}}
  if(r.band.length)toast('☁︎ อัปเดตนอมให้สมาชิกวงแล้ว',2000,true)}}catch(e){blog('warn','side838',e.message)}return r}
window.__sd838={get:()=>SD838,ch:id=>clickCh(id),side:id=>(SONG.get(id)||{}).s,mix:()=>mixState()};
// v1.83.9: remove a song from Tonight in Live — undo bar 5 s; the playing song is removed after it ends (playback never stops)
const RM839={last:null,after:null,t:0};
function rmBar839(h,undo){let b=$('rm839');if(!b){b=document.createElement('div');b.id='rm839';document.body.appendChild(b)}b.innerHTML='<span class="rm839t">'+h+'</span>'+(undo?'<button type="button" class="hw" id="rm839u">↩ เลิกทำ</button>':'');b.hidden=false;if(undo)$('rm839u').onclick=()=>{undo();b.hidden=true};clearTimeout(RM839.t);RM839.t=setTimeout(()=>{b.hidden=true;RM839.last=null},5000)}
async function rmNow839(id){const i=SET.indexOf(id);if(i<0)return;SET.splice(i,1);RM839.last={id,i};if(cue===id){cue=null;try{drawCue()}catch(e){}}await saveSet();render();try{autoSet()}catch(e){}
 const t=(SONG.get(id)||{}).t||'';rmBar839(`🗑 ลบ “<b data-noi18n>${esc(t)}</b>” ออกจากลิสต์แล้ว`,async()=>{if(SET.includes(id))return;SET.splice(Math.min(i,SET.length),0,id);RM839.last=null;await saveSet();render();try{autoSet()}catch(e){}})}
function lvRm839(id,opts){opts=opts||{};const t=(SONG.get(id)||{}).t||'';
 // Dual / force: remove from SET immediately so the band list syncs even if a deck still holds the song
 if(opts.force||(window.__dual&&__dual.on))return rmNow839(id);
 if(cur&&cur.id===id){RM839.after=id;rmMark839();rmBar839(`⏳ “<b data-noi18n>${esc(t)}</b>” จะถูกลบออกหลังเพลงนี้จบ (เพลงไม่หยุด)`,()=>{RM839.after=null;rmMark839()});return}
 return rmNow839(id)}
function rmMark839(){document.querySelectorAll('#livelist .lvl .sc[data-sid]').forEach(c=>c.classList.toggle('rm839',c.dataset.sid===RM839.after))}
setInterval(()=>{try{if(RM839.after&&!(cur&&cur.id===RM839.after)&&!loadingId){const id=RM839.after;RM839.after=null;rmNow839(id)}else if(RM839.after)rmMark839()}catch(e){}},500);
window.__rm839={s:RM839,rm:lvRm839};
// --- help ---
function openHelp(){let h=$('help');if(!h){h=document.createElement('div');h.id='help';document.body.appendChild(h);
 h.innerHTML=`<div class="hpw"><div class="hph"><b>❓ วิธีใช้ SetSod</b><button id="hpx" class="hw">✕ ปิด</button></div>
 <details><summary>1. เริ่มต้น</summary><ol><li>เปิดเว็บใน Safari → แชร์ → <b>เพิ่มไปยังหน้าจอโฮม</b></li><li>เปิดแอปจากไอคอนบนหน้าจอทุกครั้ง</li><li>แท็บ 🎵 เลือกข้างหู (นอมขวา/ซ้าย) แล้วแตะ ▶ เพื่อเล่น</li></ol></details>
 <details><summary>2. ทำลิสต์คืนนี้</summary><ol><li>แตะ ✓/＋ ที่เพลงเพื่อเข้าลิสต์</li><li>แท็บ 🎤 พิมพ์ค้นหาในช่อง 🔍 — กด <b>แทรกถัดไป</b> หรือ <b>＋ ท้ายลิสต์</b></li><li>ลากที่ <b>⠿</b> เพื่อเรียงลำดับ</li><li>กด ⬇️ โหลดทั้งลิสต์ แล้ว ✔️ เช็กเพลงคืนนี้ ก่อนขึ้นงาน</li></ol></details>
 <details><summary>3. คีย์ / ความเร็ว</summary><ol><li>เปิดหน้าเล่น (⌃) → คีย์ − / + เปลี่ยนได้ขณะเล่น</li><li>ความเร็ว − / + ทีละ 1 BPM (หรือ 1%) แตะตัวเลขเพื่อคืนค่าเดิม</li><li>ค่าจำแยกแต่ละเพลง</li></ol></details>
 <details><summary>4. มิกเซอร์</summary><ol><li>เฟดเดอร์ 🥁 นอม = เสียงคลิก, 🎵 เพลง = ดนตรี</li><li>M = ปิดเสียง, S = ฟังช่องเดียว, L/C/R = ออกหูไหน</li><li>↺ รีเซ็ต คืนค่าเดิม (จำแยกแต่ละเพลง)</li></ol></details>
 <details><summary>5. มาร์กท่อนเพลง</summary><ol><li>เล่นถึงจุดเริ่มท่อน → เลือกชื่อ (Intro/Verse/Chorus…) → <b>＋ มาร์ก</b></li><li>แตะชื่อท่อนเพื่อกระโดดไป</li><li>แตะแล้วเลือก 🔁 วนท่อนนี้ (ซ้อม) หรือ ⏭ ข้ามท่อนนี้</li></ol></details>
 <details><summary>6. จบเพลงสวย ๆ</summary><ol><li>🔉 เฟดออก: เลือก 2/4/6/8 วิ และ "แล้วหยุด" หรือ "แล้วเล่นเพลงถัดไป"</li><li>เล่นต่ออัตโนมัติ + "ซ้อนเพลง X วิ" = เพลงใหม่เข้ามาขณะเพลงเก่าค่อย ๆ เบาลง</li></ol></details>
 <details><summary>7. โหมด Live / เมโทรนอม</summary><ol><li>🎤 Live = ปุ่มเล่นใหญ่ + ลิสต์ ใช้บนเวที</li><li>🥁 เมโทรนอม: หมุนวงนอกปรับ BPM แตะกลางเพื่อจับจังหวะ เลือกเสียงคลิกได้</li></ol></details>
 <details><summary>8. กันสายเข้า/แจ้งเตือนระหว่างโชว์</summary><ol><li>โหลดเพลงทั้งลิสต์ให้ครบ (⬇️ โหลดทั้งลิสต์ → ✔️ เช็กเพลงคืนนี้)</li><li>เปิด <b>โหมดเครื่องบิน</b> และปิด Wi‑Fi — สายโทรศัพท์และ LINE จะเข้าไม่ได้</li><li>เปิดโหมด <b>ห้ามรบกวน/โฟกัส</b> ไม่อนุญาตใครเลย และปิด "สายโทรซ้ำ"</li><li>ปิดเสียงแจ้งเตือน LINE (หรือปิดแจ้งเตือนชั่วคราว)</li><li>ตั้งเสียงเครื่องให้พอดี และเสียบสายชาร์จ</li><li>ในแท็บ 🎤 ติ๊กเช็กลิสต์ "ก่อนขึ้นโชว์" ให้ครบทุกข้อ</li></ol>${osGuide()}</details>
 <details><summary>9. มีปัญหา?</summary><ol><li>ปิดแอปแล้วเปิดใหม่ (ตำแหน่งเพลงจะกลับมา)</li><li>เขียนอาการด้านล่าง แล้วกด <b>📤 ส่งรายงานปัญหา</b> ส่งไฟล์ให้ทีมงาน</li></ol>
 <textarea id="hpn" placeholder="เล่าอาการ เช่น กดเล่นแล้วเงียบ ตอนเพลงที่ 3" style="width:100%;min-height:70px;box-sizing:border-box;font:inherit;background:#111;color:#fff;border:1px solid #333;border-radius:10px;padding:8px"></textarea>
 <button id="hps" class="hw" style="width:100%;margin-top:8px;font-size:18px">📤 ส่งรายงานปัญหา</button><div id="hpo" class="small"></div></details></div>`;
 $('hpx').onclick=()=>h.classList.remove('on');h.onclick=e=>{if(e.target===h)h.classList.remove('on')};$('hps').onclick=()=>sendReport($('hpn').value)}h.classList.add('on')}
async function sendReport(note){let est={};try{est=await navigator.storage.estimate()}catch(e){}
 const rep={v:APPV,at:new Date().toISOString(),note:note||'',ua:navigator.userAgent,scr:innerWidth+'x'+innerHeight,usage:est.usage,quota:est.quota,set:SET.length,cur:cur&&cur.id,log:JSON.parse(localStorage.getItem(LOGK)||'[]')};
 const name='beer-player-report-'+Date.now()+'.json',blob=new Blob([JSON.stringify(rep,null,1)],{type:'application/json'});window.__lastReport=rep;
 try{const f=new File([blob],name,{type:'application/json'});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'SetSod report'});$('hpo').textContent='✅ ส่งแล้ว';return}}catch(e){if(e&&e.name=='AbortError')return}
 const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);$('hpo').textContent='✅ บันทึกไฟล์ '+name+' แล้ว — ส่งไฟล์นี้ให้ทีมงานทาง LINE/อีเมล'}
mkUI();tempoUI();

// ===== v1.23 beat / BPM =====
const BPMD=JSON.parse(localStorage.getItem('bp-bpmd')||'{}');
function detectBpm(buf,ch){const sr=buf.sampleRate,d=buf.getChannelData(Math.min(ch,buf.numberOfChannels-1)),fr=Math.round(sr*0.005),n=Math.floor(d.length/fr),env=new Float32Array(n);
 for(let i=0;i<n;i++){let m=0;const e=(i+1)*fr;for(let j=i*fr;j<e;j+=2){const v=d[j]<0?-d[j]:d[j];if(v>m)m=v}env[i]=m}
 const srt=Float32Array.from(env).sort(),hi=srt[Math.floor(n*0.995)]||0;if(hi<0.02)return null;const thr=hi*0.3,minGap=Math.round(0.18/0.005);
 const on=[];let last=-1e9;for(let i=1;i<n;i++){if(env[i]>=thr&&env[i-1]<thr&&i-last>=minGap){on.push(i*0.005);last=i}}
 if(on.length<8)return null;const iv=[];for(let i=1;i<on.length;i++)iv.push(on[i]-on[i-1]);const sv=[...iv].sort((a,b)=>a-b),med=sv[Math.floor(sv.length/2)];
 // refine with least squares over onsets that sit on the grid
 const t0=on[0];let sx=0,sy=0,sxx=0,sxy=0,k=0;for(const t of on){const idx=Math.round((t-t0)/med);if(Math.abs((t-t0)-idx*med)<med*0.2){sx+=idx;sy+=t;sxx+=idx*idx;sxy+=idx*t;k++}}
 let per=med;if(k>8){per=(k*sxy-sx*sy)/(k*sxx-sx*sx)}let bpm=60/per;while(bpm<60)bpm*=2;while(bpm>240)bpm/=2;
 const r=Math.round(bpm);bpm=Math.abs(bpm-r)<0.5?r:Math.round(bpm*10)/10;const ph=((t0%(60/bpm))+60/bpm)%(60/bpm);
 return{b:bpm,t0:Math.round(ph*1000)/1000,conf:Math.round(k/on.length*100)/100,n:on.length}}
function baseBpm(id){const p=pref(id);if(p.bpm)return p.bpm;if(BPMD[id]&&BPMD[id].b)return BPMD[id].b;const b=+SONG.get(id)?.b;return b||null}
function bpmSrc(id){const p=pref(id);return p.bpm?'manual':BPMD[id]&&BPMD[id].b?'auto':+SONG.get(id)?.b?'list':'none'}
function sigOf(id){const v=pref(id).sig;return v==null?4:+v}
function t0Of(id){const p=pref(id);return p.bt0!=null?p.bt0:(BPMD[id]?BPMD[id].t0:0)}
function beatLoad(){const id=cur.id;if(!(id in BPMD)){const r=detectBpm(cur.buf,clickCh(id));BPMD[id]=r||{b:null};try{localStorage.setItem('bp-bpmd',JSON.stringify(BPMD))}catch(e){}blog('info','bpm detect '+id+': '+JSON.stringify(r))}beatUI();tempoUI()}
let BEATN=0,BFL=0;
function beatUI(){const el=$('beatc');if(!el)return;if(!cur){$('bbv').textContent='—';return}const id=cur.id,b=baseBpm(id),src=bpmSrc(id);
 $('bbv').textContent=b?(b+'').replace(/\.0$/,''):'—';$('bbs').textContent={manual:'ตั้งเอง',auto:'ตรวจจากนอม',list:'จากรายชื่อ',none:'ยังไม่รู้'}[src];
 el.querySelectorAll('[data-bsig]').forEach(x=>x.classList.toggle('on',+x.dataset.bsig==sigOf(id)))}
async function setBase(v,t0){if(!cur||!v)return;v=Math.max(30,Math.min(300,Math.round(v*10)/10));const ch={bpm:v};if(t0!=null)ch.bt0=t0;await setPref(ch);beatUI();tempoUI()}
let BTAPS=[];
document.addEventListener('click',async e=>{const t=e.target.closest('#beatc [data-bd],#btap,#bdet,#beatc [data-bsig]');if(!t||!cur)return;const id=cur.id;
 if(t.dataset.bd){const b=baseBpm(id)||120,d=+t.dataset.bd;await setBase(Math.abs(d)<1?b+d:Math.round(b)+d)}
 else if(t.id=='btap'){const n=performance.now();BTAPS=BTAPS.filter(x=>n-x<2500);BTAPS.push(n);if(BTAPS.length>8)BTAPS.shift();
  if(BTAPS.length>=3){const real=60000/((BTAPS[BTAPS.length-1]-BTAPS[0])/(BTAPS.length-1)),tp=(pref(id).tempo||100)/100;await setBase(real/tp,playing?pos()%(60/(real/tp)):null)}$('btap').classList.add('hit');setTimeout(()=>$('btap')&&$('btap').classList.remove('hit'),90)}
 else if(t.id=='bdet'){delete BPMD[id];const p={...pref(id)};delete p.bpm;delete p.bt0;PREF.set(id,p);await put('prefs',p);beatLoad()}
 else if(t.dataset.bsig){await setPref({sig:+t.dataset.bsig});beatUI()}});
// beat flash loop
(function bl(){requestAnimationFrame(bl);const el=$('bcnt');if(!el||!cur)return;const b=baseBpm(cur.id);if(!b){if(el.textContent)el.textContent='';return}
 const per=60/b,ph=(pos()-t0Of(cur.id))/per;if(ph<0){if(el.textContent)el.textContent='';return}const n=Math.floor(ph),sg=sigOf(cur.id)||1,frac=ph-n;BEATN=n;
 const bi=sg==1?1:(n%sg)+1;if(el.textContent!==String(bi))el.textContent=bi;const on=playing&&frac<0.18;if(on&&BFL!==n)BFL=n;el.classList.toggle('fl',on);el.classList.toggle('acc',on&&bi==1&&sg>1)})();
// build beat card + counter badge
(function(){const g=document.querySelector('#plx .grid');if(g&&!$('beatc')){const c=document.createElement('div');c.className='card beatcard';c.id='beatc';
 c.innerHTML=`<div class="lb">บีท / BPM เพลงนี้ <span id="bbs" class="small"></span></div><div class="step"><button data-bd="-1">−</button><button data-bd="-0.1" class="bfine">−.1</button><span class="v" id="bbv" style="font-size:20px">—</span><button data-bd="0.1" class="bfine">+.1</button><button data-bd="1">+</button></div>
 <div class="brow"><button id="btap" class="hw">👆 แตะตามจังหวะ</button><button id="bdet" class="hw" title="ตรวจ BPM ใหม่">🔍 ตรวจใหม่</button></div>
 <div class="bsig">${[1,2,3,4,6].map(x=>`<button data-bsig="${x}">${x==6?'6/8':x+'/'+(x==1?1:4)}</button>`).join('')}</div>`;g.appendChild(c)}
 const ct=document.querySelector('#studio .counter');if(ct&&!$('bcnt')){const b=document.createElement('div');b.id='bcnt';b.className='bcnt';ct.insertBefore(b,ct.children[1])}})();
// ===== v1.23 no-zoom + search clear =====
['gesturestart','gesturechange'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches&&e.touches.length>1)e.preventDefault()},{passive:false});
function ensureClear(){document.querySelectorAll('input[type=search]:not([data-clr])').forEach(inp=>{inp.dataset.clr=1;const w=document.createElement('span');w.className='sw';inp.parentNode.insertBefore(w,inp);w.appendChild(inp);
 const b=document.createElement('button');b.type='button';b.className='sclr';b.setAttribute('aria-label','ล้างคำค้น');b.textContent='✕';w.appendChild(b);
 const upd=()=>w.classList.toggle('has',!!inp.value);inp.addEventListener('input',upd);upd();
 b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',()=>{inp.value='';inp.dispatchEvent(new Event('input',{bubbles:true}));upd();inp.focus()})})
 document.querySelectorAll('.sw').forEach(w=>{const i=w.querySelector('input');if(i)w.classList.toggle('has',!!i.value)})}
new MutationObserver(ensureClear).observe(document.body,{childList:true,subtree:true});ensureClear();

// ===== v1.23b tempo slider =====
function tempoLive(t){if(!cur)return;t=Math.max(50,Math.min(150,Math.round(t*2)/2));if(!stuHold(cur.id,{tempo:t}))try{lvEdit(cur.id,'tempo');lvUser('field')}catch(e){}const p={...pref(cur.id),tempo:t};PREF.set(cur.id,p);
 if(playing){if(sh){sh.tempo=t/100;sh.pitchSemitones=p.key||0}else if(needSh(p))start(pos())}tempoUI();return p}
let TSV=null;if($('tsl'))$('tsl').addEventListener('input',e=>{TSV=tempoLive(+e.target.value)});
if($('tsl'))$('tsl').addEventListener('change',()=>{if(TSV)put('prefs',TSV).catch(()=>{});TSV=null;renderSoon()});
if($('trs'))$('trs').onclick=()=>{if(cur)setPref({tempo:100})};
const _tUI=tempoUI;tempoUI=function(){_tUI();const p=cur?pref(cur.id):{tempo:100},t=p.tempo||100,b=cur&&baseBpm(cur.id);if(document.activeElement!==$('tsl'))$('tsl').value=t;
 $('tpc').textContent=(t+'').replace(/\.0$/,'')+'%'+(b?' · '+(Math.round(b*t/10)/10+'').replace(/\.0$/,'')+' BPM':'')};
// ===== v1.23b accordions =====
// v1.44: every collapsible section starts collapsed on each app start; open/closed is remembered only until the app is closed
const ACC={};try{localStorage.removeItem('bp-acc')}catch(e){}
function accify(el,key,title,def=true){if(!el)return;let hd=el.querySelector(':scope>.acch');if(!hd){hd=document.createElement('button');hd.type='button';hd.className='acch';hd.dataset.acc=key;el.insertBefore(hd,el.firstChild)}
 if(hd.dataset.t!==title){hd.textContent=title;hd.dataset.t=title}const open=key in ACC?ACC[key]:false;if(el.classList.contains('acc-c')===open)el.classList.toggle('acc-c',!open);if(hd.getAttribute('aria-expanded')!==String(open))hd.setAttribute('aria-expanded',open)}
document.addEventListener('click',e=>{const hd=e.target.closest('.acch');if(!hd)return;const k=hd.dataset.acc,el=hd.parentNode;const open=el.classList.contains('acc-c');ACC[k]=open;el.classList.toggle('acc-c',!open);hd.setAttribute('aria-expanded',open);requestAnimationFrame(()=>{try{waveDraw()}catch(e){}})});
const secKey=t=>t.replace(/\(.*?\)|\d+/g,'').replace(/[^\u0E00-\u0E7Fa-zA-Z ]/g,'').trim().slice(0,30);
// v1.84.16: icon-first chrome helpers
const IC16={swap:'<path d="M7 7h13l-3-3M17 17H4l3 3"/>',norm:'<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',click:'<path d="M9 3h6l4 18H5z"/><path d="M12 16l5-10"/>',room:'<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/>',out:'<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>',vol:'<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'};
const SV16=d=>`<svg class="ic16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
function tg16(el,ic,lab,on){if(!el)return;const k=ic+on;if(el.dataset.k16===k)return;el.dataset.k16=k;el.innerHTML=SV16(IC16[ic])+`<span class="sr16">${lab}: ${on?'เปิด':'ปิด'}</span>`;el.classList.toggle('on',on);el.setAttribute('aria-pressed',String(on));el.title=lab+': '+(on?'เปิด':'ปิด')}
function mt16(c,t){const hd=c.querySelector(':scope>.acch');if(!hd)return;const M=/^เสียงคลิก/.test(t)?['click','Click']:/^ห้องเพลง/.test(t)?['room','Room']:/^ออกเสียงที่หู/.test(t)?['out','Out']:/^ความดัง/.test(t)?['vol','Vol'+t.replace(/^ความดัง/,'')]:null;if(!M)return;const k=M[1];if(hd.dataset.m16===k)return;hd.dataset.m16=k;hd.innerHTML=SV16(IC16[M[0]])+`<span data-noi18n>${k}</span>`;hd.setAttribute('aria-label',t);hd.title=t}
document.addEventListener('click',e=>{if(!e.target.closest('#qf16'))return;const h=document.querySelector('#hd .chipw>.acch');if(h)h.click();setTimeout(()=>{const w=document.querySelector('#hd .chipw');$('qf16')&&$('qf16').classList.toggle('on',!!w&&!w.classList.contains('acc-c'))},0)});
function ensureAcc(){
 try{tg16($('sw'),'swap','สลับ L/R',!!(cur&&pref(cur.id).swap));tg16($('nm'),'norm','ปรับเสียงให้เท่ากัน',!!NORM)}catch(e){}
 accify(document.querySelector('#studio .mixer'),'mix','🎛 มิกเซอร์');
 accify($('mkbar'),'mk','📍 ท่อนเพลง (มาร์ก/วน/ข้าม)');
 accify($('fdrow'),'fd','🔉 เฟดออก',false);
 accify(document.querySelector('#plx>.grid'),'cards','🎚 คีย์ · ความเร็ว · ระดับเสียง · บีท');
 accify($('auto'),'auto','⏭ เล่นต่ออัตโนมัติ / ซ้อนเพลง',false);
 accify(document.querySelector('#hd .chipw'),'chips','🏷 ตัวกรองหมวด');
 document.querySelectorAll('#metro .mwrap>.mcard:not(.mtop)').forEach(c=>{const lb=c.querySelector(':scope>.lb');if(!lb)return;c.classList.add('acc-hide-lb');accify(c,'m:'+secKey(lb.textContent),'⚙️ '+lb.textContent,false);mt16(c,lb.textContent)});
 document.querySelectorAll('#main>.sec').forEach(c=>{const h2=c.querySelector(':scope>h2');if(!h2||c.querySelector('#sq'))return;c.classList.add('acc-hide-lb');accify(c,'s:'+secKey(h2.textContent),h2.textContent,true)})}
let accQ=0;new MutationObserver(()=>{if(accQ)return;accQ=requestAnimationFrame(()=>{accQ=0;ensureAcc()})}).observe(document.body,{childList:true,subtree:true});ensureAcc();

// ===== v1.24 version consistency: never run new app.js with an old cached index.html =====
(function(){const mv=document.querySelector('meta[name="bp-ver"]');const hv=mv&&mv.content;if(hv!==APPV){blog('warn','version mismatch index='+hv+' app='+APPV);
 const go=()=>{if(sessionStorage.getItem('bp-vfix')==APPV)return;sessionStorage.setItem('bp-vfix',APPV);bpReload('version mismatch index='+hv)};if(!playing)go();else{toast('🔄 มีเวอร์ชันใหม่ — หยุดเพลงแล้วแอปจะรีเฟรชเอง',6000,true);if(!window.__bpVfixT)window.__bpVfixT=setInterval(()=>{if(!playing){clearInterval(window.__bpVfixT);window.__bpVfixT=0;go()}},2000)}}
 if('serviceWorker' in navigator){let done=false;const had=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(done||!had)return;done=true;if(!playing||window.__updForce){bpReload('sw update')}else{const iv=setInterval(()=>{if(!playing){clearInterval(iv);bpReload('sw update (after stop)')}},1000);toast('🔄 อัปเดตแอปแล้ว — จะรีเฟรชเมื่อหยุดเพลง',6000,true)}})}})();

// ===== v1.25 show-safety checklist =====
function osKind(){const u=navigator.userAgent||'';if(/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1))return'ios';if(/Android/i.test(u))return'android';return'other'}
function netLine(unstored){const c=navigator.connection,ty=c&&(c.type||c.effectiveType);const tt=ty?` (${ty})`:'';
 if(navigator.onLine){return unstored?`<span class="warn">⚠️ ยังมี ${unstored} เพลงไม่ได้โหลดเก็บ — กด ⬇️ โหลดทั้งลิสต์ก่อน แล้วค่อยเปิดโหมดเครื่องบิน</span>`:`<span class="warn">⚠️ ยังต่อเน็ตอยู่${tt} — แนะนำเปิดโหมดเครื่องบิน (และปิด Wi‑Fi) กันสายเข้า/แจ้งเตือน</span>`}
 return unstored?`<span class="warn">❌ ออฟไลน์อยู่ แต่ยังมี ${unstored} เพลงไม่ได้โหลด — ต่อเน็ตแล้วโหลดก่อน</span>`:'<span class="ok">✅ ออฟไลน์แล้ว (โหมดเครื่องบิน) — สายเข้า/LINE เข้าไม่ได้</span>'}
function osGuide(k=osKind()){const ios=`<div class="osg"><b>📱 iPhone: เปิดโฟกัส "ห้ามรบกวน"</b><ol><li>ตั้งค่า › <b>โฟกัส</b> › <b>ห้ามรบกวน</b></li><li><b>บุคคล</b> › อนุญาตการแจ้งเตือนจาก: <b>ไม่มีใคร</b> (ลบรายชื่อทั้งหมด)</li><li>ปิด <b>อนุญาตสายโทรจาก</b> = ไม่มีใคร และปิด <b>สายโทรซ้ำ</b></li><li><b>แอป</b> › ไม่อนุญาตแอปใด (เอา LINE ออก) และปิด "การแจ้งเตือนที่มีความสำคัญเร่งด่วน"</li><li>ปัดศูนย์ควบคุมลง › แตะ <b>โฟกัส</b> › ห้ามรบกวน (เปิด)</li><li>แล้วเปิด ✈️ <b>โหมดเครื่องบิน</b> และแตะปิด Wi‑Fi</li></ol></div>`;
 const and=`<div class="osg"><b>🤖 Android: เปิด "ห้ามรบกวน"</b><ol><li>การตั้งค่า › <b>การแจ้งเตือน</b> (หรือ เสียง) › <b>ห้ามรบกวน</b></li><li><b>บุคคล/การโทร</b>: ไม่อนุญาตใคร • ปิด <b>ผู้โทรซ้ำ</b></li><li><b>ข้อความ</b>: ไม่อนุญาตใคร • <b>แอป</b>: ไม่มีข้อยกเว้น (เอา LINE ออก)</li><li>ปิด "อนุญาตการเตือน/นาฬิกาปลุก" ถ้าไม่ต้องใช้</li><li>ปัดแถบด่วนลง › แตะ <b>ห้ามรบกวน</b> และ ✈️ <b>โหมดเครื่องบิน</b> (ปิด Wi‑Fi)</li></ol></div>`;
 const line=`<div class="osg"><b>💬 LINE: ปิดเสียงแจ้งเตือน</b><ol><li>LINE › หน้าหลัก › ⚙️ <b>ตั้งค่า</b> › <b>การแจ้งเตือน</b></li><li>แตะ <b>หยุดชั่วคราว</b> 1 ชั่วโมง (หรือปิดการแจ้งเตือน)</li><li>ปิด <b>การโทร LINE</b>: ตั้งค่า › การโทร › ปิด "อนุญาตการโทร" ชั่วคราว</li></ol></div>`;
 return (k=='ios'?ios:k=='android'?and:ios+and)+line}
const CK=[['air','✈️ เปิดโหมดเครื่องบิน + ปิด Wi‑Fi'],['dnd','🌙 เปิดโฟกัส/ห้ามรบกวน (ไม่อนุญาตใคร, ปิดสายโทรซ้ำ)'],['line','💬 ปิดแจ้งเตือน/การโทร LINE'],['vol','🔊 ตั้งเสียงเครื่องแล้ว (ปิดโหมดเงียบ)'],['chg','🔌 เสียบสายชาร์จ / แบตพอ']];
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
function ckLoad(){let o={};try{o=JSON.parse(localStorage.getItem('bp-showck')||'{}')}catch(e){}if(o.day!==today())o={day:today(),t:{}};return o}
function drawShowck(){const el=$('showck');if(!el)return;const o=ckLoad(),n=CK.filter(([k])=>o.t[k]).length,os=osKind();
 el.innerHTML=`<div class="ckbox"><div class="ckh"><b>🛡 ก่อนขึ้นโชว์ (${n}/${CK.length})</b> <span class="small">${today()}</span></div>
 <div class="small" id="cknet">${netLine(SET.filter(i=>{const x=SONG.get(i);return x&&!fileOf(x)}).length)}</div>
 ${CK.map(([k,l])=>`<label class="ck"><input type="checkbox" data-ck="${k}" ${o.t[k]?'checked':''}><span>${l}</span></label>`).join('')}
 <div class="${n==CK.length?'ok':'small'}" id="ckall">${n==CK.length?'✅ พร้อมขึ้นโชว์!':'ติ๊กให้ครบทุกข้อก่อนขึ้นเวที'}</div>
 <details class="ckhow"><summary>วิธีตั้งค่า (${os=='ios'?'iPhone':os=='android'?'Android':'iPhone / Android'})</summary>${osGuide(os)}</details>
 <button id="ckreset" class="hw" style="margin-top:6px">↺ เริ่มโชว์ใหม่ (ล้างติ๊ก)</button></div>`}
document.addEventListener('change',e=>{const k=e.target.dataset&&e.target.dataset.ck;if(!k)return;const o=ckLoad();o.t[k]=e.target.checked;localStorage.setItem('bp-showck',JSON.stringify(o));drawShowck()});
document.addEventListener('click',e=>{if(e.target.id=='ckreset'){localStorage.setItem('bp-showck',JSON.stringify({day:today(),t:{}}));drawShowck()}});
['online','offline'].forEach(ev=>window.addEventListener(ev,()=>{const n=$('cknet');if(n)n.innerHTML=netLine(SET.filter(i=>{const x=SONG.get(i);return x&&!fileOf(x)}).length)}));
new MutationObserver(()=>{const el=$('showck');if(el&&!el.childElementCount)drawShowck()}).observe($('main'),{childList:true});
window.__showck={osKind,netLine,ckLoad};
// ===== v26 batch B =====
var META=window.META||{};var R847={full:0,skip:0};window.__r847=R847;var LASTBPM=null;
const trS=id=>{const p=pref(id);return p.ts>0?p.ts:0};
const trE=(id,d)=>{const p=pref(id);return p.te>0&&p.te<d?p.te:d};
function effEnd(){return cur?trE(cur.id,cur.buf.duration):0}
function realBpm(id){const b=baseBpm(id);return b?b*((pref(id).tempo||100)/100):null}
function durUpd(){if(!cur)return;try{DUR[cur.id]=Math.max(1,Math.round(effEnd()-trS(cur.id)));localStorage.setItem('bp-dur',JSON.stringify(DUR))}catch(e){}try{stripDraw()}catch(e){}try{if(window.__dual&&typeof window.__dual.refreshDur==='function')window.__dual.refreshDur()}catch(e){}try{if(view==='S'&&$('stoth')){const TL=setTotLabel(),el=$('stoth'),tx='คืนนี้ · '+TL;if(el.textContent!==tx)el.textContent=tx}}catch(e){}}
// ---- count-in ----
let CI={bars:0,snd:'beep',...JSON.parse(localStorage.getItem('bp-ci')||'{}')};let CNT=null;
function ciBars(id){const v=pref(id).ci;return v==null||v===''?+CI.bars:+v}
function ciCancel(){if(CNT){clearTimeout(CNT.to);try{CNT.nodes.forEach(n=>{try{n.stop()}catch(e){}})}catch(e){}CNT=null;ciShow()}}
function ciShow(){const el=$('cist');if(el)el.textContent=CNT?'🥁 นับเข้า…':''}
function ciSide(id){const m=mixOf(id),ch=clickCh(id),o=m.c.o||outDef(ch,pref(id).swap);return o=='L'?-1:o=='R'?1:0}
function ciTone(t,acc,pan,out){const s=CI.snd,o=ctx.createOscillator(),g=ctx.createGain();const F={beep:[1500,1000,'sine'],wood:[1800,1250,'triangle'],clave:[2500,2000,'sine'],digi:[2000,1400,'square'],cow:[800,560,'square'],rim:[1700,1200,'square']}[s]||[1500,1000,'sine'];
 o.type=F[2];o.frequency.value=acc?F[0]:F[1];const v=(acc?1:.75)*(F[2]=='square'?.35:.9);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.002);g.gain.exponentialRampToValueAtTime(.0005,t+(s=='wood'||s=='clave'||s=='rim'?.05:.09));
 o.connect(g);g.connect(out);o.start(t);o.stop(t+.12);return o}
function startCI(at){if(typeof PAD!=='undefined'&&PAD.force){start(at);return}const id=cur.id,bars=ciBars(id);if(!(bars>0)){start(at);return}
 ciCancel();ctx.resume();const bpm=realBpm(id)||120,sg=sigOf(id),beats=(sg==6?6:Math.max(1,sg))*bars,sp=(sg==6?30:60)/bpm;
 const pan=ctx.createStereoPanner();pan.pan.value=ciSide(id);const out=ctx.createGain();out.gain.value=db2(mixOf(id).c.v||0);out.connect(pan);pan.connect(ctx.destination);
 const t0=ctx.currentTime+.08,nodes=[];for(let i=0;i<beats;i++){const acc=sg>1?i%(sg==6?6:sg)==0:i==0;nodes.push(ciTone(t0+i*sp,acc,pan,out))}
 window.__ci={beats,sp,pan:pan.pan.value,bpm,count:(window.__ci?.count||0)+1};
 CNT={nodes,to:setTimeout(()=>{CNT=null;ciShow();if(cur&&cur.id==id&&!playing)start(at)},(t0-ctx.currentTime+beats*sp)*1000)};ciShow()}
// ---- waveform zoom / pan ----
const WZ={z:1,v0:0,follow:true};
function wzClamp(){WZ.z=Math.max(1,Math.min(16,WZ.z));WZ.v0=Math.max(0,Math.min(1-1/WZ.z,WZ.v0))}
function wzSet(z,cf){const c=cf??(WZ.v0+.5/WZ.z);const r=(c-WZ.v0)*WZ.z;WZ.z=z;WZ.v0=c-r/WZ.z;wzClamp();wzUI();waveDraw()}
function wzUI(){const l=$('wzl');if(l)l.textContent=(Math.round(WZ.z*10)/10)+'x';const f=$('wzf');if(f)f.classList.toggle('on',WZ.follow)}
const f2x=(f,W)=>(f-WZ.v0)*WZ.z*W,x2f=(x,W)=>WZ.v0+x/W/WZ.z;
drawMarks=function(g,W,H){if(!cur)return;const mk=marks(),d=cur.buf.duration,p=pref(cur.id),r=devicePixelRatio;
 mk.forEach((m,i)=>{const x=f2x(m.t/d,W),[a,b]=secOf(mk,i);if(m.sk||p.lp===i){g.fillStyle=m.sk?'rgba(255,69,58,.18)':'rgba(48,209,88,.16)';const xa=f2x(a/d,W);g.fillRect(xa,0,f2x(b/d,W)-xa,H)}
  if(x<-60*r||x>W)return;g.fillStyle=i==MKSEL?'#ffd60a':'#0a84ff';g.fillRect(x,0,1.5*r,H);g.font=`700 ${10*r}px system-ui`;const tw=g.measureText(m.n).width+8*r;g.fillRect(x,H-14*r,tw,14*r);g.fillStyle='#fff';g.fillText(m.n,x+4*r,H-4*r)})};
waveDraw=function(){const cv=$('wave');if(!cv||!cv.offsetWidth)return;const r=devicePixelRatio,W=cv.width=cv.offsetWidth*r,H=cv.height=cv.offsetHeight*r;const g=cv.getContext('2d');g.clearRect(0,0,W,H);
 g.fillStyle='#0a0c10';g.fillRect(0,0,W,H);g.strokeStyle='rgba(255,255,255,.05)';for(let x=0;x<W;x+=W/16){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke()}
 if(!cur)return;const P=PEAKS.get(cur.id);if(!P)return;const d=cur.buf.duration,ci=clickCh(cur.id),fr=pos()/d;
 if(WZ.follow&&playing&&WZ.z>1&&(fr<WZ.v0||fr>WZ.v0+.85/WZ.z)){WZ.v0=fr-.15/WZ.z;wzClamp()}
 const px=f2x(fr,W),N=P[0].length;
 const lane=(arr,y0,h,col,col2)=>{for(let x=0;x<W;x++){const a=Math.floor(x2f(x,W)*N),b=Math.max(a+1,Math.floor(x2f(x+1,W)*N));let v=0;for(let i=a;i<b&&i<N;i++)if(arr[i]>v)v=arr[i];const hh=Math.max(1,v*h*0.95);g.fillStyle=x<px?col:col2;g.fillRect(x,y0+h/2-hh/2,1,hh)}};
 lane(P[1-ci],0,H*0.62,'#5ac8fa','#24506a');lane(P[ci],H*0.66,H*0.34,'#ff9f0a','#5a3a10');
 g.fillStyle='rgba(255,255,255,.5)';g.font=(10*r)+'px system-ui';g.fillText('เพลง',4*r,12*r);g.fillText('นอม',4*r,H*0.66+12*r);
 // trim shading + handles
 const ts=trS(cur.id),te=trE(cur.id,d),xs=f2x(ts/d,W),xe=f2x(te/d,W);g.fillStyle='rgba(0,0,0,.6)';if(xs>0)g.fillRect(0,0,Math.min(W,xs),H);if(xe<W)g.fillRect(Math.max(0,xe),0,W-Math.max(0,xe),H);
 g.fillStyle='#ff375f';[[xs,1],[xe,-1]].forEach(([x,s])=>{if(x<-20||x>W+20)return;g.fillRect(x-1*r,0,2*r,H);g.fillRect(s>0?x:x-12*r,H/2-14*r,12*r,28*r)});
 drawMarks(g,W,H);if(px>=-2&&px<=W+2){g.fillStyle='#fff';g.fillRect(px-1,0,2*r,H);g.fillStyle='#30d158';g.beginPath();g.moveTo(px-6,0);g.lineTo(px+6,0);g.lineTo(px,8);g.fill()}
 // overview bar when zoomed
 if(WZ.z>1){g.fillStyle='rgba(255,255,255,.15)';g.fillRect(0,H-3*r,W,3*r);g.fillStyle='#ffd60a';g.fillRect(WZ.v0*W,H-3*r,W/WZ.z,3*r)}};
// higher resolution peaks for zoom (compute on load)
const PEAKS2=new Set();
function peaksHi(id,b){if(PEAKS2.has(id))return;const NH=8000,out=[];for(let c=0;c<Math.min(2,b.numberOfChannels);c++){const dd=b.getChannelData(c),n=dd.length,st=Math.max(1,Math.floor(n/NH)),a=new Float32Array(NH);
  for(let i=0;i<NH;i++){let m=0;const e=Math.min(n,(i+1)*st);for(let j=i*st;j<e;j+=3){const v=dd[j]<0?-dd[j]:dd[j];if(v>m)m=v}a[i]=m}out.push(a)}
 if(out.length==1)out.push(out[0]);PEAKS.set(id,out);PEAKS2.add(id)}
function wzPointer(){const cv=$('wave');if(!cv||cv.dataset.wz)return;cv.dataset.wz=1;cv.style.touchAction='none';const pts=new Map();let mode=null,sx=0,sv=0,moved=false,pd=0,pz=1,pc=0,dragH=null;
 const fx=e=>{const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,r}};
 cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);pts.set(e.pointerId,e);if(!cur)return;
  if(pts.size==2){const [a,b]=[...pts.values()];const r=cv.getBoundingClientRect();pd=Math.abs(a.clientX-b.clientX)||1;pz=WZ.z;pc=x2f(((a.clientX+b.clientX)/2-r.left)/r.width,1);mode='pinch';return}
  const {x,r}=fx(e),d=cur.buf.duration,tol=14/r.width;const hs=f2x(trS(cur.id)/d,1),he=f2x(trE(cur.id,d)/d,1);
  dragH=Math.abs(x-hs)<tol?'s':Math.abs(x-he)<tol?'e':null;
  mode=dragH?'trim':WZ.z>1?'pan':'seek';sx=x;sv=WZ.v0;moved=false;if(mode=='seek')seekFrac(Math.min(1,Math.max(0,x2f(x,1))))};
 cv.onpointermove=e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,e);if(!cur||!mode)return;
  if(mode=='pinch'&&pts.size==2){const [a,b]=[...pts.values()];const dd=Math.abs(a.clientX-b.clientX)||1;wzSet(pz*dd/pd,pc);return}
  const {x}=fx(e);if(Math.abs(x-sx)>.01)moved=true;
  if(mode=='seek')seekFrac(Math.min(1,Math.max(0,x2f(x,1))));
  else if(mode=='pan'){WZ.v0=sv-(x-sx)/WZ.z;WZ.follow=false;wzClamp();wzUI();waveDraw()}
  else if(mode=='trim'){const d=cur.buf.duration,t=Math.max(0,Math.min(d,x2f(x,1)*d));trimSet(dragH,t,true)}};
 const up=e=>{pts.delete(e.pointerId);if(mode=='pan'&&!moved){const {x}=fx(e);seekFrac(Math.min(1,Math.max(0,x2f(x,1))))}if(mode=='trim')trimSet(dragH,null);if(pts.size==0)mode=null};
 cv.onpointerup=up;cv.onpointercancel=up;
 cv.addEventListener('wheel',e=>{if(!cur)return;e.preventDefault();if(e.ctrlKey){const r=cv.getBoundingClientRect();wzSet(WZ.z*(e.deltaY<0?1.25:.8),x2f((e.clientX-r.left)/r.width,1))}else if(WZ.z>1){WZ.v0+=(e.deltaX||e.deltaY)/1500/WZ.z*4;WZ.follow=false;wzClamp();wzUI();waveDraw()}},{passive:false})}
function wzBar(){const wb=document.querySelector('#studio .counter');if(!wb||$('wzbar'))return;const b=document.createElement('div');b.id='wzbar';
 b.innerHTML=`<button id="wzo" aria-label="ซูมออก">−</button><span id="wzl">1x</span><button id="wzi" aria-label="ซูมเข้า">+</button><button id="wzf" class="on" title="ตามหัวเล่น">📌</button>`;wb.appendChild(b);
 $('wzi').onclick=()=>{WZ.follow=true;wzSet(WZ.z*2,cur?pos()/cur.buf.duration:undefined)};$('wzo').onclick=()=>wzSet(WZ.z/2,cur?pos()/cur.buf.duration:undefined);$('wzf').onclick=()=>{WZ.follow=!WZ.follow;wzUI();waveDraw()};wzUI()}
// ---- trim ----
async function trimSet(which,t,live){if(!cur)return;const id=cur.id,d=cur.buf.duration;const p={...pref(id)};
 if(t!=null){if(which=='s')p.ts=Math.max(0,Math.min(t,(p.te>0?p.te:d)-1));else p.te=Math.min(d,Math.max(t,(p.ts||0)+1));if(which=='e'&&p.te>=d-0.05)p.te=0;PREF.set(id,p)}
 if(!live){try{lvEdit(id,which=='s'?'ts':'te');lvUser('field')}catch(e){}await put('prefs',pref(id));durUpd();barDur();toast('✂️ '+(which=='s'?'จุดเริ่ม':'จุดจบ')+' '+fmtT(which=='s'?trS(id):trE(id,d)),1800,true)}
 trimUI();waveDraw()}
async function trimReset(){if(!cur)return;const p={...pref(cur.id)};delete p.ts;delete p.te;PREF.set(cur.id,p);try{lvEdit(cur.id,['ts','te']);lvUser('field')}catch(e){}await put('prefs',p);durUpd();barDur();trimUI();waveDraw();toast('↺ ไม่ตัดหัว/ท้าย',1500,true)}
const fmtT=t=>{t=Math.max(0,t||0);return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')+'.'+Math.floor(t*10%10)};
function trimUI(){const el=$('trimc');if(!el)return;if(!cur){$('trv').textContent='—';return}const d=cur.buf.duration;$('trv').textContent=fmtT(trS(cur.id))+' → '+fmtT(trE(cur.id,d))+'  ('+fmtT(trE(cur.id,d)-trS(cur.id))+')'}
// ---- sync bpm ----
async function syncBpm(){if(!cur)return;if(!LASTBPM){toast('⚠️ ยังไม่มีเพลงก่อนหน้า');return}const b=baseBpm(cur.id);if(!b){toast('⚠️ เพลงนี้ยังไม่รู้ BPM — แตะตามจังหวะก่อน');return}
 const t=Math.max(50,Math.min(150,Math.round(LASTBPM.b/b*1000)/10));tempoLive(t);await put('prefs',pref(cur.id));tempoUI();syncUI();toast('🔗 '+(Math.round(b*t)/100)+' BPM = เพลงก่อน',2000,true)}
function syncUI(){const b=$('bsync');if(!b)return;b.textContent='🔗 BPM เท่าเพลงก่อน'+(LASTBPM?' ('+Math.round(LASTBPM.b*10)/10+')':'');b.disabled=!LASTBPM}
// ---- cards (trim / count-in / preview) ----
function cards26(){const g=document.querySelector('#plx>.grid');if(!g)return;
 if(!$('trimc')){const c=document.createElement('div');c.className='card c26';c.id='trimc';
  c.innerHTML=`<div class="lb">✂️ ตัดหัว/ท้ายเพลง <span class="small" id="trv">—</span></div><div class="brow"><button class="hw" id="trs1">[ เริ่มตรงนี้</button><button class="hw" id="tre1">จบตรงนี้ ]</button><button class="hw" id="trr">↺</button><button class="hw" data-meta="cur">✏️ แก้ข้อมูลเพลง</button></div><div class="small">ลากขีดแดงบนเวฟเพื่อปรับ</div>`;g.appendChild(c);
  $('trs1').onclick=()=>cur&&trimSet('s',pos());$('tre1').onclick=()=>cur&&trimSet('e',pos());$('trr').onclick=trimReset}
 if(!$('cic')){const c=document.createElement('div');c.className='card c26';c.id='cic';
  c.innerHTML=`<div class="lb">🥁 นับเข้าก่อนเพลง <span class="small" id="cist"></span></div><div class="brow"><span class="small">เพลงนี้</span><select id="cis"><option value="">ตามค่าหลัก</option><option value="0">ไม่นับ</option><option value="1">1 ห้อง</option><option value="2">2 ห้อง</option></select></div>
  <div class="brow"><span class="small">ค่าหลัก</span><select id="cig"><option value="0">ไม่นับ</option><option value="1">1 ห้อง</option><option value="2">2 ห้อง</option></select><select id="cisnd">${[['beep','บี๊บ'],['wood','เคาะไม้'],['clave','คลาฟ'],['rim','ริมช็อต'],['cow','คาวเบลล์'],['digi','ดิจิทัล']].map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></div>`;g.appendChild(c);
  $('cis').onchange=async e=>{if(!cur)return;const v=e.target.value;const p={...pref(cur.id)};if(v==='')delete p.ci;else p.ci=+v;PREF.set(cur.id,p);await put('prefs',p)};
  const sv=()=>localStorage.setItem('bp-ci',JSON.stringify(CI));$('cig').onchange=e=>{CI.bars=+e.target.value;sv()};$('cisnd').onchange=e=>{CI.snd=e.target.value;sv()}}
 if(!$('pvc')){const c=document.createElement('div');c.className='card c26';c.id='pvc';
  c.innerHTML=`<div class="lb">🎧 พรีวิว (ฟังเพลงอื่นแยก ขณะเพลงหลักเล่น)</div><div class="brow"><select id="pvs" style="max-width:100%;flex:1"></select></div>
  <div class="brow"><button class="hw" id="pvp">▶ พรีวิว</button><input type="range" id="pvk" min="0" max="1000" value="0" style="flex:1"></div>
  <div class="brow"><span class="small">ดัง</span><input type="range" id="pvv" min="0" max="100" value="70" style="flex:1"><select id="pvo"><option value="L">หูซ้าย</option><option value="R">หูขวา</option><option value="C">ทั้งสองหู</option></select></div>
  <div class="small" id="pvn"></div>`;g.appendChild(c);pvInit()}
 trimUI();ciUI()} // v1.0.41: Studio "🔗 BPM เท่าเพลงก่อน" removed — deck SYNC covers it
function ciUI(){if(!$('cis'))return;$('cig').value=CI.bars;$('cisnd').value=CI.snd;$('cis').value=cur&&pref(cur.id).ci!=null?pref(cur.id).ci:''}
// ---- preview player ----
const PV={el:null,id:null,node:null,g:null,pan:null,url:null,out:localStorage.getItem('bp-pvo')||'L',vol:.7};
const sinkOK=()=>typeof HTMLMediaElement!='undefined'&&'setSinkId' in HTMLMediaElement.prototype;
async function pvDevices(){if(!sinkOK()||!navigator.mediaDevices?.enumerateDevices)return;try{const ds=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind=='audiooutput'&&d.deviceId&&d.deviceId!='default');const o=$('pvo');
  o.querySelectorAll('[data-dev]').forEach(x=>x.remove());ds.forEach((d,i)=>{const op=document.createElement('option');op.value='dev:'+d.deviceId;op.dataset.dev=1;op.textContent='🔈 '+(d.label||('อุปกรณ์ '+(i+1)));o.appendChild(op)});o.value=PV.out;if(o.value!=PV.out)o.value='L'}catch(e){}}
function pvList(){const s=$('pvs');if(!s)return;const nx=cur?SET[SET.indexOf(cur.id)+1]:null;const ids=[...new Set([...(nx?[nx]:[]),...SET,...[...SONG.keys()].filter(i=>fileOf(SONG.get(i)))])].filter(i=>SONG.get(i)&&(fileOf(SONG.get(i))||SONG.get(i).id)).slice(0,400);
 const k=ids.join('|');if(s.dataset.k==k)return;s.dataset.k=k;const v=PV.id||s.value;s.innerHTML=ids.map(i=>{const x=SONG.get(i);return`<option value="${esc(i)}" data-noi18n>${i==nx?'⏭ ':''}${esc(x.t)}${x.a?' – '+esc(x.a):''}</option>`}).join('');if(v&&ids.includes(v))s.value=v}
function pvNote(){const n=$('pvn');if(!n)return;n.textContent=sinkOK()?'เลือกหูซ้าย/ขวา หรือเลือกอุปกรณ์เสียงแยก (หูฟังอีกตัว) ได้':'เครื่องนี้ (iPhone/iPad/Safari) ส่งพรีวิวไปอุปกรณ์แยกไม่ได้ — ใช้หูซ้าย/ขวาแทน (เสียงออกหูฟังเดียวกับเพลงหลัก)'}
function pvInit(){pvList();pvNote();pvDevices();$('pvo').value=PV.out;if($('pvo').value!=PV.out)$('pvo').value='L';
 $('pvp').onclick=()=>PV.el&&!PV.el.paused?pvStop():pvPlay($('pvs').value);
 $('pvv').oninput=e=>{PV.vol=e.target.value/100;pvVol()};
 $('pvo').onchange=async e=>{PV.out=e.target.value;localStorage.setItem('bp-pvo',PV.out);if(PV.el){const t=PV.el.currentTime,pl=!PV.el.paused;await pvPlay(PV.id,t,pl)}};
 $('pvk').oninput=e=>{if(PV.el&&PV.el.duration)PV.el.currentTime=e.target.value/1000*PV.el.duration};
 $('pvs').onchange=()=>{if(PV.el&&!PV.el.paused)pvPlay($('pvs').value)};
 setInterval(()=>{if(PV.el&&PV.el.duration&&!$('pvk').matches(':active'))$('pvk').value=PV.el.currentTime/PV.el.duration*1000;const b=$('pvp'),bt=PV.el&&!PV.el.paused?'⏹ หยุดพรีวิว':'▶ พรีวิว';if(b&&b.textContent!==bt)b.textContent=bt;pvList()},400)}
function pvVol(){if(!PV.el)return;if(PV.g)PV.g.gain.value=PV.vol;else PV.el.volume=Math.min(1,PV.vol)}
function pvKill(){if(PV.el){try{PV.el.pause()}catch(e){}if(PV.node)try{PV.node.disconnect()}catch(e){}PV.el.removeAttribute('src');try{PV.el.load()}catch(e){}}if(PV.url)URL.revokeObjectURL(PV.url);Object.assign(PV,{el:null,node:null,g:null,pan:null,url:null})}
function pvStop(){pvKill();PV.id=null}
async function pvPlay(id,t=0,autoplay=true){if(!id)return;initAudio();ctx.resume();const s=SONG.get(id);if(!s)return;
 try{const fn=fileOf(s);const rec=fn&&await get('files',fn);const blob=rec?rec.blob:await fetchAudio(s);pvKill();PV.id=id;PV.url=URL.createObjectURL(blob);
  const el=new Audio();el.preload='auto';el.src=PV.url;PV.el=el;el.onended=()=>{};
  if(PV.out.startsWith('dev:')){await el.setSinkId(PV.out.slice(4));el.volume=Math.min(1,PV.vol)}
  else{PV.node=ctx.createMediaElementSource(el);PV.g=ctx.createGain();PV.g.gain.value=PV.vol;PV.pan=ctx.createStereoPanner();PV.pan.pan.value=PV.out=='L'?-1:PV.out=='R'?1:0;PV.node.connect(PV.g);PV.g.connect(PV.pan);PV.pan.connect(ctx.destination)}
  if(t)el.addEventListener('loadedmetadata',()=>{el.currentTime=t},{once:true});if(autoplay)await el.play()}
 catch(e){blog('warn','preview',e.message);toast('❌ พรีวิวไม่ได้: '+e.message)}}
window.__pv=PV;
// ---- filename parser + metadata ----
const CATS=['ช้า','มีเดียม','เร็ว','สากล','ของเก่า','ต้องฟังเช็ก'];
function parseName(fn){let b=fn.replace(/\.[^.]+$/,'').replace(/_/g,' ');const r={};let m;
 if(m=b.match(/(\d{2,3}(?:\.\d+)?)\s*bpm\b/i)||b.match(/\bbpm\s*[:=]?\s*(\d{2,3}(?:\.\d+)?)/i)||b.match(/\[(\d{2,3})\]/)){r.b=+m[1];b=b.replace(m[0],' ')}
 if(m=b.match(/(?:นอม|คลิก|click)\s*(ซ้าย|ขวา|L|R)(?![A-Za-z])/i)||b.match(/\((L|R)\)/)){r.s=/ซ้าย|l/i.test(m[1])?'L':'R';b=b.replace(m[0],' ')}
 if(m=b.match(/\bkey\s*[:=]?\s*([A-G](?:#|b|♯|♭)?m?)(?![a-z])/i)){r.k=m[1];b=b.replace(m[0],' ')}
 let toks=b.split(/\s+[-–|]\s+|\s*[-–|]{2,}\s*|\s+-|-\s+/).map(x=>x.trim()).filter(Boolean);
 toks=toks.filter(t=>{if(!r.k&&/^[A-G](#|b|♯|♭)?m?$/.test(t)){r.k=t;return false}if(!r.s&&/^(L|R|ซ้าย|ขวา)$/i.test(t)){r.s=/ซ้าย|l/i.test(t)?'L':'R';return false}
  const c=CATS.find(c=>t==c);if(c){r.f=c;return false}if(/^(data|click|multitrack|mix|final|stem|stems|master|\d{1,2})$/i.test(t))return false;return true});
 if(toks[0])r.t=toks[0];if(toks[1])r.a=toks[1];return r}
window.__parse=parseName;
function applyMeta(){for(const [id,s] of SONG){if(s.X&&!s._pp){s._pp=1;const p=parseName(s.fn);s._pb=p.b||null;Object.assign(s,p)}const m=META[id];if(m){for(const k of ['t','a','f','b','k'])if(m[k]!=null&&m[k]!=='')s[k]=k=='b'?+m[k]:m[k];if(m.s&&(s.X||(m.so&&(m.s=='L'||m.s=='R')))){if(!s.X){if(s._s0==null)s._s0=s.s;s._id=id}s.s=m.s}if(m.b)s._pb=+m.b}}}
{const _rb=rebuildIndex;rebuildIndex=function(){_rb();applyMeta()}}
// v1.0.41: the Pad panel's own key (pref.pk, this device only) is gone — song info is the only key. An old pk moves into
// song info only when the song has no key there; otherwise it is dropped.
function pkMig41(){let mch=false;for(const [id,p] of PREF){if(!p||!p.pk)continue;const s=SONG.get(id);if(!s)continue;
  if(!keyParse(s.k)&&keyParse(p.pk)){META[id]={...(META[id]||{}),k:normKey40(p.pk)};mch=true}
  const q={...p};delete q.pk;PREF.set(id,q);put('prefs',q).catch(()=>{});blog('info','pk migrated '+id+' '+p.pk+(mch?' → song info':' (dropped)'))}
 if(mch){put('kv',{k:'meta',v:META}).catch(()=>{});applyMeta();try{render()}catch(e){}}}
{const _rb=rebuildIndex;rebuildIndex=function(){_rb();try{pkMig41()}catch(e){}}}
{const _bb=baseBpm;baseBpm=function(id){const p=pref(id);if(p.bpm)return p.bpm;const s=SONG.get(id);if(s&&s._pb)return s._pb;return _bb(id)}}
{const _bs=bpmSrc;bpmSrc=function(id){const p=pref(id),s=SONG.get(id);if(!p.bpm&&s&&s._pb)return'list';return _bs(id)}}
let METAQ=[];
// v1.0.40: a plain key typed in any case/♯♭/min form is saved in one clean spelling ("f#min" → "F#m"); anything else is kept as typed
function normKey40(v){v=String(v||'').trim();const m=v.replace(/♯/g,'#').replace(/♭/g,'b').match(/^([A-Ga-g])([#b]?)\s*(m|min|minor|ไมเนอร์|maj|major|เมเจอร์)?$/);if(!m)return v;return m[1].toUpperCase()+(m[2]||'')+(m[3]&&!/^(maj|major|เมเจอร์)$/.test(m[3])?'m':'')}
function openMeta(ids){METAQ=[...ids];metaShow()}
function metaShow(){let el=$('metam');const id=METAQ[0];if(!id){if(el)el.remove();return}const s=SONG.get(id);if(!s){METAQ.shift();return metaShow()}
 if(!el){el=document.createElement('div');el.id='metam';document.body.appendChild(el)}
 el.innerHTML=`<div class="mbox"><div class="row" style="justify-content:space-between"><b>✏️ ข้อมูลเพลง${METAQ.length>1?' ('+METAQ.length+')':''}</b><button id="mtx">✕</button></div>
 <div class="small" data-noi18n>${esc(s.fn||'')}</div>
 ${(()=>{let nb=0;try{nb=bsFind842(id).length}catch(_){}return nb?'<div class="small" id="mtsc" data-sc="band" style="color:#2e9e5b">☁︎ เพลงของวง — แก้ชื่อ/ศิลปิน/คีย์/นอม แล้วทุกคนในวงและทุกเครื่องเห็นด้วย</div>':can845()?'<div id="mtsc" data-sc="cta"><button type="button" id="mt845" class="hw okb" style="width:100%">☁︎ ส่งเข้าวงแล้วบันทึก</button><div class="small">ทุกคนในวงและทุกเครื่องของคุณจะเห็นชื่อใหม่</div></div>':'<div class="small" id="mtsc" data-sc="dev" style="color:#d9822b">📱 แก้เฉพาะเครื่องนี้ — มือถือ/เครื่องอื่นและสมาชิกวงจะไม่เห็น (อยากให้ทุกเครื่องเห็น: ส่งเพลงนี้เข้าวงก่อน แล้วค่อยแก้)</div>'})()}
 <label>ชื่อเพลง<input id="mtt" data-noi18n value="${esc(s.t||'')}"></label><label>ศิลปิน<input id="mta" data-noi18n value="${esc(s.a||'')}"></label>
 <div class="row"><label>นอม<select id="mts"><option value="X">ไม่ทราบ</option><option value="L">นอมซ้าย</option><option value="R">นอมขวา</option></select></label>
 <label>หมวด<select id="mtf"><option value="">—</option>${CATS.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></label></div>
 <div class="row"><label>BPM<input id="mtb" type="number" inputmode="decimal" min="30" max="300" value="${s.b||''}"></label><label>คีย์<input id="mtk" data-noi18n value="${esc(s.k||'')}" placeholder="เช่น E, F#m, Bb" autocapitalize="characters"></label></div>
 <div class="row mtk40"><label>โน้ตคีย์<select id="mtkr" data-noi18n><option value="">ไม่ระบุ</option>${['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label><label>เมเจอร์/ไมเนอร์<select id="mtkq"><option value="">เมเจอร์ (Major)</option><option value="m">ไมเนอร์ (Minor)</option></select></label></div>
 <div class="small" id="mtkp" data-noi18n></div>
 <div class="small">ว่าง BPM = ตรวจจากนอมอัตโนมัติ</div>
 <div class="row" style="justify-content:flex-end"><button id="mtsk" class="hw">ข้าม</button><button id="mtok" class="hw okb">💾 บันทึก</button></div></div>`;
 $('mts').value=s.s=='L'||s.s=='R'?s.s:'X';$('mtf').value=CATS.includes(s.f)?s.f:'';
 $('mtx').onclick=()=>{METAQ=[];metaShow()};{const g=$('mt845');if(g){const o=$('mtok');o.textContent='บันทึกเฉพาะเครื่องนี้';o.classList.remove('okb');g.onclick=()=>{window.__b845=id;o.click()}}}$('mtsk').onclick=()=>{METAQ.shift();metaShow()};
 // v1.0.40: key picker (note + major/minor) ⇄ the key box; shows exactly how the key will read everywhere
 {const kr=$('mtkr'),kq=$('mtkq'),kt=$('mtk'),kp=$('mtkp');const fromTxt=()=>{const k=keyParse(kt.value);if(k){const m=kt.value.trim().replace(/♯/g,'#').replace(/♭/g,'b').match(/^([A-Ga-g])([#b]?)/);kr.value=m[1].toUpperCase()+(m[2]||'');kq.value=k.m?'m':''}else if(!kt.value.trim()){kr.value='';kq.value=''}prev()};
  const prev=()=>{const v=kt.value.trim();if(!v){kp.textContent='ไม่ระบุคีย์ — ใช้คีย์ที่ตรวจอัตโนมัติ (ถ้ามี)';kp.style.color='';return}const k=keyParse(v);if(!k){kp.textContent='⚠️ อ่านคีย์ “'+v+'” ไม่ได้ — ใช้ตัวโน้ต A–G ตามด้วย # หรือ b และ m ถ้าเป็นไมเนอร์ (เช่น F#m)';kp.style.color='#ff9f0a';return}
   const sh=(pref(id).key||0);kp.style.color='';kp.textContent='คีย์เพลง: '+keyName(k)+(k.m?' (ไมเนอร์)':' (เมเจอร์)')+(sh?' · ตอนนี้ปรับ '+(sh>0?'+':'')+sh+' → เล่นที่ '+keyName({r:k.r+sh,m:k.m,sp:k.sp}):'')};
  const fromSel=()=>{kt.value=kr.value?kr.value+(kq.value||''):'';prev()};
  kr.onchange=fromSel;kq.onchange=()=>{if(kr.value)fromSel()};kt.oninput=fromTxt;fromTxt()}
 $('mtok').onclick=async()=>{const m={t:$('mtt').value.trim(),a:$('mta').value.trim(),f:$('mtf').value,b:$('mtb').value?+$('mtb').value:'',k:normKey40($('mtk').value)};const s0=s.s,sv=$('mts').value;if(s.X||sv!='X')m.s=sv;if(sv!==(s0=='L'||s0=='R'?s0:'X'))m.so=1;else if(META[id]&&META[id].so)m.so=1;
  // v1.0.40: the key saved here is THE song key — an older Pad-panel key (pk, this device only) used to win over it, so the saved key "did not show"
  try{if(m.k&&pref(id).pk&&keyParse(m.k))await setPrefFor(id,{pk:null})}catch(e){}
  META[id]=m;if(!m.b){s._pb=null;if(s.X)s.b=null}if(!m.f&&s.X)s.f='ไม่อยู่ในรายชื่อ';if(s.X&&m.s=='X')s.s='X';if(!s.X&&!m.s&&s._s0)s.s=s._s0;await put('kv',{k:'meta',v:META});applyMeta();render();if(s.s!==s0)side838(id,s,s0);meta842(id,s);try{beatUI();tempoUI()}catch(e){}{let nb=0;try{nb=bsFind842(id).length}catch(_){}const go=window.__b845===id;window.__b845=null;window.__ren844={id,scope:nb?'band':go?'send':'dev'};if(go&&!nb)go845(id);else toast(nb?'✅ บันทึกแล้ว · ส่งให้ทั้งวง':'📱 บันทึกเฉพาะเครื่องนี้ (ไม่ซิงก์ไปเครื่องอื่น/วง)',nb?1500:3500,true)}METAQ.shift();metaShow()}}
window.__meta={open:openMeta,get:()=>META};
{const _imp=importFiles;importFiles=async function(fs){const before=new Set(FILES.keys());const r=await _imp(fs);const xs=[...FILES.keys()].filter(n=>!before.has(n)&&!n.startsWith('web:')).map(n=>'X:'+n).filter(i=>SONG.has(i));if(xs.length)openMeta(xs);return r}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-meta],[data-pvid]');if(!b)return;if(b.dataset.meta)openMeta([b.dataset.meta=='cur'?cur&&cur.id:b.dataset.meta].filter(Boolean));else{const id=b.dataset.pvid;cards26();PV.id=id;pvList();$('pvs').value=id;pvPlay(id)}});
function metaBtn(){const sb=document.querySelector('#studio .stbar .row');if(sb&&!$('mtbtn')){const b=document.createElement('button');b.id='mtbtn';b.className='hw';b.dataset.meta='cur';b.textContent='✏️';b.setAttribute('aria-label','แก้ข้อมูลเพลง');sb.insertBefore(b,sb.firstChild)}}
// ---- cue panel extras ----
{const _dc=drawCue;drawCue=function(){_dc();const el=$('cue');if(!cue||!el||el.style.display=='none')return;const t=el.children[1];if(t)t.classList.add('cuet');if(!el.querySelector('[data-pvid]')){const r=document.createElement('div');r.className='row';r.style.marginTop='6px';r.innerHTML=`<button class="hw" data-pvid="${esc(cue)}">🎧 พรีวิว</button><button class="hw" data-meta="${esc(cue)}">✏️ แก้ข้อมูล</button>`;el.appendChild(r)}}}
// ---- i18n ----
let LANG=localStorage.getItem('bp-lang')||'th';
let I18K=null;
function T(s){if(LANG!='en'||!s||!/[\u0E00-\u0E7F]/.test(s))return s;const D=window.I18N||{};if(!I18K)I18K=Object.keys(D).sort((a,b)=>b.length-a.length);if(D[s.trim()])return s.replace(s.trim(),D[s.trim()]);let o=s;for(const k of I18K){if(o.includes(k))o=o.split(k).join(D[k]);if(!/[\u0E00-\u0E7F]/.test(o))break}return o}
const NOI='.t,.a,#pt,#pa,.sct,.sca,.lvt,.sqh b,.cuet,[data-noi18n],script,style,textarea,#rpt';
function trNode(n){if(n.nodeType==3){const p=n.parentElement;if(!p||p.closest(NOI))return;const v=n.nodeValue,t=T(v);if(t!==v)n.nodeValue=t;return}
 if(n.nodeType!=1||n.closest(NOI))return;for(const a of ['placeholder','aria-label','title']){const v=n.getAttribute(a);if(v){const t=T(v);if(t!==v)n.setAttribute(a,t)}}
 const w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let x;while(x=w.nextNode()){if(x.nodeType==3)trNode(x);else{for(const a of ['placeholder','aria-label','title']){const v=x.getAttribute(a);if(v&&/[\u0E00-\u0E7F]/.test(v)&&!x.closest(NOI)){const t=T(v);if(t!==v)x.setAttribute(a,t)}}}}}
function i18nStart(){if(LANG!='en')return;document.documentElement.lang='en';trNode(document.body);document.title=T(document.title);
 new MutationObserver(ms=>{for(const m of ms){if(m.type=='characterData')trNode(m.target);else if(m.type=='attributes')trNode(m.target);else m.addedNodes.forEach(trNode)}}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
 const _c=window.confirm.bind(window),_p=window.prompt.bind(window),_a=window.alert.bind(window);window.confirm=m=>_c(T(m));window.prompt=(m,d)=>_p(T(m),d);window.alert=m=>_a(T(m))}
function setLang(l){localStorage.setItem('bp-lang',l);bpReload('language '+l)}
window.__i18n={T,get lang(){return LANG},setLang};
function langBtn(){const m=$('main');if(!m||view!='F'||$('langb'))return;const sec=document.createElement('div');sec.className='sec';sec.id='langb';
 sec.innerHTML=`<h2>🌐 ภาษา / Language</h2><div class="row"><button class="hw ${LANG=='th'?'okb':''}" data-lang="th">ไทย</button><button class="hw ${LANG=='en'?'okb':''}" data-lang="en">English</button></div>`;m.insertBefore(sec,m.firstChild)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-lang]');if(b&&b.dataset.lang!=LANG)setLang(b.dataset.lang)});
// ---- glue ----
{const _sl=studioLoad;studioLoad=function(){try{peaksHi(cur.id,cur.buf)}catch(e){}WZ.z=1;WZ.v0=0;WZ.follow=true;_sl();try{wzBar();wzPointer();cards26();durUpd();ciUI();trimUI();syncUI();wzUI()}catch(e){blog('warn','v26',e.message)}}}
new MutationObserver(()=>{try{if($('studio')){wzBar();wzPointer()}if(document.querySelector('#plx>.grid')&&!$('trimc'))cards26();langBtn()}catch(e){}}).observe(document.body,{childList:true,subtree:true});
setTimeout(()=>{try{wzBar();wzPointer();cards26();langBtn()}catch(e){}i18nStart()},0);
// v1.0.42: the Studio header (#pt) follows the song that is really loaded — songs handed over from the decks set cur
// without going through load(), so the header kept saying "ยังไม่ได้เลือกเพลง"
function ptSync(){try{const el=$('pt');if(!el||loadingId)return;const s=cur&&SONG.get(cur.id);const t=s?(s.t||'')+(s.a?' – '+s.a:''):'ยังไม่ได้เลือกเพลง';if(el.textContent!==t){el.textContent=t;try{$('psd').innerHTML=cur?badge(s,pref(cur.id)):''}catch(e){}}}catch(e){}}
{const _sy=sync;sync=function(){const r=_sy.apply(this,arguments);ptSync();return r}}
setInterval(ptSync,700);
{const _ld=load;load=function(id){try{for(const k of [...SP41.keys()])if(k!==id)stuRevert(k,true)}catch(e){}return _ld.apply(this,arguments)}}
{const B=window.__bp;if(B){Object.assign(B,{pkMig:()=>pkMig41(),stuSave,stuRevertAll,stp:()=>Object.fromEntries(SP41),fetchAudio,storeBlob,acStore,files:()=>[...FILES.values()].map(f=>({name:f.name,size:f.size,src:f.src,auto:f.auto||0})),trim:()=>cur?{ts:trS(cur.id),te:trE(cur.id,cur.buf.duration),d:cur.buf.duration}:null,WZ,CI,realBpm,trimSet,trimReset,syncBpm,effEnd,pos:()=>pos()});Object.defineProperties(B,{counting:{get:()=>!!CNT,configurable:true},lastBpm:{get:()=>LASTBPM,configurable:true}})}}
// ===== v27: play-while-playing chooser + visible next panel =====
function nextId(){return cur?SET[SET.indexOf(cur.id)+1]||null:null}
function chooser(id){const s=SONG.get(id);if(!s)return;let el=$('chs');if(!el){el=document.createElement('div');el.id='chs';document.body.appendChild(el)}
 el.innerHTML=`<div class="cbox" role="dialog" aria-modal="true"><div class="small">กำลังเล่นเพลงอื่นอยู่ — จะทำอะไรกับเพลงนี้?</div><div class="cht" data-noi18n>${esc(s.t)}${s.a?' – '+esc(s.a):''}</div>
 <button class="cbig cnow" data-ch="now">▶ เล่นทันที <span class="small">(เฟดเพลงเดิมออกเร็ว ๆ)</span></button>
 <button class="cbig cnx" data-ch="next">⏭ ตั้งเป็นเพลงถัดไป</button>
 <button class="cbig cpv" data-ch="pv">🎧 พรีวิว</button>
 <button class="cbig ccx" data-ch="x">ยกเลิก</button></div>`;
 el.style.display='flex';el.onclick=e=>{if(e.target==el){chClose();return}const b=e.target.closest('[data-ch]');if(b)chAct(b.dataset.ch,id)}}
function chClose(){const el=$('chs');if(el)el.style.display='none'}
window.__chooser=chooser;
async function chAct(a,id){chClose();if(a=='x')return;
 if(a=='now'){try{if(MX.fade&&playing){MX.fade.gain.cancelScheduledValues(ctx.currentTime);MX.fade.gain.setTargetAtTime(0,ctx.currentTime,0.12)}}catch(e){}
  setTimeout(()=>{load(id);try{if(MX.fade){MX.fade.gain.cancelScheduledValues(ctx.currentTime);MX.fade.gain.setValueAtTime(1,ctx.currentTime)}}catch(e){}},500);return}
 if(a=='next'){cue=id;await cueAct('nx');cue=id;drawCue();toast('⏭ ตั้งเป็นเพลงถัดไปแล้ว: '+SONG.get(id).t,3500,true);const t=$('toast');if(t)t.classList.add('big');setTimeout(()=>t&&t.classList.remove('big'),3600);
  CUEMIN=false;cueFlash();markNext();return}
 if(a=='pv'){cards26();PV.id=id;pvList();if($('pvs'))$('pvs').value=id;await pvPlay(id);toast('🎧 กำลังพรีวิว: '+SONG.get(id).t,2500,true)}}
let CUEMIN=false;
function cueFlash(){const el=$('cue');if(!el)return;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')}
{const _dc2=drawCue;drawCue=function(){_dc2();const el=$('cue');if(!el||!cue||el.style.display=='none')return;el.classList.toggle('cmin',CUEMIN);
  if(!el.querySelector('#cuemin')){const x=el.querySelector('[data-cq="x"]');if(x){const b=document.createElement('button');b.id='cuemin';b.type='button';b.textContent=CUEMIN?'▾':'▴';b.setAttribute('aria-label','ย่อ/ขยาย');x.parentNode.insertBefore(b,x)}}
  const nx=nextId()==cue;el.classList.toggle('isnx',nx);const h=el.querySelector('.small');if(h&&nx&&!el.querySelector('.nxb'))h.insertAdjacentHTML('afterbegin','<span class="nxb">NEXT</span> ')}}
document.addEventListener('click',e=>{if(e.target.id=='cuemin'){CUEMIN=!CUEMIN;drawCue()}});
function markNext(){const nx=nextId();document.querySelectorAll('li.isnext').forEach(li=>{if(!nx||li.querySelector('[data-play]')?.dataset.play!==nx){li.classList.remove('isnext');li.querySelectorAll('.nxb.nxr').forEach(x=>x.remove())}});
 if(!nx)return;document.querySelectorAll('[data-play]').forEach(b=>{if(b.dataset.play!==nx)return;const li=b.closest('li');if(!li||li.classList.contains('isnext'))return;li.classList.add('isnext');if(!li.querySelector('.nxb.nxr')){const t=li.querySelector('.t')||li.querySelector('.i')||b;t.insertAdjacentHTML(t==b?'afterend':'beforebegin','<span class="nxb nxr">NEXT</span>')}})}
let mnQ=0;new MutationObserver(()=>{if(mnQ)return;mnQ=requestAnimationFrame(()=>{mnQ=0;try{markNext()}catch(e){}})}).observe(document.getElementById('main')||document.body,{childList:true,subtree:true});
window.__next=()=>nextId();
setInterval(()=>{try{markNext()}catch(e){}},700);
// v28: export log via share sheet (iPhone -> LINE/Files) when available
async function shareLog(){try{const rep={v:APPV,at:new Date().toISOString(),ua:navigator.userAgent,scr:innerWidth+'x'+innerHeight,set:SET.length,cur:cur&&cur.id,log:JSON.parse(localStorage.getItem(LOGK)||'[]')};const f=new File([JSON.stringify(rep,null,1)],'beer-player-log-'+Date.now()+'.json',{type:'application/json'});
 if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'SetSod log'});toast('✅ ส่งแล้ว',2000,true);return true}}catch(e){if(e&&e.name=='AbortError')return true}return false}
// ===== v29 theme picker =====
const THEMES=[['stage','🎤 เวที'],['studio','🎛 สตูดิโอ'],['easy','👓 ใช้งานง่าย'],['analog','📻 อนาล็อกยุคเก่า']];
function themeGet(){const t=localStorage.getItem('bp-theme');return THEMES.some(x=>x[0]==t)?t:'stage'}
function themeSet(t){if(!THEMES.some(x=>x[0]==t))t='stage';localStorage.setItem('bp-theme',t);const h=document.documentElement;THEMES.forEach(([k])=>h.classList.toggle('th-'+k,k==t&&k!='studio'));
 document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('okb',b.dataset.theme==t));requestAnimationFrame(()=>{try{waveDraw()}catch(e){}})}
window.__theme={get:themeGet,set:themeSet};
function themeSec(){const m=$('main');if(!m||view!='F'||$('thsec'))return;const sec=document.createElement('div');sec.className='sec';sec.id='thsec';
 sec.innerHTML=`<h2>🎨 ธีม / Theme</h2><div class="row">${THEMES.map(([k,l])=>`<button class="hw ${themeGet()==k?'okb':''}" data-theme="${k}">${l}</button>`).join('')}</div>`;const lb=$('langb');lb?lb.after(sec):m.insertBefore(sec,m.firstChild)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-theme]');if(b){themeSet(b.dataset.theme);toast('🎨 '+THEMES.find(x=>x[0]==b.dataset.theme)[1],1500,true)}
 const q=e.target.closest('#thq');if(q){const i=THEMES.findIndex(x=>x[0]==themeGet());const n=THEMES[(i+1)%THEMES.length];themeSet(n[0]);toast('🎨 '+n[1],1500,true)}});
function themeQuick(){const h=$('help');if(!h||$('thq'))return;const x=$('hpx');if(!x)return;const b=document.createElement('button');b.id='thq';b.className='hw';b.textContent='🎨';b.setAttribute('aria-label','เปลี่ยนธีม');x.parentNode.insertBefore(b,x)}
{const _ms=meterSet;meterSet=function(el,ps){_ms(el,ps);if(!document.documentElement.classList.contains('th-analog')||!el.classList.contains('mst'))return;let n=el.querySelector('.vuneedle');
 if(!n){n=document.createElement('div');n.className='vuneedle';n.innerHTML='<i></i>';(el.querySelector('.ms')||el).appendChild(n)}const p=Math.max(...ps,0),db=p>0?20*Math.log10(p):-60;const a=-45+90*Math.max(0,Math.min(1,(db+30)/30));n.firstChild.style.transform=`rotate(${a}deg)`}}
new MutationObserver(()=>{try{themeSec();themeQuick()}catch(e){}}).observe(document.body,{childList:true,subtree:true});themeSet(themeGet());
// ===== v30: share setlist link/QR, onboarding, L/R balance =====
// ---- L/R balance (music channels only; click/นอม channel never touched) ----
const hasClick=id=>{const s=SONG.get(id);return !!s&&(s.s=='L'||s.s=='R')};
// v1.0.38: where the click (นอม) is: source side -> output side. 'L→R' when it moves, 'L' / 'R' when it stays, '' = no click.
function ckSide(id){try{if(!id||!hasClick(id))return'';const s=SONG.get(id),ch=clickCh(id),st=stripOf(id,ch);let o=(st&&st.o)||outDef(ch,!!(pref(id)||{}).swap);if(o!=='L'&&o!=='R')o='C';return s.s===o?o:s.s+'→'+o}catch(e){return''}}
function ckBadge(el,id){if(!el)return;const v=ckSide(id);if(el.textContent!==v)el.textContent=v;el.hidden=!v;el.title=v?('นอม '+v):'';el.setAttribute('aria-label',v?('นอม '+v):'')}
let MBAL=+(localStorage.getItem('bp-mbal')||0);
function balOf(id){return Math.max(-1,Math.min(1,(id?+(pref(id).bal||0):0)+MBAL))}
function balMul(id,ch){if(id&&hasClick(id)&&ch==clickCh(id))return 1;const b=balOf(id);return ch==0?(b>0?1-b:1):(b<0?1+b:1)}
{const _am=applyMix;applyMix=function(){_am();if(!ctx||!MX.m)return;const id=cur&&cur.id;const m=id?mixOf(id):DEFMIX();const solo=m.c.s||m.u.s;const t=ctx.currentTime;
 for(let ch=0;ch<2;ch++){const st=id?stripOf(id,ch):m.u;const g=(st.m||(solo&&!st.s))?0:db2(st.v);MX.f[ch].gain.setTargetAtTime(g*balMul(id,ch),t,0.015)}}}
const balTxt=b=>Math.abs(b)<0.005?'C':(b<0?'L ':'R ')+Math.round(Math.abs(b)*100);
async function balSet(v,master){if(master){MBAL=v;localStorage.setItem('bp-mbal',v)}else if(cur){const p={...pref(cur.id),bal:v};PREF.set(cur.id,p);clearTimeout(balSet.t);balSet.t=setTimeout(()=>put('prefs',pref(cur.id)),300)}applyMix();balUI()}
function balUI(){if(!$('balc'))return;const sb=cur?+(pref(cur.id).bal||0):0;$('bals').value=Math.round(sb*100);$('balm').value=Math.round(MBAL*100);$('balsv').textContent=balTxt(sb);$('balmv').textContent=balTxt(MBAL);
 $('baln').textContent=cur&&hasClick(cur.id)?'ไฟล์นี้มีนอม: บาลานซ์ปรับเฉพาะช่องเพลง (นอมไม่เปลี่ยน)':'ไฟล์สเตอริโอ: ปรับความดังซ้าย/ขวาแยกกัน'}
function balCard(){const g=document.querySelector('#plx>.grid');if(!g||$('balc'))return;const c=document.createElement('div');c.className='card c26';c.id='balc';
 c.innerHTML=`<div class="lb">⚖️ บาลานซ์ ซ้าย/ขวา</div><div class="brow"><span class="small" style="min-width:64px">เพลงนี้</span><input type="range" id="bals" min="-100" max="100" value="0" style="flex:1"><b id="balsv" style="min-width:44px;text-align:center">C</b></div>
 <div class="brow"><span class="small" style="min-width:64px">รวม</span><input type="range" id="balm" min="-100" max="100" value="0" style="flex:1"><b id="balmv" style="min-width:44px;text-align:center">C</b></div>
 <div class="brow"><button class="hw" id="balr">↺ กลาง</button><span class="small" id="baln"></span></div>`;g.appendChild(c);
 $('bals').oninput=e=>balSet(+e.target.value/100,false);$('balm').oninput=e=>balSet(+e.target.value/100,true);$('balr').onclick=()=>{balSet(0,true);balSet(0,false)};balUI()}
window.__bal={get:()=>({song:cur?+(pref(cur.id).bal||0):0,master:MBAL,f:MX.f?MX.f.map(g=>+g.gain.value.toFixed(3)):null}),mul:balMul};
// ---- share setlist ----
let SNOTE={};
const nk=s=>(s||'').toLowerCase().replace(/[\s\-–_.,()\[\]'"]/g,'');
const b64u=u8=>{let s='';for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const ub64=s=>{s=s.replace(/-/g,'+').replace(/_/g,'/');const b=atob(s);return Uint8Array.from(b,c=>c.charCodeAt(0))};
async function slEncode(o){const raw=new TextEncoder().encode(JSON.stringify(o));if(typeof CompressionStream!='undefined'){try{const z=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());if(z.length<raw.length)return 'z'+b64u(z)}catch(e){}}return 'j'+b64u(raw)}
async function slDecode(s){const k=s[0],u=ub64(s.slice(1));let raw=u;if(k=='z')raw=new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());return JSON.parse(new TextDecoder().decode(raw))}
// v1.51: per-song settings travel (v:2). r[7] = compact non-default prefs (+sd = original side). Old apps ignore r[7].
const SLNO=new Set(['id','key','tempo']),SLZ=new Set(['bt0','lp','ci']);
function slX(id){const p=pref(id),s=SONG.get(id)||{},o={};if(s.s)o.sd=s.s;for(const [k,v] of Object.entries(p)){if(SLNO.has(k)||v==null||v===false||v===''||(v===0&&!SLZ.has(k)))continue;if(Array.isArray(v)&&(!v.length||v.every(x=>x===0)))continue;if(typeof v=='object'&&!Array.isArray(v)&&!Object.keys(v).length)continue;if(typeof v=='function')continue;o[k]=v}return o}
function slData(){return{v:2,d:new Date().toISOString().slice(0,10),n:SNOTE._name||'',s:SET.map(id=>{const s=SONG.get(id)||{},p=pref(id);return[s.t||'',s.a||'',p.key||0,p.tempo||100,SNOTE[id]||'',s.k||'',baseBpm(id)||0,slX(id)]})}}
// v1.84.25: share/invite/QR links must never point at the app's own local origin (Android app = https://localhost, file:, capacitor:)
const PUB24=window.__PUB_BASE||'https://paithoonbeer.github.io/';function pubBase(){const l=location;if(l.protocol=='file:'||l.protocol=='capacitor:'||l.origin=='null'||(/^(localhost|127\.|0\.0\.0\.0)/.test(l.hostname)&&!l.port))return PUB24;return l.origin+l.pathname}
const SLB=()=>pubBase()+'?openExternalBrowser=1';
// v1.0.34: qrcode.js is loaded on first use (not on every page load). Until it arrives a placeholder is rendered and swapped in place.
function qrSvg(t,ec){const mk=()=>{const q=qrcode(0,ec||'L');q.addData(String(t),'Byte');q.make();return q.createSvgTag({cellSize:3,margin:2,scalable:true})};if(typeof qrcode=='function')return mk();qrLoad();const id='lqr'+Math.random().toString(36).slice(2,9);(window.__lqr=window.__lqr||[]).push([id,mk]);return `<span id="${id}" class="lqr"></span>`}
function qrLoad(){if(window.__qrl)return window.__qrl;return window.__qrl=new Promise((ok,no)=>{const s=document.createElement('script');s.src='qrcode.js';s.onload=()=>{const L=window.__lqr||[];window.__lqr=[];for(const [id,mk] of L){const e=document.getElementById(id);if(e)try{e.outerHTML=mk()}catch(x){}}ok()};s.onerror=()=>{window.__qrl=null;no(new Error('qrcode.js'))};document.head.appendChild(s)})}window.__pub24=pubBase;
async function slLong(enc){return SLB()+'#sl='+(enc||await slEncode(slData()))}
// v1.48 short link: id = base62 of SHA-256(payload) → same list = same id (no duplicate docs); falls back to long #sl= link
const B62='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
async function slId(d,n){const h=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(d)));let x=0n;for(const b of h)x=x*256n+BigInt(b);let o='';for(let i=0;i<n;i++){o+=B62[Number(x%62n)];x/=62n}return o}
let SLLAST={d:'',u:''};
async function slLink(){const d=await slEncode(slData());if(SLLAST.d===d)return SLLAST.u;
 try{if(!navigator.onLine)throw new Error('offline');if(d.length>=20000)throw new Error('too big');const m=window.__slMod||await import('./cloud.js');
  for(const n of [8,10,12]){const id=await slId(d,n),r=await m.slPut(id,d);if(r!=='clash'){const u=SLB()+'#s='+id;SLLAST={d,u};return u}}throw new Error('id clash')}
 catch(e){blog('warn','sl short',e.message||String(e));toast('⚠️ สร้างลิงก์สั้นไม่ได้ (ออฟไลน์?) — ใช้ลิงก์ยาวแทน',3000,true);return slLong(d)}}
window.__sl={link:slLink,id:slId,long:slLong,decode:slDecode,encode:slEncode};
// v1.56: ONE share entry. Band member (can edit) -> band live list; otherwise live link -> share sheet (QR/code inside)
function shEditBands(){return (typeof BD!=='undefined'&&CLD.user)?BD.bands.filter(b=>bdRole(b)!=='viewer'):[]}
async function shareOne(){if(!SET.length){toast('ยังไม่มีเพลงในคืนนี้');return}
 if(LIVE&&LIVE.b)return shSheet({band:LIVE.bn||''});
 const bs=shEditBands();
 if(bs.length&&(!LIVE||!LIVE.b)){const go=async b=>{const n=SNOTE._name||new Date().toLocaleDateString(LANG=='en'?'en-GB':'th-TH');const r=await lvStart({b:b.id,bn:b.name,n});if(r){try{localStorage.removeItem('bp-bdoff')}catch(e){}try{bdMarkSeen();bdSDraw()}catch(e){}}};
  if(bs.length==1)return go(bs[0]);return shSheet({bands:bs,go})}
 let u=null;if(navigator.onLine)u=await lvStart();if(!u){try{u=slLong(await slEncode(slData()))}catch(e){return}}
 shSheet({u});await shSend(u)}
function shNotes(){const rows=SET.map((id,i)=>{const s=SONG.get(id)||{t:id};return`<div class="shr"><b data-noi18n>${i+1}. ${esc(s.t)}</b><input data-sn="${esc(id)}" placeholder="โน้ต (เช่น ขึ้นท่อนเดียว)" value="${esc(SNOTE[id]||'')}"></div>`}).join('');
 return `<details id="shnd"><summary>📝 ชื่องาน / โน้ตต่อเพลง</summary><input id="shn" placeholder="ชื่องาน / หมายเหตุ (ไม่บังคับ)" value="${esc(SNOTE._name||'')}"><div class="shl">${rows}</div></details>`}
function shNotesBind(el){el.addEventListener('change',async e=>{const t=e.target;if(t.id==='shn'){SNOTE._name=t.value.trim()}else if(t.dataset&&t.dataset.sn){if(t.value.trim())SNOTE[t.dataset.sn]=t.value.trim();else delete SNOTE[t.dataset.sn]}else return;try{if(t.dataset&&t.dataset.sn)lvEdit(t.dataset.sn,'note');lvUser('field')}catch(_){}try{await put('kv',{k:'snote',v:SNOTE})}catch(_){}if(LIVE)try{lvDirty()}catch(_){}})}
async function shSend(u){if(navigator.share){try{await navigator.share({title:'Setlist',text:'เซ็ตลิสต์คืนนี้'+(SNOTE._name?' – '+SNOTE._name:''),url:u});return}catch(e){if(e&&e.name==='AbortError')return}}slCopy(u,'📋 คัดลอกลิงก์แล้ว — วางใน LINE ได้เลย')}
function shSheet(o){let el=$('shm');if(!el){el=document.createElement('div');el.id='shm';el.className='ovl';document.body.appendChild(el);shNotesBind(el)}
 if('band' in o){el.innerHTML=`<div class="mbox shsm"><div class="row" style="justify-content:space-between"><b>📤 แชร์ลิสต์</b><button id="shx" class="hw">✕</button></div><div class="small"><span data-noi18n>👥 ${esc(o.band)}</span> — ซิงก์กับวงอยู่แล้ว สมาชิกเห็นทุกการแก้ไขทันที</div><div class="small sh804">👥 สมาชิกในวงไม่ต้องใช้รหัสหรือลิงก์ — ลิสต์จะขึ้นในแท็บคืนนี้ของทุกคนในวงเอง (สมาชิกใหม่: เข้าวงด้วยลิงก์เชิญ แล้วรอสักครู่)</div>${shNotes()}</div>`}else
 if(o.bands){el.innerHTML=`<div class="mbox"><div class="row" style="justify-content:space-between"><b>📤 แชร์ลิสต์เข้าวงไหน?</b><button id="shx" class="hw">✕</button></div><div class="row" style="flex-wrap:wrap;gap:8px">${o.bands.map((b,i)=>`<button class="hw okb" data-bi="${i}" data-noi18n>👥 ${esc(b.name)}</button>`).join('')}</div></div>`;
  el.querySelectorAll('[data-bi]').forEach(x=>x.onclick=()=>{el.style.display='none';o.go(o.bands[+x.dataset.bi])})}
 else{const r=slParse(o.u),code=r&&(r.live||r.id)||'';el.innerHTML=`<div class="mbox shsm"><div class="row" style="justify-content:space-between"><b>📤 แชร์ลิสต์</b><button id="shx" class="hw">✕</button></div>
 <div class="small">${r&&r.live?'ลิสต์สด — ทุกคนที่เปิดลิงก์แก้คีย์/ลำดับแล้วเห็นพร้อมกัน':'ออฟไลน์ — ส่งเป็นสำเนาลิสต์'}</div>
 <div class="row shcr" style="gap:12px;align-items:center;flex-wrap:wrap"><div id="shqr" class="shqr"></div>${code?`<div><div class="small">หรือพิมพ์รหัสในแอป</div><div id="shcode" class="slcode" data-noi18n data-noicon>${code}</div></div>`:''}</div>
 <div class="small sh804">${(typeof BD!=='undefined'&&BD.bands.length)?'👥 สมาชิกในวงเดียวกันไม่ต้องใช้รหัส — กด 📤 แชร์ลิสต์ อีกครั้งเพื่อส่งเข้าวง':'👥 เล่นเป็นวงประจำ? สร้างวงแล้วเชิญสมาชิก (บัญชี › วงของฉัน) — ลิสต์จะขึ้นในแท็บคืนนี้ของทุกคนเอง ไม่ต้องใช้รหัส'} · พิมพ์รหัสได้ที่ แท็บคืนนี้ › ⋯ เพิ่มเติม › วางลิงก์ / ใส่รหัสลิสต์</div><input id="shu" readonly data-noi18n value="${esc(o.u)}"><button id="shsh" class="hw okb">📤 ส่งอีกครั้ง</button>${shNotes()}</div>`;
  try{$('shqr').innerHTML=qrSvg(o.u,'L')}catch(e){}
  $('shsh').onclick=()=>shSend(o.u)}
 el.style.display='flex';$('shx').onclick=()=>el.style.display='none';el.onclick=e=>{if(e.target==el)el.style.display='none'}}
window.__share={one:shareOne,sheet:shSheet};
function shareBtn(){const r=document.querySelector('#main .row:has(>#chk)')||($('chk')&&$('chk').parentNode);if(!r||$('shbtn'))return;const b=document.createElement('button');b.id='shbtn';b.className='okb';b.textContent='📤 แชร์ลิสต์';b.onclick=shareOne;r.appendChild(b)}
function slMatch(t,a,sd){const T=nk(t),A=nk(a);let best=null;for(const [id,s] of SONG){if(nk(s.t)!=T)continue;const sc=(A&&nk(s.a)==A?2:0)+(sd&&s.s==sd?1.5:0)+(fileOf(s)?1:0)+(s.id?0.5:0);if(!best||sc>best.sc)best={id,sc}}if(best||!T)return best&&best.id;
 // v1.55 fallback: same song saved with artist/title swapped or combined in the file name
 for(const [id,s] of SONG){const st=nk(s.t),sa=nk(s.a);const hit=(A&&st==A&&sa==T)||(A&&(st==T+A||st==A+T))||(st.length>3&&(T+A).includes(st)&&(!sa||(T+A).includes(sa)));if(!hit)continue;const sc=(fileOf(s)?1:0)+(s.id?0.5:0)+(sd&&s.s==sd?1.5:0);if(!best||sc>best.sc)best={id,sc}}return best&&best.id}
async function slOpen(data){let el=$('slv');if(!el){el=document.createElement('div');el.id='slv';el.className='ovl';document.body.appendChild(el)}
 const items=(data.s||[]).map(r=>{const x=r[7]&&typeof r[7]=='object'&&!Array.isArray(r[7])?r[7]:null;return{t:r[0],a:r[1],key:+r[2]||0,tempo:+r[3]||100,note:r[4]||'',k:r[5]||'',x,id:slMatch(r[0],r[1],x&&x.sd)}});const ok=items.filter(x=>x.id).length;
 el.innerHTML=`<div class="mbox"><div class="row" style="justify-content:space-between"><b>🎤 เซ็ตลิสต์จากวง</b><button id="slx" class="hw">✕</button></div>
 <div class="small">${esc(data.d||'')}${data.n?' • <span data-noi18n>'+esc(data.n)+'</span>':''} • ${items.length} เพลง • ตรงกับในเครื่อง ${ok}</div>
 <ol class="sll">${items.map(x=>`<li class="${x.id?'ok':'no'}"><b data-noi18n>${esc(x.t)}</b>${x.a?' <span class="small" data-noi18n>– '+esc(x.a)+'</span>':''}<div class="small">${x.id?'✅':'❌ ไม่พบในเครื่อง'}${x.key?' • คีย์ '+(x.key>0?'+':'')+x.key:''}${x.tempo!=100?' • '+x.tempo+'%':''}${x.k?' • '+esc(x.k):''}${x.x&&x.x.swap?' • 🎧 สลับนอม':''}${x.x&&x.x.mk&&x.x.mk.length?' • 📍 '+x.x.mk.length+' มาร์ก':''}</div>${x.note?`<div class="sln" data-noi18n>📝 ${esc(x.note)}</div>`:''}</li>`).join('')}</ol>
 <label class="row small" style="gap:8px"><input type="checkbox" id="slkt" checked style="width:24px;height:24px"> ใช้การตั้งค่าตามลิสต์ (คีย์ · ความเร็ว · สลับนอม · มาร์กท่อน ฯลฯ)</label>
 <div class="row" style="flex-wrap:wrap;gap:8px"><button id="slrep" class="hw okb">📥 ใช้เป็นลิสต์คืนนี้</button><button id="sladd" class="hw">＋ ต่อท้ายลิสต์</button></div></div>`;
 el.style.display='flex';const close=()=>{el.style.display='none';history.replaceState(null,'',location.pathname+location.search)};$('slx').onclick=close;
 const imp=async rep=>{const ids=items.filter(x=>x.id);if($('slkt').checked)for(const x of ids){let p;if(x.x){const {sd,...rest}=x.x;p={id:x.id,...rest,key:x.key,tempo:x.tempo}}else p={...pref(x.id),key:x.key,tempo:x.tempo};PREF.set(x.id,p);await put('prefs',p)}
  for(const x of ids)if(x.note)SNOTE[x.id]=x.note;try{await put('kv',{k:'snote',v:SNOTE})}catch(e){}
  if(rep){const nw=ids.map(x=>x.id);if(SET.length&&SET.join()!==nw.join()){try{localStorage.setItem('bp-set-prev',JSON.stringify(SET))}catch(e){}}SET=nw}else for(const x of ids)if(!SET.includes(x.id))SET.push(x.id);await saveSet();render();close();toast('✅ นำเข้าลิสต์ '+ids.length+' เพลง'+(items.length-ids.length?' (ไม่พบ '+(items.length-ids.length)+')':'')+(rep&&localStorage.getItem('bp-set-prev')?' · ลิสต์เดิมเก็บไว้แล้ว (เรียกคืนได้ในแท็บคืนนี้)':''),4000,true)};
 $('slrep').onclick=()=>{if(SET.length&&!confirm('แทนที่ลิสต์คืนนี้ ('+SET.length+' เพลง) ด้วยลิสต์นี้?\nลิสต์เดิมจะถูกเก็บไว้ เรียกคืนได้ภายหลัง'))return;imp(true)};$('sladd').onclick=()=>imp(false)}
// v1.49: one parser for code / short link / old long link
function slParse(x){x=String(x||'').trim();let m;if(/^[0-9A-Za-z]{14}$/.test(x))return{live:x};if(m=x.match(/#l=([0-9A-Za-z]{14})(?![0-9A-Za-z_-])/))return{live:m[1]};if(/^[0-9A-Za-z]{8,12}$/.test(x))return{id:x};
 if(m=x.match(/[#&?]s=([0-9A-Za-z]{8,12})(?![0-9A-Za-z_-])/))return{id:m[1]};if(m=x.match(/#sl=([\w-]+)/))return{p:m[1]};if(m=x.match(/[#&]j=([0-9A-Za-z]{10})(?![0-9A-Za-z_-])/))return{inv:m[1]};return null}
const isStandalone=()=>!!(navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches));
const localCount=()=>{try{return FILES.size}catch(e){return 0}};
function slNeedBanner(o){o=o||{};const st='standalone' in o?o.standalone:isStandalone(),n='local' in o?o.local:localCount();return !st&&n<3}
async function slRun(r,fromLink){if(!r){toast('❌ ลิงก์หรือรหัสไม่ถูกต้อง');return false}if(r.live)return lvJoin(r.live);if(r.inv)return bdJoin(r.inv);let p=r.p;
 if(r.id){try{const md=window.__slMod||await import('./cloud.js');p=await md.slGet(r.id);if(!p){if(r.id.length===10)return bdJoin(r.id);toast('❌ ไม่พบลิสต์นี้ (ลิงก์อาจผิด)');return false}}catch(e){toast('❌ โหลดลิสต์ไม่ได้ — ต้องต่อเน็ต');blog('warn','sl get',e.message||String(e));return false}}
 let data;try{data=await slDecode(p)}catch(e){toast('❌ ลิงก์ลิสต์ไม่ถูกต้อง');blog('warn','sl decode',e.message);return false}
 await slOpen(data);if(fromLink&&slNeedBanner())slBanner(r);return true}
function slBanner(r){const box=document.querySelector('#slv .mbox');if(!box||$('slban'))return;const code=r.id||'',link=r.id?SLB()+'#s='+r.id:SLB()+location.hash;const d=document.createElement('div');d.id='slban';d.className='slban';
 d.innerHTML=`<b>📱 ถ้าคุณติดตั้งแอปไว้บนหน้าจอ ให้คัดลอกรหัสนี้ไปใส่ในแอป</b><div class="small">เบราว์เซอร์นี้แยกที่เก็บเพลงจากแอปบนหน้าจอโฮม — เปิดแอป › แท็บคืนนี้ › ⋯ เพิ่มเติม › “วางลิงก์ / ใส่รหัสลิสต์”</div>${code?`<div class="slcode" data-noi18n data-noicon>${code}</div>`:''}<div class="row" style="gap:8px;flex-wrap:wrap"><button class="hw okb" id="slbcp">📋 ${code?'คัดลอกรหัส':'คัดลอกลิงก์'}</button></div><div class="small">หรือนำเข้าที่นี่ก็ได้ด้านล่าง</div>`;
 box.insertBefore(d,box.children[1]||null);$('slbcp').onclick=()=>slCopy(code||link,code?'📋 คัดลอกรหัสแล้ว':'📋 คัดลอกลิงก์แล้ว')}
async function slCopy(t,msg){try{await navigator.clipboard.writeText(t)}catch(e){const i=document.createElement('textarea');i.value=t;document.body.appendChild(i);i.select();try{document.execCommand('copy')}catch(_){}i.remove()}toast(msg||'📋 คัดลอกแล้ว',1800,true)}
// v1.0.0: one device, several accounts — the local library belongs to the account that used it; another account starts empty.
async function luid100(u){const L=localStorage.getItem('bp-luid');if(u.email&&/^paithooningrad@gmail\.com$/i.test(u.email)&&localStorage.getItem('bp-cat')===null){localStorage.setItem('bp-cat','1');localStorage.setItem('bp-luid',u.uid);location.reload();return true}
 if(!L||L===u.uid){localStorage.setItem('bp-luid',u.uid);return false}
 const has=FILES.size||(SET||[]).length||PREF.size;if(!has){localStorage.setItem('bp-luid',u.uid);return false}
 if(navigator.webdriver||confirm('เครื่องนี้มีคลังเพลงของบัญชีอื่นอยู่\nกด OK = ล้างคลังในเครื่องแล้วเริ่มใหม่สำหรับบัญชีนี้ (ข้อมูลที่สำรองบนคลาวด์ของบัญชีเดิมยังอยู่)\nกด ยกเลิก = ออกจากระบบ')){
  try{await new Promise((ok,no)=>{const q=indexedDB.open('beerplayer');q.onsuccess=()=>{const d=q.result;const n=[...d.objectStoreNames];const t=d.transaction(n,'readwrite');n.forEach(x=>t.objectStore(x).clear());t.oncomplete=()=>{d.close();ok()};t.onerror=()=>no(t.error)};q.onerror=()=>no(q.error)})}catch(e){blog('warn','luid wipe '+e)}
  ['bp-set','bp-state','bp-cloud-h','bp-ntl','bp-ntr'].forEach(k=>localStorage.removeItem(k));localStorage.setItem('bp-luid',u.uid);blog('info','account switch: local library cleared');location.reload();return true}
 try{await CLD.mod.out()}catch(e){}return true}
async function slCheck(){if(window.__LINEBLOCK)return;const h=location.hash;{const m=h.match(/^#l=([0-9A-Za-z]{14})$/);if(m){const go=()=>{history.replaceState(null,'',location.pathname+location.search);lvJoin(m[1])};if(window.__catok)go();else{const t=setInterval(()=>{if(window.__catok){clearInterval(t);go()}},200)}return}}if(!/^#sl?=/.test(h))return;const r=slParse(h);if(!r)return;
 const go=()=>slRun(r,true);if(window.__catok)go();else{const t=setInterval(()=>{if(window.__catok){clearInterval(t);go()}},200)}}
// v1.49 in-app entry: paste link / enter code (tonight + import tabs, collapsed by default)
function slEntry(){const m=$('main');if(!m||view!='S'||$('slin'))return;const el=document.createElement('div');el.id='slin';el.className='sec slin';
 el.innerHTML=`<input id="slinp" placeholder="🔗 วางลิงก์หรือรหัสลิสต์ / วง แล้วกด Enter" enterkeyhint="go" autocapitalize="off" autocomplete="off" spellcheck="false" data-noi18n><div class="row"></div>`;
 {let pv=null;try{pv=JSON.parse(localStorage.getItem('bp-set-prev')||'null')}catch(e){}if(view=='S'&&Array.isArray(pv)&&pv.length){const b=document.createElement('button');b.id='slprev';b.className='lnk8415';b.textContent='🔄 เรียกคืนลิสต์เดิม ('+pv.length+' เพลง)';b.onclick=async()=>{if(SET.length&&!confirm('สลับกลับเป็นลิสต์เดิม? (ลิสต์ปัจจุบันจะถูกเก็บแทน)'))return;const now=SET;SET=pv;try{localStorage.setItem('bp-set-prev',JSON.stringify(now))}catch(e){}await saveSet();render();toast('✅ เรียกคืนลิสต์เดิมแล้ว',2000,true)};el.querySelector('.row').appendChild(b)}}
 const first=m.querySelector(':scope>.sec');if(view=='S'&&first)first.after(el);else m.prepend(el);accify(el,'slin','🔗 วางลิงก์ / ใส่รหัสลิสต์',false);
 const go=async()=>{const v=$('slinp').value;const r=slParse(v);if(!r){toast('❌ ลิงก์หรือรหัสไม่ถูกต้อง');return}if(await slRun(r,false)&&$('slinp'))$('slinp').value=''};
 $('slinp').onkeydown=e=>{if(e.key=='Enter')go()};$('slinp').addEventListener('paste',()=>setTimeout(()=>{if(slParse($('slinp').value))go()},0));
 const pb=$('slpaste');if(pb)pb.onclick=async()=>{try{const t=await navigator.clipboard.readText();$('slinp').value=t.trim();if(slParse(t))go();else toast('คลิปบอร์ดไม่มีลิงก์/รหัสลิสต์')}catch(e){toast('วางเองได้: แตะค้างในช่องแล้วเลือก “วาง”');$('slinp').focus()}}}
new MutationObserver(()=>{clearTimeout(slEntry.t);slEntry.t=setTimeout(()=>{try{slEntry()}catch(e){}},30)}).observe(document.body,{childList:true,subtree:true});
// v1.50: iOS Safari (not home-screen app) hint — storage is separate
setTimeout(()=>{try{if(!window.__IOSSAFARI||window.__INAPP||localStorage.getItem('bp-safhint')||$('safhint'))return;const d=document.createElement('div');d.id='safhint';d.innerHTML='<span>📱 กำลังใช้ใน Safari — เพลงและลิสต์ที่นี่แยกจากแอปบนหน้าจอโฮม</span><button class="hw" id="safx">✕</button>';document.body.prepend(d);$('safx').onclick=()=>{localStorage.setItem('bp-safhint','1');d.remove()}}catch(e){}},800);
window.__sl=Object.assign(window.__sl||{},{match:(t,a)=>slMatch(t,a),pref:id=>pref(id),setPrefFor:(id,ch)=>setPrefFor(id,ch),set:()=>[...SET],cur:()=>cur&&cur.id,data:()=>slData(),parse:slParse,needBanner:slNeedBanner,run:slRun});
window.addEventListener('hashchange',slCheck);setTimeout(slCheck,300);
// ---- onboarding ----
const ONB=[['👋 ยินดีต้อนรับสู่ SetSod เซ็ตสด','ทัวร์สั้น ๆ 5 ขั้น (ข้ามได้)'],['🎵 แท็บเพลง','เลือกข้างหูนอม (ซ้าย/ขวา) แล้วแตะ ▶ เพื่อเล่น · แตะ ＋ เพื่อเพิ่มเข้าลิสต์คืนนี้'],['🎤 แท็บคืนนี้','ลาก ☰ เพื่อเรียงเพลง · กด ⬇️ โหลดทั้งลิสต์ ก่อนขึ้นงาน · 🔗 แชร์ลิสต์ให้วงได้'],['🎛 หน้าสตูดิโอ','แตะ ⌃ ที่แถบเล่นด้านล่าง เพื่อเปิดมิกเซอร์ คีย์ ความเร็ว มาร์กท่อน'],['❓ ช่วยเหลือ','เปิดวิธีใช้/แจ้งปัญหาได้ที่แท็บนำเข้า หรือปุ่ม ❓ · เปิดทัวร์นี้อีกครั้งได้ที่ 🎓']];
function onbOpen(i=0){let el=$('onb');if(!el){el=document.createElement('div');el.id='onb';el.className='ovl';document.body.appendChild(el)}const [h,t]=ONB[i];
 el.innerHTML=`<div class="mbox onbx"><div class="onbd">${ONB.map((_,k)=>`<i class="${k==i?'on':''}"></i>`).join('')}</div><h3>${h}</h3><p>${t}</p><div class="row" style="justify-content:space-between;gap:8px"><button id="onbs" class="hw">ข้าม</button><span class="row" style="gap:8px">${i?'<button id="onbp" class="hw">‹ ก่อนหน้า</button>':''}<button id="onbn" class="hw okb">${i<ONB.length-1?'ถัดไป ›':'เริ่มใช้งาน ✓'}</button></span></div></div>`;
 el.style.display='flex';const done=()=>{localStorage.setItem('bp-onb','1');el.style.display='none'};$('onbs').onclick=done;$('onbn').onclick=()=>i<ONB.length-1?onbOpen(i+1):done();if($('onbp'))$('onbp').onclick=()=>onbOpen(i-1)}
window.__onb=onbOpen;
setTimeout(()=>{if(/[?&]onb=1/.test(location.search)||(!localStorage.getItem('bp-onb')&&!navigator.webdriver&&!/^#sl?=/.test(location.hash)))onbOpen(0)},900);
function onbBtn(){const x=$('hpx');if(!x||$('onbb'))return;const b=document.createElement('button');b.id='onbb';b.className='hw';b.textContent='🎓';b.setAttribute('aria-label','ทัวร์แนะนำ');b.onclick=()=>{$('help').classList.remove('on');onbOpen(0)};x.parentNode.insertBefore(b,x)}
new MutationObserver(()=>{try{shareBtn();onbBtn();if(document.querySelector('#plx>.grid')&&!$('balc'))balCard()}catch(e){}}).observe(document.body,{childList:true,subtree:true});
{const _sl3=studioLoad;studioLoad=function(){_sl3();try{balCard();balUI()}catch(e){}}}
// ===== v31: stop-at-marker (audio-clock accurate) + decluttered marker bar + advanced tools group =====
mkUI=function(){const el=$('mkbar');if(!el)return;if(!cur){el.querySelectorAll(':scope>:not(.acch)').forEach(x=>x.remove());return}const mk=marks(),p=pref(cur.id);
 const ic=(m,i)=>(m.st?'⏹ ':'')+(p.lp===i?'🔁 ':'')+(m.sk?'⏭ ':'');const hd=el.querySelector(':scope>.acch');
 const html=`<div class="mkchips">${mk.map((m,i)=>`<button class="mkc ${i==MKSEL?'sel':''} ${m.sk?'sk':''} ${m.st?'st':''} ${p.lp===i?'lp':''}" data-mk="${i}" title="แตะ = กระโดดไปจุดนี้ + เลือก">${ic(m,i)}${esc(m.n)} <small>${fmt(m.t)}</small></button>`).join('')||'<span class="small mkempty">ยังไม่มีมาร์ก — กด ＋ มาร์ก</span>'}
 <span class="mkadd"><select id="mkp" aria-label="ชื่อมาร์กใหม่">${PRESETS.map(x=>`<option>${x}</option>`).join('')}</select><button id="mka" class="hw">＋ มาร์ก</button></span></div>
 ${MKSEL>=0&&mk[MKSEL]?`<div class="mked"><span class="small">📍 <b>${esc(mk[MKSEL].n)}</b> ${fmt(mk[MKSEL].t)} — เลือกการทำงาน:</span>
  <button id="mkst" class="${mk[MKSEL].st?'on':''}">⏹ หยุดที่จุดนี้</button><button id="mkl" class="${p.lp===MKSEL?'on':''}">🔁 วนท่อนนี้</button><button id="mks" class="${mk[MKSEL].sk?'on':''}">⏭ ข้ามท่อนนี้</button>
  <select id="mkrn" aria-label="เปลี่ยนชื่อ"><option value="">✏️ เปลี่ยนชื่อ…</option>${PRESETS.map(x=>`<option value="${x}">${x}</option>`).join('')}<option value="?">พิมพ์ชื่อเอง…</option></select>
  <button id="mkd" style="color:#ff453a">🗑 ลบ</button><button id="mkx" aria-label="ปิด">✕</button></div>`:''}`;
 el.querySelectorAll(':scope>:not(.acch)').forEach(x=>x.remove());el.insertAdjacentHTML('beforeend',html);if(hd&&el.firstChild!==hd)el.insertBefore(hd,el.firstChild)};
document.addEventListener('click',async e=>{const t=e.target;if(!cur||t.id!='mkst')return;const mk=marks();if(!mk[MKSEL])return;mk[MKSEL].st=!mk[MKSEL].st;if(mk[MKSEL].st)mk[MKSEL].sk=false;await setMarks(mk);
 toast(mk[MKSEL]&&mk[MKSEL].st?'⏹ จะหยุดเล่นเมื่อถึง '+mk[MKSEL].n+' ('+fmt(mk[MKSEL].t)+')':'▶ ยกเลิกหยุดที่มาร์กนี้',2200,true)});
document.addEventListener('change',async e=>{if(e.target.id!='mkrn'||!cur)return;const mk=marks();if(!mk[MKSEL])return;let n=e.target.value;if(n=='?')n=(prompt('ชื่อท่อน',mk[MKSEL].n)||'').trim();if(n){mk[MKSEL].n=n.slice(0,20);await setMarks(mk);toast('✏️ '+n,1200,true)}});
// toast for loop/skip toggles (clear feedback)
document.addEventListener('click',e=>{if(!cur)return;const id=e.target.id;if(id!='mkl'&&id!='mks')return;setTimeout(()=>{const mk=marks(),p=pref(cur.id),m=mk[MKSEL];if(!m)return;
 if(id=='mkl')toast(p.lp===MKSEL?'🔁 วนท่อน '+m.n:'🔁 ปิดการวน',1800,true);else toast(m.sk?'⏭ จะข้ามท่อน '+m.n:'⏭ ไม่ข้ามท่อนนี้',1800,true)},80)},true);
// waveform flag icons
{const _dm=drawMarks;drawMarks=function(g,W,H){_dm(g,W,H);if(!cur)return;const d=cur.buf.duration,r=devicePixelRatio;marks().forEach(m=>{if(!m.st)return;const x=f2x(m.t/d,W);if(x<-20||x>W)return;g.fillStyle='#ff453a';g.fillRect(x-1*r,0,3*r,H);g.fillRect(x-7*r,2*r,14*r,14*r);g.fillStyle='#fff';g.fillRect(x-3.5*r,5.5*r,7*r,7*r)})}}
// stop engine: crossing detection (any path) + audio-clock pre-mute so throttled timers can't overshoot
const STP={lp:null,armed:null,hits:0};
function stpDisarm(){if(STP.armed!=null&&MX.fade&&ctx){try{MX.fade.gain.cancelScheduledValues(ctx.currentTime);MX.fade.gain.setValueAtTime(1,ctx.currentTime)}catch(e){}}STP.armed=null}
function stpAt(m){STP.hits++;stop();offset=m.t;ended=false;STP.lp=null;stpDisarm();try{render()}catch(e){}toast('⏹ หยุดที่มาร์ก '+m.n+' ('+fmt(m.t)+') — แตะ ▶ เล่นต่อ',3000,true);blog('info','stop marker '+m.n+' @'+m.t)}
function stpCheck(){if(!cur||!playing||TAIL||(typeof FADING!='undefined'&&FADING)){if(!playing)STP.lp=null;return}const p=pos(),lp=STP.lp;STP.lp=p;
 const sts=marks().filter(m=>m.st&&m.t>0.05);if(!sts.length){if(STP.armed!=null)stpDisarm();return}
 if(lp!=null&&p>=lp&&p-lp<3){const m=sts.find(m=>lp<m.t-0.002&&p>=m.t-0.02);if(m){stpAt(m);return}}
 const nx=sts.find(m=>m.t>p+0.02);if(!nx){return}const rate=(pref(cur.id).tempo||100)/100,dt=(nx.t-p)/rate;
 if(dt<0.5&&STP.armed!==nx.t&&MX.fade){STP.armed=nx.t;try{const t=ctx.currentTime;MX.fade.gain.cancelScheduledValues(t);MX.fade.gain.setValueAtTime(MX.fade.gain.value,t);MX.fade.gain.setValueAtTime(MX.fade.gain.value,t+Math.max(0,dt-0.012));MX.fade.gain.linearRampToValueAtTime(0,t+dt)}catch(e){}
  clearTimeout(STP.to);STP.to=setTimeout(()=>{if(playing&&cur&&STP.armed===nx.t&&pos()>=nx.t-0.06)stpAt(nx)},dt*1000+15)}
 else if(STP.armed!=null&&(nx.t!==STP.armed&&!sts.some(m=>m.t===STP.armed&&m.t>p-0.05)))stpDisarm()}
setInterval(stpCheck,30);
{const _st=start;start=function(at){stpDisarm();STP.lp=null;return _st(at)}}
document.addEventListener('visibilitychange',()=>{try{stpCheck()}catch(e){}});
window.__stp=STP;
// ---- declutter: advanced tools grouped & collapsed by default ----
function advGroup(){const g=document.querySelector('#plx>.grid');if(!g)return;let a=$('advc');if(!a){a=document.createElement('div');a.id='advc';a.className='card c26';g.appendChild(a)}
 accify(a,'adv','🧰 เครื่องมือเพิ่มเติม: ตัดหัว/ท้าย · นับเข้า · พรีวิว · บาลานซ์',false);
 ['trimc','cic','pvc','balc'].forEach(id=>{const x=$(id);if(x&&x.parentNode!==a)a.appendChild(x)})}
new MutationObserver(()=>{try{if(document.querySelector('#plx>.grid'))advGroup()}catch(e){}}).observe(document.body,{childList:true,subtree:true});

// ---- b32: declutter + slim pre-show checklist ----
let CKOPEN=false;
{const _ds=drawShowck;drawShowck=function(){_ds();const el=$('showck');if(!el)return;const o=ckLoad(),n=CK.filter(([k])=>o.t[k]).length,all=n==CK.length;
 const un=SET.filter(i=>{const x=SONG.get(i);return x&&!fileOf(x)}).length,netw=navigator.onLine||un;
 if((all||o.hide)&&!CKOPEN){el.innerHTML=`<button id="cksl" class="cksl ${all?'okb':''}" aria-label="ก่อนขึ้นโชว์">🛡 ก่อนขึ้นโชว์ ${all?'✅':'⚠️'} ${n}/${CK.length}${netw?' <span title="เครือข่าย">📶⚠️</span>':''} <span class="small">แตะเพื่อเปิด</span></button>`;$('cksl').onclick=()=>{CKOPEN=true;drawShowck()};return}
 const h=el.querySelector('.ckh');if(h&&!$('ckhide')){const b=document.createElement('button');b.id='ckhide';b.className='hw';b.textContent='✕ ซ่อน';b.setAttribute('aria-label','ซ่อน');b.onclick=()=>{const q=ckLoad();q.hide=true;localStorage.setItem('bp-showck',JSON.stringify(q));CKOPEN=false;drawShowck()};h.appendChild(b)}}}
document.addEventListener('change',e=>{if(e.target.dataset&&e.target.dataset.ck){const o=ckLoad();if(CK.every(([k])=>o.t[k]))CKOPEN=false;setTimeout(drawShowck,0)}});
document.addEventListener('click',e=>{if(e.target.id=='ckreset')CKOPEN=false},true);
function declut(){try{metaBtn()}catch(e){}const m=$('main');if(!m)return;
 if(view=='S'&&$('clr')){const row=$('dlall')&&$('dlall').parentNode;let s=$('sopt');
  if(!s){s=document.createElement('div');s.id='sopt';s.className='sopt';const sc=$('showck');(sc||row).after(s);
   const r2=document.createElement('div');r2.className='row';s.appendChild(r2);r2.append($('clr'));
   accify(s,'sopt','⚙️ ตัวเลือกลิสต์: ล้างลิสต์',false)}
  else if($('clr')&&!s.contains($('clr'))){/*v1.84.14: only ล้างลิสต์ stays here; เช็กเพลง (#ckw) lives in เพิ่มเติม, autoplay/gap/crossfade on now-playing + Live*/const r2=s.querySelector('.row');if(r2)r2.replaceChildren($('clr'))}
  const sb=$('shbtn');if(sb&&row&&sb.parentNode!==row)row.appendChild(sb)}
 if(view=='F'){const lg=$('lgv'),da=$('delall');if(lg&&da){const sys=lg.closest('.sec'),old=da.closest('.sec');if(old!==sys){sys.appendChild(da);da.style.marginTop='8px';if(old&&!old.children.length)old.remove()}}
  const lb=$('langb'),th=$('thsec');if(lb&&th&&th.parentNode!==lb){lb.appendChild(th);th.classList.remove('sec');th.classList.add('thin');const h=lb.querySelector(':scope>.acch');if(h)h.dataset.t='1'}}}
new MutationObserver(()=>{clearTimeout(declut.t);declut.t=setTimeout(declut,0)}).observe(document.body,{childList:true,subtree:true});
window.__declut=declut;

// ---- b33: chip row scroll arrow ----
function chipNx(){const w=document.querySelector('#hd .chipw'),c=w&&w.querySelector('.chips');if(!c)return;
 const upd=()=>c.classList.toggle('endx',c.scrollLeft+c.clientWidth>=c.scrollWidth-4);
 if(!w.querySelector('.chipnx')){const b=document.createElement('button');b.type='button';b.className='chipnx hw';b.textContent='›';b.setAttribute('aria-label','เลื่อนดูหมวดถัดไป');b.onclick=()=>c.scrollBy({left:c.clientWidth*0.7,behavior:'smooth'});c.after(b);c.addEventListener('scroll',upd,{passive:true});addEventListener('resize',upd)}
 upd()}
new MutationObserver(()=>{clearTimeout(chipNx.t);chipNx.t=setTimeout(chipNx,50)}).observe(document.body,{childList:true,subtree:true});

// ---- b34: clear lock-screen Now Playing when idle + one-tap search clear ----
const IDLE={t:null,cleared:false,n:0};
function msIdleClear(why){if(playing)return;if(PV.el&&!PV.el.paused)return;
 try{if('mediaSession' in navigator){navigator.mediaSession.metadata=null;navigator.mediaSession.playbackState='none';try{navigator.mediaSession.setPositionState()}catch(e){}}}catch(e){}
 try{if(ctx&&ctx.state==='running'&&!(window.__metro&&__metro.state.running)&&!PAD.on)ctx.suspend()}catch(e){}IDLE.cleared=true;IDLE.n++;IDLE.why=why}
function msIdleArm(ms){clearTimeout(IDLE.t);IDLE.t=setTimeout(()=>msIdleClear('timer'),ms)}
function msPos(){try{if(!('mediaSession' in navigator)||!cur||!navigator.mediaSession.setPositionState)return;const d=cur&&cur.buf&&cur.buf.duration;if(!(d>0))return;const r=(window.__bp&&__bp.tempo&&__bp.tempo.p?__bp.tempo.p/100:1)||1;const w=mkWin();navigator.mediaSession.setPositionState({duration:w.len,playbackRate:r,position:Math.max(0,Math.min(w.len,pos()-w.ts))})}catch(e){}}
{const _st=start;start=function(...a){clearTimeout(IDLE.t);try{ctx&&ctx.state!=='running'&&ctx.resume()}catch(e){}const r=_st.apply(this,a);if(IDLE.cleared||!('mediaSession' in navigator)||!navigator.mediaSession.metadata){IDLE.cleared=false;mediaMeta()}msPos();return r}}
{const _sp=stop;stop=function(...a){const r=_sp.apply(this,a);msPos();msIdleArm(ended||!cur?1500:20000);return r}}
setInterval(()=>{if(playing)msPos();else if(!IDLE.t&&!IDLE.cleared)msIdleArm(20000)},5000);
{const _pk=pvKill;pvKill=function(...a){const r=_pk.apply(this,a);if(!playing)msIdleArm(1500);return r}}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!playing&&!(PV.el&&!PV.el.paused)&&(ended||!cur||offset<0.05))msIdleClear('hidden')});
window.__ms={get idle(){return {...IDLE,t:!!IDLE.t}},clear:msIdleClear,get state(){return {meta:!!(navigator.mediaSession&&navigator.mediaSession.metadata),ps:navigator.mediaSession&&navigator.mediaSession.playbackState,ctx:ctx&&ctx.state}}};
// one-tap ✕ clear: act on touchend/pointerup, block blur + ghost click
function sclrDo(b){const w=b.closest('.sw'),inp=w&&w.querySelector('input');if(!inp)return;inp.value='';inp.dispatchEvent(new Event('input',{bubbles:true}));w.classList.remove('has');try{inp.focus({preventScroll:true})}catch(e){}}
let SCLR_T=0;
document.addEventListener('touchstart',e=>{const b=e.target.closest&&e.target.closest('.sclr');if(b){e.preventDefault();e.stopPropagation()}},{capture:true,passive:false});
document.addEventListener('touchend',e=>{const b=e.target.closest&&e.target.closest('.sclr');if(!b)return;e.preventDefault();e.stopPropagation();SCLR_T=Date.now();sclrDo(b)},{capture:true,passive:false});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.sclr');if(!b)return;e.stopPropagation();e.preventDefault();if(Date.now()-SCLR_T<700)return;sclrDo(b)},true);
{const _sy=sync;sync=function(...a){const r=_sy.apply(this,a);try{if(!playing&&ended&&!IDLE.cleared&&!IDLE.e){IDLE.e=1;msIdleArm(1500)}if(playing)IDLE.e=0;if(IDLE.cleared&&!playing&&'mediaSession' in navigator)navigator.mediaSession.playbackState='none'}catch(e){}return r}}

// ---- b35: vertically center ✕ on its input ----
function sclrPos(){document.querySelectorAll('.sw').forEach(w=>{const i=w.querySelector('input'),b=w.querySelector('.sclr');if(!i||!b)return;const v=(i.offsetTop+i.offsetHeight/2)+'px';if(b.style.top!==v)b.style.top=v})}
new MutationObserver(()=>{clearTimeout(sclrPos.t);sclrPos.t=setTimeout(sclrPos,0)}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
addEventListener('resize',sclrPos);document.addEventListener('input',sclrPos,true);setTimeout(sclrPos,300);

// ---- b36: account + cloud backup (Firestore, no audio) ----
const CLD={st:'idle',user:null,last:null,mod:null,busy:false,err:'',lastHash:null};
const accOn=()=>localStorage.getItem('bp-acct')==='1';
async function accMod(){if(CLD.mod)return CLD.mod;if(!navigator.onLine)throw new Error('offline');CLD.st='loading';accDraw();
 const m=await import('./cloud.js');await m.init();CLD.mod=m;m.onUser(async u=>{try{const ct=u&&Date.parse(u.metadata&&u.metadata.creationTime||'');CLD.ct=ct||0;if(ct&&ct<CAT101)cat101on('account created before 1.0.0')}catch(e){}if(u){try{if(cat100()&&!CAT.length)await catRefresh(true)}catch(e){}}if(u&&await luid100(u))return;CLD.user=u?{email:u.email||u.displayName||'',uid:u.uid}:null;localStorage.setItem('bp-acct',u?'1':'0');CLD.st='ready';CLD.last=null;accDraw();if(u){try{const h=await m.head();CLD.last=h&&h.ts;accDraw()}catch(e){}}});return m}
const LSX=['bp-log','bp-showck','bp-acct','bp-cloud-msg'];
async function accPayload(){const ls={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('bp-')&&!LSX.includes(k))ls[k]=localStorage.getItem(k)}
 const files=(await tx('files','readonly',s=>s.getAllKeys()))||[];
 return {v:1,app:APPV,prefs:await getAll('prefs'),kv:(await getAll('kv')).filter(r=>!String(r&&r.k).startsWith('art:')),ls,files}}
function accHash(p){const s=JSON.stringify({a:p.prefs,b:p.kv,c:p.ls});let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h}
async function accBackup(quiet){if(CLD.busy)return;CLD.busy=true;accDraw();try{const m=await accMod();const p=await accPayload();const h=accHash(p);
  const r=await m.backup(p,navigator.userAgent.slice(0,120),APPV);CLD.lastHash=h;localStorage.setItem('bp-cloud-h',String(h));CLD.last=new Date();if(!quiet)toast('☁️ สำรองข้อมูลแล้ว',3000,true);blog('info','cloud backup',r)}
 catch(e){CLD.err=e.message;if(!quiet)toast('❌ สำรองไม่สำเร็จ: '+accErr(e));blog('warn','cloud backup',e.message)}CLD.busy=false;accDraw()}
async function accRestore(){if(CLD.busy)return;CLD.busy=true;accDraw();try{const m=await accMod();const r=await m.restore();if(!r){toast('ยังไม่มีข้อมูลสำรองบนคลาวด์');return}
  const d=r.data,when=r.head.ts?r.head.ts.toLocaleString():'';if(!confirm('กู้คืนจากคลาวด์ ('+when+')? ข้อมูลตั้งค่าในเครื่องนี้จะถูกแทนที่ — ไฟล์เสียงในเครื่องไม่ถูกลบ'))return;
  for(const p of d.prefs||[])await put('prefs',p);for(const k of d.kv||[])await put('kv',k);for(const [k,v] of Object.entries(d.ls||{}))localStorage.setItem(k,v);
  const have=new Set((await tx('files','readonly',s=>s.getAllKeys()))||[]);const miss=(d.files||[]).filter(f=>!have.has(f));
  localStorage.setItem('bp-cloud-msg',JSON.stringify({miss:miss.length,ex:miss.slice(0,5)}));bpMark('cloud restore');location.replace(location.pathname)}
 catch(e){toast('❌ กู้คืนไม่สำเร็จ: '+accErr(e))}finally{CLD.busy=false;accDraw()}}
function accErr(e){const c=e&&e.code||'';return c.includes('popup-blocked')?'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ — กดปุ่มอีกครั้ง (ถ้ายังไม่ขึ้น: ตั้งค่า › Safari › ปิด “บล็อกป๊อปอัป”)':c.includes('popup-closed-by-user')||c.includes('cancelled-popup')?'ปิดหน้าต่างเข้าสู่ระบบก่อนเสร็จ — กดเข้าสู่ระบบอีกครั้ง':c.includes('web-storage-unsupported')?'เบราว์เซอร์นี้ปิดการเก็บข้อมูล — เปิดใน Safari/Chrome แล้วลองใหม่':c.includes('wrong-password')||c.includes('invalid-credential')?'อีเมลหรือรหัสผ่านไม่ถูกต้อง':c.includes('email-already')?'อีเมลนี้มีบัญชีแล้ว — กดเข้าสู่ระบบ':c.includes('weak-password')?'รหัสผ่านต้องยาว 6 ตัวขึ้นไป':c.includes('invalid-email')?'อีเมลไม่ถูกต้อง':c.includes('network')||e.message=='offline'?'ไม่มีอินเทอร์เน็ต':c.includes('unauthorized-domain')?'โดเมนยังไม่ได้รับอนุญาต':(e.message||String(e))}
// v1.0.35: Google sign-in must call the popup synchronously inside the tap (iOS blocks popups opened after an await).
function accGoogle(){let pr;try{pr=CLD.mod&&CLD.mod.ready&&CLD.mod.ready()?CLD.mod.google():accMod().then(m=>m.google())}catch(e){pr=Promise.reject(e)}
 try{if(CLD.mod&&CLD.mod.xsite&&CLD.mod.xsite()&&(navigator.standalone===true)){const v=()=>{if(document.visibilityState!=='visible')return;document.removeEventListener('visibilitychange',v);setTimeout(()=>{if(!CLD.user)toast('ถ้ายังเข้าสู่ระบบไม่ได้ในแอปบนหน้าโฮม: ใช้อีเมล/รหัสผ่านแทน หรือเปิด paithoonbeer.github.io ใน Safari',8000)},4000)};document.addEventListener('visibilitychange',v)}}catch(e){}
 return Promise.resolve(pr).catch(e=>{const c=e&&e.code||'';if(c==='bp/inapp')return inappSheet();if(c.includes('popup-closed-by-user')||c.includes('cancelled-popup'))return toast(accErr(e),3500);toast('❌ '+accErr(e),6000)})}
function inappSheet(){if($('iasheet'))return;const u=SLB(),d=document.createElement('div');d.id='iasheet';d.setAttribute('role','dialog');
 d.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.7);display:flex;align-items:flex-end;justify-content:center';
 d.innerHTML='<div style="background:#1f1f29;color:#f2f2f7;border-radius:18px 18px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));width:100%;max-width:520px"><b style="font-size:19px">เปิดใน Safari/Chrome เพื่อเข้าสู่ระบบ</b><p class="small" style="margin:8px 0 12px">เบราว์เซอร์ในแอปแชต (LINE / Facebook / Messenger ฯลฯ) เข้าสู่ระบบด้วย Google ไม่ได้ — แตะ ⋯ แล้วเลือก “เปิดในเบราว์เซอร์” หรือคัดลอกลิงก์ไปวางใน Safari/Chrome</p><input readonly data-noi18n style="width:100%;margin-bottom:10px" value="'+esc(u)+'"><div class="row"><button id="iacp" class="hw okb">📋 คัดลอกลิงก์</button><button id="iax" class="hw">ปิด</button></div></div>';
 document.body.appendChild(d);$('iax').onclick=()=>d.remove();d.onclick=e=>{if(e.target===d)d.remove()};
 $('iacp').onclick=()=>{const ok=()=>toast('คัดลอกลิงก์แล้ว — วางใน Safari/Chrome',3000,true);try{navigator.clipboard.writeText(u).then(ok,()=>{fbc();ok()})}catch(e){fbc();ok()}};
 function fbc(){const i=d.querySelector('input');i.select();try{document.execCommand('copy')}catch(e){}}}
// v1.0.42: admin lives on GitHub Pages (the old setsod.web.app / beer-player-admin hosts are stale / 509) — always open the live one
const ADM42='https://paithoonbeer.github.io/admin/';
function admOpen(){try{const N=window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform();const B=N&&Capacitor.Plugins&&Capacitor.Plugins.Browser;if(B&&B.open)return B.open({url:ADM42});const w=window.open(ADM42,'_blank','noopener');if(!w)location.href=ADM42}catch(e){location.href=ADM42}}
if(window.__bp)window.__bp.cld42={get CLD(){return CLD},draw:()=>accDraw(),open:()=>admOpen()};// test hook
function accTime(d){if(!d)return 'ยังไม่เคยสำรอง';return d.toLocaleString(LANG=='en'?'en-GB':'th-TH',{dateStyle:'medium',timeStyle:'short'})}
function accDraw(){const c=$('acctc');if(!c)return;const b=c.querySelector('.accb');if(!b)return;const u=CLD.user,auto=localStorage.getItem('bp-cloud-auto')==='1';
 let h='';
 if(!navigator.onLine&&!CLD.mod)h=`<div class="small">📴 ออฟไลน์ — แอปใช้งานได้ปกติ (เข้าสู่ระบบ/สำรองเมื่อมีเน็ต)</div>`;
 else if(CLD.st==='loading'&&!u)h=`<div class="small">⏳ กำลังเชื่อมต่อ…</div>`;
 else if(!u){if(!CLD.mod&&!CLD.pre&&navigator.onLine){CLD.pre=1;setTimeout(()=>accMod().catch(()=>{CLD.pre=2;if(!CLD.mod&&CLD.st==='loading'){CLD.st='';accDraw()}}),0)}h=`<button id="acgo" class="hw big3">🔑 เข้าสู่ระบบด้วย Google</button>
  <div class="small acor">หรือใช้อีเมล</div><input id="acem" type="email" autocomplete="email" placeholder="อีเมล"><input id="acpw" type="password" autocomplete="current-password" placeholder="รหัสผ่าน (6 ตัวขึ้นไป)">
  <div class="row"><button id="acin" class="hw">เข้าสู่ระบบ</button><button id="acup" class="hw">สมัครใหม่</button><button id="acfg" class="hw">ลืมรหัส</button></div>`}
 else h=`<div class="acu">👤 <b data-noi18n>${esc(u.email)}</b></div><div class="small" id="aclast"><span>สำรองล่าสุด:</span> <span data-noi18n>${accTime(CLD.last)}</span></div>
  <div class="row"><button id="acbk" class="hw big3" ${CLD.busy?'disabled':''}>${CLD.busy?'⏳':'☁️⬆️'} สำรองตอนนี้</button><button id="acrs" class="hw big3" ${CLD.busy?'disabled':''}>☁️⬇️ กู้คืนจากคลาวด์</button></div>
  <label class="ck"><input type="checkbox" id="acau" ${auto?'checked':''}><span>สำรองอัตโนมัติ (เมื่อมีการเปลี่ยนแปลง)</span></label>
  ${CLD.adm&&CLD.adm.e===u.email&&CLD.adm.r?`<button id="acadm" class="hw">🛠 หน้าแอดมิน (${CLD.adm.r=='owner'?'เจ้าของ':'พนักงาน'})</button>`:''}
  <button id="acout" class="hw">ออกจากระบบ</button>`;
 b.innerHTML=h+`<div class="small acnote">ℹ️ สำรอง: เซ็ตลิสต์ ข้อมูลเพลง มาร์ก ตัดหัว/ท้าย คีย์ ความเร็ว บาลานซ์ มิกซ์ ธีม ภาษา • ไฟล์เสียงไม่ถูกสำรอง (อยู่ในเครื่อง) — เครื่องใหม่ให้นำเข้าไฟล์ชื่อเดิม ระบบจะจับคู่ให้อัตโนมัติ</div>`;
 const on=(id,f)=>{const e=$(id);if(e)e.onclick=f};const ep=()=>[($('acem')||{}).value||'',($('acpw')||{}).value||''];
 const run=f=>async()=>{try{await accMod();await f()}catch(e){toast('❌ '+accErr(e))}};
 on('acgo',accGoogle);on('acin',run(()=>CLD.mod.emailIn(...ep())));on('acup',run(()=>CLD.mod.emailUp(...ep())));
 on('acfg',run(async()=>{const [em]=ep();if(!em)return toast('ใส่อีเมลก่อน');await CLD.mod.reset(em);toast('📧 ส่งลิงก์ตั้งรหัสใหม่ไปที่อีเมลแล้ว',4000,true)}));
 on('acadm',admOpen);if(u&&CLD.mod&&CLD.mod.admRole&&!(CLD.adm&&CLD.adm.e===u.email)){CLD.adm={e:u.email,r:''};CLD.mod.admRole().then(r=>{if(CLD.adm&&CLD.adm.e===u.email){CLD.adm.r=r;if(r)accDraw()}},()=>{})}
 on('acout',run(async()=>{await CLD.mod.out();toast('ออกจากระบบแล้ว — ข้อมูลในเครื่องยังอยู่ครบ')}));on('acbk',()=>accBackup(false));on('acrs',accRestore);
 const au=$('acau');if(au)au.onchange=()=>{localStorage.setItem('bp-cloud-auto',au.checked?'1':'0');if(au.checked)accBackup(true)}}
function accCard(){if(view!='F')return;const m=$('main');if(!m||$('acctc'))return;const sec=document.createElement('div');sec.className='sec';sec.id='acctc';
 sec.innerHTML='<div class="accb"></div>';const lb=$('langb');lb?lb.after(sec):m.insertBefore(sec,m.firstChild);
 accify(sec,'acct','☁️ บัญชี · สำรองข้อมูลขึ้นคลาวด์',false);const hd=sec.querySelector(':scope>.acch');
 if(hd)hd.addEventListener('click',()=>{if(!CLD.mod&&navigator.onLine)accMod().catch(()=>{CLD.st='idle';accDraw()})});
 if(accOn()&&navigator.onLine&&!CLD.mod)accMod().catch(()=>{});accDraw()}
new MutationObserver(()=>{clearTimeout(accCard.t);accCard.t=setTimeout(accCard,30)}).observe(document.body,{childList:true,subtree:true});
addEventListener('online',accDraw);addEventListener('offline',accDraw);
// auto-backup: when signed in + enabled, check every 2 min and on app hide; only uploads if data changed
async function accAuto(){if(localStorage.getItem('bp-cloud-auto')!=='1'||!accOn()||!navigator.onLine||CLD.busy)return;try{const m=await accMod();if(!CLD.user)return;const p=await accPayload();const h=accHash(p);if(String(h)===localStorage.getItem('bp-cloud-h'))return;await accBackup(true)}catch(e){}}
setInterval(()=>accAuto(),120000);document.addEventListener('visibilitychange',()=>{if(document.hidden)accAuto()});
if(accOn()&&navigator.onLine)setTimeout(()=>accMod().catch(()=>{}),4000);
{const m=localStorage.getItem('bp-cloud-msg');if(m){localStorage.removeItem('bp-cloud-msg');try{const o=JSON.parse(m);setTimeout(()=>toast(o.miss?`☁️ กู้คืนแล้ว • ต้องนำเข้าไฟล์เสียงอีก ${o.miss} ไฟล์ (ชื่อเดิม จะจับคู่อัตโนมัติ)`:'☁️ กู้คืนข้อมูลเรียบร้อย',7000,true),1200)}catch(e){}}}
window.__acc={get s(){return {...CLD,mod:!!CLD.mod}},backup:accBackup,restore:accRestore,payload:accPayload,mod:()=>accMod()};

// ---- b37: standalone account page (#account) with studio background ----
accCard=function(){};
function acpBuild(){if($('acctc'))return;const pg=document.createElement('div');pg.id='acctc';pg.className='acpg';pg.setAttribute('role','dialog');pg.setAttribute('aria-label','บัญชี');
 pg.innerHTML=`<div class="acbg"></div><div class="acsc"><div class="acpn"><div class="achd"><button id="acback" class="hw" aria-label="กลับ">‹ กลับ</button></div>
 <div class="aclogo"><div class="aci">🎧</div><div class="acn">SetSod</div><div class="acs">สำรองเซ็ตลิสต์และการตั้งค่าขึ้นคลาวด์</div></div>
 <div class="accb"></div><button id="acskip" class="hw">ใช้งานต่อโดยไม่ล็อกอิน ›</button></div></div>`;
 document.body.appendChild(pg);$('acback').onclick=acpClose;$('acskip').onclick=acpClose}
function acpIsOpen(){return document.body.classList.contains('acp-on')}
function acpOpen(push=true){acpBuild();document.body.classList.add('acp-on');if(push&&location.hash!=='#account')history.pushState(null,'','#account');
 if(!CLD.mod&&(navigator.onLine))accMod().catch(()=>{CLD.st='idle';accDraw()});accDraw();acpSkip()}
function acpClose(){localStorage.setItem('bp-acct-seen','1');document.body.classList.remove('acp-on');if(location.hash==='#account'){if(history.state===null&&history.length>1&&acpOpen.pushed)history.back();else history.replaceState(null,'',location.pathname+location.search)}catRlFlush()
 if(!localStorage.getItem('bp-onb')&&!navigator.webdriver)setTimeout(()=>onbOpen(0),300)}
function acpSkip(){const s=$('acskip');if(s)s.style.display=CLD.user?'none':''}
{const _ad=accDraw;accDraw=function(){_ad();acpSkip();acpBtn()}}
function acpBtn(){const sg=document.querySelector('.tabs');if(!sg)return;let b=$('acbtn');if(!b){b=document.createElement('button');b.id='acbtn';b.type='button';b.className='hw acbtn';b.setAttribute('aria-label','บัญชี / สำรองข้อมูล');b.onclick=()=>acpOpen();sg.appendChild(b)}
 const u=CLD.user,t=u?(u.email||'?').trim().charAt(0).toUpperCase():'☁️';if(b.textContent!==t)b.textContent=t;b.classList.toggle('in',!!u);{const tt=u?u.email:'เข้าสู่ระบบ / สำรองข้อมูล';if(b.title!==tt)b.title=tt}}
new MutationObserver(()=>{clearTimeout(acpBtn.t);acpBtn.t=setTimeout(acpBtn,30)}).observe(document.body,{childList:true,subtree:true});
addEventListener('hashchange',()=>{if(location.hash==='#account'){if(!acpIsOpen())acpOpen(false)}else if(acpIsOpen()){document.body.classList.remove('acp-on');localStorage.setItem('bp-acct-seen','1')}});
{const _ob=onbOpen;onbOpen=function(...a){if(acpIsOpen())return;return _ob.apply(this,a)}}
setTimeout(()=>{acpBuild();const force=/[?&]acct=1/.test(location.search);if(location.hash==='#account'||force||(!localStorage.getItem('bp-acct-seen')&&!navigator.webdriver&&!/^#(sl?|l|j)=/.test(location.hash)))acpOpen(location.hash!=='#account')},600);
window.__acp={open:acpOpen,close:acpClose,get on(){return acpIsOpen()}};

// ===================== b38: overlap/crossfade, bar fade, pad, downbeat grid, reorder =====================
// ---- 1. overlap next song (0-10 s) with optional crossfade; outgoing click fades fast ----
if(AUTO.xc==null)AUTO.xc=true;
autoCtl=function(){return `<span class="row" style="gap:6px;flex-wrap:wrap"><button data-au="1" class="${AUTO.on?'on':''}">เล่นต่ออัตโนมัติ: ${AUTO.on?'เปิด':'ปิด'}</button><select class="gapsel" aria-label="เว้นระหว่างเพลง" style="font-size:18px;min-height:44px;border-radius:10px;background:#222;color:#fff">${[0,3,5,10].map(g=>`<option value="${g}" ${g==AUTO.gap?'selected':''}>${g}s</option>`).join('')}</select><select class="xfsel" aria-label="ซ้อนเพลงถัดไป" style="font-size:18px;min-height:44px;border-radius:10px;background:#222;color:#fff">${[0,1,2,3,4,5,6,7,8,9,10].map(g=>`<option value="${g}" ${g==(AUTO.xf||0)?'selected':''}>${g?'XF '+g+'s':'XF off'}</option>`).join('')}</select><button data-xc="1" class="${AUTO.xc?'on':''}" ${AUTO.xf>0?'':'disabled'}>ครอสเฟด: ${AUTO.xc?'เปิด':'ปิด'}</button></span>`};
document.addEventListener('click',e=>{const b=e.target.closest('[data-xc]');if(!b)return;AUTO.xc=!AUTO.xc;saveAuto()});
document.addEventListener('change',e=>{if(e.target.classList&&e.target.classList.contains('xfsel'))setTimeout(drawAuto,0)});
xfade=function(nx,left){const b=cur.buf,at=pos(),p=pref(cur.id),t=ctx.currentTime,s0=SONG.get(cur.id),xc=AUTO.xc!==false;
 const g=ctx.createGain();const lv=db2(mixOf(cur.id).M)*Math.pow(10,gainDb(cur.id)/20);g.gain.setValueAtTime(lv,t);
 if(xc)g.gain.linearRampToValueAtTime(0.0001,t+left);else{g.gain.setValueAtTime(lv,t+Math.max(0,left-0.5));g.gain.linearRampToValueAtTime(0.0001,t+left)}
 const sp=ctx.createChannelSplitter(2),mg0=ctx.createChannelMerger(2),gc=[ctx.createGain(),ctx.createGain()];
 const ck=s0&&(s0.s=='L'||s0.s=='R')?clickCh(cur.id):-1;
 for(let c=0;c<2;c++){sp.connect(gc[c],c);gc[c].connect(mg0,0,c);if(c===ck){gc[c].gain.setValueAtTime(1,t);gc[c].gain.linearRampToValueAtTime(0.0001,t+0.25)}}
 mg0.connect(g);
 let node;if(!needSh(p)){node=ctx.createBufferSource();node.buffer=b;node.connect(sp);node.start(0,at)}else{node=new PitchShifter(ctx,b,8192,()=>{});node.pitchSemitones=p.key;node.tempo=(p.tempo||100)/100;node.percentagePlayed=at/b.duration;node.connect(sp)}
 if(p.swap){const s2=ctx.createChannelSplitter(2),mg=ctx.createChannelMerger(2);g.connect(s2);s2.connect(mg,0,1);s2.connect(mg,1,0);mg.connect(ctx.destination);mg.connect(split2)}else{g.connect(ctx.destination);g.connect(split2)}
 TAIL={node,g,ck,xc};blog('info','overlap '+left.toFixed(1)+'s xc='+xc+' -> '+nx);
 setTimeout(()=>{try{if(node.stop)node.stop();node.disconnect();if(node._node){node._node.onaudioprocess=null}}catch(e){}g.disconnect();TAIL=null},left*1000+200);
 load(nx).then(()=>{if(MX.fade){const t2=ctx.currentTime;MX.fade.gain.cancelScheduledValues(t2);if(xc){MX.fade.gain.setValueAtTime(0.0001,t2);MX.fade.gain.linearRampToValueAtTime(1,t2+Math.min(left,AUTO.xf))}else MX.fade.gain.setValueAtTime(1,t2)}})};
window.__xf={get tail(){return TAIL?{ck:TAIL.ck,xc:TAIL.xc}:null}};

// ---- 2. one-tap fade on the now-playing bar (moved, not duplicated) ----
const BARV=JSON.parse(localStorage.getItem('bp-barbtn')||'{"fade":true,"pad":true}');
function barBtns(){const mini=document.querySelector('#pl .mini'),ex=$('exp'),fb=$('fadeb');if(!mini||!ex)return;
 if(fb&&fb.parentNode!==mini){fb.classList.add('barb');fb.textContent='🔉';fb.setAttribute('aria-label','เฟดออก');fb.title='เฟดออก';mini.insertBefore(fb,ex)}
 let pb=$('padb');if(!pb){pb=document.createElement('button');pb.id='padb';pb.className='hw barb';pb.textContent='🎹';pb.setAttribute('aria-label','Pad');pb.title='Pad';pb.onclick=()=>padToggle();mini.insertBefore(pb,ex)}
 if(fb)fb.style.display=BARV.fade?'':'none';pb.style.display=BARV.pad?'':'none';
 const fr=$('fdrow');if(fr&&!$('fdvis')){const l=document.createElement('label');l.className='ck barvis';l.innerHTML=`<input type="checkbox" id="fdvis" ${BARV.fade?'checked':''}><span>แสดงปุ่ม 🔉 บนแถบเล่น</span>`;fr.appendChild(l);
  $('fdvis').onchange=e=>{BARV.fade=e.target.checked;localStorage.setItem('bp-barbtn',JSON.stringify(BARV));barBtns()}}}
// fade also takes the pad down
{const _df=doFade;doFade=function(){const was=!!FADING;_df();if(!was&&FADING&&PAD.on&&!PAD.wait&&!PAD.hold)padOff(FD.s)}}

// ---- 3. Pad: synthesized ambient pad following song key (+ live key shift), on the music side ----
const NOTE=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];const FLAT={Db:1,Eb:3,Gb:6,Ab:8,Bb:10,Cb:11,Fb:4,'E#':5,'B#':0};
// v1.0.40: keys are read the way people type them — any case for the note (e, eb, f#m, bbm), ♯/♭, "min"/"minor" for minor,
// "E→Eb" uses the first key; the spelling (sharp/flat) the user typed is kept (sp) so D# shows as D#, not Eb.
function keyParse(k){const m=String(k||'').trim().replace(/♯/g,'#').replace(/♭/g,'b').match(/^([A-Ga-g])([#b]?)\s*(m(?!aj)|min(?:or)?|ไมเนอร์)?(?=$|[^A-Za-z]|maj|M|dim|aug|sus|add)/);if(!m)return null;const n=m[1].toUpperCase()+(m[2]||'');let r=NOTE.indexOf(n);if(r<0)r=FLAT[n];if(r==null||r<0)return null;return{r,m:m[3]?1:0,sp:m[2]||''}}
const KEYD=JSON.parse(localStorage.getItem('bp-keyd')||'{}');
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}
 for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let j=0;j<len/2;j++){const k=i+j,l=k+len/2,tr=re[l]*cr-im[l]*ci,ti=re[l]*ci+im[l]*cr;re[l]=re[k]-tr;im[l]=im[k]-ti;re[k]+=tr;im[k]+=ti;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr}}}}
function detectKey(buf,ch){const sr=buf.sampleRate,d=buf.getChannelData(Math.min(ch,buf.numberOfChannels-1)),N=8192,F=48,chroma=new Float64Array(12),win=new Float32Array(N);
 for(let i=0;i<N;i++)win[i]=0.5-0.5*Math.cos(2*Math.PI*i/(N-1));const a=Math.floor(d.length*0.08),z=Math.floor(d.length*0.92)-N;if(z<=a)return null;
 const bins=[];for(let k=1;k<N/2;k++){const f=k*sr/N;if(f<55||f>1760)continue;const midi=69+12*Math.log2(f/440);const pc=((Math.round(midi)%12)+12)%12;bins.push([k,pc])}
 for(let fI=0;fI<F;fI++){const o=a+Math.floor((z-a)*fI/(F-1));const re=new Float64Array(N),im=new Float64Array(N);for(let i=0;i<N;i++)re[i]=d[o+i]*win[i];fft(re,im);
  const fr=new Float64Array(12);for(const [k,pc] of bins)fr[pc]+=Math.sqrt(re[k]*re[k]+im[k]*im[k]);let s=0;for(const v of fr)s+=v;if(s>0)for(let i=0;i<12;i++)chroma[i]+=fr[i]/s}
 const MAJ=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],MIN=[6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
 const corr=(x,y)=>{const mx=x.reduce((a,b)=>a+b)/12,my=y.reduce((a,b)=>a+b)/12;let n=0,dx=0,dy=0;for(let i=0;i<12;i++){n+=(x[i]-mx)*(y[i]-my);dx+=(x[i]-mx)**2;dy+=(y[i]-my)**2}return n/Math.sqrt(dx*dy||1)};
 let best={c:-2};for(let r=0;r<12;r++)for(const [m,P] of [[0,MAJ],[1,MIN]]){const rot=P.map((_,i)=>P[(i-r+12)%12]);const c=corr(Array.from(chroma),rot);if(c>best.c)best={r,m,c}}
 return{r:best.r,m:best.m,c:Math.round(best.c*100)/100}}
function songKey(id){const s=SONG.get(id);const k=keyParse(s&&s.k);if(k)return{...k,src:'list'};const d=KEYD[id];if(d&&d.r!=null)return{r:d.r,m:d.m,src:'auto'};return null}
function keyName(k){return k?NOTE[k.r]+(k.m?'m':''):'—'}
function keyLoad(){if(!cur)return;const id=cur.id;if(songKey(id)&&songKey(id).src!=='auto'||KEYD[id])return padUI();
 setTimeout(()=>{if(!cur||cur.id!==id)return;try{const s=SONG.get(id);const ch=s&&(s.s=='L'||s.s=='R')?1-clickCh(id):0;const r=detectKey(cur.buf,ch);KEYD[id]=r||{r:null};localStorage.setItem('bp-keyd',JSON.stringify(KEYD));blog('info','key detect '+id+' '+JSON.stringify(r))}catch(e){blog('warn','key detect',e.message)}padUI();padRetune()},400)}
const PAD={on:false,vol:+(localStorage.getItem('bp-padv')||0.5),g:null,v:[],flt:null,lfo:null,out:null,root:null,m:null,fi:+(localStorage.getItem('bp-padfi')||3)};
function padCh(){if(!cur)return 1;const s=SONG.get(cur.id);return s&&(s.s=='L'||s.s=='R')?1-clickCh(cur.id):1}
function padNotes(k,shift){const r=((k.r+(shift||0))%12+12)%12;const base=48+r;const third=k.m?3:4;return [base-12,base,base+7,base+12,base+12+third,base+19].map(m=>440*Math.pow(2,(m-69)/12))}
function padTarget(){if(!cur)return null;const k=songKey(cur.id);if(!k)return null;return{k,shift:pref(cur.id).key||0}}
function padOn(){initAudio();ctx.resume();const tg=padTarget();if(!tg){toast('🎹 ยังไม่รู้คีย์เพลงนี้ — เลือกคีย์ในการ์ด 🎹 Pad');return false}
 if(PAD.on)return true;const t=ctx.currentTime;PAD.g=ctx.createGain();PAD.g.gain.setValueAtTime(0.0001,t);PAD.g.gain.linearRampToValueAtTime(PAD.vol*0.35,t+PAD.fi);
 PAD.flt=ctx.createBiquadFilter();PAD.flt.type='lowpass';PAD.flt.frequency.value=1100;PAD.flt.Q.value=0.6;PAD.lfo=ctx.createOscillator();PAD.lfo.frequency.value=0.07;const lg=ctx.createGain();lg.gain.value=350;PAD.lfo.connect(lg);lg.connect(PAD.flt.frequency);PAD.lfo.start();
 const fs=padNotes(tg.k,tg.shift);PAD.v=fs.map((f,i)=>{const vg=ctx.createGain();vg.gain.value=(i==0?0.5:i>3?0.32:0.42)/fs.length;const os=[-7,7].map(dt=>{const o=ctx.createOscillator();o.type=i==0?'triangle':'sawtooth';o.frequency.value=f;o.detune.value=dt;o.connect(vg);o.start();return o});vg.connect(PAD.flt);return{os,vg}});
 PAD.flt.connect(PAD.g);PAD.out=padCh();PAD.g.connect(MX.f[PAD.out]||ctx.destination);PAD.on=true;PAD.root=tg.k.r+tg.shift;PAD.m=tg.k.m;padUI();return true}
function padOff(sec){if(!PAD.on)return;const t=ctx.currentTime,s=sec||2,g=PAD.g,v=PAD.v,l=PAD.lfo;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0.0001,t+s);
 setTimeout(()=>{try{v.forEach(x=>x.os.forEach(o=>o.stop()));l.stop();g.disconnect()}catch(e){}},s*1000+100);PAD.on=false;PAD.g=null;PAD.v=[];padUI()}
function padToggle(){if(PAD.on)padOff(2);else padOn()}
function padRetune(){if(!PAD.on)return;const tg=padTarget();if(!tg)return;const root=tg.k.r+tg.shift;const out=padCh();
 if(out!==PAD.out&&MX.f[out]){try{PAD.g.disconnect()}catch(e){}PAD.g.connect(MX.f[out]);PAD.out=out}
 if(root===PAD.root&&tg.k.m===PAD.m)return;const fs=padNotes(tg.k,tg.shift),t=ctx.currentTime;PAD.v.forEach((x,i)=>x.os.forEach(o=>o.frequency.setTargetAtTime(fs[i],t,0.08)));PAD.root=root;PAD.m=tg.k.m;padUI()}
setInterval(padRetune,250);
function padVol(v){PAD.vol=v;localStorage.setItem('bp-padv',v);if(PAD.on){const t=ctx.currentTime;PAD.g.gain.cancelScheduledValues(t);PAD.g.gain.setTargetAtTime(v*0.35,t,0.05)}}
{const _ic=msIdleClear;msIdleClear=function(...a){if(PAD.on)return;return _ic.apply(this,a)}}
function padCard(){const fr=$('fdrow');if(!fr||$('padc'))return;const c=document.createElement('div');c.id='padc';c.className='padc';fr.after(c);
 c.innerHTML=`<div class="row"><button id="padt" class="hw big3">🎹 Pad: ปิด</button><span class="small">คีย์ <b id="padk" data-noi18n>—</b> <span id="padks"></span></span></div>
 <label class="small">ความดัง Pad <input id="padv" type="range" min="0" max="1" step="0.05" value="${PAD.vol}" aria-label="ความดัง Pad"></label>
 <div class="row"><label class="small">เฟดเข้า <select id="padfi">${[1,3,5,8].map(x=>`<option value="${x}" ${x==PAD.fi?'selected':''}>${x} วิ</option>`).join('')}</select></label>
 <button type="button" class="hw small" data-meta="cur" title="คีย์เพลงตั้งที่ ✏️ ข้อมูลเพลง">✏️ คีย์เพลง (ข้อมูลเพลง)</button></div>
 <label class="ck barvis"><input type="checkbox" id="padvis" ${BARV.pad?'checked':''}><span>แสดงปุ่ม 🎹 บนแถบเล่น</span></label>
 <div class="small">เสียง Pad สังเคราะห์ในแอป ออกฝั่งเพลง (ไม่ออกฝั่งนอม) · เปลี่ยนคีย์สด Pad จะตามให้</div>`;
 accify(c,'pad','🎹 Pad (เสียงพื้นหลังตามคีย์เพลง)',false);
 $('padt').onclick=()=>padToggle();$('padv').oninput=e=>padVol(+e.target.value);$('padfi').onchange=e=>{PAD.fi=+e.target.value;localStorage.setItem('bp-padfi',PAD.fi)};
 $('padvis').onchange=e=>{BARV.pad=e.target.checked;localStorage.setItem('bp-barbtn',JSON.stringify(BARV));barBtns()};padUI()}
function padUI(){const t=$('padt'),b=$('padb');if(t){t.textContent='🎹 Pad: '+(PAD.on?'เปิด':'ปิด');t.classList.toggle('on',PAD.on)}if(b)b.classList.toggle('on',PAD.on);
 const k=cur&&songKey(cur.id),sh=cur?pref(cur.id).key||0:0;if($('padk'))$('padk').textContent=k?keyName({r:((k.r+sh)%12+12)%12,m:k.m,sp:k.sp}):'—';
 if($('padks'))$('padks').textContent=k?({manual:'(ตั้งเอง)',list:'(จากรายชื่อ)',auto:'(ตรวจอัตโนมัติ)'}[k.src]+(sh?` · เพลงเดิม ${keyName(k)} ${sh>0?'+':''}${sh}`:'')):'(ยังไม่รู้)';
 }
window.__pad={get s(){return{on:PAD.on,root:PAD.root,m:PAD.m,out:PAD.out,vol:PAD.vol,gain:PAD.g&&PAD.g.gain.value}},on:padOn,off:padOff,detectKey:id=>detectKey(cur.buf,padCh()),songKey,KEYD};

// ---- 4. downbeat grid: auto-detect beat 1, nudge (ms / beat), set-here, drag ruler, optional grid click ----
function dbDetect(id,buf){const b=baseBpm(id);if(!b)return null;const per=60/b,sg=sigOf(id)||4;if(sg<2)return{bt0:t0Of(id),conf:0};const s=SONG.get(id);const ch=s&&(s.s=='L'||s.s=='R')?clickCh(id):0;
 const sr=buf.sampleRate,d=buf.getChannelData(Math.min(ch,buf.numberOfChannels-1)),t0=BPMD[id]&&BPMD[id].t0!=null?BPMD[id].t0:t0Of(id);
 const peak=t=>{const a=Math.max(0,Math.floor((t-0.02)*sr)),z=Math.min(d.length,Math.floor((t+0.03)*sr));let m=0;for(let i=a;i<z;i+=2){const v=d[i]<0?-d[i]:d[i];if(v>m)m=v}return m};
 const acc=new Array(sg).fill(0),cnt=new Array(sg).fill(0);const dur=buf.duration;for(let n=0,t=t0;t<dur-0.05;n++,t=t0+n*per){const v=peak(t);acc[n%sg]+=v;cnt[n%sg]++}
 const avg=acc.map((v,i)=>v/(cnt[i]||1));let j=0;for(let i=1;i<sg;i++)if(avg[i]>avg[j])j=i;const srt=[...avg].sort((a,b)=>b-a);const conf=srt[0]>0?Math.round((1-srt[1]/srt[0])*100)/100:0;
 const bar=per*sg;return{bt0:Math.round((((t0+j*per)%bar)+bar)%bar*1000)/1000,conf,j}}
async function gridSet(bt0,why){if(!cur)return;const b=baseBpm(cur.id);if(!b)return toast('ยังไม่รู้ BPM — แตะตามจังหวะหรือกดตรวจใหม่ก่อน');const bar=60/b*(sigOf(cur.id)||4);bt0=Math.round((((bt0%bar)+bar)%bar)*1000)/1000;await setPref({bt0,dba:why});gridUI()}
async function gridAuto(quiet){if(!cur||!cur.buf)return;const r=dbDetect(cur.id,cur.buf);if(!r){if(!quiet)toast('ยังไม่รู้ BPM — ตรวจ BPM ก่อน');return}await gridSet(r.bt0,'auto');if(!quiet)toast('🎯 หาหัวห้องอัตโนมัติแล้ว'+(r.conf>0.05?' ('+Math.round(r.conf*100)+'%)':''),3000,true)}
{const _bl=beatLoad;beatLoad=function(...a){const r=_bl.apply(this,a);try{const p=pref(cur.id);if(p.bt0==null&&baseBpm(cur.id))gridAuto(true)}catch(e){}try{keyLoad()}catch(e){}return r}}
const GRID={click:localStorage.getItem('bp-gclk')==='1',vol:+(localStorage.getItem('bp-gclkv')||0.6),next:0};
function gridCard(){const bc=$('beatc');if(!bc||$('gridr'))return;const r=document.createElement('div');r.id='gridr';r.className='gridr';
 r.innerHTML=`<div class="lb">🎯 หัวห้อง (กริด) <span class="small" id="gdv" data-noi18n>—</span></div>
 <div class="brow"><button class="hw" id="gda">🤖 หาอัตโนมัติ</button><button class="hw" id="gdh">🎯 ตรงนี้</button></div>
 <div class="brow"><button class="hw" data-gn="-1b">−1 จังหวะ</button><button class="hw" data-gn="-10">−10ms</button><button class="hw" data-gn="10">+10ms</button><button class="hw" data-gn="1b">+1 จังหวะ</button></div>
 <canvas id="grd" class="grd" height="44" aria-label="ลากเพื่อเลื่อนกริด"></canvas>
 <div class="brow"><button class="hw ${GRID.click?'on':''}" id="gck">🥁 คลิกตามกริด: ${GRID.click?'เปิด':'ปิด'}</button></div>`;bc.appendChild(r);
 $('gda').onclick=()=>gridAuto(false);$('gdh').onclick=()=>cur&&gridSet(pos()-((ctx&&(ctx.outputLatency||0)+(ctx.baseLatency||0))||0)*((pref(cur.id).tempo||100)/100),'here');
 r.querySelectorAll('[data-gn]').forEach(b=>b.onclick=()=>{if(!cur)return;const v=b.dataset.gn,bp=baseBpm(cur.id)||120;const d=v.endsWith('b')?parseInt(v)*60/bp:+v/1000;gridSet(t0Of(cur.id)+d,'nudge')});
 $('gck').onclick=()=>{GRID.click=!GRID.click;localStorage.setItem('bp-gclk',GRID.click?'1':'0');const b=$('gck');b.textContent='🥁 คลิกตามกริด: '+(GRID.click?'เปิด':'ปิด');b.classList.toggle('on',GRID.click)};
 const cv=$('grd');let drag=null;cv.addEventListener('pointerdown',e=>{if(!cur)return;cv.setPointerCapture(e.pointerId);drag={x:e.clientX,t:t0Of(cur.id)};e.preventDefault()});
 cv.addEventListener('pointermove',e=>{if(!drag||!cur)return;const w=cv.getBoundingClientRect().width,bp=baseBpm(cur.id)||120,span=60/bp*(sigOf(cur.id)||4)*2;const nt=drag.t+(e.clientX-drag.x)/w*span;const p={...pref(cur.id),bt0:nt};PREF.set(cur.id,p);gridDraw()});
 cv.addEventListener('pointerup',e=>{if(!drag||!cur)return;drag=null;gridSet(t0Of(cur.id),'drag')});gridUI()}
function gridUI(){const v=$('gdv');if(!v)return;if(!cur){v.textContent='—';return}const p=pref(cur.id);v.textContent=(p.bt0!=null?p.bt0.toFixed(3)+' วิ':'—')+(p.dba?' · '+({auto:'อัตโนมัติ',here:'ตั้งเอง',nudge:'ปรับละเอียด',drag:'ลาก'}[p.dba]||''):'');gridDraw()}
function gridDraw(){const cv=$('grd');if(!cv||!cur)return;const w=cv.clientWidth||300,r=devicePixelRatio||1;if(cv.width!==Math.round(w*r))cv.width=w*r;if(cv.height!==Math.round(44*r))cv.height=44*r;const g=cv.getContext('2d'),bp=baseBpm(cur.id);g.clearRect(0,0,cv.width,cv.height);if(!bp)return;
 const per=60/bp,sg=sigOf(cur.id)||4,span=per*sg*2,t0=t0Of(cur.id),c0=pos()-span/2;g.fillStyle='rgba(255,255,255,.06)';g.fillRect(0,0,cv.width,cv.height);
 const n0=Math.floor((c0-t0)/per)-1;for(let n=n0;n<n0+sg*2+3;n++){const t=t0+n*per,x=(t-c0)/span*cv.width;if(x<0||x>cv.width)continue;const db=((n%sg)+sg)%sg==0;g.fillStyle=db?'#ffb020':'#8a8f99';g.fillRect(x-(db?2:1)*r,db?0:12*r,(db?4:2)*r,cv.height-(db?0:24*r));if(db){g.font=`700 ${11*r}px system-ui`;g.fillText('1',x+4*r,12*r)}}
 g.fillStyle='#ff453a';g.fillRect(cv.width/2-1*r,0,2*r,cv.height)}
setInterval(()=>{if($('grd')&&cur&&playing)gridDraw()},120);
// grid click scheduler (generated blips into the click strip; existing click levels untouched)
setInterval(()=>{if(!GRID.click||!cur||!playing||!ctx)return;const bp=baseBpm(cur.id);if(!bp)return;const rate=(pref(cur.id).tempo||100)/100,per=60/bp,sg=sigOf(cur.id)||4,t0=t0Of(cur.id),now=pos(),ahead=0.15*rate;
 let n=Math.ceil((Math.max(now,GRID.next)-t0)/per-1e-6);for(;;n++){const tb=t0+n*per;if(tb>now+ahead)break;if(tb<now-0.01||tb<0)continue;const at=ctx.currentTime+(tb-now)/rate;const acc=((n%sg)+sg)%sg==0;
  const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=acc?1600:1100;g.gain.setValueAtTime(0.0001,at);g.gain.exponentialRampToValueAtTime(GRID.vol*(acc?1:0.6),at+0.002);g.gain.exponentialRampToValueAtTime(0.0001,at+0.05);o.connect(g);g.connect(MX.f[clickCh(cur.id)]||ctx.destination);o.start(at);o.stop(at+0.06);GRID.next=tb+per*0.5}},25);
{const _st=start;start=function(...a){GRID.next=0;return _st.apply(this,a)}}
window.__grid={detect:id=>dbDetect(id||cur.id,cur.buf),set:gridSet,auto:gridAuto,get s(){return{...GRID,bt0:cur&&pref(cur.id).bt0,dba:cur&&pref(cur.id).dba}}};

// ---- 5. reorder while playing: keep NEXT correct, no audio interruption ----
let NXW=null;setInterval(()=>{try{if(!cur)return;const i=SET.indexOf(cur.id);setIdx=i;const nx=i>=0?SET[i+1]||null:null;if(nx&&!loadingId&&Date.now()-LOADT>8000&&SONG.get(nx)&&fileOf(SONG.get(nx))&&!cache.has(nx)&&nxOk(nx))decode(nx).catch(()=>{});if(nx===NXW)return;NXW=nx;try{drawCue()}catch(e){}try{stripDraw()}catch(e){}}catch(e){}},300);
window.__nextId=()=>{if(!cur)return null;const i=SET.indexOf(cur.id);return i>=0?SET[i+1]||null:null};

new MutationObserver(()=>{clearTimeout(barBtns.t);barBtns.t=setTimeout(()=>{barBtns();padCard();gridCard()},30)}).observe(document.body,{childList:true,subtree:true});
setTimeout(()=>{barBtns();padCard();gridCard()},500);
{const _sk=showKey;showKey=function(...a){const r=_sk.apply(this,a);try{padUI();gridUI()}catch(e){}return r}}

// ===================== b39: PC mode (DAW view, shortcuts, MIDI/pedal learn, drag-drop, band view) =====================
const PCQ=matchMedia('(min-width:1200px) and (hover:hover) and (pointer:fine)');
function pcmOn(){return PCQ.matches&&localStorage.getItem('bp-pcm')!=='0'}
function pcmApply(){const on=pcmOn();document.body.classList.toggle('pcm',on);pcBar();try{waveDraw()}catch(e){}}
PCQ.addEventListener?PCQ.addEventListener('change',pcmApply):PCQ.addListener(pcmApply);
// ---- toolbar (only in PC mode) ----
function pcBar(){const sb=document.querySelector('#studio .stbar');if(!sb)return;let t=$('pctb');
 if(!t){t=document.createElement('span');t.id='pctb';t.className='pctb';t.innerHTML=`<button class="hw" id="pcks" title="คีย์ลัด (?)">⌨️ คีย์ลัด</button><button class="hw" id="pcmd" title="MIDI / แป้นเหยียบ">🎛 MIDI/แป้นเหยียบ</button><button class="hw" id="pcbv" title="หน้าจอวง">🖥 หน้าจอวง</button><button class="hw" id="pcx" title="ปิดโหมด PC">✕ โหมด PC</button>`;
  sb.appendChild(t);$('pcks').onclick=ksOpen;$('pcmd').onclick=midiOpen;$('pcbv').onclick=bvOpen;$('pcx').onclick=()=>{localStorage.setItem('bp-pcm','0');pcmApply();toast('ปิดโหมด PC แล้ว — เปิดใหม่ได้ที่ ⚙️ นำเข้า › 🖥 โหมด PC')}}
 const m=$('main');if(m&&view=='F'&&PCQ.matches&&!$('pcmrow')){const r=document.createElement('div');r.className='sec';r.id='pcmrow';r.innerHTML=`<button class="hw" id="pcmt" style="width:100%;min-height:50px;font-size:17px"></button>`;const lb=$('langb');lb?lb.after(r):m.insertBefore(r,m.firstChild)}
 const b=$('pcmt');if(b){b.textContent='🖥 โหมด PC (DAW): '+(pcmOn()?'เปิด':'ปิด');b.onclick=()=>{localStorage.setItem('bp-pcm',pcmOn()?'0':'1');pcmApply()}}}
new MutationObserver(()=>{clearTimeout(pcBar.t);pcBar.t=setTimeout(pcBar,40)}).observe(document.body,{childList:true,subtree:true});
// ---- trim editing by dragging edges on the big waveform (PC mode) ----
{let tdrag=null;const wv=()=>$('wave');
 document.addEventListener('pointerdown',e=>{if(!document.body.classList.contains('pcm')||e.target.id!=='wave'||!cur)return;const r=e.target.getBoundingClientRect(),W=r.width,d=cur.buf.duration,x=e.clientX-r.left;
  const xs=f2x(trS(cur.id)/d,W),xe=f2x(trE(cur.id,d)/d,W);const w=Math.abs(x-xs)<=10?'s':Math.abs(x-xe)<=10?'e':null;if(!w)return;tdrag={w,W,l:r.left};e.target.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation()},true);
 document.addEventListener('pointermove',e=>{const c=wv();if(c&&document.body.classList.contains('pcm')&&cur&&!tdrag&&e.target===c){const r=c.getBoundingClientRect(),d=cur.buf.duration,x=e.clientX-r.left;const near=Math.abs(x-f2x(trS(cur.id)/d,r.width))<=10||Math.abs(x-f2x(trE(cur.id,d)/d,r.width))<=10;c.style.cursor=near?'ew-resize':''}
  if(!tdrag||!cur)return;e.preventDefault();e.stopImmediatePropagation();const f=x2f(e.clientX-tdrag.l,tdrag.W);trimSet(tdrag.w,Math.max(0,f)*cur.buf.duration,true)},true);
 document.addEventListener('pointerup',e=>{if(!tdrag||!cur)return;e.stopImmediatePropagation();const w=tdrag.w;tdrag=null;trimSet(w,null,false)},true)}
// ---- actions shared by keyboard, pedal, MIDI ----
function songStep(dir){let L=cur&&SET.includes(cur.id)?SET:[...new Set([...document.querySelectorAll('#main [data-play]')].map(e=>e.dataset.play))];const i=cur?L.indexOf(cur.id):-1;if(i<0){if(L.length)load(L[dir>0?0:L.length-1]);return}const n=L[i+dir];if(n)load(n);else toast(dir>0?'ไม่มีเพลงถัดไปในลิสต์':'นี่คือเพลงแรกในลิสต์')}
const ACTS={play:['▶/⏹ เล่น/หยุด',()=>$('big').click()],next:['⏭ เพลงถัดไป',()=>songStep(1)],prev:['⏮ เพลงก่อนหน้า',()=>songStep(-1)],fade:['🔉 เฟดออก',()=>doFade()],
 setnext:['⏭ ตั้งเป็นเพลงถัดไป',()=>{const id=(window.__hov&&__hov())||cue;if(id&&(!cur||id!==cur.id))chAct('next',id);else toast('ชี้หรือเลือกเพลงในรายการก่อน แล้วกด N')}],
 marker:['📍 มาร์กตรงนี้',()=>{const b=$('mka');if(b)b.click()}],pad:['🎹 Pad',()=>padToggle()],help:['⌨️ แสดงคีย์ลัด',()=>ksOpen()]};
let HOV=null;document.addEventListener('pointerover',e=>{const li=e.target.closest&&e.target.closest('li');const b=li&&li.querySelector('[data-play]');HOV=b?b.dataset.play:HOV});window.__hov=()=>HOV;
// ---- keyboard shortcuts + keyboard-emulating pedals ----
const KDEF={' ':'play','ArrowRight':'next','ArrowLeft':'prev','f':'fade','F':'fade','n':'setnext','N':'setnext','m':'marker','M':'marker','?':'help','PageDown':'next','PageUp':'prev'};
const KMAP=Object.assign({},KDEF,JSON.parse(localStorage.getItem('bp-kmap')||'{}'));
let LEARN=null;
document.addEventListener('keydown',e=>{const tg=e.target;if(tg&&(tg.tagName=='INPUT'&&!/^(range|checkbox|button)$/.test(tg.type)||tg.tagName=='TEXTAREA'||tg.tagName=='SELECT'||tg.isContentEditable))return;if(e.ctrlKey||e.metaKey||e.altKey)return;
 if(LEARN&&LEARN.type=='key'){e.preventDefault();if(e.key==='Escape'){learnEnd();return}KMAP[e.key]=LEARN.act;localStorage.setItem('bp-kmap',JSON.stringify(Object.fromEntries(Object.entries(KMAP).filter(([k,v])=>KDEF[k]!==v))));toast('⌨️ '+keyLbl(e.key)+' → '+ACTS[LEARN.act][0],2500,true);learnEnd();return}
 if(e.key==='Escape'){if($('ksh')&&$('ksh').classList.contains('on')){$('ksh').classList.remove('on');return}}
 const a=KMAP[e.key];if(!a||!ACTS[a])return;if(e.key===' '&&tg&&tg.tagName=='BUTTON')e.preventDefault();e.preventDefault();ACTS[a][1]();pcFlash(a)});
function keyLbl(k){return k===' '?'Space':k.length==1?k.toUpperCase():k.replace('Arrow','← → ↑ ↓ '.includes(k)?'':'')}
function pcFlash(a){const t=$('pcflash')||Object.assign(document.createElement('div'),{id:'pcflash',className:'pcflash'});if(!t.parentNode)document.body.appendChild(t);t.textContent=ACTS[a][0];t.classList.add('on');clearTimeout(t.t);t.t=setTimeout(()=>t.classList.remove('on'),700)}
function ksOpen(){let h=$('ksh');if(!h){h=document.createElement('div');h.id='ksh';h.className='ovl';document.body.appendChild(h);h.onclick=e=>{if(e.target===h)h.classList.remove('on')}}
 const rows=Object.keys(ACTS).map(a=>{const ks=Object.entries(KMAP).filter(([k,v])=>v===a).map(([k])=>keyLbl(k));return `<tr><td>${ACTS[a][0]}</td><td data-noi18n>${[...new Set(ks)].map(k=>`<kbd>${esc(k)}</kbd>`).join(' ')||'—'}</td></tr>`}).join('');
 h.innerHTML=`<div class="mbox" style="width:min(760px,100%)"><div class="hph"><b>⌨️ คีย์ลัด (PC)</b><button class="hw" id="kshx">✕ ปิด</button></div><table class="kst">${rows}</table><div class="small">แป้นเหยียบที่จำลองคีย์บอร์ด (PageUp/PageDown ฯลฯ) ใช้ได้ทันที · ตั้งปุ่มเองได้ที่ 🎛 MIDI/แป้นเหยียบ</div></div>`;
 $('kshx').onclick=()=>h.classList.remove('on');h.classList.add('on')}
// ---- Web MIDI + learn mode ----
const MMAP=JSON.parse(localStorage.getItem('bp-mmap')||'{}');let MIDI=null;
async function midiInit(){if(MIDI||!navigator.requestMIDIAccess)return MIDI;try{MIDI=await navigator.requestMIDIAccess();const hook=()=>{for(const i of MIDI.inputs.values())i.onmidimessage=midiMsg;midiDraw()};hook();MIDI.onstatechange=hook}catch(e){blog('warn','midi',e.message);MIDI=null}return MIDI}
function midiKey(d){const st=d[0]&0xf0;if(st===0x90&&d[2]>0)return'n'+d[1];if(st===0xb0&&d[2]>=64)return'c'+d[1];if(st===0xc0)return'p'+d[1];return null}
function midiMsg(ev){const k=midiKey(ev.data);if(!k)return;window.__lastMidi=k;if(LEARN&&LEARN.type=='midi'){MMAP[k]=LEARN.act;localStorage.setItem('bp-mmap',JSON.stringify(MMAP));toast('🎛 MIDI '+k+' → '+ACTS[LEARN.act][0],2500,true);learnEnd();return}const a=MMAP[k];if(a&&ACTS[a]){ACTS[a][1]();pcFlash(a)}}
window.__midiMsg=d=>midiMsg({data:Uint8Array.from(d)});
function learnStart(act,type){LEARN={act,type};midiDraw()}function learnEnd(){LEARN=null;midiDraw()}
function midiOpen(){let h=$('mdh');if(!h){h=document.createElement('div');h.id='mdh';h.className='ovl';document.body.appendChild(h);h.onclick=e=>{if(e.target===h){learnEnd();h.classList.remove('on')}}}h.classList.add('on');midiInit().then(midiDraw);midiDraw()}
function midiDraw(){const h=$('mdh');if(!h||!h.classList.contains('on'))return;const has=!!navigator.requestMIDIAccess,ins=MIDI?[...MIDI.inputs.values()].map(i=>i.name):[];
 const rows=Object.keys(ACTS).filter(a=>a!='help').map(a=>{const ks=Object.entries(KMAP).filter(([k,v])=>v===a).map(([k])=>keyLbl(k)),ms=Object.entries(MMAP).filter(([k,v])=>v===a).map(([k])=>k);const lk=LEARN&&LEARN.act===a;
  return `<tr><td>${ACTS[a][0]}</td><td data-noi18n>${[...new Set(ks)].map(k=>`<kbd>${esc(k)}</kbd>`).join(' ')||'—'}</td><td><button class="hw ${lk&&LEARN.type=='key'?'on':''}" data-lrk="${a}">${lk&&LEARN.type=='key'?'กดปุ่ม/แป้น…':'⌨️ ตั้ง'}</button></td>
  ${has?`<td data-noi18n>${ms.join(' ')||'—'}</td><td><button class="hw ${lk&&LEARN.type=='midi'?'on':''}" data-lrm="${a}">${lk&&LEARN.type=='midi'?'ส่ง MIDI…':'🎛 ตั้ง'}</button></td>`:''}</tr>`}).join('');
 h.innerHTML=`<div class="mbox" style="width:min(760px,100%)"><div class="hph"><b>🎛 MIDI / แป้นเหยียบ</b><button class="hw" id="mdhx">✕ ปิด</button></div>
 <div class="small">${has?(ins.length?'อุปกรณ์ MIDI: <span data-noi18n>'+esc(ins.join(', '))+'</span>':'ยังไม่พบอุปกรณ์ MIDI — เสียบแล้วรอสักครู่'):'เบราว์เซอร์นี้ไม่รองรับ Web MIDI (ใช้ Chrome/Edge บน PC/Android) — แป้นเหยียบแบบคีย์บอร์ดยังใช้ได้'}</div>
 <table class="kst"><tr><th>คำสั่ง</th><th>คีย์</th><th></th>${has?'<th>MIDI</th><th></th>':''}</tr>${rows}</table>
 <div class="row"><button class="hw" id="mdrs">↺ คืนค่าเริ่มต้น</button></div></div>`;
 $('mdhx').onclick=()=>{learnEnd();h.classList.remove('on')};$('mdrs').onclick=()=>{for(const k in KMAP)delete KMAP[k];Object.assign(KMAP,KDEF);for(const k in MMAP)delete MMAP[k];localStorage.removeItem('bp-kmap');localStorage.removeItem('bp-mmap');midiDraw()};
 h.querySelectorAll('[data-lrk]').forEach(b=>b.onclick=()=>learnStart(b.dataset.lrk,'key'));h.querySelectorAll('[data-lrm]').forEach(b=>b.onclick=()=>learnStart(b.dataset.lrm,'midi'))}
if(navigator.requestMIDIAccess&&Object.keys(MMAP).length)setTimeout(midiInit,1500);
// ---- drag & drop many files / folders to import ----
async function dtFiles(dt){const out=[];const walk=async(en)=>{if(!en)return;if(en.isFile){await new Promise(r=>en.file(f=>{out.push(f);r()},r))}else if(en.isDirectory){const rd=en.createReader();for(;;){const ch=await new Promise(r=>rd.readEntries(r,()=>r([])));if(!ch.length)break;for(const c of ch)await walk(c)}}};
 const items=[...(dt.items||[])].filter(i=>i.kind=='file');if(items.length&&items[0].webkitGetAsEntry){const ens=items.map(it=>[it.webkitGetAsEntry(),it.getAsFile()]);for(const [en,f0] of ens){if(en){const st=out.length;await walk(en);if(en.isDirectory)for(let i=st;i<out.length;i++)out[i]._dir=en.name}else f0&&out.push(f0)}}else out.push(...dt.files);return out.filter(f=>/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(f.name)||/^audio\//.test(f.type))}
let DZ=0;const dzEl=()=>$('dropz')||(()=>{const d=document.createElement('div');d.id='dropz';d.className='dropz';d.innerHTML='<div>📥 วางไฟล์เพลง / โฟลเดอร์ ที่นี่เพื่อนำเข้า</div>';document.body.appendChild(d);return d})();
addEventListener('dragenter',e=>{if(![...(e.dataTransfer&&e.dataTransfer.types||[])].includes('Files'))return;DZ++;dzEl().classList.add('on')});
addEventListener('dragleave',e=>{DZ=Math.max(0,DZ-1);if(!DZ)dzEl().classList.remove('on')});
addEventListener('dragover',e=>{if([...(e.dataTransfer&&e.dataTransfer.types||[])].includes('Files'))e.preventDefault()});
addEventListener('drop',async e=>{if(!e.dataTransfer||![...e.dataTransfer.types].includes('Files'))return;e.preventDefault();DZ=0;dzEl().classList.remove('on');const fs=await dtFiles(e.dataTransfer);if(!fs.length)return toast('ไม่พบไฟล์เสียงในสิ่งที่วาง');toast('📥 กำลังนำเข้า '+fs.length+' ไฟล์…',3000,true);await importFiles(fs)});
window.__dtFiles=dtFiles;
// ---- band view (second window) ----
let BV=null;
function bvOpen(){if(BV&&!BV.closed){BV.focus();return}BV=window.open('','bpband','width=1100,height=700');if(!BV){toast('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาต pop-up ให้เว็บนี้');return}
 BV.document.open();BV.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>SetSod – Band view</title><meta name="viewport" content="width=device-width,initial-scale=1">
 <style>body{margin:0;background:#07080a;color:#fff;font-family:system-ui,'Noto Sans Thai',sans-serif;height:100vh;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}
 .top{display:flex;justify-content:space-between;align-items:center;padding:2vh 3vw;font-size:4vh;color:#9aa0aa}.clk{font-size:6vh;font-weight:800;color:#fff;font-variant-numeric:tabular-nums}
 .mid{display:flex;flex-direction:column;justify-content:center;padding:0 3vw;gap:2vh}.lab{font-size:3vh;color:#ffb020;letter-spacing:.1em}.cur{font-size:11vh;font-weight:900;line-height:1.05}
 .sec{font-size:8vh;font-weight:800;color:#30d158}.tm{font-size:6vh;font-variant-numeric:tabular-nums;color:#cfd3da}.bar{height:1.6vh;background:#222;border-radius:1vh;overflow:hidden}.bar i{display:block;height:100%;background:#ffb020;width:0}
 .nx{padding:2.5vh 3vw;background:#15171c;font-size:6vh;font-weight:800}.nx span{color:#9aa0aa;font-size:3.4vh;font-weight:600;margin-right:2vw}.st{font-size:3.4vh;color:#ff453a}</style></head>
 <body><div class="top"><div>🎧 SetSod</div><div class="st" id="st"></div><div class="clk" id="clk">--:--</div></div>
 <div class="mid"><div class="lab">กำลังเล่น · NOW</div><div class="cur" id="cur">—</div><div class="sec" id="sec"></div><div class="tm" id="tm"></div><div class="bar"><i id="pb"></i></div></div>
 <div class="nx"><span>ถัดไป · NEXT</span><b id="nx">—</b></div></body></html>`);BV.document.close();bvTick()}
function bvState(){const now=new Date(),clk=now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});if(!cur)return{clk,cur:'—',sec:'',tm:'',pct:0,nx:'—',st:''};
 const s=SONG.get(cur.id),d=cur.buf.duration,p=pos(),mk=marks();let sec='';for(let i=0;i<mk.length;i++){const[a,b]=secOf(mk,i);if(p>=a&&p<b){sec='📍 '+mk[i].n;break}}
 const i=SET.indexOf(cur.id),nid=i>=0?SET[i+1]:null,ns=nid&&SONG.get(nid),pk=pref(cur.id),rate=(pk.tempo||100)/100,left=Math.max(0,(trE(cur.id,d)-p)/rate);
 return{clk,cur:s?s.t:'—',sec,tm:fmtT(p)+'  /  −'+fmtT(left)+(pk.key?'   คีย์ '+(pk.key>0?'+':'')+pk.key:''),pct:Math.min(100,p/d*100),nx:ns?ns.t+(ns.a?' – '+ns.a:''):'— จบลิสต์ —',st:playing?'':'⏸ หยุด'}}
function bvTick(){if(!BV||BV.closed){BV=null;return}try{const s=bvState(),D=BV.document,set=(id,v)=>{const e=D.getElementById(id);if(e&&e.textContent!==v)e.textContent=v};set('clk',s.clk);set('cur',s.cur);set('sec',s.sec);set('tm',s.tm);set('nx',s.nx);set('st',s.st);const b=D.getElementById('pb');if(b)b.style.width=s.pct+'%'}catch(e){}setTimeout(bvTick,250)}
window.__pc={get on(){return document.body.classList.contains('pcm')},apply:pcmApply,ACTS,KMAP,MMAP,bv:()=>BV,bvState,learn:learnStart,ts:()=>cur?trS(cur.id):null,cid:()=>cur&&cur.id};
setTimeout(pcmApply,300);

// ===================== b40: Lite mode + device check + offline key/tempo render =====================
const LITE={on:localStorage.getItem('bp-lite')==='1'};
const _DPR=Object.getOwnPropertyDescriptor(window,'devicePixelRatio')||null;const realDPR=()=>(_DPR&&_DPR.get?_DPR.get.call(window):1)||1;
try{Object.defineProperty(window,'devicePixelRatio',{configurable:true,get(){return LITE.on?1:realDPR()}})}catch(e){}
const _raf=window.requestAnimationFrame.bind(window);
window.requestAnimationFrame=cb=>LITE.on?setTimeout(()=>{if(!document.hidden)_raf(cb);else document.addEventListener('visibilitychange',()=>_raf(cb),{once:true})},80):_raf(cb);
function liteSet(on,why){LITE.on=!!on;localStorage.setItem('bp-lite',on?'1':'0');document.body.classList.toggle('lite',LITE.on);liteRow();try{waveDraw()}catch(e){}if(on)setTimeout(renderTick,200);if(why)toast(on?'🪶 เปิดโหมดเบาเครื่องแล้ว':'ปิดโหมดเบาเครื่องแล้ว',2500,true)}
document.body.classList.toggle('lite',LITE.on);
function liteRow(){const m=$('main');if(!m||view!='F')return;let r=$('literow');if(!r){r=document.createElement('div');r.className='sec';r.id='literow';r.innerHTML=`<button class="hw" id="litet" style="width:100%;min-height:50px;font-size:17px"></button><div class="small" id="lited"></div>`;const lb=$('langb');lb?lb.after(r):m.insertBefore(r,m.firstChild);$('litet').onclick=()=>liteSet(!LITE.on,1)}
 const b=$('litet');const t='🪶 โหมดเบาเครื่อง · ประหยัดแบต: '+(LITE.on?'เปิด':'ปิด');if(b.textContent!==t)b.textContent=t;b.classList.toggle('on',LITE.on);const d=$('lited'),dt='ลดเอฟเฟกต์/ภาพเคลื่อนไหว วาดคลื่นเสียงแบบเบา ประหยัดแบต และเรนเดอร์คีย์/ความเร็วล่วงหน้า — แนะนำสำหรับ Android รุ่นกลาง';if(d.textContent!==dt)d.textContent=dt}
new MutationObserver(()=>{if(liteRow.t)return;liteRow.t=setTimeout(()=>{liteRow.t=0;liteRow()},60)}).observe(document.body,{childList:true,subtree:true});
// ---- offline render of key/tempo-shifted audio ----
const REND=new Map(),RJOB=new Map(),RFAIL=new Map();let RW=null;const rk=(id,p)=>id+'|'+(p.key||0)+'|'+(p.tempo||100);
// 1.69.1 hotfix: a render that fails (iOS worker OOM / createBuffer error / silent worker kill) is remembered in RFAIL and never retried
// for the same song+key+tempo; finished renders are never evicted while they are the current or next song (old code could loop forever).
function rWant(){const w=new Set();if(cur){const p=pref(cur.id);if(needSh(p))w.add(rk(cur.id,p))}const i=cur?SET.indexOf(cur.id):-1,nx=i>=0?SET[i+1]:SET[0];if(nx&&SONG.get(nx)){const p=pref(nx);if(needSh(p))w.add(rk(nx,p))}return w}
function rFail(k,why){RFAIL.set(k,String(why||'fail'));const j=RJOB.get(k);RJOB.delete(k);if(j&&j.no)j.no();blog('warn','render',k+' '+why);rProg()}
function rWorker(){if(RW)return RW;try{RW=new Worker('render.js',{type:'module'});RW.onmessage=rMsg;RW.onerror=e=>{try{e.preventDefault&&e.preventDefault()}catch(_){}RW=null;for(const k of [...RJOB.keys()])rFail(k,e.message||'worker')}}catch(e){RW=null}return RW}
function rMsg(e){const d=e.data,j=RJOB.get(d.id);if(!j)return;if(d.pr!=null){j.pr=d.pr;j.tu=performance.now();rProg();return}
 if(d.err||!d.L){rFail(d.id,d.err||'empty');return}
 let ab;try{const n=d.n!=null?d.n:d.L.length;if(!n)throw new Error('len 0');ab=ctx.createBuffer(2,n,j.sr);ab.copyToChannel(n<d.L.length?d.L.subarray(0,n):d.L,0);ab.copyToChannel(n<d.R.length?d.R.subarray(0,n):d.R,1)}catch(err){rFail(d.id,err&&err.message||err);return}
 RJOB.delete(d.id);window.__rendT=Math.round(performance.now()-j.t0);REND.set(d.id,ab);rProg();
 const want=rWant();want.add(d.id);while(REND.size>2){const k=[...REND.keys()].find(k=>!want.has(k));if(!k)break;REND.delete(k)}j.ok&&j.ok(ab)}
async function renderSong(id){const p=pref(id);if(!needSh(p))return null;const k=rk(id,p);if(REND.has(k))return REND.get(k);if(RJOB.has(k))return RJOB.get(k).prom;if(RFAIL.has(k))return null;if(!rWorker())return null;
 const j={pr:0,sr:44100,id,t0:performance.now(),tu:performance.now()};j.prom=new Promise(ok=>{j.ok=ok;j.no=()=>ok(null)});RJOB.set(k,j);
 let b,L,R;try{b=await decode(id);L=b.getChannelData(0).slice();R=(b.numberOfChannels>1?b.getChannelData(1):b.getChannelData(0)).slice()}catch(err){rFail(k,'decode '+(err&&err.message||err));return null}
 if(RJOB.get(k)!==j)return j.prom;j.sr=b.sampleRate;j.tu=performance.now();rProg();
 try{RW.postMessage({id:k,L,R,key:p.key||0,tempo:(p.tempo||100)/100,sr:b.sampleRate},[L.buffer,R.buffer])}catch(err){rFail(k,'post '+(err&&err.message||err))}return j.prom}
function rProg(){let el=$('rprog');const js=[...RJOB.values()];if(!js.length){if(el)el.remove();return}if(!el){el=document.createElement('div');el.id='rprog';el.className='rprog';document.body.appendChild(el)}
 const j=js[0],s=SONG.get(j.id);el.innerHTML=`<span>🪶 เตรียมคีย์/ความเร็วล่วงหน้า</span> <b data-noi18n>${esc(s?s.t:'')}</b> <span data-noi18n>${Math.round(j.pr*100)}%</span><i style="width:${Math.round(j.pr*100)}%"></i>`}
function renderTick(){const now=performance.now();for(const [k,j] of [...RJOB.entries()])if(now-j.tu>45000){try{RW&&RW.terminate()}catch(e){}RW=null;rFail(k,'timeout')}
 if(!LITE.on||!ctx)return;const ids=[];if(cur)ids.push(cur.id);const i=cur?SET.indexOf(cur.id):-1;const nx=i>=0?SET[i+1]:SET[0];if(nx&&nxOk(nx))ids.push(nx);
 if(RJOB.size)return;for(const id of ids){if(!SONG.get(id))continue;const p=pref(id),k=rk(id,p);if(needSh(p)&&!REND.has(k)&&!RJOB.has(k)&&!RFAIL.has(k)){renderSong(id).catch(()=>{});break}}}
setInterval(renderTick,1500);
let RS=null;const _pos=pos;pos=function(){if(RS&&playing&&src&&src.buffer===RS.buf)return Math.min(cur?cur.buf.duration:1e9,(ctx.currentTime-startAt)*RS.rate);return _pos()};
const _st40=start;start=function(at){RS=null;if(!LITE.on||!cur)return _st40(at);const p=pref(cur.id);if(!needSh(p))return _st40(at);const rb=REND.get(rk(cur.id,p));
 if(!rb){renderSong(cur.id).catch(()=>{});return _st40(at)}
 const rate=(p.tempo||100)/100,a=Math.max(at??offset,typeof trS=='function'?trS(cur.id):0),ob=cur.buf,ns=needSh;needSh=()=>false;cur.buf=rb;
 try{_st40(a/rate)}finally{cur.buf=ob;needSh=ns}if(src&&src.buffer===rb)RS={buf:rb,rate};offset=a;window.__rendUsed=(window.__rendUsed||0)+1};
window.__oh=()=>openHelp();window.__lite={get on(){return LITE.on},set:liteSet,REND,RJOB,RFAIL,renderSong,get rs(){return RS},rk};
// ---- device check ----
function devInfo(){const ua=navigator.userAgent,o={ua};let m;
 if(/iPhone|iPad|iPod/.test(ua)&&(m=ua.match(/OS (\d+)[_.](\d+)/))){o.os='iOS';o.ver=+m[1]+m[2]/10}else if(m=ua.match(/Android (\d+(?:\.\d+)?)/)){o.os='Android';o.ver=parseFloat(m[1])}
 if(m=ua.match(/(?:Chrome|CriOS)\/(\d+)/))o.chrome=+m[1];o.mem=navigator.deviceMemory||null;o.cores=navigator.hardwareConcurrency||null;
 const t0=performance.now();let x=0,n=0;while(performance.now()-t0<40){for(let i=0;i<20000;i++)x+=Math.sqrt(i*1.0001)*Math.sin(i);n++}o.bench=n;o.score=Math.round(n*25);
 const why=[];if(o.os=='iOS'&&o.ver<16.4)why.push('iOS ต่ำกว่า 16.4');if(o.os=='Android'&&o.ver<10)why.push('Android ต่ำกว่า 10');if(o.mem&&o.mem<4)why.push('RAM '+o.mem+'GB');
 if(o.chrome&&o.os!='iOS'&&o.chrome<110)why.push('Chrome '+o.chrome);if(o.cores&&o.cores<=4&&o.os=='Android')why.push(o.cores+' คอร์');if(o.score<600)why.push('CPU ช้า ('+o.score+')');o.why=why;o.weak=why.length>0;return o}
window.__dev=null;
function devCheck(force){const o=window.__dev=devInfo();if(window.__devForce)Object.assign(o,window.__devForce);if(!o.weak||LITE.on)return o;if(!force&&localStorage.getItem('bp-devchk'))return o;
 if(navigator.webdriver&&!force&&!new URLSearchParams(location.search).has('dev'))return o;localStorage.setItem('bp-devchk','1');
 let h=$('devn');if(!h){h=document.createElement('div');h.id='devn';h.className='ovl';document.body.appendChild(h)}
 h.innerHTML=`<div class="mbox"><b style="font-size:19px">🪶 เครื่องนี้อาจเล่นไม่ลื่น</b><div>แนะนำให้เปิด <b>โหมดเบาเครื่อง</b> เพื่อให้เสียงไม่สะดุดและหน้าจอลื่นขึ้น</div><div class="small" data-noi18n>${esc(o.why.join(' · '))}</div>
 <button class="hw on" id="devy" style="min-height:52px;font-size:18px">🪶 เปิดโหมดเบาเครื่อง</button><button class="hw" id="devl">ไว้ทีหลัง</button><div class="small">เปลี่ยนได้ตลอดที่แท็บ ⚙️ นำเข้า · ดูสเปกแนะนำใน ❓ วิธีใช้</div></div>`;
 h.classList.add('on');$('devy').onclick=()=>{liteSet(true,1);h.classList.remove('on')};$('devl').onclick=()=>h.classList.remove('on');return o}
setTimeout(()=>{try{devCheck(new URLSearchParams(location.search).has('dev'))}catch(e){}},2500);
const _oh40=openHelp;openHelp=function(){_oh40.apply(this,arguments);const w=document.querySelector('#help .hpw');if(w&&!$('hpspec')){const d=document.createElement('details');d.id='hpspec';
 d.innerHTML=`<summary>🪶 สเปกเครื่องที่แนะนำ / โหมดเบาเครื่อง</summary><ul><li>iPhone: iOS 16.4 ขึ้นไป (iPhone XR/11 ขึ้นไปลื่นที่สุด)</li><li>Android: Android 10 ขึ้นไป, RAM 4GB ขึ้นไป, Chrome เวอร์ชันล่าสุด</li><li>PC: Chrome / Edge / Safari รุ่นล่าสุด</li><li>ถ้าเครื่องกระตุก: เปิด <b>🪶 โหมดเบาเครื่อง</b> ที่แท็บ ⚙️ นำเข้า — ปิดเอฟเฟกต์ และเตรียมเพลงที่เปลี่ยนคีย์/ความเร็วไว้ล่วงหน้า</li></ul><div class="small" data-noi18n id="hpdev"></div>`;w.appendChild(d)}
 const e=$('hpdev');if(e){const o=window.__dev||devInfo();e.textContent=`${o.os||'?'} ${o.ver||''} · Chrome ${o.chrome||'-'} · RAM ${o.mem||'?'}GB · ${o.cores||'?'} cores · CPU ${o.score}`}};
// ---- battery saving (merged into lite) ----
{const _aa=accAuto;let last=0;accAuto=function(){if(LITE.on&&Date.now()-last<600000)return;last=Date.now();return _aa.apply(this,arguments)}}
async function battCheck(){try{if(!navigator.getBattery||LITE.on)return;const b=await navigator.getBattery();const chk=()=>{if(!LITE.on&&!b.charging&&b.level<=.25&&!sessionStorage.getItem('bp-batn')){sessionStorage.setItem('bp-batn','1');
 toast('🔋 แบตเหลือ '+Math.round(b.level*100)+'% — แนะนำเปิด 🪶 โหมดเบาเครื่อง · ประหยัดแบต (แท็บ ⚙️ นำเข้า)',6000,true)}};chk();b.addEventListener('levelchange',chk);b.addEventListener('chargingchange',chk)}catch(e){}}
setTimeout(battCheck,4000);

// ===================== b41: grid clarity, per-song gain/EQ/auto-fade/notes, Pad v2 =====================
// ---- 1. grid card wording + legend ----
function gridText(){const r=$('gridr');if(!r||r.dataset.v41)return;r.dataset.v41=1;const lb=r.querySelector('.lb');if(lb)lb.firstChild.textContent='🎯 จุดเริ่มจังหวะที่ 1 (ตั้งให้เส้นห้องตรงเพลง) ';
 const h=document.createElement('div');h.className='gdhelp';h.innerHTML=`<div>เลื่อนให้เส้นส้มตรงกับ “จังหวะ 1” ของเพลง เพื่อให้เมโทรนอม/มาร์กห้องตรงเพลง</div>
 <div class="gdleg"><span><i style="background:#ffb020"></i>ส้ม = จังหวะ 1 (หัวห้อง)</span><span><i style="background:#8a8f99"></i>เทา = จังหวะอื่น</span><span><i style="background:#ff453a"></i>แดง = ตำแหน่งที่เล่นอยู่</span></div>
 <div class="gdnote">💡 เพลงที่มีไฟล์นอม (คลิก) มักไม่ต้องตั้ง — ใช้เมื่อเส้นห้องไม่ตรงเท่านั้น</div>`;lb.after(h)}
setInterval(gridText,600);
// ---- 2. per-song music chain: gain, 3-band EQ, auto fade in/out (music side only) ----
const SC={ok:false,n:[]};
function scEnsure(){if(SC.ok||!ctx||!MX.f[0]||!MX.p[0])return SC.ok;for(let c=0;c<2;c++){const lo=ctx.createBiquadFilter(),mi=ctx.createBiquadFilter(),hi=ctx.createBiquadFilter(),g=ctx.createGain(),af=ctx.createGain();
  lo.type='lowshelf';lo.frequency.value=200;mi.type='peaking';mi.frequency.value=1000;mi.Q.value=0.8;hi.type='highshelf';hi.frequency.value=4000;
  try{MX.f[c].disconnect(MX.p[c])}catch(e){}MX.f[c].connect(lo);lo.connect(mi);mi.connect(hi);hi.connect(g);g.connect(af);af.connect(MX.p[c]);SC.n[c]={lo,mi,hi,g,af}}SC.ok=true;return true}
function musicChs(id){const s=id&&SONG.get(id);return s&&(s.s=='L'||s.s=='R')?[1-clickCh(id)]:[0,1]}
function scApply(){if(!scEnsure()||!cur)return;const p=pref(cur.id),m=musicChs(cur.id),t=ctx.currentTime;for(let c=0;c<2;c++){const n=SC.n[c],on=m.includes(c);
 n.lo.gain.setTargetAtTime(on?(p.eq?p.eq[0]:0):0,t,.03);n.mi.gain.setTargetAtTime(on?(p.eq?p.eq[1]:0):0,t,.03);n.hi.gain.setTargetAtTime(on?(p.eq?p.eq[2]:0):0,t,.03);n.g.gain.setTargetAtTime(on?Math.pow(10,(p.sgn||0)/20):1,t,.03)}}
const AF={out:false};
function afReset(at){if(!SC.ok||!cur)return;const p=pref(cur.id),m=musicChs(cur.id),t=ctx.currentTime;AF.out=false;for(let c=0;c<2;c++){const g=SC.n[c].af.gain;g.cancelScheduledValues(t);
 if(m.includes(c)&&p.afi>0&&at<=(typeof trS=='function'?trS(cur.id):0)+0.3){g.setValueAtTime(0.0001,t);g.linearRampToValueAtTime(1,t+p.afi)}else g.setValueAtTime(1,t)}}
setInterval(()=>{if(!SC.ok||!cur||!playing||AF.out)return;const p=pref(cur.id);if(!(p.afo>0))return;const left=(effEnd()-pos())/((p.tempo||100)/100);if(left>p.afo||left<=0)return;AF.out=true;const t=ctx.currentTime;
 for(const c of musicChs(cur.id)){const g=SC.n[c].af.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(0.0001,t+left)}},100);
{const _s41=start;start=function(at){scEnsure();const r=_s41.apply(this,arguments);try{scApply();afReset(at??offset)}catch(e){blog('warn','sc',e.message)}try{padSongStart()}catch(e){}return r}}
window.__sc={SC,apply:scApply,musicChs,get af(){return SC.ok?SC.n.map(n=>n.af.gain.value):null}};
// ---- tool cards inside 🧰 ----
const ADVT='🧰 เครื่องมือเพิ่มเติม: ตัดหัว/ท้าย · นับเข้า · พรีวิว · บาลานซ์ · ความดัง/EQ · เฟดอัตโนมัติ · โน้ตเพลง';
function sub(id,key,title,html){let c=$(id);if(c)return c;c=document.createElement('div');c.id=id;c.className='card c26 sub41';c.innerHTML=html;accify(c,key,title,false);return c}
function advCards(){const a=$('advc');if(!a)return;const cards=[
 sub('gainc','sgain','🔊 ความดังเพลงนี้ (ฝั่งเพลง)',`<div class="row41"><button class="hw" data-sg="-1">−1 dB</button><b id="sgv" data-noi18n>0 dB</b><button class="hw" data-sg="1">+1 dB</button><button class="hw" data-sg="0">↺</button></div><div class="small">ปรับเฉพาะฝั่งเพลง ไม่แตะเสียงนอม · จำแยกแต่ละเพลง</div>`),
 sub('eqc','eq','🎚 EQ 3 ย่าน (ฝั่งเพลง)',`${['ต่ำ','กลาง','สูง'].map((n,i)=>`<label class="eq41"><span>${n}</span><input type="range" min="-12" max="12" step="1" value="0" data-eq="${i}" aria-label="${n}"><b data-noi18n id="eqv${i}">0</b></label>`).join('')}<div class="row41"><button class="hw" id="eqr">↺ รีเซ็ต EQ</button></div>`),
 sub('afc','afade','🌗 เฟดเข้า/ออกอัตโนมัติ',`<label class="row41">เฟดเข้าตอนเริ่ม <select id="afi">${[0,1,2,3,5,8].map(x=>`<option value="${x}">${x?x+' วิ':'ปิด'}</option>`).join('')}</select></label><label class="row41">เฟดออกตอนจบ <select id="afo">${[0,2,3,5,8,10].map(x=>`<option value="${x}">${x?x+' วิ':'ปิด'}</option>`).join('')}</select></label><div class="small">เฉพาะเพลงนี้ · ฝั่งเพลงเท่านั้น</div>`),
 sub('notec','note','📝 โน้ตเพลงนี้',`<textarea id="snote" rows="2" maxlength="160" placeholder="เช่น ขึ้นท่อนฮุก 2 รอบ, ส่งคิวกลอง"></textarea><div class="small">แสดงบนหัวสตูดิโอ และหน้าจอวง</div>`)];
 for(const c of cards)if(c.parentNode!==a)a.appendChild(c);
 if(!a.dataset.v41){a.dataset.v41=1;a.addEventListener('click',async e=>{const b=e.target.closest('[data-sg]');if(b&&cur){const v=b.dataset.sg=='0'?0:Math.max(-12,Math.min(12,(pref(cur.id).sgn||0)+ +b.dataset.sg));await setPref({sgn:v});scApply();advUI()}
   if(e.target.id=='eqr'&&cur){await setPref({eq:[0,0,0]});scApply();advUI()}});
  a.addEventListener('input',e=>{const i=e.target.dataset.eq;if(i!=null&&cur){const q=[...(pref(cur.id).eq||[0,0,0])];q[i]=+e.target.value;setPref({eq:q}).then(()=>{scApply();advUI()})}});
  a.addEventListener('change',e=>{if(!cur)return;if(e.target.id=='afi')setPref({afi:+e.target.value});if(e.target.id=='afo')setPref({afo:+e.target.value});if(e.target.id=='snote')setPref({nt:e.target.value.trim()}).then(noteUI)})}
 advUI()}
const stx=(e,v)=>{if(e&&e.textContent!==v)e.textContent=v};function advUI(){if(!cur)return;const p=pref(cur.id),s=$('sgv');stx(s,((p.sgn||0)>0?'+':'')+(p.sgn||0)+' dB');const q=p.eq||[0,0,0];for(let i=0;i<3;i++){const r=document.querySelector(`[data-eq="${i}"]`);if(r&&document.activeElement!==r)r.value=q[i];stx($('eqv'+i),(q[i]>0?'+':'')+q[i])}
 const fi=$('afi'),fo=$('afo');if(fi&&document.activeElement!==fi)fi.value=p.afi||0;if(fo&&document.activeElement!==fo)fo.value=p.afo||0;const n=$('snote');if(n&&document.activeElement!==n)n.value=p.nt||''}
{const _acc=accify;accify=function(el,key,title,def){return _acc(el,key,key==='adv'?ADVT:title,def)};const _ag=advGroup;advGroup=function(){_ag();if($('advc'))advCards()}}
let ADVID=null;setInterval(()=>{if(cur&&cur.id!==ADVID){ADVID=cur.id;advUI();noteUI();try{scApply()}catch(e){}}},400);
function noteUI(){const sb=document.querySelector('#studio .stbar');if(!sb)return;let n=$('sthn');const t=cur?pref(cur.id).nt||'':'';if(!n){n=document.createElement('div');n.id='sthn';n.className='sthn';n.dataset.noi18n=1;sb.after(n)}stx(n,t?'📝 '+t:'');n.style.display=t?'':'none'}
{const _bt=bvTick;bvTick=function(){_bt();try{if(!BV||BV.closed)return;const D=BV.document;let e=D.getElementById('nt');if(!e){e=D.createElement('div');e.id='nt';e.style.cssText='font-size:5vh;color:#ffd60a;font-weight:700';const s=D.getElementById('sec');s&&s.after(e)}const t=cur?pref(cur.id).nt||'':'';const v=t?'📝 '+t:'';if(e.textContent!==v)e.textContent=v}catch(e){}}}
// ---- 3. Pad v2: styles, rhythm, loop visual ----
PAD.style=localStorage.getItem('bp-pads')||'auto';
function padBpm(){if(!cur)return 100;const b=baseBpm(cur.id)||100;return b*((pref(cur.id).tempo||100)/100)}
function padStyle(){if(PAD.style!='auto')return PAD.style;return padBpm()<90?'soft':'fun'}
const mf=m=>440*Math.pow(2,(m-69)/12);
function padChord(){const tg=padTarget();if(!tg)return null;const r=((tg.k.r+tg.shift)%12+12)%12;return{r,m:tg.k.m,th:tg.k.m?3:4}}
function vox(f,type,gain,det,dest,arr){const g=ctx.createGain();g.gain.value=gain;g.connect(dest);(det||[0]).forEach(d=>{const o=ctx.createOscillator();o.type=type;o.frequency.value=f;o.detune.value=d;o.connect(g);o.start();arr.push({o,f})});return g}
function padBuild(){const ch=padChord();if(!ch)return false;const st=padStyle(),lite=typeof LITE!='undefined'&&LITE.on,t=ctx.currentTime,b=48+ch.r;PAD.st=st;PAD.osc=[];
 PAD.g=ctx.createGain();PAD.g.gain.setValueAtTime(0.0001,t);PAD.g.gain.linearRampToValueAtTime(PAD.vol*0.35,t+PAD.fi);
 PAD.flt=ctx.createBiquadFilter();PAD.flt.type='lowpass';PAD.flt.frequency.value=st=='float'?1800:st=='soft'?950:1300;PAD.flt.Q.value=0.5;
 PAD.sw=ctx.createGain();PAD.sw.gain.value=1;PAD.lfo=ctx.createOscillator();PAD.lfo.frequency.value=st=='soft'?0.06:0.1;const lg=ctx.createGain();lg.gain.value=st=='soft'?0.25:0.12;PAD.lfo.connect(lg);lg.connect(PAD.sw.gain);
 const fl=ctx.createOscillator(),fg=ctx.createGain();fl.frequency.value=0.05;fg.gain.value=st=='float'?700:300;fl.connect(fg);fg.connect(PAD.flt.frequency);fl.start();PAD.lfo.start();PAD.lfo2=fl;
 const D=lite?[0]:[-8,8],S=PAD.osc;
 // strings bed
 const notes=st=='float'?[b,b+7,b+12,b+19,b+24]:[b-12,b,b+7,b+12,b+12+ch.th];
 notes.forEach((m,i)=>vox(mf(m),st=='float'?'triangle':'sawtooth',(i==0?0.13:0.09)*(st=='fun'?0.7:1),D,PAD.flt,S).nm=m);
 PAD.vi=notes.map((m,i)=>({m:m-b,os:S.slice(i*D.length,(i+1)*D.length)}));
 // choir-like formant voice (soft/float), skipped in lite
 if(!lite&&st!='fun'){const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=800;bp.Q.value=1.4;bp.connect(PAD.sw);const cg=ctx.createGain();cg.gain.value=0.9;cg.connect(bp);
  [b+12,b+12+ch.th,b+19].forEach(m=>{vox(mf(m),'sawtooth',0.05,[-4,5],cg,S);PAD.vi.push({m:m-b,os:S.slice(-2)})})}
 PAD.flt.connect(PAD.sw);PAD.sw.connect(PAD.g);PAD.out=padCh();PAD.g.connect(MX.f[PAD.out]||ctx.destination);PAD.root2=ch.r;PAD.m2=ch.m;PAD.v=[];
 PAD.beat0=t+0.1;PAD.nextB=0;PAD.rt=null;if(st=='fun')PAD.rt=setInterval(padRhythm,60);return true}
let NZ=null;function noiseBuf(){if(NZ)return NZ;NZ=ctx.createBuffer(1,ctx.sampleRate*0.5,ctx.sampleRate);const d=NZ.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return NZ}
function padRhythm(){if(!PAD.on||!PAD.g)return;const per=60/padBpm()/2,la=ctx.currentTime+0.25,lite=typeof LITE!='undefined'&&LITE.on;
 while(PAD.beat0+PAD.nextB*per<la){const t=PAD.beat0+PAD.nextB*per,i=PAD.nextB%8;PAD.nextB++;if(t<ctx.currentTime)continue;const ch={r:PAD.root2,th:PAD.m2?3:4};
  // hat/shaker on every 8th, accent offbeats
  {const s=ctx.createBufferSource();s.buffer=noiseBuf();const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=i%2?7000:9000;const g=ctx.createGain();const a=i%2?0.05:0.025;g.gain.setValueAtTime(a,t);g.gain.exponentialRampToValueAtTime(0.0001,t+(i%2?0.09:0.05));s.connect(hp);hp.connect(g);g.connect(PAD.g);s.start(t,Math.random()*0.3,0.12)}
  // pulsing bass on 8ths (root)
  if(!lite||i%2==0){const o=ctx.createOscillator(),g=ctx.createGain(),lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=380;o.type='triangle';o.frequency.value=mf(36+ch.r);g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(i%2?0.09:0.14,t+0.015);g.gain.exponentialRampToValueAtTime(0.0001,t+per*0.9);o.connect(lp);lp.connect(g);g.connect(PAD.g);o.start(t);o.stop(t+per)}
  // chucking pluck on beats 2 & 4 (8th index 2,6)
  if(i==2||i==6){const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(2600,t);lp.frequency.exponentialRampToValueAtTime(500,t+0.12);const g=ctx.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.05,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+0.14);lp.connect(g);g.connect(PAD.g);
   (lite?[0,ch.th]:[0,ch.th,7,12]).forEach(iv=>{const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=mf(60+ch.r+iv);o.connect(lp);o.start(t);o.stop(t+0.16)})}}}
padOn=function(){initAudio();ctx.resume();if(!padTarget()){toast('🎹 ยังไม่รู้คีย์เพลงนี้ — เลือกคีย์ในการ์ด 🎹 Pad');return false}if(PAD.on)return true;if(!padBuild())return false;PAD.on=true;PAD.wait=!playing;padUI();padViz();return true};
padOff=function(sec){if(!PAD.on)return;const t=ctx.currentTime,s=sec||2,g=PAD.g,os=PAD.osc||[],l=[PAD.lfo,PAD.lfo2],rt=PAD.rt;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0.0001,t+s);
 clearInterval(rt);PAD.rt=null;setTimeout(()=>{try{os.forEach(x=>x.o.stop());l.forEach(x=>x&&x.stop());g.disconnect()}catch(e){}},s*1000+150);PAD.on=false;PAD.g=null;PAD.v=[];PAD.osc=[];padUI()};
padToggle=function(){if(PAD.on)padOff(2);else padOn()};
function padRetune2(){if(!PAD.on||!PAD.vi)return;const ch=padChord();if(!ch)return;const st=padStyle();if(st!==PAD.st){const v=PAD.vol,sd=PAD.sid,wt=PAD.wait;PAD.re=1;padOff(1.5);setTimeout(()=>{PAD.re=0;if(!PAD.on){PAD.sid=sd;if(padOn()!==false)PAD.wait=wt;else PAD.sid=null}},300);return}
 if(ch.r===PAD.root2&&ch.m===PAD.m2)return;const t=ctx.currentTime,b=48+ch.r,old=PAD.m2;PAD.vi.forEach(v=>{let m=v.m;if(old!==ch.m){if(m%12==(old?3:4))m+=ch.m?-1:1}v.m=m;v.os.forEach(x=>x.o.frequency.setTargetAtTime(mf(b+m),t,0.1))});PAD.root2=ch.r;PAD.m2=ch.m;PAD.root=ch.r;PAD.m=ch.m;padUI()}
setInterval(padRetune2,250);
function padSongStart(){if(PAD.on&&PAD.wait&&localStorage.getItem('bp-padend')!=='keep'){PAD.wait=false;padOff(+(localStorage.getItem('bp-padxf')||4))}}
// loop visual over the waveform
function padViz(){const wb=document.querySelector('#studio .wavebox');if(!wb)return;let cv=$('padviz');if(!cv){cv=document.createElement('canvas');cv.id='padviz';cv.className='padviz';wb.appendChild(cv)}
 const draw=()=>{if(!PAD.on){cv.style.display='none';return}cv.style.display='';if(!document.hidden){const r=devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==Math.round(w*r)){cv.width=w*r;cv.height=h*r}const g=cv.getContext('2d');g.clearRect(0,0,cv.width,cv.height);
  const per=60/padBpm(),bar=per*4,ph=(((ctx.currentTime-PAD.beat0)/bar)%1+1)%1,cy=cv.height/2,R=Math.min(cv.width/2,cy)*0.62,cx=cv.width/2-R-60*r;
  g.fillStyle='rgba(10,10,14,.55)';g.fillRect(0,0,cv.width,cv.height);g.lineWidth=6*r;g.strokeStyle='rgba(255,255,255,.12)';g.beginPath();g.arc(cx,cy,R,0,7);g.stroke();
  const grad=g.createLinearGradient(cx-R,0,cx+R,0);grad.addColorStop(0,'#5e5ce6');grad.addColorStop(1,'#30d158');g.strokeStyle=grad;g.lineCap='round';g.beginPath();g.arc(cx,cy,R,-Math.PI/2,-Math.PI/2+ph*Math.PI*2);g.stroke();
  for(let i=0;i<4;i++){const a=-Math.PI/2+i*Math.PI/2,on=Math.floor(ph*4)==i;g.fillStyle=on?'#ffd60a':'rgba(255,255,255,.35)';g.beginPath();g.arc(cx+R*Math.cos(a),cy+R*Math.sin(a),(on?7:4)*r,0,7);g.fill()}
  const tx=cx+R+16*r;g.fillStyle='#fff';g.textAlign='left';g.font=`700 ${16*r}px system-ui`;g.fillText('Pad · '+({soft:'นุ่ม',fun:'สนุก',float:'ลอยๆ'}[PAD.st]||''),tx,cy-3*r);g.font=`${13*r}px system-ui`;g.fillStyle='#e5e7eb';g.fillText((PAD.wait?'วนรอเพลง…':'เล่นคลอเพลง')+'  '+Math.round(padBpm())+' BPM',tx,cy+16*r)}
  requestAnimationFrame(draw)};draw()}
// style chooser in pad card
function padStyleUI(){const c=$('padc');if(!c||$('pads'))return;const d=document.createElement('div');d.className='row41';d.innerHTML=`<span class="small">สไตล์</span>${[['auto','อัตโนมัติ'],['soft','นุ่ม'],['fun','สนุก'],['float','ลอยๆ']].map(([k,n])=>`<button class="hw ${PAD.style==k?'on':''}" data-pst="${k}">${n}</button>`).join('')}`;d.id='pads';
 const t=c.querySelector('.row');t?t.after(d):c.appendChild(d);const e=document.createElement('label');e.className='row41 small';e.innerHTML=`เมื่อเพลงเริ่ม <select id="padend"><option value="fade">เฟด Pad ออก</option><option value="keep">เล่น Pad ต่อ</option></select>`;d.after(e);$('padend').value=localStorage.getItem('bp-padend')||'fade';$('padend').onchange=ev=>localStorage.setItem('bp-padend',ev.target.value);d.onclick=e=>{const b=e.target.closest('[data-pst]');if(!b)return;PAD.style=b.dataset.pst;localStorage.setItem('bp-pads',PAD.style);d.querySelectorAll('[data-pst]').forEach(x=>x.classList.toggle('on',x===b));padRetune2()}}
setInterval(padStyleUI,700);
window.__pad2={get s(){return{on:PAD.on,st:PAD.st,style:PAD.style,root:PAD.root2,m:PAD.m2,n:(PAD.osc||[]).length,wait:PAD.wait,out:PAD.out,rt:!!PAD.rt}},padStyle,padBpm};
window.__pad.on=padOn;window.__pad.off=padOff;

// ---- v42: user folders (one song in many folders; kv 'folders' {list:[{id,name,created}],mem:{fileName:[ids]}}) ----
const fldSave=()=>put('kv',{k:'folders',v:FLD}).catch(e=>blog('error','folders save',e.message));
const fldOf=n=>(FLD.mem[n]||[]).filter(id=>FLD.list.some(f=>f.id==id));
const fldName=id=>(FLD.list.find(f=>f.id==id)||{}).name||'';
function fldOk(s){if(!FSEL)return true;const f=fileOf(s);if(!f)return false;const a=fldOf(f);return FSEL=='_none'?!a.length:a.includes(FSEL)}
function fldBtn(n){const a=fldOf(n);return `<button class="add fldb${a.length?' on':''}" data-fld="${esc(n)}" title="โฟลเดอร์" aria-label="โฟลเดอร์">📁${a.length?'<small>'+a.length+'</small>':''}</button>`}
function fldCount(id){let c=0;for(const n of FILES.keys()){const a=fldOf(n);if(id=='_none'?!a.length:a.includes(id))c++}return c}
function fldBar(){if(!FLD.list.length&&!FSEL)return '';const o=[['','📁 ทั้งหมด'],['_none','ไม่มีโฟลเดอร์ ('+fldCount('_none')+')'],...FLD.list.map(f=>[f.id,'📁 '+f.name+' ('+fldCount(f.id)+')'])];
 return `<div class="row fldbar" style="padding:6px 10px"><select id="fsel" aria-label="กรองตามโฟลเดอร์" style="flex:1;min-height:44px;font-size:17px;background:#1c1c1e;color:#fff;border:1px solid #3a3a3c;border-radius:12px;padding:0 10px">${o.map(([k,l])=>`<option value="${esc(k)}"${k==FSEL?' selected':''}>${esc(l)}</option>`).join('')}</select></div>`}
function fldMgr(){const t=FTGT||[];return `<div class="sec fldm" style="padding:8px 0"><h2 style="font-size:19px">📁 โฟลเดอร์ของฉัน (${FLD.list.length})</h2>
 <div class="row"><button id="fnew" class="hw">＋ สร้างโฟลเดอร์</button></div>
 <ul class="fldl">${FLD.list.map(f=>`<li data-fid="${esc(f.id)}" style="grid-template-columns:1fr auto auto!important"><div class="i" style="flex:1 1 auto!important;width:auto!important;max-width:none!important;min-width:0"><div class="t">📁 ${esc(f.name)}</div><div class="a">${fldCount(f.id)} เพลง</div></div><button class="add" style="flex:0 0 52px!important;width:52px!important;min-width:52px" data-fx="ren" data-fid="${esc(f.id)}" title="เปลี่ยนชื่อ">✏️</button><button class="add" style="flex:0 0 52px!important;width:52px!important;min-width:52px" data-fx="del" data-fid="${esc(f.id)}" title="ลบโฟลเดอร์">🗑</button></li>`).join('')||'<li class="small empty">ยังไม่มีโฟลเดอร์ — เพลงทั้งหมดอยู่ใน “ไม่มีโฟลเดอร์”</li>'}</ul>
 ${FLD.list.length?`<div class="small" style="margin-top:6px">นำเข้าไปที่โฟลเดอร์ (เลือกได้หลายโฟลเดอร์):</div><div class="row ftgt">${FLD.list.map(f=>`<label class="btn hw" style="min-height:40px"><input type="checkbox" data-ftg="${esc(f.id)}"${t.includes(f.id)?' checked':''}> ${esc(f.name)}</label>`).join('')}</div>`:''}
 <div class="small">💡 ลากโฟลเดอร์มาวาง = สร้าง/ใช้โฟลเดอร์ชื่อเดียวกันให้อัตโนมัติ · ลบโฟลเดอร์ไม่ลบเพลง</div></div>`}
function fldNew(name){name=String(name||'').trim().slice(0,60);if(!name)return null;const ex=FLD.list.find(f=>f.name==name);if(ex)return ex.id;const id='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);FLD.list.push({id,name,created:Date.now()});return id}
function fldAdd(n,ids){const a=new Set(fldOf(n));ids.forEach(i=>a.add(i));if(a.size)FLD.mem[n]=[...a]}
function fldOpen(n){let el=$('fldo');if(!el){el=document.createElement('div');el.id='fldo';el.className='ovl';document.body.appendChild(el);el.onclick=e=>{if(e.target===el)el.classList.remove('on')}}
 const a=fldOf(n),dr=()=>{const a=fldOf(n);el.innerHTML=`<div class="sec" style="max-width:480px;width:100%;max-height:85vh;overflow:auto;background:var(--card,#1c1c1e);border-radius:14px;padding:14px"><h2>📁 โฟลเดอร์ของเพลง</h2><div class="small" style="word-break:break-all">${esc(n.replace(/^web:/,''))}</div>
 <div class="fmo" style="display:flex;flex-direction:column;gap:6px;margin:10px 0">${FLD.list.map(f=>`<label style="display:flex;gap:10px;align-items:center;font-size:18px;min-height:44px"><input type="checkbox" style="width:24px;height:24px" data-fm="${esc(f.id)}"${a.includes(f.id)?' checked':''}> ${esc(f.name)}</label>`).join('')||'<div class="small">ยังไม่มีโฟลเดอร์</div>'}</div>
 <div class="row"><button id="fmn" class="hw">＋ โฟลเดอร์ใหม่</button><button id="fmx" style="flex:1">✓ เสร็จ</button></div></div>`;
  el.querySelectorAll('[data-fm]').forEach(c=>c.onchange=async()=>{const s=new Set(fldOf(n));c.checked?s.add(c.dataset.fm):s.delete(c.dataset.fm);if(s.size)FLD.mem[n]=[...s];else delete FLD.mem[n];await fldSave()});
  $('fmn').onclick=async()=>{const id=fldNew(prompt('ชื่อโฟลเดอร์ใหม่'));if(!id)return;fldAdd(n,[id]);await fldSave();dr()};$('fmx').onclick=()=>{el.classList.remove('on');render()}};dr();el.classList.add('on')}
document.addEventListener('click',async e=>{const t=e.target.closest('[data-fld],[data-fx],#fnew');if(!t)return;e.stopPropagation();
 if(t.id=='fnew'){const id=fldNew(prompt('ชื่อโฟลเดอร์ใหม่'));if(!id)return;await fldSave();toast('📁 สร้างโฟลเดอร์แล้ว',1500,true);render();return}
 if(t.dataset.fld!=null)return fldOpen(t.dataset.fld);
 const id=t.dataset.fid,f=FLD.list.find(x=>x.id==id);if(!f)return;
 if(t.dataset.fx=='ren'){const nm=String(prompt('เปลี่ยนชื่อโฟลเดอร์',f.name)||'').trim().slice(0,60);if(!nm||nm==f.name)return;f.name=nm;await fldSave();render()}
 else if(t.dataset.fx=='del'){if(!confirm('ลบโฟลเดอร์ “'+f.name+'”? (เพลงไม่ถูกลบ)'))return;FLD.list=FLD.list.filter(x=>x.id!=id);for(const k in FLD.mem){FLD.mem[k]=FLD.mem[k].filter(x=>x!=id);if(!FLD.mem[k].length)delete FLD.mem[k]}if(FSEL==id){FSEL='';localStorage.setItem('bp-fsel','')}if(FTGT)FTGT=FTGT.filter(x=>x!=id);await fldSave();toast('🗑 ลบโฟลเดอร์แล้ว — เพลงยังอยู่ครบ',2000,true);render()}},true);
document.addEventListener('change',e=>{const t=e.target;if(t.id=='fsel'){FSEL=t.value;localStorage.setItem('bp-fsel',FSEL);render()}else if(t.dataset&&t.dataset.ftg){const s=new Set(FTGT||[]);t.checked?s.add(t.dataset.ftg):s.delete(t.dataset.ftg);FTGT=[...s]}});
{const _imp=importFiles;importFiles=async function(fs){fs=[...fs];const tg=FTGT&&FTGT.length?FTGT:(FSEL&&FSEL!='_none'?[FSEL]:[]);const dirs={};for(const f of fs)if(f._dir&&!dirs[f._dir])dirs[f._dir]=fldNew(f._dir);
 const r=await _imp(fs);let ch=Object.keys(dirs).length>0;for(const f of fs){if(!FILES.has(f.name))continue;const ids=f._dir&&dirs[f._dir]?[dirs[f._dir]]:[...tg];if(ids.length){fldAdd(f.name,ids);ch=true}}
 if(ch){await fldSave();render()}return r}}
window.__fld={get:()=>FLD,imp:fs=>importFiles(fs)};

// ---- v1.43: log why the page (re)started — app reload vs. OS killing the tab (memory) ----
// v1.83.8: not a kill when nothing was playing/loaded, or the app just updated (version changed / SW reload / update flag)
function k838(a,rl){const idle=!a.p&&!a.cur,upd=(a.v&&a.v!==APPV)||(rl&&Date.now()-rl.t<6e5)||localStorage.getItem('bp-upd-show')=='1'||(+localStorage.getItem('bp-swc')||0)>Date.now()-6e5;window.__k838={idle,upd:!!upd};return idle||!!upd}
try{if('serviceWorker' in navigator){const had=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!had)return;try{localStorage.setItem('bp-swc',Date.now())}catch(e){}})}}catch(e){}
(function(){try{const nav=(performance.getEntriesByType('navigation')[0]||{}).type||'';const rl=JSON.parse(localStorage.getItem('bp-rl')||'null');localStorage.removeItem('bp-rl');
 const alive=JSON.parse(localStorage.getItem('bp-alive')||'null');
 window.__alv847=alive;window.__rlk847=rl;
 if(rl&&Date.now()-rl.t<60000)blog('info','start after app reload: '+rl.r);
 else if(alive&&alive.h&&alive.p&&Date.now()-alive.t<6*36e5)window.__alive83=alive,window.__kbg84=Date.now(),blog('warn','start after background end (screen off/app hidden while playing) cur='+(alive.cur||''));
 else if(alive&&!alive.h&&Date.now()-alive.t<120000&&k838(alive,rl))blog('info','start after idle/update end (not counted as kill) v'+(alive.v||'?')+'→'+APPV+' play='+(alive.p?1:0)+' cur='+(alive.cur||''));
 else if(alive&&!alive.h&&Date.now()-alive.t<120000)window.__alive83=alive,window.__kill83=Date.now(),window.__st83=localStorage.getItem('bp-state'),blog('warn','start after unexpected end (tab killed / crash?) nav='+nav+' lastCache='+alive.c+' rend='+alive.r+' eng='+alive.e+' lastCue='+(alive.q||'')+' cur='+(alive.cur||''));
 else if(nav=='reload')blog('info','start after manual reload');
 else blog('info','start nav='+nav+(alive?' alive '+Math.round((Date.now()-alive.t)/1000)+'s ago':''));
 const T0=Date.now();const beat=()=>{try{if(document.visibilityState!='visible'&&!playing&&!cur){localStorage.removeItem('bp-alive');return}const hd=document.visibilityState!='visible',bf=cur&&cache.get(cur.id),fn=cur&&(cur.fn||cur.id)||'';let hp=0;try{hp=performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):0}catch(e){}
  localStorage.setItem('bp-alive',JSON.stringify({t:Date.now(),c:cache.size,r:REND.size,e:window.__stw&&__stw.kind,q:cue,cur:cur&&cur.id,h:hd?1:0,p:playing?1:0,u:Math.round((Date.now()-T0)/1000),d:Math.round(window.__dur84||0),f:(String(fn).match(/\.(\w{2,4})$/)||[])[1]||'',lo:typeof MEM83!='undefined'&&MEM83.lo?1:0,hp,vw:typeof view!='undefined'?view:'',v:APPV}))}catch(e){}};beat();setInterval(beat,5000);
 const cl=()=>{try{localStorage.removeItem('bp-alive')}catch(e){}};addEventListener('pagehide',cl);addEventListener('beforeunload',cl);addEventListener('pageshow',beat);
 document.addEventListener('visibilitychange',()=>{beat();if(document.visibilityState=='visible'&&playing)getWake()})}catch(e){}})();// v1.83.4: heartbeat kept while hidden (h:1) so background ends are told apart from foreground kills; wake lock re-taken on return
window.__initAudio=()=>initAudio();window.__mem=()=>({cache:cache.size,rend:REND.size,peaks:PEAKS.size});

// ---------- v1.52 live shared setlists ----------
// live/{id} = {v:1,n,o:[songKey..],s:{songKey: JSON row like v:2 share},t}. Each song is its own map field → last-write-wins per song.
// LIVE (localStorage bp-livesl) = {id,o:last remote order,last:{k:remote str},mine:{k:local str after apply/push}}. Push only when local differs from mine → no echo loops.
const LVK='bp-livesl';const lvP=()=>LIVE&&(LIVE.p||LIVE.id);let LIVE=null;try{LIVE=JSON.parse(localStorage.getItem(LVK)||'null');if(LIVE&&!/^[0-9A-Za-z]{14}$/.test(LIVE.id||''))LIVE=null }catch(e){LIVE=null}
let LVUN=null,LVST='',LVREADY=false,LVBUSY=false,LVUSER=0,LVFROM=0,LVPEND=null;const LVMAP=new Map();const LVEDIT=new Map();
// LVUSER: 0=no user edit, 1=field (key/tempo/นอม/note), 2=list add/del/reorder. Auto apply/reload must not push list contents.
// LVEDIT: per-song field names the user actually changed. Reorder must never push a full local entry.
function lvEdit(id,fields){if(LVFROM||!id)return;const o=LVEDIT.get(id)||{};const arr=Array.isArray(fields)?fields:(fields&&typeof fields==='object'&&!Array.isArray(fields)?Object.keys(fields):[fields]);for(let i=0;i<arr.length;i++){const f=arr[i];if(f)o[f]=1}LVEDIT.set(id,o)}
function lvEditClr(){LVEDIT.clear()}
function lvUserClr(){LVUSER=0;lvEditClr();try{localStorage.removeItem('bp-lvuser')}catch(e){}}
function lvUserRest(){try{const o=JSON.parse(localStorage.getItem('bp-lvuser')||'null');if(o&&LIVE&&o.id===LIVE.id)LVUSER=o.v|0}catch(e){}}
try{lvUserRest()}catch(e){}

function lvSave(){try{if(LIVE)localStorage.setItem(LVK,JSON.stringify(LIVE));else localStorage.removeItem(LVK)}catch(e){}}
const lvMod=async()=>window.__slMod||await import('./cloud.js');
function lvEntry(id){const s=SONG.get(id)||{},p=stuMask(id,pref(id));return JSON.stringify([s.t||'',s.a||'',p.key||0,p.tempo||100,SNOTE[id]||'','',0,slX(id)])}
function lvParseRow(str){try{const r=JSON.parse(str);if(Array.isArray(r)){const a=r.slice();while(a.length<8)a.push(null);if(!a[7]||typeof a[7]!=='object'||Array.isArray(a[7]))a[7]={};else a[7]=Object.assign({},a[7]);return a}}catch(e){}return null}
function lvPatchEntry(baseStr,id,fields){
  const r=lvParseRow(baseStr)||lvParseRow(lvEntry(id))||['','',0,100,'','',0,{}];
  const s=SONG.get(id)||{},p=pref(id),sl=slX(id);
  if(fields.key)r[2]=p.key||0;
  if(fields.tempo)r[3]=p.tempo||100;
  if(fields.note)r[4]=SNOTE[id]||'';
  if(fields.ti)r[0]=s.t||'';
  if(fields.ar)r[1]=s.a||'';
  const skip={key:1,tempo:1,note:1,ti:1,ar:1};
  Object.keys(fields||{}).forEach(function(f){
    if(skip[f])return;
    if(f==='swap'){if(p.swap)r[7].swap=true;else delete r[7].swap;return}
    if(sl[f]!=null&&sl[f]!==false&&sl[f]!=='')r[7][f]=sl[f];else delete r[7][f];
  });
  return JSON.stringify(r);
}
async function lvRebase(d){
  if(!LIVE||!d)return;
  const S=d.s&&typeof d.s=='object'?d.s:{};
  for(const k of Object.keys(S)){
    if(typeof S[k]!=='string')continue;
    LIVE.last[k]=S[k];
    const id=LVMAP.get(k);
    if(!(id&&LVEDIT.has(id)))LIVE.mine[k]=S[k];
  }
  try{lvSave()}catch(e){}
}
async function lvKeyOf(id){for(const [k,v] of LVMAP)if(v===id)return k;const s=SONG.get(id)||{},T=nk(s.t||''),A=nk(s.a||'');
 if(LIVE){let hit='',hitA='';const src=k=>(LIVE.last&&LIVE.last[k])||(LIVE.mine&&LIVE.mine[k])||(LIVE.__d&&LIVE.__d.s&&LIVE.__d.s[k]);
  for(const k of (LIVE.o||[])){if(LVMAP.get(k)&&LVMAP.get(k)!==id)continue;try{const r=JSON.parse(src(k)||'');if(!Array.isArray(r)||nk(r[0]||'')!==T)continue;if(A&&nk(r[1]||'')===A){hitA=k;break}if(!hit)hit=k}catch(e){}}
  const reuse=hitA||hit;if(reuse){LVMAP.set(reuse,id);return reuse}}
 const k='k'+await slId(nk(s.t||id)+'|'+nk(s.a||''),10);if(!LVMAP.has(k))LVMAP.set(k,id);return k}
function lvRand(){const b=crypto.getRandomValues(new Uint8Array(14));return [...b].map(x=>B62[x%62]).join('')}
function lvState(st){if(st===LVST)return;LVST=st;lvBar(true)}
const LVTXT={ok:'📻 ลิสต์สด · ซิงก์แล้ว',off:'📴 ลิสต์สด · ออฟไลน์ (จะซิงก์เมื่อมีเน็ต)',pend:'🔄 ลิสต์สด · กำลังส่ง…',wait:'🔄 ลิสต์สด · กำลังเชื่อมต่อ…',gone:'⚠️ ลิสต์สด · ไม่พบลิสต์นี้'};
function lvBar(force){const m=$('main');let b=$('lvbar')||lvBar.el;if(!LIVE||view!='S'||!m){if(b)b.remove();if(!LIVE)lvBar.el=null;return}
 if(b&&!m.contains(b)&&b.dataset.k===lvP()+'|'+(LIVE.bn||'')){m.prepend(b)}if(!b||!m.contains(b)){if(b)b.remove();b=document.createElement('div');b.dataset.k=lvP()+'|'+(LIVE.bn||'');b.id='lvbar';b.className='lvbar';b.innerHTML=`<span id="lvtx" class="lvtx"></span>${LIVE.b?`<span class="small lvcode" data-noi18n>👥 ${esc(LIVE.bn||'')}</span><span id="lvro" class="small"></span>`:`<span class="small lvcode" data-noi18n data-noicon>${LIVE.id}</span>`}<button id="lvlv" class="hw">✕ เลิกซิงก์</button>`;m.prepend(b);lvBar.el=b;
  if($('lvcp'))$('lvcp').onclick=()=>slCopy(SLB()+'#l='+LIVE.id,'📋 คัดลอกลิงก์แล้ว');$('lvlv').onclick=()=>{if(confirm('เลิกซิงก์ลิสต์สด? (ลิสต์คืนนี้ในเครื่องยังอยู่)')){if(LIVE&&LIVE.b)try{localStorage.setItem('bp-bdoff',LIVE.id)}catch(e){}lvLeave()}};force=true}
 {const r=$('lvro'),rt=LIVE.ro?'👁 ดูอย่างเดียว':'';if(r&&r.dataset.t!==rt){r.dataset.t=rt;r.textContent=rt}}const t=LVTXT[LVST]||LVTXT.wait;if(force||b.dataset.st!==LVST){b.dataset.st=LVST;b.className='lvbar lv-'+(LVST||'wait');$('lvtx').textContent=t}}
async function lvApply(d){if(!LIVE)return;if(!d){lvState('gone');try{setTimeout(()=>{try{bdNudge()}catch(e){}},500)}catch(e){}return}
 const o=Array.isArray(d.o)?d.o.filter(k=>typeof k=='string'):[],S=d.s&&typeof d.s=='object'?d.s:{};let chg=false,curCh=null;const notes={};
 // v1.0.54: local list add/del/reorder in flight — never let a stale remote `o` rewrite SET or clear LVUSER
 // (that race put removed songs back and cancelled the pending band push within the 600ms debounce)
 const holdList=LVUSER>=2;
 for(const k of o){if(!LVMAP.has(k)&&typeof S[k]=='string'){try{const r=JSON.parse(S[k]);const x=r[7]&&typeof r[7]=='object'&&!Array.isArray(r[7])?r[7]:null;const id=slMatch(r[0],r[1],x&&x.sd);if(id&&![...LVMAP.values()].includes(id))LVMAP.set(k,id);else if(!id)LVMAP.set(k,null)}catch(e){}}}
 for(const k of o){const id=LVMAP.get(k),str=S[k];if(!id||typeof str!='string'||LIVE.last[k]===str)continue;let r;try{r=JSON.parse(str)}catch(e){continue}
  const x=r[7]&&typeof r[7]=='object'&&!Array.isArray(r[7])?r[7]:{};const {sd,id:_i,...rest}=x;const p={id,...rest,key:Math.max(-12,Math.min(12,+r[2]||0)),tempo:Math.max(25,Math.min(200,+r[3]||100))};
  const old=pref(id);PREF.set(id,p);await tx('prefs','readwrite',s=>s.put(p));if(r[4])SNOTE[id]=String(r[4]).slice(0,300);else delete SNOTE[id];
  if(cur&&cur.id==id&&(old.key!==p.key||old.tempo!==p.tempo||!!old.swap!==!!p.swap))curCh=p;
  LIVE.last[k]=str;LIVE.mine[k]=lvEntry(id);chg=true}
 if(!holdList){
  const ordCh=JSON.stringify(o)!==JSON.stringify(LIVE.o||[]);if(ordCh){LIVE.o=o;chg=true}
  const nw=[];for(const k of o){const id=LVMAP.get(k);if(id&&!nw.includes(id))nw.push(id)}
  if(nw.join()!==SET.join()){SET=nw;try{localStorage.setItem('bp-set',JSON.stringify({v:SET,t:Date.now()}))}catch(e){}await tx('kv','readwrite',s=>s.put({k:'set',v:SET}));chg=true}
  for(const k of Object.keys(LIVE.last))if(!(k in S)){delete LIVE.last[k];delete LIVE.mine[k]}
 }
 if(chg){try{await tx('kv','readwrite',s=>s.put({k:'snote',v:SNOTE}))}catch(e){}}
 LVREADY=true;lvSave();
 if(curCh){LVFROM=1;try{await setPref({key:curCh.key,tempo:curCh.tempo,swap:!!curCh.swap})}catch(e){}finally{LVFROM=0}}
 window.__lvSetApplied=1;
 if(holdList){lvSave();lvDirty(80);return}
 lvUserClr();lvSave();
 if(chg){lvRender();lvApply.n=(lvApply.n||0)+1;if(LVST&&LVREADY&&lvApply.n>1)toast('🔄 ลิสต์สดอัปเดตจากวง',1500,true)}}
function lvDirty(ms){if(!LIVE||!LVREADY)return;clearTimeout(lvDirty.t);lvDirty.t=setTimeout(()=>lvPush().catch(e=>blog('warn','live push',e.message||String(e))),ms!=null?ms:600)}
function lvUser(k){if(LVFROM)return;LVUSER=Math.max(LVUSER,k=='list'?2:1);try{if(LIVE)localStorage.setItem('bp-lvuser',JSON.stringify({id:LIVE.id,v:LVUSER}))}catch(e){}lvDirty(k=='list'?120:600)}
async function lvPush(){if(!LIVE||!LVREADY||!LVUSER)return;if(LVBUSY){lvDirty(200);return}if(!window.__lvSetApplied&&!(LIVE.last&&Object.keys(LIVE.last).length))return;if(LIVE.ro){if(!lvPush.w){lvPush.w=1;toast('👁 คุณเป็นผู้ชมในวงนี้ — แก้ไขได้เฉพาะในเครื่อง ไม่ส่งขึ้นวง',3000)}return}LVBUSY=true;try{
 if(LVPEND){const pend=LVPEND;LVPEND=null;try{await lvRebase(pend)}catch(e){}}
 const keys=[],set={},del=[];
 for(const id of SET){
  if(!SONG.get(id))continue;const k=await lvKeyOf(id);if(keys.includes(k))continue;keys.push(k);
  const isNew=!(LIVE.o||[]).includes(k)&&!(LIVE.last&&LIVE.last[k])&&!(LIVE.mine&&LIVE.mine[k]);
  if(isNew&&LVUSER>=2){set[k]=lvEntry(id);continue}
  const fields=LVEDIT.get(id);
  if(fields){const patched=lvPatchEntry(LIVE.last[k]||LIVE.mine[k],id,fields);if(patched!==(LIVE.last[k]||LIVE.mine[k]))set[k]=patched}
 }
 const res=[...keys];let prev=null;for(const k of (LIVE.o||[])){const id=LVMAP.get(k);if(!id&&!res.includes(k)){const i=prev?res.indexOf(prev):-1;res.splice(i+1,0,k)}if(res.includes(k))prev=k;if(id&&!keys.includes(k))del.push(k)}
 let oc=JSON.stringify(res)!==JSON.stringify(LIVE.o||[]);
 if(LVUSER<2){for(const k of Object.keys(set))if(!(LIVE.o||[]).includes(k))delete set[k];del.length=0;oc=false}
 if(!oc&&!Object.keys(set).length&&!del.length){lvUserClr();return}
 if(res.length>200){toast('⚠️ ลิสต์สดรองรับสูงสุด 200 เพลง');return}
 const D848=lv848d(set,del,oc?res:(LIVE.o||[]));for(const k in set){LIVE.mine[k]=set[k];LIVE.last[k]=set[k]}for(const k of del){delete LIVE.mine[k];delete LIVE.last[k];LVMAP.delete(k)}if(oc)LIVE.o=res;lvSave();
 const m=await lvMod();
 try{await m.liveUpd(lvP(),{o:oc?res:null,set,del});lvUserClr()}
 catch(e){blog('warn','live upd',e.code||e.message);if(/permission/.test(e.code||''))toast('⚠️ ซิงก์ลิสต์สดไม่สำเร็จ');else lvDirty(400)}
 if(D848.length)q848(LIVE.b,'live',LIVE.n||(LIVE.__d&&LIVE.__d.n)||'','t',D848);else lv70()}finally{LVBUSY=false}}
async function lvSub(){if(!LIVE)return;if(LVUN){try{LVUN()}catch(e){}LVUN=null}lvState(navigator.onLine?'wait':'off');
 try{const m=await lvMod();const id=lvP();LVUN=await m.liveSub(id,(d,meta)=>{if(!LIVE||lvP()!==id)return;lvState(meta.fromCache?(d?'off':(navigator.onLine?'wait':'off')):meta.hasPendingWrites?'pend':(d?'ok':'gone'));if(meta.hasPendingWrites||(meta.fromCache&&!d))return;if(LVBUSY){LVPEND=d;return}lvApply(d).catch(e=>blog('warn','live apply',e.message))},e=>{blog('warn','live sub',e.code||e.message);lvState('off');setTimeout(()=>{if(LIVE&&lvP()===id)lvSub()},15000)})}catch(e){blog('warn','live init',e.message||String(e));lvState('off');setTimeout(()=>{if(LIVE)lvSub()},15000)}}
async function lvStart(opt){opt=opt||{};if(LIVE&&!opt.b&&!LIVE.b)return SLB()+'#l='+LIVE.id;if(LIVE&&!opt.b&&LIVE.b){toast('ลิสต์นี้ซิงก์กับวงอยู่ — เลิกซิงก์ก่อนจึงแชร์แบบสาธารณะได้');return null}if(LIVE&&opt.b){if(!confirm('เลิกซิงก์ลิสต์ปัจจุบัน แล้วแชร์ลิสต์คืนนี้เข้าวง?'))return null;lvLeave(1)}if(!SET.length){toast('ยังไม่มีเพลงในคืนนี้');return null}if(!navigator.onLine){toast('📴 ต้องต่อเน็ตเพื่อสร้างลิสต์สด');return null}
 try{const m=await lvMod();const id=lvRand(),o=[],S={};LVMAP.clear();for(const sid of SET){if(!SONG.get(sid))continue;const k=await lvKeyOf(sid);if(o.includes(k))continue;o.push(k);S[k]=lvEntry(sid)}
  const pth=opt.b?'bands/'+opt.b+'/lists/'+id:null;await m.liveCreate(pth||id,{n:String(opt.n||SNOTE._name||'').slice(0,200),o,s:S});LIVE={id,o,last:{...S},mine:{...S},own:1};if(pth){LIVE.p=pth;LIVE.b=opt.b;LIVE.bn=opt.bn||''}LVREADY=true;window.__lvSetApplied=1;lvSave();lvSub();lvBar(true);toast(pth?'👥 แชร์ลิสต์เข้าวงแล้ว — สมาชิกเห็นทันที':'📻 สร้างลิสต์สดแล้ว — ส่งลิงก์ให้วงได้เลย',2500,true);return pth?id:SLB()+'#l='+id}
 catch(e){blog('warn','live create',e.message||String(e));toast('❌ สร้างลิสต์สดไม่ได้ — ต้องต่อเน็ต');return null}}
async function lvJoin(id,opt){opt=opt||{};if(LIVE&&LIVE.id===id){toast('📻 ซิงก์ลิสต์นี้อยู่แล้ว',1500,true);if(!LVUN)lvSub();return true}
 if(!opt.quiet&&!confirm('เข้าร่วมลิสต์สดของวง?\nลิสต์คืนนี้จะซิงก์กับวงแบบเรียลไทม์ (ลิสต์เดิมเก็บไว้ เรียกคืนได้)'))return false;
 if(SET.length){try{localStorage.setItem('bp-set-prev',JSON.stringify(SET))}catch(e){}}if(LVUN){try{LVUN()}catch(e){}LVUN=null}
 LVMAP.clear();LVREADY=false;lvApply.n=0;LIVE={id,o:[],last:{},mine:{}};if(opt.b){LIVE.p='bands/'+opt.b+'/lists/'+id;LIVE.b=opt.b;LIVE.bn=opt.bn||'';LIVE.ro=!!opt.ro}lvSave();try{const el=$('slv');if(el)el.style.display='none'}catch(e){}view='S';try{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.v=='S'))}catch(e){}render();lvSub();toast('📻 เข้าร่วมลิสต์สดแล้ว',2000,true);return true}
function lvLeave(q){if(LVUN){try{LVUN()}catch(e){}LVUN=null}LIVE=null;LVREADY=false;LVST='';LVMAP.clear();lvSave();lvBar();if(!q)toast('เลิกซิงก์ลิสต์สดแล้ว',1800,true);try{bdSDraw()}catch(e){}}
new MutationObserver(()=>{if(!LIVE&&!$('lvbar'))return;clearTimeout(lvBar.t);lvBar.t=setTimeout(()=>{try{lvBar()}catch(e){}},40)}).observe($('main'),{childList:true});
addEventListener('online',async()=>{if(!LIVE)return;try{const m=await lvMod();m.liveNet&&await m.liveNet(true)}catch(e){}if(LVST=='off'||LVST=='gone')lvSub();if(LVUSER)lvDirty()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible'&&LIVE&&LVST=='off'&&navigator.onLine)lvSub()});
if(LIVE&&!window.__LINEBLOCK){const t=setInterval(()=>{if(window.__catok&&window.__setok){clearInterval(t);if(LIVE.mine&&LIVE.o){for(const k of LIVE.o)if(LIVE.mine[k]){try{const r=JSON.parse(LIVE.mine[k]);const x=r[7]||{};const id=slMatch(r[0],r[1],x.sd);if(id)LVMAP.set(k,id)}catch(e){}}}lvSub()}},250)}
window.__live={start:lvStart,join:lvJoin,leave:lvLeave,state:()=>LVST,id:()=>LIVE&&LIVE.id,info:()=>LIVE,push:()=>lvPush(),user:()=>LVUSER,mark:k=>lvUser(k),clear:lvUserClr,edit:(id,f)=>lvEdit(id,f),edits:()=>{const o={};LVEDIT.forEach((v,k)=>o[k]=Object.keys(v));return o},injectPref:(id,ch)=>{if(!id||!ch)return;const p={...pref(id),...ch};PREF.set(id,p);try{put('prefs',p)}catch(e){}},entry:id=>lvEntry(id)};

// ---- v1.53 bands (family-style membership). Requires sign-in; everything else keeps working signed-out/offline. ----
const BD={bands:[],lists:{},un:null,lun:{},uid:'',open:{},inv:{},h:'',sh:''};
const BDROLE={owner:'เจ้าของวง',editor:'แก้ไขได้',viewer:'ดูอย่างเดียว'};
function bdRole(b){return b&&b.members&&BD.uid?b.members[BD.uid]||'':''}
// v1.82: invite codes are remembered (7 days) so the band QR stays in the band panel after reload
function bdInvSave(){try{const o=JSON.parse(localStorage.getItem('bp-binv')||'{}');for(const k in BD.inv)if(BD.inv[k]&&(!o[k]||o[k].c!==BD.inv[k]))o[k]={c:BD.inv[k],t:Date.now()};localStorage.setItem('bp-binv',JSON.stringify(o))}catch(e){}}
setTimeout(()=>{try{const o=JSON.parse(localStorage.getItem('bp-binv')||'{}');for(const k in o)if(Date.now()-o[k].t<6.5*864e5){if(!BD.inv[k])BD.inv[k]=o[k].c}else delete o[k];localStorage.setItem('bp-binv',JSON.stringify(o))}catch(e){}},0);
function bdCode(){const x=crypto.getRandomValues(new Uint8Array(10));return [...x].map(v=>B62[v%62]).join('')}
function bdErr(e){const c=e&&e.code||'';return c=='bp/invite-missing'?'ไม่พบรหัสเชิญนี้':c=='bp/invite-expired'?'รหัสเชิญหมดอายุแล้ว':/permission/.test(c)?'ไม่มีสิทธิ์ (วงเต็มแล้ว / รหัสหมดอายุ / สิทธิ์ไม่พอ)':accErr(e)}
function bdStop(){if(BD.un){try{BD.un()}catch(e){}BD.un=null}for(const k in BD.lun){try{BD.lun[k]()}catch(e){}}BD.lun={};BD.bands=[];BD.lists={};BD.uid='';bdDraw();bdSDraw()}
function bdStart(u){if(!CLD.mod||!u)return;if(BD.uid===u.uid&&BD.un)return;bdStop();BD.uid=u.uid;
 BD.un=CLD.mod.bandsSub(list=>{BD.bands=list.sort((a,b)=>String(a.name).localeCompare(String(b.name)));const ids=new Set(list.map(b=>b.id));
  for(const k in BD.lun)if(!ids.has(k)){try{BD.lun[k]()}catch(e){}delete BD.lun[k];delete BD.lists[k]}
  for(const b of list)if(!BD.lun[b.id])BD.lun[b.id]=CLD.mod.bandListsSub(b.id,ls=>{BD.lists[b.id]=ls;bdDraw();bdSDraw()},e=>blog('warn','band lists',e.code||e.message));
  if(LIVE&&LIVE.b){const b=list.find(x=>x.id===LIVE.b);if(!b){lvLeave(1);toast('คุณไม่ได้อยู่ในวงนี้แล้ว — เลิกซิงก์ลิสต์ของวง',3000)}else{const ro=bdRole(b)==='viewer';if(!!LIVE.ro!==ro){LIVE.ro=ro;lvSave();lvBar(true);if(!ro&&LVUSER)lvDirty()}if(LIVE.bn!==b.name){LIVE.bn=b.name;lvSave()}}}
  bdDraw();bdSDraw()},e=>{blog('warn','bands',e.code||e.message)});
 if(LIVE&&LIVE.b&&LVST!=='ok')lvSub();
 const pj=localStorage.getItem('bp-pjoin');if(pj){setTimeout(()=>bdJoin(pj),300)}setTimeout(ei25Check,1500)}
async function bd804After(bid){const t0=Date.now();while(Date.now()-t0<12000&&!(BD.bands.some(b=>b.id===bid)&&BD.lists[bid]!==undefined))await new Promise(r=>setTimeout(r,300));
 const b=BD.bands.find(x=>x.id===bid);if(!b)return;const ls=(BD.lists[bid]||[]).slice().sort((x,y)=>(y.ts||0)-(x.ts||0));const l=ls[0];
 if(!l){toast('👥 วงนี้ยังไม่มีลิสต์ — เมื่อเจ้าของวงกด 📤 แชร์ลิสต์ ลิสต์จะขึ้นในแท็บคืนนี้เอง',3500,true);return}
 if(LIVE&&LIVE.id===l.id)return;try{localStorage.removeItem('bp-bdoff')}catch(e){}if(LIVE)lvLeave(1);await lvJoin(l.id,{b:b.id,bn:b.name,ro:bdRole(b)==='viewer',quiet:1});try{bdMarkSeen();bdSDraw()}catch(e){}toast('👥 ซิงก์ลิสต์ของวง '+b.name+' แล้ว',2200,true)}
// v1.84.25: the join button always answers (message under the field + toast above every panel); a pending link stays until it worked or was dismissed
function bdMsg(t,ok){const m=$('bdjm');if(m){m.textContent=t||'';m.className='bdjm'+(ok?' ok':'')}}
async function bdJoin(code){const r=await bdJoin0(code);if(r){localStorage.removeItem('bp-pjoin');BD.h='';try{bdDraw()}catch(e){}}return r}
async function bdJoin0(code){code=String(code||'').trim().replace(/^.*[#&?]j=/,'').replace(/[^0-9A-Za-z].*$/,'');if(!code){bdMsg('ใส่รหัสเชิญ 10 ตัว หรือเปิดลิงก์เชิญจากหัวหน้าวง');toast('❌ ใส่รหัสเชิญก่อน (10 ตัวอักษร)');return false}
 if(!/^[0-9A-Za-z]{10}$/.test(code)){bdMsg('รหัสเชิญต้องเป็น 10 ตัวอักษร');toast('❌ รหัสเชิญต้องเป็น 10 ตัวอักษร');return false}
 if(!CLD.user){localStorage.setItem('bp-pjoin',code);toast('เข้าสู่ระบบก่อน แล้วจะเข้าร่วมวงให้อัตโนมัติ',3000);acpOpen();return false}
 try{const iv=await CLD.mod.inviteGet(code);if(!iv)throw {code:'bp/invite-missing'};if(BD.bands.some(b=>b.id===iv.b)){toast('คุณอยู่ในวงนี้แล้ว',2000,true);bd804After(iv.b);return true}
  if(!navigator.webdriver&&!confirm('เข้าร่วมวงนี้? (สิทธิ์: '+BDROLE[iv.role]+')'))return false;bdMsg('⏳ กำลังเข้าร่วมวง…',1);await CLD.mod.bandJoin(code);bdMsg('');toast('👥 เข้าร่วมวงแล้ว — ลิสต์ของวงจะแสดงในแท็บคืนนี้',3000,true);bd804After(iv.b);return true}
 catch(e){const t='เข้าร่วมวงไม่ได้: '+bdErr(e);bdMsg('❌ '+t);toast('❌ '+t,4000);if(e&&/missing|expired|not-found/.test(e.code||''))localStorage.removeItem('bp-pjoin');return false}}
// v1.84.25 email invites: popup after sign-in
async function ei25Check(){if(!CLD.user||!CLD.mod||!CLD.mod.emInvMine||document.querySelector('.ei25'))return;let L=[];try{L=await CLD.mod.emInvMine()}catch(e){console.warn('ei25',e&&e.code||e);return}
 L=L.filter(x=>!(BD.bands||[]).some(b=>b.id===x.b));if(!L.length)return;const iv=L[0];const d=document.createElement('div');d.className='ei25';d.setAttribute('role','dialog');
 d.innerHTML=`<div class="bx"><div style="font-size:38px">👥</div><h3>วง “<span data-noi18n>${esc(iv.bn||'')}</span>” ชวนคุณเข้าร่วม</h3><div class="small">${iv.byn?'โดย <span data-noi18n>'+esc(iv.byn)+'</span> · ':''}สิทธิ์: ${BDROLE[iv.role]||''}</div><div id="ei25m" class="small" style="min-height:1.2em;margin:6px 0"></div><div class="row"><button class="pri" id="ei25y">✓ เข้าร่วม</button><button class="hw" id="ei25n">ปฏิเสธ</button></div></div>`;document.body.appendChild(d);
 const done=()=>{d.remove();setTimeout(ei25Check,400)};
 $('ei25y').onclick=async()=>{const b=$('ei25y');b.disabled=true;b.textContent='⏳ กำลังเข้าร่วม…';try{await CLD.mod.emInvAccept(iv);toast('👥 เข้าร่วมวง '+(iv.bn||'')+' แล้ว',3000,true);d.remove();bd804After(iv.b)}catch(e){b.disabled=false;b.textContent='✓ เข้าร่วม';$('ei25m').textContent='❌ '+(/permission/.test(e.code||'')?'เข้าร่วมไม่ได้ (วงอาจเต็ม หรือคำเชิญถูกยกเลิก)':bdErr(e))}};
 $('ei25n').onclick=async()=>{try{await CLD.mod.emInvDel(iv.id)}catch(e){}done()}}
window.__ei25=ei25Check;
async function bdAct(f,okMsg){try{await f();if(okMsg)toast(okMsg,2000,true)}catch(e){toast('❌ '+bdErr(e),4000);blog('warn','band',e.code||e.message)}}
function bdHtml(){if(!CLD.user)return '';const L=BD.bands;let h=`<div class="bdh">👥 <b>วงของฉัน</b> <span class="small">(วงละ ${PLANCFG.SEATS} คน · เพิ่มได้)</span></div>`;
 if(!L.length)h+=`<div class="small">ยังไม่มีวง — สร้างวงใหม่ หรือใส่รหัสเชิญจากเพื่อนในวง</div>`;
 for(const b of L){const r=bdRole(b),own=r==='owner',op=!!BD.open[b.id],ms=Object.keys(b.members||{}),ls=BD.lists[b.id]||[];
  h+=`<div class="bdb${op?' on':''}" data-b="${b.id}"><button class="hw bdt" data-a="tog">${op?'▾':'▸'} <span data-noi18n>${esc(b.name)}</span> <span class="small">· ${ms.length} คน · ${ls.length} ลิสต์ · ${BDROLE[r]||''}</span></button>`;
  if(b.xo&&b.xo.u===BD.uid&&!own){const on=esc((b.names||{})[b.owner]||'เจ้าของวง');h+=`<div class="xob18" role="alert"><b>👑 ${on} ขอโอนวง “<span data-noi18n>${esc(b.name)}</span>” ให้คุณเป็นเจ้าของ</b><div class="small">รับแล้ว: คุณจัดการสมาชิก/รหัสเชิญ/ลบวงได้ · ${on} จะเป็น “แก้ไขได้” · แพ็กเกจ Band เดิมของวงยังใช้ต่อจนหมดอายุ</div><div class="row" style="gap:6px"><button class="pri" data-a="xoy">✓ รับเป็นเจ้าของ</button><button class="hw" data-a="xon">ปฏิเสธ</button></div></div>`}
  if(op){h+=`<div class="bdin"><div class="small">สมาชิก</div>`;
   for(const u of ms){const ru=b.members[u],nm=(b.names||{})[u]||u.slice(0,6);h+=`<div class="row bdm" data-u="${u}"><span data-noi18n>${esc(nm)}${u===BD.uid?' (ฉัน)':''}</span>`;
    if(own&&ru!=='owner')h+=`<select class="bdrs" data-a="role"><option value="editor"${ru=='editor'?' selected':''}>แก้ไขได้</option><option value="viewer"${ru=='viewer'?' selected':''}>ดูอย่างเดียว</option></select><button class="hw" data-a="kick">✕ เอาออก</button>${b.xo&&b.xo.u===u?`<span class="xo18">⏳ รอตอบรับเป็นเจ้าของ</span><button class="hw" data-a="xoc">ยกเลิก</button>`:`<button class="hw" data-a="xo" title="โอนเจ้าของวง" aria-label="โอนเจ้าของวง">👑 โอนเจ้าของวง</button>`}`;
    else h+=`<span class="small">${BDROLE[ru]||''}</span>`;h+=`</div>`}
   h+=`<div class="small">ลิสต์ของวง: ${ls.length}${ls.length?' — ซิงก์อัตโนมัติในแท็บ คืนนี้':''}</div>`;if(!ls.length)h+=`<div class="small bdempty">${r==='viewer'?'วงนี้ยังไม่มีลิสต์ — รอเจ้าของ/คนแก้ไขได้ กด “📤 แชร์ลิสต์”':'วงนี้ยังไม่มีลิสต์ — ไปที่แท็บ คืนนี้ แล้วกด “📤 แชร์ลิสต์”'}</div>`;
   if(own){const iv=BD.inv[b.id];h+=`<div class="row" style="flex-wrap:wrap;gap:6px"><select class="bdir"><option value="editor">เชิญแบบแก้ไขได้</option><option value="viewer">เชิญแบบดูอย่างเดียว</option></select><button class="hw" data-a="inv">🔑 สร้างรหัสเชิญ</button></div>`;
    if(iv){let qs='';try{qs=qrSvg(SLB()+'#j='+iv,'L')}catch(e){}
     h+=`<div class="bdiv"><div>สแกน QR หรือเปิดลิงก์ = เข้าวงทันที (ใช้ได้ 7 วัน)</div><div class="bdqr">${qs}</div><b class="bdcode" data-noi18n data-noicon>${iv}</b><button class="hw" data-a="cp">📤 แชร์ลิงก์เชิญ</button></div>`}
    h+=`<div class="row" style="gap:6px"><button class="hw" data-a="ren">✏️ เปลี่ยนชื่อวง</button><button class="hw" data-a="del">🗑 ลบวง</button></div>`}
   if(r==='owner'||r==='editor'){const E=(BD.ei||{})[b.id];h+=`<div class="row" style="flex-wrap:wrap;gap:6px"><input class="bdem" type="email" inputmode="email" autocapitalize="off" autocomplete="off" placeholder="✉️ อีเมลสมาชิก" style="flex:1;min-width:12em"><button class="hw" data-a="emi" aria-label="เชิญทางอีเมล">✉️ เชิญ</button></div>`;
    if(E&&E.length)h+=E.map(x=>`<div class="bdei">⏳ <span data-noi18n>${esc(x.e)}</span><span class="small">${BDROLE[x.role]||''}</span><button class="hw" data-a="emx" data-i="${esc(x.id)}" aria-label="ยกเลิกคำเชิญ">✕</button></div>`).join('')}
   else h+=`<button class="hw" data-a="leave">🚪 ออกจากวง</button>`;
   h+=`</div>`}h+=`</div>`}
 const pj=localStorage.getItem('bp-pjoin')||'';
 h+=`<div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">${pj?`<div class="bdpj">🔗 ลิงก์เชิญเข้าวง <b data-noi18n>${esc(pj)}</b><button class="pri" id="bdpjy">👥 เข้าร่วมเลย</button><button class="hw" id="bdpjn" aria-label="ไม่ใช้ลิงก์นี้">✕</button></div>`:''}<button class="hw" id="bdnew">➕ สร้างวง</button><input id="bdjc" placeholder="รหัสเชิญ / รหัสลิสต์" maxlength="80" autocapitalize="off" autocomplete="off" spellcheck="false" style="width:9em" value="${esc(pj)}"><button class="hw" id="bdjn">👥 เข้าร่วมวง</button><div id="bdjm" class="bdjm"></div></div>`;return h}
function bdDraw(){const c=$('acctc');if(!c)return;const ab=c.querySelector('.accb');if(!ab)return;let el=c.querySelector('#bdc');
 if(!CLD.user){if(el){el.remove();BD.h=''}return}
 if(!el||!c.contains(el)){el=document.createElement('div');el.id='bdc';el.className='bdc';ab.after(el);BD.h='';el.addEventListener('click',bdClick);el.addEventListener('change',bdChange)}
 const h=bdHtml();if(h===BD.h)return;const jv=el.querySelector('#bdjc');const keep=jv?jv.value:'';const ir={},iem={};el.querySelectorAll('.bdb').forEach(x=>{const q=x.querySelector('.bdir');if(q)ir[x.dataset.b]=q.value;const m=x.querySelector('.bdem');if(m&&m.value)iem[x.dataset.b]=m.value});BD.h=h;el.innerHTML=h;el.querySelectorAll('.bdb').forEach(x=>{const q=x.querySelector('.bdir');if(q&&ir[x.dataset.b])q.value=ir[x.dataset.b];const m=x.querySelector('.bdem');if(m&&iem[x.dataset.b])m.value=iem[x.dataset.b]});if(keep&&$('bdjc'))$('bdjc').value=keep;ei25Inv()}
// pending email invites per band (owner/editor view)
function ei25Inv(){if((BD.bands||[]).some(b=>b&&b.owner===OWN106&&!tx107(b)))cat101on('owner band member');for(const b of BD.bands||[]){if(!['owner','editor'].includes(bdRole(b))||!BD.open[b.id]||BD.ei&&BD.ei[b.id]!==undefined)continue;BD.ei=BD.ei||{};BD.ei[b.id]=null;CLD.mod.emInvList(b.id).then(L=>{BD.ei[b.id]=L;bdDraw()}).catch(()=>{BD.ei[b.id]=[]})}}
async function bdClick(e){const t=e.target.closest('button');if(!t)return;if(t.id==='bdnew'){const n=prompt('ชื่อวง',(CLD.mod.myName()||'')+' band');if(n&&n.trim())bdAct(async()=>{const id=await CLD.mod.bandCreate(n.trim());BD.open[id]=1;try{BD.inv[id]=await CLD.mod.inviteCreate(id,'editor',bdCode());bdInvSave()}catch(e){blog('warn','auto invite',e&&e.code||e&&e.message)}},'👥 สร้างวงแล้ว — ให้เพื่อนสแกน QR เพื่อเข้าวง');return}
 if(t.id==='bdpjn'){localStorage.removeItem('bp-pjoin');BD.h='';bdDraw();return}
 if(t.id==='bdjn'||t.id==='bdpjy'){const v=t.id==='bdpjy'?localStorage.getItem('bp-pjoin'):$('bdjc').value,r=slParse(v);if(r&&(r.live||r.p||(r.id&&r.id.length!==10))){slRun(r,false);return}
  if(t.disabled)return;const o=t.innerHTML;t.disabled=true;t.innerHTML='⏳ กำลังเข้าร่วม…';try{await bdJoin(v)}finally{const n=$(t.id);if(n){n.disabled=false;n.innerHTML=o}}return}
 const bx=t.closest('.bdb');if(!bx)return;const id=bx.dataset.b,b=BD.bands.find(x=>x.id===id);if(!b)return;const a=t.dataset.a,u=(t.closest('.bdm')||{}).dataset?.u;
 if(a==='tog'){BD.open[id]=!BD.open[id];bdDraw()}
 else if(a==='emi'){const i=bx.querySelector('.bdem'),e=(i&&i.value||'').trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)){toast('❌ ใส่อีเมลให้ถูกต้อง');return}
  if(Object.keys(b.members||{}).length>=(b.seats||5)){toast('❌ วงเต็มแล้ว ('+(b.seats||5)+' คน)',3500);return}const rs=bx.querySelector('.bdir');
  bdAct(async()=>{await CLD.mod.emInvCreate(id,b.name,e,rs?rs.value:'editor');BD.ei=BD.ei||{};delete BD.ei[id];BD.h='';bdDraw()},'✉️ ส่งคำเชิญแล้ว — เมื่อ '+e+' เข้าสู่ระบบ จะเห็นคำเชิญทันที')}
 else if(a==='emx'){const iid=t.dataset.i;bdAct(async()=>{await CLD.mod.emInvDel(iid);BD.ei=BD.ei||{};delete BD.ei[id];BD.h='';bdDraw()},'ยกเลิกคำเชิญแล้ว')}
 else if(a==='inv'){const role=bx.querySelector('.bdir').value;bdAct(async()=>{const c=await CLD.mod.inviteCreate(id,role,bdCode());BD.inv[id]=c;bdInvSave();bdDraw()},'🔑 สร้างรหัสเชิญแล้ว')}
 else if(a==='cp'){const u=SLB()+'#j='+BD.inv[id];if(navigator.share)navigator.share({title:'เข้าวง '+(b.name||''),url:u}).catch(()=>{});else slCopy(u,'📋 คัดลอกลิงก์เชิญแล้ว')}
 else if(a==='kick'&&u){if(confirm('เอาสมาชิกคนนี้ออกจากวง?'))bdAct(()=>CLD.mod.bandLeave(id,u),'เอาออกแล้ว')}
 else if(a==='xo'&&u){const nm=(b.names||{})[u]||'สมาชิก';if(confirm('โอนเจ้าของวง “'+b.name+'” ให้ '+nm+'?\n\n• '+nm+' ต้องกดรับก่อน จึงจะโอนจริง\n• คุณจะกลายเป็น “แก้ไขได้” (ไม่ใช่เจ้าของ)\n• แพ็กเกจ Band ที่คุณจ่ายไว้ ยังใช้กับวงนี้ต่อจนหมดอายุ'))bdAct(()=>CLD.mod.bandXfer(id,u),'👑 ส่งคำขอโอนแล้ว — รอ '+nm+' กดรับ')}
 else if(a==='xoc'){bdAct(()=>CLD.mod.bandXferCancel(id),'ยกเลิกการโอนแล้ว')}
 else if(a==='xoy'){if(confirm('รับเป็นเจ้าของวง “'+b.name+'”?'))bdAct(()=>CLD.mod.bandTake(id),'👑 คุณเป็นเจ้าของวงแล้ว')}
 else if(a==='xon'){bdAct(()=>CLD.mod.bandXferDecline(id),'ปฏิเสธแล้ว')}
 else if(a==='leave'){if(confirm('ออกจากวง "'+b.name+'"?'))bdAct(()=>CLD.mod.bandLeave(id),'ออกจากวงแล้ว')}
 else if(a==='ren'){const n=prompt('ชื่อวง',b.name);if(n&&n.trim())bdAct(()=>CLD.mod.bandRename(id,n.trim()))}
 else if(a==='del'){if(confirm('ลบวง "'+b.name+'" ทั้งวง? สมาชิกทุกคนจะไม่เห็นลิสต์ของวงอีก'))bdAct(async()=>{for(const l of BD.lists[id]||[]){try{await CLD.mod.bandListDel(id,l.id)}catch(e){}}await CLD.mod.bandDelete(id)},'ลบวงแล้ว')}}
function bdChange(e){const t=e.target;if(!t.classList.contains('bdrs'))return;const id=t.closest('.bdb').dataset.b,u=t.closest('.bdm').dataset.u;bdAct(()=>CLD.mod.bandRole(id,u,t.value),'เปลี่ยนสิทธิ์แล้ว')}
// "👥 ลิสต์ของวง" collapsed section in the tonight (S) view
function bdSHtml(){let h='',n=0;for(const b of BD.bands){const r=bdRole(b),ls=BD.lists[b.id]||[];n+=ls.length;
  h+=`<div class="bdsb" data-b="${b.id}"><div class="small"><b data-noi18n>${esc(b.name)}</b> · ${BDROLE[r]||''}</div>`;
  for(const l of ls){const on=LIVE&&LIVE.b===b.id&&LIVE.id===l.id,nw=!on&&!bdSeen().includes(l.id);h+=`<div class="row bdsl${on?' on':''}" data-l="${l.id}"><span data-noi18n>${esc(l.n||'(ไม่มีชื่อ)')}</span>${nw?'<span class="bdnew">ใหม่</span>':''}<span class="small">${l.c} เพลง</span>${on?'<span class="small">✅ ซิงก์อยู่</span>':'<button class="hw" data-a="sync">↪ ใช้ลิสต์นี้</button>'}${r!=='viewer'?'<button class="hw" data-a="ldel" aria-label="ลบ">🗑</button>':''}</div>`}
  if(!ls.length)h+=`<div class="small bdempty">${r==='viewer'?'วงนี้ยังไม่มีลิสต์ — รอเจ้าของ/คนแก้ไขได้ กด “📤 แชร์ลิสต์”':'วงนี้ยังไม่มีลิสต์ — จัดลิสต์คืนนี้ แล้วกด “📤 แชร์ลิสต์” สมาชิกจะเห็นทันที'}</div>`;
  h+=`</div>`}
 return {h,n}}
function bdSDraw(){const m=$('main');let el=$('bdsec')||bdSDraw.el;if(!CLD.user||!BD.bands.length||view!='S'||!m){if(el){el.remove();if(!CLD.user||!BD.bands.length){bdSDraw.el=null;BD.sh=''}}return}
 if(el&&!m.contains(el)){const lb=$('lvbar');if(lb)lb.after(el);else m.prepend(el)}if(!el||!m.contains(el)){el=document.createElement('details');bdSDraw.el=el;el.id='bdsec';el.className='bdsec';el.innerHTML='<summary></summary><div class="bdsi"></div>';const lb=$('lvbar');if(lb)lb.after(el);else m.prepend(el);BD.sh='';el.addEventListener('click',bdSClick)}
 const {h,n}=bdSHtml(),nn=bdNew(),sm=`👥 ลิสต์ของวง (${n})`+(nn?` · ใหม่ ${nn}`:'');if(nn&&!el.open&&el.dataset.nn!==String(nn)){el.open=true}el.dataset.nn=String(nn);const su=el.querySelector('summary');if(su.dataset.t!==sm){su.dataset.t=sm;su.textContent=sm}if(h!==BD.sh){BD.sh=h;el.querySelector('.bdsi').innerHTML=h}}
function bdSeen(){try{return JSON.parse(localStorage.getItem('bp-bdseen')||'[]')}catch(e){return []}}
function bdNew(){const s=bdSeen();let c=0;for(const b of BD.bands)for(const l of BD.lists[b.id]||[])if(!s.includes(l.id)&&!(LIVE&&LIVE.id===l.id))c++;return c}
function bdMarkSeen(){const ids=[];for(const b of BD.bands)for(const l of BD.lists[b.id]||[])ids.push(l.id);try{localStorage.setItem('bp-bdseen',JSON.stringify(ids.slice(-300)))}catch(e){}}
function bdSClick(e){const t=e.target.closest('button');if(!t)return;const bx=t.closest('.bdsb'),id=bx.dataset.b,b=BD.bands.find(x=>x.id===id);if(!b)return;const a=t.dataset.a,l=(t.closest('.bdsl')||{}).dataset?.l;
 if(a==='sync'&&l){bdMarkSeen();try{localStorage.removeItem('bp-bdoff')}catch(e){}const ro=bdRole(b)==='viewer';(async()=>{if(LIVE)lvLeave(1);await lvJoin(l,{b:id,bn:b.name,ro,quiet:!!navigator.webdriver});bdSDraw()})()}
 else if(a==='ldel'&&l){if(confirm('ลบลิสต์นี้ออกจากวง?'))bdAct(async()=>{await CLD.mod.bandListDel(id,l);if(LIVE&&LIVE.id===l)lvLeave(1)},'ลบแล้ว')}}
new MutationObserver(()=>{if(!BD.bands.length&&!$('bdsec'))return;clearTimeout(bdSDraw.t);bdSDraw.t=setTimeout(()=>{try{bdSDraw()}catch(e){}},50)}).observe($('main'),{childList:true});
{const _ad=accDraw;accDraw=function(){_ad();try{bdDraw()}catch(e){}}}
// hook auth: start/stop band subscriptions; new-device restore offer; auto-backup on by default
{const _am=accMod;accMod=async function(){const fresh=!CLD.mod;const m=await _am();if(fresh)m.onUser(async u=>{if(!u){bdStop();return}bdStart(u);
  const prev=localStorage.getItem('bp-cloud-uid');if(prev===u.uid)return;localStorage.setItem('bp-cloud-uid',u.uid);if(localStorage.getItem('bp-cloud-auto')===null)localStorage.setItem('bp-cloud-auto','1');
  try{const h=await m.head();if(h&&h.n){toast('☁️ พบข้อมูลสำรองในบัญชีนี้',2500,true);await accRestore()}else accAuto()}catch(e){}});return m}}
// invite links: #j=CODE
function bdHash(){const m=location.hash.match(/[#&]j=([0-9A-Za-z]{10})(?![0-9A-Za-z])/)||location.search.match(/[?&]j=([0-9A-Za-z]{10})(?![0-9A-Za-z])/);if(!m||window.__LINEBLOCK)return;history.replaceState(null,'',location.pathname+location.search.replace(/([?&])j=[0-9A-Za-z]{10}&?/,'$1').replace(/[?&]$/,''));localStorage.setItem('bp-pjoin',m[1]);try{BD.h='';bdDraw()}catch(e){}
 if(CLD.user)bdStart(CLD.user),(()=>{const c=localStorage.getItem('bp-pjoin');if(c){localStorage.removeItem('bp-pjoin');bdJoin(c)}})();else if(localStorage.getItem('bp-acct')==='1'&&navigator.onLine){toast('👥 กำลังเข้าร่วมวง…',2500,true);setTimeout(()=>{if(!CLD.user&&localStorage.getItem('bp-pjoin')){toast('👥 ลิงก์เชิญเข้าวง — เข้าสู่ระบบเพื่อเข้าร่วม',3500,true);acpOpen()}},6000)}else{toast('👥 ลิงก์เชิญเข้าวง — เข้าสู่ระบบเพื่อเข้าร่วม',3500,true);acpOpen()}}
addEventListener('hashchange',bdHash);setTimeout(bdHash,700);
if(localStorage.getItem('bp-acct')==='1'&&navigator.onLine&&!window.__LINEBLOCK)setTimeout(()=>{accMod().catch(()=>{})},1200);
window.__band={get s(){return {bands:BD.bands,lists:BD.lists,uid:BD.uid,inv:BD.inv,ei:BD.ei}},join:bdJoin,draw:bdDraw};

// ---- v1.55 anti-flicker: coalesce live/band redraws into one frame; re-attach persistent bars synchronously after render ----
lvApply.n=0;
function lvRender(){if(lvRender.q)return;lvRender.q=requestAnimationFrame(()=>{lvRender.q=0;if(view==='S'&&lvRender.sig===lvSig()&&$('setul'))return;render()})}
function lvSig(){return SET.join('\u0001')+'|'+(cur&&cur.id||'')+'|'+SET.map(id=>{const p=pref(id);return (p.key||0)+','+(p.tempo||100)}).join(';')+'|'+JSON.stringify(SNOTE)}
{const _r=render;render=function(){if(lvRender.q){cancelAnimationFrame(lvRender.q);lvRender.q=0}_r.apply(this,arguments);if(view==='S')lvRender.sig=lvSig();try{if(LIVE)lvBar()}catch(e){}try{if(BD.bands.length)bdSDraw()}catch(e){}}}

// ---- v1.55 band key sync visibility: show whether this song/list syncs with the band; nudge to sync ----
function cueSyncLine(id){if(LIVE&&SET.includes(id)){const t=LIVE.b?('👥 ซิงก์กับวง '+(LIVE.bn||'')):'📻 ซิงก์ลิสต์สด';return `<div class="small cuesync${LIVE.ro?' ro':''}" data-noi18n>${esc(t)}${LIVE.ro?' · 👁 ดูอย่างเดียว':''}</div>`}
 if(typeof BD!=='undefined'&&BD.bands.length&&SET.includes(id))return `<div class="small cuesync warn">⚠️ ลิสต์ในเครื่อง — ไม่ได้ซิงก์กับวง</div>`;return ''}
function bdLatest(){let best=null;for(const b of BD.bands)for(const l of BD.lists[b.id]||[]){if(!best||(l.ts||0)>(best.l.ts||0))best={b,l}}return best}
async function bdSyncLatest(){const x=bdLatest();if(!x){toast('วงยังไม่มีลิสต์ — รอเจ้าของ/คนแก้ไขได้ กด “แชร์ลิสต์คืนนี้เข้าวง”',3000);return}if(LIVE)lvLeave(1);await lvJoin(x.l.id,{b:x.b.id,bn:x.b.name,ro:bdRole(x.b)==='viewer',quiet:1});bdMarkSeen();bdSDraw();if(cue)drawCue()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-cq="bsync"]');if(!b)return;e.stopPropagation();bdSyncLatest()},true);
// v1.56: band lists auto-sync (no nudge/sync buttons). Joins the newest band list when not on a live list,
// and follows a newer list in the same band. Manual "เลิกซิงก์" is respected (bp-bdoff) until a newer list appears.
function bdNudge(){const o=$('bdnudge');if(o)o.remove();if(!CLD.user||!BD.bands.length||bdNudge.busy)return;const x=bdLatest();if(!x)return;
 const off=localStorage.getItem('bp-bdoff');if(off===x.l.id)return;
 if(LIVE&&!LIVE.b)return;if(LIVE&&LIVE.b){if(LIVE.id===x.l.id||LIVE.b!==x.b.id)return;const c=(BD.lists[LIVE.b]||[]).find(l=>l.id===LIVE.id);if(c&&((c.ts||0)>=(x.l.ts||0)||LIVE.own))return;if(!c&&BD.lists[LIVE.b]===undefined)return}
 bdNudge.busy=1;(async()=>{try{if(LIVE)lvLeave(1);await lvJoin(x.l.id,{b:x.b.id,bn:x.b.name,ro:bdRole(x.b)==='viewer',quiet:1});bdMarkSeen();toast('👥 ซิงก์ลิสต์ของวง '+x.b.name+' แล้ว',2200,true);if(cue)drawCue()}finally{bdNudge.busy=0;try{bdSDraw()}catch(e){}}})()}
{const _d=bdSDraw;bdSDraw=function(){_d();try{bdNudge()}catch(e){}}}

// ===== v1.60 (preview): player tool bar + bottom sheets; saved setlists =====
const T60=[['trim','scissors','ตัดหัว/ท้าย',['trimc']],['ci','timer','นับเข้า',['cic']],['pv','headphones','พรีวิว',['pvc']],['bal','scale','บาลานซ์',['balc']],['eq','sliders-vertical','ความดัง/EQ',['gainc','eqc']],['fade','volume-1','เฟด',['afc']],['note','notebook-pen','โน้ต',['notec']]];
['adv','sgain','eq','afade','note'].forEach(k=>ACC[k]=true); // inside a sheet the tool cards are always expanded
const ico60=n=>(window.bpIcon&&bpIcon(n))||'';
function sheet60(){let s=$('bs60');if(s)return s;s=document.createElement('div');s.id='bs60';s.className='bs60';s.setAttribute('aria-hidden','true');
 s.innerHTML=`<div class="bs60p" role="dialog" aria-modal="true" aria-labelledby="bs60t"><div class="bs60h" id="bs60h"><span class="bs60g"></span><b id="bs60t" data-noicon></b><button type="button" class="bs60x" id="bs60x" aria-label="ปิด">✕</button></div><div class="bs60b" id="bs60b"></div></div>`;
 document.body.appendChild(s);s.addEventListener('click',e=>{if(e.target===s||e.target.closest('#bs60x'))close60()});
 const h=s.querySelector('.bs60p');let y0=null,dy=0;
 h.addEventListener('touchstart',e=>{const b=$('bs60b');if(e.target.closest('#bs60h')||b.scrollTop<=0&&!e.target.closest('input,select,textarea')){y0=e.touches[0].clientY;dy=0}else y0=null},{passive:true});
 h.addEventListener('touchmove',e=>{if(y0==null)return;dy=e.touches[0].clientY-y0;if(dy>0){h.style.transform=`translateY(${dy}px)`}},{passive:true});
 h.addEventListener('touchend',()=>{if(y0==null)return;h.style.transform='';if(dy>80)close60();y0=null});
 addEventListener('keydown',e=>{if(e.key=='Escape'&&s.classList.contains('on'))close60()});return s}
let OPEN60=null;
function open60(k,title,node){const s=sheet60(),b=$('bs60b');OPEN60=k;$('bs60t').textContent=title;
 b.querySelectorAll(':scope>.bs60own').forEach(x=>{if(x.id==='s66mb'&&typeof more66Host=='function'){const h=more66Host();[...x.children].forEach(c=>{if(c.id)h.appendChild(c)})}x.remove()});/*v1.84.13: give เพิ่มเติม's moved blocks (tiles row, #showck…) back to their hidden host instead of deleting them*/
 if(node){node.classList.add('bs60own');b.appendChild(node)}
 const a=$('advc');if(a){if(a.parentNode!==b)b.prepend(a);const t=T60.find(x=>x[0]==k);a.style.display=t?'':'none';[...a.children].forEach(c=>{if(c.classList.contains('acch'))return;c.classList.toggle('off60',!t||!t[3].includes(c.id))})}
 s.classList.add('on');s.setAttribute('aria-hidden','false');b.scrollTop=0;document.querySelectorAll('#tb60 button').forEach(x=>x.classList.toggle('sel',x.dataset.t==k));try{if(k=='pv'&&typeof pvInit=='function'&&$('pvs')&&!$('pvs').options.length)pvInit()}catch(e){}}
function close60(){const s=$('bs60');if(!s)return;s.classList.remove('on');s.setAttribute('aria-hidden','true');OPEN60=null;document.querySelectorAll('#tb60 button.sel').forEach(x=>x.classList.remove('sel'))}
function act60(k){if(!cur)return false;const p=pref(cur.id);switch(k){
 case'trim':return trS(cur.id)>0||(p.te>0&&p.te<cur.buf.duration);
 case'ci':return p.ci!=null?p.ci>0:CI.bars>0;
 case'pv':return !!(PV.el&&!PV.el.paused);
 case'bal':return Math.abs(+(p.bal||0))>0.005||Math.abs(MBAL)>0.005;
 case'eq':return (p.sgn||0)!=0||(p.eq||[]).some(x=>x);
 case'fade':return p.afi>0||p.afo>0;
 case'note':return !!(p.nt||'').trim()}return false}
function tb60(){const st=$('studio'),ctr=st&&st.querySelector('.counter');if(!ctr)return;let t=$('tb60');
 if(!t){t=document.createElement('div');t.id='tb60';t.className='tb60';t.setAttribute('role','toolbar');t.setAttribute('aria-label','เครื่องมือ');t.dataset.noicon=1;
  t.innerHTML=T60.map(([k,i,l])=>`<button type="button" data-t="${k}" aria-label="${l}"><span class="tbi">${ico60(i)}<i class="dot60"></i></span><span class="tbl" data-noi18n>${(window.__i18n&&__i18n.lang=='en')?__i18n.T(l):l}</span></button>`).join('');
  t.addEventListener('click',e=>{const b=e.target.closest('button[data-t]');if(!b)return;advGroup();const k=b.dataset.t;if(OPEN60===k)return close60();open60(k,b.querySelector('.tbl').textContent)})}
 if(t.previousElementSibling!==ctr)ctr.after(t);
 const a=$('advc');if(a&&a.parentNode!==$('bs60b')){sheet60();$('bs60b').prepend(a);if(!OPEN60)a.style.display='none'}}
setInterval(()=>{const t=$('tb60');if(!t)return;t.querySelectorAll('button[data-t]').forEach(b=>{const on=act60(b.dataset.t);if(b.classList.contains('act')!==on)b.classList.toggle('act',on)})},500);
new MutationObserver(()=>{if(tb60.q)return;tb60.q=requestAnimationFrame(()=>{tb60.q=0;try{tb60()}catch(e){}})}).observe(document.body,{childList:true,subtree:true});
window.__tb60={open:open60,close:close60,act:act60};

// ---- saved setlists (local kv 'saved' → included in account backup automatically) ----
const SV60={l:null};
async function svLoad(){if(SV60.l)return SV60.l;try{SV60.l=(await get('kv','saved'))?.v||[]}catch(e){SV60.l=[]}return SV60.l}
async function svSave(){await put('kv',{k:'saved',v:SV60.l});try{accAuto()}catch(e){}}
const SVNO=new Set(['id']);
function svPrefs(id){const p=pref(id),o={};for(const [k,v] of Object.entries(p)){if(SVNO.has(k)||typeof v=='function')continue;o[k]=v}return o}
async function svAdd(){if(!SET.length){toast('ยังไม่มีเพลงในคืนนี้');return}const n=(prompt('ชื่อลิสต์ (เช่น ร้าน A วันศุกร์)',SNOTE._name||'')||'').trim();if(!n)return;
 const l=await svLoad(),it={id:Date.now().toString(36),n:n.slice(0,60),t:Date.now(),o:[...SET],p:Object.fromEntries(SET.map(id=>[id,svPrefs(id)])),sn:Object.fromEntries(SET.filter(id=>SNOTE[id]).map(id=>[id,SNOTE[id]]))};
 const i=l.findIndex(x=>x.n===it.n);if(i>=0){if(!confirm('มีลิสต์ชื่อ “'+it.n+'” แล้ว — บันทึกทับ?'))return;l[i]={...it,id:l[i].id}}else l.unshift(it);await svSave();toast('💾 บันทึกลิสต์แล้ว: '+it.n,2000,true)}
async function svApply(id){const l=await svLoad(),it=l.find(x=>x.id==id);if(!it)return;return svApplyIt(it)}
async function svApplyIt(it){
 if(SET.length&&!confirm('แทนที่ลิสต์คืนนี้ ('+SET.length+' เพลง) ด้วย “'+it.n+'”?'))return;
 if(LIVE&&!confirm('⚠️ ลิสต์คืนนี้ซิงก์สดกับวงอยู่ — โหลด “'+it.n+'” แล้ววงจะเห็นทันที ดำเนินการต่อ?'))return;
 if(SET.length&&SET.join()!==it.o.join()){try{localStorage.setItem('bp-set-prev',JSON.stringify(SET))}catch(e){}}
 for(const [sid,sp] of Object.entries(it.p||{})){const p={...pref(sid),...sp,id:sid};PREF.set(sid,p);await put('prefs',p)}
 for(const [sid,v] of Object.entries(it.sn||{}))SNOTE[sid]=v;SNOTE._name=it.n;
 SET=[...it.o];await saveSet();const miss=SET.filter(x=>!SONG.get(x)).length;close60();render();try{if(cur&&it.p[cur.id]){showKey();tempoUI();advUI();scApply();applyMix()}}catch(e){}
 toast('📂 โหลดลิสต์ “'+it.n+'” '+SET.length+' เพลง'+(miss?' (ไม่พบ '+miss+')':''),2500,true)}
function svDate(t){try{return new Date(t).toLocaleDateString(LANG=='en'?'en-GB':'th-TH',{day:'numeric',month:'short'})}catch(e){return''}}
window.__sv60={load:svLoad,add:svAdd,apply:svApply,open:(...a)=>svOpen(...a),get l(){return SV60.l}};

// ===== v1.62 preview: "Stage" theme (default) — compact setlist cards with key/BPM chips + stage transport row =====
function scChips(i){try{const k=songKey(i),sh=pref(i).key||0,b=realBpm(i);const kn=k?keyName({r:((k.r+sh)%12+12)%12,m:k.m,sp:k.sp}):'';
 return `<div class="scc">${kn?`<span class="chip k">${kn}</span>`:''}${b?`<span class="chip b">${Math.round(b)} BPM</span>`:''}</div>`}catch(e){return''}}
function tp62(){const ctr=document.querySelector('#studio .counter');if(!ctr)return;let t=$('tp62');
 if(!t){t=document.createElement('div');t.id='tp62';t.className='tp62';t.dataset.noicon=1;const I=n=>(window.bpIcon&&bpIcon(n))||'';
  t.innerHTML=`<div class="tpst"><span class="tpl">KEY</span><button type="button" data-tp="kd" aria-label="คีย์ −">−</button><b id="tpk" data-noi18n>0</b><button type="button" data-tp="ku" aria-label="คีย์ +">+</button></div>
  <div class="tpst"><span class="tpl">TEMPO</span><button type="button" data-tp="td" aria-label="ความเร็ว −">−</button><b id="tpt" data-noi18n>100%</b><button type="button" data-tp="tu" aria-label="ความเร็ว +">+</button></div>
  <button type="button" class="tpplay" id="tpplay" aria-label="เล่น/หยุด">${I('play')}${I('pause')}</button>
  <button type="button" class="tpb" id="tpstop" aria-label="หยุดและกลับต้นเพลง">${I('square')}</button>
  <button type="button" class="tpb" id="tpnext" aria-label="เพลงถัดไป">${I('skip-forward')}</button>`;
  t.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.tp){const x=$(b.dataset.tp);x&&x.click();return}
   if(b.id=='tpplay')$('big').click();if(b.id=='tpstop'&&cur){stop();offset=0;try{render()}catch(e){}}
   if(b.id=='tpnext'){const n=nextId();if(n)load(n);else toast('ไม่มีเพลงถัดไปในลิสต์')}})}
 if(t.parentNode!==ctr)ctr.appendChild(t)}
setInterval(()=>{const t=$('tp62');if(!t)return;const kv=$('kv'),tv=$('tv');stx($('tpk'),kv?kv.textContent:'0');stx($('tpt'),tv?tv.textContent.replace(/\s.*$/,''):'100%');
 if(t.classList.contains('pl')!==!!playing)t.classList.toggle('pl',!!playing);const n=!!nextId();if(t.classList.contains('nn')===n)t.classList.toggle('nn',!n)},250);
new MutationObserver(()=>{if(tp62.q)return;tp62.q=requestAnimationFrame(()=>{tp62.q=0;try{tp62()}catch(e){}})}).observe(document.body,{childList:true,subtree:true});

// ===== v1.62p: collapsible song sidebar (two-column layouts) =====
function sb62(){const pl=$('right');if(!pl||$('sb62'))return;const b=document.createElement('button');b.type='button';b.id='sb62';b.className='sb62';b.dataset.noicon=1;
 b.innerHTML=(window.bpIcon&&(bpIcon('panel-left')||bpIcon('sidebar')))||'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>';
 b.addEventListener('click',e=>{e.stopPropagation();sbSet(!document.body.classList.contains('sbc'))});pl.prepend(b);sbSet(localStorage.getItem('bp-sb')=='1',1)}
function sbSet(c,q){document.body.classList.toggle('sbc',!!c);localStorage.setItem('bp-sb',c?'1':'0');const b=$('sb62');if(b){b.setAttribute('aria-label',c?'แสดงรายชื่อเพลง':'ซ่อนรายชื่อเพลง');b.title=(c?'แสดงรายชื่อเพลง':'ซ่อนรายชื่อเพลง')+' ( \\ )';b.setAttribute('aria-pressed',c?'true':'false')}
 if(!q)setTimeout(()=>{try{waveDraw()}catch(e){}},260)}
window.__sb62={set:sbSet,get:()=>document.body.classList.contains('sbc')};
document.addEventListener('keydown',e=>{if(e.key!='\\'||e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;e.preventDefault();sbSet(!document.body.classList.contains('sbc'))});
sb62();new MutationObserver(()=>{if(!$('sb62'))sb62()}).observe($('right')||document.body,{childList:true});
// ================= v1.63 preview: multitrack STEMS per song =================
// A stems song = one manifest record {name:'Title.stems',src:'stems',stems:[{f,n,file}]} + audio blobs 'stem:<manifest>:<i>' in IndexedDB 'files'.
// Decoded stems are mono (and 22.05 kHz when over budget). The returned AudioBuffer is a stereo MIX (kept in sync in place) so waveform/preview/
// PitchShifter/trim/sections/fade keep working; without key/tempo change, each stem plays as its own source started at the same ctx time (sample-synced).
var ST=(()=>{
 const GUESS=[[/click|คลิก|metro/i,'คลิก','c'],[/guide|cue|ไกด์|นับ|count/i,'ไกด์','c'],[/e-?drum|กลองไฟฟ้า|elec\w*\s*drum/i,'กลองไฟฟ้า'],[/perc|เพอร์/i,'เพอร์คัสชั่น'],
  [/drum|kick|snare|hat|กลอง/i,'กลอง'],[/bass|เบส/i,'เบส'],[/riff|ริฟ/i,'ริฟกีต้าร์'],[/gtr|guit|กีต้าร์|กีตาร์/i,'กีต้าร์'],[/key|piano|synth|organ|คีย์|เปียโน/i,'คีย์บอร์ด'],
  [/\bpad/i,'แพด'],[/vox|vocal|voc|ร้อง|choir|คอรัส|bv/i,'ร้อง'],[/string|สตริง/i,'สตริง'],[/brass|horn|sax|trump|เป่า/i,'เครื่องเป่า'],[/\bother\b|อื่น|instrumental|accomp|backing/i,'ดนตรีอื่นๆ']];
 const guess=fn=>{const b=fn.replace(/^.*\//,'').replace(/\.[^.]+$/,''),q=(b.match(/\(([^()]+)\)\s*$/)||[])[1];if(q)for(const [r,n,k] of GUESS)if(r.test(q))return{n,c:k=='c'};for(const [r,n,k] of GUESS)if(r.test(b))return{n,c:k=='c'};return{n:b.slice(0,14),c:false}};
 const AUD=/\.(mp3|wav|m4a|aac|flac|aif|aiff|ogg|caf)$/i;
 let LIVE=null,UI=null,ui=null,MIXT=null;const BUDGET=()=>window.__stBudget||160e6;
 // ---- zip (stored + deflate) via DecompressionStream ----
 async function unzip(file){const buf=new Uint8Array(await file.arrayBuffer()),dv=new DataView(buf.buffer);let e=buf.length-22;while(e>=0&&dv.getUint32(e,true)!=0x06054b50)e--;if(e<0)throw new Error('zip เสีย');
  const n=dv.getUint16(e+10,true);let o=dv.getUint32(e+16,true);const out=[];const td=new TextDecoder();
  for(let i=0;i<n;i++){const m=dv.getUint16(o+10,true),cs=dv.getUint32(o+20,true),nl=dv.getUint16(o+28,true),xl=dv.getUint16(o+30,true),cl=dv.getUint16(o+32,true),lo=dv.getUint32(o+42,true);
   const name=td.decode(buf.subarray(o+46,o+46+nl));o+=46+nl+xl+cl;if(name.endsWith('/')||!AUD.test(name)||/__MACOSX|\/\._/.test(name))continue;
   const ds=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true);const raw=buf.slice(ds,ds+cs);let blob;
   if(m==0)blob=new Blob([raw]);else if(m==8)blob=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();else continue;
   out.push({name,blob})}return out}
 async function importStems(files,title){const r=$('st63r')||{};const items=[];
  for(const f of files){if(/\.zip$/i.test(f.name)){r.textContent='⏳ แตก zip: '+f.name;for(const z of await unzip(f))items.push(z);title=title||f.name.replace(/\.zip$/i,'')}
   else if(AUD.test(f.name))items.push({name:f.webkitRelativePath||f.name,blob:f})}
  if(items.length<2){r.textContent='❌ ต้องมีอย่างน้อย 2 ไฟล์เสียงต่อ 1 เพลง';return null}
  if(!title){const d=items[0].name.includes('/')?items[0].name.split('/').slice(-2)[0]:'';title=d;if(!title){const b=items.map(i=>i.name.replace(/\.[^.]+$/,''));let p=b[0];for(const x of b)while(p&&!x.startsWith(p))p=p.slice(0,-1);title=p.replace(/[\s_\-–.([]+$/,'')||('Stems '+new Date().toLocaleDateString('th'))}}
  const rk=n=>{const b=n.replace(/^.*\//,'');const k=GUESS.findIndex(g=>g[0].test(b));return k<0?50:GUESS[k][2]=='c'?90+k:k};items.sort((a,b)=>rk(a.name)-rk(b.name)||a.name.localeCompare(b.name));const man=title+'.stems';const tot=items.reduce((a,i)=>a+i.blob.size,0);
  try{if(navigator.storage?.persist)await navigator.storage.persist()}catch(e){}
  const stems=[];for(let i=0;i<items.length;i++){r.textContent=`⏳ เก็บ stem ${i+1}/${items.length}: ${items[i].name}`;const f='stem:'+man+':'+i;const bl=new Blob([await items[i].blob.arrayBuffer()],{type:items[i].blob.type||'audio/mpeg'});
   await safePut({name:f,blob:bl,size:bl.size,added:Date.now(),src:'stem'});const g=guess(items[i].name);stems.push({f,n:g.n,c:g.c,file:items[i].name.replace(/^.*\//,'')})}
  const rec={name:man,blob:new Blob([JSON.stringify(stems)],{type:'application/json'}),size:tot,added:Date.now(),src:'stems',stems};await safePut(rec);FILES.set(man,{name:man,size:tot,src:'stems'});
  cache.delete('X:'+man);rebuildIndex();render();
  const warn=items.length>12||tot>250e6?` ⚠️ ${items.length} ไฟล์ ${(tot/1e6).toFixed(0)} MB — เยอะ อาจหนักสำหรับ iPhone (จะลดคุณภาพเป็นโมโน 22kHz อัตโนมัติ)`:'';
  const msg=`✅ นำเข้า Stems "${title}" ${items.length} แทร็ก`+warn;const r2=$('st63r');if(r2)r2.textContent=msg;toast(msg,3500,!warn);return 'X:'+man}
 function bind(){const a=$('imps'),d=$('impd');if(a)a.onchange=e=>{const f=[...e.target.files];e.target.value='';importStems(f)};if(d)d.onchange=e=>{const f=[...e.target.files];e.target.value='';importStems(f)}}
 // ---- decode with memory budget ----
 async function toMono(b){const L=b.length,o=new Float32Array(L),n=b.numberOfChannels;for(let c=0;c<n;c++){const d=b.getChannelData(c);for(let i=0;i<L;i++)o[i]+=d[i]/n}return o}
 async function rs(data,sr,to){const oc=new OfflineAudioContext(1,Math.ceil(data.length*to/sr),to);const b=oc.createBuffer(1,data.length,sr);b.copyToChannel(data,0);const s=oc.createBufferSource();s.buffer=b;s.connect(oc.destination);s.start();return (await oc.startRendering()).getChannelData(0)}
 async function decode(rec){const st=rec.stems||JSON.parse(await rec.blob.text());const N=st.length;let rate=0,lowq=false;const ds=[];
  for(let i=0;i<N;i++){const r=await get('files',st[i].f);if(!r){ds.push(null);continue}let ab=await r.blob.arrayBuffer();let b=await new Promise((ok,no)=>ctx.decodeAudioData(ab,ok,no));ab=null;
   if(!rate){const est=b.duration*b.sampleRate*4*(N+2);rate=est>BUDGET()?22050:b.sampleRate;lowq=rate!=b.sampleRate;if(est*22050/b.sampleRate>BUDGET())toast(`⚠️ Stems ยาว/เยอะมาก (~${(est*22050/b.sampleRate/1e6).toFixed(0)} MB) — iPhone อาจปิดแอป ลองลดจำนวนแทร็ก`,6000)}
   let d=await toMono(b);if(b.sampleRate!=rate)d=await rs(d,b.sampleRate,rate);b=null;ds.push(d)}
  const len=Math.max(...ds.map(d=>d?d.length:0));const mix=ctx.createBuffer(2,len||1,rate);
  mix.__st={id:'X:'+rec.name,st,ds,rate,lowq,mb:(ds.reduce((a,d)=>a+(d?d.length:0),0)+2*len)*4/1e6,bufs:ds.map(d=>{if(!d)return null;const x=ctx.createBuffer(1,d.length,rate);x.copyToChannel(d,0);return x})};
  remix(mix);blog('info',`stems ${N} @${rate}Hz ~${mix.__st.mb.toFixed(0)}MB`);return mix}
 // ---- settings ----
 function cfg(id,S){const p=pref(id),a=p.st||[],hasC=S.st.some(x=>x.c);return S.st.map((x,i)=>({v:0,m:false,s:false,p:hasC?(x.c?1:-1):0,...(a[i]||{})}))}
 const mst=id=>pref(id).stM??0;
 function gains(id,S){const c=cfg(id,S),solo=c.some(x=>x.s),M=db2(mst(id));return c.map(x=>{const g=(x.m||(solo&&!x.s))?0:db2(x.v)*M;const a=(x.p+1)*Math.PI/4;return{g,p:x.p,l:g*Math.cos(a),r:g*Math.sin(a)}})}
 function remix(mix){const S=mix.__st,G=gains(S.id,S),L=mix.getChannelData(0),R=mix.getChannelData(1);L.fill(0);R.fill(0);
  S.ds.forEach((d,i)=>{if(!d)return;const l=G[i].l,r=G[i].r;if(!l&&!r)return;for(let j=0;j<d.length;j++){const v=d[j];L[j]+=v*l;R[j]+=v*r}})}
 function apply(){const b=cur&&cur.buf;if(!b||!b.__st)return;const G=gains(cur.id,b.__st);
  if(LIVE&&LIVE.b===b){const t=ctx.currentTime;LIVE.n.forEach((n,i)=>{if(!n)return;n.g.gain.setTargetAtTime(G[i].g,t,0.012);n.p.pan.setTargetAtTime(G[i].p,t,0.012)})}
  clearTimeout(MIXT);MIXT=setTimeout(()=>remix(b),LIVE?150:0)}// shifter/preview read the mix buffer live
 async function set(i,ch){if(!cur||!cur.buf||!cur.buf.__st)return;const id=cur.id,S=cur.buf.__st;const c=cfg(id,S);if(i<0){const p={...pref(id),stM:ch.v};PREF.set(id,p);apply();await put('prefs',p);return}
  c[i]={...c[i],...ch};const p={...pref(id),st:c.map(({v,m,s,p})=>({v,m,s,p}))};PREF.set(id,p);apply();await put('prefs',p)}
 // ---- plain playback: one source per stem, same start time ----
 function play(b,off){halt();const S=b.__st,G=gains(S.id,S),t=ctx.currentTime;let first=null,fi=-1;S.bufs.forEach((x,i)=>{if(x&&(fi<0||x.duration>S.bufs[fi].duration))fi=i});const n=S.bufs.map((x,i)=>{if(!x)return null;const s=ctx.createBufferSource();s.buffer=x;const g=ctx.createGain();g.gain.value=G[i].g;
   const p=ctx.createStereoPanner();p.pan.value=G[i].p;s.connect(g);g.connect(p);p.connect(split);if(i==fi)first=s;else s.start(t,Math.min(off,x.duration));return{s,g,p}});// caller starts `first` at the same ctx time (same task)
  for(const x of n)if(x&&x.s!==first)x.s.onended=null;LIVE={b,n,t,off};return first}
 function halt(){if(!LIVE)return;for(const x of LIVE.n)if(x){x.s.onended=null;try{x.s.stop()}catch(e){}x.s.disconnect();x.g.disconnect();x.p.disconnect()}LIVE=null}
 // ---- UI ----
 const I={m:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>',
  s:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>',
  h:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="13" width="4" height="3" rx="1"/><rect x="10" y="7" width="4" height="3" rx="1"/><rect x="16" y="11" width="4" height="3" rx="1"/></svg>'};
 const dbt=v=>v<=-40?'−∞':(v>0?'+':'')+v;
 function build(){const b=cur.buf,S=b.__st,c=cfg(cur.id,S);let el=$('stm63');if(!el){el=document.createElement('section');el.id='stm63';el.className='stm63'}
  el.innerHTML=`<div class="st63h">${I.h}<b>Stems</b><span>${S.st.length} แทร็ก · ${S.rate/1000}kHz mono${S.lowq?' (ลดคุณภาพเพื่อประหยัดแรม)':''} · ~${S.mb.toFixed(0)} MB</span><button type="button" class="st63rs" data-rs>รีเซ็ต</button></div><div class="st63s">`+
   S.st.map((x,i)=>`<div class="st63c${c[i].m?' mu':''}${c[i].s?' so':''}" data-i="${i}"><div class="st63n" title="${x.file}">${x.n}</div><div class="st63f"><div class="st63m"><i></i></div><input type="range" min="-40" max="6" step="1" value="${c[i].v}" aria-label="${x.n} volume"></div>
    <div class="st63v">${dbt(c[i].v)}</div><div class="st63b"><button type="button" data-k="m" aria-pressed="${c[i].m}" title="Mute">${I.m}</button><button type="button" data-k="s" aria-pressed="${c[i].s}" title="Solo">${I.s}</button></div>
    <div class="st63p">${[-1,0,1].map(v=>`<button type="button" data-p="${v}" aria-pressed="${c[i].p==v}">${v<0?'L':v>0?'R':'C'}</button>`).join('')}</div></div>`).join('')+
   `<div class="st63c st63M" data-i="-1"><div class="st63n">Master</div><div class="st63f"><div class="st63m"><i></i></div><input type="range" min="-40" max="6" step="1" value="${mst(cur.id)}" aria-label="stems master"></div><div class="st63v">${dbt(mst(cur.id))}</div></div></div>`;
  el.oninput=e=>{const r=e.target.closest('input[type=range]');if(!r)return;const i=+r.closest('[data-i]').dataset.i;r.parentNode.nextElementSibling.textContent=dbt(+r.value);set(i,{v:+r.value})};
  el.onclick=async e=>{const bt=e.target.closest('button');if(!bt)return;if(bt.dataset.rs!=null){const p={...pref(cur.id)};delete p.st;delete p.stM;PREF.set(cur.id,p);await put('prefs',p);apply();ui=null;return}
   const i=+bt.closest('[data-i]').dataset.i,c=cfg(cur.id,S)[i];if(bt.dataset.k)await set(i,{[bt.dataset.k]:!c[bt.dataset.k]});else await set(i,{p:+bt.dataset.p});ui=null};
  return el}
 function tick(){requestAnimationFrame(tick);const b=cur&&cur.buf,st=$('studio');let el=$('stm63');
  if(!b||!b.__st||!st){if(el)el.remove();ui=null;return}
  const key=cur.id+'|'+JSON.stringify(pref(cur.id).st||'')+(pref(cur.id).stM||0);if(ui!==key||!el||!st.contains(el)){el=build();const mx=$('mixer');if(mx&&mx.parentNode===st)mx.after(el);else st.appendChild(el);ui=key}
  const S=b.__st,G=gains(cur.id,S),x=Math.floor(pos()*S.rate),ms=el.querySelectorAll('.st63m>i');let mL=0;
  S.ds.forEach((d,i)=>{let v=0;if(d&&playing){const a=Math.max(0,x-256),z=Math.min(d.length,x+256);for(let j=a;j<z;j+=2)v=Math.max(v,Math.abs(d[j]))}v*=G[i].g;mL=Math.max(mL,v);if(ms[i])ms[i].style.height=Math.min(100,Math.max(0,(20*Math.log10(v||1e-6)+48)/48*100))+'%'});
  if(ms[S.ds.length])ms[S.ds.length].style.height=Math.min(100,Math.max(0,(20*Math.log10(mL||1e-6)+48)/48*100))+'%'}
 requestAnimationFrame(tick);
 // orphan cleanup: stem blobs whose manifest is gone
 setTimeout(async()=>{try{const all=await tx('files','readonly',s=>s.getAllKeys());const keep=new Set(all.filter(k=>!k.startsWith('stem:')));for(const k of all)if(k.startsWith('stem:')){const m=k.slice(5,k.lastIndexOf(':'));if(!keep.has(m))await del('files',k)}}catch(e){}},4000);
 return{bind,importStems,decode,play,halt,set,apply,cfg,guess,unzip,get live(){return LIVE},
  dbg:{load:id=>load(id),pref:c=>setPref(c),seek:t=>start(t),get info(){const b=cur&&cur.buf;return b&&b.__st?{id:cur.id,n:b.__st.st.length,names:b.__st.st.map(x=>x.n),rate:b.__st.rate,cfg:cfg(cur.id,b.__st),live:!!LIVE,srcs:LIVE?LIVE.n.length:0,sh:!!sh}:null},
   spec(f){const a=anL,b=anR,x=new Float32Array(a.frequencyBinCount),y=new Float32Array(b.frequencyBinCount);a.getFloatFrequencyData(x);b.getFloatFrequencyData(y);const k=Math.round(f*a.fftSize/ctx.sampleRate);let m=-200;for(let i=k-2;i<=k+2;i++)m=Math.max(m,x[i],y[i]);return m},
   rms(){const a=new Float32Array(anL.fftSize),b=new Float32Array(anR.fftSize);anL.getFloatTimeDomainData(a);anR.getFloatTimeDomainData(b);let s=0;for(let i=0;i<a.length;i++)s+=a[i]*a[i]+b[i]*b[i];return Math.sqrt(s/a.length/2)}}}})();
window.__st63=ST;

// ===== v1.62: saved setlists — one entry point on Tonight tab, sheet with tabs ของฉัน / วง <name>; band lists shared via Firestore =====
const SVB={l:{},un:{}};
function svbSync(){const on=typeof BD!=='undefined'&&CLD.user&&CLD.mod&&CLD.mod.bandSavedSub;const ids=new Set(on?BD.bands.map(b=>b.id):[]);
 for(const k in SVB.un)if(!ids.has(k)){try{SVB.un[k]()}catch(e){}delete SVB.un[k];delete SVB.l[k]}
 if(on)for(const b of BD.bands)if(!SVB.un[b.id])SVB.un[b.id]=CLD.mod.bandSavedSub(b.id,ls=>{SVB.l[b.id]=ls.sort((a,b)=>b.t-a.t);try{libHideSyncBand149()}catch(e){}if(OPEN60=='saved')svOpen()},e=>blog('warn','band saved',e.code||e.message))}
setInterval(()=>{try{svbSync()}catch(e){}},1500);
function svTab(){const t=localStorage.getItem('bp-svt')||'me';return t!='me'&&!(typeof BD!=='undefined'&&BD.bands.some(b=>b.id==t))?'me':t}
function svCan(t){if(t=='me')return true;const b=BD.bands.find(x=>x.id==t);return !!b&&bdRole(b)!=='viewer'}
function svPack(){const tt={};for(const id of SET){const x=SONG.get(id);if(x)tt[id]=[x.t||'',x.a||'',x.s||'']}
 return {p:Object.fromEntries(SET.map(id=>[id,svPrefs(id)])),sn:Object.fromEntries(SET.filter(id=>SNOTE[id]).map(id=>[id,SNOTE[id]])),tt}}
function svUnpack(x){let d={};try{d=JSON.parse(x.d||'{}')}catch(e){}const map=id=>{if(SONG.get(id))return id;const t=(d.tt||{})[id];const m=t&&slMatch(t[0],t[1],t[2]);return m||id};
 const o=x.o.map(map),p={},sn={};x.o.forEach((id,i)=>{if(d.p&&d.p[id])p[o[i]]=d.p[id];if(d.sn&&d.sn[id])sn[o[i]]=d.sn[id]});return {id:x.id,n:x.n,o,p,sn,t:x.t}}
function svId(){const x=crypto.getRandomValues(new Uint8Array(12));return [...x].map(v=>B62[v%62]).join('')}
async function svAddTo(t){if(t=='me')return svAdd().then(()=>{if(OPEN60=='saved')svOpen()});
 if(!svCan(t)){toast('สิทธิ์ดูอย่างเดียว — บันทึกลิสต์ของวงไม่ได้');return}if(!SET.length){toast('ยังไม่มีเพลงในคืนนี้');return}
 const n=(prompt('ชื่อลิสต์ของวง (เช่น ร้าน A วันศุกร์)',SNOTE._name||'')||'').trim();if(!n)return;const L=SVB.l[t]||[];const ex=L.find(x=>x.n===n.slice(0,60));
 if(ex&&!confirm('วงมีลิสต์ชื่อ “'+n+'” แล้ว — บันทึกทับ?'))return;
 try{await CLD.mod.bandSavedPut(t,ex?ex.id:svId(),{n,o:[...SET],d:JSON.stringify(svPack())});toast('💾 บันทึกลิสต์ให้ทั้งวงแล้ว: '+n,2200,true)}catch(e){toast('❌ บันทึกไม่ได้: '+bdErr(e),4000)}}
async function svOpen(){if(accOn()&&navigator.onLine&&!(CLD.user&&BD.bands.length)){try{await accMod();for(let i=0;i<50&&!(CLD.user&&BD.bands.length&&(BD.bands.every(b=>b.id in SVB.l)));i++)await new Promise(z=>setTimeout(z,100))}catch(e){}}const l=await svLoad(),t=svTab(),d=document.createElement('div');d.className='sv60';d.dataset.noicon=1;
 const bands=(typeof BD!=='undefined'&&CLD.user)?BD.bands:[];const can=svCan(t);
 const L=(t=='me'?l.map(x=>({...x,me:1})):(SVB.l[t]||[])).filter(x=>x&&x.id!==CATHIDE_ID);/*v1.0.49: hide reserved cathide doc from saved-list UI*/
 const tabs=`<div class="svtabs" role="tablist"><button type="button" role="tab" data-svt="me" aria-selected="${t=='me'}">ของฉัน</button>${bands.map(b=>`<button type="button" role="tab" data-svt="${b.id}" aria-selected="${t==b.id}"><span data-noi18n>วง ${esc(b.name)}</span></button>`).join('')}</div>`;
 const hint=bands.length?'':`<div class="small svhint">${CLD.user?'เข้าร่วมหรือสร้างวง (เมนูบัญชี) เพื่อแชร์ลิสต์ให้ทุกคนในวงเห็น':'เข้าสู่ระบบและเข้าวง เพื่อแชร์ลิสต์ให้ทุกคนในวงเห็น'}</div>`;
 const save=`<button type="button" class="hw svsave" id="svadd" ${can?'':'disabled'}>${ico60('save')} <span>${t=='me'?'บันทึกลิสต์คืนนี้':'บันทึกลิสต์คืนนี้ให้วง'}</span>${can?'':' <span class="small">(ดูอย่างเดียว)</span>'}</button>`;
 const rows=L.length?L.map(x=>`<div class="svr"><button type="button" class="svl" data-svl="${x.id}"><b data-noi18n>${esc(x.n)}</b><span class="small"><span>${x.o.length} เพลง</span>${x.me?'':` · <span data-noi18n>${esc(x.byn||'สมาชิก')}</span>`} · ${svDate(x.t)}</span></button>${can?`<button type="button" class="hw" data-svo="${x.id}" aria-label="บันทึกทับ" title="บันทึกทับด้วยลิสต์คืนนี้">${ico60('save')}</button><button type="button" class="hw" data-svr="${x.id}" aria-label="เปลี่ยนชื่อ">${ico60('pencil')}</button><button type="button" class="hw" data-svd="${x.id}" aria-label="ลบ">${ico60('trash-2')}</button>`:''}</div>`).join('')
  :`<div class="small" style="padding:10px 2px">${t=='me'?'ยังไม่มีลิสต์ที่บันทึกไว้ — จัดลิสต์คืนนี้ แล้วกด “บันทึกลิสต์คืนนี้”':'วงนี้ยังไม่มีลิสต์ที่บันทึกไว้'}</div>`;
 d.innerHTML=(bands.length?tabs:'')+save+rows+hint;
 d.onclick=async e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.svt){localStorage.setItem('bp-svt',b.dataset.svt);return svOpen()}
  if(b.id=='svadd')return svAddTo(t);
  if(t=='me'){const L=await svLoad();
   if(b.dataset.svo){const it=L.find(x=>x.id==b.dataset.svo);if(!it)return;if(!SET.length){toast('ยังไม่มีเพลงในคืนนี้');return}if(!confirm('บันทึกทับ “'+it.n+'” ด้วยลิสต์คืนนี้ ('+SET.length+' เพลง)?'))return;
    const pk=svPack();Object.assign(it,{o:[...SET],p:pk.p,sn:pk.sn,t:Date.now()});await svSave();svOpen();toast('💾 บันทึกทับแล้ว: '+it.n,2000,true);return}
   if(b.dataset.svl)return svApply(b.dataset.svl);
   if(b.dataset.svr){const it=L.find(x=>x.id==b.dataset.svr);const n=(prompt('เปลี่ยนชื่อ',it.n)||'').trim();if(n){it.n=n.slice(0,60);await svSave();svOpen()}}
   if(b.dataset.svd){const it=L.find(x=>x.id==b.dataset.svd);if(confirm('ลบลิสต์ “'+it.n+'”?')){SV60.l=L.filter(x=>x!==it);await svSave();svOpen();toast('ลบแล้ว')}}return}
  const BL=SVB.l[t]||[];const it=BL.find(x=>x.id==(b.dataset.svl||b.dataset.svo||b.dataset.svr||b.dataset.svd));if(!it)return;
  if(b.dataset.svo){if(!svCan(t)){toast('สิทธิ์ดูอย่างเดียว');return}if(!SET.length){toast('ยังไม่มีเพลงในคืนนี้');return}if(!confirm('บันทึกทับ “'+it.n+'” ด้วยลิสต์คืนนี้ ('+SET.length+' เพลง)?'))return;
   try{await CLD.mod.bandSavedPut(t,it.id,{n:it.n,o:[...SET],d:JSON.stringify(svPack())});toast('💾 บันทึกทับให้ทั้งวงแล้ว: '+it.n,2200,true)}catch(e){toast('❌ บันทึกไม่ได้: '+bdErr(e),4000)}return}
  if(b.dataset.svl)return svApplyIt(svUnpack(it));
  if(b.dataset.svr){const n=(prompt('เปลี่ยนชื่อ',it.n)||'').trim();if(n)try{await CLD.mod.bandSavedPut(t,it.id,{n,o:it.o,d:it.d})}catch(e){toast('❌ '+bdErr(e),4000)}}
  if(b.dataset.svd&&confirm('ลบลิสต์ “'+it.n+'” ของวง? (ทุกคนในวงจะไม่เห็นอีก)'))try{await CLD.mod.bandSavedDel(t,it.id);toast('ลบแล้ว')}catch(e){toast('❌ '+bdErr(e),4000)}};
 open60('saved','ลิสต์ที่บันทึกไว้',d)}
function svBtn(){if(view!='S')return;const row=$('dlall')&&$('dlall').parentNode;if(!row||$('svlist'))return;const b=document.createElement('button');b.type='button';b.id='svlist';b.className='svbtn';b.dataset.noicon=1;
 b.innerHTML=`${ico60('folder-open')||ico60('folder')} <span>ลิสต์ที่บันทึก</span>`;b.onclick=()=>svOpen();row.appendChild(b)}
new MutationObserver(()=>{try{svBtn()}catch(e){}}).observe(document.body,{childList:true,subtree:true});
window.__sv62={sync:svbSync,band:SVB,tab:svTab,addTo:svAddTo,unpack:svUnpack};

// ===== v1.63b: mixer always visible under the waveform (+ stems hint); sections → tool sheets; band songs/saved lists live =====
// ---- 1. mixer: no accordion, sits right under the waveform; hint to add stems when the song has none ----
ACC.mix=true;['mk','fd','pad','cards'].forEach(k=>ACC[k]=true);
function mx63(){const st=$('studio'),mx=$('mixer'),wb=st&&st.querySelector('.wavebox');if(!st||!mx||!wb)return;
 if(wb.nextElementSibling!==mx)wb.after(mx);
 let h=$('sh63');if(!h){h=document.createElement('div');h.id='sh63';h.className='sh63';h.dataset.noicon=1;
  h.innerHTML=`<button type="button" class="hw sh63b" id="sh63b">${ico60('plus')} <span>เพิ่มแทร็กแยก (stems)</span></button><span class="small">ตอนนี้มิกซ์ได้แค่ <b>นอม</b> กับ <b>เพลง</b> — ถ้ามีไฟล์แยก กลอง/เบส/กีตาร์/ร้อง เลือกทีเดียวหลายไฟล์ (หรือ .zip) จะได้เฟดเดอร์แยกทุกแทร็ก</span><input type="file" id="sh63i" multiple accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.zip" hidden>`;
  h.querySelector('#sh63b').onclick=()=>h.querySelector('#sh63i').click();
  h.querySelector('#sh63i').onchange=async e=>{const f=[...e.target.files];e.target.value='';if(!f.length)return;toast('⏳ กำลังนำเข้า stems…',2000,true);try{const id=await ST.importStems(f);if(id&&SONG.get(id))await load(id)}catch(x){toast('❌ นำเข้า stems ไม่ได้: '+(x.message||x),4000)}}}
 const sm=$('stm63'),want=sm&&sm.parentNode===st?sm:mx;if(want.nextElementSibling!==h)want.after(h);
 const has=!!(cur&&cur.buf&&cur.buf.__st);if(h.hidden!==has)h.hidden=has}
// ---- 2. ท่อนเพลง / เฟดออก / Pad / คีย์·ความเร็ว → tool buttons + bottom sheets (elements are moved, never duplicated) ----
const M63={mk:()=>$('mkbar'),kt:()=>$('kt63')||(()=>{const g=document.querySelector('#plx>.grid');if(g)g.id='kt63';return g})(),pad:()=>$('padc'),fade:()=>$('fdrow')};
for(const [k,i,l] of [['mk','map-pin','ท่อนเพลง'],['kt','music','คีย์/ความเร็ว'],['pad','piano','Pad']])if(!T60.some(x=>x[0]==k))T60.push([k,i,l,[]]);
{const ord=['mk','kt','fade','pad','trim','ci','pv','bal','eq','note'];T60.sort((a,b)=>ord.indexOf(a[0])-ord.indexOf(b[0]))}
{const t=$('tb60');if(t)t.remove()}
function park63(){const st=$('studio');if(!st)return null;let p=$('park63');if(!p){p=document.createElement('div');p.id='park63';p.hidden=true;st.appendChild(p)}
 for(const k in M63){const e=M63[k]();if(e&&e.parentNode!==p&&!(OPEN60===k&&e.parentNode===$('bs60b')))p.appendChild(e)}return p}
{const _o=open60,_c=close60;
 open60=function(k,title,node){park63();_o(k,title,node);const f=M63[k]&&M63[k]();if(f){const b=$('bs60b'),a=$('advc');if(k=='fade'&&a&&a.parentNode===b)a.before(f);else b.appendChild(f);if(k!='fade'&&a)a.style.display='none';if(k=='pad')try{padUI()}catch(e){}if(k=='mk')try{mkUI()}catch(e){}}};
 close60=function(){_c();park63()}}
{const _a=act60;act60=function(k){if(!cur)return false;const p=pref(cur.id);if(k=='mk')return (p.mk||[]).length>0||!!p.lp;if(k=='kt')return (+p.key||0)!=0||(+p.tempo||100)!=100;if(k=='pad')return !!PAD.on;return _a(k)}}
window.__tb60.open=(...a)=>open60(...a);window.__tb60.close=()=>close60();
new MutationObserver(()=>{if(mx63.q)return;mx63.q=requestAnimationFrame(()=>{mx63.q=0;try{mx63();if(!OPEN60||!M63[OPEN60])park63()}catch(e){}})}).observe(document.body,{childList:true,subtree:true});
setInterval(()=>{try{mx63()}catch(e){}},700);

// ---- 3. band songs (metadata) + band saved lists: live for every member, missing audio shown as “ต้องมีไฟล์ในเครื่อง” ----
const BS={l:{},un:{},kc:new Map(),seen:{},t0:Date.now(),busy:0};
async function bsKey(t,a){const c=t+'\u0001'+(a||'');if(!BS.kc.has(c))BS.kc.set(c,'k'+await slId(nk(t)+'|'+nk(a||''),10));return BS.kc.get(c)}
function bsMe(){return BD.uid||''}
function bsNote(kind,b,x){if(!x||x.by===bsMe()||x.t<BS.t0)return;const k=kind+b+x.id+(kind=='s'?'':x.t);if(BS.seen[k])return;BS.seen[k]=1;const bn=(BD.bands.find(y=>y.id==b)||{}).name||'';
 toast(kind=='s'?`👥 ${x.byn||'สมาชิก'} เพิ่มเพลง “${x.ti}” ให้วง ${bn}`:`👥 ${x.byn||'สมาชิก'} บันทึกลิสต์ “${x.n}” ให้วง ${bn}`,3500,true)}
// override: saved-list listener retries (cloud.js) + toasts + badge; song listener alongside
svbSync=function(){const on=typeof BD!=='undefined'&&CLD.user&&CLD.mod&&CLD.mod.bandSavedSub;const ids=new Set(on?BD.bands.map(b=>b.id):[]);
 for(const k in SVB.un)if(!ids.has(k)){try{SVB.un[k]()}catch(e){}delete SVB.un[k];delete SVB.l[k]}
 for(const k in BS.un)if(!ids.has(k)){try{BS.un[k]()}catch(e){}delete BS.un[k];delete BS.l[k]}
 if(!on)return;
 for(const b of BD.bands){if(!SVB.un[b.id])SVB.un[b.id]=CLD.mod.bandSavedSub(b.id,ls=>{const first=!(b.id in SVB.l);SVB.l[b.id]=ls.sort((a,b)=>b.t-a.t);try{libHideSyncBand149();if(!first)libHideRefresh149()}catch(e){}if(!first)ls.forEach(x=>bsNote('l',b.id,x));if(OPEN60=='saved')svOpen();sv63Badge()},e=>blog('warn','band saved',e.code||e.message));
  if(!BS.un[b.id]&&CLD.mod.bandSongsSub)BS.un[b.id]=CLD.mod.bandSongsSub(b.id,ls=>{const first=!(b.id in BS.l);BS.l[b.id]=ls;try{all842()}catch(e){}if(!first)ls.forEach(x=>bsNote('s',b.id,x));try{bdSDraw()}catch(e){}bsPubSoon()},e=>blog('warn','band songs',e.code||e.message))}};
function sv63Seen(){try{return JSON.parse(localStorage.getItem('bp-sv63seen')||'[]')}catch(e){return[]}}
function sv63New(){const s=sv63Seen();let n=0;for(const b in SVB.l)for(const x of SVB.l[b])if(x.by!==bsMe()&&!s.includes(x.id+x.t))n++;return n}
function sv63Badge(){const b=$('svlist');if(!b)return;const n=sv63New();let d=b.querySelector('.sv63n');if(!n){if(d)d.remove();return}if(!d){d=document.createElement('span');d.className='sv63n';b.appendChild(d)}d.textContent=n}
setInterval(()=>{try{sv63Badge()}catch(e){}},1500);
// publish my uploaded songs (files I imported, incl. stems) to every band I can edit — metadata only
function bsPubSoon(){clearTimeout(bsPubSoon.t);bsPubSoon.t=setTimeout(()=>bsPub().catch(e=>blog('warn','band songs pub',e.code||e.message)),2500)}
async function bsPub(){if(BS.busy||!CLD.user||!CLD.mod||!CLD.mod.bandSongsPut)return;BS.busy=1;try{
 const mine=[];for(const [id,s] of SONG){if(!(s.X||(META[id]&&META[id].bx))||!s.t||!fileOf(s))continue;if(/\(CC BY 3\.0\)\.stems$|\(ตัวอย่างครึ่งเพลง\)/.test(s.fn||'')&&!(META[id]&&META[id].bx))continue;const bx=s.fn&&(bsFind842(id)[0]||fn845(s.fn));mine.push({id:bx?bx.x.id:await bsKey(s.t,s.a),ti:s.t,ar:s.a||'',sd:s.s||'X',fn:s.fn||'',sid:id})}BS.mine=new Map(mine.map(m=>[m.id,m.sid]));
 for(const b of BD.bands){if(bdRole(b)==='viewer'||!(b.id in BS.l))continue;const have=new Set(BS.l[b.id].map(x=>x.id));const add=[],seen=new Set();for(const m of mine)if(!have.has(m.id)&&!seen.has(m.id)){seen.add(m.id);add.push(m)}
  if(add.length){await CLD.mod.bandSongsPut(b.id,add);blog('info','band songs published '+add.length)}}}finally{BS.busy=0}}
setInterval(()=>{try{if(CLD.user&&BD.bands.length)bsPub().catch(()=>{})}catch(e){}},15000);
{const _ri=rebuildIndex;rebuildIndex=function(){const r=_ri.apply(this,arguments);try{bsPubSoon();bsRematch()}catch(e){}return r}}
// live band list: remember the raw doc; songs without a local file are listed (not silently dropped) and re-matched after import
{const _la=lvApply;lvApply=async function(d){if(LIVE&&d)LIVE.__d=d;for(const [k,v] of LVMAP)if(v==null)LVMAP.delete(k);const r=await _la(d);try{bdSDraw()}catch(e){}return r}}
function bsRematch(){clearTimeout(bsRematch.t);bsRematch.t=setTimeout(()=>{try{if(LIVE&&LIVE.__d&&[...LVMAP.values()].some(v=>v==null)){LIVE.o=[];lvApply(LIVE.__d).then(()=>render()).catch(()=>{})}else bdSDraw()}catch(e){}},400)}
function bsLiveMiss(){const d=LIVE&&LIVE.__d;if(!d||!d.s)return [];const r=[];for(const k of d.o||[]){if(LVMAP.get(k))continue;try{const x=JSON.parse(d.s[k]);r.push({id:k,ti:x[0]||'',ar:x[1]||''})}catch(e){}}return r}
function bsMiss(b){const out=[],ids=new Set();const lv=LIVE&&LIVE.b===b.id?bsLiveMiss():[];
 for(const x of lv){ids.add(x.id);out.push({...x,inl:1})}
 for(const x of BS.l[b.id]||[]){if(ids.has(x.id)||!x.ti)continue;if(slMatch(x.ti,x.ar,x.sd))continue;ids.add(x.id);out.push(x)}return out}
{const _h=bdSHtml;bdSHtml=function(){const r=_h();let h=r.h;for(const b of BD.bands){const all=(BS.l[b.id]||[]).length,ms=bsMiss(b);if(!all&&!ms.length)continue;
  h+=`<div class="bdsb bs63" data-b="${b.id}"><div class="small"><b>เพลงของวง</b> <span data-noi18n>${esc(b.name)}</span> · ${all} เพลง${ms.length?` · <span class="bs63w">ต้องมีไฟล์ในเครื่อง ${ms.length}</span>`:' · มีครบในเครื่อง'}</div>`;
  for(const x of ms.slice(0,30))h+=`<div class="row bs63r"><span class="bs63t"><b data-noi18n>${esc(x.ti)}</b>${x.ar?` <span class="small" data-noi18n>– ${esc(x.ar)}</span>`:''}<span class="small"> · ต้องมีไฟล์ในเครื่อง${x.inl?' · อยู่ในลิสต์ที่ซิงก์':''}${x.byn?` · <span data-noi18n>จาก ${esc(x.byn)}</span>`:''}</span></span><button type="button" class="hw" data-a63="imp">นำเข้าไฟล์</button></div>`;
  if(ms.length)h+=`<div class="small bs63h">เพลงเหล่านี้ยังไม่มีไฟล์ในวง — แอปของคนที่มีไฟล์จะส่งขึ้นให้อัตโนมัติเมื่อเขาเปิดแอป · ถ้ารีบ ขอไฟล์แล้วกด “นำเข้าไฟล์”</div>`;
  h+=`</div>`}return {h,n:r.n}}}
document.addEventListener('click',e=>{const t=e.target.closest('[data-a63="imp"]');if(!t)return;let i=$('bs63i');if(!i){i=document.createElement('input');i.type='file';i.id='bs63i';i.multiple=true;i.accept='audio/*,.mp3,.wav,.m4a,.aac';i.hidden=true;document.body.appendChild(i);i.onchange=async()=>{const f=[...i.files];i.value='';if(f.length){await importFiles(f);bsRematch()}}}i.click()});
// saved lists sheet: personal rows get “แชร์ให้วง”; opening the sheet clears the new-badge
{const _so=svOpen;svOpen=async function(){await _so();try{localStorage.setItem('bp-sv63seen',JSON.stringify(Object.values(SVB.l).flat().map(x=>x.id+x.t).slice(-300)))}catch(e){}sv63Badge();
 const d=document.querySelector('#bs60b .sv60');if(!d||svTab()!='me')return;const eb=(typeof BD!=='undefined'&&CLD.user)?BD.bands.filter(b=>bdRole(b)!=='viewer'):[];if(!eb.length)return;
 d.querySelectorAll('.svr').forEach(r=>{const l=r.querySelector('[data-svl]');if(!l||r.querySelector('[data-svs]'))return;const b=document.createElement('button');b.type='button';b.className='hw';b.dataset.svs=l.dataset.svl;b.setAttribute('aria-label','แชร์ให้วง');b.title='แชร์ให้วง';b.innerHTML=ico60('users');l.after(b)});
 d.addEventListener('click',async e=>{const b=e.target.closest('[data-svs]');if(!b)return;e.stopPropagation();const it=(await svLoad()).find(x=>x.id==b.dataset.svs);if(!it)return;
  let bd=eb[0];if(eb.length>1){const n=prompt('แชร์ให้วงไหน? พิมพ์เลข\n'+eb.map((x,i)=>(i+1)+'. '+x.name).join('\n'),'1');bd=eb[(+n||0)-1];if(!bd)return}
  const tt={};for(const id of it.o){const x=SONG.get(id);if(x)tt[id]=[x.t||'',x.a||'',x.s||'']}const L=SVB.l[bd.id]||[],ex=L.find(x=>x.n===it.n);if(ex&&!confirm('วงมีลิสต์ชื่อ “'+it.n+'” แล้ว — บันทึกทับ?'))return;
  try{await CLD.mod.bandSavedPut(bd.id,ex?ex.id:svId(),{n:it.n,o:it.o,d:JSON.stringify({p:it.p||{},sn:it.sn||{},tt})});toast('👥 แชร์ลิสต์ “'+it.n+'” ให้วง '+bd.name+' แล้ว',2500,true)}catch(x){toast('❌ แชร์ไม่ได้: '+bdErr(x),4000)}},true)}}
// after saving to “ของฉัน” while in a band, say clearly that the band does not see it
{const _sa=svAdd;svAdd=async function(){const n0=(await svLoad()).length;await _sa();if((await svLoad()).length!==n0&&CLD.user&&BD.bands.some(b=>bdRole(b)!=='viewer'))setTimeout(()=>toast('บันทึกไว้ในเครื่องคุณ — ถ้าอยากให้วงเห็น กดปุ่ม 👥 ที่ลิสต์ หรือเลือกแท็บวง',4000,true),2100)}}
// saved band list loaded with songs missing on this device → say which ones
{const _ap=svApplyIt;svApplyIt=async function(it){await _ap(it);const ms=(it.o||[]).filter(x=>!SONG.get(x));if(ms.length)setTimeout(()=>toast(`⚠️ ${ms.length} เพลงต้องมีไฟล์ในเครื่อง — ดูที่ “เพลงของวง” ในแท็บคืนนี้`,4000),2600)}}
window.__bs63={s:BS,pub:bsPub,miss:bsMiss,rematch:bsRematch};

// ===== v1.64: explicit save target (hotfix: lists were saved to “ของฉัน” by default and never reached the band) =====
{const _so=svOpen;svOpen=async function(){const eb=(typeof BD!=='undefined'&&CLD.user)?BD.bands.filter(b=>bdRole(b)!=='viewer'):[];
 if(eb.length&&!localStorage.getItem('bp-svt'))localStorage.setItem('bp-svt',eb[0].id);
 await _so();const d=document.querySelector('#bs60b .sv60');if(!d||svTab()!='me'||!eb.length)return;const a=d.querySelector('#svadd');if(!a)return;
 a.querySelector('span').textContent='บันทึกเฉพาะเครื่องนี้ (วงไม่เห็น)';a.classList.add('sv64me');
 for(const b of eb.slice().reverse()){const x=document.createElement('button');x.type='button';x.className='hw svsave sv64b';x.dataset.svab=b.id;x.innerHTML=`${ico60('users')} <span>บันทึกให้วง <span data-noi18n>${esc(b.name)}</span></span>`;a.before(x)}
 d.addEventListener('click',async e=>{const x=e.target.closest('[data-svab]');if(!x)return;e.stopPropagation();const id=x.dataset.svab;await svAddTo(id);if(OPEN60=='saved'&&(SVB.l[id]||[]).length){localStorage.setItem('bp-svt',id);svOpen()}},true)}}

// ===== v1.65: band song audio stored in Firestore (auto-compressed, chunked, auto-download on play) + Live tempo/auto/key + Studio per-song pad & preview =====
// v1.77: Firestore daily quota hit → calm banner, pause background band sync, retry in 1 h
const QX77={until:0};addEventListener('bp-quota',()=>{const first=Date.now()>QX77.until;QX77.until=Date.now()+36e5;const b=$('qb');if(b){b.style.display='block';b.textContent='ระบบเต็มชั่วคราว ลองใหม่พรุ่งนี้ · เพลงที่โหลดเก็บไว้แล้วยังเล่นได้ตามปกติ'}if(first)blog('warn','firestore quota');setTimeout(()=>{if(Date.now()>=QX77.until&&b)b.style.display='none'},36e5+1000)});window.__qx=QX77;
const BC={busy:0,dl:new Map(),fail:{},last:null,an:new Set(),cap:700e6};
function bcPill(t){let p=$('bc65p');if(!t){if(p)p.remove();return}if(!p){p=document.createElement('div');p.id='bc65p';p.setAttribute('aria-live','polite');document.body.appendChild(p)}p.textContent=t}
function bcMB(n){return (n/1048576).toFixed(n<10485760?1:0)+' MB'}
function bcUsed(bid){const b=(BD.bands||[]).find(x=>x.id==bid);if(b&&b.ub!=null)return b.ub|0;return (BS.l[bid]||[]).reduce((a,x)=>a+(x.fc?x.fz||0:0),0)}
const bcCap=bid=>{const b=(BD.bands||[]).find(x=>x.id==bid);return b&&b.cap>0?b.cap:314572800};
function bcAllUsed(){let t=0;for(const b of BD.bands||[])t+=bcUsed(b.id);return t}
const bcOAC=()=>new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,1,44100);
async function bcDecode(blob){const ab=await blob.arrayBuffer();return await new Promise((ok,no)=>{try{const p=bcOAC().decodeAudioData(ab,ok,no);if(p&&p.catch)p.catch(no)}catch(e){no(e)}})}
function bcEnc(ch,sr,kbps,prog){return new Promise((ok,no)=>{const w=new Worker('enc65.js');w.onmessage=e=>{const d=e.data;if(d.p!=null){prog&&prog(d.p);return}w.terminate();d.err?no(new Error(d.err)):ok(d.mp3)};w.onerror=e=>{w.terminate();no(new Error(e.message||'encoder'))};w.postMessage({ch,sr,kbps},ch.map(c=>c.buffer))})}
// v1.79: never downmix (mono L+R averaging destroyed click/music songs with unknown side). mp3/m4a up to 12 MB sent as-is; else stereo 128k mp3.
// unknown side ('X'): detect a click-only channel (mostly silent, short bursts) and mark the song L/R.
function bcSide(buf){if(buf.numberOfChannels<2)return null;const sr=buf.sampleRate,fr=Math.round(sr*0.01),q=[0,1].map(c=>{const d=buf.getChannelData(c),n=Math.floor(d.length/fr),r=new Float32Array(n);let mx=0;for(let k=0;k<n;k++){let e=0;for(let i=k*fr;i<(k+1)*fr;i+=4)e+=d[i]*d[i];r[k]=Math.sqrt(e/(fr/4));if(r[k]>mx)mx=r[k]}let z=0;for(let k=0;k<n;k++)if(r[k]<mx*0.05)z++;return n&&mx>1e-4?z/n:1});
 if(q[0]>0.6&&q[1]<0.25)return 'L';if(q[1]>0.6&&q[0]<0.25)return 'R';return null}
async function bcPrep(s,prog){if(BC.last&&BC.last.fn==s.fn)return BC.last;const rec=await get('files',(!s.X&&fileOf(s))||s.fn);if(!rec||!rec.blob||rec.src=='stems')return null;const bl=rec.blob,ty=(bl.type||'').toLowerCase(),nm=(s.fn||'').toLowerCase();let r;
 if(bl.size<=12e6&&(/mpeg|mp3|mp4|m4a|aac/.test(ty)||/\.(mp3|m4a|aac)$/.test(nm)))r={u8:new Uint8Array(await bl.arrayBuffer()),m:ty||'audio/mpeg'};
 else{let buf=await bcDecode(bl);const st=buf.numberOfChannels>1;
  if(st&&s.s!='L'&&s.s!='R'){const sd=bcSide(buf);if(sd){s.s=sd;const sid=[...SONG].find(([k,v])=>v===s);if(sid){META[sid[0]]={...(META[sid[0]]||{}),s:sd};try{await put('kv',{k:'meta',v:META})}catch(e){}}blog('info','band side auto '+sd+' '+s.fn)}}
  const ch=st?[buf.getChannelData(0).slice(),buf.getChannelData(1).slice()]:[buf.getChannelData(0).slice()];
  const sr=buf.sampleRate;buf=null;r={u8:await bcEnc(ch,sr,st?128:96,prog),m:'audio/mpeg'}}
 r.fn=s.fn;BC.last=r;return r}
function bcPending(){const out=[];if(!BS.mine)return out;for(const b of BD.bands||[]){if(bdRole(b)==='viewer'||!BS.l[b.id])continue;for(const x of BS.l[b.id])if(!x.fc&&BS.mine.has(x.id)&&(BC.fail[b.id+x.id]||0)<3)out.push({b:b.id,x})}return out}
async function bcTick(){if(Date.now()<QX77.until)return;if(BC.busy||!CLD.user||!CLD.mod||!CLD.mod.bandFilePut||!navigator.onLine)return;const ps=pstate();if(ps=='playing'||ps=='loading')return;
 const pend=bcPending();if(!pend.length){BC.last=null;return}const {b,x}=pend[0];const s=SONG.get(BS.mine.get(x.id));if(!s||s.bc)return;BC.busy=1;
 const lab=`☁︎ ส่งเพลงให้วง ${pend.length>1?'(เหลือ '+pend.length+') ':''}· ${s.t}`;
 try{bcPill(lab+' · ย่อไฟล์');const r=await bcPrep(s,p=>bcPill(lab+' · ย่อไฟล์ '+Math.round(p*100)+'%'));if(!r){BC.fail[b+x.id]=9;return}
  if(r.u8.length>36e6){BC.fail[b+x.id]=9;blog('warn','band file too big '+s.fn);return}
  if(bcUsed(b)+r.u8.length>bcCap(b)){bcPill('');const bn=((BD.bands||[]).find(z=>z.id==b)||{}).name||'';toast(`☁︎ พื้นที่เพลงของวง ${bn} เต็ม (${bcMB(bcCap(b))}) — ลบเพลงที่ไม่ใช้ออก หรือติดต่อทีมงานเพื่อเพิ่มพื้นที่`,5000);BC.fail[b+x.id]=9;return}
  if(bcAllUsed()+r.u8.length>BC.cap){bcPill('');toast('☁︎ พื้นที่เพลงของวงใกล้เต็ม (~700 MB) — ไม่ส่งเพลงเพิ่ม ลบเพลงที่ไม่ใช้ออกก่อน',5000);BC.fail[b+x.id]=9;return}
  await CLD.mod.bandFilePut(b,x.id,r.u8,r.m,p=>bcPill(lab+' '+Math.round(p*100)+'%'));x.fc=Math.ceil(r.u8.length/CLD.mod.BCH);x.fz=r.u8.length;blog('info','band file up '+s.fn+' '+r.u8.length)}
 catch(e){BC.fail[b+x.id]=(e.code=='bp/band-full'||e.code=='resource-exhausted')?9:(BC.fail[b+x.id]||0)+1;if(e.code=='bp/band-full')toast('☁︎ พื้นที่เพลงของวงเต็ม',4000);blog('warn','band file up',e.code||e.message)}
 finally{BC.busy=0;bcPill('');try{bdSDraw()}catch(e){}if(bcPending().length)setTimeout(()=>bcTick().catch(()=>{}),1500)}}
setInterval(()=>{try{bcTick().catch(()=>{})}catch(e){}},20000);
// songs other members shared become playable entries right away; the audio downloads on first play
function bcVirt(){let n=0;for(const b of BD.bands||[])for(const x of BS.l[b.id]||[]){if(!x.fc||!x.fn||!x.ti)continue;const id='X:'+x.fn;const fo=FILES.get(x.fn);if(fo&&fo.src=='band'&&((x.fz&&fo.size!==x.fz)||(x.v&&(fo.bv||0)!==x.v))&&!BC.dl.has(x.fn)){FILES.delete(x.fn);del('files',x.fn).catch(()=>{});cache.delete(id);const e=SONG.get(id);if(e){e.bc={b:b.id,id:x.id,fc:x.fc,fm:x.fm,v:x.v||0};if(x.sd)e.s=x.sd}blog('info','band file stale '+x.fn);continue}
  if(SONG.has(id)){const e=SONG.get(id);if(e.bc)e.bc={b:b.id,id:x.id,fc:x.fc,fm:x.fm,v:x.v||0};sd838(id,e,x);continue}if(FILES.has(x.fn)||cat845(x.fn).length||slMatch(x.ti,x.ar,x.sd))continue;
  SONG.set(id,{X:1,s:x.sd||'X',fn:x.fn,t:x.ti,a:x.ar||'',f:'เพลงของวง',g:'',k:x.k||'',_pp:1,bc:{b:b.id,id:x.id,fc:x.fc,fm:x.fm,v:x.v||0}});n++}
 if(n){try{render()}catch(e){}try{bsRematch()}catch(e){}}return n}
{const _ri=rebuildIndex;rebuildIndex=function(){const r=_ri.apply(this,arguments);try{bcVirt()}catch(e){}return r}}
{const _bp=bsPubSoon;bsPubSoon=function(){_bp.apply(this,arguments);try{bcVirt()}catch(e){}clearTimeout(bsPubSoon.u);bsPubSoon.u=setTimeout(()=>bcTick().catch(()=>{}),6000)}}
async function bcGet(s){const k=s.fn;if(BC.dl.has(k))return BC.dl.get(k);
 const p=(async()=>{if(!CLD.user||!CLD.mod||!CLD.mod.bandFileGet)throw new Error('ต้องเข้าสู่ระบบวงก่อน');if(!navigator.onLine)throw new Error('ไม่มีเน็ต');const {b,id,fc,fm}=s.bc;const bc0=s.bc;
  bcPill('⬇ โหลดเพลงจากวง · '+s.t);const parts=await CLD.mod.bandFileGet(b,id,fc,f=>bcPill(`⬇ โหลดเพลงจากวง · ${s.t} ${Math.round(f*100)}%`));const blob=new Blob(parts,{type:fm||'audio/mpeg'});
  await safePut({name:k,blob,size:blob.size,added:Date.now(),src:'band',bv:s.bc.v||0});FILES.set(k,{name:k,size:blob.size,src:'band',bv:s.bc.v||0});const sid='X:'+k;META[sid]={...(META[sid]||{}),t:s.t,a:s.a||'',s:s.s};try{await put('kv',{k:'meta',v:META})}catch(e){}
  if(s.bc===bc0)delete s.bc;bcPill('');blog('info','band file down '+k+' '+blob.size);setTimeout(()=>{try{rebuildIndex();render()}catch(e){}},800);return blob})();
 BC.dl.set(k,p);p.catch(e=>{bcPill('');blog('warn','band file down',e.code||e.message);toast('❌ โหลดเพลงจากวงไม่ได้ ('+(e.message||e)+') — ลองใหม่ หรือขอไฟล์แล้วกด “นำเข้าไฟล์”',6000)}).finally(()=>BC.dl.delete(k));return p}
{const _fa=fetchAudio;fetchAudio=async function(s){if(s&&s.bc)return bcGet(s);return _fa.apply(this,arguments)}}
async function bc65Del(fn){const s=SONG.get('X:'+fn);if(!s||!s.t||!CLD.user||!CLD.mod||!CLD.mod.bandSongDel)return;const k=(bsFind842('X:'+fn)[0]||{x:{id:await bsKey(s.t,s.a)}}).x.id;
 const hit=(BD.bands||[]).filter(b=>bdRole(b)!=='viewer').map(b=>({b,x:(BS.l[b.id]||[]).find(y=>y.id==k&&y.by===bsMe())})).filter(o=>o.x);if(!hit.length)return;
 if(!confirm('ลบเพลง “'+s.t+'” ออกจากวง ('+hit.map(o=>o.b.name).join(', ')+') ด้วยไหม?\nคนในวงจะไม่เห็นเพลงนี้อีก และพื้นที่จะคืนกลับมา'))return;
 for(const o of hit){try{await CLD.mod.bandSongDel(o.b.id,k,o.x.fc||null);toast('🗑 ลบออกจากวง '+o.b.name+' แล้ว',2500,true)}catch(e){toast('❌ ลบออกจากวงไม่ได้: '+bdErr(e),4000)}}}
// per-band storage indicator
{const _h=bdSHtml;bdSHtml=function(){const r=_h();let h=r.h;for(const b of BD.bands||[]){const L=BS.l[b.id]||[];if(!L.length)continue;const sh=L.filter(x=>x.fc).length,up=bcPending().filter(p=>p.b==b.id).length;
  h+=`<div class="small bs65s" data-b="${b.id}">${ico60('cloud')} <span data-noi18n>${esc(b.name)}</span> · ไฟล์ในวง ${sh}/${L.length} เพลง · ใช้พื้นที่ ${bcMB(bcUsed(b.id))} / ${bcMB(bcCap(b.id))}${up?` · กำลังส่ง ${up}`:''}</div>`}return {h,n:r.n}}}
// --- key / BPM for every setlist song (analysed in the background while nothing plays) ---
async function an65(id){const s=SONG.get(id);if(!s)return;const fn=fileOf(s);const rec=fn&&await get('files',fn);if(!rec||!rec.blob||rec.src=='stems')return;let buf=await bcDecode(rec.blob);const nc=buf.numberOfChannels;
 const kc=Math.min(nc-1,(s.s=='L'||s.s=='R')?1-clickCh(id):0),bc=Math.min(nc-1,clickCh(id));
 if(!songKey(id)&&!KEYD[id]){try{KEYD[id]=detectKey(buf,kc)||{r:null};localStorage.setItem('bp-keyd',JSON.stringify(KEYD))}catch(e){}}
 if(!(id in BPMD)){try{BPMD[id]=detectBpm(buf,bc)||{b:null};localStorage.setItem('bp-bpmd',JSON.stringify(BPMD))}catch(e){}}buf=null;try{scChipPatch($('strip'));scChipPatch($('livelist'))}catch(e){}}
let AN82=Date.now();['pointerdown','keydown'].forEach(ev=>addEventListener(ev,()=>{AN82=Date.now()},{capture:true,passive:true}));
setInterval(()=>{if(BC.anBusy)return;const ps=pstate();if(ps=='playing'||ps=='loading')return;if(document.visibilityState!=='visible'||(typeof PAD!=='undefined'&&PAD.on)||Date.now()-AN82<30000||(ctx&&ctx.state!=='running'&&cur))return;const id=SET.find(i=>!BC.an.has(i)&&(!songKey(i)&&!KEYD[i]||!(i in BPMD)&&!baseBpm(i))&&(()=>{const s=SONG.get(i);return s&&fileOf(s)&&!s.bc})());if(!id)return;
 BC.an.add(id);BC.anBusy=1;an65(id).catch(e=>blog('warn','analyse '+id,e.message)).finally(()=>BC.anBusy=0)},4000);
// --- Studio: per-song pad + preview on the strip cards; key/BPM always shown ---
scChips=function(i){let kn='–',bb='–';try{const k=songKey(i),sh=pref(i).key||0,b=realBpm(i);if(k)kn=keyName({r:((k.r+sh)%12+12)%12,m:k.m,sp:k.sp});if(b)bb=Math.round(b)}catch(e){}
 return `<div class="scc"><span class="chip k">${kn}</span><span class="chip b">${bb} BPM</span></div><div class="sc65"><button type="button" class="hw" data-p65="pad" data-id="${esc(i)}" aria-label="Pad ลูปคีย์เพลง" title="Pad ลูปคีย์เพลง">${ico60('keyboard')}</button><button type="button" class="hw" data-p65="pv" data-id="${esc(i)}" aria-label="พรีวิว" title="พรีวิว (ออกฝั่งเดียวกับนอม)">${ico60('headphones')}</button></div>`};
function clickSide65(id){try{const m=mixOf(id);const o=m.c&&m.c.o;return o=='L'||o=='R'?o:outDef(clickCh(id),pref(id).swap)}catch(e){return 'L'}}
async function pv65(id){if(PV.id==id&&PV.el&&!PV.el.paused){pvStop();return}const o=PV.out,dev=String(o||'').startsWith('dev:');if(!dev)PV.out=clickSide65(id);try{await pvPlay(id)}finally{if(!dev)PV.out=o}}
{const _pt=padTarget;padTarget=function(){if(PAD.sid){const k=songKey(PAD.sid);if(k)return{k,shift:pref(PAD.sid).key||0}}return _pt()}}
// v1.81.1: pad works for any song in the set (next/queued too), not only the one that is playing
async function key811(id){if(songKey(id))return true;try{await an65(id)}catch(e){}if(songKey(id))return true;
 try{const buf=await decode(id);const s=SONG.get(id),nc=buf.numberOfChannels,kc=Math.min(nc-1,s&&(s.s=='L'||s.s=='R')?1-clickCh(id):0);if(!KEYD[id]||KEYD[id].r==null){KEYD[id]=detectKey(buf,kc)||{r:null};localStorage.setItem('bp-keyd',JSON.stringify(KEYD))}try{scChipPatch($('strip'));scChipPatch($('livelist'))}catch(e){}}catch(e){blog('warn','pad key',e&&e.message)}return !!songKey(id)}
async function pad65(id){const tid=PAD.sid||(cur&&cur.id);if(PAD.on&&tid==id){padOff(1.5);PAD.sid=null;PAD.wait=false;return}
 if(!songKey(id)){toast('🎹 กำลังหาคีย์เพลง…',1500,true);if(!await key811(id)){toast('🎹 ยังไม่รู้คีย์เพลงนี้ — เปิดเพลงแล้วตั้งคีย์ในการ์ด 🎹 Pad',3500);return}}
 const isCur=!!cur&&cur.id==id&&playing;
 if(PAD.on){PAD.sid=id;PAD.wait=!isCur;try{padRetune2()}catch(e){}try{padUI()}catch(e){}return}
 PAD.sid=id;if(padOn()===false){PAD.sid=null;return}PAD.wait=!isCur;try{padUI()}catch(e){}}
setInterval(()=>{try{const L=document.querySelectorAll('#livelist .lvl .sc[data-sid]');if(!L.length)return;const i=cur?SET.indexOf(cur.id):-1,want=new Set([cur&&cur.id,SET[i+1]].filter(Boolean));L.forEach(c=>{const w=want.has(c.dataset.sid);if(c.classList.contains('p811')!==w)c.classList.toggle('p811',w)})}catch(e){}},400);
padSongStart=function(){if(!PAD.on||!PAD.wait||!cur)return;if(PAD.sid&&PAD.sid!==cur.id)return;PAD.wait=false;PAD.sid=null;if(localStorage.getItem('bp-padend')!=='keep')padOff(+(localStorage.getItem('bp-padxf')||4))};
// --- Live: tempo −/+, auto-continue, big key + BPM ---
function lv65(){const lv=$('livelist');if(!lv||!document.body.classList.contains('live'))return;const nw=lv.querySelector('.lvnow');if(!nw)return;let b=lv.querySelector('.lv65');
 if(!b){b=document.createElement('div');b.className='lv65';b.innerHTML=`<div class="lv65k"><span class="lab">KEY</span><b id="lv65k">–</b></div><div class="lv65t"><button type="button" class="hw" data-l65="-1" aria-label="ลด Tempo">−</button><div class="lv65bv"><b id="lv65b">–</b><span class="lab">BPM</span></div><button type="button" class="hw" data-l65="1" aria-label="เพิ่ม Tempo">+</button></div><button type="button" class="hw lv65a" data-l65="a" aria-label="เล่นต่อเนื่องอัตโนมัติ">${ico60('repeat')}<span>ต่อเนื่อง</span></button>`;nw.after(b)}
 const id=cur&&cur.id;let kn='–',bb='–';if(id){try{const k=songKey(id),sh=pref(id).key||0,r=realBpm(id);if(k)kn=keyName({r:((k.r+sh)%12+12)%12,m:k.m,sp:k.sp});if(r)bb=Math.round(r);else bb=(pref(id).tempo||100)+'%'}catch(e){}}
 const st=(e,t)=>{if(e&&e.textContent!=t)e.textContent=t};st(b.querySelector('#lv65k'),kn);st(b.querySelector('#lv65b'),bb);st(b.querySelector('.lv65bv .lab'),String(bb).endsWith('%')?'TEMPO':'BPM');const a=b.querySelector('.lv65a');a.classList.toggle('on',!!AUTO.on);if(a.getAttribute('aria-pressed')!==(AUTO.on?'true':'false'))a.setAttribute('aria-pressed',AUTO.on?'true':'false')}
function tempoStep65(d){if(!cur){toast('เลือกเพลงก่อน',1500);return}const id=cur.id,t0=pref(id).tempo||100,b=baseBpm(id);let t=b?(Math.round(b*t0/100)+d)/b*100:t0+d;if(Math.round(t*2)/2==t0)t=t0+d*0.5;
 tempoLive(t);put('prefs',pref(id)).catch(()=>{});try{tempoUI()}catch(e){}try{syncUI()}catch(e){}try{scChipPatch($('strip'));scChipPatch($('livelist'))}catch(e){}lv65()}
document.addEventListener('click',e=>{const t=e.target.closest('[data-p65],[data-l65]');if(!t)return;e.preventDefault();e.stopPropagation();
 if(t.dataset.p65=='pv')pv65(t.dataset.id).catch(()=>{});else if(t.dataset.p65=='pad')pad65(t.dataset.id).catch(()=>{});
 else if(t.dataset.l65=='a'){AUTO.on=!AUTO.on;if(!AUTO.on)cancelCd();saveAuto();toast(AUTO.on?'เล่นต่อเนื่องอัตโนมัติ: เปิด':'เล่นต่อเนื่องอัตโนมัติ: ปิด',1500,true);lv65()}
 else tempoStep65(+t.dataset.l65)},true);
{const _sd=stripDraw;stripDraw=function(){const r=_sd.apply(this,arguments);try{lv65()}catch(e){}return r}}
let SIG65='';setInterval(()=>{try{if(cur&&$('kv')){const t=kl65(cur.id);if($('kv').textContent!==t)$('kv').textContent=t}}catch(e){}try{if(!PAD.on&&!PAD.re)PAD.sid=null;const sig=SET.map(i=>{const k=songKey(i);return (k?k.r+'.'+k.m+'.'+(pref(i).key||0):'')+','+Math.round(realBpm(i)||0)}).join('|');if(sig!=SIG65){SIG65=sig;scChipPatch($('strip'));scChipPatch($('livelist'))}
 document.querySelectorAll('[data-p65]').forEach(b=>{const id=b.dataset.id,on=b.dataset.p65=='pad'?PAD.on&&PAD.sid==id:PV.id==id&&PV.el&&!PV.el.paused;if(b.classList.contains('on')!=!!on){b.classList.toggle('on',!!on);if(b.dataset.p65=='pv'&&b.dataset.i847!==(on?'s':'h')){b.dataset.i847=on?'s':'h';b.innerHTML=ico60(on?'square':'headphones')}}});lv65()}catch(e){}},700);
window.__bc65={song:i=>SONG.get(i),files:()=>[...FILES.keys()],cld:()=>CLD.mod,set:()=>SET,s:BC,tick:bcTick,virt:bcVirt,get:bcGet,prep:bcPrep,used:bcUsed,an:an65,pv:pv65,pad:pad65,lv:lv65,step:tempoStep65};

// --- key names everywhere (transposed): C, G#m, Bb … ---
const KN65=[['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'],['Cm','C#m','Dm','Ebm','Em','Fm','F#m','Gm','G#m','Am','Bbm','Bm']];
// v1.0.40: names follow the spelling of the saved key (typed D# → sharps, typed Eb → flats); otherwise the usual names above
const KNS40=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],KNF40=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
keyName=function(k){if(!k)return'—';const i=((k.r%12)+12)%12;if(k.sp==='#')return KNS40[i]+(k.m?'m':'');if(k.sp==='b')return KNF40[i]+(k.m?'m':'');return KN65[k.m?1:0][i]};
function kl65(id,opt){try{const p=pref(id),k=songKey(id);if(k)return keyName({r:k.r+(p.key||0),m:k.m,sp:k.sp});}catch(e){}return opt?'':'—'}

// ===== v1.65: song thumbnails (embedded cover art → custom photo → line icon) =====
const ART=new Map(),ARTB=new Map();let ARTV=0;
function artOf(id){const a=ART.get(id);return a&&a.f||ARTB.get(id)||null}
function th65(id,c){const u=artOf(id);return `<span class="th65${c?' '+c:''}" data-th="${esc(id)}" role="button" tabindex="0" aria-label="รูปเพลง (แตะเพื่อเปลี่ยน)">${u?`<img src="${u}" alt="">`:ico60('music')}</span>`}
async function artInit(){try{const all=await tx('kv','readonly',s=>s.getAll());for(const r of all||[])if(r&&typeof r.k=='string'&&r.k.startsWith('art:')&&r.v)ART.set(r.k.slice(4),r.v)}catch(e){}artPaint()}
function artPaint(){clearTimeout(artPaint.t);artPaint.t=setTimeout(()=>{ARTV++;try{render()}catch(e){}try{stripDraw()}catch(e){}th65Ext()},300)}
async function imgBlob2(blob){let bm;try{bm=await createImageBitmap(blob)}catch(e){bm=await new Promise((ok,no)=>{const u=URL.createObjectURL(blob),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);ok(im)};im.onerror=()=>{URL.revokeObjectURL(u);no(new Error('รูปเสีย'))};im.src=u})}
 const w=bm.width,h=bm.height,m=Math.min(w,h);const mk=(n,q)=>{const c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d');g.drawImage(bm,(w-m)/2,(h-m)/2,m,m,0,0,n,n);return c.toDataURL('image/jpeg',q)};
 const r={f:mk(256,.8),s:mk(112,.7)};try{bm.close&&bm.close()}catch(e){}return r}
async function artSet(id,blob,src){const r=await imgBlob2(blob);r.src=src||'user';ART.set(id,r);await put('kv',{k:'art:'+id,v:r});artPaint();artShareSoon();return r}
// ID3v2 APIC / MP4 covr
function id3Pic(u){if(u.length<10||u[0]!=73||u[1]!=68||u[2]!=51)return null;const v=u[3];if(v<3)return null;const ss=i=>(u[i]&127)<<21|(u[i+1]&127)<<14|(u[i+2]&127)<<7|(u[i+3]&127);const be=i=>((u[i]<<24)>>>0)+(u[i+1]<<16)+(u[i+2]<<8)+u[i+3];
 let p=10;if(u[5]&64)p+=v==4?ss(10):be(10)+4;const end=Math.min(u.length,10+ss(6));
 while(p+10<end){const id=String.fromCharCode(u[p],u[p+1],u[p+2],u[p+3]);if(!/^[A-Z0-9]{4}$/.test(id))break;const fs=v==4?ss(p+4):be(p+4),d=p+10,e=Math.min(d+fs,u.length);
  if(id=='APIC'){const enc=u[d];let q=d+1;while(q<e&&u[q])q++;const mime=String.fromCharCode(...u.subarray(d+1,q))||'image/jpeg';q+=2;if(enc==1||enc==2){while(q+1<e&&!(u[q]==0&&u[q+1]==0))q+=2;q+=2}else{while(q<e&&u[q])q++;q++}
   return q<e?new Blob([u.slice(q,e)],{type:/^image\//.test(mime)?mime:'image/jpeg'}):null}
  p=d+fs}return null}
function mp4Pic(u){for(let i=0;i+24<u.length;i++){if(u[i]==99&&u[i+1]==111&&u[i+2]==118&&u[i+3]==114&&u[i+8]==100&&u[i+9]==97&&u[i+10]==116&&u[i+11]==97){const sz=((u[i+4]<<24)>>>0)+(u[i+5]<<16)+(u[i+6]<<8)+u[i+7];const a=i+20,b=Math.min(u.length,i+4+sz);if(b>a)return new Blob([u.slice(a,b)],{type:u[a]==0x89?'image/png':'image/jpeg'})}}return null}
async function artExtract(blob){const h=new Uint8Array(await blob.slice(0,Math.min(blob.size,8e6)).arrayBuffer());let p=id3Pic(h);if(p)return p;
 const t=new Uint8Array(await blob.slice(0,12).arrayBuffer());if(String.fromCharCode(...t.subarray(4,8))=='ftyp'){p=mp4Pic(h);if(p)return p;if(blob.size>8e6){const tl=new Uint8Array(await blob.slice(Math.max(0,blob.size-8e6)).arrayBuffer());return mp4Pic(tl)}}return null}
const ARTS=new Set(JSON.parse(localStorage.getItem('bp-art65')||'[]'));
setInterval(async()=>{if(artExtract.busy)return;const ps=pstate();if(ps=='loading')return;let id=null,s;for(const [k,x] of SONG){if(!x.X||x.bc||ART.has(k)||ARTS.has(k))continue;if(!FILES.has(x.fn))continue;id=k;s=x;break}if(!id)return;
 artExtract.busy=1;ARTS.add(id);try{localStorage.setItem('bp-art65',JSON.stringify([...ARTS].slice(-600)))}catch(e){}
 try{const rec=await get('files',s.fn);if(rec&&rec.blob&&rec.src!='stems'){const p=await artExtract(rec.blob);if(p)await artSet(id,p,'tag')}}catch(e){blog('warn','art '+id,e.message)}finally{artExtract.busy=0}},2500);
document.addEventListener('click',e=>{const t=e.target.closest('[data-th]');if(!t)return;e.preventDefault();e.stopPropagation();const id=t.dataset.th;let i=$('th65i');
 if(!i){i=document.createElement('input');i.type='file';i.id='th65i';i.accept='image/*';i.hidden=true;document.body.appendChild(i)}
 i.onchange=async()=>{const f=i.files[0];i.value='';if(!f)return;try{await artSet(id,f,'user');toast('🖼 ตั้งรูปเพลงแล้ว',1500,true)}catch(x){toast('❌ ใช้รูปนี้ไม่ได้: '+x.message,3000)}};
 // v1.80.3: song already has an image → small menu (เปลี่ยนรูป / ลบรูป); otherwise straight to the picker as before
 document.getElementById('th80m')?.remove();if(!artOf(id)){i.click();return}
 const m=document.createElement('div');m.id='th80m';m.className='th80m';const r=t.getBoundingClientRect();m.style.cssText=`position:fixed;z-index:9999;left:${Math.max(4,Math.min(innerWidth-170,r.left))}px;top:${Math.min(innerHeight-100,r.bottom+4)}px;background:#222;border:1px solid #555;border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:4px;min-width:150px;box-shadow:0 6px 20px #0008`;
 m.innerHTML='<button class="hw" data-m="ch">🖼 เปลี่ยนรูป</button><button class="hw" data-m="rm">🗑 ลบรูป</button>';document.body.appendChild(m);
 const off=ev=>{if(!m.contains(ev.target)){m.remove();document.removeEventListener('pointerdown',off,true)}};setTimeout(()=>document.addEventListener('pointerdown',off,true),0);
 m.onclick=async ev=>{const b=ev.target.closest('button');if(!b)return;m.remove();document.removeEventListener('pointerdown',off,true);if(b.dataset.m=='ch'){i.click();return}
  const bad=await artDel(id);toast(bad?'ลบรูปในเครื่องแล้ว — รูปของวงต้องให้เจ้าของ/คนแก้ไขลบ':'🗑 ลบรูปเพลงแล้ว',2500,!bad)}},true);
// live / player / strip thumbnails
function th65Ext(){const id=cur&&cur.id;const put1=(par,before,cls)=>{if(!par)return;let e=par.querySelector(':scope>.'+cls);const want=id?th65(id,cls):'';if(!id){if(e)e.remove();return}
  const k=id+'#'+ARTV;if(e&&e.dataset.k==k)return;const d=document.createElement('div');d.innerHTML=want;const n=d.firstElementChild;n.dataset.k=k;if(e)e.replaceWith(n);else par.insertBefore(n,before)};
 const mini=document.querySelector('#pl .mini');put1(mini,$('mi'),'thp');const lvn=document.querySelector('#livelist .lvnow');if(lvn)put1(lvn,lvn.children[1]||null,'thl')}
setInterval(()=>{try{th65Ext()}catch(e){}},600);
// share a small thumb with the band (rides on the band song doc — no extra reads)
function artShareSoon(){clearTimeout(artShareSoon.t);artShareSoon.t=setTimeout(()=>{artShare().catch(()=>{});artShare2().catch(()=>{})},4000)}
async function artShare(){if(!CLD.user||!CLD.mod||!CLD.mod.bandSongIm||!BS.mine)return;for(const b of BD.bands||[]){for(const x of BS.l[b.id]||[]){const sid=artSid(x);const a=sid&&ART.get(sid);if(!a||!a.s||a.s.length>40000||x.im===a.s)continue;
  try{await CLD.mod.bandSongIm(b.id,x.id,a.s);sed848(b.id,x,{im:a.s});x.im=a.s}catch(e){blog('warn','art share',e.code||e.message);return}}}}
// v1.80.3: images for any song (catalog songs like '11 รด' are not band songs) → bands/{b}/art
var BART={},BAUN={};const artPick=a=>a&&(a.f&&a.f.length<=40000?a.f:a.s&&a.s.length<=40000?a.s:'');
function bartSubs(){if(!CLD.user||!CLD.mod||!CLD.mod.bandArtSub)return;const ids=new Set((BD.bands||[]).map(b=>b.id));
 for(const k in BAUN)if(!ids.has(k)){try{BAUN[k]()}catch(e){}delete BAUN[k];delete BART[k]}
 for(const b of BD.bands||[])if(!BAUN[b.id])BAUN[b.id]=CLD.mod.bandArtSub(b.id,ls=>{const m=new Map();for(const x of ls)if(x.k&&x.im)m.set(x.k,x.im);BART[b.id]=m;try{artBand()}catch(e){}artShareSoon()},e=>blog('warn','band art',e.code||e.message))}
async function artShare2(){if(!CLD.user||!CLD.mod||!CLD.mod.bandArtPut)return;for(const b of BD.bands||[]){if(bdRole(b)==='viewer'||!BART[b.id])continue;const m=BART[b.id];
 for(const [k,a] of ART){if(!a||a.src!=='user')continue;const im=artPick(a);if(!im||m.get(k)===im)continue;try{await CLD.mod.bandArtPut(b.id,k,im);m.set(k,im)}catch(e){blog('warn','art share2',e.code||e.message);break}}}}
setInterval(()=>{try{bartSubs();artShare().catch(()=>{});artShare2().catch(()=>{})}catch(e){}},30000);setInterval(()=>{try{bartSubs()}catch(e){}},3000);
// v1.80.3: local id of a band song on this device: one I published (BS.mine) or the band copy (X:fn)
function artSid(x){const m=BS.mine&&BS.mine.get(x.id);if(m&&ART.has(m))return m;const k=x.fn?'X:'+x.fn:'';return k&&ART.has(k)?k:(m||k||'')}
function artBand(){let ch=0;const seen=new Set();for(const b of BD.bands||[])for(const x of BS.l[b.id]||[]){if(!x.fn)continue;const m=BS.mine&&BS.mine.get(x.id);for(const id of m?['X:'+x.fn,m]:['X:'+x.fn])if(x.im){seen.add(id);if(ARTB.get(id)!==x.im){ARTB.set(id,x.im);ch++}}}
 for(const bid in BART)for(const [k,im] of BART[bid]){seen.add(k);if(ARTB.get(k)!==im){ARTB.set(k,im);ch++}}
 for(const k of [...ARTB.keys()])if(!seen.has(k)){ARTB.delete(k);ch++} // removed by owner/editor → clears on members too
 if(ch)artPaint()}
// v1.80.3: remove a song image (local + band copy; band write needs owner/editor, enforced by rules)
async function artDel(id){ART.delete(id);ARTB.delete(id);ARTS.add(id);try{localStorage.setItem('bp-art65',JSON.stringify([...ARTS].slice(-600)))}catch(e){}try{await tx('kv','readwrite',s=>s.delete('art:'+id))}catch(e){}artPaint();let bad=0;
 if(CLD.user&&CLD.mod&&CLD.mod.bandSongIm)for(const b of BD.bands||[])for(const x of BS.l[b.id]||[]){if(!x.im)continue;const m=BS.mine&&BS.mine.get(x.id);if(m!==id&&'X:'+x.fn!==id)continue;
  try{await CLD.mod.bandSongIm(b.id,x.id,'');sed848(b.id,x,{im:''});x.im=''}catch(e){bad++;blog('warn','art del',e.code||e.message)}}
 if(CLD.user&&CLD.mod&&CLD.mod.bandArtPut)for(const b of BD.bands||[]){const m=BART[b.id];if(!m||!m.has(id))continue;if(bdRole(b)==='viewer'){bad++;continue}try{await CLD.mod.bandArtPut(b.id,id,'');m.delete(id)}catch(e){bad++;blog('warn','art del2',e.code||e.message)}}
 return bad}
{const _bp=bsPubSoon;bsPubSoon=function(){_bp.apply(this,arguments);try{artBand()}catch(e){}}}
artInit();
window.__art65={map:ART,band:ARTB,set:artSet,del:artDel,share:async()=>{bartSubs();await artShare();await artShare2()},bart:BART,id3:id3Pic,mp4:mp4Pic,ext:artExtract,of:artOf};

// ===== v1.65: Settings (ตั้งค่า) — hide tools/buttons you don't use =====
const SET65=[
 ['t:mk','#tb60 [data-t="mk"]','ท่อนเพลง','มาร์กท่อนเพลงและกระโดดไปท่อนที่ต้องการ','เครื่องมือ (แถบใต้เพลง)'],
 ['t:kt','#tb60 [data-t="kt"]','คีย์/ความเร็ว','เปลี่ยนคีย์และความเร็วของเพลง','เครื่องมือ (แถบใต้เพลง)'],
 ['t:fade','#tb60 [data-t="fade"]','เฟด','ตั้งเฟดเข้า/เฟดออกอัตโนมัติ','เครื่องมือ (แถบใต้เพลง)'],
 ['t:pad','#tb60 [data-t="pad"]','Pad','เสียงลูปตามคีย์เพลง ใช้ปูพื้นระหว่างเพลง','เครื่องมือ (แถบใต้เพลง)'],
 ['t:trim','#tb60 [data-t="trim"]','ตัดหัว/ท้าย','ข้ามช่วงเงียบตอนต้นและท้ายเพลง','เครื่องมือ (แถบใต้เพลง)'],
 ['t:ci','#tb60 [data-t="ci"]','นับเข้า','นับจังหวะก่อนเพลงเริ่ม','เครื่องมือ (แถบใต้เพลง)'],
 ['t:pv','#tb60 [data-t="pv"]','พรีวิว','ฟังเพลงอื่นล่วงหน้าโดยไม่หยุดเพลงที่เล่น','เครื่องมือ (แถบใต้เพลง)'],
 ['t:bal','#tb60 [data-t="bal"]','บาลานซ์','ปรับซ้าย/ขวาของเสียง','เครื่องมือ (แถบใต้เพลง)'],
 ['t:eq','#tb60 [data-t="eq"]','ความดัง/EQ','ปรับความดังและเสียงทุ้ม-แหลมรายเพลง','เครื่องมือ (แถบใต้เพลง)'],
 ['t:note','#tb60 [data-t="note"]','โน้ต','จดโน้ตของแต่ละเพลง','เครื่องมือ (แถบใต้เพลง)'],
 ['q:fadeb','#fadeb','ปุ่มเฟดออก','ปุ่มลัดเฟดเสียงออก ข้างปุ่มเล่น','แถบเล่น'],
 ['q:padb','#padb','ปุ่ม Pad','ปุ่มลัดเปิด/ปิด Pad ข้างปุ่มเล่น','แถบเล่น'],
 ['s:strip','#strip','การ์ดเพลงคืนนี้','แถวการ์ดเพลงในเซ็ตลิสต์ (หน้า Studio)','Studio'],
 ['s:sc65','.sc65','ปุ่มคีย์บอร์ด/พรีวิวบนการ์ด','ปุ่ม Pad และพรีวิวของแต่ละเพลง','Studio'],
 ['s:wave','.wavebox','รูปคลื่นเสียง','แสดงคลื่นเสียงและตำแหน่งที่เล่น','Studio'],
 ['s:mixer','#mixer','มิกเซอร์','ปรับเสียงนอม/เพลง ซ้าย-กลาง-ขวา','Studio'],
 ['s:stems','#sh63','แทร็กแยก (stems)','เพิ่มและผสมแทร็กแยกของเพลง','Studio'],
 ['l:kb','.lv65k,.lv65bv','คีย์และ BPM ตัวใหญ่','แสดงคีย์และความเร็วของเพลงที่เล่นอยู่','Live'],
 ['l:tempo','.lv65t button','ปุ่มปรับ Tempo','ปุ่ม − / + ปรับความเร็วเพลงที่เล่นอยู่','Live'],
 ['l:auto','.lv65a','ปุ่มเล่นต่อเนื่อง','เปิด/ปิด เล่นเพลงถัดไปอัตโนมัติ','Live'],
 ['g:thumb','.th65','รูปเพลง','รูปปกเล็ก ๆ หน้าชื่อเพลง','ทั่วไป'],
 ['m:tonight','.tab[data-v="S"]','แท็บคืนนี้','เมนูจัดลิสต์เพลงคืนนี้ (ด้านล่าง/ด้านข้าง)','เมนูหลัก'],
 ['m:met','.tab[data-v="M"]','แท็บเมโทรนอม','เมนูเมโทรนอม','เมนูหลัก']];
function hid65(){try{return new Set(JSON.parse(localStorage.getItem('bp-hide65')||'[]'))}catch(e){return new Set()}}
function set65Apply(){const h=hid65();let st=$('set65css');if(!st){st=document.createElement('style');st.id='set65css';document.head.appendChild(st)}
 st.textContent=SET65.filter(x=>h.has(x[0])).map(x=>x[1].split(',').map(q=>q+':not(#zz)').join(',')+'{display:none!important}').join('\n');tbFlow65()}
function tbFlow65(){const t=$('tb60');if(!t)return;const n=[...t.children].filter(b=>getComputedStyle(b).display!='none').length;if(!n)return;const w=t.clientWidth||innerWidth;const mx=Math.max(4,Math.min(11,Math.floor(w/60)));const rows=Math.ceil(n/mx);const cols=Math.ceil(n/rows);
 const v=`repeat(${cols},minmax(0,1fr))`;if(t.style.gridTemplateColumns!=v)t.style.gridTemplateColumns=v}
addEventListener('resize',()=>{try{tbFlow65()}catch(e){}});
const UI66=true; // v1.66 layout: settings in นำเข้า tab + tidy Tonight/Import
function set65GearTb(){const t=$('tb60');if(!t||t.querySelector('[data-set65]'))return;const b=document.createElement('button');b.type='button';b.dataset.set65='1';b.setAttribute('aria-label','ตั้งค่า');b.innerHTML=`<span class="tbi">${ico60('settings')}</span><span class="tbl" data-noi18n>ตั้งค่า</span>`;t.appendChild(b);tbFlow65()}
function set65Gear(){if(!UI66)return set65GearTb();const o=document.querySelector('#tb60 [data-set65]');if(o){o.remove();tbFlow65()}if(view!='F')return;const m=$('main');if(!m||m.querySelector('[data-set65]'))return;const b=document.createElement('button');b.type='button';b.className='set65e';b.dataset.set65='1';b.setAttribute('aria-label','ตั้งค่า');b.innerHTML=`<span class="tbi">${ico60('settings')}</span><span class="set65et"><b>ตั้งค่า</b><small>ซ่อน/แสดงปุ่มและเมนูทั้งแอป</small></span>`;m.prepend(b)}
new MutationObserver(()=>{try{set65Gear()}catch(e){}}).observe($('main'),{childList:true});
setInterval(()=>{try{set65Gear();tbFlow65()}catch(e){}},700);
function set65Open(){const d=document.createElement('div');d.className='set65';const h=hid65();let g='',out='<div class="small set65i">ปิดสวิตช์ = ซ่อนปุ่มที่ไม่ได้ใช้ (เปิดกลับได้ทุกเมื่อ) · บันทึกในเครื่องนี้และสำรองไปกับบัญชี</div>';
 for(const [k,,l,ds,gr] of SET65){if(gr!=g){out+=`<div class="set65g">${gr}</div>`;g=gr}out+=`<label class="set65r"><span><b>${l}</b><span class="small">${ds}</span></span><input type="checkbox" role="switch" data-k65="${k}" ${h.has(k)?'':'checked'}></label>`}
 out+=`<div class="row" style="margin-top:12px"><button type="button" class="hw" id="set65r">${ico60('refresh-cw')} คืนค่าเริ่มต้น (แสดงทุกปุ่ม)</button></div>`;d.innerHTML=out;
 d.addEventListener('change',e=>{const c=e.target.closest('[data-k65]');if(!c)return;const s=hid65();c.checked?s.delete(c.dataset.k65):s.add(c.dataset.k65);set65Save(s)});
 d.addEventListener('click',e=>{if(!e.target.closest('#set65r'))return;set65Save(new Set());d.querySelectorAll('[data-k65]').forEach(c=>c.checked=true);toast('คืนค่าเริ่มต้นแล้ว',1500,true)});
 open60('set65','ตั้งค่า',d)}
async function set65Save(s){localStorage.setItem('bp-hide65',JSON.stringify([...s]));set65Apply();try{await put('kv',{k:'hide65',v:[...s]})}catch(e){}}
document.addEventListener('click',e=>{if(!e.target.closest('[data-set65]'))return;e.preventDefault();e.stopPropagation();if(OPEN60=='set65')return close60();set65Open()},true);
// restore from kv (account backup restores kv) when localStorage is empty
(async()=>{try{if(localStorage.getItem('bp-hide65')==null){const v=(await get('kv','hide65'))?.v;if(Array.isArray(v))localStorage.setItem('bp-hide65',JSON.stringify(v))}}catch(e){}set65Apply()})();
window.__set65={list:SET65,apply:set65Apply,open:set65Open,save:a=>set65Save(new Set(a))};

// ===== v1.66 usage logs → admin page (key events only; batched, capped per session/day, errors de-duped) =====
const LG66={q:[],n:0,err:new Set(),t:null,busy:false,MAXS:40,MAXE:8,MAXD:150};
function lgDay66(){return new Date(Date.now()+7*3600e3).toISOString().slice(0,10)}
function lgDev66(){const u=navigator.userAgent||'';let d=/iPhone|iPod/.test(u)?'iphone':/iPad/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)?'ipad':/Android/.test(u)?(/Mobile/.test(u)?'android':'android-tab'):/Mac/.test(u)?'mac':/Win/.test(u)?'windows':/Linux|CrOS/.test(u)?'linux':'other';try{if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)d+='-app'}catch(e){}return d.slice(0,20)}
function lgDayCnt66(add){const k='bp-lg66',d=lgDay66();let o={};try{o=JSON.parse(localStorage.getItem(k)||'{}')}catch(e){}if(o.d!==d)o={d,n:0};o.n+=add||0;try{localStorage.setItem(k,JSON.stringify(o))}catch(e){}return o.n}
function lg66(ty,m){try{if(/^(localhost|127\.)/.test(location.hostname)&&!localStorage.getItem('bp-emu'))return;
 if(LG66.n>=LG66.MAXS||lgDayCnt66(0)>=LG66.MAXD)return;
 if(ty=='err'){const key=String(m).slice(0,120);if(LG66.err.has(key)||LG66.err.size>=LG66.MAXE)return;LG66.err.add(key)}
 LG66.n++;lgDayCnt66(1);LG66.q.push({ty,m:String(m||'').slice(0,300)});clearTimeout(LG66.t);LG66.t=setTimeout(lgFlush66,LG66.q.length>=10?500:ty=='err'?4000:15000)}catch(e){}}
async function lgFlush66(){if(LG66.busy||!LG66.q.length)return;LG66.busy=true;const evs=LG66.q.splice(0,20);
 try{const m=await import('./cloud.js');await m.logPut(evs,{day:lgDay66(),s:location.hostname.split('.')[0].slice(0,40),v:APPV,dv:lgDev66()})}catch(e){try{blog('warn','log66 '+(e&&e.message))}catch(_){}}
 LG66.busy=false;if(LG66.q.length)LG66.t=setTimeout(lgFlush66,5000)}
addEventListener('bp-ev',e=>{const d=e.detail||{};lg66(d.ty,d.m)});
addEventListener('error',e=>{const m=String(e.message||'');if(!m||/ResizeObserver|^Script error/.test(m))return;lg66('err',m+' @'+String(e.filename||'').split('/').pop()+':'+(e.lineno||0))});
addEventListener('unhandledrejection',e=>{const r=e.reason;const m=String(r&&r.message||r||'');if(!m||/AbortError|NotAllowedError|play\(\) request was interrupted/.test(m))return;
 let x='';try{const tn=r==null?String(r):(r.constructor&&r.constructor.name)||typeof r;x=' [type='+tn+(r&&r.name&&r.name!==tn?' name='+r.name:'')+(r&&r.code?' code='+r.code:'')+(r&&r.type?' ev='+r.type:'')+(r&&r.target&&r.target.constructor?' tgt='+r.target.constructor.name:'')+']';const st=r&&r.stack?String(r.stack).split('\n').filter(l=>/\.js/.test(l)).slice(0,2).map(l=>l.trim().replace(/^at /,'').replace(/https?:\/\/[^/]+\//,'')).join(' < '):'';if(st)x+=' @'+st;x+=' view='+(typeof view!='undefined'?view:'')+' play='+(playing?1:0)}catch(_){}
 lg66('err',('promise: '+m+x).slice(0,300))});// v1.83.4: non-Error reasons ("Rejected") now say what kind of object + where
addEventListener('pagehide',()=>{if(LG66.q.length)lgFlush66()});
{const _svSave=svSave;let mx=0;const tmax=()=>Math.max(0,...((SV60&&SV60.l)||[]).map(x=>+x.t||0));try{setTimeout(()=>{try{mx=tmax()}catch(e){}},3000)}catch(e){}svSave=async function(...a){const r=await _svSave.apply(this,a);try{const t=tmax();if(t>mx&&Date.now()-t<10000)lg66('set_save',String(SET.length)+' songs');mx=Math.max(mx,t)}catch(e){}return r}}
window.__lg66={q:LG66,lg:lg66,flush:lgFlush66,dev:lgDev66,day:lgDay66};

// ===== v1.66 tidy layout: Tonight (status line, 4 equal buttons, search on top, ⋯ more sheet) + Import (grouped sections) =====
const SV66=(p)=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC66={more:SV66('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),info:SV66('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),x:SV66('<path d="M18 6 6 18M6 6l12 12"/>')};
const MORE66=['r836b','showck','ckw','slin','sopt'];/*v1.84.15 clean sheet*//*v1.83.6: โหลด/แชร์/ลิสต์ที่บันทึก go in เพิ่มเติม; เช็กเพลง/ล้างลิสต์/เล่นต่ออัตโนมัติ (#sopt) stay on the page*/
function more66Host(){let h=$('s66hold');if(!h){h=document.createElement('div');h.id='s66hold';h.hidden=true;document.body.appendChild(h)}return h}
function more66Box(){return OPEN60=='s66m'?$('s66mb'):more66Host()}
function more66Badge(){const b=$('s66more');if(!b)return;const ck=$('showck');let w=false;try{if(ck&&getComputedStyle(ck).display!='none'&&!ck.hidden){const m=(ck.querySelector('.ckh')?.textContent||'').match(/\((\d+)\/(\d+)\)/);w=!!(m&&+m[1]<+m[2])||!!(($('cknet')?.textContent||'').trim())}}catch(e){}b.classList.toggle('warn',w)}
function more66Open(){const d=document.createElement('div');d.id='s66mb';d.className='s66mb';open60('s66m','เพิ่มเติม',d);const h=more66Host();for(const id of MORE66){const e=h.querySelector('#'+id);if(e)d.appendChild(e)}d.querySelectorAll('.acc-c').forEach(e=>e.classList.remove('acc-c'))}
function wrap68(m){const g=m.querySelector(':scope>[data-set65]');if(g){const w=document.createElement('div');w.className='sec r68w';g.replaceWith(w);w.appendChild(g)}}
function lite68(){const lt=$('litet'),ld=$('lited'),lite=$('literow');if(!lt||!ld||!lite)return;if(!lt.classList.contains('r68'))lt.classList.add('s66sw','r68');let ib=lite.querySelector(':scope>.s66i');if(!ib){ib=document.createElement('span');ib.setAttribute('role','button');ib.tabIndex=0;ib.className='s66i';ib.setAttribute('aria-label','รายละเอียด');ib.innerHTML=IC66.info;ib.onclick=e=>{e.stopPropagation();e.preventDefault();lite.classList.toggle('s66open')}}if(ib.parentElement!==lite||ib.previousElementSibling!==lt)lt.after(ib);}
function xl69(m){const ul=m.querySelector(':scope>ul:not(.fldl)');if(!ul)return;let h=m.querySelector(':scope>.x69');if(h&&h.nextElementSibling&&h.nextElementSibling.nextElementSibling!==ul){const n=m.querySelector(':scope>.x69n');ul.before(h);if(n)ul.before(n)}if(!h){h=document.createElement('button');h.type='button';h.className='x69 r68 r68c';h.onclick=()=>{const o=localStorage.getItem('bp-x69')!=='1';localStorage.setItem('bp-x69',o?'1':'0');xl69(m)};ul.before(h);const n=document.createElement('div');n.className='x69n small';n.textContent=(typeof CUSTOMER_MODE!=='undefined'&&CUSTOMER_MODE)?'ไฟล์เก็บในเครื่องนี้ และอยู่ในแท็บ "เพลง" แล้ว · ＋ ใส่ลิสต์คืนนี้ · 🗑 ลบจากเครื่อง':'ไฟล์ที่นำเข้าแต่ชื่อไม่ตรงรายชื่อเพลงของวง — เก็บในเครื่องนี้ เล่นได้ · ＋ ใส่ลิสต์คืนนี้ · 🗑 ลบจากเครื่อง';h.after(n)}
 const open=localStorage.getItem('bp-x69')==='1',c=ul.children.length,t=`เพลงที่นำเข้า (${c})`;if(h.dataset.t!==t+open){h.dataset.t=t+open;h.innerHTML=`<span class="ici">${SV66('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>')}</span>${t}`;h.classList.toggle('x69o',open);ul.classList.toggle('x69h',!open);m.querySelector(':scope>.x69n')?.classList.toggle('x69h',!open)}}
let tidy66busy=0;
function tidy66(){if(!UI66||tidy66busy)return;tidy66busy=1;try{const m=$('main');if(!m)return;if(view=='S')m.querySelectorAll('#setul .i .m').forEach(x=>{for(const n of [...x.childNodes])if(n.nodeType==3&&n.textContent.trim()){const sp=document.createElement('span');sp.className='m68';sp.textContent=n.textContent.trim();n.replaceWith(sp)}});m.classList.toggle('n67',m.clientWidth<520);if(m.dataset.v66!==view)m.dataset.v66=view;
 // put back sheet content when the sheet closed
 if(OPEN60!='s66m'){const d=$('s66mb');if(d&&d.children.length){const h=more66Host();[...d.children].forEach(e=>h.appendChild(e))}}
 if(view=='S'){const sec=m.querySelector(':scope>.sec');if(!sec)return;
  const row=[$('dlall'),$('shbtn'),$('svlist')].every(Boolean)?$('dlall').parentElement:null;
  if(row&&!row.classList.contains('s66row')){row.classList.add('s66row');const b=document.createElement('button');b.type='button';b.id='s66more';b.innerHTML=`<span class="ici">${IC66.more}</span><span class="sr16">เพิ่มเติม</span>`;b.className='io16';b.setAttribute('aria-label','เพิ่มเติม');b.title='เพิ่มเติม';b.onclick=more66Open;const h2=sec.querySelector(':scope>h2');(h2||row).appendChild(b)}
  sw836(m);const mr=$('s66more')&&$('s66more').closest('#main')?$('s66more').parentElement:row;const sw=sec.querySelector(':scope>.sw');if(mr&&sw&&mr.nextElementSibling!==sw){mr.after(sw);const r=$('sqr');if(r&&r.parentElement===sec)sw.after(r)}
  for(const id of MORE66){const e=[...m.querySelectorAll('#'+id)].find(x=>!x.closest('#s66hold,#s66mb'));if(!e)continue;const box=more66Box();const o=box.querySelector('#'+id);if(o)o.replaceWith(e);else box.appendChild(e);if(box.id=='s66mb')e.classList.remove('acc-c')}
  const lv=$('lvlv');if(lv&&!lv.dataset.s66){lv.dataset.s66=1;lv.innerHTML=IC66.x;lv.title='เลิกซิงก์';lv.setAttribute('aria-label','เลิกซิงก์')}
  more66Badge()}
 if(view=='F'){lite68();xl69(m);if(m.dataset.g66==m.childElementCount+'|'+(m.firstElementChild&&m.firstElementChild.className))return;
  const kids=[...m.children].filter(e=>!e.classList.contains('g66h')&&e.id!=='st77'&&e.id!=='st77go');
  const gear=m.querySelector(':scope>[data-set65]'),lang=$('langb'),lite=$('literow');
  const help=kids.find(e=>e.querySelector&&e.querySelector('[data-help]')),sys=kids.find(e=>e.querySelector&&e.querySelector('#lgv'));
  const pcm=$('pcmrow');
  /* v1.0.53: settings/help/sys live under #st77 (imp77) — Import page only keeps เพลง */
  const skip=new Set([gear,lang,pcm,lite,help,sys,$('st77'),$('st77go')].filter(Boolean));
  const songs=kids.filter(e=>!skip.has(e));
  const H=t=>{const h=document.createElement('h3');h.className='g66h';h.textContent=t;return h};m.querySelectorAll(':scope>.g66h').forEach(e=>e.remove());
  const order=[H('เพลง'),...songs].filter(Boolean);order.forEach(e=>m.appendChild(e));
  // keep #st77 / #st77go at the end (imp77 owns contents)
  try{const st=$('st77'),go=$('st77go');if(go)m.appendChild(go);if(st)m.appendChild(st)}catch(e){}
  const lt=$('litet'),ld=$('lited');if(lt&&ld&&!lt.dataset.s66){lt.dataset.s66=1;lt.classList.add('s66sw');const ib=document.createElement('span');ib.setAttribute('role','button');ib.tabIndex=0;ib.className='s66i';ib.setAttribute('aria-label','รายละเอียด');ib.innerHTML=IC66.info;ib.onclick=e=>{e.stopPropagation();e.preventDefault();lite&&lite.classList.toggle('s66open')};lt.appendChild(ib)}
  const gb=gear;if(gb&&!gb.dataset.r68){gb.dataset.r68=1;const sv=gb.querySelector('.tbi');gb.innerHTML='';const ic=document.createElement('span');ic.className='ici';if(sv)ic.append(...sv.childNodes);gb.append(ic,'ตั้งค่าเมนู');gb.classList.add('r68','r68c')}
  for(const b of [lang&&lang.querySelector('.acch'),lt,$('pcmt'),help&&help.querySelector('[data-help]'),sys&&sys.querySelector('.acch')])if(b){b.classList.add('r68');if(b.matches('[data-help]'))b.classList.add('r68c')}
  if(lt)if(!lt.querySelector('.r68t'))lt.classList.toggle('on',/เปิด\s*$|:\s*on\s*$/i.test(lt.textContent.trim()));
  m.dataset.g66=m.childElementCount+'|'+(m.firstElementChild&&m.firstElementChild.className)}
 }finally{tidy66busy=0}}
new MutationObserver(()=>{try{tidy66()}catch(e){}}).observe($('main'),{childList:true,subtree:true});
setInterval(()=>{try{tidy66()}catch(e){}},700);
window.__ui66={tidy:tidy66,more:more66Open};

// ===== v1.70: notification bell (band activity + system notices) · one-tap “+ เพิ่มเพลงให้วง” · per-song upload/cached status =====
const NT={a:{},un:{},sys:null,sun:null,have:{},hun:{},hw:{}};
const NTCHG={'1.0.58':'ปุ่มกู้คืนเพลงที่ซ่อนอยู่ชัดแล้ว — เมนูบัญชีด้านบน + หัวการตั้งค่า (ไม่ต้องไล่หาในระบบขั้นสูง)','1.0.57':'ปุ่มกู้คืนเพลงที่ซ่อนจากคลัง (เช่น ขอบคุณที่รักกัน นอมซ้าย/ขวา) — การตั้งค่า › ระบบ หรือเมนูลิสต์','1.0.56':'แอป Android เด้งอัปเดตชัดขึ้นเมื่อมี APK ใหม่ · เว็บเช็คอัปเดตถี่ขึ้นและมีปุ่มอัปเดตใหญ่','1.0.55':'เอาแท็บเขียว “▶ เล่นต่อ …” ออก — รกจอตอนขึ้นงาน','1.0.54':'แก้ลบเพลงจากลิสต์แล้วทีมยังเห็น — กัน snapshot ของวงทับการลบท้องถิ่นก่อนส่งขึ้นคลาวด์ และลบจากหน้า Dual ส่งขึ้นวงทันที','1.0.53':'เมนูบัญชีเหลือแค่ การแจ้งเตือน · นำเข้าเพลง · การตั้งค่า — ส่งความเห็น/แชท/บัญชี ย้ายเข้าหมวดตั้งค่าแล้ว · ลิสต์วันนี้/คืนนี้โชว์เวลารวม · แก้กระพริบลิสต์ตอนอัปเดตความยาว · ปิดตั้งค่าบนไลฟ์ไม่ค้างแท็บนำเข้า · มิกซ์ร้าน→แยกช่องเปิดการตั้งค่า','1.0.52':'ย้อนกลับไปเลย์เอาต์แบบ 1.0.49 (ก่อนจัดสตูดิโอใหม่) — เพลง/ลิสต์/การตั้งค่าในเครื่องยังอยู่ครบ','1.0.51':'หยุดกระพริบสตูดิโอ · แก้ค้างนำเข้า · ลบออนไลน์','1.0.50':'สตูดิโอจัดใหม่ A+B','1.0.49':'ลบจากคลัง: กด 🗑 แล้วยืนยันครั้งเดียว — ทั้งวงไม่เห็นเพลงนั้นแล้ว (เพลงตัวอย่างออนไลน์ซ่อนให้ทั้งทีม ไม่โชว์ข้อความยุ่งยาก)','1.0.48':'ลิสต์คืนนี้: ปุ่ม ☰ ลากย้ายไปไว้ซ้าย (ห่าง ✕) และต้องเลื่อนประมาณ 16px ก่อนถึงจะขยับเพลง — แตะเบา ๆ ไม่เลื่อนแล้ว','1.0.47':'ปุ่ม 🗑 ลบจากคลังโชว์ทุกแถวในคลังแล้ว รวมเพลงออนไลน์ที่ยังไม่โหลดเก็บ (กดแล้วระบบบอกได้ถ้าเป็นเพลงตัวอย่างส่วนกลาง)','1.0.46':'สตูดิโอ/คลัง: ปุ่ม 🗑 ลบจากคลังโผล่ข้าง ＋ ทุกรายการ (ไม่ต้องเข้าเมนู ⋯) — ลบเพลงของวงแล้วทุกคนในทีมไม่เห็น','1.0.45':'ลบเพลงจากคลังได้แล้ว (เมนู ⋯ / ค้นคลัง / ชีตคลัง) — ถ้าเป็นเพลงของวง จะลบออกจากวงด้วย ทุกคนในทีมไม่เห็น · แก้หน้าจอกระพริบตอนจัดลิสต์ในสตูดิโอ','1.0.44':'แก้หน้าจอกระพริบตอนจัดลิสต์ในสตูดิโอ — แถบ SETLIST ด้านบนไม่ถูกสร้างใหม่ทั้งก้อนทุกครั้งที่เล่น/หยุด หรือตอนวิเคราะห์คีย์-BPM','1.0.43':'กดคีย์ − / + ที่เด็ค (หน้าไลฟ์) และการ์ดคีย์ในสตูดิโอ = บันทึกกับเพลงทันที ซิงก์เข้าลิสต์ของวงให้ทุกคนเห็นแบบเรียลไทม์ (ขึ้น "บันทึกคีย์แล้ว ทุกคนในวงเห็น") · ความเร็ว ± ยังเป็นชั่วคราวเหมือนเดิม (กด 💾 เพื่อบันทึก) · สมาชิกสิทธิ์ดูอย่างเดียวบันทึกได้เฉพาะในเครื่อง','1.0.42':'สตูดิโอ: แถบ "ยังไม่บันทึก" (💾/↺) ย้ายมาอยู่ใต้การ์ดคีย์/ความเร็ว ไม่ลอยทับปุ่ม M/S ของมิกซ์แล้ว · หัวสตูดิโอแสดงชื่อเพลงที่โหลดอยู่จริง (ไม่ขึ้น "ยังไม่ได้เลือกเพลง" อีก) · หน้าแอดมินย้ายมาอยู่ที่ paithoonbeer.github.io/admin/ (ปุ่ม 🛠 หน้าแอดมิน ในบัญชี สำหรับเจ้าของ/พนักงาน)','1.0.41':'เก็บกวาดเมนูซ้ำ: เอาปุ่ม/เมนูที่ซ้ำกับหน้าไลฟ์ออก (สตูดิโอในเมนูบัญชี, เมนู ⋯ การ์ดเก่า, ▶ ในเมนูเด็ค, แชร์/ลิสต์ที่บันทึกในเมนูลิสต์, 🎤 Live และ 🔗 BPM ในสตูดิโอ, คีย์ในแผง Pad) · แท็บ Live ในสตูดิโอเปลี่ยนชื่อเป็น “คืนนี้” · ปรับคีย์/เทมโปในสตูดิโอเป็นแบบชั่วคราวเหมือนเด็ค ต้องกด 💾 บันทึก (↺ คืนค่า) · คีย์จากแผง Pad เดิมย้ายเข้าข้อมูลเพลงให้ถ้ายังไม่มีคีย์','1.0.40':'เอาหน้า 2 เด็คแบบจานใหญ่ออก (ซ้ำกับหน้าไลฟ์) · ปุ่มสตูดิโอมาอยู่ตรงนั้นแทน แตะอีกครั้งกลับหน้าไลฟ์ · มาร์คเพลง: เด็คเริ่มที่มาร์คเริ่มตั้งแต่กดเล่นครั้งแรก ไม่เล่นส่วนที่ตัดออก และแถบเวลาในสตูดิโอ/หน้าจอล็อกนับเฉพาะช่วงที่มาร์ค · คีย์แสดงตรงตามที่บันทึก (D# ไม่กลายเป็น Eb) · เลือกคีย์ไมเนอร์ได้ (โน้ต + เมเจอร์/ไมเนอร์) พิมพ์ตัวเล็กก็อ่านถูก','1.0.39':'เพลงในคลังโหลดจากเซิร์ฟเวอร์ใหม่ (สำรองอัตโนมัติถ้าเซิร์ฟเวอร์ไหนล่ม) · เด็คบอกชัดเมื่อโหลดเพลงไม่ได้ · เพลงที่เคยเล่นเก็บในเครื่อง ไม่ต้องโหลดซ้ำ','1.0.38':'แทรกเพลงแล้วเล่นเพลงที่แทรกจริง · มาร์คจบ/เริ่ม: เวลา ความยาว และแถบเดินตรงกับมาร์ค · เปลี่ยนหน้าระหว่างเล่นไม่สะดุด · ชื่อเพลงบอกฝั่งนอม (L→R / L / R) · SYNC กดเองเท่านั้น · ย้ายปุ่มคลังไปไว้ในช่องค้นหา','1.0.37':'เสียงดังเท่าเดิม + กันเสียงแตก (ลิมิตเตอร์แยกซ้าย/ขวา + เพดานเสียง) · ครอสเฟดเดอร์เปลี่ยนนุ่มขึ้น · ปุ่มบาลานซ์ใช้ได้ในหน้า 2 เด็ค','1.0.36':'หน้าแรกใหม่ = หน้าแสดงสด 2 เด็ค (แผ่นหมุนโชว์คลื่นเสียง) + ลิสต์วันนี้ + ค้นเพลงแทรก + นอมสด (ปุ่ม TAP ใหญ่) + มิกซ์ร้าน (แยก L/R · MO · MIDI) ในหน้าเดียว · ปุ่มคลังกดครั้งเดียวใส่เด็ค A/B ได้ทันที','1.0.35':'แก้เข้าสู่ระบบด้วย Google บน iPhone/Safari (paithoonbeer.github.io) — ใช้หน้าต่างป๊อปอัปแทนการเด้งหน้า','1.0.34':'ย้ายเว็บไป paithoonbeer.github.io ชั่วคราว (setsod.web.app เต็มโควต้า) · อัปเดตเว็บโหลดเฉพาะไฟล์ที่เปลี่ยน · เสียง SFX/QR โหลดเมื่อใช้','1.0.33':'โหมด 2 เด็คแนวตั้ง: เด็คกะทัดรัด ลิสต์เพลงเห็นชัด (>=5 แถว) · ปุ่ม ✕ ออก 2 เด็ค · เรียงลิสต์สดไม่ทับคีย์/เทมโปที่วงเซฟไว้','1.0.32':'ในโหมด 2 เด็ค การปรับคีย์/เทมโปและปุ่ม SYNC เป็นชั่วคราวที่เด็ค ไม่เขียนทับค่าที่เซฟไว้ในลิสต์','1.0.31':'การ์ดที่พับแล้วโชว์ชื่อเพลง (ตัดด้วย …) คีย์ เทมโป และปุ่มเล่นครบในกรอบ · ปุ่มเล่นยังกดง่าย · ลิสต์ Dual โชว์ใต้ครอสเฟดเดอร์ทุกจอ (พับ/เดสก์ท็อป/แนวนอน)','1.0.30':'แก้ Dual บน iPhone: เสียงไม่แฟบ · เด็ค B โชว์ปุ่มครบ · แบนเนอร์ไม่ดันจอ · ชื่อเพลงตรงเด็ค · แตะลิสต์ไม่เด้งออก · แนวนอนถูกต้อง · ปุ่มเล่นกดง่ายขึ้น · SFX เสียงบันทึกจริง · อัปโหลด SFX ในเครื่อง','1.0.29':'การ์ดกำลังเล่นพอดีจอแคบ (ชิปเป็นไอคอน) · ระดับ SFX เริ่มที่ 80%','1.0.28':'ปุ่ม SFX เสียงประกอบ 8 แบบ (เล่นทับเพลงได้) · ครอสเฟดเดอร์ Dual เริ่มที่กลางและแตะสองครั้งเพื่อกลับกลาง · ไอคอน Dual เป็นจานเสียงสองใบ','1.0.27':'Dual เล่นสองเด็คพร้อมกัน · ปรับระดับเสียงและ EQ รายเด็ค · ครอสเฟดเดอร์แบบ equal-power · ซิงก์เทมโป · เตือนเมื่อสองเด็คเปลี่ยนคีย์/สปีด','1.0.26':'คลังเพลง/แท็บสตูดิโอเลื่อนได้ · ประกาศปรับปรุงระบบ · แก้ครอสเฟดเดอร์จอสูง/พับไม่หดหาย','1.0.25':'ปุ่ม CUE เป็นไอคอนย้อนกลับ ↺ · แถบเครื่องมือบนเด็ค (Pad, เมโทร, เฟด, เลื่อน ±5 วิ, เมนู)','1.0.24':'Dual แนวนอน: การ์ดลิสต์กับปุ่ม A/B ไม่ทับชื่อ · CUE ไม่ทับปุ่มเล่น · เทมโปเป็น BPM หรือ —','1.0.23':'โหมด 2 เด็ค (Dual) · Pad คิวเพลงแล้วกดอีกครั้งเพื่อเริ่ม · ครอสเฟดระหว่างเด็ค','1.0.22':'ปุ่มย้อนเพลง · การ์ดแนวนอนไม่ถูกตัด · ปุ่มกลับหน้าเดียวไม่ทับแท็บ · ชีตเพิ่มเพลงเลื่อนได้','1.0.21':'ปุ่มเล่นต่อเนื่องในการ์ด · แจ้งอัปเดตแอปบนหน้าหลัก','1.0.20':'แถบบนและการ์ดตรึงหน้าจอ เลื่อนได้แค่ลิสต์ · ส่งความเห็นจากเมนูบัญชี','1.0.19':'การ์ดกำลังเล่นพับได้ ลิสต์แน่นขึ้นเห็นหลายแถว ปุ่มไม่ทับกัน','1.0.18':'หน้าเดียว: กำลังเล่นอยู่บนสุด ลิสต์สดเป็นหน้าหลัก ค้นคลังจากแถบล่าง','1.0.17':'ฟอนต์ใหม่ Inter + Noto Sans Thai · คลังเพลงไม่ให้โหลดโดยไม่ล็อกอิน · เว็บเก่าย้ายมา setsod.web.app','1.0.16':'แก้ลิสต์สดไม่ซิงก์เองเมื่อไม่ได้แก้ · ปุ่ม ✓ อ่านทั้งหมดในกระดิ่ง','1.81':'แชทกับทีมงาน 💬 · ช่องทางติดต่อ · โอนขาด/เกินเห็นยอดชัด แนบสลิปโอนเพิ่มได้','1.77':'ปุ่ม “อัปเดตเวอร์ชัน” ในกระดิ่งและตั้งค่า · แตะการแจ้งเตือนเพื่อไปยังเพลง/ลิสต์/สมาชิกนั้น · โควตาพื้นที่ต่อวง','1.70':'คืนนี้เหลือ 4 ปุ่ม (ที่เหลืออยู่ใน “เพิ่มเติม”) · ปุ่ม + เพิ่มเพลงให้วง · สถานะส่งเพลง/มีแล้วกี่คน · กระดิ่งแจ้งเตือน'};
SET65.push(['nt','#ntb','กระดิ่งแจ้งเตือน','เรื่องในวง (เพลงใหม่ ลิสต์ สมาชิก) และอัปเดตระบบ','ทั่วไป']);
function ntOn(){return !hid65().has('nt')}
function ntSeen(){return +localStorage.getItem('bp-nts')||0}
function ntLocal(){try{return JSON.parse(localStorage.getItem('bp-ntl')||'[]')}catch(e){return[]}}
// v1.0.0 fresh start: clear local notifications / read marks / what's-new once
if(localStorage.getItem('bp-reset100')!=='1'){try{['bp-ntl','bp-ntr','bp-upd-show'].forEach(k=>localStorage.removeItem(k));localStorage.setItem('bp-nts',String(Date.now()));localStorage.setItem('bp-ntv',APPV);localStorage.setItem('bp-reset100','1')}catch(e){}}
{const v=localStorage.getItem('bp-ntv');if(v!==APPV){if(v){const l=ntLocal();l.unshift({k:'upd',ti:'อัปเดตเป็นเวอร์ชัน '+APPV+' แล้ว',x:NTCHG[APPV.replace(/c$/,'')]||'',t:Date.now(),sys:1});localStorage.setItem('bp-ntl',JSON.stringify(l.slice(0,10)))}localStorage.setItem('bp-ntv',APPV)}}
const NTR={owner:'เจ้าของ',editor:'แก้ไขได้',viewer:'ดูอย่างเดียว'};
function ntText(x){const n=esc(x.byn||'สมาชิก'),t=esc(x.ti||'');switch(x.k){
 case'add':return `${n} เพิ่มเพลง “${t}”`;case'addn':return `${n} เพิ่ม ${esc(x.x)} เพลงให้วง`;case'up':return `ส่งเพลง “${t}” ขึ้นวงเสร็จแล้ว · ${n}`;
 case'save':return `${n} บันทึกลิสต์ “${t}”`;case'sdel':return `${n} ลบลิสต์ที่บันทึกไว้`;case'ren':return `${n} เปลี่ยนชื่อวงเป็น “${t}”`;
 case'role':return `${n} เปลี่ยนสิทธิ์ ${t} เป็น ${NTR[x.x]||esc(x.x)}`;case'join':return `${n} เข้าร่วมวง`;case'leave':return `${n} ออกจากวง`;case'kick':return `${n} นำ ${t} ออกจากวง`;case'own':return `👑 ${n} เป็นเจ้าของวงแทน ${t}`;
 case'live':if(x.d&&nt848(x.d).length)return nt848s(x,n,'ในลิสต์สด '+(x.ti||''),'แก้ลิสต์สด “'+(x.ti||'')+'”');return `${n} แก้ลิสต์สด “${t}”`;case'sed':return nt848s(x,n,'',`แก้ข้อมูลเพลง${x.ti?' “'+x.ti+'”':''}`);case'ann':return `ประกาศ: ${t}`;case'maint':return t;case'upd':return t;case'new':return t;default:return t}}
const NTI={add:'music',addn:'music',up:'cloud',save:'save',sdel:'save',ren:'pencil',role:'key-round',join:'user',leave:'door-open',kick:'door-open',own:'key-round',live:'radio',sed:'pencil',ann:'message-square',maint:'alert-triangle',upd:'refresh-cw',new:'refresh-cw'};
function ntItems(){const it=[];for(const b of BD.bands||[])for(const x of (NT.a[b.id]||[]).slice(0,50))it.push({...x,bn:b.name,bid:b.id});
 if(NT.sys&&NT.sys.m)it.push({k:'ann',ti:NT.sys.m,t:NT.sys.t,sys:1});if(NT.maint&&NT.maint.item)it.push(NT.maint.item);for(const x of ntLocal())it.push(x);
 if(window.__swWaiting)it.push({k:'new',ti:'มีเวอร์ชันใหม่พร้อมติดตั้ง',t:UPD77.at||Date.now(),sys:1});return it.sort((a,b)=>b.t-a.t)}
function ntUL(){const s=ntSeen(),me=bsMe(),rd=ntRead();return ntItems().filter(x=>(x.t>s||x.k=='new')&&x.by!==me&&!rd.has(ntKey(x)))}
function ntUnread(){return ntUL().length}
function ntAgo(t){const d=(Date.now()-t)/1000;return d<60?'เมื่อสักครู่':d<3600?Math.floor(d/60)+' นาทีที่แล้ว':d<86400?Math.floor(d/3600)+' ชม.ที่แล้ว':Math.floor(d/86400)+' วันที่แล้ว'}
function ntBtn(){const sg=document.querySelector('.tabs');if(!sg)return;let b=$('ntb');
 if(!ntOn()){if(b)b.remove();if(sg.classList.contains('nt70'))sg.classList.remove('nt70');return}
 if(!b){b=document.createElement('button');b.id='ntb';b.type='button';b.className='hw ntb';b.setAttribute('aria-label','การแจ้งเตือน');b.innerHTML=ico60('bell')+'<span class="ntn" hidden></span>';b.onclick=()=>{if(OPEN60=='nt')return close60();ntOpen()};const a=$('acbtn');a?a.before(b):sg.appendChild(b)}
 if(!sg.classList.contains('nt70'))sg.classList.add('nt70');const n=ntUnread(),c=b.querySelector('.ntn'),tx=n>9?'9+':String(n);if(c.textContent!==tx)c.textContent=tx;if(c.hidden!==!n)c.hidden=!n}
function ntMarkAll(){const L=ntUL();if(!L.length)return 0;const r=[...ntRead()];for(const x of L){const k=ntKey(x);const i=r.indexOf(k);if(i>=0)r.splice(i,1);r.unshift(k)}try{localStorage.setItem('bp-ntr',JSON.stringify(r.slice(0,600)))}catch(e){}try{ntBtn()}catch(e){}return L.length}
function ntAllClr(){const b=$('ntra');if(b)b.remove();const h=$('bs60h');if(h)h.classList.remove('nt16')}
function ntAllBar(){ntAllClr();if(!ntUnread())return;const h=$('bs60h'),x=$('bs60x');if(!h)return;
 const b=document.createElement('button');b.id='ntra';b.type='button';b.className='hw ntra';b.setAttribute('aria-label','อ่านทั้งหมด');
 b.innerHTML='✓ <span class="ntrat">อ่านทั้งหมด</span>';
 b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const n=ntMarkAll();ntAllBar();const p=document.querySelector('.ntp70');if(p){p.querySelectorAll('.ntr.nw').forEach(el=>el.classList.remove('nw'));const more=p.querySelector('.ntmore');if(more)more.remove()}toast(n?'✓ อ่านทั้งหมดแล้ว ('+n+')':'อ่านทั้งหมดแล้ว',1800,true)};
 h.classList.add('nt16');x?x.before(b):h.appendChild(b)}
function ntOpen(){const d=document.createElement('div');d.className='ntp70';const s=ntSeen(),L=ntUL().slice(0,1),more=ntUnread()-L.length;
 const rd=ntRead();d.innerHTML=(L.length?L.map((x,i)=>`<div class="ntr${(x.t>s||x.k=='new')&&x.by!==bsMe()&&!rd.has(ntKey(x))?' nw':''}" data-ni="${i}" role="button" tabindex="0"><span class="nti">${ico60(NTI[x.k]||'bell')}</span><span class="ntx"><span>${ntText(x)}</span>${nt848l(x)}${x.k=='upd'&&x.x?`<span class="small">มีอะไรใหม่: ${esc(x.x)}</span>`:''}${x.k=='new'?'<button type="button" class="hw upd77" data-upd77="go">อัปเดตเวอร์ชัน</button>':''}<span class="small">${x.sys?'ระบบ':'วง <span data-noi18n>'+esc(x.bn||'')+'</span>'} · ${ntAgo(x.t)}</span></span></div>`).join('')+(more>0?`<div class="small ntmore" style="padding:8px 4px">อีก ${more} ข้อความที่ยังไม่ได้อ่าน</div>`:''):'<div class="small" style="padding:16px 4px">ยังไม่มีการแจ้งเตือน — เรื่องในวงและอัปเดตระบบจะขึ้นที่นี่</div>')
  +'<div class="small nt70f">ปิดกระดิ่งได้ที่ การตั้งค่า › แสดง/ซ่อนปุ่ม</div>';
 d.onclick=e=>{if(e.target.closest('[data-upd77]')||e.target.closest('.nt848')||e.target.closest('#ntra'))return;const r=e.target.closest('.ntr');if(r)ntGo(L[+r.dataset.ni])};
 open60('nt','การแจ้งเตือน',d);ntAllBar();ntBtn()}
// v1.77 deep links: tap a notification → go to its song / saved list / members / Tonight / detail; falls back to the section if the item is gone
{const _o16=open60,_c16=close60;open60=function(k,title,node){try{if(k!=='nt')ntAllClr()}catch(e){}_o16(k,title,node)};close60=function(){try{ntAllClr()}catch(e){}_c16()};}
function ntKey(x){return x.id||(x.k+':'+x.t)}
function ntRead(){try{return new Set(JSON.parse(localStorage.getItem('bp-ntr')||'[]'))}catch(e){return new Set()}}
function ntMark(x){const r=[...ntRead()].filter(k=>k!==ntKey(x));r.unshift(ntKey(x));localStorage.setItem('bp-ntr',JSON.stringify(r.slice(0,600)))}
function ntFlash(el){el.scrollIntoView({block:'center'});el.classList.add('fl77');setTimeout(()=>el.classList.remove('fl77'),2500)}
function ntTab(v){const t=document.querySelector(`.tab[data-v="${v}"]`);if(t&&!t.classList.contains('on'))t.click()}
function ntDetail(t,body){const d=document.createElement('div');d.className='ntd77';d.innerHTML=`<div style="white-space:pre-wrap;padding:6px 2px 12px">${esc(body||'')}</div><button type="button" class="hw" data-ntb77>‹ กลับไปการแจ้งเตือน</button>`;d.onclick=e=>{if(e.target.closest('[data-ntb77]'))ntOpen()};open60('ntd',t,d)}
function ntTarget(x){if(x.k=='new')return{type:'update'};if(x.k=='upd')return{type:'whatsnew'};if(x.k=='ann')return{type:'ann'};if(x.k=='maint')return{type:'maint'};
 const g=x.g||'';if(g.startsWith('s:'))return{type:'song',id:g.slice(2)};if(g.startsWith('v:'))return{type:'saved',id:g.slice(2)};
 if(g=='m'||['join','leave','kick','role','ren'].includes(x.k))return{type:'members'};if(g=='t'||x.k=='live')return{type:'tonight'};
 if(x.k=='add'||x.k=='up'||x.k=='addn')return{type:'song'};if(x.k=='save'||x.k=='sdel')return{type:'saved'};return{type:'none'}}
async function ntGo(x){if(!x)return;ntMark(x);try{ntBtn()}catch(e){}const T=ntTarget(x);window.__ntLast=T;
 if(T.type=='update')return updApply();
 if(T.type=='whatsnew')return ntDetail('มีอะไรใหม่ · '+APPV,(x.x||'')||x.ti);
 if(T.type=='ann')return ntDetail('ประกาศ',x.ti);if(T.type=='maint')return ntDetail('ประกาศปรับปรุง',x.ti);
 if(T.type=='saved'){if(x.bid)localStorage.setItem('bp-svt',x.bid);await svOpen();const el=T.id&&document.querySelector(`.sv60 [data-svl="${CSS.escape(T.id)}"]`);if(el)ntFlash(el.closest('.svr')||el);else if(T.id)toast('ลิสต์นี้ถูกลบแล้ว — แสดงลิสต์ของวงแทน',3000);return}
 close60();
 if(T.type=='members'){acpOpen();setTimeout(()=>{const b=document.querySelector(`.bdb[data-b="${CSS.escape(x.bid||'')}"]`)||document.querySelector('.bdb');if(!b)return;if(!b.querySelector('.bdin')){const t=b.querySelector('.bdt');if(t)t.click()}const bb=document.querySelector(`.bdb[data-b="${CSS.escape(x.bid||'')}"]`)||document.querySelector('.bdb');if(bb)ntFlash(bb)},150);return}
 if(T.type=='tonight'){ntTab('S');return}
 if(T.type=='song'){ntTab('P');const L=(x.bid&&BS.l[x.bid])||[];const sg=T.id?L.find(y=>y.id==T.id):null;const ti=(sg&&sg.ti)||x.ti;
  setTimeout(()=>{let el=null;if(sg&&sg.fn)el=[...document.querySelectorAll('[data-cue]')].find(e=>e.dataset.cue.endsWith(sg.fn));
   if(!el&&ti&&(sg||!T.id))el=[...document.querySelectorAll('#main li .i')].find(e=>{const t=e.querySelector('.t');return t&&t.textContent.trim()==String(ti).trim()});
   if(el)return ntFlash(el.closest('li')||el);
   ntTab('S');setTimeout(()=>{const b=$('bdsec');if(b){b.open=true;ntFlash(b)}},120);toast(T.id&&!sg?'เพลงนี้ถูกลบจากวงแล้ว — เปิดเพลงของวงแทน':'ไม่พบเพลงในรายการ — เปิดเพลงของวงแทน',3000)},150);return}}
// v1.77 / v1.0.56: new SW waits → big banner + bell/settings → skipWaiting → reload → “มีอะไรใหม่”
const UPD77={reg:null,at:0};
function updBar(){try{
  let b=$('upd56');if(!window.__swWaiting){if(b)b.remove();return}
  if(b)return;b=document.createElement('div');b.id='upd56';b.style.cssText='position:fixed;left:10px;right:10px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:9998;background:#15171d;color:#fff;border:1px solid #3a3f4b;border-radius:14px;padding:14px;font:15px/1.45 sans-serif;box-shadow:0 8px 30px #000a';
  b.innerHTML='<div style="font-weight:700;font-size:17px">🔄 มีเวอร์ชันใหม่พร้อมติดตั้ง</div><div class="small" style="opacity:.85;margin:6px 0">แตะอัปเดตเพื่อโหลดเวอร์ชันล่าสุด (หยุดเพลงก่อนถ้ากำลังเล่น)</div><div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="hw" data-upd77="go" style="flex:1;padding:12px;border-radius:10px;border:0;background:#2e7d32;color:#fff;font-size:16px">อัปเดตเลย</button><button type="button" class="hw" id="upd56x" style="padding:12px 16px;border-radius:10px;border:0;background:#333;color:#fff;font-size:16px">ภายหลัง</button></div>';
  document.body.appendChild(b);$('upd56x').onclick=()=>b.remove()}catch(e){}}
function updSet(w){if(!w||UPD77.w===w)return;UPD77.w=w;window.__swWaiting=true;UPD77.at=Date.now();try{ntBtn()}catch(e){}document.querySelectorAll('[data-upd77="go"]').forEach(b=>b.hidden=false);updBar();
 let rt=0;try{rt=+sessionStorage.getItem('bp-upd-try')||0}catch(e){}
 // Auto-apply when idle; otherwise keep the big banner visible
 if(!playing&&!window.__updNoAuto&&Date.now()-rt>60e3)return updApply(true);
 if(!UPD77.told){UPD77.told=1;toast('มีเวอร์ชันใหม่ — แตะ “อัปเดตเลย”',5000)}}
function updWatch(r){if(!r)return;UPD77.reg=r;if(r.waiting&&navigator.serviceWorker.controller)updSet(r.waiting);
 r.addEventListener('updatefound',()=>{const n=r.installing;if(n)n.addEventListener('statechange',()=>{if(n.state=='installed'&&navigator.serviceWorker.controller)updSet(n)})})}
async function updLatest(r){if(!r)return null;try{await Promise.race([r.update(),new Promise(o=>setTimeout(o,4000))])}catch(e){}
 const t0=Date.now();while(r.installing&&Date.now()-t0<15e3)await new Promise(o=>setTimeout(o,250));return r.waiting||null}
async function updApply(auto){if(UPD77.busy)return;let w=UPD77.w||(UPD77.reg&&UPD77.reg.waiting);if(!w){if(!auto)toast('ใช้เวอร์ชันล่าสุดแล้ว ('+APPV+')',2500);return}
 if(auto&&playing)return; // never auto-reload mid-song; banner stays for a tap
 UPD77.busy=1;window.__updForce=true;try{localStorage.setItem('bp-upd-show','1');sessionStorage.setItem('bp-upd-try',Date.now())}catch(e){}toast('กำลังอัปเดต…',4000);try{const b=$('upd56');if(b)b.remove()}catch(e){}
 const r=UPD77.reg||await navigator.serviceWorker.getRegistration();const nw=await updLatest(r);if(nw)w=UPD77.w=nw;
 navigator.serviceWorker.addEventListener('controllerchange',()=>bpReload('update button'),{once:true});
 w.addEventListener('statechange',()=>{if(w.state=='activated')setTimeout(()=>bpReload('update button (activated)'),300)});
 try{w.postMessage({type:'SKIP_WAITING'});w.postMessage('skip')}catch(e){}
 setTimeout(()=>{if(w.state=='activated'||w.state=='activating'||navigator.serviceWorker.controller===w)bpReload('update button (fallback)');else{UPD77.busy=0;toast('อัปเดตไม่สำเร็จ — ลองกดอีกครั้ง',3000)}},6000)}
async function updCheck(){toast('กำลังตรวจหาอัปเดต…',2000);try{const r=UPD77.reg||await navigator.serviceWorker.getRegistration();if(!r){toast('ใช้เวอร์ชันล่าสุดแล้ว ('+APPV+')',2500);return}updWatch(r);window.__updNoAuto=true;await r.update();
  await new Promise(ok=>{let n=0;const iv=setInterval(()=>{if(UPD77.w||r.waiting||!r.installing&&++n>3){clearInterval(iv);ok()}},500)});if(r.waiting)updSet(r.waiting);
  if(UPD77.w){updBar();toast('มีเวอร์ชันใหม่ — แตะ “อัปเดตเลย”',4000)}else toast('ใช้เวอร์ชันล่าสุดแล้ว ('+APPV+')',2500)}catch(e){toast('ตรวจหาอัปเดตไม่ได้ — ลองใหม่เมื่อออนไลน์',3000)}}
async function updPoll(){if(!('serviceWorker' in navigator))return;if(Date.now()-(UPD77.ck||0)<60e3)return;UPD77.ck=Date.now();
 try{const r=UPD77.reg||await navigator.serviceWorker.getRegistration();if(!r)return;updWatch(r);await r.update();if(r.waiting)updSet(r.waiting)}catch(e){}}
window.__upd={apply:updApply,check:updCheck,poll:updPoll,bar:updBar,get open(){return OPEN60},get waiting(){return !!UPD77.w},T:ntTarget,go:x=>ntGo(x)};
document.addEventListener('click',e=>{const b=e.target.closest('[data-upd77]');if(!b)return;e.preventDefault();e.stopPropagation();b.dataset.upd77=='go'?updApply():updCheck()},true);
if('serviceWorker' in navigator){caches.open('bp-ui-upd').catch(()=>{});
 navigator.serviceWorker.getRegistration().then(r=>{updWatch(r);setTimeout(updPoll,3e3)}).catch(()=>{});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible')updPoll()});
 addEventListener('pageshow',()=>updPoll());setInterval(updPoll,5*60e3)}
if(localStorage.getItem('bp-upd-show')){localStorage.removeItem('bp-upd-show');setTimeout(()=>{toast('อัปเดตเป็นเวอร์ชัน '+APPV+' แล้ว — แตะกระดิ่งเพื่อดูมีอะไรใหม่',5000)},1500)}
// v1.84.12: a member whose latest own join/leave event is 'leave' but who is still listed -> owner removes the stale entry
const BDH={};function bdHeal(id,ls){const b=(BD.bands||[]).find(x=>x.id===id);if(!b||bdRole(b)!=='owner'||!CLD.mod.bandDrop)return;const last={};for(const a of ls){if((a.k==='leave'||a.k==='join')&&a.by&&!(a.by in last))last[a.by]=a.k}
 for(const u of Object.keys(b.members||{})){if(u===b.owner||last[u]!=='leave'||BDH[id+u])continue;BDH[id+u]=1;blog('info','band heal',u.slice(0,6));CLD.mod.bandDrop(id,u).catch(e=>{delete BDH[id+u];blog('warn','band heal',e.code||e.message)})}}
function ntSync(){const on=typeof BD!=='undefined'&&CLD.user&&CLD.mod&&CLD.mod.actSub;const ids=new Set(on?BD.bands.map(b=>b.id):[]);
 for(const k in NT.un)if(!ids.has(k)){try{NT.un[k]()}catch(e){}delete NT.un[k];delete NT.a[k]}
 for(const k in NT.hun)if(!ids.has(k)){try{NT.hun[k]()}catch(e){}delete NT.hun[k];delete NT.have[k]}
 if(CLD.mod&&CLD.mod.sysSub&&!NT.sun)NT.sun=CLD.mod.sysSub(x=>{NT.sys=x;ntBtn()});
 if(CLD.mod&&CLD.mod.maintSub&&!NT.mun)NT.mun=CLD.mod.maintSub(x=>{try{if(window.__maint&&__maint.fromRemote)__maint.fromRemote(x)}catch(e){}try{ntBtn()}catch(e){}});
 if(!on)return;for(const b of BD.bands){
  if(!NT.un[b.id])NT.un[b.id]=CLD.mod.actSub(b.id,ls=>{NT.a[b.id]=ls;ntBtn();try{bdHeal(b.id,ls)}catch(e){}if(ls.length>50&&bdRole(b)==='owner')ls.slice(50).forEach(x=>CLD.mod.actDel(b.id,x.id))},e=>blog('warn','band activity',e.code||e.message));
  if(!NT.hun[b.id])NT.hun[b.id]=CLD.mod.haveSub(b.id,h=>{NT.have[b.id]=h;bs70Chips()},()=>{})}
 ntHave()}
// which band songs this device has → one small doc per member (written only when it changes)
function ntHave(){if(!CLD.user||!CLD.mod||!CLD.mod.havePut)return;for(const b of BD.bands||[]){const L=BS.l[b.id];if(!L)continue;
 const ids=L.filter(x=>(x.fn&&FILES.has(x.fn))||(BS.mine&&BS.mine.has(x.id))).map(x=>x.id).sort(),k=ids.join(',');
 if(NT.hw[b.id]===k)continue;const cur=(NT.have[b.id]||{})[bsMe()];if(cur&&cur.slice().sort().join(',')===k){NT.hw[b.id]=k;continue}
 NT.hw[b.id]=k;CLD.mod.havePut(b.id,ids).catch(e=>{delete NT.hw[b.id];blog('warn','band have',e.code||e.message)})}}
setInterval(()=>{try{ntSync();ntBtn()}catch(e){}},3000);
// v1.84.8: detailed band notifications — activity.d = JSON [[cat,song,from,to],…]; summary + tap-to-expand list. Old rows (no d) render as before.
const C848={key:'เปลี่ยนคีย์',tempo:'ปรับ Tempo',add:'เพิ่มเพลง',del:'ลบเพลง',mv:'ย้ายลำดับ',note:'แก้โน้ต',ti:'เปลี่ยนชื่อเพลง',ar:'เปลี่ยนชื่อศิลปิน',sd:'เปลี่ยนฝั่งนอม',im:'เปลี่ยนรูป',ed:'แก้ไข'};
function nt848(d){try{const a=typeof d=='string'?JSON.parse(d):d;return Array.isArray(a)?a.filter(r=>Array.isArray(r)&&r.length>=2):[]}catch(e){return[]}}
function nt848r(r,ctx){const [c,s,f,t]=r,v=C848[c]||C848.ed,hs=f!=null&&f!==''||t!=null&&t!=='';return `${v} เพลง “${esc(s||'')}”${ctx?' '+esc(ctx):''}${hs?': '+esc(f==null||f===''?'—':f)+' → '+esc(t==null||t===''?'—':t):''}`}
function nt848s(x,n,ctx,fb){const L=nt848(x.d);if(!L.length)return `${n} ${esc(fb)}`;if(L.length==1)return `${n} ${nt848r(L[0],ctx)}`;
 const cnt={},ord=[];for(const r of L){const c=C848[r[0]]?r[0]:'ed';if(!cnt[c]){cnt[c]=new Set();ord.push(c)}cnt[c].add(r[1])}
 return `${n} ${esc(fb)}: `+ord.map(c=>`${C848[c]} ${cnt[c].size} เพลง`).join(', ')}
function nt848l(x){const L=nt848(x.d);if(L.length<2)return'';return `<details class="nt848"><summary class="small">ดูรายละเอียด (${L.length})</summary><ul>${L.slice(0,30).map(r=>'<li class="small">'+nt848r(r,'')+'</li>').join('')}</ul></details>`}
function kn848(base,off){off=+off||0;const m=/^([A-G])([#b]?)(m?)/.exec(String(base||'').trim());const sg=(off>0?'+':'')+off;if(!m)return off?sg:'0';
 let i=NOTE.indexOf(m[1]+(m[2]=='#'?'#':''));if(m[2]=='b')i=FLAT[m[1]+'b'];if(i==null||i<0)return sg;return NOTE[((i+off)%12+12)%12]+m[3]}
function pe848(e){try{const r=JSON.parse(e);return Array.isArray(r)?r:null}catch(_){return null}}
function lv848d(set,del,res){const D=[];try{const kid=k=>LVMAP.get(k),nm=(r,k)=>(r&&r[0])||((SONG.get(kid(k))||{}).t)||'';
 for(const k in set){const n=pe848(set[k]),o=pe848(LIVE.last[k]||LIVE.mine[k]);if(!n)continue;const ti=nm(n,k);
  if(!o){D.push(['add',ti,'','ลำดับที่ '+(res.indexOf(k)+1)]);continue}
  const bk=(SONG.get(kid(k))||{}).k||'';if((+o[2]||0)!==(+n[2]||0))D.push(['key',ti,kn848(bk,o[2]),kn848(bk,n[2])]);
  if((+o[3]||100)!==(+n[3]||100))D.push(['tempo',ti,(+o[3]||100)+'%',(+n[3]||100)+'%']);
  if((o[0]||'')!==(n[0]||''))D.push(['ti',o[0]||ti,o[0]||'',n[0]||'']);if((o[1]||'')!==(n[1]||''))D.push(['ar',ti,o[1]||'',n[1]||'']);
  if((o[4]||'')!==(n[4]||''))D.push(['note',ti,'',String(n[4]||'').slice(0,40)]);
  const os=o[7]&&o[7].sd,ns=n[7]&&n[7].sd;if((os||'')!==(ns||''))D.push(['sd',ti,sd848(os),sd848(ns)])}
 for(const k of del||[]){const o=pe848(LIVE.last[k]||LIVE.mine[k]);const i=(LIVE.o||[]).indexOf(k);D.push(['del',nm(o,k),i>=0?'ลำดับที่ '+(i+1):'',''])}
 const old=(LIVE.o||[]).filter(k=>res.includes(k)&&!(del||[]).includes(k)),nw=res.filter(k=>old.includes(k));
 if(old.join()!==nw.join()){const a=nw.map(k=>old.indexOf(k)),keep=lis848(a);nw.forEach((k,j)=>{if(!keep.has(j)){const o=pe848(LIVE.last[k]||LIVE.mine[k]);D.push(['mv',nm(o,k),'ลำดับ '+(old.indexOf(k)+1),'ลำดับ '+(res.indexOf(k)+1)])}})}
 }catch(e){blog('warn','lv848',e.message)}return D}
function lis848(a){const n=a.length,p=new Array(n),m=[];for(let i=0;i<n;i++){let lo=0,hi=m.length;while(lo<hi){const md=(lo+hi)>>1;if(a[m[md]]<a[i])lo=md+1;else hi=md}p[i]=lo?m[lo-1]:-1;m[lo]=i}const s=new Set();let k=m.length?m[m.length-1]:-1;while(k>=0){s.add(k);k=p[k]}return s}
function sd848(s){return s=='L'?'ซ้าย':s=='R'?'ขวา':s?String(s):'—'}
function sed848(b,x,o){try{const ti=x.ti||'',D=[];if(o.ti!=null&&o.ti!==x.ti)D.push(['ti',x.ti||o.ti,x.ti||'',o.ti]);if(o.ar!=null&&(o.ar||'')!==(x.ar||''))D.push(['ar',ti,x.ar||'',o.ar]);
 if(o.k!=null&&(o.k||'')!==(x.k||''))D.push(['key',ti,x.k||'',o.k]);if(o.sd&&o.sd!==x.sd)D.push(['sd',ti,sd848(x.sd),sd848(o.sd)]);if(o.im!=null&&(o.im||'')!==(x.im||''))D.push(['im',ti,'',o.im?'รูปใหม่':'ลบรูป']);
 if(D.length)q848(b,'sed',o.ti||ti,'s:'+x.id,D)}catch(e){}}
// batch: same band+kind within 20 s → one row; same song+field merges (first from, last to; no-op dropped)
const Q848={};window.__q848=Q848;
function q848(b,k,ti,g,D){const id=b+'|'+k;const q=Q848[id]||(Q848[id]={b,k,ti,g,d:[]});q.ti=ti;if(q.g!==g)q.g=k=='live'?g:'';
 for(const r of D){const e=['add','del','mv'].includes(r[0])?null:q.d.find(z=>z[0]==r[0]&&z[1]==r[1]);if(e)e[3]=r[3];else q.d.push(r.slice())}
 clearTimeout(q.tm);q.tm=setTimeout(()=>f848(id),window.__q848ms||20000)}
function f848(id){const q=Q848[id];if(!q)return;delete Q848[id];clearTimeout(q.tm);const d=q.d.filter(r=>!(r[2]!==''&&r[2]===r[3]));if(!d.length||!CLD.mod||!CLD.mod.actPut)return;
 let js=JSON.stringify(d.slice(0,30).map(r=>r.map(v=>String(v==null?'':v).slice(0,60))));while(js.length>1500){d.pop();js=JSON.stringify(d.map(r=>r.map(v=>String(v==null?'':v).slice(0,60))))}
 if(q.k=='live')try{localStorage.setItem('bp-lv70'+(LIVE&&LIVE.id||''),String(Date.now()))}catch(e){}
 CLD.mod.actPut(q.b,q.k,q.ti,'',q.g||(q.k=='live'?'t':''),js)}
window.__f848=()=>Object.keys(Q848).forEach(f848);
window.__nt848={text:x=>ntText(x),list:x=>nt848l(x),kn:kn848,diff:(L,set,del,res)=>{const o=LIVE;LIVE=L;try{return lv848d(set,del,res)}finally{LIVE=o}},q:q848,sed:sed848,items:()=>ntItems()};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='hidden')window.__f848()});
// live band list edits → one activity row per list per 10 min
function lv70(){try{if(!LIVE||!LIVE.b||!CLD.mod||!CLD.mod.actPut)return;const k='bp-lv70'+LIVE.id,t=+localStorage.getItem(k)||0;if(Date.now()-t<600e3)return;localStorage.setItem(k,String(Date.now()));CLD.mod.actPut(LIVE.b,'live',LIVE.n||(LIVE.__d&&LIVE.__d.n)||'','','t')}catch(e){}}
// upload progress → per-song chip (compress = first 30%, upload = rest)
{const _p=bcPill;bcPill=function(t){_p(t);if(!t||!BC.busy){if(BC.cur){BC.cur=null;bs70Chips()}return}const p=bcPending()[0];if(!p)return;const m=/(\d+)%\s*$/.exec(t),v=m?+m[1]:0,z=/ย่อไฟล์/.test(t);
 BC.cur={b:p.b,id:p.x.id,p:Math.round(z?v*0.3:30+v*0.7)};bs70Chips()}}
function bs70Chip(b,x){const c=BC.cur&&BC.cur.b==b.id&&BC.cur.id==x.id?BC.cur:null;
 if(c)return `<span class="c70 up">กำลังส่งขึ้นวง… ${c.p}%</span>`;if(x.fc)return '<span class="c70 ok">ส่งแล้ว ✓</span>';
 if(bcPending().some(p=>p.b==b.id&&p.x.id==x.id))return '<span class="c70">รอส่งขึ้นวง</span>';return '<span class="c70 no">ยังไม่มีไฟล์ในวง</span>'}
function bs70Have(b,x){const h=NT.have[b.id]||{},m=(b.mu||Object.keys(b.members||{})).length||1;let n=0;for(const u in h)if(b.members&&b.members[u]&&h[u].includes(x.id))n++;return `<span class="c70 hv">มีแล้ว ${n}/${m}</span>`}
function bs70Chips(){document.querySelectorAll('.bs70r').forEach(r=>{const b=(BD.bands||[]).find(y=>y.id==r.dataset.b),x=b&&(BS.l[b.id]||[]).find(y=>y.id==r.dataset.s);if(!x)return;const h=bs70Chip(b,x)+bs70Have(b,x),c=r.querySelector('.bs70c');if(c&&c.innerHTML!==h)c.innerHTML=h})}
{const _h=bdSHtml;bdSHtml=function(){const r=_h();let h=r.h;for(const b of BD.bands||[]){const ed=bdRole(b)!=='viewer',L=(BS.l[b.id]||[]).slice().sort((a,c)=>c.t-a.t);if(!ed&&!L.length)continue;
  h+=`<div class="bdsb bs70" data-b="${b.id}"><div class="small"><b>เพลงของวง</b> <span data-noi18n>${esc(b.name)}</span> · ${L.length} เพลง</div>`;
  if(ed)h+=`<button type="button" class="bs70add" data-b70="${b.id}">${ico60('plus')}<span>เพิ่มเพลงให้วง</span></button><div class="small bs70h">เลือกได้หลายไฟล์ — แอปจะใส่ชื่อจากไฟล์ ย่อขนาด และส่งขึ้นวงให้เอง สมาชิกกด ▶ ก็เล่นได้</div>`;
  for(const x of L.slice(0,40)){const sid='X:'+x.fn,pl=SONG.has(sid);h+=`<div class="row bs70r" data-b="${b.id}" data-s="${x.id}">${pl?`<button type="button" class="hw bs70p" data-play="${esc(sid)}" aria-label="เล่น">${ico60('play')}</button>`:'<span class="bs70p"></span>'}<span class="bs70t"><b data-noi18n>${esc(x.ti)}</b>${x.ar?` <span class="small" data-noi18n>– ${esc(x.ar)}</span>`:''}<span class="bs70c">${bs70Chip(b,x)}${bs70Have(b,x)}</span></span>${SONG.has(sid)&&SONG.get(sid).bc&&!FILES.has(x.fn)?`<button type="button" class="hw bs80dl" data-dl="${esc(sid)}" aria-label="โหลดเก็บ">${DLQ.has(sid)?'⏳':'⬇️<span class="sr16">โหลดเก็บ</span>'}</button>`:FILES.has(x.fn)?'<span class="c70 ok">✅ ในเครื่อง</span>':''}${ed?`<button type="button" class="hw bs80m" data-bs80="${esc(x.id)}" data-b="${b.id}" aria-label="เมนูเพลงในวง">⋯</button>`:''}</div>`}
  if(bdRole(b)==='owner'&&L.some(x=>x.fc))h+=`<button type="button" class="hw bs80mono" data-b80m="${b.id}">🔎 หาเพลงโมโน (ไฟล์เก่า)</button><div class="bs80ml" id="bs80ml-${b.id}"></div>`;
  h+='</div>'}return {h,n:r.n}}}
document.addEventListener('click',e=>{const t=e.target.closest('[data-b70]');if(!t)return;let i=$('bs70i');
 if(!i){i=document.createElement('input');i.type='file';i.id='bs70i';i.multiple=true;i.accept='audio/*,.mp3,.wav,.m4a,.aac';i.hidden=true;document.body.appendChild(i);
  i.onchange=async()=>{const f=[...i.files];i.value='';if(!f.length)return;toast(`⏳ กำลังเพิ่ม ${f.length} เพลงให้วง…`,2500,true);BS70Q=1;try{await importFiles(f)}finally{setTimeout(()=>{BS70Q=0},1500)}try{rebuildIndex()}catch(x){}try{await bsPub()}catch(x){toast('❌ เพิ่มให้วงไม่ได้: '+bdErr(x),4000);return}try{bdSDraw()}catch(x){}setTimeout(()=>bcTick().catch(()=>{}),800)}}
 i.click()});
// band add flow: no title dialog (title comes from tags/filename; edit later via ✏️)
let BS70Q=0;{const _om=openMeta;openMeta=function(ids){if(BS70Q)return;return _om.apply(this,arguments)}}
window.__nt70={open:ntOpen,items:ntItems,sync:ntSync,have:ntHave,s:NT,unread:ntUnread,mark:ntMark,markAll:ntMarkAll,btn:ntBtn,read:()=>[...ntRead()]};

// ===================== v1.70 preview: multi-output routing (audio interfaces with >2 outputs) =====================
// buses: click (song click side + generated click), music (song music side), cue (metronome, count-in, preview, other).
// Each bus is mono and goes to a pair (1-2, 3-4 …) or one channel. 2-ch devices keep the existing L/R click pan.
const MO={cfg:{on:false,map:{click:'1-2',music:'3-4',cue:'1-2'},sink:''},act:false,max:2,mg:null,sp:null,bus:{},links:[]};
try{Object.assign(MO.cfg,JSON.parse(localStorage.getItem('bp-mo')||'{}'))}catch(e){}
function moSave(){try{localStorage.setItem('bp-mo',JSON.stringify(MO.cfg))}catch(e){}}
const moMax=()=>{try{return ctx?ctx.destination.maxChannelCount||2:2}catch(e){return 2}};
function moOpts(max){const o=[];for(let i=1;i+1<=max;i+=2)o.push([i+'-'+(i+1),'ช่อง '+i+'-'+(i+1)]);for(let i=1;i<=max;i++)o.push([String(i),'ช่อง '+i+' (โมโน)']);o.push(['off','ไม่ส่ง']);return o}
const _conn70=AudioNode.prototype.connect;
AudioNode.prototype.connect=function(d,...r){if(MO.act&&ctx&&d===ctx.destination&&this!==MO.mg){const b=MO.bus[this.__bus||'cue']||MO.bus.cue;if(b)return _conn70.call(this,b,...r)}return _conn70.call(this,d,...r)};
function moOff(){if(!ctx)return;MO.act=false;try{MO.mg&&MO.mg.disconnect()}catch(e){}try{MO.sp&&MO.sp.disconnect()}catch(e){}for(const k in MO.bus){try{MO.bus[k].disconnect()}catch(e){}}
 try{MX.fade.disconnect(ctx.destination)}catch(e){}try{MX.m.disconnect(MO.sp)}catch(e){}try{MX.m.disconnect(split2)}catch(e){}try{MO.mA&&MO.mA.disconnect()}catch(e){}for(const k in MO.sb){try{MO.sb[k].disconnect()}catch(e){}}MO.sb={};MO.mA=null;
 try{MX.fade.channelCount=2;MX.fade.channelCountMode='max';MX.fade.channelInterpretation='speakers'}catch(e){}try{_conn70.call(MX.m,MX.fade)}catch(e){}try{_conn70.call(MX.fade,ctx.destination)}catch(e){}try{MX.fade.disconnect(split2)}catch(e){}try{_conn70.call(MX.fade,split2)}catch(e){}
 try{ctx.destination.channelCount=2;ctx.destination.channelInterpretation='speakers'}catch(e){}MO.links=[];try{applyMix()}catch(e){}try{moStems()}catch(e){}}
const moCk=()=>{const s=cur&&SONG.get(cur.id);return !!s&&(s.s=='L'||s.s=='R')};
function moApply(){if(!ctx||!MX.fade)return;MO.max=moMax();if(!MO.cfg.on||MO.max<=2){if(MO.act)moOff();return}if(MO.act)moOff();
 const D=ctx.destination,N=MO.max;try{D.channelCount=N;D.channelCountMode='explicit';D.channelInterpretation='discrete'}catch(e){blog('warn','multiout',e.message);return}
 MO.mg=ctx.createChannelMerger(N);_conn70.call(MO.mg,D);MO.links=[];
 for(const k of ['click','music','cue']){const g=ctx.createGain();g.channelCount=1;g.channelCountMode='explicit';g.channelInterpretation='speakers';MO.bus[k]=g;
  const t=MO.cfg.map[k]||'1-2';if(t=='off')continue;const ch=t.includes('-')?t.split('-').map(x=>+x-1):[+t-1];for(const c of ch)if(c>=0&&c<N){_conn70.call(g,MO.mg,0,c);MO.links.push([k,c+1])}}
 // v1.76: song side (click/music/stem buses) → merger mA → MX.fade (N ch, so live fades still cover routed stems) → out; cue bus stays outside the fade
 MO.mA=ctx.createChannelMerger(N);for(const k of ['click','music'])for(const [kk,c] of MO.links)if(kk==k){try{MO.bus[k].disconnect(MO.mg,0,c-1)}catch(e){}_conn70.call(MO.bus[k],MO.mA,0,c-1)}
 try{MX.fade.channelCount=N;MX.fade.channelCountMode='explicit';MX.fade.channelInterpretation='discrete'}catch(e){}
 MO.sp=ctx.createChannelSplitter(2);try{MX.fade.disconnect(ctx.destination)}catch(e){}try{MX.fade.disconnect(split2)}catch(e){}_conn70.call(MX.m,split2);/* meters/analysers stay stereo (pre-fade) while N-ch */try{MX.m.disconnect(MX.fade)}catch(e){}_conn70.call(MX.m,MO.sp);MO.ck=moCk();if(MO.ck){_conn70.call(MO.sp,MO.bus.click,0);_conn70.call(MO.sp,MO.bus.music,1)}else{_conn70.call(MO.sp,MO.bus.music,0);_conn70.call(MO.sp,MO.bus.music,1)}_conn70.call(MO.mA,MX.fade);_conn70.call(MX.fade,D);MO.act=true;try{applyMix()}catch(e){}try{moStems()}catch(e){}}
// ---- v1.76: per-stem outputs. MO.cfg.st[stem name] = 'music' (default: follows the music bus + stems mixer pan) | pair | mono | 'off'
// Works for plain stem playback (no key/tempo change). With key/tempo change the stems play as one mix → music bus.
MO.sb={};MO.cfg.st=MO.cfg.st||{};
const moStemT=n=>{const t=MO.cfg.st[n];return t&&t!='music'?t:null};
function moSB(t){if(MO.sb[t])return MO.sb[t];const g=ctx.createGain();g.channelCount=1;g.channelCountMode='explicit';g.channelInterpretation='speakers';MO.sb[t]=g;
 if(t!='off'){const ch=t.includes('-')?t.split('-').map(x=>+x-1):[+t-1];for(const c of ch)if(c>=0&&c<MO.max)_conn70.call(g,MO.mA,0,c)}return g}
function moStems(){const L=ST.live;if(!L||!ctx)return;const S=L.b.__st,pro=!window.__plan||__plan.has('mo');L.n.forEach((x,i)=>{if(!x)return;try{x.g.disconnect()}catch(e){}
  const t=MO.act&&MO.mA&&pro?moStemT(S.st[i].n):null;if(t)_conn70.call(x.g,moSB(t));else _conn70.call(x.g,x.p)})}
{const _sp=ST.play;ST.play=function(){const r=_sp.apply(this,arguments);try{moStems()}catch(e){}return r}}
setInterval(()=>{try{const b=cur&&cur.buf,el=$('stm63');if(!el||!b||!b.__st)return;const show=MO.act&&MO.max>2;
  el.querySelectorAll('.st63c[data-i]').forEach(c=>{const i=+c.dataset.i;let s=c.querySelector('select.mo76');if(i<0||!show){if(s)s.remove();return}
   const n=b.__st.st[i].n,v=MO.cfg.st[n]||'music';if(s&&s.dataset.v===v+MO.max)return;if(s)s.remove();
   s=document.createElement('select');s.className='mo76';s.title='ช่องเสียงออกของ '+n;s.setAttribute('aria-label',s.title);s.dataset.v=v+MO.max;
   s.innerHTML=[['music','เพลง'],...moOpts(MO.max).map(([a,t])=>[a,a])].map(([a,t])=>`<option value="${a}" ${a===v?'selected':''}>${a=='off'?'ปิด':t}</option>`).join('');
   s.onchange=()=>{MO.cfg.st[n]=s.value;if(s.value=='music')delete MO.cfg.st[n];moSave();moStems();s.dataset.v=s.value+MO.max};c.appendChild(s)})}catch(e){}},500);
// in multi-out mode the mixer strips are pinned: click strip → L (→ click bus), music strip → R (→ music bus)
{const _am=applyMix;applyMix=function(){_am();if(!MO.act||!ctx||!MX.p[0]||!cur)return;if(MO.ck!==moCk()){moApply();return}if(!MO.ck)return;const c=clickCh(cur.id),t=ctx.currentTime;MX.p[c].pan.setTargetAtTime(-1,t,0.01);MX.p[1-c].pan.setTargetAtTime(1,t,0.01)}}
{const _ia=initAudio;initAudio=function(){const had=!!ctx;_ia();if(!had&&ctx){try{moApply()}catch(e){}if(MO.cfg.sink&&ctx.setSinkId)ctx.setSinkId(MO.cfg.sink).then(moApply).catch(()=>{})}}}
async function moDevs(){try{if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices)return[];return (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind=='audiooutput')}catch(e){return[]}}
async function moRow(){const m=$('main');if(!m||view!='F')return;if(!ctx)try{initAudio()}catch(e){}MO.max=moMax();let r=$('mosec');
 const sig=MO.max+'|'+JSON.stringify(MO.cfg)+'|'+MO.act;if(r&&m.contains(r)&&r.dataset.sig===sig)return;
 if(!r){r=document.createElement('div');r.className='sec mosec';r.id='mosec';const l=$('literow');l?l.after(r):m.appendChild(r)}else if(!m.contains(r)){const l=$('literow');l?l.after(r):m.appendChild(r)}r.dataset.sig=sig;
 const sink=ctx&&'setSinkId' in ctx;const devs=sink?await moDevs():[];
 const dsel=sink&&devs.length?`<label class="mo70l"><span>อุปกรณ์เสียงออก</span><select id="mosink"><option value="">ค่าเริ่มต้นของเครื่อง</option>${devs.map(d=>`<option value="${esc(d.deviceId)}" ${d.deviceId===MO.cfg.sink?'selected':''}>${esc(d.label||'อุปกรณ์ '+d.deviceId.slice(0,6))}</option>`).join('')}</select></label>`:'';
 if(MO.max<=2){r.innerHTML=`<div class="lab">🔌 แยกช่องเสียงออก</div><div class="small" id="mo2">อุปกรณ์นี้มี 2 ช่อง (ซ้าย/ขวา) — ใช้แยกคลิกซ้าย/ขวาแบบเดิม ถ้าต่อ audio interface หลายช่อง จะเลือกส่งคลิก/เพลงไปคนละช่องได้ที่นี่</div>${dsel}`}
 else{const O=moOpts(MO.max),sel=k=>`<select data-mo="${k}">${O.map(([v,t])=>`<option value="${v}" ${MO.cfg.map[k]===v?'selected':''}>${t}</option>`).join('')}</select>`;
  r.innerHTML=`<div class="lab">🔌 แยกช่องเสียงออก <span class="small">(${MO.max} ช่อง)</span></div><button type="button" class="hw ${MO.cfg.on?'on':''}" id="moon" style="width:100%">แยกช่อง: ${MO.cfg.on?'เปิด':'ปิด'}</button>
   <div class="mo70g ${MO.cfg.on?'':'dim'}"><label class="mo70l"><span>🥁 คลิก</span>${sel('click')}</label><label class="mo70l"><span>🎵 เพลง</span>${sel('music')}</label><label class="mo70l"><span>🎧 เมโทรนอม/นับเข้า/พรีวิว</span>${sel('cue')}</label></div>${dsel}
   <div class="small">เพลงแบบ stems เลือกช่องของแต่ละแทร็กได้ที่มิกเซอร์ Stems (ใช้ได้เมื่อไม่เปลี่ยนคีย์/ความเร็ว) · เมโทรนอมที่เปิดค้างไว้ก่อนจะย้ายช่องหลังรีเฟรช</div>`}
 const on=$('moon');if(on)on.onclick=()=>{MO.cfg.on=!MO.cfg.on;moSave();moApply();moRow();toast(MO.cfg.on?'🔌 เปิดแยกช่องแล้ว':'ปิดแยกช่องแล้ว',1800,true)};
 r.querySelectorAll('[data-mo]').forEach(s=>s.onchange=()=>{MO.cfg.map[s.dataset.mo]=s.value;moSave();moApply();moRow()});
 const ss=$('mosink');if(ss)ss.onchange=async()=>{MO.cfg.sink=ss.value;moSave();try{await ctx.setSinkId(ss.value)}catch(e){toast('เปลี่ยนอุปกรณ์ไม่ได้: '+e.message,3000)}moApply();moRow()}}
setInterval(()=>{try{if(view=='F')moRow()}catch(e){}},700);
window.__mo={get s(){return{max:MO.max,act:MO.act,cfg:MO.cfg,links:MO.links,sb:Object.keys(MO.sb),fadeCh:MX.fade?MX.fade.channelCount:0,dest:ctx?{cc:ctx.destination.channelCount,ci:ctx.destination.channelInterpretation}:null}},apply:moApply,get nodes(){return{ctx,fade:MX.fade}}};
window.__lvE70=id=>lvEntry(id);

/* 1.72-preview: AI stem split handoff (desktop + WebGPU only) */
(()=>{const desk=matchMedia('(pointer:fine)').matches&&!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)&&innerWidth>=900;
 const show=()=>{const b=document.getElementById('stai');if(!b||b.dataset.ok)return;b.dataset.ok=1;b.hidden=!(desk&&navigator.gpu);b.onclick=()=>{if(isStandalone()||SA840())location.href='stems-ai.html';else open('stems-ai.html','_blank')}};
 show();new MutationObserver(show).observe(document.body,{childList:true,subtree:true});
 try{const bc=new BroadcastChannel('bp-stems');bc.onmessage=async e=>{if(e.data?.t!='stems')return;bc.postMessage({t:'ack'});try{await ST.importStems(e.data.files,e.data.title)}catch(x){toast('❌ นำเข้า stems ไม่สำเร็จ: '+x.message,4000)}}}catch(e){}
 window.__stai={desk};})();
/* ---- v1.76-preview: plans + 7-day trial + self-serve PromptPay (provisional 72h). Core player stays free. ----
   Prices/IDs are constants: edit PLANCFG only. PROMPTPAY_ID '' = QR hidden until the owner gives a number. */
window.PLANCFG={PROMPTPAY_ID:'004999077926565',PROMPTPAY_NAME:'นาย ไพฑูรย์ อินกรัด',CONTACT:'paithooningrad@gmail.com',PROV_H:24,SEATS:5,
 price:{pro:490,band:1290,seat:150,ai:290,mo:290},per:'ปี',
 name:{pro:'Pro',band:'Band',seat:'เพิ่มสมาชิกวง 1 คน',ai:'แพ็กเสริม: แยก Stems ด้วย AI',mo:'แพ็กเสริม: แยกช่องเสียงออก'}};
// Thai bank slip mini-QR (TLV): 00{00 api id,01 sending bank code,02 transaction ref} 51 TH 91 CRC16. Returns null if not a slip QR.
const BANKS={'002':'กรุงเทพ','004':'กสิกรไทย','006':'กรุงไทย','011':'ทีทีบี','014':'ไทยพาณิชย์','022':'ซีไอเอ็มบี','024':'ยูโอบี','025':'กรุงศรี','030':'ออมสิน','033':'ธอส.','034':'ธ.ก.ส.','066':'อิสลาม','067':'ทิสโก้','069':'เกียรตินาคินภัทร','070':'ไอซีบีซี','071':'ไทยเครดิต','073':'แลนด์ แอนด์ เฮ้าส์'};
function tlv(t){const o={};let i=0;while(i+4<=t.length){const k=t.slice(i,i+2),n=+t.slice(i+2,i+4);if(isNaN(n)||i+4+n>t.length)return null;o[k]=t.slice(i+4,i+4+n);i+=4+n}return i==t.length?o:null}
function crc16(p){let c=0xFFFF;for(const ch of p){c^=ch.charCodeAt(0)<<8;for(let i=0;i<8;i++)c=c&0x8000?(c<<1)^0x1021:c<<1;c&=0xFFFF}return c.toString(16).toUpperCase().padStart(4,'0')}
function slipQR(t){t=String(t||'').trim();if(t.startsWith('000201'))return {err:'pay'};const o=tlv(t);if(!o||!o['00'])return null;const a=tlv(o['00']);if(!a||!a['02']||!/^[A-Za-z0-9]{6,40}$/.test(a['02']))return null;
 const crcOk=o['91']?crc16(t.slice(0,t.length-4))==o['91']:null;return {raw:t,bank:a['01']||'',bn:BANKS[a['01']]||'',ref:a['02'],cc:o['51']||'',crcOk}}
async function slipScan(file){if(!window.jsQR)await new Promise((ok,no)=>{const s=document.createElement('script');s.src='jsqr.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)});
 const bm=await createImageBitmap(file);const cv=document.createElement('canvas'),g=cv.getContext('2d',{willReadFrequently:true});
 for(const m of [1000,1600,700,2200]){const k=Math.min(1,m/Math.max(bm.width,bm.height));cv.width=Math.round(bm.width*k);cv.height=Math.round(bm.height*k);g.drawImage(bm,0,0,cv.width,cv.height);
  const r=jsQR(g.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height,{inversionAttempts:'attemptBoth'});if(r&&r.data){const q=slipQR(r.data);if(q)return q}}return null}
window.__slip={parse:slipQR,scan:slipScan,crc16};
function ppPayload(id,amt){const f=(k,v)=>k+String(v.length).padStart(2,'0')+v;const t=String(id).replace(/\D/g,'');
 const acc=t.length>=15?f('03',t):t.length>=13?f('02',t):f('01',('0000000000000'+t.replace(/^0/,'66')).slice(-13));
 const p=f('00','01')+f('01',amt?'12':'11')+f('29',f('00','A000000677010111')+acc)+f('58','TH')+f('53','764')+(amt?f('54',(+amt).toFixed(2)):'')+'6304';
 let c=0xFFFF;for(const ch of p){c^=ch.charCodeAt(0)<<8;for(let i=0;i<8;i++)c=c&0x8000?(c<<1)^0x1021:c<<1;c&=0xFFFF}return p+c.toString(16).toUpperCase().padStart(4,'0')}
var PLAN=(()=>{const DAY=864e5,TRIAL=7*DAY,C=PLANCFG;const S={me:null,pay:null,cfg:{on:false},owners:{},at:0};const PR=()=>({...C.price,...((S.cfg&&S.cfg.price)||{})}),PH=()=>(S.cfg&&S.cfg.h)||C.PROV_H,payOn=()=>!!(C.PROMPTPAY_ID&&S.cfg&&S.cfg.on);
 const FEAT={trial:['ai','mo','band'],band:['ai','mo','band'],pro:['ai','mo'],ai:['ai'],mo:['mo'],seat:[],free:[]};
 const act=r=>!!r&&(r.p=='trial'?Date.now()<r.s+TRIAL:(r.p=='pro'||r.p=='band')&&(!r.e||Date.now()<r.e));
 const prov=y=>!!y&&y.st=='pending'&&!!(S.cfg&&S.cfg.on)&&Date.now()<y.s+PH()*36e5;
 const own=(r,y)=>{const f=new Set(act(r)?FEAT[r.p]:[]);if(r)for(const x of r.x||[])if(!r.xe||Date.now()<r.xe)f.add(x);if(prov(y))for(const x of FEAT[y.pl]||[])f.add(x);return f};
 function feats(){const f=own(S.me,S.pay);for(const b of (typeof BD!=='undefined'&&BD.bands)||[])for(const k of [b.owner,b.pp]){const o=k&&S.owners[k];if(o&&own(o.r,o.y).has('band'))for(const x of FEAT.band)f.add(x)}return f}
 const has=x=>feats().has(x);
 function level(){const f=feats();return f.has('band')?2:f.has('ai')||f.has('mo')?1:0}
 async function sync(force){if(!CLD.user||!CLD.mod||!CLD.mod.planEnsure)return;if(!force&&Date.now()-S.at<60e3)return;S.at=Date.now();
  try{S.me=await CLD.mod.planEnsure();if(CLD.mod.payCfg)S.cfg=await CLD.mod.payCfg();S.pay=await CLD.mod.payGet().catch(()=>null);
   for(const b of (typeof BD!=='undefined'&&BD.bands)||[])for(const k of [b.owner,b.pp])if(k&&k!=CLD.user.uid&&(force||!(k in S.owners)))S.owners[k]={r:await CLD.mod.planGet(k).catch(()=>null),y:await CLD.mod.payGet(k).catch(()=>null)}}catch(e){blog('warn','plan '+e.message)}
  draw()}
 const NAME={trial:'ทดลองใช้',pro:'Pro',band:'Band',free:'ฟรี'};const fdt=t=>new Date(t).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 function status(){const r=S.me,y=S.pay;if(!CLD.user)return '';if(!r)return 'กำลังตรวจสอบแพ็กเกจ…';
  if(prov(y))return `${C.name[y.pl]||y.pl} · ใช้ได้แล้ว (รอยืนยันสลิป ถึง ${fdt(y.s+PH()*36e5)})`;
  if(y&&y.st=='revoked'&&!act(r))return 'การชำระเงินไม่ผ่านการตรวจสอบ · ติดต่อทีมงาน';
  if(y&&(/^(short|over|wait)$/.test(y.st)||!act(r))){const m=pay81(y);if(m)return m}
  const ad=(r.x||[]).length?' + '+r.x.map(x=>x=='ai'?'AI Stems':'แยกช่อง').join(', '):'';
  if(r.p=='trial'){const left=r.s+TRIAL-Date.now();return left>0?`ทดลองใช้ฟีเจอร์ทั้งหมด · เหลือ ${Math.ceil(left/DAY)} วัน`:'หมดช่วงทดลองแล้ว · ใช้แบบฟรีต่อได้'+ad}
  if(r.p=='free')return (level()==2?'ใช้ฟีเจอร์ Band ผ่านวงของคุณ':'แพ็กเกจฟรี')+ad;
  return `${NAME[r.p]}${r.e?' · ถึง '+new Date(r.e).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}):' · ตลอดไป'}${act(r)?'':' (หมดอายุ)'}`+ad}
 function draw(){const b=document.querySelector('#acctc .accb');if(!b||!CLD.user)return;let e=$('plan75');if(!e){e=document.createElement('div');e.id='plan75';e.className='plan75';const u=b.querySelector('.acu');u?u.after(e):b.prepend(e)}
  const st=status(),up=CLD.user&&S.me&&(level()<2||(S.pay&&/^(short|wait|over)$/.test(S.pay.st)));const h=`<span>${esc(st)}</span>${up?' <button class="lnk" id="plup">ดูแพ็กเกจ</button>':''}`;if(e.dataset.h!==h){e.innerHTML=h;e.dataset.h=h;const x=$('plup');if(x)x.onclick=()=>sheet()}}
 const B=n=>'฿'+(+n||0).toLocaleString('en-US');
 // v1.81 slip amount states → customer text
 function pay81(y){if(!y)return '';const paid=(y.pd||0)+(y.pd2||0),d=Math.abs((y.amt||0)-paid);
  return y.st=='short'?`โอนมา ${B(paid)} · ขาดอีก ${B(d)} — แนบสลิปโอนเพิ่มได้ (ยังไม่เปิดใช้จนกว่ายอดครบ)`
   :y.st=='over'?`โอนเกินมา ${B(d)} · รอทีมงานตรวจ (ยังไม่เปิดใช้)`
   :y.st=='wait'?`ทีมงานรอโอนเพิ่มอีก ${B(d)} — แนบสลิปโอนเพิ่มได้`
   :y.st=='refunded'?'ทีมงานคืนเงินให้แล้ว · ส่งสลิปใหม่ได้ถ้าต้องการซื้อ':''}
 // slip → small JPEG data URL (≤ ~250 KB) so it fits one Firestore doc
 async function shrink(file){const bm=await createImageBitmap(file);const k=Math.min(1,1100/Math.max(bm.width,bm.height));const cv=document.createElement('canvas');cv.width=Math.round(bm.width*k);cv.height=Math.round(bm.height*k);cv.getContext('2d').drawImage(bm,0,0,cv.width,cv.height);
  for(let q=.7;q>.2;q-=.15){const u=cv.toDataURL('image/jpeg',q);if(u.length<330000)return u}return cv.toDataURL('image/jpeg',.2)}
 function sheet(why,pick){let o=$('pl75s');if(o)o.remove();o=document.createElement('div');o.id='pl75s';o.className='pl75s';const P=PR(),uid=CLD.user?CLD.user.uid:'';
  const y=S.pay,on=payOn(),capd=y&&S.cfg&&y.c>=(S.cfg.cap||3),canPay=on&&CLD.user&&!capd&&!(y&&/^(pending|revoked|short|over|wait)$/.test(y.st)),canTop=on&&CLD.user&&y&&/^(short|wait)$/.test(y.st)&&!y.top;
  o.innerHTML=`<div class="pl75w" role="dialog"><button class="pl75x" aria-label="ปิด">✕</button>
   ${why?`<p class="pl75y">${esc(why)} เป็นฟีเจอร์ของแพ็กเกจ Pro/Band</p>`:''}<h3>แพ็กเกจ · ราคาต่อ${C.per}</h3>
   <div class="pl75r"><b>ฟรี</b><span>เครื่องเล่น เซ็ตลิสต์ โหมด Live คีย์/ความเร็ว คลิก นำเข้า stems มิกเซอร์ สำรองข้อมูล · ทดลองทุกฟีเจอร์ฟรี 7 วัน</span><i>฿0</i></div>
   <div class="pl75r"><b>Pro</b><span>+ แยก Stems ด้วย AI · แยกช่องเสียงออก (audio interface) · 1 คน</span><i>${B(P.pro)}</i></div>
   <div class="pl75r"><b>Band</b><span>Pro ทุกคนในวง ${C.SEATS} คน · ส่งเพลงให้วงผ่านคลาวด์ · เชิญสมาชิก · เพิ่มคน ${B(P.seat)}/คน</span><i>${B(P.band)}</i></div>
   <div class="pl75r pl76a"><b>เสริม</b><span>AI Stems อย่างเดียว ${B(P.ai)} · แยกช่องเสียงออกอย่างเดียว ${B(P.mo)}</span><i></i></div>
   ${canPay?`<div class="pl76p"><label>เลือก <select id="ppl">${['pro','band','seat','ai','mo'].map(k=>`<option value="${k}" ${k==(pick||'pro')?'selected':''}>${C.name[k]} · ${B(P[k])}</option>`).join('')}</select></label>
    <div id="pqr" class="pl76q"></div>
    <label>เวลาที่โอน <input id="pat" type="datetime-local"></label>
    <label class="pl76f">แนบสลิป (ต้องเห็น QR มุมสลิปชัดเจน) <input id="pimg" type="file" accept="image/*"></label>
    <p id="psq" class="small">ระบบจะอ่านเลขอ้างอิงจาก QR บนสลิปให้อัตโนมัติ</p><input id="pref" type="hidden">
    <label>ยอดที่โอน (บาท) <input id="ppd" type="number" inputmode="numeric" min="1" step="1"></label><p id="pdh" class="small pd81"></p>
    <button id="pgo" class="pl76b">ส่งสลิป · เปิดใช้ทันที</button>
    <p class="small">เปิดใช้ทันทีหลังส่งสลิป (ชั่วคราว ${PH()} ชม.) · สลิป 1 ใบใช้ได้ครั้งเดียว แล้วทีมงานตรวจสลิปและยืนยัน ถ้าสลิปไม่ถูกต้องสิทธิ์จะถูกยกเลิก</p></div>`
      :canTop?`<div class="pl76p" id="ptw"><p class="pd81 bad">${esc(pay81(y))}</p>
    <label>ยอดที่โอนเพิ่ม (บาท) <input id="ppd2" type="number" inputmode="numeric" min="1" step="1" value="${Math.max(1,y.amt-(y.pd||0))}"></label><p id="pdh2" class="small pd81"></p>
    <label>เวลาที่โอน <input id="pat2" type="datetime-local"></label>
    <label class="pl76f">แนบสลิปโอนเพิ่ม <input id="pimg2" type="file" accept="image/*"></label><p id="psq2" class="small">สลิปใบใหม่ (เลขอ้างอิงต้องไม่ซ้ำใบแรก)</p>
    <button id="ptop" class="pl76b">ส่งสลิปโอนเพิ่ม</button><p class="small">ยอดรวม 2 ใบต้องตรงราคา ถึงจะเปิดใช้ (รอทีมงานยืนยัน)</p></div>`
      :y&&/^(short|over|wait)$/.test(y.st)?`<p class="small pd81 bad">${esc(pay81(y))}</p>`
      :!on?`<p class="small pl76n">เปิดรับชำระเงินเร็วๆ นี้ · ติดต่อ ${esc(C.CONTACT)}</p>`
   :capd&&y.st!='pending'?`<p class="small">บัญชีนี้ส่งสลิปครบจำนวนแล้ว กรุณาติดต่อ ${esc(C.CONTACT)}</p>`
   :CLD.user?`<p class="small">${y&&y.st=='pending'?'ได้รับสลิปแล้ว ใช้งานได้ระหว่างรอยืนยัน':'การชำระเงินครั้งก่อนไม่ผ่าน กรุณาติดต่อ '+esc(C.CONTACT)}</p>`:'<p class="small">เข้าสู่ระบบก่อน เพื่อซื้อแพ็กเกจ</p>'}
   ${ct81Html()}${uid?`<div class="pl75id"><code data-noi18n>${esc(uid)}</code><button class="lnk" id="plcp">คัดลอก</button></div>`:''}</div>`;
  document.body.appendChild(o);o.onclick=e=>{if(e.target===o||e.target.closest('.pl75x'))o.remove()};const c=$('plcp');if(c)c.onclick=()=>{navigator.clipboard?.writeText(uid);toast('คัดลอกรหัสแล้ว',1500,true)};
  if(canTop){let SQ2=null;const a2=$('pat2'),p2=$('ppd2'),h2=()=>{const s=(y.pd||0)+(+p2.value||0),d=s-y.amt;$('pdh2').textContent=d==0?'✅ รวมแล้วครบพอดี':d<0?`ยังขาดอีก ${B(-d)}`:`รวมแล้วเกิน ${B(d)}`};p2.oninput=h2;h2();
   {const d=new Date(Date.now()-new Date().getTimezoneOffset()*6e4);a2.value=d.toISOString().slice(0,16)}
   $('pimg2').onchange=async()=>{const f=$('pimg2').files[0],m=$('psq2');SQ2=null;if(!f)return;m.textContent='กำลังอ่าน QR บนสลิป…';
    try{const q=await slipScan(f);if(!q||q.err){m.textContent='❌ ไม่พบ QR สลิป — ใช้ภาพสลิปจากแอปธนาคาร';return}SQ2=q;m.textContent=`✅ เลขอ้างอิง ${q.ref}`}catch(e){m.textContent='❌ อ่านสลิปไม่ได้'}};
   $('ptop').onclick=async()=>{const f=$('pimg2').files[0];if(!f||!SQ2)return toast('แนบสลิปโอนเพิ่มที่มี QR ก่อน',2500);if(!(+p2.value>0))return toast('ใส่ยอดที่โอนเพิ่ม',2000);const b=$('ptop');b.disabled=true;b.textContent='กำลังส่ง…';
    try{const img=await shrink(f);S.pay=await CLD.mod.payTop({ref:SQ2.ref,qr:SQ2.raw,bk:SQ2.bank,pd:+p2.value,at:a2.value?new Date(a2.value).toISOString():'',img});await sync(true);o.remove();
     toast(S.pay&&S.pay.st=='pending'?'✅ ยอดครบแล้ว — เปิดใช้ระหว่างรอยืนยัน':'ส่งแล้ว · '+pay81(S.pay),4500,true)}catch(e){b.disabled=false;b.textContent='ส่งสลิปโอนเพิ่ม';toast(/permission/i.test(e.code||e.message)?'ส่งไม่สำเร็จ: สลิปนี้ถูกใช้แล้ว':'ส่งไม่สำเร็จ: '+(e.code||e.message),4000)}}}
  if(!canPay)return;const sel=$('ppl'),at=$('pat'),RQ=Date.now();let SQ=null;
  const pd=$('ppd'),pdh=()=>{const v=+pd.value||0,d=v-P[sel.value],g=$('pgo');$('pdh').textContent=!v?'':d==0?'✅ ยอดตรงราคา':d<0?`⚠️ ขาดอีก ${B(-d)} — ส่งได้ แต่ยังไม่เปิดใช้ แนบสลิปโอนเพิ่มทีหลังได้`:`⚠️ เกินมา ${B(d)} — ทีมงานจะตรวจและคืนส่วนเกิน (ยังไม่เปิดใช้)`;$('pdh').className='small pd81'+(v&&d?' bad':'');if(g)g.textContent=!v||!d?'ส่งสลิป · เปิดใช้ทันที':'ส่งสลิปให้ทีมงานตรวจ'};pd.oninput=pdh;
  $('pimg').onchange=async()=>{const f=$('pimg').files[0],m=$('psq');SQ=null;$('pref').value='';if(!f)return;m.textContent='กำลังอ่าน QR บนสลิป…';
   try{const q=await slipScan(f);if(q&&q.err=='pay'){m.textContent='❌ นี่คือ QR รับเงิน ไม่ใช่สลิป — แนบสลิปหลังโอนแล้ว';return}
    if(!q){m.textContent='❌ ไม่พบ QR บนสลิป — ใช้ภาพสลิปจากแอปธนาคาร (ไม่ครอป QR ออก)';return}
    SQ=q;$('pref').value=q.ref;m.textContent=`✅ ${q.bn?'ธนาคาร'+q.bn+' · ':''}เลขอ้างอิง ${q.ref}`}catch(e){m.textContent='❌ อ่านสลิปไม่ได้'}};const d=new Date(Date.now()-new Date().getTimezoneOffset()*6e4);at.value=d.toISOString().slice(0,16);
  const qr=()=>{const amt=P[sel.value],q=$('pqr');if(!C.PROMPTPAY_ID){q.innerHTML=`<div class="small">โอน ${B(amt)} ผ่าน PromptPay · (QR จะแสดงเมื่อตั้งค่าเบอร์ PromptPay)</div>`;return}
   try{q.innerHTML=qrSvg(ppPayload(C.PROMPTPAY_ID,amt),'M')+`<div class="small">สแกนจ่าย ${B(amt)}${C.PROMPTPAY_NAME?' · '+esc(C.PROMPTPAY_NAME):''}</div>`}catch(e){q.textContent=''}};
  sel.onchange=()=>{qr();pd.value=P[sel.value];pdh()};qr();pd.value=P[sel.value];pdh();
  $('pgo').onclick=async()=>{const f=$('pimg').files[0];if(!f)return toast('แนบสลิปก่อน',2000);if(!SQ)return toast('ต้องใช้สลิปที่มี QR ของธนาคาร',3000);const b=$('pgo');b.disabled=true;b.textContent='กำลังส่ง…';
   try{const img=await shrink(f);S.pay=await CLD.mod.payPut({pl:sel.value,amt:P[sel.value],at:at.value?new Date(at.value).toISOString():'',ref:SQ.ref,qr:SQ.raw,bk:SQ.bank,rq:RQ,pd:+pd.value||P[sel.value],img});await sync(true);o.remove();
    if(S.pay&&S.pay.st!='pending')toast('ส่งสลิปแล้ว · '+pay81(S.pay),5000,true);else toast(sel.value=='seat'?'ได้รับสลิปแล้ว ทีมงานจะเพิ่มที่นั่งให้วงของคุณ':'✅ เปิดใช้แล้ว — ทีมงานจะยืนยันสลิปภายหลัง',4000,true)}catch(e){b.disabled=false;b.textContent='ส่งสลิป · เปิดใช้ทันที';toast(/permission/i.test(e.code||e.message)?'ส่งไม่สำเร็จ: สลิปนี้ถูกใช้แล้ว หรือยอดไม่ตรงราคา':'ส่งไม่สำเร็จ: '+(e.code||e.message),4000)}}}
 function need(l,why){if(level()>=l)return true;sheet(why);return false}
 function needF(x,why,pick){if(has(x))return true;sheet(why,pick);return false}
 function nudge(){const r=S.me;if(!r||r.p!='trial'||act(r)||level()>0||localStorage.getItem('bp-trialend'))return;localStorage.setItem('bp-trialend','1');toast('ช่วงทดลอง 7 วันจบแล้ว — ฟีเจอร์หลักยังใช้ได้ฟรี · ดูแพ็กเกจได้ในหน้าบัญชี',6000)}
 setInterval(()=>{sync();draw();nudge()},5000);
 return {sync,level,has,need,needF,sheet,status,get s(){return S}}})();window.__plan=PLAN;window.__pp=ppPayload;
/* gates (UI; Band sharing + invites are also enforced by Firestore rules) */
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('#stai,#moon,[data-a="inv"]');if(!t)return;
 if(t.id=='moon'&&MO.cfg.on)return; // turning OFF is always allowed
 if(CLD.user&&!PLAN.s.me){e.stopImmediatePropagation();e.preventDefault();toast('กำลังตรวจสอบแพ็กเกจ…',1500);PLAN.sync(true).then(()=>{if(PLAN.s.me&&t.isConnected)t.click()});return} // v1.80.3: plan not loaded yet (first seconds after sign-in) → wait instead of showing the plans sheet
 const [x,w,p]=t.id=='stai'?['ai','แยก Stems ด้วย AI','ai']:t.id=='moon'?['mo','แยกช่องเสียงออก','mo']:['band','การเชิญสมาชิก','band'];
 if(!PLAN.needF(x,w,p)){e.stopImmediatePropagation();e.preventDefault()}},true);
{const _bt=bcTick;bcTick=async function(){if(!PLAN.has('band'))return;return _bt()}}
/* privacy links: sign-in card + settings (นำเข้า) */
setInterval(()=>{try{const b=document.querySelector('#acctc .accb');if(b&&!b.querySelector('.pv75')){const a=document.createElement('a');a.className='pv75';a.href='privacy.html';if(!isStandalone()&&!SA840())a.target='_blank';a.textContent='นโยบายความเป็นส่วนตัว';b.appendChild(a)}
 const m=$('main');if(view=='F'&&m&&!m.querySelector('.pv75f')){const f=document.createElement('div');f.className='pv75f';f.innerHTML='<a href="privacy.html"'+(isStandalone()||SA840()?'':' target="_blank"')+'>นโยบายความเป็นส่วนตัว</a>';m.appendChild(f)}}catch(e){}},800);

/* ---- v1.80: band song menu (แทนที่ไฟล์ / ลบจากวง), replace-in-place, dedupe on add, owner mono finder ---- */
const bs80Find=(bid,id)=>{const b=(BD.bands||[]).find(y=>y.id==bid);return {b,x:b&&(BS.l[b.id]||[]).find(y=>y.id==id)}};
const bs80Local=x=>{const sid=BS.mine&&BS.mine.get(x.id);const s=sid&&SONG.get(sid);return s&&!s.bc&&FILES.has(s.fn)&&(FILES.get(s.fn).src!='band')?s:null};
const bs80CanDel=(b,x)=>bdRole(b)==='owner'||(bdRole(b)==='editor'&&x.by===bsMe());
async function bs80Replace(b,x,quiet){const s=bs80Local(x);if(!s){toast('ไม่มีไฟล์ต้นฉบับของเพลงนี้ในเครื่องนี้ — นำเข้าไฟล์ก่อน แล้วลองใหม่',4000);return false}
 if(!quiet&&!confirm('แทนที่ไฟล์ “'+x.ti+'” ในวง '+b.name+' ด้วยไฟล์ในเครื่องนี้?\nเพลงเดิมในเซ็ตลิสต์ยังอยู่ สมาชิกจะโหลดไฟล์ใหม่ให้เอง'))return false;
 BC.busy=1;const lab='☁︎ แทนที่ไฟล์ในวง · '+x.ti;try{BC.last=null;bcPill(lab);const r=await bcPrep(s,p=>bcPill(lab+' · ย่อไฟล์ '+Math.round(p*100)+'%'));if(!r)throw new Error('ไฟล์นี้ส่งขึ้นวงไม่ได้');
  if(bcUsed(b.id)-(x.fz||0)+r.u8.length>bcCap(b.id))throw new Error('พื้นที่เพลงของวงเต็ม');
  await CLD.mod.bandFilePut(b.id,x.id,r.u8,r.m,p=>bcPill(lab+' '+Math.round(p*100)+'%'),{fc:x.fc,fz:x.fz},s.s);delete BC.fail[b.id+x.id];toast('✅ แทนที่ไฟล์ “'+x.ti+'” ในวงแล้ว',2500,true);blog('info','band file replace '+x.id+' '+r.u8.length);return true}
 catch(e){toast('❌ แทนที่ไม่ได้: '+bdErr(e),4000);return false}finally{BC.busy=0;bcPill('');try{bdSDraw()}catch(e){}}}
async function bs80Del(b,x){if(!bs80CanDel(b,x)){toast('ลบได้เฉพาะคนที่อัปเพลงนี้ หรือเจ้าของวง',3000);return}
 if(!confirm('ลบเพลง “'+x.ti+'” ออกจากวง '+b.name+'?\nทุกคนในวงจะไม่เห็นเพลงนี้ และพื้นที่จะคืนกลับมา (ไฟล์ในเครื่องแต่ละคนยังอยู่)'))return;
 try{await CLD.mod.bandSongDel(b.id,x.id,x.fc||null);toast('🗑 ลบ “'+x.ti+'” ออกจากวงแล้ว',2500,true)}catch(e){toast('❌ ลบออกจากวงไม่ได้: '+bdErr(e),4000)}try{bdSDraw()}catch(e){}}
function bs80Menu(btn){document.querySelectorAll('.bs80pop').forEach(e=>e.remove());const {b,x}=bs80Find(btn.dataset.b,btn.dataset.bs80);if(!x)return;
 const m=document.createElement('div');m.className='bs80pop';m.style.cssText='position:fixed;z-index:9999;background:#222;border:1px solid #555;border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:6px;min-width:220px';
 const r=btn.getBoundingClientRect();m.style.top=Math.min(innerHeight-140,r.bottom+4)+'px';m.style.right=Math.max(8,innerWidth-r.right)+'px';
 const it=(k,t,dis)=>`<button type="button" data-a80="${k}" class="hw" style="text-align:left;min-height:44px" ${dis?'disabled':''}>${t}</button>`;
 m.innerHTML=it('rep','⬆ อัปเดตเพลงในวง / แทนที่ไฟล์',!bs80Local(x))+it('del','🗑 ลบจากวง',!bs80CanDel(b,x));document.body.appendChild(m);
 m.onclick=e=>{const a=e.target.closest('[data-a80]');if(!a)return;m.remove();if(a.dataset.a80=='rep')bs80Replace(b,x);else bs80Del(b,x)};
 setTimeout(()=>document.addEventListener('click',function z(e){if(!m.contains(e.target)){m.remove();document.removeEventListener('click',z,true)}},true),0)}
document.addEventListener('click',e=>{const t=e.target.closest('[data-bs80]');if(t){e.stopPropagation();bs80Menu(t)}},true);
// dedupe: a song added that the band already has (same title+artist = same id) → offer to replace instead of a 2nd copy
async function bs80Dedupe(before){if(!BS.mine)return;for(const [k,sid] of BS.mine){if(before.has(sid))continue;for(const b of BD.bands||[]){if(bdRole(b)==='viewer')continue;const x=(BS.l[b.id]||[]).find(y=>y.id==k);
  if(x&&x.fc&&x.by!==bsMe()&&confirm('วง '+b.name+' มีเพลง “'+x.ti+'” แล้ว (ส่งโดย '+(x.byn||'สมาชิก')+')\nแทนที่ไฟล์ในวงด้วยไฟล์ของคุณไหม? (ไม่สร้างเพลงซ้ำ)'))await bs80Replace(b,x,true)}}}
{const _imp=importFiles;importFiles=async function(){const before=new Set(BS.mine?BS.mine.values():[]);const r=await _imp.apply(this,arguments);setTimeout(async()=>{try{rebuildIndex();await bsPub();await bs80Dedupe(before)}catch(e){}},1200);return r}}
// owner: find band copies encoded mono (old <=1.78 encoder) by reading the MP3 frame header of chunk 0
function mp3Mono(u){if(!u)return null;let i=0;if(u[0]==0x49&&u[1]==0x44&&u[2]==0x33)i=10+((u[6]&127)<<21|(u[7]&127)<<14|(u[8]&127)<<7|(u[9]&127));for(;i<Math.min(u.length-4,i+200000);i++)if(u[i]==0xFF&&(u[i+1]&0xE0)==0xE0&&(u[i+1]&6)&&(u[i+2]>>4)!=15&&(u[i+2]>>4)!=0)return (u[i+3]>>6)==3;return null}
async function bs80Mono(bid){const b=(BD.bands||[]).find(y=>y.id==bid),el=$('bs80ml-'+bid);if(!b||!el)return;el.textContent='กำลังตรวจ…';const out=[];
 for(const x of (BS.l[b.id]||[]).filter(x=>x.fc&&/mpeg|mp3/.test(x.fm||'audio/mpeg'))){try{if(mp3Mono(await CLD.mod.bandChunk0(b.id,x.id)))out.push(x)}catch(e){}}
 const mine=out.filter(bs80Local);el.innerHTML=out.length?`<div class="small">เพลงโมโน ${out.length}: ${out.map(x=>esc(x.ti)).join(', ')}</div>${mine.length?`<button type="button" class="hw" id="bs80all-${bid}">⬆ ส่งใหม่จากเครื่องฉัน (${mine.length})</button>`:'<div class="small">ไม่มีไฟล์ต้นฉบับในเครื่องนี้ — ให้คนที่อัปส่งใหม่</div>'}`:'<div class="small">ไม่พบเพลงโมโน ✓</div>';
 const a=$('bs80all-'+bid);if(a)a.onclick=async()=>{a.disabled=true;let n=0;for(const x of mine)if(await bs80Replace(b,x,true))n++;toast('✅ ส่งใหม่ '+n+' เพลง',2500,true)};window.__bs80mono=out.map(x=>x.id)}
document.addEventListener('click',e=>{const t=e.target.closest('[data-b80m]');if(t)bs80Mono(t.dataset.b80m)});
window.__bs80={replace:bs80Replace,del:bs80Del,find:bs80Find,local:bs80Local,mono:bs80Mono,mp3Mono};

// ===================== v1.0.45–1.0.49: delete / hide from library =====================
// v1.0.49: one confirm deletes — band songs removed for everyone; catalog samples hidden
// for the band via reserved bands/{b}/saved/cathide149 (no Firebase rules change).
const CATHIDE_ID='cathide149';
const HIDE149={local:new Set(),band:new Set()};
function libIsCat145(s){if(!s||s.X||s.bc||s._nf)return false;try{return !!(typeof CAT!=='undefined'&&CAT&&CAT.includes(s))}catch(e){return false}}
function libCanBand145(id){return bsFind842(id).filter(({b,x})=>bs80CanDel(b,x))}
function libBandBlocked145(id){return bsFind842(id).filter(({b,x})=>!bs80CanDel(b,x))}
function libHidden149(id){return !!(id&&(HIDE149.local.has(id)||HIDE149.band.has(id)))}
function libHideLoadLocal149(){try{const a=JSON.parse(localStorage.getItem('bp-cathide')||'[]');HIDE149.local=new Set(Array.isArray(a)?a.map(String):[])}catch(e){HIDE149.local=new Set()}}
function libHideSaveLocal149(){try{localStorage.setItem('bp-cathide',JSON.stringify([...HIDE149.local].slice(0,400)))}catch(e){}try{put('kv',{k:'cathide',v:[...HIDE149.local].slice(0,400)})}catch(e){}}
function libHideSyncBand149(){const n=new Set();
 try{for(const b of(BD.bands||[])){const L=SVB.l[b.id]||[];for(const x of L){if(x.id!==CATHIDE_ID)continue;for(const id of(x.o||[]))if(id)n.add(String(id))}}}catch(e){}
 HIDE149.band=n}
function syncUnhideMenu149(){let n=0;try{n=libHiddenIds149().length}catch(e){n=0}
 const b=document.getElementById('op-muhn');if(b){b.textContent=String(n);b.classList.toggle('on',n>0);b.hidden=!n}
 document.querySelectorAll('[data-unhide149] .uhn,[data-unhide149] .nb').forEach(el=>{el.textContent=n?String(n):'';el.classList.toggle('on',n>0);el.hidden=!n});
 const lib=document.getElementById('op-uhlib');if(lib){const show=n>0&&document.body.classList.contains('sheet-open');lib.hidden=!show;const c=lib.querySelector('.uhn');if(c){c.textContent=String(n);c.hidden=!n}}}
window.__syncUnhide=syncUnhideMenu149;
function libHideRefresh149(){libHideSyncBand149();try{rebuildIndex();render()}catch(e){}try{if(window.__dual&&__dual.paint)__dual.paint()}catch(e){}try{syncUnhideMenu149()}catch(e){}}
(async()=>{try{libHideLoadLocal149();const v=(await get('kv','cathide'))?.v;if(Array.isArray(v)&&v.length){HIDE149.local=new Set(v.map(String));libHideSaveLocal149()}}catch(e){}})();
function askActs149(title,acts){document.querySelectorAll('.ask149').forEach(n=>n.remove());
 const d=document.createElement('div');d.className='mbox ask149';d.setAttribute('role','dialog');
 d.style.cssText='position:fixed;left:50%;top:22%;transform:translate(-50%,0);z-index:140;background:#1a1a22;border:1px solid #2a2a36;border-radius:16px;padding:12px;min-width:min(92vw,320px);max-width:92vw;box-shadow:0 12px 40px #000a';
 d.innerHTML='<div class="row" style="justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px"><b style="line-height:1.3">'+title+'</b><button type="button" class="hw ask149x" aria-label="ปิด">✕</button></div>'+
  acts.map((a,i)=>'<button type="button" class="hw" data-i="'+i+'" style="width:100%;margin:6px 0;min-height:48px;text-align:left;white-space:normal;line-height:1.35">'+a[0]+'</button>').join('');
 document.body.appendChild(d);
 d.onclick=function(e){const x=e.target.closest('[data-i]');if(x){const fn=acts[+x.dataset.i]&&acts[+x.dataset.i][1];d.remove();if(fn)try{fn()}catch(err){}}if(e.target.classList.contains('ask149x'))d.remove()};
 setTimeout(function(){document.addEventListener('pointerdown',function off(ev){if(!d.contains(ev.target)){d.remove();document.removeEventListener('pointerdown',off,true)}},true)},0)}
async function libDelLocalFile149(id){const s=SONG.get(id);if(!s)return false;const fn=fileOf(s);
 try{if(fn){await del('files',fn);FILES.delete(fn);if(FLD.mem&&FLD.mem[fn]){delete FLD.mem[fn];try{fldSave()}catch(_){}}}
  if(s.id&&FILES.has('web:'+s.id)){await del('files','web:'+s.id);FILES.delete('web:'+s.id)}
  cache.delete(id);rebuildIndex();try{render()}catch(_){}try{if(window.__dual&&__dual.paint)__dual.paint()}catch(_){}
  toast('🗑 ลบไฟล์ในเครื่องแล้ว (ยังอยู่ในคลังออนไลน์)',2600,true);return true}catch(e){toast('❌ ลบไม่ได้: '+(e.message||e),3500);return false}}
async function libHideTeam149(id){const s=SONG.get(id);if(!s)return false;
 HIDE149.local.add(id);libHideSaveLocal149();
 const bands=(BD.bands||[]).filter(b=>bdRole(b)!=='viewer');
 let bandN=0,err=null;
 if(CLD.user&&CLD.mod&&CLD.mod.bandSavedPut){
  for(const b of bands){try{const cur=(SVB.l[b.id]||[]).find(x=>x.id===CATHIDE_ID);const o=new Set((cur&&cur.o)||[]);o.add(id);
   await CLD.mod.bandSavedPut(b.id,CATHIDE_ID,{n:'ซ่อนคลัง',o:[...o].slice(0,200),d:JSON.stringify({v:1,kind:'cathide'})});
   if(!SVB.l[b.id])SVB.l[b.id]=[];const i=(SVB.l[b.id]||[]).findIndex(x=>x.id===CATHIDE_ID);const row={id:CATHIDE_ID,n:'ซ่อนคลัง',o:[...o].slice(0,200),d:'{"v":1,"kind":"cathide"}',by:BD.uid||'',byn:'',t:Date.now()};
   if(i>=0)SVB.l[b.id][i]=row;else SVB.l[b.id].push(row);bandN++;blog('info','cathide '+b.id+' '+id)}catch(e){err=e;blog('warn','cathide',e.code||e.message)}}}
 libHideSyncBand149();
 try{const i=SET.indexOf(id);if(i>=0){SET.splice(i,1);await saveSet()}}catch(_){}
 try{if(window.__dual&&__dual.eject)__dual.eject(id)}catch(_){}
 if(cur&&cur.id===id){try{stop()}catch(_){}cur=null}if(cue===id){cue=null;try{drawCue()}catch(_){}}
 const fn=fileOf(s);if(fn&&FILES.has(fn)){await del('files',fn).catch(()=>{});FILES.delete(fn)}
 if(s.id&&FILES.has('web:'+s.id)){await del('files','web:'+s.id).catch(()=>{});FILES.delete('web:'+s.id)}
 cache.delete(id);try{rebuildIndex();stripKey='';stripDraw();render()}catch(_){}try{if(window.__dual&&__dual.paint)__dual.paint()}catch(_){}
 try{syncUnhideMenu149()}catch(e){}
 if(err&&!bandN)toast('❌ ซ่อนให้วงไม่ได้: '+bdErr(err)+' — ซ่อนในเครื่องนี้แล้ว',4500);
 else toast((bandN?'🙈 ซ่อนแล้ว · ทั้งวงไม่เห็นเพลงนี้':'🙈 ซ่อนจากคลังแล้ว'+(bands.length?' (รอซิงก์วง)':' (บัญชีนี้)'))+' · กู้คืน: เมนูบัญชี 👁',3600,true);
 return true}
// v1.0.57: restore catalog songs that were soft-hidden (L+R pairs etc.)
// v1.0.58: same restore — entry points in avatar menu + Settings › แอป (not buried in ระบบ)
function libHiddenIds149(){libHideSyncBand149();const s=new Set([...HIDE149.local,...HIDE149.band]);return [...s]}
function libHiddenInfo149(id){id=String(id||'');
 try{for(const s of(CAT||[])){if(idOf(s)===id)return{id,t:s.t||'',a:s.a||'',sd:s.s||'',fn:s.fn||'',cat:1}} }catch(e){}
 if(SONG.has(id)){const s=SONG.get(id);return{id,t:s.t||'',a:s.a||'',sd:s.s||'',fn:s.fn||'',cat:0}}
 const m=id.match(/^([LRX]):(.+)$/);if(m)return{id,t:m[2].replace(/\.[^.]+$/,''),a:'',sd:m[1],fn:m[2],cat:0};
 return{id,t:id,a:'',sd:'',fn:'',cat:0}}
function libSideLabel149(sd){return sd==='L'?'นอมซ้าย':sd==='R'?'นอมขวา':sd==='X'?'สเตอริโอ':''}
async function libUnhide149(id,opt){opt=opt||{};id=String(id||'');if(!id)return false;
 HIDE149.local.delete(id);libHideSaveLocal149();
 const bands=(BD.bands||[]).filter(b=>bdRole(b)!=='viewer');
 let bandN=0,err=null;
 if(CLD.user&&CLD.mod&&CLD.mod.bandSavedPut){
  for(const b of bands){try{const cur=(SVB.l[b.id]||[]).find(x=>x.id===CATHIDE_ID);const o=new Set((cur&&cur.o)||[]);o.delete(id);
   await CLD.mod.bandSavedPut(b.id,CATHIDE_ID,{n:'ซ่อนคลัง',o:[...o].slice(0,200),d:JSON.stringify({v:1,kind:'cathide'})});
   if(!SVB.l[b.id])SVB.l[b.id]=[];const i=(SVB.l[b.id]||[]).findIndex(x=>x.id===CATHIDE_ID);const row={id:CATHIDE_ID,n:'ซ่อนคลัง',o:[...o].slice(0,200),d:'{"v":1,"kind":"cathide"}',by:BD.uid||'',byn:'',t:Date.now()};
   if(i>=0)SVB.l[b.id][i]=row;else SVB.l[b.id].push(row);bandN++;blog('info','cathide unhide '+b.id+' '+id)}catch(e){err=e;blog('warn','cathide unhide',e.code||e.message)}}}
 libHideRefresh149();
 if(opt.toSet&&!SET.includes(id)){try{SET.push(id);await saveSet();try{autoSet()}catch(e){}}catch(e){}}
 const info=libHiddenInfo149(id);
 try{syncUnhideMenu149()}catch(e){}
 if(!opt.quiet){
  if(err&&!bandN)toast('❌ กู้คืนให้วงไม่ได้: '+bdErr(err)+' — กู้ในเครื่องนี้แล้ว',4500);
  else toast('👁 กู้คืน “'+(info.t||id)+'”'+(libSideLabel149(info.sd)?' · '+libSideLabel149(info.sd):'')+(bandN?' · ทั้งวงเห็นอีกครั้ง':'')+(opt.toSet?' · ใส่ท้ายลิสต์แล้ว':''),3200,true)}
 return true}
async function libUnhideAll149(opt){opt=opt||{};const ids=libHiddenIds149();if(!ids.length){toast('ไม่มีเพลงที่ซ่อนไว้',2000);return 0}
 let n=0;for(const id of ids){if(await libUnhide149(id,{quiet:1,toSet:!!opt.toSet}))n++}
 try{syncUnhideMenu149()}catch(e){}
 toast(n?'👁 กู้คืน '+n+' เพลงแล้ว'+(opt.toSet?' · ใส่ท้ายลิสต์แล้ว':''):'กู้คืนไม่สำเร็จ',3000,true);return n}
function libUnhideOpen149(){document.querySelectorAll('.unhide149').forEach(n=>n.remove());
 libHideSyncBand149();const ids=libHiddenIds149();
 const d=document.createElement('div');d.className='mbox unhide149';d.setAttribute('role','dialog');
 d.style.cssText='position:fixed;left:50%;top:10%;transform:translate(-50%,0);z-index:145;background:#1a1a22;border:1px solid #2a2a36;border-radius:16px;padding:12px;width:min(94vw,420px);max-height:78vh;overflow:auto;box-shadow:0 12px 40px #000a';
 const rows=ids.map(id=>{const info=libHiddenInfo149(id);const side=libSideLabel149(info.sd);
  return `<div class="unhide149r" data-id="${esc(id)}" style="display:flex;gap:8px;align-items:center;padding:10px 4px;border-top:1px solid #2a2a36">
   <div style="flex:1;min-width:0"><b data-noi18n style="display:block;line-height:1.3">${esc(info.t||id)}</b>
   <span class="small" data-noi18n>${esc([info.a,side].filter(Boolean).join(' · '))}</span></div>
   <button type="button" class="hw" data-uh="1" style="flex:none;min-height:44px">กู้คืน</button>
   <button type="button" class="hw" data-uhset="1" style="flex:none;min-height:44px" title="กู้คืนและใส่ท้ายลิสต์คืนนี้">＋ลิสต์</button></div>`}).join('');
 d.innerHTML=`<div class="row" style="justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px"><b>👁 เพลงที่ซ่อนจากคลัง</b><button type="button" class="hw unhide149x" aria-label="ปิด">✕</button></div>
  <div class="small" style="margin:0 4px 8px;opacity:.85">เพลงตัวอย่างออนไลน์ที่กด 🗑 จะถูกซ่อน (ไม่ลบจากเซิร์ฟเวอร์) — กู้คืนได้ทั้งนอมซ้าย/ขวา</div>
  ${ids.length?rows:'<div class="small" style="padding:16px 4px">ยังไม่มีเพลงที่ซ่อน</div>'}
  ${ids.length?`<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
   <button type="button" class="hw" data-uhall="1" style="flex:1;min-height:48px">กู้คืนทั้งหมด (${ids.length})</button>
   <button type="button" class="hw" data-uhallset="1" style="flex:1;min-height:48px">กู้คืนทั้งหมด ＋ ใส่ลิสต์</button></div>`:''}`;
 document.body.appendChild(d);
 d.onclick=async e=>{
  if(e.target.classList.contains('unhide149x')){d.remove();return}
  const row=e.target.closest('.unhide149r');const id=row&&row.dataset.id;
  if(e.target.closest('[data-uhallset]')){d.remove();await libUnhideAll149({toSet:1});return}
  if(e.target.closest('[data-uhall]')){d.remove();await libUnhideAll149();return}
  if(id&&e.target.closest('[data-uhset]')){await libUnhide149(id,{toSet:1});row.remove();if(!libHiddenIds149().length)d.remove();return}
  if(id&&e.target.closest('[data-uh]')){await libUnhide149(id);row.remove();if(!libHiddenIds149().length)d.remove();return}
 };
 setTimeout(()=>{document.addEventListener('pointerdown',function off(ev){if(!d.contains(ev.target)){d.remove();document.removeEventListener('pointerdown',off,true)}},true)},0)}
if(!window.__unhide149Click){window.__unhide149Click=1;document.addEventListener('click',function(e){
  const b=e.target&&e.target.closest&&e.target.closest('[data-unhide149]');if(!b)return;
  e.preventDefault();e.stopPropagation();try{libUnhideOpen149()}catch(err){}
},true)}
async function libDelDo145(id,opt){opt=opt||{};const s=SONG.get(id);if(!s)return false;
 const can=opt.band===false?[]:libCanBand145(id);let bandN=0,err=null;
 for(const o of can){try{await CLD.mod.bandSongDel(o.b.id,o.x.id,o.x.fc||null);if(BS.l[o.b.id])BS.l[o.b.id]=BS.l[o.b.id].filter(y=>y.id!==o.x.id);bandN++;blog('info','libDel band '+o.b.id+' '+o.x.id)}catch(e){err=e;blog('warn','libDel band',e.code||e.message)}}
 try{const i=SET.indexOf(id);if(i>=0){SET.splice(i,1);await saveSet()}
  try{if(window.__dual&&__dual.eject)__dual.eject(id)}catch(_){}
  if(cur&&cur.id===id){try{stop()}catch(_){}cur=null}if(cue===id){cue=null;try{drawCue()}catch(_){}}
  const fn=fileOf(s)||s.fn;if(fn&&FILES.has(fn)){await del('files',fn).catch(()=>{});FILES.delete(fn);if(FLD.mem&&FLD.mem[fn]){delete FLD.mem[fn];try{fldSave()}catch(_){}}}
  if(s.id&&FILES.has('web:'+s.id)){await del('files','web:'+s.id).catch(()=>{});FILES.delete('web:'+s.id)}
  cache.delete(id);try{for(const k of [...REND.keys()])if(k.startsWith(id+'|'))REND.delete(k)}catch(_){}
  if(s.X||s.bc||s._nf)SONG.delete(id);
  if(META[id]){delete META[id];await put('kv',{k:'meta',v:META}).catch(()=>{})}
  PREF.delete(id);try{await del('prefs',id)}catch(_){}
  rebuildIndex();try{stripKey='';stripDraw()}catch(_){}try{render()}catch(_){}try{if(window.__dual&&__dual.paint)__dual.paint()}catch(_){}
  if(err&&!bandN)toast('❌ ลบออกจากวงไม่ได้: '+bdErr(err),4000);
  else toast('🗑 ลบจากคลังแล้ว'+(bandN?' · ทุกคนในวงไม่เห็นแล้ว':''),2800,true);
  return true}catch(e){toast('❌ ลบไม่ได้: '+(e.message||e),3500);return false}}
async function libDel145(id){const s=SONG.get(id);if(!s){toast('ไม่พบเพลงในคลัง',2000);return false}
 const auto=!!navigator.webdriver;/*simulated tests skip the confirm tap*/
 // v1.0.49: one confirm → gone from the library. Catalog samples can't be erased on the
 // server, so we hide them for the band (everyone stops seeing the row).
 if(libIsCat145(s)&&!s.X&&!bsFind842(id).length){
  const bands=(BD.bands||[]).filter(b=>bdRole(b)!=='viewer');
  if(!auto&&!confirm('ลบ “'+(s.t||'')+'” ออกจากคลัง?\n'+(bands.length?'ทั้งวงจะไม่เห็นเพลงนี้อีก':'จะไม่โชว์ในคลังของคุณแล้ว')))return false;
  return libHideTeam149(id)}
 const hits=bsFind842(id),can=libCanBand145(id);
 if(hits.length&&!can.length){toast('ลบออกจากวงไม่ได้ — ต้องเป็นเจ้าของวง หรือคนที่อัปเพลงนี้ (สิทธิ์แก้ไข)',4500);return false}
 if(can.length){
  if(!auto&&!confirm('ลบ “'+(s.t||'')+'” ออกจากคลัง?\nทุกคนในวงจะไม่เห็นเพลงนี้แล้ว'))return false;
  return libDelDo145(id,{band:true})}
 // local-only song
 if(!auto&&!confirm('ลบ “'+(s.t||'')+'” ออกจากคลัง?'+(fileOf(s)||(s.fn&&FILES.has(s.fn))?'\nไฟล์ในเครื่องนี้จะถูกลบด้วย':'')))return false;
 return libDelDo145(id,{band:false})}
window.__libDel=libDel145;window.__libHide=libHideTeam149;window.__libHidden=libHidden149;window.__libUnhide=libUnhide149;window.__libUnhideAll=libUnhideAll149;window.__libUnhideOpen=libUnhideOpen149;window.__libHiddenIds=libHiddenIds149;window.__askActs=askActs149;
// v1.0.46: one-tap 🗑 on library rows (Studio left list + คลัง tab) — capture so Dual A/B intercept does not eat it
if(!window.__libDel145Click){window.__libDel145Click=1;document.addEventListener('click',function(e){
  const b=e.target&&e.target.closest&&e.target.closest('[data-libdel145]');if(!b)return;
  e.preventDefault();e.stopPropagation();
  const id=b.getAttribute('data-libdel145');if(id)try{libDel145(id)}catch(err){}
},true)}
// test hook (Playwright): plant a local / band library row without going through IndexedDB
window.__test145={plant(id,o){o=o||{};const fn=String(id).replace(/^X:/,'')||('t'+Date.now()+'.mp3');const s={X:1,s:'X',fn,t:o.t||fn,a:o.a||'',f:o.nf?'ยังเล่นไม่ได้':'ไม่อยู่ในรายชื่อ',g:'',k:'',_pp:1};if(o.nf)s._nf=1;
  if(o.band){BD.uid=BD.uid||'u1';if(!CLD.user)CLD.user={uid:BD.uid,email:'t@t'};BD.bands=[{id:'band1',name:'วงทดสอบ',members:{[BD.uid]:'owner'}}];
   const kid=o.kid||('k'+fn.replace(/\W/g,'').slice(0,12));BS.l={band1:[{id:kid,ti:s.t,ar:s.a,sd:'X',fn,by:BD.uid,byn:'Me',t:Date.now(),fc:0,fz:0}]};s.bc={b:'band1',id:kid,fc:0,fm:'',v:0};
   CLD.mod=CLD.mod||{};window.__del145=[];CLD.mod.bandSongDel=async(b,sid,fc)=>{window.__del145.push({b,id:sid,fc});return true}}
  SONG.set(id,s);if(!SET.includes(id))SET.push(id);return{inSong:SONG.has(id),inSet:SET.includes(id)}},
 plantCat(o){o=o||{};const fn=o.fn||('cat'+Date.now()+'.mp3');const s={s:['L','R','X','W'].includes(o.s)?o.s:'W',fn,t:o.t||fn,a:o.a||'Sample',g:'',k:'',_pp:1};if(!Array.isArray(CAT))CAT=[];if(!CAT.includes(s))CAT.push(s);const id=idOf(s);SONG.set(id,s);return{id,isCat:libIsCat145(s),sd:s.s}},
 has(id){return{inSong:SONG.has(id),inSet:SET.includes(id),bandLeft:(BS.l&&BS.l.band1||[]).length}},dels(){return(window.__del145||[]).slice()}};

// ===================== v1.81: contact channels + support chat =====================
const CT81={c:null,at:0};
async function ct81Load(f){if(!f&&CT81.at&&Date.now()-CT81.at<300e3)return CT81.c;if(!CLD.mod||!CLD.mod.contactCfg)return CT81.c;CT81.at=Date.now();
 try{CT81.c=await CLD.mod.contactCfg()}catch(e){}return CT81.c}
function ct81List(){const c=CT81.c||{},L=[],u=s=>/^https?:\/\//i.test(s)?s:'';const em=c.em||PLANCFG.CONTACT;
 if(em)L.push(['อีเมล',em,'mailto:'+em]);
 if(c.line)L.push(['LINE',c.line,u(c.line)||('https://line.me/R/ti/p/'+encodeURIComponent(c.line.startsWith('@')?c.line:'@'+c.line))]);
 if(c.fb)L.push(['Facebook',c.fb.replace(/^https?:\/\/(www\.)?/,''),u(c.fb)||('https://facebook.com/'+encodeURIComponent(c.fb))]);
 if(c.tel)L.push(['โทร',c.tel,'tel:'+c.tel.replace(/[^0-9+]/g,'')]);
 for(const x of (c.links||[]))if(x&&x.l&&u(x.u||''))L.push([x.l,'',x.u]);return L}
function ct81Html(){return `<div class="ct81"><b>ติดต่อเรา</b> ${ct81List().map(([l,v,h])=>`<a href="${esc(h)}" target="_blank" rel="noopener">${esc(l)}${v?' <span data-noi18n>'+esc(v)+'</span>':''}</a>`).join(' · ')}${CLD.user?' · <button class="lnk" data-ch81="1">💬 แชทกับทีมงาน</button>':''}</div>`}
window.ct81Html=ct81Html;
setInterval(()=>{ct81Load()},5000);
// privacy/help area in the account panel
setInterval(()=>{try{const b=document.querySelector('#acctc .accb');if(!b)return;let e=$('ct81a');if(!e){e=document.createElement('div');e.id='ct81a';b.appendChild(e)}
 const h=ct81Html();if(e.dataset.h!==h){e.innerHTML=h;e.dataset.h=h}}catch(e){}},3000);
// ---- chat ----
const CH81={m:[],th:null,un:null,tun:null,u:null,open:false};
function ch81Sync(){const u=CLD.user&&CLD.mod&&CLD.mod.chatSub?CLD.user.uid:null;if(u===CH81.u)return;
 for(const k of ['un','tun'])if(CH81[k]){try{CH81[k]()}catch(e){}CH81[k]=null}CH81.u=u;CH81.m=[];CH81.th=null;if(!u)return;
 CH81.tun=CLD.mod.chatThreadSub(t=>{const was=CH81.th&&CH81.th.ua;CH81.th=t;if(t&&t.ua&&!was&&!CH81.open)toast('💬 ทีมงานตอบแชทแล้ว',3500,true);if(CH81.open&&t&&t.ua)CLD.mod.chatSeen().catch(()=>{});try{ntBtn()}catch(e){}},()=>{})}
function ch81Unread(){return CH81.th&&CH81.th.ua?1:0}
function ch81Draw(){const L=$('ch81l');if(!L)return;L.innerHTML=CH81.m.length?CH81.m.map(x=>`<div class="ch81m ${x.f=='a'?'a':x.f=='b'?'b':'u'}">${x.f=='b'?'<b class="ai21">🤖 น้องเซ็ต</b>':x.f=='a'?'<b class="ai21">🧑‍💼 ทีมงาน</b>':''}<span data-noi18n>${esc(x.x)}</span><i>${x.f=='a'?'ทีมงาน · ':''}${ntAgo(x.t)}</i></div>`).join('')+(AI21.typing?'<div class="ch81m b ai21t"><b class="ai21">🤖 น้องเซ็ต</b><span>กำลังพิมพ์…</span></div>':'')+(AI21.note?`<div class="ai21n">${esc(AI21.note)}</div>`:''):'<div class="small" style="padding:12px 2px">พิมพ์ถามได้เลย — ทีมงานจะตอบในนี้ และมีแจ้งเตือนที่กระดิ่ง 🔔</div>';const sb=()=>{L.scrollTop=L.scrollHeight};sb();requestAnimationFrame(sb);setTimeout(sb,120);setTimeout(sb,400)}
function ch81Open(){if(!CLD.user)return toast('เข้าสู่ระบบก่อน เพื่อแชทกับทีมงาน',2500);ch81Sync();const d=document.createElement('div');d.className='ch81';
 d.innerHTML='<div id="ch81l" class="ch81l"></div><div class="ch81f"><textarea id="ch81x" maxlength="1000" rows="2" placeholder="พิมพ์ข้อความ…"></textarea><button id="ch81s" class="pl76b">ส่ง</button></div><div class="ai21f"><button id="ch81h" class="hw">👤 คุยกับแอดมิน</button></div>';
 const pl=$('pl75s');if(pl)pl.remove();try{window.__acp&&__acp.close()}catch(e){}open60('ch81','💬 แชทกับทีมงาน',d);CH81.open=true;
 if(!CH81.un)CH81.un=CLD.mod.chatSub(m=>{CH81.m=m;ch81Draw()},e=>blog('warn','chat',e.code||e.message));ch81Draw();CLD.mod.chatSeen().catch(()=>{});
 const send=async()=>{const t=$('ch81x'),v=t.value.trim();if(!v)return;const b=$('ch81s');b.disabled=true;let sent=false;try{await CLD.mod.chatSend(v);t.value='';sent=true}catch(e){toast('ส่งไม่สำเร็จ: '+(e.code||e.message),3000)}b.disabled=false;t.focus();if(sent)ai21Go(v)};
 $('ch81h').onclick=async()=>{try{await CLD.mod.chatHand();await ai23Q()}catch(e){toast('ส่งไม่สำเร็จ: '+(e.code||e.message),3000)}};
 $('ch81s').onclick=send;$('ch81x').onkeydown=e=>{if(e.key=='Enter'&&!e.shiftKey){e.preventDefault();send()}};
 const iv=setInterval(()=>{if(OPEN60!=='ch81'){CH81.open=false;clearInterval(iv)}},500)}
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-ch81]');if(t){e.preventDefault();ch81Open()}});
// bell: unread admin reply → item that deep-links to the chat
{const _it=ntItems;ntItems=function(){const L=_it.apply(this,arguments);const t=CH81.th;if(t&&t.ua){const tt=t.t&&t.t.toMillis?t.t.toMillis():Date.now();L.unshift({k:'chat',ti:'ทีมงานตอบแชทแล้ว: '+(t.lm||''),t:tt,sys:1})}return L}}
{const _g=ntGo;ntGo=function(x){if(x&&x.k=='chat'){close60();return ch81Open()}return _g.apply(this,arguments)}}
{const _t=ntText;ntText=function(x){return x&&x.k=='chat'?esc(x.ti):_t.apply(this,arguments)}}
// bell panel: chat entry on top
{const _o=ntOpen;ntOpen=function(){_o.apply(this,arguments);try{const p=document.querySelector('.ntp70');if(p&&!p.querySelector('.ch81e')){if(!CLD.user||!(BD.bands||[]).length){const h=document.createElement('div');h.className='small nt841';h.style.padding='6px 4px';h.textContent=CLD.user?'ℹ️ บัญชีนี้ยังไม่อยู่ในวง — เข้าร่วมวงเพื่อรับการแจ้งเตือนเรื่องในวง':'ℹ️ ยังไม่ได้เข้าสู่ระบบในเครื่องนี้ — เข้าสู่ระบบบัญชีเดียวกับเครื่องอื่นเพื่อเห็นการแจ้งเตือนของวงเหมือนกัน';p.prepend(h)}const b=document.createElement('button');b.className='hw ch81e';b.dataset.ch81='1';b.innerHTML='💬 แชทกับทีมงาน'+(ch81Unread()?' <span class="ntn" style="position:static">1</span>':'');p.prepend(b)}}catch(e){}}}
function ch81Hash(){if(location.hash==='#chat'){const go=()=>{if(!CLD.user)return false;history.replaceState(null,'',location.pathname+location.search);ch81Open();return true};if(!go()){const t=setInterval(()=>{if(go())clearInterval(t)},500);setTimeout(()=>clearInterval(t),20000)}}}
window.addEventListener('hashchange',ch81Hash);setTimeout(ch81Hash,1500);
setInterval(()=>{try{ch81Sync()}catch(e){}},2000);
window.__ch81={open:ch81Open,s:CH81,unread:ch81Unread,draw:ch81Draw};
// ===== v1.84.21: AI first reply in support chat (Gemini, called from this device; admin can turn off) =====
const AI21={typing:false,note:'',cfg:null,cfgT:0,busy:false,
 KB:`คุณคือ "น้องเซ็ต" ผู้ช่วยของ SetSod (แนะนำตัวว่า "น้องเซ็ต ผู้ช่วยของ SetSod" เมื่อทักทายครั้งแรก) แอป SetSod (เซ็ตสด) เครื่องเล่นเพลงสำหรับนักดนตรีเล่นสด ตอบเป็นภาษาไทย สุภาพ กระชับ (ไม่เกิน 6 บรรทัด) ใช้เฉพาะข้อมูลด้านล่างเท่านั้น
กฎเหล็ก:
- ห้ามแต่งข้อมูล ราคา โปรโมชัน ส่วนลด วันที่ หรือฟีเจอร์ที่ไม่มีในข้อมูลนี้ ถ้าไม่รู้ให้บอกตรงๆ ว่าจะส่งต่อให้แอดมิน
- ห้ามยืนยันว่าได้รับเงิน/สลิปถูกต้อง/อนุมัติแพ็กเกจแล้ว ห้ามสัญญาคืนเงิน ห้ามขอรหัสผ่าน/OTP/เลขบัตร
- เรื่องการชำระเงินที่มีปัญหา สลิป การคืนเงิน บัญชีถูกระงับ บั๊กที่แก้ตามขั้นตอนไม่ได้ ข้อร้องเรียน หรือผู้ใช้ขอคุยกับคน → ตอบสั้นๆ แล้วใส่ [[HANDOFF]] ท้ายข้อความ
- ถ้าไม่แน่ใจคำตอบ ให้ใส่ [[HANDOFF]] ท้ายข้อความ
- คำถาม "ทำยังไง/วิธีใช้" ที่มีคำตอบในข้อมูลนี้ ให้ตอบเป็นขั้นตอนให้ครบ ห้ามใส่ [[HANDOFF]] และห้ามบอกว่าส่งต่อแอดมิน (ส่งต่อเฉพาะเมื่อผู้ใช้ขอคุยกับแอดมินเอง หรือทำตามขั้นตอนแล้วยังไม่ได้)
ข้อมูลแอป:
- ใช้ฟรี: เครื่องเล่น เซ็ตลิสต์ โหมด Live คีย์/ความเร็ว คลิก(เมโทรนอม) นำเข้า stems มิกเซอร์ สำรองข้อมูลขึ้นคลาวด์ (ต้องเข้าสู่ระบบ) ทดลองทุกฟีเจอร์ฟรี 7 วัน ไฟล์เพลงเก็บในเครื่องผู้ใช้ ไม่อัปโหลดเพลงขึ้นคลาวด์ยกเว้นส่งเพลงให้วง
- แพ็กเกจ ราคาต่อปี: Pro 490 บาท (แยก Stems ด้วย AI + แยกช่องเสียงออก audio interface, 1 คน) · Band 1,290 บาท (Pro ทุกคนในวง 5 คน, ส่งเพลงให้วงผ่านคลาวด์, เชิญสมาชิก) · เพิ่มสมาชิกวง 150 บาท/คน · แพ็กเสริม AI Stems อย่างเดียว 290 บาท · แยกช่องเสียงออกอย่างเดียว 290 บาท
- วิธีจ่าย: เมนูบัญชี → แพ็กเกจ → เลือกแพ็กเกจ → สแกน QR พร้อมเพย์ (ชื่อบัญชี นาย ไพฑูรย์ อินกรัด) → ใส่เวลาที่โอน + ยอดที่โอน → แนบสลิป (ต้องเห็น QR มุมสลิปชัด) → กด "ส่งสลิป · เปิดใช้ทันที" ใช้ได้ทันทีแบบชั่วคราว 24 ชม. แล้วทีมงานตรวจสลิปและยืนยันด้วยตนเอง (รอการยืนยัน) สลิป 1 ใบใช้ได้ครั้งเดียว ถ้าสลิปไม่ถูกต้องสิทธิ์จะถูกยกเลิก ถ้าโอนขาดสามารถโอนเพิ่มได้จากหน้าเดียวกัน
- แยก Stems ด้วย AI: ทำงานในเครื่อง ไม่อัปโหลดเพลง ใช้ได้เฉพาะคอมพิวเตอร์ที่รองรับ WebGPU ดาวน์โหลดโมเดลครั้งแรก ~173 MB ได้ 4 แทร็ก กลอง เบส ร้อง ดนตรีอื่น
- ติดตั้งแอป: iPhone/iPad เปิดใน Safari → ปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" · Android ดาวน์โหลดแอป SetSod (APK) จากลิงก์ในแอป หรือกดติดตั้งจากเบราว์เซอร์ Chrome · คอมพิวเตอร์ติดตั้งจาก Chrome/Edge ได้
- เว็บแอปทางการ: https://paithoonbeer.github.io (เดิม setsod.web.app · เปิดบนมือถือ/คอม แล้วเพิ่มลงหน้าจอโฮมได้) · แอป Android (APK): https://github.com/paithoonbeer/setsod-app/releases/latest/download/SetSod.apk
- เข้าร่วมวง/ชวนเพื่อนเข้าวง (ทำได้ 3 วิธี): 1) เจ้าของวงกด 🔑 สร้างรหัสเชิญ (เลือกสิทธิ์) → กด 📤 แชร์ลิงก์เชิญ ส่งให้เพื่อน → เพื่อนเปิดลิงก์ เข้าสู่ระบบ แล้วกด 👥 เข้าร่วมเลย (ใช้ได้ 7 วัน) 2) เพื่อนใส่รหัสเชิญ 10 ตัวในช่องรหัส ในหน้าบัญชี → วงของฉัน → กด 👥 เข้าร่วมวง 3) เจ้าของวงหรือคนที่แก้ไขได้ พิมพ์อีเมลเพื่อนในช่อง ✉️ แล้วกด ✉️ เชิญ → เมื่อเพื่อนเข้าสู่ระบบด้วยอีเมลนั้น (เช่น Google) จะมีหน้าต่าง "วง X ชวนคุณเข้าร่วม" กด ✓ เข้าร่วม · ยกเลิกคำเชิญได้ด้วย ✕ · วงละ 5 คน (เพิ่มที่นั่งได้) · ต้องเป็นแพ็กเกจ Band หรือช่วงทดลอง 7 วัน ถึงจะสร้างคำเชิญได้ · ถ้ากดแล้วขึ้นข้อความผิดพลาด ให้อ่านข้อความใต้ช่องรหัส (เช่น รหัสหมดอายุ ให้ขอรหัสใหม่)
- วง: เจ้าของวงสร้างวงในหน้าบัญชี → สร้างรหัสเชิญ (เลือกสิทธิ์ แก้ไขได้/ดูอย่างเดียว) → สมาชิกเปิดลิงก์หรือใส่รหัสเพื่อเข้าร่วม เจ้าของวงโอนความเป็นเจ้าของได้: เปิดรายชื่อสมาชิก กด 👑 โอนเจ้าของวง ผู้รับต้องกดรับ เจ้าของเดิมจะกลายเป็น "แก้ไขได้" แพ็กเกจ Band เดิมของวงยังใช้ต่อได้จนหมดอายุ
- แก้ปัญหาเบื้องต้น: เพลงหยุดเมื่อปิดจอ → เปิดแอปค้างไว้/ปิดโหมดประหยัดแบตให้แอป, แอป Android ทำงานเบื้องหลังได้ดีกว่า · ไม่มีเสียง → เช็กปุ่มเงียบ/เสียงเครื่อง/อุปกรณ์เสียงที่เลือก · แอปไม่อัปเดต → ปิดแอปแล้วเปิดใหม่ · เปลี่ยนเครื่อง → เข้าสู่ระบบแล้วกด "กู้คืนจากคลาวด์" แล้วนำเข้าไฟล์เพลงเดิม ระบบจับคู่ให้อัตโนมัติ
- ติดต่อแอดมิน: กดปุ่ม 👤 คุยกับแอดมิน ในแชทนี้ หรืออีเมล paithooningrad@gmail.com
`};
function ai21Day(){return new Date(Date.now()+7*3600e3).toISOString().slice(0,10)}
async function ai21Cfg(){if(AI21.cfg&&Date.now()-AI21.cfgT<120000)return AI21.cfg;AI21.cfg=await CLD.mod.aiCfg();AI21.cfgT=Date.now();return AI21.cfg}
async function ai21Call(c,hist){const mock=localStorage.getItem('bp-aimock');if(mock){await new Promise(r=>setTimeout(r,600));if(mock=='429')throw Object.assign(new Error('quota'),{q:1});const q=hist[hist.length-1].parts[0].text;
  return /โอน|สลิป|คืนเงิน|ยืนยัน/.test(q)?'ระบบจะเปิดใช้ชั่วคราว 24 ชม. ทันทีหลังส่งสลิป แล้วทีมงานจะตรวจสลิปและยืนยันด้วยตนเองครับ เรื่องสถานะการชำระเงิน ขอส่งต่อให้แอดมินตรวจสอบนะครับ [[HANDOFF]]':'แพ็กเกจ Pro ราคา 490 บาท/ปี (1 คน: แยก Stems ด้วย AI + แยกช่องเสียงออก) ส่วน Band ราคา 1,290 บาท/ปี (Pro ทุกคนในวง 5 คน ส่งเพลงให้วงผ่านคลาวด์ เชิญสมาชิก) เพิ่มสมาชิกได้คนละ 150 บาทครับ'}
 let last;for(const m of [c.m||'gemini-3.5-flash-lite',c.m2||'gemini-3.1-flash-lite']){
  const ac=new AbortController(),to=setTimeout(()=>ac.abort(),20000);
  try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,{method:'POST',signal:ac.signal,headers:{'Content-Type':'application/json','x-goog-api-key':c.k},
    body:JSON.stringify({systemInstruction:{parts:[{text:AI21.KB}]},contents:hist,generationConfig:{maxOutputTokens:500,temperature:0.3}})});clearTimeout(to);
   if(r.ok){const d=await r.json();const t=(((d.candidates||[])[0]||{}).content||{}).parts;const x=t&&t.map(p=>p.text||'').join('').trim();if(x)return x;last=new Error('empty')}
   else{last=Object.assign(new Error('http '+r.status),{q:r.status==429});if(!(r.status==429||r.status==404||r.status>=500))break}}catch(e){clearTimeout(to);last=e}}
 throw last||new Error('ai')}
// v1.84.23: น้องเซ็ต answers right away. Asking for a human (button or words) → FIFO admin queue, AI quiet in that chat.
// After an admin reply the AI stays quiet until the admin closes the chat (✅) or c.hold hours pass (default 12).
const AI23RX=/ติดต่อ\s*แอดมิน|คุย\s*กับ\s*แอดมิน|ขอ\s*แอดมิน|หาแอดมิน|เรียกแอดมิน|ขอ\s*คน\s*จริง|คุยกับคน|ขอคุยกับคน|เจ้าหน้าที่|\badmin\b/i;
const ms23=v=>v&&v.toMillis?v.toMillis():(+v||0);
async function ai23Q(){AI21.note='👤 ส่งต่อให้แอดมินแล้ว แอดมินจะตอบตามลำดับคิว 🙏';ch81Draw();const n=await CLD.mod.chatQPos();if(n)AI21.note=`👤 คุณอยู่คิวที่ ${n} แอดมินจะตอบตามลำดับ 🙏 (น้องเซ็ตจะหยุดตอบในแชทนี้ระหว่างรอ)`;ch81Draw()}
async function ai21Go(v){if(AI21.busy)return;AI21.note='';try{const c=await ai21Cfg();if(!c||!c.on||!c.k&&!localStorage.getItem('bp-aimock'))return;
  const th=CH81.th||{},hm=ms23(th.hm),hq=ms23(th.hq);
  if(AI23RX.test(v||'')){await CLD.mod.chatQueue();return ai23Q()}
  if(th.hh&&!(hm>hq))return ai23Q();// waiting in the admin queue
  if(th.hh&&Date.now()-hm<(c.hold==null?12:c.hold)*3600e3){AI21.note='👤 แอดมินกำลังดูแลแชทนี้ จะตอบกลับในแชทนี้ 🙏';return ch81Draw()}
  const day=ai21Day(),used=await CLD.mod.aiUsed(day);if(used>=(c.n||0)){await CLD.mod.chatQueue();return ai23Q()}
  AI21.busy=true;AI21.typing=true;ch81Draw();
  const hist=CH81.m.slice(-10).map(x=>({role:x.f=='u'?'user':'model',parts:[{text:String(x.x).slice(0,1000)}]}));if(!hist.length||hist[hist.length-1].role!='user')hist.push({role:'user',parts:[{text:v}]});
  while(hist.length&&hist[0].role!='user')hist.shift();
  let x=await ai21Call(c,hist);let h=/\[\[HANDOFF\]\]/.test(x);x=x.replace(/\[\[HANDOFF\]\]/g,'').trim();if(h)x+='\n\n👤 ส่งต่อให้แอดมินแล้ว แอดมินจะตอบในแชทนี้';
  await CLD.mod.aiPost(x||'แอดมินจะตอบเร็วๆ นี้ 🙏',h,day,used+1)}
 catch(e){AI21.note='แอดมินจะตอบเร็วๆ นี้ 🙏';try{blog('warn','ai21 '+(e&&e.message))}catch(_){}}
 AI21.busy=false;AI21.typing=false;ch81Draw()}
window.__ai21={s:AI21,go:ai21Go,day:ai21Day};
window.__ct81={load:ct81Load,s:CT81,list:ct81List};

NTI.chat='message-square';

// v1.81: inactivity auto-restore (admin marks >30 days inactive; opening the app clears it)
{const done=new Set();setInterval(()=>{try{if(!CLD.user||!CLD.mod||!CLD.mod.suspClear||typeof BD=='undefined')return;const ids=(BD.bands||[]).map(b=>b.id).filter(i=>!done.has(i)),k='u'+CLD.user.uid;
 if(done.has(k)&&!ids.length)return;done.add(k);ids.forEach(i=>done.add(i));CLD.mod.suspClear(ids).then(me=>{if(me)toast('👋 ยินดีต้อนรับกลับ — บัญชีกลับมาใช้งานตามปกติแล้ว',4500,true)}).catch(()=>{})}catch(e){}},6000)}
{const _s811=start;start=function(){window.__starts=(window.__starts||0)+1;return _s811.apply(this,arguments)}}

// ===================== v1.81.2: pitch/tempo engine off the main thread (Worker + AudioWorklet) =====================
// Before: SoundTouch filled a ScriptProcessor on the page's main thread, so any busy moment (tab switch, big list) = audio dropout.
const STW={ok:false,p:null};
function stwInit(){if(STW.p||!ctx||!ctx.audioWorklet||typeof Worker=='undefined'||localStorage.getItem('bp-stw')==='0')return;STW.p=ctx.audioWorklet.addModule('st-out.js').then(()=>{STW.ok=true;blog('info','stw ready')}).catch(e=>{blog('warn','stw off',e&&e.message)})}
{const _ia812=initAudio;initAudio=function(){const r=_ia812.apply(this,arguments);try{stwInit()}catch(e){}return r}}
try{if(ctx)stwInit()}catch(e){}
class ShW{constructor(b,onEnd){this.b=b;this.onEnd=onEnd;this.sr=b.sampleRate;this.duration=b.duration;this.timePlayed=0;this._p0=0;this._t=1;this._k=0;this.under=0;
  this.node=new AudioWorkletNode(ctx,'st-out',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});this._node={};this._filter={};const me=this;this._soundtouch={get virtualTempo(){return me._t}};
  this.w=new Worker(new URL('st-worker.js',import.meta.url),{type:'module'});const mc=new MessageChannel();this.w.postMessage({t:'port'},[mc.port1]);this.node.port.postMessage({t:'port'},[mc.port2]);
  this.node.port.onmessage=e=>{const d=e.data;if(d.t=='pos'){if(d.s>0){this.timePlayed=d.s/this.sr;this.got=true}this.under=d.u}else if(d.t=='end'){if(!this.dead){this.dead=true;try{this.onEnd()}catch(x){}}}};
  this.w.onmessage=e=>{if(e.data.t=='more')this.seg(e.data.from)};this.w.onerror=e=>blog('error','stw worker',e&&e.message);
  const ck=(n)=>{if(this.dead||this.got)return;if(ctx.state!=='running'&&n<20){setTimeout(()=>ck(n+1),1000);return}blog('warn','stw no audio - fallback');STW.ok=false;if(sh===this&&playing){try{start(this.timePlayed)}catch(e){}}};setTimeout(()=>ck(0),2500);queueMicrotask(()=>{if(this.dead)return;const a=Math.round(this._p0);this.w.postMessage({t:'init',len:b.length,pos:a,tempo:this._t,pitch:this._k});this.seg(a)})}
 seg(a){if(this.dead)return;const n=Math.min(this.b.length-a,20*this.sr);if(n<=0)return;const L=this.b.getChannelData(0).slice(a,a+n),R=(this.b.numberOfChannels>1?this.b.getChannelData(1):this.b.getChannelData(0)).slice(a,a+n);this.w.postMessage({t:'seg',a,L,R},[L.buffer,R.buffer])}
 set tempo(v){this._t=v;if(this.w)this.w.postMessage({t:'set',tempo:v})}get tempo(){return this._t}
 set pitchSemitones(v){this._k=v||0;if(this.w)this.w.postMessage({t:'set',pitch:this._k})}
 set percentagePlayed(v){this._p0=v*this.duration*this.sr;this.timePlayed=this._p0/this.sr}get percentagePlayed(){return 100*this.timePlayed/this.duration}
 connect(n){this.node.connect(n)}disconnect(){try{this.node.disconnect()}catch(e){}}
 off(){this.dead=true;try{this.node.port.postMessage({t:'stop'})}catch(e){}try{this.w.terminate()}catch(e){}/*v1.83: release buffer + handlers so old songs are GC'd*/try{this.node.port.onmessage=null;this.node.port.close();this.w.onmessage=null;this.w.onerror=null}catch(e){}this.b=null;this.onEnd=null;this._soundtouch=null}}
function mkSh(b,onEnd){if(STW.ok&&!b.__st){try{return new ShW(b,onEnd)}catch(e){blog('warn','stw fail',e&&e.message)}}return new PitchShifter(ctx,b,16384,onEnd)}
window.__stw={get ok(){return STW.ok},get kind(){return typeof sh!=='undefined'&&sh?(sh instanceof ShW?'worklet':'script'):null},get under(){return sh&&sh.under}};

// ===================== v1.81.2: Pad hold — pad on the NEXT song keeps looping after the current song ends; turning the pad off starts that song =====================
PAD.hold=null;
function padHoldOn(id){PAD.hold=id;PAD.wait=true;hold812UI();try{cancelCd('')}catch(e){}try{$('ps').textContent='🎹 รอ — กดปิดแพดเพื่อเริ่มเพลง'}catch(e){}}
function padHoldGo(){const id=PAD.hold;PAD.hold=null;PAD.force=true;PAD.wait=true;hold812UI();if(!(id&&SONG.get(id))){padOff(1.5);PAD.sid=null;return}try{if(window.__dual&&__dual.on)__dual.expectHold(id)}catch(e){}const at=(typeof trS==='function'?trS(id):0)||0;if(cur&&cur.id===id&&cur.buf){try{ended=false;offset=at}catch(e){}start(at);return}load(id)}
{const _an=autoNext;autoNext=function(){if(PAD.on&&PAD.sid&&cur&&PAD.sid!==cur.id){padHoldOn(PAD.sid);return}return _an.apply(this,arguments)}}
{const _xf=xfade;xfade=function(){if(PAD.on&&PAD.sid&&cur&&PAD.sid!==cur.id)return;return _xf.apply(this,arguments)}}
{const _p=pad65;pad65=async function(id){if(PAD.hold&&PAD.on&&PAD.sid==id){padHoldGo();return}const r=await _p.apply(this,arguments);if(PAD.on&&PAD.sid==id&&!playing&&ended&&cur&&cur.id!==id)padHoldOn(id);return r}}
{const _t=padToggle;padToggle=function(want){const id=want||PAD.sid||(cur&&cur.id);if(PAD.hold&&PAD.on&&(!want||PAD.hold===id||PAD.sid===id)){padHoldGo();return}if(!PAD.on){const was=!!playing,at=(typeof pos==='function'?pos():offset);try{if(playing)stop()}catch(e){}try{if(cur&&id&&cur.id===id){ended=false;offset=(typeof trS==='function'?trS(id):0)||0}}catch(e){}if(id)PAD.sid=id;const r=_t.apply(this,arguments);if(PAD.on&&id){PAD.sid=id;padHoldOn(id);try{if(typeof sync==='function')sync()}catch(e){}}else if(was&&cur&&cur.buf){try{start(at)}catch(e){}}return r}return _t.apply(this,arguments)}}
{const _o=padOff;padOff=function(){if(PAD.hold&&!PAD.force&&!PAD.re){PAD.hold=null;hold812UI()}return _o.apply(this,arguments)}}
{const _ss=padSongStart;padSongStart=function(){if(PAD.force&&PAD.on&&cur&&(!PAD.sid||PAD.sid===cur.id)){PAD.force=false;PAD.wait=false;PAD.sid=null;padOff(+(localStorage.getItem('bp-padxf')||4));hold812UI();return}return _ss.apply(this,arguments)}}
function hold812UI(){let b=$('hold812');const on=!!(PAD.hold&&PAD.on);if(!on){if(b)b.hidden=true;document.querySelectorAll('[data-p65=pad].hold').forEach(x=>{x.classList.remove('hold');x.title='Pad ลูปคีย์เพลง'});return}
 if(!b){b=document.createElement('button');b.type='button';b.id='hold812';b.className='hold812';b.onclick=()=>padHoldGo();document.body.appendChild(b)}const s=SONG.get(PAD.hold);const t='🎹 รอ — กดปิดแพดเพื่อเริ่มเพลง'+(s?' “'+s.t+'”':'');if(b.textContent!==t)b.textContent=t;b.hidden=false;
 document.querySelectorAll('[data-p65=pad]').forEach(x=>{const h=x.dataset.id==PAD.hold;if(x.classList.contains('hold')!==h){x.classList.toggle('hold',h);x.title=h?'รอ — กดปิดแพดเพื่อเริ่มเพลง':'Pad ลูปคีย์เพลง'}})}
setInterval(()=>{try{if(PAD.hold&&!PAD.on)PAD.hold=null;hold812UI()}catch(e){}},500);
window.__hold={get s(){return{hold:PAD.hold,on:PAD.on,sid:PAD.sid,wait:PAD.wait}},go:()=>padHoldGo()};

// v1.81.2: Library list (500+ songs) is built in small pieces during idle time instead of all at once on every tab switch
let LIBT=0;function libMore(m,L,i){const tk=++LIBT;if(i>=L.length)return;const ul=[...m.querySelectorAll(':scope>ul')].pop();if(!ul)return;
 const step=()=>{if(tk!==LIBT||!ul.isConnected||view!=='P')return;const j=Math.min(L.length,i+50);ul.insertAdjacentHTML('beforeend',L.slice(i,j).map(s=>item(s)).join(''));i=j;if(i<L.length)sch()};
 const sch=()=>window.requestIdleCallback?requestIdleCallback(step,{timeout:300}):setTimeout(step,30);sch()}
window.__lib={get done(){const m=$('main'),ul=m&&[...m.querySelectorAll(':scope>ul')].pop();return !!ul}};

// v1.81.2: list thumbnails — use the small 112px copy as a cached blob: URL (was: the 256px data: URL text pasted into the HTML of every row on every redraw = MBs of HTML + image decodes)
const THU=new Map();function thUrl(id){const a=ART.get(id);const d=a&&(a.s||a.f)||ARTB.get(id)||null;if(!d)return null;if(typeof d!=='string'||!d.startsWith('data:'))return d;const c=THU.get(id);if(c&&c.d===d)return c.u;
 try{const i=d.indexOf(','),mt=(d.slice(5,i).split(';')[0])||'image/jpeg',bin=atob(d.slice(i+1)),u8=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)u8[k]=bin.charCodeAt(k);if(c)URL.revokeObjectURL(c.u);const u=URL.createObjectURL(new Blob([u8],{type:mt}));THU.set(id,{d,u});return u}catch(e){return d}}
th65=function(id,c){const u=c?artOf(id):thUrl(id);return `<span class="th65${c?' '+c:''}" data-th="${esc(id)}" role="button" tabindex="0" aria-label="รูปเพลง (แตะเพื่อเปลี่ยน)">${u?`<img src="${u}" alt="" decoding="sync">`:ico60('music')}</span>`};

// ===================== v1.82.1: Live waveform + scrubber (seek on release; cached waveform, only the playhead moves) =====================
const LW={k:'',img:null,drag:null};
function lwEl(){const lv=$('livelist');if(!lv||!document.body.classList.contains('live'))return null;const nw=lv.querySelector('.lvnow');if(!nw)return null;let w=lv.querySelector('#lvw');
 if(!w){nw.insertAdjacentHTML('afterend','<div id="lvw" class="lvw" role="slider" aria-label="ตำแหน่งเพลง — ลากแล้วปล่อยเพื่อเลื่อน" tabindex="0"><canvas></canvas><i class="lwh"></i><i class="lwg" hidden></i><b class="lwt" hidden></b></div>');w=lv.querySelector('#lvw');LW.k='';lwWire(w)}return w}
function lwBg(w){const cv=w.querySelector('canvas');const W=Math.round(w.clientWidth*devicePixelRatio),H=Math.round(w.clientHeight*devicePixelRatio);const P=cur&&PEAKS.get(cur.id);let mts=0,mte=0;try{if(cur&&cur.buf){mts=trS(cur.id);mte=trE(cur.id,cur.buf.duration)}}catch(e){}const k=(cur?cur.id:'')+'|'+W+'|'+H+'|'+(P?P[0].length:0)+'|'+mts+'|'+mte;if(k===LW.k)return;LW.k=k;
 cv.width=W;cv.height=H;const g=cv.getContext('2d');g.clearRect(0,0,W,H);if(!P||!W)return;const ci=clickCh(cur.id),a=P[1-ci],b=P[ci],n=a.length;g.fillStyle='#5ac8fa';
 for(let x=0;x<W;x++){const i=Math.floor(x/W*n),v=Math.max(a[i]||0,(b[i]||0)*.6),h=Math.max(1,v*H*.9);g.fillRect(x,(H-h)/2,1,h)}
 // v1.0.40: dim the parts outside the song's start/end marks
 try{const d=cur.buf.duration;if(d>0&&(mts>0||mte<d-0.05)){g.fillStyle='rgba(0,0,0,.6)';const xs=Math.round(mts/d*W),xe=Math.round(mte/d*W);if(xs>0)g.fillRect(0,0,xs,H);if(xe<W)g.fillRect(xe,0,W-xe,H);g.fillStyle='#ff453a';g.fillRect(xs,0,Math.max(1,devicePixelRatio),H);g.fillRect(Math.min(W-1,xe),0,Math.max(1,devicePixelRatio),H)}}catch(e){}}
function lwTick(){const w=lwEl();if(!w)return;if(!cur){if(!w.hidden)w.hidden=true;return}if(w.hidden)w.hidden=false;if(!PEAKS.has(cur.id)&&cur.buf){try{peaks(cur.id,cur.buf)}catch(e){}}lwBg(w);
 const d=cur.buf?cur.buf.duration:0;const f=d?Math.min(1,Math.max(0,pos()/d)):0;const h=w.querySelector('.lwh'),tx='translateX('+(f*w.clientWidth).toFixed(1)+'px)';if(h.style.transform!==tx)h.style.transform=tx;{const av=String(Math.round(f*100));if(w.getAttribute('aria-valuenow')!==av)w.setAttribute('aria-valuenow',av)}}
function lwWire(w){const fr=e=>{const r=w.getBoundingClientRect();return Math.min(1,Math.max(0,(e.clientX-r.left)/r.width))};
 const show=f=>{const g=w.querySelector('.lwg'),t=w.querySelector('.lwt');g.hidden=t.hidden=false;g.style.transform='translateX('+(f*w.clientWidth).toFixed(1)+'px)';t.textContent=fmt(f*(cur&&cur.buf?cur.buf.duration:0))};
 const hide=()=>{w.querySelector('.lwg').hidden=w.querySelector('.lwt').hidden=true;w.classList.remove('drag')};
 w.addEventListener('pointerdown',e=>{if(!cur)return;e.preventDefault();try{w.setPointerCapture(e.pointerId)}catch(_){}LW.drag={x:e.clientX,t:Date.now(),f:fr(e),mv:false};w.classList.add('drag');show(LW.drag.f)});
 w.addEventListener('pointermove',e=>{const d=LW.drag;if(!d)return;if(Math.abs(e.clientX-d.x)>6)d.mv=true;d.f=fr(e);show(d.f)});
 w.addEventListener('pointerup',e=>{const d=LW.drag;LW.drag=null;hide();if(!d||!cur)return;if(d.mv||Date.now()-d.t>350){seekFrac(d.f);window.__lwSeeks=(window.__lwSeeks||0)+1}else toast('↔️ ลากแล้วปล่อย (หรือแตะค้าง) เพื่อเลื่อนเพลง',1500,true)});
 w.addEventListener('pointercancel',()=>{LW.drag=null;hide()});
 w.addEventListener('keydown',e=>{if(!cur||!cur.buf)return;const s=e.key=='ArrowLeft'?-5:e.key=='ArrowRight'?5:e.key=='Home'?-1e9:0;if(!s)return;e.preventDefault();seekFrac(Math.min(1,Math.max(0,(pos()+s)/cur.buf.duration)))})}
setInterval(()=>{try{if(document.visibilityState=='visible')lwTick()}catch(e){}},250);addEventListener('resize',()=>{LW.k=''});
window.__lw={tick:()=>lwTick(),get k(){return LW.k}};


// ===================== v1.83 stability =====================
// iOS audio interruption (call/Siri/other app): the graph is frozen, not lost. Keep the song where it is and resume when iOS lets us.
let INTR=null;window.__ctx83=()=>ctx;function intr83(){if(INTR)return;const at=pos();INTR={t:Date.now(),at};try{$('ps').textContent='⏸ เสียงถูกขัดจังหวะ — กำลังกลับมาเล่นต่อ… (แตะจอได้)'}catch(e){}const tryR=()=>{if(!INTR)return;if(!playing||ctx.state==='running'){if(INTR&&playing)blog('info','resumed after interruption '+Math.round((Date.now()-INTR.t)/1000)+'s');INTR=null;try{sync()}catch(e){}return}
  ctx.resume().catch(()=>{});if(Date.now()-INTR.t>120000){const a=INTR.at;INTR=null;stop();offset=a;$('ps').textContent='⏸ เสียงถูกขัดจังหวะ — แตะ ▶ เพื่อเล่นต่อ';sync();return}setTimeout(tryR,1000)};setTimeout(tryR,300)}
['pointerdown','touchend','keydown'].forEach(ev=>addEventListener(ev,()=>{if(INTR&&ctx&&ctx.state!=='running')ctx.resume().catch(()=>{})},{capture:true,passive:true}));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible'&&ctx&&playing&&ctx.state!=='running')intr83()});
// memory: free pre-rendered key/tempo copies + decoded buffers nobody needs (song left the queue, settings changed)
const MEM83={lo:false};
function memLo(){try{const k=JSON.parse(localStorage.getItem('bp-kills')||'[]').filter(t=>Date.now()-t<864e5);return SONG.size>900||k.length>=2||(navigator.deviceMemory&&navigator.deviceMemory<=3)||(window.__dur84||0)>600}catch(e){return false}}
setInterval(()=>{try{if(loadingId)return;const w=rWant();for(const k of [...REND.keys()])if(!w.has(k))REND.delete(k);if(cur&&!window.__nocap)cacheCap();MEM83.lo=memLo()}catch(e){}},5000);
{const _an=an65;an65=async function(id){if(MEM83.lo)return;return _an.apply(this,arguments)}}
window.__mem83={get lo(){return MEM83.lo},nxOk:id=>nxOk(id),get rend(){return REND.size},get cache(){return [...cache.keys()]}};
// crash recovery: still save position every 3 s (silent restore via bp-state on next load).
// v1.0.55: do NOT show the floating green “▶ เล่นต่อ …” bar — cluttered the stage UI.
setInterval(()=>{try{if(cur&&!loadingId)saveState()}catch(e){}},3000);
function resume83(){window.__r83=(window.__r83||0)+1;try{const b=$('rs83');if(b)b.remove()}catch(e){}}
// self-monitoring: kill-restarts + long stalls go to the admin log (rate-capped by lg66: per session + per day)
{const _bl=blog;blog=function(lv,msg){const r=_bl.apply(this,arguments);try{const m=String(msg||'');if(/^start after unexpected end/.test(m)){k83(m)}
 else if(/^stw no audio|^render /.test(m))setTimeout(()=>{try{lg66('stall',m.slice(0,280))}catch(e){}},0)}catch(e){}return r}}
function k83(m){try{const k=JSON.parse(localStorage.getItem('bp-kills')||'[]').filter(t=>Date.now()-t<864e5);k.push(Date.now());localStorage.setItem('bp-kills',JSON.stringify(k.slice(-20)))}catch(e){}setTimeout(()=>{try{lg66('kill',String(m).slice(0,280))}catch(e){}},8000);try{resume83()}catch(e){}}
function kInfo84(){const a=window.__alive83||{};let k=0;try{k=JSON.parse(localStorage.getItem('bp-kills')||'[]').filter(t=>Date.now()-t<864e5).length}catch(e){}
 return ' | eng='+(a.e||'-')+' rend='+(a.r??'-')+' cache='+(a.c??'-')+' lowmem='+(a.lo?1:0)+' up='+(a.u??'-')+'s play='+(a.p?1:0)+' dur='+(a.d||'-')+'s fmt='+(a.f||'-')+' heap='+(a.hp||'-')+'MB devmem='+(navigator.deviceMemory||'-')+'GB kills24h='+k+' view='+(a.vw||'-')+' beat='+(a.t?Math.round(((window.__kill83||window.__kbg84)-a.t)/1000):'-')+'s'}
if(window.__kill83&&Date.now()-window.__kill83<60000)k83('start after unexpected end (kill/crash) v'+APPV+kInfo84()+' | cur='+(()=>{try{return JSON.parse(localStorage.getItem('bp-state')).id}catch(e){return''}})());
if(window.__kbg84&&Date.now()-window.__kbg84<60000)setTimeout(()=>{try{lg66('kill',('ended while in background (screen off / OS) v'+APPV+kInfo84()+' | cur='+((window.__alive83||{}).cur||'')).slice(0,300))}catch(e){}},8000);

// v1.83.1: one-tap restart (↺ 0:00) next to every Play button for the current song; keeps playing, or just resets when paused
const RSI='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 3v5h5"/></svg>';
let RS0=0;function rs831(e){if(e){e.preventDefault();e.stopPropagation()}const n=Date.now();if(n-RS0<700||!cur||!cur.buf)return;RS0=n;try{seekFrac(0)}catch(x){}try{if(!playing){offset=0;ended=false}sync()}catch(x){}try{waveDraw()}catch(x){}try{navigator.vibrate&&navigator.vibrate(10)}catch(x){}}
window.__rs831=rs831;
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-rs831]');if(b)rs831(e)},true);
function rs831Place(){try{for(const b of document.querySelectorAll('[data-rs831]'))if(!b.innerHTML)b.innerHTML=RSI;const on=!!(cur&&cur.buf);document.body.classList.toggle('rs831on',on);
 {const lp=$('lvp'),lr=document.querySelector('.lvnow .lvrs');if(lp&&lr&&lp.nextElementSibling!==lr)lp.after(lr)}
 const m=$('main');if(!m)return;const want=view=='S'&&on?[...m.querySelectorAll('[data-play]')].find(x=>x.dataset.play===cur.id):null;
 for(const b of m.querySelectorAll('.rs831.rsc'))if(!want||b.previousElementSibling!==want)b.remove();
 if(want&&!(want.nextElementSibling&&want.nextElementSibling.classList.contains('rsc'))){const b=document.createElement('button');b.type='button';b.className='rs831 rsc';b.dataset.rs831='';b.setAttribute('aria-label','เริ่มเพลงใหม่');b.innerHTML=RSI;want.after(b)}}catch(e){}}
setInterval(rs831Place,400);rs831Place();

// v1.83.3: Tonight/band list items that use another member's local id (e.g. "L:เปลี่ยน - ETC.m4a") resolve to this device's song or the band-library copy (X:fn) instead of red "เพลงหาย"
function fnOf83(id){const i=String(id).indexOf(':');return i>0&&i<3?String(id).slice(i+1):String(id)}
function tiOf83(fn){const b=fn.replace(/\.[a-z0-9]{2,4}$/i,'').replace(/^\s*\d+[\s._-]+/,'');const k=b.split(/\s+-\s+/);return {t:(k[0]||b).trim(),a:(k[1]||'').trim()}}
function res83(id){if(SONG.get(id))return id;const fn=fnOf83(id);for(const p of ['X:','L:','R:','A:','M:','S:'])if(SONG.get(p+fn))return p+fn;
 for(const [k,v] of SONG)if(v.fn===fn)return k;
 for(const b of (typeof BD!=='undefined'&&BD.bands)||[])for(const x of BS.l[b.id]||[])if(x.fn===fn&&x.ti){const m=slMatch(x.ti,x.ar,x.sd);if(m)return m}
 const g=tiOf83(fn);return g.t&&slMatch(g.t,g.a)||null}
function setFix83(){if(typeof LIVE!=='undefined'&&LIVE)return 0;let ch=0,dr=0;const orig=new Set(SET);const seen=new Set();/*v1.83.5: only drop a remapped id whose target is already in the list; user-added repeats stay*/const n=[];for(const id of SET){const r=res83(id);if(r&&r!==id){ch=1;if(orig.has(r)||seen.has(r)){dr++;continue}seen.add(r);n.push(r)}else n.push(id)}if(ch){SET=n;try{saveSet()}catch(e){}if(dr)try{toast('ℹ️ รวมเพลงซ้ำจากไอดีเก่า '+dr+' รายการ',2500,true)}catch(e){}}return ch}
function bandEnt83(fn){for(const b of (typeof BD!=='undefined'&&BD.bands)||[])for(const x of BS.l[b.id]||[])if(x.fn===fn)return x;return null}
function missRow83(id,i){const fn=fnOf83(id),x=bandEnt83(fn),g=x?{t:x.ti||tiOf83(fn).t,a:x.ar||''}:tiOf83(fn);
 const why=x&&!x.fc?'คนส่งยังไม่ได้อัปไฟล์ขึ้นวง — ให้คนส่งกด “ส่งไฟล์ขึ้นวง”':!CLD.user?'ยังไม่มีในเครื่อง — เข้าสู่ระบบ/เข้าวง เพื่อโหลดจากวง':'ยังไม่มีไฟล์ในเครื่อง/ในวง — นำเข้าไฟล์ หรือให้คนในวงส่งเพลงขึ้นวง';
 return `<li class="ms83"><div class="i"><b data-noi18n>${i+1}. ${esc(g.t)}</b>${g.a?` <span class="small" data-noi18n>– ${esc(g.a)}</span>`:''}<div class="small ms83w">⏳ ${why}</div></div><button class="add rmb" data-rm="${i}" aria-label="ลบออกจากลิสต์">✕</button></li>`}
window.__res83={res:res83,fix:setFix83,ti:tiOf83};

function scSave83(m){const r=[];const se=document.scrollingElement;if(se)r.push([se,se.scrollTop]);for(let e=m;e&&e!==document.body;e=e.parentElement)if(e.scrollTop>0)r.push([e,e.scrollTop]);
 let an=null;if(LTAP83&&Date.now()-LTAP83.t<4000){const b=[...m.querySelectorAll(':scope>ul>li [data-play]')].find(x=>x.dataset.play===LTAP83.id);if(b){const t=b.closest('li').getBoundingClientRect().top;if(t>-50&&t<innerHeight)an={id:LTAP83.id,t}}}
 if(!an)for(const li of m.querySelectorAll(':scope>ul>li')){const t=li.getBoundingClientRect().top;if(t>=0){const id=li.querySelector('[data-play]')?.dataset.play;if(id){an={id,t};break}}}return {r,an}}
function scRest83(S){for(const [e,y] of S.r)if(Math.abs(e.scrollTop-y)>1)e.scrollTop=y;if(!S.an)return;let stop=false;const st=()=>{stop=true};addEventListener('touchstart',st,{once:true,passive:true});addEventListener('wheel',st,{once:true,passive:true});
 const fix=()=>{if(stop)return;const b=[...document.querySelectorAll('#main>ul>li [data-play]')].find(x=>x.dataset.play===S.an.id),li=b&&b.closest('li');if(!li)return;const d=li.getBoundingClientRect().top-S.an.t;if(Math.abs(d)>2){const e=S.r.length>1?S.r[S.r.length-1][0]:document.scrollingElement;e.scrollTop+=d}};
 fix();requestAnimationFrame(fix);for(const t of [80,250,600,1100])setTimeout(fix,t);setTimeout(()=>{removeEventListener('touchstart',st);removeEventListener('wheel',st)},1200)}

let LTAP83=null;document.addEventListener('pointerdown',e=>{const li=e.target.closest&&e.target.closest('#main>ul>li');const id=li&&li.querySelector('[data-play]')?.dataset.play;if(id)LTAP83={id,t:Date.now()}},{capture:true,passive:true});

// v1.83.4: current song length for kill context / low-memory mode (long WAV)
setInterval(()=>{try{const b=cur&&cache.get(cur.id);if(b&&b.then)b.then(x=>{window.__dur84=x&&x.duration||0}).catch(()=>{});else window.__dur84=(b&&b.duration)||(cur&&cur.buf&&cur.buf.duration)||0}catch(e){}},5000);/*v1.83.5: decoded buffer too, not only Promise*/
window.__lg84={get q(){return LG66.q.slice()},get eng(){return window.__stw&&__stw.kind}};

// ===== v1.83.6: Tonight — swap blocks: #sopt (เช็กเพลง·ล้างลิสต์·เล่นต่ออัตโนมัติ) on the page where the tiles were; tiles (โหลด/แชร์/ลิสต์ที่บันทึก) into เพิ่มเติม where #sopt was =====
function sw836(m){try{if(view!='S'||!m)return;const mb=$('s66more'),mr=mb&&mb.closest('#main')?mb.parentElement:null;
 let b=$('r836b');if(!b){b=document.createElement('div');b.id='r836b';b.className='row s66row r836b';more66Box().appendChild(b)}
 for(const id of ['dlall','shbtn','svlist']){const n=m.querySelector('#'+id);if(!n||n.parentElement===b)continue;const o=b.querySelector('#'+id);if(o)o.replaceWith(n);else b.appendChild(n)}
 {const want=['dlall','shbtn','svlist'].map(id=>b.querySelector('#'+id)).filter(Boolean);const have=[...b.children].filter(c=>want.includes(c));if(have.some((c,i)=>c!==want[i]))for(const n of want)b.appendChild(n)}
 const s=null;if(s&&mr){if(s.nextElementSibling!==mr)mr.before(s);if(!s.classList.contains('r836'))s.classList.add('r836');if(s.classList.contains('acc-c'))s.classList.remove('acc-c')}
 if(mr&&!mr.classList.contains('r836m'))mr.classList.add('r836m')}catch(e){}}
window.__sw836=()=>sw836($('main'));
// ===== v1.83.6: Live — search the library and add / insert next (cue) / insert at… without leaving Live (reuses Tonight search results + handlers) =====
const LVSQ={on:false,q:''};let LVSQN=null;
function lvSq(){try{const lv=$('livelist');if(!lv||!document.body.classList.contains('live'))return;const h=lv.querySelector('.lvh');if(!h)return;
 let bt=h.querySelector('#lvsb');if(!bt){bt=document.createElement('button');bt.id='lvsb';bt.type='button';bt.className='hw';bt.setAttribute('aria-label','ค้นหาเพลง');bt.textContent='🔍 ค้นหา';bt.onclick=()=>{LVSQ.on=!LVSQ.on;lvSq();if(LVSQ.on)setTimeout(()=>{try{$('lvsqi').focus()}catch(e){}},50)};const x=$('lvx');x?x.before(bt):h.appendChild(bt)}
 bt.classList.toggle('on',LVSQ.on);
 if(!LVSQN){LVSQN=document.createElement('div');LVSQN.id='lvsq';LVSQN.innerHTML='<div class="lvsqw"><input id="lvsqi" type="search" placeholder="🔍 ค้นเพลงจากคลัง แล้วแทรก/เพิ่มเข้าลิสต์" autocomplete="off" data-noi18n><button type="button" class="hw" id="lvsqx" aria-label="ปิดค้นหา">✕</button></div><div id="lvsqr"></div>';
  LVSQN.querySelector('#lvsqi').addEventListener('input',e=>{LVSQ.q=e.target.value;lvSqDraw()});LVSQN.querySelector('#lvsqx').onclick=()=>{LVSQ.on=false;LVSQ.q='';LVSQN.querySelector('#lvsqi').value='';lvSqDraw();lvSq()}}
 if(LVSQN.hidden!==!LVSQ.on)LVSQN.hidden=!LVSQ.on;if(h.nextElementSibling!==LVSQN)h.after(LVSQN);lvPos838();const sk=SET.join('|');if(LVSQN.dataset.sk!==sk){LVSQN.dataset.sk=sk;lvSqDraw()}}catch(e){}}
// v1.83.8: Live search sits over the list area only — transport stays put (no reflow), stable with the iOS keyboard
function lvPos838(){const L=$('livelist'),n=LVSQN,on=!!(n&&LVSQ.on&&document.body.classList.contains('live'));document.body.classList.toggle('lv838',on);if(!on||!L)return;const l=L.querySelector('.lvl');if(!l)return;
 const st={top:l.offsetTop+'px',left:l.offsetLeft+'px',width:l.offsetWidth+'px',height:l.offsetHeight+'px'};for(const k in st)if(n.style[k]!==st[k])n.style[k]=st[k]}
{const f=()=>{try{lvPos838();if(document.body.classList.contains('lv838')&&(scrollY||document.documentElement.scrollTop))scrollTo(0,0)}catch(e){}};addEventListener('resize',f);addEventListener('orientationchange',()=>setTimeout(f,300));if(window.visualViewport){visualViewport.addEventListener('resize',f);visualViewport.addEventListener('scroll',f)}document.addEventListener('focusin',e=>{if(e.target&&e.target.id=='lvsqi')setTimeout(f,0)})}
function lvSqDraw(){const r=$('lvsqr');if(!r)return;const t=sq(LVSQ.q);const h=sqHtml(t);if(r.dataset.h!==h){r.dataset.h=h;r.innerHTML=h}}
setInterval(lvSq,400);
window.__lvsq={s:LVSQ,draw:()=>{lvSq();lvSqDraw()}};
{const _mb=more66Badge;more66Badge=function(){_mb();try{const b=$('s66more'),s=$('svlist');if(b&&s&&s.querySelector('.sv63n'))b.classList.add('warn')}catch(e){}}}/*v1.83.6: new band saved list → dot on เพิ่มเติม (ลิสต์ที่บันทึก lives there now)*/
// v1.84.0: Live — pad button on EVERY card (was only current+next via .p811); unknown key → pending state, not hidden
setInterval(()=>{try{if(!document.body.classList.contains('live'))return;document.querySelectorAll('#livelist .lvl [data-p65=pad]').forEach(b=>{const id=b.dataset.id,k=!!songKey(id),busy=BC.anBusy&&BC.an.has(id)&&!k;const st=k?'':(busy?'busy':'wait');if((b.dataset.k840||'')!==st){b.dataset.k840=st;b.classList.toggle('k840w',!k);b.title=k?'Pad ลูปคีย์เพลง':(busy?'กำลังหาคีย์…':'ยังไม่รู้คีย์ — แตะเพื่อหาคีย์')}})}catch(e){}},500);
window.__pad840=()=>[...document.querySelectorAll('#livelist .lvl .sc[data-sid]')].map(c=>{const b=c.querySelector('[data-p65=pad]');return{id:c.dataset.sid,vis:!!b&&b.offsetParent!==null,st:b?b.dataset.k840||'':'none'}});
// v1.84.0: 'local' marker on band songs whose นอม is a local-only override (META.so) — the band value is not applied on this device
function loc840(){try{const ids=new Set();for(const b of BD.bands||[])for(const x of BS.l[b.id]||[])if(x.fn)ids.add('X:'+x.fn);document.querySelectorAll('.sc[data-sid],li [data-play]').forEach(e=>{const id=e.dataset.sid||e.dataset.play,box=e.dataset.sid?e:e.closest('li');if(!box)return;const want=false;/*v1.84.1: members sync to the band — no local-only marker*/let m=box.querySelector('.loc840');if(want&&!m){m=document.createElement('span');m.className='loc840';m.textContent='local';m.title='นอมเปลี่ยนเฉพาะเครื่องนี้ (ไม่ตามวง)';(box.querySelector('.sct,.t')||box).appendChild(m)}else if(!want&&m)m.remove()})}catch(e){}}
setInterval(loc840,800);window.__loc840=()=>document.querySelectorAll('.loc840').length;

// v1.84.0: Android browser tab → install entry (beforeinstallprompt or Thai instructions) + fullscreen while in Live
const AND840=/Android/i.test(navigator.userAgent),SA840=()=>!!((window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform())||/SetSodApp/.test(navigator.userAgent))||matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;let BIP840=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();BIP840=e;inst840()});addEventListener('appinstalled',()=>{BIP840=null;localStorage.setItem('bp-inst840','x');inst840()});
function inst840(){try{let b=$('inst840');const show=AND840&&!SA840()&&localStorage.getItem('bp-inst840')!=='x';if(!show){if(b)b.remove();return}
 if(!b){b=document.createElement('span');b.id='inst840';b.className='inst840';b.innerHTML='<button type="button" class="hw" id="inst840b">📲 ติดตั้งแอป</button><button type="button" class="hw inst840x" id="inst840x" aria-label="ซ่อน">✕</button>';document.body.appendChild(b);
  $('inst840x').onclick=e=>{e.stopPropagation();localStorage.setItem('bp-inst840','x');b.remove()};
  $('inst840b').onclick=async()=>{if(BIP840){const p=BIP840;BIP840=null;try{p.prompt();const r=await p.userChoice;if(r&&r.outcome==='accepted'){localStorage.setItem('bp-inst840','x');b.remove()}}catch(e){}return}{const sam=/SamsungBrowser/i.test(navigator.userAgent);toast(sam?'📲 Samsung Internet: กดเมนู ≡ (ล่างขวา) › “เพิ่มหน้าลงใน” › “หน้าจอหลัก” — ถ้าขึ้นว่าติดตั้งไม่ได้ ให้เปิดลิงก์นี้ใน Chrome แล้วกด ⋮ › “ติดตั้งแอป”':'📲 Chrome: กด ⋮ มุมขวาบน › “ติดตั้งแอป” (หรือ “เพิ่มลงในหน้าจอหลัก”) แล้วเปิดจากไอคอน — ถ้าติดตั้งไม่ได้ ลองอัปเดต Chrome หรือล้างแคชเว็บนี้แล้วลองใหม่',12000)}}}}catch(e){}}
setInterval(inst840,1500);setTimeout(inst840,300);
{const _sl=setLive;setLive=function(on){const r=_sl.apply(this,arguments);try{if(AND840&&!SA840()&&document.documentElement.requestFullscreen){if(on&&!document.fullscreenElement)document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(()=>{});else if(!on&&document.fullscreenElement)document.exitFullscreen().catch(()=>{})}}catch(e){}return r}}
function vh840(){try{const h=(window.visualViewport&&visualViewport.height)||innerHeight;document.documentElement.style.setProperty('--vh840',h+'px')}catch(e){}}vh840();addEventListener('resize',vh840);window.visualViewport&&visualViewport.addEventListener('resize',vh840);
window.__and840={inst:()=>!!$('inst840'),bip:()=>!!BIP840,sa:SA840};

// v1.84.2: band song info (title/artist/key/นอม side) is band-wide; the band doc in Firestore is the single source of truth.
// Band song doc id never changes after a rename; local songs are matched by file (X:fn), so Tonight/live/saved lists (which store X:fn ids) still resolve.
const P842=new Map(),R842={n:0,t:0};
function bsFind842(id){const out=[];for(const b of BD.bands||[])for(const x of BS.l[b.id]||[])if((x.fn&&('X:'+x.fn===id||cat845(x.fn).includes(id)))||(BS.mine&&BS.mine.get(x.id)===id))out.push({b,x});return out}
function ap842(id,e,x){try{if(!x||!x.ti||!e)return false;if(P842.has(id)&&Date.now()-P842.get(id)<20000)return true;let m=META[id];const was=!!(m&&m.so);let ch=0,sch=0;if(!m)m=META[id]={};
 if(e.t!==x.ti){e.t=x.ti;ch=1}if(m.t!==x.ti){m.t=x.ti;ch=1}const ar=x.ar||'';if((e.a||'')!==ar){e.a=ar;ch=1}if((m.a||'')!==ar){m.a=ar;ch=1}
 if(typeof x.k=='string'){if((e.k||'')!==x.k){e.k=x.k;ch=1}if((m.k||'')!==x.k){m.k=x.k;ch=1}}
 if(x.sd=='L'||x.sd=='R'){if(e.s!==x.sd){blog('info','band side '+id+' '+e.s+'→'+x.sd);e.s=x.sd;sch=1;SD838.n++}if(m.s&&m.s!==x.sd){m.s=x.sd;ch=1}}
 if(was){delete m.so;ch=1}
 if(ch||sch){if(ch)put('kv',{k:'meta',v:META}).catch(()=>{});if(sch&&cur&&cur.id===id)try{applyMix();mixUI()}catch(_){}R842.n++;clearTimeout(R842.t);R842.t=setTimeout(()=>{try{render()}catch(_){}try{loc840()}catch(_){}},120)}
 return true}catch(err){blog('warn','ap842',err.message);return false}}
async function meta842(id,s){const L=bsFind842(id);if(!L.length||!CLD.user||!CLD.mod||!CLD.mod.bandSongMeta)return 0;P842.set(id,Date.now());let ok=0;
 try{for(const {b,x} of L){const o={ti:s.t,ar:s.a||'',k:s.k||''};if(s.s=='L'||s.s=='R')o.sd=s.s;if(x.ti===o.ti&&(x.ar||'')===o.ar&&(x.k||'')===o.k&&(!o.sd||x.sd===o.sd))continue;
  try{await CLD.mod.bandSongMeta(b.id,x.id,o);sed848(b.id,x,o);Object.assign(x,o);ok++}catch(e){blog('warn','band meta',e.code||e.message);toast('⚠️ ส่งข้อมูลเพลงให้วงไม่ได้ — ลองใหม่อีกครั้ง',3000)}}
  if(META[id]&&META[id].so){delete META[id].so;put('kv',{k:'meta',v:META}).catch(()=>{})}if(ok)toast('☁︎ อัปเดตข้อมูลเพลงให้ทั้งวงแล้ว',2000,true)}finally{P842.delete(id)}return ok}
function all842(){for(const b of BD.bands||[])for(const x of BS.l[b.id]||[]){if(!x.fn)continue;const ids=new Set(['X:'+x.fn,...cat845(x.fn)]);const mm=BS.mine&&BS.mine.get(x.id);if(mm)ids.add(mm);for(const id of ids){const e=SONG.get(id);if(e)ap842(id,e,x)}}}
setInterval(()=>{try{if(CLD.user)all842()}catch(e){}},5000);
window.__v842={find:bsFind842,apply:all842,meta:meta842,r:R842,save:()=>put("kv",{k:"meta",v:META})};
function st842(){try{const s=$('strip'),px=$('plx');if(!s||!px||!document.querySelector('#pl.open'))return;if(!matchMedia('(orientation:landscape) and (max-height:500px)').matches)return;if(px.scrollTop>2)return;
 const t=Math.max(0,Math.round(s.getBoundingClientRect().top));const v=t+'px';if(document.documentElement.style.getPropertyValue('--st842')!==v)document.documentElement.style.setProperty('--st842',v)}catch(e){}}
setInterval(st842,700);addEventListener('resize',()=>setTimeout(st842,150));addEventListener('orientationchange',()=>setTimeout(st842,400));
// v1.84.2 Live: tapping a row only cues. Stopped/paused → load it paused at 0:00 (big ▶ starts it). Playing → set as next song (highlighted, next-song key panel opens), current keeps playing.
const LV842={nx:null,last:null};
async function lvTap842(id){try{if(window.__dual&&__dual.on){if(__dual.songTap)__dual.songTap(id,false);return}
 if(playing&&cur){cue=id;await cueAct('nx');openCue(id);LV842.nx=id;LV842.last={id,mode:'next'};toast('⏭ ตั้งเป็นเพลงถัดไปแล้ว: '+((SONG.get(id)||{}).t||''),2500,true);nx842()}
 else{LV842.nx=null;LV842.last={id,mode:'cue'};await load(id,false);nx842()}}catch(e){blog('warn','lvTap842',e.message)}}
function nx842(){try{if(LV842.nx&&(!cur||cur.id===LV842.nx||SET.indexOf(LV842.nx)!==SET.indexOf(cur.id)+1))LV842.nx=null;document.querySelectorAll('#livelist .lvl .sc[data-sid]').forEach(c=>c.classList.toggle('nx842',c.dataset.sid===LV842.nx))}catch(e){}}
setInterval(nx842,500);
window.__lv143={start:o=>lvStart(o),join:(id,o)=>lvJoin(id,o),push:()=>lvPush(),get live(){return LIVE?{id:LIVE.id,b:LIVE.b||'',ro:!!LIVE.ro,o:(LIVE.o||[]).slice(),map:[...LVMAP.entries()],st:LVST}:null}};// test hook
window.__lv842={get:()=>LV842,tap:lvTap842,st:()=>({cur:cur&&cur.id,playing:!!playing,set:SET.slice(),cue})};

// v1.84.5: one-tap "send to band then save" from the edit sheet — a catalog/personal song becomes a band song (same row, same id; lists keep working)
const C846={c:null,n:-1,m:null};function cat845(fn){if(!fn)return [];if(C846.c!==CAT||C846.n!==CAT.length){const m=new Map();for(const c of CAT){if(!c.fn)continue;let l=m.get(c.fn);if(!l)m.set(c.fn,l=[]);l.push(idOf(c))}C846.c=CAT;C846.n=CAT.length;C846.m=m}return C846.m.get(fn)||[]}
function fn845(fn){for(const b of BD.bands||[])for(const x of BS.l[b.id]||[])if(x.fn===fn)return {b,x};return null}
function can845(){try{return !!(CLD.user&&CLD.mod&&CLD.mod.bandSongsPut&&(BD.bands||[]).some(b=>bdRole(b)&&bdRole(b)!=='viewer'))}catch(_){return false}}
const W845=(f,ms)=>new Promise(ok=>{const t0=Date.now();const k=()=>{let v=false;try{v=f()}catch(_){}if(v||Date.now()-t0>ms)return ok(v);setTimeout(k,300)};k()});
async function go845(id){const s=SONG.get(id);if(!s)return false;const lab='☁︎ ส่งเข้าวง · '+s.t;try{
  if(!fileOf(s)){if(s.X||!s.id)throw new Error('ไม่มีไฟล์เพลงในเครื่อง');bcPill(lab+' · โหลดไฟล์');await storeBlob(s,await fetchAudio(s))}
  META[id]={...(META[id]||{}),bx:1};delete META[id].so;await put('kv',{k:'meta',v:META});
  bcPill(lab+' · เพิ่มในวง');await W845(()=>!BS.busy,15000);await bsPub();
  const f=await W845(()=>bsFind842(id).length,15000);if(!f)throw new Error('วงยังไม่ตอบรับ ลองใหม่อีกครั้ง');
  await meta842(id,s);bcPill('');toast('✅ เป็นเพลงของวงแล้ว · ชื่อใหม่ส่งให้ทุกคน',2500,true);blog('info','band845 '+id);
  if(bcPending().length)setTimeout(()=>bcTick().catch(()=>{}),300);try{render()}catch(_){}return true}
 catch(e){bcPill('');toast('⚠️ ส่งเข้าวงไม่ได้: '+(e.message||e)+' — บันทึกในเครื่องนี้แล้ว',4000);blog('warn','band845',e.message);return false}}
window.__b845s={go:go845,can:can845};

// v1.84.6: no background reload while audio is active (playing, loading, auto-continue countdown/gap). Only explicit user actions reload at once.
function busy846(){try{if(playing||loadingId||cd)return true;if(AUTO.on&&ended&&cur){const i=SET.indexOf(cur.id);if(i>=0&&SET[i+1]&&Date.now()-(window.__fin846||0)<60000)return true}}catch(_){}return false}
{const _f=finish;finish=function(){window.__fin846=Date.now();return _f.apply(this,arguments)}}
{const _r=bpReload,Q846={t:0,r:''};bpReload=function(r){if(/update button|language|cloud restore/.test(r||'')||window.__updForce||!busy846())return _r(r);
 if(Q846.t)return;Q846.r=r;blog('info','reload deferred (audio active): '+r);let idle=0;Q846.t=setInterval(()=>{if(busy846()){idle=0;return}idle+=2;if(idle>=20){clearInterval(Q846.t);Q846.t=0;_r(Q846.r+' (deferred)')}},2000)};window.__rl846={q:Q846,busy:busy846,req:x=>bpReload(x),stop:()=>stop()}}

// v1.84.7: playback incidents are ALWAYS reported (stored first, sent at once, re-sent on next launch). Sent as ty 'kill' with a [tag] so the admin error page shows them.
const INC847={k:'bp-inc847'};
function incLoad847(){try{return JSON.parse(localStorage.getItem(INC847.k)||'[]')}catch(_){return []}}
function incSt847(){try{return {cur:cur&&cur.id||'',pos:Math.round(pos()),dur:cur&&cur.buf?Math.round(cur.buf.duration):0,live:!!document.body.classList.contains('live'),view,vis:document.visibilityState,ctx:ctx?ctx.state:'none',dv:/Android/.test(navigator.userAgent)?'and':/iPhone|iPad/.test(navigator.userAgent)?'ios':'pc'}}catch(_){return {}}}
function inc847(kind,why,send=true){try{const st=incSt847();const m='['+kind+'] '+(why||'')+' v'+APPV+' '+st.dv+(st.live?' LIVE':' '+st.view)+' cur='+st.cur+' '+st.pos+'/'+st.dur+'s ctx='+st.ctx+' vis='+st.vis;blog('warn','incident '+m);
  const L=incLoad847();L.push({m:m.slice(0,290),t:Date.now()});localStorage.setItem(INC847.k,JSON.stringify(L.slice(-20)));if(send)incFlush847()}catch(_){}}
function incFlush847(){try{const L=incLoad847();if(!L.length)return;localStorage.setItem(INC847.k,'[]');for(const x of L)lg66('kill',x.m+(Date.now()-x.t>60000?' @'+new Date(x.t).toISOString().slice(0,16)+'Z':''));clearTimeout(LG66.t);lgFlush66()}catch(_){}}
window.__inc847={add:inc847,list:incLoad847,flush:incFlush847};
// next launch: last session ended while playing → report it with the last known state (false-kill marking is only a tag)
setTimeout(()=>{try{const a=window.__alv847,rl=window.__rlk847;if(a&&a.p&&Date.now()-a.t<6*36e5){let tag=rl&&Date.now()-rl.t<60000?'app-reload:'+rl.r:a.h?'background/screen-off':'unexpected-end';try{if(!rl&&!a.h&&k838(a,rl))tag+=' (false-kill? update/idle)'}catch(_){}
  const L=incLoad847();L.push({m:('[stopped-while-playing] '+tag+' prev v'+(a.v||'?')+'→'+APPV+' cur='+(a.cur||'')+' age='+Math.round((Date.now()-a.t)/1000)+'s').slice(0,290),t:Date.now()});localStorage.setItem(INC847.k,JSON.stringify(L.slice(-20)))}incFlush847()}catch(_){}},3000);
// live hooks while playing
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&playing)inc847('hidden-while-playing','',true)});
addEventListener('pagehide',()=>{if(playing)inc847('pagehide-while-playing','',false)});
setInterval(()=>{try{if(ctx&&!ctx.__i847){ctx.__i847=1;ctx.addEventListener('statechange',()=>{if(playing&&ctx.state!=='running')inc847('audioctx-'+ctx.state,'while playing')})}}catch(_){}},1000);
{const _r=bpReload;bpReload=function(r){if((playing||loadingId)&&(/update button|language|cloud restore/.test(r||'')||window.__updForce))inc847('reload-while-playing',String(r||''),false);return _r.apply(this,arguments)}}
{const _f=finish;finish=function(){try{const d=cur&&cur.buf?cur.buf.duration:0,p0=pos();const lp=pref(cur.id);if(d&&p0<d-3&&!(typeof effEnd=='function'&&p0>=effEnd()-3)&&lp.lp==null)inc847('early-end','at '+Math.round(p0)+' of '+Math.round(d))}catch(_){}return _f.apply(this,arguments)}}

// ---- v1.0.2: migration banner (only on retired beer-player site) ----
(function mig102(){try{if(!/^beer-player/.test(location.hostname))return;// v1.0.42: banner now points at GitHub Pagesif(sessionStorage.getItem('bp-mig-x')==='1')return;
 const en=(typeof LANG!=='undefined'&&LANG=='en');const L=en?{t:'This app has moved to paithoonbeer.github.io',h:'Back up to Cloud first, then sign in on the new site and restore.',go:'Open paithoonbeer.github.io',bk:'☁️ Back up now',x:'Close'}:{t:'แอปย้ายไปที่ paithoonbeer.github.io แล้ว',h:'แนะนำให้สำรองข้อมูลขึ้น Cloud ก่อน แล้วล็อกอินที่เว็บใหม่เพื่อกู้ข้อมูลคืน',go:'ไปที่ paithoonbeer.github.io',bk:'☁️ สำรองข้อมูลตอนนี้',x:'ปิด'};
 const st=document.createElement('style');st.textContent='#mig102{position:sticky;top:0;z-index:9999;background:#1d2433;color:#fff;border-bottom:2px solid #f5b301;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));font-size:15px;box-shadow:0 2px 10px rgba(0,0,0,.5)}#mig102 b{display:block;font-size:16px;margin-bottom:4px}#mig102 .mh{opacity:.8;font-size:13px;margin-bottom:8px}#mig102 .mr{display:flex;gap:8px;flex-wrap:wrap}#mig102 a,#mig102 button{border:0;border-radius:10px;padding:9px 12px;font:inherit;cursor:pointer;text-decoration:none}#mig102 .mg{background:#f5b301;color:#111;font-weight:700}#mig102 .mb{background:#2e3a52;color:#fff}#mig102 .mx{position:absolute;right:8px;top:6px;background:transparent;color:#fff;font-size:20px;padding:4px 8px}';document.head.appendChild(st);
 const d=document.createElement('div');d.id='mig102';d.setAttribute('data-noi18n','');d.setAttribute('role','alert');
 d.innerHTML=`<button class="mx" aria-label="${L.x}">✕</button><b>📢 ${L.t}</b><div class="mh">${L.h}</div><div class="mr"><a class="mg" href="https://paithoonbeer.github.io/" target="_blank" rel="noopener">${L.go}</a><button class="mb" data-mbk>${L.bk}</button></div>`;
 d.querySelector('.mx').onclick=()=>{sessionStorage.setItem('bp-mig-x','1');d.remove()};
 d.querySelector('[data-mbk]').onclick=()=>{try{if(typeof CLD!=='undefined'&&CLD.user&&typeof accBackup==='function')accBackup(false);else toast(en?'Please sign in under Settings → Cloud backup first':'กรุณาเข้าสู่ระบบในหน้าตั้งค่า (สำรองข้อมูล Cloud) ก่อน',5000)}catch(e){blog('warn','mig backup',e.message)}};
 const put=()=>document.body.insertBefore(d,document.body.firstChild);document.body?put():addEventListener('DOMContentLoaded',put)}catch(e){try{blog('warn','mig102',e.message)}catch(x){}}})();

// v1.0.7: first-run demo songs = 2 songs of the band (โง่ / ขี้หึง) as HALF-LENGTH previews with a 2 s fade-out, pre-rendered static files in samples/
// (the full songs are never shipped here). Replaces the 1.0.3 CC BY samples: devices that still have them get them removed once (flag bp-smp2).
(()=>{const K='bp-smp2',D=[['samples/demo-ngo.mp3','โง่ (ตัวอย่างครึ่งเพลง) - EBOLA ft. RIM Silly Fools.mp3'],['samples/demo-khihueng.mp3','ขี้หึง (ตัวอย่างครึ่งเพลง) - Silly Fools.mp3']];
 async function seed(){if(localStorage.getItem(K)||window.__noSamples)return;let had=localStorage.getItem('bp-smp1')==='1',rm=0;
  try{for(const n of [...FILES.keys()])if(/\(CC BY 3\.0\)\.stems$/.test(n)){try{const r=await get('files',n);if(r&&r.stems)for(const x of r.stems)await del('files',x.f).catch(()=>{})}catch(e){}await del('files',n).catch(()=>{});FILES.delete(n);cache.delete('X:'+n);rm++;had=true}}catch(e){}
  const own=[...FILES.keys()].filter(n=>!n.startsWith('web:')).length;
  if(!had&&own>0){localStorage.setItem(K,'skip');if(rm){rebuildIndex();render()}return}
  if(!navigator.onLine){if(rm){rebuildIndex();render()}return}
  try{for(const [u,fn] of D){if(FILES.has(fn))continue;const r=await fetch(u);if(r.status==404){localStorage.setItem(K,'none');return}if(!r.ok)throw new Error(u+' '+r.status);const b=await r.blob();await safePut({name:fn,blob:b,size:b.size,added:Date.now(),src:'import'});FILES.set(fn,{name:fn,size:b.size,src:'import'})}
   localStorage.setItem(K,'1');rebuildIndex();render();toast('🎵 เพิ่มเพลงตัวอย่าง 2 เพลง (ครึ่งเพลง) ให้ลองเล่นแล้ว',3500,true)}catch(e){try{blog('warn','demos',e.message||String(e))}catch(_){}if(rm){rebuildIndex();render()}}}
 const t=setInterval(()=>{if(window.__catok){clearInterval(t);setTimeout(seed,800)}},300)})();

// v1.0.4: stems UX fixes — (1) picking only 1 file (a full mix) used to fail silently (error went to a hidden settings note) → clear toast;
// (2) "เพิ่มแทร็กแยก" under a song now names the new stems song after that song instead of "Stems <date>";
// (3) on phones the Stems mixer lives inside the expanded player (#plx) → after import auto-expand + scroll to it, and hint once when a stems song is loaded collapsed.
{const _is=ST.importStems;ST.importStems=async function(files,title){const fs=[...(files||[])];const n=fs.filter(f=>/\.zip$/i.test(f.name)||/\.(mp3|wav|m4a|aac|flac|aif|aiff|ogg|caf)$/i.test(f.name)).length;
  if(!fs.some(f=>/\.zip$/i.test(f.name))&&n<2){toast(n==1?'❌ เลือกมาแค่ 1 ไฟล์ — ไฟล์เพลงที่มิกซ์รวมแล้วแยกเสียงเองไม่ได้ ต้องเลือกไฟล์แทร็กแยก (กลอง/เบส/ร้อง…) อย่างน้อย 2 ไฟล์พร้อมกัน หรือ .zip':'❌ ไม่พบไฟล์เสียง — เลือก mp3/wav/m4a อย่างน้อย 2 ไฟล์ หรือ .zip',6000);return null}
  return _is.call(this,fs,title)}}
function st104show(){const pl=$('pl'),ex=$('exp');if(pl&&!pl.classList.contains('open')&&ex&&$('plx')&&$('plx').offsetParent===null)ex.click();let k=0;const t=setInterval(()=>{const e=$('stm63');if(e&&e.offsetHeight>0){clearInterval(t);e.scrollIntoView({behavior:'smooth',block:'center'})}else if(++k>40)clearInterval(t)},150)}
setInterval(()=>{const i=$('sh63i');if(!i||i.dataset.v104)return;i.dataset.v104=1;i.onchange=async e=>{const f=[...e.target.files];e.target.value='';if(!f.length)return;
  let t;try{const s=cur&&SONG.get(cur.id);if(s&&!(cur.buf&&cur.buf.__st))t=(s.t||'').trim()||undefined;if(t&&FILES.has(t+'.stems'))t+=' (stems)'}catch(x){}
  toast('⏳ กำลังนำเข้า stems…',2000,true);try{const id=await ST.importStems(f,t);if(id&&SONG.get(id)){await load(id);st104show()}}catch(x){toast('❌ นำเข้า stems ไม่ได้: '+(x.message||x),4000)}}},500);
{let last=null;setInterval(()=>{try{const id=cur&&cur.id;if(!id||id===last)return;if(!(cur.buf&&cur.buf.__st))return;last=id;const e=$('stm63');if(e&&e.offsetHeight==0)toast('🎚️ เพลงนี้มีแทร็กแยก — แตะปุ่ม ⌃ ที่แถบเพลงด้านล่าง เพื่อเปิดมิกเซอร์ Stems',4500,true)}catch(x){}},700)}

// v1.0.5: clear Stems import dialog (multi-file or one .zip, drag & drop, preview list with editable/removable track names, song name) — replaces the bare file pickers
const SI105={AUD:/\.(mp3|wav|m4a|aac|flac|aif|aiff|ogg|caf)$/i};
function si105open(title0){const old=document.querySelector('.si105');if(old)old.remove();let items=[];const w=document.createElement('div');w.className='si105';
 w.innerHTML=`<div class="bx" role="dialog" aria-label="นำเข้าแทร็กแยก (stems)"><h3>🎚️ นำเข้าแทร็กแยก (stems)</h3>
 <div class="sm">เลือก<b>ไฟล์แทร็กแยกหลายไฟล์พร้อมกัน (2 ไฟล์ขึ้นไป)</b> ของเพลงเดียวกัน <b>หรือ .zip ไฟล์เดียว</b> ที่มีแทร็กแยกอยู่ข้างใน — ไม่จำเป็นต้องเป็น zip</div>
 <div class="ex"><code>vocals.mp3</code><code>drums.mp3</code><code>bass.mp3</code><code>other.mp3</code><code>หรือ song-stems.zip</code></div>
 <div class="warn">⚠️ ไฟล์เพลงที่มิกซ์รวมแล้ว 1 ไฟล์ แยกเสียงที่นี่ไม่ได้ — ต้องเป็นไฟล์ที่แยกเครื่องมาแล้ว</div>
 <div class="dz" tabindex="0"><b>➕ แตะเพื่อเลือกไฟล์</b><span class="sm">กด Ctrl/⌘ หรือลากคลุมเพื่อเลือกหลายไฟล์ · บนคอมลากไฟล์มาวางที่นี่ได้</span></div>
 <input type="file" class="fi" multiple accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.zip" hidden>
 <ul></ul><div class="er"></div>
 <label class="t">ชื่อเพลง</label><input class="nm" type="text">
 <div class="ac"><button type="button" class="cx">ยกเลิก</button><button type="button" class="go" disabled>นำเข้า</button></div></div>`;
 const $q=s=>w.querySelector(s),ul=$q('ul'),er=$q('.er'),go=$q('.go'),nm=$q('.nm'),dz=$q('.dz'),fi=$q('.fi');nm.value=title0||'';
 const draw=()=>{ul.innerHTML='';items.forEach((it,i)=>{const li=document.createElement('li');li.innerHTML=`<input aria-label="ชื่อแทร็ก" value=""><span title=""></span><button type="button" aria-label="ลบ">✕</button>`;
   const inp=li.querySelector('input');inp.value=it.n;inp.oninput=()=>it.n=inp.value;li.querySelector('span').textContent=it.file.name;li.querySelector('span').title=it.file.name;li.querySelector('button').onclick=()=>{items.splice(i,1);draw()};ul.appendChild(li)});
  go.disabled=items.length<2;go.textContent=items.length?`นำเข้า ${items.length} แทร็ก`:'นำเข้า';er.textContent=items.length==1?'เลือกแล้ว 1 ไฟล์ — ต้องมีอย่างน้อย 2 แทร็ก (เพิ่มไฟล์ได้อีก)':''};
 const add=async fs=>{er.textContent='';for(const f of fs){try{if(/\.zip$/i.test(f.name)){er.textContent='⏳ แตก zip…';for(const z of await ST.unzip(f))if(SI105.AUD.test(z.name)){const b=z.name.replace(/^.*\//,'');items.push({file:new File([z.blob],b,{type:z.blob.type||'audio/mpeg'}),n:ST.guess(b).n})}if(!nm.value)nm.value=f.name.replace(/\.zip$/i,'')}
   else if(SI105.AUD.test(f.name))items.push({file:f,n:ST.guess(f.name).n});else er.textContent='ข้ามไฟล์ที่ไม่ใช่เสียง: '+f.name}catch(x){er.textContent='❌ '+(x.message||x)}}
  if(!nm.value&&items.length>1){const b=items.map(i=>i.file.name.replace(/\.[^.]+$/,''));let p=b[0];for(const x of b)while(p&&!x.startsWith(p))p=p.slice(0,-1);nm.value=p.replace(/[\s_\-–.([]+$/,'')}draw()};
 dz.onclick=()=>fi.click();dz.onkeydown=e=>{if(e.key=='Enter'||e.key==' ')fi.click()};fi.onchange=e=>{const f=[...e.target.files];e.target.value='';add(f)};
 dz.ondragover=e=>{e.preventDefault();dz.classList.add('ov')};dz.ondragleave=()=>dz.classList.remove('ov');dz.ondrop=e=>{e.preventDefault();dz.classList.remove('ov');add([...e.dataTransfer.files])};
 const close=()=>w.remove();$q('.cx').onclick=close;w.onclick=e=>{if(e.target===w)close()};
 go.onclick=async()=>{if(items.length<2)return;go.disabled=true;go.textContent='⏳ กำลังนำเข้า…';let t=nm.value.trim()||undefined;if(t&&FILES.has(t+'.stems'))t+=' ('+new Date().toLocaleTimeString('th',{hour:'2-digit',minute:'2-digit'})+')';
  try{const id=await ST.importStems(items.map(i=>i.file),t);if(!id){draw();return}
   const man=id.slice(2),rec=await get('files',man);if(rec&&rec.stems){const by=new Map(items.map(i=>[i.file.name,i.n.trim()]));rec.stems.forEach(s=>{const n=by.get(s.file);if(n)s.n=n});rec.blob=new Blob([JSON.stringify(rec.stems)],{type:'application/json'});await put('files',rec);cache.delete(id)}
   close();if(SONG.get(id)){await load(id);try{st104show()}catch(x){}}}catch(x){er.textContent='❌ นำเข้าไม่ได้: '+(x.message||x);draw()}};
 document.body.appendChild(w);window.__si105=w;return w}
window.si105open=si105open;
// route every stems entry point to the dialog
setInterval(()=>{const b=$('sh63b');if(b&&!b.dataset.v105){b.dataset.v105=1;b.onclick=()=>{let t='';try{const s=cur&&SONG.get(cur.id);if(s&&!(cur.buf&&cur.buf.__st))t=(s.t||'').trim()}catch(x){}si105open(t)}}
 const i=$('imps'),l=i&&i.closest('label');if(l&&!l.dataset.v105){l.dataset.v105=1;l.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();si105open('')},true)}},500);

// v1.0.5: smooth fader drag (mouse + touch), wheel, double-click → 0 dB. The mixer DOM is rebuilt on every change, so the drag tracks the channel index (data-i) and re-queries the input each move.
{const Q=i=>document.querySelector(`#stm63 [data-i="${i}"] .st63f input[type=range]`);let D=null;
 const setV=(i,v)=>{const r=Q(i);if(!r)return;v=Math.max(+r.min,Math.min(+r.max,Math.round(v)));if(+r.value===v)return;r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}))};
 const fromY=(i,y)=>{const r=Q(i);if(!r)return;const b=r.getBoundingClientRect();const f=1-(y-b.top)/b.height;setV(i,+r.min+Math.max(0,Math.min(1,f))*(r.max-r.min))};
 document.addEventListener('pointerdown',e=>{const r=e.target.closest&&e.target.closest('#stm63 .st63f input[type=range]');if(!r||e.button>0)return;e.preventDefault();const i=r.closest('[data-i]').dataset.i;D={i,id:e.pointerId};try{document.documentElement.setPointerCapture(e.pointerId)}catch(x){}fromY(i,e.clientY)},true);
 document.addEventListener('pointermove',e=>{if(D&&e.pointerId===D.id){e.preventDefault();fromY(D.i,e.clientY)}},true);
 const up=e=>{if(D&&e.pointerId===D.id){try{document.documentElement.releasePointerCapture(e.pointerId)}catch(x){}D=null}};document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
 document.addEventListener('wheel',e=>{const r=e.target.closest&&e.target.closest('#stm63 .st63f');if(!r)return;e.preventDefault();const i=r.closest('[data-i]').dataset.i,x=Q(i);if(x)setV(i,+x.value+(e.deltaY<0?1:-1))},{passive:false,capture:true});
 document.addEventListener('dblclick',e=>{const t=document.elementFromPoint(e.clientX,e.clientY),r=t&&t.closest&&t.closest('#stm63 .st63f');if(r)setV(r.closest('[data-i]').dataset.i,0)},true);
 const s=document.createElement('style');s.textContent='#stm63 .st63f input[type=range]{touch-action:none;cursor:ns-resize}';document.head.appendChild(s)}

// v1.0.6: one-time catalog re-check. Until 1.0.5 ANY band (even one a customer created) turned the ~700-song catalog on. On a device with bp-cat='1',
// once auth is known: signed-in user keeps it only if account is pre-cutoff, owner email, or member of a band owned by OWN106; signed-out keeps it only if old100().
// Revoke → bp-cat='0' + bp-cat106='rev' (cat101on may still re-enable for a qualifying user later). Local songs/stems are untouched.
(()=>{if(localStorage.getItem('bp-cat')!=='1'||localStorage.getItem('bp-cat106'))return;let n=0;
 const t=setInterval(async()=>{if(++n>240){clearInterval(t);return}const so=CLD.st!=='ready'&&!accOn()&&n>=24&&!CLD.mod;if(CLD.st!=='ready'&&!so)return;clearInterval(t);
  const done=(keep,why)=>{blog('info','cat106 '+(keep?'keep':'revoke')+': '+why);if(keep){localStorage.setItem('bp-cat106','keep');return}localStorage.setItem('bp-cat','0');localStorage.setItem('bp-cat106','rev');if(localStorage.getItem('bp-smp1')==='skip')localStorage.removeItem('bp-smp1');catRl('cat106')};
  try{const u=so?null:CLD.user;
   if(!u){if(await old100())done(1,'signed-out old device');else done(0,'signed-out, no old data');return}
   const ct=CLD.ct;
   if(ct&&ct<CAT101)return done(1,'pre-cutoff account');if(/^paithooningrad@gmail\.com$/i.test(u.email||''))return done(1,'owner email');
   const bands=await new Promise((ok,no)=>{let un=null,fin=false;const to=setTimeout(()=>{if(!fin){fin=true;try{un&&un()}catch(e){}no(new Error('timeout'))}},15000);
    un=CLD.mod.bandsSub(l=>{if(fin)return;fin=true;clearTimeout(to);setTimeout(()=>{try{un&&un()}catch(e){}});ok(l)},e=>{if(!fin){fin=true;clearTimeout(to);no(e)}})});
   if(bands.some(b=>b&&b.owner===OWN106&&!tx107(b)))return done(1,'owner band member');done(0,'signed-in, no rule ('+bands.length+' own bands)')}catch(e){blog('warn','cat106 undecided',e&&e.message)}},250)})();
// v1.0.6: owner-band membership turns the catalog on as soon as the band list arrives (not only when the band panel is drawn)
setInterval(()=>{try{if(localStorage.getItem('bp-cat')==='1')return;if((BD.bands||[]).some(b=>b&&b.owner===OWN106&&!tx107(b)))cat101on('owner band member')}catch(e){}},2000);

// ===== v1.0.7: band sharing for stems songs + visible state for band songs without audio + per-song “ส่งเข้าวง” button =====
// (B) a stems song is uploaded to the band as its stereo mixdown (same encoder/chunks as normal songs) so members can play it. Stem control stays on the adder's device.
{const _bp=bcPrep;bcPrep=async function(s,prog){try{const rec=await get('files',(!s.X&&fileOf(s))||s.fn);
  if(rec&&rec.src=='stems'){const fp=(()=>{try{const b=rec.blob||{},pr=pref(s.id)||{};return JSON.stringify([b.size||0,b.lastModified||rec.mt||rec.t||0,(rec.stems||[]).length,rec.stems||null,pr.st||null,pr.master==null?null:pr.master])}catch(e){return String(Math.random())}})();if(BC.last&&BC.last.fn==s.fn&&BC.last.fp===fp)return BC.last;BC.last=null;bcPill('☁︎ ผสม stems เป็นไฟล์เดียวเพื่อส่งให้วง · '+s.t);try{if(typeof ctx=='undefined'||!ctx)initAudio()}catch(e){}const mix=await ST.decode(rec);const st=mix.numberOfChannels>1;
   const ch=st?[mix.getChannelData(0).slice(),mix.getChannelData(1).slice()]:[mix.getChannelData(0).slice()];const r={u8:await bcEnc(ch,mix.sampleRate,st?128:96,prog),m:'audio/mpeg',fn:s.fn,fp};BC.last=r;return r}}catch(e){blog('warn','bc stems mix',e&&e.message);toast107(s,'ผสม stems ไม่สำเร็จ: '+(e&&e.message||e));return null}
  const r=await _bp.apply(this,arguments);if(!r)toast107(s,'ไม่พบไฟล์เสียงในเครื่องนี้');return r}}
function toast107(s,why){const k='bcw:'+(s&&s.fn);if(toast107[k])return;toast107[k]=1;toast('⚠️ ส่งไฟล์ “'+((s&&s.t)||'')+'” ขึ้นวงไม่ได้ — '+why+' · สมาชิกจะเห็นชื่อเพลงแต่ยังเล่นไม่ได้',6000)}
// (A) band songs whose audio isn't uploaded yet: listed (greyed) on members' devices instead of hidden
const NF107='⏳ ไฟล์ยังอยู่ในเครื่องของคนที่เพิ่ม — ยังเล่นไม่ได้';
{const _bv=bcVirt;bcVirt=function(){let ch=0;try{for(const b of BD.bands||[])for(const x of BS.l[b.id]||[]){if(!x.fn||!x.ti)continue;const id='X:'+x.fn,e=SONG.get(id);if(e&&e._nf&&x.fc){delete e._nf;e.f='เพลงของวง';ch=1}}}catch(e){}
  const n=_bv.apply(this,arguments);
  try{for(const b of BD.bands||[])for(const x of BS.l[b.id]||[]){if(x.fc||!x.fn||!x.ti)continue;const id='X:'+x.fn;if(SONG.has(id)||FILES.has(x.fn)||cat845(x.fn).length||slMatch(x.ti,x.ar,x.sd))continue;
    SONG.set(id,{X:1,s:x.sd||'X',fn:x.fn,t:x.ti,a:x.ar||'',f:NF107,g:'',k:'',_pp:1,_nf:1,bc:{b:b.id,id:x.id,fc:0,fm:x.fm,v:0}});ch=1}}catch(e){}
  if(ch)setTimeout(()=>{try{render()}catch(e){}},0);return n}}
const nf107=id=>{const s=SONG.get(id);return !!(s&&s._nf)};
const nfMsg107=()=>toast('⏳ เพลงนี้ยังไม่มีไฟล์ในวง — ไฟล์อยู่ในเครื่องของคนที่เพิ่มเพลง ให้เขาเปิดแอปเครื่องนั้น (ต่อเน็ต) แอปจะส่งไฟล์ให้วงเอง · หรือนำเข้าไฟล์ชื่อเดียวกันในเครื่องนี้',6500);
{const _ld=load;load=async function(id){if(nf107(id)){nfMsg107();return}return _ld.apply(this,arguments)}}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-play],[data-dl]');if(!b)return;const id=b.dataset.play||b.dataset.dl;if(nf107(id)){e.preventDefault();e.stopPropagation();nfMsg107()}},true);
// per-song share button on library rows (local songs, band editor, not yet in a band) + "in band" badge
function row107(){try{const ok=can845();for(const p of document.querySelectorAll('[data-play]')){const id=p.dataset.play,s=SONG.get(id),row=p.parentElement;if(!s||!row)continue;
  if(s._nf){if(!row.classList.contains('nf107'))row.classList.add('nf107');continue}
  const m=row.querySelector('.m');if(!m)continue;const inb=bsFind842(id).length;const ex=m.querySelector('.bs107');if(ex){if(ex.classList.contains('in')===!!inb||ex.disabled)continue;ex.remove()}if(!ok||!s.X||!fileOf(s)||!FILES.has(fileOf(s)))continue;
  const el=document.createElement(inb?'span':'button');el.className='bs107'+(inb?' in':'');if(inb)el.textContent='☁︎ ในวง';else{el.type='button';el.textContent='☁︎ ส่งเข้าวง';el.title='ให้ทุกคนในวงเห็นเพลงนี้';el.onclick=async ev=>{ev.stopPropagation();el.disabled=true;el.textContent='⏳ กำลังส่ง…';try{await go845(id)}finally{setTimeout(()=>{try{render()}catch(e){}},300)}}}
  m.appendChild(el)}}catch(e){}}
{const st=document.createElement('style');st.textContent='.nf107{opacity:.5}.bs107{margin-left:6px;font-size:12px;border-radius:8px;padding:2px 8px;border:1px solid #2e9e5b;color:#2e9e5b;background:transparent}.bs107.in{border-color:transparent;opacity:.8}';document.head.appendChild(st)}
{const o=new MutationObserver(()=>{clearTimeout(row107.t);row107.t=setTimeout(row107,150)});const at=()=>{const m=$('main');if(m)o.observe(m,{childList:true,subtree:true});else setTimeout(at,500)};at()}setTimeout(row107,1500);
// stems import: drop a "...-mix" full mix file when real stems are picked alongside it
{const _is=ST.importStems;ST.importStems=function(files,title){let fs=[...(files||[])];const mx=f=>/[-_ .](mix|mixdown|full ?mix)\.[a-z0-9]+$/i.test(f.name);const au=fs.filter(f=>!/\.zip$/i.test(f.name));
 if(au.length-au.filter(mx).length>=1&&au.some(mx)){fs=fs.filter(f=>!mx(f));if(!title)title=(au.find(mx).name.replace(/[-_ .](mix|mixdown|full ?mix)\.[a-z0-9]+$/i,''))}return _is.call(this,fs,title)}}

// ===== v1.0.7: trial (listen-only, time-limited) band members =====
// bands/{b}.vx[uid] = expiry timestamp (set by the band owner/admin). Firestore rules stop reads after expiry; here: no in-app download (โหลดเก็บ),
// banner with the end date, and on expiry the band's cached audio + catalog access are removed from this device.
function vx107(b){try{const u=CLD.user&&CLD.user.uid,v=b&&b.vx&&u&&b.vx[u];if(!v)return 0;return typeof v.toMillis=='function'?v.toMillis():v.seconds?v.seconds*1000:+new Date(v)}catch(e){return 0}}
function tx107(b){const v=vx107(b);return !!v&&Date.now()>=v}
function trial107(){const bs=BD.bands||[];if(!bs.length)return false;if(bs.some(b=>['owner','editor'].includes(bdRole(b))&&!vx107(b)))return false;return bs.some(b=>vx107(b))}
document.addEventListener('click',e=>{if(!document.body.classList.contains('trial107'))return;const b=e.target.closest&&e.target.closest('[data-dl]');if(!b)return;e.preventDefault();e.stopPropagation();toast('🔒 บัญชีทดลองฟังได้อย่างเดียว — โหลดเก็บ/ส่งออกเพลงไม่ได้',3500)},true);
{const st=document.createElement('style');st.textContent='body.trial107 [data-dl]{display:none!important}#tr107{position:sticky;top:0;z-index:50;background:#2a2316;color:#ffd58a;font-size:13px;padding:6px 10px;text-align:center;border-bottom:1px solid #4a3a1e}';document.head.appendChild(st)}
setInterval(async()=>{try{if(typeof BD==='undefined'||!CLD.user)return;const on=trial107();document.body.classList.toggle('trial107',on);
  let bn=document.getElementById('tr107');const act=(BD.bands||[]).filter(b=>vx107(b)&&!tx107(b));
  if(on&&act.length){const b=act[0],d=new Date(vx107(b));const txt=`🎧 ทดลองฟังเพลงของ${/^วง/.test(b.name)?'':'วง '}${b.name} ถึง ${d.toLocaleDateString('th',{day:'numeric',month:'short'})} ${d.toLocaleTimeString('th',{hour:'2-digit',minute:'2-digit'})} · ฟังได้อย่างเดียว`;if(!bn){bn=document.createElement('div');bn.id='tr107';document.body.prepend(bn)}if(bn.textContent!==txt)bn.textContent=txt}else if(bn)bn.remove();
  for(const b of (BD.bands||[]).filter(tx107)){const k='bp-tx107-'+b.id+'-'+vx107(b);if(localStorage.getItem(k))continue;let n=0;
   for(const [id,sg] of SONG){if(!sg||!sg.bc||sg.bc.b!==b.id)continue;const f=FILES.get(sg.fn);if(f&&f.src=='band'){await del('files',sg.fn).catch(()=>{});FILES.delete(sg.fn);cache.delete(id);n++}}
   localStorage.setItem(k,'1');blog('info','trial expired '+b.id+' purged '+n);toast('⌛ หมดเวลาทดลองฟังเพลงของวง '+b.name+' แล้ว — ติดต่อหัวหน้าวงเพื่อขยายเวลา',6000);
   if(localStorage.getItem('bp-cat')==='1'&&!(BD.bands||[]).some(x=>x.owner===OWN106&&!tx107(x))&&!(CLD.ct&&CLD.ct<CAT101)){localStorage.setItem('bp-cat','0');localStorage.setItem('bp-cat106','rev');setTimeout(()=>catRl('trial107'),2500)}else{rebuildIndex();render()}}}catch(e){}},3000);
// ===== v1.0.18 one-page chrome (visual shell only; LVUSER / lvApply / lvPush unchanged) =====
(function op18(){
  const $id=id=>document.getElementById(id);
  const svg={
    search:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    more:'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>',
    pad:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="9" width="3.2" height="11" rx="0.6"/><rect x="8.4" y="5" width="3.2" height="15" rx="0.6"/><rect x="13.8" y="8" width="3.2" height="12" rx="0.6"/><rect x="19.2" y="3" width="2.4" height="17" rx="0.6"/></svg>',
    metro:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l4 18H5z"/><path d="M12 16l5-10"/><path d="M7.5 15h9"/></svg>',
    sfx:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9v6h3l5 4V5L6 9H3z"/><path d="M16 9.2a3.2 3.2 0 0 1 0 5.6"/><path d="M18.5 7a6 6 0 0 1 0 10"/></svg>',
    play:'<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M7 4.5v15l13-7.5L7 4.5z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1"/><rect x="13.8" y="5" width="4.2" height="14" rx="1"/></svg>',
    prev:'<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="5.4" y="5.2" width="2.4" height="13.6" rx="0.8"/><path d="M19 5.5v13L9 12l10-6.5z"/></svg>',
    next:'<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M5 5.5v13l10-6.5L5 5.5z"/><rect x="16.2" y="5.2" width="2.4" height="13.6" rx="0.8"/></svg>',
    grip:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="9" cy="7" r="1.4"/><circle cx="15" cy="7" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="17" r="1.4"/><circle cx="15" cy="17" r="1.4"/></svg>',
    list:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>',
    share:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M11 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>',
    fb:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg>',

    bell:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 17h5l-1.4-2.1A2 2 0 0 1 18 13.6V11a6 6 0 1 0-12 0v2.6a2 2 0 0 1-.6 1.3L4 17h5"/><path d="M10 17a2 2 0 0 0 4 0"/></svg>',
    chat:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 16.5V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9z"/><path d="M8 19h.01"/></svg>',
    imp:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="M7.5 9.5L12 14l4.5-4.5"/><path d="M3 14v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/></svg>',
    gear:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2.5M12 20.5V23M4.2 4.2l1.8 1.8M18 18l1.8 1.8M1 12h2.5M20.5 12H23M4.2 19.8l1.8-1.8M18 6l1.8-1.8"/></svg>',
    user:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 19c1.2-3 4-4.5 7-4.5s5.8 1.5 7 4.5"/></svg>'
  };
  function el(html){const d=document.createElement('div');d.innerHTML=html.trim();return d.firstElementChild}
  function closeMenu(){document.body.classList.remove('menu-open')}
  function closeSheet(){document.body.classList.remove('sheet-open');try{const b=$id('op-uhlib');if(b)b.hidden=true}catch(e){}}
  function liveHomeView(){
    try{
      if(!(document.body.classList.contains('live')||(window.__dual&&__dual.on)))return;
      if(view==='F'){
        view='P';
        document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('on',t.dataset.v==='P')});
      }
    }catch(e){}
  }
  function closeOv(){
    // nested feedback ← returns to Settings when opened from there
    try{
      const onFb=!!($id('op-fb')&&($id('op-ovt')||{}).textContent==='ส่งความเห็น');
      if(window.__fbFromSettings&&onFb){
        window.__fbFromSettings=0;
        openSettings();
        return;
      }
    }catch(e){}
    window.__fbFromSettings=0;
    document.body.classList.remove('op-ov');
    window.__setFromMenu=0;
    const box=$id('op-ovb'), left=$id('left'), main=$id('main');
    if(main){try{main.classList.remove('st77on')}catch(e){}}
    if(main && left && main.parentNode!==left) left.appendChild(main);
    if(box) box.innerHTML='';
    // Live: do not leave view stuck on F (stops tidy66/import churn under Dual)
    liveHomeView();
  }

  function mountChrome(){
    if($id('op-top'))return;
    document.body.insertAdjacentHTML('beforeend',
      '<header id="op-top">'+
        '<div class="op-logo"><div class="op-mark">S</div><div class="op-word">SetSod</div></div>'+
        '<div class="op-band"><b id="op-bandn"></b><span class="op-sync" id="op-sync" title="ซิงก์กับวงแล้ว"><i></i><span id="op-synct">ซิงก์แล้ว</span></span></div>'+
        '<button type="button" id="op-studio" class="hw" aria-pressed="false" aria-label="โหมดสตูดิโอ (มิกเซอร์ / คลื่นเสียง / stems / ตัดหัว-ท้าย)" title="โหมดสตูดิโอ"><svg class="op-stuico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 4v16M12 4v16M18 4v16"/><rect x="3.6" y="12.5" width="4.8" height="3.2" rx="1" fill="currentColor" stroke="none"/><rect x="9.6" y="6.5" width="4.8" height="3.2" rx="1" fill="currentColor" stroke="none"/><rect x="15.6" y="10" width="4.8" height="3.2" rx="1" fill="currentColor" stroke="none"/></svg><span class="op-stul">สตูดิโอ</span></button>'+
        '<button class="av" id="op-av" type="button" aria-label="เมนูบัญชี การแจ้งเตือน และอื่นๆ">?<span class="op-dot" id="op-dot">0</span></button>'+
      '</header>'+
      '<div id="op-dock"><button class="op-search" type="button" id="op-search" aria-label="ค้นคลังเพื่อเพิ่มเข้าลิสต์">'+svg.search+' ค้นคลัง แล้วแตะเพื่อเพิ่มเข้าลิสต์</button></div>'+
      '<div id="op-menuback"></div>'+
      '<div id="op-menu" role="menu" aria-label="เมนูบัญชี">'+
        '<div class="who"><div class="av" id="op-mav">?</div><div><div class="nm" id="op-mnm">บัญชี</div><div class="em" id="op-mem"></div></div></div>'+
        /* v1.0.53: main menu stays lean — chat / feedback / account live under การตั้งค่า */
        /* v1.0.58: unhide soft-deleted catalog songs — was buried under Settings › ระบบ */
        '<button type="button" id="op-mnt">'+svg.bell+' การแจ้งเตือน <span class="nb" id="op-mnb">0</span></button>'+
        '<button type="button" id="op-munhide">👁 กู้คืนเพลงที่ซ่อน <span class="nb" id="op-muhn" hidden>0</span></button>'+
        '<button type="button" id="op-mimp">'+svg.imp+' นำเข้าเพลง</button>'+
        '<button type="button" id="op-mset">'+svg.gear+' การตั้งค่า</button>'+
      '</div>'+
      '<div id="op-sheetback"></div><div id="op-sheethandle"></div><div id="op-sheetttl">เพิ่มเพลงเข้าลิสต์</div>'+
      '<div id="op-overlay"><div class="op-ovh"><button type="button" id="op-ovx" aria-label="ปิด">← กลับ</button><b id="op-ovt"></b></div><div class="op-ovb" id="op-ovb"></div></div>'+
      '<button type="button" id="op-backlive" aria-label="กลับไปหน้าเดียว" title="กลับไปหน้าเดียว"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>'
    );
    $id('op-av').onclick=function(){closeSheet();document.body.classList.toggle('menu-open')};
    $id('op-menuback').onclick=closeMenu;
    $id('op-sheetback').onclick=closeSheet;
    $id('op-search').onclick=function(){closeMenu();openLib()};
    $id('op-mnt').onclick=function(){closeMenu();openNt()};
    $id('op-munhide').onclick=function(){closeMenu();try{libUnhideOpen149()}catch(e){toast('เปิดรายการเพลงที่ซ่อนไม่ได้',2500)}};
    $id('op-mimp').onclick=function(){closeMenu();openImport()};
    $id('op-mset').onclick=function(){closeMenu();openSettings()};
    try{syncUnhideMenu149()}catch(e){}
    $id('op-backlive').onclick=function(){try{setLive(true)}catch(e){}};
    try{const tabs=document.querySelector('header .tabs')||document.querySelector('.tabs');const back=$id('op-backlive');if(tabs&&back&&back.parentNode!==tabs)tabs.insertBefore(back,tabs.firstChild)}catch(e){}
    $id('op-ovx').onclick=closeOv;
    document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeMenu();closeSheet();closeOv()}});
  }

  function openLib(){
    try{view='P';document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('on',t.dataset.v==='P')});render()}catch(e){}
    document.body.classList.add('sheet-open');
    try{
      let bar=$id('op-uhlib');
      if(!bar){
        bar=document.createElement('button');bar.type='button';bar.id='op-uhlib';bar.className='hw';
        bar.style.cssText='position:fixed;left:12px;right:12px;bottom:calc(72px + env(safe-area-inset-bottom));z-index:92;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px';
        bar.innerHTML='👁 กู้คืนเพลงที่ซ่อน <span class="uhn nb on">0</span>';
        bar.onclick=function(e){e.preventDefault();e.stopPropagation();try{libUnhideOpen149()}catch(err){}};
        document.body.appendChild(bar);
      }
      syncUnhideMenu149();
    }catch(e){}
    setTimeout(function(){try{const q=$id('q');if(q)q.focus()}catch(e){}},50);
  }
  function openNt(){
    try{ntOpen()}catch(e){const b=$id('ntb');if(b)b.click()}
  }
  function mountImportOv(title, asSettings){
    closeSheet();
    window.__setFromMenu=!!asSettings;
    window.__fbFromSettings=0; // entering Import/Settings clears nested-feedback back stack
    try{view='F';document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('on',t.dataset.v==='F')});render()}catch(e){}
    $id('op-ovt').textContent=title;
    document.body.classList.add('op-ov');
    try{
      const m=$id('main'), box=$id('op-ovb');
      // drop leftover feedback/metro nodes before parking #main in the overlay
      if(box){[...box.children].forEach(function(n){if(n!==m)n.remove()})}
      if(m&&box&&m.parentNode!==box)box.appendChild(m);
      m&&m.classList.toggle('st77on',!!asSettings);
    }catch(e){}
    // let tidy66 + imp77 regroup, then force settings pane when asked
    setTimeout(function(){
      try{if(window.__imp77)__imp77()}catch(e){}
      try{
        const m=$id('main');if(!m)return;
        if(asSettings)m.classList.add('st77on');
        else m.classList.remove('st77on');
      }catch(e){}
    },80);
  }
  function openImport(){mountImportOv('นำเข้าเพลง',false)}
  function openSettings(){mountImportOv('การตั้งค่า',true)}

  function fbPlat(){
    try{if(window.Capacitor&&Capacitor.getPlatform)return String(Capacitor.getPlatform())}catch(e){}
    const ua=navigator.userAgent||'';
    if(/iPhone|iPad|iPod/.test(ua))return 'ios-web';
    if(/Android/.test(ua))return 'android-web';
    return 'web';
  }
  function openFeedback(){
    closeMenu();closeSheet();
    // settings reuses #op-ovb with #main inside — put #main back before wiping the box
    try{
      const m=$id('main'), left=$id('left'), box0=$id('op-ovb');
      window.__fbFromSettings=!!(window.__setFromMenu||(m&&m.classList.contains('st77on')&&document.body.classList.contains('op-ov')));
      if(m&&left&&box0&&m.parentNode===box0)left.appendChild(m);
      if(m)m.classList.remove('st77on');
    }catch(e){}
    window.__setFromMenu=0;
    $id('op-ovt').textContent='ส่งความเห็น';
    const box=$id('op-ovb');if(!box)return;
    const v=typeof APPV==='string'?APPV:'';
    const pl=fbPlat();
    const dv=String(navigator.userAgent||'').slice(0,200);
    let em='',uid='';
    try{if(typeof CLD!=='undefined'&&CLD.user){em=CLD.user.email||'';uid=CLD.user.uid||''}}catch(e){}
    const signed=!!(typeof CLD!=='undefined'&&CLD.user);
    box.innerHTML='';
    const f=el('<div class="op-fb" id="op-fb"></div>');
    f.innerHTML='<p class="op-fbhint">บอกเราได้เลยว่าใช้แล้วเป็นยังไง — แยกจากแชทกับน้องเซ็ต</p>'+
      '<label class="op-fblab">ข้อความ <textarea id="op-fbtx" maxlength="2000" rows="4" placeholder="สั้นๆ ก็ได้"></textarea></label>'+
      '<div class="op-fbr" role="group" aria-label="คะแนน 1 ถึง 5">'+
        '<span>คะแนน (ไม่บังคับ)</span>'+
        '<span class="op-fbstars">'+[1,2,3,4,5].map(function(n){return '<button type="button" class="op-fbstar" data-r="'+n+'" aria-label="ให้ '+n+' คะแนน">'+n+'</button>'}).join('')+'</span></div>'+
      '<div class="op-fbc" role="group" aria-label="ประเภท">'+
        '<button type="button" class="op-fbcat" data-c="bug">บั๊ก</button>'+
        '<button type="button" class="op-fbcat" data-c="idea">ไอเดีย</button>'+
        '<button type="button" class="op-fbcat" data-c="other">อื่นๆ</button></div>'+
      '<div class="op-fbmeta" id="op-fbmeta"></div>'+
      '<button type="button" class="op-fbsend" id="op-fbsend">ส่งความเห็น</button>';
    box.appendChild(f);
    const meta=$id('op-fbmeta');
    if(meta)meta.textContent='เวอร์ชัน '+v+' · '+pl+(signed?(' · '+(em||uid||'ลงชื่อเข้าแล้ว')):' · ยังไม่ได้เข้าสู่ระบบ');
    let rating=0,cat='';
    f.querySelectorAll('.op-fbstar').forEach(function(b){
      b.onclick=function(){rating=+b.dataset.r;f.querySelectorAll('.op-fbstar').forEach(function(x){x.classList.toggle('on',+x.dataset.r<=rating)})};
    });
    f.querySelectorAll('.op-fbcat').forEach(function(b){
      b.onclick=function(){cat=b.dataset.c;f.querySelectorAll('.op-fbcat').forEach(function(x){x.classList.toggle('on',x.dataset.c===cat)})};
    });
    $id('op-fbsend').onclick=async function(){
      const tx=($id('op-fbtx')&&$id('op-fbtx').value||'').trim();
      if(!tx){toast('พิมพ์ข้อความสั้นๆ ก่อนส่ง');return}
      if(!(typeof CLD!=='undefined'&&CLD.user)){toast('เข้าสู่ระบบก่อนส่งความเห็น');try{closeOv();acpOpen()}catch(e){}return}
      const btn=$id('op-fbsend');if(btn){btn.disabled=true;btn.textContent='กำลังส่ง…'}
      try{
        const m=CLD.mod||await accMod();
        await m.fbAdd({tx,r:rating||undefined,c:cat||undefined,v,dv,pl});
        toast('ส่งความเห็นแล้ว ขอบคุณครับ',2500,true);
        closeOv();
      }catch(e){
        toast('ส่งไม่สำเร็จ — '+(e&&(e.message||e.code)||'ลองใหม่'),3000);
        if(btn){btn.disabled=false;btn.textContent='ส่งความเห็น'}
      }
    };
    document.body.classList.add('op-ov');
    setTimeout(function(){try{$id('op-fbtx').focus()}catch(e){}},50);
  }
  function openMetro(){
    closeMenu();closeSheet();
    // same as feedback: never wipe #op-ovb while #main is still inside it
    try{
      const m=$id('main'), left=$id('left'), box0=$id('op-ovb');
      if(m&&left&&box0&&m.parentNode===box0)left.appendChild(m);
      if(m)m.classList.remove('st77on');
    }catch(e){}
    window.__setFromMenu=0;window.__fbFromSettings=0;
    $id('op-ovt').textContent='เมโทรนอม';
    const box=$id('op-ovb');
    try{if(typeof metroEl==='function'){const n=metroEl();if(n.parentNode!==box){box.innerHTML='';box.appendChild(n)}}}catch(e){}
    document.body.classList.add('op-ov');
  }
  function popActs(title, acts){
    closeMenu();
    document.querySelectorAll('.op-pop').forEach(function(n){n.remove()});
    const d=el('<div class="mbox op-pop" style="position:fixed;left:50%;top:28%;transform:translate(-50%,0);z-index:130;background:#1a1a22;border:1px solid #2a2a36;border-radius:16px;padding:10px;min-width:260px"></div>');
    d.innerHTML='<div class="row" style="justify-content:space-between;align-items:center"><b>'+title+'</b><button type="button" class="hw op-px">✕</button></div>'+acts.map(function(a,i){return '<button type="button" class="hw" data-i="'+i+'" style="width:100%;margin:6px 0;min-height:44px;text-align:left">'+a[0]+'</button>'}).join('');
    document.body.appendChild(d);
    d.onclick=function(e){const x=e.target.closest('[data-i]');if(x){acts[+x.dataset.i][1]();d.remove()}if(e.target.classList.contains('op-px'))d.remove()};
    setTimeout(function(){document.addEventListener('pointerdown',function off(ev){if(!d.contains(ev.target)){d.remove();document.removeEventListener('pointerdown',off,true)}},true)},0);
  }
  function autoGapLabel(){return 'เว้นระหว่างเพลง: '+(AUTO.gap||0)+' วินาที'}
  function autoXfLabel(){return 'ซ้อนเพลง (XF): '+(AUTO.xf>0?(AUTO.xf+' วินาที'):'ปิด')}
  function autoXcLabel(){return 'ครอสเฟด: '+(AUTO.xf>0&&AUTO.xc!==false?'เปิด':'ปิด')}
  function cycleAutoGap(){const g=[0,3,5,10],i=g.indexOf(+AUTO.gap);AUTO.gap=g[(i<0?0:i+1)%g.length];saveAuto();toast('เว้นระหว่างเพลง: '+AUTO.gap+' วินาที',1500,true)}
  function cycleAutoXf(){const g=[0,2,4,6,8],i=g.indexOf(+AUTO.xf||0);AUTO.xf=g[(i<0?0:i+1)%g.length];saveAuto();toast(AUTO.xf?('ซ้อนเพลง '+AUTO.xf+' วินาที'):'ปิดการซ้อนเพลง',1500,true)}
  function toggleAutoXc(){if(!(AUTO.xf>0)){AUTO.xf=2;AUTO.xc=true;saveAuto();toast('เปิดซ้อนเพลง 2 วินาที (ครอสเฟด)',1500,true);return}AUTO.xc=!(AUTO.xc!==false);saveAuto();toast('ครอสเฟด: '+(AUTO.xc?'เปิด':'ปิด'),1500,true)}
  // v1.0.41: every item of the old now-card ⋯ menu duplicated a Live control (restart, fade, auto-next/crossfade, Studio,
  // edit info, share) — the menu and its ⋯ button are gone.
  function openMoreNow(){}
  function openListMore(){
    popActs('ลิสต์',[
      ['⬇️ โหลดทั้งลิสต์',function(){try{enqueue(SET)}catch(e){}}],
      ['✔️ เช็กเพลงคืนนี้',function(){try{view='S';render();const b=$id('chk');if(b)b.click()}catch(e){}}],
      ['👁 เพลงที่ซ่อนจากคลัง…',function(){try{libUnhideOpen149()}catch(e){}}],
      ['ล้างลิสต์',function(){try{if(confirm('ล้างเพลย์ลิสต์คืนนี้?')){SET=[];saveSet();render();stripKey='';stripDraw()}}catch(e){}}]
    ]);
  }
  function openRowMore(id,fromDeck){
    const s=SONG.get(id),inSet=SET.includes(id);
    popActs('เพลงนี้',[
      ...(fromDeck?[]:[['▶ เล่น',function(){try{load(id)}catch(e){}}]]), // v1.0.41: not on a deck's ⋯ (the deck has its own ▶)
      ...(inSet?[['🗑 ลบออกจากลิสต์',function(){try{lvRm839(id,{force:1})}catch(e){}}]]:[]),
      ['✏️ แก้ข้อมูล',function(){try{openMeta([id])}catch(e){}}],
      ['☁︎ ส่งเข้าวง',function(){try{go845(id)}catch(e){}}],
      // v1.0.47+: always show ลบจากคลัง (catalog samples → one-confirm hide for the band)
      ['🗑 ลบจากคลัง',function(){try{libDel145(id)}catch(e){}}]
    ]);
  }

  function bindOpPrev(){
    const b=$id('op-prev');if(!b||b._opPrev)return;b._opPrev=1;
    b.onclick=function(e){e.stopPropagation();try{songStep(-1)}catch(err){}};
  }
  function bindOpAuto(){
    const b=$id('op-auto');if(!b||b._opAuto)return;b._opAuto=1;
    b.onclick=function(e){
      e.stopPropagation();
      AUTO.on=!AUTO.on;
      if(!AUTO.on)try{cancelCd()}catch(err){}
      saveAuto();
      toast(AUTO.on?'เล่นต่อเนื่องอัตโนมัติ: เปิด':'เล่นต่อเนื่องอัตโนมัติ: ปิด',1500,true);
      try{syncOpAuto()}catch(err){}
    };
    try{syncOpAuto()}catch(e){}
  }
  function ensureNow(lv){
    const nw=lv.querySelector('.lvnow');if(!nw)return;
    if(!nw.querySelector('.op-now-h')){
      nw.insertAdjacentHTML('afterbegin',
        '<div class="op-now-h"><span class="lb" id="op-nowlb">กำลังเล่น</span></div>'+
        '<h1 class="op-title"><span class="op-ck" id="op-nowck" hidden></span><span id="op-nowt">ยังไม่ได้เลือกเพลง</span></h1>'+
        '<div class="op-artist" id="op-nowa"></div>'+
        '<div class="op-seek"><span id="op-tm">0:00</span><div class="op-track" id="op-track" role="slider" aria-label="ตำแหน่งเพลง"><i id="op-trk"></i></div><span id="op-du">0:00</span></div>'+
        '<div class="op-adj">'+
          '<div class="op-step" aria-label="คีย์"><span class="k">คีย์</span><button type="button" id="op-kd" aria-label="ลดคีย์">−</button><span class="v" id="op-kv">—</span><button type="button" id="op-ku" aria-label="เพิ่มคีย์">+</button></div>'+
          '<div class="op-step" aria-label="เทมโป"><span class="k">เทมโป</span><button type="button" id="op-td" aria-label="ช้าลง">−</button><span class="v" id="op-tv">100%</span><button type="button" id="op-tu" aria-label="เร็วขึ้น">+</button></div>'+
        '</div>'+
        '<div class="op-rowc">'+
          '<button class="op-chip pad" type="button" id="op-pad" aria-pressed="false" aria-label="Pad" title="Pad">'+svg.pad+'<span id="op-padl"> Pad</span></button>'+
          '<button class="op-chip" type="button" id="op-metro" aria-pressed="false" aria-label="เมโทร" title="เมโทร">'+svg.metro+'<span class="op-metrol"> เมโทร</span></button>'+
          '<button class="op-chip" type="button" id="op-sfx" aria-pressed="false" aria-label="เสียงประกอบ" title="SFX">'+svg.sfx+'<span class="op-sfxl"> SFX</span></button>'+
          '<button class="op-chip" type="button" id="op-auto" aria-pressed="false" aria-label="เล่นต่อเนื่องอัตโนมัติ"><span class="op-autoico" aria-hidden="true">∞</span><span class="op-autol"> ต่อเนื่อง</span></button>'+
          '<div class="op-trans">'+
            '<button class="op-prev" type="button" id="op-prev" aria-label="ย้อนเพลง">'+svg.prev+'</button>'+
            '<button class="op-play" type="button" id="op-play" aria-label="เล่น/หยุด">'+svg.play+'</button>'+
            '<button class="op-next" type="button" id="op-next" aria-label="เพลงถัดไป">'+svg.next+'</button>'+
          '</div>'+
        '</div>'+
        '<div class="op-nxt" id="op-nxt"></div>'
      );
      $id('op-kd').onclick=function(e){e.stopPropagation();try{$id('kd').click()}catch(err){}};
      $id('op-ku').onclick=function(e){e.stopPropagation();try{$id('ku').click()}catch(err){}};
      $id('op-td').onclick=function(e){e.stopPropagation();try{tempoStep65(-1)}catch(err){try{$id('td').click()}catch(x){}}};
      $id('op-tu').onclick=function(e){e.stopPropagation();try{tempoStep65(1)}catch(err){try{$id('tu').click()}catch(x){}}};
      $id('op-pad').onclick=function(e){e.stopPropagation();try{padToggle()}catch(err){}};
      $id('op-metro').onclick=function(e){e.stopPropagation();openMetro()};
      bindOpAuto();
      bindOpPrev();
      $id('op-play').onclick=function(e){e.stopPropagation();try{$id('big').click()}catch(err){}};
      $id('op-next').onclick=function(e){e.stopPropagation();try{songStep(1)}catch(err){}};
      $id('op-track').onclick=function(e){
        e.stopPropagation();
        const r=e.currentTarget.getBoundingClientRect();
        const f=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
        try{if(cur&&cur.buf){const d=cur.buf.duration,a=Math.min(trS(cur.id)||0,d),b=trE(cur.id,d);seekFrac(d?Math.min(1,(a+f*Math.max(0,b-a))/d):f)}else seekFrac(f)}catch(err){}
      };
    }
    if(!lv.querySelector('.op-listh')){
      const h=el('<div class="op-listh"><h2 id="op-listt">ลิสต์สด</h2><span class="sub">แตะเพื่อเล่น · ลากเพื่อเรียง</span><span class="n" id="op-listn">0 เพลง</span><div class="op-listacts"><button type="button" class="op-listhbtn" id="op-listsw" aria-label="สลับลิสต์สดหรือลิสต์ที่บันทึก">'+svg.list+'</button><button type="button" class="op-listhbtn" id="op-listshare" aria-label="แชร์ลิสต์">'+svg.share+'</button><button type="button" class="op-listhbtn op-listmore" id="op-listmore" aria-label="เมนูลิสต์">'+svg.more+'</button></div></div>');
      const lvl=lv.querySelector('.lvl');
      if(lvl)lvl.before(h);else lv.appendChild(h);
      bindListHead();
    }else{
      bindListHead();
    }
    if(!$id('op-prev')){
      const play=$id('op-play');
      if(play){
        play.insertAdjacentHTML('beforebegin','<button class="op-prev" type="button" id="op-prev" aria-label="ย้อนเพลง">'+svg.prev+'</button>');
        bindOpPrev();
      }
    }
    if(!$id('op-sfx')){
      const metro=$id('op-metro');
      if(metro){
        metro.insertAdjacentHTML('afterend','<button class="op-chip" type="button" id="op-sfx" aria-pressed="false" aria-label="เสียงประกอบ" title="SFX">'+svg.sfx+'<span class="op-sfxl"> SFX</span></button>');
      }
    }
    if(!$id('op-auto')){
      const sfx=$id('op-sfx')||$id('op-metro');
      if(sfx){
        sfx.insertAdjacentHTML('afterend','<button class="op-chip" type="button" id="op-auto" aria-pressed="false" aria-label="เล่นต่อเนื่องอัตโนมัติ"><span class="op-autoico" aria-hidden="true">∞</span><span class="op-autol"> ต่อเนื่อง</span></button>');
        bindOpAuto();
      }
    }
    try{syncOpAuto()}catch(e){}
    lv.classList.add('op-ready');
    nw.querySelectorAll(':scope > *').forEach(function(n){
      if(!n.classList.contains('op-now-h')&&n.id!=='op-nowt'&&!n.classList.contains('op-title')&&!n.classList.contains('op-artist')&&!n.classList.contains('op-seek')&&!n.classList.contains('op-adj')&&!n.classList.contains('op-rowc')&&!n.classList.contains('op-nxt')) n.classList.add('op-hide');
    });
  }

  function bindRowPress(c){
    if(c._opLp)return;c._opLp=1;
    var t=0,x0=0,y0=0;
    c.addEventListener('pointerdown',function(e){
      if(e.target.closest('.op-grip,button,a,input'))return;
      x0=e.clientX;y0=e.clientY;
      t=setTimeout(function(){t=0;try{openRowMore(c.dataset.sid)}catch(err){}},480);
    });
    function clr(){if(t){clearTimeout(t);t=0}}
    c.addEventListener('pointerup',clr);
    c.addEventListener('pointercancel',clr);
    c.addEventListener('pointermove',function(e){
      if(t&&(Math.abs(e.clientX-x0)>10||Math.abs(e.clientY-y0)>10))clr();
    });
  }
  function rowDecor(lv){
    lv.querySelectorAll('.lvl .sc[data-sid]').forEach(function(c){
      if(!c.querySelector('.op-grip')){
        c.insertBefore(el('<span class="op-grip" aria-label="ลากเรียงลำดับ">'+svg.grip+'</span>'),c.firstChild);
      }
      var more=c.querySelector('.op-rowmore');if(more)more.remove();
      var eq=c.querySelector('.eq');if(eq)eq.remove();
      var a=c.querySelector('.sca');
      if(a){a.querySelectorAll('.chip,.op-kb,.kb,.scc,span[class*="key"]').forEach(function(n){n.remove()})}
      let tags=c.querySelector('.op-tags');
      if(!tags){tags=el('<div class="op-tags"></div>');c.appendChild(tags)}
      const id=c.dataset.sid;
      let known=false;try{known=!!(typeof SONG!=='undefined'&&SONG.get(id))}catch(e){}
      if(known){
        let kn='—',bb='';
        try{
          kn=kl65(id,1)||'—';
          const r=typeof realBpm==='function'?realBpm(id):0;
          bb=r?String(Math.round(r)):((pref(id).tempo&&pref(id).tempo!==100)?(pref(id).tempo+'%'):'');
        }catch(e){}
        tags.innerHTML='<span class="op-kb">'+esc(kn)+'</span>'+(bb?'<span class="op-bpm">'+esc(bb)+'</span>':'');
      }
      bindRowPress(c);
    });
  }

  function fmt2(s){s=Math.max(0,s||0);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
  function paintNow(){
    const id=cur&&cur.id,s=id&&SONG.get(id);
    const t=$id('op-nowt'),a=$id('op-nowa'),lb=$id('op-nowlb');
    if(t)t.textContent=s?s.t:'ยังไม่ได้เลือกเพลง';
    ckBadge($id('op-nowck'),id);
    if(a)a.textContent=s?(s.a||''):'';
    const i=id?SET.indexOf(id):-1;
    if(lb)lb.textContent=i>=0?('กำลังเล่น · '+(i+1)+' / '+SET.length):(SET.length?('ลิสต์ · '+SET.length+' เพลง'):'กำลังเล่น');
    let p=0,d=0;
    // v1.0.38: time / length / progress follow the song's start+end marks (length = end mark - start mark)
    let ms0=0,me0=0;
    try{if(cur&&cur.buf){d=cur.buf.duration;ms0=Math.min(trS(cur.id)||0,d);me0=Math.max(ms0+0.01,trE(cur.id,d));p=Math.max(0,Math.min(pos(),me0)-ms0)}}catch(e){}
    const ml0=Math.max(0,me0-ms0);
    const tm=$id('op-tm'),du=$id('op-du'),trk=$id('op-trk');
    if(tm)tm.textContent=fmt2(p);
    if(du)du.textContent=fmt2(ml0);
    if(trk)trk.style.width=(ml0?Math.max(0,Math.min(100,p/ml0*100)):0)+'%';
    const kv=$id('op-kv'),tv=$id('op-tv');
    if(kv)kv.textContent=id?(kl65(id,1)||'—'):'—';
    if(tv){
      let lab='100%';
      try{if(id){const r=typeof realBpm==='function'?realBpm(id):0;const t0=pref(id).tempo||100;lab=r?String(Math.round(r)):t0+'%'}}catch(e){}
      tv.textContent=lab;
    }
    const pb=$id('op-play');
    if(pb){const on=!!playing;pb.innerHTML=on?svg.pause:svg.play;pb.setAttribute('aria-label',on?'หยุด':'เล่น')}
    const pad=$id('op-pad'),pl=$id('op-padl');
    if(pad){const on=!!(typeof PAD!=='undefined'&&PAD.on);pad.classList.toggle('on',on);pad.setAttribute('aria-pressed',on?'true':'false');if(pl)pl.textContent=on?' Pad เปิด':' Pad'}
    try{syncOpAuto()}catch(e){}
    const nx=$id('op-nxt');if(nx)nx.innerHTML='';
    const ln=$id('op-listn');if(ln)ln.textContent=SET.length+' เพลง';
    const lt=$id('op-listt');
    if(lt){
      var nm='';
      try{nm=(typeof SNOTE!=='undefined'&&SNOTE._name)||(typeof LIVE!=='undefined'&&LIVE&&(LIVE.n||(LIVE.__d&&LIVE.__d.n)))||''}catch(e){}
      lt.textContent=nm?('ลิสต์สด · '+nm):'ลิสต์สด';
    }
  }
  function paintTop(){
    var bn='';
    try{
      if(typeof LIVE!=='undefined'&&LIVE&&LIVE.bn)bn=LIVE.bn;
      else if(typeof BD!=='undefined'&&BD.bands&&BD.bands[0])bn=BD.bands[0].name;
    }catch(e){}
    const b=$id('op-bandn');if(b&&b.textContent!==bn)b.textContent=bn;
    const sy=$id('op-sync'),syt=$id('op-synct');
    var st='ซิงก์แล้ว';
    try{
      if(typeof LIVE!=='undefined'&&LIVE){
        const k=typeof LVST==='string'?LVST:'';
        st=k==='ok'?'ซิงก์แล้ว':k==='off'?'ออฟไลน์':(k==='pend'||k==='wait')?'กำลังซิงก์':k==='gone'?'ไม่พบลิสต์':'ซิงก์แล้ว';
      }
    }catch(e){}
    if(sy)sy.classList.toggle('on',!!(typeof LIVE!=='undefined'&&LIVE));
    if(syt)syt.textContent=st;
    var initial='?',nm='บัญชี',em='';
    try{
      const u=typeof CLD!=='undefined'&&CLD.user;
      if(u){
        nm=u.displayName||(u.email?u.email.split('@')[0]:'บัญชี');
        em=(typeof BD!=='undefined'&&BD.bands&&BD.bands[0])?BD.bands[0].name:(u.email||'');
        initial=(nm||'?').trim().charAt(0);
      }
    }catch(e){}
    const av=$id('op-av'),mav=$id('op-mav'),mnm=$id('op-mnm'),mem=$id('op-mem');
    if(av){
      var text='';
      av.childNodes.forEach(function(n){if(n.nodeType===3)text+=n});
      if(av.firstChild&&av.firstChild.nodeType===3)av.firstChild.textContent=initial;
    }
    if(mav)mav.textContent=initial;
    if(mnm)mnm.textContent=nm;
    if(mem)mem.textContent=em;
    var unread=0;
    try{if(typeof ntUnread==='function')unread=ntUnread()||0}catch(e){}
    const dot=$id('op-dot'),nb=$id('op-mnb');
    if(dot){dot.textContent=unread>9?'9+':String(unread);dot.classList.toggle('on',unread>0)}
    if(nb){nb.textContent=String(unread);nb.classList.toggle('on',unread>0)}
  }


  function bindListHead(){
    const sw=$id('op-listsw'),sh=$id('op-listshare'),mo=$id('op-listmore');
    if(sw&&!sw._opB){sw._opB=1;sw.onclick=function(e){e.preventDefault();e.stopPropagation();try{svOpen()}catch(err){try{acpOpen()}catch(x){}}}}
    if(sh&&!sh._opB){sh._opB=1;sh.onclick=function(e){e.preventDefault();e.stopPropagation();try{shareOne()}catch(err){}}}
    if(mo&&!mo._opB){mo._opB=1;mo.onclick=function(e){e.preventDefault();e.stopPropagation();openListMore()}}
    const h=document.querySelector('#livelist .op-listh');
    if(h&&!h.querySelector('.op-listacts')){
      const acts=el('<div class="op-listacts"></div>');
      if(!sw)acts.insertAdjacentHTML('beforeend','<button type="button" class="op-listhbtn" id="op-listsw" aria-label="สลับลิสต์สดหรือลิสต์ที่บันทึก">'+svg.list+'</button>');
      if(!sh)acts.insertAdjacentHTML('beforeend','<button type="button" class="op-listhbtn" id="op-listshare" aria-label="แชร์ลิสต์">'+svg.share+'</button>');
      const old=h.querySelector('#op-listmore');
      if(old)acts.appendChild(old);
      else acts.insertAdjacentHTML('beforeend','<button type="button" class="op-listhbtn op-listmore" id="op-listmore" aria-label="เมนูลิสต์">'+svg.more+'</button>');
      h.appendChild(acts);
      bindListHead();
    }
  }
  function seedList(n){
    n=Math.max(0,n|0);
    const ids=[];
    for(let i=0;i<n;i++){
      const id='__op20_'+i;
      if(!SONG.has(id))SONG.set(id,{t:'เพลงทดสอบ '+(i+1),a:'ศิลปิน',id:id,_id:id});
      ids.push(id);
    }
    SET=ids.slice();
    try{stripKey='';stripDraw()}catch(e){}
    try{paintNow&&paintNow()}catch(e){}
    return ids;
  }
  function lockPageScroll(){
    document.documentElement.classList.add('op18');
    if(document.documentElement._opLock)return;
    document.documentElement._opLock=1;
    const allow=function(t){return t&&t.closest&&t.closest('.lvl,.lvnow,#op-overlay,#op-ovb,#left,#main,.acsc,#op-menu,.ntp70,.ch81,.ch81l,.sv60,.mbox,#toast,#op-track,#acctc,.acpg,.op-fb,#bs60,#bs60b,.bs60b,.bs60p,#op-dualui,.dd-list,.dd-wave,.dd-xf,#op-maint,#op-sfxsheet,.sfx-grid,#op-sfx,#dd-sfx')};
    document.addEventListener('touchmove',function(e){
      if(!document.body.classList.contains('live'))return;
      if(allow(e.target))return;
      if(document.body.classList.contains('sheet-open')||document.body.classList.contains('op-ov')||document.body.classList.contains('menu-open')||document.body.classList.contains('acp-on')||document.querySelector('.bs60.on'))return;
      let el=e.target;
      while(el&&el!==document.body){
        const s=getComputedStyle(el);
        if((s.overflowY==='auto'||s.overflowY==='scroll')&&el.scrollHeight>el.clientHeight+1)return;
        el=el.parentElement;
      }
      e.preventDefault();
    },{passive:false});
  }
  function setCollapsed(on,save){
    if(window.innerWidth>=800)on=false;
    document.body.classList.toggle('op-collapsed',!!on);
    if(save!==false){try{localStorage.setItem('bp-opnow',on?'0':'1')}catch(e){}}
  }
  function placeWave(){
    var w=$id('lvw'),track=$id('op-track');
    if(!w||!track)return;
    if(w.parentNode!==track){
      track.appendChild(w);
      try{if(typeof LW!=='undefined')LW.k=''}catch(e){}
    }
  }
  function bindNow(lv){
    var nw=lv.querySelector('.lvnow'),lvl=lv.querySelector('.lvl');
    if(nw&&!nw._opBind){
      nw._opBind=1;
      nw.addEventListener('click',function(e){
        if(!document.body.classList.contains('op-collapsed'))return;
        if(e.target.closest('button,a,input,.op-track,#op-track'))return;
        setCollapsed(false);
      });
    }
    if(lvl&&!lvl._opScr){
      lvl._opScr=1;
      const onScr=function(el){
        if(window.innerWidth>=800)return;
        if((el.scrollTop||0)>16&&!document.body.classList.contains('op-collapsed'))setCollapsed(true);
      };
      lvl.addEventListener('scroll',function(){onScr(lvl)},{passive:true});
      if(!lv._opScr){
        lv._opScr=1;
        lv.addEventListener('scroll',function(){onScr(lv)},{passive:true});
      }
    }
  }
  function tick(){
    try{
      document.body.classList.add('op18');
      document.documentElement.classList.add('op18');
      document.documentElement.classList.toggle('op18-live',document.body.classList.contains('live'));
      lockPageScroll();
      mountChrome();
      const lv=$id('livelist');
      if(window.innerWidth>=800)document.body.classList.remove('op-collapsed');
      if(lv&&document.body.classList.contains('live')){ensureNow(lv);bindNow(lv);placeWave();rowDecor(lv);paintNow()}
      paintTop();
      try{if(window.__dual&&__dual.tick)__dual.tick()}catch(e){}
    }catch(e){}
  }

  document.body.classList.add('op18');
  try{if(localStorage.getItem('bp-opnow')==='0')document.body.classList.add('op-collapsed')}catch(e){}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){mountChrome();tick()});
  else{mountChrome();tick()}
  setInterval(tick,400);
  {const _sd=stripDraw;stripDraw=function(){const r=_sd.apply(this,arguments);try{tick()}catch(e){}return r}}
  window.__op18={openLib:openLib,openMetro:openMetro,openImport:openImport,openSettings:openSettings,closeOv:closeOv,closeSheet:closeSheet,closeMenu:closeMenu,openMoreNow:openMoreNow,openListMore:openListMore,openRowMore:openRowMore,setCollapsed:setCollapsed,seedList:seedList,bindListHead:bindListHead,openFeedback:openFeedback,syncAuto:syncOpAuto,setLive:setLive};
})();

// ===================== v1.0.26 scheduled maintenance banner =====================
(function(){
  const TZ='Asia/Bangkok';
  let data=null, frozen=null, timer=0;
  function now(){return frozen==null?Date.now():frozen}
  function phase(d,t){
    if(!d||!d.on||!d.start||!d.end||t>=d.end)return 'off';
    if(t<d.start)return 'soon';
    return 'now';
  }
  function parts(ms){
    const P=new Intl.DateTimeFormat('th-TH',{timeZone:TZ,weekday:'long',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
    const g=ty=>(P.find(p=>p.type===ty)||{}).value||'';
    return {wd:g('weekday'),d:g('day'),mo:g('month'),y:g('year'),hm:g('hour')+':'+g('minute')};
  }
  function fmtRange(s,e){
    const a=parts(s),b=parts(e);
    if(a.d===b.d&&a.mo===b.mo&&a.y===b.y)return a.wd+'ที่ '+a.d+' '+a.mo+' '+a.y+' '+a.hm+'–'+b.hm+' น.';
    return a.wd+'ที่ '+a.d+' '+a.mo+' '+a.hm+' น. – '+b.wd+'ที่ '+b.d+' '+b.mo+' '+b.hm+' น.';
  }
  function fmtUntil(e){const b=parts(e);return b.hm+' น.';}
  function label(d,ph){
    if(ph==='soon')return 'แจ้งปรับปรุงระบบ '+fmtRange(d.start,d.end);
    if(ph==='now')return 'กำลังปรับปรุงระบบ ถึง '+fmtUntil(d.end);
    return '';
  }
  function dismissed(d,ph){
    try{
      const v=localStorage.getItem('bp-maint-x');
      if(!v||!d)return false;
      const p=v.split('|');
      if(p[0]!==String(d.start)||p[1]!==String(d.end))return false;
      // start|end (legacy) counts as soon-only so the banner still appears at start time
      return (p[2]||'soon')===ph;
    }catch(e){return false}
  }
  function dismiss(d){try{const ph=phase(d,now());localStorage.setItem('bp-maint-x',String(d.start)+'|'+String(d.end)+'|'+ph)}catch(e){}paint()}
  function el(){return document.getElementById('op-maint')}
  function ensure(){
    let b=el();
    if(b)return b;
    b=document.createElement('div');
    b.id='op-maint';
    b.hidden=true;
    b.setAttribute('role','status');
    b.innerHTML='<div class="tx"></div><button type="button" class="x" aria-label="ปิดประกาศ">✕</button>';
    b.querySelector('.x').onclick=function(e){e.preventDefault();e.stopPropagation();if(data)dismiss(data)};
    (document.body||document.documentElement).appendChild(b);
    return b;
  }
  function place(b){
    const vis=function(el){if(!el)return false;const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0};
    const top=document.getElementById('op-top');
    const tabs=document.querySelector('header .tabs');
    let y=8;
    if(vis(top))y=Math.ceil(top.getBoundingClientRect().bottom)+4;
    else if(vis(tabs)){
      const r=tabs.getBoundingClientRect();
      if(r.bottom<window.innerHeight*0.45)y=Math.ceil(r.bottom)+4;
    }
    b.style.top=y+'px';
    document.documentElement.style.setProperty('--op-maint','0px');
    try{if(window.__dual&&__dual.placeUi)__dual.placeUi()}catch(e){}
  }
  function sched(d,ph,t){
    clearTimeout(timer);
    if(!d||ph==='off')return;
    const at=ph==='soon'?d.start:d.end;
    const wait=Math.max(200, Math.min(at-t+30, 60000));
    timer=setTimeout(paint, wait);
  }
  function paint(){
    const t=now();
    const d=data;
    const ph=phase(d,t);
    const b=ensure();
    const hide=ph==='off'||((ph==='soon'||ph==='now')&&dismissed(d,ph));
    b.hidden=!!hide;
    b.dataset.ph=ph;
    document.body.classList.toggle('op-maintbn', !hide);
    const tx=b.querySelector('.tx');
    const x=b.querySelector('.x');
    const text=hide?'':label(d,ph);
    if(tx){tx.textContent=text;if(d&&d.msg&&!hide){const s=document.createElement('div');s.className='sub';s.textContent=d.msg;tx.appendChild(s)}}
    if(x)x.hidden=!!hide;
    b.setAttribute('aria-label', text||'');
    if(!hide)place(b);
    else document.documentElement.style.setProperty('--op-maint','0px');
    try{
      if(typeof NT!=='undefined'){
        NT.maint=(!hide||ph==='soon'||ph==='now')&&d&&d.on&&t<d.end?{item:{k:'maint',ti:label(d,ph==='off'?'soon':ph)+(d.msg?' · '+d.msg:''),t:d.t||d.start||t,sys:1}}:null;
      }
    }catch(e){}
    try{if(typeof ntBtn==='function')ntBtn()}catch(e){}
    sched(d,ph,t);
  }
  function apply(x){
    if(!x){data=null;paint();return}
    data={on:!!x.on,start:+x.start||0,end:+x.end||0,msg:typeof x.msg==='string'?x.msg.slice(0,500):'',t:+x.t||Date.now()};
    paint();
  }
  window.__maint={
    set:apply,
    fromRemote:apply,
    get:function(){return data&&{...data,phase:phase(data,now()),now:now()}},
    setNow:function(ms){frozen=(ms==null||ms===false)?null:+ms;paint()},
    dismiss:function(){if(data)dismiss(data)},
    paint:paint
  };
  function boot(){try{ensure();paint()}catch(e){}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  addEventListener('resize',function(){try{if(el()&&!el().hidden)place(el())}catch(e){}});
})();

// ===================== v1.0.27 Dual (2-deck) — phase 2: simultaneous A+B =====================
(function(){
  function fresh(){return {id:null,offset:0,playing:false,ended:false,src:null,sh:null,startAt:0,buf:null,vol:1,eq:{l:0,m:0,h:0},bus:null,fading:null,live:null}}
  function assignId(sl,id){if(sl.id!==id){sl.live=null;sl.err=null}sl.id=id}
  function deckPref(sl){
    const base=(sl&&sl.id&&typeof pref==='function')?pref(sl.id):{key:0,tempo:100};
    const live=sl&&sl.live;
    if(!live)return base;
    const out=Object.assign({},base);
    if('key' in live)out.key=live.key;
    if('tempo' in live)out.tempo=live.tempo;
    return out;
  }
  function setDeckLive(sl,ch){sl.live=Object.assign({},sl.live||{},ch)}
  function deckBpm(sl){
    const id=sl&&sl.id;if(!id)return null;
    const b=typeof baseBpm==='function'?baseBpm(id):0;
    if(!b)return null;
    return b*((deckPref(sl).tempo||100)/100);
  }
  function deckKeyLab(sl,opt){
    try{
      const id=sl&&sl.id;if(!id)return opt?'':'—';
      const p=deckPref(sl),k=songKey(id);
      if(k)return keyName({r:k.r+(p.key||0),m:k.m,sp:k.sp});
    }catch(e){}
    return opt?'':'—';
  }
  const DUAL={on:false,a:fresh(),b:fresh(),audible:'A',last:'A',xf:0.5,pick:null,expect:null,hinted:false,cpuWarned:false,master:null};
  const orig={start:start,stop:stop,halt:halt,finish:finish,load:load,pos:pos,doFade:doFade,setPref:setPref,setPrefFor:setPrefFor,padToggle:padToggle};
  const I={
    play:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>',
    prev:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zM18 6l-10 6 10 6z"/></svg>',
    next:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M16 6h2v12h-2zM6 6l10 6-10 6z"/></svg>',
    cue:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 3v5h5"/></svg>',
    pad:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="10" rx="2"/><path d="M7 12h.01M12 12h.01M17 12h.01M9.5 16h5"/></svg>',
    metro:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3"/><path d="M8 21h8"/><path d="M9 21L12 6l3 15"/><path d="M9 13h8"/></svg>',
    fade:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v4h3l4 3V7L7 10H4z"/><path d="M16 8v8"/><path d="M19 11v2"/></svg>',
    nudgeL:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M11 6v12l-8-6 8-6zm10 0v12l-8-6 8-6z"/></svg>',
    nudgeR:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 6l8 6-8 6V6zm10 0l8 6-8 6V6z"/></svg>',
    more:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/></svg>',
    load:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4v12"/><path d="M6 10l6 6 6-6"/><path d="M5 20h14"/></svg>',
    list:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    share:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 3.1M15.4 6.9l-6.8 3.1"/></svg>'
  };
  Object.assign(I,{
    lib:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13h6"/></svg>',
    x:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    search:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    grip:'<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    ins:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M4 12h7M4 18h10"/><path d="M18 9v6M15 12h6"/></svg>',
    sliders:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    plug:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v4"/></svg>',
    sfx:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/></svg>',
    save:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/></svg>',
    swap:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"/></svg>'
  });
  function slot(w){return (w==='B'||w==='b')?DUAL.b:DUAL.a}
  function whichOf(w){return (w==='B'||w==='b')?'B':'A'}
  function deckOf(id){if(!id)return null;if(DUAL.a.id===id)return 'A';if(DUAL.b.id===id)return 'B';return null}
  function keepIds(){
    const ids=[DUAL.a.id,DUAL.b.id];
    const last=slot(DUAL.last||DUAL.audible);
    if(last&&last.id){const i=SET.indexOf(last.id);if(i>=0&&SET[i+1])ids.push(SET[i+1])}
    return ids.filter(Boolean);
  }
  function idleOf(){return DUAL.audible==='A'?'B':'A'}
  function fmt2(s){s=Math.max(0,s||0)|0;return (s/60|0)+':'+String(s%60).padStart(2,'0')}
  function $el(id){return document.getElementById(id)}
  function anyPlaying(){return !!(DUAL.a.playing||DUAL.b.playing)}
  function xfGains(x){x=Math.max(0,Math.min(1,x));return {a:Math.cos(x*Math.PI/2),b:Math.sin(x*Math.PI/2)}}
  function xfApplied(){
    const g=xfGains(DUAL.xf);
    const aOn=!!DUAL.a.playing,bOn=!!DUAL.b.playing;
    if(aOn&&bOn)return g;
    if(aOn&&!bOn)return {a:1,b:g.b};
    if(bOn&&!aOn)return {a:g.a,b:1};
    return g;
  }
  function stereo(n){
    if(!n)return n;
    try{n.channelCount=2;n.channelCountMode='explicit';n.channelInterpretation='speakers'}catch(e){}
    return n;
  }

  function ensureMaster(){
    try{initAudio()}catch(e){}
    if(!ctx)return null;
    if(!DUAL.master){
      DUAL.master=stereo(ctx.createGain());
      DUAL.master.gain.value=1;
      // v1.0.37: master -> split -> per channel: limiter (mono) -> mkCeil (+6 dB makeup, soft ceiling <= -0.3 dBFS) -> merger -> out. No StereoPanner (it sums L+R).
      const ms=ctx.createChannelSplitter(2),lL=mkLim(),lR=mkLim(),cL2=mkCeil(1),cR2=mkCeil(1),mg=ctx.createChannelMerger(2);
      DUAL.master.connect(ms);ms.connect(lL,0);ms.connect(lR,1);lL.connect(cL2);lR.connect(cR2);cL2.connect(mg,0,0);cR2.connect(mg,0,1);
      DUAL.out={sp:ms,lim:[lL,lR],ceil:[cL2,cR2],mg:mg};
      try{mg.connect(ctx.destination)}catch(e){}
    }
    return DUAL.master;
  }
  function ensureBus(sl){
    if(sl.bus)return sl.bus;
    if(!ensureMaster())return null;
    // v1.0.36: per-song L/R mix (same rules as the single player: swap, strip vol/mute/solo, strip output) before EQ.
    const sp=ctx.createChannelSplitter(2);try{sp.channelInterpretation='speakers'}catch(e){}
    // v1.0.37: routing via gains -> ChannelMerger (L/R/C like the one-page player: C = half each side), never a StereoPanner.
    const f0=ctx.createGain(),f1=ctx.createGain();
    const mg=ctx.createChannelMerger(2);
    const r=[[ctx.createGain(),ctx.createGain()],[ctx.createGain(),ctx.createGain()]];
    const sum=stereo(ctx.createGain());
    sp.connect(f0,0);sp.connect(f1,1);
    [f0,f1].forEach(function(f,ch){f.connect(r[ch][0]);f.connect(r[ch][1]);r[ch][0].connect(mg,0,0);r[ch][1].connect(mg,0,1);r[ch][0].gain.value=ch?0:1;r[ch][1].gain.value=ch?1:0});
    mg.connect(sum);
    const eqL=stereo(ctx.createBiquadFilter());eqL.type='lowshelf';eqL.frequency.value=250;eqL.gain.value=0;
    const eqM=stereo(ctx.createBiquadFilter());eqM.type='peaking';eqM.frequency.value=1000;eqM.Q.value=0.7;eqM.gain.value=0;
    const eqH=stereo(ctx.createBiquadFilter());eqH.type='highshelf';eqH.frequency.value=4000;eqH.gain.value=0;
    const vol=stereo(ctx.createGain());vol.gain.value=1;
    const xf=stereo(ctx.createGain());xf.gain.value=1;
    const fade=stereo(ctx.createGain());fade.gain.value=1;
    sum.connect(eqL);eqL.connect(eqM);eqM.connect(eqH);eqH.connect(vol);vol.connect(xf);xf.connect(fade);fade.connect(DUAL.master);
    sl.bus={in:sp,sp:sp,f:[f0,f1],r:r,mg:mg,pan:[-1,1],sum:sum,eqL:eqL,eqM:eqM,eqH:eqH,vol:vol,xf:xf,fade:fade,mixSig:''};
    applyDeckMix(sl,true);applyVol(sl);applyEq(sl);applyXf();
    return sl.bus;
  }
  function deckMix(id){
    const out={f:[1,1],pan:[-1,1],M:1,swap:false};
    if(!id||typeof mixOf!=='function')return out;
    try{
      const m=mixOf(id),sw=!!(pref(id)||{}).swap,solo=m.c.s||m.u.s;
      out.swap=sw;out.M=db2(m.M);
      for(let ch=0;ch<2;ch++){
        const st=stripOf(id,ch);
        out.f[ch]=(st.m||(solo&&!st.s))?0:db2(st.v);
        try{if(typeof balMul==='function')out.f[ch]*=balMul(id,ch)}catch(e){}
        const o=st.o||outDef(ch,sw);
        out.pan[ch]=o==='L'?-1:o==='R'?1:0;
      }
    }catch(e){}
    return out;
  }
  function applyDeckMix(sl,force){
    if(!sl||!sl.bus||!ctx)return;
    const m=deckMix(sl.id),sig=(sl.id||'')+'|'+m.f.join(',')+'|'+m.pan.join(',')+'|'+m.M;
    if(!force&&sl.bus.mixSig===sig)return;
    sl.bus.mixSig=sig;
    const t=ctx.currentTime;
    for(let ch=0;ch<2;ch++){
      try{sl.bus.f[ch].gain.setTargetAtTime(m.f[ch],t,0.015)}catch(e){sl.bus.f[ch].gain.value=m.f[ch]}
      const pv=m.pan[ch],gl=(1-pv)/2,gr=(1+pv)/2;sl.bus.pan[ch]=pv;
      try{sl.bus.r[ch][0].gain.setTargetAtTime(gl,t,0.015);sl.bus.r[ch][1].gain.setTargetAtTime(gr,t,0.015)}catch(e){sl.bus.r[ch][0].gain.value=gl;sl.bus.r[ch][1].gain.value=gr}
    }
    try{sl.bus.sum.gain.setTargetAtTime(m.M,t,0.015)}catch(e){sl.bus.sum.gain.value=m.M}
  }
  function applyVol(sl){
    if(!sl||!sl.bus)return;
    let g=sl.vol==null?1:sl.vol;
    try{if(sl.id&&typeof gainDb==='function')g*=Math.pow(10,gainDb(sl.id)/20)}catch(e){}
    try{if(sl.id&&typeof isOld==='function'&&isOld(sl.id))g/=OUTMK}catch(e){}
    const t=ctx&&ctx.currentTime;
    if(t!=null){sl.bus.vol.gain.cancelScheduledValues(t);sl.bus.vol.gain.setTargetAtTime(Math.max(0,g),t,0.015)}
    else sl.bus.vol.gain.value=Math.max(0,g);
  }
  function applyEq(sl){
    if(!sl||!sl.bus)return;
    const e=sl.eq||{l:0,m:0,h:0};
    const t=ctx&&ctx.currentTime;
    const set=function(node,v){if(!node)return;if(t!=null){node.gain.cancelScheduledValues(t);node.gain.setTargetAtTime(v,t,0.02)}else node.gain.value=v};
    set(sl.bus.eqL,+e.l||0);set(sl.bus.eqM,+e.m||0);set(sl.bus.eqH,+e.h||0);
  }
  function applyXf(){
    const g=xfApplied(),t=ctx&&ctx.currentTime;
    const set=function(sl,v){if(!sl.bus)return;if(t!=null){sl.bus.xf.gain.cancelScheduledValues(t);sl.bus.xf.gain.setTargetAtTime(v,t,0.02)}else sl.bus.xf.gain.value=v};
    set(DUAL.a,g.a);set(DUAL.b,g.b);
  }
  function fadeResetSlot(sl){
    if(!sl||!sl.bus)return;
    if(sl.fading){clearTimeout(sl.fading);sl.fading=null}
    const t=ctx&&ctx.currentTime;
    sl.bus.fade.gain.cancelScheduledValues(t||0);
    sl.bus.fade.gain.setValueAtTime(1,t||0);
  }
  function posOf(sl){
    if(!sl)return 0;
    if(!sl.playing)return sl.offset||0;
    let p;
    if(sl.sh)p=sl.sh.timePlayed;
    else if(!ctx)return sl.offset||0;
    else p=ctx.currentTime-sl.startAt;
    // v1.0.38: never report past the deck's end mark (the deck stops there)
    try{if(sl.id&&sl.buf){const e=trE(sl.id,sl.buf.duration);if(p>e)p=e}}catch(e){}
    return p;
  }
  // v1.0.38: the deck's own marks (start/end) — display, seek, end watcher and crossfade use these, not the focused song's
  function markOf(sl){
    const d=sl&&sl.buf?sl.buf.duration||0:0;
    if(!sl||!sl.id||!d)return {d:d,ts:0,te:d,len:d};
    const ts=Math.max(0,Math.min(trS(sl.id)||0,d));
    const te=Math.max(ts+0.01,Math.min(d,trE(sl.id,d)));
    return {d:d,ts:ts,te:te,len:te-ts};
  }
  function haltSlot(sl){
    if(!sl)return;
    if(sl.src){sl.src.onended=null;try{sl.src.stop()}catch(e){}try{sl.src.disconnect()}catch(e){}sl.src=null}
    if(sl.sh){
      try{sl.sh.disconnect()}catch(e){}
      try{sl.sh.off();sl.sh._node.onaudioprocess=null;sl.sh._filter.sourceSound.buffer=null;sl.sh._filter.sourceSound=null;sl.sh._filter=null;sl.sh._node=null}catch(e){}
      sl.sh=null;
    }
  }
  function stopSlot(w){
    w=whichOf(w);const sl=slot(w);
    if(sl.playing)sl.offset=posOf(sl);
    haltSlot(sl);sl.playing=false;
    fadeResetSlot(sl);
    try{applyXf()}catch(e){}
    if(DUAL.last===w)syncFocus();
    try{if(!anyPlaying())relWake()}catch(e){}
  }
  function finishSlot(w){
    w=whichOf(w);const sl=slot(w);
    haltSlot(sl);sl.playing=false;sl.offset=(sl.id&&typeof trS==='function'?trS(sl.id):0)||0;sl.ended=true;
    try{applyXf()}catch(e){}
    try{if(!anyPlaying())relWake()}catch(e){}
    if(DUAL.last===w)syncFocus();
    paint();
    try{if(AUTO&&AUTO.on)dualAutoNext(w)}catch(e){}
  }
  function warnCpu(){
    if(!(DUAL.a.playing&&DUAL.b.playing))return;
    let sa=false,sb=false;
    try{sa=!!(DUAL.a.id&&needSh(deckPref(DUAL.a)));sb=!!(DUAL.b.id&&needSh(deckPref(DUAL.b)))}catch(e){}
    if(sa&&sb&&!DUAL.cpuWarned){
      DUAL.cpuWarned=true;
      try{toast('⚠️ เล่นสองเด็คพร้อมเปลี่ยนคีย์/เทมโป อาจกินซีพียู',5000,true)}catch(e){}
    }
  }
  function syncFocus(){
    const w=whichOf(DUAL.last||DUAL.audible||'A');
    const sl=slot(w);
    if(sl.id&&sl.buf){cur={id:sl.id,buf:sl.buf};offset=posOf(sl);startAt=sl.startAt||0;ended=!!sl.ended}
    playing=!!sl.playing;
    try{if(typeof mediaMeta==='function')mediaMeta();if('mediaSession' in navigator)navigator.mediaSession.playbackState=sl.playing?'playing':sl.id?'paused':(anyPlaying()?'playing':'none')}catch(e){}
    try{if(anyPlaying())getWake();else relWake()}catch(e){}
    try{if(typeof sync==='function')sync()}catch(e){}
  }
  async function bufOf(id){
    if(!id)return null;
    try{initAudio();const b=await decode(id);return b||null}catch(e){DUAL.lastErr={id:id,msg:(e&&e.message)||String(e)};return null}
  }
  function startSlot(w,at){
    w=whichOf(w);const sl=slot(w);
    if(!sl.id)return;
    if(!sl.buf)return;
    try{initAudio();if(ctx&&ctx.resume)ctx.resume()}catch(e){}
    if(!ensureBus(sl))return;
    haltSlot(sl);
    const p=deckPref(sl);
    const dur=sl.buf.duration||0;
    if(!(dur>0.05))return;
    const cueAt=(typeof trS==='function'?trS(sl.id):0)||0;
    let want=at!=null?at:sl.offset;
    if(!(want>=0)||want>dur-0.08)want=cueAt;
    // v1.0.40: a deck always plays inside its marks — never before the start mark, and at/after the end mark it restarts from the start mark
    try{const te=trE(sl.id,dur);if(want<cueAt)want=cueAt;if(want>=te-0.08)want=cueAt}catch(e){}
    sl.offset=Math.max(0,Math.min(want,dur-0.05));
    sl.ended=false;
    fadeResetSlot(sl);
    try{applyDeckMix(sl)}catch(e){}
    try{applyVol(sl)}catch(e){} // v1.0.37: the deck's normalize/trim gain follows the song now loaded (was kept from the previous song on that deck)
    const dest=sl.bus.in;
    try{
      if(!needSh(p)){
        sl.src=ctx.createBufferSource();
        sl.src.buffer=sl.buf;
        sl.src.connect(dest);
        sl.src.onended=function(){if(sl.src&&sl.playing)finishSlot(w)};
        sl.src.start(0,sl.offset);
        sl.startAt=ctx.currentTime-sl.offset;
      }else{
        sl.sh=mkSh(sl.buf,function(){if(sl.playing)finishSlot(w)});
        sl.sh.pitchSemitones=p.key||0;
        sl.sh.tempo=(p.tempo||100)/100;
        sl.sh.percentagePlayed=dur?sl.offset/dur:0;
        sl.sh.timePlayed=sl.offset;
        sl.sh.connect(dest);
        sl.startAt=ctx.currentTime-sl.offset;
      }
    }catch(e){try{blog('error','dual start '+w,e&&e.message)}catch(_){}return}
    sl.playing=true;sl.gen=(sl.gen||0)+1;
    DUAL.last=w;DUAL.audible=w;
    try{applyXf()}catch(e){}
    syncFocus();
    try{if(typeof padSongStart==='function')padSongStart()}catch(e){}
    warnCpu();
    if(!raf)raf=requestAnimationFrame(loop);
  }
  function applySlotPref(id,ch){
    const w=deckOf(id);if(!w)return;
    const sl=slot(w);
    applyVol(sl);
    if(sl.playing&&ch&&('key' in ch||'tempo' in ch)){
      const p=deckPref(sl);
      if(sl.sh&&needSh(p)){
        if('key' in ch)sl.sh.pitchSemitones=p.key||0;
        if('tempo' in ch)sl.sh.tempo=(p.tempo||100)/100;
      }else if(sl.sh&&!needSh(p)){
        startSlot(w,posOf(sl));
      }else if(!sl.sh&&needSh(p)){
        startSlot(w,posOf(sl));
      }
      warnCpu();
    }
  }
  function fadeSlot(w){
    w=whichOf(w);const sl=slot(w);
    if(!sl.playing||!sl.bus)return;
    if(sl.fading){fadeResetSlot(sl);paint();return}
    const sec=(typeof FD!=='undefined'&&FD.s)||4;
    const t=ctx.currentTime;
    sl.bus.fade.gain.cancelScheduledValues(t);
    sl.bus.fade.gain.setValueAtTime(sl.bus.fade.gain.value,t);
    sl.bus.fade.gain.linearRampToValueAtTime(0.0001,t+sec);
    sl.fading=setTimeout(function(){sl.fading=null;stopSlot(w);fadeResetSlot(sl);paint()},sec*1000+40);
  }

  function ensureUi(){
    if($el('op-dualui'))return;
    const d=document.createElement('div');
    d.id='op-dualui';
    d.setAttribute('role','region');
    d.setAttribute('aria-label','หน้าแสดงสด 2 เด็ค');
    d.innerHTML=
      '<div class="dd-decks">'+deckHtml('A')+deckHtml('B')+'</div>'+
      '<div class="dd-master">'+
        '<span class="dd-xfab">A</span>'+
        '<div class="dd-xf" id="dd-xf" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-label="ครอสเฟดเดอร์ (แตะสองครั้ง = กลาง)">'+
          '<div class="dd-xftrack"></div><i class="dd-xfmid"></i><div class="dd-xfknob" id="dd-xfknob"></div>'+
        '</div>'+
        '<span class="dd-xfbb">B</span>'+
        '<button type="button" class="dd-mbtn" id="dd-auto" aria-pressed="false" aria-label="เล่นต่อเนื่องอัตโนมัติ" title="เล่นต่อเนื่อง">∞</button>'+
        '<button type="button" class="dd-mbtn" id="dd-xfsec" aria-label="ความยาวครอสเฟด" title="ความยาวครอสเฟด">XF</button>'+
        '<button type="button" class="dd-mbtn" id="dd-sfx" aria-pressed="false" aria-label="เสียงประกอบ" title="SFX">'+I.sfx+'</button>'+
      '</div>'+
      '<div class="dd-listwrap" id="dd-listwrap">'+
        '<div class="dd-listhead" id="dd-listhead"><h2>ลิสต์วันนี้</h2><span class="n" id="dd-listn">0 เพลง</span><span class="dd-st" id="dd-st" aria-live="polite"></span>'+
        '<div class="dd-listacts">'+
        '<button type="button" class="dd-listhbtn" id="dd-listsw" data-dd-listact="sw" aria-label="สลับลิสต์สดหรือลิสต์ที่บันทึก">'+I.list+'</button>'+
        '<button type="button" class="dd-listhbtn" id="dd-listshare" data-dd-listact="share" aria-label="แชร์ลิสต์">'+I.share+'</button>'+
        '<button type="button" class="dd-listhbtn" id="dd-listmore" data-dd-listact="more" aria-label="เมนูลิสต์">'+I.more+'</button>'+
        '</div></div>'+
        '<label class="dd-sbox" id="dd-sbox">'+I.search+'<input id="dd-q" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="ค้นเพลงแทรก… ชื่อ / ศิลปิน" aria-label="ค้นเพลงเพื่อแทรกในลิสต์"><button type="button" id="dd-qx" class="dd-qx" aria-label="ล้างคำค้น" hidden>'+I.x+'</button><button type="button" id="dd-qlib" class="dd-qlib" aria-label="เปิดคลังเพลง" title="คลังเพลง">'+I.lib+'</button></label>'+
        '<div class="dd-list" id="dd-list"></div>'+
        '<div class="dd-res" id="dd-res" hidden></div>'+
      '</div>'+
      '<div class="dd-dock" id="dd-dock">'+metroHtml()+mixHtml()+'</div>';
    document.body.appendChild(d);
    bindUi();
  }
  function deckHtml(w){
    const o=w==='A'?'B':'A',sid=w==='B'?'dd-sync':'dd-syncA';
    const st=function(act,d,lab,ic){return '<button type="button" data-dd="'+act+'" data-d="'+d+'" data-deck="'+w+'" aria-label="'+lab+'">'+ic+'</button>'};
    return '<section class="dd-deck '+w+'" id="dd-'+w+'" data-deck="'+w+'"><div class="dd-in">'+
      '<div class="dd-head">'+
        '<span class="dd-badge">'+w+'</span>'+
        '<div class="dd-meta"><div class="dd-trow"><span class="dd-ck" id="dd-'+w+'-ck" hidden></span><div class="dd-title" id="dd-'+w+'-t">ไม่มีเพลง</div></div><div class="dd-artist" id="dd-'+w+'-a"></div></div>'+
        '<button type="button" class="dd-load dd-hb" id="dd-'+w+'-load" aria-label="โหลดเพลงจากคลังเข้าเด็ค '+w+'" title="โหลดจากคลัง">'+I.lib+'</button>'+
        '<button type="button" class="dd-exp dd-hb" id="dd-'+w+'-exp" data-dd="exp" data-deck="'+w+'" aria-expanded="false" aria-label="Vol EQ และเครื่องมือเด็ค '+w+'" title="Vol / EQ / เครื่องมือ">'+I.more+'</button>'+
      '</div>'+
      '<div class="dd-plat" id="dd-'+w+'-plat"><canvas id="dd-'+w+'-cv" aria-hidden="true"></canvas>'+
        '<button type="button" class="play" data-dd="play" data-deck="'+w+'" aria-label="เล่น">'+I.play+'</button></div>'+
      '<div class="dd-rt">'+
        '<div class="dd-tools" role="toolbar" aria-label="เครื่องมือเด็ค '+w+'">'+
          '<button type="button" class="dd-tool cue" data-dd="cue" data-deck="'+w+'" aria-label="คิว เริ่มใหม่" title="CUE เริ่มใหม่">'+I.cue+'</button>'+
          '<button type="button" class="dd-tool tx dd-sync" data-dd="sync" data-deck="'+w+'" id="'+sid+'" aria-label="ซิงก์เทมโปเด็ค '+w+' ให้เท่าเด็ค '+o+'" title="SYNC '+w+' = '+o+'">SYNC</button>'+
          '<button type="button" class="dd-tool" data-dd="pad" data-deck="'+w+'" id="dd-'+w+'-pad" aria-pressed="false" aria-label="Pad" title="Pad">'+I.pad+'</button>'+
          '<button type="button" class="dd-tool" data-dd="fade" data-deck="'+w+'" id="dd-'+w+'-fade" aria-pressed="false" aria-label="เฟดออก" title="เฟดออก">'+I.fade+'</button>'+
        '</div>'+
        '<div class="dd-adj">'+
          '<div class="grp ky" id="dd-'+w+'-ky">'+st('key',-1,'ลดคีย์',I.minus)+'<span class="val"><em>คีย์</em><b id="dd-'+w+'-kv">—</b></span>'+st('key',1,'เพิ่มคีย์',I.plus)+'</div>'+
          '<div class="grp tp" id="dd-'+w+'-tp">'+st('tempo',-1,'ช้าลง',I.minus)+'<span class="val"><em>BPM</em><b id="dd-'+w+'-tv">—</b></span>'+st('tempo',1,'เร็วขึ้น',I.plus)+'</div>'+
        '</div>'+
      '</div>'+
      '<div class="dd-times"><span id="dd-'+w+'-tm">0:00</span><div class="dd-wave" id="dd-'+w+'-wave" data-deck="'+w+'" aria-label="แตะเพื่อเลื่อนตำแหน่งเพลงเด็ค '+w+'"><i class="dd-prog" id="dd-'+w+'-prog"></i><div class="dd-playhead" id="dd-'+w+'-ph"></div></div><span id="dd-'+w+'-du">0:00</span></div>'+
      '</div>'+
      '<div class="dd-mix" id="dd-'+w+'-mix" role="group" aria-label="Vol EQ และเครื่องมือเด็ค '+w+'">'+
        '<div class="dd-mixh"><b>เด็ค '+w+'</b><span class="dd-mixn">ปรับชั่วคราว ไม่บันทึกทับเพลง</span><button type="button" class="dd-hb" data-dd="exp" data-deck="'+w+'" aria-label="ปิดแผงเด็ค '+w+'">'+I.x+'</button></div>'+
        '<label class="dd-vol"><span>Vol</span><input type="range" min="0" max="100" value="100" id="dd-'+w+'-vol" data-dd="vol" data-deck="'+w+'" aria-label="ระดับเสียงเด็ค '+w+'"></label>'+
        '<label class="dd-eqi"><span>Lo</span><input type="range" min="-12" max="12" value="0" id="dd-'+w+'-eql" data-dd="eq" data-b="l" data-deck="'+w+'" aria-label="EQ เบสเด็ค '+w+'"></label>'+
        '<label class="dd-eqi"><span>Mid</span><input type="range" min="-12" max="12" value="0" id="dd-'+w+'-eqm" data-dd="eq" data-b="m" data-deck="'+w+'" aria-label="EQ กลางเด็ค '+w+'"></label>'+
        '<label class="dd-eqi"><span>Hi</span><input type="range" min="-12" max="12" value="0" id="dd-'+w+'-eqh" data-dd="eq" data-b="h" data-deck="'+w+'" aria-label="EQ แหลมเด็ค '+w+'"></label>'+
        '<div class="dd-row">'+
          '<button type="button" data-dd="prev" data-deck="'+w+'" aria-label="เพลงก่อนหน้า" title="เพลงก่อนหน้า">'+I.prev+'</button>'+
          '<button type="button" data-dd="nudge" data-d="-5" data-deck="'+w+'" aria-label="ถอย 5 วินาที" title="ถอย 5 วิ">'+I.nudgeL+'</button>'+
          '<button type="button" data-dd="nudge" data-d="5" data-deck="'+w+'" aria-label="เดิน 5 วินาที" title="เดิน 5 วิ">'+I.nudgeR+'</button>'+
          '<button type="button" data-dd="next" data-deck="'+w+'" aria-label="เพลงถัดไป" title="เพลงถัดไป">'+I.next+'</button>'+
          '<button type="button" data-dd="metro" data-deck="'+w+'" id="dd-'+w+'-metro" aria-pressed="false" aria-label="ตั้งนอมสดตาม BPM เด็คนี้" title="นอมสดตามเด็คนี้">'+I.metro+'</button>'+
          '<button type="button" data-dd="more" data-deck="'+w+'" aria-label="เมนูเพลง (แก้ข้อมูล/บันทึก)" title="เมนูเพลง">'+I.more+'</button>'+
        '</div>'+
        '<div class="dd-row2">'+
          '<button type="button" class="dd-wide" data-dd="save" data-deck="'+w+'" id="dd-'+w+'-save" aria-label="บันทึกคีย์และเทมโปนี้กับเพลง">'+I.save+'<span>บันทึกคีย์/เทมโป</span></button>'+
          '<button type="button" class="dd-wide" data-dd="swap" data-deck="'+w+'" id="dd-'+w+'-swap" aria-pressed="false" aria-label="สลับช่องซ้ายขวาของเพลงนี้ (บันทึกกับเพลง)">'+I.swap+'<span>สลับ L/R</span></button>'+
        '</div>'+
      '</div>'+
    '</section>';
  }
  function metroHtml(){
    return '<section class="dd-blk dd-metro" id="dd-metro" aria-label="นอมสด เมโทรนอม">'+
      '<div class="dd-bt">'+I.metro+'<span class="dd-btl">นอมสด</span><span class="dd-sp"></span>'+
        '<button type="button" class="dd-pill" id="dd-mout" aria-label="ช่องเสียงนอมสด">ออก L+R</button></div>'+
      '<div class="dd-mctl">'+
        '<button type="button" class="dd-mgo" id="dd-mgo" aria-pressed="false" aria-label="เริ่มนอมสด">'+I.play+'</button>'+
        '<div class="dd-mbpm"><button type="button" class="dd-mstep" id="dd-mdn" aria-label="ลด BPM">'+I.minus+'</button>'+
          '<span class="dd-bpm"><b id="dd-mbpm">100</b><small>BPM <span id="dd-msig">4/4</span></small><span class="dd-beats" id="dd-beats" aria-hidden="true"></span></span>'+
          '<button type="button" class="dd-mstep" id="dd-mup" aria-label="เพิ่ม BPM">'+I.plus+'</button></div>'+
        '<button type="button" class="dd-tap" id="dd-mtap" aria-label="แตะจับจังหวะ TAP"><b>TAP</b><small id="dd-mtaph">แตะตามจังหวะ</small></button>'+
      '</div>'+
    '</section>';
  }
  function mixHtml(){
    return '<section class="dd-blk dd-mixer" id="dd-mixer" aria-label="ต่อมิกซ์ร้าน">'+
      '<div class="dd-bt">'+I.plug+'<span class="dd-btl">มิกซ์ร้าน</span><span class="dd-sp"></span><span class="dd-pill" id="dd-mxp">สเตอริโอ</span></div>'+
      '<button type="button" class="dd-mxbody" id="dd-mxset" aria-label="ตั้งค่าการต่อมิกซ์ร้าน">'+
        '<span class="dd-chs" id="dd-chs"></span>'+I.sliders+'</button>'+
    '</section>';
  }

  function bindUi(){
    const root=$el('op-dualui');if(!root||root._bound)return;root._bound=1;
    root.addEventListener('click',function(e){
      const b=e.target.closest('[data-dd]');
      if(!b)return;
      if(b.tagName==='INPUT')return;
      e.preventDefault();e.stopPropagation();
      const w=whichOf(b.dataset.deck),act=b.dataset.dd,d=+b.dataset.d||0;
      if(act==='play')playDeck(w);
      else if(act==='cue')cueDeck(w);
      else if(act==='prev')stepDeck(w,-1);
      else if(act==='next')stepDeck(w,1);
      else if(act==='key')keyDeck(w,d);
      else if(act==='tempo')tempoDeck(w,d);
      else if(act==='pad')padDeck(w);
      else if(act==='metro')metroDeck(w);
      else if(act==='fade')fadeDeck(w);
      else if(act==='nudge')nudgeDeck(w,d);
      else if(act==='more')moreDeck(w);
      else if(act==='sync')syncDeck(w);
      else if(act==='exp')toggleExp(w);
      else if(act==='save')saveDeck(w);
      else if(act==='swap')swapDeck(w);
    });
    root.addEventListener('input',function(e){
      const b=e.target.closest('[data-dd]');
      if(!b)return;
      const w=whichOf(b.dataset.deck),act=b.dataset.dd;
      if(act==='vol')setDeckVol(w,+b.value/100);
      else if(act==='eq')setDeckEq(w,b.dataset.b,+b.value);
    });
    $el('dd-A-load').onclick=function(e){e.stopPropagation();pickLoad('A')};
    $el('dd-B-load').onclick=function(e){e.stopPropagation();pickLoad('B')};
    $el('dd-auto').onclick=function(e){e.stopPropagation();try{AUTO.on=!AUTO.on;if(!AUTO.on)cancelCd();saveAuto();if(typeof drawAuto==='function')drawAuto();if(window.__op18&&__op18.syncAuto)__op18.syncAuto();paintMaster()}catch(err){}};
    $el('dd-xfsec').onclick=function(e){e.stopPropagation();cycleXf();paintMaster()};
    root.addEventListener('click',function(e){
      const b=e.target.closest('[data-dd-listact]');
      if(!b)return;
      e.preventDefault();e.stopPropagation();
      const act=b.getAttribute('data-dd-listact');
      if(act==='more'){try{if(window.__op18&&__op18.openListMore){__op18.openListMore();return}}catch(err){}}
      const map={sw:'op-listsw',share:'op-listshare',more:'op-listmore'};
      const t=document.getElementById(map[act]||'');
      if(t)t.click();
    });
    bindXf();
    bindWaves();
    bindSearch();
    bindList();
    bindDock();
    if(!document._ddLib){
      document._ddLib=1;
      document.addEventListener('click',libIntercept,true);
    }
    mirrorStatus();
  }

  // ---- v1.0.36 explicit saves from the deck panel (deck steppers alone stay temporary) ----
  async function saveDeck(w){
    w=whichOf(w);const sl=slot(w);
    if(!sl.id){try{toast('โหลดเพลงเข้าเด็ค '+w+' ก่อน',1800)}catch(e){}return}
    const p=deckPref(sl),ch={key:p.key||0,tempo:p.tempo||100},id=sl.id;
    const pr=orig.setPrefFor(id,ch);
    try{dropLive(id,ch)}catch(e){}
    try{await pr}catch(e){}
    try{dropLive(id,ch);applySlotPref(id,ch)}catch(e){}
    try{toast('บันทึกคีย์/เทมโปกับเพลงแล้ว',1600,true)}catch(e){}
    paintDeck(w);
  }
  async function swapDeck(w){
    w=whichOf(w);const sl=slot(w);
    if(!sl.id){try{toast('โหลดเพลงเข้าเด็ค '+w+' ก่อน',1800)}catch(e){}return}
    const sw=!((typeof pref==='function'&&pref(sl.id))||{}).swap;
    try{await orig.setPrefFor(sl.id,{swap:sw})}catch(e){}
    try{ensureBus(sl);applyDeckMix(sl,true)}catch(e){}
    try{toast(sw?'สลับซ้าย/ขวาแล้ว (บันทึกกับเพลง)':'ซ้าย/ขวาตามไฟล์',1600,true)}catch(e){}
    paintDeck(w);
  }

  // ---- v1.0.36 status line (auto-continue countdown etc. used to show in the hidden now-card) ----
  function mirrorStatus(){
    const ps=document.getElementById('ps'),st=$el('dd-st');
    if(!ps||!st||ps._dd36)return;ps._dd36=1;
    let tmo=0;
    const upd=function(){
      const t=(ps.textContent||'').trim();
      if(/^(⏭|⚠️|✅)/.test(t)){st.textContent=t;st.classList.add('on');clearTimeout(tmo);tmo=setTimeout(function(){st.classList.remove('on');st.textContent=''},/^⏭/.test(t)?3000:6000)}
    };
    try{new MutationObserver(upd).observe(ps,{childList:true,characterData:true,subtree:true})}catch(e){}
  }

  // ---- v1.0.36 inline insert-search (เพลงแทรก) ----
  function inPool(s,id){
    // same pool as the library sheet (catalog rules untouched) + the user's own imports + today's list
    if(!(typeof CAT!=='undefined'&&CAT&&CAT.length))return true;
    return !!(s&&(s.X||SET.includes(id)||inPool.cat(s)));
  }
  inPool.cat=function(s){if(inPool._c!==CAT||inPool._n!==CAT.length){inPool._c=CAT;inPool._n=CAT.length;inPool._s=new Set(CAT)}return inPool._s.has(s)};
  function searchSongs(q){
    const k=typeof sq==='function'?sq(q):String(q||'').toLowerCase().replace(/\s+/g,'');
    if(!k)return [];
    const out=[];
    for(const [id,s] of SONG){
      if(out.length>=40)break;
      if(!s||!inPool(s,id))continue;
      try{if(typeof libHidden149==='function'&&libHidden149(id))continue}catch(e){}
      const hay=(typeof sq==='function')?sq((s.t||'')+(s.a||'')):String((s.t||'')+(s.a||'')).toLowerCase();
      if(hay.indexOf(k)>=0)out.push(id);
    }
    return out;
  }
  function insertNext(id){
    if(!id||!SONG.get(id))return;
    const ref=slot(DUAL.last||DUAL.audible||'A').id;
    const i0=SET.indexOf(id);
    if(i0>=0)SET.splice(i0,1);
    let at=ref?SET.indexOf(ref):-1;
    at=at>=0?at+1:0;
    SET.splice(at,0,id);
    try{saveSet()}catch(e){}
    try{if(typeof renderSoon==='function')renderSoon()}catch(e){}
    try{const s=SONG.get(id);toast('แทรกต่อจากเพลงที่เล่น: '+(s&&s.t||''),1600,true)}catch(e){}
    try{cueNext()}catch(e){}
    paintList();paintRes();
  }
  // v1.0.38: after an insert the idle deck must hold the list's next song (it used to keep the song loaded before the insert,
  // so ▶ on that deck / the next song played the old one). Never touches a playing deck or a song the Pad is holding.
  function cueNext(){
    if(!DUAL.on)return null;
    let w=whichOf(DUAL.last||DUAL.audible||'A');
    if(!slot(w).playing){if(DUAL.a.playing)w='A';else if(DUAL.b.playing)w='B'}
    const ref=slot(w);
    const idle=ref.id?(w==='A'?'B':'A'):w;
    const sl=slot(idle);
    const i=ref.id?SET.indexOf(ref.id):-1;
    const nx=ref.id?(i>=0?SET[i+1]:null):SET[0];
    if(!nx||!SONG.get(nx)||sl.playing||sl.id===nx)return null;
    try{if(typeof PAD!=='undefined'&&PAD&&sl.id&&(PAD.hold===sl.id||(PAD.on&&PAD.sid===sl.id)))return null}catch(e){}
    loadInto(idle,nx,false);
    return idle;
  }
  function paintRes(){
    const box=$el('dd-res'),q=$el('dd-q'),x=$el('dd-qx'),wrap=$el('dd-listwrap');
    if(!box||!q)return;
    const v=(q.value||'').trim();
    if(x)x.hidden=!v;
    if(wrap)wrap.classList.toggle('dd-searching',!!v);
    if(!v){box.hidden=true;box.innerHTML='';box._sig='';return}
    const ids=searchSongs(v);
    const sig=v+'|'+ids.join(',')+'|'+SET.length+'|'+DUAL.a.id+'|'+DUAL.b.id;
    box.hidden=false;
    if(box._sig===sig)return;box._sig=sig;
    if(!ids.length){box.innerHTML='<div class="dd-empty">ไม่พบเพลง “'+esc(v)+'” ในคลัง</div>';return}
    box.innerHTML=ids.map(function(id){
      const s=SONG.get(id)||{},inSet=SET.includes(id),nf=!!(s&&s._nf);
      return '<div class="dd-song dd-r'+(nf?' nf107':'')+'" data-rid="'+esc(id)+'"><div class="ti"><div class="t">'+esc(s.t||id)+'</div><div class="a">'+esc(s.a||'')+(inSet?' · <span class="in">อยู่ในลิสต์</span>':'')+(nf?' · <span class="in">ยังเล่นไม่ได้</span>':'')+'</div></div>'+
        '<div class="btns"><button type="button" data-ins="1" aria-label="แทรกเป็นเพลงถัดไป" title="แทรกถัดไป">'+I.ins+'</button>'+
        '<button type="button" data-to="A" aria-label="ใส่เด็ค A">A</button><button type="button" data-to="B" aria-label="ใส่เด็ค B">B</button>'+
        '<button type="button" data-libdel="1" aria-label="ลบจากคลัง" title="ลบจากคลัง">🗑</button></div></div>';
    }).join('');
  }
  function bindSearch(){
    const q=$el('dd-q'),x=$el('dd-qx'),box=$el('dd-res');if(!q||q._b)return;q._b=1;
    {const lb=$el('dd-qlib');if(lb&&!lb._bound){lb._bound=1;lb.addEventListener('pointerdown',function(e){e.stopPropagation()});lb.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();DUAL.pick=null;try{if(window.__op18&&__op18.openLib)__op18.openLib()}catch(err){}})}}
    q.addEventListener('input',paintRes);
    q.addEventListener('keydown',function(e){if(e.key==='Escape'){q.value='';paintRes();q.blur()}});
    if(x)x.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();q.value='';paintRes()});
    if(box)box.addEventListener('click',function(e){
      const r=e.target.closest('[data-rid]');if(!r)return;
      e.preventDefault();e.stopPropagation();
      const id=r.getAttribute('data-rid');
      if(e.target.closest('[data-libdel]')){try{libDel145(id).then(function(ok){if(ok){q.value='';paintRes();paintList()}})}catch(err){}return}
      const b=e.target.closest('button');
      if(b&&b.dataset.to){if(!SET.includes(id)){try{insertNext(id)}catch(err){}}loadInto(b.dataset.to,id,false);q.value='';paintRes();return}
      insertNext(id);
    });
  }

  // ---- v1.0.36 today list: tap = load idle deck, grip = drag reorder (order only), long-press = song menu ----
  function bindList(){
    const box=$el('dd-list');if(!box||box._b)return;box._b=1;
    let lp=0,lpX=0,lpY=0,drag=null;
    box.addEventListener('click',function(e){
      const row=e.target.closest('.dd-song');if(!row)return;
      e.stopPropagation();
      if(box._lpFired){box._lpFired=0;return}
      const id=row.getAttribute('data-sid');
      const b=e.target.closest('button');
      if(b&&b.dataset.to){loadInto(b.dataset.to,id,false);return}
      if(b&&b.dataset.more){try{if(window.__op18&&__op18.openRowMore)__op18.openRowMore(id)}catch(err){}return}
      if(b&&b.classList.contains('dd-grip'))return;
      songTap(id,false);
    });
    box.addEventListener('pointerdown',function(e){
      const g=e.target.closest('.dd-grip');
      const row=e.target.closest('.dd-song');if(!row)return;
      if(g){
        e.preventDefault();
        const rows=[...box.querySelectorAll('.dd-song')];
        const from=rows.indexOf(row);if(from<0)return;
        // v1.0.48: arm only after ~16px move (same as Tonight ☰)
        drag={row:row,from:from,to:from,y0:e.clientY,h:row.getBoundingClientRect().height||48,n:rows.length,pid:e.pointerId,rows:rows,armed:false};
        try{g.setPointerCapture(e.pointerId)}catch(err){}
        return;
      }
      if(e.target.closest('button'))return;
      lpX=e.clientX;lpY=e.clientY;clearTimeout(lp);
      lp=setTimeout(function(){lp=0;box._lpFired=1;try{if(navigator.vibrate)navigator.vibrate(8)}catch(err){}try{if(window.__op18&&__op18.openRowMore)__op18.openRowMore(row.getAttribute('data-sid'))}catch(err){}},520);
    });
    box.addEventListener('pointermove',function(e){
      if(lp&&Math.hypot(e.clientX-lpX,e.clientY-lpY)>10){clearTimeout(lp);lp=0}
      if(!drag||e.pointerId!==drag.pid)return;
      e.preventDefault();
      if(!drag.armed){if(Math.abs(e.clientY-drag.y0)<16)return;drag.armed=true;drag.y0=e.clientY;drag.row.classList.add('dragging')}
      const dy=e.clientY-drag.y0;
      const to=Math.max(0,Math.min(drag.n-1,drag.from+Math.round(dy/drag.h)));
      drag.to=to;
      drag.row.style.transform='translateY('+dy+'px)';
      drag.rows.forEach(function(r,i){
        if(r===drag.row)return;
        let s=0;
        if(drag.from<to&&i>drag.from&&i<=to)s=-drag.h;
        else if(drag.from>to&&i<drag.from&&i>=to)s=drag.h;
        r.style.transform=s?'translateY('+s+'px)':'';
      });
    });
    const end=function(e){
      clearTimeout(lp);lp=0;
      if(!drag||(e&&e.pointerId!==drag.pid))return;
      const d=drag;drag=null;
      d.rows.forEach(function(r){r.style.transform='';r.classList.remove('dragging')});
      if(d.armed&&d.to!==d.from)moveSet(d.from,d.to);
    };
    box.addEventListener('pointerup',end);
    box.addEventListener('pointercancel',end);
    box.addEventListener('contextmenu',function(e){if(e.target.closest('.dd-song'))e.preventDefault()});
  }
  function moveSet(from,to){
    if(from===to||from<0||to<0||from>=SET.length||to>=SET.length)return false;
    const id=SET.splice(from,1)[0];
    SET.splice(to,0,id);
    try{saveSet()}catch(e){}
    try{if(typeof renderSoon==='function')renderSoon()}catch(e){}
    const box=$el('dd-list');if(box)box._sig='';
    paintList();
    return true;
  }

  // ---- v1.0.36 นอมสด block (drives metro.js; one engine) + มิกซ์ร้าน block ----
  function bindDock(){
    const go=$el('dd-mgo'),tap=$el('dd-mtap'),up=$el('dd-mup'),dn=$el('dd-mdn'),out=$el('dd-mout'),mx=$el('dd-mxset');
    if(!go||go._b)return;go._b=1;
    const M=function(){return window.__metro||null};
    go.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();const m=M();if(m&&m.toggle)Promise.resolve(m.toggle()).then(paintDock,paintDock);paintDock()});
    const step=function(d){const m=M();if(!m)return;m.setBpm((m.S.bpm||100)+d);paintDock()};
    const rep=function(btn,d){
      let t=0,iv=0;
      const stop=function(){clearTimeout(t);clearInterval(iv);t=iv=0};
      btn.addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();step(d);stop();t=setTimeout(function(){iv=setInterval(function(){step(d)},90)},420)});
      ['pointerup','pointercancel','pointerleave'].forEach(function(ev){btn.addEventListener(ev,stop)});
      btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation()});
      btn.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();step(d)}});
    };
    rep(up,1);rep(dn,-1);
    // TAP fires on pointerdown (no click delay) with an immediate pressed state.
    const press=function(){tap.classList.remove('hit');void tap.offsetWidth;tap.classList.add('hit','press');try{if(navigator.vibrate)navigator.vibrate(6)}catch(err){}};
    tap.addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();press();const m=M();if(m&&m.tap)m.tap();tap._tapAt=Date.now();paintDock()});
    ['pointerup','pointercancel','pointerleave'].forEach(function(ev){tap.addEventListener(ev,function(){tap.classList.remove('press')})});
    tap.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(Date.now()-(tap._tapAt||0)<600)return;press();const m=M();if(m&&m.tap)m.tap();setTimeout(function(){tap.classList.remove('press')},120);paintDock()});
    tap.addEventListener('animationend',function(){tap.classList.remove('hit')});
    out.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();const m=M();if(!m||!m.setOut)return;const o=m.S.out||'both';m.setOut(o==='both'?'left':o==='left'?'right':'both');paintDock()});
    mx.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openMixSheet()});
    const hook=function(){const m=M();if(!m||!m.on){setTimeout(hook,300);return}m.on(function(b){if(b==null){paintDock();return}beatHit(b)})};
    hook();
  }
  function beatHit(b){
    const box=$el('dd-beats');if(!box)return;
    const ds=box.children;
    for(let i=0;i<ds.length;i++)ds[i].classList.toggle('hit',i===b);
  }
  const OUTLAB={left:'ซ้าย',right:'ขวา',both:'ทั้งคู่'};
  function paintDock(){
    const m=window.__metro;if(!m||!m.S)return;
    const S=m.S,run=!!(m.state&&m.state.running);
    const g=$el('dd-mgo');
    if(g){g.innerHTML=run?I.pause:I.play;g.classList.toggle('on',run);g.setAttribute('aria-pressed',run?'true':'false');g.setAttribute('aria-label',run?'หยุดนอมสด':'เริ่มนอมสด')}
    const b=$el('dd-mbpm');if(b&&b.textContent!==String(S.bpm))b.textContent=String(S.bpm);
    const sg=$el('dd-msig');if(sg){const sig=(m.sigs&&m.sigs[S.sig])||(S.sig+'/4');if(sg.textContent!==sig)sg.textContent=sig}
    const o=$el('dd-mout');if(o){const lab='ออก '+(S.out==='left'?'L':S.out==='right'?'R':'L+R');o.setAttribute('aria-label','นอมสดออก '+(OUTLAB[S.out]||'ทั้งคู่')+' — แตะเพื่อเปลี่ยน');if(o.textContent!==lab)o.textContent=lab;o.classList.toggle('on',S.out!=='both')}
    const bx=$el('dd-beats');if(bx&&bx.children.length!==(+S.sig||4)){bx.innerHTML=Array.from({length:+S.sig||4},function(_,i){return '<i class="'+(i===0&&S.sig>1?'acc':'')+'"></i>'}).join('')}
    if(bx&&!run)[...bx.children].forEach(function(c){c.classList.remove('hit')});
    const blk=$el('dd-metro');if(blk)blk.classList.toggle('on',run);
    paintMixer();
  }
  function audioCaps(){
    const AC=window.AudioContext||window.webkitAudioContext;
    let sink=false,midi=false,maxCh=2;
    try{sink=!!(AC&&AC.prototype&&('setSinkId' in AC.prototype))}catch(e){}
    try{midi=typeof navigator.requestMIDIAccess==='function'}catch(e){}
    try{if(ctx&&ctx.destination)maxCh=ctx.destination.maxChannelCount||2}catch(e){}
    let mo=false;try{mo=!!(typeof MO!=='undefined'&&MO&&MO.cfg&&MO.cfg.on)}catch(e){}
    let sinkLab='';try{sinkLab=(typeof MO!=='undefined'&&MO&&MO.cfg&&(MO.cfg.label||MO.cfg.sinkLabel))||''}catch(e){}
    const ua=navigator.userAgent||'';
    const ios=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&'ontouchend' in document);
    const android=/Android/.test(ua);
    return {sink:sink,midi:midi,maxCh:maxCh,mo:mo,sinkLab:sinkLab,ios:ios,android:android};
  }
  function paintMixer(){
    const m=window.__metro,c=audioCaps();
    const out=m&&m.S?m.S.out:'both';
    const chs=$el('dd-chs');
    if(chs){
      const l1='<b>นอมสด</b> → '+(out==='left'?'ซ้าย (L)':out==='right'?'ขวา (R)':'ทั้งสองข้าง');
      const l2='<b>เพลง</b> → '+(c.mo?'แยกหลายช่อง (สตูดิโอ)':'สเตอริโอ L/R')+(c.midi?' · MIDI ✓':'');
      const h='<span>'+l1+'</span><span>'+l2+'</span>';
      if(chs._h!==h){chs._h=h;chs.innerHTML=h}
    }
    const p=$el('dd-mxp');
    if(p){const lab=out!=='both'?'แยก L/R':'สเตอริโอ';if(p.textContent!==lab)p.textContent=lab;p.classList.toggle('ok',out!=='both')}
  }
  function openMixSheet(){
    let sh=$el('dd-mxsheet');
    if(!sh){
      sh=document.createElement('div');sh.id='dd-mxsheet';sh.setAttribute('role','dialog');sh.setAttribute('aria-label','ต่อกับมิกซ์ร้าน');
      document.body.appendChild(sh);
      sh.addEventListener('click',function(e){
        if(e.target===sh){closeMixSheet();return}
        const b=e.target.closest('button');if(!b)return;
        e.preventDefault();e.stopPropagation();
        if(b.dataset.x!=null)closeMixSheet();
        else if(b.dataset.mout){try{__metro.setOut(b.dataset.mout)}catch(err){}renderMixSheet();paintDock()}
        else if(b.dataset.go==='mo'){closeMixSheet();try{__op18.openSettings();setTimeout(function(){const s=document.getElementById('mosec');if(s&&s.scrollIntoView)s.scrollIntoView({block:'start'})},280)}catch(err){}}
        else if(b.dataset.go==='midi'){closeMixSheet();try{if(typeof midiOpen==='function')midiOpen()}catch(err){}}
        else if(b.dataset.go==='metro'){closeMixSheet();try{if(window.__op18&&__op18.openMetro)__op18.openMetro()}catch(err){}}
      });
    }
    renderMixSheet();
    sh.hidden=false;document.body.classList.add('dd-mxopen');
  }
  function closeMixSheet(){const sh=$el('dd-mxsheet');if(sh)sh.hidden=true;document.body.classList.remove('dd-mxopen')}
  function renderMixSheet(){
    const sh=$el('dd-mxsheet');if(!sh)return;
    const c=audioCaps(),m=window.__metro,out=m&&m.S?m.S.out:'both';
    const yes=function(ok,y,n){return '<span class="cap '+(ok?'y':'n')+'">'+(ok?'✓ ':'✕ ')+(ok?y:n)+'</span>'};
    const dev=c.ios?'iPhone / iPad':c.android?'Android':'คอมพิวเตอร์';
    sh.innerHTML='<div class="dd-mxbox">'+
      '<div class="dd-mxt"><b>'+I.plug+' ต่อกับมิกซ์ร้าน</b><button type="button" class="dd-hb" data-x aria-label="ปิด">'+I.x+'</button></div>'+
      '<p class="dd-mxdev">เครื่องนี้: <b>'+dev+'</b> — แสดงเฉพาะสิ่งที่ SetSod ทำได้จริงในเครื่องนี้</p>'+
      '<section><h3>1 · นอมสดออกช่องไหน</h3><p>เสียบสายแยก L/R เข้ามิกซ์ 2 ช่อง: ให้นอมออกข้างหนึ่ง เพลงอีกข้าง หรือออกทั้งคู่</p>'+
        '<div class="dd-seg">'+['left','both','right'].map(function(o){return '<button type="button" data-mout="'+o+'" class="'+(out===o?'on':'')+'" aria-pressed="'+(out===o)+'">'+(o==='left'?'ซ้าย L':o==='right'?'ขวา R':'ทั้งคู่')+'</button>'}).join('')+'</div>'+
        yes(true,'ใช้ได้ทุกเครื่อง','')+'</section>'+
      '<section><h3>2 · เพลงที่มีนอมในไฟล์ (นอมซ้าย / นอมขวา)</h3><p>เด็คเล่นแยกช่องตามไฟล์ และตามที่ตั้งไว้ในมิกเซอร์ของเพลง ถ้าสายสลับข้าง กด ⋯ ที่เด็ค → “สลับ L/R” (บันทึกกับเพลง)</p>'+yes(true,'ใช้ได้ทุกเครื่อง','')+'</section>'+
      '<section><h3>3 · การ์ดเสียง / แยกหลายช่อง (MO)</h3><p>เลือกอุปกรณ์เสียงออก และแยกนอม/เพลงเกิน 2 ช่อง ใช้กับเครื่องเล่นเดี่ยวในสตูดิโอ — หน้า 2 เด็คส่งออกสเตอริโอ L/R</p>'+
        yes(c.sink,'เลือกอุปกรณ์เสียงออกได้ในเครื่องนี้','เครื่องนี้เลือกอุปกรณ์เสียงออกไม่ได้ (Safari/iPhone ไม่รองรับ) — ใช้สาย L/R แทน')+
        '<span class="cap '+(c.maxCh>2?'y':'n')+'">'+(c.maxCh>2?'✓ ':'• ')+'ตอนนี้ส่งออกได้ '+c.maxCh+' ช่อง</span>'+
        (c.mo?'<span class="cap y">✓ เปิดแยกหลายช่องอยู่</span>':'')+
        '<button type="button" class="dd-mxgo" data-go="mo"'+(c.sink?'':' disabled')+'>'+I.sliders+' ตั้งค่าแยกช่อง</button></section>'+
      '<section><h3>4 · คอนโทรลเลอร์ MIDI / แป้นเหยียบ</h3><p>ผูกปุ่มเล่น/หยุด/ถัดไป กับคอนโทรลเลอร์หรือแป้นเหยียบ</p>'+
        yes(c.midi,'รองรับ MIDI ในเครื่องนี้','เครื่องนี้ไม่รองรับ Web MIDI — แป้นเหยียบบลูทูธแบบคีย์บอร์ดยังใช้ได้')+
        '<button type="button" class="dd-mxgo" data-go="midi"'+(c.midi?'':' disabled')+'>ตั้งปุ่ม MIDI</button></section>'+
      '<p class="dd-mxfoot">ยังไม่รองรับการควบคุมดิจิทัลมิกซ์ของร้าน</p>'+
      '<button type="button" class="dd-mxgo alt" data-go="metro">ตั้งค่านอมเพิ่มเติม (เสียงคลิก/ห้องเพลง/ความดัง)</button>'+
    '</div>';
  }

  function pickLoad(w){
    DUAL.pick=whichOf(w);
    try{if(typeof closeMenu==='function')closeMenu()}catch(e){}
    try{if(window.__op18&&__op18.openLib)__op18.openLib();else if(typeof openLib==='function')openLib()}catch(e){}
    try{toast('เลือกเพลงใส่เด็ค '+DUAL.pick,2000,true)}catch(e){}
  }
  function idleDeck(){
    if(!DUAL.a.id)return 'A';
    if(!DUAL.b.id)return 'B';
    return idleOf();
  }
  function songTap(id,play){
    if(!DUAL.on||!id||!SONG.get(id))return false;
    if(DUAL.a.id===id||DUAL.b.id===id){
      const w=DUAL.a.id===id?'A':'B';
      DUAL.last=w;DUAL.audible=w;
      if(play)playDeck(w);
      else paint();
      return true;
    }
    const w=DUAL.pick||idleDeck();
    DUAL.pick=null;
    loadInto(w,id,!!play);
    return true;
  }
  function libIntercept(e){
    if(!DUAL.on)return;
    const t=e.target.closest('[data-play],[data-sid],#main [data-id],.sc[data-sid],#livelist [data-sid],.dd-song');
    if(!t)return;
    if(e.target.closest('[data-p65],[data-dd],.dd-song button,#op-studio,#op-dualui,[data-op36id],.op36ab'))return;
    const id=t.getAttribute('data-play')||t.getAttribute('data-sid')||t.getAttribute('data-id')||t.dataset.play||t.dataset.sid||t.dataset.id;
    if(!id||!SONG.get(id))return;
    e.preventDefault();e.stopPropagation();
    try{if(typeof closeSheet==='function')closeSheet();document.body.classList.remove('sheet-open')}catch(err){}
    songTap(id,false);
  }

  async function loadInto(w,id,play){
    w=whichOf(w);
    if(!id||!SONG.get(id))return;
    const sl=slot(w);
    const same=sl.id===id&&sl.buf;
    assignId(sl,id);
    if(!same){sl.offset=(typeof trS==='function'?trS(id):0)||0;sl.ended=false} // v1.0.40: a freshly loaded deck rests at the song's start mark
    if(!SET.includes(id)){try{SET.push(id)}catch(e){}}
    sl.err=null;
    try{const b=await bufOf(id);if(sl.id===id&&b)sl.buf=b;
      // v1.0.39: a failed load is shown on the deck (and never leaves the previous song's audio behind)
      else if(sl.id===id&&!b){if(!sl.playing)sl.buf=null;const m=(DUAL.lastErr&&DUAL.lastErr.id===id&&DUAL.lastErr.msg)||'โหลดไม่สำเร็จ';sl.err=m;
        const s0=SONG.get(id);try{toast('❌ เด็ค '+w+' โหลด “'+((s0&&s0.t)||'เพลง')+'” ไม่ได้ — '+m,6000)}catch(e){}paint();return}}catch(e){}
    try{cacheCap(id)}catch(e){}
    if(play)startSlot(w,sl.offset||((typeof trS==='function'?trS(id):0)||0));
    paint();
  }

  function afterLoad(id){
    if(!DUAL.on||!id)return;
    let w;
    if(DUAL.expect==='A'||DUAL.expect==='B'){
      w=DUAL.expect;DUAL.expect=null;
    }else if(DUAL.a.id===id)w='A';
    else if(DUAL.b.id===id)w='B';
    else w=DUAL.audible||'A';
    assignId(slot(w),id);
    DUAL.audible=w;DUAL.last=w;
    paint();
  }
  function expectHold(id){
    if(DUAL.a.id===id)DUAL.expect='A';
    else if(DUAL.b.id===id)DUAL.expect='B';
  }

  function playDeck(w){
    w=whichOf(w);
    const sl=slot(w);
    if(!sl.id){try{toast('โหลดเพลงเข้าเด็ค '+w+' ก่อน',1800)}catch(e){}return}
    if(sl.playing){stopSlot(w);paint();return}
    const g=xfGains(DUAL.xf);
    if((w==='A'&&g.a<0.05)||(w==='B'&&g.b<0.05)){
      try{toast('เลื่อนครอสเฟดเดอร์เพื่อได้ยินเด็ค '+w,2200,true)}catch(e){}
    }
    DUAL.last=w;
    if((w==='A'?g.a:g.b)>=0.05)DUAL.audible=w;
    if(sl.buf)startSlot(w,sl.ended?((typeof trS==='function'?trS(sl.id):0)||0):sl.offset);
    else loadInto(w,sl.id,true);
    try{syncFocus()}catch(e){}
    paint();
  }
  function xfTo(w){
    w=whichOf(w);
    const sl=slot(w);
    if(!sl.id)return;
    setKnob(w==='B'?1:0);
    DUAL.last=w;DUAL.audible=w;
    if(!sl.playing){
      if(sl.buf)startSlot(w,sl.offset||((typeof trS==='function'?trS(sl.id):0)||0));
      else loadInto(w,sl.id,true);
    }else syncFocus();
    paint();
  }
  function cueDeck(w){
    w=whichOf(w);
    const sl=slot(w);if(!sl.id)return;
    const at=(typeof trS==='function'?trS(sl.id):0)||0;
    sl.offset=at;sl.ended=false;
    if(sl.playing)startSlot(w,at);
    DUAL.last=w;syncFocus();
    paint();
  }
  function stepDeck(w,dir){
    w=whichOf(w);
    const sl=slot(w);
    const id=sl.id;
    const i=id?SET.indexOf(id):-1;
    let n=null;
    if(i>=0)n=SET[i+dir];
    else if(SET.length)n=dir>0?SET[0]:SET[SET.length-1];
    if(!n){try{toast(dir>0?'ไม่มีเพลงถัดไป':'นี่คือเพลงแรก',1500)}catch(e){}return}
    const play=!!sl.playing;
    if(play)stopSlot(w);
    loadInto(w,n,play);
  }
  function keyDeck(w,d){
    w=whichOf(w);
    const sl=slot(w);if(!sl.id)return;
    const k=Math.max(-6,Math.min(6,(deckPref(sl).key||0)+d));
    setDeckLive(sl,{key:k});
    applySlotPref(sl.id,{key:k});
    try{if(PAD.on&&(PAD.sid===sl.id||(cur&&cur.id===sl.id)))padRetune2()}catch(e){}
    paintDeck(w);
    keySave43(sl.id,k);
  }
  // v1.0.43: deck key −/+ is SAVED with the song (→ band live list → every member), debounced; tempo ± stays temporary (💾).
  // Only the song that was on the deck at the tap, only the key field, never a default written back.
  const KS43=new Map();
  function keySave43(id,k){
    if(!id||typeof k!=='number'||!isFinite(k))return;
    const o=KS43.get(id)||{};clearTimeout(o.t);o.k=Math.max(-12,Math.min(12,Math.round(k)));
    o.t=setTimeout(()=>keyFlush43(id),600);KS43.set(id,o);
  }
  async function keyFlush43(id){
    const o=KS43.get(id);KS43.delete(id);if(!o||!id)return;
    let saved=null;try{saved=(pref(id)||{}).key||0}catch(e){}
    if(saved===o.k){try{dropLive(id,{key:1});const w=deckOf(id);if(w)paintDeck(w)}catch(e){}return}
    try{await orig.setPrefFor(id,{key:o.k})}catch(e){try{toast('⚠️ บันทึกคีย์ไม่สำเร็จ',2000)}catch(_){}return}
    try{const w=deckOf(id);if(w){const sl=slot(w);if(sl.id===id&&sl.live&&'key' in sl.live&&sl.live.key===o.k){delete sl.live.key;if(!Object.keys(sl.live).length)sl.live=null}paintDeck(w)}}catch(e){}
    try{keyToast43(id)}catch(e){}
  }
  function keyFlushAll43(){for(const id of [...KS43.keys()]){const o=KS43.get(id);clearTimeout(o&&o.t);keyFlush43(id)}}
  try{window.addEventListener('pagehide',keyFlushAll43);document.addEventListener('visibilitychange',()=>{if(document.hidden)keyFlushAll43()})}catch(e){}
  function tempoDeck(w,d){
    w=whichOf(w);
    const sl=slot(w);if(!sl.id)return;
    const id=sl.id,t0=deckPref(sl).tempo||100,b=typeof baseBpm==='function'?baseBpm(id):0;
    let t=b?(Math.round(b*t0/100)+d)/b*100:t0+d;
    t=Math.max(50,Math.min(150,Math.round(t*2)/2));
    setDeckLive(sl,{tempo:t});
    applySlotPref(id,{tempo:t});
    paintDeck(w);
  }
  function padDeck(w){
    w=whichOf(w);
    const sl=slot(w);
    if(!sl.id){try{toast('โหลดเพลงเข้าเด็ค '+w+' ก่อน',1800)}catch(e){}return}
    try{
      if(!songKey(sl.id)){
        KEYD[sl.id]=KEYD[sl.id]&&KEYD[sl.id].r!=null?KEYD[sl.id]:{r:0,m:0};
        const s=SONG.get(sl.id);if(s&&!s.k)s.k='C';
      }
    }catch(e){}
    try{padToggle(sl.id)}catch(e){}
    try{routePad(w)}catch(e){}
    paint();
  }
  function routePad(w){
    if(!(typeof PAD!=='undefined'&&PAD.g))return;
    w=whichOf(w||deckOf(PAD.sid||PAD.hold)||DUAL.last);
    const sl=slot(w);
    if(!ensureBus(sl))return;
    try{PAD.g.disconnect()}catch(e){}
    try{PAD.g.connect(sl.bus.eqL)}catch(e){}
  }
  function metroDeck(w){
    // v1.0.36: sets the on-page นอมสด block to this deck's BPM (no page switch).
    w=whichOf(w);
    const sl=slot(w);
    let bpm=null;
    try{bpm=sl.id?deckBpm(sl):null}catch(e){}
    if(!bpm){try{toast('เด็ค '+w+' ยังไม่มี BPM — ใช้ TAP ที่นอมสด',2000)}catch(e){}return}
    try{if(window.__metro&&__metro.setBpm)__metro.setBpm(bpm)}catch(e){}
    try{toast('นอมสด = '+Math.round(bpm)+' BPM (ตามเด็ค '+w+')',1600,true)}catch(e){}
    try{paintDock()}catch(e){}
  }
  function fadeDeck(w){
    w=whichOf(w);
    const sl=slot(w);
    if(!sl.id){try{toast('โหลดเพลงเข้าเด็ค '+w+' ก่อน',1800)}catch(e){}return}
    if(!sl.playing){try{toast('เล่นเด็คนี้ก่อนถึงจะเฟดออก',1800)}catch(e){}return}
    fadeSlot(w);
    paint();
  }
  function nudgeDeck(w,sec){
    w=whichOf(w);
    const sl=slot(w);
    if(!sl.id||!sl.buf){try{toast('เล่นเด็คนี้ก่อน',1500)}catch(e){}return}
    const d=sl.buf.duration, at=Math.max(0,Math.min(d-0.05,posOf(sl)+(+sec||0)));
    if(sl.playing)startSlot(w,at);else sl.offset=at;
    DUAL.last=w;syncFocus();
    paintDeck(w);
  }
  function moreDeck(w){
    w=whichOf(w);
    const id=slot(w).id;
    if(!id){try{toast('โหลดเพลงเข้าเด็ค '+w+' ก่อน',1800)}catch(e){}return}
    try{
      if(window.__op18&&__op18.openRowMore)__op18.openRowMore(id,true);
    }catch(e){}
  }
  function setDeckVol(w,v){
    w=whichOf(w);const sl=slot(w);
    sl.vol=Math.max(0,Math.min(1,+v||0));
    ensureBus(sl);applyVol(sl);
  }
  function setDeckEq(w,band,val){
    w=whichOf(w);const sl=slot(w);
    const k=band==='m'||band==='mid'?'m':band==='h'||band==='hi'||band==='high'?'h':'l';
    sl.eq=sl.eq||{l:0,m:0,h:0};
    sl.eq[k]=Math.max(-12,Math.min(12,+val||0));
    ensureBus(sl);applyEq(sl);
  }
  function syncDeck(w){
    // v1.0.36: SYNC on deck w matches w's tempo to the other deck (no argument = B follows A, as before).
    w=w?whichOf(w):'B';
    const o=w==='A'?'B':'A';
    const me=slot(w),ot=slot(o);
    if(!me.id||!ot.id){try{toast('โหลดเพลงทั้งสองเด็คก่อน',1800)}catch(e){}return}
    const ro=deckBpm(ot);
    const bm=typeof baseBpm==='function'?baseBpm(me.id):null;
    if(!ro||!bm){try{toast('ยังไม่มี BPM ของเด็ค A หรือ B',2200)}catch(e){}return}
    const t=Math.max(50,Math.min(150,Math.round((ro/bm)*100*2)/2));
    setDeckLive(me,{tempo:t});
    applySlotPref(me.id,{tempo:t});
    me.synced={id:me.id,t:t,o:ot.id}; // v1.0.38: SYNC is manual only - the button lights only after a tap
    try{toast('SYNC · เด็ค '+w+' = '+Math.round(ro)+' BPM',1800,true)}catch(e){}
    paintDeck(w);paintDeck(o);
  }

  function cycleXf(){
    const curXf=+(AUTO&&AUTO.xf||0);
    const next=curXf<=0?2:curXf<4?4:curXf<8?8:0;
    AUTO.xf=next;
    try{saveAuto()}catch(e){}
  }
  function setKnob(v){
    DUAL.xf=Math.max(0,Math.min(1,v));
    applyXf();
    const k=$el('dd-xfknob'),xf=$el('dd-xf');
    if(k)k.style.left=(DUAL.xf*100)+'%';
    if(xf)xf.setAttribute('aria-valuenow',String(Math.round(DUAL.xf*100)));
  }
  function bindXf(){
    const el=$el('dd-xf');if(!el||el._bound)return;el._bound=1;
    let drag=false,lastTap=0,lastV=0,ptr=0;
    function pt(ev){
      if(ev.touches&&ev.touches[0])return ev.touches[0];
      return ev;
    }
    function at(ev){
      const r=el.getBoundingClientRect();
      const p=pt(ev);
      const x=p.clientX-r.left;
      return r.width?Math.max(0,Math.min(1,x/r.width)):0.5;
    }
    function isKnob(ev){const t=ev.target;return !!(t&&t.closest&&t.closest('#dd-xfknob'))}
    function start(ev){
      const v=at(ev),now=Date.now();
      if(isKnob(ev)&&now-lastTap<350&&Math.abs(v-lastV)<0.2){
        drag=false;lastTap=0;setKnob(0.5);try{ev.preventDefault()}catch(e){}return;
      }
      lastTap=now;lastV=v;drag=true;if(ev.pointerId!=null)ptr=ev.pointerId;
      setKnob(v);try{ev.preventDefault()}catch(e){}
    }
    function move(ev){if(!drag)return;if(ev.pointerId!=null&&ptr&&ev.pointerId!==ptr)return;setKnob(at(ev));try{ev.preventDefault()}catch(e){}}
    function end(ev){if(ev&&ev.pointerId!=null&&ptr&&ev.pointerId!==ptr)return;drag=false;ptr=0}
    el.addEventListener('pointerdown',start);
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',end);
    window.addEventListener('pointercancel',end);
    if(!window.PointerEvent){
      el.addEventListener('touchstart',start,{passive:false});
      window.addEventListener('touchmove',move,{passive:false});
      window.addEventListener('touchend',end);
    }
  }
  function bindWaves(){
    ['A','B'].forEach(function(w){
      const el=$el('dd-'+w+'-wave');if(!el||el._bound)return;el._bound=1;
      el.addEventListener('click',function(e){
        const sl=slot(w);
        if(!sl.id||!sl.buf)return;
        const r=el.getBoundingClientRect();
        const f=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
        const m=markOf(sl),at=Math.min(m.d-0.05,m.ts+f*m.len);
        if(sl.playing)startSlot(w,at);else sl.offset=at;
        DUAL.last=w;syncFocus();
        paintDeck(w);
      });
    });
  }

  // ---- v1.0.36 platter: ring waveform from real peaks, rotates so "now" sits under the top needle ----
  const RING=new Map(),RN=180;
  function ringOf(id,buf){
    if(!id)return null;
    const k=id+'|'+(buf?buf.length:0);
    if(RING.has(k))return RING.get(k);
    let a=null;
    try{
      if(buf&&typeof buf.getChannelData==='function'&&typeof peaks==='function'){
        const P=peaks(id,buf),L=P[0],R=P[1]||P[0],n=L.length;a=new Float32Array(RN);let mx=0;
        for(let i=0;i<RN;i++){let m=0;const s=Math.floor(i*n/RN),e=Math.max(s+1,Math.floor((i+1)*n/RN));for(let j=s;j<e;j++){const v=Math.max(L[j],R[j]);if(v>m)m=v}a[i]=m;if(m>mx)mx=m}
        if(mx<0.005)a=null;else for(let i=0;i<RN;i++)a[i]=Math.min(1,a[i]/mx);
      }
    }catch(e){a=null}
    if(!a){
      a=new Float32Array(RN);let seed=0;for(let i=0;i<id.length;i++)seed=(seed*31+id.charCodeAt(i))>>>0;
      for(let i=0;i<RN;i++){seed=(seed*1664525+1013904223)>>>0;a[i]=0.25+((seed&255)/255)*0.7}
      a._fake=1;
    }
    if(buf)RING.set(k,a);
    if(RING.size>12)RING.delete(RING.keys().next().value);
    return a;
  }
  function drawWave(w){
    const cv=$el('dd-'+w+'-cv');if(!cv)return;
    const el=cv.parentElement;
    const S=Math.min(el.clientWidth|0,el.clientHeight|0);
    const sl=slot(w),id=sl.id;
    let p=0,dur=0,frac=0,mf=0,elp=0,len=0;
    try{if(id&&sl.buf){p=posOf(sl);dur=sl.buf.duration;frac=dur?Math.max(0,Math.min(1,p/dur)):0;
      const m=markOf(sl);len=m.len;elp=Math.max(0,Math.min(p,m.te)-m.ts);mf=len?Math.max(0,Math.min(1,elp/len)):0}}catch(e){}
    // v1.0.38: seek strip, elapsed time and length follow the marks (length = end mark - start mark); the ring stays the whole file
    const ph=$el('dd-'+w+'-ph'),pr=$el('dd-'+w+'-prog');
    if(ph)ph.style.left=(mf*100)+'%';
    if(pr)pr.style.width=(mf*100)+'%';
    const tm=$el('dd-'+w+'-tm'),du=$el('dd-'+w+'-du');
    const ts=fmt2(elp),ds=fmt2(len);
    if(tm&&tm.textContent!==ts)tm.textContent=ts;
    if(du&&du.textContent!==ds)du.textContent=ds;
    if(S<24)return;
    const dpr=Math.min(2,window.devicePixelRatio||1),D=Math.round(S*dpr);
    if(cv.width!==D||cv.height!==D){cv.width=D;cv.height=D;cv.style.width=S+'px';cv.style.height=S+'px'}
    const g=cv.getContext('2d');
    g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,D,D);
    const c=D/2,R=D/2-1*dpr;
    const col=w==='A'?'#fb923c':'#60a5fa',dim=w==='A'?'rgba(251,146,60,.28)':'rgba(96,165,250,.28)';
    // platter body
    g.fillStyle='#101014';g.beginPath();g.arc(c,c,R,0,Math.PI*2);g.fill();
    const rIn=R*0.56,rOut=R*0.97;
    const ring=id?ringOf(id,sl.buf):null;
    const rot=-frac*Math.PI*2;
    if(ring){
      const n=ring.length,cut=Math.floor(frac*n),step=Math.PI*2/n;
      g.lineWidth=Math.max(1,(Math.PI*2*rOut/n)*0.62);g.lineCap='butt';
      for(let pass=0;pass<2;pass++){
        g.strokeStyle=pass?col:dim;g.beginPath();
        for(let i=0;i<n;i++){
          const played=i<cut;if(played!==!!pass)continue;
          const a=-Math.PI/2+rot+i*step,h=0.14+ring[i]*0.86;
          const r0=rIn+(rOut-rIn)*(1-h)*0.5,r1=rOut-(rOut-rIn)*(1-h)*0.5;
          const ca=Math.cos(a),sa=Math.sin(a);
          g.moveTo(c+ca*r0,c+sa*r0);g.lineTo(c+ca*r1,c+sa*r1);
        }
        g.stroke();
      }
    }else{
      g.strokeStyle='rgba(255,255,255,.08)';g.lineWidth=1*dpr;
      for(let k=0;k<4;k++){g.beginPath();g.arc(c,c,rIn+(rOut-rIn)*(k+0.5)/4,0,Math.PI*2);g.stroke()}
    }
    // vinyl label (spins with position) + groove marker
    const lr=R*0.5;
    g.fillStyle='#1b1b22';g.beginPath();g.arc(c,c,lr,0,Math.PI*2);g.fill();
    const spin=(p/1.8)*Math.PI*2;
    g.strokeStyle=id?col:'rgba(255,255,255,.18)';g.lineWidth=2*dpr;g.globalAlpha=0.8;
    g.beginPath();g.arc(c,c,lr*0.86,spin,spin+Math.PI*0.35);g.stroke();
    g.beginPath();g.arc(c,c,lr*0.86,spin+Math.PI,spin+Math.PI*1.35);g.stroke();
    g.globalAlpha=1;
    // needle at 12 o'clock
    g.fillStyle='#f8fafc';g.fillRect(c-1.2*dpr,0,2.4*dpr,(rOut-rIn)*0.9+R*0.04);
  }

  function paintDeck(w){
    w=whichOf(w);
    const el=$el('dd-'+w);if(!el)return;
    const sl=slot(w),id=sl.id,s=id&&SONG.get(id);
    el.classList.toggle('audible',DUAL.last===w&&!!id);
    el.classList.toggle('playing',!!sl.playing);
    el.classList.toggle('empty',!id);
    const t=$el('dd-'+w+'-t'),a=$el('dd-'+w+'-a');
    const tt=s?s.t||'ไม่มีชื่อ':'ไม่มีเพลง — แตะเพื่อเลือก',aa=s?(sl.err?'⚠️ โหลดไม่ได้ — กด ▶ เพื่อลองใหม่':(s.a||'')):'';
    el.classList.toggle('err',!!(id&&sl.err));
    if(t&&t.textContent!==tt)t.textContent=tt;
    ckBadge($el('dd-'+w+'-ck'),id);
    if(a&&a.textContent!==aa)a.textContent=aa;
    const kv=$el('dd-'+w+'-kv'),tv=$el('dd-'+w+'-tv');
    const lv=sl.live||{};
    if(kv){
      let lab='—';
      try{if(id){lab=deckKeyLab(sl,1);if(!lab){const k=deckPref(sl).key||0;lab=k?(k>0?'+':'')+k:'—'}}}catch(e){}
      if(kv.textContent!==lab)kv.textContent=lab;
    }
    if(tv){
      let lab='—';
      try{if(id){const r=deckBpm(sl);if(r)lab=String(Math.round(r));else{const tp=deckPref(sl).tempo||100;if(tp!==100)lab=(Math.round(tp*2)/2)+'%'}}}catch(e){}
      if(tv.textContent!==lab)tv.textContent=lab;
    }
    const ky=$el('dd-'+w+'-ky'),tp=$el('dd-'+w+'-tp');
    if(ky)ky.classList.toggle('tmp','key' in lv);
    if(tp)tp.classList.toggle('tmp','tempo' in lv);
    const sv=$el('dd-'+w+'-save');if(sv)sv.classList.toggle('on',!!(id&&sl.live&&Object.keys(sl.live).length));
    const sw=$el('dd-'+w+'-swap');
    if(sw){const on=!!(id&&typeof pref==='function'&&pref(id).swap);sw.classList.toggle('on',on);sw.setAttribute('aria-pressed',on?'true':'false')}
    const pb=el.querySelector('.dd-plat [data-dd="play"]');
    const on=!!sl.playing;
    if(pb&&pb._on!==on){pb._on=on;pb.innerHTML=on?I.pause:I.play;pb.classList.toggle('on',on);pb.setAttribute('aria-label',on?'หยุด':'เล่น')}
    const pad=$el('dd-'+w+'-pad');
    if(pad){
      const pon=!!(typeof PAD!=='undefined'&&PAD.on&&(PAD.sid===id||PAD.hold===id||(cur&&cur.id===id&&!PAD.sid)));
      pad.classList.toggle('on',pon);pad.setAttribute('aria-pressed',pon?'true':'false');
    }
    const mt=$el('dd-'+w+'-metro');
    if(mt){
      const mon=!!(window.__metro&&__metro.state&&__metro.state.running);
      mt.classList.toggle('on',mon);mt.setAttribute('aria-pressed',mon?'true':'false');
    }
    const fd=$el('dd-'+w+'-fade');
    if(fd){
      const fon=!!sl.fading;
      fd.classList.toggle('on',fon);fd.setAttribute('aria-pressed',fon?'true':'false');
    }
    const vol=$el('dd-'+w+'-vol');
    if(vol&&document.activeElement!==vol)vol.value=String(Math.round((sl.vol==null?1:sl.vol)*100));
    ['l','m','h'].forEach(function(k){
      const i=$el('dd-'+w+'-eq'+k);
      if(i&&document.activeElement!==i)i.value=String((sl.eq&&sl.eq[k])||0);
    });
    const sy=$el(w==='B'?'dd-sync':'dd-syncA');
    if(sy){
      let onS=false;
      try{
        // v1.0.38: lit only while a manual SYNC on this deck still holds (same songs, same tempo) - never because BPMs happen to match
        const y=sl.synced,ot=slot(w==='A'?'B':'A');
        onS=!!(y&&y.id===sl.id&&ot.id===y.o&&Math.abs((deckPref(sl).tempo||100)-y.t)<0.01);
      }catch(e){}
      sy.classList.toggle('on',onS);
    }
    try{if(sl.bus)applyDeckMix(sl)}catch(e){}
    drawWave(w);
  }
  function patchListDur(){
    // header + per-row lengths without remounting #dd-list (DUR updates used to wipe the list)
    const nn=$el('dd-listn');if(nn){const tx=typeof setTotLabel==='function'?setTotLabel():((SET&&SET.length?SET.length:0)+' เพลง');if(nn.textContent!==tx)nn.textContent=tx}
    const box=$el('dd-list');if(!box)return;
    box.querySelectorAll('.dd-song').forEach(function(row){
      const id=row.dataset.sid,s=SONG.get(id)||{a:''},a=row.querySelector('.a');if(!a)return;
      const want=(s.a||'')+(DUR[id]?(' · '+f2(DUR[id])):'');
      if(a.textContent!==want)a.textContent=want;
    });
  }
  function paintList(){
    const box=$el('dd-list');if(!box)return;
    // structure signature excludes DUR so length discovery does not remount rows
    const html=SET.map(function(id,i){
      const s=SONG.get(id)||{t:id,a:''};
      const ona=DUAL.a.id===id,onb=DUAL.b.id===id;
      const pa=ona&&DUAL.a.playing,pb=onb&&DUAL.b.playing;
      return '<div class="dd-song'+(ona?' ona':'')+(onb?' onb':'')+(pa||pb?' now':'')+'" data-sid="'+esc(id)+'">'+
        '<button type="button" class="dd-grip" aria-label="ลากเพื่อเรียงลำดับ" title="ลากเรียง">'+I.grip+'</button>'+
        '<span class="no">'+(i+1)+'</span>'+
        '<div class="ti"><div class="t">'+esc(s.t||id)+'</div><div class="a">'+esc(s.a||'')+'</div></div>'+
        '<div class="btns">'+
        '<button type="button" data-to="A" class="'+(ona?'ona':'')+'" aria-label="ใส่เด็ค A">A</button>'+
        '<button type="button" data-to="B" class="'+(onb?'onb':'')+'" aria-label="ใส่เด็ค B">B</button>'+
        '<button type="button" data-more="1" class="mo" aria-label="เมนูเพลง">'+I.more+'</button>'+
        '</div></div>';
    }).join('')||'<div class="dd-empty">ลิสต์ว่าง — ค้นด้านบนเพื่อแทรกเพลง หรือแตะไอคอนคลังในช่องค้น</div>';
    if(box._sig!==html){
      box._sig=html;
      box.innerHTML=html;
    }
    patchListDur();
  }
  function refreshDur(){if(!DUAL.on)return;patchListDur()}
  function paintMaster(){
    const au=$el('dd-auto'),xf=$el('dd-xfsec');
    if(au){const on=!!(AUTO&&AUTO.on);au.classList.toggle('on',on);au.setAttribute('aria-pressed',on?'true':'false')}
    if(xf){const v=+(AUTO&&AUTO.xf||0);const tx=v>0?('XF '+v+'s'):'CUT';if(xf.textContent!==tx)xf.textContent=tx;xf.classList.toggle('on',v>0)}
    setKnob(DUAL.xf);
  }
  function paint(){if(!DUAL.on)return;paintDeck('A');paintDeck('B');paintList();paintMaster();try{paintRes()}catch(e){}try{paintDock()}catch(e){}}

  // ~30fps while a deck plays; nothing runs while the page is hidden.
  let raf=0,lastFrame=0;
  const FRAME_MS=1000/30;
  let FRAMES=0;
  function loop(ts){
    raf=0;
    if(!DUAL.on||document.hidden||DUAL.parked)return;
    if(!anyPlaying())return;
    raf=requestAnimationFrame(loop);
    if(document.body.classList.contains('sheet-open'))return;
    const now=ts||performance.now();
    if(now-lastFrame<FRAME_MS-2)return;
    lastFrame=now;FRAMES++;
    try{paintDeck('A');paintDeck('B')}catch(e){}
  }
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){if(raf){cancelAnimationFrame(raf);raf=0}}
    else if(DUAL.on){try{paint()}catch(e){}if(anyPlaying()&&!raf)raf=requestAnimationFrame(loop)}
  });

  function expState(){try{return JSON.parse(localStorage.getItem('bp-ddexp')||'{}')||{}}catch(e){return {}}}
  function applyExp(){
    const st=expState();
    if(st.A&&st.B&&spanPanel())st.B=false;
    ['A','B'].forEach(function(w){
      const el=$el('dd-'+w);if(!el)return;
      const on=!!st[w];
      el.classList.toggle('dd-open',on);
      const b=$el('dd-'+w+'-exp');
      if(b){b.setAttribute('aria-expanded',on?'true':'false');b.classList.toggle('on',on)}
    });
  }
  // narrow decks: the ⋯ panel spans both deck faces (op36.css), so only one can be open at a time
  const SPAN_Q='(max-width:699px), (orientation:landscape) and (max-height:520px)';
  function spanPanel(){try{return !!(window.matchMedia&&matchMedia(SPAN_Q).matches)}catch(e){return false}}
  function toggleExp(w){
    w=whichOf(w);
    const st=expState();st[w]=!st[w];
    if(st[w]&&spanPanel())st[w==='A'?'B':'A']=false;
    try{localStorage.setItem('bp-ddexp',JSON.stringify(st))}catch(e){}
    applyExp();
    try{placeUi()}catch(e){}
  }
  function isLand(){
    const vv=window.visualViewport;
    const w=Math.max(window.innerWidth||0, vv&&vv.width||0);
    const h=Math.max(window.innerHeight||0, vv&&vv.height||0);
    // Fold / tablet inner display: wide enough for side-by-side even when taller than wide.
    if(w>=700)return true;
    const bySize=w>h;
    try{
      const ang=(screen.orientation&&typeof screen.orientation.angle==='number')?screen.orientation.angle:(typeof window.orientation==='number'?window.orientation:null);
      // iOS PWA can lag innerWidth; angle 90 means landscape even if size still looks portrait.
      if(ang===90||ang===-90||ang===270)return true;
      // Desktop / Playwright report angle 0 on a landscape monitor — still trust a clearly wide viewport.
      if(ang===0||ang===180)return bySize&&w>=h*1.05;
    }catch(e){}
    return bySize;
  }
  function syncOri(){
    const land=isLand();
    document.body.classList.toggle('dd-land',!!(DUAL.on&&land));
    document.body.classList.toggle('dd-stack',!!(DUAL.on&&!land));
    const vv=window.visualViewport;
    const vh=vv?vv.height:(window.innerHeight||0);
    try{document.documentElement.style.setProperty('--vvh',vh+'px')}catch(e){}
  }
  function placeUi(){
    syncOri();
    const top=$el('op-top'),ui=$el('op-dualui');
    if(!ui)return;
    if(!DUAL.on){ui.hidden=true;ui.setAttribute('aria-hidden','true');return}
    ui.hidden=false;ui.removeAttribute('hidden');ui.setAttribute('aria-hidden','false');
    const vv=window.visualViewport;
    const vvH=vv&&vv.height?vv.height:(window.innerHeight||0);
    const bar=top?top.getBoundingClientRect():null;
    let y=bar?bar.bottom:0;
    // getBoundingClientRect is usually visual-viewport relative; do not add offsetTop
    // (that previously stretched Dual under the iOS Safari toolbar).
    if(vv&&y>vvH+1)y=y-(vv.offsetTop||0);
    y=Math.max(0,Math.ceil(y));
    if(y>vvH-80)y=Math.ceil((top&&top.offsetHeight)||48);
    const h=Math.max(160,Math.round(vvH-y));
    ui.style.top=y+'px';
    ui.style.height=h+'px';
    ui.style.maxHeight=h+'px';
    ui.style.bottom='auto';
    try{
      document.documentElement.style.setProperty('--dd-vvh',vvH+'px');
      document.documentElement.style.setProperty('--dd-top',y+'px');
    }catch(e){}
    try{applyExp()}catch(e){}
  }
  if(!document._ddOri){
    document._ddOri=1;
    const kick=function(){try{if(DUAL.on)placeUi();else syncOri()}catch(e){}};
    addEventListener('resize',function(){kick();setTimeout(kick,80);setTimeout(kick,300)});
    addEventListener('orientationchange',function(){kick();setTimeout(kick,80);setTimeout(kick,250);setTimeout(kick,600)});
    try{if(screen.orientation&&screen.orientation.addEventListener)screen.orientation.addEventListener('change',function(){kick();setTimeout(kick,200)})}catch(e){}
    try{if(window.visualViewport){visualViewport.addEventListener('resize',kick);visualViewport.addEventListener('scroll',kick)}}catch(e){}
  }

  function adoptInto(w){
    w=whichOf(w);
    if(!cur||!cur.buf)return;
    const sl=slot(w);
    const at=(typeof orig.pos==='function'?orig.pos():(typeof pos==='function'?pos():offset))||0;
    const was=!!playing;
    assignId(sl,cur.id);sl.buf=cur.buf;sl.offset=at;sl.ended=!!ended;
    try{orig.halt()}catch(e){}
    playing=false;src=null;sh=null;
    if(was)startSlot(w,at);
    else {DUAL.last=w;DUAL.audible=w;syncFocus()}
  }
  function releaseToGlobal(){
    const w=whichOf(DUAL.last||DUAL.audible||'A');
    const sl=slot(w);
    const other=w==='A'?DUAL.b:DUAL.a;
    const at=posOf(sl),was=!!sl.playing,id=sl.id,buf=sl.buf,en=!!sl.ended;
    haltSlot(other);other.playing=false;
    haltSlot(sl);sl.playing=false;
    if(DUAL.master){try{DUAL.master.gain.setValueAtTime(0,ctx?ctx.currentTime:0)}catch(e){}}
    if(id&&buf){
      cur={id:id,buf:buf};offset=at;ended=en;
      if(was){try{orig.start(at)}catch(e){}}
      else {playing=false;try{if(typeof sync==='function')sync()}catch(e){}}
    }
  }

  // ---- v1.0.40: the separate big-turntables "2 deck" page is gone (it duplicated the live page). The live home is the
  // compact 2-deck page (insert / SFX / crossfader / routing all stay there). The top-bar spot that toggled it is now
  // the Studio button: live → Studio (mixer / waveform / stems / trim marks), Studio → back to live. ----
  function bigOn(){return false}
  function setBig(){
    document.body.classList.remove('op36-big');
    try{localStorage.removeItem('bp-op36big')}catch(e){}
  }
  try{document.body.classList.remove('op36-big');localStorage.removeItem('bp-op36big')}catch(e){}
  function stuSync(){
    const btn=$el('op-studio');if(!btn)return;
    const inStu=!document.body.classList.contains('live');
    btn.classList.toggle('on',inStu);btn.setAttribute('aria-pressed',inStu?'true':'false');
    const l=btn.querySelector('.op-stul'),t=inStu?'ไลฟ์':'สตูดิโอ';
    if(l&&l.textContent!==t)l.textContent=t;
    const al=inStu?'กลับหน้าไลฟ์ (2 เด็ค)':'โหมดสตูดิโอ (มิกเซอร์ / คลื่นเสียง / stems / ตัดหัว-ท้าย)';
    if(btn.getAttribute('aria-label')!==al){btn.setAttribute('aria-label',al);btn.title=inStu?'กลับหน้าไลฟ์':'โหมดสตูดิโอ'}
  }
  function toggleDual(e){
    if(e){try{e.preventDefault();e.stopPropagation()}catch(_){}}
    const now=Date.now();
    if(now-(DUAL._togAt||0)<400)return;
    DUAL._togAt=now;
    const toStudio=document.body.classList.contains('live');
    try{if(typeof closeMenu==='function')closeMenu()}catch(_){}
    try{setLive(!toStudio)}catch(_){}
    // land straight on the Studio tools (mixer / waveform / stems / trim) when a song is loaded
    try{if(toStudio&&cur){const pl=document.getElementById('pl'),ex=document.getElementById('exp');if(pl&&ex&&!pl.classList.contains('open'))ex.click()}}catch(_){}
    stuSync();
  }
  function setOn(on){
    on=!!on;
    if(on===DUAL.on){if(on){if(DUAL.parked)unpark();paint()}return}
    DUAL.parked=false;
    DUAL.on=on;
    document.body.classList.toggle('op-dual',on);
    try{stuSync()}catch(e){}
    const ui=$el('op-dualui');
    if(on){
      ensureUi();
      const u=$el('op-dualui');
      if(u){u.hidden=false;u.removeAttribute('hidden');u.setAttribute('aria-hidden','false')}
      placeUi();
      try{applyExp()}catch(e){}
      dismissHint(true);
      setKnob(0.5);
      try{ensureMaster();if(DUAL.master)DUAL.master.gain.setValueAtTime(1,ctx?ctx.currentTime:0)}catch(e){}
      if(cur&&cur.id){
        const dest=(DUAL.b.id===cur.id&&DUAL.a.id!==cur.id)?'B':'A';
        adoptInto(dest);
      }
      try{cacheCap()}catch(e){}
      paint();
      if(anyPlaying()){if(!raf)raf=requestAnimationFrame(loop)}
    }else{
      DUAL.pick=null;
      DUAL.a.live=null;DUAL.b.live=null;
      if(ui){ui.hidden=true;ui.setAttribute('aria-hidden','true')}
      document.body.classList.remove('dd-land','dd-stack');
      try{closeMixSheet()}catch(e){}
      if(raf){cancelAnimationFrame(raf);raf=0}
      try{releaseToGlobal()}catch(e){}
    }
  }
  function homeLive(){return document.body.classList.contains('live')}
  let homeWas=null;
  function homeEdge(){
    const lv=homeLive();
    if(lv===homeWas)return;
    homeWas=lv;
    // v1.0.38: leaving the live page while a deck plays no longer hands the song to the single player
    // (that was a hard stop + restart = the glitch on every page change). The decks keep playing ("parked"),
    // only the deck UI is hidden; coming back just shows it again - no restart.
    if(lv){if(DUAL.on&&DUAL.parked)unpark();else if(!DUAL.on)setOn(true)}
    else if(DUAL.on){if(anyPlaying())park();else setOn(false)}
  }
  function park(){
    if(!DUAL.on||DUAL.parked)return;
    DUAL.parked=true;DUAL.pick=null;
    const ui=$el('op-dualui');if(ui){ui.hidden=true;ui.setAttribute('aria-hidden','true')}
    document.body.classList.remove('op-dual','dd-land','dd-stack');
    try{closeMixSheet()}catch(e){}
    if(raf){cancelAnimationFrame(raf);raf=0}
    try{syncFocus()}catch(e){}
  }
  function unpark(){
    if(!DUAL.parked)return;
    DUAL.parked=false;
    if(!DUAL.on)return;
    document.body.classList.add('op-dual');
    const u=$el('op-dualui');if(u){u.hidden=false;u.removeAttribute('hidden');u.setAttribute('aria-hidden','false')}
    try{placeUi()}catch(e){}
    try{applyExp()}catch(e){}
    try{paint()}catch(e){}
    if(anyPlaying()&&!raf)raf=requestAnimationFrame(loop);
  }
  {const _sl=setLive;setLive=function(){const r=_sl.apply(this,arguments);try{homeEdge()}catch(e){}try{stuSync()}catch(e){}return r}}

  function bindTop(){
    {const old=$el('op-dual');if(old)old.remove()}
    let btn=$el('op-studio');
    if(!btn){
      const av=$el('op-av'),top=$el('op-top');
      const h='<button type="button" id="op-studio" class="hw" aria-pressed="false" aria-label="โหมดสตูดิโอ (มิกเซอร์ / คลื่นเสียง / stems / ตัดหัว-ท้าย)" title="โหมดสตูดิโอ"><svg class="op-stuico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 4v16M12 4v16M18 4v16"/><rect x="3.6" y="12.5" width="4.8" height="3.2" rx="1" fill="currentColor" stroke="none"/><rect x="9.6" y="6.5" width="4.8" height="3.2" rx="1" fill="currentColor" stroke="none"/><rect x="15.6" y="10" width="4.8" height="3.2" rx="1" fill="currentColor" stroke="none"/></svg><span class="op-stul">สตูดิโอ</span></button>';
      if(av)av.insertAdjacentHTML('beforebegin',h);
      else if(top)top.insertAdjacentHTML('beforeend',h);
      btn=$el('op-studio');
    }
    if(btn&&!btn._bound){
      btn._bound=1;
      btn.addEventListener('click',function(e){toggleDual(e)});
      btn.addEventListener('pointerdown',function(e){e.stopPropagation()});
    }
    stuSync();
    // v1.0.38: the top คลัง button is gone (search already covers it). The library is one tap away from the
    // book icon inside the search box (#dd-qlib) and from each deck's load icon.
    {const old=$el('op-lib');if(old)old.remove()}
    const lb=$el('dd-qlib');
    if(lb&&!lb._bound){
      lb._bound=1;
      lb.addEventListener('pointerdown',function(e){e.stopPropagation()});
      lb.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();DUAL.pick=null;try{if(window.__op18&&__op18.openLib)__op18.openLib()}catch(err){}});
    }
    libDecor();
    maybeHint();
  }
  // Library sheet rows get one-tap A / B buttons (data-op36id so the row-tap intercept leaves them alone).
  function libDecor(){
    if(!DUAL.on)return;
    const m=document.getElementById('main');if(!m)return;
    if(!m._op36){
      m._op36=1;
      try{new MutationObserver(function(){if(DUAL.on)libDecor()}).observe(m,{childList:true,subtree:true})}catch(e){}
      m.addEventListener('click',function(e){
        const del=e.target.closest('[data-libdel145]');
        if(del){e.preventDefault();e.stopPropagation();const id=del.getAttribute('data-libdel145');try{libDel145(id)}catch(err){}return}
        const b=e.target.closest('[data-op36id]');if(!b)return;
        e.preventDefault();e.stopPropagation();
        const id=b.getAttribute('data-op36id'),w=b.getAttribute('data-op36to');
        if(!id||!SONG.get(id))return;
        try{if(window.__op18&&__op18.closeSheet)__op18.closeSheet();document.body.classList.remove('sheet-open')}catch(err){}
        DUAL.pick=null;
        loadInto(w,id,false);
        try{const s=SONG.get(id);toast('เด็ค '+w+' · '+(s&&s.t||''),1400,true)}catch(err){}
      },true);
    }
    if(!document.body.classList.contains('sheet-open'))return;
    m.querySelectorAll('li > button.pbtn[data-play]').forEach(function(pb){
      const li=pb.parentElement;if(!li||li.querySelector('.op36ab'))return;
      const id=pb.getAttribute('data-play');
      // v1.0.46: 🗑 already comes from item(); sheet only adds one-tap A/B
      const h='<span class="op36ab"><button type="button" data-op36id="'+esc(id)+'" data-op36to="A" aria-label="ใส่เด็ค A">A</button><button type="button" data-op36id="'+esc(id)+'" data-op36to="B" aria-label="ใส่เด็ค B">B</button></span>';
      li.insertAdjacentHTML('beforeend',h);
    });
  }

  function maybeHint(){} // v1.0.40: no more "try 2-deck mode" hint (the 2-deck page is the live home)
  function dismissHint(persist){
    const tip=$el('op-dualtip');if(tip)tip.hidden=true;
    if(persist){try{localStorage.setItem('bp-dual-hint','1')}catch(e){}}
  }

  function tick(){
    bindTop();
    try{homeEdge()}catch(e){}
    if(DUAL.on){
      ensureUi();placeUi();
      paint();
      if(anyPlaying()&&!raf&&!document.hidden)raf=requestAnimationFrame(loop);
    }else maybeHint();
  }

  function dualXfCheck(){
    if(!DUAL.on)return false;
    if(!AUTO.on||!(AUTO.xf>0))return true;
    let w=null;
    const pw=whichOf(DUAL.last||DUAL.audible||'A'); // v1.0.38: was named "pref" and shadowed pref() -> TypeError -> fell back to the single-player crossfade
    if(slot(pw).playing)w=pw;
    else if(slot('A').playing)w='A';
    else if(slot('B').playing)w='B';
    if(!w)return true;
    const sl=slot(w);
    if(!sl.id||sl.fading)return true;
    const p=pref(sl.id);
    if(p.lp!=null)return true;
    const left=(sl.buf?markOf(sl).te-posOf(sl):0)/((deckPref(sl).tempo||100)/100); // v1.0.38: this deck's end mark + deck tempo
    const i=SET.indexOf(sl.id),nx=i>=0?SET[i+1]:null;
    if(!nx)return true;
    const idle=w==='A'?'B':'A';
    if(slot(idle).playing)return true;
    if(slot(idle).id!==nx){assignId(slot(idle),nx);slot(idle).offset=(typeof trS==='function'?trS(nx):0)||0;slot(idle).ended=false;slot(idle).buf=null;try{paintList()}catch(e){}}
    if(!cache.has(nx)){if(left<AUTO.xf+20&&SONG.get(nx)){decode(nx).then(function(b){if(slot(idle).id===nx)slot(idle).buf=b}).catch(function(){})}return true}
    if(left>AUTO.xf)return true;
    if(!slot(idle).playing){
      DUAL.expect=idle;
      loadInto(idle,nx,true);
      const t=(typeof AUTO.xf==='number'?AUTO.xf:2);
      // ease xf toward the incoming deck over the overlap window
      const from=DUAL.xf,to=idle==='B'?1:0,t0=(ctx&&ctx.currentTime)||0;
      const steps=Math.max(4,(t*20)|0);let iStep=0;
      const iv=setInterval(function(){iStep++;setKnob(from+(to-from)*iStep/steps);if(iStep>=steps)clearInterval(iv)},50);
    }
    return true;
  }
  function dualAutoNext(fromW){
    if(!DUAL.on)return false;
    if(!AUTO.on)return true;
    const w=whichOf(fromW||DUAL.last||DUAL.audible);
    const sl=slot(w);
    if(slot(w==='A'?'B':'A').playing)return true; // v1.0.38: the other deck already carries on (crossfade hand-off) -> don't reload this deck
    const i=SET.indexOf(sl.id),nx=i>=0?SET[i+1]:null;
    if(!nx){try{$('ps').textContent='✅ จบเพลง (ไม่มีเพลงถัดไปในลิสต์)'}catch(e){}return true}
    const s=SONG.get(nx);
    if(!s||!(cache.has(nx)||(typeof fileOf==='function'&&fileOf(s)))){
      try{$('ps').textContent='⚠️ เพลงถัดไป "'+(s?s.t:nx)+'" ยังไม่ได้โหลดเก็บ — ไม่เล่นต่อ'}catch(e){}
      return true;
    }
    let left=AUTO.gap;
    const show=function(){try{$('ps').innerHTML='⏭ เล่นต่อ "'+(s.t||'')+'" ใน <b style="font-size:22px">'+left+'</b> วิ'}catch(e){}};
    try{cancelCd()}catch(e){}
    if(left<=0){loadInto(w,nx,true);return true}
    show();
    try{cd=setInterval(function(){left--;if(left<=0){try{cancelCd('')}catch(e){}loadInto(w,nx,true)}else show()},1000)}catch(e){loadInto(w,nx,true)}
    return true;
  }

  async function prime(ids){
    try{initAudio();if(ctx&&ctx.resume)await ctx.resume()}catch(e){}
    const L=ids&&ids.length?ids:SET.slice();
    window.__nocap=1;
    for(let i=0;i<L.length;i++){
      const id=L[i];
      if(!cache.has(id)){
        const b=ctx.createBuffer(2,Math.floor(ctx.sampleRate*12),ctx.sampleRate);
        cache.set(id,Promise.resolve(b));
      }
      try{
        if(!songKey(id)){KEYD[id]={r:0,m:0};const s=SONG.get(id);if(s&&!s.k)s.k='C'}
      }catch(e){}
    }
    try{cacheCap()}catch(e){}
    return L.length;
  }

  function gainsState(){
    const g=xfApplied();
    const xv=function(sl){return sl.bus&&sl.bus.xf?+sl.bus.xf.gain.value:g[sl===DUAL.b?'b':'a']};
    return {
      a:xv(DUAL.a),b:xv(DUAL.b),
      volA:DUAL.a.vol,volB:DUAL.b.vol,
      eqA:Object.assign({},DUAL.a.eq),eqB:Object.assign({},DUAL.b.eq),
      target:{a:g.a,b:g.b},
      curve:xfGains(DUAL.xf),
      solo:!(DUAL.a.playing&&DUAL.b.playing),
      chA:DUAL.a.bus&&DUAL.a.bus.xf?DUAL.a.bus.xf.channelCount:0,
      chM:DUAL.master?DUAL.master.channelCount:0
    };
  }

  // ---- hooks (only when Dual is on; one-page path stays original) ----
  start=function(at){
    if(DUAL.on){startSlot(DUAL.last||DUAL.audible||'A',at);return}
    return orig.start.apply(this,arguments);
  };
  stop=function(){
    if(DUAL.on){stopSlot(DUAL.last||DUAL.audible||'A');paint();return}
    return orig.stop.apply(this,arguments);
  };
  halt=function(){
    if(DUAL.on){haltSlot(slot(DUAL.last||DUAL.audible||'A'));return}
    return orig.halt.apply(this,arguments);
  };
  pos=function(){
    if(DUAL.on)return posOf(slot(DUAL.last||DUAL.audible||'A'));
    return orig.pos.apply(this,arguments);
  };
  // v1.0.38: the end-mark stop (global 250 ms check -> finish()) used to call the hooked halt() only, so the deck kept
  // sl.playing=true and its timer ran on to the file end. In Dual, finish() now finishes that deck properly.
  finish=function(){
    if(DUAL.on){finishSlot(DUAL.last||DUAL.audible||'A');return}
    return orig.finish.apply(this,arguments);
  };
  // each deck stops at its own end mark, also when the other deck has focus
  setInterval(function(){
    if(!DUAL.on)return;
    ['A','B'].forEach(function(w){
      const sl=slot(w);
      if(!sl.playing||!sl.buf||!sl.id||sl.fading)return;
      try{const lp=pref(sl.id);if(lp&&lp.lp!=null)return}catch(e){}
      const m=markOf(sl);
      if(m.te<m.d-0.05&&posOf(sl)>=m.te-0.06)finishSlot(w);
    });
  },100);
  doFade=function(){
    if(DUAL.on){fadeSlot(DUAL.last||DUAL.audible||'A');paint();return}
    return orig.doFade.apply(this,arguments);
  };
  load=async function(id,autoplay){
    if(DUAL.on&&DUAL.parked){try{setOn(false)}catch(e){}}
    if(DUAL.on){
      if(DUAL.expect==='A'||DUAL.expect==='B'){const w=DUAL.expect;DUAL.expect=null;await loadInto(w,id,autoplay!==false);return}
      songTap(id,autoplay!==false);
      return;
    }
    const r=await orig.load.apply(this,arguments);
    try{afterLoad(id)}catch(e){}
    return r;
  };
  {const _xf=xfCheck;xfCheck=function(){try{if(dualXfCheck())return}catch(e){}return _xf.apply(this,arguments)}}
  {const _an=autoNext;autoNext=function(){try{if(dualAutoNext())return}catch(e){}return _an.apply(this,arguments)}}
  function dropLive(id,ch){
    if(!ch||!id)return;
    const w=deckOf(id);if(!w)return;
    const sl=slot(w);if(!sl.live)return;
    if('key' in ch)delete sl.live.key;
    if('tempo' in ch)delete sl.live.tempo;
    if(!Object.keys(sl.live).length)sl.live=null;
  }
  // v1.0.43: a key another band member saved (live list) shows on this phone's decks too (unless this deck has its own unsaved key)
  {const _la=lvApply;lvApply=async function(d){const bf={};try{for(const w of ['A','B']){const sl=slot(w);bf[w]=sl.id?[sl.id,(pref(sl.id)||{}).key||0]:null}}catch(e){}
    const r=await _la.apply(this,arguments);
    try{for(const w of ['A','B']){const sl=slot(w),b=bf[w];if(!sl.id||!b||b[0]!==sl.id)continue;const k=(pref(sl.id)||{}).key||0;if(k!==b[1]&&!(sl.live&&'key' in sl.live)){applySlotPref(sl.id,{key:k});paintDeck(w)}}}catch(e){}
    return r}}
  {const _spf=setPrefFor;setPrefFor=async function(id,ch){try{if(ch&&'key' in ch){const o=KS43.get(id);if(o){clearTimeout(o.t);KS43.delete(id)}}}catch(e){}const r=await orig.setPrefFor.apply(this,arguments);try{if(DUAL.on){dropLive(id,ch);applySlotPref(id,ch)}}catch(e){}return r}}
  {const _sp=setPref;setPref=async function(ch){try{if(ch&&'key' in ch&&cur){const o=KS43.get(cur.id);if(o){clearTimeout(o.t);KS43.delete(cur.id)}}}catch(e){}const r=await orig.setPref.apply(this,arguments);try{if(DUAL.on&&cur&&cur.id){dropLive(cur.id,ch);applySlotPref(cur.id,ch)}}catch(e){}return r}}
  padToggle=function(want){
    if(!DUAL.on)return orig.padToggle.apply(this,arguments);
    const id=want||PAD.sid||(slot(DUAL.last).id)||(cur&&cur.id);
    if(PAD.hold&&PAD.on&&(!want||PAD.hold===id||PAD.sid===id)){try{padHoldGo()}catch(e){}return}
    if(!PAD.on){
      const w=deckOf(id)||DUAL.last||'A';
      const sl=slot(w);
      if(sl.playing)stopSlot(w);
      sl.offset=(typeof trS==='function'?trS(id):0)||0;sl.ended=false;
      if(id)PAD.sid=id;
      let ok=true;
      try{ok=padOn()!==false}catch(e){ok=false}
      if(!ok){PAD.sid=null;return}
      if(PAD.on&&id){try{padHoldOn(id)}catch(e){}DUAL.last=w;DUAL.audible=w;syncFocus();try{routePad(w)}catch(e){}}
      paint();
      return;
    }
    return orig.padToggle.apply(this,arguments);
  };

  window.__dual={
    get on(){return DUAL.on},
    setOn:setOn,
    toggle:toggleDual,
    key:keyDeck,
    tempo:tempoDeck,
    eff:function(w){const sl=slot(whichOf(w||'A'));const p=deckPref(sl);return{id:sl.id,key:p.key||0,tempo:p.tempo||100,live:sl.live?Object.assign({},sl.live):null}},
    loadA:function(id){return loadInto('A',id,false)},
    loadB:function(id){return loadInto('B',id,false)},
    play:playDeck,
    cue:cueDeck,
    xfTo:xfTo,
    setXf:setKnob,
    centerXf:function(){setKnob(0.5)},
    sync:syncDeck,
    setVol:setDeckVol,
    setEq:setDeckEq,
    setPref:function(id,ch){const r=orig.setPrefFor(id,ch);try{dropLive(id,ch);applySlotPref(id,ch)}catch(e){}return r},
    cacheKeys:function(){return [...cache.keys()]},
    cacheCap:function(){window.__nocap=0;try{cacheCap()}catch(e){}return [...cache.keys()]},
    get audible(){return DUAL.audible},
    get last(){return DUAL.last},
    get ids(){return{a:DUAL.a.id,b:DUAL.b.id}},
    get holds(){return{hold:typeof PAD!=='undefined'?PAD.hold:null,wait:typeof PAD!=='undefined'?PAD.wait:null,sid:typeof PAD!=='undefined'?PAD.sid:null}},
    get gen(){return{A:DUAL.a.gen||0,B:DUAL.b.gen||0,parked:!!DUAL.parked}},
    get state(){return{on:DUAL.on,a:DUAL.a.id,b:DUAL.b.id,audible:DUAL.audible,last:DUAL.last,xf:DUAL.xf,pick:DUAL.pick,cur:cur&&cur.id,playing:anyPlaying(),playingA:!!DUAL.a.playing,playingB:!!DUAL.b.playing,pos:posOf(slot(DUAL.last||DUAL.audible)),posA:posOf(DUAL.a),posB:posOf(DUAL.b),gains:gainsState(),shA:!!DUAL.a.sh,shB:!!DUAL.b.sh,cpuWarned:!!DUAL.cpuWarned,nodes:{a:!!(DUAL.a.src||DUAL.a.sh),b:!!(DUAL.b.src||DUAL.b.sh)}}},
    get gains(){return gainsState()},
    setSong:function(id,ch){const s=SONG.get(id);if(!s)return false;if(ch&&ch.t!=null)s.t=ch.t;if(ch&&ch.a!=null)s.a=ch.a;if(ch&&'b' in ch)s.b=ch.b;if(ch&&ch.f!=null)s.f=ch.f;if(ch&&'s' in ch)s.s=ch.s;if(ch&&'k' in ch)s.k=ch.k;return true},
    loadSong:function(id,auto){return load(id,auto!==false)},
    setAuto:function(p){Object.assign(AUTO,p||{});try{saveAuto()}catch(e){}},
    get auto(){return{on:!!AUTO.on,xf:+(AUTO.xf||0),gap:+(AUTO.gap||0)}},
    setAuto:function(o){o=o||{};if('on' in o)AUTO.on=!!o.on;if('xf' in o)AUTO.xf=+o.xf||0;if('gap' in o)AUTO.gap=+o.gap||0;return{on:!!AUTO.on,xf:+(AUTO.xf||0),gap:+(AUTO.gap||0)}}, // v1.0.38 test hook
    seek:function(at,w){w=w?whichOf(w):(DUAL.last||DUAL.audible||'A');const sl=slot(w);if(sl.buf){const t=Math.max(0,Math.min(sl.buf.duration-0.05,+at||0));if(sl.playing)startSlot(w,t);else sl.offset=t;DUAL.last=w;syncFocus();paint()}},
    paint:paint,
    refreshDur:refreshDur,
    prime:prime,
    keepIds:keepIds,
    afterLoad:afterLoad,
    expectHold:expectHold,
    bindTop:bindTop,
    tick:tick,
    pad:padDeck,
    placeUi:placeUi,
    syncOri:syncOri,
    toggleExp:toggleExp,
    applyExp:applyExp,
    songTap:songTap,
    applyXf:applyXf,
    xfApplied:xfApplied,
    isLand:isLand,
    get big(){return bigOn()},
    setBig:setBig,
    moveSet:moveSet,
    insertNext:insertNext,
    cueNext:cueNext,
    search:searchSongs,
    // v1.0.45: drop a deleted library song off both decks
    eject:function(id){if(!id)return;for(const w of ['A','B']){const sl=slot(w);if(sl.id!==id)continue;try{stopSlot(w)}catch(e){}assignId(sl,null);sl.buf=null;sl.offset=0;sl.ended=false;sl.err=null;sl.live=null}try{paint()}catch(e){}},
    get frames(){return FRAMES},
    get rafOn(){return !!raf},
    ringReal:function(w){const sl=slot(whichOf(w||'A'));const r=sl.id?ringOf(sl.id,sl.buf):null;return !!(r&&!r._fake)},
    openMix:openMixSheet,
    closeMix:closeMixSheet,
    caps:audioCaps,
    paintDock:paintDock,
    deckMix:function(w){return deckMix(slot(whichOf(w||'A')).id)},
    busMix:function(w){const sl=slot(whichOf(w||'A'));if(!sl.bus||!sl.bus.f)return null;return{f:sl.bus.f.map(function(g){return +g.gain.value.toFixed(3)}),pan:sl.bus.pan.slice(),r:sl.bus.r.map(function(x){return x.map(function(g){return +g.gain.value.toFixed(3)})}),M:+sl.bus.sum.gain.value.toFixed(3),sig:sl.bus.mixSig}},
    // v1.0.37 test hooks (simulated audio checks): output chain + seed a synthetic buffer for a song id
    outChain:function(){ensureMaster();return DUAL.out?{ctx:ctx,master:DUAL.master,lim:DUAL.out.lim,ceil:DUAL.out.ceil,mg:DUAL.out.mg}:null},
    seedBuf:function(id,L,R){initAudio();const b=ctx.createBuffer(2,L.length,ctx.sampleRate);b.copyToChannel(Float32Array.from(L),0);b.copyToChannel(Float32Array.from(R),1);cache.set(id,Promise.resolve(b));return b.duration},
    saveDeck:saveDeck,
    swapDeck:swapDeck
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){bindTop()});
  else bindTop();
})();

// ===================== v1.0.30 SFX pad (recorded one-shots + custom IndexedDB pads) =====================
(function(){
  const DEFAULTS=[
    {id:'applause',lab:'ปรบมือ',en:'applause'},
    {id:'cheer',lab:'เชียร์',en:'cheer'},
    {id:'clap',lab:'ตบมือ',en:'clap'},
    {id:'cymbal',lab:'ฉาบ',en:'cymbal'},
    {id:'horn',lab:'แตร',en:'air horn'},
    {id:'rimshot',lab:'บาดัมทึส',en:'rimshot'},
    {id:'roll',lab:'รัวกลอง',en:'drum roll'},
    {id:'whistle',lab:'นกหวีด',en:'whistle'}
  ];
  const MAX_CUSTOM=8, MAX_BYTES=3*1024*1024, MAX_SEC=10;
  const IDB_NAME='bp-sfx', IDB_STORE='pads';
  const DEF_IDS=DEFAULTS.map(function(x){return x.id});
  const SFX={vol:(function(){try{const raw=localStorage.getItem('bp-sfxvol');if(raw==null||raw==='')return 0.8;const v=+raw;return Number.isFinite(v)?Math.max(0,Math.min(1,v)):0.8}catch(e){return 0.8}})(),bufs:{},bus:null,open:false,loading:null,active:[],meta:{},pending:null};
  function $el(id){return document.getElementById(id)}
  function defOf(id){for(let i=0;i<DEFAULTS.length;i++)if(DEFAULTS[i].id===id)return DEFAULTS[i];return null}
  function isCustomId(id){return /^custom-\d+$/.test(id)}
  function openDb(){
    return new Promise(function(ok,no){
      const r=indexedDB.open(IDB_NAME,1);
      r.onupgradeneeded=function(){try{if(!r.result.objectStoreNames.contains(IDB_STORE))r.result.createObjectStore(IDB_STORE,{keyPath:'id'})}catch(e){}};
      r.onsuccess=function(){ok(r.result)};
      r.onerror=function(){no(r.error)};
    });
  }
  function idbAll(){
    return openDb().then(function(d){return new Promise(function(ok,no){
      const q=d.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).getAll();
      q.onsuccess=function(){ok(q.result||[])};
      q.onerror=function(){no(q.error)};
    })});
  }
  function idbPut(rec){
    return openDb().then(function(d){return new Promise(function(ok,no){
      const q=d.transaction(IDB_STORE,'readwrite').objectStore(IDB_STORE).put(rec);
      q.onsuccess=function(){ok(rec)};
      q.onerror=function(){no(q.error)};
    })});
  }
  function idbDel(id){
    return openDb().then(function(d){return new Promise(function(ok,no){
      const q=d.transaction(IDB_STORE,'readwrite').objectStore(IDB_STORE).delete(id);
      q.onsuccess=function(){ok()};
      q.onerror=function(){no(q.error)};
    })});
  }
  function listMeta(){
    const out=[];
    DEFAULTS.forEach(function(d){
      const m=SFX.meta[d.id]||{};
      out.push({id:d.id,lab:m.lab||d.lab,en:m.en||d.en,custom:!!m.custom,replaced:!!m.replaced,builtin:true});
    });
    Object.keys(SFX.meta).filter(isCustomId).sort().forEach(function(id){
      const m=SFX.meta[id];
      if(m)out.push({id:id,lab:m.lab||'กำหนดเอง',en:m.en||'custom',custom:true,replaced:false,builtin:false});
    });
    return out;
  }
  function nextCustomId(){
    for(let i=1;i<=MAX_CUSTOM;i++){
      const id='custom-'+i;
      if(!SFX.meta[id])return id;
    }
    return null;
  }
  function customCount(){return Object.keys(SFX.meta).filter(isCustomId).length}
  function bus(){
    try{initAudio()}catch(e){}
    if(!ctx)return null;
    if(!SFX.bus){
      SFX.bus=ctx.createGain();
      SFX.bus.gain.value=SFX.vol;
      try{SFX.bus.connect(ctx.destination)}catch(e){}
    }
    return SFX.bus;
  }
  function setVol(v){
    SFX.vol=Math.max(0,Math.min(1,+v||0));
    try{localStorage.setItem('bp-sfxvol',String(SFX.vol))}catch(e){}
    if(SFX.bus){
      const t=ctx&&ctx.currentTime;
      if(t!=null){SFX.bus.gain.cancelScheduledValues(t);SFX.bus.gain.setTargetAtTime(SFX.vol,t,0.02)}
      else SFX.bus.gain.value=SFX.vol;
    }
    const sl=$el('op-sfxvol');
    if(sl&&document.activeElement!==sl)sl.value=String(Math.round(SFX.vol*100));
  }
  async function decodeBuf(ab){
    try{initAudio()}catch(e){}
    if(!ctx)return ab;
    const src=ab instanceof ArrayBuffer?ab.slice(0):(ab.buffer?ab.buffer.slice(ab.byteOffset,ab.byteOffset+ab.byteLength):null);
    if(!src)return null;
    return new Promise(function(ok,no){ctx.decodeAudioData(src,ok,no)});
  }
  async function loadPack(id){
    const tries=['sfx/'+id+'.mp3','sfx/'+id+'.m4a','sfx/'+id+'.wav'];
    for(let i=0;i<tries.length;i++){
      try{
        const r=await fetch(tries[i],{cache:'force-cache'});
        if(!r||!r.ok)continue;
        const ab=await r.arrayBuffer();
        const b=await decodeBuf(ab);
        if(b)return b;
      }catch(e){}
    }
    return null;
  }
  async function bufFromBlob(blob){
    const ab=await blob.arrayBuffer();
    return decodeBuf(ab);
  }
  async function applyRec(rec){
    if(!rec||!rec.id)return;
    let blob=rec.blob;
    if(!blob&&rec.data)blob=new Blob([rec.data],{type:rec.mime||'audio/mpeg'});
    if(blob){
      try{SFX.bufs[rec.id]=await bufFromBlob(blob)}catch(e){try{blog('warn','sfx idb decode '+rec.id,e&&e.message)}catch(_){}}
    }
    const d=defOf(rec.id);
    SFX.meta[rec.id]={
      lab:rec.lab||(d&&d.lab)||'กำหนดเอง',
      en:rec.en||(d&&d.en)||'custom',
      custom:true,
      replaced:!!d,
      mime:rec.mime||'',
      orig:!!d
    };
  }
  async function preload(){
    if(SFX.loading)return SFX.loading;
    SFX.loading=(async function(){
      try{initAudio()}catch(e){}
      for(let i=0;i<DEFAULTS.length;i++){
        const id=DEFAULTS[i].id;
        if(SFX.bufs[id])continue;
        try{
          const b=await loadPack(id);
          if(b)SFX.bufs[id]=b;
        }catch(e){try{blog('warn','sfx load '+id,e&&e.message)}catch(_){}}
      }
      try{
        const recs=await idbAll();
        for(let i=0;i<recs.length;i++)await applyRec(recs[i]);
      }catch(e){try{blog('warn','sfx idb',e&&e.message)}catch(_){}}
      renderGrid();
    })();
    return SFX.loading;
  }
  async function play(id){
    try{initAudio();if(ctx&&ctx.resume)await ctx.resume()}catch(e){}
    const dest=bus();if(!dest)return false;
    let b=SFX.bufs[id];
    if(b&&!(b instanceof AudioBuffer)){
      try{b=await decodeBuf(b);SFX.bufs[id]=b}catch(e){b=null}
    }
    if(!b){
      try{await preload();b=SFX.bufs[id]}catch(e){}
    }
    if(!b||!(b instanceof AudioBuffer))return false;
    const s=ctx.createBufferSource();
    s.buffer=b;
    s.connect(dest);
    const rec={s:s,id:id,t:(ctx&&ctx.currentTime)||0};
    SFX.active.push(rec);
    s.onended=function(){SFX.active=SFX.active.filter(function(x){return x!==rec})};
    try{s.start(0)}catch(e){SFX.active=SFX.active.filter(function(x){return x!==rec});return false}
    return true;
  }
  function flash(el){if(!el)return;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')}
  function hideMenu(){const m=$el('op-sfxmenu');if(m)m.hidden=true}
  function showMenu(id,anchor){
    ensureSheet();
    const m=$el('op-sfxmenu');if(!m)return;
    const item=listMeta().filter(function(x){return x.id===id})[0];
    if(!item)return;
    const btns=[];
    btns.push('<button type="button" data-act="replace" data-id="'+id+'">แทนที่ด้วยไฟล์…</button>');
    btns.push('<button type="button" data-act="rename" data-id="'+id+'">เปลี่ยนชื่อ</button>');
    if(item.replaced)btns.push('<button type="button" data-act="reset" data-id="'+id+'">คืนค่าเริ่มต้น</button>');
    if(item.custom&&!item.builtin)btns.push('<button type="button" class="danger" data-act="delete" data-id="'+id+'">ลบ</button>');
    m.innerHTML=btns.join('');
    m.hidden=false;
    const r=(anchor&&anchor.getBoundingClientRect)?anchor.getBoundingClientRect():{left:12,right:12,bottom:80,top:80};
    const w=m.offsetWidth||180,h=m.offsetHeight||120;
    let x=Math.min(window.innerWidth-w-8,Math.max(8,r.right-w));
    let y=r.bottom+6;
    if(y+h>window.innerHeight-8)y=Math.max(8,r.top-h-6);
    m.style.left=x+'px';m.style.top=y+'px';
  }
  function ensureFile(){
    let inp=$el('op-sfxfile');
    if(inp)return inp;
    inp=document.createElement('input');
    inp.type='file';
    inp.id='op-sfxfile';
    inp.accept='audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-wav,audio/wave,audio/ogg,audio/vorbis,.mp3,.m4a,.aac,.wav,.ogg';
    inp.setAttribute('aria-hidden','true');
    inp.addEventListener('change',function(){
      const f=inp.files&&inp.files[0];
      const pend=SFX.pending||{};
      SFX.pending=null;
      inp.value='';
      if(!f)return;
      importFile(f,{replace:pend.replace,add:!!pend.add}).then(function(res){
        if(!res||!res.ok){try{toast(res&&res.error||'ไม่สามารถนำเข้าเสียงได้')}catch(e){}}
        else try{toast('บันทึกเสียงไว้ในเครื่องแล้ว',3000,true)}catch(e){}
      }).catch(function(e){try{toast(e&&e.message||'ไม่สามารถนำเข้าเสียงได้')}catch(_){}});
    });
    document.body.appendChild(inp);
    return inp;
  }
  function pickFile(opts){
    SFX.pending=opts||{};
    const inp=ensureFile();
    try{inp.click()}catch(e){try{toast('เปิดตัวเลือกไฟล์ไม่สำเร็จ')}catch(_){}}
  }
  function renderGrid(){
    const sh=$el('op-sfxsheet');if(!sh)return;
    const g=sh.querySelector('.sfx-grid');if(!g)return;
    const items=listMeta();
    let html=items.map(function(it){
      const flag=it.replaced||(!it.builtin&&it.custom)?'<span class="sfx-customflag">'+(it.replaced?'แก้':'ของฉัน')+'</span>':'';
      return '<button type="button" class="sfx-pad" data-sfx="'+it.id+'" aria-label="'+esc(it.lab)+' ('+esc(it.en)+')">'+flag+
        '<span class="sfx-en">'+esc(it.en)+'</span><span class="sfx-lab">'+esc(it.lab)+'</span>'+
        '<span class="sfx-more" data-sfxmore="'+it.id+'" aria-label="ตัวเลือก '+esc(it.lab)+'" role="button">⋯</span></button>';
    }).join('');
    if(customCount()<MAX_CUSTOM){
      html+='<button type="button" class="sfx-pad sfx-add" data-sfxadd="1" aria-label="เพิ่มเสียงของฉัน"><span class="sfx-en">add</span><span class="sfx-lab">+ เพิ่ม</span></button>';
    }
    g.innerHTML=html;
  }
  function bindPadGestures(d){
    if(d._sfxg)return;d._sfxg=1;
    let holdT=0,holdId='',ignoreClick=false;
    d.addEventListener('pointerdown',function(e){
      const more=e.target.closest('[data-sfxmore]');
      if(more){e.preventDefault();e.stopPropagation();showMenu(more.getAttribute('data-sfxmore'),more);return}
      const add=e.target.closest('[data-sfxadd]');
      if(add){e.preventDefault();e.stopPropagation();hideMenu();pickFile({add:true});return}
      const p=e.target.closest('[data-sfx]');
      if(!p)return;
      const id=p.getAttribute('data-sfx');
      holdId=id;ignoreClick=false;
      clearTimeout(holdT);
      holdT=setTimeout(function(){holdT=0;ignoreClick=true;showMenu(id,p)},520);
    });
    function cancelHold(){clearTimeout(holdT);holdT=0}
    d.addEventListener('pointerup',cancelHold);
    d.addEventListener('pointercancel',cancelHold);
    d.addEventListener('pointerleave',function(e){if(e.target===d)cancelHold()});
    d.addEventListener('click',function(e){
      if(e.target.closest('[data-sfxmore],[data-sfxadd]')){e.preventDefault();e.stopPropagation();return}
      const p=e.target.closest('[data-sfx]');
      if(!p)return;
      e.preventDefault();e.stopPropagation();
      if(ignoreClick){ignoreClick=false;return}
      play(p.getAttribute('data-sfx'));
      flash(p);
    });
  }
  function ensureSheet(){
    if($el('op-sfxsheet')){
      if(!$el('op-sfxmenu')){
        const m=document.createElement('div');m.id='op-sfxmenu';m.hidden=true;m.setAttribute('role','menu');document.body.appendChild(m);
        m.addEventListener('click',onMenu);
      }
      ensureFile();
      return;
    }
    const d=document.createElement('div');
    d.id='op-sfxsheet';
    d.setAttribute('role','dialog');
    d.setAttribute('aria-label','เสียงประกอบ');
    d.hidden=true;
    d.innerHTML=
      '<div class="sfx-h">'+
        '<b>SFX</b>'+
        '<label class="sfx-vol"><span>ระดับ</span><input type="range" id="op-sfxvol" min="0" max="100" value="'+Math.round(SFX.vol*100)+'" aria-label="ระดับเสียงประกอบ"></label>'+
        '<button type="button" class="sfx-x" id="op-sfxx" aria-label="ปิด">×</button>'+
      '</div>'+
      '<div class="sfx-grid"></div>';
    document.body.appendChild(d);
    const m=document.createElement('div');m.id='op-sfxmenu';m.hidden=true;m.setAttribute('role','menu');document.body.appendChild(m);
    m.addEventListener('click',onMenu);
    ensureFile();
    bindPadGestures(d);
    renderGrid();
    const sl=$el('op-sfxvol');
    if(sl)sl.addEventListener('input',function(){setVol(+sl.value/100)});
    const x=$el('op-sfxx');
    if(x)x.onclick=function(e){e.stopPropagation();close()};
    d.addEventListener('click',function(e){e.stopPropagation()});
  }
  function onMenu(e){
    const b=e.target.closest('[data-act]');if(!b)return;
    e.preventDefault();e.stopPropagation();
    const act=b.getAttribute('data-act'),id=b.getAttribute('data-id');
    hideMenu();
    if(act==='replace')pickFile({replace:id});
    else if(act==='rename')renamePrompt(id);
    else if(act==='reset')reset(id).then(function(r){if(r&&r.ok)try{toast('คืนค่าเริ่มต้นแล้ว',2500,true)}catch(e){}});
    else if(act==='delete')remove(id).then(function(r){if(r&&r.ok)try{toast('ลบแล้ว',2500,true)}catch(e){}});
  }
  function renamePrompt(id){
    const cur=(SFX.meta[id]&&SFX.meta[id].lab)||(defOf(id)&&defOf(id).lab)||'';
    const name=typeof prompt==='function'?prompt('ชื่อเสียงประกอบ',cur):cur;
    if(name==null)return;
    rename(id,name).then(function(r){if(!r||!r.ok)try{toast(r&&r.error||'เปลี่ยนชื่อไม่สำเร็จ')}catch(e){}});
  }
  async function importFile(file,opts){
    opts=opts||{};
    if(!file)return{ok:false,error:'ไม่มีไฟล์'};
    const name=(file.name||'audio').toLowerCase();
    const mime=(file.type||'').toLowerCase();
    const okType=/audio\/(mpeg|mp3|mp4|aac|wav|x-wav|wave|ogg|vorbis|x-m4a)|video\/mp4/.test(mime)||/\.(mp3|m4a|aac|wav|ogg)$/.test(name);
    if(!okType)return{ok:false,error:'รองรับเฉพาะไฟล์ mp3, m4a, wav หรือ ogg'};
    if(file.size>MAX_BYTES)return{ok:false,error:'ไฟล์ใหญ่เกิน 3 MB'};
    let buf;
    try{buf=await bufFromBlob(file)}catch(e){return{ok:false,error:'ถอดรหัสเสียงไม่ได้'}}
    if(!(buf instanceof AudioBuffer))return{ok:false,error:'ถอดรหัสเสียงไม่ได้'};
    if(buf.duration>MAX_SEC+0.05)return{ok:false,error:'ยาวเกิน 10 วินาที'};
    let id=opts.replace||null;
    if(id&&!defOf(id)&&!isCustomId(id))return{ok:false,error:'ไม่พบช่องเสียงนี้'};
    if(!id){
      if(opts.add===false)return{ok:false,error:'ไม่ระบุช่อง'};
      id=nextCustomId();
      if(!id)return{ok:false,error:'เพิ่มได้สูงสุด '+MAX_CUSTOM+' ช่อง'};
    }
    const d=defOf(id);
    const base=name.replace(/\.[a-z0-9]+$/,'');
    const lab=(opts.lab||opts.name||(SFX.meta[id]&&SFX.meta[id].lab)||(d&&d.lab)||base||'กำหนดเอง').toString().trim().slice(0,40);
    const en=(opts.en||(d&&d.en)||'custom').toString().trim().slice(0,40);
    const rec={id:id,lab:lab,en:en,mime:file.type||'audio/mpeg',blob:file,custom:true,replaces:d?id:undefined};
    try{await idbPut(rec)}catch(e){return{ok:false,error:'บันทึกในเครื่องไม่สำเร็จ'}}
    SFX.bufs[id]=buf;
    SFX.meta[id]={lab:lab,en:en,custom:true,replaced:!!d,mime:rec.mime};
    renderGrid();
    return{ok:true,id:id,lab:lab,duration:buf.duration};
  }
  async function rename(id,lab){
    lab=String(lab||'').trim().slice(0,40);
    if(!lab)return{ok:false,error:'กรอกชื่อก่อน'};
    const d=defOf(id);
    if(!d&&!isCustomId(id))return{ok:false,error:'ไม่พบช่องเสียงนี้'};
    let rec=null;
    try{
      const all=await idbAll();
      rec=all.filter(function(x){return x.id===id})[0]||null;
    }catch(e){}
    if(!rec){
      rec={id:id,lab:lab,en:(d&&d.en)||'custom',mime:'',custom:true,replaces:d?id:undefined,labelOnly:true};
    }else rec.lab=lab;
    try{await idbPut(rec)}catch(e){return{ok:false,error:'บันทึกชื่อไม่สำเร็จ'}}
    SFX.meta[id]=Object.assign({},SFX.meta[id]||{},{lab:lab,custom:!!(rec.blob||rec.data||isCustomId(id)),replaced:!!(d&&(rec.blob||rec.data||(SFX.meta[id]&&SFX.meta[id].replaced)))});
    if(d&&!(rec.blob||rec.data||(SFX.meta[id]&&SFX.meta[id].replaced))){
      // renamed a default without replacing audio — still remember the label
      SFX.meta[id].custom=true;
    }
    renderGrid();
    return{ok:true,id:id,lab:lab};
  }
  async function remove(id){
    if(!isCustomId(id))return{ok:false,error:'ช่องเริ่มต้นให้ใช้คืนค่าเริ่มต้น'};
    try{await idbDel(id)}catch(e){return{ok:false,error:'ลบไม่สำเร็จ'}}
    delete SFX.bufs[id];
    delete SFX.meta[id];
    renderGrid();
    return{ok:true,id:id};
  }
  async function reset(id){
    const d=defOf(id);
    if(!d)return{ok:false,error:'ไม่มีค่าเริ่มต้นสำหรับช่องนี้'};
    try{await idbDel(id)}catch(e){}
    delete SFX.meta[id];
    try{SFX.bufs[id]=await loadPack(id)}catch(e){delete SFX.bufs[id]}
    renderGrid();
    return{ok:true,id:id};
  }
  function bindBtns(){
    ['op-sfx','dd-sfx'].forEach(function(id){
      const b=$el(id);if(!b||b._sfx)return;b._sfx=1;
      b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();toggle()});
    });
  }
  function syncBtns(){
    ['op-sfx','dd-sfx'].forEach(function(id){
      const b=$el(id);if(!b)return;
      b.classList.toggle('on',!!SFX.open);
      b.setAttribute('aria-pressed',SFX.open?'true':'false');
    });
  }
  function open(){
    ensureSheet();bindBtns();
    const sh=$el('op-sfxsheet');if(!sh)return;
    sh.hidden=false;SFX.open=true;syncBtns();
    setVol(SFX.vol);
    renderGrid();
    preload();
    try{initAudio();if(ctx&&ctx.resume)ctx.resume()}catch(e){}
  }
  function close(){
    const sh=$el('op-sfxsheet');if(sh)sh.hidden=true;
    hideMenu();
    SFX.open=false;syncBtns();
  }
  function toggle(){if(SFX.open)close();else open()}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&SFX.open){if($el('op-sfxmenu')&&!$el('op-sfxmenu').hidden)hideMenu();else close()}});
  document.addEventListener('pointerdown',function(e){
    const t=e.target;
    if($el('op-sfxmenu')&&!$el('op-sfxmenu').hidden){
      if(!(t&&t.closest&&(t.closest('#op-sfxmenu')||t.closest('[data-sfxmore]'))))hideMenu();
    }
    if(!SFX.open)return;
    if(t&&t.closest&&(t.closest('#op-sfxsheet')||t.closest('#op-sfx')||t.closest('#dd-sfx')||t.closest('#op-sfxmenu')||t.closest('#op-sfxfile')))return;
    close();
  },true);
  // v1.0.34: SFX files load on first SFX-panel open / first pad tap (not on every app start) to save hosting bandwidth.
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){ensureSheet();bindBtns()});
  else{ensureSheet();bindBtns()}
  setInterval(bindBtns,800);
  window.__sfx={
    play:play,open:open,close:close,toggle:toggle,preload:preload,setVol:setVol,
    importFile:importFile,rename:rename,remove:remove,reset:reset,
    list:listMeta,render:renderGrid,
    get vol(){return SFX.vol},
    get isOpen(){return SFX.open},
    get ready(){return listMeta().filter(function(it){return !!SFX.bufs[it.id]}).length},
    get items(){return listMeta().map(function(it){return it.id})},
    get active(){return SFX.active.length},
    get bufs(){const o={};for(const k in SFX.bufs)o[k]=!!SFX.bufs[k];return o},
    get maxCustom(){return MAX_CUSTOM},
    get maxBytes(){return MAX_BYTES},
    get maxSec(){return MAX_SEC}
  };
})();
