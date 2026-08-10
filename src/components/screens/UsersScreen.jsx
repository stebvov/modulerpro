"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { roleLabels } from "@/lib/format";

const ROLES = ["admin", "manager", "accountant", "partner"];

export default function UsersScreen() {
  const { supabase, profiles, reload, loading: dataLoading, error: dataError } = useAppData();
  const { user, refreshProfile } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [partnerGroups, setPartnerGroups] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [inviteGroupId, setInviteGroupId] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [resetBusyId, setResetBusyId] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [resetCopied, setResetCopied] = useState(false);
  const [blockBusyId, setBlockBusyId] = useState(null);

  useEffect(() => {
    supabase.from("partner_groups").select("*").order("sort_order").then(({ data }) => setPartnerGroups(data || []));
  }, [supabase]);

  async function changeRole(profileId, role) {
    setBusyId(profileId);
    setError("");
    const patch = role === "partner" ? { role } : { role, partner_group_id: null };
    const { error: e } = await supabase.from("profiles").update(patch).eq("id", profileId);
    if (e) setError(e.message);
    await reload(true);
    if (profileId === user?.id) await refreshProfile();
    setBusyId(null);
  }

  async function changeGroup(profileId, partnerGroupId) {
    setBusyId(profileId);
    setError("");
    const { error: e } = await supabase.from("profiles").update({ partner_group_id: partnerGroupId || null }).eq("id", profileId);
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
    setInviteGroupId("");
    setInviteError("");
    setInviteResult(null);
    setCopied(false);
  }

  async function submitInvite() {
    if (!inviteEmail.trim()) { setInviteError("Вкажи email."); return; }
    if (inviteRole === "partner" && !inviteGroupId) { setInviteError("Обери групу доступу для партнера."); return; }
    setInviteBusy(true);
    setInviteError("");
    try {
      const res = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), fullName: inviteName.trim(), role: inviteRole, partnerGroupId: inviteRole === "partner" ? inviteGroupId : null }),
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

  async function resetPassword(p) {
    setResetBusyId(p.id);
    setError("");
    setResetCopied(false);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: p.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не вдалося скинути пароль.");
      setResetResult({ ...data, fullName: p.full_name, role: p.role });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setResetBusyId(null);
    }
  }

  function copyResetInfo() {
    if (!resetResult) return;
    const loginUrl = `${window.location.origin}/login`;
    const text = [
      "Доступ до Moduler Pro",
      `Посилання: ${loginUrl}`,
      `Email: ${resetResult.email}`,
      `Пароль: ${resetResult.password}`,
      `Роль: ${roleLabels[resetResult.role] || resetResult.role}`,
      "Після входу зміни пароль: кнопка «Змінити пароль» біля «Вийти».",
    ].join("\n");
    navigator.clipboard.writeText(text);
    setResetCopied(true);
  }

  async function toggleBlocked(p) {
    const blocked = !p.is_blocked;
    if (blocked && !confirm(`Заблокувати доступ для «${p.full_name || p.id}»? Користувач не зможе увійти.`)) return;
    setBlockBusyId(p.id);
    setError("");
    try {
      const res = await fetch("/api/admin/set-user-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: p.id, blocked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не вдалося змінити статус.");
      await reload(true);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBlockBusyId(null);
    }
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
              {inviteRole === "partner" && (
                <div className="form-row">
                  <label>Група доступу</label>
                  <select value={inviteGroupId} onChange={(e) => setInviteGroupId(e.target.value)}>
                    <option value="">— обери групу —</option>
                    {partnerGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  {!partnerGroups.length && <p className="note">Груп ще немає — створи їх на вкладці «Ролі доступу».</p>}
                </div>
              )}
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

      {resetResult && (
        <div className="card" style={{ padding: 16, marginBottom: 20, cursor: "default" }}>
          <p className="note" style={{ marginTop: 0 }}>
            Пароль для «{resetResult.fullName || resetResult.email}» скинуто. Скопіюй дані нижче і передай користувачу —
            старий пароль більше не діє.
          </p>
          <table>
            <tbody>
              <tr><td className="note">Посилання</td><td>{typeof window !== "undefined" ? `${window.location.origin}/login` : "/login"}</td></tr>
              <tr><td className="note">Email</td><td>{resetResult.email}</td></tr>
              <tr><td className="note">Новий пароль</td><td>{resetResult.password}</td></tr>
              <tr><td className="note">Роль</td><td>{roleLabels[resetResult.role] || resetResult.role}</td></tr>
            </tbody>
          </table>
          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setResetResult(null)}>Закрити</button>
            <button className="btn primary" onClick={copyResetInfo}>{resetCopied ? "Скопійовано ✓" : "Скопіювати"}</button>
          </div>
        </div>
      )}

      <div className="table-scroll">
      <table>
        <thead>
          <tr><th>Ім&apos;я</th><th>Роль</th><th>Група доступу</th><th>Статус</th><th>Створено</th><th></th></tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id}>
              <td>{p.full_name || "—"} {p.id === user?.id && <span className="note">(ви)</span>}</td>
              <td><span className={`role-pill ${p.role}`}>{roleLabels[p.role] || p.role}</span></td>
              <td>
                {p.role === "partner" ? (
                  <select value={p.partner_group_id || ""} disabled={busyId === p.id} onChange={(e) => changeGroup(p.id, e.target.value)}>
                    <option value="">— без групи —</option>
                    {partnerGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : (
                  <span className="note">—</span>
                )}
              </td>
              <td>
                {p.is_blocked ? (
                  <span className="role-pill" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>заблокований</span>
                ) : (
                  <span className="note">активний</span>
                )}
              </td>
              <td>{new Date(p.created_at).toLocaleDateString("uk-UA")}</td>
              <td>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    value={p.role}
                    disabled={busyId === p.id}
                    onChange={(e) => changeRole(p.id, e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{roleLabels[r]}</option>
                    ))}
                  </select>
                  <button className="btn small" disabled={resetBusyId === p.id} onClick={() => resetPassword(p)} title="Скинути пароль і скопіювати доступ">
                    <span className="btn-label-full">🔑 Скинути пароль</span>
                    <span className="btn-label-compact">🔑</span>
                  </button>
                  {p.id !== user?.id && (
                    <button
                      className="btn small"
                      style={p.is_blocked ? undefined : { color: "var(--danger)" }}
                      disabled={blockBusyId === p.id}
                      onClick={() => toggleBlocked(p)}
                      title={p.is_blocked ? "Розблокувати" : "Заблокувати"}
                    >
                      <span className="btn-label-full">{p.is_blocked ? "✅ Розблокувати" : "🚫 Заблокувати"}</span>
                      <span className="btn-label-compact">{p.is_blocked ? "✅" : "🚫"}</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!profiles.length && <tr><td colSpan={6} className="empty">Немає користувачів</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}
