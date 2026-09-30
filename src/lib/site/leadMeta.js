// Деталі заявки з сайту: пристрій, джерело, країна/місто — з того, що дав браузер (visitor.js) і сервер (заголовки Vercel).
// Працює і на сервері (/api/site/lead), і в браузері (запасний шлях без гео). Результат → leads.site_meta.

const UA_REGIONS = {
  "05": "Вінницька", "07": "Волинська", "09": "Луганська", "12": "Дніпропетровська", "14": "Донецька", "18": "Житомирська",
  "21": "Закарпатська", "23": "Запорізька", "26": "Івано-Франківська", "30": "Київ", "32": "Київська", "35": "Кіровоградська",
  "40": "Севастополь", "43": "Крим", "46": "Львівська", "48": "Миколаївська", "51": "Одеська", "53": "Полтавська", "56": "Рівненська",
  "59": "Сумська", "61": "Тернопільська", "63": "Харківська", "65": "Херсонська", "68": "Хмельницька", "71": "Черкаська",
  "74": "Чернігівська", "77": "Чернівецька",
};

export function flagOf(cc) {
  return /^[A-Z]{2}$/.test(cc || "") ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : "";
}

export function countryName(cc) {
  if (!/^[A-Z]{2}$/.test(cc || "")) return "";
  try { return new Intl.DisplayNames(["uk"], { type: "region" }).of(cc) || cc; } catch { return cc; }
}

// пристрій, система, браузер із User-Agent (+ підказки Client Hints з браузера)
export function parseUA(ua = "", hints = {}) {
  const r = { type: "Комп'ютер", os: "", browser: "", inapp: "", bot: false };
  if (/bot|crawl|spider|headless|lighthouse|preview/i.test(ua)) r.bot = true;
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) r.type = "Планшет";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) r.type = "Телефон";
  // iPadOS видає себе за Mac — розпізнаємо за сенсорним екраном
  if (/Macintosh/.test(ua) && (hints.touch || 0) > 1) r.type = "Планшет";

  let m;
  if ((m = /(iPhone|iPad|iPod).*?OS (\d+)[_.](\d+)/.exec(ua))) r.os = `${m[1] === "iPad" ? "iPadOS" : "iOS"} ${m[2]}.${m[3]}`;
  else if (/Android/.test(ua)) {
    // Chrome «заморожує» рядок як «Android 10; K» — справжня версія лише в Client Hints
    const pv = parseInt(hints.platformVersion, 10);
    m = /Android (\d+(?:\.\d+)?)/.exec(ua);
    r.os = pv ? `Android ${pv}` : m && !/Android 10; K\)/.test(ua) ? `Android ${m[1]}` : "Android";
  }
  else if (/Windows NT 10/.test(ua)) r.os = hints.platformVersion && parseInt(hints.platformVersion, 10) >= 13 ? "Windows 11" : "Windows 10/11";
  else if ((m = /Windows NT (\d+\.\d+)/.exec(ua))) r.os = { "6.3": "Windows 8.1", "6.2": "Windows 8", "6.1": "Windows 7" }[m[1]] || `Windows NT ${m[1]}`;
  else if ((m = /Mac OS X (\d+)[_.](\d+)/.exec(ua))) r.os = r.type === "Планшет" ? "iPadOS" : m[1] === "10" && m[2] === "15" ? "macOS" : `macOS ${m[1]}.${m[2]}`; // 10.15 — заморожене значення
  else if (/CrOS/.test(ua)) r.os = "ChromeOS";
  else if (/Linux/.test(ua)) r.os = "Linux";

  // вбудовані браузери соцмереж і месенджерів — важливо для реклами
  if (/Instagram/i.test(ua)) r.inapp = "Instagram";
  else if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) r.inapp = "Facebook";
  else if (/Telegram/i.test(ua)) r.inapp = "Telegram";
  else if (/Viber/i.test(ua)) r.inapp = "Viber";
  else if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) r.inapp = "TikTok";
  else if (/LinkedInApp/i.test(ua)) r.inapp = "LinkedIn";

  const B = [
    [/EdgA?\/(\d+)|Edg(?:iOS)?\/(\d+)/, "Edge"], [/OPR\/(\d+)|Opera\/(\d+)/, "Opera"], [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
    [/YaBrowser\/(\d+)/, "Яндекс"], [/Firefox\/(\d+)|FxiOS\/(\d+)/, "Firefox"], [/CriOS\/(\d+)/, "Chrome"], [/Chrome\/(\d+)/, "Chrome"],
    [/Version\/(\d+)[.\d]* (?:Mobile\/\w+ )?Safari/, "Safari"],
  ];
  for (const [re, name] of B) { if ((m = re.exec(ua))) { r.browser = `${name} ${m.slice(1).find(Boolean) || ""}`.trim(); break; } }
  if (!r.browser && /AppleWebKit/.test(ua) && /Mobile/.test(ua)) r.browser = "вбудований браузер";
  // модель: Android — з Client Hints, iPhone — лише з рядка Instagram/Facebook (напр. iPhone15,3)
  if (hints.model) r.model = String(hints.model).slice(0, 60);
  else if ((m = /\b(iPhone\d+,\d+|iPad\d+,\d+)\b/.exec(ua))) r.model = m[1];
  return r;
}

