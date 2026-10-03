"use client";

// Одна форма для всіх оцінок: скринінг, співбесіда, завдання, рекомендації (кандидат);
// контрольна точка, огляд роботи, чек-лист якості, зустріч 1:1 (працівник).
// Питання, компетенції й чек-лист беруться з профілю посади — тому всі оцінюють однаково.
import { useState } from "react";
import { EVAL_KINDS, VERDICTS, compTotal, listTotal } from "@/lib/hr";
import { Field, Modal, Score5, Tri } from "./ui";

const HINT = {
  screen: "15 хвилин телефоном. Відмічайте, наскільки відповідь збігається з «хорошою». Стоп-питання з відповіддю «ні» — підстава відмовити одразу.",
  interview: "Питайте про минулу поведінку («розкажіть про випадок, коли…»). Оцінку кожної компетенції ставте самі, до обговорення з іншими інтерв'юерами.",
  task: "Оцініть виконання практичного завдання за тими самими компетенціями.",
  reference: "Дзвінок попередньому керівникові: чи підтверджує він результати, чому людина пішла, чи взяв би її знову.",
  probation: "Контрольна точка адаптації: що вже вміє, що ні, чи продовжуємо.",
  review: "Раз на місяць або квартал: оцінка компетенцій, сильні сторони, зони росту й план розвитку. Показники за період зберігаються разом з оглядом.",
  qa: "Перевірте одну розмову, зустріч, підготовлений будинок чи монтаж за чек-листом посади.",
  one_on_one: "Коротко: що обговорили й про що домовилися. Наступної зустрічі почнете з цих домовленостей.",
};

