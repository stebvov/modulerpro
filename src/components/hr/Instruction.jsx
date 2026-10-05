"use client";

// Посадова інструкція: кому підпорядковується, обов'язки з періодичністю, права, відповідальність, взаємодія.
// Лежить у профілі посади (hr_roles.instruction); особисті доповнення людини — в hr_member_instr.
// Раз на місяць ШІ дивиться, що людина справді робила, і пропонує, що дописати (hr_instr_updates) —
// приймає чи відхиляє той, хто веде найм.
import { useState } from "react";
import { fmtDate, todayISO } from "@/lib/hr";
import { Copy, Field, ListEditor, StringsEditor } from "./ui";

export const RHYTHMS = ["постійно", "щодня", "щотижня", "щомісяця", "щокварталу", "за подією"];
const RHYTHM_OPTS = RHYTHMS.map((r) => [r, r]);
const FRESH_DAYS = 45; // скільки днів дописаний обов'язок позначається як новий
const isFresh = (d) => d.added && (new Date(todayISO()) - new Date(d.added)) / 864e5 <= FRESH_DAYS;

function groupDuties(duties) {
  const groups = [];
  for (const d of duties || []) {
    const area = d.area || "Загальне";
    let g = groups.find((x) => x.area === area);
    if (!g) groups.push((g = { area, items: [] }));
    g.items.push(d);
  }
  return groups;
}

// інструкція одним текстом — щоб надіслати людині або роздрукувати на підпис
export function instructionText(role, personal) {
  const ins = role.instruction || {};
  const out = [`ПОСАДОВА ІНСТРУКЦІЯ: ${role.name}`, ""];
  if (role.mission) out.push(`Призначення посади. ${role.mission}`, "");
  if (ins.reports_to) out.push(`Підпорядковується: ${ins.reports_to}`);
  if (ins.leads && ins.leads !== "—") out.push(`Керує: ${ins.leads}`);
  if (ins.substitute) out.push(`Заміщення: ${ins.substitute}`);
  out.push("", "ОБОВ'ЯЗКИ");
  for (const g of groupDuties(ins.duties)) {
    out.push("", g.area);
    for (const d of g.items) out.push(`• ${d.text}${d.rhythm ? ` (${d.rhythm})` : ""}`);
  }
  if (personal?.scope || personal?.duties?.length) {
    out.push("", `ОСОБИСТО${personal.scope ? `: ${personal.scope}` : ""}`);
    for (const d of personal.duties || []) out.push(`• ${d.text}${d.rhythm ? ` (${d.rhythm})` : ""}`);
  }
  if (ins.rights?.length) out.push("", "ПРАВА", ...ins.rights.map((x) => `• ${x}`));
  if (ins.responsibility?.length) out.push("", "ВІДПОВІДАЛЬНІСТЬ", ...ins.responsibility.map((x) => `• ${x}`));
  if (ins.interactions?.length) out.push("", "ВЗАЄМОДІЯ", ...ins.interactions.map((x) => `• ${x.who}: ${x.what}`));
  if (ins.rev_at) out.push("", `Редакція від ${fmtDate(ins.rev_at)}`);
  return out.join("\n");
}

function Duty({ d }) {
  return (
    <li>
      {d.text} {d.rhythm && <span className="tag">{d.rhythm}</span>}
      {isFresh(d) && <span className="badge active" title={`Дописано ${fmtDate(d.added)}`}>нове</span>}
    </li>
  );
}

