const __N=()=>!!(window.__NATIVE||(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform()));
// Beer Player cloud backup (Firebase Auth + Firestore). Loaded lazily; app works fully offline without it.
const V='13.1.0',G=`https://www.gstatic.com/firebasejs/${V}/`;
const CFG={apiKey:'AIzaSyDrGvs1pavaMgUUnHfFIjelyctflKZUAdM',authDomain:['beer-player.web.app','setsod.web.app'].includes(location.hostname)?location.hostname:'puenduang.firebaseapp.com',projectId:'puenduang',appId:'1:102670517075:web:3b5086ac710460a3a817a6',messagingSenderId:'102670517075'};
const CH=850000;
let A,F,app,auth,db,user=null,cbs=[];
export async function init(){if(auth)return;
 const [a,au,fs]=await Promise.all([import(G+'firebase-app.js'),import(G+'firebase-auth.js'),import(G+'firebase-firestore.js')]);A=au;F=fs;AM=a;
 app=a.initializeApp(CFG,'bp');auth=__N()?A.initializeAuth(app,{persistence:[A.indexedDBLocalPersistence,A.browserLocalPersistence]}):A.initializeAuth(app,{persistence:[A.indexedDBLocalPersistence,A.browserLocalPersistence],popupRedirectResolver:A.browserPopupRedirectResolver});
 try{db=F.initializeFirestore(app,{localCache:F.persistentLocalCache({tabManager:F.persistentSingleTabManager({})})})}catch(e){db=F.getFirestore(app)}// v1.83: disk cache → a reload/iOS kill re-reads only changed docs
 {const e=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&localStorage.getItem('bp-emu');if(e){A.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});F.connectFirestoreEmulator(db,'127.0.0.1',8080)}}
 if(!__N())try{await A.getRedirectResult(auth)}catch(e){}
 A.onAuthStateChanged(auth,u=>{const was=user;user=u;if(u&&!was)_ev('login','');cbs.forEach(f=>f(u))})}
export const onUser=f=>{cbs.push(f);if(auth)f(user)};
export const me=()=>user;
// v1.0.42: show the in-app "หน้าแอดมิน" button only to the owner / active staff (same test as admin.js; rules allow reading your own bp_staff doc)
export async function admRole(){const u=user;if(!u||!u.email)return '';const em=String(u.email).trim().toLowerCase();if(em==='paithooningrad@gmail.com')return 'owner';
 try{const d=await F.getDoc(F.doc(db,'bp_staff',em));return d.exists()&&d.data().on===true?'staff':''}catch(e){return ''}}
// v1.0.35: the web app may live on a host that is NOT the authDomain's own site (paithoonbeer.github.io → puenduang.firebaseapp.com).
// There signInWithRedirect breaks in Safari/WebKit (storage partitioning: "missing initial state"), so use signInWithPopup,
// called synchronously from the click (no await before it) so iOS does not block the popup. setsod.web.app/beer-player keep the old flow.
export const xsite=()=>CFG.authDomain!==location.hostname;
const WK=()=>{const u=navigator.userAgent;return /iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)||(/Safari\//.test(u)&&!/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\/|Android/.test(u))};
export const ready=()=>!!auth;
export function google(){if(__N())return init().then(()=>nativeGoogle());if(auth)return gWeb();return init().then(gWeb)}
function gWeb(){const p=new A.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
 if(!xsite()){const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1),sa=navigator.standalone===true||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);if((ios&&sa)||window.__INAPP)return A.signInWithRedirect(auth,p);
  return A.signInWithPopup(auth,p).catch(e=>{if(/popup-blocked|popup-closed-by-user|operation-not-supported|cancelled-popup/.test(e.code||'')&&e.code!=='auth/popup-closed-by-user'){return A.signInWithRedirect(auth,p)}throw e})}
 if(window.__INAPP)return Promise.reject(Object.assign(new Error('inapp'),{code:'bp/inapp'}));
 let pr;try{pr=A.signInWithPopup(auth,p)}catch(e){pr=Promise.reject(e)}
 return pr.catch(e=>{const c=e&&e.code||'';if((c==='auth/popup-blocked'||c==='auth/operation-not-supported-in-this-environment')&&!window.__INAPP&&!WK())return A.signInWithRedirect(auth,p);throw e})}
export async function emailIn(em,pw){await init();return A.signInWithEmailAndPassword(auth,em,pw)}
export async function emailUp(em,pw){await init();return A.createUserWithEmailAndPassword(auth,em,pw)}
export async function reset(em){await init();return A.sendPasswordResetEmail(auth,em)}
export async function out(){await init();return A.signOut(auth)}
export async function backup(payload,dev,ver){if(!user)throw new Error('not signed in');const s=JSON.stringify(payload),n=Math.max(1,Math.ceil(s.length/CH));if(n>20)throw new Error('backup too large');
 const b=F.writeBatch(db);for(let i=0;i<n;i++)b.set(F.doc(db,'bp_users',user.uid,'bk','c'+i),{i,d:s.slice(i*CH,(i+1)*CH),ts:F.serverTimestamp()});
 b.set(F.doc(db,'bp_users',user.uid),{n,ver:String(ver).slice(0,20),dev:String(dev).slice(0,200),bytes:s.length,ts:F.serverTimestamp()});await b.commit();return {n,bytes:s.length}}
export async function head(){if(!user)return null;const h=await F.getDoc(F.doc(db,'bp_users',user.uid));if(!h.exists())return null;const d=h.data();return {...d,ts:d.ts&&d.ts.toDate?d.ts.toDate():null}}
export async function catGet(){if(!user)throw new Error('not signed in');await TO(init(),8000);const s=await TO(F.getDoc(F.doc(db,'bp_cat','v1')),10000);if(!s.exists())return null;const d=s.data()||{};if(typeof d.j==='string'){try{const a=JSON.parse(d.j);return Array.isArray(a)?a:null}catch(e){return null}}return Array.isArray(d.songs)?d.songs:null}
export async function restore(){const h=await head();if(!h)return null;let s='';for(let i=0;i<h.n;i++){const c=await F.getDoc(F.doc(db,'bp_users',user.uid,'bk','c'+i));if(!c.exists())throw new Error('backup incomplete');s+=c.data().d}
 return {head:h,data:JSON.parse(s)}}
