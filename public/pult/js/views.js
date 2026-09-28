/* ---------- Єдині панелі фільтрів, вигляди проєктів, сторінка проєкту, оргструктура, доступ до фінмоделі (26.09) ----------
   Кожна вкладка: [перемикач/фільтр зліва] ··· [пошук 300px][Фільтри] — пошук завжди в тому самому місці й одного розміру. */
document.head.insertAdjacentHTML("beforeend",`<style>
.pagehead{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center}
.pagehead h2{flex:1 1 auto;margin:0;font-size:18px}
.tbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.tbar .tb-l{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-width:0}
.tbar .tb-r{display:flex;gap:8px;align-items:center;margin-left:auto;flex:none}
.tbar .tb-r input[type=search]{width:300px!important;max-width:none!important;min-width:0!important;flex:none!important;order:0!important}
.tbar .seg{align-self:center}
.tbar .fbtn{white-space:nowrap!important;flex:none;display:inline-flex!important;flex-direction:row!important;align-items:center;justify-content:center;gap:0!important;min-width:112px}
.tbar .fbtn span{display:inline!important;white-space:pre}
@media (max-width:640px){.tbar .tb-l{flex:1 1 100%}.tbar .tb-r{flex:1 1 100%;margin-left:0}.tbar .tb-r input[type=search]{flex:1 1 auto!important;width:auto!important}}
.vseg button{padding:6px 10px;font-size:13px}
.fpanel .seg{align-self:center}
/* список і таблиця проєктів */
.plist{display:flex;flex-direction:column;gap:6px}
.prow{display:grid;grid-template-columns:minmax(200px,2fr) 130px minmax(110px,auto) auto auto;gap:6px 14px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 14px;cursor:pointer}
.prow:hover,.ptable tbody tr:hover{border-color:var(--accent);background:color-mix(in srgb,var(--info-bg) 50%,var(--surface))}
.prow b{font:600 15px var(--body)} .prow .sub1{display:block;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prow.done{opacity:.55} .ptable tr.done{opacity:.55}
.prow .pr-n{font-size:13px;color:var(--muted);white-space:nowrap} .bad{color:var(--bad)}
.prow .pr-a{display:flex;gap:6px;align-items:center;justify-content:flex-end}
.ptable{background:var(--surface);border:1px solid var(--line);border-radius:12px}
.ptable table{min-width:860px;table-layout:fixed}
.ptable td{overflow:hidden}
.ptable th:nth-child(1){width:27%}.ptable th:nth-child(2){width:14%}.ptable th:nth-child(7){width:17%}.ptable th:nth-child(8){width:24%}
.ptable td.nx span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden} .ptable tbody tr{cursor:pointer}
.ptable td.n,.ptable th.n{text-align:right;font-variant-numeric:tabular-nums}
.ptable td .sub1{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ptable th button{background:none;border:0;padding:0;font:inherit;color:inherit;text-transform:inherit;letter-spacing:inherit;cursor:pointer}
.ptable th button[aria-sort]{color:var(--ink)}
.ptable td.nx{font-size:13px;color:var(--muted)}
@media (max-width:640px){.prow{grid-template-columns:1fr auto}.prow .ibar,.prow .pr-n{grid-column:1/-1}}
/* сторінка проєкту */
.ph-top{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.ph-top h2{margin:2px 0 6px!important}
.ph-meta{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;color:var(--muted);align-items:center}
.ph-acts{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ph-acts .icon-btn{line-height:28px;padding:0 9px;font-size:14px;text-decoration:none}
.ph-sec{margin:0;font:600 12px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.pnotes .pnhead{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.pnotes .seg button{font-size:12px;padding:4px 10px}
.pev{display:flex;flex-direction:column;gap:1px;font-size:13px;color:var(--muted);padding-left:10px;border-left:2px solid var(--line)}
.pev small{font-family:var(--mono);font-size:11px}
.pev a{color:var(--accent)}
body.pfocus #stats,body.pfocus #tabTasks .toolbar,body.pfocus #fPanel,body.pfocus #fChips,body.pfocus #rulesBox,body.pfocus #app>.seg{display:none!important}
/* оргструктура */
#orgBox{display:flex;flex-direction:column;gap:12px}
.on{display:flex;flex-direction:column;gap:10px}
.okids{display:flex;flex-direction:column;gap:10px;margin-left:16px;padding-left:16px;border-left:2px solid var(--line)}
.okids.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}
.ou{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.on>.ou{border-top:3px solid var(--accent)}
.okids .ou{border-top-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.ou-h{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:start}
.ou-h h3{margin:0;font:600 16px var(--body)}
.ou-h .meta{grid-row:2;grid-column:1/-1}
.ou-h .icon-btn{grid-row:1;grid-column:2}
.ou-res{display:flex;gap:8px;font-size:14px;background:var(--info-bg);border-radius:8px;padding:6px 10px}
.ou-res small{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.ou-met{font-size:13px;color:var(--muted)}
.ou-ppl{display:flex;flex-direction:column;gap:6px}
.ou-p{display:flex;gap:8px;align-items:center;font-size:14px}
.ou-p small{display:block;font-size:12px;color:var(--muted)}
.ou-p.head b::after{content:" ★";color:var(--warn);font-size:12px}
.ou-p.dim{opacity:.3}
.ou.edit{border-color:var(--accent)}
.ou-pick{display:flex;flex-direction:column;gap:2px;max-height:240px;overflow:auto;background:var(--sunk);border-radius:8px;padding:8px}
.ou-pick small{font-size:11px;color:var(--muted)}
@media (max-width:640px){.okids{margin-left:6px;padding-left:10px}}
/* доступ до фінмоделі */
.fchip.acc{display:inline-flex;gap:6px;align-items:center;cursor:default}
.fchip.acc:hover{background:var(--info-bg);color:var(--accent)}
.fchip.acc small{opacity:.7;font-size:11px}
.fchip.acc button{border:0;background:none;color:inherit;cursor:pointer;padding:0 2px;font-size:12px;line-height:1}
.fchip.acc button:hover{color:var(--bad)}
.who select{max-width:260px}
</style>`);

