// Ported from a legacy Power Apps canvas app ("KaizenSuite", SharePoint lists Suggestion/Personel/
// Approval/SuggestionPhoto/KaizenBoard/Criteria/Evaluation) that ran an employee Kaizen-suggestion
// box for one plant: submit → team-leader approval → Kaizen Board evaluation/approval → tracked to
// completion. Field names below keep the source app's Turkish business vocabulary in comments so
// the mapping back to the original is traceable; English names are used for the actual fields to
// match this codebase's convention (see fiveSTypes.ts).
//
// Deliberate fixes vs. the legacy app (confirmed dead/broken in the source, not real behavior):
// - ISG/Çevre/Motivasyon flags are now real editable+persisted fields (legacy app captured them in
//   the UI but never saved them on create, and on edit showed them read-only and still unsaved).
// - Manager rejection now actually sets "Rejected" (legacy always wrote "First Approval" regardless
//   of approve/reject — a bug, not an intended two-outcomes-look-the-same design).
// - "Görev" (job title) is now actually saved (legacy captured it in the wizard and discarded it).
// - The submitter (`Personel` person field) is preserved on edit instead of being silently
//   reassigned to whoever last saved the record.
// - Server-side authorization is enforced (legacy had a commented-out team-leader restriction and
//   effectively let any authenticated user approve/reject any suggestion).
// - No SharePoint 2000-row batching workaround (`col10kRows`/`UID`) — Postgres has no such limit;
//   the record's own `id`/`createdAt` are sufficient.

export type ApprovalStatus =
  | "Pending"         // Bekliyor — awaiting team-leader (Manager) decision
  | "First Approval"  // Team leader approved — awaiting Kaizen Board evaluation
  | "Second Approval" // Kaizen Board approved
  | "Rejected"        // Team leader rejected
  | "Rejected 2nd";   // Kaizen Board rejected

export interface KaizenPersonnel {
  id: string;
  employeeNo?: string;       // Sicil no — unique per customer; required since Faz 3.1 (older records may lack it)
  managerId?: string;        // direct supervisor's personnel id (Faz 3.1); older records link via teamLeaderEmail
  name: string;              // Ad Soyad
  email: string;             // kişinin kendi e-postası — used to match the logged-in user
  department: string;        // Bölüm
  jobTitle: string;          // Görev
  shift: string;              // Vardiya
  teamLeaderName: string;     // Amir / Takım Lideri
  teamLeaderEmail: string;
  machineLeaderName: string;  // Makine Lideri
  machineLeaderEmail: string;
  isBoardMember: boolean;     // KaizenBoard üyesi — evaluator + Rapor access
  isBoardAdmin?: boolean;     // Kurul Yöneticisi (Faz 3.3) — Kaizen admin of this customer; staff-granted only
  hasPin?: boolean;           // Faz 3.5 — server-computed; the PIN itself never reaches the client
  pinCodeActive?: boolean;    // an unused first-login / reset code is outstanding
}

export interface KaizenSuggestionPhoto {
  dataUrl: string; // base64 data URL
  caption?: string;
}

export interface KaizenSuggestion {
  id: string;
  authorEmail: string;   // logged-in submitter (Personel person field) — preserved across edits
  authorName: string;
  personnelId?: string;          // roster record the suggestion is about (Faz 3.1)
  authorPersonnelId?: string;    // submitter's roster record (Faz 3.5)
  teamLeaderId?: string;         // 1st-degree supervisor's roster record (Faz 3.5; supervisors without e-mail)
  personnelEmployeeNo?: string;  // its sicil no at submit time

  personnelName: string;        // Ad Soyad — who the suggestion is about (may be a subordinate)
  personnelDepartment: string;  // Bölüm
  personnelJobTitle: string;    // Görev
  shift: string;                 // Vardiya
  teamLeaderName: string;        // Amir
  teamLeaderEmail: string;
  machineLeaderName: string;
  machineLeaderEmail: string;

  subject: string;                 // Öneri Konusu
  suggestionTypes: string[];       // Öneri Sınıfı (multi-choice)
  currentState: string;            // Mevcut Durum
  improvementSuggestion: string;   // Önerilen İyileştirme
  stage: string;                   // Öneri Aşaması — PDCA cycle stage (Plan/Do/Check/Action)
  paybackPeriod: string;           // Kazanç Süresi — how the saving recurs (Parça Başı/Senelik/Bir Sefer)

  estimatedSaving: number;
  estimatedSavingCurrency: string;
  estimatedCost: number;
  estimatedCostCurrency: string;

  isg: boolean;         // İş Sağlığı ve Güvenliği
  cevre: boolean;        // Çevre
  motivasyon: boolean;   // Motivasyon

  // Photos are only on the full record (GET suggestions/:id); list responses omit them and carry
  // photoCounts instead (Faz 3.4). Never save a record whose photos were not loaded.
  photosCurrent?: KaizenSuggestionPhoto[]; // Mevcut Durum görselleri
  photosPropose?: KaizenSuggestionPhoto[]; // Öneri görselleri
  photoCounts?: Record<string, number>;

