// Shared by the OpEx Assessment UI and the server (which recomputes scores on every save so a
// merged multi-assessor record never carries numbers computed from a stale client copy).

export interface OpexScoringQuestion {
  id: string;
  categoryId: string;
  weight: number;
}

export interface OpexScoringCategory {
  id: string;
}

// Scoring engine — verified against the original Power Apps "Denetimi Bitir" formula (decoded
// from the .msapp source) and the real question bank, where every category's question weights
// sum to ~20 by design. Because of that, "Σ (soru puanı × soru ağırlığı)" for a category lands
// naturally in 0-100 — it's already a net score, not a fraction that needs a % sign.
//
// -1 = not yet answered (excluded, doesn't donate/receive weight). -2 = N/A (excluded from
// scoring, but its weight is redistributed equally across the category's *answered* questions —
// same rule the Power Apps formula applies — so marking something N/A doesn't silently shrink
// the category's achievable score).
export function computeOpexScores(
  questions: OpexScoringQuestion[],
  categories: OpexScoringCategory[],
  answers: Record<string, number>
): { categoryScores: Record<string, number>; overallScore: number } {
  const categoryScores: Record<string, number> = {};
  const touchedCategoryIds: string[] = [];

  categories.forEach(cat => {
    const catQuestions = questions.filter(q => q.categoryId === cat.id);
    const touched = catQuestions.filter(q => {
      const v = answers[q.id];
      return v !== undefined && v !== -1;
    });
    if (touched.length > 0) touchedCategoryIds.push(cat.id);

    const naQuestions = touched.filter(q => answers[q.id] === -2);
    const scoredQuestions = touched.filter(q => (answers[q.id] ?? -1) >= 0);
    const naWeightSum = naQuestions.reduce((s, q) => s + q.weight, 0);
    const extraPerSurvivor = scoredQuestions.length > 0
      ? Math.round((naWeightSum / scoredQuestions.length) * 100) / 100
      : 0;

    const categoryTotal = scoredQuestions.reduce((sum, q) => {
      const effectiveWeight = Math.round((q.weight + extraPerSurvivor) * 100) / 100;
      return sum + answers[q.id] * effectiveWeight;
    }, 0);
    categoryScores[cat.id] = Math.round(categoryTotal * 100) / 100;
  });

  const touchedScores = touchedCategoryIds.map(id => categoryScores[id]);
  const overallScore = touchedScores.length > 0
    ? Math.round((touchedScores.reduce((s, v) => s + v, 0) / touchedScores.length) * 100) / 100
    : 0;

  return { categoryScores, overallScore };
}
