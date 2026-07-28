import React, { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard, ClipboardList, Sliders, Coins, CheckSquare,
  Activity, Award, BookOpen, Plus, Trash2, Edit2, TrendingUp,
  Download, ArrowRight, Play, Eye, FileText, CheckCircle2,
  XCircle, AlertCircle, Sparkles, RefreshCw, Send, Check,
  GripVertical, FolderPlus, Archive, Settings, Info, Save
} from "lucide-react";

import { ActivityItem, SmedProject, ActionCard } from "./smed/smedTypes";
import { initialSmedProjects, defaultActions, calculateDurationFromTimes } from "./smed/smedDefaults";
import ActivityListTab from "./smed/ActivityListTab";
import GanttTimelineTab from "./smed/GanttTimelineTab";
import ConversionSimulatorTab from "./smed/ConversionSimulatorTab";

export default function SmedPage() {
  // Navigation for SMED sub-modules
  const [smedTab, setSmedTab] = useState<
    "dashboard" | "analysis" | "simulator" | "financial" | "actions" | "oee"
  >("dashboard");

  // SMED Analysis sub-tabs
  const [analysisSubTab, setAnalysisSubTab] = useState<"activities" | "timeline" | "conversion">("activities");

  // --- MULTI-PROJECT STATE MANAGEMENT ---
  const [projects, setProjects] = useState<SmedProject[]>(() => {
    const local = localStorage.getItem("smed_projects_v2");
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error("Failed to parse SMED projects from localStorage:", e);
      }
    }
    return initialSmedProjects;
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return localStorage.getItem("smed_selected_project_id") || "proj-1";
  });

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Project Form State
  const [projForm, setProjForm] = useState({
    code: "",
    name: "",
    leader: "",
    team: "",
    startDate: "",
    targetEndDate: "",
    factory: "İstanbul Fabrika",
    productionLine: "",
    machineNo: "",
    moldNo: "",
    productCode: "",
    productName: "",
    currentSetupTime: 60,
    targetSetupTime: 15,
  });

  // Save projects to localStorage
  useEffect(() => {
    localStorage.setItem("smed_projects_v2", JSON.stringify(projects));
  }, [projects]);

  // Save selected project ID to localStorage
  useEffect(() => {
    localStorage.setItem("smed_selected_project_id", selectedProjectId);
  }, [selectedProjectId]);

  // Find active project
  const activeProject = useMemo(() => {
    return (
      projects.find((p) => p.id === selectedProjectId && !p.isArchived) ||
      projects.find((p) => !p.isArchived) ||
      projects[0]
    );
  }, [projects, selectedProjectId]);

  // Always sync selectedProjectId to active project ID if current is archived/missing
  useEffect(() => {
    if (activeProject && activeProject.id !== selectedProjectId) {
      setSelectedProjectId(activeProject.id);
    }
  }, [activeProject, selectedProjectId]);

  // Derived activities from active project
  const activities = useMemo(() => {
    return activeProject?.activities || [];
  }, [activeProject]);

  // Update active project's activities
  const handleUpdateActivities = (newActivities: ActivityItem[]) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? { ...p, activities: newActivities } : p))
    );
  };

  // Open Project Creation Modal
  const handleOpenCreateModal = () => {
    setEditingProjectId(null);
    setProjForm({
      code: `PRJ-SMD-0${projects.filter(p => !p.isArchived).length + 1}`,
      name: "",
      leader: "",
      team: "",
      startDate: new Date().toISOString().split("T")[0],
      targetEndDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
      factory: "İstanbul Fabrika",
      productionLine: "",
      machineNo: "",
      moldNo: "",
      productCode: "",
      productName: "",
      currentSetupTime: 60,
      targetSetupTime: 15,
    });
    setIsProjectModalOpen(true);
  };

  // Open Project Edit Modal
  const handleOpenEditModal = () => {
    if (!activeProject) return;
    setEditingProjectId(activeProject.id);
    setProjForm({
      code: activeProject.code,
      name: activeProject.name,
      leader: activeProject.leader,
      team: activeProject.team,
      startDate: activeProject.startDate,
      targetEndDate: activeProject.targetEndDate,
      factory: activeProject.factory,
      productionLine: activeProject.productionLine,
      machineNo: activeProject.machineNo,
      moldNo: activeProject.moldNo,
      productCode: activeProject.productCode,
      productName: activeProject.productName,
      currentSetupTime: activeProject.currentSetupTime,
      targetSetupTime: activeProject.targetSetupTime,
    });
    setIsProjectModalOpen(true);
  };

  // Save Project Form
  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projForm.name.trim()) return;

    if (editingProjectId) {
      // Edit mode
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editingProjectId
            ? {
                ...p,
                code: projForm.code,
                name: projForm.name,
                leader: projForm.leader,
                team: projForm.team,
                startDate: projForm.startDate,
                targetEndDate: projForm.targetEndDate,
                factory: projForm.factory,
                productionLine: projForm.productionLine,
                machineNo: projForm.machineNo,
                moldNo: projForm.moldNo,
                productCode: projForm.productCode,
                productName: projForm.productName,
                currentSetupTime: projForm.currentSetupTime,
                targetSetupTime: projForm.targetSetupTime,
              }
            : p
        )
      );
    } else {
      // Create mode
      const newProj: SmedProject = {
        id: `proj-${Date.now()}`,
        code: projForm.code,
        name: projForm.name,
        leader: projForm.leader,
        team: projForm.team,
        startDate: projForm.startDate,
        targetEndDate: projForm.targetEndDate,
        factory: projForm.factory,
        productionLine: projForm.productionLine,
        machineNo: projForm.machineNo,
        moldNo: projForm.moldNo,
        productCode: projForm.productCode,
        productName: projForm.productName,
        currentSetupTime: projForm.currentSetupTime,
        targetSetupTime: projForm.targetSetupTime,
        activities: [], // Starts empty for observation studies!
      };
      setProjects((prev) => [...prev, newProj]);
      setSelectedProjectId(newProj.id);
    }
    setIsProjectModalOpen(false);
  };

  // Archive Project
  const handleArchiveProject = () => {
    if (!activeProject) return;
    if (confirm(`"${activeProject.name}" projesini arşivlemek istediğinize emin misiniz?`)) {
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProject.id ? { ...p, isArchived: true } : p))
      );
    }
  };

  // Metadata hook values (tied to active project)
  const analysisName = activeProject?.name || "";
  const factoryName = activeProject?.factory || "";
  const machineName = activeProject?.machineNo || "";
  const currentProduct = activeProject?.productCode || "";
  const newProduct = activeProject?.productName || "";
  const observers = activeProject?.leader || "";

  // Calculations derived from current activities state
  const totalDuration = useMemo(() => activities.reduce((sum, a) => sum + a.dur, 0), [activities]);
  const internalDuration = useMemo(() => activities.filter((a) => a.type === "internal").reduce((sum, a) => sum + a.dur, 0), [activities]);
  const externalDuration = useMemo(() => activities.filter((a) => a.type === "external").reduce((sum, a) => sum + a.dur, 0), [activities]);

  const internalPercent = useMemo(() => (totalDuration > 0 ? Math.round((internalDuration / totalDuration) * 100) : 0), [internalDuration, totalDuration]);
  const externalPercent = useMemo(() => (totalDuration > 0 ? Math.round((externalDuration / totalDuration) * 100) : 0), [externalDuration, totalDuration]);

  // Derived ECRS gains for dynamic Financial Feasibility link
  const getEcrsGain = (a: ActivityItem): number => {
    if (!a.ecrsGains) return 0;
    return (a.ecrsGains.E || 0) + (a.ecrsGains.C || 0) + (a.ecrsGains.R || 0) + (a.ecrsGains.S || 0);
  };

  const totalEcrsGain = useMemo(() => {
    return activities.reduce((sum, a) => sum + getEcrsGain(a), 0);
  }, [activities]);

  const targetSetupTime = useMemo(() => {
    return Math.max(0, totalDuration - totalEcrsGain);
  }, [totalDuration, totalEcrsGain]);

  // 2. STATE: Financial Impact Parameters
  const [mc, setMc] = useState(4500); // machine cost
  const [lc, setLc] = useState(850);  // labor cost
  const [ns, setNs] = useState(240);  // annual setups
  const [cm, setCm] = useState(12000); // margin
  const [inv, setInv] = useState(350000); // investment

  // Calculate financial derived results based on simulation targetSetupTime
  const savedMin = useMemo(() => Math.max(0, (totalDuration - targetSetupTime) * ns), [totalDuration, targetSetupTime, ns]);
  const savedHrs = useMemo(() => Math.round(savedMin / 60), [savedMin]);
  const capPct = useMemo(() => {
    const currentSetupHrs = (ns * totalDuration) / 60;
    return currentSetupHrs > 0 ? Number(((savedHrs / currentSetupHrs) * 100).toFixed(1)) : 0;
  }, [savedHrs, ns, totalDuration]);
  const benefit = useMemo(() => savedHrs * (mc + lc + cm), [savedHrs, mc, lc, cm]);
  const roi = useMemo(() => (inv > 0 ? Math.round(((benefit - inv) / inv) * 100) : 0), [benefit, inv]);
  const payback = useMemo(() => (benefit > 0 ? Number(((inv / benefit) * 12).toFixed(1)) : 0), [inv, benefit]);
  const npv = useMemo(() => benefit * 3 - inv, [benefit, inv]);

  // 3. STATE: Actions Tracker
  const [actions, setActions] = useState<ActionCard[]>(defaultActions);

  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionPriority, setNewActionPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [newActionAssignee, setNewActionAssignee] = useState("");
  const [newActionDue, setNewActionDue] = useState("");
  const [newActionBenefit, setNewActionBenefit] = useState("");

  const handleAddAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionTitle.trim()) return;
    const newCard: ActionCard = {
      id: Date.now(),
      title: newActionTitle,
      priority: newActionPriority,
      assignee: newActionAssignee || "Atanmadı",
      dueDate: newActionDue || "Belirtilmedi",
      benefit: newActionBenefit || "—",
      column: "open",
    };
    setActions([...actions, newCard]);
    setNewActionTitle("");
    setNewActionAssignee("");
    setNewActionDue("");
    setNewActionBenefit("");
  };

  const moveAction = (id: number, targetCol: ActionCard["column"]) => {
    setActions(actions.map((a) => (a.id === id ? { ...a, column: targetCol } : a)));
  };

  const [isDraggingOverCol, setIsDraggingOverCol] = useState<Record<string, boolean>>({});

  const handleKanbanDragStart = (e: React.DragEvent, cardId: number) => {
    e.dataTransfer.setData("text/plain", cardId.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleKanbanDragOver = (e: React.DragEvent, colName: ActionCard["column"]) => {
    e.preventDefault();
    setIsDraggingOverCol(prev => ({ ...prev, [colName]: true }));
  };

  const handleKanbanDragLeave = (colName: ActionCard["column"]) => {
    setIsDraggingOverCol(prev => ({ ...prev, [colName]: false }));
  };

  const handleKanbanDrop = (e: React.DragEvent, colName: ActionCard["column"]) => {
    e.preventDefault();
    setIsDraggingOverCol(prev => ({ ...prev, [colName]: false }));
    const cardIdStr = e.dataTransfer.getData("text/plain");
    const cardId = parseInt(cardIdStr);
    if (!isNaN(cardId)) {
      moveAction(cardId, colName);
    }
  };

  return (
    <div className="space-y-6">
      {/* SMED UPPER BANNER BAR (VSM STYLE) */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start md:items-center space-x-3">
          <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-white shadow-md shadow-slate-100 shrink-0 mt-1 md:mt-0">
            <ClipboardList className="w-5 h-5 text-slate-100" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                SMED WORKSPACE
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 text-xs font-semibold">Gemba Partner OpEx Suite</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              Setup Excellence &amp; SMED Analiz Merkezi
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
              Changeover sürelerini tek haneli dakikalara (SMED) indirmek için hazırlanan entegre izleme, simülasyon, OEE ve finansal fizibilite merkezi.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end shrink-0 mt-2 md:mt-0">
          <div className="flex items-center gap-2 text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Metrikler Aktif</span>
          </div>
          <button 
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-2 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md shadow-slate-100"
            id="btn_create_smed_project_top"
          >
            <Plus className="w-4 h-4" />
            <span>+SMED Analizi</span>
          </button>
        </div>
      </div>

      {/* HORIZONTAL MODULE SELECTOR TABS */}
      <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
        <button
          onClick={() => setSmedTab("dashboard")}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
            smedTab === "dashboard"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Executive Dashboard</span>
        </button>

        <button
          onClick={() => setSmedTab("analysis")}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
            smedTab === "analysis"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>SMED Analiz Listesi</span>
        </button>

        <button
          onClick={() => setSmedTab("simulator")}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
            smedTab === "simulator"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>İyileştirme Simülatörü</span>
        </button>

        <button
          onClick={() => setSmedTab("financial")}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
            smedTab === "financial"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Finansal Etki Fizibilitesi</span>
        </button>

        <button
          onClick={() => setSmedTab("actions")}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
            smedTab === "actions"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Aksiyon Takip (Kanban)</span>
        </button>

        <button
          onClick={() => setSmedTab("oee")}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
            smedTab === "oee"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>OEE Entegrasyonu</span>
        </button>
      </div>

      {/* MULTI-PROJECT SELECTOR BAR */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1 w-full">
          <div className="space-y-1 shrink-0 w-full md:w-auto">
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Aktif SMED Projesi</span>
            <div className="relative">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg py-1.5 pl-3 pr-8 text-xs font-bold text-slate-800 shadow-2xs focus:ring-1 focus:ring-blue-500 cursor-pointer appearance-none w-full md:min-w-[240px]"
              >
                {projects.filter(p => !p.isArchived).map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <Sliders className="w-3 h-3" />
              </div>
            </div>
          </div>

          {activeProject && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-2 bg-white/60 border border-slate-200/50 p-3 rounded-lg flex-1 w-full">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Lider</span>
                <span className="text-sm font-black text-slate-800 truncate block mt-0.5">{activeProject.leader || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Makine / Ekipman</span>
                <span className="text-sm font-black text-slate-800 truncate block mt-0.5">{activeProject.machineNo || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Kalıp No</span>
                <span className="text-sm font-black text-slate-800 truncate block mt-0.5">{activeProject.moldNo || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Ürün Kodu</span>
                <span className="text-sm font-black text-slate-800 truncate block mt-0.5">{activeProject.productCode || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Mevcut Süre</span>
                <span className="text-sm font-black text-red-600 block mt-0.5">{totalDuration} dk</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block uppercase">Hedef Süre</span>
                <span className="text-sm font-black text-blue-600 block mt-0.5">{activeProject.targetSetupTime} dk</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
          <button
            onClick={handleOpenEditModal}
            className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-black px-3.5 py-1.8 rounded-lg border border-slate-300 flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
            title="Proje Metadatasını Düzenle"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Düzenle</span>
          </button>
          <button
            onClick={handleArchiveProject}
            className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-black px-2.5 py-1.8 rounded-lg border border-red-200 flex items-center space-x-1 cursor-pointer transition-colors"
            title="Aktif Projeyi Arşive Gönder"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* PROJECT CREATION / EDIT MODAL */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl w-full shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setIsProjectModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-black text-slate-800 uppercase flex items-center space-x-2 border-b border-slate-100 pb-3 mb-4">
              <FolderPlus className="w-4.5 h-4.5 text-blue-600" />
              <span>{editingProjectId ? "SMED Projesini Düzenle" : "Yeni SMED Projesi Ekle"}</span>
            </h3>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Proje Kodu</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.code}
                    onChange={(e) => setProjForm({ ...projForm, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Proje Adı / Tanımı</label>
                  <input
                    type="text"
                    required
                    placeholder="örn: Pres-1 Kalıp Değişimi"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.name}
                    onChange={(e) => setProjForm({ ...projForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Çalışma Lideri / Mühendis</label>
                  <input
                    type="text"
                    required
                    placeholder="örn: M. Yılmaz"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.leader}
                    onChange={(e) => setProjForm({ ...projForm, leader: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Yalın Ekip Üyeleri</label>
                  <input
                    type="text"
                    placeholder="örn: S. Kaya, T. Demir"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.team}
                    onChange={(e) => setProjForm({ ...projForm, team: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Fabrika / Tesis</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.factory}
                    onChange={(e) => setProjForm({ ...projForm, factory: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Üretim Hattı</label>
                  <input
                    type="text"
                    placeholder="örn: Pres Hattı 2"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.productionLine}
                    onChange={(e) => setProjForm({ ...projForm, productionLine: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Makine / Ekipman No</label>
                  <input
                    type="text"
                    placeholder="örn: PRS-01-200T"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.machineNo}
                    onChange={(e) => setProjForm({ ...projForm, machineNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Kalıp No / ID</label>
                  <input
                    type="text"
                    placeholder="örn: MLD-PRS-001"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.moldNo}
                    onChange={(e) => setProjForm({ ...projForm, moldNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Ürün Kodu (Mevcut)</label>
                  <input
                    type="text"
                    placeholder="örn: PRD-A22"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.productCode}
                    onChange={(e) => setProjForm({ ...projForm, productCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Ürün Kodu (Yeni)</label>
                  <input
                    type="text"
                    placeholder="örn: PRD-B15"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.productName}
                    onChange={(e) => setProjForm({ ...projForm, productName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Baz Kurulum Süresi (dk)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.currentSetupTime}
                    onChange={(e) => setProjForm({ ...projForm, currentSetupTime: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Hedef Setup Süresi (dk)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.targetSetupTime}
                    onChange={(e) => setProjForm({ ...projForm, targetSetupTime: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black px-4 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-4 py-2 rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODULE 1: EXECUTIVE DASHBOARD */}
      {smedTab === "dashboard" && (
        <div className="space-y-6">
          {/* Dashboard KPIs Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-avg-setup">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Ort. Setup</span>
              <div className="text-xl font-black text-slate-900 mt-1">{totalDuration} dk</div>
              <div className="text-[9px] text-green-600 font-bold mt-1">-%32 vs geçen yıl</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-best-setup">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">En İyi Setup</span>
              <div className="text-xl font-black text-slate-900 mt-1">22 dk</div>
              <div className="text-[9px] text-slate-500 font-bold mt-1">CNC-3 | Ürün A7</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-worst-setup">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">En Kötü Setup</span>
              <div className="text-xl font-black text-slate-900 mt-1">128 dk</div>
              <div className="text-[9px] text-orange-650 font-bold mt-1">Pres-1 | Ürün K2</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-saved-time">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Kazanılan Süre</span>
              <div className="text-xl font-black text-slate-900 mt-1">{savedHrs} sa</div>
              <div className="text-[9px] text-green-600 font-bold mt-1">Yıllık toplam kazanç</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-capacity-gain">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Kapasite Kazancı</span>
              <div className="text-xl font-black text-slate-900 mt-1">+{capPct}%</div>
              <div className="text-[9px] text-slate-500 font-bold mt-1">Setup optimizasyonuyla</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-roi">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">ROI Oranı</span>
              <div className="text-xl font-black text-slate-900 mt-1">%{roi}</div>
              <div className="text-[9px] text-green-600 font-bold mt-1">Yıllık Net ROI</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-total-analyses">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Toplam Analiz</span>
              <div className="text-xl font-black text-slate-900 mt-1">{activities.length} Adet</div>
              <div className="text-[9px] text-slate-500 font-bold mt-1">Kayıtlı operasyon</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-open-actions">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Açık Aksiyon</span>
              <div className="text-xl font-black text-red-600 mt-1">
                {actions.filter((a) => a.column === "open" || a.column === "progress").length}
              </div>
              <div className="text-[9px] text-slate-500 font-bold mt-1">Kanban'da bekleyen</div>
            </div>
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend Chart (SVG) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-2 mb-4">
                <h4 className="text-xs font-black text-slate-800 uppercase">Aylık Ortalama Setup Trendi (dk)</h4>
                <p className="text-[10px] text-slate-400 font-bold">Mevcut vs Hedef Plan</p>
              </div>
              <div className="h-44 w-full">
                <svg className="w-full h-full" viewBox="0 0 350 160">
                  {/* Grid Lines */}
                  <line x1="30" y1="20" x2="330" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="30" y1="60" x2="330" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="30" y1="100" x2="330" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="30" y1="130" x2="330" y2="130" stroke="#cbd5e1" strokeWidth="1" />

                  {/* Y Axis Labels */}
                  <text x="24" y="24" className="text-[8px] font-bold fill-slate-400" textAnchor="end">100 dk</text>
                  <text x="24" y="64" className="text-[8px] font-bold fill-slate-400" textAnchor="end">60 dk</text>
                  <text x="24" y="104" className="text-[8px] font-bold fill-slate-400" textAnchor="end">20 dk</text>

                  {/* Target Line (Dashed Green) */}
                  <line x1="30" y1="60" x2="330" y2="115" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="4,3" />
                  <text x="330" y="112" className="text-[8px] font-black fill-green-600" textAnchor="end">Hedef</text>

                  {/* Current Line (Blue Area) */}
                  <path
                    d="M 30 25 L 80 32 L 130 40 L 180 50 L 230 55 L 280 62 L 330 68"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                  />
                  {/* Dots on Current Line */}
                  <circle cx="30" cy="25" r="3.5" fill="#2563eb" />
                  <circle cx="80" cy="32" r="3.5" fill="#2563eb" />
                  <circle cx="130" cy="40" r="3.5" fill="#2563eb" />
                  <circle cx="180" cy="50" r="3.5" fill="#2563eb" />
                  <circle cx="230" cy="55" r="3.5" fill="#2563eb" />
                  <circle cx="280" cy="62" r="3.5" fill="#2563eb" />
                  <circle cx="330" cy="68" r="3.5" fill="#2563eb" />

                  {/* Month X Labels */}
                  <text x="30" y="145" className="text-[8px] font-bold fill-slate-400" textAnchor="middle">Oca</text>
                  <text x="130" y="145" className="text-[8px] font-bold fill-slate-400" textAnchor="middle">Nis</text>
                  <text x="230" y="145" className="text-[8px] font-bold fill-slate-400" textAnchor="middle">Tem</text>
                  <text x="330" y="145" className="text-[8px] font-bold fill-slate-400" textAnchor="middle">Ara</text>
                </svg>
              </div>
            </div>

            {/* Machine Comparison Bar Chart */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-2 mb-4">
                <h4 className="text-xs font-black text-slate-800 uppercase">Makine Bazlı Setup Karşılaştırma</h4>
                <p className="text-[10px] text-slate-400 font-bold">Mevcut vs Hedef (dk)</p>
              </div>
              <div className="h-44 w-full">
                <svg className="w-full h-full" viewBox="0 0 350 160">
                  {/* Grid Lines */}
                  <line x1="30" y1="20" x2="330" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="30" y1="70" x2="330" y2="70" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="30" y1="120" x2="330" y2="120" stroke="#cbd5e1" strokeWidth="1" />

                  {/* Y Axis Labels */}
                  <text x="24" y="24" className="text-[8px] font-bold fill-slate-400" textAnchor="end">80 dk</text>
                  <text x="24" y="74" className="text-[8px] font-bold fill-slate-400" textAnchor="end">40 dk</text>

                  {/* Bars */}
                  {/* Pres-1 */}
                  <rect x="45" y="25" width="14" height="95" fill="#ef4444" rx="2" />
                  <rect x="61" y="90" width="14" height="30" fill="#2563eb" rx="2" />
                  <text x="60" y="132" className="text-[8px] font-bold fill-slate-500" textAnchor="middle">Pres-1</text>

                  {/* CNC-3 */}
                  <rect x="115" y="70" width="14" height="50" fill="#ef4444" rx="2" />
                  <rect x="131" y="100" width="14" height="20" fill="#2563eb" rx="2" />
                  <text x="130" y="132" className="text-[8px] font-bold fill-slate-500" textAnchor="middle">CNC-3</text>

                  {/* Enj-5 */}
                  <rect x="185" y="50" width="14" height="70" fill="#ef4444" rx="2" />
                  <rect x="201" y="95" width="14" height="25" fill="#2563eb" rx="2" />
                  <text x="200" y="132" className="text-[8px] font-bold fill-slate-500" textAnchor="middle">Enj-5</text>

                  {/* Torna-2 */}
                  <rect x="255" y="80" width="14" height="40" fill="#ef4444" rx="2" />
                  <rect x="271" y="105" width="14" height="15" fill="#2563eb" rx="2" />
                  <text x="270" y="132" className="text-[8px] font-bold fill-slate-500" textAnchor="middle">Torna-2</text>
                </svg>
              </div>
            </div>

            {/* Internal vs External Ratio Chart */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-2 mb-4 flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase">İç vs Dış Aktivite Dağılımı</h4>
                  <p className="text-[10px] text-slate-400 font-bold">Toplam Setup Süresi Oranları</p>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                  %{internalPercent} İç Oranı
                </span>
              </div>
              <div className="flex items-center justify-around h-44">
                {/* Visual donut ring using SVG */}
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeDasharray={`${internalPercent} ${100 - internalPercent}`}
                      strokeDashoffset="0"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.5"
                      strokeDasharray={`${externalPercent} ${100 - externalPercent}`}
                      strokeDashoffset={`${-internalPercent}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black text-slate-800">{totalDuration} dk</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase">Toplam</span>
                  </div>
                </div>
                <div className="space-y-2 text-[10px]">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-xs shrink-0" />
                    <span>İç: {internalDuration} dk (%{internalPercent})</span>
                  </div>
                  <div className="flex items-center space-x-1.5 font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs shrink-0" />
                    <span>Dış: {externalDuration} dk (%{externalPercent})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 2: SMED ANALYSIS */}
      {smedTab === "analysis" && (
        <div className="space-y-6">
          {/* Sub Tab Navigation for Module 2 */}
          <div className="flex border-b border-slate-200 bg-white p-1 rounded-t-xl">
            <button
              onClick={() => setAnalysisSubTab("activities")}
              className={`flex-1 md:flex-initial px-5 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                analysisSubTab === "activities"
                  ? "border-blue-600 text-blue-600 bg-blue-50/20"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Aktivite Listesi ({activities.length})
            </button>
            <button
              onClick={() => setAnalysisSubTab("timeline")}
              className={`flex-1 md:flex-initial px-5 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                analysisSubTab === "timeline"
                  ? "border-blue-600 text-blue-600 bg-blue-50/20"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Zaman Çizelgesi (Gantt)
            </button>
            <button
              onClick={() => setAnalysisSubTab("conversion")}
              className={`flex-1 md:flex-initial px-5 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                analysisSubTab === "conversion"
                  ? "border-blue-600 text-blue-600 bg-blue-50/20"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Dönüştürme Simülatörü
            </button>
          </div>

          {/* Render Active Sub-Tab */}
          {analysisSubTab === "activities" && (
            <ActivityListTab
              activities={activities}
              onChangeActivities={handleUpdateActivities}
            />
          )}

          {analysisSubTab === "timeline" && (
            <GanttTimelineTab
              activities={activities}
              onChangeActivities={handleUpdateActivities}
            />
          )}

          {analysisSubTab === "conversion" && (
            <ConversionSimulatorTab
              activities={activities}
              project={activeProject}
              onChangeActivities={handleUpdateActivities}
            />
          )}
        </div>
      )}

      {/* MODULE 3: IMPROVEMENT SIMULATOR */}
      {smedTab === "simulator" && (
        <div className="space-y-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-black text-slate-800 uppercase flex items-center space-x-2">
              <Sliders className="w-4.5 h-4.5 text-blue-600" />
              <span>Gelişmiş Dönüştürme ve Setup Simülatörü</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              İç adımların dış adımlara dönüştürülmesinin ve ECRS kazançlarının setup hedefleri üzerindeki anlık etkisi
            </p>
          </div>
          <ConversionSimulatorTab
            activities={activities}
            project={activeProject}
            onChangeActivities={handleUpdateActivities}
          />
        </div>
      )}

      {/* MODULE 4: FINANCIAL IMPACT */}
      {smedTab === "financial" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Input fields */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black text-slate-800 uppercase">Fizibilite Girdi Parametreleri</h4>
                <p className="text-[10px] text-slate-400 font-bold">Aşağıdaki alanları değiştirerek ROI hesaplayın</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                    Makine Saatlik Kayıp Maliyeti (₺/saat)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    value={mc}
                    onChange={(e) => setMc(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                    Ortalama İşçilik Maliyeti (₺/saat)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    value={lc}
                    onChange={(e) => setLc(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                    Yıllık Yapılan Toplam Setup Sayısı
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    value={ns}
                    onChange={(e) => setNs(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                    Ürün Katkı Marjı Kazancı (₺/saat)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    value={cm}
                    onChange={(e) => setCm(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                    Gerekli Yatırım Bütçesi (₺)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    value={inv}
                    onChange={(e) => setInv(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase">Etüt Finansal Sonuçları (Fizibilite Raporu)</h4>
                  <p className="text-[10px] text-slate-400 font-bold">Mevcut setup süresi ({totalDuration} dk) ile {targetSetupTime} dakikalık hedef setup karşılaştırma raporudur.</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <span className="text-[9px] text-slate-400 font-black uppercase block">Yıllık Kazanılan Süre</span>
                    <div className="text-lg font-black text-blue-600 mt-1 font-mono">{savedHrs} Saat</div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <span className="text-[9px] text-slate-400 font-black uppercase block">Ek Üretim Kapasitesi</span>
                    <div className="text-lg font-black text-blue-600 mt-1 font-mono">+{capPct}%</div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <span className="text-[9px] text-green-800 font-black uppercase block">Yıllık Finansal Fayda</span>
                    <div className="text-lg font-black text-green-700 mt-1 font-mono">
                      ₺{(benefit / 1000000).toFixed(2)}M
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <span className="text-[9px] text-blue-800 font-black uppercase block">ROI Oranı</span>
                    <div className="text-lg font-black text-blue-700 mt-1 font-mono">%{roi}</div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                    <span className="text-[9px] text-amber-800 font-black uppercase block">Geri Ödeme Süresi</span>
                    <div className="text-lg font-black text-amber-700 mt-1 font-mono">{payback} Ay</div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <span className="text-[9px] text-slate-400 font-black uppercase block">3 Yıllık Net NPV</span>
                    <div className="text-lg font-black text-slate-700 mt-1 font-mono">
                      ₺{(npv / 1000000).toFixed(2)}M
                    </div>
                  </div>
                </div>
              </div>

              {/* Annual benefit donut break chart using custom SVG */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="text-xs font-black text-slate-800 uppercase border-b border-slate-100 pb-2">
                  Yıllık Kazanılan Tutarın Dağılım Payı (Yalın Değer Kırılımı)
                </div>
                <div className="flex flex-col md:flex-row items-center justify-around gap-4 py-4">
                  <div className="relative w-36 h-36">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                      {/* Machine cost ratio */}
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#2563eb" strokeWidth="3.5" strokeDasharray="30 70" strokeDashoffset="0" />
                      {/* Labor ratio */}
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#0ea5e9" strokeWidth="3.5" strokeDasharray="15 85" strokeDashoffset="-30" />
                      {/* Margin ratio */}
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="3.5" strokeDasharray="55 45" strokeDashoffset="-45" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-base font-black text-slate-800">₺{(benefit / 1000000).toFixed(2)}M</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase">Toplam</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs font-bold text-slate-700">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 bg-blue-600 rounded-xs shrink-0" />
                      <span>Atıl Makine Kapasite Kazancı (%30)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 bg-sky-500 rounded-xs shrink-0" />
                      <span>İşçilik Zaman Tasarrufu (%15)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 bg-emerald-500 rounded-xs shrink-0" />
                      <span>Satış Katkı Marjı Ek Geliri (%55)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 5: ACTIONS TRACKER */}
      {smedTab === "actions" && (
        <div className="space-y-6">
          {/* Action form */}
          <form onSubmit={handleAddAction} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
            <div className="text-xs font-black text-slate-800 uppercase border-b border-slate-100 pb-2 flex justify-between items-center">
              <span>Yeni Aksiyon / Kaizen Görevi Ekle</span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">
                Mevcut Kart: {actions.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="Aksiyon başlığı (örn: Sıkma aparatı siparişi)"
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 w-full"
                value={newActionTitle}
                onChange={(e) => setNewActionTitle(e.target.value)}
              />
              <select
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 w-full"
                value={newActionPriority}
                onChange={(e) => setNewActionPriority(e.target.value as any)}
              >
                <option value="High">Yüksek Öncelik (Kırmızı)</option>
                <option value="Medium">Orta Öncelik (Sarı)</option>
                <option value="Low">Düşük Öncelik (Gri)</option>
              </select>
              <input
                type="text"
                placeholder="Atanan Sorumlu"
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 w-full"
                value={newActionAssignee}
                onChange={(e) => setNewActionAssignee(e.target.value)}
              />
              <input
                type="text"
                placeholder="Hedef Tarih (örn: 30 Haz)"
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 w-full"
                value={newActionDue}
                onChange={(e) => setNewActionDue(e.target.value)}
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-1.5 px-4 rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer w-full"
              >
                <Plus className="w-4 h-4" />
                <span>Kart Ekle</span>
              </button>
            </div>
          </form>

          {/* Kanban board */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
            {/* COLUMN 1: OPEN */}
            <div 
              onDragOver={(e) => handleKanbanDragOver(e, "open")}
              onDragLeave={() => handleKanbanDragLeave("open")}
              onDrop={(e) => handleKanbanDrop(e, "open")}
              className={`bg-slate-50 border rounded-xl p-3 min-w-[200px] flex flex-col space-y-3 transition-all duration-200 ${
                isDraggingOverCol["open"] ? "border-blue-500 bg-blue-55 scale-[1.01]" : "border-slate-200"
              }`}
            >
              <div className="flex justify-between items-center text-xs font-black text-slate-600 uppercase border-b border-slate-200 pb-1.5">
                <span>Açık Görevler</span>
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[9px] font-black">
                  {actions.filter((a) => a.column === "open").length}
                </span>
              </div>
              <div className="space-y-2 flex-1">
                {actions
                  .filter((a) => a.column === "open")
                  .map((card) => (
                    <div 
                      key={card.id} 
                      draggable
                      onDragStart={(e) => handleKanbanDragStart(e, card.id)}
                      className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2 hover:border-blue-300 transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-sm"
                    >
                      <div className="text-xs font-bold text-slate-850 leading-tight">{card.title}</div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`px-1.5 py-0.2 rounded-xs font-extrabold ${
                          card.priority === "High" ? "bg-red-100 text-red-800" : card.priority === "Medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"
                        }`}>{card.priority}</span>
                        <span className="text-slate-450 font-bold">{card.assignee}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-1.5 text-[9px] text-slate-400 font-bold">
                        <span>Hedef: {card.dueDate}</span>
                        <button
                          onClick={() => moveAction(card.id, "progress")}
                          className="text-blue-600 hover:underline flex items-center space-x-0.5 cursor-pointer"
                        >
                          <span>Başlat</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* COLUMN 2: PROGRESS */}
            <div 
              onDragOver={(e) => handleKanbanDragOver(e, "progress")}
              onDragLeave={() => handleKanbanDragLeave("progress")}
              onDrop={(e) => handleKanbanDrop(e, "progress")}
              className={`bg-slate-50 border rounded-xl p-3 min-w-[200px] flex flex-col space-y-3 transition-all duration-200 ${
                isDraggingOverCol["progress"] ? "border-blue-500 bg-blue-55 scale-[1.01]" : "border-slate-200"
              }`}
            >
              <div className="flex justify-between items-center text-xs font-black text-slate-600 uppercase border-b border-slate-200 pb-1.5">
                <span>Devam Edenler</span>
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[9px] font-black">
                  {actions.filter((a) => a.column === "progress").length}
                </span>
              </div>
              <div className="space-y-2 flex-1">
                {actions
                  .filter((a) => a.column === "progress")
                  .map((card) => (
                    <div 
                      key={card.id} 
                      draggable
                      onDragStart={(e) => handleKanbanDragStart(e, card.id)}
                      className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2 hover:border-blue-300 transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-sm"
                    >
                      <div className="text-xs font-bold text-slate-850 leading-tight">{card.title}</div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`px-1.5 py-0.2 rounded-xs font-extrabold ${
                          card.priority === "High" ? "bg-red-100 text-red-800" : card.priority === "Medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"
                        }`}>{card.priority}</span>
                        <span className="text-slate-450 font-bold">{card.assignee}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-1.5 text-[9px] text-slate-400 font-bold">
                        <span>Hedef: {card.dueDate}</span>
                        <button
                          onClick={() => moveAction(card.id, "done")}
                          className="text-green-600 hover:underline flex items-center space-x-0.5 cursor-pointer"
                        >
                          <span>Tamamla</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* COLUMN 3: ON HOLD */}
            <div 
              onDragOver={(e) => handleKanbanDragOver(e, "hold")}
              onDragLeave={() => handleKanbanDragLeave("hold")}
              onDrop={(e) => handleKanbanDrop(e, "hold")}
              className={`bg-slate-50 border rounded-xl p-3 min-w-[200px] flex flex-col space-y-3 transition-all duration-200 ${
                isDraggingOverCol["hold"] ? "border-blue-500 bg-blue-55 scale-[1.01]" : "border-slate-200"
              }`}
            >
              <div className="flex justify-between items-center text-xs font-black text-slate-600 uppercase border-b border-slate-200 pb-1.5">
                <span>Beklemede</span>
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[9px] font-black">
                  {actions.filter((a) => a.column === "hold").length}
                </span>
              </div>
              <div className="space-y-2 flex-1">
                {actions
                  .filter((a) => a.column === "hold")
                  .map((card) => (
                    <div 
                      key={card.id} 
                      draggable
                      onDragStart={(e) => handleKanbanDragStart(e, card.id)}
                      className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2 hover:border-blue-300 transition-all duration-150 cursor-grab active:cursor-grabbing hover:shadow-sm"
                    >
                      <div className="text-xs font-bold text-slate-850 leading-tight">{card.title}</div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-xs font-extrabold">{card.priority}</span>
                        <span className="text-slate-450 font-bold">{card.assignee}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-1.5 text-[9px] text-slate-400 font-bold">
                        <span>Hedef: {card.dueDate}</span>
                        <div className="flex space-x-1.5">
                          <button
                            onClick={() => moveAction(card.id, "progress")}
                            className="text-blue-600 hover:underline cursor-pointer"
                          >
                            Başlat
                          </button>
                          <button
                            onClick={() => moveAction(card.id, "cancel")}
                            className="text-red-500 hover:underline cursor-pointer"
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* COLUMN 4: COMPLETED */}
            <div 
              onDragOver={(e) => handleKanbanDragOver(e, "done")}
              onDragLeave={() => handleKanbanDragLeave("done")}
              onDrop={(e) => handleKanbanDrop(e, "done")}
              className={`bg-slate-50 border rounded-xl p-3 min-w-[200px] flex flex-col space-y-3 transition-all duration-200 ${
                isDraggingOverCol["done"] ? "border-blue-500 bg-blue-55 scale-[1.01]" : "border-slate-200"
              }`}
            >
              <div className="flex justify-between items-center text-xs font-black text-slate-600 uppercase border-b border-slate-200 pb-1.5">
                <span>Tamamlandı</span>
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[9px] font-black">
                  {actions.filter((a) => a.column === "done").length}
                </span>
              </div>
              <div className="space-y-2 flex-1">
                {actions
                  .filter((a) => a.column === "done")
                  .map((card) => (
                    <div 
                      key={card.id} 
                      draggable
                      onDragStart={(e) => handleKanbanDragStart(e, card.id)}
                      className="bg-emerald-50/55 border border-emerald-200 rounded-lg p-3 shadow-xs space-y-2 opacity-80 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all duration-150"
                    >
                      <div className="text-xs font-bold text-slate-800 line-through leading-tight">{card.title}</div>
                      <div className="flex justify-between items-center text-[10px] text-emerald-800">
                        <span className="font-extrabold">✓ Başarıldı</span>
                        <span className="font-bold">{card.assignee}</span>
                      </div>
                      <div className="border-t border-emerald-100 pt-1 text-[9px] text-emerald-600 font-black">
                        Etki: {card.benefit}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* COLUMN 5: CANCELED */}
            <div 
              onDragOver={(e) => handleKanbanDragOver(e, "cancel")}
              onDragLeave={() => handleKanbanDragLeave("cancel")}
              onDrop={(e) => handleKanbanDrop(e, "cancel")}
              className={`bg-slate-50 border rounded-xl p-3 min-w-[200px] flex flex-col space-y-3 transition-all duration-200 ${
                isDraggingOverCol["cancel"] ? "border-blue-500 bg-blue-55 scale-[1.01]" : "border-slate-200"
              }`}
            >
              <div className="flex justify-between items-center text-xs font-black text-slate-600 uppercase border-b border-slate-200 pb-1.5">
                <span>İptal Edilenler</span>
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[9px] font-black">
                  {actions.filter((a) => a.column === "cancel").length}
                </span>
              </div>
              <div className="space-y-2 flex-1">
                {actions
                  .filter((a) => a.column === "cancel")
                  .map((card) => (
                    <div 
                      key={card.id} 
                      draggable
                      onDragStart={(e) => handleKanbanDragStart(e, card.id)}
                      className="bg-slate-100 border border-slate-200 rounded-lg p-3 shadow-xs space-y-2 opacity-50 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all duration-150"
                    >
                      <div className="text-xs font-bold text-slate-500 line-through leading-tight">{card.title}</div>
                      <div className="text-[10px] text-slate-450 font-bold">Sorumlu: {card.assignee}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 6: OEE INTEGRATION */}
      {smedTab === "oee" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-red-200 rounded-xl p-5 shadow-xs text-center">
              <span className="text-[10px] text-red-800 font-black uppercase block tracking-wider">Mevcut OEE Oranı</span>
              <div className="text-4xl font-black text-red-600 mt-2 font-mono">62.4%</div>
              <span className="text-[10px] text-slate-400 font-bold block mt-1">Sık setup kaynaklı atıl süreler</span>
            </div>

            <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-xs text-center">
              <span className="text-[10px] text-emerald-800 font-black uppercase block tracking-wider">SMED Sonrası OEE</span>
              <div className="text-4xl font-black text-emerald-600 mt-2 font-mono">71.8%</div>
              <span className="text-[10px] text-green-600 font-bold block mt-1">Hızlı değişimle minimum kayıp</span>
            </div>

            <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-xs text-center">
              <span className="text-[10px] text-blue-800 font-black uppercase block tracking-wider">OEE Net Kazancı</span>
              <div className="text-4xl font-black text-blue-600 mt-2 font-mono">+9.4 Puan</div>
              <span className="text-[10px] text-green-600 font-bold block mt-1">Yıllık OEE artış yüzdesi</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Availability */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-2 mb-4">
                <h4 className="text-xs font-black text-slate-800 uppercase">Kullanılabilirlik Oranı (Availability)</h4>
                <p className="text-[10px] text-slate-400 font-bold">Setup kayıpları azaltılarak artış</p>
              </div>
              <div className="flex justify-around items-center py-4">
                <div className="text-center">
                  <span className="text-[10px] text-red-500 font-black uppercase block">Mevcut</span>
                  <div className="text-2xl font-black text-red-500 font-mono">76%</div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
                <div className="text-center">
                  <span className="text-[10px] text-emerald-500 font-black uppercase block">Hedef</span>
                  <div className="text-2xl font-black text-emerald-500 font-mono">88%</div>
                  <span className="text-[9px] text-green-600 font-bold block mt-0.5">+12%</span>
                </div>
              </div>
            </div>

            {/* Performance */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-2 mb-4">
                <h4 className="text-xs font-black text-slate-800 uppercase">Performans Oranı (Performance)</h4>
                <p className="text-[10px] text-slate-400 font-bold">İlk parça deneme duruşları sönümlenerek</p>
              </div>
              <div className="flex justify-around items-center py-4">
                <div className="text-center">
                  <span className="text-[10px] text-red-500 font-black uppercase block">Mevcut</span>
                  <div className="text-2xl font-black text-red-500 font-mono">84%</div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
                <div className="text-center">
                  <span className="text-[10px] text-emerald-500 font-black uppercase block">Hedef</span>
                  <div className="text-2xl font-black text-emerald-500 font-mono">87%</div>
                  <span className="text-[9px] text-green-600 font-bold block mt-0.5">+3%</span>
                </div>
              </div>
            </div>

            {/* Quality */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-2 mb-4">
                <h4 className="text-xs font-black text-slate-800 uppercase">Kalite Oranı (Quality)</h4>
                <p className="text-[10px] text-slate-400 font-bold">Standardize parametrelerle hata sıfırlama</p>
              </div>
              <div className="flex justify-around items-center py-4">
                <div className="text-center">
                  <span className="text-[10px] text-red-500 font-black uppercase block">Mevcut</span>
                  <div className="text-2xl font-black text-red-500 font-mono">97.0%</div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
                <div className="text-center">
                  <span className="text-[10px] text-emerald-500 font-black uppercase block">Hedef</span>
                  <div className="text-2xl font-black text-emerald-500 font-mono">98.5%</div>
                  <span className="text-[9px] text-green-600 font-bold block mt-0.5">+1.5%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="text-xs font-black text-slate-800 uppercase border-b border-slate-100 pb-2">
              6 Aylık OEE Gelişim Tahmini Trend Eğrisi
            </div>
            <div className="h-56 w-full">
              <svg className="w-full h-full" viewBox="0 0 500 160">
                <line x1="30" y1="20" x2="470" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="30" y1="60" x2="470" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="30" y1="100" x2="470" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                <line x1="30" y1="130" x2="470" y2="130" stroke="#cbd5e1" strokeWidth="1" />

                {/* Y Axis Labels */}
                <text x="24" y="24" className="text-[8px] font-bold fill-slate-400" textAnchor="end">80%</text>
                <text x="24" y="64" className="text-[8px] font-bold fill-slate-400" textAnchor="end">70%</text>
                <text x="24" y="104" className="text-[8px] font-bold fill-slate-400" textAnchor="end">60%</text>

                {/* Lines */}
                {/* Baseline Dashed Red */}
                <line x1="30" y1="95" x2="470" y2="95" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,3" />
                <text x="470" y="90" className="text-[8px] font-black fill-red-600" textAnchor="end">Mevcut OEE (62.4%)</text>

                {/* Progress line */}
                <path d="M 30 95 L 110 88 L 190 80 L 270 72 L 350 64 L 430 52 L 470 52" fill="none" stroke="#2563eb" strokeWidth="2.5" />
                <circle cx="110" cy="88" r="3" fill="#2563eb" />
                <circle cx="190" cy="80" r="3" fill="#2563eb" />
                <circle cx="270" cy="72" r="3" fill="#2563eb" />
                <circle cx="350" cy="64" r="3" fill="#2563eb" />
                <circle cx="430" cy="52" r="3" fill="#2563eb" />

                {/* X labels */}
                <text x="30" y="145" className="text-[8px] font-bold fill-slate-400" textAnchor="middle">Ocak</text>
                <text x="190" y="145" className="text-[8px] font-bold fill-slate-400" textAnchor="middle">Mart</text>
                <text x="350" y="145" className="text-[8px] font-bold fill-slate-400" textAnchor="middle">Mayıs</text>
                <text x="470" y="145" className="text-[8px] font-bold fill-slate-400" textAnchor="middle">Haziran</text>
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
