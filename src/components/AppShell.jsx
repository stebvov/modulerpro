"use client";

import SettingsButton from "@/components/SettingsButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_HOME, MENU } from "@/lib/menu";
import ProfileMenu from "@/components/ProfileMenu";
import CurrencyMenu from "@/components/CurrencyMenu";
import PultFrame from "@/components/PultFrame";
import HelpPanel from "@/components/HelpPanel";
import { HelpIcon } from "@/components/Icon";
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
import MarketPricesScreen from "@/components/screens/MarketPricesScreen";
import WorkRatesScreen from "@/components/screens/WorkRatesScreen";
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
import RentalScreen from "@/components/screens/RentalScreen";
import PackagesScreen from "@/components/screens/PackagesScreen";
import ProductsScreen from "@/components/screens/ProductsScreen";
import OwnerScreen from "@/components/screens/OwnerScreen";
import IdeasScreen from "@/components/screens/IdeasScreen";
import AssistantScreen from "@/components/screens/AssistantScreen";
import KnowledgeScreen from "@/components/screens/KnowledgeScreen";
import QuizzesScreen from "@/components/screens/QuizzesScreen";
import SitePagesScreen from "@/components/site-editor/SitePagesScreen";
import SiteCollectionScreen from "@/components/site-editor/SiteCollectionScreen";
import SiteSettingsScreen from "@/components/site-editor/SiteSettingsScreen";
import SiteI18nScreen from "@/components/site-editor/SiteI18nScreen";
import Ledger from "@/components/finance/Ledger";
import MaterialCategoriesPanel from "@/components/panels/MaterialCategoriesPanel";
import UnitsPanel from "@/components/panels/UnitsPanel";
import HrMyScreen from "@/components/hr/HrMyScreen";
import HrHiringScreen from "@/components/hr/HrHiringScreen";
import HrLearningScreen from "@/components/hr/HrLearningScreen";
import HrOnboardingScreen from "@/components/hr/HrOnboardingScreen";
import HrQualityScreen from "@/components/hr/HrQualityScreen";
import HrRolesScreen from "@/components/hr/HrRolesScreen";

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
  market: () => <MarketPricesScreen />,
  "work-rates": () => <WorkRatesScreen />,
  "catalog-services": () => <ServicesCatalogScreen />,
  "service-templates": () => <ServiceTemplatesScreen />,
  packages: () => <PackagesScreen />,
  products: () => <ProductsScreen />,
  owners: () => <OwnerScreen />,
  owner: () => <OwnerScreen />,
  ideas: () => <IdeasScreen />,
  assistant: () => <AssistantScreen />,
  kb: () => <KnowledgeScreen />,
  quizzes: () => <QuizzesScreen />,
  "uk-crm": () => <CrmDataProvider><CrmScreen onlySlug="uk-owners" /></CrmDataProvider>,
  "uk-fin": () => <Ledger direction="service" />,
  "uk-mkt": () => <MarketingDataProvider><MarketingScreen direction="service" /></MarketingDataProvider>,
  "material-categories": () => <div style={{ display: "grid", gap: 24 }}><MaterialCategoriesPanel /><UnitsPanel /></div>,
  towns: () => <TownsScreen />,
  uk: () => <UkScreen />,
  rent: () => <RentScreen />,
  rental: () => <RentalScreen />,
  users: () => <UsersScreen />,
  team: () => <TeamDataProvider><TeamScreen /></TeamDataProvider>,
  "access-groups": () => <AccessGroupsScreen />,
  "menu-settings": () => <MenuSettingsScreen />,
  "site-pages": () => <SitePagesScreen />,
  "site-models": () => <SiteCollectionScreen kind="models" />,
  "site-cases": () => <SiteCollectionScreen kind="cases" />,
  "site-settings": () => <SiteSettingsScreen />,
  "site-i18n": () => <SiteI18nScreen />,
  "hr-me": () => <HrMyScreen />,
  "hr-hiring": () => <HrHiringScreen />,
  "hr-learning": () => <HrLearningScreen />,
  "hr-onboarding": () => <HrOnboardingScreen />,
  "hr-quality": () => <HrQualityScreen />,
  "hr-roles": () => <HrRolesScreen />,
};

const isPult = (id) => id?.startsWith("pult-");
// заголовок сторінки — без емодзі з меню
const plainLabel = (s) => (s || "").replace(/^[^\p{L}\p{N}]+/u, "");

