// Зіставлення товару магазину з матеріалом і перерахунок ціни «як продають» у ціну за одиницю матеріалу.
// Правило матеріалу (materials.parse_rule):
//   groups: ["lumber"]      — у яких групах джерел шукати
//   all: ["дошк|доск"]      — кожен вираз має знайтись у назві (регістр неважливий)
//   none: "терас|зрощ"      — жоден не має знайтись
//   norm: lumber | pack_m3 | roll_m2 | roll_mp | sheet_m2 | board_m2 | piece
//   a, b, type              — переріз і стан пиломатеріалу (fresh | dry | planed)
//   thickness               — товщина, мм (число або [від, до])
//   density                 — [від, до]: кг/м³ для вати, г/м² для плівок
//   cell_max                — найбільше вічко сітки, мм
//   per                     — ціна за стільки штук (напр. 1000 для скоб)
//   min, max                — межі правдоподібної ціни за одиницю (поза ними — не рахуємо)
//   agg: "min" | "median"   — що брати за ціну магазину

import { round } from "./lib.mjs";

// нижній регістр, «50 х 150» → «50x150», кома в числах → крапка
export function prep(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/(\d)\s*[xх×*]\s*(?=\d)/g, "$1x")
    .replace(/(\d),(?=\d)/g, "$1.")
    .replace(/(\d), (\d{1,2})(?=\s*(?:x|мм|см|м(?![а-яіїє])))/g, "$1.$2") // «1, 5x50 м»
    .replace(/\s+/g, " ")
    .trim();
}

const N = "(\\d+(?:\\.\\d+)?)";
const toM = (v, u) => (u === "мм" ? v / 1000 : u === "см" ? v / 100 : v);
const inRange = (v, r) => r == null || v == null || (Array.isArray(r) ? v >= r[0] && v <= r[1] : Math.abs(v - r) < 0.61);

// значення характеристики з картки списку: «2 м» / «3000 мм» / «30»
function propLen(props, keys) {
  for (const k of keys) {
    const raw = props?.[k];
    if (!raw) continue;
    const m = new RegExp(`${N}\\s*(мм|см|м)?`).exec(prep(raw));
    if (!m) continue;
    const v = +m[1];
    return m[2] ? toM(v, m[2]) * 1000 : v < 20 ? v * 1000 : v; // → мм
  }
  return null;
}

function unitOf(item, t) {
  const u = prep(`${item.unit || ""} ${item.unitHint || ""}`);
  if (/м3|м³|куб/.test(u)) return "м³";
  if (/м2|м²|кв/.test(u)) return "м²";
  if (/м\.?\s?п|пог/.test(u)) return "м.п.";
  if (/рул/.test(u)) return "рулон";
  if (/уп|пач|пак/.test(u)) return "уп";
  if (/лист/.test(u)) return "лист";
  if (/шт/.test(u)) return "шт";
  if (/пар/.test(u)) return "пара";
  if (/(^|[^а-яіїє])м([^а-яіїє0-9]|$)/.test(u)) return "м.п.";
  // одиниця в дужках наприкінці назви: «… 1x30 м оцинкована (кв. м)», «… 1.5x50 м (рул)»
  const tail = /\((кв\. ?м|м2|м²|рул|рулон|шт|уп|упак|лист|м\. ?п\.?|пог\. ?м)\)\s*$/.exec(t)?.[1];
  if (tail) return /кв|м2|м²/.test(tail) ? "м²" : /рул/.test(tail) ? "рулон" : /уп/.test(tail) ? "уп" : /п/.test(tail) ? "м.п." : tail;
  if (/(ціна|цена) за (1 )?(м2|м²|м\.? ?кв)/.test(t)) return "м²";
  if (/(ціна|цена) за (1 )?(м3|м³|куб)/.test(t)) return "м³";
  return null;
}

