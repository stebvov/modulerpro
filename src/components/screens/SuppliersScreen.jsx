"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { contactHref } from "@/lib/format";
import { useColumns } from "@/lib/useColumns";
import ColHead, { ColReset } from "@/components/ColHead";
import SearchFilter from "@/components/SearchFilter";
import SupplierModal from "@/components/modals/SupplierModal";

const stars = (n) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "без оцінки");

export default function SuppliersScreen() {
  const { supabase, suppliers, materials, materialCategories, supplierCategoryLinks, supplierContacts, supplierPrices, reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filling, setFilling] = useState(false);
  const [fillNote, setFillNote] = useState("");

  // Категорії постачальника — з товарів, на які в нього є ціни. Лише додаємо відсутні, нічого не прибираємо.
  async function fillCategories() {
    const have = new Set(supplierCategoryLinks.map((l) => `${l.supplier_id}|${l.category_id}`));
    const add = new Map();
    for (const p of supplierPrices) {
      const cat = materials.find((m) => m.id === p.material_id)?.category_id;
      const key = `${p.supplier_id}|${cat}`;
      if (cat && !have.has(key)) add.set(key, { supplier_id: p.supplier_id, category_id: cat });
    }
    const rows = [...add.values()];
    const touched = new Set(rows.map((r) => r.supplier_id)).size;
    const without = suppliers.filter((s) => !supplierPrices.some((p) => p.supplier_id === s.id) && !supplierCategoryLinks.some((l) => l.supplier_id === s.id)).length;
    const rest = without ? ` Без цін і без категорій лишилось постачальників: ${without} — їм категорії треба проставити вручну.` : "";
    if (!rows.length) return setFillNote(`Усі категорії вже проставлені за товарами, на які є ціни.${rest}`);
    setFilling(true);
    const { error } = await supabase.from("supplier_category_links").insert(rows);
    await reload(true);
    setFilling(false);
    setFillNote(error ? `Не вдалося: ${error.message}` : `Додано категорій: ${rows.length} (постачальників: ${touched}) — за товарами, на які в них є ціни.${rest}`);
  }

  // стовпчики: за чим сортувати й що показувати у списку фільтра
  const cols = useMemo(() => {
    const catsOf = (s) => supplierCategoryLinks.filter((l) => l.supplier_id === s.id).map((l) => materialCategories.find((c) => c.id === l.category_id)).filter(Boolean);
    const contactsOf = (s) => supplierContacts.filter((c) => c.supplier_id === s.id);
    return {
      name: { value: (s) => s.name },
      cats: { value: (s) => catsOf(s).map((c) => c.name), text: (v) => { const c = materialCategories.find((x) => x.name === v); return c?.icon ? `${c.icon} ${v}` : v; } },
      contacts: { value: (s) => [...new Set(contactsOf(s).map((c) => c.type || "інше"))], sort: (s) => contactsOf(s).map((c) => c.value).join(", ") },
      rel: { value: (s) => stars(s.reliability_score || 0), sort: (s) => s.reliability_score || 0 },
    };
  }, [materialCategories, supplierCategoryLinks, supplierContacts]);

  const q = search.trim().toLowerCase();
  const found = useMemo(() => suppliers.filter((s) => {
    if (!q) return true;
    const contacts = supplierContacts.filter((c) => c.supplier_id === s.id).map((c) => `${c.label || ""} ${c.value || ""}`).join(" ");
    return `${s.name} ${contacts}`.toLowerCase().includes(q);
  }), [suppliers, supplierContacts, q]);
  const t = useColumns(found, cols);
  const list = t.rows;

  function openModal(s) {
    if (!canWriteCatalog) return;
    setEditing(s);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="toolbar">
        <SearchFilter value={search} onChange={setSearch} placeholder="Пошук: назва, телефон, контакт…" />
        <div className="toolbar-actions">
          <ColReset t={t} />
          {canWriteCatalog && (
            <button className="btn" disabled={filling} onClick={fillCategories} title="Проставити постачальникам категорії за товарами, на які в них є ціни (наявні категорії не змінюються)">
              {filling ? "Заповнюю…" : "Заповнити категорії автоматично"}
            </button>
          )}
          {canWriteCatalog && (
            <button className="btn primary" onClick={() => openModal(null)}>+ Новий постачальник</button>
          )}
        </div>
      </div>
      {fillNote && <p className="note" style={{ marginTop: -6 }}>{fillNote}</p>}
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <ColHead t={t} k="name">Назва</ColHead>
            <ColHead t={t} k="cats">Категорії</ColHead>
            <ColHead t={t} k="contacts">Контакти</ColHead>
            <ColHead t={t} k="rel">Надійність</ColHead>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => {
            const cats = supplierCategoryLinks.filter((l) => l.supplier_id === s.id).map((l) => materialCategories.find((c) => c.id === l.category_id)).filter(Boolean);
            const contacts = supplierContacts.filter((c) => c.supplier_id === s.id);
            const rel = s.reliability_score || 0;
            return (
              <tr key={s.id} style={canWriteCatalog ? { cursor: "pointer" } : undefined} title={canWriteCatalog ? "Клік — відкрити й редагувати" : undefined} onClick={(e) => { if (canWriteCatalog && !e.target.closest("a,button,input,select,.btn")) openModal(s); }}>
                <td>{s.name}</td>
                <td>
                  {/* компактно: перші дві категорії в один рядок, решта — «+N» (усі — у підказці) */}
                  {cats.length ? (
                    <span className="cats-compact" title={cats.map((c) => c.name).join(", ")}>
                      {cats.slice(0, 2).map((c) => <span className="tag" key={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</span>)}
                      {cats.length > 2 && <span className="tag tag--more">+{cats.length - 2}</span>}
                    </span>
                  ) : "—"}
                </td>
                <td>
                  {contacts.length
                    ? contacts.map((c) => {
                        const href = contactHref(c.type, c.value);
                        return (
                          <div className="contact-line" key={c.id}>
                            {c.label ? c.label + ": " : ""}
                            {href ? <a href={href} target="_blank" rel="noreferrer">{c.value}</a> : c.value}
                          </div>
                        );
                      })
                    : "—"}
                </td>
                <td>{"★".repeat(rel)}{"☆".repeat(5 - rel)}</td>
                <td>
                  {canWriteCatalog && (
                    <span className="btn small" onClick={() => openModal(s)} title="Редагувати">
                      <span className="btn-label-full">Редагувати</span>
                      <span className="btn-label-compact">✎</span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {!list.length && (
            <tr><td colSpan={5} className="empty">Нічого не знайдено</td></tr>
          )}
        </tbody>
      </table>
      </div>

      <SupplierModal open={modalOpen} supplier={editing} onClose={() => setModalOpen(false)} onSaved={() => setModalOpen(false)} />
    </div>
  );
}
