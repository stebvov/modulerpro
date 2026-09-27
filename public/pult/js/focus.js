/* ---------- Фокус на результат (26.09.2026) ----------
   Поверх tasks.js / tg.js: компактні лічильники, фільтри в розгортці з чипами,
   тихіша картка з клікабельним статусом, «Далі» одним шрифтом, прості картки проєктів. */
document.head.insertAdjacentHTML("beforeend",`<style>
/* ---------- фокус на результат (26.09): менше шуму, все клікабельне ---------- */
header.top{flex-wrap:nowrap;align-items:center}
header.top h1{font-size:22px}
.top-acts{flex-wrap:nowrap}
.stats{display:flex;flex-wrap:nowrap;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -2px;padding:2px}
.stats::-webkit-scrollbar{display:none}
.stat{display:inline-flex;align-items:baseline;gap:6px;flex:none;border-radius:99px;padding:6px 14px}
.stat .n{font-size:15px;display:inline} .stat .l{font-size:13px;text-transform:none;letter-spacing:0;color:var(--muted)}
.stat[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);box-shadow:none}
.stat[aria-pressed="true"] .n,.stat[aria-pressed="true"] .l{color:var(--accent-ink)}
#q{flex:1;min-width:160px}
.fbtn.on{border-color:var(--accent);color:var(--accent)}
.fpanel{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--sunk);border-radius:12px;padding:10px}
.fpanel select{width:auto;max-width:100%}
.fchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:-8px}
.fchip{font:500 13px var(--body);background:var(--info-bg);color:var(--accent);border:0;border-radius:99px;padding:4px 10px;cursor:pointer}
.fchip:hover{background:var(--accent);color:var(--accent-ink)} .fchip.clr{background:transparent;color:var(--muted);text-decoration:underline}
.card-head{gap:6px 12px;padding:12px 14px}
.card:hover{border-color:color-mix(in srgb,var(--accent) 35%,var(--line))}
.stw{position:relative;align-self:start}
button.pill{border:0;cursor:pointer;font-family:var(--body)} button.pill:hover{filter:brightness(.95);box-shadow:inset 0 0 0 1px currentColor}
.pill .caret{font-size:9px;opacity:.6}
.pop button[aria-current="true"]{font-weight:600}
.card-head .tags{gap:4px 14px}
.m,.mlink{font:400 13px var(--body);color:var(--muted);white-space:nowrap}
.mlink{background:none;border:0;padding:0;cursor:pointer;max-width:260px;overflow:hidden;text-overflow:ellipsis}
.mlink:hover{color:var(--accent);text-decoration:underline}
.m.rec{font-family:var(--mono);font-size:12px}
.ckp{display:inline-flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}
.ckp i{display:inline-block;width:32px;height:4px;border-radius:2px;background:linear-gradient(90deg,var(--ok) var(--p),var(--line) var(--p))}
.card-head .tag.tg{background:transparent;padding:0;color:var(--muted);font-size:13px} .card-head .tag.tg:hover{color:var(--accent);text-decoration:underline}
.acts{margin-left:auto;display:inline-flex;gap:6px}
@media (hover:hover){.card .acts{opacity:0;transition:opacity .12s}.card:hover .acts,.card:focus-within .acts{opacity:1}}
@media (hover:none){.card-head[aria-expanded="false"] .acts{display:none}}
.next{font:400 14px/1.45 var(--body);color:var(--ink);padding-left:10px;border-left:2px solid var(--accent)}
.next .next-l{color:var(--muted)}
.group-head h2{font-size:16px}
.gact{font-size:14px;line-height:26px;opacity:.6} .gact:hover{opacity:1}
.rules{padding:10px 16px} .rules summary{font-size:13px}
@media (max-width:640px){
  body{padding-block:calc(12px + env(safe-area-inset-top,0px)) 48px}
  .wrap{gap:14px}
  header.top h1{font-size:19px}
  #whoami{display:none} .me-btn{padding:3px}
  #tabTasks .toolbar{gap:8px} #tabTasks .toolbar #q{order:3;flex-basis:100%}
  #tabTasks .toolbar .fbtn{margin-left:auto}
  .card-head{padding:10px 12px}
  .mlink{max-width:180px}
}
.stat.bad{background:var(--bad-bg);border-color:transparent} .stat.bad .l{color:var(--bad)}
.stat.warn{background:var(--warn-bg);border-color:transparent} .stat.warn .l{color:var(--warn)}
.stats .stat[aria-pressed="true"]{background:var(--accent);border-color:var(--accent)} .stats .stat[aria-pressed="true"] .n,.stats .stat[aria-pressed="true"] .l{color:var(--accent-ink)}
body.focus #fPanel,body.focus #fChips{display:none!important}
.pcard[data-pcard]{cursor:pointer}.pcard[data-pcard]:hover{border-color:var(--accent)}
.card-head[aria-expanded="true"] .acts{opacity:1}
.acts a.icon-btn{text-decoration:none;display:inline-block}
.pnotes{display:flex;flex-direction:column;gap:10px;background:var(--sunk);border-radius:10px;padding:12px}
.pnotes h3{margin:0;font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.pnote{display:flex;flex-direction:column;gap:2px;font-size:14px;position:relative}
.pnote small{color:var(--muted);font-family:var(--mono);font-size:12px}
.pnote p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.pnote .pndel{position:absolute;right:0;top:0;line-height:18px;padding:0 6px;opacity:.5} .pnote .pndel:hover{opacity:1}
</style>`);
let stMenu=null;
{const o=$("#fSort");if(o){o.options[0].text="Сортувати за терміном";o.options[1].text="Мій порядок"}}