// Перегляд інструкції (для працівника — його власна, разом з особистими доповненнями)
export function Instruction({ role, personal }) {
  const ins = role.instruction || {};
  if (!(ins.duties || []).length) return <p className="note">Інструкцію для цієї посади ще не описано.</p>;
  return (
    <div className="hr-profile hr-instr">
      <div className="hr-instr__meta">
        {ins.reports_to && <span><b>Підпорядковується:</b> {ins.reports_to}</span>}
        {ins.leads && ins.leads !== "—" && <span><b>Керує:</b> {ins.leads}</span>}
        {ins.substitute && <span><b>Заміщення:</b> {ins.substitute}</span>}
      </div>
      <h4 className="hr-phase">Обов’язки</h4>
      {groupDuties(ins.duties).map((g) => (
        <div className="hr-instr__area" key={g.area}>
          <b>{g.area}</b>
          <ul>{g.items.map((d, i) => <Duty key={i} d={d} />)}</ul>
        </div>
      ))}
      {(personal?.scope || personal?.duties?.length > 0) && (
        <div className="hr-instr__area hr-instr__area--mine">
          <b>Особисто{personal.scope ? `: ${personal.scope}` : ""}</b>
          {personal.duties?.length > 0 && <ul>{personal.duties.map((d, i) => <Duty key={i} d={d} />)}</ul>}
        </div>
      )}
      {ins.rights?.length > 0 && (<><h4 className="hr-phase">Права</h4><ul>{ins.rights.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
      {ins.responsibility?.length > 0 && (<><h4 className="hr-phase">Відповідальність</h4><ul>{ins.responsibility.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
      {ins.interactions?.length > 0 && (<><h4 className="hr-phase">Взаємодія</h4><ul>{ins.interactions.map((x, i) => <li key={i}><b>{x.who}:</b> {x.what}</li>)}</ul></>)}
      {ins.rev_at && <p className="note">Редакція від {fmtDate(ins.rev_at)}. Інструкція дописується, коли змінюється робота.</p>}
    </div>
  );
}

// Одна людина на посаді: особиста зона й обов'язки понад інструкцію посади
function PersonBlock({ member, role, row, supabase, onSaved, onAsked }) {
  const [scope, setScope] = useState(row?.scope || "");
  const [duties, setDuties] = useState(row?.duties || []);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy("save"); setMsg("");
    const clean = duties.filter((d) => String(d.text || "").trim()).map((d) => ({ ...d, text: d.text.trim(), area: d.area || "Особисте", rhythm: d.rhythm || "постійно", added: d.added || todayISO() }));
    const { error } = await supabase.from("hr_member_instr").upsert({ member_id: member.id, scope: scope.trim() || null, duties: clean, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
    setBusy("");
    if (error) { setMsg(error.message); return; }
    setDuties(clean); setMsg("Збережено."); onSaved();
  }
  async function ask() {
    setBusy("ai"); setMsg("");
    const { data, error } = await supabase.functions.invoke("hr-ai", { body: { action: "instr", member: member.id } });
    setBusy("");
    if (error || !data?.ok) { setMsg(data?.error || "ШІ зараз недоступний. Спробуйте пізніше."); return; }
    setMsg(data.n ? `ШІ пропонує дописати: ${data.n}. Пропозиції — вище.` : `Дописувати нічого${data.skipped ? `: ${data.skipped}` : " — інструкція відповідає роботі"}.`);
    onAsked();
  }

  return (
    <details className="hr-q">
      <summary>{member.name}{row?.scope ? ` — ${row.scope}` : ""}{row?.duties?.length ? ` · особистих обов’язків: ${row.duties.length}` : ""}</summary>
      <div>
        <Field label="Особиста зона: об’єкт, майданчик, регіон"><input type="text" value={scope} onChange={(e) => setScope(e.target.value)} /></Field>
        <ListEditor items={duties} onChange={setDuties} addLabel="+ Особистий обов’язок" blank={{ area: "Особисте", text: "", rhythm: "постійно" }}
          fields={[{ key: "text", label: "Обов’язок", type: "area" }, { key: "rhythm", label: "Як часто", type: "select", width: 130, options: RHYTHM_OPTS }]} />
        <div className="toolbar" style={{ gap: 8, marginTop: 8 }}>
          <button type="button" className="btn small" disabled={!!busy} onClick={save}>{busy === "save" ? "Зберігаємо…" : "Зберегти особисте"}</button>
          <button type="button" className="btn small" disabled={!!busy} onClick={ask} title="ШІ перегляне задачі людини за останній місяць і запропонує, що дописати">{busy === "ai" ? "ШІ дивиться задачі…" : "🤖 Що дописати?"}</button>
          <Copy text={instructionText(role, { scope, duties })} label="Скопіювати інструкцію людини" />
        </div>
        {msg && <div className="note" style={{ color: "var(--accent)" }}>{msg}</div>}
        {row?.reviewed_period && <div className="note">ШІ переглядав роботу за {row.reviewed_period}.</div>}
      </div>
    </details>
  );
}

// Розділ «Посадова інструкція» в редакторі профілю посади
export function InstructionEditor({ draft, set, supabase, proposals, members, personal, reload }) {
  const ins = draft.instruction || {};
  const upd = (p) => set({ instruction: { ...ins, ...p } });
  const [edits, setEdits] = useState({});
  const [msg, setMsg] = useState("");
  const nameOf = (id) => members.find((m) => m.id === id)?.name || "";

  async function decide(u, ok, scope) {
    setMsg("");
    const text = (edits[u.id] ?? u.text).trim();
    const { data, error } = await supabase.rpc("hr_instr_decide", { p_id: u.id, p_ok: ok, p_scope: scope || null, p_text: ok ? text : null });
    if (error || !data?.ok) { setMsg(data?.error || error?.message || "Не вдалося зберегти"); return; }
    // прийняте в посаду база вже дописала — повторюємо в чернетці, щоб «Зберегти профіль» його не стер
    if (ok && scope === "role") upd({ duties: [...(ins.duties || []), { area: u.area || "Інше", text, rhythm: u.rhythm, added: todayISO() }], rev_at: todayISO() });
    reload();
  }

  return (
    <>
      <p className="note" style={{ marginTop: 0 }}>Інструкцію бачить кожен на цій посаді в «Мій розвиток». Раз на місяць ШІ переглядає задачі людей і нові правила з бази знань та пропонує, що дописати, — рішення за вами.</p>
      {msg && <div className="auth-error">{msg}</div>}

      {proposals.length > 0 && (
        <>
          <h4 className="hr-phase">Пропозиції ШІ: що дописати ({proposals.length})</h4>
          {proposals.map((u) => (
            <div className="hr-evalcomp hr-prop" key={u.id}>
              <div className="hr-chips" style={{ marginTop: 0 }}>
                <span className="tag">{u.area || "Загальне"}</span>{u.rhythm && <span className="tag">{u.rhythm}</span>}
                {u.member_id && <span className="note" style={{ margin: 0 }}>з роботи: {nameOf(u.member_id) || "—"}{u.period ? ` · ${u.period}` : ""}</span>}
              </div>
              <textarea rows={2} value={edits[u.id] ?? u.text} onChange={(e) => setEdits((x) => ({ ...x, [u.id]: e.target.value }))} aria-label="Текст обов’язку" />
              {u.reason && <div className="note" style={{ marginTop: 2 }}>Чому: {u.reason}</div>}
              <div className="toolbar" style={{ gap: 8, marginTop: 6 }}>
                <button type="button" className="btn small primary" onClick={() => decide(u, true, "role")}>Дописати в посаду</button>
                {u.member_id && <button type="button" className="btn small" onClick={() => decide(u, true, "person")}>Лише {nameOf(u.member_id) || "цій людині"}</button>}
                <button type="button" className="btn small" onClick={() => decide(u, false)}>Відхилити</button>
                {u.scope === "person" && <span className="note" style={{ margin: 0 }}>ШІ вважає це особистим</span>}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="hr-grid2">
        <Field label="Кому підпорядковується"><textarea rows={2} value={ins.reports_to || ""} onChange={(e) => upd({ reports_to: e.target.value })} /></Field>
        <Field label="Ким керує"><textarea rows={2} value={ins.leads || ""} onChange={(e) => upd({ leads: e.target.value })} /></Field>
      </div>
      <Field label="Хто заміщає на час відсутності"><textarea rows={2} value={ins.substitute || ""} onChange={(e) => upd({ substitute: e.target.value })} /></Field>

      <h4 className="hr-phase">Обов’язки</h4>
      <ListEditor items={ins.duties} onChange={(v) => upd({ duties: v })} addLabel="+ Обов’язок" blank={{ area: "", text: "", rhythm: "постійно", added: todayISO() }}
        fields={[{ key: "area", label: "Напрям", width: 190 }, { key: "text", label: "Що робить (одне речення, з результатом)", type: "area" }, { key: "rhythm", label: "Як часто", type: "select", width: 130, options: RHYTHM_OPTS }]} />
      <h4 className="hr-phase">Права</h4>
      <StringsEditor items={ins.rights} onChange={(v) => upd({ rights: v })} addLabel="+ Право" />
      <h4 className="hr-phase">Відповідальність</h4>
      <StringsEditor items={ins.responsibility} onChange={(v) => upd({ responsibility: v })} addLabel="+ За що відповідає" />
      <h4 className="hr-phase">Взаємодія</h4>
      <ListEditor items={ins.interactions} onChange={(v) => upd({ interactions: v })} addLabel="+ З ким" blank={{ who: "", what: "" }}
        fields={[{ key: "who", label: "З ким", width: 220 }, { key: "what", label: "Що отримує й що передає", type: "area" }]} />
      <div className="toolbar" style={{ marginTop: 10 }}><Copy text={instructionText(draft)} label="Скопіювати інструкцію текстом" /></div>

      <h4 className="hr-phase">Люди на цій посаді ({members.length})</h4>
      {members.length === 0 && <p className="note">Нікого не призначено — посада вакантна. Призначити людину можна в розділі «Якість роботи».</p>}
      {members.map((m) => (
        <PersonBlock key={m.id} member={m} role={draft} row={personal.find((p) => p.member_id === m.id)} supabase={supabase} onSaved={reload} onAsked={reload} />
      ))}
      <details className="hr-q" open><summary>Як це побачить працівник</summary><Instruction role={draft} /></details>
    </>
  );
}
