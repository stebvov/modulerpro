"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";

const ALL_GROUPS = [
  { key: "crm", label: "CRM" },
  { key: "production", label: "Виробництво" },
  { key: "services", label: "Послуги" },
  { key: "marketing", label: "Маркетинг" },
  { key: "catalog", label: "Каталог" },
  { key: "finance", label: "Фінанси" },
  { key: "admin", label: "Адміністрування" },
];

export default function MenuSettingsScreen() {
  const { supabase, menuGroupOrder, menuHomeGroup, reload } = useAppData();
  const [order, setOrder] = useState([]);
  const [homeGroup, setHomeGroup] = useState("catalog");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const known = ALL_GROUPS.map((g) => g.key);
    const savedOrder = (menuGroupOrder || []).filter((k) => known.includes(k));
    const missing = known.filter((k) => !savedOrder.includes(k));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder([...savedOrder, ...missing]);
    setHomeGroup(menuHomeGroup || "catalog");
  }, [menuGroupOrder, menuHomeGroup]);

  function move(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    const { error: e } = await supabase.from("app_menu_settings").update({ group_order: order, home_group: homeGroup }).eq("id", true);
    if (e) { setError(e.message); setSaving(false); return; }
    await reload(true);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div>
      <p className="note">Порядок пунктів бічного меню та вкладка, яка відкривається одразу після входу.</p>
      {error && <div className="auth-error">{error}</div>}

      <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Порядок меню</div>
      {order.map((key, i) => {
        const g = ALL_GROUPS.find((x) => x.key === key);
        return (
          <div key={key} className="cat-item">
            <div className="cat-reorder">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} title="Вище">▲</button>
              <button type="button" disabled={i === order.length - 1} onClick={() => move(i, 1)} title="Нижче">▼</button>
            </div>
            <span style={{ flex: 1, fontSize: 13 }}>{g?.label || key}</span>
          </div>
        );
      })}

      <div className="form-row" style={{ marginTop: 16, maxWidth: 320 }}>
        <label>Головний пункт (відкривається після входу)</label>
        <select value={homeGroup} onChange={(e) => { setHomeGroup(e.target.value); setSaved(false); }}>
          {ALL_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
      </div>

      <button className="btn primary" onClick={save} disabled={saving} style={{ marginTop: 12 }}>
        {saving ? "Збереження..." : saved ? "Збережено ✓" : "Зберегти"}
      </button>
    </div>
  );
}
