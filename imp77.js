/* v1.77 PREVIEW ONLY (not deployed): นำเข้า keeps only import actions; everything else moves to one ⚙️ ตั้งค่า page, grouped by importance */
(function(){const $=id=>document.getElementById(id);
const G=[['app','แอป'],['acc','บัญชี วง และแพ็กเกจ'],['look','การแสดงผลและเสียง'],['tools','เครื่องมือ'],['help','ช่วยเหลือและความเป็นส่วนตัว'],['sys','ระบบ (ขั้นสูง)']];
function tick(){const m=$('main');if(!m||!document.querySelector('.tab.on[data-v="F"]'))return;
 let st=$('st77');if(!st){st=document.createElement('div');st.id='st77';st.innerHTML='<button type="button" class="hw st77b" data-st77="back">‹ กลับไปนำเข้า</button><h2 class="st77t">ตั้งค่า</h2>'+G.map(([k,t])=>`<h3 class="g66h st77h" data-g="${k}">${t}</h3><div class="st77g" data-g="${k}"></div>`).join('');}
 if(!m.contains(st))m.appendChild(st);
 const g=k=>st.querySelector(`.st77g[data-g="${k}"]`);
 // app: update + version
 const sys=[...m.querySelectorAll(':scope>.sec')].find(e=>e.querySelector('#lgv'));
 const up=document.querySelector('#main .upd77s');if(up&&!g('app').contains(up)){const wr=document.createElement('div');wr.appendChild(up);g('app').appendChild(wr);const v=document.createElement('div');v.className='small st77v';v.textContent='เวอร์ชัน '+(document.querySelector('meta[name="bp-ver"]')||{}).content;wr.appendChild(v)}
 // account / band / plans / backup → the existing account panel (one link, no duplicate controls)
 if(!g('acc').children.length){const b=document.createElement('button');b.type='button';b.className='hw r68 r68c';b.innerHTML='<span class="ici">👤</span><span>บัญชี · วงของฉัน · แพ็กเกจ<br><span class="small">สำรอง/กู้คืนข้อมูล</span></span>';b.onclick=()=>window.__acp&&__acp.open();g('acc').appendChild(b)}
 const mv=(el,k)=>{if(el&&el.parentNode&&!g(k).contains(el))g(k).appendChild(el)};
 mv($('langb'),'look');mv($('literow'),'look');mv($('mosec'),'look');mv(m.querySelector(':scope>.set65e'),'look');mv($('pcmrow'),'look');
 const ai=[...m.querySelectorAll('button')].find(b=>/Stems/.test(b.textContent)&&!st.contains(b));if(ai){ai.classList.remove('r68','r68c');ai.classList.add('st77row');g('tools').appendChild(ai)}
 mv([...m.querySelectorAll(':scope>.sec')].find(e=>e.querySelector('[data-help]')),'help');mv(m.querySelector(':scope>.pv75f'),'help');
 mv(sys,'sys');
 m.querySelectorAll(':scope>.g66h').forEach(h=>{if(h.textContent.trim()!='เพลง')h.remove()});
 let go=$('st77go');if(!go){go=document.createElement('button');go.id='st77go';go.type='button';go.className='hw st77row';go.innerHTML='<span>⚙️</span><span>ตั้งค่า</span><span class="small">ภาษา · ธีม · อัปเดต · บัญชี · ช่วยเหลือ ›</span>';}
 if(go.nextElementSibling!==st)st.before(go);
 m.dataset.g66=m.childElementCount+'|'+(m.firstElementChild&&m.firstElementChild.className)}
document.addEventListener('click',e=>{const m=$('main');if(e.target.closest('#st77go')){m.classList.add('st77on');scrollTo(0,0)}else if(e.target.closest('[data-st77="back"]')){m.classList.remove('st77on');scrollTo(0,0)}else if(e.target.closest('.tab'))m&&m.classList.remove('st77on')},true);
const css=document.createElement('style');css.textContent=`
#st77{display:none;max-width:760px;margin:0 auto;padding:4px 0 120px}#main.st77on>*:not(#st77){display:none!important}#main.st77on>#st77{display:block}
.st77b{background:transparent;border:0;padding:8px 2px;min-height:40px;color:var(--mut,#9a9aa8);font-size:15px}
.st77t{font-size:26px;margin:2px 0 14px}
#st77 .st77h{font-size:13px;font-weight:600;letter-spacing:.02em;color:#9a9aa8;margin:22px 4px 8px;padding:0;border:0;text-transform:none}
#st77 .st77g{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:14px;overflow:hidden}
#st77 .st77g>*{margin:0!important;border-radius:0!important;border:0!important;border-top:1px solid rgba(255,255,255,.07)!important;background:transparent!important;box-shadow:none!important;width:100%!important;max-width:none!important}
#st77 .st77g>*:first-child{border-top:0!important}
#st77 .st77g>.sec{padding:12px 14px!important}#st77 .st77g>.sec>h2{font-size:16px;margin:0 0 8px}
#st77 .st77g button.hw,#st77 .st77row{min-height:50px;font-size:16px;text-align:left;justify-content:flex-start}
#st77 .st77row{display:flex;align-items:center;gap:12px;padding:12px 14px;width:100%;background:transparent;border:0;color:inherit}
#st77 .st77row .chev{margin-left:auto;opacity:.5}#st77 .st77row .ico{width:22px;text-align:center;flex:none}
#st77 .upd77s{display:flex;gap:8px;padding:12px 14px;margin:0;align-items:center;flex-wrap:wrap}#st77 .upd77s button{flex:1 1 160px;justify-content:center}
#st77 .st77v{padding:0 14px 12px;color:#9a9aa8;font-size:13px}
#st77 .pv75f{padding:14px;text-align:left}
#st77go{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;margin:16px 0;padding:12px 16px;font-size:16px;text-align:left}#st77go .small{margin-left:auto;opacity:.6}
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
setInterval(()=>{try{tick()}catch(e){console.warn('imp77',e)}},400);window.__imp77=tick})();
