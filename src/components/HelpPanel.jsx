"use client";

// ❓ Довідка: пояснення поточного розділу (навіщо, як працювати, поля, автоматика, редагування).
// Можна перемкнутись на будь-який інший розділ — читати довідник усієї системи.
import { useEffect, useState } from "react";
import { HELP, HELP_FOOTER } from "@/lib/help";

function Section({ h }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{h.what}</p>
      {h.steps?.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Як працювати</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 13.5, lineHeight: 1.45 }}>{h.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      )}
      {h.fields?.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Що означає</div>
          <div style={{ display: "grid", gap: 8 }}>
            {h.fields.map(([f, d]) => (
              <div key={f} style={{ fontSize: 13.5, lineHeight: 1.45 }}><b>{f}</b> — {d}</div>
            ))}
          </div>
        </div>
      )}
      {h.auto?.length > 0 && (
        <div style={{ background: "var(--accent-bg)", borderRadius: 8, padding: "10px 12px" }}>
          <div className="section-label" style={{ marginBottom: 6 }}>⚙️ Відбувається автоматично</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 13.5, lineHeight: 1.45 }}>{h.auto.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      {h.edit && (
        <div style={{ fontSize: 13.5, lineHeight: 1.45 }}><b>✎ Редагування і видалення:</b> {h.edit}</div>
      )}
    </div>
  );
}

export default function HelpPanel({ open, tabId, onClose }) {
  const [pick, setPick] = useState(null);
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const id = pick && HELP[pick] ? pick : HELP[tabId] ? tabId : "pult-my";
  const h = HELP[id];
  return (
    <div className="modal-overlay open" style={{ justifyContent: "flex-end", padding: 0, alignItems: "stretch" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label="Довідка" style={{ background: "var(--card)", width: 460, maxWidth: "100%", height: "100%", overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "-10px 0 30px rgba(0,0,0,.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17, flex: 1 }}>{h.title}</h2>
          <button className="btn small" onClick={onClose} aria-label="Закрити довідку">✕</button>
        </div>
        <select value={id} onChange={(e) => setPick(e.target.value)} aria-label="Довідка по розділу">
          {Object.entries(HELP).map(([k, v]) => <option key={k} value={k}>{v.title}</option>)}
        </select>
        <Section h={h} />
        <div className="note" style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: "auto" }}>💬 {HELP_FOOTER}</div>
      </aside>
    </div>
  );
}
