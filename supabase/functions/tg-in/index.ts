// Вхідний вебхук Telegram (tg-in): опитування засновника для бази знань (таблиця kb_survey) обробляє сам,
// особисті повідомлення без команди й кнопки coo:… спершу пропонує Асистенту (функція coo),
// усі інші оновлення без змін передає функції tg-bot. Відкат: ?action=hook&to=bot (вебхук знову дивиться на tg-bot).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const BASE = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(BASE, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BOT = `${BASE}/functions/v1/tg-bot`;
const SELF = `${BASE}/functions/v1/tg-in`;
const COO = `${BASE}/functions/v1/coo`;

let secretsCache: Record<string, string> | null = null;
async function secrets(): Promise<Record<string, string>> {
  if (secretsCache?.tg_bot_token) return secretsCache;
  const { data } = await sb.from("app_secrets").select("key,value");
  secretsCache = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
  return secretsCache!;
}
async function tg(method: string, body: Record<string, unknown>) {
  const token = (await secrets()).tg_bot_token;
  if (!token) throw new Error("tg_bot_token не задано");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return await r.json();
}
const esc = (s: string) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const send = (chat_id: number, text: string, reply_to?: number) =>
  tg("sendMessage", {
    chat_id, text, parse_mode: "HTML", disable_web_page_preview: true,
    ...(reply_to ? { reply_parameters: { message_id: reply_to, allow_sending_without_reply: true } } : {}),
  });

let ownerCache: { id: number | null; at: number } | null = null;
async function ownerTg(): Promise<number | null> {
  if (ownerCache && Date.now() - ownerCache.at < 300e3) return ownerCache.id;
  const { data } = await sb.from("task_members").select("tg_user_id").eq("is_owner", true).eq("active", true).not("tg_user_id", "is", null).limit(1);
  const id = data?.[0]?.tg_user_id ? Number(data[0].tg_user_id) : null;
  ownerCache = { id, at: Date.now() };
  return id;
}

/* ---------- опитування ---------- */
const DUMKA = /^(?:💡|думка(?=[\s:,.\-—]|$))/iu; // приватні думки засновника лишаються за tg-bot
const SV_STOP = /^(стоп|stop|пауза|досить)[.!]*$/iu;
const SV_NEXT = /^(далі|дальше|продовж\S*|опитування|наступне)[.!]*$/iu;
const SV_SKIP = /^(пропустити|пропуск|skip|не знаю)[.!]*$/iu;

