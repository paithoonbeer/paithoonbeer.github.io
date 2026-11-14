// SetSod admin (v1.66). Owner-only; Firestore rules enforce it (email + email_verified).
const V='13.1.0',G=`https://www.gstatic.com/firebasejs/${V}/`;
const OWNER='paithooningrad@gmail.com';
const H=location.hostname;
const CFG={apiKey:'AIzaSyDrGvs1pavaMgUUnHfFIjelyctflKZUAdM',authDomain:['beer-player.web.app','setsod.web.app'].includes(H)?H:'puenduang.firebaseapp.com',projectId:'puenduang',appId:'1:102670517075:web:3b5086ac710460a3a817a6',messagingSenderId:'102670517075'};
const [AP,A,FM17]=await Promise.all([import(G+'firebase-app.js'),import(G+'firebase-auth.js'),import(G+'firebase-firestore.js')]);const F={...FM17};
// v1.84.17 privacy mirror: every admin write to bp_plan/bp_pay refreshes bp_pub/{uid} (member-readable status only)
const _sd17=F.setDoc,_ud17=F.updateDoc,tm17=v=>v&&typeof v.toMillis=='function'?v.toMillis():v;
async function st17(u){const G=F.getDocFromServer||F.getDoc,g=c=>G(F.doc(db,c,u));const [a,b]=await Promise.all([g('bp_plan'),g('bp_pay')]);const p=a.exists()?a.data():null,y=b.exists()?b.data():null;
 if(!p&&!y)return 0;if((p&&!p.s)||(y&&!y.s))return 0;const d={p:p?p.p:'',s:p?p.s:null,e:p&&p.e||null,x:p&&p.x||[],xe:p&&p.xe||null,pl:y?y.pl:'',ps:y?y.st:'',py:y?y.s:null};
 try{const o=await G(F.doc(db,'bp_pub',u));if(o.exists()){const z=o.data(),q={};for(const i in d)q[i]=z[i]===undefined?null:z[i];if(JSON.stringify(q,(k,v)=>tm17(v))==JSON.stringify(d,(k,v)=>tm17(v)))return 0}}catch(e){}
 await _sd17(F.doc(db,'bp_pub',u),{...d,t:F.serverTimestamp()});return 1}
const H17=r=>{const m=/^bp_(plan|pay)\/([^/]+)$/.exec(r&&r.path||'');if(m)st17(m[2]).catch(e=>console.warn('st17',m[2],e))};
F.setDoc=async(r,...a)=>{const v=await _sd17(r,...a);H17(r);return v};F.updateDoc=async(r,...a)=>{const v=await _ud17(r,...a);H17(r);return v};
async function mig17(){const ids=new Set();for(const c of ['bp_plan','bp_pay'])(await F.getDocs(F.collection(db,c))).docs.forEach(d=>ids.add(d.id));let w=0,f=0;
 for(const u of ids){try{w+=await st17(u)}catch(e){f++;console.warn('mig17',u,e)}}const r={n:ids.size,w,f,at:new Date().toISOString()};try{localStorage.setItem('mig17',JSON.stringify(r))}catch(e){}return r}
window.__mig17=mig17;let MIG17=0;setInterval(()=>{if(ROLE!='owner'||MIG17||!$('nav')||$('nav').hidden)return;MIG17=1;mig17().then(r=>{console.log('mig17',r);toast(`🔒 ซิงก์สถานะแพ็กเกจ ${r.n} บัญชี (อัปเดต ${r.w}${r.f?' · ไม่สำเร็จ '+r.f:''})`)}).catch(e=>{MIG17=0;console.warn('mig17',e)})},3000);
const app=AP.initializeApp(CFG,'adm');const auth=A.initializeAuth(app,{persistence:[A.indexedDBLocalPersistence,A.browserLocalPersistence],popupRedirectResolver:A.browserPopupRedirectResolver});const db=F.getFirestore(app);
if(/^(localhost|127\.0\.0\.1)$/.test(H)&&localStorage.getItem('bp-emu')){A.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});F.connectFirestoreEmulator(db,'127.0.0.1',8080)}
const $=id=>document.getElementById(id),M=$('m');
let LIVE=null;function liveOff(){if(LIVE){try{LIVE()}catch(e){}LIVE=null}}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I={chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',msg:'<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>',home:'<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',card:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',band:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',db:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',mega:'<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',tool:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',side:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 band:'<circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
 db:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',act:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
 alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',cloud:'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',ref:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',google:'<circle cx="12" cy="12" r="9"/><path d="M12 12h8"/>'};
const ic=n=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
function toast(t,ms=3500){const e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>e.style.display='none',ms)}
const day=(o=0)=>new Date(Date.now()+7*3600e3-o*864e5).toISOString().slice(0,10);
const TY={login:'เข้าใช้งาน',band_create:'สร้างวง',band_join:'เข้าร่วมวง',song_up:'อัปเพลงเข้าวง',set_save:'บันทึกลิสต์',set_band:'บันทึกลิสต์ให้วง',err:'ข้อผิดพลาด',hidden:'ซ่อนแอปขณะเล่น',kill:'แอปถูกปิด/รีสตาร์ท',stall:'เสียงสะดุด/เรนเดอร์ล้ม'};
const SITE={'paithoonbeer':'เว็บแอป (paithoonbeer.github.io)','localhost':'แอป Android (APK)','setsod':'เว็บเก่า (setsod.web.app)','beer-player':'เว็บเก่า (beer-player)','beer-player-pro':'ลูกค้า (beer-player-pro)'};
const tms847=t=>{try{if(t==null)return 0;if(typeof t.toMillis=='function')return t.toMillis();if(typeof t=='number')return t<1e12?t*1000:t;if(typeof t=='string'){const v=Date.parse(t);return isNaN(v)?0:v}if(t.seconds!=null)return t.seconds*1000+Math.round((t.nanoseconds||0)/1e6);if(t instanceof Date)return t.getTime()}catch(e){}return 0};
const fmtT=t=>{const v=tms847(t);if(!v)return '—';try{return new Date(v).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' น.'}catch(e){return '—'}};
const QUOTA=1024**3,CAP=700*1024**2;

let LMSG='';function loginUI(msg){msg=msg||LMSG;LMSG='';$('nav').hidden=true;$('out').hidden=true;$('who').textContent='';
 M.innerHTML=`<div class="login card"><h2 style="margin-top:0">${ic('users')} เข้าสู่ระบบผู้ดูแล</h2><div class="s">เฉพาะเจ้าของและพนักงานที่ได้รับสิทธิ์ · ใช้อีเมลที่เจ้าของเพิ่มให้</div>
 ${msg?`<div class="tag err">${esc(msg)}</div>`:''}
 <button class="pri" id="g">${ic('google')} เข้าด้วย Google</button>
 <div class="s" style="text-align:center">หรือ</div><input id="em" type="email" placeholder="อีเมลของคุณ" value="" autocomplete="username"><input id="pw" type="password" placeholder="รหัสผ่าน" autocomplete="current-password"><button id="ep">เข้าด้วยอีเมล</button></div>`;
 $('g').onclick=async()=>{try{await A.signInWithPopup(auth,new A.GoogleAuthProvider())}catch(e){loginUI(e.code=='auth/unauthorized-domain'?'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Auth — ใช้อีเมล/รหัสผ่าน หรือเปิดหน้าแอดมินที่ https://paithoonbeer.github.io/admin/':(e.code||e.message))}};
 $('ep').onclick=async()=>{try{await A.signInWithEmailAndPassword(auth,$('em').value.trim(),$('pw').value)}catch(e){loginUI(e.code||e.message)}}}
$('out').onclick=()=>A.signOut(auth);
let VT=localStorage.getItem('adm-vt')||'ov',TAB=({bd:'pl',us:'pl',tl:'pl',an:'ov'})[VT]||VT;
// v1.78 PC portal: sidebar tabs (ordered by importance). Some tabs reuse an existing renderer and show only their cards.
const NAV78=[['ov','ภาพรวม','home'],['pl','แพ็กเกจ/สลิป','card'],['ch','แชท','chat'],['fb','ความเห็น','msg'],['bd','วง · ที่นั่ง','band'],['qt','โควตา','db'],['an','ประกาศ','mega'],['us','ผู้ใช้','user'],['lg','บันทึกการใช้งาน','list'],['er','ข้อผิดพลาด','alert'],['st','พนักงาน (สิทธิ์)','users'],['tl','เครื่องมือครั้งเดียว','tool']];
// v1.82 staff: ROLE owner|staff, PERM = allowed tab keys. st/tl owner-only.
let ROLE='',PERM=new Set();const STK=['ov','pl','ch','bd','qt','an','us','lg','er'],STL={ov:'ภาพรวม',pl:'แพ็กเกจ/สลิป (ยืนยัน/ยกเลิกสลิป)',ch:'แชทลูกค้า',bd:'วง · ที่นั่ง',qt:'โควตา',an:'ประกาศ',us:'ผู้ใช้',lg:'บันทึกการใช้งาน',er:'ข้อผิดพลาด'};
const CAN=k=>ROLE=='owner'||(ROLE=='staff'&&k!='st'&&k!='tl'&&(k==='fb'||PERM.has(k)));
const GRP82={ov:'งานประจำวัน',qt:'ระบบ',st:'เฉพาะเจ้าของ'};
const RT78={bd:'pl',us:'pl',tl:'pl',an:'ov',st:'st'};
function nav78(){const n=$('nav');if(n.dataset.v78)return;n.dataset.v78=1;n.innerHTML=NAV78.filter(([k])=>CAN(k)).map(([k,t,i])=>(GRP82[k]&&(ROLE=='owner'||k!='st')?`<div class="grp82">${GRP82[k]}</div>`:'')+`<button data-t="${k}" class="${k==VT?'on':''}" title="${t}">${ic(i)}<span class="lb">${t}</span><span class="bdg" hidden></span></button>`).join('')}
function badge78(k,v){const b=document.querySelector(`#nav [data-t="${k}"] .bdg`);if(!b)return;b.textContent=v||'';b.hidden=!v;bell78()}
function bell78(){const n=+((document.querySelector('#nav [data-t="pl"] .bdg')||{}).textContent||0)+ +((document.querySelector('#nav [data-t="ch"] .bdg')||{}).textContent||0),q=!(document.querySelector('#nav [data-t="qt"] .bdg')||{hidden:true}).hidden,c=$('bell78n');if(c){c.textContent=n||(q?'!':'');c.hidden=!(n||q)}}
function tag78(){if($('nav').hidden){[...M.children].forEach(e=>e.hidden=false);return}const v=VT;M.dataset.v=v;[...M.children].forEach(e=>{const k=['payc','cfgc','payh','pyflow','ctc81'].includes(e.id)?'pl':e.id=='bandc'?'bd':e.id=='ann'?'an':e.id=='tl78'?'tl':TAB=='pl'?'us':TAB=='ov'?'ov':v;if(e.dataset.sec!==k)e.dataset.sec=k;const h=k!=v;if(e.hidden!==h)e.hidden=h});
 if(v=='tl')tools78()}
function tools78(){let c=$('tl78');if(!c){c=document.createElement('section');c.className='card';c.id='tl78';c.dataset.sec='tl';M.prepend(c);
  c.innerHTML=`<h2 style="margin-top:0">${ic('tool')} เครื่องมือครั้งเดียว</h2><p class="mut">ใช้ตอน deploy ระบบใหม่เท่านั้น · กดซ้ำได้ ไม่เสียหาย</p><div class="tl78r"><div><b>ให้ Band ฟรีกับเจ้าของวงเดิม</b><div class="mut">ก่อนเปิดใช้ระบบแพ็กเกจ: เจ้าของวงทุกคนได้ Band (ไม่หมดอายุ) และที่นั่ง = จำนวนสมาชิกปัจจุบัน (อย่างน้อย 5)</div></div><div id="tl78g"></div></div><div class="tl78r"><div><b>นับพื้นที่ใหม่ทุกวง</b><div class="mut">หลังอัปเดต 1.77: รวมขนาดไฟล์จากรายการเพลง ให้วงเดิมมีตัวนับพื้นที่</div></div><div><button id="tl78q">นับใหม่ทุกวง</button> <span id="tl78qr" class="mut"></span></div></div>`;
  $('tl78q').onclick=async()=>{$('tl78qr').textContent='⏳';let n=0;try{const r=await __qt.qtData();for(const b of r){await __qt.recount(b);n++}$('tl78qr').textContent='✅ '+n+' วง'}catch(e){$('tl78qr').textContent='❌ '+(e.code||e.message)}}}
 const g=$('gfgo'),w=$('tl78g');if(g&&w&&!w.contains(g)){w.appendChild(g);const r=$('gfr');if(r)w.appendChild(r);const d=document.querySelector('#bandc details');if(d&&!d.querySelector('button'))d.remove()}}
let T78=0;new MutationObserver(()=>{clearTimeout(T78);T78=setTimeout(()=>{try{tag78()}catch(e){}},30)}).observe(document.getElementById('m'),{childList:true,subtree:true});
$('nav').onclick=e=>{const b=e.target.closest('[data-t]');if(!b||!CAN(b.dataset.t))return;const pv=TAB;VT=b.dataset.t;TAB=RT78[VT]||VT;localStorage.setItem('adm-vt',VT);document.body.classList.remove('drw');[...$('nav').querySelectorAll('[data-t]')].forEach(x=>x.classList.toggle('on',x===b));if(pv==TAB&&M.children.length&&M.dataset.v){tag78();return}show()};
A.onAuthStateChanged(auth,async u=>{if(!u){liveOff();return loginUI();}
 let tk=null;try{tk=(await A.getIdTokenResult(u,true)).claims}catch(e){}
 const gv=tk&&tk.firebase&&tk.firebase.sign_in_provider=='google.com';
 const em=String(u.email||'').trim().toLowerCase();ROLE='';PERM=new Set();
 if(!(u.emailVerified||gv)){LMSG='บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล (อีเมลยังไม่ยืนยัน)';A.signOut(auth);return}
 if(em===OWNER)ROLE='owner';else if(em){try{const d=await F.getDoc(F.doc(db,'bp_staff',em));if(d.exists()&&d.data().on===true){ROLE='staff';const pm=d.data().perms||{};STK.forEach(k=>{if(pm[k]===true)PERM.add(k)})}}catch(e){console.warn('staff',e)}}
 if(!ROLE||(ROLE=='staff'&&!PERM.size)){LMSG='บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล'+(ROLE=='staff'?' (ยังไม่ได้รับสิทธิ์เมนูใด)':'');ROLE='';A.signOut(auth);return}
 if(!CAN(VT)){VT=NAV78.map(x=>x[0]).find(CAN)||'ov';TAB=RT78[VT]||VT;localStorage.setItem('adm-vt',VT)}
 $('nav').dataset.v78='';
 $('who').innerHTML=esc(u.email)+` <span class="tag">${ROLE=='owner'?'เจ้าของ':'พนักงาน'}</span>`;$('who').className='s hide-s';$('out').hidden=false;$('nav').hidden=false;nav78();show()});
