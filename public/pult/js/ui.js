/* ---------- Правки інтерфейсу (27.09) ----------
   1) нотатки в задачі — як інші поля; 2) «+ Задача» і «📎 Файл» у шапці проєкту біля «Редагувати»;
   3) блоки проєкту згортаються; 4) перемикач «Коментарі / + події» не стрибає сторінкою;
   5) у відкритому проєкті група задач називається «Список задач»; 6) посилання «створити угоду в Moduler Pro»;
   7) фільтри, «змінити порядок» і «виконані» — в один рядок. */
document.head.insertAdjacentHTML("beforeend",`<style>
.tnote{white-space:pre-wrap;overflow-wrap:anywhere}
.ph-acts .filebtn{cursor:pointer}
.pc-h{cursor:pointer;user-select:none}
.pc-chev{display:inline-block;width:1em;color:var(--muted);transition:transform .15s;font-style:normal}
.pc-col .pc-chev{transform:rotate(-90deg)}
.pc-col>:not(.pc-h){display:none!important}
.pc-col{padding-bottom:10px!important}
.mplink{font-size:13px;color:var(--accent);white-space:nowrap}
@media (min-width:760px){
  #fPanel{flex-wrap:nowrap}
  #fPanel select{flex:1 1 0;min-width:0;width:auto}
  #fPanel #reoBtn,#fPanel label.row{flex:none;white-space:nowrap}
}
#fPanel #reoBtn{padding:4px 10px}
#fPanel label.row{font-size:13px!important}
</style>`);

/* 1) нотатки задачі: без сірого фону, окремим рядком як «Виконавець / Контролер» */
function fixTaskNote(){
  document.querySelectorAll("#board .edit > .full[style*='var(--sunk)']").forEach(n=>{
    const grid=n.previousElementSibling;
    if(!grid||!grid.style.gridTemplateColumns){n.style.background="transparent";n.style.padding="0";return}
    grid.insertAdjacentHTML("beforeend",`<span class="meta">Нотатки</span><span class="tnote">${n.innerHTML}</span>`);n.remove();
  });
}

/* 7) рядок фільтрів */
{const r=document.getElementById("reoBtn");if(r){r.textContent="↕ Порядок";r.title="Змінити порядок задач (перетягнути)"}
 {const s=document.getElementById("fSort");if(s)[...s.options].forEach(o=>{if(o.value==="due")o.textContent="⏱ За терміном"})}
 const l=document.getElementById("showDone")?.parentElement;if(l&&l.lastChild&&l.lastChild.nodeType===3)l.lastChild.textContent=" виконані";}

/* 3) згортання блоків проєкту — запамʼятовується в браузері */
let pcCol=(()=>{try{return new Set(JSON.parse(localStorage.getItem("pult_pcol")||"[]"))}catch(e){return new Set()}})();
const pcSave=()=>{try{localStorage.setItem("pult_pcol",JSON.stringify([...pcCol]))}catch(e){}};
const PC_BLOCKS=[["est","#projHead .est",":scope > .est-h"],["passport","#projHead .passport",":scope > h3"],["fin","#projHead .fin",":scope > .row:first-child"],["sales","#projHead .sales",":scope > h4"],["notes","#projHead .pnotes",":scope > .pnhead"]];
function mountCollapse(){
  for(const [k,sel,hs] of PC_BLOCKS){
    const b=document.querySelector(sel);if(!b)continue;
    const h=b.querySelector(hs);if(!h)continue;
    h.classList.add("pc-h");h.dataset.pc=k;
    const t=h.matches("h3,h4")?h:h.querySelector("h3,h4")||h;
    if(!t.querySelector(".pc-chev"))t.insertAdjacentHTML("afterbegin",`<i class="pc-chev" aria-hidden="true">▾</i>`);
    h.title="Згорнути / розгорнути";b.classList.toggle("pc-col",pcCol.has(k));
  }
}
window.addEventListener("click",e=>{
  const h=e.target.closest(".pc-h");if(!h||e.target.closest("button,select,input,label,a"))return;
  e.stopPropagation();e.preventDefault();const k=h.dataset.pc;
  pcCol.has(k)?pcCol.delete(k):pcCol.add(k);pcSave();h.parentElement.classList.toggle("pc-col",pcCol.has(k));
},true);