async function svCounts() {
  const { data } = await sb.from("kb_survey").select("status");
  const all = data ?? [];
  return { total: all.length, done: all.filter((r: any) => r.status === "answered" || r.status === "skipped").length };
}
async function svAsk(chatId: number): Promise<string> {
  await sb.from("kb_survey").update({ status: "pending" }).eq("status", "asked");
  const { data: q } = await sb.from("kb_survey").select("*").eq("status", "pending").order("sort").limit(1).maybeSingle();
  const c = await svCounts();
  if (!q) { await send(chatId, `✅ Питання закінчились: ${c.done} з ${c.total}. Дякую! Відповіді перенесу в базу знань.`); return "done"; }
  const opts: string[] = Array.isArray(q.options) ? q.options : [];
  const kb = [
    ...opts.map((o, i) => [{ text: String(o).slice(0, 60), callback_data: `sv:${q.id}:o${i}` }]),
    [...(q.assumption ? [{ text: "✅ Припущення вірне", callback_data: `sv:${q.id}:ok` }] : []),
      { text: "⏭ Пропустити", callback_data: `sv:${q.id}:skip` }, { text: "⏹ Стоп", callback_data: `sv:${q.id}:stop` }],
  ];
  const text = `❓ <b>${esc(q.code)}</b> · ${c.done + 1} з ${c.total} ${esc(q.prio ?? "")}\n<b>${esc(q.title)}</b>\n\n${esc(q.question)}` +
    `${q.assumption ? `\n\n<i>Моє припущення: ${esc(q.assumption)}</i>` : ""}\n\nВідповідь — одним повідомленням або кнопкою. «стоп» — зупинитись.`;
  const r = await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: kb } });
  await sb.from("kb_survey").update({ status: "asked", asked_at: new Date().toISOString(), bot_message_id: r?.result?.message_id ?? null }).eq("id", q.id);
  return q.code;
}
async function svStop(chatId: number) {
  await sb.from("kb_survey").update({ status: "pending" }).eq("status", "asked");
  const c = await svCounts();
  return send(chatId, `⏸ Зупинив опитування. Відповідей: ${c.done} з ${c.total}. Продовжити — напишіть «далі».`);
}
async function svSave(id: number, answer: string, status: "answered" | "skipped", append = false) {
  if (append) {
    const { data: old } = await sb.from("kb_survey").select("answer").eq("id", id).maybeSingle();
    answer = [old?.answer, answer].filter(Boolean).join("\n");
  }
  await sb.from("kb_survey").update({ status, answer: answer || null, answered_at: new Date().toISOString() }).eq("id", id);
}
// true — повідомлення оброблено як частину опитування
async function handleSurvey(msg: any, text: string): Promise<boolean> {
  const chatId = msg.chat.id;
  const t = text.trim();
  const { data: cur } = await sb.from("kb_survey").select("*").eq("status", "asked").order("sort").limit(1).maybeSingle();
  const rep = msg.reply_to_message?.message_id;
  if (rep && t) {
    const { data: rq } = await sb.from("kb_survey").select("id,code").eq("bot_message_id", rep).maybeSingle();
    if (rq && (!cur || rq.id !== cur.id)) {
      await svSave(rq.id, t, "answered", true);
      await send(chatId, `✍️ Доповнив відповідь на ${esc(rq.code)}.`, msg.message_id);
      return true;
    }
  }
  if (!cur) {
    if (SV_NEXT.test(t)) { await svAsk(chatId); return true; }
    return false;
  }
  if (SV_STOP.test(t)) { await svStop(chatId); return true; }
  if (!t) { await send(chatId, "Поки читаю лише текст — напишіть відповідь словами або натисніть кнопку під питанням.", msg.message_id); return true; }
  if (SV_SKIP.test(t) || SV_NEXT.test(t)) await svSave(cur.id, "", "skipped");
  else await svSave(cur.id, t, "answered");
  await svAsk(chatId);
  return true;
}
async function handleSurveyCallback(cb: any) {
  const sv = String(cb.data ?? "").match(/^sv:(\d+):(ok|skip|stop|o(\d+))$/);
  if (!sv) return tg("answerCallbackQuery", { callback_query_id: cb.id });
  const chatId = cb.message?.chat?.id;
  const { data: q } = await sb.from("kb_survey").select("*").eq("id", Number(sv[1])).maybeSingle();
  if (!q) return tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Питання не знайдено" });
  if (sv[2] === "stop") { await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Зупинив" }); return svStop(chatId); }
  if (q.status !== "asked") return tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Це питання вже закрите. Щоб доповнити — відповідайте на нього реплаєм.", show_alert: true });
  let mark = "⏭ пропущено";
  if (sv[2] === "skip") await svSave(q.id, "", "skipped");
  else if (sv[2] === "ok") { await svSave(q.id, "Так, припущення вірне.", "answered"); mark = "✅ припущення вірне"; }
  else { const o = String((Array.isArray(q.options) ? q.options : [])[Number(sv[3])] ?? ""); await svSave(q.id, o, "answered"); mark = "✅ " + o; }
  await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message?.message_id, reply_markup: { inline_keyboard: [] } });
  await tg("answerCallbackQuery", { callback_query_id: cb.id, text: mark.slice(0, 180) });
  await send(chatId, `${esc(q.code)}: ${esc(mark)}`);
  return svAsk(chatId);
}

