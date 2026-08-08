"use client";

import MaterialCategoriesPanel from "@/components/panels/MaterialCategoriesPanel";

export default function MaterialCategoriesModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2>Категорії матеріалів / постачальників</h2>
        <MaterialCategoriesPanel />
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}
