export const TEAM_ROLES = ["продажі", "виробництво", "закупівля", "фінанси", "маркетинг", "монтаж", "логістика"];
export const MEMBER_TYPES = ["людина", "ai-агент", "бригада"];
export const ACCESS_LEVELS = ["адмін", "менеджер", "виконавець"];

// team_members.role/type/access_level are a directory/roster classification —
// separate from the profiles.role (admin/manager/accountant) that actually
// drives RLS and app permissions.
export const memberTypeStyles = {
  людина: { bg: "var(--success-bg)", text: "var(--success)" },
  "ai-агент": { bg: "var(--amber-bg)", text: "var(--amber)" },
  бригада: { bg: "var(--accent-bg)", text: "var(--accent)" },
};

export const accessLevelStyles = {
  адмін: { bg: "var(--danger)", text: "#fff" },
  менеджер: { bg: "var(--amber-bg)", text: "var(--amber)" },
  виконавець: { bg: "var(--border)", text: "var(--text-secondary)" },
};

// Access matrix from ТЗ Шар 7 — "не таблиця, а правило UI": documents intent,
// not enforced per-role permissions (the app only has admin/manager/accountant
// today; see the open item in the ТЗ security audit).
export const ACCESS_MATRIX_COLUMNS = ["Каталог", "CRM", "Вироб-во", "Послуги", "Фінанси", "Маркетинг"];

export const ACCESS_MATRIX = [
  { role: "Власник", cells: ["rw", "rw", "rw", "rw", "rw", "rw"] },
  { role: "Продажі", cells: ["r", "rw", "r", "rw", "none", "none"] },
  { role: "Виробництво", cells: ["r", "r", "rw", "r", "none", "none"] },
  { role: "Закупівля", cells: ["r", "none", "r", "none", "r", "none"] },
  { role: "Маркетинг", cells: ["r", "r", "none", "none", "none", "rw"] },
  { role: "Монтаж", cells: ["r", "r", "r", "rw", "none", "none"], proposed: true },
  { role: "Логістика", cells: ["r", "none", "r", "rw", "none", "none"], proposed: true },
];
