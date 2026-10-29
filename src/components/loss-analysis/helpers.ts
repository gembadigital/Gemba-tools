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
  lossCosts: ProcessLossCosts, // measured losses priced with the resolved rates (lossCosting.ts)
  laborRateBase: number = 0,   // labor cost per person-day; 0 = labor rate not resolved
  energyCostRate: number = 0   // per kWh; 0 = not entered
) {
  // 1–6. Scrap, rework, breakdown, setup, excess labor, WIP holding: priced per station from the
  // unit cost entered on the Loss screen → VSM project unit cost → customer card (QLA formulas).
  // Daily figures are the annual amount over 260 working days (same split as real-data overrides).
  const perDay = (year: number) => year / 260;
  const dailyScrapCost = perDay(lossCosts.scrap.year);
  const dailyReworkCost = perDay(lossCosts.rework.year);
  const dailyDowntimeCost = perDay(lossCosts.downtime.year);
  const dailySetupCost = perDay(lossCosts.setup.year);
  const dailyExcessLaborCost = perDay(lossCosts.laborLoss.year);
  const dailyInventoryCost = perDay(lossCosts.inventory.year);

  // 7. Late Delivery & Overtime Cost — scaled by how many processes are actually strained
  // (over-capacity / critically low OEE) and by the configured labor rate / revenue, instead of
  // a flat TL amount that was identical whether one line or the whole plant was at risk.
  const overCapacityProcessCount = calculated.filter(p => p.capacityUtilization > 0.95).length;
  const totalOvertimeLoss = overCapacityProcessCount * laborRateBase * 0.5;
  const criticalOeeProcessCount = calculated.filter(p => p.oee < 60).length;
  // The "no critically-low-OEE process" baseline (0.0001 * revenue) is a deliberate small-risk
  // assumption for a plant that HAS been analyzed and found healthy — it must not fire when zero
  // VSM processes have been entered at all, since that would fabricate a revenue-scaled cost
  // figure with no underlying analysis behind it (e.g. a brand-new customer with no VSM data
  // would otherwise show a nonzero "late delivery" cost out of thin air).
  const deliveryFines = calculated.length > 0
    ? revenue * (criticalOeeProcessCount > 0 ? 0.0005 * criticalOeeProcessCount : 0.0001)
    : 0;

  // 8. Energy Cost — driven by actual net production time and the user-configured energy
  // rate (energyCostRate), instead of a flat constant that ignored the "Enerji Birim Fiyatı"
  // input entirely. AVG_MACHINE_POWER_KW is a reasonable industrial-average machine power
  // draw assumption (this module has no per-process kW field to derive it from directly).
  const AVG_MACHINE_POWER_KW = 12;
  const totalDailyWorkingHours = calculated.reduce((sum, p) => sum + (p.dailyActualNetWorkingTime / 60), 0);
  const dailyEnergyCost = totalDailyWorkingHours * AVG_MACHINE_POWER_KW * energyCostRate;

  // Sum total operational losses
  const dailyTotal = dailyScrapCost + dailyReworkCost + dailyDowntimeCost + dailySetupCost + dailyExcessLaborCost + dailyInventoryCost + totalOvertimeLoss + deliveryFines + dailyEnergyCost;

  return {
    scrap: { day: dailyScrapCost, week: dailyScrapCost * 5, month: dailyScrapCost * 22, year: dailyScrapCost * 260 },
    rework: { day: dailyReworkCost, week: dailyReworkCost * 5, month: dailyReworkCost * 22, year: dailyReworkCost * 260 },
    downtime: { day: dailyDowntimeCost, week: dailyDowntimeCost * 5, month: dailyDowntimeCost * 22, year: dailyDowntimeCost * 260 },
    setup: { day: dailySetupCost, week: dailySetupCost * 5, month: dailySetupCost * 22, year: dailySetupCost * 260 },
    laborLoss: { day: dailyExcessLaborCost, week: dailyExcessLaborCost * 5, month: dailyExcessLaborCost * 22, year: dailyExcessLaborCost * 260 },
    inventory: { day: dailyInventoryCost, week: dailyInventoryCost * 5, month: dailyInventoryCost * 22, year: dailyInventoryCost * 260 },
    waiting: { day: dailyTotal * 0.12, week: dailyTotal * 0.12 * 5, month: dailyTotal * 0.12 * 22, year: dailyTotal * 0.12 * 260 },
    lateDelivery: { day: deliveryFines, week: deliveryFines * 5, month: deliveryFines * 22, year: deliveryFines * 260 },
    overtime: { day: totalOvertimeLoss, week: totalOvertimeLoss * 5, month: totalOvertimeLoss * 22, year: totalOvertimeLoss * 260 },
    energy: { day: dailyEnergyCost, week: dailyEnergyCost * 5, month: dailyEnergyCost * 22, year: dailyEnergyCost * 260 },
    // Not derived from measured data (was a fixed 12,5 TL/dk × 40 dk); filled only from real-data overrides.
    maintenance: { day: 0, week: 0, month: 0, year: 0 },
    totalOperationalLosses: {
      day: dailyTotal,
      week: dailyTotal * 5,
      month: dailyTotal * 22,
      year: dailyTotal * 260
    }
  };
}

