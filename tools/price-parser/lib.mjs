// Завантаження сторінок і дрібні помічники для розбору HTML (без залежностей).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const lastHit = new Map(); // хост → час останнього запиту
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Один запит на хост раз на `gap` мс, до 3 спроб (відмову 401/403 не повторюємо).
export async function getHtml(url, { gap = 900, timeout = 40000, tries = 3 } = {}) {
  const host = new URL(url).host;
  let err;
  for (let i = 0; i < tries; i++) {
    const wait = (lastHit.get(host) || 0) + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "uk-UA,uk;q=0.9",
        },
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(timeout),
      });
      if (res.status === 404) return { status: 404, html: "", url: res.url };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { status: res.status, html: await res.text(), url: res.url };
    } catch (e) {
      err = e;
      if (/HTTP 40[13]/.test(e.message)) break; // сайт не пускає — повтори не допоможуть
      await sleep(1500 * (i + 1));
    }
  }
  throw new Error(`${url}: ${err?.message || err}`);
}

const ENT = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", laquo: "«", raquo: "»", times: "×", ndash: "–", mdash: "—" };
export function decode(s) {
  return String(s ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

// HTML → текст в один рядок
export function text(html) {
  return decode(
    String(html ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export const num = (s) => {
  if (s == null) return null;
  const v = parseFloat(String(s).replace(/[\s ]/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

export const abs = (href, base) => {
  try {
    return new URL(decode(href), base).href;
  } catch {
    return null;
  }
};

export const first = (re, s, g = 1) => {
  const m = re.exec(s);
  return m ? m[g] : null;
};

// Розрізати сторінку на картки за маркером початку картки
export const cards = (html, marker) => html.split(marker).slice(1);

// Усі блоки JSON-LD зі сторінки
export function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const v = JSON.parse(m[1].trim());
      for (const x of Array.isArray(v) ? v : [v]) out.push(x);
    } catch {
      /* зламаний блок пропускаємо */
    }
  }
  return out;
}

export const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
