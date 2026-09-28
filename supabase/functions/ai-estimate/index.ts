// Оцінка ШІ: собівартість і ринкова ціна проєкту/ідеї.
// depth = "quick" (1–2 хв, 3 пошуки) або "deep" (3–5 хв, до 8 пошуків, 8–12 аналогів, попит, конкуренти, канали).
// Читає опис проєкту, посилання з опису й коментарів, довідник Moduler Pro (лише читання) і шукає аналоги в інтернеті.
// Працює у фоні: одразу створює рядок зі status=running, потім заповнює його результатом.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function secrets(): Promise<Record<string, string>> {
  const { data } = await admin.from("app_secrets").select("key,value");
  return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
}

/* ---------- посилання ---------- */
function extractUrls(text: string): string[] {
  const m = String(text || "").match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  return [...new Set(m.map((u) => u.replace(/[.,;:!?]+$/, "")))];
}
function exportUrl(u: string): string {
  let m = u.match(/docs\.google\.com\/document\/d\/([\w-]+)/);
  if (m) return `https://docs.google.com/document/d/${m[1]}/export?format=txt`;
  m = u.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (m) { const gid = u.match(/[#&?]gid=(\d+)/)?.[1]; return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? "&gid=" + gid : ""}`; }
  m = u.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/);
  if (m) return `https://docs.google.com/presentation/d/${m[1]}/export/txt`;
  return u;
}
function htmlToText(h: string): { title: string; text: string } {
  const title = (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const meta = [...h.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description|og:title)["'][^>]+content=["']([^"']+)["']/gi)].map((x) => x[1]).join(" · ");
  const body = h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return { title, text: (meta ? meta + "\n" : "") + body };
}
async function readUrl(url: string): Promise<{ url: string; ok: boolean; title?: string; text?: string; note?: string }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(exportUrl(url), { signal: ctl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; ModulerPult/1.0)", "Accept-Language": "uk,ru;q=0.8,en;q=0.6" } });
    if (!r.ok) return { url, ok: false, note: `HTTP ${r.status}${r.status === 401 || r.status === 403 ? " — немає публічного доступу" : ""}` };
    const ct = r.headers.get("content-type") ?? "";
    if (/pdf|image|video|audio|zip|octet-stream/i.test(ct)) return { url, ok: false, note: "файл " + ct.split(";")[0] + " — не читається автоматично" };
    const raw = (await r.text()).slice(0, 400000);
    if (/accounts\.google\.com\/(ServiceLogin|v3\/signin)/.test(r.url) || /<title>[^<]*(Вхід|Sign in)[^<]*<\/title>/i.test(raw)) return { url, ok: false, note: "потрібен вхід — відкрийте доступ «усі, хто має посилання»" };
    const { title, text } = /html/i.test(ct) ? htmlToText(raw) : { title: "", text: raw };
    return { url, ok: text.length > 40, title, text: text.slice(0, 7000), note: text.length > 40 ? undefined : "порожня сторінка" };
  } catch (e) {
    return { url, ok: false, note: (e as Error).name === "AbortError" ? "не відповідає (таймаут)" : "не вдалося відкрити" };
  } finally { clearTimeout(t); }
}

/* ---------- довідник Moduler Pro (лише читання) ---------- */
async function reference(): Promise<string> {
  const [tp, mat, sp, bom, ex, fx] = await Promise.all([
    admin.from("product_templates").select("id,name,area_m2,module_count,base_cost_per_m2,status"),
    admin.from("materials").select("id,name,unit"),
    admin.from("supplier_prices").select("material_id,price,currency,updated_at"),
    admin.from("template_bom_items").select("template_id,material_id,quantity_per_unit,unit,unit_price_override"),
    admin.from("template_extra_costs").select("template_id,label,amount"),
    admin.from("exchange_rates").select("code,rate_to_uah"),
  ]);
  const minPrice: Record<string, number> = {};
  for (const p of sp.data ?? []) { const v = Number(p.price); if (!minPrice[p.material_id] || v < minPrice[p.material_id]) minPrice[p.material_id] = v; }
  const matLines = (mat.data ?? []).map((m: any) => `${m.name}: ${minPrice[m.id] ? Math.round(minPrice[m.id]) + " грн/" + m.unit : "ціни немає"}`);
  const tplLines = (tp.data ?? []).filter((t: any) => t.status !== "archived").map((t: any) => {
    const items = (bom.data ?? []).filter((b: any) => b.template_id === t.id);
    const bomSum = items.reduce((a: number, b: any) => a + Number(b.quantity_per_unit) * Number(b.unit_price_override ?? minPrice[b.material_id] ?? 0), 0);
    const extra = (ex.data ?? []).filter((x: any) => x.template_id === t.id).reduce((a: number, x: any) => a + Number(x.amount), 0);
    return `${t.name}: ${t.area_m2} м², модулів ${t.module_count}${bomSum ? `, матеріали за специфікацією ≈ ${Math.round(bomSum)} грн` : ""}${extra ? `, додаткові витрати ${Math.round(extra)} грн` : ""}${t.base_cost_per_m2 ? `, базова собівартість ${Math.round(t.base_cost_per_m2)} грн/м²` : ""}`;
  });
  const fxLine = (fx.data ?? []).filter((f: any) => f.code !== "UAH").map((f: any) => `${f.code} = ${f.rate_to_uah} грн`).join(", ");
  return `Курси: ${fxLine || "немає"}\nШаблони будинків компанії:\n${tplLines.join("\n") || "немає"}\nМатеріали (мінімальна ціна постачальника):\n${matLines.join("\n") || "немає"}\nУВАГА: довідник неповний, частина даних тестова — використовуй як орієнтир, а не як істину.`;
}

/* ---------- Claude ---------- */
const MODELS = ["claude-sonnet-5", "claude-sonnet-4-5", "claude-haiku-4-5-20251001"];
const PRICE: Record<string, [number, number]> = { "claude-haiku-4-5-20251001": [1, 5] };
async function call(key: string, body: any) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { r, j: await r.json() };
}
const usage = { in: 0, out: 0, searches: 0 };
function addUsage(j: any) { usage.in += j.usage?.input_tokens ?? 0; usage.out += j.usage?.output_tokens ?? 0; usage.searches += j.usage?.server_tool_use?.web_search_requests ?? 0; }
async function ask(key: string, system: string, user: string, deep: boolean) {
  let lastErr = "";
  for (const model of MODELS) {
    for (const withSearch of [true, false]) {
      const messages: any[] = [{ role: "user", content: user }];
      const body: any = { model, max_tokens: deep ? 16000 : 8000, system, messages };
      if (withSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: deep ? 8 : 3 }];
      let { r, j } = await call(key, body);
      const all: any[] = [];
      // довгий пошук: API ставить відповідь на паузу — продовжуємо
      for (let k = 0; r.ok && j.stop_reason === "pause_turn" && k < (deep ? 6 : 4); k++) {
        addUsage(j); all.push(...(j.content ?? []));
        messages.push({ role: "assistant", content: j.content });
        ({ r, j } = await call(key, { ...body, messages }));
      }
      if (r.ok) { addUsage(j); all.push(...(j.content ?? [])); return { j, model, withSearch, content: all }; }
      lastErr = String(j?.error?.message ?? r.status);
      if (/credit balance/i.test(lastErr)) throw new Error("Баланс Anthropic API закінчився — поповніть на console.anthropic.com");
      if (/model/i.test(lastErr) && !/tool/i.test(lastErr)) break; // інша модель
    }
  }
  throw new Error("ШІ недоступний: " + lastErr);
}
const num = (v: any) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return isFinite(n) && n > 0 ? Math.round(n) : null; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    const email = u?.user?.email;
    if (!email) return json({ error: "Потрібен вхід у пульт" }, 401);
    const { data: me } = await admin.from("task_members").select("id,name").ilike("email", email).eq("active", true).maybeSingle();
    if (!me) return json({ error: "Немає доступу" }, 403);
    const { project, depth } = await req.json();
    const deep = depth === "deep";
    const { data: p } = await admin.from("task_projects").select("name,description,kind,idea,direction").eq("name", project).maybeSingle();
    if (!p) return json({ error: "Проєкт не знайдено" }, 404);
    const s = await secrets();
    if (!s.anthropic_api_key) return json({ error: "Ключ ШІ не налаштовано" }, 500);

    const { data: job, error: je } = await admin.from("project_estimates").insert({ project: p.name, kind: "ai", author_id: me.id, data: { status: "running", depth: deep ? "deep" : "quick", started_at: new Date().toISOString() } }).select("id").single();
    if (je || !job) return json({ error: "Не вдалося почати: " + (je?.message ?? "") }, 500);
    const work = run(p, me, s, job.id, deep).catch(async (e) => {
      console.error(e);
      await admin.from("project_estimates").update({ data: { status: "error", depth: deep ? "deep" : "quick", error: (e as Error).message } }).eq("id", job.id);
    });
    // @ts-ignore EdgeRuntime існує в Supabase Edge
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work); else await work;
    return json({ ok: true, id: job.id, status: "running" });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

