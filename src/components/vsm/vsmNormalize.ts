// Reads a stored VSM project into the current data model (V2) without writing anything back: older
// projects simply get the new fields derived from what they already had. Pure function.
import type { VsmFactorySetup, VsmProcess, VsmProductMatrix, VsmProject, VsmTeamMember } from "./vsmTypes";

export function emptyFactorySetup(): VsmFactorySetup {
  return {
    workingDays: 5,
    shiftStructure: "",
    shiftDuration: 8,
    breakTimes: 0,
    plannedMaintenance: 0,
    weeklyDemand: 0,
    productFamily: "",
    customerName: "",
    shippingFrequency: "",
    productVolumeShare: 0,
    scrapUnitCost: 0,
    holdingCostPerWipYearly: 0,
    downtimeHourlyCost: 0,
    supplierName: "",
    supplierMaterial: "",
    supplierDelivery: "",
    supplierBatch: "",
    supplierLeadTime: "",
    supplierLogistics: "",
    planningSystem: "",
    planningFrequency: "",
    planningSequencing: "",
    planningCalendar: "",
    scheduleMode: "each"
  };
}

export function normalizeVsmProcess(p: VsmProcess): VsmProcess {
  const out: VsmProcess = { ...p };
  // Two changeover fields existed; changeoverTime is the one every calculation reads.
  if (out.changeoverTime === undefined && out.changeoverMinutes !== undefined) out.changeoverTime = out.changeoverMinutes;
  delete out.changeoverMinutes;
  // The supermarket flag becomes the stock-point type (the flag is kept in step for the map icon).
  if (!out.inventoryType) out.inventoryType = out.isSupermarket ? "supermarket" : "pile";
  out.isSupermarket = out.inventoryType === "supermarket";
  return out;
}

export interface NormalizedVsmProject {
  setup: VsmFactorySetup;
  processes: VsmProcess[];
  team: VsmTeamMember[];
  productMatrix: VsmProductMatrix;
}

export function normalizeVsmProject(project: VsmProject, defaults: Partial<VsmFactorySetup> = {}): NormalizedVsmProject {
  const processes = (Array.isArray(project.vsmProcesses) ? project.vsmProcesses : []).map(normalizeVsmProcess);
  const setup: VsmFactorySetup = { ...emptyFactorySetup(), ...defaults, ...(project.factorySetup || {}) } as VsmFactorySetup;
  // Net available time used the first process's shift count before the project-level field existed.
  if (setup.shiftsPerDay === undefined && processes[0]?.shifts) setup.shiftsPerDay = processes[0].shifts;
  if (setup.scheduleMode !== "pacemaker") setup.scheduleMode = "each";
  if (setup.pacemakerProcessId && !processes.some(p => p.id === setup.pacemakerProcessId)) setup.pacemakerProcessId = undefined;
  const pm = project.productMatrix;
  return {
    setup,
    processes,
    team: Array.isArray(project.team) ? project.team : [],
    productMatrix: {
      steps: Array.isArray(pm?.steps) ? pm!.steps : [],
      products: Array.isArray(pm?.products) ? pm!.products : [],
      similarityPct: pm?.similarityPct ?? 80,
      familyProductIds: Array.isArray(pm?.familyProductIds) ? pm!.familyProductIds : []
    }
  };
}
