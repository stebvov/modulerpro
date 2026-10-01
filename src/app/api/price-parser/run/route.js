// Запуск парсера цін будматеріалів на сервері: щоденний розклад (GET, завдання pg_cron price-parser-daily)
// і кнопка «Оновити ціни» в CRM (POST). Сам обхід — tools/price-parser/core.mjs, той самий, що й у командному рядку.
import { parserAccess, parserFailure } from "@/lib/priceParserAccess";
import { makeRpc, runSite } from "../../../../../tools/price-parser/core.mjs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BUDGET_MS = 270000; // лишаємо запас до межі maxDuration, щоб устигнути записати знайдене

async function run(request, siteParam) {
  const started = Date.now();
  const who = await parserAccess(request);
  if (who.error) return who.error;
  const { token } = who;

  const rpc = makeRpc(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  try {
    const cfg = await rpc("price_parser_config", { p_token: token });
    const enabled = cfg.suppliers.filter((s) => !s.local).map((s) => s.site); // local — сайт не пускає запити із сервера
    const wanted = String(siteParam || "").split(",").map((s) => s.trim()).filter(Boolean);
    const sites = wanted.filter((s) => enabled.includes(s));
    if (!sites.length) return Response.json({ error: `Вкажи магазин: ${enabled.join(", ")}` }, { status: 400 });

    const runId = await rpc("price_parser_run_start", { p_token: token, p_trigger: who.trigger });
    const deadline = started + BUDGET_MS;
    const results = await Promise.all(sites.map((site) => runSite({ site, cfg, rpc, token, runId, deadline, enrichLimit: 40 })));
    return Response.json({
      seconds: Math.round((Date.now() - started) / 1000),
      results: results.map((r) => ({ site: r.site, ok: r.ok, error: r.error, pages: r.pages, items: r.items, offers: r.offers.length, saved: r.saved || null })),
    });
  } catch (e) {
    return parserFailure(e);
  }
}

export async function GET(request) {
  return run(request, new URL(request.url).searchParams.get("site"));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return run(request, body.site);
}
