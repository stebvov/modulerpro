"use client";

// Standalone "% завантаженості" widget — reads its own data via
// useProductionData(), so it can be dropped into any screen (e.g. a
// future CRM deal card) as long as that screen is wrapped in
// <ProductionDataProvider>. No required props.
import { useProductionData } from "@/context/ProductionDataContext";
import { siteUtilization } from "@/lib/production";

export default function ProductionLoadWidget({ title = "Завантаженість майданчиків (4 тижні)" }) {
  const { sites, slots, loading } = useProductionData();

  if (loading) return null;

  return (
    <div>
      <div className="section-label">{title}</div>
      <div className="ops-kpi-grid">
        {sites.map((site) => {
          const pct = siteUtilization(site, slots);
          return (
            <div className="ops-kpi" key={site.id}>
              <div className="k-label">{site.name}</div>
              <div className="k-value">{pct == null ? "—" : `${pct}%`}</div>
              {pct != null && (
                <div className="k-bar">
                  <div className={`k-bar-fill${pct > 100 ? " over" : ""}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              )}
            </div>
          );
        })}
        {!sites.length && <div className="ops-kpi"><div className="k-label">Немає майданчиків</div></div>}
      </div>
    </div>
  );
}
