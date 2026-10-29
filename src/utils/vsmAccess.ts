// VSM (Değer Akış Haritalama) — who may do what, and input normalization. Shared by client and server
// (server imports "../../utils/vsmAccess.js"); dependency-free so the VSM module can later be split out.
//
// Rule (user decision 2026-10-29): Admin / Consultant may do everything. A Customer User may create
// projects and enter data in any VSM project of their own customer, but may delete only what they
// entered themself — a project they created, a process they added. `createdBy` is stamped by the server.

export interface VsmUserLike {
  id?: string;
  role?: string;
  authType?: string;
}

export const isVsmStaff = (u: VsmUserLike | null | undefined) => u?.role === "Admin" || u?.role === "Consultant";

// Kaizen sicil-no / kiosk sessions (virtual users of the suggestion system) have no VSM access.
export const isVsmBlockedSession = (u: VsmUserLike | null | undefined) => u?.authType === "kaizen";

export function canDeleteVsmProject(u: VsmUserLike | null | undefined, project: any): boolean {
  if (!u) return false;
  if (isVsmStaff(u)) return true;
  return !!project && !!u.id && project.created_by === u.id;
}

export function canDeleteVsmProcess(u: VsmUserLike | null | undefined, process: any): boolean {
  if (!u) return false;
  if (isVsmStaff(u)) return true;
  return !!process && !!u.id && process.createdBy === u.id;
}

// Processes present in `before` but missing from `after` that this user may not delete.
export function forbiddenProcessRemovals(u: VsmUserLike | null | undefined, before: any[], after: any[]): string[] {
  const kept = new Set((after || []).map(p => p?.id));
  return (before || [])
    .filter(p => p?.id && !kept.has(p.id) && !canDeleteVsmProcess(u, p))
    .map(p => String(p.name || p.id));
}

export const VSM_MAX_PROCESSES = 60;
const MAX_TEXT = 2000;

// Fields the server owns; a client copy of them is ignored.
const SERVER_OWNED = ["organization_id", "factory_id", "created_by", "created_at", "updated_by", "updated_at"];

const cleanNumber = (v: any): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const PROCESS_NUMBER_FIELDS = [
  "machineCount", "operatorCount", "shifts", "workingHours", "cycleTime", "oee", "availability", "performance",
  "quality", "capacity", "downtimeMinutes", "inventoryBefore", "inventoryDays", "plannedQuantity", "actualQuantity",
  "idealCycleTime", "productionTime", "changeoverTime", "firstPieceApproval", "breakdownTime", "waitingTime",
  "minorStops", "goodParts", "scrap", "rework", "wipQuantity", "inventoryBetweenProcesses", "leadTimeContribution",
  "changeoverMinutes", "batchSize", "variantCount", "valueAddedTime", "transportTime", "fifoMax"
];
const INVENTORY_TYPES = ["pile", "fifo", "supermarket"];
export const VSM_MAX_PRODUCTS = 300;
export const VSM_MAX_TEAM = 40;

function cleanProcess(p: any): any {
  const out: any = { ...p };
  out.id = String(p?.id || "").slice(0, 80);
  out.name = String(p?.name ?? "").slice(0, 200);
  for (const k of PROCESS_NUMBER_FIELDS) {
    if (k in out) {
      const n = cleanNumber(out[k]);
      if (n === undefined) delete out[k]; else out[k] = n;
    }
  }
  if (Array.isArray(out.shiftHours)) out.shiftHours = out.shiftHours.slice(0, 4).map((h: any) => cleanNumber(h) ?? 0);
  for (const k of ["notes", "kaizenOpp"]) if (typeof out[k] === "string") out[k] = out[k].slice(0, MAX_TEXT);
  if (typeof out.epei === "string") out.epei = out.epei.slice(0, 60); else delete out.epei;
  if (out.inventoryType !== undefined && !INVENTORY_TYPES.includes(out.inventoryType)) delete out.inventoryType;
  return out;
}

export type VsmInputResult = { ok: true; project: any } | { ok: false; error: string };

