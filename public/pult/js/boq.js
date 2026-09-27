/* ---------- 📐 Кошторис проєкту (27.09) ----------
   Розділи → рядки «найменування · к-сть · од. · ціна · сума», підсумки, резерв, собівартість на 1 будинок.
   Швидко: параметри (площа, к-сть будинків, периметр…) → кількості рахуються самі; ціни — з довідника розцінок (est_rates) з джерелами.
   Бачать ті, кому відкрита фінмодель (RLS boq_*). Таблиці: boq_sheets, boq_lines, est_rates, est_templates. */
(function(){
document.head.insertAdjacentHTML("beforeend",`<style id="boqCss">
.boq{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--surface)}
.boq-h{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.boq-h h3{flex:1 1 auto;margin:0;font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--accent)}
.boq-h h3 b{text-transform:none;letter-spacing:0;color:var(--ink);margin-left:6px}
.boq .hintline{font-size:13px;color:var(--muted);margin:0}
.boq-par{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;background:var(--sunk);border-radius:8px;padding:10px}
.boq-par label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}
.boq-par input{font-weight:600}
.boq .tbl{overflow-x:auto}
.boq table{min-width:780px;font-size:13.5px;border-collapse:collapse;width:100%}
.boq th{font:600 11px var(--body);text-transform:uppercase;letter-spacing:.04em;color:var(--muted);text-align:left;padding:4px 6px;border-bottom:1px solid var(--line);white-space:nowrap}
.boq td{padding:1px 3px;border-bottom:1px solid var(--line);vertical-align:middle}
.boq .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.boq td input,.boq td select{border:1px solid transparent;background:transparent;padding:4px 6px;width:100%;font:inherit;border-radius:4px;min-width:0}
.boq td input:hover,.boq td select:hover{border-color:var(--line)}
.boq td input:focus,.boq td select:focus{border-color:var(--accent);background:var(--surface);outline:none}
.boq td.n input{text-align:right}
.boq td.q-f input{color:var(--accent)}
.boq td.sum{padding-right:8px}
.boq tr.sec td{background:var(--sunk);font-weight:600;border-bottom:0}
.boq tr.sec td:first-child{border-radius:6px 0 0 6px}.boq tr.sec td:last-child{border-radius:0 6px 6px 0}
.boq tr.sec input{font-weight:600}
.boq tfoot td{font-weight:600;border-bottom:0;padding:6px 8px}
.boq tfoot tr.grand td{font-size:15px;border-top:2px solid var(--ink)}
.boq tfoot input{width:56px;text-align:right;font:inherit;padding:2px 4px}
.boq .ic{vertical-align:middle;border:0;background:none;cursor:pointer;color:var(--muted);padding:2px 5px;border-radius:4px;font-size:13px;text-decoration:none;line-height:1.4}
.boq .ic:hover{background:var(--sunk);color:var(--ink)} .boq .ic.sure{color:var(--bad);font-size:12px}
.boq .acts{white-space:nowrap;text-align:right;width:1%}
.boq col.c-unit{width:78px}.boq col.c-qty{width:92px}.boq col.c-price{width:112px}.boq col.c-cur{width:62px}.boq col.c-sum{width:128px}.boq col.c-act{width:78px}
.boq .kpi{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch}
.boq .kpi>div{background:var(--sunk);border-radius:8px;padding:8px 12px;flex:0 1 auto;min-width:140px}
@media (max-width:560px){.boq .kpi>div{flex:1 1 140px}}
.boq .kpi small{display:block;color:var(--muted);font-size:12px} .boq .kpi b{font-size:17px}
.boq .kpi .go{display:flex;align-items:center;background:none;padding:0}
.boq details.rates{background:var(--sunk);border-radius:8px;padding:8px 12px}
.boq details.rates summary{cursor:pointer;font-size:13px;color:var(--muted)}
.boq details.rates table{min-width:640px;margin-top:6px}
.boq details.rates td{padding:4px 6px;font-size:13px}
.boq details.rates a{color:var(--accent)}
.boq-new{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.boq-new select{width:auto;max-width:100%}
#projHead.ph-min > .boq{display:none!important}
</style>`);

const BOQ={},busy={},parOpen={},tplOpen={};let RATES=null,TPLS=null;
const bNum=v=>{if(v==null)return null;const s=String(v).replace(/[\s  ]/g,"").replace(",",".");if(s==="")return null;const n=Number(s);return isFinite(n)?n:null};
const bFmt=(n,d=2)=>n==null||!isFinite(n)?"":Number(n).toLocaleString("uk-UA",{maximumFractionDigits:d});
const BF={ceil:Math.ceil,round:Math.round,floor:Math.floor,sqrt:Math.sqrt,max:Math.max,min:Math.min};
/* формула кількості: числа, + - * / ( ), параметри кошторису й ceil/round/floor/sqrt/max/min */
function bEval(x,P){
  if(x==null||x==="")return null;const s=String(x).trim();
  if(/^-?\d+([.,]\d+)?$/.test(s))return bNum(s);
  if(!/^[\w\s.+\-*/(),]*$/.test(s))return null;
  const Q={};for(const [k,v] of Object.entries(P||{}))if(/^[a-z_]\w*$/i.test(k))Q[k]=Number(v)||0;
  for(const id of s.match(/[a-z_]\w*/gi)||[])if(!(id in BF)&&!(id in Q))return null;
  try{const v=Function(...Object.keys(BF),...Object.keys(Q),`"use strict";return (${s})`)(...Object.values(BF),...Object.values(Q));return isFinite(v)?v:null}catch(e){return null}
}
const canRates=()=>(typeof finAll==="function"&&finAll())||(typeof canManage==="function"&&canManage());

async function loadRef(){
  if(RATES&&TPLS)return;
  const [r,t]=await Promise.all([sb.from("est_rates").select("*").order("code"),sb.from("est_templates").select("*").order("key",{ascending:false})]);
  RATES=Object.fromEntries((r.data||[]).map(x=>[x.code,x]));TPLS=t.data||[];
}
async function load(name){
  const [s,l]=await Promise.all([sb.from("boq_sheets").select("*").eq("project",name).maybeSingle(),sb.from("boq_lines").select("*").eq("project",name).order("sort").order("updated_at")]);
  BOQ[name]={sheet:s.data||null,lines:l.data||[]};
}
function calc(l,P){
  const q=l.qty_expr?bEval(l.qty_expr,P):bNum(l.qty),p=l.price_expr?bEval(l.price_expr,P):bNum(l.price);
  const s=q!=null&&p!=null?q*p:null;return {q,p,s,sd:s==null?0:fxConv(s,l.currency||"UAH",DISP)};
}
function totals(b){
  const P=b.sheet?.params||{},secs=new Map();let tot=0;
  for(const l of b.lines){const c=calc(l,P);if(!secs.has(l.section))secs.set(l.section,0);secs.set(l.section,secs.get(l.section)+c.sd);tot+=c.sd}
  const rp=bNum(P.reserve_pct)||0,res=tot*rp/100,all=tot+res,units=Math.max(1,bNum(P.plots)||1),hm=bNum(P.house_m2);
  return {P,secs,tot,rp,res,all,units,per:all/units,perM2:hm?all/units/hm:null};
}
const M=n=>bFmt(Math.round(n||0),0);

function rowHtml(l,P){
  const c=calc(l,P),r=l.rate_code&&RATES[l.rate_code],src=r?.sources?.[0];
  const qT=l.qty_expr?`Рахується з параметрів: ${l.qty_expr}. Введіть число — зафіксується вручну`:"Кількість";
  const pT=l.price_expr?`З параметрів: ${l.price_expr}`:r?`Довідник: ${bFmt(r.price)} ${curSym(r.currency)} за ${r.unit} (ринок ${bFmt(r.low)}–${bFmt(r.high)})${r.note?" — "+r.note:""}`:"Ціна за одиницю";
  const diff=r&&!l.price_expr&&bNum(l.price)!=null&&Number(l.price)!==Number(r.price)&&(l.currency||"UAH")===r.currency;
  return `<tr data-bid="${l.id}"><td><input data-bf="name" value="${esc(l.name)}" placeholder="Найменування" aria-label="Найменування"></td>
    <td class="n${l.qty_expr?" q-f":""}"><input data-bf="qty" inputmode="decimal" value="${esc(bFmt(c.q,3))}" title="${esc(qT)}" aria-label="Кількість"></td>
    <td><input data-bf="unit" value="${esc(l.unit||"")}" placeholder="од." aria-label="Одиниця"></td>
    <td class="n${l.price_expr?" q-f":""}"><input data-bf="price" inputmode="decimal" value="${esc(bFmt(c.p))}" title="${esc(pT)}" aria-label="Ціна"></td>
    <td><select data-bf="currency" aria-label="Валюта">${CURS.map(k=>`<option value="${k}"${k===(l.currency||"UAH")?" selected":""}>${curSym(k)}</option>`).join("")}</select></td>
    <td class="n sum" data-bsum="${l.id}">${c.s==null?"—":M(c.sd)}</td>
    <td class="acts">${src?`<a class="ic" href="${esc(src)}" target="_blank" rel="noopener" title="${esc(pT)}">ⓘ</a>`:""}${diff&&canRates()?`<button class="ic" type="button" data-brate="${l.id}" title="Записати цю ціну в довідник (зараз там ${bFmt(r.price)} ${curSym(r.currency)})">↑</button>`:""}<button class="ic" type="button" data-bdel="${l.id}" title="Видалити рядок" aria-label="Видалити рядок">×</button></td></tr>`;
}
function footHtml(T){
  const s=curSym(DISP);
  return `<tr><td colspan="5">Разом за розділами</td><td class="n">${M(T.tot)}</td><td></td></tr>
    <tr><td colspan="5">Резерв на непередбачене <input data-bpar="reserve_pct" inputmode="decimal" value="${esc(bFmt(T.rp,1))}" aria-label="Резерв, %"> %</td><td class="n">${M(T.res)}</td><td></td></tr>
    <tr class="grand"><td colspan="5">Всього, ${s}</td><td class="n">${M(T.all)}</td><td></td></tr>`;
}
function kpiHtml(T,name){
  const s=curSym(DISP),mc=typeof curOf==="function"?curOf(name):"UAH";
  return `<div><small>Всього з резервом</small><b>${M(T.all)} ${s}</b></div>
    ${T.units>1?`<div><small>На 1 будинок з ділянкою (${bFmt(T.units)} шт)</small><b>${M(T.per)} ${s}</b></div>`:""}
    ${T.perM2?`<div><small>За м² будинку, все включно</small><b>${M(T.perM2)} ${s}</b></div>`:""}
    <div class="go"><button class="btn sm primary" type="button" data-bfin="${esc(name)}" title="Записати собівартість ${T.units>1?"одного будинку з ділянкою":"проєкту"} у фінмодель (${curSym(mc)})">→ У фінмодель</button></div>`;
}
function html(p){
  const name=p.name,b=BOQ[name];
  if(!b||!RATES)return `<div class="full boq" id="boqBox"><div class="boq-h"><h3>📐 Кошторис</h3></div><small class="meta">Завантаження…</small></div>`;
  const tplSel=(sel)=>`<select data-btplsel aria-label="Шаблон">${TPLS.map(t=>`<option value="${esc(t.key)}"${t.key===sel?" selected":""}>${esc(t.name)}</option>`).join("")}</select>`;
  if(!b.sheet&&!b.lines.length){
    const guess=/містечк|ділянк|сот/i.test(p.name+" "+(p.description||""))?"town":"blank";
    return `<div class="full boq" id="boqBox"><div class="boq-h"><h3>📐 Кошторис</h3></div>
      <p class="hintline">Розклад витрат по розділах: ділянка, поділ, проєктування, паркан, електрика, вода, каналізація, фундаменти, будинки… Кількості рахуються з кількох параметрів (площа, к-сть будинків, периметр), ціни — з довідника розцінок з джерелами. Далі все правиться вручну.</p>
      <div class="boq-new">${tplSel(guess)}<button class="btn primary sm" type="button" data-bnew="${esc(name)}">Створити кошторис</button></div></div>`;
  }
  const T=totals(b),P=T.P,tpl=TPLS.find(t=>t.key===b.sheet?.template);
  const defs=(tpl?.params||Object.keys(P).map(k=>({k,l:k,u:""}))).filter(d=>d.k!=="reserve_pct");
  const open=parOpen[name]??!b.lines.length;
  const par=open?`<div class="boq-par">${defs.map(d=>`<label>${esc(d.l)}${d.u?`, ${esc(d.u)}`:""}<input data-bpar="${esc(d.k)}" inputmode="decimal" value="${esc(bFmt(P[d.k],3))}"></label>`).join("")}</div>
    <p class="hintline">Змініть параметр — кількості в рядках, позначених <span style="color:var(--accent)">зеленим</span>, перерахуються. Число, введене в рядок вручну, фіксується.</p>`:"";
  const tplBox=tplOpen[name]?`<div class="boq-new">${tplSel(b.sheet?.template||"town")}<button class="btn sm" type="button" data-bnew="${esc(name)}">Перебудувати з шаблону</button><span class="meta">Рядки кошторису буде замінено; параметри збережуться.</span></div>`:"";
  const order=[];for(const l of b.lines)if(!order.includes(l.section))order.push(l.section);
  const body=order.map(sec=>`<tr class="sec"><td colspan="5"><input data-bsec="${esc(sec)}" value="${esc(sec)}" aria-label="Назва розділу"></td><td class="n" data-bsecsum="${esc(sec)}">${M(T.secs.get(sec))}</td><td class="acts"><button class="ic" type="button" data-badd="${esc(sec)}" title="Додати рядок у розділ «${esc(sec)}»" aria-label="Додати рядок">+</button></td></tr>
    ${b.lines.filter(l=>l.section===sec).map(l=>rowHtml(l,P)).join("")}`).join("");
  const used=[...new Set(b.lines.map(l=>l.rate_code).filter(Boolean))].map(c=>RATES[c]).filter(Boolean);
  const rates=used.length?`<details class="rates"><summary>📚 Довідник розцінок: ${used.length} позицій — діапазони цін і джерела</summary><div class="tbl"><table><thead><tr><th>Позиція</th><th class="n">Ціна</th><th class="n">Ринок від–до</th><th>Джерела й примітка</th></tr></thead><tbody>
    ${used.map(r=>`<tr><td>${esc(r.name)}<br><small class="meta">за ${esc(r.unit)}</small></td><td class="n">${canRates()?`<input data-rprice="${esc(r.code)}" inputmode="decimal" value="${esc(bFmt(r.price))}" style="width:90px;text-align:right" aria-label="Ціна в довіднику">`:bFmt(r.price)} ${curSym(r.currency)}</td><td class="n">${bFmt(r.low)}–${bFmt(r.high)}</td><td>${(r.sources||[]).map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(new URL(u).hostname.replace(/^www\./,""))}</a>`).join(" · ")}${r.note?`<br><small class="meta">${esc(r.note)}</small>`:""}</td></tr>`).join("")}
    </tbody></table></div><small class="meta">Ціни — орієнтири з відкритих джерел (вересень 2026). Змінена тут ціна діє для нових кошторисів; у рядку — кнопка ↑ записує ціну з кошторису в довідник.</small></details>`:"";
  return `<div class="full boq" id="boqBox"><div class="boq-h"><h3>📐 Кошторис<b id="boqHT">${M(T.all)} ${curSym(DISP)}</b></h3>
      <button class="btn sm" type="button" data-bparbtn="${esc(name)}" aria-expanded="${open}">⚙ Параметри</button>
      <button class="btn sm" type="button" data-bsecadd="${esc(name)}">＋ Розділ</button>
      <button class="icon-btn" type="button" data-btplbtn="${esc(name)}" title="Шаблон кошторису" aria-label="Шаблон кошторису">⋯</button></div>
    ${tplBox}${par}
    <div class="kpi" id="boqKpi">${kpiHtml(T,name)}</div>
    <div class="tbl"><table><colgroup><col><col class="c-qty"><col class="c-unit"><col class="c-price"><col class="c-cur"><col class="c-sum"><col class="c-act"></colgroup>
      <thead><tr><th>Найменування</th><th class="n">К-сть</th><th>Од.</th><th class="n">Ціна</th><th>Вал.</th><th class="n">Сума, ${curSym(DISP)}</th><th></th></tr></thead>
      <tbody>${body}</tbody><tfoot id="boqFoot">${footHtml(T)}</tfoot></table></div>
    ${rates}</div>`;
}
/* оновити числа на місці, не чіпаючи поле, в якому зараз курсор */
function nums(name){
  const b=BOQ[name],box=document.getElementById("boqBox");if(!b||!box)return;
  const T=totals(b),ae=document.activeElement;
  for(const l of b.lines){
    const c=calc(l,T.P),tr=box.querySelector(`tr[data-bid="${l.id}"]`);if(!tr)continue;
    tr.querySelector("[data-bsum]").textContent=c.s==null?"—":M(c.sd);
    for(const [f,v,ex] of [["qty",c.q,l.qty_expr],["price",c.p,l.price_expr]]){const i=tr.querySelector(`[data-bf="${f}"]`);if(i!==ae)i.value=bFmt(v,f==="qty"?3:2);i.parentElement.classList.toggle("q-f",!!ex)}
  }
  box.querySelectorAll("[data-bsecsum]").forEach(td=>td.textContent=M(T.secs.get(td.dataset.bsecsum)));
  const foot=document.getElementById("boqFoot");if(foot&&!foot.contains(ae))foot.innerHTML=footHtml(T);
  else if(foot){const rows=foot.querySelectorAll("tr");rows[0].cells[1].textContent=M(T.tot);rows[1].cells[1].textContent=M(T.res);rows[2].cells[1].textContent=M(T.all)}
  document.getElementById("boqKpi").innerHTML=kpiHtml(T,name);
  document.getElementById("boqHT").textContent=`${M(T.all)} ${curSym(DISP)}`;
}
function rerender(name,focusSel){
  if(fProject!==name)return;const old=document.getElementById("boqBox"),p=projects.find(x=>x.name===name);
  if(!old||!p){renderProjHead();return}
  old.outerHTML=html(p);if(typeof mountCollapse==="function")mountCollapse();
  if(focusSel){const el=document.querySelector(focusSel);if(el){el.focus();el.select?.()}}
}
function mount(){
  const box=$("#projHead"),p=fProject&&!focusNum&&projects.find(x=>x.name===fProject);
  if(!box||!p||(typeof phEdit!=="undefined"&&phEdit)||box.hidden)return;
  const f=FIN[p.name];if(!f?.my?.can)return;
  if((BOQ[p.name]===undefined||!RATES)&&!busy[p.name]){busy[p.name]=1;Promise.all([loadRef(),load(p.name)]).catch(e=>console.warn("boq",e)).finally(()=>{delete busy[p.name];rerender(p.name)})}
  box.querySelector(":scope > .boq")?.remove();
  const h=html(p),est=box.querySelector(":scope > .est"),anchor=box.querySelector(":scope > .passport")||box.querySelector(":scope > .pnotes");
  est?est.insertAdjacentHTML("afterend",h):anchor?anchor.insertAdjacentHTML("beforebegin",h):box.insertAdjacentHTML("beforeend",h);
  if(typeof mountCollapse==="function")mountCollapse();
  const sp=box.querySelector(":scope > .phdet span");if(sp&&!/кошторис/.test(sp.textContent))sp.textContent=sp.textContent.replace(/^оцінка/,"оцінка, кошторис");
}
const stamp=()=>({updated_by:me?.id||null,updated_at:new Date().toISOString()});
async function saveLine(l,patch){Object.assign(l,patch);const {error}=await sb.from("boq_lines").update({...patch,...stamp()}).eq("id",l.id);if(error)toast("Не збережено: "+error.message)}
async function saveParams(name){
  const b=BOQ[name],P=b.sheet.params;
  const {error}=await sb.from("boq_sheets").update({params:P,...stamp()}).eq("project",name);if(error){toast("Параметри не збережено: "+error.message);return}
  await Promise.all(b.lines.filter(l=>l.qty_expr||l.price_expr).map(l=>{const c=calc(l,P),patch={};
    if(l.qty_expr&&c.q!==Number(l.qty))patch.qty=c.q;if(l.price_expr&&c.p!==Number(l.price))patch.price=c.p;
    if(!Object.keys(patch).length)return null;Object.assign(l,patch);return sb.from("boq_lines").update(patch).eq("id",l.id)}));
}
async function applyTpl(name,key){
  await loadRef();const t=TPLS.find(x=>x.key===key);if(!t)return;
  const old=BOQ[name]?.sheet?.params||{},P={};for(const d of t.params||[])P[d.k]=old[d.k]??d.v;
  const si=s=>{const i=(t.sections||[]).indexOf(s);return i<0?99:i};
  let rows=(t.lines||[]).map((x,i)=>{const r=x.r&&RATES[x.r],num=/^-?\d+([.,]\d+)?$/.test(String(x.q||"").trim());
    return {project:name,section:x.s,sort:si(x.s)*100+i,name:x.n,unit:x.u||r?.unit||null,qty_expr:x.q&&!num?x.q:null,qty:bEval(x.q,P),
      price_expr:x.p||null,price:x.p?bEval(x.p,P):(r?.price??null),currency:x.c||r?.currency||"UAH",rate_code:r?x.r:null,...stamp()}});
  if(!rows.length)rows=(t.sections||["Роботи"]).map((s,i)=>({project:name,section:s,sort:i*100,name:"",currency:"UAH",...stamp()}));
  const {error:e1}=await sb.from("boq_sheets").upsert({project:name,template:key,params:P,...stamp()},{onConflict:"project"});
  if(e1){toast("Не створено: "+e1.message);return}
  await sb.from("boq_lines").delete().eq("project",name);
  const {error:e2}=await sb.from("boq_lines").insert(rows);if(e2)toast("Рядки не збережено: "+e2.message);
  parOpen[name]=true;tplOpen[name]=false;await load(name);rerender(name);
}
function lineOf(el){const id=el.closest("tr[data-bid]")?.dataset.bid,b=BOQ[fProject];return b&&b.lines.find(l=>l.id===id)}

window.addEventListener("click",async e=>{
  const box=e.target.closest("#boqBox");if(!box)return;const name=fProject,b=BOQ[name];
  const t=e.target.closest("[data-bnew],[data-bparbtn],[data-btplbtn],[data-bsecadd],[data-badd],[data-bdel],[data-brate],[data-bfin]");if(!t)return;
  e.stopPropagation();
  if(t.dataset.bnew!==undefined){const key=box.querySelector("[data-btplsel]")?.value||"town";
    if(b?.lines.length&&!t.dataset.sure){t.dataset.sure="1";t.textContent="Замінити всі рядки? Натисніть ще раз";return}
    t.disabled=true;t.textContent="Створюю…";await applyTpl(name,key);return}
  if(t.dataset.bparbtn!==undefined){parOpen[name]=!(parOpen[name]??!b.lines.length);rerender(name);return}
  if(t.dataset.btplbtn!==undefined){tplOpen[name]=!tplOpen[name];rerender(name);return}
  if(t.dataset.bsecadd!==undefined||t.dataset.badd!==undefined){
    const sec=t.dataset.badd??"Новий розділ",inSec=b.lines.filter(l=>l.section===sec);
    const sort=inSec.length?Math.max(...inSec.map(l=>l.sort))+1:Math.max(0,...b.lines.map(l=>l.sort))+100;
    const {data,error}=await sb.from("boq_lines").insert({project:name,section:sec,sort,name:"",currency:"UAH",...stamp()}).select().single();
    if(error||!data){toast("Не додано: "+(error?.message||"немає відповіді"));return}
    b.lines.push(data);b.lines.sort((x,y)=>x.sort-y.sort);
    rerender(name,t.dataset.badd!==undefined?`tr[data-bid="${data.id}"] [data-bf="name"]`:`[data-bsec="${sec}"]`);return}
  if(t.dataset.bdel){if(!t.dataset.sure){t.dataset.sure="1";t.classList.add("sure");t.textContent="видалити?";return}
    const {error}=await sb.from("boq_lines").delete().eq("id",t.dataset.bdel);if(error){toast("Не видалено: "+error.message);return}
    b.lines=b.lines.filter(l=>l.id!==t.dataset.bdel);rerender(name);return}
  if(t.dataset.brate){const l=b.lines.find(x=>x.id===t.dataset.brate),r=l&&RATES[l.rate_code];if(!r)return;
    const {error}=await sb.from("est_rates").update({price:Number(l.price),...stamp()}).eq("code",r.code);if(error){toast("Довідник не оновлено: "+error.message);return}
    r.price=Number(l.price);toast("Ціну записано в довідник: "+r.name);rerender(name);return}
  if(t.dataset.bfin){const T=totals(b),mc=typeof curOf==="function"?curOf(name):"UAH",cost=Math.round(fxConv(T.per,DISP,mc));
    t.disabled=true;
    const {error}=await sb.from("project_fin").upsert({project:name,cost,...stamp()},{onConflict:"project"});
    if(error){t.disabled=false;toast("Не перенесено: "+error.message);return}
    await loadFin(name);toast(`Собівартість ${T.units>1?"1 будинку ":""}у фінмоделі: ${bFmt(cost,0)} ${curSym(mc)}`);renderProjHead();return}
},true);

document.addEventListener("keydown",e=>{
  if(!e.target.closest?.("#boqBox"))return;
  if(e.key==="Enter"&&e.target.matches("input")){e.preventDefault();e.target.blur()}
});
document.addEventListener("change",async e=>{
  const el=e.target;if(!el.closest?.("#boqBox"))return;const name=fProject,b=BOQ[name];if(!b)return;
  if(el.dataset.bpar){if(!b.sheet)return;b.sheet.params={...(b.sheet.params||{}),[el.dataset.bpar]:bNum(el.value)};nums(name);await saveParams(name);nums(name);return}
  if(el.dataset.bsec!==undefined){const from=el.dataset.bsec,to=el.value.trim()||from;if(to===from)return;
    if(b.lines.some(l=>l.section===to)){toast("Такий розділ уже є");el.value=from;return}
    const {error}=await sb.from("boq_lines").update({section:to,...stamp()}).eq("project",name).eq("section",from);if(error){toast("Не перейменовано: "+error.message);el.value=from;return}
    b.lines.forEach(l=>{if(l.section===from)l.section=to});rerender(name);return}
  if(el.dataset.rprice){const r=RATES[el.dataset.rprice],v=bNum(el.value);if(!r||v==null)return;
    const {error}=await sb.from("est_rates").update({price:v,...stamp()}).eq("code",r.code);if(error){toast("Довідник не оновлено: "+error.message);return}
    r.price=v;toast("Довідник оновлено: "+r.name);return}
  const f=el.dataset.bf;if(!f)return;const l=lineOf(el);if(!l)return;
  if(f==="qty"){const v=bNum(el.value);await saveLine(l,{qty:v,qty_expr:null})}
  else if(f==="price"){const v=bNum(el.value);await saveLine(l,{price:v,price_expr:null})}
  else if(f==="currency")await saveLine(l,{currency:el.value});
  else await saveLine(l,{[f]:el.value.trim()||(f==="name"?"":null)});
  nums(name);
});

function init(){
  if(typeof PC_BLOCKS!=="undefined"&&!PC_BLOCKS.some(x=>x[0]==="boq"))PC_BLOCKS.push(["boq","#projHead .boq",":scope > .boq-h"]);
  const _ph=renderProjHead;renderProjHead=function(){const r=_ph.apply(this,arguments);try{mount()}catch(e){console.warn("boq",e)}return r};
  if(fProject)renderProjHead();
}
document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();
