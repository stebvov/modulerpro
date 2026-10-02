// Пошук по вмісту сайту в конструкторі: слова запиту шукаємо за основою,
// тож «Нові Петрівці» знайде й «у Нових Петрівцях», а «будинок» — «будинки» й «будинків».

const norm = (s) => String(s).toLowerCase().replace(/[  ]/g, " ").replace(/\*/g, "").replace(/[’ʼ`]/g, "'");

export function queryStems(q) {
  return norm(q).split(/[\s,.;:!?«»"()]+/).filter((w) => w.length > 1)
    .map((w) => (w.length >= 6 ? w.slice(0, -2) : w.length >= 4 ? w.slice(0, -1) : w));
}

// поля, у яких немає тексту для людини: адреси фото, технічні позначки
const SKIP = new Set(["id", "type", "theme", "variant", "image", "image_morning", "image_evening", "image_night", "images", "photos", "plans", "plan_image", "photo", "icon", "hidden",
  "columns", "side", "anchor", "layout", "kind", "kinds", "pipeline", "template_id", "currency", "sort", "updated_at", "created_at", "published_at", "og_image", "photo_captions",
  "captions", "logo", "video", "fit", "size_group", "published", "popular", "draft"]);

// усі текстові значення запису чи блоку (вкладені списки теж)
export function textsOf(v, out = [], key = "") {
  if (typeof v === "string") {
    if (v.trim() && !SKIP.has(key)) out.push(v);
  } else if (Array.isArray(v)) {
    v.forEach((x) => textsOf(x, out, key));
  } else if (v && typeof v === "object") {
    for (const k in v) if (!SKIP.has(k)) textsOf(v[k], out, k);
  }
  return out;
}

// перший текст, де є всі слова запиту → уривок навколо збігу: { before, hit, after }
export function findIn(texts, stems) {
  if (!stems.length) return null;
  for (const t of texts) {
    const low = norm(t);
    if (!stems.every((s) => low.includes(s))) continue;
    const at = low.indexOf(stems[0]);
    // до кінця слова, щоб підсвітити його цілим
    let end = at + stems[0].length;
    while (end < low.length && /[\p{L}\p{N}'-]/u.test(low[end])) end++;
    const clean = String(t).replace(/[  ]/g, " ").replace(/\*/g, "");
    const same = clean.length === low.length; // позиції збігаються, якщо нормалізація не змінила довжину
    const src = same ? clean : low;
    const from = Math.max(0, at - 45), to = Math.min(src.length, end + 70);
    return { before: (from ? "…" : "") + src.slice(from, at), hit: src.slice(at, end), after: src.slice(end, to) + (to < src.length ? "…" : "") };
  }
  return null;
}
