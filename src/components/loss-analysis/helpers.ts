import { ProcessItem, CalculatedProcess, IndustryBenchmark, IndustryType, LossInputField, LOSS_INPUT_FIELDS } from "./types";
import type { ProcessLossCosts } from "./lossCosting";

const finite = (v: any): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const positive = (v: any): number | undefined => { const n = finite(v); return n !== undefined && n > 0 ? n : undefined; };

// Values a cost-table row carries from the VSM sync (vsmRoutes.ts sync-cost-table): process fields on
// the record, entered daily loss data in `vsmLoss`, project setup in `vsmSetup`. VSM records changeover,
// breakdown and first-piece approval as minutes per DAY; the loss model counts setup minutes × setups
// per week and breakdown per shift, so the daily totals are expressed as "one block per working day"
// (frequency = working days / week) and breakdown is split over the shifts.
export function vsmValuesOf(row: any): Partial<Record<LossInputField, number>> {
  const L = (row?.vsmLoss && typeof row.vsmLoss === "object") ? row.vsmLoss : {};
  const S = (row?.vsmSetup && typeof row.vsmSetup === "object") ? row.vsmSetup : {};
  const shifts = positive(row?.shiftCount);
  const days = positive(S.workingDays);
  const changeover = finite(row?.changeoverTime);
  const breakdown = finite(L.breakdownTime);
  const out: Partial<Record<LossInputField, number | undefined>> = {
    shiftsPerDay: shifts,
    workingHoursPerShift: positive(row?.workingHours),
    workingDaysPerWeek: days,
    breakTimeMinutes: positive(S.breakTimes),
    plannedMaintenanceMinutes: positive(S.plannedMaintenance),
    plannedQtyPerDay: finite(L.plannedQuantity),
    producedQtyPerDay: finite(L.actualQuantity),
    scrapQty: finite(L.scrap),
    reworkQty: finite(L.rework),
    operatorsPerShift: positive(row?.operatorCount),
    interProcessInventory: finite(L.inventoryBefore),
    theoreticalCycleTime: positive(L.idealCycleTime) ?? positive(row?.cycleTime),
    breakdownMinutesPerShift: breakdown !== undefined && shifts ? Math.round((breakdown / shifts) * 10) / 10 : undefined,
    setupTimeMinutes: changeover
  };
  if (changeover !== undefined && days) {
    out.setupFrequencyPerWeek = days;
    out.machineAdjustmentMinutes = finite(L.firstPieceApproval);
  }
  const clean: Partial<Record<LossInputField, number>> = {};
  for (const f of LOSS_INPUT_FIELDS) if (out[f] !== undefined) clean[f] = out[f] as number;
  return clean;
}

// Cost-table row → ProcessItem. Per field: value corrected on this screen (`lossOverrides`) → VSM
// measurement → older Loss entry (`lossInputs`, L1) → missing. Nothing is made up: a missing field is 0
// in the formulas and listed in `missingFields` ("girilmedi" in the editor).
export function mapCostTableRow(row: any): ProcessItem {
  const overrides = (row?.lossOverrides && typeof row.lossOverrides === "object") ? row.lossOverrides : {};
  const legacy = (row?.lossInputs && typeof row.lossInputs === "object") ? row.lossInputs : {};
  const vsm = vsmValuesOf(row);
  const missingFields: LossInputField[] = [];
  const fieldSources: Partial<Record<LossInputField, "vsm" | "loss">> = {};
  const inputs = {} as Record<LossInputField, number>;
  for (const f of LOSS_INPUT_FIELDS) {
    const own = finite(overrides[f]);
    const old = finite(legacy[f]);
    const v = own ?? vsm[f] ?? old;
    if (v === undefined) missingFields.push(f);
    else fieldSources[f] = own === undefined && vsm[f] !== undefined ? "vsm" : "loss";
    inputs[f] = v ?? 0;
  }
  const S = (row?.vsmSetup && typeof row.vsmSetup === "object") ? row.vsmSetup : {};
  const L = (row?.vsmLoss && typeof row.vsmLoss === "object") ? row.vsmLoss : {};
  const weekly = positive(S.weeklyDemand);
  const days = positive(S.workingDays);
  return {
    id: row.id,
    name: row.name,
    vsmProjectId: row.vsmProjectId,
    isCollapsed: true,
    ...inputs,
    totalProdTimePerDayMinutes: inputs.shiftsPerDay * inputs.workingHoursPerShift * 60,
    defectiveParts: inputs.scrapQty + inputs.reworkQty,
    missingFields,
    fieldSources,
    vsmDailyDemand: weekly && days ? Math.round(weekly / days) : 0,
    machineCount: finite(row?.machineCount),
    minorStopsMinutesPerDay: finite(L.minorStops),
    waitingMinutesPerDay: finite(L.waitingTime),
    vsmOee: row?.vsmProjectId ? {
      oee: positive(row.oee), availability: positive(row.utilizationRate),
      performance: positive(L.performance), quality: positive(L.quality)
    } : undefined,
    vsmUnitCosts: {
      scrapUnitCost: positive(S.scrapUnitCost),
      downtimeHourlyCost: positive(S.downtimeHourlyCost),
      holdingCostPerWipYearly: positive(S.holdingCostPerWipYearly)
    }
  };
}

