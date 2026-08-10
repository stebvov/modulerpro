"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import ProfileMenu from "@/components/ProfileMenu";
import CurrencyMenu from "@/components/CurrencyMenu";
import { CrmDataProvider } from "@/context/CrmDataContext";
import CrmScreen from "@/components/screens/CrmScreen";
import { ProductionDataProvider } from "@/context/ProductionDataContext";
import ProductionScreen from "@/components/screens/ProductionScreen";
import { ServicesDataProvider } from "@/context/ServicesDataContext";
import ServicesScreen from "@/components/screens/ServicesScreen";
import { MarketingDataProvider } from "@/context/MarketingDataContext";
import MarketingScreen from "@/components/screens/MarketingScreen";
import { FinanceDataProvider } from "@/context/FinanceDataContext";
import FinanceScreen from "@/components/screens/FinanceScreen";
import CatalogScreen from "@/components/screens/CatalogScreen";
import MaterialsScreen from "@/components/screens/MaterialsScreen";
import SuppliersScreen from "@/components/screens/SuppliersScreen";
import CategoriesScreen from "@/components/screens/CategoriesScreen";
import PriceScreen from "@/components/screens/PriceScreen";
import ServicesCatalogScreen from "@/components/screens/ServicesCatalogScreen";
import ServiceTemplatesScreen from "@/components/screens/ServiceTemplatesScreen";
import UsersScreen from "@/components/screens/UsersScreen";
import AccessGroupsScreen from "@/components/screens/AccessGroupsScreen";
import { TeamDataProvider } from "@/context/TeamDataContext";
import TeamScreen from "@/components/screens/TeamScreen";

const TAB_GROUPS = [
  { key: "crm", label: "CRM", tabs: [{ id: "crm", label: "CRM" }] },
  { key: "production", label: "Виробництво", tabs: [{ id: "production", label: "Виробництво" }] },
  { key: "services", label: "Послуги", tabs: [{ id: "services", label: "Послуги" }] },
  { key: "marketing", label: "Маркетинг", tabs: [{ id: "marketing", label: "Маркетинг" }] },
  {
    key: "catalog",
    label: "Каталог",
    tabs: [
      { id: "catalog", label: "Каталог шаблонів" },
      { id: "materials", label: "Матеріали" },
      { id: "suppliers", label: "Постачальники" },
      { id: "categories", label: "Категорії" },
      { id: "price", label: "Ціни" },
      { id: "catalog-services", label: "Послуги" },
      { id: "service-templates", label: "Шаблони послуг" },
    ],
  },
];

