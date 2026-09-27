/* ---------- Ідеї: задум → перевірка → рішення → запуск → продажі й комісії (v3, 26.09) ----------
   Відкриті дані (task_projects.idea): ціна, ринок, ліди, умови, рішення — бачить уся команда.
   Закрита фінмодель (project_fin, project_sales, project_fin_access; RLS у базі):
   собівартість, комісії, залишок Модулеру — лише засновник, Катя (fin_all) і ті, кому відкрито проєкт.
   Кожен бачить своє: продавець — свій % і свої продажі; аналітик вносить собівартість, не бачачи моделі. */
document.head.insertAdjacentHTML("beforeend",`<style>
.ideabox{display:flex;flex-direction:column;gap:8px}
.ideabox>h2{font-size:15px}
.irow{display:grid;grid-template-columns:minmax(160px,1.3fr) 150px minmax(160px,2fr) auto;gap:6px 14px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 14px;cursor:pointer}
.irow:hover{border-color:var(--accent)}
.irow b{font:600 15px var(--body)} .irow .meta{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ibar{display:flex;align-items:center;gap:8px;font:600 12px var(--mono);color:var(--muted)}
.ibar i{flex:1;height:6px;border-radius:3px;background:linear-gradient(90deg,var(--ok) var(--p),var(--line) var(--p))}
.verdict{font:600 12px var(--body);padding:3px 10px;border-radius:99px;white-space:nowrap;background:var(--sunk);color:var(--muted)}
.verdict.go{background:var(--ok-bg);color:var(--ok)} .verdict.cond{background:var(--warn-bg);color:var(--warn)} .verdict.stop{background:var(--bad-bg);color:var(--bad)}
.passport{display:flex;flex-direction:column;gap:12px;border:1px solid var(--accent);border-radius:12px;padding:14px;background:color-mix(in srgb,var(--info-bg) 60%,var(--surface))}
.passport h3,.fin h3{margin:0;font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--accent);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pgrid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.pgrid2 label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted)}
.pgrid2 input{font:600 15px var(--mono)}
.calc{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px}
.calc span b{font-family:var(--mono)}
.hint{font-size:14px;border-left:3px solid var(--warn);padding:6px 10px;background:var(--surface);border-radius:0 8px 8px 0}
.hint.good{border-color:var(--ok)} .hint.bad{border-color:var(--bad)}
.dec{display:flex;flex-wrap:wrap;gap:6px}
.dec button{font:500 14px var(--body);border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:6px 12px;cursor:pointer;color:var(--ink)}
.dec button[aria-pressed="true"]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);font-weight:600}
.sales{display:flex;flex-direction:column;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.sales h4,.fin h4{margin:0;font:600 12px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.sale{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:14px;align-items:baseline}
.sale b{font-family:var(--mono)}
.saleform{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.saleform input,.saleform select{width:auto;flex:1;min-width:120px}
.income{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;background:var(--ok-bg);color:var(--ok);border-radius:10px;padding:8px 12px}
.income b{font-family:var(--mono)}
.launch{align-self:flex-start}
.lock{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:14px;background:var(--surface);border:1px dashed var(--line);border-radius:10px;padding:8px 12px}
.lock input{width:auto;flex:1;min-width:140px;font:600 15px var(--mono)}
.fin{display:flex;flex-direction:column;gap:10px;border:1px solid var(--ink);border-radius:12px;padding:12px 14px;background:var(--surface)}
.fin h3{color:var(--ink)}
.who{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;color:var(--muted)}
.who .fchip{font-size:12px}
.who select{width:auto;font-size:13px;padding:3px 6px}
.orow{display:grid;grid-template-columns:minmax(120px,2fr) 90px 130px auto;gap:6px;align-items:center}
.orow input{font:500 14px var(--mono)} .orow input[data-fo$=":l"]{font-family:var(--body)}
.wf{display:flex;flex-direction:column;gap:3px;font-size:14px}
.wf div{display:grid;grid-template-columns:1fr auto 64px;gap:10px;align-items:baseline;padding:3px 0;border-bottom:1px solid var(--line)}
.wf div:last-child{border-bottom:0}
.wf b{font-family:var(--mono);text-align:right} .wf em{font:500 12px var(--mono);color:var(--muted);text-align:right;font-style:normal}
.wf .tot{font-weight:600} .wf .tot b{font-size:16px}
.wf .neg b{color:var(--bad)} .wf .pos b{color:var(--ok)}
.sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:baseline}
.stack{display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--sunk)}
.stack i{display:block;height:100%}
.c-cost{background:var(--muted)} .c-fnd{background:var(--accent)} .c-sel{background:var(--warn)} .c-mkt{background:color-mix(in srgb,var(--warn) 45%,var(--accent))} .c-oth{background:color-mix(in srgb,var(--muted) 45%,var(--line))} .c-mod{background:var(--ok)}
@media (max-width:640px){.irow{grid-template-columns:1fr auto}.irow .ibar,.irow .meta{grid-column:1/-1}.orow{grid-template-columns:1fr 1fr}.orow input[data-fo$=":l"]{grid-column:1/-1}}
</style>`);