/* ---------- спільні помічники ---------- */
const lsGet=(k,d)=>{try{return localStorage.getItem(k)||d}catch(e){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
function el(html){const t=document.createElement("template");t.innerHTML=html.trim();return t.content.firstElementChild}
function mkBar(host,left,right){host.classList.add("tbar");const l=el(`<div class="tb-l"></div>`),r=el(`<div class="tb-r"></div>`);
  left.filter(Boolean).forEach(x=>l.append(x));right.filter(Boolean).forEach(x=>r.append(x));host.replaceChildren(l,r);return host}
const mkFBtn=(id,panel)=>el(`<button class="btn fbtn" type="button" id="${id}" data-fptoggle="${panel}" aria-expanded="false" aria-controls="${panel}">Фільтри<span></span></button>`);
function setFCount(btnId,n){const b=document.getElementById(btnId);if(!b)return;b.querySelector("span").textContent=n?" · "+n:"";b.classList.toggle("on",n>0)}
function chipsHtml(list,attr){return list.map(([k,l])=>`<button type="button" class="fchip" data-${attr}="${k}" title="Прибрати фільтр">${esc(l)} <span aria-hidden="true">✕</span></button>`).join("")+(list.length>1?`<button type="button" class="fchip clr" data-${attr}="all">Скинути все</button>`:"")}
document.addEventListener("click",e=>{const b=e.target.closest("[data-fptoggle]");if(!b)return;const p=document.getElementById(b.dataset.fptoggle);p.hidden=!p.hidden;b.setAttribute("aria-expanded",String(!p.hidden))});

/* ---------- Задачі ---------- */
{const tb=document.querySelector("#tabTasks .toolbar");mkBar(tb,[tb.querySelector(".seg")],[$("#q"),$("#fBtn")]);}

/* ---------- Проєкти: шапка, панель, вигляди ---------- */
let pView=lsGet("pultPView","cards"),pfOwner="",pfType="all",pSort={k:"",d:1};
{
  const tb=document.querySelector("#tabProjects .toolbar"),seg=tb.querySelector("[data-pflt]").closest(".seg");
  const head=el(`<div class="pagehead"><h2>Проєкти й ідеї</h2><div class="seg vseg" role="group" aria-label="Вигляд"><button type="button" data-pview="cards" title="Картки">▦ Картки</button><button type="button" data-pview="list" title="Список">☰ Список</button><button type="button" data-pview="table" title="Таблиця">⊞ Таблиця</button></div></div>`);
  head.append($("#addIdeaBtn"),$("#addProjBtn"));tb.before(head);
  mkBar(tb,[seg],[$("#projQ"),mkFBtn("pFBtn","pFPanel")]);
  tb.after(el(`<div class="fchips" id="pChips" hidden></div>`));
  tb.after(el(`<div class="fpanel" id="pFPanel" hidden><select id="pfOwner" aria-label="Відповідальний"></select><select id="pfType" aria-label="Тип"><option value="all">Проєкти й ідеї</option><option value="project">Лише проєкти</option><option value="idea">Лише ідеї</option></select></div>`));
}
const syncPView=()=>document.querySelectorAll("[data-pview]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.pview===pView));
syncPView();
function renderPChips(){
  const owners=[...new Set(projects.map(p=>p.owner_id).filter(Boolean))];
  $("#pfOwner").innerHTML=`<option value="">Усі відповідальні</option>`+owners.map(id=>`<option value="${id}"${id===pfOwner?" selected":""}>${esc(nameOf(id))}</option>`).join("");
  $("#pfType").value=pfType;
  const c=[];if(pfOwner)c.push(["owner","👤 "+nameOf(pfOwner)]);if(pfType!=="all")c.push(["type",pfType==="idea"?"💡 лише ідеї":"📁 лише проєкти"]);
  $("#pChips").hidden=!c.length;$("#pChips").innerHTML=chipsHtml(c,"pclr");setFCount("pFBtn",c.length);
}
document.addEventListener("change",e=>{
  if(e.target.id==="pfOwner"){pfOwner=e.target.value;renderProjects()}
  if(e.target.id==="pfType"){pfType=e.target.value;renderProjects()}
});
document.addEventListener("click",e=>{
  const pv=e.target.closest("[data-pview]");if(pv){pView=pv.dataset.pview;lsSet("pultPView",pView);syncPView();renderProjects();return}
  const pc=e.target.closest("[data-pclr]");if(pc){const k=pc.dataset.pclr;if(k==="owner"||k==="all")pfOwner="";if(k==="type"||k==="all")pfType="all";renderProjects();return}
  const ps=e.target.closest("[data-psort]");if(ps){const k=ps.dataset.psort;pSort=pSort.k===k?{k,d:-pSort.d}:{k,d:1};renderProjects();return}
});
document.addEventListener("keydown",e=>{const r=e.target.closest?.(".prow,.ptable tbody tr");if(r&&(e.key==="Enter"||e.key===" ")){e.preventDefault();r.click()}});

function projInfo(p){
  const pt=tasks.filter(t=>t.project===p.name),open=pt.filter(t=>t.status!=="done"),bad=open.filter(t=>dueState(t)==="overdue").length;
  const src=isIdea(p)?ideaTasks(p.name).filter(t=>t.status!=="done"):open;
  const nx=src.slice().sort((a,b)=>(a.due||"9").localeCompare(b.due||"9"))[0];
  return {pt,open:open.length,bad,done:pt.length-open.length,nx};
}
function stateChip(p){
  if(isIdea(p))return `${p.idea?.launched_at?`<span class="verdict go" title="Продаж запущено">🚀</span> `:""}${verdictChip(p.idea?.decision)}`;
  return `<span class="tag">${PSTATUS[p.status]||p.status}</span>`;
}
const _rpV=renderProjects;
renderProjects=function(){
  const flt=p=>(!pfOwner||p.owner_id===pfOwner)&&(pfType==="all"||(pfType==="idea")===isIdea(p));
  renderPChips();
  if(pView==="cards"){
    const all=projects;projects=all.filter(flt);
    try{_rpV()}finally{projects=all}
    $("#projGrid").className="pgrid";return;
  }
  document.getElementById("ideaBox")?.remove();
  const openBy=n=>tasks.filter(t=>t.project===n&&t.status!=="done").length;
  const PF={withTasks:p=>p.status!=="done"&&openBy(p.name)>0,active:p=>p.status!=="done",done:p=>p.status==="done",all:()=>true};
  const base=projects.filter(flt);
  document.querySelectorAll("[data-pflt]").forEach(b=>{b.textContent=b.textContent.replace(/ \d+$/,"")+" "+base.filter(PF[b.dataset.pflt]).length});
  const pq=projQ.trim().toLowerCase();
  let list=base.filter(PF[projF]).filter(p=>!pq||[p.name,p.description,p.owner_id?nameOf(p.owner_id):""].join(" ").toLowerCase().includes(pq)).map(p=>({p,i:projInfo(p)}));
  const g=$("#projGrid");g.className="";
  let inc="";
  if(typeof finAll==="function"&&finAll()&&Array.isArray(salesAll)&&salesAll.length){
    const e=salesAll.reduce((a,x)=>a+(Number(x.founder_fee)||0),0);
    inc=`<div class="income" style="width:fit-content;margin-bottom:10px">🔒 ${me?.is_owner?"Мій дохід з ідей":"Комісія засновника"}: <b>${money(e)}</b></div>`}
  if(!list.length){g.innerHTML=inc+`<div class="empty">Немає проєктів за цим фільтром.</div>`;return}
  if(pView==="list"){
    g.innerHTML=inc+`<div class="plist">${list.map(({p,i})=>{const n=esc(p.name),tot=i.open+i.done;
      return `<div class="prow ${p.status}" data-ptasks="${n}" role="button" tabindex="0" title="Відкрити проєкт: опис, коментарі, задачі">
        <div style="min-width:0"><b>${isIdea(p)?"💡 ":""}${n}</b><span class="sub1">${esc(p.owner_id?nameOf(p.owner_id):"відповідального не призначено")}${i.nx?` · Далі: ${esc(i.nx.title)}`:""}</span></div>
        <div class="ibar" title="Виконано задач"><span>${i.done}/${tot}</span><i style="--p:${tot?Math.round(i.done/tot*100):0}%"></i></div>
        <span class="pr-n">${i.open} відкр.${i.bad?` · <b class="bad">${i.bad} простр.</b>`:""}${pnCount[p.name]?` · 📝 ${pnCount[p.name]}`:""}</span>
        <span>${stateChip(p)}</span>
        <span class="pr-a">${p.status==="done"?"":`<button class="icon-btn" type="button" data-addin="${n}" title="Нова задача в проєкті" aria-label="Нова задача">＋</button>`}</span>
      </div>`}).join("")}</div>`;
    return;
  }
  const key={name:x=>x.p.name.toLowerCase(),owner:x=>x.p.owner_id?nameOf(x.p.owner_id):"я",open:x=>x.i.open,bad:x=>x.i.bad,done:x=>x.i.done,notes:x=>pnCount[x.p.name]||0,state:x=>isIdea(x.p)?"я"+(x.p.idea?.decision||""):x.p.status,next:x=>x.i.nx?.due||"9"};
  if(pSort.k)list.sort((a,b)=>{const A=key[pSort.k](a),B=key[pSort.k](b);return (A>B?1:A<B?-1:0)*pSort.d});
  const th=(k,l,cls="")=>`<th class="${cls}"><button type="button" data-psort="${k}"${pSort.k===k?` aria-sort="${pSort.d>0?"ascending":"descending"}"`:""}>${l}${pSort.k===k?(pSort.d>0?" ▲":" ▼"):""}</button></th>`;
  g.innerHTML=inc+`<div class="tbl ptable"><table><thead><tr>${th("name","Проєкт")}${th("owner","Відповідальний")}${th("open","Відкр.","n")}${th("bad","Простр.","n")}${th("done","Вик.","n")}${th("notes","📝","n")}${th("state","Стан")}${th("next","Далі")}</tr></thead><tbody>
    ${list.map(({p,i})=>`<tr class="${p.status}" data-ptasks="${esc(p.name)}" tabindex="0" title="Відкрити проєкт"><td><b>${isIdea(p)?"💡 ":""}${esc(p.name)}</b>${p.description?`<span class="sub1">${esc(p.description.split("\n")[0])}</span>`:""}</td><td>${esc(p.owner_id?nameOf(p.owner_id):"—")}</td><td class="n">${i.open}</td><td class="n ${i.bad?"bad":""}">${i.bad||""}</td><td class="n">${i.done}</td><td class="n">${pnCount[p.name]||""}</td><td>${stateChip(p)}</td><td class="nx">${i.nx?`<span>${i.nx.due?`<b>${fmt(i.nx.due)}</b> · `:""}${esc(i.nx.title)}</span>`:""}</td></tr>`).join("")}
  </tbody></table></div>`;
};

/* ---------- Задачі, групування «Проєкти»: кнопка «Деталі» ---------- */
const _renderV=render;
render=function(){
  _renderV();
  if(reorder||view!=="project"||fProject)return;
  document.querySelectorAll("#board .group-head").forEach(h=>{
    const n=h.querySelector("[data-addin]")?.dataset.addin||h.querySelector("h2")?.textContent.trim();
    if(!n||!projects.some(p=>p.name===n)||h.querySelector("[data-pdet]"))return;
    h.querySelector(".row:last-child")?.insertAdjacentHTML("afterbegin",`<button class="btn ghost sm" type="button" data-ptasks="${esc(n)}" data-pdet title="Опис, коментарі, файли й історія проєкту">📂 Деталі</button>`);
  });
};

/* ---------- Сторінка проєкту: шапка як у задачі, коментарі та історія, окреме вікно #p/Назва ---------- */
let pfocus=false,pnMode="notes",phist={};
const projUrl=n=>location.origin+location.pathname+"#p/"+encodeURIComponent(n);
const _phV=renderProjHead;
renderProjHead=function(){
  _phV();
  const box=$("#projHead"),p=fProject&&!focusNum&&projects.find(x=>x.name===fProject);
  if(!p||phEdit||box.hidden)return;
  const top=box.firstElementChild;if(!top||!top.querySelector("[data-phclose]"))return;
  const i=projInfo(p);
  top.outerHTML=`<div class="full ph-top"><div style="min-width:0"><span class="meta">📁 Проєкт${isIdea(p)?" · 💡 ідея":""}</span><h2>${esc(p.name)}</h2>
    <div class="ph-meta"><span class="tag">${PSTATUS[p.status]||p.status}</span><span>👤 ${esc(p.owner_id?nameOf(p.owner_id):"відповідального не призначено")}</span><span>${i.open} відкр.</span>${i.bad?`<b class="bad">${i.bad} простр.</b>`:""}<span>${i.done} вик.</span></div></div>
    <div class="ph-acts"><button class="btn sm" type="button" data-phedit>✎ Редагувати</button><button class="icon-btn" type="button" data-pcopy title="Скопіювати посилання на проєкт" aria-label="Скопіювати посилання">🔗</button>${pfocus?"":`<a class="icon-btn" href="#p/${encodeURIComponent(p.name)}" target="_blank" rel="noopener" title="Відкрити в окремому вікні" aria-label="Відкрити в окремому вікні">⧉</a>`}<button class="icon-btn" type="button" data-phclose title="${pfocus?"До пульта":"Закрити проєкт і показати всі задачі"}" aria-label="Закрити">✕</button></div></div>`;
  box.querySelector(":scope > .full.meta")?.remove();
  box.querySelector(":scope > .row.full [data-phedit]")?.remove();
  const d=box.querySelector(":scope > .ph-top + .full");if(d&&d.style.whiteSpace==="pre-wrap")d.insertAdjacentHTML("beforebegin",`<h3 class="full ph-sec">Опис і мета</h3>`);
};
async function loadPHist(name){
  const ids=tasks.filter(t=>t.project===name).map(t=>t.id);
  if(!ids.length){phist[name]=[];return}
  const {data}=await sb.from("task_updates").select("task_id,author_id,kind,body,created_at").in("task_id",ids).in("kind",["created","status"]).order("created_at",{ascending:true}).limit(500);
  phist[name]=data||[];
}
function noteHtml(n){return `<div class="pnote"><small>${fmtDT(n.created_at)} · ${esc(nameOf(n.author_id))}${n.source_chat_id?" · з Telegram":""}</small>${(canManage()||n.author_id===me?.id)?`<button type="button" class="icon-btn pndel" data-pndel="${n.id}" title="Видалити" aria-label="Видалити коментар">×</button>`:""}${n.body?`<p>${mentionify(linkify(n.body))}</p>`:""}${attsHtml(n.attachments)}</div>`}
function evHtml(h){const t=tasks.find(x=>x.id===h.task_id);if(!t)return "";
  const txt=h.kind==="created"?"задачу створено":h.body;
  return `<div class="pev"><small>${fmtDT(h.created_at)} · ${esc(h.author_id?nameOf(h.author_id):"система")}</small><span>${h.kind==="created"?"＋":/Виконано/.test(h.body||"")?"✅":"🔄"} <a href="#t/${t.num}" target="_blank" rel="noopener">#${t.num}</a> ${esc(t.title.slice(0,90))} — ${esc(txt||"")}</span></div>`}
pnotesHtml=function(name){
  const l=pnotes[name];let items=(l||[]).map(n=>({t:n.created_at,h:noteHtml(n)}));
  if(pnMode==="all"){
    if(phist[name]===undefined){phist[name]=null;loadPHist(name).then(()=>{if(fProject===name&&!phEdit)renderProjHead()})}
    items=items.concat((phist[name]||[]).map(h=>({t:h.created_at,h:evHtml(h)}))).sort((a,b)=>String(a.t).localeCompare(String(b.t)));
  }
  const list=l===undefined?`<small class="meta">Завантаження…</small>`:!items.length?`<small class="meta">Коментарів ще немає. Напишіть рішення, домовленість чи контакт — або надішліть з Telegram кнопкою «📝 В проєкт» чи командою /note.</small>`:items.map(x=>x.h).join("");
  return `<div class="full pnotes"><div class="pnhead"><h3>💬 Коментарі та історія${l&&l.length?` · ${l.length}`:""}</h3><div class="seg" role="group" aria-label="Що показувати"><button type="button" data-pnmode="notes" aria-pressed="${pnMode==="notes"}">Коментарі</button><button type="button" data-pnmode="all" aria-pressed="${pnMode==="all"}">+ події задач</button></div></div>
    <div id="pn-list" style="display:flex;flex-direction:column;gap:10px;max-height:420px;overflow:auto">${list}</div>
    <div class="pend" id="pn-pend">${pnPend.map((f,i)=>`<span>📎 ${esc(f.name)} <button class="btn ghost sm" type="button" data-pnunpend="${i}" aria-label="Прибрати" style="padding:0 4px">×</button></span>`).join("")}</div>
    <div class="cbox"><textarea id="pn-in" rows="1" placeholder="Коментар до проєкту: рішення, домовленість, контакт, посилання (Ctrl+Enter — надіслати)"></textarea><label class="btn filebtn" title="Додати файли або фото">📎<input type="file" multiple data-pnfiles></label><button class="btn primary" type="button" data-pnadd>Надіслати</button></div></div>`;
};
function applyPHash(){
  const m=location.hash.match(/^#p\/(.+)$/),was=pfocus;pfocus=!!m;document.body.classList.toggle("pfocus",pfocus);
  if(m){const name=decodeURIComponent(m[1]);fProject=name;fPerson="";view="project";phEdit=false;
    document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view==="project"));
    document.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tab==="tasks"));
    ["tasks","projects","tg","team"].forEach(k=>document.getElementById("tab"+k[0].toUpperCase()+k.slice(1)).hidden=k!=="tasks");
    document.title=name+" — Пульт";window.scrollTo(0,0);if(booted){renderFilters();render()}}
  else if(was){fProject="";document.title="Пульт задач";if(booted){renderFilters();render()}}
}
window.addEventListener("hashchange",applyPHash);applyPHash();
document.addEventListener("click",async e=>{
  const mo=e.target.closest("[data-pnmode]");if(mo){e.stopPropagation();pnMode=mo.dataset.pnmode;renderProjHead();return}
  if(e.target.closest("[data-pcopy]")&&fProject){e.stopPropagation();if(await copyText(projUrl(fProject)))toast("Посилання на проєкт скопійовано");return}
  if(pfocus&&e.target.closest("[data-phclose]")){e.stopPropagation();window.history.pushState("","",location.pathname+location.search);applyPHash();return}
},true);

