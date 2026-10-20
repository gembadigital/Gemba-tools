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

// ---------- "ideal durum" → gereklilik kipi ----------
//
// The question bank states each ideal state as a finished fact ("… görselleştirilmiştir."), which
// is how the auditor reads it on site. In the report it is the target to reach, so it must read as
// a requirement ("… görselleştirilmelidir."). Done with Turkish verb-suffix rules rather than an
// AI rewrite so the output is deterministic and costs nothing. Only finite predicates are changed;
// anything not recognised is left exactly as written.

const VOWELS = "aeıioöuü";
const BACK_VOWELS = "aıou";
const lastVowelIsBack = (s: string): boolean => {
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = lowerTr(s[i]);
    if (VOWELS.includes(ch)) return BACK_VOWELS.includes(ch);
  }
  return true;
};
const mal = (stem: string, plural = "", copula = true) => {
  const back = lastVowelIsBack(stem);
  const base = stem + (back ? "malı" : "meli") + (copula ? (back ? "dır" : "dir") : "");
  return plural && copula ? base + (back ? "lar" : "ler") : base;
};

// Bare-root aorist verbs ("sağlar", "verir", "eder" …) cannot be told apart from plural nouns
// ("saatler") by suffix alone, so they are matched from a list instead.
const AORIST_ROOTS: Record<string, string> = {
  alır: "al", verir: "ver", girer: "gir", eder: "et", sağlar: "sağla", kılar: "kıl", tutar: "tut",
  izler: "izle", uygular: "uygula", gösterir: "göster", dağıtır: "dağıt", sokar: "sok", yapar: "yap",
  getirir: "getir", sunar: "sun", kullanır: "kullan", bulunur: "bulun", olur: "ol", içerir: "içer",
  destekler: "destekle", sağlarlar: "sağla", ederler: "et", kılarlar: "kıl", yaparlar: "yap",
  alırlar: "al", verirler: "ver", uygularlar: "uygula", gösterirler: "göster",
};
// -yor forms whose stem loses its final vowel before the suffix ("destekliyor" ← destekle-).
const YOR_IRREGULAR: Record<string, string> = { destekliyor: "destekle", bekliyor: "bekle", izliyor: "izle" };
// Passive / reflexive / causative stems that take the aorist (-ır/-ir/-ur/-ür): "sağlanır", "alınır".
const PASSIVE_STEM = /(?:lan|len|[ıiuü]l|[ıiuü]n|d[ıiuü]r|t[ıiuü]r)$/;

