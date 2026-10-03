"use client";

// Картка товару: що це (назва, опис, фото, посилання) + ціни: на сайті продавця → наша ціна для клієнта.
// Ціна для клієнта — своя (фіксована) або ціна сайту + націнка %. Кнопка «Оновити з сайту» перечитує сторінку.
import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { fmtCurrency } from "@/lib/format";
import { CURS, hostOf, normCur, productPrices } from "@/lib/products";
import { FolderSelect, NO_FOLDER } from "./FolderTree";
import DeleteButton from "@/components/DeleteButton";

const EMPTY = { name: "", description: "", url: "", site: "", image: "", unit: "шт", source_price: "", source_currency: "UAH", price_mode: "markup", markup_percent: "", client_price: "", client_currency: "UAH", folder_id: null, status: "active", note: "" };

// сторінка товару → поля картки
export async function readProductPage(url) {
  const res = await fetch("/api/price-parser/product", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) return { error: json.error || `Помилка ${res.status}`, url: json.url || url };
  const p = json.product || {};
  const missing = [!p.name && "назву", !p.price && "ціну", !p.image && "фото", !p.description && "опис"].filter(Boolean);
  return {
    url: json.url || url,
    fields: {
      name: p.name || "", description: p.description || "", image: p.image || "", site: p.site || hostOf(json.url || url),
      source_price: p.price != null ? String(p.price) : "", source_currency: normCur(p.currency),
    },
    note: (missing.length ? `На сторінці не знайшлось: ${missing.join(", ")} — допишіть самі.` : "Заповнено зі сторінки.") + (p.price && p.priceGuessed ? " Ціну взято з тексту сторінки — звірте із сайтом." : ""),
  };
}

