// VSM example project (user request 2026-10-29): 8-step current state of a fictitious panel line in the
// ACME demo customer, and a 6-step future state with continuous-flow cells and a pull system
// (supermarkets + FIFO lanes, one pacemaker). Labelled "ÖRNEK" — not real customer data.
//
//   npx tsx scripts/vsm-example-project.ts            → validates and prints a summary (no write)
//   npx tsx scripts/vsm-example-project.ts --write    → inserts / replaces the record in the live database
//
// Figures are chosen to be internally consistent (takt 110 s from 2 400 pcs/week, 5 days, 2 × 8 h shifts,
// 30 min breaks, 10 min maintenance per shift). They are illustrative, not measured.
import fs from "node:fs";
import { createRequire } from "node:module";
import { normalizeVsmProjectInput, stampBurstOwners, stampProcessOwners } from "../src/utils/vsmAccess.js";
import { compareStates, computeAll, demandOf, netAvailableSecondsPerDay, taktTimeOf } from "../src/components/vsm/vsmCalc.js";
import { mergeProcesses, copyForFuture } from "../src/components/vsm/vsmFuture.js";
import type { VsmFactorySetup, VsmProcess } from "../src/components/vsm/vsmTypes.js";

const ORG = "org_tgblink0z";
const FACTORY = "cust_acmedemo1";
const ADMIN = "usr_k2ze6lule";
const ID = "vsm_proj_ornek_panel";

const step = (id: string, name: string, o: Partial<VsmProcess>): VsmProcess => ({
  id, name, type: "Semi Automatic", productionModel: "Batch", machineCount: 1, operatorCount: 1, shifts: 2, shiftHours: [8, 8], workingHours: 16,
  cycleTime: 60, oee: 0, availability: 0, performance: 0, quality: 0, capacity: 0, downtimeMinutes: 0, inventoryBefore: 0,
  isKanbanEnabled: false, isSupermarket: false, notes: "", kaizenOpp: "", inventoryType: "pile", createdBy: ADMIN, ...o
});

// --- current state: 8 steps, push everywhere, large batches
const current: VsmProcess[] = [
  step("ex_kesme", "LAZER KESME", { type: "Automatic", operatorCount: 1, cycleTime: 40, idealCycleTime: 36, valueAddedTime: 30, plannedQuantity: 480, actualQuantity: 470, changeoverTime: 30, breakdownTime: 25, firstPieceApproval: 10, goodParts: 466, scrap: 4, inventoryBefore: 0, batchSize: 500, epei: "1 hafta", variantCount: 4 }),
  step("ex_zimba", "ZIMBALAMA", { cycleTime: 35, idealCycleTime: 32, valueAddedTime: 20, plannedQuantity: 480, actualQuantity: 460, changeoverTime: 45, breakdownTime: 20, firstPieceApproval: 10, goodParts: 455, scrap: 5, inventoryBefore: 1200, batchSize: 500, epei: "1 hafta", variantCount: 4 }),
  step("ex_bukum", "ABKANT BÜKÜM", { cycleTime: 55, idealCycleTime: 50, valueAddedTime: 35, plannedQuantity: 480, actualQuantity: 455, changeoverTime: 60, breakdownTime: 30, firstPieceApproval: 15, goodParts: 448, scrap: 7, inventoryBefore: 900, batchSize: 400, epei: "1 hafta", variantCount: 4 }),
  step("ex_kaynak", "KAYNAK", { type: "Manual", productionModel: "Cell", operatorCount: 1, cycleTime: 95, idealCycleTime: 85, valueAddedTime: 70, plannedQuantity: 480, actualQuantity: 440, changeoverTime: 20, breakdownTime: 15, goodParts: 431, scrap: 9, rework: 12, inventoryBefore: 1500, batchSize: 200, epei: "3 gün", variantCount: 4 }),
  step("ex_capak", "ÇAPAK ALMA", { type: "Manual", productionModel: "Cell", operatorCount: 1, cycleTime: 45, idealCycleTime: 40, valueAddedTime: 25, plannedQuantity: 480, actualQuantity: 445, changeoverTime: 5, breakdownTime: 0, goodParts: 443, scrap: 2, inventoryBefore: 600, batchSize: 200, variantCount: 4 }),
  step("ex_boya", "TOZ BOYA", { type: "Automatic", productionModel: "Batch", operatorCount: 2, cycleTime: 30, idealCycleTime: 28, valueAddedTime: 20, plannedQuantity: 480, actualQuantity: 470, changeoverTime: 90, breakdownTime: 35, firstPieceApproval: 15, goodParts: 458, scrap: 12, inventoryBefore: 2000, batchSize: 600, epei: "2 hafta (renk)", variantCount: 6 }),
  step("ex_montaj", "MONTAJ", { type: "Manual", productionModel: "Assembly Line", operatorCount: 2, cycleTime: 120, idealCycleTime: 105, valueAddedTime: 95, plannedQuantity: 480, actualQuantity: 430, changeoverTime: 15, breakdownTime: 10, goodParts: 424, scrap: 6, inventoryBefore: 1400, batchSize: 100, variantCount: 8 }),
  step("ex_test", "TEST & PAKETLEME", { type: "Manual", productionModel: "Cell", operatorCount: 1, cycleTime: 50, idealCycleTime: 45, valueAddedTime: 30, plannedQuantity: 480, actualQuantity: 435, changeoverTime: 5, breakdownTime: 5, goodParts: 432, scrap: 3, inventoryBefore: 300, batchSize: 100, variantCount: 8 })
];