function show(){liveOff();if(!CAN(VT)){VT=NAV78.map(x=>x[0]).find(CAN)||'ov';TAB=RT78[VT]||VT}if(TAB=='st')return staff82();return TAB=='ch'?chat81():TAB=='fb'?feedback20():TAB=='ov'?overview():TAB=='lg'?logs():TAB=='pl'?plans():TAB=='qt'?quotaTab():errors()}
const cnt=async q=>(await F.getCountFromServer(q)).data().count;
const card=(i,k,v,s,bar)=>`<div class="card"><div class="k">${ic(i)}${k}</div><div class="v">${v}</div>${s?`<div class="s">${s}</div>`:''}${bar!=null?`<div class="bar"><i style="width:${Math.min(100,bar).toFixed(1)}%"></i></div>`:''}</div>`;
const mb=b=>(b/1048576).toFixed(b<1048576*10?1:0)+' MB';

async function overview(){M.innerHTML='<div class="mut">กำลังโหลด…</div>';
 try{const now=Date.now(),ts=d=>F.Timestamp.fromMillis(now-d*864e5);const reg=F.collection(db,'bp_reg');
  const SF=p=>p.then(v=>v,e=>{console.warn('overview',e);return {__e:e.code||e.message||'error'}});const ER=v=>v&&v.__e!==undefined;
  const [nu,nb,d1,d7,d30,bs0,st0]=await Promise.all([SF(cnt(reg)),SF(cnt(F.collection(db,'bp_users'))),SF(cnt(F.query(reg,F.where('l','>=',ts(1))))),SF(cnt(F.query(reg,F.where('l','>=',ts(7))))),SF(cnt(F.query(reg,F.where('l','>=',ts(30))))),
   SF(F.getDocs(F.collection(db,'bands'))),SF(F.getDocs(F.query(F.collection(db,'bp_stats'),F.where('d','>=',day(29)))))]);
  const bs=ER(bs0)?{size:0,forEach(){},docs:[]}:bs0,st=ER(st0)?{size:0,forEach(){}}:st0;
  // per-band songs count + size (collection scope: no collection-group index needed)
  let ns=0,fz=0,sErr=ER(bs0)?bs0.__e:'';await Promise.all(bs.docs.map(async b=>{const r=await SF(F.getAggregateFromServer(F.collection(db,'bands',b.id,'songs'),{n:F.count(),z:F.sum('fz')}));if(ER(r)){sErr=r.__e;return}const d=r.data();ns+=d.n||0;fz+=d.z||0}));
  const V=v=>ER(v)?`<span class="tag err" title="${esc(v.__e)}">—</span>`:v;
  let mem=0,uniq=new Set();bs.forEach(d=>{const m=d.data().mu||[];mem+=m.length;m.forEach(x=>uniq.add(x))});
  const S={};st.forEach(d=>S[d.id]=d.data());const days=[...Array(30)].map((_,i)=>day(29-i));
  const mx=Math.max(1,...days.map(d=>Math.max(S[d]?.dau||0,S[d]?.err||0)));
  const sum=k=>days.reduce((a,d)=>a+(S[d]?.[k]||0),0);
  if(TAB!='ov')return;M.innerHTML=`<div class="grid">
   ${card('users','ผู้ใช้ทั้งหมด',V(nu),`สำรองข้อมูลในบัญชี ${ER(nb)?'—':nb} คน`)}
   ${card('act','ใช้งาน 24 ชม.',V(d1),`7 วัน ${V(d7)} · 30 วัน ${V(d30)}`)}
   ${card('band','วง',ER(bs0)?V(bs0):bs.size,`สมาชิกรวม ${mem} (ไม่ซ้ำ ${uniq.size})`)}
   ${card('music','เพลงของวง',sErr?V({__e:sErr}):ns,sErr?'บางวงโหลดไม่ได้: '+esc(sErr):'')}
   ${card('db','พื้นที่ไฟล์เสียงวง',mb(fz),`เพดานแอป 700 MB · โควตาฟรี 1 GiB (${(fz/QUOTA*100).toFixed(1)}%)`,fz/CAP*100)}
   ${card('alert','ข้อผิดพลาด 30 วัน',ER(st0)?V(st0):sum('err'),`วันนี้ ${S[day()]?.err||0}`)}
  </div>
  <h2>${ic('act')} 30 วันล่าสุด</h2><div class="card"><div class="chart">${days.map(d=>`<div title="${d}: ใช้งาน ${S[d]?.dau||0} · error ${S[d]?.err||0}"><b style="height:${(S[d]?.dau||0)/mx*100}%"></b><b class="e" style="height:${(S[d]?.err||0)/mx*50}%"></b></div>`).join('')}</div>
  <div class="lgd"><span><i></i>ผู้ใช้ต่อวัน</span><span><i style="background:var(--red)"></i>ข้อผิดพลาด</span><span>${days[0]} → ${days[29]}</span></div></div>
  <h2>${ic('list')} เหตุการณ์ 30 วัน</h2><div class="grid">${Object.keys(TY).map(k=>card(k=='err'?'alert':'list',TY[k],sum(k),'')).join('')}</div>
  <h2>${ic('trash')} ล้างบันทึกเก่า</h2><div class="card"><div class="s">ลบบันทึกการใช้งานที่เก่ากว่า 30 วัน (ตัวนับรายวันยังอยู่) — ไม่มี Cloud Functions จึงต้องกดเอง เดือนละครั้งพอ</div><div style="margin-top:8px"><button class="dng" id="clean">${ic('trash')} ลบบันทึกเก่ากว่า 30 วัน</button></div></div>
  <div class="s" style="margin-top:14px">อ่านข้อมูลหน้านี้ ≈ ${bs.size+st.size+8} reads · <button id="rf">${ic('ref')} รีเฟรช</button></div>`;
  $('rf').onclick=overview;$('clean').onclick=clean}
 catch(e){if(TAB!='ov')return;M.innerHTML=`<div class="card"><span class="tag err">โหลดไม่ได้</span> ${esc(e.code||e.message)}</div>`}}

async function clean(){if(!confirm('ลบบันทึกที่เก่ากว่า 30 วันทั้งหมด?'))return;const cut=day(30);let n=0;
 try{for(;;){const s=await F.getDocs(F.query(F.collection(db,'bp_logs'),F.where('d','<',cut),F.limit(300)));if(s.empty)break;const b=F.writeBatch(db);s.forEach(d=>b.delete(d.ref));await b.commit();n+=s.size;toast('ลบแล้ว '+n+' รายการ…');if(s.size<300)break}
  toast('ล้างเสร็จ: ลบ '+n+' รายการ')}catch(e){toast('ลบไม่สำเร็จ: '+(e.code||e.message))}}

const F0={from:day(6),to:day(),ty:'',site:''};
function fltUI(errOnly){return `<div class="flt"><label>ตั้งแต่ <input type="date" id="f1" value="${F0.from}"></label><label>ถึง <input type="date" id="f2" value="${F0.to}"></label>
 ${errOnly?'':`<label>ประเภท <select id="fty"><option value="">ทั้งหมด</option>${Object.entries(TY).map(([k,v])=>`<option value="${k}" ${F0.ty==k?'selected':''}>${v}</option>`).join('')}</select></label>`}
 <label>เว็บ <select id="fs"><option value="">ทั้งหมด</option>${Object.entries(SITE).map(([k,v])=>`<option value="${k}" ${F0.site==k?'selected':''}>${v}</option>`).join('')}<option value="_o" ${F0.site=='_o'?'selected':''}>อื่น ๆ</option></select></label>
 <button id="fgo">${ic('ref')} แสดง</button></div>`}
function bindF(fn){$('fgo').onclick=()=>{F0.from=$('f1').value||day(6);F0.to=$('f2').value||day();F0.ty=$('fty')?.value||'';F0.site=$('fs').value;fn()}}
async function fetchLogs(errOnly,re){try{return await fetchLogs0(errOnly)}catch(e){if(!re&&e.code=='permission-denied'&&auth.currentUser){await A.getIdToken(auth.currentUser,true);return fetchLogs(errOnly,1)}throw e}}
async function fetchLogs0(errOnly){const c=[F.where('d','>=',F0.from),F.where('d','<=',F0.to)];if(errOnly)c.push(F.where('ty','in',['err','kill','stall']));else if(F0.ty&&F0.ty!='hidden'&&F0.ty!='kill')c.push(F.where('ty','==',F0.ty));
 let s;try{s=await F.getDocs(F.query(F.collection(db,'bp_logs'),...c,F.orderBy('d','desc'),F.limit(400)))}catch(e){if(c.length>2){s=await F.getDocs(F.query(F.collection(db,'bp_logs'),F.where('d','>=',F0.from),F.where('d','<=',F0.to),F.orderBy('d','desc'),F.limit(400)))}else throw e}
 return {r:filtLogs(s.docs.map(d=>({id:d.id,...d.data()})),errOnly),full:s.size>=400}}
function lgKind(x){return (x.ty=='hidden'||(x.ty=='kill'&&/\[(hidden-while-playing|pagehide-while-playing)\]/.test(x.m||'')))?'hidden':x.ty}
function filtLogs(r,errOnly){if(errOnly)r=r.filter(x=>['err','kill','stall'].includes(x.ty)&&lgKind(x)!='hidden');else if(F0.ty=='hidden')r=r.filter(x=>lgKind(x)=='hidden');else if(F0.ty=='kill')r=r.filter(x=>lgKind(x)=='kill');else if(F0.ty)r=r.filter(x=>lgKind(x)==F0.ty);
 if(F0.site)r=r.filter(x=>F0.site=='_o'?!SITE[x.s]:x.s==F0.site);r.sort((a,b)=>tms847(b.t)-tms847(a.t));return r}
const WHOC=new Map(),BNC=new Map();
async function whoLoad(uids){const ids=[...new Set((uids||[]).filter(Boolean))];
 await Promise.all(ids.filter(u=>!WHOC.has(u)).map(async u=>{let em='';
  try{const p=(await F.getDoc(F.doc(db,'bp_plan',u))).data()||{};em=String(p.em||'').trim()}catch(e){}
  if(!em){try{const c=(await F.getDoc(F.doc(db,'bp_chat',u))).data()||{};em=String(c.em||'').trim()}catch(e){}}
  WHOC.set(u,{em})}));
 const W=new Map();ids.forEach(u=>W.set(u,WHOC.get(u)||{}));return W}
function whoCell(u,W){if(!u)return '<span class="mut">ไม่ได้เข้าสู่ระบบ</span>';const em=(W.get(u)||{}).em;
 if(em)return `<b>${esc(em)}</b><div class="s" style="word-break:break-all">${esc(u)}</div>`;
 return `<span style="word-break:break-all">${esc(u)}</span>`}
function whoName(u,W){if(!u)return 'ไม่ได้เข้าสู่ระบบ';return (W.get(u)||{}).em||u}
function bandTok(x){if(!x||!x.m)return '';if(!/^(band_create|band_join|song_up|set_band)$/.test(x.ty))return '';const id=String(x.m).trim().split(/\s+/)[0];return id&&id.length>=8&&id.indexOf('@')<0?id:''}
async function bandLoad(ids){const uniq=[...new Set((ids||[]).filter(Boolean))];
 await Promise.all(uniq.filter(id=>!BNC.has(id)).map(async id=>{try{const d=await F.getDoc(F.doc(db,'bands',id));BNC.set(id,d.exists()?(d.data().name||id):id)}catch(e){BNC.set(id,id)}}));
 const M=new Map();uniq.forEach(id=>M.set(id,BNC.get(id)||id));return M}
function fmtSec(n){n=Math.max(0,+n||0);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
function parseInc(m){m=String(m||'');const tag=(m.match(/^\[([^\]]+)\]/)||[])[1]||'',cur=(m.match(/cur=(\S+)/)||[])[1]||'',pos=m.match(/\s(\d+)\/(\d+)s/);
 return {tag,song:cur.replace(/^X:/,''),pos:pos?+pos[1]:null,dur:pos?+pos[2]:null,ctx:(m.match(/ctx=(\S+)/)||[])[1]||'',vis:(m.match(/vis=(\S+)/)||[])[1]||''}}
function lgAct(x,BN){const ty=lgKind(x),m=String(x.m||'').trim(),bn=id=>{const n=BN.get(id);return n&&n!==id?`“${n}”`:id},bid=bandTok(x);
 if(ty=='hidden'){const p=parseInc(m),b=[];b.push(p.tag=='pagehide-while-playing'?'ออกจากหน้าแอปขณะเพลงยังเล่นอยู่ — ไม่ได้เด้งปิด และไม่กระทบระบบ':'พับแอปหรือล็อกหน้าจอขณะเพลงยังเล่นอยู่ — ไม่ได้เด้งปิด และไม่กระทบระบบ');
  if(p.song)b.push('เพลง '+p.song);if(p.pos!=null&&p.dur!=null)b.push('เล่นไปแล้ว '+fmtSec(p.pos)+' จาก '+fmtSec(p.dur)+' ('+p.pos+'/'+p.dur+' วินาที)');if(p.ctx=='running')b.push('ระบบเสียงยังทำงาน');else if(p.ctx)b.push('ระบบเสียง: '+p.ctx);if(p.vis=='hidden')b.push('หน้าจอแอปถูกซ่อน');else if(p.vis)b.push('สถานะหน้าจอ: '+p.vis);return b.join(' · ')}
 if(ty=='login')return 'เปิดแอปและเข้าสู่ระบบ';
 if(ty=='band_create')return bid?`สร้างวง ${bn(bid)}`:(m?`สร้างวง ${m}`:'สร้างวง');
 if(ty=='band_join')return bid?`เข้าร่วมวง ${bn(bid)}`:(m?`เข้าร่วมวง ${m}`:'เข้าร่วมวง');
 if(ty=='song_up'){const sz=m.split(/\s+/).slice(1).join(' ');return bid?`อัปเพลงเข้าวง ${bn(bid)}${sz?' · '+sz:''}`:(m?`อัปเพลงเข้าวง ${m}`:'อัปเพลงเข้าวง')}
 if(ty=='set_save'){const n=m.match(/(\d+)\s*songs?/i);return n?`บันทึกลิสต์ในเครื่อง ${n[1]} เพลง`:(m||'บันทึกลิสต์ในเครื่อง')}
 if(ty=='set_band')return bid?`บันทึกลิสต์ให้วง ${bn(bid)}`:(m?`บันทึกลิสต์ให้วง ${m}`:'บันทึกลิสต์ให้วง');
 if(ty=='err')return m||'เกิดข้อผิดพลาด';
 if(ty=='kill')return m||'แอปถูกปิดหรือรีสตาร์ท';
 if(ty=='stall')return m||'เสียงสะดุดหรือเรนเดอร์ล้ม';
 return m||'—'}
