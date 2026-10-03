"use client";

// Вакансії й кандидати: вакансія з профілю посади → оголошення (сайт «Кар'єра», сайти вакансій) → воронка відбору:
// відгук → скринінг → тест → співбесіда → завдання → рекомендації → пропозиція → прийнято (створюється план адаптації).
import { useMemo, useState } from "react";
import { useRows } from "@/lib/mod";
import { SIDE_STAGES, SLA_NEW_DAYS, SOURCES, STAGES, VAC_STATUS, candidateScore, daysBetween, fmtDate, stageLabel, todayISO, useHrMe } from "@/lib/hr";
import SearchFilter from "@/components/SearchFilter";
import { Copy, Field, Modal } from "./ui";
import HrText from "./HrText";
import CandidateModal from "./CandidateModal";

const onlyCand = (q) => q.not("candidate_id", "is", null);
const SITE = "https://moduler.pro";

function VacancyModal({ vac, roles, members, supabase, onSaved, onDelete, onClose }) {
  const [v, setV] = useState(() => vac || { title: "", role_id: roles[0]?.id || null, status: "draft", headcount: 1, city: "Київ", format: "", conditions: "", description: roles[0]?.job_ad || "", on_site: false, owner_id: null, deadline: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false);
  const role = roles.find((r) => r.id === v.role_id);
  const set = (p) => setV((x) => ({ ...x, ...p }));

  async function save() {
    if (!v.title.trim()) { setErr("Вкажіть назву вакансії"); return; }
    if (v.on_site && v.status === "open" && !String(v.description || "").trim()) { setErr("Для показу на сайті потрібен текст оголошення"); return; }
    setBusy(true); setErr("");
    const row = { title: v.title.trim(), role_id: v.role_id || null, status: v.status, headcount: Number(v.headcount) || 1, city: v.city || null, format: v.format || null,
      conditions: v.conditions || null, description: v.description || null, on_site: !!v.on_site, owner_id: v.owner_id || null, deadline: v.deadline || null,
      opened_at: v.status === "open" ? v.opened_at || todayISO() : v.opened_at || null, closed_at: v.status === "closed" ? v.closed_at || todayISO() : null };
    const q = vac ? supabase.from("hr_vacancies").update(row).eq("id", vac.id) : supabase.from("hr_vacancies").insert(row);
    const { data, error } = await q.select().single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    // сторінка «Кар'єра» на сайті кешується — скидаємо кеш, щоб зміни було видно одразу
    try { await fetch("/api/site/revalidate", { method: "POST" }); } catch { /* сайт оновиться сам за кілька хвилин */ }
    onSaved(data, !vac);
  }

  const adText = `${v.title}\n\n${String(v.description || "").replace(/\*\*/g, "")}${v.conditions ? `\n\nУмови: ${v.conditions}` : ""}\n\nВідгукнутися: ${SITE}/kariera`;
  return (
    <Modal wide title={vac ? "Вакансія" : "Нова вакансія"} onClose={onClose}
      actions={<>
        {vac && <button type="button" className="btn small" style={{ marginRight: "auto" }} onClick={() => { if (!sure) { setSure(true); setTimeout(() => setSure(false), 4000); return; } onDelete(vac.id); }}>{sure ? "Точно видалити?" : "Видалити"}</button>}
        <button type="button" className="btn" onClick={onClose}>Скасувати</button>
        <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? "Зберігаємо…" : "Зберегти"}</button>
      </>}>
      {err && <div className="auth-error">{err}</div>}
      <div className="hr-grid2">
        <Field label="Посада (профіль)">
          <select value={v.role_id || ""} onChange={(e) => { const r = roles.find((x) => x.id === e.target.value); set({ role_id: e.target.value || null, ...(!vac && r ? { title: v.title || r.name, description: r.job_ad || "" } : {}) }); }}>
            <option value="">— без профілю —</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Назва вакансії (як побачить кандидат)"><input type="text" value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder={role?.name || ""} /></Field>
        <Field label="Стан"><select value={v.status} onChange={(e) => set({ status: e.target.value })}>{VAC_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Скільки людей шукаємо"><input type="text" inputMode="numeric" value={v.headcount ?? 1} onChange={(e) => set({ headcount: e.target.value.replace(/\D/g, "") })} /></Field>
        <Field label="Місто"><input type="text" value={v.city || ""} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="Формат (офіс, виїзди, графік)"><input type="text" value={v.format || ""} onChange={(e) => set({ format: e.target.value })} placeholder="напр. офіс у Києві + шоурум, пн–пт" /></Field>
        <Field label="Хто наймає"><select value={v.owner_id || ""} onChange={(e) => set({ owner_id: e.target.value || null })}><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Закрити до"><input type="date" value={v.deadline || ""} onChange={(e) => set({ deadline: e.target.value || null })} /></Field>
      </div>
      <Field label="Умови: оплата, відсоток, графік" hint="Чесна вилка оплати помітно збільшує кількість відгуків. Поле показується кандидатам, якщо заповнене.">
        <textarea rows={2} value={v.conditions || ""} onChange={(e) => set({ conditions: e.target.value })} placeholder="напр. ставка … + відсоток від договорів, пн–пт 9–18" />
      </Field>
      <Field label="Текст оголошення (**жирний**, «- » — пункт списку)">
        <textarea rows={12} value={v.description || ""} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
        {role?.job_ad && <button type="button" className="btn small" onClick={() => set({ description: role.job_ad })}>Взяти текст із профілю посади</button>}
        <Copy text={adText} label="Скопіювати оголошення для сайтів вакансій" />
      </div>
      <label className="tag-check" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={!!v.on_site} onChange={(e) => set({ on_site: e.target.checked })} /> Показувати на сайті — сторінка «Кар’єра» ({SITE}/kariera). Працює лише для стану «відкрита».
      </label>
      <p className="note">Щоб бачити, звідки приходять кандидати, давайте на кожному майданчику своє посилання: {SITE}/kariera?utm_source=work.ua — мітка потрапить у картку кандидата.</p>
      {v.description && <details className="hr-q"><summary>Як це побачить кандидат</summary><HrText text={v.description} /></details>}
    </Modal>
  );
}

export default function HrHiringScreen() {
  const { canHr, who, loading: meLoading, supabase } = useHrMe();
  const roles = useRows("hr_roles", { order: "sort" });
  const vacs = useRows("hr_vacancies", { order: "created_at" });
  const cands = useRows("hr_candidates", { order: "created_at", ascending: false });
  const evals = useRows("hr_evals", { order: "created_at", ascending: false, filter: onlyCand });
  const attempts = useRows("hr_attempts", { order: "created_at", ascending: false, filter: onlyCand });
  const tests = useRows("hr_tests", { order: "sort" });
  const members = useRows("task_members", { order: "sort", select: "id,name,active,is_ai" });
  const [vacId, setVacId] = useState("");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [side, setSide] = useState(""); // "" | reserve | rejected
  const [openId, setOpenId] = useState(null);
  const [vacModal, setVacModal] = useState(undefined); // undefined — закрито, null — нова
  const [adding, setAdding] = useState(false);
  const [newC, setNewC] = useState({ full_name: "", phone: "", source: "рекомендація" });
  const [msg, setMsg] = useState("");

  const people = members.rows.filter((m) => m.active && !m.is_ai);
  const s = q.trim().toLowerCase();
  const list = useMemo(() => cands.rows.filter((c) =>
    (!vacId || c.vacancy_id === vacId) && (!source || c.source === source) &&
    (!s || [c.full_name, c.phone, c.email, c.city, c.notes].join(" ").toLowerCase().includes(s))), [cands.rows, vacId, source, s]);

  const stats = useMemo(() => {
    const base = cands.rows.filter((c) => !vacId || c.vacancy_id === vacId);
    const active = base.filter((c) => !["hired", "rejected", "reserve"].includes(c.stage));
    const late = active.filter((c) => c.stage === "new" && daysBetween(c.stage_at, new Date()) >= SLA_NEW_DAYS).length;
    const hired = base.filter((c) => c.stage === "hired");
    const ttf = hired.length ? Math.round(hired.reduce((a, c) => a + daysBetween(c.created_at, c.stage_at), 0) / hired.length) : null;
    const bySrc = {};
    for (const c of base) { const k = c.source || "не вказано"; const x = (bySrc[k] ??= { n: 0, far: 0, hired: 0 }); x.n++; if (["interview", "task", "reference", "offer", "hired"].includes(c.stage)) x.far++; if (c.stage === "hired") x.hired++; }
    const reasons = {};
    for (const c of base.filter((x) => x.stage === "rejected")) { const k = c.reject_reason || "причину не вказано"; reasons[k] = (reasons[k] || 0) + 1; }
    return { total: base.length, active: active.length, late, hired: hired.length, ttf, bySrc: Object.entries(bySrc).sort((a, b) => b[1].n - a[1].n), reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]) };
  }, [cands.rows, vacId]);

  if (meLoading || roles.loading || vacs.loading || cands.loading) return <div className="empty">Завантаження…</div>;
  if (!canHr) return <div className="empty">Розділ доступний тим, хто веде найм. Зверніться до Каті або Володимира.</div>;
  if (cands.error || vacs.error) return <div className="empty">Помилка: {cands.error || vacs.error}</div>;

  async function patch(id, p, localOnly) {
    if (localOnly) { cands.reload(); return; }
    const e = await cands.update(id, p);
    if (e) setMsg(e);
  }
  async function addCandidate() {
    if (!newC.full_name.trim()) { setMsg("Вкажіть ім'я кандидата"); return; }
    const v = vacs.rows.find((x) => x.id === vacId);
    const e = await cands.insert({ full_name: newC.full_name.trim(), phone: newC.phone.trim() || null, source: newC.source || null, vacancy_id: v?.id || null, role_id: v?.role_id || null });
    if (e) { setMsg(e); return; }
    setNewC({ full_name: "", phone: "", source: newC.source }); setAdding(false); setMsg("");
    cands.reload();
  }
  const next = (c) => { const i = STAGES.findIndex(([k]) => k === c.stage); return i >= 0 && i < STAGES.length - 2 ? STAGES[i + 1][0] : null; }; // «Прийнято» — лише через рішення в картці
  const open = cands.rows.find((c) => c.id === openId);
  const vacName = (id) => vacs.rows.find((v) => v.id === id)?.title || "без вакансії";

  const card = (c) => {
    const days = daysBetween(c.stage_at, new Date());
    const lateNew = c.stage === "new" && days >= SLA_NEW_DAYS;
    const score = candidateScore(c, evals.rows);
    const waiting = attempts.rows.some((a) => a.candidate_id === c.id && a.status === "done");
    const n = next(c);
    return (
      <div className="card kanban-card hr-cand" key={c.id} onClick={(e) => { if (!e.target.closest("button,a")) setOpenId(c.id); }} title="Відкрити картку кандидата">
        <h3>{c.full_name}</h3>
        <div className="note" style={{ marginTop: 0 }}>{!vacId && `${vacName(c.vacancy_id)} · `}{c.source || "джерело не вказано"}{c.city ? ` · ${c.city}` : ""}</div>
        <div className="hr-chips">
          {score != null && <span className="badge active" title="Загальна оцінка">{score}%</span>}
          {c.score_test != null && <span className="tag">тест {Math.round(c.score_test)}%</span>}
          {waiting && <span className="tag" style={{ color: "var(--danger)" }}>перевірити тест</span>}
          <span className={`tag${lateNew ? " hr-late" : ""}`} title={lateNew ? `Новий відгук без відповіді ${days} дн. — стандарт ${SLA_NEW_DAYS} дні` : "Днів на цьому етапі"}>{days} дн.</span>
        </div>
        {c.next_note && <div className="note">→ {c.next_at ? `${fmtDate(c.next_at)}: ` : ""}{c.next_note}</div>}
        {n && <button type="button" className="btn small" style={{ marginTop: 8, alignSelf: "flex-start" }} onClick={() => patch(c.id, { stage: n, stage_at: new Date().toISOString() })}>{stageLabel(n)} →</button>}
      </div>
    );
  };

  return (
    <div>
      <p className="note">Наймаємо за профілем посади: однакові питання всім, оцінка кожної компетенції, тест і практичне завдання. Новому відгуку відповідаємо протягом {SLA_NEW_DAYS} робочих днів — і тим, кому відмовляємо.</p>

      <div className="hr-vacs">
        <button type="button" className={`hr-vac${!vacId ? " on" : ""}`} onClick={() => setVacId("")}>
          <b>Усі кандидати</b><span className="note">{cands.rows.filter((c) => !["hired", "rejected", "reserve"].includes(c.stage)).length} у роботі</span>
        </button>
        {vacs.rows.map((v) => {
          const mine = cands.rows.filter((c) => c.vacancy_id === v.id);
          return (
            <div key={v.id} className={`hr-vac${vacId === v.id ? " on" : ""}`} role="button" tabIndex={0} onClick={() => setVacId(vacId === v.id ? "" : v.id)} onKeyDown={(e) => e.key === "Enter" && setVacId(v.id)}>
              <b>{v.title}</b>
              <span className="hr-chips">
                <span className={`badge ${v.status === "open" ? "active" : "draft"}`}>{VAC_STATUS.find(([k]) => k === v.status)?.[1]}</span>
                {v.on_site && v.status === "open" && <span className="tag">на сайті</span>}
                <span className="note" style={{ margin: 0 }}>{mine.filter((c) => !["hired", "rejected", "reserve"].includes(c.stage)).length} у роботі · {mine.filter((c) => c.stage === "hired").length}/{v.headcount} прийнято</span>
              </span>
              <button type="button" className="btn small" onClick={(e) => { e.stopPropagation(); setVacModal(v); }}>Відкрити</button>
            </div>
          );
        })}
        <button type="button" className="hr-vac hr-vac--add" onClick={() => setVacModal(null)}>+ Вакансія</button>
      </div>

      <div className="toolbar">
        <SearchFilter value={q} onChange={setQ} placeholder="Пошук кандидата: ім'я, телефон, місто…" active={source ? 1 : 0} onReset={() => setSource("")}>
          <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Джерело"><option value="">Усі джерела</option>{[...new Set([...SOURCES, ...cands.rows.map((c) => c.source).filter(Boolean)])].map((x) => <option key={x}>{x}</option>)}</select>
        </SearchFilter>
        <div className="toolbar-actions">
          {SIDE_STAGES.map(([k, l]) => <button key={k} type="button" className={`btn${side === k ? " primary" : ""}`} onClick={() => setSide(side === k ? "" : k)}>{l} ({list.filter((c) => c.stage === k).length})</button>)}
          <button type="button" className="btn primary" onClick={() => setAdding(!adding)}>+ Кандидат</button>
        </div>
      </div>
      {adding && (
        <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Ім'я та прізвище" value={newC.full_name} onChange={(e) => setNewC({ ...newC, full_name: e.target.value })} style={{ width: 220 }} autoFocus onKeyDown={(e) => e.key === "Enter" && addCandidate()} />
          <input type="text" placeholder="Телефон" value={newC.phone} onChange={(e) => setNewC({ ...newC, phone: e.target.value })} style={{ width: 160 }} />
          <select value={newC.source} onChange={(e) => setNewC({ ...newC, source: e.target.value })}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select>
          <button type="button" className="btn primary" onClick={addCandidate}>Додати{vacId ? ` до «${vacName(vacId)}»` : ""}</button>
        </div>
      )}
      {msg && <div className="auth-error">{msg}</div>}

      <div className="ops-kpi-grid">
        <div className="ops-kpi"><div className="k-label">У роботі</div><div className="k-value">{stats.active}</div><div className="note">усього відгуків: {stats.total}</div></div>
        <div className="ops-kpi"><div className="k-label">Нові без відповіді понад {SLA_NEW_DAYS} дні</div><div className="k-value" style={{ color: stats.late ? "var(--danger)" : "var(--success)" }}>{stats.late}</div></div>
        <div className="ops-kpi"><div className="k-label">Прийнято</div><div className="k-value">{stats.hired}</div><div className="note">{stats.total ? `${Math.round((stats.hired / stats.total) * 100)}% від відгуків` : "—"}</div></div>
        <div className="ops-kpi"><div className="k-label">Від відгуку до найму</div><div className="k-value">{stats.ttf != null ? `${stats.ttf} дн.` : "—"}</div></div>
      </div>

      {side ? (
        <div className="hr-cards">
          {list.filter((c) => c.stage === side).map(card)}
          {!list.some((c) => c.stage === side) && <div className="empty">Порожньо</div>}
        </div>
      ) : (
        <div className="kanban-board">
          {STAGES.map(([k, l]) => {
            const col = list.filter((c) => c.stage === k);
            return (
              <div className="kanban-col" key={k}>
                <div className="kanban-col-head"><b>{l}</b> <span className="note">{col.length}</span></div>
                {col.map(card)}
                {!col.length && <div className="kanban-empty">—</div>}
              </div>
            );
          })}
        </div>
      )}

      {stats.total > 0 && (
        <div className="hr-grid2" style={{ marginTop: 20 }}>
          <div>
            <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>Звідки приходять кандидати</h3>
            <div className="table-scroll"><table>
              <thead><tr><th>Джерело</th><th style={{ textAlign: "right" }}>Відгуків</th><th style={{ textAlign: "right" }}>Дійшли до співбесіди</th><th style={{ textAlign: "right" }}>Прийнято</th></tr></thead>
              <tbody>{stats.bySrc.map(([k, x]) => <tr key={k}><td>{k}</td><td style={{ textAlign: "right" }}>{x.n}</td><td style={{ textAlign: "right" }}>{x.far}</td><td style={{ textAlign: "right" }}>{x.hired}</td></tr>)}</tbody>
            </table></div>
          </div>
          <div>
            <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>Чому відмовляємо</h3>
            {stats.reasons.length ? (
              <div className="table-scroll"><table><tbody>{stats.reasons.map(([k, n]) => <tr key={k}><td>{k}</td><td style={{ textAlign: "right" }}>{n}</td></tr>)}</tbody></table></div>
            ) : <div className="note">Відмов ще не було.</div>}
          </div>
        </div>
      )}

      {open && (
        <CandidateModal key={open.id} cand={open} roles={roles.rows} vacs={vacs.rows} tests={tests.rows} evals={evals.rows} attempts={attempts.rows} members={people}
          who={who} supabase={supabase} onClose={() => setOpenId(null)} onPatch={patch}
          onEval={(e, removeId) => { if (removeId) evals.remove(removeId); else evals.reload(); }}
          onAttempt={() => attempts.reload()}
          onDelete={async (id) => { const e = await cands.remove(id); if (e) setMsg(e); else setOpenId(null); }} />
      )}
      {vacModal !== undefined && (
        <VacancyModal vac={vacModal} roles={roles.rows} members={people} supabase={supabase} onClose={() => setVacModal(undefined)}
          onSaved={() => { vacs.reload(); setVacModal(undefined); }}
          onDelete={async (id) => { const e = await vacs.remove(id); if (e) setMsg(e); setVacModal(undefined); if (vacId === id) setVacId(""); }} />
      )}
    </div>
  );
}
