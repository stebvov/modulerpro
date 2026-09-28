/* ---------- Пульт: редагування на місці, перетягування, теги в тексті, ідеї-картки (28.09) ----------
   1) Відкрита задача: клік по назві, опису, виконавцю, контролеру, проєкту, терміну — одразу редагування;
      вийшли з поля — збережено. Розміри й розташування тексту не змінюються.
   2) Чекпоінт: клік — редагування в тому ж рядку (без поля вводу, без стрибків).
   3) ⋮⋮ — перетягнути задачу вгору/вниз у будь-якій групі (за людьми чи проєктами), без окремого режиму.
   4) #теги в назві й описі (як у монобанку) — клікабельні; самі теги пише база (тригер tasks_hashtags).
   5) Проєкти: ідеї — такими ж картками, як проєкти; «Картки/Список/Таблиця» й «Ідея | Проєкт» — обʼєднані кнопки. */
document.head.insertAdjacentHTML("beforeend",`<style id="editCss">
.ie{appearance:none;-webkit-appearance:none;border:1px solid transparent;background:transparent;font:inherit;color:inherit;padding:1px 4px;margin:-2px -5px;border-radius:5px;width:auto;max-width:100%;min-width:0;cursor:pointer}
.ie:hover{border-color:var(--line);background:var(--surface)}
.ie:focus{outline:none;border-color:var(--accent);background:var(--surface);cursor:text}
select.ie{padding-right:4px}
.ie-note{display:block;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45;cursor:text;min-height:1.45em;width:auto!important}
.wdc{display:inline-flex;align-items:center;gap:2px;font-size:13px;color:var(--muted);cursor:pointer}.wdc input{width:auto;min-height:0}
.ckmv{border:0;background:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 4px;margin-left:6px;vertical-align:middle}.ckmv:hover{color:var(--accent)}
.pop [data-ckmovestart]{display:none!important}
.ie-note:empty::before{content:attr(data-ph);color:var(--muted)}
.ttext{border-radius:4px}
.card-head[aria-expanded="true"] .ttext{cursor:text}
.card-head[aria-expanded="true"] .ttext:hover{box-shadow:inset 0 -1px 0 var(--line)}
.ttext[contenteditable],.cktext[contenteditable]{outline:none;box-shadow:inset 0 -2px 0 var(--accent);cursor:text}
.htag{display:inline;border:0;background:var(--info-bg);color:var(--accent);font:inherit;font-size:.92em;padding:0 5px;border-radius:5px;cursor:pointer}
.htag:hover{background:var(--accent);color:var(--accent-ink)}
.qdrag{display:inline-block;width:14px;margin:0 4px 0 -6px;color:var(--muted);cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;opacity:0;font-size:14px;letter-spacing:-2px;line-height:1}
.card:hover .qdrag,.qdrag:focus{opacity:.8}
@media (hover:none){.qdrag{opacity:.5}}
.card.qdragging{opacity:.8;box-shadow:0 8px 22px rgba(0,0,0,.18);position:relative;z-index:5}
.vseg{gap:0!important;padding:0!important;border:1px solid #cfccc0;border-radius:8px;overflow:hidden;background:var(--surface);flex-wrap:nowrap}
.vseg button{border:0!important;border-radius:0!important;margin:0!important;border-right:1px solid #cfccc0!important;box-shadow:none!important}
.vseg button:last-child{border-right:0!important}
.splitbtn{display:inline-flex;border-radius:8px;overflow:hidden;flex:none}
.splitbtn .btn{border-radius:0!important;margin:0!important}
.splitbtn .btn+.btn{border-left:1px solid rgba(255,255,255,.35)!important}
.pcard.idea{border-color:color-mix(in srgb,var(--warn) 30%,var(--line))}
.pcard .ibar{margin:2px 0}
</style>`);

