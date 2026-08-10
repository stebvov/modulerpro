// Tab keys a "partner" role's access group can be granted — must match the
// `key` on each AppShell TAB_GROUPS entry. Фінанси/Users/Team are
// intentionally never offered here: partners never get financial or
// user-management access regardless of group settings.
export const PARTNER_TAB_OPTIONS = [
  { key: "catalog", label: "Каталог" },
  { key: "crm", label: "CRM" },
  { key: "production", label: "Виробництво" },
  { key: "services", label: "Послуги" },
  { key: "marketing", label: "Маркетинг" },
];
