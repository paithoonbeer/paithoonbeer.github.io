// Live metronome (independent AudioContext)
const LS='bp-metro';const S=Object.assign({bpm:100,sig:4,vol:1,out:'both'},JSON.parse(localStorage.getItem(LS)||'{}'));if(!S.v2){if(S.vol<=0.8)S.vol=1;S.v2=1;localStorage.setItem(LS,JSON.stringify(S))}
const save=()=>localStorage.setItem(LS,JSON.stringify(S));
let ctx,timer=null,next=0,beat=0,queue=[],raf=0,wake=null,master,el,taps=[];
const SIGS={1:'1/1',2:'2/4',3:'3/4',4:'4/4',6:'6/8'};
// v1.24 loud chain: voices -> drive -> compressor -> makeup -> volume(0..2) -> limiter -> soft clip -> L/R
function chain(c){const inp=c.createGain(),drive=c.createGain(),cmp=c.createDynamicsCompressor(),mk=c.createGain(),vol=c.createGain(),lim=c.createDynamicsCompressor(),sh=c.createWaveShaper();
 drive.gain.value=1.6;cmp.threshold.value=-20;cmp.knee.value=6;cmp.ratio.value=5;cmp.attack.value=0.0008;cmp.release.value=0.06;mk.gain.value=2.4;
 lim.threshold.value=-2;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=0.0003;lim.release.value=0.05;
 const n=2048,cv=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;cv[i]=Math.tanh(1.5*x)/Math.tanh(1.5)*0.985}sh.curve=cv;sh.oversample='none';
 inp.connect(drive);drive.connect(cmp);cmp.connect(mk);mk.connect(vol);vol.connect(lim);lim.connect(sh);vol.gain.value=S.vol;return{inp,vol,out:sh}}
let CH=null;
function initCtx(){const sh=window.__bpCtx&&window.__bpCtx();if(ctx&&ctx===sh&&ctx.state!=='closed')return;if(ctx&&!sh&&ctx.state!=='closed')return;try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}ctx=sh||new (window.AudioContext||window.webkitAudioContext)();NB=null;CH=chain(ctx);master=CH.inp;const m=ctx.createChannelMerger(2);CH._m=m;route();m.connect(ctx.destination)}
function route(){if(!CH)return;const m=CH._m,o=CH.out;o.disconnect();if(S.out!='right')o.connect(m,0,0);if(S.out!='left')o.connect(m,0,1)}
const SOUNDS={beep:'บี๊บ',wood:'เคาะไม้',cow:'คาวเบลล์',rim:'ริมช็อต',hat:'ไฮแฮต',kick:'กระเดื่อง',clave:'คลาฟ',digi:'ดิจิทัล'};
let NB=null;function noise(){if(NB)return NB;NB=ctx.createBuffer(1,ctx.sampleRate*0.2,ctx.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return NB}
function env(g,t,pk,dec){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(pk,t+0.001);g.gain.setValueAtTime(pk,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+dec)}
function osc(t,type,f,pk,dec,f2){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dec);env(g,t,pk,dec);o.connect(g);g.connect(master);o.start(t);o.stop(t+dec+0.02)}
function nz(t,ft,f,q,pk,dec){const n=ctx.createBufferSource(),bq=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noise();bq.type=ft;bq.frequency.value=f;bq.Q.value=q;env(g,t,pk,dec);n.connect(bq);bq.connect(g);g.connect(master);n.start(t);n.stop(t+dec+0.02)}
let CLK=0,ACC=0;
function click(t,acc,sec){CLK++;if(acc)ACC++;const k=acc?1:sec?.85:.72,u=acc?1.3:sec?1.12:1;switch(S.snd||'beep'){
 case 'wood':nz(t,'bandpass',2400*u,5,k*3.2,0.045);osc(t,'triangle',1250*u,k*0.9,0.035);break;
 case 'cow':osc(t,'square',800*u,k*0.55,0.11);osc(t,'square',1200*u,k*0.5,0.11);nz(t,'bandpass',3000,3,k*0.6,0.02);break;
 case 'rim':nz(t,'bandpass',3200,1.5,k*2.2,0.03);osc(t,'triangle',1800*u,k*0.9,0.025);break;
 case 'hat':nz(t,'highpass',acc?4500:6000,0.8,k*1.6,acc?0.08:0.045);nz(t,'bandpass',3500,2,k*0.9,0.03);break;
 case 'kick':osc(t,'sine',acc?170:130,k*1.0,0.14,45);osc(t,'square',1800,k*0.45,0.012);nz(t,'bandpass',2500,1,k*0.8,0.012);break;
 case 'clave':osc(t,'sine',2500*u,k*1.0,0.04);osc(t,'triangle',2500*u,k*0.5,0.03);break;
 case 'digi':osc(t,'square',1600*u,k*0.7,0.035);break;
 default:osc(t,'square',(acc?2000:sec?1600:1300),k*0.6,0.05);osc(t,'sine',(acc?2000:sec?1600:1300),k*0.6,0.05)}}