/* лічильники: одна стрічка, нулі сховані */
const STAT_ORDER=["overdue","today","mine","ctl","stale","nodue","recur","open"];
renderStats=function(){
  $("#stats").innerHTML=STAT_ORDER.filter(k=>FILTERS[k]).map(k=>{const v=FILTERS[k],n=tasks.filter(v.f).length;
    if(!n&&filter!==k&&k!=="open")return"";
    return `<button type="button" class="stat ${n&&v.cls?v.cls:""}" data-f="${k}" aria-pressed="${filter===k}" title="${filter===k?"Зняти фільтр":"Показати лише ці задачі"}"><span class="n">${n}</span><span class="l">${v.l}</span></button>`}).join("");
  renderFChips();
};
/* активні фільтри: лічильник на кнопці «Фільтри» + чипи з ✕ */
function renderFChips(){
  const c=[];
  if(filter)c.push(["filter",FILTERS[filter].l]);
  if(fPerson)c.push(["person","👤 "+nameOf(fPerson)]);
  if(fProject)c.push(["project","📁 "+fProject]);
  if(fTag)c.push(["tag","#"+fTag]);
  if(showDone)c.push(["done","з виконаними"]);
  if(sortMode==="manual")c.push(["sort","мій порядок"]);
  const n=c.length-(filter?1:0);
  $("#fCount").textContent=n?" · "+n:"";$("#fBtn").classList.toggle("on",n>0);
  $("#fChips").hidden=!c.length;
  $("#fChips").innerHTML=c.map(([k,l])=>`<button type="button" class="fchip" data-clr="${k}" title="Прибрати фільтр">${esc(l)} <span aria-hidden="true">✕</span></button>`).join("")+(c.length>1?`<button type="button" class="fchip clr" data-clr="all">Скинути все</button>`:"");
}

