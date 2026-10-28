// CI Proje Yönetimi — 8-step A3 lifecycle and access rules (plan step C2). Shared by the client and
// the server (server imports it as "../../utils/ciLifecycle.js"), so keep it dependency-free.
//
// Model (decided with the user, 2026-10-28):
// - Toyota 8 steps (A3). A project works on one step at a time (`stage` 1–8). Finishing a step needs
//   that step's requirements and the approval of the project leader; then the next step opens.
//   Finishing step 8 closes the project.
// - Approver = the project leader (a user account). A project whose leader has no account (older
//   projects stored only a name) is approved by Admin / Consultant instead.
// - Customer users see and edit only projects they lead or are a member of; they never delete a
//   project. Admin / Consultant see and edit everything.
// - Gains: the system reports the entered realized gain, a consultant (Admin / Consultant) confirms
//   it, and the leader approves step 7 with the confirmed figure.
//
// `status`, `kanbanStatus` and `progressStep` are kept as derived copies (written by the server
// whenever the stage changes) so dashboards, Master Plan sync and exports keep working unchanged.

export const CI_STEPS = [
  { no: 1, title: "Problemi Netleştir", short: "Problem", pdca: "PLAN", hint: "Problem, kapsam, kayıp boyutu ve ekip." },
  { no: 2, title: "Problemi Parçala", short: "Mevcut Durum", pdca: "PLAN", hint: "Veri ve gemba gözlemiyle mevcut durum; öncelikli alt problem." },
  { no: 3, title: "Hedef Belirle", short: "Hedef", pdca: "PLAN", hint: "KPI, başlangıç değeri, hedef değer, hedef tarih ve beklenen kazanç." },
  { no: 4, title: "Kök Neden Analizi", short: "Kök Neden", pdca: "PLAN", hint: "5 Neden ile kök neden." },
  { no: 5, title: "Karşı Önlemleri Planla", short: "Aksiyon Planı", pdca: "PLAN", hint: "Aksiyonlar, sorumlular ve terminler." },
  { no: 6, title: "Uygula", short: "Uygulama", pdca: "DO", hint: "Aksiyonların takibi ve önce-sonra kayıtları." },
  { no: 7, title: "Sonuçları Değerlendir", short: "Kontrol", pdca: "CHECK", hint: "KPI ölçümleri, hedefe ulaşıldı mı, gerçekleşen kazanç ve teyidi." },
  { no: 8, title: "Standartlaştır ve Kapat", short: "Standart & Kapanış", pdca: "ACT", hint: "Standart iş, eğitim, yaygınlaştırma, öğrenilen dersler, sonuç." }
] as const;

export const CI_LAST_STAGE = CI_STEPS.length;

export type CiPdca = "PLAN" | "DO" | "CHECK" | "ACT";

export interface CiKpiMeasurement { id: string; date: string; value: number; note?: string }

export interface CiKpi {
  name: string;
  unit: string;
  direction: "decrease" | "increase"; // which way is better
  baseline: number | null;
  target: number | null;
  measurements: CiKpiMeasurement[];
}

export interface CiStageDate {
  planned?: string;     // planned completion date of the step
  completed?: string;   // date the leader approved the step
  approvedBy?: string;
  approvedById?: string;
}

export interface CiHistoryEntry {
  at: string;
  by: string;      // display name
  byId?: string;
  action: string;  // human readable, Turkish
  note?: string;
}

export interface CiPendingApproval { stage: number; by: string; byId?: string; at: string }

export type CiHoldState = "onHold" | "cancelled";

