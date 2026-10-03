// Заявка з квізу: відповіді + контакти + відвідувач → quiz_submit (лід, угода у воронці квізу, Telegram, запис відповідей).
// Як і для форми сайту, гео/IP додає лише сервер (ключ service_role), щоб база знала, що вони справжні.
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLeadMeta } from "@/lib/site/leadMeta";
import { createClient as createServerClient } from "@/lib/supabase/server";

const dec = (v) => { if (!v) return ""; try { return decodeURIComponent(v); } catch { return v; } };
const s = (v, n) => (v == null ? undefined : String(v).slice(0, n));

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
    lat: h.get("x-vercel-ip-latitude") || "", lon: h.get("x-vercel-ip-longitude") || "",
    tz: h.get("x-vercel-ip-timezone") || "", postal: h.get("x-vercel-ip-postal-code") || "",
    ua: h.get("user-agent") || "", al: h.get("accept-language") || "", at: new Date().toISOString(),
  };

  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 60).map((a) => ({ q: s(a?.q, 200) || "", a: s(a?.a, 500) || "" })) : [];
  const p = { slug: s(body.slug, 60), sid: s(body.sid, 64), name: s(body.name, 120), phone: s(body.phone, 40), company: s(body.company, 100), contact_via: s(body.contact_via, 40), utm: s(body.utm, 300), answers,
    fbp: s(body.fbp, 120), fbc: s(body.fbc, 300), event_id: s(body.event_id, 64), url: s(body.url, 500) };
  // «тест» — лише якщо людина справді увійшла в систему (сесія в cookies)
  if (body.test) {
    try { const { data } = await (await createServerClient()).auth.getUser(); if (data?.user) p.test = true; } catch { /* не тест */ }
  }
  try { p.meta = buildLeadMeta(body.meta && typeof body.meta === "object" ? body.meta : {}, srv); } catch (e) { console.error("quiz lead meta", e); }

  let sb;
  try { sb = createAdminClient(); } catch {
    sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  }
  const { data, error } = await sb.rpc("quiz_submit", { p });
  if (error) {
    console.error("quiz_submit", error);
    return Response.json({ ok: false, error: "Не вдалося надіслати. Спробуйте ще раз." }, { status: 500 });
  }
  return Response.json(data || { ok: false });
}
