"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_HOME, MENU } from "@/lib/menu";
import ProfileMenu from "@/components/ProfileMenu";
import CurrencyMenu from "@/components/CurrencyMenu";
import PultFrame from "@/components/PultFrame";
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
import MenuSettingsScreen from "@/components/screens/MenuSettingsScreen";
import { TeamDataProvider } from "@/context/TeamDataContext";
import TeamScreen from "@/components/screens/TeamScreen";
import TownsScreen from "@/components/screens/TownsScreen";
import UkScreen from "@/components/screens/UkScreen";
import RentScreen from "@/components/screens/RentScreen";

// Екрани Moduler Pro (React). Вкладки "pult-*" показує PultFrame.
const SCREENS = {
  crm: () => <CrmDataProvider><CrmScreen /></CrmDataProvider>,
  production: () => <ProductionDataProvider><ProductionScreen /></ProductionDataProvider>,
  services: () => <ServicesDataProvider><ServicesScreen /></ServicesDataProvider>,
  marketing: () => <MarketingDataProvider><MarketingScreen /></MarketingDataProvider>,
  finance: () => <FinanceDataProvider><FinanceScreen /></FinanceDataProvider>,
  catalog: () => <CatalogScreen />,
  materials: () => <MaterialsScreen />,
  suppliers: () => <SuppliersScreen />,
  categories: () => <CategoriesScreen />,
  price: () => <PriceScreen />,
  "catalog-services": () => <ServicesCatalogScreen />,
  "service-templates": () => <ServiceTemplatesScreen />,
  towns: () => <TownsScreen />,
  uk: () => <UkScreen />,
  rent: () => <RentScreen />,
  users: () => <UsersScreen />,
  team: () => <TeamDataProvider><TeamScreen /></TeamDataProvider>,
  "access-groups": () => <AccessGroupsScreen />,
  "menu-settings": () => <MenuSettingsScreen />,
};

const isPult = (id) => id?.startsWith("pult-");

// учасник команди пульту (task_members) для поточного email: засновник, керівник, чи взагалі в команді
function usePultMember(email) {
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState(undefined);
  useEffect(() => {
    if (!email) return;
    let on = true;
    supabase.from("task_members").select("id,name,is_owner,can_manage,fin_all,active").ilike("email", email).eq("active", true).maybeSingle()
      .then(({ data }) => { if (on) setMember(data || null); });
    return () => { on = false; };
  }, [supabase, email]);
  return member;
}

function readUrl() {
  if (typeof window === "undefined") return { s: null, hash: "" };
  return { s: new URLSearchParams(window.location.search).get("s"), hash: window.location.hash || "" };
}

