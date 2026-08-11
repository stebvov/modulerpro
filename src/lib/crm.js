export const CONTACT_TYPES = ["телефон", "email", "telegram", "viber", "whatsapp", "інше"];
export const ACTIVITY_TYPES = [
  { key: "дзвінок", icon: "📞" },
  { key: "telegram", icon: "✈️" },
  { key: "email", icon: "✉️" },
  { key: "зустріч", icon: "🤝" },
  { key: "інше", icon: "•" },
];
export const SERVICE_TYPES = ["монтаж", "доставка", "фундамент", "під_ключ"];
export const LEAD_SOURCES = ["сайт", "реклама", "рекомендація", "вхідний_дзвінок"];
export const LEAD_STATUSES = ["новий", "кваліфікований", "відхилений"];

// service_rate_cards has no rows for "під_ключ" and no is_average rows yet,
// so the "середнє" (ballpark) calc method still falls back to these fixed
// estimates client-side, same as the prototype.
export const AVERAGE_ESTIMATE = { монтаж: 18000, доставка: 5000, фундамент: 45000, під_ключ: 60000 };

export function findRateCard(rateCards, serviceType, variant) {
  return rateCards.find((r) => r.service_type === serviceType && r.variant === (variant || null));
}

export function foundationVariants(rateCards) {
  return [...new Set(rateCards.filter((r) => r.service_type === "фундамент").map((r) => r.variant))].filter(Boolean);
}

export function avgCostPerM2(templates) {
  const priced = templates.filter((t) => t.base_cost_per_m2 != null);
  if (!priced.length) return 0;
  return Math.round(priced.reduce((s, t) => s + Number(t.base_cost_per_m2), 0) / priced.length);
}

// Cheapest known supplier price for a material — same rule TemplateModal uses
// when showing the live BOM total.
function bestSupplierPrice(materialId, supplierPrices) {
  const rows = supplierPrices.filter((p) => p.material_id === materialId);
  if (!rows.length) return null;
  return Math.min(...rows.map((p) => Number(p.price)));
}

// Actual production cost of a template (materials at their cheapest known
// supplier price, or the row's override, plus extra costs like labor) — as
// opposed to product_templates.base_cost_per_m2, which is the price charged
// to the customer, not the cost to build.
export function templateProductionCost(templateId, bomItems, extraCosts, supplierPrices) {
  const bomTotal = bomItems
    .filter((b) => b.template_id === templateId)
    .reduce((sum, b) => {
      const qty = Number(b.quantity_per_unit) || 0;
      if (!b.material_id || !qty) return sum;
      const price = b.unit_price_override != null ? Number(b.unit_price_override) : bestSupplierPrice(b.material_id, supplierPrices);
      return sum + qty * (price || 0);
    }, 0);
  const extraTotal = extraCosts
    .filter((e) => e.template_id === templateId)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  return bomTotal + extraTotal;
}

// Average actual cost per m² across templates that have a priced BOM — used
// to estimate cost for custom (no-template) deals, mirroring how
// estimated_price already averages base_cost_per_m2 for the same case.
export function avgProductionCostPerM2(templates, bomItems, extraCosts, supplierPrices) {
  const withCost = templates
    .map((t) => ({ area: Number(t.area_m2) || 0, cost: templateProductionCost(t.id, bomItems, extraCosts, supplierPrices) }))
    .filter((x) => x.area > 0 && x.cost > 0);
  if (!withCost.length) return 0;
  return Math.round(withCost.reduce((s, x) => s + x.cost / x.area, 0) / withCost.length);
}

// Unit price of a service template: its fixed_price override if set,
// otherwise the sum of (unit_price_override ?? the service's base_price) ×
// item quantity across its items.
export function serviceTemplateUnitPrice(serviceTemplateId, serviceTemplateItems, services, serviceTemplates) {
  const tpl = serviceTemplates?.find((t) => t.id === serviceTemplateId);
  if (tpl?.fixed_price != null) return Number(tpl.fixed_price);
  return serviceTemplateItems
    .filter((i) => i.service_template_id === serviceTemplateId)
    .reduce((sum, i) => {
      const svc = services.find((s) => s.id === i.service_id);
      const price = i.unit_price_override != null ? Number(i.unit_price_override) : Number(svc?.base_price) || 0;
      return sum + price * (Number(i.quantity) || 0);
    }, 0);
}

// Order items are polymorphic: { kind: "house" | "service" | "custom",
// template_id (house/service), unit_price (custom only), quantity }. Sum of
// each line's unit price × its own quantity — the already-multiplied grand
// total, meant to be stored directly as deals.production_price (with
// deals.quantity=1 for the "template" request type).
export function orderItemsProductionTotal(items, { templates, services, serviceTemplateItems, serviceTemplates }) {
  return (items || []).reduce((sum, l) => {
    const qty = Number(l.quantity) || 0;
    if (l.kind === "house") {
      const tpl = templates.find((t) => t.id === l.template_id);
      if (!tpl || tpl.base_cost_per_m2 == null) return sum;
      return sum + tpl.area_m2 * tpl.base_cost_per_m2 * qty;
    }
    if (l.kind === "service") {
      return sum + serviceTemplateUnitPrice(l.template_id, serviceTemplateItems, services, serviceTemplates) * qty;
    }
    if (l.kind === "custom") {
      return sum + (Number(l.unit_price) || 0) * qty;
    }
    return sum;
  }, 0);
}

// production_cost_snapshot for a deal: real BOM+extra cost for its "house"
// order-item lines only (service/custom lines aren't materials-based, so —
// same as the old standalone services block before it — they don't
// contribute to this materials-cost figure), or an area-based estimate
// (same average-cost approach as estimated_price) for a custom deal.
export function computeProductionCostSnapshot(deal, { templates, bomItems, extraCosts, supplierPrices }) {
  const houseLines = (deal.template_lines || []).filter((l) => l.kind === "house");
  if (houseLines.length) {
    const total = houseLines.reduce((sum, l) => {
      const cost = templateProductionCost(l.template_id, bomItems, extraCosts, supplierPrices);
      return sum + cost * (Number(l.quantity) || 0);
    }, 0);
    return total > 0 ? Math.round(total) : null;
  }
  if (deal.is_custom) {
    const areaM2 = Number(deal.custom_area_m2) || 0;
    if (!areaM2) return null;
    return Math.round(areaM2 * avgProductionCostPerM2(templates, bomItems, extraCosts, supplierPrices));
  }
  if (!deal.template_id) return null;
  const cost = templateProductionCost(deal.template_id, bomItems, extraCosts, supplierPrices);
  return cost > 0 ? Math.round(cost) : null;
}

const COLD = [47, 93, 138];
const HOT = [193, 101, 47];
export function stageColor(index, total) {
  const t = total > 1 ? index / (total - 1) : 0;
  const rgb = COLD.map((c, i) => Math.round(c + (HOT[i] - c) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function curr(n) {
  return Math.round(Number(n) || 0).toLocaleString("uk-UA");
}

export function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
}

export function fmtDateTime(iso) {
  return iso
    ? new Date(iso).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
}

export function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function slugify(s) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zа-яїієґ0-9_]/gi, "") || Math.random().toString(36).slice(2, 7)
  );
}
