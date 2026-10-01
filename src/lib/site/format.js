// Дрібні помічники сайту: текст з *акцентом*, посилання з урахуванням бази (/site чи домен), фото з srcset, гроші.
import { Fragment, createElement } from "react";

// *слово* → акцент кольором, **слово** → жирний, перенос рядка → <br>. Без HTML — безпечно для тексту з конструктора.
// типографіка: короткі слова (у, в, й, на, до…) не лишаються в кінці рядка, тире не переноситься на новий
export function nbsp(s) {
  const glue = (t) => t.replace(/(^|[\s(«„"])([А-ЯІЇЄҐа-яіїєґA-Za-z]{1,2})[ \t]+/g, "$1$2 ");
  return glue(glue(String(s))).replace(/[ \t]+([—–])[ \t]/g, " $1 ");
}

export function rich(text) {
  if (!text) return null;
  const out = [];
  nbsp(text).split("\n").forEach((line, li) => {
    if (li) out.push(createElement("br", { key: `br${li}` }));
    const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let last = 0, m, i = 0;
    while ((m = re.exec(line))) {
      if (m.index > last) out.push(line.slice(last, m.index));
      out.push(m[1] ? createElement("strong", { key: `s${li}-${i++}` }, m[1]) : createElement("em", { key: `e${li}-${i++}` }, m[2]));
      last = re.lastIndex;
    }
    if (last < line.length) out.push(line.slice(last));
  });
  return createElement(Fragment, null, ...out);
}

// абзаци: порожній рядок розділяє
export function paragraphs(text) {
  return String(text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

// сайт живе і на app.moduler.pro/site, і (після переносу домену) на moduler.pro — внутрішні посилання беремо з бази
export function siteHref(base, h) {
  if (!h) return "#";
  if (h.startsWith("/") && !h.startsWith("//")) return (base || "") + (h === "/" ? "" : h) || "/";
  return h;
}

export const isExternal = (h) => /^https?:\/\//.test(h || "");

// фото, збережені конструктором, мають версії -640/-1280/-1920.webp; старі фото з сайту — -640/-1280
export function imgProps(url, sizes = "100vw") {
  if (!url) return {};
  const m = /^(.*)-1280\.webp$/.exec(url);
  if (!m) return { src: url };
  const big = url.includes("/atmosfera/") || url.includes("supabase.co");
  return {
    src: url,
    srcSet: `${m[1]}-640.webp 640w, ${url} 1280w` + (big ? `, ${m[1]}-1920.webp 1920w` : ""),
    sizes,
  };
}
export const imgSmall = (url) => (url ? url.replace(/-1280\.webp$/, "-640.webp") : url);

const SYMBOL = { USD: "$", EUR: "€", UAH: "₴" };
export function money(n, currency = "USD") {
  if (n == null || n === "" || isNaN(Number(n))) return "";
  const s = Math.round(Number(n)).toLocaleString("uk-UA").replace(/ /g, " ");
  return currency === "UAH" ? `${s} ₴` : `${SYMBOL[currency] || ""}${s}`;
}

export function youtubeId(s) {
  if (!s) return null;
  const m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(s);
  return m ? m[1] : /^[\w-]{11}$/.test(s.trim()) ? s.trim() : null;
}

export const phoneHref = (p) => "tel:" + String(p || "").replace(/[^\d+]/g, "");
export const viberHref = (p) => "viber://chat?number=" + encodeURIComponent(String(p || "").replace(/[^\d+]/g, ""));
// Telegram: посилання, @нік або номер телефону (t.me/+380…)
export const telegramHref = (t) => {
  if (!t) return null;
  const v = String(t).trim();
  if (/^https?:/.test(v)) return v;
  if (/^\+?\d[\d\s()-]{6,}$/.test(v)) return "https://t.me/+" + v.replace(/\D/g, "");
  return "https://t.me/" + v.replace(/^@/, "");
};

// найменша ціна моделі (для «від …»)
export function modelPriceFrom(m) {
  const vals = [m.price_shell, m.price_prefinish, m.price_ready].map(Number).filter((v) => v > 0);
  return vals.length ? Math.min(...vals) : null;
}

// ── Приховане в конструкторі ─────────────────────────────────────────────
// Перше «Видалити» лише ховає: рядок (фото, варіант) отримує префікс «~~», елемент списку чи блок — hidden: true.
// Сайт прибирає все приховане; друге «Видалити» в конструкторі видаляє назавжди.
export const HIDDEN = "~~";
export const isHiddenStr = (s) => typeof s === "string" && s.startsWith(HIDDEN);
export const hideStr = (s) => (isHiddenStr(s) ? s : HIDDEN + (s || ""));
export const unhideStr = (s) => (isHiddenStr(s) ? s.slice(HIDDEN.length) : s);
export function stripHidden(v) {
  if (Array.isArray(v)) return v.filter((x) => !isHiddenStr(x) && !(x && typeof x === "object" && x.hidden === true)).map(stripHidden);
  if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = stripHidden(v[k]); return o; }
  return isHiddenStr(v) ? "" : v;
}

// типи кейсу: kinds (кілька) або старе одиночне kind
export const caseKinds = (c) => (Array.isArray(c?.kinds) && c.kinds.length ? c.kinds : c?.kind ? [c.kind] : []);
