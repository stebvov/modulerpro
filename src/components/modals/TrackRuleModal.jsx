"use client";

// Позиція для відстеження цін: матеріал + правило, за яким парсер упізнає його серед товарів магазинів.
import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { guessMaterialIcon } from "@/lib/materialIcon";
import { NORMS, LUMBER_TYPES, groupLabel, ruleToForm, formToRule, ruleError } from "@/lib/market";

export default function TrackRuleModal({ open, material, groups, onClose, onSaved }) {
  const { supabase, materialCategories, reload } = useAppData();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [spec, setSpec] = useState("");
  const [f, setF] = useState(ruleToForm(null));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setName(material?.name || "");
    setCategoryId(material?.category_id || materialCategories[0]?.id || "");
    setSpec(material?.spec || "");
    setF(ruleToForm(material?.parse_rule));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, material]);

  if (!open) return null;

  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const norm = NORMS.find((n) => n.id === f.norm) || NORMS[0];
  const unit = f.norm === "piece" && Number(f.per) > 1 ? `${Number(f.per)} шт` : material?.unit && material.parse_rule?.norm === f.norm ? material.unit : norm.unit;
  const toggleGroup = (g) => set({ groups: f.groups.includes(g) ? f.groups.filter((x) => x !== g) : [...f.groups, g] });
  const has = (...ids) => ids.includes(f.norm);

  async function save(rule) {
    if (!name.trim()) return setError("Заповни назву позиції.");
    if (rule) {
      const bad = ruleError(f);
      if (bad) return setError(bad);
    }
    setSaving(true);
    setError("");
    const payload = { name: name.trim(), category_id: categoryId, unit, spec: spec.trim() || null, parse_rule: rule };
    const res = material
      ? await supabase.from("materials").update(payload).eq("id", material.id)
      : await supabase.from("materials").insert([{ ...payload, icon: guessMaterialIcon(name) || null }]);
    setSaving(false);
    if (res.error) return setError(res.error.message);
    await reload(true);
    onSaved?.();
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2>{material ? "Позиція для відстеження цін" : "Нова позиція для відстеження цін"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div className="form-row">
            <label>Назва матеріалу (як у калькуляторі)</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Дошка 50×150 суха калібрована" />
          </div>
          <div className="form-row">
            <label>Категорія</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {materialCategories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <label>Що це за товар і як рахувати ціну — одиниця матеріалу: <b>{unit}</b></label>
          <select value={f.norm} onChange={(e) => set({ norm: e.target.value })}>
            {NORMS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label>Де шукати — групи сторінок магазинів</label>
          <div className="tag-checks">
            {groups.map((g) => (
              <label className="tag-check" key={g}>
                <input type="checkbox" style={{ width: "auto" }} checked={f.groups.includes(g)} onChange={() => toggleGroup(g)} /> {groupLabel(g)}
              </label>
            ))}
            {!groups.length && <span className="note" style={{ marginTop: 0 }}>Ще немає жодного джерела — додай сторінки магазинів у «Джерелах».</span>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-row">
            <label>Слова в назві товару — кожен рядок обовʼязковий, варіанти через |</label>
            <textarea rows={3} value={f.all} onChange={(e) => set({ all: e.target.value })} placeholder={"дошк|доск|брус\nсосн|ялин"} />
          </div>
          <div className="form-row">
            <label>Слова, з якими товар не підходить (через |)</label>
            <textarea rows={3} value={f.none} onChange={(e) => set({ none: e.target.value })} placeholder="терас|зрощ|дуб" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          {has("lumber") && (
            <>
              <div className="form-row" style={{ width: 200 }}>
                <label>Переріз, мм</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" value={f.a} onChange={(e) => set({ a: e.target.value })} placeholder="50" />
                  ×
                  <input type="number" value={f.b} onChange={(e) => set({ b: e.target.value })} placeholder="150" />
                </div>
              </div>
              <div className="form-row" style={{ width: 240 }}>
                <label>Стан</label>
                <select value={f.type} onChange={(e) => set({ type: e.target.value })}>
                  {LUMBER_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </>
          )}
          {has("pack_m3", "roll_m2", "sheet_m2", "board_m2") && (
            <div className="form-row" style={{ width: 200 }}>
              <label>Товщина, мм (від — до)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" value={f.thLo} onChange={(e) => set({ thLo: e.target.value })} />
                <input type="number" value={f.thHi} onChange={(e) => set({ thHi: e.target.value })} />
              </div>
            </div>
          )}
          {has("pack_m3", "roll_m2") && (
            <div className="form-row" style={{ width: 220 }}>
              <label>Щільність, {f.norm === "pack_m3" ? "кг/м³" : "г/м²"} (від — до)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" value={f.dLo} onChange={(e) => set({ dLo: e.target.value })} />
                <input type="number" value={f.dHi} onChange={(e) => set({ dHi: e.target.value })} />
              </div>
            </div>
          )}
          {has("roll_m2") && (
            <div className="form-row" style={{ width: 180 }}>
              <label>Вічко сітки не більше, мм</label>
              <input type="number" value={f.cellMax} onChange={(e) => set({ cellMax: e.target.value })} />
            </div>
          )}
          {has("piece") && (
            <div className="form-row" style={{ width: 180 }}>
              <label>Ціна за скільки штук</label>
              <input type="number" value={f.per} onChange={(e) => set({ per: e.target.value })} placeholder="1" />
            </div>
          )}
          <div className="form-row" style={{ width: 240 }}>
            <label>Ціна магазину — це</label>
            <select value={f.agg} onChange={(e) => set({ agg: e.target.value })}>
              <option value="min">найдешевша пропозиція</option>
              <option value="median">серединна серед пропозицій</option>
            </select>
          </div>
          <div className="form-row" style={{ width: 240 }}>
            <label>Правдоподібна ціна за {unit}, грн (від — до)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" value={f.min} onChange={(e) => set({ min: e.target.value })} />
              <input type="number" value={f.max} onChange={(e) => set({ max: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="form-row">
          <label>Примітка для команди</label>
          <input type="text" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="що саме беремо, на що зважати" />
        </div>
        <p className="note">Нова позиція зʼявиться з цінами після наступного щоденного обходу сайтів.</p>

        <div className="modal-actions">
          {material?.parse_rule && (
            <button className="btn" style={{ marginRight: "auto" }} disabled={saving} onClick={() => save(null)} title="Матеріал лишається в довіднику, парсер перестає його шукати">
              Не відстежувати
            </button>
          )}
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          <button className="btn primary" onClick={() => save(formToRule(f))} disabled={saving}>{saving ? "Збереження..." : "Зберегти"}</button>
        </div>
      </div>
    </div>
  );
}
