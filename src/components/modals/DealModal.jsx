"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCrmData } from "@/context/CrmDataContext";
import SearchCombobox from "@/components/SearchCombobox";
import {
  CONTACT_TYPES,
  ACTIVITY_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  serviceTemplateUnitPrice,
  orderItemsProductionTotal,
  computeProductionCostSnapshot,
  curr,
  fmtDateTime,
} from "@/lib/crm";

function emptyContact(type, value) {
  return { key: Math.random().toString(36).slice(2), type: type || "телефон", value: value || "" };
}

function emptyOrderItem(overrides) {
  return {
    key: Math.random().toString(36).slice(2),
    selection: overrides?.selection || "custom",
    label: overrides?.label || "",
    unit_price: overrides?.unit_price ?? "",
    quantity: overrides?.quantity ?? 1,
  };
}

// Parses an order-item row's <select> value into a {kind, template_id}
// pair. "custom" is a sentinel for a free-text line; "house:<id>" /
// "service:<id>" encode a catalog template reference in one field so a
// single combined dropdown can offer both kinds plus the custom option.
function parseSelection(selection) {
  if (selection === "custom") return { kind: "custom", template_id: null };
  if (selection.includes(":")) {
    const [kind, id] = selection.split(":");
    return { kind, template_id: id };
  }
  return { kind: "", template_id: null };
}

