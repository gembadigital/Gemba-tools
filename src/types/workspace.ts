export interface FactoryInfo {
  name: string;
  plantCode: string;
  buildingName: string;
  factoryArea: number;
  closedArea: number;
  openArea: number;
  productionArea: number;
  warehouseArea: number;
  officeArea: number;
  floorsCount: number;
  productionLines: string[];
  departments: string[];
  mainProcesses: string[];
  layoutFiles: string[];
}

export interface OperationalInfo {
  annualProductionQuantity: number;
  productFamilies: string[];
  mainCustomers: string[];
  productionStrategy: "MTS" | "MTO" | "ETO"; // Make to Stock, Make to Order, Engineer to Order
  assemblyType: "Discrete" | "Continuous" | "Batch" | "Project" | "Cellular" | "FlowLine";
}

export interface ExecutiveContact {
  id: string;
  fullName: string;
  departmentTitle: string; // CEO, CFO, COO, Genel Müdür, GMY, Fabrika Müdürü, Diğer
  customTitle?: string;
  email: string;
}

export interface WorkforceInfo {
  totalEmployees: number;
  blueCollar: number;
  whiteCollar: number;
  engineers: number;
  officeStaff: number;
  operators: number;
  maintenanceStaff: number;
  qualityStaff: number;
  contractWorkers: number;
  temporaryWorkers: number;
  shiftsCount: number;
  shiftPattern: string; // e.g. "2x8", "3x8", "2x12"
  shiftWorkingHours?: number; // Vardiya çalışma saati (4, 5, 6, 7, 8, 9, 10, 11, 12)
  workingDays: number;
  dailyWorkingHours: number;
  overtimePolicy: string;
}

export interface OpexInfo {
  leanMaturity: number; // percentage
  oee: number; // percentage
  currentImprovementProgram: string;
  kaizenSystem: string;
  tpmLevel: string;
  fivesLevel: number; // 1-5 scale
  visualManagement: "Low" | "Medium" | "High";
  dailyManagement: "Low" | "Medium" | "High";
  opexScore: number; // 0-100
  currentBottlenecks: string[];
  strategicObjectives: string[];
}

export interface CompanyContacts {
  factoryManager: string;
  generalManager: string;
  productionManager: string;
  maintenanceManager: string;
  qualityManager: string;
  leanManager: string;
  hrManager: string;
  supplyChainManager: string;
  itManager: string;
  purchasingManager: string;
  financeManager: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  secondaryContactName: string;
  secondaryContactEmail: string;
  secondaryContactPhone: string;
  executiveContacts?: ExecutiveContact[];
}

export interface FactoryAsset {
  id: string;
  name: string;
  code: string;
  type: "Machine" | "ProductionLine" | "Department" | "Warehouse" | "Office" | "Utility";
  location: string;
  status: "Active" | "Maintenance" | "Idle" | "Planned";
  capacity: string;
  notes?: string;
}

export interface ProjectPortfolioItem {
  id: string;
  name: string;
  code: string;
  objective: string;
  startDate: string;
  endDate: string;
  status: "Planned" | "Active" | "Completed" | "Delayed";
  budget: number;
  currency: string;
  roiPercent: number;
  projectManager: string;
  // Links projectManager back to a real assigned consultant (see ProjectTeamTab's
  // primaryConsultantId/consultantIds system) when picked from that list rather than typed as
  // free text — undefined for legacy projects saved before this existed.
  projectManagerId?: string;
  sourceModule?: "CI" | "VSM" | "Manual"; // Nereden yansıdığı
}

export interface TimelineMilestone {
  id: string;
  date: string;
  title: string;
  type: "creation" | "audit" | "workshop" | "analysis" | "ai_report" | "closure" | "other";
  description: string;
  operator?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  folder: string; // "General" | "Contracts" | "Audits" | "Kaizen" | "5S" | "SMED" | "TimeStudy" | "Spaghetti" | "Layouts" | "VSM" | "AIReports"
  size: string;
  uploadDate: string;
  url?: string;
}

export interface KpiHistoryPoint {
  year: string;
  oee: number;
  transportationDistance: number; // meters/day
  fivesScore: number; // 1-100
  leadTimeDays: number;
}

export interface ProjectTeamMember {
  id: string;
  name: string;      // İsim Soyisim
  department: string; // Bölüm
  role: string;       // Görev
  email: string;      // E-posta
  category: "management" | "member"; // Yönetim Kadrosu vs Ekip Üyesi
  isProjectCoordinator?: boolean; // Proje Koordinatörü check box flag
}

export interface CompanyWorkspaceExtended {
  customerId: string;
  companyName?: string;
  industry?: string;
  productionType?: string;
  // Yıllık Ciro — kept in sync with the top-level Customer.annualRevenue (the only other place
  // this value lives), which already drives Loss Capacity Analizi and CI Proje Yönetimi
  // calculations. Added here so it's actually visible/editable somewhere after a customer's
  // initial creation — previously only set once in the "Yeni Müşteri Ekle" modal, never again.
  annualRevenue?: number;
  // Reference currency for annualRevenue and (by convention) every other cost figure elsewhere
  // in the app for this customer — kept in sync with Customer.currency, same reasoning as above.
  currency?: string;
  taxNumber?: string;
  taxOffice?: string;
  website?: string;
  country?: string;
  city?: string;
  shortName?: string;
  yearEstablished?: number;
  logoUrl?: string;
  gpsCoordinates?: string;
  factories: FactoryInfo[];
  operational: OperationalInfo;
  workforce: WorkforceInfo;
  opex: OpexInfo;
  contacts: CompanyContacts;
  assets: FactoryAsset[];
  projects: ProjectPortfolioItem[];
  timeline: TimelineMilestone[];
  documents: DocumentItem[];
  kpiHistory: KpiHistoryPoint[];
  aiSummaryCached?: string;
  projectTeam?: ProjectTeamMember[];
}
