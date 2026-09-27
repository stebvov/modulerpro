/* ---------- Оцінка проєкту: швидка оцінка ШІ + оцінки людей, порівняння (26.09) ----------
   ШІ (edge ai-estimate) читає опис, посилання з опису й коментарів, довідник Moduler Pro і шукає аналоги.
   Люди вносять свої цифри. Бачать: ті, кому відкрита фінмодель, і автор оцінки (RLS project_estimates). */
document.head.insertAdjacentHTML("beforeend",`<style>
.est{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--surface)}
.est-h{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.est-h h3{flex:1 1 auto;margin:0;font:600 13px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--accent)}
.est .hintline{font-size:13px;color:var(--muted);margin:0}
.est table{min-width:640px;font-size:14px}
.est td.n,.est th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.est tr.ai td:first-child b::before{content:"⚡ ";}
.est tr.model td{background:var(--sunk);font-weight:600}
.est .dev{font:600 12px var(--mono);padding:1px 6px;border-radius:99px;margin-left:4px}
.est .dev.ok{background:var(--ok-bg);color:var(--ok)} .est .dev.warn{background:var(--warn-bg);color:var(--warn)} .est .dev.bad{background:var(--bad-bg);color:var(--bad)}
.est .run{display:flex;gap:10px;align-items:center;font-size:14px;background:var(--info-bg);border-radius:10px;padding:10px 12px}
.est .spin{width:16px;height:16px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:estspin .8s linear infinite;flex:none}
@keyframes estspin{to{transform:rotate(360deg)}}
.est details{background:var(--sunk);border-radius:10px;padding:8px 12px}
.est details summary{cursor:pointer;font-weight:600;font-size:14px}
.est .ai-body{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:8px;font-size:14px}
.est .ai-body h4{margin:0 0 4px;font:600 12px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.est .ai-body ul{margin:0;padding-left:18px} .est .ai-body li{margin:2px 0}
.est .bk{display:grid;grid-template-columns:1fr auto;gap:2px 10px} .est .bk b{font-family:var(--mono);text-align:right}
.est .src{font-size:13px} .est .src a{color:var(--accent);overflow-wrap:anywhere}
.est-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;background:var(--sunk);border-radius:10px;padding:10px}
.est-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted)}
.est-form input{font:600 15px var(--mono)} .est-form .full{grid-column:1/-1}
</style>`);

