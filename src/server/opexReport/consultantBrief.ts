import type { ReportModel } from "./model.js";
import { LIMITS, clip, geminiJson, normalizeQuickWins, findingsBlock, MAX_QUICK_WINS } from "./quickWins.js";
import type { ReportQuickWin } from "./quickWins.js";

// "Danışman Özet Sunumu" — the AI analysis shown on the OpEx Assessment report tab. It replaces an
// older generic "AI Olgunluk Analizi" that was sent to the portfolio-level executive-insights
// endpoint with hard-coded placeholder numbers, so it said nothing about the audit in front of the
// user. This one is built only from the audit itself (scores, evaluator comments, field findings,
// best practices, the evaluator's roadmap, the previous audit) and is laid out the way a lean
// consultant would present it to the plant's management: where we stand → what to build on →
// what hurts → quick wins → 90-day priorities → decisions needed → how we will measure it. Every
// point cites criterion IDs so it can be traced back to the audit.

export interface BriefPoint { title: string; detail: string; criteria: string[] }
export interface BriefPriority { title: string; why: string; items: string[] } // rank = array position (1, 2, 3)

export interface BriefFacts {
  firm: string;
  auditName: string;
  auditDate: string;
  overall: number;
  level: string;
  target: number;
  gap: number;
  criteriaScored: number;
  criteriaTotal: number;
  lowCount: number; // criteria scored 0-1
  areaCount: number;
  best: { id: string; name: string; score: number };
  worst: { id: string; name: string; score: number };
  previous: { name: string; date: string; overall: number } | null;
  complete: boolean; // false → audit still open / criteria unanswered
  unanswered: number;
  findingAuthors: string[]; // consultants whose comments the brief is based on (empty → scores only)
}

export interface ConsultantBrief {
  generatedAt: string;
  facts: BriefFacts;
  headline: string;
  focus: BriefPoint[]; // major problems named by the consultants themselves
  deprioritized: { topic: string; reason: string }[]; // low-scoring topics the consultants deliberately do not prioritise
  strengths: BriefPoint[];
  gaps: BriefPoint[];
  quickWins: ReportQuickWin[];
  priorities: BriefPriority[]; // ranked 1-2-3, deliberately NOT tied to calendar windows
  next90?: { when: string; title: string; items: string[] }[]; // legacy field of briefs stored before the priorities rewrite
  decisions: string[];
  kpis: string[];
}

export function buildFacts(m: ReportModel, previous: BriefFacts["previous"], complete: boolean): BriefFacts {
  const ranked = [...m.areas].sort((a, b) => b.score - a.score);
  const best = ranked[0], worst = ranked[ranked.length - 1];
  return {
    firm: m.firm,
    auditName: m.auditName,
    auditDate: m.auditDate,
    overall: m.overall,
    level: m.level.name,
    target: m.target,
    gap: Math.round((m.target - m.overall) * 10) / 10,
    criteriaScored: m.scored.length,
    criteriaTotal: m.criteria.length,
    lowCount: m.scoreCounts[0] + m.scoreCounts[1],
    areaCount: m.areas.length,
    best: { id: best?.id || "", name: best?.name || "", score: best?.score ?? 0 },
    worst: { id: worst?.id || "", name: worst?.name || "", score: worst?.score ?? 0 },
    previous,
    complete: complete && m.criteria.every(c => c.status !== "unanswered"),
    unanswered: m.criteria.filter(c => c.status === "unanswered").length,
    findingAuthors: m.consultantFindings.map(f => f.name),
  };
}

const n1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ","); // Turkish decimal comma, one decimal

