"use client";

import { useState } from "react";
import { useFinanceData } from "@/context/FinanceDataContext";
import SearchCombobox from "@/components/SearchCombobox";
import { TRANSACTION_TYPES, todayInput } from "@/lib/finance";

export default function TransactionModal({ open, onClose, onSaved }) {
  const { supabase, deals, sites, reload } = useFinanceData();
  const [type, setType] = useState(TRANSACTION_TYPES[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInput());
  const [dealId, setDealId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const isOffice = type === "витрата-офіс";
  const dealOptions = deals.map((d) => ({ id: d.id, label: d.leadName || d.id.slice(0, 8) }));

  function resetAndClose() {
    setType(TRANSACTION_TYPES[0]);
    setAmount("");
    setDate(todayInput());
    setDealId("");
    setSiteId("");
    setCategory("");
    setNote("");
    setError("");
    onClose();
  }

  async function handleSave() {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) { setError("Вкажи суму більше нуля."); return; }
    if (!date) { setError("Вкажи дату."); return; }
    setSaving(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const payload = {
        type,
        amount: numAmount,
        currency: "UAH",
        date,
        deal_id: isOffice ? null : dealId || null,
        site_id: isOffice ? siteId || null : null,
        category: category.trim() || null,
        note: note.trim() || null,
        created_by: user?.id || null,
      };
      const { error: e } = await supabase.from("transactions").insert([payload]);
      if (e) throw e;
      await reload();
      onSaved?.();
      resetAndClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && resetAndClose()}>
      <div className="modal">
        <h2>Нова транзакція</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Тип</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Сума (грн)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {isOffice ? (
          <div className="form-row">
            <label>Майданчик</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Без прив&apos;язки — загальноадміністративні витрати</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="note" style={{ marginTop: 4 }}>
              Ці витрати автоматично розподіляються між будинками пропорційно площі та часу у виробництві.
            </div>
          </div>
        ) : (
          <div className="form-row">
            <label>Угода (необов&apos;язково)</label>
            <SearchCombobox value={dealId} options={dealOptions} placeholder="Без прив'язки до угоди" onChange={setDealId} />
          </div>
        )}

        <div className="form-row">
          <label>Категорія (необов&apos;язково)</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="напр. оренда, зп, реклама" />
        </div>
        <div className="form-row">
          <label>Коментар (необов&apos;язково)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={resetAndClose} disabled={saving}>Скасувати</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </div>
    </div>
  );
}
