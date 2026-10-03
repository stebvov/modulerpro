"use client";

// Картка кандидата: контакти й етап, оцінки за профілем посади, тест за посиланням, рішення.
import { useState } from "react";
import { EVAL_KINDS, REJECT_REASONS, SIDE_STAGES, SOURCES, STAGES, addDays, candidateScore, fmtDate, todayISO, uid, verdictLabel } from "@/lib/hr";
import { Copy, Field, Modal } from "./ui";
import EvalForm from "./EvalForm";
import AttemptReview from "./AttemptReview";

const SITE = "https://moduler.pro";

export default function CandidateModal({ cand, roles, vacs, tests, evals, attempts, members, who, supabase, onPatch, onEval, onAttempt, onDelete, onPlan, onClose }) {
  const [tab, setTab] = useState("card");
  const [form, setForm] = useState(null); // вид оцінки, яку зараз заповнюють
  const [review, setReview] = useState(null);
  const [testId, setTestId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [msg, setMsg] = useState("");
  const [sure, setSure] = useState(false);

  const role = roles.find((r) => r.id === cand.role_id) || null;
  const myEvals = evals.filter((e) => e.candidate_id === cand.id);
  const myAttempts = attempts.filter((a) => a.candidate_id === cand.id);
  const roleTests = tests.filter((t) => t.kind === "candidate" && (!role || !t.role_keys?.length || t.role_keys.includes(role.key)));
  const anyTests = roleTests.length ? roleTests : tests.filter((t) => t.kind === "candidate");
  const total = candidateScore(cand, evals);
  const set = (patch) => onPatch(cand.id, patch);

  async function moveTo(stage) {
    if (stage === cand.stage) return;
    await set({ stage, stage_at: new Date().toISOString() });
  }
  async function sendTest() {
    const id = testId || anyTests[0]?.id;
    if (!id) return;
    const { data, error } = await supabase.from("hr_attempts").insert({ test_id: id, candidate_id: cand.id, sent_by: who }).select().single();
    if (error) { setMsg(error.message); return; }
    onAttempt(data);
    if (["new", "screen"].includes(cand.stage)) await moveTo("test");
    setMsg("Посилання створено — скопіюйте повідомлення й надішліть кандидату.");
  }
  async function hire() {
    if (!role) { setMsg("Оберіть посаду кандидата — план адаптації береться з профілю посади."); setTab("card"); return; }
    const steps = (role.onboarding || []).map((s) => ({ ...s, id: s.id || uid(), done_at: null }));
    const { data, error } = await supabase.from("hr_onboarding").insert({ candidate_id: cand.id, role_id: role.id, person: cand.full_name, start_date: startDate, steps }).select().single();
    if (error) { setMsg(error.message); return; }
    await moveTo("hired");
    onPlan?.(data);
    setMsg(`Прийнято. План адаптації на 90 днів створено (старт ${fmtDate(startDate)}) — він у вкладці «Адаптація». Додайте людину в «Команду» і прив'яжіть до плану, щоб вона бачила свої кроки й навчання.`);
  }

  const avg = (kind) => { const l = myEvals.filter((e) => e.kind === kind && e.total != null); return l.length ? Math.round(l.reduce((a, e) => a + Number(e.total), 0) / l.length) : null; };
  const link = (a) => `${SITE}/test/${a.token}`;
  const firstName = cand.full_name.split(" ")[0];

  return (
    <Modal wide onClose={onClose} title={<>{cand.full_name} {total != null && <span className="badge active" title="Загальна оцінка: тест 30%, співбесіди 50%, завдання 20%">{total}%</span>}</>}>
      <div className="seg-row" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        {[["card", "Картка"], ["evals", `Оцінки (${myEvals.length})`], ["test", `Тест${myAttempts.length ? ` (${myAttempts.length})` : ""}`], ["decision", "Рішення"]].map(([id, l]) => (
          <button key={id} type="button" className={`seg-btn${tab === id ? " active" : ""}`} onClick={() => { setTab(id); setMsg(""); }}>{l}</button>
        ))}
      </div>
      {msg && <div className="note" style={{ color: "var(--accent)", marginBottom: 10 }}>{msg}</div>}

      {tab === "card" && (
        <>
          <Field label="Етап">
            <div className="seg-row" style={{ flexWrap: "wrap" }}>
              {[...STAGES, ...SIDE_STAGES].map(([k, l]) => <button key={k} type="button" className={`seg-btn${cand.stage === k ? " active" : ""}`} onClick={() => moveTo(k)}>{l}</button>)}
            </div>
          </Field>
          {cand.stage === "rejected" && (
            <Field label="Причина відмови (потрібна для аналізу воронки)">
              <select value={cand.reject_reason || ""} onChange={(e) => set({ reject_reason: e.target.value || null })}><option value="">— оберіть —</option>{REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
          )}
          <div className="hr-grid2">
            <Field label="Ім'я та прізвище"><input type="text" defaultValue={cand.full_name} onBlur={(e) => e.target.value.trim() && e.target.value !== cand.full_name && set({ full_name: e.target.value.trim() })} /></Field>
            <Field label="Телефон"><input type="text" defaultValue={cand.phone || ""} onBlur={(e) => e.target.value !== (cand.phone || "") && set({ phone: e.target.value.trim() || null })} /></Field>
            <Field label="Email"><input type="text" defaultValue={cand.email || ""} onBlur={(e) => e.target.value !== (cand.email || "") && set({ email: e.target.value.trim() || null })} /></Field>
            <Field label="Місто"><input type="text" defaultValue={cand.city || ""} onBlur={(e) => e.target.value !== (cand.city || "") && set({ city: e.target.value.trim() || null })} /></Field>
            <Field label="Вакансія">
              <select value={cand.vacancy_id || ""} onChange={(e) => { const v = vacs.find((x) => x.id === e.target.value); set({ vacancy_id: e.target.value || null, ...(v?.role_id ? { role_id: v.role_id } : {}) }); }}>
                <option value="">— без вакансії (резерв) —</option>{vacs.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
              </select>
            </Field>
            <Field label="Посада (профіль для оцінки)">
              <select value={cand.role_id || ""} onChange={(e) => set({ role_id: e.target.value || null })}><option value="">— оберіть —</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            </Field>
            <Field label="Звідки кандидат">
              <select value={cand.source || ""} onChange={(e) => set({ source: e.target.value || null })}><option value="">—</option>{[...new Set([...SOURCES, cand.source].filter(Boolean))].map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label="Хто веде кандидата">
              <select value={cand.owner_id || ""} onChange={(e) => set({ owner_id: e.target.value || null })}><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            </Field>
          </div>
          <Field label="Резюме або профіль (посилання)"><input type="text" defaultValue={cand.cv_url || ""} placeholder="https://…" onBlur={(e) => e.target.value !== (cand.cv_url || "") && set({ cv_url: e.target.value.trim() || null })} /></Field>
          {cand.cv_url && /^https?:\/\//.test(cand.cv_url) && <a className="note" href={cand.cv_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Відкрити резюме ↗</a>}
          {cand.about && <Field label="Що кандидат написав про себе"><div className="hr-answer">{cand.about}</div></Field>}
          <div className="hr-grid2">
            <Field label="Наступний крок — коли"><input type="date" defaultValue={cand.next_at ? cand.next_at.slice(0, 10) : ""} onChange={(e) => set({ next_at: e.target.value ? `${e.target.value}T09:00:00+03:00` : null })} /></Field>
            <Field label="Наступний крок — що"><input type="text" defaultValue={cand.next_note || ""} placeholder="напр. подзвонити, призначити співбесіду" onBlur={(e) => e.target.value !== (cand.next_note || "") && set({ next_note: e.target.value.trim() || null })} /></Field>
          </div>
          <Field label="Нотатки"><textarea rows={3} defaultValue={cand.notes || ""} onBlur={(e) => e.target.value !== (cand.notes || "") && set({ notes: e.target.value.trim() || null })} /></Field>
          <p className="note">Відгук від {fmtDate(cand.created_at)}{cand.source_note ? ` · мітка: ${cand.source_note}` : ""}{cand.meta?.page ? ` · сторінка ${cand.meta.page}` : ""}</p>
        </>
      )}

      {tab === "evals" && (
        <>
          <div className="toolbar" style={{ flexWrap: "wrap", gap: 6 }}>
            {["screen", "interview", "task", "reference"].map((k) => <button key={k} type="button" className="btn" onClick={() => setForm(k)}>+ {EVAL_KINDS[k]}</button>)}
          </div>
          {!role && <div className="auth-error">Оберіть посаду кандидата на вкладці «Картка» — питання й компетенції беруться з її профілю.</div>}
          {role?.case_task && (
            <details className="hr-q"><summary>Практичне завдання для цієї посади</summary><div style={{ whiteSpace: "pre-wrap" }}>{role.case_task}</div></details>
          )}
          {!myEvals.length && <div className="empty">Оцінок ще немає. Почніть зі скринінг-дзвінка.</div>}
          {myEvals.map((e) => (
            <div className="hr-evalcard" key={e.id}>
              <div className="hr-evalcard__head">
                <b>{EVAL_KINDS[e.kind]}</b>
                {e.total != null && <span className="badge active">{Math.round(e.total)}%</span>}
                {e.verdict && <span className={`badge ${e.verdict.includes("yes") ? "active" : "draft"}`}>{verdictLabel(e.verdict)}</span>}
                <span className="note" style={{ margin: 0 }}>{e.evaluator} · {fmtDate(e.created_at)}</span>
                <button type="button" className="btn small" style={{ marginLeft: "auto" }} title="Видалити оцінку" onClick={() => window.confirm("Видалити цю оцінку?") && onEval(null, e.id)}>×</button>
              </div>
              {e.title && <div className="note">{e.title}</div>}
              {e.kind !== "screen" && e.kind !== "reference" && role && (
                <div className="hr-chips">{(role.competencies || []).filter((c) => e.scores?.[c.key]).map((c) => <span className="tag" key={c.key}>{c.name}: {e.scores[c.key]}</span>)}</div>
              )}
              {e.strengths && <div><i>Сильне:</i> {e.strengths}</div>}
              {e.growth && <div><i>{e.kind === "screen" ? "Нотатки" : "Сумніви"}:</i> {e.growth}</div>}
            </div>
          ))}
        </>
      )}

      {tab === "test" && (
        <>
          <p className="note" style={{ marginTop: 0 }}>Кандидат проходить тест удома за особистим посиланням. Питання з варіантами система перевіряє сама, відкриті — ви.</p>
          {!anyTests.length ? <div className="empty">Вступних тестів ще немає — створіть у розділі «Навчання й тести».</div> : (
            <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
              <select value={testId || anyTests[0].id} onChange={(e) => setTestId(e.target.value)} style={{ minWidth: 280 }}>
                {anyTests.map((t) => <option key={t.id} value={t.id}>{t.title}{t.minutes ? ` · ${t.minutes} хв` : ""}</option>)}
              </select>
              <button type="button" className="btn primary" onClick={sendTest}>Створити посилання</button>
            </div>
          )}
          {myAttempts.map((a) => {
            const t = tests.find((x) => x.id === a.test_id);
            const text = `Добрий день, ${firstName}! Дякуємо за відгук на вакансію в Moduler. Наступний крок — короткий онлайн-тест${t?.minutes ? ` (до ${t.minutes} хвилин)` : ""}. Пройдіть його, будь ласка, до ${fmtDate(addDays(todayISO(), 2))}: ${link(a)}\nПосилання особисте, пройти можна один раз. Після тесту ми зв'яжемося з вами.`;
            return (
              <div className="hr-evalcard" key={a.id}>
                <div className="hr-evalcard__head">
                  <b>{t?.title || "Тест"}</b>
                  <span className={`badge ${a.status === "checked" ? "active" : "draft"}`}>{a.status === "sent" ? "не відкривав" : a.status === "started" ? "проходить" : a.status === "done" ? "чекає перевірки" : a.passed ? "складено" : "не складено"}</span>
                  {a.score_pct != null && <b>{Math.round(a.score_pct)}%{a.status === "done" ? " (без відкритих)" : ""}</b>}
                  {a.late && <span className="stale">із запізненням</span>}
                  <span className="note" style={{ margin: 0 }}>надіслано {fmtDate(a.created_at)}</span>
                </div>
                <div className="toolbar" style={{ gap: 6, flexWrap: "wrap", margin: "6px 0 0" }}>
                  {(a.status === "sent" || a.status === "started") && <><Copy text={text} label="Скопіювати повідомлення кандидату" /><Copy text={link(a)} label="Лише посилання" /></>}
                  {(a.status === "done" || a.status === "checked") && <button type="button" className={`btn small${a.status === "done" ? " primary" : ""}`} onClick={() => setReview(a)}>{a.status === "done" ? "Перевірити відкриті відповіді" : "Переглянути відповіді"}</button>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === "decision" && (
        <>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Крок</th><th style={{ textAlign: "right" }}>Оцінка</th><th>Висновки</th></tr></thead>
              <tbody>
                <tr><td>Скринінг</td><td style={{ textAlign: "right" }}>{avg("screen") != null ? `${avg("screen")}%` : "—"}</td><td>{myEvals.filter((e) => e.kind === "screen").map((e) => verdictLabel(e.verdict)).filter(Boolean).join(", ") || "—"}</td></tr>
                <tr><td>Тест</td><td style={{ textAlign: "right" }}>{cand.score_test != null ? `${Math.round(cand.score_test)}%` : "—"}</td><td>{myAttempts.some((a) => a.status === "done") ? "чекає перевірки відкритих відповідей" : "—"}</td></tr>
                <tr><td>Співбесіди ({myEvals.filter((e) => e.kind === "interview").length})</td><td style={{ textAlign: "right" }}>{avg("interview") != null ? `${avg("interview")}%` : "—"}</td><td>{myEvals.filter((e) => e.kind === "interview").map((e) => `${e.evaluator}: ${verdictLabel(e.verdict) || "без висновку"}`).join("; ") || "—"}</td></tr>
                <tr><td>Практичне завдання</td><td style={{ textAlign: "right" }}>{avg("task") != null ? `${avg("task")}%` : "—"}</td><td>{myEvals.filter((e) => e.kind === "task").map((e) => verdictLabel(e.verdict)).filter(Boolean).join(", ") || "—"}</td></tr>
                <tr><td>Рекомендації</td><td style={{ textAlign: "right" }}>—</td><td>{myEvals.filter((e) => e.kind === "reference").map((e) => `${e.title || "рекомендація"}: ${verdictLabel(e.verdict) || "без висновку"}`).join("; ") || "не перевіряли"}</td></tr>
                <tr><td><b>Загальна оцінка</b></td><td style={{ textAlign: "right" }}><b>{total != null ? `${total}%` : "—"}</b></td><td className="note">тест 30% · співбесіди 50% · завдання 20%</td></tr>
              </tbody>
            </table>
          </div>
          {role?.red_flags?.length > 0 && (
            <details className="hr-q"><summary>Тривожні сигнали для цієї посади — перевірте себе перед рішенням</summary><ul>{role.red_flags.map((x) => <li key={x}>{x}</li>)}</ul></details>
          )}
          <p className="note">Правило: сумніваєтесь — не беріть. Якщо є «ні» хоча б від одного інтерв’юера, обговоріть причину до рішення.</p>
          <div className="toolbar" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <Field label="Дата виходу на роботу"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || todayISO())} /></Field>
            <button type="button" className="btn primary" disabled={cand.stage === "hired"} onClick={hire}>{cand.stage === "hired" ? "Уже прийнято" : "Прийняти й створити план адаптації"}</button>
            <button type="button" className="btn" onClick={() => moveTo("offer")}>Зробити пропозицію</button>
            <button type="button" className="btn" onClick={() => moveTo("reserve")}>У резерв</button>
            <button type="button" className="btn" onClick={() => { moveTo("rejected"); setTab("card"); }}>Відмовити</button>
          </div>
          <div style={{ marginTop: 18 }}>
            <button type="button" className="btn small" onClick={() => { if (!sure) { setSure(true); setTimeout(() => setSure(false), 4000); return; } onDelete(cand.id); }}>{sure ? "Точно видалити кандидата з усіма оцінками?" : "Видалити кандидата"}</button>
          </div>
        </>
      )}

      {form && (
        <EvalForm kind={form} role={role} who={who} supabase={supabase} target={{ candidate_id: cand.id }} onClose={() => setForm(null)}
          onSaved={(e) => { onEval(e); setForm(null); if (e.kind === "interview") { const l = [...myEvals, e].filter((x) => x.kind === "interview" && x.total != null); set({ score_interview: Math.round(l.reduce((a, x) => a + Number(x.total), 0) / l.length) }); } }} />
      )}
      {review && (
        <AttemptReview attempt={review} test={tests.find((t) => t.id === review.test_id)} who={who} supabase={supabase} onClose={() => setReview(null)}
          onSaved={(a) => { onAttempt(a); if (a.score_pct != null) onPatch(cand.id, { score_test: a.score_pct }, true); setReview(null); }} />
      )}
    </Modal>
  );
}
