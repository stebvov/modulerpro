"use client";
// Інвест-калькулятор: дохід = середній чек за ніч × 365 × завантаження × частка інвестора.
// Відвідувач обирає сценарій або рухає повзунок — одразу бачить дохід, дохідність, окупність і суму за горизонт.
import { useState } from "react";
import { money } from "@/lib/site/format";

export default function InvestCalc({ b }) {
  const price = Number(b.price) || 0;
  const night = Number(b.night) || 0;
  const share = (Number(b.share) || 0) / 100;
  const years = Number(b.years) || 10;
  const cur = b.currency || "USD";
  const scenarios = (b.scenarios || []).filter((x) => Number(x.occupancy) > 0);
  const [occ, setOcc] = useState(Number(b.occupancy) || Number(scenarios[1]?.occupancy) || 40);

  const revenue = night * 365 * (occ / 100);
  const income = revenue * share;
  const roi = price ? (income / price) * 100 : 0;
  const payback = income ? price / income : 0;
  const total = income * years;
  const pct = (v) => `${v.toFixed(1).replace(".", ",")}%`;

  return (
    <div className="s-inv">
      <div className="s-inv__in">
        {!!scenarios.length && (
          <div className="s-inv__sc" role="tablist">
            {scenarios.map((x, i) => (
              <button key={i} type="button" role="tab" aria-selected={Number(x.occupancy) === occ} className={Number(x.occupancy) === occ ? "on" : ""} onClick={() => setOcc(Number(x.occupancy))}>
                <b>{x.name}</b><small>{x.occupancy}% завантаження</small>
              </button>
            ))}
          </div>
        )}
        <label className="s-field s-inv__slider">
          <span>Завантаження будинку за рік: <b>{occ}%</b> · ≈ {Math.round(365 * occ / 100)} ночей</span>
          <input type="range" min={15} max={80} step={1} value={occ} onChange={(e) => setOcc(Number(e.target.value))} />
        </label>
        {scenarios.find((x) => Number(x.occupancy) === occ)?.note && <p className="s-inv__note">{scenarios.find((x) => Number(x.occupancy) === occ).note}</p>}
        <ul className="s-inv__params">
          <li><span>Ціна входу під ключ</span><b>{money(price, cur)}</b></li>
          <li><span>Середній чек за ніч</span><b>{money(night, cur)}</b></li>
          <li><span>Виручка будинку за рік</span><b>{money(revenue, cur)}</b></li>
          <li><span>Ваша частка{b.payout ? ` · ${b.payout}` : ""}</span><b>{Math.round(share * 100)}%</b></li>
        </ul>
      </div>
      <div className="s-inv__out">
        <div className="s-calc__label">Ваш дохід на рік</div>
        <div className="s-calc__sum">{money(income, cur)}</div>
        <div className="s-inv__kpi">
          <div><b>{pct(roi)}</b><span>річних</span></div>
          <div><b>{payback ? `${payback.toFixed(1).replace(".", ",")} р.` : "—"}</b><span>окупність</span></div>
          <div><b>{money(total, cur)}</b><span>за {years} повних років</span></div>
        </div>
        {b.note && <p className="s-calc__note">{b.note}</p>}
        {b.cta?.label && <a className="s-btn s-btn--primary s-btn--block" href={b.cta.href || "#contact"}>{b.cta.label}</a>}
      </div>
    </div>
  );
}
