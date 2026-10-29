// CI opportunity pool (plan step C5, requirement B2): improvement points found by the other modules,
// offered when a CI project is started. Built on the server from stored data (so every device sees
// the same pool); each item names its source and, once a project was opened from it, that project.
// Shared by client and server (server imports "../../utils/ciOpportunityPool.js"); dependency-free.
//
// Sources: Loss Capacity analysis (recovery matrix saved by the Loss Analysis screen), cost table
// (process records), OpEx assessment (low-scored questions of the latest audit), Kaizen suggestions
// (approved, not yet implemented) and PTR field actions (open, flagged as critical).
// No amounts are invented: an item shows a loss / gain only when its source recorded one.

export type CiOpportunitySource = "loss" | "cost" | "opex" | "kaizen" | "ptr" | "vsm";

export const CI_OPPORTUNITY_SOURCES: Record<CiOpportunitySource, { label: string; hint: string }> = {
  loss: { label: "Loss Capacity", hint: "Loss Capacity analizinde iyileştirme matrisi oluşunca gelir." },
  cost: { label: "Maliyet tablosu", hint: "Süreç kayıtlarına hurda / rework / duruş / israf maliyeti girilince gelir." },
  opex: { label: "OpEx denetimi", hint: "Son OpEx denetiminde 0–2 puan alan sorular." },
  kaizen: { label: "Kaizen önerisi", hint: "Kurul onaylı, henüz uygulanmamış öneriler." },
  ptr: { label: "PTR aksiyonu", hint: "Kritik işaretli, açık saha aksiyonları." },
  vsm: { label: "VSM kaizen", hint: "VSM gelecek durum haritasındaki tamamlanmamış kaizen patlamaları." }
};

export interface CiOpportunity {
  id: string;                    // stable: the same finding keeps its id (older ids kept for loss / cost)
  source: CiOpportunitySource;
  title: string;
  detail: string;
  department?: string;
  leanTool?: string;
  currentLoss?: number;          // annual, customer currency — only when the source recorded it
  expectedGain?: number;         // annual, customer currency — only when the source recorded it
  scalable?: boolean;            // loss items: scaled by the chosen product family share on the client
  priority: "High" | "Medium" | "Low";
  ref?: string;                  // human readable source reference (question id, suggestion no, week …)
  convertedProjectId?: string;   // set when a CI project was already opened from this item
  convertedProjectNo?: string;
}

const LOSS_DETAIL: Record<string, string> = {
  "Setup Süreleri (SMED)": "Tip/model değişimlerinde harcanan verimsiz ayar süreleri ve bağlı kapasite kaybı.",
  "Hurda Maliyeti": "Hatalı parça, ıskarta ve hammaddenin neden olduğu doğrudan malzeme ve işçilik kaybı.",
  "Fire & Malzeme Kayıpları": "Kesim, kenar ve proses içi fireler ile taşımada ziyan olan malzeme maliyeti.",
  "Plansız Duruşların Önlenmesi": "Mekanik, elektrik ve otomasyon kaynaklı plansız duruşların kullanılabilirlik kaybı.",
  "OEE İyileştirmesi": "Küçük duruşlar, hız kayıpları ve hurda nedeniyle OEE'nin hedefin altında kalması.",
  "Yeniden İşleme (Rework)": "İlk seferde doğru üretilemeyen parçaların tamir ve yeniden işleme kaybı.",
  "Operasyonel Verimsizlik": "İstasyonlar arası yük ve çevrim süresi dengesizliği kaynaklı işçilik israfı.",
  "Operatör Verimliliği": "Standart dışı hareket, bekleme ve düşük OLE kaynaklı adam-saat kaybı.",
  "WIP (Yarı Mamul) Azaltımı": "Proses aralarında biriken yarı mamul stoku, alan ve sermaye maliyeti.",
  "Lead Time (Sipariş Çevrimi)": "Bekleme ve taşıma sürelerinin uzunluğu nedeniyle teslim süresinin uzaması.",
  "Fazla Mesai Azaltımı": "Planlama yetersizliği ve verimsizliklerden doğan fazla mesai maliyeti.",
  "Sevkiyat Performansı": "OTIF aksamalarından doğan ceza ve gecikme riski."
};

export function departmentFor(subject: string): string {
  const s = subject.toLocaleLowerCase("tr");
  if (s.includes("setup") || s.includes("smed")) return "Pres Atölyesi";
  if (s.includes("hurda") || s.includes("fire") || s.includes("rework") || s.includes("kalite")) return "Kalite Güvence";
  if (s.includes("duruş") || s.includes("oee") || s.includes("bakım")) return "Bakım Onarım";
  if (s.includes("operatör") || s.includes("verimsizlik") || s.includes("hareket")) return "Endüstri Mühendisliği";
  if (s.includes("wip") || s.includes("lead") || s.includes("sevkiyat") || s.includes("bekleme") || s.includes("taşıma")) return "Lojistik / Depo";
  if (s.includes("fazla üretim")) return "Üretim Planlama";
  return "Üretim / Montaj";
}

