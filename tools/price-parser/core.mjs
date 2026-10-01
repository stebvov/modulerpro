// Ядро парсера: обхід категорій магазину, зіставлення з матеріалами, запис через rpc.
// Викликається з командного рядка (run.mjs) і з сервера (src/app/api/price-parser/run).

import { SITES, genericListing } from "./sites.mjs";
import { getHtml, text } from "./lib.mjs";
import { match, pageFacts } from "./normalize.mjs";

// rpc до Supabase з публічним ключем; доступ до функцій парсера дає токен у параметрах
export function makeRpc(url, key) {
  return async (name, body) => {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const out = await res.text();
    if (!res.ok) throw new Error(`rpc ${name}: ${res.status} ${out.slice(0, 300)}`);
    return out ? JSON.parse(out) : null;
  };
}

const timeUp = (deadline) => deadline && Date.now() > deadline;

// Обхід сторінок категорій одного магазину → товари (url → item) і стан кожного джерела
export async function crawl(site, sources, { maxPages = 0, firstPageOnly = false, deadline = 0, log = () => {} } = {}) {
  const adapter = SITES[site];
  const items = new Map();
  const stats = [];
  const products = new Map(); // сторінка товару → його варіанти (той самий товар може бути в кількох джерелах)
  let blocked = false; // сайт відмовив на першій же сторінці — решту джерел не смикаємо
  for (const src of sources) {
    const seen = new Set();
    let pages = 0, error = null;
    try {
      if (blocked) throw new Error("HTTP 403");
      if (timeUp(deadline)) throw new Error("забракло часу на обхід");
      const limit = Math.min(maxPages || Infinity, src.max_pages || 15);
      for (let p = 1; p <= limit; p++) {
        const url = p === 1 ? src.url : adapter.pageUrl(src.url, p);
        const { html, status } = await getHtml(url);
        if (status === 404) {
          if (p === 1) throw new Error("сторінки не існує (404)");
          break;
        }
        const { items: listed, links = [], total } = adapter.listing(html, url);
        // магазин показує ціни лише на сторінках товарів (варіанти довжини, вологості) — відкриваємо кожен товар зі списку
        const found = [...listed];
        for (const link of links) {
          if (!products.has(link)) {
            if (timeUp(deadline)) throw new Error("забракло часу на обхід");
            const page = await getHtml(link);
            products.set(link, page.status === 404 ? [] : adapter.product(page.html, link));
            pages++;
          }
          found.push(...products.get(link));
        }
        let fresh = 0;
        for (const it of found) {
          if (!it.url || !(it.price > 0) || seen.has(it.url)) continue;
          seen.add(it.url);
          fresh++;
          const prev = items.get(it.url);
          if (prev) prev.grps.add(src.grp);
          else items.set(it.url, { ...it, lumberDefault: adapter.lumberDefault, grps: new Set([src.grp]) });
        }
        pages++;
        if (!fresh || (total && seen.size >= total) || firstPageOnly) break;
        if (timeUp(deadline)) throw new Error("забракло часу на обхід");
      }
      if (!seen.size && !error) error = "жодного товару — змінилась адреса або розмітка";
    } catch (e) {
      const denied = /HTTP 40[13]/.test(e.message);
      if (denied && !pages) blocked = true;
      error = denied ? "сайт не пускає запити з цього сервера (403)" : e.message;
    }
    stats.push({ id: src.id, grp: src.grp, url: src.url, items: seen.size, pages, error });
    log(`  ${site} · ${src.grp}: ${seen.size} товарів, ${pages} стор.${error ? ` — ${error}` : ""}`);
  }
  return { items, stats };
}

function toOffer(site, m, it, r, page) {
  return {
    site,
    material_id: m.id,
    url: it.url,
    ext_id: it.extId || null,
    title: it.title,
    brand: it.brand || null,
    attrs: { ...r.attrs, ...(page ? { page } : {}) },
    price: it.price,
    sale_unit: r.sale_unit,
    unit_price: r.unit_price,
    unit_prices: r.unit_prices,
    in_stock: it.inStock ?? null,
  };
}

// Товари магазину × правила матеріалів → пропозиції. Де ціну за одиницю не вирахувати з назви —
// раз відкриваємо сторінку товару (до enrichLimit сторінок за запуск; знайдене кешується в attrs.page).
export async function matchSite(site, items, materials, known, { enrichLimit = 80, deadline = 0, log = () => {} } = {}) {
  const offers = [];
  const need = [];
  for (const m of materials) {
    for (const it of items.values()) {
      if (!it.grps.has("*") && !m.rule.groups?.some((g) => it.grps.has(g))) continue; // «*» — сторінка, надіслана людиною: група невідома
      const cached = known.get(`${site}|${it.url}`);
      const page = cached && cached.title === it.title ? cached.attrs?.page : undefined;
      const r = match(it, m.rule, page);
      if (!r) continue;
      if (r.unit_price == null && page === undefined) need.push({ m, it });
      else offers.push(toOffer(site, m, it, r, page));
    }
  }
  const facts = new Map();
  let fetched = 0;
  for (const { m, it } of need) {
    let page = facts.get(it.url);
    if (page === undefined && fetched < enrichLimit && !timeUp(deadline)) {
      fetched++;
      try {
        const { html } = await getHtml(it.url);
        page = pageFacts(text(html));
      } catch {
        page = null;
      }
      facts.set(it.url, page);
    }
    const r = match(it, m.rule, page || undefined);
    if (r) offers.push(toOffer(site, m, it, r, page || undefined));
  }
  if (fetched) log(`  ${site}: відкрито сторінок товарів — ${fetched}`);
  return offers;
}

