#!/usr/bin/env node
// Парсер цін будматеріалів → CRM (розділ «Постачальники → Ринкові ціни»).
//
//   node tools/price-parser/run.mjs                 повний обхід і запис у базу
//   node tools/price-parser/run.mjs --dry           без запису: лише показати, що знайшлось
//   node tools/price-parser/run.mjs --local --dry   правила й джерела з seed.mjs, а не з бази
//   --site=kub,m2        лише ці магазини        --grp=lumber,wool   лише ці групи джерел
//   --material=вата      лише матеріали з цим словом у назві
//   --show=12            скільки пропозицій показати на матеріал (типово 0)
//   --max-pages=3        обмежити сторінки категорії
//   --check              перша сторінка кожного джерела: чи є товари
//   --probe=<url> --site=kub   розібрати одну сторінку категорії й показати товари
//
// Доступ до бази — rpc із токеном: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, PRICE_PARSER_TOKEN
// (зі змінних оточення або з .env.local у корені репо).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITES } from "./sites.mjs";
import { getHtml, text } from "./lib.mjs";
import { match, pageFacts } from "./normalize.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
const list = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : null);
const DRY = !!args.dry || !!args.check || !!args.probe;
const ENRICH_LIMIT = 80; // сторінок товарів на магазин за один запуск

// ── доступ до бази ──────────────────────────────────────────────────────────
function loadEnv() {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TOKEN = process.env.PRICE_PARSER_TOKEN;

async function rpc(name, body) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = await res.text();
  if (!res.ok) throw new Error(`rpc ${name}: ${res.status} ${out.slice(0, 300)}`);
  return out ? JSON.parse(out) : null;
}

async function loadConfig() {
  if (args.local) {
    const { MATERIALS, SOURCES, maxPages } = await import("./seed.mjs");
    return {
      suppliers: Object.keys(SOURCES).map((site) => ({ site, name: SITES[site]?.name || site })),
      sources: Object.entries(SOURCES).flatMap(([site, groups]) =>
        Object.entries(groups).flatMap(([grp, urls]) => urls.map((url) => ({ id: null, site, grp, url, max_pages: maxPages(site, grp, url) })))
      ),
      materials: MATERIALS.filter((m) => m.rule).map((m, i) => ({ id: `local-${i}`, name: m.name, unit: m.unit, rule: m.rule })),
      known: [],
    };
  }
  if (!SB_URL || !SB_KEY || !TOKEN) throw new Error("Немає NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / PRICE_PARSER_TOKEN (або запускай із --local --dry)");
  return rpc("price_parser_config", { p_token: TOKEN });
}

