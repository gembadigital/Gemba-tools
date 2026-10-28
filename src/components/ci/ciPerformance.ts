// CI follow-up metrics (plan step C7): step-by-step closing dates against plan, delays and the
// performance of project leaders (requirement A1). Every figure is derived from the A3 fields —
// `stageDates[n].planned / completed`, `plannedFinishDate`, tasks — nothing is estimated.
import type { KaizenCard } from "../../types";
import { CI_STEPS, stageOf, isClosed, isTaskFinished, personKey, CiUserLike, canApproveStage } from "../../utils/ciLifecycle";

const DAY = 86400000;
const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((new Date(`${toIso.slice(0, 10)}T00:00:00`).getTime() - new Date(`${fromIso.slice(0, 10)}T00:00:00`).getTime()) / DAY);

export const isActive = (k: KaizenCard) => !isClosed(k) && !k.holdState;

export interface Attention {
  project: KaizenCard;
  kind: "approval" | "stageLate" | "projectLate" | "actionsLate" | "stale";
  text: string;
  days?: number;
}

// Why an active project needs attention today. `stale` = no recorded change for 30+ days.
export function attentionFor(k: KaizenCard, todayIso: string): Attention[] {
  if (!isActive(k)) return [];
  const out: Attention[] = [];
  const stage = stageOf(k);
  const planned = k.stageDates?.[stage]?.planned;
  if (planned && planned < todayIso) {
    out.push({ project: k, kind: "stageLate", days: daysBetween(planned, todayIso), text: `Adım ${stage} (${CI_STEPS[stage - 1].short}) planlanan tarihi geçti` });
  }
  if (k.plannedFinishDate && k.plannedFinishDate < todayIso) {
    out.push({ project: k, kind: "projectLate", days: daysBetween(k.plannedFinishDate, todayIso), text: "Hedef bitiş tarihi geçti" });
  }
  const lateActions = (k.tasks || []).filter((t: any) => t.deadline && t.deadline < todayIso && !isTaskFinished(t)).length;
  if (lateActions) out.push({ project: k, kind: "actionsLate", text: `${lateActions} aksiyonun termini geçti` });
  const last = (k.history || []).slice(-1)[0]?.at || (k as any).updated_at;
  if (last && daysBetween(last, todayIso) >= 30) {
    out.push({ project: k, kind: "stale", days: daysBetween(last, todayIso), text: "30 gündür değişiklik yok" });
  }
  return out;
}

export const awaitingMyApproval = (projects: KaizenCard[], user: CiUserLike | null) =>
  projects.filter(k => isActive(k) && k.pendingApproval && canApproveStage(user, k));

export interface LeaderRow {
  key: string;
  name: string;
  active: number;
  closed: number;
  stepsDone: number;        // approved steps that had a planned date
  stepsOnTime: number;      // … approved on or before it
  avgLateDays: number | null; // over the steps approved late
  lateNow: number;          // active projects whose current step or target date is overdue
  actionsLate: number;      // overdue open actions in the leader's projects
}

// One row per project leader (by account, else by name). On-time rate counts only steps that had a
// planned date — without a plan there is nothing to be on time for.
export function leaderPerformance(projects: KaizenCard[], todayIso: string): LeaderRow[] {
  const rows = new Map<string, LeaderRow & { lateDaysSum: number; lateCount: number }>();
  for (const k of projects) {
    if (k.holdState === "cancelled") continue;
    const name = k.projectLeader || k.originator || "Lider atanmamış";
    const key = k.projectLeaderId || `name:${personKey(name)}`;
    const r = rows.get(key) || { key, name: name.replace(/\s*\([^)]*\)\s*$/, ""), active: 0, closed: 0, stepsDone: 0, stepsOnTime: 0, avgLateDays: null, lateNow: 0, actionsLate: 0, lateDaysSum: 0, lateCount: 0 };
    if (isClosed(k)) r.closed++; else if (!k.holdState) r.active++;
    for (const d of Object.values(k.stageDates || {})) {
      if (!d?.planned || !d?.completed) continue;
      r.stepsDone++;
      const late = daysBetween(d.planned, d.completed);
      if (late <= 0) r.stepsOnTime++; else { r.lateDaysSum += late; r.lateCount++; }
    }
    const att = attentionFor(k, todayIso);
    if (att.some(a => a.kind === "stageLate" || a.kind === "projectLate")) r.lateNow++;
    if (isActive(k)) r.actionsLate += (k.tasks || []).filter((t: any) => t.deadline && t.deadline < todayIso && !isTaskFinished(t)).length;
    rows.set(key, r);
  }
  return Array.from(rows.values())
    .map(({ lateDaysSum, lateCount, ...r }) => ({ ...r, avgLateDays: lateCount ? Math.round(lateDaysSum / lateCount) : null }))
    .sort((a, b) => (b.active + b.closed) - (a.active + a.closed) || a.name.localeCompare(b.name, "tr"));
}

export const onTimePct = (r: LeaderRow) => r.stepsDone ? Math.round((r.stepsOnTime / r.stepsDone) * 100) : null;

// Projects per current A3 step (active only), plus on hold and closed.
export function stageDistribution(projects: KaizenCard[]) {
  const steps = CI_STEPS.map(st => ({ no: st.no, label: st.short, count: 0 }));
  let onHold = 0, closed = 0;
  for (const k of projects) {
    if (k.holdState === "cancelled") continue;
    if (isClosed(k)) closed++;
    else if (k.holdState) onHold++;
    else steps[stageOf(k) - 1].count++;
  }
  return { steps, onHold, closed };
}