/* картка задачі */
ckTag=function(t){const l=checks[t.id]||[];if(!l.length)return"";const d=l.filter(c=>c.done).length;return `<span class="m ckp" title="Чекпоінти: виконано ${d} з ${l.length}"><i style="--p:${Math.round(d/l.length*100)}%"></i>${d}/${l.length}</span>`};
const _cardOrig=card;
card=function(t){
  if(reorder)return _cardOrig(t);
  const ds=dueState(t),open=openId===t.id;
  const other=view==="owner"?`<button type="button" class="mlink" data-ptasks="${esc(t.project||"")}" title="Відкрити проєкт">📁 ${esc(t.project||"—")}</button>`:`<button type="button" class="mlink" data-fperson="${t.owner_id}" title="Показати задачі людини">👤 ${esc(nameOf(t.owner_id))}</button>`;
  const ctl=t.controller_id?`<button type="button" class="mlink" data-fperson="${t.controller_id}" title="Контролер — показати його задачі">👁 ${esc(nameOf(t.controller_id))}</button>`:"";
  const rec=recurLabel(t),nx=nextCheck(t);
  return `<article class="card s-${ds}" data-id="${t.id}">
    <div class="card-head" tabindex="0" role="button" aria-expanded="${open}">
      <div class="title"><span class="num">#${t.num}</span>${esc(t.title)}</div>
      <span class="stw"><button type="button" class="pill ${t.status}" data-stmenu="${t.id}" aria-haspopup="true" aria-expanded="${stMenu===t.id}" title="Змінити статус">${STATUS[t.status]} <span class="caret" aria-hidden="true">▾</span></button>${stMenu===t.id?`<div class="pop">${Object.entries(STATUS).map(([k,l])=>`<button type="button" data-stset="${t.id}:${k}"${k===t.status?' aria-current="true"':""}>${k===t.status?"✓ ":""}${l}</button>`).join("")}</div>`:""}</span>
      <div class="tags">${dueBadge(t)}${rec?`<span class="m rec">${esc(rec)}</span>`:""}${isStale(t)?`<span class="stale">💤 ${staleDays(t)} дн без оновлень</span>`:""}${other}${ctl}${ckTag(t)}${counts[t.id]?`<span class="m" title="Коментарі">💬 ${counts[t.id]}</span>`:""}${tagChips(t)}<span class="acts"><button type="button" class="icon-btn" data-copylink="${t.num}" title="Скопіювати посилання на задачу" aria-label="Скопіювати посилання">🔗</button>${focusNum?"":`<a class="icon-btn" href="#t/${t.num}" target="_blank" rel="noopener" title="Відкрити в окремому вікні" aria-label="Відкрити в окремому вікні">⧉</a>`}<button type="button" class="icon-btn" data-editcard="${t.id}" title="Редагувати" aria-label="Редагувати задачу">✎</button></span></div>
      ${nx?`<div class="next"><span class="next-l">Далі:</span> ${esc(nx.title)}</div>`:""}
    </div>${open?editor(t):""}</article>`;
};

/* після кожного рендеру: іконки в шапках груп, кнопка «Редагувати» у відкритій картці */
const _renderFocus=render;
render=function(){
  _renderFocus();
  if(reorder)return;
  document.querySelectorAll("#board .group-head [data-remind]").forEach(b=>{b.className="icon-btn gact";b.textContent="🔔";b.title="Скопіювати нагадування для Telegram";b.setAttribute("aria-label","Скопіювати нагадування")});
  document.querySelectorAll("#board .group-head [data-addfor],#board .group-head [data-addin]").forEach(b=>{b.className="icon-btn gact";b.textContent="＋";b.title="Нова задача";b.setAttribute("aria-label","Нова задача")});
  document.querySelectorAll("#board .edit [data-vstatus]").forEach(s=>{const r=s.closest(".row.full");if(r)r.remove()});
};

