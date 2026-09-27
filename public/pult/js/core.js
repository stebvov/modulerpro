const SUPABASE_URL="https://uaufrrpfvixhprqhqjzo.supabase.co";
const SUPABASE_KEY="sb_publishable_J3y552Nyy3U9Ds9Om500gA_ej9DhFUU";
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const STATUS={todo:"Не почато",doing:"В роботі",waiting:"Чекаємо",done:"Виконано"};
const RECUR={none:"Разова",daily:"Щодня",weekdays:"По буднях (пн–пт)",weekly:"Щотижня",monthly:"Щомісяця",every_n:"Кожні N днів"};
const WD=["пн","вт","ср","чт","пт","сб","нд"];
const PSTATUS={active:"Активний",paused:"На паузі",done:"Завершено"};
let tasks=[],team=[],projects=[],msgs=[],chats={},counts={},me=null,view="owner",filter=null,openId=null,q="",showDone=false,showRev=false,history={},signUp=false,fPerson="",fProject="",grants=[],signed={},pend={},pick=null,teamF="all",checks={},editId=null,pkSel=null,projF="active",teamQ="",tgChat="";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Kyiv"}).format(new Date())}
function nowHM(){return new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Kyiv",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date())}
function days(a,b){return Math.round((new Date(a+"T12:00:00Z")-new Date(b+"T12:00:00Z"))/864e5)}
function fmt(d){return d?d.slice(8,10)+"."+d.slice(5,7):""}
const hm=t=>t?t.slice(0,5):"";
function fmtDT(s){const d=new Date(s);return d.toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"})}
function toast(t){const e=$("#toast");e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,2400)}
const nameOf=id=>team.find(m=>m.id===id)?.name||"—";
function linkify(s){
  s=String(s??"");const re=/(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)»'])|((?:www\.)[^\s<>"]+[^\s<>".,;:!?)»'])|([\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,})|(\+?\d[\d \-()]{7,17}\d)/g;
  let out="",last=0,m;
  while((m=re.exec(s))){out+=esc(s.slice(last,m.index));last=re.lastIndex;const t=m[0];
    if(m[1]||m[2]){const href=m[1]?t:"https://"+t;out+=`<a href="${esc(href)}" target="_blank" rel="noopener">${esc(t)}</a>`}
    else if(m[3])out+=`<a href="mailto:${esc(t)}">${esc(t)}</a>`;
    else{const d=t.replace(/[^\d+]/g,""),n=d.replace("+","").length;out+=(n>=10&&n<=13&&/^(\+|0|380)/.test(d))?`<a href="tel:${esc(d)}">${esc(t)}</a>`:esc(t)}}
  return out+esc(s.slice(last));
}
function attsHtml(list){
  list=(list||[]).filter(a=>a);if(!list.length)return"";
  return `<div class="atts">${list.map(a=>{const u=signed[a.path];
    if(!a.path)return `<span class="file" style="font-size:13px">📎 ${esc(a.name)}</span>`;
    if(!u)return `<span class="meta">📎 ${esc(a.name)}</span>`;
    return (a.mime||"").startsWith("image/")?`<a class="img" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(a.name)}"><img src="${esc(u)}" alt="${esc(a.name)}" loading="lazy"></a>`:`<a class="file" href="${esc(u)}" target="_blank" rel="noopener">📎 ${esc(a.name)}</a>`}).join("")}</div>`;
}
async function signPaths(list){
  const need=[...new Set(list.flatMap(x=>(x.attachments||[]).map(a=>a?.path)).filter(p=>p&&!signed[p]))];
  if(!need.length)return;
  const {data}=await sb.storage.from("pult-files").createSignedUrls(need,60*60*6);
  (data||[]).forEach(r=>{if(r.signedUrl)signed[r.path]=r.signedUrl});
}
const safeName=n=>String(n).replace(/[^A-Za-z0-9._-]+/g,"_").slice(-60)||"file";
async function uploadFiles(prefix,files){
  const out=[];
  for(const f of files){
    if(f.size>50*1024*1024){toast(`${f.name}: більше 50 МБ`);continue}
    const path=`${prefix}/${Date.now()}_${Math.random().toString(36).slice(2,6)}_${safeName(f.name)}`;
    const {error}=await sb.storage.from("pult-files").upload(path,f,{contentType:f.type||"application/octet-stream"});
    if(error){toast(`${f.name}: ${error.message}`);continue}
    out.push({path,name:f.name,mime:f.type||"application/octet-stream",size:f.size});
  }
  return out;
}
function autosize(el){el.style.height="auto";el.style.height=(el.scrollHeight+2)+"px"}
document.addEventListener("input",e=>{if(e.target.tagName==="TEXTAREA"&&e.target.rows<=2)autosize(e.target)});

