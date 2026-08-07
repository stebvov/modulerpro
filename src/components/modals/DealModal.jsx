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
  curr,
  fmtDateTime,
} from "@/lib/crm";

function emptyContact(type, value) {
  return { key: Math.random().toString(36).slice(2), type: type || "email", value: value || "" };
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
    <div className="section-details" style={{ padding: 10 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <select style={{ flex: 1 }} value={service.service_type} onChange={(e) => setType(e.target.value)}>
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace("_", " ")}</option>
          ))}
        </select>
        <button type="button" className="btn small" onClick={onRemove}>×</button>
      </div>
      {service.service_type === "фундамент" && (
        <div className="form-row">
          <label>Тип фундаменту</label>
          <select value={service.variant || ""} onChange={(e) => setVariant(e.target.value)}>
            {variants.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}
      <div className="seg-row" style={{ marginBottom: 8 }}>
        <button type="button" className={`seg-btn${service.calc_method === "за_тарифом" ? " active" : ""}`} disabled={!rateCard} onClick={() => setMethod("за_тарифом")}>За тарифом</button>
        <button type="button" className={`seg-btn${service.calc_method === "середнє" ? " active" : ""}`} onClick={() => setMethod("середнє")}>Середнє</button>
        <button type="button" className={`seg-btn${service.calc_method === "вручну" ? " active" : ""}`} onClick={() => setMethod("вручну")}>Вручну</button>
      </div>
      {service.calc_method === "за_тарифом" && rateCard && (
        <div className="form-row">
          <label>Кількість одиниць · тариф {curr(rateCard.rate)} грн/од.</label>
          <input type="number" step="0.1" value={service.quantity_units} onChange={setQty} />
        </div>
      )}
      {service.calc_method === "вручну" ? (
        <div className="form-row">
          <label>Сума, грн</label>
          <input type="number" value={service.price} onChange={(e) => set({ price: Number(e.target.value) || 0 })} />
        </div>
      ) : (
        <div className="note" style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>
          {service.calc_method === "середнє" && "≈ "}{curr(service.price)} грн
        </div>
      )}
    </div>
  );
}

