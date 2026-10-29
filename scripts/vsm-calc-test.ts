// Run: npx tsx scripts/vsm-calc-test.ts — checks the VSM calculation engine (src/components/vsm/vsmCalc.ts).
import assert from "node:assert/strict";
import {
  annualWasteCost, applySimulation, bottleneckOf, compareStates, computeProcessMetrics, demandOf, flowSummary,
  netAvailableSecondsPerDay, simulationDeltas, taktTimeOf, withInventoryDays, workforceAnalysis
} from "../src/components/vsm/vsmCalc.js";
import type { VsmFactorySetup, VsmProcess } from "../src/components/vsm/vsmTypes.js";

const proc = (id: string, over: Partial<VsmProcess>): VsmProcess => ({
  id, name: id.toUpperCase(), type: "Manual", productionModel: "Other", machineCount: 1, operatorCount: 1, shifts: 1,
  workingHours: 8, cycleTime: 60, oee: 0, availability: 0, performance: 0, quality: 0, capacity: 0, downtimeMinutes: 0,
  inventoryBefore: 0, isKanbanEnabled: false, isSupermarket: false, notes: "", kaizenOpp: "", ...over
});

// --- process metrics: 1 shift × 8 h = 480 min; 30 C/O + 20 breakdown + 10 FPA → 420 min available
const m = computeProcessMetrics(proc("a", {
  shiftHours: [8], changeoverTime: 30, breakdownTime: 20, firstPieceApproval: 10,
  actualQuantity: 360, idealCycleTime: 60, goodParts: 342, scrap: 18
}));
assert.equal(m.availability, 87.5);                  // 420 / 480
assert.equal(m.performance, 85.7);                   // 360 × 60 / (420 × 60)
assert.equal(m.quality, 95);                         // 342 / 360
assert.equal(m.oee, 71.2);                           // 87.5 × 85.7 × 95 / 10000
assert.equal(m.capacity, 420);                       // 420 × 60 / 60
assert.equal(m.downtimeMinutes, 20);
assert.equal(m.cycleTime, 60, "C/T is never recomputed");

// nothing entered → nothing invented
const empty = computeProcessMetrics(proc("e", { shifts: 0, cycleTime: 0 }));
assert.equal(empty.oee, 0);
assert.equal(empty.capacity, 0);
assert.equal(empty.quality, 0);

// --- demand / takt: 2000 / 5 days = 400 per day; 1 shift × (480 − 30 − 10) min = 26 400 s → 66 s
const setup = {
  workingDays: 5, weeklyDemand: 2000, shiftDuration: 8, breakTimes: 30, plannedMaintenance: 10,
  holdingCostPerWipYearly: 10, scrapUnitCost: 5, downtimeHourlyCost: 600
} as VsmFactorySetup;
const d = demandOf(setup);
assert.deepEqual([d.daily, d.workDaysPerYear], [400, 260]);
assert.equal(netAvailableSecondsPerDay(setup, 1), 26400);
assert.equal(taktTimeOf(26400, 400), 66);
assert.equal(demandOf({ weeklyDemand: 100, workingDays: 0 }).daily, 0);

// --- lead time: linear chain = plain sum; parallel branch = longest path, not the sum
const linear = withInventoryDays([proc("p1", { inventoryBefore: 800 }), proc("p2", { inventoryBefore: 400 })], 400);
assert.equal(flowSummary(linear).leadTimeDays, 3);   // 2 + 1 days
assert.equal(flowSummary(linear).totalWip, 1200);
const branched = withInventoryDays([
  proc("s", { inventoryBefore: 400, nextProcessIds: ["x", "y"] }),
  proc("x", { inventoryBefore: 800, nextProcessIds: ["j"] }),
  proc("y", { inventoryBefore: 200, nextProcessIds: ["j"] }),
  proc("j", { inventoryBefore: 0 })
], 400);
const bf = flowSummary(branched);
assert.equal(bf.leadTimeDays, 3);                    // s (1) + x (2), not + y
assert.deepEqual([...bf.criticalPathIds].sort(), ["j", "s", "x"]);

