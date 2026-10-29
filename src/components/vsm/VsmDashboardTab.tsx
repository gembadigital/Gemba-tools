// VSM — Mevcut ↔ gelecek karşılaştırma paneli, iş gücü analizi, hesaplanan özet.
// State and calculations come from useVsmWorkspace() through VsmContext.
import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  useFactory, 
} from "../../context/FactoryContext";
import { 
  Building2, Users, BarChart3, Clock, Settings, HelpCircle, 
  CheckCircle2, ChevronRight, Loader2, RefreshCw, FileText,
  User, Percent, GitCommit, Trash2, Plus, AlertTriangle,
  ChevronDown, ChevronUp, Activity, ArrowRight, Play, Save, Check, Award,
  Info, Sparkles, LayoutDashboard, Sliders, PlayCircle, ClipboardList, Zap, ArrowDownUp,
  Maximize2, Minimize2, ZoomIn, ZoomOut, Move, Download, Share2, Printer, CheckCircle,
  Cpu, ArrowUp, ArrowDown, GripVertical, Sun, Moon, DollarSign, Home
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell as RechartsCell
} from "recharts";
import { ProcessRecord, Customer } from "../../types";
import { VsmUserLike, canDeleteVsmProcess, canDeleteVsmProject } from "../../utils/vsmAccess";
import type { VsmConnectionType, VsmFactorySetup, VsmProcess } from "./vsmTypes";
import { getEffectiveSuccessorIds, isLinearFlow } from "./vsmGraph";
import {
  annualWasteCost, applySimulation, bottleneckOf, compareStates, computeAll, demandOf, flowSummary, highestDowntimeOf,
  highestInventoryOf, leadTimeOf, lowestOeeOf, netAvailableSecondsPerDay as netSecondsPerDay, simulationDeltas,
  taktTimeOf, withInventoryDays, workforceAnalysis as computeWorkforce
} from "./vsmCalc";
import { domToCanvas } from "modern-screenshot";
import { jsPDF } from "jspdf";

import { useVsm } from "./VsmContext";
import VsmIndicatorPanel from "./VsmIndicatorPanel";

const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

