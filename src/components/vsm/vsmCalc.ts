// VSM calculation engine — the single place where process metrics, demand / takt, inventory days,
// lead time, PCE, waste cost, current ↔ future comparison and workforce need are computed. Every VSM
// screen (map, tabs, dashboard, exports) reads these results; nothing here invents a value: a figure
// that was not entered counts as 0 and the derived metric follows from that.
// Pure functions, no React — tested by scripts/vsm-calc-test.ts.
import type { VsmFactorySetup, VsmProcess } from "./vsmTypes.js";
import { buildProcessGraph, computeCriticalPath, computeGraphLayout } from "./vsmGraph.js";
import { futureCounterpart } from "./vsmFuture.js";

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clampPct = (n: number) => Math.max(0, Math.min(100, n));
const sum = <T,>(list: T[], f: (x: T) => number) => list.reduce((acc, x) => acc + (f(x) || 0), 0);

// ---- process level ----

// Availability, performance, quality, OEE and capacity from the entered production data:
//   Availability = (Production time − changeover − breakdown − first-piece approval) / production time
//   Performance  = actual quantity × ideal C/T / available time
//   Quality      = good / (good + scrap)
//   OEE          = A × P × Q;  Capacity (units/day) = available time / ideal C/T
// When the inputs a ratio needs are missing, the stored value is kept (0 if none). C/T itself is never
// recomputed — it is what the user entered.
export function computeProcessMetrics(p: VsmProcess): VsmProcess {
  const actualQty = p.actualQuantity ?? 0;
  const goodParts = p.goodParts !== undefined ? p.goodParts : Math.round(actualQty * ((p.quality ?? 0) / 100));
  const scrap = p.scrap !== undefined ? p.scrap : Math.round(actualQty * (1 - (p.quality ?? 0) / 100));
  const quality = goodParts + scrap > 0 ? round1((goodParts / (goodParts + scrap)) * 100) : (p.quality ?? 0);

  const shiftHours = p.shiftHours || Array.from({ length: p.shifts ?? 0 }, () => 8);
  const totalHours = shiftHours.reduce((s, h) => s + h, 0);
  const productionMinutes = totalHours * 60;
  const breakdown = p.breakdownTime ?? p.downtimeMinutes ?? 0;
  const availableMinutes = productionMinutes - (p.changeoverTime ?? 0) - breakdown - (p.firstPieceApproval ?? 0);

  const availability = productionMinutes > 0
    ? clampPct(round1((availableMinutes / productionMinutes) * 100))
    : (p.availability ?? 0);
  const idealCT = p.idealCycleTime || p.cycleTime;
  const performance = availableMinutes > 0 && p.actualQuantity !== undefined
    ? clampPct(round1(((p.actualQuantity * idealCT) / (availableMinutes * 60)) * 100))
    : (p.performance ?? 0);
  const oee = round1((availability * performance * quality) / 10000);
  const capacity = idealCT > 0 ? Math.round((availableMinutes * 60) / idealCT) : (p.capacity ?? 0);

  return {
    ...p,
    shiftHours,
    workingHours: totalHours,
    quality,
    availability,
    performance,
    oee,
    capacity,
    cycleTime: p.cycleTime,
    downtimeMinutes: breakdown,
    goodParts,
    scrap
  };
}

// Future-state overlay: each process with its simulation edits applied.
export function applySimulation(processes: VsmProcess[], edits: Record<string, Partial<VsmProcess>>): VsmProcess[] {
  return processes.map(p => ({ ...p, ...(edits[p.id] || {}) }));
}

export const computeAll = (processes: VsmProcess[]) => processes.map(computeProcessMetrics);

// ---- demand and takt ----

export interface VsmDemand {
  weekly: number;
  daily: number;
  monthly: number;
  workDaysPerYear: number;   // annualization of daily losses: working days per week × 52
}

export function demandOf(setup: Pick<VsmFactorySetup, "weeklyDemand" | "workingDays">): VsmDemand {
  const weekly = setup.weeklyDemand ?? 0;
  const days = setup.workingDays ?? 0;
  return {
    weekly,
    daily: days > 0 ? Math.round(weekly / days) : 0,
    monthly: Math.round((weekly * 52) / 12),
    workDaysPerYear: days * 52
  };
}

