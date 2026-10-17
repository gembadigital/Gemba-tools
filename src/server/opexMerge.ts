// ".js" required: Vercel runs this server as native ESM (see api/index.ts).
import { computeOpexScores } from "../utils/opexScoring.js";
import type { OpexScoringCategory, OpexScoringQuestion } from "../utils/opexScoring.js";

// OpEx Assessment is filled in by several assessors at once: the Admin splits the 18 categories
// between people (e.g. A-D → one consultant, E-G → another), each assessor scores only their own
// categories, and the Admin finally merges/locks the audit and exports the report.
//
// The client always posts the whole assessment object, so a plain upsert would let whoever saves
// last overwrite everyone else's answers with their stale copy. This merges a save into the stored
// record instead: per-question fields are taken from the payload only for the categories the
// client says it edited (`_editedCategories`) AND the caller is allowed to edit; everything else
// keeps the stored value. Setup fields (assignments, targets, participants, name/date) and
// locking are Admin-only. Scores are always recomputed here from the merged answers.

type User = { id: string; role: string };

export type OpexMergeResult =
  | { ok: true; record: any }
  | { ok: false; status: number; error: string };

const ADMIN_FIELDS = [
  "auditName",
  "auditDate",
  "assessorParticipants",
  "customerParticipants",
  "targetScores",
  "targetPriorities",
  "targetNotes",
  "assessorAssignments",
  "targetPreAnswers",
] as const;

// -2 = N/A, -1 = unanswered, 0..5 = score
const isValidAnswer = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= -2 && v <= 5;

// customRubrics keys are `${questionId}_${score}`; question ids may themselves contain "_".
const rubricQuestionId = (key: string): string => {
  const i = key.lastIndexOf("_");
  return i > 0 ? key.slice(0, i) : key;
};

export function categoriesEditableBy(user: User, record: any, categories: OpexScoringCategory[]): string[] {
  if (user.role === "Admin") return categories.map(c => c.id);
  const assignments: Record<string, string> = record?.assessorAssignments || {};
  return categories.filter(c => assignments[c.id] === user.id).map(c => c.id);
}

export function mergeOpexAssessmentSave(args: {
  existing: any | null;
  payload: any;
  user: User;
  questions: OpexScoringQuestion[];
  categories: OpexScoringCategory[];
  now?: string;
}): OpexMergeResult {
  const { existing, payload, user, questions, categories } = args;
  const now = args.now || new Date().toISOString();
  const isAdmin = user.role === "Admin";
  const { _editedCategories, _recomputeOnly, ...body } = payload || {};

  // New audit: only the Admin sets one up (and assigns the categories).
  if (!existing) {
    if (!isAdmin) {
      return { ok: false, status: 403, error: "Yeni denetimi yalnızca Admin oluşturabilir." };
    }
    const answers: Record<string, number> = {};
    Object.entries(body.answers || {}).forEach(([k, v]) => { if (isValidAnswer(v)) answers[k] = v; });
    const { categoryScores, overallScore } = computeOpexScores(questions, categories, answers);
    return {
      ok: true,
      record: { ...body, answers, categoryScores, overallScore, status: "draft", updated_at: now },
    };
  }

  // Stored scores can drift from the formula (old saves); the Admin may ask for a pure recompute,
  // which is also allowed on a locked audit since it changes no input data.
  if (_recomputeOnly) {
    if (!isAdmin) return { ok: false, status: 403, error: "Yetkiniz yok." };
    const { categoryScores, overallScore } = computeOpexScores(questions, categories, existing.answers || {});
    return { ok: true, record: { ...existing, categoryScores, overallScore, updated_at: now } };
  }

  if (existing.status === "completed") {
    return { ok: false, status: 409, error: "Bu denetim kilitlenmiş; değişiklik yapılamaz." };
  }

  const wantsComplete = body.status === "completed";
  if (wantsComplete && !isAdmin) {
    return { ok: false, status: 403, error: "Denetimi yalnızca Admin birleştirip kilitleyebilir." };
  }

  const allowed = new Set(categoriesEditableBy(user, existing, categories));
  const edited = new Set(
    (Array.isArray(_editedCategories) ? _editedCategories : []).filter((c: unknown) => typeof c === "string" && allowed.has(c))
  );
  const requested = Array.isArray(_editedCategories) ? _editedCategories.length : 0;
  if (requested > 0 && edited.size < requested && !isAdmin) {
    return { ok: false, status: 403, error: "Yalnızca size atanmış bölümleri düzenleyebilirsiniz." };
  }

  const questionCategory: Record<string, string> = {};
  questions.forEach(q => { questionCategory[q.id] = q.categoryId; });
  const inEdited = (questionId: string) => edited.has(questionCategory[questionId]);

  const answers: Record<string, number> = { ...(existing.answers || {}) };
  Object.entries(body.answers || {}).forEach(([qid, v]) => {
    if (inEdited(qid) && isValidAnswer(v)) answers[qid] = v;
  });

  const comments: Record<string, string> = { ...(existing.comments || {}) };
  Object.entries(body.comments || {}).forEach(([qid, v]) => {
    if (inEdited(qid) && typeof v === "string") comments[qid] = v;
  });

  const customRubrics: Record<string, string> = { ...(existing.customRubrics || {}) };
  Object.entries(body.customRubrics || {}).forEach(([key, v]) => {
    if (inEdited(rubricQuestionId(key)) && typeof v === "string") customRubrics[key] = v;
  });

  const categoryComments: Record<string, string> = { ...(existing.categoryComments || {}) };
  Object.entries(body.categoryComments || {}).forEach(([catId, v]) => {
    if (edited.has(catId) && typeof v === "string") categoryComments[catId] = v;
  });

  const record: any = { ...existing, answers, comments, customRubrics, categoryComments, updated_at: now };

  if (isAdmin) {
    ADMIN_FIELDS.forEach(f => { if (body[f] !== undefined) record[f] = body[f]; });
  }

  if (wantsComplete) {
    // Merge step: every question in the bank gets a final value; unanswered ones count as 0.
    questions.forEach(q => {
      if (record.answers[q.id] === undefined || record.answers[q.id] === -1) record.answers[q.id] = 0;
    });
    record.status = "completed";
    record.completed_at = now;
    record.completed_by = user.id;
  }

  const { categoryScores, overallScore } = computeOpexScores(questions, categories, record.answers);
  record.categoryScores = categoryScores;
  record.overallScore = overallScore;
  return { ok: true, record };
}
