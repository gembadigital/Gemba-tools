import React from "react";
import { CalculatedProcess, IndustryType } from "./types";
import { Activity, ChevronRight } from "lucide-react";

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
  // COPQ Trend list formatting
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(val) + " " + currency;
  };

  // Economic Loss Tree: revenue, then each priced loss line and the cost of poor quality. Material
  // cost is not a loss and is not shown; "hidden factory" is the sum of the lines above and would
  // double count. (Earlier: material = 45 % and hidden factory = 8 % of revenue, quality = 40 % of COPQ.)
  const pctOf = (v: number) => (revenue > 0 ? (v / revenue) * 100 : 0);
  const stepLosses = [
    { name: "Yıllık Ciro", value: revenue, pct: 100, color: "bg-slate-900 border-slate-950 text-white" },
    { name: "İç Hata: Hurda + Rework", value: copq.internalFailure, pct: pctOf(copq.internalFailure), color: "bg-rose-500 border-rose-600 text-white" },
    { name: "Setup / Kalıp Ayar Kayıpları", value: financialImpact.setup.year, pct: pctOf(financialImpact.setup.year), color: "bg-indigo-500 border-indigo-600 text-white" },
    { name: "Makine Arıza Duruş Kayıpları", value: financialImpact.downtime.year, pct: pctOf(financialImpact.downtime.year), color: "bg-sky-500 border-sky-600 text-white" },
    { name: "Norm Fazlası İşçilik", value: financialImpact.laborLoss.year, pct: pctOf(financialImpact.laborLoss.year), color: "bg-amber-600 border-amber-700 text-white" },
    { name: "Fazla Mesai (girilen gerçek tutar)", value: financialImpact.overtime.year, pct: pctOf(financialImpact.overtime.year), color: "bg-violet-500 border-violet-600 text-white" },
    { name: "Fazla Stok / Envanter Kayıpları", value: financialImpact.inventory.year, pct: pctOf(financialImpact.inventory.year), color: "bg-emerald-500 border-emerald-600 text-white" },
    { name: "Kalitesizlik Maliyeti Toplamı (COPQ)", value: copq.totalCOPQ_TL, pct: copq.copqPercentOfRevenue, color: "bg-red-700 border-red-800 text-white" }
  ];


  return (
    <div className="space-y-6">
      
      {/* ECONOMIC LOSS TREE - WATERFALL CHART */}
      <div className={`rounded-xl border p-5 transition-all ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-black tracking-tight text-indigo-700 uppercase flex items-center">
              <Activity className="w-4 h-4 mr-1.5" />
              Ekonomik Kayıp Ağacı ve Şelale Analizi
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