/* ---------- поповнення бази знань: «/kb текст» або «База: текст» ---------- */
const KB = /^(?:📚|база\s*:)\s*/iu;
const INTRO = "📚 <b>Опитування для бази знань Модулер</b>\nПитання приходять по одному. Відповідайте текстом або кнопкою під питанням.\n«стоп» — пауза, «далі» — продовжити, «пропустити» — наступне.\nЩоб доповнити вже закрите питання — відповідайте на нього реплаєм.\nДодати щось у базу будь-коли: <code>/kb текст або посилання</code> чи «База: …».";
async function kbSave(msg: any, said: string) {
  const chatId = msg.chat.id;
  if (!said) return send(chatId, "Напишіть одним повідомленням: <code>/kb що додати в базу знань</code> або «База: …». Посилання на статтю чи відео теж можна.", msg.message_id);
  const { data, error } = await sb.from("kb_inbox").insert({ said, tg_message_id: msg.message_id }).select("id").single();
  if (error) return send(chatId, "Не вдалося записати: " + esc(error.message), msg.message_id);
  return send(chatId, `📚 Записав у базу знань: <b>k-${String(data.id).padStart(4, "0")}</b>. Оброблю в університеті знань під час наступної сесії.`, msg.message_id);
}

// Асистент відповідає швидко «моє / не моє», а працює у фоні; не взяв або впав — оновлення йде далі в tg-bot
async function toCoo(raw: string, key: string): Promise<boolean> {
  try {
    const r = await fetch(`${COO}?action=tg&key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
    return r.ok && Boolean((await r.json())?.handled);
  } catch (e) { console.error("tg-in coo", e); return false; }
}

async function forward(raw: string, secret: string): Promise<Response> {
  try {
    const r = await fetch(BOT, { method: "POST", headers: { "Content-Type": "application/json", "x-telegram-bot-api-secret-token": secret }, body: raw });
    await r.text();
  } catch (e) { console.error("tg-in forward", e); }
  return new Response("ok"); // Telegram не повинен ретраїти безкінечно
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const s = await secrets();
  if (action) {
    if (!s.cron_secret || url.searchParams.get("key") !== s.cron_secret) return new Response("forbidden", { status: 403 });
    try {
      if (action === "status") return Response.json({ ok: true, router: 2, counts: await svCounts() });
      if (action === "survey") {
        const o = await ownerTg();
        if (o && url.searchParams.get("intro") === "1") await send(o, INTRO);
        return Response.json({ asked: o ? await svAsk(o) : null });
      }
      if (action === "survey_stop") { const o = await ownerTg(); if (o) await svStop(o); return Response.json({ ok: true }); }
      if (action === "hook") {
        const to = url.searchParams.get("to") === "bot" ? BOT : SELF;
        const r = await tg("setWebhook", { url: to, secret_token: s.tg_webhook_secret, allowed_updates: ["message", "edited_message", "my_chat_member", "callback_query"] });
        return Response.json({ to, result: r });
      }
      return new Response("unknown action", { status: 400 });
    } catch (e) { console.error("tg-in action", e); return Response.json({ ok: false, error: String(e) }, { status: 500 }); }
  }
  const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!s.tg_webhook_secret || secret !== s.tg_webhook_secret) return new Response("forbidden", { status: 403 });
  const raw = await req.text();
  try {
    const u = JSON.parse(raw);
    const cb = u.callback_query;
    if (cb && String(cb.data ?? "").startsWith("sv:")) {
      const owner = await ownerTg();
      if (owner && cb.from?.id === owner) await handleSurveyCallback(cb);
      else await tg("answerCallbackQuery", { callback_query_id: cb.id });
      return new Response("ok");
    }
    if (cb && String(cb.data ?? "").startsWith("coo:")) { await toCoo(raw, s.cron_secret); return new Response("ok"); }
    const msg = u.message;
    if (msg && msg.chat?.type === "private") {
      const owner = await ownerTg();
      const text: string = msg.text ?? msg.caption ?? "";
      if (owner && msg.from?.id === owner) {
        const kbCmd = text.match(/^\/kb(?:@\S+)?(?:\s+|$)/i);
        if (kbCmd) { await kbSave(msg, text.slice(kbCmd[0].length).trim()); return new Response("ok"); }
        if (KB.test(text.trim())) { await kbSave(msg, text.trim().replace(KB, "").trim()); return new Response("ok"); }
        if (!text.startsWith("/") && !DUMKA.test(text.trim()) && await handleSurvey(msg, text)) return new Response("ok");
      }
      if (text.trim() && !text.startsWith("/") && !DUMKA.test(text.trim()) && await toCoo(raw, s.cron_secret)) return new Response("ok");
    }
  } catch (e) { console.error("tg-in", e); }
  return forward(raw, secret);
});
