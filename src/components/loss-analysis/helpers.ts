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
    const defectRate = proc.producedQtyPerDay > 0 ? (proc.defectiveParts / proc.producedQtyPerDay) : 0;
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
  energyCostRate: number = 3.5 // TL per kWh / standard hourly rate
) {
  // 1. Scrap Cost
  const totalScrapQty = calculated.reduce((sum, p) => sum + p.scrapQty, 0);
  // Scrap item average value derived from proportional material revenue
  const itemEstCost = (revenue / 280000) * rawMaterialCostFactor; 
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

  // 7. Late Delivery & Overtime Cost
  const totalOvertimeLoss = calculated.some(p => p.capacityUtilization > 0.95) ? 4500 : 0;
  const deliveryFines = calculated.some(p => p.oee < 60) ? 6000 : 1200;

  // Sum total operational losses
  const dailyTotal = dailyScrapCost + dailyReworkCost + dailyDowntimeCost + dailySetupCost + dailyExcessLaborCost + dailyInventoryCost + totalOvertimeLoss + deliveryFines;

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
    energy: { day: 850, week: 850 * 5, month: 850 * 22, year: 850 * 260 },
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
  const customerComplaints = 180000;
  const lostCapacityCost = financialImpact.downtime.year + financialImpact.setup.year * 0.6;
  const lostSalesCost = calculated.some(p => p.oee < 60) ? (revenue * 0.03) : (revenue * 0.005);
  const excessInventoryCost = financialImpact.inventory.year;
  const lateDeliveryCost = financialImpact.lateDelivery.year;
  const emergencyOvertimeCost = financialImpact.overtime.year;
  const inspectionCost = 140000;
  const qualityPersonnelCost = 350000;

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
    benchmarkStatus,
    trend: [
      { month: "Q1 2026", value: copqPercentOfRevenue + 2.1 },
      { month: "Q2 2026", value: copqPercentOfRevenue + 1.2 },
      { month: "Q3 2026", value: copqPercentOfRevenue + 0.5 },
      { month: "Q4 2026", value: copqPercentOfRevenue }
    ]
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

// WCM Cost Deployment Matrix
export function calculateCostDeployment(calculated: CalculatedProcess[], financialImpact: any) {
  // Quality, Breakdowns, Setup, Speed Loss, Minor Stops, Labor Loss, Energy Loss, Inventory Loss, Logistics Loss
  const yr = financialImpact.totalOperationalLosses.year;

  const categories = [
    { name: "Quality Losses", ratio: 0.18, standardSavings: 0.75, difficulty: "MEDIUM", cost: financialImpact.scrap.year + financialImpact.rework.year },
    { name: "Breakdowns", ratio: 0.15, standardSavings: 0.65, difficulty: "MEDIUM", cost: financialImpact.downtime.year },
    { name: "Setup / Changeover", ratio: 0.20, standardSavings: 0.80, difficulty: "LOW", cost: financialImpact.setup.year },
    { name: "Speed Loss", ratio: 0.11, standardSavings: 0.50, difficulty: "HIGH", cost: yr * 0.11 },
    { name: "Minor Stops", ratio: 0.10, standardSavings: 0.55, difficulty: "LOW", cost: yr * 0.10 },
    { name: "Labor Loss (Line Balance)", ratio: 0.14, standardSavings: 0.70, difficulty: "MEDIUM", cost: financialImpact.laborLoss.year },
    { name: "Energy Loss", ratio: 0.04, standardSavings: 0.35, difficulty: "HIGH", cost: financialImpact.energy.year },
    { name: "Inventory Loss", ratio: 0.05, standardSavings: 0.60, difficulty: "LOW", cost: financialImpact.inventory.year },
    { name: "Logistics & Material Handling", ratio: 0.03, standardSavings: 0.40, difficulty: "MEDIUM", cost: yr * 0.03 }
  ];

  const totalCostCombined = categories.reduce((sum, c) => sum + c.cost, 0);

  return categories.map(c => {
    const lossPercent = totalCostCombined > 0 ? (c.cost / totalCostCombined) * 100 : 0;
    const recoveryPotential = c.cost * c.standardSavings;
    // Priority Index = Loss * PotentialMultiplier / DifficultyScore
    const diffScore = c.difficulty === "LOW" ? 1 : c.difficulty === "MEDIUM" ? 2 : 3;
    const priorityIndex = Math.round((lossPercent * c.standardSavings) / diffScore * 10);
    const roiMultiplier = c.difficulty === "LOW" ? 18 : c.difficulty === "MEDIUM" ? 12 : 5;

    return {
      category: c.name,
      lossPercent,
      lossTL: c.cost,
      priorityIndex,
      recoveryPotential,
      difficultyLevel: c.difficulty,
      roi: `${roiMultiplier}X`
    };
  }).sort((a,b) => b.priorityIndex - a.priorityIndex);
}

// Predictive Analytics Engine (30 days, 90 days, 12 months)
export function calculatePredictions(calculated: CalculatedProcess[], period: "30_DAYS" | "90_DAYS" | "12_MONTHS") {
  const avgOee = calculated.reduce((sum, p) => sum + p.oee, 0) / calculated.length;
  const totalWip = calculated.reduce((sum, p) => sum + p.interProcessInventory, 0);
  const totalLabor = calculated.reduce((sum, p) => sum + p.totalOperatorsPerDay, 0);

  // Based on baseline time factor, simulate trend improvements / decay
  const multiplier = period === "30_DAYS" ? 1 : period === "90_DAYS" ? 3 : 12;
  const factorOee = period === "30_DAYS" ? 1.02 : period === "90_DAYS" ? 1.05 : 1.12; 
  const factorWip = period === "30_DAYS" ? 0.95 : period === "90_DAYS" ? 0.88 : 0.75; 

  return {
    futureCapacity: Math.round(calculated[0]?.plannedQtyPerDay * multiplier * 22 * factorOee),
    futureOee: Math.min(94, avgOee * factorOee),
    futureDemand: Math.round(calculated[0]?.plannedQtyPerDay * multiplier * 22 * 1.05),
    futureBottlenecks: calculated.slice(0, 2).map(p => p.name),
    futureLaborNeed: Math.round(totalLabor * (1 / factorOee)),
    futureWip: Math.round(totalWip * factorWip),
    futureOvertime: period === "12_MONTHS" ? "Eskiye Göre %40 Azalma" : "Sıra Azalımı Aktif",
    futureCOPQ: `${Math.max(1.8, (calculated.reduce((s,p) => s + p.defectRate, 0) / calculated.length) * 100 * 0.75).toFixed(1)}%`
  };
}

// What-If Simulation Engine
export function simulateWhatIf(
  calculated: CalculatedProcess[],
  revenue: number,
  copqTotal: number,
  params: {
    setupReduction: number; // percentage (positive, e.g. 20 for -20%)
    scrapReduction: number; // percentage (positive, e.g. 15 for -15%)
    oeeIncrease: number; // addition percentage point (e.g. 5 for +5%)
    laborAdjustment: number; // integer (e.g. 1 or -1)
    machineAdjustment: number; // integer (e.g. 1)
  }
) {
  // Baseline rates
  const baseCapacity = calculated.reduce((sum, p) => sum + p.producedQtyPerDay, 0);
  
  // Setup reductions gives capacity & downtime savings
  const setupMinsSaved = calculated.reduce((sum, p) => sum + (p.setupTimeMinutes * (params.setupReduction / 100)), 0);
  
  // Scrap reduction directly saves COPQ
  const copqSavings = copqTotal * (params.scrapReduction / 100) * 0.65;
  
  // OEE increase translates directly into throughput & revenue boost
  const capacityPctIncrease = (params.oeeIncrease / (calculated.reduce((s,p) => s + p.oee, 0) / calculated.length)) * 100 
    + (params.setupReduction * 0.15) 
    + (params.machineAdjustment * 6.5);

  const additionalRevenue = revenue * (capacityPctIncrease / 100) * 0.75; 
  const leadTimeReductionPercent = (params.setupReduction * 0.45) + (params.oeeIncrease * 0.8);
  const wipReductionPercent = (params.setupReduction * 0.5) + (params.oeeIncrease * 0.4);
  const profitIncreaseVal = additionalRevenue * 0.28 + copqSavings; // marginal profit on added sales + direct copq recovery

  const investmentCost = (params.setupReduction * 1200) + (params.machineAdjustment * 150000) + (params.oeeIncrease * 8000);
  const simulatedROI = investmentCost > 0 ? (profitIncreaseVal / investmentCost) : 15.0;

  return {
    capacityIncrease: `+${capacityPctIncrease.toFixed(1)}%`,
    additionalRevenue: additionalRevenue,
    leadTimeReduction: `-${leadTimeReductionPercent.toFixed(1)}%`,
    wipReduction: `-${wipReductionPercent.toFixed(1)}%`,
    copqReduction: `-${params.scrapReduction.toFixed(0)}%`,
    profitIncrease: profitIncreaseVal,
    roi: `${simulatedROI.toFixed(1)}X`
  };
}