// v1.48 short setlist links: sl/{id} = {d: compressed payload, t}. Public get by id, create-only (see fbcfg/firestore.rules).
// v1.77: Spark daily quota → 'resource-exhausted'. Tell the app once (friendly banner, pause background sync) instead of hanging.
export const isQuota=e=>!!e&&(e.code=='resource-exhausted'||/resource.exhausted|quota exceeded/i.test(String(e.message||'')));
const TO=(p,ms)=>Promise.race([p,new Promise((_,j)=>setTimeout(()=>j(new Error('timeout')),ms))]).catch(e=>{if(isQuota(e))try{dispatchEvent(new CustomEvent('bp-quota',{detail:String(e.code||e.message)}))}catch(x){}throw e});
export async function slPut(id,d){await TO(init(),8000);const r=F.doc(db,'sl',id);
 let s=null;try{s=await TO(F.getDoc(r),6000)}catch(e){if(!/permission|not-found/.test(e.code||''))throw e}
 if(s&&s.exists())return s.data().d===d?'same':'clash';
 await TO(F.setDoc(r,{d,t:F.serverTimestamp()}),8000);return 'new'}
export async function slGet(id){await TO(init(),8000);const s=await TO(F.getDoc(F.doc(db,'sl',id)),8000);return s.exists()?s.data().d:null}
const LD=p=>p.includes('/')?F.doc(db,...p.split('/')):F.doc(db,'live',p);
// v1.52 live shared setlists: live/{id} = {v:1,n,o,s:{songKey:str},t}. Anyone with the id may get/create/update (team trust); no list/delete (see rules).
export async function liveCreate(id,{n,o,s}){await TO(init(),8000);await TO(F.setDoc(LD(id),{v:1,n,o,s,t:F.serverTimestamp()}),10000)}
export async function liveSub(id,cb,err){await TO(init(),8000);return F.onSnapshot(LD(id),{includeMetadataChanges:true},snap=>cb(snap.exists()?snap.data():null,snap.metadata),err)}
export async function liveUpd(id,{o,set,del}){await init();const a=[];for(const k in set)a.push(new F.FieldPath('s',k),set[k]);for(const k of del||[])a.push(new F.FieldPath('s',k),F.deleteField());if(o)a.push('o',o);a.push('t',F.serverTimestamp());
 return F.updateDoc(LD(id),a[0],a[1],...a.slice(2))}
export async function liveNet(on){if(!db)return;try{if(on){await F.disableNetwork(db);await F.enableNetwork(db)}}catch(e){}}
// ---- v1.53 bands (family-style): bands/{b} {name,owner,members:{uid:role},mu:[uid],names:{uid:name},ji,t}; invites/{code}; bands/{b}/lists/{id} (live format) ----
// v1.63: listeners auto-resubscribe after an error (e.g. permission race right after join, network drop on iOS) instead of dying silently
function rsub(mk,cb,err){let un=null,dead=false,n=0;const go=()=>{if(dead)return;try{un=F.onSnapshot(mk(),s=>{n=0;cb(s)},e=>{try{err&&err(e)}catch(x){}un=null;const q=isQuota(e);if(q)try{dispatchEvent(new CustomEvent('bp-quota',{detail:'listen'}))}catch(x){}if(!dead)setTimeout(go,q?Math.min(36e5,6e5*(++n)):Math.min(30000,2000*(++n)))})}catch(e){setTimeout(go,5000)}};go();return ()=>{dead=true;if(un)try{un()}catch(e){}}}
const uidOf=()=>{if(!user)throw Object.assign(new Error('not signed in'),{code:'auth/not-signed-in'});return user.uid};
export const myName=()=>user?String(user.displayName||user.email||'สมาชิก').slice(0,60):'';
export function bandsSub(cb,err){const u=uidOf();return rsub(()=>F.query(F.collection(db,'bands'),F.where('mu','array-contains',u)),s=>cb(s.docs.map(d=>({id:d.id,...d.data()}))),err)}
export async function bandCreate(name){const u=uidOf();const r=F.doc(F.collection(db,'bands'));await TO(F.setDoc(r,{name:String(name).slice(0,60),owner:u,members:{[u]:'owner'},mu:[u],names:{[u]:myName()},t:F.serverTimestamp()}),10000);return r.id}
export async function inviteCreate(b,role,code){const u=uidOf();try{await planEnsure()}catch(e){}await TO(F.setDoc(F.doc(db,'invites',code),{b,role,by:u,exp:F.Timestamp.fromMillis(Date.now()+7*864e5),t:F.serverTimestamp()}),10000);return code}
export async function inviteGet(code){uidOf();const s=await TO(F.getDoc(F.doc(db,'invites',code)),8000);if(!s.exists())return null;const d=s.data();return {...d,exp:d.exp&&d.exp.toMillis?d.exp.toMillis():0}}
export async function bandJoin(code){const u=uidOf();const iv=await inviteGet(code);if(!iv)throw Object.assign(new Error('invite not found'),{code:'bp/invite-missing'});if(iv.exp<Date.now())throw Object.assign(new Error('invite expired'),{code:'bp/invite-expired'});
 await TO(F.updateDoc(F.doc(db,'bands',iv.b),new F.FieldPath('members',u),iv.role,'mu',F.arrayUnion(u),new F.FieldPath('names',u),myName(),'ji',code,'t',F.serverTimestamp()),10000);return iv.b}
// v1.84.25 invite by email: bp_inv/{band~email} {e,b,bn,role,by,byn,t}. Only the invited (verified) email reads/accepts/declines.
const em25=e=>String(e||'').trim().toLowerCase();
export function me25(){return user?{e:em25(user.email),v:!!user.emailVerified}:null}
export async function emInvCreate(b,bn,e,role){const u=uidOf();e=em25(e);if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)||e.length>200)throw Object.assign(new Error('bad email'),{code:'bp/bad-email'});
 const id=b+'~'+e;await TO(F.setDoc(F.doc(db,'bp_inv',id),{e,b,bn:String(bn||'').slice(0,60),role:role=='viewer'?'viewer':'editor',by:u,byn:myName().slice(0,60),t:F.serverTimestamp()}),10000);return id}
