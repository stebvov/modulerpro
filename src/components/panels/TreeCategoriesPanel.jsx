"use client";

// Дерево категорій: вкладені категорії (будь-яка глибина), перейменування, вибір батьківської,
// порядок серед «сусідів», видалення; для фінансів — ще й тип (доходи / виготовлення / OPEX / CAPEX).
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteErrorText } from "@/components/DeleteButton";

export const TX_KINDS = [["", "будь-який тип"], ["income", "Доходи"], ["prod", "Виготовлення"], ["opex", "OPEX"], ["capex", "CAPEX"]];

export default function TreeCategoriesPanel({ table, title, canWrite, withKind = false, renameCascade, onChanged, onBack, addPlaceholder = "Нова категорія" }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [kind, setKind] = useState("");
  const [sure, setSure] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(table).select("*").order("sort_order");
    if (error) setErr(error.message); else setRows(data || []);
  }, [supabase, table]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  const changed = async () => { await load(); onChanged?.(); };

  // плоский список у порядку дерева з глибиною
  const tree = useMemo(() => {
    const out = [];
    const walk = (pid, depth, seen) => rows.filter((r) => (r.parent_id || null) === pid).forEach((r) => {
      if (seen.has(r.id)) return; out.push({ ...r, depth }); walk(r.id, depth + 1, new Set([...seen, r.id]));
    });
    walk(null, 0, new Set());
    rows.filter((r) => !out.some((o) => o.id === r.id)).forEach((r) => out.push({ ...r, depth: 0 }));
    return out;
  }, [rows]);
  const descendants = (id) => { const s = new Set([id]); let grew = true; while (grew) { grew = false; rows.forEach((r) => { if (r.parent_id && s.has(r.parent_id) && !s.has(r.id)) { s.add(r.id); grew = true; } }); } return s; };

  async function upd(r, patch) {
    const { error } = await supabase.from(table).update(patch).eq("id", r.id);
    if (error) { setErr(error.message); return; }
    if (patch.name && renameCascade) await renameCascade(supabase, r.name, patch.name);
    setErr(""); changed();
  }
  async function move(r, dir) {
    const sib = tree.filter((x) => (x.parent_id || null) === (r.parent_id || null));
    const i = sib.findIndex((x) => x.id === r.id), j = i + dir;
    if (j < 0 || j >= sib.length) return;
    const a = sib[i], b = sib[j];
    const sa = a.sort_order ?? i, sb = b.sort_order ?? j;
    await Promise.all([
      supabase.from(table).update({ sort_order: sb === sa ? sa + dir : sb }).eq("id", a.id),
      supabase.from(table).update({ sort_order: sa }).eq("id", b.id),
    ]);
    changed();
  }
  async function remove(r) {
    if (sure !== r.id) { setSure(r.id); setTimeout(() => setSure(null), 4000); return; }
    // дочірні категорії піднімаються на рівень вище
    await supabase.from(table).update({ parent_id: r.parent_id || null }).eq("parent_id", r.id);
    const { error } = await supabase.from(table).delete().eq("id", r.id);
    setErr(error ? deleteErrorText(error) : ""); changed();
  }
  async function add() {
    if (!name.trim()) return;
    const max = rows.length ? Math.max(...rows.map((c) => c.sort_order ?? 0)) + 1 : 1;
    const row = { name: name.trim(), sort_order: max, parent_id: parent || null };
    if (withKind) row.kind = kind || (parent ? rows.find((r) => r.id === parent)?.kind : null) || null;
    const { error } = await supabase.from(table).insert(row);
    if (error) { setErr(error.message); return; }
    setName(""); changed();
  }

  return (
    <div>
      <div className="cat-panel-header">
        {onBack && <button className="btn small" onClick={onBack}>← Назад</button>}
        <h3>{title}</h3>
      </div>
      <p className="note" style={{ marginTop: 0 }}>Категорії можна вкладати одна в одну: оберіть «Батьківська». ▲▼ — порядок серед сусідів. Видалена категорія передає своїх «дітей» на рівень вище.</p>
      {err && <div className="auth-error">{err}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {tree.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: c.depth * 22 }}>
            {canWrite && (
              <span className="cat-reorder">
                <button type="button" onClick={() => move(c, -1)} title="Вище">▲</button>
                <button type="button" onClick={() => move(c, 1)} title="Нижче">▼</button>
              </span>
            )}
            <span aria-hidden="true" style={{ color: "var(--text-muted)", width: 12 }}>{c.depth ? "└" : "•"}</span>
            <input defaultValue={c.name} key={c.id + c.name} disabled={!canWrite} style={{ flex: 1, minWidth: 140 }}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && upd(c, { name: e.target.value.trim() })}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()} aria-label="Назва категорії" />
            {canWrite && (
              <select value={c.parent_id || ""} onChange={(e) => upd(c, { parent_id: e.target.value || null })} style={{ width: 170 }} aria-label="Батьківська категорія">
                <option value="">— верхній рівень —</option>
                {tree.filter((x) => !descendants(c.id).has(x.id)).map((x) => <option key={x.id} value={x.id}>{"  ".repeat(x.depth)}{x.name}</option>)}
              </select>
            )}
            {withKind && (
              <select value={c.kind || ""} onChange={(e) => upd(c, { kind: e.target.value || null })} disabled={!canWrite} style={{ width: 140 }} aria-label="Тип транзакції">
                {TX_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
            {canWrite && <button type="button" className="btn small" style={{ color: "var(--danger)" }} onClick={() => remove(c)}>{sure === c.id ? "Точно?" : "×"}</button>}
          </div>
        ))}
        {!tree.length && <div className="empty">Немає категорій</div>}
      </div>
      {canWrite && (
        <div className="cat-add" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={addPlaceholder} style={{ flex: 1, minWidth: 160 }} />
          <select value={parent} onChange={(e) => setParent(e.target.value)} style={{ width: 180 }} aria-label="Всередині категорії">
            <option value="">— верхній рівень —</option>
            {tree.map((x) => <option key={x.id} value={x.id}>{"  ".repeat(x.depth)}{x.name}</option>)}
          </select>
          {withKind && <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 150 }} aria-label="Тип">{TX_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
          <button className="btn small" onClick={add}>Додати</button>
        </div>
      )}
    </div>
  );
}
