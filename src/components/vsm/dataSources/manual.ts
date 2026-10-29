// Manual source: the figures are typed into the VSM tabs, so there is nothing to pull.
import type { VsmDataSource } from "./types";

export const manualSource: VsmDataSource = {
  kind: "manual",
  label: "Elle giriş",
  available: true,
  listLines: async () => [],
  listProducts: async () => [],
  loadProcessSnapshot: async () => ({ processes: [], fieldSources: {}, pulledAt: new Date().toISOString(), warnings: [] })
};