export async function emInvList(b){uidOf();const q=await TO(F.getDocs(F.query(F.collection(db,'bp_inv'),F.where('b','==',b))),10000);return q.docs.map(d=>({id:d.id,...d.data()}))}
export async function emInvDel(id){uidOf();await TO(F.deleteDoc(F.doc(db,'bp_inv',id)),10000)}
export async function emInvMine(){const u=uidOf();if(user.email){try{if(!user.emailVerified)await user.reload();if(user.emailVerified&&!(await user.getIdTokenResult()).claims.email_verified)await user.getIdToken(true)}catch(x){}}const e=em25(user.email);if(!e||!user.emailVerified)return [];const q=await TO(F.getDocs(F.query(F.collection(db,'bp_inv'),F.where('e','==',e))),10000);return q.docs.map(d=>({id:d.id,...d.data()}))}
export async function emInvAccept(iv){const u=uidOf();const b=F.writeBatch(db);
 b.update(F.doc(db,'bands',iv.b),new F.FieldPath('members',u),iv.role,'mu',F.arrayUnion(u),new F.FieldPath('names',u),myName(),'je',iv.id,'t',F.serverTimestamp());b.delete(F.doc(db,'bp_inv',iv.id));await TO(b.commit(),10000);
 try{await actPut(iv.b,'join','','','m')}catch(e){}return iv.b}
export async function bandLeave(b,who){const u=who||uidOf();uidOf();await TO(F.updateDoc(F.doc(db,'bands',b),new F.FieldPath('members',u),F.deleteField(),'mu',F.arrayRemove(u),new F.FieldPath('names',u),F.deleteField(),'t',F.serverTimestamp()),10000)}
// v1.84.12: owner self-heal of a member whose own 'leave' never landed (no extra activity entry)
// v1.84.18 owner transfer: owner offers (xo), the member accepts/declines. Plan payer (pp) stays with the band until it ends.
export async function bandXfer(b,to){uidOf();await TO(F.updateDoc(F.doc(db,'bands',b),'xo',{u:to,t:F.serverTimestamp()},'t',F.serverTimestamp()),10000)}
export async function bandXferCancel(b){uidOf();await TO(F.updateDoc(F.doc(db,'bands',b),'xo',F.deleteField(),'t',F.serverTimestamp()),10000)}
export async function bandXferDecline(b){uidOf();await TO(F.updateDoc(F.doc(db,'bands',b),'xo',F.deleteField(),'t',F.serverTimestamp()),10000)}
export async function bandTake(b){const u=uidOf();const r=F.doc(db,'bands',b);let old='';
 await TO(F.runTransaction(db,async tx=>{const d=await tx.get(r);const o=d.data();if(!o||!o.xo||o.xo.u!==u)throw Object.assign(new Error('no offer'),{code:'bp/no-offer'});old=o.owner;
  tx.update(r,'owner',u,new F.FieldPath('members',u),'owner',new F.FieldPath('members',o.owner),'editor','xo',F.deleteField(),'pp',o.pp||o.owner,'t',F.serverTimestamp())}),15000);
 try{const d=await F.getDoc(r);await actPut(b,'own',(d.data().names||{})[old]||'',myName(),'m')}catch(e){}return old}
