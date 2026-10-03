"use client";

// Дрібні спільні елементи кадрового модуля: вікно, поле, редактори списків, оцінка 1–5, шкала прогресу.

export function Modal({ title, onClose, children, wide, actions }) {
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal hr-modal${wide ? " hr-modal--wide" : ""}`} role="dialog" aria-label={typeof title === "string" ? title : undefined}>
        <div className="hr-modal__head">
          <h2>{title}</h2>
          <button type="button" className="btn small" onClick={onClose} aria-label="Закрити">✕</button>
        </div>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, grow }) {
  return (
    <div className="form-row" style={grow ? { flex: grow, minWidth: 0 } : undefined}>
      <label>{label}</label>
      {children}
      {hint && <span className="note" style={{ marginTop: 0 }}>{hint}</span>}
    </div>
  );
}

export function Bar({ pct, state }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return <div className={`hr-bar${state ? ` hr-bar--${state}` : ""}`} role="img" aria-label={`${Math.round(p)}%`}><span style={{ width: `${p}%` }} /></div>;
}

export function Dot({ state, title }) {
  return <span className={`hr-dot hr-dot--${state || "none"}`} title={title} aria-label={title} />;
}

// оцінка 1–5 кнопками
export function Score5({ value, onChange, disabled }) {
  return (
    <span className="hr-score5" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={Number(value) === n} disabled={disabled} className={Number(value) === n ? "on" : ""} onClick={() => onChange(Number(value) === n ? null : n)}>{n}</button>
      ))}
    </span>
  );
}

// так / частково / ні
export function Tri({ value, onChange, labels = ["ні", "частково", "так"] }) {
  const opts = [[0, labels[0], "no"], [0.5, labels[1], "part"], [1, labels[2], "yes"]];
  return (
    <span className="hr-score5 hr-tri" role="radiogroup">
      {opts.map(([v, l, c]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? `on on--${c}` : ""} onClick={() => onChange(value === v ? null : v)}>{l}</button>
      ))}
    </span>
  );
}

// список рядків: по одному в полі, × прибирає
export function StringsEditor({ items, onChange, placeholder, addLabel = "+ Додати" }) {
  const list = items || [];
  return (
    <div className="hr-list">
      {list.map((x, i) => (
        <div className="hr-list__row" key={i}>
          <textarea rows={1} value={x} placeholder={placeholder} onChange={(e) => onChange(list.map((y, j) => (j === i ? e.target.value : y)))} />
          <button type="button" className="btn small" title="Прибрати" onClick={() => onChange(list.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => onChange([...list, ""])}>{addLabel}</button>
    </div>
  );
}

// список об'єктів: fields = [{ key, label, type: text|area|number|select|bool, options, width }]
export function ListEditor({ items, fields, onChange, addLabel = "+ Додати", blank = {} }) {
  const list = items || [];
  const set = (i, k, v) => onChange(list.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); };
  return (
    <div className="hr-list">
      {list.map((x, i) => (
        <div className="hr-list__item" key={i}>
          <div className="hr-list__fields">
            {fields.map((f) => (
              <label key={f.key} style={{ flex: f.width ? `0 0 ${f.width}px` : "1 1 220px" }}>
                <span>{f.label}</span>
                {f.type === "area" ? <textarea rows={2} value={x[f.key] ?? ""} onChange={(e) => set(i, f.key, e.target.value)} />
                  : f.type === "select" ? <select value={x[f.key] ?? ""} onChange={(e) => set(i, f.key, e.target.value || null)}>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  : f.type === "bool" ? <input type="checkbox" checked={!!x[f.key]} onChange={(e) => set(i, f.key, e.target.checked)} style={{ width: "auto" }} />
                  : <input type="text" inputMode={f.type === "number" ? "decimal" : undefined} value={x[f.key] ?? ""} onChange={(e) => set(i, f.key, f.type === "number" ? (e.target.value === "" ? null : Number(String(e.target.value).replace(",", ".")) || 0) : e.target.value)} />}
              </label>
            ))}
          </div>
          <div className="hr-list__tools">
            <button type="button" className="btn small" title="Вище" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" className="btn small" title="Нижче" onClick={() => move(i, 1)} disabled={i === list.length - 1}>↓</button>
            <button type="button" className="btn small" title="Прибрати" onClick={() => onChange(list.filter((_, j) => j !== i))}>×</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => onChange([...list, { ...blank }])}>{addLabel}</button>
    </div>
  );
}

export function Copy({ text, label = "Скопіювати", className = "btn small" }) {
  return (
    <button type="button" className={className} onClick={async (e) => {
      const b = e.currentTarget;
      try { await navigator.clipboard.writeText(text); b.dataset.done = "1"; b.textContent = "Скопійовано ✓"; setTimeout(() => { b.textContent = label; }, 1800); } catch { window.prompt("Скопіюйте:", text); }
    }}>{label}</button>
  );
}