type Pos = "last" | "clause" | "mid"; // sentence-final word / word before a comma / anywhere else
function shouldWord(core: string, pos: Pos): string | null {
  const lw = lowerTr(core);
  if (lw.length < 4) return null;
  if (/m[ae]l[ıi]d[ıi]r(l[ae]r)?$/.test(lw)) return null; // already a requirement

  let m: RegExpMatchArray | null;
  // -maktadır / -mektedir (+ the typos "-mektdir", "-metekdir") — unambiguous, any position.
  if ((m = lw.match(/^(.{2,}?)(?:m[ae]kt[ae]|m[ae]kt|m[ae]tek)(?:d[ıiuü]r|t[ıiuü]r)?(l[ae]r)?$/))) {
    return mal(core.slice(0, m[1].length), m[2] || "");
  }
  // -mıştır / -miştir / -muştur / -müştür (+ "-mışlardır") — unambiguous, any position.
  if ((m = lw.match(/^(.{2,}?)m[ıiuü]ş(?:l[ae]r)?(?:d[ıiuü]r|t[ıiuü]r)(l[ae]r)?$/))) {
    return mal(core.slice(0, m[1].length), m[2] || (/m[ıiuü]ş(l[ae]r)d/.test(lw) ? lw.match(/m[ıiuü]ş(l[ae]r)d/)![1] : ""));
  }
  // Words before a comma ("kurulmuş, dağıtılmış, … yapılmaktadır") are clauses of a list: they take
  // the bare requirement stem ("kurulmalı, dağıtılmalı, … yapılmalıdır") — only the unambiguous
  // participle/continuous endings are touched there.
  if (pos === "clause") {
    if ((m = lw.match(/^(.{2,}?)m[ıiuü]ş$/))) return mal(core.slice(0, m[1].length), "", false);
    if (YOR_IRREGULAR[lw]) return mal(YOR_IRREGULAR[lw], "", false);
    if ((m = lw.match(/^(.{2,}?)(?:[ıiuü]yor)$/))) return mal(core.slice(0, m[1].length), "", false);
    return null;
  }
  if (pos !== "last") return null; // everything below is only safe on the sentence's final word

  if (/^vardır$/.test(lw)) return "bulunmalıdır";
  if (/^yoktur$/.test(lw)) return "bulunmamalıdır";
  // bare "-mış"/"-miş" with no copula: "… belirlenmiş."
  if ((m = lw.match(/^(.{2,}?)m[ıiuü]ş$/))) return mal(core.slice(0, m[1].length));
  // truncated "… yapılmakta."
  if ((m = lw.match(/^(.{2,}?)m[ae]kt[ae]$/))) return mal(core.slice(0, m[1].length));
  if (YOR_IRREGULAR[lw]) return mal(YOR_IRREGULAR[lw]);
  if ((m = lw.match(/^(.{2,}?)(?:[ıiuü]yor)$/))) return mal(core.slice(0, m[1].length));
  if (AORIST_ROOTS[lw]) {
    const plural = /l[ae]r$/.test(lw) && !/^(izler|destekler)$/.test(lw) ? (lastVowelIsBack(AORIST_ROOTS[lw]) ? "lar" : "ler") : "";
    return mal(AORIST_ROOTS[lw], plural);
  }
  // "sağlanır", "alınır", "görselleştirilir", "seviyelendirir"
  if ((m = lw.match(/^(.{3,}?)([ıiuü]r)$/)) && PASSIVE_STEM.test(m[1])) return mal(core.slice(0, m[1].length));
  // negative aorist: "görülmez"
  if ((m = lw.match(/^(.{3,}?)m[ae]z$/)) && PASSIVE_STEM.test(m[1])) return core.slice(0, m[1].length) + (lastVowelIsBack(m[1]) ? "mamalıdır" : "memelidir");
  // copular statements: "mevcuttur" → "mevcut olmalıdır", "sahiptir" → "sahip olmalıdır"
  if ((m = lw.match(/^(.{2,}?)(?:d[ıiuü]r|t[ıiuü]r)(l[ae]r)?$/))) {
    // "olmalıdır" ends in a back vowel, so the plural is always "-lar" (not the stem's harmony).
    return `${core.slice(0, m[1].length)} olmalıdır${m[2] ? "lar" : ""}`;
  }
  return null;
}

// Rewrites every finite predicate of a (sentence-cased) ideal-state text into its requirement form.
export function shouldForm(text: string | undefined | null): string {
  const t = String(text ?? "");
  return t.split(/(?<=[.!?])\s+/).map(sentence => {
    const parts = sentence.split(/(\s+)/);
    // index of the last real word (skip whitespace, and tokens that are pure punctuation)
    let lastIdx = -1;
    parts.forEach((p, i) => { if (/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(p)) lastIdx = i; });
    return parts.map((p, i) => {
      const m = p.match(/^([("'“]*)(.*?)([)"'”.,;:!?]*)$/);
      if (!m || !m[2]) return p;
      const nextWord = (parts.slice(i + 1).find(x => /\S/.test(x)) || "").toLocaleLowerCase("tr-TR");
      const pos: Pos = i === lastIdx ? "last" : (/^[,;]/.test(m[3]) || nextWord === "ve" || nextWord === "veya") ? "clause" : "mid";
      const out = shouldWord(m[2], pos);
      return out === null ? p : m[1] + out + m[3];
    }).join("");
  }).join(" ");
}

// Ideal-state text as printed in the report: sentence case + requirement form.
export const idealText = (s: string | undefined | null): string => shouldForm(sentences(s));

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
