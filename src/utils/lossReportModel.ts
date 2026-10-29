// Loss Capacity executive report — the data the report prints. Built on the Loss screen from the
// figures it shows (so the report and the screen always agree), posted to
// /api/opex-report/loss-capacity and rendered to PDF by the same Chromium pipeline as the OpEx
// executive report (src/server/lossReport). No imports: shared by client and server.

export type LossRateSource = "birim" | "vsm" | "kart" | null;

export interface LossReportLine {
  key: string;
  label: string;
  year: number;
  real: boolean;          // customer's real annual figure ("Gerçek Mali Veriler") replaced the calculation
  unresolved: string[];   // stations whose unit cost could not be resolved for this line
}

export interface LossReportStation {
  name: string;
  line: string;           // VSM project / line label ("" = outside VSM)
  oee: number | null;
  oeeSource: "VSM" | "Loss" | null;
  scrapQty: number;
  reworkQty: number;
  breakdownMinPerDay: number;
  setupMinPerDay: number;
  wip: number;
  costs: { scrap?: number; rework?: number; downtime?: number; setup?: number; laborLoss?: number; inventory?: number };
  missingInputs: number;
  rates: { scrap: LossRateSource; rework: LossRateSource; labor: LossRateSource; machine: LossRateSource; wip: LossRateSource };
}

export interface LossReportJipmLine {
  no: number;
  name: string;
  group: string;
  minutesPerDay: number;
  personHoursPerDay: number;
  sources: string[];
  labor: number;
  machine: number;
  material: number;
  direct: number;
  total: number;
  contribution: number;
  unpricedAt: string[];
  tool: string;
}

export interface LossReportJipmStation {
  name: string;
  oee: number | null;
  oeeSource: "VSM" | "Loss" | null;
  loadingMinutesPerDay: number;
  oeeLossMinutesPerDay: number;
  availabilityLoss: number;  // minutes/day per OEE part (0 when not split)
  performanceLoss: number;
  qualityLoss: number;
  unexplainedMinutesPerDay: number;
}

export interface LossReportRecoveryRow {
  area: string;
  subject: string;
  costGroup: string;
  leanTool: string;
  basis: string;
  lossMin: number;
  lossMax: number;
  avgLoss: number;
  improvementMin: number;
  improvementMax: number;
  gainMin: number;
  gainMax: number;
  avgGain: number;
  investment: number;
  paybackMonths: number | null;
  roiPercent: number;
  severity: string;
  realizedSavings: number;
  projects: number;          // CI / Kaizen projects already opened for this subject
}

export interface LossReportModel {
  firm: string;
  reportDate: string;        // ISO
  reportNo: string;
  preparedBy: string;
  currency: string;
  scopeLabel: string;        // "Tüm fabrika" or the product group
  industry: string;
  revenue: number;           // model revenue (scope)
  annualRevenue: number;     // customer card
  annualVolume: number;      // customer card (scoped)
  costStructure: { material: number; labor: number; overtimeBurden: number; energy: number; maintenance: number; overhead: number; operatingProfit: number };
  dailyDemand: number;
  totals: {
    lossYear: number;
    lossPctOfRevenue: number;
    copqYear: number;
    copqPctOfRevenue: number;
    benchmarkStatus: string;
    recoveryAvg: number;
    recoveryMin: number;
    recoveryMax: number;
    investment: number;
    realizedSavings: number;
    hiddenCostYear: number;
    equivalentOperators: number;
    oeeLossSharePct: number | null;
    avgOee: number | null;
    stationCount: number;
    stationsWithOee: number;
    jipmTotal: number;
    jipmContribution: number;
  };
  lossLines: LossReportLine[];
  stations: LossReportStation[];
  rateSourceCounts: { birim: number; vsm: number; kart: number; none: number };
  cardBasis: { scrapUnit: string; reworkUnit: string; laborHour: string; machineHour: string; wipHolding: string; holdingRatePct: number; blueCollar: number; hoursPerPersonYear: number };
  jipm: { lines: LossReportJipmLine[]; unexplained: { minutes: number; cost: number }; stations: LossReportJipmStation[] };
  copq: { label: string; group: "İç hata" | "Dış hata" | "Muayene" | "Kapasite & akış"; year: number; entered: boolean }[];
  recovery: LossReportRecoveryRow[];
  profitCurve: { stage: string; margin: number }[];
  warnings: string[];        // data gaps the reader must know about
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown, max = 300): string => (typeof v === "string" ? v.slice(0, max) : "");
const arr = <T,>(v: unknown, max: number, f: (x: any) => T): T[] => (Array.isArray(v) ? v.slice(0, max).map(f) : []);
const src = (v: unknown): LossRateSource => (v === "birim" || v === "vsm" || v === "kart" ? v : null);
const nullable = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const oeeSrc = (v: unknown): "VSM" | "Loss" | null => (v === "VSM" || v === "Loss" ? v : null);

