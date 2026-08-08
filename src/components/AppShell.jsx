"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { roleLabels } from "@/lib/format";
import { CrmDataProvider } from "@/context/CrmDataContext";
import CrmScreen from "@/components/screens/CrmScreen";
import { ProductionDataProvider } from "@/context/ProductionDataContext";
import ProductionScreen from "@/components/screens/ProductionScreen";
import CatalogScreen from "@/components/screens/CatalogScreen";
import CompareScreen from "@/components/screens/CompareScreen";
import MaterialsScreen from "@/components/screens/MaterialsScreen";
import SuppliersScreen from "@/components/screens/SuppliersScreen";
import CategoriesScreen from "@/components/screens/CategoriesScreen";
import PriceByMaterialScreen from "@/components/screens/PriceByMaterialScreen";
import PriceBySupplierScreen from "@/components/screens/PriceBySupplierScreen";
import UsersScreen from "@/components/screens/UsersScreen";

const TAB_GROUPS = [
  { label: "Продажі", tabs: [{ id: "crm", label: "CRM" }] },
  { label: "Виробництво", tabs: [{ id: "production", label: "Виробництво" }] },
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
  const { profile, user, role, isAdmin, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("catalog");
  const [compareSelection, setCompareSelection] = useState([]);

  const groups = isAdmin ? [...TAB_GROUPS, { label: "Адміністрування", tabs: [{ id: "users", label: "Користувачі" }] }] : TAB_GROUPS;

  return (
    <div className="app">
      <div className="shell">
        <div className="sidebar">
          <div className="sidebar-brand">Moduler Pro</div>
          <div className="sidebar-groups">
            {groups.map((g) => (
              <div className="sidebar-group" key={g.label}>
                <div className="sidebar-group-label">{g.label}</div>
                {g.tabs.map((t) => (
                  <button
                    key={t.id}
                    className={`sidebar-link${activeTab === t.id ? " active" : ""}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="main-content">
          <div className="top-bar">
            <div>
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
        </div>
      </div>
    </div>
  );
}
