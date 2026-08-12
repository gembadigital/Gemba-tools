export interface AuditRecord {
  id: string;
  name: string;
  date: string;
  score: number;
  comments: string;
  evidenceFiles: string[];
}

export interface Customer {
  id: string;
  companyName: string;
  address: string;
  industry: string;
  productionType: string;
  annualRevenue: number;
  currency: string;
  employeeCount: number;
  mainContactPerson: string;
  mainContactEmail: string;
  factoryManager: string;
  factoryManagerEmail: string;
  generalManager: string;
  generalManagerEmail: string;
  copexScore: number;
  assessmentDate: string;
  preliminaryAssessmentReport: string;
  notes: string;
  audits: AuditRecord[];
  // Consultant/Customer User assignment (max 3 consultants: 1 primary + 2 secondary; max 2 customer user invites)
  primaryConsultantId?: string;
  consultantIds?: string[];
  customerUserIds?: string[];
}

export interface ProcessRecord {
  id: string;
  name: string;
  // Owning VSM project id, when this row was synced from VsmPage.tsx — see ProcessItem.vsmProjectId
  // (loss-analysis/types.ts) for how Loss Capacity Analizi uses this to scope by product group.
  vsmProjectId?: string;
  operatorCount: number;
  machineCount: number;
  cycleTime: number; // in seconds
  shiftCount: number;
  workingHours: number; // per shift (usually 8)
  capacity: number; // units/day calculated
  oee: number; // percentage, e.g. 75
  utilizationRate: number; // percentage
  overtimeRatio: number; // percentage
  excessLabor: number; // headcount
  scrapCost: number; // annual
  reworkCost: number; // annual
  downtimeCost: number; // annual
  laborCost: number; // annual
  indirectLaborCost: number; // annual
  waitingLoss: number; // annual cost
  transportationLoss: number; // annual cost
  motionLoss: number; // annual cost
  overproductionLoss: number; // annual cost
  quality?: number; // quality percentage
  changeoverMinutes?: number;
  inventoryBefore?: number;
}

export interface GanttActivity {
  id: string;
  name: string;
  owner: string;
  startDate: string; // YYYY-MM
  endDate: string; // YYYY-MM
  progressPercent: number;
  priority: "High" | "Medium" | "Low";
  status: "Planned" | "In Progress" | "Completed" | "Delayed";
  notes: string;
}

export interface FlowSegment {
  id: string;
  flowType: "Raw Material" | "WIP" | "Finished Goods";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  distanceMeters: number;
  description: string;
}

// One "Before-After Kaizen" one-pager, matching the real consulting-firm template ("Kaizen Öncesi
// Sonrası" form): subject/target, before & after photos, before/after descriptions, and a benefit
// breakdown across the same 4 categories the paper form uses (Cost, Productivity, Quality, Safety).
export interface BeforeAfterKaizenBenefits {
  costEnergy?: string;
  costLabor?: string;
  costMaterial?: string;
  productivityMachine?: string;
  productivityMan?: string;
  productivityMaterial?: string;
  qualityProduct?: string;
  qualityMaterial?: string;
  qualityScrap?: string;
  safetyRiskDegree?: string;
  safetyKso?: string;
}

export interface BeforeAfterKaizenStudy {
  id: string;
  date: string;
  subject: string;
  target: string;
  doneBy: string;
  department: string;
  category: "Verimlilik" | "Kalite" | "Güvenlik";
  area: "5S" | "Maliyet";
  beforeImage?: string;
  afterImage?: string;
  descriptionBefore: string;
  descriptionAfter: string;
  benefitDescription: string;
  benefits: BeforeAfterKaizenBenefits;
  createdAt: string;
}

export interface KaizenCard {
  id: string;
  title: string;
  originator: string;
  department: string;
  dateProposed: string;
  impactLevel: "High" | "Medium" | "Low";
  estimatedCost: number;
  actualSavings: number;
  status: "Draft" | "Approved" | "In Progress" | "Completed";
  descriptionBefore: string;
  descriptionAfter: string;
  description?: string;
  projectLeader?: string;
  projectTeam?: string[];
  projectSponsor?: string;
  plannedFinishDate?: string;
  realizedFinishDate?: string;
  phase?: any;
  opportunityId?: string;
  opportunityType?: string;
  currentLoss?: number;
  kanbanStatus?: "PLAN" | "DO" | "CHECK" | "ACT";
  tasks?: any[];
  financialsInput?: any;
  // Every "Before-After Kaizen" one-pager generated for this project (Section 9 of the CI card),
  // matching the real "Kaizen Öncesi Sonrası" form template — kept as a list since a project can
  // go through more than one such improvement cycle over its life.
  beforeAfterStudies?: BeforeAfterKaizenStudy[];
  problemDefinition?: string;
  problemDetail?: string;
  problemPhotos?: string[];
  targetObjective?: string;
  targetKpi?: string;
  targetRatio?: number;
  targetCostReduction?: number;
  rootCause?: string;
  // Structured 5-Why chain (index 0 = "Neden 1" ... 4 = "Neden 5"). `rootCause` above is kept in
  // sync as the last non-empty why, so anywhere that just displays rootCause (exports, list views)
  // keeps working without changes.
  rootCauseWhys?: string[];
  improvementActions?: string;
  responsibles?: string;
  actionsTaken?: string;
  emailSentCount?: number;
  lastEmailSentAt?: string;
  impactAnalysis?: Record<string, 'Yüksek' | 'Orta' | 'Düşük'>;
  progressStep?: string;
  expectedGain?: number;
  expectedGainCurrency?: string;
  realizedGain?: number;
  realizedGainCurrency?: string;
  realizedImprovementPct?: number;
  stdWorkUpdated?: boolean;
  instructionRevised?: boolean;
  trainingGiven?: boolean;
  controlPlanUpdated?: boolean;
  auditListUpdated?: boolean;
  projectResult?: "Başarılı" | "Revizyon Gerekli" | "Askıya Alındı" | "İptal";
  resultDescription?: string;
  resultPhotos?: string[];
  documents?: any[];
}

export interface AnnotationLine {
  id: string;
  type: "arrow" | "path" | "label" | "measure";
  points: { x: number; y: number }[];
  text?: string;
}

export interface FlowMeasurement {
  rawMaterialDistance: number;
  wipDistance: number;
  finishedGoodsDistance: number;
  operatorWalkingDistance: number;
  forkliftDistance: number;
  transportationFrequency: number;
  transportationCostPerStep: number;
}

export interface KaizenActivity {
  id: string;
  title: string;
  description: string;
  department: string;
  owner: string;
  status: "New" | "Approved" | "In Progress" | "Under Review" | "Completed";
  priority: "High" | "Medium" | "Low";
  expectedBenefit: number; // financial benefit
  actualBenefit: number;
  cost: number;
  implementationDate: string;
  beforePhoto?: string;
  afterPhoto?: string;
}

export interface FiveSCheck {
  id: string;
  department: string;
  auditDate: string;
  auditor: string;
  sortScore: number; // 1-5
  setOrderScore: number; // 1-5
  shineScore: number; // 1-5
  standardizeScore: number; // 1-5
  sustainScore: number; // 1-5
  notes: string;
  photo?: string;
}

export interface BalancingTask {
  id: string;
  name: string;
  cycleTime: number; // in seconds
  operatorsRequired: number;
}

export interface TimeStudyRecord {
  id: string;
  taskName: string;
  observedTimes: number[]; // in seconds, e.g. [12, 14, 11, 13, 12]
  frequencyPerCycle: number;
  operatorName: string;
  department: string;
}
