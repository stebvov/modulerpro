"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { flattenCategoryOrder } from "@/lib/categoryOrder";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import MaterialModal from "@/components/modals/MaterialModal";
import MaterialCategoriesModal from "@/components/modals/MaterialCategoriesModal";
import UnitsModal from "@/components/modals/UnitsModal";

export default function MaterialsScreen() {
  const { materials, materialCategories } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [unitFilter, setUnitFilter] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [unitsModalOpen, setUnitsModalOpen] = useState(false);

  const categoryOptions = materialCategories.map((c) => ({ id: c.id, label: c.name }));
  const unitOptions = [...new Set(materials.map((m) => m.unit))].sort().map((u) => ({ id: u, label: u }));
  const catOrder = flattenCategoryOrder(materialCategories);

  const list = materials
    .filter(
      (m) =>
        (!search || m.name.toLowerCase().includes(search.toLowerCase())) &&
        (!categoryFilter.length || categoryFilter.includes(m.category_id)) &&
        (!unitFilter.length || unitFilter.includes(m.unit))
    )
    .sort((a, b) => {
      const ca = catOrder.get(a.category_id) ?? 999999;
      const cb = catOrder.get(b.category_id) ?? 999999;
      return ca - cb || a.name.localeCompare(b.name, "uk");
    });

  function openModal(m) {
    if (!canWriteCatalog) return;
    setEditing(m);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="note" style={{ marginTop: 0 }}>Пошук і фільтри — у заголовках таблиці.</span>
        </div>
        {canWriteCatalog && (
          <button className="btn primary" onClick={() => openModal(null)}>+ Новий матеріал</button>
        )}
      </div>
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="th-filter">
              <div className="th-filter-row">
                Категорія
                <MultiSelectFilter options={categoryOptions} selected={categoryFilter} onChange={setCategoryFilter} label="Всі" />
                {canWriteCatalog && (
                  <button className="btn small" title="Налаштування категорій" onClick={() => setCatModalOpen(true)}>⚙</button>
                )}
              </div>
            </th>
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
                Одиниця
                <MultiSelectFilter options={unitOptions} selected={unitFilter} onChange={setUnitFilter} label="Всі" />
                {canWriteCatalog && (
                  <button className="btn small" title="Налаштування одиниць" onClick={() => setUnitsModalOpen(true)}>⚙</button>
                )}
              </div>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((m) => {
            const cat = materialCategories.find((c) => c.id === m.category_id);
            return (
              <tr key={m.id}>
                <td>{cat ? cat.name : "—"}</td>
                <td>{m.icon ? `${m.icon} ` : ""}{m.name}</td>
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
      </div>

      <MaterialModal
        open={modalOpen}
        material={editing}
        defaultCategoryId={categoryFilter.length === 1 ? categoryFilter[0] : undefined}
        onClose={() => setModalOpen(false)}
        onSaved={() => setModalOpen(false)}
      />
      <MaterialCategoriesModal open={catModalOpen} onClose={() => setCatModalOpen(false)} />
      <UnitsModal open={unitsModalOpen} onClose={() => setUnitsModalOpen(false)} />
    </div>
  );
}
