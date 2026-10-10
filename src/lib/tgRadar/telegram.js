// Радар Telegram — робота з Telegram від імені акаунта компанії (MTProto, бібліотека GramJS).
// Лише читання публічних груп і вхід в акаунт; жодних надсилань повідомлень тут немає й не має бути.
// Пакет `telegram` зафіксовано на 2.26.22 (останній офіційний випуск GramJS; далі розробка йде у форку teleproto).
// Усе беремо з одного входу пакета: окремі підшляхи («telegram/sessions») збирач може завантажити другою копією,
// і тоді бібліотека не впізнає власну сесію.
import { TelegramClient, Api, Logger, sessions, password, helpers } from "telegram";

const { StringSession } = sessions;
const { computeCheck } = password;
const { returnBigInt } = helpers;

const ERR = {
  API_ID_INVALID: "Telegram не прийняв api_id / api_hash — перевірте, що скопіювали їх із my.telegram.org без пробілів",
  PHONE_NUMBER_INVALID: "Номер телефону не схожий на справжній — введіть у міжнародному форматі, напр. +380…",
  PHONE_NUMBER_BANNED: "Цей номер заблоковано в Telegram",
  PHONE_CODE_INVALID: "Код не підійшов — перевірте цифри",
  PHONE_CODE_EXPIRED: "Код застарів — почніть підключення заново",
  PASSWORD_HASH_INVALID: "Пароль двоетапної перевірки не підійшов",
  AUTH_KEY_UNREGISTERED: "Telegram розірвав вхід — підключіть акаунт заново",
  SESSION_REVOKED: "Сесію закрито з телефона — підключіть акаунт заново",
  USER_DEACTIVATED: "Акаунт Telegram вимкнено",
  USER_DEACTIVATED_BAN: "Акаунт Telegram заблоковано",
  USERNAME_NOT_OCCUPIED: "Такої групи немає",
  USERNAME_INVALID: "Неправильна назва групи",
  CHANNEL_PRIVATE: "Група закрита — радар читає лише публічні",
  CHANNEL_INVALID: "Група недоступна",
};
export const AUTH_LOST = new Set(["AUTH_KEY_UNREGISTERED", "SESSION_REVOKED", "USER_DEACTIVATED", "USER_DEACTIVATED_BAN", "AUTH_KEY_DUPLICATED", "SESSION_EXPIRED"]);
export const errCode = (e) => e?.errorMessage || "";
export function tgError(e) {
  const code = errCode(e);
  if (e?.seconds && /FLOOD/.test(code)) return `Telegram просить зачекати ${e.seconds} с — забагато запитів`;
  return ERR[code] || (code ? `Telegram: ${code}` : e?.message || String(e));
}

export async function openClient({ session = "", apiId, apiHash }) {
  const client = new TelegramClient(new StringSession(session || ""), Number(apiId), String(apiHash), {
    // requestRetries лишаємо типовим (5): на перший запит Telegram часто відповідає «номер живе на іншому сервері»,
    // бібліотека перепідключається туди й повторює запит — з однією спробою вхід падав («Request was unsuccessful 1 time(s)»)
    connectionRetries: 3, floodSleepThreshold: 0, baseLogger: new Logger("none"),
    deviceModel: "Moduler Radar", systemVersion: "server", appVersion: "1.0", langCode: "uk",
  });
  await client.connect();
  return client;
}
export const closeClient = async (client) => { try { await client?.destroy(); } catch { /* уже закрито */ } };
export const saveSession = (client) => client.session.save();

