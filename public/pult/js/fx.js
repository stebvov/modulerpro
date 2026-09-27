/* ---------- Валюти (26.09): гроші зберігаються у своїй валюті (₴/$/€), показуються в одній обраній ----------
   Курси — НБУ, щодня в таблиці fx_rates (cron pult-fx). Оплати переводяться за курсом на дату оплати,
   договори й плани (фінмодель, оцінки) — за поточним курсом. Вибір валюти запамʼятовується в браузері. */
document.head.insertAdjacentHTML("beforeend",`<style>
.cursw{align-self:center;flex-wrap:nowrap}.cursw button{padding:5px 10px;font-family:var(--mono)}
.curnote{font-size:12px;color:var(--muted)}
.orig{display:block;font:400 12px var(--body);color:var(--muted)}
</style>`);
const CURS=["UAH","USD","EUR"];
let DISP=(()=>{try{const c=localStorage.getItem("pult_cur");return CURS.includes(c)?c:"UAH"}catch(e){return "UAH"}})();
let MCUR="UAH";                 // валюта моделі, яку зараз малюємо (фінмодель, паспорт)
const FXR={USD:[],EUR:[]};      // [[день, грн за 1 од.]] за зростанням дат
const FX_FALLBACK={USD:44.5,EUR:51};
let fxLoaded=false;
async function loadFx(){
  const since=new Date(Date.now()-900*864e5).toISOString().slice(0,10);
  const {data}=await sb.from("fx_rates").select("day,code,rate").gte("day",since).order("day");
  FXR.USD=[];FXR.EUR=[];(data||[]).forEach(r=>FXR[r.code]?.push([r.day,Number(r.rate)]));fxLoaded=true;
}
function fxRate(c,day){
  if(!c||c==="UAH")return 1;const a=FXR[c]||[];if(!a.length)return FX_FALLBACK[c]||1;
  if(!day)return a[a.length-1][1];
  day=String(day).slice(0,10);let v=a[0][1];for(const [d,r] of a){if(d<=day)v=r;else break}return v;
}
const fxLastDay=()=>FXR.USD.length?FXR.USD[FXR.USD.length-1][0]:null;
function fxConv(n,from,to,day){if(n==null||n==="")return null;from=from||"UAH";to=to||DISP;const v=Number(n);if(from===to)return v;return v*fxRate(from,day)/fxRate(to,day)}
const curSym=c=>c==="USD"?"$":c==="EUR"?"€":"грн";
function fmtCur(n,c){
  if(n==null||isNaN(n))return "—";const neg=Number(n)<0,v=Math.abs(Math.round(Number(n))).toLocaleString("uk-UA");
  return (neg?"−":"")+(c==="USD"?"$"+v:c==="EUR"?"€"+v:v+" грн");
}
/* сума у валюті відображення: з валюти from, за курсом на day (або поточним) */
const fxShow=(n,from,day)=>n==null||n===""?"—":fmtCur(fxConv(n,from,DISP,day),DISP);
/* «$50 000 · ≈ 2 248 645 грн» — оригінал і переведене, якщо валюти різні */
const fxBoth=(n,from,day)=>n==null?"—":from===DISP?fmtCur(n,from):`${fmtCur(n,from)} <span class="orig">≈ ${fxShow(n,from,day)}</span>`;
const fmtRate=c=>fxRate(c).toLocaleString("uk-UA",{minimumFractionDigits:2,maximumFractionDigits:2});
function fxNote(from){
  if(!from||from===DISP)return "";
  const c=from==="UAH"?DISP:from,d=fxLastDay();
  return `<span class="curnote">Цифри внесено в ${curSym(from)} · показано в ${curSym(DISP)} за курсом НБУ 1 ${curSym(c)} = ${fmtRate(c)} грн${d?` (${fmt(d)})`:""}</span>`;
}
function curSelect(attr,val,label){return `<label>${label||"Валюта"}<select ${attr}>${CURS.map(c=>`<option value="${c}"${c===val?" selected":""}>${c==="UAH"?"₴ гривня":c==="USD"?"$ долар":"€ євро"}</option>`).join("")}</select></label>`}

/* перемикач у шапці */
function curSwHtml(){const t=`1 $ = ${fmtRate("USD")} грн · 1 € = ${fmtRate("EUR")} грн (НБУ${fxLastDay()?", "+fmt(fxLastDay()):""})`;
  return `<div class="seg cursw" id="curSw" role="group" aria-label="Валюта відображення" title="Показувати всі суми в: ${t}">${CURS.map(c=>`<button type="button" data-cur="${c}" aria-pressed="${c===DISP}">${c==="UAH"?"₴":c==="USD"?"$":"€"}</button>`).join("")}</div>`}
function mountCurSw(){const box=document.querySelector("header.top .top-acts");if(!box)return;document.getElementById("curSw")?.remove();box.insertAdjacentHTML("afterbegin",curSwHtml())}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-cur]");if(!b)return;e.stopPropagation();
  DISP=b.dataset.cur;try{localStorage.setItem("pult_cur",DISP)}catch(err){}
  mountCurSw();
  try{render()}catch(err){}try{renderProjects()}catch(err){}try{if(fProject)renderProjHead()}catch(err){}
  toast(`Суми показано в ${DISP==="UAH"?"гривнях":DISP==="USD"?"доларах":"євро"}${DISP!=="UAH"?` · курс НБУ ${fmtRate(DISP)} грн`:""}`);
},true);
const _loadAllFx=loadAll;
loadAll=async function(){
  if(!fxLoaded){try{await loadFx()}catch(e){}}
  const r=await _loadAllFx.apply(this,arguments);mountCurSw();return r;
};
