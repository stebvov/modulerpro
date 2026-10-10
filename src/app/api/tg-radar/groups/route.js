// Радар Telegram: пошук публічних груп за словами (як рядок пошуку в Telegram) — щоб додати їх у радар.
import { radarAccess, withLock, getSecrets, setAccount, fail } from "@/lib/tgRadar/server";
import { openClient, closeClient, searchGroups, tgError, errCode, AUTH_LOST } from "@/lib/tgRadar/telegram";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request) {
  const who = await radarAccess(request);
  if (who.error) return who.error;
  const { sb } = who;
  const body = await request.json().catch(() => ({}));
  const q = String(body.q || "").trim().slice(0, 80);
  if (q.length < 3) return Response.json({ error: "Введіть слово чи фразу — щонайменше 3 літери" }, { status: 400 });
  try {
    return await withLock(sb, 60, async () => {
      const sec = await getSecrets(sb, ["tgr_api_id", "tgr_api_hash", "tgr_session"]);
      const { data: s } = await sb.from("tgr_settings").select("acc_state").maybeSingle();
      if (s?.acc_state !== "ok" || !sec.tgr_session) return Response.json({ error: "Пошук працює після підключення Telegram-акаунта (шестерня → «Telegram-акаунт»)." }, { status: 400 });
      let client;
      try {
        client = await openClient({ session: sec.tgr_session, apiId: sec.tgr_api_id, apiHash: sec.tgr_api_hash });
        const found = await searchGroups(client, q);
        const { data: have } = await sb.from("tgr_groups").select("username");
        const added = new Set((have || []).map((g) => g.username));
        return Response.json({ groups: found.map(({ username, title, kind, members }) => ({ username, title, kind, members, added: added.has(username) })) });
      } catch (e) {
        const msg = tgError(e);
        if (AUTH_LOST.has(errCode(e))) await setAccount(sb, { acc_state: "error", acc_error: msg });
        return Response.json({ error: msg }, { status: 400 });
      } finally {
        await closeClient(client);
      }
    });
  } catch (e) {
    return fail(e);
  }
}
