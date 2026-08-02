import { ProcessItem, CalculatedProcess, IndustryBenchmark, IndustryType } from "./types";

export const DEFAULT_PROCESS_PRESETS: ProcessItem[] = [
  {
    id: "proc-1",
    name: "Machining (Talaşlı İmalat)",
    isCollapsed: true,
    shiftsPerDay: 2,
    workingHoursPerShift: 8,
    breakTimeMinutes: 30,
    plannedMaintenanceMinutes: 15,
    workingDaysPerWeek: 5,
    plannedQtyPerDay: 1200,
    producedQtyPerDay: 1150,
    totalProdTimePerDayMinutes: 960,
    setupTimeMinutes: 40,
    setupFrequencyPerWeek: 3,
    machineAdjustmentMinutes: 15,
    breakdownMinutesPerShift: 20,
    defectiveParts: 15,
    reworkQty: 10,
    scrapQty: 5,
    operatorsPerShift: 3,
    interProcessInventory: 450,
    theoreticalCycleTime: 35
  },
  {
    id: "proc-2",
    name: "Press Shop / Metal Şekillendirme",
    isCollapsed: true,
    shiftsPerDay: 2,
    workingHoursPerShift: 8,
    breakTimeMinutes: 30,
    plannedMaintenanceMinutes: 15,
    workingDaysPerWeek: 5,
    plannedQtyPerDay: 1400,
    producedQtyPerDay: 1350,
    totalProdTimePerDayMinutes: 960,
    setupTimeMinutes: 60,
    setupFrequencyPerWeek: 4,
    machineAdjustmentMinutes: 20,
    breakdownMinutesPerShift: 25,
    defectiveParts: 28,
    reworkQty: 18,
    scrapQty: 10,
    operatorsPerShift: 2,
    interProcessInventory: 650,
    theoreticalCycleTime: 22
  },
  {
    id: "proc-3",
    name: "Coil Winding (Bobinaj)",
    isCollapsed: true,
    shiftsPerDay: 2,
    workingHoursPerShift: 8,
    breakTimeMinutes: 30,
    plannedMaintenanceMinutes: 15,
    workingDaysPerWeek: 5,
    plannedQtyPerDay: 1100,
    producedQtyPerDay: 1050,
    totalProdTimePerDayMinutes: 960,
    setupTimeMinutes: 30,
    setupFrequencyPerWeek: 2,
    machineAdjustmentMinutes: 10,
    breakdownMinutesPerShift: 15,
    defectiveParts: 12,
    reworkQty: 8,
    scrapQty: 4,
    operatorsPerShift: 4,
    interProcessInventory: 300,
    theoreticalCycleTime: 40
  },
  {
    id: "proc-4",
    name: "Varnishing (Vernikleme/Yüzey Kaplama)",
    isCollapsed: false,
    shiftsPerDay: 2,
    workingHoursPerShift: 8,
    breakTimeMinutes: 30,
    plannedMaintenanceMinutes: 15,
    workingDaysPerWeek: 5,
    plannedQtyPerDay: 1000,
    producedQtyPerDay: 940,
    totalProdTimePerDayMinutes: 960,
    setupTimeMinutes: 90,
    setupFrequencyPerWeek: 5,
    machineAdjustmentMinutes: 30,
    breakdownMinutesPerShift: 45,
    defectiveParts: 42,
    reworkQty: 25,
    scrapQty: 17,
    operatorsPerShift: 2,
    interProcessInventory: 850,
    theoreticalCycleTime: 55
  },
  {
    id: "proc-5",
    name: "Grinding & Lapping (Taşlama)",
    isCollapsed: true,
    shiftsPerDay: 2,
    workingHoursPerShift: 8,
    breakTimeMinutes: 30,
    plannedMaintenanceMinutes: 15,
    workingDaysPerWeek: 5,
    plannedQtyPerDay: 1150,
    producedQtyPerDay: 1120,
    totalProdTimePerDayMinutes: 960,
    setupTimeMinutes: 45,
    setupFrequencyPerWeek: 3,
    machineAdjustmentMinutes: 15,
    breakdownMinutesPerShift: 15,
    defectiveParts: 8,
    reworkQty: 5,
    scrapQty: 3,
    operatorsPerShift: 3,
    interProcessInventory: 200,
    theoreticalCycleTime: 30
  },
  {
    id: "proc-6",
    name: "Assembly & Packing (Montaj/Paket)",
    isCollapsed: true,
    shiftsPerDay: 2,
    workingHoursPerShift: 8,
    breakTimeMinutes: 30,
    plannedMaintenanceMinutes: 15,
    workingDaysPerWeek: 5,
    plannedQtyPerDay: 1000,
    producedQtyPerDay: 990,
    totalProdTimePerDayMinutes: 960,
    setupTimeMinutes: 15,
    setupFrequencyPerWeek: 2,
    machineAdjustmentMinutes: 5,
    breakdownMinutesPerShift: 10,
    defectiveParts: 5,
    reworkQty: 4,
    scrapQty: 1,
    operatorsPerShift: 4,
    interProcessInventory: 150,
    theoreticalCycleTime: 45
  }
];

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

    const theoreticalIdealCycle = proc.theoreticalCycleTime || 30;
    const plannedCapacityPerDay = Math.round((dailyNetWorkingTimeAvailable * 60) / theoreticalIdealCycle);
    const plannedCapacityPerWeek = plannedCapacityPerDay * proc.workingDaysPerWeek;
    
    const machineOccupancyRate = (proc.producedQtyPerDay * actualCycleTimeSeconds) / (dailyPlannedTimeMinutes * 60);
    const capacityUtilization = plannedCapacityPerDay > 0 ? (proc.producedQtyPerDay / plannedCapacityPerDay) : 0;

    // 4. Productivity & Labor
    const totalOperatorsPerDay = proc.operatorsPerShift * proc.shiftsPerDay;
    const laborProductivityPerDay = totalOperatorsPerDay > 0 ? (proc.producedQtyPerDay / totalOperatorsPerDay) : 0;
    const laborProductivityPerWeek = laborProductivityPerDay * proc.workingDaysPerWeek;

    const targetWorkforce = actualCycleTimeSeconds > 0 ? parseFloat(((proc.producedQtyPerDay * actualCycleTimeSeconds) / (dailyPlannedTimeMinutes * 60) * totalOperatorsPerDay).toFixed(1)) : 0;
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
  laborRateBase: number = 2200, // TL per day per operator
  rawMaterialCostFactor: number = 0.45,
  energyCostRate: number = 3.5, // TL per kWh / standard hourly rate
  dailyDemand: number = 1100 // representative daily production volume (units/day)
) {
  // 1. Scrap Cost
  const totalScrapQty = calculated.reduce((sum, p) => sum + p.scrapQty, 0);
  // Average per-unit item cost = (annual revenue / annual production volume) * material cost
  // share of price. Previously divided revenue by an unexplained flat "280000" constant, which
  // meant the per-unit cost estimate had no traceable basis and drifted arbitrarily with revenue.
  const annualProductionVolume = dailyDemand * 250;
  const itemEstCost = annualProductionVolume > 0 ? (revenue / annualProductionVolume) * rawMaterialCostFactor : 0;
  const dailyScrapCost = totalScrapQty * itemEstCost * 1.5;

  // 2. Rework Cost
  const totalReworkQty = calculated.reduce((sum, p) => sum + p.reworkQty, 0);
  const dailyReworkCost = totalReworkQty * (itemEstCost * 0.4); // 40% of item cost to rework + some extra labor

  // 3. Downtime Cost (Maintenance/Overhead capacity losses)
  const totalBreakdownMinutes = calculated.reduce((sum, p) => sum + (p.breakdownMinutesPerShift * p.shiftsPerDay), 0);
  const downtimeCostPerMinute = 12.5; // generic machine lost capacity rate in TL/min
  const dailyDowntimeCost = totalBreakdownMinutes * downtimeCostPerMinute;

  // 4. Setup Cost
  const totalSetupMinutes = calculated.reduce((sum, p) => sum + (p.setupTimeMinutes * p.setupFrequencyPerWeek / Math.max(1, p.workingDaysPerWeek)), 0);
  const dailySetupCost = totalSetupMinutes * 15.0; // setups limit throughput

  // 5. Waiting & Labor losses
  const totalExcessLabor = calculated.reduce((sum, p) => sum + p.excessLaborHeadcount, 0);
  const dailyExcessLaborCost = totalExcessLabor * laborRateBase;

  // 6. Excess Inventory Holding Cost
  const totalWIP = calculated.reduce((sum, p) => sum + p.interProcessInventory, 0);
  const dailyInventoryCost = totalWIP * (itemEstCost * 0.15) / 365; // standard annual holding rate

  // 7. Late Delivery & Overtime Cost — scaled by how many processes are actually strained
  // (over-capacity / critically low OEE) and by the configured labor rate / revenue, instead of
  // a flat TL amount that was identical whether one line or the whole plant was at risk.
  const overCapacityProcessCount = calculated.filter(p => p.capacityUtilization > 0.95).length;
  const totalOvertimeLoss = overCapacityProcessCount * laborRateBase * 0.5;
  const criticalOeeProcessCount = calculated.filter(p => p.oee < 60).length;
  const deliveryFines = revenue * (criticalOeeProcessCount > 0 ? 0.0005 * criticalOeeProcessCount : 0.0001);

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
    maintenance: { day: downtimeCostPerMinute * 40, week: downtimeCostPerMinute * 40 * 5, month: downtimeCostPerMinute * 40 * 22, year: downtimeCostPerMinute * 40 * 260 },
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
  const customerComplaints = revenue * 0.003;
  const lostCapacityCost = financialImpact.downtime.year + financialImpact.setup.year * 0.6;
  const lostSalesCost = calculated.some(p => p.oee < 60) ? (revenue * 0.03) : (revenue * 0.005);
  const excessInventoryCost = financialImpact.inventory.year;
  const lateDeliveryCost = financialImpact.lateDelivery.year;
  const emergencyOvertimeCost = financialImpact.overtime.year;
  const inspectionCost = revenue * 0.004;
  const qualityPersonnelCost = revenue * 0.006;

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
  const hiddenPercentOfRevenue = (hiddenCostYear / revenue) * 100;
  
  // Translate to equivalent resource metrics
  const avgOperatorCostYear = 2200 * 260; // operator yearly base
  const equivalentOperators = parseFloat((hiddenCostYear / avgOperatorCostYear).toFixed(1));
  const equivalentMachineCapacityPercent = parseFloat(((calculated.reduce((s,p) => s + (100 - p.oee), 0) / calculated.length) * 0.45).toFixed(1));
  const equivalentRevenue = hiddenCostYear * 1.5; // multiplier for revenue potential if spent producing

  return {
    hiddenCostYear,
    hiddenPercentOfRevenue,
    equivalentOperators,
    equivalentMachineCapacityPercent,
    equivalentRevenue
  };
}