export default function AppShell() {
  const { currency, setCurrency, menuGroupOrder, menuHomeGroup } = useAppData();
  const { user, profile, loading, isAdmin, canWriteFinance, isPartner, partnerTabs } = useAuth();
  const member = usePultMember(user?.email);
  const [start] = useState(readUrl);
  const [activeTab, setActiveTab] = useState(start.s || null);
  const [pultOpened, setPultOpened] = useState(() => isPult(start.s));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const hasMp = !!profile && !isPartner;
  const inTeam = !!member;
  const groups = useMemo(() => {
    const can = (need) =>
      need === "any" ? hasMp || inTeam
      : need === "mp" ? hasMp
      : need === "team" ? inTeam
      : need === "owner" ? !!member?.is_owner
      : need === "mgr" ? !!(member?.can_manage || member?.is_owner)
      : need === "finance" ? canWriteFinance
      : need === "admin" ? isAdmin
      : true;
    let g = MENU.filter((x) => can(x.need)).map((x) => ({ ...x, tabs: x.tabs.filter((t) => !t.need || can(t.need)) }));
    // зовнішній партнер бачить лише відкриті йому групи Moduler Pro
    if (isPartner) g = MENU.filter((x) => (partnerTabs || new Set()).has(x.key));
    if (menuGroupOrder?.length) {
      const idx = new Map(menuGroupOrder.map((k, i) => [k, i]));
      g = [...g].sort((a, b) => (idx.get(a.key) ?? 100 + MENU.indexOf(a)) - (idx.get(b.key) ?? 100 + MENU.indexOf(b)));
    }
    return g;
  }, [hasMp, inTeam, member, isPartner, partnerTabs, canWriteFinance, isAdmin, menuGroupOrder]);

  const ready = !loading && (member !== undefined || !user);
  const allIds = groups.flatMap((g) => g.tabs.map((t) => t.id));

  // стартова вкладка: з адреси (?s=), інакше домашня група з налаштувань меню
  useEffect(() => {
    if (!ready || (activeTab && allIds.includes(activeTab))) return;
    const home = groups.find((g) => g.key === (menuHomeGroup || DEFAULT_HOME)) || groups[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (home) setActiveTab(home.tabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, groups, menuHomeGroup]);

  // адреса відображає розділ — посиланням можна поділитись
  useEffect(() => {
    if (!activeTab) return;
    const url = new URL(window.location.href);
    url.searchParams.set("s", activeTab);
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [activeTab]);

  const onPultSection = useCallback((tab) => {
    const id = "pult-" + tab;
    setActiveTab((prev) => (prev === id ? prev : id));
  }, []);

  const activeGroup = groups.find((g) => g.tabs.some((t) => t.id === activeTab)) || groups[0];
  const activeTabInfo = activeGroup?.tabs.find((t) => t.id === activeTab) || activeGroup?.tabs[0];

  // пульт, раз відкритий, лишається в памʼяті — повернення в нього миттєве
  const pultAlive = pultOpened || isPult(activeTab);
  function select(id) {
    if (isPult(activeTab) || isPult(id)) setPultOpened(true);
    setActiveTab(id);
    setMobileMenuOpen(false);
  }
  function toggleGroupExpanded(key) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (!ready) return <div className="full-loader"><div className="spinner" /></div>;
  if (!groups.length) {
    return (
      <div className="auth-wrap"><div className="auth-card"><h1>Немає доступу</h1>
        <p className="note">Акаунт {user?.email} ще не додано ні до команди, ні до користувачів системи. Попросіть Катю або Володимира відкрити доступ.</p>
        <ProfileMenu /></div></div>
    );
  }

  const Screen = activeTab && !isPult(activeTab) ? SCREENS[activeTab] : null;

  return (
    <div className={`app${isPult(activeTab) ? " app-wide" : ""}`}>
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-brand">Модулер</div>
            {groups.map((g) => (
              <div key={g.key}>
                <button className={`mobile-drawer-link${g === activeGroup ? " active" : ""}`} onClick={() => select(g.tabs[0].id)}>{g.label}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="shell">
        {!sidebarCollapsed && (
          <div className="sidebar">
            <div className="sidebar-brand-row">
              <div className="sidebar-brand">Модулер</div>
              <button className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed(true)} title="Сховати меню" aria-label="Сховати меню">⟨</button>
            </div>
            <div className="sidebar-groups">
              {groups.map((g) => {
                const [mainTab, ...restTabs] = g.tabs;
                const isExpanded = expandedGroups.has(g.key) || g.tabs.some((t) => t.id === activeTab);
                return (
                  <div className="sidebar-group" key={g.key}>
                    <div className="sidebar-group-row">
                      <button className={`sidebar-link${activeTab === mainTab.id ? " active" : ""}`} onClick={() => select(mainTab.id)}>{g.label}</button>
                      {restTabs.length > 0 && (
                        <button className="sidebar-expand-btn" onClick={() => toggleGroupExpanded(g.key)} aria-label={isExpanded ? "Згорнути" : "Розгорнути"}>
                          {isExpanded ? "▾" : "▸"}
                        </button>
                      )}
                    </div>
                    {restTabs.length > 0 && isExpanded && (
                      <div className="sidebar-subgroup">
                        {restTabs.map((t) => (
                          <button key={t.id} className={`sidebar-link sub${activeTab === t.id ? " active" : ""}`} onClick={() => select(t.id)}>{t.label}</button>
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
                <button key={t.id} className={`mobile-subtab${activeTab === t.id ? " active" : ""}`} onClick={() => select(t.id)}>{t.label}</button>
              ))}
            </div>
          )}

          {inTeam && pultAlive && (
            <PultFrame
              section={isPult(activeTab) ? activeTab.slice(5) : null}
              visible={isPult(activeTab)}
              initialHash={isPult(start.s) ? start.hash : ""}
              onSection={onPultSection}
            />
          )}
          {Screen && <div className="screen active"><Screen /></div>}
        </div>
      </div>
    </div>
  );
}
