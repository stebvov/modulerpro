"use client";
import SearchFilter from "@/components/SearchFilter";

import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { fmtCurrency } from "@/lib/format";
import { getCategoryAndDescendantIds } from "@/lib/categoryOrder";
import { useColumns } from "@/lib/useColumns";
import ColHead, { ColReset } from "@/components/ColHead";
import CategoryTreeSelect from "@/components/CategoryTreeSelect";

export default function PriceAuditScreen() {
  const { materials, materialCategories, supplierPrices, currency, exchangeRates, showDecimals } = useAppData();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // один рядок на товар: скільки постачальників, найнижча ціна, стан
  const base = useMemo(() => {
    const allowed = categoryFilter ? getCategoryAndDescendantIds(categoryFilter, materialCategories) : null;
    const q = search.trim().toLowerCase();
    return materials
      .filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!allowed || allowed.includes(m.category_id)))
      .map((m) => {
        const prices = supplierPrices.filter((p) => p.material_id === m.id);
        return {
          m, n: prices.length,
          cheapest: prices.length ? Math.min(...prices.map((p) => Number(p.price))) : null,
          cat: materialCategories.find((c) => c.id === m.category_id)?.name || "",
          state: !prices.length ? "немає ціни" : prices.length === 1 ? "немає конкуренції" : "є вибір",
        };
      });
  }, [materials, materialCategories, supplierPrices, search, categoryFilter]);
  const cols = useMemo(() => ({
    name: { value: (r) => r.m.name },
    cat: { value: (r) => r.cat },
    n: { value: (r) => r.n },
    cheapest: { value: (r) => r.cheapest, text: (v) => `${Number(v).toLocaleString("uk-UA")} грн` },
    state: { value: (r) => r.state },
  }), []);
  const t = useColumns(base, cols);

  return (
    <div>
      <p className="note">Список усіх товарів: кількість постачальників і найнижча ціна по кожному.</p>
      <div className="toolbar">
        <div className="toolbar-left">
          <CategoryTreeSelect value={categoryFilter} categories={materialCategories} onChange={setCategoryFilter} />
          <SearchFilter value={search} onChange={setSearch} placeholder="Пошук товару..." />
        </div>
        <div className="toolbar-actions"><ColReset t={t} /></div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <ColHead t={t} k="name">Матеріал</ColHead>
              <ColHead t={t} k="cat">Категорія</ColHead>
              <ColHead t={t} k="n">К-сть постачальників</ColHead>
              <ColHead t={t} k="cheapest">Найнижча ціна</ColHead>
              <ColHead t={t} k="state">Стан</ColHead>
            </tr>
          </thead>
          <tbody>
            {t.rows.map(({ m, n, cheapest, cat }) => (
              <tr key={m.id}>
                <td>{m.icon ? `${m.icon} ` : ""}{m.name}</td>
                <td>{cat || "—"}</td>
                <td>{n}</td>
                <td>{cheapest != null ? fmtCurrency(cheapest, currency, exchangeRates, showDecimals) : "—"}</td>
                <td>
                  {!n && <span className="badge draft" style={{ color: "var(--danger)" }}>немає ціни</span>}
                  {n === 1 && <span className="badge draft">немає конкуренції</span>}
                </td>
              </tr>
            ))}
            {!t.rows.length && <tr><td colSpan={5} className="empty">Нічого не знайдено</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
