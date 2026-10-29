// VSM — Kalite & Envanter sekmesi: sağlam / hurda / rework, WIP, kanban / süpermarket.
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
import { VSM_INVENTORY_TYPES, VsmInventoryType } from "./vsmTypes";

const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

export default function VsmQualityTab() {
  const { activeProcesses, handleUpdateProcessField } = useVsm();
  return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 font-sans">Kalite, FPY ve Stok (WIP Envanter) Girişleri</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">Operasyon öncesindeki ara stokları (WIP), sağlam/hurda miktarlarını ve kalitesizlik maliyet parametrelerini düzenleyin.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200 font-sans">
                <tr>
                  <th className="p-4 w-16 text-center">Sıra</th>
                  <th className="p-4">Proses Adı</th>
                  <th className="p-4 text-center w-28">Sağlam Adet</th>
                  <th className="p-4 text-center w-28">Hurda / Fire</th>
                  <th className="p-4 text-center w-28">Yeniden İşlem</th>
                  <th className="p-4 text-center w-28">Kalite Oranı FPY</th>
                  <th className="p-4 text-center w-28">Ara Stok WIP (Adet)</th>
                  <th className="p-4 text-center w-28">Stok Bekleme Günü</th>
                  <th className="p-4 text-center w-28">Kanban Sinyali</th>
                  <th className="p-4 text-center w-36">Stok Tipi (proses önü)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {activeProcesses.map((p, idx) => {
                  const actual = p.actualQuantity ?? 0;
                  const scrapVal = p.scrap ?? 0;
                  const goodVal = p.goodParts ?? (actual - scrapVal);
                  const isKanban = p.isKanbanEnabled;
                  const isSuper = p.isSupermarket;
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="p-4 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="p-4 font-bold text-slate-900">{p.name}</td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={goodVal}
                          onChange={e => handleUpdateProcessField(p.id, "goodParts", optionalNumber(e.target.value))}
                          className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={scrapVal}
                          onChange={e => handleUpdateProcessField(p.id, "scrap", optionalNumber(e.target.value))}
                          className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={p.rework ?? ""}
                          onChange={e => handleUpdateProcessField(p.id, "rework", optionalNumber(e.target.value))}
                          className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-mono font-bold text-slate-800">{p.quality}%</span>
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={p.inventoryBefore}
                          onChange={e => handleUpdateProcessField(p.id, "inventoryBefore", Number(e.target.value))}
                          className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-mono font-bold text-slate-800">{p.inventoryDays} gün</span>
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleUpdateProcessField(p.id, "isKanbanEnabled", !isKanban)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                            isKanban 
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {isKanban ? "AKTİF" : "PASİF"}
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <select
                            value={p.inventoryType ?? (isSuper ? "supermarket" : "pile")}
                            onChange={e => {
                              const type = e.target.value as VsmInventoryType;
                              handleUpdateProcessField(p.id, "inventoryType", type);
                              // The map's supermarket icon still reads the flag.
                              handleUpdateProcessField(p.id, "isSupermarket", type === "supermarket");
                            }}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800"
                          >
                            {VSM_INVENTORY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {p.inventoryType === "fifo" && (
                            <input
                              type="number"
                              min={0}
                              value={p.fifoMax ?? ""}
                              placeholder="FIFO maks."
                              onChange={e => handleUpdateProcessField(p.id, "fifoMax", optionalNumber(e.target.value))}
                              className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono text-[11px]"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
  );
}
