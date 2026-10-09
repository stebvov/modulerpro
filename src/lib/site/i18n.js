// Мови сайту. Український текст — основний: він лежить у конструкторі (сторінки, моделі, кейси, налаштування).
// Переклад — словник «український текст → текст іншою мовою» (таблиця site_i18n + написи з коду в i18n-ui.js).
// Немає перекладу — показуємо український текст, тож структура сторінок завжди одна для всіх мов.
// Файл без залежностей: ним користуються сервер, браузер і службові скрипти.

export const DEFAULT_LANG = "uk";
export const LANGS = {
  uk: { label: "UA", name: "Українська", html: "uk", og: "uk_UA" },
  en: { label: "EN", name: "English", html: "en", og: "en_US" },
  pl: { label: "PL", name: "Polski", html: "pl", og: "pl_PL" },
  ru: { label: "RU", name: "Русский", html: "ru", og: "ru_RU" },
};
export const isLang = (l) => l !== DEFAULT_LANG && Object.prototype.hasOwnProperty.call(LANGS, l);
// коди мов-перекладів для адрес: "en|pl|ru" — /en/…, /pl/…, /ru/… (нова мова в LANGS підхоплюється сама)
export const LANG_ALT = Object.keys(LANGS).filter(isLang).join("|");
const LANG_PREFIX = new RegExp(`^/(${LANG_ALT})(?=/|$)`);

// форма множини для числа: 0 — одна (1 спальня), 1 — кілька (2 спальні), 2 — багато (5 спалень)
export function pluralForm(lang, n) {
  const k = Math.abs(Number(n)) || 0;
  if (!Number.isInteger(k)) return 1; // 1,5 модуля
  if (lang === "en") return k === 1 ? 0 : 2;
  const d = k % 10, h = k % 100;
  const few = d >= 2 && d <= 4 && !(h >= 12 && h <= 14);
  if (lang === "pl") return k === 1 ? 0 : few ? 1 : 2;
  return d === 1 && h !== 11 ? 0 : few ? 1 : 2; // українська, російська
}
// лапки мовою сайту
export const quotes = (lang) => (lang === "en" ? ["“", "”"] : lang === "pl" ? ["„", "”"] : ["«", "»"]);

// технічні поля: адреси, посилання, позначки — їх не перекладаємо, навіть якщо там кирилиця
const SKIP = new Set(["id", "type", "href", "slug", "also", "image", "image_morning", "image_evening", "image_night", "images", "photos", "plans", "plan_image", "photo",
  "og_image", "logo", "video", "map_url", "anchor", "pipeline", "kind", "kinds", "template_id", "created_at", "updated_at", "published_at"]);
// поля, для яких поруч із перекладом лишаємо український оригінал (ключ_src): варіанти форми заявки ідуть у CRM
// українською (за ними обирається воронка), назва моделі й кейсу — теж; формат кейсу потрібен для пошуку схожих
const KEEP_SRC = new Set(["goal", "goals", "areas", "name", "title", "format"]);

const CYR = /[А-Яа-яІіЇїЄєҐґ]/;
export const translatable = (s) => typeof s === "string" && CYR.test(s);
// ключ словника — текст без пробілів по краях; нерозривні пробіли й звичайні вважаємо однаковими
export const i18nKey = (s) => String(s).replace(/[\u00a0\u202f]/g, " ").trim();

// усі тексти запису, які треба перекласти (без повторів)
export function collectStrings(v, out = new Set(), key = "") {
  if (typeof v === "string") {
    if (!SKIP.has(key) && translatable(v)) out.add(i18nKey(v));
  } else if (Array.isArray(v)) {
    v.forEach((x) => collectStrings(x, out, key));
  } else if (v && typeof v === "object") {
    for (const k in v) if (!SKIP.has(k)) collectStrings(v[k], out, k);
  }
  return out;
}

// копія запису з перекладеними текстами; чого немає в словнику — лишається українською
export function translateDeep(v, dict, key = "") {
  // шукаємо в словнику будь-який рядок: так можна перекласти й запис числа («$59 900» → «$59,900»)
  if (typeof v === "string") return SKIP.has(key) ? v : dict[i18nKey(v)] ?? v;
  if (Array.isArray(v)) return v.map((x) => translateDeep(x, dict, key));
  if (v && typeof v === "object") {
    const o = {};
    for (const k in v) {
      o[k] = SKIP.has(k) ? v[k] : translateDeep(v[k], dict, k);
      if (KEEP_SRC.has(k)) o[`${k}_src`] = v[k];
    }
    return o;
  }
  return v;
}

// t("український напис") → переклад; для української мови повертає сам напис
export const makeT = (dict) => (dict ? (s) => (typeof s === "string" ? dict[i18nKey(s)] ?? s : s) : (s) => s);

// адреса тієї самої сторінки іншою мовою: /modeli ↔ /en/modeli (root — "" на домені сайту або "/site")
export function langPath(pathname, root, lang) {
  let p = String(pathname || "/");
  if (root && p.startsWith(root)) p = p.slice(root.length) || "/";
  p = p.replace(LANG_PREFIX, "") || "/";
  return (root || "") + (isLang(lang) ? `/${lang}` : "") + (p === "/" ? "" : p) || "/";
}