// The subset of a CI project this module reads. Everything is optional: older records predate C2.
export interface CiProjectLike {
  id?: string;
  title?: string;
  status?: string;
  kanbanStatus?: string;
  progressStep?: string;
  stage?: number;
  closedAt?: string | null;
  holdState?: CiHoldState | null;
  pendingApproval?: CiPendingApproval | null;
  stageDates?: Record<string, CiStageDate>;
  kpi?: CiKpi;
  targetKpi?: string;
  projectLeader?: string;
  projectLeaderId?: string;
  projectTeam?: string[];
  projectTeamIds?: string[];
  originator?: string;
  problemDefinition?: string;
  descriptionBefore?: string;
  problemDetail?: string;
  currentLoss?: number;
  plannedFinishDate?: string;
  rootCause?: string;
  rootCauseWhys?: string[];
  tasks?: any[];
  kpiTargetMet?: boolean | null;
  realizedGain?: number;
  actualSavings?: number;
  gainConfirmedAt?: string | null;
  stdWorkUpdated?: boolean;
  instructionRevised?: boolean;
  trainingGiven?: boolean;
  controlPlanUpdated?: boolean;
  auditListUpdated?: boolean;
  projectResult?: string;
  resultDescription?: string;
  history?: CiHistoryEntry[];
}

export interface CiUserLike { id?: string; role?: string; full_name?: string; email?: string }

// ---------- stage ----------

// Older projects: the 7-step progressStep of the old detail form, else the kanban column.
const LEGACY_STEP_TO_STAGE: Record<string, number> = {
  "Tanımlama": 1, "Analiz": 4, "Planlama": 5, "Uygulama": 6, "Kontrol": 7, "Standardizasyon": 8, "Kapatıldı": 8
};
const KANBAN_TO_STAGE: Record<string, number> = { PLAN: 1, DO: 6, CHECK: 7, ACT: 8 };

export function stageOf(p: CiProjectLike): number {
  const s = Number(p.stage);
  if (Number.isInteger(s) && s >= 1 && s <= CI_LAST_STAGE) return s;
  if (p.progressStep && LEGACY_STEP_TO_STAGE[p.progressStep]) return LEGACY_STEP_TO_STAGE[p.progressStep];
  if (p.kanbanStatus && KANBAN_TO_STAGE[p.kanbanStatus]) return KANBAN_TO_STAGE[p.kanbanStatus];
  return 1;
}

export function isClosed(p: CiProjectLike): boolean {
  if (p.stage !== undefined && p.stage !== null) return !!p.closedAt;
  return p.status === "Completed" || p.progressStep === "Kapatıldı";
}

export const pdcaOfStage = (stage: number): CiPdca => CI_STEPS[Math.min(Math.max(stage, 1), CI_LAST_STAGE) - 1].pdca;

// Derived legacy fields, written alongside every stage change.
export function derivedStatusFields(stage: number, closed: boolean, hold: CiHoldState | null | undefined) {
  const status = hold === "cancelled" ? "Cancelled" : hold === "onHold" ? "On Hold"
    : closed ? "Completed" : stage <= 1 ? "Draft" : stage <= 3 ? "Approved" : "In Progress";
  return {
    status,
    kanbanStatus: pdcaOfStage(stage),
    progressStep: closed ? "Kapatıldı" : CI_STEPS[stage - 1].short
  };
}

// ---------- KPI ----------

export function kpiOf(p: CiProjectLike): CiKpi {
  const k = p.kpi;
  return {
    name: k?.name ?? p.targetKpi ?? "",
    unit: k?.unit ?? "",
    direction: k?.direction === "increase" ? "increase" : "decrease",
    baseline: typeof k?.baseline === "number" ? k.baseline : null,
    target: typeof k?.target === "number" ? k.target : null,
    measurements: Array.isArray(k?.measurements) ? k!.measurements : []
  };
}

export function latestMeasurement(kpi: CiKpi): CiKpiMeasurement | null {
  if (!kpi.measurements.length) return null;
  return [...kpi.measurements].sort((a, b) => (a.date || "").localeCompare(b.date || "")).slice(-1)[0];
}

// Share of the planned improvement achieved by the latest measurement (0–100+), or null.
export function kpiProgressPct(kpi: CiKpi): number | null {
  const last = latestMeasurement(kpi);
  if (!last || kpi.baseline === null || kpi.target === null || kpi.baseline === kpi.target) return null;
  return Math.round(((last.value - kpi.baseline) / (kpi.target - kpi.baseline)) * 100);
}

