"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { statusLabels } from "@/lib/format";
import { serviceTemplateUnitPrice } from "@/lib/crm";
import ServiceTemplateModal from "@/components/modals/ServiceTemplateModal";

export default function ServiceTemplatesScreen() {
  const { serviceTemplates, serviceTemplateItems, services } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const list = serviceTemplates.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  function openModal(t) {
    if (!canWriteCatalog) return;
    setEditing(t);
    setModalOpen(true);
  }

  return (
    <div>
      <p className="note">Шаблони послуг — набори послуг, які можна одразу додати в замовлення клієнта, аналогічно шаблонам будинків.</p>
      <div className="toolbar">
        <div className="toolbar-left">
          <input type="text" className="search-input" placeholder="Пошук шаблону..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {canWriteCatalog && (
          <button className="btn primary" onClick={() => openModal(null)}>+ Новий шаблон</button>
        )}
      </div>

      {!list.length ? (
        <div className="empty">Немає шаблонів послуг</div>
      ) : (
        <div className="grid">
          {list.map((t) => {
            const items = serviceTemplateItems.filter((i) => i.service_template_id === t.id);
            const total = serviceTemplateUnitPrice(t.id, serviceTemplateItems, services, serviceTemplates);
            return (
              <div className="card" key={t.id} onClick={() => openModal(t)}>
                <h3>{t.name}</h3>
                <div className="row"><span>{items.length} послуг</span><span className={`badge ${t.status}`}>{statusLabels[t.status] || t.status}</span></div>
                <div className="cost-block">
                  <div className="cost-main">{total.toLocaleString("uk-UA")} грн</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ServiceTemplateModal open={modalOpen} template={editing} onClose={() => setModalOpen(false)} onSaved={() => setModalOpen(false)} />
    </div>
  );
}