/* ---------- повторення: редагується як інші поля ---------- */
function recurInline(t){
  const r=t.recur||"none";
  let h=`<select class="ie" data-ierecur="${t.id}" aria-label="Повторення">${opts(Object.entries(RECUR),r)}</select>`;
  if(r==="every_n"||r==="monthly")h+=`<span class="meta">кожні</span><input class="ie" type="number" min="1" max="365" data-ie="recur_every" data-tid="${t.id}" value="${t.recur_every||1}" style="width:56px" aria-label="Кожні N"><span class="meta">${r==="monthly"?"міс":"дн"}</span>`;
  if(r==="weekly")h+=WD.map((d,i)=>`<label class="wdc"><input type="checkbox" data-iewd="${t.id}" value="${i+1}"${(t.recur_weekdays||[]).includes(i+1)?" checked":""}>${d}</label>`).join("");
  return h;
}
document.addEventListener("change",async e=>{
  const r=e.target.closest("[data-ierecur]");
  if(r){const id=r.dataset.ierecur,t=tasks.find(x=>x.id===id);if(!t)return;const v=r.value;
    const patch={recur:v,recur_weekdays:v==="weekly"?(t.recur_weekdays?.length?t.recur_weekdays:[t.due?((new Date(t.due+"T12:00:00Z").getUTCDay()+6)%7)+1:1]):null};
    if(v!=="none"&&!t.due)patch.due=today();
    if(await saveTaskField(id,patch)){toast("Повторення: "+RECUR[v]);r.blur();render()}return}
  const w=e.target.closest("[data-iewd]");
  if(w){const id=w.dataset.iewd;const days=[...document.querySelectorAll(`[data-iewd="${id}"]:checked`)].map(x=>+x.value);
    if(!days.length){w.checked=true;toast("Потрібен хоча б один день");return}
    if(await saveTaskField(id,{recur_weekdays:days}))toast("Дні збережено")}
},true);

/* ---------- збереження поля задачі ---------- */
async function saveTaskField(id,patch){
  const t=tasks.find(x=>x.id===id);if(!t)return;
  const {data,error}=await sb.from("tasks").update(patch).eq("id",id).select("tags").maybeSingle();
  if(error){toast("Не збережено: "+error.message);return false}
  Object.assign(t,patch);if(data?.tags)t.tags=data.tags;
  return true;
}

/* ---------- відкрита задача: поля редагуються на місці ---------- */
const _editorOrig=editor;
editor=function(t){
  if(editId===t.id)return _editorOrig(t);
  const projOpts=projects.filter(p=>p.status!=="done"||p.name===t.project).map(p=>[p.name,p.name]);
  return `<div class="edit">
    <div class="full" style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:14px;align-items:center">
      <span class="meta">Виконавець</span><span><select class="ie" data-ie="owner_id" data-tid="${t.id}" aria-label="Виконавець">${peopleOpts(t.owner_id)}</select></span>
      <span class="meta">Контролер</span><span><select class="ie" data-ie="controller_id" data-tid="${t.id}" aria-label="Контролер"><option value="">— немає</option>${peopleOpts(t.controller_id)}</select></span>
      <span class="meta">Проєкт</span><span><select class="ie" data-ie="project" data-tid="${t.id}" aria-label="Проєкт">${opts(projOpts,t.project)}</select></span>
      <span class="meta">Термін</span><span style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input class="ie" type="date" data-ie="due" data-tid="${t.id}" value="${esc(t.due||"")}" aria-label="Термін"><input class="ie" type="time" data-ie="due_time" data-tid="${t.id}" value="${esc(hm(t.due_time))}" aria-label="Час"></span>
      <span class="meta">Повторення</span><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${recurInline(t)}</span>
      <span class="meta" style="align-self:start;padding-top:2px">Опис</span><div class="ie ie-note" contenteditable="plaintext-only" data-ienote="${t.id}" data-ph="додати опис, контекст, #теги…">${esc(t.note||"")}</div>
    </div>
    ${checksBlock(t)}
    ${feedBlock(t)}
  </div>`;
};
document.addEventListener("change",async e=>{
  const f=e.target.closest("[data-ie]");if(!f)return;
  const k=f.dataset.ie,id=f.dataset.tid;let v=f.value||null;if(k==="recur_every")v=Math.max(1,+v||1);
  if(k==="owner_id"&&!v)return;
  if(await saveTaskField(id,{[k]:v}))toast("Збережено");
},true);
/* опис: зберігаємо при виході з поля */
document.addEventListener("focusout",async e=>{
  const n=e.target.closest?.("[data-ienote]");if(!n)return;
  const id=n.dataset.ienote,t=tasks.find(x=>x.id===id);if(!t)return;
  const v=n.innerText.replace(/\s+$/,"");if(v===(t.note||""))return;
  if(await saveTaskField(id,{note:v||null})){toast("Опис збережено");afterEdit()}
});
document.addEventListener("keydown",e=>{
  const n=e.target.closest?.("[data-ienote]");
  if(n&&e.key==="Escape"){const t=tasks.find(x=>x.id===n.dataset.ienote);n.innerText=t?.note||"";n.blur()}
});

