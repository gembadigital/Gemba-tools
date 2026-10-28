// CI Proje Yönetimi — müşteri bazında ayarlar (plan adımı C1). One record per customer (factory_id) in
// the `ci_settings` collection. Defaults equal the behavior before C1 (the lists that used to be
// hard-coded in KaizenManager), except the demo product families, which were invented and are gone.
// Shared by the client and the server (server imports it as "../../utils/ciSettings.js"), so keep it
// dependency-free.

// Currency codes. The customer card's currency is the base; amounts in another currency are only
// summed when a rate is entered here (1 unit of the code = n base-currency units).
export const CI_CURRENCIES = ["TRY", "USD", "EUR", "GBP", "CHF"] as const;
export const CI_CURRENCY_SYMBOLS: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€", GBP: "£", CHF: "CHF" };

export interface CiProductFamily {
  name: string;
  sharePct: number; // share of plant volume, 1–100; scales opportunity losses for that family
}

export interface CiSettings {
  currencies: string[];              // offered in the money fields besides the customer's own currency
  fxRates: Record<string, number>;   // code → base-currency units per 1; missing → not summed
  departments: string[];             // suggestions for the Departman fields (free text still allowed)
  phases: string[];                  // Proje Fazı choices; "Faz n" / "Phase n" prefix sets the phase number
  productFamilies: CiProductFamily[];// Ürün Ailesi scope in the new-project wizard; empty → whole plant only
  defaultDurationDays: number;       // default deadline of a new project, in days from today
  fishboneCategories: string[];      // bones of the fishbone (Ishikawa) diagram in A3 step 4 (2–8)
  followUpDays: number[];            // sustainability checks after closing, days (1–3 entries, ascending)
  remindersEnabled: boolean;         // weekly CI reminder e-mails and event notifications
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_CI_SETTINGS: CiSettings = {
  currencies: ["USD", "EUR"],
  fxRates: {},
  departments: [
    "Üretim / Montaj", "Pres Atölyesi", "Kalite Güvence", "Bakım Onarım",
    "Endüstri Mühendisliği", "Lojistik / Depo", "Üretim Planlama"
  ],
  phases: ["Faz 1 (1 Ay)", "Faz 2 (2-3 Ay)", "Faz 3 (6-12 Ay)"],
  productFamilies: [],
  defaultDurationDays: 90,
  fishboneCategories: ["İnsan", "Makine", "Metot", "Malzeme", "Ölçüm", "Çevre"],
  followUpDays: [30, 60, 90],
  remindersEnabled: true
};

export const CI_MAX_OPTIONS = 30;
export const CI_MAX_OPTION_LENGTH = 60;

export const ciSettingsId = (factoryId: string) => `ci_settings_${factoryId}`;

// Trimmed, de-duplicated (case-insensitive), length-capped list; missing → default, empty allowed
// only where `allowEmpty`.
function optionList(v: any, fallback: string[], allowEmpty = false): string[] {
  if (!Array.isArray(v)) return fallback;
  const out: string[] = [];
  for (const raw of v) {
    const t = typeof raw === "string" ? raw.trim().slice(0, CI_MAX_OPTION_LENGTH) : "";
    if (t && !out.some(o => o.toLocaleLowerCase("tr") === t.toLocaleLowerCase("tr"))) out.push(t);
    if (out.length >= CI_MAX_OPTIONS) break;
  }
  return out.length || allowEmpty ? out : fallback;
}

const isCiCurrency = (v: any): v is string => typeof v === "string" && (CI_CURRENCIES as readonly string[]).includes(v);

// Fills defaults and drops anything invalid. Used on read (stored record → settings) and on write
// (request body → record), so a malformed or partial record can never break the screens.
export function normalizeCiSettings(input: any): CiSettings {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const d = DEFAULT_CI_SETTINGS;

  const currencies = Array.isArray(src.currencies)
    ? CI_CURRENCIES.filter(c => src.currencies.includes(c))
    : d.currencies;
  const fxRates: Record<string, number> = {};
  const rawRates = src.fxRates && typeof src.fxRates === "object" ? src.fxRates : {};
  for (const c of CI_CURRENCIES) {
    const r = Number(rawRates[c]);
    if (Number.isFinite(r) && r > 0) fxRates[c] = r;
  }

  const productFamilies: CiProductFamily[] = [];
  if (Array.isArray(src.productFamilies)) {
    for (const raw of src.productFamilies) {
      const name = typeof raw?.name === "string" ? raw.name.trim().slice(0, CI_MAX_OPTION_LENGTH) : "";
      const share = Math.round(Number(raw?.sharePct));
      if (!name || !(share >= 1 && share <= 100)) continue;
      if (productFamilies.some(p => p.name.toLocaleLowerCase("tr") === name.toLocaleLowerCase("tr"))) continue;
      productFamilies.push({ name, sharePct: share });
      if (productFamilies.length >= CI_MAX_OPTIONS) break;
    }
  }

  const days = Math.round(Number(src.defaultDurationDays));

  return {
    currencies,
    fxRates,
    departments: optionList(src.departments, d.departments, true),
    phases: optionList(src.phases, d.phases),
    productFamilies,
    defaultDurationDays: days >= 1 && days <= 1095 ? days : d.defaultDurationDays,
    fishboneCategories: (() => {
      const list = optionList(src.fishboneCategories, d.fishboneCategories).slice(0, 8);
      return list.length >= 2 ? list : d.fishboneCategories;
    })(),
    followUpDays: (() => {
      const raw = Array.isArray(src.followUpDays) ? src.followUpDays : d.followUpDays;
      const days = raw.map((v: any) => Math.round(Number(v))).filter((v: number) => v >= 1 && v <= 730);
      const uniq = days.filter((v: number, i: number) => days.indexOf(v) === i).sort((a: number, b: number) => a - b).slice(0, 3);
      return uniq.length ? uniq : d.followUpDays;
    })(),
    remindersEnabled: typeof src.remindersEnabled === "boolean" ? src.remindersEnabled : d.remindersEnabled,
    ...(typeof src.updatedAt === "string" ? { updatedAt: src.updatedAt } : {}),
    ...(typeof src.updatedBy === "string" ? { updatedBy: src.updatedBy } : {})
  };
}

// Phase number (1, 2, 3…) of a stored phase label. Projects carry labels from different eras
// ("Faz 1 (1 Ay)" from the detail form, "Phase 1: Quick Win" from older data), so filters and
// charts group by this number instead of comparing labels. No recognizable number → 1 (a project
// without a phase has always been counted as a quick win).
export function phaseNumber(label: string | undefined): number {
  const m = /(?:faz|phase)\s*(\d+)/i.exec(label || "");
  return m ? Number(m[1]) : 1;
}

// Choices for a select: the configured list, plus the record's own value when it is no longer
// listed, so editing an old project never silently changes it.
export function choicesWith(list: string[], current?: string): string[] {
  return current && !list.includes(current) ? [...list, current] : list;
}
