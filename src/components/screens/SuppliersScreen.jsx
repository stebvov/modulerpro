"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { contactHref } from "@/lib/format";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import SupplierModal from "@/components/modals/SupplierModal";

const RELIABILITY_OPTIONS = [
  { id: "0", label: "без оцінки" },
  { id: "1", label: "★☆☆☆☆" },
  { id: "2", label: "★★☆☆☆" },
  { id: "3", label: "★★★☆☆" },
  { id: "4", label: "★★★★☆" },
  { id: "5", label: "★★★★★" },
];

export default function SuppliersScreen() {
  const { suppliers, materialCategories, supplierCategoryLinks, supplierContacts } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [reliabilityFilter, setReliabilityFilter] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const categoryOptions = materialCategories.map((c) => ({ id: c.id, label: c.name }));

  const list = suppliers.filter((s) => {
    const cats = supplierCategoryLinks.filter((l) => l.supplier_id === s.id).map((l) => l.category_id);
    const rel = String(s.reliability_score || 0);
    return (
      (!search || s.name.toLowerCase().includes(search.toLowerCase())) &&
      (!categoryFilter.length || cats.some((c) => categoryFilter.includes(c))) &&
      (!reliabilityFilter.length || reliabilityFilter.includes(rel))
    );
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
          <span className="note" style={{ marginTop: 0 }}>Пошук і фільтри — у заголовках таблиці.</span>
        </div>
        {canWriteCatalog && (
          <button className="btn primary" onClick={() => openModal(null)}>+ Новий постачальник</button>
        )}
      </div>
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="th-filter">
              <div className="th-filter-row">
                Назва
                <input
                  type="text"
                  className="th-search-input"
                  placeholder="Пошук..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </th>
            <th className="th-filter">
              <div className="th-filter-row">
                Категорії
                <MultiSelectFilter options={categoryOptions} selected={categoryFilter} onChange={setCategoryFilter} label="Всі" />
              </div>
            </th>
            <th>Контакти</th>
            <th className="th-filter">
              <div className="th-filter-row">
                Надійність
                <MultiSelectFilter options={RELIABILITY_OPTIONS} selected={reliabilityFilter} onChange={setReliabilityFilter} label="Всі" />
              </div>
            </th>
            <th></th>
          </tr>
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
      </div>

      <SupplierModal open={modalOpen} supplier={editing} onClose={() => setModalOpen(false)} onSaved={() => setModalOpen(false)} />
    </div>
  );
}