// Target COPQ analysis module
export function calculateCOPQ(calculated: CalculatedProcess[], revenue: number, financialImpact: any) {
  const scrapCostYear = financialImpact.scrap.year;
  const reworkCostYear = financialImpact.rework.year;
  
  // Custom formulas for COPQ categories
  const sortedByScrap = [...calculated].sort((a,b) => b.scrapQty - a.scrapQty);
  
  const internalFailure = scrapCostYear + reworkCostYear;
  const sortingCost = internalFailure * 0.18;
  const customerReturns = internalFailure * 0.22;
  const warrantyCost = internalFailure * 0.15;
  const expeditingCost = financialImpact.lateDelivery.year + financialImpact.overtime.year * 0.5;
  const extraFreight = internalFailure * 0.08;
  // External-failure and appraisal/prevention cost categories scale with company size (revenue),
  // not with how much scrap happens to occur — a flat TL amount here meant a small workshop and a
  // large plant showed the identical "customer complaint handling cost", which isn't realistic.
  // All four gated by calculated.length > 0: these are revenue-scaled ASSUMPTIONS meant to size an
  // already-analyzed plant's quality overhead — without any real VSM/loss process data entered at
  // all, they must not fabricate a nonzero dollar figure purely from revenue (e.g. a customer with
  // zero VSM data previously still showed hundreds of thousands in "kalitesizlik maliyeti").
  const customerComplaints = calculated.length > 0 ? revenue * 0.003 : 0;
  const lostCapacityCost = financialImpact.downtime.year + financialImpact.setup.year * 0.6;
  const lostSalesCost = calculated.length === 0 ? 0 : (calculated.some(p => p.oee < 60) ? (revenue * 0.03) : (revenue * 0.005));
  const excessInventoryCost = financialImpact.inventory.year;
  const lateDeliveryCost = financialImpact.lateDelivery.year;
  const emergencyOvertimeCost = financialImpact.overtime.year;
  const inspectionCost = calculated.length > 0 ? revenue * 0.004 : 0;
  const qualityPersonnelCost = calculated.length > 0 ? revenue * 0.006 : 0;

  const totalCOPQ_TL = 
    internalFailure + sortingCost + customerReturns + warrantyCost + expeditingCost + 
    extraFreight + customerComplaints + lostCapacityCost + lostSalesCost + 
    excessInventoryCost + lateDeliveryCost + emergencyOvertimeCost + 
    inspectionCost + qualityPersonnelCost;

  const copqPercentOfRevenue = revenue > 0 ? (totalCOPQ_TL / revenue) * 100 : 0;

  let benchmarkStatus: "World Class (<2%)" | "Typical Factory (4%-8%)" | "Critical (>10%)" = "Typical Factory (4%-8%)";
  if (copqPercentOfRevenue < 2) {
    benchmarkStatus = "World Class (<2%)";
  } else if (copqPercentOfRevenue > 10) {
    benchmarkStatus = "Critical (>10%)";
  }

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

// Hidden Factory Analytics
export function calculateHiddenFactory(calculated: CalculatedProcess[], revenue: number, copq: any, financialImpact: any) {
  // Hidden factory encapsulates: scrap, rework, extra inspection, waiting time, extra labor, setup, logistics speed loss.
  const totalLossVal = financialImpact.totalOperationalLosses.year;
  const hiddenCostYear = totalLossVal * 0.58 + copq.inspectionCost + copq.sortingCost;
  const hiddenPercentOfRevenue = revenue > 0 ? (hiddenCostYear / revenue) * 100 : 0;

  // Translate to equivalent resource metrics
  const avgOperatorCostYear = 2200 * 260; // operator yearly base
  const equivalentOperators = parseFloat((hiddenCostYear / avgOperatorCostYear).toFixed(1));
  const equivalentMachineCapacityPercent = calculated.length > 0
    ? parseFloat(((calculated.reduce((s,p) => s + (100 - p.oee), 0) / calculated.length) * 0.45).toFixed(1))
    : 0;
  const equivalentRevenue = hiddenCostYear * 1.5; // multiplier for revenue potential if spent producing

  return {
    hiddenCostYear,
    hiddenPercentOfRevenue,
    equivalentOperators,
    equivalentMachineCapacityPercent,
    equivalentRevenue
  };
}