/* ---------- назва: клік у відкритій задачі — редагування в тому ж місці ---------- */
function wrapTitles(){
  document.querySelectorAll("#board .card .card-head .title").forEach(el=>{
    if(el.querySelector(".ttext"))return;
    const num=el.querySelector(".num");const nodes=[...el.childNodes].filter(n=>n!==num&&!(n.nodeType===1&&n.classList.contains("qdrag")));
    if(!nodes.length)return;const sp=document.createElement("span");sp.className="ttext";
    nodes.forEach(n=>sp.appendChild(n));el.appendChild(sp);
  });
}
function startEditable(el,onSave,single){
  if(el.isContentEditable)return;
  const orig=el.innerText;el.dataset.orig=orig;
  try{el.contentEditable="plaintext-only"}catch(_){el.contentEditable="true"}
  if(el.contentEditable!=="plaintext-only")el.contentEditable="true";
  el.innerText=orig;el.focus();
  const done=async save=>{
    el.removeEventListener("blur",onBlur);el.removeEventListener("keydown",onKey);
    const v=el.innerText.replace(/\n+/g,single?" ":"\n").trim();el.removeAttribute("contenteditable");
    if(save&&v&&v!==orig)await onSave(v);else el.innerText=orig;
    afterEdit();
  };
  const onBlur=()=>done(true);
  const onKey=ev=>{if(ev.key==="Enter"&&(single||ev.ctrlKey||ev.metaKey)){ev.preventDefault();el.blur()}if(ev.key==="Escape"){ev.preventDefault();el.innerText=orig;el.blur()}};
  el.addEventListener("blur",onBlur);el.addEventListener("keydown",onKey);
}
document.addEventListener("mousedown",e=>{
  const tt=e.target.closest(".ttext");if(!tt)return;
  const card=tt.closest(".card"),id=card?.dataset.id;if(!id||openId!==id||tt.isContentEditable)return;
  e.stopPropagation();
  startEditable(tt,async v=>{if(await saveTaskField(id,{title:v}))toast("Назву збережено")},true);
},true);
window.addEventListener("click",e=>{if(e.target.closest(".ttext[contenteditable],[data-qdrag],.htag"))e.stopPropagation()},true);

/* ---------- чекпоінт: редагування в тому ж рядку ---------- */
ckStartEdit=function(cid){
  const box=document.querySelector(`[data-chk="${CSS.escape(String(cid))}"]`)?.closest(".ckrow");const el=box?.querySelector(".cktext");if(!el)return;
  startEditable(el,async v=>{
    const {error}=await sb.from("task_checks").update({title:v}).eq("id",cid);
    if(error){toast("Не збережено: "+error.message);return}
    for(const l of Object.values(checks)){const c=l.find(x=>String(x.id)===String(cid));if(c)c.title=v}
    toast("Чекпоінт збережено");
  },true);
};

