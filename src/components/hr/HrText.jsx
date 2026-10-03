// Простий показ тексту уроків і оголошень: «## Заголовок», «- пункт», «1. крок», **жирний**, порожній рядок — новий абзац.
function inline(s, key) {
  const parts = String(s).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={`${key}-${i}`}>{p.slice(2, -2)}</b> : <span key={`${key}-${i}`}>{p}</span>));
}

export default function HrText({ text, className }) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const out = [];
  let list = null; // { ordered, items }
  let para = [];
  const flushPara = () => { if (para.length) { out.push(<p key={`p${out.length}`}>{para.map((l, i) => <span key={i}>{i > 0 && <br />}{inline(l, `p${out.length}-${i}`)}</span>)}</p>); para = []; } };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((l, i) => <li key={i}>{inline(l, `l${out.length}-${i}`)}</li>);
    out.push(list.ordered ? <ol key={`o${out.length}`}>{items}</ol> : <ul key={`u${out.length}`}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    const h = /^##\s+(.+)/.exec(l);
    const ul = /^[-•]\s+(.+)/.exec(l);
    const ol = /^\d+[.)]\s+(.+)/.exec(l);
    if (h) { flushPara(); flushList(); out.push(<h4 key={`h${out.length}`}>{inline(h[1], `h${out.length}`)}</h4>); }
    else if (ul || ol) {
      flushPara();
      if (list && list.ordered !== !!ol) flushList();
      list ||= { ordered: !!ol, items: [] };
      list.items.push((ul || ol)[1]);
    } else if (!l.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(l); }
  }
  flushPara(); flushList();
  return <div className={`hr-text${className ? ` ${className}` : ""}`}>{out}</div>;
}
