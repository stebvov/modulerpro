// Єдине меню системи Модулер — за ланцюжком створення цінності:
// ідея → контент → продаж → виробництво → відвантаження → містечко → УК → оренда → пасивний дохід.
// need: хто бачить групу. mp — користувачі Moduler Pro (профіль), team — учасники команди пульту,
// owner — лише засновник, finance/admin — ролі Moduler Pro, mgr — керівники в пульті.
// Вкладки з id "pult-*" — розділи пульту, що відкриваються всередині оболонки.
export const MENU = [
  { key: "home", label: "🏠 Мій пульт", need: "team", tabs: [{ id: "pult-my", label: "Мій пульт" }] },
  { key: "capital", label: "💎 Капітал", need: "owner", tabs: [{ id: "pult-cap", label: "Капітал і дохід засновника" }] },
  {
    key: "strategy", label: "🧭 Напрями і проєкти", need: "team",
    tabs: [{ id: "pult-dirs", label: "Напрями" }, { id: "pult-projects", label: "Проєкти та ідеї" }, { id: "pult-tasks", label: "Задачі" }],
  },
  { key: "marketing", label: "📣 Контент і маркетинг", need: "mp", tabs: [{ id: "marketing", label: "Контент і маркетинг" }] },
  { key: "crm", label: "🤝 Продажі (CRM)", need: "mp", tabs: [{ id: "crm", label: "Продажі (CRM)" }] },
  { key: "production", label: "🏭 Виробництво", need: "mp", tabs: [{ id: "production", label: "Виробництво" }] },
  { key: "services", label: "🚚 Відвантаження і монтаж", need: "mp", tabs: [{ id: "services", label: "Відвантаження і монтаж" }] },
  { key: "towns", label: "🏘 Містечка", need: "any", tabs: [{ id: "towns", label: "Містечка: лоти й продаж" }] },
  { key: "uk", label: "🛎 УК і сервіс", need: "any", tabs: [{ id: "uk", label: "УК: об'єкти й заявки" }] },
  { key: "rent", label: "🔑 Оренда і дохід", need: "any", tabs: [{ id: "rent", label: "Оренда і пасивний дохід" }] },
  {
    key: "catalog", label: "📚 Каталог", need: "mp",
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
  { key: "finance", label: "💰 Фінанси", need: "finance", tabs: [{ id: "finance", label: "Фінанси" }] },
  {
    key: "team", label: "👥 Команда", need: "team",
    tabs: [{ id: "pult-team", label: "Команда і структура" }, { id: "pult-tg", label: "Telegram-чати", need: "mgr" }],
  },
  {
    key: "admin", label: "⚙️ Адміністрування", need: "admin",
    tabs: [{ id: "users", label: "Користувачі" }, { id: "team", label: "Люди та ролі" }, { id: "access-groups", label: "Ролі доступу" }, { id: "menu-settings", label: "Меню" }],
  },
];

export const DEFAULT_HOME = "home";