/* 4) «Коментарі / + події задач»: блок лишається на місці, видно поле вводу */
let pnKeep=null;
window.addEventListener("click",e=>{
  if(!e.target.closest("[data-pnmode]"))return;
  const b=document.querySelector("#projHead .pnotes");if(b)pnKeep={top:b.getBoundingClientRect().top,until:Date.now()+4000};
},true);
function keepNotes(){
  if(!pnKeep||Date.now()>pnKeep.until)return;
  const b=document.querySelector("#projHead .pnotes");if(!b)return;
  window.scrollBy(0,b.getBoundingClientRect().top-pnKeep.top);
  const l=document.getElementById("pn-list");if(l)l.scrollTop=l.scrollHeight;
  const i=document.getElementById("pn-in");if(i){const r=i.getBoundingClientRect();if(r.bottom>innerHeight)window.scrollBy(0,r.bottom-innerHeight+16)}
}

/* 2) шапка проєкту: «+ Задача» і «📎 Файл» поруч із «Редагувати»; 5) «Список задач» */
function projActs(){
  const box=document.getElementById("projHead");if(!box||box.hidden)return;
  const acts=box.querySelector(".ph-acts");if(!acts||acts.querySelector("[data-pfiles]"))return;
  const row=[...box.querySelectorAll(":scope > .row.full")].find(r=>r.querySelector("[data-addin],[data-pfiles]"));
  const p=projects.find(x=>x.name===fProject);
  const add=p&&p.status!=="done"?`<button class="btn primary sm" type="button" data-addin="${esc(p.name)}">+ Задача</button>`:"";
  acts.insertAdjacentHTML("afterbegin",`${add}<label class="btn sm filebtn" title="Додати файли до проєкту">📎 Файл<input type="file" multiple data-pfiles></label>`);
  if(row){row.querySelectorAll("[data-addin],label.filebtn").forEach(x=>x.remove());if(!row.children.length)row.remove()}
}
function taskListTitle(){
  if(!fProject||document.getElementById("projHead")?.hidden)return;
  const g=document.querySelector(`#board .group[data-gkey="${CSS.escape("p:"+fProject)}"] .group-head h2`);if(!g)return;
  const last=[...g.childNodes].reverse().find(n=>n.nodeType===3&&n.textContent.trim());
  if(last&&last.textContent.trim()===fProject)last.textContent="Список задач";
}

/* 6) угоди створюються в Moduler Pro — посилання біля вибору угоди, список оновлюється при поверненні */
const MP_URL="https://app.moduler.pro";
function mpLink(){
  const s=document.querySelector('#passport select[data-sale="deal"]');if(!s||s.nextElementSibling?.classList.contains("mplink"))return;
  s.insertAdjacentHTML("afterend",`<a class="mplink" href="/?s=crm" target="_top" title="Угоди (клієнт, будинок, ціна, оплати) ведуться в CRM. Створіть там — і вона зʼявиться в цьому списку">＋ угода в CRM ↗</a>`);
}
window.addEventListener("focus",async()=>{
  if(!document.querySelector('#passport select[data-sale="deal"]'))return;
  await loadMpDeals();const s=document.querySelector('#passport select[data-sale="deal"]');if(!s)return;const v=s.value;
  s.innerHTML=s.options[0].outerHTML+(mpDeals||[]).filter(d=>!d.linked).map(d=>`<option value="${d.id}">${esc(dealLabel(d))}${d.price?` · ${fmtCur(d.price,"UAH")}`:""}${Number(d.received)?` · отримано ${fmtCur(d.received,"UAH")}`:""}</option>`).join("");s.value=v;
});

const _renderUi=render;
render=function(){_renderUi.apply(this,arguments);fixTaskNote();taskListTitle()};
const _phUi=renderProjHead;
renderProjHead=function(){_phUi.apply(this,arguments);projActs();mountCollapse();mpLink();taskListTitle();keepNotes()};

