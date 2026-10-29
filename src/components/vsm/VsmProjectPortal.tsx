// VSM — project portal: list of the customer's VSM projects, search / status filter, new / edit dialog.
// State comes from useVsmWorkspace() through VsmContext.
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
import VsmSettingsModal from "./VsmSettingsModal";
import { isVsmStaff } from "../../utils/vsmAccess";

const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

export default function VsmProjectPortal() {
  const { selectedCustomer, isLoading, projects, isProjectModalOpen, setIsProjectModalOpen, editingProject, isSavingProject, searchQuery, setSearchQuery, statusFilter, setStatusFilter, projForm, setProjForm, handleOpenNewProjectModal, handleOpenEditProjectModal, handleSaveProjectForm, handleDeleteProject, handleSelectProject, zoom, companyCurrency, currentUser } = useVsm();
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const activeCount = projects.filter(p => p.status === "Aktif").length;
    const completedCount = projects.filter(p => p.status === "Tamamlandı").length;
    const suspendedCount = projects.filter(p => p.status === "Askıda").length;

    const filteredProjects = projects.filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.productGroup?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.productionLine?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.leader?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans bg-[#f8fafc] min-h-screen" id="vsm_projects_portal">
        {/* UPPER HEADER */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono">
                DEĞER AKIŞ HARİTALAMA
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <GitCommit className="w-6 h-6 text-slate-800 animate-pulse" />
              Değer Akış Haritalama (VSM) — Projeler
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {selectedCustomer?.companyName || "Müşteri"} fabrikası için tanımlanmış değer akış çalışmaları ve kümülatif kazanımlar.
            </p>
          </div>
          <div className="flex items-center gap-2">
          {isVsmStaff(currentUser) && (
            <button onClick={() => setSettingsOpen(true)} title="VSM ayarları (bu müşteri)"
              className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl cursor-pointer">
              <Settings className="w-4 h-4" /> Ayarlar
            </button>
          )}
          {settingsOpen && <VsmSettingsModal onClose={() => setSettingsOpen(false)} />}
          <button 
            onClick={handleOpenNewProjectModal}
            className="flex items-center space-x-2 bg-slate-950 text-white hover:bg-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md shadow-slate-100"
            id="btn_create_project"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni VSM Projesi</span>
          </button>
          </div>
        </div>

        {/* TRANSFORMATION JOURNEY DASHBOARD (Bento Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" id="transformation_journey_bento">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-32 relative overflow-hidden" id="card_total_projects">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-mono font-bold uppercase block tracking-wider">TOPLAM VSM PROJESİ</span>
              <span className="text-3xl font-mono font-black text-slate-900">{projects.length}</span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
              <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
              <span>Sistemde kayıtlı toplam analiz sayısı</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-32 relative overflow-hidden" id="card_active_projects">
            <div className="space-y-1">
              <span className="text-[10px] text-emerald-500 font-mono font-bold uppercase block tracking-wider">AKTİF ÇALIŞMALAR</span>
              <span className="text-3xl font-mono font-black text-slate-900">{activeCount}</span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Süreci devam eden aktif hatlar</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-32 relative overflow-hidden" id="card_completed_projects">
            <div className="space-y-1">
              <span className="text-[10px] text-indigo-500 font-mono font-bold uppercase block tracking-wider">TAMAMLANAN ÇALIŞMALAR</span>
              <span className="text-3xl font-mono font-black text-slate-900">{completedCount}</span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
              <span>Kazanımları tescil edilmiş projeler</span>
            </div>
          </div>

        </div>

        {/* SEARCH AND FILTERS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs" id="vsm_projects_filter_bar">
          <div className="w-full md:w-80 relative">
            <input 
              type="text" 
              placeholder="Proje adı, hat, lider ara..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden transition-all text-slate-800"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto">
              <span className="text-xs font-bold text-slate-400 font-mono uppercase shrink-0">Durum Filtresi:</span>
              {["All", "Aktif", "Tamamlandı", "Askıda"].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition shrink-0 cursor-pointer ${
                    statusFilter === st 
                      ? "bg-slate-950 text-white border-slate-950" 
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st === "All" ? "Tümü" : st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PROJECTS GRID LIST */}
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-10 h-10 text-slate-950 animate-spin" />
            <span className="text-xs font-bold text-slate-500 font-mono tracking-wider">VSM Projeleri Yükleniyor...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-slate-100 p-4 rounded-full">
              <ClipboardList className="w-8 h-8 text-slate-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-800">VSM Projesi Bulunamadı</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Seçilen kriterlere veya müşteriye ait herhangi bir değer akış analizi projesi bulunmuyor. Yeni bir tane tanımlayarak başlayın!
              </p>
            </div>
            <button 
              onClick={handleOpenNewProjectModal}
              className="bg-slate-950 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-slate-800 cursor-pointer transition shadow-xs"
            >
              Proje Tanımla
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs" id="vsm_projects_table_container">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                    <th className="py-4 px-6 w-12 text-center">No</th>
                    <th className="py-4 px-6">Proje Adı</th>
                    <th className="py-4 px-6">Ürün Grubu</th>
                    <th className="py-4 px-6">Bölüm / Hat</th>
                    <th className="py-4 px-6">Proje Lideri</th>
                    <th className="py-4 px-6">Başlangıç</th>
                    <th className="py-4 px-6">Bitiş Tarihi</th>
                    <th className="py-4 px-6">Durum</th>
                    <th className="py-4 px-6 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredProjects.map((proj, idx) => {
                    const statusColors = 
                      proj.status === "Tamamlandı" 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                        : proj.status === "Aktif" 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold" 
                          : "bg-amber-50 border-amber-200 text-amber-700";

                    return (
                      <tr 
                        key={proj.id}
                        onClick={() => handleSelectProject(proj)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-6 text-center font-mono text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {proj.name}
                          </div>
                          {proj.description && (
                            <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 max-w-xs">
                              {proj.description}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-600">
                          {proj.productGroup || "—"}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-600">
                          {proj.productionLine || "—"}
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-800">
                          {proj.leader || "—"}
                        </td>
                        <td className="py-4 px-6 font-mono text-slate-500">
                          {proj.startDate || "—"}
                        </td>
                        <td className="py-4 px-6 font-mono text-slate-500">
                          {proj.targetDate || "—"}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider border px-2.5 py-0.5 rounded-full font-mono ${statusColors}`}>
                            {proj.status === "Aktif" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                            {proj.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1.5">
                            <button 
                              onClick={() => handleSelectProject(proj)}
                              className="px-3 py-1.5 bg-slate-950 text-white hover:bg-indigo-600 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Analizi Aç"
                            >
                              <span>Aç</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={(e) => handleOpenEditProjectModal(proj, e)}
                              className="p-1.5 border border-slate-200 bg-white hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
                              title="Düzenle"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            {canDeleteVsmProject(currentUser, proj) && <button 
                              onClick={(e) => handleDeleteProject(proj.id, e)}
                              className="p-1.5 border border-red-150 bg-white hover:bg-red-50 rounded-lg text-red-500 hover:text-red-700 transition cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* NEW/EDIT PROJECT DIALOG MODAL */}
        {isProjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="project_form_modal">
            <div 
              onClick={() => setIsProjectModalOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
            />
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden z-10 animate-in zoom-in-95 duration-150">
              <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider font-mono flex items-center space-x-1.5">
                  <GitCommit className="w-4 h-4 text-slate-200" />
                  <span>{editingProject ? "VSM Projesini Düzenle" : "Yeni VSM Projesi Tanımla"}</span>
                </h3>
                <button 
                  onClick={() => setIsProjectModalOpen(false)}
                  className="text-slate-400 hover:text-white font-black cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProjectForm} className="p-6 space-y-4 text-xs text-slate-700">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Proje Adı *</label>
                  <input 
                    type="text" 
                    required
                    value={projForm.name}
                    onChange={e => setProjForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden text-slate-800"
                    placeholder="Örn: Ütü Üretim VSM Analizi"
                    id="input_project_name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Ürün Grubu</label>
                    <input 
                      type="text" 
                      value={projForm.productGroup}
                      onChange={e => setProjForm(p => ({ ...p, productGroup: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden text-slate-800"
                      placeholder="Örn: Elektrikli Ev Aletleri"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Ürün Kodu</label>
                    <input 
                      type="text" 
                      value={projForm.productCode}
                      onChange={e => setProjForm(p => ({ ...p, productCode: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden text-slate-800"
                      placeholder="Örn: UT-450-XR"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Üretim Hattı</label>
                    <input 
                      type="text" 
                      value={projForm.productionLine}
                      onChange={e => setProjForm(p => ({ ...p, productionLine: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden text-slate-800"
                      placeholder="Örn: Pres & Montaj Bandı"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Departman</label>
                    <input 
                      type="text" 
                      value={projForm.department}
                      onChange={e => setProjForm(p => ({ ...p, department: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden text-slate-800"
                      placeholder="Örn: Sürekli İyileştirme"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Proje Lideri</label>
                    <input 
                      type="text" 
                      value={projForm.leader}
                      onChange={e => setProjForm(p => ({ ...p, leader: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden text-slate-800"
                      placeholder="Örn: Ahmet Yılmaz"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Başlangıç Tarihi</label>
                    <input 
                      type="date" 
                      value={projForm.startDate}
                      onChange={e => setProjForm(p => ({ ...p, startDate: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden text-slate-800 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 block">Hedef Bitiş Tarihi</label>
                    <input 
                      type="date" 
                      value={projForm.targetDate}
                      onChange={e => setProjForm(p => ({ ...p, targetDate: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden text-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Durum (Status)</label>
                  <select 
                    value={projForm.status}
                    onChange={e => setProjForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden text-slate-800"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Tamamlandı">Tamamlandı</option>
                    <option value="Askıda">Askıda</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 block">Açıklama</label>
                  <textarea 
                    value={projForm.description}
                    onChange={e => setProjForm(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden text-slate-800 resize-none"
                    placeholder="Bu değer akış analizinin kapsamını ve israf odak noktalarını kısaca belirtin..."
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setIsProjectModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold text-xs text-slate-700 transition cursor-pointer"
                  >
                    İptal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSavingProject}
                    className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition cursor-pointer flex items-center space-x-1"
                  >
                    {isSavingProject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingProject ? "Değişiklikleri Kaydet" : "Proje Oluştur"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
}
