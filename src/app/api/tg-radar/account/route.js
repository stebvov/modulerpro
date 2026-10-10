// Радар Telegram: підключення Telegram-акаунта компанії, яким читаємо публічні групи.
// Кроки: start (api_id, api_hash, телефон → Telegram шле код) → code → password (якщо ввімкнено двоетапну перевірку).
// check — перевірити звʼязок, logout — вийти й стерти ключі. Ключі й сесія лежать в app_secrets і сюди не повертаються.
import { radarAccess, withLock, getSecrets, setSecrets, setAccount, fail } from "@/lib/tgRadar/server";
import { openClient, closeClient, saveSession, loginStart, loginCode, loginPassword, accountLabel, logout, tgError, errCode, AUTH_LOST } from "@/lib/tgRadar/telegram";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const KEYS = ["tgr_api_id", "tgr_api_hash", "tgr_phone", "tgr_code_hash", "tgr_session"];
const bad = (error, status = 400) => Response.json({ error }, { status });

export async function POST(request) {
  const who = await radarAccess(request, { admin: true });
  if (who.error) return who.error;
  const { sb } = who;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  try {
    return await withLock(sb, 70, async () => {
      const sec = await getSecrets(sb, KEYS);
      let client;
      const done = async (state, extra = {}) => {
        await setAccount(sb, { acc_state: state, acc_error: null, ...extra });
        return Response.json({ state, ...("acc_label" in extra ? { label: extra.acc_label } : {}) });
      };
      try {
        if (action === "start") {
          const apiId = String(body.api_id || "").trim(), apiHash = String(body.api_hash || "").trim();
          const phone = "+" + String(body.phone || "").replace(/\D/g, "");
          if (!/^\d{4,12}$/.test(apiId) || !/^[a-f0-9]{32}$/i.test(apiHash)) return bad("api_id — це число, api_hash — 32 символи (0–9, a–f). Скопіюйте їх із my.telegram.org.");
          if (phone.length < 10) return bad("Вкажіть номер телефону акаунта в міжнародному форматі: +380…");
          client = await openClient({ apiId, apiHash });
          const r = await loginStart(client, { apiId, apiHash, phone });
          await setSecrets(sb, { tgr_api_id: apiId, tgr_api_hash: apiHash, tgr_phone: phone, tgr_code_hash: r.codeHash, tgr_session: saveSession(client) });
          await done("code_sent", { acc_label: null });
          return Response.json({ state: "code_sent", via: r.viaApp ? "app" : "sms" });
        }
        if (!sec.tgr_session || !sec.tgr_api_id) return bad("Спершу почніть підключення: api_id, api_hash і номер телефону.");
        client = await openClient({ session: sec.tgr_session, apiId: sec.tgr_api_id, apiHash: sec.tgr_api_hash });

        if (action === "code") {
          if (!sec.tgr_code_hash) return bad("Код уже використано або підключення не розпочато — почніть заново.");
          const r = await loginCode(client, { phone: sec.tgr_phone, codeHash: sec.tgr_code_hash, code: body.code });
          await setSecrets(sb, { tgr_session: saveSession(client) });
          if (r === "password") return done("password");
          await setSecrets(sb, { tgr_code_hash: null });
          return done("ok", { acc_label: await accountLabel(client) });
        }
        if (action === "password") {
          await loginPassword(client, body.password);
          await setSecrets(sb, { tgr_session: saveSession(client), tgr_code_hash: null });
          return done("ok", { acc_label: await accountLabel(client) });
        }
        if (action === "check") return done("ok", { acc_label: await accountLabel(client) });
        if (action === "logout") {
          try { await logout(client); } catch { /* сесії вже немає */ }
          await setSecrets(sb, Object.fromEntries(KEYS.map((k) => [k, null])));
          await sb.from("tgr_settings").update({ enabled: false }).eq("id", true);
          return done("none", { acc_label: null });
        }
        return bad("Невідома дія");
      } catch (e) {
        const msg = tgError(e);
        console.error("tg-radar account", action, errCode(e) || e?.message || e);
        if (AUTH_LOST.has(errCode(e))) await setAccount(sb, { acc_state: "error", acc_error: msg });
        else if (action === "check") await setAccount(sb, { acc_error: msg });
        return bad(msg, errCode(e) ? 400 : 500);
      } finally {
        await closeClient(client);
      }
    });
  } catch (e) {
    return fail(e);
  }
}
