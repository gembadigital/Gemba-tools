// Currency handling for CI projects. Amounts are stored next to free-form currency labels ("₺", "TL",
// "$", "USD", …) and must never be summed across currencies. Until per-customer FX rates exist
// (CI settings, plan step C1), totals only include amounts in the customer's own currency and the
// caller shows how many projects were left out. A missing label means the customer's currency —
// that is what the forms defaulted to when the label was not stored.
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

export interface MoneySum {
  total: number;
  excluded: number; // projects with a non-zero amount in another currency, not in `total`
}

function sumInCurrency(
  projects: KaizenCard[],
  amountOf: (k: KaizenCard) => number | undefined,
  currencyOf: (k: KaizenCard) => string | undefined,
  baseCurrency: string
): MoneySum {
  const base = normalizeCurrency(baseCurrency, baseCurrency);
  let total = 0;
  let excluded = 0;
  for (const k of projects) {
    const amount = Number(amountOf(k)) || 0;
    if (!amount) continue;
    if (normalizeCurrency(currencyOf(k), base) === base) total += amount;
    else excluded++;
  }
  return { total, excluded };
}

// Realized saving: `actualSavings` mirrors `realizedGain` (the detail form writes both), both
// labelled by `realizedGainCurrency`.
export const realizedOf = (k: KaizenCard) => k.actualSavings || k.realizedGain || 0;

export function sumRealized(projects: KaizenCard[], baseCurrency: string): MoneySum {
  return sumInCurrency(projects, realizedOf, k => k.realizedGainCurrency, baseCurrency);
}

export function sumExpected(projects: KaizenCard[], baseCurrency: string): MoneySum {
  return sumInCurrency(projects, k => k.expectedGain, k => k.expectedGainCurrency, baseCurrency);
}

// Realized saving of one project, or 0 when it is in another currency — for per-category /
// per-department breakdowns that must stay consistent with sumRealized.
export function realizedInCurrency(k: KaizenCard, baseCurrency: string): number {
  const base = normalizeCurrency(baseCurrency, baseCurrency);
  return normalizeCurrency(k.realizedGainCurrency, base) === base ? realizedOf(k) : 0;
}

export function excludedNote(excluded: number): string {
  return excluded > 0 ? `${excluded} proje farklı para biriminde, toplama dahil değil` : "";
}
