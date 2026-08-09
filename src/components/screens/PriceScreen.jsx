"use client";

import { useState } from "react";
import PriceByMaterialScreen from "@/components/screens/PriceByMaterialScreen";
import PriceBySupplierScreen from "@/components/screens/PriceBySupplierScreen";
import PriceAuditScreen from "@/components/screens/PriceAuditScreen";

export default function PriceScreen() {
  const [view, setView] = useState("material");

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
      </div>
      {view === "material" && <PriceByMaterialScreen />}
      {view === "supplier" && <PriceBySupplierScreen />}
      {view === "audit" && <PriceAuditScreen />}
    </div>
  );
}