// --- waste cost: WIP 1200 × 10 + downtime (20/60 h × 260 × 600) + scrap (360 × 5% × 260 × 5)
const wc = annualWasteCost([{ ...m, inventoryBefore: 1200 }], setup, 260);
assert.equal(wc.holding, 12000);
assert.equal(Math.round(wc.downtime), 52000);
assert.equal(Math.round(wc.scrap), 23400);

// --- current ↔ future
const current = [computeProcessMetrics(proc("p1", { inventoryBefore: 800, cycleTime: 70 })), computeProcessMetrics(proc("p2", { inventoryBefore: 400, cycleTime: 50 }))];
const future = applySimulation(current, { p1: { inventoryBefore: 400, cycleTime: 55 } }).map(computeProcessMetrics);
const cmp = compareStates(current, future, 400, setup);
assert.equal(cmp.currentLeadTime, 3);
assert.equal(cmp.futureLeadTime, 2);
assert.equal(cmp.currentBottleneckName, "P1");
assert.equal(cmp.futureBottleneckName, "P1");
assert.ok(cmp.kaizenThemes.some(t => t.theme === "Stok Azaltma"));
assert.deepEqual(simulationDeltas(cmp, false), { hasEdits: false, leadTimeReduction: 0, inventoryReduction: 0, costSavings: 0 });
const deltas = simulationDeltas(cmp, true);
assert.equal(deltas.leadTimeReduction, 33);
assert.equal(deltas.inventoryReduction, 33);
assert.equal(bottleneckOf(current)?.id, "p1");

// --- workforce: takt 66 s; C/T 70 → 2 operators, 50 → 1
const wf = workforceAnalysis(current, "takt", 66, 400, setup);
assert.deepEqual(wf.perProcess.map(p => p.gerekli), [2, 1]);

console.log("vsm-calc-test: all checks passed");

// --- V2: project-level shifts, pitch, raw / finished goods in lead time, VA time in PCE
import { endStockDays, pitchOf, shiftsForTakt } from "../src/components/vsm/vsmCalc.js";
import { normalizeVsmProject } from "../src/components/vsm/vsmNormalize.js";
import { familyTotals, routingSimilarity, suggestFamilies } from "../src/components/vsm/vsmProductMatrix.js";

assert.equal(shiftsForTakt({ shiftsPerDay: 2 }, [proc("a", { shifts: 3 })]), 2);
assert.equal(shiftsForTakt({}, [proc("a", { shifts: 3 })]), 3, "older projects: first process's shifts");
assert.equal(pitchOf(66, 20), 1320);
assert.equal(pitchOf(66, undefined), 0);
const ends = endStockDays({ rawMaterialQty: 1200, finishedGoodsQty: 400 }, 400);
assert.deepEqual(ends, { rawDays: 3, fgDays: 1 });
const withEnds = flowSummary(linear, ends);
assert.equal(withEnds.leadTimeDays, 7);              // 3 raw + 3 WIP + 1 FG
const va = flowSummary(withInventoryDays([proc("v", { cycleTime: 60, valueAddedTime: 20 })], 400));
assert.equal(va.processingSeconds, 20, "entered VA time replaces C/T in PCE");

// normalizer: legacy changeover + supermarket flag, shift fallback
const n = normalizeVsmProject({ id: "x", name: "x", vsmProcesses: [proc("a", { shifts: 2, changeoverMinutes: 25, isSupermarket: true })] });
assert.equal(n.processes[0].changeoverTime, 25);
assert.equal(n.processes[0].changeoverMinutes, undefined);
assert.equal(n.processes[0].inventoryType, "supermarket");
assert.equal(n.setup.shiftsPerDay, 2);
assert.equal(n.setup.scheduleMode, "each");
assert.equal(n.setup.weeklyDemand, 0, "nothing invented");

