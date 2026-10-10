// Радар Telegram: «перевірити на прикладі» — як радар оцінить повідомлення за поточними словами й описом.
// Нічого не зберігає; до Telegram не звертається. Витрати на ШІ рахуються в ту саму денну стелю.
import { radarAccess, getSecrets, fail } from "@/lib/tgRadar/server";
import { matchKeywords, classify, aiError } from "@/lib/tgRadar/classify";
import { spentToday, trackAi } from "@/lib/tgRadar/run";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request) {
  const who = await radarAccess(request, { cronOk: true });
  if (who.error) return who.error;
  const { sb } = who;
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim().slice(0, 2500);
  if (text.length < 12) return Response.json({ error: "Вставте текст повідомлення — хоча б одне речення" }, { status: 400 });
  try {
    const { data: s } = await sb.from("tgr_settings").select("keywords,stop_words,brief,model,daily_usd,min_score").maybeSingle();
    const matched = matchKeywords(text, s?.keywords, s?.stop_words);
    const sec = await getSecrets(sb, ["anthropic_api_key", "ai_alert"]);
    if (!sec.anthropic_api_key || sec.ai_alert === "empty") return Response.json({ matched, error: "ШІ недоступний: немає ключа або вичерпано баланс" }, { status: 400 });
    if ((await spentToday(sb)) >= Number(s?.daily_usd ?? 1)) return Response.json({ matched, error: "Денну стелю витрат на ШІ вичерпано" }, { status: 400 });
    try {
      const r = await classify([{ text, group: "приклад" }], { brief: s?.brief || "", model: s?.model, apiKey: sec.anthropic_api_key });
      await trackAi(sb, r.model, r.cost);
      const x = r.results[0];
      if (!x) return Response.json({ matched, error: r.refused ? "ШІ відмовився оцінювати цей текст" : "ШІ не дав оцінки" }, { status: 502 });
      return Response.json({ matched, score: x.score, intent: x.intent, summary: x.summary, reply: x.reply, notify: x.score >= (s?.min_score ?? 6), cost: Math.round(r.cost * 1e4) / 1e4 });
    } catch (e) {
      return Response.json({ matched, error: aiError(e) }, { status: 502 });
    }
  } catch (e) {
    return fail(e);
  }
}
