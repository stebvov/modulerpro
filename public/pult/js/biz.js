/* ---------- Модулер: напрями, шлях проєкту, оцінка ринку, дохід засновника (27.09) ----------
   Бізнес = 4 напрями (biz_directions): Завод · Містечка · Дохідна нерухомість · Сервіс (УК).
   Кожен проєкт має напрям і етап: оцифровка → ринок → економіка → рішення → упаковка → ліди → продажі → перевірка → реалізація → дохід.
   «Мій пульт» — стартовий екран кожного учасника. «Капітал» — лише засновник (RLS owner_goal, owner_assets). */
document.head.insertAdjacentHTML("beforeend",`<style id="bizCss">
.bz{display:flex;flex-direction:column;gap:14px}
.bz h2{font:600 17px var(--body);margin:0}
.bz h3{font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0}
.bz-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}
.bz-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.bz-hello{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline}
.bz-hello h2{font:600 20px var(--display)}
.bz-nums{display:flex;flex-wrap:wrap;gap:6px}
.bz-num{display:inline-flex;gap:6px;align-items:baseline;background:var(--surface);border:1px solid var(--line);border-radius:99px;padding:5px 12px;font-size:13px;color:var(--muted)}
.bz-num b{font-size:15px;color:var(--ink)} .bz-num.bad{background:var(--bad-bg);border-color:transparent} .bz-num.bad b{color:var(--bad)}
.myt{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;text-decoration:none;color:inherit;padding:8px 10px;border-radius:8px;border:1px solid transparent}
.myt:hover{background:var(--sunk);border-color:var(--line)}
.myt .num{font:600 12px var(--mono);color:var(--muted);padding-top:2px}
.myt .tt{overflow-wrap:anywhere}
.myt .meta{grid-column:2;font-size:12px;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center}
.myt.s-overdue .num{color:var(--bad)} .myt.s-today .num{color:var(--warn)}
.bz-empty{font-size:14px;color:var(--muted);padding:4px 10px}
.stg{display:inline-flex;align-items:center;gap:4px;font:500 12px var(--body);padding:2px 9px;border-radius:99px;background:var(--sunk);color:var(--muted);white-space:nowrap}
.stg.on{background:var(--accent);color:var(--accent-ink)}
.dirc{border-top:4px solid var(--accent)}
.dirc .dh{display:flex;gap:10px;align-items:flex-start}
.dirc .dh .em{font-size:26px;line-height:1}
.dirc .dh h2{font-size:16px}
.dirc .who{font-size:13px}
.vac{display:inline-flex;gap:4px;font:600 12px var(--body);background:var(--warn-bg);color:var(--warn);border-radius:99px;padding:2px 10px}
.dfacts{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;font-size:13px}
.dfacts span{color:var(--muted)}
.dproj{display:flex;flex-direction:column;gap:6px}
.dp{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center;padding:8px 10px;background:var(--sunk);border-radius:8px}
.dp .nm{background:none;border:0;padding:0;font:600 14px var(--body);color:var(--ink);text-align:left;cursor:pointer;overflow-wrap:anywhere}
.dp .nm:hover{color:var(--accent);text-decoration:underline}
.dp .ctl{display:flex;gap:6px;flex-wrap:wrap;grid-column:1/-1;align-items:center;font-size:12px;color:var(--muted)}
.dp select{width:auto;font-size:12px;padding:2px 6px}
.dp .money{font:600 12px var(--mono);color:var(--ok)}
.funnel{display:flex;gap:4px;overflow-x:auto;padding-bottom:2px}
.funnel .f{flex:1 0 74px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:6px 8px;text-align:center;font-size:12px;color:var(--muted)}
.funnel .f b{display:block;font-size:18px;color:var(--ink)} .funnel .f.z b{color:var(--line)}
.bpath{display:flex;flex-direction:column;gap:8px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--surface)}
.bpath .top{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.bpath .chips{display:flex;gap:4px;flex-wrap:wrap}
.bpath .chips button{border:1px solid var(--line);background:var(--surface);border-radius:99px;font:500 12px var(--body);padding:3px 10px;cursor:pointer;color:var(--muted)}
.bpath .chips button.past{background:var(--ok-bg);color:var(--ok);border-color:transparent}
.bpath .chips button.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.bpath .chips button:disabled{cursor:default}
.gates{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
.gate{display:flex;gap:8px;align-items:flex-start;font-size:13px;background:var(--sunk);border-radius:8px;padding:8px 10px}
.gate b{display:block;font-size:13px} .gate .ic{font-size:16px;line-height:1.2}
.gate.ok{background:var(--ok-bg)} .gate.ok b{color:var(--ok)}
.gate button{margin-top:4px}
.mkt{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--surface)}
.mkt .lv{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
.mkt .lv>div{background:var(--sunk);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;font-size:13px}
.mkt .lv b{font-size:14px}
.an table{min-width:760px;font-size:13px}
.an td,.an th{padding:5px 6px}
.an td.n,.an th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.an input,.an select{font-size:13px;padding:3px 6px}
.an .st{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;background:var(--info-bg);border-radius:8px;padding:8px 10px}
.an textarea{font:13px var(--mono)}
.fmx{border-top:1px dashed var(--line);padding-top:8px}
.monthly{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;background:var(--info-bg);border-radius:8px;padding:8px 10px;margin-top:8px}
.cap-goal{display:flex;flex-direction:column;gap:8px}
.cap-goal .big{font:600 28px var(--display);letter-spacing:-.01em}
.bar{height:10px;border-radius:5px;background:var(--sunk);overflow:hidden;position:relative}
.bar i{position:absolute;inset:0 auto 0 0;background:var(--accent);border-radius:5px}
.bar i.f{background:color-mix(in srgb,var(--accent) 35%,transparent)}
.capt td.n,.capt th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.capt input,.capt select{font-size:13px;padding:3px 6px}
.miss{font-size:12px;color:var(--warn)}
.ou-vac{font-size:13px;background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:6px 10px}
.pdir{font-size:12px;color:var(--muted)}
</style>`);

/* ---------- одна система: пульт живе всередині оболонки Moduler Pro ----------
   /pult?embed=1&tab=my — розділ у меню оболонки; відкритий напряму /pult → переходимо в оболонку */
