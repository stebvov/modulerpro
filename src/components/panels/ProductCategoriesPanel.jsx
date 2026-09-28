"use client";

import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import TreeCategoriesPanel from "@/components/panels/TreeCategoriesPanel";

// Категорії моделей будинків — деревом (вкладені).
export default function ProductCategoriesPanel({ onBack }) {
  const { reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  return (
    <TreeCategoriesPanel table="product_categories" title="Категорії моделей будинків" canWrite={canWriteCatalog}
      onChanged={() => reload(true)} onBack={onBack} addPlaceholder="Нова категорія моделей" />
  );
}
