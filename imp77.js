/* v1.0.53: นำเข้า = เพลงเท่านั้น; การตั้งค่าเป็นหน้าหมวดหมู่ (เมนูบัญชี + ในสตูดิโอ)
   Categories: แอป · บัญชี · การแสดงผล · ช่วยเหลือ · ระบบ */
(function(){const $=id=>document.getElementById(id);
const G=[
  ['app','แอป'],
  ['acc','บัญชีและวง'],
  ['look','การแสดงผลและเสียง'],
  ['help','ช่วยเหลือ'],
  ['sys','ระบบ (ขั้นสูง)']
];
function live(){return document.body.classList.contains('live')}
function fromMenu(){return !!window.__setFromMenu}
function tick(){const m=$('main');if(!m||!document.querySelector('.tab.on[data-v="F"]'))return;
 let st=$('st77');if(!st){st=document.createElement('div');st.id='st77';st.innerHTML=
  '<button type="button" class="hw st77b" data-st77="back">‹ กลับไปนำเข้า</button>'+
  '<h2 class="st77t">การตั้งค่า</h2>'+
  G.map(([k,t])=>`<h3 class="g66h st77h" data-g="${k}">${t}</h3><div class="st77g" data-g="${k}"></div>`).join('');}
 if(!m.contains(st))m.appendChild(st);
 const g=k=>st.querySelector(`.st77g[data-g="${k}"]`);
 // app: unhide (v1.0.58 — was buried under ระบบ) + update + version
 const sys=[...m.querySelectorAll(':scope>.sec')].find(e=>e.querySelector('#lgv'));
 if(!g('app').querySelector('[data-unhide149]')){
  const uh=document.createElement('button');uh.type='button';uh.className='hw r68 r68c';uh.dataset.unhide149='st';
  uh.innerHTML='<span class="ici">👁</span><span>กู้คืนเพลงที่ซ่อน<br><span class="small">เพลงตัวอย่างที่กด 🗑 ไว้ · กดเพื่อเอาคืน</span></span><span class="uhn nb" hidden>0</span>';
  g('app').appendChild(uh);
 }
 try{if(typeof window.__syncUnhide==='function')window.__syncUnhide()}catch(e){}
 const up=document.querySelector('#main .upd77s');
 if(up&&!g('app').contains(up)){
  const wr=document.createElement('div');wr.appendChild(up);g('app').appendChild(wr);
  const v=document.createElement('div');v.className='small st77v';
  v.textContent='เวอร์ชัน '+(document.querySelector('meta[name="bp-ver"]')||{}).content;
  wr.appendChild(v);
 }
 // keep buried sys copy as fallback; also move any leftover data-unhide149 from Import HTML into app
 try{const old=m.querySelector('[data-unhide149="1"]');if(old&&!g('app').contains(old)){old.remove()}}catch(e){}
 // account / band / backup
 if(!g('acc').querySelector('[data-st77="acc"]')){
  const b=document.createElement('button');b.type='button';b.className='hw r68 r68c';b.dataset.st77='acc';
  b.innerHTML='<span class="ici">👤</span><span>บัญชีและวงของฉัน<br><span class="small">เข้าสู่ระบบ · วง · สำรองข้อมูล</span></span>';
  b.onclick=function(){try{window.__acp&&__acp.open()}catch(e){}};
  g('acc').appendChild(b);
 }
 const mv=(el,k)=>{if(el&&el.parentNode&&!g(k).contains(el))g(k).appendChild(el)};
 mv($('langb'),'look');mv($('literow'),'look');mv($('mosec'),'look');
 mv(m.querySelector(':scope>.set65e'),'look');mv($('pcmrow'),'look');
 // help: feedback + chat + วิธีใช้
 if(!g('help').querySelector('[data-st77="fb"]')){
  const fb=document.createElement('button');fb.type='button';fb.className='hw r68 r68c';fb.dataset.st77='fb';
  fb.innerHTML='<span class="ici">💬</span><span>ส่งความเห็น<br><span class="small">บั๊ก · ไอเดีย · คะแนน</span></span>';
  fb.onclick=function(){try{window.__op18&&__op18.openFeedback&&__op18.openFeedback()}catch(e){}};
  g('help').appendChild(fb);
 }
 if(!g('help').querySelector('[data-st77="chat"]')){
  const ch=document.createElement('button');ch.type='button';ch.className='hw r68 r68c';ch.dataset.st77='chat';
  ch.innerHTML='<span class="ici">🤖</span><span>แชทกับน้องเซ็ต<br><span class="small">ถามวิธีใช้กับผู้ช่วย</span></span>';
  ch.onclick=function(){try{if(typeof ch81Open==='function')ch81Open();else toast('เปิดแชทไม่ได้',2000)}catch(e){toast('เปิดแชทไม่ได้',2000)}};
  g('help').appendChild(ch);
 }
 mv([...m.querySelectorAll(':scope>.sec')].find(e=>e.querySelector('[data-help]')),'help');
 mv(m.querySelector(':scope>.pv75f'),'help');
 mv(sys,'sys');
 m.querySelectorAll(':scope>.g66h').forEach(h=>{if(h.textContent.trim()!='เพลง')h.remove()});
 // Studio still offers a door into settings from Import; Live uses the avatar menu.
 // Park a single #st77go on #main even when hidden so Live ticks do not orphan-create buttons.
 let go=$('st77go')||tick._go;
 if(!go){
  go=document.createElement('button');go.id='st77go';go.type='button';go.className='hw st77row';
  go.innerHTML='<span>⚙️</span><span>การตั้งค่า</span><span class="small">ภาษา · ธีม · บัญชี · ช่วยเหลือ ›</span>';
 }
 tick._go=go;
 const showGo=!live()&&!fromMenu()&&!m.classList.contains('st77on');
 go.style.display=showGo?'':'none';
 if(showGo){if(go.nextElementSibling!==st)st.before(go)}
 else if(!go.parentNode){m.appendChild(go)}
 // back label depends on entry path
 const bk=st.querySelector('[data-st77="back"]');
 if(bk){
  if(fromMenu()||(live()&&m.classList.contains('st77on'))){
   bk.textContent='‹ ปิดการตั้งค่า';
  }else{
   bk.textContent='‹ กลับไปนำเข้า';
  }
 }
 m.dataset.g66=m.childElementCount+'|'+(m.firstElementChild&&m.firstElementChild.className)}
document.addEventListener('click',e=>{
 const m=$('main');if(!m)return;
 if(e.target.closest('#st77go')){m.classList.add('st77on');window.__setFromMenu=0;scrollTo(0,0);try{tick()}catch(_){}}
 else if(e.target.closest('[data-st77="back"]')){
  if(fromMenu()||(live()&&document.body.classList.contains('op-ov'))){
   try{document.body.classList.remove('op-ov');window.__setFromMenu=0;window.__fbFromSettings=0;
    const left=$('left'),main=$('main');if(main&&left&&main.parentNode!==left)left.appendChild(main);
    const box=$('op-ovb');if(box)box.innerHTML='';
    m.classList.remove('st77on');
    // Live: clear sticky view=F so tidy66 stops regrouping Import under Dual
    try{if(typeof view!=='undefined'&&view==='F'&&(live()||(window.__dual&&__dual.on))){view='P';document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('on',t.dataset.v==='P')})}}catch(_){}
   }catch(err){}
  }else{
   m.classList.remove('st77on');scrollTo(0,0);
  }
  try{tick()}catch(_){}
 }else if(e.target.closest('.tab')){m.classList.remove('st77on');window.__setFromMenu=0}
},true);
const css=document.createElement('style');css.textContent=`
#st77{display:none;max-width:760px;margin:0 auto;padding:4px 0 120px}
#main.st77on>*:not(#st77){display:none!important}
#main.st77on>#st77{display:block}
.st77b{background:transparent;border:0;padding:8px 2px;min-height:40px;color:var(--mut,#9a9aa8);font-size:15px}
.st77t{font-size:26px;margin:2px 0 14px}
#st77 .st77h{font-size:13px;font-weight:600;letter-spacing:.02em;color:#9a9aa8;margin:22px 4px 8px;padding:0;border:0;text-transform:none}
#st77 .st77g{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:14px;overflow:hidden}
#st77 .st77g>*{margin:0!important;border-radius:0!important;border:0!important;border-top:1px solid rgba(255,255,255,.07)!important;background:transparent!important;box-shadow:none!important;width:100%!important;max-width:none!important}
#st77 .st77g>*:first-child{border-top:0!important}
#st77 .st77g>.sec{padding:12px 14px!important}#st77 .st77g>.sec>h2{font-size:16px;margin:0 0 8px}
#st77 .st77g button.hw,#st77 .st77row{min-height:50px;font-size:16px;text-align:left;justify-content:flex-start}
#st77 [data-unhide149]{display:flex!important;align-items:center;gap:12px;padding:12px 14px!important}
#st77 [data-unhide149] .uhn{margin-left:auto;background:#ff453a;color:#fff;font-size:12px;font-weight:800;min-width:20px;height:20px;border-radius:10px;display:none;place-items:center}
#st77 [data-unhide149] .uhn.on{display:grid}
#st77 .st77row{display:flex;align-items:center;gap:12px;padding:12px 14px;width:100%;background:transparent;border:0;color:inherit}
#st77 .st77row .chev{margin-left:auto;opacity:.5}#st77 .st77row .ico{width:22px;text-align:center;flex:none}
#st77 .upd77s{display:flex;gap:8px;padding:12px 14px;margin:0;align-items:center;flex-wrap:wrap}#st77 .upd77s button{flex:1 1 160px;justify-content:center}
#st77 .st77v{padding:0 14px 12px;color:#9a9aa8;font-size:13px}
#st77 .pv75f{padding:14px;text-align:left}
#st77go{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;margin:16px 0;padding:12px 16px;font-size:16px;text-align:left}
#st77go .small{margin-left:auto;opacity:.6}
#st77{padding-left:12px;padding-right:12px}
#st77 .st77g button{text-align:left!important;justify-content:flex-start!important}
#st77 .st77g>.sec>button,#st77 .st77g>.sec>details>summary,#st77 .st77g>.sec>.hw,#st77 .st77g>button.set65e{background:transparent!important;border:0!important;box-shadow:none!important;padding-left:0!important;padding-right:0!important;width:100%}
#st77 .st77g>.sec:has(>button:only-child){padding-top:2px!important;padding-bottom:2px!important}
#st77 .st77g>button.set65e{padding:12px 14px!important}
#st77 .upd77s button{justify-content:center!important;text-align:center!important}
#main[data-v66="F"] #st77 .r68{justify-items:start!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;width:100%!important;margin:0!important;padding:8px 14px!important;text-align:left!important}
#main[data-v66="F"] #st77 .r68>.ici{justify-self:start}#main[data-v66="F"] #st77 .r68::after{justify-self:end}
#main[data-v66="F"] #st77 .st77g>.sec{padding:0!important}#main[data-v66="F"] #st77 .st77g>.sec.mosec{padding:12px 14px!important}
#main[data-v66="F"] #st77 .st77g>.sec .acc-b,#main[data-v66="F"] #st77 .st77g>.sec>:not(button){padding-left:14px;padding-right:14px}
#main[data-v66="F"] #st77 .st77g>.set65e.r68{width:100%!important;margin:0!important}
#main[data-v66="F"] #st77 .r68>*:not(.ici):not(.s66i){justify-self:start!important;text-align:left!important}
#main[data-v66="F"] #st77 .r68:not(:has(>.ici)){grid-template-columns:1fr 28px!important}
@media (min-width:1000px){#st77{padding-top:12px}}
@media (orientation:landscape) and (max-height:500px){.st77t{font-size:20px;margin:0 0 6px}#st77 .st77h{margin-top:14px}}
`;document.head.appendChild(css);
setInterval(()=>{try{tick()}catch(e){console.warn('imp77',e)}},400);
window.__imp77=tick;
})();
