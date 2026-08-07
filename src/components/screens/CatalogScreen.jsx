"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { statusLabels, templateTotalUah, fmtCurrency } from "@/lib/format";
import TemplateModal from "@/components/modals/TemplateModal";

export default function CatalogScreen({ compareSelection, setCompareSelection }) {
  const { supabase, templates, bomItems, productCategoryLinks, productCategories, templateFiles, currency, exchangeRates, reload } =
    useAppData();
  const { canWriteCatalog } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [moduleMin, setModuleMin] = useState("");
  const [moduleMax, setModuleMax] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const list = templates.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (categoryFilter && !productCategoryLinks.some((l) => l.template_id === t.id && l.category_id === categoryFilter)) return false;
    if (moduleMin && !(t.module_count != null && t.module_count >= parseFloat(moduleMin))) return false;
    if (moduleMax && !(t.module_count != null && t.module_count <= parseFloat(moduleMax))) return false;
    if (areaMin && !(t.area_m2 >= parseFloat(areaMin))) return false;
    if (areaMax && !(t.area_m2 <= parseFloat(areaMax))) return false;
    if (priceMin || priceMax) {
      const total = templateTotalUah(t);
      if (total == null) return false;
      if (priceMin && total < parseFloat(priceMin)) return false;
      if (priceMax && total > parseFloat(priceMax)) return false;
    }
    return true;
  });

  function openModal(t) {
    if (!canWriteCatalog) return;
    setEditingTemplate(t);
    setModalOpen(true);
  }

  function toggleCompare(id, checked) {
    if (checked) {
      if (compareSelection.length >= 3) return;
      setCompareSelection([...compareSelection, id]);
    } else {
      setCompareSelection(compareSelection.filter((x) => x !== id));
    }
  }

  async function moveTemplate(id, dir) {
    const idx = templates.findIndex((t) => t.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= templates.length) return;
    const a = templates[idx];
    const b = templates[swapIdx];
    await Promise.all([
      supabase.from("product_templates").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("product_templates").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await reload(true);
  }

  return (
    <div>
      <div className="filters-row">
        <div className="filter-field">
          <label>Статус</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Всі статуси</option>
            <option value="active">Активний</option>
            <option value="draft">Чернетка</option>
            <option value="archived">Архів</option>
          </select>
        </div>
        <div className="filter-field">
          <label>Категорія (ціль)</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Всі категорії</option>
            {productCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label>К-сть модулів</label>
          <div className="filter-range">
            <input type="number" placeholder="від" value={moduleMin} onChange={(e) => setModuleMin(e.target.value)} />
            <span>–</span>
            <input type="number" placeholder="до" value={moduleMax} onChange={(e) => setModuleMax(e.target.value)} />
          </div>
        </div>
        <div className="filter-field">
          <label>Площа, м²</label>
          <div className="filter-range">
            <input type="number" placeholder="від" value={areaMin} onChange={(e) => setAreaMin(e.target.value)} />
            <span>–</span>
            <input type="number" placeholder="до" value={areaMax} onChange={(e) => setAreaMax(e.target.value)} />
          </div>
        </div>
        <div className="filter-field">
          <label>Ціна, грн</label>
          <div className="filter-range">
            <input type="number" placeholder="від" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
            <span>–</span>
            <input type="number" placeholder="до" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
          </div>
        </div>
        {canWriteCatalog && (
          <button className="btn primary" style={{ marginLeft: "auto" }} onClick={() => openModal(null)}>+ Новий шаблон</button>
        )}
      </div>

      {!list.length ? (
        <div className="empty">Немає шаблонів за цим фільтром</div>
      ) : (
        <div className="grid">
          {list.map((t) => {
            const bom = bomItems.filter((b) => b.template_id === t.id);
            const cats = productCategoryLinks.filter((l) => l.template_id === t.id).map((l) => productCategories.find((c) => c.id === l.category_id)).filter(Boolean);
            const totalUah = templateTotalUah(t);
            const photo = templateFiles.filter((f) => f.template_id === t.id && f.kind === "photo").sort((a, b) => a.sort_order - b.sort_order)[0];
            return (
              <div className="card" key={t.id} onClick={() => openModal(t)}>
                <div className="card-photo">
                  {photo ? <img src={photo.url} alt={t.name} /> : "фото модуля"}
                </div>
                <h3>{t.name}</h3>
                <div className="row">
                  <span>{cats.map((c) => <span className="tag" key={c.id}>{c.name}</span>)}{!cats.length && "—"}</span>
                  <span className={`badge ${t.status}`}>{statusLabels[t.status] || t.status}</span>
                </div>
                <div className="row"><span>Площа</span><span>{t.area_m2} м²{t.module_count ? ` · ${t.module_count} модулі` : ""}</span></div>
                {totalUah != null ? (
                  <div className="cost-block">
                    <div className="cost-main">{fmtCurrency(totalUah, currency, exchangeRates)}</div>
                    <div className="cost-sub">{fmtCurrency(t.base_cost_per_m2, currency, exchangeRates)}/м²</div>
                  </div>
                ) : (
                  <div className="cost-block cost-missing">{bom.length ? "ціна неповна" : "BOM не заповнено"}</div>
                )}
                <div className="row" onClick={(e) => e.stopPropagation()} style={{ alignItems: "center" }}>
                  <label className="compare-check" style={{ marginTop: 0 }}>
                    <input
                      type="checkbox"
                      checked={compareSelection.includes(t.id)}
                      onChange={(e) => toggleCompare(t.id, e.target.checked)}
                    />
                    порівняти
                  </label>
                  {canWriteCatalog && (
                    <div className="reorder-mini">
                      <button type="button" onClick={() => moveTemplate(t.id, -1)} title="Вище">▲</button>
                      <button type="button" onClick={() => moveTemplate(t.id, 1)} title="Нижче">▼</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TemplateModal
        open={modalOpen}
        template={editingTemplate}
        onClose={() => setModalOpen(false)}
        onSaved={() => setModalOpen(false)}
        onDuplicated={(newTemplate) => setEditingTemplate(newTemplate)}
      />
    </div>
  );
}
