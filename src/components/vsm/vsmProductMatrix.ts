// Product–process matrix (PQ/PR analysis): which products pass through which steps, how much volume
// each has, and which products form a family worth one value stream map. Pure functions.
//
// Family rule (common practice): products whose routings share at least `similarityPct` of their steps
// (Jaccard similarity of the step sets) belong together. Products are taken in descending volume order;
// each joins the first family whose leading product is similar enough, otherwise starts a new family.
import type { VsmMatrixProduct, VsmProductMatrix } from "./vsmTypes.js";

export interface VsmFamily {
  key: string;                 // leading product id
  productIds: string[];
  names: string[];
  stepIds: string[];           // union of the family's routings
  weeklyVolume: number;
  sharePct: number;            // of the matrix's total weekly volume
}

export function routingSimilarity(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  A.forEach(x => { if (B.has(x)) inter++; });
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

export function suggestFamilies(matrix: VsmProductMatrix): VsmFamily[] {
  const threshold = (matrix.similarityPct ?? 80) / 100;
  const products = [...(matrix.products || [])]
    .filter(p => p.stepIds && p.stepIds.length > 0)
    .sort((a, b) => (b.weeklyVolume ?? 0) - (a.weeklyVolume ?? 0));
  const total = (matrix.products || []).reduce((s, p) => s + (p.weeklyVolume ?? 0), 0);
  const families: { lead: VsmMatrixProduct; members: VsmMatrixProduct[] }[] = [];
  products.forEach(p => {
    const home = families.find(f => routingSimilarity(f.lead.stepIds, p.stepIds) >= threshold);
    if (home) home.members.push(p); else families.push({ lead: p, members: [p] });
  });
  const stepOrder = new Map((matrix.steps || []).map((s, i) => [s.id, i]));
  return families
    .map(f => {
      const volume = f.members.reduce((s, p) => s + (p.weeklyVolume ?? 0), 0);
      const steps = Array.from(new Set(f.members.flatMap(p => p.stepIds)))
        .sort((a, b) => (stepOrder.get(a) ?? 999) - (stepOrder.get(b) ?? 999));
      return {
        key: f.lead.id,
        productIds: f.members.map(p => p.id),
        names: f.members.map(p => p.name),
        stepIds: steps,
        weeklyVolume: volume,
        sharePct: total > 0 ? Math.round((volume / total) * 1000) / 10 : 0
      };
    })
    .sort((a, b) => b.weeklyVolume - a.weeklyVolume);
}

// Totals of the products chosen as the project's family (what the map is drawn for).
export function familyTotals(matrix: VsmProductMatrix, productIds: string[]) {
  const chosen = new Set(productIds);
  const total = (matrix.products || []).reduce((s, p) => s + (p.weeklyVolume ?? 0), 0);
  const members = (matrix.products || []).filter(p => chosen.has(p.id));
  const weeklyVolume = members.reduce((s, p) => s + (p.weeklyVolume ?? 0), 0);
  return {
    names: members.map(p => p.name),
    weeklyVolume,
    sharePct: total > 0 ? Math.round((weeklyVolume / total) * 1000) / 10 : 0
  };
}