// Daily demand of the processes in scope: the sum over their VSM projects (each counted once).
// 0 when no VSM project in scope has a weekly demand — takt and WIP days then read "hesaplanamadı".
export function dailyDemandOf(processes: ProcessItem[]): number {
  const byProject = new Map<string, number>();
  for (const p of processes) if (p.vsmProjectId && (p.vsmDailyDemand ?? 0) > 0) byProject.set(p.vsmProjectId, p.vsmDailyDemand as number);
  let total = 0;
  byProject.forEach(v => { total += v; });
  return total;
}

export const INDUSTRY_BENCHMARKS: Record<IndustryType, IndustryBenchmark> = {
  "Automotive": {
    industry: "Automotive", oee: 85, scrap: 0.8, setup: 12, inventoryTurns: 24, leadTime: 1.5, laborProductivity: 95, copq: 1.8, onTimeDelivery: 99.2
  },
  "White Goods": {
    industry: "White Goods", oee: 82, scrap: 1.2, setup: 15, inventoryTurns: 18, leadTime: 2.5, laborProductivity: 88, copq: 2.2, onTimeDelivery: 98.5
  },
  "Electric Motor": {
    industry: "Electric Motor", oee: 80, scrap: 1.5, setup: 20, inventoryTurns: 15, leadTime: 3.2, laborProductivity: 75, copq: 2.5, onTimeDelivery: 97.8
  },
  "Casting": {
    industry: "Casting", oee: 72, scrap: 4.5, setup: 45, inventoryTurns: 8, leadTime: 5.0, laborProductivity: 45, copq: 5.5, onTimeDelivery: 94.5
  },
  "Machining": {
    industry: "Machining", oee: 78, scrap: 1.8, setup: 25, inventoryTurns: 12, leadTime: 4.0, laborProductivity: 65, copq: 3.0, onTimeDelivery: 96.0
  },
  "Metal Forming": {
    industry: "Metal Forming", oee: 76, scrap: 2.2, setup: 35, inventoryTurns: 10, leadTime: 4.5, laborProductivity: 58, copq: 3.5, onTimeDelivery: 95.5
  },
  "Food": {
    industry: "Food", oee: 74, scrap: 3.0, setup: 30, inventoryTurns: 30, leadTime: 2.0, laborProductivity: 110, copq: 4.0, onTimeDelivery: 97.0
  },
  "Plastic Injection": {
    industry: "Plastic Injection", oee: 81, scrap: 1.4, setup: 18, inventoryTurns: 14, leadTime: 3.0, laborProductivity: 82, copq: 2.4, onTimeDelivery: 98.0
  },
  "Textile": {
    industry: "Textile", oee: 70, scrap: 3.5, setup: 40, inventoryTurns: 8, leadTime: 12.0, laborProductivity: 35, copq: 5.0, onTimeDelivery: 93.0
  },
  "Electronics": {
    industry: "Electronics", oee: 84, scrap: 0.5, setup: 10, inventoryTurns: 20, leadTime: 2.2, laborProductivity: 125, copq: 1.5, onTimeDelivery: 99.0
  },
  "Other": {
    industry: "Other", oee: 75, scrap: 2.0, setup: 25, inventoryTurns: 12, leadTime: 3.5, laborProductivity: 70, copq: 3.0, onTimeDelivery: 96.0
  },
  "Diğer": {
    industry: "Diğer", oee: 75, scrap: 2.0, setup: 25, inventoryTurns: 12, leadTime: 3.5, laborProductivity: 70, copq: 3.0, onTimeDelivery: 96.0
  }
};