/* поки людина редагує — не перемальовуємо дошку (інакше зміни зникнуть) */
let renderPending=false;
const editing=()=>{const a=document.activeElement;return !!a&&!!a.closest?.("#board")&&(a.isContentEditable||a.classList?.contains("ie"))};
function afterEdit(){if(renderPending){renderPending=false;setTimeout(()=>{if(!editing())render()},0)}}
const _renderEdit=render;
render=function(){
  if(editing()){renderPending=true;return}
  _renderEdit.apply(this,arguments);
  try{wrapTitles();mountDrag();tagify(document.getElementById("board"))}catch(err){console.error("edit",err)}
};

/* ---------- #теги в тексті ---------- */
const TAG_RE=/(^|[\s(«"])#([^\s#.,;:!?()[\]{}"«»<>/\\]{2,40})/gu;
function tagify(root){
  if(!root)return;
  root.querySelectorAll(".ttext, .ie-note, .pcard p, .pnote p, .ph-desc, .tnote").forEach(el=>{
    if(el.isContentEditable||el.dataset.tagged===el.textContent)return;
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest("a,button,.htag")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
    const list=[];let n;while((n=walker.nextNode()))if(n.nodeValue.includes("#"))list.push(n);
    list.forEach(tn=>{
      const s=tn.nodeValue;if(!TAG_RE.test(s)){TAG_RE.lastIndex=0;return}TAG_RE.lastIndex=0;
      const frag=document.createDocumentFragment();let last=0,m;
      while((m=TAG_RE.exec(s))){const at=m.index+m[1].length;frag.append(s.slice(last,at));
        const b=document.createElement("button");b.type="button";b.className="htag";b.dataset.tagf=m[2].toLowerCase();b.title="Показати задачі з тегом #"+m[2];b.textContent="#"+m[2];frag.append(b);last=at+m[2].length+1}
      frag.append(s.slice(last));tn.replaceWith(frag);
    });
    el.dataset.tagged=el.textContent;
  });
}
/* контент-редагований опис показує теги як текст; після виходу з поля — знову кнопки */
document.addEventListener("focusin",e=>{const n=e.target.closest?.("[data-ienote]");if(n&&n.querySelector(".htag")){const t=tasks.find(x=>x.id===n.dataset.ienote);n.innerText=t?.note||""}});

/* ---------- ⋮⋮ перетягування задачі в будь-якій групі ---------- */
function mountDrag(){
  if(reorder||focusNum)return;
  document.querySelectorAll("#board .card[data-id] .card-head .title").forEach(el=>{
    if(el.querySelector("[data-qdrag]"))return;
    el.insertAdjacentHTML("afterbegin",`<span class="qdrag" data-qdrag tabindex="-1" title="Перетягніть, щоб змінити порядок" aria-hidden="true">⋮⋮</span>`);
  });
}
let qd=null;
document.addEventListener("pointerdown",e=>{
  const h=e.target.closest("[data-qdrag]");if(!h)return;const card=h.closest(".card");if(!card)return;
  e.preventDefault();e.stopPropagation();
  card.setAttribute("data-dragitem","");card.parentElement.querySelectorAll(":scope > .card").forEach(c=>c.setAttribute("data-dragitem",""));
  qd={card,box:card.parentElement,before:[...card.parentElement.children].indexOf(card)};
  drag={it:card,box:card.parentElement};card.classList.add("qdragging");
  try{h.setPointerCapture(e.pointerId)}catch(_){}
},true);
document.addEventListener("pointerup",async()=>{
  if(!qd)return;const {card,box,before}=qd;qd=null;drag=null;card.classList.remove("qdragging");
  const cards=[...box.children].filter(c=>c.classList.contains("card")&&c.dataset.id);
  if([...box.children].indexOf(card)===before){render();return}
  const upd=[];
  const setPos=(id,pos)=>{const t=tasks.find(x=>x.id===id);if(t&&t.pos!==pos){t.pos=pos;upd.push(sb.from("tasks").update({pos}).eq("id",id))}};
  if(sortMode!=="manual"){
    /* перше перетягування: фіксуємо порядок, який людина бачить зараз, у всіх групах */
    const all=[...document.querySelectorAll("#board .card[data-id]")];
    all.forEach((c,i)=>setPos(c.dataset.id,(i+1)*1000));
    setSort("manual");const fs=document.getElementById("fSort");if(fs)fs.value="manual";
  }else{
    const i=cards.indexOf(card),pv=cards[i-1],nx=cards[i+1];
    const P=id=>tasks.find(x=>x.id===id)?.pos;
    const a=pv?P(pv.dataset.id):null,b=nx?P(nx.dataset.id):null;
    let pos=a!=null&&b!=null?(a+b)/2:a!=null?a+1000:b!=null?b-1000:Date.now()/1000;
    if(a!=null&&b!=null&&Math.abs(b-a)<1e-6){cards.forEach((c,k)=>setPos(c.dataset.id,(k+1)*1000));pos=null}
    if(pos!=null)setPos(card.dataset.id,pos);
  }
  const r=await Promise.all(upd);const err=r.find(x=>x.error);
  if(err)toast("Порядок не збережено: "+err.error.message);else toast("Порядок збережено");
  render();
});

/* ---------- Проєкти та ідеї: ідеї — такими ж картками, обʼєднані кнопки ---------- */
function mountProjButtons(){
  const idea=document.getElementById("addIdeaBtn"),proj=document.getElementById("addProjBtn");
  if(!idea||!proj||idea.parentElement.classList.contains("splitbtn"))return;
  const wrap=document.createElement("span");wrap.className="splitbtn";wrap.setAttribute("role","group");wrap.setAttribute("aria-label","Створити");
  idea.parentElement.insertBefore(wrap,idea);wrap.append(idea,proj);
  idea.textContent="+ 💡 Ідея";proj.textContent="📁 Проєкт";proj.className="btn primary";idea.className="btn primary";
}
function decorateIdeaCards(ideas){
  ideas.forEach(p=>{
    const c=document.querySelector(`#projGrid .pcard[data-pcard="${CSS.escape(p.name)}"]`);if(!c||c.classList.contains("idea"))return;
    c.classList.add("idea");
    const b=c.querySelector("h2 .plink, h2 button");if(b&&!b.textContent.startsWith("💡"))b.textContent="💡 "+b.textContent;
    c.querySelector(".row .tag")?.remove();
    const lt=ideaTasks(p.name),dn=lt.filter(t=>t.status==="done").length;
    const nx=lt.filter(t=>t.status!=="done").sort((a,b)=>(a.due||"9").localeCompare(b.due||"9"))[0];
    c.querySelector("h2")?.closest(".row")?.insertAdjacentHTML("beforeend",verdictChip(p.idea?.decision));
    c.querySelector(".meta")?.insertAdjacentHTML("beforebegin",`<div class="ibar" title="Задачі перевірки ідеї"><span>Перевірка ${dn}/${lt.length}</span><i style="--p:${lt.length?Math.round(dn/lt.length*100):0}%"></i></div>${nx?`<span class="meta">Далі: ${esc(nx.title)} · ${esc(nameOf(nx.owner_id))}</span>`:""}`);
  });
}
const _rpEdit=renderProjects;
renderProjects=function(){
  mountProjButtons();
  const cards=typeof pView==="undefined"||pView==="cards";
  if(!cards)return _rpEdit.apply(this,arguments);
  /* старий модуль ідей ховає їхні картки — на час малювання показуємо ідеї як проєкти, потім додаємо позначки ідеї */
  const all=projects,pt=typeof pfType!=="undefined"?pfType:"all";
  const shown=all.filter(p=>pt==="all"||(pt==="idea")===(p.kind==="idea"));
  const ideas=shown.filter(p=>p.kind==="idea");
  projects=shown.map(p=>p.kind==="idea"?{...p,kind:"project"}:p);
  if(typeof pfType!=="undefined")pfType="all";
  try{_rpEdit.apply(this,arguments)}finally{projects=all;if(typeof pfType!=="undefined")pfType=pt}
  document.getElementById("ideaBox")?.remove();
  try{decorateIdeaCards(ideas);tagify(document.getElementById("projGrid"))}catch(err){console.error("edit",err)}
};

/* повна форма задачі: окреме поле тегів більше не потрібне — теги пишуться в тексті через # */
document.head.insertAdjacentHTML("beforeend",`<style>.edit label.f:has(#e-tags){display:none}</style>`);
/* після виходу з будь-якого поля — відкладене оновлення дошки */
document.addEventListener("focusout",()=>setTimeout(()=>{if(!editing())afterEdit()},0));
/* файл міг завантажитись після першого малювання пульту — перемальовуємо один раз */
try{mountProjButtons();if(typeof booted!=="undefined"&&booted){render();renderProjects()}}catch(err){console.error("edit",err)}

/* ---------- Згорнути / розгорнути всі групи задач (за людьми чи проєктами) ---------- */
function mountCollapseAll(){
  const bar=document.querySelector("#tabTasks .toolbar");if(!bar||bar.querySelector("[data-collall]"))return;
  bar.insertAdjacentHTML("beforeend",`<button type="button" class="btn sm" data-collall title="Згорнути або розгорнути всі групи">⇕ Згорнути всі</button>`);
}
function syncCollapseAll(){
  const b=document.querySelector("[data-collall]");if(!b)return;
  const keys=[...document.querySelectorAll("#board .group[data-gkey]")].map(g=>g.dataset.gkey);
  const allClosed=keys.length&&keys.every(k=>collapsed.has(k));
  b.textContent=allClosed?"⇕ Розгорнути всі":"⇕ Згорнути всі";b.dataset.state=allClosed?"closed":"open";
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-collall]");if(!b)return;e.stopPropagation();
  const keys=[...document.querySelectorAll("#board .group[data-gkey]")].map(g=>g.dataset.gkey);
  if(b.dataset.state==="closed")keys.forEach(k=>collapsed.delete(k));else keys.forEach(k=>collapsed.add(k));
  saveCollapsed();render();
},true);

