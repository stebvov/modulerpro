// Дані сайту для сервера: опубліковане читається анонімним ключем і кешується (тег "site").
// Приховане в конструкторі (фото «~~…», елементи з hidden) сюди не потрапляє — див. stripHidden.
// Кнопка «Опублікувати» в конструкторі скидає кеш через /api/site/revalidate.
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { stripHidden } from "./format";
import { DEFAULT_LANG, LANGS, i18nKey, isLang, makeT, translateDeep } from "./i18n";
import { UI } from "./i18n-ui";

function anon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const cached = (fn, key) => unstable_cache(fn, ["site", key], { tags: ["site"], revalidate: 600 });

const rawSettings = cached(async () => {
  const { data } = await anon().from("site_settings").select("value").eq("key", "main").maybeSingle();
  return stripHidden(data?.value || {});
}, "settings");

const rawPage = cached(async (slug) => {
  const { data } = await anon()
    .from("site_pages")
    .select("slug,title,nav_label,seo_title,seo_description,og_image,blocks,updated_at")
    .eq("slug", slug).eq("published", true).maybeSingle();
  return data ? { ...data, og_image: stripHidden(data.og_image) } : null;
}, "page");

const rawPagesList = cached(async () => {
  const { data } = await anon().from("site_pages").select("slug,title,nav_label,in_nav,sort,updated_at").eq("published", true).order("sort");
  return data || [];
}, "pages");

const rawModels = cached(async () => {
  const { data } = await anon().from("site_models").select("*").eq("published", true).order("sort").order("area_m2");
  return stripHidden(data || []);
}, "models");

const rawCases = cached(async () => {
  const { data } = await anon().from("site_cases").select("*").eq("published", true).order("sort");
  return stripHidden(data || []);
}, "cases");

// відкриті вакансії з позначкою «показувати на сайті» (розділ системи «Люди: найм і розвиток»)
const rawVacancies = cached(async () => {
  const { data } = await anon().from("hr_vacancies").select("id,title,city,format,conditions,description,sort,created_at")
    .eq("status", "open").eq("on_site", true).order("sort").order("created_at");
  return data || [];
}, "vacancies");

// ── Мова ─────────────────────────────────────────────────────────────────
// proxy ставить x-site-lang для адрес /en/…; базові тексти — українські, переклад — словник site_i18n + написи з коду
export async function getLang() {
  const l = (await headers()).get("x-site-lang");
  return isLang(l) ? l : DEFAULT_LANG;
}

const rawDict = cached(async (lang) => {
  const out = {};
  for (let from = 0; ; from += 1000) { // база віддає не більше 1000 рядків за раз
    const { data } = await anon().from("site_i18n").select("src,text").eq("lang", lang).order("src_hash").range(from, from + 999);
    (data || []).forEach((r) => { if (r.text && r.text.trim()) out[i18nKey(r.src)] = r.text; });
    if (!data || data.length < 1000) break;
  }
  return out;
}, "i18n");

// словник мови: написи з коду + переклади з бази (база має перевагу); для української — null
export async function getDict(lang) {
  return isLang(lang) ? { ...(UI[lang] || {}), ...(await rawDict(lang)) } : null;
}

async function localize(v) {
  const lang = await getLang();
  return isLang(lang) && v != null ? translateDeep(v, await getDict(lang)) : v;
}

// t("напис") і tf("Фото {n}", { n }) для серверних сторінок
export async function getT() {
  const lang = await getLang();
  const t = makeT(await getDict(lang));
  const tf = (s, vars) => String(t(s)).replace(/\{(\w+)\}/g, (_, k) => vars?.[k] ?? "");
  return { lang, t, tf };
}

export const getSettings = async () => localize(await rawSettings());
export const getPage = async (slug) => localize(await rawPage(slug));
export const getPagesList = async () => localize(await rawPagesList());
export const getModels = async () => localize(await rawModels());
export const getCases = async () => localize(await rawCases());
export const getVacancies = async () => localize(await rawVacancies());

// усе, що потрібно блокам сторінки, одним викликом
export async function getSiteContext() {
  const [settings, models, cases, vacancies, tr] = await Promise.all([getSettings(), getModels(), getCases(), getVacancies(), getT()]);
  return { settings, models, cases, vacancies, base: await getBase(), t: tr.t, tf: tr.tf, lang: tr.lang };
}

// адреси цієї сторінки для Google: канонічна (поточною мовою) і версії іншими мовами
export async function getAlternates(path) {
  const [base, lang] = await Promise.all([getBase(), getLang()]);
  const root = isLang(lang) ? base.slice(0, -(lang.length + 1)) : base;
  const p = path === "/" ? "" : path;
  const languages = { [DEFAULT_LANG]: root + p || "/", "x-default": root + p || "/" };
  for (const l of Object.keys(LANGS)) if (isLang(l)) languages[l] = `${root}/${l}${p}`;
  return { canonical: base + p || "/", languages };
}

// proxy ставить x-site-base: "" на домені moduler.pro, інакше сайт живе під /site
// спільна частина openGraph: власний openGraph сторінки повністю заміняє заданий у макеті,
// тож назву сайту й мову (og:locale) кожна сторінка додає звідси
export async function getOgBase() {
  const [s, lang] = await Promise.all([getSettings(), getLang()]);
  return { siteName: s.brand?.name || "Moduler", locale: LANGS[lang].og, type: "website" };
}

export async function getBase() {
  const h = await headers();
  const b = h.get("x-site-base");
  return b == null ? "/site" : b;
}

// індексувати в Google лише основний домен сайту (proxy ставить x-site-index: "1")
export async function isIndexable() {
  return (await headers()).get("x-site-index") === "1";
}

export async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "moduler.pro";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}