export default function EvalForm({ kind, role, target, who, supabase, kpis, onSaved, onClose }) {
  const [scores, setScores] = useState({});
  const [title, setTitle] = useState("");
  const [strengths, setStrengths] = useState("");
  const [growth, setGrowth] = useState("");
  const [plan, setPlan] = useState("");
  const [verdict, setVerdict] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const byComp = kind === "interview" || kind === "task" || kind === "probation" || kind === "review";
  const byList = kind === "screen" || kind === "qa";
  const items = kind === "screen" ? role?.screening || [] : kind === "qa" ? role?.qa_checklist || [] : [];
  const comps = role?.competencies || [];
  const total = byComp ? compTotal(scores, comps) : byList ? listTotal(scores, items) : null;
  const knock = kind === "screen" && items.some((it, i) => it.knockout && scores[i] === 0);
  const withVerdict = ["screen", "interview", "task", "reference", "probation"].includes(kind);

  async function save() {
    if (byComp && !Object.values(scores).some(Boolean)) { setErr("Поставте оцінку хоча б за однією компетенцією"); return; }
    if (byList && !Object.values(scores).some((x) => x != null)) { setErr("Відмітьте хоча б один пункт"); return; }
    if ((kind === "reference" || kind === "one_on_one") && !growth.trim() && !plan.trim() && !strengths.trim()) { setErr("Запишіть, про що говорили"); return; }
    setBusy(true); setErr("");
    const row = {
      ...target, kind, title: title.trim() || null, evaluator: who, scores, total,
      verdict: verdict || null, strengths: strengths.trim() || null, growth: growth.trim() || null, plan: plan.trim() || null,
      kpis: kind === "review" || kind === "probation" ? kpis || null : null,
      period: new Date().toISOString().slice(0, 7),
    };
    const { data, error } = await supabase.from("hr_evals").insert(row).select().single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSaved(data);
  }

  return (
    <Modal wide title={`${EVAL_KINDS[kind]}${role ? ` · ${role.name}` : ""}`} onClose={onClose}
      actions={<><button type="button" className="btn" onClick={onClose}>Скасувати</button><button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? "Зберігаємо…" : "Зберегти оцінку"}</button></>}>
      <p className="note" style={{ marginTop: 0 }}>{HINT[kind]}</p>
      {err && <div className="auth-error">{err}</div>}
      {!role && (byComp || byList) && <div className="empty">Немає профілю посади — оберіть посаду, щоб з’явилися питання й компетенції.</div>}

      {(kind === "qa" || kind === "reference" || kind === "one_on_one") && (
        <Field label={kind === "qa" ? "Що перевіряли (розмова з клієнтом, будинок, монтаж…)" : kind === "reference" ? "Хто дає рекомендацію (ім'я, посада, компанія)" : "Тема зустрічі"}>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      )}

      {byList && items.map((it, i) => (
        <div className="hr-evalrow" key={i}>
          <div>
            <b>{kind === "screen" ? it.q : it.text}</b>
            {it.knockout && <span className="badge draft" style={{ marginLeft: 6, color: "var(--danger)" }}>стоп-питання</span>}
            {it.good && <div className="note">Хороша відповідь: {it.good}</div>}
            {kind === "qa" && it.weight ? <div className="note">вага {it.weight}</div> : null}
          </div>
          <Tri value={scores[i] ?? null} onChange={(v) => setScores((x) => ({ ...x, [i]: v }))} />
        </div>
      ))}
      {knock && <div className="auth-error">Стоп-питання з відповіддю «ні» — за профілем посади це підстава зупинитися на цьому кроці.</div>}

      {byComp && comps.map((c) => {
        const qs = kind === "interview" ? (role.interview || []).filter((q) => q.comp === c.key) : [];
        return (
          <div className="hr-evalcomp" key={c.key}>
            <div className="hr-evalrow">
              <div><b>{c.name}</b> <span className="note">вага {c.weight}</span>{c.desc && <div className="note">{c.desc}</div>}</div>
              <Score5 value={scores[c.key]} onChange={(v) => setScores((x) => ({ ...x, [c.key]: v }))} />
            </div>
            <div className="hr-anchors">
              <span><b>5</b> — {c.good}</span>
              <span><b>1</b> — {c.bad}</span>
            </div>
            {qs.map((q, i) => (
              <details className="hr-q" key={i} open={i === 0}>
                <summary>{q.q}</summary>
                {q.probe && <div><i>Уточнення:</i> {q.probe}</div>}
                {q.good && <div><i>Сильна відповідь:</i> {q.good}</div>}
                {q.bad && <div><i>Слабка відповідь:</i> {q.bad}</div>}
              </details>
            ))}
          </div>
        );
      })}

      {total != null && <div className="hr-total">Разом: <b>{total}%</b></div>}

      {kind !== "one_on_one" && kind !== "screen" && (
        <Field label={kind === "qa" ? "Що було добре" : "Сильні сторони (факти з відповідей або роботи)"}><textarea rows={2} value={strengths} onChange={(e) => setStrengths(e.target.value)} /></Field>
      )}
      <Field label={kind === "one_on_one" ? "Що обговорили" : kind === "screen" ? "Нотатки з розмови" : kind === "qa" ? "Що виправити" : "Зони росту й сумніви"}><textarea rows={2} value={growth} onChange={(e) => setGrowth(e.target.value)} /></Field>
      {(kind === "review" || kind === "probation" || kind === "one_on_one" || kind === "qa") && (
        <Field label={kind === "qa" ? "Домовленість: що зробить і до коли" : "План: що робимо до наступної зустрічі (хто, що, до коли)"}><textarea rows={2} value={plan} onChange={(e) => setPlan(e.target.value)} /></Field>
      )}
      {withVerdict && (
        <Field label={kind === "probation" ? "Рішення: продовжуємо?" : "Висновок: рухаємо далі?"}>
          <div className="seg-row">{VERDICTS.map(([v, l]) => <button key={v} type="button" className={`seg-btn${verdict === v ? " active" : ""}`} onClick={() => setVerdict(verdict === v ? "" : v)}>{l}</button>)}</div>
        </Field>
      )}
    </Modal>
  );
}