// Net available seconds per day: shifts × (shift length − breaks − planned maintenance). The shift
// count is taken from the first process (as before) until the project-level shift model lands (V2).
export function netAvailableSecondsPerDay(setup: Pick<VsmFactorySetup, "shiftDuration" | "breakTimes" | "plannedMaintenance">, shifts: number): number {
  const netMinsPerShift = (setup.shiftDuration ?? 0) * 60 - (setup.breakTimes ?? 0) - (setup.plannedMaintenance ?? 0);
  return Math.max(0, shifts) * Math.max(0, netMinsPerShift) * 60;
}

export const taktTimeOf = (netSecondsPerDay: number, dailyDemand: number) =>
  dailyDemand > 0 ? round1(netSecondsPerDay / dailyDemand) : 0;

// Pitch = takt × pieces per customer pack (seconds); 0 when no pack size was entered.
export const pitchOf = (taktTime: number, packSize?: number) => (packSize && packSize > 0 ? round1(taktTime * packSize) : 0);

// Shift count for net available time: the project-level value, else the first process's (older projects).
export const shiftsForTakt = (setup: Pick<VsmFactorySetup, "shiftsPerDay">, processes: VsmProcess[]) =>
  setup.shiftsPerDay ?? processes[0]?.shifts ?? 0;

// ---- inventory and lead time ----

export type VsmTimelineProcess = VsmProcess & { inventoryDays: number };

// Inventory days = WIP before the process ÷ daily demand. `inventoryBefore` is the WIP every screen
// edits; the legacy `wipQuantity` copy is no longer read (editing WIP used to have no effect on the
// map for projects that still carried it).
export function withInventoryDays(processes: VsmProcess[], dailyDemand: number): VsmTimelineProcess[] {
  return processes.map((p, idx, arr) => ({
    ...p,
    inventoryBefore: p.inventoryBefore ?? 0,
    inventoryDays: dailyDemand > 0 ? round2((p.inventoryBefore ?? 0) / dailyDemand) : 0,
    prevProcessId: p.prevProcessId || (idx > 0 ? arr[idx - 1].id : undefined),
    nextProcessId: p.nextProcessId || (idx < arr.length - 1 ? arr[idx + 1].id : undefined)
  }));
}

// Lead time (days) = longest WIP-wait path through the flow graph; parallel lanes are not added up.
// For a single chain this equals the plain sum.
export function leadTimeOf(processes: VsmTimelineProcess[]) {
  const edges = buildProcessGraph(processes).edges;
  const layout = computeGraphLayout(processes, edges);
  const critical = computeCriticalPath(processes, layout.rank, layout.predecessors);
  return { edges, layout, totalDays: critical.totalDays, criticalPathIds: critical.criticalPathIds };
}

// Raw material (after the supplier) and finished goods (before shipping) in days of demand.
export interface VsmEndStocks {
  rawDays: number;
  fgDays: number;
}

export function endStockDays(setup: Pick<VsmFactorySetup, "rawMaterialQty" | "finishedGoodsQty">, dailyDemand: number): VsmEndStocks {
  const days = (qty?: number) => (dailyDemand > 0 && qty ? round2(qty / dailyDemand) : 0);
  return { rawDays: days(setup.rawMaterialQty), fgDays: days(setup.finishedGoodsQty) };
}

// Value-added seconds of a process: the entered VA time, else its C/T.
export const valueAddedSeconds = (p: VsmProcess) => (p.valueAddedTime !== undefined ? p.valueAddedTime : p.cycleTime);

export interface VsmFlowSummary {
  totalWip: number;               // WIP between processes (raw material / finished goods not included)
  leadTimeDays: number;           // raw material + longest WIP path + finished goods
  processingSeconds: number;      // Σ value-added time (C/T where no VA time was entered)
  pcePct: number;                 // process cycle efficiency = processing ÷ lead time × 100 (unrounded)
  criticalPathIds: Set<string>;
}

