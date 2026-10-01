"use client";

// Ціни матеріалу, внесені вручну (не парсером): постачальник, ціна за одиницю, примітка чи посилання.
// Тут же — додати постачальника, якого ще немає в довіднику, і одразу його ціну.
import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { isStale, linkify } from "@/lib/format";
import { savePrice, ensureSupplierHasCategory } from "@/lib/prices";
import { fmtPrice } from "@/lib/market";
import SearchCombobox from "@/components/SearchCombobox";

const dateOnly = (ts) => new Date(ts).toLocaleDateString("uk-UA");

export default function ManualPricesPanel({ material }) {
  const { supabase, suppliers, supplierPrices, materials, supplierCategoryLinks, reload } = useAppData();
  const { canWriteFinance, canWriteCatalog, profile, user } = useAuth();
  const [edit, setEdit] = useState({}); // id ціни → { price, note }
  const [add, setAdd] = useState({ supplierId: "", price: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updatedBy = profile?.full_name || user?.email || null;
  const rows = supplierPrices.filter((p) => p.material_id === material.id && p.source !== "parsing").sort((a, b) => a.price - b.price);
  const taken = new Set(supplierPrices.filter((p) => p.material_id === material.id).map((p) => p.supplier_id));
  const options = suppliers.filter((s) => !taken.has(s.id)).map((s) => ({ id: s.id, label: s.name }));

  async function run(action) {
    setBusy(true);
    setError("");
    const res = await action();
    if (res?.error) setError(res.error.message);
    await reload(true);
    setBusy(false);
    return !res?.error;
  }

  async function createSupplier(name) {
    const { data, error: e } = await supabase.from("suppliers").insert([{ name }]).select().single();
    if (e) { setError(e.message); return null; }
    await reload(true);
    return data.id;
  }

  async function save(supplierId, priceValue, note) {
    const price = parseFloat(String(priceValue).replace(",", "."));
    if (!supplierId || !(price > 0)) { setError("Обери постачальника і вкажи ціну більшу за нуль."); return false; }
    return run(async () => {
      const res = await savePrice(supabase, { supplierId, materialId: material.id, price, updatedBy, note });
      if (!res.error) await ensureSupplierHasCategory(supabase, { supplierId, materialId: material.id, materials, supplierCategoryLinks });
      return res;
    });
  }

  if (!rows.length && !canWriteFinance) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Ціни, внесені вручну</h4>
      {error && <div className="auth-error">{error}</div>}
      <table>
        <thead><tr><th>Постачальник</th><th>За {material.unit}, грн</th><th>Звідки ціна: примітка або посилання</th><th>Оновлено</th><th></th></tr></thead>
        <tbody>
          {rows.map((p) => {
            const s = suppliers.find((x) => x.id === p.supplier_id);
            const e = edit[p.id];
            return (
              <tr key={p.id}>
                <td>{s?.website ? <a href={s.website} target="_blank" rel="noreferrer">{s.name}</a> : s?.name || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {canWriteFinance
                    ? <input type="number" className="price-input" defaultValue={p.price} onChange={(ev) => setEdit((v) => ({ ...v, [p.id]: { ...v[p.id], price: ev.target.value } }))} />
                    : <b>{fmtPrice(p.price)}</b>}
                </td>
                <td>
                  {canWriteFinance
                    ? <input type="text" className="note-link-input" defaultValue={p.note || ""} onChange={(ev) => setEdit((v) => ({ ...v, [p.id]: { ...v[p.id], note: ev.target.value } }))} />
                    : null}
                  {p.note && <div className="note-preview">{linkify(p.note)}</div>}
                </td>
                <td className={isStale(p.updated_at) ? "stale" : undefined} style={{ whiteSpace: "nowrap" }} title={p.updated_by || undefined}>{dateOnly(p.updated_at)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {canWriteFinance && (
                    <>
                      <button className="btn small" disabled={busy || !e} onClick={async () => { if (await save(p.supplier_id, e.price ?? p.price, e.note ?? p.note ?? "")) setEdit((v) => ({ ...v, [p.id]: undefined })); }}>Зберегти</button>{" "}
                      <button className="btn small" disabled={busy} title="Прибрати цю ціну" onClick={() => { if (window.confirm(`Прибрати ціну постачальника «${s?.name || ""}»?`)) run(() => supabase.from("supplier_prices").delete().eq("id", p.id)); }}>×</button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan={5} className="empty">Вручну цін ще не вносили</td></tr>}
          {canWriteFinance && (
            <tr>
              <td style={{ minWidth: 220 }}>
                <SearchCombobox
                  value={add.supplierId}
                  options={options}
                  placeholder="постачальник — обери або впиши нового…"
                  onChange={(id) => setAdd((v) => ({ ...v, supplierId: id }))}
                  onCreate={canWriteCatalog ? createSupplier : undefined}
                  createLabel={(text) => `+ Новий постачальник «${text}»`}
                />
              </td>
              <td><input type="number" className="price-input" placeholder="ціна" value={add.price} onChange={(ev) => setAdd((v) => ({ ...v, price: ev.target.value }))} /></td>
              <td><input type="text" className="note-link-input" placeholder="що саме, як продають, посилання…" value={add.note} onChange={(ev) => setAdd((v) => ({ ...v, note: ev.target.value }))} /></td>
              <td />
              <td>
                <button className="btn small" disabled={busy} onClick={async () => { if (await save(add.supplierId, add.price, add.note)) setAdd({ supplierId: "", price: "", note: "" }); }}>+ Додати</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {canWriteFinance && <p className="note">Нового постачальника можна вписати просто тут; сайт, телефони й контакти додаються в «Постачальники й контакти».</p>}
    </div>
  );
}
