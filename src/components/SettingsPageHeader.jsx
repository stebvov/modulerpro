"use client";

export default function SettingsPageHeader({ title, onBack }) {
  return (
    <div className="toolbar" style={{ marginBottom: 14 }}>
      <button className="btn small" onClick={onBack}>← Назад</button>
      <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
    </div>
  );
}
