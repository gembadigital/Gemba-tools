// VSM ↔ Excel field mapping (plan step V8). The same column list drives the field data form (download,
// fill on the floor, upload) and the process sheet of the full workbook export. Pure functions — the
// ExcelJS workbook itself is built in vsmExport.ts.
import type { VsmFactorySetup, VsmInventoryType, VsmProcess } from "./vsmTypes";

export interface VsmColumn {
  key: keyof VsmProcess;
  header: string;
  kind: "text" | "number" | "type" | "stock";
  width?: number;
}

const TYPE_LABELS: Record<VsmProcess["type"], string> = { Manual: "Manuel", "Semi Automatic": "Yarı otomatik", Automatic: "Otomatik" };
const STOCK_LABELS: Record<VsmInventoryType, string> = { pile: "Yığın", fifo: "FIFO", supermarket: "Süpermarket" };

// Column order of the field form. "id" stays in the sheet so re-imports update the right process.
export const VSM_PROCESS_COLUMNS: VsmColumn[] = [
  { key: "id", header: "ID (değiştirmeyin)", kind: "text", width: 18 },
  { key: "name", header: "Proses adı", kind: "text", width: 24 },
  { key: "type", header: "Tip (Manuel/Yarı otomatik/Otomatik)", kind: "type", width: 16 },
  { key: "machineCount", header: "Makine", kind: "number" },
  { key: "operatorCount", header: "Operatör", kind: "number" },
  { key: "shifts", header: "Vardiya sayısı", kind: "number" },
  { key: "cycleTime", header: "C/T (sn)", kind: "number" },
  { key: "idealCycleTime", header: "İdeal C/T (sn)", kind: "number" },
  { key: "plannedQuantity", header: "Planlanan adet/gün", kind: "number" },
  { key: "actualQuantity", header: "Gerçekleşen adet/gün", kind: "number" },
  { key: "changeoverTime", header: "C/O (dk/gün)", kind: "number" },
  { key: "breakdownTime", header: "Arıza (dk/gün)", kind: "number" },
  { key: "firstPieceApproval", header: "İlk parça onayı (dk)", kind: "number" },
  { key: "goodParts", header: "Sağlam adet", kind: "number" },
  { key: "scrap", header: "Hurda adet", kind: "number" },
  { key: "rework", header: "Rework adet", kind: "number" },
  { key: "inventoryBefore", header: "Proses önü WIP (adet)", kind: "number" },
  { key: "inventoryType", header: "Stok tipi (Yığın/FIFO/Süpermarket)", kind: "stock", width: 16 },
  { key: "fifoMax", header: "FIFO maks.", kind: "number" },
  { key: "batchSize", header: "Parti (adet)", kind: "number" },
  { key: "epei", header: "EPEI", kind: "text" },
  { key: "variantCount", header: "Çeşit sayısı", kind: "number" },
  { key: "valueAddedTime", header: "Katma değer (sn)", kind: "number" },
  { key: "transportTime", header: "Taşıma (dk)", kind: "number" },
  { key: "notes", header: "Notlar", kind: "text", width: 30 }
];

export type CellValue = string | number | null | undefined;

export function processToRow(p: VsmProcess): CellValue[] {
  return VSM_PROCESS_COLUMNS.map(c => {
    const v = p[c.key] as any;
    if (v === undefined || v === null || v === "") return null;
    if (c.kind === "type") return TYPE_LABELS[v as VsmProcess["type"]] ?? String(v);
    if (c.kind === "stock") return STOCK_LABELS[v as VsmInventoryType] ?? String(v);
    return v;
  });
}

