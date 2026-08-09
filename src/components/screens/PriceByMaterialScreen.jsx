"use client";

import { Fragment, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { daysAgo, isStale, fmtCurrency, linkify } from "@/lib/format";
import { savePrice, ensureSupplierHasCategory } from "@/lib/prices";
import { getCategoryAndDescendantIds } from "@/lib/categoryOrder";
import SupplierContactsModal from "@/components/modals/SupplierContactsModal";
import SupplierModal from "@/components/modals/SupplierModal";
import CategoryTreeSelect from "@/components/CategoryTreeSelect";
import SearchCombobox from "@/components/SearchCombobox";

export default function PriceByMaterialScreen() {
  const { supabase, materials, materialCategories, suppliers, supplierPrices, priceHistory, supplierCategoryLinks, currency, exchangeRates, showDecimals, reload } =
    useAppData();
  const { canWriteFinance, profile, user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const [contactsSupplierId, setContactsSupplierId] = useState(null);
  const [fullSupplier, setFullSupplier] = useState(null);
  const [openHistory, setOpenHistory] = useState({});
  const [editPrices, setEditPrices] = useState({});
  const [editNotes, setEditNotes] = useState({});
  const [addForm, setAddForm] = useState({});
  const [busy, setBusy] = useState(false);

  const updatedBy = profile?.full_name || user?.email || null;

  const allowedCategoryIds = categoryFilter ? getCategoryAndDescendantIds(categoryFilter, materialCategories) : null;
  const list = materials.filter(
    (m) =>
      (!search || m.name.toLowerCase().includes(search.toLowerCase())) &&
      (!allowedCategoryIds || allowedCategoryIds.includes(m.category_id))
  );

  async function handleSave(supplierId, materialId, priceValue, noteValue) {
    const price = parseFloat(priceValue);
    if (!price || price <= 0) return;
    setBusy(true);
    await savePrice(supabase, { supplierId, materialId, price, updatedBy, note: noteValue });
    await ensureSupplierHasCategory(supabase, { supplierId, materialId, materials, supplierCategoryLinks });
    await reload(true);
    setBusy(false);
  }

  async function handleAdd(materialId) {
    const form = addForm[materialId];
    if (!form?.supplierId || !form?.price) return;
    const price = parseFloat(form.price);
    if (!price || price <= 0) return;
    setBusy(true);
    await savePrice(supabase, { supplierId: form.supplierId, materialId, price, updatedBy, note: form.note || "" });
    await ensureSupplierHasCategory(supabase, { supplierId: form.supplierId, materialId, materials, supplierCategoryLinks });
    setAddForm((p) => ({ ...p, [materialId]: { supplierId: "", price: "", note: "" } }));
    await reload(true);
    setBusy(false);
  }

  function scrollToMaterial(materialId) {
    document.getElementById(`mat-${materialId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openFullSupplier(supplier) {
    setContactsSupplierId(null);
    setFullSupplier(supplier);
  }

  const toolbar = (
    <div className="toolbar">
      <div className="toolbar-left">
        <CategoryTreeSelect value={categoryFilter} categories={materialCategories} onChange={setCategoryFilter} />
        <input type="text" className="search-input" placeholder="Пошук товару..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <button className="btn small" onClick={() => setShowAudit((v) => !v)}>
        Огляд цін {showAudit ? "▾" : "▸"}
      </button>
    </div>
  );

  if (!list.length) {
    return (
      <div>
        <p className="note">Список товарів. Обери потрібний або відфільтруй пошуком — побачиш ціни всіх постачальників.</p>
        {toolbar}
        <div className="empty">Нічого не знайдено</div>
      </div>
    );
  }

  return (
    <div>
      <p className="note">Список товарів. Обери потрібний або відфільтруй пошуком — побачиш ціни всіх постачальників.</p>
      {toolbar}

      {showAudit && (
        <div className="section-body" style={{ marginBottom: 14 }}>
          <div className="table-scroll">
          <table>
            <thead><tr><th>Матеріал</th><th>Категорія</th><th>К-сть постачальників</th><th>Найнижча ціна</th><th></th></tr></thead>
            <tbody>
              {list.map((m) => {
                const rows = supplierPrices.filter((p) => p.material_id === m.id);
                const cheapest = rows.length ? Math.min(...rows.map((p) => Number(p.price))) : null;
                const cat = materialCategories.find((c) => c.id === m.category_id);
                return (
                  <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => scrollToMaterial(m.id)}>
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
        </div>
      )}

      {list.map((m) => {
        const rows = supplierPrices.filter((p) => p.material_id === m.id).sort((a, b) => a.price - b.price);
        const usedSupplierIds = rows.map((r) => r.supplier_id);
        const addOptions = suppliers.filter((s) => !usedSupplierIds.includes(s.id)).map((s) => ({ id: s.id, label: s.name }));
        return (
          <div key={m.id} id={`mat-${m.id}`} style={{ marginBottom: 18, scrollMarginTop: 12 }}>
            <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>{m.icon ? `${m.icon} ` : ""}{m.name} <span className="note">({m.unit})</span></h3>
            <div className="table-scroll">
            <table>
              <thead><tr><th>Постачальник</th><th>Ціна, грн</th><th>Нотатка / посилання</th><th>Оновлено</th><th>Статус</th><th></th></tr></thead>
              <tbody>
                {!rows.length && <tr><td colSpan={6} className="empty">Немає цін</td></tr>}
                {rows.map((p) => {
                  const s = suppliers.find((x) => x.id === p.supplier_id);
                  const stale = isStale(p.updated_at);
                  const key = `${p.supplier_id}-${p.material_id}`;
                  const history = priceHistory
                    .filter((h) => h.supplier_id === p.supplier_id && h.material_id === p.material_id)
                    .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
                  return (
                    <Fragment key={key}>
                      <tr>
                        <td>
                          {s ? s.name : "—"}{" "}
                          <span className="btn small" onClick={() => setContactsSupplierId(p.supplier_id)} title="Контакти">
                            <span className="btn-label-full">контакти</span>
                            <span className="btn-label-compact">👤</span>
                          </span>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="price-input"
                            defaultValue={p.price}
                            disabled={!canWriteFinance}
                            onChange={(e) => setEditPrices((v) => ({ ...v, [key]: e.target.value }))}
                          />{" "}
                          {currency !== "UAH" && <span className="note">≈ {fmtCurrency(p.price, currency, exchangeRates, showDecimals)}</span>}
                        </td>
                        <td>
                          {canWriteFinance ? (
                            <input
                              type="text"
                              className="note-link-input"
                              placeholder="коментар або посилання..."
                              defaultValue={p.note || ""}
                              onChange={(e) => setEditNotes((v) => ({ ...v, [key]: e.target.value }))}
                            />
                          ) : (
                            p.note && <div className="note-preview">{linkify(p.note)}</div>
                          )}
                        </td>
                        <td className={stale ? "stale" : "fresh"}>{daysAgo(p.updated_at)} дн. тому</td>
                        <td className={stale ? "stale" : "fresh"}>{stale ? "застаріла" : "актуальна"}</td>
                        <td>
                          {canWriteFinance && (
                            <span
                              className="btn small"
                              title="Зберегти"
                              onClick={() => handleSave(p.supplier_id, p.material_id, editPrices[key] ?? p.price, editNotes[key] ?? p.note ?? "")}
                            >
                              <span className="btn-label-full">Зберегти</span>
                              <span className="btn-label-compact">💾</span>
                            </span>
                          )}{" "}
                          <span className="btn small" onClick={() => setOpenHistory((o) => ({ ...o, [key]: !o[key] }))} title="Історія">
                            <span className="btn-label-full">історія</span>
                            <span className="btn-label-compact">🕘</span>
                          </span>
                        </td>
                      </tr>
                      {openHistory[key] && (
                        <tr><td colSpan={6}>
                          {history.length ? (
                            <table><thead><tr><th>Ціна</th><th>Коли</th><th>Хто</th></tr></thead><tbody>
                              {history.map((h) => (
                                <tr key={h.id}><td>{Number(h.price).toLocaleString("uk-UA")} грн</td><td>{new Date(h.changed_at).toLocaleString("uk-UA")}</td><td>{h.updated_by || "—"}</td></tr>
                              ))}
                            </tbody></table>
                          ) : <span className="note">Історії ще немає</span>}
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
                {canWriteFinance && addOptions.length > 0 && (
                  <tr>
                    <td>
                      <SearchCombobox
                        value={addForm[m.id]?.supplierId || ""}
                        options={addOptions}
                        placeholder="+ постачальник..."
                        onChange={(id) => setAddForm((p) => ({ ...p, [m.id]: { ...p[m.id], supplierId: id } }))}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="price-input"
                        placeholder="ціна"
                        value={addForm[m.id]?.price || ""}
                        onChange={(e) => setAddForm((p) => ({ ...p, [m.id]: { ...p[m.id], price: e.target.value } }))}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="note-link-input"
                        placeholder="нотатка / посилання..."
                        value={addForm[m.id]?.note || ""}
                        onChange={(e) => setAddForm((p) => ({ ...p, [m.id]: { ...p[m.id], note: e.target.value } }))}
                      />
                    </td>
                    <td colSpan={2} />
                    <td>
                      <button className="btn small" disabled={busy} onClick={() => handleAdd(m.id)}>+ Додати</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        );
      })}

      <SupplierContactsModal
        supplierId={contactsSupplierId}
        onClose={() => setContactsSupplierId(null)}
        onOpenFull={openFullSupplier}
      />
      <SupplierModal open={!!fullSupplier} supplier={fullSupplier} onClose={() => setFullSupplier(null)} onSaved={() => setFullSupplier(null)} />
    </div>
  );
}
