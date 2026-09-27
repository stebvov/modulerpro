/* ---------- team ---------- */
document.body.insertAdjacentHTML("beforeend",`<dialog id="mDlg" style="border:0;border-radius:16px;padding:0;max-width:min(420px,calc(100vw - 32px));width:100%;background:var(--surface);color:var(--ink);box-shadow:0 20px 60px rgba(0,0,0,.35)"></dialog><style>#mDlg::backdrop{background:rgba(0,0,0,.55)}.ava[data-ava]{cursor:pointer}.mlinks{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}.mlinks a{text-align:center;text-decoration:none}</style>`);
$("#meDescIn").closest("label").insertAdjacentHTML("beforebegin",`<label class="f">Телефон<input id="mePhoneIn" type="tel" maxlength="20" placeholder="+380…"></label>`);
$("#mfEmail").closest("label").insertAdjacentHTML("afterend",`<label class="f">Телефон<input id="mfPhone" type="tel" maxlength="20" placeholder="+380…"></label>`);
const SITE="https://app.moduler.pro/pult", BOT="https://t.me/ivan_moduler_bot";
let editMem=null, access={};
const canManage=()=>!!(me&&(me.can_manage||me.is_owner));
const initials=n=>String(n||"?").replace(/\(.*?\)/g,"").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
function ava(m,size="",click=true){const d=click&&m?.id?` data-ava="${m.id}" role="button" tabindex="0" title="${esc(m.name)}"`:"";return m?.avatar_url?`<img class="ava ${size}" src="${esc(m.avatar_url)}" alt="${esc(m.name||"")}"${d}>`:`<span class="ava ${size}"${d}>${esc(initials(m?.name))}</span>`}
const telNum=p=>String(p||"").replace(/[^\d+]/g,"");
function openMember(id){
  const m=team.find(x=>x.id===id);if(!m)return;const dlg=$("#mDlg");
  const open=tasks.filter(t=>t.owner_id===m.id&&t.status!=="done").length,ctl=tasks.filter(t=>t.controller_id===m.id&&t.status!=="done").length;
  const ph=telNum(m.phone);
  const tgHref=m.tg_username?`https://t.me/${encodeURIComponent(m.tg_username)}`:m.tg_user_id?`tg://user?id=${m.tg_user_id}`:ph.length>=10?`https://t.me/${ph.startsWith("+")?ph:"+"+ph}`:"";
  const tgByPhone=!m.tg_username&&!m.tg_user_id&&tgHref;
  const photo=m.avatar_url?`<a href="${esc(m.avatar_url)}" target="_blank" rel="noopener" title="Відкрити фото"><img src="${esc(m.avatar_url)}" alt="${esc(m.name)}" style="display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px 16px 0 0"></a>`
    :`<div style="width:100%;aspect-ratio:2/1;display:grid;place-items:center;background:var(--info-bg);color:var(--accent);font:700 64px var(--display);border-radius:16px 16px 0 0">${esc(initials(m.name))}</div>`;
  dlg.innerHTML=`${photo}<div style="padding:16px 18px 18px;display:flex;flex-direction:column;gap:10px">
    <div><h2 style="font-size:20px">${esc(m.name)}</h2>${m.role?`<span class="meta">${esc(m.role)}</span>`:""}</div>
    ${m.description?`<p style="margin:0;font-size:14px;color:var(--muted);white-space:pre-wrap;overflow-wrap:anywhere">${linkify(m.description)}</p>`:""}
    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:14px">
      ${m.phone?`<span class="meta">Телефон</span><a href="tel:${esc(ph)}" style="color:var(--accent)">${esc(m.phone)}</a>`:""}
      ${m.tg_username||m.tg_user_id?`<span class="meta">Telegram</span><span>${m.tg_username?"@"+esc(m.tg_username):"привʼязано"}</span>`:""}
      ${m.email?`<span class="meta">Email</span><a href="mailto:${esc(m.email)}" style="color:var(--accent);overflow-wrap:anywhere">${esc(m.email)}</a>`:""}
      <span class="meta">Задачі</span><span>${open} відкр.${ctl?` · ${ctl} на контролі`:""}</span>
    </div>
    <div class="mlinks">
      ${tgHref?`<a class="btn primary" href="${esc(tgHref)}" target="_blank" rel="noopener" title="${tgByPhone?"Відкриє чат за номером телефону (якщо людина дозволила пошук за номером)":"Написати в Telegram"}">✈️ Telegram</a>`:""}
      ${ph?`<a class="btn" href="tel:${esc(ph)}">📞 Подзвонити</a><a class="btn" href="viber://chat?number=${encodeURIComponent(ph)}">💬 Viber</a>`:""}
      <button class="btn" type="button" data-mtasks="${m.id}">Задачі</button>
    </div>
    ${tgByPhone?`<span class="meta">Telegram відкриється за номером телефону. Якщо не спрацює — людина приховала пошук за номером; тоді впишіть її @username.</span>`:""}
    ${!tgHref&&!ph?`<span class="meta">Контактів ще немає: ${canManage()?"додайте телефон у «Команда → Редагувати»":"попросіть Катю додати телефон"}${m.tg_user_id?"":", Telegram привʼяжеться після /iam у боті"}.</span>`:""}
    <div class="row" style="justify-content:flex-end">${canManage()?`<button class="btn ghost sm" type="button" data-mcardedit="${m.id}">Редагувати</button>`:""}<button class="btn ghost sm" type="button" data-mclose>Закрити</button></div>
  </div>`;
  dlg.showModal();
}
window.addEventListener("click",e=>{const a=e.target.closest("[data-ava]");if(a&&!a.closest("[data-mention]")){e.stopPropagation();e.preventDefault();openMember(a.dataset.ava)}},true);
window.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.dataset?.ava){e.stopPropagation();e.preventDefault();openMember(e.target.dataset.ava)}},true);
document.addEventListener("click",e=>{
  const dlg=$("#mDlg");
  if(e.target===dlg||e.target.closest("[data-mclose]")){dlg.close();return}
  const mt=e.target.closest("[data-mtasks]");if(mt){dlg.close();fPerson=mt.dataset.mtasks;fProject="";view="owner";document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view==="owner"));document.querySelector('[data-tab="tasks"]').click();renderFilters();render();return}
  const me2=e.target.closest("[data-mcardedit]");if(me2){dlg.close();editMem=me2.dataset.mcardedit;document.querySelector('[data-tab="team"]').click();renderTeam();return}
});
function accessText(name,email,pwd){
  const first=String(name).split(" ")[0];
  return `Вітаю, ${first}! Ось твій доступ до Пульта задач:\n\n🔗 ${SITE}\n👤 Логін: ${email}\n🔑 Пароль: ${pwd}\n\nПісля входу зміни пароль: натисни на своє імʼя вгорі → «Мій профіль».\n\n🤖 Telegram-бот для звітів: ${BOT}\nНапиши йому: /iam ${name}`;
}
function renderTeam(){
  $("#addMemBtn").hidden=!canManage();
  const TF={all:()=>true,reg:m=>!!m.email,tg:m=>!!m.tg_user_id,none:m=>!m.email&&!m.tg_user_id};
  document.querySelectorAll("[data-tf]").forEach(b=>{const n=team.filter(TF[b.dataset.tf]).length;b.textContent=b.textContent.replace(/ \d+$/,"")+" "+n});
  const tq=teamQ.trim().toLowerCase();
  const shown=team.filter(TF[teamF]).filter(m=>!tq||[m.name,m.role,m.email,m.description,m.tg_username].join(" ").toLowerCase().includes(tq));
  $("#teamGrid").innerHTML=shown.length?"":`<div class="empty">Нікого за цим фільтром.</div>`;
  if(!shown.length)return;
  $("#teamGrid").innerHTML=shown.map(m=>{
    const open=tasks.filter(t=>t.owner_id===m.id&&t.status!=="done").length;
    if(editMem===m.id)return `<div class="mcard">
      <label class="f">Імʼя<input id="em-name" value="${esc(m.name)}"></label>
      <label class="f">Роль<input id="em-role" value="${esc(m.role||"")}"></label>
      <label class="f">Email для входу<input id="em-email" type="email" value="${esc(m.email||"")}"></label>
      <label class="f">Телефон<input id="em-phone" type="tel" maxlength="20" placeholder="+380…" value="${esc(m.phone||"")}"></label>
      <label class="f">Telegram @username<input id="em-tg" maxlength="40" placeholder="@username" value="${esc(m.tg_username?"@"+m.tg_username:"")}"></label>
      <label class="f">Опис<textarea id="em-desc" rows="2">${esc(m.description||"")}</textarea></label>
      <label class="chk"><input id="em-active" type="checkbox"${m.active?" checked":""}> активний (має доступ)</label>
      <label class="chk"><input id="em-manage" type="checkbox"${m.can_manage?" checked":""}${m.is_owner?" disabled":""}> може керувати командою (бачить усе)</label>
      <div class="row" style="gap:10px">${ava(m)}<label class="f" style="flex:1">Фото<input id="em-ava" type="file" accept="image/jpeg,image/png,image/webp"></label></div>
      ${grantsEditor(m)}
      <div class="row"><button class="btn primary sm" type="button" data-msave="${m.id}">Зберегти</button><button class="btn ghost sm" type="button" data-medit="${m.id}">Скасувати</button></div></div>`;
    const acc=access[m.id];
    return `<div class="mcard ${m.active?"":"off"}">
      <div class="mhead">${ava(m)}<div><b>${esc(m.name)}</b><span class="meta">${esc(m.role||"")}</span></div></div>
      ${m.description?`<p style="white-space:pre-wrap;overflow-wrap:anywhere">${linkify(m.description)}</p>`:""}
      <div class="row"><span class="meta">${esc(m.email||"email не вказано")}</span>${m.phone?`<a class="meta" href="tel:${esc(telNum(m.phone))}" style="color:var(--accent)">${esc(m.phone)}</a>`:""}</div>
      <div class="row">${m.tg_user_id?`<span class="due ok">Telegram ${m.tg_username?"@"+esc(m.tg_username):"привʼязано"}</span>`:m.tg_username?`<span class="due warn" title="Контакт є, але людина ще не написала боту /iam — нагадування не приходитимуть">@${esc(m.tg_username)} · бот не підключено</span>`:`<span class="due none">Telegram не привʼязано</span>`}<span class="meta">${open} відкр.</span>${m.can_manage||m.is_owner?`<span class="tag">керує командою</span>`:""}${m.active?"":`<span class="tag">вимкнено</span>`}</div>
      ${grantsLine(m)}
      ${acc?`<div class="access"><pre>${esc(acc)}</pre><div class="row"><button class="btn primary sm" type="button" data-mcopy="${m.id}">Скопіювати доступ</button><span class="meta">пароль показано один раз</span></div></div>`:""}
      ${canManage()?`<div class="row">${me&&m.id===me.id?`<span class="meta">свій пароль — у «Моєму профілі»</span>`:`<button class="btn sm" type="button" data-mpass="${m.id}"${m.email?"":" disabled title='Спершу вкажіть email'"}>${m.email?"Створити пароль і доступ":"Потрібен email"}</button>`}<button class="btn ghost sm" type="button" data-medit="${m.id}">Редагувати</button></div>`:""}
    </div>`}).join("");
}
function grantLabel(g){return g.scope==="member"?"задачі: "+nameOf(g.target):"проєкт: "+g.target}
function grantsLine(m){const g=grants.filter(x=>x.member_id===m.id);if(m.can_manage||m.is_owner)return `<span class="meta">Бачить усі задачі</span>`;return g.length?`<span class="meta">👁 Бачить свої + ${g.map(grantLabel).map(esc).join(", ")}</span>`:`<span class="meta">Бачить лише свої задачі</span>`}
function grantsEditor(m){
  if(m.can_manage||m.is_owner)return "";
  const g=grants.filter(x=>x.member_id===m.id);
  return `<div class="grants" id="grants-${m.id}"><b style="font-size:13px">Контроль: бачить також</b>
    ${g.map(x=>`<div class="row"><span style="flex:1;font-size:14px">${esc(grantLabel(x))}</span><button class="btn ghost sm danger" type="button" data-gdel="${x.id}">Прибрати</button></div>`).join("")||`<span class="meta">лише свої задачі та ті, де він контролер</span>`}
    <select id="g-scope-${m.id}" data-gscope="${m.id}" style="width:auto"><option value="member">+ задачі людей</option><option value="project">+ проєкти</option></select>
    <div id="g-list-${m.id}" style="display:flex;flex-direction:column;gap:2px;max-height:200px;overflow:auto">${gTargets(m.id,"member")}</div>
    <button class="btn sm" type="button" data-gadd="${m.id}" style="align-self:flex-start">Додати вибраних</button></div>`;
}
async function refreshGrants(mid){const {data}=await sb.from("task_access").select("*").order("id");grants=data||[];const el=document.getElementById("grants-"+mid),m=team.find(x=>x.id===mid);if(el&&m)el.outerHTML=grantsEditor(m);else renderTeam()}
function gTargets(mid,scope){
  const have=new Set(grants.filter(x=>x.member_id===mid&&x.scope===scope).map(x=>x.target));
  const list=scope==="member"?team.filter(x=>x.id!==mid&&x.active&&!have.has(x.id)).map(x=>[x.id,x.name]):projects.filter(p=>p.status!=="done"&&!have.has(p.name)).map(p=>[p.name,p.name]);
  return list.length?list.map(([v,l])=>`<label class="chk"><input type="checkbox" data-gpick="${mid}" value="${esc(v)}">${esc(l)}</label>`).join(""):`<span class="meta">Усіх уже додано</span>`;
}
document.addEventListener("change",e=>{const s=e.target.closest("[data-gscope]");if(s)document.getElementById("g-list-"+s.dataset.gscope).innerHTML=gTargets(s.dataset.gscope,s.value)});
document.addEventListener("click",async e=>{
  const ga=e.target.closest("[data-gadd]");if(ga){const mid=ga.dataset.gadd;const scope=$("#g-scope-"+mid).value;
    const picked=[...document.querySelectorAll(`[data-gpick="${mid}"]:checked`)].map(x=>x.value);if(!picked.length){toast("Позначте людей або проєкти");return}
    const {error}=await sb.from("task_access").insert(picked.map(target=>({member_id:mid,scope,target})));if(error){toast(error.code==="23505"?"Частину вже додано":"Не додано: "+error.message);return}
    toast(`Додано: ${picked.length}`);await refreshGrants(mid);return}
  const gd=e.target.closest("[data-gdel]");if(gd){const mid=grants.find(x=>String(x.id)===gd.dataset.gdel)?.member_id;const {error}=await sb.from("task_access").delete().eq("id",gd.dataset.gdel);if(error){toast("Не прибрано: "+error.message);return}toast("Прибрано");await refreshGrants(mid);return}
});
$("#addMemBtn").addEventListener("click",()=>{const f=$("#memForm");f.hidden=!f.hidden;if(!f.hidden)$("#mfName").focus()});
$("#memForm").addEventListener("submit",async e=>{
  e.preventDefault();const name=$("#mfName").value.trim();if(!name)return;
  if(team.some(m=>m.name.toLowerCase()===name.toLowerCase())){toast("Учасник з таким імʼям вже є");return}
  const {error}=await sb.from("task_members").insert({name,role:$("#mfRole").value.trim()||null,email:$("#mfEmail").value.trim().toLowerCase()||null,phone:$("#mfPhone").value.trim()||null,description:$("#mfDesc").value.trim()||null,sort:team.length});
  if(error){toast("Не додано: "+error.message);return}
  e.target.reset();e.target.hidden=true;toast("Учасника додано");loadAll();
});
document.addEventListener("click",async e=>{
  const me_=e.target.closest("[data-medit]");if(me_){editMem=editMem===me_.dataset.medit?null:me_.dataset.medit;renderTeam();return}
  const ms=e.target.closest("[data-msave]");if(ms){
    const id=ms.dataset.msave,g=k=>document.getElementById("em-"+k);
    const patch={name:g("name").value.trim(),role:g("role").value.trim()||null,email:g("email").value.trim().toLowerCase()||null,phone:g("phone").value.trim()||null,tg_username:g("tg").value.trim().replace(/^@+/,"").replace(/^https?:\/\/t\.me\//,"")||null,description:g("desc").value.trim()||null,active:g("active").checked,can_manage:g("manage").checked};
    if(!patch.name){toast("Імʼя не може бути порожнім");return}
    const af=g("ava")?.files?.[0];
    if(af){if(af.size>3*1024*1024){toast("Фото більше 3 МБ");return}
      const path=`${id}-${Date.now()}.${(af.type.split("/")[1]||"jpg").replace("jpeg","jpg")}`;
      const up=await sb.storage.from("avatars").upload(path,af,{upsert:false,contentType:af.type});
      if(up.error){toast("Фото не завантажено: "+up.error.message);return}
      patch.avatar_url=sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;}
    const {error}=await sb.from("task_members").update(patch).eq("id",id);
    if(error){toast("Не збережено: "+error.message);return}
    editMem=null;toast("Збережено");loadAll();return}
  const mp=e.target.closest("[data-mpass]");if(mp){
    const id=mp.dataset.mpass;mp.disabled=true;mp.textContent="Створюю…";
    const {data,error}=await sb.functions.invoke("team-admin",{body:{action:"set_password",member_id:id}});
    if(error||data?.error){toast("Не вдалося: "+(data?.error||error.message));mp.disabled=false;mp.textContent="Створити пароль і доступ";return}
    access[id]=accessText(data.name,data.email,data.password);renderTeam();return}
  const mc=e.target.closest("[data-mcopy]");if(mc){copy(access[mc.dataset.mcopy]);return}
});

/* ---------- my profile ---------- */
function renderMe(){
  if(!me)return;
  $("#meAva").innerHTML=ava(me,"sm",false);$("#whoami").textContent=me.name;
  $("#meAvaLg").innerHTML=ava(me,"lg");$("#meName").textContent=me.name;$("#meEmail").textContent=me.email||"";
}
$("#meBtn").addEventListener("click",()=>{
  const f=$("#meForm");f.hidden=!f.hidden;if(f.hidden||!me)return;
  $("#addForm").hidden=true;$("#projForm").hidden=true;
  $("#meNameIn").value=me.name;$("#meRoleIn").value=me.role||"";$("#meDescIn").value=me.description||"";$("#mePhoneIn").value=me.phone||"";$("#mePass1").value="";$("#mePass2").value="";
});
$("#meSave").addEventListener("click",async()=>{
  if(!me)return;
  const patch={name:$("#meNameIn").value.trim(),role:$("#meRoleIn").value.trim()||null,phone:$("#mePhoneIn").value.trim()||null,description:$("#meDescIn").value.trim()||null};
  if(!patch.name){toast("Імʼя не може бути порожнім");return}
  const file=$("#meAvaIn").files[0];
  if(file){
    if(file.size>2*1024*1024){toast("Фото більше 2 МБ");return}
    const path=`${me.id}-${Date.now()}.${(file.type.split("/")[1]||"jpg").replace("jpeg","jpg")}`;
    const up=await sb.storage.from("avatars").upload(path,file,{upsert:false,contentType:file.type});
    if(up.error){toast("Фото не завантажено: "+up.error.message);return}
    patch.avatar_url=sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }
  const {error}=await sb.from("task_members").update(patch).eq("id",me.id);
  if(error){toast("Не збережено: "+error.message);return}
  Object.assign(me,patch);$("#meAvaIn").value="";renderMe();toast("Профіль збережено");loadAll();
});
$("#mePassSave").addEventListener("click",async()=>{
  const a=$("#mePass1").value,b=$("#mePass2").value;
  if(a.length<8){toast("Пароль — мінімум 8 символів");return}
  if(a!==b){toast("Паролі не збігаються");return}
  const {error}=await sb.auth.updateUser({password:a});
  if(error){toast("Не змінено: "+error.message);return}
  $("#mePass1").value="";$("#mePass2").value="";toast("Пароль змінено");
});

try{const rb=$("#rulesBox");rb.open=localStorage.getItem("pult_rules")==="1";rb.addEventListener("toggle",()=>{try{localStorage.setItem("pult_rules",rb.open?"1":"0")}catch(e){}})}catch(e){}
sb.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_IN"&&!booted)boot()});
boot();