/* проєкти: назва й картка відкривають, «+ задача», тихі ✎ і ✓ */
renderProjects=function(){
  const openBy=n=>tasks.filter(t=>t.project===n&&t.status!=="done").length;
  const PF={withTasks:p=>p.status!=="done"&&openBy(p.name)>0,active:p=>p.status!=="done",done:p=>p.status==="done",all:()=>true};
  document.querySelectorAll("[data-pflt]").forEach(b=>{b.textContent=b.textContent.replace(/ \d+$/,"")+" "+projects.filter(PF[b.dataset.pflt]).length});
  const pq=projQ.trim().toLowerCase();
  const plist=projects.filter(PF[projF]).filter(p=>!pq||[p.name,p.description,p.owner_id?nameOf(p.owner_id):""].join(" ").toLowerCase().includes(pq));
  if(!plist.length){$("#projGrid").innerHTML=`<div class="empty">Немає проєктів за цим фільтром.</div>`;return}
  $("#projGrid").innerHTML=plist.map(p=>{
    const pt=tasks.filter(t=>t.project===p.name),open=pt.filter(t=>t.status!=="done"),bad=open.filter(t=>dueState(t)==="overdue").length,done=pt.length-open.length;
    const n=esc(p.name);
    if(editProj===p.name)return `<div class="pcard">
      <label class="f">Назва<input data-pf="name" data-pn="${n}" value="${n}"></label>
      <label class="f">Опис<textarea data-pf="desc" data-pn="${n}" rows="2">${esc(p.description||"")}</textarea></label>
      <label class="f">Відповідальний<select data-pf="owner" data-pn="${n}"><option value="">—</option>${peopleOpts(p.owner_id)}</select></label>
      <label class="f">Стан<select data-pf="status" data-pn="${n}">${opts(Object.entries(PSTATUS),p.status)}</select></label>
      <div class="row"><button class="btn primary sm" type="button" data-psave="${n}">Зберегти</button><button class="btn ghost sm" type="button" data-pedit="${n}">Скасувати</button></div></div>`;
    return `<div class="pcard ${p.status}" data-pcard="${n}">
      <div class="row" style="justify-content:space-between"><h2><button type="button" class="plink" data-ptasks="${n}" style="text-decoration:none;color:inherit" title="Відкрити проєкт">${n}</button></h2>${p.status!=="active"?`<span class="tag">${PSTATUS[p.status]}</span>`:""}</div>
      ${p.description?`<p style="white-space:pre-wrap;overflow-wrap:anywhere">${linkify(p.description)}</p>`:""}${(p.attachments||[]).length?`<span class="meta">📎 файлів: ${p.attachments.length}</span>`:""}
      <span class="meta">Відповідальний: ${esc(p.owner_id?nameOf(p.owner_id):"не призначено")}</span>
      <div class="pnums"><span>${open.length} відкр.</span>${pnCount[p.name]?`<span title="Нотатки проєкту">🗒 ${pnCount[p.name]}</span>`:""}${bad?`<span class="bad">${bad} простр.</span>`:""}<span style="color:var(--muted)">${done} вик.</span></div>
      <div class="row" style="margin-top:auto">${p.status==="done"?"":`<button class="btn sm" type="button" data-addin="${n}">+ задача</button>`}<span style="flex:1"></span><button class="icon-btn" type="button" data-pedit="${n}" title="Редагувати проєкт" aria-label="Редагувати проєкт">✎</button><button class="icon-btn" type="button" data-pclose="${n}" title="${p.status==="done"?"Відкрити проєкт знову":"Закрити проєкт — нові задачі в нього не створюватимуться"}" aria-label="${p.status==="done"?"Відкрити знову":"Закрити проєкт"}">${p.status==="done"?"↺":"✓"}</button></div>
    </div>`}).join("");
};

/* кліки */
document.addEventListener("click",async e=>{
  const sm=e.target.closest("[data-stmenu]");
  if(sm){e.stopPropagation();stMenu=stMenu===sm.dataset.stmenu?null:sm.dataset.stmenu;render();return}
  const ss=e.target.closest("[data-stset]");
  if(ss){e.stopPropagation();const [id,st]=ss.dataset.stset.split(":");stMenu=null;const t=tasks.find(x=>x.id===id);
    if(!t||t.status===st){render();return}
    const {error}=await sb.from("tasks").update({status:st}).eq("id",id);if(error){toast("Не змінено: "+error.message);render();return}
    await sb.from("task_updates").insert({task_id:id,author_id:me?.id||null,kind:"status",body:"Статус: "+STATUS[st]});
    t.status=st;toast(t.recur!=="none"&&st==="done"?"Період закрито, дедлайн перенесено":`#${t.num}: ${STATUS[st]}`);render();loadAll();if(history[id])loadHistory(id);return}
  if(stMenu&&!e.target.closest(".pop")){stMenu=null;render();if(e.target.closest(".card-head"))e.stopPropagation();return}
  const fp=e.target.closest("[data-fperson]");
  if(fp){e.stopPropagation();fPerson=fp.dataset.fperson;fProject="";renderFilters();render();window.scrollTo({top:0,behavior:"smooth"});toast("Фільтр: "+nameOf(fPerson));return}
  const fb=e.target.closest("#fBtn");if(fb){const p=$("#fPanel");p.hidden=!p.hidden;fb.setAttribute("aria-expanded",String(!p.hidden));return}
  const cl=e.target.closest("[data-clr]");
  if(cl){const k=cl.dataset.clr;
    if(k==="filter"||k==="all")filter=null;
    if(k==="person"||k==="all")fPerson="";
    if(k==="project"||k==="all")fProject="";
    if(k==="tag"||k==="all")fTag="";
    if(k==="done"||k==="all"){showDone=false;$("#showDone").checked=false}
    if(k==="sort"||k==="all"){setSort("due");$("#fSort").value="due"}
    renderFilters();render();return}
  const pc=e.target.closest("[data-pcard]");
  if(pc&&!e.target.closest("button,a,input,select,textarea,label")){pc.querySelector("[data-ptasks]")?.click();return}
},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&stMenu){stMenu=null;render()}});
$("#showDone").addEventListener("change",()=>renderFChips());
$("#fSort").addEventListener("change",()=>renderFChips());


