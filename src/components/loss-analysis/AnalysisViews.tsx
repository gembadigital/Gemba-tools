import React, { useState } from "react";
import { CalculatedProcess, IndustryType } from "./types";
import { 
  DollarSign, Activity, AlertCircle, Percent, Anchor, 
  HelpCircle, ChevronRight, TrendingUp, BarChart2 
} from "lucide-react";

interface AnalysisViewsProps {
  calculated: CalculatedProcess[];
  revenue: number;
  copq: any;
  financialImpact: any;
  industry: IndustryType;
  currency: string;
  isDarkMode: boolean;
}

export default function AnalysisViews({
  calculated,
  revenue,
  copq,
  financialImpact,
  industry,
  currency,
  isDarkMode
}: AnalysisViewsProps) {
  const [selectedWhyStation, setSelectedWhyStation] = useState<string>("proc-4"); // default Varnishing
  const [fiveWhyLevel, setFiveWhyLevel] = useState<number>(5);

  // 5 Why Preset Database built on current table values
  const fiveWhyPresets: Record<string, {
    problem: string;
    whys: string[];
    rootCause: string;
  }> = {
    "proc-1": {
      problem: "Talaşlı İmalat (Machining) istasyonunda düşük OEE ve arıza duruşları",
      whys: [
        `İstasyon OEE değeri %${(calculated.find(p => p.id === "proc-1")?.oee || 78).toFixed(1)} ile hedefin oldukça altında.`,
        "Haftalık plansız makine arızaları sıklığı yüksek (Duruş: Vardiya başına 20 dâkika).",
        "Rulman yataklarında aşırı ısınma ve mil aşınması meydana geliyor.",
        "Zamanında yağlama yapılmadığı ve otonom yağ saati takvimi uygulanmadığı için rulmanlar aşınıyor.",
        "Yağ seviye kontrolleri operatörün inisiyatifine bırakılmış, tanımlı standart bir TPM kontrol kontrol prosedürü yok."
      ],
      rootCause: "TPM (Toplam Verimli Bakım) / Otonom Bakım Standart Eksikliği"
    },
    "proc-2": {
      problem: "Pres Şekillendirme istasyonunda yüksek setup/kalıp parça değişim kayıpları",
      whys: [
        "Hattaki kalıp kurulum ve değişim süresi ortalama 60 dakika sürüyor.",
        "Kalıp değişimi sırasında çok sayıda cıvata elle sökülüp takılıyor ve sık sık kayboluyor.",
        "Hızlı kalıp kilitleme (quick-clamping) standart cıvatasız mekanizmaları hatta tanımlanmamış.",
        "Pres kalıp arabaları ve kaldırma ekipmanları değişim anında hazır tutulmuyor, operatör o sırada vinç bekliyor.",
        "Önceden planlanmış bir SMED (Single Minute Exchange of Die) metodolojisi ve dışsal-içsel adım ayrımı yok."
      ],
      rootCause: "SMED Standardizasyon Eksikliği"
    },
    "proc-4": {
      problem: `Vernikleme (Varnishing) hattında yüksek duruş süresi (${calculated.find(p => p.id === "proc-4")?.setupTimeMinutes || 90} dk) ve düşük OEE`,
      whys: [
        "Sıvı vernik ve renk geçişlerinde yüksek yıkama ve setup süresi harcanıyor.",
        "Renk değişimlerinde nozül ve hortum temizliği makine durdurulduktan sonra el ile yapılıyor.",
        "Yedek püskürtme tabancaları ve temizlenecek hortumlar önceden hazırlanıp hattın yanına getirilmiyor.",
        "SMED metodolojisine göre içsel (makine dururken) ve dışsal (makine çalışırken) hazırlıklar ayrıştırılmamış.",
        "Alet, temizlik tinerleri ve yeni renk kartuşları ancak makine durduktan sonra aranmaya başlanıyor."
      ],
      rootCause: "SMED Yönetim Eksikliği ve Dışsal Kurulum Adımlarının Uygulanmaması"
    }
  };

  const activeWhy = fiveWhyPresets[selectedWhyStation] || fiveWhyPresets["proc-4"];

  // COPQ Trend list formatting
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(val) + " " + currency;
  };

  // Render variables for Economic Loss Tree
  const stepLosses = [
    { name: "Yıllık Ciro (Revenue)", value: revenue, pct: 100, color: "bg-slate-900 border-slate-950 text-white" },
    { name: "Malzeme Kayıpları (Material)", value: revenue * 0.45, pct: 45, color: "bg-amber-600 border-amber-700 text-white" },
    { name: "Kalitesizlik Maliyeti (Quality)", value: copq.totalCOPQ_TL * 0.4, pct: (copq.totalCOPQ_TL * 0.4 / revenue) * 100, color: "bg-rose-500 border-rose-600 text-white" },
    { name: "Setup / Kalıp Ayar Kayıpları", value: financialImpact.setup.year, pct: (financialImpact.setup.year / revenue) * 100, color: "bg-indigo-500 border-indigo-600 text-white" },
    { name: "Makine Arıza Duruş Kayıpları", value: financialImpact.downtime.year, pct: (financialImpact.downtime.year / revenue) * 100, color: "bg-sky-500 border-sky-600 text-white" },
    { name: "Yüksek Fazla Mesai (Overtime)", value: financialImpact.overtime.year, pct: (financialImpact.overtime.year / revenue) * 100, color: "bg-violet-500 border-violet-600 text-white" },
    { name: "Fazla Stok / Envanter Kayıpları", value: financialImpact.inventory.year, pct: (financialImpact.inventory.year / revenue) * 100, color: "bg-emerald-500 border-emerald-600 text-white" },
    { name: "Gizli Fabrika Kayıpları (Hidden)", value: revenue * 0.08, pct: 8, color: "bg-orange-500 border-orange-600 text-white" },
    { name: "Kâr Sızıntısı (Profit Leakage)", value: copq.totalCOPQ_TL, pct: copq.copqPercentOfRevenue, color: "bg-red-700 border-red-800 text-white animate-pulse" }
  ];

  return (
    <div className="space-y-6">
      
      {/* ECONOMIC LOSS TREE - WATERFALL CHART */}
      <div className={`rounded-xl border p-5 transition-all ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-black tracking-tight text-indigo-700 uppercase flex items-center">
              <Activity className="w-4 h-4 mr-1.5" />
              Economic Loss Tree & Waterfall Analyzer
            </h3>
            <p className="text-[10px] text-slate-450">
              Yıllık cirodan başlayarak tüm israf ve sızıntıların kademeli kâr daralmasına (Leakage) etkisini gösteren dinamik şelale grafik.
            </p>
          </div>
          <div className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-[10px] text-indigo-700 font-extrabold rounded-md uppercase">
            Finansal Değer Akışı
          </div>
        </div>

        {/* CUSTOM CSS WATERFALL CHART */}
        <div className="space-y-3.5 pt-2">
          {stepLosses.map((step, idx) => {
            const displayPct = step.pct.toFixed(1);
            const parentValue = idx === 0 ? revenue : stepLosses[idx-1].value;
            const percentageStepOfPrev = idx === 0 ? 100 : (step.value / parentValue) * 100;
            
            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-[11px] font-sans">
                  <span className="font-extrabold text-slate-700 flex items-center">
                    {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 mr-0.5" />}
                    {step.name}
                  </span>
                  <div className="font-mono text-slate-500 space-x-2">
                    <span className="font-bold text-slate-900">{formatMoney(step.value)}</span>
                    <span className="text-[10px] bg-slate-100 px-1 py-0.2 rounded font-extrabold">%{displayPct} Ciro</span>
                  </div>
                </div>
                {/* Progress bar waterfall container */}
                <div className="w-full bg-slate-150 h-3 rounded-full overflow-hidden flex">
                  {/* Offset to simulate cascade */}
                  <div 
                    style={{ width: `${Math.max(0, idx * 3.5)}%` }} 
                    className="h-full bg-transparent shrink-0" 
                  />
                  <div 
                    style={{ width: `${Math.max(2, Math.min(100 - (idx * 3.5), step.pct))}%` }} 
                    className={`h-full ${step.color} rounded-r-md transition-all duration-500`} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>



    </div>
  );
}
