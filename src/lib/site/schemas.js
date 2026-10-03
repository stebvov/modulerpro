// Поля моделей, кейсів, сторінок і налаштувань сайту — для тих самих форм, що й блоки конструктора.
import { CASE_KINDS, MODEL_KINDS, SIZE_GROUPS } from "./blocks";

const UA = { а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", "'": "", "’": "" };
export function slugify(s) {
  return String(s || "").toLowerCase().split("").map((ch) => (ch in UA ? UA[ch] : ch)).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export const MODEL_FIELDS = [
  { key: "name", label: "Назва моделі", type: "text" },
  { key: "kind", label: "Тип", type: "select", options: Object.entries(MODEL_KINDS) },
  { key: "popular", label: "Популярна модель (перша в каталозі, позначка «Популярна»)", type: "bool" },
  { key: "slug", label: "Адреса сторінки (латиницею)", type: "text", hint: "moduler.pro/modeli/…" },
  { key: "tagline", label: "Коротко (під назвою)", type: "text" },
  { key: "template_id", label: "Модель у каталозі системи (параметри й розрахунки)", type: "template" },
  { key: "sync_params", label: "Брати параметри з каталогу (площа, модулі, габарити, спальні, с/в, тераси) — оновлюються самі", type: "bool" },
  { key: "size_group", label: "Група площі", type: "select", options: Object.entries(SIZE_GROUPS).map(([k, v]) => [Number(k), v]), synced: true },
  { key: "object_type", label: "Тип обʼєкта", type: "text", synced: true },
  { key: "area_m2", label: "Площа, м²", type: "number", synced: true },
  { key: "modules", label: "Модулів", type: "number", synced: true },
  { key: "bedrooms", label: "Спалень (0 — студія, порожньо — не показувати)", type: "number", synced: true },
  { key: "bathrooms", label: "Санвузлів", type: "number", synced: true },
  { key: "dimensions", label: "Габарити (ширина × довжина)", type: "text", synced: true },
  { key: "height_m", label: "Висота, м", type: "number", synced: true },
  { key: "terraces", label: "Тераси", type: "terraces", synced: true },
  { key: "build_time", label: "Строк виготовлення (напр. від 30 днів)", type: "text" },
  { key: "currency", label: "Валюта цін", type: "select", options: [["USD", "$ долар"], ["EUR", "€ євро"], ["UAH", "₴ гривня"]] },
  { key: "price_shell", label: "Ціна «Конструктив» від", type: "number" },
  { key: "price_prefinish", label: "Ціна «Під оздоблення» від", type: "number" },
  { key: "price_ready", label: "Ціна «Готове житло» від", type: "number" },
  { key: "description", label: "Опис (порожній рядок — новий абзац)", type: "textarea" },
  { key: "highlights", label: "Переваги моделі (картки на лендингу)", type: "list", item: "Перевага", fields: [
    { key: "icon", label: "Емодзі", type: "text" }, { key: "title", label: "Назва", type: "text" }, { key: "text", label: "Опис", type: "textarea" },
  ] },
  { key: "features", label: "Що є в моделі (галочки)", type: "strings", item: "Пункт" },
  { key: "photos", label: "Фото й візуалізації (перше — обкладинка)", type: "images", captions: "photo_captions" },
  { key: "plans", label: "Варіанти планування", type: "images", captions: "photo_captions" },
  { key: "video", label: "Відео YouTube (необов'язково)", type: "text" },
  { key: "published", label: "Показувати на сайті", type: "bool" },
];

export const CASE_FIELDS = [
  { key: "title", label: "Назва об'єкта", type: "text" },
  { key: "slug", label: "Адреса сторінки (латиницею)", type: "text", hint: "moduler.pro/kejsy/…" },
  { key: "kinds", label: "Тип об'єкта (можна кілька, напр. соціальний + містечко)", type: "multi", options: Object.entries(CASE_KINDS) },
  { key: "location", label: "Де", type: "text" },
  { key: "format", label: "Формат (модулі, площа)", type: "text" },
  { key: "year", label: "Рік", type: "text" },
  { key: "task", label: "Задача клієнта", type: "textarea" },
  { key: "solution", label: "Що зробили", type: "textarea" },
  { key: "quote", label: "Слова власника (лише справжні, з дозволу)", type: "textarea" },
  { key: "quote_author", label: "Хто сказав", type: "text" },
  { key: "photos", label: "Фото (перше — обкладинка)", type: "images", captions: "photo_captions" },
  { key: "published", label: "Показувати на сайті", type: "bool" },
];

export const PAGE_FIELDS = [
  { key: "title", label: "Назва сторінки", type: "text" },
  { key: "slug", label: "Адреса (латиницею)", type: "text", hint: "moduler.pro/…" },
  { key: "seo_title", label: "Заголовок для Google (до 60 символів)", type: "text", max: 60 },
  { key: "seo_description", label: "Опис для Google (до 160 символів)", type: "textarea", max: 160 },
  { key: "og_image", label: "Картинка для соцмереж і месенджерів", type: "image" },
  { key: "published", label: "Сторінка доступна на сайті", type: "bool" },
];

const link = (key, label) => ({ key, label, type: "link" });
export const SETTINGS_SECTIONS = [
  { title: "Контакти", key: "contacts", fields: [
    { key: "phone", label: "Телефон (для дзвінка), +380…", type: "text" },
    { key: "phone_display", label: "Телефон як показувати", type: "text" },
    { key: "viber", label: "Viber (номер), якщо інший", type: "text" },
    { key: "telegram", label: "Telegram: @нік, посилання або номер (порожньо — за телефоном)", type: "text" },
    { key: "instagram", label: "Instagram (нік)", type: "text" },
    { key: "facebook", label: "Facebook (посилання)", type: "text" },
    { key: "youtube", label: "YouTube (посилання)", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "office", label: "Головний офіс (як показувати)", type: "text" },
    { key: "office_url", label: "Офіс на мапі (посилання)", type: "text" },
    { key: "office_street", label: "Офіс: вулиця й номер (для Google)", type: "text" },
    { key: "office_city", label: "Офіс: місто", type: "text" },
    { key: "address", label: "Виробництво / адреса", type: "text" },
    { key: "address_url", label: "Посилання на мапу", type: "text" },
    { key: "showroom", label: "Шоурум", type: "text" },
    { key: "showroom_url", label: "Шоурум на мапі", type: "text" },
  ] },
  { title: "Меню й підвал", key: "", fields: [
    { key: "nav", label: "Пункти меню", type: "list", item: "Пункт", fields: [{ key: "label", label: "Назва", type: "text" }, { key: "href", label: "Посилання", type: "href" },
      { key: "also", label: "Підсвічувати також на сторінках (через кому, напр. /avatar, /villa-8)", type: "text" },
      { key: "items", label: "Підпункти — випадний список (назва пункту веде на його «Посилання», стрілка поруч відкриває список; на цих сторінках угорі зʼявляється перемикач)", type: "list", item: "Підпункт", fields: [
        { key: "label", label: "Назва", type: "text" }, { key: "href", label: "Посилання", type: "href" }, { key: "text", label: "Коротке пояснення під назвою", type: "text" },
      ] }] },
    link("header_cta", "Кнопка в шапці"),
    { key: "footer_text", label: "Текст у підвалі", type: "textarea" },
    { key: "footer_links", label: "Посилання в підвалі", type: "list", item: "Посилання", fields: [{ key: "label", label: "Назва", type: "text" }, { key: "href", label: "Посилання", type: "href" }] },
    { key: "sticky_bar", label: "Нижня панель на телефоні (дзвінок, Viber, заявка)", type: "bool" },
  ] },
  { title: "Калькулятор", key: "calc", hint: "Без ставок калькулятор не показує суму — лише збирає параметри й контакт. Ставка = ціна будинку за 1 м² на цьому рівні.", fields: [
    { key: "currency", label: "Валюта", type: "select", options: [["USD", "$ долар"], ["EUR", "€ євро"], ["UAH", "₴ гривня"]] },
    { key: "rates", label: "Ставки за м²", type: "group", fields: [
      { key: "shell", label: "Конструктив, за м²", type: "number" },
      { key: "prefinish", label: "Під оздоблення, за м²", type: "number" },
      { key: "ready", label: "Готове житло, за м²", type: "number" },
    ] },
    { key: "regions", label: "Доставка по регіонах", type: "list", item: "Регіон", fields: [{ key: "name", label: "Регіон", type: "text" }, { key: "price", label: "Доставка, сума", type: "number" }] },
    { key: "extras", label: "Додаткові роботи", type: "list", item: "Робота", fields: [
      { key: "name", label: "Назва", type: "text" }, { key: "price", label: "Ціна", type: "number" },
      { key: "per", label: "Як рахувати", type: "select", options: [["fix", "за все"], ["m2", "за м² будинку"]] },
    ] },
    { key: "note", label: "Примітка під сумою", type: "textarea" },
  ] },
  { title: "Заявки", key: "lead", hint: "Заявки з сайту потрапляють у CRM → Ліди (джерело «сайт») і в Telegram.", fields: [
    { key: "goals", label: "Варіанти «Що плануєте» (порожньо — стандартні)", type: "strings", item: "Варіант" },
    { key: "areas", label: "Варіанти «Площа» (порожньо — стандартні)", type: "strings", item: "Варіант" },
    { key: "button", label: "Текст кнопки", type: "text" },
    { key: "note", label: "Текст під кнопкою", type: "textarea" },
    { key: "success_title", label: "Після відправки — заголовок", type: "text" },
    { key: "success_text", label: "Після відправки — текст", type: "textarea" },
  ] },
  { title: "Бренд", key: "brand", fields: [
    { key: "name", label: "Назва", type: "text" },
    { key: "tagline", label: "Підпис", type: "text" },
    { key: "logo", label: "Логотип (темний, для шапки)", type: "image" },
    { key: "logo_light", label: "Логотип (світлий, для підвалу)", type: "image" },
  ] },
  { title: "Google і соцмережі", key: "seo", fields: [
    { key: "title", label: "Заголовок сайту для Google", type: "text", max: 60 },
    { key: "description", label: "Опис сайту для Google", type: "textarea", max: 160 },
    { key: "og_image", label: "Картинка для соцмереж", type: "image" },
  ] },
  { title: "Аналітика", key: "analytics", hint: "Після вставки ID сайт сам рахує відвідування й заявки (подія generate_lead / Lead).", fields: [
    { key: "ga4", label: "Google Analytics 4 (G-XXXXXXX)", type: "text" },
    { key: "meta_pixel", label: "Meta Pixel ID (лише цифри)", type: "text" },
  ] },
];