export default function ProductModal({ product, prefill, defaultFolder, onClose, onSaved, canEdit, nextSort }) {
  const { supabase, currency, exchangeRates, showDecimals } = useAppData();
  const [f, setF] = useState(EMPTY);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    const base = product ? { ...EMPTY, ...Object.fromEntries(Object.entries(product).map(([k, v]) => [k, v == null ? EMPTY[k] ?? "" : v])) } : { ...EMPTY, folder_id: defaultFolder && defaultFolder !== NO_FOLDER ? defaultFolder : null };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setF(prefill ? { ...base, ...prefill.fields, url: prefill.url || base.url } : base);
    setNote(prefill?.note || prefill?.error || "");
    setErr("");
  }, [product, prefill, defaultFolder]);

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const p = productPrices({ ...f, source_price: f.source_price === "" ? null : f.source_price, client_price: f.client_price === "" ? null : f.client_price }, exchangeRates);
  const m = (uah) => (uah == null ? "—" : fmtCurrency(uah, currency, exchangeRates, showDecimals));

  async function refresh() {
    if (!f.url.trim()) { setErr("Вкажіть посилання на товар."); return; }
    setReading(true); setErr("");
    const r = await readProductPage(f.url).catch((e) => ({ error: e.message }));
    setReading(false);
    if (r.error) { setNote(r.error); return; }
    // назву/опис/фото не перетираємо, якщо їх уже виправили вручну; ціну джерела — оновлюємо
    set({ url: r.url, name: f.name || r.fields.name, description: f.description || r.fields.description, image: f.image || r.fields.image, site: f.site || r.fields.site, source_price: r.fields.source_price || f.source_price, source_currency: r.fields.source_price ? r.fields.source_currency : f.source_currency });
    setNote(r.note + (r.fields.source_price ? ` Ціна на сайті: ${r.fields.source_price} ${r.fields.source_currency}.` : ""));
  }

  async function save() {
    if (!f.name.trim()) { setErr("Вкажіть назву товару."); return; }
    const num = (v) => (v === "" || v == null ? null : Number(String(v).replace(",", ".")));
    if (f.price_mode === "fixed" && !(num(f.client_price) > 0)) { setErr("Вкажіть свою ціну для клієнта або оберіть націнку."); return; }
    if (f.price_mode === "markup" && !(num(f.source_price) > 0)) { setErr("Для націнки потрібна ціна на сайті продавця."); return; }
    setBusy(true); setErr("");
    const payload = {
      name: f.name.trim(), description: f.description?.trim() || null, url: f.url?.trim() || null, site: f.site?.trim() || hostOf(f.url) || null,
      image: f.image?.trim() || null, unit: f.unit?.trim() || "шт",
      source_price: num(f.source_price), source_currency: f.source_currency || "UAH",
      price_mode: f.price_mode, markup_percent: num(f.markup_percent) || 0,
      client_price: num(f.client_price), client_currency: f.client_currency || "UAH",
      folder_id: f.folder_id || null, status: f.status || "active", note: f.note?.trim() || null,
      checked_at: f.url ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    };
    const r = product?.id
      ? await supabase.from("catalog_products").update(payload).eq("id", product.id)
      : await supabase.from("catalog_products").insert({ ...payload, sort_order: nextSort ?? 0 });
    setBusy(false);
    if (r.error) { setErr(r.error.message); return; }
    onSaved();
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2>{product?.id ? "Товар" : "Новий товар"}</h2>
        {err && <div className="auth-error">{err}</div>}
        {note && <div className="note" style={{ marginBottom: 10 }}>{note}</div>}

        <div className="form-row">
          <label>Посилання на товар (сайт продавця)</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={f.url || ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
            <button type="button" className="btn" disabled={reading || !canEdit} onClick={refresh}>{reading ? "Читаю…" : "↻ Оновити з сайту"}</button>
            {f.url && <a className="btn" href={f.url} target="_blank" rel="noreferrer" title="Відкрити сторінку">↗</a>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 14, alignItems: "start" }}>
          <div className="prod-card__img" style={{ borderRadius: 8, border: "1px solid var(--border)", backgroundImage: f.image ? `url(${f.image})` : undefined }}>{!f.image && "📦"}</div>
          <div>
            <div className="form-row"><label>Назва *</label><input value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div className="form-row"><label>Фото (адреса картинки)</label><input value={f.image || ""} onChange={(e) => set({ image: e.target.value })} placeholder="https://…jpg" /></div>
          </div>
        </div>
        <div className="form-row"><label>Опис</label><textarea rows={3} value={f.description || ""} onChange={(e) => set({ description: e.target.value })} /></div>

        <div className="price-pair">
          <div className="form-row"><label>Папка</label><FolderSelect scope="products" value={f.folder_id} onChange={(v) => set({ folder_id: v })} width={240} /></div>
          <div className="form-row"><label>Одиниця</label><input value={f.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="шт, м², компл." /></div>
        </div>

        <h4>Ціна</h4>
        <div className="price-pair">
          <div className="form-row">
            <label>Ціна на сайті продавця{f.site ? ` (${f.site})` : ""}</label>
            <div className="price-cost-row" style={{ display: "flex", gap: 6 }}>
              <input inputMode="decimal" value={f.source_price} onChange={(e) => set({ source_price: e.target.value })} placeholder="0" />
              <select value={f.source_currency} onChange={(e) => set({ source_currency: e.target.value })} style={{ width: 84, flex: "none" }}>{CURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </div>
          </div>
          <div className="form-row">
            <label>Наша ціна для клієнта</label>
            <div className="seg-row">
              <button type="button" className={`seg-btn${f.price_mode === "markup" ? " active" : ""}`} onClick={() => set({ price_mode: "markup" })}>+ Націнка %</button>
              <button type="button" className={`seg-btn${f.price_mode === "fixed" ? " active" : ""}`} onClick={() => set({ price_mode: "fixed" })}>Своя ціна</button>
            </div>
          </div>
        </div>
        {f.price_mode === "markup" ? (
          <div className="form-row"><label>Націнка, %</label><input type="number" min="0" step="1" value={f.markup_percent} onChange={(e) => set({ markup_percent: e.target.value })} placeholder="напр. 20" style={{ maxWidth: 160 }} /></div>
        ) : (
          <div className="form-row">
            <label>Своя ціна</label>
            <div style={{ display: "flex", gap: 6, maxWidth: 260 }}>
              <input inputMode="decimal" value={f.client_price} onChange={(e) => set({ client_price: e.target.value })} placeholder="0" />
              <select value={f.client_currency} onChange={(e) => set({ client_currency: e.target.value })} style={{ width: 84, flex: "none" }}>{CURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </div>
          </div>
        )}
        <div className="prod-calc">
          <div className="row"><span>Ціна продавця</span><span>{m(p.source)}</span></div>
          <div className="row"><span>Наша ціна для клієнта{f.unit ? ` / ${f.unit}` : ""}</span><b>{m(p.client)}</b></div>
          <div className="row"><span>Заробіток</span><span style={{ color: p.margin < 0 ? "var(--danger)" : "var(--success)" }}>{p.margin == null ? "—" : `${m(p.margin)}${p.pct != null ? ` · ${Math.round(p.pct)}%` : ""}`}</span></div>
        </div>

        <div className="price-pair" style={{ marginTop: 12 }}>
          <div className="form-row">
            <label>Статус</label>
            <select value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="active">Активний</option><option value="draft">Чернетка</option><option value="archived">Архів</option>
            </select>
          </div>
          <div className="form-row"><label>Нотатка (бачить команда)</label><input value={f.note || ""} onChange={(e) => set({ note: e.target.value })} /></div>
        </div>

        <div className="modal-actions">
          {product?.id && canEdit && <DeleteButton table="catalog_products" id={product.id} what="товар" onDone={onSaved} onError={setErr} />}
          <button className="btn" onClick={onClose}>Скасувати</button>
          {canEdit && <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Зберігаю…" : "Зберегти"}</button>}
        </div>
      </div>
    </div>
  );
}
