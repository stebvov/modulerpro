"use client";
// Плеєр квізу: стартовий екран → питання (з логікою переходів) → контакти → «дякуємо».
// Те саме бачить відвідувач на /q/<slug> і команда в попередньому перегляді конструктора (preview — без статистики й заявок).
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { answerText, nextIndex } from "@/lib/quiz";
import { trackVisit, visitorMeta } from "@/lib/site/visitor";
import { buildLeadMeta } from "@/lib/site/leadMeta";
import "./quiz.css";

let client;
const sb = () => (client ||= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } }));
const VIA = ["Дзвінок", "Viber", "Telegram"];

function sessionId(slug) {
  const k = "moduler_quiz_" + slug;
  try {
    let v = sessionStorage.getItem(k);
    if (!v) { v = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 40); sessionStorage.setItem(k, v); }
    return v;
  } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

function utmString() {
  try {
    const q = new URLSearchParams(location.search);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    return keys.filter((k) => q.get(k)).map((k) => `${k}=${q.get(k)}`).join("&");
  } catch { return ""; }
}

export default function QuizPlayer({ quiz, preview = false, embed = false }) {
  const questions = useMemo(() => (quiz.questions || []).filter((q) => q && q.title), [quiz.questions]);
  const start = quiz.start || {};
  const contact = quiz.contact || {};
  const thanks = quiz.thanks || {};
  const design = quiz.design || {};
  const n = questions.length;
  const [pos, setPos] = useState(start.enabled ? -1 : 0); // -1 старт, 0..n-1 питання, n контакти, n+1 дякуємо
  const [history, setHistory] = useState([]);
  const [answers, setAnswers] = useState({});
  const [via, setVia] = useState(VIA[0]);
  const [state, setState] = useState("idle");
  const [err, setErr] = useState("");
  const sid = useRef("");
  const startedAt = useRef(null);
  const tracked = useRef(new Set());

  function track(kind, step = -1) {
    if (preview || !quiz.slug) return;
    const key = kind + ":" + step;
    if (tracked.current.has(key)) return;
    tracked.current.add(key);
    sb().rpc("quiz_track", { p_slug: quiz.slug, p_sid: sid.current, p_kind: kind, p_step: step }).then(() => {}, () => {});
  }

  useEffect(() => {
    if (preview) return;
    sid.current = sessionId(quiz.slug);
    try { trackVisit(location.pathname); } catch { /* */ }
    track("view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pos >= 0 && pos < n) { track("start"); track("step", pos); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  // у конструкторі питання змінюються на льоту — не виходимо за межі
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (pos > n + 1) setPos(n); }, [n, pos]);

  function go(to) { setHistory((h) => [...h, pos]); setPos(to); }
  function back() { setHistory((h) => { const prev = h[h.length - 1]; if (prev != null) setPos(prev); return h.slice(0, -1); }); }

  const q = pos >= 0 && pos < n ? questions[pos] : null;
  const a = q ? answers[q.id] : undefined;
  const filled = q && !(a == null || a === "" || (Array.isArray(a) && !a.length));
  const canNext = q && (!q.required || filled);

  function answer(value, auto) {
    setAnswers((s) => ({ ...s, [q.id]: value }));
    if (auto) setTimeout(() => go(nextIndex(questions, pos, value)), 220);
  }

  function pick(opt) {
    if (q.multi) {
      const cur = Array.isArray(a) ? a : [];
      answer(cur.includes(opt.id) ? cur.filter((x) => x !== opt.id) : [...cur, opt.id]);
    } else answer(opt.id, true);
  }

  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (!String(f.name || "").trim()) { setErr("Вкажіть, як до вас звертатися"); return; }
    if (String(f.phone || "").replace(/\D/g, "").length < 9) { setErr("Перевірте номер телефону"); return; }
    setErr("");
    if (preview) { go(n + 1); return; }
    setState("sending");
    const list = questions.map((x) => ({ q: x.title, a: answerText(x, answers[x.id]) })).filter((x) => x.a);
    const body = { slug: quiz.slug, sid: sid.current, name: f.name, phone: f.phone, company: f.company || "", contact_via: contact.ask_via === false ? "" : via, answers: list, utm: utmString() };
    let meta = null;
    try { meta = await visitorMeta({ formStartedAt: startedAt.current, form: { kind: "квіз", quiz: quiz.title } }); } catch { /* */ }
    let data = null, error = null;
    try {
      const r = await fetch("/api/quiz/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, meta }) });
      if (r.status < 500) data = await r.json(); else throw new Error(String(r.status));
    } catch {
      let m = null;
      try { m = meta ? buildLeadMeta(meta, null) : null; } catch { /* */ }
      ({ data, error } = await sb().rpc("quiz_submit", { p: { ...body, ...(m ? { meta: m } : {}) } }));
    }
    if (error || !data?.ok) { setState("idle"); setErr(data?.error || "Не вдалося надіслати. Спробуйте ще раз."); return; }
    setState("done");
    try { window.gtag?.("event", "generate_lead"); window.fbq?.("track", "Lead"); window.parent?.postMessage({ type: "moduler-quiz-lead", slug: quiz.slug }, "*"); } catch { /* */ }
    if (thanks.redirect && /^https?:\/\//.test(thanks.redirect)) { (embed ? window.top : window).location.href = thanks.redirect; return; }
    go(n + 1);
  }

  const progress = pos < 0 ? 0 : Math.min(100, Math.round((Math.min(pos, n) / Math.max(n, 1)) * 100));
  const side = design.image && pos >= 0 && pos <= n;

  return (
    <div className={`qz${embed ? " qz--embed" : ""}${preview ? " qz--preview" : ""}`} style={{ "--qz-accent": design.accent || "#2f6b4f" }}>
      {pos === -1 && (
        <div className="qz-start" style={start.image ? { backgroundImage: `linear-gradient(90deg, rgba(10,20,15,.82), rgba(10,20,15,.35)), url(${start.image})` } : undefined}>
          <div className="qz-start__body">
            <h1>{start.title || quiz.title}</h1>
            {start.text && <p>{start.text}</p>}
            <button className="qz-btn qz-btn--big" onClick={() => { track("start"); go(0); }}>{start.button || "Почати"} →</button>
            {start.bonus && <div className="qz-bonus">{start.bonus}</div>}
          </div>
        </div>
      )}

      {pos >= 0 && pos <= n && (
        <div className={`qz-card${side ? " qz-card--side" : ""}`}>
          <div className="qz-main">
            <div className="qz-progress"><div style={{ width: progress + "%" }} /></div>
            <div className="qz-meta">{pos < n ? `Питання ${pos + 1} з ${n}` : "Останній крок"}</div>

            {q && (
              <>
                <h2>{q.title}</h2>
                {q.hint && <p className="qz-hint">{q.hint}</p>}
                {q.multi && <p className="qz-hint">Можна обрати кілька варіантів</p>}

                {q.type === "list" && (
                  <div className="qz-list">
                    {q.options.filter((o) => o.label).map((o) => {
                      const on = Array.isArray(a) ? a.includes(o.id) : a === o.id;
                      return <button key={o.id} type="button" className={`qz-opt${on ? " on" : ""}`} onClick={() => pick(o)}><span className={`qz-dot${q.multi ? " sq" : ""}`} />{o.label}</button>;
                    })}
                  </div>
                )}
                {q.type === "cards" && (
                  <div className="qz-cards">
                    {q.options.filter((o) => o.label).map((o) => {
                      const on = Array.isArray(a) ? a.includes(o.id) : a === o.id;
                      return (
                        <button key={o.id} type="button" className={`qz-cardopt${on ? " on" : ""}`} onClick={() => pick(o)}>
                          <span className="qz-cardopt__img" style={o.image ? { backgroundImage: `url(${o.image})` } : undefined}>{!o.image && "🏡"}</span>
                          <span className="qz-cardopt__label">{o.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {q.type === "text" && (
                  <textarea className="qz-input" rows={3} placeholder="Ваша відповідь" value={a || ""} onChange={(e) => answer(e.target.value)} />
                )}
                {q.type === "slider" && (
                  <div className="qz-slider">
                    <div className="qz-slider__val">{a ?? Math.round(((+q.min || 0) + (+q.max || 100)) / 2)} {q.unit}</div>
                    <input type="range" min={+q.min || 0} max={+q.max || 100} step={+q.step || 1} value={a ?? Math.round(((+q.min || 0) + (+q.max || 100)) / 2)} onChange={(e) => answer(+e.target.value)} />
                    <div className="qz-slider__ends"><span>{q.min} {q.unit}</span><span>{q.max} {q.unit}</span></div>
                  </div>
                )}
                {q.type === "date" && <input className="qz-input" type="date" value={a || ""} onChange={(e) => answer(e.target.value)} />}

                <div className="qz-nav">
                  {history.length > 0 ? <button type="button" className="qz-btn qz-btn--ghost" onClick={back}>← Назад</button> : <span />}
                  {(q.multi || ["text", "slider", "date"].includes(q.type) || !q.required) && (
                    <button type="button" className="qz-btn" disabled={!canNext} onClick={() => {
                      if (q.type === "slider" && a == null) setAnswers((s) => ({ ...s, [q.id]: Math.round(((+q.min || 0) + (+q.max || 100)) / 2) }));
                      go(nextIndex(questions, pos, a));
                    }}>{filled || q.type === "slider" ? "Далі →" : "Пропустити →"}</button>
                  )}
                </div>
              </>
            )}

            {pos === n && (
              <form className="qz-contact" onSubmit={submit} onFocus={() => { startedAt.current ||= Date.now(); }} noValidate>
                <h2>{contact.title || "Залиште контакти"}</h2>
                {contact.text && <p className="qz-hint">{contact.text}</p>}
                <input type="text" name="company" tabIndex={-1} autoComplete="off" className="qz-hp" aria-hidden />
                <label className="qz-field"><span>Імʼя</span><input className="qz-input" name="name" autoComplete="name" placeholder="Як до вас звертатися" /></label>
                <label className="qz-field"><span>Телефон</span><input className="qz-input" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+380 __ ___ __ __" /></label>
                {contact.ask_via !== false && (
                  <div className="qz-field"><span>Де зручніше спілкуватись</span>
                    <div className="qz-seg">{VIA.map((v) => <button key={v} type="button" className={via === v ? "on" : ""} onClick={() => setVia(v)}>{v}</button>)}</div>
                  </div>
                )}
                {err && <div className="qz-err" role="alert">{err}</div>}
                <div className="qz-nav">
                  {history.length > 0 ? <button type="button" className="qz-btn qz-btn--ghost" onClick={back}>← Назад</button> : <span />}
                  <button className="qz-btn" disabled={state === "sending"}>{state === "sending" ? "Надсилаємо…" : contact.button || "Надіслати"}</button>
                </div>
                <p className="qz-note">Натискаючи кнопку, ви погоджуєтесь на обробку контактних даних.</p>
              </form>
            )}
          </div>
          {side && <div className="qz-side" style={{ backgroundImage: `url(${design.image})` }} />}
        </div>
      )}

      {pos === n + 1 && (
        <div className="qz-card qz-thanks">
          <div className="qz-thanks__ok">✓</div>
          <h2>{thanks.title || "Дякуємо!"}</h2>
          {thanks.text && <p>{thanks.text}</p>}
          {preview && <button className="qz-btn qz-btn--ghost" onClick={() => { setAnswers({}); setHistory([]); setPos(start.enabled ? -1 : 0); }}>↺ Пройти ще раз</button>}
        </div>
      )}
    </div>
  );
}