// Main Process Analytical Engine
export function calculateProcessesData(processes: ProcessItem[], dailyDemand: number, computedTaktTime: number): CalculatedProcess[] {
  return processes.map(proc => {
    // 1. Availability Calculations
    const netWorkingTimePerShift = (proc.workingHoursPerShift * 60) - proc.breakTimeMinutes - proc.plannedMaintenanceMinutes;
    const dailyPlannedTimeMinutes = proc.workingHoursPerShift * proc.shiftsPerDay * 60;
    const dailyNetWorkingTimeAvailable = netWorkingTimePerShift * proc.shiftsPerDay;

    const weeklySetupTime = proc.setupTimeMinutes * proc.setupFrequencyPerWeek;
    const weeklyBreakdownTime = proc.breakdownMinutesPerShift * proc.shiftsPerDay * proc.workingDaysPerWeek;
    const weeklyAdjustmentTime = proc.machineAdjustmentMinutes * proc.setupFrequencyPerWeek;
    const totalWeeklyDowntimeMinutes = weeklySetupTime + weeklyBreakdownTime + weeklyAdjustmentTime;
    
    const dailyDowntimeMinutes = totalWeeklyDowntimeMinutes / Math.max(1, proc.workingDaysPerWeek);
    const dailyActualNetWorkingTime = Math.max(0, dailyNetWorkingTimeAvailable - dailyDowntimeMinutes);
    const equipmentAvailability = dailyNetWorkingTimeAvailable > 0 ? (dailyActualNetWorkingTime / dailyNetWorkingTimeAvailable) : 0;

    // 2. Quality Calculations
    // Derived live from scrapQty + reworkQty (both directly user-editable) rather than the stored
    // `defectiveParts` field, so this stays in sync when the user edits Hurda/Yeniden İşleme Adedi.
    const defectRate = proc.producedQtyPerDay > 0 ? ((proc.scrapQty + proc.reworkQty) / proc.producedQtyPerDay) : 0;
    const qualityRatio = proc.producedQtyPerDay > 0 ? ((proc.producedQtyPerDay - proc.scrapQty) / proc.producedQtyPerDay) : 0;

    // 3. Performance & Capacity
    const actualCycleTimeSeconds = proc.producedQtyPerDay > 0 ? parseFloat(((dailyActualNetWorkingTime * 60) / proc.producedQtyPerDay).toFixed(1)) : 0;
    const plannedCycleTimeSeconds = proc.plannedQtyPerDay > 0 ? parseFloat(((dailyPlannedTimeMinutes * 60) / proc.plannedQtyPerDay).toFixed(1)) : 0;

    // No assumed cycle time: a missing C/T (0) yields 0 capacity/performance instead of a made-up 30 s.
    const theoreticalIdealCycle = proc.theoreticalCycleTime ?? 0;
    const plannedCapacityPerDay = theoreticalIdealCycle > 0 ? Math.round((dailyNetWorkingTimeAvailable * 60) / theoreticalIdealCycle) : 0;
    const plannedCapacityPerWeek = plannedCapacityPerDay * proc.workingDaysPerWeek;
    
    const machineOccupancyRate = dailyPlannedTimeMinutes > 0 ? (proc.producedQtyPerDay * actualCycleTimeSeconds) / (dailyPlannedTimeMinutes * 60) : 0;
    const capacityUtilization = plannedCapacityPerDay > 0 ? (proc.producedQtyPerDay / plannedCapacityPerDay) : 0;

    // 4. Productivity & Labor
    const totalOperatorsPerDay = proc.operatorsPerShift * proc.shiftsPerDay;
    const laborProductivityPerDay = totalOperatorsPerDay > 0 ? (proc.producedQtyPerDay / totalOperatorsPerDay) : 0;
    const laborProductivityPerWeek = laborProductivityPerDay * proc.workingDaysPerWeek;

    const targetWorkforce = actualCycleTimeSeconds > 0 && dailyPlannedTimeMinutes > 0 ? parseFloat(((proc.producedQtyPerDay * actualCycleTimeSeconds) / (dailyPlannedTimeMinutes * 60) * totalOperatorsPerDay).toFixed(1)) : 0;
    const targetWorkforceTakt = computedTaktTime > 0 ? parseFloat(((proc.producedQtyPerDay * actualCycleTimeSeconds) / computedTaktTime).toFixed(1)) : 0;
    const excessLaborHeadcount = Math.max(0, totalOperatorsPerDay - targetWorkforce);
    const extraLaborHoursPerDay = excessLaborHeadcount * proc.workingHoursPerShift;
    const extraLaborHoursPerWeek = extraLaborHoursPerDay * proc.workingDaysPerWeek;

    // OEE metrics
    const availability = equipmentAvailability;
    const performance = dailyActualNetWorkingTime > 0 ? Math.min(1.0, parseFloat(((proc.producedQtyPerDay * theoreticalIdealCycle) / (dailyActualNetWorkingTime * 60)).toFixed(3))) : 0;
    const quality = qualityRatio;
    const oeeVal = availability * performance * quality;

    const setupLossQty = Math.round((proc.setupTimeMinutes * (proc.producedQtyPerDay / Math.max(1, dailyActualNetWorkingTime))));
    const wipDays = dailyDemand > 0 ? parseFloat((proc.interProcessInventory / dailyDemand).toFixed(2)) : 0;

    return {
      ...proc,
      netWorkingTimePerShift,
      dailyPlannedTimeMinutes,
      dailyNetWorkingTimeAvailable,
      totalWeeklyDowntimeMinutes,
      dailyDowntimeMinutes,
      dailyActualNetWorkingTime,
      equipmentAvailability,
      defectRate,
      qualityRatio,
      actualCycleTimeSeconds,
      plannedCycleTimeSeconds,
      plannedCapacityPerDay,
      plannedCapacityPerWeek,
      machineOccupancyRate,
      capacityUtilization,
      totalOperatorsPerDay,
      laborProductivityPerDay,
      laborProductivityPerWeek,
      targetWorkforce,
      targetWorkforceTakt,
      excessLaborHeadcount,
      extraLaborHoursPerDay,
      extraLaborHoursPerWeek,
      availability,
      performance,
      quality,
      oee: oeeVal * 100,
      setupLossQty,
      wipDays
    };
  });
}

