"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { contactHref } from "@/lib/format";
import SupplierModal from "@/components/modals/SupplierModal";

export default function SuppliersScreen() {
  const { suppliers, materialCategories, supplierCategoryLinks, supplierContacts } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const list = suppliers.filter((s) => {
    const cats = supplierCategoryLinks.filter((l) => l.supplier_id === s.id).map((l) => l.category_id);
    return (!categoryFilter || cats.includes(categoryFilter)) && (!search || s.name.toLowerCase().includes(search.toLowerCase()));
  });

  function openModal(s) {
    if (!canWriteCatalog) return;
    setEditing(s);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            className="search-input"
            placeholder="Пошук за назвою..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Всі категорії</option>
            {materialCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {canWriteCatalog && (
          <button className="btn primary" onClick={() => openModal(null)}>+ Новий постачальник</button>
        )}
      </div>
      <table>
        <thead>
          <tr><th>Постачальник</th><th>Категорії</th><th>Контакти</th><th>Надійність</th><th></th></tr>
        </thead>
        <tbody>
          {list.map((s) => {
            const cats = supplierCategoryLinks.filter((l) => l.supplier_id === s.id).map((l) => materialCategories.find((c) => c.id === l.category_id)).filter(Boolean);
            const contacts = supplierContacts.filter((c) => c.supplier_id === s.id);
            const rel = s.reliability_score || 0;
            return (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{cats.map((c) => <span className="tag" key={c.id}>{c.name}</span>)}{!cats.length && "—"}</td>
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
                    <span className="btn small" onClick={() => openModal(s)}>Редагувати</span>
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

      <SupplierModal open={modalOpen} supplier={editing} onClose={() => setModalOpen(false)} onSaved={() => setModalOpen(false)} />
    </div>
  );
}
