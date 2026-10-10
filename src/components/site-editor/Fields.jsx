"use client";
// Форма полів конструктора сайту: одна для блоків, моделей, кейсів і налаштувань.
// Типи: text, textarea, number, bool, select, multi, href, link, image, images, list, strings, group, template.
// Видалення в два кроки: перше «Видалити» ховає з сайту (фото — префікс «~~», пункт — hidden), друге — видаляє назавжди.
import { useRef, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { fmtCurrency, templateTotalUah } from "@/lib/format";
import { uploadSiteImage } from "@/lib/site/upload";
import { hideStr, imgSmall, isHiddenStr, unhideStr } from "@/lib/site/format";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, EyeOffIcon, TrashIcon } from "@/components/Icon";
import PhotoViewer from "./PhotoViewer";

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
  const [view, setView] = useState(false);
  const [before, setBefore] = useState(""); // фото до обрізання — щоб можна було повернути
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
      <div className="se-img__thumb" onClick={() => (url ? setView(true) : input.current?.click())} title={url ? "Відкрити фото: переглянути, обрізати" : "Завантажити фото"}>
        {url ? <img src={imgSmall(url)} alt="" /> : <span>{busy ? "…" : "+ фото"}</span>}
        {off && <span className="se-off-badge">приховано</span>}
      </div>
      <div className="se-img__side">
        <div className="se-row">
          <button type="button" className="btn small" onClick={() => input.current?.click()} disabled={busy}>{busy ? "Завантажую…" : url ? "Замінити" : "Завантажити"}</button>
          {url && !off && <button type="button" className="btn small" onClick={() => onChange(hideStr(value))} title="Сховати з сайту. Видалити назавжди — наступним натиском">Прибрати</button>}
          {off && <button type="button" className="btn small" onClick={() => onChange(url)}>Показати</button>}
          {off && <button type="button" className="btn small danger" onClick={() => onChange("")}>Видалити назавжди</button>}
          {before && before !== value && <button type="button" className="btn small" onClick={() => { onChange(before); setBefore(""); }}>↩ Повернути необрізане</button>}
        </div>
        {!compact && <input className="se-url" value={url || ""} placeholder="або вставте посилання на фото" onChange={(e) => onChange(e.target.value.trim())} />}
        {err && <div className="se-err">{err}</div>}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
      {view && url && (
        <PhotoViewer list={[value]} index={0} onIndex={() => {}} onClose={() => setView(false)}
          onCropped={(_, cut) => { setBefore(value); onChange(off ? hideStr(cut) : cut); }} />
      )}
    </div>
  );
}

