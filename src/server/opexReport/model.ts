import { computeOpexScores, getOpexLevel, OpexLevel, OPEX_LEVELS, OPEX_NOT_APPLICABLE } from "../../utils/opexScoring.js";
import { REPORT_CONFIG } from "./config.js";

// Turns one stored OpEx assessment (+ question bank) into the plain data the report pages need.
// Pure function: no DB, no I/O — the same input always yields the same report.

export interface ReportBankQuestion {
  id: string;
  categoryId: string;
  categoryName?: string;
  subject?: string;
  weight: number;
  idealState?: string;
  rubric?: Record<string, string>;
}

export interface ReportBankCategory {
  id: string;
  name: string;
}

export interface ReportInput {
  assessment: any; // stored opex_assessments record
  questions: ReportBankQuestion[];
  categories: ReportBankCategory[];
  customerName: string;
  reportNo: string;
  reportDate: string; // ISO
}

export type CriterionStatus = "scored" | "na" | "unanswered";

export interface ReportCriterion {
  id: string;
  categoryId: string;
  topic: string;
  ideal: string;
  weight: number; // bank weight
  effWeight: number; // weight incl. equal share of the category's N/A weight
  score: number | null; // 0-5 when scored
  status: CriterionStatus;
  finding: string;
  lost: number; // points lost on the 0-100 area scale ((5 - score) × effWeight ÷ (5 × Σ effWeight) × 100)
}

export interface ReportArea {
  id: string;
  name: string;
  short: string;
  criteria: ReportCriterion[];
  score: number;
  level: OpexLevel;
  scoredCount: number;
  zeroCount: number;
  comment: string;
}

export interface ReportBestPractice {
  criterion: ReportCriterion;
  areaName: string;
  why: string;
  how: string;
}

export interface ReportRoadmapWave {
  when: string;
  title: string;
  items: string[];
  kpi: string;
  criteria: string[];
}

export interface ReportModel {
  firm: string;
  reportNo: string;
  reportDate: string;
  auditDate: string;
  assessors: string;
  participants: string;
  target: number;
  targetClass: "A" | "B" | "";
  overall: number;
  level: OpexLevel;
  targetLevel: OpexLevel;
  areas: ReportArea[];
  criteria: ReportCriterion[]; // scored + N/A, in bank order
  scored: ReportCriterion[];
  scoreCounts: Record<number, number>;
  bestPractices: ReportBestPractice[];
  roadmap: ReportRoadmapWave[];
  executiveSummary: string;
  warnings: string[];
}

const pick = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Overall target: mean of the per-category targets the Admin set; otherwise the pre-assessment
// quiz rule (≤ 20 quiz points → B = 45, else A = 70). Same rule as the app's report tab.
function resolveTarget(a: any): number {
  const vals = Object.values(a?.targetScores || {}).filter((v): v is number => typeof v === "number");
  if (vals.length > 0) return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  const pre: number[] = Array.isArray(a?.targetPreAnswers) && a.targetPreAnswers.length === 6 ? a.targetPreAnswers : [1, 1, 1, 1, 1, 1];
  return pre.reduce((s, v) => s + v * 5, 0) <= 20 ? REPORT_CONFIG.targetRule.B : REPORT_CONFIG.targetRule.A;
}

