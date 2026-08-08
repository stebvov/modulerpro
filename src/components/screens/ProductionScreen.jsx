"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProductionData } from "@/context/ProductionDataContext";
import ProductionLoadWidget from "@/components/ProductionLoadWidget";
import SlotModal from "@/components/modals/SlotModal";
import ProductionSettingsModal from "@/components/modals/ProductionSettingsModal";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import { addWeeks, fmtWeekLabel, overlaps, rangeToPercent, startOfWeek, statusStyles } from "@/lib/production";

const WEEKS_VISIBLE = 8;

function layoutBars(siteSlots) {
  const lane0 = [];
  const items = [];
  const sorted = [...siteSlots].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  sorted.forEach((slot) => {
    const clash = lane0.some((s) => overlaps(s.start_date, s.deadline, slot.start_date, slot.deadline));
    const lane = clash ? 1 : 0;
    if (lane === 0) lane0.push(slot);
    items.push({ slot, lane });
  });
  return items;
}

export default function ProductionScreen() {
  const { loading, error, sites, slots, houseDeals } = useProductionData();
  const { canWriteCatalog } = useAuth();
  const [windowStart, setWindowStart] = useState(() => startOfWeek(new Date()));
  const [modal, setModal] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [siteFilter, setSiteFilter] = useState([]);

  const windowEnd = useMemo(() => addWeeks(windowStart, WEEKS_VISIBLE), [windowStart]);
  const weeks = useMemo(() => Array.from({ length: WEEKS_VISIBLE }, (_, i) => addWeeks(windowStart, i)), [windowStart]);
  const siteOptions = useMemo(() => sites.map((s) => ({ id: s.id, label: s.name })), [sites]);
  const visibleSites = siteFilter.length ? sites.filter((s) => siteFilter.includes(s.id)) : sites;

  function dealLabelFor(dealId) {
    const d = houseDeals.find((x) => x.id === dealId);
    return d ? d.lead_name || "угода" : null;
  }

  if (loading) return <div className="empty">Завантаження виробництва...</div>;
  if (error) return <div className="empty">Помилка підключення: {error}</div>;

  return (
    <div>
      <p className="note">Календар майданчиків, завантаженість і чек-лист етапів по кожному юніту.</p>

      <ProductionLoadWidget />

      <div className="section-label">
        Календар майданчиків
        {canWriteCatalog && (
          <button className="btn small" onClick={() => setSettingsOpen(true)} title="Налаштування">⚙</button>
        )}
      </div>
      <div className="gantt-nav">
        <div className="seg-row" style={{ alignItems: "center" }}>
          <button className="seg-btn" onClick={() => setWindowStart(addWeeks(windowStart, -WEEKS_VISIBLE))}>← {WEEKS_VISIBLE} тижнів</button>
          <button className="seg-btn" onClick={() => setWindowStart(startOfWeek(new Date()))}>Сьогодні</button>
          <button className="seg-btn" onClick={() => setWindowStart(addWeeks(windowStart, WEEKS_VISIBLE))}>{WEEKS_VISIBLE} тижнів →</button>
          <MultiSelectFilter options={siteOptions} selected={siteFilter} onChange={setSiteFilter} label="Майданчики" />
        </div>
        <div className="note">
          {fmtWeekLabel(windowStart)} — {fmtWeekLabel(addWeeks(windowEnd, -1))}
        </div>
      </div>

      <div className="table-scroll">
        <div style={{ minWidth: 760 }}>
        <div className="gantt-header">
          <div />
          <div className="gantt-weeks">
            {weeks.map((w, i) => <div key={i} className="gantt-week-label">{fmtWeekLabel(w)}</div>)}
          </div>
        </div>
        {visibleSites.map((site) => {
          const siteSlots = slots.filter((s) => s.site_id === site.id && overlaps(s.start_date, s.deadline, windowStart, windowEnd));
          const bars = layoutBars(siteSlots);
          return (
            <div className="gantt-row" key={site.id}>
              <div className="gantt-row-label">
                <div className="site-name">{site.name}</div>
                <div className="site-meta">
                  {site.responsible_person || "—"}{site.capacity_units_per_month ? ` · ${site.capacity_units_per_month}/міс` : ""}
                </div>
                {canWriteCatalog && (
                  <button className="btn small" style={{ marginTop: 6 }} onClick={() => setModal({ slot: null, defaultSiteId: site.id })}>+ Слот</button>
                )}
              </div>
              <div className="gantt-track">
                <div className="gantt-track-grid">{weeks.map((_, i) => <span key={i} />)}</div>
                {bars.map(({ slot, lane }) => {
                  const pos = rangeToPercent(slot.start_date, slot.deadline, windowStart.getTime(), windowEnd.getTime());
                  if (!pos) return null;
                  const label = slot.deal_id ? dealLabelFor(slot.deal_id) || "угода" : "вільно";
                  const style = statusStyles[slot.status];
                  return (
                    <div
                      key={slot.id}
                      className={`gantt-bar${lane === 1 ? " row2" : ""}`}
                      style={{ left: `${pos.left}%`, width: `${pos.width}%`, background: style.bg, color: style.text }}
                      title={`${slot.status}${slot.deal_id ? " · " + label : ""}`}
                      onClick={() => setModal({ slot })}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!visibleSites.length && <div className="empty">{sites.length ? "Немає майданчиків за фільтром." : "Немає жодного майданчика."}</div>}
        </div>
      </div>

      {modal && (
        <SlotModal
          open
          slot={modal.slot || null}
          defaultSiteId={modal.defaultSiteId}
          onClose={() => setModal(null)}
          onSaved={() => setModal(null)}
        />
      )}
      <ProductionSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