/* ---------- Telegram: той самий каркас ---------- */
{
  const tab=$("#tabTg"),oldBar=tab.querySelector(".toolbar"),oldRow=$("#tgChat").parentElement;
  const head=el(`<div class="pagehead"><h2>Повідомлення з робочих чатів</h2></div>`);
  const bar=el(`<div class="toolbar"></div>`);
  mkBar(bar,[el(`<div class="seg" role="group" aria-label="Які повідомлення"><button type="button" data-tgm="new" aria-pressed="${!showRev}">Нові</button><button type="button" data-tgm="all" aria-pressed="${showRev}">Усі</button></div>`)],[$("#tgQ"),mkFBtn("tgFBtn","tgFPanel")]);
  const panel=el(`<div class="fpanel" id="tgFPanel" hidden></div>`);panel.append($("#tgChat"),$("#tgFrom"));
  oldBar.replaceWith(head);head.after(bar,panel,el(`<div class="fchips" id="tgChips" hidden></div>`));oldRow.remove();
}
const _rtgV=renderTg;
renderTg=function(){
  _rtgV();
  const all=msgs.filter(m=>m.chat_id<0),fresh=all.filter(m=>!m.reviewed).length;
  document.querySelectorAll("[data-tgm]").forEach(b=>{b.setAttribute("aria-pressed",String((b.dataset.tgm==="all")===showRev));b.textContent=(b.dataset.tgm==="all"?"Усі ":"Нові ")+(b.dataset.tgm==="all"?all.length:fresh)});
  const c=[];if(tgChat)c.push(["chat","👥 "+(chats[tgChat]?.title||tgChat)]);if(tgFrom)c.push(["from","👤 "+tgFrom]);
  $("#tgChips").hidden=!c.length;$("#tgChips").innerHTML=chipsHtml(c,"tgclr");setFCount("tgFBtn",c.length);
};
document.addEventListener("click",e=>{
  const m=e.target.closest("[data-tgm]");if(m){showRev=m.dataset.tgm==="all";const cb=$("#showRev");if(cb)cb.checked=showRev;renderTg();return}
  const c=e.target.closest("[data-tgclr]");if(c){const k=c.dataset.tgclr;if(k==="chat"||k==="all"){tgChat="";$("#tgChat").value=""}if(k==="from"||k==="all")tgFrom="";renderTg();return}
});

