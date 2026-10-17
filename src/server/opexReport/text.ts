import { REPORT_CONFIG } from "./config.js";

// Text clean-up for the executive report: the question bank stores ideal-state texts in ALL
// CAPS and field findings are typed quickly on site, so both are normalised here (Turkish
// İ/ı-aware casing, abbreviations kept, spacing/duplicate sentences fixed).

export const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const lowerTr = (s: string) => s.toLocaleLowerCase("tr-TR");
const upperTr = (s: string) => s.toLocaleUpperCase("tr-TR");

const KEEP = new Set(REPORT_CONFIG.keepAbbreviations);
const isAbbrev = (w: string) => {
  const core = w.replace(/^[("'“]+|[)"'”.,;:!?]+$/g, "");
  return KEEP.has(core) || /^\d+[A-ZÇĞİÖŞÜ]+$/.test(core) || /^[A-ZÇĞİÖŞÜ]\d/.test(core);
};

const applyTypos = (s: string) => {
  let out = s;
  for (const [a, b] of REPORT_CONFIG.typoFixes) out = out.split(a).join(b);
  return out;
};

// "HÜCRELER VE HATLAR 5S ŞARTLARINA GÖRE" → "Hücreler ve hatlar 5S şartlarına göre"
function sentenceCase(sentence: string): string {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  const out = words.map((w, i) => {
    if (isAbbrev(w)) return w;
    const lw = lowerTr(w);
    return i === 0 ? upperTr(lw.charAt(0)) + lw.slice(1) : lw;
  });
  return out.join(" ");
}

// Whole paragraph in sentence case (each sentence capitalised).
export function sentences(s: string | undefined | null): string {
  const t = fix(s);
  if (!t) return "";
  return t
    .split(/(?<=[.!?])\s+/)
    .map(sentenceCase)
    .join(" ");
}

// Short headings (area / criterion names): Title Case, "ve" lower, abbreviations kept.
export function title(s: string | undefined | null): string {
  const t = applyTypos(String(s ?? "")).replace(/\s*-\s*/g, " – ").replace(/\s+/g, " ").trim();
  return t
    .split(" ")
    .map(w => {
      if (isAbbrev(w)) return w;
      const lw = lowerTr(w);
      if (lw === "ve") return "ve";
      return upperTr(lw.charAt(0)) + lw.slice(1);
    })
    .join(" ");
}

// Spacing after punctuation, collapsed whitespace, repeated sentences dropped, known typos fixed.
export function fix(s: string | undefined | null): string {
  let t = applyTypos(String(s ?? "")).replace(/[\t\r\n]+/g, " ");
  t = t.replace(/\.(?=[A-ZÇĞİÖŞÜ])/g, ". ");
  t = t.replace(/,(?=\S)/g, ", ");
  t = t.replace(/\s+([,.;:])/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  const seen: string[] = [];
  for (const part of t.split(/(?<=\.)\s+/)) {
    if (part && !seen.includes(part)) seen.push(part);
  }
  return seen.join(" ");
}

// First sentence, trimmed to `limit` chars on a word boundary.
export function firstSentence(s: string | undefined | null, limit = 100): string {
  const t = fix(s);
  if (!t) return "";
  let first = t.split(/(?<=\.)\s+/)[0];
  if (first.length > limit) first = first.slice(0, limit).replace(/\s+\S*$/, "").replace(/[,;]$/, "") + "…";
  return first;
}

// 17.19 → "17,2" (Turkish decimal comma).
export const num = (v: number, digits = 1): string =>
  (Number.isFinite(v) ? v : 0).toFixed(digits).replace(".", ",");

export const fmtDate = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const ORDINALS = ["birinci", "ikinci", "üçüncü", "dördüncü", "beşinci"];
export const ordinal = (i: number) => ORDINALS[i] || `${i + 1}.`;
