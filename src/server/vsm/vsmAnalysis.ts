// VSM AI analysis (plan step V12, user decision 6): Gemini reads the saved VSM project — demand / takt,
// processes, stocks, timeline, bottleneck, future state, design answers, kaizen bursts — plus a short
// summary of the customer's other modules, and returns findings and VSM-specific guidance (where
// continuous flow / supermarket / FIFO, pacemaker, leveling, pitch, which kaizen first).
// All figures are computed here with the same engine as the screens; the model is told to use only them.
import { geminiJson, clip } from "../opexReport/quickWins.js";
import { normalizeVsmProject } from "../../components/vsm/vsmNormalize.js";
import {
  compareStates, computeAll, demandOf, endStockDays, flowSummary, netAvailableSecondsPerDay, pitchOf, shiftsForTakt,
  taktCheck, taktTimeOf, withInventoryDays
} from "../../components/vsm/vsmCalc.js";
import { effectiveFutureSetup } from "../../components/vsm/vsmFuture.js";
import { suppliersOf } from "../../components/vsm/vsmTypes.js";

export interface VsmAiAnalysis {
  generatedAt: string;
  by?: string;
  model: string;
  summary: string;
  findings: { title: string; detail: string }[];
  flowGuidance: { area: string; recommendation: string; why: string }[];
  kaizenPriorities: { title: string; why: string; burst?: string }[];
  questions: string[];
  dataGaps: string[];
}

