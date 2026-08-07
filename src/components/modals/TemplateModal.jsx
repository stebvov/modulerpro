"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";

function emptyBomRow() {
  return { key: Math.random().toString(36).slice(2), material_id: "", quantity_per_unit: "", group_id: "" };
}
function emptyExtraRow(defaultGroupId) {
  return { key: Math.random().toString(36).slice(2), group_id: defaultGroupId || "", label: "", amount: "" };
}

export default function TemplateModal({ open, template, onClose, onSaved }) {
  const { supabase, materials, bomGroups, productCategories, productCategoryLinks, bomItems, extraCosts, templateFiles, reload } =
    useAppData();

  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("draft");
  const [selectedCats, setSelectedCats] = useState([]);
  const [bomRows, setBomRows] = useState([emptyBomRow()]);
  const [extraRows, setExtraRows] = useState([]);
  const [files, setFiles] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [fileNote, setFileNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const laborGroup = bomGroups.find((g) => g.name === "Робота");

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setFileNote("");
    setTemplateId(template ? template.id : null);
    setName(template ? template.name : "");
    setArea(template ? template.area_m2 : "");
    setStatus(template ? template.status : "draft");
    setSelectedCats(
      template ? productCategoryLinks.filter((l) => l.template_id === template.id).map((l) => l.category_id) : []
    );
    const existingBom = template ? bomItems.filter((b) => b.template_id === template.id).sort((a, b) => a.sort_order - b.sort_order) : [];
    setBomRows(
      existingBom.length
        ? existingBom.map((b) => ({ key: b.id, material_id: b.material_id, quantity_per_unit: b.quantity_per_unit, group_id: b.group_id || "" }))
        : [emptyBomRow()]
    );
    const existingExtra = template ? extraCosts.filter((e) => e.template_id === template.id) : [];
    setExtraRows(existingExtra.map((e) => ({ key: e.id, group_id: e.group_id || "", label: e.label, amount: e.amount })));
    setFiles(template ? templateFiles.filter((f) => f.template_id === template.id) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template]);

  if (!open) return null;

  function toggleCategory(id) {
    setSelectedCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }
  function updateBomRow(key, patch) {
    setBomRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeBomRow(key) {
    setBomRows((prev) => prev.filter((r) => r.key !== key));
  }
  function moveBomRow(key, dir) {
    setBomRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }
  function updateExtraRow(key, patch) {
    setExtraRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeExtraRow(key) {
    setExtraRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function handleFileInput(e) {
    const chosen = [...e.target.files];
    if (!templateId) {
      setFileNote("Спершу збережи шаблон, потім додай файли.");
      e.target.value = "";
      return;
    }
    setFileNote("Завантаження...");
    try {
      for (const file of chosen) {
        const path = `${templateId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("template-files").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("template-files").getPublicUrl(path);
        const kind = file.type.startsWith("image/") ? "photo" : "file";
        const { error: insErr } = await supabase
          .from("template_files")
          .insert([{ template_id: templateId, url: pub.publicUrl, name: file.name, kind }]);
        if (insErr) throw insErr;
      }
      setFileNote("Файли завантажено.");
      await reload(true);
      setFiles((prev) => [...prev]);
    } catch (err) {
      setFileNote("Помилка завантаження: " + err.message);
    } finally {
      e.target.value = "";
    }
  }

  async function handleDeleteFile(fileId) {
    await supabase.from("template_files").delete().eq("id", fileId);
    await reload(true);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  async function handleSave() {
    setError("");
    const areaNum = parseFloat(area);
    if (!name.trim() || !areaNum || !selectedCats.length) {
      setError("Заповни назву, площу і хоча б одну категорію.");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), area_m2: areaNum, status };
      let id = templateId;
      if (id) {
        const { error: updErr } = await supabase.from("product_templates").update(payload).eq("id", id);
        if (updErr) throw updErr;
      } else {
        const { data: created, error: insErr } = await supabase.from("product_templates").insert([payload]).select().single();
        if (insErr) throw insErr;
        id = created.id;
      }

      await supabase.from("product_category_links").delete().eq("template_id", id);
      if (selectedCats.length) {
        await supabase.from("product_category_links").insert(selectedCats.map((cid) => ({ template_id: id, category_id: cid })));
      }

      const cleanBom = bomRows
        .filter((r) => r.material_id && parseFloat(r.quantity_per_unit) > 0)
        .map((r, idx) => ({
          template_id: id,
          material_id: r.material_id,
          quantity_per_unit: parseFloat(r.quantity_per_unit),
          unit: materials.find((m) => m.id === r.material_id)?.unit || "шт",
          group_id: r.group_id || null,
          sort_order: idx,
        }));
      await supabase.from("template_bom_items").delete().eq("template_id", id);
      if (cleanBom.length) {
        const { error: bomErr } = await supabase.from("template_bom_items").insert(cleanBom);
        if (bomErr) throw bomErr;
      }

      const cleanExtra = extraRows
        .filter((r) => r.label.trim() && parseFloat(r.amount) >= 0)
        .map((r, idx) => ({
          template_id: id,
          group_id: r.group_id || null,
          label: r.label.trim(),
          amount: parseFloat(r.amount),
          sort_order: idx,
        }));
      await supabase.from("template_extra_costs").delete().eq("template_id", id);
      if (cleanExtra.length) {
        const { error: extraErr } = await supabase.from("template_extra_costs").insert(cleanExtra);
        if (extraErr) throw extraErr;
      }

      await reload();
      onSaved?.();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!templateId || !confirm("Видалити шаблон разом з його BOM?")) return;
    setSaving(true);
    try {
      await supabase.from("product_templates").delete().eq("id", templateId);
      await reload();
      onSaved?.();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{templateId ? "Редагувати шаблон" : "Новий шаблон"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Фото і файли</label>
          <div className="file-list">
            {files.map((f) => (
              <div className="file-thumb" key={f.id}>
                {f.kind === "photo" ? <img src={f.url} alt={f.name || ""} /> : f.name || "файл"}
                <span className="icon-x" onClick={() => handleDeleteFile(f.id)}>×</span>
              </div>
            ))}
          </div>
          <input type="file" multiple accept="image/*,.pdf,.dwg,.zip" onChange={handleFileInput} />
          <span className="note">{fileNote}</span>
        </div>

        <div className="form-row">
          <label>Назва</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Компакт-модуль 14.11" />
        </div>

        <div className="form-row">
          <label>Категорії (можна декілька — напр. Дача + Кемпінг)</label>
          <div className="tag-checks">
            {productCategories.map((c) => (
              <label className="tag-check" key={c.id}>
                <input type="checkbox" checked={selectedCats.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label>Площа, м²</label>
          <input type="number" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Чернетка</option>
            <option value="active">Активний</option>
            <option value="archived">Архів</option>
          </select>
        </div>

        <h4>Матеріали (BOM)</h4>
        <div>
          {bomRows.map((r) => (
            <div className="bom-row" key={r.key}>
              <div className="reorder">
                <span onClick={() => moveBomRow(r.key, -1)}>▲</span>
                <span onClick={() => moveBomRow(r.key, 1)}>▼</span>
              </div>
              <select className="bom-group" value={r.group_id} onChange={(e) => updateBomRow(r.key, { group_id: e.target.value })}>
                <option value="">без групи</option>
                {bomGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <select
                className="bom-material"
                value={r.material_id}
                onChange={(e) => updateBomRow(r.key, { material_id: e.target.value })}
              >
                <option value="">— оберіть матеріал —</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="к-сть"
                value={r.quantity_per_unit}
                onChange={(e) => updateBomRow(r.key, { quantity_per_unit: e.target.value })}
              />
              <span className="icon-x" onClick={() => removeBomRow(r.key)}>×</span>
            </div>
          ))}
        </div>
        <button className="btn small" style={{ marginBottom: 14 }} onClick={() => setBomRows((p) => [...p, emptyBomRow()])}>
          + Додати матеріал
        </button>

        <h4>Робота, доставка та інші статті витрат</h4>
        <div>
          {extraRows.map((r) => (
            <div className="extra-row" key={r.key}>
              <select value={r.group_id} onChange={(e) => updateExtraRow(r.key, { group_id: e.target.value })}>
                <option value="">без групи</option>
                {bomGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <input
                className="label-input"
                type="text"
                placeholder="напр. Монтаж каркасу"
                value={r.label}
                onChange={(e) => updateExtraRow(r.key, { label: e.target.value })}
              />
              <input
                className="amount-input"
                type="number"
                placeholder="грн"
                value={r.amount}
                onChange={(e) => updateExtraRow(r.key, { amount: e.target.value })}
              />
              <span className="icon-x" onClick={() => removeExtraRow(r.key)}>×</span>
            </div>
          ))}
        </div>
        <button className="btn small" onClick={() => setExtraRows((p) => [...p, emptyExtraRow(laborGroup?.id)])}>
          + Додати статтю витрат
        </button>

        <div className="modal-actions">
          {templateId && (
            <button className="btn danger" style={{ marginRight: "auto" }} onClick={handleDelete} disabled={saving}>
              Видалити
            </button>
          )}
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </div>
    </div>
  );
}
