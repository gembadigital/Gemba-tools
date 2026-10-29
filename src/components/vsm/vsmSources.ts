// "Kaynaktan al" (plan step V9): values the other Gemba Tools modules already measured, offered for the
// VSM processes — Yamazumi (station C/T and value-added time), SMED (current set-up = C/O) and Time
// Study (observed cycle time). Each candidate carries a suggested target process (stored link or name
// match); the user confirms before anything is written. Pure functions.
import type { VsmProcess } from "./vsmTypes.js";

export type VsmSourceKind = "yamazumi" | "smed" | "timeStudy";

export interface VsmSourceCandidate {
  key: string;
  kind: VsmSourceKind;
  label: string;              // "Hat A etüdü · Kaynak istasyonu"
  date?: string;
  cycleTime?: number;         // seconds
  valueAddedTime?: number;    // seconds
  changeoverTime?: number;    // minutes
  suggestedProcessId?: string;
}

const norm = (s: any) => String(s ?? "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/[^a-z0-9çğöşü]+/g, " ").trim();
const r1 = (n: number) => Math.round(n * 10) / 10;

// Name match: exact, then one name containing the other.
export function matchProcess(name: string, processes: VsmProcess[]): string | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return (processes.find(p => norm(p.name) === n) || processes.find(p => norm(p.name).includes(n) || n.includes(norm(p.name))))?.id;
}

export function yamazumiCandidates(studies: any[], processes: VsmProcess[]): VsmSourceCandidate[] {
  const out: VsmSourceCandidate[] = [];
  (studies || []).forEach(st => {
    const byStation = new Map<string, { ct: number; va: number }>();
    (st?.elements || []).forEach((e: any) => {
      const station = String(e?.processName || "").trim();
      const t = Number(e?.standardCycleTime);
      if (!station || !Number.isFinite(t) || t <= 0) return;
      const cur = byStation.get(station) || { ct: 0, va: 0 };
      cur.ct += t;
      if (e.workClass === "VA") cur.va += t;
      byStation.set(station, cur);
    });
    byStation.forEach((v, station) => out.push({
      key: `yamazumi:${st.id}:${station}`,
      kind: "yamazumi",
      label: `${st.studyTitle || "Yamazumi"} · ${station}`,
      date: (st.updated_at || st.created_at || "").slice(0, 10),
      cycleTime: r1(v.ct),
      valueAddedTime: v.va > 0 ? r1(v.va) : undefined,
      suggestedProcessId: matchProcess(station, processes)
    }));
  });
  return out;
}

export function smedCandidates(projects: any[], processes: VsmProcess[]): VsmSourceCandidate[] {
  return (projects || [])
    .filter(p => p && !p.isArchived && Number(p.currentSetupTime) > 0)
    .map(p => ({
      key: `smed:${p.id}`,
      kind: "smed" as const,
      label: `${p.name || "SMED"}${p.machineNo ? ` · ${p.machineNo}` : ""}`,
      date: String(p.startDate || "").slice(0, 10) || undefined,
      changeoverTime: Number(p.currentSetupTime),
      suggestedProcessId: processes.some(x => x.id === p.linkedProcessId) ? p.linkedProcessId
        : matchProcess(p.linkedProcessName || p.productionLine || p.name, processes)
    }));
}

export function timeStudyCandidates(studies: any[], processes: VsmProcess[]): VsmSourceCandidate[] {
  const out: VsmSourceCandidate[] = [];
  (studies || []).forEach(st => {
    const linked = processes.some(x => x.id === st?.linkedVsmProcessId) ? st.linkedVsmProcessId : undefined;
    (st?.processes || []).forEach((p: any) => {
      const cycles = (p?.cy || []).map(Number).filter((n: number) => Number.isFinite(n) && n > 0);
      if (cycles.length === 0) return;
      const avg = cycles.reduce((a: number, b: number) => a + b, 0) / cycles.length;
      out.push({
        key: `timeStudy:${st.id}:${p.id}`,
        kind: "timeStudy",
        label: `${st.lineName || "Zaman etüdü"} · ${p.name || "operasyon"} (${cycles.length} ölçüm)`,
        date: String(st.createdAt || "").slice(0, 10) || undefined,
        cycleTime: r1(avg),
        suggestedProcessId: (st.processes || []).length === 1 && linked ? linked : matchProcess(p.name, processes) || linked
      });
    });
  });
  return out;
}

export const SOURCE_LABELS: Record<VsmSourceKind, string> = { yamazumi: "Yamazumi", smed: "SMED", timeStudy: "Zaman etüdü" };
