// Ринкові розцінки на будівельні роботи з rabotniki.ua: на сторінці категорії (загалом по Україні або по місту)
// є блок «Види робіт та діапазон цін» — кількість пропозицій, мін–макс і середня ціна кожної роботи.
// robots.txt сайту дозволяє ці сторінки; ходимо не частіше разу на секунду (getHtml).

import { getHtml, text, num, first } from "../price-parser/lib.mjs";

const BASE = "https://www.rabotniki.ua/uk";
export const pageUrl = (category, city) => `${BASE}/${category}${city ? `/${city}` : ""}`;

// HTML сторінки категорії → [{ work, name, unit, offers, min, max, avg, url }]
export function parseCategory(html) {
  const block = html.split("Види робіт та діапазон цін")[1]?.split("</ul>")[0] || "";
  const rows = [];
  for (const li of block.split(/<li class="list-group-item/).slice(1)) {
    const a = /<a[^>]*href="(\/uk\/price\/([a-z0-9-]+)(?:\/[a-z-]+)?)"[^>]*>([\s\S]*?)<\/a>/.exec(li);
    if (!a) continue;
    const range = text(first(/Діапазон цін:\s*<b>([\s\S]*?)<\/b>/, li) || "");
    const [lo, hi] = range.split(/\s+-\s+/).map((v) => num(v));
    const avg = num(first(/Середня ціна<\/div>\s*<b[^>]*>([\s\S]*?)<\/b>/, li));
    const unit = text(first(/Середня ціна<\/div>\s*<b[^>]*>[\s\S]*?<\/b>\s*<small[^>]*>([\s\S]*?)<\/small>/, li) || "").replace(/^грн\s*\/?\s*/, "") || null;
    if (lo == null && avg == null) continue;
    rows.push({
      work: a[2],
      name: text(a[3]),
      unit,
      offers: num(first(/Всього пропозицій:\s*<b>(\d+)<\/b>/, li)),
      min: lo ?? avg,
      max: hi ?? lo ?? avg,
      avg: avg ?? lo,
      url: `https://www.rabotniki.ua${a[1]}`,
    });
  }
  return rows;
}

// Усі категорії для одного міста ("" — вся Україна) → рядки для запису
export async function crawlCity(city, categories, { deadline = 0, log = () => {} } = {}) {
  const rows = [];
  const failed = [];
  for (const c of categories) {
    if (deadline && Date.now() > deadline) { failed.push(c.slug); continue; }
    try {
      const { html, status } = await getHtml(pageUrl(c.slug, city));
      if (status === 404) continue; // у цьому місті такої категорії немає
      for (const r of parseCategory(html)) rows.push({ category: c.slug, ...r });
    } catch (e) {
      failed.push(c.slug);
      log(`  ${city || "Україна"} · ${c.slug}: ${e.message}`);
    }
  }
  return { rows, failed };
}
