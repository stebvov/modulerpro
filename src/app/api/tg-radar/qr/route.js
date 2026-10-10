// Радар Telegram: вхід в акаунт компанії за QR-кодом — без коду з повідомлення (Telegram часто не доставляє коди
// входу для сторонніх застосунків). Відповідь іде потоком рядків JSON: { qr } — картинка коду (оновлюється кожні ~25 с),
// далі { state: "ok" | "password" | "timeout" } або { error }. Зʼєднання з Telegram тримаємо, поки людина сканує код.
import QRCode from "qrcode";
import { radarAccess, setSecrets, setAccount } from "@/lib/tgRadar/server";
import { openClient, closeClient, saveSession, loginQr, accountLabel, tgError, errCode } from "@/lib/tgRadar/telegram";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(request) {
  const who = await radarAccess(request, { admin: true });
  if (who.error) return who.error;
  const { sb } = who;
  const body = await request.json().catch(() => ({}));
  const apiId = String(body.api_id || "").trim(), apiHash = String(body.api_hash || "").trim();
  if (!/^\d{4,12}$/.test(apiId) || !/^[a-f0-9]{32}$/i.test(apiHash)) {
    return Response.json({ error: "api_id — це число, api_hash — 32 символи (0–9, a–f). Скопіюйте їх із my.telegram.org." }, { status: 400 });
  }
  const { data: got } = await sb.rpc("tgr_lock", { p_seconds: 115 });
  if (got !== true) return Response.json({ error: "Радар зараз зайнятий (іде обхід груп або інша дія з акаунтом). Спробуйте за хвилину." }, { status: 409 });

  const deadline = Date.now() + 100_000;
  const enc = new TextEncoder();
  let stop = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { stop = true; } };
      let client;
      try {
        client = await openClient({ apiId, apiHash });
        const r = await loginQr(client, { apiId, apiHash }, async (url) => send({ qr: await QRCode.toDataURL(url, { margin: 1, width: 300 }) }), deadline, () => stop);
        if (r === "timeout") { send({ state: "timeout" }); return; }
        await setSecrets(sb, { tgr_api_id: apiId, tgr_api_hash: apiHash, tgr_session: saveSession(client), tgr_phone: null, tgr_code_hash: null });
        if (r === "password") {
          await setAccount(sb, { acc_state: "password", acc_error: null, acc_label: null });
          send({ state: "password" });
          return;
        }
        const label = await accountLabel(client);
        await setAccount(sb, { acc_state: "ok", acc_error: null, acc_label: label });
        send({ state: "ok", label });
      } catch (e) {
        console.error("tg-radar qr", errCode(e) || e?.message || e);
        send({ error: tgError(e) });
      } finally {
        await closeClient(client);
        await sb.rpc("tgr_lock", { p_seconds: 0 });
        try { controller.close(); } catch { /* уже закрито */ }
      }
    },
    cancel() { stop = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
