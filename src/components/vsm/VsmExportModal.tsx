// VSM — Dışa aktarma penceresi (CSV / PNG / PDF).
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

export default function VsmExportModal() {
  const { zoom, setExportModalOpen, exportStatus, handleTriggerExport } = useVsm();
  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            onClick={() => setExportModalOpen(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
          />

          {/* Modal box */}
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden z-10 animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider font-mono flex items-center space-x-1.5">
                <Share2 className="w-4 h-4 text-slate-200" />
                <span>Value Stream Export Sihirbazı</span>
              </h3>
              <button 
                onClick={() => setExportModalOpen(false)}
                className="text-slate-400 hover:text-white font-black cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-600">
              <p>
                PDF ve PNG seçenekleri, ekranda gördüğünüz değer akış şemasının birebir (1:1) görüntüsünü dışa aktarır. Excel seçeneği ise proses verilerini tablo olarak indirir.
              </p>

              {exportStatus ? (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-center space-x-3">
                  <Loader2 className="w-5 h-5 text-slate-900 animate-spin" />
                  <span className="font-bold text-slate-850 font-mono text-[11px]">{exportStatus}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleTriggerExport("PDF Report")}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition text-left flex flex-col justify-between font-bold h-24"
                  >
                    <div className="bg-red-100 p-1 rounded-lg text-red-600 self-start">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-slate-800">PDF Raporu</span>
                  </button>
                  <button 
                    onClick={() => handleTriggerExport("Excel")}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition text-left flex flex-col justify-between font-bold h-24"
                  >
                    <div className="bg-emerald-100 p-1 rounded-lg text-emerald-600 self-start">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-slate-800">Excel / CSV Veri</span>
                  </button>
                  <button
                    onClick={() => handleTriggerExport("High Res PNG")}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition text-left flex flex-col justify-between font-bold h-24"
                  >
                    <div className="bg-blue-100 p-1 rounded-lg text-blue-600 self-start">
                      <Printer className="w-5 h-5" />
                    </div>
                    <span className="text-slate-800">Yüksek Res PNG</span>
                    <span className="text-[10px] font-normal text-slate-400 normal-case">Şemanın birebir görüntüsü</span>
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold text-xs cursor-pointer transition text-slate-700"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
  );
}
