"use client";

import { marginProduction, marginServices, fmtMonthShort } from "@/lib/finance";

// Grouped bar chart: production margin vs. services margin per month.
// Hand-rolled SVG (no charting dependency) — handles negative margins
// by drawing bars from a computed zero baseline.
export default function MonthlyMarginChart({ rows }) {
  if (!rows.length) return null;
  const W = 640, H = 220, padL = 10, padR = 10, padT = 10, padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const bars = rows.map((r) => ({ month: r.month, prod: marginProduction(r), serv: marginServices(r) }));
  const allValues = bars.flatMap((b) => [b.prod, b.serv, 0]);
  const maxV = Math.max(...allValues, 1);
  const minV = Math.min(...allValues, 0);
  const range = maxV - minV || 1;

  function yFor(v) {
    return padT + innerH * ((maxV - v) / range);
  }
  const zeroY = yFor(0);
  const slotW = innerW / bars.length;
  const barW = Math.min(slotW * 0.32, 26);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="var(--border-strong)" strokeWidth="1" />
      {bars.map((b, i) => {
        const cx = padL + slotW * i + slotW / 2;
        const prodY = yFor(b.prod);
        const servY = yFor(b.serv);
        return (
          <g key={i}>
            <rect x={cx - barW - 2} y={Math.min(prodY, zeroY)} width={barW} height={Math.max(Math.abs(prodY - zeroY), 1)} fill="var(--accent)" rx="2" />
            <rect x={cx + 2} y={Math.min(servY, zeroY)} width={barW} height={Math.max(Math.abs(servY - zeroY), 1)} fill="var(--success)" rx="2" />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{fmtMonthShort(b.month)}</text>
          </g>
        );
      })}
    </svg>
  );
}