/* ---------- нотатки проєкту (26.09) ---------- */
let pnotes={},pnCount={},pnPick=null,pnPend=[];
async function loadPNotes(name){
  const {data}=await sb.from("project_notes").select("*").eq("project",name).order("created_at",{ascending:true}).limit(300);
  pnotes[name]=data||[];pnCount[name]=pnotes[name].length;await signPaths(pnotes[name]);
  if(fProject===name&&!phEdit)renderProjHead();
}
async function loadNoteCounts(){
  const {data}=await sb.from("project_notes").select("project");
  pnCount={};(data||[]).forEach(r=>pnCount[r.project]=(pnCount[r.project]||0)+1);
  if(!$("#tabProjects").hidden)renderProjects();
}
const _loadAllFocus=loadAll;
loadAll=async function(){await _loadAllFocus();loadNoteCounts();if(fProject)loadPNotes(fProject);
  if(!loadAll.sub){loadAll.sub=1;sb.channel("pult-notes").on("postgres_changes",{event:"*",schema:"public",table:"project_notes"},()=>{loadNoteCounts();if(fProject)loadPNotes(fProject)}).subscribe()}};
function pnotesHtml(name){
  const l=pnotes[name];
  const list=l===undefined?`<small class="meta">Завантаження…</small>`:!l.length?`<small class="meta">Нотаток ще немає. Додайте тут або з вкладки Telegram кнопкою «🗒 В проєкт».</small>`:
    l.map(n=>`<div class="pnote"><small>${fmtDT(n.created_at)} · ${esc(nameOf(n.author_id))}${n.source_chat_id?" · з Telegram":""}</small>${(canManage()||n.author_id===me?.id)?`<button type="button" class="icon-btn pndel" data-pndel="${n.id}" title="Видалити нотатку" aria-label="Видалити нотатку">×</button>`:""}${n.body?`<p>${mentionify(linkify(n.body))}</p>`:""}${attsHtml(n.attachments)}</div>`).join("");
  return `<div class="full pnotes"><h3>🗒 Нотатки проєкту${l&&l.length?` · ${l.length}`:""}</h3><div id="pn-list" style="display:flex;flex-direction:column;gap:10px;max-height:340px;overflow:auto">${list}</div>
    <div class="pend" id="pn-pend">${pnPend.map((f,i)=>`<span>📎 ${esc(f.name)} <button class="btn ghost sm" type="button" data-pnunpend="${i}" aria-label="Прибрати" style="padding:0 4px">×</button></span>`).join("")}</div>
    <div class="cbox"><textarea id="pn-in" rows="1" placeholder="Нотатка до проєкту: ідея, домовленість, контакт, посилання"></textarea><label class="btn filebtn" title="Додати файли або фото">📎<input type="file" multiple data-pnfiles></label><button class="btn primary" type="button" data-pnadd>Додати</button></div></div>`;
}
const _projHeadFocus=renderProjHead;
renderProjHead=function(){
  _projHeadFocus();
  const p=fProject&&!focusNum&&projects.find(x=>x.name===fProject);
  if(!p||phEdit)return;
  if(pnotes[p.name]===undefined&&!loadPNotes.busy?.[p.name]){(loadPNotes.busy??={})[p.name]=1;loadPNotes(p.name).finally(()=>delete loadPNotes.busy[p.name])}
  const draft=$("#pn-in")?.value||"";
  $("#projHead").insertAdjacentHTML("beforeend",pnotesHtml(p.name));
  const ta=$("#pn-in");if(ta&&draft){ta.value=draft;autosize(ta)}
  const l=$("#pn-list");if(l)l.scrollTop=l.scrollHeight;
};
async function addPNote(){
  const name=fProject,ta=$("#pn-in");if(!name||!ta)return;const body=ta.value.trim();if(!body&&!pnPend.length)return;
  ta.disabled=true;if(pnPend.length)toast("Завантажую файли…");
  const attachments=pnPend.length?await uploadFiles("p/"+safeName(name),pnPend):[];
  const {error}=await sb.from("project_notes").insert({project:name,author_id:me?.id||null,body,attachments});
  ta.disabled=false;if(error){toast("Не додано: "+error.message);return}
  pnPend=[];ta.value="";toast("Нотатку додано");await loadPNotes(name);
}

