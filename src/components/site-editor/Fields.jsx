"use client";
// Форма полів конструктора сайту: одна для блоків, моделей, кейсів і налаштувань.
// Типи: text, textarea, number, bool, select, multi, href, link, image, images, list, strings, group, template.
// Видалення в два кроки: перше «Видалити» ховає з сайту (фото — префікс «~~», пункт — hidden), друге — видаляє назавжди.
import { useRef, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { uploadSiteImage } from "@/lib/site/upload";
import { hideStr, imgSmall, isHiddenStr, unhideStr } from "@/lib/site/format";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, EyeOffIcon, TrashIcon } from "@/components/Icon";

export const LINKS_ID = "se-links";

// підказки для полів-посилань: сторінки сайту, якорі, телефон
export function LinkOptions({ pages = [], extra = [] }) {
  const opts = [
    ["/", "Головна"], ...pages.filter((p) => p.slug !== "home").map((p) => [`/${p.slug}`, p.title]),
    ["#contact", "Форма заявки на цій сторінці"], ["#calc", "Калькулятор"], ["#faq", "Питання"], ["#showroom", "Шоурум"],
    ["/#calc", "Калькулятор на головній"], ...extra,
  ];
  return <datalist id={LINKS_ID}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</datalist>;
}

function ImageField({ value, onChange, compact }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef(null);
  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true); setErr("");
    try { onChange(await uploadSiteImage(f)); } catch (x) { setErr(x.message || "Не вдалося завантажити"); }
    setBusy(false);
  }
  const off = isHiddenStr(value);
  const url = unhideStr(value);
  return (
    <div className={`se-img${compact ? " se-img--compact" : ""}${off ? " se-img--off" : ""}`}>
      <div className="se-img__thumb" onClick={() => input.current?.click()} title="Замінити фото">
        {url ? <img src={imgSmall(url)} alt="" /> : <span>{busy ? "…" : "+ фото"}</span>}
        {off && <span className="se-off-badge">приховано</span>}
      </div>
      <div className="se-img__side">
        <div className="se-row">
          <button type="button" className="btn small" onClick={() => input.current?.click()} disabled={busy}>{busy ? "Завантажую…" : url ? "Замінити" : "Завантажити"}</button>
          {url && !off && <button type="button" className="btn small" onClick={() => onChange(hideStr(value))} title="Сховати з сайту. Видалити назавжди — наступним натиском">Прибрати</button>}
          {off && <button type="button" className="btn small" onClick={() => onChange(url)}>Показати</button>}
          {off && <button type="button" className="btn small danger" onClick={() => onChange("")}>Видалити назавжди</button>}
        </div>
        {!compact && <input className="se-url" value={url || ""} placeholder="або вставте посилання на фото" onChange={(e) => onChange(e.target.value.trim())} />}
        {err && <div className="se-err">{err}</div>}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}

