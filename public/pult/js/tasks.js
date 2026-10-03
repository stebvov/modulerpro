/* ---------- tasks ---------- */
let fTag="",ckEdit=null,ckMenu=null,ckMove=null,projMenu=null,reorder=false,phEdit=false,focusNum=null,drag=null;
let sortMode=(()=>{try{return localStorage.getItem("pultSort")||"due"}catch(e){return"due"}})();
const setSort=v=>{sortMode=v;try{localStorage.setItem("pultSort",v)}catch(e){}};
function renderNow(){render.force=true;try{render()}finally{render.force=false}}
document.head.insertAdjacentHTML("beforeend",`<style>
@media (max-width:640px){.cbox{flex-wrap:wrap}.cbox textarea{flex:1 1 100%;width:100%;min-height:64px}.cbox .filebtn{flex:0 0 auto}.cbox [data-act=comment]{flex:1}}
.tag.tg{background:var(--warn-bg);color:var(--warn);cursor:pointer;border:0;font:inherit;font-size:12px}
.icon-btn{background:transparent;border:1px solid var(--line);border-radius:6px;padding:0 7px;line-height:22px;font-size:13px;cursor:pointer;color:var(--muted)}
.icon-btn:hover{border-color:var(--accent);color:var(--accent)}
.plink{background:none;border:0;padding:0;font:inherit;color:var(--accent);text-decoration:underline;cursor:pointer;text-align:left}
#fTag{width:auto;max-width:200px}
.pop{position:absolute;right:0;top:calc(100% + 4px);z-index:20;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);display:flex;flex-direction:column;min-width:190px;padding:4px}
.pop button{background:none;border:0;text-align:left;padding:8px 10px;border-radius:6px;font:inherit;font-size:14px;color:var(--ink);cursor:pointer}
.pop button:hover{background:var(--sunk)} .pop button.danger{color:var(--bad)}
.ckrow{position:relative;display:flex;gap:8px;align-items:flex-start}
.ckrow .cktext{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;padding-top:1px}
.tag.proj.pbtn{border:0;font:inherit;font-size:12px;cursor:pointer}
.dragh{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;font-size:18px;line-height:1;padding:6px 10px;color:var(--muted);border:1px dashed var(--line);border-radius:6px;flex:none;background:var(--sunk)}
.dragh:active{cursor:grabbing}
.dragging{opacity:.75;box-shadow:0 8px 22px rgba(0,0,0,.22);position:relative;z-index:5}
.reo .card-head{cursor:default;align-items:center} .reo .title{display:flex;gap:10px;align-items:center}
.reobar{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--info-bg);border:1px solid var(--accent);border-radius:10px;padding:10px 12px;font-size:14px}
.reobar span{flex:1 1 220px}
#fSort{width:auto}
.head-icons{display:flex;gap:6px;align-items:center}
.head-icons .icon-btn{line-height:28px;padding:0 9px;font-size:15px;text-decoration:none}
#projHead h2{margin:0;font-size:20px}
body.focus #stats,body.focus #tabTasks .toolbar,body.focus #rulesBox,body.focus #app>.seg,body.focus #projHead,body.focus header .sub,body.focus #addProjBtn{display:none!important}
</style>`);
$("#fProject").insertAdjacentHTML("afterend",`<select id="fTag" aria-label="Тег"></select><select id="fSort" aria-label="Сортування"><option value="due">⏱ За терміном</option><option value="manual">↕ Мій порядок</option></select><button class="btn sm" type="button" id="reoBtn" title="Перетягнути задачі у потрібному порядку">↕ Змінити порядок</button>`);
$("#fSort").value=sortMode;
$("#board").insertAdjacentHTML("beforebegin",`<section class="panel" id="projHead" hidden></section>`);
$("#nCtl").closest("label").insertAdjacentHTML("afterend",`<label class="f">Теги (через кому)<input id="nTags" list="tagList" placeholder="фінанси, оплата"></label><datalist id="tagList"></datalist>`);
const allTags=()=>[...new Set(tasks.flatMap(t=>t.tags||[]))].sort((a,b)=>a.localeCompare(b,"uk"));
const parseTags=v=>[...new Set(String(v||"").split(/[,;#]+/).map(x=>x.trim().toLowerCase()).filter(Boolean))].slice(0,10);
const tagChips=t=>(t.tags||[]).map(g=>`<button type="button" class="tag tg" data-tagf="${esc(g)}" title="Показати всі задачі з цим тегом">#${esc(g)}</button>`).join("");
function renderStats(){
  $("#stats").innerHTML=Object.entries(FILTERS).map(([k,v])=>{const n=tasks.filter(v.f).length;
    return `<button type="button" class="stat ${n&&v.cls?v.cls:""}" data-f="${k}" aria-pressed="${filter===k}"><span class="n">${n}</span><span class="l">${v.l}</span></button>`}).join("");
}
function dueBadge(t){
  const ds=dueState(t);
  if(ds==="none")return`<span class="due none">термін?</span>`;
  if(ds==="done")return"";
  const tm=t.due_time?" "+hm(t.due_time):"";
  if(ds==="overdue"){const d=-days(t.due,today());return`<span class="due bad">${fmt(t.due)}${tm} · ${d>0?"−"+d+" дн":"час минув"}</span>`}
  if(ds==="today")return`<span class="due warn">сьогодні${tm}</span>`;
  return`<span class="due ${ds==="soon"?"warn":"ok"}">${fmt(t.due)}${tm}</span>`;
}
function card(t){
  const ds=dueState(t),open=openId===t.id;
  if(reorder)return `<article class="card s-${ds}" data-id="${t.id}" data-dragitem><div class="card-head"><div class="title"><span class="dragh" data-drag aria-label="Перетягнути">≡</span><span><span class="num">#${t.num}</span>${esc(t.title)}</span></div><span class="pill ${t.status}">${STATUS[t.status]}</span></div></article>`;
  let other=view==="owner"?`<span style="position:relative;display:inline-flex"><button type="button" class="tag proj pbtn" data-ptasks="${esc(t.project||"")}" title="Відкрити проєкт">${esc(t.project||"—")}</button></span>`:`<span class="tag">${esc(nameOf(t.owner_id))}</span>`;
  const rec=recurLabel(t);
  if(t.controller_id)other+=`<span class="tag ctl" title="Контролер">👁 ${esc(nameOf(t.controller_id))}</span>`;
  return `<article class="card s-${ds}" data-id="${t.id}">
    <div class="card-head" tabindex="0" role="button" aria-expanded="${open}">
      <div class="title"><span class="num">#${t.num}</span>${esc(t.title)}</div>
      <span class="pill ${t.status}">${STATUS[t.status]}</span>
      <div class="tags">${other}${dueBadge(t)}${rec?`<span class="tag rec">${esc(rec)}</span>`:""}${t.source==="telegram"?`<span class="tag">з Telegram</span>`:""}${counts[t.id]?`<span class="ccount">💬 ${counts[t.id]}</span>`:""}${isStale(t)?`<span class="stale">без оновлень ${staleDays(t)} дн</span>`:""}${ckTag(t)}${tagChips(t)}<button type="button" class="icon-btn" data-editcard="${t.id}" title="Редагувати" aria-label="Редагувати задачу" style="margin-left:auto">✎</button></div>
      ${nextCheck(t)?`<div class="next">Далі: <b>${esc(nextCheck(t).title)}</b></div>`:""}
    </div>${open?editor(t):""}</article>`;
}
const nextCheck=t=>(checks[t.id]||[]).find(c=>!c.done);
function ckTag(t){const l=checks[t.id]||[];if(!l.length)return"";const d=l.filter(c=>c.done).length;return `<span class="tag" title="Чекпоінти">☑ ${d}/${l.length}</span>`}
function mentionify(html){let out=html;[...team].sort((a,b)=>b.name.length-a.name.length).forEach(m=>{const n=esc("@"+m.name);out=out.split(n).join(`<b style="color:var(--accent)">${n}</b>`)});return out}
function feedHtml(id){
  const h=history[id];
  if(h===undefined)return"<small class='meta'>Завантаження…</small>";
  if(!h.length)return"<small class='meta'>Коментарів ще немає. Напишіть перший звіт нижче.</small>";
  const KL={comment:"",report:" · звіт",note:" · уточнення",created:" · створено",status:" · зміна"};
  return h.map(u=>`<div class="cmt ${["comment","report","note"].includes(u.kind)?"":"sys"}"><small>${fmtDT(u.created_at)} · ${esc(nameOf(u.author_id))}${KL[u.kind]??""}</small>${u.body?`<p>${mentionify(linkify(u.body))}</p>`:""}${attsHtml(u.attachments)}</div>`).join("");
}
function feedBlock(t){
  return `<div class="feed"><h3>Коментарі та історія</h3><div id="feed-${t.id}" style="display:flex;flex-direction:column;gap:10px;max-height:320px;overflow:auto">${feedHtml(t.id)}</div>
      <div class="pend" id="pend-${t.id}">${pendHtml(t.id)}</div>
      <div id="ment-${t.id}" class="row" hidden style="gap:4px"></div>
      <div class="cbox"><textarea id="c-${t.id}" rows="1" placeholder="${t.recur!=="none"?"Звіт за період — закриє сьогоднішній дедлайн. @ — згадати":"Коментар або звіт. @ — згадати учасника, фото можна вставити з буфера"}"></textarea><label class="btn filebtn" title="Додати файли або фото">📎<input type="file" multiple data-files="${t.id}"></label><button class="btn primary" type="button" data-act="comment">Надіслати</button></div>
    </div>`;
}
function checksBlock(t){
  const l=checks[t.id]||[],mv=ckMove===t.id;
  return `<div class="full" style="display:flex;flex-direction:column;gap:6px"><div class="row" style="justify-content:space-between"><h3 style="margin:0;font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Чекпоінти${l.length?` · ${l.filter(c=>c.done).length}/${l.length}`:""}</h3>${mv?`<span class="row" style="gap:6px"><button class="btn primary sm" type="button" data-ckmovedone="${t.id}">Зафіксувати</button><button class="btn ghost sm" type="button" data-ckmovecancel>Скасувати</button></span>`:""}</div>
    ${mv?`<span class="meta">Перетягуйте пункти за ≡</span><div id="cklist-${t.id}" style="display:flex;flex-direction:column;gap:6px">${l.map(c=>`<div class="ckrow" data-dragitem data-ckid="${c.id}" style="align-items:center;background:var(--surface);border-radius:6px"><span class="dragh" data-drag aria-label="Перетягнути">≡</span><span class="cktext" style="${c.done?"text-decoration:line-through;color:var(--muted)":""}">${esc(c.title)}</span></div>`).join("")}</div>`:""}
    ${mv?"":l.map((c,i)=>ckEdit===c.id?`<div class="ckrow"><input id="ckin-${c.id}" value="${esc(c.title)}" data-ckinput="${c.id}" style="flex:1"><button class="btn primary sm" type="button" data-chksave="${c.id}">OK</button><button class="btn ghost sm" type="button" data-chkcancel>✕</button></div>`
      :`<div class="ckrow"><input type="checkbox" data-chk="${c.id}"${c.done?" checked":""} style="width:auto;flex:none;margin-top:3px" aria-label="Виконано"><span class="cktext" style="${c.done?"text-decoration:line-through;color:var(--muted)":""}">${linkify(c.title)}</span>${mv?`<button class="icon-btn" type="button" data-chkmove="${c.id}:-1" aria-label="Вгору"${i?"":" disabled"}>↑</button><button class="icon-btn" type="button" data-chkmove="${c.id}:1" aria-label="Вниз"${i<l.length-1?"":" disabled"}>↓</button>`
        :`<button class="icon-btn" type="button" data-ckmenu="${c.id}" aria-label="Дії з чекпоінтом" aria-expanded="${ckMenu===c.id}">⋯</button>${ckMenu===c.id?`<div class="pop"><button type="button" data-chkedit="${c.id}">✎ Редагувати</button>${l.length>1?`<button type="button" data-ckmovestart="${t.id}">↕ Поміняти порядок</button>`:""}<button type="button" class="danger" data-chkdel="${c.id}">🗑 Видалити</button></div>`:""}`}</div>`).join("")}
    ${mv?"":`<div class="row" style="flex-wrap:nowrap"><input id="ck-${t.id}" data-ckadd="${t.id}" placeholder="Новий чекпоінт" style="flex:1"><button class="btn sm" type="button" data-chkadd="${t.id}">Додати</button></div>`}</div>`;
}
function editor(t){
  if(editId!==t.id){
    const rec=recurLabel(t);
    const due=t.due?fmt(t.due)+(t.due_time?" "+hm(t.due_time):""):"не вказано";
    return `<div class="edit">
    <div class="row full" style="justify-content:space-between"><label class="row" style="gap:6px;font-size:14px;color:var(--muted)">Статус <select id="v-status-${t.id}" data-vstatus="${t.id}" style="width:auto">${opts(Object.entries(STATUS),t.status)}</select></label><span class="head-icons"><button class="icon-btn" type="button" data-copylink="${t.num}" title="Скопіювати посилання на задачу" aria-label="Скопіювати посилання">🔗</button>${focusNum?"":`<a class="icon-btn" href="#t/${t.num}" target="_blank" rel="noopener" title="Відкрити в окремому вікні" aria-label="Відкрити в окремому вікні">⧉</a>`}</span></div>
    <div class="full" style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:14px"><span class="meta">Виконавець</span><span>${esc(nameOf(t.owner_id))}</span><span class="meta">Контролер</span><span>${t.controller_id?esc(nameOf(t.controller_id)):"—"}</span><span class="meta">Проєкт</span><span>${t.project?`<button type="button" class="plink" data-ptasks="${esc(t.project)}" title="Відкрити задачі проєкту">${esc(t.project)}</button>`:"—"}</span>${(t.tags||[]).length?`<span class="meta">Теги</span><span class="row" style="gap:4px">${tagChips(t)}</span>`:""}<span class="meta">Термін</span><span>${esc(due)}${rec?" · "+esc(rec):""}</span></div>
    ${t.note?`<div class="full" style="font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--sunk);border-radius:8px;padding:8px 10px">${linkify(t.note)}</div>`:""}
    ${checksBlock(t)}
    ${feedBlock(t)}
  </div>`;
  }
  const projOpts=projects.filter(p=>p.status!=="done"||p.name===t.project).map(p=>[p.name,p.name+(p.status==="done"?" (закритий)":"")]);
  return `<div class="edit">
    <h3 class="full" style="margin:0;font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Редагування задачі</h3>
    <label class="f full">Назва<textarea id="e-title" class="title-in" rows="1">${esc(t.title)}</textarea></label>
    <label class="f">Статус<select id="e-status">${opts(Object.entries(STATUS),t.status)}</select></label>
    <label class="f">Виконавець<select id="e-owner">${peopleOpts(t.owner_id)}</select></label>
    <label class="f">Контролер<select id="e-ctl"><option value="">— немає</option>${peopleOpts(t.controller_id)}</select></label>
    <label class="f">Проєкт<select id="e-project">${opts(projOpts,t.project)}</select></label>
    <label class="f">Теги (через кому)<input id="e-tags" list="tagList" value="${esc((t.tags||[]).join(", "))}" placeholder="фінанси, оплата"></label>
    ${recurFields("e",t)}
    <label class="f full">Нотатки (опис, контекст)<textarea id="e-note" rows="2">${esc(t.note||"")}</textarea></label>
    <div class="row full"><button class="btn primary" type="button" data-act="save">Зберегти</button><button class="btn ghost" type="button" data-act="cancel">Скасувати</button><span style="flex:1"></span><button class="btn danger ghost" type="button" data-act="del">Видалити</button></div>
  </div>`;
}
function render(){
  if((reorder||ckMove||drag)&&!render.force)return;
  renderStats();renderProjHead();
  if(focusNum){const t=tasks.find(x=>x.num===focusNum);
    if(!t){$("#board").innerHTML=`<div class="row"><button class="btn ghost sm" type="button" data-unfocus>← Усі задачі</button></div><div class="empty">${tasks.length?`Задачу #${focusNum} не знайдено або у вас немає до неї доступу.`:"Завантаження…"}</div>`;return}
    openId=t.id;if(history[t.id]===undefined&&!render.hl?.[t.id]){(render.hl??={})[t.id]=1;loadHistory(t.id)}
    document.title=`#${t.num} ${t.title.slice(0,60)} — Пульт задач`;
    $("#board").innerHTML=`<div class="row"><button class="btn ghost sm" type="button" data-unfocus>← Усі задачі</button></div><div class="list">${card(t)}</div>`;
    document.querySelectorAll(".edit textarea").forEach(autosize);const f=document.getElementById("feed-"+t.id);if(f)f.scrollTop=f.scrollHeight;return}
  const qq=q.trim().toLowerCase();
  let list=tasks.filter(t=>(showDone||t.status!=="done"||filter)&&(!filter||FILTERS[filter].f(t))&&(!fPerson||t.owner_id===fPerson||t.controller_id===fPerson)&&(!fProject||t.project===fProject)&&(!fTag||(t.tags||[]).includes(fTag))&&(!qq||[t.title,t.note,nameOf(t.owner_id),nameOf(t.controller_id),t.project,"#"+t.num,...(t.tags||[]).map(x=>"#"+x),...(checks[t.id]||[]).map(c=>c.title)].join(" ").toLowerCase().includes(qq)));
  const rank={overdue:0,today:1,soon:2,none:3,ok:4,done:5};
  if(sortMode==="manual"||reorder)list.sort((a,b)=>(a.pos??1e12)-(b.pos??1e12)||a.num-b.num);
  else list.sort((a,b)=>rank[dueState(a)]-rank[dueState(b)]||(a.due||"9").localeCompare(b.due||"9")||a.num-b.num);
  const key=view==="owner"?t=>nameOf(t.owner_id):t=>t.project||"—";
  const order=view==="owner"?team.map(m=>m.name):projects.map(p=>p.name);
  const groups={};list.forEach(t=>(groups[key(t)]??=[]).push(t));
  const names=Object.keys(groups).sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  if(!names.length){$("#board").innerHTML=`<div class="empty">${tasks.length?"Нічого не знайдено за цим фільтром.":"Задач ще немає."}</div>`;return}
  $("#board").classList.toggle("reo",reorder);
  $("#board").innerHTML=(reorder?`<div class="reobar"><span>↕ Перетягуйте задачі за ≡ у межах групи. Порядок збережеться після «Зафіксувати».</span><button class="btn primary sm" type="button" data-reosave>Зафіксувати</button><button class="btn ghost sm" type="button" data-reocancel>Скасувати</button></div>`:"")+names.map(n=>{const g=groups[n],open=g.filter(t=>t.status!=="done"),bad=open.filter(t=>dueState(t)==="overdue").length;
    const gm=view==="owner"?team.find(m=>m.name===n):null;
    return `<section class="group"><div class="group-head"><h2 class="row" style="gap:8px">${gm?ava(gm,"sm"):""}${esc(n)}</h2><div class="row"><span class="meta">${open.length} відкр.${bad?` · ${bad} простр.`:""}</span>${view==="owner"&&open.length?`<button class="btn ghost sm" type="button" data-remind="${esc(n)}">Нагадування</button>`:""}${view==="owner"&&gm?`<button class="btn ghost sm" type="button" data-addfor="${gm.id}">+ задача</button>`:view==="project"?`<button class="btn ghost sm" type="button" data-addin="${esc(n)}">+ задача</button>`:""}</div></div><div class="list">${g.map(card).join("")}</div></section>`}).join("");
  document.querySelectorAll(".edit textarea").forEach(autosize);
  const f=openId&&document.getElementById("feed-"+openId);if(f)f.scrollTop=f.scrollHeight;
}
function renderFilters(){
  const vis=new Set(tasks.flatMap(t=>[t.owner_id,t.controller_id]).filter(Boolean)),pv=new Set(tasks.map(t=>t.project));
  const op=tasks.filter(t=>t.status!=="done");
  const pc=id=>op.filter(t=>t.owner_id===id||t.controller_id===id).length, prc=n=>op.filter(t=>t.project===n).length;
  $("#fPerson").innerHTML=`<option value="">Усі люди (${op.length})</option>`+opts(team.filter(m=>vis.has(m.id)).map(m=>[m.id,`${m.name} (${pc(m.id)})`]),fPerson);
  const tg=allTags();
  $("#fTag").innerHTML=`<option value="">Усі теги</option>`+opts(tg.map(g=>[g,`#${g} (${op.filter(t=>(t.tags||[]).includes(g)).length})`]),fTag);$("#fTag").hidden=!tg.length&&!fTag;
  $("#tagList").innerHTML=tg.map(g=>`<option value="${esc(g)}">`).join("");
  $("#fProject").innerHTML=`<option value="">Усі проєкти (${op.length})</option>`+opts(projects.filter(p=>pv.has(p.name)).map(p=>[p.name,`${p.name} (${prc(p.name)})`]),fProject);
}
$("#fPerson").addEventListener("change",e=>{fPerson=e.target.value;render()});
$("#fTag").addEventListener("change",e=>{fTag=e.target.value;render()});
$("#fProject").addEventListener("change",e=>{fProject=e.target.value;render()});
function pendHtml(id){return (pend[id]||[]).map((f,i)=>`<span>📎 ${esc(f.name)} <button class="btn ghost sm" type="button" data-unpend="${id}:${i}" aria-label="Прибрати" style="padding:0 4px">×</button></span>`).join("")}
function addPend(id,files){if(!files.length)return;(pend[id]??=[]).push(...files);const el=document.getElementById("pend-"+id);if(el)el.innerHTML=pendHtml(id)}
document.addEventListener("change",e=>{const f=e.target.closest("[data-files]");if(f){addPend(f.dataset.files,[...f.files]);f.value=""}});
document.addEventListener("paste",e=>{const ta=e.target;if(!ta.id?.startsWith("c-"))return;const files=[...(e.clipboardData?.files||[])];if(files.length){e.preventDefault();addPend(ta.id.slice(2),files.map((f,i)=>f.name&&f.name!=="image.png"?f:new File([f],`screenshot_${Date.now()}_${i}.png`,{type:f.type})))}});
function reminderText(name,list){
  const lines=list.map(t=>{const ds=dueState(t);return `#${t.num} ${t.title} — ${ds==="none"?"термін не узгоджено":ds==="overdue"?`термін ${fmt(t.due)}, прострочено`:`термін ${fmt(t.due)}${t.due_time?" "+hm(t.due_time):""}`}`});
  return `${name.split(" ")[0]}, звірка задач на ${fmt(today())}:\n${lines.join("\n")}\n\nВідпиши по кожній: статус і наступний крок (або в боті: /upd N текст, /done N).`;
}
async function copy(text){try{await navigator.clipboard.writeText(text);toast("Скопійовано — вставте в Telegram")}catch(e){window.prompt("Скопіюйте текст:",text)}}
async function addComment(id){
  const box=document.getElementById("c-"+id);const body=box.value.trim();const files=pend[id]||[];if(!body&&!files.length)return;
  box.disabled=true;if(files.length)toast("Завантажую файли…");
  const attachments=files.length?await uploadFiles("t/"+id,files):[];
  const mentions=team.filter(m=>body.includes("@"+m.name)).map(m=>m.id);
  const {error}=await sb.from("task_updates").insert({task_id:id,author_id:me?.id||null,kind:"comment",body:body||"",attachments,mentions});
  box.disabled=false;
  if(error){toast("Не надіслано: "+error.message);return}
  pend[id]=[];box.value="";autosize(box);await loadHistory(id);const pe=document.getElementById("pend-"+id);if(pe)pe.innerHTML="";
  const t=tasks.find(x=>x.id===id);toast(t?.recur!=="none"?"Звіт зараховано":mentions.length?"Коментар додано, згаданим надіслано в Telegram":"Коментар додано");
}

document.addEventListener("click",async e=>{
  if(e.target.closest("[data-reosave]")){await saveReorder();return}
  if(e.target.closest("[data-reocancel]")){reorder=false;renderNow();return}
  if(reorder&&e.target.closest("#board .card")){return}
  const cl2=e.target.closest("[data-copylink]");if(cl2){copyLink(+cl2.dataset.copylink);return}
  if(e.target.closest("[data-unfocus]")){window.history.pushState("","",location.pathname+location.search);applyHash();return}
  const pm=e.target.closest("[data-projmenu]");if(pm){projMenu=projMenu===pm.dataset.projmenu?null:pm.dataset.projmenu;ckMenu=null;render();return}
  const pg=e.target.closest("[data-peditgo]");if(pg){projMenu=null;editProj=pg.dataset.peditgo;projF="all";document.querySelectorAll("[data-pflt]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.pflt==="all"));document.querySelector('[data-tab="projects"]').click();renderProjects();document.querySelector(`[data-pn="${CSS.escape(editProj)}"]`)?.scrollIntoView({behavior:"smooth",block:"center"});return}
  const km=e.target.closest("[data-ckmenu]");if(km){ckMenu=ckMenu===+km.dataset.ckmenu?null:+km.dataset.ckmenu;projMenu=null;render();return}
  const ks=e.target.closest("[data-ckmovestart]");if(ks){ckMove=ks.dataset.ckmovestart;ckMenu=null;renderNow();return}
  const kd=e.target.closest("[data-ckmovedone]");if(kd){await saveCkOrder(kd.dataset.ckmovedone);return}
  if(e.target.closest("[data-ckmovecancel]")){ckMove=null;renderNow();return}
  if((ckMenu||projMenu)&&!e.target.closest(".pop")){ckMenu=null;projMenu=null;render();if(e.target.closest(".card-head"))return}
  const ec=e.target.closest("[data-editcard]");if(ec){openId=ec.dataset.editcard;editId=openId;loadHistory(openId);render();document.getElementById("e-title")?.focus();return}
  const tgf=e.target.closest("[data-tagf]");if(tgf){fTag=tgf.dataset.tagf;renderFilters();document.querySelector('[data-tab="tasks"]').click();render();toast("Фільтр: #"+fTag);return}
  const tab=e.target.closest("[data-tab]");if(tab){document.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-pressed",b===tab));["tasks","projects","tg","team"].forEach(k=>document.getElementById("tab"+k[0].toUpperCase()+k.slice(1)).hidden=tab.dataset.tab!==k);return}
  const up=e.target.closest("[data-unpend]");if(up){const [id,i]=up.dataset.unpend.split(":");pend[id].splice(+i,1);document.getElementById("pend-"+id).innerHTML=pendHtml(id);return}
  const tf=e.target.closest("[data-tf]");if(tf){teamF=tf.dataset.tf;document.querySelectorAll("[data-tf]").forEach(b=>b.setAttribute("aria-pressed",b===tf));renderTeam();return}
  const at=e.target.closest("[data-attach]");if(at){pick=pick===at.dataset.attach?null:at.dataset.attach;pkSel=null;renderTg();if(pick)document.getElementById("pk-q")?.focus();return}
  const ag=e.target.closest("[data-attgo]");if(ag){await attachToTask(ag.dataset.attgo);return}
  const cl=e.target.closest("[data-close]");if(cl){document.getElementById(cl.dataset.close).hidden=true;addSource=null;return}
  const s=e.target.closest(".stat");if(s){filter=filter===s.dataset.f?null:s.dataset.f;render();return}
  const v=e.target.closest("[data-view]");if(v){view=v.dataset.view;document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",b===v));render();return}
  const r=e.target.closest("[data-remind]");if(r){const n=r.dataset.remind;copy(reminderText(n,tasks.filter(t=>nameOf(t.owner_id)===n&&t.status!=="done")));return}
  const ai=e.target.closest("[data-addin]");if(ai){openAdd({project:ai.dataset.addin});return}
  const pt=e.target.closest("[data-ptasks]");if(pt&&pt.dataset.ptasks){if(focusNum){window.history.pushState("","",location.pathname+location.search);focusNum=null;document.body.classList.remove("focus");document.title="Пульт задач"}projMenu=null;phEdit=false;openId=null;editId=null;window.scrollTo({top:0,behavior:"smooth"});view="project";document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view==="project"));fProject=pt.dataset.ptasks;fPerson="";document.querySelector('[data-tab="tasks"]').click();renderFilters();render();return}
  const pe=e.target.closest("[data-pedit]");if(pe){editProj=editProj===pe.dataset.pedit?null:pe.dataset.pedit;renderProjects();return}
  const ps=e.target.closest("[data-psave]");if(ps){await saveProject(ps.dataset.psave);return}
  const mk=e.target.closest("[data-mk]");if(mk){const m=msgs.find(x=>String(x.id)===mk.dataset.mk);openAdd({title:m.text.slice(0,500),project:chats[m.chat_id]?.project,msg:m});return}
  const rv=e.target.closest("[data-rev]");if(rv){const id=rv.dataset.rev;const m=msgs.find(x=>String(x.id)===id);await sb.from("tg_messages").update({reviewed:!m.reviewed}).eq("id",id);m.reviewed=!m.reviewed;renderTg();return}
  const a=e.target.closest("[data-act]");
  if(a){const id=a.closest(".card").dataset.id,t=tasks.find(x=>x.id===id);
    if(a.dataset.act==="comment"){await addComment(id);return}
    if(a.dataset.act==="close"){openId=null;editId=null;render();return}
    if(a.dataset.act==="edit"){editId=id;render();document.getElementById("e-title")?.focus();return}
    if(a.dataset.act==="cancel"){editId=null;render();return}
    if(a.dataset.act==="del"){if(a.dataset.sure){const {error}=await sb.from("tasks").delete().eq("id",id);if(error)toast("Не видалено: "+error.message);else{openId=null;toast("Видалено")}}else{a.dataset.sure="1";a.textContent="Точно видалити?"}return}
    if(a.dataset.act==="save"){
      const g=k=>document.getElementById("e-"+k).value;
      const patch={status:g("status"),owner_id:g("owner"),controller_id:g("ctl")||null,project:g("project"),title:g("title").trim(),note:g("note")||null,tags:parseTags(g("tags")),...readRecur("e")};
      if(!patch.title){toast("Назва не може бути порожньою");return}
      const {error}=await sb.from("tasks").update(patch).eq("id",id);
      if(error){toast("Не збережено: "+error.message);return}
      const notes=[];
      if(patch.status!==t.status)notes.push("Статус: "+STATUS[patch.status]);
      /* зміну терміну пише в історію сама база (тригер task_due_history) — з будь-якого місця */
      if(patch.recur!==t.recur||patch.recur_every!==t.recur_every)notes.push("Повторення: "+(patch.recur==="none"?"разова":recurLabel(patch)));
      if(patch.owner_id!==t.owner_id)notes.push("Виконавець: "+nameOf(patch.owner_id));
      if((patch.controller_id||"")!==(t.controller_id||""))notes.push("Контролер: "+(patch.controller_id?nameOf(patch.controller_id):"знято"));
      if(patch.project!==t.project)notes.push("Проєкт: "+patch.project);
      if((patch.tags||[]).join()!==(t.tags||[]).join())notes.push("Теги: "+(patch.tags.length?patch.tags.map(x=>"#"+x).join(" "):"знято"));
      if(notes.length)await sb.from("task_updates").insert({task_id:id,author_id:me?.id||null,kind:"status",body:notes.join(" · ")});
      editId=null;toast("Збережено");loadAll();
    }
    return}
  const h=e.target.closest(".card-head");if(h&&focusNum)return;if(h){const id=h.parentElement.dataset.id;openId=openId===id?null:id;editId=null;if(openId)loadHistory(openId);render()}
});
document.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ")&&e.target.classList?.contains("card-head")){e.preventDefault();e.target.click()}
  if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)&&e.target.id?.startsWith("c-")){e.preventDefault();addComment(e.target.id.slice(2))}
});
$("#q").addEventListener("input",e=>{q=e.target.value;render()});
$("#showDone").addEventListener("change",e=>{showDone=e.target.checked;render()});
$("#showRev").addEventListener("change",e=>{showRev=e.target.checked;renderTg()});

/* ---------- згадки @ ---------- */
document.addEventListener("input",e=>{
  const ta=e.target;if(!ta.id?.startsWith("c-"))return;const id=ta.id.slice(2),box=document.getElementById("ment-"+id);if(!box)return;
  const m=ta.value.slice(0,ta.selectionStart).match(/@([^\s@]{0,20})$/u);
  if(!m){box.hidden=true;return}
  const qq=m[1].toLowerCase(),list=team.filter(x=>x.active&&x.name.toLowerCase().includes(qq)).slice(0,8);
  box.innerHTML=list.map(x=>`<button class="btn ghost sm" type="button" data-mention="${x.id}" data-mfor="${id}">${ava(x,"sm")} ${esc(x.name)}</button>`).join("");box.hidden=!list.length;
});
document.addEventListener("click",async e=>{
  const mb=e.target.closest("[data-mention]");if(mb){const id=mb.dataset.mfor,ta=document.getElementById("c-"+id),mm=team.find(x=>x.id===mb.dataset.mention);
    const pos=ta.selectionStart,before=ta.value.slice(0,pos).replace(/@([^\s@]{0,20})$/u,"@"+mm.name+" ");ta.value=before+ta.value.slice(pos);ta.focus();ta.selectionStart=ta.selectionEnd=before.length;document.getElementById("ment-"+id).hidden=true;return}
  const ca=e.target.closest("[data-chkadd]");if(ca){const tid=ca.dataset.chkadd,inp=document.getElementById("ck-"+tid),title=inp.value.trim();if(!title)return;
    const {error}=await sb.from("task_checks").insert({task_id:tid,title,sort:(checks[tid]||[]).length});if(error){toast("Не додано: "+error.message);return}inp.value="";await reloadChecks();return}
  const ce=e.target.closest("[data-chkedit]");if(ce){ckMenu=null;ckEdit=+ce.dataset.chkedit;render();const i=document.getElementById("ckin-"+ckEdit);if(i){i.focus();i.select()}return}
  const cs=e.target.closest("[data-chksave]");if(cs){await saveCk(+cs.dataset.chksave);return}
  if(e.target.closest("[data-chkcancel]")){ckEdit=null;render();return}
  const cm=e.target.closest("[data-chkmove]");if(cm){const [id,dir]=cm.dataset.chkmove.split(":").map(Number);const c0=Object.values(checks).flat().find(c=>c.id===id);if(!c0)return;
    const l=checks[c0.task_id],i=l.findIndex(c=>c.id===id),j=i+dir;if(j<0||j>=l.length)return;[l[i],l[j]]=[l[j],l[i]];render();
    await Promise.all(l.map((c,k)=>c.sort===k?null:sb.from("task_checks").update({sort:k}).eq("id",c.id)));l.forEach((c,k)=>c.sort=k);return}
  const cd=e.target.closest("[data-chkdel]");if(cd){ckMenu=null;await sb.from("task_checks").delete().eq("id",cd.dataset.chkdel);await reloadChecks();return}
  const af=e.target.closest("[data-addfor]");if(af){openAdd({owner:af.dataset.addfor});return}
  const pl=e.target.closest("[data-pflt]");if(pl){projF=pl.dataset.pflt;document.querySelectorAll("[data-pflt]").forEach(b=>b.setAttribute("aria-pressed",b===pl));renderProjects();return}
  const pc=e.target.closest("[data-pclose]");if(pc){const nm=pc.dataset.pclose,p=projects.find(x=>x.name===nm),st=p.status==="done"?"active":"done";
    const {error}=await sb.from("task_projects").update({status:st}).eq("name",nm);if(error){toast("Не змінено: "+error.message);return}toast(st==="done"?"Проєкт закрито — нові задачі в нього не створюються":"Проєкт відкрито знову");loadAll();return}
  const pp=e.target.closest("[data-pkpick]");if(pp){pkSel=pp.dataset.pkpick;document.querySelectorAll("[data-pkpick]").forEach(b=>b.setAttribute("aria-pressed",b===pp));return}
  const pn=e.target.closest("[data-pknew]");if(pn){const m=msgs.find(x=>String(x.id)===pn.dataset.pknew);pick=null;renderTg();openAdd({title:m.text.slice(0,500),project:chats[m.chat_id]?.project,msg:m});return}
});
document.addEventListener("change",async e=>{
  const c=e.target.closest("[data-chk]");if(c){const done=c.checked;await sb.from("task_checks").update({done,done_at:done?new Date().toISOString():null,done_by:done?me?.id:null}).eq("id",c.dataset.chk);await reloadChecks();return}
  const vs=e.target.closest("[data-vstatus]");if(vs){const id=vs.dataset.vstatus,t=tasks.find(x=>x.id===id),st=vs.value;
    const {error}=await sb.from("tasks").update({status:st}).eq("id",id);if(error){toast("Не змінено: "+error.message);return}
    await sb.from("task_updates").insert({task_id:id,author_id:me?.id||null,kind:"status",body:"Статус: "+STATUS[st]});
    toast(t.recur!=="none"&&st==="done"?"Період закрито, дедлайн перенесено":"Статус: "+STATUS[st]);await loadAll();loadHistory(id);return}
});
async function saveCk(id){const i=document.getElementById("ckin-"+id);const title=i?.value.trim();if(!title){toast("Порожній чекпоінт — видаліть його кнопкою ×");return}
  const {error}=await sb.from("task_checks").update({title}).eq("id",id);if(error){toast("Не збережено: "+error.message);return}ckEdit=null;await reloadChecks()}
document.addEventListener("keydown",async e=>{
  const ci=e.target.closest?.("[data-ckinput]");if(ci){if(e.key==="Enter"){e.preventDefault();await saveCk(+ci.dataset.ckinput)}if(e.key==="Escape"){ckEdit=null;render()}return}
  const ca=e.target.closest?.("[data-ckadd]");if(ca&&e.key==="Enter"){e.preventDefault();document.querySelector(`[data-chkadd="${ca.dataset.ckadd}"]`).click()}
});
async function reloadChecks(){const ck=await sb.from("task_checks").select("*").order("sort").order("id");checks={};(ck.data||[]).forEach(c=>(checks[c.task_id]??=[]).push(c));render()}
$("#teamQ").addEventListener("input",e=>{teamQ=e.target.value;renderTeam()});
$("#tgChat").addEventListener("change",e=>{tgChat=e.target.value;renderTg()});

let addSource=null;
function openAdd(pre={}){
  $("#projForm").hidden=true;const f=$("#addForm");f.hidden=false;addSource=pre.msg||null;
  const ctxProj=pre.project||(pre.owner?null:fProject)||(view==="project"&&q&&projects.find(p=>p.name===q)?.name)||"Інше";
  $("#nProject").innerHTML=opts(activeProjects().map(p=>[p.name,p.name]),activeProjects().some(p=>p.name===ctxProj)?ctxProj:"Інше");
  $("#nOwner").innerHTML=peopleOpts(pre.owner||(pre.project?null:fPerson)||(canManage()?team.find(m=>m.name==="Катя")?.id:me?.id));
  $("#nCtl").innerHTML=`<option value="">— немає</option>`+peopleOpts("");
  $("#nStatus").innerHTML=opts(Object.entries(STATUS),"todo");
  $("#nTags").value=pre.tags||fTag||"";
  $("#nRecurBox").innerHTML=recurFields("n",{});
  if(pre.title)$("#nTitle").value=pre.title;
  window.scrollTo({top:0,behavior:"smooth"});$("#nTitle").focus();autosize($("#nTitle"));
}
$("#addBtn").addEventListener("click",()=>{$("#addForm").hidden?openAdd():$("#addForm").hidden=true});
$("#addForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const title=$("#nTitle").value.trim();if(!title)return;
  const t={title,project:$("#nProject").value,owner_id:$("#nOwner").value,controller_id:$("#nCtl").value||null,tags:parseTags($("#nTags").value),status:$("#nStatus").value,created_by:me?.id||null,
    source:addSource?"telegram":"pult",source_chat_id:addSource?.chat_id||null,source_message_id:addSource?.message_id||null,...readRecur("n")};
  const {data,error}=await sb.from("tasks").insert(t).select("id,num").single();
  if(error){toast("Не додано: "+error.message);return}
  await sb.from("task_updates").insert({task_id:data.id,author_id:me?.id||null,kind:"created",body:"Задачу створено"+(addSource?" з Telegram":"")});
  const cks=$("#nChecks").value.split("\n").map(x=>x.trim()).filter(Boolean);
  if(cks.length)await sb.from("task_checks").insert(cks.map((title,i)=>({task_id:data.id,title,sort:i})));
  if(addSource){
    const ch=chats[addSource.chat_id]?.title||"чат";
    await sb.from("task_updates").insert({task_id:data.id,author_id:null,kind:"note",body:`💬 ${addSource.from_name} у «${ch}», ${fmtDT(addSource.sent_at)}:\n${addSource.text||""}`,attachments:(addSource.attachments||[]).filter(a=>a.path)});
    await sb.from("tg_messages").update({reviewed:true,task_id:data.id}).eq("id",addSource.id);
  }
  e.target.reset();e.target.hidden=true;addSource=null;toast(`Задачу #${data.num} додано`);loadAll();
});


/* ---------- порядок: перетягування (миша і палець) ---------- */
document.addEventListener("pointerdown",e=>{const h=e.target.closest("[data-drag]");if(!h)return;const it=h.closest("[data-dragitem]");if(!it)return;
  e.preventDefault();drag={it,box:it.parentElement};it.classList.add("dragging");try{h.setPointerCapture(e.pointerId)}catch(_){}});
document.addEventListener("pointermove",e=>{if(!drag)return;e.preventDefault();const y=e.clientY;
  const items=[...drag.box.children].filter(x=>x.hasAttribute("data-dragitem"));const sib=items.filter(x=>x!==drag.it);
  const nx=sib.find(x=>{const r=x.getBoundingClientRect();return y<r.top+r.height/2});
  const ref=nx||(sib.length?sib[sib.length-1].nextSibling:null);
  if(ref!==drag.it&&drag.it.nextSibling!==ref)drag.box.insertBefore(drag.it,ref);
  if(y<70)window.scrollBy(0,-14);else if(y>innerHeight-70)window.scrollBy(0,14);},{passive:false});
const endDrag=()=>{if(drag){drag.it.classList.remove("dragging");drag=null}};
document.addEventListener("pointerup",endDrag);document.addEventListener("pointercancel",endDrag);
document.addEventListener("touchmove",e=>{if(drag)e.preventDefault()},{passive:false});
$("#fSort").addEventListener("change",e=>{setSort(e.target.value);renderNow()});
$("#reoBtn").addEventListener("click",()=>{if(reorder)return;reorder=true;openId=null;editId=null;setSort("manual");$("#fSort").value="manual";renderNow();$("#board").scrollIntoView({behavior:"smooth",block:"start"})});
async function saveReorder(){
  const upd=[];
  document.querySelectorAll("#board .list").forEach(l=>{
    const ids=[...l.children].filter(x=>x.hasAttribute("data-dragitem")).map(x=>x.dataset.id);
    const ps=ids.map(id=>tasks.find(t=>t.id===id)?.pos??1e12).sort((a,b)=>a-b);
    for(let i=1;i<ps.length;i++)if(ps[i]<=ps[i-1])ps[i]=ps[i-1]+0.001;
    ids.forEach((id,i)=>{const t=tasks.find(x=>x.id===id);if(t&&t.pos!==ps[i]){t.pos=ps[i];upd.push(sb.from("tasks").update({pos:ps[i]}).eq("id",id))}});
  });
  reorder=false;const r=await Promise.all(upd);const err=r.find(x=>x.error);
  toast(err?"Частину не збережено: "+err.error.message:upd.length?"Порядок збережено":"Порядок не змінився");renderNow();
}
async function saveCkOrder(tid){
  const box=document.getElementById("cklist-"+tid);const ids=box?[...box.children].map(x=>+x.dataset.ckid):[];
  const l=checks[tid]||[];const upd=[];
  ids.forEach((id,k)=>{const c=l.find(x=>x.id===id);if(c&&c.sort!==k){c.sort=k;upd.push(sb.from("task_checks").update({sort:k}).eq("id",id))}});
  l.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
  ckMove=null;const r=await Promise.all(upd);const err=r.find(x=>x.error);
  toast(err?"Не збережено: "+err.error.message:upd.length?"Порядок чекпоінтів збережено":"Порядок не змінився");renderNow();
}

/* ---------- окреме вікно задачі і посилання ---------- */
const taskUrl=n=>location.origin+location.pathname+"#t/"+n;
async function copyLink(n){const u=taskUrl(n);try{await navigator.clipboard.writeText(u);toast("Посилання на #"+n+" скопійовано")}catch(e){window.prompt("Скопіюйте посилання:",u)}}
function applyHash(){
  const m=location.hash.match(/^#t\/(\d+)/);focusNum=m?+m[1]:null;document.body.classList.toggle("focus",!!focusNum);
  if(focusNum){reorder=false;document.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tab==="tasks"));["tasks","projects","tg","team"].forEach(k=>document.getElementById("tab"+k[0].toUpperCase()+k.slice(1)).hidden=k!=="tasks");window.scrollTo(0,0)}
  else{openId=null;editId=null;document.title="Пульт задач"}
  if(booted)renderNow();
}
window.addEventListener("hashchange",applyHash);
applyHash();

/* ---------- картка проєкту над задачами ---------- */
function renderProjHead(){
  const el=$("#projHead");const p=fProject&&!focusNum&&projects.find(x=>x.name===fProject);
  if(!p){el.hidden=true;el.innerHTML="";phEdit=false;return}
  el.hidden=false;const files=(p.attachments||[]).filter(Boolean);
  if(files.some(a=>a.path&&!signed[a.path])&&!renderProjHead.busy){renderProjHead.busy=1;signPaths(projects).then(()=>{renderProjHead.busy=0;if(!phEdit)renderProjHead()})}
  const pt=tasks.filter(t=>t.project===p.name),open=pt.filter(t=>t.status!=="done"),bad=open.filter(t=>dueState(t)==="overdue").length;
  if(phEdit){el.innerHTML=`<h3 class="full" style="margin:0;font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Редагування проєкту</h3>
    <label class="f">Назва<input id="ph-name" value="${esc(p.name)}" maxlength="80"></label>
    <label class="f">Відповідальний<select id="ph-owner"><option value="">—</option>${peopleOpts(p.owner_id)}</select></label>
    <label class="f">Стан<select id="ph-status">${opts(Object.entries(PSTATUS),p.status)}</select></label>
    <label class="f full">Опис і мета<textarea id="ph-desc" rows="3">${esc(p.description||"")}</textarea></label>
    ${files.length?`<div class="full row" style="gap:6px"><span class="meta">Файли:</span>${files.map((a,i)=>`<span class="tag" style="gap:4px">📎 ${esc(a.name)} <button type="button" class="icon-btn" data-phdelf="${i}" aria-label="Прибрати файл" style="line-height:18px;padding:0 5px">×</button></span>`).join("")}</div>`:""}
    <div class="row full"><button class="btn primary sm" type="button" data-phsave>Зберегти</button><button class="btn ghost sm" type="button" data-phcancel>Скасувати</button><label class="btn ghost sm filebtn">📎 Додати файли<input type="file" multiple data-pfiles></label></div>`;return}
  el.innerHTML=`<div class="full row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap"><div><span class="meta">Проєкт</span><h2>${esc(p.name)}${p.status!=="active"?` <span class="tag">${PSTATUS[p.status]}</span>`:""}</h2></div><button class="icon-btn" type="button" data-phclose title="Прибрати фільтр проєкту" aria-label="Закрити">✕</button></div>
    <div class="full meta">Відповідальний: ${esc(p.owner_id?nameOf(p.owner_id):"не призначено")} · ${open.length} відкр.${bad?` · <b style="color:var(--bad)">${bad} простр.</b>`:""} · ${pt.length-open.length} вик.</div>
    ${p.description?`<div class="full" style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px">${linkify(p.description)}</div>`:""}
    ${files.length?`<div class="full">${attsHtml(files)}</div>`:""}
    <div class="row full">${p.status==="done"?"":`<button class="btn primary sm" type="button" data-addin="${esc(p.name)}">+ Додати задачу</button>`}<button class="btn sm" type="button" data-phedit>✎ Редагувати проєкт</button><label class="btn ghost sm filebtn">📎 Додати файли<input type="file" multiple data-pfiles></label></div>`;
}
async function setProjFiles(name,list){
  const {error}=await sb.from("task_projects").update({attachments:list}).eq("name",name);
  if(error){toast("Не збережено: "+error.message);return false}
  const p=projects.find(x=>x.name===name);if(p)p.attachments=list;await signPaths(projects);renderProjHead();return true;
}
document.addEventListener("change",async e=>{const f=e.target.closest("[data-pfiles]");if(!f)return;const files=[...f.files];f.value="";if(!files.length||!fProject)return;
  const p=projects.find(x=>x.name===fProject);toast("Завантажую файли…");
  const up=await uploadFiles("p/"+safeName(p.name),files);if(!up.length)return;
  if(await setProjFiles(p.name,[...(p.attachments||[]),...up]))toast(up.length===1?"Файл додано до проєкту":`Додано файлів: ${up.length}`)});
document.addEventListener("click",async e=>{
  if(e.target.closest("[data-phclose]")){fProject="";phEdit=false;renderFilters();render();return}
  if(e.target.closest("[data-phedit]")){phEdit=true;renderProjHead();$("#ph-name")?.focus();return}
  if(e.target.closest("[data-phcancel]")){phEdit=false;renderProjHead();return}
  const df=e.target.closest("[data-phdelf]");if(df){const p=projects.find(x=>x.name===fProject);const l=(p.attachments||[]).filter((_,i)=>i!==+df.dataset.phdelf);await setProjFiles(p.name,l);return}
  if(e.target.closest("[data-phsave]")){const old=fProject,name=$("#ph-name").value.trim();if(!name){toast("Назва не може бути порожньою");return}
    if(name!==old&&projects.some(p=>p.name.toLowerCase()===name.toLowerCase())){toast("Проєкт з такою назвою вже є");return}
    const {error}=await sb.from("task_projects").update({name,description:$("#ph-desc").value.trim()||null,owner_id:$("#ph-owner").value||null,status:$("#ph-status").value}).eq("name",old);
    if(error){toast("Не збережено: "+error.message);return}
    fProject=name;phEdit=false;toast("Проєкт збережено");await loadAll();return}
});