// Financial Cost Allocations & Loss Conversion Module
export function calculateFinancialImpact(
  calculated: CalculatedProcess[],
  revenue: number,
  lossCosts: ProcessLossCosts // measured losses priced with the resolved rates (lossCosting.ts)
) {
  // Scrap, rework, breakdown, setup, excess labor and WIP holding are priced per station from the
  // unit cost entered on the Loss screen → VSM project unit cost → customer card (QLA formulas).
  // Overtime, late delivery, energy, maintenance and waiting have no measured basis here: they are 0
  // unless the customer's real annual figure is entered ("Gerçek Mali Veriler"). Earlier versions
  // filled them from fixed assumptions (½ labor-day per strained station, 0,01–0,05 % of revenue,
  // 12 kW per station for all running time, 12,5 TL/min × 40, 12 % of the total).
  const line = (year: number) => ({ day: year / 260, week: year / 52, month: year * 22 / 260, year });
  const zero = line(0);
  const scrap = line(lossCosts.scrap.year);
  const rework = line(lossCosts.rework.year);
  const downtime = line(lossCosts.downtime.year);
  const setup = line(lossCosts.setup.year);
  const laborLoss = line(lossCosts.laborLoss.year);
  const inventory = line(lossCosts.inventory.year);
  const totalYear = scrap.year + rework.year + downtime.year + setup.year + laborLoss.year + inventory.year;
  return {
    scrap, rework, downtime, setup, laborLoss, inventory,
    waiting: zero,
    lateDelivery: zero,
    overtime: zero,
    energy: zero,
    maintenance: zero,
    totalOperationalLosses: line(totalYear)
  };
}

// Quality costs the screen cannot measure — the customer's own annual figures (0 = not entered).
export const COPQ_ENTERED_CATEGORIES = [
  { key: "sorting", label: "Ayıklama / sınıflama" },
  { key: "customerReturns", label: "Müşteri iadeleri" },
  { key: "warranty", label: "Garanti giderleri" },
  { key: "extraFreight", label: "Ek / acil nakliye" },
  { key: "expediting", label: "Acil sevkiyat / hızlandırma" },
  { key: "customerComplaints", label: "Müşteri şikâyeti işleme" },
  { key: "lostSales", label: "Kayıp satış (katkı payı)" },
  { key: "inspection", label: "Muayene / kontrol" },
  { key: "qualityPersonnel", label: "Kalite personeli" }
] as const;
export type CopqEnteredKey = typeof COPQ_ENTERED_CATEGORIES[number]["key"];