// учасник команди пульту (task_members) для поточного email: засновник, керівник, чи взагалі в команді
function usePultMember(email) {
  const supabase = useMemo(() => createClient(), []);
  const [member, setMember] = useState(undefined);
  useEffect(() => {
    if (!email) return;
    let on = true;
    supabase.from("task_members").select("id,name,is_owner,can_manage,fin_all,active,avatar_url,hr_admin").ilike("email", email).eq("active", true).maybeSingle()
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
  const [unitOwner, setUnitOwner] = useState(null);
  useEffect(() => {
    if (!user || loading || profile || member !== null) return;
    createClient().rpc("owner_cabinet").then(({ data }) => setUnitOwner(!data?.staff && (data?.objects?.length || 0) > 0));
  }, [user, loading, profile, member]);
  const [start] = useState(readUrl);
  const [activeTab, setActiveTab] = useState(start.s || null);
  // база знань: засновник бачить завжди, команда — коли він її відкрив (тоді працює й пряме посилання ?s=kb)
  const [kbTeam, setKbTeam] = useState(false);
  useEffect(() => {
    if (!member || member.is_owner) return;
    createClient().from("kb_settings").select("team_mode").maybeSingle().then(({ data }) => {
      if (!data?.team_mode) return;
      setKbTeam(true);
      if (start.s === "kb") setActiveTab("kb");
    });
  }, [member, start]);
  const [pultOpened, setPultOpened] = useState(() => isPult(start.s));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem("moduler_sidebar") === "0"; } catch { return false; }
  });
  const setSidebarCollapsed = (v) => { setSidebarCollapsedState(v); try { localStorage.setItem("moduler_sidebar", v ? "0" : "1"); } catch { /* приватний режим */ } };
  const pultRef = useRef(null);
  const [helpOpen, setHelpOpen] = useState(false);

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
      : need === "hr" ? !!(isAdmin || member?.is_owner || member?.can_manage || member?.hr_admin)
      : need === "unitowner" ? unitOwner
      : need === "kb" ? !!(member?.is_owner || (inTeam && kbTeam))
      : true;
    let g = MENU.filter((x) => can(x.need)).map((x) => ({ ...x, tabs: x.tabs.filter((t) => !t.need || can(t.need)) })).filter((x) => x.tabs.length);
    // зовнішній партнер бачить лише відкриті йому групи/розділи Moduler Pro
    if (isPartner) {
      const allow = partnerTabs || new Set();
      g = MENU.map((x) => ({ ...x, tabs: allow.has(x.key) ? x.tabs.filter((t) => !t.id.startsWith("pult-")) : x.tabs.filter((t) => allow.has(t.id)) })).filter((x) => x.tabs.length);
    }
    if (menuGroupOrder?.length) {
      // збережений порядок міняє місцями лише ті групи, що в ньому є; нові групи лишаються на своєму місці в ланцюжку
      const saved = menuGroupOrder.filter((k) => g.some((x) => x.key === k));
      const slots = g.map((x, i) => (saved.includes(x.key) ? i : -1)).filter((i) => i >= 0);
      const next = [...g];
      slots.forEach((slot, j) => { next[slot] = g.find((x) => x.key === saved[j]); });
      g = next;
    }
    return g;
  }, [hasMp, inTeam, member, isPartner, partnerTabs, canWriteFinance, isAdmin, menuGroupOrder, unitOwner, kbTeam]);

  // власник юніта без інших прав — чекаємо перевірки його юнітів, щоб не показати «Немає доступу»
  const ready = !loading && (member !== undefined || !user) && (!!profile || !!member || !user || unitOwner !== null);
  const allIds = groups.flatMap((g) => g.tabs.map((t) => t.id));
  // у меню — без прихованих груп (у них ведуть лише прямі посилання: «Капітал» — із профілю засновника)
  const menuGroups = groups.filter((g) => !g.hidden);

  // стартова вкладка: з адреси (?s=), інакше домашня група з налаштувань меню
  useEffect(() => {
    if (!ready || (activeTab && allIds.includes(activeTab))) return;
    const home = menuGroups.find((g) => g.key === (menuHomeGroup || DEFAULT_HOME)) || menuGroups[0] || groups[0];
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
  // «+ Задача» з будь-якого розділу: відкриваємо задачі пульту з формою
  function newTask() {
    select("pult-tasks");
    setTimeout(() => pultRef.current?.newTask(), 300);
  }
  // «Профіль у команді»: імʼя, роль, фото, Telegram — живе в пульті
  function openTeamProfile() {
    if (!inTeam) return;
    select("pult-my");
    setTimeout(() => pultRef.current?.openProfile(), 300);
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
    <div className={`app${isPult(activeTab) ? " pult-mode" : ""}`}>
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-brand">Модулер</div>
            {menuGroups.map((g) => (
              <button key={g.key} className={`mobile-drawer-link${g === activeGroup ? " active" : ""}`} onClick={() => select(g.tabs[0].id)}>{g.label}</button>
            ))}
          </div>
        </div>
      )}

      <div className="shell">
        {!sidebarCollapsed && (
          <nav className="sidebar" aria-label="Розділи системи">
            <div className="sidebar-brand-row">
              <div className="sidebar-brand">Модулер</div>
              <button className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed(true)} title="Сховати меню" aria-label="Сховати меню">⟨</button>
            </div>
            <div className="sidebar-groups">
              {menuGroups.map((g) => (
                <button key={g.key} className={`sidebar-link${g === activeGroup ? " active" : ""}`} onClick={() => select(g.tabs.some((t) => t.id === activeTab) ? activeTab : g.tabs[0].id)}>
                  {g.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        <div className="main-content">
          <div className="top-bar">
            <div className="top-bar-left">
              <button className="hamburger-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Меню">☰</button>
              {sidebarCollapsed && (
                <button className="btn small sidebar-reopen-btn" onClick={() => setSidebarCollapsed(false)} title="Показати меню">☰ Меню</button>
              )}
              <h1 className="page-title">{plainLabel(activeGroup?.tabs.length > 1 ? activeGroup.label : activeTabInfo?.label)}</h1>
            </div>
            <div className="top-bar-right">
              {inTeam && ["pult-my", "pult-tasks"].includes(activeTab) && (
                <button className="btn primary" onClick={newTask} title="Нова задача в пульті — з будь-якого розділу">
                  <span className="btn-label-full">+ Задача</span><span className="btn-label-compact">+</span>
                </button>
              )}
              <button className="btn icon-btn-sq" onClick={() => setHelpOpen(true)} title="Довідка: як працює цей розділ, що означає кожне поле" aria-label="Довідка"><HelpIcon /></button>
              <CurrencyMenu currency={currency} onChange={setCurrency} />
              {inTeam ? (
                // аватар і профіль — з «Команди»: фото, імʼя, роль, Telegram, пароль, вихід
                <button type="button" className="profile-menu-btn" onClick={openTeamProfile} title={`${member.name} — мій профіль у команді`} aria-label="Мій профіль у команді">
                  {member.avatar_url
                    ? <img className="profile-avatar" src={member.avatar_url} alt={member.name} />
                    : <span className="profile-avatar profile-avatar-fallback">{(member.name || "?").trim().charAt(0).toUpperCase()}</span>}
                </button>
              ) : (
                <ProfileMenu />
              )}
            </div>
          </div>

          {activeGroup && activeGroup.tabs.length > 1 && (
            <div className="subtabs" role="tablist">
              {activeGroup.tabs.filter((t) => !t.settings).map((t) => (
                <button key={t.id} role="tab" aria-selected={activeTab === t.id} className={`subtab${activeTab === t.id ? " active" : ""}`} onClick={() => select(t.id)}>{t.label}</button>
              ))}
              {activeGroup.tabs.filter((t) => t.settings).map((t, i) => (
                <SettingsButton key={t.id} role="tab" aria-selected={activeTab === t.id} title={t.label} active={activeTab === t.id} className={i === 0 ? "subtabs__settings" : ""} onClick={() => select(t.id)} />
              ))}
            </div>
          )}

          {inTeam && pultAlive && (
            <PultFrame
              ref={pultRef}
              section={isPult(activeTab) ? activeTab.slice(5) : null}
              visible={isPult(activeTab)}
              initialHash={isPult(start.s) ? start.hash : ""}
              currency={currency}
              onSection={onPultSection}
            />
          )}
          {Screen && <div className="screen active"><Screen /></div>}
          <HelpPanel key={activeTab} open={helpOpen} tabId={activeTab} onClose={() => setHelpOpen(false)} />
        </div>
      </div>
    </div>
  );
}