function sched(){while(next<ctx.currentTime+0.12){const b=beat%S.sig;click(next,b==0&&S.sig>1,S.sig==6&&b==3);queue.push({b,t:next});next+=60/S.bpm;beat++}}
function draw(){const now=ctx.currentTime;let cur=null;while(queue.length&&queue[0].t<=now){cur=queue.shift()}if(cur!=null)emit(cur.b);if(cur!=null&&el){el.querySelectorAll('.ml').forEach((l,i)=>l.classList.toggle('hit',i==cur.b));el.querySelector('#mbeat').textContent=cur.b+1}raf=requestAnimationFrame(draw)}
async function start(){initCtx();const rp=ctx.resume();await Promise.race([rp.catch(()=>{}),new Promise(r=>setTimeout(r,300))]);beat=0;queue=[];next=ctx.currentTime+0.06;sched();timer=setInterval(sched,25);raf=requestAnimationFrame(draw);
 try{if('wakeLock' in navigator)wake=await navigator.wakeLock.request('screen')}catch(e){}ui()}
function stop(){clearInterval(timer);timer=null;cancelAnimationFrame(raf);queue=[];if(wake){wake.release().catch(()=>{});wake=null}if(el)el.querySelectorAll('.ml').forEach(l=>l.classList.remove('hit'));ui()}
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState=='visible'&&timer&&!wake){try{wake=await navigator.wakeLock.request('screen')}catch(e){}}});
function setBpm(v){S.bpm=Math.max(30,Math.min(300,Math.round(v)));save();ui()}
function tap(){const n=performance.now();taps=taps.filter(t=>n-t<2500);taps.push(n);if(taps.length>6)taps.shift();if(taps.length>=2){const d=(taps[taps.length-1]-taps[0])/(taps.length-1);setBpm(60000/d)}}
const LIS=new Set();function emit(b){LIS.forEach(f=>{try{f(b,S,!!timer)}catch(e){}})}
function ui(){emit(null);if(!el)return;el.querySelector('#mbpm').textContent=S.bpm;el.querySelector('#kbpm').textContent=S.bpm;el.querySelector('#kcap').style.transform=`rotate(${(S.bpm-30)*6}deg)`;el.querySelector('#knob').setAttribute('aria-valuenow',S.bpm);const g=el.querySelector('#mgo');g.textContent=timer?'⏹ หยุด':'▶ เริ่ม';g.classList.toggle('on',!!timer);g.classList.toggle('playing',!!timer);
 el.querySelectorAll('[data-sig]').forEach(b=>b.classList.toggle('on',+b.dataset.sig==S.sig));el.querySelectorAll('[data-snd]').forEach(b=>b.classList.toggle('on',b.dataset.snd==(S.snd||'beep')));el.querySelectorAll('[data-out]').forEach(b=>b.classList.toggle('on',b.dataset.out==S.out));
 el.querySelector('#mvol').value=Math.round(S.vol*100);el.querySelector('#mvv').textContent=Math.round(S.vol*100)+'%';
 const L=el.querySelector('#mlights');if(L.children.length!=S.sig)L.innerHTML=Array.from({length:S.sig},(_,i)=>`<span class="ml ${i==0&&S.sig>1?'acc':''}">${i+1}</span>`).join('')}
