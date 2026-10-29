export interface ProcessItem {
  id: string;
  name: string;
  // Owning VSM project id, when this row was synced from VsmPage.tsx — lets "product_group" cost
  // model scope filter down to just that project's real stations instead of the whole customer's
  // combined process list. Untagged for legacy/manually-entered rows.
  vsmProjectId?: string;
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
  // Input fields with no real value yet (neither entered on this screen nor synced from VSM). They
  // hold 0 for the formulas and render as "girilmedi" — never a made-up stand-in value.
  missingFields?: LossInputField[];
  // Where each entered value came from: "vsm" = measured in VSM (synced), "loss" = entered/corrected on
  // this screen. Only "loss" values are saved back (as `lossOverrides`).
  fieldSources?: Partial<Record<LossInputField, "vsm" | "loss">>;
  // Daily customer demand of the owning VSM project (weekly demand / working days), 0 when not entered.
  vsmDailyDemand?: number;
  // Machines at the station (VSM). Undefined when not known; stop time is then priced as one machine.
  machineCount?: number;
  // Unit costs entered in the owning VSM project's setup (0 / absent = not entered).
  vsmUnitCosts?: { scrapUnitCost?: number; downtimeHourlyCost?: number; holdingCostPerWipYearly?: number };
}

// Per-station inputs of the loss model (daily figures; minutes per shift / per setup as labelled).
export const LOSS_INPUT_FIELDS = [
  "shiftsPerDay",
  "workingHoursPerShift",
  "breakTimeMinutes",
  "plannedMaintenanceMinutes",
  "workingDaysPerWeek",
  "plannedQtyPerDay",
  "producedQtyPerDay",
  "setupTimeMinutes",
  "setupFrequencyPerWeek",
  "machineAdjustmentMinutes",
  "breakdownMinutesPerShift",
  "reworkQty",
  "scrapQty",
  "operatorsPerShift",
  "interProcessInventory",
  "theoreticalCycleTime"
] as const;

export type LossInputField = typeof LOSS_INPUT_FIELDS[number];

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