// Normalizes a project save body. Returns an error instead of guessing when the body is unusable.
export function normalizeVsmProjectInput(body: any): VsmInputResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Geçersiz kayıt." };
  const project: any = { ...body };
  for (const k of SERVER_OWNED) delete project[k];
  project.name = String(project.name ?? "").trim().slice(0, 200);
  if (!project.name) return { ok: false, error: "Proje adı zorunludur." };
  for (const k of ["description"]) if (typeof project[k] === "string") project[k] = project[k].slice(0, MAX_TEXT);
  if (project.vsmProcesses !== undefined) {
    if (!Array.isArray(project.vsmProcesses)) return { ok: false, error: "Proses listesi geçersiz." };
    if (project.vsmProcesses.length > VSM_MAX_PROCESSES) return { ok: false, error: `En fazla ${VSM_MAX_PROCESSES} proses tanımlanabilir.` };
    project.vsmProcesses = project.vsmProcesses.map(cleanProcess);
    if (project.vsmProcesses.some((p: any) => !p.id)) return { ok: false, error: "Proses kimliği eksik." };
  }
  if (project.team !== undefined) {
    if (!Array.isArray(project.team)) return { ok: false, error: "Ekip listesi geçersiz." };
    project.team = project.team.slice(0, VSM_MAX_TEAM)
      .filter((m: any) => m && typeof m === "object")
      .map((m: any) => ({
        name: String(m.name ?? "").slice(0, 100),
        ...(m.role ? { role: String(m.role).slice(0, 100) } : {}),
        ...(m.userId ? { userId: String(m.userId).slice(0, 80) } : {})
      }));
  }
  if (project.productMatrix !== undefined) {
    const pm = project.productMatrix;
    if (!pm || typeof pm !== "object" || Array.isArray(pm)) return { ok: false, error: "Ürün matrisi geçersiz." };
    const steps = Array.isArray(pm.steps) ? pm.steps.slice(0, VSM_MAX_PROCESSES) : [];
    const products = Array.isArray(pm.products) ? pm.products : [];
    if (products.length > VSM_MAX_PRODUCTS) return { ok: false, error: `Ürün matrisinde en fazla ${VSM_MAX_PRODUCTS} ürün olabilir.` };
    const stepIds = new Set(steps.map((x: any) => String(x?.id ?? "")));
    project.productMatrix = {
      steps: steps.map((x: any) => ({ id: String(x?.id ?? "").slice(0, 80), name: String(x?.name ?? "").slice(0, 120) })).filter((x: any) => x.id),
      products: products.map((x: any) => ({
        id: String(x?.id ?? "").slice(0, 80),
        name: String(x?.name ?? "").slice(0, 160),
        ...(x?.code ? { code: String(x.code).slice(0, 60) } : {}),
        ...(cleanNumber(x?.weeklyVolume) !== undefined ? { weeklyVolume: cleanNumber(x.weeklyVolume) } : {}),
        stepIds: Array.isArray(x?.stepIds) ? x.stepIds.map(String).filter((id: string) => stepIds.has(id)) : []
      })).filter((x: any) => x.id),
      similarityPct: Math.min(100, Math.max(10, cleanNumber(pm.similarityPct) ?? 80)),
      familyProductIds: Array.isArray(pm.familyProductIds) ? pm.familyProductIds.map(String).slice(0, VSM_MAX_PRODUCTS) : []
    };
  }
  if (project.factorySetup && typeof project.factorySetup === "object") {
    const fs: any = { ...project.factorySetup };
    for (const [k, v] of Object.entries(fs)) {
      if (typeof v === "number") {
        const n = cleanNumber(v);
        if (n === undefined) delete fs[k]; else fs[k] = n;
      } else if (typeof v === "string") {
        fs[k] = v.slice(0, 200);
      }
    }
    project.factorySetup = fs;
  }
  return { ok: true, project };
}

// Stamps `createdBy` on processes that are new in this save (absent from the stored record) and keeps the
// stored owner of existing ones, so a client cannot claim someone else's process.
export function stampProcessOwners(before: any[], after: any[], userId: string): any[] {
  const prev = new Map((before || []).map(p => [p?.id, p]));
  return (after || []).map(p => {
    const old = prev.get(p.id);
    if (old) {
      const { createdBy: _ignored, ...rest } = p;
      return old.createdBy ? { ...rest, createdBy: old.createdBy } : rest;
    }
    return { ...p, createdBy: userId };
  });
}
