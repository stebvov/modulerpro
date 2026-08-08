"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

export default function UnitsModal({ open, onClose }) {
  const { supabase, materials, reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);

  if (!open) return null;

  const counts = new Map();
  materials.forEach((m) => counts.set(m.unit, (counts.get(m.unit) || 0) + 1));
  const units = [...counts.keys()].sort((a, b) => a.localeCompare(b, "uk"));

  async function renameUnit(oldUnit) {
    const next = (drafts[oldUnit] ?? oldUnit).trim();
    if (!next || next === oldUnit) return;
    setSaving(oldUnit);
    setError("");
    try {
      const { error: e } = await supabase.from("materials").update({ unit: next }).eq("unit", oldUnit);
      if (e) throw e;
      setDrafts((d) => { const n = { ...d }; delete n[oldUnit]; return n; });
      await reload(true);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Одиниці виміру</h2>
        {error && <div className="auth-error">{error}</div>}
        <p className="note">
          Окремої довідникової таблиці одиниць немає — це просто значення поля «одиниця» у матеріалах.
          Перейменування тут одразу застосується до всіх матеріалів з такою одиницею.
        </p>
        {units.map((u) => {
          const draft = drafts[u] ?? u;
          const dirty = draft.trim() && draft.trim() !== u;
          return (
            <div key={u} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input
                style={{ flex: 1 }}
                value={draft}
                disabled={!canWriteCatalog}
                onChange={(e) => setDrafts((d) => ({ ...d, [u]: e.target.value }))}
              />
              <span className="note" style={{ minWidth: 110, marginTop: 0 }}>{counts.get(u)} матеріал(ів)</span>
              {dirty && canWriteCatalog && (
                <button className="btn small" onClick={() => renameUnit(u)} disabled={saving === u}>
                  {saving === u ? "..." : "Перейменувати"}
                </button>
              )}
            </div>
          );
        })}
        {!units.length && <div className="empty">Матеріалів ще немає.</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}
