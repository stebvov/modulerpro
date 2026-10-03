// «Додати свій товар» за посиланням: сервер відкриває сторінку товару і повертає назву, опис, фото й ціну.
// Доступ — лише з входом у систему (адмін, менеджер, бухгалтер). Сайт, що не пускає сервер (403 чи капча),
// не обходимо: повертаємо blocked, і людина заповнює поля сама.
import { lookup } from "node:dns/promises";
import net from "node:net";
import { createClient } from "@/lib/supabase/server";
import { HEADERS } from "../../../../../tools/price-parser/lib.mjs";
import { productFromHtml } from "../../../../../tools/price-parser/product.mjs";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;

// внутрішні адреси серверу відкривати не можна — лише справжні сайти в інтернеті
const internal = new net.BlockList();
for (const [ip, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16]]) internal.addSubnet(ip, bits, "ipv4");
for (const [ip, bits] of [["::", 127], ["fc00::", 7], ["fe80::", 10]]) internal.addSubnet(ip, bits, "ipv6");
// IPv4, записана як IPv6 (::ffff:10.0.0.1), перевіряється як IPv4
const isInternal = (address, family) => {
  const v4 = family === 6 && /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  return v4 ? internal.check(v4, "ipv4") : internal.check(address, family === 6 ? "ipv6" : "ipv4");
};

async function publicUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => isInternal(a.address, a.family))) return null;
  return url;
}

async function fetchPage(raw) {
  let target = raw;
  for (let hop = 0; hop < 5; hop++) {
    const url = await publicUrl(target);
    if (!url) return { error: "Це посилання відкрити не можна — потрібна адреса сторінки товару в інтернеті." };
    const res = await fetch(url, { headers: HEADERS, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      target = new URL(res.headers.get("location"), url).href;
      continue;
    }
    if ([401, 403, 429, 503].includes(res.status)) return { blocked: true, error: `Сайт не пускає запити із сервера (відповідь ${res.status}) — заповни поля вручну.` };
    if (!res.ok) return { error: `Сторінка не відкрилась (відповідь ${res.status}). Перевір посилання.` };
    if (!/html/i.test(res.headers.get("content-type") || "")) return { error: "За посиланням не сторінка товару (це файл або картинка)." };
    const html = (await res.text()).slice(0, MAX_BYTES);
    return { html, url: url.href };
  }
  return { error: "Забагато переадресацій — встав пряме посилання на сторінку товару." };
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Потрібно увійти в систему" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager", "accountant"].includes(profile?.role)) return Response.json({ error: "Немає доступу" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const raw = String(body.url || "").trim();
  if (!raw) return Response.json({ error: "Встав посилання на товар" }, { status: 400 });

  try {
    const page = await fetchPage(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (page.error) return Response.json({ error: page.error, blocked: !!page.blocked });
    const product = productFromHtml(page.html, page.url);
    if (!product.name && !product.price) return Response.json({ blocked: true, error: "На сторінці не знайшлось ні назви, ні ціни (можливо, сайт показав перевірку «чи ви людина») — заповни поля вручну." });
    return Response.json({ url: page.url, product });
  } catch (e) {
    const timeout = /timeout|aborted/i.test(e.name + e.message);
    return Response.json({ error: timeout ? "Сайт не відповів за 15 секунд — заповни поля вручну." : `Не вдалося відкрити сторінку: ${e.message}`, blocked: true });
  }
}