// f.captions — назва сусіднього поля з підписами { адреса фото: підпис }; onPatch міняє кілька полів запису одним кроком
function ImagesField({ f, value, onChange, data, onPatch }) {
  const list = Array.isArray(value) ? value : [];
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const [view, setView] = useState(null); // номер відкритого фото
  const input = useRef(null);
  const drag = useRef(null);
  const capKey = onPatch ? f?.captions : null;
  const caps = capKey ? data?.[capKey] || {} : null;
  const setCaption = (url, text) => {
    const next = { ...caps };
    if (text) next[url] = text; else delete next[url];
    onPatch({ [capKey]: next });
  };
  // обрізане фото стає на місце оригіналу, оригінал лишається поруч прихованим; підпис переходить на обрізане
  function cropped(i, cut) {
    const orig = unhideStr(list[i]);
    const next = [...list.slice(0, i), isHiddenStr(list[i]) ? hideStr(cut) : cut, hideStr(orig), ...list.slice(i + 1)];
    if (caps && caps[orig]) onPatch({ [f.key]: next, [capKey]: { ...caps, [cut]: caps[orig] } });
    else onChange(next);
  }
  // видалене назавжди фото забирає з собою підпис
  function remove(i) {
    const url = unhideStr(list[i]);
    const next = list.filter((_, j) => j !== i);
    if (caps && caps[url] && !next.some((u) => unhideStr(u) === url)) {
      const rest = { ...caps };
      delete rest[url];
      onPatch({ [f.key]: next, [capKey]: rest });
    } else onChange(next);
  }
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
            <div key={u + i} className={`se-imgs__item${off ? " off" : ""}`} draggable title="Відкрити фото: переглянути, підписати, обрізати" onClick={() => setView(i)}
              onDragStart={() => { drag.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag.current != null) move(drag.current, i); drag.current = null; }}>
              <img src={imgSmall(unhideStr(u))} alt="" />
              {i === cover && <span className="se-imgs__cover">обкладинка</span>}
              {off && <span className="se-off-badge">приховано</span>}
              {caps?.[unhideStr(u)] && <span className="se-imgs__cap" title={caps[unhideStr(u)]}>підпис</span>}
              <div className="se-imgs__tools" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => move(i, i - 1)} title="Ліворуч">‹</button>
                <button type="button" onClick={() => move(i, i + 1)} title="Праворуч">›</button>
                {off ? (
                  <>
                    <button type="button" onClick={() => setAt(i, unhideStr(u))} title="Показати на сайті"><EyeOffIcon /></button>
                    <button type="button" className="danger" onClick={() => remove(i)} title="Видалити назавжди">×</button>
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
      <div className="note">Натисніть на фото — відкриється велике: там можна {caps ? "написати підпис і " : ""}обрізати. Перетягніть фото, щоб змінити порядок. «×» спершу ховає фото з сайту (воно стає блідим), повторний «×» на схованому — видаляє назавжди. Можна вибрати кілька файлів одразу — вони самі стиснуться для швидкого сайту.</div>
      {err && <div className="se-err">{err}</div>}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={pick} />
      {view != null && list[view] != null && (
        <PhotoViewer list={list} index={view} onIndex={setView} onClose={() => setView(null)}
          captions={caps} onCaption={setCaption} onCropped={cropped} />
      )}
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

// модулі моделі: ширина × довжина кожного, м. Поля без «контролю», щоб можна було набрати «3,2» (кома не зникає на півслові)
function ModSizesField({ value, onChange, data }) {
  const list = Array.isArray(value) ? value : [];
  const parse = (t) => { const x = Number(String(t).replace(",", ".").replace(/[^\d.]/g, "")); return Number.isFinite(x) && x > 0 ? x : null; };
  const show = (v) => (v == null ? "" : String(v).replace(".", ","));
  const upd = (i, patch) => onChange(list.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const count = Number(data?.modules) || 0;
  return (
    <div className="se-terraces">
      {list.map((d, i) => (
        <div key={`${data?.id}-${i}-${list.length}`} className="se-terrace">
          <span className="note">{i + 1}.</span>
          <input inputMode="decimal" defaultValue={show(d.w)} placeholder="ширина" aria-label={`Модуль ${i + 1}: ширина, м`} onChange={(e) => upd(i, { w: parse(e.target.value) })} />
          <span>×</span>
          <input inputMode="decimal" defaultValue={show(d.l)} placeholder="довжина" aria-label={`Модуль ${i + 1}: довжина, м`} onChange={(e) => upd(i, { l: parse(e.target.value) })} />
          <span>м</span>
          <button type="button" className="btn small" title="Прибрати модуль" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="se-terrace">
        <button type="button" className="btn small" onClick={() => onChange([...list, list.length ? { ...list[list.length - 1] } : { w: 3, l: 6.5 }])}>+ Модуль</button>
        {!!list.length && !!count && count !== list.length && <span className="note">У полі «Модулів» — {count}, а розмірів вказано {list.length}.</span>}
      </div>
    </div>
  );
}

// тераси: назва, ширина × довжина (площа рахується), включена чи опція
function TerracesField({ value, onChange }) {
  const list = Array.isArray(value) ? value : [];
  const num = (t) => { const x = t.replace(",", ".").replace(/[^\d.]/g, ""); return x === "" ? null : Number(x); };
  const upd = (i, patch) => onChange(list.map((t, j) => {
    if (j !== i) return t;
    const n = { ...t, ...patch };
    if (("w" in patch || "l" in patch) && n.w > 0 && n.l > 0) n.area = Math.round(n.w * n.l * 100) / 100;
    return n;
  }));
  return (
    <div className="se-terraces">
      {list.map((t, i) => (
        <div key={i} className="se-terrace">
          <input value={t.name || ""} placeholder="Тераса" onChange={(e) => upd(i, { name: e.target.value })} />
          <input inputMode="decimal" value={t.w ?? ""} placeholder="ш" onChange={(e) => upd(i, { w: num(e.target.value) })} />
          <span>×</span>
          <input inputMode="decimal" value={t.l ?? ""} placeholder="д" onChange={(e) => upd(i, { l: num(e.target.value) })} />
          <span>=</span>
          <input inputMode="decimal" value={t.area ?? ""} placeholder="м²" onChange={(e) => upd(i, { area: num(e.target.value) })} />
          <label className="se-check"><input type="checkbox" checked={t.included !== false} onChange={(e) => upd(i, { included: e.target.checked })} /> включена</label>
          <button type="button" className="btn small" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => onChange([...list, { name: "Тераса", w: null, l: null, area: null, included: true }])}>+ Тераса</button>
    </div>
  );
}

function TemplateField({ value, onChange }) {
  const { templates, currency, exchangeRates } = useAppData();
  const tpl = (templates || []).find((t) => t.id === value);
  const total = tpl ? templateTotalUah(tpl) : null;
  return (
    <>
      <select value={value || ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— не пов’язано —</option>
        {(templates || []).filter((t) => t.status !== "archived" || t.id === value).map((t) => <option key={t.id} value={t.id}>{t.name}{t.area_m2 ? ` · ${t.area_m2} м²` : ""}</option>)}
      </select>
      {tpl && (
        <span className="note">
          {total != null
            ? `Ціна за каталогом: ${fmtCurrency(total, currency, exchangeRates, false)} · ${fmtCurrency(tpl.base_cost_per_m2, currency, exchangeRates, false)}/м². На сайті сама не зʼявляється — ціни для сайту вказуються в полях вище.`
            : "У каталозі ця модель ще не прорахована — ціни немає."}
        </span>
      )}
    </>
  );
}

function FieldInput({ f, value, onChange, data, onPatch }) {
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
    case "images": return <ImagesField f={f} value={value} onChange={onChange} data={data} onPatch={onPatch} />;
    case "list": return <ListField f={f} value={value} onChange={onChange} />;
    case "strings": return <StringsField f={f} value={value} onChange={onChange} />;
    case "template": return <TemplateField value={value} onChange={onChange} />;
    case "terraces": return <TerracesField value={value} onChange={onChange} />;
    case "modsizes": return <ModSizesField value={value} onChange={onChange} data={data} />;
    case "group": {
      const v = value || {};
      return <div className="se-group">{f.fields.map((s) => <Field key={s.key} f={s} value={v[s.key]} onChange={(x) => onChange({ ...v, [s.key]: x })} />)}</div>;
    }
    default:
      return <input value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

// data й onPatch — увесь запис і зміна кількох його полів разом (потрібно фото з підписами)
export function Field({ f, value, onChange, data, onPatch }) {
  if (f.type === "bool") return <div className="form-row"><FieldInput f={f} value={value} onChange={onChange} /></div>;
  const len = typeof value === "string" ? value.length : 0;
  // параметр береться з моделі в каталозі — тут лише показуємо (щоб змінити тут, вимкніть «Брати параметри з каталогу»)
  const locked = f.synced && data?.template_id && data?.sync_params !== false;
  return (
    <div className={`form-row${locked ? " se-locked" : ""}`} title={locked ? "З каталогу системи. Змінюйте в картці моделі (Каталог → Моделі будинків) або вимкніть «Брати параметри з каталогу» нижче." : undefined}>
      {f.label && (
        <label>
          {f.label}
          {locked && <span className="se-hint"> · 🔗 з каталогу</span>}
          {f.hint && <span className="se-hint"> · {f.hint}</span>}
          {f.max && <span className={`se-count${len > f.max ? " over" : ""}`}>{len}/{f.max}</span>}
        </label>
      )}
      {locked ? <input value={f.options ? (f.options.find(([k]) => String(k) === String(value))?.[1] ?? "") : f.type === "terraces" ? terracesText(value) : value ?? ""} readOnly /> : <FieldInput f={f} value={value} onChange={onChange} data={data} onPatch={onPatch} />}
    </div>
  );
}

// «Тераса 3 × 4 м = 12 м² (включена)» — для показу
export function terracesText(v) {
  return (Array.isArray(v) ? v : []).map((t) => `${t.name || "Тераса"}${t.w && t.l ? ` ${String(t.w).replace(".", ",")} × ${String(t.l).replace(".", ",")} м` : ""} = ${String(t.area).replace(".", ",")} м²${t.included === false ? " (опція)" : ""}`).join("; ");
}

export function Fields({ fields, value, onChange }) {
  return fields.map((f) => (
    <Field key={f.key} f={f} value={value?.[f.key]} onChange={(v) => onChange({ ...value, [f.key]: v })}
      data={value} onPatch={(patch) => onChange({ ...value, ...patch })} />
  ));
}
