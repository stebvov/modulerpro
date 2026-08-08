"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { roleLabels } from "@/lib/format";

const ROLES = ["admin", "manager", "accountant"];

export default function UsersScreen() {
  const { supabase, profiles, reload, loading: dataLoading, error: dataError } = useAppData();
  const { user, refreshProfile } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [inviteError, setInviteError] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function changeRole(profileId, role) {
    setBusyId(profileId);
    setError("");
    const { error: e } = await supabase.from("profiles").update({ role }).eq("id", profileId);
    if (e) setError(e.message);
    await reload(true);
    if (profileId === user?.id) await refreshProfile();
    setBusyId(null);
  }

  function openInvite() {
    setInviteOpen(true);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("manager");
    setInviteError("");
    setInviteResult(null);
    setCopied(false);
  }

  async function submitInvite() {
    if (!inviteEmail.trim()) { setInviteError("Вкажи email."); return; }
    setInviteBusy(true);
    setInviteError("");
    try {
      const res = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), fullName: inviteName.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не вдалося створити користувача.");
      setInviteResult(data);
      await reload(true);
    } catch (err) {
      setInviteError(err.message || String(err));
    } finally {
      setInviteBusy(false);
    }
  }

  function copyInviteInfo() {
    if (!inviteResult) return;
    const loginUrl = `${window.location.origin}/login`;
    const text = [
      "Доступ до Moduler Pro",
      `Посилання: ${loginUrl}`,
      `Email: ${inviteResult.email}`,
      `Тимчасовий пароль: ${inviteResult.password}`,
      `Роль: ${roleLabels[inviteResult.role] || inviteResult.role}`,
      "Після входу зміни пароль: кнопка «Змінити пароль» біля «Вийти».",
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <div>
      <p className="note">
        Керування ролями користувачів. Адмін має повний доступ, менеджер керує каталогом/матеріалами/постачальниками,
        бухгалтер керує цінами та курсами валют. Самостійна реєстрація вимкнена — новий доступ видається лише через
        запрошення нижче.
      </p>
      {error && <div className="auth-error">{error}</div>}

      <div className={`live-badge${dataError ? " error" : ""}`} style={{ marginBottom: 16 }}>
        <span className="live-dot" />
        <span>{dataLoading ? "Підключення..." : dataError ? "Помилка підключення: " + dataError : "Підключено до Supabase"}</span>
      </div>

      <div className="toolbar">
        <div className="toolbar-left" />
        {!inviteOpen && <button className="btn primary" onClick={openInvite}>+ Запросити користувача</button>}
      </div>

      {inviteOpen && (
        <div className="card" style={{ padding: 16, marginBottom: 20, cursor: "default" }}>
          {!inviteResult ? (
            <>
              {inviteError && <div className="auth-error">{inviteError}</div>}
              <div className="form-row">
                <label>Email</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@company.com" />
              </div>
              <div className="form-row">
                <label>Ім&apos;я (необов&apos;язково)</label>
                <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Ім'я Прізвище" />
              </div>
              <div className="form-row">
                <label>Роль</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                </select>
              </div>
              <div className="modal-actions" style={{ marginTop: 4 }}>
                <button className="btn" onClick={() => setInviteOpen(false)} disabled={inviteBusy}>Скасувати</button>
                <button className="btn primary" onClick={submitInvite} disabled={inviteBusy}>
                  {inviteBusy ? "Створення..." : "Створити доступ"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                Акаунт створено. Скопіюй дані нижче і передай користувачу (email, месенджер тощо) — пароль
                тимчасовий, користувач зможе змінити його сам після входу.
              </p>
              <table>
                <tbody>
                  <tr><td className="note">Посилання</td><td>{typeof window !== "undefined" ? `${window.location.origin}/login` : "/login"}</td></tr>
                  <tr><td className="note">Email</td><td>{inviteResult.email}</td></tr>
                  <tr><td className="note">Тимчасовий пароль</td><td>{inviteResult.password}</td></tr>
                  <tr><td className="note">Роль</td><td>{roleLabels[inviteResult.role] || inviteResult.role}</td></tr>
                </tbody>
              </table>
              <div className="modal-actions" style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setInviteOpen(false)}>Закрити</button>
                <button className="btn primary" onClick={copyInviteInfo}>{copied ? "Скопійовано ✓" : "Скопіювати"}</button>
              </div>
            </>
          )}
        </div>
      )}

      <table>
        <thead>
          <tr><th>Ім&apos;я</th><th>Роль</th><th>Створено</th><th></th></tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id}>
              <td>{p.full_name || "—"} {p.id === user?.id && <span className="note">(ви)</span>}</td>
              <td><span className={`role-pill ${p.role}`}>{roleLabels[p.role] || p.role}</span></td>
              <td>{new Date(p.created_at).toLocaleDateString("uk-UA")}</td>
              <td>
                <select
                  value={p.role}
                  disabled={busyId === p.id}
                  onChange={(e) => changeRole(p.id, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{roleLabels[r]}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {!profiles.length && <tr><td colSpan={4} className="empty">Немає користувачів</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