// ── пиломатеріали ──────────────────────────────────────────────────────────
function lumber(item, rule, t, page) {
  const d = /(\d{2,3})x(\d{2,3})(?:x(\d{3,5}))?/.exec(t);
  let a = d ? +d[1] : propLen(item.props, ["товщина", "толщина", "висота", "высота"]);
  let b = d ? +d[2] : propLen(item.props, ["ширина"]);
  if (!a || !b) return null;
  if ([a, b].sort((x, y) => x - y).join("x") !== [rule.a, rule.b].sort((x, y) => x - y).join("x")) return null;

  const kind = `${t} ${prep(item.props?.["вид"] || "")} ${prep(item.props?.["обробка"] || "")}`;
  const unplaned = /не\s?струган|не\s?строган/.test(kind);
  const stated = !unplaned && /струган|строган|калібр|калибр/.test(kind) ? "planed"
    : /сух|сушен|камерн/.test(kind) ? "dry"
    : /свіжопил|свежепил|свежий пил|природн\S* волог|естественн\S* влажн/.test(kind) ? "fresh" : null;
  // не сказано — як заведено в цього магазину; «нестругана» в будмаркеті (де звичайно стругана) — суха нестругана
  const type = stated || (unplaned && item.lumberDefault === "planed" ? "dry" : item.lumberDefault) || "fresh";
  if (rule.type && rule.type !== type) return null;

  let L = d?.[3] ? +d[3] : null; // мм
  if (!L) {
    const m = new RegExp(`(?:^|[\\s(,])${N}\\s*м(?:\\b|\\))(?!м|\\.?п|2|3|²|³)`).exec(t) || /l\s*=\s*(\d{3,5})/.exec(t);
    if (m) L = +m[1] < 20 ? +m[1] * 1000 : +m[1];
  }
  if (!L) L = propLen(item.props, ["довжина", "длина"]) || page?.length_mm || null;
  if (L && (L < 500 || L > 13000)) L = null;

  const sec = (a * b) / 1e6; // м² перерізу
  const ok = (p) => p >= (rule.min ?? 4000) && p <= (rule.max ?? 80000);
  const unit = unitOf(item, t);
  const hint = new RegExp(`за\\s*${N}?\\s*м(?!2|3|²|³|м)`).exec(prep(item.unitHint || ""));
  let m3 = null, sale = unit, guess = false;

  if (item.perUnit?.price && /м\.?п/.test(prep(item.perUnit.unit))) { m3 = item.perUnit.price / sec; sale = "шт"; }
  else if (hint) { m3 = item.price / (+(hint[1] || 1)) / sec; sale = hint[1] && +hint[1] !== 1 ? "шт" : "м.п."; }
  else if (unit === "м³") m3 = item.price;
  else if (unit === "м.п.") m3 = item.price / sec;
  else if (unit === "шт" && L) m3 = item.price / (sec * L / 1000);
  else {
    // магазин не підписав одиницю: беремо те тлумачення, що дає правдоподібну ціну куба
    guess = true;
    const tries = [L ? ["шт", item.price / (sec * L / 1000)] : null, ["м.п.", item.price / sec], ["м³", item.price]].filter(Boolean);
    const hit = tries.find(([, p]) => ok(p));
    if (hit) [sale, m3] = hit;
  }
  if (m3 != null && !ok(m3)) m3 = null;

  const prices = m3 == null ? {} : { "м³": round(m3), "м.п.": round(m3 * sec) };
  if (m3 != null && L) prices["шт"] = round(m3 * sec * L / 1000);
  return {
    unit_price: round(m3),
    sale_unit: sale,
    unit_prices: prices,
    attrs: { size: `${a}×${b}`, length_mm: L, type, ...(stated ? {} : { type_guess: true }), ...(guess ? { unit_guess: true } : {}) },
  };
}

