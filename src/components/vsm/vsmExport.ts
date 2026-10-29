// VSM Excel output (plan step V8): the full workbook (project, processes, future state, timeline,
// indicators, workforce, product matrix) and the field data form with its reader. ExcelJS is loaded on
// demand so it does not weigh on the VSM screens.
import { suppliersOf } from "./vsmTypes";
import type { VsmFactorySetup, VsmKaizenBurst, VsmProcess, VsmProductMatrix, VsmTeamMember } from "./vsmTypes";
import { VSM_DESIGN_QUESTIONS } from "./vsmFuture";
import type { VsmStateComparison, VsmTimelineProcess } from "./vsmCalc";
import type { VsmFamily } from "./vsmProductMatrix";
import { CellValue, VSM_PROCESS_COLUMNS, VSM_SETUP_FIELDS, processToRow } from "./vsmExcel";

const loadExcel = async () => (await import("exceljs")).default;

const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F172A" } };
const SECTION_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE2E8F0" } };
const BORDER = { style: "thin" as const, color: { argb: "FFCBD5E1" } };

function styleTable(ws: any, headerRow: number, colCount: number, lastRow: number) {
  const h = ws.getRow(headerRow);
  h.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  h.alignment = { vertical: "middle", wrapText: true };
  h.height = 30;
  for (let c = 1; c <= colCount; c++) h.getCell(c).fill = HEADER_FILL;
  for (let r = headerRow; r <= lastRow; r++) {
    for (let c = 1; c <= colCount; c++) {
      ws.getRow(r).getCell(c).border = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
    }
  }
  ws.views = [{ state: "frozen", ySplit: headerRow }];
}

function addTable(ws: any, startRow: number, headers: string[], rows: CellValue[][], widths?: number[]) {
  ws.getRow(startRow).values = headers;
  rows.forEach((r, i) => { ws.getRow(startRow + 1 + i).values = r; });
  styleTable(ws, startRow, headers.length, startRow + rows.length);
  headers.forEach((_, i) => { ws.getColumn(i + 1).width = widths?.[i] ?? Math.max(12, Math.min(28, headers[i].length + 2)); });
}

function addKeyValues(ws: any, title: string, pairs: [string, CellValue][]) {
  const start = ws.rowCount === 0 ? 1 : ws.rowCount + 2;
  const t = ws.getRow(start);
  t.values = [title];
  t.font = { bold: true, size: 11 };
  t.getCell(1).fill = SECTION_FILL;
  t.getCell(2).fill = SECTION_FILL;
  pairs.forEach(([k, v], i) => {
    const row = ws.getRow(start + 1 + i);
    row.values = [k, v ?? "—"];
    row.getCell(1).font = { color: { argb: "FF475569" } };
    row.getCell(2).font = { bold: true };
  });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFileName = (s: string) => (s || "VSM").replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80);