/* кнопка «🗒 В проєкт» у вкладці Telegram */
const _renderTgFocus=renderTg;
renderTg=function(){
  _renderTgFocus();
  document.querySelectorAll("#tgList .msg").forEach(el=>{
    const a=el.querySelector(":scope > .row [data-attach]");if(!a)return;const id=a.dataset.attach;
    a.insertAdjacentHTML("afterend",`<button class="btn sm" type="button" data-pnmsg="${id}" title="Зберегти повідомлення в нотатках проєкту">🗒 В проєкт</button>`);
    if(pnPick===id){const m=msgs.find(x=>String(x.id)===id);const def=chats[m?.chat_id]?.project;const act=activeProjects();
      a.closest(".row").insertAdjacentHTML("afterend",`<div class="picker"><label class="f">Проєкт<select id="pn-proj">${opts(act.map(p=>[p.name,p.name]),act.some(p=>p.name===def)?def:act[0]?.name)}</select></label>
      <div class="row" style="align-self:end;flex-wrap:nowrap"><button class="btn primary sm" type="button" data-pngo="${id}" style="white-space:nowrap">Додати нотатку</button><button class="btn ghost sm" type="button" data-pnmsg="${id}">Скасувати</button></div>
      <span class="meta full">Повідомлення разом із файлами збережеться в нотатках проєкту й позначиться переглянутим.</span></div>`)}
  });
};
async function msgToProject(id){
  const m=msgs.find(x=>String(x.id)===id),name=$("#pn-proj")?.value;if(!m||!name)return;
  const ch=chats[m.chat_id]?.title||"чат";
  const {error}=await sb.from("project_notes").insert({project:name,author_id:me?.id||null,body:`💬 ${m.from_name} у «${ch}», ${fmtDT(m.sent_at)}:\n${m.text||""}`,attachments:(m.attachments||[]).filter(a=>a.path),source_chat_id:m.chat_id,source_message_id:m.message_id});
  if(error){toast("Не додано: "+error.message);return}
  await sb.from("tg_messages").update({reviewed:true}).eq("id",m.id);
  m.reviewed=true;pnPick=null;pnCount[name]=(pnCount[name]||0)+1;delete pnotes[name];renderTg();toast(`Додано в нотатки «${name}»`);
}

document.addEventListener("click",async e=>{
  if(e.target.closest(".card-head a.icon-btn")){e.stopPropagation();return}
  const pm=e.target.closest("[data-pnmsg]");if(pm){e.stopPropagation();pnPick=pnPick===pm.dataset.pnmsg?null:pm.dataset.pnmsg;pick=null;renderTg();return}
  const pg=e.target.closest("[data-pngo]");if(pg){e.stopPropagation();await msgToProject(pg.dataset.pngo);return}
  if(e.target.closest("[data-pnadd]")){e.stopPropagation();await addPNote();return}
  const pu=e.target.closest("[data-pnunpend]");if(pu){e.stopPropagation();pnPend.splice(+pu.dataset.pnunpend,1);renderProjHead();return}
  const pd=e.target.closest("[data-pndel]");if(pd){e.stopPropagation();
    if(!pd.dataset.sure){pd.dataset.sure="1";pd.textContent="Видалити?";pd.style.opacity=1;return}
    const {error}=await sb.from("project_notes").delete().eq("id",pd.dataset.pndel);if(error){toast("Не видалено: "+error.message);return}
    toast("Нотатку видалено");await loadPNotes(fProject);return}
},true);
document.addEventListener("change",e=>{const f=e.target.closest("[data-pnfiles]");if(!f)return;pnPend.push(...f.files);f.value="";renderProjHead()});
document.addEventListener("paste",e=>{if(e.target.id!=="pn-in")return;const files=[...(e.clipboardData?.files||[])];if(files.length){e.preventDefault();pnPend.push(...files.map((f,i)=>f.name&&f.name!=="image.png"?f:new File([f],`screenshot_${Date.now()}_${i}.png`,{type:f.type})));renderProjHead()}});
document.addEventListener("keydown",e=>{if(e.target.id==="pn-in"&&e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();addPNote()}});