const setup: VsmFactorySetup = {
  workingDays: 5, shiftStructure: "2 vardiya", shiftDuration: 8, breakTimes: 30, plannedMaintenance: 10, weeklyDemand: 2400,
  productFamily: "Panel P1, Panel P2, Panel P3", customerName: "ÖRNEK Müşteri (beyaz eşya)", shippingFrequency: "Günlük 1 kamyon",
  productVolumeShare: 88.9, scrapUnitCost: 120, holdingCostPerWipYearly: 18, downtimeHourlyCost: 1500,
  supplierName: "ÖRNEK Sac Tedarikçisi", supplierMaterial: "Rulo sac", supplierDelivery: "Haftada 1", supplierBatch: "1 haftalık", supplierLeadTime: "5 gün",
  supplierLogistics: "Kamyon", planningSystem: "ERP (MRP)", planningFrequency: "Haftalık", planningSequencing: "İş emri sırası", planningCalendar: "5 gün × 2 vardiya",
  scopeStart: "Sac kabul", scopeEnd: "Müşteriye sevk", observationDate: "2026-10-29", shiftsPerDay: 2, orderType: "MTS (stoğa üretim)", packSize: 20,
  customerShipmentBatch: "480 adet / 24 paket", customerTransport: "Kamyon", customerOrderFrequency: "Günlük sipariş, 90/60/30 gün tahmin",
  customerOrderChannel: "Elektronik", supplierOrderFrequency: "Haftalık sipariş", supplierOrderChannel: "Manuel", scheduleMode: "each",
  rawMaterialQty: 4800, rawMaterialType: "pile", finishedGoodsQty: 2400, finishedGoodsType: "pile"
};

// --- future state: two continuous-flow cells (8 → 6 steps) and a pull system
let future = copyForFuture(current);
const m1 = mergeProcesses(future, ["ex_kaynak", "ex_capak"], ADMIN);
future = m1.list;
const m2 = mergeProcesses(future, ["ex_montaj", "ex_test"], ADMIN);
future = m2.list;
const cellWeld = m1.mergedId!, cellAssy = m2.mergedId!;
const patch = (id: string, o: Partial<VsmProcess>) => { future = future.map(p => (p.id === id ? { ...p, ...o } : p)); };
patch("ex_kesme", { changeoverTime: 15, batchSize: 120, epei: "1 gün", inventoryBefore: 0 });
patch("ex_zimba", { changeoverTime: 15, batchSize: 120, epei: "1 gün", inventoryType: "fifo", fifoMax: 120, inventoryBefore: 60 });
patch("ex_bukum", { changeoverTime: 20, batchSize: 120, epei: "1 gün", inventoryType: "fifo", fifoMax: 120, inventoryBefore: 60 });
patch(cellWeld, { name: "KAYNAK + ÇAPAK HÜCRESİ", operatorCount: 2, cycleTime: 70, idealCycleTime: 62, inventoryType: "supermarket", isSupermarket: true, isKanbanEnabled: true, inventoryBefore: 240, batchSize: 40, epei: "1 gün" });
patch("ex_boya", { changeoverTime: 40, batchSize: 240, epei: "2 gün (renk)", inventoryType: "fifo", fifoMax: 240, inventoryBefore: 120 });
patch(cellAssy, { name: "MONTAJ + TEST HÜCRESİ", operatorCount: 3, cycleTime: 95, idealCycleTime: 85, inventoryType: "supermarket", isSupermarket: true, isKanbanEnabled: true, inventoryBefore: 240, batchSize: 20, epei: "her gün (karışık)" });

