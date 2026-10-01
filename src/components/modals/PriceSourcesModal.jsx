"use client";

// Джерела парсера: сторінки категорій на сайтах магазинів, згруповані за видом товару.
import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { groupLabel } from "@/lib/market";

export default function PriceSourcesModal({ open, sources, stores, canWrite, onClose, onChanged }) {
  const { supabase } = useAppData();
  const [form, setForm] = useState({ supplierId: "", grp: "", url: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const groups = [...new Set(sources.map((s) => s.grp))].sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), "uk"));

  async function run(action) {
    setBusy(true);
    setError("");
    const { error: e } = await action();
    setBusy(false);
    if (e) setError(e.message);
    else await onChanged();
  }

  function add() {
    const url = form.url.trim();
    if (!form.supplierId || !form.grp.trim() || !/^https?:\/\//.test(url)) {
      setError("Обери магазин, групу й встав повну адресу сторінки категорії (https://…).");
      return;
    }
    run(async () => {
      const res = await supabase.from("price_sources").insert([{ supplier_id: form.supplierId, grp: form.grp.trim(), url }]);
      if (!res.error) setForm((p) => ({ ...p, url: "" }));
      return res;
    });
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2>Джерела: сторінки магазинів, які обходить парсер</h2>
        {error && <div className="auth-error">{error}</div>}
        <p className="note" style={{ marginTop: 0 }}>
          Парсер проходить усі сторінки категорії й серед товарів шукає позиції за правилами. Якщо в джерела помилка — магазин змінив адресу чи вигляд сторінки.
        </p>

        {stores.map((s) => {
          const rows = sources.filter((x) => x.supplier_id === s.id).sort((a, b) => a.grp.localeCompare(b.grp) || a.url.localeCompare(b.url));
          return (
            <div key={s.id} style={{ marginBottom: 14 }}>
              <h4 style={{ margin: "10px 0 6px" }}>{s.name} <span className="note">· {rows.length} стор.</span></h4>
              {!s.parser_enabled && <div className="note" style={{ marginTop: 0 }}>Сайт не пускає програми — ці сторінки надсилають вручну кнопкою «З браузера».</div>}
              {!!rows.length && (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Група</th><th>Сторінка</th><th>Товарів</th><th>Стан</th><th></th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} style={r.active ? undefined : { opacity: 0.5 }}>
                          <td>{groupLabel(r.grp)}</td>
                          <td style={{ wordBreak: "break-all" }}><a href={r.url} target="_blank" rel="noreferrer">{decodeURI(r.url).replace(/^https?:\/\/[^/]+/, "")}</a></td>
                          <td>{r.last_items ?? "—"}</td>
                          <td className={r.last_error ? "stale" : "fresh"}>
                            {r.last_error || (r.last_ok_at ? new Date(r.last_ok_at).toLocaleDateString("uk-UA") : s.parser_enabled ? "ще не обходили" : "ще не надсилали")}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {canWrite && (
                              <>
                                <button className="btn small" disabled={busy} onClick={() => run(() => supabase.from("price_sources").update({ active: !r.active }).eq("id", r.id))}>
                                  {r.active ? "Вимкнути" : "Увімкнути"}
                                </button>{" "}
                                <button className="btn small" disabled={busy} title="Прибрати джерело" onClick={() => { if (window.confirm("Прибрати цю сторінку з обходу?")) run(() => supabase.from("price_sources").delete().eq("id", r.id)); }}>
                                  ×
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {canWrite && (
          <>
            <h4>Додати сторінку</h4>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))} style={{ width: 170 }}>
                <option value="">магазин…</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input list="price-source-groups" type="text" placeholder="група (обери або впиши нову)" value={form.grp} onChange={(e) => setForm((p) => ({ ...p, grp: e.target.value }))} style={{ width: 230 }} />
              <datalist id="price-source-groups">{groups.map((g) => <option key={g} value={g}>{groupLabel(g)}</option>)}</datalist>
              <input type="text" placeholder="https://… адреса сторінки категорії" value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} style={{ flex: 1, minWidth: 260 }} />
              <button className="btn" disabled={busy} onClick={add}>+ Додати</button>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}
