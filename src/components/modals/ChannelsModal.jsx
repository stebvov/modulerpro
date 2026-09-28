"use client";

// ⚙ Канали реклами й контенту: додати, перейменувати, колір, вимкнути, видалити.
import { useState } from "react";
import { useMarketingData } from "@/context/MarketingDataContext";
import { deleteErrorText } from "@/components/DeleteButton";

const COLORS = [
  ["var(--accent)", "зелений"], ["var(--success)", "трав'яний"], ["var(--amber)", "бурштиновий"],
  ["var(--danger)", "червоний"], ["#5b3f8c", "фіолетовий"], ["#1f6fb2", "синій"], ["var(--text-secondary)", "сірий"],
];
const slug = (s) => s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 40);

export default function ChannelsModal({ open, onClose }) {
  const { supabase, channels, reload } = useMarketingData();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(null);
  if (!open) return null;

  async function upd(key, patch) {
    const { error } = await supabase.from("marketing_channels").update(patch).eq("key", key);
    setErr(error ? error.message : "");
    await reload(true);
  }
  async function add() {
    const label = name.trim();
    if (!label) return;
    const key = slug(label) || "канал_" + Date.now();
    const { error } = await supabase.from("marketing_channels").insert({ key, label, color: COLORS[channels.length % COLORS.length][0], sort: channels.length + 1 });
    if (error) { setErr(error.code === "23505" ? "Такий канал уже є" : error.message); return; }
    setName(""); setErr(""); await reload(true);
  }
  async function remove(key) {
    if (sure !== key) { setSure(key); setTimeout(() => setSure(null), 4000); return; }
    const { error } = await supabase.from("marketing_channels").delete().eq("key", key);
    setErr(error ? deleteErrorText(error).replace("запис", "канал") + " Можна просто вимкнути канал." : "");
    await reload(true);
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Канали реклами й контенту</h2>
        <p className="note" style={{ marginTop: 0 }}>Канал має збігатися з «Джерелом ліда» в CRM, щоб рахувалась ціна ліда. Вимкнений канал зникає з вибору, історія лишається.</p>
        {err && <div className="auth-error">{err}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {channels.map((c) => (
            <div key={c.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: c.color || "var(--text-secondary)", flex: "none" }} />
              <input defaultValue={c.label} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.label && upd(c.key, { label: e.target.value.trim() })} style={{ flex: 1 }} aria-label="Назва каналу" />
              <select value={c.color || ""} onChange={(e) => upd(c.key, { color: e.target.value })} style={{ width: 130 }} aria-label="Колір">
                {COLORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <label className="note" style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 0 }}>
                <input type="checkbox" checked={c.active} onChange={(e) => upd(c.key, { active: e.target.checked })} /> активний
              </label>
              <button type="button" className="btn small" style={{ color: "var(--danger)" }} onClick={() => remove(c.key)}>{sure === c.key ? "Точно?" : "🗑"}</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Новий канал: TikTok, OLX, YouTube…" style={{ flex: 1 }} />
          <button type="button" className="btn primary" onClick={add}>+ Канал</button>
        </div>
        <div className="modal-actions"><button className="btn" onClick={onClose}>Готово</button></div>
      </div>
    </div>
  );
}
