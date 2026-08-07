"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { roleLabels } from "@/lib/format";

const ROLES = ["admin", "manager", "accountant"];

export default function UsersScreen() {
  const { supabase, profiles, reload } = useAppData();
  const { user, refreshProfile } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  async function changeRole(profileId, role) {
    setBusyId(profileId);
    setError("");
    const { error: e } = await supabase.from("profiles").update({ role }).eq("id", profileId);
    if (e) setError(e.message);
    await reload(true);
    if (profileId === user?.id) await refreshProfile();
    setBusyId(null);
  }

  return (
    <div>
      <p className="note">
        Керування ролями користувачів. Адмін має повний доступ, менеджер керує каталогом/матеріалами/постачальниками,
        бухгалтер керує цінами та курсами валют.
      </p>
      {error && <div className="auth-error">{error}</div>}
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