  approvalStatus: ApprovalStatus;
  requiredStages?: ("Manager" | "Board")[]; // Faz 2-B.3 snapshot at submit; missing = both stages
  completed: boolean; // Uygulandı — set once the approved improvement is actually implemented

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// One row per Manager or Board decision (legacy Approval list) — an audit trail, not a live state.
export interface KaizenApproval {
  id: string;
  suggestionId: string;
  stage: "Manager" | "Board";
  approverName: string;
  approverEmail: string;
  approved: boolean;
  comment: string;
  createdAt: string;
}

// Scoring rubric row (legacy Criteria list) — admin-managed. Confirmed against the live app's
// "Ayarlar" popup: a 5-tier letter-grade rubric (D/C/B/A/A+) banded by estimated income, e.g.
// D=5pt (0-50.000), C=10pt (50.000-250.000), B=15pt (250.000-1.000.000), A=20pt
// (1.000.000-5.000.000), A+=25pt (5.000.000+).
export interface KaizenCriteria {
  id: string;
  criteria: string;    // short label
  description: string;
  point: number;
  category: string;    // letter grade tier (D/C/B/A/A+ in the real rubric)
  minIncome: number;   // Min_Kazanc
  maxIncome: number;   // Max_Kazanc
}

export type RewardStatus = "Bekliyor" | "Ödendi";

// Kaizen Board's evaluation of one suggestion (legacy Evaluation list) — created together with the
// Board's approve/reject decision, not a separate step.
//
// yokotenImplemented and rewardStatus are additions beyond the legacy app — the source captured a
// Yokoten (horizontal-deployment) flag and a score but never surfaced either anywhere as an actual
// tracked follow-up: there was no view of "which approved ideas are candidates to roll out
// elsewhere" and no record of whether the resulting point/kazanç ever turned into a paid reward.
// Both are standard parts of a real Kaizen program (see KaizenSuggestionSystem's "Yokoten Takibi"
// and "Ödül Takibi" tabs), not just a scored-and-forgotten evaluation record.
export interface KaizenEvaluation {
  id: string;
  suggestionId: string;
  criteriaId: string;
  criteriaLabel: string; // snapshot of Criteria.criteria at scoring time
  point: number;          // snapshot of Criteria.point at scoring time
  yokoten: boolean;        // Lean term: can this improvement be spread to other areas?
  yokotenDescription: string;
  yokotenImplemented: boolean; // has this been rolled out to other areas yet?
  estimatedIncome: number;
  estimatedIncomeCurrency: string;
  rewardStatus: RewardStatus;  // has the earned point/kazanç actually been paid out to the employee?
  rewardAmount?: number;       // Faz 2-B: point × customer's rewardPerPoint, snapshotted at approval/payment
  rewardCurrency?: string;
  comment: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------------------------
// Uygulama takibi (Faz 2-A). One record per Board-approved suggestion: who implements it, by when,
// the action checklist, before/after measurement + photos, the actual (not estimated) saving and
// the Board's verification of it, and the 30/90-day "still in place?" persistence checks.
// ---------------------------------------------------------------------------------------------
export type ImplementationStatus = "Planlandı" | "Sürüyor" | "Tamamlandı" | "İptal";

export interface KaizenAction {
  id: string;
  text: string;
  done: boolean;
  dueDate: string; // YYYY-MM-DD or ""
}

export interface KaizenMetric {
  label: string;        // e.g. "Çevrim süresi"
  value: number | null;
  unit: string;         // e.g. "sn", "adet/saat", "%"
}

export interface KaizenFollowUp {
  days: number;       // 30/90 by default; per customer via kaizen_settings.followUpDays
  dueDate: string;
  result: "" | "Sürüyor" | "Bozuldu";
  checkedAt: string;
  checkedBy: string;
  note: string;
}

export interface KaizenVerification {
  status: "Bekliyor" | "Doğrulandı" | "Reddedildi";
  by: string;
  at: string;
  note: string;
}

export interface KaizenImplementation {
  id: string;
  suggestionId: string;
  factory_id?: string;
  ownerName: string;
  ownerEmail: string;
  targetDate: string;
  status: ImplementationStatus;
  actions: KaizenAction[];
  beforeMetric: KaizenMetric;
  afterMetric: KaizenMetric;
  photosBefore?: KaizenSuggestionPhoto[]; // full record only, see KaizenSuggestion.photosCurrent
  photosAfter?: KaizenSuggestionPhoto[];
  photoCounts?: Record<string, number>;
  actualSaving: number;
  actualSavingCurrency: string;
  note: string;
  benefitDescription?: string;               // "Getiri açıklaması" on the one-pager
  benefits?: Record<string, string>;         // CI Önce/Sonra form: Maliyet / Verimlilik / Kalite / Güvenlik details
  startedAt: string;
  completedAt: string;
  verification: KaizenVerification;
  followUps: KaizenFollowUp[];
  createdAt: string;
  updatedAt: string;
}