function liveNote(){const el=$('live84');if(el)el.textContent='อัปเดตอัตโนมัติ · '+new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',second:'2-digit'})+' น.'}
async function drawLogs(docs,errOnly,full){if(!$('lo'))return;let r=filtLogs(docs.map(d=>({id:d.id,...d.data()})),errOnly);const W=await whoLoad(r.map(x=>x.u));if(!$('lo'))return;if(!errOnly){const BN=await bandLoad(r.map(bandTok));
  $('lo').className='';$('lo').innerHTML=`<div class="s" style="margin-bottom:6px">${r.length} รายการ${full?' (แสดง 400 ล่าสุด — แคบช่วงวันลง)':''} · อัปเดตเองเมื่อมีรายการใหม่</div><div class="card" style="padding:0 6px;overflow-x:auto"><table><tr><th>เวลา</th><th>ผู้ใช้</th><th>ทำอะไร</th><th>รายละเอียด</th><th class="hide-s">เว็บ</th><th class="hide-s">เครื่อง</th><th class="hide-s">เวอร์ชัน</th></tr>
 ${r.map(x=>{const k=lgKind(x);return `<tr><td style="white-space:nowrap">${fmtT(x.t)}</td><td>${whoCell(x.u,W)}</td><td><span class="tag ${k=='err'||k=='kill'||k=='stall'?'err':''}">${TY[k]||esc(k)}</span></td><td class="m">${esc(lgAct(x,BN))}</td><td class="hide-s">${esc(x.s||'')}</td><td class="hide-s">${esc(x.dv||'')}</td><td class="hide-s">${esc(x.v||'')}</td></tr>`}).join('')||'<tr><td colspan="7" class="mut">ไม่มีข้อมูล</td></tr>'}</table></div>`}
 else{const g=new Map();for(const x of r){const k=x.m.split(' | ')[0].replace(/ cur=.*$/,'').replace(/:\d+$/,'');const o=g.get(k)||{m:k,n:0,last:x.t,v:new Set(),dv:new Set(),s:new Set(),u:new Set(),ev:[]};o.n++;o.ev.push(x);if(tms847(x.t)>tms847(o.last))o.last=x.t;o.v.add(x.v);o.dv.add(x.dv);o.s.add(x.s);if(x.u)o.u.add(x.u);g.set(k,o)}
  const L=[...g.values()].sort((a,b)=>tms847(b.last)-tms847(a.last));for(const o of L)o.ev.sort((a,b)=>tms847(b.t)-tms847(a.t));
  $('lo').className='';$('lo').innerHTML=`<div class="s" style="margin-bottom:6px">${r.length} ครั้ง · ${L.length} แบบ (รวมข้อความเดียวกัน) · อัปเดตเองเมื่อมีรายการใหม่</div>${L.map(o=>`<div class="card" style="margin-bottom:8px"><div style="display:flex;gap:8px;align-items:flex-start">${ic('alert')}<div style="flex:1;word-break:break-word">${esc(o.m)}</div><span class="tag err">${o.n}×</span></div><div class="s" style="margin-top:6px">ล่าสุด ${fmtT(o.last)} · ${[...o.v].map(esc).join(', ')} · ${[...o.dv].map(esc).join(', ')} · ${[...o.s].map(esc).join(', ')}${o.u.size?` · ${[...o.u].map(u=>esc(whoName(u,W))).join(', ')}`:''}</div>${evUI84(o.ev,W)}</div>`).join('')||'<div class="card mut">ไม่มีข้อผิดพลาดในช่วงนี้</div>'}`}
 liveNote()}
function listenLogs(errOnly){liveOff();const c=[F.where('d','>=',F0.from),F.where('d','<=',F0.to)];if(errOnly)c.push(F.where('ty','in',['err','kill','stall']));else if(F0.ty&&F0.ty!='hidden'&&F0.ty!='kill')c.push(F.where('ty','==',F0.ty));
 const attach=parts=>{liveOff();LIVE=F.onSnapshot(F.query(F.collection(db,'bp_logs'),...parts,F.orderBy('d','desc'),F.limit(400)),snap=>{if(!$('lo'))return;drawLogs(snap.docs,errOnly,snap.size>=400).catch(e=>{if($('lo'))$('lo').innerHTML=`<span class="tag err">แสดงไม่ได้</span> ${esc(e.code||e.message)}`})},e=>{if(parts.length>2){attach([F.where('d','>=',F0.from),F.where('d','<=',F0.to)]);return}if($('lo'))$('lo').innerHTML=`<span class="tag err">โหลดไม่ได้</span> ${esc(e.code||e.message)}`})};
 attach(c)}
async function logs(){M.innerHTML=fltUI(false)+'<div id="lo" class="mut">กำลังโหลด…</div><div class="s" id="live84">กำลังฟังแบบเรียลไทม์…</div>';bindF(logs);listenLogs(false)}
async function errors(){M.innerHTML=fltUI(true)+'<div id="lo" class="mut">กำลังโหลด…</div><div class="s" id="live84">กำลังฟังแบบเรียลไทม์…</div>';bindF(errors);listenLogs(true)}
function bkkInput(ms){if(!ms)return '';const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));const g=t=>(parts.find(p=>p.type===t)||{}).value||'';return g('year')+'-'+g('month')+'-'+g('day')+'T'+g('hour')+':'+g('minute')}
function bkkParse(s){const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);if(!m)return null;return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4]-7,+m[5]))}
async function mnt26card(){
  if($('mnt26'))return;
  const c=document.createElement('div');c.className='card';c.id='mnt26';c.style.marginBottom='12px';
  c.innerHTML=`<h2 style="margin-top:0">${ic('alert')} ประกาศปรับปรุง</h2>
    <p class="s" style="margin:0 0 8px">แสดงแบนเนอร์ในแอปตามช่วงเวลา (เขตเวลา Asia/Bangkok) — ไม่ล็อกการใช้งาน เปิด/ปิดได้</p>
    <div style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <label class="s">เริ่ม <input id="mnt0" type="datetime-local" style="display:block;width:100%;margin-top:4px"></label>
      <label class="s">สิ้นสุด <input id="mnt1" type="datetime-local" style="display:block;width:100%;margin-top:4px"></label>
    </div>
    <label class="s" style="display:block;margin-top:8px">ข้อความเพิ่ม (ไม่บังคับ)
      <input id="mntmsg" type="text" maxlength="500" placeholder="เช่น ขออภัยในความไม่สะดวก" style="display:block;width:100%;margin-top:4px;font:inherit;color:var(--tx);background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:8px">
    </label>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center">
      <label class="s" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="mnton"> เปิดประกาศ</label>
      <button class="pri" id="mnts" type="button">บันทึก</button>
      <button id="mntc" type="button">ปิดประกาศ</button>
      <span class="s" id="mntl"></span>
    </div>`;
  const ann=$('ann');if(ann&&ann.parentNode)ann.after(c);else M.prepend(c);
  try{
    const d=await F.getDoc(F.doc(db,'bp_maint','cur'));
    if(d.exists()){
      const x=d.data();
      $('mnton').checked=!!x.on;
      const s=x.start&&x.start.toMillis?x.start.toMillis():0,e=x.end&&x.end.toMillis?x.end.toMillis():0;
      if(s)$('mnt0').value=bkkInput(s);if(e)$('mnt1').value=bkkInput(e);
      $('mntmsg').value=x.msg||'';
      $('mntl').textContent=(x.on?'เปิดอยู่':'ปิด')+(s?' · '+new Date(s).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'');
    }
  }catch(e){$('mntl').textContent='อ่านไม่ได้: '+(e.code||e.message)}
  const save=async on=>{
    const a=bkkParse($('mnt0').value),b=bkkParse($('mnt1').value);
    if(!a||!b)return toast('ใส่เวลาเริ่มและสิ้นสุดก่อน');
    if(!(b>a))return toast('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
    try{
      await F.setDoc(F.doc(db,'bp_maint','cur'),{on:!!on,start:F.Timestamp.fromDate(a),end:F.Timestamp.fromDate(b),msg:($('mntmsg').value||'').trim().slice(0,500),t:F.serverTimestamp()});
      $('mnton').checked=!!on;
      $('mntl').textContent=on?'บันทึกแล้ว · เปิดอยู่':'บันทึกแล้ว · ปิด';
      toast(on?'เปิดประกาศปรับปรุงแล้ว':'ปิดประกาศปรับปรุงแล้ว');
    }catch(e){toast('บันทึกไม่ได้: '+(e.code||e.message))}
  };
  $('mnts').onclick=()=>save($('mnton').checked);
  $('mntc').onclick=()=>{if(confirm('ปิดประกาศปรับปรุงในแอป?'))save(false)};
}

// v1.70: system announcement (bp_sys/ann) shown in every app's notification bell
{const _ov=overview;overview=async function(){await _ov();if(TAB!='ov')return;const c=document.createElement('div');c.className='card';c.id='ann';c.style.marginBottom='12px';
 c.innerHTML=`<h2 style="margin-top:0">${ic('users')} ประกาศ (ขึ้นที่กระดิ่งในแอปของทุกคน)</h2><textarea id="annm" rows="3" maxlength="1000" placeholder="เช่น ปิดปรับปรุงคืนนี้ 23:00–23:30" style="width:100%;font:inherit;color:var(--tx);background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:8px"></textarea><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="pri" id="anns">ส่งประกาศ</button><button id="annc">ล้างประกาศ</button><span class="s" id="annl"></span></div>`;
 M.prepend(c);try{const d=await F.getDoc(F.doc(db,'bp_sys','ann'));if(d.exists()){const x=d.data();$('annm').value=x.m||'';$('annl').textContent=x.m?'ล่าสุด '+(x.t&&x.t.toDate?x.t.toDate().toLocaleString('th-TH'):''):''}}catch(e){$('annl').textContent='อ่านประกาศไม่ได้: '+(e.code||e.message)}
 const put=async m=>{try{await F.setDoc(F.doc(db,'bp_sys','ann'),{m,v:'',t:F.serverTimestamp()});toast(m?'ส่งประกาศแล้ว':'ล้างประกาศแล้ว');$('annl').textContent=m?'ส่งแล้ว':''}catch(e){toast('ส่งไม่ได้: '+(e.code||e.message))}};
 $('anns').onclick=()=>{const m=$('annm').value.trim();if(!m)return toast('พิมพ์ข้อความก่อน');if(confirm('ส่งประกาศนี้ให้ทุกคน?'))put(m)};$('annc').onclick=()=>{if(confirm('ล้างประกาศ?')){$('annm').value='';put('')}};
 try{mnt26card()}catch(e){}
 if(!LIVE){let n=0;LIVE=F.onSnapshot(F.query(F.collection(db,'bp_stats'),F.where('d','>=',day(29))),()=>{if(VT!='ov'&&TAB!='ov')return;if(++n==1)return;const a=document.activeElement;if(a&&(a.id=='annm'||a.closest&&a.closest('#ann')))return;overview()},()=>{})}}}
window.__adm={overview,logs,errors,clean,auth,A};

// v1.75-preview: plans (bp_plan/{uid}). Manual activation after PromptPay.
async function plans(){const d0=t=>t&&t.toDate?t.toDate():null,fd=d=>d?d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}):'—';
 M.innerHTML=`<section class="card"><h2>เปิดใช้แพ็กเกจ</h2>
  <div class="pl75f"><input id="plu" placeholder="รหัสบัญชี (UID) ที่ลูกค้าส่งมา"><select id="plp"><option value="pro">Pro</option><option value="band">Band</option><option value="free">ฟรี</option><option value="trial">ทดลองใช้ (เริ่มใหม่)</option></select>
  <label>หมดอายุ <input id="ple" type="date"></label><input id="pln" placeholder="หมายเหตุ เช่น สลิป 29/10 ฿990"><button id="pls">บันทึก</button></div>
  <p class="mut">เว้นวันหมดอายุไว้ = ใช้ได้ตลอดไป (จ่ายครั้งเดียว)</p></section><section class="card"><h2>บัญชีทั้งหมด</h2><div id="pll" class="mut">กำลังโหลด…</div></section>`;
 const paint=async q=>{const now=Date.now();const r=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(d0(b.t)||0)-(d0(a.t)||0));await sp81Load(null,r);
  $('pll').innerHTML=r.length?`${sp81Filter('u')}<table class="tb" id="sp81u"><tr><th>อีเมล</th><th>แพ็กเกจ</th><th>เริ่ม</th><th>หมดอายุ</th><th></th><th>ใช้งานล่าสุด</th><th>สถานะ</th></tr>${r.map(x=>{const s=d0(x.s),e=x.p=='trial'&&s?new Date(+s+7*864e5):d0(x.e);const live=!e||+e>now;
   return `<tr data-sp="${SP81.s.has('u_'+x.id)?'s':'a'}"><td>${esc(x.em||x.id.slice(0,10)+'…')}</td><td>${esc(x.p)}${live?'':' <span class="mut">(หมด)</span>'}</td><td>${fd(s)}</td><td>${e?fd(e):'ตลอดไป'}</td><td><button class="pled" data-u="${esc(x.id)}" data-p="${esc(x.p)}">แก้</button></td>${sp81Cells('u',x.id)}</tr>`}).join('')}</table>`:'ยังไม่มี';sp81Wire($('pll'),()=>{});
  M.querySelectorAll('.pled').forEach(b=>b.onclick=()=>{$('plu').value=b.dataset.u;$('plp').value=b.dataset.p=='trial'?'pro':b.dataset.p;$('plu').scrollIntoView({behavior:'smooth'})})};
 LIVE=F.onSnapshot(F.collection(db,'bp_plan'),q=>paint(q).catch(e=>$('pll').textContent='❌ '+(e.code||e.message)),e=>$('pll').textContent='❌ '+(e.code||e.message));
 $('pls').onclick=async()=>{const u=$('plu').value.trim();if(!/^[A-Za-z0-9]{20,40}$/.test(u))return toast('UID ไม่ถูกต้อง');
  try{const old=await F.getDoc(F.doc(db,'bp_plan',u));const o=old.exists()?old.data():{};const p=$('plp').value;
   const d={p,s:p=='trial'?F.serverTimestamp():(o.s||F.serverTimestamp()),em:o.em||'',t:F.serverTimestamp()};if(o.x)d.x=o.x;if(o.xe)d.xe=o.xe;const ev=$('ple').value;if(ev)d.e=F.Timestamp.fromDate(new Date(ev+'T23:59:59+07:00'));const n=$('pln').value.trim();if(n)d.n=n.slice(0,300);
   await F.setDoc(F.doc(db,'bp_plan',u),d);toast('บันทึกแล้ว')}catch(e){toast('❌ '+(e.code||e.message))}}}

