"use client";

// Картка цін матеріалу: опис і фото, зведення (мін / середня / макс) і всі ціни постачальників із правкою.
// Відкривається з «Цін постачальників» — у списках правки немає, вона тут. Викликати з key={materialId}.
import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { priceStats, money } from "@/lib/priceStats";
import ManualPricesPanel from "@/components/panels/ManualPricesPanel";
import SupplierContactsModal from "@/components/modals/SupplierContactsModal";
import SupplierModal from "@/components/modals/SupplierModal";

export default function MaterialPricesModal({ materialId, supplierId = null, onClose }) {
  const { supabase, materials, materialCategories, supplierPrices, currency, exchangeRates, showDecimals, reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  const material = materials.find((m) => m.id === materialId);
  const [editing, setEditing] = useState(false);
  const [spec, setSpec] = useState("");
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contactsId, setContactsId] = useState(null);
  const [fullSupplier, setFullSupplier] = useState(null);

  if (!material) return null;

  const category = materialCategories.find((c) => c.id === material.category_id);
  const st = priceStats(supplierPrices.filter((p) => p.material_id === material.id));
  const fmt = (v) => money(v, currency, exchangeRates, showDecimals);
  const per = currency === "UAH" ? ` грн/${material.unit}` : ` за ${material.unit}`;

  function startEdit() {
    setSpec(material.spec || "");
    setImage(material.image_url || "");
    setEditing(true);
  }

  async function saveInfo() {
    setSaving(true);
    setError("");
    const { error: e } = await supabase.from("materials").update({ spec: spec.trim() || null, image_url: image.trim() || null }).eq("id", material.id);
    if (e) setError(e.message);
    else { await reload(true); setEditing(false); }
    setSaving(false);
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2 style={{ marginBottom: 8 }}>
          {material.icon ? `${material.icon} ` : ""}{material.name} <span className="note">· {material.unit}{category ? ` · ${category.name}` : ""}</span>
        </h2>
        {error && <div className="auth-error">{error}</div>}

        {editing ? (
          <div style={{ marginBottom: 12 }}>
            <div className="form-row">
              <label>Опис</label>
              <textarea rows={3} value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="Що це за матеріал: розміри, сорт, виробник — щоб не сплутати з іншим" />
            </div>
            <div className="form-row">
              <label>Фото — адреса картинки</label>
              <input type="text" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn small primary" disabled={saving} onClick={saveInfo}>{saving ? "Збереження…" : "Зберегти опис"}</button>
              <button className="btn small" disabled={saving} onClick={() => setEditing(false)}>Скасувати</button>
            </div>
          </div>
        ) : (
          <div className="mat-info">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {material.image_url && <img src={material.image_url} alt="" />}
            <div>
              {material.spec ? <p className="note" style={{ margin: 0 }}>{material.spec}</p> : <p className="note" style={{ margin: 0 }}>Опису ще немає.</p>}
              {canWriteCatalog && <button className="btn small" style={{ marginTop: 6 }} onClick={startEdit}>✎ Опис і фото</button>}
            </div>
          </div>
        )}

        <div className="stat-row">
          <span>Постачальників: <b>{st.n}</b></span>
          {st.n === 1 && <span>ціна: <b>{fmt(st.min)}</b></span>}
          {st.n > 1 && (
            <>
              <span>найнижча: <b className="fresh">{fmt(st.min)}</b></span>
              <span>середня: <b>{fmt(st.avg)}</b></span>
              <span>найвища: <b>{fmt(st.max)}</b></span>
            </>
          )}
          {st.n > 0 && <span className="note" style={{ marginTop: 0 }}>{per.trim()}</span>}
        </div>

        <ManualPricesPanel material={material} all highlight={supplierId} onContacts={setContactsId} />

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрити</button>
        </div>
      </div>

      <SupplierContactsModal supplierId={contactsId} onClose={() => setContactsId(null)} onOpenFull={(s) => { setContactsId(null); setFullSupplier(s); }} />
      <SupplierModal open={!!fullSupplier} supplier={fullSupplier} onClose={() => setFullSupplier(null)} onSaved={() => setFullSupplier(null)} />
    </div>
  );
}
