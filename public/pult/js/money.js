/* ---------- Реальні гроші (26.09): договір → оплати клієнта → комісії з фактичних оплат ----------
   Продаж = договір. Комісії (засновник, продавець, маркетинг) нараховуються з кожної оплати.
   Оплату вносить Оксана у своїй задачі «Прийняти оплату» або той, кому відкрита фінмодель;
   надходження по привʼязаній угоді Moduler Pro підтягуються самі (cron pult-mp-sync, лише читання Moduler Pro). */
document.head.insertAdjacentHTML("beforeend",`<style>
.sale2{display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(170px,1fr) auto;gap:6px 14px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px}
.sale2:last-of-type{border-bottom:0}
.sale2 b{font-family:var(--mono)} .sale2 small{display:block;color:var(--muted);font-size:12px}
.paybar{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}
.paybar i{display:block;height:6px;border-radius:3px;background:linear-gradient(90deg,var(--ok) var(--p),var(--line) var(--p))}
.fees{font-size:12px;color:var(--muted)} .fees b{color:var(--ink)}
.dealchip{display:inline-block;font:500 12px var(--body);background:var(--info-bg);color:var(--accent);border-radius:99px;padding:1px 8px;margin-top:2px}
.payform{display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:var(--sunk);border-radius:10px;padding:8px;grid-column:1/-1}
.payform input{width:auto;flex:1;min-width:110px}
.saleform select[data-sale="deal"]{min-width:220px}
.payform select,.saleform select[data-sale="currency"]{width:auto;flex:none;min-width:64px}
.saleform label.chk input{flex:none;width:auto;min-width:0}
.saleform label.chk{display:inline-flex;gap:6px;align-items:center;font-size:13px;color:var(--muted);flex:none;white-space:nowrap}
.paybox{margin:0 14px 10px;border:1px solid var(--accent);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:color-mix(in srgb,var(--info-bg) 60%,var(--surface));font-size:14px}
.paybox h4{margin:0;font:600 12px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--accent)}
@media (max-width:640px){.sale2{grid-template-columns:1fr}}
</style>`);

let mpDeals=null,payOpen=null;const saleByTask={};
const D=v=>fmtCur(v,DISP);
/* оплата у валюті відображення за курсом на дату оплати: k — поле у валюті оплати (amount) або у валюті договору (fees) */
const pD=(p,k)=>fxConv((Number(p[k])||0)*(k==="amount"?Number(p.rate)||1:Number(p.sale_rate)||1),"UAH",DISP,p.paid_at);
const pTxt=p=>`${fmt(p.paid_at||p.at)} — <b>${fmtCur(p.amount,p.currency||"UAH")}</b>${p.amount_sale!=null&&p.currency&&p.sale_currency&&p.currency!==p.sale_currency?` = ${fmtCur(p.amount_sale,p.sale_currency)}`:""}${p.source==="modulerpro"?" (з Moduler Pro)":""}`;
async function loadMpDeals(){const {data}=await sb.rpc("pult_mp_deals");mpDeals=data||[];}

/* фінмодель: підвантажуємо оплати продажів */
const _loadFinM=loadFin;
loadFin=async function(name){
  const r=await _loadFinM(name);
  if(r.my.can&&r.sales.length){const {data}=await sb.from("sale_payments").select("*").in("sale_id",r.sales.map(s=>s.id)).order("paid_at");r.payments=data||[]}else r.payments=[];
  return r;
};
/* дохід засновника в блоці «Ідеї» — з фактичних оплат */
loadSalesAll=async function(){
  const {data}=await sb.from("sale_payments").select("amount,rate,founder_fee,sale_rate,payout_task,project_sales(project)");
  salesAll=(data||[]).map(p=>({project:p.project_sales?.project,amount:(Number(p.amount)||0)*(Number(p.rate)||1),founder_fee:(Number(p.founder_fee)||0)*(Number(p.sale_rate)||1),founder_task:p.payout_task}));
};

