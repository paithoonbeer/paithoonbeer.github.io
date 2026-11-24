// SetSod Android shim (APK only): no SW, wakeLock -> KeepAwake plugin
(function(){var C=window.Capacitor;if(!C||!C.isNativePlatform||!C.isNativePlatform())return;window.__NATIVE=true;
try{delete Navigator.prototype.serviceWorker}catch(e){}
var KA=C.Plugins.KeepAwake;
function S(){this.released=false;this._l=[]}S.prototype.addEventListener=function(t,f){if(t=='release')this._l.push(f)};
S.prototype.release=function(){var s=this;if(s.released)return Promise.resolve();s.released=true;return KA.allowSleep().catch(function(){}).then(function(){s._l.forEach(function(f){try{f()}catch(e){}})})};
try{Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:function(){return KA.keepAwake().then(function(){return new S()})}}})}catch(e){}

// on-screen diagnostic box (app only)
window.__nd=function(step,bad){try{var L=JSON.parse(localStorage.getItem('bp-log')||'[]');L.push({t:new Date().toISOString(),lv:bad?'error':'info',msg:'native-auth: '+String(step).slice(0,400),v:'apk'});while(L.length>300)L.shift();localStorage.setItem('bp-log',JSON.stringify(L))}catch(e){}};
var GH=/(^|\.)(accounts\.google\.com|firebaseapp\.com|apis\.google\.com)$/;
var wo=window.open;window.open=function(u){try{var h=new URL(u,location.href).hostname;if(GH.test(h)){window.__nd('blocked web sign-in window: '+h,1);return null}}catch(e){}return wo.apply(window,arguments)};

