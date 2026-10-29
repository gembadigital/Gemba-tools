// VSM versions (plan step V7): named, read-only snapshots of the project's maps (current state, and the
// future state when one exists) with their key figures, for before / after comparison over time
// ("Mevcut v1 – Ekim", "Gelecek v1", later "Mevcut v2" after implementation). Pure functions.
import type { VsmFactorySetup, VsmProcess } from "./vsmTypes.js";
import { compareStates, computeAll, demandOf, netAvailableSecondsPerDay, shiftsForTakt, taktTimeOf } from "./vsmCalc.js";
import { effectiveFutureSetup } from "./vsmFuture.js";

export const VSM_MAX_VERSIONS = 12;

export interface VsmVersionMetrics {
  leadTimeDays: number;
  totalWip: number;
  pcePct: number;
  avgOee: number;
  operators: number;
  steps: number;
  bottleneck: string;
  taktSec: number;
  annualLoss: number;
}

export interface VsmVersion {
  id: string;
  label: string;
  createdAt: string;
  createdBy?: string;
  createdByName?: string;
  setup: VsmFactorySetup;
  processes: VsmProcess[];
  future?: { processes: VsmProcess[]; setup?: Partial<VsmFactorySetup> } | null;
  metrics: { current: VsmVersionMetrics; future?: VsmVersionMetrics | null };
}

export function stateMetrics(setup: VsmFactorySetup, processes: VsmProcess[], future?: { processes: VsmProcess[]; setup?: Partial<VsmFactorySetup> } | null) {
  const demand = demandOf(setup);
  const cur = computeAll(processes);
  const fut = future ? computeAll(future.processes) : cur;
  const fSetup = effectiveFutureSetup(setup, future?.setup);
  const c = compareStates(cur, fut, demand.daily, setup, fSetup);
  const takt = taktTimeOf(netAvailableSecondsPerDay(setup, shiftsForTakt(setup, cur)), demand.daily);
  const fTakt = taktTimeOf(netAvailableSecondsPerDay(fSetup, shiftsForTakt(fSetup, fut)), demand.daily);
  const current: VsmVersionMetrics = {
    leadTimeDays: c.currentLeadTime, totalWip: c.currentWip, pcePct: c.currentVaRatio, avgOee: c.currentAvgOee,
    operators: c.currentBlueCollar, steps: cur.length, bottleneck: c.currentBottleneckName, taktSec: takt, annualLoss: c.currentWasteCost
  };
  const futureM: VsmVersionMetrics | null = future ? {
    leadTimeDays: c.futureLeadTime, totalWip: c.futureWip, pcePct: c.futureVaRatio, avgOee: c.futureAvgOee,
    operators: c.futureBlueCollar, steps: fut.length, bottleneck: c.futureBottleneckName, taktSec: fTakt, annualLoss: c.futureWasteCost
  } : null;
  return { current, future: futureM };
}

export function makeVersion(label: string, setup: VsmFactorySetup, processes: VsmProcess[], future: VsmVersion["future"], user?: { id?: string; full_name?: string }): VsmVersion {
  const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  return {
    id: `ver_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    label: label.trim().slice(0, 80) || new Date().toLocaleDateString("tr-TR"),
    createdAt: new Date().toISOString(),
    createdBy: user?.id,
    createdByName: user?.full_name,
    setup: copy(setup),
    processes: copy(processes),
    future: future ? copy(future) : null,
    metrics: stateMetrics(setup, processes, future)
  };
}

export const VSM_VERSION_ROWS: { key: keyof VsmVersionMetrics; label: string; lowerIsBetter?: boolean; text?: boolean }[] = [
  { key: "leadTimeDays", label: "Lead time (gün)", lowerIsBetter: true },
  { key: "totalWip", label: "Toplam WIP (adet)", lowerIsBetter: true },
  { key: "pcePct", label: "PCE %" },
  { key: "avgOee", label: "Ortalama OEE %" },
  { key: "operators", label: "Operatör", lowerIsBetter: true },
  { key: "steps", label: "Adım sayısı", lowerIsBetter: true },
  { key: "taktSec", label: "Takt (sn)" },
  { key: "bottleneck", label: "Darboğaz", text: true },
  { key: "annualLoss", label: "Yıllık kayıp", lowerIsBetter: true }
];

// Stable key of everything the Kaydet button stores — used to detect unsaved changes.
export const savableKey = (state: Record<string, unknown>) => JSON.stringify(state);
