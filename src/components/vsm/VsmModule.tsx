// VSM (Değer Akış Haritalama) module — entry point. Holds the workspace state (useVsmWorkspace), shares it
// with the tabs through VsmContext and renders the project portal or the open project's workspace.
// Plan: docs/VSM_IS_PLANI.md.
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


const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));
import { useVsmWorkspace } from "./useVsmWorkspace";
import { VsmContext } from "./VsmContext";
import VsmProjectPortal from "./VsmProjectPortal";
import VsmSetupTab from "./VsmSetupTab";
import VsmProductMatrixTab from "./VsmProductMatrixTab";
import VsmReportPages from "./VsmReportPages";
import { Layers } from "lucide-react";
import VsmDefinitionTab from "./VsmDefinitionTab";
import VsmProductionTab from "./VsmProductionTab";
import VsmQualityTab from "./VsmQualityTab";
import VsmMapTab from "./VsmMapTab";
import VsmDashboardTab from "./VsmDashboardTab";
import VsmProcessDrawer from "./VsmProcessDrawer";
import VsmExportModal from "./VsmExportModal";

export default function VsmModule({ currentUser = null }: { currentUser?: VsmUserLike | null }) {
  const vsm = useVsmWorkspace(currentUser);
  const { isDrawerOpen, activeProcess, exportModalOpen, projects, selectedProject, setSelectedProject, isSavingProject, justSavedProject, vsmProcesses, activeTab, setActiveTab, handleSelectProject, handlePersistWorkspaceState, simulationMode, setSimulationMode, isFullScreen, setIsFullScreen, setExportModalOpen, handleZoomReset } = vsm;

  if (!selectedProject) {
    return (
      <VsmContext.Provider value={vsm}>
        <VsmProjectPortal />
      </VsmContext.Provider>
    );
  }

  return (
    <VsmContext.Provider value={vsm}>

    <div className={`w-full bg-[#f8fafc] text-slate-900 font-sans ${isFullScreen ? 'fixed inset-0 z-50 overflow-hidden' : 'relative'}`} id="vsm_root_workspace">
      
      {/* VSM UPPER BANNER BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-white shadow-md shadow-slate-100">
              <GitCommit className="w-5 h-5 text-slate-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                  VSM WORKSPACE
                </span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-2 mt-1">
                <span className="text-xs font-bold text-slate-500 font-mono uppercase">VSM PROJESİ:</span>
                <div className="relative">
                  <select
                    value={selectedProject.id}
                    onChange={(e) => {
                      const nextProj = projects.find(p => p.id === e.target.value);
                      if (nextProj) handleSelectProject(nextProj);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl cursor-pointer outline-hidden focus:ring-1 focus:ring-slate-950 transition-all font-sans"
                    id="header_project_selector"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.status === "Tamamlandı" ? "✅ [TAMAMLANDI] " : "⚡ [AKTİF] "}
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* SIMULATION MODE BUTTON — moved directly under the VSM Workspace title */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 w-fit">
            <button
              onClick={() => {
                setSimulationMode("current");
                handleZoomReset();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                simulationMode === "current"
                  ? "bg-white text-slate-950 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Mevcut Durum (Current)</span>
            </button>
            <button
              onClick={() => {
                setSimulationMode("future");
                handleZoomReset();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                simulationMode === "future"
                  ? "bg-amber-600 text-white shadow-xs animate-pulse"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-100" />
              <span>Gelecek Simülasyon (Future)</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE ACTION BUTTONS — Kaydet + Export, right-aligned */}
        <div className="flex flex-wrap items-center gap-3">
          {/* PERSIST PROJECT STATE BUTTON */}
          <button
            id="save_project_btn"
            onClick={handlePersistWorkspaceState}
            disabled={isSavingProject}
            className="flex items-center space-x-1.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-sm h-9"
          >
            {isSavingProject ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : justSavedProject ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Save className="w-4 h-4 text-indigo-100" />
            )}
            <span className={justSavedProject ? "text-emerald-400" : ""}>
              {justSavedProject ? "Kaydedildi!" : "Kaydet"}
            </span>
          </button>

          {/* EXPORT WORKSPACE BUTTON */}
          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center space-x-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-sm h-9"
          >
            <Download className="w-4 h-4 text-slate-200" />
            <span>VSM Rapor Export</span>
          </button>

          {/* FULL SCREEN MODE */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-2 transition cursor-pointer shadow-xs w-9 h-9"
            title={isFullScreen ? "Çıkış Yap" : "Tam Ekran Yap"}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* VSM WORKSPACE TABS SWITCHER */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          {/* RETURN TO PROJECT LIST — compact home-icon button */}
          <button
            onClick={() => setSelectedProject(null)}
            className="flex items-center justify-center bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-950 rounded-xl p-2 transition cursor-pointer shadow-xs w-9 h-9 shrink-0"
            id="btn_back_to_projects"
            title="Proje Listesine Dön"
          >
            <Home className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTab("setup")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition border cursor-pointer ${
              activeTab === "setup" 
                ? "bg-slate-950 text-white border-slate-950 shadow-sm" 
                : "bg-white text-slate-600 hover:text-slate-900 border-slate-200"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Fabrika Kurulumu</span>
          </button>

          <button
            onClick={() => setActiveTab("family")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition border cursor-pointer ${
              activeTab === "family"
                ? "bg-slate-950 text-white border-slate-950 shadow-sm"
                : "bg-white text-slate-600 hover:text-slate-900 border-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Ürün Ailesi</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("definition")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition border cursor-pointer ${
              activeTab === "definition" 
                ? "bg-slate-950 text-white border-slate-950 shadow-sm" 
                : "bg-white text-slate-600 hover:text-slate-900 border-slate-200"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Proses Tanımlama</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("production")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition border cursor-pointer ${
              activeTab === "production" 
                ? "bg-slate-950 text-white border-slate-950 shadow-sm" 
                : "bg-white text-slate-600 hover:text-slate-900 border-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Üretim & Kapasite</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("quality")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition border cursor-pointer ${
              activeTab === "quality" 
                ? "bg-slate-950 text-white border-slate-950 shadow-sm" 
                : "bg-white text-slate-600 hover:text-slate-900 border-slate-200"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Kalite & Envanter</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("vsm")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition border cursor-pointer ${
              activeTab === "vsm" 
                ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-50" 
                : "bg-white text-slate-600 hover:text-slate-900 border-slate-200"
            }`}
          >
            <GitCommit className="w-4 h-4" />
            <span>Değer Akış Şeması (Map)</span>
          </button>

          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center space-x-2 transition border cursor-pointer ${
              activeTab === "dashboard" 
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-50" 
                : "bg-white text-slate-600 hover:text-slate-900 border-slate-200"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>VSM Analiz Paneli (Dashboard)</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">
            Hattaki Proses Sayısı:
          </span>
          <span className="text-xs bg-slate-200/60 text-slate-800 font-extrabold px-2.5 py-1 rounded-lg border border-slate-200/80 font-mono">
            {vsmProcesses.length} Operasyon
          </span>
        </div>
      </div>
      {/* TAB 1 — FABRİKA KURULUMU */}
      {activeTab === "setup" && <VsmSetupTab />}
      {activeTab === "family" && <VsmProductMatrixTab />}
      {/* TAB 2 — PROSES TANIMLAMA */}
      {activeTab === "definition" && <VsmDefinitionTab />}
      {/* TAB 3 — ÜRETİM & KAPASİTE */}
      {activeTab === "production" && <VsmProductionTab />}
      {/* TAB 4 — KALİTE & ENVANTER */}
      {activeTab === "quality" && <VsmQualityTab />}
      {/* TAB 5 — DEĞER AKIŞ ŞEMASI (MAP VISUALIZATION) */}
      {activeTab === "vsm" && <VsmMapTab />}
    {/* ========================================== */}
    {/* TAB 6 — VSM REAL-TIME COMPARATIVE DASHBOARD */}
    {/* ========================================== */}
      {activeTab === "dashboard" && <VsmDashboardTab />}
      {/* ========================================== */}
      {/* SIDE DRAWER FOR DETAILED PROCESS ANALYSIS    */}
      {/* ========================================== */}
      {isDrawerOpen && activeProcess && <VsmProcessDrawer />}
      {/* ========================================== */}
      {/* EXPORT OPTIONS MODAL                       */}
      {/* ========================================== */}
      {exportModalOpen && <VsmExportModal />}
      <VsmReportPages />

    </div>
    </VsmContext.Provider>
  );
}
