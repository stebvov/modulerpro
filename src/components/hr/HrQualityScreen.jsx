"use client";

// Якість роботи: по кожній людині — показники з системи проти цілей посади, підказки, навчання, чек-листи якості, огляди й 1:1.
// Система сама збирає цифри з угод, задач і сервісних заявок; керівник додає перевірки за чек-листом і огляди.
import { useMemo, useState } from "react";
import { useRows } from "@/lib/mod";
import { daysBetween, fmtDate, monthRange, todayISO, useHrMe } from "@/lib/hr";
import { Bar, Dot, Modal } from "./ui";
import EvalForm from "./EvalForm";
import TalkCheck from "./TalkCheck";
import PersonQuality, { EvalHistory, personView, useMetrics } from "./PersonQuality";

const forMembers = (q) => q.not("member_id", "is", null);

export default function HrQualityScreen() {
  const { canHr, who, loading: meLoading, supabase } = useHrMe();
  const roles = useRows("hr_roles", { order: "sort" });
  const members = useRows("task_members", { order: "sort", select: "id,name,role,active,is_ai,hr_role" });
  const evals = useRows("hr_evals", { order: "created_at", ascending: false, filter: forMembers });
  const attempts = useRows("hr_attempts", { order: "created_at", ascending: false, filter: forMembers });
  const tests = useRows("hr_tests", { order: "sort" });
  const courses = useRows("hr_courses", { order: "sort" });
  const lessons = useRows("hr_lessons", { order: "sort" });
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null);
  const [talk, setTalk] = useState(false);
  const [draft, setDraft] = useState(null); // заготовка оцінки від ШІ після розбору розмови
  const [msg, setMsg] = useState("");

  const period = useMemo(() => monthRange(month), [month]);
  const people = useMemo(() => members.rows.filter((m) => m.active && !m.is_ai), [members.rows]);
  const withRole = useMemo(() => people.filter((m) => m.hr_role), [people]);
  const ids = useMemo(() => withRole.map((m) => m.id), [withRole]);
  const metrics = useMetrics(supabase, canHr ? ids : [], period);

  const views = useMemo(() => {
    const roleOf = (m) => roles.rows.find((r) => r.key === m.hr_role) || null;
    const base = Object.fromEntries(withRole.map((m) => [m.id, { member: m, values: metrics.map[m.id] }]));
    return withRole.map((m) => {
      const role = roleOf(m);
      // керівник продажу відповідає за показники менеджерів
      const reports = role?.key === "head_of_sales" ? withRole.filter((x) => x.hr_role === "sales_manager").map((x) => base[x.id]) : [];
      return { member: m, role, ...personView({ member: m, role, values: metrics.map[m.id], evals: evals.rows, attempts: attempts.rows, tests: tests.rows, period, reports, forHr: true }) };
    });
  }, [withRole, roles.rows, metrics.map, evals.rows, attempts.rows, tests.rows, period]);

  if (meLoading || roles.loading || members.loading) return <div className="empty">Завантаження…</div>;
  if (!canHr) return <div className="empty">Розділ доступний керівникам. Свої показники й підказки ви бачите у «Мій розвиток».</div>;

  async function setRole(m, key) {
    const { data, error } = await supabase.rpc("hr_set_role", { p_member: m.id, p_role: key });
    if (error || !data?.ok) { setMsg(data?.error || error?.message || "Не вдалося призначити посаду"); return; }
    setMsg(""); members.reload();
  }
  const open = views.find((x) => x.member.id === openId);
  const lastOf = (id, kinds) => evals.rows.find((e) => e.member_id === id && kinds.includes(e.kind));
  const noRole = people.filter((m) => !m.hr_role);
  const red = views.filter((x) => x.hints.some((h) => h.level === "bad")).length;

  return (
    <div>
      <p className="note">Цифри збирає система — з угод, задач, сервісних заявок і навчання. Ви додаєте те, чого система не бачить: перевірку розмови чи будинку за чек-листом, щомісячний огляд і зустрічі 1:1. Працівник бачить ті самі показники й підказки у «Мій розвиток».</p>
      <div className="toolbar">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value || month)} style={{ width: 160 }} aria-label="Місяць" />
        <span className="note" style={{ margin: 0 }}>Людей із посадою: {views.length}{red ? ` · потребують уваги: ${red}` : ""}</span>
      </div>
      {msg && <div className="auth-error">{msg}</div>}

      <div className="table-scroll">
        <table>
          <thead><tr><th>Людина</th><th>Посада</th><th>Показники</th><th style={{ minWidth: 130 }}>Навчання</th><th style={{ textAlign: "right" }}>Чек-листи</th><th>Останній огляд / 1:1</th><th>Що зробити</th></tr></thead>
          <tbody>
            {views.map((x) => {
              const last = lastOf(x.member.id, ["review", "probation", "one_on_one"]);
              const old = !last || daysBetween(last.created_at, new Date()) > 35;
              const top = x.hints.find((h) => h.level === "bad") || x.hints.find((h) => h.level === "warn") || x.hints[0];
              return (
                <tr key={x.member.id} style={{ cursor: "pointer" }} onClick={(e) => { if (!e.target.closest("select,button")) setOpenId(x.member.id); }} title="Відкрити показники, підказки й оцінки">
                  <td><b>{x.member.name}</b><div className="note">{x.member.role}</div></td>
                  <td>
                    <select value={x.member.hr_role || ""} onChange={(e) => setRole(x.member, e.target.value)} aria-label="Посада">
                      <option value="">— без посади —</option>{roles.rows.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                    </select>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {metrics.loading ? "…" : x.kpis.filter((k) => k.state !== "none").map((k) => <Dot key={k.key} state={k.state} title={`${k.name}: ${k.val ?? "—"}${k.target != null ? ` (ціль ${k.better === "less" ? "≤" : "≥"} ${k.target})` : ""}`} />)}
                    {!metrics.loading && !x.kpis.some((k) => k.state !== "none") && <span className="note">немає даних</span>}
                  </td>
                  <td>{x.v.learning_pct == null ? "—" : <><Bar pct={x.v.learning_pct} state={x.v.learning_pct >= 100 ? "ok" : "warn"} /><span className="note">{x.v.learning_pct}%</span></>}</td>
                  <td style={{ textAlign: "right" }}>{x.v.qa_avg != null ? <>{x.v.qa_avg}% <span className="note">({x.v.qa_count})</span></> : "—"}</td>
                  <td className={old ? "stale" : undefined}>{last ? fmtDate(last.created_at) : "не було"}</td>
                  <td style={{ maxWidth: 360 }}>{top ? <span className={top.level === "bad" ? "stale" : undefined}>{top.text}</span> : "—"}{x.hints.length > 1 && <span className="note"> +{x.hints.length - 1}</span>}</td>
                </tr>
              );
            })}
            {!views.length && <tr><td colSpan={7} className="empty">Жодній людині ще не призначено посаду. Призначте нижче — і з’являться цілі, навчання й показники.</td></tr>}
          </tbody>
        </table>
      </div>

      {noRole.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "22px 0 4px" }}>Без посади</h3>
          <p className="note" style={{ marginTop: 0 }}>Посада визначає цілі, обов’язкове навчання, показники й чек-лист якості. Немає потрібної — створіть у «Профілях посад».</p>
          <div className="table-scroll"><table><tbody>
            {noRole.map((m) => (
              <tr key={m.id}>
                <td><b>{m.name}</b></td><td className="note">{m.role}</td>
                <td style={{ width: 280 }}><select value="" onChange={(e) => e.target.value && setRole(m, e.target.value)} aria-label={`Посада: ${m.name}`}><option value="">— призначити посаду —</option>{roles.rows.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></td>
              </tr>
            ))}
          </tbody></table></div>
        </>
      )}

      {open && (
        <Modal wide title={<>{open.member.name} <span className="note" style={{ fontWeight: 400 }}>· {open.role?.name} · {month}</span></>} onClose={() => setOpenId(null)}>
          <div className="toolbar" style={{ gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="btn primary" onClick={() => { setDraft(null); setForm("qa"); }}>+ Перевірка за чек-листом</button>
            {open.role?.qa_checklist?.length > 0 && <button type="button" className="btn" onClick={() => setTalk(true)} title="Вставити текст розмови — ШІ оцінить за чек-листом, ви перевірите й збережете">🤖 Розбір розмови</button>}
            <button type="button" className="btn" onClick={() => setForm("one_on_one")}>+ Зустріч 1:1</button>
            <button type="button" className="btn" onClick={() => setForm("review")}>+ Огляд роботи</button>
          </div>
          <PersonQuality view={open} role={open.role} courses={courses.rows} lessons={lessons.rows} />
          <h4 className="hr-phase">Історія оцінок</h4>
          <EvalHistory evals={evals.rows.filter((e) => e.member_id === open.member.id)} role={open.role} onDelete={(id) => evals.remove(id)} />
        </Modal>
      )}
      {form && open && (
        <EvalForm key={draft ? "ai" : form} kind={form} role={open.role} who={who} supabase={supabase} target={{ member_id: open.member.id }} kpis={open.v}
          initial={form === "qa" ? draft : null} onClose={() => { setForm(null); setDraft(null); }}
          onSaved={() => { evals.reload(); setForm(null); setDraft(null); }} />
      )}
      {talk && open && (
        <Modal wide title={`Розбір розмови: ${open.member.name}`} onClose={() => setTalk(false)}>
          <TalkCheck supabase={supabase} role={open.role} onUse={(d) => { setDraft(d); setTalk(false); setForm("qa"); }} />
        </Modal>
      )}
    </div>
  );
}
