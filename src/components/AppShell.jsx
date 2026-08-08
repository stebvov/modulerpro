"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { roleLabels } from "@/lib/format";
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
import CompareScreen from "@/components/screens/CompareScreen";
import MaterialsScreen from "@/components/screens/MaterialsScreen";
import SuppliersScreen from "@/components/screens/SuppliersScreen";
import CategoriesScreen from "@/components/screens/CategoriesScreen";
import PriceByMaterialScreen from "@/components/screens/PriceByMaterialScreen";
import PriceBySupplierScreen from "@/components/screens/PriceBySupplierScreen";
import UsersScreen from "@/components/screens/UsersScreen";
import { TeamDataProvider } from "@/context/TeamDataContext";
import TeamScreen from "@/components/screens/TeamScreen";
import ChangePasswordModal from "@/components/modals/ChangePasswordModal";

const TAB_GROUPS = [
  { label: "CRM", tabs: [{ id: "crm", label: "CRM" }] },
  { label: "Виробництво", tabs: [{ id: "production", label: "Виробництво" }] },
  { label: "Послуги", tabs: [{ id: "services", label: "Послуги" }] },
  { label: "Маркетинг", tabs: [{ id: "marketing", label: "Маркетинг" }] },
  {
    label: "Каталог",
    tabs: [
      { id: "catalog", label: "Каталог шаблонів" },
      { id: "compare", label: "Порівняння" },
      { id: "materials", label: "Матеріали" },
      { id: "suppliers", label: "Постачальники" },
      { id: "categories", label: "Категорії" },
      { id: "price-by-material", label: "Ціни за товаром" },
      { id: "price-by-supplier", label: "Ціни за постачальником" },
    ],
  },
];

export default function AppShell() {
  const { loading, error, currency, setCurrency } = useAppData();
  const { profile, user, role, isAdmin, canWriteFinance, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("catalog");
  const [compareSelection, setCompareSelection] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  let groups = TAB_GROUPS;
  if (canWriteFinance) groups = [...groups, { label: "Фінанси", tabs: [{ id: "finance", label: "Фінанси" }] }];
  if (isAdmin) groups = [...groups, { label: "Адміністрування", tabs: [{ id: "users", label: "Користувачі" }, { id: "team", label: "Люди та ролі" }] }];
  const activeGroup = groups.find((g) => g.tabs.some((t) => t.id === activeTab)) || groups[0];

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
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Меню">☰</button>
        <span className="mobile-group-title">{activeGroup.label}</span>
      </div>
      {activeGroup.tabs.length > 1 && (
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {sidebarCollapsed && (
                <button className="btn small" onClick={() => setSidebarCollapsed(false)} title="Показати меню">☰ Меню</button>
              )}
              <div className={`live-badge${error ? " error" : ""}`}>
                <span className="live-dot" />
                <span>{loading ? "Підключення..." : error ? "Помилка підключення: " + error : "Підключено до Supabase"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div className="role-badge">
                {profile?.full_name || user?.email}
                <span className={`role-pill ${role}`}>{roleLabels[role] || role}</span>
              </div>
              <button className="btn small" onClick={() => setPasswordModalOpen(true)}>Змінити пароль</button>
              <button className="btn small" onClick={signOut}>Вийти</button>
              <div className="currency-switch">
                {["UAH", "USD", "EUR"].map((c) => (
                  <span key={c} className={currency === c ? "active" : ""} onClick={() => setCurrency(c)}>
                    {{ UAH: "грн", USD: "$", EUR: "€" }[c]}
                  </span>
                ))}
              </div>
            </div>
          </div>

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
            {activeTab === "catalog" && <CatalogScreen compareSelection={compareSelection} setCompareSelection={setCompareSelection} />}
          </div>
          <div className={`screen${activeTab === "compare" ? " active" : ""}`}>
            {activeTab === "compare" && <CompareScreen compareSelection={compareSelection} />}
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
          <div className={`screen${activeTab === "price-by-material" ? " active" : ""}`}>
            {activeTab === "price-by-material" && <PriceByMaterialScreen />}
          </div>
          <div className={`screen${activeTab === "price-by-supplier" ? " active" : ""}`}>
            {activeTab === "price-by-supplier" && <PriceBySupplierScreen />}
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
        </div>
      </div>

      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  );
}
