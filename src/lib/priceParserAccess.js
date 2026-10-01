// Хто може запускати парсер цін на сервері й звідки взяти його токен.
// Розклад (pg_cron у Supabase) приходить із токеном парсера в заголовку Authorization — чи він справжній, перевіряє
// сама база в rpc. Людина приходить зі своєю сесією CRM (адмін або менеджер), токен для неї дістаємо службовим ключем.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// → { trigger: "cron" | "crm", token } або { error: Response }
export async function parserAccess(request) {
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (bearer) return { trigger: "cron", token: bearer };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Потрібно увійти в систему" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role)) {
    return { error: Response.json({ error: "Оновлювати ціни може адмін або менеджер" }, { status: 403 }) };
  }
  try {
    const { data, error } = await createAdminClient().from("app_secrets").select("value").eq("key", "price_parser_token").maybeSingle();
    if (error) throw error;
    if (!data?.value) return { error: Response.json({ error: "Парсер не налаштовано: немає токена" }, { status: 500 }) };
    return { trigger: "crm", token: data.value };
  } catch (e) {
    return { error: Response.json({ error: `Немає доступу до налаштувань парсера: ${e.message}` }, { status: 500 }) };
  }
}

// помилка rpc → відповідь: чужий токен — 403, решта — 500
export function parserFailure(e) {
  const denied = /42501|forbidden/.test(e.message);
  return Response.json({ error: denied ? "Немає доступу" : e.message }, { status: denied ? 403 : 500 });
}
