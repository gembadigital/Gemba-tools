// VSM flow graph: turns the flat process list into a directed graph (branching / parallel flows),
// lays it out in lanes and finds the critical (longest lead-time) path. Pure functions.
import type { VsmConnectionType, VsmProcess } from "./vsmTypes";

// --- GRAPH-BASED PROCESS FLOW HELPERS ---
// Pure functions turning the flat `vsmProcesses` array into a directed graph, so the drawing
// engine and the lead-time rollup can support branching/parallel flows. When no process in a
// project has `nextProcessIds` set, every helper below falls back to the legacy index-based
// linear chain — existing single-chain VSM projects keep rendering and calculating exactly as
// before (see isLinearFlow), with zero migration needed.

export interface VsmGraphEdge {
  fromId: string;
  toId: string;
  type: VsmConnectionType;
}

export function getEffectiveSuccessorIds(process: VsmProcess, allProcesses: VsmProcess[], idx: number): string[] {
  if (process.nextProcessIds && process.nextProcessIds.length > 0) {
    const validIds = new Set(allProcesses.map(p => p.id));
    return process.nextProcessIds.filter(id => validIds.has(id) && id !== process.id);
  }
  // Legacy fallback: sequential chain, same as today's array order.
  return idx < allProcesses.length - 1 ? [allProcesses[idx + 1].id] : [];
}

export function buildProcessGraph(processes: VsmProcess[]): { edges: VsmGraphEdge[] } {
  const edges: VsmGraphEdge[] = [];
  processes.forEach((p, idx) => {
    getEffectiveSuccessorIds(p, processes, idx).forEach(toId => {
      edges.push({ fromId: p.id, toId, type: (p.connectionTypes && p.connectionTypes[toId]) || "Normal" });
    });
  });
  return { edges };
}

// True when the effective graph is a single straight chain (every process has at most one
// predecessor and at most one successor) — no branching exists yet, so the classic single-row
// rendering and flat lead-time sum are already exactly correct and must be used unchanged.
export function isLinearFlow(processes: VsmProcess[], edges: VsmGraphEdge[]): boolean {
  if (processes.length <= 1) return true;
  const outCount = new Map<string, number>();
  const inCount = new Map<string, number>();
  edges.forEach(e => {
    outCount.set(e.fromId, (outCount.get(e.fromId) || 0) + 1);
    inCount.set(e.toId, (inCount.get(e.toId) || 0) + 1);
  });
  return processes.every(p => (outCount.get(p.id) || 0) <= 1 && (inCount.get(p.id) || 0) <= 1);
}

export interface VsmGraphLayout {
  positions: Map<string, { x: number; y: number; rank: number; lane: number }>;
  predecessors: Map<string, string[]>;
  successors: Map<string, string[]>;
  rank: Map<string, number>;
  laneCount: number;
  maxRank: number;
}