// ---- v1.76-preview: self-serve PromptPay queue (bp_pay), band seats, one-off grandfather action ----
const PAYN={pro:'Pro',band:'Band',seat:'+1 ที่นั่ง',ai:'AI Stems',mo:'แยกช่อง'};const YEAR=365*864e5;
const BKN={'002':'กรุงเทพ','004':'กสิกรไทย','006':'กรุงไทย','011':'ทีทีบี','014':'ไทยพาณิชย์','022':'ซีไอเอ็มบี','024':'ยูโอบี','025':'กรุงศรี','030':'ออมสิน','033':'ธอส.','034':'ธ.ก.ส.','066':'อิสลาม','067':'ทิสโก้','069':'เกียรตินาคินภัทร','070':'ไอซีบีซี','071':'ไทยเครดิต','073':'แลนด์ แอนด์ เฮ้าส์'};
const crc16=p=>{let c=0xFFFF;for(const ch of p){c^=ch.charCodeAt(0)<<8;for(let i=0;i<8;i++)c=c&0x8000?(c<<1)^0x1021:c<<1;c&=0xFFFF}return c.toString(16).toUpperCase().padStart(4,'0')};
const fat=a=>{const d=new Date(a);return isNaN(d)?esc(a||'–'):d.toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})};
let PCFG={on:false,h:24,cap:3,age:24,price:{pro:490,band:1290,seat:150,ai:290,mo:290}};
// fraud hints for the admin (client-supplied values: hints, not proof)
function flags(x){const f=[],s=x.s&&x.s.toMillis?x.s.toMillis():Date.now(),at=+new Date(x.at);
 if(!x.qr)f.push('ไม่มี QR');else{const m=/91(04)([0-9A-F]{4})$/.exec(x.qr);if(m&&crc16(x.qr.slice(0,-4))!=m[2])f.push('QR checksum ผิด')}
 if(isNaN(at))f.push('ไม่มีเวลาโอน');else{if(s-at>30*6e4)f.push('โอนนานกว่า 30 นาทีก่อนส่ง');if(x.rq&&at<x.rq-2*6e4)f.push('เวลาโอนก่อนเปิดหน้าซื้อ');if(at>s+5*6e4)f.push('เวลาโอนอยู่ในอนาคต')}
 if(x.ua&&s-x.ua<(PCFG.age||24)*36e5)f.push('บัญชีใหม่ (< '+(PCFG.age||24)+' ชม.)');if(x.amt!=(PCFG.price||{})[x.pl])f.push('ยอดไม่ตรงราคา');return f}
let PAYQ=[];function payBadge(){badge78('pl',PAYQ.length);document.title=(PAYQ.length?`(${PAYQ.length}) `:'')+'SetSod ผู้ดูแล'}
let PAYW=null;setInterval(()=>{if(PAYW||$('nav').hidden)return;PAYW=F.onSnapshot(F.query(F.collection(db,'bp_pay'),F.where('st','in',['pending','short','over','wait'])),q=>{const n0=PAYQ.length,old=new Set(PAYQ.map(x=>x.id));PAYQ=q.docs.map(d=>({id:d.id,...d.data()}));payBadge();
 if(PAYQ.length>n0&&n0>=0){toast('🔔 มีสลิปใหม่ '+PAYQ.length+' รายการ');const nw=(PAYQ.find(x=>!old.has(x.id))||PAYQ[0]).id;try{if(Notification.permission=='granted'){const N=new Notification('SetSod: สลิปใหม่',{body:PAYQ.map(x=>PAYN[x.pl]+' ฿'+x.amt).join(', ')});N.onclick=()=>{try{window.focus()}catch(e){}goSlip(nw);N.close()}}}catch(e){}}
 if(TAB=='pl'&&$('payc'))payDraw()},e=>{PAYW=null})},1500);
// v1.77: notification → that slip row in the queue
function goSlip(id){const b=document.querySelector('#nav [data-t="pl"]');if(b&&VT!='pl')b.click();let n=0;const iv=setInterval(()=>{const r=document.querySelector(`#payc [data-pu="${CSS.escape(id)}"]`);if(r||++n>40){clearInterval(iv);if(r){r.scrollIntoView({block:'center'});r.style.outline='2px solid #fff';setTimeout(()=>r.style.outline='',3000)}}},150)}
window.__goSlip=goSlip;
async function payConfirm(x){const ref=F.doc(db,'bp_plan',x.id),o=(await F.getDoc(ref)).data()||{};const now=Date.now(),ext=t=>F.Timestamp.fromMillis(Math.max(now,t&&t.toMillis?t.toMillis():0)+YEAR);
 if(x.pl=='seat'){const q=await F.getDocs(F.query(F.collection(db,'bands'),F.where('owner','==',x.id)));if(!q.size)throw new Error('ผู้ใช้นี้ยังไม่มีวง');let b=q.docs[0];
  if(q.size>1){const nm=prompt('เพิ่มที่นั่งให้วงไหน?\n'+q.docs.map((d,i)=>(i+1)+'. '+d.data().name).join('\n'),'1');b=q.docs[(+nm||1)-1]||b}
  await F.updateDoc(b.ref,{seats:(b.data().seats||5)+1})}
 else{const d={p:o.p||'free',s:o.s||F.serverTimestamp(),em:o.em||'',t:F.serverTimestamp()};if(o.e)d.e=o.e;if(o.x)d.x=o.x;if(o.xe)d.xe=o.xe;if(o.n)d.n=o.n;
  if(x.pl=='pro'||x.pl=='band'){d.p=x.pl;d.e=ext(o.p==x.pl?o.e:null)}else{d.x=[...new Set([...(o.x||[]),x.pl])];d.xe=ext(o.xe)}
  d.n=('PromptPay ฿'+x.amt+' '+(x.at||'')+' '+(x.ref||'')).slice(0,300);await F.setDoc(ref,d)}
 await F.updateDoc(F.doc(db,'bp_pay',x.id),{st:'ok',t:F.serverTimestamp()})}
// ---- v1.80.2: แพ็กเกจ/สลิป redesign — flow explainer, slip cards, history, collapsed settings, DEMO ----
// DEMO: set PAY_DEMO=false (or delete the "DEMO" block below) to remove the sample-data toggle completely.
const PAY_DEMO=false;let DEMO=false;const PINFO={};let PAYH=[],PAYHL=0;
const fdl=ms=>new Date(ms).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
const ftm=t=>{const d=t&&t.toDate?t.toDate():typeof t=='number'?new Date(t):null;return d?d.toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''};
async function pinfo(u){if(PINFO[u])return PINFO[u];const r=PINFO[u]={em:'',band:'',e:null,p:''};
 try{const p=(await F.getDoc(F.doc(db,'bp_plan',u))).data()||{};r.em=p.em||'';r.p=p.p||'';r.e=p.e&&p.e.toMillis?p.e.toMillis():null}catch(e){}
 try{const q=await F.getDocs(F.query(F.collection(db,'bands'),F.where('owner','==',u)));r.band=q.docs.map(d=>d.data().name).join(', ')}catch(e){}return r}