/* ---------- вхід в акаунт: три кроки, між ними сесія зберігається в базі ---------- */
// куди Telegram надіслав код: у застосунок (чат «Telegram»), SMS, дзвінком, на пошту…
const VIA = {
  SentCodeTypeApp: "app", SentCodeTypeSms: "sms", SentCodeTypeFirebaseSms: "sms", SentCodeTypeCall: "call", SentCodeTypeFlashCall: "call",
  SentCodeTypeMissedCall: "call", SentCodeTypeEmailCode: "email", SentCodeTypeSetUpEmailRequired: "email_setup", SentCodeTypeFragmentSms: "fragment",
  CodeTypeSms: "sms", CodeTypeCall: "call", CodeTypeFlashCall: "call", CodeTypeMissedCall: "call", CodeTypeFragmentSms: "fragment",
};
const sent = (r) => ({ codeHash: r.phoneCodeHash, via: VIA[r.type?.className] || r.type?.className || "unknown", next: VIA[r.nextType?.className] || null });

export async function loginStart(client, { apiId, apiHash, phone }) {
  const req = () => client.invoke(new Api.auth.SendCode({ phoneNumber: phone, apiId: Number(apiId), apiHash: String(apiHash), settings: new Api.CodeSettings({}) }));
  let r;
  try { r = await req(); } catch (e) { if (errCode(e) !== "AUTH_RESTART") throw e; r = await req(); }
  if (r instanceof Api.auth.SentCodeSuccess) return { done: true };
  return sent(r);
}
// надіслати код ще раз — наступним способом (напр. SMS замість повідомлення в застосунку)
export async function loginResend(client, { phone, codeHash }) {
  const r = await client.invoke(new Api.auth.ResendCode({ phoneNumber: phone, phoneCodeHash: codeHash }));
  if (r instanceof Api.auth.SentCodeSuccess) return { done: true };
  return sent(r);
}

// Вхід за QR-кодом: показуємо код, людина сканує його в застосунку (Налаштування → Пристрої → Підключити пристрій).
// Код живе ~30 с — оновлюємо, поки не відскановано або не вийшов час. → "ok" | "password" | "timeout"
export async function loginQr(client, { apiId, apiHash }, onQr, deadline, stopped = () => false) {
  let wake = null;
  client.addEventHandler((u) => { if (u?.className === "UpdateLoginToken") wake?.(); });
  try {
    while (Date.now() < deadline && !stopped()) {
      let r = await client.invoke(new Api.auth.ExportLoginToken({ apiId: Number(apiId), apiHash: String(apiHash), exceptIds: [] }));
      if (r instanceof Api.auth.LoginTokenMigrateTo) {   // акаунт живе на іншому сервері Telegram
        await client._switchDC(r.dcId);
        r = await client.invoke(new Api.auth.ImportLoginToken({ token: r.token }));
      }
      if (r instanceof Api.auth.LoginTokenSuccess) return "ok";
      await onQr("tg://login?token=" + Buffer.from(r.token).toString("base64url"));
      const waitMs = Math.max(1000, Math.min(Number(r.expires) * 1000 - Date.now() - 2000, deadline - Date.now(), 25_000));
      await new Promise((res) => { wake = res; setTimeout(res, waitMs); });
      wake = null;
    }
    return "timeout";
  } catch (e) {
    if (errCode(e) === "SESSION_PASSWORD_NEEDED") return "password";
    throw e;
  }
}
// → "ok" | "password"
export async function loginCode(client, { phone, codeHash, code }) {
  try {
    const r = await client.invoke(new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash: codeHash, phoneCode: String(code).trim() }));
    if (r instanceof Api.auth.AuthorizationSignUpRequired) throw new Error("На цьому номері ще немає акаунта Telegram — спершу зареєструйте його в застосунку на телефоні");
    return "ok";
  } catch (e) {
    if (errCode(e) === "SESSION_PASSWORD_NEEDED") return "password";
    throw e;
  }
}
export async function loginPassword(client, password) {
  const pw = await client.invoke(new Api.account.GetPassword());
  await client.invoke(new Api.auth.CheckPassword({ password: await computeCheck(pw, String(password)) }));
}
// підпис акаунта компанії для екрана налаштувань
export async function accountLabel(client) {
  const me = await client.getMe();
  const name = [me?.firstName, me?.lastName].filter(Boolean).join(" ").trim();
  const phone = me?.phone ? "+" + String(me.phone).replace(/^(\d{3})\d+(\d{3})$/, "$1•••••$2") : "";
  return [name || (me?.username ? "@" + me.username : "акаунт"), phone].filter(Boolean).join(" · ");
}
export const logout = (client) => client.invoke(new Api.auth.LogOut());