// Повний цикл для одного магазину. cfg — відповідь rpc price_parser_config.
// partial = запуск по частині груп/матеріалів/сторінок: тоді «зниклими» нічого не позначаємо.
export async function runSite({ site, cfg, rpc, token, runId = null, dry = false, onlyGrps = null, materials = null, maxPages = 0, firstPageOnly = false, enrichLimit = 80, deadline = 0, partial = false, log = () => {} }) {
  const mats = materials || cfg.materials.filter((m) => m.rule);
  const known = new Map((cfg.known || []).map((k) => [`${k.site}|${k.url}`, k]));
  const sources = cfg.sources.filter((s) => s.site === site && (!onlyGrps || onlyGrps.includes(s.grp)));
  try {
    if (!SITES[site]) throw new Error(`немає адаптера для «${site}»`);
    const { items, stats } = await crawl(site, sources, { maxPages, firstPageOnly, deadline, log });
    const offers = firstPageOnly ? [] : await matchSite(site, items, mats, known, { enrichLimit, deadline, log });
    const badGrps = new Set(stats.filter((s) => s.error).map((s) => s.grp));
    const hasGrp = new Set(stats.map((s) => s.grp));
    // матеріал «обійдено повністю», якщо всі його групи на цьому сайті відпрацювали без помилок
    const complete = partial || onlyGrps || maxPages ? [] : mats
      .filter((m) => m.rule.groups.some((g) => hasGrp.has(g)) && !m.rule.groups.some((g) => badGrps.has(g)))
      .map((m) => m.id);
    const failed = stats.filter((s) => s.error);
    const res = {
      site, stats, offers, complete,
      ok: stats.length > 0 && failed.length < stats.length,
      error: !failed.length ? null
        : failed.length === stats.length ? failed[0].error
        : `джерел із помилкою: ${failed.length} з ${stats.length} (${[...new Set(failed.map((s) => s.grp))].join(", ")})`,
      pages: stats.reduce((a, s) => a + s.pages, 0),
      items: items.size,
    };
    if (!dry) {
      res.saved = await rpc("price_parser_ingest", {
        p_token: token,
        p: { run_id: runId, site, ok: res.ok, error: res.error, pages: res.pages, items: res.items, complete, sources: stats.filter((s) => s.id), offers },
      });
    }
    return res;
  } catch (e) {
    if (!dry) await rpc("price_parser_ingest", { p_token: token, p: { run_id: runId, site, ok: false, error: e.message, offers: [], sources: [] } }).catch(() => {});
    return { site, stats: [], offers: [], ok: false, error: e.message, pages: 0, items: 0 };
  }
}

// Сторінка магазину, яку людина надіслала зі свого браузера (сайт не пускає програми): розбираємо товари,
// шукаємо серед них позиції за всіма правилами й записуємо. Сторінок товарів не відкриваємо, «зниклими» нічого не позначаємо —
// пропозиції, яких не бачили понад staleDays днів, база сама вважає неактуальними.
export async function capturePage({ site, url, html, cfg, rpc, token, staleDays = 60 }) {
  const adapter = SITES[site];
  let found = adapter ? adapter.listing(html, url).items : [];
  if (!found.length) found = genericListing(html, url).items;
  const items = new Map();
  for (const it of found) {
    if (it.url && it.price > 0 && !items.has(it.url)) items.set(it.url, { ...it, lumberDefault: adapter?.lumberDefault, grps: new Set(["*"]) });
  }
  const materials = cfg.materials.filter((m) => m.rule);
  const known = new Map((cfg.known || []).map((k) => [`${k.site}|${k.url}`, k]));
  const offers = await matchSite(site, items, materials, known, { enrichLimit: 0 });
  if (!items.size) return { items: 0, offers, saved: null };

  const bare = (u) => u.split(/[?#]/)[0].replace(/\/$/, "");
  const src = cfg.sources.find((s) => s.site === site && bare(s.url) === bare(url));
  const saved = await rpc("price_parser_ingest", {
    p_token: token,
    p: { site, ok: true, pages: 1, items: items.size, offers, stale_days: staleDays, sources: src ? [{ id: src.id, items: items.size, error: null }] : [] },
  });
  return { items: items.size, offers, saved };
}