function payResult(x,i){const nm=i.band||i.em||'ผู้ใช้นี้';if(x.pl=='seat')return `วง ${nm} ได้ที่นั่งเพิ่ม +1 คน`;const base=Math.max(Date.now(),(x.pl==i.p&&i.e)||0);return `${i.band?'วง '+nm:nm} ได้ ${PAYN[x.pl]||x.pl} ถึง ${fdl(base+YEAR)}`}
// DEMO block (client-side only, never written to Firestore)
const DSLIP=(amt,bank,c)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="300" height="420" rx="16" fill="#fff"/><rect width="300" height="70" rx="16" fill="${c}"/><text x="20" y="44" font-size="22" fill="#fff" font-family="sans-serif">${bank}</text><text x="20" y="110" font-size="15" fill="#2a8" font-family="sans-serif">✓ โอนเงินสำเร็จ</text><text x="20" y="170" font-size="13" fill="#666" font-family="sans-serif">จาก นาย ตัวอย่าง ทดสอบ</text><text x="20" y="200" font-size="13" fill="#666" font-family="sans-serif">ไปยัง นาย ไพฑูรย์ อินกรัด (PromptPay)</text><text x="20" y="260" font-size="34" fill="#111" font-family="sans-serif">฿${amt.toLocaleString()}.00</text><rect x="200" y="320" width="80" height="80" fill="#111"/><rect x="210" y="330" width="60" height="60" fill="#fff"/><rect x="222" y="342" width="36" height="36" fill="#111"/><text x="150" y="410" font-size="40" fill="rgba(255,0,0,.25)" font-family="sans-serif" text-anchor="middle" transform="rotate(-20 150 210)">DEMO</text></svg>`);
function demoQ(){const n=Date.now(),ts=m=>({toMillis:()=>n-m*6e4,toDate:()=>new Date(n-m*6e4)}),iso=m=>new Date(n-m*6e4).toISOString();
 const z={'demo-a':{em:'band.a@example.com',band:'วงตัวอย่าง A',p:'',e:null},'demo-b':{em:'sample.b@example.com',band:'วงตัวอย่าง B',p:'',e:null},'demo-c':{em:'owner.c@example.com',band:'วงตัวอย่าง C',p:'band',e:n+200*864e5}};Object.assign(PINFO,z);
 return[{id:'demo-a',demo:1,pl:'band',amt:1290,at:iso(6),s:ts(4),ref:'DEMO2026102900001',bk:'004',qr:null,_ok:1,img:DSLIP(1290,'K PLUS','#138f2d'),c:1},
  {id:'demo-b',demo:1,pl:'band',amt:1000,at:iso(180),s:ts(20),ref:'DEMO2026102900002',bk:'014',ua:n-3*36e5,img:DSLIP(1000,'SCB EASY','#4e2a84'),c:2},
  {id:'demo-c',demo:1,pl:'seat',amt:150,at:iso(3),s:ts(2),ref:'DEMO2026102900003',bk:'002',_ok:1,img:DSLIP(150,'Bangkok Bank','#1e4598'),c:1}]}
const demoH=()=>{const n=Date.now();return[{id:'วงตัวอย่าง D',demo:1,pl:'band',amt:1290,st:'ok',t:{toDate:()=>new Date(n-26*36e5)},r:'วงตัวอย่าง D ได้ Band ถึง '+fdl(n-26*36e5+YEAR)},{id:'วงตัวอย่าง E',demo:1,pl:'pro',amt:99,st:'revoked',t:{toDate:()=>new Date(n-50*36e5)},r:'ยกเลิก — ไม่พบเงินเข้า'}]};
// end DEMO block
function pflags(x){const f=x.demo?[]:flags(x);if(x.demo){if(!x._ok&&!x.qr)f.push('ไม่มี QR ในสลิป');if(x.amt!=PCFG.price[x.pl])f.push('ยอดไม่ตรงราคา');if((x.s.toMillis()-+new Date(x.at))>30*6e4)f.push('โอนนานกว่า 30 นาทีก่อนส่ง');if(x.ua)f.push('บัญชีใหม่ (< '+(PCFG.age||24)+' ชม.)')}return f}
function slipCard(x){const i=PINFO[x.id]||{},exp=(PCFG.price||{})[x.pl],paid=(typeof x.pd=='number'?x.pd:x.amt)+(x.pd2|0),ok=x.amt==exp&&paid==exp,f=pflags(x),mis=paid!=x.amt;
 return `<article class="sc82" data-pu="${esc(x.id)}"><div class="sci82">${x.img?`<img src="${x.img}" alt="สลิป">`:`<button class="pysl" data-u="${esc(x.id)}">🧾 แสดงรูปสลิป</button>`}</div>
 <div class="scb82"><div class="sch82"><b class="pl82">${PAYN[x.pl]||esc(x.pl)}</b><span class="amt82 ${ok?'ok':'bad'}">โอน ฿${(+paid).toLocaleString()} ${ok?'✓':'✗'}</span><span class="mut">ราคา ฿${(+exp||0).toLocaleString()}</span>${mis?`<span class="chip82 w">${paid<x.amt?'ขาด':'เกิน'} ฿${Math.abs(x.amt-paid).toLocaleString()}</span>`:''}${ST81[x.st]?`<span class="chip82 ${x.st=='pending'?'g':'w'}">${ST81[x.st]}</span>`:''}</div>
 <dl class="kv82"><dt>วง</dt><dd>${esc(i.band||'—')}</dd><dt>บัญชี</dt><dd>${esc(i.em||x.id.slice(0,10)+'…')}</dd><dt>เวลาโอน</dt><dd>${fat(x.at)}${x.bk?' · '+esc(BKN[x.bk]||x.bk):''}</dd><dt>ส่งสลิป</dt><dd>${ftm(x.s)}${x.c>1?' · ครั้งที่ '+x.c:''}</dd>${x.ref?`<dt>เลขอ้างอิง</dt><dd class="s">${esc(x.ref)}</dd>`:''}${x.ref2?`<dt>สลิปโอนเพิ่ม</dt><dd>฿${(+x.pd2).toLocaleString()} · ${fat(x.at2)} · <span class="s">${esc(x.ref2)}</span> <button class="lnk pysl2" data-u="${esc(x.id)}">ดูรูป</button></dd>`:''}</dl>
 <div class="chips82">${f.length?f.map(t=>`<span class="chip82 w">⚠ ${esc(t)}</span>`).join(''):'<span class="chip82 g">✓ ไม่พบจุดผิดปกติ</span>'}${x.qr?`<button class="lnk pyqr" data-q="${esc(x.qr)}">คัดลอก QR</button>`:''}</div>
 <div class="act82"><button class="pyok big82" data-u="${esc(x.id)}">✅ ยืนยัน (1 ปี)</button>${mis||x.st!='pending'||x.ref2?`<button class="pywt big82" data-u="${esc(x.id)}">⏳ รอโอนเพิ่ม</button><button class="pyrf big82" data-u="${esc(x.id)}">↩ คืนเงินแล้ว</button>`:''}<button class="pyno big82 dng" data-u="${esc(x.id)}">❌ ยกเลิก</button></div><div class="res82" hidden></div></div></article>`}
const ST81={pending:'ยอดตรง · เปิดใช้ชั่วคราว',short:'ยอดขาด · ยังไม่เปิดใช้',over:'ยอดเกิน · ยังไม่เปิดใช้',wait:'รอลูกค้าโอนเพิ่ม'};
function payQ(){return DEMO?(payQ.d||(payQ.d=demoQ())):PAYQ}
async function payHist(force){if(DEMO)return demoH();if(force||Date.now()-PAYHL>60000){PAYHL=Date.now();try{const q=await F.getDocs(F.query(F.collection(db,'bp_pay'),F.where('st','in',['ok','revoked','refunded'])));PAYH=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>((b.t&&b.t.toMillis&&b.t.toMillis())||0)-((a.t&&a.t.toMillis&&a.t.toMillis())||0)).slice(0,15);await Promise.all(PAYH.map(h=>pinfo(h.id)))}catch(e){}}return PAYH}
async function histDraw(force){const c=$('payh');if(!c)return;const h=await payHist(force);
 c.innerHTML=`<h2>ประวัติล่าสุด</h2>`+(h.length?`<div class="hl82">${h.map(x=>{const i=PINFO[x.id]||{};return `<div class="hr82"><span class="chip82 ${x.st=='ok'?'g':'w'}">${x.st=='ok'?'✅ ยืนยันแล้ว':x.st=='refunded'?'↩ คืนเงินแล้ว':'❌ ยกเลิก'}</span><b>${esc(x.demo?x.id:(i.band||i.em||x.id.slice(0,10)))}</b><span>${PAYN[x.pl]||esc(x.pl)} ฿${(+x.amt).toLocaleString()}</span><span class="mut">${ftm(x.t)}</span>${x.r?`<span class="mut">${esc(x.r)}</span>`:''}</div>`}).join('')}</div>`:'<p class="mut">ยังไม่มีรายการ</p>')}
function flowDraw(){const c=$('pyflow');if(!c)return;const H=PCFG.h||24,off=!PCFG.on;
 c.innerHTML=`<div class="fh82"><h2>เมื่อมีวงโอนเงินมา ทำอะไรบ้าง?</h2>${PAY_DEMO?`<button id="demo82" class="${DEMO?'pri':''}">${DEMO?'✕ ปิดตัวอย่าง':'👁 ดูตัวอย่าง'}</button>`:''}</div>
 ${off?`<div class="off82">⏸ ตอนนี้ปิดรับสลิปอยู่ — <b>กดเปิดในการตั้งค่าการรับเงินด้านล่าง</b> (ลูกค้ายังซื้อเองไม่ได้)</div>`:''}
 <ol class="fl82"><li><i>①</i><div><b>ลูกค้าโอนเงิน + แนบสลิปในแอป</b><span>ระบบปลดล็อกให้ทันที <b>อัตโนมัติ ${H} ชม.</b> — แอดมินไม่ต้องทำอะไร</span></div></li>
 <li><i>②</i><div><b>สลิปเด้งมาที่หน้านี้</b><span>มีตัวเลขแดงที่เมนู + กระดิ่ง 🔔 (และแจ้งเตือนบนเครื่อง)</span></div></li>
 <li class="me82"><i>③</i><div><b>แอดมินเปิดแอปธนาคาร ดูว่าเงินเข้าจริง แล้วกด</b><span>✅ <b>ยืนยัน</b> → ใช้ได้ 1 ปี (ระบบตั้งวันหมดอายุให้เอง) · ❌ <b>ยกเลิก</b> → ตัดสิทธิ์ทันที</span></div></li></ol>
 <p class="one82">👉 นี่คือ <b>สิ่งเดียว</b>ที่แอดมินต้องทำ — ไม่ต้องตั้งค่า ไม่ต้องแก้แพ็กเกจเอง ถ้าไม่กดภายใน ${H} ชม. สิทธิ์ชั่วคราวจะหมดเอง</p>`;
 const b=$('demo82');if(b)b.onclick=()=>{DEMO=!DEMO;payQ.d=null;document.body.classList.toggle('demo82',DEMO);flowDraw();payDraw();histDraw()}}
function payDraw(){const c=$('payc');if(!c)return;const Q=payQ();
 c.innerHTML=`<h2>สลิปรอตรวจ ${Q.length?`<span class="tag err">${Q.length}</span>`:''}${DEMO?'<span class="chip82 w">ข้อมูลตัวอย่าง — ไม่บันทึกจริง</span>':''}</h2>`+(Q.length?`<div class="sl82">${Q.map(slipCard).join('')}</div>
  <details class="mut hw82" open><summary>วิธีตรวจว่าเงินเข้าจริง (ตรวจเองทุกครั้ง)</summary>1) เปิด <b>K PLUS</b> → บัญชีที่รับเงิน → <b>รายการเงินเข้า</b> หาเวลาโอนตามสลิป · ยอดต้องตรง และผู้รับต้องเป็น <b>นาย ไพฑูรย์ อินกรัด</b> (PromptPay e-Wallet ลงท้าย 6565)<br>2) ถ้าไม่เห็นรายการ: K PLUS → “ตรวจสอบสลิป” → สแกน QR มุมสลิป<br>3) กด “ยืนยัน” เมื่อเห็นเงินเข้าจริงเท่านั้น · ไม่พบเงินเข้า → “ยกเลิกสิทธิ์”</details>`
  :`<div class="emp82"><div>🧾</div><b>ยังไม่มีสลิปรอตรวจ</b><span class="mut">เมื่อลูกค้าส่งสลิป จะขึ้นที่นี่และกระดิ่ง 🔔 จะมีตัวเลข${PAY_DEMO?' · กด “👁 ดูตัวอย่าง” ด้านบนเพื่อดูว่าหน้าตาจะเป็นยังไง':''}</span></div>`);
 if(!DEMO)Q.forEach(x=>{if(!PINFO[x.id])pinfo(x.id).then(()=>{if(!DEMO&&$('payc'))payDraw()})});
 const X=id=>Q.find(p=>p.id==id),done=(b,txt,ok)=>{const a=b.closest('.sc82');a.classList.add(ok?'done82':'gone82');const r=a.querySelector('.res82');r.hidden=false;r.textContent=txt;a.querySelectorAll('.act82 button').forEach(z=>z.disabled=true)};
 c.querySelectorAll('.pyqr').forEach(b=>b.onclick=()=>{navigator.clipboard?.writeText(b.dataset.q);toast('คัดลอกแล้ว')});
 c.querySelectorAll('.pysl2').forEach(b=>b.onclick=async()=>{try{const d=await F.getDoc(F.doc(db,'bp_pay',b.dataset.u,'slip','img2'));if(!d.exists())return toast('ไม่มีรูป');b.outerHTML=`<img src="${d.data().d}" alt="สลิปโอนเพิ่ม" style="max-width:100%">`}catch(e){toast('❌ '+(e.code||e.message))}});
 [['.pywt','wait','⏳ ตั้งเป็น “รอโอนเพิ่ม” แล้ว — ลูกค้าเห็นยอดที่ขาดและแนบสลิปเพิ่มได้'],['.pyrf','refunded','↩ บันทึก “คืนเงินแล้ว” — ลูกค้าเห็นสถานะนี้ และส่งสลิปใหม่ได้']].forEach(([s,st,msg])=>c.querySelectorAll(s).forEach(b=>b.onclick=async()=>{const x=X(b.dataset.u);
  if(x.demo){done(b,msg+'  (ตัวอย่าง)',0);toast(msg);return}if(st=='refunded'&&!confirm('ยืนยันว่าโอนคืนให้ลูกค้าแล้ว?'))return;
  try{await F.updateDoc(F.doc(db,'bp_pay',x.id),{st,t:F.serverTimestamp()});done(b,msg,0);toast(msg);histDraw(1)}catch(e){toast('❌ '+(e.code||e.message))}}));
 c.querySelectorAll('.pysl').forEach(b=>b.onclick=async()=>{try{const d=await F.getDoc(F.doc(db,'bp_pay',b.dataset.u,'slip','img'));if(!d.exists())return toast('ไม่มีรูปสลิป');b.outerHTML=`<img src="${d.data().d}" alt="สลิป">`}catch(e){toast('❌ '+(e.code||e.message))}});
 c.querySelectorAll('.pyok').forEach(b=>b.onclick=async()=>{const x=X(b.dataset.u),msg='✅ '+payResult(x,PINFO[x.id]||{});b.disabled=true;
  if(x.demo){done(b,msg+'  (ตัวอย่าง — ไม่ได้บันทึกจริง)',1);toast(msg);return}
  try{await payConfirm(x);done(b,msg,1);toast(msg);histDraw(1)}catch(e){b.disabled=false;toast('❌ '+(e.code||e.message))}});
 c.querySelectorAll('.pyno').forEach(b=>b.onclick=async()=>{const x=X(b.dataset.u),nm=(PINFO[x.id]||{}).band||'ผู้ใช้นี้',msg=`❌ ยกเลิกแล้ว — ${nm} กลับเป็นแพ็กเกจเดิมทันที`;
  if(x.demo){done(b,msg+'  (ตัวอย่าง)',0);toast(msg);return}
  if(!confirm('ยกเลิกสิทธิ์ของรายการนี้? (ใช้เมื่อไม่พบเงินเข้า)'))return;try{await F.updateDoc(F.doc(db,'bp_pay',x.id),{st:'revoked',t:F.serverTimestamp()});done(b,msg,0);toast(msg);histDraw(1)}catch(e){toast('❌ '+(e.code||e.message))}})}
async function bandsCard(){const c=$('bandc');if(!c)return;const q=await F.getDocs(F.collection(db,'bands'));const r=q.docs.map(d=>({id:d.id,...d.data()}));await sp81Load(r);
 c.innerHTML=`<h2>วง · ที่นั่ง</h2>`+(r.length?`${sp81Filter('b')}<table class="tb" id="sp81b"><tr><th>วง</th><th>เจ้าของ</th><th>สมาชิก</th><th>ที่นั่ง</th><th>ใช้งานล่าสุด</th><th>สถานะ</th></tr>${r.map(b=>`<tr data-sp="${SP81.s.has('b_'+b.id)?'s':'a'}"><td>${esc(b.name)}</td><td class="s">${esc((b.names||{})[b.owner]||b.owner.slice(0,10))}</td><td>${(b.mu||[]).length}</td><td><input type="number" min="5" max="100" value="${b.seats||5}" data-b="${esc(b.id)}" class="seatin" style="width:64px"> <button class="seatok" data-b="${esc(b.id)}">บันทึก</button> <button class="ownx" data-b="${esc(b.id)}" title="โอนหัวหน้าวง">👑 โอนหัวหน้า</button></td>${sp81Cells('b',b.id)}</tr>`).join('')}</table>`:'<p class="mut">ยังไม่มีวง</p>')+
  `<p class="mut">วงละ 5 คนเป็นค่าเริ่มต้น · เพิ่มได้เมื่อลูกค้าซื้อที่นั่งเพิ่ม</p><details><summary class="mut">ก่อนเปิดใช้ระบบแพ็กเกจ (ทำครั้งเดียวตอน deploy)</summary><p class="mut">ให้ Band ฟรีกับเจ้าของวงที่มีอยู่ทุกคน และตั้งที่นั่ง = จำนวนสมาชิกปัจจุบัน (อย่างน้อย 5)</p><button id="gfgo">ให้ Band ฟรีกับเจ้าของวงเดิม</button> <span id="gfr" class="mut"></span></details>`;
 c.querySelectorAll('.seatok').forEach(b=>b.onclick=async()=>{const v=+c.querySelector(`.seatin[data-b="${b.dataset.b}"]`).value;try{await F.updateDoc(F.doc(db,'bands',b.dataset.b),{seats:v});toast('บันทึกแล้ว')}catch(e){toast('❌ '+(e.code||e.message))}});
 c.querySelectorAll('.ownx').forEach(x=>x.onclick=async()=>{const b=r.find(y=>y.id==x.dataset.b);if(!b)return;try{await ownXfer(b);bandsCard()}catch(e){toast('❌ '+(e.code||e.message))}});
 sp81Wire(c,bandsCard);
 $('gfgo').onclick=async()=>{if(!confirm('ให้ Band ฟรี (ไม่มีวันหมดอายุ) กับเจ้าของวงที่มีอยู่ทั้งหมด?'))return;$('gfr').textContent='⏳';try{const n=await grandfather();$('gfr').textContent=`✅ ${n.p} บัญชี · ปรับที่นั่ง ${n.s} วง`}catch(e){$('gfr').textContent='❌ '+(e.code||e.message)}}}
// v1.82.1: transfer band leadership (admin). Backup JSON is downloaded first; old owner becomes editor; Band plan follows the new owner if missing.
async function ownXfer(b){const nm=u=>(b.names||{})[u]||u.slice(0,10);const cand=Object.keys(b.members||{}).filter(u=>u!==b.owner);if(!cand.length){toast('วงนี้ไม่มีสมาชิกอื่น');return}
 const pick=prompt('โอนหัวหน้าวง “'+b.name+'” (ตอนนี้: '+nm(b.owner)+')\nพิมพ์หมายเลขสมาชิกที่จะเป็นหัวหน้าใหม่:\n'+cand.map((u,i)=>(i+1)+'. '+nm(u)+' ('+b.members[u]+')').join('\n'));const nu=cand[(+pick||0)-1];if(!nu)return;
 if(!confirm('ยืนยัน: '+nm(nu)+' เป็นหัวหน้าวง “'+b.name+'” — '+nm(b.owner)+' จะเป็นสมาชิก (แก้ไขได้)'))return;
 const ref=F.doc(db,'bands',b.id),cur=(await F.getDoc(ref)).data();const bk=JSON.stringify({id:b.id,at:new Date().toISOString(),doc:cur},(k,v)=>v&&typeof v.toMillis=='function'?{ts:v.toMillis()}:v,1);
 try{localStorage.setItem('bp-adm-bk-'+b.id,bk);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bk],{type:'application/json'}));a.download='band-'+b.id+'-backup.json';document.body.appendChild(a);a.click();a.remove()}catch(e){}
 const m={...cur.members};m[cur.owner]='editor';m[nu]='owner';await F.updateDoc(ref,{owner:nu,members:m});
 try{const op=(await F.getDoc(F.doc(db,'bp_plan',cur.owner))).data()||{},pr=F.doc(db,'bp_plan',nu),np=(await F.getDoc(pr)).data()||{};if(op.p=='band'&&np.p!='band'){const d={p:'band',s:F.serverTimestamp(),em:np.em||'',n:'โอนหัวหน้าวง '+b.name,t:F.serverTimestamp()};if(op.e)d.e=op.e;await F.setDoc(pr,d)}}catch(e){toast('⚠️ โอนแล้ว แต่ตั้งแพ็กเกจไม่สำเร็จ: '+(e.code||e.message))}
 const v=(await F.getDoc(ref)).data();toast(v.owner==nu&&v.members[cur.owner]=='editor'?'👑 โอนหัวหน้าวงแล้ว: '+nm(nu):'❌ ตรวจสอบไม่ผ่าน')}
window.__ownXfer=ownXfer;
// one-off at deploy time: every current band owner → Band (no expiry); bands bigger than 5 keep their size
async function grandfather(){const q=await F.getDocs(F.collection(db,'bands'));const own=new Set();let s=0;
 for(const d of q.docs){const b=d.data();own.add(b.owner);const m=(b.mu||[]).length;if(m>(b.seats||5)){await F.updateDoc(d.ref,{seats:Math.min(100,m)});s++}}
 let p=0;for(const u of own){const ref=F.doc(db,'bp_plan',u),o=(await F.getDoc(ref)).data()||{};if(o.p=='band'&&!o.e)continue;
  const d={p:'band',s:o.s||F.serverTimestamp(),em:o.em||'',n:'grandfather 1.76 (วงเดิม ให้ฟรี)',t:F.serverTimestamp()};if(o.x)d.x=o.x;if(o.xe)d.xe=o.xe;await F.setDoc(ref,d);p++}
 return{p,s}}
window.__grandfather=grandfather;
async function cfgCard(){const c=$('cfgc');if(!c)return;try{const d=await Promise.race([F.getDoc(F.doc(db,'bp_cfg','pay')),new Promise((_,no)=>setTimeout(()=>no(new Error('timeout')),6000))]);if(d.exists())PCFG={...PCFG,...d.data()}}catch(e){}const P=PCFG.price;
 const row=(lab,inp,help)=>`<div class="fr82"><label>${lab}</label><div>${inp}<small>${help}</small></div></div>`;
 c.innerHTML=`<details id="cfgd82"><summary><h2>⚙️ ตั้งค่าการรับเงิน (ตั้งครั้งเดียว) ${PCFG.on?'<span class="chip82 g">เปิดรับสลิป</span>':'<span class="chip82 w">ปิดอยู่</span>'}</h2></summary>
  <p class="mut">ปกติไม่ต้องแตะส่วนนี้ ตั้งครั้งเดียวตอนเริ่มขาย ราคาที่นี่ต้องตรงกับในแอป (ระบบเตือนเมื่อยอดสลิปไม่ตรง)</p>
  ${row('รับสลิปอัตโนมัติ',`<label class="sw82"><input type="checkbox" id="cfon" ${PCFG.on?'checked':''}> เปิด</label>`,'เลข PromptPay ใส่ในแอปแล้ว: e-Wallet ลงท้าย 6565 · ผู้รับ นาย ไพฑูรย์ อินกรัด (บัญชีส่วนตัว) — ติ๊ก “เปิด” แล้วกด “บันทึกการตั้งค่า”')}
  ${row('สิทธิ์ชั่วคราว',`<input id="cfh" type="number" min="1" max="72" value="${PCFG.h}"> ชม.`,'ลูกค้าใช้ได้ทันทีหลังส่งสลิป นานเท่านี้ ระหว่างรอแอดมินยืนยัน')}
  ${row('ส่งสลิปได้สูงสุด',`<input id="cfcap" type="number" min="1" max="50" value="${PCFG.cap}"> ครั้ง/บัญชี`,'กันคนส่งสลิปปลอมวนซ้ำเพื่อรับสิทธิ์ชั่วคราว')}
  ${row('ถือว่าเป็นบัญชีใหม่',`<input id="cfage" type="number" min="0" max="720" value="${PCFG.age}"> ชม.`,'บัญชีที่อายุน้อยกว่านี้จะมีป้ายเตือน “บัญชีใหม่” ให้ตรวจละเอียดขึ้น')}
  <h3 class="h382">ราคา (บาท)</h3><div class="pr82">${Object.keys(P).map(k=>`<label>${esc(PAYN[k]||k)}<input class="cfp" data-k="${k}" type="number" min="1" value="${P[k]}"></label>`).join('')}</div>
  <button id="cfsv" class="pri">บันทึกการตั้งค่า</button></details>`;
 $('cfsv').onclick=async()=>{const price={};c.querySelectorAll('.cfp').forEach(i=>price[i.dataset.k]=Math.round(+i.value));const d={on:$('cfon').checked,h:Math.round(+$('cfh').value),cap:Math.round(+$('cfcap').value),age:Math.round(+$('cfage').value),price,t:F.serverTimestamp()};
  if(d.on&&!confirm('เปิดรับสลิปอัตโนมัติ? (ใส่เลข PromptPay ในแอปแล้วหรือยัง)'))return;try{await F.setDoc(F.doc(db,'bp_cfg','pay'),d);toast('บันทึกแล้ว');await cfgCard();$('cfgd82').open=true;flowDraw()}catch(e){toast('❌ '+(e.code||e.message))}}}
{const _pl=plans;plans=async function(){await _pl();if(TAB!='pl')return;const mk=(id,app)=>{const g=document.createElement('section');g.className='card';g.id=id;app?M.appendChild(g):M.prepend(g);return g};
 mk('ctc81',1);mk('cfgc');mk('payh');mk('payc');mk('pyflow');await cfgCard();ct81Card();if(TAB!='pl')return;flowDraw();payDraw();histDraw();
 const b=document.createElement('section');b.className='card';b.id='bandc';M.appendChild(b);bandsCard().catch(e=>b.textContent='❌ '+(e.code||e.message));
 try{if(window.Notification&&Notification.permission=='default')Notification.requestPermission()}catch(e){}}}

// ---- v1.77: โควตา — Spark free tier usage (stored bytes from the per-band 'ub' counters; no billing APIs on Spark) ----
const GIB=1073741824,BCAP=314572800,MB=n=>(n/1048576).toFixed(n<10485760?1:0)+' MB';
async function qtData(){const q=await F.getDocs(F.collection(db,'bands'));return q.docs.map(d=>({id:d.id,ref:d.ref,...d.data()}))}
function qtWarn(tot){const w=$('qwarn');if(!w)return;const p=tot/GIB;w.hidden=p<0.7;w.textContent=`⚠ พื้นที่ Firestore ใช้ไป ${Math.round(p*100)}% ของ 1 GiB (ฟรี) — ลบเพลงเก่า หรือลดพื้นที่ต่อวง`;
 badge78('qt',p>=0.7?'!':'');
 if(p>=0.7&&!qtWarn.n){qtWarn.n=1;toast('🔔 พื้นที่ใกล้เต็ม '+Math.round(p*100)+'%');try{if(Notification.permission=='granted')new Notification('SetSod: พื้นที่ใกล้เต็ม',{body:Math.round(p*100)+'% ของ 1 GiB'})}catch(e){}}}
let QTW=0;setInterval(()=>{if(QTW||$('nav').hidden)return;QTW=1;qtData().then(r=>qtWarn(r.reduce((a,b)=>a+(b.ub|0),0))).catch(()=>{QTW=0})},2000);
async function recount(b){const q=await F.getDocs(F.collection(db,'bands',b.id,'songs'));const ub=q.docs.reduce((a,d)=>{const x=d.data();return a+((x.fc|0)>0?(x.fz|0):0)},0);await F.updateDoc(b.ref,{ub});return ub}
async function quotaTab(){M.innerHTML='<section class="card"><p class="mut">กำลังโหลด…</p></section>';let r;try{r=await qtData()}catch(e){M.innerHTML=`<section class="card">❌ ${esc(e.code||e.message)}</section>`;return}if(TAB!='qt')return;
 const tot=r.reduce((a,b)=>a+(b.ub|0),0),p=tot/GIB;qtWarn(tot);r.sort((a,b)=>(b.ub|0)-(a.ub|0));
 M.innerHTML=`<section class="card"><h2>พื้นที่เก็บข้อมูล (Spark ฟรี 1 GiB)</h2>
  <div style="height:10px;border:1px solid #555;border-radius:5px;overflow:hidden"><div id="qbar" style="height:100%;width:${Math.min(100,p*100).toFixed(1)}%;background:${p>=0.7?'#e0a000':'#bbb'}"></div></div>
  <p><b id="qtot">${MB(tot)}</b> / 1024 MB · ${Math.round(p*100)}% <span class="mut">(นับเฉพาะไฟล์เพลงของวง ข้อมูลอื่นเล็กมาก)</span></p>
  <p class="mut">อ่าน/เขียนต่อวัน: Spark ให้ อ่าน 50,000 · เขียน 20,000 · ลบ 20,000 (รีเซ็ตประมาณ 14:00–15:00 น. เวลาไทย) — Spark ไม่มี API ให้แอปอ่านยอดจริง ดูได้ที่ <a href="https://console.firebase.google.com/project/puenduang/firestore/usage" target="_blank">Firebase console → Usage</a> · ประมาณ: เพลง 1 เพลงที่สมาชิกโหลดครั้งแรก ≈ 4–8 อ่าน (โหลดแล้วเก็บในเครื่อง ไม่อ่านซ้ำ)</p></section>
  <section class="card"><h2>ต่อวง</h2>${r.length?`<table class="tb"><tr><th>วง</th><th>สมาชิก</th><th>ใช้</th><th>เพดาน (MB)</th><th></th></tr>${r.map(b=>{const cap=b.cap>0?b.cap:BCAP,u=b.ub|0;return `<tr><td>${esc(b.name)}</td><td>${(b.mu||[]).length}</td><td>${b.ub==null?'<span class="mut">ยังไม่นับ</span>':MB(u)+' · '+Math.round(u/cap*100)+'%'}</td><td><input class="qcap" data-b="${esc(b.id)}" type="number" min="10" max="1024" value="${Math.round(cap/1048576)}" style="width:72px"> <button class="qcs" data-b="${esc(b.id)}">บันทึก</button></td><td><button class="qrc" data-b="${esc(b.id)}">นับใหม่</button></td></tr>`}).join('')}</table>`:'<p class="mut">ยังไม่มีวง</p>'}
  <p class="mut">ค่าเริ่มต้นวงละ 300 MB · “นับใหม่” = รวมขนาดไฟล์จากรายการเพลง (ใช้ครั้งแรกหลังอัปเดต 1.77 สำหรับวงเดิม)</p><button id="qall">นับใหม่ทุกวง</button> <span id="qallr" class="mut"></span></section>`;
 const B=id=>r.find(x=>x.id==id);
 M.querySelectorAll('.qcs').forEach(x=>x.onclick=async()=>{const v=Math.round(+M.querySelector(`.qcap[data-b="${x.dataset.b}"]`).value);try{await F.updateDoc(B(x.dataset.b).ref,{cap:v*1048576});toast('บันทึกแล้ว');quotaTab()}catch(e){toast('❌ '+(e.code||e.message))}});
 M.querySelectorAll('.qrc').forEach(x=>x.onclick=async()=>{x.disabled=true;try{const u=await recount(B(x.dataset.b));toast('นับแล้ว '+MB(u));quotaTab()}catch(e){x.disabled=false;toast('❌ '+(e.code||e.message))}});
 $('qall').onclick=async()=>{$('qallr').textContent='⏳';let n=0;try{for(const b of r){await recount(b);n++}$('qallr').textContent='✅ '+n+' วง';quotaTab()}catch(e){$('qallr').textContent='❌ '+(e.code||e.message)}}}
window.__qt={recount,qtData};

// v1.78 portal chrome: collapse (remembered), phone/tablet drawer, bell → slips (or quota)
{const B=document.body;if(localStorage.getItem('adm-rail')=='1')B.classList.add('rail');
 $('rail78').onclick=()=>{if(matchMedia('(max-width:1023px)').matches){B.classList.toggle('drw');return}B.classList.toggle('rail');localStorage.setItem('adm-rail',B.classList.contains('rail')?'1':'0')};
 $('scrim78').onclick=()=>B.classList.remove('drw');addEventListener('keydown',e=>{if(e.key=='Escape')B.classList.remove('drw')});
 $('bell78').onclick=()=>{if(PAYQ.length)return goSlip(PAYQ[0].id);const q=!(document.querySelector('#nav [data-t="qt"] .bdg')||{hidden:true}).hidden;document.querySelector(`#nav [data-t="${q?'qt':'pl'}"]`)?.click();if(!q)toast('ไม่มีสลิปรอตรวจ')}}
{const hh=()=>document.documentElement.style.setProperty('--hh',document.querySelector('header').offsetHeight+'px');hh();addEventListener('resize',hh)}
window.__p78={get vt(){return VT},get tab(){return TAB}};