const futureSetup: Partial<VsmFactorySetup> = {
  rawMaterialQty: 1920, rawMaterialType: "supermarket", finishedGoodsQty: 960, finishedGoodsType: "supermarket",
  scheduleMode: "pacemaker", pacemakerProcessId: cellAssy, supplierDelivery: "Günlük milk-run", supplierOrderFrequency: "Günlük kanban",
  supplierOrderChannel: "Elektronik", planningSequencing: "Heijunka kutusu (20 adet pitch)", planningFrequency: "Günlük"
};

const bursts = [
  { id: "kb_ex1", title: "Lazer + zımba SMED", map: "future", processId: "ex_kesme", metric: "Model değişim (C/O)", target: "C/O 30–45 → 15 dk", loop: "Ek döngü", owner: "Bakım şefi (örnek)", dueDate: "2026-12-15", status: "Açık" },
  { id: "kb_ex2", title: "Abkant SMED", map: "future", processId: "ex_bukum", metric: "Model değişim (C/O)", target: "C/O 60 → 20 dk, parti 400 → 120", loop: "Ek döngü", owner: "Üretim mühendisi (örnek)", dueDate: "2027-01-15", status: "Açık" },
  { id: "kb_ex3", title: "Kaynak + çapak hücresi", map: "future", processId: cellWeld, metric: "Çevrim süresi (C/T)", target: "2 operatörle C/T 70 sn < takt 110", loop: "Ek döngü", owner: "Endüstri mühendisi (örnek)", dueDate: "2027-01-31", status: "Açık", description: "İki istasyonu yan yana alıp tek parça akışa geçirmek; aradaki 600 adet stok kalkar." },
  { id: "kb_ex4", title: "Boya renk değişimi ve FIFO", map: "future", processId: "ex_boya", metric: "Model değişim (C/O)", target: "Renk değişimi 90 → 40 dk; FIFO ≤240", loop: "Ek döngü", owner: "Boyahane sorumlusu (örnek)", dueDate: "2027-02-15", status: "Açık" },
  { id: "kb_ex5", title: "Montaj + test hücresi ve heijunka", map: "future", processId: cellAssy, metric: "Lead time", target: "Pacemaker; 20 adetlik pitch (36,7 dk)", loop: "Pacemaker döngüsü", owner: "Üretim müdürü (örnek)", dueDate: "2027-02-28", status: "Açık" },
  { id: "kb_ex6", title: "Süpermarket + kanban kartları", map: "future", processId: cellAssy, metric: "Stok / WIP", target: "Boyalı parça ve mamul süpermarketi", loop: "Pacemaker döngüsü", owner: "Planlama şefi (örnek)", dueDate: "2027-02-28", status: "Açık" },
  { id: "kb_ex7", title: "Tedarikçi milk-run", map: "future", processId: "ex_kesme", metric: "Stok / WIP", target: "Hammadde 10 → 4 gün", loop: "Tedarikçi döngüsü", owner: "Satınalma (örnek)", dueDate: "2027-03-31", status: "Açık" }
];

const designAnswers: Record<string, string> = {
  takt: "Takt 110 sn (2 400 adet/hafta, 5 gün, 2 × 440 dk net).",
  fgSupermarket: "Mamul süpermarketine üretilecek (2 günlük, 960 adet); müşteri günlük çekiyor.",
  continuousFlow: "Kaynak + çapak alma ve montaj + test & paketleme hücre olarak sürekli akışa alınır (8 → 6 adım).",
  supermarkets: "Boyalı parça süpermarketi montaj hücresinin önünde; kaynak hücresinin önünde bükülmüş parça süpermarketi; kesme–zımba–büküm ve boya arası FIFO şeritleri.",
  pacemaker: "Montaj + test hücresi.",
  leveling: "Panel P1/P2/P3 heijunka kutusuyla günlük karışık; büyük parti yok.",
  pitch: "20 adetlik paket × 110 sn = 36,7 dk pitch.",
  improvements: "K1–K7: SMED (lazer/zımba, abkant, boya), iki hücre kurulumu, süpermarket + kanban, tedarikçi milk-run."
};

