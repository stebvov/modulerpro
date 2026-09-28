// Єдине меню системи Модулер — за ланцюжком створення цінності:
// ідея → контент → продаж → каталог → виробництво (+ відвантаження й монтаж) →
// містечка й дохідна нерухомість (земля, будинки, комунікації, УК, оренда) → фінанси → команда.
// need: хто бачить. any — будь-хто з доступом, mp — користувачі Moduler Pro (профіль), team — учасники команди,
// owner — лише засновник, finance/admin — ролі Moduler Pro, mgr — керівники в пульті, unitowner — власник юніта (кабінет).
// Вкладки "pult-*" — розділи пульту всередині оболонки. Група без доступних вкладок не показується.
export const MENU = [
  { key: "home", label: "🏠 Мій пульт", need: "team", tabs: [{ id: "pult-my", label: "Мій пульт" }] },
  { key: "tasks", label: "✅ Задачі", need: "team", tabs: [{ id: "pult-tasks", label: "Задачі" }] },
  { key: "capital", label: "💎 Капітал", need: "owner", tabs: [{ id: "pult-cap", label: "Капітал і дохід засновника" }] },
  {
    key: "strategy", label: "🧭 Напрями і проєкти", need: "team",
    tabs: [{ id: "pult-dirs", label: "Напрями" }, { id: "pult-projects", label: "Проєкти та ідеї" }],
  },
  { key: "marketing", label: "📣 Контент і маркетинг", need: "mp", tabs: [{ id: "marketing", label: "Контент і маркетинг" }] },
  { key: "crm", label: "🤝 Продажі (CRM)", need: "mp", tabs: [{ id: "crm", label: "Продажі (CRM)" }] },
  {
    key: "catalog", label: "📚 Каталог", need: "mp",
    tabs: [
      { id: "catalog", label: "Моделі будинків" },
      { id: "packages", label: "📦 Пакети" },
      { id: "catalog-services", label: "Послуги" },
    ],
  },
  {
    key: "production", label: "🏭 Виробництво", need: "mp",
    tabs: [{ id: "production", label: "Виробництво" }, { id: "services", label: "Відвантаження і монтаж (дод. послуги)" }],
  },
  {
    key: "suppliers", label: "🏪 Постачальники", need: "mp",
    tabs: [
      { id: "suppliers", label: "Постачальники й контакти" },
      { id: "materials", label: "Товари й матеріали" },
      { id: "price", label: "Ціни постачальників" },
      { id: "material-categories", label: "Категорії матеріалів" },
    ],
  },
  { key: "towns", label: "🏘 Містечка", need: "any", tabs: [{ id: "towns", label: "Містечка: земля, лоти, будинки" }] },
  {
    key: "uk", label: "🛎 УК і сервіс", need: "any",
    tabs: [
      { id: "uk", label: "Об'єкти й заявки" },
      { id: "rent", label: "Оренда й завантаженість" },
      { id: "owners", label: "Кабінет власника" },
      { id: "uk-crm", label: "Воронка власників", need: "mp" },
      { id: "uk-fin", label: "Фінанси УК", need: "finance" },
      { id: "uk-mkt", label: "Маркетинг УК", need: "mp" },
    ],
  },
  { key: "myunit", label: "🔑 Мій юніт", need: "unitowner", tabs: [{ id: "owner", label: "Мій юніт: дохід і виплати" }] },
  { key: "finance", label: "💰 Фінанси", need: "finance", tabs: [{ id: "finance", label: "Фінанси" }] },
  {
    key: "team", label: "👥 Команда і доступи", need: "any",
    tabs: [
      { id: "pult-team", label: "Люди і структура", need: "team" },
      { id: "team", label: "Бригади й підрядники", need: "mp" },
      { id: "users", label: "Зовнішні логіни", need: "admin" },
      { id: "access-groups", label: "Ролі партнерів", need: "admin" },
      { id: "pult-tg", label: "Telegram-чати", need: "mgr" },
      { id: "menu-settings", label: "Меню", need: "admin" },
    ],
  },
];

export const DEFAULT_HOME = "home";
