"use client";
import SearchFilter from "@/components/SearchFilter";

import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { fmtCurrency, fmtUahAmount } from "@/lib/format";
import { getCategoryAndDescendantIds } from "@/lib/categoryOrder";
import { useColumns } from "@/lib/useColumns";
import ColHead, { ColReset } from "@/components/ColHead";
import CategoryTreeSelect from "@/components/CategoryTreeSelect";
import InfoTip from "@/components/InfoTip";
import AddProductModal from "@/components/modals/AddProductModal";
import MaterialPricesModal from "@/components/modals/MaterialPricesModal";
import { useAuth } from "@/context/AuthContext";

export default function PriceAuditScreen() {
  const { materials, materialCategories, supplierPrices, currency, exchangeRates, showDecimals } = useAppData();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const { canWriteCatalog } = useAuth();
  const [addFor, setAddFor] = useState(null); // товар, до якого додаємо ціну іншого постачальника
  const [openId, setOpenId] = useState(null);

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
    cheapest: { value: (r) => r.cheapest, text: (v) => fmtUahAmount(v, showDecimals) },
    state: { value: (r) => r.state },
  }), []);
  const t = useColumns(base, cols);

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <SearchFilter value={search} onChange={setSearch} placeholder="Пошук товару..." active={categoryFilter ? 1 : 0} onReset={() => setCategoryFilter("")}>
            <CategoryTreeSelect value={categoryFilter} categories={materialCategories} onChange={setCategoryFilter} />
          </SearchFilter>
          <InfoTip label="Як читати" text="Усі товари: скільки постачальників і найнижча ціна. «+ свій» біля товару — додати ціну цього товару від іншого постачальника за посиланням (новий постачальник створюється сам)." />
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
              {canWriteCatalog && <th></th>}
            </tr>
          </thead>
          <tbody>
            {t.rows.map(({ m, n, cheapest, cat }) => (
              <tr key={m.id} className="row-click" title="Клік — усі ціни товару" onClick={(e) => { if (!e.target.closest("button,a")) setOpenId(m.id); }}>
                <td>{m.icon ? `${m.icon} ` : ""}{m.name}</td>
                <td>{cat || "—"}</td>
                <td>{n}</td>
                <td>{cheapest != null ? fmtCurrency(cheapest, currency, exchangeRates, showDecimals) : "—"}</td>
                <td>
                  {!n && <span className="badge draft" style={{ color: "var(--danger)" }}>немає ціни</span>}
                  {n === 1 && <span className="badge draft">немає конкуренції</span>}
                </td>
                {canWriteCatalog && (
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn small" title="Додати ціну цього товару від іншого постачальника — за посиланням; новий постачальник створиться сам" onClick={() => setAddFor(m.id)}>+ свій</button>
                  </td>
                )}
              </tr>
            ))}
            {!t.rows.length && <tr><td colSpan={6} className="empty">Нічого не знайдено</td></tr>}
          </tbody>
        </table>
      </div>
      {addFor && <AddProductModal key={addFor} open materialId={addFor} onClose={() => setAddFor(null)} onSaved={(id) => setOpenId(id)} />}
      {openId && <MaterialPricesModal key={openId} materialId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
