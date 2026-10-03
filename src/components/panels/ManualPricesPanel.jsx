"use client";

// Ціни матеріалу з можливістю правки: постачальник, ціна за одиницю, примітка чи посилання.
// Тут же — додати постачальника, якого ще немає в довіднику, і одразу його ціну.
// Типово показує лише внесені вручну; з all — усі ціни (ті, що з сайтів, лише для перегляду: їх щодня переписує парсер).
import { Fragment, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { isStale, linkify } from "@/lib/format";
import { savePrice, ensureSupplierHasCategory } from "@/lib/prices";
import { fmtPrice } from "@/lib/market";
import { diff, priceLink } from "@/lib/priceStats";
import SearchCombobox from "@/components/SearchCombobox";
import PriceDiff from "@/components/PriceDiff";

const dateOnly = (ts) => new Date(ts).toLocaleDateString("uk-UA");

export default function ManualPricesPanel({ material, all = false, highlight = null, onContacts }) {
  const { supabase, suppliers, supplierPrices, priceHistory, materials, supplierCategoryLinks, reload } = useAppData();
  const { canWriteFinance, canWriteCatalog, profile, user } = useAuth();
  const [edit, setEdit] = useState({}); // id ціни → { price, note }
  const [add, setAdd] = useState({ supplierId: "", price: "", note: "" });
  const [openHistory, setOpenHistory] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updatedBy = profile?.full_name || user?.email || null;
  const prices = supplierPrices.filter((p) => p.material_id === material.id);
  const rows = prices.filter((p) => all || p.source !== "parsing").sort((a, b) => a.price - b.price);
  const lowest = prices.length ? Math.min(...prices.map((p) => Number(p.price))) : null;
  const taken = new Set(prices.map((p) => p.supplier_id));
  const options = suppliers.filter((s) => !taken.has(s.id)).map((s) => ({ id: s.id, label: s.name }));
  const cols = all ? 6 : 5;

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

  if (!all && !rows.length && !canWriteFinance) return null;

  return (
    <div style={all ? undefined : { marginTop: 14 }}>
      {!all && <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Ціни, внесені вручну</h4>}
      {error && <div className="auth-error">{error}</div>}
      <div className="table-scroll">
      <table className="dense">
        <thead>
          <tr>
            <th>Постачальник</th><th>За {material.unit}, грн</th>
            {all && <th title="На скільки дорожче за найнижчу ціну цього матеріалу">До найнижчої</th>}
            <th>Звідки ціна: примітка або посилання</th><th>Оновлено</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const s = suppliers.find((x) => x.id === p.supplier_id);
            const e = edit[p.id];
            const parsed = p.source === "parsing";
            const editable = canWriteFinance && !parsed;
            const link = priceLink(p);
            const history = openHistory[p.id]
              ? priceHistory.filter((h) => h.supplier_id === p.supplier_id && h.material_id === p.material_id).sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))
              : null;
            return (
              <Fragment key={p.id}>
                <tr className={highlight === p.supplier_id ? "row-mark" : undefined}>
                  <td>
                    {s?.website ? <a href={s.website} target="_blank" rel="noreferrer">{s.name}</a> : s?.name || "—"}
                    {onContacts && s && <>{" "}<button type="button" className="btn small icon" title="Контакти постачальника" aria-label="Контакти постачальника" onClick={() => onContacts(s.id)}>👤</button></>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {editable
                      ? <input type="number" className="price-input" defaultValue={p.price} onChange={(ev) => setEdit((v) => ({ ...v, [p.id]: { ...v[p.id], price: ev.target.value } }))} />
                      : link ? <a href={link} target="_blank" rel="noreferrer"><b>{fmtPrice(p.price)}</b></a> : <b>{fmtPrice(p.price)}</b>}
                  </td>
                  {all && <td style={{ whiteSpace: "nowrap" }}>{Number(p.price) === lowest ? <span className="fresh">найнижча</span> : <PriceDiff d={diff(Number(p.price), lowest)} fmt={fmtPrice} />}</td>}
                  <td>
                    {editable
                      ? <input type="text" className="note-link-input" defaultValue={p.note || ""} onChange={(ev) => setEdit((v) => ({ ...v, [p.id]: { ...v[p.id], note: ev.target.value } }))} />
                      : null}
                    {p.note && <div className="note-preview">{linkify(p.note)}</div>}
                    {parsed && <span className="badge draft" title="Ціну щодня бере парсер із сайту магазину — правка тут зітреться при наступному обході. Якщо підтягнувся не той товар, познач його в «Ринкових цінах».">з сайту · оновлюється сама</span>}
                  </td>
                  <td className={isStale(p.updated_at) ? "stale" : undefined} style={{ whiteSpace: "nowrap" }} title={p.updated_by || undefined}>{dateOnly(p.updated_at)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {editable && (
                      <>
                        <button className="btn small" disabled={busy || !e} onClick={async () => { if (await save(p.supplier_id, e.price ?? p.price, e.note ?? p.note ?? "")) setEdit((v) => ({ ...v, [p.id]: undefined })); }}>Зберегти</button>{" "}
                        <button className="btn small icon" disabled={busy} title="Прибрати цю ціну" aria-label="Прибрати цю ціну" onClick={() => { if (window.confirm(`Прибрати ціну постачальника «${s?.name || ""}»?`)) run(() => supabase.from("supplier_prices").delete().eq("id", p.id)); }}>×</button>{" "}
                      </>
                    )}
                    {all && <button type="button" className="btn small icon" title="Історія ціни" aria-label="Історія ціни" onClick={() => setOpenHistory((o) => ({ ...o, [p.id]: !o[p.id] }))}>🕘</button>}
                  </td>
                </tr>
                {history && (
                  <tr>
                    <td colSpan={cols}>
                      {history.length
                        ? history.map((h) => <div className="note" key={h.id} style={{ marginTop: 0 }}>{new Date(h.changed_at).toLocaleString("uk-UA")} — <b>{fmtPrice(h.price)} грн</b>{h.updated_by ? ` · ${h.updated_by}` : ""}</div>)
                        : <span className="note">Історії ще немає</span>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {!rows.length && <tr><td colSpan={cols} className="empty">{all ? "Цін ще немає" : "Вручну цін ще не вносили"}</td></tr>}
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
              {all && <td />}
              <td><input type="text" className="note-link-input" placeholder="що саме, як продають, посилання…" value={add.note} onChange={(ev) => setAdd((v) => ({ ...v, note: ev.target.value }))} /></td>
              <td />
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="btn small" disabled={busy} onClick={async () => { if (await save(add.supplierId, add.price, add.note)) setAdd({ supplierId: "", price: "", note: "" }); }}>+ Додати</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      {canWriteFinance && <p className="note">Нового постачальника можна вписати просто тут; сайт, телефони й контакти додаються в «Постачальники й контакти».</p>}
    </div>
  );
}
