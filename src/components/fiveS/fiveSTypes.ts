// Ported from a legacy Power Apps canvas app ("Denetimler"/"GembaWalk" SharePoint lists) that ran
// this same 5S audit workflow for one plant. Field names/business rules below are kept faithful to
// that original app (see the scoring math in fiveSCalc.ts) — this file just gives them proper types.

export type FiveSLevel = "1S" | "2S" | "3S" | "4S" | "5S";

export const FIVE_S_LEVELS: { code: FiveSLevel; name: string; label: string }[] = [
  { code: "1S", name: "SEIRI", label: "1S - SEIRI (Ayıkla)" },
  { code: "2S", name: "SEITON", label: "2S - SEITON (Düzenle)" },
  { code: "3S", name: "SEISO", label: "3S - SEISO (Temizle)" },
  { code: "4S", name: "SEIKETSU", label: "4S - SEIKETSU (Standartlaştır)" },
  { code: "5S", name: "SHITSUKE", label: "5S - SHITSUKE (Disiplin)" }
];

export type AuditStatus = "Başlanmadı" | "Devam Ediyor" | "Tamamlandı";
export type ActionStatus = "Aksiyon Yok" | "Açık" | "Devam Ediyor" | "Kapalı";

export interface FiveSDepartment {
  id: string;
  name: string; // Bölüm
}

export interface FiveSArea {
  id: string;
  departmentId: string; // Bölüm
  name: string; // Alan
  responsible: string; // Sorumlu — denormalized personnel name, kept in sync with responsibleId
  responsibleId?: string; // -> FiveSPersonnel.id — source of truth when set (see db.ts's cascade
  // rename on personnel save); older rows saved before this field existed only have `responsible`.
  difficultyLevel: string; // ZorlukSeviyesi — selects which question bank applies to this area
}

export interface FiveSPersonnel {
  id: string;
  name: string; // Ad
  role: string; // Görev
  email: string; // Mail
  department: string; // Personel Bölümü
  isAuditor: boolean; // Denetçi
  isAdmin: boolean; // Admin
}

export interface FiveSQuestion {
  id: string;
  questionNo: number; // SoruNo
  level: FiveSLevel; // Seviye
  departmentId: string; // Bölüm
  difficultyLevel: string; // ZorlukSeviyesi
  text: string; // Soru
}

export interface FiveSAuditHeader {
  id: string;
  auditNo: number; // DenetimNo — sequential, app-wide
  date: string; // DenetimTarihi
  status: AuditStatus; // DenetimDurumu
  overallScore: number | null; // DenetimPuani — 1.00-5.00 scale, set only on completion
}

export interface FiveSTeamAssignment {
  id: string;
  auditId: string; // -> FiveSAuditHeader.id
  areaId: string; // -> FiveSArea.id
  auditorName: string; // Ad — denormalized personnel name, kept in sync with auditorId
  auditorId?: string; // -> FiveSPersonnel.id — source of truth when set (see FiveSArea.responsibleId)
}

export interface FiveSAuditAnswer {
  id: string;
  auditId: string;
  areaId: string;
  questionId: string;
  score: number; // Puan, 1-5
  comment: string; // DenetimYorumu
  action: string; // Aksiyon
  actionStatus: ActionStatus; // AksiyonDurumu
  dueDate: string | null; // TerminTarihi
  completedDate: string | null; // GerceklesmeTarihi
  photo?: string; // base64 data URL, single photo evidence per answer
}

export interface FiveSAuditResult {
  id: string;
  auditId: string;
  areaId: string;
  level: FiveSLevel;
  score: number; // Sonuc — unweighted avg of question scores for this (audit, area, level), 1-5 scale
  previousScore: number | null; // HedefPuan — prior audit's Sonuc for the same area+level (trend baseline, not a target)
}

export interface FiveSProblemCategory {
  id: string;
  name: string;
}

export interface GembaWalkFinding {
  id: string;
  areaId: string; // Alan
  problemCategory: string; // ProblemKategorisi
  problemDate: string; // ProblemTarihi
  problemDescription: string; // ProblemTanimi
  photo?: string; // Gorsel — base64 data URL
  action: string; // Aksiyon
  responsible: string; // Sorumlu — denormalized personnel name, kept in sync with responsibleId
  responsibleId?: string; // -> FiveSPersonnel.id — source of truth when set (see FiveSArea.responsibleId)
  status: string; // Durum: Açık / Devam Ediyor / Kapalı
  dueDate: string | null; // TerminTarihi
  completedDate: string | null; // GerceklestirmeTarihi
}

// Client-side merged row for the global Aksiyon Listesi (audit-derived actions), joining
// FiveSAuditAnswer + FiveSArea/Department + FiveSTeamAssignment, matching the legacy colAksiyon.
export interface FiveSActionRow {
  answerId: string;
  auditId: string;
  auditNo: number;
  auditDate: string;
  departmentId: string;
  departmentName: string;
  areaId: string;
  areaName: string;
  category: string; // SoruNo/Seviye
  action: string;
  actionStatus: ActionStatus;
  dueDate: string | null;
  completedDate: string | null;
  auditorName: string; // Denetci
  ownerName: string; // AksiyonSorumlusu — Alan.responsible
  onTime: boolean; // Durum: true if done on/before due date, or not yet due
}

// Merged personal action row (Ana Sayfa "Kişisel Aksiyonlarım"), combining audit-derived actions
// (where I am the area's responsible person) and Gemba Walk findings (where I am Sorumlu).
export interface FiveSPersonalActionRow {
  source: "5S Audit" | "Gemba Walk";
  date: string;
  areaName: string;
  category: string;
  action: string;
  actionStatus: string;
  dueDate: string | null;
  completedDate: string | null;
  status: 0 | 1 | 2; // 0 = overdue, 1 = on track (not yet due), 2 = completed on time
}
