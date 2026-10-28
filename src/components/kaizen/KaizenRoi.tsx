import React from "react";
import { TrendingUp } from "lucide-react";
import type { KaizenSuggestion, KaizenEvaluation, KaizenImplementation } from "./kaizenTypes";
import { expectedSaving } from "./kaizenCalc";
import { KaizenSettings, toBaseCurrency } from "../../utils/kaizenSettings";
import { computeRoi, recurrenceOf, paybackText, RoiResult } from "../../utils/kaizenRoi";

// Geri dönüş kartı (Faz 5.2): expected (current expected saving vs estimated cost) next to actual
// (actual saving vs actual investment, once entered), with the assumptions written out.

export type SuggestionRoi = { roi: RoiResult; costEstimated?: boolean } | { unavailable: string };

// Both sides in the customer's base currency; null when a figure cannot be converted.
export function suggestionRoi(
  s: KaizenSuggestion, e: KaizenEvaluation | null | undefined, impl: KaizenImplementation | null | undefined,
  settings: KaizenSettings, kind: "expected" | "actual"
): SuggestionRoi | null {
  const recurrence = recurrenceOf(s.paybackPeriod);
  const years = s.productionYears || undefined;
  if (kind === "expected") {
    const x = expectedSaving(s, e);
    if (!x.amount && !s.estimatedCost) return null;
    const saving = toBaseCurrency(x.amount, x.currency, settings);
    const cost = s.estimatedCost ? toBaseCurrency(s.estimatedCost, s.estimatedCostCurrency, settings) : 0;
    if (saving === null || cost === null) return { unavailable: "Tutarlardan biri çevrilemeyen para biriminde (Eş Değer Ürün ya da kuru tanımsız)." };
    return { roi: computeRoi({ saving, cost, recurrence, years }) };
  }
  if (!impl || !(impl.actualSaving > 0)) return null;
  const saving = toBaseCurrency(impl.actualSaving, impl.actualSavingCurrency, settings);
  const hasActualCost = (impl.actualCost || 0) > 0;
  const cost = hasActualCost
    ? toBaseCurrency(impl.actualCost!, impl.actualCostCurrency || settings.baseCurrency, settings)
    : s.estimatedCost ? toBaseCurrency(s.estimatedCost, s.estimatedCostCurrency, settings) : 0;
  if (saving === null || cost === null) return { unavailable: "Tutarlardan biri çevrilemeyen para biriminde." };
  return { roi: computeRoi({ saving, cost, recurrence, years }), costEstimated: !hasActualCost && !!s.estimatedCost };
}

const fmt = (n: number, cur: string) => `${Math.round(n).toLocaleString("tr-TR")} ${cur}`;

export default function KaizenRoi({ s, evaluation, impl, settings }: {
  s: KaizenSuggestion; evaluation?: KaizenEvaluation | null; impl?: KaizenImplementation | null; settings: KaizenSettings;
}) {
  const expected = suggestionRoi(s, evaluation, impl, settings, "expected");
  const actual = suggestionRoi(s, evaluation, impl, settings, "actual");
  if (!expected && !actual) return null;
  const base = settings.baseCurrency;
  const annual = recurrenceOf(s.paybackPeriod) === "annual";
  const cols = [["Beklenen", expected], ["Gerçekleşen", actual]].filter(([, v]) => v) as [string, SuggestionRoi][];
  const anyLifetime = cols.some(([, v]) => "roi" in v && v.roi.lifetimeNet !== null);
  const rows: [string, (r: RoiResult) => string][] = [
    [annual ? "Net kazanç (ilk yıl)" : "Net kazanç", r => fmt(r.net, base)],
    ["ROI", r => (r.roiPct === null ? "—" : `%${r.roiPct.toLocaleString("tr-TR")}`)],
    ["Geri ödeme süresi", r => paybackText(r.paybackMonths)],
    ...(anyLifetime ? [[`Net kazanç (${s.productionYears} yıl)`, (r: RoiResult) => (r.lifetimeNet === null ? "—" : fmt(r.lifetimeNet, base))] as [string, (r: RoiResult) => string]] : [])
  ];

  return (
    <section aria-label="Geri dönüş" className="rounded-xl ring-1 ring-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-3"><TrendingUp className="w-4 h-4 text-emerald-600" />Geri dönüş</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500"><th className="text-left font-semibold pb-1.5" />{cols.map(([l]) => <th key={l} className="text-right font-semibold pb-1.5">{l}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label} className="border-t border-slate-100">
              <td className="py-1.5 text-slate-600">{label}</td>
              {cols.map(([l, v]) => (
                <td key={l} className="py-1.5 text-right font-semibold text-slate-900 tabular-nums">
                  {"roi" in v ? f(v.roi) : <span className="text-xs font-normal text-slate-400">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="text-[11px] text-slate-500 mt-3 space-y-0.5 list-disc list-inside">
        <li>Kazanç Süresi "{s.paybackPeriod || "—"}": kazanç {annual ? "yıllık" : "tek seferlik"} kabul edildi; tutarlar {base} cinsinden (ayarlardaki sabit kurlarla).</li>
        {annual ? <li>Geri ödeme = yatırım ÷ yıllık kazanç × 12; ROI ilk yıl için.</li> : <li>Tek seferlik kazanç maliyeti karşılıyorsa geri ödeme hemen, karşılamıyorsa hiç.</li>}
        {cols.map(([l, v]) => ("unavailable" in v ? <li key={l} className="text-amber-700">{l}: {v.unavailable}</li> : null))}
        {actual && "roi" in actual && actual.costEstimated && <li>Gerçekleşen yatırım girilmediği için tahmini maliyet kullanıldı.</li>}
      </ul>
    </section>
  );
}
