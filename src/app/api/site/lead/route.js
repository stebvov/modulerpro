// Заявка з форми сайту: дані форми + відвідувач (з браузера) + країна/місто/IP/пристрій (з заголовків Vercel) → site_submit_lead.
// Ключ service_role лише тут, на сервері: так база знає, що гео справжнє (у запасному шляху з браузера його немає).
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLeadMeta } from "@/lib/site/leadMeta";

const FIELDS = ["name", "phone", "company", "contact_via", "goal", "area", "message", "model", "calc", "page", "utm", "region", "budget", "pipeline"];

function dec(v) {
  if (!v) return "";
  try { return decodeURIComponent(v); } catch { return v; }
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: "Некоректний запит" }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ ok: false, error: "Некоректний запит" }, { status: 400 });

  const h = request.headers;
  const srv = {
    ip: (h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0] || "").trim().slice(0, 64),
    cc: (h.get("x-vercel-ip-country") || "").toUpperCase().slice(0, 2),
    region: dec(h.get("x-vercel-ip-country-region")).slice(0, 10),
    city: dec(h.get("x-vercel-ip-city")),
    lat: h.get("x-vercel-ip-latitude") || "",
    lon: h.get("x-vercel-ip-longitude") || "",
    tz: h.get("x-vercel-ip-timezone") || "",
    postal: h.get("x-vercel-ip-postal-code") || "",
    ua: h.get("user-agent") || "",
    al: h.get("accept-language") || "",
    at: new Date().toISOString(),
  };

  const p = {};
  for (const k of FIELDS) if (body[k] != null) p[k] = String(body[k]).slice(0, 3000);
  let meta = null;
  try { meta = buildLeadMeta(body.meta && typeof body.meta === "object" ? body.meta : {}, srv); } catch (e) { console.error("site lead meta", e); }
  if (meta) p.meta = meta;

  let sb;
  try { sb = createAdminClient(); } catch {
    // без ключа сервісу — як раніше, анонімно (гео тоді база відкине як неперевірене)
    sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  }
  const { data, error } = await sb.rpc("site_submit_lead", { p });
  if (error) {
    console.error("site_submit_lead", error);
    return Response.json({ ok: false, error: "Не вдалося надіслати. Зателефонуйте нам, будь ласка." }, { status: 500 });
  }
  return Response.json(data || { ok: false });
}
