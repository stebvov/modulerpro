"use client";

// Показники людини проти цілей посади + підказки, що зробити зараз. Використовують «Якість роботи» (HR) і «Мій розвиток» (сам працівник).
import { useEffect, useState } from "react";
import { EVAL_KINDS, buildHints, enrich, findLesson, fmtDate, kpiState, verdictLabel } from "@/lib/hr";
import { Dot } from "./ui";

const STATE_LABEL = { ok: "у нормі", warn: "увага", bad: "нижче цілі", none: "немає даних або цілі" };
const num = (v, unit) => (v == null ? "—" : `${String(Math.round(Number(v) * 100) / 100).replace(".", ",")}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`);

// показники з бази для кількох людей за період: { [memberId]: values }
export function useMetrics(supabase, memberIds, period) {
  const [map, setMap] = useState({});
  const [loading, setLoading] = useState(true);
  const key = memberIds.join(",") + "|" + period.join("|");
  useEffect(() => {
    let on = true;
    if (!memberIds.length) return;
    Promise.all(memberIds.map((id) => supabase.rpc("hr_metrics", { p_member: id, p_from: period[0], p_to: period[1] }).then(({ data }) => [id, data?.ok ? data.values : null])))
      .then((rows) => { if (on) { setMap(Object.fromEntries(rows)); setLoading(false); } });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, key]);
  return { map, loading: loading && memberIds.length > 0 };
}

// усе пораховане для однієї людини: значення, стани показників, підказки
export function personView({ member, role, values, evals, attempts, tests, period, reports, forHr }) {
  const v = enrich(values, { evals, member, period, reports });
  const kpis = (role?.kpis || []).map((k) => ({ ...k, ...kpiState(k, v) }));
  const hints = buildHints({ role, v, evals, attempts, tests, member, forHr });
  return { v, kpis, hints, bad: kpis.filter((k) => k.state === "bad").length, warn: kpis.filter((k) => k.state === "warn").length };
}

export default function PersonQuality({ view, role, courses = [], lessons = [], onOpenLesson }) {
  const { kpis, hints } = view;
  return (
    <div>
      <h4 className="hr-phase">Що зробити зараз</h4>
      <div className="hr-hints">
        {hints.map((h, i) => {
          const ref = findLesson(h.lesson, courses, lessons);
          return (
            <div className={`hr-hint hr-hint--${h.level}`} key={i}>
              <span aria-hidden>{h.level === "bad" ? "🔴" : h.level === "warn" ? "🟡" : h.level === "ok" ? "🟢" : "ℹ️"}</span>
              <div>
                {h.text}
                {ref && (
                  <div className="note">
                    Допоможе: {onOpenLesson ? <button type="button" className="hr-link" onClick={() => onOpenLesson(ref)}>«{ref.lesson?.title || ref.course.title}»</button> : <b>«{ref.lesson?.title || ref.course.title}»</b>}
                    {ref.lesson ? ` — курс «${ref.course.title}»` : ""}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {role && (
        <>
          <h4 className="hr-phase">Показники проти цілей посади</h4>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Показник</th><th style={{ textAlign: "right" }}>Факт</th><th style={{ textAlign: "right" }}>Ціль</th><th>Стан</th></tr></thead>
              <tbody>
                {kpis.map((k) => (
                  <tr key={k.key}>
                    <td>{k.name}{k.note && <div className="note">{k.note}</div>}{!k.metric && <div className="note">вноситься вручну під час огляду</div>}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{k.metric ? num(k.val, k.unit) : "—"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{k.target == null ? <span className="note">не задано</span> : `${k.better === "less" ? "≤" : "≥"} ${num(k.target, k.unit)}`}</td>
                    <td style={{ whiteSpace: "nowrap" }}><Dot state={k.state} title={STATE_LABEL[k.state]} /> {STATE_LABEL[k.state]}</td>
                  </tr>
                ))}
                {!kpis.length && <tr><td colSpan={4} className="empty">У профілі посади ще немає показників.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// історія оцінок людини (огляди, чек-листи, 1:1, контрольні точки)
export function EvalHistory({ evals, role, onDelete }) {
  if (!evals.length) return <div className="note">Оцінок ще немає.</div>;
  return evals.map((e) => (
    <div className="hr-evalcard" key={e.id}>
      <div className="hr-evalcard__head">
        <b>{EVAL_KINDS[e.kind]}</b>
        {e.total != null && <span className="badge active">{Math.round(e.total)}%</span>}
        {e.verdict && <span className="badge draft">{verdictLabel(e.verdict)}</span>}
        <span className="note" style={{ margin: 0 }}>{e.evaluator} · {fmtDate(e.created_at)}</span>
        {onDelete && <button type="button" className="btn small" style={{ marginLeft: "auto" }} title="Видалити" onClick={() => window.confirm("Видалити цю оцінку?") && onDelete(e.id)}>×</button>}
      </div>
      {e.title && <div className="note">{e.title}</div>}
      {e.kind === "qa" && role?.qa_checklist && (
        <div className="hr-chips">{role.qa_checklist.map((it, i) => (e.scores?.[i] != null && Number(e.scores[i]) < 1 ? <span className="tag" key={i} style={{ color: "var(--danger)" }}>{Number(e.scores[i]) === 0 ? "✗" : "±"} {it.text}</span> : null))}</div>
      )}
      {(e.kind === "review" || e.kind === "probation") && role && (
        <div className="hr-chips">{(role.competencies || []).filter((c) => e.scores?.[c.key]).map((c) => <span className="tag" key={c.key}>{c.name}: {e.scores[c.key]}</span>)}</div>
      )}
      {e.strengths && <div><i>Сильне:</i> {e.strengths}</div>}
      {e.growth && <div><i>{e.kind === "one_on_one" ? "Обговорили" : e.kind === "qa" ? "Виправити" : "Зони росту"}:</i> {e.growth}</div>}
      {e.plan && <div><i>План:</i> {e.plan}</div>}
    </div>
  ));
}
