// Run: npx tsx scripts/vsm-access-test.ts — checks the VSM access / input rules (src/utils/vsmAccess.ts).
import assert from "node:assert/strict";
import {
  canDeleteVsmProject, canDeleteVsmProcess, forbiddenProcessRemovals, normalizeVsmProjectInput, stampProcessOwners
} from "../src/utils/vsmAccess.js";

const admin = { id: "a", role: "Admin" };
const cu = { id: "u1", role: "Customer User" };
const other = { id: "u2", role: "Customer User" };

assert.equal(canDeleteVsmProject(admin, { created_by: "x" }), true);
assert.equal(canDeleteVsmProject(cu, { created_by: "u1" }), true);
assert.equal(canDeleteVsmProject(cu, { created_by: "u2" }), false);
assert.equal(canDeleteVsmProcess(cu, { createdBy: "u1" }), true);
assert.equal(canDeleteVsmProcess(cu, {}), false);

const before = [{ id: "p1", name: "Kesme", createdBy: "u2" }, { id: "p2", name: "Pres", createdBy: "u1" }];
assert.deepEqual(forbiddenProcessRemovals(cu, before, [{ id: "p1" }]), []);
assert.deepEqual(forbiddenProcessRemovals(cu, before, [{ id: "p2" }]), ["Kesme"]);
assert.deepEqual(forbiddenProcessRemovals(admin, before, []), []);
assert.deepEqual(forbiddenProcessRemovals(other, before, before), []);

const stamped = stampProcessOwners(before, [{ id: "p1", createdBy: "u1" }, { id: "p3" }], "u1");
assert.equal(stamped[0].createdBy, "u2", "client cannot claim an existing process");
assert.equal(stamped[1].createdBy, "u1", "new process is owned by the saver");

const bad = normalizeVsmProjectInput({ name: "  " });
assert.equal(bad.ok, false);
const ok = normalizeVsmProjectInput({
  name: "Hat 1", factory_id: "other", created_by: "x",
  vsmProcesses: [{ id: "p1", name: "A", cycleTime: "45", oee: -3, scrap: 0 }],
  factorySetup: { weeklyDemand: 1200, supplierName: "Tedarikçi" }
});
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.project.factory_id, undefined, "server-owned fields are dropped");
  assert.equal(ok.project.created_by, undefined);
  assert.equal(ok.project.vsmProcesses[0].cycleTime, 45);
  assert.equal(ok.project.vsmProcesses[0].oee, undefined, "negative number dropped");
  assert.equal(ok.project.vsmProcesses[0].scrap, 0, "a real 0 is kept");
  assert.equal(ok.project.factorySetup.weeklyDemand, 1200);
}
const tooMany = normalizeVsmProjectInput({ name: "x", vsmProcesses: Array.from({ length: 61 }, (_, i) => ({ id: "p" + i })) });
assert.equal(tooMany.ok, false);
console.log("vsm-access-test: all checks passed");

// V2 fields
const v2 = normalizeVsmProjectInput({
  name: "Hat 2",
  vsmProcesses: [{ id: "p1", name: "A", batchSize: "50", inventoryType: "fifo", fifoMax: 20, epei: "2 gün" }, { id: "p2", name: "B", inventoryType: "bogus" }],
  team: [{ name: "Ayşe", role: "Planlama", extra: "x" }],
  productMatrix: { steps: [{ id: "s1", name: "Kesme" }], products: [{ id: "x1", name: "Ürün", weeklyVolume: "120", stepIds: ["s1", "nope"] }], similarityPct: 500 }
});
assert.equal(v2.ok, true);
if (v2.ok) {
  assert.equal(v2.project.vsmProcesses[0].batchSize, 50);
  assert.equal(v2.project.vsmProcesses[0].inventoryType, "fifo");
  assert.equal(v2.project.vsmProcesses[1].inventoryType, undefined, "unknown stock type dropped");
  assert.deepEqual(v2.project.team, [{ name: "Ayşe", role: "Planlama" }]);
  assert.deepEqual(v2.project.productMatrix.products[0].stepIds, ["s1"], "routing only to known steps");
  assert.equal(v2.project.productMatrix.products[0].weeklyVolume, 120);
  assert.equal(v2.project.productMatrix.similarityPct, 100);
}
console.log("vsm-access-test: V2 checks passed");

