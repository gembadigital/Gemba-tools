// Shared display/option helpers for the Kaizen Suggestions module. Option lists below are the
// REAL choice values confirmed directly against the live KaizenSuite app in Power Apps Studio
// (its SharePoint choice columns aren't recoverable from the .msapp package alone — this app's
// live "Yeni Öneri" wizard and Criteria/Ayarlar screen were checked directly to get these exact
// values, replacing an earlier best-guess version of this file).
import { ApprovalStatus, ImplementationStatus, KaizenImplementation } from "./kaizenTypes";
import { stagesOf, toBaseCurrency, KaizenSettings } from "../../utils/kaizenSettings";
import type { KaizenSuggestion, KaizenEvaluation } from "./kaizenTypes";

// Öneri Sınıfı / Öneri Aşaması (PDCA) / Kazanç Süresi choices are per customer since Faz 2-B —
// see DEFAULT_KAIZEN_SETTINGS in src/utils/kaizenSettings.ts for the legacy-confirmed defaults.
// "Kazanç Süresi" describes how the saving RECURS (per unit / yearly / one-off), not a payback window.
// Currencies likewise (KNOWN_CURRENCIES there; "Eş Değer Ürün" = in-kind saving).

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  "Pending": "Onay Bekliyor",
  // Since Faz 2-B.3 this also means "sent straight to the Kurul" (no Amir stage), so the label
  // names the waiting stage rather than the Amir's decision.
  "First Approval": "Kurul Bekliyor",
  "Second Approval": "Kurul Onayladı",
  "Rejected": "Amir Reddetti",
  "Rejected 2nd": "Kurul Reddetti"
};

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
  "Pending": "#facc15",
  "First Approval": "#3b82f6",
  "Second Approval": "#00A280",
  "Rejected": "#ef4444",
  "Rejected 2nd": "#ef4444"
};

// Per-record label: an approval that needed no Kurul (below the customer's Kurul threshold) must not
// read as "Kurul Onayladı".
export function statusLabel(status: ApprovalStatus, requiredStages?: unknown, inFeasibility?: boolean): string {
  if (status === "First Approval" && inFeasibility) return "Fizibilitede";
  if (status === "Second Approval" && !stagesOf({ requiredStages }).includes("Board")) return "Amir Onayladı";
  return APPROVAL_STATUS_LABELS[status] || status;
}

export function isRejected(status: ApprovalStatus): boolean {
  return status === "Rejected" || status === "Rejected 2nd";
}

// Matches the legacy MySuggestions edit-gating: only rejected suggestions can be resubmitted.
export function canEditSuggestion(status: ApprovalStatus): boolean {
  return isRejected(status);
}

// Manager (team-leader) decision stage — the assigned team leader for this suggestion, or an org
// Admin/Consultant. Replaces the legacy app's commented-out (i.e. never actually enforced)
// P_TeamLeader_Mail restriction with a real server-side-checkable rule.
// teamLeaderId / myPersonnelId (Faz 3.5): supervisors signed in with sicil no may have no e-mail.
export function canDecideAsManager(userEmail: string, userRole: string, teamLeaderEmail: string, teamLeaderId?: string, myPersonnelId?: string): boolean {
  if (teamLeaderId && myPersonnelId && teamLeaderId === myPersonnelId) return true;
  if (userRole === "Admin" || userRole === "Consultant") return true;
  return !!teamLeaderEmail && teamLeaderEmail.toLowerCase() === userEmail.toLowerCase();
}

// Kaizen Board decision stage — membership in the KaizenBoard roster (or org Admin/Consultant).
export function canDecideAsBoard(userEmail: string, userRole: string, isBoardMember: boolean): boolean {
  if (userRole === "Admin" || userRole === "Consultant") return true;
  return isBoardMember;
}

// SLA / bekleme süresi — a queue item's age in whole days since it entered its current stage.
// Neither the legacy app nor the first cut of this port surfaced this anywhere, so a suggestion
// could sit unreviewed indefinitely with no visual cue.
export function daysWaiting(since: string): number {
  const then = new Date(since).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000)));
}

// Waiting-time severity used to color-code approval queues: 7+ days = overdue (red), 3-6 = warning
// (amber), else normal.
export function waitingSeverity(days: number): "normal" | "warning" | "overdue" {
  if (days >= 7) return "overdue";
  if (days >= 3) return "warning";
  return "normal";
}

export const WAITING_SEVERITY_COLORS: Record<ReturnType<typeof waitingSeverity>, string> = {
  normal: "#64748b",
  warning: "#f59e0b",
  overdue: "#ef4444"
};

// ---- Uygulama takibi (Faz 2-A) ----

export const IMPLEMENTATION_STATUSES: ImplementationStatus[] = ["Planlandı", "Sürüyor", "Tamamlandı", "İptal"];

