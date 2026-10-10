// Радар Telegram — один обхід: групи → нові повідомлення → ключові слова → ШІ → знахідки → сповіщення.
// Тексту повідомлень у базу не пишемо: зберігається посилання, автор, оцінка й короткий зміст.
import { getSecrets, setAccount } from "./server";
import { openClient, closeClient, resolveGroup, fetchNew, tgError, errCode, AUTH_LOST } from "./telegram";
import { matchKeywords, classify, aiError } from "./classify";

const SAVE_FROM = 4;      // знахідки з оцінкою нижче не зберігаємо
const PER_GROUP = 30;     // не більше стільки повідомлень однієї групи на оцінку за обхід
const BATCH = 15;         // повідомлень в одному запиті до ШІ

const kyivDayStart = () => {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());
  const off = new Intl.DateTimeFormat("en", { timeZone: "Europe/Kyiv", timeZoneName: "longOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+02:00";
  return new Date(`${d}T00:00:00${off}`).toISOString();
};

export async function spentToday(sb) {
  const { data } = await sb.from("ai_usage").select("cost_usd").eq("purpose", "tg_radar").gte("at", kyivDayStart());
  return (data || []).reduce((a, r) => a + Number(r.cost_usd || 0), 0);
}
export const trackAi = (sb, model, cost) => sb.from("ai_usage").insert({ purpose: "tg_radar", model, input_tokens: 0, output_tokens: 0, cost_usd: cost });

// оцінка пачками; повертає [{ ...msg, score, intent, summary, reply }]
async function rate(sb, cands, group, cfg, stats) {
  const out = [];
  for (let i = 0; i < cands.length; i += BATCH) {
    const part = cands.slice(i, i + BATCH);
    const r = await classify(part.map((m) => ({ text: m.text, group: group.title || group.username })), cfg);
    stats.cost += r.cost;
    await trackAi(sb, r.model, r.cost);
    for (const x of r.results) out.push({ ...part[x.i], ...x });
  }
  return out;
}

export async function runRadar({ sb, trigger, deadline }) {
  const { data: s } = await sb.from("tgr_settings").select("*").maybeSingle();
  if (!s) return { skipped: "Радар не налаштовано" };
  if (trigger === "cron" && !s.enabled) return { skipped: "Радар вимкнено" };
  if (s.acc_state !== "ok") return { skipped: "Telegram-акаунт не підключено" };
  const sec = await getSecrets(sb, ["tgr_api_id", "tgr_api_hash", "tgr_session", "anthropic_api_key", "ai_alert"]);
  if (!sec.tgr_session || !sec.tgr_api_id) return { skipped: "Telegram-акаунт не підключено" };
  if (!sec.anthropic_api_key || sec.ai_alert === "empty") return { skipped: "ШІ недоступний: немає ключа або вичерпано баланс" };
  if ((await spentToday(sb)) >= Number(s.daily_usd)) return { skipped: `Денну стелю витрат на ШІ ($${s.daily_usd}) вичерпано — продовжимо завтра` };

  const { data: groups } = await sb.from("tgr_groups").select("*").eq("active", true).order("last_checked_at", { ascending: true, nullsFirst: true }).limit(80);
  if (!groups?.length) return { skipped: "Немає груп для обходу" };

  const stats = { groups: 0, messages: 0, candidates: 0, hits: 0, cost: 0, notified: 0, errors: [] };
  const { data: run } = await sb.from("tgr_runs").insert({ trigger }).select("id").single();
  const cfg = { brief: s.brief, model: s.model, apiKey: sec.anthropic_api_key };
  let client, fatal = null;
  try {
    client = await openClient({ session: sec.tgr_session, apiId: sec.tgr_api_id, apiHash: sec.tgr_api_hash });
    for (const g of groups) {
      if (Date.now() > deadline) break;
      try {
        if (!g.tg_id || !g.access_hash) {
          const info = await resolveGroup(client, g.username);
          Object.assign(g, { tg_id: info.tg_id, access_hash: info.access_hash, title: info.title || g.title, kind: info.kind });
          await sb.from("tgr_groups").update({ tg_id: info.tg_id, access_hash: info.access_hash, title: g.title, kind: info.kind, members: info.members ?? g.members, about: info.about ?? g.about }).eq("id", g.id);
        }
        const { items, maxId, total } = await fetchNew(client, g, g.last_msg_id);
        stats.groups++; stats.messages += total;
        const cands = items.map((m) => ({ ...m, matched: matchKeywords(m.text, s.keywords, s.stop_words) })).filter((m) => m.matched).slice(-PER_GROUP);
        stats.candidates += cands.length;
        let saved = 0;
        if (cands.length) {
          const rated = (await rate(sb, cands, g, cfg, stats)).filter((m) => m.score >= SAVE_FROM);
          if (rated.length) {
            const rows = rated.map((m) => ({
              group_id: g.id, msg_id: m.id, msg_at: m.at, author_name: m.author_name, author_username: m.author_username,
              matched: m.matched, score: m.score, intent: m.intent, summary: m.summary, reply_draft: m.reply || null,
            }));
            const { data: ins, error } = await sb.from("tgr_hits").upsert(rows, { onConflict: "group_id,msg_id", ignoreDuplicates: true }).select("id,score");
            if (error) throw new Error("Запис знахідок: " + error.message);
            saved = ins?.length || 0;
            for (const h of ins || []) if (h.score >= s.min_score) { await sb.rpc("tgr_notify", { p_hit: h.id }); stats.notified++; }
          }
        }
        stats.hits += saved;
        await sb.rpc("tgr_group_tick", { p_group: g.id, p_last: maxId, p_seen: total, p_hits: saved, p_error: null });
      } catch (e) {
        const code = errCode(e);
        if (AUTH_LOST.has(code) || /FLOOD/.test(code)) throw e;   // справа в акаунті, а не в групі — зупиняємо обхід
        const msg = code ? tgError(e) : aiError(e);
        stats.errors.push(`@${g.username}: ${msg}`);
        await sb.rpc("tgr_group_tick", { p_group: g.id, p_last: null, p_seen: 0, p_hits: 0, p_error: msg.slice(0, 300) });
        if (!code && /ШІ|Ключ|Баланс/.test(msg)) { fatal = msg; break; }   // ШІ недоступний — далі немає сенсу
      }
    }
  } catch (e) {
    fatal = tgError(e);
    if (AUTH_LOST.has(errCode(e))) await setAccount(sb, { acc_state: "error", acc_error: fatal });
  } finally {
    await closeClient(client);
  }
  if (run?.id) {
    await sb.from("tgr_runs").update({
      finished_at: new Date().toISOString(), groups: stats.groups, messages: stats.messages, candidates: stats.candidates, hits: stats.hits,
      cost_usd: stats.cost, error: [fatal, ...stats.errors].filter(Boolean).join(" | ").slice(0, 1000) || null,
    }).eq("id", run.id);
  }
  return { ...stats, cost: Math.round(stats.cost * 1e4) / 1e4, error: fatal };
}