async function toBlob(wb: any) {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export interface VsmWorkbookInput {
  project: { name: string; productGroup?: string; productionLine?: string; leader?: string; status?: string; startDate?: string; targetDate?: string; description?: string };
  customerName: string;
  currency: string;
  setup: VsmFactorySetup;
  team: VsmTeamMember[];
  current: VsmTimelineProcess[];
  future: VsmTimelineProcess[];
  hasFuture: boolean;
  comparison: VsmStateComparison;
  figures: { dailyDemand: number; taktTime: number; pitchTime: number; netSecondsPerDay: number; leadTimeDays: number; rawDays: number; fgDays: number; pcePct: number; processingSeconds: number; totalWip: number; annualLoss: number };
  workforce: { perProcess: { name: string; mevcut: number; gerekli: number; fark: number }[]; totalMevcut: number; totalGerekli: number; surplus: number; method: string };
  matrix: VsmProductMatrix;
  families: VsmFamily[];
  pacemakerName?: string;
  bursts?: VsmKaizenBurst[];
  designAnswers?: Record<string, string>;
  processName?: (map: "current" | "future", id?: string) => string;
}

const yesNo = (b?: boolean) => (b ? "Evet" : "Hayır");
const stockLabel = (t?: string) => ({ pile: "Yığın", fifo: "FIFO", supermarket: "Süpermarket" } as Record<string, string>)[t || ""] || "—";

export async function buildVsmWorkbook(d: VsmWorkbookInput): Promise<Blob> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gemba Tools — VSM";
  wb.created = new Date();
  const s = d.setup;

  // 1. Proje
  const ws1 = wb.addWorksheet("Proje");
  ws1.getColumn(1).width = 36;
  ws1.getColumn(2).width = 48;
  addKeyValues(ws1, "Proje", [
    ["Müşteri", d.customerName], ["Proje", d.project.name], ["Ürün ailesi", s.productFamily], ["Hat / bölüm", d.project.productionLine],
    ["Proje lideri", d.project.leader], ["Durum", d.project.status], ["Başlangıç", d.project.startDate], ["Hedef bitiş", d.project.targetDate],
    ["Kapsam", [s.scopeStart, s.scopeEnd].filter(Boolean).join(" → ") || undefined], ["Gözlem tarihi", s.observationDate], ["Açıklama", d.project.description]
  ]);
  addKeyValues(ws1, "Ekip", d.team.length ? d.team.map(m => [m.name, m.role || ""] as [string, CellValue]) : [["—", ""]]);
  addKeyValues(ws1, "Talep & Takt", [
    ["Haftalık talep (adet)", s.weeklyDemand], ["Çalışma günü / hafta", s.workingDays], ["Günlük talep (adet)", d.figures.dailyDemand],
    ["Günlük vardiya", s.shiftsPerDay], ["Vardiya süresi (saat)", s.shiftDuration], ["Mola (dk/vardiya)", s.breakTimes], ["Planlı bakım (dk/vardiya)", s.plannedMaintenance],
    ["Net çalışma süresi (sn/gün)", d.figures.netSecondsPerDay], ["Takt (sn)", d.figures.taktTime || undefined],
    ["Paket miktarı", s.packSize], ["Pitch (sn)", d.figures.pitchTime || undefined], ["Sipariş tipi", s.orderType], ["Ürün hacim payı (%)", s.productVolumeShare]
  ]);
  addKeyValues(ws1, "Müşteri, Tedarikçi & Bilgi Akışı", [
    ["Müşteriye sevk sıklığı", s.shippingFrequency], ["Sevk partisi", s.customerShipmentBatch], ["Müşteriye taşıma", s.customerTransport],
    ["Müşteri → Planlama", [s.customerOrderFrequency, s.customerOrderChannel].filter(Boolean).join(" · ") || undefined],
    ["Planlama → Tedarikçi", [s.supplierOrderFrequency, s.supplierOrderChannel].filter(Boolean).join(" · ") || undefined],
    ["Çizelge", s.scheduleMode === "pacemaker" ? `Pacemaker: ${d.pacemakerName || "—"}` : "Her prosese"],
    ["Planlama sistemi", s.planningSystem], ["Planlama sıklığı", s.planningFrequency], ["Sıralama", s.planningSequencing], ["Üretim takvimi", s.planningCalendar],
    ...suppliersOf(s).map((x, i) => [`Tedarikçi ${i + 1}`, [x.name, x.material, x.delivery, x.batch && `parti ${x.batch}`, x.leadTime && `temin ${x.leadTime}`, x.logistics].filter(Boolean).join(" · ")] as [string, CellValue]),
    ["Hammadde stoku (adet)", s.rawMaterialQty], ["Hammadde stok tipi", stockLabel(s.rawMaterialType)], ["Mamul stoku (adet)", s.finishedGoodsQty], ["Mamul stok tipi", stockLabel(s.finishedGoodsType)]
  ]);

  // 2. Prosesler (mevcut durum) — entered fields + computed metrics
  const procHeaders = [
    "Sıra", "Proses", "Tip", "Makine", "Operatör", "Vardiya", "Çalışma (sa/gün)", "C/T (sn)", "İdeal C/T (sn)", "Katma değer (sn)",
    "C/O (dk)", "Arıza (dk)", "Gerçekleşen adet", "Sağlam", "Hurda", "Rework", "Kullanılabilirlik %", "Performans %", "Kalite %", "OEE %",
    "Kapasite (adet/gün)", "Proses önü WIP", "Stok günü", "Stok tipi", "FIFO maks.", "Kanban", "Parti", "EPEI", "Çeşit", "Taşıma (dk)", "Notlar"
  ];
  const procRow = (p: VsmTimelineProcess, i: number): CellValue[] => [
    i + 1, p.name, p.type, p.machineCount, p.operatorCount, p.shifts, p.workingHours, p.cycleTime, p.idealCycleTime, p.valueAddedTime,
    p.changeoverTime, p.downtimeMinutes, p.actualQuantity, p.goodParts, p.scrap, p.rework, p.availability, p.performance, p.quality, p.oee,
    p.capacity, p.inventoryBefore, p.inventoryDays, stockLabel(p.inventoryType), p.fifoMax, yesNo(p.isKanbanEnabled), p.batchSize, p.epei,
    p.variantCount, p.transportTime, p.notes
  ];
  addTable(wb.addWorksheet("Mevcut Durum"), 1, procHeaders, d.current.map(procRow));
  if (d.hasFuture) addTable(wb.addWorksheet("Gelecek Durum"), 1, procHeaders, d.future.map(procRow));

  // 3. Zaman çizelgesi
  const timeline: CellValue[][] = [];
  if (d.figures.rawDays > 0) timeline.push(["Hammadde stoku", s.rawMaterialQty, d.figures.rawDays, null]);
  d.current.forEach(p => timeline.push([p.name, p.inventoryBefore, p.inventoryDays, p.valueAddedTime ?? p.cycleTime]));
  if (d.figures.fgDays > 0) timeline.push(["Mamul stoku", s.finishedGoodsQty, d.figures.fgDays, null]);
  const ws3 = wb.addWorksheet("Zaman Çizelgesi");
  addTable(ws3, 1, ["Nokta", "Stok (adet)", "Bekleme (gün)", "Katma değer (sn)"], timeline, [28, 14, 14, 16]);
  addKeyValues(ws3, "Toplam", [
    ["Lead time (gün, kritik yol)", d.figures.leadTimeDays], ["Katma değer süresi (sn)", d.figures.processingSeconds],
    ["PCE (katma değer ÷ lead time) %", Math.round(d.figures.pcePct * 1000) / 1000], ["Toplam WIP (adet)", d.figures.totalWip]
  ]);

  // 4. Göstergeler (mevcut ↔ gelecek)
  const c = d.comparison;
  const kpiRows: CellValue[][] = [
    ["Lead time (gün)", c.currentLeadTime, d.hasFuture ? c.futureLeadTime : null],
    ["Toplam WIP (adet)", c.currentWip, d.hasFuture ? c.futureWip : null],
    ["PCE %", c.currentVaRatio, d.hasFuture ? c.futureVaRatio : null],
    ["Ortalama OEE %", c.currentAvgOee, d.hasFuture ? c.futureAvgOee : null],
    ["Darboğaz", c.currentBottleneckName, d.hasFuture ? c.futureBottleneckName : null],
    ["Darboğaz OEE %", c.currentBottleneckOee, d.hasFuture ? c.futureBottleneckOee : null],
    ["Operatör", c.currentBlueCollar, d.hasFuture ? c.futureBlueCollar : null],
    ["Hat dengesi (C/T) %", c.currentCtBalance, d.hasFuture ? c.futureCtBalance : null],
    [`Yıllık kayıp (${d.currency})`, c.currentWasteCost, d.hasFuture ? c.futureWasteCost : null]
  ];
  const ws4 = wb.addWorksheet("Göstergeler");
  addTable(ws4, 1, ["Gösterge", "Mevcut", "Gelecek (simülasyon)"], kpiRows, [30, 18, 22]);
  if (d.hasFuture) addKeyValues(ws4, "Simülasyon", [[`Yıllık kayıp azalışı (${d.currency})`, c.annualSavings], ["Not", "Gelecek durum bir simülasyondur, gerçekleşmiş sonuç değildir."]]);

  // 5. Norm kadro
  const ws5 = wb.addWorksheet("Norm Kadro");
  addTable(ws5, 1, ["Proses", "Mevcut", "Gerekli", "Fark"], d.workforce.perProcess.map(p => [p.name, p.mevcut, p.gerekli, p.fark]), [28, 12, 12, 12]);
  addKeyValues(ws5, "Toplam", [["Yöntem", d.workforce.method], ["Mevcut", d.workforce.totalMevcut], ["Gerekli", d.workforce.totalGerekli], ["Fark", d.workforce.surplus]]);

  // 6. Gelecek durum tasarımı ve kaizen patlamaları
  const answers = VSM_DESIGN_QUESTIONS.filter(q => (d.designAnswers?.[q.key] || "").trim());
  if ((d.bursts && d.bursts.length) || answers.length) {
    const ws7 = wb.addWorksheet("Kaizen Patlamaları");
    addTable(ws7, 1, ["#", "Kaizen", "Harita", "Adım", "Etki alanı", "Hedef", "Döngü", "Sorumlu", "Termin", "Durum", "Açıklama"],
      (d.bursts || []).map((b, i) => [`K${i + 1}`, b.title, b.map === "future" ? "Gelecek" : "Mevcut", d.processName?.(b.map, b.processId) ?? b.processId,
        b.metric, b.target, b.loop, b.owner, b.dueDate, b.status || "Açık", b.description]),
      [6, 28, 10, 20, 18, 22, 18, 16, 12, 12, 40]);
    if (answers.length) addKeyValues(ws7, "Gelecek durum tasarım soruları", answers.map(q => [q.question, d.designAnswers![q.key]] as [string, CellValue]));
  }

  // 7. Ürün matrisi
  if (d.matrix.products.length > 0) {
    const ws6 = wb.addWorksheet("Ürün Matrisi");
    const chosen = new Set(d.matrix.familyProductIds || []);
    addTable(ws6, 1,
      ["Ürün", "Kod", "Adet/hafta", "Seçili aile", ...d.matrix.steps.map(x => x.name)],
      d.matrix.products.map(p => [p.name, p.code, p.weeklyVolume, chosen.has(p.id) ? "✓" : "", ...d.matrix.steps.map(x => (p.stepIds.includes(x.id) ? "●" : ""))])
    );
    addKeyValues(ws6, `Önerilen aileler (rota benzerliği ≥ %${d.matrix.similarityPct ?? 80})`,
      d.families.map((f, i) => [`Aile ${i + 1} — %${f.sharePct}, ${f.weeklyVolume} adet/hafta`, f.names.join(", ")] as [string, CellValue]));
  }
  return toBlob(wb);
}