function ImagesField({ value, onChange }) {
  const list = Array.isArray(value) ? value : [];
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const input = useRef(null);
  const drag = useRef(null);
  async function pick(e) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setErr(""); setBusy(files.length);
    const added = [];
    for (const f of files) {
      try { added.push(await uploadSiteImage(f)); } catch (x) { setErr(x.message || "Не вдалося завантажити"); }
      setBusy((n) => n - 1);
    }
    onChange([...list, ...added]);
  }
  const move = (from, to) => { if (to < 0 || to >= list.length) return; const a = [...list]; const [x] = a.splice(from, 1); a.splice(to, 0, x); onChange(a); };
  const setAt = (i, v) => onChange(list.map((x, j) => (j === i ? v : x)));
  const cover = list.findIndex((u) => !isHiddenStr(u));
  return (
    <div>
      <div className="se-imgs">
        {list.map((u, i) => {
          const off = isHiddenStr(u);
          return (
            <div key={u + i} className={`se-imgs__item${off ? " off" : ""}`} draggable
              onDragStart={() => { drag.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag.current != null) move(drag.current, i); drag.current = null; }}>
              <img src={imgSmall(unhideStr(u))} alt="" />
              {i === cover && <span className="se-imgs__cover">обкладинка</span>}
              {off && <span className="se-off-badge">приховано</span>}
              <div className="se-imgs__tools">
                <button type="button" onClick={() => move(i, i - 1)} title="Ліворуч">‹</button>
                <button type="button" onClick={() => move(i, i + 1)} title="Праворуч">›</button>
                {off ? (
                  <>
                    <button type="button" onClick={() => setAt(i, unhideStr(u))} title="Показати на сайті"><EyeOffIcon /></button>
                    <button type="button" className="danger" onClick={() => onChange(list.filter((_, j) => j !== i))} title="Видалити назавжди">×</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setAt(i, hideStr(u))} title="Сховати з сайту (видалити — наступним натиском)">×</button>
                )}
              </div>
            </div>
          );
        })}
        <button type="button" className="se-imgs__add" onClick={() => input.current?.click()} disabled={!!busy}>{busy ? `Завантажую… ${busy}` : "+ Додати фото"}</button>
      </div>
      <div className="note">Перетягніть фото, щоб змінити порядок. «×» спершу ховає фото з сайту (воно стає блідим), повторний «×» на схованому — видаляє назавжди. Можна вибрати кілька файлів одразу — вони самі стиснуться для швидкого сайту.</div>
      {err && <div className="se-err">{err}</div>}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={pick} />
    </div>
  );
}

function ListField({ f, value, onChange }) {
  const list = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(() => (list.length <= 3 ? list.map((_, i) => i) : []));
  const set = (i, patch) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; const a = [...list]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const toggle = (i) => setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));
  const firstText = (x) => f.fields.map((s) => x?.[s.key]).find((v) => typeof v === "string" && v.trim()) || "";
  const single = f.fields.length === 1;
  return (
    <div className="se-list">
      {list.map((x, i) => (
        <div key={i} className={`se-list__item${x?.hidden ? " off" : ""}`}>
          <div className="se-list__head">
            {single ? (
              <FieldInput f={{ ...f.fields[0], label: "" }} value={x?.[f.fields[0].key]} onChange={(v) => set(i, { [f.fields[0].key]: v })} />
            ) : (
              <button type="button" className="se-list__title" onClick={() => toggle(i)}>
                <span className="se-caret">{open.includes(i) ? "▾" : "▸"}</span>
                {firstText(x) || `${f.item || "Елемент"} ${i + 1}`}
              </button>
            )}
            {x?.hidden && <span className="se-off-badge se-off-badge--inline">приховано</span>}
            <div className="se-tools">
              <button type="button" onClick={() => move(i, -1)} title="Вище" disabled={!i}><ArrowUpIcon /></button>
              <button type="button" onClick={() => move(i, 1)} title="Нижче" disabled={i === list.length - 1}><ArrowDownIcon /></button>
              <button type="button" onClick={() => { const a = [...list]; a.splice(i + 1, 0, { ...structuredClone(x), hidden: false }); onChange(a); }} title="Дублювати"><CopyIcon /></button>
              {x?.hidden && <button type="button" onClick={() => set(i, { hidden: false })} title="Показати на сайті"><EyeOffIcon /></button>}
              {x?.hidden ? (
                <button type="button" className="danger" onClick={() => onChange(list.filter((_, j) => j !== i))} title="Видалити назавжди"><TrashIcon /></button>
              ) : (
                <button type="button" onClick={() => set(i, { hidden: true })} title="Сховати з сайту (видалити — наступним натиском)"><TrashIcon /></button>
              )}
            </div>
          </div>
          {!single && open.includes(i) && (
            <div className="se-list__body">
              {f.fields.map((s) => <Field key={s.key} f={s} value={x?.[s.key]} onChange={(v) => set(i, { [s.key]: v })} />)}
            </div>
          )}
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => { onChange([...list, {}]); setOpen((o) => [...o, list.length]); }}>+ {f.item || "Додати"}</button>
    </div>
  );
}

function StringsField({ f, value, onChange }) {
  const list = (Array.isArray(value) ? value : []).map((x) => (typeof x === "string" ? x : x?.text || ""));
  return (
    <ListField f={{ ...f, fields: [{ key: "text", type: "text" }] }} value={list.map((s) => ({ text: unhideStr(s), hidden: isHiddenStr(s) }))}
      onChange={(a) => onChange(a.map((x) => (x.hidden ? hideStr(x.text || "") : x.text || "")))} />
  );
}

// кілька значень зі списку (напр. типи кейсу); перше вибране — основне
function MultiField({ f, value, onChange }) {
  const v = Array.isArray(value) ? value : [];
  return (
    <div className="se-multi">
      {f.options.map(([k, l]) => (
        <label key={k} className="se-check">
          <input type="checkbox" checked={v.includes(k)} onChange={(e) => onChange(e.target.checked ? [...v, k] : v.filter((x) => x !== k))} /> {l}
        </label>
      ))}
    </div>
  );
}

function TemplateField({ value, onChange }) {
  const { templates } = useAppData();
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— не пов’язано —</option>
      {(templates || []).filter((t) => t.status !== "archived").map((t) => <option key={t.id} value={t.id}>{t.name}{t.area_m2 ? ` · ${t.area_m2} м²` : ""}</option>)}
    </select>
  );
}