// ===================== v1.81: contact channels card + support chat tab =====================
async function ct81Card(){const c=$('ctc81');if(!c)return;let d={};try{const s=await F.getDoc(F.doc(db,'bp_cfg','contact'));if(s.exists())d=s.data()}catch(e){}
 const L=(d.links||[]).concat([{l:'',u:''},{l:'',u:''}]).slice(0,Math.max(2,(d.links||[]).length+1));
 c.innerHTML=`<h2>${ic('chat')} ช่องทางติดต่อ (ลูกค้าเห็น)</h2><p class="mut">ช่องที่เว้นว่างจะไม่แสดง · แสดงในหน้าแพ็กเกจ หน้าบัญชี และหน้านโยบายความเป็นส่วนตัว</p>
 <div class="ct81f"><label>อีเมล <input id="cte" value="${esc(d.em||'paithooningrad@gmail.com')}" maxlength="120"></label><label>LINE OA <input id="ctl" value="${esc(d.line||'')}" placeholder="@setsod หรือลิงก์" maxlength="200"></label>
 <label>เพจ Facebook <input id="ctf" value="${esc(d.fb||'')}" placeholder="ชื่อเพจ หรือลิงก์" maxlength="200"></label><label>โทร <input id="ctt" value="${esc(d.tel||'')}" maxlength="40"></label>
 <div id="ctk">${L.map(x=>`<div class="ctk"><input class="ctkl" placeholder="ชื่อลิงก์" value="${esc(x.l||'')}" maxlength="40"><input class="ctku" placeholder="https://…" value="${esc(x.u||'')}" maxlength="300"></div>`).join('')}</div>
 <button id="cts">บันทึก</button> <span id="ctr" class="mut"></span></div>`;
 $('cts').onclick=async()=>{const links=[...c.querySelectorAll('.ctk')].map(r=>({l:r.querySelector('.ctkl').value.trim().slice(0,40),u:r.querySelector('.ctku').value.trim().slice(0,300)})).filter(x=>x.l&&/^https?:\/\//i.test(x.u)).slice(0,6);
  try{await F.setDoc(F.doc(db,'bp_cfg','contact'),{em:$('cte').value.trim(),line:$('ctl').value.trim(),fb:$('ctf').value.trim(),tel:$('ctt').value.trim(),links,t:F.serverTimestamp()});$('ctr').textContent='✅ บันทึกแล้ว';toast('✅ บันทึกช่องทางติดต่อแล้ว')}catch(e){$('ctr').textContent='❌ '+(e.code||e.message)}}}
const CHA={L:[],w:null,sel:null,mw:null,M:[]};
const ctm=t=>t&&t.toMillis?t.toMillis():0;
setInterval(()=>{if(CHA.w||$('nav').hidden)return;CHA.w=F.onSnapshot(F.query(F.collection(db,'bp_chat'),F.orderBy('lt','desc'),F.limit(100)),q=>{const u0=CHA.L.filter(x=>x.ur).length;CHA.L=q.docs.map(d=>({id:d.id,...d.data()}));const u=CHA.L.filter(x=>x.ur).length;badge78('ch',u);
 if(u>u0){toast('💬 มีแชทใหม่จากลูกค้า');try{if(Notification.permission=='granted')new Notification('SetSod: แชทใหม่',{body:(CHA.L.find(x=>x.ur)||{}).lm||''})}catch(e){}}
 if(TAB=='ch')chat81Draw()},e=>{CHA.w=null})},1500);
function chat81(){M.innerHTML=`<section class="card" id="ai21c"><h2>🤖 น้องเซ็ต ตอบแชทก่อน</h2><div id="ai21b" class="mut">กำลังโหลด…</div></section><section class="card" id="cha81"><h2>${ic('chat')} แชทกับลูกค้า</h2><div class="ch81g"><div id="chl81" class="chl81"></div><div id="chm81" class="chm81"><p class="mut">เลือกแชททางซ้าย</p></div></div></section>`;chat81Draw();ai21Adm()}
// v1.84.21 AI settings (bp_ai/cfg). The key is never shown back; blank = keep the saved one.
async function ai21Adm(){const B=$('ai21b');if(!B)return;let c={};try{const d=await F.getDoc(F.doc(db,'bp_ai','cfg'));if(d.exists())c=d.data()}catch(e){B.textContent='❌ '+(e.code||e.message);return}
 B.className='';B.innerHTML=`<label><input type="checkbox" id="aion" ${c.on?'checked':''}> เปิดให้น้องเซ็ตตอบทันทีเมื่อมีแชทเข้ามา</label>
 <div class="s">หลังแอดมินตอบ ให้น้องเซ็ตหยุดตอบแชทนั้น <input id="aihd" type="number" min="0" max="168" style="width:64px" value="${c.hold??12}"> ชม. (หรือจนกว่าจะกด ✅ ปิดเรื่อง)</div>
 <div class="s">ตอบได้ต่อคนต่อวัน <input id="ain" type="number" min="0" max="50" style="width:64px" value="${c.n??10}"> · โมเดล <input id="aim" style="width:190px" value="${esc(c.m||'gemini-3.5-flash-lite')}"> สำรอง <input id="aim2" style="width:190px" value="${esc(c.m2||'gemini-3.1-flash-lite')}"></div>
 <div class="s">Gemini API key <input id="aik" type="password" autocomplete="off" style="width:260px" placeholder="${c.k?'ตั้งไว้แล้ว •••• (เว้นว่าง = ใช้คีย์เดิม)':'วางคีย์ (ขึ้นต้น AIza…)'}"></div>
 <p class="mut s">AI ตอบจากคู่มือในแอปเท่านั้น ไม่ยืนยันการชำระเงิน/คืนเงิน · ลูกค้าขอคุยกับแอดมิน / น้องเซ็ตไม่แน่ใจ / ครบโควตาวันละ ${c.n??10} ครั้ง → เข้าคิว ⏳ รอแอดมิน (เรียงตามลำดับ เก่าสุดก่อน) · ข้อความถูกส่งไป Google Gemini (free tier ใช้ข้อมูลเพื่อปรับปรุงโมเดลได้)</p>
 <button id="ai21s">บันทึก</button> <span id="ai21r" class="mut"></span>`;
 $('ai21s').onclick=async()=>{const k=$('aik').value.trim()||c.k||'';try{await F.setDoc(F.doc(db,'bp_ai','cfg'),{on:$('aion').checked,n:Math.max(0,Math.min(50,parseInt($('ain').value)||0)),hold:Math.max(0,Math.min(168,parseInt($('aihd').value)||0)),m:$('aim').value.trim().slice(0,60),m2:$('aim2').value.trim().slice(0,60),k:k.slice(0,100),t:F.serverTimestamp()});
  c.k=k;$('aik').value='';$('aik').placeholder='ตั้งไว้แล้ว •••• (เว้นว่าง = ใช้คีย์เดิม)';$('ai21r').textContent='✅ บันทึกแล้ว';toast('✅ บันทึกการตั้งค่า AI แล้ว')}catch(e){$('ai21r').textContent='❌ '+(e.code||e.message)}}}
// v1.84.23: waiting-for-admin chats first, oldest queue time first (FIFO)
const ms23=v=>v&&v.toMillis?v.toMillis():0,wt23=x=>x.hh&&!(ms23(x.hm)>ms23(x.hq));
function chat81Draw(){const l=$('chl81');if(!l)return;const W=CHA.L.filter(wt23).sort((a,b)=>(ms23(a.hq)||ms23(a.lt))-(ms23(b.hq)||ms23(b.lt))),L=W.concat(CHA.L.filter(x=>!wt23(x)));
 l.innerHTML=L.length?(W.length?`<p class="s" style="margin:4px 0"><b>⏳ รอแอดมิน ${W.length} แชท</b> <span class="mut">(ตอบตามลำดับ เก่าสุดก่อน)</span></p>`:'')+L.map(x=>`<button class="cht81${x.ur?' ur':''}${x.id==CHA.sel?' on':''}" data-c="${esc(x.id)}"${wt23(x)?' style="border-color:#f5a524"':''}><b>${esc(x.em||x.id.slice(0,10))}</b>${wt23(x)?` <span class="tag err">⏳ รอแอดมิน คิว ${W.indexOf(x)+1}${x.hq?' · '+ftm(x.hq):''}</span>`:x.hh?' <span class="tag">👤 แอดมินดูแล</span>':x.ur?' <span class="tag err">ใหม่</span>':/^🤖/.test(x.lm||'')?' <span class="tag">🤖 AI ตอบแล้ว</span>':''}<span class="mut">${esc(x.lm||'')}</span><span class="mut s">${ftm(x.lt)}</span></button>`).join(''):'<p class="mut">ยังไม่มีแชท</p>';
 l.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>chat81Sel(b.dataset.c));const q=W.length;badge78&&badge78('ch',Math.max(q,CHA.L.filter(x=>x.ur).length))}