const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined; };

// Loss Capacity recovery matrix (as saved by the Loss Analysis screen). Ids match the ones the old
// in-browser wizard used ("opp_lc_<subject>"), so projects opened before keep their link.
export function lossOpportunities(snapshot: any): CiOpportunity[] {
  const rows: any[] = Array.isArray(snapshot?.recoveryMatrixData) ? snapshot.recoveryMatrixData : [];
  return rows.filter(r => r?.subject).map(r => ({
    id: `opp_lc_${slug(String(r.subject))}`,
    source: "loss" as const,
    title: String(r.subject),
    detail: LOSS_DETAIL[r.subject] || `${r.subject} alanında Loss Capacity analizinin ortaya çıkardığı kayıp.`,
    department: departmentFor(String(r.subject)),
    leanTool: r.leanTool || undefined,
    currentLoss: num(r.avgLoss),
    expectedGain: num(r.avgGain),
    scalable: true,
    priority: r.severity === "Critical" || r.severity === "High" ? "High" as const : "Medium" as const,
    ref: snapshot?.updatedAt ? `Analiz ${String(snapshot.updatedAt).slice(0, 10)}` : undefined
  }));
}

const COST_BUCKETS = [
  { subject: "Hurda Maliyeti", field: "scrapCost", tool: "Poka-Yoke & Kalite Otonomasyonu" },
  { subject: "Yeniden İşleme (Rework)", field: "reworkCost", tool: "FTT & Kök Neden Analizi" },
  { subject: "Plansız Duruşlar", field: "downtimeCost", tool: "Otonom & Planlı Bakım (TPM)" },
  { subject: "Bekleme Kaybı", field: "waitingLoss", tool: "Hat Dengeleme & Yamazumi" },
  { subject: "Taşıma Kaybı", field: "transportationLoss", tool: "Milk-Run & Yerleşim İyileştirme" },
  { subject: "Hareket İsrafı", field: "motionLoss", tool: "Standart İş & Ergonomi" },
  { subject: "Fazla Üretim", field: "overproductionLoss", tool: "Kanban & Çekme Sistemi" }
];

// Cost-table (process) records, largest recorded losses first. Ids match the old wizard
// ("opp_proc_<processId>_<field>"). No recovery share is assumed — only the recorded loss is shown.
export function costOpportunities(processes: any[], max = 10): CiOpportunity[] {
  return (processes || [])
    .flatMap(p => COST_BUCKETS.map(b => ({ p, b, value: num(p?.[b.field]) })))
    .filter(x => x.value)
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, max)
    .map(({ p, b, value }) => ({
      id: `opp_proc_${p.id}_${b.field}`,
      source: "cost" as const,
      title: `${p.name || "Süreç"} — ${b.subject}`,
      detail: `Maliyet tablosunda bu süreç için kayıtlı yıllık ${b.subject.toLocaleLowerCase("tr")} tutarı.`,
      department: departmentFor(b.subject),
      leanTool: b.tool,
      currentLoss: value,
      priority: (value || 0) > 100000 ? "High" as const : "Medium" as const,
      ref: p.name
    }));
}

// Low-scored (0–2) questions of the customer's latest OpEx audit (completed preferred), weakest and
// heaviest first.
export function opexOpportunities(assessments: any[], questions: any[], categories: any[], max = 15): CiOpportunity[] {
  const sorted = [...(assessments || [])].sort((a, b) => String(b.completed_at || b.updated_at || b.created_at || "").localeCompare(String(a.completed_at || a.updated_at || a.created_at || "")));
  const audit = sorted.find(a => a.status === "completed") || sorted.find(a => a.answers && Object.keys(a.answers).length);
  if (!audit) return [];
  const answers: Record<string, number> = audit.answers || {};
  const catName = (id: string) => categories.find(c => c.id === id)?.name || id;
  return (questions || [])
    .map(q => ({ q, score: answers[q.id] }))
    .filter(x => typeof x.score === "number" && x.score >= 0 && x.score <= 2)
    .sort((a, b) => (a.score - b.score) || ((b.q.weight || 0) - (a.q.weight || 0)))
    .slice(0, max)
    .map(({ q, score }) => ({
      id: `opp_opex_${audit.id}_${q.id}`,
      source: "opex" as const,
      title: `${catName(q.categoryId)} — ${q.subject || q.id}`,
      detail: `Puan ${score}/5${q.rubric?.[String(score)] ? ` (${q.rubric[String(score)]})` : ""}. İdeal durum: ${q.idealState || "—"}`,
      priority: score === 0 ? "High" as const : "Medium" as const,
      ref: `${q.id} · ${String(audit.completed_at || audit.updated_at || "").slice(0, 10)}`
    }));
}