const DECISIONS={collect:["⏳","Збираємо дані",""],go:["🟢","Запускаємо","go"],cond:["🟡","Запускаємо за умов","cond"],stop:["🔴","Стоп","stop"]};
const verdictChip=d=>{const v=DECISIONS[d||"collect"]||DECISIONS.collect;return `<span class="verdict ${v[2]}">${v[0]} ${v[1]}</span>`};
const isIdea=p=>p&&p.kind==="idea";
const ideaTasks=name=>tasks.filter(t=>t.project===name&&!(t.tags||[]).some(g=>g==="комісія"||g==="запуск"));
const num=v=>{const n=Number(String(v??"").replace(/\s/g,"").replace(",","."));return isFinite(n)&&String(v??"").trim()!==""?n:null};
const money=n=>n==null?"—":fxShow(n,MCUR);   /* MCUR — валюта моделі, показ — у валюті відображення (fx.js) */
const curOf=name=>FIN[name]?.fin?.currency||FIN[name]?.my?.currency||"UAH";
const pctS=x=>x==null?"—":Math.round(x)+"%";
const finAll=()=>!!(me&&(me.is_owner||me.fin_all));

/* ---------- форма «+ Ідея» ---------- */
$("#projForm").insertAdjacentHTML("afterend",`<form class="panel" id="ideaForm" hidden>
  <h3 class="full" style="margin:0;font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--accent)">💡 Нова ідея</h3>
  <label class="f full">Назва ідеї<input id="iName" required maxlength="80" placeholder="Напр.: Будинок-баня 3×6 для баз відпочинку"></label>
  <label class="f full">Гіпотеза: що, для кого і чому куплять<textarea id="iHyp" rows="2" placeholder="Власники баз відпочинку в Карпатах куплять готову баню 3×6 до 450 тис. грн, бо будувати самим довго"></textarea></label>
  <label class="row full" style="gap:8px;font-size:14px"><input id="iTpl" type="checkbox" checked style="width:auto"> створити 7 задач перевірки: собівартість, ринок, попит, візуалізації, тест реклами, тест продажу, рішення</label>
  <div class="row full"><button class="btn primary" type="submit">Створити ідею</button><button class="btn ghost" type="button" data-close="ideaForm">Скасувати</button></div>
</form>`);
$("#addProjBtn").insertAdjacentHTML("beforebegin",`<button class="btn primary" id="addIdeaBtn" type="button">💡 + Ідея</button>`);
$("#addProjBtn").parentElement.querySelector(".seg").insertAdjacentHTML("afterend",`<span style="flex:1"></span>`);
$("#addProjBtn").parentElement.style.gap="8px";
$("#addIdeaBtn").addEventListener("click",()=>{$("#projForm").hidden=true;$("#addForm").hidden=true;const f=$("#ideaForm");f.hidden=!f.hidden;if(!f.hidden){window.scrollTo({top:0,behavior:"smooth"});$("#iName").focus()}});

async function createIdea(name,hyp,withTasks){
  if(projects.some(p=>p.name.toLowerCase()===name.toLowerCase())){toast("Проєкт з такою назвою вже є");return false}
  const {error}=await sb.from("task_projects").insert({name,description:hyp||null,owner_id:me?.id||null,sort:projects.length,kind:"idea",idea:{decision:"collect"}});
  if(error){toast("Не створено: "+error.message);return false}
  if(withTasks){
    const {error:e2}=await sb.rpc("pult_apply_template",{p_project:name,p_key:"idea",p_creator:me?.id||null});
    if(e2){toast("Ідею створено, але задачі — ні: "+e2.message);return true}
  }
  return true;
}
$("#ideaForm").addEventListener("submit",async e=>{
  e.preventDefault();const name=$("#iName").value.trim();if(!name)return;
  const withT=$("#iTpl").checked;const ok=await createIdea(name,$("#iHyp").value.trim(),withT);if(!ok)return;
  e.target.reset();e.target.hidden=true;toast("Ідею створено"+(withT?" разом із 7 задачами перевірки":""));
  await loadAll();openProjectTasks(name);
});
function openProjectTasks(name){
  view="project";document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view==="project"));
  fProject=name;fPerson="";document.querySelector('[data-tab="tasks"]').click();renderFilters();render();window.scrollTo({top:0,behavior:"smooth"});
}

/* ---------- закриті дані: завантаження ---------- */
const FIN={};           // name -> {my, fin, sales, access}
let salesAll=null;      // продажі, які мені дозволено бачити (для блоку «Ідеї»)
async function loadFin(name){
  const {data:my}=await sb.rpc("pult_my_fin",{p_project:name});
  const r={my:my||{can:false,seller_pct:0,has_cost:false,my_sales:[]},fin:null,sales:[],access:[]};
  if(r.my.can){
    const [f,s,a]=await Promise.all([
      sb.from("project_fin").select("*").eq("project",name).maybeSingle(),
      sb.from("project_sales").select("*").eq("project",name).order("created_at",{ascending:false}),
      sb.from("project_fin_access").select("member_id").eq("project",name)]);
    r.fin=f.data||{project:name,cost:null,founder_pct:10,seller_pct:0,mkt_pct:0,mkt_partner:null,other:[]};
    r.sales=s.data||[];r.access=(a.data||[]).map(x=>x.member_id);
  }
  FIN[name]=r;return r;
}
async function loadSalesAll(){
  const {data}=await sb.from("project_sales").select("project,amount,founder_fee,founder_task");
  salesAll=data||[];
}

