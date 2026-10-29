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
