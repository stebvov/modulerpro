// Ціни з браузера: людина відкриває сторінку магазину у своєму браузері й надсилає її сюди (вікно /capture).
// Для магазинів, чиї сайти не пускають програми (Leroy Merlin, Angio); працює й для решти магазинів зі списку.
import { parserAccess, parserFailure } from "@/lib/priceParserAccess";
import { makeRpc, capturePage } from "../../../../../tools/price-parser/core.mjs";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const host = (u) => new URL(u).hostname.replace(/^www\./, "");

export async function POST(request) {
  const who = await parserAccess(request);
  if (who.error) return who.error;
  const { token } = who;

  const body = await request.json().catch(() => null);
  const url = String(body?.url || "");
  const html = String(body?.html || "");
  if (!/^https?:\/\//.test(url) || html.length < 500) return Response.json({ error: "Сторінка порожня або без адреси" }, { status: 400 });
  if (html.length > 4000000) return Response.json({ error: "Сторінка завелика" }, { status: 413 });

  const rpc = makeRpc(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  try {
    const cfg = await rpc("price_parser_config", { p_token: token });
    const store = cfg.stores.find((s) => s.website && host(s.website) === host(url));
    if (!store) {
      return Response.json({ error: `Сайту ${host(url)} немає серед магазинів. Додай постачальника з цим сайтом і ключем парсера — тоді його сторінки можна буде надсилати.` }, { status: 400 });
    }

    const res = await capturePage({ site: store.site, url, html, cfg, rpc, token });
    if (!res.items) await rpc("price_parser_sample", { p_token: token, p_site: store.site, p_url: url, p_html: html }).catch(() => {});

    const names = new Map(cfg.materials.map((m) => [m.id, m]));
    return Response.json({
      store: store.name,
      items: res.items,
      saved: res.saved,
      offers: res.offers
        .map((o) => ({ material: names.get(o.material_id)?.name, unit: names.get(o.material_id)?.unit, title: o.title, price: o.price, sale_unit: o.sale_unit, unit_price: o.unit_price }))
        .sort((a, b) => (a.material || "").localeCompare(b.material || "", "uk") || (a.unit_price ?? 1e12) - (b.unit_price ?? 1e12)),
    });
  } catch (e) {
    return parserFailure(e);
  }
}
