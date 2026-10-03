"use client";

// Адаптація: план на 90 днів для кожного новачка — навчання, завдання, зустрічі й контрольні точки (30 / 60 / 90 днів).
// План створюється з профілю посади, коли кандидата приймають, або вручну. Новачок сам відмічає виконане.
import { useState } from "react";
import { useRows } from "@/lib/mod";
import { EVAL_KINDS, STEP_KINDS, STEP_WHO, addDays, daysBetween, fmtDate, todayISO, uid, useHrMe, verdictLabel } from "@/lib/hr";
import { Bar, Field, ListEditor, Modal } from "./ui";
import EvalForm from "./EvalForm";

const STATUS = [["active", "триває"], ["passed", "пройдено"], ["extended", "продовжено"], ["failed", "не пройдено"]];
const PHASES = [[7, "Перший тиждень"], [30, "До 30 днів"], [60, "31–60 днів"], [9999, "61–90 днів"]];
const STEP_FIELDS = [
  { key: "day", label: "День", type: "number", width: 64 },
  { key: "title", label: "Що зробити", type: "area" },
  { key: "kind", label: "Тип", type: "select", width: 150, options: Object.entries(STEP_KINDS) },
  { key: "who", label: "Хто", type: "select", width: 140, options: Object.entries(STEP_WHO) },
];

export function planStats(p) {
  const steps = p.steps || [];
  const day = daysBetween(p.start_date, todayISO()) + 1;
  const done = steps.filter((s) => s.done_at).length;
  const overdue = steps.filter((s) => !s.done_at && Number(s.day) < day).length;
  return { day, done, total: steps.length, pct: steps.length ? (done / steps.length) * 100 : 0, overdue };
}

