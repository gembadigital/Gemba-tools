// Canonical list of sidebar modules (must match the MenuTab union in App.tsx and the nav buttons
// rendered there) — shared between App.tsx (enforcement) and PlatformAdminConsole.tsx (the admin
// UI that configures per-role visibility for these same keys).
export interface SidebarModuleDef {
  key: string;
  label: string;
}

export const SIDEBAR_MODULES: SidebarModuleDef[] = [
  { key: "customers", label: "Müşteri Kartı" },
  { key: "dashboard", label: "Executive Dashboard" },
  { key: "opex-assessment", label: "OpEx Assessment" },
  { key: "plan", label: "Proje Master Plan" },
  { key: "vsm", label: "VSM Kapasite Analizi" },
  { key: "loss-analysis", label: "Loss Capacity Analizi" },
  { key: "kaizen", label: "CI Proje Yönetimi" },
  { key: "flow", label: "Spaghetti Akış Analizi" },
  { key: "timestudy", label: "Time Study" },
  { key: "balancing", label: "Yamazumi Analizi" },
  { key: "smed", label: "SMED Analizi" },
  { key: "ptr", label: "Proje Takip Raporu" },
  { key: "kaizen-suggestions", label: "Kaizen Öneri Sistemi" },
  { key: "fives", label: "5S Olgunluk Auditler" }
];

export const SIDEBAR_MODULE_KEYS = SIDEBAR_MODULES.map((m) => m.key);

export type RoleModuleVisibility = {
  Consultant: Record<string, boolean>;
  "Customer User": Record<string, boolean>;
};

// Matches current real behavior before this setting existed: Consultant sees everything,
// Customer User sees only Proje Takip Raporu (the ticket #2 fix from earlier this session).
// Admin is intentionally absent — always full access, never configurable.
export const DEFAULT_ROLE_MODULE_VISIBILITY: RoleModuleVisibility = {
  Consultant: Object.fromEntries(SIDEBAR_MODULE_KEYS.map((k) => [k, true])),
  "Customer User": Object.fromEntries(SIDEBAR_MODULE_KEYS.map((k) => [k, k === "ptr"]))
};