/* ---------- 27.09 (2): чекпоінти в 1 клік, видалення задачі, чекпоінти в редагуванні, ідея → проєкт, стиль як у Moduler Pro ---------- */
document.head.insertAdjacentHTML("beforeend",`<style>
.ckrow .cktext{cursor:text;border-radius:4px;padding:0 2px;margin:0 -2px}
.ckrow .cktext:hover{background:var(--info-bg)}
.ckrow .ckpen{opacity:0;border:0;background:none;color:var(--muted);cursor:pointer;padding:0 4px;font-size:13px}
.ckrow:hover .ckpen,.ckrow .ckpen:focus{opacity:1}
@media (hover:none){.ckrow .ckpen{opacity:.6}}
.edit .ckedit-h{grid-column:1/-1}
</style>`);

/* чекпоінт: клік по тексту або ✎ — одразу редагування; Enter/клік поза полем — зберегти, Esc — скасувати */
function ckStartEdit(id){ckMenu=null;ckEdit=+id;render();const i=document.getElementById("ckin-"+id);if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}}
window.addEventListener("click",e=>{
  const pen=e.target.closest(".ckpen");
  const tx=!pen&&e.target.closest(".ckrow .cktext");
  if(!pen&&(!tx||e.target.closest("a")))return;
  const id=(pen||tx).closest(".ckrow")?.querySelector("[data-chk]")?.dataset.chk;if(!id)return;
  e.stopPropagation();e.preventDefault();ckStartEdit(id);
},true);
document.addEventListener("focusout",e=>{
  const i=e.target.closest?.("[data-ckinput]");if(!i)return;
  if(e.relatedTarget?.closest?.("[data-chksave],[data-chkcancel]"))return;
  const ok=i.parentElement.querySelector("[data-chksave]");if(ok)setTimeout(()=>{if(document.body.contains(ok))ok.click()},0);
});
document.addEventListener("keydown",e=>{const i=e.target.closest?.("[data-ckinput]");if(i&&e.key==="Escape"){e.preventDefault();i.parentElement.querySelector("[data-chkcancel]")?.click()}});
function ckPens(){document.querySelectorAll("#board .ckrow").forEach(r=>{if(r.querySelector(".ckpen")||!r.querySelector("[data-chk]"))return;
  r.querySelector(".cktext")?.insertAdjacentHTML("afterend",`<button type="button" class="ckpen" title="Редагувати чекпоінт" aria-label="Редагувати чекпоінт">✎</button>`)})}

/* відкрита задача: без рядка «Далі» (нижче весь список чекпоінтів) + кнопка 🗑 */
function openCardTweaks(){
  if(!openId)return;const c=document.querySelector(`#board .card[data-id="${CSS.escape(openId)}"]`);if(!c)return;
  c.querySelector(".card-head .next")?.remove();
  const acts=c.querySelector(".card-head .acts");
  if(acts&&!acts.querySelector("[data-act=del]"))acts.insertAdjacentHTML("beforeend",`<button type="button" class="icon-btn" data-act="del" title="Видалити задачу (натисніть двічі)" aria-label="Видалити задачу">🗑</button>`);
}

/* редагування задачі: чекпоінти видно й можна правити; незбережені поля не губляться */
const eDraft={};
document.addEventListener("input",e=>{const f=e.target.closest?.(".edit [id^='e-']");if(f&&editId)(eDraft[editId]??={})[f.id]=f.value});
document.addEventListener("change",e=>{const f=e.target.closest?.(".edit select[id^='e-']");if(f&&editId)(eDraft[editId]??={})[f.id]=f.value});
window.addEventListener("click",e=>{const a=e.target.closest("[data-act=save],[data-act=cancel]");if(a&&editId)setTimeout(()=>{delete eDraft[a.closest(".card")?.dataset.id]},0)},true);
function editChecks(){
  if(!editId)return;const c=document.querySelector(`#board .card[data-id="${CSS.escape(editId)}"] .edit`);if(!c||!c.querySelector("#e-title"))return;
  const t=tasks.find(x=>x.id===editId);if(!t)return;
  const d=eDraft[editId];if(d)for(const [id,v] of Object.entries(d)){const f=document.getElementById(id);if(f&&f.value!==v)f.value=v}
  if(!c.querySelector(".ckedit-h")){const row=c.querySelector(":scope > .row.full:last-child");
    (row||c.lastElementChild).insertAdjacentHTML("beforebegin",`<div class="ckedit-h">${checksBlock(t)}</div>`)}
}

