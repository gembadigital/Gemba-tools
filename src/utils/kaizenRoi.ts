// Geri dönüş (Faz 5.2): net kazanç, ROI and payback for one suggestion or a set of them.
//
// How the saving recurs comes from "Kazanç Süresi" (customer-editable labels, matched by meaning):
// - Parça Başı / Senelik → the saving is ANNUAL (per piece: estimatedSaving already holds
//   unit × annual volume, see kaizenSaving.ts). Net and ROI are for the first year; payback is
//   cost ÷ annual saving, in months. Per piece with production years also gives a lifetime net.
// - Bir Sefer (or any label that is neither) → a one-off saving: net = saving − cost, ROI on that;
//   it pays back at once if saving ≥ cost, otherwise never.
// Amounts must already be in one currency (callers convert to the customer's base currency).
// Pure and dependency-free so screens, reports and tests share the exact same arithmetic.

export type SavingRecurrence = "annual" | "one-off";

export function recurrenceOf(paybackPeriod?: string): SavingRecurrence {
  const p = (paybackPeriod || "").toLocaleLowerCase("tr");
  return p.includes("parça") || p.includes("sene") || p.includes("yıl") || p.includes("yil") ? "annual" : "one-off";
}

export interface RoiInput {
  saving: number;           // annual for "annual", total for "one-off"
  cost: number;             // investment / implementation cost (0 = none)
  recurrence: SavingRecurrence;
  years?: number;           // production years (per piece) — enables the lifetime figure
}

export interface RoiResult {
  recurrence: SavingRecurrence;
  saving: number;               // the inputs, clamped at 0 — lets callers total a portfolio
  cost: number;
  net: number;                  // first-year net for annual, total net for one-off
  roiPct: number | null;        // null when there is no cost to return on
  paybackMonths: number | null; // 0 = at once; null = does not pay back
  lifetimeNet: number | null;   // annual × years − cost, per piece with years only
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeRoi({ saving, cost, recurrence, years }: RoiInput): RoiResult {
  const s = Math.max(0, Number(saving) || 0);
  const c = Math.max(0, Number(cost) || 0);
  const net = s - c;
  const roiPct = c > 0 ? round1((net / c) * 100) : null;
  let paybackMonths: number | null;
  if (c === 0) paybackMonths = 0;
  else if (recurrence === "annual") paybackMonths = s > 0 ? round1((c / s) * 12) : null;
  else paybackMonths = s >= c ? 0 : null;
  const y = Number(years) || 0;
  const lifetimeNet = recurrence === "annual" && y > 0 ? s * y - c : null;
  return { recurrence, saving: s, cost: c, net, roiPct, paybackMonths, lifetimeNet };
}

// Portfolio view: annual savings and one-off savings are not added up as if alike — the portfolio
// ROI is (annual + one-off − cost) ÷ cost for the first year, payback from the annual part only.
export function portfolioRoi(items: { saving: number; cost: number; recurrence: SavingRecurrence }[]) {
  const annual = items.filter(i => i.recurrence === "annual").reduce((t, i) => t + (i.saving || 0), 0);
  const oneOff = items.filter(i => i.recurrence === "one-off").reduce((t, i) => t + (i.saving || 0), 0);
  const cost = items.reduce((t, i) => t + (i.cost || 0), 0);
  const net = annual + oneOff - cost;
  const roiPct = cost > 0 ? round1((net / cost) * 100) : null;
  const uncovered = Math.max(0, cost - oneOff);
  const paybackMonths = cost === 0 || uncovered === 0 ? 0 : annual > 0 ? round1((uncovered / annual) * 12) : null;
  return { annual, oneOff, cost, net, roiPct, paybackMonths, count: items.length };
}

export function paybackText(months: number | null): string {
  if (months === null) return "Geri ödemiyor";
  if (months === 0) return "Hemen";
  if (months < 1) return "1 aydan kısa";
  if (months < 24) return `${months.toLocaleString("tr-TR")} ay`;
  return `${round1(months / 12).toLocaleString("tr-TR")} yıl`;
}
