export interface ProcessItem {
  id: string;
  name: string;
  isCollapsed: boolean;
  shiftsPerDay: number;
  workingHoursPerShift: number;
  breakTimeMinutes: number;
  plannedMaintenanceMinutes: number;
  workingDaysPerWeek: number;
  plannedQtyPerDay: number;
  producedQtyPerDay: number;
  totalProdTimePerDayMinutes: number;
  setupTimeMinutes: number;
  setupFrequencyPerWeek: number;
  machineAdjustmentMinutes: number;
  breakdownMinutesPerShift: number;
  defectiveParts: number;
  reworkQty: number;
  scrapQty: number;
  operatorsPerShift: number;
  interProcessInventory: number;
  theoreticalCycleTime: number; // in seconds
}

export interface CalculatedProcess extends ProcessItem {
  netWorkingTimePerShift: number;
  dailyPlannedTimeMinutes: number;
  dailyNetWorkingTimeAvailable: number;
  totalWeeklyDowntimeMinutes: number;
  dailyDowntimeMinutes: number;
  dailyActualNetWorkingTime: number;
  equipmentAvailability: number;
  defectRate: number;
  qualityRatio: number;
  actualCycleTimeSeconds: number;
  plannedCycleTimeSeconds: number;
  plannedCapacityPerDay: number;
  plannedCapacityPerWeek: number;
  machineOccupancyRate: number;
  capacityUtilization: number;
  totalOperatorsPerDay: number;
  laborProductivityPerDay: number;
  laborProductivityPerWeek: number;
  targetWorkforce: number;
  targetWorkforceTakt: number;
  excessLaborHeadcount: number;
  extraLaborHoursPerDay: number;
  extraLaborHoursPerWeek: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  setupLossQty: number;
  wipDays: number;
}

export type IndustryType = 
  | "Automotive" 
  | "White Goods" 
  | "Electric Motor" 
  | "Casting" 
  | "Machining" 
  | "Metal Forming" 
  | "Food" 
  | "Plastic Injection" 
  | "Textile" 
  | "Electronics"
  | "Other"
  | "Diğer";

export interface IndustryBenchmark {
  industry: IndustryType;
  oee: number;
  scrap: number; // %
  setup: number; // minutes average
  inventoryTurns: number; // times per year
  leadTime: number; // days
  laborProductivity: number; // parts/operator-hour
  copq: number; // % of revenue
  onTimeDelivery: number; // %
}

export interface YokotenItem {
  id: string;
  name: string;
  department: string;
  problem: string;
  rootCause: string;
  action: string;
  benefit: string;
  savings: number; // TL
  picturesBefore: string;
  picturesAfter: string;
  replicationPotential: string;
  otherDepartments: string[];
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export interface KaizenCard {
  id: string;
  title: string;
  department: string;
  currentValue: string;
  targetValue: string;
  method: string;
  investmentCost: number; // TL
  annualBenefit: number; // TL
  responsible: string;
  dueDate: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  isYokoten: boolean;
  why1?: string;
  why2?: string;
  why3?: string;
  why4?: string;
  why5?: string;
  rootCause?: string;
  // A3 Fields
  problemDefinition?: string;
  countermeasures?: string;
  actualSaving?: number;
}