export default function AppShell() {
  const { currency, setCurrency } = useAppData();
  const { isAdmin, canWriteFinance, isPartner, partnerTabs } = useAuth();
  const [activeTab, setActiveTab] = useState("catalog");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  let groups = TAB_GROUPS;
  if (isPartner) groups = groups.filter((g) => (partnerTabs || new Set()).has(g.key));
  if (canWriteFinance) groups = [...groups, { key: "finance", label: "Фінанси", tabs: [{ id: "finance", label: "Фінанси" }] }];
  if (isAdmin) groups = [...groups, { key: "admin", label: "Адміністрування", tabs: [{ id: "users", label: "Користувачі" }, { id: "team", label: "Люди та ролі" }, { id: "access-groups", label: "Ролі доступу" }] }];
  const activeGroup = groups.find((g) => g.tabs.some((t) => t.id === activeTab)) || groups[0];
  const activeTabInfo = activeGroup?.tabs.find((t) => t.id === activeTab) || activeGroup?.tabs[0];

  useEffect(() => {
    if (!isPartner || !partnerTabs) return;
    const allowedIds = groups.flatMap((g) => g.tabs.map((t) => t.id));
    if (allowedIds.length && !allowedIds.includes(activeTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(allowedIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPartner, partnerTabs, activeTab]);

  function selectGroup(g) {
    setActiveTab(g.tabs[0].id);
    setMobileMenuOpen(false);
  }

  function toggleGroupExpanded(label) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  return (
    <div className="app">
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-brand">Moduler Pro</div>
            {groups.map((g) => (
              <button
                key={g.label}
                className={`mobile-drawer-link${g === activeGroup ? " active" : ""}`}
                onClick={() => selectGroup(g)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="shell">
        {!sidebarCollapsed && (
          <div className="sidebar">
            <div className="sidebar-brand-row">
              <div className="sidebar-brand">Moduler Pro</div>
              <button className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed(true)} title="Сховати меню" aria-label="Сховати меню">⟨</button>
            </div>
            <div className="sidebar-groups">
              {groups.map((g) => {
                const [mainTab, ...restTabs] = g.tabs;
                const isExpanded = expandedGroups.has(g.label) || restTabs.some((t) => t.id === activeTab);
                return (
                  <div className="sidebar-group" key={g.label}>
                    <div className="sidebar-group-row">
                      <button
                        className={`sidebar-link${activeTab === mainTab.id ? " active" : ""}`}
                        onClick={() => setActiveTab(mainTab.id)}
                      >
                        {g.label}
                      </button>
                      {restTabs.length > 0 && (
                        <button
                          className="sidebar-expand-btn"
                          onClick={() => toggleGroupExpanded(g.label)}
                          aria-label={isExpanded ? "Згорнути" : "Розгорнути"}
                        >
                          {isExpanded ? "▾" : "▸"}
                        </button>
                      )}
                    </div>
                    {restTabs.length > 0 && isExpanded && (
                      <div className="sidebar-subgroup">
                        {restTabs.map((t) => (
                          <button
                            key={t.id}
                            className={`sidebar-link sub${activeTab === t.id ? " active" : ""}`}
                            onClick={() => setActiveTab(t.id)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="main-content">
          <div className="top-bar">
            <div className="top-bar-left">
              <button className="hamburger-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Меню">☰</button>
              {sidebarCollapsed && (
                <button className="btn small sidebar-reopen-btn" onClick={() => setSidebarCollapsed(false)} title="Показати меню">☰ Меню</button>
              )}
              <h1 className="page-title">{activeTabInfo?.label}</h1>
            </div>
            <div className="top-bar-right">
              <CurrencyMenu currency={currency} onChange={setCurrency} />
              <ProfileMenu />
            </div>
          </div>

          {activeGroup && activeGroup.tabs.length > 1 && (
            <div className="mobile-subtabs">
              {activeGroup.tabs.map((t) => (
                <button
                  key={t.id}
                  className={`mobile-subtab${activeTab === t.id ? " active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className={`screen${activeTab === "crm" ? " active" : ""}`}>
            {activeTab === "crm" && (
              <CrmDataProvider>
                <CrmScreen />
              </CrmDataProvider>
            )}
          </div>
          <div className={`screen${activeTab === "production" ? " active" : ""}`}>
            {activeTab === "production" && (
              <ProductionDataProvider>
                <ProductionScreen />
              </ProductionDataProvider>
            )}
          </div>
          <div className={`screen${activeTab === "services" ? " active" : ""}`}>
            {activeTab === "services" && (
              <ServicesDataProvider>
                <ServicesScreen />
              </ServicesDataProvider>
            )}
          </div>
          <div className={`screen${activeTab === "marketing" ? " active" : ""}`}>
            {activeTab === "marketing" && (
              <MarketingDataProvider>
                <MarketingScreen />
              </MarketingDataProvider>
            )}
          </div>
          <div className={`screen${activeTab === "finance" ? " active" : ""}`}>
            {activeTab === "finance" && canWriteFinance && (
              <FinanceDataProvider>
                <FinanceScreen />
              </FinanceDataProvider>
            )}
          </div>
          <div className={`screen${activeTab === "catalog" ? " active" : ""}`}>
            {activeTab === "catalog" && <CatalogScreen />}
          </div>
          <div className={`screen${activeTab === "materials" ? " active" : ""}`}>
            {activeTab === "materials" && <MaterialsScreen />}
          </div>
          <div className={`screen${activeTab === "suppliers" ? " active" : ""}`}>
            {activeTab === "suppliers" && <SuppliersScreen />}
          </div>
          <div className={`screen${activeTab === "categories" ? " active" : ""}`}>
            {activeTab === "categories" && <CategoriesScreen />}
          </div>
          <div className={`screen${activeTab === "price" ? " active" : ""}`}>
            {activeTab === "price" && <PriceScreen />}
          </div>
          <div className={`screen${activeTab === "catalog-services" ? " active" : ""}`}>
            {activeTab === "catalog-services" && <ServicesCatalogScreen />}
          </div>
          <div className={`screen${activeTab === "service-templates" ? " active" : ""}`}>
            {activeTab === "service-templates" && <ServiceTemplatesScreen />}
          </div>
          {isAdmin && (
            <div className={`screen${activeTab === "users" ? " active" : ""}`}>
              {activeTab === "users" && <UsersScreen />}
            </div>
          )}
          {isAdmin && (
            <div className={`screen${activeTab === "team" ? " active" : ""}`}>
              {activeTab === "team" && (
                <TeamDataProvider>
                  <TeamScreen />
                </TeamDataProvider>
              )}
            </div>
          )}
          {isAdmin && (
            <div className={`screen${activeTab === "access-groups" ? " active" : ""}`}>
              {activeTab === "access-groups" && <AccessGroupsScreen />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