function dealLabel(d){return d?`${d.client||"клієнт"}${d.house?` · ${d.house}`:""}${d.stage?` · ${d.stage}`:""}`:""}
function saleRow(s,pays,canFin){
  const cur=s.currency||"UAH",ps=pays.filter(p=>p.sale_id===s.id).map(p=>({...p,sale_currency:cur})),paid=Number(s.paid)||0,pct=s.amount?Math.min(100,Math.round(paid/s.amount*100)):0;
  const sum=k=>ps.reduce((a,p)=>a+pD(p,k),0);
  const outDone=ps.filter(p=>p.payout_task&&tasks.find(t=>t.id===p.payout_task)?.status==="done").length;
  const d=s.deal_id&&(mpDeals||[]).find(x=>x.id===s.deal_id);
  return `<div class="sale2">
    <div><b>${fmtCur(s.amount,cur)}</b> ${s.buyer?esc(s.buyer):""}${cur!==DISP?`<span class="orig">≈ ${fxShow(s.amount,cur)} за поточним курсом</span>`:""}<small>${fmtDT(s.created_at)} · 👤 ${esc(nameOf(s.seller_id))}${s.status==="paid"?" · ✅ оплачено":""}</small>${s.deal_id?`<span class="dealchip" title="Угода Moduler Pro — оплати підтягуються автоматично">🔗 ${esc(d?dealLabel(d):"угода Moduler Pro")}</span>`:""}</div>
    <div class="paybar"><span>Оплачено <b style="color:var(--ink)">${fmtCur(paid,cur)}</b> · ${pct}%${cur!==DISP&&ps.length?` · ≈ ${D(sum("amount"))}`:""}</span><i style="--p:${pct}%"></i>
      <span class="fees">Нараховано з оплат: засновнику <b>${D(sum("founder_fee"))}</b>${sum("seller_fee")?` · продавцю <b>${D(sum("seller_fee"))}</b>`:""}${sum("mkt_fee")?` · маркетингу <b>${D(sum("mkt_fee"))}</b>`:""}${ps.length?` · виплат ${outDone}/${ps.filter(p=>p.payout_task).length}`:""}</span>${ps.length?`<span class="fees">${ps.map(pTxt).join(" · ")}</span>`:""}</div>
    <div>${canFin&&s.status!=="paid"?`<button class="btn sm" type="button" data-payopen="${s.id}">💳 + Оплата</button>`:""}</div>
    ${payOpen===s.id?`<div class="payform"><input data-pay="amount" inputmode="decimal" placeholder="Сума оплати" value="${Math.max(0,Math.round(s.amount-paid))||""}"><select data-pay="currency" aria-label="Валюта оплати">${CURS.map(c=>`<option value="${c}"${c===cur?" selected":""}>${curSym(c)}</option>`).join("")}</select><input data-pay="date" type="date" value="${today()}"><input data-pay="note" placeholder="Коментар (необовʼязково)"><button class="btn primary sm" type="button" data-paysave="${s.id}">Оплата надійшла</button><button class="btn ghost sm" type="button" data-payopen="${s.id}">Скасувати</button><span class="meta" style="flex-basis:100%">Можна внести в іншій валюті — перерахуємо в валюту договору за курсом НБУ на дату оплати. Комісії нарахуються одразу, Оксана отримає задачу на виплату.</span></div>`:""}
  </div>`;
}
salesHtml=function(p,r){
  const canLaunch=r.my.all&&["go","cond"].includes(p.idea?.decision)&&!p.idea?.launched_at;
  const launch=`${canLaunch?`<button class="btn primary launch" type="button" data-launch="${esc(p.name)}" title="Створить задачі запуску: прайс, контент, публікації, реклама, продажі, виробництво">🚀 Запустити продаж — команда отримає 7 задач</button>`:""}${p.idea?.launched_at?`<span class="meta">🚀 Запущено ${fmtDT(p.idea.launched_at)} — задачі запуску в списку нижче</span>`:""}`;
  if(r.my.can){
    if(mpDeals===null){mpDeals=[];loadMpDeals().then(()=>{if(fProject===p.name)renderProjHead()})}
    const people=team.filter(m=>m.active&&!m.is_ai);
    const free=(mpDeals||[]).filter(d=>!d.linked);
    const form=`<div class="saleform"><select data-sale="seller" aria-label="Хто продав">${people.map(m=>`<option value="${m.id}"${m.id===me?.id?" selected":""}>${esc(m.name)}</option>`).join("")}</select><input data-sale="amount" inputmode="decimal" placeholder="Сума договору"><select data-sale="currency" aria-label="Валюта договору">${CURS.map(c=>`<option value="${c}"${c===MCUR?" selected":""}>${curSym(c)}</option>`).join("")}</select><input data-sale="buyer" placeholder="Покупець">
      <select data-sale="deal" aria-label="Угода в Moduler Pro"><option value="">Угода Moduler Pro — не привʼязувати</option>${free.map(d=>`<option value="${d.id}">${esc(dealLabel(d))}${d.price?` · ${fmtCur(d.price,"UAH")}`:""}${Number(d.received)?` · отримано ${fmtCur(d.received,"UAH")}`:""}</option>`).join("")}</select>
      <label class="chk"><input type="checkbox" data-sale="paidnow" style="width:auto"> вже оплачено повністю</label>
      <button class="btn sm" type="button" data-addsale="${esc(p.name)}">+ Договір</button></div>`;
    return `${launch}<div class="sales"><h4>🤝 Договори й оплати</h4>
      ${r.sales.length?r.sales.map(s=>saleRow(s,r.payments||[],true)).join(""):`<span class="meta">Договорів ще немає. Продаж = договір; комісії рахуються з кожної оплати клієнта. Оплату вносить Оксана у своїй задачі, або вона підтягнеться з угоди Moduler Pro.</span>`}
      ${form}</div>`;
  }
  const sp=Number(r.my.seller_pct)||0,mine=r.my.my_sales||[];
  const acc=mine.reduce((a,x)=>a+fxConv(Number(x.fee_accrued_uah)||0,"UAH",DISP),0),exp=mine.reduce((a,x)=>a+fxConv(Number(x.fee)||0,x.currency||"UAH",DISP),0);
  return `${launch}<div class="sales"><h4>🤝 Мої договори</h4>
    ${sp?`<span>Ваша комісія: <b>${sp}%</b> від кожної оплати клієнта.</span>`:`<span class="meta">Зафіксуйте договір — він зарахується вам, бухгалтерія отримає задачу прийняти оплату.</span>`}
    ${mine.map(x=>{const pct=x.amount?Math.min(100,Math.round((x.paid||0)/x.amount*100)):0;const c=x.currency||"UAH";return `<div class="sale2"><div><b>${fmtCur(x.amount,c)}</b> ${x.buyer?esc(x.buyer):""}<small>${fmtDT(x.at)}${x.status==="paid"?" · ✅ оплачено":""}</small></div><div class="paybar"><span>Оплачено ${fmtCur(x.paid,c)} · ${pct}%</span><i style="--p:${pct}%"></i></div><div class="fees">моя комісія: <b>${fmtCur(x.fee_accrued,c)}</b> з ${fmtCur(x.fee,c)}${c!==DISP?` <span class="orig">≈ ${D(fxConv(Number(x.fee_accrued_uah)||0,"UAH",DISP))} нараховано</span>`:""}</div></div>`}).join("")}
    <div class="saleform"><input data-sale="amount" inputmode="decimal" placeholder="Сума договору"><select data-sale="currency" aria-label="Валюта договору">${CURS.map(c=>`<option value="${c}"${c===MCUR?" selected":""}>${curSym(c)}</option>`).join("")}</select><input data-sale="buyer" placeholder="Покупець"><button class="btn sm" type="button" data-addsale="${esc(p.name)}">+ Договір</button></div></div>
    ${exp?`<div class="income"><span>Договорів: <b>${mine.length}</b></span><span>Моя комісія нарахована: <b>${D(acc)}</b></span><span>Очікується ще: <b>${D(Math.max(0,exp-acc))}</b></span></div>`:""}`;
};
finTotalsHtml=function(r){
  const S=(r.sales||[]).filter(s=>s.status!=="cancelled");if(!S.length)return "";
  const P=r.payments||[],sumP=k=>P.reduce((a,p)=>a+pD(p,k),0),mc=r.fin.currency||"UAH";
  const V=S.reduce((a,s)=>a+fxConv(Number(s.amount)||0,s.currency||"UAH",DISP),0),got=sumP("amount"),C=num(r.fin.cost);
  const share=s=>s.amount?Math.min(1,(Number(s.paid)||0)/s.amount):0,shares=S.reduce((a,s)=>a+share(s),0);
  const outDone=P.filter(p=>p.payout_task&&tasks.find(t=>t.id===p.payout_task)?.status==="done").reduce((a,p)=>a+pD(p,"founder_fee"),0);
  const oth=(r.fin.other||[]).reduce((a,o)=>a+(num(o.pct)?got*num(o.pct)/100:0)+fxConv((num(o.sum)||0)*shares,mc,DISP),0);
  const costShare=C!=null?fxConv(C*shares,mc,DISP):null;
  const mod=costShare!=null?got-costShare-sumP("founder_fee")-sumP("seller_fee")-sumP("mkt_fee")-oth:null;
  const multi=new Set(S.map(s=>s.currency||"UAH").concat(P.map(p=>p.currency||"UAH"))).size>1||S.some(s=>(s.currency||"UAH")!==DISP);
  return `<div class="income"><span>Договорів: <b>${S.length}</b> на <b>${D(V)}</b></span><span>Отримано: <b>${D(got)}</b> (${V?Math.round(got/V*100):0}%)</span><span>Засновнику нараховано: <b>${D(sumP("founder_fee"))}</b>, виплачено ${D(outDone)}</span><span>Продавцям: <b>${D(sumP("seller_fee"))}</b></span><span>Маркетингу: <b>${D(sumP("mkt_fee"))}</b></span>${mod!=null?`<span>Модулеру з отриманого: <b>${D(mod)}</b></span>`:""}</div>${multi?`<span class="curnote">Усе в ${curSym(DISP)}: отримані гроші й комісії — за курсом НБУ на дату кожної оплати, договори й собівартість — за поточним.</span>`:""}`;
};
addSale=async function(name){
  const box=$("#passport");const g=k=>box.querySelector(`[data-sale="${k}"]`);
  const amount=num(g("amount")?.value),buyer=(g("buyer")?.value||"").trim();
  if(!amount||amount<=0){toast("Вкажіть суму договору");return}
  const {data,error}=await sb.rpc("pult_record_sale",{p_project:name,p_amount:amount,p_buyer:buyer||null,p_seller:g("seller")?.value||null,p_deal:g("deal")?.value||null,p_paid_now:!!g("paidnow")?.checked,p_currency:g("currency")?.value||null});
  if(error){toast("Договір не збережено: "+error.message);return}
  toast(g("paidnow")?.checked?"🤝 Договір і оплату зафіксовано — комісії нараховано, Оксана отримала задачу на виплату":`🤝 Договір зафіксовано — Оксана отримала задачу прийняти оплату${g("deal")?.value?"; оплати з Moduler Pro підтягнуться самі":""}`);
  mpDeals=null;await Promise.all([loadFin(name),loadSalesAll()]);await loadAll();renderProjHead();
};
async function addPayment(saleId,root){
  const g=k=>root.querySelector(`[data-pay="${k}"]`);const amount=num(g("amount")?.value);
  if(!amount||amount<=0){toast("Вкажіть суму оплати");return false}
  const cur=g("currency")?.value||null;
  const {data,error}=await sb.rpc("pult_add_payment",{p_sale:saleId,p_amount:amount,p_date:g("date")?.value||null,p_note:(g("note")?.value||"").trim()||null,p_currency:cur});
  if(error){toast("Оплату не збережено: "+error.message);return false}
  toast(`💳 Оплату ${fmtCur(amount,cur||data?.currency||"UAH")} внесено${cur&&data?.currency&&cur!==data.currency?` (= ${fmtCur(data.credited,data.currency)} за курсом НБУ)`:""}${data?.payout_task?" — задача на виплату комісій створена":""}`);return true;
}
document.addEventListener("click",async e=>{
  const po=e.target.closest("[data-payopen]");if(po){e.stopPropagation();payOpen=payOpen===po.dataset.payopen?null:po.dataset.payopen;if(fProject)renderProjHead();else render();return}
  const ps=e.target.closest("[data-paysave]");if(ps){e.stopPropagation();ps.disabled=true;
    const ok=await addPayment(ps.dataset.paysave,ps.closest(".payform"));ps.disabled=false;if(!ok)return;
    payOpen=null;for(const k in saleByTask)delete saleByTask[k];
    if(fProject)await Promise.all([loadFin(fProject),loadSalesAll()]);await loadAll();if(fProject)renderProjHead();return}
},true);

