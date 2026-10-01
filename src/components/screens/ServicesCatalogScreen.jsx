"use client";
import SettingsButton from "@/components/SettingsButton";
import SearchFilter from "@/components/SearchFilter";
import SelectSearch from "@/components/SelectSearch";
import { treeOptions, inBranch } from "@/lib/tree";

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

  const q = search.trim().toLowerCase();
  const list = services.filter(
    (s) =>
      (!q || [s.name, s.unit].join(" ").toLowerCase().includes(q)) &&
      inBranch(serviceCategories, s.category_id, categoryFilter)
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
      <p className="note">Послуги, які ми надаємо: доставка, фундамент, монтаж, під ключ тощо. Додаються в пакети й в угоди CRM окремими позиціями.</p>
      <div className="toolbar">
        <SearchFilter value={search} onChange={setSearch} placeholder="Пошук послуги…" active={categoryFilter ? 1 : 0} onReset={() => setCategoryFilter("")}>
          <SelectSearch value={categoryFilter} options={treeOptions(serviceCategories, (c) => `${c.icon ? c.icon + " " : ""}${c.name}`)} onChange={setCategoryFilter} placeholder="Усі категорії" emptyLabel="Усі категорії" width={220} ariaLabel="Категорія" />
        </SearchFilter>
        <div className="toolbar-actions">
          {canWriteCatalog && (
            <SettingsButton title="Категорії послуг" onClick={() => setShowCategoriesPage(true)} />
          )}
          {canWriteCatalog && (
            <button className="btn primary" onClick={() => openModal(null)}>+ Нова послуга</button>
          )}
        </div>
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
                <tr key={s.id} style={canWriteCatalog ? { cursor: "pointer" } : undefined} title={canWriteCatalog ? "Клік — відкрити й редагувати" : undefined} onClick={(e) => { if (canWriteCatalog && !e.target.closest("a,button,input,select,.btn")) openModal(s); }}>
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