// ── утеплювач в упаковках → м³ ─────────────────────────────────────────────
function packM3(item, rule, t, page) {
  const tri = /(\d{2,4})x(\d{2,4})x(\d{2,4})/.exec(t);
  const pair = /(\d{3,4})x(\d{3,4})(?!x)/.exec(t);
  let th = null, L = null, W = null;
  if (tri) {
    const v = [+tri[1], +tri[2], +tri[3]].sort((x, y) => x - y);
    [th, W, L] = v;
  } else if (pair) {
    [W, L] = [+pair[1], +pair[2]].sort((x, y) => x - y);
  }
  if (!th || th > 300) {
    const m = new RegExp(`(?:^|[^\\dx.])(\\d{2,3})\\s*мм`).exec(t);
    th = m ? +m[1] : propLen(item.props, ["товщина", "толщина"]) || page?.thickness_mm || null;
  }
  if (!th || th > 300) return null;
  if (!inRange(th, rule.thickness)) return null;

  // щільність: «35 кг/м³» або число в назві марки («Izovat 30», «базальтовий 135»)
  const dens = +(new RegExp(`${N}\\s*кг\\s*\\/?\\s*м`).exec(t)?.[1] || 0)
    || +(/(?:izovat|ізоват|изоват|novoterm|новотерм|базальтов\S*|\bls)\s*(\d{2,3})(?![\dx.]|\s*мм|\s*шт)/.exec(t)?.[1] || 0)
    || page?.density || null;
  if (dens && rule.density && !inRange(dens, rule.density)) return null;

  let m2 = +(new RegExp(`${N}\\s*(?:м2|м²|м\\.?\\s?кв|кв\\.?\\s?м)`).exec(t)?.[1] || 0) || page?.pack_m2 || null;
  let m3 = +(new RegExp(`${N}\\s*(?:м3|м³|куб)`).exec(t)?.[1] || 0) || page?.pack_m3 || null;
  const qty = +(new RegExp(`(\\d{1,3})\\s*(?:шт|плит|лист)`).exec(t)?.[1] || 0) || page?.pack_qty || null;
  if (!L && page?.length_mm && page?.width_mm) [L, W] = [page.length_mm, page.width_mm];
  if (!m2 && qty && L && W) m2 = (qty * L * W) / 1e6;
  if (!m3 && m2) m3 = (m2 * th) / 1000;

  const unit = unitOf(item, t);
  let p3 = null, sale = "уп";
  if (unit === "м³") { p3 = item.price; sale = "м³"; }
  else if (unit === "м²") { p3 = item.price / (th / 1000); sale = "м²"; }
  else if (m3) p3 = item.price / m3;
  if (p3 != null && (p3 < (rule.min ?? 500) || p3 > (rule.max ?? 15000))) p3 = null;

  const prices = p3 == null ? {} : { "м³": round(p3), "м²": round((p3 * th) / 1000) };
  if (p3 != null && sale === "уп") prices["уп"] = item.price;
  return {
    unit_price: round(p3),
    sale_unit: sale,
    unit_prices: prices,
    attrs: { thickness_mm: th, slab: L && W ? `${L}×${W}` : null, pack_m2: round(m2, 3), pack_m3: round(m3, 4), pack_qty: qty, density: dens },
  };
}

const flags = (t) => ({
  ...(/фольг|алюмін|алюмин|металіз|метализ/.test(t) ? { foil: true } : {}),
  ...(/армов|армир/.test(t) ? { reinforced: true } : {}),
});

