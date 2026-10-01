// Адаптери сайтів. Кожен уміє розібрати сторінку категорії:
//   listing(html, pageUrl) → { items: [{ title, url, price, unit, inStock, extId, brand, props, unitHint }], total? }
//   pageUrl(base, n)       → адреса n-ї сторінки категорії (n ≥ 2)
//   lumberDefault          → чим вважати дошку, якщо в назві не сказано «свіжопиляна / суха / стругана»:
//                            будмаркети продають стругану суху, склади пиломатеріалів — свіжопиляну
// unit — як магазин підписує ціну («шт», «м.п.», «м²» …), unitHint — підказка «ціна вказана за …».
// Якщо сайт змінить розмітку — правити лише тут; перевірка: node run.mjs --probe=<url>.

import { cards, text, num, abs, first, decode, jsonLd } from "./lib.mjs";

const withParam = (base, key, n) => {
  const u = new URL(base);
  u.searchParams.set(key, n);
  return u.href;
};

// «Довжина: 2 м» / <dt>Ширина</dt><dd>30</dd> → { довжина: "2 м", … }
function propsFrom(pairs) {
  const out = {};
  for (const [k, v] of pairs) {
    const key = text(k).replace(/:$/, "").trim().toLowerCase();
    const val = text(v);
    if (key && val && key.length < 40) out[key] = val;
  }
  return out;
}

