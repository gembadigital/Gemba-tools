// CI project ↔ plan helpers (plan step C3): task progress, project progress / status for the Master
// Plan, ISO weeks, and the Master Plan row of a project. Used by both the CI module (writes the row)
// and MasterPlanGantt (keeps linked rows' progress current), so both sides compute the same values.
// Dependency-free.
import { CiProjectLike, isClosed, stageOf, taskStatusOf, CI_LAST_STAGE } from "./ciLifecycle.js";

// Progress of one action, 0–100. Done (status, or 100% on older actions) = 100; cancelled →
// excluded by callers; otherwise the stored percentage, with "Devam Ediyor" never shown as 0 (older
// actions stored only the status).
export function taskProgress(t: any): number {
  const status = taskStatusOf(t);
  if (status === "Yapıldı") return 100;
  const pct = Math.max(0, Math.min(99, Math.round(Number(t?.progressPercent) || 0)));
  return status === "Devam Ediyor" && pct === 0 ? 50 : pct;
}

// Project progress, 0–100: closed → 100; with actions → average of the non-cancelled actions'
// progress; without actions → share of the A3 steps already finished.
export function ciProjectProgress(p: CiProjectLike): number {
  if (isClosed(p)) return 100;
  const tasks = (Array.isArray(p.tasks) ? p.tasks : []).filter(t => taskStatusOf(t) !== "İptal");
  if (tasks.length) return Math.round(tasks.reduce((s, t) => s + taskProgress(t), 0) / tasks.length);
  return Math.round(((stageOf(p) - 1) / CI_LAST_STAGE) * 100);
}

export type PlanStatus = "Planned" | "In Progress" | "Completed" | "Delayed";

export function ciPlanStatus(p: CiProjectLike & { plannedFinishDate?: string }, today = new Date()): PlanStatus {
  if (isClosed(p)) return "Completed";
  const todayIso = today.toISOString().split("T")[0];
  if (p.plannedFinishDate && p.plannedFinishDate < todayIso) return "Delayed";
  return stageOf(p) > 1 || ciProjectProgress(p) > 0 ? "In Progress" : "Planned";
}

// ISO-8601 week of a YYYY-MM-DD date (week 1 contains the year's first Thursday).
export function isoWeekOf(iso?: string): { week: number; year: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7), year: d.getUTCFullYear() };
}

export const masterPlanRowId = (projectId: string) => `gantt_sync_${projectId}`;

// The Master Plan row of a CI project. Structural fields come from the project (name, weeks,
// leader, link, progress); fields people edit in the Master Plan itself (activity no, phase, parent,
// actual weeks, man-days…) are kept from the existing row. A CI row counts 0 planned man-days unless
// someone enters a value there — previously every CI row silently added the Master Plan default of 5.
export function ciMasterPlanRow(p: CiProjectLike & {
  id: string; title?: string; dateProposed?: string; plannedFinishDate?: string; projectLeader?: string;
  originator?: string; impactLevel?: string; description?: string; problemDefinition?: string; descriptionBefore?: string;
}, existing?: any, today = new Date()) {
  const startIso = p.dateProposed || today.toISOString().split("T")[0];
  const endIso = p.plannedFinishDate && p.plannedFinishDate >= startIso ? p.plannedFinishDate : startIso;
  const start = isoWeekOf(startIso);
  const end = isoWeekOf(endIso);
  // The Master Plan resolves weeks within one year; a project crossing New Year ends at week 52 of
  // its start year rather than wrapping to an earlier week.
  const finishWeek = start && end ? (end.year > start.year ? 52 : Math.max(end.week, start.week)) : undefined;
  const leader = p.projectLeader || p.originator || "CI Ekibi";
  return {
    ...(existing || {}),
    id: masterPlanRowId(p.id),
    name: `[CI] ${p.title || "Adsız proje"}`,
    owner: leader,
    responsibleConsultant: leader,
    startDate: startIso.slice(0, 7),
    endDate: endIso.slice(0, 7),
    plannedStartWeek: start?.week,
    plannedFinishWeek: finishWeek,
    category: existing?.category || "Kaizen",
    relatedModule: "Kaizen Projects",
    linkedItemId: p.id,
    plannedManDays: existing?.plannedManDays ?? 0,
    progressPercent: ciProjectProgress(p),
    status: ciPlanStatus(p, today),
    priority: p.impactLevel || existing?.priority || "Medium",
    notes: existing?.notes || p.description || p.problemDefinition || p.descriptionBefore || "CI projesi"
  };
}
