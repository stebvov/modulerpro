// Автоматичний переклад текстів сайту: кнопка «Перекласти автоматично» в розділі «Сайт → Переклади».
// Отримує українські тексти, яких ще немає в словнику site_i18n, перекладає їх вибраною мовою й записує з позначкою «авто»
// (щоб людина могла вичитати). Тексти, вже перекладені людиною, не чіпає.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { createHash } from "node:crypto";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_TEXTS = 50;
const MAX_LEN = 4000;

// Правила для кожної мови: стиль, запис чисел і одиниць, словник термінів, назви. Ті самі, якими зроблено початковий переклад сайту.
type Lang = { name: string; style: string; numbers: string; glossary: string; names: string };
const LANGS: Record<string, Lang> = {
  en: {
    name: "English",
    style: `Write natural, clear, warm and professional English for a marketing website: British-leaning international spelling (metre, centre, colour). Keep the register of the source (the site addresses the reader politely as "you").`,
    numbers: `- Numbers: decimal comma becomes a decimal point (2,5 → 2.5), a space between thousands becomes a comma ($59 900 → $59,900).
- Units: м² → m², м → m, км → km, хв → min, грн → UAH (written before the number: UAH 750). A "сотка" is 100 m²: express land area in m² (5 соток → 500 m²).
- Quotation marks: “…”.`,
    glossary: `модульний будинок → modular home; Конструктив → Shell; Під оздоблення → Ready for finishing; Готове житло → Move-in ready; під ключ → turnkey; готова модель → ready model; індивідуальний проєкт / розробка → custom design; містечко → community; котеджне містечко → cottage community; смарт-квартал → Smart Quarter; ділянка → plot; комунікації → utilities; генплан → site plan; черга (будівництва) → phase; керуюча компанія → management company; кейс → case study; заявка → enquiry; кошторис → quote; база відпочинку → resort; глемпінг → glamping; дохідна нерухомість → income property; подобова оренда → short-term rental; довгострокова оренда → long-term rental; ВПО, переселенці → displaced people; благоустрій → landscaping; оздоблення → finish / finishing; санвузол → bathroom.`,
    names: `ШАНТІ → SHANTI; Вілла 8 → Villa 8; Простір сенсів → Space of Meaning; «Добрий дім» → “Good Home”; КМ «Балатон» → the Balaton cottage community. House models: Мохо → Moho; Простір 40 → Space 40; Затишок 30 → Cosy 30; Родина 60 → Family 60; Садиба 80 → Homestead 80; Гавань 100+ → Haven 100+. Ukrainian place and personal names are transliterated by the Ukrainian national standard (Київ → Kyiv, Одеса → Odesa, Львівська область → Lviv region).`,
  },
  pl: {
    name: "Polish",
    style: `Write natural, clear, warm and professional Polish for a marketing website. Address the reader directly in the second person singular with capitalised pronouns (Ty, Twój, Ciebie), as Polish marketing copy does. Write "w Ukrainie".`,
    numbers: `- Numbers keep the decimal comma and the space between thousands (2,5; 59 900).
- Currency goes after the number: $59 900 → 59 900 $, 750 грн → 750 UAH.
- Units: м² → m², м → m, км → km, хв → min. A "сотка" is one ar (100 m²): 5 соток → 5 arów, 2,5 сотки → 2,5 ara.
- Quotation marks: „…”.`,
    glossary: `модульний будинок → dom modułowy; Конструктив (the completion level) → Stan surowy, but конструктив as the structure of the house → konstrukcja; Під оздоблення → Stan deweloperski; Готове житло → Gotowy do zamieszkania; під ключ → pod klucz; готова модель → gotowy model; індивідуальний проєкт → projekt indywidualny; розробка (our design) → projekt; містечко → osiedle; котеджне містечко → osiedle domów; смарт-квартал → smart-kwartał; ділянка → działka; комунікації → media; генплан → plan zagospodarowania; черга (будівництва) → etap; керуюча компанія → firma zarządzająca; кейс → realizacja; заявка → zapytanie / zgłoszenie; кошторис → kosztorys; база відпочинку → ośrodek wypoczynkowy; глемпінг → glamping; дохідна нерухомість → nieruchomość dochodowa; подобова оренда → wynajem na doby; довгострокова оренда → wynajem długoterminowy; ВПО, переселенці → osoby przesiedlone; громада → społeczność lokalna; благоустрій → zagospodarowanie terenu; оздоблення → wykończenie; санвузол → łazienka; юніт → domek / dom.`,
    names: `ШАНТІ → SHANTI; Вілла 8 → Willa 8; Простір сенсів → Przestrzeń Sensów; «Добрий дім» → „Dobry Dom”; КМ «Балатон» → osiedle „Balaton”. House models: Мохо → Moho; Простір 40 → Przestrzeń 40; Затишок 30 → Zacisze 30; Родина 60 → Rodzina 60; Садиба 80 → Dworek 80; Гавань 100+ → Przystań 100+. Ukrainian place names take the established Polish form where one exists (Київ → Kijów, Львів → Lwów, Одеса → Odessa, Київська область → obwód kijowski), otherwise Polish transliteration (Ровжі → Rowży).`,
  },
  ru: {
    name: "Russian",
    style: `Write natural, clear, warm and professional Russian for a marketing website. Address the reader politely as «вы» (lower case). Write «в Украине», «по Украине». Use the letter ё where it belongs.`,
    numbers: `- Numbers, currency and units stay as in the source: decimal comma, a space between thousands, $59 900, 750 грн, м², км, сотки.
- Quotation marks: «…».`,
    glossary: `модульний будинок → модульный дом; Конструктив → Конструктив; Під оздоблення → Под отделку; Готове житло → Готовое жильё; під ключ → под ключ; готова модель → готовая модель; індивідуальний проєкт → индивидуальный проект; розробка → разработка; містечко → городок; котеджне містечко → коттеджный городок; смарт-квартал → смарт-квартал; ділянка → участок; комунікації → коммуникации; генплан → генплан; черга (будівництва) → очередь; керуюча компанія → управляющая компания; кейс → кейс; заявка → заявка; кошторис → смета; база відпочинку → база отдыха; глемпінг → глэмпинг; дохідна нерухомість → доходная недвижимость; подобова оренда → посуточная аренда; довгострокова оренда → долгосрочная аренда; ВПО, переселенці → переселенцы; громада → община; благоустрій → благоустройство; оздоблення → отделка; санвузол → санузел; юніт → юнит.`,
    names: `ШАНТІ → ШАНТИ; Вілла 8 → Вилла 8; Простір сенсів → Пространство смыслов; «Добрий дім» → «Добрый дом»; КМ «Балатон» → КГ «Балатон». House models: Мохо → Мохо; Простір 40 → Простор 40; Затишок 30 → Уют 30; Родина 60 → Семья 60; Садиба 80 → Усадьба 80; Гавань 100+ → Гавань 100+. Ukrainian place names take the established Russian form (Київ → Киев, Львів → Львов, Одеса → Одесса, Київська область → Киевская область).`,
  },
};

