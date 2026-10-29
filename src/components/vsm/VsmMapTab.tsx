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

const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

export default function VsmMapTab() {
  const { selectedCustomer, factorySetup, simulationMode, zoom, pan, isPanning, isFullScreen, vsmBrightMode, setVsmBrightMode, canvasContainerRef, companyCurrency, weeklyDemand, dailyDemand, monthlyDemand, taktTime, processesWithTimeline, vsmGraphEdges, vsmGraphLayout, isFlowLinear, vsmCriticalPath, flow, totalLeadTimeDays, totalProcessingTimeSeconds, valueAddedRatio, vsmLaneSummaries, count, averageOee, averageCapacityUtilization, totalOperators, totalMachines, bottleneckProcess, highestDowntimeProcess, highestInventoryProcess, lowestOeeProcess, estimatedAnnualWasteCost, simulationComparison, handleSyncToCiProjects, handleZoomIn, handleZoomOut, handleZoomReset, handleMouseDown, handleMouseMove, handleMouseUp, handleOpenProcessDrawer } = useVsm();
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
        <div className={`w-full relative ${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'} border rounded-3xl overflow-hidden flex flex-col select-none ${isFullScreen ? 'h-[calc(100vh-100px)]' : 'h-[720px]'}`}>
          
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
              onClick={handleZoomReset}
              className={`px-2.5 py-1 rounded-lg transition text-[10px] font-mono font-bold uppercase border cursor-pointer ${vsmBrightMode ? 'hover:bg-slate-100 text-slate-700 border-slate-200' : 'hover:bg-slate-800/60 text-slate-450 hover:text-white border-slate-800'}`}
              title="Sıfırla"
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

          {/* ACTIVE STATE LEGEND INDICATORS */}
          <div className={`absolute top-4 right-4 z-20 ${vsmBrightMode ? 'bg-white/95 border-slate-200 text-slate-650' : 'bg-slate-950/85 border-slate-800 text-slate-400'} backdrop-blur-md border px-3 py-1.5 rounded-xl flex items-center space-x-3.5 shadow-xl text-[10px] font-mono font-bold uppercase tracking-wider`}>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-450" />
              <span>Normal Akış</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span>Darboğaz (Bottleneck)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded bg-yellow-400" />
              <span>Süpermarket / Kanban</span>
            </div>
          </div>

          {/* CANVAS STAGE CONTAINER */}
          <div 
            ref={canvasContainerRef}
            className={`w-full flex-1 relative ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* PAN & ZOOM WRAPPER BOX */}
            <div
              id="vsm_map_capture_target"
              className="absolute origin-top-left transition-transform duration-75"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                width: "2200px",
                height: "700px",
                padding: "20px",
                backgroundColor: vsmBrightMode ? "#f8fafc" : "#0f172a"
              }}
            >
              {/* SVG FOR REALTIME INFORMATION AND MATERIAL FLOW ARROWS */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ width: "2400px", height: "720px" }}>
                <defs>
                  {/* Arrow markers */}
                  <marker id="solid-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill={vsmBrightMode ? "#0284c7" : "#38bdf8"} />
                  </marker>
                  <marker id="dashed-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill={vsmBrightMode ? "#b45309" : "#fbbf24"} />
                  </marker>
                  <marker id="supplier-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill={vsmBrightMode ? "#059669" : "#10b981"} />
                  </marker>
                </defs>

                {/* --- 1. SUPPLIER INPUT & CUSTOMER OUTPUT MATERIAL FLOWS --- */}
                {/* Supplier to Process 1 Truck flow (extended down to 365px for 2cm gap) */}
                <path d="M 190,140 L 190,365 L 230,365" fill="none" stroke={vsmBrightMode ? "#059669" : "#10b981"} strokeWidth="2.5" strokeDasharray="6,4" markerEnd="url(#supplier-arrow)" />
                
                {/* Last Process to Customer Shipping flow */}
                <path d="M 1910,365 L 1950,365 L 1950,140" fill="none" stroke={vsmBrightMode ? "#059669" : "#10b981"} strokeWidth="2.5" strokeDasharray="6,4" markerEnd="url(#supplier-arrow)" />

                {/* --- 2. INFORMATION FLOW DYNAMIC DASHED ARROWS --- */}
                {/* Production Control box coordinates: Center X = 1100, Y = 110 */}
                {/* Arrow from Production Control to Supplier */}
                <path d="M 1000,75 L 190,75 L 190,100" fill="none" stroke={vsmBrightMode ? "#b45309" : "#fbbf24"} strokeWidth="1.5" strokeDasharray="5,5" markerEnd="url(#dashed-arrow)" />
                
                {/* Arrow from Customer to Production Control */}
                <path d="M 1950,100 L 1950,75 L 1200,75" fill="none" stroke={vsmBrightMode ? "#b45309" : "#fbbf24"} strokeWidth="1.5" strokeDasharray="5,5" markerEnd="url(#dashed-arrow)" />

                {isFlowLinear && (
                  <>
                    {/* Information flow dashed arrows down to process boxes (extended down to 260px) */}
                    {processesWithTimeline.map((p, idx) => {
                      const targetX = 310 + (idx * 280);
                      return (
                        <path
                          key={`info-arrow-${p.id}`}
                          d={`M 1100,120 L ${targetX},120 L ${targetX},260`}
                          fill="none"
                          stroke={vsmBrightMode ? "#b45309" : "#fbbf24"}
                          strokeWidth="1.2"
                          strokeDasharray="4,4"
                          markerEnd="url(#dashed-arrow)"
                        />
                      );
                    })}

                    {/* --- 3. SOLID MATERIAL FLOW ARROWS BETWEEN STATIONS (Y = 365) --- */}
                    {processesWithTimeline.slice(0, -1).map((p, idx) => {
                      const startX = 400 + (idx * 280);
                      const endX = 490 + (idx * 280);
                      return (
                        <line
                          key={`mat-flow-${p.id}`}
                          x1={startX}
                          y1={365}
                          x2={endX}
                          y2={365}
                          stroke={vsmBrightMode ? "#0284c7" : "#38bdf8"}
                          strokeWidth="3.5"
                          markerEnd="url(#solid-arrow)"
                        />
                      );
                    })}
                  </>
                )}

                {!isFlowLinear && (
                  <>
                    {/* Information flow dashed arrows down to each process box's actual computed column */}
                    {processesWithTimeline.map((p) => {
                      const pos = vsmGraphLayout.positions.get(p.id);
                      if (!pos) return null;
                      const targetX = pos.x;
                      return (
                        <path
                          key={`info-arrow-${p.id}`}
                          d={`M 1100,120 L ${targetX},120 L ${targetX},${pos.y}`}
                          fill="none"
                          stroke={vsmBrightMode ? "#b45309" : "#fbbf24"}
                          strokeWidth="1.2"
                          strokeDasharray="4,4"
                          markerEnd="url(#dashed-arrow)"
                        />
                      );
                    })}

                    {/* --- GRAPH MATERIAL FLOW: one arrow per relationship edge, curved when lanes differ --- */}
                    {vsmGraphEdges.map((edge, i) => {
                      const fromPos = vsmGraphLayout.positions.get(edge.fromId);
                      const toPos = vsmGraphLayout.positions.get(edge.toId);
                      if (!fromPos || !toPos) return null;
                      const CARD_W = 220;
                      const CARD_H_CENTER = 115;
                      const x1 = fromPos.x + CARD_W;
                      const y1 = fromPos.y + CARD_H_CENTER;
                      const x2 = toPos.x;
                      const y2 = toPos.y + CARD_H_CENTER;
                      const isDashedType = edge.type === "Kanban" || edge.type === "Supermarket";
                      if (fromPos.lane === toPos.lane) {
                        return (
                          <line
                            key={`edge-${edge.fromId}-${edge.toId}-${i}`}
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke={vsmBrightMode ? "#0284c7" : "#38bdf8"}
                            strokeWidth="3"
                            strokeDasharray={isDashedType ? "6,4" : undefined}
                            markerEnd="url(#solid-arrow)"
                          />
                        );
                      }
                      const midX = (x1 + x2) / 2;
                      return (
                        <path
                          key={`edge-${edge.fromId}-${edge.toId}-${i}`}
                          d={`M ${x1},${y1} C ${midX},${y1} ${midX},${y2} ${x2},${y2}`}
                          fill="none"
                          stroke={vsmBrightMode ? "#0284c7" : "#38bdf8"}
                          strokeWidth="3"
                          strokeDasharray={isDashedType ? "6,4" : undefined}
                          markerEnd="url(#solid-arrow)"
                        />
                      );
                    })}
                  </>
                )}
              </svg>

              {/* ========================================== */}
              {/* 1. CUSTOMER AREA (TOP RIGHT)               */}
              {/* ========================================== */}
              <div 
                className={`absolute ${vsmBrightMode ? 'bg-white border-slate-200 text-slate-800 shadow-lg' : 'bg-slate-950/90 border-slate-800 text-white shadow-xl'} p-4 rounded-2xl w-[260px] border z-10 font-sans`}
                style={{ top: "10px", left: "1820px" }}
              >
                <div className={`flex items-center space-x-2 border-b ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pb-2 mb-2`}>
                  <div className="bg-emerald-600 p-1.5 rounded-lg">
                    {/* Castle / Sawtooth Lean factory logo */}
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 21h18M3 10l4-4h10l4 4M5 10v11M19 10v11M12 10v11" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wide uppercase">MÜŞTERİ (CUSTOMER)</h3>
                    <p className={`text-[10px] ${vsmBrightMode ? 'text-slate-500' : 'text-slate-400'} truncate max-w-[160px]`}>{factorySetup.customerName || selectedCustomer?.companyName || "—"}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Ürün Ailesi:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.productFamily || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Günlük Talep:</span>
                    <span className="font-bold text-amber-550 dark:text-amber-400">{dailyDemand} ad/gün</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Haftalık Talep:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{weeklyDemand} ad</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Aylık Sipariş:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{monthlyDemand} ad</span>
                  </div>
                  <div className={`flex justify-between border-t ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pt-1.5 mt-1.5`}>
                    <span className={vsmBrightMode ? 'text-slate-500 font-bold' : 'text-slate-400 font-bold'}>Takt Süresi:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">{taktTime > 0 ? `${taktTime} sn` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sevk Sıklığı:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.shippingFrequency || "—"}</span>
                  </div>
                </div>
              </div>

              {/* ========================================== */}
              {/* 2. PLANNING / PRODUCTION CONTROL (TOP CENTER) */}
              {/* ========================================== */}
              <div 
                className={`absolute ${vsmBrightMode ? 'bg-white border-slate-200 text-slate-800 shadow-lg' : 'bg-slate-950/90 border-slate-800 text-white shadow-xl'} p-4 rounded-2xl w-[280px] border z-10 text-center`}
                style={{ top: "10px", left: "960px" }}
              >
                <div className={`flex items-center justify-center space-x-2 border-b ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pb-2 mb-2`}>
                  <div className="bg-yellow-500 p-1.5 rounded-lg text-slate-950">
                    <Settings className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-black tracking-wide uppercase">ÜRETİM PLANLAMA & MRP / ERP</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left text-[10px] font-mono">
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Planlama Sistemi</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>{factorySetup.planningSystem || "—"}</span>
                  </div>
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Planlama Sıklığı</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>{factorySetup.planningFrequency || "—"}</span>
                  </div>
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sıralama Rejimi</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>{factorySetup.planningSequencing || "—"}</span>
                  </div>
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Üretim Takvimi</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>{factorySetup.planningCalendar || "—"}</span>
                  </div>
                </div>
              </div>

              {/* ========================================== */}
              {/* 3. SUPPLIER AREA (TOP LEFT)                */}
              {/* ========================================== */}
              <div 
                className={`absolute ${vsmBrightMode ? 'bg-white border-slate-200 text-slate-800 shadow-lg' : 'bg-slate-950/90 border-slate-800 text-white shadow-xl'} p-4 rounded-2xl w-[260px] border z-10 font-sans`}
                style={{ top: "10px", left: "60px" }}
              >
                <div className={`flex items-center space-x-2 border-b ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pb-2 mb-2`}>
                  <div className="bg-indigo-600 p-1.5 rounded-lg">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 21h18M3 10l4-4h10l4 4M5 10v11M19 10v11M12 10v11" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wide uppercase">TEDARİKÇİ (SUPPLIER)</h3>
                    <p className={`text-[10px] ${vsmBrightMode ? 'text-slate-500' : 'text-slate-400'} truncate max-w-[160px]`}>{factorySetup.supplierName || "—"}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Malzeme Rejimi:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.supplierMaterial || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sevk Sıklığı:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.supplierDelivery || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Parti Büyüklüğü:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.supplierBatch || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Tedarik Temin:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.supplierLeadTime || "—"}</span>
                  </div>
                  <div className={`flex justify-between border-t ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pt-1.5 mt-1.5`}>
                    <span className={vsmBrightMode ? 'text-slate-500 font-bold' : 'text-slate-400 font-bold'}>Lojistik Yöntemi:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">{factorySetup.supplierLogistics || "—"}</span>
                  </div>
                </div>
              </div>

              {/* ========================================== */}
              {/* 4. MAIN VALUE STREAM (CENTER WORKSPACE)     */}
              {/* ========================================== */}
              {isFlowLinear && (
              <div className="absolute top-[265px] left-[20px] flex items-center h-[230px]">

                {processesWithTimeline.map((p, idx) => {
                  const isBottleneck = p.id === bottleneckProcess?.id;
                  const isHighDowntime = p.id === highestDowntimeProcess?.id;
                  const isLowOee = p.id === lowestOeeProcess?.id;

                  // Dynamic alert styling
                  let borderClass = vsmBrightMode ? "border-slate-200 hover:border-sky-500" : "border-slate-800 hover:border-sky-500";
                  let bgHeader = vsmBrightMode ? "bg-slate-100 text-slate-800 border-b border-slate-200" : "bg-slate-950/90 text-slate-100";
                  if (isBottleneck) {
                    borderClass = "border-red-500 hover:border-red-400 ring-2 ring-red-500/20";
                    bgHeader = vsmBrightMode ? "bg-red-50 text-red-800 border-b border-red-200" : "bg-red-950/90 text-red-100";
                  } else if (isLowOee || isHighDowntime) {
                    borderClass = "border-amber-500 hover:border-amber-400";
                    bgHeader = vsmBrightMode ? "bg-amber-50 text-amber-800 border-b border-amber-200" : "bg-amber-950/90 text-amber-100";
                  }

                  return (
                    <React.Fragment key={p.id}>
                      
                      {/* PROCESS BOX CARD */}
                      <div 
                        onClick={() => handleOpenProcessDrawer(p.id)}
                        className={`${vsmBrightMode ? 'bg-white text-slate-800 shadow-md border' : 'bg-slate-950/95 text-white border shadow-2xl'} ${borderClass} rounded-2xl w-[220px] z-10 transition-all transform hover:-translate-y-1 cursor-pointer flex flex-col overflow-hidden font-sans`}
                      >
                        {/* Process Box Header */}
                        <div className={`px-3 py-2 ${bgHeader} flex justify-between items-center`}>
                          <span className="text-[10px] font-black tracking-wider truncate uppercase">{p.name}</span>
                          <span className={`text-[11px] font-mono ${vsmBrightMode ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'} px-1.5 py-0.2 rounded font-extrabold uppercase`}>
                            {p.type === "Manual" ? "MNL" : "OTO"}
                          </span>
                        </div>

                        {/* Process Metrics Panel */}
                        <div className={`p-3 grid grid-cols-2 gap-1.5 text-[10px] font-mono ${vsmBrightMode ? 'bg-white text-slate-600' : 'bg-slate-950 text-slate-400'}`}>
                          <div className="flex flex-col">
                            <span className={vsmBrightMode ? 'text-slate-400 text-[11px] uppercase' : 'text-slate-500 text-[11px] uppercase'}>Mak / Op</span>
                            <span className={`font-bold mt-0.5 ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{p.machineCount} M / {p.operatorCount} O</span>
                          </div>
                          <div className={`flex flex-col border-l ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800/80'} pl-2`}>
                            <span className={vsmBrightMode ? 'text-slate-400 text-[11px] uppercase' : 'text-slate-500 text-[11px] uppercase'}>Çevrim (CT)</span>
                            <span className={`font-bold mt-0.5 ${isBottleneck ? 'text-red-500 text-[11px]' : (vsmBrightMode ? 'text-slate-800' : 'text-slate-200')}`}>
                              {p.cycleTime} sn
                            </span>
                          </div>
                          <div className={`flex flex-col border-t ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800/80'} pt-1`}>
                            <span className={vsmBrightMode ? 'text-slate-400 text-[11px] uppercase' : 'text-slate-500 text-[11px] uppercase'}>OEE Skoru</span>
                            <span className={`font-bold mt-0.5 ${isLowOee ? 'text-amber-500' : (vsmBrightMode ? 'text-slate-800' : 'text-slate-200')}`}>
                              %{p.oee}
                            </span>
                          </div>
                          <div className={`flex flex-col border-t border-l ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800/80'} pt-1 pl-2`}>
                            <span className={vsmBrightMode ? 'text-slate-400 text-[11px] uppercase' : 'text-slate-500 text-[11px] uppercase'}>Kapasite</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{p.capacity} ad/g</span>
                          </div>
                          <div className={`flex flex-col border-t ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800/80'} pt-1`}>
                            <span className={vsmBrightMode ? 'text-slate-400 text-[11px] uppercase' : 'text-slate-500 text-[11px] uppercase'}>Vardiya</span>
                            <span className={`font-bold mt-0.5 ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{p.shifts}v x {p.workingHours}sa</span>
                          </div>
                          <div className={`flex flex-col border-t border-l ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800/80'} pt-1 pl-2`}>
                            <span className={vsmBrightMode ? 'text-slate-400 text-[11px] uppercase' : 'text-slate-500 text-[11px] uppercase'}>Duruş (D/T)</span>
                            <span className={`font-bold mt-0.5 ${isHighDowntime ? 'text-amber-500' : (vsmBrightMode ? 'text-slate-800' : 'text-slate-200')}`}>
                              {p.downtimeMinutes} dk/g
                            </span>
                          </div>
                        </div>

                        {/* Process Mini KPI Summary Block */}
                        <div className={`px-3 py-1.5 border-t ${vsmBrightMode ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-slate-900/65 border-slate-800/60 text-slate-400'} flex justify-between items-center text-[11px] font-mono font-bold`}>
                          <span>FPY Oranı: %{p.quality}</span>
                          {isBottleneck && (
                            <span className="bg-red-550/10 text-red-600 dark:text-red-400 border border-red-200/50 rounded px-1 animate-pulse">
                              DARBOĞAZ
                            </span>
                          )}
                        </div>
                      </div>

                      {/* BETWEEN PROCESS STOCK POINT: SUPERMARKET / KANBAN LOOP / TRADITIONAL TRIANGLE */}
                      {idx < processesWithTimeline.length - 1 && (
                        <div className="w-[60px] flex flex-col items-center justify-center relative shrink-0 z-10">

                          {/* Kanban label tag if pull-signal is enabled on this stock point */}
                          {p.isKanbanEnabled && (
                            <div className="absolute -top-12 bg-yellow-400 border border-yellow-500 text-slate-950 font-mono font-black text-[11px] px-2 py-0.5 rounded shadow-lg flex items-center space-x-1 uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
                              <span>Kanban</span>
                            </div>
                          )}

                          <div className="relative group cursor-pointer">
                            {p.isSupermarket ? (
                              /* Supermarket shelf symbol (standard VSM pull-stock icon) — replaces
                                 the raw inventory triangle since a supermarket holds a controlled,
                                 minimized buffer rather than an uncontrolled queue. */
                              <svg className="w-11 h-11" viewBox="0 0 100 100">
                                <rect x="10" y="20" width="80" height="60" rx="4" fill="#fef08a" stroke="#ca8a04" strokeWidth="6" />
                                <line x1="36" y1="20" x2="36" y2="80" stroke="#ca8a04" strokeWidth="5" />
                                <line x1="64" y1="20" x2="64" y2="80" stroke="#ca8a04" strokeWidth="5" />
                              </svg>
                            ) : p.isKanbanEnabled ? (
                              /* Kanban withdrawal-loop symbol (circular arrow) for pull points that
                                 aren't a physical supermarket shelf. */
                              <div className="w-11 h-11 rounded-full bg-yellow-100 border-2 border-yellow-500 flex items-center justify-center">
                                <RefreshCw className="w-6 h-6 text-amber-700" strokeWidth={2.5} />
                              </div>
                            ) : (
                              /* Traditional VSM Inventory Triangle — only for un-managed queue points */
                              <svg className="w-11 h-11" viewBox="0 0 100 100">
                                <polygon points="50,10 10,90 90,90" fill="#fef08a" stroke="#ca8a04" strokeWidth="6" />
                                <text x="50" y="70" textAnchor="middle" fill="#854d0e" fontSize="30" fontWeight="900" fontFamily="monospace">I</text>
                              </svg>
                            )}

                            {/* WIP count display badge — always shown, including the minimized
                                stock quantity for supermarket/kanban pull points */}
                            <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 ${vsmBrightMode ? 'bg-white border-slate-200 text-slate-700 shadow-sm' : 'bg-slate-950 border-slate-800 text-slate-300'} border px-1.5 py-0.5 rounded text-[11px] font-mono font-black whitespace-nowrap`}>
                              {p.inventoryBefore} AD
                            </div>
                          </div>

                          {/* Inventory Days Display */}
                          <div className={`text-[10px] font-mono font-bold ${vsmBrightMode ? 'text-amber-600' : 'text-amber-400'} mt-2`}>
                            {processesWithTimeline[idx].inventoryDays} gün
                          </div>
                        </div>
                      )}

                    </React.Fragment>
                  );
                })}
              </div>
              )}

              {/* GRAPH / MULTI-LANE PROCESS CARDS (parallel & branching flows) */}
              {!isFlowLinear && (
                <div className="absolute top-0 left-[20px]" style={{ width: "2160px", height: `${265 + (vsmGraphLayout.laneCount * 270) + 20}px` }}>
                  {processesWithTimeline.map((p) => {
                    const pos = vsmGraphLayout.positions.get(p.id);
                    if (!pos) return null;
                    const isBottleneck = p.id === bottleneckProcess?.id;
                    const isHighDowntime = p.id === highestDowntimeProcess?.id;
                    const isLowOee = p.id === lowestOeeProcess?.id;
                    const isOnCriticalPath = vsmCriticalPath.criticalPathIds.has(p.id);

                    let borderClass = vsmBrightMode ? "border-slate-200 hover:border-sky-500" : "border-slate-800 hover:border-sky-500";
                    let bgHeader = vsmBrightMode ? "bg-slate-100 text-slate-800 border-b border-slate-200" : "bg-slate-950/90 text-slate-100";
                    if (isBottleneck) {
                      borderClass = "border-red-500 hover:border-red-400 ring-2 ring-red-500/20";
                      bgHeader = vsmBrightMode ? "bg-red-50 text-red-800 border-b border-red-200" : "bg-red-950/90 text-red-100";
                    } else if (isLowOee || isHighDowntime) {
                      borderClass = "border-amber-500 hover:border-amber-400";
                      bgHeader = vsmBrightMode ? "bg-amber-50 text-amber-800 border-b border-amber-200" : "bg-amber-950/90 text-amber-100";
                    }

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleOpenProcessDrawer(p.id)}
                        className={`absolute ${vsmBrightMode ? 'bg-white text-slate-800 shadow-md border' : 'bg-slate-950/95 text-white border shadow-2xl'} ${borderClass} rounded-2xl w-[220px] z-10 transition-all transform hover:-translate-y-1 cursor-pointer flex flex-col overflow-hidden font-sans`}
                        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                      >
                        {/* Process Box Header */}
                        <div className={`px-3 py-2 ${bgHeader} flex justify-between items-center`}>
                          <span className="text-[10px] font-black tracking-wider truncate uppercase">{p.name}</span>
                          <span className={`text-[11px] font-mono ${vsmBrightMode ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'} px-1.5 py-0.2 rounded font-extrabold uppercase`}>
                            {p.type === "Manual" ? "MNL" : "OTO"}
                          </span>
                        </div>

                        {/* Process Metrics Panel */}
                        <div className={`p-3 grid grid-cols-2 gap-1.5 text-[10px] font-mono ${vsmBrightMode ? 'bg-white text-slate-600' : 'bg-slate-950 text-slate-400'}`}>
                          <div className="flex flex-col">
                            <span className={vsmBrightMode ? 'text-slate-400 text-[11px] uppercase' : 'text-slate-500 text-[11px] uppercase'}>Mak / Op</span>
                            <span className={`font-bold mt-0.5 ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{p.machineCount} M / {p.operatorCount} O</span>
                          </div>
                          <div className={`flex flex-col border-l ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800/80'} pl-2`}>
                            <span className={vsmBrightMode ? 'text-slate-400 text-[11px] uppercase' : 'text-slate-500 text-[11px] uppercase'}>Çevrim (CT)</span>
                            <span className={`font-bold mt-0.5 ${isBottleneck ? 'text-red-500 text-[11px]' : (vsmBrightMode ? 'text-slate-800' : 'text-slate-200')}`}>
                              {p.cycleTime} sn
                            </span>
                          </div>
                          <div className={`flex flex-col border-t ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800/80'} pt-1`}>
                            <span className={vsmBrightMode ? 'text-slate-400 text-[11px] uppercase' : 'text-slate-500 text-[11px] uppercase'}>OEE Skoru</span>
                            <span className={`font-bold mt-0.5 ${isLowOee ? 'text-amber-500' : (vsmBrightMode ? 'text-slate-800' : 'text-slate-200')}`}>
                              %{p.oee}
                            </span>
                          </div>
                          <div className={`flex flex-col border-t border-l ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800/80'} pt-1 pl-2`}>
                            <span className={vsmBrightMode ? 'text-slate-400 text-[11px] uppercase' : 'text-slate-500 text-[11px] uppercase'}>Kapasite</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{p.capacity} ad/g</span>
                          </div>
                        </div>

                        {/* Per-process WIP / lead-time contribution badge (replaces the between-card
                            triangle, which doesn't generalize once a process can have >1 predecessor) */}
                        <div className={`px-3 py-1.5 border-t flex justify-between items-center text-[11px] font-mono font-bold ${
                          isOnCriticalPath
                            ? "bg-red-50 border-red-200 text-red-700"
                            : (vsmBrightMode ? "bg-amber-50 border-slate-100 text-amber-700" : "bg-slate-900/65 border-slate-800/60 text-amber-400")
                        }`}>
                          <span>{p.isSupermarket ? "⊞" : p.isKanbanEnabled ? "⟲" : "△"} {p.inventoryBefore} AD</span>
                          <span>{p.inventoryDays} gün{isOnCriticalPath ? " ⚠" : ""}</span>
                        </div>

                        {/* Process Mini KPI Summary Block */}
                        <div className={`px-3 py-1.5 border-t ${vsmBrightMode ? 'bg-slate-50 border-slate-100 text-slate-500' : 'bg-slate-900/65 border-slate-800/60 text-slate-400'} flex justify-between items-center text-[11px] font-mono font-bold`}>
                          <span>FPY Oranı: %{p.quality}</span>
                          {isBottleneck && (
                            <span className="bg-red-550/10 text-red-600 dark:text-red-400 border border-red-200/50 rounded px-1 animate-pulse">
                              DARBOĞAZ
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ========================================== */}
              {/* 5. TIMELINE AREA (BOTTOM SECTION)          */}
              {/* ========================================== */}
              {isFlowLinear && (
              <div className={`absolute top-[500px] left-[20px] w-[1840px] border-t ${vsmBrightMode ? 'border-slate-200' : 'border-slate-800'} pt-4`}>
                <div className="flex items-stretch font-mono font-black text-[10px] uppercase tracking-wide">

                  {/* Left Label */}
                  <div className={`w-[100px] flex flex-col justify-between ${vsmBrightMode ? 'text-slate-400' : 'text-slate-500'} shrink-0 select-none pb-4`}>
                    <span className={vsmBrightMode ? 'text-amber-600' : 'text-amber-500'}>Hazırlık / Bekleme (NVA)</span>
                    <span className={vsmBrightMode ? 'text-sky-600' : 'text-sky-400'}>Katma Değer (VA)</span>
                  </div>

                  {/* Crenellated square wave timeline blocks */}
                  <div className="flex-1 flex items-stretch">
                    {processesWithTimeline.map((p, idx) => {
                      return (
                        <React.Fragment key={`timeline-${p.id}`}>

                          {/* NVA Inventory segment (upper shelf) */}
                          <div className={`flex-1 flex flex-col justify-start border-l border-r border-t ${vsmBrightMode ? 'border-slate-200' : 'border-slate-800'} text-center relative h-[50px] bg-amber-500/5`}>
                            <span className={`${vsmBrightMode ? 'text-amber-600' : 'text-amber-400'} font-extrabold pt-2 text-[10px]`}>
                              {p.inventoryDays > 0 ? `${p.inventoryDays} gün` : "0 gün"}
                            </span>
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${vsmBrightMode ? 'bg-slate-200' : 'bg-slate-800'}`} />
                          </div>

                          {/* VA Processing Segment (lower shelf) */}
                          <div className={`w-[110px] flex flex-col justify-end border-b border-l border-r ${vsmBrightMode ? 'border-slate-200' : 'border-slate-800'} text-center relative h-[50px] bg-sky-500/5`}>
                            <span className={`${vsmBrightMode ? 'text-sky-600' : 'text-sky-400'} font-extrabold pb-2 text-[10px]`}>
                              {p.cycleTime} sn (CT)
                            </span>
                          </div>

                        </React.Fragment>
                      );
                    })}
                  </div>

                </div>
              </div>
              )}

              {/* GRAPH-MODE LEAD TIME SUMMARY — a single square-wave ladder can't represent
                  branches, so each lane gets its own row showing its own wait/processing time;
                  the lane(s) actually driving the total Lead Time are flagged as critical path. */}
              {!isFlowLinear && (
                <div
                  className={`absolute left-[20px] w-[1840px] border-t ${vsmBrightMode ? 'border-slate-200' : 'border-slate-800'} pt-4`}
                  style={{ top: `${265 + (vsmGraphLayout.laneCount * 270) + 20}px` }}
                >
                  <h4 className={`text-[10px] font-black uppercase tracking-wider font-mono mb-2 ${vsmBrightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Hat Bazlı Lead Time Özeti (Kritik Yol Vurgulu)
                  </h4>
                  <div className="space-y-1.5">
                    {vsmLaneSummaries.map(({ lane, processes, waitDays, processingSeconds, isCritical }) => (
                      <div
                        key={lane}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-mono ${
                          isCritical
                            ? "bg-red-50 border border-red-200 text-red-700"
                            : (vsmBrightMode ? "bg-slate-50 border border-slate-200 text-slate-600" : "bg-slate-900/60 border border-slate-800 text-slate-400")
                        }`}
                      >
                        <span className="font-bold truncate">
                          {isCritical && "⚠ "}Hat {lane + 1}: {processes.map(p => p.name).join(" → ")}
                        </span>
                        <span className="shrink-0 ml-3">
                          Bekleme: <b>{waitDays} gün</b> • İşleme: <b>{processingSeconds} sn</b>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* BOTTOM QUICK INSTRUCTIONS FOOTER */}
          <div className={`absolute bottom-4 left-4 right-4 z-20 ${vsmBrightMode ? 'bg-white border-slate-200 text-slate-700 shadow-md' : 'bg-slate-950/80 border-slate-800 text-slate-400'} backdrop-blur-md border px-4 py-2 rounded-xl flex items-center justify-between text-[11px] font-sans`}>
            <div className="flex items-center space-x-1.5">
              <Move className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Gezinmek için tuval üzerinde <strong>Sol Tıklayıp Sürükleyin</strong>. Yakınlaştırma için kontrol butonlarını kullanın.</span>
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