export function flowSummary(processes: VsmTimelineProcess[], ends: VsmEndStocks = { rawDays: 0, fgDays: 0 }): VsmFlowSummary {
  const lead = leadTimeOf(processes);
  const processingSeconds = sum(processes, valueAddedSeconds);
  const leadTimeDays = round2(ends.rawDays + lead.totalDays + ends.fgDays);
  const leadSeconds = leadTimeDays * 24 * 3600;
  return {
    totalWip: sum(processes, p => p.inventoryBefore),
    leadTimeDays,
    processingSeconds,
    pcePct: leadSeconds > 0 ? (processingSeconds / leadSeconds) * 100 : 0,
    criticalPathIds: lead.criticalPathIds
  };
}

// ---- bottleneck and extremes ----

const pick = (list: VsmProcess[], better: (a: VsmProcess, b: VsmProcess) => boolean) =>
  list.length === 0 ? null : list.reduce((best, cur) => (better(cur, best) ? cur : best), list[0]);

// Bottleneck = highest C/T (the station that limits the line).
export const bottleneckOf = <T extends VsmProcess>(list: T[]) => pick(list, (a, b) => a.cycleTime > b.cycleTime) as T | null;
export const highestDowntimeOf = <T extends VsmProcess>(list: T[]) => pick(list, (a, b) => a.downtimeMinutes > b.downtimeMinutes) as T | null;
export const highestInventoryOf = <T extends VsmProcess>(list: T[]) => pick(list, (a, b) => a.inventoryBefore > b.inventoryBefore) as T | null;
export const lowestOeeOf = <T extends VsmProcess>(list: T[]) => pick(list, (a, b) => a.oee < b.oee) as T | null;

// ---- money ----

export interface VsmWasteCost {
  holding: number;
  scrap: number;
  downtime: number;
  total: number;
}

// Annual loss from the unit costs the user entered (0 when a rate was not entered):
// WIP × yearly holding cost + daily output × defect rate × days × scrap unit cost + downtime hours × days × hourly cost.
// Daily output is the actual quantity (capacity only when no actual was entered).
export function annualWasteCost(
  processes: VsmProcess[],
  setup: Pick<VsmFactorySetup, "holdingCostPerWipYearly" | "scrapUnitCost" | "downtimeHourlyCost">,
  workDaysPerYear: number
): VsmWasteCost {
  const holding = sum(processes, p => p.inventoryBefore) * (setup.holdingCostPerWipYearly ?? 0);
  const scrap = sum(processes, p => (p.actualQuantity ?? p.capacity) * (1 - p.quality / 100) * workDaysPerYear * (setup.scrapUnitCost ?? 0));
  const downtime = sum(processes, p => (p.downtimeMinutes / 60) * workDaysPerYear * (setup.downtimeHourlyCost ?? 0));
  return { holding, scrap, downtime, total: Math.round(holding + scrap + downtime) };
}

// ---- current ↔ future ----

