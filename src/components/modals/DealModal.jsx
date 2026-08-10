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
  avgCostPerM2,
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
    selection: overrides?.selection || "",
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
  const {
    supabase, leads, leadContacts, leadCategoryLinks, deals, dealActivities, teamMembers, productCategories,
    templates, serviceTemplates, services, serviceTemplateItems, bomItems, extraCosts, supplierPrices, marginAlerts, reload,
  } = useCrmData();
  const { canWriteCatalog, profile } = useAuth();

  const [savedId, setSavedId] = useState(dealId || null);
  const [tab, setTab] = useState("основне");
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
        custom_area_m2: dealRow.custom_area_m2 ?? "",
        custom_notes: dealRow.custom_notes || "",
        quantity: dealRow.quantity || 1,
        owner_id: dealRow.owner_id || "",
      });
    } else {
      const defaultOwner = teamMembers.find((m) => m.name === profile?.full_name);
      setForm({
        lead_name: "", lead_region: "",
        lead_source: "сайт", lead_status: "новий", lead_budget_range: "", lead_notes: "",
        category_ids: [],
        contacts: [emptyContact("телефон")],
        request_type: pipeline.slug === "houses" ? "template" : "individual",
        order_items: [], custom_area_m2: "", custom_notes: "",
        quantity: 1, owner_id: defaultOwner?.id || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealId]);

  if (!open || !form) return null;

  const ownerOptions = teamMembers.map((m) => ({ id: m.id, label: m.name }));
  const showExtraOpen = !!(form.lead_region || form.category_ids.length || form.lead_source !== "сайт" || form.lead_status !== "новий");
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
  const orderItemsTotal = orderItemsProductionTotal(cleanOrderItems, { templates, services, serviceTemplateItems });
  const previewProductionTotal =
    form.request_type === "custom"
      ? (Number(form.custom_area_m2) || 0) * avgCostPerM2(templates) * (Number(form.quantity) || 1) + orderItemsTotal
      : form.request_type === "template"
      ? orderItemsTotal
      : 0;

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
      const itemsForType = showOrderItems ? cleanOrderItems : [];
      const custom_area_m2 = is_custom ? (form.custom_area_m2 === "" ? null : Number(form.custom_area_m2)) : null;
      const houseAndServiceTotal = orderItemsProductionTotal(itemsForType, { templates, services, serviceTemplateItems });
      const customHouseTotal = is_custom ? (Number(form.custom_area_m2) || 0) * avgCostPerM2(templates) : 0;
      const production_price = itemsForType.length || is_custom ? Math.round(houseAndServiceTotal + customHouseTotal) : null;
      const estimated_price = is_custom ? Math.round(customHouseTotal) : null;
      const production_cost_snapshot = computeProductionCostSnapshot(
        { is_custom, template_id: null, custom_area_m2, template_lines: itemsForType },
        { templates, bomItems, extraCosts, supplierPrices }
      );

      const dealPayload = {
        lead_id: leadId,
        pipeline_id: pipeline.id,
        template_id: null,
        template_lines: itemsForType,
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

            {showOrderItems && (
              <div className="form-row">
                <label>Позиції замовлення{form.request_type === "custom" ? " (послуги, додаткові матеріали)" : " (шаблони будинків, послуг, кастомні позиції)"}</label>
                {form.order_items.map((row, i) => {
                  const { kind } = parseSelection(row.selection);
                  return (
                    <div key={row.key} style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                      <select style={{ flex: "1 1 220px" }} value={row.selection} onChange={(e) => updateOrderItem(i, { selection: e.target.value })}>
                        <option value="">— вибери —</option>
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
                        {serviceTemplates.length > 0 && (
                          <optgroup label="Послуги">
                            {serviceTemplates.map((t) => (
                              <option key={t.id} value={`service:${t.id}`}>
                                {t.name} · {curr(serviceTemplateUnitPrice(t.id, serviceTemplateItems, services))} грн
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

            <div style={{ background: "var(--accent-bg)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
              {form.request_type !== "individual" && (
                <>
                  <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {form.request_type === "custom" ? "Орієнтовна вартість (будинок + позиції)" : "Вартість замовлення (автоматично)"}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--accent)" }}>
                    {form.request_type === "custom" ? "≈ " : ""}{curr(previewProductionTotal)} грн
                  </div>
                </>
              )}
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
