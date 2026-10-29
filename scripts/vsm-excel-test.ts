// Run: npx tsx scripts/vsm-excel-test.ts — VSM Excel field form round trip and workbook build (plan step V8).
import assert from "node:assert/strict";
import { buildFieldForm, buildVsmWorkbook, readFieldForm } from "../src/components/vsm/vsmExport.js";
import { mergeImportedRows, rowToPatch, setupPatchFromRows } from "../src/components/vsm/vsmExcel.js";
import { compareStates, computeAll, withInventoryDays } from "../src/components/vsm/vsmCalc.js";
import { emptyFactorySetup } from "../src/components/vsm/vsmNormalize.js";
import type { VsmProcess } from "../src/components/vsm/vsmTypes.js";

const proc = (id: string, name: string, over: Partial<VsmProcess> = {}): VsmProcess => ({
  id, name, type: "Manual", productionModel: "Other", machineCount: 1, operatorCount: 2, shifts: 1, shiftHours: [8], workingHours: 8,
  cycleTime: 60, oee: 0, availability: 0, performance: 0, quality: 0, capacity: 0, downtimeMinutes: 0, inventoryBefore: 100,
  isKanbanEnabled: false, isSupermarket: false, notes: "", kaizenOpp: "", ...over
});

const setup = { ...emptyFactorySetup(), weeklyDemand: 2000, shiftsPerDay: 2, supplierName: "Tedarikçi Ş" };
const processes = [proc("p1", "KESME", { inventoryType: "fifo", fifoMax: 40, epei: "2 gün" }), proc("p2", "BÜKME", { type: "Semi Automatic" })];

const asFile = (blob: Blob, name: string) => new File([blob], name);

(async () => {
  // field form round trip: unchanged form → same values
  const form = await readFieldForm(asFile(await buildFieldForm(processes, setup, "Hat 1"), "f.xlsx"));
  assert.equal(form.error, undefined);
  assert.equal(form.rows.length, 2);
  const same = mergeImportedRows(processes, form.rows, "u1");
  assert.equal(same.updated, 2);
  assert.equal(same.added, 0);
  assert.equal(same.issues.length, 0);
  assert.equal(same.processes[0].inventoryType, "fifo");
  assert.equal(same.processes[0].fifoMax, 40);
  assert.equal(same.processes[1].type, "Semi Automatic");
  const sp = setupPatchFromRows(form.setupRows, []);
  assert.equal(sp.weeklyDemand, 2000);
  assert.equal(sp.supplierName, "Tedarikçi Ş");

  // edited rows: update by id, new row without id, bad number reported, empty cell leaves value alone
  const issues: any[] = [];
  const patch = rowToPatch(["p1", "KESME", "", "", "", "", "45", "", "", "", "", "", "", "", "", "", "x", "Süpermarket"], 2, issues);
  assert.equal(patch.cycleTime, 45);
  assert.equal(patch.inventoryType, "supermarket");
  assert.equal(patch.inventoryBefore, undefined);
  assert.equal(issues.length, 1, "unreadable number reported");
  const merged = mergeImportedRows(processes, [
    { rowNo: 2, cells: ["p1", "KESME", null, null, null, null, 45] },
    { rowNo: 3, cells: [null, "MONTAJ", "Otomatik", 2, 0, 2, 30] },
    { rowNo: 4, cells: [null, null, null, null, null, null, 10] }
  ], "u7");
  assert.equal(merged.updated, 1);
  assert.equal(merged.added, 1);
  assert.equal(merged.processes.length, 3, "nothing deleted");
  assert.equal(merged.processes[0].cycleTime, 45);
  assert.equal(merged.processes[0].inventoryBefore, 100, "empty cell keeps the value");
  const added = merged.processes[2];
  assert.deepEqual([added.name, added.type, added.shifts, added.shiftHours?.length, added.createdBy], ["MONTAJ", "Automatic", 2, 2, "u7"]);
  assert.ok(merged.issues.some(i => i.row === 4), "row without name reported");

  // full workbook builds and has the expected sheets
  const current = withInventoryDays(computeAll(processes), 400);
  const cmp = compareStates(computeAll(processes), computeAll(processes), 400, setup);
  const blob = await buildVsmWorkbook({
    project: { name: "Hat 1" }, customerName: "Test", currency: "₺", setup, team: [{ name: "Ayşe", role: "Planlama" }],
    current, future: current, hasFuture: false, comparison: cmp,
    figures: { dailyDemand: 400, taktTime: 66, pitchTime: 0, netSecondsPerDay: 52800, leadTimeDays: 0.5, rawDays: 0, fgDays: 0, pcePct: 0.3, processingSeconds: 120, totalWip: 200, annualLoss: 0 },
    workforce: { perProcess: [], totalMevcut: 4, totalGerekli: 2, surplus: 2, method: "Takt bazlı" },
    matrix: { steps: [], products: [] }, families: []
  });
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  assert.deepEqual(wb.worksheets.map(w => w.name), ["Proje", "Mevcut Durum", "Zaman Çizelgesi", "Göstergeler", "Norm Kadro"]);
  console.log("vsm-excel-test: all checks passed");
})().catch(e => { console.error(e); process.exit(1); });
