"use client";

import ProductCategoriesPanel from "@/components/panels/ProductCategoriesPanel";

export default function ProductCategoriesModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Категорії товарів</h2>
        <ProductCategoriesPanel />
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}