const EST={},estBusy={},estOpen={},estPoll={};let estForm=null;
function pollEst(name){
  estPoll[name]=1;let n=0;
  const tick=async()=>{n++;await loadEst(name);
    const r=(EST[name]||[]).find(x=>x.kind==="ai"&&x.data?.status==="running");
    if(r&&n<60){setTimeout(tick,6000);return}
    delete estPoll[name];delete estBusy[name];
    const last=(EST[name]||[]).find(x=>x.kind==="ai");
    if(last?.data?.status==="done"){estOpen[name]=true;toast("⚡ Оцінку ШІ готово: "+name);if(typeof loadPNotes==="function")loadPNotes(name)}
    else if(last?.data?.status==="error")toast("Оцінка не вдалася: "+(last.data.error||""));
    if(fProject===name&&!phEdit)renderProjHead()};
  setTimeout(tick,6000);
}
async function loadEst(name){
  const {data}=await sb.from("project_estimates").select("*").eq("project",name).order("created_at",{ascending:false});
  EST[name]=data||[];
}
/* оцінки зберігаються в гривнях; показуємо у валюті відображення (fx.js) */
const eMoney=n=>n==null?"—":Math.round(fxConv(n,"UAH",DISP)).toLocaleString("uk-UA");
const eIn=v=>v==null?"":Math.round(fxConv(v,"UAH",DISP)),eOut=v=>v==null?null:Math.round(fxConv(v,DISP,"UAH"));
const eRange=(a,b)=>a==null&&b==null?"—":a!=null&&b!=null&&a!==b?`${eMoney(a)}–${eMoney(b)}`:eMoney(a??b);
function devChip(v,base){if(v==null||!base)return "";const d=(v-base)/base*100;const cls=Math.abs(d)<=10?"ok":Math.abs(d)<=25?"warn":"bad";return `<span class="dev ${cls}" title="Відхилення від оцінки ШІ">${d>0?"+":""}${Math.round(d)}%</span>`}
function estHtml(p){
  let name=p.name,rows=EST[name],fin=FIN[name],canFin=!!fin?.my?.can,idea=isIdea(p)?(p.idea||{}):null;
  if(rows===undefined)return `<div class="full est"><div class="est-h"><h3>🧮 Оцінка: собівартість і ціна</h3></div><small class="meta">Завантаження…</small></div>`;
  const st=r=>r.data?.status||"done";
  const running=rows.find(r=>r.kind==="ai"&&st(r)==="running"&&Date.now()-new Date(r.created_at).getTime()<6*60e3);
  const failed=rows.filter(r=>r.kind==="ai"&&(st(r)==="error"||(st(r)==="running"&&!running||st(r)==="running"&&r!==running)));
  rows=rows.filter(r=>st(r)==="done");
  if(running&&!estBusy[name])estBusy[name]="ШІ оцінює: читає опис і посилання, довідник матеріалів, шукає аналоги на ринку… Зазвичай 1–3 хв — можна працювати далі.";
  if(running&&!estPoll[name])pollEst(name);
  const ai=rows.find(r=>r.kind==="ai");
  const mine=rows.find(r=>r.kind==="human"&&r.author_id===me?.id);
  const tr=(r)=>{const m=r.cost&&r.price?Math.round((r.price-r.cost)/r.price*100):null;
    return `<tr class="${r.kind}"><td><b>${r.kind==="ai"?"ШІ":esc(nameOf(r.author_id))}</b><br><small class="meta">${fmtDT(r.created_at)}${r.kind==="ai"?` · запит: ${esc(nameOf(r.author_id))}`:""}</small>${r.comment&&r.kind==="human"?`<br><small>${esc(r.comment)}</small>`:""}</td>
      <td class="n">${eMoney(r.cost)}${r.kind==="human"?devChip(r.cost,ai?.cost):""}</td><td class="n">${eRange(r.market_low,r.market_high)}</td><td class="n">${eMoney(r.price)}${r.kind==="human"?devChip(r.price,ai?.price):""}</td><td class="n">${m==null?"—":m+"%"}</td>
      <td class="n">${canFin?`<button class="btn sm" type="button" data-estapply="${r.id}" title="Перенести цифри в модель проєкту: собівартість${idea?", ціну й ринок":""}">Застосувати</button>`:""}${r.author_id===me?.id||finAll()?` <button class="icon-btn" type="button" data-estdel="${r.id}" title="Видалити оцінку" aria-label="Видалити оцінку">×</button>`:""}</td></tr>`};
  const modelRow=canFin?(()=>{const mc=curOf(name),toU=v=>v==null?null:fxConv(v,mc,"UAH"),c=fin.fin?.cost!=null?toU(Number(fin.fin.cost)):null,pr=idea?toU(num(idea.price)):null,mk=idea?toU(num(idea.market)):null;const m=c&&pr?Math.round((pr-c)/pr*100):null;
    return `<tr class="model"><td>Зараз у моделі</td><td class="n">${eMoney(c)}</td><td class="n">${eMoney(mk)}</td><td class="n">${eMoney(pr)}</td><td class="n">${m==null?"—":m+"%"}</td><td></td></tr>`})():"";
  const run=estBusy[name]?`<div class="run"><span class="spin" aria-hidden="true"></span><span>${esc(estBusy[name])}</span></div>`:"";
  const form=estForm===name?`<div class="est-form">
      <label>Собівартість, ${curSym(DISP)}<input id="ef-cost" inputmode="decimal" value="${esc(eIn(mine?.cost))}"></label>
      <label>Ринок від, ${curSym(DISP)}<input id="ef-low" inputmode="decimal" value="${esc(eIn(mine?.market_low))}"></label>
      <label>Ринок до, ${curSym(DISP)}<input id="ef-high" inputmode="decimal" value="${esc(eIn(mine?.market_high))}"></label>
      <label>Наша ціна продажу, ${curSym(DISP)}<input id="ef-price" inputmode="decimal" value="${esc(eIn(mine?.price))}"></label>
      <label class="full">Коментар: на чому базується (розрахунок, аналоги, посилання)<input id="ef-com" style="font:inherit" value="${esc(mine?.comment??"")}"></label>
      <div class="row full"><button class="btn primary sm" type="button" data-estsave="${esc(name)}">Зберегти мою оцінку</button><button class="btn ghost sm" type="button" data-estform="${esc(name)}">Скасувати</button></div></div>`:"";
  const d=ai?.data||{};
  const aiBox=ai?`<details${estOpen[name]?" open":""} data-estdet="${esc(name)}"><summary>Як ШІ порахував · довіра: ${esc(d.confidence||"—")}${d.unit?` · ${esc(d.unit)}`:""}</summary>
    ${d.summary?`<p style="margin:8px 0 0;font-size:14px">${esc(d.summary)}</p>`:""}
    <div class="ai-body">
      <div><h4>Собівартість${d.cost?.per_m2?` · ${eMoney(d.cost.per_m2)} ${curSym(DISP)}/м²`:""}</h4><div class="bk">${(d.cost?.breakdown||[]).map(b=>`<span>${esc(b.item)}</span><b>${eMoney(num(b.sum))}</b>`).join("")}</div>${(d.cost?.assumptions||[]).length?`<ul style="margin-top:6px;color:var(--muted);font-size:13px">${d.cost.assumptions.map(a=>`<li>${esc(a)}</li>`).join("")}</ul>`:""}</div>
      <div><h4>Ринок і аналоги</h4><ul>${(d.market?.analogs||[]).map(a=>`<li>${a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a>`:esc(a.name)} — <b>${eMoney(num(a.price))} ${curSym(DISP)}</b>${a.area_m2?` · ${esc(a.area_m2)} м²`:""}</li>`).join("")||"<li>аналогів не знайдено</li>"}</ul>${d.market?.reasoning?`<p style="margin:6px 0 0;color:var(--muted);font-size:13px">${esc(d.market.reasoning)}</p>`:""}</div>
      ${(d.risks||[]).length||(d.questions||[]).length?`<div>${(d.questions||[]).length?`<h4>Що уточнити людям</h4><ul>${d.questions.map(q=>`<li>${esc(q)}</li>`).join("")}</ul>`:""}${(d.risks||[]).length?`<h4 style="margin-top:8px">Ризики</h4><ul>${d.risks.map(q=>`<li>${esc(q)}</li>`).join("")}</ul>`:""}</div>`:""}
      <div class="src"><h4>Що прочитано</h4>${(d.sources||[]).length?(d.sources||[]).map(s=>`<div>${s.ok?"✅":"⚠️"} <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title||s.url)}</a>${s.ok?"":` — ${esc(s.note||"")}`}</div>`).join(""):`<div class="meta">Посилань в описі й коментарях немає — додайте їх в опис проєкту, щоб оцінка була точнішою.</div>`}<div class="meta" style="margin-top:4px">${d.web_search?`Пошук в інтернеті: ${d.searches||0}`:"Без пошуку в інтернеті"} · ${esc(d.model||"")}</div></div>
    </div></details>`:"";
  const table=rows.length||modelRow?`<div class="tbl"><table><thead><tr><th>Хто</th><th class="n">Собівартість, ${curSym(DISP)}</th><th class="n">Ринок, ${curSym(DISP)}</th><th class="n">Наша ціна, ${curSym(DISP)}</th><th class="n">Маржа</th><th></th></tr></thead><tbody>${modelRow}${rows.map(tr).join("")}</tbody></table></div>`:"";
  return `<div class="full est" id="estBox"><div class="est-h"><h3>🧮 Оцінка: собівартість і ціна${rows.length?` · ${rows.length}`:""}</h3>
      <button class="btn primary sm" type="button" data-estai="${esc(name)}"${estBusy[name]?" disabled":""}>⚡ ${ai?"Оцінити ще раз":"Швидка оцінка ШІ"}</button>
      <button class="btn sm" type="button" data-estform="${esc(name)}">✍ ${mine?"Змінити мою оцінку":"Моя оцінка"}</button></div>
    ${!rows.length&&!run?`<p class="hintline">ШІ за 1–2 хв прочитає опис і посилання з опису й коментарів, довідник матеріалів і знайде аналоги на ринку. Потім кожен вносить свою оцінку — тут видно порівняння й відхилення.</p>`:""}
    ${run}${failed.map(r=>`<div class="hint bad" style="display:flex;gap:8px;align-items:center"><span style="flex:1">⚠️ Оцінка ШІ ${fmtDT(r.created_at)} не вдалася: ${esc(r.data?.error||"перевищено час")}</span><button class="icon-btn" type="button" data-estdel="${r.id}" aria-label="Прибрати">×</button></div>`).join("")}${form}${table}${aiBox}
    ${rows.length&&!canFin?`<p class="hintline">🔒 Ви бачите лише свої оцінки й ті, що запросили. Повне порівняння — у засновника й Каті.</p>`:""}</div>`;
}
const _phEst=renderProjHead;
renderProjHead=function(){
  _phEst();
  const box=$("#projHead"),p=fProject&&!focusNum&&projects.find(x=>x.name===fProject);
  if(!p||phEdit||box.hidden)return;
  if(EST[p.name]===undefined&&!estBusy["_l"+p.name]){estBusy["_l"+p.name]=1;Promise.all([loadEst(p.name),FIN[p.name]?null:loadFin(p.name)]).finally(()=>{delete estBusy["_l"+p.name];if(fProject===p.name&&!phEdit)renderProjHead()})}
  const html=estHtml(p),anchor=box.querySelector(":scope > .passport")||box.querySelector(":scope > .pnotes");
  anchor?anchor.insertAdjacentHTML("beforebegin",html):box.insertAdjacentHTML("beforeend",html);
};
async function runEstimate(name){
  const n=(projects.find(p=>p.name===name)?.description||"").match(/https?:\/\//g)?.length||0;
  estBusy[name]=`ШІ читає опис${n?` і ${n} посил.`:""}, коментарі й довідник матеріалів, шукає аналоги на ринку… Зазвичай 1–2 хвилини — можна працювати далі.`;renderProjHead();
  const {data,error}=await sb.functions.invoke("ai-estimate",{body:{project:name}});
  let msg=data?.error||null;
  if(error&&!msg){try{msg=(await error.context?.json?.())?.error}catch(e){}msg=msg||error.message}
  if(msg){delete estBusy[name];toast("Оцінка не вдалася: "+msg);renderProjHead();return}
  await loadEst(name);if(!estPoll[name])pollEst(name);if(fProject===name)renderProjHead();
}
document.addEventListener("toggle",e=>{const d=e.target.closest?.("[data-estdet]");if(d)estOpen[d.dataset.estdet]=d.open},true);
document.addEventListener("click",async e=>{
  const a=e.target.closest("[data-estai]");if(a){e.stopPropagation();runEstimate(a.dataset.estai);return}
  const f=e.target.closest("[data-estform]");if(f){e.stopPropagation();estForm=estForm===f.dataset.estform?null:f.dataset.estform;renderProjHead();document.getElementById("ef-cost")?.focus();return}
  const s=e.target.closest("[data-estsave]");if(s){e.stopPropagation();const name=s.dataset.estsave,g=k=>document.getElementById("ef-"+k).value;
    const row={project:name,kind:"human",author_id:me?.id,cost:eOut(num(g("cost"))),market_low:eOut(num(g("low"))),market_high:eOut(num(g("high"))),price:eOut(num(g("price"))),comment:g("com").trim()||null};
    if(row.cost==null&&row.price==null&&row.market_low==null&&row.market_high==null){toast("Вкажіть хоча б одну цифру");return}
    s.disabled=true;
    const old=(EST[name]||[]).find(r=>r.kind==="human"&&r.author_id===me?.id);
    if(old)await sb.from("project_estimates").delete().eq("id",old.id);
    const {error}=await sb.from("project_estimates").insert(row);
    if(error){s.disabled=false;toast("Не збережено: "+error.message);return}
    estForm=null;await loadEst(name);toast("Вашу оцінку збережено");renderProjHead();return}
  const d=e.target.closest("[data-estdel]");if(d){e.stopPropagation();if(!d.dataset.sure){d.dataset.sure="1";d.textContent="видалити?";return}
    const {error}=await sb.from("project_estimates").delete().eq("id",d.dataset.estdel);if(error){toast("Не видалено: "+error.message);return}
    await loadEst(fProject);renderProjHead();return}
  const ap=e.target.closest("[data-estapply]");if(ap){e.stopPropagation();const name=fProject,r=(EST[name]||[]).find(x=>x.id===ap.dataset.estapply),p=projects.find(x=>x.name===name);if(!r||!p)return;
    ap.disabled=true;const done=[];const mc=curOf(name),toM=v=>v==null?null:Math.round(fxConv(v,"UAH",mc));
    if(r.cost!=null){const {error}=await sb.from("project_fin").upsert({project:name,cost:toM(r.cost),updated_by:me?.id||null,updated_at:new Date().toISOString()},{onConflict:"project"});if(error){toast("Собівартість не перенесено: "+error.message);ap.disabled=false;return}done.push("собівартість")}
    if(isIdea(p)&&(r.price!=null||r.market_low!=null||r.market_high!=null)){
      const idea={...(p.idea||{})};if(r.price!=null){idea.price=toM(r.price);done.push("ціну")}
      const mk=r.market_low!=null&&r.market_high!=null?Math.round((r.market_low+r.market_high)/2):(r.market_low??r.market_high);if(mk!=null){idea.market=toM(mk);done.push("ринок")}
      const {error}=await sb.from("task_projects").update({idea}).eq("name",name);if(error){toast("Ціну не перенесено: "+error.message);ap.disabled=false;return}p.idea=idea;}
    await sb.from("project_notes").insert({project:name,author_id:me?.id||null,body:`🧮 У модель проєкту перенесено оцінку «${r.kind==="ai"?"ШІ":nameOf(r.author_id)}»: ${done.join(", ")||"—"}.`});
    await loadFin(name);toast("Перенесено в модель: "+(done.join(", ")||"нічого"));renderProjHead();if(typeof loadPNotes==="function")loadPNotes(name);return}
},true);