export const IMPLEMENTATION_STATUS_COLORS: Record<ImplementationStatus, string> = {
  "Planlandı": "#64748b",
  "Sürüyor": "#3b82f6",
  "Tamamlandı": "#00A280",
  "İptal": "#ef4444"
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Past its target date and neither finished nor cancelled.
export function isImplementationOverdue(impl?: Pick<KaizenImplementation, "status" | "targetDate">): boolean {
  if (!impl || !impl.targetDate) return false;
  if (impl.status === "Tamamlandı" || impl.status === "İptal") return false;
  return impl.targetDate < todayIso();
}

export function actionProgress(impl?: Pick<KaizenImplementation, "actions">): { done: number; total: number } {
  const actions = impl?.actions || [];
  return { done: actions.filter(a => a.done).length, total: actions.length };
}

// A 30/90-day persistence check that is due (or overdue) and not yet answered.
export function pendingFollowUps(impl?: Pick<KaizenImplementation, "followUps" | "status">) {
  if (!impl || impl.status !== "Tamamlandı") return [];
  const today = todayIso();
  return (impl.followUps || []).filter(f => !f.result && f.dueDate <= today);
}

export function percentChange(before: number | null, after: number | null): number | null {
  if (before === null || after === null || before === 0) return null;
  return ((after - before) / Math.abs(before)) * 100;
}

// ---- Süreç adımları (journey) ----
// The stages a suggestion goes through, as shown to people: only the stages it was routed through
// when submitted (Faz 2-B.3), then implementation. Shared by Home, Önerilerim and the detail drawer.
export type StepState = "done" | "current" | "todo" | "rejected";

export function journeyOf(s: KaizenSuggestion): { key: string; label: string; state: StepState }[] {
  const st = s.approvalStatus;
  const managerState: StepState = st === "Rejected" ? "rejected" : st === "Pending" ? "current" : "done";
  const boardState: StepState = st === "Rejected 2nd" ? "rejected" : st === "Second Approval" ? "done" : st === "First Approval" ? "current" : "todo";
  const implState: StepState = s.completed ? "done" : st === "Second Approval" ? "current" : "todo";
  const stages = stagesOf(s);
  return [
    { key: "sent", label: "Gönderildi", state: "done" },
    ...(stages.includes("Manager") ? [{ key: "manager", label: "Amir Onayı", state: managerState }] : []),
    ...(stages.includes("Board") ? [{ key: "board", label: st === "First Approval" && s.feasibility?.status === "open" ? "Kurul · fizibilite" : "Kurul Değerlendirmesi", state: st === "Rejected" ? "todo" as StepState : boardState }] : []),
    { key: "impl", label: "Uygulama", state: implState }
  ];
}

// Feasibility study past its due date and still open.
export const feasibilityOverdue = (s: Pick<KaizenSuggestion, "feasibility">) =>
  s.feasibility?.status === "open" && !!s.feasibility.dueDate && s.feasibility.dueDate < todayIso();

// ---- Fırsat havuzu (Faz 4.5) ----
// Accepted suggestions that are not implemented yet are unrealised savings. Each is valued at the
// Kurul-approved income (else the suggestion's own estimate, annual for per-piece) in the base
// currency and aged from its acceptance date. Not convertible amounts are counted, not summed.
export type PoolStage = "noplan" | "planned" | "active";
export type PoolBucket = "0-30" | "31-90" | "90+";
export interface PoolItem { suggestion: KaizenSuggestion; value: number | null; ageDays: number; bucket: PoolBucket; stage: PoolStage }

export function opportunityPool(
  suggestions: KaizenSuggestion[],
  evaluations: KaizenEvaluation[],
  implementations: Pick<KaizenImplementation, "suggestionId" | "status">[],
  settings: KaizenSettings,
  now = Date.now()
) {
  const evalBy = new Map(evaluations.map(e => [e.suggestionId, e]));
  const implBy = new Map(implementations.map(i => [i.suggestionId, i]));
  const items: PoolItem[] = [];
  for (const s of suggestions) {
    if (s.approvalStatus !== "Second Approval" || s.completed) continue;
    const impl = implBy.get(s.id);
    if (impl && (impl.status === "Tamamlandı" || impl.status === "İptal")) continue;
    const e = evalBy.get(s.id);
    const value = e && e.estimatedIncome
      ? toBaseCurrency(e.estimatedIncome, e.estimatedIncomeCurrency, settings)
      : toBaseCurrency(s.estimatedSaving || 0, s.estimatedSavingCurrency, settings);
    const since = Date.parse(e?.createdAt || s.updatedAt || s.createdAt || "") || now;
    const ageDays = Math.max(0, Math.floor((now - since) / 86_400_000));
    items.push({
      suggestion: s, value, ageDays,
      bucket: ageDays <= 30 ? "0-30" : ageDays <= 90 ? "31-90" : "90+",
      stage: !impl ? "noplan" : impl.status === "Sürüyor" ? "active" : "planned"
    });
  }
  items.sort((a, b) => b.ageDays - a.ageDays);
  const sum = (list: PoolItem[]) => list.reduce((t, i) => t + (i.value ?? 0), 0);
  const buckets = (["0-30", "31-90", "90+"] as PoolBucket[]).map(b => {
    const list = items.filter(i => i.bucket === b);
    return { bucket: b, count: list.length, value: sum(list) };
  });
  return { items, total: sum(items), count: items.length, unconverted: items.filter(i => i.value === null).length, buckets };
}