// ── рулони → м² (мембрани, паробарʼєр, ПВХ, геотекстиль, сітка) ────────────
function rollM2(item, rule, t, page) {
  let s = t;
  let cell = null;
  if (rule.cell_max != null) {
    const c = new RegExp(`${N}x${N}(?:x${N})?\\s*мм`).exec(s) || new RegExp(`(?:вічк|ячейк|комірк)\\D{0,12}${N}(?:x${N})?`).exec(s);
    if (c) {
      // «6x6x0.6» чи «0.7x12x25»: третє число — товщина дроту, вічко — два більші
      const v = [c[1], c[2], c[3]].filter((x) => x != null).map(Number).sort((x, y) => y - x);
      cell = v[0];
      s = s.replace(c[0], " ");
    }
    if (cell == null || cell > rule.cell_max) return null;
  }
  const dens = +(new RegExp(`${N}\\s*(?:г|гр)\\s*\\/\\s*(?:м|кв)`).exec(s)?.[1] || 0) || page?.density || null;
  if (dens && rule.density && !inRange(dens, rule.density)) return null;
  const th = +(new RegExp(`${N}\\s*мм`).exec(s)?.[1] || 0) || null;
  if (rule.thickness != null && !(th && inRange(th, rule.thickness))) return null;

  let m2 = +(new RegExp(`${N}\\s*(?:м2|м²|м\\.\\s?кв|кв\\.?\\s?м|м кв)`).exec(s)?.[1] || 0) || null;
  let W = null, L = null;
  const d = new RegExp(`${N}\\s*(мм|см|м)?\\s*x\\s*${N}\\s*(мм|см|м)(?!м)`).exec(s.replace(/(\d)x(\d)/g, "$1 x $2"));
  if (d) { W = toM(+d[1], d[2] || d[4]); L = toM(+d[3], d[4]); }
  if (!m2 && W && L && W * L >= 1) m2 = W * L;
  if (!m2) m2 = page?.pack_m2 || (page?.length_mm && page?.width_mm ? (page.length_mm * page.width_mm) / 1e6 : null);

  const unit = unitOf(item, t);
  let p = null, sale = "рулон";
  if (unit === "м²" || (unit === "м.п." && W)) { p = unit === "м²" ? item.price : item.price / W; sale = unit; }
  else if (m2) p = item.price / m2;
  if (p != null && (p < (rule.min ?? 3) || p > (rule.max ?? 2000))) p = null;

  const prices = p == null ? {} : { "м²": round(p) };
  if (p != null && sale === "рулон") prices["рулон"] = item.price;
  return {
    unit_price: round(p),
    sale_unit: sale,
    unit_prices: prices,
    attrs: { roll_m2: round(m2, 2), width_m: W, length_m: L, density_gsm: dens, thickness_mm: th, cell_mm: cell, ...flags(t) },
  };
}

// ── стрічки й скотчі → м.п. ────────────────────────────────────────────────
function rollMp(item, rule, t, page) {
  let W = null, L = null;
  let m = new RegExp(`${N}\\s*мм\\s*x\\s*${N}\\s*м(?!м)`).exec(t.replace(/(\d)x(\d)/g, "$1 x $2").replace(/(мм)\s*x/g, "$1 x"));
  if (m) { W = +m[1]; L = +m[2]; }
  if (!L) {
    m = new RegExp(`${N}\\s*м\\s*x\\s*${N}\\s*мм`).exec(t.replace(/(\d)x(\d)/g, "$1 x $2"));
    if (m) { L = +m[1]; W = +m[2]; }
  }
  if (!L) {
    m = new RegExp(`${N}x${N}`).exec(t); // «50x25» — ширина мм × довжина м
    if (m && +m[2] <= 150 && +m[1] >= 10) { W = +m[1]; L = +m[2]; }
    else if (m && +m[1] <= 150 && +m[2] >= 10 && /мм/.test(t)) { L = +m[1]; W = +m[2]; }
  }
  if (!L) {
    m = new RegExp(`${N}\\s*м(?:\\.?\\s?п\\.?)?(?![а-яіїє²2³3])`).exec(t);
    if (m) L = +m[1];
    const w = new RegExp(`${N}\\s*мм`).exec(t);
    if (w) W = +w[1];
  }
  if (!L && page?.length_mm) L = page.length_mm / 1000;
  if (!W && page?.width_mm) W = page.width_mm;
  if (L && (L < 2 || L > 500)) L = null;

  const unit = unitOf(item, t);
  let p = unit === "м.п." && !L ? item.price : L ? item.price / L : null;
  if (p != null && (p < (rule.min ?? 0.5) || p > (rule.max ?? 500))) p = null;
  return {
    unit_price: round(p),
    sale_unit: unit === "м.п." && !L ? "м.п." : "рулон",
    unit_prices: p == null ? {} : { "м.п.": round(p), ...(L ? { "рулон": item.price } : {}) },
    attrs: { width_mm: W, length_m: L, ...flags(t) },
  };
}