const project: any = {
  id: ID,
  name: "ÖRNEK — Panel Hattı VSM (8 → 6 adım, çekme sistemi)",
  productGroup: "Panel P1–P3",
  productCode: "PNL",
  productionLine: "Panel hattı (örnek)",
  department: "Üretim",
  leader: "Değer akışı yöneticisi (örnek)",
  startDate: "2026-10-29",
  targetDate: "2027-03-31",
  status: "Aktif",
  description: "ÖRNEK PROJE — eğitim ve tanıtım amaçlıdır; gerçek müşteri verisi değildir. Değerler tutarlı olacak şekilde seçilmiştir, ölçülmemiştir.",
  factorySetup: setup,
  vsmProcesses: current,
  simulationEdits: {},
  simulationMode: "current",
  dataSource: { kind: "manual" },
  team: [
    { name: "Değer akışı yöneticisi (örnek)", role: "Proje lideri" },
    { name: "Planlama şefi (örnek)", role: "Bilgi akışı" },
    { name: "Endüstri mühendisi (örnek)", role: "Zaman etüdü" }
  ],
  productMatrix: {
    steps: current.map(p => ({ id: p.id, name: p.name })),
    products: [
      { id: "pr_p1", name: "Panel P1", code: "PNL-1", weeklyVolume: 1000, stepIds: current.map(p => p.id) },
      { id: "pr_p2", name: "Panel P2", code: "PNL-2", weeklyVolume: 800, stepIds: current.map(p => p.id) },
      { id: "pr_p3", name: "Panel P3", code: "PNL-3", weeklyVolume: 600, stepIds: current.filter(p => p.id !== "ex_capak").map(p => p.id) },
      { id: "pr_p9", name: "Özel panel P9", code: "PNL-9", weeklyVolume: 300, stepIds: ["ex_kesme", "ex_bukum", "ex_boya", "ex_test"] }
    ],
    similarityPct: 80,
    familyProductIds: ["pr_p1", "pr_p2", "pr_p3"]
  },
  futureState: { processes: future, setup: futureSetup, designAnswers, createdAt: "2026-10-29T00:00:00.000Z" },
  kaizenBursts: bursts
};

const input = normalizeVsmProjectInput(project);
if (input.ok === false) throw new Error(input.error);
const clean = input.project;
clean.vsmProcesses = stampProcessOwners([], clean.vsmProcesses, ADMIN);
clean.kaizenBursts = stampBurstOwners([], clean.kaizenBursts, ADMIN);
const now = new Date().toISOString();
Object.assign(clean, { id: ID, organization_id: ORG, factory_id: FACTORY, created_by: ADMIN, updated_by: ADMIN, created_at: now, updated_at: now });

// summary
const daily = demandOf(setup).daily;
const takt = taktTimeOf(netAvailableSecondsPerDay(setup, 2), daily);
const cmp = compareStates(computeAll(clean.vsmProcesses), computeAll(clean.futureState.processes), daily, setup, { ...setup, ...clean.futureState.setup });
console.log({ steps: `${clean.vsmProcesses.length} → ${clean.futureState.processes.length}`, takt, leadTime: `${cmp.currentLeadTime} → ${cmp.futureLeadTime} gün`,
  wip: `${cmp.currentWip} → ${cmp.futureWip}`, pce: `${cmp.currentVaRatio} → ${cmp.futureVaRatio} %`, bottleneck: `${cmp.currentBottleneckName} → ${cmp.futureBottleneckName}`,
  operators: `${cmp.currentBlueCollar} → ${cmp.futureBlueCollar}`, bursts: clean.kaizenBursts.length });

if (process.argv.includes("--write")) {
  const pg = createRequire(import.meta.url)("pg");
  const env = fs.readFileSync(".env", "utf8");
  const url = env.split("\n").find(l => l.startsWith("DATABASE_URL="))!.slice(13).replace(/^"|"$/g, "");
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(
    `insert into records (id, collection, organization_id, factory_id, data, updated_at) values ($1, 'vsm_projects', $2, $3, $4, now())
     on conflict (id) do update set data = $4, factory_id = $3, organization_id = $2, updated_at = now()`,
    [ID, ORG, FACTORY, clean]
  );
  const check = await c.query("select id, factory_id, jsonb_array_length(data->'vsmProcesses') cur, jsonb_array_length(data->'futureState'->'processes') fut from records where id = $1", [ID]);
  console.log("written:", check.rows[0]);
  await c.end();
}
