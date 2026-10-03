"use client";

// Проходження тесту за токеном спроби. Один компонент для працівника (у системі) і кандидата (за посиланням на сайті).
// Правильні відповіді в браузер не потрапляють: питання віддає hr_test_open, бали рахує hr_test_submit.
// Працівник після здачі бачить розбір кожного питання; кандидат — лише подяку.
import { useCallback, useEffect, useRef, useState } from "react";
import s from "./TestRunner.module.css";

const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

export default function TestRunner({ supabase, token, onClose, onRetake }) {
  const [state, setState] = useState("loading"); // loading | intro | run | sending | done | error
  const [info, setInfo] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [left, setLeft] = useState(null); // секунд до кінця
  const deadline = useRef(null);
  const dirty = useRef(false);
  const answersRef = useRef({});
  const sent = useRef(false);

  const start = useCallback(async () => {
    setState("loading");
    const { data, error } = await supabase.rpc("hr_test_open", { p_token: token });
    if (error || !data?.ok) { setErr(data?.error || "Не вдалося відкрити тест. Спробуйте оновити сторінку."); setState("error"); return; }
    if (data.done) { setInfo(data); setState("done"); return; }
    setInfo(data);
    setQuestions(data.questions || []);
    const saved = data.answers && typeof data.answers === "object" ? data.answers : {};
    setAnswers(saved); answersRef.current = saved;
    if (data.minutes) {
      // час рахуємо від серверного старту — оновлення сторінки його не скидає
      const skew = Date.now() - new Date(data.now).getTime();
      deadline.current = new Date(data.started_at).getTime() + data.minutes * 60000 + skew;
      setLeft(Math.max(0, Math.round((deadline.current - Date.now()) / 1000)));
    }
    setState("run");
  }, [supabase, token]);

  useEffect(() => {
    let on = true;
    supabase.rpc("hr_test_peek", { p_token: token }).then(({ data, error }) => {
      if (!on) return;
      if (error || !data?.ok) { setErr(data?.error || "Не вдалося відкрити тест. Спробуйте оновити сторінку."); setState("error"); return; }
      setInfo(data);
      if (data.done) setState("done");
      else if (data.started) start(); // уже почали — повертаємо до питань
      else setState("intro");
    });
    return () => { on = false; };
  }, [supabase, token, start]);

  const submit = useCallback(async () => {
    if (sent.current) return;
    sent.current = true;
    setState("sending");
    const { data, error } = await supabase.rpc("hr_test_submit", { p_token: token, p_answers: answersRef.current, p_final: true });
    if (error || !data?.ok) { sent.current = false; setErr(data?.error || "Не вдалося надіслати відповіді. Перевірте інтернет і натисніть ще раз."); setState("run"); return; }
    setResult(data);
    setState("done");
    try { window.scrollTo({ top: 0 }); } catch { /* */ }
  }, [supabase, token]);

  // відлік часу; коли вийшов — здаємо те, що є
  useEffect(() => {
    if (state !== "run" || !deadline.current) return;
    const t = setInterval(() => {
      const sec = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setLeft(sec);
      if (sec <= 0) { clearInterval(t); submit(); }
    }, 1000);
    return () => clearInterval(t);
  }, [state, submit]);

  // чернетка відповідей зберігається кожні 15 секунд — закрита вкладка не означає втрачений тест
  useEffect(() => {
    if (state !== "run") return;
    const t = setInterval(() => {
      if (!dirty.current || sent.current) return;
      dirty.current = false;
      supabase.rpc("hr_test_submit", { p_token: token, p_answers: answersRef.current, p_final: false }).then(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [state, supabase, token]);

  function setAns(id, value) {
    setAnswers((a) => { const next = { ...a, [id]: value }; answersRef.current = next; return next; });
    dirty.current = true;
  }
  function toggle(q, i) {
    if (q.kind === "single") return setAns(q.id, [i]);
    const cur = Array.isArray(answers[q.id]) ? answers[q.id] : [];
    setAns(q.id, cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b));
  }

  const answered = questions.filter((q) => (q.kind === "open" ? String(answers[q.id] || "").trim() : Array.isArray(answers[q.id]) && answers[q.id].length)).length;

  if (state === "loading") return <div className={s.box}><p className={s.muted}>Завантаження…</p></div>;
  if (state === "error") return <div className={s.box}><h2 className={s.h}>Тест недоступний</h2><p>{err}</p>{onClose && <button type="button" className={s.btn} onClick={onClose}>Закрити</button>}</div>;

  if (state === "intro") {
    return (
      <div className={s.box}>
        <div className={s.eyebrow}>Moduler · тест</div>
        <h2 className={s.h}>{info.title}</h2>
        {info.who && <p>{info.who}, вітаємо!</p>}
        {info.descr && <p>{info.descr}</p>}
        <ul className={s.facts}>
          <li><b>{info.count}</b> питань</li>
          {info.minutes ? <li><b>{info.minutes} хв</b> — відлік почнеться після кнопки «Почати» і не зупиняється</li> : <li>без обмеження часу</li>}
          <li>відповіді зберігаються автоматично</li>
          {!info.member && <li>пройти можна один раз</li>}
        </ul>
        <div className={s.row}>
          <button type="button" className={`${s.btn} ${s.primary}`} onClick={start}>Почати</button>
          {onClose && <button type="button" className={s.btn} onClick={onClose}>Пізніше</button>}
        </div>
      </div>
    );
  }

  if (state === "done") {
    // кандидат (або повторне відкриття вже зданого тесту)
    if (!result || result.pct === undefined) {
      return (
        <div className={s.box}>
          <div className={s.ok}>🌿</div>
          <h2 className={s.h}>Дякуємо{info?.who ? `, ${info.who}` : ""}! Відповіді отримали</h2>
          <p>{info?.member ? "Цей тест уже здано. Результат — у розділі «Мій розвиток»." : "Ми переглянемо результати й зв’яжемося з вами найближчими днями."}</p>
          {onClose && <button type="button" className={s.btn} onClick={onClose}>Закрити</button>}
        </div>
      );
    }
    const byId = Object.fromEntries((result.review || []).map((r) => [r.id, r]));
    return (
      <div className={s.box}>
        <div className={s.eyebrow}>Результат</div>
        <h2 className={s.h}>{info.title}</h2>
        <div className={`${s.score} ${result.open ? "" : result.passed ? s.pass : s.fail}`}>
          <b>{result.pct ?? "—"}%</b>
          <span>
            {result.open
              ? "за питання з варіантами. Відкриті відповіді оцінює ШІ за критеріями автора тесту — остаточний результат з’явиться за кілька хвилин у «Мій розвиток»; керівник може його змінити."
              : result.passed ? `Тест складено (поріг ${result.pass_pct}%).` : `Не складено: потрібно ${result.pass_pct}%. Перегляньте розбір нижче, повторіть уроки й спробуйте ще раз.`}
          </span>
        </div>
        <h3 className={s.h3}>Розбір</h3>
        {questions.map((q, i) => {
          const r = byId[q.id] || {};
          const mine = answers[q.id];
          return (
            <div key={q.id} className={`${s.q} ${r.open ? "" : r.ok ? s.qok : s.qbad}`}>
              <div className={s.qt}><span>{i + 1}.</span> {q.text} {!r.open && <em>{r.ok ? "✓ правильно" : "✗ помилка"}</em>}</div>
              {q.kind === "open" ? (
                <div className={s.openAns}>{String(mine || "").trim() || "(без відповіді)"}</div>
              ) : (
                <ul className={s.opts}>
                  {(q.options || []).map((o, j) => {
                    const right = (r.correct || []).includes(j), chosen = Array.isArray(mine) && mine.includes(j);
                    return <li key={j} className={right ? s.right : chosen ? s.wrong : ""}>{right ? "✓" : chosen ? "✗" : "·"} {o}{chosen && <i> — ваша відповідь</i>}</li>;
                  })}
                </ul>
              )}
              {r.explain && <div className={s.explain}>{r.open ? "Критерії оцінки: " : ""}{r.explain}</div>}
            </div>
          );
        })}
        <div className={s.row}>
          {onRetake && !result.open && !result.passed && <button type="button" className={`${s.btn} ${s.primary}`} onClick={onRetake}>Пройти ще раз</button>}
          {onClose && <button type="button" className={s.btn} onClick={onClose}>Закрити</button>}
        </div>
      </div>
    );
  }

  return (
    <div className={s.box}>
      <div className={s.top}>
        <div>
          <div className={s.eyebrow}>{info.title}</div>
          <div className={s.muted}>Відповіли на {answered} з {questions.length}</div>
        </div>
        {left != null && <div className={`${s.timer} ${left < 120 ? s.timerLow : ""}`} role="timer" aria-live="off">⏱ {mmss(left)}</div>}
      </div>
      {err && <div className={s.err} role="alert">{err}</div>}
      {questions.map((q, i) => (
        <fieldset key={q.id} className={s.q}>
          <legend className={s.qt}><span>{i + 1}.</span> {q.text}{q.kind === "multi" && <em>кілька відповідей</em>}</legend>
          {q.kind === "open" ? (
            <textarea className={s.ta} rows={5} value={answers[q.id] || ""} onChange={(e) => setAns(q.id, e.target.value)} placeholder="Ваша відповідь" maxLength={4000} />
          ) : (
            (q.options || []).map((o, j) => (
              <label key={j} className={s.opt}>
                <input type={q.kind === "single" ? "radio" : "checkbox"} name={`q-${q.id}`} checked={Array.isArray(answers[q.id]) && answers[q.id].includes(j)} onChange={() => toggle(q, j)} />
                <span>{o}</span>
              </label>
            ))
          )}
        </fieldset>
      ))}
      <div className={s.row}>
        <button type="button" className={`${s.btn} ${s.primary}`} disabled={state === "sending"} onClick={() => {
          if (answered < questions.length && !window.confirm(`Без відповіді лишилось питань: ${questions.length - answered}. Здати все одно?`)) return;
          submit();
        }}>{state === "sending" ? "Надсилаємо…" : "Здати тест"}</button>
        {onClose && <button type="button" className={s.btn} onClick={onClose}>Продовжити пізніше</button>}
      </div>
    </div>
  );
}
