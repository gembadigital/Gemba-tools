// Shared scoring/status helpers for the 5S Audit module. Kept faithful to the legacy Power Apps
// app's exact math (see spec derived from powerapps/Src/MainScreen.fx.yaml + App.fx.yaml) — there
// is deliberately NO weighting by difficulty level and NO absolute maturity-tier classification;
// see the comments below for what each function actually replicates.

// Binary on-time indicator used by both Aksiyon Listesi rows and Gemba Walk rows (legacy Durum/
// DurumNo): green if completed on/before the due date, or not yet completed but not yet overdue;
// red if overdue, completed late, or there's no due date at all.
export function isOnTime(dueDate: string | null | undefined, completedDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  if (completedDate) return completedDate <= dueDate;
  const today = new Date().toISOString().slice(0, 10);
  return today <= dueDate;
}

// 3-state personal-action status (legacy colKisiselAksiyon Durum): 2 = completed on time,
// 1 = not yet due, 0 = overdue or completed late.
export function personalActionStatus(dueDate: string | null | undefined, completedDate: string | null | undefined): 0 | 1 | 2 {
  const today = new Date().toISOString().slice(0, 10);
  if (completedDate && dueDate) return completedDate <= dueDate ? 2 : 0;
  if (!completedDate && dueDate) return today <= dueDate ? 1 : 0;
  return 0;
}

// Unweighted average of 1-5 question scores, rounded to 2dp — matches DenetimSonuclari.Sonuc.
export function averageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100;
}

// Trend vs the previous audit cycle for the same area+level (legacy Icon8: green/gray/red).
export type Trend = "improved" | "same" | "declined" | "new";
export function scoreTrend(score: number, previousScore: number | null): Trend {
  if (previousScore === null || previousScore === undefined) return "new";
  if (score > previousScore) return "improved";
  if (score === previousScore) return "same";
  return "declined";
}

export const ACTION_STATUS_OPTIONS = ["Aksiyon Yok", "Açık", "Devam Ediyor", "Kapalı"] as const;
export const GEMBA_WALK_STATUS_OPTIONS = ["Açık", "Devam Ediyor", "Kapalı"] as const;
export const DIFFICULTY_LEVEL_OPTIONS = ["1", "2", "3"] as const;
