// VSM — Üretim & Kapasite sekmesi: planlanan/gerçekleşen adet, ideal C/T, C/O, arıza → OEE.
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
import VsmDataBoxTable from "./VsmDataBoxTable";

const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

export default function VsmProductionTab() {
  const { activeProcesses, handleUpdateProcessField } = useVsm();
  return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 font-sans">Üretim &amp; Kapasite Veri Girişi ve Otomatik OEE Süzgeci</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">Operasyon bazlı üretim verilerini, çevrim sürelerini ve duruşları girin. Formüller otomatik çalışır.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200 font-sans">
                <tr>
                  <th className="p-4 w-16 text-center">Sıra</th>
                  <th className="p-4">Proses Adı</th>
                  <th className="p-4 text-center w-24">Planlanan (Adet)</th>
                  <th className="p-4 text-center w-24">Gerçekleşen (Adet)</th>
                  <th className="p-4 text-center w-24">İdeal Çevrim (Sn)</th>
                  <th className="p-4 text-center w-24">Model Değişim (Dk)</th>
                  <th className="p-4 text-center w-24">Arıza / Duruş (Dk)</th>
                  <th className="p-4 text-center w-24">Kullanılabilirlik</th>
                  <th className="p-4 text-center w-24">Performans</th>
                  <th className="p-4 text-center w-24">OEE oranı</th>
                  <th className="p-4 text-center w-24">Günlük Kapasite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {activeProcesses.map((p, idx) => {
                  const idealCT = p.idealCycleTime || p.cycleTime;
                  const isOverloaded = (p.actualQuantity ?? 0) > p.capacity;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="p-4 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="p-4 font-bold text-slate-900">{p.name}</td>
                      <td className="p-4 text-center">
                        <input
                          type="number"
                          value={p.plannedQuantity ?? ""}
                          onChange={e => handleUpdateProcessField(p.id, "plannedQuantity", optionalNumber(e.target.value))}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <input
                            type="number"
                            value={p.actualQuantity ?? ""}
                            onChange={e => handleUpdateProcessField(p.id, "actualQuantity", optionalNumber(e.target.value))}
                            title={isOverloaded ? `Bu miktar, kullanılabilir çalışma süresi içinde üretilebilecek maksimum ${p.capacity} adedi aşıyor.` : undefined}
                            className={`w-20 rounded-lg px-2 py-1 text-center font-mono font-bold text-xs ${
                              isOverloaded
                                ? "bg-red-50 border-2 border-red-400 text-red-700 focus:ring-2 focus:ring-red-200"
                                : "bg-slate-50 border border-slate-200 text-slate-800"
                            }`}
                          />
                          {isOverloaded && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 uppercase">
                              <AlertTriangle className="w-3 h-3" />
                              Kapasite Aşımı
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={idealCT}
                          onChange={e => handleUpdateProcessField(p.id, "idealCycleTime", optionalNumber(e.target.value))}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={p.changeoverTime ?? ""}
                          onChange={e => handleUpdateProcessField(p.id, "changeoverTime", optionalNumber(e.target.value))}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={p.breakdownTime ?? ""}
                          onChange={e => handleUpdateProcessField(p.id, "breakdownTime", optionalNumber(e.target.value))}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-mono font-bold text-slate-800">{p.availability}%</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-mono font-bold text-slate-800">{p.performance}%</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-mono font-extrabold px-2.5 py-1 rounded-lg ${
                          p.oee >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          p.oee >= 60 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {p.oee}%
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-mono font-bold px-2 py-1 rounded border ${
                          isOverloaded
                            ? "text-red-700 bg-red-50 border-red-200"
                            : "text-blue-600 bg-blue-50 border-blue-100"
                        }`}>
                          {p.capacity} adet
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <VsmDataBoxTable />
        </div>
  );
}
