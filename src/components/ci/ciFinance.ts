// CI finance model (plan step C6). One meaning per field:
// - expected gain  = `expectedGain` (+ `expectedGainCurrency`), the annual target set in A3 step 3.
//   Older projects: `targetCostReduction`, else the estimate of the opportunity they were opened from.
// - realized gain  = `realizedGain` (mirrored to `actualSavings`, + `realizedGainCurrency`), the annual
//   saving entered in step 7. The 17-line `financialsInput` is an optional breakdown of it: saving the
//   breakdown sets the realized gain to its total.
// - confirmation   = `gainConfirmedAt` (consultant; see utils/ciLifecycle.ts). Reported but not
//   confirmed gains are shown apart from confirmed ones.
// - investment     = `estimatedCost` ("Yatırım bütçesi", customer currency).
import type { KaizenCard } from "../../types";
import { FxRates, normalizeCurrency, realizedOf } from "./ciMoney";

export interface GainLine { key: string; label: string; group: string }

// The 17 lines of the breakdown, grouped as on the paper Before-After form.
export const GAIN_LINES: GainLine[] = [
  { key: "scrapReduction", label: "Hurda azalışı", group: "Kalite" },
  { key: "reworkReduction", label: "Rework azalışı", group: "Kalite" },
  { key: "qualityImprovement", label: "Kalite artışı", group: "Kalite" },
  { key: "wasteReduction", label: "Fire azalışı", group: "Maliyet" },
  { key: "energySavings", label: "Enerji tasarrufu", group: "Maliyet" },
  { key: "maintenanceSavings", label: "Bakım gideri", group: "Maliyet" },
  { key: "inventoryReduction", label: "Stok azalışı", group: "Maliyet" },
  { key: "spaceSavings", label: "Alan kazanımı", group: "Maliyet" },
  { key: "setupTimeReduction", label: "Setup süresi (SMED)", group: "Verimlilik" },
  { key: "operatorEfficiency", label: "Operatör verimliliği", group: "Verimlilik" },
  { key: "oeeIncrease", label: "OEE artışı", group: "Verimlilik" },
  { key: "productionIncrease", label: "Üretim artışı", group: "Verimlilik" },
  { key: "leadTimeReduction", label: "Lead time azalışı", group: "Teslimat" },
  { key: "wipReduction", label: "WIP azalışı", group: "Teslimat" },
  { key: "deliveryPerformance", label: "Teslimat performansı", group: "Teslimat" },
  { key: "ohsGain", label: "İSG kazancı", group: "İSG" },
  { key: "otherSavings", label: "Diğer", group: "Diğer" }
];

export const breakdownTotal = (fi: any) =>
  GAIN_LINES.reduce((s, l) => s + (Number(fi?.[l.key]?.val) || 0), 0);

// Amount in the customer currency, or null when it can't be converted (no rate).
function toBase(amount: number, label: string | undefined, base: string, fx: FxRates): number | null {
  const b = normalizeCurrency(base, base);
  const code = normalizeCurrency(label, b);
  if (code === b) return amount;
  return fx[code] > 0 ? amount * fx[code] : null;
}

export interface ProjectMoney {
  expected: number | null;   // null = can't be converted
  realized: number | null;
  investment: number;
  confirmed: boolean;
  gainDate?: string;         // when the realized gain was confirmed / reported (YYYY-MM-DD)
}

export function projectMoney(k: KaizenCard, base: string, fx: FxRates, opportunityGain?: number): ProjectMoney {
  const rawExpected = typeof k.expectedGain === "number" && k.expectedGain > 0 ? k.expectedGain
    : (k.targetCostReduction || 0) > 0 ? k.targetCostReduction! : opportunityGain || 0;
  // Fallbacks (target cost reduction, opportunity estimate) are in the customer currency.
  const expectedLabel = typeof k.expectedGain === "number" && k.expectedGain > 0 ? k.expectedGainCurrency : undefined;
  const realizedRaw = realizedOf(k);
  return {
    expected: rawExpected ? toBase(rawExpected, expectedLabel, base, fx) : 0,
    realized: realizedRaw ? toBase(realizedRaw, k.realizedGainCurrency, base, fx) : 0,
    investment: Number(k.estimatedCost) || 0,
    confirmed: !!k.gainConfirmedAt,
    gainDate: (k.gainConfirmedAt || k.closedAt || k.stageDates?.[7]?.completed || k.realizedFinishDate || "").slice(0, 10) || undefined
  };
}

// Months (YYYY-MM) from `from` to `to` inclusive, at most `max` (the latest ones).
export function monthRange(from: string, to: string, max = 24): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out.slice(-max);
}

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
};

// Payback in months (investment ÷ monthly gain), or null without both.
export const paybackMonths = (investment: number, annualGain: number) =>
  investment > 0 && annualGain > 0 ? Math.round((investment / (annualGain / 12)) * 10) / 10 : null;
