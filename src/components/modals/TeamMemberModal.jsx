"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTeamData } from "@/context/TeamDataContext";
import { ACCESS_LEVELS, MEMBER_TYPES, TEAM_ROLES } from "@/lib/team";

export default function TeamMemberModal({ open, member, onClose, onSaved }) {
  const { supabase, reload } = useTeamData();
  const { canWriteCatalog } = useAuth();
  const [name, setName] = useState("");
  const [role, setRole] = useState(TEAM_ROLES[0]);
  const [type, setType] = useState(MEMBER_TYPES[0]);
  const [accessLevel, setAccessLevel] = useState(ACCESS_LEVELS[2]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setName(member?.name || "");
    setRole(member?.role || TEAM_ROLES[0]);
    setType(member?.type || MEMBER_TYPES[0]);
    setAccessLevel(member?.access_level || ACCESS_LEVELS[2]);
  }, [open, member]);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) { setError("Вкажи ім'я."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { name: name.trim(), role, type, access_level: accessLevel };
      if (member) {
        const { error: e } = await supabase.from("team_members").update(payload).eq("id", member.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("team_members").insert([payload]);
        if (e) throw e;
      }
      await reload();
      onSaved?.();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!member) return;
    if (!confirm("Видалити цього учасника команди?")) return;
    setSaving(true);
    try {
      const { error: e } = await supabase.from("team_members").delete().eq("id", member.id);
      if (e) throw e;
      await reload();
      onSaved?.();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{member ? "Редагувати учасника" : "Новий учасник команди"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Ім&apos;я</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Олена Ковальчук" disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Роль</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={!canWriteCatalog}>
            {TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Тип</label>
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={!canWriteCatalog}>
            {MEMBER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Рівень доступу</label>
          <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)} disabled={!canWriteCatalog}>
            {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="modal-actions">
          {member && canWriteCatalog && <button className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={handleDelete} disabled={saving}>Видалити</button>}
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          {canWriteCatalog && (
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Збереження..." : member ? "Зберегти" : "Додати"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
