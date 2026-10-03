"use client";

// Розбір розмови ШІ: вставляєте текст дзвінка чи переписки — отримуєте оцінку за чек-листом посади з доказами,
// що було добре, що сказати інакше й одну домовленість на тиждень. Текст розмови ніде не зберігається.
// Працівник перевіряє так свою розмову сам; керівник переносить розбір у «Перевірку за чек-листом» і зберігає від свого імені.
import { useState } from "react";
import { listTotal } from "@/lib/hr";

const MARK = { 1: ["✓", "так", "fresh"], 0.5: ["±", "частково", ""], 0: ["✗", "ні", "stale"] };
const MAX = 60000;

export default function TalkCheck({ supabase, role, onUse, selfCheck }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);

  async function run() {
    const body = text.trim();
    if (body.length < 150) { setErr("Вставте розмову повністю — тексту замало для розбору."); return; }
    if (body.length > MAX) { setErr(`Текст задовгий (${body.length} символів). Лишіть одну розмову — до ${MAX} символів.`); return; }
    setBusy(true); setErr(""); setRes(null);
    const { data, error } = await supabase.functions.invoke("hr-ai", { body: { action: "talk", role_key: role.key, text: body } });
    setBusy(false);
    if (error || !data?.ok) { setErr(data?.error || "ШІ зараз недоступний. Спробуйте пізніше або оцініть за чек-листом вручну."); return; }
    setRes(data);
  }

  const scores = res ? Object.fromEntries(res.items.filter((x) => x.score != null).map((x) => [x.i, x.score])) : {};
  const total = res ? listTotal(scores, role.qa_checklist) : null;

  return (
    <div className="hr-talk">
      <p className="note" style={{ marginTop: 0 }}>
        {selfCheck
          ? "Вставте текст своєї розмови з клієнтом (розшифровку дзвінка або переписку). ШІ оцінить її за чек-листом вашої посади й підкаже, що сказати інакше. Цей розбір бачите лише ви, текст не зберігається."
          : "Вставте текст розмови працівника (розшифровку дзвінка або переписку). ШІ оцінить її за чек-листом посади — ви перевірите й збережете оцінку. Текст розмови не зберігається."}
      </p>
      <textarea rows={res ? 4 : 10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Менеджер: Добрий день, це Марія з Moduler…&#10;Клієнт: Добрий день, я лишав заявку…" style={{ width: "100%" }} aria-label="Текст розмови" />
      <div className="toolbar" style={{ gap: 8, marginTop: 8 }}>
        <button type="button" className="btn primary" disabled={busy || !text.trim()} onClick={run}>{busy ? "ШІ читає розмову… (до хвилини)" : res ? "Розібрати ще раз" : "🤖 Розібрати розмову"}</button>
        <span className="note" style={{ margin: 0 }}>{text.length ? `${text.length} символів` : ""}</span>
      </div>
      {err && <div className="auth-error" style={{ marginTop: 8 }}>{err}</div>}

      {res && (
        <div style={{ marginTop: 12 }}>
          {total != null && <div className="hr-total">За чек-листом: <b>{total}%</b> <span className="note">— без пунктів, про які з тексту судити не можна</span></div>}
          {res.items.map((x) => {
            const m = MARK[x.score];
            return (
              <div className="hr-evalrow" key={x.i} style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <b>{x.text}</b>
                  {x.evidence && <div className="note">{x.evidence}</div>}
                </div>
                <span className={m ? m[2] : "note"} style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{m ? `${m[0]} ${m[1]}` : "— не видно з тексту"}</span>
              </div>
            );
          })}
          {res.strengths && <><h4 className="hr-phase">Що було добре</h4><div className="hr-answer">{res.strengths}</div></>}
          {res.fix && <><h4 className="hr-phase">Що зробити інакше</h4><div className="hr-answer">{res.fix}</div></>}
          {res.plan && <><h4 className="hr-phase">Домовленість на тиждень</h4><div className="hr-answer">{res.plan}</div></>}
          {onUse && (
            <div className="toolbar" style={{ marginTop: 10 }}>
              <button type="button" className="btn primary" onClick={() => onUse({ scores, evidence: Object.fromEntries(res.items.map((x) => [x.i, x.evidence])), strengths: res.strengths, growth: res.fix, plan: res.plan, title: "Розмова з клієнтом (розбір ШІ, перевірено керівником)" })}>
                Перенести в перевірку за чек-листом →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
