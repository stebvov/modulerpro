"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordModal({ open, onClose }) {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function handleClose() {
    setPassword("");
    setConfirm("");
    setError("");
    setDone(false);
    onClose();
  }

  async function handleSave() {
    if (password.length < 6) { setError("Пароль має бути не менше 6 символів."); return; }
    if (password !== confirm) { setError("Паролі не збігаються."); return; }
    setSaving(true);
    setError("");
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      setDone(true);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal">
        <h2>Змінити пароль</h2>
        {error && <div className="auth-error">{error}</div>}
        {done ? (
          <p className="note">Пароль змінено.</p>
        ) : (
          <>
            <div className="form-row">
              <label>Новий пароль</label>
              <input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="form-row">
              <label>Повторити пароль</label>
              <input type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>
          </>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={handleClose} disabled={saving}>{done ? "Закрити" : "Скасувати"}</button>
          {!done && (
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Збереження..." : "Зберегти"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
