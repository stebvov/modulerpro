export const CANONICAL_MODEL_VERSION = "1.0";

const FINISH_FACTORS = { Базове: 0.92, Стандарт: 1, Преміум: 1.18 };

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildCanonicalHouseModel(brief) {
  const width = Math.max(2, n(brief.width, 6));
  const length = Math.max(2, n(brief.length, 6));
  const height = Math.max(2, n(brief.height, 2.7));
  const bedrooms = Math.max(1, Math.round(n(brief.bedrooms, 1)));
  const bathrooms = Math.max(1, Math.round(n(brief.bathrooms, 1)));
  const area = width * length;
  const livingWidth = width * 0.58;
  const serviceWidth = width - livingWidth;
  const bathDepth = length * 0.34;
  const remaining = length - bathDepth;
  const bedroomDepth = remaining / bedrooms;

  const rooms = [
    { id: "living", type: "living_kitchen", name: "Кухня-вітальня", x: 0, y: 0, width: livingWidth, length, area: livingWidth * length },
    { id: "bath", type: "bathroom", name: bathrooms > 1 ? "Санвузли" : "Санвузол", x: livingWidth, y: 0, width: serviceWidth, length: bathDepth, area: serviceWidth * bathDepth },
  ];

  for (let i = 0; i < bedrooms; i += 1) {
    rooms.push({
      id: `bedroom-${i + 1}`,
      type: "bedroom",
      name: `Спальня ${i + 1}`,
      x: livingWidth,
      y: bathDepth + bedroomDepth * i,
      width: serviceWidth,
      length: bedroomDepth,
      area: serviceWidth * bedroomDepth,
    });
  }

  return {
    schema: "moduler.canonical.house",
    version: CANONICAL_MODEL_VERSION,
    source: "rule_based_v1",
    status: "concept",
    dimensions: { width, length, height, area },
    program: {
      purpose: brief.type,
      people: Math.max(1, Math.round(n(brief.people, 2))),
      bedrooms,
      bathrooms,
      finish: brief.finish,
      terrace: Boolean(brief.terrace),
      panoramic: Boolean(brief.panoramic),
      budget: n(brief.budget),
    },
    rooms,
    openings: {
      doors: [{ id: "entry", type: "entry", side: "south", offset: width * 0.42 }],
      windows: [
        { id: "living-south-1", room: "living", side: "south", offset: width * 0.12, width: width * 0.2, panoramic: Boolean(brief.panoramic) },
        { id: "living-south-2", room: "living", side: "south", offset: width * 0.68, width: width * 0.2, panoramic: Boolean(brief.panoramic) },
        { id: "living-west", room: "living", side: "west", offset: length * 0.35, width: length * 0.25 },
        ...rooms.filter((r) => r.type === "bedroom").map((r, i) => ({ id: `bed-window-${i + 1}`, room: r.id, side: "east", offset: r.length * 0.25, width: Math.min(1.5, r.length * 0.3) })),
      ],
    },
    zones: {
      terrace: Boolean(brief.terrace) ? { side: "south", width, depth: 2.5, area: width * 2.5 } : null,
    },
    constraints: [],
    decisions: [
      { rule: "MODULE_RECTANGULAR_V1", status: "approved", confidence: 0.95, source: "Moduler Pro ТЗ 2.0" },
      { rule: "STRUCTURAL_DESIGN", status: "needs_architect", confidence: 0, source: null },
      { rule: "ENGINEERING_DESIGN", status: "needs_engineer", confidence: 0, source: null },
    ],
  };
}

function bestSupplierPrice(materialId, supplierPrices) {
  const prices = supplierPrices.filter((p) => p.material_id === materialId).map((p) => n(p.price)).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : null;
}

export function buildParametricBom(model, templates, bomItems, materials, supplierPrices) {
  const area = model.dimensions.area;
  const ranked = templates
    .map((template) => ({ template, distance: Math.abs(n(template.area_m2) - area) }))
    .filter(({ template }) => n(template.area_m2) > 0)
    .sort((a, b) => a.distance - b.distance);
  const source = ranked[0]?.template || null;
  if (!source) return { sourceTemplate: null, sourceArea: null, rows: [], warnings: ["Немає шаблону ERP з площею для параметричного порівняння."] };

  const scale = area / n(source.area_m2, area);
  const materialMap = new Map(materials.map((m) => [m.id, m]));
  const rows = bomItems.filter((b) => b.template_id === source.id).map((item) => {
    const quantity = n(item.quantity_per_unit) * scale;
    const unitPrice = item.unit_price_override != null && n(item.unit_price_override) > 0
      ? n(item.unit_price_override)
      : bestSupplierPrice(item.material_id, supplierPrices);
    return {
      id: item.id,
      materialId: item.material_id,
      material: materialMap.get(item.material_id)?.name || "Невідомий матеріал",
      unit: item.unit || materialMap.get(item.material_id)?.unit || "—",
      groupId: item.group_id || null,
      quantity,
      sourceQuantity: n(item.quantity_per_unit),
      unitPrice,
      total: unitPrice == null ? null : quantity * unitPrice,
      derivation: "template_area_scale",
      confidence: 0.65,
      status: unitPrice == null ? "missing_price" : "estimate",
      source: `ERP шаблон: ${source.name}`,
    };
  });

  return {
    sourceTemplate: source.name,
    sourceTemplateId: source.id,
    sourceArea: n(source.area_m2),
    scale,
    rows,
    warnings: rows.some((r) => r.unitPrice == null) ? ["Є BOM-позиції без актуальної ціни постачальника або override."] : [],
  };
}

export function buildCostEngine(model, bom, extraCosts, sourceTemplateId) {
  const materialRows = bom.rows.filter((r) => r.total != null);
  const materials = materialRows.reduce((sum, row) => sum + row.total, 0);
  const extras = sourceTemplateId
    ? extraCosts.filter((row) => row.template_id === sourceTemplateId).map((row) => ({ label: row.label, amount: n(row.amount), groupId: row.group_id || null }))
    : [];
  const extraTotal = extras.reduce((sum, row) => sum + row.amount, 0);
  const knownCost = materials + extraTotal;
  const missingPrices = bom.rows.filter((r) => r.total == null).length;
  const finishFactor = FINISH_FACTORS[model.program.finish] || 1;

  return {
    currency: "UAH",
    materials,
    extras: extraTotal,
    knownCost,
    modeledCost: knownCost * finishFactor,
    finishFactor,
    missingPrices,
    completeness: bom.rows.length ? (bom.rows.length - missingPrices) / bom.rows.length : 0,
    status: missingPrices ? "incomplete" : "estimate",
    note: "Це планова оцінка на основі наявних ERP-даних. Праця, логістика, монтаж, накладні та податки не вигадуються без джерела даних.",
    breakdown: extras,
  };
}

export function formatMoney(value) {
  return value == null ? "—" : `${Math.round(value).toLocaleString("uk-UA")} грн`;
}
