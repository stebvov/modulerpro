"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCrmData } from "@/context/CrmDataContext";
import SearchCombobox from "@/components/SearchCombobox";
import {
  CONTACT_TYPES,
  ACTIVITY_TYPES,
  SERVICE_TYPES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  AVERAGE_ESTIMATE,
  findRateCard,
  foundationVariants,
  avgCostPerM2,
  templateLinesProductionPrice,
  computeProductionCostSnapshot,
  curr,
  fmtDateTime,
} from "@/lib/crm";

function emptyContact(type, value) {
  return { key: Math.random().toString(36).slice(2), type: type || "телефон", value: value || "" };
}

function emptyTemplateLine(overrides) {
  return { key: Math.random().toString(36).slice(2), template_id: overrides?.template_id || "", quantity: overrides?.quantity ?? 1 };
}

function emptyService(overrides) {
  return {
    key: Math.random().toString(36).slice(2),
    service_type: overrides?.service_type || "монтаж",
    variant: overrides?.variant || null,
    calc_method: overrides?.calc_method || "вручну",
    quantity_units: overrides?.quantity_units ?? "",
    price: overrides?.price ?? 0,
    rate_card_id: overrides?.rate_card_id || null,
  };
}

function ServiceRow({ service, rateCards, defaultQuantity, onChange, onRemove }) {
  const rateCard = findRateCard(rateCards, service.service_type, service.variant);
  const variants = foundationVariants(rateCards);
  function set(patch) {
    onChange({ ...service, ...patch });
  }
  function setType(service_type) {
    const variant = service_type === "фундамент" ? variants[0] || null : null;
    const rc = findRateCard(rateCards, service_type, variant);
    const qty = rc ? defaultQuantity(service_type, variant) : "";
    set({
      service_type,
      variant,
      calc_method: rc ? "за_тарифом" : "вручну",
      quantity_units: qty,
      price: rc ? rc.rate * qty : AVERAGE_ESTIMATE[service_type] || 0,
      rate_card_id: rc ? rc.id : null,
    });
  }
  function setVariant(variant) {
    const rc = findRateCard(rateCards, service.service_type, variant);
    const qty = rc ? defaultQuantity(service.service_type, variant) : "";
    set({ variant, quantity_units: qty, price: rc ? rc.rate * qty : service.price, rate_card_id: rc ? rc.id : null });
  }
  function setMethod(calc_method) {
    if (calc_method === "за_тарифом" && rateCard) {
      const qty = service.quantity_units || defaultQuantity(service.service_type, service.variant);
      set({ calc_method, quantity_units: qty, price: rateCard.rate * qty, rate_card_id: rateCard.id });
    } else if (calc_method === "середнє") {
      set({ calc_method, quantity_units: "", price: AVERAGE_ESTIMATE[service.service_type] || 0, rate_card_id: null });
    } else {
      set({ calc_method: "вручну", quantity_units: "", rate_card_id: null });
    }
  }
  function setQty(e) {
    const qty = Number(e.target.value) || 0;
    set({ quantity_units: e.target.value, price: rateCard ? rateCard.rate * qty : service.price });
  }
  return (
    <div>
      <div className="service-row-grid">
        <div style={{ display: "flex", gap: 4 }}>
          <select value={service.service_type} onChange={(e) => setType(e.target.value)}>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
          {service.service_type === "фундамент" && (
            <select value={service.variant || ""} onChange={(e) => setVariant(e.target.value)}>
              {variants.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
        </div>
        <div className="seg-row">
          <button type="button" className={`seg-btn${service.calc_method === "за_тарифом" ? " active" : ""}`} disabled={!rateCard} onClick={() => setMethod("за_тарифом")} title="За тарифом">Тариф</button>
          <button type="button" className={`seg-btn${service.calc_method === "середнє" ? " active" : ""}`} onClick={() => setMethod("середнє")} title="Середня оцінка">≈</button>
          <button type="button" className={`seg-btn${service.calc_method === "вручну" ? " active" : ""}`} onClick={() => setMethod("вручну")} title="Вручну">Ручна</button>
        </div>
        {service.calc_method === "за_тарифом" && rateCard ? (
          <input type="number" step="0.1" value={service.quantity_units} onChange={setQty} title={`Кількість · тариф ${curr(rateCard.rate)} грн/од.`} />
        ) : (
          <div />
        )}
        {service.calc_method === "вручну" ? (
          <input type="number" value={service.price} onChange={(e) => set({ price: Number(e.target.value) || 0 })} title="Сума, грн" />
        ) : (
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>
            {service.calc_method === "середнє" && "≈ "}{curr(service.price)}
          </div>
        )}
        <span className="icon-x" onClick={onRemove}>×</span>
      </div>
      {service.calc_method === "за_тарифом" && rateCard && (
        <div className="note" style={{ marginTop: -2, marginBottom: 6 }}>тариф {curr(rateCard.rate)} грн/од.</div>
      )}
    </div>
  );
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
    <div>
      {!dealId && (
        <p className="note" style={{ marginTop: 0 }}>
          Лід ще не збережений — перший запис чи нагадування збереже його автоматично.
        </p>
      )}
      {sorted.length > 0 && (
        <div style={{ marginBottom: 10, maxHeight: 220, overflowY: "auto" }}>
          {sorted.map((a) => {
            const meta = ACTIVITY_TYPES.find((t) => t.key === a.type);
            return (
              <div key={a.id} style={{ borderLeft: "2px solid var(--border-strong)", paddingLeft: 10, marginBottom: 8 }}>
                <div className="note">{meta?.icon} <b style={{ color: "var(--text)" }}>{a.type}</b> · {fmtDateTime(a.created_at)}{a.created_by ? ` · ${a.created_by}` : ""}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{a.note}</div>
                {a.attachment_name && <div className="note" style={{ marginTop: 2 }}>📎 {a.attachment_name}</div>}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        <select style={{ flex: "1 1 120px" }} value={type} onChange={(e) => setType(e.target.value)}>
          {ACTIVITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.icon} {t.key}</option>)}
        </select>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize: 11, flex: "1 1 120px", minWidth: 0 }} />
      </div>
      <textarea style={{ minHeight: 50, resize: "vertical", marginBottom: 6, width: "100%", boxSizing: "border-box" }} placeholder="Про що говорили, результат…" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" className="btn small" disabled={busy} onClick={submitActivity} style={{ marginBottom: 14 }}>+ Додати запис</button>

      <div style={{ background: "var(--accent-bg)", borderRadius: 8, padding: 10 }}>
        <div className="note" style={{ marginBottom: 6, fontWeight: 600 }}>🔔 Наступний контакт</div>
        <input type="datetime-local" style={{ marginBottom: 6, width: "100%", boxSizing: "border-box" }} value={naDate} onChange={(e) => setNaDate(e.target.value)} />
        <input style={{ marginBottom: 6, width: "100%", boxSizing: "border-box" }} placeholder="Наприклад: передзвонити щодо КП" value={naNote} onChange={(e) => setNaNote(e.target.value)} />
        <button type="button" className="btn small" disabled={busy} onClick={saveNextAction}>Зберегти нагадування</button>
      </div>
    </div>
  );
}

export default function DealModal({ open, dealId, pipeline, onClose, onSaved }) {
  const { supabase, leads, leadContacts, leadCategoryLinks, deals, dealServices, dealActivities, teamMembers, productCategories, templates, serviceRateCards, bomItems, extraCosts, supplierPrices, marginAlerts, reload } = useCrmData();
  const { canWriteCatalog, profile } = useAuth();

  const [savedId, setSavedId] = useState(dealId || null);
  const [tab, setTab] = useState("основне");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // The deal/lead as they currently exist in context — re-derived from
  // savedId (not the dealId prop) so it stays correct after an implicit
  // save triggered from the History tab on a brand-new lead.
  const currentDealRow = savedId ? deals.find((d) => d.id === savedId) : null;
  const currentLead = currentDealRow ? leads.find((l) => l.id === currentDealRow.lead_id) : null;
  const marginAlert = savedId ? marginAlerts.find((m) => m.deal_id === savedId) : null;

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab("основне");
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
      const services = dealServices
        .filter((s) => s.deal_id === dealId)
        .map((s) => emptyService({ service_type: s.service_type, variant: s.variant, calc_method: s.calc_method, quantity_units: s.quantity_units ?? "", price: s.price, rate_card_id: s.rate_card_id }));
      const templateLines = dealRow.template_lines?.length
        ? dealRow.template_lines.map((l) => emptyTemplateLine(l))
        : dealRow.template_id
        ? [emptyTemplateLine({ template_id: dealRow.template_id, quantity: dealRow.quantity || 1 })]
        : [];
      setForm({
        lead_name: existingLead.name || "",
        lead_region: existingLead.region || "",
        lead_source: existingLead.source || "сайт",
        lead_status: existingLead.status || "новий",
        lead_budget_range: existingLead.budget_range || "",
        lead_notes: existingLead.notes || "",
        category_ids: categoryIds,
        contacts: contactsSeed,
        request_type: dealRow.is_custom ? "custom" : templateLines.length ? "template" : "individual",
        template_lines: templateLines,
        custom_area_m2: dealRow.custom_area_m2 ?? "",
        custom_notes: dealRow.custom_notes || "",
        quantity: dealRow.quantity || 1,
        owner_id: dealRow.owner_id || "",
        services: services.length ? services : [],
      });
    } else {
      const defaultOwner = teamMembers.find((m) => m.name === profile?.full_name);
      setForm({
        lead_name: "", lead_region: "",
        lead_source: "сайт", lead_status: "новий", lead_budget_range: "", lead_notes: "",
        category_ids: [],
        contacts: [emptyContact("телефон")],
        request_type: pipeline.slug === "houses" ? "template" : "individual",
        template_lines: [], custom_area_m2: "", custom_notes: "",
        quantity: 1, owner_id: defaultOwner?.id || "", services: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealId]);

  if (!open || !form) return null;

  const ownerOptions = teamMembers.map((m) => ({ id: m.id, label: m.name }));
  const showExtraOpen = !!(form.lead_region || form.category_ids.length || form.lead_source !== "сайт" || form.lead_status !== "новий");

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

  function addTemplateLine() {
    setForm((f) => ({ ...f, template_lines: [...f.template_lines, emptyTemplateLine()] }));
  }
  function updateTemplateLine(idx, patch) {
    setForm((f) => { const lines = [...f.template_lines]; lines[idx] = { ...lines[idx], ...patch }; return { ...f, template_lines: lines }; });
  }
  function removeTemplateLine(idx) {
    setForm((f) => ({ ...f, template_lines: f.template_lines.filter((_, i) => i !== idx) }));
  }

  function defaultQuantity(service_type) {
    if (service_type === "монтаж") return Number(form.quantity) || 1;
    if (service_type === "фундамент") {
      if (form.request_type === "custom") return Number(form.custom_area_m2) || 0;
      return form.template_lines.reduce((sum, l) => {
        const tpl = templates.find((t) => t.id === l.template_id);
        return sum + (tpl ? Number(tpl.area_m2) * (Number(l.quantity) || 0) : 0);
      }, 0);
    }
    return 1;
  }
  function addService() {
    const rc = findRateCard(serviceRateCards, "монтаж", null);
    const qty = defaultQuantity("монтаж");
    setForm((f) => ({ ...f, services: [...f.services, emptyService({ service_type: "монтаж", calc_method: rc ? "за_тарифом" : "вручну", quantity_units: qty, price: rc ? rc.rate * qty : AVERAGE_ESTIMATE["монтаж"], rate_card_id: rc?.id })] }));
  }
  function updateService(idx, next) {
    setForm((f) => { const s = [...f.services]; s[idx] = next; return { ...f, services: s }; });
  }
  function removeService(idx) {
    setForm((f) => ({ ...f, services: f.services.filter((_, i) => i !== idx) }));
  }

  async function createTeamMember(text) {
    const { data, error: e } = await supabase.from("team_members").insert([{ name: text }]).select().single();
    if (e) { setError(e.message); return null; }
    await reload(true);
    return data.id;
  }

  const previewProductionTotal =
    form.request_type === "template"
      ? templateLinesProductionPrice(form.template_lines, templates)
      : form.request_type === "custom"
      ? (Number(form.custom_area_m2) || 0) * avgCostPerM2(templates) * (Number(form.quantity) || 1)
      : 0;
  const previewServicesSum = form.services.reduce((s, x) => s + (Number(x.price) || 0), 0);
  const previewTotal = previewProductionTotal + previewServicesSum;

  async function saveDeal() {
    if (!form.lead_name.trim()) { setTab("основне"); setError("Заповни ім'я/назву клієнта."); return null; }
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
      const isTemplateType = form.request_type === "template";
      const cleanLines = isTemplateType
        ? form.template_lines.filter((l) => l.template_id && Number(l.quantity) > 0).map((l) => ({ template_id: l.template_id, quantity: Number(l.quantity) }))
        : [];
      const custom_area_m2 = is_custom ? (form.custom_area_m2 === "" ? null : Number(form.custom_area_m2)) : null;
      const production_price = cleanLines.length ? Math.round(templateLinesProductionPrice(cleanLines, templates)) : null;
      const estimated_price = is_custom ? Math.round((Number(form.custom_area_m2) || 0) * avgCostPerM2(templates)) : null;
      const production_cost_snapshot = computeProductionCostSnapshot(
        { is_custom, template_id: null, custom_area_m2, template_lines: cleanLines },
        { templates, bomItems, extraCosts, supplierPrices }
      );

      const dealPayload = {
        lead_id: leadId,
        pipeline_id: pipeline.id,
        template_id: null,
        template_lines: cleanLines,
        is_custom,
        custom_area_m2,
        custom_notes: form.custom_notes.trim() || null,
        quantity: is_custom ? (Number(form.quantity) || 1) : 1,
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

      await supabase.from("deal_services").delete().eq("deal_id", newSavedId);
      if (form.services.length) {
        const { error: e } = await supabase.from("deal_services").insert(
          form.services.map((s) => ({
            deal_id: newSavedId,
            service_type: s.service_type,
            variant: s.variant || null,
            calc_method: s.calc_method,
            quantity_units: s.quantity_units === "" ? null : Number(s.quantity_units),
            rate_used: s.rate_card_id ? Number((serviceRateCards.find((r) => r.id === s.rate_card_id) || {}).rate) || null : null,
            rate_card_id: s.rate_card_id || null,
            price: Number(s.price) || 0,
          }))
        );
        if (e) throw e;
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

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2>{savedId ? "Редагувати угоду" : `Новий лід — ${pipeline.name}`}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="seg-row" style={{ marginBottom: 16 }}>
          <button type="button" className={`seg-btn${tab === "основне" ? " active" : ""}`} onClick={() => setTab("основне")}>Основне</button>
          <button type="button" className={`seg-btn${tab === "історія" ? " active" : ""}`} onClick={() => setTab("історія")}>
            Історія {activities.length > 0 ? `(${activities.length})` : ""}
          </button>
        </div>

        {tab === "історія" ? (
          <ActivityLog
            dealId={savedId}
            activities={activities}
            nextActionAt={currentDealRow?.next_action_at}
            nextActionNote={currentDealRow?.next_action_note}
            onEnsureSaved={ensureSaved}
            onReload={reload}
          />
        ) : (
          <>
            <div className="form-row">
              <label>Ім&apos;я / назва клієнта *</label>
              <input value={form.lead_name} onChange={update("lead_name")} />
            </div>
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

            <details className="section-details" open={showExtraOpen}>
              <summary>Додаткові поля</summary>
              <div className="section-body">
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
            </details>

            <div className="form-row">
              <label>Тип запиту</label>
              <div className="seg-row">
                <button type="button" className={`seg-btn${form.request_type === "template" ? " active" : ""}`} onClick={() => setForm((f) => ({ ...f, request_type: "template" }))}>Шаблон</button>
                <button type="button" className={`seg-btn${form.request_type === "custom" ? " active" : ""}`} onClick={() => setForm((f) => ({ ...f, request_type: "custom" }))}>Кастомний</button>
                <button type="button" className={`seg-btn${form.request_type === "individual" ? " active" : ""}`} onClick={() => setForm((f) => ({ ...f, request_type: "individual" }))}>Індивідуальний</button>
              </div>
            </div>

            {form.request_type === "template" && (
              <div className="form-row">
                <label>Шаблони</label>
                {form.template_lines.map((line, i) => (
                  <div key={line.key} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <select style={{ flex: 1 }} value={line.template_id} onChange={(e) => updateTemplateLine(i, { template_id: e.target.value })}>
                      <option value="">— не вибрано —</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} · {t.area_m2} м²{t.base_cost_per_m2 != null ? ` · ${curr(t.base_cost_per_m2)} грн/м²` : " · немає ціни"}
                        </option>
                      ))}
                    </select>
                    <input type="number" min="1" style={{ width: 70 }} value={line.quantity} onChange={(e) => updateTemplateLine(i, { quantity: e.target.value })} title="Кількість" />
                    <span className="icon-x" onClick={() => removeTemplateLine(i)}>×</span>
                  </div>
                ))}
                <button type="button" className="btn small self-left" onClick={addTemplateLine}>+ Додати шаблон</button>
              </div>
            )}
            {form.request_type === "custom" && (
              <>
                <div className="form-row">
                  <label>Бажана площа, м²</label>
                  <input type="number" step="0.1" value={form.custom_area_m2} onChange={update("custom_area_m2")} />
                </div>
                <div className="form-row">
                  <label>Кількість, шт</label>
                  <input type="number" min="1" value={form.quantity} onChange={update("quantity")} />
                </div>
              </>
            )}

            <details className="section-details" open={form.services.length > 0}>
              <summary>
                Замовлення клієнта (послуги)
                <span className="section-count"> — {form.services.length} поз., {curr(previewServicesSum)} грн</span>
              </summary>
              <div className="section-body">
                {form.services.map((s, i) => (
                  <ServiceRow key={s.key} service={s} rateCards={serviceRateCards} defaultQuantity={defaultQuantity} onChange={(next) => updateService(i, next)} onRemove={() => removeService(i)} />
                ))}
                <button type="button" className="btn small self-left" onClick={addService}>+ Додати послугу</button>
              </div>
            </details>

            <div className="form-row">
              <label>Відповідальний</label>
              <SearchCombobox value={form.owner_id} options={ownerOptions} placeholder="Ім'я відповідального..." onChange={(id) => setForm((f) => ({ ...f, owner_id: id }))} onCreate={createTeamMember} />
            </div>

            <div className="form-row">
              <label>Нотатки по ліду</label>
              <textarea rows={2} value={form.lead_notes} onChange={update("lead_notes")} />
            </div>

            <div style={{ background: "var(--accent-bg)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
              {form.request_type !== "individual" && (
                <>
                  <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {form.request_type === "custom" ? "Орієнтовна ціна виробництва" : "Ціна виробництва (автоматично)"}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--accent)" }}>
                    {form.request_type === "custom" ? "≈ " : ""}{curr(previewProductionTotal)} грн
                  </div>
                </>
              )}
              {previewServicesSum > 0 && <div style={{ fontSize: 12, color: "#C1652F", marginTop: 4 }}>Послуги разом: {curr(previewServicesSum)} грн</div>}
              <div style={{ fontSize: 13, marginTop: 6, fontWeight: 600 }}>Разом: {curr(previewTotal)} грн</div>
            </div>

            {savedId && marginAlert?.is_below_threshold && (
              <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                ⚠ Маржа {marginAlert.margin_pct}% — нижче порогу {marginAlert.threshold_pct}%
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          {savedId && canWriteCatalog && (
            <button className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={handleDelete} disabled={saving}>
              Видалити ліда
            </button>
          )}
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          {tab === "основне" && (
            <button className="btn primary" onClick={handleSave} disabled={saving || !canWriteCatalog}>
              {saving ? "Збереження..." : "Зберегти"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
