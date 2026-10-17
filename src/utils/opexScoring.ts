// Shared by the OpEx Assessment UI, the server (which recomputes scores on every save so a merged
// multi-assessor record never carries numbers computed from a stale client copy), the Excel export
// and the executive PDF report — the single source for the scoring formula and the level bands.

export interface OpexScoringQuestion {
  id: string;
  categoryId: string;
  weight: number;
}

export interface OpexScoringCategory {
  id: string;
}

// Answer codes: 0..5 = score, -1 = not yet answered, -2 = N/A ("Kapsam dışı").
export const OPEX_UNANSWERED = -1;
export const OPEX_NOT_APPLICABLE = -2;

// Category score (0-100):
//   Σ puan × w' ÷ (5 × Σ w') × 100   over the category's scored (0-5) questions
// where w' = question weight + an equal share of the category's N/A weight
// ("Kapsam dışı" weight is redistributed equally across the scored questions, so N/A never
// lowers the achievable score). Normalising by the weights actually in play means a category
// reaches 100 at "all 5" regardless of whether its bank weights happen to sum to exactly 20.
// Unanswered (-1) questions are left out entirely — they neither score nor donate weight.
//
// Overall score = arithmetic mean of the categories that have at least one scored question.
export function computeOpexScores(
  questions: OpexScoringQuestion[],
  categories: OpexScoringCategory[],
  answers: Record<string, number>
): { categoryScores: Record<string, number>; overallScore: number } {
  const categoryScores: Record<string, number> = {};
  const scoredCategoryIds: string[] = [];

  categories.forEach(cat => {
    const catQuestions = questions.filter(q => q.categoryId === cat.id);
    const scored = catQuestions.filter(q => (answers[q.id] ?? OPEX_UNANSWERED) >= 0);
    const naWeight = catQuestions
      .filter(q => answers[q.id] === OPEX_NOT_APPLICABLE)
      .reduce((s, q) => s + (Number(q.weight) || 0), 0);

    if (scored.length === 0) {
      categoryScores[cat.id] = 0;
      return;
    }
    scoredCategoryIds.push(cat.id);

    const share = naWeight / scored.length;
    let points = 0;
    let maxPoints = 0;
    scored.forEach(q => {
      const w = (Number(q.weight) || 0) + share;
      points += answers[q.id] * w;
      maxPoints += 5 * w;
    });
    categoryScores[cat.id] = maxPoints > 0 ? Math.round((points / maxPoints) * 100 * 100) / 100 : 0;
  });

  const overallScore = scoredCategoryIds.length > 0
    ? Math.round((scoredCategoryIds.reduce((s, id) => s + categoryScores[id], 0) / scoredCategoryIds.length) * 100) / 100
    : 0;

  return { categoryScores, overallScore };
}

// The five maturity levels used everywhere (screens, Excel, executive report).
export interface OpexLevel {
  index: number; // 0..4
  min: number;
  max: number;
  range: string;
  name: string;
  color: string;
  description: string;
}

export const OPEX_LEVELS: OpexLevel[] = [
  { index: 0, min: 0, max: 30, range: "0–30", name: "İsraf yoğun", color: "#C8373B",
    description: "İsraf yoğun süreç akışı; israflar tespit edilemiyor. Sürekli iyileştirme bilinci yeterli seviyede değil." },
  { index: 1, min: 30, max: 50, range: "31–50", name: "Temel seviye", color: "#E08A3C",
    description: "İsrafla mücadele için gerekli altyapı oluşturulmuş, farkındalık başlamış." },
  { index: 2, min: 50, max: 70, range: "51–70", name: "Gelişime açık", color: "#D9B43B",
    description: "Dönüşüm başlamış, kültür değişikliği görünür düzeyde. Gelişim sağlanıyor." },
  { index: 3, min: 70, max: 85, range: "71–85", name: "Sürdürülebilir", color: "#4E9A6A",
    description: "Gelişim organizasyonun her kademesinde sürdürülebilir düzeyde." },
  { index: 4, min: 85, max: 100, range: "86–100", name: "Mükemmellik", color: "#2F6FA8",
    description: "Olgunluk sağlanmış; sürekli gelişim görsel olarak fark ediliyor, israflar kaynağında bertaraf ediliyor." },
];

// 30 → İsraf yoğun, 30.01 → Temel seviye (upper bound inclusive), same as the report's bands.
export function getOpexLevel(score: number): OpexLevel {
  const v = Number.isFinite(score) ? score : 0;
  return OPEX_LEVELS.find(l => v <= l.max) || OPEX_LEVELS[OPEX_LEVELS.length - 1];
}