/* ---------- відкриті розрахунки (бачить уся команда) ---------- */
function ideaCalc(v,hasCost){
  const price=num(v.price),market=num(v.market),leads=num(v.leads),cpl=num(v.cpl),buyers=num(v.buyers);
  const vsMarket=price&&market?((price-market)/market*100):null;
  const conv=leads&&buyers!=null?(buyers/leads*100):null;
  const cac=leads&&cpl!=null&&buyers?(leads*cpl/buyers):null;
  let hint=["","Заповнюйте цифри з результатів задач — система підкаже, чи тримається ідея."];
  if(price==null||!hasCost)hint=["",`Бракує ${price==null?"нашої ціни":""}${price==null&&!hasCost?" і ":""}${!hasCost?"собівартості":""} — це перші задачі Насті.`];
  else if(vsMarket!=null&&vsMarket>15)hint=["bad",`Наша ціна на ${vsMarket.toFixed(0)}% вища за ринок — потрібна вагома перевага або корекція ціни.`];
  else if(leads==null)hint=["","Ціна й собівартість є. Далі — тест реклами: чи є попит."];
  else if(!buyers)hint=["bad","Ліди є, а готових купити немає — перевірити пропозицію, ціну або аудиторію."];
  else hint=["good",`Попит підтверджено: конверсія ${conv?.toFixed(0)??"—"}%, залучення покупця ${money(cac)}. Рішення — за засновником.`];
  return {price,vsMarket,conv,cac,hint};
}
const calcHtml=c=>{const pct=x=>x==null?"—":(x>0?"+":"")+x.toFixed(0)+"%";
  return `<span>Ціна vs ринок: <b>${pct(c.vsMarket)}</b></span><span>Лід → покупець: <b>${c.conv==null?"—":c.conv.toFixed(0)+"%"}</b></span><span>Залучення покупця: <b>${money(c.cac)}</b></span>`};

