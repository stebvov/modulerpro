"use client";
import { fmtUahAmount } from "@/lib/format";
import SettingsButton from "@/components/SettingsButton";
import SearchFilter from "@/components/SearchFilter";
import SelectSearch from "@/components/SelectSearch";
import { treeOptions, inBranch } from "@/lib/tree";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import ServiceModal from "@/components/modals/ServiceModal";
import ServiceCategoriesPanel from "@/components/panels/ServiceCategoriesPanel";
import FolderTree, { dragItem, inFolder, useFolders } from "@/components/catalog/FolderTree";
import OrderButtons from "@/components/catalog/OrderButtons";
import { swapOrder } from "@/lib/reorder";

export default function ServicesCatalogScreen() {
  const { supabase, services, serviceCategories, showDecimals, reload } = useAppData();
  const folders = useFolders("services");
  const [folder, setFolder] = useState("");
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
      inBranch(serviceCategories, s.category_id, categoryFilter) &&
      inFolder(folders, s.folder_id, folder)
  );
  async function move(s, dir) {
    const i = list.indexOf(s);
    const b = list[i + dir];
    if (!b) return;
    await swapOrder(supabase, "services", services, s, b);
    await reload(true);
  }
  async function moveToFolder(id, folderId) {
    await supabase.from("services").update({ folder_id: folderId || null }).eq("id", id);
    await reload(true);
  }

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
          <SelectSearch value={categoryFilter} options={treeOptions(serviceCategories, (c) => `${c.icon ? c.icon + " " : ""}${c.name}`)} onChange={setCategoryFilter} placeholder="Усі типи" emptyLabel="Усі типи" width={220} ariaLabel="Тип послуги" />
        </SearchFilter>
        <div className="toolbar-actions">
          {canWriteCatalog && (
            <SettingsButton title="Типи послуг (доставка, монтаж…)" onClick={() => setShowCategoriesPage(true)} />
          )}
          {canWriteCatalog && (
            <button className="btn primary" onClick={() => openModal(null)}>+ Нова послуга</button>
          )}
        </div>
      </div>

      <div className="cat-layout">
      <FolderTree scope="services" items={services} selected={folder} onSelect={setFolder} canEdit={canWriteCatalog} onMoveItem={moveToFolder} />
      <main>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Тип</th><th>Назва</th><th>Одиниця</th><th>Базова ціна</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const cat = serviceCategories.find((c) => c.id === s.category_id);
              return (
                <tr key={s.id} className="cat-row" {...dragItem(s.id, canWriteCatalog)} style={canWriteCatalog ? { cursor: "pointer" } : undefined} title={canWriteCatalog ? "Клік — відкрити й редагувати" : undefined} onClick={(e) => { if (canWriteCatalog && !e.target.closest("a,button,input,select,.btn")) openModal(s); }}>
                  <td>{cat ? `${cat.icon ? cat.icon + " " : ""}${cat.name}` : "—"}</td>
                  <td>{s.icon ? `${s.icon} ` : ""}{s.name}</td>
                  <td>{s.unit}</td>
                  <td>{fmtUahAmount(s.base_price, showDecimals)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {canWriteCatalog && <OrderButtons onMove={(d) => move(s, d)} first={list.indexOf(s) === 0} last={list.indexOf(s) === list.length - 1} disabled={!!q} />}{" "}
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
      </main>
      </div>

      <ServiceModal open={modalOpen} service={editing} defaultFolder={folder} onClose={() => setModalOpen(false)} onSaved={() => setModalOpen(false)} />
    </div>
  );
}