/* ---------- групи ---------- */
const chatInfo = (c) => ({
  username: String(c.username || c.usernames?.find((u) => u.active)?.username || "").toLowerCase(),
  title: c.title || "", kind: c.megagroup || c.gigagroup ? "group" : "channel",
  members: Number(c.participantsCount) || null, tg_id: c.id?.toString(), access_hash: c.accessHash?.toString(),
});
const inputChannel = (g) => new Api.InputChannel({ channelId: returnBigInt(g.tg_id), accessHash: returnBigInt(g.access_hash) });
const inputPeer = (g) => new Api.InputPeerChannel({ channelId: returnBigInt(g.tg_id), accessHash: returnBigInt(g.access_hash) });

// публічна назва → службові дані групи (Telegram суворо обмежує кількість таких запитів — тому зберігаємо результат)
export async function resolveGroup(client, username) {
  const r = await client.invoke(new Api.contacts.ResolveUsername({ username }));
  const chat = (r.chats || []).find((c) => c.className === "Channel");
  if (!chat) throw new Error("Це не група й не канал");
  const info = chatInfo(chat);
  try {
    const full = await client.invoke(new Api.channels.GetFullChannel({ channel: inputChannel(info) }));
    info.members = Number(full.fullChat?.participantsCount) || info.members;
    info.about = String(full.fullChat?.about || "").slice(0, 500) || null;
  } catch { /* без кількості учасників */ }
  return info;
}

// пошук публічних груп і каналів за словами (те саме, що рядок пошуку в Telegram)
export async function searchGroups(client, q) {
  const r = await client.invoke(new Api.contacts.Search({ q, limit: 40 }));
  return (r.chats || []).filter((c) => c.className === "Channel").map(chatInfo).filter((c) => /^[a-z0-9_]{4,40}$/.test(c.username));
}

// нові повідомлення групи після номера sinceId: лише текстові, не від ботів; найстаріші першими.
// Перший обхід (sinceId порожній) — останні firstLimit повідомлень, щоб було що показати одразу.
export async function fetchNew(client, group, sinceId, { firstLimit = 60, maxPages = 3 } = {}) {
  const out = [];
  let offsetId = 0, maxId = 0, total = 0;
  for (let page = 0; page < (sinceId ? maxPages : 1); page++) {
    const r = await client.invoke(new Api.messages.GetHistory({
      peer: inputPeer(group), offsetId, offsetDate: 0, addOffset: 0, limit: sinceId ? 100 : firstLimit, maxId: 0, minId: sinceId || 0, hash: returnBigInt(0),
    }));
    const users = new Map((r.users || []).map((u) => [u.id?.toString(), u]));
    const batch = (r.messages || []).filter((m) => m.className === "Message");
    for (const m of batch) {
      const u = m.fromId?.className === "PeerUser" ? users.get(m.fromId.userId?.toString()) : null;
      if (!m.message || u?.bot) continue;
      out.push({
        id: m.id, at: new Date(m.date * 1000).toISOString(), text: m.message,
        author_name: [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim().slice(0, 120) || null,
        author_username: u?.username || null,
      });
    }
    const all = r.messages || [];
    total += all.length;
    for (const m of all) if (m.id > maxId) maxId = m.id;
    if (all.length < (sinceId ? 100 : firstLimit)) break;
    offsetId = Math.min(...all.map((m) => m.id));
    if (!sinceId || offsetId <= sinceId + 1) break;
  }
  return { items: out.sort((a, b) => a.id - b.id), maxId: maxId || null, total };
}
