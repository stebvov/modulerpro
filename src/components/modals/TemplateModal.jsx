"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import MaterialTreeCombobox from "@/components/MaterialTreeCombobox";
import FileLightbox from "@/components/FileLightbox";

const FILE_COLLAPSE_THRESHOLD = 10;

function emptyBomRow() {
  return { key: Math.random().toString(36).slice(2), material_id: "", quantity_per_unit: "", group_id: "", price_override: "" };
}
function emptyExtraRow(defaultGroupId) {
  return { key: Math.random().toString(36).slice(2), group_id: defaultGroupId || "", label: "", amount: "" };
}
function fmtUah(n) {
  return Number(n || 0).toLocaleString("uk-UA", { maximumFractionDigits: 0 }) + " грн";
}

export default function TemplateModal({ open, template, onClose, onSaved, onDuplicated }) {
  const {
    supabase,
    materials,
    materialCategories,
    supplierPrices,
    bomGroups,
    productCategories,
    productCategoryLinks,
    bomItems,
    extraCosts,
    templateFiles,
    templates,
    reload,
  } = useAppData();

  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [moduleCount, setModuleCount] = useState("");
  const [status, setStatus] = useState("draft");
  const [selectedCats, setSelectedCats] = useState([]);
  const [bomRows, setBomRows] = useState([emptyBomRow()]);
  const [extraRows, setExtraRows] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [fileNote, setFileNote] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const [draggedFileId, setDraggedFileId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const laborGroup = bomGroups.find((g) => g.name === "Робота");

  const files = templateId
    ? templateFiles.filter((f) => f.template_id === templateId).slice().sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const photoFiles = files.filter((f) => f.kind === "photo");
  const coverPhotoId = photoFiles[0]?.id || null;

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setFileNote("");
    setUploadProgress(null);
    setLightboxIndex(null);
    setTemplateId(template ? template.id : null);
    setName(template ? template.name : "");
    setArea(template ? template.area_m2 : "");
    setModuleCount(template ? template.module_count ?? "" : "");
    setStatus(template ? template.status : "draft");
    setSelectedCats(
      template ? productCategoryLinks.filter((l) => l.template_id === template.id).map((l) => l.category_id) : []
    );
    const existingBom = template ? bomItems.filter((b) => b.template_id === template.id).sort((a, b) => a.sort_order - b.sort_order) : [];
    setBomRows(
      existingBom.length
        ? existingBom.map((b) => ({
            key: b.id,
            material_id: b.material_id,
            quantity_per_unit: b.quantity_per_unit,
            group_id: b.group_id || "",
            price_override: b.unit_price_override != null ? String(b.unit_price_override) : "",
          }))
        : [emptyBomRow()]
    );
    const existingExtra = template ? extraCosts.filter((e) => e.template_id === template.id) : [];
    setExtraRows(existingExtra.map((e) => ({ key: e.id, group_id: e.group_id || "", label: e.label, amount: e.amount })));
    const existingFileCount = template ? templateFiles.filter((f) => f.template_id === template.id).length : 0;
    setFilesCollapsed(existingFileCount > FILE_COLLAPSE_THRESHOLD);
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

  function bestSupplierPrice(materialId) {
    const rows = supplierPrices.filter((p) => p.material_id === materialId);
    if (!rows.length) return null;
    return Math.min(...rows.map((p) => Number(p.price)));
  }

  const bomTotal = bomRows.reduce((sum, r) => {
    const qty = parseFloat(r.quantity_per_unit);
    if (!r.material_id || !qty) return sum;
    const price = r.price_override.trim() !== "" ? parseFloat(r.price_override) : bestSupplierPrice(r.material_id);
    return sum + qty * (price || 0);
  }, 0);
  const extraTotal = extraRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  async function createMaterial(text) {
    const unit = (window.prompt(`Одиниця виміру для «${text}» (шт, м², м³, компл...)`, "шт") || "шт").trim() || "шт";
    const { data, error: e } = await supabase
      .from("materials")
      .insert([{ name: text, unit }])
      .select()
      .single();
    if (e) { setError(e.message); return null; }
    await reload(true);
    return data.id;
  }

  async function handleFileInput(e) {
    const chosen = [...e.target.files];
    if (!templateId) {
      setFileNote("Спершу збережи шаблон, потім додай файли.");
      e.target.value = "";
      return;
    }
    setUploadProgress({ done: 0, total: chosen.length });
    try {
      let done = 0;
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
        done += 1;
        setUploadProgress({ done, total: chosen.length });
      }
      setFileNote("Файли завантажено.");
      await reload(true);
    } catch (err) {
      setFileNote("Помилка завантаження: " + err.message);
    } finally {
      setUploadProgress(null);
      e.target.value = "";
    }
  }

  async function handleDeleteFile(fileId) {
    await supabase.from("template_files").delete().eq("id", fileId);
    await reload(true);
  }

  async function handleSetCover(fileId) {
    const minOrder = files.length ? Math.min(...files.map((f) => f.sort_order)) : 0;
    await supabase.from("template_files").update({ sort_order: minOrder - 1 }).eq("id", fileId);
    await reload(true);
  }

  async function handleFileReorder(targetId) {
    if (!draggedFileId || draggedFileId === targetId) { setDraggedFileId(null); return; }
    const ids = files.map((f) => f.id);
    const from = ids.indexOf(draggedFileId);
    const to = ids.indexOf(targetId);
    setDraggedFileId(null);
    if (from === -1 || to === -1) return;
    const reordered = [...ids];
    reordered.splice(from, 1);
    reordered.splice(to, 0, draggedFileId);
    await Promise.all(reordered.map((id, idx) => supabase.from("template_files").update({ sort_order: idx }).eq("id", id)));
    await reload(true);
  }

  function buildCleanBom() {
    return bomRows
      .filter((r) => r.material_id && parseFloat(r.quantity_per_unit) > 0)
      .map((r, idx) => ({
        material_id: r.material_id,
        quantity_per_unit: parseFloat(r.quantity_per_unit),
        unit: materials.find((m) => m.id === r.material_id)?.unit || "шт",
        group_id: r.group_id || null,
        sort_order: idx,
        unit_price_override: r.price_override.trim() === "" ? null : parseFloat(r.price_override),
      }));
  }
  function buildCleanExtra() {
    return extraRows
      .filter((r) => r.label.trim() && parseFloat(r.amount) >= 0)
      .map((r, idx) => ({
        group_id: r.group_id || null,
        label: r.label.trim(),
        amount: parseFloat(r.amount),
        sort_order: idx,
      }));
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
      const payload = {
        name: name.trim(),
        area_m2: areaNum,
        status,
        module_count: moduleCount === "" ? null : parseInt(moduleCount, 10),
      };
      let id = templateId;
      if (id) {
        const { error: updErr } = await supabase.from("product_templates").update(payload).eq("id", id);
        if (updErr) throw updErr;
      } else {
        const nextSortOrder = templates.length ? Math.max(...templates.map((t) => t.sort_order ?? 0)) + 1 : 1;
        const { data: created, error: insErr } = await supabase
          .from("product_templates")
          .insert([{ ...payload, sort_order: nextSortOrder }])
          .select()
          .single();
        if (insErr) throw insErr;
        id = created.id;
      }

      await supabase.from("product_category_links").delete().eq("template_id", id);
      if (selectedCats.length) {
        await supabase.from("product_category_links").insert(selectedCats.map((cid) => ({ template_id: id, category_id: cid })));
      }

      const cleanBom = buildCleanBom().map((r) => ({ ...r, template_id: id }));
      await supabase.from("template_bom_items").delete().eq("template_id", id);
      if (cleanBom.length) {
        const { error: bomErr } = await supabase.from("template_bom_items").insert(cleanBom);
        if (bomErr) throw bomErr;
      }

      const cleanExtra = buildCleanExtra().map((r) => ({ ...r, template_id: id }));
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

  async function handleDuplicate() {
    if (!templateId) return;
    setError("");
    const areaNum = parseFloat(area);
    if (!name.trim() || !areaNum || !selectedCats.length) {
      setError("Заповни назву, площу і хоча б одну категорію перед дублюванням.");
      return;
    }
    setSaving(true);
    try {
      const nextSortOrder = templates.length ? Math.max(...templates.map((t) => t.sort_order ?? 0)) + 1 : 1;
      const { data: created, error: insErr } = await supabase
        .from("product_templates")
        .insert([{
          name: `${name.trim()} (копія)`,
          area_m2: areaNum,
          module_count: moduleCount === "" ? null : parseInt(moduleCount, 10),
          status: "draft",
          sort_order: nextSortOrder,
        }])
        .select()
        .single();
      if (insErr) throw insErr;
      const newId = created.id;

      if (selectedCats.length) {
        await supabase.from("product_category_links").insert(selectedCats.map((cid) => ({ template_id: newId, category_id: cid })));
      }
      const cleanBom = buildCleanBom().map((r) => ({ ...r, template_id: newId }));
      if (cleanBom.length) await supabase.from("template_bom_items").insert(cleanBom);
      const cleanExtra = buildCleanExtra().map((r) => ({ ...r, template_id: newId }));
      if (cleanExtra.length) await supabase.from("template_extra_costs").insert(cleanExtra);

      await reload();
      onDuplicated?.(created);
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
      <div className="modal modal-lg">
        <h2>{templateId ? `Редагувати шаблон${name.trim() ? ": " + name.trim() : ""}` : "Новий шаблон"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Назва</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Компакт-модуль 14.11" />
        </div>

        <details className="section-details" open={!templateId}>
          <summary>Параметри шаблону <span className="section-count">— категорії, фото, площа, кількість модулів, статус</span></summary>
          <div className="section-body">
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
              <label>Фото і файли</label>
              <details
                className="section-details"
                open={!filesCollapsed}
                onToggle={(e) => setFilesCollapsed(!e.target.open)}
              >
                <summary>{files.length} файл(ів) <span className="section-count">— клік: галерея / перетягни: змінити порядок</span></summary>
                <div className="section-body">
                  <div className="file-list">
                    {files.map((f) => (
                      <div
                        className={`file-thumb${draggedFileId === f.id ? " dragging" : ""}`}
                        key={f.id}
                        style={{ position: "relative" }}
                        draggable
                        onDragStart={() => setDraggedFileId(f.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); handleFileReorder(f.id); }}
                      >
                        {f.kind === "photo" ? (
                          <button
                            type="button"
                            className="file-thumb-btn"
                            onClick={() => setLightboxIndex(photoFiles.findIndex((p) => p.id === f.id))}
                            title={f.name || ""}
                          >
                            <img src={f.url} alt={f.name || ""} />
                          </button>
                        ) : (
                          <a href={f.url} target="_blank" rel="noreferrer" title={f.name || ""}>
                            {f.name || "файл"}
                          </a>
                        )}
                        <span className="icon-x" onClick={() => handleDeleteFile(f.id)}>×</span>
                        {f.kind === "photo" && (
                          <button
                            type="button"
                            className={`cover-btn${f.id === coverPhotoId ? " is-cover" : ""}`}
                            title="Зробити головним фото"
                            onClick={() => handleSetCover(f.id)}
                          >
                            {f.id === coverPhotoId ? "★" : "☆"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <input type="file" multiple accept="image/*,.pdf,.dwg,.zip" onChange={handleFileInput} />
                  {uploadProgress && (
                    <span className="note upload-progress">
                      <span className="spinner" /> Завантаження... {uploadProgress.done}/{uploadProgress.total}
                    </span>
                  )}
                  {!uploadProgress && (
                    <span className="note">{fileNote || "Клікни на фото — галерея (стрілки/свайп). Перетягни, щоб змінити порядок. ☆ — зробити головним."}</span>
                  )}
                </div>
              </details>
            </div>

            <div className="form-row">
              <label>Площа, м²</label>
              <input type="number" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
            </div>

            <div className="form-row">
              <label>Кількість модулів</label>
              <input type="number" step="1" min="1" value={moduleCount} onChange={(e) => setModuleCount(e.target.value)} placeholder="напр. 2" />
            </div>

            <div className="form-row">
              <label>Статус</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">Чернетка</option>
                <option value="active">Активний</option>
                <option value="archived">Архів</option>
              </select>
            </div>
          </div>
        </details>

        <details className="section-details" open>
          <summary>
            Матеріали (BOM)
            <span className="section-count"> — {bomRows.filter((r) => r.material_id).length} поз., {fmtUah(bomTotal)}</span>
          </summary>
          <div className="section-body">
            {bomRows.map((r) => {
              const live = r.material_id ? bestSupplierPrice(r.material_id) : null;
              const priceTitle =
                r.price_override.trim() !== ""
                  ? "Своя ціна (не залежить від постачальників)"
                  : live != null
                    ? `Автоматично: ${live} грн (найдешевший постачальник)`
                    : "Немає ціни від постачальників — вкажи свою";
              return (
                <div className="bom-row-grid" key={r.key}>
                  <div className="reorder">
                    <span onClick={() => moveBomRow(r.key, -1)}>▲</span>
                    <span onClick={() => moveBomRow(r.key, 1)}>▼</span>
                  </div>
                  <MaterialTreeCombobox
                    value={r.material_id}
                    materials={materials}
                    materialCategories={materialCategories}
                    placeholder="Матеріал... (пошук або перегляд за категорією)"
                    onChange={(id) => updateBomRow(r.key, { material_id: id })}
                    onCreate={(text) => createMaterial(text)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="qty-input"
                    placeholder="к-сть"
                    value={r.quantity_per_unit}
                    onChange={(e) => updateBomRow(r.key, { quantity_per_unit: e.target.value })}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="price-input"
                    placeholder={live != null ? String(live) : "0"}
                    title={priceTitle}
                    value={r.price_override}
                    onChange={(e) => updateBomRow(r.key, { price_override: e.target.value })}
                  />
                  <select className="bom-group-select" value={r.group_id} onChange={(e) => updateBomRow(r.key, { group_id: e.target.value })}>
                    <option value="">без групи</option>
                    {bomGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <span className="icon-x" onClick={() => removeBomRow(r.key)}>×</span>
                </div>
              );
            })}
            <button className="btn small" onClick={() => setBomRows((p) => [...p, emptyBomRow()])}>
              + Додати матеріал
            </button>
          </div>
        </details>

        <details className="section-details">
          <summary>
            Робота, доставка та інші статті витрат
            <span className="section-count"> — {extraRows.length} поз., {fmtUah(extraTotal)}</span>
          </summary>
          <div className="section-body">
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
            <button className="btn small" onClick={() => setExtraRows((p) => [...p, emptyExtraRow(laborGroup?.id)])}>
              + Додати статтю витрат
            </button>
          </div>
        </details>

        <div className="modal-actions">
          {templateId && (
            <button className="btn danger" style={{ marginRight: "auto" }} onClick={handleDelete} disabled={saving}>
              Видалити
            </button>
          )}
          {templateId && (
            <button className="btn" onClick={handleDuplicate} disabled={saving}>
              Дублювати
            </button>
          )}
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </div>

      <FileLightbox
        photos={photoFiles}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}