export function buildReportModel(input: ReportInput): ReportModel {
  const { assessment: a, questions, categories } = input;
  const answers: Record<string, number> = a?.answers || {};
  const warnings: string[] = [];

  const { categoryScores, overallScore } = computeOpexScores(questions, categories, answers);

  const areas: ReportArea[] = categories.map(cat => {
    const qs = questions.filter(q => q.categoryId === cat.id);
    const scoredQs = qs.filter(q => (answers[q.id] ?? -1) >= 0);
    const naWeight = qs.filter(q => answers[q.id] === OPEX_NOT_APPLICABLE).reduce((s, q) => s + (Number(q.weight) || 0), 0);
    const share = scoredQs.length > 0 ? naWeight / scoredQs.length : 0;
    const totalEff = scoredQs.reduce((s, q) => s + (Number(q.weight) || 0) + share, 0);

    const criteria: ReportCriterion[] = qs.map(q => {
      const raw = answers[q.id];
      const status: CriterionStatus = raw === undefined || raw === -1 ? "unanswered" : raw === OPEX_NOT_APPLICABLE ? "na" : "scored";
      const score = status === "scored" ? raw : null;
      const effWeight = status === "scored" ? (Number(q.weight) || 0) + share : Number(q.weight) || 0;
      const finding = status === "scored"
        ? pick(a?.customRubrics?.[`${q.id}_${score}`]) || pick(q.rubric?.[String(score)])
        : "";
      return {
        id: q.id,
        categoryId: cat.id,
        topic: q.subject || q.id,
        ideal: q.idealState || "",
        weight: Number(q.weight) || 0,
        effWeight,
        score,
        status,
        finding,
        lost: status === "scored" && totalEff > 0 ? ((5 - (score as number)) * effWeight) / (5 * totalEff) * 100 : 0,
      };
    });

    const score = categoryScores[cat.id] ?? 0;
    return {
      id: cat.id,
      name: cat.name,
      short: REPORT_CONFIG.shortAreaNames[cat.id] || cat.name,
      criteria,
      score,
      level: getOpexLevel(score),
      scoredCount: criteria.filter(c => c.status === "scored").length,
      zeroCount: criteria.filter(c => c.score === 0).length,
      comment: pick(a?.categoryComments?.[cat.id]),
    };
  }).filter(area => area.criteria.some(c => c.status === "scored"));

  const criteria = areas.flatMap(ar => ar.criteria);
  const scored = criteria.filter(c => c.status === "scored");
  const scoreCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  scored.forEach(c => { scoreCounts[c.score as number]++; });

  const unanswered = criteria.filter(c => c.status === "unanswered").length;
  if (unanswered > 0) warnings.push(`${unanswered} kriter değerlendirilmemiş; raporda "Değerlendirilmedi" olarak gösterildi.`);

  // Best practices = evaluator's picks ∪ every 5-point answer.
  const bpMap: Record<string, any> = a?.bestPractices || {};
  const areaName = (id: string) => areas.find(ar => ar.id === id)?.name || id;
  const bestPractices: ReportBestPractice[] = scored
    .filter(c => c.score === 5 || bpMap[c.id]?.selected)
    .map(c => ({ criterion: c, areaName: areaName(c.categoryId), why: pick(bpMap[c.id]?.why), how: pick(bpMap[c.id]?.how) }));

  const roadmap: ReportRoadmapWave[] = (Array.isArray(a?.roadmap) ? a.roadmap : [])
    .map((w: any) => ({
      when: pick(w?.when),
      title: pick(w?.title),
      items: (Array.isArray(w?.items) ? w.items : []).map(pick).filter(Boolean),
      kpi: pick(w?.kpi),
      criteria: (Array.isArray(w?.criteria) ? w.criteria : []).map(pick).filter(Boolean),
    }))
    .filter((w: ReportRoadmapWave) => w.title || w.items.length > 0);

  const auditDate = pick(a?.auditDate);
  if (auditDate && new Date(auditDate).getTime() > new Date(input.reportDate).getTime() + 24 * 3600 * 1000) {
    warnings.push("Denetim tarihi rapor tarihinden sonra görünüyor; denetim tarihini kontrol edin.");
  }

  const target = resolveTarget(a);
  const targetClass = target === REPORT_CONFIG.targetRule.A ? "A" : target === REPORT_CONFIG.targetRule.B ? "B" : "";
  const overall = Math.round(overallScore * 100) / 100;

  return {
    firm: input.customerName,
    reportNo: input.reportNo,
    reportDate: input.reportDate,
    auditDate,
    assessors: pick(a?.assessorParticipants),
    participants: pick(a?.customerParticipants),
    target,
    targetClass,
    overall,
    level: getOpexLevel(overall),
    targetLevel: getOpexLevel(target),
    areas,
    criteria,
    scored,
    scoreCounts,
    bestPractices,
    roadmap,
    executiveSummary: pick(a?.executiveSummary),
    warnings,
  };
}

export { OPEX_LEVELS };
