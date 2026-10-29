// VSM — Değer akış haritası: tedarikçi, planlama, müşteri, proses kartları, akış okları, zaman çizgisi, KPI'lar.
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
import VsmMapCanvas from "./VsmMapCanvas";

const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

// "Günlük · Elektronik" — label on an information-flow arrow; empty when nothing was entered.
const infoLabel = (frequency?: string, channel?: string) => [frequency, channel].filter(Boolean).join(" · ");

export default function VsmMapTab() {
  const { mapLayout, handlePointerDown, handlePointerMove, handlePointerUp, handleWheelZoom, handleZoomFit, endStocks, pitchTime, valueAddedSeconds, selectedCustomer, factorySetup, simulationMode, zoom, pan, isPanning, isFullScreen, vsmBrightMode, setVsmBrightMode, canvasContainerRef, companyCurrency, weeklyDemand, dailyDemand, monthlyDemand, taktTime, processesWithTimeline, vsmGraphEdges, vsmGraphLayout, isFlowLinear, vsmCriticalPath, flow, totalLeadTimeDays, totalProcessingTimeSeconds, valueAddedRatio, vsmLaneSummaries, count, averageOee, averageCapacityUtilization, totalOperators, totalMachines, bottleneckProcess, highestDowntimeProcess, highestInventoryProcess, lowestOeeProcess, estimatedAnnualWasteCost, simulationComparison, handleSyncToCiProjects, handleZoomIn, handleZoomOut, handleZoomReset, handleMouseDown, handleMouseMove, handleMouseUp, handleOpenProcessDrawer } = useVsm();
  // Production control sends the schedule to every process (push) or only to the pacemaker.
  const receivesSchedule = (processId: string) =>
    factorySetup.scheduleMode !== "pacemaker" || !factorySetup.pacemakerProcessId || factorySetup.pacemakerProcessId === processId;

  return (
        <>
          {/* DETAILED COMPARATIVE METRIC STRIP (When Future mode is active) */}
          {simulationMode === "future" && (
            <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border-b border-amber-200/60 px-6 py-3.5 flex flex-wrap gap-x-8 gap-y-2 justify-between items-center font-sans animate-in fade-in duration-300">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
                <span className="text-xs font-extrabold text-amber-800 tracking-wide uppercase font-mono">
                  YALIN SİMÜLASYON SİMÜLATÖRÜ AKTİF (FUTURE STATE SIMULATION)
                </span>
                {!simulationComparison.hasEdits && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-200/80 px-2 py-0.5 rounded font-mono">
                    (Mevcut Parametreler Değiştirilmedi: 0% Fark)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6 text-xs font-semibold">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase font-mono">Lead Time Azalışı</span>
                  <span className="text-emerald-700 font-extrabold text-sm font-mono">-{simulationComparison.leadTimeReduction}%</span>
                </div>
                <div className="border-l border-amber-200 pl-6 flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase font-mono">Ara Stok (WIP) Azalışı</span>
                  <span className="text-emerald-700 font-extrabold text-sm font-mono">-{simulationComparison.inventoryReduction}%</span>
                </div>
                <div className="border-l border-amber-200 pl-6 flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase font-mono">Tahmini Yıllık Tasarruf</span>
                  <span className="text-amber-700 font-extrabold text-sm font-mono">{companyCurrency}{simulationComparison.costSavings.toLocaleString()}</span>
                </div>
                <button
                  onClick={handleSyncToCiProjects}
                  className="ml-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  title="VSM simülasyonundaki dar boğazları CI Proje Yönetimine aktar"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>CI Proje Yönetimine Aktar</span>
                </button>
              </div>
            </div>
          )}

      {/* MAIN CONTAINER: CANVAS ON TOP, KPIs BELOW */}
      <div className="w-full space-y-6 flex flex-col font-sans">
        
        {/* UPPER BLOCK: THE GRAPHIC VALUE STREAM CANVAS */}
        <div className={`w-full relative ${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'} border rounded-3xl overflow-hidden flex flex-col select-none ${isFullScreen ? 'h-[calc(100vh-100px)]' : 'h-[65vh] min-h-[420px] md:h-[720px]'}`}>
          
          {/* ZOOM, PAN, NAV OVERLAYS */}
          <div className={`absolute top-4 left-4 z-20 ${vsmBrightMode ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-slate-950/85 border-slate-800 text-white'} backdrop-blur-md border p-2 rounded-xl flex items-center space-x-2 shadow-xl`}>
            <button 
              onClick={handleZoomIn}
              className={`p-1.5 rounded-lg ${vsmBrightMode ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-800/60 text-slate-450 hover:text-white'} transition cursor-pointer`}
              title="Yakınlaştır"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button 
              onClick={handleZoomOut}
              className={`p-1.5 rounded-lg ${vsmBrightMode ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-800/60 text-slate-450 hover:text-white'} transition cursor-pointer`}
              title="Uzaklaştır"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button 
              onClick={handleZoomFit}
              className={`px-2.5 py-1 rounded-lg transition text-[10px] font-mono font-bold uppercase border cursor-pointer ${vsmBrightMode ? 'hover:bg-slate-100 text-slate-700 border-slate-200' : 'hover:bg-slate-800/60 text-slate-450 hover:text-white border-slate-800'}`}
              title="Ekrana sığdır"
            >
              FİT
            </button>
            <span className={`text-xs font-mono font-semibold px-1 ${vsmBrightMode ? 'text-slate-600' : 'text-slate-400'}`}>
              {Math.round(zoom * 100)}%
            </span>
            <div className={`w-px h-5 ${vsmBrightMode ? 'bg-slate-200' : 'bg-slate-800'} mx-1`} />
            <button
              onClick={() => setVsmBrightMode(!vsmBrightMode)}
              className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center`}
              title={vsmBrightMode ? "Karanlık Şemaya Geç" : "Aydınlık Şemaya Geç"}
            >
              {vsmBrightMode ? (
                <Moon className="w-4 h-4 text-slate-600 hover:text-slate-900" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400 hover:text-amber-300" />
              )}
            </button>
          </div>

          {/* LEGEND — standard VSM symbols used on the map */}
          <div className={`absolute top-4 right-4 z-20 hidden md:flex ${vsmBrightMode ? 'bg-white/95 border-slate-200 text-slate-600' : 'bg-slate-950/85 border-slate-800 text-slate-400'} backdrop-blur-md border px-3 py-1.5 rounded-xl items-center gap-3 shadow-xl text-[10px] font-mono font-bold uppercase tracking-wider`}>
            <span className="flex items-center gap-1"><span className="w-5 h-2.5 rounded-sm" style={{ background: "repeating-linear-gradient(45deg,#0284c7 0 3px,#e0f2fe 3px 6px)" }} />Push</span>
            <span className="flex items-center gap-1"><span className="w-5 h-2 border-y-2 border-sky-600" />FIFO</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 border-2 border-l-0 border-yellow-600 bg-yellow-100" />Süpermarket</span>
            <span className="flex items-center gap-1"><span className="px-1 bg-yellow-400 text-slate-900 rounded-sm">K</span>Kanban</span>
            <span className="flex items-center gap-1"><span className="text-amber-600">⚡</span>Elektronik</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Darboğaz</span>
          </div>

          {/* CANVAS STAGE CONTAINER — mouse drag / touch pan, pinch and ctrl+wheel zoom */}
          <div
            ref={canvasContainerRef}
            className={`w-full flex-1 relative touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheelZoom}
          >
            <div
              id="vsm_map_capture_target"
              className="absolute origin-top-left transition-transform duration-75"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                width: `${mapLayout.width}px`,
                height: `${mapLayout.height}px`,
                backgroundColor: vsmBrightMode ? "#f8fafc" : "#0f172a"
              }}
            >
              <VsmMapCanvas />
            </div>
          </div>

          {/* BOTTOM QUICK INSTRUCTIONS FOOTER */}
          <div className={`absolute bottom-4 left-4 right-4 z-20 ${vsmBrightMode ? 'bg-white border-slate-200 text-slate-700 shadow-md' : 'bg-slate-950/80 border-slate-800 text-slate-400'} backdrop-blur-md border px-4 py-2 rounded-xl hidden sm:flex items-center justify-between text-[11px] font-sans`}>
            <div className="flex items-center space-x-1.5">
              <Move className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Sürükleyerek gezinin; iki parmakla ya da Ctrl + tekerlekle yakınlaştırın. <strong>FİT</strong> haritayı ekrana sığdırır.</span>
            </div>
            <div className={vsmBrightMode ? 'font-mono text-emerald-600' : 'font-mono text-emerald-400'}>
              Müşteri: {selectedCustomer?.companyName || "—"}{selectedCustomer?.industry ? ` • Sektör: ${selectedCustomer.industry}` : ""}
            </div>
          </div>

        </div>

        {/* BOTTOM GLOBAL KPIs GRID PANEL */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 font-sans text-white">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-sky-400" />
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Değer Akışı Küresel KPIs</h3>
            </div>
            <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono font-extrabold px-3 py-1 rounded">
              HATTIN TOPLAM ÖZETİ
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1: COMPREHENSIVE LEAD TIME & VALUE ADDED RATIO */}
            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl space-y-4">
              <span className="text-[10px] text-slate-500 font-mono font-black uppercase tracking-wider">01 • SÜRE & KATMA DEĞER ANALİZİ</span>
              
              {/* Total Lead Time */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400 font-semibold">
                  <span>YALIN TEMİN SÜRESİ (LEAD TIME)</span>
                  <span className="font-bold text-amber-400">{totalLeadTimeDays} Gün</span>
                </div>
                <div className="text-2xl font-mono font-bold text-white">
                  {totalLeadTimeDays.toFixed(2)} <span className="text-xs text-slate-400">Gün</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Hammadde girişinden nihai sevkıyata kadar geçen toplam ortalama süre (beklemeler dahil).
                </p>
              </div>

              {/* Processing / VA Time */}
              <div className="space-y-1 border-t border-slate-850 pt-3">
                <div className="flex justify-between text-xs text-slate-400 font-semibold">
                  <span>İŞLEME ZAMANI (VA PROCESSING)</span>
                  <span className="font-bold text-sky-400">{totalProcessingTimeSeconds} Sn</span>
                </div>
                <div className="text-xl font-mono font-bold text-sky-400">
                  {totalProcessingTimeSeconds} <span className="text-xs text-sky-300">Saniye</span>
                </div>
              </div>

              {/* VA Ratio percentage with progress bar */}
              <div className="space-y-2 border-t border-slate-850 pt-3">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-400">KATMA DEĞER ORANI (VA %)</span>
                  <span className="text-emerald-400 font-mono">{valueAddedRatio}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all" 
                    style={{ width: `${Math.min(100, valueAddedRatio * 15)}%` }} // Scaled up visually so it's visible
                  />
                </div>
                <span className="text-[11px] text-slate-400 block font-mono italic">
                  *Tüm sürede katma değerli iş yapılan süre oranıdır. Dünya klası hedef &gt; %5.
                </span>
              </div>
            </div>

            {/* COLUMN 2: SYSTEM PERFORMANCE AVERAGES */}
            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl space-y-4">
              <span className="text-[10px] text-slate-500 font-mono font-black uppercase tracking-wider">02 • EKİPMAN &amp; HAT VERİMLİLİKLERİ</span>
              
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Ortalama OEE</span>
                  <span className="font-mono font-bold text-white block text-lg">{averageOee}%</span>
                </div>
                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Kapasite Kullanımı</span>
                  <span className="font-mono font-bold text-white block text-lg">{averageCapacityUtilization}%</span>
                </div>
                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Toplam Operatör</span>
                  <span className="font-mono font-bold text-white block text-lg">{totalOperators} HC</span>
                </div>
                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Makine Sayısı</span>
                  <span className="font-mono font-bold text-white block text-lg">{totalMachines} Ünite</span>
                </div>
              </div>

              <div className="p-3 bg-sky-950/20 border border-sky-850/50 rounded-xl text-[10px] text-sky-300 leading-relaxed font-sans">
                <strong>Hat Dengesi Notu:</strong> Prosesler arasındaki çevrim zamanı farkı OEE erozyonu ve ara stok yığılmasına neden olur. Kaizen önerilerini inceleyin.
              </div>
            </div>

            {/* COLUMN 3: AUTOMATIC BOTTLENECK RADAR & FINANCIAL COST */}
            <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-[10px] text-slate-500 font-mono font-black uppercase tracking-wider">03 • DARBOĞAZ RADARI &amp; YILLIK KAYIP</span>
                
                <div className="space-y-2">
                  {/* Lowest Capacity / Bottleneck Process */}
                  {bottleneckProcess && (
                    <div className="p-2.5 bg-red-950/30 border border-red-900/50 rounded-xl flex items-start space-x-2 text-xs">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5 animate-pulse" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-red-200 block">Kritik Darboğaz Operasyonu</span>
                        <p className="text-[10px] text-slate-400">{bottleneckProcess.name} • Çevrim hızı {bottleneckProcess.cycleTime} sn</p>
                      </div>
                    </div>
                  )}

                  {/* Highest Inventory WIP alert */}
                  {highestInventoryProcess && highestInventoryProcess.inventoryBefore > 1000 && (
                    <div className="p-2.5 bg-amber-950/30 border border-amber-900/50 rounded-xl flex items-start space-x-2 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-amber-200 block">Aşırı Stok Yığılması (WIP)</span>
                        <p className="text-[10px] text-slate-400">{highestInventoryProcess.name} öncesinde {highestInventoryProcess.inventoryBefore} birikmiş parça var.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* WASTES & FINANCIAL LOSS COST */}
              <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 mt-2">
                <span className="text-[11px] text-slate-400 font-mono font-bold uppercase block">Yıllık Kayıp Kaynak Havuzu (OpEx Pool)</span>
                <div className="text-xl font-mono font-black text-amber-400">
                  {companyCurrency}{estimatedAnnualWasteCost.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Duruşlar, israf stok bekleme süreleri ve ıskartalar nedeniyle oluşan tahmini yıllık işletim kaybıdır.
                </p>
                <div className="pt-1.5 border-t border-slate-800 text-[11px] font-semibold text-emerald-400 flex items-center space-x-1">
                  <Zap className="w-3 h-3" />
                  <span>Yalın iyileştirmeyle elenebilir kâr potansiyeli!</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
      </>
  );
}
