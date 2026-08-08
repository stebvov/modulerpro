"use client";

import ProductCategoriesPanel from "@/components/panels/ProductCategoriesPanel";
import MaterialCategoriesPanel from "@/components/panels/MaterialCategoriesPanel";

export default function CategoriesScreen() {
  return (
    <div>
      <div className="table-scroll">
      <div className="cat-columns" style={{ minWidth: 640 }}>
        <div className="cat-col">
          <ProductCategoriesPanel />
        </div>
        <div className="cat-col">
          <MaterialCategoriesPanel />
        </div>
      </div>
      </div>
    </div>
  );
}