// ── листи → м² (OSB, фанера, гіпсокартон) ──────────────────────────────────
function sheetM2(item, rule, t, page) {
  let th = null, L = null, W = null;
  const tri = new RegExp(`${N}x${N}x${N}`).exec(t);
  const pair = /(\d{3,4})x(\d{3,4})/.exec(t);
  if (tri) {
    const v = [+tri[1], +tri[2], +tri[3]].sort((x, y) => x - y);
    [th, W, L] = v;
  } else if (pair) [W, L] = [+pair[1], +pair[2]].sort((x, y) => x - y);
  if (!th || th > 60) {
    const m = new RegExp(`(?:^|[^\\dx.])${N}\\s*мм`).exec(t);
    th = m && +m[1] <= 60 ? +m[1] : propLen(item.props, ["товщина", "толщина"]) || page?.thickness_mm || null;
  }
  if (rule.thickness != null && !(th && inRange(th, rule.thickness))) return null;
  if (!L && page?.length_mm && page?.width_mm) [W, L] = [page.width_mm, page.length_mm].sort((x, y) => x - y);
  if (L && L < 100) { L *= 1000; W *= 1000; } // розміри в метрах

  const area = L && W ? (L * W) / 1e6 : null;
  const unit = unitOf(item, t);
  let p = unit === "м²" ? item.price : area ? item.price / area : null;
  if (p != null && (p < (rule.min ?? 30) || p > (rule.max ?? 5000))) p = null;
  return {
    unit_price: round(p),
    sale_unit: unit === "м²" ? "м²" : "лист",
    unit_prices: p == null ? {} : { "м²": round(p), ...(area ? { "лист": round(p * area) } : {}) },
    attrs: { thickness_mm: th, sheet: L && W ? `${L}×${W}` : null, sheet_m2: round(area, 3) },
  };
}

// ── погонаж для обшивки → м² (імітація бруса, планкен, вагонка) ────────────
function boardM2(item, rule, t, page) {
  let th = null, W = null, L = null;
  const tri = new RegExp(`${N}x${N}x${N}`).exec(t);
  const pair = new RegExp(`${N}x${N}`).exec(t);
  if (tri) [th, W, L] = [+tri[1], +tri[2], +tri[3]].sort((x, y) => x - y);
  else if (pair) [th, W] = [+pair[1], +pair[2]].sort((x, y) => x - y);
  th = th || propLen(item.props, ["товщина", "толщина"]);
  W = W || propLen(item.props, ["ширина"]) || page?.width_mm || null;
  if (!L) {
    const m = new RegExp(`(?:^|[\\s(,])${N}\\s*м(?:\\b|\\))(?!м|\\.?п|2|²)`).exec(t);
    L = m ? (+m[1] < 20 ? +m[1] * 1000 : +m[1]) : propLen(item.props, ["довжина", "длина"]) || page?.length_mm || null;
  }
  if (L && L < 20) L *= 1000;
  if (rule.thickness != null && !(th && inRange(th, rule.thickness))) return null;

  const qty = +(new RegExp(`(\\d{1,3})\\s*шт`).exec(t)?.[1] || 0) || 1;
  const packM2 = +(new RegExp(`${N}\\s*(?:м2|м²|м\\.\\s?кв|кв\\.?\\s?м)`).exec(t)?.[1] || 0) || page?.pack_m2 || null;
  const unit = unitOf(item, t);
  let p = null, sale = unit || "шт";
  if (unit === "м²") p = item.price;
  else if (unit === "м.п." && W) p = item.price / (W / 1000);
  else if (packM2) { p = item.price / packM2; sale = "уп"; }
  else if (W && L) p = item.price / ((qty * W * L) / 1e6);
  if (p != null && (p < (rule.min ?? 80) || p > (rule.max ?? 6000))) p = null;
  return {
    unit_price: round(p),
    sale_unit: sale,
    unit_prices: p == null ? {} : { "м²": round(p), ...(W ? { "м.п.": round((p * W) / 1000) } : {}) },
    attrs: { thickness_mm: th, width_mm: W, length_mm: L, pack_m2: packM2 },
  };
}

