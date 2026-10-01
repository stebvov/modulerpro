// Ринкові ціни (парсер сайтів будматеріалів): підписи й перетворення правила відстеження.
// Саме правило читає скрипт tools/price-parser (normalize.mjs) — поля тут і там мають збігатися.

export const NORMS = [
  { id: "lumber", label: "Пиломатеріал (дошка, брус) → ціна за м³", unit: "м³" },
  { id: "pack_m3", label: "Утеплювач в упаковках → ціна за м³", unit: "м³" },
  { id: "roll_m2", label: "Рулон (плівка, мембрана, сітка) → ціна за м²", unit: "м²" },
  { id: "roll_mp", label: "Стрічка, скотч → ціна за м.п.", unit: "м.п." },
  { id: "sheet_m2", label: "Лист (OSB, фанера, гіпсокартон) → ціна за м²", unit: "м²" },
  { id: "board_m2", label: "Обшивка (імітація бруса, планкен) → ціна за м²", unit: "м²" },
  { id: "piece", label: "Штучний або фасований товар → ціна за штуку", unit: "шт" },
];

export const GROUP_LABELS = {
  lumber: "Пиломатеріали",
  wool: "Мінеральна вата",
  membrane: "Плівки й мембрани",
  tape: "Стрічки й скотч",
  osb: "OSB",
  plywood: "Фанера",
  drywall: "Гіпсокартон",
  cladding: "Вагонка, імітація бруса, планкен",
  roof_pvc: "Гідроізоляція, ПВХ мембрани",
  geotextile: "Геотекстиль",
  staples: "Скоби",
  nails: "Цвяхи",
  screws: "Шурупи й саморізи",
  gloves: "Рукавиці",
  pencil: "Олівці",
  brush: "Пензлі й макловиці",
  mesh: "Сітки",
};
export const groupLabel = (g) => GROUP_LABELS[g] || g;

export const LUMBER_TYPES = [
  { id: "", label: "будь-який" },
  { id: "fresh", label: "свіжопиляна" },
  { id: "dry", label: "суха" },
  { id: "planed", label: "суха калібрована (стругана)" },
];

const numOrNull = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const range = (lo, hi) => {
  const a = numOrNull(lo), b = numOrNull(hi);
  if (a == null && b == null) return undefined;
  if (a != null && b != null && a !== b) return [a, b];
  return a ?? b;
};

export function ruleToForm(rule) {
  const r = rule || {};
  const pair = (v) => (Array.isArray(v) ? [v[0], v[1]] : v != null ? [v, v] : ["", ""]);
  const [thLo, thHi] = pair(r.thickness);
  const [dLo, dHi] = pair(r.density);
  return {
    norm: r.norm || "piece",
    groups: r.groups || [],
    all: (r.all || []).join("\n"),
    none: r.none || "",
    a: r.a ?? "", b: r.b ?? "", type: r.type || "",
    thLo, thHi, dLo, dHi,
    cellMax: r.cell_max ?? "",
    per: r.per ?? "",
    agg: r.agg || "min",
    min: r.min ?? "", max: r.max ?? "",
  };
}

export function formToRule(f) {
  const rule = { groups: f.groups, norm: f.norm };
  const all = f.all.split("\n").map((s) => s.trim()).filter(Boolean);
  if (all.length) rule.all = all;
  if (f.none.trim()) rule.none = f.none.trim();
  if (f.norm === "lumber") {
    rule.a = numOrNull(f.a);
    rule.b = numOrNull(f.b);
    if (f.type) rule.type = f.type;
  }
  if (["pack_m3", "roll_m2", "sheet_m2", "board_m2"].includes(f.norm)) {
    const th = range(f.thLo, f.thHi);
    if (th !== undefined) rule.thickness = th;
  }
  if (["pack_m3", "roll_m2"].includes(f.norm)) {
    const lo = numOrNull(f.dLo), hi = numOrNull(f.dHi);
    if (lo != null || hi != null) rule.density = [lo ?? 0, hi ?? 100000];
  }
  if (f.norm === "roll_m2" && numOrNull(f.cellMax) != null) rule.cell_max = numOrNull(f.cellMax);
  if (f.norm === "piece" && numOrNull(f.per) > 1) rule.per = numOrNull(f.per);
  if (f.agg === "median") rule.agg = "median";
  if (numOrNull(f.min) != null) rule.min = numOrNull(f.min);
  if (numOrNull(f.max) != null) rule.max = numOrNull(f.max);
  return rule;
}

// Перевірка правила перед збереженням: текст помилки або null
export function ruleError(f) {
  if (!f.groups.length) return "Обери, в яких групах джерел шукати товар.";
  if (f.norm === "lumber" && !(Number(f.a) > 0 && Number(f.b) > 0)) return "Вкажи переріз пиломатеріалу (мм).";
  for (const s of [...f.all.split("\n"), f.none]) {
    if (!s.trim()) continue;
    try {
      new RegExp(s.trim(), "i");
    } catch {
      return `Не можу прочитати вираз «${s.trim()}» — прибери зайві дужки чи символи.`;
    }
  }
  return null;
}

const TYPE_LABEL = { fresh: "свіжопиляна", dry: "суха", planed: "стругана" };
const n = (v, d = 2) => Number(v).toLocaleString("uk-UA", { maximumFractionDigits: d });

// Характеристики пропозиції → короткі підписи
export function attrChips(a = {}) {
  const out = [];
  if (a.size) out.push(a.size);
  if (a.length_mm) out.push(`довж. ${n(a.length_mm / 1000)} м`);
  if (a.type) out.push(TYPE_LABEL[a.type] || a.type);
  if (a.thickness_mm) out.push(`${n(a.thickness_mm)} мм`);
  if (a.slab) out.push(`плита ${a.slab}`);
  if (a.sheet) out.push(`лист ${a.sheet}`);
  if (a.width_mm) out.push(`шир. ${n(a.width_mm)} мм`);
  if (a.width_m) out.push(`шир. ${n(a.width_m)} м`);
  if (a.length_m) out.push(`довж. ${n(a.length_m)} м`);
  if (a.roll_m2) out.push(`рулон ${n(a.roll_m2)} м²`);
  if (a.pack_m2) out.push(`уп. ${n(a.pack_m2)} м²`);
  if (a.pack_m3) out.push(`уп. ${n(a.pack_m3, 3)} м³`);
  if (a.pack_qty > 1) out.push(`${n(a.pack_qty)} шт в уп.`);
  if (a.density) out.push(`${n(a.density)} кг/м³`);
  if (a.density_gsm) out.push(`${n(a.density_gsm)} г/м²`);
  if (a.cell_mm) out.push(`вічко ${n(a.cell_mm)} мм`);
  if (a.foil) out.push("фольгована");
  if (a.reinforced) out.push("армована");
  if (a.type_guess) out.push("стан не вказано");
  if (a.unit_guess) out.push("одиницю визначено за ціною");
  return out;
}

export const fmtPrice = (v, d = 2) => (v == null ? "—" : n(v, d));
