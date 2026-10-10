// Радар Telegram: обхід груп — за розкладом (GET, завдання pg_cron tg-radar) і кнопкою «Перевірити зараз» (POST).
// ?ping=1 — лише перевірити, що сервер дістається до Telegram (без акаунта й без запису).
import { radarAccess, withLock, fail } from "@/lib/tgRadar/server";
import { runRadar } from "@/lib/tgRadar/run";
import { openClient, closeClient } from "@/lib/tgRadar/telegram";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

async function run(request) {
  const who = await radarAccess(request, { cronOk: true });
  if (who.error) return who.error;
  const started = Date.now();
  try {
    if (new URL(request.url).searchParams.get("ping")) {
      let client;
      try { client = await openClient({ apiId: 1, apiHash: "0" }); return Response.json({ telegram: "ok", ms: Date.now() - started }); }
      finally { await closeClient(client); }
    }
    return await withLock(who.sb, 150, async () => {
      const r = await runRadar({ sb: who.sb, trigger: who.trigger, deadline: started + 85_000 });
      return Response.json({ seconds: Math.round((Date.now() - started) / 1000), ...r });
    });
  } catch (e) {
    return fail(e);
  }
}

export const GET = run;
export const POST = run;
