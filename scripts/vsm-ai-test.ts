// Run: npx tsx scripts/vsm-ai-test.ts — VSM AI analysis facts and answer clean-up (no Gemini call).
import assert from "node:assert/strict";
import { buildVsmFacts, normalizeAnalysis } from "../src/server/vsm/vsmAnalysis.js";

const p = (id: string, name: string, ct: number, wip: number, o: any = {}) => ({
  id, name, type: "Manual", productionModel: "Cell", machineCount: 1, operatorCount: 1, shifts: 2, shiftHours: [8, 8], workingHours: 16,
  cycleTime: ct, oee: 0, availability: 0, performance: 0, quality: 0, capacity: 0, downtimeMinutes: 0, inventoryBefore: wip,
  isKanbanEnabled: false, isSupermarket: false, notes: "", kaizenOpp: "", idealCycleTime: ct, ...o
});
const project = {
  id: "vp", name: "Hat 1",
  factorySetup: { workingDays: 5, weeklyDemand: 2400, shiftsPerDay: 2, shiftDuration: 8, breakTimes: 30, plannedMaintenance: 10, rawMaterialQty: 960, scheduleMode: "pacemaker", pacemakerProcessId: "b" },
  vsmProcesses: [p("a", "KESME", 50, 0), p("b", "MONTAJ", 120, 480)],
  futureState: { processes: [p("a", "KESME", 50, 0), p("b", "MONTAJ", 95, 120, { inventoryType: "supermarket", isKanbanEnabled: true })], setup: { rawMaterialQty: 480 } },
  kaizenBursts: [{ id: "k1", title: "Montaj hücresi", map: "future", processId: "b", status: "Açık" }]
};
const f = buildVsmFacts(project, "ACME", { openCiProjects: 2 });
assert.equal(f.taktSec, 110);
assert.equal(f.currentState.bottleneck, "MONTAJ");
assert.equal(f.currentState.overTaktSteps, 1);
assert.equal(f.currentState.steps[1].wipDays, 1);
assert.equal(f.endStocks.rawDays, 2);
assert.equal(f.informationFlow.schedule, "pacemaker: MONTAJ");
assert.equal(f.futureState?.steps[1].stockType, "supermarket");
assert.equal(f.kaizenBursts[0].no, "K1");
assert.equal(f.currentState.leadTimeDays, 3);   // 2 raw + 1 WIP day
assert.equal(f.futureState?.leadTimeDays, 1.3);  // 1 raw + 0.25 WIP

const a = normalizeAnalysis({
  summary: "  Montaj takt'ı aşıyor.  ", findings: [{ title: "Darboğaz", detail: "MONTAJ 120 sn > 110 sn" }, { detail: "başlıksız" }],
  flowGuidance: [{ area: "Pacemaker", recommendation: "Montaj pacemaker olsun", why: "müşteriye en yakın" }],
  kaizenPriorities: [{ title: "Hücre", why: "takt", burst: "K1" }], questions: ["Montaj operatör sayısı?"], dataGaps: []
}, "Test", "gemini");
assert.equal(a.summary, "Montaj takt'ı aşıyor.");
assert.equal(a.findings.length, 1, "untitled finding dropped");
assert.equal(a.kaizenPriorities[0].burst, "K1");
assert.throws(() => normalizeAnalysis({}, "x", "m"), /kullanılabilir/);
console.log("vsm-ai-test: all checks passed");
