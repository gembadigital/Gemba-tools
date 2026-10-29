// VSM customer settings (plan step V10): one record per customer (vsm_settings_<factoryId>). Defaults for
// new projects' setup, the year used to annualize losses, and the thresholds the map / dashboard highlight.
// Shared by client and server; dependency-free. Defaults keep today's behaviour.
export interface VsmSettings {
  defaultWorkingDays: number;        // per week
  defaultShiftsPerDay: number;
  defaultShiftHours: number;
  defaultBreakMinutes: number;       // per shift
  defaultMaintenanceMinutes: number; // per shift
  weeksPerYear: number;              // annualization of daily losses: working days × weeksPerYear
  oeeTarget: number;                 // % — processes below are highlighted (0 = off)
  wipDaysWarning: number;            // days — stock zones above are highlighted (0 = off)
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_VSM_SETTINGS: VsmSettings = {
  defaultWorkingDays: 5,
  defaultShiftsPerDay: 0,
  defaultShiftHours: 8,
  defaultBreakMinutes: 0,
  defaultMaintenanceMinutes: 0,
  weeksPerYear: 52,
  oeeTarget: 0,
  wipDaysWarning: 0
};

const num = (v: any, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

export function normalizeVsmSettings(raw: any): VsmSettings {
  const r = raw && typeof raw === "object" ? raw : {};
  const d = DEFAULT_VSM_SETTINGS;
  return {
    defaultWorkingDays: num(r.defaultWorkingDays, 1, 7, d.defaultWorkingDays),
    defaultShiftsPerDay: num(r.defaultShiftsPerDay, 0, 4, d.defaultShiftsPerDay),
    defaultShiftHours: num(r.defaultShiftHours, 1, 24, d.defaultShiftHours),
    defaultBreakMinutes: num(r.defaultBreakMinutes, 0, 240, d.defaultBreakMinutes),
    defaultMaintenanceMinutes: num(r.defaultMaintenanceMinutes, 0, 240, d.defaultMaintenanceMinutes),
    weeksPerYear: num(r.weeksPerYear, 1, 53, d.weeksPerYear),
    oeeTarget: num(r.oeeTarget, 0, 100, d.oeeTarget),
    wipDaysWarning: num(r.wipDaysWarning, 0, 365, d.wipDaysWarning),
    ...(typeof r.updatedAt === "string" ? { updatedAt: r.updatedAt.slice(0, 40) } : {}),
    ...(typeof r.updatedBy === "string" ? { updatedBy: r.updatedBy.slice(0, 120) } : {})
  };
}