function ActivityLog({ deal, activities, onReload }) {
  const { supabase } = useCrmData();
  const { profile, user } = useAuth();
  const [type, setType] = useState("дзвінок");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [naDate, setNaDate] = useState(deal.next_action_at ? deal.next_action_at.slice(0, 16) : "");
  const [naNote, setNaNote] = useState(deal.next_action_note || "");

  const author = profile?.full_name || user?.email || null;
  const sorted = [...activities].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  async function submitActivity() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      let attachment_name = null;
      let attachment_path = null;
      if (file) {
        const path = `${deal.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("deal-files").upload(path, file);
        if (!upErr) {
          attachment_name = file.name;
          attachment_path = path;
        }
      }
      await supabase.from("deal_activities").insert([
        { deal_id: deal.id, type, note: note.trim(), attachment_name, attachment_path, created_by: author },
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
      await supabase
        .from("deals")
        .update({ next_action_at: naDate ? new Date(naDate).toISOString() : null, next_action_note: naNote })
        .eq("id", deal.id);
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
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
  const { supabase, leads, leadContacts, deals, dealServices, dealActivities, teamMembers, productCategories, templates, serviceRateCards, reload } = useCrmData();
  const { canWriteCatalog } = useAuth();

  const dealRow = dealId ? deals.find((d) => d.id === dealId) : null;
  const existingLead = dealRow ? leads.find((l) => l.id === dealRow.lead_id) : null;

  const [tab, setTab] = useState("основне");
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab("основне");
    setError("");
    if (dealId && dealRow && existingLead) {
      const contacts = leadContacts.filter((c) => c.lead_id === existingLead.id && !(c.is_primary && c.type === "телефон"));
      const services = dealServices
        .filter((s) => s.deal_id === dealId)
        .map((s) => emptyService({ service_type: s.service_type, variant: s.variant, calc_method: s.calc_method, quantity_units: s.quantity_units ?? "", price: s.price, rate_card_id: s.rate_card_id }));
      setForm({
        lead_name: existingLead.name || "",
        lead_phone: existingLead.phone || "",
        lead_contact: existingLead.contact || "",
        lead_region: existingLead.region || "",
        lead_source: existingLead.source || "сайт",
        lead_status: existingLead.status || "новий",
        lead_budget_range: existingLead.budget_range || "",
        lead_notes: existingLead.notes || "",
        category_id: existingLead.category_id || "",
        contacts: contacts.length ? contacts.map((c) => emptyContact(c.type, c.value)) : [emptyContact()],
        is_custom: dealRow.is_custom || false,
        template_id: dealRow.template_id || "",
        custom_area_m2: dealRow.custom_area_m2 ?? "",
        custom_notes: dealRow.custom_notes || "",
        quantity: dealRow.quantity || 1,
        owner_id: dealRow.owner_id || "",
        services: services.length ? services : [],
      });
    } else {
      setForm({
        lead_name: "", lead_phone: "", lead_contact: "", lead_region: "",
        lead_source: "сайт", lead_status: "новий", lead_budget_range: "", lead_notes: "",
        category_id: "",
        contacts: [emptyContact()],
        is_custom: false, template_id: "", custom_area_m2: "", custom_notes: "",
        quantity: 1, owner_id: "", services: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealId]);

  if (!open || !form) return null;

  const isHouses = pipeline.slug === "houses";
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

  function defaultQuantity(service_type) {
    if (service_type === "монтаж") return Number(form.quantity) || 1;
    if (service_type === "фундамент") {
      if (form.is_custom) return Number(form.custom_area_m2) || 0;
      const tpl = templates.find((t) => t.id === form.template_id);
      return tpl ? Number(tpl.area_m2) : 0;
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

  const tpl = templates.find((t) => t.id === form.template_id);
  const previewUnit = isHouses ? (form.is_custom ? Math.round((Number(form.custom_area_m2) || 0) * avgCostPerM2(templates)) : tpl && tpl.base_cost_per_m2 != null ? Math.round(tpl.area_m2 * tpl.base_cost_per_m2) : 0) : 0;
  const previewServicesSum = form.services.reduce((s, x) => s + (Number(x.price) || 0), 0);
  const previewQuantity = isHouses ? Number(form.quantity) || 1 : 1;
  const previewTotal = previewUnit * previewQuantity + previewServicesSum;

  async function handleSave() {
    if (!form.lead_name.trim()) { setError("Заповни ім'я/назву клієнта."); return; }
    setSaving(true);
    setError("");
    try {
      const leadPayload = {
        name: form.lead_name.trim(),
        phone: form.lead_phone.trim() || null,
        contact: form.lead_contact.trim() || null,
        region: form.lead_region.trim() || null,
        category_id: form.category_id || null,
        source: form.lead_source,
        status: form.lead_status,
        budget_range: form.lead_budget_range.trim() || null,
        notes: form.lead_notes.trim() || null,
      };
      let leadId = existingLead?.id;
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

      const is_custom = isHouses ? form.is_custom : false;
      const template_id = isHouses && !is_custom ? form.template_id || null : null;
      const custom_area_m2 = isHouses && is_custom ? (form.custom_area_m2 === "" ? null : Number(form.custom_area_m2)) : null;
      const chosenTpl = templates.find((t) => t.id === template_id);
      const production_price = isHouses && !is_custom && chosenTpl && chosenTpl.base_cost_per_m2 != null ? Math.round(chosenTpl.area_m2 * chosenTpl.base_cost_per_m2) : null;
      const estimated_price = isHouses && is_custom ? Math.round((Number(form.custom_area_m2) || 0) * avgCostPerM2(templates)) : null;

      const dealPayload = {
        lead_id: leadId,
        pipeline_id: pipeline.id,
        template_id,
        is_custom,
        custom_area_m2,
        custom_notes: isHouses ? (form.custom_notes.trim() || null) : null,
        quantity: isHouses ? (Number(form.quantity) || 1) : 1,
        production_price,
        estimated_price,
        owner_id: form.owner_id || null,
      };

      let savedDealId = dealId;
      if (savedDealId) {
        const { error: e } = await supabase.from("deals").update(dealPayload).eq("id", savedDealId);
        if (e) throw e;
      } else {
        dealPayload.stage_id = pipeline.stages[0].id;
        const { data: created, error: e } = await supabase.from("deals").insert([dealPayload]).select().single();
        if (e) throw e;
        savedDealId = created.id;
      }

      await supabase.from("deal_services").delete().eq("deal_id", savedDealId);
      if (form.services.length) {
        const { error: e } = await supabase.from("deal_services").insert(
          form.services.map((s) => ({
            deal_id: savedDealId,
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

      await reload();
      onSaved?.(savedDealId);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  const activities = dealId ? dealActivities.filter((a) => a.deal_id === dealId) : [];

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2>{dealId ? "Редагувати угоду" : `Новий лід — ${pipeline.name}`}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="seg-row" style={{ marginBottom: 16 }}>
          <button type="button" className={`seg-btn${tab === "основне" ? " active" : ""}`} onClick={() => setTab("основне")}>Основне</button>
          <button type="button" className={`seg-btn${tab === "історія" ? " active" : ""}`} onClick={() => setTab("історія")}>
            Історія {activities.length > 0 ? `(${activities.length})` : ""}
          </button>
        </div>

        {tab === "історія" ? (
          dealId ? (
            <ActivityLog deal={dealRow} activities={activities} onReload={reload} />
          ) : (
            <div className="empty">Спершу збережи угоду, потім додай історію спілкування та файли.</div>
          )
        ) : (
          <>
            <div className="form-row">
              <label>Ім&apos;я / назва клієнта *</label>
              <input value={form.lead_name} onChange={update("lead_name")} />
            </div>
            <div className="form-row">
              <label>Телефон</label>
              <input value={form.lead_phone} onChange={update("lead_phone")} placeholder="+380 ..." />
            </div>
            <div className="form-row">
              <label>Додатковий контакт (необов&apos;язково)</label>
              <input value={form.lead_contact} onChange={update("lead_contact")} placeholder="напр. дружина Оксана, +380..." />
            </div>
            <div className="form-row">
              <label>Інші контакти</label>
              {form.contacts.map((c) => (
                <div className="contact-row" key={c.key}>
                  <select style={{ flex: "0 0 110px" }} value={c.type} onChange={(e) => updateContact(c.key, { type: e.target.value })}>
                    {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="value-input" value={c.value} onChange={(e) => updateContact(c.key, { value: e.target.value })} placeholder="значення" />
                  <span className="icon-x" onClick={() => removeContact(c.key)}>×</span>
                </div>
              ))}
              <button type="button" className="btn small" onClick={() => setForm((f) => ({ ...f, contacts: [...f.contacts, emptyContact()] }))}>+ Додати контакт</button>
            </div>
            <div className="form-row">
              <label>Регіон</label>
              <input value={form.lead_region} onChange={update("lead_region")} />
            </div>
            <div className="form-row">
              <label>Категорія</label>
              <select value={form.category_id} onChange={update("category_id")}>
                <option value="">— не вказано —</option>
                {productCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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
            <div className="form-row">
              <label>Бюджет (орієнтовно)</label>
              <input value={form.lead_budget_range} onChange={update("lead_budget_range")} placeholder="напр. 500 000 - 800 000 грн" />
            </div>

            {isHouses && (
              <>
                <div className="form-row">
                  <label>Тип запиту</label>
                  <div className="seg-row">
                    <button type="button" className={`seg-btn${!form.is_custom ? " active" : ""}`} onClick={() => setForm((f) => ({ ...f, is_custom: false }))}>Готовий шаблон</button>
                    <button type="button" className={`seg-btn${form.is_custom ? " active" : ""}`} onClick={() => setForm((f) => ({ ...f, is_custom: true }))}>Кастомний запит</button>
                  </div>
                </div>
                {!form.is_custom ? (
                  <div className="form-row">
                    <label>Шаблон</label>
                    <select value={form.template_id} onChange={update("template_id")}>
                      <option value="">— не вибрано —</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} · {t.area_m2} м²{t.base_cost_per_m2 != null ? ` · ${curr(t.base_cost_per_m2)} грн/м²` : " · немає ціни"}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-row">
                    <label>Бажана площа, м²</label>
                    <input type="number" step="0.1" value={form.custom_area_m2} onChange={update("custom_area_m2")} />
                  </div>
                )}
                <div className="form-row">
                  <label>Побажання клієнта (опис)</label>
                  <textarea rows={2} value={form.custom_notes} onChange={update("custom_notes")} placeholder="Побажання, деталі, особливості запиту…" />
                </div>
                <div className="form-row">
                  <label>Кількість, шт</label>
                  <input type="number" min="1" value={form.quantity} onChange={update("quantity")} />
                </div>
              </>
            )}

            <div className="form-row">
              <label>Послуги ({form.services.length})</label>
              {form.services.map((s, i) => (
                <ServiceRow key={s.key} service={s} rateCards={serviceRateCards} defaultQuantity={defaultQuantity} onChange={(next) => updateService(i, next)} onRemove={() => removeService(i)} />
              ))}
              <button type="button" className="btn small" onClick={addService}>+ Додати послугу</button>
            </div>

            <div className="form-row">
              <label>Відповідальний</label>
              <SearchCombobox value={form.owner_id} options={ownerOptions} placeholder="Ім'я відповідального..." onChange={(id) => setForm((f) => ({ ...f, owner_id: id }))} onCreate={createTeamMember} />
            </div>

            <div className="form-row">
              <label>Нотатки по ліду</label>
              <textarea rows={2} value={form.lead_notes} onChange={update("lead_notes")} />
            </div>

            {!dealId && <div className="note">Файли можна прикріпити до запису у вкладці «Історія» після збереження угоди.</div>}

            <div style={{ background: "var(--accent-bg)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
              {isHouses && (
                <>
                  <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {form.is_custom ? "Орієнтовна ціна виробництва" : "Ціна виробництва (автоматично)"}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--accent)" }}>
                    {form.is_custom ? "≈ " : ""}{curr(previewUnit)} грн {previewQuantity > 1 ? `× ${previewQuantity} = ${curr(previewUnit * previewQuantity)} грн` : ""}
                  </div>
                </>
              )}
              {previewServicesSum > 0 && <div style={{ fontSize: 12, color: "#C1652F", marginTop: 4 }}>Послуги разом: {curr(previewServicesSum)} грн</div>}
              <div style={{ fontSize: 13, marginTop: 6, fontWeight: 600 }}>Разом: {curr(previewTotal)} грн</div>
            </div>
          </>
        )}

        <div className="modal-actions">
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
