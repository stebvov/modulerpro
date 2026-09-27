/* ---------- projects ---------- */
let editProj=null,tgFrom="",tgQ="",projQ="";
{const r=document.createElement("div");r.className="row";r.style.gap="8px";$("#tgChat").before(r);r.append($("#tgChat"));
 r.insertAdjacentHTML("beforeend",`<select id="tgFrom" aria-label="Автор" style="width:auto;max-width:100%"></select><input id="tgQ" type="search" placeholder="Пошук у повідомленнях: текст, автор, група" style="flex:1;min-width:200px">`);}
$("#projGrid").insertAdjacentHTML("beforebegin",`<input id="projQ" type="search" placeholder="Пошук: назва, опис, відповідальний" style="max-width:420px">`);
document.addEventListener("input",e=>{if(e.target.id==="tgQ"){tgQ=e.target.value;renderTg()}if(e.target.id==="projQ"){projQ=e.target.value;renderProjects()}});
document.addEventListener("change",e=>{if(e.target.id==="tgFrom"){tgFrom=e.target.value;renderTg()}});
$("#addProjBtn").addEventListener("click",()=>{$("#addForm").hidden=true;const f=$("#projForm");f.hidden=!f.hidden;if(!f.hidden){$("#pOwner").innerHTML=peopleOpts(me?.id);$("#pName").focus()}});
$("#projForm").addEventListener("submit",async e=>{
  e.preventDefault();const name=$("#pName").value.trim();if(!name)return;
  if(projects.some(p=>p.name.toLowerCase()===name.toLowerCase())){toast("Проєкт з такою назвою вже є");return}
  const {error}=await sb.from("task_projects").insert({name,description:$("#pDesc").value.trim()||null,owner_id:$("#pOwner").value||null,sort:projects.length});
  if(error){toast("Не створено: "+error.message);return}
  e.target.reset();e.target.hidden=true;toast("Проєкт створено");await loadAll();document.querySelector('[data-tab="projects"]').click();
});
async function saveProject(oldName){
  const k=CSS.escape(oldName);
  const g=f=>document.querySelector(`[data-pf="${f}"][data-pn="${k}"]`)?.value;
  const name=g("name").trim();if(!name){toast("Назва не може бути порожньою");return}
  const {error}=await sb.from("task_projects").update({name,description:g("desc").trim()||null,owner_id:g("owner")||null,status:g("status")}).eq("name",oldName);
  if(error){toast("Не збережено: "+error.message);return}
  editProj=null;toast("Проєкт збережено");loadAll();
}
function renderProjects(){
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
    return `<div class="pcard ${p.status}">
      <div class="row" style="justify-content:space-between"><h2><button type="button" class="plink" data-ptasks="${n}" style="text-decoration:none;color:inherit" title="Відкрити проєкт">${n}</button></h2>${p.status!=="active"?`<span class="tag">${PSTATUS[p.status]}</span>`:""}</div>
      ${p.description?`<p style="white-space:pre-wrap;overflow-wrap:anywhere">${linkify(p.description)}</p>`:""}${(p.attachments||[]).length?`<span class="meta">📎 файлів: ${p.attachments.length}</span>`:""}
      <span class="meta">Відповідальний: ${esc(p.owner_id?nameOf(p.owner_id):"не призначено")}</span>
      <div class="pnums"><span>${open.length} відкр.</span>${bad?`<span class="bad">${bad} простр.</span>`:""}<span style="color:var(--muted)">${done} вик.</span></div>
      <div class="row"><button class="btn sm" type="button" data-ptasks="${n}">Відкрити</button>${p.status==="done"?"":`<button class="btn ghost sm" type="button" data-addin="${n}">+ задача</button>`}<button class="btn ghost sm" type="button" data-pedit="${n}">Редагувати</button><button class="btn ghost sm" type="button" data-pclose="${n}">${p.status==="done"?"Відкрити знову":"Закрити проєкт"}</button></div>
    </div>`}).join("");
}