async function chat81Sel(u){CHA.sel=u;chat81Draw();if(CHA.mw){CHA.mw();CHA.mw=null}const m=$('chm81');
 m.innerHTML=`<div id="chx81" class="chx81"></div><div class="chf81"><textarea id="chi81" rows="2" maxlength="1000" placeholder="ตอบลูกค้า…"></textarea><button id="chs81">ส่ง</button></div><div class="s" style="margin-top:6px"><button id="chr81" class="ghost">✅ ปิดเรื่อง ให้น้องเซ็ตตอบต่อ</button></div>`;
 CHA.mw=F.onSnapshot(F.query(F.collection(db,'bp_chat',u,'m'),F.orderBy('t','asc'),F.limitToLast(200)),q=>{const x=$('chx81');if(!x)return;x.innerHTML=q.docs.map(d=>{const v=d.data();return `<div class="chb81 ${v.f=='a'?'a':v.f=='b'?'b':'u'}">${v.f=='b'?'<b class="ai21">🤖 น้องเซ็ต'+(v.h?' · ส่งต่อแอดมิน':'')+'</b>':''}${esc(v.x)}<i>${v.f=='a'?'ทีมงาน · ':''}${ftm(v.t)}</i></div>`}).join('');x.scrollTop=x.scrollHeight},e=>toast('❌ '+(e.code||e.message)));
 const th=CHA.L.find(x=>x.id==u);if(th&&th.ur){try{await F.setDoc(F.doc(db,'bp_chat',u),{ur:false,t:F.serverTimestamp()},{merge:true})}catch(e){}}
 const send=async()=>{const t=$('chi81'),v=t.value.trim().slice(0,1000);if(!v)return;$('chs81').disabled=true;try{const b=F.writeBatch(db);b.set(F.doc(F.collection(db,'bp_chat',u,'m')),{f:'a',x:v,t:F.serverTimestamp()});
  const h=CHA.L.find(x=>x.id==u)||{};b.set(F.doc(db,'bp_chat',u),{em:h.em||'',lm:v.slice(0,120),lt:F.serverTimestamp(),ur:false,ua:true,hh:true,hm:F.serverTimestamp(),t:F.serverTimestamp()},{merge:true});b.delete(F.doc(db,'bp_chq',u));await b.commit();t.value=''}catch(e){toast('❌ '+(e.code||e.message))}$('chs81').disabled=false;t.focus()};
 $('chs81').onclick=send;
 $('chr81').onclick=async()=>{try{const b=F.writeBatch(db);b.set(F.doc(db,'bp_chat',u),{hh:false,hq:F.deleteField(),hm:F.deleteField(),ur:false,t:F.serverTimestamp()},{merge:true});b.delete(F.doc(db,'bp_chq',u));await b.commit();toast('✅ ปิดเรื่องแล้ว น้องเซ็ตกลับมาตอบแชทนี้')}catch(e){toast('❌ '+(e.code||e.message))}};$('chi81').onkeydown=e=>{if(e.key=='Enter'&&!e.shiftKey){e.preventDefault();send()}}}
window.__ch81a={s:CHA,sel:chat81Sel};

// ===================== v1.81: last active · auto-suspend (>30 days) · unsuspend · delete =====================
// No Cloud Functions (Spark): marking runs here when the admin opens วง/ผู้ใช้. Last active = bp_reg.l (written by the app once a day on open).
const SP81={ok:new Map(),reg:new Map(),s:new Map(),last:new Map(),band:new Map(),user:new Map(),D:30};
const tms=t=>t&&t.toMillis?t.toMillis():0;
async function sp81Load(bands,plans){try{const [rg,ss]=await Promise.all([F.getDocs(F.collection(db,'bp_reg')),F.getDocs(F.collection(db,'bp_susp'))]);
 SP81.reg=new Map(rg.docs.map(d=>[d.id,tms(d.data().l)]));SP81.s=new Map(ss.docs.filter(d=>d.data().k!='ok').map(d=>[d.id,d.data()]));SP81.ok=new Map(ss.docs.filter(d=>d.data().k=='ok').map(d=>[d.id,tms(d.data().ls)]))}catch(e){console.warn('sp81',e);return}
 const now=Date.now(),old=now-SP81.D*864e5,mark=[];
 for(const b of bands||[]){SP81.band.set(b.id,b);const l=Math.max(tms(b.t),...(b.mu||[]).map(u=>SP81.reg.get(u)||0));SP81.last.set('b_'+b.id,l);if(l&&l<old&&!SP81.s.has('b_'+b.id)&&!((SP81.ok.get('b_'+b.id)||0)>old))mark.push(['b_'+b.id,'b',l])}
 for(const x of plans||[]){SP81.user.set(x.id,x);const l=SP81.reg.get(x.id)||tms(x.t)||tms(x.s);SP81.last.set('u_'+x.id,l);if(l&&l<old&&!SP81.s.has('u_'+x.id)&&!((SP81.ok.get('u_'+x.id)||0)>old)&&x.em!=OWNER)mark.push(['u_'+x.id,'u',l])}
 for(let i=0;i<mark.length;i+=400){const bt=F.writeBatch(db);for(const [id,k,l] of mark.slice(i,i+400))bt.set(F.doc(db,'bp_susp',id),{k,ls:F.Timestamp.fromMillis(l),t:F.serverTimestamp()});
  try{await bt.commit();for(const [id,k,l] of mark.slice(i,i+400))SP81.s.set(id,{k,ls:F.Timestamp.fromMillis(l)})}catch(e){toast('❌ ระงับอัตโนมัติไม่สำเร็จ: '+(e.code||e.message))}}
 if(mark.length)toast(`⏸ ระงับอัตโนมัติ ${mark.length} รายการ (ไม่ใช้งานเกิน ${SP81.D} วัน)`)}
