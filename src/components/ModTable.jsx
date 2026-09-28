"use client";

// Таблиця, що редагується як Excel: зміна поля зберігається, щойно курсор залишає клітинку.
// columns: [{ key, label, type: "text"|"number"|"date"|"select"|"check", options: [[value,label]], width, render(row) }]
import { useState } from "react";
import { toNum } from "@/lib/mod";

function Cell({ col, row, onSave }) {
  const v = row[col.key];
  if (col.render) return col.render(row);
  if (col.readOnly) return <span>{v ?? "—"}</span>;
  const style = { width: col.width || "100%", minWidth: col.width || 90, padding: "4px 6px", fontSize: 13 };
  if (col.type === "select") {
    return (
      <select value={v ?? ""} style={style} onChange={(e) => onSave(e.target.value || null)}>
        {col.options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
      </select>
    );
  }
  if (col.type === "check") {
    return <input type="checkbox" checked={!!v} onChange={(e) => onSave(e.target.checked)} />;
  }
  return (
    <input
      key={`${row.id}-${col.key}-${v ?? ""}`}
      type={col.type === "date" ? "date" : "text"}
      inputMode={col.type === "number" ? "decimal" : undefined}
      defaultValue={v ?? ""}
      style={{ ...style, textAlign: col.type === "number" ? "right" : "left" }}
      onBlur={(e) => {
        const raw = e.target.value.trim();
        const next = col.type === "number" ? toNum(raw) : raw || null;
        if (String(next ?? "") !== String(v ?? "")) onSave(next);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
    />
  );
}

export default function ModTable({ columns, rows, onUpdate, onDelete, onAdd, addLabel = "+ Рядок", empty = "Ще немає записів." }) {
  const [sure, setSure] = useState(null);
  const [err, setErr] = useState("");
  async function save(row, key, value) {
    const e = await onUpdate(row.id, { [key]: value });
    setErr(e || "");
  }
  return (
    <div>
      {err && <div className="auth-error" style={{ marginBottom: 8 }}>{err}</div>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => <th key={c.key} style={c.num ? { textAlign: "right" } : undefined}>{c.label}</th>)}
              {onDelete && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => (
                  <td key={c.key} style={c.num ? { textAlign: "right", whiteSpace: "nowrap" } : undefined}>
                    <Cell col={c} row={r} onSave={(v) => save(r, c.key, v)} />
                  </td>
                ))}
                {onDelete && (
                  <td style={{ width: 70 }}>
                    <button
                      className="btn small"
                      onClick={async () => {
                        if (sure !== r.id) { setSure(r.id); setTimeout(() => setSure(null), 4000); return; }
                        const e = await onDelete(r.id);
                        setErr(e || "");
                      }}
                    >
                      {sure === r.id ? "Точно?" : "×"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={columns.length + 1} className="note" style={{ textAlign: "center" }}>{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {onAdd && (
        <button className="btn" style={{ marginTop: 10 }} onClick={async () => { const e = await onAdd(); setErr(e || ""); }}>
          {addLabel}
        </button>
      )}
    </div>
  );
}
