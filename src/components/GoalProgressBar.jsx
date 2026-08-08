"use client";

import { GOAL_NET_PROFIT_USD, fmtUsd } from "@/lib/finance";

// Ported from the finance prototype's "measuring tape" — a ruler-style
// progress bar with 5% tick marks — reworked for the app's light theme
// instead of copying the prototype's dark inline CSS.
export default function GoalProgressBar({ valueUsd, goal = GOAL_NET_PROFIT_USD }) {
  const pct = Math.max(0, Math.min(100, (valueUsd / goal) * 100));
  const ticks = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>
            {fmtUsd(valueUsd)} <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-secondary)" }}>накопичено</span>
          </div>
        </div>
        <div className="note" style={{ textAlign: "right" }}>ЦІЛЬ: {fmtUsd(goal)} / МІС</div>
      </div>
      <div style={{ position: "relative", height: 44, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`, background: "var(--accent)", transition: "width 0.6s ease" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {ticks.map((t) => (
            <div key={t} style={{ flex: 1, borderRight: "1px solid rgba(0,0,0,0.08)", position: "relative" }}>
              {t % 25 === 0 && (
                <span style={{ position: "absolute", bottom: 2, right: 2, fontSize: 9, color: t <= pct ? "rgba(255,255,255,0.85)" : "var(--text-muted)" }}>
                  {t}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
