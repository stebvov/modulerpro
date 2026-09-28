"use client";

// Кнопка «Видалити» для будь-якої форми: другий натиск підтверджує (4 с на роздуми).
// Якщо запис уже використовується деінде (зовнішній ключ), пояснює людською мовою, де саме.
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const WHERE = {
  template_bom_items: "специфікаціях будинків (BOM)",
  supplier_prices: "цінах постачальників",
  supplier_price_history: "історії цін",
  materials: "матеріалах",
  deals: "угодах CRM",
  deal_services: "послугах в угодах",
  service_execution: "виконанні послуг (відвантаження і монтаж)",
  service_template_items: "шаблонах послуг",
  service_rate_cards: "тарифах послуг",
  transactions: "фінансах (транзакціях)",
  production_slots: "виробництві",
  town_lots: "лотах містечок",
  managed_objects: "об'єктах УК",
  tasks: "задачах пульту",
  project_sales: "продажах проєкту",
};

export function deleteErrorText(e) {
  if (!e) return "";
  if (e.code === "23503") {
    const t = (e.details || e.message || "").match(/table "([a-z_]+)"/)?.[1];
    return `Не можна видалити: запис використовується в ${WHERE[t] || t || "інших даних"}. Спершу приберіть або замініть його там.`;
  }
  if (e.code === "42501" || /row-level security|permission/i.test(e.message || "")) return "Немає прав на видалення — зверніться до адміністратора.";
  return "Не видалено: " + (e.message || String(e));
}

export default function DeleteButton({ table, id, what = "запис", before, onDone, onError, disabled }) {
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!id) return null;
  async function run() {
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 4000); return; }
    setBusy(true);
    const supabase = createClient();
    try {
      if (before) await before(supabase);
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      onDone?.();
    } catch (e) {
      onError?.(deleteErrorText(e));
    } finally {
      setBusy(false);
      setSure(false);
    }
  }
  return (
    <button type="button" className="btn" onClick={run} disabled={busy || disabled}
      style={{ marginRight: "auto", color: "var(--danger)", borderColor: sure ? "var(--danger)" : undefined }}
      title={`Видалити ${what} назавжди`}>
      {busy ? "Видалення…" : sure ? `Точно видалити ${what}?` : "🗑 Видалити"}
    </button>
  );
}
