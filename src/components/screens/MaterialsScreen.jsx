"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import MaterialModal from "@/components/modals/MaterialModal";

export default function MaterialsScreen() {
  const { materials, materialCategories } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const list = materials.filter(
    (m) => (!categoryFilter || m.category_id === categoryFilter) && (!search || m.name.toLowerCase().includes(search.toLowerCase()))
  );

  function openModal(m) {
    if (!canWriteCatalog) return;
    setEditing(m);
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
          <button className="btn primary" onClick={() => openModal(null)}>+ Новий матеріал</button>
        )}
      </div>
      <table>
        <thead>
          <tr><th>Назва</th><th>Категорія</th><th>Одиниця</th><th></th></tr>
        </thead>
        <tbody>
          {list.map((m) => {
            const cat = materialCategories.find((c) => c.id === m.category_id);
            return (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{cat ? cat.name : "—"}</td>
                <td>{m.unit}</td>
                <td>
                  {canWriteCatalog && (
                    <span className="btn small" onClick={() => openModal(m)}>Редагувати</span>
                  )}
                </td>
              </tr>
            );
          })}
          {!list.length && (
            <tr><td colSpan={4} className="empty">Нічого не знайдено</td></tr>
          )}
        </tbody>
      </table>

      <MaterialModal
        open={modalOpen}
        material={editing}
        defaultCategoryId={categoryFilter}
        onClose={() => setModalOpen(false)}
        onSaved={() => setModalOpen(false)}
      />
    </div>
  );
}
