// Currency handling for CI projects. Amounts are stored next to free-form currency labels ("₺", "TL",
// "$", "USD", …) and must never be summed across currencies. Totals are in the customer's own
// currency; an amount in another currency is converted with the rate from the CI settings
// (`fxRates`: 1 unit of the code = n customer-currency units) or, without a rate, left out and
// counted so the caller can say so. A missing label means the customer's currency — that is what
// the forms defaulted to when the label was not stored.
import type { KaizenCard } from "../../types";

const CURRENCY_ALIASES: Record<string, string> = {
  "₺": "TRY", "TL": "TRY", "TRY": "TRY",
  "$": "USD", "USD": "USD",
  "€": "EUR", "EUR": "EUR",
  "£": "GBP", "GBP": "GBP",
};

export function normalizeCurrency(label: string | undefined, fallback: string): string {
  const key = (label || "").trim().toUpperCase();
  if (!key) return CURRENCY_ALIASES[fallback.trim().toUpperCase()] || fallback;
  return CURRENCY_ALIASES[key] || key;
}

export type FxRates = Record<string, number>;

// Amount in the base currency, or null when it can't be converted (no rate).
function inBase(amount: number, label: string | undefined, base: string, fxRates: FxRates): number | null {
  const code = normalizeCurrency(label, base);
  if (code === base) return amount;
  const rate = fxRates[code];
  return rate > 0 ? amount * rate : null;
}

export interface MoneySum {
  total: number;
  excluded: number; // projects with a non-zero amount in a currency without a rate, not in `total`
}

function sumInCurrency(
  projects: KaizenCard[],
  amountOf: (k: KaizenCard) => number | undefined,
  currencyOf: (k: KaizenCard) => string | undefined,
  baseCurrency: string,
  fxRates: FxRates
): MoneySum {
  const base = normalizeCurrency(baseCurrency, baseCurrency);
  let total = 0;
  let excluded = 0;
  for (const k of projects) {
    const amount = Number(amountOf(k)) || 0;
    if (!amount) continue;
    const converted = inBase(amount, currencyOf(k), base, fxRates);
    if (converted === null) excluded++;
    else total += converted;
  }
  return { total: Math.round(total * 100) / 100, excluded };
}

// Realized saving: `actualSavings` mirrors `realizedGain` (the detail form writes both), both
// labelled by `realizedGainCurrency`.
export const realizedOf = (k: KaizenCard) => k.actualSavings || k.realizedGain || 0;

export function sumRealized(projects: KaizenCard[], baseCurrency: string, fxRates: FxRates = {}): MoneySum {
  return sumInCurrency(projects, realizedOf, k => k.realizedGainCurrency, baseCurrency, fxRates);
}

// Expected annual gain: `expectedGain`, or on older projects `targetCostReduction` (customer
// currency) — the same rule as the finance dashboard (ciFinance.ts projectMoney).
const hasOwnExpected = (k: KaizenCard) => typeof k.expectedGain === "number" && k.expectedGain > 0;
export function sumExpected(projects: KaizenCard[], baseCurrency: string, fxRates: FxRates = {}): MoneySum {
  return sumInCurrency(projects, k => hasOwnExpected(k) ? k.expectedGain : k.targetCostReduction,
    k => hasOwnExpected(k) ? k.expectedGainCurrency : undefined, baseCurrency, fxRates);
}

// Realized saving of one project in the base currency, or 0 when it can't be converted — for
// per-category / per-department breakdowns that must stay consistent with sumRealized.
export function realizedInCurrency(k: KaizenCard, baseCurrency: string, fxRates: FxRates = {}): number {
  const base = normalizeCurrency(baseCurrency, baseCurrency);
  return inBase(realizedOf(k), k.realizedGainCurrency, base, fxRates) ?? 0;
}

export function excludedNote(excluded: number): string {
  return excluded > 0 ? `${excluded} proje kuru girilmemiş bir para biriminde, toplama dahil değil (CI Ayarları → Kurlar)` : "";
}