// ---------- tasks ----------

export const taskStatusOf = (t: any): "Açık" | "Devam Ediyor" | "Yapıldı" | "İptal" =>
  t?.status === "İptal" ? "İptal" : t?.status === "Yapıldı" || t?.progressPercent === 100 ? "Yapıldı"
    : t?.status === "Devam Ediyor" || (t?.progressPercent || 0) > 0 ? "Devam Ediyor" : "Açık";

export const isTaskFinished = (t: any) => ["Yapıldı", "İptal"].includes(taskStatusOf(t));

// ---------- requirements to finish a step ----------

const filled = (v: any) => typeof v === "string" ? v.trim().length > 0 : v !== undefined && v !== null;

export function rootCauseOf(p: CiProjectLike): string {
  const whys = (p.rootCauseWhys || []).map(w => (w || "").trim()).filter(Boolean);
  return (p.rootCause || "").trim() || whys[whys.length - 1] || "";
}

// Missing items (Turkish, user-facing) that block finishing `stage`; empty = ready.
export function stageRequirements(p: CiProjectLike, stage: number): string[] {
  const missing: string[] = [];
  const kpi = kpiOf(p);
  const tasks = Array.isArray(p.tasks) ? p.tasks : [];
  switch (stage) {
    case 1:
      if (!filled(p.title)) missing.push("Proje adı");
      if (!filled(p.problemDefinition || p.descriptionBefore)) missing.push("Problem tanımı");
      if (!filled(p.projectLeaderId) && !filled(p.projectLeader)) missing.push("Proje lideri");
      if (!((Number(p.currentLoss) || 0) > 0) && kpi.baseline === null) missing.push("Kayıp boyutu (tutar) ya da KPI başlangıç değeri");
      break;
    case 2:
      if (!filled(p.problemDetail)) missing.push("Mevcut durum / problemin parçalanması");
      break;
    case 3:
      if (!filled(kpi.name)) missing.push("Hedef KPI");
      if (kpi.baseline === null) missing.push("KPI başlangıç değeri");
      if (kpi.target === null) missing.push("KPI hedef değeri");
      if (!filled(p.plannedFinishDate)) missing.push("Hedef tarih (planlanan bitiş)");
      break;
    case 4:
      if (!rootCauseOf(p)) missing.push("Kök neden (5 Neden ya da seçilen kök neden)");
      break;
    case 5:
      if (!tasks.length) missing.push("En az bir aksiyon");
      if (tasks.some(t => !filled(t.responsible) || !filled(t.deadline))) missing.push("Her aksiyonun sorumlusu ve termini");
      break;
    case 6:
      if (!tasks.length) missing.push("En az bir aksiyon");
      if (tasks.some(t => !isTaskFinished(t))) missing.push("Tüm aksiyonlar tamamlanmalı ya da iptal edilmeli");
      break;
    case 7:
      if (!kpi.measurements.length) missing.push("En az bir KPI ölçümü");
      if (p.kpiTargetMet !== true && p.kpiTargetMet !== false) missing.push("Hedefe ulaşıldı mı kararı");
      if (((Number(p.realizedGain ?? p.actualSavings) || 0) > 0) && !p.gainConfirmedAt) missing.push("Gerçekleşen kazancın danışman teyidi");
      break;
    case 8:
      if (!p.stdWorkUpdated && !p.instructionRevised && !p.controlPlanUpdated)
        missing.push("En az bir standartlaştırma (standart iş, talimat ya da kontrol planı)");
      if (!["Başarılı", "Revizyon Gerekli"].includes(p.projectResult || "")) missing.push("Proje sonucu (Başarılı / Revizyon Gerekli)");
      if (!filled(p.resultDescription)) missing.push("Sonuç açıklaması");
      break;
  }
  return missing;
}

// ---------- people and access ----------

// "Ayşe Kaya (Danışman)" → "ayşe kaya": names were stored with a role suffix by the old pickers.
export const personKey = (name?: string) => (name || "").replace(/\s*\([^)]*\)\s*$/, "").trim().toLocaleLowerCase("tr");

