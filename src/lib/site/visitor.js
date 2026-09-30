// Відвідувач сайту (лише в його браузері): перший захід і поточний візит — джерело, сторінка входу, переглянуті сторінки.
// Нікуди не відправляється, доки людина сама не надішле заявку, — тоді йде разом із нею (visitorMeta).
const VK = "moduler_visitor"; // localStorage: перший захід, кількість візитів
const SK = "moduler_visit"; // sessionStorage: поточний візит
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid", "fbclid", "ttclid"];

const read = (st, k) => { try { return JSON.parse(st.getItem(k) || "null"); } catch { return null; } };
const write = (st, k, v) => { try { st.setItem(k, JSON.stringify(v)); } catch { /* приватний режим */ } };

function utmFrom(search) {
  const q = new URLSearchParams(search);
  const o = {};
  UTM_KEYS.forEach((k) => { const v = q.get(k); if (v) o[k] = v.slice(0, 150); });
  return Object.keys(o).length ? o : null;
}

function externalReferrer() {
  try {
    const r = document.referrer;
    if (!r || new URL(r).host === location.host) return "";
    return r.slice(0, 300);
  } catch { return ""; }
}

// кожен перегляд сторінки (і при переходах усередині сайту)
export function trackVisit(path) {
  if (typeof window === "undefined") return;
  const now = new Date().toISOString();
  const utm = utmFrom(location.search);
  let s = read(sessionStorage, SK);
  if (!s) {
    s = { start: now, landing: path, ref: externalReferrer(), utm, pages: [] };
    const v = read(localStorage, VK) || { at: now, landing: path, ref: s.ref, utm, visits: 0 };
    v.visits = (v.visits || 0) + 1;
    v.last = now;
    write(localStorage, VK, v);
  } else if (utm) {
    s.utm = utm; // повернувся з нової реклами в тому ж візиті
  }
  const last = s.pages[s.pages.length - 1];
  if (!last || last.p !== path) s.pages.push({ p: path, t: now });
  s.pages = s.pages.slice(-40);
  write(sessionStorage, SK, s);
}

// дані для заявки: візит, перший захід, пристрій (+ модель телефону з Client Hints, якщо браузер дає)
export async function visitorMeta({ formStartedAt, form } = {}) {
  const s = read(sessionStorage, SK) || {};
  const v = read(localStorage, VK);
  const nav = navigator;
  const scr = window.screen || {};
  let hints = {};
  try {
    if (nav.userAgentData?.getHighEntropyValues) {
      hints = await Promise.race([
        nav.userAgentData.getHighEntropyValues(["model", "platformVersion"]),
        new Promise((r) => setTimeout(() => r({}), 400)),
      ]);
    }
  } catch { /* браузер не дає */ }
  const now = Date.now();
  return {
    visit: {
      start: s.start, landing: s.landing, ref: s.ref, utm: s.utm,
      pages: (s.pages || []).map((x) => x.p), page_count: (s.pages || []).length,
      seconds: s.start ? Math.round((now - Date.parse(s.start)) / 1000) : null,
    },
    first: v ? { at: v.at, landing: v.landing, ref: v.ref, utm: v.utm, visits: v.visits } : null,
    page: { path: location.pathname, title: document.title },
    form,
    form_seconds: formStartedAt ? Math.round((now - formStartedAt) / 1000) : null,
    ua: nav.userAgent,
    device: {
      screen: scr.width ? `${scr.width}×${scr.height}` : "", viewport: `${window.innerWidth}×${window.innerHeight}`,
      dpr: window.devicePixelRatio, touch: nav.maxTouchPoints || 0,
      lang: nav.language, langs: (nav.languages || []).slice(0, 5),
      tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } })(),
      net: nav.connection?.effectiveType || "",
      model: hints.model || "", platformVersion: hints.platformVersion || "",
    },
  };
}
