"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { statusLabels, templateTotalUah, fmtCurrency } from "@/lib/format";
import TemplateModal from "@/components/modals/TemplateModal";

export default function CatalogScreen({ compareSelection, setCompareSelection }) {
  const { templates, bomItems, productCategoryLinks, productCategories, templateFiles, currency, exchangeRates } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const list = templates.filter((t) => !statusFilter || t.status === statusFilter);

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

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Всі статуси</option>
            <option value="active">Активний</option>
            <option value="draft">Чернетка</option>
            <option value="archived">Архів</option>
          </select>
        </div>
        {canWriteCatalog && (
          <button className="btn primary" onClick={() => openModal(null)}>+ Новий шаблон</button>
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
            const photo = templateFiles.find((f) => f.template_id === t.id && f.kind === "photo");
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
                <div className="row"><span>Площа</span><span>{t.area_m2} м²</span></div>
                {totalUah != null ? (
                  <div className="cost-block">
                    <div className="cost-main">{fmtCurrency(totalUah, currency, exchangeRates)}</div>
                    <div className="cost-sub">{fmtCurrency(t.base_cost_per_m2, currency, exchangeRates)}/м²</div>
                  </div>
                ) : (
                  <div className="cost-block cost-missing">{bom.length ? "ціна неповна" : "BOM не заповнено"}</div>
                )}
                <label className="compare-check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={compareSelection.includes(t.id)}
                    onChange={(e) => toggleCompare(t.id, e.target.checked)}
                  />
                  порівняти
                </label>
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
      />
    </div>
  );
}