/* ідея ↔ проєкт */
function ideaSwitch(){
  const box=document.getElementById("projHead");if(!box||box.hidden||!finAll())return;
  const p=projects.find(x=>x.name===fProject);if(!p||p.status==="done")return;const acts=box.querySelector(".ph-acts");if(!acts||acts.querySelector("[data-kind]"))return;
  box.querySelector("[data-toidea]")?.remove();
  const toIdea=!isIdea(p);
  acts.insertAdjacentHTML("afterbegin",`<button class="btn sm" type="button" data-kind="${toIdea?"idea":"project"}" title="${toIdea?"Додати паспорт ідеї й закриту фінмодель":"Ідея прийнята — перенести в звичайні проєкти. Паспорт, фінмодель і договори збережуться"}">${toIdea?"💡 В ідеї":"📁 Зробити проєктом"}</button>`);
}
window.addEventListener("click",async e=>{
  const b=e.target.closest("[data-kind]");if(!b||!fProject)return;e.stopPropagation();
  const p=projects.find(x=>x.name===fProject);if(!p)return;const kind=b.dataset.kind;b.disabled=true;
  const patch={kind};if(kind==="idea"&&!p.idea)patch.idea={decision:"collect"};
  const {error}=await sb.from("task_projects").update(patch).eq("name",p.name);
  if(error){b.disabled=false;toast("Не змінено: "+error.message);return}
  Object.assign(p,patch);delete FIN[p.name];
  await sb.from("project_notes").insert({project:p.name,author_id:me?.id||null,body:kind==="idea"?"💡 Проєкт переведено в ідеї":"📁 Ідею переведено в проєкти"});
  toast(kind==="idea"?"Проєкт тепер у блоці «Ідеї»":"Ідея стала проєктом — паспорт і фінмодель лишились на сторінці");renderProjHead();renderProjects();
  if(typeof loadPNotes==="function")loadPNotes(p.name);
},true);
/* проєкт, що був ідеєю: паспорт, фінмодель і договори лишаються видимими */
function exIdeaPassport(){
  const box=document.getElementById("projHead");if(!box||box.hidden||typeof phEdit!=="undefined"&&phEdit)return;
  const p=projects.find(x=>x.name===fProject);if(!p||isIdea(p)||!p.idea||box.querySelector(".passport"))return;
  const r=FIN[p.name];if(!r){loadFin(p.name).then(()=>{if(fProject===p.name)renderProjHead()});return}
  if(!r.my.can&&!(r.my.my_sales||[]).length)return;
  const html=passportHtml(p,r),notes=box.querySelector(":scope > .pnotes");
  notes?notes.insertAdjacentHTML("beforebegin",html):box.insertAdjacentHTML("beforeend",html);
  const h=box.querySelector(".passport > h3");if(h)h.firstChild&&(h.innerHTML=h.innerHTML.replace("💡 Паспорт ідеї","📊 Паспорт і фінмодель"));
}