export default function VsmDashboardTab() {
  const { selectedProject, factorySetup, workforceMethod, setWorkforceMethod, currentProcessesCalculated, futureProcessesCalculated, companyCurrency, dailyDemand, taktTime, dashboardData, workforceAnalysis, dynamicAiSummary, drawSpeedometer, drawHalfDonut } = useVsm();
  return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 font-sans" id="vsm_dashboard_panel">
        
        {/* HEADER ROW WITH SIMULATION MODE CONTROL IN DASHBOARD TOO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-wider font-mono">VSM EXECUTIVE REPORT</span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight mt-1">Yalın Değer Akışı Simülasyon Analiz Paneli</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fabrika mevcut durum (baseline) verileri ile gelecek yalın durum simülasyonunun karşılaştırmalı analizi</p>
          </div>
          
          <div className="bg-indigo-950/80 border border-indigo-800/80 px-4 py-2 rounded-xl flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-indigo-200">
              Mevcut (Baseline) vs Gelecek Durum (Simülasyon) Yan Yana Karşılaştırma
            </span>
          </div>
        </div>

        <VsmIndicatorPanel />

        {/* İŞ GÜCÜ ANALİZİ (NORM KADRO / FAZLA İŞÇİLİK) SECTION */}
        <div className="space-y-5" id="vsm_workforce_analysis_section">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider font-mono text-slate-700">İş Gücü Analizi (Norm Kadro)</h3>
                <p className="text-[10px] text-slate-400">Mevcut VSM verilerinden hesaplanır — ek veri girişi gerekmez</p>
              </div>
            </div>

            <div className="flex items-center bg-slate-100 rounded-full p-1 text-xs font-bold" id="workforce_method_toggle">
              <button
                type="button"
                onClick={() => setWorkforceMethod("takt")}
                className={`px-3.5 py-1.5 rounded-full transition ${workforceMethod === "takt" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Takt Time
              </button>
              <button
                type="button"
                onClick={() => setWorkforceMethod("capacity")}
                className={`px-3.5 py-1.5 rounded-full transition ${workforceMethod === "capacity" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Kapasite Bazlı
              </button>
            </div>
          </div>

          {/* Method / inputs info panel */}
          <div className="flex items-start gap-2.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl px-4 py-3 text-[11px] text-indigo-900" id="workforce_method_info">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-500" />
            {workforceMethod === "takt" ? (
              <span>
                <b>Takt Time Bazlı:</b> Her proses için Gerekli İş Gücü = ⌈Çevrim Süresi (CT) / Takt Süresi⌉. Girdiler — Takt Süresi: <b>{taktTime} sn</b>, Toplam İş İçeriği (ΣCT): <b>{workforceAnalysis.totalWorkContentSeconds} sn</b>, Günlük Talep: <b>{dailyDemand} adet</b>.
              </span>
            ) : (
              <span>
                <b>Kapasite Bazlı:</b> Her proses için Gerekli İş Gücü = ⌈(Günlük Talep × CT) / (Net Üretim Süresi × OEE)⌉. Girdiler — Günlük Talep: <b>{dailyDemand} adet</b>, Vardiya Süresi: <b>{factorySetup.shiftDuration} sa</b>, Mola: <b>{factorySetup.breakTimes} dk</b>, Planlı Duruş: <b>{factorySetup.plannedMaintenance} dk</b>, proses bazında Vardiya Sayısı ve OEE.
              </span>
            )}
          </div>

          {/* Workforce KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_workforce_current">
              <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Mevcut İş Gücü</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{workforceAnalysis.totalMevcut} kişi</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                Proseslerdeki toplam operatör sayısı
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_workforce_required">
              <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Gerekli İş Gücü</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{workforceAnalysis.totalGerekli} kişi</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                {workforceMethod === "takt" ? "Takt Time bazlı hesaplama" : "Kapasite bazlı hesaplama"}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_workforce_surplus">
              <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">İş Gücü Fazlası / Yeniden Kullanım Potansiyeli</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{Math.abs(workforceAnalysis.surplus)} kişi</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">{workforceAnalysis.surplus >= 0 ? "Fazla İşçilik" : "Ek İhtiyaç"}</span>
                {workforceAnalysis.surplus >= 0 ? (
                  <span className="text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full">Yeniden Kullanılabilir</span>
                ) : (
                  <span className="text-rose-600 font-extrabold bg-rose-50 px-2 py-0.5 rounded-full">Takviye Gerekli</span>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_workforce_utilization">
              <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Kullanım Oranı</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">%{workforceAnalysis.utilizationPct}</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                Gerekli / Mevcut İş Gücü oranı
              </div>
            </div>

          </div>

          {/* Chart + per-process breakdown table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-80" id="chart_workforce_current_vs_required">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">Mevcut vs Gerekli İş Gücü</h4>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Proses Bazında</span>
              </div>
              <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workforceAnalysis.perProcess.map(p => ({
                    name: p.name.split(" ")[0],
                    Mevcut: p.mevcut,
                    Gerekli: p.gerekli
                  }))} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Mevcut" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Gerekli" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-80" id="table_workforce_breakdown">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">Proses Bazında Kadro Farkı</h4>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Kişi</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-slate-400 uppercase text-[10px] font-bold font-mono border-b border-slate-100">
                      <th className="py-2 pr-2">Proses</th>
                      <th className="py-2 px-2 text-center">Mevcut</th>
                      <th className="py-2 px-2 text-center">Gerekli</th>
                      <th className="py-2 pl-2 text-right">Fark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workforceAnalysis.perProcess.map(p => (
                      <tr key={p.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 pr-2 font-semibold text-slate-700 truncate max-w-[120px]">{p.name}</td>
                        <td className="py-2 px-2 text-center font-mono text-slate-600">{p.mevcut}</td>
                        <td className="py-2 px-2 text-center font-mono text-slate-600">{p.gerekli}</td>
                        <td className="py-2 pl-2 text-right">
                          <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${p.fark > 0 ? "text-emerald-600 bg-emerald-50" : p.fark < 0 ? "text-rose-600 bg-rose-50" : "text-slate-400 bg-slate-50"}`}>
                            {p.fark > 0 ? `+${p.fark}` : p.fark}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>

        {/* AI EXECUTIVE SUMMARY BOTTOM PANEL */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-indigo-500/20 relative overflow-hidden" id="ai_executive_summary_panel">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center space-x-2.5 mb-5 border-b border-white/10 pb-4">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider font-mono text-indigo-300">Hesaplanan Özet (Mevcut ↔ Gelecek Simülasyonu)</h3>
              <p className="text-[10px] text-slate-400">Girilen verilerden kural tabanlı üretilir; yapay zekâ analizi değildir. Gelecek durum bir simülasyondur, gerçekleşmiş sonuç değildir.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 text-xs font-medium leading-relaxed text-slate-200">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 font-mono block">En Büyük İyileşme Potansiyeli</span>
                <p className="text-slate-300">{dynamicAiSummary.biggestImprovement}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 font-mono block">Termin Süresi ve Envanter Analizi</span>
                <p className="text-slate-300">{dynamicAiSummary.leadTimeReduction}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 font-mono block">Kalite Güvence ve Pokayoke Etkisi</span>
                <p className="text-slate-300">{dynamicAiSummary.qualityImpact}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 font-mono block">Tahmini Yıllık Finansal Kazanç</span>
                <p className="text-slate-100 font-semibold">{dynamicAiSummary.annualSavingsDesc}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/5 text-[10px] text-slate-500 flex items-center justify-between font-mono">
            <span>{selectedProject?.name}</span>
            <span>Hesaplanan özet</span>
          </div>
        </div>

      </div>
  );
}