export const isCiStaffUser = (u: CiUserLike | null | undefined) => u?.role === "Admin" || u?.role === "Consultant";

export function isLeader(u: CiUserLike | null | undefined, p: CiProjectLike): boolean {
  if (!u) return false;
  if (p.projectLeaderId) return p.projectLeaderId === u.id;
  return !!u.full_name && personKey(p.projectLeader) === personKey(u.full_name);
}

export function isMember(u: CiUserLike | null | undefined, p: CiProjectLike): boolean {
  if (!u) return false;
  if (Array.isArray(p.projectTeamIds) && p.projectTeamIds.length) return !!u.id && p.projectTeamIds.includes(u.id);
  const me = personKey(u.full_name);
  return !!me && (p.projectTeam || []).some(n => personKey(n) === me);
}

export const canViewProject = (u: CiUserLike | null | undefined, p: CiProjectLike) =>
  isCiStaffUser(u) || isLeader(u, p) || isMember(u, p);

export const canEditProject = canViewProject;

// Leader with an account approves; without one (older projects), Admin / Consultant do.
export function canApproveStage(u: CiUserLike | null | undefined, p: CiProjectLike): boolean {
  if (!u) return false;
  if (p.projectLeaderId) return p.projectLeaderId === u.id || u.role === "Admin";
  return isCiStaffUser(u) || isLeader(u, p);
}

export const canManageHold = (u: CiUserLike | null | undefined, p: CiProjectLike) => isCiStaffUser(u) || isLeader(u, p);

// ---------- actions (applied by the server; pure so they can be tested) ----------

export type CiStageAction = "submit" | "approve" | "return" | "stepBack" | "reopen" | "hold" | "cancel" | "resume" | "confirmGain";

const today = (now: Date) => now.toISOString().split("T")[0];
const MAX_HISTORY = 300;

export function withHistory<T extends CiProjectLike>(p: T, entry: CiHistoryEntry): T {
  return { ...p, history: [...(p.history || []), entry].slice(-MAX_HISTORY) };
}

