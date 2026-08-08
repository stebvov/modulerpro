"use client";

import { useAppData } from "@/context/DataContext";
import { statusLabels, templateTotalUah, fmtCurrency } from "@/lib/format";

export default function CompareScreen({ compareSelection }) {
  const { templates, bomItems, extraCosts, productCategoryLinks, productCategories, materials, bomGroups, currency, exchangeRates, showDecimals } =
    useAppData();

  if (!compareSelection.length) {
    return (
      <div>
        <p className="note">Обери до 3 шаблонів у каталозі (чекбокс під карткою), щоб порівняти тут.</p>
        <div className="empty">Нічого не обрано</div>
      </div>
    );
  }

  return (
    <div>
      <p className="note">Обери до 3 шаблонів у каталозі (чекбокс під карткою), щоб порівняти тут.</p>
      <div className="table-scroll">
      <div className="compare-wrap" style={{ gridTemplateColumns: `repeat(${compareSelection.length}, minmax(260px, 1fr))`, minWidth: compareSelection.length * 260 }}>
        {compareSelection.map((id) => {
          const t = templates.find((x) => x.id === id);
          if (!t) return null;
          const totalUah = templateTotalUah(t);
          const bom = bomItems.filter((b) => b.template_id === t.id).sort((a, b) => a.sort_order - b.sort_order);
          const extras = extraCosts.filter((e) => e.template_id === t.id);
          const cats = productCategoryLinks.filter((l) => l.template_id === t.id).map((l) => productCategories.find((c) => c.id === l.category_id)).filter(Boolean);

          const byGroup = new Map();
          bom.forEach((i) => {
            const gid = i.group_id || "none";
            if (!byGroup.has(gid)) byGroup.set(gid, []);
            byGroup.get(gid).push({ type: "bom", item: i });
          });
          extras.forEach((i) => {
            const gid = i.group_id || "none";
            if (!byGroup.has(gid)) byGroup.set(gid, []);
            byGroup.get(gid).push({ type: "extra", item: i });
          });

          return (
            <div className="card" key={id}>
              <h3>{t.name}</h3>
              <div className="row"><span>Категорії</span><span>{cats.map((c) => <span className="tag" key={c.id}>{c.name}</span>)}{!cats.length && "—"}</span></div>
              <div className="row"><span>Площа</span><span>{t.area_m2} м²</span></div>
              <div className="row"><span>Статус</span><span>{statusLabels[t.status] || t.status}</span></div>
              {totalUah != null ? (
                <div className="cost-block">
                  <div className="cost-main">{fmtCurrency(totalUah, currency, exchangeRates, showDecimals)}</div>
                  <div className="cost-sub">{fmtCurrency(t.base_cost_per_m2, currency, exchangeRates, showDecimals)}/м²</div>
                </div>
              ) : (
                <div className="cost-block cost-missing">—</div>
              )}
              <div className="bom-list">
                {byGroup.size === 0 && <div>BOM порожній</div>}
                {[...byGroup.entries()].map(([gid, items]) => {
                  const g = gid === "none" ? null : bomGroups.find((x) => x.id === gid);
                  return (
                    <div key={gid}>
                      <div className="group-title">{g ? g.name : "Без групи"}</div>
                      {items.map(({ type, item }, idx) =>
                        type === "extra" ? (
                          <div className="line" key={"e" + idx}>
                            <span>{item.label}</span>
                            <span>{fmtCurrency(item.amount, currency, exchangeRates, showDecimals)}</span>
                          </div>
                        ) : (
                          (() => {
                            const m = materials.find((mm) => mm.id === item.material_id);
                            return m ? (
                              <div className="line" key={"b" + idx}>
                                <span>{m.name}</span>
                                <span>{item.quantity_per_unit} {item.unit}</span>
                              </div>
                            ) : null;
                          })()
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
