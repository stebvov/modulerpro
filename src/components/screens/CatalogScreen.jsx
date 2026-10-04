"use client";
import SearchFilter from "@/components/SearchFilter";
import SelectSearch from "@/components/SelectSearch";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { statusLabels, templateTotalUah, fmtCurrency } from "@/lib/format";
import { templateProductionCost } from "@/lib/crm";
import TemplateModal from "@/components/modals/TemplateModal";
import FolderTree, { dragItem, inFolder, useFolders } from "@/components/catalog/FolderTree";
import OrderButtons from "@/components/catalog/OrderButtons";
import { BulkBar, useMultiSelect } from "@/components/catalog/MultiSelect";
import CatalogDictionaries from "@/components/catalog/CatalogDictionaries";
import SettingsButton from "@/components/SettingsButton";
import { swapOrder } from "@/lib/reorder";
import CompareScreen from "@/components/screens/CompareScreen";

// 1 модуль, 2 модулі, 5 модулів
function modulesWord(n) {
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return "модуль";
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "модулі";
  return "модулів";
}

const STATUS_OPTIONS = [{ value: "active", label: "Активний" }, { value: "draft", label: "Чернетка" }, { value: "archived", label: "Архів" }];

export default function CatalogScreen() {
  const { supabase, templates, bomItems, extraCosts, supplierPrices, siteModels, templateFiles, currency, exchangeRates, showDecimals, reload } =
    useAppData();
  const folders = useFolders("models");
  const ms = useMultiSelect();
  const [dictOpen, setDictOpen] = useState(false);
  const [folder, setFolder] = useState("");
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [formats, setFormats] = useState([]);
  useEffect(() => {
    supabase.from("module_formats").select("*").order("sort_order").order("name").then(({ data }) => setFormats(data || []));
  }, [supabase, dictOpen]);
  const [moduleMin, setModuleMin] = useState("");
  const [moduleMax, setModuleMax] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [compareSelection, setCompareSelection] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  const q = search.trim().toLowerCase();
  const list = templates.filter((t) => {
    if (q && !(t.name || "").toLowerCase().includes(q)) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (formatFilter && (formatFilter === "none" ? t.module_format_id : t.module_format_id !== formatFilter)) return false;
    if (!inFolder(folders, t.folder_id, folder)) return false;
    const moduleCount = t.module_count ?? 0;
    if (moduleMin && moduleCount < parseFloat(moduleMin)) return false;
    if (moduleMax && moduleCount > parseFloat(moduleMax)) return false;
    const area = t.area_m2 ?? 0;
    if (areaMin && area < parseFloat(areaMin)) return false;
    if (areaMax && area > parseFloat(areaMax)) return false;
    if (priceMin || priceMax) {
      const total = templateTotalUah(t) ?? 0;
      if (priceMin && total < parseFloat(priceMin)) return false;
      if (priceMax && total > parseFloat(priceMax)) return false;
    }
    return true;
  });

  const activeCount = [statusFilter, formatFilter, moduleMin || moduleMax, areaMin || areaMax, priceMin || priceMax].filter(Boolean).length;

  function resetFilters() {
    setStatusFilter("");
    setFormatFilter("");
    setModuleMin("");
    setModuleMax("");
    setAreaMin("");
    setAreaMax("");
    setPriceMin("");
    setPriceMax("");
  }

  function nonNegative(value) {
    if (value === "") return "";
    const n = parseFloat(value);
    if (Number.isNaN(n)) return "";
    return String(Math.max(0, n));
  }

  function openModal(t) {
    if (!canWriteCatalog) return;
    setEditingTemplate(t);
    setModalOpen(true);
  }

  function toggleCompare(id, checked) {
    if (checked) {
      if (compareSelection.length >= 3) return;
      setCompareSelection([...compareSelection, id]);
    } else {
      setCompareSelection(compareSelection.filter((x) => x !== id));
    }
  }

  // порядок — у межах того, що зараз видно (папка, фільтри): міняємо місцями з сусідом
  async function moveTemplate(id, dir) {
    const idx = list.findIndex((t) => t.id === id);
    const b = list[idx + dir];
    if (idx < 0 || !b) return;
    await swapOrder(supabase, "product_templates", templates, list[idx], b);
    await reload(true);
  }
  async function moveToFolder(id, folderId) {
    await supabase.from("product_templates").update({ folder_id: folderId || null }).eq("id", id);
    await reload(true);
  }
  async function moveManyToFolder(ids, folderId) {
    await supabase.from("product_templates").update({ folder_id: folderId || null }).in("id", ids);
    await reload(true);
  }

  return (
    <div>
      <div className="toolbar">
        {!showCompare && (
          <SearchFilter value={search} onChange={setSearch} placeholder="Пошук моделі…" active={activeCount} onReset={resetFilters}>
            <SelectSearch value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} placeholder="Усі статуси" emptyLabel="Усі статуси" width={160} ariaLabel="Статус" />
            <SelectSearch value={formatFilter} options={[...formats.map((f) => ({ value: f.id, label: `📐 ${f.name}` })), { value: "none", label: "формат не вказано" }]} onChange={setFormatFilter} placeholder="Усі формати модулів" emptyLabel="Усі формати модулів" width={200} ariaLabel="Формат модулів" />
            <div className="sf-range"><span>Модулі</span>
              <input type="number" min="0" placeholder="від" aria-label="Модулів від" value={moduleMin} onChange={(e) => setModuleMin(nonNegative(e.target.value))} />
              <span>–</span>
              <input type="number" min="0" placeholder="до" aria-label="Модулів до" value={moduleMax} onChange={(e) => setModuleMax(nonNegative(e.target.value))} />
            </div>
            <div className="sf-range"><span>Площа, м²</span>
              <input type="number" min="0" placeholder="від" aria-label="Площа від" value={areaMin} onChange={(e) => setAreaMin(nonNegative(e.target.value))} />
              <span>–</span>
              <input type="number" min="0" placeholder="до" aria-label="Площа до" value={areaMax} onChange={(e) => setAreaMax(nonNegative(e.target.value))} />
            </div>
            <div className="sf-range"><span>Ціна, грн</span>
              <input type="number" min="0" placeholder="від" aria-label="Ціна від" value={priceMin} onChange={(e) => setPriceMin(nonNegative(e.target.value))} />
              <span>–</span>
              <input type="number" min="0" placeholder="до" aria-label="Ціна до" value={priceMax} onChange={(e) => setPriceMax(nonNegative(e.target.value))} />
            </div>
          </SearchFilter>
        )}
        <div className="toolbar-actions">
          <button className={`seg-btn${showCompare ? " active" : ""}`} onClick={() => setShowCompare((v) => !v)} title="Порівняти до 3 моделей">
            ⇄ Порівняти{compareSelection.length ? ` (${compareSelection.length})` : ""}
          </button>
          {canWriteCatalog && <SettingsButton title="Довідники: прайс собівартості, типи обʼєкта" onClick={() => setDictOpen(true)} />}
          {canWriteCatalog && (
            <button className="btn primary" onClick={() => openModal(null)}>+ Нова модель</button>
          )}
        </div>
      </div>

      {showCompare && <CompareScreen compareSelection={compareSelection} />}

      {!showCompare && (
      <div className="cat-layout">
      <FolderTree scope="models" items={templates} selected={folder} onSelect={setFolder} canEdit={canWriteCatalog} onMoveItem={moveToFolder} />
      <main>
      {canWriteCatalog && list.length > 1 && !ms.selecting && <p className="sel-hint">Щоб перемістити кілька моделей — натисніть і притримайте картку (на компʼютері — Ctrl + клік), позначте інші й оберіть папку.</p>}
      {!list.length ? (
        <div className="empty">Немає моделей за цим пошуком і фільтром</div>
      ) : (
        <div className="grid">
          {list.map((t) => {
            const bom = bomItems.filter((b) => b.template_id === t.id);
            const fold = folders.find((f) => f.id === t.folder_id);
            const li = list.indexOf(t);
            const totalUah = templateTotalUah(t);
            const costUah = canWriteCatalog ? templateProductionCost(t.id, bomItems, extraCosts, supplierPrices, templates) : 0;
            const onSite = siteModels.filter((m) => m.template_id === t.id);
            const terraceM2 = Math.round((t.terraces || []).reduce((s, x) => s + (Number(x.area) || 0), 0) * 100) / 100;
            const photo = templateFiles.filter((f) => f.template_id === t.id && f.kind === "photo").sort((a, b) => a.sort_order - b.sort_order)[0];
            return (
              <div className="card" key={t.id} {...dragItem(t.id, canWriteCatalog && !ms.selecting)} {...ms.bind(t.id, () => openModal(t), canWriteCatalog)}>
                <div className="card-photo">
                  {photo ? <img src={photo.url} alt={t.name} loading="lazy" decoding="async" /> : "фото модуля"}
                </div>
                <h3>{t.name}</h3>
                {onSite.length > 0 && (
                  <div className="row"><span className="tag tag--site" title="Ця модель показана на сайті">на сайті: {onSite.map((m) => m.name).join(", ")}</span></div>
                )}
                <div className="row">
                  <span>{fold ? <span className="folder-tag">📁 {fold.name}</span> : <span className="note" style={{ margin: 0 }}>без папки</span>}</span>
                  <span className={`badge ${t.status}`}>{statusLabels[t.status] || t.status}</span>
                </div>
                <div className="row"><span>Площа</span><span>{t.area_m2} м²{terraceM2 ? ` + тераса ${terraceM2} м²` : ""}{t.module_count ? ` · ${t.module_count} ${modulesWord(t.module_count)}` : ""}{formats.find((f) => f.id === t.module_format_id) ? ` ${formats.find((f) => f.id === t.module_format_id).name}` : ""}</span></div>
                {(t.bedrooms != null || t.bathrooms != null || t.height_m || t.floors > 1) && (
                  <div className="row"><span>{(t.object_types || []).join(", ") || "Параметри"}</span><span>{[t.bedrooms != null && (t.bedrooms ? `${t.bedrooms} сп.` : "студія"), t.bathrooms != null && `${t.bathrooms} с/в`, t.floors > 1 && `${t.floors} пов.`, t.height_m && `h ${t.height_m} м`].filter(Boolean).join(" · ")}</span></div>
                )}
                {totalUah != null ? (
                  <div className="cost-block">
                    <div className="cost-main">{fmtCurrency(totalUah, currency, exchangeRates, showDecimals)}</div>
                    <div className="cost-sub">{fmtCurrency(t.base_cost_per_m2, currency, exchangeRates, showDecimals)}/м²</div>
                    {costUah > 0 && (
                      <div className="cost-sub" title={t.cost_note || undefined}>
                        собівартість {fmtCurrency(costUah, currency, exchangeRates, false)}
                        {Number(t.markup_percent) ? ` · націнка ${Number(t.markup_percent)}%` : " · без націнки"}
                        {t.cost_mode === "fixed" ? " · за прайсом" : ""}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="cost-block cost-missing">{t.cost_mode === "fixed" ? "собівартість не вказана" : bom.length ? "ціна неповна" : "BOM не заповнено"}</div>
                )}
                <div className="row" onClick={(e) => e.stopPropagation()} style={{ alignItems: "center" }}>
                  <label className="compare-check" style={{ marginTop: 0 }}>
                    <input
                      type="checkbox"
                      checked={compareSelection.includes(t.id)}
                      onChange={(e) => toggleCompare(t.id, e.target.checked)}
                    />
                    порівняти
                  </label>
                  {canWriteCatalog && (
                    <OrderButtons onMove={(d) => moveTemplate(t.id, d)} first={li === 0} last={li === list.length - 1} disabled={!!q} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <BulkBar ms={ms} scope="models" allIds={list.map((t) => t.id)} onMove={moveManyToFolder} />
      </main>
      </div>
      )}

      {dictOpen && <CatalogDictionaries onClose={() => setDictOpen(false)} />}
      <TemplateModal
        open={modalOpen}
        template={editingTemplate}
        onClose={() => setModalOpen(false)}
        onSaved={() => setModalOpen(false)}
        onDuplicated={(newTemplate) => setEditingTemplate(newTemplate)}
      />
    </div>
  );
}