// ── штучне й фасоване ──────────────────────────────────────────────────────
function piece(item, rule, t) {
  const all = [...t.matchAll(/(\d[\d ]{0,6})\s*(?:шт|пар)/g)].map((m) => +m[1].replace(/\s/g, "")).filter((v) => v > 0);
  const kilo = /(\d+)\s*тис/.exec(t);
  const qty = kilo ? +kilo[1] * 1000 : all.length ? Math.max(...all) : 1;
  let p = (item.price / qty) * (rule.per || 1);
  if (p < (rule.min ?? 0) || p > (rule.max ?? Infinity)) p = null;
  const size = /(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/.exec(t);
  return {
    unit_price: round(p),
    sale_unit: qty > 1 ? "уп" : "шт",
    unit_prices: p == null ? {} : { [rule.per > 1 ? `${rule.per} шт` : "шт"]: round(p), ...(qty > 1 ? { "уп": item.price } : {}) },
    attrs: { pack_qty: qty, size: size ? `${size[1]}×${size[2]}` : null },
  };
}

const NORMS = { lumber, pack_m3: packM3, roll_m2: rollM2, roll_mp: rollMp, sheet_m2: sheetM2, board_m2: boardM2, piece };

const reCache = new Map();
const re = (s) => reCache.get(s) || reCache.set(s, new RegExp(s, "i")).get(s);

// item + правило → пропозиція або null, якщо товар не про цей матеріал
export function match(item, rule, page) {
  const t = prep(item.title);
  if (rule.all && !rule.all.every((p) => re(p).test(t))) return null;
  if (rule.none && re(rule.none).test(t)) return null;
  const fn = NORMS[rule.norm];
  if (!fn) return null;
  const r = fn(item, rule, t, page);
  if (!r) return null;
  for (const k of Object.keys(r.attrs)) if (r.attrs[k] == null) delete r.attrs[k];
  return r;
}

// Сторінка товару → характеристики, яких бракує в назві (площа рулону, штук в упаковці …)
export function pageFacts(txt) {
  const t = prep(txt);
  const f = {};
  const g = (pattern) => new RegExp(pattern).exec(t);
  let m;
  if ((m = g(`площа[^.\\d]{0,40}?${N}\\s*(?:м2|м²|м\\.?\\s?кв|кв)`))) f.pack_m2 = +m[1];
  if ((m = g(`об.?[єе]м[^.\\d]{0,40}?${N}\\s*(?:м3|м³|куб)`))) f.pack_m3 = +m[1];
  if ((m = g(`(?:кількість|количество|к-ть)[^.\\d]{0,40}?(\\d{1,4})\\s*(?:шт|$|[^\\d.])`))) f.pack_qty = +m[1];
  if ((m = g(`(?:довжина|длина)[^.\\d]{0,25}?${N}\\s*(мм|см|м)`))) f.length_mm = toM(+m[1], m[2]) * 1000;
  if ((m = g(`ширина[^.\\d]{0,25}?${N}\\s*(мм|см|м)`))) f.width_mm = toM(+m[1], m[2]) * 1000;
  if ((m = g(`(?:товщина|толщина)[^.\\d]{0,25}?${N}\\s*(мм|см)`))) f.thickness_mm = toM(+m[1], m[2]) * 1000;
  if ((m = g(`(?:щільність|плотность)[^.\\d]{0,30}?${N}`))) f.density = +m[1];
  return f;
}