export async function bandDrop(b,who){uidOf();await TO(F.updateDoc(F.doc(db,'bands',b),new F.FieldPath('members',who),F.deleteField(),'mu',F.arrayRemove(who),new F.FieldPath('names',who),F.deleteField(),'t',F.serverTimestamp()),10000)}
export async function bandRole(b,who,role){uidOf();await TO(F.updateDoc(F.doc(db,'bands',b),new F.FieldPath('members',who),role,'t',F.serverTimestamp()),10000)}
export async function bandRename(b,name){uidOf();await TO(F.updateDoc(F.doc(db,'bands',b),'name',String(name).slice(0,60),'t',F.serverTimestamp()),10000)}
export async function bandDelete(b){uidOf();await TO(F.deleteDoc(F.doc(db,'bands',b)),10000)}
export function bandListsSub(b,cb,err){uidOf();return rsub(()=>F.collection(db,'bands',b,'lists'),s=>cb(s.docs.map(d=>({id:d.id,n:d.data().n||'',c:(d.data().o||[]).length,ts:d.data().t&&d.data().t.toMillis?d.data().t.toMillis():0}))),err)}
export async function bandListDel(b,id){uidOf();await TO(F.deleteDoc(F.doc(db,'bands',b,'lists',id)),10000)}
// ---- v1.62 band saved setlists: bands/{b}/saved/{id} = {n, o:[songId], d:json(prefs/notes/titles), by:uid, byn:name, t} ----
export function bandSavedSub(b,cb,err){uidOf();return rsub(()=>F.collection(db,'bands',b,'saved'),s=>cb(s.docs.map(d=>{const x=d.data();return {id:d.id,n:x.n||'',o:x.o||[],d:x.d||'{}',by:x.by||'',byn:x.byn||'',t:x.t&&x.t.toMillis?x.t.toMillis():Date.now()}})),err)}
export async function bandSavedPut(b,id,it){const u=uidOf();await TO(F.setDoc(F.doc(db,'bands',b,'saved',id),{n:String(it.n).slice(0,60),o:it.o.slice(0,200).map(String),d:String(it.d).slice(0,200000),by:u,byn:myName(),t:F.serverTimestamp()}),10000)}
export async function bandSavedDel(b,id){uidOf();await TO(F.deleteDoc(F.doc(db,'bands',b,'saved',id)),10000)}
// ---- v1.63 band songs: bands/{b}/songs/{k} = {ti,ar,sd,fn,by,byn,t}. Metadata only (audio stays on each device; Spark plan has no Storage) ----
// v1.80.3: song images for ANY song (catalog songs too), per band: bands/{b}/art/{sha1(songId)} = {k:songId, im:jpeg dataURL, by, t}
const artKey=async k=>[...new Uint8Array(await crypto.subtle.digest('SHA-1',new TextEncoder().encode(String(k))))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function bandArtSub(b,cb,err){uidOf();return rsub(()=>F.collection(db,'bands',b,'art'),s=>cb(s.docs.map(d=>{const x=d.data();return {k:x.k||'',im:typeof x.im=='string'?x.im:''}})),err)}
export async function bandArtPut(b,k,im){const u=uidOf();const r=F.doc(db,'bands',b,'art',await artKey(k));
 if(im)await TO(F.setDoc(r,{k:String(k).slice(0,300),im:String(im),by:u,t:F.serverTimestamp()}),15000);else await TO(F.deleteDoc(r),15000)}
export function bandSongsSub(b,cb,err){uidOf();return rsub(()=>F.collection(db,'bands',b,'songs'),s=>cb(s.docs.map(d=>{const x=d.data();return {id:d.id,ti:x.ti||'',ar:x.ar||'',sd:x.sd||'',fn:x.fn||'',gd:x.gd||'',fc:x.fc|0,fz:x.fz|0,fm:x.fm||'',v:typeof x.v=='number'?x.v:0,k:typeof x.k=='string'?x.k:null,im:typeof x.im=='string'?x.im:'',by:x.by||'',byn:x.byn||'',t:x.t&&x.t.toMillis?x.t.toMillis():Date.now()}})),err)}
export async function bandSongsPut(b,list){const u=uidOf();for(let i=0;i<list.length;i+=200){const bt=F.writeBatch(db);for(const it of list.slice(i,i+200))bt.set(F.doc(db,'bands',b,'songs',it.id),{ti:String(it.ti).slice(0,200),ar:String(it.ar||'').slice(0,200),sd:['L','R','X'].includes(it.sd)?it.sd:'X',fn:String(it.fn||'').slice(0,300),by:u,byn:myName(),t:F.serverTimestamp()});await TO(bt.commit(),15000)}}
export async function bandSongDel(b,id,fc){uidOf();let n=fc|0;if(n<0)n=0;let fz=0;try{const sd=await TO(F.getDoc(F.doc(db,'bands',b,'songs',id)),10000);if(sd.exists()){fz=sd.data().fz|0;if(fc==null&&sd.data().fc)n=sd.data().fc|0}}catch(e){}
 if(fc==null){try{const q=await TO(F.getDocs(F.collection(db,'bands',b,'songs',id,'chunks')),15000);n=0;for(const d of q.docs)n=Math.max(n,(+d.id)+1)}catch(e){n=0}}
 for(let i=0;i<n;i++){try{await chunkW(b,id,i,null,csz(fz,i))}catch(e){console.warn('chunk del',i,e.code||e.message)}}
 await TO(F.deleteDoc(F.doc(db,'bands',b,'songs',id)),10000)}
// v1.65: band song audio inside Firestore (Spark plan, no Storage/billing). Chunks bands/{b}/songs/{id}/chunks/{0..n-1} = {d:Bytes<=900KB}; size/count/mime on the song doc.
export const BCH=900000;
export async function bandSongMeta(b,id,o){uidOf();const u={t:F.serverTimestamp()};if(o.ti!=null)u.ti=String(o.ti).slice(0,200);if(o.ar!=null)u.ar=String(o.ar).slice(0,200);if(o.k!=null)u.k=String(o.k).slice(0,20);if(['L','R','X'].includes(o.sd))u.sd=o.sd;await TO(F.updateDoc(F.doc(db,'bands',b,'songs',id),u),15000)} // v1.84.2: any member edits title/artist/key/side; doc id stays
export async function bandSongSd(b,id,sd){uidOf();if(!['L','R','X'].includes(sd))throw new Error('bad side');await TO(F.updateDoc(F.doc(db,'bands',b,'songs',id),{sd,t:F.serverTimestamp()}),15000)} // v1.83.8: click-side-only update keeps the uploader — owner, or the editor who uploaded it
export async function bandSongIm(b,id,im){uidOf();await TO(F.updateDoc(F.doc(db,'bands',b,'songs',id),{im:im?String(im):F.deleteField(),t:F.serverTimestamp()}),15000)} // v1.80.3: image-only update keeps the uploader (by) — rules allow owner/editor
// v1.77: every chunk write/delete moves the band's 'ub' byte counter in the same batch (rules check the delta + band cap).
export const BCAP=314572800;export const bandCap=d=>d&&d.cap>0?d.cap:BCAP;
const csz=(fz,i)=>Math.max(0,Math.min(BCH,(fz|0)-i*BCH));
async function chunkW(b,id,i,part,before){const br=F.doc(db,'bands',b),cr=F.doc(db,'bands',b,'songs',id,'chunks',String(i)),after=part?part.length:0;
 const go=ub=>{const bt=F.writeBatch(db);if(part)bt.set(cr,{d:F.Bytes.fromUint8Array(part)});else bt.delete(cr);bt.update(br,{ub,uk:id+'/'+i,t:F.serverTimestamp()});return TO(bt.commit(),90000)};
 try{await go(F.increment(after-before))}catch(e){if(e.code!='permission-denied')throw e;
  // stale size guess (old partial upload / legacy band without a counter): read the real sizes once and send an exact value
  const [bd,cd]=await Promise.all([TO(F.getDoc(br),15000),TO(F.getDoc(cr),60000)]);const real=cd.exists()?cd.data().d.toUint8Array().length:0,old=(bd.data()||{}).ub|0;
  if(part&&old+after-real>bandCap(bd.data()))throw Object.assign(new Error('พื้นที่เพลงของวงเต็ม'),{code:'bp/band-full'});await go(Math.max(0,old+after-real))}}
// v1.80: old={fc,fz} replaces an existing band copy in place (same song id): overwrite chunks, delete leftovers, bump v so members re-download.
export async function bandFilePut(b,id,u8,mime,prog,old,sd){const u=uidOf();const n=Math.ceil(u8.length/BCH);if(!n||n>40)throw new Error('ไฟล์ใหญ่เกินไป');const of=old?old.fc|0:0,oz=old?old.fz|0:0;
 for(let i=0;i<n;i++){await chunkW(b,id,i,u8.subarray(i*BCH,Math.min(u8.length,(i+1)*BCH)),i<of?csz(oz,i):0);if(prog)prog((i+1)/n)}
 for(let i=n;i<of;i++){try{await chunkW(b,id,i,null,csz(oz,i))}catch(e){console.warn('chunk trim',i,e.code||e.message)}}
 const up={fc:n,fz:u8.length,fm:String(mime||'audio/mpeg').slice(0,60),v:Date.now(),by:u,byn:myName(),t:F.serverTimestamp()};if(['L','R','X'].includes(sd))up.sd=sd;
 await TO(F.updateDoc(F.doc(db,'bands',b,'songs',id),up),15000);return n}
export async function bandChunk0(b,id){uidOf();const d=await TO(F.getDoc(F.doc(db,'bands',b,'songs',id,'chunks','0')),60000);return d.exists()?d.data().d.toUint8Array():null}
export async function bandFileGet(b,id,fc,prog){uidOf();const parts=[];for(let i=0;i<fc;i++){const d=await TO(F.getDoc(F.doc(db,'bands',b,'songs',id,'chunks',String(i))),90000);if(!d.exists())throw new Error('ไฟล์ในวงไม่ครบ');parts.push(d.data().d.toUint8Array());if(prog)prog((i+1)/fc)}return parts}
// ---- v1.64 Google Drive (drive.file scope) for band song audio. Separate Firebase app instance so the main login is untouched. ----
let DA=null,AM=null,DT={tok:'',exp:0};
export function drivePrep(){if(__N())return true;if(!DA&&AM&&A){const ap=AM.initializeApp(CFG,'bp-drive');DA=A.initializeAuth(ap,{persistence:A.inMemoryPersistence,popupRedirectResolver:A.browserPopupRedirectResolver})}return !!DA}
export function driveHasToken(){return DT.tok&&Date.now()<DT.exp}
export async function driveToken(){if(driveHasToken())return DT.tok;
 if(__N()){const r=await nGoogle(['https://www.googleapis.com/auth/drive.file']);if(!r.credential||!r.credential.accessToken)throw Object.assign(new Error('no token'),{code:'bp/drive-token'});DT={tok:r.credential.accessToken,exp:Date.now()+50*60e3};return DT.tok}
 drivePrep();
 const p=new A.GoogleAuthProvider();p.addScope('https://www.googleapis.com/auth/drive.file');const hint=user&&user.email;p.setCustomParameters(hint?{login_hint:hint}:{prompt:'select_account'});
 const r=await A.signInWithPopup(DA,p);const c=A.GoogleAuthProvider.credentialFromResult(r);if(!c||!c.accessToken)throw Object.assign(new Error('no token'),{code:'bp/drive-token'});
 DT={tok:c.accessToken,exp:Date.now()+50*60e3};try{await A.signOut(DA)}catch(e){}return DT.tok}
async function dj(r){if(!r.ok){let m='';try{m=(await r.json()).error.message}catch(e){}throw Object.assign(new Error(m||('HTTP '+r.status)),{code:'bp/drive-'+r.status})}return r.status==204?null:r.json()}
const DH=()=>({Authorization:'Bearer '+DT.tok});
async function driveFolder(){let id=localStorage.getItem('bp-gdf');if(id){try{const f=await dj(await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,trashed`,{headers:DH()}));if(f&&!f.trashed)return id}catch(e){}}
 const q=encodeURIComponent("name='Beer Player' and mimeType='application/vnd.google-apps.folder' and trashed=false");const l=await dj(await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,{headers:DH()}));
 id=l.files&&l.files[0]&&l.files[0].id;if(!id){const f=await dj(await fetch('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{...DH(),'Content-Type':'application/json'},body:JSON.stringify({name:'Beer Player',mimeType:'application/vnd.google-apps.folder'})}));id=f.id}
 localStorage.setItem('bp-gdf',id);return id}
export async function driveUpload(blob,name,tok){if(tok&&tok!==DT.tok)DT={tok,exp:Date.now()+50*60e3};if(!driveHasToken())throw Object.assign(new Error('sign in'),{code:'bp/drive-token'});const par=await driveFolder();
 const s=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{...DH(),'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':blob.type||'audio/mpeg'},body:JSON.stringify({name,parents:[par]})});
 if(!s.ok)await dj(s);const loc=s.headers.get('Location');if(!loc)throw Object.assign(new Error('no upload url'),{code:'bp/drive-cors'});
 const f=await dj(await fetch(loc,{method:'PUT',headers:{'Content-Type':blob.type||'audio/mpeg'},body:blob}));
 await dj(await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}/permissions?fields=id`,{method:'POST',headers:{...DH(),'Content-Type':'application/json'},body:JSON.stringify({role:'reader',type:'anyone'})}));return f.id}
// public (anyone-with-link) file → Blob via API key (CORS-enabled). Needs Drive API enabled in the project.
export async function driveFetch(id){const k=CFG.apiKey;const m=await dj(await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType,size&supportsAllDrives=true&key=${k}`));
 const r=await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true&key=${k}`);if(!r.ok)await dj(r);return {name:m.name||(id+'.mp3'),type:m.mimeType||'audio/mpeg',blob:await r.blob()}}
export function driveIdOf(s){s=String(s||'').trim();const m=s.match(/\/d\/([\w-]{20,})/)||s.match(/[?&]id=([\w-]{20,})/)||s.match(/^([\w-]{20,})$/);return m?m[1]:''}
export async function bandSongGd(b,id,gd){const u=uidOf();await TO(F.updateDoc(F.doc(db,'bands',b,'songs',id),{gd:String(gd).slice(0,200),by:u,byn:myName(),t:F.serverTimestamp()}),10000)}

// ---- v1.66 usage logs (admin page). Tiny, batched; see app.js lg66.
function _ev(ty,m){try{dispatchEvent(new CustomEvent('bp-ev',{detail:{ty,m:String(m||'').slice(0,200)}}))}catch(e){}}
{const w=(f,ty,mf)=>async(...a)=>{const r=await f(...a);try{_ev(ty,mf?mf(a,r):'')}catch(e){}return r};
 bandCreate=w(bandCreate,'band_create',(a,r)=>r);bandJoin=w(bandJoin,'band_join',(a,r)=>r);
 bandFilePut=w(bandFilePut,'song_up',a=>a[0]+' '+Math.round((a[2]&&a[2].length||0)/1024)+'KB');bandSavedPut=w(bandSavedPut,'set_band',a=>a[0]);}
export function signedIn(){return !!user}
export async function logPut(evs,info){await init();try{if(auth&&auth.authStateReady)await TO(auth.authStateReady(),5000)}catch(e){}// v1.84.19: wait for the saved login so logs carry the uid
 const uid=user?user.uid:'';if(!uid)evs=evs.filter(e=>/^(err|kill|stall|native_auth_err)$/.test(e.ty));// signed-out: rules accept crash-type logs only
 const b=F.writeBatch(db),inc={d:info.day},C={};let dk='';try{dk=uid&&localStorage.getItem('bp-dau66')!==info.day+uid?info.day+uid:''}catch(e){}
 for(const e of evs){b.set(F.doc(F.collection(db,'bp_logs')),{t:F.serverTimestamp(),d:info.day,ty:e.ty,s:info.s,v:info.v,dv:info.dv,u:uid,m:String(e.m||'').slice(0,300)});C[e.ty]=(C[e.ty]||0)+1}for(const k in C)inc[k]=F.increment(C[k]);
 if(dk)inc.dau=F.increment(1);
 b.set(F.doc(db,'bp_stats',info.day),inc,{merge:true});
 if(dk)b.set(F.doc(db,'bp_reg',uid),{l:F.serverTimestamp(),s:info.s,v:info.v,dv:info.dv},{merge:true});
 if(!evs.length&&!dk)return;await b.commit();if(dk)try{localStorage.setItem('bp-dau66',dk)}catch(e){}}
// ===== v1.70: band activity feed + per-member "have" cache list + system announcement =====
// bands/{b}/activity/{auto} = {k,ti,x,by,byn,t}; read last 50. bands/{b}/have/{uid} = {s:[songId..],t}. bp_sys/ann = {m,v,t}
// v1.77: g = deep-link target ('s:<songId>' song, 'v:<savedId>' saved list, 'm' members, 't' Tonight)
export async function actPut(b,k,ti,x,g,d){try{const u=uidOf();const o={k:String(k),ti:String(ti||'').slice(0,200),x:String(x||'').slice(0,100),by:u,byn:myName(),t:F.serverTimestamp()};if(g)o.g=String(g).slice(0,60);if(d)o.d=String(d).slice(0,1500);await TO(F.addDoc(F.collection(db,'bands',b,'activity'),o),10000)}catch(e){}}
export function actSub(b,cb,err){uidOf();return rsub(()=>F.query(F.collection(db,'bands',b,'activity'),F.orderBy('t','desc'),F.limit(60)),s=>cb(s.docs.map(d=>{const x=d.data();return {id:d.id,k:x.k||'',ti:x.ti||'',x:x.x||'',g:x.g||'',d:x.d||'',by:x.by||'',byn:x.byn||'',t:x.t&&x.t.toMillis?x.t.toMillis():Date.now()}})),err)}
export async function actDel(b,id){try{await TO(F.deleteDoc(F.doc(db,'bands',b,'activity',id)),10000)}catch(e){}}
export async function havePut(b,ids){const u=uidOf();await TO(F.setDoc(F.doc(db,'bands',b,'have',u),{s:ids.slice(0,500).map(String),t:F.serverTimestamp()}),10000)}
export function haveSub(b,cb,err){uidOf();return rsub(()=>F.collection(db,'bands',b,'have'),s=>cb(Object.fromEntries(s.docs.map(d=>[d.id,d.data().s||[]]))),err)}
export function sysSub(cb){let un=()=>{};init().then(()=>{un=rsub(()=>F.doc(db,'bp_sys','ann'),d=>{const x=d.exists()?d.data():null;cb(x?{m:x.m||'',v:x.v||'',t:x.t&&x.t.toMillis?x.t.toMillis():0}:null)},()=>{})}).catch(()=>{});return ()=>un()}
export function maintSub(cb){let un=()=>{};init().then(()=>{un=rsub(()=>F.doc(db,'bp_maint','cur'),d=>{const x=d.exists()?d.data():null;cb(x?{on:!!x.on,start:x.start&&x.start.toMillis?x.start.toMillis():0,end:x.end&&x.end.toMillis?x.end.toMillis():0,msg:typeof x.msg==='string'?x.msg:'',t:x.t&&x.t.toMillis?x.t.toMillis():0}:null)},()=>{})}).catch(()=>{});return ()=>un()}
{const w=(fn,after)=>async function(...a){const r=await fn(...a);try{after(r,...a)}catch(e){}return r};
 bandSongsPut=w(bandSongsPut,(r,b,list)=>{if(list.length>2)actPut(b,'addn','',String(list.length));else list.forEach(it=>actPut(b,'add',it.ti,'','s:'+it.id))});
 bandFilePut=w(bandFilePut,(r,b,id)=>{F.getDoc(F.doc(db,'bands',b,'songs',id)).then(d=>actPut(b,'up',d.exists()?d.data().ti:'','','s:'+id)).catch(()=>{})});
 bandSavedPut=w(bandSavedPut,(r,b,id,it)=>actPut(b,'save',it.n,'','v:'+id));
 bandSavedDel=w(bandSavedDel,(r,b,id)=>actPut(b,'sdel',''));
 bandRename=w(bandRename,(r,b,n)=>actPut(b,'ren',n,'','m'));
 bandRole=w(bandRole,(r,b,who,role)=>{F.getDoc(F.doc(db,'bands',b)).then(d=>actPut(b,'role',(d.data().names||{})[who]||'',role,'m')).catch(()=>{})});
 bandJoin=w(bandJoin,async(r,code)=>{try{const iv=await inviteGet(code);if(iv)actPut(iv.b,'join','','','m')}catch(e){}});
 const _bl=bandLeave;bandLeave=async function(b,who){if(!who||who===user.uid)await actPut(b,'leave','','','m');else{try{const d=await F.getDoc(F.doc(db,'bands',b));await actPut(b,'kick',(d.data().names||{})[who]||'','','m')}catch(e){}}try{return await _bl(b,who)}catch(e){if(e&&e.code==='permission-denied')throw e;await new Promise(r=>setTimeout(r,1500));return _bl(b,who)}}}
// ---- v1.75-preview plans: bp_plan/{uid} = {p:'trial'|'free'|'pro'|'band', s:start(server time), e?:paid expiry, em, n?, t}. Trial = 7 days from s (server-side). Only admin can change. ----
const plRead=d=>{if(!d.exists())return null;const x=d.data({serverTimestamps:'estimate'});/*v1.83.4: with the disk cache a just-created trial read back with s=null → 'trial ended' for new sign-ups*/return {p:x.p||'free',s:x.s&&x.s.toMillis?x.s.toMillis():(x.p=='trial'?Date.now():0),e:x.e&&x.e.toMillis?x.e.toMillis():0,em:x.em||'',x:Array.isArray(x.x)?x.x:[],xe:x.xe&&x.xe.toMillis?x.xe.toMillis():0}};
export async function planGet(uid){if(uid&&uid!==uidOf()){const z=await pubGet(uid);return z&&z.p?plRead({exists:()=>true,data:()=>z}):null}return plRead(await TO(F.getDoc(F.doc(db,'bp_plan',uid||uidOf())),10000))}
// v1.84.17 privacy: bp_pub/{uid} = member-readable status only (plan/status/expiry). bp_plan + bp_pay (email, ref, slip QR, amount, bank) are owner+admin only.
const tm17=v=>v&&typeof v.toMillis=='function'?v.toMillis():v;let ST17=0;
export async function stSync(force){const u=uidOf();if(!force&&Date.now()-ST17<6e5)return 0;ST17=Date.now();const G=F.getDocFromServer||F.getDoc,g=c=>G(F.doc(db,c,u));
 const [a,b]=await Promise.all([g('bp_plan'),g('bp_pay')]);const p=a.exists()?a.data():null,y=b.exists()?b.data():null;if((p&&!p.s)||(y&&!y.s)){ST17=0;return 0}
 const d={p:p?p.p:'',s:p?p.s:null,e:p&&p.e||null,x:p&&p.x||[],xe:p&&p.xe||null,pl:y?y.pl:'',ps:y?y.st:'',py:y?y.s:null};
 try{const o=await F.getDoc(F.doc(db,'bp_pub',u));if(o.exists()){const z=o.data(),q={};for(const i in d)q[i]=z[i]===undefined?null:z[i];if(JSON.stringify(q,(k,v)=>tm17(v))==JSON.stringify(d,(k,v)=>tm17(v)))return 0}}catch(e){}
 await TO(F.setDoc(F.doc(db,'bp_pub',u),{...d,t:F.serverTimestamp()}),10000);return 1}
async function pubGet(uid){const d=await TO(F.getDoc(F.doc(db,'bp_pub',uid)),10000);return d.exists()?d.data():null}

export async function planEnsure(){const u=uidOf();let r=await planGet(u);if(r){stSync().catch(()=>{});return r}
 try{await TO(F.setDoc(F.doc(db,'bp_plan',u),{p:'trial',s:F.serverTimestamp(),em:String(user.email||'').slice(0,200),t:F.serverTimestamp()}),10000)}catch(e){}
 const r2=await planGet(u);stSync(true).catch(()=>{});return r2}

// ---- v1.76: self-serve PromptPay. bp_pay/{uid} = {pl, amt, at, ref, qr, bk, rq, ua, c, st:'pending', s, t}.
// Pending = provisional access for cfg.h hours (default 24) while bp_cfg/pay.on. bp_slips/{ref} is create-only, so one slip = one use, across all accounts.
const pyRead=d=>{if(!d.exists())return null;const x=d.data();return {pl:x.pl,amt:x.amt,pd:typeof x.pd=='number'?x.pd:x.amt,pd2:x.pd2|0,top:!!x.ref2,at:x.at,st:x.st,c:x.c||0,s:x.s&&x.s.toMillis?x.s.toMillis():Date.now()}};
// v1.81: top-up slip (one) for a short payment; sum decides pending/short/over (rules check the same)
export async function payTop(o){const u=uidOf();const ref0=F.doc(db,'bp_pay',u),cur=(await TO(F.getDoc(ref0),10000)).data()||{};
 if(o.img)await TO(F.setDoc(F.doc(db,'bp_pay',u,'slip','img2'),{d:o.img,t:F.serverTimestamp()}),20000);
 const pd2=Math.round(+o.pd||0),sum=(cur.pd||cur.amt||0)+pd2,st=sum==cur.amt?'pending':sum<cur.amt?'short':'over',ref=String(o.ref||''),b=F.writeBatch(db);
 b.set(F.doc(db,'bp_slips',ref),{u,t:F.serverTimestamp()});
 b.update(ref0,{ref2:ref,qr2:String(o.qr||'').slice(0,300),bk2:String(o.bk||'').slice(0,3),pd2,at2:String(o.at||'').slice(0,40),st,t:F.serverTimestamp()});
 await TO(b.commit(),15000);await stSync(true).catch(()=>{});return payGet(u)}
// v1.81: contact channels (admin-edited, public read)
export async function contactCfg(){await init();try{const d=await TO(F.getDoc(F.doc(db,'bp_cfg','contact')),10000);return d.exists()?d.data():null}catch(e){return null}}
// v1.81: support chat
export function chatSub(cb,err){const u=uidOf();return F.onSnapshot(F.query(F.collection(db,'bp_chat',u,'m'),F.orderBy('t','asc'),F.limitToLast(100)),q=>cb(q.docs.map(d=>{const x=d.data();return {id:d.id,f:x.f,x:x.x,h:!!x.h,t:x.t&&x.t.toMillis?x.t.toMillis():Date.now()}})),err)}
export function chatThreadSub(cb,err){const u=uidOf();return F.onSnapshot(F.doc(db,'bp_chat',u),d=>cb(d.exists()?d.data():null),err)}
export async function chatSend(x){const u=uidOf();x=String(x||'').trim().slice(0,1000);if(!x)return;const b=F.writeBatch(db);
 b.set(F.doc(F.collection(db,'bp_chat',u,'m')),{f:'u',x,t:F.serverTimestamp()});
 b.set(F.doc(db,'bp_chat',u),{em:String(user.email||'').slice(0,200),lm:x.slice(0,120),lt:F.serverTimestamp(),ur:true,ua:false,t:F.serverTimestamp()},{merge:true});await TO(b.commit(),15000)}
export async function chatSeen(){const u=uidOf();const r=F.doc(db,'bp_chat',u),d=await F.getDoc(r);if(!d.exists()||!d.data().ua)return;const x=d.data();
 await F.setDoc(r,{em:x.em||'',lm:x.lm||'',lt:x.lt,ur:!!x.ur,ua:false,hh:!!x.hh,t:F.serverTimestamp()},{merge:true})}
// v1.84.21 AI first reply (client-side; see rules bp_ai / bp_aiq)
export async function aiCfg(){await init();try{const d=await TO(F.getDoc(F.doc(db,'bp_ai','cfg')),8000);return d.exists()?d.data():null}catch(e){return null}}
export async function aiUsed(day){const u=uidOf();try{const d=await F.getDoc(F.doc(db,'bp_aiq',u));return d.exists()&&d.data().d==day?d.data().n:0}catch(e){return 0}}
export async function aiPost(x,h,day,n){const u=uidOf();x=String(x||'').trim().slice(0,1500);if(!x)return;const b=F.writeBatch(db);
 b.set(F.doc(F.collection(db,'bp_chat',u,'m')),{f:'b',x,h:!!h,t:F.serverTimestamp()});b.set(F.doc(db,'bp_aiq',u),{d:day,n,t:F.serverTimestamp()});
 b.set(F.doc(db,'bp_chat',u),{em:String(user.email||'').slice(0,200),lm:('🤖 '+x).slice(0,120),lt:F.serverTimestamp(),ur:!!h,ua:false,...(h?{hh:true,hq:F.serverTimestamp()}:{}),t:F.serverTimestamp()},{merge:true});
 if(h)b.set(F.doc(db,'bp_chq',u),{hq:F.serverTimestamp()});await TO(b.commit(),15000)}
export async function chatHand(){const u=uidOf();const b=F.writeBatch(db),x='👤 ขอคุยกับแอดมิน';b.set(F.doc(F.collection(db,'bp_chat',u,'m')),{f:'u',x,t:F.serverTimestamp()});
 b.set(F.doc(db,'bp_chat',u),{em:String(user.email||'').slice(0,200),lm:x,lt:F.serverTimestamp(),ur:true,ua:false,hh:true,t:F.serverTimestamp()},{merge:true});await TO(b.commit(),15000);await chatQueue()}
// v1.84.23 admin queue (FIFO): thread.hq = time the customer joined the queue; bp_chq/{uid} {hq} (no personal data) lets the app count its place
const ms23=v=>v&&v.toMillis?v.toMillis():0;
export async function chatQueue(){const u=uidOf();const r=F.doc(db,'bp_chat',u),d=await F.getDoc(r),x=d.exists()?d.data():{};
 if(x.hh&&x.hq&&!(ms23(x.hm)>ms23(x.hq)))return;const b=F.writeBatch(db);
 b.set(r,{em:String(user.email||'').slice(0,200),lm:String(x.lm||'👤 ขอคุยกับแอดมิน').slice(0,120),lt:x.lt||F.serverTimestamp(),ur:true,ua:false,hh:true,hq:F.serverTimestamp(),t:F.serverTimestamp()},{merge:true});
 b.set(F.doc(db,'bp_chq',u),{hq:F.serverTimestamp()});await TO(b.commit(),15000)}
export async function chatQPos(){const u=uidOf();try{const d=await F.getDoc(F.doc(db,'bp_chq',u));if(!d.exists())return 0;
 const c=await F.getCountFromServer(F.query(F.collection(db,'bp_chq'),F.where('hq','<=',d.data().hq)));return c.data().count||1}catch(e){return 0}}
export async function payGet(uid){if(uid&&uid!==uidOf()){const z=await pubGet(uid);return z&&z.ps?{pl:z.pl,amt:0,pd:0,pd2:0,top:false,at:'',st:z.ps,c:0,s:tm17(z.py)||0}:null}return pyRead(await TO(F.getDoc(F.doc(db,'bp_pay',uid||uidOf())),10000))}
export async function payCfg(){await init();try{const d=await TO(F.getDoc(F.doc(db,'bp_cfg','pay')),10000);return d.exists()?d.data():{on:false}}catch(e){return {on:false}}}
export async function payPut(o){const u=uidOf();const ref0=F.doc(db,'bp_pay',u),old=await TO(F.getDoc(ref0),10000);
 if(o.img)await TO(F.setDoc(F.doc(db,'bp_pay',u,'slip','img'),{d:o.img,t:F.serverTimestamp()}),20000);
 const ref=String(o.ref||''),b=F.writeBatch(db);
 b.set(F.doc(db,'bp_slips',ref),{u,t:F.serverTimestamp()});
 const pd=Math.round(+o.pd||0)||(o.amt|0),st=pd==(o.amt|0)?'pending':pd<(o.amt|0)?'short':'over';
 b.set(ref0,{pl:o.pl,amt:o.amt|0,pd,at:String(o.at||'').slice(0,40),ref,qr:String(o.qr||'').slice(0,300),bk:String(o.bk||'').slice(0,3),rq:Math.round(o.rq||0),ua:Math.round(+new Date(user.metadata&&user.metadata.creationTime)||0),c:(old.exists()?(old.data().c||0):0)+1,st,s:F.serverTimestamp(),t:F.serverTimestamp()});
 await TO(b.commit(),15000);await stSync(true).catch(()=>{});return payGet(u)}

// v1.81: opening the app clears an inactivity mark (account / bands I'm in) → automatic restore
export async function suspClear(bids){const u=uidOf();let me=false;try{const d=await F.getDoc(F.doc(db,'bp_susp','u_'+u));if(d.exists()&&d.data().k!='ok'){await F.deleteDoc(d.ref);me=true}}catch(e){}
 for(const b of bids||[])try{await F.deleteDoc(F.doc(db,'bp_susp','b_'+b))}catch(e){}return me}

// SetSod APK: native Google sign-in (never the web popup/redirect inside the app)
function nd(step,bad){try{window.__nd&&window.__nd(step,bad)}catch(e){}try{if(bad)_ev('native_auth_err',String(step).slice(0,280))}catch(e){}}
async function nGoogle(scopes){nd('เปิดตัวเลือกบัญชี Google'+(scopes?' (Drive)':''));let r;try{const o={skipNativeAuth:true,useCredentialManager:false};if(scopes)o.scopes=scopes;r=await Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle(o)}catch(e){const m='picker error: '+((e&&(e.message||e.code))||e);nd(m,1);throw Object.assign(new Error(m),{code:(e&&e.code)||'bp/native-google'})}
 const c=(r&&r.credential)||{};nd('picker returned: '+((r&&r.user&&r.user.email)||'?'));nd('idToken: '+(c.idToken?'yes':'NO'),!c.idToken&&!scopes);nd('accessToken: '+(c.accessToken?'yes':'no'),!c.accessToken&&!!scopes);return r}
async function nativeGoogle(){const r=await nGoogle();const c=r&&r.credential;if(!c||!c.idToken){const m='no idToken from native sign-in';throw Object.assign(new Error(m),{code:'bp/native-google'})}
 const cred=A.GoogleAuthProvider.credential(c.idToken,c.accessToken||null);
 try{let res;if(auth.currentUser&&auth.currentUser.isAnonymous){try{res=await A.linkWithCredential(auth.currentUser,cred);nd('linkWithCredential ok')}catch(e){if(!/credential-already-in-use|email-already-in-use/.test(e.code||''))throw e}}
  if(!res){res=await A.signInWithCredential(auth,cred);nd('signInWithCredential ok: '+(res.user&&res.user.email||''))}return res}
 catch(e){nd('signInWithCredential error: '+(e.code||'')+' '+(e.message||e),1);throw e}}

export async function fbAdd(o){
  await TO(init(),8000);
  const u=uidOf();
  const tx=String((o&&o.tx)||'').trim().slice(0,2000);
  if(!tx)throw Object.assign(new Error('empty'),{code:'bp/fb-empty'});
  const d={t:F.serverTimestamp(),uid:u,em:String((user&&user.email)||'').slice(0,200),tx,v:String((o&&o.v)||'').slice(0,20),dv:String((o&&o.dv)||'').slice(0,200),pl:String((o&&o.pl)||'').slice(0,40)};
  const r=o&&o.r|0;if(r>=1&&r<=5)d.r=r;
  const c=o&&o.c;if(c==='bug'||c==='idea'||c==='other')d.c=c;
  await TO(F.addDoc(F.collection(db,'bp_fb'),d),10000);return true;
}
