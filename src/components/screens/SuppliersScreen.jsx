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
  const { suppliers, materialCategories, supplierCategoryLinks, supplierContacts } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

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
            <button className="btn primary" onClick={() => openModal(null)}>+ Новий постачальник</button>
          )}
        </div>
      </div>
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
                <td>{cats.map((c) => <span className="tag" key={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</span>)}{!cats.length && "—"}</td>
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