const SYSTEM = (l: Lang) => `You translate the texts of the Moduler website from Ukrainian into ${l.name}. Moduler is a Ukrainian manufacturer of modular homes; it also builds its own small residential communities, offers investment in rental houses and runs a service/management company. The readers are private buyers, investors and business owners in Ukraine, the EU and beyond.

${l.style} No hype the source does not contain, no added facts, nothing left out. Short UI labels stay short.

Formatting that must survive exactly:
- *asterisks* mark emphasised words: keep the same number of asterisks, around the corresponding words.
- "|" separates table cells: keep the same number of cells in the same order.
- Keep line breaks and paragraph breaks, emoji, URLs, e-mail addresses, placeholders such as {name} or {n}, and symbols such as →, ✓, ·.
${l.numbers}

Glossary (use consistently):
${l.glossary}

Names: Moduler, Avatar Village, EdRockets stay as they are. ${l.names}

You receive a JSON array of objects {"i": number, "text": string}. Return one item for every input object, with the same "i" and the translation in "text".`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { i: { type: "integer" }, text: { type: "string" } },
        required: ["i", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const count = (s: string, ch: string) => s.split(ch).length - 1;
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Лише POST" }, 405);
  try {
    // доступ: той, хто веде сайт (та сама перевірка, що й у правилах таблиці site_i18n)
    const auth = req.headers.get("Authorization") ?? "";
    const asUser = createClient(SB_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: can, error: canErr } = await asUser.rpc("mod_can");
    if (canErr || !can) return json({ error: "Немає доступу до сайту" }, 403);

    const body = await req.json().catch(() => null);
    const lang = String(body?.lang ?? "");
    const conf = LANGS[lang];
    if (!conf) return json({ error: "Невідома мова" }, 400);
    const texts: string[] = [...new Set((Array.isArray(body?.texts) ? body.texts : []).filter((t: unknown) => typeof t === "string" && t.trim()).map((t: string) => t.trim()))];
    if (!texts.length) return json({ ok: true, items: {}, skipped: 0 });
    if (texts.length > MAX_TEXTS) return json({ error: `Не більше ${MAX_TEXTS} текстів за раз` }, 400);
    if (texts.some((t) => t.length > MAX_LEN)) return json({ error: `Один із текстів довший за ${MAX_LEN} знаків — перекладіть його вручну частинами` }, 400);

    // тексти, які вже переклала людина, не чіпаємо (шукаємо за src_hash = md5(src): самі тексти задовгі для адреси запиту)
    const { data: have, error: haveErr } = await admin.from("site_i18n").select("src,text,auto").eq("lang", lang).in("src_hash", texts.map(md5));
    if (haveErr) return json({ error: "Не вдалося прочитати словник: " + haveErr.message }, 500);
    const done = new Set((have ?? []).filter((r: { text: string; auto: boolean }) => r.text?.trim() && !r.auto).map((r: { src: string }) => r.src));
    const todo = texts.filter((t) => !done.has(t));
    if (!todo.length) return json({ ok: true, items: {}, skipped: texts.length });

    const { data: sec } = await admin.from("app_secrets").select("value").eq("key", "anthropic_api_key").maybeSingle();
    if (!sec?.value) return json({ error: "Ключ ШІ не налаштовано" }, 500);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": sec.value,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01", // якщо запит відхилено фільтром безпеки — його повторить запасна модель
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        fallbacks: "default",
        output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
        system: SYSTEM(conf),
        messages: [{ role: "user", content: JSON.stringify(todo.map((text, i) => ({ i, text }))) }],
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      const msg = String(j?.error?.message ?? r.status);
      if (/credit balance/i.test(msg)) return json({ error: "Баланс Anthropic API закінчився — поповніть на console.anthropic.com" }, 502);
      return json({ error: "ШІ недоступний: " + msg }, 502);
    }
    if (j.stop_reason === "refusal") return json({ error: "ШІ відмовився перекладати ці тексти — перекладіть їх вручну" }, 502);
    if (j.stop_reason === "max_tokens") return json({ error: "Відповідь не вмістилася — надішліть менше текстів за раз" }, 502);
    const out = (j.content ?? []).find((b: { type: string }) => b.type === "text")?.text ?? "";
    let parsed: { items?: { i: number; text: string }[] };
    try { parsed = JSON.parse(out); } catch { return json({ error: "ШІ повернув некоректну відповідь — спробуйте ще раз" }, 502); }

    // приймаємо лише переклади, де збереглася розмітка: кількість зірочок (виділення) і стовпців таблиці
    const items: Record<string, string> = {};
    const rows: { lang: string; src: string; text: string; auto: boolean; updated_at: string }[] = [];
    const now = new Date().toISOString();
    for (const it of parsed.items ?? []) {
      const src = todo[it.i];
      const text = String(it.text ?? "").trim();
      if (!src || !text || items[src]) continue;
      if (count(src, "*") !== count(text, "*") || count(src, "|") !== count(text, "|")) continue;
      items[src] = text;
      rows.push({ lang, src, text, auto: true, updated_at: now });
    }
    if (rows.length) {
      const { error } = await admin.from("site_i18n").upsert(rows, { onConflict: "lang,src_hash" });
      if (error) return json({ error: "Не вдалося зберегти переклади: " + error.message }, 500);
    }
    return json({ ok: true, items, skipped: texts.length - rows.length, usage: { in: j.usage?.input_tokens ?? 0, out: j.usage?.output_tokens ?? 0 }, model: j.model });
  } catch (e) {
    return json({ error: "Помилка перекладу: " + (e as Error).message }, 500);
  }
});
