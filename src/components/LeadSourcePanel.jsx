"use client";
// «Звідки заявка» в картці угоди: країна/місто, пристрій, джерело, поведінка на сайті — з leads.site_meta (заявки з сайту).
import { durText } from "@/lib/site/leadMeta";

const dt = (v) => {
  if (!v) return "";
  try { return new Date(v).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
};
const join = (...a) => a.filter(Boolean).join(" · ");
const utmText = (u) => (u ? Object.entries(u).map(([k, v]) => `${k}=${v}`).join(" · ") : "");

function Row({ label, children }) {
  if (!children) return null;
  return <div className="lsrc-row"><span className="lsrc-l">{label}</span><span className="lsrc-v">{children}</span></div>;
}

export default function LeadSourcePanel({ meta }) {
  if (!meta || typeof meta !== "object") return null;
  const g = meta.geo, d = meta.device || {}, s = meta.source || {}, v = meta.visit || {}, f = meta.form || {};
  const icon = d.type === "Комп'ютер" ? "💻" : d.type ? "📱" : "";
  const map = g?.lat && g?.lon ? `https://www.google.com/maps?q=${g.lat},${g.lon}` : "";
  const pages = Array.isArray(v.pages) ? v.pages : [];
  return (
    <div className="form-row">
      <label>🌐 Звідки заявка <span className="note" style={{ fontWeight: 400 }}>· сайт{meta.at ? `, ${dt(meta.at)}` : ""}</span></label>
      <div className="lsrc">
        <Row label="Країна, місто">
          {g ? <>{join(`${g.flag || ""} ${g.country || g.cc}`.trim(), g.city, g.region && g.region !== g.city ? g.region : "")}{map && <> · <a href={map} target="_blank" rel="noopener noreferrer">на мапі ↗</a></>}</>
            : <span className="note" style={{ margin: 0 }}>невідомо{meta.trusted === false ? " (заявка пройшла запасним шляхом)" : ""}</span>}
        </Row>
        <Row label="Пристрій">{join(d.type && `${icon} ${d.type}`, d.os, d.model, d.browser, d.inapp && `відкрито в ${d.inapp}`)}</Row>
        <Row label="Джерело">{s.now}{s.utm && <span className="note" style={{ margin: 0 }}> · {utmText(s.utm)}</span>}</Row>
        <Row label="Уперше на сайті">
          {s.first_at ? join(dt(s.first_at), s.first, s.visits > 1 ? `${s.visits}-й візит` : "перший візит", s.first_landing && `вхід на ${s.first_landing}`) : ""}
        </Row>
        <Row label="Цей візит">{join(v.page_count ? `${v.page_count} стор.` : "", durText(v.seconds) && `${durText(v.seconds)} на сайті`, v.form_seconds != null && `форму заповнював ${durText(v.form_seconds)}`, s.landing && `вхід на ${s.landing}`)}</Row>
        <Row label="Заявка з">{join(v.title || v.page, f.kind && `${f.kind} форма`, f.model && `модель ${f.model}`, f.calc && `розрахунок ${f.calc}`)}</Row>
        {Array.isArray(meta.flags) && meta.flags.length > 0 && (
          <div className="lsrc-flag">⚠ {meta.flags.join("; ")}</div>
        )}
        {pages.length > 0 && (
          <details className="lsrc-more">
            <summary>Переглянуті сторінки ({pages.length})</summary>
            <ol>{pages.map((p, i) => <li key={i}>{p}</li>)}</ol>
          </details>
        )}
        <details className="lsrc-more">
          <summary>Технічні деталі</summary>
          <Row label="IP">{meta.ip}</Row>
          <Row label="Мова">{Array.isArray(d.langs) && d.langs.length ? d.langs.join(", ") : d.lang || meta.al}</Row>
          <Row label="Часовий пояс">{join(d.tz && `пристрій ${d.tz}`, g?.tz && `IP ${g.tz}`)}</Row>
          <Row label="Екран">{join(d.screen, d.viewport && `вікно ${d.viewport}`, d.dpr && `×${d.dpr}`, d.touch ? "сенсорний" : "")}</Row>
          <Row label="Мережа">{d.net}</Row>
          <Row label="Звідки перейшов">{s.ref}</Row>
          <Row label="Уперше — звідки">{join(s.first_ref, utmText(s.first_utm))}</Row>
          <Row label="User-Agent"><span style={{ wordBreak: "break-all" }}>{meta.ua}</span></Row>
        </details>
      </div>
    </div>
  );
}
