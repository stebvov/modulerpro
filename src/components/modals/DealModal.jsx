"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCrmData } from "@/context/CrmDataContext";
import SearchCombobox from "@/components/SearchCombobox";
import LeadSourcePanel from "@/components/LeadSourcePanel";
import DealCart, { cartTotalUah, linesForSave, linesFromDeal } from "@/components/crm/DealCart";
import { useAppData } from "@/context/DataContext";
import { fmtCurrency } from "@/lib/format";
import {
  CONTACT_TYPES,
  ACTIVITY_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  serviceTemplateUnitPrice,
  computeProductionCostSnapshot,
  fmtDateTime,
} from "@/lib/crm";

function emptyContact(type, value) {
  return { key: Math.random().toString(36).slice(2), type: type || "телефон", value: value || "" };
}

function ActivityLog({ dealId, activities, nextActionAt, nextActionNote, onEnsureSaved, onReload }) {
  const { supabase } = useCrmData();
  const { profile, user } = useAuth();
  const [type, setType] = useState("дзвінок");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [naDate, setNaDate] = useState(nextActionAt ? nextActionAt.slice(0, 16) : "");
  const [naNote, setNaNote] = useState(nextActionNote || "");

  const author = profile?.full_name || user?.email || null;
  const sorted = [...activities].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  async function submitActivity() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      const id = dealId || (await onEnsureSaved());
      if (!id) return;
      let attachment_name = null;
      let attachment_path = null;
      if (file) {
        const path = `${id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("deal-files").upload(path, file);
        if (!upErr) {
          attachment_name = file.name;
          attachment_path = path;
        }
      }
      await supabase.from("deal_activities").insert([
        { deal_id: id, type, note: note.trim(), attachment_name, attachment_path, created_by: author },
      ]);
      setNote("");
      setFile(null);
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  async function saveNextAction() {
    setBusy(true);
    try {
      const id = dealId || (await onEnsureSaved());
      if (!id) return;
      await supabase
        .from("deals")
        .update({ next_action_at: naDate ? new Date(naDate).toISOString() : null, next_action_note: naNote })
        .eq("id", id);
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="deal-log">
      {!dealId && (
        <p className="note" style={{ marginTop: 0 }}>
          Лід ще не збережений — перший запис чи нагадування збереже його автоматично.
        </p>
      )}
      <div className="deal-composer">
        <textarea rows={2} placeholder="Коментар: про що говорили, результат…  (Ctrl+Enter — додати)" value={note} onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitActivity(); }} />
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ width: "auto" }} value={type} onChange={(e) => setType(e.target.value)} aria-label="Тип запису">
            {ACTIVITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.icon} {t.key}</option>)}
          </select>
          <label className="btn small" style={{ cursor: "pointer" }} title="Прикріпити файл">📎{file ? " " + file.name.slice(0, 18) : ""}
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
          </label>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn primary small" disabled={busy || !note.trim()} onClick={submitActivity}>Додати</button>
        </div>
      </div>
      <div className="deal-remind">
        <span aria-hidden="true">🔔</span>
        <input type="datetime-local" value={naDate} onChange={(e) => setNaDate(e.target.value)} aria-label="Дата наступного контакту" />
        <input placeholder="Наступний контакт: що зробити" value={naNote} onChange={(e) => setNaNote(e.target.value)} />
        <button type="button" className="btn small" disabled={busy} onClick={saveNextAction}>Зберегти</button>
      </div>
      <div className="deal-feed">
        {!sorted.length && <div className="note" style={{ textAlign: "center", padding: 16 }}>Записів ще немає.</div>}
        {sorted.map((a) => {
          const meta = ACTIVITY_TYPES.find((t) => t.key === a.type);
          return (
            <div key={a.id} className="deal-feed-item">
              <div className="note">{meta?.icon} <b style={{ color: "var(--text)" }}>{a.type}</b> · {fmtDateTime(a.created_at)}{a.created_by ? ` · ${a.created_by}` : ""}</div>
              <div style={{ fontSize: 13.5, marginTop: 2, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{a.note}</div>
              {a.attachment_name && <div className="note" style={{ marginTop: 2 }}>📎 {a.attachment_name}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ✅ Задачі по ліду: задачі пульту з привʼязкою до угоди (у т.ч. автоматичні з CRM)
function DealTasks({ dealId, onEnsureSaved }) {
  const { supabase } = useCrmData();
  const [tasks, setTasks] = useState(null);
  const [members, setMembers] = useState([]);
  const [meId, setMeId] = useState(null);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let on = true;
    (async () => {
      const [m, me] = await Promise.all([
        supabase.from("task_members").select("id,name,active,is_ai").eq("active", true).order("sort"),
        supabase.rpc("pult_me"),
      ]);
      if (!on) return;
      setMembers((m.data || []).filter((x) => !x.is_ai));
      setMeId(me.data || null);
      if (!dealId) { setTasks([]); return; }
      const { data, error } = await supabase.from("tasks").select("id,num,title,status,due,owner_id").eq("deal_id", dealId).order("status").order("due");
      if (on) { setTasks(data || []); if (error) setErr(error.message); }
    })();
    return () => { on = false; };
  }, [supabase, dealId]);

  const nameOf = (id) => members.find((m) => m.id === id)?.name || "—";
  async function add() {
    if (!title.trim()) return;
    const id = dealId || (await onEnsureSaved());
    if (!id) return;
    const { data, error } = await supabase.from("tasks").insert({
      title: title.trim(), project: "Потік угод: договір → виробництво → монтаж", owner_id: owner || meId, controller_id: meId,
      due: due || null, deal_id: id, created_by: meId, source: "crm",
    }).select("id,num,title,status,due,owner_id").single();
    if (error) { setErr(error.message); return; }
    setTasks((t) => [...(t || []), data]); setTitle(""); setDue(""); setErr("");
  }
  async function toggle(t) {
    const status = t.status === "done" ? "todo" : "done";
    setTasks((l) => l.map((x) => (x.id === t.id ? { ...x, status } : x)));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", t.id);
    if (error) setErr(error.message);
  }

  if (!meId && tasks !== null) return <p className="note">Задачі по ліду бачать і створюють учасники команди (розділ «Команда»).</p>;
  return (
    <div className="deal-tasks">
      <div className="deal-composer">
        <input placeholder="Нова задача по ліду: що зробити (Enter — додати)" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} style={{ flex: "1 1 140px" }} aria-label="Виконавець">
            <option value="">я виконую</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ width: 150 }} aria-label="Термін" />
          <button type="button" className="btn primary small" onClick={add} disabled={!title.trim()}>+ Задача</button>
        </div>
      </div>
      {err && <div className="auth-error">{err}</div>}
      {tasks === null ? <div className="note">Завантаження…</div> : !tasks.length ? (
        <div className="note" style={{ textAlign: "center", padding: 16 }}>Задач по ліду ще немає. Автоматичні задачі з&apos;являться тут, коли угода перейде на «Договір», «Готово», «Здано».</div>
      ) : tasks.map((t) => (
        <div key={t.id} className={`deal-task${t.status === "done" ? " done" : ""}`}>
          <input type="checkbox" checked={t.status === "done"} onChange={() => toggle(t)} aria-label="Виконано" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={`/?s=pult-tasks#t/${t.num}`} className="deal-task-title">#{t.num} {t.title}</a>
            <div className="note">{nameOf(t.owner_id)}{t.due ? ` · до ${new Date(t.due + "T12:00:00Z").toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })}` : ""}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DealModal({ open, dealId, pipeline, onClose, onSaved }) {
  const {
    supabase, leads, leadContacts, deals, dealActivities, teamMembers,
    templates, serviceTemplates, services, serviceTemplateItems, bomItems, extraCosts, supplierPrices, marginAlerts, reload,
  } = useCrmData();
  const app = useAppData();
  const { currency, exchangeRates, showDecimals } = app;
  const money = (uah) => fmtCurrency(uah, currency, exchangeRates, showDecimals);
  const { canWriteCrm, canWriteCatalog: canDelete, profile } = useAuth();
  const canWriteCatalog = canWriteCrm;

  const [savedId, setSavedId] = useState(dealId || null);
  const [lines, setLines] = useState([]);
  const [tab, setTab] = useState("коментарі");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currentDealRow = savedId ? deals.find((d) => d.id === savedId) : null;
  const currentLead = currentDealRow ? leads.find((l) => l.id === currentDealRow.lead_id) : null;
  const marginAlert = savedId ? marginAlerts.find((m) => m.deal_id === savedId) : null;

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab("коментарі");
    setError("");
    setSavedId(dealId || null);
    const dealRow = dealId ? deals.find((d) => d.id === dealId) : null;
    const existingLead = dealRow ? leads.find((l) => l.id === dealRow.lead_id) : null;
    if (dealId && dealRow && existingLead) {
      const existingContacts = leadContacts.filter((c) => c.lead_id === existingLead.id);
      const hasPhoneContact = existingContacts.some((c) => c.type === "телефон");
      const contactsSeed = existingContacts.map((c) => emptyContact(c.type, c.value));
      if (!hasPhoneContact && existingLead.phone) contactsSeed.unshift(emptyContact("телефон", existingLead.phone));
      if (!contactsSeed.length) contactsSeed.push(emptyContact("телефон"));
      setLines(linesFromDeal(dealRow, {
        templates: app.templates?.length ? app.templates : templates, services: app.services || services, rates: exchangeRates, currency,
        serviceTemplateUnitPrice: (id) => serviceTemplateUnitPrice(id, serviceTemplateItems, services, serviceTemplates),
      }));
      setForm({
        lead_name: existingLead.name || "",
        lead_region: existingLead.region || "",
        lead_source: existingLead.source || "сайт",
        lead_status: existingLead.status || "новий",
        lead_budget_range: existingLead.budget_range || "",
        budget_amount: existingLead.budget_amount != null ? String(existingLead.budget_amount) : "",
        budget_currency: existingLead.budget_currency || currency || "UAH",
        lead_notes: existingLead.notes || "",
        contacts: contactsSeed,
        custom_notes: dealRow.custom_notes || "",
        owner_id: dealRow.owner_id || "",
        is_custom: !!dealRow.is_custom,
      });
    } else {
      const defaultOwner = teamMembers.find((m) => m.name === profile?.full_name);
      setForm({
        lead_name: "", lead_region: "",
        lead_source: "сайт", lead_status: "новий", lead_budget_range: "", lead_notes: "",
        budget_amount: "", budget_currency: currency || "UAH",
        contacts: [emptyContact("телефон")],
        custom_notes: "",
        owner_id: defaultOwner?.id || "", is_custom: false,
      });
      setLines([]);
      // Keep "Відповідальний" defaulted to the creator even if no matching
      // team_members row exists yet — create one instead of leaving it blank.
      if (!defaultOwner && profile?.full_name) {
        supabase
          .from("team_members")
          .select("id")
          .eq("name", profile.full_name)
          .maybeSingle()
          .then(({ data: existing }) => {
            if (existing) {
              setForm((f) => (f ? { ...f, owner_id: f.owner_id || existing.id } : f));
              return;
            }
            supabase
              .from("team_members")
              .insert([{ name: profile.full_name }])
              .select()
              .single()
              .then(({ data }) => {
                if (data) {
                  setForm((f) => (f ? { ...f, owner_id: f.owner_id || data.id } : f));
                  reload(true);
                }
              });
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealId]);

  if (!open || !form) return null;

  const ownerOptions = teamMembers.map((m) => ({ id: m.id, label: m.name }));

  function update(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }
  function updateContact(key, patch) {
    setForm((f) => ({ ...f, contacts: f.contacts.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
  }
  function removeContact(key) {
    setForm((f) => ({ ...f, contacts: f.contacts.filter((c) => c.key !== key) }));
  }
  async function createTeamMember(text) {
    const { data, error: e } = await supabase.from("team_members").insert([{ name: text }]).select().single();
    if (e) { setError(e.message); return null; }
    await reload(true);
    return data.id;
  }

  const previewProductionTotal = cartTotalUah(lines);
  const CUR_SYM = { UAH: "грн", USD: "$", EUR: "€" };

  async function saveDeal() {
    if (!form.lead_name.trim()) { setError("Заповни ім'я/назву клієнта."); return null; }
    setSaving(true);
    setError("");
    try {
      const phoneContact = form.contacts.find((c) => c.type === "телефон" && c.value.trim());
      const leadPayload = {
        name: form.lead_name.trim(),
        phone: phoneContact ? phoneContact.value.trim() : null,
        region: form.lead_region.trim() || null,
        source: form.lead_source,
        status: form.lead_status,
        budget_amount: form.budget_amount === "" ? null : Number(String(form.budget_amount).replace(/\s/g, "").replace(",", ".")) || null,
        budget_currency: form.budget_currency || "UAH",
        budget_range: form.budget_amount !== "" && Number(String(form.budget_amount).replace(/\s/g, "").replace(",", "."))
          ? `${Number(String(form.budget_amount).replace(/\s/g, "").replace(",", ".")).toLocaleString("uk-UA")} ${CUR_SYM[form.budget_currency] || form.budget_currency}`
          : form.lead_budget_range.trim() || null,
        notes: form.lead_notes.trim() || null,
      };
      let leadId = currentLead?.id;
      if (leadId) {
        const { error: e } = await supabase.from("leads").update(leadPayload).eq("id", leadId);
        if (e) throw e;
      } else {
        const { data: created, error: e } = await supabase.from("leads").insert([leadPayload]).select().single();
        if (e) throw e;
        leadId = created.id;
      }

      await supabase.from("lead_contacts").delete().eq("lead_id", leadId);
      const cleanContacts = form.contacts.filter((c) => c.value.trim()).map((c) => ({ lead_id: leadId, type: c.type, value: c.value.trim(), is_primary: false }));
      if (cleanContacts.length) {
        const { error: e } = await supabase.from("lead_contacts").insert(cleanContacts);
        if (e) throw e;
      }

      const is_custom = !!form.is_custom;
      const itemsForType = linesForSave(lines);
      const itemsTotal = cartTotalUah(itemsForType);
      const production_price = itemsForType.length ? Math.round(itemsTotal) : null;
      const estimated_price = null;
      const production_cost_snapshot = computeProductionCostSnapshot(
        { is_custom, template_id: null, custom_area_m2: null, template_lines: itemsForType },
        { templates, bomItems, extraCosts, supplierPrices }
      );

      const dealPayload = {
        lead_id: leadId,
        pipeline_id: pipeline.id,
        template_id: null,
        template_lines: itemsForType,
        is_custom,
        custom_area_m2: null,
        custom_notes: form.custom_notes.trim() || null,
        quantity: 1,
        production_price,
        estimated_price,
        production_cost_snapshot,
        owner_id: form.owner_id || null,
      };

      let newSavedId = savedId;
      if (newSavedId) {
        const { error: e } = await supabase.from("deals").update(dealPayload).eq("id", newSavedId);
        if (e) throw e;
      } else {
        dealPayload.stage_id = pipeline.stages[0].id;
        const { data: created, error: e } = await supabase.from("deals").insert([dealPayload]).select().single();
        if (e) throw e;
        newSavedId = created.id;
      }

      setSavedId(newSavedId);
      await reload();
      return newSavedId;
    } catch (err) {
      setError(err.message || String(err));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const id = await saveDeal();
    if (id) onSaved?.(id);
  }

  async function ensureSaved() {
    if (savedId) return savedId;
    return await saveDeal();
  }

  async function handleDelete() {
    if (!savedId) return;
    if (!confirm(`Видалити ліда «${form.lead_name}»? Це видалить угоду, історію спілкування та послуги. Дію не можна скасувати.`)) return;
    setSaving(true);
    setError("");
    try {
      const { data: files } = await supabase.storage.from("deal-files").list(savedId);
      if (files?.length) {
        await supabase.storage.from("deal-files").remove(files.map((f) => `${savedId}/${f.name}`));
      }

      await supabase.from("deal_services").delete().eq("deal_id", savedId);
      await supabase.from("deal_activities").delete().eq("deal_id", savedId);
      await supabase.from("deal_attachments").delete().eq("deal_id", savedId);

      const { error: e } = await supabase.from("deals").delete().eq("id", savedId);
      if (e) throw e;

      const leadId = currentDealRow?.lead_id;
      if (leadId) {
        const otherDeals = deals.filter((d) => d.lead_id === leadId && d.id !== savedId);
        if (!otherDeals.length) {
          await supabase.from("lead_contacts").delete().eq("lead_id", leadId);
          await supabase.from("lead_category_links").delete().eq("lead_id", leadId);
          await supabase.from("leads").delete().eq("id", leadId);
        }
      }

      await reload();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  const activities = savedId ? dealActivities.filter((a) => a.deal_id === savedId) : [];
  const stageId = currentDealRow?.stage_id;
  async function moveTo(id) {
    if (!savedId || id === stageId) return;
    const { error: e } = await supabase.from("deals").update({ stage_id: id }).eq("id", savedId);
    if (e) { setError(e.message); return; }
    await reload();
  }

  const stageIdx = (pipeline.stages || []).findIndex((st) => st.id === stageId);
  return (
    <div className="modal-overlay open deal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal deal-card">
        <div className="deal-head">
          <input className="deal-title" value={form.lead_name} onChange={update("lead_name")} placeholder={`Новий лід — ${pipeline.name}: ім'я або назва клієнта`} aria-label="Ім'я / назва клієнта" />
          <div className="deal-sum" title="Сума замовлення (рахується з позицій)">{money(previewProductionTotal)}</div>
          <button type="button" className="btn small" onClick={onClose} aria-label="Закрити">✕</button>
        </div>
        {savedId && (pipeline.stages || []).length > 0 && (
          <div className="deal-stages" role="group" aria-label="Етап угоди">
            {pipeline.stages.map((st, i) => (
              <button key={st.id} type="button" className={`deal-stage${i < stageIdx ? " past" : ""}${st.id === stageId ? " on" : ""}`} onClick={() => moveTo(st.id)} title={`Перевести на «${st.label}»`}>
                {st.label}
              </button>
            ))}
          </div>
        )}
        {error && <div className="auth-error" style={{ margin: "0 18px" }}>{error}</div>}

        <div className="deal-body">
          <section className="deal-left">
            <div className="form-row">
              <label>Контакти</label>
              {form.contacts.map((c) => (
                <div className="contact-row" key={c.key}>
                  <select style={{ flex: "0 0 110px" }} value={c.type} onChange={(e) => updateContact(c.key, { type: e.target.value })}>
                    {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="value-input" value={c.value} onChange={(e) => updateContact(c.key, { value: e.target.value })} placeholder={c.type === "телефон" ? "+380 ..." : "значення"} />
                  <span className="icon-x" onClick={() => removeContact(c.key)}>×</span>
                </div>
              ))}
              <button type="button" className="btn small self-left" onClick={() => setForm((f) => ({ ...f, contacts: [...f.contacts, emptyContact()] }))}>+ Контакт</button>
            </div>

            <div className="form-row">
              <label>Опис ліда</label>
              <textarea rows={Math.min(10, Math.max(3, String(form.lead_notes || "").split("\n").length + 1))} value={form.lead_notes} onChange={update("lead_notes")} placeholder="Що хоче клієнт: для чого будинок, площа, ділянка, терміни… (сюди ж потрапляють відповіді квізу)" />
            </div>

            {currentLead?.site_meta && (
              <details className="lsrc-toggle">
                <summary>🌐 Звідки заявка{currentLead.site_meta.summary ? ` — ${currentLead.site_meta.summary}` : ""}</summary>
                <div><LeadSourcePanel meta={currentLead.site_meta} /></div>
              </details>
            )}

            <div className="form-row">
              <label>Бюджет (орієнтовно)</label>
              <div className="budget-row">
                <input inputMode="decimal" value={form.budget_amount} onChange={(e) => setForm((f) => ({ ...f, budget_amount: e.target.value.replace(/[^\d\s.,]/g, "") }))} placeholder={form.lead_budget_range && !form.budget_amount ? `було: ${form.lead_budget_range}` : "сума"} />
                <select value={form.budget_currency} onChange={update("budget_currency")} aria-label="Валюта бюджету">
                  {[["UAH", "грн"], ["USD", "$"], ["EUR", "€"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            </div>

            <DealCart lines={lines} setLines={setLines} readOnly={!canWriteCatalog} />

            <div className="deal-grid">
                <div className="form-row">
                  <label>Регіон</label>
                  <input value={form.lead_region} onChange={update("lead_region")} />
                </div>
                <div className="form-row">
                  <label>Джерело ліда</label>
                  <select value={form.lead_source} onChange={update("lead_source")}>
                    {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <label>Статус ліда</label>
                  <select value={form.lead_status} onChange={update("lead_status")}>
                    {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
            </div>

            <div className="form-row">
              <label>Відповідальний</label>
              <SearchCombobox value={form.owner_id} options={ownerOptions} placeholder="Ім'я відповідального..." onChange={(id) => setForm((f) => ({ ...f, owner_id: id }))} onCreate={createTeamMember} />
            </div>

            <div className="form-row">
              <label>Побажання й деталі для виробництва</label>
              <textarea rows={2} value={form.custom_notes} onChange={update("custom_notes")} placeholder="Колір, планування, особливості монтажу…" />
            </div>

            {savedId && marginAlert?.is_below_threshold && (
              <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                ⚠ Маржа {marginAlert.margin_pct}% — нижче порогу {marginAlert.threshold_pct}%
              </div>
            )}
          </section>
          <aside className="deal-right">
            <div className="seg-row" style={{ marginBottom: 10 }}>
              <button type="button" className={`seg-btn${tab === "коментарі" ? " active" : ""}`} onClick={() => setTab("коментарі")}>💬 Коментарі й історія{activities.length > 0 ? ` (${activities.length})` : ""}</button>
              <button type="button" className={`seg-btn${tab === "задачі" ? " active" : ""}`} onClick={() => setTab("задачі")}>✅ Задачі по ліду</button>
            </div>
            {tab === "задачі" ? (
              <DealTasks dealId={savedId} onEnsureSaved={ensureSaved} />
            ) : (
              <ActivityLog dealId={savedId} activities={activities} nextActionAt={currentDealRow?.next_action_at} nextActionNote={currentDealRow?.next_action_note} onEnsureSaved={ensureSaved} onReload={reload} />
            )}
          </aside>
        </div>

        <div className="modal-actions">
          {savedId && canDelete && (
            <button className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={handleDelete} disabled={saving}>
              Видалити ліда
            </button>
          )}
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          <button className="btn primary" onClick={handleSave} disabled={saving || !canWriteCatalog}>
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </div>
    </div>
  );
}