export function compareStates(
  current: VsmProcess[],
  future: VsmProcess[],
  dailyDemand: number,
  setup: VsmFactorySetup,
  futureSetup: VsmFactorySetup = setup   // future map's own stocks (V5); defaults to the current setup
) {
  const demand = demandOf(setup);
  const currT = withInventoryDays(current, dailyDemand);
  const futT = withInventoryDays(future, dailyDemand);
  const currFlow = flowSummary(currT, endStockDays(setup, dailyDemand));
  const futFlow = flowSummary(futT, endStockDays(futureSetup, dailyDemand));
  const avg = (list: VsmProcess[], f: (p: VsmProcess) => number) => (list.length > 0 ? round1(sum(list, f) / list.length) : 0);

  const currBottleneck = bottleneckOf(current);
  const futBottleneck = bottleneckOf(future);
  const currCost = annualWasteCost(current, setup, demand.workDaysPerYear);
  const futCost = annualWasteCost(future, futureSetup, demand.workDaysPerYear);

  const currOperators = sum(current, p => p.operatorCount);
  const futOperators = sum(future, p => p.operatorCount);
  const currCap = sum(current, p => p.capacity);
  const futCap = sum(future, p => p.capacity);

  // Per-process comparison follows ids (a merged future step stands for every process it absorbed).
  const perProcess = (f: (p: VsmProcess) => number) => current.map(p => ({
    name: p.name,
    Mevcut: f(p),
    Gelecek: f(futureCounterpart(p, future) || p)
  }));

  // CT balance (Yamazumi-style): lightest ÷ busiest station; 100% = perfectly balanced.
  const balance = (list: VsmProcess[]) => {
    const cts = list.map(p => p.cycleTime || 0).filter(ct => ct > 0);
    return cts.length > 0 ? Math.round((Math.min(...cts) / Math.max(...cts)) * 100) : 0;
  };

  // CI themes: each meaningful Current → Future delta per process counts as one theme.
  const kaizenThemes: { process: string; theme: string; detail: string }[] = [];
  current.forEach(p => {
    const f = futureCounterpart(p, future);
    if (!f) return;
    const currDays = dailyDemand > 0 ? p.inventoryBefore / dailyDemand : 0;
    const futDays = dailyDemand > 0 ? f.inventoryBefore / dailyDemand : 0;
    if (f.operatorCount < p.operatorCount) kaizenThemes.push({ process: p.name, theme: "Adam Azaltma", detail: `${p.operatorCount} -> ${f.operatorCount} operatör` });
    if (f.oee - p.oee >= 1) kaizenThemes.push({ process: p.name, theme: "Verimlilik (OEE)", detail: `%${p.oee} -> %${f.oee}` });
    if (currDays - futDays >= 0.1) kaizenThemes.push({ process: p.name, theme: "Stok Azaltma", detail: `${round1(currDays)} -> ${round1(futDays)} gün` });
  });

  return {
    currentWip: currFlow.totalWip,
    futureWip: futFlow.totalWip,
    currentLeadTime: round1(currFlow.leadTimeDays),
    futureLeadTime: round1(futFlow.leadTimeDays),
    currentBottleneckName: currBottleneck ? currBottleneck.name : "N/A",
    futureBottleneckName: futBottleneck ? futBottleneck.name : "N/A",
    currentBottleneckOee: currBottleneck ? currBottleneck.oee : 0,
    futureBottleneckOee: futBottleneck ? futBottleneck.oee : 0,
    currentAvgOee: avg(current, p => p.oee),
    futureAvgOee: avg(future, p => p.oee),
    currentAvgAvail: avg(current, p => p.availability),
    futureAvgAvail: avg(future, p => p.availability),
    currentWasteCost: currCost.total,
    futureWasteCost: futCost.total,
    annualSavings: Math.max(0, Math.round(currCost.total - futCost.total)),
    currentOperatorProductivity: currOperators > 0 ? Math.round(currCap / currOperators) : 0,
    futureOperatorProductivity: futOperators > 0 ? Math.round(futCap / futOperators) : 0,
    currentBlueCollar: currOperators,
    futureBlueCollar: futOperators,
    // PCE is typically far below 1 %, so it keeps 3 decimals.
    currentVaRatio: Math.min(100, Math.round(currFlow.pcePct * 1000) / 1000),
    futureVaRatio: Math.min(100, Math.round(futFlow.pcePct * 1000) / 1000),
    currentOpCount: current.length,
    futureOpCount: future.length,
    currentCtBalance: balance(current),
    futureCtBalance: balance(future),
    kaizenThemes,
    scrapChartData: perProcess(p => p.scrap || 0),
    defectChartData: perProcess(p => round1(100 - p.quality)),
    setupChartData: perProcess(p => p.changeoverTime || 0)
  };
}

export type VsmStateComparison = ReturnType<typeof compareStates>;

// Header strip of the future-state map: deltas are 0 until the user actually changed something.
export function simulationDeltas(cmp: VsmStateComparison, hasEdits: boolean) {
  if (!hasEdits) return { hasEdits: false, leadTimeReduction: 0, inventoryReduction: 0, costSavings: 0 };
  const pct = (a: number, b: number) => (a > 0 ? Math.max(0, Math.round(((a - b) / a) * 100)) : 0);
  return {
    hasEdits: true,
    leadTimeReduction: pct(cmp.currentLeadTime, cmp.futureLeadTime),
    inventoryReduction: pct(cmp.currentWip, cmp.futureWip),
    costSavings: cmp.annualSavings
  };
}

// ---- workforce (norm kadro) ----

