"use client";

// Перегляд зданого тесту: відповіді людини, правильні варіанти, оцінка відкритих питань.
// Відкриті відповіді одразу після здачі оцінює ШІ (edge-функція hr-ai) — тут видно його бали й пояснення;
// людина може змінити бали й зберегти від свого імені або попросити ШІ оцінити ще раз.
import { useEffect, useState } from "react";
import { Modal } from "./ui";

export default function AttemptReview({ attempt, test, who, supabase, onSaved, onReload, onClose }) {
  const [qs, setQs] = useState(null);
  const [points, setPoints] = useState(attempt.open_points || {});
  const [ai, setAi] = useState(attempt.ai || null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let on = true;
    supabase.from("hr_questions").select("*").eq("test_id", attempt.test_id).order("sort").then(({ data, error }) => {
      if (!on) return;
      if (error) setErr(error.message); else setQs(data || []);
    });
    return () => { on = false; };
  }, [supabase, attempt.test_id]);

  const open = (qs || []).filter((q) => q.kind === "open");
  const max = (qs || []).reduce((a, q) => a + Number(q.points), 0);
  const openSum = open.reduce((a, q) => a + (Number(points[q.id]) || 0), 0);
  const final = max ? Math.round(((Number(attempt.auto_points) || 0) + openSum) / max * 100) : null;
  const allScored = open.every((q) => points[q.id] != null && points[q.id] !== "");

  async function save() {
    if (!allScored) { setErr("Оцініть усі відкриті відповіді"); return; }
    setBusy(true); setErr("");
    const patch = { open_points: points, score_pct: final, passed: final >= (test?.pass_pct ?? 80), status: "checked", checked_by: who, checked_at: new Date().toISOString() };
    const { error } = await supabase.from("hr_attempts").update(patch).eq("id", attempt.id);
    if (!error && attempt.candidate_id) await supabase.from("hr_candidates").update({ score_test: final }).eq("id", attempt.candidate_id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSaved({ ...attempt, ...patch });
  }

  async function askAi() {
    setAsking(true); setErr("");
    const { data, error } = await supabase.functions.invoke("hr-ai", { body: { action: "grade", attempt: attempt.id } });
    setAsking(false);
    if (error || !data?.ok) {
      const text = data?.error || "ШІ зараз недоступний — оцініть відповіді самі.";
      setAi({ error: text }); setErr(text);
      return;
    }
    setAi({ grades: data.grades, summary: data.summary, at: new Date().toISOString() });
    setPoints(Object.fromEntries(Object.entries(data.grades || {}).map(([id, g]) => [id, g.points])));
    onReload?.();
  }

  return (
    <Modal wide title={`Відповіді: ${test?.title || "тест"}`} onClose={onClose}
      actions={<>
        <button type="button" className="btn" onClick={onClose}>Закрити</button>
        {open.length > 0 && <button type="button" className="btn" disabled={asking || !qs} onClick={askAi}>{asking ? "ШІ оцінює… (до хвилини)" : ai?.grades ? "🤖 Оцінити ШІ ще раз" : "🤖 Оцінити ШІ"}</button>}
        {open.length > 0 && <button type="button" className="btn primary" disabled={busy || !qs} onClick={save}>{busy ? "Зберігаємо…" : `Зберегти оцінку${final != null && allScored ? ` — ${final}%` : ""}`}</button>}
      </>}>
      {err && <div className="auth-error">{err}</div>}
      <p className="note" style={{ marginTop: 0 }}>
        Питання з варіантами: {attempt.auto_points ?? "—"} балів{attempt.late ? " · здано із запізненням" : ""}
        {attempt.finished_at ? ` · ${new Date(attempt.finished_at).toLocaleString("uk-UA")}` : ""}
        {attempt.started_at && attempt.finished_at ? ` · ${Math.max(1, Math.round((new Date(attempt.finished_at) - new Date(attempt.started_at)) / 60000))} хв` : ""}
      </p>
      {open.length > 0 && ai?.grades && (
        <div className="hr-hint hr-hint--warn" style={{ marginBottom: 10 }}>
          <span aria-hidden>🤖</span>
          <div>
            Відкриті відповіді оцінив ШІ за критеріями питань. Пояснення — під кожною відповіддю. Не згодні — змініть бали й натисніть «Зберегти оцінку».
            {ai.summary && <div className="note">{ai.summary}</div>}
          </div>
        </div>
      )}
      {open.length > 0 && !ai?.grades && ai?.error && !err && (
        <div className="hr-hint hr-hint--bad" style={{ marginBottom: 10 }}><span aria-hidden>🤖</span><div>ШІ не зміг оцінити відкриті відповіді: {ai.error} Оцініть самі або спробуйте ще раз.</div></div>
      )}
      {!qs && !err && <div className="empty">Завантаження…</div>}
      {(qs || []).map((q, i) => {
        const a = attempt.answers?.[q.id];
        if (q.kind === "open") {
          const g = ai?.grades?.[q.id];
          return (
            <div className="hr-evalcomp" key={q.id}>
              <b>{i + 1}. {q.text}</b>
              <div className="hr-answer">{String(a || "").trim() || "(без відповіді)"}</div>
              {q.explain && <div className="note">На що дивитися: {q.explain}</div>}
              {g?.why && <div className="note">🤖 {g.points} з {Number(q.points)}: {g.why}</div>}
              <div className="hr-evalrow" style={{ marginTop: 6 }}>
                <span className="note" style={{ margin: 0 }}>Бали (0–{Number(q.points)})</span>
                <span className="hr-score5">
                  {Array.from({ length: Number(q.points) + 1 }, (_, n) => (
                    <button key={n} type="button" className={Number(points[q.id]) === n && points[q.id] != null ? "on" : ""} onClick={() => setPoints({ ...points, [q.id]: n })}>{n}</button>
                  ))}
                </span>
              </div>
            </div>
          );
        }
        const chosen = Array.isArray(a) ? a : [];
        const ok = JSON.stringify([...chosen].sort()) === JSON.stringify([...(q.correct || [])].sort());
        return (
          <div className="hr-evalcomp" key={q.id}>
            <b>{i + 1}. {q.text}</b> <span className={ok ? "fresh" : "stale"}>{ok ? "✓" : "✗"}</span>
            <ul className="hr-opts">
              {(q.options || []).map((o, j) => {
                const right = (q.correct || []).includes(j), mine = chosen.includes(j);
                return <li key={j} className={right ? "right" : mine ? "wrong" : ""}>{right ? "✓" : mine ? "✗" : "·"} {o}{mine && <i> — відповідь</i>}</li>;
              })}
            </ul>
          </div>
        );
      })}
    </Modal>
  );
}