// Returns the updated project or an error (Turkish, user-facing). Only lifecycle fields change.
export function applyStageAction<T extends CiProjectLike>(
  project: T, action: CiStageAction, user: CiUserLike, now: Date, note?: string
): { project?: T; error?: string } {
  const stage = stageOf(project);
  const closed = isClosed(project);
  const who = user.full_name || user.email || "?";
  const at = now.toISOString();
  const cleanNote = (note || "").trim().slice(0, 1000) || undefined;
  // Older records get explicit lifecycle fields on their first action.
  let p: T = { ...project, stage, closedAt: closed ? (project.closedAt || at) : null };
  const finish = (next: T, actionText: string): { project: T } => {
    const s = stageOf(next);
    const derived = derivedStatusFields(s, isClosed(next), next.holdState);
    return { project: withHistory({ ...next, ...derived }, { at, by: who, byId: user.id, action: actionText, note: cleanNote }) };
  };

  const advance = (): { project?: T; error?: string } => {
    const missing = stageRequirements(p, stage);
    if (missing.length) return { error: `Adım ${stage} tamamlanamaz, eksikler: ${missing.join(", ")}.` };
    const stageDates = { ...(p.stageDates || {}) };
    stageDates[stage] = { ...(stageDates[stage] || {}), completed: today(now), approvedBy: who, approvedById: user.id };
    const next: T = stage >= CI_LAST_STAGE
      ? { ...p, stageDates, pendingApproval: null, closedAt: at }
      : { ...p, stageDates, pendingApproval: null, stage: stage + 1 };
    return finish(next, stage >= CI_LAST_STAGE
      ? `Adım ${stage} onaylandı — proje kapatıldı`
      : `Adım ${stage} (${CI_STEPS[stage - 1].title}) onaylandı → Adım ${stage + 1}`);
  };

  if (action !== "confirmGain" && action !== "resume" && project.holdState) {
    return { error: project.holdState === "cancelled" ? "Proje iptal edilmiş; önce yeniden başlatın." : "Proje askıda; önce devam ettirin." };
  }

  switch (action) {
    case "submit": {
      if (closed) return { error: "Proje kapalı." };
      if (!canEditProject(user, p)) return { error: "Bu projede değişiklik yetkiniz yok." };
      if (canApproveStage(user, p)) return advance();
      const missing = stageRequirements(p, stage);
      if (missing.length) return { error: `Adım ${stage} onaya gönderilemez, eksikler: ${missing.join(", ")}.` };
      return finish({ ...p, pendingApproval: { stage, by: who, byId: user.id, at } }, `Adım ${stage} proje liderinin onayına gönderildi`);
    }
    case "approve":
      if (closed) return { error: "Proje kapalı." };
      if (!canApproveStage(user, p)) return { error: "Adımı yalnızca proje lideri onaylayabilir." };
      return advance();
    case "return":
      if (!canApproveStage(user, p)) return { error: "Yalnızca proje lideri geri gönderebilir." };
      if (!p.pendingApproval) return { error: "Onay bekleyen bir adım yok." };
      return finish({ ...p, pendingApproval: null }, `Adım ${stage} onayı geri gönderildi`);
    case "stepBack": {
      if (!canApproveStage(user, p) && !isCiStaffUser(user)) return { error: "Önceki adıma yalnızca proje lideri ya da danışman dönebilir." };
      if (closed || stage <= 1) return { error: "Önceki adım yok." };
      const stageDates = { ...(p.stageDates || {}) };
      stageDates[stage - 1] = { ...(stageDates[stage - 1] || {}), completed: undefined, approvedBy: undefined, approvedById: undefined };
      return finish({ ...p, stage: stage - 1, stageDates, pendingApproval: null }, `Adım ${stage - 1}'e geri dönüldü`);
    }
    case "reopen":
      if (!closed) return { error: "Proje zaten açık." };
      if (!canApproveStage(user, p) && !isCiStaffUser(user)) return { error: "Projeyi yalnızca proje lideri ya da danışman yeniden açabilir." };
      return finish({ ...p, closedAt: null, stage: CI_LAST_STAGE }, "Proje yeniden açıldı (Adım 8)");
    case "hold":
    case "cancel":
      if (!canManageHold(user, p)) return { error: "Yalnızca proje lideri ya da danışman yapabilir." };
      if (closed) return { error: "Proje kapalı." };
      return finish({ ...p, holdState: action === "hold" ? "onHold" : "cancelled", pendingApproval: null },
        action === "hold" ? "Proje askıya alındı" : "Proje iptal edildi");
    case "resume":
      if (!canManageHold(user, p)) return { error: "Yalnızca proje lideri ya da danışman yapabilir." };
      if (!project.holdState) return { error: "Proje zaten devam ediyor." };
      return finish({ ...p, holdState: null }, "Proje devam ettirildi");
    case "confirmGain": {
      if (!isCiStaffUser(user)) return { error: "Gerçekleşen kazancı yalnızca danışman teyit eder." };
      const gain = Number((p as any).realizedGain ?? p.actualSavings) || 0;
      if (gain <= 0) return { error: "Teyit edilecek gerçekleşen kazanç girilmemiş." };
      return finish({ ...p, gainConfirmedAt: at, gainConfirmedBy: who, gainConfirmedById: user.id } as T,
        `Gerçekleşen kazanç teyit edildi (${gain.toLocaleString("tr-TR")} ${(p as any).realizedGainCurrency || ""})`.trim());
    }
  }
  return { error: "Bilinmeyen işlem." };
}

// Fields only the lifecycle actions may change; a normal save keeps the stored values.
export const CI_SERVER_OWNED_FIELDS = [
  "stage", "closedAt", "holdState", "pendingApproval", "history",
  "gainConfirmedAt", "gainConfirmedBy", "gainConfirmedById",
  "projectNo", "projectSeq", "created_by", "created_at"
] as const;
