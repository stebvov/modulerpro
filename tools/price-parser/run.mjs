#!/usr/bin/env node
// Парсер цін будматеріалів → CRM (розділ «Постачальники → Ринкові ціни»). Запуск із командного рядка;
// щоденний розклад і кнопка в CRM викликають те саме ядро (core.mjs) через src/app/api/price-parser/run.
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
import { getHtml } from "./lib.mjs";
import { makeRpc, runSite } from "./core.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? true] : [a, true];
  })
);
const list = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : null);
const DRY = !!args.dry || !!args.check || !!args.probe;

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
const rpc = makeRpc(SB_URL, SB_KEY);

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

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const fmt = (v) => (v == null ? "—" : Number(v).toLocaleString("uk-UA", { maximumFractionDigits: 2 }));

// ── одна сторінка: що бачить адаптер ────────────────────────────────────────
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
const byName = typeof args.material === "string";
const materials = cfg.materials.filter((m) => m.rule && (!byName || m.name.toLowerCase().includes(args.material.toLowerCase())));
const started = Date.now();
const runId = DRY ? null : await rpc("price_parser_run_start", { p_token: TOKEN, p_trigger: process.env.GITHUB_ACTIONS ? "github" : "manual" });

console.error(`Магазинів: ${sites.length}, матеріалів із правилами: ${materials.length}${DRY ? " (без запису)" : ""}`);

const results = await Promise.all(
  sites.map((site) =>
    runSite({
      site, cfg, rpc, token: TOKEN, runId, dry: DRY, onlyGrps, materials,
      maxPages: +args["max-pages"] || 0,
      firstPageOnly: !!args.check,
      enrichLimit: args["no-enrich"] ? 0 : 80,
      partial: byName,
      log: (line) => process.stderr.write(line + "\n"),
    })
  )
);

// ── підсумок ────────────────────────────────────────────────────────────────
if (args.check) {
  for (const r of results) for (const s of r.stats) console.log(`${s.error ? "✗" : "✓"} ${r.site.padEnd(12)} ${s.grp.padEnd(11)} ${String(s.items).padStart(4)}  ${s.url}${s.error ? `  ← ${s.error}` : ""}`);
  process.exit(0);
}

const show = +args.show || 0;
if (DRY || show) {
  for (const m of materials) {
    const rows = results.map((r) => ({ site: r.site, offers: r.offers.filter((o) => o.material_id === m.id) })).filter((r) => r.offers.length);
    const line = rows.map((r) => {
      const priced = r.offers.filter((o) => o.unit_price != null && o.in_stock !== false).map((o) => o.unit_price);
      const v = priced.length ? (m.rule.agg === "median" ? median(priced) : Math.min(...priced)) : null;
      return `${r.site} ${fmt(v)} (${priced.length}/${r.offers.length})`;
    });
    console.log(`${m.name} [${m.unit}]: ${line.join(" · ") || "нічого не знайдено"}`);
    for (const r of rows)
      for (const o of r.offers.sort((a, b) => (a.unit_price ?? 1e12) - (b.unit_price ?? 1e12)).slice(0, show))
        console.log(`    ${r.site.padEnd(11)} ${fmt(o.unit_price).padStart(10)} ← ${fmt(o.price)}/${o.sale_unit || "?"}${o.in_stock === false ? " (нема)" : ""} | ${o.title} | ${JSON.stringify(o.attrs)}`);
  }
  console.log("");
}
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.site}: сторінок ${r.pages}, товарів ${r.items}, пропозицій ${r.offers.length}${r.saved ? `, записано ${r.saved.offers}, цін ${r.saved.prices}, зникло ${r.saved.gone}` : ""}${r.error ? ` — ${r.error}` : ""}`);
}
console.log(`Тривалість: ${Math.round((Date.now() - started) / 1000)} с`);
const failed = results.filter((r) => !r.ok).length;
process.exit(results.length && failed * 2 >= results.length ? 1 : 0);
