// Картка одного товару за посиланням: назва, опис, фото, ціна — зі стандартної розмітки сторінки
// (JSON-LD Product, Open Graph, мікродані). Працює з будь-яким магазином, окремих правил під сайт не треба.
// Чого на сторінці немає — повертаємо null, людина допише сама.
import { abs, decode, jsonLd, num, text } from "./lib.mjs";

// усі <meta>: ключ (property / name / itemprop) → content; перше значення виграє
function metas(html) {
  const out = new Map();
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = {};
    for (const m of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[m[1].toLowerCase()] = m[2] ?? m[3];
    const key = (a.property || a.name || a.itemprop || "").toLowerCase();
    if (key && a.content != null && !out.has(key)) out.set(key, decode(a.content).trim());
  }
  return out;
}

// вузол Product у JSON-LD: на верхньому рівні, у @graph або в mainEntity
function findProduct(nodes, depth = 0) {
  for (const n of nodes) {
    if (!n || typeof n !== "object") continue;
    if ([].concat(n["@type"] || []).some((t) => /^Product$/i.test(String(t)))) return n;
    if (depth < 3) {
      const inner = findProduct([].concat(n["@graph"] || [], n.mainEntity || [], n.itemListElement || [], n.item || []), depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

function offerPrice(offers) {
  for (const o of [].concat(offers || [])) {
    if (!o || typeof o !== "object") continue;
    const price = num(o.price ?? o.lowPrice ?? o.priceSpecification?.price);
    if (price > 0) return { price, currency: o.priceCurrency || o.priceSpecification?.priceCurrency || null };
    const nested = offerPrice(o.offers);
    if (nested) return nested;
  }
  return null;
}

const imageOf = (v) => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" ? x : x?.url || x?.contentUrl || null;
};
const clean = (s, max) => {
  const t = text(String(s ?? ""));
  return t ? (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t) : null;
};

// WooCommerce: ціни варіантів (довжина, вологість…) у data-product_variations; варіант із посилання або найдешевший
function wooVariationPrice(html, pageUrl) {
  const raw = /data-product_variations=(?:"([^"]*)"|'([^']*)')/i.exec(html);
  if (!raw) return null;
  let list;
  try { list = JSON.parse(decode(raw[1] ?? raw[2])); } catch { return null; }
  if (!Array.isArray(list) || !list.length) return null;
  const want = [...new URL(pageUrl).searchParams].filter(([k]) => k.startsWith("attribute_"));
  const hit = want.length && list.find((v) => want.every(([k, val]) => !v.attributes?.[k] || v.attributes[k] === val));
  const prices = (hit ? [hit] : list).map((v) => num(v.display_price)).filter((v) => v > 0);
  return prices.length ? Math.min(...prices) : null;
}

// Запасний шлях: перший блок із «price» у класі після заголовка товару, де є сума з ₴ / грн
function pagePrice(html) {
  const from = Math.max(0, html.search(/<h1[\s>]/i));
  const part = html.slice(from, from + 80000);
  for (const m of part.matchAll(/class=["']([^"']*price[^"']*)["']/gi)) {
    if (/old|was|regular|cart|autocomplete|thumb|header|related|crossed|delivery/i.test(m[1])) continue;
    const chunk = text(part.slice(m.index, m.index + 500).replace(/^[^>]*>/, ""));
    const p = /(\d[\d\s ]{0,9})(?:\s*[.,]\s*(\d{1,2}))?\s*(?:₴|грн)/i.exec(chunk);
    if (p) {
      const v = num(`${p[1].replace(/[\s ]/g, "")}.${p[2] || "0"}`);
      if (v > 0) return v;
    }
  }
  return null;
}

// назва без рекламного хвоста: «… купити в Києві за найкращою ціною», «… | Магазин»
const tidyName = (s) => s && s.replace(/\s+(купити|купить|недорого)(\s.*)?$/i, "").replace(/\s+\|\s+[^|]{2,40}$/, "").trim();

export function productFromHtml(html, pageUrl) {
  const meta = metas(html);
  const ld = findProduct(jsonLd(html)) || {};
  const offer = offerPrice(ld.offers);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const microPrice = /itemprop=["']price["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1] || /content=["']([^"']+)["'][^>]*itemprop=["']price["']/i.exec(html)?.[1];

  const marked = offer?.price ?? num(meta.get("product:price:amount") ?? meta.get("og:price:amount") ?? microPrice) ?? wooVariationPrice(html, pageUrl);
  const guessed = marked > 0 ? null : pagePrice(html);
  const price = marked > 0 ? marked : guessed;
  const image = imageOf(ld.image) || meta.get("og:image") || meta.get("twitter:image") || null;
  const brand = typeof ld.brand === "string" ? ld.brand : ld.brand?.name || null;
  return {
    name: tidyName(clean(ld.name, 200) || clean(h1, 200) || clean(meta.get("og:title"), 200) || clean(title, 200)),
    description: clean(ld.description, 900) || clean(meta.get("og:description"), 900) || clean(meta.get("description"), 900),
    image: image ? abs(image, pageUrl) : null,
    price: price > 0 ? price : null,
    priceGuessed: !!guessed, // ціну взято з тексту сторінки, а не з розмітки — варто звірити
    currency: offer?.currency || meta.get("product:price:currency") || meta.get("og:price:currency") || null,
    brand: clean(brand, 80),
    site: clean(meta.get("og:site_name"), 80),
  };
}