// План із кроками: бачить і HR, і сам новачок (onToggle відмічає крок)
export function PlanView({ plan, onToggle, courses = [], tests = [], onOpenRef, onCheck }) {
  const st = planStats(plan);
  const steps = [...(plan.steps || [])].sort((a, b) => Number(a.day) - Number(b.day));
  return (
    <div>
      <div className="hr-planhead">
        <div><b>{Math.round(st.pct)}%</b> <span className="note">виконано {st.done} з {st.total}</span></div>
        <Bar pct={st.pct} state={st.overdue ? "warn" : "ok"} />
        <div className="note">{st.day < 1 ? `старт ${fmtDate(plan.start_date)}` : `день ${Math.min(st.day, 999)} · старт ${fmtDate(plan.start_date)}`}{st.overdue ? ` · прострочено кроків: ${st.overdue}` : ""}</div>
      </div>
      {PHASES.map(([lim, label], pi) => {
        const from = pi ? PHASES[pi - 1][0] : 0;
        const group = steps.filter((s) => Number(s.day) > from && Number(s.day) <= lim);
        if (!group.length) return null;
        return (
          <div key={label}>
            <h4 className="hr-phase">{label}</h4>
            {group.map((s) => {
              const late = !s.done_at && Number(s.day) < st.day;
              const [rk, rv] = String(s.ref || "").split(":");
              const ref = rk === "course" ? courses.find((c) => c.key === rv) : rk === "test" ? tests.find((t) => t.key === rv) : null;
              return (
                <div className={`hr-step${s.done_at ? " done" : late ? " late" : ""}`} key={s.id}>
                  <input type="checkbox" checked={!!s.done_at} onChange={(e) => onToggle?.(s, e.target.checked)} disabled={!onToggle} aria-label={s.title} />
                  <div>
                    <div className="hr-step__t">{s.title}</div>
                    <div className="note">
                      День {s.day} · {fmtDate(addDays(plan.start_date, Number(s.day) - 1))} · {STEP_KINDS[s.kind] || s.kind} · {STEP_WHO[s.who] || s.who}
                      {s.done_at ? ` · зроблено ${fmtDate(s.done_at)}` : late ? " · прострочено" : ""}
                    </div>
                    {s.comment && <div className="note">💬 {s.comment}</div>}
                  </div>
                  <span className="hr-step__act">
                    {ref && onOpenRef && <button type="button" className="btn small" onClick={() => onOpenRef(rk, ref)}>{rk === "course" ? "Відкрити курс" : "До тесту"}</button>}
                    {s.kind === "check" && onCheck && <button type="button" className="btn small" onClick={() => onCheck(s)}>Оцінити</button>}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function HrOnboardingScreen() {
  const { canHr, who, loading: meLoading, supabase } = useHrMe();
  const plans = useRows("hr_onboarding", { order: "start_date", ascending: false });
  const roles = useRows("hr_roles", { order: "sort" });
  const members = useRows("task_members", { order: "sort", select: "id,name,active,is_ai,hr_role" });
  const evals = useRows("hr_evals", { order: "created_at", ascending: false });
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ member_id: "", person: "", role_id: "", start_date: todayISO(), mentor_id: "" });
  const [editSteps, setEditSteps] = useState(null);
  const [check, setCheck] = useState(null);
  const [msg, setMsg] = useState("");
  const [showDone, setShowDone] = useState(false);

  if (meLoading || plans.loading || roles.loading) return <div className="empty">Завантаження…</div>;
  if (!canHr) return <div className="empty">Розділ доступний тим, хто веде найм і адаптацію. Свій план ви бачите у «Мій розвиток».</div>;
  if (plans.error) return <div className="empty">Помилка: {plans.error}</div>;

  const people = members.rows.filter((m) => m.active && !m.is_ai);
  const name = (p) => people.find((m) => m.id === p.member_id)?.name || p.person || "—";
  const roleOf = (p) => roles.rows.find((r) => r.id === p.role_id);
  const plan = plans.rows.find((p) => p.id === openId);

  async function create() {
    const role = roles.rows.find((r) => r.id === draft.role_id);
    if (!role) { setMsg("Оберіть посаду — план береться з її профілю"); return; }
    if (!draft.member_id && !draft.person.trim()) { setMsg("Вкажіть людину: оберіть із команди або впишіть ім'я"); return; }
    const steps = (role.onboarding || []).map((s) => ({ ...s, id: s.id || uid(), done_at: null }));
    const e = await plans.insert({ member_id: draft.member_id || null, person: draft.person.trim() || null, role_id: role.id, start_date: draft.start_date, mentor_id: draft.mentor_id || null, steps });
    if (e) { setMsg(e); return; }
    if (draft.member_id) await supabase.rpc("hr_set_role", { p_member: draft.member_id, p_role: role.key });
    setCreating(false); setMsg(""); plans.reload(); members.reload();
  }
  async function toggle(p, s, on) {
    const { data, error } = await supabase.rpc("hr_step_toggle", { p_plan: p.id, p_step: s.id, p_done: on });
    if (error || !data?.ok) { setMsg(data?.error || error?.message); return; }
    plans.reload();
  }
  async function linkMember(p, id) {
    const e = await plans.update(p.id, { member_id: id || null });
    if (e) { setMsg(e); return; }
    const role = roleOf(p);
    if (id && role) { await supabase.rpc("hr_set_role", { p_member: id, p_role: role.key }); members.reload(); }
  }

  const list = plans.rows.filter((p) => showDone || p.status === "active" || p.status === "extended");
  return (
    <div>
      <p className="note">Перші 90 днів вирішують, чи залишиться людина і чи вийде на результат. У кожного новачка — план із контрольними точками на 30, 60 і 90 день, наставник і щотижнева зустріч 1:1.</p>
      <div className="toolbar">
        <label className="tag-check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> показати завершені</label>
        <div className="toolbar-actions"><button type="button" className="btn primary" onClick={() => setCreating(true)}>+ План адаптації</button></div>
      </div>
      {msg && <div className="auth-error">{msg}</div>}
      <div className="table-scroll">
        <table>
          <thead><tr><th>Людина</th><th>Посада</th><th>Старт</th><th>День</th><th style={{ minWidth: 160 }}>Виконано</th><th>Прострочено</th><th>Наставник</th><th>Стан</th></tr></thead>
          <tbody>
            {list.map((p) => {
              const st = planStats(p);
              return (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(p.id)} title="Відкрити план">
                  <td><b>{name(p)}</b>{!p.member_id && <div className="note">ще не в команді — прив’яжіть, щоб людина бачила план</div>}</td>
                  <td>{roleOf(p)?.name || "—"}</td>
                  <td>{fmtDate(p.start_date)}</td>
                  <td>{st.day < 1 ? "ще не почав" : Math.min(st.day, 999)}</td>
                  <td><Bar pct={st.pct} state={st.overdue ? "warn" : "ok"} /><span className="note">{st.done} з {st.total}</span></td>
                  <td className={st.overdue ? "stale" : "fresh"}>{st.overdue || "—"}</td>
                  <td>{people.find((m) => m.id === p.mentor_id)?.name || <span className="stale">не призначено</span>}</td>
                  <td>{STATUS.find(([k]) => k === p.status)?.[1]}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={8} className="empty">Планів адаптації ще немає. План створюється сам, коли кандидата приймають на роботу, — або кнопкою «+ План адаптації».</td></tr>}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal title="Новий план адаптації" onClose={() => setCreating(false)}
          actions={<><button type="button" className="btn" onClick={() => setCreating(false)}>Скасувати</button><button type="button" className="btn primary" onClick={create}>Створити план</button></>}>
          <Field label="Людина з команди"><select value={draft.member_id} onChange={(e) => setDraft({ ...draft, member_id: e.target.value })}><option value="">— ще не в команді —</option>{people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
          {!draft.member_id && <Field label="Ім'я (якщо ще не додано в команду)"><input type="text" value={draft.person} onChange={(e) => setDraft({ ...draft, person: e.target.value })} /></Field>}
          <Field label="Посада"><select value={draft.role_id} onChange={(e) => setDraft({ ...draft, role_id: e.target.value })}><option value="">— оберіть —</option>{roles.rows.map((r) => <option key={r.id} value={r.id}>{r.name} · {(r.onboarding || []).length} кроків</option>)}</select></Field>
          <Field label="Перший робочий день"><input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value || todayISO() })} /></Field>
          <Field label="Наставник"><select value={draft.mentor_id} onChange={(e) => setDraft({ ...draft, mentor_id: e.target.value })}><option value="">—</option>{people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        </Modal>
      )}

      {plan && (
        <Modal wide title={`Адаптація: ${name(plan)}`} onClose={() => setOpenId(null)}>
          <div className="hr-grid2">
            <Field label="Хто це в команді" hint="Після прив'язки людина бачить план у «Мій розвиток» і отримує посаду з її навчанням.">
              <select value={plan.member_id || ""} onChange={(e) => linkMember(plan, e.target.value)}><option value="">— ще не в команді —</option>{people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </Field>
            <Field label="Наставник"><select value={plan.mentor_id || ""} onChange={(e) => plans.update(plan.id, { mentor_id: e.target.value || null })}><option value="">—</option>{people.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
            <Field label="Перший робочий день"><input type="date" value={plan.start_date} onChange={(e) => e.target.value && plans.update(plan.id, { start_date: e.target.value })} /></Field>
            <Field label="Стан"><select value={plan.status} onChange={(e) => plans.update(plan.id, { status: e.target.value })}>{STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          </div>
          {plan.status !== "active" && <Field label="Підсумок: чому таке рішення"><textarea rows={2} defaultValue={plan.result || ""} onBlur={(e) => plans.update(plan.id, { result: e.target.value.trim() || null })} /></Field>}
          <PlanView plan={plan} onToggle={(s, on) => toggle(plan, s, on)}
            onCheck={plan.member_id ? (s) => setCheck({ plan, step: s }) : () => setMsg("Спершу прив'яжіть людину з команди — оцінка зберігається в її картці.")} />
          {evals.rows.filter((e) => e.member_id && e.member_id === plan.member_id && e.kind === "probation").map((e) => (
            <div className="hr-evalcard" key={e.id}>
              <div className="hr-evalcard__head"><b>{EVAL_KINDS.probation}</b>{e.total != null && <span className="badge active">{Math.round(e.total)}%</span>}{e.verdict && <span className="badge draft">{verdictLabel(e.verdict)}</span>}<span className="note" style={{ margin: 0 }}>{e.evaluator} · {fmtDate(e.created_at)}</span></div>
              {e.strengths && <div><i>Сильне:</i> {e.strengths}</div>}{e.growth && <div><i>Зони росту:</i> {e.growth}</div>}{e.plan && <div><i>План:</i> {e.plan}</div>}
            </div>
          ))}
          <div className="toolbar" style={{ marginTop: 14, gap: 8 }}>
            <button type="button" className="btn small" onClick={() => setEditSteps(structuredClone(plan.steps || []))}>✎ Змінити кроки плану</button>
            <button type="button" className="btn small" onClick={async () => { if (!window.confirm("Видалити план адаптації?")) return; const e = await plans.remove(plan.id); if (e) setMsg(e); else setOpenId(null); }}>Видалити план</button>
          </div>
        </Modal>
      )}

      {editSteps && plan && (
        <Modal wide title="Кроки плану" onClose={() => setEditSteps(null)}
          actions={<><button type="button" className="btn" onClick={() => setEditSteps(null)}>Скасувати</button><button type="button" className="btn primary" onClick={async () => { const e = await plans.update(plan.id, { steps: editSteps.map((s) => ({ ...s, id: s.id || uid(), day: Number(s.day) || 1 })) }); if (e) setMsg(e); setEditSteps(null); }}>Зберегти кроки</button></>}>
          <ListEditor items={editSteps} onChange={setEditSteps} fields={STEP_FIELDS} addLabel="+ Крок" blank={{ day: 1, title: "", kind: "task", who: "self" }} />
        </Modal>
      )}

      {check && (
        <EvalForm kind="probation" role={roleOf(check.plan)} who={who} supabase={supabase} target={{ member_id: check.plan.member_id }} onClose={() => setCheck(null)}
          onSaved={async () => { await toggle(check.plan, check.step, true); evals.reload(); setCheck(null); }} />
      )}
    </div>
  );
}
