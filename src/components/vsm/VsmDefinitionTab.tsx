// VSM — Proses Tanımlama sekmesi: proses listesi, sıra, tip, vardiya, sonraki proses / bağlantı tipi.
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

export default function VsmDefinitionTab() {
  const { draggingIndex, activeProcesses, handleUpdateProcessField, handleAddProcess, handleDeleteProcess, handleDragStart, handleDragOver, handleDragEnd, currentUser } = useVsm();
  return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Proses Akış Yapılandırıcısı (Process Configurator)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Üretim hattındaki ana proses operasyonlarını, sıralarını ve kaynaklarını tanımlayın.</p>
            </div>
            <button 
              onClick={handleAddProcess}
              className="flex items-center space-x-1.5 bg-slate-950 text-white hover:bg-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Yeni Proses Ekle</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs min-w-[1150px]">
              <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4 w-16 text-center">Sıra</th>
                  <th className="p-4 min-w-[180px]">Proses Adı</th>
                  <th className="p-4 w-36">Tip</th>
                  <th className="p-4 w-36">Üretim Modeli</th>
                  <th className="p-4 text-center w-28">Operatör HC</th>
                  <th className="p-4 text-center w-28">Makine HC</th>
                  <th className="p-4 text-center w-28">Vardiya Sayısı</th>
                  <th className="p-4 text-center min-w-[240px]">Vardiya Süreleri &amp; Çalışma Saati</th>
                  <th className="p-4 text-center w-16">Sırala</th>
                  <th className="p-4 text-right w-24">Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeProcesses.map((p, idx) => (
                  <tr 
                    key={p.id} 
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`hover:bg-slate-50/50 transition-colors ${draggingIndex === idx ? 'opacity-40 bg-slate-100' : ''}`}
                  >
                    <td className="p-4 text-center font-mono font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="p-4">
                      <input 
                        type="text" 
                        value={p.name}
                        onChange={e => handleUpdateProcessField(p.id, "name", e.target.value)}
                        className="bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 w-full outline-hidden text-xs transition-all"
                      />
                    </td>
                    <td className="p-4">
                      <select 
                        value={p.type}
                        onChange={e => handleUpdateProcessField(p.id, "type", e.target.value)}
                        className="w-full bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-2 py-1.5 font-semibold text-slate-700 outline-hidden text-xs cursor-pointer transition-all"
                      >
                        <option value="Manual">Manuel (Manual)</option>
                        <option value="Semi Automatic">Yarı Otomatik</option>
                        <option value="Automatic">Tam Otomatik</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <select 
                        value={p.productionModel}
                        onChange={e => handleUpdateProcessField(p.id, "productionModel", e.target.value)}
                        className="w-full bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg px-2 py-1.5 font-semibold text-slate-700 outline-hidden text-xs cursor-pointer transition-all"
                      >
                        <option value="Cell">Hücresel (Cell)</option>
                        <option value="Assembly Line">Montaj Hattı</option>
                        <option value="Batch">Batch / Kesikli</option>
                        <option value="Other">Diğer (Other)</option>
                      </select>
                    </td>
                    <td className="p-4 text-center">
                      <input 
                        type="number" 
                        value={p.operatorCount}
                        onChange={e => handleUpdateProcessField(p.id, "operatorCount", Number(e.target.value))}
                        className="w-16 bg-slate-50 hover:bg-white border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-2 py-1.5 text-center font-mono font-bold text-slate-800 transition-all"
                        min="0"
                      />
                    </td>
                    <td className="p-4 text-center">
                      <input 
                        type="number" 
                        value={p.machineCount}
                        onChange={e => handleUpdateProcessField(p.id, "machineCount", Number(e.target.value))}
                        className="w-16 bg-slate-50 hover:bg-white border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg px-2 py-1.5 text-center font-mono font-bold text-slate-800 transition-all"
                        min="0"
                      />
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center space-x-1 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 transition-all">
                        <input 
                          type="number" 
                          value={p.shifts}
                          onChange={e => handleUpdateProcessField(p.id, "shifts", Number(e.target.value))}
                          className="w-10 bg-transparent text-center font-mono font-bold text-slate-800 text-xs focus:ring-0 focus:outline-none p-0 border-none"
                          min="1"
                          max="5"
                        />
                        <span className="text-[10px] font-bold text-slate-400 pr-1 border-l border-slate-200 pl-1.5 font-sans">vdy</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-4">
                        <div className="flex flex-wrap gap-1.5 justify-center">
                          {Array.from({ length: p.shifts || 1 }).map((_, sIdx) => {
                            const hours = p.shiftHours?.[sIdx] !== undefined ? p.shiftHours[sIdx] : 8;
                            return (
                              <div key={sIdx} className="flex items-center space-x-1 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2 py-1 transition-all shadow-2xs">
                                <span className="text-[11px] text-slate-400 font-bold font-mono">V{sIdx + 1}:</span>
                                <input 
                                  type="number" 
                                  step="0.5"
                                  value={hours}
                                  onChange={e => {
                                    const currentHours = [...(p.shiftHours || Array.from({ length: p.shifts || 1 }, () => 8))];
                                    currentHours[sIdx] = Number(e.target.value) || 0;
                                    handleUpdateProcessField(p.id, "shiftHours", currentHours);
                                  }}
                                  className="w-10 bg-transparent p-0 text-center font-mono text-xs font-bold text-slate-800 focus:ring-0 focus:outline-none border-none"
                                  min="0"
                                  max="24"
                                />
                                <span className="text-[11px] text-slate-400 font-medium">sa</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="border-l border-slate-200 pl-4 py-0.5 text-right shrink-0">
                          <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-bold">Toplam</span>
                          <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50/80 px-2 py-1 rounded-lg border border-indigo-100">{(p.workingHours || 8).toFixed(1)} sa</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-600 transition" title="Sürükleyip Bırakarak Sırala">
                        <GripVertical className="w-5 h-5" />
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {canDeleteVsmProcess(currentUser, p) && <button 
                        onClick={() => handleDeleteProcess(p.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Prosesi Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>}
                    </td>
                  </tr>
                ))}
                {activeProcesses.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 font-bold">
                      Hattınızda henüz tanımlı bir proses bulunmamaktadır. "Yeni Proses Ekle" butonu ile başlayın.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
  );
}
