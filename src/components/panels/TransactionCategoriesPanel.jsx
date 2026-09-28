"use client";

import { useFinanceData } from "@/context/FinanceDataContext";
import { useAuth } from "@/context/AuthContext";
import TreeCategoriesPanel from "@/components/panels/TreeCategoriesPanel";

// Категорії фінансів — деревом (вкладені) і за типом транзакції: у журналі показуються лише ті,
// що підходять до обраного типу (доходи / виготовлення / OPEX / CAPEX) або універсальні.
export default function TransactionCategoriesPanel({ onBack }) {
  const { reload } = useFinanceData();
  const { canWriteFinance } = useAuth();
  return (
    <TreeCategoriesPanel table="transaction_categories" title="Категорії фінансів" canWrite={canWriteFinance} withKind
      renameCascade={(sb, from, to) => sb.from("transactions").update({ category: to }).eq("category", from)}
      onChanged={() => reload(true)} onBack={onBack} addPlaceholder="Нова категорія: напр. Оренда офісу" />
  );
}