// Required operators per process, from the current state only:
//   "takt":     ceil(C/T ÷ takt) — parallel stations needed to meet takt
//   "capacity": ceil(daily demand × C/T ÷ (net available seconds × OEE))
// Fully automatic stations (no operator, has a machine) need 0.
export function workforceAnalysis(
  processes: VsmProcess[],
  method: "takt" | "capacity",
  taktTime: number,
  dailyDemand: number,
  setup: Pick<VsmFactorySetup, "shiftDuration" | "breakTimes" | "plannedMaintenance">
) {
  const netSecondsPerShift = netAvailableSecondsPerDay(setup, 1);
  const perProcess = processes.map(p => {
    const mevcut = p.operatorCount;
    const isFullyAutomatic = p.operatorCount === 0 && p.machineCount > 0;
    let gerekli = 0;
    if (!isFullyAutomatic) {
      if (method === "takt") {
        gerekli = taktTime > 0 ? Math.max(1, Math.ceil((p.cycleTime || 0) / taktTime)) : mevcut;
      } else {
        const netAvail = (p.shifts || 0) * netSecondsPerShift;
        const eff = (p.oee || 0) / 100;
        gerekli = netAvail > 0 && eff > 0 ? Math.max(1, Math.ceil((dailyDemand * (p.cycleTime || 0)) / (netAvail * eff))) : mevcut;
      }
    }
    return { id: p.id, name: p.name, mevcut, gerekli, fark: mevcut - gerekli };
  });
  const totalMevcut = sum(perProcess, p => p.mevcut);
  const totalGerekli = sum(perProcess, p => p.gerekli);
  return {
    perProcess,
    totalMevcut,
    totalGerekli,
    surplus: totalMevcut - totalGerekli,
    utilizationPct: totalMevcut > 0 ? round1((totalGerekli / totalMevcut) * 100) : 0,
    totalWorkContentSeconds: sum(processes, p => p.cycleTime || 0),
    netSecondsPerShift
  };
}

// ---- takt and capacity checks (plan step V4) ----

export interface VsmTaktRow {
  id: string;
  name: string;
  cycleTime: number;
  overTakt: boolean;          // C/T > takt: this station cannot meet demand at its current set-up
  capacity: number;           // units per day (available time ÷ ideal C/T)
  demandCoverPct: number;     // capacity ÷ daily demand × 100 (0 when no demand entered)
}

// Operator-balance view: every process's C/T against takt, and capacity against daily demand.
// The constraint is the highest C/T; it is "over takt" when that C/T exceeds takt.
export function taktCheck(processes: VsmProcess[], taktTime: number, dailyDemand: number) {
  const rows: VsmTaktRow[] = processes.map(p => ({
    id: p.id,
    name: p.name,
    cycleTime: p.cycleTime,
    overTakt: taktTime > 0 && p.cycleTime > taktTime,
    capacity: p.capacity,
    demandCoverPct: dailyDemand > 0 ? Math.round((p.capacity / dailyDemand) * 1000) / 10 : 0
  }));
  const constraint = bottleneckOf(processes);
  return {
    rows,
    overTaktCount: rows.filter(r => r.overTakt).length,
    shortOfDemandCount: dailyDemand > 0 ? rows.filter(r => r.capacity < dailyDemand).length : 0,
    constraintName: constraint?.name ?? "",
    constraintCt: constraint?.cycleTime ?? 0,
    constraintOverTakt: !!constraint && taktTime > 0 && constraint.cycleTime > taktTime
  };
}

// Money figures are shown only when at least one unit cost was entered in Kurulum.
export const costsEntered = (setup: Partial<Pick<VsmFactorySetup, "holdingCostPerWipYearly" | "scrapUnitCost" | "downtimeHourlyCost">>) =>
  (setup.holdingCostPerWipYearly ?? 0) > 0 || (setup.scrapUnitCost ?? 0) > 0 || (setup.downtimeHourlyCost ?? 0) > 0;

// "391.350 ₺" — the customer's currency after the number, Turkish grouping.
export const formatMoney = (n: number, currency: string) =>
  `${Math.round(n).toLocaleString("tr-TR")} ${currency}`;