// product–process matrix
assert.equal(routingSimilarity(["a", "b", "c", "d", "e"], ["a", "b", "c", "d"]), 0.8);
const matrix = {
  steps: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "d", name: "D" }, { id: "e", name: "E" }],
  products: [
    { id: "x", name: "X", weeklyVolume: 500, stepIds: ["a", "b", "c", "d", "e"] },
    { id: "y", name: "Y", weeklyVolume: 300, stepIds: ["a", "b", "c", "d"] },
    { id: "z", name: "Z", weeklyVolume: 200, stepIds: ["a", "e"] }
  ],
  similarityPct: 80
};
const fams = suggestFamilies(matrix);
assert.deepEqual(fams.map(f => f.productIds), [["x", "y"], ["z"]]);
assert.equal(fams[0].sharePct, 80);
assert.deepEqual(familyTotals(matrix, ["x", "y"]), { names: ["X", "Y"], weeklyVolume: 800, sharePct: 80 });
console.log("vsm-calc-test: V2 checks passed");

// --- V4: takt / capacity check, money
import { costsEntered, formatMoney, taktCheck } from "../src/components/vsm/vsmCalc.js";
const tc = taktCheck([{ ...proc("a", { cycleTime: 70 }), capacity: 380 }, { ...proc("b", { cycleTime: 50 }), capacity: 520 }], 66, 400);
assert.deepEqual(tc.rows.map(r => r.overTakt), [true, false]);
assert.equal(tc.overTaktCount, 1);
assert.equal(tc.shortOfDemandCount, 1);
assert.equal(tc.rows[1].demandCoverPct, 130);
assert.equal(tc.constraintName, "A");
assert.equal(tc.constraintOverTakt, true);
assert.equal(taktCheck([proc("a", {})], 0, 0).overTaktCount, 0, "no takt → nothing flagged");
assert.equal(costsEntered({}), false);
assert.equal(costsEntered({ scrapUnitCost: 5 }), true);
assert.equal(formatMoney(391350.4, "₺"), "391.350 ₺");
console.log("vsm-calc-test: V4 checks passed");

// --- V5: future state copy and merge
import { copyForFuture, futureCounterpart, mergeProcesses } from "../src/components/vsm/vsmFuture.js";
const cur = [proc("a", { cycleTime: 30, operatorCount: 1, inventoryBefore: 100, nextProcessIds: ["b"] }), proc("b", { cycleTime: 25, operatorCount: 1, inventoryBefore: 50, nextProcessIds: ["c"], actualQuantity: 400 }), proc("c", { cycleTime: 40, inventoryBefore: 20 })];
const fut = copyForFuture(cur, { c: { cycleTime: 35 } });
assert.equal(fut[2].cycleTime, 35);
assert.equal(cur[2].cycleTime, 40, "copy does not touch the current state");
const mg = mergeProcesses(fut, ["a", "b"], "u1");
assert.equal(mg.error, undefined);
assert.equal(mg.list.length, 2);
assert.deepEqual([mg.list[0].name, mg.list[0].cycleTime, mg.list[0].operatorCount, mg.list[0].inventoryBefore, mg.list[0].actualQuantity], ["A + B", 55, 2, 100, 400]);
assert.deepEqual(mg.list[0].mergedFrom, ["a", "b"]);
assert.deepEqual(mg.list[0].nextProcessIds, ["c"]);
assert.equal(futureCounterpart(cur[1], mg.list)?.id, mg.mergedId);
assert.ok(mergeProcesses(fut, ["a", "c"]).error, "non-adjacent merge refused");
assert.ok(mergeProcesses(fut, ["a"]).error);
// merging a merged step keeps the original ids
const m2 = mergeProcesses(mg.list, [mg.mergedId!, "c"]);
assert.deepEqual(m2.list[0].mergedFrom, ["a", "b", "c"]);
console.log("vsm-calc-test: V5 checks passed");
