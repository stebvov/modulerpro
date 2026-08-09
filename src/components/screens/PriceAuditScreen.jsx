"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { fmtCurrency } from "@/lib/format";
import { getCategoryAndDescendantIds } from "@/lib/categoryOrder";
import CategoryTreeSelect from "@/components/CategoryTreeSelect";

export default function PriceAuditScreen() {
  const { materials, materialCategories, supplierPrices, currency, exchangeRates, showDecimals } = useAppData();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const allowedCategoryIds = categoryFilter ? getCategoryAndDescendantIds(categoryFilter, materialCategories) : null;
  const list = materials.filter(
    (m) =>
      (!search || m.name.toLowerCase().includes(search.toLowerCase())) &&
      (!allowedCategoryIds || allowedCategoryIds.includes(m.category_id))
  );

  return (
    <div>
      <p className="note">Список усіх товарів: кількість постачальників і найнижча ціна по кожному.</p>
      <div className="toolbar">
        <div className="toolbar-left">
          <CategoryTreeSelect value={categoryFilter} categories={materialCategories} onChange={setCategoryFilter} />
          <input type="text" className="search-input" placeholder="Пошук товару..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      {!list.length ? (
        <div className="empty">Нічого не знайдено</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Матеріал</th><th>Категорія</th><th>К-сть постачальників</th><th>Найнижча ціна</th><th></th></tr></thead>
            <tbody>
              {list.map((m) => {
                const rows = supplierPrices.filter((p) => p.material_id === m.id);
                const cheapest = rows.length ? Math.min(...rows.map((p) => Number(p.price))) : null;
                const cat = materialCategories.find((c) => c.id === m.category_id);
                return (
                  <tr key={m.id}>
                    <td>{m.icon ? `${m.icon} ` : ""}{m.name}</td>
                    <td>{cat ? cat.name : "—"}</td>
                    <td>{rows.length}</td>
                    <td>{cheapest != null ? fmtCurrency(cheapest, currency, exchangeRates, showDecimals) : "—"}</td>
                    <td>
                      {!rows.length && <span className="badge draft" style={{ color: "var(--danger)" }}>немає ціни</span>}
                      {rows.length === 1 && <span className="badge draft">немає конкуренції</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
