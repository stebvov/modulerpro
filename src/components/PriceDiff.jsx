// Різниця цін: ▲ дорожче (червоним) / ▼ дешевше (зеленим) — сума і відсоток. d — { abs, pct } з lib/priceStats.
const pct = (v) => Math.abs(v).toLocaleString("uk-UA", { maximumFractionDigits: 1 });

export default function PriceDiff({ d, fmt, title }) {
  if (!d) return <span className="note">—</span>;
  if (Math.abs(d.pct) < 0.05) return <span className="note" title={title}>однаково</span>;
  const up = d.abs > 0;
  return (
    <span className={up ? "diff-up" : "diff-down"} title={title}>
      {up ? "▲ +" : "▼ −"}{fmt(Math.abs(d.abs))} <span className="diff-pct">({up ? "+" : "−"}{pct(d.pct)}%)</span>
    </span>
  );
}
