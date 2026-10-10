// Радар Telegram — спільне для серверних маршрутів /api/tg-radar/*: хто має доступ, секрети акаунта, замок.
// Розклад (pg_cron) приходить із токеном у заголовку Authorization; людина — зі своєю сесією (права перевіряє база).
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const deny = (status, error) => ({ error: Response.json({ error }, { status }) });
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

// → { trigger: "cron" | "crm", sb (службовий клієнт), who } або { error: Response }
export async function radarAccess(request, { admin = false, cronOk = false } = {}) {
  let sb;
  try { sb = createAdminClient(); } catch { return deny(500, "Сервер не налаштовано: немає службового ключа"); }
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (bearer) {
    const { data } = await sb.from("app_secrets").select("value").eq("key", "tgr_token").maybeSingle();
    if (!cronOk || !data?.value || !same(data.value, bearer)) return deny(403, "Немає доступу");
    return { trigger: "cron", sb, who: "розклад" };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return deny(401, "Потрібно увійти в систему");
  const { data: ok } = await supabase.rpc(admin ? "tgr_admin" : "tgr_can");
  if (ok !== true) return deny(403, admin ? "Це може лише засновник або адмін" : "Немає доступу до радара");
  return { trigger: "crm", sb, who: user.email };
}

export async function getSecrets(sb, keys) {
  const { data, error } = await sb.from("app_secrets").select("key,value").in("key", keys);
  if (error) throw new Error("Секрети: " + error.message);
  return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
}

// null → прибрати ключ
export async function setSecrets(sb, obj) {
  const now = new Date().toISOString();
  const put = Object.entries(obj).filter(([, v]) => v != null).map(([key, value]) => ({ key, value: String(value), updated_at: now }));
  const del = Object.entries(obj).filter(([, v]) => v == null).map(([key]) => key);
  if (put.length) { const { error } = await sb.from("app_secrets").upsert(put, { onConflict: "key" }); if (error) throw new Error("Секрети: " + error.message); }
  if (del.length) { const { error } = await sb.from("app_secrets").delete().in("key", del); if (error) throw new Error("Секрети: " + error.message); }
}

export const setAccount = (sb, patch) => sb.from("tgr_settings").update({ ...patch, acc_checked_at: new Date().toISOString() }).eq("id", true);

// З акаунтом Telegram одночасно працює лише один запит: два підключення однією сесією Telegram може її анулювати.
export async function withLock(sb, seconds, fn) {
  const { data: got, error } = await sb.rpc("tgr_lock", { p_seconds: seconds });
  if (error) throw new Error("Замок: " + error.message);
  if (got !== true) return Response.json({ error: "Радар зараз зайнятий (іде обхід груп або інша дія з акаунтом). Спробуйте за хвилину." }, { status: 409 });
  try { return await fn(); } finally { await sb.rpc("tgr_lock", { p_seconds: 0 }); }
}

export const fail = (e) => Response.json({ error: e?.message || String(e) }, { status: 500 });