// V5: future state + kaizen bursts
import { canDeleteVsmBurst, forbiddenBurstRemovals, stampBurstOwners } from "../src/utils/vsmAccess.js";
const v5 = normalizeVsmProjectInput({
  name: "Hat 3",
  futureState: { processes: [{ id: "f1", name: "A + B", cycleTime: 55, mergedFrom: ["a", "b"] }], setup: { rawMaterialQty: 200, pacemakerProcessId: "f1", bad: { x: 1 } }, designAnswers: { takt: "66 sn" } },
  kaizenBursts: [{ id: "k1", title: "SMED", map: "future", processId: "f1", status: "x", createdBy: "hacker" }, { id: "k2", title: "  " }]
});
assert.equal(v5.ok, true);
if (v5.ok) {
  assert.deepEqual(v5.project.futureState.processes[0].mergedFrom, ["a", "b"]);
  assert.equal(v5.project.futureState.setup.rawMaterialQty, 200);
  assert.equal(v5.project.futureState.setup.bad, undefined);
  assert.equal(v5.project.kaizenBursts.length, 1, "untitled burst dropped");
  assert.equal(v5.project.kaizenBursts[0].status, "Açık");
}
const bursts = [{ id: "k1", title: "SMED", createdBy: "u2" }, { id: "k2", title: "TPM", createdBy: "u1" }];
assert.equal(canDeleteVsmBurst(cu, bursts[0]), false);
assert.deepEqual(forbiddenBurstRemovals(cu, bursts, [bursts[1]]), ["SMED"]);
assert.deepEqual(forbiddenBurstRemovals(cu, bursts, [bursts[0]]), []);
const sb = stampBurstOwners(bursts, [{ id: "k1", title: "SMED", createdBy: "u1" }, { id: "k3", title: "Yeni" }], "u1");
assert.deepEqual(sb.map(b => b.createdBy), ["u2", "u1"]);
console.log("vsm-access-test: V5 checks passed");

// V7: versions
import { canDeleteVsmOwned, forbiddenOwnedRemovals } from "../src/utils/vsmAccess.js";
const v7 = normalizeVsmProjectInput({ name: "x", versions: [{ id: "v1", label: "Mevcut v1", processes: [{ id: "p1", name: "A", cycleTime: "40" }], setup: { weeklyDemand: 100, x: { y: 1 } }, metrics: { current: { leadTimeDays: 3, bottleneck: "A" } } }] });
assert.equal(v7.ok, true);
if (v7.ok) {
  assert.equal(v7.project.versions[0].processes[0].cycleTime, 40);
  assert.equal(v7.project.versions[0].setup.x, undefined);
  assert.equal(v7.project.versions[0].metrics.current.leadTimeDays, 3);
}
assert.equal(normalizeVsmProjectInput({ name: "x", versions: Array.from({ length: 13 }, (_, i) => ({ id: "v" + i, processes: [] })) }).ok, false);
assert.equal(canDeleteVsmOwned(cu, { createdBy: "u2" }), false);
assert.deepEqual(forbiddenOwnedRemovals(cu, [{ id: "v1", label: "V1", createdBy: "u2" }], []), ["V1"]);
console.log("vsm-access-test: V7 checks passed");

// V10: customer settings
import { DEFAULT_VSM_SETTINGS, normalizeVsmSettings } from "../src/utils/vsmSettings.js";
assert.deepEqual(normalizeVsmSettings(null), DEFAULT_VSM_SETTINGS);
const st = normalizeVsmSettings({ defaultWorkingDays: 6, weeksPerYear: 48, oeeTarget: 150, wipDaysWarning: "3", extra: 1 });
assert.deepEqual([st.defaultWorkingDays, st.weeksPerYear, st.oeeTarget, st.wipDaysWarning, (st as any).extra], [6, 48, 0, 3, undefined]);
console.log("vsm-access-test: V10 checks passed");
