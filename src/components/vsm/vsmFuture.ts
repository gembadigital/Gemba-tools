// Future state helpers (plan step V5). Pure functions.
import type { VsmFactorySetup, VsmProcess } from "./vsmTypes.js";

// The future map starts as a copy of the current processes (same ids, so each future process can be
// traced back), with any legacy simulation overlay applied.
export function copyForFuture(current: VsmProcess[], legacyEdits: Record<string, Partial<VsmProcess>> = {}): VsmProcess[] {
  return current.map(p => JSON.parse(JSON.stringify({ ...p, ...(legacyEdits[p.id] || {}) })));
}

// Combines adjacent processes into one continuous-flow step: work content (C/T, ideal C/T, VA time) and
// people / machines add up, the WIP between them disappears (the merged step keeps the first one's
// incoming stock), output figures come from the last step. The user then balances the new step.
export function mergeProcesses(list: VsmProcess[], ids: string[], userId?: string): { list: VsmProcess[]; mergedId?: string; error?: string } {
  const chosen = list.filter(p => ids.includes(p.id));
  if (chosen.length < 2) return { list, error: "Birleştirmek için en az iki proses seçin." };
  const indexes = chosen.map(p => list.indexOf(p)).sort((a, b) => a - b);
  if (indexes.some((v, i) => i > 0 && v !== indexes[i - 1] + 1)) return { list, error: "Yalnızca art arda gelen prosesler birleştirilebilir." };
  const ordered = indexes.map(i => list[i]);
  const first = ordered[0], last = ordered[ordered.length - 1];
  const sumOf = (k: keyof VsmProcess) => ordered.reduce((s, p) => s + ((p[k] as number) || 0), 0);
  const anyDefined = (k: keyof VsmProcess) => ordered.some(p => p[k] !== undefined);
  const id = `proc-merge-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const merged: VsmProcess = {
    ...first,
    id,
    name: ordered.map(p => p.name).join(" + "),
    machineCount: sumOf("machineCount"),
    operatorCount: sumOf("operatorCount"),
    cycleTime: sumOf("cycleTime"),
    idealCycleTime: anyDefined("idealCycleTime") ? ordered.reduce((s, p) => s + (p.idealCycleTime ?? p.cycleTime ?? 0), 0) : undefined,
    valueAddedTime: anyDefined("valueAddedTime") ? ordered.reduce((s, p) => s + (p.valueAddedTime ?? p.cycleTime ?? 0), 0) : undefined,
    changeoverTime: anyDefined("changeoverTime") ? Math.max(...ordered.map(p => p.changeoverTime ?? 0)) : undefined,
    breakdownTime: anyDefined("breakdownTime") ? sumOf("breakdownTime") : undefined,
    downtimeMinutes: sumOf("downtimeMinutes"),
    actualQuantity: last.actualQuantity,
    plannedQuantity: last.plannedQuantity,
    goodParts: last.goodParts,
    scrap: last.scrap,
    rework: last.rework,
    nextProcessIds: last.nextProcessIds,
    connectionTypes: last.connectionTypes,
    mergedFrom: Array.from(new Set(ordered.flatMap(p => p.mergedFrom?.length ? p.mergedFrom : [p.id]))),
    notes: ordered.map(p => p.notes).filter(Boolean).join(" · "),
    createdBy: userId
  };
  const gone = new Set(ordered.map(p => p.id));
  const rest = list.map(p => {
    if (!p.nextProcessIds?.some(x => gone.has(x))) return p;
    const next = Array.from(new Set(p.nextProcessIds.map(x => (gone.has(x) ? id : x))));
    return { ...p, nextProcessIds: next };
  });
  const out = [...rest.slice(0, indexes[0]), merged, ...rest.slice(indexes[indexes.length - 1] + 1)];
  return { list: out, mergedId: id };
}

// The future process that carries a current process (same id, or merged into one).
export function futureCounterpart<T extends VsmProcess>(current: VsmProcess, future: T[]): T | undefined {
  return future.find(f => f.id === current.id) || future.find(f => f.mergedFrom?.includes(current.id));
}

export const effectiveFutureSetup = (setup: VsmFactorySetup, futureSetup?: Partial<VsmFactorySetup>): VsmFactorySetup =>
  ({ ...setup, ...(futureSetup || {}) });

// The future-state design questions (Rother & Shook, "Learning to See"). `hint` is filled from the data.
export const VSM_DESIGN_QUESTIONS: { key: string; question: string }[] = [
  { key: "takt", question: "1. Takt süresi nedir?" },
  { key: "fgSupermarket", question: "2. Mamul süpermarketine mi, doğrudan sevkiyata mı üretilecek?" },
  { key: "continuousFlow", question: "3. Sürekli akış (tek parça akış) nerede kullanılabilir?" },
  { key: "supermarkets", question: "4. Akışın kesildiği yerlerde çekme (süpermarket / FIFO) nerede gerekli?" },
  { key: "pacemaker", question: "5. Üretim çizelgesi tek hangi noktaya (pacemaker) gönderilecek?" },
  { key: "leveling", question: "6. Pacemakerda ürün karışımı nasıl harmanlanacak (heijunka)?" },
  { key: "pitch", question: "7. Pacemakerdan hangi iş birimi (pitch) düzenli serbest bırakılacak?" },
  { key: "improvements", question: "8. Bu tasarım için hangi süreç iyileştirmeleri gerekli (kaizen patlamaları)?" }
];
