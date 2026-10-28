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