// Turkish lower-casing turns "FIFO" into "fıfo", so dotless ı is folded to i before comparing.
const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
const parseType = (raw: string): VsmProcess["type"] | undefined => {
  const s = norm(raw);
  if (!s) return undefined;
  if (s.startsWith("yari") || s.startsWith("semi")) return "Semi Automatic";
  if (s.startsWith("oto") || s.startsWith("auto")) return "Automatic";
  if (s.startsWith("man")) return "Manual";
  return undefined;
};
const parseStock = (raw: string): VsmInventoryType | undefined => {
  const s = norm(raw);
  if (!s) return undefined;
  if (s.startsWith("fifo")) return "fifo";
  if (s.startsWith("süper") || s.startsWith("super")) return "supermarket";
  if (s.startsWith("yiğ") || s.startsWith("yig") || s.startsWith("pile") || s.startsWith("push")) return "pile";
  return undefined;
};
const parseNumber = (raw: CellValue): number | undefined => {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

export interface VsmImportIssue {
  row: number;      // 1-based sheet row
  message: string;
}

// One sheet row → the fields it sets. An empty cell means "not entered" and leaves the field alone on
// update; an unreadable value is reported, not guessed.
export function rowToPatch(cells: CellValue[], rowNo: number, issues: VsmImportIssue[]): Partial<VsmProcess> {
  const patch: Partial<VsmProcess> = {};
  VSM_PROCESS_COLUMNS.forEach((c, i) => {
    const raw = cells[i];
    if (raw === null || raw === undefined || String(raw).trim() === "") return;
    if (c.kind === "number") {
      const n = parseNumber(raw);
      if (n === undefined) issues.push({ row: rowNo, message: `"${c.header}" sayı değil: ${raw}` });
      else (patch as any)[c.key] = n;
    } else if (c.kind === "type") {
      const t = parseType(String(raw));
      if (!t) issues.push({ row: rowNo, message: `Tip anlaşılamadı: ${raw}` }); else patch.type = t;
    } else if (c.kind === "stock") {
      const t = parseStock(String(raw));
      if (!t) issues.push({ row: rowNo, message: `Stok tipi anlaşılamadı: ${raw}` }); else patch.inventoryType = t;
    } else {
      (patch as any)[c.key] = String(raw).trim();
    }
  });
  return patch;
}

export interface VsmImportResult {
  processes: VsmProcess[];
  updated: number;
  added: number;
  issues: VsmImportIssue[];
}

// Applies imported rows to the project's processes: a row whose ID (or, without ID, name) matches an
// existing process updates it; any other named row becomes a new process at the end. Processes missing
// from the sheet are kept — an import never deletes.
export function mergeImportedRows(existing: VsmProcess[], rows: { rowNo: number; cells: CellValue[] }[], userId?: string): VsmImportResult {
  const issues: VsmImportIssue[] = [];
  const list = existing.map(p => ({ ...p }));
  let updated = 0, added = 0;
  rows.forEach(({ rowNo, cells }) => {
    const patch = rowToPatch(cells, rowNo, issues);
    const id = patch.id;
    delete patch.id;
    if (Object.keys(patch).length === 0) return;
    let target = id ? list.find(p => p.id === id) : undefined;
    if (!target && patch.name) target = list.find(p => norm(p.name) === norm(patch.name!));
    if (target) {
      Object.assign(target, patch);
      if (patch.inventoryType) target.isSupermarket = patch.inventoryType === "supermarket";
      if (patch.shifts !== undefined) {
        const hours = target.shiftHours || [];
        target.shiftHours = Array.from({ length: patch.shifts }, (_, i) => hours[i] ?? 8);
        target.workingHours = target.shiftHours.reduce((s, h) => s + h, 0);
      }
      updated++;
      return;
    }
    if (!patch.name) {
      issues.push({ row: rowNo, message: "Proses adı yok, satır atlandı." });
      return;
    }
    const shifts = patch.shifts ?? 1;
    list.push({
      id: `proc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: patch.name,
      type: "Manual",
      productionModel: "Other",
      machineCount: 0,
      operatorCount: 0,
      shifts,
      shiftHours: Array.from({ length: shifts }, () => 8),
      workingHours: shifts * 8,
      cycleTime: 0,
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 0,
      capacity: 0,
      downtimeMinutes: 0,
      inventoryBefore: 0,
      isKanbanEnabled: false,
      isSupermarket: patch.inventoryType === "supermarket",
      notes: "",
      kaizenOpp: "",
      createdBy: userId,
      ...patch
    } as VsmProcess);
    added++;
  });
  return { processes: list, updated, added, issues };
}

// Project-level values on the "Kurulum" sheet of the field form (label → setup key).
export const VSM_SETUP_FIELDS: { key: keyof VsmFactorySetup; label: string; kind: "text" | "number" }[] = [
  { key: "weeklyDemand", label: "Haftalık talep (adet)", kind: "number" },
  { key: "workingDays", label: "Haftalık çalışma günü", kind: "number" },
  { key: "shiftsPerDay", label: "Günlük vardiya sayısı", kind: "number" },
  { key: "shiftDuration", label: "Vardiya süresi (saat)", kind: "number" },
  { key: "breakTimes", label: "Mola (dk/vardiya)", kind: "number" },
  { key: "plannedMaintenance", label: "Planlı bakım (dk/vardiya)", kind: "number" },
  { key: "packSize", label: "Paket miktarı (adet)", kind: "number" },
  { key: "rawMaterialQty", label: "Hammadde stoku (adet)", kind: "number" },
  { key: "finishedGoodsQty", label: "Mamul stoku (adet)", kind: "number" },
  { key: "shippingFrequency", label: "Müşteriye sevk sıklığı", kind: "text" },
  { key: "supplierName", label: "Tedarikçi", kind: "text" },
  { key: "supplierDelivery", label: "Tedarikçi sevk sıklığı", kind: "text" },
  { key: "planningSystem", label: "Planlama sistemi", kind: "text" },
  { key: "observationDate", label: "Gözlem tarihi (YYYY-AA-GG)", kind: "text" }
];

export function setupPatchFromRows(rows: { label: string; value: CellValue }[], issues: VsmImportIssue[]): Partial<VsmFactorySetup> {
  const byLabel = new Map(VSM_SETUP_FIELDS.map(f => [norm(f.label), f]));
  const patch: Partial<VsmFactorySetup> = {};
  rows.forEach((r, i) => {
    const f = byLabel.get(norm(r.label || ""));
    if (!f || r.value === null || r.value === undefined || String(r.value).trim() === "") return;
    if (f.kind === "number") {
      const n = parseNumber(r.value);
      if (n === undefined) issues.push({ row: i + 2, message: `Kurulum: "${f.label}" sayı değil: ${r.value}` });
      else (patch as any)[f.key] = n;
    } else {
      (patch as any)[f.key] = String(r.value).trim();
    }
  });
  return patch;
}
