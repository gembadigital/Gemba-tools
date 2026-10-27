// Kaizen Öneri Sistemi — müşteri bazında ayarlar (Faz 2-B). One record per customer (factory_id) in
// the `kaizen_settings` collection. Every field has a default equal to the behavior before Faz 2-B,
// so a customer that never opened the Ayarlar tab behaves exactly as before. Shared by the client
// and the server (server imports it as "../utils/kaizenSettings.js"), so keep it dependency-free.

// Every currency a record may carry. The per-customer `currencies` list only narrows what the forms
// offer; the server still accepts any known value so an old record keeps its real currency label
// after an admin removes that currency from the list.
export const KNOWN_CURRENCIES = ["TL", "USD", "EUR", "GBP", "CHF", "Eş Değer Ürün"] as const;
export const IN_KIND_CURRENCY = "Eş Değer Ürün"; // in-kind saving — never converted or summed

export interface KaizenSettings {
  baseCurrency: string;              // reports sum in this currency
  currencies: string[];              // offered in the forms (always includes baseCurrency)
  fxRates: Record<string, number>;   // 1 unit of key = n baseCurrency; missing/0 → not summed
  waitingWarningDays: number;        // approval queue: amber from this many days
  waitingOverdueDays: number;        // approval queue: red from this many days
  followUpDays: number[];            // persistence checks after completion, ascending (1–2 entries)
  suggestionTypes: string[];         // Öneri Sınıfı choices
  stages: string[];                  // Öneri Aşaması (PDCA) choices
  paybackPeriods: string[];          // Kazanç Süresi choices
  rewardPerPoint: number;            // reward paid per Kurul point, in baseCurrency; 0 = no amount shown
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_KAIZEN_SETTINGS: KaizenSettings = {
  baseCurrency: "TL",
  currencies: ["TL", "USD", "EUR", IN_KIND_CURRENCY],
  fxRates: {},
  waitingWarningDays: 3,
  waitingOverdueDays: 7,
  followUpDays: [30, 90],
  // Values confirmed against the legacy KaizenSuite app (see kaizenCalc.ts history).
  suggestionTypes: ["Maliyet Azaltma", "Kalite", "ISG", "5S", "Verimlilik", "Enerji"],
  stages: ["Plan (Planlama)", "Do (Yap)", "Check (Kontrol)", "Action (Önlem Al)"],
  paybackPeriods: ["Parça Başı", "Senelik", "Bir Sefer"],
  rewardPerPoint: 0
};

export const MAX_OPTIONS = 30;
export const MAX_OPTION_LENGTH = 60;

// Trimmed, de-duplicated (case-insensitive), length-capped list; empty or missing → default.
function optionList(v: any, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out: string[] = [];
  for (const raw of v) {
    const t = typeof raw === "string" ? raw.trim().slice(0, MAX_OPTION_LENGTH) : "";
    if (t && !out.some(o => o.toLocaleLowerCase("tr") === t.toLocaleLowerCase("tr"))) out.push(t);
    if (out.length >= MAX_OPTIONS) break;
  }
  return out.length ? out : fallback;
}

const isKnownCurrency = (v: any): v is string => typeof v === "string" && (KNOWN_CURRENCIES as readonly string[]).includes(v);
const intIn = (v: any, min: number, max: number): number | null => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// Fills defaults and drops anything invalid. Used on read (stored record → settings) and on write
// (request body → record), so a malformed or partial record can never break the forms or reports.
export function normalizeKaizenSettings(input: any): KaizenSettings {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const d = DEFAULT_KAIZEN_SETTINGS;

  const baseCurrency = isKnownCurrency(src.baseCurrency) && src.baseCurrency !== IN_KIND_CURRENCY ? src.baseCurrency : d.baseCurrency;
  const listed = Array.isArray(src.currencies) ? src.currencies.filter(isKnownCurrency) : d.currencies;
  const currencies = KNOWN_CURRENCIES.filter(c => c === baseCurrency || listed.includes(c));

  const fxRates: Record<string, number> = {};
  const rawRates = src.fxRates && typeof src.fxRates === "object" ? src.fxRates : {};
  for (const c of currencies) {
    if (c === baseCurrency || c === IN_KIND_CURRENCY) continue;
    const r = Number(rawRates[c]);
    if (Number.isFinite(r) && r > 0) fxRates[c] = r;
  }

  const warning = intIn(src.waitingWarningDays, 1, 365) ?? d.waitingWarningDays;
  const overdueRaw = intIn(src.waitingOverdueDays, 1, 365) ?? d.waitingOverdueDays;
  const overdue = Math.max(overdueRaw, warning + 1);

  const parsed: number[] = Array.isArray(src.followUpDays)
    ? src.followUpDays.map((v: any) => intIn(v, 1, 730)).filter((v: number | null): v is number => v !== null)
    : d.followUpDays;
  const days = parsed.filter((v, i) => parsed.indexOf(v) === i).sort((a, b) => a - b).slice(0, 2);
  const followUpDays = days.length ? days : d.followUpDays;

  const reward = Number(src.rewardPerPoint);

  return {
    baseCurrency, currencies, fxRates,
    waitingWarningDays: warning, waitingOverdueDays: overdue,
    followUpDays,
    suggestionTypes: optionList(src.suggestionTypes, d.suggestionTypes),
    stages: optionList(src.stages, d.stages),
    paybackPeriods: optionList(src.paybackPeriods, d.paybackPeriods),
    rewardPerPoint: Number.isFinite(reward) && reward > 0 ? Math.round(reward * 100) / 100 : 0,
    ...(typeof src.updatedAt === "string" ? { updatedAt: src.updatedAt } : {}),
    ...(typeof src.updatedBy === "string" ? { updatedBy: src.updatedBy } : {})
  };
}

// Amount expressed in the base currency, or null when it cannot be converted (in-kind, or no rate
// entered). Callers must exclude nulls from totals rather than treat them as 0 or as base currency.
export function toBaseCurrency(amount: number, currency: string | undefined, settings: KaizenSettings): number | null {
  const cur = currency || settings.baseCurrency;
  const n = Number(amount) || 0;
  if (cur === settings.baseCurrency) return n;
  const rate = settings.fxRates[cur];
  return rate ? n * rate : null;
}

// Approval-queue age → severity, using the customer's own day thresholds.
export function waitingSeverityFor(days: number, settings: KaizenSettings): "normal" | "warning" | "overdue" {
  if (days >= settings.waitingOverdueDays) return "overdue";
  if (days >= settings.waitingWarningDays) return "warning";
  return "normal";
}

// Options for a currency <select>: the customer's list, plus the record's own value when an admin
// has since removed it (otherwise the select would silently show — and resave — another currency).
export function currencyChoices(settings: KaizenSettings, current?: string): string[] {
  return current && !settings.currencies.includes(current) ? [...settings.currencies, current] : settings.currencies;
}

// Same as currencyChoices for the option lists: keep a record's own value selectable after an
// admin removed or renamed it, so editing an old suggestion never silently changes it.
export function optionChoices(list: string[], current?: string | string[]): string[] {
  const values = Array.isArray(current) ? current : current ? [current] : [];
  const extra = values.filter((v, i) => v && !list.includes(v) && values.indexOf(v) === i);
  return extra.length ? [...list, ...extra] : list;
}

// Reward owed for one Kurul evaluation. A snapshot taken at approval/payment time wins, so changing
// the rate later never rewrites what was promised or paid; otherwise it is point × current rate.
export function rewardFor(
  evaluation: { point?: number; rewardAmount?: number; rewardCurrency?: string },
  settings: KaizenSettings
): { amount: number; currency: string; snapshot: boolean } | null {
  if (typeof evaluation.rewardAmount === "number" && evaluation.rewardCurrency) {
    return { amount: evaluation.rewardAmount, currency: evaluation.rewardCurrency, snapshot: true };
  }
  if (!settings.rewardPerPoint) return null;
  return { amount: Math.round((Number(evaluation.point) || 0) * settings.rewardPerPoint * 100) / 100, currency: settings.baseCurrency, snapshot: false };
}
