"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import PriceByMaterialScreen from "@/components/screens/PriceByMaterialScreen";
import PriceBySupplierScreen from "@/components/screens/PriceBySupplierScreen";
import PriceAuditScreen from "@/components/screens/PriceAuditScreen";
import AddProductModal from "@/components/modals/AddProductModal";
import MaterialPricesModal from "@/components/modals/MaterialPricesModal";

export default function PriceScreen() {
  const { canWriteCatalog } = useAuth();
  const [view, setView] = useState("material");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(null); // щойно доданий товар — показуємо його картку цін

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <div className="seg-row">
          <button className={`seg-btn${view === "material" ? " active" : ""}`} onClick={() => setView("material")}>
            За товаром
          </button>
          <button className={`seg-btn${view === "supplier" ? " active" : ""}`} onClick={() => setView("supplier")}>
            За постачальником
          </button>
          <button className={`seg-btn${view === "audit" ? " active" : ""}`} onClick={() => setView("audit")}>
            Огляд цін
          </button>
        </div>
        {canWriteCatalog && (
          <div className="toolbar-actions">
            <button className="btn primary" onClick={() => setAdding(true)} title="Вставити посилання на товар — назва, опис, фото й ціна заповняться самі">+ Додати свій товар</button>
          </div>
        )}
      </div>
      {view === "material" && <PriceByMaterialScreen />}
      {view === "supplier" && <PriceBySupplierScreen />}
      {view === "audit" && <PriceAuditScreen />}

      <AddProductModal open={adding} onClose={() => setAdding(false)} onSaved={(id) => setAdded(id)} />
      {added && <MaterialPricesModal key={added} materialId={added} onClose={() => setAdded(null)} />}
    </div>
  );
}