// Cost of poor quality: internal failure from the measured scrap + rework, capacity / inventory /
// delivery / overtime from the loss lines, external failure and appraisal only from entered figures.
// (Earlier: sorting 18 %, returns 22 %, warranty 15 %, freight 8 % of internal failure; complaints
// 0,3 %, inspection 0,4 %, quality staff 0,6 %, lost sales 0,5–3 % of revenue; setup × 0,6.)
export function calculateCOPQ(calculated: CalculatedProcess[], revenue: number, financialImpact: any, entered: Partial<Record<CopqEnteredKey, number>> = {}) {
  const e = (k: CopqEnteredKey) => (typeof entered[k] === "number" && (entered[k] as number) > 0 ? (entered[k] as number) : 0);
  const scrapCostYear = financialImpact.scrap.year;
  const reworkCostYear = financialImpact.rework.year;
  const internalFailure = scrapCostYear + reworkCostYear;
  const sortingCost = e("sorting");
  const customerReturns = e("customerReturns");
  const warrantyCost = e("warranty");
  const expeditingCost = e("expediting");
  const extraFreight = e("extraFreight");
  const customerComplaints = e("customerComplaints");
  const lostCapacityCost = financialImpact.downtime.year + financialImpact.setup.year;
  const lostSalesCost = e("lostSales");
  const excessInventoryCost = financialImpact.inventory.year;
  const lateDeliveryCost = financialImpact.lateDelivery.year;
  const emergencyOvertimeCost = financialImpact.overtime.year;
  const inspectionCost = e("inspection");
  const qualityPersonnelCost = e("qualityPersonnel");

  const totalCOPQ_TL =
    internalFailure + sortingCost + customerReturns + warrantyCost + expeditingCost +
    extraFreight + customerComplaints + lostCapacityCost + lostSalesCost +
    excessInventoryCost + lateDeliveryCost + emergencyOvertimeCost +
    inspectionCost + qualityPersonnelCost;

  const copqPercentOfRevenue = revenue > 0 ? (totalCOPQ_TL / revenue) * 100 : 0;

  let benchmarkStatus: "Dünya klası (<%2)" | "İyi (%2–4)" | "Tipik fabrika (%4–8)" | "Yüksek (%8–10)" | "Kritik (>%10)" = "Tipik fabrika (%4–8)";
  if (copqPercentOfRevenue < 2) benchmarkStatus = "Dünya klası (<%2)";
  else if (copqPercentOfRevenue < 4) benchmarkStatus = "İyi (%2–4)";
  else if (copqPercentOfRevenue <= 8) benchmarkStatus = "Tipik fabrika (%4–8)";
  else if (copqPercentOfRevenue <= 10) benchmarkStatus = "Yüksek (%8–10)";
  else benchmarkStatus = "Kritik (>%10)";

  return {
    internalFailure,
    scrapCost: scrapCostYear,
    reworkCost: reworkCostYear,
    sortingCost,
    customerReturns,
    warrantyCost,
    expeditingCost,
    extraFreight,
    customerComplaints,
    lostCapacityCost,
    lostSalesCost,
    excessInventoryCost,
    lateDeliveryCost,
    emergencyOvertimeCost,
    inspectionCost,
    qualityPersonnelCost,
    totalCOPQ_TL,
    copqPercentOfRevenue,
    benchmarkStatus
  };
}

// Hidden Factory: the measured operational losses plus the appraisal effort spent catching them
// (inspection, sorting — entered). Equivalents only where their basis is known:
//   operators = hidden cost / labor cost per person-year (0 when the labor rate is not resolved)
//   machine capacity % = OEE loss time / loading time of the stations that have an OEE (JIPM tab)
// (Earlier: 58 % of all losses, 2.200 TL × 260 per operator, 45 % of the OEE gap, revenue = cost × 1,5.)
export function calculateHiddenFactory(
  calculated: CalculatedProcess[],
  revenue: number,
  copq: any,
  financialImpact: any,
  laborCostPerPersonYear: number = 0,
  oeeLossSharePct: number | null = null
) {
  const hiddenCostYear = financialImpact.totalOperationalLosses.year + copq.inspectionCost + copq.sortingCost;
  const hiddenPercentOfRevenue = revenue > 0 ? (hiddenCostYear / revenue) * 100 : 0;
  const equivalentOperators = laborCostPerPersonYear > 0 ? parseFloat((hiddenCostYear / laborCostPerPersonYear).toFixed(1)) : 0;
  const equivalentMachineCapacityPercent = oeeLossSharePct !== null ? parseFloat(oeeLossSharePct.toFixed(1)) : 0;
  return {
    hiddenCostYear,
    hiddenPercentOfRevenue,
    equivalentOperators,
    equivalentMachineCapacityPercent
  };
}