/* стиль як у Moduler Pro (app.moduler.pro): палітра, системний шрифт, компактні кнопки */
document.head.insertAdjacentHTML("beforeend",`<style id="mpTheme">
:root{--bg:#f5f4f0;--surface:#fff;--sunk:#f1efe8;--ink:#1f1e1c;--muted:#6b6a63;--line:#e2e0d8;
  --accent:#185fa5;--accent-ink:#fff;--info-bg:#e6f1fb;
  --bad:#a32d2d;--bad-bg:#fcebeb;--warn:#854f0b;--warn-bg:#faeeda;--ok:#3b6d11;--ok-bg:#eaf3de;
  --display:-apple-system,"Segoe UI",Roboto,sans-serif;--body:-apple-system,"Segoe UI",Roboto,sans-serif;--mono:-apple-system,"Segoe UI",Roboto,sans-serif;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#f5f4f0;--surface:#fff;--sunk:#f1efe8;--ink:#1f1e1c;--muted:#6b6a63;--line:#e2e0d8;--accent:#185fa5;--accent-ink:#fff;--info-bg:#e6f1fb;
  --bad:#a32d2d;--bad-bg:#fcebeb;--warn:#854f0b;--warn-bg:#faeeda;--ok:#3b6d11;--ok-bg:#eaf3de;color-scheme:light}}
body{font-size:14px}
*{font-variant-numeric:tabular-nums}
h1{font:600 20px/1.2 var(--display);letter-spacing:0}
h2{font-weight:600}
.btn{font:500 13px var(--body);border-radius:6px;border-color:#cfccc0;padding:6px 12px}
.btn:hover{background:#f1efe8;border-color:#cfccc0}.btn.primary:hover{background:#124a82;border-color:#124a82}
.btn.sm{padding:3px 9px;font-size:12px}
input,select,textarea{border-color:#cfccc0;border-radius:6px;font-size:14px}
.seg{background:transparent;padding:0;gap:6px}
.seg button{border:1px solid #cfccc0;background:var(--surface);border-radius:6px;font:500 13px var(--body);padding:5px 12px;color:var(--muted)}
.seg button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:none}
.cursw{gap:0}.cursw button{border-radius:0;margin-left:-1px}.cursw button:first-child{border-radius:6px 0 0 6px}.cursw button:last-child{border-radius:0 6px 6px 0}
.stat,.card,.panel,.passport,.fin,.est,.sales,.pnotes,#projHead{border-radius:10px}
.stat .n{font-weight:600}
.tag,.pill,.verdict{border-radius:12px}
</style>`);

const _renderUi2=render;
render=function(){_renderUi2.apply(this,arguments);ckPens();openCardTweaks();editChecks();ckPens()};
const _phUi2=renderProjHead;
renderProjHead=function(){_phUi2.apply(this,arguments);exIdeaPassport();document.querySelectorAll("#projHead .passport > .meta").forEach(m=>{if(/^\s*Далі:/.test(m.textContent))m.remove()});ideaSwitch();mountCollapse();mpLink()};

/* ---------- 27.09 (3): проєкт — спершу назва, опис і задачі; редагування й видалення коментарів; зелена тема ---------- */
document.head.insertAdjacentHTML("beforeend",`<style id="greenTheme">
:root{--accent:#2f6b4f;--info-bg:#e6f0ea}
@media (prefers-color-scheme:dark){:root{--accent:#2f6b4f;--info-bg:#e6f0ea}}
.btn.primary:hover{background:#24553e;border-color:#24553e}
#projHead.ph-min > .est,#projHead.ph-min > .passport,#projHead.ph-min > .pnotes{display:none!important}
.phdet{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:13px;color:var(--muted)}
.phdet button{font:500 13px var(--body);border:1px dashed #cfccc0;background:var(--surface);color:var(--accent);border-radius:6px;padding:5px 12px;cursor:pointer}
.phdet button:hover{border-style:solid;border-color:var(--accent)}
.cmt,.pnote{position:relative}
.cacts{position:absolute;right:0;top:0;display:flex;gap:2px;opacity:.35}
.cmt:hover .cacts,.pnote:hover .cacts,.cacts:focus-within{opacity:1}
@media (hover:none){.cacts{opacity:.7}}
.cacts button{border:0;background:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0 5px;line-height:18px;border-radius:4px}
.cacts button:hover{background:var(--sunk);color:var(--ink)}
.cacts button.sure{color:var(--bad);opacity:1}
.cedit{display:flex;flex-direction:column;gap:6px;margin-top:4px}
.cedit textarea{min-height:60px}
.pnote .pndel{display:none}
</style>`);

