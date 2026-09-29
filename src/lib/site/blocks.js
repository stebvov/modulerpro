// Бібліотека блоків сайту moduler.pro. Одне місце, з якого будуються і конструктор (форма полів),
// і сайт (SiteRenderer). Новий тип блоку = запис тут + компонент у src/components/site/blocks.
//
// Типи полів: text, textarea (підтримує *акцент*, **жирний**, перенос рядка), number, bool,
// select (options: [[value, label]]), image, images, link ({label, href}), list (fields: [...], item — назва елемента).
// Посилання: "#contact" — якір на сторінці, "/modeli" — сторінка сайту, "tel:…", "https://…" — як є.

export const THEMES = [["light", "Світлий"], ["cloud", "Молочний"], ["dark", "Темний (хвоя)"]];

const eyebrow = { key: "eyebrow", label: "Надзаголовок (дрібно над заголовком)", type: "text" };
const title = { key: "title", label: "Заголовок (*слово* — виділити кольором)", type: "text" };
const lead = { key: "lead", label: "Підзаголовок", type: "textarea" };
const cta = (key, label) => ({ key, label, type: "link" });

export const BLOCKS = {
  hero: {
    label: "Перший екран", icon: "🏠",
    hint: "Що це, для кого, ціна «від», 2–3 вигоди і дві кнопки. Людина має зрозуміти пропозицію за 5 секунд.",
    fields: [
      { key: "variant", label: "Вигляд", type: "select", options: [["photo", "Фото на весь екран"], ["compact", "Компактний (для сторінок)"]] },
      eyebrow, title,
      { key: "subtitle", label: "Опис", type: "textarea" },
      { key: "price", label: "Ціна «від» (плашка)", type: "text" },
      { key: "bullets", label: "Вигоди (галочки)", type: "list", item: "Вигода", fields: [{ key: "text", label: "Текст", type: "text" }] },
      cta("cta_primary", "Головна кнопка"),
      cta("cta_secondary", "Друга кнопка"),
      { key: "image", label: "Фото тла", type: "image" },
      { key: "video", label: "Відео YouTube (посилання або ID)", type: "text" },
      { key: "stats", label: "Цифри внизу", type: "list", item: "Цифра", fields: [{ key: "value", label: "Число", type: "text" }, { key: "label", label: "Підпис", type: "text" }] },
    ],
    defaults: { variant: "photo", theme: "dark", eyebrow: "Moduler · фабрика щастя", title: "Модульні будинки, у яких *хочеться жити*", subtitle: "", bullets: [], stats: [], cta_primary: { label: "Підібрати будинок", href: "#calc" }, cta_secondary: { label: "Каталог моделей", href: "/modeli" } },
  },
  audience: {
    label: "Для кого (вибір задачі)", icon: "🧭",
    hint: "Картки-маршрути: людина обирає свою задачу і йде на потрібну сторінку.",
    fields: [eyebrow, title, lead, { key: "items", label: "Картки", type: "list", item: "Картка", fields: [
      { key: "icon", label: "Емодзі", type: "text" }, { key: "title", label: "Назва", type: "text" }, { key: "text", label: "Опис", type: "textarea" },
      { key: "href", label: "Посилання", type: "text" }, { key: "cta", label: "Текст посилання", type: "text" },
    ] }],
    defaults: { theme: "cloud", eyebrow: "Для кого", title: "Що ви плануєте?", items: [] },
  },
  models: {
    label: "Моделі (каталог)", icon: "🏡",
    hint: "Картки моделей з розділу «Сайт → Моделі». Ціна береться звідти ж. Популярні моделі показуються першими.",
    fields: [eyebrow, title, lead,
      { key: "kind", label: "Що показувати", type: "select", options: [["ready", "Готові моделі"], ["concept", "Індивідуальні проєкти (розробки)"], ["all", "Усе разом"]] },
      { key: "group", label: "Площа", type: "select", options: [["", "Усі"], ["1", "до 30 м²"], ["2", "30–50 м²"], ["3", "50–100 м²"], ["4", "100+ м²"]] },
      { key: "filters", label: "Показати фільтр за площею", type: "bool" },
      { key: "limit", label: "Скільки показати (0 — усі)", type: "number" },
      cta("cta", "Кнопка під каталогом"),
    ],
    defaults: { theme: "light", kind: "ready", eyebrow: "Каталог", title: "Готові моделі під ваші задачі", filters: true, limit: 0 },
  },
  calculator: {
    label: "Калькулятор вартості", icon: "🧮",
    hint: "Ставки за м² і доставка — у «Сайт → Налаштування → Калькулятор». Без ставок калькулятор збирає параметри й просить контакт.",
    fields: [eyebrow, title, lead, { key: "note", label: "Примітка під сумою", type: "textarea" }],
    defaults: { theme: "cloud", anchor: "calc", eyebrow: "Розрахунок", title: "Скільки коштуватиме *ваш дім*" },
  },
  tiers: {
    label: "Рівні комплектації", icon: "🧱",
    fields: [eyebrow, title, lead, { key: "items", label: "Рівні", type: "list", item: "Рівень", fields: [
      { key: "name", label: "Назва", type: "text" }, { key: "sub", label: "Коротко", type: "text" }, { key: "text", label: "Що входить", type: "textarea" },
      { key: "price", label: "Ціна (напр. від $642 за м²)", type: "text" }, { key: "highlight", label: "Виділити", type: "bool" },
    ] }, { key: "note", label: "Примітка", type: "textarea" }],
    defaults: { theme: "light", title: "Оберіть рівень готовності", items: [] },
  },
  features: {
    label: "Переваги / картки з іконками", icon: "✨",
    fields: [eyebrow, title, lead, { key: "items", label: "Картки", type: "list", item: "Перевага", fields: [
      { key: "icon", label: "Емодзі", type: "text" }, { key: "title", label: "Назва", type: "text" }, { key: "text", label: "Опис", type: "textarea" },
    ] }, { key: "columns", label: "Колонок", type: "select", options: [["3", "3"], ["2", "2"], ["4", "4"]] }],
    defaults: { theme: "light", columns: "3", items: [] },
  },
  cases: {
    label: "Кейси (портфоліо)", icon: "📸",
    hint: "Об'єкти з розділу «Сайт → Кейси». Кожен кейс має свою сторінку з галереєю.",
    fields: [eyebrow, title, lead,
      { key: "kind", label: "Які кейси", type: "select", options: [["", "Усі"], ["private", "Приватні доми"], ["business", "Бізнес"], ["social", "Соціальні"], ["town", "Містечка"]] },
      { key: "filters", label: "Показати фільтр за типом", type: "bool" },
      { key: "limit", label: "Скільки показати (0 — усі)", type: "number" },
      cta("cta", "Кнопка під кейсами"),
    ],
    defaults: { theme: "light", eyebrow: "Портфоліо", title: "Будинки, які вже живуть", limit: 6 },
  },
  reviews: {
    label: "Відгуки", icon: "💬",
    hint: "Лише справжні відгуки з дозволу клієнтів: ім'я, місто, фото. Блок без відгуків на сайті не показується.",
    fields: [eyebrow, title, { key: "items", label: "Відгуки", type: "list", item: "Відгук", fields: [
      { key: "text", label: "Текст", type: "textarea" }, { key: "name", label: "Ім'я", type: "text" }, { key: "place", label: "Місто / об'єкт", type: "text" },
      { key: "photo", label: "Фото", type: "image" }, { key: "video", label: "Відео YouTube (необов'язково)", type: "text" },
    ] }],
    defaults: { theme: "cloud", eyebrow: "Відгуки", title: "Що кажуть власники", items: [] },
  },
  steps: {
    label: "Етапи роботи", icon: "🪜",
    fields: [eyebrow, title, lead, { key: "items", label: "Етапи", type: "list", item: "Етап", fields: [
      { key: "title", label: "Назва", type: "text" }, { key: "text", label: "Що відбувається", type: "textarea" }, { key: "time", label: "Строк (напр. 1–2 дні)", type: "text" },
    ] }, { key: "note", label: "Примітка (оплата, гарантія)", type: "textarea" }],
    defaults: { theme: "light", eyebrow: "Як працюємо", title: "Від першої розмови до новосілля", items: [] },
  },
  faq: {
    label: "Питання й відповіді", icon: "❓",
    fields: [eyebrow, title,
      { key: "items", label: "Питання", type: "list", item: "Питання", fields: [{ key: "q", label: "Питання", type: "text" }, { key: "a", label: "Відповідь", type: "textarea" }] },
      { key: "yes", label: "Що гарантуємо", type: "list", item: "Пункт", fields: [{ key: "text", label: "Текст", type: "text" }] },
      { key: "no", label: "Чесно не обіцяємо", type: "list", item: "Пункт", fields: [{ key: "text", label: "Текст", type: "text" }] },
    ],
    defaults: { theme: "light", eyebrow: "Чесні відповіді", title: "Питання, які ставлять найчастіше", items: [], yes: [], no: [] },
  },
  showroom: {
    label: "Шоурум / локація", icon: "📍",
    fields: [eyebrow, title, lead,
      { key: "bullets", label: "Пункти", type: "list", item: "Пункт", fields: [{ key: "text", label: "Текст", type: "text" }] },
      { key: "info", label: "Як доїхати", type: "list", item: "Рядок", fields: [{ key: "icon", label: "Емодзі", type: "text" }, { key: "text", label: "Текст", type: "text" }] },
      { key: "image", label: "Фото", type: "image" },
      cta("cta", "Кнопка"), { key: "map_url", label: "Посилання на Google-мапу", type: "text" },
    ],
    defaults: { theme: "cloud", eyebrow: "Шоурум", title: "Приїдьте й зайдіть усередину", bullets: [], info: [] },
  },
  text_image: {
    label: "Текст + фото", icon: "🖼",
    hint: "«Оживити порою доби»: сайт показує фото, що відповідає годині відвідувача (ранок, день, вечір, ніч), з м'якою анімацією. Відвідувач може й сам перемкнути.",
    fields: [eyebrow, title, { key: "text", label: "Текст", type: "textarea" }, { key: "image", label: "Фото (день)", type: "image" },
      { key: "side", label: "Фото", type: "select", options: [["right", "Праворуч"], ["left", "Ліворуч"]] }, cta("cta", "Кнопка"),
      { key: "daylight", label: "Оживити порою доби", type: "bool" },
      { key: "image_morning", label: "Фото вранці (необов'язково)", type: "image" },
      { key: "image_evening", label: "Фото ввечері", type: "image" },
      { key: "image_night", label: "Фото вночі (зі світлом у вікнах)", type: "image" },
    ],
    defaults: { theme: "light", side: "right" },
  },
  choice: {
    label: "Готова модель чи свій проєкт", icon: "⚖️",
    hint: "Два шляхи поруч: готова модель (швидше й дешевше) та індивідуальний проєкт. Кожен зі своєю кнопкою.",
    fields: [eyebrow, title, lead,
      { key: "a_title", label: "Ліворуч: назва", type: "text" }, { key: "a_text", label: "Ліворуч: опис", type: "textarea" },
      { key: "a_points", label: "Ліворуч: пункти", type: "list", item: "Пункт", fields: [{ key: "text", label: "Текст", type: "text" }] },
      cta("a_cta", "Ліворуч: кнопка"),
      { key: "b_title", label: "Праворуч: назва", type: "text" }, { key: "b_text", label: "Праворуч: опис", type: "textarea" },
      { key: "b_points", label: "Праворуч: пункти", type: "list", item: "Пункт", fields: [{ key: "text", label: "Текст", type: "text" }] },
      cta("b_cta", "Праворуч: кнопка"),
    ],
    defaults: {
      theme: "cloud", eyebrow: "Як обрати", title: "Готова модель чи *свій проєкт*?",
      a_title: "Готова модель", a_text: "Найшвидший і найвигідніший шлях.", a_points: [], a_cta: { label: "Обрати модель", href: "/modeli" },
      b_title: "Індивідуальний проєкт", b_text: "Коли потрібне щось своє.", b_points: [], b_cta: { label: "Дивитися розробки", href: "/proekty" },
    },
  },
  invest: {
    label: "Інвест-калькулятор", icon: "📈",
    hint: "Дохід = середній чек за ніч × 365 × завантаження × частка інвестора. Змініть параметри — сторінка перерахує все сама.",
    fields: [eyebrow, title, lead,
      { key: "price", label: "Ціна входу (будинок під ключ)", type: "number" },
      { key: "currency", label: "Валюта", type: "select", options: [["USD", "$ долар"], ["EUR", "€ євро"], ["UAH", "₴ гривня"]] },
      { key: "night", label: "Середній чек за ніч", type: "number" },
      { key: "share", label: "Частка інвестора від виручки, %", type: "number" },
      { key: "payout", label: "Як виплачується (напр. щокварталу)", type: "text" },
      { key: "occupancy", label: "Завантаження за замовчуванням, %", type: "number" },
      { key: "scenarios", label: "Сценарії (кнопки)", type: "list", item: "Сценарій", fields: [
        { key: "name", label: "Назва", type: "text" }, { key: "occupancy", label: "Завантаження, %", type: "number" }, { key: "note", label: "Пояснення", type: "text" },
      ] },
      { key: "years", label: "Горизонт розрахунку, років", type: "number" },
      { key: "note", label: "Застереження під розрахунком", type: "textarea" },
      cta("cta", "Кнопка"),
    ],
    defaults: { theme: "dark", anchor: "calc", title: "Скільки заробляє *ваш будинок*", price: 59900, currency: "USD", night: 178, share: 50, occupancy: 40, years: 10, scenarios: [] },
  },
  table: {
    label: "Таблиця порівняння", icon: "📊",
    hint: "Перший рядок — заголовки. Рядок, позначений «Виділити», підсвічується (наприклад, ваша пропозиція).",
    fields: [eyebrow, title, lead,
      { key: "head", label: "Заголовки колонок (через | )", type: "text" },
      { key: "rows", label: "Рядки", type: "list", item: "Рядок", fields: [
        { key: "cells", label: "Клітинки (через | )", type: "text" }, { key: "highlight", label: "Виділити", type: "bool" },
      ] },
      { key: "note", label: "Примітка під таблицею", type: "textarea" },
    ],
    defaults: { theme: "light", head: "Інструмент | Дохідність | Актив", rows: [] },
  },
  team: {
    label: "Команда / люди", icon: "👥",
    fields: [eyebrow, title, lead,
      { key: "items", label: "Люди", type: "list", item: "Людина", fields: [
        { key: "photo", label: "Фото", type: "image" }, { key: "name", label: "Ім'я", type: "text" },
        { key: "role", label: "Роль", type: "text" }, { key: "text", label: "Опис", type: "textarea" },
      ] },
      { key: "note", label: "Рядок під командою", type: "textarea" },
    ],
    defaults: { theme: "cloud", eyebrow: "Хто за проєктом", title: "Команда", items: [] },
  },
  stats: {
    label: "Цифри", icon: "🔢",
    fields: [{ key: "items", label: "Цифри", type: "list", item: "Цифра", fields: [{ key: "value", label: "Число", type: "text" }, { key: "label", label: "Підпис", type: "text" }] }],
    defaults: { theme: "light", items: [] },
  },
  photo_band: {
    label: "Фото-стрічка з написом", icon: "🌲",
    fields: [title, { key: "text", label: "Текст", type: "textarea" }, { key: "image", label: "Фото", type: "image" }],
    defaults: { theme: "dark" },
  },
  gallery: {
    label: "Галерея фото", icon: "🗂",
    fields: [eyebrow, title, lead, { key: "images", label: "Фото", type: "images" }],
    defaults: { theme: "light", images: [] },
  },
  video: {
    label: "Відео", icon: "▶️",
    fields: [eyebrow, title, { key: "video", label: "YouTube (посилання або ID)", type: "text" }, { key: "caption", label: "Підпис", type: "text" }],
    defaults: { theme: "light" },
  },
  text: {
    label: "Текст", icon: "📝",
    fields: [eyebrow, title, { key: "body", label: "Текст (порожній рядок — новий абзац)", type: "textarea" }],
    defaults: { theme: "light" },
  },
  cta_band: {
    label: "Заклик до дії", icon: "📣",
    fields: [title, { key: "text", label: "Текст", type: "textarea" }, cta("cta_primary", "Головна кнопка"), cta("cta_secondary", "Друга кнопка")],
    defaults: { theme: "dark", cta_primary: { label: "Залишити заявку", href: "#contact" } },
  },
  lead_form: {
    label: "Форма заявки", icon: "✉️",
    hint: "Заявка потрапляє в CRM (Ліди, джерело «сайт») і в Telegram. Варіанти «Що плануєте» — у Налаштуваннях сайту.",
    fields: [eyebrow, title, lead, { key: "goal", label: "Що плануєте — вибрано наперед", type: "text" }],
    defaults: { theme: "dark", anchor: "contact", eyebrow: "Обговоримо ваш проєкт", title: "Розкажіть, про що ви мрієте" },
  },
};

export const BLOCK_ORDER = ["hero", "audience", "models", "choice", "calculator", "invest", "table", "team", "tiers", "features", "cases", "reviews", "steps", "faq", "showroom", "text_image", "stats", "photo_band", "gallery", "video", "text", "cta_band", "lead_form"];

// спільні поля кожного блоку (показуються в конструкторі внизу форми)
export const COMMON_FIELDS = [
  { key: "theme", label: "Тло секції", type: "select", options: THEMES },
  { key: "anchor", label: "Якір (для посилань #…), латиницею", type: "text" },
];

export function newBlock(type) {
  const def = BLOCKS[type];
  return { id: Math.random().toString(36).slice(2, 10), type, hidden: false, ...structuredClone(def?.defaults || {}) };
}

export const SIZE_GROUPS = { 1: "до 30 м²", 2: "30–50 м²", 3: "50–100 м²", 4: "100+ м²" };
export const CASE_KINDS = { private: "Приватні доми", business: "Бізнес", social: "Соціальні", town: "Містечка" };
export const MODEL_KINDS = { ready: "Готова модель", concept: "Індивідуальний проєкт" };
export const LEVELS = [["shell", "Конструктив"], ["prefinish", "Під оздоблення"], ["ready", "Готове житло"]];
