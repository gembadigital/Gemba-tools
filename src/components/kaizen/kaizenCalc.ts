// Shared display/option helpers for the Kaizen Suggestions module. Option lists below are the
// REAL choice values confirmed directly against the live KaizenSuite app in Power Apps Studio
// (its SharePoint choice columns aren't recoverable from the .msapp package alone — this app's
// live "Yeni Öneri" wizard and Criteria/Ayarlar screen were checked directly to get these exact
// values, replacing an earlier best-guess version of this file).
import { ApprovalStatus } from "./kaizenTypes";

// Öneri Sınıfı (Suggestion.SuggestionType) — confirmed exact values from the live app's picker.
export const SUGGESTION_TYPE_OPTIONS = [
  "Maliyet Azaltma", "Kalite", "ISG", "5S", "Verimlilik", "Enerji"
] as const;

// Öneri Aşaması (Suggestion.Status) — this is the PDCA improvement-cycle stage, not a maturity
// label like "planned/in progress" — confirmed from the live picker.
export const STAGE_OPTIONS = ["Plan (Planlama)", "Do (Yap)", "Check (Kontrol)", "Action (Önlem Al)"] as const;

// Kazanç Süresi (Suggestion.Time) — this describes how the estimated saving RECURS (per unit
// produced, once a year, or a one-off), not a payback-period window — confirmed from the live
// picker (an earlier version of this file wrongly modeled it as a payback window like "0-3 Ay").
export const PAYBACK_PERIOD_OPTIONS = ["Parça Başı", "Senelik", "Bir Sefer"] as const;

// Estimated_Saving_Currency / Estimated_Cost_Currency — confirmed from the live picker; "Eş Değer
// Ürün" (in-kind/equivalent product) is a real 4th option alongside actual currencies.
export const CURRENCY_OPTIONS = ["TL", "USD", "EUR", "Eş Değer Ürün"] as const;

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  "Pending": "Onay Bekliyor",
  "First Approval": "Amir Onayladı",
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
export function canDecideAsManager(userEmail: string, userRole: string, teamLeaderEmail: string): boolean {
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