// Layered graph-drawing layout: rank = column (longest path from any root — a node can never sit
// left of any of its predecessors), lane = row. Lanes are assigned greedily per rank so a
// continuing chain keeps its lane and new branches get their own — this keeps left-to-right flow
// and avoids overlap without needing a full crossing-minimization solver.
export function computeGraphLayout(processes: VsmProcess[], edges: VsmGraphEdge[]): VsmGraphLayout {
  const ids = processes.map(p => p.id);
  const idSet = new Set(ids);
  const predecessors = new Map<string, string[]>(ids.map(id => [id, []]));
  const successors = new Map<string, string[]>(ids.map(id => [id, []]));
  edges.forEach(e => {
    if (!idSet.has(e.fromId) || !idSet.has(e.toId)) return;
    successors.get(e.fromId)!.push(e.toId);
    predecessors.get(e.toId)!.push(e.fromId);
  });

  // 1. Rank via topological (Kahn's algorithm) longest-path-from-root.
  const rank = new Map<string, number>();
  const remainingIndegree = new Map<string, number>(ids.map(id => [id, predecessors.get(id)!.length]));
  const queue: string[] = ids.filter(id => remainingIndegree.get(id) === 0);
  queue.forEach(id => rank.set(id, 0));
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const currentRank = rank.get(current) || 0;
    successors.get(current)!.forEach(nextId => {
      const candidateRank = currentRank + 1;
      if ((rank.get(nextId) ?? -1) < candidateRank) rank.set(nextId, candidateRank);
      const remaining = (remainingIndegree.get(nextId) || 0) - 1;
      remainingIndegree.set(nextId, remaining);
      if (remaining === 0) queue.push(nextId);
    });
  }
  // Any node never reached (e.g. a Rework cycle feeding back on itself) just falls back to rank 0
  // instead of being left undefined — keeps the layout from breaking on future connection types.
  ids.forEach(id => { if (!rank.has(id)) rank.set(id, 0); });

  // 2. Lane assignment, rank by rank: keep a node in its first predecessor's lane when free,
  // otherwise hand it the next free lane at that rank.
  const lane = new Map<string, number>();
  const maxRank = ids.length > 0 ? Math.max(...Array.from(rank.values())) : 0;
  let laneCounter = 0;
  for (let r = 0; r <= maxRank; r++) {
    const nodesAtRank = ids.filter(id => rank.get(id) === r);
    const usedLanesThisRank = new Set<number>();
    nodesAtRank.forEach(id => {
      const preds = predecessors.get(id) || [];
      let assigned: number | undefined;
      if (preds.length > 0) {
        const preferredLane = lane.get(preds[0]);
        if (preferredLane !== undefined && !usedLanesThisRank.has(preferredLane)) {
          assigned = preferredLane;
        }
      }
      if (assigned === undefined) {
        while (usedLanesThisRank.has(laneCounter)) laneCounter++;
        assigned = laneCounter;
        laneCounter++;
      }
      lane.set(id, assigned);
      usedLanesThisRank.add(assigned);
    });
  }

  // 3. Pixel coordinates — column/row spacing kept close to the legacy single-row scale so card
  // sizing and the fixed supplier/customer/production-control boxes don't need to change.
  const COLUMN_WIDTH = 280;
  const LANE_HEIGHT = 270; // process cards are ~230px tall; leaves a clear gap between lanes
  const START_X = 310;
  const START_Y = 265; // matches the legacy single-row card top offset (top-[265px])
  const positions = new Map<string, { x: number; y: number; rank: number; lane: number }>();
  ids.forEach(id => {
    const r = rank.get(id) || 0;
    const l = lane.get(id) || 0;
    positions.set(id, { x: START_X + r * COLUMN_WIDTH, y: START_Y + l * LANE_HEIGHT, rank: r, lane: l });
  });

  return { positions, predecessors, successors, rank, laneCount: laneCounter, maxRank };
}

// Critical-path (longest path) total lead time in days — the correct rollup once branches exist:
// parallel lanes run in the same calendar time, so their WIP-wait days must NOT be added together
// (that would double/triple-count elapsed time). Each node's own inventoryDays (its WIP wait
// before that station) is still tracked and shown per-process; only the top-level total switches
// from a flat sum to "longest path through the graph." For any existing linear-chain project this
// is mathematically identical to the old flat sum (there is only one path), so there is no
// behavior change for today's single-chain VSMs.
export function computeCriticalPath(
  processesWithTimeline: Array<VsmProcess & { inventoryDays?: number }>,
  rank: Map<string, number>,
  predecessors: Map<string, string[]>
): { totalDays: number; criticalPathIds: Set<string> } {
  const byId = new Map(processesWithTimeline.map(p => [p.id, p]));
  const orderedIds = processesWithTimeline.map(p => p.id).sort((a, b) => (rank.get(a) || 0) - (rank.get(b) || 0));
  const pathValue = new Map<string, number>();
  const bestPredOf = new Map<string, string | null>();
  orderedIds.forEach(id => {
    const preds = predecessors.get(id) || [];
    let bestPred: string | null = null;
    let bestVal = 0;
    preds.forEach(predId => {
      const v = pathValue.get(predId) || 0;
      if (v >= bestVal) { bestVal = v; bestPred = predId; }
    });
    bestPredOf.set(id, bestPred);
    pathValue.set(id, (byId.get(id)?.inventoryDays || 0) + bestVal);
  });

  let maxVal = 0;
  let maxId: string | null = null;
  pathValue.forEach((v, id) => { if (v >= maxVal) { maxVal = v; maxId = id; } });

  // Walk back through each node's best predecessor from the winning sink to mark every process
  // that actually sits on the longest path — used to visually highlight what's driving lead time.
  const criticalPathIds = new Set<string>();
  let cursor = maxId;
  while (cursor) {
    criticalPathIds.add(cursor);
    cursor = bestPredOf.get(cursor) || null;
  }

  return { totalDays: Math.round(maxVal * 100) / 100, criticalPathIds };
}

