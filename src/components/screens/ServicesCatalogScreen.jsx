"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import ServiceModal from "@/components/modals/ServiceModal";
import ServiceCategoriesPanel from "@/components/panels/ServiceCategoriesPanel";

export default function ServicesCatalogScreen() {
  const { services, serviceCategories } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showCategoriesPage, setShowCategoriesPage] = useState(false);

  const list = services.filter(
    (s) =>
      (!search || s.name.toLowerCase().includes(search.toLowerCase())) &&
      (!categoryFilter || s.category_id === categoryFilter)
  );

  function openModal(s) {
    if (!canWriteCatalog) return;
    setEditing(s);
    setModalOpen(true);
  }

  if (showCategoriesPage) {
    return (
      <div>
        <ServiceCategoriesPanel onBack={() => setShowCategoriesPage(false)} />
      </div>
    );
  }

  return (
    <div>
      <p className="note">Каталог послуг — використовуються для побудови шаблонів послуг і як окремі позиції в замовленні.</p>
      <div className="toolbar">
        <div className="toolbar-left">
          <input type="text" className="search-input" placeholder="Пошук послуги..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Всі категорії</option>
            {serviceCategories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
          </select>
          {canWriteCatalog && (
            <button className="btn small" title="Налаштування категорій" onClick={() => setShowCategoriesPage(true)}>⚙</button>
          )}
        </div>
        {canWriteCatalog && (
          <button className="btn primary" onClick={() => openModal(null)}>+ Нова послуга</button>
        )}
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Категорія</th><th>Назва</th><th>Одиниця</th><th>Базова ціна</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const cat = serviceCategories.find((c) => c.id === s.category_id);
              return (
                <tr key={s.id}>
                  <td>{cat ? `${cat.icon ? cat.icon + " " : ""}${cat.name}` : "—"}</td>
                  <td>{s.icon ? `${s.icon} ` : ""}{s.name}</td>
                  <td>{s.unit}</td>
                  <td>{s.base_price != null ? `${Number(s.base_price).toLocaleString("uk-UA")} грн` : "—"}</td>
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
            {!list.length && <tr><td colSpan={5} className="empty">Нічого не знайдено</td></tr>}
          </tbody>
        </table>
      </div>

      <ServiceModal open={modalOpen} service={editing} onClose={() => setModalOpen(false)} onSaved={() => setModalOpen(false)} />
    </div>
  );
}
