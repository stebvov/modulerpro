"use client";

import { useState } from "react";
import { useFinanceData } from "@/context/FinanceDataContext";
import { useAuth } from "@/context/AuthContext";

export default function TransactionCategoriesPanel({ onBack }) {
  const { supabase, transactionCategories, allTransactions, reload } = useFinanceData();
  const { canWriteFinance } = useAuth();
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");

  function usageCount(name) {
    return allTransactions.filter((t) => t.category === name).length;
  }

  async function renameCategory(cat, value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === cat.name) return;
    setError("");
    try {
      const { error: e } = await supabase.from("transaction_categories").update({ name: trimmed }).eq("id", cat.id);
      if (e) throw e;
      await supabase.from("transactions").update({ category: trimmed }).eq("category", cat.name);
      await reload(true);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function deleteCategory(cat) {
    if (usageCount(cat.name) > 0) { setError("Не можна видалити категорію, яка використовується транзакціями."); return; }
    if (!confirm(`Видалити категорію «${cat.name}»?`)) return;
    setError("");
    const { error: e } = await supabase.from("transaction_categories").delete().eq("id", cat.id);
    if (e) { setError(e.message); return; }
    await reload(true);
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    const maxOrder = transactionCategories.length ? Math.max(...transactionCategories.map((c) => c.sort_order)) : 0;
    const { error: e } = await supabase.from("transaction_categories").insert([{ name: newCategory.trim(), sort_order: maxOrder + 1 }]);
    if (e) { setError(e.message); return; }
    setNewCategory("");
    await reload(true);
  }

  async function moveCategory(cat, dir) {
    const idx = transactionCategories.findIndex((c) => c.id === cat.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= transactionCategories.length) return;
    const a = transactionCategories[idx];
    const b = transactionCategories[swapIdx];
    await Promise.all([
      supabase.from("transaction_categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("transaction_categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await reload(true);
  }

  return (
    <div>
      <div className="cat-panel-header">
        {onBack && <button className="btn small" onClick={onBack}>← Назад</button>}
        <h3>Категорії транзакцій</h3>
      </div>
      <p className="note" style={{ marginTop: -4 }}>
        Перейменування застосується одразу до всіх транзакцій з цією категорією.
      </p>
      {error && <div className="auth-error">{error}</div>}
      {transactionCategories.map((c, i, arr) => (
        <div key={c.id} className="cat-item">
          {canWriteFinance && (
            <div className="cat-reorder">
              <button type="button" disabled={i === 0} onClick={() => moveCategory(c, -1)} title="Вище">▲</button>
              <button type="button" disabled={i === arr.length - 1} onClick={() => moveCategory(c, 1)} title="Нижче">▼</button>
            </div>
          )}
          <input
            type="text"
            className="rename-input"
            defaultValue={c.name}
            disabled={!canWriteFinance}
            onBlur={(e) => renameCategory(c, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          />
          <span className="note" style={{ minWidth: 90, marginTop: 0 }}>{usageCount(c.name)} транз.</span>
          {canWriteFinance && (
            <span className="icon-x" onClick={() => deleteCategory(c)}>×</span>
          )}
        </div>
      ))}
      {!transactionCategories.length && <div className="empty">Немає жодної категорії</div>}
      {canWriteFinance && (
        <div className="cat-add">
          <input
            type="text"
            placeholder="Нова категорія (напр. оренда, зп)"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button className="btn small" onClick={addCategory}>Додати</button>
        </div>
      )}
    </div>
  );
}
