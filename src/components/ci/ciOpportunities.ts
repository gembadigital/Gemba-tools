// Improvement opportunities offered by the new-project wizard. Moved out of KaizenManager (plan step
// C1). Sources, in order: the Loss Capacity analysis cached in this browser, else the customer's
// cost-table (process) records; nothing → empty list (no invented figures). Plan step C5 replaces this
// with a server-side opportunity pool fed by the other modules.
import type { ProcessRecord } from "../../types";
import type { CiProductFamily } from "../../utils/ciSettings";

export interface CiOpportunity {
  id: string;
  type: string;
  problem: string;
  currentCost: number;
  potential: number;
  expectedGain: number;
  priority: string;
  dept: string;
  leanTool: string;
  source: string;
  productFamily: string;
  area: string;
  assumed?: boolean;
}

export interface OpportunityInput {
  customerId?: string;
  processes: ProcessRecord[];
  productFamilies: CiProductFamily[]; // from CI settings
  selectedFamily: string;             // a family name, or "ALL" for the whole plant
}

export const ALL_FAMILIES = "ALL";
export const productFamilyLabel = (f: CiProductFamily) => `${f.name} (%${f.sharePct} Hacim Payı)`;

// Generate opportunities dynamically from Loss Capacity Analysis (COPQ / Cost Deployment Entegrasyonu)
export function generateOpportunities({ customerId, processes, productFamilies, selectedFamily }: OpportunityInput): CiOpportunity[] {
  // 1. Read stored Loss Capacity Analysis for the current customer
  const custId = customerId || "default";
  const savedLcStr = localStorage.getItem(`gemba_loss_capacity_${custId}`);
  let lcData: any = null;
  if (savedLcStr) {
    try {
      lcData = JSON.parse(savedLcStr);
    } catch (e) {
      console.error("Failed to parse gemba_loss_capacity", e);
    }
  }

  // Determine active Product Family Ratio and Label
  let familyRatio = 1.0;
  let familyLabel = "Tüm Fabrika Ürün Aileleri (%100 Hacim Payı)";

  const presetFamily = productFamilies.find(p => p.name === selectedFamily);
  if (presetFamily) {
    familyRatio = presetFamily.sharePct / 100;
    familyLabel = productFamilyLabel(presetFamily);
  } else if (lcData && lcData.selectedVsmProject && selectedFamily === lcData.selectedVsmProject.productGroup) {
    familyRatio = (lcData.selectedVsmProject.productVolumeShare || 30) / 100;
    familyLabel = `${lcData.selectedVsmProject.name} (${lcData.selectedVsmProject.productGroup} - %${lcData.selectedVsmProject.productVolumeShare || 30} Hacim Payı)`;
  }

  // Detailed problem definition mapping
  const getLossProblemDetail = (subject: string, costGroup?: string) => {
    switch (subject) {
      case "Setup Süreleri (SMED)":
        return "Pres, kalıphane ve montaj hatlarında tip/model değişimlerinde harcanan verimsiz ayar süreleri ve bağlı kapasite kaybı.";
      case "Hurda Maliyeti":
        return "Üretim sürecinde oluşan hatalı parça, ıskarta sac ve hammaddenin neden olduğu doğrudan malzeme ve işçilik kaybı.";
      case "Fire & Malzeme Kayıpları":
        return "Kesim, kenar ve proses içi fireler ile taşıma esnasında ziyan olan doğrudan malzeme maliyeti.";
      case "Plansız Duruşların Önlenmesi":
        return "Mekanik, elektriksel ve otomasyon kaynaklı plansız makine duruşlarının neden olduğu kullanılabilirlik kaybı.";
      case "OEE İyileştirmesi":
        return "OEE 6 büyük kayıp (küçük duruşlar, hız kayıpları, hurda) nedeniyle genel ekipman verimliliğinin hedefin altında kalması.";
      case "Yeniden İşleme (Rework)":
        return "İlk seferde doğru üretilemeyen parçaların tamir ve yeniden işlenmesi için harcanan ek işçilik ve enerji kaybı.";
      case "Operasyonel Verimsizlik":
        return "Hat içi istasyonlar arası yük ve çevrim süresi dengesizlikleri (Yamazumi darboğazları) kaynaklı işçilik israfı.";
      case "Operatör Verimliliği":
        return "Standart dışı hareketler, bekleme süreleri ve OLE (Overall Labor Effectiveness) yetersizliğinden kaynaklı adam-saat kaybı.";
      case "WIP (Yarı Mamul) Azaltımı":
        return "Proses aralarında biriken aşırı yarı mamul stoku, alan işgali ve kilitli çalışma sermayesi finansman maliyeti.";
      case "Lead Time (Sipariş Çevrimi)":
        return "Değer yaratmayan bekleme ve taşıma sürelerinin uzunluğu nedeniyle toplam sipariş teslim süresinin uzaması.";
      case "Fazla Mesai Azaltımı":
        return "Planlama yetersizliği ve verimsizliklerden doğan yüksek maliyetli fazla mesai işçilik yükü.";
      case "Sevkiyat Performansı":
        return "Lojistik, ambalajlama ve OTIF (Zamanında ve Eksiksiz Teslimat) aksamalarından doğan ceza ve gecikme riski.";
      default:
        return `${subject} alanında tespit edilen ve Loss Capacity Analizi ile ortaya çıkarılan finansal kayıp konusu.`;
    }
  };

  const getDeptForSubject = (subject: string) => {
    if (subject.includes("Setup") || subject.includes("SMED")) return "Pres Atölyesi";
    if (subject.includes("Hurda") || subject.includes("Fire") || subject.includes("Rework")) return "Kalite Güvence";
    if (subject.includes("Duruş") || subject.includes("OEE")) return "Bakım Onarım";
    if (subject.includes("Operatör") || subject.includes("Verimsizlik") || subject.includes("Hareket")) return "Endüstri Mühendisliği";
    if (subject.includes("WIP") || subject.includes("Lead") || subject.includes("Sevkiyat") || subject.includes("Bekleme") || subject.includes("Taşıma")) return "Lojistik / Depo";
    if (subject.includes("Fazla Üretim")) return "Üretim Planlama";
    return "Üretim / Montaj";
  };

  // Primary: If Loss Capacity Analysis has computed recoveryMatrixData, use as primary source of truth
  if (lcData && Array.isArray(lcData.recoveryMatrixData) && lcData.recoveryMatrixData.length > 0) {
    return lcData.recoveryMatrixData.map((item: any) => {
      const scaledLoss = Math.round((item.avgLoss || 100000) * familyRatio);
      const scaledGain = Math.round((item.avgGain || 60000) * familyRatio);
      const potPct = scaledLoss > 0 ? Math.round((scaledGain / scaledLoss) * 100) : 60;

      return {
        id: `opp_lc_${item.subject.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`,
        type: item.subject,
        problem: `${item.subject}: ${getLossProblemDetail(item.subject, item.costGroup)}`,
        currentCost: scaledLoss,
        potential: potPct,
        expectedGain: scaledGain,
        priority: item.severity === "Critical" || item.severity === "High" ? "High" : "Medium",
        dept: getDeptForSubject(item.subject),
        leanTool: item.leanTool || "Kaizen & Standart İş",
        source: "Loss Capacity Analizi (COPQ & Cost Deployment)",
        productFamily: familyLabel,
        area: item.area || "Doğrudan Maliyet Azaltma"
      };
    });
  }

  // Secondary source: no Loss Analysis cache found for this customer/browser — instead of jumping
  // straight to fully invented numbers, rank real cost-table (`processes`) records by their actual
  // recorded loss fields. This is real backend data (org+factory scoped), just not run through the
  // full Loss Analysis COPQ model, so it doesn't depend on that tab ever having been opened.
  type CostBucket = { subject: string; field: keyof ProcessRecord; tool: string };
  const costBuckets: CostBucket[] = [
    { subject: "Hurda Maliyeti", field: "scrapCost", tool: "Poka-Yoke & Kalite Otonomasyonu" },
    { subject: "Yeniden İşleme (Rework)", field: "reworkCost", tool: "Matriks Analizi & FTT" },
    { subject: "Plansız Duruşların Önlenmesi", field: "downtimeCost", tool: "Otonom & Planlı Bakım (TPM)" },
    { subject: "Bekleme Kaybı (Waiting Loss)", field: "waitingLoss", tool: "Hat Dengeleme & Yamazumi" },
    { subject: "Taşıma Kaybı (Transportation Loss)", field: "transportationLoss", tool: "Milk-Run & Yerleşim (Layout) İyileştirme" },
    { subject: "Hareket İsrafı (Motion Loss)", field: "motionLoss", tool: "Standart İş & Ergonomi Kaizeni" },
    { subject: "Fazla Üretim Kaybı (Overproduction)", field: "overproductionLoss", tool: "Kanban & Çekme Sistemi" }
  ];

  if (processes && processes.length > 0) {
    const ranked = processes
      .flatMap((proc) =>
        costBuckets.map((bucket) => ({
          proc,
          bucket,
          value: Number(proc[bucket.field]) || 0
        }))
      )
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    if (ranked.length > 0) {
      return ranked.map(({ proc, bucket, value }) => {
        const scaledLoss = Math.round(value * familyRatio);
        // Recovery potential is not measured (no Loss Analysis run for this data yet) — a
        // conservative 60% recoverable-via-Kaizen assumption is used and disclosed via `assumed`.
        const scaledGain = Math.round(scaledLoss * 0.6);
        return {
          id: `opp_proc_${proc.id}_${bucket.field}`,
          type: bucket.subject,
          problem: `${proc.name} — ${bucket.subject}: Maliyet tablosunda (İşlem Kayıtları) bu süreç için kayıtlı gerçek ${bucket.subject.toLowerCase()} tutarı.`,
          currentCost: scaledLoss,
          potential: 60,
          expectedGain: scaledGain,
          priority: scaledLoss > 100000 ? "High" : "Medium",
          dept: getDeptForSubject(bucket.subject),
          leanTool: bucket.tool,
          source: "Maliyet Tablosu / İşlem Kayıtları (gerçek veri — Loss Analysis çalıştırılmadı)",
          productFamily: familyLabel,
          area: "Doğrudan Maliyet Azaltma",
          assumed: true
        };
      });
    }
  }

  // No Loss Capacity Analysis has been run AND no cost-table (`processes`) records exist yet for
  // this customer — there is no real data to build an opportunity list from. This used to fall
  // back to fabricated illustrative loss figures (fixed fake amounts); that data was never real
  // and has been removed. The wizard shows an explicit empty state instead (see isEmptyOpportunityData).
  return [];
}