// ===== in-app APK update (app only) =====
var AU={url:'https://paithoonbeer.github.io/dl/apk.json',urls:['https://paithoonbeer.github.io/dl/apk.json','https://setsod.web.app/dl/apk.json'],last:0,info:null,pend:null,busy:0};window.__au=AU;
function auP(){return C.Plugins.ApkUpdater}
function auPlaying(){var b=document.body;if(!b)return false;if(b.dataset.ps==='playing')return true;try{if(typeof playing!=='undefined'&&playing)return true}catch(e){}return false}
function auToast(m,ms){var old=document.getElementById('auToast');if(old)old.remove();var t=document.createElement('div');t.id='auToast';t.style.cssText='position:fixed;left:50%;top:calc(var(--op-safe-t, max(10px, env(safe-area-inset-top, 0px))) + 48px + 8px);transform:translateX(-50%);z-index:2147483646;background:#222;color:#fff;padding:10px 14px;border-radius:10px;font:15px sans-serif;max-width:90vw;box-shadow:0 4px 16px #0008';t.textContent=m;document.body.appendChild(t);setTimeout(function(){if(t.parentNode)t.remove()},ms||3000)}
function auEsc(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
async function auCheck(manual){if(AU.busy)return;AU.busy=1;try{AU.last=Date.now();var me=await auP().info();var j=null,er=null;for(var ui=0;ui<AU.urls.length&&!j;ui++){try{var r=await fetch(AU.urls[ui]+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('http '+r.status);var jj=await r.json();if(!jj||!(+jj.build>0))throw new Error('bad apk.json');j=jj;AU.url=AU.urls[ui]}catch(x){er=x}}if(!j)throw er||new Error('apk.json');AU.info={me:me,j:j};
  // v1.0.56: always surface a pending APK when build is newer (manual OR auto on open/resume)
  if(+j.build>+me.build){AU.pend=j;auShow(!!manual||!AU.snooze||Date.now()-AU.snooze>4*3600e3)}else if(manual)auToast('✅ แอปเป็นเวอร์ชันล่าสุดแล้ว ('+me.ver+' • build '+me.build+')',3000)}
 catch(e){if(manual)auToast('ตรวจหาอัปเดตแอปไม่ได้ — ลองใหม่เมื่อออนไลน์',3000)}finally{AU.busy=0}}
function auShow(force){var j=AU.pend;if(!j||document.getElementById('au8411'))return;if(!force&&AU.snooze&&Date.now()-AU.snooze<4*3600e3)return;if(!force&&auPlaying()){clearTimeout(AU.dt);AU.dt=setTimeout(function(){auShow(true)},15000);return}
 var d=document.createElement('div');d.id='au8411';d.style.cssText='position:fixed;left:10px;right:10px;bottom:12px;z-index:2147483645;background:#15171d;color:#fff;border:1px solid #3a3f4b;border-radius:14px;padding:14px;font:15px/1.45 sans-serif;box-shadow:0 8px 30px #000a';
 d.innerHTML='<div style="font-weight:700;font-size:17px">📲 มีแอปเวอร์ชันใหม่ '+auEsc(j.ver)+' — กดอัปเดต</div>'+(j.notes?'<div style="opacity:.85;margin:6px 0;white-space:pre-wrap;max-height:30vh;overflow:auto">'+auEsc(j.notes)+'</div>':'')+'<div id="au8411m" style="opacity:.8;font-size:13px;margin:4px 0"></div><div style="display:flex;gap:8px;margin-top:8px"><button id="au8411go" style="flex:1;padding:12px;border-radius:10px;border:0;background:#2e7d32;color:#fff;font-size:16px">อัปเดต</button><button id="au8411x" style="padding:12px 16px;border-radius:10px;border:0;background:#333;color:#fff;font-size:16px">ภายหลัง</button></div>';
 document.body.appendChild(d);document.getElementById('au8411x').onclick=function(){d.remove();AU.snooze=Date.now()};document.getElementById('au8411go').onclick=auGo}
async function auOpenUrl(url){try{var B=C.Plugins&&C.Plugins.Browser;if(B&&B.open){await B.open({url:url});return true}}catch(e){}
 try{window.open(url,'_blank');return true}catch(e){}return false}
async function auGo(){var j=AU.pend,m=document.getElementById('au8411m'),g=document.getElementById('au8411go');if(!j)return;
 try{var me=await auP().info();if(!me.canInstall){m.textContent='ครั้งแรก: Android จะเปิดหน้าตั้งค่า ให้เปิด “อนุญาตจากแหล่งที่มานี้” ให้ SetSod แล้วกลับมากด “อัปเดต” อีกครั้ง';g.textContent='เปิดการตั้งค่า';g.onclick=async function(){await auP().openInstallSettings();g.textContent='อัปเดต';g.onclick=auGo};return}
  g.disabled=true;g.textContent='กำลังดาวน์โหลด…';var iv=setInterval(async function(){try{var p=await auP().progress();if(p.total>0)m.textContent='ดาวน์โหลด '+Math.round(p.done*100/p.total)+'%'}catch(e){}},700);
  try{await auP().download({url:j.url});m.textContent='เปิดตัวติดตั้งแล้ว — กด “อัปเดต/ติดตั้ง” ในหน้าต่างของ Android'}
  catch(dlErr){
    // Common: missing release asset (404) or DownloadManager failing on GitHub redirects → open browser
    m.textContent='ดาวน์โหลดในแอปไม่สำเร็จ — กำลังเปิดเบราว์เซอร์ให้ติดตั้งเอง…';
    var opened=await auOpenUrl(j.url);
    if(!opened)m.textContent='❌ '+((dlErr&&dlErr.message)||dlErr)+' — เปิดลิงก์นี้ใน Chrome: '+j.url;
    else m.textContent='เปิดเบราว์เซอร์แล้ว — ดาวน์โหลด SetSod.apk แล้วกดติดตั้ง (อนุญาตแหล่งที่ไม่รู้จักถ้าถาม)';
  }finally{clearInterval(iv);g.disabled=false;g.textContent='อัปเดต'}}
 catch(e){m.textContent='❌ '+((e&&e.message)||e)+' — ลองใหม่ หรือดาวน์โหลดจาก '+j.url;
  try{var btn=document.createElement('button');btn.textContent='เปิดลิงก์ดาวน์โหลด';btn.style.cssText='margin-top:8px;padding:10px 12px;border:0;border-radius:8px;background:#2e7d32;color:#fff;font-size:14px';btn.onclick=function(){auOpenUrl(j.url)};m.appendChild(document.createElement('br'));m.appendChild(btn)}catch(x){}}}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-upd77]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();AU.pend=null;var o=document.getElementById('au8411');if(o)o.remove();auCheck(true)},true);
// v1.0.56: check on every open/resume (60s throttle) — old 30min gap meant users never saw updates
function auMaybe(){if(Date.now()-AU.last>60e3)auCheck(false)}
setTimeout(auMaybe,2500);document.addEventListener('visibilitychange',function(){if(!document.hidden)auMaybe()});
try{C.Plugins.App&&C.Plugins.App.addListener&&C.Plugins.App.addListener('resume',auMaybe)}catch(e){}
})();
