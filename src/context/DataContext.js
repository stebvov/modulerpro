"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DataContext = createContext(null);

const EMPTY = {
  materials: [],
  suppliers: [],
  supplierPrices: [],
  templates: [],
  bomItems: [],
  extraCosts: [],
  productCategories: [],
  materialCategories: [],
  bomGroups: [],
  exchangeRates: [],
  supplierCategoryLinks: [],
  supplierContacts: [],
  templateFiles: [],
  productCategoryLinks: [],
  priceHistory: [],
  profiles: [],
  materialUnits: [],
  services: [],
  serviceCategories: [],
  serviceTemplates: [],
  serviceTemplateItems: [],
  menuGroupOrder: [],
  menuHomeGroup: null,
};

export function DataProvider({ children }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currency, setCurrencyState] = useState("UAH");
  const [showDecimals, setShowDecimalsState] = useState(true);

  useEffect(() => {
    // Restoring the saved currency/decimals preference on load.
    const savedCurrency = localStorage.getItem("moduler_currency");
    if (savedCurrency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrencyState(savedCurrency);
    }
    const savedShowDecimals = localStorage.getItem("moduler_show_decimals");
    if (savedShowDecimals != null) {
      setShowDecimalsState(savedShowDecimals === "true");
    }
  }, []);

  const setCurrency = useCallback((value) => {
    setCurrencyState(value);
    localStorage.setItem("moduler_currency", value);
  }, []);
  const setShowDecimals = useCallback((value) => {
    setShowDecimalsState(value);
    localStorage.setItem("moduler_show_decimals", String(value));
  }, []);

  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [
          materials,
          suppliers,
          supplierPrices,
          templates,
          bomItems,
          extraCosts,
          productCategories,
          materialCategories,
          bomGroups,
          exchangeRates,
          supplierCategoryLinks,
          supplierContacts,
          templateFiles,
          productCategoryLinks,
          priceHistory,
          profiles,
          materialUnits,
          services,
          serviceCategories,
          serviceTemplates,
          serviceTemplateItems,
          menuSettings,
        ] = await Promise.all([
          supabase.from("materials").select("*").order("name"),
          supabase.from("suppliers").select("*").order("name"),
          supabase.from("supplier_prices").select("*"),
          supabase.from("product_templates").select("*").order("sort_order"),
          supabase.from("template_bom_items").select("*"),
          supabase.from("template_extra_costs").select("*"),
          supabase.from("product_categories").select("*").order("sort_order"),
          supabase.from("material_categories").select("*").order("sort_order"),
          supabase.from("bom_groups").select("*").order("sort_order"),
          supabase.from("exchange_rates").select("*"),
          supabase.from("supplier_category_links").select("*"),
          supabase.from("supplier_contacts").select("*").order("sort_order"),
          supabase.from("template_files").select("*").order("sort_order"),
          supabase.from("product_category_links").select("*"),
          supabase.from("supplier_price_history").select("*").order("changed_at", { ascending: false }),
          supabase.from("profiles").select("*").order("created_at"),
          supabase.from("material_units").select("*").order("sort_order"),
          supabase.from("services").select("*").order("sort_order"),
          supabase.from("service_categories").select("*").order("sort_order"),
          supabase.from("service_templates").select("*").order("sort_order"),
          supabase.from("service_template_items").select("*").order("sort_order"),
          supabase.from("app_menu_settings").select("*").eq("id", true).maybeSingle(),
        ]);

        const firstError = [
          materials, suppliers, supplierPrices, templates, bomItems, extraCosts,
          productCategories, materialCategories, bomGroups, exchangeRates,
          supplierCategoryLinks, supplierContacts, templateFiles, productCategoryLinks,
          priceHistory, profiles, materialUnits,
          services, serviceCategories, serviceTemplates, serviceTemplateItems, menuSettings,
        ].find((r) => r.error);
        if (firstError) throw firstError.error;

        setData({
          materials: materials.data || [],
          suppliers: suppliers.data || [],
          supplierPrices: supplierPrices.data || [],
          templates: templates.data || [],
          bomItems: bomItems.data || [],
          extraCosts: extraCosts.data || [],
          productCategories: productCategories.data || [],
          materialCategories: materialCategories.data || [],
          bomGroups: bomGroups.data || [],
          exchangeRates: exchangeRates.data || [],
          supplierCategoryLinks: supplierCategoryLinks.data || [],
          supplierContacts: supplierContacts.data || [],
          templateFiles: templateFiles.data || [],
          productCategoryLinks: productCategoryLinks.data || [],
          priceHistory: priceHistory.data || [],
          profiles: profiles.data || [],
          materialUnits: materialUnits.data || [],
          services: services.data || [],
          serviceCategories: serviceCategories.data || [],
          serviceTemplates: serviceTemplates.data || [],
          serviceTemplateItems: serviceTemplateItems.data || [],
          menuGroupOrder: menuSettings.data?.group_order || [],
          menuHomeGroup: menuSettings.data?.home_group || null,
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

  const value = { ...data, loading, error, reload, currency, setCurrency, showDecimals, setShowDecimals, supabase };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useAppData must be used within DataProvider");
  return ctx;
}