/* ---------- закрита фінмодель ---------- */
let pDraft={},fDraft={};
function finModel(price,f,cac){
  const P=num(price),C=num(f.cost),fp=num(f.founder_pct)??0,sp=num(f.seller_pct)??0,mp=num(f.mkt_pct)??0;
  const oth=(f.other||[]).map(o=>({l:o.l||"Інше",pct:num(o.pct),sum:num(o.sum)}));
  if(!P)return {ok:false,P,C,fp,sp,mp,oth};
  const fnd=P*fp/100,sel=P*sp/100,mkt=P*mp/100;
  const othV=oth.map(o=>(o.pct?P*o.pct/100:0)+(o.sum||0)),othT=othV.reduce((a,x)=>a+x,0);
  const acq=cac||0;
  const mod=P-(C||0)-fnd-sel-mkt-othT-acq;
  const pctSum=fp+sp+mp+oth.reduce((a,o)=>a+(o.pct||0),0),fixed=(C||0)+oth.reduce((a,o)=>a+(o.sum||0),0)+acq;
  const minP=pctSum<100?fixed/(1-pctSum/100):null;
  return {ok:true,P,C,fp,sp,mp,fnd,sel,mkt,oth,othV,othT,acq,mod,minP};
}
function wfHtml(m){
  if(!m.ok)return `<div class="hint">Вкажіть «Нашу ціну» в паспорті вище — модель порахує розподіл з кожного продажу.</div>`;
  const row=(cls,l,v,p)=>`<div class="${cls||""}"><span>${l}</span><b>${money(v)}</b><em>${p==null?"":pctS(p)}</em></div>`;
  const pc=v=>v/m.P*100;
  const seg=(c,v)=>v>0?`<i class="${c}" style="width:${Math.min(100,pc(v))}%" title="${money(v)}"></i>`:"";
  const fName=team.find(t=>t.is_owner)?.name||"засновник";
  return `<div class="stack" aria-hidden="true">${seg("c-cost",m.C||0)}${seg("c-fnd",m.fnd)}${seg("c-sel",m.sel)}${seg("c-mkt",m.mkt)}${seg("c-oth",m.othT+m.acq)}${seg("c-mod",Math.max(0,m.mod))}</div>
  <div class="wf">
    ${row("tot","Ціна продажу одного будинку",m.P,100)}
    ${row("",`<span class="sw c-cost"></span>Собівартість`,m.C==null?null:-m.C,m.C==null?null:pc(m.C))}
    ${row("",`<span class="sw c-fnd"></span>Комісія засновника (${esc(fName)}) · ${m.fp}%`,-m.fnd,m.fp)}
    ${row("",`<span class="sw c-sel"></span>Комісія продавця · ${m.sp}%`,-m.sel,m.sp)}
    ${row("",`<span class="sw c-mkt"></span>Партнер з маркетингу${fDraftName(m)} · ${m.mp}%`,-m.mkt,m.mp)}
    ${m.oth.map((o,i)=>row("",`<span class="sw c-oth"></span>${esc(o.l)}${o.pct?` · ${o.pct}%`:""}`,-m.othV[i],pc(m.othV[i]))).join("")}
    ${m.acq?row("",`<span class="sw c-oth"></span>Залучення покупця (з тесту реклами)`,-m.acq,pc(m.acq)):""}
    ${row("tot "+(m.mod<0?"neg":"pos"),`<span class="sw c-mod"></span>Залишок Модулеру на розвиток`,m.mod,pc(m.mod))}
  </div>
  ${m.C==null?`<div class="hint">Собівартості ще немає — залишок завищений. Її вносить Настя.</div>`:
    m.mod<0?`<div class="hint bad">Модулер у мінусі з кожного продажу. Мінімальна ціна, щоб вийти в нуль: <b>${money(m.minP)}</b>.</div>`:
    pc(m.mod)<10?`<div class="hint bad">Модулеру лишається ${pctS(pc(m.mod))} — замало на розвиток. Точка нуля: ${money(m.minP)}.</div>`:
    `<div class="hint good">Модель тримається: Модулеру ${pctS(pc(m.mod))} з кожного будинку. Точка нуля: ${money(m.minP)}.</div>`}`;
}
let _mktName="";const fDraftName=()=>_mktName?` (${esc(_mktName)})`:"";
function finTotalsHtml(r){
  const S=r.sales;if(!S.length)return "";
  const sum=k=>S.reduce((a,x)=>a+(Number(x[k])||0),0),V=sum("amount"),C=num(r.fin.cost);
  const paid=S.filter(x=>x.founder_task&&tasks.find(t=>t.id===x.founder_task)?.status==="done").reduce((a,x)=>a+(Number(x.founder_fee)||0),0);
  const oth=(r.fin.other||[]).reduce((a,o)=>a+(num(o.pct)?V*num(o.pct)/100:0)+(num(o.sum)||0)*S.length,0);
  const mod=C!=null?V-C*S.length-sum("founder_fee")-sum("seller_fee")-sum("mkt_fee")-oth:null;
  return `<div class="income"><span>Продано: <b>${S.length}</b> · вал <b>${money(V)}</b></span><span>Засновнику: <b>${money(sum("founder_fee"))}</b> (виплачено ${money(paid)})</span><span>Продавцям: <b>${money(sum("seller_fee"))}</b></span><span>Маркетингу: <b>${money(sum("mkt_fee"))}</b></span>${mod!=null?`<span>Модулеру на розвиток: <b>${money(mod)}</b></span>`:""}</div>`;
}
function finHtml(p,r){
  const f={...r.fin,...(fDraft[p.name]||{})};_mktName=f.mkt_partner||"";
  const price=num({...(p.idea||{}),...(pDraft[p.name]||{})}.price);
  const cac=ideaCalc({...(p.idea||{}),...(pDraft[p.name]||{})},true).cac;
  const inp=(k,l,ph)=>`<label>${l}<input data-fp="${k}" inputmode="decimal" value="${esc(f[k]??"")}" placeholder="${ph||""}"></label>`;
  const viewers=team.filter(m=>m.active&&(m.is_owner||m.fin_all)).map(m=>`<span class="fchip" title="Бачить усі фінмоделі">${esc(m.name)}</span>`).join("");
  const extra=r.access.map(id=>`<span class="fchip">${esc(nameOf(id))}${finAll()?` <button type="button" class="icon-btn" data-facc-del="${id}" title="Закрити доступ" aria-label="Закрити доступ" style="padding:0 2px">✕</button>`:""}</span>`).join("");
  const cand=team.filter(m=>m.active&&!m.is_ai&&!m.is_owner&&!m.fin_all&&!r.access.includes(m.id));
  const oth=(f.other||[]);
  return `<div class="fin" id="finBox">
    <div class="row" style="justify-content:space-between;gap:10px"><h3>🔒 Фінмодель проєкту</h3><label class="row" style="gap:6px;font-size:13px;color:var(--muted)">Валюта моделі<select data-fcur aria-label="Валюта фінмоделі" style="width:auto">${CURS.map(c=>`<option value="${c}"${c===MCUR?" selected":""}>${c==="UAH"?"₴ гривня":c==="USD"?"$ долар":"€ євро"}</option>`).join("")}</select></label></div>
    ${fxNote(MCUR)}
    <div class="who">Бачать: ${viewers}${extra}${finAll()&&cand.length?`<select data-facc-add aria-label="Відкрити доступ"><option value="">+ відкрити партнеру…</option>${cand.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join("")}</select>`:""}</div>
    <div class="pgrid2">${inp("cost",`Собівартість будинку, ${curSym(MCUR)}`,"від Насті")}${inp("founder_pct","Засновник, % від продажу","10")}${inp("seller_pct","Продавець, % від продажу","напр. 3")}${inp("mkt_pct","Партнер з маркетингу, %","напр. 5")}<label>Хто партнер з маркетингу<input data-fp="mkt_partner" value="${esc(f.mkt_partner||"")}" placeholder="імʼя або компанія"></label></div>
    <h4>Інші витрати з продажу</h4>
    ${oth.map((o,i)=>`<div class="orow"><input data-fo="${i}:l" value="${esc(o.l||"")}" placeholder="Назва: податки, доставка, монтаж…"><input data-fo="${i}:pct" inputmode="decimal" value="${esc(o.pct??"")}" placeholder="%"><input data-fo="${i}:sum" inputmode="decimal" value="${esc(o.sum??"")}" placeholder="або ${curSym(MCUR)}"><button type="button" class="icon-btn" data-fo-del="${i}" title="Прибрати" aria-label="Прибрати">✕</button></div>`).join("")}
    <button type="button" class="btn ghost sm" data-fo-add style="align-self:flex-start">+ витрата</button>
    <div id="finCalc">${wfHtml(finModel(price,f,cac))}</div>
    <div class="row"><button class="btn primary sm" type="button" data-fsave="${esc(p.name)}">Зберегти фінмодель</button><span class="meta" id="fSaved"></span></div>
    ${finTotalsHtml(r)}
  </div>`;
}