const EMBED=new URLSearchParams(location.search).has("embed");
const EMBED_TAB=new URLSearchParams(location.search).get("tab")||"my";
if(IN_MP&&!EMBED&&window.top===window){const h=location.hash||"";location.replace("/?s=pult-"+(/^#[tp]\//.test(h)?"tasks":"my")+h)}
if(EMBED){document.body.classList.add("embed");document.head.insertAdjacentHTML("beforeend",`<style id="embedCss">
/* один стиль з оболонкою: шрифт, розміри, ширина, фон */
body.embed{background:transparent;padding:0 2px 24px;font:14px/1.5 -apple-system,"Segoe UI",Roboto,sans-serif}
body.embed .wrap{max-width:none}
body.embed header.top,body.embed .seg[aria-label="Розділ"],body.embed .mpback{display:none!important}
body.embed #tabTeam > .toolbar > h2{visibility:hidden}
body.embed h2{font-size:15px}
body.embed .bz-hello h2{font:600 18px -apple-system,"Segoe UI",Roboto,sans-serif}
body.embed .cap-goal .big{font-family:-apple-system,"Segoe UI",Roboto,sans-serif}
</style>`);
  /* валюта — одна на всю систему: беремо з оболонки */
  try{const c=localStorage.getItem("moduler_currency");if(CURS.includes(c))DISP=c}catch(e){}
  window.addEventListener("message",e=>{
    if(e.origin!==location.origin)return;
    if(e.data?.type==="currency"&&CURS.includes(e.data.currency)&&e.data.currency!==DISP){
      DISP=e.data.currency;try{localStorage.setItem("pult_cur",DISP)}catch(err){}
      try{render()}catch(err){}try{renderProjects()}catch(err){}try{if(fProject&&!phEdit)renderProjHead()}catch(err){}try{renderBiz()}catch(err){}
    }
    if(e.data?.type==="open-profile")document.getElementById("meBtn")?.click();
    if(e.data?.type==="new-task"){document.querySelector('.seg [data-tab="tasks"]')?.click();const b=document.getElementById("addBtn"),f=document.getElementById("addForm");if(b&&f&&f.hidden)b.click();document.getElementById("nTitle")?.focus()}
  });
}
const postTab=k=>{if(EMBED&&window.parent!==window)try{window.parent.postMessage({type:"pult-tab",tab:k},location.origin)}catch(e){}};

const STAGES=[
  ["idea","💡","Ідея"],["digit","🔢","Оцифровка"],["market","📊","Ринок"],["econ","🧮","Економіка"],["decision","⚖️","Рішення"],
  ["pack","🎁","Упаковка"],["leads","📣","Ліди"],["sales","🤝","Продажі"],["test","✅","Перевірка гіпотези"],["build","🏗","Реалізація"],["run","♻️","Дохід і сервіс"]];
const STAGE_OPS=["ops","⚙️","Операційне"];
const stageOf=k=>STAGES.find(s=>s[0]===k)||(k==="ops"?STAGE_OPS:STAGES[1]);
const stageIdx=k=>STAGES.findIndex(s=>s[0]===k);
const STAGE_HINT={
  idea:"Сформулюйте гіпотезу: що продаємо, кому і чому куплять.",
  digit:"Оцифруйте проєкт у 📐 кошторисі: з чого складається, кількість, ціна, сума → собівартість.",
  market:"Оцініть ринок: ⚡ швидко (ШІ) → 🔬 детально (ШІ) → ✍ конструктор аналогів, де людина вносить свої цифри.",
  econ:"Порахуйте зазор: ціна − собівартість − продажі, маркетинг, партнер, податки, інше = чистий результат.",
  decision:"Рішення засновника: запускаємо / за умов / стоп.",
  pack:"Упаковка: назва, візуалізації, прайс, презентація, лендинг.",
  leads:"Лідогенерація: тест реклами — скільки лідів і почім.",
  sales:"Продажі: перші договори й передоплати.",
  test:"Перевірка гіпотези: ціна, конверсія й маржа підтверджені реальними продажами.",
  build:"Реалізація через виробництво й партнерів — у строк і бюджет.",
  run:"Регулярний дохід: оренда, сервіс, повторні продажі.",
  ops:"Операційний проєкт — без етапів продажу."};
const GOAL_DEF={goal_month_usd:1000000,gross_pct:25,net_pct:50,default_mode:"gross"};
let ogOpen=false,DIRS=[],bizUnits=[],ANL={},anlOpen={},anlPaste=null,bizTab=null,OG=null,ASSETS=[],capData=null,dirNew=null,boqCnt={},bizBooted=false;
const isOwner=()=>!!me?.is_owner;
const dirOf=k=>DIRS.find(d=>d.key===k);
const canEditProj=p=>canManage()||finAll()||(p&&p.owner_id===me?.id);
const usd=n=>n==null||!isFinite(n)?"—":"$"+Math.round(n).toLocaleString("uk-UA");
const toUsd=(n,cur)=>n==null?null:fxConv(Number(n),cur||"UAH","USD");
const median=a=>{const s=[...a].sort((x,y)=>x-y),n=s.length;return n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):null};

/* ---------- завантаження ---------- */
async function loadBiz(){
  const [d,u]=await Promise.all([sb.from("biz_directions").select("*").order("sort"),sb.from("org_units").select("*").order("sort")]);
  DIRS=d.data||[];bizUnits=u.data||[];
  if(isOwner()&&!OG){const {data}=await sb.from("owner_goal").select("*").eq("id",1).maybeSingle();OG=data||{...GOAL_DEF}}
}
/* пульт може стартувати (boot → loadAll) ще до того, як цей файл виконано, тому ініціалізуємось
   з кінця будь-якого loadAll через renderProjects, а свіжі напрями/відділи підтягуємо на кожному loadAll */
let bizInitP=null;
function bizInit(){
  bizInitP??=(async()=>{
    try{await loadBiz();mountBizTabs();bizBooted=true;markProjCards();
      if(EMBED&&window.parent!==window)try{window.parent.postMessage({type:"pult-ready"},location.origin)}catch(e){}
      const first=EMBED?EMBED_TAB:"my";
      if(!location.hash&&!bizTab)document.querySelector(`.seg [data-tab="${first}"]`)?.click();else renderBiz()}
    catch(err){console.error("biz",err);bizInitP=null}
  })();
  return bizInitP;
}
function bizTick(){
  try{markProjCards()}catch(err){console.error("biz",err)}
  if(!bizBooted){bizInit();return}
  if(bizTab&&!document.activeElement?.closest?.("#tabMy,#tabDirs,#tabCap"))renderBiz();
}
const _loadAllBiz=loadAll;
loadAll=async function(){
  await _loadAllBiz.apply(this,arguments);
  if(bizBooted)try{await loadBiz();EVENTS===null||loadEvents();bizTick()}catch(err){console.error("biz",err)}
};

/* ---------- вкладки ---------- */
function mountBizTabs(){
  const seg=document.querySelector('.seg[aria-label="Розділ"]');if(!seg||seg.querySelector('[data-tab="my"]'))return;
  seg.insertAdjacentHTML("afterbegin",`<button type="button" data-tab="my" aria-pressed="false">🏠 Мій пульт</button>`);
  seg.querySelector('[data-tab="projects"]').insertAdjacentHTML("afterend",`<button type="button" data-tab="dirs" aria-pressed="false">🧭 Напрями</button>`);
  /* «Капітал» — лише засновник і лише з його профілю: кнопка у вкладках прихована (нею розділ перемикає оболонка) */
  if(isOwner()){
    seg.insertAdjacentHTML("beforeend",`<button type="button" data-tab="cap" aria-pressed="false" hidden>💎 Капітал</button>`);
    $("#meName").closest(".row").insertAdjacentHTML("afterend",`<div class="row full" id="meCap"><button class="btn" type="button" data-tab="cap">💎 Капітал і дохід засновника</button><span class="meta">Ціль, прогноз, активи — бачите лише ви</span></div>`);
  }
  $("#tabTasks").insertAdjacentHTML("beforebegin",`<div id="tabMy" class="bz" hidden></div><div id="tabDirs" class="bz" hidden></div><div id="tabCap" class="bz" hidden></div>`);
}
function showBizTab(k){
  bizTab=k;["my","dirs","cap"].forEach(x=>{const el=document.getElementById("tab"+x[0].toUpperCase()+x.slice(1));if(el)el.hidden=x!==k});
  if(k)renderBiz();
}
document.addEventListener("click",e=>{
  const tab=e.target.closest("[data-tab]");if(!tab)return;
  const k=tab.dataset.tab;showBizTab(["my","dirs","cap"].includes(k)?k:null);postTab(k);
  if(tab.closest("#meForm"))$("#meForm").hidden=true;
  if(["my","dirs","cap"].includes(k)){document.querySelectorAll(".seg [data-tab]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tab===k));window.scrollTo({top:0});["tasks","projects","tg","team"].forEach(x=>{const el=document.getElementById("tab"+x[0].toUpperCase()+x.slice(1));if(el)el.hidden=true})}
});
window.addEventListener("hashchange",()=>{if(/^#[tp]\//.test(location.hash)){showBizTab(null);postTab("tasks")}});
function renderBiz(){try{renderBiz0()}catch(err){console.error("biz",err);const el=document.getElementById("tab"+(bizTab||"my")[0].toUpperCase()+(bizTab||"my").slice(1));if(el)el.innerHTML=`<div class="empty">Не вдалося показати розділ: ${esc(err.message)}</div>`}}
function renderBiz0(){
  if(bizTab==="my")$("#tabMy").innerHTML=myHtml();
  else if(bizTab==="dirs")$("#tabDirs").innerHTML=dirsHtml();
  else if(bizTab==="cap"){if(!capData)loadCap().then(()=>{if(bizTab==="cap")$("#tabCap").innerHTML=capHtml()});$("#tabCap").innerHTML=capData?capHtml():`<div class="empty">Рахую капітал і дохід…</div>`}
}

/* ---------- 🏠 Мій пульт: кожен бачить свої задачі й проєкти ---------- */
function taskRow(t){
  const nx=nextCheck(t),p=t.project?projects.find(x=>x.name===t.project):null;
  return `<a class="myt s-${dueState(t)}" href="#t/${t.num}"><span class="num">#${t.num}</span><span class="tt">${esc(t.title)}</span>
    <span class="meta">${dueBadge(t)}${t.project?`<span>📁 ${esc(t.project)}${p?.direction?` · ${esc(dirOf(p.direction)?.emoji||"")}`:""}</span>`:""}${t.owner_id!==me?.id?`<span>👤 ${esc(nameOf(t.owner_id))}</span>`:""}${nx?`<span>Далі: ${esc(nx.title)}</span>`:""}</span></a>`;
}
function greet(){const h=+nowHM().slice(0,2);return h<5?"Доброї ночі":h<12?"Доброго ранку":h<18?"Доброго дня":"Доброго вечора"}
function myHtml(){
  if(!me)return `<div class="empty">Ваш email ще не привʼязаний до учасника команди — попросіть Катю додати його в «Команду».</div>`;
  const open=tasks.filter(t=>t.status!=="done");
  const mine=open.filter(t=>t.owner_id===me.id);
  const hot=mine.filter(t=>["overdue","today"].includes(dueState(t))).sort((a,b)=>(a.due||"").localeCompare(b.due||""));
  const next=mine.filter(t=>!hot.includes(t)).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999"));
  const ctl=open.filter(t=>t.controller_id===me.id&&t.owner_id!==me.id);
  const attn=ctl.filter(t=>["overdue","today","none"].includes(dueState(t))||isStale(t));
  const myProj=projects.filter(p=>p.status!=="done"&&p.owner_id===me.id);
  const unit=bizUnits.find(u=>u.id===me.unit_id);
  const week=tasks.filter(t=>t.status==="done"&&t.owner_id===me.id&&t.done_at&&Date.now()-new Date(t.done_at)<7*864e5).length;
  const chip=(n,l,cls)=>`<span class="bz-num ${n&&cls?cls:""}"><b>${n}</b>${l}</span>`;
  const list=(arr,empty,lim)=>arr.length?arr.slice(0,lim||50).map(taskRow).join("")+(arr.length>(lim||50)?`<span class="bz-empty">…ще ${arr.length-lim} — у вкладці «Задачі»</span>`:""):`<div class="bz-empty">${empty}</div>`;
  return `<div class="bz-hello"><h2>${greet()}, ${esc(me.name.split(" ")[0])}</h2><span class="meta">${esc(me.role||"")}${unit?` · ${esc(unit.name)}`:""}</span></div>
    <div class="bz-nums">${chip(hot.length,"горить","bad")}${chip(next.length,"далі")}${chip(ctl.length,"на контролі")}${chip(myProj.length,"моїх проєктів")}${chip(week,"зроблено за 7 днів")}</div>
    <div class="bz-grid">
      <section class="bz-card"><h3>🔥 Сьогодні й прострочене</h3>${list(hot,"Нічого не горить 👍")}</section>
      <section class="bz-card"><h3>➡️ Мої наступні задачі</h3>${list(next,"Відкритих задач немає.",12)}</section>
      <section class="bz-card"><h3>👁 На моєму контролі${attn.length?` · ${attn.length} потребують уваги`:""}</h3>${list(attn.length?attn:ctl,"Нічого не контролюю.",12)}</section>
      <section class="bz-card"><h3>📰 Що сталося в Модулер</h3>${feedHtml2(12)}</section>
      <section class="bz-card"><h3>📁 Мої проєкти</h3>${myProj.length?`<div class="dproj">${myProj.map(projRow).join("")}</div>`:`<div class="bz-empty">Проєктів, де ви відповідальні, немає.</div>`}</section>
    </div>`;
}

/* ---------- 📰 Стрічка: що сталося в усьому ланцюжку (biz_events) ---------- */
let EVENTS=null,evLoading=false;
async function loadEvents(){
  if(evLoading)return;evLoading=true;
  const {data}=await sb.from("biz_events").select("*").gte("at",new Date(Date.now()-3*864e5).toISOString()).order("at",{ascending:false}).limit(60);
  EVENTS=data||[];evLoading=false;if(bizTab==="my"||bizTab==="cap")renderBiz();
}
function feedHtml2(lim){
  if(EVENTS===null){loadEvents();return `<div class="bz-empty">Завантаження…</div>`}
  if(!EVENTS.length)return `<div class="bz-empty">За 3 дні подій у ланцюжку не було. Тут зʼявляться нові ліди, угоди, виробництво, відвантаження, продажі лотів, заявки УК і бронювання.</div>`;
  const day=s=>{const d=new Date(s),t=new Date();const k=d.toDateString()===t.toDateString()?"сьогодні":d.toDateString()===new Date(Date.now()-864e5).toDateString()?"вчора":d.toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit"});return k};
  let last="";
  return EVENTS.slice(0,lim||25).map(e=>{const d=day(e.at),h=d!==last?`<div class="meta" style="font-weight:600;margin-top:4px">${d}</div>`:"";last=d;
    const money=e.amount!=null&&finAll()?` · <b>${esc(fxShow(e.amount,e.currency||"UAH"))}</b>`:"";
    const link=e.task_num?` <a href="#t/${e.task_num}" class="meta">#${e.task_num}</a>`:"";
    return `${h}<div class="myt" style="grid-template-columns:auto 1fr"><span>${esc(e.icon||"•")}</span><span class="tt">${esc(e.title)}${money}${link}<span class="meta" style="display:block">${new Date(e.at).toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"})}${e.direction?` · ${esc(dirOf(e.direction)?.emoji||"")} ${esc(dirOf(e.direction)?.short||"")}`:""}</span></span></div>`}).join("");
}

/* ---------- 🧭 Напрями ---------- */
function projMoney(p){
  const r=FIN[p.name];if(!r?.fin)return null;
  const price=num(p.idea?.price);if(!price)return null;
  const m=finModel(price,r.fin,0);if(!m.ok)return null;
  const plan=num(r.fin.plan_units_month)||0,cur=r.fin.currency||"UAH";
  return {cur,fnd:m.fnd,mod:m.mod,plan,fndM:m.fnd*plan,modM:m.mod*plan-(num(r.fin.opex_month)||0),P:m.P,C:m.C};
}
function projRow(p){
  const st=stageOf(p.stage),ot=tasks.filter(t=>t.project===p.name&&t.status!=="done"),bad=ot.filter(t=>dueState(t)==="overdue").length;
  const ed=canEditProj(p),mm=finAll()?projMoney(p):null;
  return `<div class="dp"><button type="button" class="nm" data-ptasks="${esc(p.name)}">${esc(p.name)}</button><span class="stg">${st[1]} ${esc(st[2])}</span>
    <div class="ctl">${ot.length} відкр.${bad?` · <b style="color:var(--bad)">${bad} простр.</b>`:""} · 👤 ${esc(p.owner_id?nameOf(p.owner_id):"без відповідального")}
      ${mm&&mm.plan?`<span class="money" title="Засновнику на місяць за планом продажів">💎 ${esc(fxShow(mm.fndM,mm.cur))}/міс</span>`:""}
      ${ed?`<span style="flex:1"></span><select data-pdir="${esc(p.name)}" aria-label="Напрям">${opts([["","— спільне"],...DIRS.map(d=>[d.key,d.emoji+" "+d.short])],p.direction||"")}</select><select data-pstage="${esc(p.name)}" aria-label="Етап">${opts([...STAGES,STAGE_OPS].map(s=>[s[0],s[1]+" "+s[2]]),p.stage||"digit")}</select>`:""}</div></div>`;
}
function dirsHtml(){
  const act=projects.filter(p=>p.status!=="done");
  if(finAll())act.forEach(p=>{if(!FIN[p.name]&&!loadFin.bz?.[p.name]){(loadFin.bz??={})[p.name]=1;loadFin(p.name).then(()=>{if(bizTab==="dirs")$("#tabDirs").innerHTML=dirsHtml()})}});
  const funnel=STAGES.map(s=>{const n=act.filter(p=>(p.stage||"digit")===s[0]).length;return `<div class="f ${n?"":"z"}" title="${esc(STAGE_HINT[s[0]])}"><b>${n}</b>${s[1]} ${esc(s[2])}</div>`}).join("");
  const card=d=>{
    const ps=act.filter(p=>(p.direction||null)===(d?d.key:null)).sort((a,b)=>stageIdx(a.stage)-stageIdx(b.stage));
    const unit=d&&bizUnits.find(u=>u.direction===d.key),head=d&&team.find(m=>m.id===(d.head_id||unit?.head_id));
    const money=finAll()?ps.map(projMoney).filter(Boolean):[];
    const sumM=money.reduce((a,x)=>a+(toUsd(x.fndM,x.cur)||0),0);
    const k=d?d.key:"_";
    return `<section class="bz-card dirc">
      <div class="dh"><span class="em">${d?d.emoji:"🧩"}</span><div style="flex:1;min-width:0"><h2>${esc(d?d.name:"Спільне: сайт, ліди, операційка")}</h2>
        <div class="who">${d?(head?`Керівник: <b>${esc(head.name)}</b>${unit?.vacancy?` · <span class="vac">🔎 шукаємо: ${esc(unit.vacancy.split(":")[0])}</span>`:""}`:`<span class="vac">🔎 Вакансія${unit?.vacancy?`: ${esc(unit.vacancy)}`:""}</span>`):`<span class="meta">Проєкти, що працюють на всі напрями</span>`}</div></div></div>
      ${d?`<div class="dfacts"><span>🎯 Результат</span><div>${esc(d.result||"—")}</div><span>🛒 Продає</span><div>${esc(d.sells||"—")}</div><span>💵 Заробляє</span><div>${esc(d.income||"—")}</div><span>📏 Метрики</span><div>${esc(d.metric||"—")}</div>${finAll()&&sumM?`<span>💎 Засновнику</span><div><b>${usd(sumM)}/міс</b> за планами продажів</div>`:""}</div>`:""}
      <div class="dproj">${ps.map(projRow).join("")||`<div class="bz-empty">Проєктів ще немає.</div>`}</div>
      ${dirNew===k?`<div class="row" style="gap:6px;flex-wrap:nowrap"><input id="dn-name" maxlength="80" placeholder="Назва проєкту"><button class="btn primary sm" type="button" data-dnewgo="${k}">Створити</button><button class="btn ghost sm" type="button" data-dnew="${k}">×</button></div>`
        :`<button class="btn sm" type="button" data-dnew="${k}" style="align-self:flex-start">+ Проєкт${d?` у «${esc(d.short)}»`:""}</button>`}
    </section>`};
  return `<div class="bz-hello"><h2>Напрями бізнесу</h2><span class="meta">4 напрями — одна система. Кожен проєкт на старті оцифровується, проходить оцінку ринку й економіку, потім — рішення, упаковка, продажі, реалізація.</span></div>
    <div class="funnel" aria-label="Проєкти за етапами">${funnel}</div>
    <div class="bz-grid">${DIRS.map(card).join("")}${card(null)}</div>`;
}
async function setProj(name,patch,note){
  const p=projects.find(x=>x.name===name);if(!p)return;
  const {error}=await sb.from("task_projects").update(patch).eq("name",name);
  if(error){toast("Не змінено: "+error.message);return}
  Object.assign(p,patch);
  if(note)await sb.from("project_notes").insert({project:name,author_id:me?.id||null,body:note});
  renderBiz();if(fProject===name&&typeof renderProjHead==="function"&&!phEdit)renderProjHead();
}
document.addEventListener("change",async e=>{
  const pd=e.target.closest("[data-pdir]");if(pd){const d=dirOf(pd.value);await setProj(pd.dataset.pdir,{direction:pd.value||null},`🧭 Напрям: ${d?d.emoji+" "+d.name:"спільне"}`);toast("Напрям змінено");return}
  const ps=e.target.closest("[data-pstage]");if(ps){const s=stageOf(ps.value);await setProj(ps.dataset.pstage,{stage:ps.value},`${s[1]} Етап проєкту: ${s[2]}`);toast("Етап: "+s[2]);return}
});
document.addEventListener("click",async e=>{
  const dn=e.target.closest("[data-dnew]");if(dn){dirNew=dirNew===dn.dataset.dnew?null:dn.dataset.dnew;renderBiz();document.getElementById("dn-name")?.focus();return}
  const dg=e.target.closest("[data-dnewgo]");if(dg){
    const name=document.getElementById("dn-name")?.value.trim();if(!name)return;
    if(projects.some(p=>p.name.toLowerCase()===name.toLowerCase())){toast("Проєкт з такою назвою вже є");return}
    const dir=dg.dataset.dnewgo==="_"?null:dg.dataset.dnewgo;dg.disabled=true;
    const {error}=await sb.from("task_projects").insert({name,owner_id:me?.id||null,status:"active",kind:"project",direction:dir,stage:"digit",idea:{decision:"collect"},sort:projects.length});
    if(error){dg.disabled=false;toast("Не створено: "+error.message);return}
    if(finAll())await sb.from("project_fin").upsert({project:name},{onConflict:"project",ignoreDuplicates:true});
    dirNew=null;toast("Проєкт створено — почніть з оцифровки");await loadAll();openProjectTasks(name);return}
});

/* ---------- сторінка проєкту: напрям, етап і «ворота» етапів ---------- */
async function loadBoqCnt(name){
  if(!finAll()&&!FIN[name]?.my?.can){boqCnt[name]={n:0,hidden:true};return}
  const {data}=await sb.from("boq_lines").select("qty,price").eq("project",name);
  boqCnt[name]={n:(data||[]).length,sum:(data||[]).reduce((a,l)=>a+(Number(l.qty)||0)*(Number(l.price)||0),0)};
}
function gatesHtml(p){
  const r=FIN[p.name],est=(typeof EST!=="undefined"&&EST[p.name]||[]).filter(x=>(x.data?.status||"done")==="done"),an=ANL[p.name]||[],b=boqCnt[p.name];
  const price=num(p.idea?.price),cost=r?.fin?num(r.fin.cost):null,hasCost=cost!=null||r?.my?.has_cost;
  const m=r?.fin&&price?finModel(price,r.fin,0):null;
  const g=(ok,ic,t,sub,btn)=>`<div class="gate ${ok?"ok":""}"><span class="ic">${ok?"✅":ic}</span><div><b>${t}</b><span class="meta">${sub}</span>${btn||""}</div></div>`;
  const dec=p.idea?.decision;
  return `<div class="gates">
    ${g(b?.n>0||hasCost,"📐","1. Оцифровка",b?.hidden?"Кошторис бачать ті, кому відкрита фінмодель":b?.n?`У кошторисі ${b.n} рядків`:hasCost?"Собівартість внесено":"Склад, кількість, ціна, сума → собівартість",!b?.hidden&&!b?.n?`<button class="btn sm" type="button" data-gopen="boq">📐 Відкрити кошторис</button>`:"")}
    ${g(est.length>0||an.length>=3,"📊","2. Ринок",`${est.length?`Оцінок: ${est.length}`:"Оцінок ще немає"} · аналогів: ${an.length}`,`<button class="btn sm" type="button" data-gopen="mkt">📊 Оцінити ринок</button>`)}
    ${g(m&&m.C!=null,"🧮","3. Економіка",m?`Модулеру ${Math.round(m.mod/m.P*100)}% з продажу${m.C==null?" (без собівартості)":""}`:"Потрібні ціна й собівартість",!p.idea&&finAll()?`<button class="btn sm" type="button" data-gfin="${esc(p.name)}">🧮 Відкрити економіку</button>`:"")}
    ${g(dec==="go"||dec==="cond",dec==="stop"?"🔴":"⚖️","4. Рішення",dec?({collect:"Збираємо дані",go:"Запускаємо",cond:"Запускаємо за умов",stop:"Стоп"}[dec]||dec):"Рішення засновника")}
  </div>`;
}
function pathHtml(p){
  const ed=canEditProj(p),cur=p.stage||"digit",ci=stageIdx(cur);
  const chips=STAGES.map((s,i)=>`<button type="button" class="${s[0]===cur?"on":ci>=0&&i<ci?"past":""}" ${ed?`data-setstage="${s[0]}"`:"disabled"} title="${esc(STAGE_HINT[s[0]])}">${s[1]} ${esc(s[2])}</button>`).join("");
  return `<div class="full bpath" id="bpath">
    <div class="top"><h3 style="margin:0;font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--accent)">🧭 Шлях проєкту</h3>
      ${ed?`<select data-pdir="${esc(p.name)}" aria-label="Напрям" style="width:auto">${opts([["","🧩 спільне"],...DIRS.map(d=>[d.key,d.emoji+" "+d.name])],p.direction||"")}</select>`:`<span class="pdir">${p.direction?esc(dirOf(p.direction)?.emoji+" "+dirOf(p.direction)?.name):"🧩 спільне"}</span>`}
      ${cur==="ops"?`<span class="stg on">⚙️ Операційне</span>`:""}</div>
    ${cur==="ops"?"":`<div class="chips">${chips}</div><div class="hint">${esc(STAGE_HINT[cur]||"")}</div>`}
    ${["idea","digit","market","econ","decision"].includes(cur)?gatesHtml(p):""}
  </div>`;
}
document.addEventListener("click",async e=>{
  const ss=e.target.closest("[data-setstage]");if(ss&&fProject){e.stopPropagation();const s=stageOf(ss.dataset.setstage);await setProj(fProject,{stage:s[0]},`${s[1]} Етап проєкту: ${s[2]}`);toast("Етап: "+s[2]);return}
  const go=e.target.closest("[data-gopen]");if(go){e.stopPropagation();
    if(go.dataset.gopen==="mkt"){anlOpen[fProject]=true;renderProjHead();document.getElementById("mktBox")?.scrollIntoView({behavior:"smooth",block:"start"});return}
    phOpen?.add?.(fProject);renderProjHead();const b=document.querySelector("#projHead .boq, #projHead [data-boqopen], #projHead .est");b?.scrollIntoView({behavior:"smooth",block:"start"});return}
  const gf=e.target.closest("[data-gfin]");if(gf){e.stopPropagation();const name=gf.dataset.gfin;gf.disabled=true;
    await sb.from("project_fin").upsert({project:name},{onConflict:"project",ignoreDuplicates:true});
    await setProj(name,{idea:{decision:"collect"}},"🧮 Відкрито економіку проєкту: ціна, собівартість, витрати, чистий результат");
    delete FIN[name];phOpen?.add?.(name);await loadFin(name);renderProjHead();return}
},true);

/* ---------- 📊 Оцінка ринку: 3 рівні ---------- */
async function loadAnl(name){const {data}=await sb.from("project_analogs").select("*").eq("project",name).order("created_at");ANL[name]=data||[]}
function anlStats(list,ourPrice){
  const P=list.map(a=>fxConv(num(a.price),a.currency,DISP)).filter(v=>v>0);
  const M2=list.filter(a=>num(a.price)>0&&num(a.area_m2)>0).map(a=>fxConv(num(a.price),a.currency,DISP)/num(a.area_m2));
  const med=median(P);
  return {n:P.length,min:P.length?Math.min(...P):null,max:P.length?Math.max(...P):null,med,m2:median(M2),vs:ourPrice&&med?(ourPrice-med)/med*100:null};
}
function mktHtml(p){
  const name=p.name,list=ANL[name];
  if(list===undefined)return `<div class="full mkt" id="mktBox"><h3 style="margin:0">📊 Оцінка ринку</h3><small class="meta">Завантаження…</small></div>`;
  const est=(typeof EST!=="undefined"&&EST[name]||[]).filter(x=>x.kind==="ai"&&(x.data?.status||"done")==="done");
  const quick=est.find(x=>x.data?.depth!=="deep"),deep=est.find(x=>x.data?.depth==="deep");
  const busy=typeof estBusy!=="undefined"&&estBusy[name];
  const mc=r=>r?`<span>Ринок: <b>${eRange(r.market_low,r.market_high)} ${curSym(DISP)}</b> · рекомендовано <b>${eMoney(r.price)}</b></span><span class="meta">${fmtDT(r.created_at)} · довіра: ${esc(r.data?.confidence||"—")}</span>`:"";
  const ourP=p.idea?.price!=null?fxConv(num(p.idea.price),FIN[name]?.fin?.currency||FIN[name]?.my?.currency||"UAH",DISP):null;
  const st=anlStats(list,ourP);
  const d=deep?.data||{};
  const deepExtra=deep?`<details><summary style="cursor:pointer;font-weight:600">🔬 Детальний аналіз ШІ</summary><div style="display:grid;gap:8px;margin-top:8px;font-size:13px">
      ${d.demand?`<div><b>Попит:</b> ${esc(d.demand)}</div>`:""}
      ${(d.competitors||[]).length?`<div><b>Конкуренти:</b><ul style="margin:4px 0 0;padding-left:18px">${d.competitors.map(c=>`<li>${c.url?`<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>`:esc(c.name)}${c.note?` — ${esc(c.note)}`:""}</li>`).join("")}</ul></div>`:""}
      ${(d.channels||[]).length?`<div><b>Канали продажу:</b> ${d.channels.map(esc).join(" · ")}</div>`:""}
      ${d.price_per_m2?`<div><b>Ціна за м² на ринку:</b> ${eMoney(num(d.price_per_m2.low))}–${eMoney(num(d.price_per_m2.high))} ${curSym(DISP)}</div>`:""}
      ${d.recommendation?`<div><b>Рекомендація:</b> ${esc(d.recommendation)}</div>`:""}</div></details>`:"";
  const row=a=>`<tr data-anl="${a.id}"><td><input data-af="name" value="${esc(a.name)}" aria-label="Назва"></td><td><input data-af="location" value="${esc(a.location||"")}" placeholder="—" aria-label="Локація"></td>
    <td class="n"><input data-af="area_m2" inputmode="decimal" value="${esc(a.area_m2??"")}" style="width:70px" aria-label="Площа"></td>
    <td class="n"><input data-af="price" inputmode="decimal" value="${esc(a.price??"")}" style="width:110px" aria-label="Ціна"></td>
    <td><select data-af="currency" aria-label="Валюта">${opts(CURS.map(c=>[c,curSym(c)]),a.currency)}</select></td>
    <td class="n">${num(a.price)>0&&num(a.area_m2)>0?Math.round(fxConv(num(a.price),a.currency,DISP)/num(a.area_m2)).toLocaleString("uk-UA"):"—"}</td>
    <td><input data-af="url" value="${esc(a.url||"")}" placeholder="https://" aria-label="Посилання">${a.url?` <a href="${esc(a.url)}" target="_blank" rel="noopener" aria-label="Відкрити">↗</a>`:""}</td>
    <td><input data-af="note" value="${esc(a.note||"")}" placeholder="${a.source==="ai"?"знайшов ШІ":""}" aria-label="Примітка"></td>
    <td><button class="icon-btn" type="button" data-anldel="${a.id}" title="Видалити" aria-label="Видалити аналог">×</button></td></tr>`;
  const table=`<div class="an"><div class="tbl"><table><thead><tr><th>Аналог</th><th>Де</th><th class="n">м²</th><th class="n">Ціна</th><th></th><th class="n">${curSym(DISP)}/м²</th><th>Посилання</th><th>Примітка</th><th></th></tr></thead>
      <tbody>${list.map(row).join("")}<tr><td><input id="an-name" placeholder="+ назва аналога"></td><td><input id="an-loc" placeholder="локація"></td><td class="n"><input id="an-area" inputmode="decimal" style="width:70px"></td><td class="n"><input id="an-price" inputmode="decimal" style="width:110px"></td>
      <td><select id="an-cur">${opts(CURS.map(c=>[c,curSym(c)]),DISP)}</select></td><td></td><td><input id="an-url" placeholder="https://"></td><td><input id="an-note"></td><td><button class="btn primary sm" type="button" data-anladd="${esc(name)}">+</button></td></tr></tbody></table></div>
    ${st.n?`<div class="st"><span>Аналогів: <b>${st.n}</b></span><span>Мін: <b>${eMoneyD(st.min)}</b></span><span>Медіана: <b>${eMoneyD(st.med)}</b></span><span>Макс: <b>${eMoneyD(st.max)}</b></span>${st.m2?`<span>Медіана за м²: <b>${eMoneyD(st.m2)}</b></span>`:""}${st.vs!=null?`<span>Наша ціна vs медіана: <b style="color:${st.vs>15?"var(--bad)":st.vs<-15?"var(--warn)":"var(--ok)"}">${st.vs>0?"+":""}${Math.round(st.vs)}%</b></span>`:""}</div>`:""}
    <div class="row" style="gap:6px;flex-wrap:wrap">
      ${st.n&&p.idea&&canEditProj(p)?`<button class="btn sm" type="button" data-anluse="${esc(name)}" title="Записати медіану аналогів як «Ціну ринку» в паспорт проєкту">✓ Медіану — у ціну ринку</button>`:""}
      ${quick||deep?`<button class="btn sm" type="button" data-anlai="${esc(name)}" title="Додати в таблицю аналоги, які знайшов ШІ">⚡ Аналоги з оцінки ШІ</button>`:""}
      <button class="btn sm" type="button" data-anlcsv="${esc(name)}">⬇ Excel (CSV)</button>
      <button class="btn sm" type="button" data-anlpaste="${esc(name)}">⬆ Вставити з Excel</button>
    </div>
    ${anlPaste===name?`<label class="f full">Скопіюйте рядки з Excel або Google Таблиці (стовпці: Назва · Де · м² · Ціна · Валюта · Посилання · Примітка) і вставте сюди<textarea id="an-paste" rows="4" placeholder="Будинок 54 м², Буча	Київська обл.	54	1850000	UAH	https://…	під ключ"></textarea></label><div class="row" style="gap:6px"><button class="btn primary sm" type="button" data-anlimport="${esc(name)}">Додати рядки</button><button class="btn ghost sm" type="button" data-anlpaste="${esc(name)}">Скасувати</button></div>`:""}
  </div>`;
  return `<div class="full mkt" id="mktBox">
    <div class="row" style="justify-content:space-between;gap:8px"><h3 style="margin:0;font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--accent)">📊 Оцінка ринку</h3><span class="meta">За скільки можемо продати і який зазор із собівартістю</span></div>
    ${busy&&typeof busy==="string"?`<div class="hint">${esc(busy)}</div>`:""}
    <div class="lv">
      <div><b>⚡ 1. Загально (ШІ, 1–2 хв)</b><span class="meta">Швидкий погляд: собівартість, діапазон ринку, 3–5 аналогів.</span>${mc(quick)}<button class="btn sm" type="button" data-estai="${esc(name)}"${busy?" disabled":""}>${quick?"Оновити":"Запустити"}</button></div>
      <div><b>🔬 2. Детально (ШІ, 3–5 хв)</b><span class="meta">Глибше: 8–12 аналогів, ціна за м², попит, конкуренти, канали продажу.</span>${mc(deep)}<button class="btn sm" type="button" data-estdeep="${esc(name)}"${busy?" disabled":""}>${deep?"Оновити":"Запустити"}</button></div>
      <div><b>✍ 3. Конструктор (людина)</b><span class="meta">Таблиця аналогів як в Excel: вносите, система рахує медіану, ціну за м² і зазор із нашою ціною.</span><span>Аналогів: <b>${list.length}</b>${st.med?` · медіана <b>${eMoneyD(st.med)}</b>`:""}</span><button class="btn sm" type="button" data-anltoggle="${esc(name)}">${anlOpen[name]?"Згорнути":"Відкрити таблицю"}</button></div>
    </div>
    ${deepExtra}
    ${anlOpen[name]?table:""}
  </div>`;
}
const eMoneyD=v=>v==null?"—":Math.round(v).toLocaleString("uk-UA")+" "+curSym(DISP);
async function runEstimateDeep(name){
  estBusy[name]="🔬 ШІ робить детальний аналіз ринку: шукає 8–12 аналогів, конкурентів, попит і канали продажу… 3–5 хвилин — можна працювати далі.";renderProjHead();
  const {data,error}=await sb.functions.invoke("ai-estimate",{body:{project:name,depth:"deep"}});
  let msg=data?.error||null;
  if(error&&!msg){try{msg=(await error.context?.json?.())?.error}catch(e){}msg=msg||error.message}
  if(msg){delete estBusy[name];toast("Оцінка не вдалася: "+msg);renderProjHead();return}
  await loadEst(name);if(!estPoll[name])pollEst(name);if(fProject===name)renderProjHead();
}
function anlCsv(name){
  const list=ANL[name]||[],q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const rows=[["Назва","Де","Площа м²","Ціна","Валюта","Ціна за м²","Посилання","Примітка","Джерело"],...list.map(a=>[a.name,a.location,a.area_m2,a.price,a.currency,num(a.price)>0&&num(a.area_m2)>0?Math.round(num(a.price)/num(a.area_m2)):"",a.url,a.note,a.source==="ai"?"ШІ":"людина"])];
  const csv="﻿"+rows.map(r=>r.map(q).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const aEl=document.createElement("a");aEl.href=url;aEl.download=`Аналоги — ${name}.csv`;document.body.appendChild(aEl);aEl.click();aEl.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function parsePaste(text){
  return text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
    const c=l.includes("\t")?l.split("\t"):l.split(";");
    const cur=String(c[4]||"").trim().toUpperCase().replace("ГРН","UAH").replace("$","USD").replace("€","EUR");
    return {name:(c[0]||"").trim(),location:(c[1]||"").trim()||null,area_m2:num(c[2]),price:num(String(c[3]||"").replace(/[^\d.,]/g,"")),currency:CURS.includes(cur)?cur:"UAH",url:(c[5]||"").trim()||null,note:(c[6]||"").trim()||null};
  }).filter(r=>r.name&&!/^назва$/i.test(r.name));
}
document.addEventListener("click",async e=>{
  const dp=e.target.closest("[data-estdeep]");if(dp){e.stopPropagation();runEstimateDeep(dp.dataset.estdeep);return}
  const tg=e.target.closest("[data-anltoggle]");if(tg){e.stopPropagation();const n=tg.dataset.anltoggle;anlOpen[n]=!anlOpen[n];renderProjHead();return}
  const ad=e.target.closest("[data-anladd]");if(ad){e.stopPropagation();const name=ad.dataset.anladd,g=id=>document.getElementById(id)?.value.trim()||"";
    if(!g("an-name")){toast("Вкажіть назву аналога");document.getElementById("an-name")?.focus();return}
    ad.disabled=true;
    const {error}=await sb.from("project_analogs").insert({project:name,name:g("an-name"),location:g("an-loc")||null,area_m2:num(g("an-area")),price:num(g("an-price")),currency:g("an-cur")||"UAH",url:g("an-url")||null,note:g("an-note")||null,created_by:me?.id||null});
    if(error){ad.disabled=false;toast("Не додано: "+error.message);return}
    await loadAnl(name);renderProjHead();document.getElementById("an-name")?.focus();return}
  const dl=e.target.closest("[data-anldel]");if(dl){e.stopPropagation();if(!dl.dataset.sure){dl.dataset.sure="1";dl.textContent="?";return}
    const {error}=await sb.from("project_analogs").delete().eq("id",dl.dataset.anldel);if(error){toast("Не видалено: "+error.message);return}
    await loadAnl(fProject);renderProjHead();return}
  const cs=e.target.closest("[data-anlcsv]");if(cs){e.stopPropagation();anlCsv(cs.dataset.anlcsv);return}
  const pa=e.target.closest("[data-anlpaste]");if(pa){e.stopPropagation();anlPaste=anlPaste===pa.dataset.anlpaste?null:pa.dataset.anlpaste;renderProjHead();document.getElementById("an-paste")?.focus();return}
  const im=e.target.closest("[data-anlimport]");if(im){e.stopPropagation();const name=im.dataset.anlimport,rows=parsePaste(document.getElementById("an-paste")?.value||"");
    if(!rows.length){toast("Не знайшов рядків — перевірте, що перший стовпець — назва");return}
    im.disabled=true;const {error}=await sb.from("project_analogs").insert(rows.map(r=>({...r,project:name,created_by:me?.id||null})));
    if(error){im.disabled=false;toast("Не додано: "+error.message);return}
    anlPaste=null;await loadAnl(name);toast(`Додано аналогів: ${rows.length}`);renderProjHead();return}
  const ai=e.target.closest("[data-anlai]");if(ai){e.stopPropagation();const name=ai.dataset.anlai;
    const have=new Set((ANL[name]||[]).map(a=>(a.url||a.name).toLowerCase()));
    const found=(EST[name]||[]).filter(x=>x.kind==="ai"&&(x.data?.status||"done")==="done").flatMap(x=>x.data?.market?.analogs||[]);
    const rows=found.filter(a=>a.name&&!have.has((a.url||a.name).toLowerCase())).map(a=>({project:name,name:String(a.name).slice(0,200),url:a.url||null,price:num(a.price),currency:"UAH",area_m2:num(a.area_m2),location:a.location||null,source:"ai",created_by:me?.id||null}));
    const uniq=[...new Map(rows.map(r=>[(r.url||r.name).toLowerCase(),r])).values()];
    if(!uniq.length){toast("Нових аналогів з оцінок ШІ немає");return}
    ai.disabled=true;const {error}=await sb.from("project_analogs").insert(uniq);if(error){ai.disabled=false;toast("Не додано: "+error.message);return}
    anlOpen[name]=true;await loadAnl(name);toast(`Додано аналогів від ШІ: ${uniq.length} — перевірте ціни й посилання`);renderProjHead();return}
  const us=e.target.closest("[data-anluse]");if(us){e.stopPropagation();const name=us.dataset.anluse,p=projects.find(x=>x.name===name);if(!p)return;
    const st=anlStats(ANL[name]||[]);if(!st.med)return;const mc=FIN[name]?.fin?.currency||FIN[name]?.my?.currency||"UAH";
    const idea={...(p.idea||{}),market:Math.round(fxConv(st.med,DISP,mc))};
    await setProj(name,{idea},`📊 Ціна ринку = медіана ${st.n} аналогів: ${eMoneyD(st.med)}`);toast("Ціну ринку оновлено");return}
},true);
document.addEventListener("change",async e=>{
  const f=e.target.closest("[data-af]");if(!f)return;const tr=f.closest("[data-anl]");if(!tr)return;
  const k=f.dataset.af,v=["price","area_m2"].includes(k)?num(f.value):(f.value.trim()||null);
  if(k==="name"&&!v){toast("Назва не може бути порожньою");return}
  const {error}=await sb.from("project_analogs").update({[k]:v}).eq("id",tr.dataset.anl);
  if(error){toast("Не збережено: "+error.message);return}
  const a=(ANL[fProject]||[]).find(x=>x.id===tr.dataset.anl);if(a)a[k]=v;
  if(["price","area_m2","currency"].includes(k))renderProjHead();
});

const _phBiz=renderProjHead;
renderProjHead=function(){
  _phBiz.apply(this,arguments);
  try{renderProjBiz()}catch(err){console.error("biz",err)}
};
function renderProjBiz(){
  const box=$("#projHead"),p=fProject&&!focusNum&&projects.find(x=>x.name===fProject);
  if(!p||phEdit||!box||box.hidden)return;
  if(ANL[p.name]===undefined&&!loadAnl.busy?.[p.name]){(loadAnl.busy??={})[p.name]=1;loadAnl(p.name).finally(()=>{delete loadAnl.busy[p.name];if(fProject===p.name&&!phEdit)renderProjHead()})}
  if(boqCnt[p.name]===undefined&&!loadBoqCnt.busy?.[p.name]&&FIN[p.name]){(loadBoqCnt.busy??={})[p.name]=1;loadBoqCnt(p.name).finally(()=>{delete loadBoqCnt.busy[p.name];if(fProject===p.name&&!phEdit)renderProjHead()})}
  box.querySelector(":scope > .bpath")?.remove();box.querySelector(":scope > .mkt")?.remove();
  const firstBlock=box.querySelector(":scope > .phdet, :scope > .est, :scope > .passport, :scope > .pnotes");
  const html=pathHtml(p);firstBlock?firstBlock.insertAdjacentHTML("beforebegin",html):box.insertAdjacentHTML("beforeend",html);
  if(p.stage!=="ops"){const est=box.querySelector(":scope > .est"),m=mktHtml(p);est?est.insertAdjacentHTML("afterend",m):(box.querySelector(":scope > .bpath")).insertAdjacentHTML("afterend",m)}
}
/* компактний режим проєкту ховає й оцінку ринку разом з іншими деталями */
document.head.insertAdjacentHTML("beforeend",`<style>#projHead.ph-min > .mkt{display:none!important}</style>`);

/* ---------- 🧮 Фінмодель: частка засновника від валу або від чистого, план на місяць ---------- */
const _finModelBiz=finModel;
finModel=function(price,f,cac){try{return finModelBiz(price,f,cac)}catch(err){console.error("biz",err);return _finModelBiz(price,f,cac)}};
function finModelBiz(price,f,cac){
  const plan=num(f?.plan_units_month),opex=num(f?.opex_month);
  if(f?.founder_mode!=="net"){const m=_finModelBiz(price,f,cac);return Object.assign(m,{plan,opex})}
  const m=_finModelBiz(price,{...f,founder_pct:0},cac);if(!m.ok)return Object.assign(m,{plan,opex});
  const np=num(f.founder_net_pct)??50,base=m.mod;
  m.fnd=Math.max(0,base)*np/100;m.mod=base-m.fnd;m.fp=m.P?Math.round(m.fnd/m.P*1000)/10:0;
  return Object.assign(m,{netMode:true,np,netBase:base,plan,opex});
}
const _wfBiz=wfHtml;
wfHtml=function(m){try{return wfBiz(m)}catch(err){console.error("biz",err);return _wfBiz(m)}};
function wfBiz(m){
  let h=_wfBiz(m);if(!m.ok)return h;
  if(m.netMode)h=h.replace(/Комісія засновника \(([^)]*)\) · [\d.,]+%/,`Частка засновника ($1) · ${m.np}% від чистого`);
  const gp=OG?.gross_pct??GOAL_DEF.gross_pct,npct=OG?.net_pct??GOAL_DEF.net_pct;
  const base=m.netMode?m.netBase:m.mod+m.fnd;
  const cmp=`<div class="monthly"><span>Для порівняння з кожного продажу: <b>${gp}% від валу</b> = ${money(m.P*gp/100)}</span><span><b>${npct}% від чистого</b> = ${money(Math.max(0,base)*npct/100)}</span></div>`;
  const pl=m.plan?`<div class="monthly"><span>📅 План: <b>${m.plan}</b> од./міс</span><span>Виручка <b>${money(m.P*m.plan)}</b></span><span>Засновнику <b>${money(m.fnd*m.plan)}</b></span><span>Модулеру${m.opex?" після постійних витрат":""} <b style="color:${m.mod*m.plan-(m.opex||0)<0?"var(--bad)":"var(--ok)"}">${money(m.mod*m.plan-(m.opex||0))}</b>/міс</span></div>`
    :`<div class="hint">Вкажіть «План продажів, од./міс» — побачите дохід засновника й Модулеру на місяць.</div>`;
  return h+cmp+pl;
}
const _finHtmlBiz=finHtml;
finHtml=function(p,r){try{return finHtmlBiz(p,r)}catch(err){console.error("biz",err);return _finHtmlBiz(p,r)}};
function finHtmlBiz(p,r){
  const h=_finHtmlBiz(p,r),f={...r.fin,...(fDraft[p.name]||{})};
  const extra=`<div class="pgrid2 fmx">
    <label>Частка засновника<select data-fp="founder_mode">${opts([["gross","% від валу (поле «Засновник»)"],["net","% від чистого результату"]],f.founder_mode||"gross")}</select></label>
    <label>Засновник, % від чистого<input data-fp="founder_net_pct" inputmode="decimal" value="${esc(f.founder_net_pct??50)}" placeholder="50"></label>
    <label>План продажів, од./міс<input data-fp="plan_units_month" inputmode="decimal" value="${esc(f.plan_units_month??"")}" placeholder="напр. 2"></label>
    <label>Постійні витрати проєкту, ${curSym(MCUR)}/міс<input data-fp="opex_month" inputmode="decimal" value="${esc(f.opex_month??"")}" placeholder="команда, офіс, реклама"></label></div>`;
  return h.replace("<h4>Інші витрати з продажу</h4>",extra+"<h4>Інші витрати з продажу (податки, доставка, монтаж, партнер з проєкту…)</h4>");
}
const _saveFinBiz=saveFin;
saveFin=async function(name){
  const d=fDraft[name]||{},patch={};
  if("founder_mode" in d)patch.founder_mode=d.founder_mode==="net"?"net":"gross";
  if("founder_net_pct" in d)patch.founder_net_pct=num(d.founder_net_pct)??50;
  ["plan_units_month","opex_month"].forEach(k=>{if(k in d)patch[k]=num(d[k])});
  if(Object.keys(patch).length){const {error}=await sb.from("project_fin").update(patch).eq("project",name);if(error){toast("Не збережено: "+error.message);return}}
  return _saveFinBiz(name);
};

/* ---------- 💎 Капітал: ціль засновника, прогноз, активи, рішення (лише засновник) ---------- */
async function loadCap(){
  const names=projects.filter(p=>p.status!=="done").map(p=>p.name);
  await Promise.all(names.filter(n=>!FIN[n]).map(loadFin));
  const [a,pay,g]=await Promise.all([
    sb.from("owner_assets").select("*").order("sort").order("created_at"),
    sb.from("sale_payments").select("founder_fee,paid_at,sale_id,project_sales(project,currency)").gte("paid_at",new Date(Date.now()-30*864e5).toISOString().slice(0,10)),
    sb.from("owner_goal").select("*").eq("id",1).maybeSingle()]);
  ASSETS=a.data||[];OG=g.data||OG||{...GOAL_DEF};
  /* пасивний дохід: оренда власних будинків за 30 днів мінус частка УК */
  let rent=0;
  try{const since=new Date(Date.now()-30*864e5).toISOString().slice(0,10);
    const [ob,bk]=await Promise.all([sb.from("managed_objects").select("id,owner_kind,uk_share_pct").eq("owner_kind","own"),sb.from("rent_bookings").select("object_id,amount,currency,status,date_to").gte("date_to",since).neq("status","cancelled")]);
    const own=new Map((ob.data||[]).map(o=>[o.id,o]));
    rent=(bk.data||[]).filter(b=>own.has(b.object_id)).reduce((s,b)=>s+(toUsd(b.amount,b.currency)||0)*(1-(Number(own.get(b.object_id).uk_share_pct)||0)/100),0);
  }catch(err){console.error("biz",err)}
  const fact=(pay.data||[]).reduce((s,x)=>s+(toUsd(x.founder_fee,x.project_sales?.currency)||0),0);
  capData={fact,rent,payErr:pay.error?.message||null};
}
function capHtml(){
  const goal=num(OG?.goal_month_usd)||GOAL_DEF.goal_month_usd;
  const act=projects.filter(p=>p.status!=="done");
  const rows=act.map(p=>{const mm=projMoney(p),r=FIN[p.name];const miss=[];
    if(!num(p.idea?.price))miss.push("ціна");if(r?.fin&&num(r.fin.cost)==null)miss.push("собівартість");if(r?.fin&&!num(r.fin.plan_units_month))miss.push("план продажів");if(!r?.fin)miss.push("економіка");
    return {p,mm,miss,usdM:mm?toUsd(mm.fndM,mm.cur)||0:0,usdU:mm?toUsd(mm.fnd,mm.cur)||0:0}}).filter(x=>x.p.stage!=="ops");
  const fc=rows.reduce((a,x)=>a+x.usdM,0),fact=capData.fact;
  const capV=ASSETS.filter(x=>x.status!=="sold").reduce((a,x)=>a+(toUsd(x.value,x.currency)||0),0);
  const capI=ASSETS.filter(x=>x.status!=="sold").reduce((a,x)=>a+(toUsd(x.income_month,x.currency)||0),0);
  const pct=v=>Math.min(100,v/goal*100);
  const byDir=[...DIRS,null].map(d=>({d,v:rows.filter(x=>(x.p.direction||null)===(d?d.key:null)).reduce((a,x)=>a+x.usdM,0),n:rows.filter(x=>(x.p.direction||null)===(d?d.key:null)).length}));
  const dec=tasks.filter(t=>t.status!=="done"&&t.owner_id===me.id&&((t.tags||[]).includes("рішення")||/^рішення/i.test(t.title))).sort((a,b)=>(a.due||"9").localeCompare(b.due||"9"));
  const ideasWait=act.filter(p=>isIdea(p)&&(p.idea?.decision||"collect")==="collect"&&ideaTasks(p.name).length&&ideaTasks(p.name).every(t=>t.status==="done"));
  const won=tasks.filter(t=>t.status==="done"&&t.done_at&&Date.now()-new Date(t.done_at)<7*864e5);
  const top=[...rows].sort((a,b)=>b.usdM-a.usdM);
  const assetRow=x=>`<tr data-asset="${x.id}"><td><input data-as="name" value="${esc(x.name)}" aria-label="Актив"></td>
    <td><select data-as="direction" aria-label="Напрям">${opts([["","—"],...DIRS.map(d=>[d.key,d.emoji+" "+d.short])],x.direction||"")}</select></td>
    <td class="n"><input data-as="value" inputmode="decimal" value="${esc(x.value??"")}" style="width:110px" aria-label="Вартість"></td>
    <td class="n"><input data-as="income_month" inputmode="decimal" value="${esc(x.income_month??"")}" style="width:100px" aria-label="Дохід на місяць"></td>
    <td><select data-as="currency" aria-label="Валюта">${opts(CURS.map(c=>[c,curSym(c)]),x.currency)}</select></td>
    <td><select data-as="status" aria-label="Стан">${opts([["own","володію"],["selling","продаю"],["plan","план"],["sold","продано"]],x.status)}</select></td>
    <td><input data-as="note" value="${esc(x.note||"")}" aria-label="Примітка"></td><td><button class="icon-btn" type="button" data-asdel="${x.id}" aria-label="Видалити актив">×</button></td></tr>`;
  return `<div class="bz-hello"><h2>💎 Капітал і дохід засновника</h2><span class="meta">Бачите лише ви. Команда бачить свої задачі й свою роль — не ціль.</span></div>
    <section class="bz-card cap-goal">
      <div class="row" style="justify-content:space-between;align-items:baseline;gap:10px"><h3>🎯 Ціль: чистий дохід засновника</h3><button type="button" class="btn sm" data-ogopen title="Налаштування цілі й частки засновника" aria-label="Налаштування цілі"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button></div>
      <div class="big">${usd(goal)}<span class="meta" style="font:500 14px var(--body)"> / міс</span></div>
      <div><div class="row" style="justify-content:space-between"><span>Факт за 30 днів: <b>${usd(fact)}</b></span><span class="meta">${(fact/goal*100).toFixed(2)}%</span></div><div class="bar"><i style="width:${pct(fact)}%"></i></div></div>
      <div><div class="row" style="justify-content:space-between"><span>🔑 Пасивний дохід з оренди власних будинків (30 днів): <b>${usd(capData.rent||0)}</b></span><span class="meta">${((capData.rent||0)/goal*100).toFixed(2)}%</span></div><div class="bar"><i style="width:${pct(capData.rent||0)}%"></i></div></div>
      <div><div class="row" style="justify-content:space-between"><span>Прогноз за планами продажів: <b>${usd(fc)}</b>/міс</span><span class="meta">${(fc/goal*100).toFixed(2)}%</span></div><div class="bar"><i class="f" style="width:${pct(fc)}%"></i></div></div>
      <div class="hint">${fc>=goal?"Плани проєктів уже дають ціль — тепер головне виконання.":`До цілі бракує <b>${usd(goal-fc)}</b>/міс. ${rows.some(x=>x.miss.length)?`Спершу доведіть проєкти до цифр: у ${rows.filter(x=>x.miss.length).length} з ${rows.length} бракує ціни, собівартості або плану.`:"Потрібні нові проєкти або більший план продажів."}`}</div>
      ${capData.payErr?`<div class="hint bad">Оплати не завантажились: ${esc(capData.payErr)}</div>`:""}
    </section>
    <div class="bz-grid">
      <section class="bz-card"><h3>🧭 Прогноз за напрямами, /міс</h3><table class="capt"><tbody>${byDir.map(x=>`<tr><td>${x.d?x.d.emoji+" "+esc(x.d.name):"🧩 Спільне"}</td><td class="n">${x.n} пр.</td><td class="n"><b>${usd(x.v)}</b></td></tr>`).join("")}</tbody></table></section>
      <section class="bz-card"><h3>⚖️ Чекає вашого рішення</h3>${dec.length||ideasWait.length?dec.map(taskRow).join("")+ideasWait.map(p=>`<div class="dp"><button type="button" class="nm" data-ptasks="${esc(p.name)}">💡 ${esc(p.name)}</button><span class="stg">перевірку завершено</span></div>`).join(""):`<div class="bz-empty">Рішень, що чекають, немає.</div>`}</section>
      <section class="bz-card"><h3>📰 Стрічка ланцюжка · 3 дні</h3>${feedHtml2(30)}</section>
      <section class="bz-card"><h3>🎉 Зроблено за тиждень · ${won.length}</h3>${won.length?won.sort((a,b)=>b.done_at.localeCompare(a.done_at)).slice(0,8).map(t=>`<a class="myt" href="#t/${t.num}"><span class="num">✓</span><span class="tt">${esc(t.title)}</span><span class="meta"><span>👤 ${esc(nameOf(t.owner_id))}</span>${t.project?`<span>📁 ${esc(t.project)}</span>`:""}</span></a>`).join(""):`<div class="bz-empty">Поки тихо.</div>`}</section>
    </div>
    <section class="bz-card"><h3>📈 Проєкти: скільки дає кожен</h3><div class="tbl"><table class="capt"><thead><tr><th>Проєкт</th><th>Етап</th><th class="n">Засновнику з 1 продажу</th><th class="n">План, од./міс</th><th class="n">Засновнику /міс</th><th>Бракує</th></tr></thead><tbody>
      ${top.map(x=>{const s=stageOf(x.p.stage);return `<tr><td><button type="button" class="plink" data-ptasks="${esc(x.p.name)}" style="text-align:left">${x.p.direction?esc(dirOf(x.p.direction)?.emoji||"")+" ":""}${esc(x.p.name)}</button></td><td><span class="stg">${s[1]} ${esc(s[2])}</span></td><td class="n">${x.mm?usd(x.usdU):"—"}</td><td class="n">${x.mm?.plan||"—"}</td><td class="n"><b>${x.usdM?usd(x.usdM):"—"}</b></td><td>${x.miss.length?`<span class="miss">${x.miss.join(", ")}</span>`:"✓"}</td></tr>`}).join("")}
    </tbody></table></div></section>
    <section class="bz-card"><h3>🏦 Капітал: активи · ${usd(capV)} · пасивний дохід ${usd(capI)}/міс</h3>
      <div class="tbl"><table class="capt"><thead><tr><th>Актив</th><th>Напрям</th><th class="n">Вартість</th><th class="n">Дохід/міс</th><th></th><th>Стан</th><th>Примітка</th><th></th></tr></thead><tbody>${ASSETS.map(assetRow).join("")}</tbody></table></div>
      <button class="btn sm" type="button" data-asadd style="align-self:flex-start">+ Актив</button></section>
    ${ogOpen?`<div class="bz-modal" role="dialog" aria-label="Налаштування цілі" data-ogmodal><div class="bz-modal-box"><div class="row" style="justify-content:space-between;align-items:center"><h3 style="margin:0">⚙️ Налаштування цілі й частки</h3><button type="button" class="btn sm" data-ogclose aria-label="Закрити">✕</button></div>
      <div class="pgrid2"><label class="f">Ціль, $ чистими на місяць<input data-og="goal_month_usd" inputmode="decimal" value="${esc(OG?.goal_month_usd??"")}"></label>
      <label class="f">Моя частка від валу, %<input data-og="gross_pct" inputmode="decimal" value="${esc(OG?.gross_pct??"")}"></label>
      <label class="f">Або від чистого, %<input data-og="net_pct" inputmode="decimal" value="${esc(OG?.net_pct??"")}"></label>
      <label class="f">Для нових проєктів<select data-og="default_mode">${opts([["gross","від валу"],["net","від чистого"]],OG?.default_mode||"gross")}</select></label></div>
      <span class="meta">Ці цифри — орієнтир для порівняння у фінмоделі кожного проєкту. Фактичний % задається в самому проєкті.</span></div></div>`:""}`;
}
document.addEventListener("change",async e=>{
  const og=e.target.closest("[data-og]");if(og){const k=og.dataset.og,v=k==="default_mode"?og.value:num(og.value);if(v==null){toast("Вкажіть число");return}
    const {error}=await sb.from("owner_goal").upsert({id:1,[k]:v,updated_at:new Date().toISOString()});if(error){toast("Не збережено: "+error.message);return}
    OG={...(OG||{}),[k]:v};toast("Збережено");renderBiz();return}
  const as=e.target.closest("[data-as]");if(as){const tr=as.closest("[data-asset]"),k=as.dataset.as,v=["value","income_month"].includes(k)?num(as.value):(as.value.trim()||null);
    if(k==="name"&&!v){toast("Назва не може бути порожньою");return}
    const {error}=await sb.from("owner_assets").update({[k]:v}).eq("id",tr.dataset.asset);if(error){toast("Не збережено: "+error.message);return}
    const x=ASSETS.find(y=>y.id===tr.dataset.asset);if(x)x[k]=v;if(["value","income_month","currency","status"].includes(k))renderBiz();return}
});
document.addEventListener("click",async e=>{
  if(e.target.closest("[data-asadd]")){const {error}=await sb.from("owner_assets").insert({name:"Новий актив",sort:ASSETS.length});if(error){toast("Не додано: "+error.message);return}await loadCap();renderBiz();return}
  const ad=e.target.closest("[data-asdel]");if(ad){if(!ad.dataset.sure){ad.dataset.sure="1";ad.textContent="?";return}
    const {error}=await sb.from("owner_assets").delete().eq("id",ad.dataset.asdel);if(error){toast("Не видалено: "+error.message);return}await loadCap();renderBiz();return}
});

document.addEventListener("click",e=>{
  if(e.target.closest("[data-ogopen]")){ogOpen=true;renderBiz();return}
  if(e.target.closest("[data-ogclose]")||e.target.matches?.("[data-ogmodal]")){ogOpen=false;renderBiz()}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&ogOpen){ogOpen=false;renderBiz()}});
document.head.insertAdjacentHTML("beforeend",`<style>.bz-modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;z-index:40}
.bz-modal-box{background:var(--surface);border-radius:12px;padding:18px;width:min(620px,100%);display:flex;flex-direction:column;gap:12px;box-shadow:0 12px 40px rgba(0,0,0,.2)}</style>`);

/* ---------- Команда → Структура: вакансії керівників ---------- */
if(typeof renderOrg==="function"){
  const _roBiz=renderOrg;
  renderOrg=function(){
    _roBiz.apply(this,arguments);
    try{document.querySelectorAll("#orgBox .ou[data-unit]").forEach(el=>{
      const u=orgUnits.find(x=>x.id===el.dataset.unit);if(!u?.vacancy||el.querySelector(".ou-vac"))return;
      const head=team.find(m=>m.id===u.head_id);
      el.querySelector(".ou-h")?.insertAdjacentHTML("afterend",`<div class="ou-vac">🔎 ${head?`Шукаємо: ${esc(u.vacancy)} · зараз веде ${esc(head.name)}`:`Вакансія: ${esc(u.vacancy)}`}</div>`);
    })}catch(err){console.error("biz",err)}
  };
}

/* ---------- Проєкти: напрям на картці ---------- */
const _rpBiz=renderProjects;
renderProjects=function(){
  _rpBiz.apply(this,arguments);
  try{bizTick()}catch(err){console.error("biz",err)}

};

function markProjCards(){
  document.querySelectorAll("#projGrid .pcard[data-pcard]").forEach(c=>{
    const p=projects.find(x=>x.name===c.dataset.pcard);if(!p||c.querySelector(".pdir"))return;
    const d=dirOf(p.direction),st=stageOf(p.stage);
    c.querySelector("h2")?.closest(".row")?.insertAdjacentHTML("afterend",`<span class="pdir">${d?esc(d.emoji+" "+d.short):"🧩 спільне"} · ${st[1]} ${esc(st[2])}</span>`);
  });
}
{const g=document.getElementById("projGrid");if(g)new MutationObserver(()=>{try{markProjCards()}catch(err){console.error("biz",err)}}).observe(g,{childList:true})}

/* ---------- видалення проєкту й учасника (лише керівники; перевірки — у базі) ---------- */
function mountDeleteBtns(){
  if(!canManage())return;
  document.querySelectorAll("#projGrid [data-psave]").forEach(b=>{if(b.parentElement.querySelector("[data-pdelete]"))return;
    b.parentElement.insertAdjacentHTML("beforeend",`<span style="flex:1"></span><button class="btn ghost sm danger" type="button" data-pdelete="${esc(b.dataset.psave)}" title="Видалити проєкт назавжди (разом з нотатками, кошторисом, фінмоделлю)">🗑 Видалити</button>`)});
  document.querySelectorAll("#teamGrid [data-msave]").forEach(b=>{if(b.parentElement.querySelector("[data-mdelete]"))return;
    const m=team.find(x=>x.id===b.dataset.msave);if(!m||m.is_owner||m.id===me?.id)return;
    b.parentElement.insertAdjacentHTML("beforeend",`<span style="flex:1"></span><button class="btn ghost sm danger" type="button" data-mdelete="${esc(m.id)}" title="Видалити учасника назавжди">🗑 Видалити</button>`)});
}
for(const id of ["projGrid","teamGrid"]){const g=document.getElementById(id);if(g)new MutationObserver(()=>{try{mountDeleteBtns()}catch(err){console.error("biz",err)}}).observe(g,{childList:true,subtree:true})}
async function sureClick(b,label){if(b.dataset.sure)return true;b.dataset.sure="1";const t=b.textContent;b.textContent=label;setTimeout(()=>{if(document.body.contains(b)){delete b.dataset.sure;b.textContent=t}},4000);return false}
document.addEventListener("click",async e=>{
  const pd=e.target.closest("[data-pdelete]");
  if(pd){e.stopPropagation();const name=pd.dataset.pdelete;
    if(!await sureClick(pd,"Точно видалити проєкт?"))return;pd.disabled=true;
    const {data,error}=await sb.rpc("pult_delete_project",{p_name:name});
    if(error){pd.disabled=false;toast(error.message.replace(/^.*?: /,""));return}
    toast(`Проєкт «${name}» видалено${data?.lots?` разом з ${data.lots} лотами`:""}`);editProj=null;if(fProject===name)fProject="";await loadAll();return}
  const md=e.target.closest("[data-mdelete]");
  if(md){e.stopPropagation();const id=md.dataset.mdelete,m=team.find(x=>x.id===id);
    if(!await sureClick(md,"Точно видалити?"))return;md.disabled=true;
    const {error}=await sb.rpc("pult_delete_member",{p_id:id});
    if(error){md.disabled=false;toast(error.message.replace(/^.*?: /,""));return}
    toast(`${m?.name||"Учасника"} видалено`);editMem=null;await loadAll();return}
},true);

/* файл міг завантажитись уже після старту пульту */
if(typeof booted!=="undefined"&&booted&&tasks.length)bizInit();