function buildPrompt(m: ReportModel, f: BriefFacts): string {
  const areas = m.areas.map(a => `- ${a.id} ${a.name}: ${n1(a.score)}/100 (${a.level.name}); 0 puanlı kriter: ${a.zeroCount}/${a.scoredCount}${a.comment ? `\n    Denetçi değerlendirmesi: ${a.comment}` : ""}`).join("\n");
  const weakest = [...m.scored].filter(c => (c.score as number) <= 2).sort((a, b) => b.lost - a.lost).slice(0, 30)
    .map(c => `- ${c.id} ${c.topic} (${c.score}/5)${c.finding ? ` — Saha tespiti: ${c.finding}` : ""}`).join("\n");
  const best = m.bestPractices.slice(0, 8).map(b => `- ${b.criterion.id} ${b.criterion.topic}${b.why ? ` — ${b.why}` : ""}`).join("\n");
  const road = m.roadmap.map(w => `- ${w.when} ${w.title}: ${w.items.join("; ")}`).join("\n");
  return `Sen kıdemli bir Operasyonel Mükemmellik (OpEx / Yalın) danışmanısın. Aşağıdaki Yalın Olgunluk Değerlendirmesi sonuçlarını, fabrikanın üst yönetimine yapacağın kısa bir DANIŞMAN SUNUMU olarak özetle. Sunum akışı: neredeyiz → neyin üzerine inşa edeceğiz → en çok canımızı ne yakıyor → hızlı kazanımlar → öncelik sırası (1-2-3) → yönetimden beklenen kararlar → nasıl ölçeceğiz.

FİRMA: ${f.firm}
DENETİM: ${f.auditName || "—"}${f.auditDate ? ` (${f.auditDate})` : ""}
GENEL SKOR: ${n1(f.overall)} / 100 (${f.level}); HEDEF: ${f.target}; HEDEFE UZAKLIK: ${n1(f.gap)} puan
KRİTER DURUMU: ${f.criteriaScored} kriter puanlandı, ${f.lowCount} tanesi 0–1 puanda${f.unanswered ? `; ${f.unanswered} kriter henüz değerlendirilmedi (analiz ön değerlendirmedir)` : ""}
${f.previous ? `ÖNCEKİ DENETİM: ${f.previous.name} (${f.previous.date}) genel skor ${n1(f.previous.overall)} → şimdi ${n1(f.overall)}\n` : ""}${m.executiveSummary ? `DENETÇİNİN YÖNETİCİ ÖZETİ: ${m.executiveSummary}\n` : ""}
${findingsBlock(m)}ALAN SKORLARI VE DENETÇİ BÖLÜM DEĞERLENDİRMELERİ:
${areas}

EN ZAYIF KRİTERLER (puan ≤ 2) VE SAHA TESPİTLERİ:
${weakest || "(yok)"}

BEST PRACTICE / GÜÇLÜ UYGULAMALAR:
${best || "(yok)"}

DENETÇİNİN KENDİ YOL HARİTASI:
${road || "(girilmemiş)"}

KURALLAR:
- Hiçbir VAAT verme: belirli bir sürede hedef puana ya da skor artışına ulaşılacağını, tasarruf/kazanç/sonuç getireceğini yazma; süre taahhüdü ve sayısal skor sözü yok. Etkiyi yalnızca niteliksel anlat ("sahada görünürlük artar" gibi), "12 ayda 70 puan" türü ifadeler kesinlikle yasak.
- Yalnızca yukarıdaki verilere dayan; veride olmayan sayı, kişi, yatırım tutarı ya da sonuç UYDURMA. Finansal kazanç tahmini verme.
- Her madde, dayandığı kriter ID'lerini ("criteria") listelemeli; yalnızca yukarıda geçen ID'leri kullan.
- Türkçe, kısa, net, sahaya yakın. "Yapılmalıdır" tonu. Pazarlama dili ve genel geçer öneriler (ör. "eğitim verin") yok. Türkçe karşılığı olan sözcükleri Türkçe yaz (Daily → Günlük, Lean → Yalın). Sayıları Türkçe biçimde, en çok bir ondalıkla yaz (20,4; asla 20.44).
- Güçlü yönler: best practice kaydı yoksa, en yüksek skorlu alanları ve 3+ puanlı kriterleri "görece güçlü" diye göster; yine de liste boş kalmasın (hiç 3+ puanlı kriter yoksa boş bırak).
- Öncelikleri takvim aralığına (ay/hafta/gün) bağlama; sadece önem ve bağımlılık sırasına göre 1-2-3 diye sırala, "why" alanında sıranın gerekçesini yaz.
- Hızlı kazanım = yok denecek yatırım, mevcut kaynakla, hızla başlatılabilen, görünür etki; süre tahmini yazma. En etkili ve en kolay olan başta.
- Sadece JSON döndür, şu yapıda:
{"headline":"en çok 220 karakter: ${f.firm} için tek-iki cümlelik yönetici hükmü (skor, seviye, hedefe uzaklık, en büyük sorun)",
 "focus":[{"title":"en çok 70 kr: danışmanın ana problem dediği konu","detail":"en çok 220 kr: danışman yorumuna ve kanıta dayalı gerekçe","criteria":["G1.1"]}],
 "deprioritized":[{"topic":"en çok 70 kr: skoru düşük ama öncelik sayılmayan konu","reason":"en çok 160 kr: danışmanın yorumundaki gerekçe"}],
 "strengths":[{"title":"en çok 70 kr","detail":"en çok 200 kr: neden güçlü, nasıl yaygınlaştırılır","criteria":["E1.1"]}],
 "gaps":[{"title":"en çok 70 kr","detail":"en çok 220 kr: sahadaki kanıtla birlikte neden kritik","criteria":["G1.1"]}],
 "quickWins":[{"title":"en çok ${LIMITS.title} kr","action":"en çok ${LIMITS.action} kr: ne, nerede, kim yapar","impact":"en çok ${LIMITS.impact} kr","area":"alan adı","criteria":["E2.1"]}],
 "priorities":[{"title":"en çok 60 kr: tek bir ana iş paketi","why":"en çok 120 kr: neden bu sırada (bağımlılık / etki)","items":["en çok 120 kr"]}],
 "decisions":["en çok 140 kr: yönetimden beklenen karar"],
 "kpis":["en çok 140 kr: süreç/izleme göstergesi (örn. “günlük 5S turunun yapılma oranı”); skor ya da süre hedefi YAZMA"]}
- Danışman yorumu varsa "focus" 2–5 madde (danışmanların ana problem konuları; kendi cümleleriyle uyumlu) ve gerekçesi yazılı olanlar için "deprioritized"; yorum yoksa ikisi de boş liste ve sunum yalnızca skorlara dayanır. "gaps" skor kaynaklı boşlukları, "focus" danışman kaynaklı önceliği gösterir; aynı konuyu ikisinde tekrarlama.
- Adet: strengths 2–4, gaps 3–5, quickWins 4–${MAX_QUICK_WINS}, priorities tam 3 öncelik (önem sırasıyla; 1 = önce başlanacak ve diğerlerinin önkoşulu; her birinde 2–4 madde), decisions 3–4, kpis 3–4.`;
}