function sp81Ago(t){if(!t)return '—';const d=Math.floor((Date.now()-t)/864e5);return d<1?'วันนี้':d+' วันที่แล้ว'}
function sp81Cells(k,id){const key=k+'_'+id,s=SP81.s.has(key),l=SP81.last.get(key)||0;
 return `<td class="${l&&Date.now()-l>SP81.D*864e5?'mut':''}" title="${l?new Date(l).toLocaleString('th-TH'):''}">${sp81Ago(l)}</td><td>${s?`<span class="tag err">ระงับ</span> <button class="sp81u" data-k="${key}">ยกเลิกระงับ</button> <button class="sp81d dng" data-k="${key}">ลบ</button>`:`<span class="tag ok">ใช้งาน</span> <button class="lnk sp81s" data-k="${key}">ระงับ</button>`}</td>`}
function sp81Filter(k){return `<div class="sp81f"><label>แสดง <select class="sp81sel" data-k="${k}"><option value="">ทั้งหมด</option><option value="a">ใช้งาน</option><option value="s">ระงับ (${[...SP81.s.keys()].filter(x=>x.startsWith(k+'_')).length})</option></select></label> <span class="mut">ไม่ใช้งานเกิน ${SP81.D} วัน = ระงับอัตโนมัติ · ผู้ใช้/สมาชิกวงเปิดแอปอีกครั้ง = กลับมาใช้งานเอง</span></div>`}
function sp81Wire(c,re){c.querySelectorAll('.sp81sel').forEach(s=>s.onchange=()=>{const t=s.closest('.sp81f').nextElementSibling;t.querySelectorAll('tr[data-sp]').forEach(r=>r.hidden=!!s.value&&r.dataset.sp!==s.value)});
 c.querySelectorAll('.sp81s').forEach(b=>b.onclick=async()=>{try{await F.setDoc(F.doc(db,'bp_susp',b.dataset.k),{k:b.dataset.k[0],ls:F.Timestamp.fromMillis(SP81.last.get(b.dataset.k)||Date.now()),t:F.serverTimestamp()});toast('⏸ ระงับแล้ว');re()}catch(e){toast('❌ '+(e.code||e.message))}});
 c.querySelectorAll('.sp81u').forEach(b=>b.onclick=async()=>{try{await F.setDoc(F.doc(db,'bp_susp',b.dataset.k),{k:'ok',ls:F.Timestamp.now(),t:F.serverTimestamp()});SP81.s.delete(b.dataset.k);toast('▶ ยกเลิกระงับแล้ว (ไม่ระงับซ้ำอีก 30 วัน)');re()}catch(e){toast('❌ '+(e.code||e.message))}});
 c.querySelectorAll('.sp81d').forEach(b=>b.onclick=async()=>{const k=b.dataset.k,isB=k[0]=='b',id=k.slice(2),nm=isB?((SP81.band.get(id)||{}).name||id):((SP81.user.get(id)||{}).em||id);
  if(!confirm(`ลบ${isB?'วง':'บัญชี'} “${nm}” ถาวร?\n${isB?'เพลง ไฟล์เสียง รูป ลิสต์ และคำเชิญทั้งหมดของวงนี้จะหายไป':'แพ็กเกจ สลิป แชท และข้อมูลสำรองของบัญชีนี้จะหายไป'} — กู้คืนไม่ได้`))return;
  if(prompt(`พิมพ์ ลบ เพื่อยืนยันการลบ “${nm}”`)!=='ลบ')return toast('ยกเลิกการลบ');b.disabled=true;b.textContent='กำลังลบ…';
  try{const n=isB?await sp81DelBand(id):await sp81DelUser(id);toast(`🗑 ลบแล้ว (${n} รายการ)`);re()}catch(e){b.disabled=false;b.textContent='ลบ';toast('❌ '+(e.code||e.message))}})}
// delete in chunks of 400 writes; returns number of docs deleted
async function sp81Del(refs){let n=0;for(let i=0;i<refs.length;i+=400){const bt=F.writeBatch(db);refs.slice(i,i+400).forEach(r=>bt.delete(r));await bt.commit();n+=Math.min(400,refs.length-i)}return n}
async function sp81DelBand(id){const B=F.doc(db,'bands',id),refs=[];
 for(const sub of ['lists','saved','art','activity','have'])(await F.getDocs(F.collection(B,sub))).docs.forEach(d=>refs.push(d.ref));
 for(const s of (await F.getDocs(F.collection(B,'songs'))).docs){(await F.getDocs(F.collection(s.ref,'chunks'))).docs.forEach(d=>refs.push(d.ref));refs.push(s.ref)}
 (await F.getDocs(F.query(F.collection(db,'invites'),F.where('b','==',id)))).docs.forEach(d=>refs.push(d.ref));
 refs.push(B,F.doc(db,'bp_susp','b_'+id));return sp81Del(refs)}   // band doc carries ub (used bytes) → quota freed with it
async function sp81DelUser(u){const own=await F.getDocs(F.query(F.collection(db,'bands'),F.where('owner','==',u)));if(own.size)throw new Error('ยังเป็นเจ้าของวง '+own.docs.map(d=>d.data().name).join(', ')+' — ลบวงก่อน');
 const refs=[];for(const [c,s] of [['bp_users','bk'],['bp_pay','slip'],['bp_chat','m']])(await F.getDocs(F.collection(db,c,u,s)).catch(()=>({docs:[]}))).docs.forEach(d=>refs.push(d.ref));
 for(const c of ['bp_users','bp_pay','bp_chat','bp_plan','bp_reg','bp_pub'])refs.push(F.doc(db,c,u));refs.push(F.doc(db,'bp_susp','u_'+u));return sp81Del(refs)}
window.__sp81={s:SP81,load:sp81Load,delBand:sp81DelBand,delUser:sp81DelUser};

// v1.83.4: expand an error/kill group → each event with its context (engine, pre-renders, low-memory mode, uptime, song length/format, heap, device RAM, foreground/background)
const KL84={eng:'เอนจิน',rend:'พรีเรนเดอร์',cache:'บัฟเฟอร์',lowmem:'โหมดประหยัดแรม',up:'เปิดมา',play:'กำลังเล่น',dur:'ยาวเพลง',fmt:'ไฟล์',heap:'หน่วยความจำ JS',devmem:'แรมเครื่อง',kills24h:'ถูกปิดใน 24 ชม.',view:'หน้า',beat:'สัญญาณล่าสุดก่อนปิด',cur:'เพลง'};
function evUI84(ev,W){if(!ev||!ev.length)return '';const row=x=>{const p=String(x.m||'').split(' | ').slice(1).join(' ');const kv={};p.replace(/(\w+)=((?:(?! \w+=).)*)/g,(_,k,v)=>{kv[k]=v});const c=String(x.m||'').match(/cur=(.*)$/);if(c&&!kv.cur)kv.cur=c[1];
 const bg=/background/.test(x.m)?'<span class="tag">พื้นหลัง/จอดับ</span> ':/unexpected end/.test(x.m)?'<span class="tag err">ขณะเปิดอยู่</span> ':'';
 const who=typeof whoName=='function'?whoName(x.u,W||new Map()):(x.u||'');
 return `<div class="s" style="border-top:1px solid #8883;padding:4px 0">${bg}<b>${esc(who)}</b> · ${fmtT(x.t)} · ${esc(x.dv||'')} · ${esc(x.v||'')}${Object.keys(kv).length?'<br>'+Object.entries(kv).map(([k,v])=>`<b>${esc(KL84[k]||k)}</b> ${esc(v)}`).join(' · '):''}</div>`};
 return `<details style="margin-top:6px"><summary class="s">ดูรายละเอียด ${ev.length} ครั้ง</summary>${ev.map(row).join('')}</details>`}

// ===== v1.82: staff management (owner only) =====

async function feedback20(){liveOff();M.innerHTML='<section class="card" data-sec="fb"><h2>ความเห็นจากผู้ใช้</h2><p class="mut">ข้อความที่ส่งจากเมนู «ส่งความเห็น» ในแอป (แยกจากแชท) · ผู้ใช้เขียนได้อย่างเดียว อ่านได้เฉพาะผู้ดูแล</p><div id="fbl20" class="mut">กำลังโหลด…</div></section>';
 const cat={bug:'บั๊ก',idea:'ไอเดีย',other:'อื่นๆ'};
 const draw=docs=>{
  const r=docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{
    const ta=a.t&&a.t.toMillis?a.t.toMillis():0,tb=b.t&&b.t.toMillis?b.t.toMillis():0;return tb-ta});
  const el=$('fbl20');if(!el)return;
  el.className='';
  el.innerHTML=r.length?`<div class="s" style="margin-bottom:6px">${r.length} รายการ</div><div class="card" style="padding:0 6px;overflow-x:auto"><table><tr><th>เวลา</th><th>ผู้ใช้</th><th>ประเภท</th><th>คะแนน</th><th>ข้อความ</th><th class="hide-s">เวอร์ชัน</th><th class="hide-s">เครื่อง</th></tr>`+
    r.map(x=>`<tr><td style="white-space:nowrap">${fmtT(x.t)}</td><td>${esc(x.em||x.uid||'')}</td><td>${esc(cat[x.c]||'—')}</td><td>${x.r?esc(String(x.r)): '—'}</td><td class="m">${esc(x.tx||'')}</td><td class="hide-s">${esc(x.v||'')}</td><td class="hide-s">${esc((x.pl||'')+(x.dv?' · '+x.dv:''))}</td></tr>`).join('')+'</table></div>':'ยังไม่มีความเห็น';
 };
 try{
  LIVE=F.onSnapshot(F.query(F.collection(db,'bp_fb'),F.orderBy('t','desc'),F.limit(200)),s=>draw(s.docs),e=>{const el=$('fbl20');if(el)el.textContent='โหลดไม่ได้: '+(e.code||e.message)});
 }catch(e){const el=$('fbl20');if(el)el.textContent='โหลดไม่ได้: '+(e.message||e)}
}

async function staff82(){if(ROLE!='owner'){M.innerHTML='<div class="mut">เฉพาะเจ้าของ</div>';return}
 M.innerHTML=`<section class="card"><h2 style="margin-top:0">${ic('users')} พนักงาน (สิทธิ์)</h2>
 <p class="mut">พนักงานเข้าหน้า <b>https://paithoonbeer.github.io/admin/</b> (เดิม setsod.web.app/admin/) ด้วยอีเมลที่เพิ่มให้ (Google หรืออีเมล/รหัสผ่านที่ยืนยันแล้ว) และจะเห็นแต่เมนูที่ได้รับสิทธิ์ · เมนู "พนักงาน" และ "เครื่องมือครั้งเดียว" เป็นของเจ้าของเท่านั้น</p>
 <div class="ct81f"><label>อีเมล <input id="sf_em" type="email" placeholder="staff@gmail.com"></label><label>ชื่อ (ไม่บังคับ) <input id="sf_n" maxlength="60" placeholder="เช่น น้องเอ"></label>
 <div class="stp82">${STK.map(k=>`<label><input type="checkbox" data-k="${k}" ${['ov','pl','ch'].includes(k)?'checked':''}> ${STL[k]}</label>`).join('')}</div>
 <button class="pri" id="sf_add">เพิ่มพนักงาน</button></div></section><section class="card"><h2 style="margin-top:0">รายชื่อพนักงาน</h2><div id="sf_l" class="mut">กำลังโหลด…</div></section>`;
 const save=async(em,n,on,perms)=>F.setDoc(F.doc(db,'bp_staff',em),{em,n:n||'',on,perms,t:F.serverTimestamp(),by:auth.currentUser.email});
 $('sf_add').onclick=async()=>{const em=$('sf_em').value.trim().toLowerCase(),n=$('sf_n').value.trim().slice(0,60);
  if(!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(em))return toast('อีเมลไม่ถูกต้อง');if(em===OWNER)return toast('อีเมลนี้เป็นเจ้าของอยู่แล้ว');
  const perms={};document.querySelectorAll('.stp82 [data-k]').forEach(c=>{if(c.checked)perms[c.dataset.k]=true});if(!Object.keys(perms).length)return toast('เลือกอย่างน้อย 1 เมนู');
  try{await save(em,n,true,perms);toast('✅ เพิ่ม '+em+' แล้ว');staff82()}catch(e){toast('❌ '+(e.code||e.message))}};
 let ds;try{ds=(await F.getDocs(F.collection(db,'bp_staff'))).docs.map(d=>d.data())}catch(e){$('sf_l').textContent='โหลดไม่สำเร็จ: '+(e.code||e.message);return}
 const L=$('sf_l');if(!ds.length){L.textContent='ยังไม่มีพนักงาน';return}L.className='';
 L.innerHTML=ds.map(d=>`<div class="card stf82" data-em="${esc(d.em)}" style="margin-bottom:8px"><div><b>${esc(d.n||d.em)}</b> <span class="mut">${esc(d.em)}</span> <span class="tag ${d.on?'':'err'}">${d.on?'ใช้งาน':'หยุด'}</span></div>
  <div class="stp82">${STK.map(k=>`<label><input type="checkbox" data-k="${k}" ${(d.perms||{})[k]?'checked':''}> ${STL[k]}</label>`).join('')}</div>
  <div style="display:flex;gap:6px;margin-top:6px"><button data-a="sv">บันทึกสิทธิ์</button><button data-a="tg">${d.on?'หยุดใช้งาน':'เปิดใช้งาน'}</button><button data-a="rm">${ic('trash')} ลบ</button></div></div>`).join('');
 L.onclick=async e=>{const b=e.target.closest('[data-a]');if(!b)return;const r=b.closest('[data-em]'),em=r.dataset.em,d=ds.find(x=>x.em==em);if(!d)return;
  const perms={};r.querySelectorAll('[data-k]').forEach(c=>{if(c.checked)perms[c.dataset.k]=true});
  try{if(b.dataset.a=='rm'){if(!confirm('ลบสิทธิ์ของ '+em+' ?'))return;await F.deleteDoc(F.doc(db,'bp_staff',em))}
   else await save(em,d.n,b.dataset.a=='tg'?!d.on:d.on,b.dataset.a=='sv'?perms:(d.perms||{}));toast('✅ บันทึกแล้ว');staff82()}catch(e){toast('❌ '+(e.code||e.message))}}}
{const st=document.createElement('style');st.textContent='#nav .grp82{font-size:11px;opacity:.6;padding:8px 10px 2px;text-transform:none}.stp82{display:flex;flex-wrap:wrap;gap:6px 14px;margin:6px 0}.stp82 label{display:flex;gap:4px;align-items:center}.stp82 label input{flex:0}';document.head.appendChild(st)}