/* ---------- продажі: кожен бачить своє ---------- */
function salesHtml(p,r){
  const canLaunch=r.my.all&&["go","cond"].includes(p.idea?.decision)&&!p.idea?.launched_at;
  const launch=`${canLaunch?`<button class="btn primary launch" type="button" data-launch="${esc(p.name)}" title="Створить задачі запуску: прайс, контент, публікації, реклама, продажі, виробництво">🚀 Запустити продаж — команда отримає 7 задач</button>`:""}
    ${p.idea?.launched_at?`<span class="meta">🚀 Запущено ${fmtDT(p.idea.launched_at)} — задачі запуску в списку нижче</span>`:""}`;
  const form=sellerSel=>`<div class="saleform">${sellerSel}<input data-sale="amount" inputmode="decimal" placeholder="Сума продажу, грн"><input data-sale="buyer" placeholder="Покупець"><button class="btn sm" type="button" data-addsale="${esc(p.name)}">+ Продаж</button></div>`;
  if(r.my.can){
    const people=team.filter(m=>m.active&&!m.is_ai);
    const rows=r.sales.map(x=>{const t=x.founder_task&&tasks.find(y=>y.id===x.founder_task);
      return `<div class="sale"><span class="meta">${fmtDT(x.created_at)}</span><b>${money(Number(x.amount))}</b>${x.buyer?`<span>${esc(x.buyer)}</span>`:""}<span>👤 ${esc(nameOf(x.seller_id))}</span><span>засновнику <b>${money(x.founder_fee)}</b> ${t?(t.status==="done"?"✅":`⏳ #${t.num}`):""}</span>${Number(x.seller_fee)?`<span>продавцю <b>${money(x.seller_fee)}</b></span>`:""}${Number(x.mkt_fee)?`<span>маркетингу <b>${money(x.mkt_fee)}</b></span>`:""}</div>`}).join("");
    return `${launch}<div class="sales"><h4>💰 Продажі</h4>${rows||`<span class="meta">Продажів ще немає. Продаж фіксує той, хто продав: комісії рахуються з суми продажу, Оксана одразу отримує задачі на виплату.</span>`}
      ${form(`<select data-sale="seller" aria-label="Хто продав">${people.map(m=>`<option value="${m.id}"${m.id===me?.id?" selected":""}>${esc(m.name)}</option>`).join("")}</select>`)}</div>`;
  }
  const sp=Number(r.my.seller_pct)||0,mine=r.my.my_sales||[];
  const earned=mine.reduce((a,x)=>a+(Number(x.fee)||0),0);
  return `${launch}<div class="sales"><h4>💰 Мої продажі</h4>
    ${sp?`<span>Ваша комісія: <b>${sp}%</b> від суми кожного продажу.</span>`:`<span class="meta">Зафіксуйте продаж — він зарахується вам, бухгалтерія отримає задачу.</span>`}
    ${mine.map(x=>`<div class="sale"><span class="meta">${fmtDT(x.at)}</span><b>${money(Number(x.amount))}</b>${x.buyer?`<span>${esc(x.buyer)}</span>`:""}${Number(x.fee)?`<span>моя комісія <b>${money(x.fee)}</b></span>`:""}</div>`).join("")}
    ${form("")}</div>
    ${earned?`<div class="income"><span>Мої продажі: <b>${mine.length}</b></span><span>Моя комісія: <b>${money(earned)}</b></span></div>`:""}`;
}

/* ---------- паспорт ідеї ---------- */
function passportHtml(p,r){
  MCUR=r.fin?.currency||r.my.currency||"UAH";
  const v={...(p.idea||{}),...(pDraft[p.name]||{})},hasCost=r.my.can?num({...r.fin,...(fDraft[p.name]||{})}.cost)!=null:r.my.has_cost,c=ideaCalc(v,hasCost);
  const lt=ideaTasks(p.name),dn=lt.filter(t=>t.status==="done").length;
  const nx=lt.filter(t=>t.status!=="done").sort((a,b)=>(a.due||"9").localeCompare(b.due||"9"))[0];
  const f=(k,l,ph)=>`<label>${l}<input data-ip="${k}" inputmode="decimal" value="${esc(v[k]??"")}" placeholder="внесе ${ph}"></label>`;
  const costIn=r.my.can?"":`<div class="lock">🔒 <span>Собівартість — у закриту фінмодель${r.my.has_cost?": <b>✓ внесено</b>":""}</span><input data-cost inputmode="decimal" placeholder="${r.my.has_cost?"оновити":"сума"}, ${curSym(MCUR)}"><button class="btn sm" type="button" data-setcost="${esc(p.name)}">Передати</button></div>`;
  return `<div class="full passport" id="passport">
    <h3>💡 Паспорт ідеї ${verdictChip(p.idea?.decision)}</h3>
    <div class="ibar" title="Виконано задач перевірки"><span>Перевірка ${dn}/${lt.length}</span><i style="--p:${lt.length?Math.round(dn/lt.length*100):0}%"></i></div>
    ${nx?`<div class="meta" style="font-family:var(--body)">Далі: <b style="color:var(--ink);font-weight:500">#${nx.num} ${esc(nx.title)}</b> · ${esc(nameOf(nx.owner_id))}${nx.due?" · до "+fmt(nx.due):""}</div>`:""}
    <div class="pgrid2">${f("price",`Наша ціна продажу, ${curSym(MCUR)}`,"Настя")}${f("market",`Ціна ринку (аналоги), ${curSym(MCUR)}`,"Настя")}${f("leads","Ліди з тесту","Анна")}${f("cpl",`Вартість ліда, ${curSym(MCUR)}`,"Анна")}${f("buyers","Готові купити","Поліна")}</div>
    ${costIn}
    <div class="calc">${calcHtml(c)}</div>
    <div class="hint ${c.hint[0]}" id="pHint">${esc(c.hint[1])}</div>
    <label class="f full">Умови запуску<textarea data-ip="conditions" rows="2" placeholder="Запускаємо, якщо: ціна від … грн, мінімум … передоплат, рекламний бюджет до … грн/міс">${esc(v.conditions||"")}</textarea></label>
    ${r.my.all?`<div class="dec" role="group" aria-label="Рішення">${Object.entries(DECISIONS).map(([k,d])=>`<button type="button" data-idec="${k}" aria-pressed="${(v.decision||"collect")===k}">${d[0]} ${d[1]}</button>`).join("")}</div>`:""}
    ${p.idea?.decided_at?`<span class="meta">Рішення: ${esc(p.idea.decided_by||"")} · ${fmtDT(p.idea.decided_at)}</span>`:""}
    <div class="row"><button class="btn primary sm" type="button" data-isave="${esc(p.name)}">Зберегти паспорт</button><span class="meta" id="iSaved"></span></div>
    ${r.my.can?finHtml(p,r):""}
    ${salesHtml(p,r)}
  </div>`;
}
const _projHeadIdeas=renderProjHead;
renderProjHead=function(){
  _projHeadIdeas();
  const p=fProject&&!focusNum&&projects.find(x=>x.name===fProject);
  if(!p||phEdit)return;
  const el=$("#projHead");
  if(isIdea(p)){
    const r=FIN[p.name];
    if(!r){loadFin(p.name).then(()=>{if(fProject===p.name)renderProjHead()});return}
    const html=passportHtml(p,r),notes=el.querySelector(".pnotes");
    notes?notes.insertAdjacentHTML("beforebegin",html):el.insertAdjacentHTML("beforeend",html);
    const h=el.querySelector("h2");if(h&&!h.querySelector(".verdict"))h.insertAdjacentHTML("afterbegin","💡 ");
  }else if(p.status!=="done"&&finAll()){
    el.querySelector("[data-phedit]")?.insertAdjacentHTML("afterend",`<button class="btn ghost sm" type="button" data-toidea="${esc(p.name)}" title="Додати паспорт ідеї й закриту фінмодель">💡 Паспорт ідеї</button>`);
  }
};

/* живий перерахунок без втрати фокусу */
function refreshCalcs(){
  const p=projects.find(x=>x.name===fProject),r=p&&FIN[p.name];if(!p||!r)return;
  MCUR=curOf(p.name);
  const v={...(p.idea||{}),...(pDraft[p.name]||{})};
  const hasCost=r.my.can?num({...r.fin,...(fDraft[p.name]||{})}.cost)!=null:r.my.has_cost;
  const c=ideaCalc(v,hasCost),box=$("#passport");if(!box)return;
  box.querySelector(".calc").innerHTML=calcHtml(c);const h=$("#pHint");h.className="hint "+c.hint[0];h.textContent=c.hint[1];
  if(r.my.can&&$("#finCalc")){const f={...r.fin,...(fDraft[p.name]||{})};_mktName=f.mkt_partner||"";$("#finCalc").innerHTML=wfHtml(finModel(num(v.price),f,c.cac))}
}
document.addEventListener("input",e=>{
  if(!fProject)return;
  const i=e.target.closest("[data-ip]");
  if(i){(pDraft[fProject]??={})[i.dataset.ip]=i.value;if(i.tagName==="INPUT")refreshCalcs();$("#iSaved").textContent="є незбережені зміни";return}
  const r=FIN[fProject];if(!r?.fin)return;
  const d=(fDraft[fProject]??={});
  const fp=e.target.closest("[data-fp]");
  if(fp){d[fp.dataset.fp]=fp.value;refreshCalcs();$("#fSaved").textContent="є незбережені зміни";return}
  const fo=e.target.closest("[data-fo]");
  if(fo){const [ix,k]=fo.dataset.fo.split(":");const oth=(d.other??=JSON.parse(JSON.stringify(r.fin.other||[])));(oth[+ix]??={})[k]=fo.value;refreshCalcs();$("#fSaved").textContent="є незбережені зміни"}
});

async function saveIdea(name,decision){
  const p=projects.find(x=>x.name===name);if(!p)return;
  const d=pDraft[name]||{};const idea={...(p.idea||{})};
  ["price","market","leads","cpl","buyers"].forEach(k=>{if(k in d)idea[k]=num(d[k])});
  delete idea.cost;delete idea.fee_pct;delete idea.sales;
  if("conditions" in d)idea.conditions=d.conditions.trim();
  const changedDec=decision&&decision!==(p.idea?.decision||"collect");
  if(changedDec){idea.decision=decision;idea.decided_at=new Date().toISOString();idea.decided_by=me?.name||""}
  const {error}=await sb.from("task_projects").update({idea}).eq("name",name);
  if(error){toast("Не збережено: "+error.message);return}
  p.idea=idea;delete pDraft[name];
  if(changedDec){const v=DECISIONS[decision],c=ideaCalc(idea,true);
    /* нотатку бачить уся команда — лише відкриті цифри */
    await sb.from("project_notes").insert({project:name,author_id:me?.id||null,body:`${v[0]} Рішення по ідеї: ${v[1]}${idea.conditions?`\nУмови: ${idea.conditions}`:""}\nЦіна ${fmtCur(idea.price,curOf(name))}, ринок ${fmtCur(idea.market,curOf(name))}, лідів ${idea.leads??"—"}, готові купити ${idea.buyers??"—"}.`});
    if(typeof loadPNotes==="function")loadPNotes(name)}
  if(changedDec&&decision==="go"&&!idea.launched_at){await launchIdea(name);return}
  toast(changedDec?`Рішення: ${DECISIONS[decision][1]}`:"Паспорт збережено");renderProjHead();renderProjects();
}
async function saveFin(name){
  const r=FIN[name];if(!r?.fin)return;const d=fDraft[name]||{};
  const patch={updated_at:new Date().toISOString(),updated_by:me?.id||null};
  ["cost","founder_pct","seller_pct","mkt_pct"].forEach(k=>{if(k in d)patch[k]=k==="cost"?num(d[k]):(num(d[k])??0)});
  if("mkt_partner" in d)patch.mkt_partner=d.mkt_partner.trim()||null;
  if("other" in d)patch.other=d.other.map(o=>({l:(o.l||"").trim(),pct:num(o.pct),sum:num(o.sum)})).filter(o=>o.l||o.pct||o.sum);
  const {error}=await sb.from("project_fin").update(patch).eq("project",name);
  if(error){toast("Не збережено: "+error.message);return}
  delete fDraft[name];await loadFin(name);toast("Фінмодель збережено");renderProjHead();
}
async function launchIdea(name){
  const p=projects.find(x=>x.name===name);if(!p||p.idea?.launched_at)return;
  const {data:n,error}=await sb.rpc("pult_apply_template",{p_project:name,p_key:"launch",p_creator:me?.id||null});
  if(error){toast("Запуск не створено: "+error.message);return}
  const idea={...(p.idea||{}),launched_at:new Date().toISOString()};
  await sb.from("task_projects").update({idea}).eq("name",name);p.idea=idea;
  await sb.from("project_notes").insert({project:name,author_id:me?.id||null,body:`🚀 Запуск продажу: команда отримала ${n||7} задач — прайс і КП, контент, виробництво, публікації, реклама, продажі, звіт за 2 тижні.`});
  toast(`🚀 Запуск: ${n||7} задач розписано по команді`);await loadAll();renderProjHead();
}
async function addSale(name){
  const box=$("#passport");const amount=num(box.querySelector('[data-sale="amount"]').value),buyer=box.querySelector('[data-sale="buyer"]').value.trim();
  const sel=box.querySelector('[data-sale="seller"]')?.value||null;
  if(!amount||amount<=0){toast("Вкажіть суму продажу");return}
  const {data,error}=await sb.rpc("pult_record_sale",{p_project:name,p_amount:amount,p_buyer:buyer||null,p_seller:sel});
  if(error){toast("Продаж не збережено: "+error.message);return}
  toast(data?.seller_fee?`💰 Продаж зафіксовано. Ваша комісія ${money(data.seller_fee)}`:"💰 Продаж зафіксовано — бухгалтерія отримала задачі на виплату");
  await Promise.all([loadFin(name),loadSalesAll()]);await loadAll();renderProjHead();
}
async function setCost(name){
  const v=num($("#passport [data-cost]")?.value);if(!v||v<=0){toast("Вкажіть собівартість, "+curSym(curOf(name)));return}
  const {error}=await sb.rpc("pult_fin_set_cost",{p_project:name,p_cost:v});
  if(error){toast("Не передано: "+error.message);return}
  toast("🔒 Собівартість передано у фінмодель");await loadFin(name);renderProjHead();if(typeof loadPNotes==="function")loadPNotes(name);
}
document.addEventListener("change",async e=>{
  const sc=e.target.closest("[data-fcur]");if(sc&&fProject){
    const name=fProject,r=FIN[name],p=projects.find(x=>x.name===name);if(!r?.fin||!p)return;
    const from=r.fin.currency||"UAH",to=sc.value;if(from===to)return;sc.disabled=true;
    const k=fxRate(from)/fxRate(to),cv=v=>v==null||v===""||num(v)==null?(v===""?null:v):Math.round(num(v)*k);
    const d=fDraft[name]||{},pd=pDraft[name]||{};
    const other=(d.other||r.fin.other||[]).map(o=>({...o,sum:cv(o.sum)}));
    const {error}=await sb.from("project_fin").update({currency:to,cost:cv("cost" in d?d.cost:r.fin.cost),other,updated_by:me?.id||null,updated_at:new Date().toISOString()}).eq("project",name);
    if(error){sc.disabled=false;toast("Валюту не змінено: "+error.message);return}
    delete d.cost;delete d.other;
    const idea={...(p.idea||{})};["price","market","cpl"].forEach(x=>{if(idea[x]!=null)idea[x]=cv(idea[x]);if(pd[x]!=null&&pd[x]!=="")pd[x]=String(cv(pd[x]))});
    if(isIdea(p)){await sb.from("task_projects").update({idea}).eq("name",name);p.idea=idea}
    await sb.from("project_notes").insert({project:name,author_id:me?.id||null,body:`💱 Фінмодель переведено з ${curSym(from)} у ${curSym(to)} за курсом НБУ (1 ${curSym(from==="UAH"?to:from)} = ${fmtRate(from==="UAH"?to:from)} грн).`});
    await loadFin(name);toast(`Модель переведено в ${curSym(to)}: собівартість, ціни й витрати перераховано за курсом НБУ`);renderProjHead();if(typeof loadPNotes==="function")loadPNotes(name);return}
  const a=e.target.closest("[data-facc-add]");if(!a||!a.value||!fProject)return;
  const {error}=await sb.from("project_fin_access").insert({project:fProject,member_id:a.value});
  if(error){toast("Не відкрито: "+error.message);return}
  toast("Доступ до фінмоделі відкрито: "+nameOf(a.value));await loadFin(fProject);renderProjHead();
});
document.addEventListener("click",async e=>{
  const s=e.target.closest("[data-isave]");if(s){e.stopPropagation();await saveIdea(s.dataset.isave);return}
  const fs=e.target.closest("[data-fsave]");if(fs){e.stopPropagation();fs.disabled=true;await saveFin(fs.dataset.fsave);return}
  const la=e.target.closest("[data-launch]");if(la){e.stopPropagation();la.disabled=true;await launchIdea(la.dataset.launch);return}
  const as=e.target.closest("[data-addsale]");if(as){e.stopPropagation();as.disabled=true;await addSale(as.dataset.addsale);as.disabled=false;return}
  const sc=e.target.closest("[data-setcost]");if(sc){e.stopPropagation();sc.disabled=true;await setCost(sc.dataset.setcost);return}
  const d=e.target.closest("[data-idec]");if(d&&fProject){e.stopPropagation();await saveIdea(fProject,d.dataset.idec);return}
  const fa=e.target.closest("[data-fo-add]");if(fa&&fProject){e.stopPropagation();const r=FIN[fProject];const dd=(fDraft[fProject]??={});(dd.other??=JSON.parse(JSON.stringify(r.fin.other||[]))).push({l:"",pct:"",sum:""});renderProjHead();return}
  const fd=e.target.closest("[data-fo-del]");if(fd&&fProject){e.stopPropagation();const r=FIN[fProject];const dd=(fDraft[fProject]??={});(dd.other??=JSON.parse(JSON.stringify(r.fin.other||[]))).splice(+fd.dataset.foDel,1);renderProjHead();$("#fSaved").textContent="є незбережені зміни";return}
  const ad=e.target.closest("[data-facc-del]");if(ad&&fProject){e.stopPropagation();
    const {error}=await sb.from("project_fin_access").delete().eq("project",fProject).eq("member_id",ad.dataset.faccDel);
    if(error){toast("Не змінено: "+error.message);return}toast("Доступ закрито");await loadFin(fProject);renderProjHead();return}
  const ti=e.target.closest("[data-toidea]");if(ti){e.stopPropagation();const n=ti.dataset.toidea;
    const {error}=await sb.from("task_projects").update({kind:"idea",idea:{decision:"collect"}}).eq("name",n);if(error){toast("Не змінено: "+error.message);return}
    const p=projects.find(x=>x.name===n);if(p){p.kind="idea";p.idea={decision:"collect"}}delete FIN[n];toast("Проєкт отримав паспорт ідеї й фінмодель");renderProjHead();renderProjects();return}
  const ir=e.target.closest("[data-irow]");if(ir&&!e.target.closest("button")){e.stopPropagation();openProjectTasks(ir.dataset.irow);return}
},true);

/* ---------- вкладка «Проєкти»: блок «Ідеї» зверху ---------- */
const _renderProjectsIdeas=renderProjects;
renderProjects=function(){
  _renderProjectsIdeas();
  document.getElementById("ideaBox")?.remove();
  const okF=p=>projF==="done"?p.status==="done":projF==="all"?true:p.status!=="done";
  const ideas=projects.filter(p=>isIdea(p)&&okF(p));
  ideas.forEach(p=>document.querySelector(`#projGrid [data-pcard="${CSS.escape(p.name)}"]`)?.remove());
  if(!ideas.length)return;
  if(salesAll===null){salesAll=[];loadSalesAll().then(()=>renderProjects());}
  const nSales=n=>salesAll.filter(s=>s.project===n).length;
  const rows=ideas.map(p=>{const lt=ideaTasks(p.name),dn=lt.filter(t=>t.status==="done").length;
    const nx=lt.filter(t=>t.status!=="done").sort((a,b)=>(a.due||"9").localeCompare(b.due||"9"))[0],ns=nSales(p.name);
    return `<div class="irow" data-irow="${esc(p.name)}" role="button" tabindex="0" title="Відкрити ідею"><b>💡 ${esc(p.name)}</b><div class="ibar"><span>${dn}/${lt.length}</span><i style="--p:${lt.length?Math.round(dn/lt.length*100):0}%"></i></div><span class="meta" style="font-family:var(--body)">${nx?`Далі: ${esc(nx.title)} · ${esc(nameOf(nx.owner_id))}`:lt.length?"Усі задачі перевірки виконано":"Задач ще немає"}</span><span class="row" style="gap:6px">${ns?`<span class="verdict go">💰 ${ns}</span>`:""}${p.idea?.launched_at?`<span class="verdict go">🚀</span>`:""}${verdictChip(p.idea?.decision)}</span></div>`}).join("");
  let inc="";MCUR="UAH";   /* salesAll — у гривнях за курсом на дату оплати */
  if(finAll()&&salesAll.length){
    const e=salesAll.reduce((a,x)=>a+(Number(x.founder_fee)||0),0);
    const pd=salesAll.filter(x=>x.founder_task&&tasks.find(t=>t.id===x.founder_task)?.status==="done").reduce((a,x)=>a+(Number(x.founder_fee)||0),0);
    inc=`<span class="income" style="padding:4px 12px">🔒 ${me?.is_owner?"Мій дохід з ідей":"Комісія засновника"}: <b>${money(e)}</b> · виплачено <b>${money(pd)}</b></span>`;
  }
  $("#projGrid").insertAdjacentHTML("beforebegin",`<section class="ideabox" id="ideaBox"><div class="row" style="justify-content:space-between"><h2>💡 Ідеї · ${ideas.length}</h2>${inc}</div>${rows}</section>`);
};
document.addEventListener("keydown",e=>{const r=e.target.closest?.("[data-irow]");if(r&&(e.key==="Enter"||e.key===" ")){e.preventDefault();openProjectTasks(r.dataset.irow)}});
