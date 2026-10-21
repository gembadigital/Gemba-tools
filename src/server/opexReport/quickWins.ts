import { GoogleGenAI } from "@google/genai";
import type { ReportModel } from "./model.js";

// "Hızlı Kazanım – Quick Win" page of the executive report: the consultant-facing shortlist of
// actions that are cheap and fast but visibly move the score. Drafted by Gemini from everything
// the audit produced (scores, section evaluations, executive summary, field findings, best
// practices, roadmap), then stored on the assessment (`quickWins`) so the page is stable between
// downloads and the evaluator can refine it.

export interface ReportQuickWin {
  title: string;
  action: string;
  impact: string;
  duration: string;
  area: string;
  criteria: string[];
}

export const MAX_QUICK_WINS = 6;
export const LIMITS = { title: 60, action: 170, impact: 110, duration: 24, area: 32 };

export const clip = (v: unknown, max: number): string => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "") + "…";
};

// Accepts the model's JSON (array, or { quickWins: [...] }) and returns only well-formed items.
export function normalizeQuickWins(raw: unknown, validCriterionIds: Set<string>): ReportQuickWin[] {
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.quickWins) ? (raw as any).quickWins : [];
  const out: ReportQuickWin[] = [];
  for (const it of list) {
    const o = it as any;
    const title = clip(o?.title, LIMITS.title);
    const action = clip(o?.action, LIMITS.action);
    if (!title || !action) continue;
    out.push({
      title,
      action,
      impact: clip(o?.impact, LIMITS.impact),
      duration: clip(o?.duration, LIMITS.duration),
      area: clip(o?.area, LIMITS.area),
      criteria: (Array.isArray(o?.criteria) ? o.criteria : []).map((c: unknown) => String(c).trim()).filter((c: string) => validCriterionIds.has(c)).slice(0, 4),
    });
    if (out.length >= MAX_QUICK_WINS) break;
  }
  return out;
}

// Consultant/auditor comments, shared by every AI prompt of the report. They outrank the scores:
// the consultants saw the plant, the scores only say how each question was rated.
export function findingsBlock(m: ReportModel): string {
  if (m.consultantFindings.length === 0) return "";
  const list = m.consultantFindings.map(f => `[${f.name}] ${f.text}`).join("\n\n");
  return `DANIŞMAN / DENETÇİ YORUMLARI (EN ÖNCELİKLİ REFERANS — skorlardan önce bunları esas al):
${list}

Bu yorumlar, denetimi yapan danışmanların sahada gördüğü ana problem konuları ve bağlamıdır. Öncelikleri bunlar belirler: danışmanın ana problem dediği konulara öncelik ver; danışmanın bağlam gerekçesiyle öncelik saymadığı konuları (ör. ekipman azlığı nedeniyle SMED, ya da müşteri uygulamıyor ama öncelikli değil) skoru düşük olsa bile hızlı kazanım ve öncelik listesinin içine KOYMA. Birden fazla danışman yazdıysa hepsini birleştir; çelişki varsa uydurma bir uzlaşma yazma, çelişkiyi açıkça belirt.

`;
}

function buildPrompt(m: ReportModel): string {
  const areas = m.areas.map(a => `- ${a.id} ${a.name}: ${a.score.toFixed(1)}/100 (${a.level.name})${a.comment ? ` — Denetçi değerlendirmesi: ${a.comment}` : ""}`).join("\n");
  const weakest = [...m.scored]
    .filter(c => (c.score as number) <= 2)
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 30)
    .map(c => `- ${c.id} ${c.topic} (puan ${c.score}/5)${c.finding ? ` — Saha tespiti: ${c.finding}` : ""}`)
    .join("\n");
  const best = m.bestPractices.slice(0, 8).map(b => `- ${b.criterion.id} ${b.criterion.topic}`).join("\n");
  const road = m.roadmap.map(w => `- ${w.when} ${w.title}: ${w.items.join("; ")}`).join("\n");
  return `Sen kıdemli bir Operasyonel Mükemmellik (OpEx / Yalın) danışmanısın. Aşağıdaki Yalın Olgunluk Değerlendirmesi sonuçlarından, danışmanın müşteri yönetimine sunacağı TEK SAYFALIK "Hızlı Kazanım (Quick Win)" listesini çıkar.

Hızlı kazanım = yok denecek yatırımla, mevcut kaynaklarla hızla başlatılabilen ve sahayı görünür biçimde iyileştiren aksiyon. Uzun vadeli, yatırım gerektiren ya da genel geçer (ör. "eğitim verin") öneriler verme. Her aksiyon aşağıdaki verilere dayanmalı ve somut olmalı (ne, nerede, kim yapar).

FİRMA: ${m.firm}
GENEL SKOR: ${m.overall} / 100 (${m.level.name}); HEDEF: ${m.target}
${findingsBlock(m)}${m.executiveSummary ? `YÖNETİCİ ÖZETİ: ${m.executiveSummary}\n` : ""}
ALAN SKORLARI VE DENETÇİ BÖLÜM DEĞERLENDİRMELERİ:
${areas}

EN ZAYIF KRİTERLER (puan ≤ 2) VE SAHA TESPİTLERİ:
${weakest || "(yok)"}

BEST PRACTICE OLARAK İŞARETLENENLER (yaygınlaştırma fırsatı olabilir):
${best || "(yok)"}

DENETÇİNİN YOL HARİTASI:
${road || "(girilmemiş)"}

KURALLAR:
- Hiçbir VAAT verme: belirli bir sürede hedef puana ya da skor artışına ulaşılacağını, tasarruf/kazanç/sonuç getireceğini yazma; süre taahhüdü ve sayısal skor sözü yok. Etkiyi yalnızca niteliksel anlat ("sahada görünürlük artar" gibi), "12 ayda 70 puan" türü ifadeler kesinlikle yasak.
- 4 ile ${MAX_QUICK_WINS} arasında hızlı kazanım üret; en etkili ve en kolay olan başta olsun.
- Türkçe yaz, "yapılmalıdır" tonunda, kısa ve net cümleler kullan. Pazarlama dili ve genel laflar kullanma.
- Yalnızca yukarıdaki verilerde geçen kriter ID'lerini kullan; veride olmayan bir şey uydurma.
- Sadece JSON döndür: {"quickWins":[{"title":"en çok ${LIMITS.title} karakter","action":"en çok ${LIMITS.action} karakter: ne yapılacak","impact":"en çok ${LIMITS.impact} karakter: beklenen etki","area":"ilgili alan adı","criteria":["E1.1","E2.3"]}]}`;
}

let client: GoogleGenAI | null = null;

// One Gemini call that must return JSON; shared by the Quick Win page and the consultant brief.
export async function geminiJson(prompt: string, timeoutMs: number): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY tanımlı değil");
  client = client || new GoogleGenAI({ apiKey });
  const call = client.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("yapay zeka yanıtı zaman aşımına uğradı")), timeoutMs); });
  try {
    const resp = await Promise.race([call, timeout]);
    const text = (resp.text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(text);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function generateQuickWins(m: ReportModel, timeoutMs = 18000): Promise<ReportQuickWin[]> {
  const raw = await geminiJson(buildPrompt(m), timeoutMs);
  const items = normalizeQuickWins(raw, new Set(m.criteria.map(c => c.id)));
  if (items.length === 0) throw new Error("yapay zeka kullanılabilir bir liste döndürmedi");
  return items;
}