export const SITES = {
  // ── Епіцентр: мікродані schema.org у картках, сторінки ?PAGEN_1=N ──
  epicentr: {
    name: "Епіцентр",
    website: "https://epicentrk.ua/",
    lumberDefault: "planed",
    pageUrl: (base, n) => withParam(base, "PAGEN_1", n),
    listing(html, pageUrl) {
      const items = [];
      for (const c of cards(html, 'data-product-card-action="favorite"')) {
        const m = /<p data-product-card-name[^>]*>\s*<a href="([^"]+)" title="([^"]*)"/.exec(c);
        if (!m) continue;
        const main = /data-product-price-main[\s\S]{0,400}?itemprop="price"[^>]*>\s*([\d.,\s]+)<\/data>\s*<data[^>]*itemprop="priceCurrency"[^>]*>([^<]*)</.exec(c);
        const price = num(main?.[1]) ?? num(first(/<data content="([\d.]+)"[^>]*itemprop="price"/, c.split("StrikethroughPrice").pop()));
        if (price == null) continue;
        const avail = first(/itemprop="availability" content="[^"]*\/(\w+)"/, c);
        items.push({
          title: decode(m[2]).trim(),
          url: abs(m[1], pageUrl),
          price,
          unit: (main?.[2] || "").replace(/[₴/.\s]/g, "") || null,
          inStock: avail ? avail === "InStock" : null,
          props: propsFrom([...c.matchAll(/<dt itemprop="name">([\s\S]*?)<\/dt>\s*<dd itemprop="value">([\s\S]*?)<\/dd>/g)].map((x) => [x[1], x[2]])),
        });
      }
      return { items };
    },
  },

  // ── ОЛДІ: у кожній картці JSON-LD Product, сторінки /page=N/ ──
  oldi: {
    name: "ОЛДІ",
    website: "https://oldimarket.com.ua/",
    lumberDefault: "planed",
    pageUrl: (base, n) => base.replace(/\/?$/, "/") + `page=${n}/`,
    listing(html) {
      const items = [];
      for (const c of cards(html, /class="card-item[ "]/)) {
        const ld = jsonLd(c).find((x) => x["@type"] === "Product");
        if (!ld?.offers) continue;
        const price = num(ld.offers.price);
        if (price == null) continue;
        items.push({
          title: decode(ld.name).trim(),
          url: ld.url || ld.offers.url,
          price,
          unit: null,
          inStock: /InStock/.test(ld.offers.availability || "") ? true : /OutOfStock/.test(ld.offers.availability || "") ? false : null,
          extId: ld.sku || null,
          brand: decode(first(/data-cdp-google-item-brand="([^"]*)"/, c) || "") || null,
          props: {},
        });
      }
      return { items, total: num(first(/data-calypso-list-rec-count="(\d+)"/, html)) };
    },
  },

  // ── Budia (ImageCMS): ціна «205» + «.50», підказка «Ціна вказана за 3 м», сторінки ?per_page=<зсув> ──
  budia: {
    name: "Budia",
    website: "https://budia.ua/",
    lumberDefault: "fresh",
    perPage: 24,
    pageUrl: (base, n) => withParam(base, "per_page", (n - 1) * 24),
    listing(html) {
      const items = [];
      for (const c of cards(html, /class="product-cut[ "]/)) {
        const m = /class="product-cut__title-link"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(c);
        const p = /data-product-price--main="[^"]*">([\d\s]+)<\/span>(?:<span[^>]*data-product-price--coins="[^"]*">([.,]\d+)<\/span>)?/.exec(c);
        if (!m || !p) continue;
        const price = num(p[1].replace(/\s/g, "") + (p[2] || ""));
        if (price == null) continue;
        const hint = first(/class="product-photo__text">\s*<p>([\s\S]*?)<\/p>/, c);
        items.push({
          title: text(m[2]),
          url: m[1],
          price,
          unit: null,
          unitHint: hint ? text(hint) : null,
          inStock: !/class="product-buy__available\s+hidden/.test(c),
          extId: first(/data-product-button--variant="(\d+)"/, c),
          props: {},
        });
      }
      return { items };
    },
  },

  // ── КУБ (OpenCart): характеристики й «грн/м.п.» прямо в списку, сторінки ?page=N ──
  kub: {
    name: "КУБ",
    website: "https://kub.in.ua/",
    lumberDefault: "fresh",
    pageUrl: (base, n) => withParam(base, "page", n),
    listing(html) {
      const items = [];
      for (const c of cards(html, 'class="image tc product-grid-image"')) {
        const url = first(/<a class="imgages-view" href="([^"]+)"/, c);
        const title = first(/<img[^>]*title="([^"]+)"/, c);
        const price = num(first(/name="kolvocena" value="([\d.,]+)"/, c)) ?? num(first(/class="cena[^"]*">\s*([\d\s.,]+)/, c));
        if (!url || !title || price == null) continue;
        const up = /class="unit-price">\s*<span>([\d\s.,]+)<\/span>\s*грн\/([^<\s]+)/.exec(c);
        const stock = first(/class="quantity-stock">([\s\S]*?)<\/div>/, c);
        items.push({
          title: decode(title).trim(),
          url,
          price,
          unit: null,
          perUnit: up ? { unit: up[2].trim(), price: num(up[1]) } : null,
          inStock: stock ? /В наличии|В наявності/i.test(stock) : null,
          extId: first(/Код товар[ау]:\s*(\d+)/, c),
          props: propsFrom([...c.matchAll(/<li><span>([^<]*)<\/span>\s*<span>([^<]*)<\/span>/g)].map((x) => [x[1], x[2]])),
        });
      }
      return { items };
    },
  },

  // ── Budmaterial (OpenCart), сторінки ?page=N ──
  budmaterial: {
    name: "Budmaterial",
    website: "https://budmaterial.kyiv.ua/",
    lumberDefault: "fresh",
    pageUrl: (base, n) => withParam(base, "page", n),
    listing(html) {
      const items = [];
      for (const c of cards(html, /class="product product-7[ "]/)) {
        const m = /class="product-title"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(c);
        const p = first(/class="price-new">\s*([\d\s.,]+)/, c) ?? first(/class="product-price[^"]*">\s*(?:<span[^>]*>)?\s*([\d\s.,]+)\s*грн/, c);
        if (!m || p == null) continue;
        const price = num(p);
        if (price == null) continue;
        items.push({
          title: text(m[2]),
          url: decode(m[1]),
          price,
          unit: null,
          inStock: /stock-success/.test(c) ? true : /stock-(danger|out|warning)|Немає в наявності|Під замовлення/i.test(c) ? false : null,
          props: {},
        });
      }
      return { items };
    },
  },

  // ── М2 (OpenCart, тема oct_remarket): характеристики в списку, сторінки ?page=N ──
  m2: {
    name: "М2",
    website: "https://m2.org.ua/",
    lumberDefault: "fresh",
    pageUrl: (base, n) => withParam(base, "page", n),
    listing(html) {
      const items = [];
      const zone = html.split('class="row no-gutters rm-category-products"')[1] || html;
      for (const c of cards(zone, 'class="rm-module-img d-flex')) {
        const m = /class="rm-module-title">\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(c);
        const p = first(/class="rm-module-price">\s*([\d\s.,]+)\s*грн/, c);
        if (!m || p == null) continue;
        const price = num(p);
        if (price == null) continue;
        items.push({
          title: text(m[2]),
          url: decode(m[1]),
          price,
          unit: null,
          inStock: !/rm-out-of-stock/.test(c),
          extId: first(/Код товару:\s*(\d+)/, c),
          props: propsFrom([...c.matchAll(/class="rm-module-attr-item">\s*<span>([^<]*)<\/span>\s*<span class="rm-module-attr-item-header">([^<]*)<\/span>/g)].map((x) => [x[1], x[2]])),
        });
      }
      return { items };
    },
  },
};