function dueState(t){
  if(t.status==="done")return"done";
  if(!t.due)return"none";
  const d=days(t.due,today());
  if(d<0)return"overdue";
  if(d===0&&t.due_time&&nowHM()>hm(t.due_time))return"overdue";
  if(d===0)return"today";
  return d<=3?"soon":"ok";
}
function recurLabel(t){
  if(!t.recur||t.recur==="none")return"";
  let s=t.recur==="weekly"?"щотижня "+(t.recur_weekdays||[]).map(i=>WD[i-1]).join(","):t.recur==="every_n"?`кожні ${t.recur_every} дн`:t.recur==="monthly"&&t.recur_every>1?`кожні ${t.recur_every} міс`:RECUR[t.recur].toLowerCase().replace(" (пн–пт)","");
  return "↻ "+s+(t.due_time?" "+hm(t.due_time):"");
}
function staleDays(t){return Math.floor((Date.now()-new Date(t.updated_at))/864e5)}
function isStale(t){return t.status!=="done"&&t.recur==="none"&&staleDays(t)>=7}
const FILTERS={
  overdue:{l:"Прострочено",cls:"bad",f:t=>dueState(t)==="overdue"},
  today:{l:"Сьогодні",cls:"warn",f:t=>dueState(t)==="today"},
  nodue:{l:"Без терміну",cls:"warn",f:t=>dueState(t)==="none"},
  stale:{l:"Мовчать 7+ днів",cls:"warn",f:isStale},
  recur:{l:"Регулярні",cls:"",f:t=>t.recur!=="none"&&t.status!=="done"},
  mine:{l:"На мені",cls:"",f:t=>me&&t.owner_id===me.id&&t.status!=="done"},
  ctl:{l:"На контролі",cls:"",f:t=>me&&t.controller_id===me.id&&t.status!=="done"},
  open:{l:"Відкрито",cls:"",f:t=>t.status!=="done"}
};
function opts(list,val){return list.map(([v,l])=>`<option value="${esc(v)}"${v===val?" selected":""}>${esc(l)}</option>`).join("")}
const activeProjects=()=>projects.filter(p=>p.status!=="done");
const peopleOpts=val=>opts(team.filter(m=>m.active).map(m=>[m.id,m.name]),val);

/* блок «термін і повторення» — однаковий для створення і редагування */
function recurFields(p,t={}){
  const r=t.recur||"none";
  return `<label class="f">${r==="none"?"Термін":"Наступний раз"}<input id="${p}-due" type="date" value="${esc(t.due||"")}"></label>
  <label class="f">Час (необовʼязково)<input id="${p}-time" type="time" value="${esc(hm(t.due_time))}"></label>
  <label class="f">Повторення<select id="${p}-recur" data-recur="${p}">${opts(Object.entries(RECUR),r)}</select></label>
  <label class="f" id="${p}-everyBox" ${["every_n","monthly"].includes(r)?"":"hidden"}>${r==="monthly"?"Кожні N місяців":"Кожні N днів"}<input id="${p}-every" type="number" min="1" max="365" value="${t.recur_every||1}"></label>
  <div class="f full" id="${p}-wdBox" ${r==="weekly"?"":"hidden"}>Дні тижня<div class="days">${WD.map((d,i)=>`<label><input type="checkbox" data-wd="${p}" value="${i+1}"${(t.recur_weekdays||[]).includes(i+1)?" checked":""}>${d}</label>`).join("")}</div></div>`;
}
document.addEventListener("change",e=>{
  const s=e.target.closest("[data-recur]");if(!s)return;const p=s.dataset.recur,r=s.value;
  const eb=document.getElementById(p+"-everyBox");eb.hidden=!["every_n","monthly"].includes(r);eb.firstChild.textContent=r==="monthly"?"Кожні N місяців":"Кожні N днів";
  document.getElementById(p+"-wdBox").hidden=r!=="weekly";
  const due=document.getElementById(p+"-due");if(r!=="none"&&!due.value)due.value=today();
});
function readRecur(p){
  const r=document.getElementById(p+"-recur").value;
  const wd=[...document.querySelectorAll(`[data-wd="${p}"]:checked`)].map(x=>+x.value);
  const due=document.getElementById(p+"-due").value||null;
  const out={due,due_time:document.getElementById(p+"-time").value||null,recur:r,recur_every:Math.max(1,+document.getElementById(p+"-every").value||1),recur_weekdays:r==="weekly"?(wd.length?wd:[due?((new Date(due+"T12:00:00Z").getUTCDay()+6)%7)+1:1]):null};
  if(r!=="none"&&!out.due)out.due=today();
  return out;
}

