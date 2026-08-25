// Shared display/option helpers for the Kaizen Suggestions module. Option lists below are the
// port's own reasonable defaults (see kaizenTypes.ts) — the source app's SharePoint choice columns
// are populated live from the list and their exact values aren't recoverable from the .msapp
// package; these are edited the same way the 5S module's DIFFICULTY_LEVEL_OPTIONS/etc. are —
// hardcoded constants, not admin-configurable choice lists.
import { ApprovalStatus } from "./kaizenTypes";

export const SUGGESTION_TYPE_OPTIONS = [
  "Kalite", "Verimlilik", "İş Güvenliği", "Maliyet", "Çevre", "Ergonomi", "5S", "Diğer"
] as const;

export const STAGE_OPTIONS = ["Fikir Aşaması", "Planlandı", "Uygulamada", "Uygulandı"] as const;

export const PAYBACK_PERIOD_OPTIONS = ["0-3 Ay", "3-6 Ay", "6-12 Ay", "12+ Ay"] as const;

export const CURRENCY_OPTIONS = ["TL", "USD", "EUR"] as const;

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
