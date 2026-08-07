"use client";

export default function PdfPreviewModal({ file, onClose }) {
  if (!file) return null;
  return (
    <div className="lightbox-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Закрити">×</button>
      <div className="pdf-preview">
        <div className="pdf-preview-bar">
          <span>{file.name || "PDF"}</span>
          <a href={file.url} target="_blank" rel="noreferrer" className="btn small">Відкрити в новій вкладці ↗</a>
        </div>
        <iframe src={file.url} title={file.name || "PDF"} />
      </div>
    </div>
  );
}
