// Єдине меню системи Модулер — за ланцюжком створення цінності:
// ідея → контент → сайт → продаж → каталог → виробництво (+ відвантаження й монтаж) →
// містечка й дохідна нерухомість (земля, будинки, комунікації, УК, оренда) → фінанси → команда.
// need: хто бачить. any — будь-хто з доступом, mp — користувачі Moduler Pro (профіль), team — учасники команди,
// owner — лише засновник, finance/admin — ролі Moduler Pro, mgr — керівники в пульті, unitowner — власник юніта (кабінет),
// hr — хто веде найм і оцінку людей (засновник, керівники, позначені hr_admin у команді, адмін).
// kb — база знань: засновник завжди; команда — коли засновник відкрив її (kb_settings.team_mode), і то лише затверджені записи.
// Вкладки "pult-*" — розділи пульту всередині оболонки. Група без доступних вкладок не показується.
// settings: true — це налаштування розділу: у рядку вкладок замість підпису стоїть кнопка-шестерня (підпис — у підказці).
export const MENU = [
  { key: "home", label: "🏠 Мій пульт", need: "team", tabs: [{ id: "pult-my", label: "Мій пульт" }] },
  { key: "tasks", label: "✅ Задачі", need: "team", tabs: [{ id: "pult-tasks", label: "Задачі" }] },
  { key: "assistant", label: "🤖 Асистент", need: "owner", tabs: [{ id: "assistant", label: "Асистент — операційний ШІ-директор" }] },
  { key: "capital", label: "💎 Капітал", need: "owner", tabs: [{ id: "pult-cap", label: "Капітал і дохід засновника" }] },
  { key: "ideas", label: "💡 Ідеї", need: "owner", tabs: [{ id: "ideas", label: "Ідеї та роздуми" }] },
  { key: "kb", label: "📖 База знань", need: "kb", tabs: [{ id: "kb", label: "База знань" }] },
  {
    key: "strategy", label: "🧭 Напрями і проєкти", need: "team",
    tabs: [{ id: "pult-dirs", label: "Напрями" }, { id: "pult-projects", label: "Проєкти та ідеї" }],
  },
  { key: "marketing", label: "📣 Контент і маркетинг", need: "mp", tabs: [{ id: "marketing", label: "Контент і маркетинг" }, { id: "quizzes", label: "🧩 Квізи" }] },
  {
    key: "site", label: "🌐 Сайт", need: "any",
    tabs: [
      { id: "site-pages", label: "Сторінки (конструктор)" },
      { id: "site-models", label: "Моделі на сайті" },
      { id: "site-cases", label: "Кейси" },
      { id: "site-settings", label: "Налаштування сайту", settings: true },
    ],
  },
  { key: "crm", label: "🤝 Продажі (CRM)", need: "mp", tabs: [{ id: "crm", label: "Продажі (CRM)" }] },
  {
    key: "catalog", label: "📚 Каталог", need: "mp",
    tabs: [
      { id: "catalog", label: "Моделі будинків" },
      { id: "catalog-services", label: "Послуги" },
      { id: "products", label: "🛒 Товари" },
      { id: "packages", label: "📦 Пакети" },
    ],
  },
  {
    key: "production", label: "🏭 Виробництво", need: "mp",
    tabs: [{ id: "production", label: "Виробництво" }, { id: "services", label: "Відвантаження і монтаж (дод. послуги)" }, { id: "work-rates", label: "Розцінки на роботи" }],
  },
  {
    key: "suppliers", label: "🏪 Постачальники", need: "mp",
    tabs: [
      { id: "suppliers", label: "Постачальники й контакти" },
      { id: "materials", label: "Товари й матеріали" },
      { id: "price", label: "Ціни постачальників" },
      { id: "market", label: "Ринкові ціни (сайти)" },
      { id: "material-categories", label: "Категорії матеріалів і одиниці виміру", settings: true },
    ],
  },
  { key: "towns", label: "🏘 Містечка", need: "any", tabs: [{ id: "towns", label: "Містечка: земля, лоти, будинки" }] },
  {
    key: "uk", label: "🛎 УК і сервіс", need: "any",
    tabs: [
      { id: "uk", label: "Об'єкти й заявки" },
      { id: "rent", label: "Оренда й завантаженість" },
      { id: "rental", label: "Облік оренди МОХО", need: "mp" },
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
      { id: "access-groups", label: "Ролі доступу", need: "admin" },
      { id: "pult-tg", label: "Telegram-чати", need: "mgr" },
      { id: "menu-settings", label: "Налаштування меню", need: "admin", settings: true },
    ],
  },
  {
    // найм → навчання → адаптація → якість роботи; «Мій розвиток» бачить кожен учасник команди
    key: "people", label: "🎓 Люди: найм і розвиток", need: "team",
    tabs: [
      { id: "hr-me", label: "Мій розвиток" },
      { id: "hr-hiring", label: "Вакансії й кандидати", need: "hr" },
      { id: "hr-learning", label: "Навчання й тести" },
      { id: "hr-onboarding", label: "Адаптація", need: "hr" },
      { id: "hr-quality", label: "Якість роботи", need: "hr" },
      { id: "hr-roles", label: "Профілі посад", need: "hr" },
    ],
  },
];

export const DEFAULT_HOME = "home";
