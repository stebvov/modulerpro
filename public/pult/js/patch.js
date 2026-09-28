/* ---------- дрібні виправлення (26.09) ---------- */
/* копіювання працює в будь-якому браузері: clipboard → execCommand → поле з виділеним текстом */
async function copyText(t){
  try{await navigator.clipboard.writeText(t);return true}catch(e){}
  try{const ta=document.createElement("textarea");ta.value=t;ta.setAttribute("readonly","");ta.style.cssText="position:fixed;top:0;left:0;opacity:0";document.body.appendChild(ta);ta.select();const ok=document.execCommand("copy");ta.remove();if(ok)return true}catch(e){}
  document.getElementById("copyBox")?.remove();
  document.body.insertAdjacentHTML("beforeend",`<div id="copyBox" role="dialog" aria-label="Скопіюйте текст" style="position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:30;width:min(560px,calc(100vw - 32px));background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:12px;display:flex;flex-direction:column;gap:8px"><b style="font-size:14px">Скопіюйте вручну (Ctrl/Cmd + C)</b><textarea readonly rows="${Math.min(6,t.split("\n").length)}" style="font-size:14px">${esc(t)}</textarea><div class="row" style="justify-content:flex-end"><button class="btn sm" type="button" data-copyclose>Готово</button></div></div>`);
  const b=document.querySelector("#copyBox textarea");b.focus();b.select();return false;
}
copy=async function(text){if(await copyText(text))toast("Скопійовано — вставте в Telegram")};
copyLink=async function(n){if(await copyText(taskUrl(n)))toast("Посилання на #"+n+" скопійовано")};
document.addEventListener("click",e=>{if(e.target.closest("[data-copyclose]"))document.getElementById("copyBox")?.remove()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.getElementById("copyBox")?.remove()});
/* 🗒 не має гліфа на частині Windows — показуємо 📝 */
const fixNoteIcon=()=>document.querySelectorAll("[data-pnmsg],.pnotes h3,.pnums span,#pn-list > small").forEach(el=>{if(el.innerHTML.includes("🗒"))el.innerHTML=el.innerHTML.replaceAll("🗒","📝")});
for(const fn of ["renderTg","renderProjHead","renderProjects"]){const o=window[fn];window[fn]=function(){const r=o.apply(this,arguments);fixNoteIcon();return r}}
/* ---------- Єдиний сайт: пульт живе в Moduler Pro за адресою app.moduler.pro/pult/ ----------
   Вхід спільний: якщо ви вже увійшли в Moduler Pro, пульт бере ту саму сесію (cookie Supabase на тому ж домені). */
const IN_MP=location.pathname.startsWith("/pult");
async function mpSso(){
  if(!IN_MP)return;
  const {data}=await sb.auth.getSession();
  const ck=Object.fromEntries(document.cookie.split(";").map(c=>{const i=c.indexOf("=");return [c.slice(0,i).trim(),decodeURIComponent(c.slice(i+1))]}));
  const base=Object.keys(ck).find(k=>/^sb-.+-auth-token(\.0)?$/.test(k));if(!base){if(!data?.session)(window.top||window).location.assign("/login");return}
  const root=base.replace(/\.0$/,"");let raw=ck[root]||"";if(!raw){for(let i=0;ck[root+"."+i]!==undefined;i++)raw+=ck[root+"."+i]}
  try{
    if(raw.startsWith("base64-")){const b=raw.slice(7).replace(/-/g,"+").replace(/_/g,"/");raw=new TextDecoder().decode(Uint8Array.from(atob(b+"===".slice((b.length+3)%4)),c=>c.charCodeAt(0)))}
    const s=JSON.parse(raw);const t=Array.isArray(s)?{access_token:s[0],refresh_token:s[1]}:s;
    if(!t.access_token||!t.refresh_token)return;
    /* сесія пульту вже є і це той самий користувач, що в Moduler Pro — нічого не робимо */
    if(data?.session&&(!t.user?.id||t.user.id===data.session.user?.id))return;
    const {error}=await sb.auth.setSession({access_token:t.access_token,refresh_token:t.refresh_token});
    if(!error){location.reload();return}
  }catch(e){console.warn("mpSso",e)}
  if(!data?.session)(window.top||window).location.assign("/login");
}
if(IN_MP){
  mpSso();
  document.head.insertAdjacentHTML("beforeend",`<style>.mpback{font-size:13px;color:var(--muted);text-decoration:none;border:1px solid #cfccc0;border-radius:6px;padding:4px 10px;background:var(--surface);white-space:nowrap}.mpback:hover{color:var(--accent);border-color:var(--accent)}</style>`);
  const mountBack=()=>{const h=document.querySelector("header.top h1");if(h&&!document.querySelector(".mpback"))h.insertAdjacentHTML("afterend",`<a class="mpback" href="/" title="Повернутися в Moduler Pro: CRM, виробництво, каталог, фінанси">← Moduler Pro</a>`)};
  /* вихід: закриваємо і сесію пульта, і cookie Moduler Pro — інакше вхід одразу повернеться */
  window.addEventListener("click",async e=>{
    if(!e.target.closest("[data-logout]"))return;e.stopPropagation();e.preventDefault();
    try{await sb.auth.signOut()}catch(err){}
    document.cookie.split(";").map(c=>c.split("=")[0].trim()).filter(k=>/^sb-/.test(k)).forEach(k=>{document.cookie=k+"=; Max-Age=0; path=/"});
    (window.top||window).location.assign("/login");
  },true);
  mountBack();const _laMp=loadAll;loadAll=async function(){const r=await _laMp.apply(this,arguments);mountBack();return r};
}
/* 📐 кошторис проєкту — окремий модуль */
(function(){const s=document.createElement("script");s.src="/pult/js/boq.js";s.async=false;document.body.appendChild(s)})();
