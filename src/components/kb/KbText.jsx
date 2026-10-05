// Текст запису бази знань: «# / ## / ### заголовок», «- пункт», «1. крок», **жирний**, таблиці «| a | b |»,
// посилання на інші записи — [n-…], [c-0001], [syn-…](…) і просто c-0001 у таблицях — стають кнопками.
const REF = /\[(syn-[a-z-]+)\]\([^)]*\)|\[((?:n-[a-z0-9][a-z0-9-]+|c-\d{4}|syn-[a-z-]+)(?:,\s*(?:n-[a-z0-9][a-z0-9-]+|c-\d{4}|syn-[a-z-]+))*)\]|\b(c-\d{4})\b/g;

function refs(s, key, ctx) {
  const out = [];
  let last = 0;
  let m;
  REF.lastIndex = 0;
  while ((m = REF.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const ids = (m[1] || m[2] || m[3]).split(/,\s*/);
    ids.forEach((id, i) => {
      const t = ctx?.titleOf?.(id);
      // запису немає (або він закритий для цього користувача) — лишаємо текстом
      if (!t) { out.push(m[3] ? id : (i ? ", " : "") + id); return; }
      const short = id.startsWith("c-") ? id : t.length > 44 ? t.slice(0, 42).trimEnd() + "…" : t;
      out.push(<button type="button" key={`${key}-${m.index}-${i}`} className="kb-ref" title={t} onClick={() => ctx.onRef(id)}>{short}</button>);
    });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function inline(s, key, ctx) {
  const parts = String(s).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") && p.length > 4
    ? <b key={`${key}-${i}`}>{refs(p.slice(2, -2), `${key}-${i}`, ctx)}</b>
    : <span key={`${key}-${i}`}>{refs(p, `${key}-${i}`, ctx)}</span>));
}

const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export default function KbText({ text, titleOf, onRef }) {
  const ctx = { titleOf, onRef };
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const out = [];
  let list = null; // { ordered, items }
  let para = [];
  let table = null; // рядки таблиці
  const flushPara = () => {
    if (!para.length) return;
    const k = out.length;
    out.push(<p key={`p${k}`}>{para.map((l, i) => <span key={i}>{i > 0 && " "}{inline(l, `p${k}-${i}`, ctx)}</span>)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const k = out.length;
    const items = list.items.map((l, i) => <li key={i}>{inline(l, `l${k}-${i}`, ctx)}</li>);
    out.push(list.ordered ? <ol key={`o${k}`}>{items}</ol> : <ul key={`u${k}`}>{items}</ul>);
    list = null;
  };
  const flushTable = () => {
    if (!table) return;
    const k = out.length;
    const rows = table.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
    const [head, ...body] = rows;
    out.push(
      <div className="kb-tablewrap" key={`t${k}`}>
        <table className="kb-table">
          {head && <thead><tr>{head.map((c, i) => <th key={i}>{inline(c, `th${k}-${i}`, ctx)}</th>)}</tr></thead>}
          <tbody>{body.map((r, j) => <tr key={j}>{r.map((c, i) => <td key={i}>{inline(c, `td${k}-${j}-${i}`, ctx)}</td>)}</tr>)}</tbody>
        </table>
      </div>,
    );
    table = null;
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    const h = /^(#{1,4})\s+(.+)/.exec(l);
    const ul = /^\s*[-•]\s+(.+)/.exec(l);
    const ol = /^\s*\d+[.)]\s+(.+)/.exec(l);
    if (/^\s*\|.*\|\s*$/.test(l)) { flushPara(); flushList(); (table ||= []).push(cells(l)); continue; }
    flushTable();
    if (h) { flushPara(); flushList(); out.push(h[1].length <= 2 ? <h4 key={`h${out.length}`}>{inline(h[2], `h${out.length}`, ctx)}</h4> : <h5 key={`h${out.length}`}>{inline(h[2], `h${out.length}`, ctx)}</h5>); }
    else if (ul || ol) {
      flushPara();
      if (list && list.ordered !== !!ol) flushList();
      list ||= { ordered: !!ol, items: [] };
      list.items.push((ul || ol)[1]);
    } else if (!l.trim()) { flushPara(); flushList(); }
    else if (/^_[^_].*_$/.test(l.trim())) { flushPara(); flushList(); out.push(<p key={`i${out.length}`} className="kb-text__dim">{l.trim().slice(1, -1)}</p>); }
    else { flushList(); para.push(l); }
  }
  flushPara(); flushList(); flushTable();
  return <div className="kb-text">{out}</div>;
}