/* 1) сторінка проєкту: за замовчуванням — назва, опис, файли й список задач; решта за кнопкою «Деталі» */
const phOpen=new Set();
function projCompact(){
  const box=document.getElementById("projHead");if(!box||box.hidden||!fProject||typeof phEdit!=="undefined"&&phEdit)return;
  const has=[...box.querySelectorAll(":scope > .est, :scope > .passport, :scope > .pnotes")];if(!has.length)return;
  const open=phOpen.has(fProject);box.classList.toggle("ph-min",!open);
  const n=(pnotes[fProject]||[]).length,p=projects.find(x=>x.name===fProject);
  const parts=[box.querySelector(":scope > .est")?"оцінка":null,box.querySelector(":scope > .passport")?(isIdea(p)?"паспорт ідеї, фінмодель, договори":"фінмодель, договори"):null,`коментарі${n?` (${n})`:""}`].filter(Boolean);
  let bar=box.querySelector(":scope > .phdet");
  if(!bar){bar=document.createElement("div");bar.className="full phdet";
    const anchor=box.querySelector(":scope > .est, :scope > .passport, :scope > .pnotes");anchor.before(bar)}
  bar.innerHTML=`<button type="button" data-phdet aria-expanded="${open}">${open?"▾ Згорнути деталі":"▸ Деталі"}</button>${open?"":`<span>${esc(parts.join(" · "))}</span>`}`;
}
window.addEventListener("click",e=>{
  const b=e.target.closest("[data-phdet]");if(!b||!fProject)return;e.stopPropagation();
  phOpen.has(fProject)?phOpen.delete(fProject):phOpen.add(fProject);projCompact();
},true);

