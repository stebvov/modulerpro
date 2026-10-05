// kb-sync: приймає базу знань із локального «університету знань» (ноутбук засновника) і кладе її в таблицю kb_items.
// Доступ — лише за заголовком x-kb-token: у базі лежить тільки його SHA-256 (app_secrets.kb_sync_token_sha256),
// сам токен зберігається локально. POST { action }:
//   status                        — скільки записів і в яких статусах
//   items  { items: [...] }       — додати/оновити записи (статус перевірки не чіпається)
//   prune  { ids: [...] }         — сховати записи, яких уже немає локально
//   review { rows: [...], by }    — рішення засновника, отримані поза порталом (опитування в Telegram)
//   survey { rows: [{code, resolution}] } — чим закінчились питання до засновника
//   hr_seed { payload }           — навчальні курси, уроки й тести для розділу «Люди» (rpc hr_seed)
//   hr_instr { roles: [{key, instruction}], force } — посадові інструкції (rpc hr_instr_seed; заповнену не перезаписує без force)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const token = req.headers.get("x-kb-token") ?? "";
  const { data: sec } = await sb.from("app_secrets").select("value").eq("key", "kb_sync_token_sha256").maybeSingle();
  if (token.length < 32 || !sec?.value || (await sha256(token)) !== sec.value) return json({ error: "forbidden" }, 403);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  try {
    if (b.action === "status") {
      const { data, error } = await sb.from("kb_items").select("kind,status,audience,removed,stale");
      if (error) throw error;
      const live = (data ?? []).filter((r: any) => !r.removed);
      const by = (k: string) => live.reduce((a: Record<string, number>, r: any) => ({ ...a, [r[k]]: (a[r[k]] ?? 0) + 1 }), {});
      return json({ total: live.length, removed: (data ?? []).length - live.length, kind: by("kind"), status: by("status"), audience: by("audience"), stale: live.filter((r: any) => r.stale).length });
    }
    if (b.action === "items") {
      if (!Array.isArray(b.items) || !b.items.length) return json({ error: "items порожній" }, 400);
      const { data, error } = await sb.rpc("kb_import", { p_items: b.items });
      if (error) throw error;
      return json(data);
    }
    if (b.action === "prune") {
      if (!Array.isArray(b.ids) || b.ids.length < 50) return json({ error: "ids: потрібен повний список" }, 400);
      const { data, error } = await sb.rpc("kb_prune", { p_ids: b.ids });
      if (error) throw error;
      return json({ removed: data });
    }
    if (b.action === "review") {
      const { data, error } = await sb.rpc("kb_review_apply", { p_rows: b.rows ?? [], p_by: String(b.by ?? "власник") });
      if (error) throw error;
      return json({ applied: data });
    }
    if (b.action === "survey") {
      let n = 0;
      for (const r of b.rows ?? []) {
        const { error } = await sb.from("kb_survey").update({ resolution: r.resolution ?? null }).eq("code", r.code);
        if (error) throw error;
        n++;
      }
      return json({ updated: n });
    }
    if (b.action === "hr_seed") {
      const { data, error } = await sb.rpc("hr_seed", { p: b.payload ?? {} });
      if (error) throw error;
      // позначка «лише для своїх посад» — окремо: hr_seed про неї не знає
      for (const c of b.payload?.courses ?? []) {
        if (typeof c.restricted === "boolean") await sb.from("hr_courses").update({ restricted: c.restricted }).eq("key", c.key);
      }
      return json(data);
    }
    if (b.action === "hr_instr") {
      const { data, error } = await sb.rpc("hr_instr_seed", { p: { roles: b.roles ?? [], force: b.force === true } });
      if (error) throw error;
      return json(data);
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("kb-sync", e);
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