/* задача Оксани «Прийняти оплату»: у відкритій картці — договір, оплати і кнопка «Оплата надійшла» */
function payBoxHtml(tid){
  const s=saleByTask[tid];
  if(s===undefined)return `<div class="paybox"><small class="meta">Завантаження договору…</small></div>`;
  if(!s)return "";
  const cur=s.currency||"UAH",pct=s.amount?Math.min(100,Math.round(s.paid/s.amount*100)):0;
  return `<div class="paybox"><h4>💳 Оплата від клієнта</h4>
    <div class="paybar"><span>${esc(s.buyer||"Клієнт")} · договір <b style="color:var(--ink)">${fmtCur(s.amount,cur)}</b> · оплачено <b style="color:var(--ink)">${fmtCur(s.paid,cur)}</b> (${pct}%)${s.status==="paid"?" · ✅ повністю":""}${cur!=="UAH"?` · курс НБУ 1 ${curSym(cur)} = ${fmtRate(cur)} грн`:""}</span><i style="--p:${pct}%"></i></div>
    ${(s.payments||[]).length?`<div class="fees">${s.payments.map(p=>pTxt({...p,sale_currency:cur})).join(" · ")}</div>`:""}
    ${s.status!=="paid"?`<div class="payform" style="grid-column:auto"><input data-pay="amount" inputmode="decimal" placeholder="Сума" value="${Math.max(0,Math.round(s.amount-s.paid))||""}"><select data-pay="currency" aria-label="Валюта оплати">${CURS.map(c=>`<option value="${c}"${c===cur?" selected":""}>${curSym(c)}</option>`).join("")}</select><input data-pay="date" type="date" value="${today()}"><input data-pay="note" placeholder="Коментар / номер платежу"><button class="btn primary sm" type="button" data-paysave="${s.id}">Оплата надійшла</button></div>
    <span class="meta">Вносьте в тій валюті, в якій прийшли гроші — перерахунок у валюту договору за курсом НБУ на дату оплати. Комісії рахуються автоматично, задача на їх виплату зʼявиться тут же.</span>`:""}</div>`;
}
const _renderM=render;
render=function(){
  _renderM();
  if(!openId)return;const t=tasks.find(x=>x.id===openId);if(!t||!(t.tags||[]).includes("оплата-клієнта"))return;
  const card=document.querySelector(`#board .card[data-id="${CSS.escape(openId)}"]`);if(!card||card.querySelector(".paybox"))return;
  if(saleByTask[t.id]===undefined&&!saleByTask["_"+t.id]){saleByTask["_"+t.id]=1;sb.rpc("pult_sale_by_task",{p_task:t.id}).then(({data})=>{saleByTask[t.id]=data||null;delete saleByTask["_"+t.id];if(openId===t.id)render()})}
  card.querySelector(".card-head")?.insertAdjacentHTML("afterend",payBoxHtml(t.id));
};