// ---- field data form ----

export async function buildFieldForm(processes: VsmProcess[], setup: VsmFactorySetup, projectName: string): Promise<Blob> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gemba Tools — VSM";
  const ws = wb.addWorksheet("Prosesler");
  addTable(ws, 1, VSM_PROCESS_COLUMNS.map(c => c.header), processes.map(processToRow), VSM_PROCESS_COLUMNS.map(c => c.width ?? 13));
  ws.getColumn(1).font = { color: { argb: "FF94A3B8" } };
  const ks = wb.addWorksheet("Kurulum");
  ks.getColumn(1).width = 34;
  ks.getColumn(2).width = 28;
  ks.getRow(1).values = ["Alan", "Değer"];
  styleTable(ks, 1, 2, VSM_SETUP_FIELDS.length + 1);
  VSM_SETUP_FIELDS.forEach((f, i) => { ks.getRow(i + 2).values = [f.label, (setup[f.key] as any) ?? null]; });
  const info = wb.addWorksheet("Açıklama");
  info.getColumn(1).width = 110;
  [
    `VSM saha veri formu — ${projectName}`,
    "",
    "• Prosesler sayfasında her satır bir prosestir. ID sütununu değiştirmeyin; yeni proses için ID'yi boş bırakın.",
    "• Boş bırakılan hücre 'girilmedi' sayılır ve mevcut değeri değiştirmez.",
    "• Formdan silinen satır projeden silinmez (içe aktarma hiçbir prosesi silmez).",
    "• Süreler: C/T ve katma değer saniye; C/O, arıza, ilk parça onayı ve taşıma dakika.",
    "• Kurulum sayfasındaki değerler projenin Kurulum sekmesine yazılır.",
    "• Doldurduktan sonra VSM → Dışa Aktar → 'Saha formunu içe aktar' ile yükleyin."
  ].forEach((t, i) => { info.getRow(i + 1).values = [t]; if (i === 0) info.getRow(1).font = { bold: true, size: 12 }; });
  return toBlob(wb);
}