/* ---------- Пошук з вбудованою квадратною кнопкою фільтрів (як у KeyCRM) ---------- */
const FILTER_SVG=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>`;
const SEARCH_SVG=`<svg class="sf-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
function mountSf(inputId,btnId,countId){
  const inp=document.getElementById(inputId);if(!inp||inp.parentElement.classList.contains("sf"))return;
  const btn=btnId&&document.getElementById(btnId);
  const wrap=document.createElement("span");wrap.className="sf";inp.parentElement.insertBefore(wrap,inp);
  wrap.insertAdjacentHTML("beforeend",SEARCH_SVG);wrap.appendChild(inp);
  if(!btn){inp.classList.add("nofilter");return}
  const cnt=(countId&&document.getElementById(countId))||btn.querySelector("span");
  btn.classList.add("sf-btn");btn.title="Фільтри";
  const badge=document.createElement("span");badge.className="sf-n";badge.hidden=true;
  [...btn.childNodes].forEach(n=>{if(n!==cnt)n.remove()});btn.insertAdjacentHTML("afterbegin",FILTER_SVG);btn.appendChild(badge);
  if(cnt){cnt.hidden=true;const sync=()=>{const n=(cnt.textContent.match(/\d+/)||[])[0];badge.textContent=n||"";badge.hidden=!n};sync();new MutationObserver(sync).observe(cnt,{childList:true,characterData:true,subtree:true})}
  wrap.appendChild(btn);
}
document.head.insertAdjacentHTML("beforeend",`<style id="unifiedCss">
/* єдиний стиль: прямокутники зі скругленням 8px, однакова висота; мітки — 6px */
:root{--r:8px;--r-sm:6px;--h:32px}
.btn,.seg button,.stat,.fchip,.stg,.bz-num,.verdict,.pill,.tag,.htag,.due,.stale,.m.rec,.subtab{border-radius:var(--r-sm)!important}
.btn,.seg button{border-radius:var(--r)!important;min-height:var(--h);display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn.sm{min-height:26px}
input,select,textarea{border-radius:var(--r)!important}
input:not([type=checkbox]):not([type=radio]):not([type=file]),select{min-height:var(--h)}
.sf{position:relative;display:flex;align-items:center;flex:1 1 260px;min-width:200px;max-width:560px}
.sf>.sf-ico{position:absolute;left:10px;color:var(--muted);pointer-events:none}
.sf>input{width:100%;padding-left:32px!important;padding-right:44px!important}
.sf>input.nofilter{padding-right:10px!important}
.sf .sf-btn{position:absolute!important;right:3px;top:3px;bottom:3px;width:32px!important;min-width:0!important;max-width:32px!important;height:auto!important;min-height:0!important;padding:0!important;margin:0!important;font-size:0!important;box-shadow:none!important;border:0!important;border-radius:var(--r-sm)!important;background:var(--sunk);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer}
.sf .sf-btn:hover{color:var(--accent);background:var(--info-bg)}
.sf .sf-btn.on,.sf .sf-btn[aria-expanded="true"]{background:var(--accent)!important;color:#fff!important}
.sf .sf-n[hidden]{display:none!important}
.sf .sf-n{font-size:10px!important;position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;border-radius:8px;background:var(--bad);color:#fff;font:700 10px/16px var(--body);text-align:center;padding:0 4px}
</style>`);
const _renderSf=render;
render=function(){_renderSf.apply(this,arguments);try{mountCollapseAll();syncCollapseAll()}catch(err){console.error("edit",err)}};
try{mountSf("q","fBtn","fCount");mountSf("projQ","pFBtn");mountSf("teamQ");mountSf("tgQ","tgFBtn");mountCollapseAll();syncCollapseAll()}catch(err){console.error("edit",err)}

