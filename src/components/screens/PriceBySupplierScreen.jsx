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

export default function PriceBySupplierScreen() {
  const { supabase, suppliers, materials, materialCategories, supplierPrices, priceHistory, supplierCategoryLinks, currency, exchangeRates, showDecimals, reload } =
    useAppData();
  const { canWriteFinance, profile, user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [contactsSupplierId, setContactsSupplierId] = useState(null);
  const [fullSupplier, setFullSupplier] = useState(null);
  const [openHistory, setOpenHistory] = useState({});
  const [editPrices, setEditPrices] = useState({});
  const [editNotes, setEditNotes] = useState({});
  const [addForm, setAddForm] = useState({});
  const [busy, setBusy] = useState(false);

  const updatedBy = profile?.full_name || user?.email || null;

  const allowedCategoryIds = categoryFilter ? getCategoryAndDescendantIds(categoryFilter, materialCategories) : null;
  const list = suppliers.filter((s) => {
    const cats = supplierCategoryLinks.filter((l) => l.supplier_id === s.id).map((l) => l.category_id);
    return (
      (!search || s.name.toLowerCase().includes(search.toLowerCase())) &&
      (!allowedCategoryIds || cats.some((id) => allowedCategoryIds.includes(id)))
    );
  });

  async function handleSaveAll(supplierId, rows) {
    setBusy(true);
    for (const p of rows) {
      const key = `${supplierId}-${p.material_id}`;
      const priceRaw = editPrices[key] ?? p.price;
      const price = parseFloat(priceRaw);
      if (price > 0) {
        await savePrice(supabase, { supplierId, materialId: p.material_id, price, updatedBy, note: editNotes[key] ?? p.note ?? "" });
        await ensureSupplierHasCategory(supabase, { supplierId, materialId: p.material_id, materials, supplierCategoryLinks });
      }
    }
    await reload(true);
    setBusy(false);
  }

  async function handleAdd(supplierId) {
    const form = addForm[supplierId];
    if (!form?.materialId || !form?.price) return;
    const price = parseFloat(form.price);
    if (!price || price <= 0) return;
    setBusy(true);
    await savePrice(supabase, { supplierId, materialId: form.materialId, price, updatedBy, note: form.note || "" });
    await ensureSupplierHasCategory(supabase, { supplierId, materialId: form.materialId, materials, supplierCategoryLinks });
    setAddForm((p) => ({ ...p, [supplierId]: { materialId: "", price: "", note: "" } }));
    await reload(true);
    setBusy(false);
  }

  function openFullSupplier(supplier) {
    setContactsSupplierId(null);
    setFullSupplier(supplier);
  }

  if (!list.length) {
    return (
      <div>
        <p className="note">Список постачальників. Обери потрібного або відфільтруй пошуком — побачиш усі його товари/матеріали.</p>
        <Toolbar search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} materialCategories={materialCategories} />
        <div className="empty">Нічого не знайдено</div>
      </div>
    );
  }

  return (
    <div>
      <p className="note">Список постачальників. Обери потрібного або відфільтруй пошуком — побачиш усі його товари/матеріали.</p>
      <Toolbar search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} materialCategories={materialCategories} />

      {list.map((s) => {
        const rows = supplierPrices.filter((p) => p.supplier_id === s.id);
        const usedMaterialIds = rows.map((r) => r.material_id);
        const addOptions = materials.filter((m) => !usedMaterialIds.includes(m.id)).map((m) => ({ id: m.id, label: `${m.name} (${m.unit})` }));
        return (
          <div key={s.id} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 14, margin: "0 0 4px" }}>
              {s.name} <span className="btn small" onClick={() => setContactsSupplierId(s.id)}>контакти</span>
            </h3>
            <div className="table-scroll">
            <table>
              <thead><tr><th>Матеріал</th><th>Ціна, грн</th><th>Нотатка / посилання</th><th>Оновлено</th><th>Статус</th><th></th></tr></thead>
              <tbody>
                {!rows.length && <tr><td colSpan={6} className="empty">Немає цін</td></tr>}
                {rows.map((p) => {
                  const m = materials.find((x) => x.id === p.material_id);
                  const stale = isStale(p.updated_at);
                  const key = `${s.id}-${p.material_id}`;
                  const history = priceHistory
                    .filter((h) => h.supplier_id === s.id && h.material_id === p.material_id)
                    .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
                  return (
                    <Fragment key={key}>
                      <tr>
                        <td>{m ? m.name : "—"}</td>
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
                          <span className="btn small" onClick={() => setOpenHistory((o) => ({ ...o, [key]: !o[key] }))}>історія</span>
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
              </tbody>
            </table>
            </div>
            <div className="toolbar" style={{ marginTop: 8 }}>
              <div className="toolbar-left">
                {canWriteFinance && addOptions.length > 0 && (
                  <>
                    <SearchCombobox
                      value={addForm[s.id]?.materialId || ""}
                      options={addOptions}
                      placeholder="+ матеріал..."
                      onChange={(id) => setAddForm((p) => ({ ...p, [s.id]: { ...p[s.id], materialId: id } }))}
                    />
                    <input
                      type="number"
                      className="price-input"
                      placeholder="ціна"
                      value={addForm[s.id]?.price || ""}
                      onChange={(e) => setAddForm((p) => ({ ...p, [s.id]: { ...p[s.id], price: e.target.value } }))}
                    />
                    <input
                      type="text"
                      className="note-link-input"
                      style={{ width: 220 }}
                      placeholder="нотатка / посилання (необов'язково)"
                      value={addForm[s.id]?.note || ""}
                      onChange={(e) => setAddForm((p) => ({ ...p, [s.id]: { ...p[s.id], note: e.target.value } }))}
                    />
                    <button className="btn small" disabled={busy} onClick={() => handleAdd(s.id)}>+ Додати матеріал</button>
                  </>
                )}
              </div>
              {canWriteFinance && rows.length > 0 && (
                <button className="btn primary small" disabled={busy} onClick={() => handleSaveAll(s.id, rows)}>Зберегти всі зміни</button>
              )}
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

function Toolbar({ search, setSearch, categoryFilter, setCategoryFilter, materialCategories }) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <input type="text" className="search-input" placeholder="Пошук постачальника..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Всі категорії</option>
          {materialCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </div>
  );
}