// ── обхід категорій одного магазину ─────────────────────────────────────────
async function crawl(site, sources, maxPages) {
  const adapter = SITES[site];
  const items = new Map(); // url → item (+ grps)
  const stats = [];
  for (const src of sources) {
    const seen = new Set();
    let pages = 0, error = null;
    try {
      const limit = Math.min(maxPages || Infinity, src.max_pages || 15);
      for (let p = 1; p <= limit; p++) {
        const url = p === 1 ? src.url : adapter.pageUrl(src.url, p);
        const { html, status } = await getHtml(url);
        if (status === 404) {
          if (p === 1) throw new Error("сторінки не існує (404)");
          break;
        }
        const { items: found, total } = adapter.listing(html, url);
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
        if (!fresh || (total && seen.size >= total) || args.check) break;
      }
      if (!seen.size) error = "жодного товару — змінилась адреса або розмітка";
    } catch (e) {
      error = e.message;
    }
    stats.push({ id: src.id, grp: src.grp, url: src.url, items: seen.size, pages, error });
    process.stderr.write(`  ${site} · ${src.grp}: ${seen.size} товарів, ${pages} стор.${error ? ` — ${error}` : ""}\n`);
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

async function matchSite(site, items, materials, known) {
  const offers = [];
  const need = []; // назва підійшла, але ціну за одиницю не вирахувати без сторінки товару
  for (const m of materials) {
    for (const it of items.values()) {
      if (!m.rule.groups?.some((g) => it.grps.has(g))) continue;
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
    if (page === undefined && fetched < ENRICH_LIMIT && !args["no-enrich"]) {
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
  if (fetched) process.stderr.write(`  ${site}: відкрито сторінок товарів — ${fetched}\n`);
  return offers;
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const fmt = (v) => (v == null ? "—" : Number(v).toLocaleString("uk-UA", { maximumFractionDigits: 2 }));

// ── режими перевірки ────────────────────────────────────────────────────────
if (args.probe) {
  const site = args.site;
  if (!SITES[site]) throw new Error(`--site=<${Object.keys(SITES).join("|")}>`);
  const { html, status } = await getHtml(args.probe);
  const { items, total } = SITES[site].listing(html, args.probe);
  console.log(`HTTP ${status}, товарів: ${items.length}${total ? ` із ${total}` : ""}`);
  for (const it of items) console.log(`${String(it.price).padStart(9)} ${it.unit || it.perUnit?.unit || it.unitHint || ""} | ${it.inStock === false ? "нема " : ""}${it.title} | ${JSON.stringify(it.props)} | ${it.url}`);
  process.exit(0);
}

const cfg = await loadConfig();
const onlySites = list(args.site);
const onlyGrps = list(args.grp);
const sites = cfg.suppliers.map((s) => s.site).filter((s) => SITES[s] && (!onlySites || onlySites.includes(s)));
const materials = cfg.materials.filter((m) => m.rule && (typeof args.material !== "string" || m.name.toLowerCase().includes(args.material.toLowerCase())));
const known = new Map((cfg.known || []).map((k) => [`${k.site}|${k.url}`, k]));
const started = new Date();
let runId = null;
if (!DRY) runId = await rpc("price_parser_run_start", { p_token: TOKEN, p_trigger: process.env.GITHUB_ACTIONS ? "github" : "manual" });

console.error(`Магазинів: ${sites.length}, матеріалів із правилами: ${materials.length}${DRY ? " (без запису)" : ""}`);

const results = await Promise.all(
  sites.map(async (site) => {
    const sources = cfg.sources.filter((s) => s.site === site && (!onlyGrps || onlyGrps.includes(s.grp)));
    try {
      const { items, stats } = await crawl(site, sources, +args["max-pages"] || 0);
      const offers = args.check ? [] : await matchSite(site, items, materials, known);
      const badGrps = new Set(stats.filter((s) => s.error).map((s) => s.grp));
      const hasGrp = new Set(stats.map((s) => s.grp));
      // матеріал «обійдено повністю», якщо всі його групи на цьому сайті відпрацювали без помилок
      const complete = onlyGrps || typeof args.material === "string" || args["max-pages"] ? [] : materials
        .filter((m) => m.rule.groups.some((g) => hasGrp.has(g)) && !m.rule.groups.some((g) => badGrps.has(g)))
        .map((m) => m.id);
      const failed = stats.filter((s) => s.error);
      const res = {
        site, stats, offers, complete,
        ok: stats.length > 0 && failed.length < stats.length,
        error: failed.length ? `джерел із помилкою: ${failed.length} з ${stats.length} (${failed.map((s) => s.grp).join(", ")})` : null,
        pages: stats.reduce((a, s) => a + s.pages, 0),
        items: items.size,
      };
      if (!DRY) {
        res.saved = await rpc("price_parser_ingest", {
          p_token: TOKEN,
          p: { run_id: runId, site, ok: res.ok, error: res.error, pages: res.pages, items: res.items, complete, sources: stats.filter((s) => s.id), offers },
        });
      }
      return res;
    } catch (e) {
      if (!DRY) await rpc("price_parser_ingest", { p_token: TOKEN, p: { run_id: runId, site, ok: false, error: e.message, offers: [], sources: [] } }).catch(() => {});
      return { site, stats: [], offers: [], ok: false, error: e.message, pages: 0, items: 0 };
    }
  })
);

// ── підсумок ────────────────────────────────────────────────────────────────
if (args.check) {
  for (const r of results) for (const s of r.stats) console.log(`${s.error ? "✗" : "✓"} ${r.site.padEnd(12)} ${s.grp.padEnd(11)} ${String(s.items).padStart(4)}  ${s.url}${s.error ? `  ← ${s.error}` : ""}`);
  process.exit(0);
}

const show = +args.show || 0;
for (const m of materials) {
  const rows = results.map((r) => ({ site: r.site, offers: r.offers.filter((o) => o.material_id === m.id) })).filter((r) => r.offers.length);
  const line = rows.map((r) => {
    const priced = r.offers.filter((o) => o.unit_price != null && o.in_stock !== false).map((o) => o.unit_price);
    const v = priced.length ? (m.rule.agg === "median" ? median(priced) : Math.min(...priced)) : null;
    return `${r.site} ${fmt(v)} (${priced.length}/${r.offers.length})`;
  });
  console.log(`${m.name} [${m.unit}]: ${line.join(" · ") || "нічого не знайдено"}`);
  if (show) {
    for (const r of rows)
      for (const o of r.offers.sort((a, b) => (a.unit_price ?? 1e12) - (b.unit_price ?? 1e12)).slice(0, show))
        console.log(`    ${r.site.padEnd(11)} ${fmt(o.unit_price).padStart(10)} ← ${fmt(o.price)}/${o.sale_unit || "?"}${o.in_stock === false ? " (нема)" : ""} | ${o.title} | ${JSON.stringify(o.attrs)}`);
  }
}
console.log("");
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.site}: сторінок ${r.pages}, товарів ${r.items}, пропозицій ${r.offers.length}${r.saved ? `, записано ${r.saved.offers}, цін ${r.saved.prices}, зникло ${r.saved.gone}` : ""}${r.error ? ` — ${r.error}` : ""}`);
}
console.log(`Тривалість: ${Math.round((Date.now() - started) / 1000)} с`);
const failed = results.filter((r) => !r.ok).length;
process.exit(results.length && failed * 2 >= results.length ? 1 : 0);