export function metroEl(){if(el)return el;el=document.createElement('div');el.id='metro';el.innerHTML=`
<div class="mwrap">
 <div class="mcard mtop" style="display:none" aria-hidden="true"><!-- v1.84.2: big BPM card removed (dial shows BPM); elements kept for JS --><div class="small">จังหวะ <span id="mbeat"></span></div><div class="mbig"><span id="mbpm">100</span><small> BPM</small></div><div id="mlights"></div></div>
 <div class="kwrap"><div id="knob" aria-label="หมุนปรับ BPM" role="slider" tabindex="0"><div class="kticks">${Array.from({length:60},(_,i)=>`<i style="transform:rotate(${i*6}deg)" class="${i%5?'':'maj'}"></i>`).join('')}</div><div class="kcap" id="kcap"><b class="knotch"></b><span class="kgrip"></span></div><div class="kval" id="mtap" role="button" tabindex="0" aria-label="แตะจับจังหวะ"><span id="kbpm">100</span><small>👆 แตะ</small></div></div></div>
 <div class="small" style="text-align:center">หมุนวงนอกเพื่อปรับ BPM • แตะตรงกลางเพื่อจับจังหวะ</div>
 <div class="mgrid4"><button data-d="-5">−5</button><button data-d="-1">−1</button><button data-d="1">+1</button><button data-d="5">+5</button></div>
 <button id="mgo" class="mgo">▶ เริ่ม</button>
 <div class="mcard"><div class="lb">เสียงคลิก</div><div class="mgrid4 msnd">${Object.entries(SOUNDS).map(([k,v])=>`<button data-snd="${k}">${v}</button>`).join('')}</div></div>
 <div class="mcard"><div class="lb">ห้องเพลง</div><div class="mgrid4 msig">${Object.entries(SIGS).map(([k,v])=>`<button data-sig="${k}">${v}</button>`).join('')}</div></div>
 <div class="mcard"><div class="lb">ออกเสียงที่หู</div><div class="mgrid3"><button data-out="left">ซ้าย</button><button data-out="both">ทั้งสอง</button><button data-out="right">ขวา</button></div></div>
 <div class="mcard"><div class="lb">ความดัง <span id="mvv"></span></div><input id="mvol" type="range" min="0" max="200" step="5"><div class="small">เกิน 100% = บูสต์ (มีลิมิตเตอร์กันแตก)</div></div>
 <div class="small">เมโทรนอมเล่นแยกจากเพลง (เปิดพร้อมเพลงได้) • ใช้ได้แบบออฟไลน์</div>
</div>`;
 el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.d)setBpm(S.bpm+(+b.dataset.d));else if(b.id=='mgo')timer?stop():start();
  else if(b.dataset.snd){S.snd=b.dataset.snd;save();ui();initCtx();ctx.resume().then(()=>click(ctx.currentTime+0.02,true,false))}else if(b.dataset.sig){S.sig=+b.dataset.sig;beat=0;save();ui()}else if(b.dataset.out){S.out=b.dataset.out;save();route();ui()}});
 const kn=el.querySelector('#knob');let drag=null;
 const ang=e=>{const r=kn.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI};
 const step=n=>{const o=S.bpm;setBpm(S.bpm+n);if(S.bpm!=o){if(navigator.vibrate)try{navigator.vibrate(4)}catch(e){}kn.classList.remove('tick');void kn.offsetWidth;kn.classList.add('tick')}};
 const inC=e=>{const r=kn.getBoundingClientRect();const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);return Math.hypot(dx,dy)<r.width*0.25};
 kn.addEventListener('pointerdown',e=>{e.preventDefault();kn.setPointerCapture(e.pointerId);drag={a:ang(e),acc:0,x:e.clientX,y:e.clientY,t:performance.now(),c:inC(e),moved:false,turned:0};kn.classList.add('turning');if(drag.c)el.querySelector('#mtap').classList.add('press')});
 kn.addEventListener('pointermove',e=>{if(!drag)return;e.preventDefault();if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>10)drag.moved=true;if(inC(e)){drag.a=ang(e);return}const a=ang(e);let d=a-drag.a;if(d>180)d-=360;if(d<-180)d+=360;drag.a=a;drag.acc+=d;const n=Math.trunc(drag.acc/6);if(n){drag.acc-=n*6;step(n)}});
 const end=e=>{if(drag&&e&&e.type=='pointerup'&&drag.c&&!drag.moved&&performance.now()-drag.t<600)tap();drag=null;kn.classList.remove('turning');el.querySelector('#mtap').classList.remove('press')};kn.addEventListener('pointerup',end);kn.addEventListener('pointercancel',end);
 kn.addEventListener('wheel',e=>{e.preventDefault();step(e.deltaY<0?1:-1)},{passive:false});
 kn.addEventListener('keydown',e=>{if(e.key=='ArrowUp'||e.key=='ArrowRight'){e.preventDefault();step(1)}if((e.key==' '||e.key=='Enter')&&e.target.id=='mtap'){e.preventDefault();tap()}if(e.key=='ArrowDown'||e.key=='ArrowLeft'){e.preventDefault();step(-1)}});
 el.querySelector('#mvol').oninput=e=>{S.vol=e.target.value/100;save();if(CH)CH.vol.gain.setTargetAtTime(S.vol,ctx.currentTime,0.01);ui()};
 ui();return el}
window.__metro={get ctx(){return ctx},get S(){return S},get clicks(){return CLK},get accents(){return ACC},get state(){return{...S,running:!!timer,ctxTime:ctx&&ctx.currentTime,sched:beat}},setBpm:setBpm,
 // v1.0.36: one-page นอมสด block drives the same engine (no second metronome)
 start:()=>{if(!timer)return start()},stop:()=>{if(timer)stop()},toggle:()=>timer?stop():start(),tap:tap,get taps(){return taps.length},
 setOut:o=>{if(o!='left'&&o!='right')o='both';S.out=o;save();route();ui()},setSig:n=>{n=+n;if(!SIGS[n])return;S.sig=n;beat=0;save();ui()},
 on:f=>{LIS.add(f);return()=>LIS.delete(f)},off:f=>LIS.delete(f),sigs:SIGS};

window.__metroNew={async render(name,vol){const sv=[ctx,master,NB,S.snd,CH,S.vol];ctx=new OfflineAudioContext(1,22050,44100);NB=null;S.vol=vol;CH=chain(ctx);master=CH.inp;CH.out.connect(ctx.destination);S.snd=name;click(0.01,true,false);click(0.26,false,false);const b=await ctx.startRendering();[ctx,master,NB,S.snd,CH,S.vol]=sv;return b.getChannelData(0)}};
