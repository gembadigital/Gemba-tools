// VSM — Proses ayrıntı çekmecesi (haritada karta tıklanınca).
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

const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

export default function VsmProcessDrawer() {
  const { setIsDrawerOpen, dailyDemand, processesWithTimeline, vsmCriticalPath, bottleneckProcess, activeProcess, handleUpdateProcessField, handleToggleNextProcess, handleSetConnectionType } = useVsm();
  return (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Content Area */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-950 text-white flex justify-between items-center">
              <div>
                <span className="text-[11px] bg-slate-800 text-slate-300 font-mono font-bold px-2 py-0.5 rounded uppercase">
                  OPERASYON DETAY VE KAYIP ANALİZİ
                </span>
                <h3 className="text-base font-black tracking-tight mt-1">{activeProcess.name}</h3>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white font-black cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Metrics List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-700">
              
              {/* Dynamic Warning if Bottleneck */}
              {activeProcess.id === bottleneckProcess?.id && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <div className="space-y-1">
                    <span className="font-extrabold text-red-900 uppercase">KRİTİK HAT DARBOĞAZI (BOTTLENECK)</span>
                    <p className="text-slate-700 leading-relaxed">
                      Bu istasyonun çevrim hızı ({activeProcess.cycleTime} saniye) hat genelindeki en yüksek süredir. Hattın nihai çıkış temposunu ve sevkiyat hacmini tamamen bu istasyon belirler.
                    </p>
                  </div>
                </div>
              )}

              {/* 1. Complete Process Information Form */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-1.5">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span>Proses Operasyonel Parametreler</span>
                </h4>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Operatör Sayısı (HC)</label>
                    <input 
                      type="number"
                      value={activeProcess.operatorCount}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "operatorCount", Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Makine Sayısı</label>
                    <input 
                      type="number"
                      value={activeProcess.machineCount}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "machineCount", Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Çevrim Süresi (CT - Saniye)</label>
                    <input 
                      type="number"
                      value={activeProcess.cycleTime}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "cycleTime", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">OEE Oranı (%) — hesaplanan</label>
                    {/* OEE is always computed (A × P × Q) from the Üretim / Kalite data, so it is shown read-only;
                        typing here used to be silently overwritten. */}
                    <div
                      className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-700"
                      title="Üretim & Kapasite ve Kalite sekmelerindeki verilerden hesaplanır"
                    >
                      {activeProcess.oee}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Ara Stok Seviyesi (WIP)</label>
                    <input 
                      type="number"
                      value={activeProcess.inventoryBefore}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "inventoryBefore", Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Arıza Duruşu (dk / gün)</label>
                    <input 
                      type="number"
                      value={activeProcess.downtimeMinutes}
                      onChange={(e) => {
                        // Breakdown time is what availability uses; keep both fields in step.
                        const minutes = Math.max(0, parseInt(e.target.value) || 0);
                        handleUpdateProcessField(activeProcess.id, "breakdownTime", minutes);
                        handleUpdateProcessField(activeProcess.id, "downtimeMinutes", minutes);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* NEXT PROCESS / GRAPH RELATIONSHIP EDITOR */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-1.5">
                  <GitCommit className="w-4 h-4 text-slate-500" />
                  <span>Süreç Akışı — Sonraki Proses</span>
                </h4>
                <p className="text-[10px] text-slate-500 -mt-1 leading-relaxed">
                  Bu prosesten sonra hangi proses(ler) devam ediyor? Birden fazla seçim paralel akış (split) oluşturur; birden fazla proses aynı hedefi seçerse orada otomatik birleşme (merge) noktası oluşur. Ok çizmenize gerek yok — şema otomatik oluşur.
                </p>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {processesWithTimeline.filter(p => p.id !== activeProcess.id).length === 0 && (
                    <div className="p-3 text-[11px] text-slate-400 italic">Bağlanacak başka proses yok.</div>
                  )}
                  {processesWithTimeline.filter(p => p.id !== activeProcess.id).map(p => {
                    const activeIdx = processesWithTimeline.findIndex(pp => pp.id === activeProcess.id);
                    const effectiveSuccessors = getEffectiveSuccessorIds(activeProcess, processesWithTimeline, activeIdx);
                    const isChecked = effectiveSuccessors.includes(p.id);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-2.5">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleToggleNextProcess(activeProcess.id, p.id, e.target.checked)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                        {isChecked && (
                          <select
                            value={(activeProcess.connectionTypes && activeProcess.connectionTypes[p.id]) || "Normal"}
                            onChange={(e) => handleSetConnectionType(activeProcess.id, p.id, e.target.value as VsmConnectionType)}
                            className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none shrink-0 cursor-pointer"
                          >
                            <option value="Normal">Normal</option>
                            <option value="Parallel">Paralel</option>
                            <option value="Merge">Birleşme</option>
                            <option value="Split">Dağılım</option>
                            <option value="Rework">Yeniden İşlem</option>
                            <option value="Kanban">Kanban</option>
                            <option value="Supermarket">Süpermarket</option>
                            <option value="External Supplier">Dış Tedarikçi</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Lead time contribution + critical path indicator */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold ${
                  vsmCriticalPath.criticalPathIds.has(activeProcess.id)
                    ? "bg-red-50 border border-red-200 text-red-700"
                    : "bg-slate-50 border border-slate-200 text-slate-600"
                }`}>
                  <span>Bu prosesin Lead Time katkısı (stok bekleme):</span>
                  <span className="font-mono">{activeProcess.inventoryDays} gün</span>
                </div>
                {vsmCriticalPath.criticalPathIds.has(activeProcess.id) && (
                  <p className="text-[10px] text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Bu proses, toplam Lead Time'ı belirleyen kritik yol (critical path) üzerinde.
                  </p>
                )}
              </div>

              {/* 2. OEE BREAKDOWN & SIX BIG LOSSES */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-1.5">
                  <Percent className="w-4 h-4 text-slate-500" />
                  <span>Altı Büyük Kayıp &amp; OEE Analizi (Six Big Losses)</span>
                </h4>

                <div className="space-y-3 text-xs">
                  {/* Availability */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">1. KULLANILABİLİRLİK (AVAILABILITY)</span>
                      <span className="text-slate-800">{activeProcess.availability}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full" style={{ width: `${activeProcess.availability}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400">Ekipmanın duruş kayıpları ve kalıp değişim (changeover) kayıplarını içerir.</p>
                  </div>

                  {/* Performance */}
                  <div className="space-y-1 pt-1.5">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">2. PERFORMANS ORANI (PERFORMANCE)</span>
                      <span className="text-slate-800">{activeProcess.performance}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full" style={{ width: `${activeProcess.performance}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400">Küçük duruşlar (micro-stops) ve hız kayıplarını (slow running) temsil eder.</p>
                  </div>

                  {/* Quality */}
                  <div className="space-y-1 pt-1.5">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">3. KALİTE ORANI (FPY YIELD)</span>
                      <span className="text-slate-800">{activeProcess.quality}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full" style={{ width: `${activeProcess.quality}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400">Iskarta (scrap), hurda ve yeniden işlem (rework) kayıplarını süzerek hesaplanır.</p>
                  </div>
                </div>
              </div>

              {/* 3. CAPACITY ANALYSIS & TIME STUDY */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-1.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Kapasite ve Standart İş Analizi</span>
                </h4>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Teorik Çıkış Kapasitesi:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {Math.round(activeProcess.capacity * 1.35)} Adet/Gün
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/60 pt-2">
                    <span className="text-slate-500 font-semibold">Net Fiili Kapasite:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {activeProcess.capacity} Adet/Gün
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/60 pt-2">
                    <span className="text-slate-500 font-semibold">Hedef Piyasa Talebi:</span>
                    <span className="font-mono font-bold text-amber-600">
                      {dailyDemand} Adet/Gün
                    </span>
                  </div>
                  <div className="border-t border-slate-200/60 pt-2">
                    <span className="text-[10px] text-slate-450 block font-mono">
                      *Talebe yetişme katsayısı: <span className="font-bold text-slate-800">{Math.round((activeProcess.capacity / (dailyDemand || 1)) * 100)}%</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. KAIZEN OPPORTUNITIES & IMPROVEMENT NOTES */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-1.5">
                  <Sparkles className="w-4 h-4 text-slate-500" />
                  <span>Kaizen Fırsatları &amp; İyileştirme Notları</span>
                </h4>

                <div className="space-y-2.5 text-xs font-semibold">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                    <span className="text-amber-800 text-[10px] uppercase font-mono block">Mevcut Tespit (Problem)</span>
                    <textarea 
                      value={activeProcess.notes}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "notes", e.target.value)}
                      className="w-full bg-transparent border-0 font-medium mt-1 leading-relaxed text-xs text-slate-800 focus:ring-0 focus:outline-none resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                    <span className="text-emerald-800 text-[10px] uppercase font-mono block">Kaizen Proje Teklifi</span>
                    <textarea 
                      value={activeProcess.kaizenOpp}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "kaizenOpp", e.target.value)}
                      className="w-full bg-transparent border-0 font-medium mt-1 leading-relaxed text-xs text-slate-800 focus:ring-0 focus:outline-none resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Close */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50 gap-2 shrink-0">
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                Kapat ve Değişiklikleri Uygula
              </button>
            </div>

          </div>
        </div>
  );
}
