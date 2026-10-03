"use client";

// «Додати свій товар»: вставляєш посилання на товар — система відкриває сторінку й заповнює назву, опис, фото й ціну.
// Чого не знайшлось (або сайт не пускає сервер) — дописуєш сам. Зберігається матеріал (або ціна до наявного),
// постачальник за адресою сайту (новий створюється сам) і його ціна з посиланням у примітці.
import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { savePrice, ensureSupplierHasCategory } from "@/lib/prices";
import { guessMaterialIcon } from "@/lib/materialIcon";
import { fmtPrice } from "@/lib/market";
import SearchCombobox from "@/components/SearchCombobox";

const EMPTY = { url: "", name: "", description: "", image: "", price: "", unit: "", categoryId: "", supplierId: "", newSupplier: "", existingId: "" };
const hostOf = (u) => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, ""); } catch { return ""; } };

export default function AddProductModal({ open, onClose, onSaved }) {
  const { supabase, materials, materialCategories, materialUnits, suppliers, supplierCategoryLinks, reload } = useAppData();
  const { canWriteCatalog, canWriteFinance, profile, user } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [found, setFound] = useState(null); // що знайшлось на сторінці
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((v) => ({ ...v, ...patch }));

  const existing = materials.find((m) => m.id === f.existingId) || null;
  // схожі товари за назвою — щоб не завести дубль, а додати ціну до наявного
  const similar = useMemo(() => {
    const words = f.name.toLowerCase().split(/[^a-zа-яіїєґ0-9×x]+/i).filter((w) => w.length > 2).slice(0, 6);
    if (words.length < 2 || existing) return [];
    return materials
      .map((m) => ({ m, hits: words.filter((w) => m.name.toLowerCase().includes(w)).length }))
      .filter((x) => x.hits >= Math.min(3, words.length))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3)
      .map((x) => x.m);
  }, [f.name, materials, existing]);

  if (!open) return null;

  function close() {
    setF(EMPTY); setFound(null); setNote(""); setError("");
    onClose();
  }

  // постачальник за адресою сайту: шукаємо за полем «сайт», інакше пропонуємо створити з назвою сайту
  function matchSupplier(url, siteName) {
    const host = hostOf(url);
    const s = host && suppliers.find((x) => x.website && hostOf(x.website) === host);
    return s ? { supplierId: s.id, newSupplier: "" } : { supplierId: "", newSupplier: siteName || host };
  }

  async function fill() {
    if (!f.url.trim()) { setError("Встав посилання на товар."); return; }
    setLoading(true); setError(""); setNote("");
    try {
      const res = await fetch("/api/price-parser/product", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: f.url.trim() }) });
      const json = await res.json().catch(() => ({}));
      const supplier = matchSupplier(json.url || f.url, json.product?.site);
      if (!res.ok || json.error) {
        set({ ...supplier });
        setNote(json.error || `Помилка ${res.status}`);
        setFound(null);
      } else {
        const p = json.product;
        setFound(p);
        set({
          url: json.url || f.url,
          name: f.name || p.name || "",
          description: f.description || p.description || "",
          image: f.image || p.image || "",
          price: f.price || (p.price && (!p.currency || /UAH|грн/i.test(p.currency)) ? String(p.price) : ""),
          ...supplier,
        });
        const missing = [!p.name && "назву", !p.price && "ціну", !p.image && "фото", !p.description && "опис"].filter(Boolean);
        if (p.price && p.currency && !/UAH|грн/i.test(p.currency)) missing.push(`ціну в гривнях (на сайті ${p.price} ${p.currency})`);
        const guessed = p.price && p.priceGuessed ? " Ціну взято з тексту сторінки — звір із сайтом." : "";
        setNote((missing.length ? `На сторінці не знайшлось: ${missing.join(", ")} — допиши сам.` : "Заповнено зі сторінки. Перевір одиницю й категорію — їх сайт не знає.") + guessed);
      }
    } catch (e) {
      setNote(`Сторінку не вдалося відкрити: ${e.message}. Заповни поля вручну.`);
    }
    setLoading(false);
  }

  async function createUnit(text) {
    const maxOrder = materialUnits.length ? Math.max(...materialUnits.map((u) => u.sort_order)) : 0;
    const { error: e } = await supabase.from("material_units").insert([{ name: text, sort_order: maxOrder + 1 }]);
    if (e) { setError(e.message); return null; }
    await reload(true);
    return text;
  }

  async function save() {
    const price = parseFloat(String(f.price).replace(",", "."));
    if (!existing && (!f.name.trim() || !f.unit.trim())) return setError("Заповни назву й одиницю виміру.");
    if (!f.supplierId && !f.newSupplier.trim()) return setError("Вкажи постачальника — де цей товар продають.");
    if (f.price && !(price > 0)) return setError("Ціна має бути числом більшим за нуль.");
    setSaving(true); setError("");
    try {
      // 1) постачальник
      let supplierId = f.supplierId;
      if (!supplierId) {
        const host = hostOf(f.url);
        const { data, error: e } = await supabase.from("suppliers").insert([{ name: f.newSupplier.trim(), website: host ? `https://${host}/` : null }]).select().single();
        if (e) throw e;
        supplierId = data.id;
      }
      // 2) матеріал: новий або наявний (тоді лише доповнюємо порожні опис і фото)
      let materialId = existing?.id;
      if (!materialId) {
        const { data, error: e } = await supabase.from("materials").insert([{
          name: f.name.trim(), unit: f.unit.trim(), category_id: f.categoryId || null, icon: guessMaterialIcon(f.name) || null,
          spec: f.description.trim() || null, image_url: f.image.trim() || null,
        }]).select().single();
        if (e) throw e;
        materialId = data.id;
      } else {
        const patch = {};
        if (!existing.spec && f.description.trim()) patch.spec = f.description.trim();
        if (!existing.image_url && f.image.trim()) patch.image_url = f.image.trim();
        if (Object.keys(patch).length) {
          const { error: e } = await supabase.from("materials").update(patch).eq("id", materialId);
          if (e) throw e;
        }
      }
      // 3) ціна з посиланням на товар у примітці
      if (price > 0) {
        const updatedBy = profile?.full_name || user?.email || null;
        const title = (found?.name || f.name).trim();
        const { error: e } = await savePrice(supabase, { supplierId, materialId, price, updatedBy, note: [title, f.url.trim()].filter(Boolean).join(" · ") });
        if (e) throw e;
        await ensureSupplierHasCategory(supabase, { supplierId, materialId, materials: [...materials, { id: materialId, category_id: existing?.category_id ?? (f.categoryId || null) }], supplierCategoryLinks });
      }
      await reload(true);
      onSaved?.(materialId);
      close();
    } catch (e) {
      setError(e.message || String(e));
    }
    setSaving(false);
  }

  const supplierOptions = suppliers.map((s) => ({ id: s.id, label: s.name }));
  const unitOptions = materialUnits.map((u) => ({ id: u.name, label: u.name }));

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <h2>Додати свій товар</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Посилання на товар</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="text" style={{ flex: 1, minWidth: 0 }} value={f.url} placeholder="https://… сторінка товару в інтернет-магазині" autoFocus
              onChange={(e) => set({ url: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") fill(); }} />
            <button className="btn primary" disabled={loading} onClick={fill}>{loading ? "Читаю сторінку…" : "Заповнити"}</button>
          </div>
          {note && <p className="note" style={{ margin: "6px 0 0" }}>{note}</p>}
        </div>

        {canWriteCatalog && (
          <div className="form-row">
            <label>Додати до наявного товару <span className="note">(необов&apos;язково — якщо такий матеріал уже є в довіднику)</span></label>
            <SearchCombobox value={f.existingId} options={materials.map((m) => ({ id: m.id, label: `${m.name} (${m.unit})` }))} onChange={(id) => set({ existingId: id || "" })} placeholder="новий товар" />
            {similar.length > 0 && (
              <p className="note" style={{ margin: "6px 0 0" }}>
                Схожі вже є: {similar.map((m, i) => (
                  <span key={m.id}>{i > 0 && ", "}<button type="button" className="link-btn" onClick={() => set({ existingId: m.id })}>{m.name}</button></span>
                ))} — клацни, щоб додати ціну до нього.
              </p>
            )}
          </div>
        )}

        {!existing && (
          <>
            <div className="form-row">
              <label>Назва</label>
              <input type="text" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="напр. Фанера ФСФ 18 мм 1525×1525" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-row">
                <label>Категорія</label>
                <select value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                  <option value="">— без категорії —</option>
                  {materialCategories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Одиниця виміру (за що ціна)</label>
                <SearchCombobox value={f.unit} options={unitOptions} onChange={(v) => set({ unit: v })} onCreate={createUnit} placeholder="шт, м², м³, м.п., рулон…" />
              </div>
            </div>
          </>
        )}

        <div className="form-row">
          <label>Опис</label>
          <textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Розміри, сорт, виробник — щоб не сплутати з іншим" />
        </div>

        <div className="form-row">
          <label>Фото — адреса картинки</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="text" style={{ flex: 1, minWidth: 0 }} value={f.image} onChange={(e) => set({ image: e.target.value })} placeholder="https://…" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.image && <img src={f.image} alt="" className="thumb" />}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="form-row">
            <label>Постачальник</label>
            {f.supplierId || !f.newSupplier ? (
              <SearchCombobox value={f.supplierId} options={supplierOptions} onChange={(id) => set({ supplierId: id || "" })}
                onCreate={canWriteCatalog ? async (text) => { set({ newSupplier: text, supplierId: "" }); return null; } : undefined}
                createLabel={(text) => `+ Новий постачальник «${text}»`} placeholder="де продають" />
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <input type="text" style={{ flex: 1, minWidth: 0 }} value={f.newSupplier} onChange={(e) => set({ newSupplier: e.target.value })} title="Новий постачальник — створиться при збереженні" />
                <button type="button" className="btn small" title="Обрати з наявних" onClick={() => set({ newSupplier: "" })}>з наявних</button>
              </div>
            )}
            {!f.supplierId && f.newSupplier && <span className="note" style={{ marginTop: 4 }}>новий — створиться при збереженні</span>}
          </div>
          <div className="form-row">
            <label>Ціна, грн за {existing?.unit || f.unit || "одиницю"}</label>
            <input type="number" value={f.price} onChange={(e) => set({ price: e.target.value })} disabled={!canWriteFinance} placeholder={canWriteFinance ? "напр. 1250" : "ціну вносить адмін або бухгалтер"} />
            {found?.price != null && <span className="note" style={{ marginTop: 4 }}>на сайті: {fmtPrice(found.price)} {found.currency && !/UAH|грн/i.test(found.currency) ? found.currency : "грн"} — перевір, чи це за {existing?.unit || f.unit || "обрану одиницю"}</span>}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={close} disabled={saving}>Скасувати</button>
          <button className="btn primary" onClick={save} disabled={saving || loading}>{saving ? "Збереження…" : "Зберегти товар"}</button>
        </div>
      </div>
    </div>
  );
}
