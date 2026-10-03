// Квізи: типи питань, заготовки й логіка переходів — спільні для конструктора (QuizzesScreen) і плеєра (QuizPlayer).

export const QUESTION_TYPES = [
  ["list", "Варіанти (текст)"],
  ["cards", "Картки з фото"],
  ["text", "Своя відповідь"],
  ["slider", "Повзунок"],
  ["date", "Дата"],
];

export const PIPELINES = [["houses", "Продаж будинків"], ["partners", "Партнерство"], ["uk-owners", "Власники (УК)"]];

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newQuestion(type = "list") {
  const q = { id: uid(), type, title: "", hint: "", required: true, multi: false, options: [] };
  if (type === "list" || type === "cards") q.options = [{ id: uid(), label: "" }, { id: uid(), label: "" }];
  if (type === "slider") Object.assign(q, { min: 20, max: 150, step: 5, unit: "м²" });
  return q;
}

export function slugify(s) {
  const map = { а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", "'": "", "ʼ": "" };
  return String(s || "").toLowerCase().split("").map((c) => (c in map ? map[c] : c)).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "quiz";
}

// готовий шаблон для модульних будинків — щоб стартувати не з порожнього
export function templateQuiz() {
  const o = (label, image = "") => ({ id: uid(), label, image });
  return {
    title: "Підбір модульного будинку",
    pipeline: "houses",
    start: {
      enabled: true,
      title: "Підберіть модульний будинок під свою задачу за 1 хвилину",
      text: "Дайте відповідь на 5 питань — отримаєте добірку моделей і орієнтовну вартість під ключ.",
      button: "Почати",
      bonus: "🎁 Бонус: каталог планувань і розрахунок вартості",
    },
    questions: [
      { ...newQuestion("cards"), title: "Для чого плануєте будинок?", options: [o("Дача / житло для себе"), o("Глемпінг або база відпочинку"), o("Здача в оренду, інвестиція"), o("Житло для працівників")] },
      { ...newQuestion("slider"), title: "Яка площа потрібна?", min: 15, max: 150, step: 5, unit: "м²" },
      { ...newQuestion("list"), title: "Чи є ділянка?", options: [o("Так, є ділянка"), o("Підбираю"), o("Ні, потрібна допомога")] },
      { ...newQuestion("list"), title: "Коли плануєте встановлення?", options: [o("Якнайшвидше"), o("За 1–3 місяці"), o("Цього року"), o("Поки вивчаю")] },
      { ...newQuestion("list"), title: "Орієнтовний бюджет?", options: [o("до $20 000"), o("$20–40 тис."), o("$40–80 тис."), o("понад $80 000")] },
    ],
    contact: { title: "Куди надіслати добірку і розрахунок?", text: "Менеджер підготує варіанти саме під ваші відповіді.", button: "Отримати добірку", ask_via: true },
    thanks: { title: "Дякуємо! Заявку отримали", text: "Звʼяжемося найближчим часом у зручний для вас спосіб." },
    design: { accent: "#2f6b4f", image: "" },
  };
}

// куди йти після відповіді: перехід варіанта → перехід питання → наступне. "contact" — форма контактів.
export function nextIndex(questions, i, answer) {
  const q = questions[i];
  let goto = "";
  if (q && (q.type === "list" || q.type === "cards") && !q.multi) {
    const opt = q.options?.find((x) => x.id === answer);
    goto = opt?.goto || "";
  }
  goto ||= q?.goto || "";
  if (goto === "contact") return questions.length;
  if (goto) {
    const j = questions.findIndex((x) => x.id === goto);
    if (j > i) return j;
  }
  return i + 1;
}

// відповідь людиною прочитаним текстом — для ліда в CRM
export function answerText(q, a) {
  if (a == null || a === "" || (Array.isArray(a) && !a.length)) return "";
  if (q.type === "list" || q.type === "cards") {
    const ids = Array.isArray(a) ? a : [a];
    return ids.map((id) => q.options.find((o) => o.id === id)?.label || "").filter(Boolean).join(", ");
  }
  if (q.type === "slider") return `${a} ${q.unit || ""}`.trim();
  if (q.type === "date") { try { return new Date(a).toLocaleDateString("uk-UA"); } catch { return String(a); } }
  return String(a);
}

export const quizUrl = (origin, slug) => `${origin}/q/${slug}`;
export const embedCode = (origin, slug) =>
  `<iframe src="${quizUrl(origin, slug)}?embed=1" style="width:100%;height:680px;border:0;border-radius:16px" loading="lazy" title="Квіз"></iframe>`;
