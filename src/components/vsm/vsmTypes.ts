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
  changeoverMinutes?: number;   // legacy duplicate of changeoverTime — read once by normalizeVsmProject, never written

  // Standard VSM data box (V2)
  batchSize?: number;           // pieces per batch / lot
  epei?: string;                // "every part every interval", as observed (e.g. "2 gün", "1 hafta")
  variantCount?: number;        // number of product variants run on the process
  valueAddedTime?: number;      // seconds; the value-adding part of C/T — PCE uses C/T when not entered
  transportTime?: number;       // minutes of transport / handling to the next process (shown, not in lead time)
  inventoryType?: VsmInventoryType;  // stock point before this process
  fifoMax?: number;             // FIFO lane maximum (pieces), when inventoryType = "fifo"
  mergedFrom?: string[];        // future state: ids of the current-state processes combined into this one
  measuredFrom?: string;        // origin of values taken from another module ("Yamazumi: Hat A · Kaynak (C/T, 29.10.2026)")
}

export type VsmInventoryType = "pile" | "fifo" | "supermarket";

export const VSM_INVENTORY_TYPES: { value: VsmInventoryType; label: string }[] = [
  { value: "pile", label: "Serbest yığın (push)" },
  { value: "fifo", label: "FIFO şeridi" },
  { value: "supermarket", label: "Süpermarket (pull)" }
];

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

  // V2 — scope, demand, information flow and the two end stock points. Text fields are free text as
  // observed on the floor; numbers left 0 / undefined mean "not entered".
  scopeStart?: string;            // first point of the value stream (e.g. "Hammadde girişi")
  scopeEnd?: string;              // last point (e.g. "Sevkiyat")
  observationDate?: string;       // ISO date the current state was walked
  shiftsPerDay?: number;          // project-level shift count used for net available time / takt
  orderType?: string;             // MTS / MTO / ATO
  packSize?: number;              // pieces per customer pack → pitch = takt × pack size
  customerShipmentBatch?: string; // e.g. "1 kamyon / 480 adet"
  customerTransport?: string;     // e.g. "Kamyon"
  customerOrderFrequency?: string;   // customer → production control
  customerOrderChannel?: string;     // "Elektronik" | "Manuel"
  supplierOrderFrequency?: string;   // production control → supplier
  supplierOrderChannel?: string;
  scheduleMode?: "each" | "pacemaker";  // where production control sends the schedule
  pacemakerProcessId?: string;
  rawMaterialQty?: number;        // raw material stock after the supplier (pieces)
  rawMaterialType?: VsmInventoryType;
  finishedGoodsQty?: number;      // finished goods stock before shipping (pieces)
  finishedGoodsType?: VsmInventoryType;
}

export const VSM_ORDER_TYPES = ["MTS (stoğa üretim)", "MTO (siparişe üretim)", "ATO (siparişe montaj)"];
export const VSM_INFO_CHANNELS = ["Elektronik", "Manuel"];

export interface VsmTeamMember {
  name: string;
  role?: string;
  userId?: string;
}

// Product–process (PQ/PR) matrix used to choose the product family the map is drawn for.
export interface VsmMatrixStep {
  id: string;
  name: string;
}

export interface VsmMatrixProduct {
  id: string;
  name: string;
  code?: string;
  weeklyVolume?: number;
  stepIds: string[];          // routing: steps this product passes through
}

export interface VsmProductMatrix {
  steps: VsmMatrixStep[];
  products: VsmMatrixProduct[];
  similarityPct?: number;     // family grouping threshold (default 80)
  familyProductIds?: string[];  // the products the project's map is drawn for
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
  team?: VsmTeamMember[];
  productMatrix?: VsmProductMatrix;
  futureState?: VsmFutureState;
  kaizenBursts?: VsmKaizenBurst[];
  [key: string]: any;
}

// Future state map (plan step V5): its own copy of the processes, so steps can be merged, added or removed,
// plus the setup values that differ in the future (stocks, schedule point, pack size) and the answers to
// the future-state design questions.
export interface VsmFutureState {
  processes: VsmProcess[];
  setup?: Partial<VsmFactorySetup>;
  designAnswers?: Record<string, string>;
  createdAt?: string;
}

export const VSM_BURST_STATUSES = ["Açık", "Devam ediyor", "Tamamlandı"] as const;
export type VsmBurstStatus = typeof VSM_BURST_STATUSES[number];
export const VSM_LOOPS = ["Pacemaker döngüsü", "Ek döngü", "Tedarikçi döngüsü", "Müşteri döngüsü"];
export const VSM_BURST_METRICS = ["Çevrim süresi (C/T)", "Model değişim (C/O)", "Stok / WIP", "OEE / Uptime", "Hurda / Kalite", "Lead time", "Operatör", "Diğer"];

// Kaizen burst: an improvement needed to reach the future state, pinned to a process on one of the maps.
export interface VsmKaizenBurst {
  id: string;
  title: string;
  description?: string;
  map: "current" | "future";
  processId?: string;
  metric?: string;
  target?: string;          // e.g. "C/O 45 → 15 dk"
  owner?: string;
  startDate?: string;       // ISO date (implementation plan, V6)
  dueDate?: string;         // ISO date
  progress?: number;        // 0–100
  loop?: string;
  status?: VsmBurstStatus;
  createdBy?: string;       // stamped by the server; a Customer User deletes only their own
  ciProjectId?: string;     // set when a CI project was opened from it (V6)
}
