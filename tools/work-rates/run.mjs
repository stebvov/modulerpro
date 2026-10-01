#!/usr/bin/env node
// Ринкові розцінки на роботи з rabotniki.ua → CRM (Виробництво → Розцінки на роботи).
//
//   node tools/work-rates/run.mjs                 усі міста зі списку (work_cities), ~17 хв
//   node tools/work-rates/run.mjs --city=kiev,lvov лише ці міста («ukraine» — загалом по Україні)
//   node tools/work-rates/run.mjs --dry --city=kiev   нічого не пише, показує знайдене
//
// Категорії робіт і міста — у базі (work_categories, work_cities). Доступ — той самий токен, що й у парсера цін.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRpc } from "../price-parser/core.mjs";
import { crawlCity } from "./core.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));

const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const TOKEN = process.env.PRICE_PARSER_TOKEN;
const rpc = makeRpc(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const cfg = await rpc("work_rates_config", { p_token: TOKEN });
const only = typeof args.city === "string" ? args.city.split(",").map((s) => (s.trim() === "ukraine" ? "" : s.trim())) : null;
const cities = cfg.cities.filter((c) => !only || only.includes(c.slug));
console.error(`Категорій: ${cfg.categories.length}, міст: ${cities.length}${args.dry ? " (без запису)" : ""}`);

const started = Date.now();
for (const city of cities) {
  const { rows, failed } = await crawlCity(city.slug, cfg.categories, { log: (l) => console.error(l) });
  let saved = null;
  if (!args.dry) saved = await rpc("work_rates_ingest", { p_token: TOKEN, p: { city: city.slug, complete: !failed.length, rows } });
  console.log(`${failed.length ? "✗" : "✓"} ${city.name}: робіт ${rows.length}${saved ? `, записано ${saved.rows}` : ""}${failed.length ? ` — не вдалось: ${failed.join(", ")}` : ""}`);
  if (args.dry) for (const r of rows.slice(0, +args.show || 5)) console.log(`    ${r.name} | ${r.min}–${r.max}, середня ${r.avg} грн/${r.unit} | пропозицій ${r.offers}`);
}
console.log(`Тривалість: ${Math.round((Date.now() - started) / 1000)} с`);