// Kaizen suggestions approved by the board and not yet implemented — candidates that need a project.
export function kaizenOpportunities(suggestions: any[], max = 15): CiOpportunity[] {
  return (suggestions || [])
    .filter(s => s?.approvalStatus === "Second Approval" && !s.completed)
    .sort((a, b) => (Number(b.estimatedSaving) || 0) - (Number(a.estimatedSaving) || 0))
    .slice(0, max)
    .map(s => ({
      id: `opp_kaizen_${s.id}`,
      source: "kaizen" as const,
      title: s.subject || "Kaizen önerisi",
      detail: [s.currentState, s.improvementSuggestion && `Öneri: ${s.improvementSuggestion}`].filter(Boolean).join(" — "),
      department: s.personnelDepartment || undefined,
      expectedGain: !s.estimatedSavingCurrency || s.estimatedSavingCurrency === "TL" ? num(s.estimatedSaving) : undefined,
      priority: (Number(s.estimatedSaving) || 0) > 100000 ? "High" as const : "Medium" as const,
      ref: [s.personnelName, s.estimatedSaving ? `${Number(s.estimatedSaving).toLocaleString("tr-TR")} ${s.estimatedSavingCurrency || ""}`.trim() : ""].filter(Boolean).join(" · ")
    }));
}

// Open PTR field actions flagged as critical.
export function ptrOpportunities(records: any[], max = 15): CiOpportunity[] {
  return (records || [])
    .filter(r => r?.flagged && !["Kapalı", "İptal"].includes(String(r.status || "").trim()))
    .slice(0, max)
    .map(r => ({
      id: `opp_ptr_${r.id}`,
      source: "ptr" as const,
      title: r.improvementSubject || r.activitySubject || "Saha aksiyonu",
      detail: [r.workDone, r.notes].filter(Boolean).join(" — ") || "PTR saha aksiyonu.",
      priority: "High" as const,
      ref: [r.year && r.visitedWeek ? `${r.year}/H${r.visitedWeek}` : "", r.responsible].filter(Boolean).join(" · ")
    }));
}

// Kaizen bursts of the customer's VSM projects that are not done yet (plan step V6). Amounts are never
// invented — a burst has a target text, not a money figure.
const VSM_TOOL_BY_METRIC: Record<string, string> = {
  "Model değişim (C/O)": "SMED", "Çevrim süresi (C/T)": "Hat dengeleme / hücre", "Stok / WIP": "Çekme sistemi / kanban",
  "OEE / Uptime": "TPM", "Hurda / Kalite": "Poka-yoke", "Lead time": "Akış / heijunka", "Operatör": "Standart iş"
};
export function vsmOpportunities(projects: any[], max = 40): CiOpportunity[] {
  const out: CiOpportunity[] = [];
  (projects || []).forEach(proj => {
    const all = Array.isArray(proj?.kaizenBursts) ? proj.kaizenBursts : [];
    const steps = [...(proj?.vsmProcesses || []), ...(proj?.futureState?.processes || [])];
    all.forEach((b: any, i: number) => {
      if (!b?.id || !b.title || b.status === "Tamamlandı") return;
      const stepName = steps.find((p: any) => p?.id === b.processId)?.name;
      out.push({
        id: `opp_vsm_${proj.id}_${b.id}`,
        source: "vsm",
        title: b.title,
        detail: [stepName && `Adım: ${stepName}`, b.target && `Hedef: ${b.target}`, b.description].filter(Boolean).join(" — ") || "VSM kaizen patlaması.",
        leanTool: VSM_TOOL_BY_METRIC[b.metric] || undefined,
        priority: b.loop === "Pacemaker döngüsü" ? "High" : "Medium",
        ref: [proj.name, `K${i + 1}`, b.dueDate].filter(Boolean).join(" · ")
      });
    });
  });
  return out.slice(0, max);
}

// Marks items already turned into a project (any project of the customer that isn't cancelled).
export function markConverted(items: CiOpportunity[], projects: any[], projectNo: (p: any) => string): CiOpportunity[] {
  return items.map(o => {
    const p = (projects || []).find(k => k?.opportunityId === o.id && k.holdState !== "cancelled");
    return p ? { ...o, convertedProjectId: p.id, convertedProjectNo: projectNo(p) } : o;
  });
}
