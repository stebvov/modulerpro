// Оновлення ринкових розцінок на роботи (rabotniki.ua). Раз на тиждень його кілька разів поспіль викликає розклад
// (pg_cron work-rates-weekly): кожен виклик бере міста, які найдовше не оновлювались, скільки встигне за відведений час.
// Сам обхід — tools/work-rates/core.mjs, той самий, що й у командному рядку.
import { parserAccess, parserFailure } from "@/lib/priceParserAccess";
import { makeRpc } from "../../../../../tools/price-parser/core.mjs";
import { crawlCity } from "../../../../../tools/work-rates/core.mjs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BUDGET_MS = 260000;
const CITY_MS = 60000; // запас на одне місто
const FRESH_MS = 3 * 86400000; // оновлене за останні три дні вдруге не чіпаємо

async function run(request, cityParam) {
  const started = Date.now();
  const who = await parserAccess(request);
  if (who.error) return who.error;
  const { token } = who;

  const rpc = makeRpc(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  try {
    const cfg = await rpc("work_rates_config", { p_token: token });
    const wanted = typeof cityParam === "string" && cityParam ? cityParam.split(",").map((s) => (s.trim() === "ukraine" ? "" : s.trim())) : null;
    const queue = wanted
      ? cfg.cities.filter((c) => wanted.includes(c.slug))
      : cfg.cities.filter((c) => !c.checked_at || started - new Date(c.checked_at).getTime() > FRESH_MS);

    const results = [];
    for (const city of queue) {
      if (Date.now() - started > BUDGET_MS - CITY_MS) break;
      const { rows, failed } = await crawlCity(city.slug, cfg.categories, { deadline: started + BUDGET_MS });
      const saved = await rpc("work_rates_ingest", { p_token: token, p: { city: city.slug, complete: !failed.length, rows } });
      results.push({ city: city.name, rows: saved.rows, failed });
    }
    return Response.json({ seconds: Math.round((Date.now() - started) / 1000), left: queue.length - results.length, results });
  } catch (e) {
    return parserFailure(e);
  }
}

export async function GET(request) {
  return run(request, new URL(request.url).searchParams.get("city"));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return run(request, body.city);
}