const cellText = (v: any): CellValue => {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if ("result" in v) return v.result as CellValue;                       // formula
    if ("richText" in v) return (v.richText as any[]).map(r => r.text).join("");
    if ("text" in v) return String(v.text);                               // hyperlink
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return null;
  }
  return v as CellValue;
};

export interface VsmFieldFormContent {
  rows: { rowNo: number; cells: CellValue[] }[];
  setupRows: { label: string; value: CellValue }[];
  error?: string;
}

// Reads a filled field form. Columns are matched by header text, so a reordered sheet still works.
export async function readFieldForm(file: File): Promise<VsmFieldFormContent> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet("Prosesler") || wb.worksheets[0];
  if (!ws) return { rows: [], setupRows: [], error: "Dosyada sayfa yok." };
  const norm = (s: any) => String(s ?? "").toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
  const header = ws.getRow(1);
  const colOf = VSM_PROCESS_COLUMNS.map(c => {
    for (let i = 1; i <= header.cellCount; i++) if (norm(cellText(header.getCell(i).value)) === norm(c.header)) return i;
    return -1;
  });
  if (colOf[1] === -1) return { rows: [], setupRows: [], error: "\"Proses adı\" sütunu bulunamadı — VSM saha formunu kullanın." };
  const rows: VsmFieldFormContent["rows"] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells = colOf.map(i => (i > 0 ? cellText(row.getCell(i).value) : null));
    if (cells.some(v => v !== null && String(v).trim() !== "")) rows.push({ rowNo: r, cells });
  }
  const setupRows: VsmFieldFormContent["setupRows"] = [];
  const ks = wb.getWorksheet("Kurulum");
  if (ks) for (let r = 2; r <= ks.rowCount; r++) {
    const row = ks.getRow(r);
    setupRows.push({ label: String(cellText(row.getCell(1).value) ?? ""), value: cellText(row.getCell(2).value) });
  }
  return { rows, setupRows };
}