const DIR_CTX: Record<string, string> = {
  factory: "Напрям «Завод»: продаємо модульні будинки з каталогу.",
  towns: "Напрям «Містечка»: продаємо ділянку + будинок + комунікації + спільну інфраструктуру. Оцінюй 1 лот (ділянка з будинком).",
  income: "Напрям «Дохідна нерухомість»: продаємо будинок як інвестицію з управлінням. Оціни також дохідність для інвестора (оренда, завантаженість).",
  service: "Напрям «Сервіс»: керуюча компанія — обслуговування, оренда, прибирання, ремонт для власників. Оцінюй місячну підписку на 1 будинок і ринок таких послуг.",
};

async function run(p: any, me: any, s: Record<string, string>, jobId: string, deep: boolean) {
  usage.in = 0; usage.out = 0; usage.searches = 0;
  const { data: notes } = await admin.from("project_notes").select("body").eq("project", p.name).order("created_at").limit(40);
  const { data: analogs } = await admin.from("project_analogs").select("name,price,currency,area_m2,location,url").eq("project", p.name).limit(40);
  const urls = extractUrls([p.description ?? "", ...(notes ?? []).map((n: any) => n.body ?? "")].join("\n")).slice(0, 8);
  const read = await Promise.all(urls.map(readUrl));
  const ref = await reference();
  const idea = p.idea ?? {};
  const known = [idea.price && `наша ціна зараз: ${idea.price} грн`, idea.market && `ринок за даними команди: ${idea.market} грн`, idea.conditions && `умови запуску: ${idea.conditions}`].filter(Boolean).join("; ");

  const limits = deep
    ? "Детальний аналіз: breakdown до 10 рядків, analogs 8–12 (різні регіони й виробники), assumptions до 6, risks до 5, questions до 5, competitors 3–6, channels 3–6."
    : "Стисло: breakdown до 7 рядків, analogs до 5, assumptions до 5, risks до 3, questions до 4.";
  const deepSchema = deep
    ? `,\n "price_per_m2":{"low":число,"high":число},\n "demand":"хто купує, скільки, сезонність — 2–3 речення",\n "competitors":[{"name":"...","url":"...","note":"чим сильні/слабкі"}],\n "channels":["де і як продавати"],\n "recommendation":"ціна й позиціювання, 1–2 речення"`
    : "";
  const system = `Ти — фінансовий аналітик української компанії, що виробляє модульні будинки (3 виробничі майданчики, власні бригади монтажу). Твоє завдання — ${deep ? "ДЕТАЛЬНА" : "ШВИДКА попередня"} оцінка для рішення «запускаємо чи ні»: собівартість для компанії і ринкова ціна продажу в Україні. Люди потім перевірять і внесуть свої цифри.
Правила:
- Усі суми в гривнях (UAH), за одиницю, яку продаємо (зазвичай 1 будинок або 1 модуль; якщо проєкт — містечко/ділянка, оцінюй 1 будинок або лот і скажи про це в unit).
- Собівартість = матеріали + виробництво (праця) + доставка + монтаж + накладні. Спирайся на довідник компанії, якщо він підходить, і на типові ринкові ціни матеріалів і робіт в Україні 2026 року.
- Ринок: знайди реальні аналоги в Україні з цінами й посиланнями через веб-пошук. Не вигадуй посилань: якщо аналог без посилання — url порожній.
- Якщо даних мало — все одно дай діапазон, знизь confidence і напиши, що уточнити.
- ${limits} Не пиши пояснень до чи після JSON.
- Відповідай українською. У кінці поверни ЛИШЕ JSON (без markdown) такого вигляду:
{"summary":"що саме оцінено, 1–2 речення","unit":"за що ціна","area_m2":число або null,
 "cost":{"total":число,"per_m2":число або null,"breakdown":[{"item":"матеріали коробки","sum":число}],"assumptions":["..."]},
 "market":{"low":число,"high":число,"recommended_price":число,"analogs":[{"name":"...","price":число,"area_m2":число або null,"location":"...","url":"..."}],"reasoning":"1–3 речення"},
 "margin_pct":число,"confidence":"низька|середня|висока","risks":["..."],"questions":["що уточнити людям"]${deepSchema}}`;
  const user = `ПРОЄКТ: ${p.name}${p.kind === "idea" ? " (ідея на перевірці)" : ""}
${p.direction && DIR_CTX[p.direction] ? DIR_CTX[p.direction] + "\n" : ""}ОПИС:
${p.description || "(опису немає)"}
${known ? "\nВІДОМО ВІД КОМАНДИ: " + known : ""}
${(analogs ?? []).length ? "\nАНАЛОГИ, ЯКІ ВЖЕ ЗНАЙШЛА КОМАНДА (перевір і доповни, не дублюй):\n" + (analogs ?? []).map((a: any) => `- ${a.name}${a.location ? ", " + a.location : ""}: ${a.price ?? "?"} ${a.currency}${a.area_m2 ? ", " + a.area_m2 + " м²" : ""}${a.url ? " " + a.url : ""}`).join("\n") : ""}
${(notes ?? []).length ? "\nКОМЕНТАРІ ДО ПРОЄКТУ:\n" + (notes ?? []).map((n: any) => "- " + String(n.body ?? "").slice(0, 400)).join("\n") : ""}

ВМІСТ ПОСИЛАНЬ З ОПИСУ Й КОМЕНТАРІВ:
${read.length ? read.map((r, i) => `[${i + 1}] ${r.url}\n${r.ok ? (r.title ? "Заголовок: " + r.title + "\n" : "") + r.text : "НЕ ПРОЧИТАНО: " + r.note}`).join("\n\n") : "(посилань немає)"}

ДОВІДНИК КОМПАНІЇ (Moduler Pro):
${ref}`;

  const { j, model, withSearch, content } = await ask(s.anthropic_api_key, system, user, deep);
  const last = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  const text = content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  const parse = (t: string) => { const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a < 0 || b <= a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; } };
  let out: any = parse(last) ?? parse(text);
  if (!out?.cost && !out?.market) {
    // модель відповіла текстом — просимо перекласти її ж висновки в JSON (без нового пошуку)
    const { r: r2, j: j2 } = await call(s.anthropic_api_key, { model, max_tokens: deep ? 12000 : 4000, system: "Перетвори аналіз у JSON строго за схемою. Поверни ЛИШЕ JSON без markdown.\n" + system.slice(system.indexOf("{\"summary\"")),
      messages: [{ role: "user", content: "Аналіз:\n" + text.slice(0, 40000) }] });
    if (r2.ok) { addUsage(j2); out = parse((j2.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("")); }
  }
  if (!out) throw new Error("ШІ не зміг сформувати оцінку — спробуйте ще раз або додайте більше деталей в опис");
  const searches = usage.searches;
  const [pi, po] = PRICE[model] ?? [3, 15];
  const costUsd = usage.in * pi / 1e6 + usage.out * po / 1e6 + searches * 0.01;
  await admin.from("ai_usage").insert({ purpose: deep ? "estimate-deep" : "estimate", model, input_tokens: usage.in, output_tokens: usage.out, cost_usd: costUsd });
  const data = { ...out, depth: deep ? "deep" : "quick", model, web_search: withSearch, searches, sources: read.map((r) => ({ url: r.url, ok: r.ok, title: r.title ?? null, note: r.note ?? null })), cost_usd: Math.round(costUsd * 1000) / 1000 };
  const row = {
    cost: num(out?.cost?.total), market_low: num(out?.market?.low), market_high: num(out?.market?.high), price: num(out?.market?.recommended_price),
    comment: out?.summary ? String(out.summary).slice(0, 500) : null, data,
  };
  const { error } = await admin.from("project_estimates").update({ ...row, data: { ...data, status: "done" } }).eq("id", jobId);
  if (error) throw new Error("Не збережено: " + error.message);
  await admin.from("project_notes").insert({ project: p.name, author_id: me.id, body: `${deep ? "🔬 Детальна" : "🧮 Швидка"} оцінка ШІ готова (прочитано посилань: ${read.filter((r) => r.ok).length} з ${read.length}${withSearch ? `, пошуків: ${searches}` : ""}, аналогів: ${(out?.market?.analogs ?? []).length}). Блок «📊 Оцінка ринку» в проєкті: додайте аналоги в конструктор і внесіть свою оцінку.` });
}
