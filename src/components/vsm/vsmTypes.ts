// VSM (Değer Akış Haritalama) — data model shared by the VSM screens and its calculation engine.
// Dependency-free so the module can later be split out (plan step V11).

// Connection types between processes in the flow graph. Only "Normal" is drawn/handled specially
// today — the union is intentionally wide open so future types can be added without a schema
// change (they'd just fall back to "Normal" styling until specific handling is written for them).
export type VsmConnectionType =
  | "Normal"
  | "Parallel"
  | "Merge"
  | "Split"
  | "Rework"
  | "Kanban"
  | "Supermarket"
  | "External Supplier";

export interface VsmProcess {
  id: string;
  name: string;
  type: "Manual" | "Semi Automatic" | "Automatic";
  productionModel: "Cell" | "Assembly Line" | "Batch" | "Other";
  machineCount: number;
  operatorCount: number;
  shifts: number;
  shiftHours?: number[];
  workingHours: number;
  cycleTime: number; // in seconds (CT)
  oee: number; // percentage
  availability: number; // percentage
  performance: number; // percentage
  quality: number; // percentage (FPY)
  capacity: number; // units/day
  downtimeMinutes: number;
  inventoryBefore: number; // WIP quantity before this process
  inventoryDays?: number; // calculated inventory days
  isKanbanEnabled: boolean;
  isSupermarket: boolean;
  notes: string;
  kaizenOpp: string;
  // User who added the process — stamped by the server; a Customer User may delete only their own.
  createdBy?: string;

  // Tab 2 Process Definition extra fields
  planningFrequency?: string;
  prevProcessId?: string;
  nextProcessId?: string;

  // Graph-based process relationships (multi-successor). When undefined/empty on every
  // process in the project, the flow is treated as a legacy linear chain and renders/derives
  // successors from array order exactly as before (full backward compatibility, no migration).
  nextProcessIds?: string[];
  // Connection type per outgoing edge, keyed by target process id. Only "Normal" is used by the
  // drawing engine today; the type is kept open-ended so future types (Kanban, Supermarket,
  // Rework, External Supplier, ...) can be added without touching the data model again.
  connectionTypes?: Record<string, VsmConnectionType>;

  // Tab 3 Production & Capacity data entry fields
  plannedQuantity?: number;
  actualQuantity?: number;
  idealCycleTime?: number;
  productionTime?: number; // in minutes
  changeoverTime?: number; // in minutes
  changeoverFrequency?: string;
  firstPieceApproval?: number; // in minutes
  breakdownTime?: number; // in minutes
  waitingTime?: number; // in minutes
  minorStops?: number; // in minutes

  // Tab 4 Quality & Inventory fields
  goodParts?: number;
  scrap?: number;
  rework?: number;
  wipQuantity?: number;
  inventoryBetweenProcesses?: number;
  leadTimeContribution?: number;
  changeoverMinutes?: number;
}

// Project-level parameters (Kurulum sekmesi). Text fields feed the map's customer / supplier /
// production-control boxes; numbers left 0 mean "not entered".
export interface VsmFactorySetup {
  workingDays: number;
  shiftStructure: string;
  shiftDuration: number;
  breakTimes: number;
  plannedMaintenance: number;
  weeklyDemand: number;
  productFamily: string;
  customerName: string;
  shippingFrequency: string;
  productVolumeShare: number;
  scrapUnitCost: number;
  holdingCostPerWipYearly: number;
  downtimeHourlyCost: number;
  supplierName: string;
  supplierMaterial: string;
  supplierDelivery: string;
  supplierBatch: string;
  supplierLeadTime: string;
  supplierLogistics: string;
  planningSystem: string;
  planningFrequency: string;
  planningSequencing: string;
  planningCalendar: string;
}

// Where a project's process figures come from (see dataSources/). Gemba Tools only uses "manual";
// "opxSuite" reads line / product / date-range data from the Opx Suite database once the module runs there.
export type VsmDataSourceKind = "manual" | "import" | "opxSuite";

export interface VsmDataSourceRef {
  kind: VsmDataSourceKind;
  lineId?: string;
  productId?: string;
  from?: string;      // ISO date
  to?: string;        // ISO date
  pulledAt?: string;  // when the snapshot was taken
}

export interface VsmProject {
  id: string;
  name: string;
  productGroup?: string;
  productCode?: string;
  productionLine?: string;
  department?: string;
  leader?: string;
  startDate?: string;
  targetDate?: string;
  status?: string;
  description?: string;
  factory_id?: string;
  created_by?: string;
  factorySetup?: Partial<VsmFactorySetup>;
  vsmProcesses?: VsmProcess[];
  simulationEdits?: Record<string, Partial<VsmProcess>>;
  simulationMode?: "current" | "future";
  dataSource?: VsmDataSourceRef;
  [key: string]: any;
}
