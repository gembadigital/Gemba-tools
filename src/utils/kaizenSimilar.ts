// Benzer öneri tespiti — 1. adım (Faz 6.1): plain text similarity within one customer's
// suggestions, no AI. Text is normalised for Turkish (case, ı/i, ş/s, ğ/g, ü/u, ö/o, ç/c), common
// words are dropped and words are cut to a 5-letter stem so "vidalar", "vidanın", "vida" meet.
// Each suggestion becomes a TF-IDF vector (subject counted twice); cosine similarity ranks them,
// with a small bonus for the same department and a shared suggestion class.
// Shared by the server route and the tests; pure and dependency-free.

const FOLD: Record<string, string> = { ı: "i", İ: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c", â: "a", î: "i", û: "u" };
const STOP = new Set([
  "ve", "ile", "bir", "bu", "su", "o", "da", "de", "ki", "mi", "icin", "gibi", "daha", "cok", "en", "ya", "veya", "ama",
  "olarak", "olan", "oldu", "olur", "var", "yok", "her", "hem", "ise", "kadar", "sonra", "once", "uzerinde", "icinde",
  "tarafindan", "yapilmasi", "yapilir", "edilmesi", "edilir", "olmasi", "olacak", "neden", "nasil", "kez", "adet",
  "the", "and", "for"
]);
const STEM = 5;

export function tokens(text: string): string[] {
  const norm = (text || "").toLocaleLowerCase("tr").replace(/[ıİşğüöçâîû]/g, c => FOLD[c] || c);
  return norm.split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)).map(w => w.slice(0, STEM));
}

export interface SimilarInput {
  subject?: string; currentState?: string; improvementSuggestion?: string;
  personnelDepartment?: string; suggestionTypes?: string[];
}

const termsOf = (s: SimilarInput) => [...tokens(s.subject || ""), ...tokens(s.subject || ""), ...tokens(s.currentState || ""), ...tokens(s.improvementSuggestion || "")];

function vector(terms: string[], idf: Map<string, number>): Map<string, number> {
  const tf = new Map<string, number>();
  terms.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
  const v = new Map<string, number>();
  tf.forEach((n, t) => v.set(t, (1 + Math.log(n)) * (idf.get(t) ?? 0)));
  return v;
}
function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, na = 0, nb = 0;
  a.forEach((x, t) => { na += x * x; const y = b.get(t); if (y) dot += x * y; });
  b.forEach(y => { nb += y * y; });
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export const SIMILAR_THRESHOLD = 0.22;

export function findSimilar<T extends SimilarInput & { id: string }>(
  query: SimilarInput, corpus: T[], opts: { excludeId?: string; limit?: number; threshold?: number } = {}
): { item: T; score: number }[] {
  const docs = corpus.filter(d => d.id !== opts.excludeId);
  const qTerms = termsOf(query);
  if (!docs.length || new Set(qTerms).size < 2) return [];
  const docTerms = docs.map(termsOf);
  const df = new Map<string, number>();
  [...docTerms, qTerms].forEach(ts => new Set(ts).forEach(t => df.set(t, (df.get(t) || 0) + 1)));
  const n = docTerms.length + 1;
  const idf = new Map<string, number>();
  df.forEach((d, t) => idf.set(t, Math.log((n + 1) / (d + 1)) + 1));
  const q = vector(qTerms, idf);
  const qTypes = new Set(query.suggestionTypes || []);
  const dept = (query.personnelDepartment || "").trim().toLocaleLowerCase("tr");
  return docs
    .map((item, i) => {
      let score = cosine(q, vector(docTerms[i], idf));
      if (score > 0 && dept && (item.personnelDepartment || "").trim().toLocaleLowerCase("tr") === dept) score += 0.05;
      if (score > 0 && (item.suggestionTypes || []).some(t => qTypes.has(t))) score += 0.03;
      return { item, score: Math.round(Math.min(1, score) * 100) / 100 };
    })
    .filter(x => x.score >= (opts.threshold ?? SIMILAR_THRESHOLD))
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 5);
}

// ---- Anlamsal benzerlik (Faz 6.2) ----
// Gemini embeddings (gemini-embedding-001, 768 dims, SEMANTIC_SIMILARITY). Calibrated on Turkish
// suggestion texts: the same idea in other words scores ~0.87–0.89, unrelated ideas ~0.72–0.77.
// Raw cosine is mapped to 0..1 from SEMANTIC_FLOOR so it sits next to the text score.
export const SEMANTIC_THRESHOLD = 0.83;
const SEMANTIC_FLOOR = 0.78;
const SEMANTIC_CEIL = 0.95;

export function cosineVec(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
export const semanticScore = (cos: number) => Math.round(Math.max(0, Math.min(1, (cos - SEMANTIC_FLOOR) / (SEMANTIC_CEIL - SEMANTIC_FLOOR))) * 100) / 100;

export const embeddingText = (s: SimilarInput) =>
  [s.subject || "", s.currentState || "", s.improvementSuggestion || ""].map(t => t.trim()).filter(Boolean).join("\n").slice(0, 4000);

// Stable short hash of the embedded text, to notice when a stored vector is stale.
export function textHash(t: string): string {
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Text hits and semantic hits for the same corpus, merged: one row per suggestion, the higher of the
// two scores, flagged when the semantic side found it.
export function mergeSimilar<T extends { id: string }>(
  text: { item: T; score: number }[], semantic: { item: T; cos: number }[], limit = 5
): { item: T; score: number; semantic: boolean }[] {
  const out = new Map<string, { item: T; score: number; semantic: boolean }>();
  text.forEach(h => out.set(h.item.id, { item: h.item, score: h.score, semantic: false }));
  semantic.filter(h => h.cos >= SEMANTIC_THRESHOLD).forEach(h => {
    const sc = semanticScore(h.cos);
    const prev = out.get(h.item.id);
    out.set(h.item.id, { item: h.item, score: Math.max(prev?.score ?? 0, sc), semantic: true });
  });
  return [...out.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
