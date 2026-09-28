// Дані сайту для сервера: опубліковане читається анонімним ключем і кешується (тег "site").
// Кнопка «Опублікувати» в конструкторі скидає кеш через /api/site/revalidate.
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function anon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const cached = (fn, key) => unstable_cache(fn, ["site", key], { tags: ["site"], revalidate: 600 });

export const getSettings = cached(async () => {
  const { data } = await anon().from("site_settings").select("value").eq("key", "main").maybeSingle();
  return data?.value || {};
}, "settings");

export const getPage = cached(async (slug) => {
  const { data } = await anon()
    .from("site_pages")
    .select("slug,title,nav_label,seo_title,seo_description,og_image,blocks,updated_at")
    .eq("slug", slug).eq("published", true).maybeSingle();
  return data || null;
}, "page");

export const getPagesList = cached(async () => {
  const { data } = await anon().from("site_pages").select("slug,title,nav_label,in_nav,sort,updated_at").eq("published", true).order("sort");
  return data || [];
}, "pages");

export const getModels = cached(async () => {
  const { data } = await anon().from("site_models").select("*").eq("published", true).order("sort").order("area_m2");
  return data || [];
}, "models");

export const getCases = cached(async () => {
  const { data } = await anon().from("site_cases").select("*").eq("published", true).order("sort");
  return data || [];
}, "cases");

// усе, що потрібно блокам сторінки, одним викликом
export async function getSiteContext() {
  const [settings, models, cases] = await Promise.all([getSettings(), getModels(), getCases()]);
  return { settings, models, cases, base: await getBase() };
}

// proxy ставить x-site-base: "" на домені moduler.pro, інакше сайт живе під /site
export async function getBase() {
  const h = await headers();
  const b = h.get("x-site-base");
  return b == null ? "/site" : b;
}

export async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "moduler.pro";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}
