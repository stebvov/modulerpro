"use client";

import { fmtMonthShort } from "@/lib/finance";

// Cumulative net profit trend — hand-rolled SVG line/area chart.
export default function CumulativeTrendChart({ rows }) {
  if (!rows.length) return null;
  const W = 640, H = 200, padL = 10, padR = 10, padT = 10, padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const values = rows.map((r) => Number(r.cumulative_net_profit || 0));
  const maxV = Math.max(...values, 0, 1);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;

  function yFor(v) {
    return padT + innerH * ((maxV - v) / range);
  }
  function xFor(i) {
    return rows.length > 1 ? padL + innerW * (i / (rows.length - 1)) : padL + innerW / 2;
  }
  const zeroY = yFor(0);
  const linePoints = rows.map((r, i) => `${xFor(i)},${yFor(Number(r.cumulative_net_profit || 0))}`).join(" ");
  const areaPoints = `${xFor(0)},${zeroY} ${linePoints} ${xFor(rows.length - 1)},${zeroY}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="var(--border-strong)" strokeWidth="1" />
      <polygon points={areaPoints} fill="var(--accent-bg)" />
      <polyline points={linePoints} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {rows.map((r, i) => (
        <text key={i} x={xFor(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{fmtMonthShort(r.month)}</text>
      ))}
    </svg>
  );
}
