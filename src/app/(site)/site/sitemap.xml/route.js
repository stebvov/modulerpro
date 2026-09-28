// Карта сайту для Google: сторінки конструктора, моделі, кейси.
import { getBase, getCases, getModels, getOrigin, getPagesList } from "@/lib/site/data";

export async function GET() {
  const [pages, models, cases, origin, base] = await Promise.all([getPagesList(), getModels(), getCases(), getOrigin(), getBase()]);
  const root = origin + (base || "");
  const url = (path, date, pr) => `<url><loc>${root}${path}</loc>${date ? `<lastmod>${new Date(date).toISOString()}</lastmod>` : ""}<priority>${pr}</priority></url>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
    ...pages.map((p) => url(p.slug === "home" ? "/" : `/${p.slug}`, p.updated_at, p.slug === "home" ? "1.0" : "0.8")),
    ...models.map((m) => url(`/modeli/${m.slug}`, m.updated_at, "0.7")),
    ...cases.map((c) => url(`/kejsy/${c.slug}`, c.updated_at, "0.6")),
  ].join("")}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