// Server-side: coerce a posted body into a well-formed model (unknown fields dropped, sizes capped).
export function normalizeLossReportModel(b: any): LossReportModel {
  const t = b?.totals || {};
  const cs = b?.costStructure || {};
  const cb = b?.cardBasis || {};
  const rc = b?.rateSourceCounts || {};
  const j = b?.jipm || {};
  return {
    firm: str(b?.firm, 160) || "Müşteri",
    reportDate: str(b?.reportDate, 40) || new Date().toISOString(),
    reportNo: str(b?.reportNo, 40),
    preparedBy: str(b?.preparedBy, 160),
    currency: str(b?.currency, 8) || "TL",
    scopeLabel: str(b?.scopeLabel, 160),
    industry: str(b?.industry, 80),
    revenue: num(b?.revenue),
    annualRevenue: num(b?.annualRevenue),
    annualVolume: num(b?.annualVolume),
    costStructure: { material: num(cs.material), labor: num(cs.labor), overtimeBurden: num(cs.overtimeBurden), energy: num(cs.energy), maintenance: num(cs.maintenance), overhead: num(cs.overhead), operatingProfit: num(cs.operatingProfit) },
    dailyDemand: num(b?.dailyDemand),
    totals: {
      lossYear: num(t.lossYear), lossPctOfRevenue: num(t.lossPctOfRevenue), copqYear: num(t.copqYear), copqPctOfRevenue: num(t.copqPctOfRevenue),
      benchmarkStatus: str(t.benchmarkStatus, 60), recoveryAvg: num(t.recoveryAvg), recoveryMin: num(t.recoveryMin), recoveryMax: num(t.recoveryMax),
      investment: num(t.investment), realizedSavings: num(t.realizedSavings), hiddenCostYear: num(t.hiddenCostYear), equivalentOperators: num(t.equivalentOperators),
      oeeLossSharePct: nullable(t.oeeLossSharePct), avgOee: nullable(t.avgOee), stationCount: num(t.stationCount), stationsWithOee: num(t.stationsWithOee),
      jipmTotal: num(t.jipmTotal), jipmContribution: num(t.jipmContribution)
    },
    lossLines: arr(b?.lossLines, 20, x => ({ key: str(x?.key, 40), label: str(x?.label, 80), year: num(x?.year), real: !!x?.real, unresolved: arr(x?.unresolved, 60, y => str(y, 120)) })),
    stations: arr(b?.stations, 120, x => ({
      name: str(x?.name, 120), line: str(x?.line, 120), oee: nullable(x?.oee), oeeSource: oeeSrc(x?.oeeSource),
      scrapQty: num(x?.scrapQty), reworkQty: num(x?.reworkQty), breakdownMinPerDay: num(x?.breakdownMinPerDay), setupMinPerDay: num(x?.setupMinPerDay), wip: num(x?.wip),
      costs: Object.fromEntries(["scrap", "rework", "downtime", "setup", "laborLoss", "inventory"].filter(k => typeof x?.costs?.[k] === "number").map(k => [k, num(x.costs[k])])),
      missingInputs: num(x?.missingInputs),
      rates: { scrap: src(x?.rates?.scrap), rework: src(x?.rates?.rework), labor: src(x?.rates?.labor), machine: src(x?.rates?.machine), wip: src(x?.rates?.wip) }
    })),
    rateSourceCounts: { birim: num(rc.birim), vsm: num(rc.vsm), kart: num(rc.kart), none: num(rc.none) },
    cardBasis: { scrapUnit: str(cb.scrapUnit), reworkUnit: str(cb.reworkUnit), laborHour: str(cb.laborHour), machineHour: str(cb.machineHour), wipHolding: str(cb.wipHolding), holdingRatePct: num(cb.holdingRatePct), blueCollar: num(cb.blueCollar), hoursPerPersonYear: num(cb.hoursPerPersonYear) },
    jipm: {
      lines: arr(j.lines, 16, x => ({
        no: num(x?.no), name: str(x?.name, 80), group: str(x?.group, 20), minutesPerDay: num(x?.minutesPerDay), personHoursPerDay: num(x?.personHoursPerDay),
        sources: arr(x?.sources, 4, y => str(y, 20)), labor: num(x?.labor), machine: num(x?.machine), material: num(x?.material), direct: num(x?.direct),
        total: num(x?.total), contribution: num(x?.contribution), unpricedAt: arr(x?.unpricedAt, 60, y => str(y, 120)), tool: str(x?.tool, 120)
      })),
      unexplained: { minutes: num(j.unexplained?.minutes), cost: num(j.unexplained?.cost) },
      stations: arr(j.stations, 120, x => ({
        name: str(x?.name, 120), oee: nullable(x?.oee), oeeSource: oeeSrc(x?.oeeSource), loadingMinutesPerDay: num(x?.loadingMinutesPerDay),
        oeeLossMinutesPerDay: num(x?.oeeLossMinutesPerDay), availabilityLoss: num(x?.availabilityLoss), performanceLoss: num(x?.performanceLoss),
        qualityLoss: num(x?.qualityLoss), unexplainedMinutesPerDay: num(x?.unexplainedMinutesPerDay)
      }))
    },
    copq: arr(b?.copq, 30, x => ({
      label: str(x?.label, 80),
      group: (["İç hata", "Dış hata", "Muayene", "Kapasite & akış"].includes(x?.group) ? x.group : "Kapasite & akış") as LossReportModel["copq"][number]["group"],
      year: num(x?.year), entered: !!x?.entered
    })),
    recovery: arr(b?.recovery, 30, x => ({
      area: str(x?.area, 80), subject: str(x?.subject, 120), costGroup: str(x?.costGroup, 120), leanTool: str(x?.leanTool, 120), basis: str(x?.basis, 160),
      lossMin: num(x?.lossMin), lossMax: num(x?.lossMax), avgLoss: num(x?.avgLoss), improvementMin: num(x?.improvementMin), improvementMax: num(x?.improvementMax),
      gainMin: num(x?.gainMin), gainMax: num(x?.gainMax), avgGain: num(x?.avgGain), investment: num(x?.investment), paybackMonths: nullable(x?.paybackMonths),
      roiPercent: num(x?.roiPercent), severity: str(x?.severity, 20), realizedSavings: num(x?.realizedSavings), projects: num(x?.projects)
    })),
    profitCurve: arr(b?.profitCurve, 8, x => ({ stage: str(x?.stage, 120), margin: num(x?.margin) })),
    warnings: arr(b?.warnings, 40, x => str(x, 400))
  };
}
