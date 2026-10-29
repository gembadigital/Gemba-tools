// Opx Suite source — skeleton. Inside Opx Suite this reads, for the chosen line, product and date range:
//   machine / process cards      → name, machineCount, operatorCount, shifts, shiftHours, idealCycleTime
//   work-order closings          → actualQuantity, goodParts, scrap, rework, run time (→ cycleTime)
//   machine OEE / stop records   → availability, performance, breakdownTime, changeoverTime, minorStops
// and returns them as one VsmProcessSnapshot (averages over the range, field sources filled in).
// Gemba Tools has no Opx Suite database, so the source is unavailable here; the connection is made when
// the VSM module is split out (plan step V11). The interface is fixed now so the screens can be built
// against it.
import type { VsmDataSource } from "./types";

const notConnected = () => Promise.reject(new Error("Opx Suite veri bağlantısı bu ortamda yok."));

export const opxSuiteSource: VsmDataSource = {
  kind: "opxSuite",
  label: "Opx Suite (hat · ürün · tarih)",
  available: false,
  listLines: notConnected,
  listProducts: notConnected,
  loadProcessSnapshot: notConnected
};