/* ---------- ⇅ порядок чекпоінтів — іконкою в заголовку «Чекпоінти · N/M» ---------- */
function mountCkMove(){
  document.querySelectorAll("#board .card .edit h3").forEach(h=>{
    if(!/^Чекпоінти/.test(h.textContent)||h.querySelector(".ckmv"))return;
    const id=h.closest(".card")?.dataset.id;if(!id||(checks[id]||[]).length<2||ckMove===id)return;
    h.insertAdjacentHTML("beforeend",`<button type="button" class="ckmv" data-ckmovestart="${id}" title="Змінити порядок чекпоінтів" aria-label="Змінити порядок чекпоінтів">⇅</button>`);
  });
}
/* ---------- повернення туди, звідки відкрили задачу (Мій пульт / Капітал) ---------- */
let backTo=null;
document.addEventListener("click",e=>{const a=e.target.closest("#tabMy a.myt, #tabCap a.myt, #tabMy [href^='#t/'], #tabCap [href^='#t/']");if(a)backTo=a.closest("#tabCap")?"cap":"my"},true);
function relabelBack(){if(!backTo)return;document.querySelectorAll("#board [data-unfocus]").forEach(b=>{b.textContent=backTo==="cap"?"← Капітал":"← Мій пульт"})}
window.addEventListener("click",e=>{
  if(!backTo||!e.target.closest("[data-unfocus]"))return;e.stopPropagation();e.preventDefault();
  const go=backTo;backTo=null;window.history.pushState("","",location.pathname+location.search);applyHash();
  document.querySelector(`.seg [data-tab="${go}"]`)?.click();
},true);
const _renderCk=render;
render=function(){_renderCk.apply(this,arguments);try{mountCkMove();relabelBack()}catch(err){console.error("edit",err)}};
