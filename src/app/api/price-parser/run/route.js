// Запуск парсера цін будматеріалів на сервері: щоденний розклад Vercel (GET) і кнопка «Оновити» в CRM (POST).
// Сам обхід — tools/price-parser/core.mjs, той самий, що й у командному рядку.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeRpc, runSite } from "../../../../../tools/price-parser/core.mjs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BUDGET_MS = 270000; // лишаємо запас до межі maxDuration, щоб устигнути записати знайдене

// Розклад (pg_cron у Supabase, завдання price-parser-daily) приходить із токеном парсера в заголовку Authorization —
// чи він справжній, перевіряє сама база в rpc. Людина приходить зі своєю сесією (адмін або менеджер).
async function whoCalls(request) {
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (bearer) return { trigger: "cron", token: bearer };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Потрібно увійти" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role)) return { error: Response.json({ error: "Оновлювати ціни може адмін або менеджер" }, { status: 403 }) };
  return { trigger: "crm" };
}

async function run(request, siteParam) {
  const started = Date.now();
  const who = await whoCalls(request);
  if (who.error) return who.error;

  let token = who.token;
  if (!token) {
    try {
      const { data, error } = await createAdminClient().from("app_secrets").select("value").eq("key", "price_parser_token").maybeSingle();
      if (error) throw error;
      token = data?.value;
    } catch (e) {
      return Response.json({ error: `Немає доступу до налаштувань парсера: ${e.message}` }, { status: 500 });
    }
    if (!token) return Response.json({ error: "Парсер не налаштовано: немає токена" }, { status: 500 });
  }

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
    const denied = /42501|forbidden/.test(e.message);
    return Response.json({ error: denied ? "Немає доступу" : e.message }, { status: denied ? 403 : 500 });
  }
}

export async function GET(request) {
  return run(request, new URL(request.url).searchParams.get("site"));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return run(request, body.site);
}