/* ---------- auth ---------- */
let booted=false;
async function boot(){
  if(booted)return;
  const {data:{session}}=await sb.auth.getSession();
  if(!session){show("login");return}
  const {data:mem}=await sb.from("task_members").select("*").order("sort");
  if(!mem||!mem.length){$("#naText").textContent=`Акаунт ${session.user.email} ще не додано до команди. Попросіть Катю або Володимира внести цей email у розділ «Команда».`;show("na");return}
  team=mem; me=team.find(m=>(m.email||"").toLowerCase()===session.user.email.toLowerCase())||null;
  $("#whoami").textContent=me?me.name:session.user.email;renderMe();
  booted=true; show("app"); await loadAll(); subscribe();
}
function show(v){$("#loginView").hidden=v!=="login";$("#noAccess").hidden=v!=="na";$("#app").hidden=v!=="app"}
$("#lMode").addEventListener("click",()=>{signUp=!signUp;$("#lSubmit").textContent=signUp?"Створити пароль":"Увійти";$("#lMode").textContent=signUp?"Вже маю пароль":"Перший вхід: створити пароль";$("#lPass").autocomplete=signUp?"new-password":"current-password"});
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const email=$("#lEmail").value.trim(),password=$("#lPass").value;$("#lErr").hidden=true;
  const r=signUp?await sb.auth.signUp({email,password,options:{emailRedirectTo:location.href.split("#")[0]}}):await sb.auth.signInWithPassword({email,password});
  if(r.error){$("#lErr").textContent=r.error.message==="Invalid login credentials"?"Невірний email або пароль.":r.error.message==="Email not confirmed"?"Email ще не підтверджено. Відкрийте лист від Supabase і перейдіть за посиланням.":r.error.message;$("#lErr").hidden=false;return}
  if(signUp&&!r.data.session){$("#lErr").textContent="Перевірте пошту: прийде лист із посиланням для підтвердження. Після цього увійдіть.";$("#lErr").hidden=false;return}
  boot();
});
document.addEventListener("click",async e=>{if(e.target.closest("[data-logout]")){await sb.auth.signOut();location.reload()}});

/* ---------- data ---------- */
async function loadAll(){
  const mgr=canManage();
  const [t,p,m,c,u,mem,ga]=await Promise.all([
    sb.from("tasks").select("*").order("num"),
    sb.from("task_projects").select("*").order("sort"),
    mgr?sb.from("tg_messages").select("*").order("sent_at",{ascending:false}).limit(150):Promise.resolve({data:[]}),
    mgr?sb.from("tg_chats").select("*"):Promise.resolve({data:[]}),
    sb.from("task_updates").select("task_id").in("kind",["comment","note"]),
    sb.from("task_members").select("*").order("sort"),
    sb.from("task_access").select("*").order("id"),
  ]);
  const ck=await sb.from("task_checks").select("*").order("sort").order("id");
  checks={};(ck.data||[]).forEach(c=>(checks[c.task_id]??=[]).push(c));
  if(t.error){toast("Помилка завантаження: "+t.error.message);return}
  tasks=t.data;projects=p.data||[];msgs=m.data||[];chats=Object.fromEntries((c.data||[]).map(x=>[x.chat_id,x]));if(mem.data){team=mem.data;if(me)me=team.find(m=>m.id===me.id)||me;renderMe();}
  grants=ga.data||[];
  counts={};(u.data||[]).forEach(r=>counts[r.task_id]=(counts[r.task_id]||0)+1);
  document.querySelector('[data-tab="tg"]').hidden=!canManage();
  await signPaths(msgs);
  renderFilters();render();renderProjects();renderTg();renderTeam();
}
let reloadT;function scheduleReload(){clearTimeout(reloadT);reloadT=setTimeout(loadAll,400)}
function subscribe(){
  sb.channel("pult").on("postgres_changes",{event:"*",schema:"public",table:"tasks"},scheduleReload).on("postgres_changes",{event:"*",schema:"public",table:"task_checks"},scheduleReload)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"task_updates"},p=>{counts[p.new.task_id]=(counts[p.new.task_id]||0)+(["comment","note"].includes(p.new.kind)?1:0);if(history[p.new.task_id])loadHistory(p.new.task_id)}).subscribe();
  setInterval(loadAll,120000);
  setInterval(()=>{if(!openId)render()},60000);
}
async function loadHistory(id){
  const {data}=await sb.from("task_updates").select("*").eq("task_id",id).order("created_at",{ascending:true}).limit(200);
  history[id]=data||[];await signPaths(history[id]);if(openId===id){const f=document.getElementById("feed-"+id);if(f){f.innerHTML=feedHtml(id);f.scrollTop=f.scrollHeight}else render()}
}