function FieldInput({ f, value, onChange }) {
  switch (f.type) {
    case "textarea":
      return <textarea rows={Math.min(8, Math.max(3, String(value || "").split("\n").length + 1))} value={value || ""} maxLength={f.max ? f.max * 2 : undefined} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <input type="text" inputMode="decimal" value={value ?? ""} onChange={(e) => { const t = e.target.value.replace(",", ".").replace(/[^\d.]/g, ""); onChange(t === "" ? null : Number(t)); }} />;
    case "bool":
      return <label className="se-check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}</label>;
    case "select":
      return (
        <select value={value ?? ""} onChange={(e) => { const o = f.options.find(([v]) => String(v) === e.target.value); onChange(o ? o[0] : e.target.value); }}>
          {f.options.map(([v, l]) => <option key={String(v)} value={v}>{l}</option>)}
        </select>
      );
    case "href":
      return <input list={LINKS_ID} value={value || ""} placeholder="/modeli, #contact, https://…" onChange={(e) => onChange(e.target.value)} />;
    case "link": {
      const v = value || {};
      return (
        <div className="se-link">
          <input value={v.label || ""} placeholder="Текст кнопки (порожньо — без кнопки)" onChange={(e) => onChange({ ...v, label: e.target.value })} />
          <input list={LINKS_ID} value={v.href || ""} placeholder="Куди веде: /modeli, #contact, https://…" onChange={(e) => onChange({ ...v, href: e.target.value })} />
        </div>
      );
    }
    case "image": return <ImageField value={value} onChange={onChange} />;
    case "multi": return <MultiField f={f} value={value} onChange={onChange} />;
    case "images": return <ImagesField value={value} onChange={onChange} />;
    case "list": return <ListField f={f} value={value} onChange={onChange} />;
    case "strings": return <StringsField f={f} value={value} onChange={onChange} />;
    case "template": return <TemplateField value={value} onChange={onChange} />;
    case "group": {
      const v = value || {};
      return <div className="se-group">{f.fields.map((s) => <Field key={s.key} f={s} value={v[s.key]} onChange={(x) => onChange({ ...v, [s.key]: x })} />)}</div>;
    }
    default:
      return <input value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function Field({ f, value, onChange }) {
  if (f.type === "bool") return <div className="form-row"><FieldInput f={f} value={value} onChange={onChange} /></div>;
  const len = typeof value === "string" ? value.length : 0;
  return (
    <div className="form-row">
      {f.label && (
        <label>
          {f.label}
          {f.hint && <span className="se-hint"> · {f.hint}</span>}
          {f.max && <span className={`se-count${len > f.max ? " over" : ""}`}>{len}/{f.max}</span>}
        </label>
      )}
      <FieldInput f={f} value={value} onChange={onChange} />
    </div>
  );
}

export function Fields({ fields, value, onChange }) {
  return fields.map((f) => <Field key={f.key} f={f} value={value?.[f.key]} onChange={(v) => onChange({ ...value, [f.key]: v })} />);
}
