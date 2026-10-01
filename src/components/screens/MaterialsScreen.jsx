"use client";
import SettingsButton from "@/components/SettingsButton";

import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { flattenCategoryOrder } from "@/lib/categoryOrder";
import { useColumns } from "@/lib/useColumns";
import ColHead, { ColReset } from "@/components/ColHead";
import SearchFilter from "@/components/SearchFilter";
import MaterialModal from "@/components/modals/MaterialModal";
import MaterialCategoriesPanel from "@/components/panels/MaterialCategoriesPanel";
import UnitsPanel from "@/components/panels/UnitsPanel";

export default function MaterialsScreen() {
  const { materials, materialCategories } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(null); // null | "categories" | "units"

  // типовий порядок — як у дереві категорій, далі за назвою; сортування стовпчика його перекриває
  const base = useMemo(() => {
    const catOrder = flattenCategoryOrder(materialCategories);
    const q = search.trim().toLowerCase();
    return materials
      .filter((m) => !q || `${m.name} ${m.spec || ""}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const ca = catOrder.get(a.category_id) ?? 999999;
        const cb = catOrder.get(b.category_id) ?? 999999;
        return ca - cb || a.name.localeCompare(b.name, "uk");
      });
  }, [materials, materialCategories, search]);
  const cols = useMemo(() => {
    const cat = (m) => materialCategories.find((c) => c.id === m.category_id);
    return {
      cat: { value: (m) => cat(m)?.name, text: (v) => { const c = materialCategories.find((x) => x.name === v); return c?.icon ? `${c.icon} ${v}` : v; } },
      name: { value: (m) => m.name },
      unit: { value: (m) => m.unit },
    };
  }, [materialCategories]);
  const t = useColumns(base, cols);
  const list = t.rows;
  // нова позиція одразу в категорії, якщо у фільтрі вибрано рівно одну
  const pickedCats = t.selected("cat");
  const defaultCategoryId = pickedCats.length === 1 ? materialCategories.find((c) => c.name === pickedCats[0])?.id : undefined;

  function openModal(m) {
    if (!canWriteCatalog) return;
    setEditing(m);
    setModalOpen(true);
  }

  if (page === "categories") {
    return (
      <div>
        <MaterialCategoriesPanel onBack={() => setPage(null)} />
      </div>
    );
  }
  if (page === "units") {
    return (
      <div>
        <UnitsPanel onBack={() => setPage(null)} />
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <SearchFilter value={search} onChange={setSearch} placeholder="Пошук товару чи матеріалу…" />
        <div className="toolbar-actions">
          <ColReset t={t} />
          {canWriteCatalog && (
            <button className="btn primary" onClick={() => openModal(null)}>+ Новий матеріал</button>
          )}
        </div>
      </div>
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <ColHead t={t} k="cat" extra={canWriteCatalog && <SettingsButton title="Категорії матеріалів" onClick={() => setPage("categories")} />}>Категорія</ColHead>
            <ColHead t={t} k="name">Назва</ColHead>
            <ColHead t={t} k="unit" extra={canWriteCatalog && <SettingsButton title="Одиниці виміру" onClick={() => setPage("units")} />}>Одиниця</ColHead>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((m) => {
            const cat = materialCategories.find((c) => c.id === m.category_id);
            return (
              <tr key={m.id} style={canWriteCatalog ? { cursor: "pointer" } : undefined} title={canWriteCatalog ? "Клік — відкрити й редагувати" : undefined} onClick={(e) => { if (canWriteCatalog && !e.target.closest("a,button,input,select,.btn")) openModal(m); }}>
                <td>{cat ? `${cat.icon ? cat.icon + " " : ""}${cat.name}` : "—"}</td>
                <td>{m.icon ? `${m.icon} ` : ""}{m.name}</td>
                <td>{m.unit}</td>
                <td>
                  {canWriteCatalog && (
                    <span className="btn small" onClick={() => openModal(m)} title="Редагувати">
                      <span className="btn-label-full">Редагувати</span>
                      <span className="btn-label-compact">✎</span>
                    </span>
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
        defaultCategoryId={defaultCategoryId}
        onClose={() => setModalOpen(false)}
        onSaved={() => setModalOpen(false)}
      />
    </div>
  );
}