function resolveOrderItems(rows) {
  return rows
    .map((row) => {
      const { kind, template_id } = parseSelection(row.selection);
      if (kind === "custom") {
        return { kind, template_id: null, label: row.label.trim(), unit_price: Number(row.unit_price) || 0, quantity: Number(row.quantity) || 0 };
      }
      if (kind === "house" || kind === "service") {
        return { kind, template_id, quantity: Number(row.quantity) || 0 };
      }
      return null;
    })
    .filter((r) => r && r.quantity > 0 && (r.kind === "custom" ? r.label : r.template_id));
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
    supabase, leads, leadContacts, leadCategoryLinks, deals, dealActivities, teamMembers, productCategories,
    templates, serviceTemplates, services, serviceTemplateItems, bomItems, extraCosts, supplierPrices, marginAlerts, reload,
  } = useCrmData();
  const { canWriteCatalog, profile } = useAuth();

  const [savedId, setSavedId] = useState(dealId || null);
  const [pkgs, setPkgs] = useState({ list: [], items: [] });
  useEffect(() => {
    if (!open) return;
    Promise.all([supabase.from("packages").select("id,name,kind").eq("status", "active").order("sort"), supabase.from("package_items").select("*").order("sort")])
      .then(([p, i]) => setPkgs({ list: p.data || [], items: i.data || [] }));
  }, [open, supabase]);
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
      const categoryIds = leadCategoryLinks.filter((l) => l.lead_id === existingLead.id).map((l) => l.category_id);
      const orderItems = (dealRow.template_lines || []).map((item) =>
        emptyOrderItem({
          selection: item.kind === "custom" ? "custom" : `${item.kind || "house"}:${item.template_id}`,
          label: item.label || "",
          unit_price: item.unit_price ?? "",
          quantity: item.quantity,
        })
      );
      setForm({
        lead_name: existingLead.name || "",
        lead_region: existingLead.region || "",
        lead_source: existingLead.source || "сайт",
        lead_status: existingLead.status || "новий",
        lead_budget_range: existingLead.budget_range || "",
        lead_notes: existingLead.notes || "",
        category_ids: categoryIds,
        contacts: contactsSeed,
        request_type: dealRow.is_custom ? "custom" : orderItems.length ? "template" : "individual",
        order_items: orderItems,
        custom_notes: dealRow.custom_notes || "",
        owner_id: dealRow.owner_id || "",
        manual_price: !orderItems.length && !dealRow.is_custom ? (dealRow.estimated_price ?? "") : "",
      });
    } else {
      const defaultOwner = teamMembers.find((m) => m.name === profile?.full_name);
      setForm({
        lead_name: "", lead_region: "",
        lead_source: "сайт", lead_status: "новий", lead_budget_range: "", lead_notes: "",
        category_ids: [],
        contacts: [emptyContact("телефон")],
        request_type: pipeline.default_request_type || (pipeline.slug === "houses" ? "template" : "individual"),
        order_items: [], custom_notes: "",
        owner_id: defaultOwner?.id || "", manual_price: "",
      });
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
  const showOrderItems = form.request_type === "template" || form.request_type === "custom";

  function update(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }
  function updateContact(key, patch) {
    setForm((f) => ({ ...f, contacts: f.contacts.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
  }
  function removeContact(key) {
    setForm((f) => ({ ...f, contacts: f.contacts.filter((c) => c.key !== key) }));
  }
  function toggleCategory(id) {
    setForm((f) => ({
      ...f,
      category_ids: f.category_ids.includes(id) ? f.category_ids.filter((c) => c !== id) : [...f.category_ids, id],
    }));
  }

  function addOrderItem() {
    setForm((f) => ({ ...f, order_items: [...f.order_items, emptyOrderItem()] }));
  }
  function updateOrderItem(idx, patch) {
    setForm((f) => { const rows = [...f.order_items]; rows[idx] = { ...rows[idx], ...patch }; return { ...f, order_items: rows }; });
  }
  function removeOrderItem(idx) {
    setForm((f) => ({ ...f, order_items: f.order_items.filter((_, i) => i !== idx) }));
  }

  async function createTeamMember(text) {
    const { data, error: e } = await supabase.from("team_members").insert([{ name: text }]).select().single();
    if (e) { setError(e.message); return null; }
    await reload(true);
    return data.id;
  }

  const cleanOrderItems = resolveOrderItems(form.order_items);
  const orderItemsTotal = orderItemsProductionTotal(cleanOrderItems, { templates, services, serviceTemplateItems, serviceTemplates });
  const previewProductionTotal = showOrderItems ? orderItemsTotal : Number(form.manual_price) || 0;

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
        budget_range: form.lead_budget_range.trim() || null,
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

      await supabase.from("lead_category_links").delete().eq("lead_id", leadId);
      if (form.category_ids.length) {
        const { error: e } = await supabase.from("lead_category_links").insert(form.category_ids.map((cid) => ({ lead_id: leadId, category_id: cid })));
        if (e) throw e;
      }

      const is_custom = form.request_type === "custom";
      const itemsForType = showOrderItems ? cleanOrderItems : [];
      const itemsTotal = orderItemsProductionTotal(itemsForType, { templates, services, serviceTemplateItems, serviceTemplates });
      const production_price = itemsForType.length ? Math.round(itemsTotal) : null;
      const estimated_price = form.request_type === "individual" ? Number(form.manual_price) || 0 : null;
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
          <div className="deal-sum" title={showOrderItems ? "Вартість замовлення (рахується автоматично)" : "Сума"}>{curr(previewProductionTotal)} грн</div>
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
              <label>Опис</label>
              <textarea rows={2} value={form.custom_notes} onChange={update("custom_notes")} placeholder="Побажання, деталі, особливості запиту…" />
            </div>
            <div className="form-row">
              <label>Бюджет (орієнтовно)</label>
              <input value={form.lead_budget_range} onChange={update("lead_budget_range")} placeholder="напр. 500 000 - 800 000 грн" />
            </div>

            <div className="deal-grid">
                <div className="form-row">
                  <label>Регіон</label>
                  <input value={form.lead_region} onChange={update("lead_region")} />
                </div>
                <div className="form-row">
                  <label>Категорії (можна декілька)</label>
                  <div className="tag-checks">
                    {productCategories.map((c) => (
                      <label className="tag-check" key={c.id}>
                        <input type="checkbox" checked={form.category_ids.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                        {c.name}
                      </label>
                    ))}
                  </div>
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
              <label>Тип запиту</label>
              <div className="seg-row">
                <button type="button" className={`seg-btn${form.request_type === "template" ? " active" : ""}`} onClick={() => setForm((f) => ({ ...f, request_type: "template" }))}>Шаблон</button>
                <button type="button" className={`seg-btn${form.request_type === "custom" ? " active" : ""}`} onClick={() => setForm((f) => ({ ...f, request_type: "custom" }))}>Кастомний</button>
                <button type="button" className={`seg-btn${form.request_type === "individual" ? " active" : ""}`} onClick={() => setForm((f) => ({ ...f, request_type: "individual" }))}>Індивідуальний</button>
              </div>
            </div>

            {form.request_type === "individual" && (
              <div className="form-row">
                <label>Сума, грн</label>
                <input type="number" value={form.manual_price} onChange={update("manual_price")} placeholder="орієнтовна сума" />
              </div>
            )}

            {showOrderItems && (
              <div className="form-row">
                <label>Позиції замовлення{form.request_type === "custom" ? " (послуги, додаткові матеріали)" : " (шаблони будинків, послуг, кастомні позиції)"}</label>
                {form.order_items.map((row, i) => {
                  const { kind } = parseSelection(row.selection);
                  return (
                    <div key={row.key} style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                      <select style={{ flex: "1 1 220px" }} value={row.selection} onChange={(e) => {
                        const v = e.target.value;
                        if (v.startsWith("package:")) {
                          // пакет розгортається у свої позиції (будинки, послуги, власні рядки)
                          const its = pkgs.items.filter((x) => x.package_id === v.slice(8));
                          const rows = its.map((x) => {
                            if (x.kind === "service") { const sv = services.find((y) => y.id === x.template_id); return emptyOrderItem({ selection: "custom", label: sv?.name || "Послуга", unit_price: sv?.base_price ?? "", quantity: x.quantity }); }
                            return emptyOrderItem({ selection: x.kind === "custom" ? "custom" : `${x.kind}:${x.template_id}`, label: x.label || "", unit_price: x.unit_price ?? "", quantity: x.quantity });
                          });
                          setForm((f) => ({ ...f, order_items: [...f.order_items.slice(0, i), ...rows, ...f.order_items.slice(i + 1)] }));
                          return;
                        }
                        if (v.startsWith("svc:")) {
                          // послуга з каталогу → позиція з назвою й базовою ціною (можна змінити)
                          const sv = services.find((y) => y.id === v.slice(4));
                          updateOrderItem(i, { selection: "custom", label: sv?.name || "", unit_price: sv?.base_price ?? "" });
                          return;
                        }
                        updateOrderItem(i, { selection: v });
                      }}>
                        <option value="custom">— кастомна позиція (матеріал/послуга) —</option>
                        {form.request_type === "template" && templates.length > 0 && (
                          <optgroup label="Будинки">
                            {templates.map((t) => (
                              <option key={t.id} value={`house:${t.id}`}>
                                {t.name} · {t.area_m2} м²{t.base_cost_per_m2 != null ? ` · ${curr(t.base_cost_per_m2)} грн/м²` : " · немає ціни"}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {pkgs.list.length > 0 && (
                          <optgroup label="📦 Пакети (розгорнуться в позиції)">
                            {pkgs.list.map((p) => <option key={p.id} value={`package:${p.id}`}>{p.name}</option>)}
                          </optgroup>
                        )}
                        {services.length > 0 && (
                          <optgroup label="🛠 Послуги (каталог)">
                            {services.map((sv) => <option key={sv.id} value={`svc:${sv.id}`}>{sv.name}{sv.base_price != null ? ` · ${curr(sv.base_price)} грн` : ""}</option>)}
                          </optgroup>
                        )}
                        {row.selection.startsWith("service:") && serviceTemplates.length > 0 && (
                          <optgroup label="Шаблон послуг (старий)">
                            {serviceTemplates.map((t) => (
                              <option key={t.id} value={`service:${t.id}`}>
                                {t.name} · {curr(serviceTemplateUnitPrice(t.id, serviceTemplateItems, services, serviceTemplates))} грн
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {kind === "custom" && (
                        <>
                          <input style={{ flex: "1 1 140px" }} value={row.label} onChange={(e) => updateOrderItem(i, { label: e.target.value })} placeholder="назва позиції" />
                          <input type="number" style={{ width: 90 }} value={row.unit_price} onChange={(e) => updateOrderItem(i, { unit_price: e.target.value })} placeholder="ціна" />
                        </>
                      )}
                      <input type="number" min="1" step="1" style={{ width: 70 }} value={row.quantity} onChange={(e) => updateOrderItem(i, { quantity: e.target.value })} title="Кількість" />
                      <span className="icon-x" onClick={() => removeOrderItem(i)}>×</span>
                    </div>
                  );
                })}
                <button type="button" className="btn small self-left" onClick={addOrderItem}>+ Додати позицію</button>
              </div>
            )}

            <div className="form-row">
              <label>Відповідальний</label>
              <SearchCombobox value={form.owner_id} options={ownerOptions} placeholder="Ім'я відповідального..." onChange={(id) => setForm((f) => ({ ...f, owner_id: id }))} onCreate={createTeamMember} />
            </div>

            <div className="form-row">
              <label>Нотатки по ліду</label>
              <textarea rows={2} value={form.lead_notes} onChange={update("lead_notes")} />
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
          {savedId && canWriteCatalog && (
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
