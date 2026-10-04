"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import MaterialTreeCombobox from "@/components/MaterialTreeCombobox";
import FileLightbox from "@/components/FileLightbox";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import { CURRENCIES, convert, fmtCurrency } from "@/lib/format";
import { priceFromCost, marginFromMarkup } from "@/lib/crm";
import { FolderSelect } from "@/components/catalog/FolderTree";
import { SIZE_GROUPS } from "@/lib/site/blocks";
import { slugify } from "@/lib/site/schemas";

// група площі для сайту — від площі будинку (як у базі: size_group_of)
const stamp = () => Date.now().toString(36);
const sizeGroupOf = (a) => (!(a > 0) ? null : a < 30 ? 1 : a < 50 ? 2 : a < 100 ? 3 : 4);

const FILE_COLLAPSE_THRESHOLD = 10;
const NO_GROUP = "__none";

function isPdf(f) {
  return (f.name || "").toLowerCase().endsWith(".pdf");
}

function emptyBomRow() {
  return { key: Math.random().toString(36).slice(2), material_id: "", quantity_per_unit: "", group_id: "", price_override: "" };
}
function emptyExtraRow(defaultGroupId) {
  return { key: Math.random().toString(36).slice(2), group_id: defaultGroupId || "", label: "", amount: "" };
}
// сума для поля вводу: без зайвих копійок
function toInput(n, decimals = true) {
  return n == null ? "" : String(decimals ? Math.round(Number(n) * 100) / 100 : Math.round(Number(n)));
}
const MAX_MODULES = 20;
const round2 = (n) => Math.round(n * 100) / 100;
function emptyTerrace() {
  return { key: Math.random().toString(36).slice(2), name: "", w: "", l: "", area: "", included: true };
}
const numOrNull = (v) => (v === "" || v == null || Number.isNaN(parseFloat(v)) ? null : parseFloat(v));
const intOrNull = (v) => (v === "" || v == null || Number.isNaN(parseInt(v, 10)) ? null : parseInt(v, 10));
const validSize = (m) => parseFloat(m?.w) > 0 && parseFloat(m?.l) > 0;
// площа за розмірами модулів — лише коли розміри вказано для всіх
function modulesArea(rows) {
  if (!rows.length || !rows.every(validSize)) return null;
  return round2(rows.reduce((s, m) => s + parseFloat(m.w) * parseFloat(m.l), 0));
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
    productCategoryLinks,
    bomItems,
    extraCosts,
    templateFiles,
    templates,
    currency,
    exchangeRates,
    showDecimals,
    siteModels,
    reload,
  } = useAppData();

  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [moduleCount, setModuleCount] = useState("");
  // розміри модулів (ширина × довжина, м): за замовчуванням усі однакові — тоді в modRows один рядок на всіх
  const [sameModules, setSameModules] = useState(true);
  const [modRows, setModRows] = useState([]);
  const [terraceRows, setTerraceRows] = useState([]);
  // параметри для сайту й CRM
  const [params, setParams] = useState({ height_m: "", floors: "", bedrooms: "", bathrooms: "" });
  const [objectTypes, setObjectTypes] = useState([]);
  const [objectTypeList, setObjectTypeList] = useState([]);
  const [priceList, setPriceList] = useState([]);
  const [priceListId, setPriceListId] = useState(null);
  const [formatId, setFormatId] = useState(null);
  const [formatList, setFormatList] = useState([]);
  const [folderId, setFolderId] = useState(null);
  const [siteBusy, setSiteBusy] = useState(false);
  const [status, setStatus] = useState("draft");
  // собівартість: з BOM або однією сумою за прайсом; ціна клієнту = собівартість × (1 + націнка) ÷ (1 − податок)
  const [costMode, setCostMode] = useState("bom");
  const [fixedCost, setFixedCost] = useState("");
  const [fixedCur, setFixedCur] = useState("UAH");
  const [fixedTouched, setFixedTouched] = useState(false);
  const [markup, setMarkup] = useState("");
  const [tax, setTax] = useState("");
  const [costNote, setCostNote] = useState("");
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
  const [pdfPreview, setPdfPreview] = useState(null);
  const [groupCollapsed, setGroupCollapsed] = useState(() => new Set());
  const [newGroupName, setNewGroupName] = useState("");

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
    const mods = Array.isArray(template?.modules) ? template.modules.map((m) => ({ w: String(m.w ?? ""), l: String(m.l ?? "") })) : [];
    const same = mods.every((m) => m.w === mods[0].w && m.l === mods[0].l);
    setModuleCount(template ? template.module_count ?? (mods.length || "") : "");
    setSameModules(same);
    setModRows(same ? mods.slice(0, 1) : mods);
    setTerraceRows(
      Array.isArray(template?.terraces)
        ? template.terraces.map((t) => ({ ...emptyTerrace(), name: t.name || "", w: t.w != null ? String(t.w) : "", l: t.l != null ? String(t.l) : "", area: t.area != null ? String(t.area) : "", included: t.included !== false }))
        : []
    );
    setStatus(template ? template.status : "draft");
    setFolderId(template?.folder_id || null);
    setParams({
      height_m: template?.height_m != null ? String(template.height_m) : "",
      floors: template?.floors != null ? String(template.floors) : "",
      bedrooms: template?.bedrooms != null ? String(template.bedrooms) : "",
      bathrooms: template?.bathrooms != null ? String(template.bathrooms) : "",
    });
    setObjectTypes(Array.isArray(template?.object_types) && template.object_types.length ? template.object_types : template?.object_type ? [template.object_type] : []);
    setPriceListId(template?.price_list_id || null);
    setFormatId(template?.module_format_id || null);
    supabase.from("module_formats").select("*").order("sort_order").order("name").then(({ data }) => setFormatList(data || []));
    // довідники: типи обʼєкта й прайс собівартості
    Promise.all([
      supabase.from("object_types").select("*").order("sort_order").order("name"),
      supabase.from("cost_price_list").select("*").order("sort_order").order("name"),
    ]).then(([o, pl]) => { setObjectTypeList(o.data || []); setPriceList(pl.data || []); });
    setCostMode(template?.cost_mode || "bom");
    setFixedCur(currency);
    setFixedCost(template?.fixed_cost != null ? toInput(convert(template.fixed_cost, currency, exchangeRates), showDecimals) : "");
    setFixedTouched(false);
    setMarkup(template && Number(template.markup_percent) ? String(Number(template.markup_percent)) : "");
    setTax(template && Number(template.tax_percent) ? String(Number(template.tax_percent)) : "");
    setCostNote(template?.cost_note || "");
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

  function addBomRowToGroup(groupId) {
    setBomRows((prev) => [...prev, { ...emptyBomRow(), group_id: groupId === NO_GROUP ? "" : groupId }]);
  }
  async function renameGroup(group, value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === group.name) return;
    await supabase.from("bom_groups").update({ name: trimmed }).eq("id", group.id);
    await reload(true);
  }
  async function addGroup() {
    if (!newGroupName.trim()) return;
    const nextSortOrder = bomGroups.length ? Math.max(...bomGroups.map((g) => g.sort_order ?? 0)) + 1 : 1;
    await supabase.from("bom_groups").insert([{ name: newGroupName.trim(), sort_order: nextSortOrder }]);
    setNewGroupName("");
    await reload(true);
  }
  async function deleteGroup(group) {
    if (!confirm(`Видалити групу «${group.name}»? Це вплине на всі шаблони, де вона використовується.`)) return;
    const { error: e } = await supabase.from("bom_groups").delete().eq("id", group.id);
    if (e) {
      setError("Не вдалося видалити: групу ще використовують матеріали або статті витрат (тут або в інших шаблонах).");
      return;
    }
    setBomRows((prev) => prev.map((r) => (r.group_id === group.id ? { ...r, group_id: "" } : r)));
    setExtraRows((prev) => prev.map((r) => (r.group_id === group.id ? { ...r, group_id: "" } : r)));
    await reload(true);
  }

  const bomTotal = bomRows.reduce((sum, r) => {
    const qty = parseFloat(r.quantity_per_unit);
    if (!r.material_id || !qty) return sum;
    const price = r.price_override.trim() !== "" ? parseFloat(r.price_override) : bestSupplierPrice(r.material_id);
    return sum + qty * (price || 0);
  }, 0);
  const extraTotal = extraRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  // Сума «за прайсом» зберігається в гривні. Поки поле не чіпали — лишаємо збережене значення,
  // щоб перегляд у доларах не зсував його на копійки через округлення.
  const fixedRate = Number(exchangeRates.find((r) => r.code === fixedCur)?.rate_to_uah) || 1;
  const fixedUah =
    fixedCost === "" || Number.isNaN(parseFloat(fixedCost))
      ? null
      : !fixedTouched && template?.fixed_cost != null
        ? Number(template.fixed_cost)
        : Math.round(parseFloat(fixedCost) * fixedRate * 100) / 100;
  const markupNum = Math.max(0, parseFloat(markup) || 0);
  const taxNum = Math.max(0, parseFloat(tax) || 0);
  const costUah = costMode === "fixed" ? fixedUah || 0 : bomTotal + extraTotal;
  const priceUah = priceFromCost(costUah, markupNum, taxNum);
  const areaForPrice = parseFloat(area) || 0;
  const money = (uah) => fmtCurrency(uah, currency, exchangeRates, false);

  const modCount = Math.min(MAX_MODULES, Math.max(0, parseInt(moduleCount, 10) || 0));
  const firstMod = modRows[0] || { w: "", l: "" };
  const modList = Array.from({ length: modCount }, (_, i) => (sameModules ? firstMod : modRows[i] || firstMod));
  const houseByModules = modulesArea(modList);
  const terraceTotal = round2(terraceRows.reduce((s, t) => s + (parseFloat(t.area) || 0), 0));

  // Кількість або розміри модулів змінились — площа будинку підлаштовується під них (далі її можна поправити вручну).
  function setModules(count, same, rows) {
    const n = Math.min(MAX_MODULES, Math.max(0, parseInt(count, 10) || 0));
    const first = rows[0] || { w: "", l: "" };
    const list = Array.from({ length: n }, (_, i) => (same ? first : rows[i] || first));
    setModuleCount(count);
    setSameModules(same);
    setModRows(same ? (rows.length ? [first] : []) : list);
    const a = modulesArea(list);
    if (a != null) setArea(String(a));
  }
  function editModule(i, patch) {
    if (sameModules) setModules(moduleCount, true, [{ ...firstMod, ...patch }]);
    else setModules(moduleCount, false, modList.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  }
  function editTerrace(key, patch) {
    setTerraceRows((prev) => prev.map((t) => {
      if (t.key !== key) return t;
      const next = { ...t, ...patch };
      // розміри вказано — площа рахується сама
      if (("w" in patch || "l" in patch) && validSize(next)) next.area = String(round2(parseFloat(next.w) * parseFloat(next.l)));
      return next;
    }));
  }
  function sizePayload() {
    return {
      module_count: modCount || null,
      modules: modList.every(validSize) ? modList.map((m) => ({ w: parseFloat(m.w), l: parseFloat(m.l) })) : [],
      terraces: terraceRows
        .filter((t) => parseFloat(t.area) > 0)
        .map((t) => ({ name: t.name.trim() || "Тераса", area: parseFloat(t.area), ...(validSize(t) ? { w: parseFloat(t.w), l: parseFloat(t.l) } : {}), included: t.included !== false })),
      height_m: numOrNull(params.height_m),
      floors: intOrNull(params.floors),
      object_types: objectTypes,
      object_type: objectTypes[0] || null,
      bedrooms: intOrNull(params.bedrooms),
      bathrooms: intOrNull(params.bathrooms),
      folder_id: folderId || null,
      module_format_id: formatId || null,
    };
  }

  // позиція прайсу → сума й валюта собівартості, підпис «звідки цифра»
  function pickPriceList(id) {
    setPriceListId(id || null);
    const p = priceList.find((x) => x.id === id);
    if (!p) return;
    setFixedCur(p.currency || "UAH");
    setFixedCost(String(Number(p.amount)));
    setFixedTouched(true);
    setCostNote([p.name, p.note].filter(Boolean).join(" · "));
  }
  function changeFixedCur(code) {
    setFixedCur(code);
    if (!fixedTouched && template?.fixed_cost != null) setFixedCost(toInput(convert(template.fixed_cost, code, exchangeRates), showDecimals));
  }
  function pricingPayload() {
    return {
      price_list_id: costMode === "fixed" ? priceListId || null : null,
      cost_mode: costMode,
      fixed_cost: fixedUah,
      markup_percent: markupNum,
      tax_percent: taxNum,
      cost_note: costNote.trim() || null,
    };
  }

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
    if (!name.trim() || !areaNum) {
      setError("Заповни назву і площу.");
      return;
    }
    if (taxNum >= 100) {
      setError("Податок має бути меншим за 100%.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        area_m2: areaNum,
        status,
        ...sizePayload(),
        ...pricingPayload(),
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
    if (!name.trim() || !areaNum) {
      setError("Заповни назву і площу перед дублюванням.");
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
          ...sizePayload(),
          ...pricingPayload(),
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

  const onSite = templateId ? (siteModels || []).filter((m) => m.template_id === templateId) : [];
  // картка на сайті з тими самими параметрами (база підтягне площу, модулі, спальні, габарити…), фото — з каталогу
  async function putOnSite() {
    setSiteBusy(true); setError("");
    try {
      await handleSaveQuiet();
      const base = slugify(name.trim()) || `model-${stamp()}`;
      const photos = photoFiles.map((f) => f.url);
      let slug = base;
      for (let k = 2; k < 20; k++) {
        const { data: ex } = await supabase.from("site_models").select("id").eq("slug", slug).maybeSingle();
        if (!ex) break;
        slug = `${base}-${k}`;
      }
      const { error: e } = await supabase.from("site_models").insert({
        name: name.trim(), slug, kind: "ready", template_id: templateId, currency: "USD", published: false, sync_params: true,
        photos, plans: [], features: [], highlights: [], sort: 999,
      });
      if (e) throw e;
      await reload(true);
      setError("");
      window.alert("Картку створено на сайті (поки прихована). Додайте ціни й опис: Сайт → Моделі на сайті.");
    } catch (err) {
      setError("Не вдалося розмістити на сайті: " + (err.message || String(err)));
    } finally {
      setSiteBusy(false);
    }
  }
  // зберегти параметри перед публікацією на сайт (без закриття)
  async function handleSaveQuiet() {
    const areaNum = parseFloat(area);
    if (!templateId || !name.trim() || !areaNum) return;
    const { error: e } = await supabase.from("product_templates").update({ name: name.trim(), area_m2: areaNum, status, ...sizePayload() }).eq("id", templateId);
    if (e) throw e;
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

        <details className="section-details" open>
          <summary>
            Параметри
            <span className="section-count">
              {" "}— {modCount ? `${modCount} мод. · ` : ""}{parseFloat(area) || "—"} м²{terraceTotal ? ` + тераси ${terraceTotal} м²` : ""}{SIZE_GROUPS[sizeGroupOf(parseFloat(area))] ? ` · ${SIZE_GROUPS[sizeGroupOf(parseFloat(area))]}` : ""}
            </span>
          </summary>
          <div className="section-body">
            <div className="price-pair">
              <div className="form-row">
                <label>Папка</label>
                <FolderSelect scope="models" value={folderId} onChange={setFolderId} width={220} />
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

            <div className="form-row">
              <label>Кількість модулів</label>
              <input
                type="number"
                step="1"
                min="1"
                max={MAX_MODULES}
                value={moduleCount}
                onChange={(e) => setModules(e.target.value, sameModules, sameModules ? modRows : modList)}
                placeholder="напр. 2"
                style={{ maxWidth: 140 }}
              />
            </div>

            <div className="form-row">
              <label>Формат модулів</label>
              <div className="tag-row" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {formatList.map((f) => (
                  <button key={f.id} type="button" className={`subtab${formatId === f.id ? " active" : ""}`}
                    onClick={() => {
                      const on = formatId === f.id;
                      setFormatId(on ? null : f.id);
                      // формат задає розмір усіх модулів (якщо вказано ширину й довжину)
                      if (!on && f.w && f.l) setModules(moduleCount || 1, true, [{ w: String(f.w), l: String(f.l) }]);
                    }}>📐 {f.name}</button>
                ))}
                {!formatList.length && <span className="note" style={{ margin: 0 }}>Довідник порожній — додайте формати в ⚙ Довідники → Формати модулів.</span>}
              </div>
            </div>

            {modCount > 0 && (
              <div className="form-row">
                <label>Розміри модулів, м (ширина × довжина)</label>
                {(sameModules ? [firstMod] : modList).map((m, i) => (
                  <div className="size-row" key={i}>
                    <span className="size-row__name">{sameModules ? (modCount > 1 ? `Кожен із ${modCount}` : "Модуль") : `Модуль ${i + 1}`}</span>
                    <input type="number" min="0" step="0.05" value={m.w} placeholder="3" aria-label="Ширина, м" onChange={(e) => editModule(i, { w: e.target.value })} />
                    <span>×</span>
                    <input type="number" min="0" step="0.05" value={m.l} placeholder="6.5" aria-label="Довжина, м" onChange={(e) => editModule(i, { l: e.target.value })} />
                    <span className="size-row__area">{validSize(m) ? `${round2(parseFloat(m.w) * parseFloat(m.l))} м²` : ""}</span>
                  </div>
                ))}
                {modCount > 1 && (
                  <label className="tag-check self-left">
                    <input type="checkbox" checked={sameModules} onChange={(e) => setModules(moduleCount, e.target.checked, e.target.checked ? [firstMod] : modList)} />
                    усі модулі однакові
                  </label>
                )}
                {houseByModules != null && Math.abs(houseByModules - (parseFloat(area) || 0)) > 0.01 && (
                  <span className="note">
                    За розмірами модулів виходить {houseByModules} м².{" "}
                    <button type="button" className="btn small" onClick={() => setArea(String(houseByModules))}>Підставити</button>
                  </span>
                )}
              </div>
            )}

            <div className="price-pair">
              <div className="form-row">
                <label>Площа будинку, м² {houseByModules != null && Math.abs(houseByModules - (parseFloat(area) || 0)) < 0.01 ? <span className="note" style={{ margin: 0 }}>· за модулями</span> : null}</label>
                <input type="number" step="0.1" value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Група площі (для сайту)</label>
                <input value={SIZE_GROUPS[sizeGroupOf(parseFloat(area))] || "—"} readOnly title="Рахується сама від площі будинку" />
              </div>
            </div>
            <div className="price-pair">
              <div className="form-row">
                <label>Висота, м</label>
                <input type="number" min="0" step="0.05" value={params.height_m} placeholder="напр. 3.2" onChange={(e) => setParams({ ...params, height_m: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Поверхів</label>
                <input type="number" min="1" step="1" value={params.floors} placeholder="1" onChange={(e) => setParams({ ...params, floors: e.target.value })} />
              </div>
            </div>
            <div className="price-pair">
              <div className="form-row">
                <label>Спалень (0 — студія)</label>
                <input type="number" min="0" step="1" value={params.bedrooms} onChange={(e) => setParams({ ...params, bedrooms: e.target.value })} />
              </div>
              <div className="form-row">
                <label>Санвузлів</label>
                <input type="number" min="0" step="1" value={params.bathrooms} onChange={(e) => setParams({ ...params, bathrooms: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <label>Тип обʼєкта <span className="note" style={{ margin: 0 }}>· можна кілька; список — ⚙ у Каталозі</span></label>
              <div className="tag-checks">
                {objectTypeList.map((o) => (
                  <label className="tag-check" key={o.id}>
                    <input type="checkbox" checked={objectTypes.includes(o.name)} onChange={(e) => setObjectTypes((v) => (e.target.checked ? [...v, o.name] : v.filter((x) => x !== o.name)))} />
                    {o.name}
                  </label>
                ))}
                {objectTypes.filter((x) => !objectTypeList.some((o) => o.name === x)).map((x) => (
                  <label className="tag-check" key={x}><input type="checkbox" checked onChange={() => setObjectTypes((v) => v.filter((y) => y !== x))} />{x}</label>
                ))}
              </div>
            </div>

            <div className="form-row">
              <label>Тераси</label>
              {terraceRows.map((t) => (
                <div className="size-row size-row--terrace" key={t.key}>
                  <input className="size-row__label" type="text" value={t.name} placeholder="Тераса" aria-label="Назва тераси" onChange={(e) => editTerrace(t.key, { name: e.target.value })} />
                  <input type="number" min="0" step="0.05" value={t.w} placeholder="ш" aria-label="Ширина тераси, м" onChange={(e) => editTerrace(t.key, { w: e.target.value })} />
                  <span>×</span>
                  <input type="number" min="0" step="0.05" value={t.l} placeholder="д" aria-label="Довжина тераси, м" onChange={(e) => editTerrace(t.key, { l: e.target.value })} />
                  <span>=</span>
                  <input type="number" min="0" step="0.1" value={t.area} placeholder="0" aria-label="Площа тераси, м²" onChange={(e) => editTerrace(t.key, { area: e.target.value })} />
                  <span>м²</span>
                  <label className="tag-check" title="Тераса входить у комплектацію й ціну"><input type="checkbox" checked={t.included !== false} onChange={(e) => editTerrace(t.key, { included: e.target.checked })} /> включена</label>
                  <span className="icon-x" title="Прибрати терасу" onClick={() => setTerraceRows((prev) => prev.filter((x) => x.key !== t.key))}>×</span>
                </div>
              ))}
              <button type="button" className="btn small self-left" onClick={() => setTerraceRows((prev) => [...prev, emptyTerrace()])}>+ Додати терасу</button>
            </div>

            <div className="price-summary">
              <div className="row"><span>Будинок</span><span>{parseFloat(area) ? `${round2(parseFloat(area))} м²` : "—"}</span></div>
              <div className="row"><span>Тераси{terraceRows.length > 1 ? ` (${terraceRows.length})` : ""}</span><span>{terraceTotal} м²</span></div>
              <div className="row price-summary__total"><span>Будинок + тераси</span><span>{round2((parseFloat(area) || 0) + terraceTotal)} м²</span></div>
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
                            <img src={f.url} alt={f.name || ""} loading="lazy" decoding="async" />
                          </button>
                        ) : isPdf(f) ? (
                          <button
                            type="button"
                            className="file-thumb-btn"
                            onClick={() => setPdfPreview(f)}
                            title={f.name || ""}
                          >
                            📄 {f.name || "PDF"}
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

          </div>
        </details>

        <details className="section-details" open>
          <summary>
            Собівартість і ціна
            <span className="section-count"> — {costUah > 0 ? `${money(costUah)} → ${money(priceUah)}` : "ще не пораховано"}</span>
          </summary>
          <div className="section-body">
            <div className="form-row">
              <label>Звідки собівартість</label>
              <select value={costMode} onChange={(e) => setCostMode(e.target.value)}>
                <option value="bom">З матеріалів і робіт (списки нижче)</option>
                <option value="fixed">Одна сума за прайсом</option>
              </select>
            </div>
            {costMode === "fixed" && (
              <>
                <div className="form-row">
                  <label>Позиція прайсу <span className="note" style={{ margin: 0 }}>· прайс — ⚙ у Каталозі; змінили суму в прайсі — оновиться в усіх моделях</span></label>
                  <select value={priceListId || ""} onChange={(e) => pickPriceList(e.target.value)}>
                    <option value="">— своя сума (без прайсу) —</option>
                    {priceList.map((p) => <option key={p.id} value={p.id}>{p.name} · {Number(p.amount).toLocaleString("uk-UA")} {CURRENCIES.find((c) => c.code === p.currency)?.symbol || p.currency}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <label>Собівартість будинку{priceListId ? " (з прайсу)" : ""}</label>
                  <div className="price-cost-row">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={fixedCost}
                      onChange={(e) => { setFixedCost(e.target.value); setFixedTouched(true); }}
                      disabled={!!priceListId}
                      placeholder="напр. 25700"
                    />
                    <select value={fixedCur} onChange={(e) => changeFixedCur(e.target.value)} aria-label="Валюта собівартості" disabled={!!priceListId}>
                      {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <label>Звідки цифра</label>
                  <input type="text" value={costNote} onChange={(e) => setCostNote(e.target.value)} placeholder="напр. Прайс 14.09.2026, 2 модулі 3 × 6,5" />
                </div>
              </>
            )}
            <div className="price-pair">
              <div className="form-row">
                <label>Націнка, %</label>
                <input type="number" min="0" step="1" value={markup} onChange={(e) => setMarkup(e.target.value)} placeholder="0" />
              </div>
              <div className="form-row">
                <label>Податок, %</label>
                <input type="number" min="0" max="99" step="0.5" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0" />
              </div>
            </div>
            {costUah > 0 ? (
              <div className="price-summary">
                <div className="row"><span>Собівартість</span><span>{money(costUah)}{areaForPrice ? ` · ${money(costUah / areaForPrice)}/м²` : ""}</span></div>
                <div className="row"><span>Прибуток{markupNum ? ` (націнка ${markupNum}% = маржа ${Math.round(marginFromMarkup(markupNum))}%)` : ""}</span><span>{money((costUah * markupNum) / 100)}</span></div>
                <div className="row"><span>Податок{taxNum ? ` (${taxNum}% від ціни)` : ""}</span><span>{money((priceUah * taxNum) / 100)}</span></div>
                <div className="row price-summary__total"><span>Ціна клієнту</span><span>{money(priceUah)}{areaForPrice ? ` · ${money(priceUah / areaForPrice)}/м²` : ""}</span></div>
              </div>
            ) : (
              <span className="note">{costMode === "fixed" ? "Вкажи собівартість — ціна порахується сама." : "Заповни матеріали й роботи нижче — ціна порахується сама."}</span>
            )}
            {costMode === "fixed" && bomTotal + extraTotal > 0 && (
              <span className="note">Матеріали й роботи нижче ({fmtUah(bomTotal + extraTotal)}) збережені, але в ціну зараз не входять — ціна рахується від суми за прайсом.</span>
            )}
          </div>
        </details>

        <details className="section-details">
          <summary>
            Матеріали (BOM)
            <span className="section-count"> — {bomRows.filter((r) => r.material_id).length} поз., {fmtUah(bomTotal)}</span>
          </summary>
          <div className="section-body">
            {[...bomGroups, { id: NO_GROUP, name: "Без групи" }].map((group) => {
              const groupRows = bomRows.filter((r) => (r.group_id || NO_GROUP) === group.id);
              const groupTotal = groupRows.reduce((sum, r) => {
                const qty = parseFloat(r.quantity_per_unit);
                if (!r.material_id || !qty) return sum;
                const price = r.price_override.trim() !== "" ? parseFloat(r.price_override) : bestSupplierPrice(r.material_id);
                return sum + qty * (price || 0);
              }, 0);
              const isReal = group.id !== NO_GROUP;
              const isCollapsed = groupCollapsed.has(group.id);
              return (
                <details
                  key={group.id}
                  className="section-details bom-group-block"
                  open={!isCollapsed}
                  onToggle={(e) => {
                    const nowOpen = e.target.open;
                    setGroupCollapsed((prev) => {
                      const next = new Set(prev);
                      if (nowOpen) next.delete(group.id);
                      else next.add(group.id);
                      return next;
                    });
                  }}
                >
                  <summary>
                    <span className="bom-group-summary-row">
                      {isReal ? (
                        <input
                          type="text"
                          className="rename-input bom-group-name"
                          defaultValue={group.name}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onBlur={(e) => renameGroup(group, e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        />
                      ) : (
                        <span className="bom-group-name">{group.name}</span>
                      )}
                      <span className="section-count">— {groupRows.filter((r) => r.material_id).length} поз., {fmtUah(groupTotal)}</span>
                      {isReal && (
                        <span
                          className="icon-x"
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); deleteGroup(group); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          title="Видалити групу"
                        >
                          ×
                        </span>
                      )}
                    </span>
                  </summary>
                  <div className="section-body">
                    {groupRows.map((r) => {
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
                          <select
                            className="bom-group-select"
                            value={r.group_id}
                            title="Перемістити в іншу групу"
                            onChange={(e) => updateBomRow(r.key, { group_id: e.target.value })}
                          >
                            <option value="">без групи</option>
                            {bomGroups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                          <span className="icon-x" onClick={() => removeBomRow(r.key)}>×</span>
                        </div>
                      );
                    })}
                    <button className="btn small" onClick={() => addBomRowToGroup(group.id)}>
                      + Додати матеріал сюди
                    </button>
                  </div>
                </details>
              );
            })}
            <div className="cat-add" style={{ marginTop: 10 }}>
              <input
                type="text"
                placeholder="Нова група (напр. Покрівля)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <button className="btn small" onClick={addGroup}>+ Нова група</button>
            </div>
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
          {templateId && (onSite.length ? (
            <a className="btn" href={`/?s=site-models&open=${onSite[0].slug}`} title="Відкрити картку моделі на сайті">🌐 На сайті{onSite.some((m) => !m.published) ? " (приховано)" : ""}</a>
          ) : (
            <button className="btn" onClick={putOnSite} disabled={saving || siteBusy} title="Створити картку моделі на сайті з тими ж параметрами й фото (спершу прихована)">🌐 Розмістити на сайті</button>
          ))}
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
      <PdfPreviewModal file={pdfPreview} onClose={() => setPdfPreview(null)} />
    </div>
  );
}