const HOSTS = [
  [/(^|\.)google\./, "Google (пошук)"], [/(^|\.)bing\.com$/, "Bing"], [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"], [/(^|\.)yandex\./, "Яндекс"],
  [/(^|\.)instagram\.com$/, "Instagram"], [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, "Facebook"], [/(^|\.)t\.me$|telegram/, "Telegram"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube"], [/(^|\.)tiktok\.com$/, "TikTok"], [/viber/, "Viber"], [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)olx\.ua$/, "OLX"], [/(^|\.)prom\.ua$/, "Prom"], [/(^|\.)moduler\.pro$/, "Старий сайт moduler.pro"], [/chatgpt\.com|openai\.com/, "ChatGPT"],
];

// звідки прийшов: мітки реклами → сайт-посилання → прямий захід
export function sourceOf(utm, ref) {
  const u = utm || {};
  if (u.gclid || u.gbraid || u.wbraid) return "Google Ads" + (u.utm_campaign ? ` · ${u.utm_campaign}` : "");
  if (u.utm_source) return `Мітка: ${u.utm_source}${u.utm_medium ? " / " + u.utm_medium : ""}${u.utm_campaign ? " · " + u.utm_campaign : ""}`;
  if (u.fbclid) return "Facebook / Instagram (посилання)";
  if (u.ttclid) return "TikTok (реклама)";
  if (!ref) return "Прямий захід";
  let host = "";
  try { host = new URL(ref).host.toLowerCase().replace(/^(www|m|l|lm|mobile)\./, ""); } catch { return "Інший сайт"; }
  for (const [re, name] of HOSTS) if (re.test(host)) return name;
  return host || "Інший сайт";
}

function fmtDur(sec) {
  if (sec == null || !(sec >= 0)) return "";
  if (sec < 60) return `${Math.round(sec)} с`;
  if (sec < 3600) return `${Math.round(sec / 60)} хв`;
  return `${Math.floor(sec / 3600)} год ${Math.round((sec % 3600) / 60)} хв`;
}

const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : v);

// зсув від UTC зараз («GMT+03:00») — назви поясів різняться (Europe/Kiev у Chrome, Europe/Kyiv у Vercel)
function tzOffset(tz) {
  try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName")?.value || ""; } catch { return ""; }
}

// client — з браузера (visitorMeta), srv — із заголовків сервера (або null у браузері)
export function buildLeadMeta(client = {}, srv = null) {
  const d = client.device || {};
  const vis = client.visit || {};
  const first = client.first || null;
  const ua = srv?.ua || client.ua || "";
  const dev = { ...parseUA(ua, { touch: d.touch, platformVersion: d.platformVersion, model: d.model }), screen: clip(d.screen, 20), viewport: clip(d.viewport, 20), dpr: d.dpr, touch: d.touch, lang: clip(d.lang, 20), langs: Array.isArray(d.langs) ? d.langs.slice(0, 5) : undefined, tz: clip(d.tz, 60), net: clip(d.net, 10) };

  const geo = srv && srv.cc ? {
    cc: srv.cc, country: countryName(srv.cc), flag: flagOf(srv.cc),
    region: srv.cc === "UA" && UA_REGIONS[srv.region] ? UA_REGIONS[srv.region] + (["30", "40"].includes(srv.region) ? "" : " обл.") : clip(srv.region, 60),
    city: clip(srv.city, 80), tz: clip(srv.tz, 60), lat: srv.lat || undefined, lon: srv.lon || undefined, postal: clip(srv.postal, 12),
  } : null;

  const source = {
    now: sourceOf(vis.utm, vis.ref),
    first: first ? sourceOf(first.utm, first.ref) : undefined,
    utm: vis.utm || undefined, ref: clip(vis.ref, 300) || undefined,
    first_utm: first?.utm || undefined, first_ref: clip(first?.ref, 300) || undefined,
    landing: clip(vis.landing, 200), first_landing: clip(first?.landing, 200), first_at: first?.at, visits: first?.visits,
  };

  const flags = [];
  if (dev.bot) flags.push("схоже на бота");
  if (client.form_seconds != null && client.form_seconds < 2) flags.push(`форму заповнено за ${client.form_seconds} с — автозаповнення або бот`);
  if (geo?.tz && dev.tz && tzOffset(geo.tz) && tzOffset(dev.tz) && tzOffset(geo.tz) !== tzOffset(dev.tz)) flags.push(`часовий пояс пристрою ${dev.tz}, а IP — ${geo.tz} (можливо VPN)`);

  const pages = Array.isArray(vis.pages) ? vis.pages.slice(-30).map((p) => clip(String(p), 120)) : [];
  const visit = { pages, page_count: vis.page_count ?? pages.length, seconds: vis.seconds, form_seconds: client.form_seconds, page: clip(client.page?.path, 200), title: clip(client.page?.title, 150) };

  const devLine = [dev.type, dev.os, dev.model, dev.browser, dev.inapp && `у ${dev.inapp}`].filter(Boolean).join(", ");
  const summary = [
    geo ? `${geo.flag} ${[geo.country, geo.city || geo.region].filter(Boolean).join(", ")}`.trim() : "",
    devLine && `${dev.type === "Телефон" ? "📱" : dev.type === "Планшет" ? "📱" : "💻"} ${devLine}`,
    `Джерело: ${source.now}${source.first && source.first !== source.now ? ` (уперше — ${source.first})` : ""}`,
    [visit.page_count ? `${visit.page_count} стор.` : "", fmtDur(visit.seconds) && `${fmtDur(visit.seconds)} на сайті`, source.visits > 1 ? `${source.visits}-й візит` : ""].filter(Boolean).join(", "),
  ].filter(Boolean).join(" · ");

  return {
    v: 1, summary: summary.slice(0, 400), geo, ip: srv?.ip || undefined, device: dev, source, visit,
    form: client.form || undefined, flags: flags.length ? flags : undefined,
    ua: clip(ua, 400) || undefined, al: clip(srv?.al, 100) || undefined, at: srv?.at || new Date().toISOString(),
  };
}

export const durText = fmtDur;