/* ---------- telegram ---------- */
function renderTg(){
  const fresh=msgs.filter(m=>!m.reviewed&&!String(m.text||"").startsWith("/")&&m.chat_id<0).length;
  $("#tgCount").textContent=fresh?`· ${fresh}`:"";
  const base=msgs.filter(m=>m.chat_id<0&&(showRev||!m.reviewed));
  const ids=[...new Set(msgs.filter(m=>m.chat_id<0).map(m=>String(m.chat_id)))];
  $("#tgChat").innerHTML=`<option value="">Усі групи (${base.length})</option>`+ids.map(id=>`<option value="${id}"${id===tgChat?" selected":""}>${esc(chats[id]?.title||id)} (${base.filter(m=>String(m.chat_id)===id).length})</option>`).join("");
  const inChat=base.filter(m=>!tgChat||String(m.chat_id)===tgChat);
  const authors=[...new Set(inChat.map(m=>m.from_name||"—"))].sort((a,b)=>a.localeCompare(b,"uk"));
  if(tgFrom&&!authors.includes(tgFrom))authors.unshift(tgFrom);
  $("#tgFrom").innerHTML=`<option value="">Усі автори (${inChat.length})</option>`+authors.map(a=>`<option value="${esc(a)}"${a===tgFrom?" selected":""}>${esc(a)} (${inChat.filter(m=>(m.from_name||"—")===a).length})</option>`).join("");
  const tq=tgQ.trim().toLowerCase();
  const list=inChat.filter(m=>(!tgFrom||(m.from_name||"—")===tgFrom)&&(!tq||[m.text,m.from_name,chats[m.chat_id]?.title,(m.attachments||[]).map(a=>a?.name).join(" ")].join(" ").toLowerCase().includes(tq)));
  $("#tgList").innerHTML=list.length?list.map(m=>{const ch=chats[m.chat_id],lt=m.task_id&&tasks.find(t=>t.id===m.task_id);return `<div class="msg ${m.reviewed?"rev":""}">
    <div class="chat-name">👥 ${esc(ch?.title||"чат")}${ch?.project?` <span class="tag proj">${esc(ch.project)}</span>`:""}</div>
    <div class="row"><b>${esc(m.from_name)}</b><span class="meta">${fmtDT(m.sent_at)}</span>${lt?`<span class="tag">→ #${lt.num}</span>`:""}</div>
    <p>${linkify(m.text)}</p>${attsHtml(m.attachments)}
    <div class="row"><button class="btn sm" type="button" data-mk="${m.id}">Зробити задачею</button><button class="btn sm" type="button" data-attach="${m.id}">Додати до задачі</button><button class="btn ghost sm" type="button" data-rev="${m.id}">${m.reviewed?"Повернути":"Переглянуто"}</button></div>
    ${pick===String(m.id)?pickerHtml(m):""}
  </div>`}).join(""):(tgFrom||tq)?`<div class="empty">Нічого не знайдено за цим фільтром.</div>`:`<div class="empty">Нових повідомлень немає. Додайте бота в робочі групи — повідомлення зʼявляться тут.</div>`;
}

function pkMatches(v,proj){
  const words=v.toLowerCase().replace(/^#/,"").split(/\s+/).filter(Boolean);
  return tasks.filter(t=>t.status!=="done").filter(t=>{const hay=["#"+t.num,t.num,t.title,nameOf(t.owner_id),t.controller_id?nameOf(t.controller_id):"",t.project].join(" ").toLowerCase();return words.every(w=>hay.includes(w))})
    .sort((a,b)=>(b.project===proj)-(a.project===proj)||a.num-b.num).slice(0,30);
}
function pkList(m,v){const proj=chats[m.chat_id]?.project;const l=pkMatches(v,proj);
  return l.length?l.map(t=>`<button type="button" class="btn ghost sm" data-pkpick="${t.id}" aria-pressed="${pkSel===t.id}" style="text-align:left;display:block;width:100%;white-space:normal"><span class="num">#${t.num}</span>${esc(t.title.slice(0,110))} <span class="meta">· ${esc(nameOf(t.owner_id))} · ${esc(t.project||"")}</span></button>`).join(""):`<span class="meta">Нічого не знайдено — створіть нову задачу.</span>`}
function pickerHtml(m){
  return `<div class="picker">
    <label class="f full">Знайти задачу<input id="pk-q" data-pkq="${m.id}" placeholder="#номер, слово з назви, людина або проєкт"></label>
    <div class="full" id="pk-res" style="display:flex;flex-direction:column;gap:2px;max-height:240px;overflow:auto">${pkList(m,"")}</div>
    <label class="f">Як додати<select id="pk-kind"><option value="note">Уточнення до задачі</option><option value="comment">Коментар / звіт</option></select></label>
    <div class="row" style="align-self:end"><button class="btn primary sm" type="button" data-attgo="${m.id}">Додати</button><button class="btn sm" type="button" data-pknew="${m.id}">+ Створити нову задачу</button><button class="btn ghost sm" type="button" data-attach="${m.id}">Скасувати</button></div>
    <span class="meta full">Уточнення не зараховується як звіт по регулярній задачі; коментар — зараховується. Нова задача отримає це повідомлення як уточнення.</span>
  </div>`;
}
document.addEventListener("input",e=>{const i=e.target.closest("[data-pkq]");if(!i)return;const m=msgs.find(x=>String(x.id)===i.dataset.pkq);document.getElementById("pk-res").innerHTML=pkList(m,i.value)});
async function attachToTask(mid){
  const m=msgs.find(x=>String(x.id)===mid);const kind=$("#pk-kind").value;
  const t=tasks.find(x=>x.id===pkSel);
  if(!t){toast("Оберіть задачу в списку");return}
  const ch=chats[m.chat_id]?.title||"чат";
  const {error}=await sb.from("task_updates").insert({task_id:t.id,author_id:me?.id||null,kind,body:`${kind==="note"?"📌 Уточнення":"💬 Коментар"} з Telegram — ${m.from_name} у «${ch}», ${fmtDT(m.sent_at)}:\n${m.text||""}`,attachments:(m.attachments||[]).filter(a=>a.path)});
  if(error){toast("Не додано: "+error.message);return}
  await sb.from("tg_messages").update({reviewed:true,task_id:t.id}).eq("id",m.id);
  m.reviewed=true;m.task_id=t.id;pick=null;pkSel=null;renderTg();toast(`Додано до #${t.num}`);
}


/* ---------- згортання груп і швидкий коментар ---------- */
const collapsed=new Set((()=>{try{return JSON.parse(localStorage.getItem("pultCollapsed")||"[]")}catch(e){return[]}})());
const saveCollapsed=()=>{try{localStorage.setItem("pultCollapsed",JSON.stringify([...collapsed]))}catch(e){}};
const qcOpen=new Set(),qcDraft={};
document.head.insertAdjacentHTML("beforeend",`<style>.group.gc .list{display:none}.group-head h2.gtoggle{cursor:pointer;user-select:none}.gchev{display:inline-block;width:1em;color:var(--muted);transition:transform .15s}.group.gc .gchev{transform:rotate(-90deg)}.qc{padding:0 14px 12px;display:flex;flex-direction:column;gap:6px}</style>`);
const _render=render;
render=function(){_render();decorate()};
function decorate(){
  if(focusNum||reorder)return;
  document.querySelectorAll("#board .group").forEach(sec=>{
    const h=sec.querySelector(".group-head h2"),first=sec.querySelector(".card");if(!h||!first)return;
    const t=tasks.find(x=>x.id===first.dataset.id);const key=view==="owner"?"o:"+(t?.owner_id||""):"p:"+(t?.project||"");
    sec.dataset.gkey=key;h.classList.add("gtoggle");h.setAttribute("role","button");h.tabIndex=0;h.title="Згорнути / розгорнути";
    if(!h.querySelector(".gchev"))h.insertAdjacentHTML("afterbegin",`<span class="gchev" aria-hidden="true">▾</span>`);
    h.setAttribute("aria-expanded",String(!collapsed.has(key)));sec.classList.toggle("gc",collapsed.has(key));
  });
  document.querySelectorAll("#board .card").forEach(c=>{const id=c.dataset.id;if(id===openId)return;
    const ed=c.querySelector(".card-head .tags [data-editcard]");
    if(ed&&!c.querySelector("[data-qc]")){ed.style.marginLeft="0";ed.insertAdjacentHTML("beforebegin",`<button type="button" class="icon-btn" data-qc="${id}" title="Додати коментар" aria-label="Додати коментар" style="margin-left:auto">💬</button>`)}
    if(qcOpen.has(id)&&!c.querySelector(".qc")){const t=tasks.find(x=>x.id===id);
      c.querySelector(".card-head").insertAdjacentHTML("afterend",`<div class="qc"><div class="pend" id="pend-${id}">${pendHtml(id)}</div><div id="ment-${id}" class="row" hidden style="gap:4px"></div><div class="cbox"><textarea id="c-${id}" rows="2" placeholder="Коментар до #${t?.num??""}. @ — згадати учасника">${esc(qcDraft[id]||"")}</textarea><label class="btn filebtn" title="Додати файли або фото">📎<input type="file" multiple data-files="${id}"></label><button class="btn primary" type="button" data-qcsend="${id}">Надіслати</button><button class="btn ghost" type="button" data-qcclose="${id}" aria-label="Закрити">✕</button></div></div>`)}
  });
}
function toggleGroup(h){const sec=h.closest(".group"),k=sec?.dataset.gkey;if(!k)return;collapsed.has(k)?collapsed.delete(k):collapsed.add(k);saveCollapsed();sec.classList.toggle("gc",collapsed.has(k));h.setAttribute("aria-expanded",String(!collapsed.has(k)))}
document.addEventListener("click",async e=>{
  const q1=e.target.closest("[data-qc]");if(q1){e.stopPropagation();const id=q1.dataset.qc;qcOpen.has(id)?qcOpen.delete(id):qcOpen.add(id);render();document.getElementById("c-"+id)?.focus();return}
  const qx=e.target.closest("[data-qcclose]");if(qx){e.stopPropagation();qcOpen.delete(qx.dataset.qcclose);render();return}
  const qs=e.target.closest("[data-qcsend]");if(qs){e.stopPropagation();const id=qs.dataset.qcsend;await addComment(id);const b=document.getElementById("c-"+id);if(b&&!b.value.trim()&&!(pend[id]||[]).length){qcOpen.delete(id);delete qcDraft[id];render()}return}
  const gh=e.target.closest("#board .group-head h2.gtoggle");if(gh&&!e.target.closest("[data-ava]")){e.stopPropagation();toggleGroup(gh);return}
},true);
document.addEventListener("keydown",e=>{const gh=e.target.closest?.("#board .group-head h2.gtoggle");if(gh&&(e.key==="Enter"||e.key===" ")){e.preventDefault();toggleGroup(gh)}});
document.addEventListener("input",e=>{const id=e.target.id?.startsWith("c-")&&e.target.id.slice(2);if(id&&qcOpen.has(id))qcDraft[id]=e.target.value});