/* 2) коментарі: ✎ редагувати, × видалити (автор або керівник) */
let cmtEdit=null,pnEdit=null;
const canEditC=a=>canManage()||(a&&a===me?.id);
const editedMark=x=>x.edited_at?` · <span title="${fmtDT(x.edited_at)}">змінено</span>`:"";
feedHtml=function(id){
  const h=history[id];
  if(h===undefined)return"<small class='meta'>Завантаження…</small>";
  if(!h.length)return"<small class='meta'>Коментарів ще немає. Напишіть перший звіт нижче.</small>";
  const KL={comment:"",report:" · звіт",note:" · уточнення",created:" · створено",status:" · зміна"};
  return h.map(u=>{const own=["comment","report","note"].includes(u.kind);const can=own&&canEditC(u.author_id);
    const body=cmtEdit===u.id?`<div class="cedit"><textarea id="ce-${u.id}">${esc(u.body||"")}</textarea><div class="row" style="gap:6px"><button class="btn primary sm" type="button" data-csave="${u.id}">Зберегти</button><button class="btn ghost sm" type="button" data-ccancel>Скасувати</button></div></div>`
      :(u.body?`<p>${mentionify(linkify(u.body))}</p>`:"");
    return `<div class="cmt ${own?"":"sys"}"><small>${fmtDT(u.created_at)} · ${esc(nameOf(u.author_id))}${KL[u.kind]??""}${editedMark(u)}</small>${can&&cmtEdit!==u.id?`<span class="cacts"><button type="button" data-cedit="${u.id}" title="Редагувати" aria-label="Редагувати коментар">✎</button><button type="button" data-cdel="${u.id}" title="Видалити" aria-label="Видалити коментар">×</button></span>`:""}${body}${attsHtml(u.attachments)}</div>`}).join("");
};
noteHtml=function(n){
  const can=canEditC(n.author_id);
  const body=pnEdit===n.id?`<div class="cedit"><textarea id="pe-${n.id}">${esc(n.body||"")}</textarea><div class="row" style="gap:6px"><button class="btn primary sm" type="button" data-pnsave="${n.id}">Зберегти</button><button class="btn ghost sm" type="button" data-pncancel>Скасувати</button></div></div>`
    :(n.body?`<p>${mentionify(linkify(n.body))}</p>`:"");
  return `<div class="pnote"><small>${fmtDT(n.created_at)} · ${esc(nameOf(n.author_id))}${n.source_chat_id?" · з Telegram":""}${editedMark(n)}</small>${can&&pnEdit!==n.id?`<span class="cacts"><button type="button" data-pnedit="${n.id}" title="Редагувати" aria-label="Редагувати коментар">✎</button><button type="button" data-pndel2="${n.id}" title="Видалити" aria-label="Видалити коментар">×</button></span>`:""}${body}${attsHtml(n.attachments)}</div>`;
};
const cmtTask=el=>el.closest(".card")?.dataset.id||openId;
function refreshFeed(id){const f=document.getElementById("feed-"+id);if(f){const st=f.scrollTop;f.innerHTML=feedHtml(id);f.scrollTop=st}}
function sure(b){if(b.classList.contains("sure"))return true;b.classList.add("sure");b.textContent="Видалити?";setTimeout(()=>{if(document.body.contains(b)){b.classList.remove("sure");b.textContent="×"}},4000);return false}
window.addEventListener("click",async e=>{
  const ce=e.target.closest("[data-cedit]");if(ce){e.stopPropagation();const id=cmtTask(ce);cmtEdit=+ce.dataset.cedit||ce.dataset.cedit;refreshFeed(id);const ta=document.getElementById("ce-"+ce.dataset.cedit);if(ta){autosize?.(ta);ta.focus()}return}
  if(e.target.closest("[data-ccancel]")){e.stopPropagation();const id=cmtTask(e.target);cmtEdit=null;refreshFeed(id);return}
  const cs=e.target.closest("[data-csave]");if(cs){e.stopPropagation();const id=cmtTask(cs),cid=cs.dataset.csave,body=document.getElementById("ce-"+cid).value.trim();
    if(!body){toast("Текст порожній — щоб прибрати коментар, натисніть ×");return}cs.disabled=true;
    const {error}=await sb.from("task_updates").update({body}).eq("id",cid);if(error){cs.disabled=false;toast("Не збережено: "+error.message);return}
    cmtEdit=null;toast("Коментар змінено");await loadHistory(id);return}
  const cd=e.target.closest("[data-cdel]");if(cd){e.stopPropagation();if(!sure(cd))return;const id=cmtTask(cd);
    const {error}=await sb.from("task_updates").delete().eq("id",cd.dataset.cdel);if(error){toast("Не видалено: "+error.message);return}
    toast("Коментар видалено");if(counts[id])counts[id]--;await loadHistory(id);return}
  const pe=e.target.closest("[data-pnedit]");if(pe){e.stopPropagation();pnEdit=+pe.dataset.pnedit||pe.dataset.pnedit;renderProjHead();const ta=document.getElementById("pe-"+pe.dataset.pnedit);if(ta)ta.focus();return}
  if(e.target.closest("[data-pncancel]")){e.stopPropagation();pnEdit=null;renderProjHead();return}
  const ps=e.target.closest("[data-pnsave]");if(ps){e.stopPropagation();const nid=ps.dataset.pnsave,body=document.getElementById("pe-"+nid).value.trim();
    if(!body){toast("Текст порожній — щоб прибрати коментар, натисніть ×");return}ps.disabled=true;
    const {error}=await sb.from("project_notes").update({body}).eq("id",nid);if(error){ps.disabled=false;toast("Не збережено: "+error.message);return}
    pnEdit=null;toast("Коментар змінено");await loadPNotes(fProject);return}
  const pd=e.target.closest("[data-pndel2]");if(pd){e.stopPropagation();if(!sure(pd))return;
    const {error}=await sb.from("project_notes").delete().eq("id",pd.dataset.pndel2);if(error){toast("Не видалено: "+error.message);return}
    toast("Коментар видалено");await loadPNotes(fProject);return}
},true);
document.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){const t=e.target.id||"";if(t.startsWith("ce-")){e.preventDefault();document.querySelector(`[data-csave="${t.slice(3)}"]`)?.click()}else if(t.startsWith("pe-")){e.preventDefault();document.querySelector(`[data-pnsave="${t.slice(3)}"]`)?.click()}}
  if(e.key==="Escape"){const t=e.target.id||"";if(t.startsWith("ce-"))document.querySelector("[data-ccancel]")?.click();else if(t.startsWith("pe-"))document.querySelector("[data-pncancel]")?.click()}
});

const _phUi3=renderProjHead;
renderProjHead=function(){_phUi3.apply(this,arguments);projCompact()};
