"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CrmDataContext = createContext(null);

const EMPTY = {
  pipelines: [],
  pipelineStages: [],
  dealsKanban: [],
  deals: [],
  dealServices: [],
  dealActivities: [],
  dealAttachments: [],
  leads: [],
  leadContacts: [],
  leadCategoryLinks: [],
  serviceRateCards: [],
  teamMembers: [],
  productCategories: [],
  templates: [],
  bomItems: [],
  extraCosts: [],
  supplierPrices: [],
  marginAlerts: [],
};

export function CrmDataProvider({ children }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [
          pipelines,
          pipelineStages,
          dealsKanban,
          deals,
          dealServices,
          dealActivities,
          dealAttachments,
          leads,
          leadContacts,
          leadCategoryLinks,
          serviceRateCards,
          teamMembers,
          productCategories,
          templates,
          bomItems,
          extraCosts,
          supplierPrices,
          marginAlerts,
        ] = await Promise.all([
          supabase.from("pipelines").select("*").order("sort_order"),
          supabase.from("pipeline_stages").select("*").order("sort_order"),
          supabase.from("v_deals_kanban").select("*"),
          supabase.from("deals").select("*"),
          supabase.from("deal_services").select("*"),
          supabase.from("deal_activities").select("*").order("created_at", { ascending: false }),
          supabase.from("deal_attachments").select("*").order("created_at", { ascending: false }),
          supabase.from("leads").select("*"),
          supabase.from("lead_contacts").select("*"),
          supabase.from("lead_category_links").select("*"),
          supabase.from("service_rate_cards").select("*").eq("active", true),
          supabase.from("team_members").select("*").order("name"),
          supabase.from("product_categories").select("*").order("sort_order"),
          supabase.from("product_templates").select("id,name,area_m2,base_cost_per_m2,status").order("sort_order"),
          supabase.from("template_bom_items").select("template_id,material_id,quantity_per_unit,unit_price_override"),
          supabase.from("template_extra_costs").select("template_id,amount"),
          supabase.from("supplier_prices").select("material_id,price"),
          supabase.from("v_deal_margin_alerts").select("*"),
        ]);

        const firstError = [
          pipelines, pipelineStages, dealsKanban, deals, dealServices, dealActivities,
          dealAttachments, leads, leadContacts, leadCategoryLinks, serviceRateCards, teamMembers, productCategories, templates,
          bomItems, extraCosts, supplierPrices, marginAlerts,
        ].find((r) => r.error);
        if (firstError) throw firstError.error;

        setData({
          pipelines: pipelines.data || [],
          pipelineStages: pipelineStages.data || [],
          dealsKanban: dealsKanban.data || [],
          deals: deals.data || [],
          dealServices: dealServices.data || [],
          dealActivities: dealActivities.data || [],
          dealAttachments: dealAttachments.data || [],
          leads: leads.data || [],
          leadContacts: leadContacts.data || [],
          leadCategoryLinks: leadCategoryLinks.data || [],
          serviceRateCards: serviceRateCards.data || [],
          teamMembers: teamMembers.data || [],
          productCategories: productCategories.data || [],
          templates: templates.data || [],
          bomItems: bomItems.data || [],
          extraCosts: extraCosts.data || [],
          supplierPrices: supplierPrices.data || [],
          marginAlerts: marginAlerts.data || [],
        });
        setError(null);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    // Initial data fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const value = { ...data, loading, error, reload, supabase };

  return <CrmDataContext.Provider value={value}>{children}</CrmDataContext.Provider>;
}

export function useCrmData() {
  const ctx = useContext(CrmDataContext);
  if (!ctx) throw new Error("useCrmData must be used within CrmDataProvider");
  return ctx;
}
