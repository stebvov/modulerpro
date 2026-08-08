"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTeamData } from "@/context/TeamDataContext";
import TeamMemberModal from "@/components/modals/TeamMemberModal";
import {
  ACCESS_MATRIX,
  ACCESS_MATRIX_COLUMNS,
  MEMBER_TYPES,
  TEAM_ROLES,
  accessLevelStyles,
  memberTypeStyles,
} from "@/lib/team";

const MATRIX_CELL_LABEL = { rw: "RW", r: "R", none: "—" };

export default function TeamScreen() {
  const { loading, error, members } = useTeamData();
  const { canWriteCatalog } = useAuth();
  const [roleFilter, setRoleFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modal, setModal] = useState(null);

  const filtered = useMemo(
    () => members.filter((m) => (!roleFilter || m.role === roleFilter) && (!typeFilter || m.type === typeFilter)),
    [members, roleFilter, typeFilter]
  );

  if (loading) return <div className="empty">Завантаження команди...</div>;
  if (error) return <div className="empty">Помилка підключення: {error}</div>;

  return (
    <div>
      <p className="note">Реєстр команди (люди, AI-агенти, бригади) і матриця доступу по шарах — правило UI, не окрема таблиця.</p>

      <div className="section-label">Команда</div>
      <div className="toolbar">
        <div className="toolbar-left">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Роль: усі</option>
            {TEAM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Тип: усі</option>
            {MEMBER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="note" style={{ marginTop: 0 }}>{filtered.length} з {members.length} записів</span>
        </div>
        {canWriteCatalog && (
          <button className="btn primary" onClick={() => setModal({ member: null })}>+ Додати</button>
        )}
      </div>

      <div className="table-scroll">
      <table>
        <thead>
          <tr><th>Ім&apos;я</th><th>Роль</th><th>Тип</th><th>Доступ</th><th></th></tr>
        </thead>
        <tbody>
          {filtered.map((m) => {
            const typeStyle = memberTypeStyles[m.type] || memberTypeStyles["людина"];
            const accessStyle = accessLevelStyles[m.access_level] || accessLevelStyles["виконавець"];
            return (
              <tr key={m.id} style={{ cursor: canWriteCatalog ? "pointer" : "default" }} onClick={() => canWriteCatalog && setModal({ member: m })}>
                <td><strong>{m.name}</strong></td>
                <td><span className="tag">{m.role}</span></td>
                <td><span style={{ background: typeStyle.bg, color: typeStyle.text, borderRadius: 6, padding: "3px 8px", fontSize: 12 }}>{m.type}</span></td>
                <td><span style={{ background: accessStyle.bg, color: accessStyle.text, borderRadius: 6, padding: "3px 8px", fontSize: 12 }}>{m.access_level}</span></td>
                <td></td>
              </tr>
            );
          })}
          {!filtered.length && (
            <tr><td colSpan={5} className="empty">Нікого не знайдено.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      <div className="section-label">Матриця доступу</div>
      <p className="note">
        Визначає, що бачить і що може редагувати кожна роль. Рядки з позначкою «запропоновано» — ролі «монтаж» і
        «логістика» з&apos;явилися у даних команди, але не описані в оригінальному ТЗ.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Роль</th>
              {ACCESS_MATRIX_COLUMNS.map((c) => <th key={c} style={{ textAlign: "center" }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {ACCESS_MATRIX.map((row) => (
              <tr key={row.role} style={row.proposed ? { background: "var(--amber-bg)" } : undefined}>
                <td>
                  {row.role}
                  {row.proposed && <span className="note" style={{ marginLeft: 6 }}>запропоновано</span>}
                </td>
                {row.cells.map((c, i) => (
                  <td key={i} style={{ textAlign: "center", color: c === "rw" ? "var(--accent)" : c === "r" ? "var(--text-secondary)" : "var(--text-muted)", fontWeight: c === "rw" ? 600 : 400 }}>
                    {MATRIX_CELL_LABEL[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="note" style={{ marginTop: 8 }}>
        RW — читання + редагування · R — лише перегляд · — — немає доступу
      </div>

      {modal && (
        <TeamMemberModal
          open
          member={modal.member}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
    </div>
  );
}