const validIds = (m: ReportModel) => new Set(m.criteria.map(c => c.id));
const ids = (v: unknown, ok: Set<string>): string[] => (Array.isArray(v) ? v : []).map(x => String(x).trim()).filter(x => ok.has(x)).slice(0, 4);
const points = (v: unknown, ok: Set<string>, max: number): BriefPoint[] =>
  (Array.isArray(v) ? v : []).map((o: any) => ({ title: clip(o?.title, 70), detail: clip(o?.detail, 230), criteria: ids(o?.criteria, ok) }))
    .filter(p => p.title && p.detail).slice(0, max);

export function normalizeBrief(raw: any, m: ReportModel, facts: BriefFacts): ConsultantBrief {
  const ok = validIds(m);
  const priorities: BriefPriority[] = (Array.isArray(raw?.priorities) ? raw.priorities : []).map((w: any) => ({
    title: clip(w?.title, 60),
    why: clip(w?.why, 130),
    items: (Array.isArray(w?.items) ? w.items : []).map((i: unknown) => clip(i, 130)).filter(Boolean).slice(0, 4),
  })).filter((w: BriefPriority) => w.title || w.items.length).slice(0, 3);
  const strs = (v: unknown, n: number) => (Array.isArray(v) ? v : []).map(x => clip(x, 150)).filter(Boolean).slice(0, n);
  const brief: ConsultantBrief = {
    generatedAt: new Date().toISOString(),
    facts,
    headline: clip(raw?.headline, 240),
    focus: points(raw?.focus, ok, 5),
    deprioritized: (Array.isArray(raw?.deprioritized) ? raw.deprioritized : []).map((d: any) => ({ topic: clip(d?.topic, 70), reason: clip(d?.reason, 170) })).filter((d: { topic: string; reason: string }) => d.topic && d.reason).slice(0, 4),
    strengths: points(raw?.strengths, ok, 4),
    gaps: points(raw?.gaps, ok, 5),
    quickWins: normalizeQuickWins(raw?.quickWins, ok),
    priorities,
    decisions: strs(raw?.decisions, 4),
    kpis: strs(raw?.kpis, 4),
  };
  if (!brief.headline || (brief.gaps.length === 0 && brief.quickWins.length === 0)) throw new Error("yapay zeka kullanılabilir bir sunum döndürmedi");
  return brief;
}

export async function generateConsultantBrief(m: ReportModel, facts: BriefFacts, timeoutMs = 50000): Promise<ConsultantBrief> {
  return normalizeBrief(await geminiJson(buildPrompt(m, facts), timeoutMs), m, facts);
}