export interface VsmOtherModules {
  lossTop?: { subject: string; avgLoss: number }[];
  opexOverall?: number | null;
  openCiProjects?: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildVsmFacts(project: any, customerName: string, other: VsmOtherModules) {
  const n = normalizeVsmProject(project);
  const s = n.setup;
  const demand = demandOf(s);
  const current = computeAll(n.processes);
  const takt = taktTimeOf(netAvailableSecondsPerDay(s, shiftsForTakt(s, current)), demand.daily);
  const ends = endStockDays(s, demand.daily);
  const curFlow = flowSummary(withInventoryDays(current, demand.daily), ends);
  const futureRaw = Array.isArray(project.futureState?.processes) && project.futureState.processes.length ? project.futureState.processes : null;
  const fSetup = effectiveFutureSetup(s, project.futureState?.setup);
  const future = futureRaw ? computeAll(futureRaw) : null;
  const cmp = future ? compareStates(current, future, demand.daily, s, fSetup) : null;
  const check = taktCheck(current, takt, demand.daily);
  const stock = (p: any) => p.inventoryType ?? (p.isSupermarket ? "supermarket" : "pile");
  const bursts = Array.isArray(project.kaizenBursts) ? project.kaizenBursts : [];
  const stepName = (id?: string) => [...current, ...(future || [])].find(p => p.id === id)?.name;

  return {
    customer: customerName,
    project: project.name,
    productFamily: s.productFamily || null,
    scope: [s.scopeStart, s.scopeEnd].filter(Boolean).join(" → ") || null,
    demand: { weekly: demand.weekly, daily: demand.daily, workingDays: s.workingDays, shiftsPerDay: s.shiftsPerDay ?? null, orderType: s.orderType || null },
    taktSec: takt || null,
    pitchSec: pitchOf(takt, s.packSize) || null,
    informationFlow: {
      customerToPlanning: [s.customerOrderFrequency, s.customerOrderChannel].filter(Boolean).join(" · ") || null,
      planningToSupplier: [s.supplierOrderFrequency, s.supplierOrderChannel].filter(Boolean).join(" · ") || null,
      planningSystem: s.planningSystem || null,
      schedule: s.scheduleMode === "pacemaker" ? `pacemaker: ${stepName(s.pacemakerProcessId) ?? "?"}` : "her prosese"
    },
    suppliers: suppliersOf(s).map(x => ({ name: x.name, material: x.material ?? null, delivery: x.delivery ?? null, leadTime: x.leadTime ?? null })),
    endStocks: { rawMaterial: s.rawMaterialQty ?? null, rawDays: ends.rawDays, finishedGoods: s.finishedGoodsQty ?? null, fgDays: ends.fgDays },
    currentState: {
      leadTimeDays: curFlow.leadTimeDays, valueAddedSec: curFlow.processingSeconds, pcePct: Math.round(curFlow.pcePct * 1000) / 1000,
      totalWip: curFlow.totalWip, overTaktSteps: check.overTaktCount, shortOfDemandSteps: check.shortOfDemandCount,
      bottleneck: check.constraintName || null, bottleneckCtSec: check.constraintCt || null,
      steps: current.map(p => ({
        name: p.name, ctSec: p.cycleTime, coMin: p.changeoverTime ?? null, uptimePct: p.availability, oeePct: p.oee, fpyPct: p.quality,
        operators: p.operatorCount, machines: p.machineCount, wipBefore: p.inventoryBefore,
        wipDays: demand.daily > 0 ? r1(p.inventoryBefore / demand.daily) : null, stockType: stock(p), batch: p.batchSize ?? null,
        epei: p.epei ?? null, variants: p.variantCount ?? null, capacityPerDay: p.capacity
      }))
    },
    futureState: future && cmp ? {
      steps: future.map(p => ({ name: p.name, ctSec: p.cycleTime, operators: p.operatorCount, stockType: stock(p), kanban: !!p.isKanbanEnabled, mergedFrom: p.mergedFrom?.map(stepName) ?? null })),
      leadTimeDays: cmp.futureLeadTime, totalWip: cmp.futureWip, pcePct: cmp.futureVaRatio, bottleneck: cmp.futureBottleneckName,
      schedule: fSetup.scheduleMode === "pacemaker" ? `pacemaker: ${stepName(fSetup.pacemakerProcessId) ?? "?"}` : "her prosese"
    } : null,
    designAnswers: project.futureState?.designAnswers || {},
    kaizenBursts: bursts.map((b: any, i: number) => ({ no: `K${i + 1}`, title: b.title, map: b.map, step: stepName(b.processId) ?? null, target: b.target ?? null, loop: b.loop ?? null, status: b.status ?? "Açık", due: b.dueDate ?? null })),
    otherModules: other
  };
}

function buildPrompt(facts: ReturnType<typeof buildVsmFacts>): string {
  return `Sen deneyimli bir yalın üretim danışmanısın ve bir Değer Akış Haritası (VSM) çalışmasını değerlendiriyorsun.
Aşağıdaki JSON, kayıtlı VSM projesinden hesaplanmış verilerdir. Kurallar:
- YALNIZCA bu verilerdeki sayıları ve adları kullan; sayı uydurma, tahmini tutar/yüzde yazma. Bir değer yoksa "dataGaps" listesine yaz.
- Türkçe, kısa ve somut yaz; her öneride ilgili adım adını kullan.
- VSM'e özgü yönlendir: takt'a göre darboğaz, sürekli akış (hücre) nerede, akışın kesildiği yerde süpermarket mi FIFO mu,
  pacemaker hangi adım, harmanlama (heijunka), pitch, bilgi akışı (elektronik/manuel, tek çizelge noktası), hammadde/mamul stokları.
- Gelecek durum varsa mevcutla karşılaştır; yoksa nasıl tasarlanacağını öner. Kaizen patlamaları varsa önceliklendir (K numarasıyla).

Yanıtı şu JSON biçiminde ver (başka metin yok):
{"summary": "3-4 cümle", "findings": [{"title": "", "detail": ""}], "flowGuidance": [{"area": "Darboğaz|Sürekli akış|Süpermarket|FIFO|Pacemaker|Harmanlama|Pitch|Bilgi akışı|Stok", "recommendation": "", "why": ""}], "kaizenPriorities": [{"title": "", "why": "", "burst": "K1 (varsa)"}], "questions": ["sahada doğrulanacak soru"], "dataGaps": ["eksik veri"]}
En fazla 6 bulgu, 8 akış önerisi, 6 kaizen önceliği, 5 soru, 6 eksik veri.

VERİ:
${JSON.stringify(facts)}`;
}

export function normalizeAnalysis(raw: any, by: string | undefined, model: string): VsmAiAnalysis {
  const arr = (v: any, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
  const out: VsmAiAnalysis = {
    generatedAt: new Date().toISOString(),
    by,
    model,
    summary: clip(raw?.summary, 700),
    findings: arr(raw?.findings, 6).map((f: any) => ({ title: clip(f?.title, 90), detail: clip(f?.detail, 400) })).filter((f: any) => f.title),
    flowGuidance: arr(raw?.flowGuidance, 8).map((f: any) => ({ area: clip(f?.area, 30), recommendation: clip(f?.recommendation, 300), why: clip(f?.why, 300) })).filter((f: any) => f.recommendation),
    kaizenPriorities: arr(raw?.kaizenPriorities, 6).map((f: any) => ({ title: clip(f?.title, 120), why: clip(f?.why, 300), ...(f?.burst ? { burst: clip(f.burst, 12) } : {}) })).filter((f: any) => f.title),
    questions: arr(raw?.questions, 5).map((q: any) => clip(q, 200)).filter(Boolean),
    dataGaps: arr(raw?.dataGaps, 6).map((q: any) => clip(q, 200)).filter(Boolean)
  };
  if (!out.summary && out.findings.length === 0 && out.flowGuidance.length === 0) throw new Error("yapay zeka kullanılabilir bir analiz döndürmedi");
  return out;
}

export async function generateVsmAnalysis(project: any, customerName: string, other: VsmOtherModules, by?: string, timeoutMs = 50000): Promise<VsmAiAnalysis> {
  const facts = buildVsmFacts(project, customerName, other);
  if (facts.currentState.steps.length === 0) throw new Error("Analiz için önce prosesleri girin ve kaydedin.");
  const raw = await geminiJson(buildPrompt(facts), timeoutMs);
  return normalizeAnalysis(raw, by, "gemini-3.5-flash");
}
