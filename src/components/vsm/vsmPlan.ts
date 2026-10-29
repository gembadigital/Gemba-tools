// VSM implementation plan (plan step V6): the kaizen bursts of the future state are the plan items,
// grouped by loop (pacemaker, additional, supplier, customer). Each can be sent to the Master Plan as
// one activity row (id vsm_plan_<project>_<burst>, related module "VSM Projects"); fields edited in the
// Master Plan itself are kept on re-send. Pure functions.
import { isoWeekOf } from "../../utils/ciPlan.js";
import type { VsmKaizenBurst } from "./vsmTypes.js";

export const vsmPlanRowId = (projectId: string, burstId: string) => `vsm_plan_${projectId}_${burstId}`;

export function burstPlanStatus(b: VsmKaizenBurst, todayIso = new Date().toISOString().slice(0, 10)): "Completed" | "Delayed" | "In Progress" | "Planned" {
  if (b.status === "Tamamlandı") return "Completed";
  if (b.dueDate && b.dueDate < todayIso) return "Delayed";
  return b.status === "Devam ediyor" || (b.progress ?? 0) > 0 ? "In Progress" : "Planned";
}

export const burstProgress = (b: VsmKaizenBurst) => (b.status === "Tamamlandı" ? 100 : Math.max(0, Math.min(100, b.progress ?? 0)));

export function vsmMasterPlanRow(projectId: string, projectName: string, b: VsmKaizenBurst, index: number, existing?: any, today = new Date()) {
  const todayIso = today.toISOString().slice(0, 10);
  const startIso = b.startDate || todayIso;
  const endIso = b.dueDate && b.dueDate >= startIso ? b.dueDate : startIso;
  const start = isoWeekOf(startIso), end = isoWeekOf(endIso);
  const finishWeek = start && end ? (end.year > start.year ? 52 : Math.max(end.week, start.week)) : undefined;
  const owner = b.owner || existing?.owner || "VSM ekibi";
  return {
    ...(existing || {}),
    id: vsmPlanRowId(projectId, b.id),
    name: `[VSM K${index + 1}] ${b.title}`,
    owner,
    responsibleConsultant: existing?.responsibleConsultant || owner,
    startDate: startIso.slice(0, 7),
    endDate: endIso.slice(0, 7),
    plannedStartWeek: start?.week,
    plannedFinishWeek: finishWeek,
    category: existing?.category || "VSM",
    relatedModule: "VSM Projects",
    linkedItemId: projectId,
    plannedManDays: existing?.plannedManDays ?? 0,
    progressPercent: burstProgress(b),
    status: burstPlanStatus(b, todayIso),
    priority: existing?.priority || (b.loop === "Pacemaker döngüsü" ? "High" : "Medium"),
    notes: existing?.notes || [projectName, b.loop, b.target, b.description].filter(Boolean).join(" · ")
  };
}

// Bursts grouped by loop in the standard order; bursts without a loop come last.
export function groupByLoop(bursts: VsmKaizenBurst[], loops: string[]): { loop: string; items: { burst: VsmKaizenBurst; no: number }[] }[] {
  const numbered = bursts.map((burst, i) => ({ burst, no: i + 1 }));
  const groups = loops.map(loop => ({ loop, items: numbered.filter(x => x.burst.loop === loop) }));
  const rest = numbered.filter(x => !x.burst.loop || !loops.includes(x.burst.loop));
  return [...groups, { loop: "Döngü seçilmedi", items: rest }].filter(g => g.items.length > 0);
}