/* ---------- Команда: люди | структура ---------- */
let tmView=lsGet("pultTmView","people"),orgUnits=[],editUnit=null;
{
  const tab=$("#tabTeam"),oldBar=tab.querySelector(".toolbar"),tfSeg=oldBar.querySelector("[data-tf]").closest(".seg");
  const head=el(`<div class="pagehead"><h2>Команда</h2><button class="btn" type="button" id="addUnitBtn" hidden>+ Відділ</button></div>`);head.append($("#addMemBtn"));
  const bar=el(`<div class="toolbar"></div>`);
  mkBar(bar,[el(`<div class="seg" role="group" aria-label="Вигляд команди"><button type="button" data-tmv="people">👥 Люди</button><button type="button" data-tmv="org">🏢 Структура</button></div>`)],[$("#teamQ"),mkFBtn("tmFBtn","tmFPanel")]);
  const panel=el(`<div class="fpanel" id="tmFPanel" hidden></div>`);panel.append(tfSeg);
  oldBar.replaceWith(head);head.after(bar,panel,el(`<div class="fchips" id="tmChips" hidden></div>`));
  $("#teamGrid").after(el(`<div id="orgBox" hidden></div>`));
  $("#teamQ").placeholder="Пошук: імʼя, роль, відділ";
}
async function loadOrg(){const {data}=await sb.from("org_units").select("*").order("sort");orgUnits=data||[]}
const unitOf=m=>orgUnits.find(u=>u.id===m?.unit_id);
const _laV=loadAll;
loadAll=async function(){await _laV();phist={};await loadOrg();renderTeam()};
const _rtmV=renderTeam;
renderTeam=function(){
  _rtmV();
  document.querySelectorAll("[data-tmv]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tmv===tmView));
  const org=tmView==="org";
  $("#teamGrid").hidden=org;$("#orgBox").hidden=!org;$("#addUnitBtn").hidden=!(org&&canManage());
  const sub=$("#tabTeam > p.sub");if(sub)sub.hidden=org;
  const tfb=document.querySelector(`[data-tf="${teamF}"]`),c=teamF!=="all"?[["tf",(tfb?.textContent||"").replace(/ \d+$/,"")]]:[];
  $("#tmChips").hidden=!c.length||org;$("#tmChips").innerHTML=chipsHtml(c,"tmclr");setFCount("tmFBtn",org?0:c.length);
  document.querySelectorAll("#teamGrid .mcard").forEach(card=>{
    const id=card.querySelector("[data-ava]")?.dataset.ava,m=team.find(x=>x.id===id),u=unitOf(m);
    if(u&&!card.querySelector(".mu"))card.querySelector(".mhead .meta")?.insertAdjacentHTML("afterend",`<span class="meta mu" style="display:block">🏢 ${esc(u.name)}${u.head_id===m.id?" · керівник":""}</span>`);
  });
  if(editMem&&$("#em-role")&&!$("#em-unit")){const m=team.find(x=>x.id===editMem);
    $("#em-role").closest("label").insertAdjacentHTML("afterend",`<label class="f">Підрозділ<select id="em-unit"><option value="">— без підрозділу</option>${orgUnits.map(u=>`<option value="${u.id}"${u.id===m?.unit_id?" selected":""}>${esc(u.name)}</option>`).join("")}</select></label>`)}
  if(org)renderOrg();
};
function renderOrg(){
  const box=$("#orgBox"),kids={},q=teamQ.trim().toLowerCase(),ids=new Set(orgUnits.map(u=>u.id));
  orgUnits.forEach(u=>{const k=u.parent_id&&ids.has(u.parent_id)?u.parent_id:"root";(kids[k]??=[]).push(u)});
  const match=m=>!q||[m.name,m.role,unitOf(m)?.name].join(" ").toLowerCase().includes(q);
  const person=(m,u)=>`<div class="ou-p ${match(m)?"":"dim"} ${u&&m.id===u.head_id?"head":""}">${ava(m,"sm")}<div><b>${esc(m.name)}</b><small>${u&&m.id===u.head_id?"Керівник · ":""}${esc(m.role||"")}${u&&m.unit_id!==u.id&&unitOf(m)?` · з відділу «${esc(unitOf(m).name)}»`:""}</small></div></div>`;
  function card(u){
    if(editUnit===u.id)return unitForm(u);
    const mem=team.filter(m=>m.active&&m.unit_id===u.id);const head=team.find(m=>m.id===u.head_id);
    const ppl=[...(head?[head]:[]),...mem.filter(m=>m.id!==u.head_id)];
    const ot=tasks.filter(t=>t.status!=="done"&&mem.some(m=>m.id===t.owner_id)),bad=ot.filter(t=>dueState(t)==="overdue").length;
    return `<div class="ou" data-unit="${u.id}"><div class="ou-h"><h3>${esc(u.name)}</h3><span class="meta">${mem.length} ос. · ${ot.length} відкр.${bad?` · <b class="bad">${bad} простр.</b>`:""}</span>${canManage()?`<button class="icon-btn" type="button" data-uedit="${u.id}" title="Редагувати відділ" aria-label="Редагувати відділ">✎</button>`:""}</div>
      ${u.result?`<div class="ou-res"><span aria-hidden="true">🎯</span><div><small>Результат відділу</small>${esc(u.result)}</div></div>`:""}
      ${u.metric&&u.metric.trim()!=="—"?`<div class="ou-met">📏 ${esc(u.metric)}</div>`:""}
      <div class="ou-ppl">${ppl.map(m=>person(m,u)).join("")||`<small class="meta">Людей ще немає</small>`}</div></div>`;
  }
  const node=u=>{const k=kids[u.id]||[];const leaf=k.every(x=>!(kids[x.id]||[]).length);return `<div class="on">${card(u)}${k.length?`<div class="okids${leaf&&k.length>1?" grid":""}">${k.map(node).join("")}</div>`:""}</div>`};
  const none=team.filter(m=>m.active&&!unitOf(m));
  box.innerHTML=(kids.root||[]).map(node).join("")+(none.length?`<div class="ou"><div class="ou-h"><h3>Без підрозділу</h3><span class="meta">${none.length} ос.</span></div><div class="ou-ppl">${none.map(m=>person(m)).join("")}</div></div>`:"")+
    (orgUnits.length?"":`<div class="empty">Структуру ще не створено.${canManage()?" Натисніть «+ Відділ».":""}</div>`)+
    `<p class="sub" style="margin:0">🎯 — цінний кінцевий продукт відділу: що компанія отримує від його роботи. ★ — керівник. ${canManage()?"Змінити відділ, керівника чи людей — ✎ на картці.":""}</p>`;
}
function descendants(id){const out=new Set([id]);let grew=true;while(grew){grew=false;orgUnits.forEach(u=>{if(u.parent_id&&out.has(u.parent_id)&&!out.has(u.id)){out.add(u.id);grew=true}})}return out}
function unitForm(u){
  const bad=descendants(u.id);
  return `<div class="ou edit" data-unit="${u.id}">
    <label class="f">Назва відділу<input id="u-name" value="${esc(u.name)}" maxlength="80"></label>
    <label class="f">Результат відділу — що отримує компанія<textarea id="u-res" rows="2">${esc(u.result||"")}</textarea></label>
    <label class="f">Як вимірюємо<input id="u-met" value="${esc(u.metric||"")}" placeholder="Напр.: виручка, будинків на місяць"></label>
    <label class="f">Керівник<select id="u-head"><option value="">—</option>${peopleOpts(u.head_id)}</select></label>
    <label class="f">Підпорядковується<select id="u-par"><option value="">— верхній рівень</option>${orgUnits.filter(x=>!bad.has(x.id)).map(x=>`<option value="${x.id}"${x.id===u.parent_id?" selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
    <div class="ou-pick"><small>Люди відділу</small>${team.filter(m=>m.active).map(m=>`<label class="chk"><input type="checkbox" data-upick value="${m.id}"${m.unit_id===u.id?" checked":""}> ${esc(m.name)}${m.unit_id&&m.unit_id!==u.id&&unitOf(m)?` <small>(зараз: ${esc(unitOf(m).name)})</small>`:""}</label>`).join("")}</div>
    <div class="row"><button class="btn primary sm" type="button" data-usave="${u.id}">Зберегти</button><button class="btn ghost sm" type="button" data-ucancel>Скасувати</button><span style="flex:1"></span><button class="btn ghost sm danger" type="button" data-udel="${u.id}">Видалити відділ</button></div>
  </div>`;
}
document.addEventListener("click",async e=>{
  const tv=e.target.closest("[data-tmv]");if(tv){tmView=tv.dataset.tmv;lsSet("pultTmView",tmView);renderTeam();return}
  const tc=e.target.closest("[data-tmclr]");if(tc){teamF="all";document.querySelectorAll("[data-tf]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tf==="all"));renderTeam();return}
  const ue=e.target.closest("[data-uedit]");if(ue){editUnit=ue.dataset.uedit;renderOrg();document.getElementById("u-name")?.focus();return}
  if(e.target.closest("[data-ucancel]")){editUnit=null;renderOrg();return}
  if(e.target.closest("#addUnitBtn")){const root=orgUnits.find(u=>!u.parent_id);
    const {data,error}=await sb.from("org_units").insert({name:"Новий відділ",parent_id:root?.id||null,sort:orgUnits.length+20}).select("id").single();
    if(error){toast("Не створено: "+error.message);return}await loadOrg();editUnit=data.id;renderOrg();document.getElementById("u-name")?.select();return}
  const us=e.target.closest("[data-usave]");if(us){const id=us.dataset.usave,g=k=>document.getElementById("u-"+k);
    const name=g("name").value.trim();if(!name){toast("Вкажіть назву відділу");return}
    us.disabled=true;
    const {error}=await sb.from("org_units").update({name,result:g("res").value.trim()||null,metric:g("met").value.trim()||null,head_id:g("head").value||null,parent_id:g("par").value||null}).eq("id",id);
    if(error){us.disabled=false;toast("Не збережено: "+error.message);return}
    const picked=new Set([...document.querySelectorAll("[data-upick]:checked")].map(x=>x.value));
    const ups=team.filter(m=>m.active).flatMap(m=>picked.has(m.id)&&m.unit_id!==id?[sb.from("task_members").update({unit_id:id}).eq("id",m.id)]:!picked.has(m.id)&&m.unit_id===id?[sb.from("task_members").update({unit_id:null}).eq("id",m.id)]:[]);
    const r=await Promise.all(ups);const err=r.find(x=>x.error);
    editUnit=null;toast(err?"Відділ збережено, але не всіх людей: "+err.error.message:"Відділ збережено");await loadAll();renderTeam();return}
  const ud=e.target.closest("[data-udel]");if(ud){if(!ud.dataset.sure){ud.dataset.sure="1";ud.textContent="Точно видалити? Люди стануть «без підрозділу»";return}
    const {error}=await sb.from("org_units").delete().eq("id",ud.dataset.udel);if(error){toast("Не видалено: "+error.message);return}
    editUnit=null;toast("Відділ видалено");await loadAll();renderTeam();return}
});
document.addEventListener("click",async e=>{
  const ms=e.target.closest("[data-msave]");if(!ms)return;const s=$("#em-unit");if(!s)return;
  const m=team.find(x=>x.id===ms.dataset.msave),v=s.value||null;
  if(m&&(m.unit_id||null)!==v){const {error}=await sb.from("task_members").update({unit_id:v}).eq("id",m.id);if(error)toast("Підрозділ не змінено: "+error.message);else{m.unit_id=v;setTimeout(()=>loadAll(),600)}}
},true);

/* ---------- Доступ до фінмоделі: видно всіх, можна прибрати й додати ---------- */
function whoHtml(p,r){
  const act=team.filter(m=>m.active);
  const owner=act.filter(m=>m.is_owner),all=act.filter(m=>m.fin_all&&!m.is_owner);
  const proj=r.access.map(id=>act.find(m=>m.id===id)).filter(m=>m&&!m.is_owner&&!m.fin_all);
  const isOwner=!!me?.is_owner,canEdit=finAll();
  const chip=(m,k)=>`<span class="fchip acc">${esc(m.name)} <small>${k==="o"?"засновник":k==="a"?"усі фінмоделі":"цей проєкт"}</small>${(k==="a"&&isOwner)||(k==="p"&&canEdit)?`<button type="button" data-faccx="${k}:${m.id}" title="Закрити доступ" aria-label="Закрити доступ: ${esc(m.name)}">✕</button>`:""}</span>`;
  const have=new Set([...owner,...all,...proj].map(m=>m.id));
  const cand=act.filter(m=>!m.is_ai&&!have.has(m.id));
  const sel=canEdit&&cand.length?`<select data-faccnew aria-label="Відкрити доступ"><option value="">+ відкрити доступ…</option><optgroup label="Лише до цього проєкту">${cand.map(m=>`<option value="p:${m.id}">${esc(m.name)}</option>`).join("")}</optgroup>${isOwner?`<optgroup label="До всіх фінмоделей">${cand.map(m=>`<option value="a:${m.id}">${esc(m.name)}</option>`).join("")}</optgroup>`:""}</select>`:"";
  return `<div class="who"><span>Бачать:</span>${owner.map(m=>chip(m,"o")).join("")}${all.map(m=>chip(m,"a")).join("")}${proj.map(m=>chip(m,"p")).join("")}${sel}</div>`;
}
const _finHtmlV=finHtml;
finHtml=function(p,r){return _finHtmlV(p,r).replace(/<div class="who">[\s\S]*?<\/div>/,()=>whoHtml(p,r))};
async function finAccess(kind,id,on){
  const name=nameOf(id);let error;
  if(kind==="p")({error}=on?await sb.from("project_fin_access").insert({project:fProject,member_id:id}):await sb.from("project_fin_access").delete().eq("project",fProject).eq("member_id",id));
  else ({error}=await sb.rpc("pult_set_fin_all",{p_member:id,p_on:on}));
  if(error){toast("Не змінено: "+error.message);return}
  if(kind==="a")await loadAll();
  await loadFin(fProject);renderProjHead();
  toast(on?`Доступ відкрито: ${name}${kind==="a"?" (усі фінмоделі)":""}`:`Доступ закрито: ${name}`);
}
document.addEventListener("change",async e=>{const s=e.target.closest("[data-faccnew]");if(!s||!s.value||!fProject)return;const [k,id]=s.value.split(":");s.disabled=true;await finAccess(k,id,true)});
document.addEventListener("click",async e=>{const x=e.target.closest("[data-faccx]");if(!x||!fProject)return;e.stopPropagation();
  if(!x.dataset.sure){x.dataset.sure="1";x.textContent="закрити?";return}
  const [k,id]=x.dataset.faccx.split(":");await finAccess(k,id,false)},true);

if(booted){renderProjects();renderTg();renderTeam();render()}
/* структура вантажиться разом з пультом (loadAll) — окремий запит до входу давав 401 */
