"use client";

// Навчання й тести: курси за посадами → уроки (позначаєш пройдене) → тест із розбором помилок.
// HR тут же редагує курси, уроки, тести й питання. Вступні тести для кандидатів видно лише HR.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRows } from "@/lib/mod";
import { LEVELS, fmtDate, useHrMe } from "@/lib/hr";
import { Bar, Field, Modal } from "./ui";
import HrText from "./HrText";
import TestRunner from "./TestRunner";

const Q_KINDS = [["single", "одна відповідь"], ["multi", "кілька відповідей"], ["open", "відкрите (перевіряє керівник)"]];

function QuestionsEditor({ test, supabase, onClose }) {
  const [qs, setQs] = useState(null);
  const [meta, setMeta] = useState({ title: test.title, descr: test.descr || "", pass_pct: test.pass_pct, minutes: test.minutes ?? "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("hr_questions").select("*").eq("test_id", test.id).order("sort");
    if (error) setErr(error.message); else setQs(data || []);
  }, [supabase, test.id]);
  useEffect(() => {
    // Initial load of the test's questions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const set = (id, p) => setQs((l) => l.map((q) => (q.id === id ? { ...q, ...p, _dirty: true } : q)));
  async function saveAll() {
    setBusy(true); setErr("");
    const m = await supabase.from("hr_tests").update({ title: meta.title.trim() || test.title, descr: meta.descr || null, pass_pct: Number(meta.pass_pct) || 80, minutes: meta.minutes === "" ? null : Number(meta.minutes) || null }).eq("id", test.id);
    let e = m.error;
    for (const [i, q] of (qs || []).entries()) {
      if (e) break;
      const row = { kind: q.kind, text: q.text, options: q.options || [], correct: q.kind === "open" ? [] : q.correct || [], explain: q.explain || null, comp: q.comp || null, points: Number(q.points) || 1, sort: i };
      const r = q._new ? await supabase.from("hr_questions").insert({ ...row, test_id: test.id }) : q._dirty || q.sort !== i ? await supabase.from("hr_questions").update(row).eq("id", q.id) : { error: null };
      e = r.error;
    }
    setBusy(false);
    if (e) { setErr(e.message); return; }
    onClose(true);
  }
  async function del(q) {
    if (!window.confirm("Видалити питання?")) return;
    if (!q._new) { const { error } = await supabase.from("hr_questions").delete().eq("id", q.id); if (error) { setErr(error.message); return; } }
    setQs((l) => l.filter((x) => x.id !== q.id));
  }

  return (
    <Modal wide title="Редагування тесту" onClose={() => onClose(false)}
      actions={<><button type="button" className="btn" onClick={() => onClose(false)}>Скасувати</button><button type="button" className="btn primary" disabled={busy || !qs} onClick={saveAll}>{busy ? "Зберігаємо…" : "Зберегти тест"}</button></>}>
      {err && <div className="auth-error">{err}</div>}
      <div className="hr-grid2">
        <Field label="Назва"><input type="text" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Поріг, %" grow={1}><input type="text" inputMode="numeric" value={meta.pass_pct} onChange={(e) => setMeta({ ...meta, pass_pct: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Час, хв (порожньо — без обмеження)" grow={2}><input type="text" inputMode="numeric" value={meta.minutes} onChange={(e) => setMeta({ ...meta, minutes: e.target.value.replace(/\D/g, "") })} /></Field>
        </div>
      </div>
      <Field label="Вступ для того, хто проходить"><textarea rows={2} value={meta.descr} onChange={(e) => setMeta({ ...meta, descr: e.target.value })} /></Field>
      {!qs && <div className="empty">Завантаження…</div>}
      {(qs || []).map((q, i) => (
        <div className="hr-evalcomp" key={q.id}>
          <div className="hr-evalrow">
            <b>Питання {i + 1}</b>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={q.kind} onChange={(e) => set(q.id, { kind: e.target.value })}>{Q_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input type="text" inputMode="decimal" value={q.points} onChange={(e) => set(q.id, { points: e.target.value.replace(/[^\d.]/g, "") })} style={{ width: 52 }} title="Бали за питання" aria-label="Бали" />
              <button type="button" className="btn small" onClick={() => del(q)} title="Видалити питання">×</button>
            </span>
          </div>
          <textarea rows={2} value={q.text} onChange={(e) => set(q.id, { text: e.target.value })} placeholder="Текст питання" style={{ width: "100%" }} />
          {q.kind !== "open" && (
            <div className="hr-list" style={{ marginTop: 6 }}>
              {(q.options || []).map((o, j) => (
                <div className="hr-list__row" key={j}>
                  <input type={q.kind === "single" ? "radio" : "checkbox"} name={`c-${q.id}`} checked={(q.correct || []).includes(j)} title="Правильна відповідь" style={{ width: "auto" }}
                    onChange={() => set(q.id, { correct: q.kind === "single" ? [j] : (q.correct || []).includes(j) ? q.correct.filter((x) => x !== j) : [...(q.correct || []), j].sort((a, b) => a - b) })} />
                  <input type="text" value={o} onChange={(e) => set(q.id, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />
                  <button type="button" className="btn small" onClick={() => set(q.id, { options: q.options.filter((_, k) => k !== j), correct: (q.correct || []).filter((x) => x !== j).map((x) => (x > j ? x - 1 : x)) })}>×</button>
                </div>
              ))}
              <button type="button" className="btn small" onClick={() => set(q.id, { options: [...(q.options || []), ""] })}>+ Варіант</button>
            </div>
          )}
          <textarea rows={2} value={q.explain || ""} onChange={(e) => set(q.id, { explain: e.target.value })} placeholder={q.kind === "open" ? "Ознаки сильної і слабкої відповіді — для того, хто перевіряє" : "Пояснення: чому саме ця відповідь правильна"} style={{ width: "100%", marginTop: 6 }} />
        </div>
      ))}
      {qs && <button type="button" className="btn" onClick={() => setQs([...qs, { id: `new-${Date.now()}`, _new: true, kind: "single", text: "", options: ["", "", "", ""], correct: [0], explain: "", points: 1 }])}>+ Питання</button>}
    </Modal>
  );
}

// mine — вбудований показ у «Мій розвиток» (лише курси своєї посади, без редагування); initial — який курс і урок відкрити одразу
export default function HrLearningScreen({ mine: embedded = false, initial = null }) {
  const { me, canHr, loading: meLoading, supabase } = useHrMe();
  const roles = useRows("hr_roles", { order: "sort" });
  const courses = useRows("hr_courses", { order: "sort" });
  const lessons = useRows("hr_lessons", { order: "sort" });
  const tests = useRows("hr_tests", { order: "sort" });
  const myId = me?.id || null;
  const myFilter = useCallback((q) => (myId ? q.eq("member_id", myId) : q.is("member_id", null)), [myId]);
  const progress = useRows("hr_progress", { order: "done_at", filter: myFilter });
  const attempts = useRows("hr_attempts", { order: "created_at", ascending: false, filter: myFilter });
  const [courseId, setCourseId] = useState(initial?.courseId || null);
  const [lessonId, setLessonId] = useState(initial?.lessonId || null);
  const [token, setToken] = useState(null);
  const [edit, setEdit] = useState(false);
  const [onlyMine, setOnlyMine] = useState(true);
  const [qEdit, setQEdit] = useState(null);
  const [msg, setMsg] = useState("");

  const done = useMemo(() => new Set(progress.rows.map((p) => p.lesson_id)), [progress.rows]);
  const forMe = (keys) => !keys?.length || (me?.hr_role && keys.includes(me.hr_role));
  const roleName = (k) => roles.rows.find((r) => r.key === k)?.name || k;
  const editing = edit && canHr && !embedded;

  if (meLoading || courses.loading || lessons.loading || tests.loading) return <div className="empty">Завантаження навчання…</div>;
  if (courses.error) return <div className="empty">Помилка: {courses.error}</div>;

  async function beginTest(t) {
    setMsg("");
    const { data, error } = await supabase.rpc("hr_test_begin", { p_test: t.id });
    if (error || !data?.ok) { setMsg(data?.error || error?.message || "Не вдалося почати тест"); return; }
    setToken(data.token);
  }
  async function toggleDone(l) {
    if (!me?.id) { setMsg("Позначати уроки можуть учасники команди"); return; }
    if (done.has(l.id)) await supabase.from("hr_progress").delete().eq("member_id", me.id).eq("lesson_id", l.id);
    else await supabase.from("hr_progress").insert({ member_id: me.id, lesson_id: l.id });
    progress.reload();
  }
  const lastAttempt = (t) => attempts.rows.find((a) => a.test_id === t.id && (a.status === "checked" || a.status === "done"));
  const passed = (t) => attempts.rows.some((a) => a.test_id === t.id && a.passed);

  if (token) {
    return <TestRunner supabase={supabase} token={token} onClose={() => { setToken(null); attempts.reload(); }}
      onRetake={() => { const a = attempts.rows.find((x) => x.token === token); const t = tests.rows.find((x) => x.id === a?.test_id) || tests.rows.find((x) => x.course_id === courseId); setToken(null); attempts.reload(); if (t) beginTest(t); }} />;
  }

  const testCard = (t) => {
    const last = lastAttempt(t), ok = passed(t);
    return (
      <div className="hr-evalcard" key={t.id}>
        <div className="hr-evalcard__head">
          <b>📝 {t.title}</b>
          {ok ? <span className="badge active">складено</span> : last?.status === "done" ? <span className="badge draft">перевіряється</span> : last ? <span className="badge draft" style={{ color: "var(--danger)" }}>не складено</span> : null}
          {last?.score_pct != null && <span>{Math.round(last.score_pct)}% · {fmtDate(last.finished_at)}</span>}
          <span className="note" style={{ margin: 0 }}>поріг {t.pass_pct}%{t.minutes ? ` · ${t.minutes} хв` : ""}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {t.kind !== "candidate" && me?.id && <button type="button" className={`btn small${ok ? "" : " primary"}`} onClick={() => beginTest(t)}>{ok ? "Пройти ще раз" : last ? "Перескласти" : "Пройти тест"}</button>}
            {editing && <button type="button" className="btn small" onClick={() => setQEdit(t)}>✎ Питання</button>}
          </span>
        </div>
        {t.descr && <div className="note">{t.descr}</div>}
        {last?.ai?.summary && <div className="note">🤖 Про відкриті відповіді: {last.ai.summary}</div>}
      </div>
    );
  };

  // ── один курс ──
  const course = courses.rows.find((c) => c.id === courseId);
  if (course) {
    const ls = lessons.rows.filter((l) => l.course_id === course.id);
    const lesson = ls.find((l) => l.id === lessonId) || ls[0];
    const idx = ls.indexOf(lesson);
    const ct = tests.rows.filter((t) => t.course_id === course.id);
    const saveLesson = async (p) => { const e = await lessons.update(lesson.id, p); if (e) setMsg(e); };
    return (
      <div>
        <div className="toolbar">
          <button type="button" className="btn" onClick={() => { setCourseId(null); setLessonId(null); setEdit(false); }}>← Усі курси</button>
          <div className="toolbar-actions">
            {canHr && !embedded && <button type="button" className={`btn${edit ? " primary" : ""}`} onClick={() => setEdit(!edit)}>{edit ? "Готово" : "✎ Редагувати курс"}</button>}
          </div>
        </div>
        {msg && <div className="auth-error">{msg}</div>}
        {editing ? (
          <div className="hr-evalcomp">
            <div className="hr-grid2">
              <Field label="Назва курсу"><input type="text" defaultValue={course.title} onBlur={(e) => e.target.value.trim() && courses.update(course.id, { title: e.target.value.trim() })} /></Field>
              <div style={{ display: "flex", gap: 10 }}>
                <Field label="Значок" grow={1}><input type="text" defaultValue={course.icon || ""} onBlur={(e) => courses.update(course.id, { icon: e.target.value || null })} /></Field>
                <Field label="Рівень" grow={2}><select value={course.level} onChange={(e) => courses.update(course.id, { level: e.target.value })}>{Object.entries(LEVELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              </div>
            </div>
            <Field label="Опис"><textarea rows={2} defaultValue={course.descr || ""} onBlur={(e) => courses.update(course.id, { descr: e.target.value || null })} /></Field>
            <Field label="Для яких посад (нічого не вибрано — для всіх)">
              <div className="tag-checks">{roles.rows.map((r) => (
                <label className="tag-check" key={r.key}><input type="checkbox" checked={(course.role_keys || []).includes(r.key)} onChange={(e) => courses.update(course.id, { role_keys: e.target.checked ? [...(course.role_keys || []), r.key] : course.role_keys.filter((k) => k !== r.key) })} /> {r.name}</label>
              ))}</div>
            </Field>
            <label className="tag-check"><input type="checkbox" checked={course.required} onChange={(e) => courses.update(course.id, { required: e.target.checked })} /> Обов’язковий (входить у показник «навчання пройдено»)</label>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 18, margin: "4px 0 6px" }}>{course.icon ? `${course.icon} ` : ""}{course.title}</h2>
            {course.descr && <p className="note" style={{ marginTop: 0 }}>{course.descr}</p>}
          </>
        )}
        <div className="hr-course">
          <nav className="hr-course__nav" aria-label="Уроки курсу">
            {ls.map((l, i) => (
              <button key={l.id} type="button" className={l.id === lesson?.id ? "on" : ""} onClick={() => setLessonId(l.id)}>
                <span>{done.has(l.id) ? "✓" : i + 1}</span>{l.title}{l.minutes ? <em>{l.minutes} хв</em> : null}
              </button>
            ))}
            {editing && <button type="button" className="btn small" onClick={async () => { const e = await lessons.insert({ course_id: course.id, title: "Новий урок", body: "", sort: ls.length }); if (e) setMsg(e); else lessons.reload(); }}>+ Урок</button>}
          </nav>
          <div className="hr-course__body">
            {!lesson ? <div className="empty">У курсі ще немає уроків.</div> : editing ? (
              <div key={lesson.id}>
                <div style={{ display: "flex", gap: 10 }}>
                  <Field label="Назва уроку" grow={4}><input type="text" defaultValue={lesson.title} onBlur={(e) => e.target.value.trim() && saveLesson({ title: e.target.value.trim() })} /></Field>
                  <Field label="Хвилин" grow={1}><input type="text" inputMode="numeric" defaultValue={lesson.minutes ?? ""} onBlur={(e) => saveLesson({ minutes: e.target.value === "" ? null : Number(e.target.value) || null })} /></Field>
                </div>
                <Field label="Текст уроку: «## Заголовок», «- пункт», «1. крок», **жирний**"><textarea rows={18} defaultValue={lesson.body || ""} onBlur={(e) => e.target.value !== (lesson.body || "") && saveLesson({ body: e.target.value })} /></Field>
                <Field label="Відео (посилання, необов'язково)"><input type="text" defaultValue={lesson.video_url || ""} onBlur={(e) => saveLesson({ video_url: e.target.value.trim() || null })} /></Field>
                <button type="button" className="btn small" onClick={async () => { if (!window.confirm("Видалити урок? Позначки «пройдено» цього уроку теж зникнуть.")) return; const e = await lessons.remove(lesson.id); if (e) setMsg(e); else setLessonId(null); }}>Видалити урок</button>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: 17, margin: "0 0 10px" }}>{lesson.title}</h3>
                {lesson.video_url && /^https?:\/\//.test(lesson.video_url) && <p><a href={lesson.video_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>▶ Відео до уроку ↗</a></p>}
                <HrText text={lesson.body} />
                <div className="toolbar" style={{ marginTop: 16, gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className={`btn${done.has(lesson.id) ? "" : " primary"}`} onClick={async () => { const was = done.has(lesson.id); await toggleDone(lesson); if (!was && ls[idx + 1]) { setLessonId(ls[idx + 1].id); try { document.querySelector(".hr-course__body")?.scrollIntoView({ block: "start" }); } catch { /* */ } } }}>
                    {done.has(lesson.id) ? "✓ Пройдено (зняти позначку)" : ls[idx + 1] ? "Пройдено — далі →" : "Пройдено"}
                  </button>
                  {idx > 0 && <button type="button" className="btn" onClick={() => setLessonId(ls[idx - 1].id)}>← Попередній</button>}
                </div>
              </>
            )}
          </div>
        </div>
        {(ct.length > 0 || editing) && <h3 style={{ fontSize: 14, margin: "20px 0 8px" }}>Перевірка знань</h3>}
        {ct.map(testCard)}
        {editing && <button type="button" className="btn small" onClick={async () => { const e = await tests.insert({ key: `t-${Date.now().toString(36)}`, title: `Тест: ${course.title}`, kind: "course", course_id: course.id, role_keys: course.role_keys || [] }); if (e) setMsg(e); else tests.reload(); }}>+ Тест до курсу</button>}
        {qEdit && <QuestionsEditor test={qEdit} supabase={supabase} onClose={(saved) => { setQEdit(null); if (saved) tests.reload(); }} />}
      </div>
    );
  }

  // ── каталог ──
  const shown = courses.rows.filter((c) => c.active && (embedded || onlyMine ? forMe(c.role_keys) : true));
  const standalone = tests.rows.filter((t) => !t.course_id && t.kind !== "candidate" && forMe(t.role_keys));
  const candTests = tests.rows.filter((t) => t.kind === "candidate");
  return (
    <div>
      {!embedded && (
        <>
          <p className="note">Курс — це кілька коротких уроків і тест наприкінці. Після тесту одразу видно розбір: де помилка й чому. Обов’язкові курси посади входять у показник «навчання пройдено».</p>
          <div className="toolbar">
            <div className="seg-row">
              <button type="button" className={`seg-btn${onlyMine ? " active" : ""}`} onClick={() => setOnlyMine(true)}>Для моєї посади</button>
              <button type="button" className={`seg-btn${!onlyMine ? " active" : ""}`} onClick={() => setOnlyMine(false)}>Усі курси</button>
            </div>
            <div className="toolbar-actions">
              {canHr && <button type="button" className="btn primary" onClick={async () => { const e = await courses.insert({ key: `c-${Date.now().toString(36)}`, title: "Новий курс", sort: courses.rows.length + 1 }); if (e) setMsg(e); else { await courses.reload(); setOnlyMine(false); } }}>+ Курс</button>}
            </div>
          </div>
        </>
      )}
      {msg && <div className="auth-error">{msg}</div>}
      <div className="hr-cards">
        {shown.map((c) => {
          const ls = lessons.rows.filter((l) => l.course_id === c.id);
          const d = ls.filter((l) => done.has(l.id)).length;
          const ct = tests.rows.filter((t) => t.course_id === c.id);
          const ok = ct.length > 0 && ct.every(passed);
          return (
            <div className="card" key={c.id} onClick={() => { setCourseId(c.id); setLessonId(null); setMsg(""); }}>
              <h3>{c.icon ? `${c.icon} ` : ""}{c.title}</h3>
              <div className="hr-chips">
                {c.required && <span className="badge active">обов’язковий</span>}
                <span className="tag">{LEVELS[c.level]}</span>
                {(c.role_keys || []).length ? c.role_keys.map((k) => <span className="tag" key={k}>{roleName(k)}</span>) : <span className="tag">для всіх</span>}
              </div>
              {c.descr && <p className="note">{c.descr}</p>}
              <Bar pct={ls.length ? (d / ls.length) * 100 : 0} state={d === ls.length && ls.length ? "ok" : undefined} />
              <div className="note">{d} з {ls.length} уроків · {ls.reduce((a, l) => a + (l.minutes || 0), 0)} хв{ct.length ? ` · тест: ${ok ? "складено ✓" : "не складено"}` : ""}</div>
            </div>
          );
        })}
        {!shown.length && <div className="empty">Для вашої посади курсів ще немає. Перемкніть на «Усі курси».</div>}
      </div>
      {standalone.length > 0 && <><h3 style={{ fontSize: 14, margin: "20px 0 8px" }}>Окремі тести</h3>{standalone.map(testCard)}</>}
      {canHr && !embedded && (
        <>
          <h3 style={{ fontSize: 14, margin: "24px 0 4px" }}>Вступні тести для кандидатів</h3>
          <p className="note" style={{ marginTop: 0 }}>Надсилаються кандидату посиланням із його картки («Вакансії й кандидати → кандидат → Тест»). Працівникам не показуються.</p>
          {candTests.map((t) => (
            <div className="hr-evalcard" key={t.id}>
              <div className="hr-evalcard__head">
                <b>📝 {t.title}</b>
                <span className="note" style={{ margin: 0 }}>{(t.role_keys || []).map(roleName).join(", ") || "усі посади"} · поріг {t.pass_pct}%{t.minutes ? ` · ${t.minutes} хв` : ""}</span>
                <button type="button" className="btn small" style={{ marginLeft: "auto" }} onClick={() => setQEdit(t)}>✎ Питання</button>
              </div>
              {t.descr && <div className="note">{t.descr}</div>}
            </div>
          ))}
          <button type="button" className="btn small" onClick={async () => { const e = await tests.insert({ key: `t-${Date.now().toString(36)}`, title: "Новий вступний тест", kind: "candidate", pass_pct: 70 }); if (e) setMsg(e); else tests.reload(); }}>+ Вступний тест</button>
        </>
      )}
      {qEdit && <QuestionsEditor test={qEdit} supabase={supabase} onClose={(saved) => { setQEdit(null); if (saved) tests.reload(); }} />}
    </div>
  );
}
