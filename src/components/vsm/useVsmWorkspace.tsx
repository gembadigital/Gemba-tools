// VSM workspace state: projects, the open project's setup / processes / simulation, view state, handlers
// and every derived figure (via vsmCalc.ts). One instance per VSM screen, shared with the tab components
// through VsmContext. Kept free of layout so the module can later run outside Gemba Tools (plan step V11).
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
import { VsmUserLike, canDeleteVsmBurst, canDeleteVsmOwned, canDeleteVsmProcess, canDeleteVsmProject } from "../../utils/vsmAccess";
import type { VsmConnectionType, VsmFactorySetup, VsmKaizenBurst, VsmProcess, VsmProductMatrix, VsmTeamMember } from "./vsmTypes";
import { emptyFactorySetup, normalizeVsmProcess, normalizeVsmProject } from "./vsmNormalize";
import { copyForFuture, effectiveFutureSetup, mergeProcesses } from "./vsmFuture";
import { buildFieldForm, buildVsmWorkbook, downloadBlob, readFieldForm, safeFileName, VsmWorkbookInput } from "./vsmExport";
import { mergeImportedRows, setupPatchFromRows } from "./vsmExcel";
import { suggestFamilies } from "./vsmProductMatrix";
import { makeVersion, savableKey, VSM_MAX_VERSIONS, VsmVersion } from "./vsmVersions";
import { getEffectiveSuccessorIds, isLinearFlow } from "./vsmGraph";
import { computeMapLayout } from "./vsmMapLayout";
import {
  annualWasteCost, applySimulation, bottleneckOf, compareStates, computeAll, demandOf, flowSummary, highestDowntimeOf,
  highestInventoryOf, leadTimeOf, lowestOeeOf, netAvailableSecondsPerDay as netSecondsPerDay, simulationDeltas,
  taktTimeOf, withInventoryDays, workforceAnalysis as computeWorkforce, endStockDays, pitchOf, shiftsForTakt, valueAddedSeconds
} from "./vsmCalc";
import { domToCanvas } from "modern-screenshot";
import { jsPDF } from "jspdf";


const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));

export function useVsmWorkspace(currentUser: VsmUserLike | null) {
  const { selectedCustomerId, selectedCustomer } = useFactory();
  const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";

  // --- STATE PERSISTENCE & CONTROL ---
  const [dbProcesses, setDbProcesses] = useState<ProcessRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // --- VSM MULTI-PROJECT STATE ---
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [isSavingProject, setIsSavingProject] = useState<boolean>(false);
  const [justSavedProject, setJustSavedProject] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Project form states
  const [projForm, setProjForm] = useState({
    name: "",
    productGroup: "",
    productCode: "",
    productionLine: "",
    department: "",
    leader: "",
    startDate: new Date().toISOString().split("T")[0],
    targetDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
    status: "Aktif",
    description: ""
  });
  
  // --- PRIMARY TABS STATE ---
  const [vsmProcesses, setVsmProcesses] = useState<VsmProcess[]>([]);
  const [activeTab, setActiveTab] = useState<"setup" | "family" | "definition" | "production" | "quality" | "vsm" | "futureDesign" | "dashboard">("vsm");
  
  // A new project starts empty: no demand, cost or partner names are invented (see vsmNormalize.ts).
  const [factorySetup, setFactorySetup] = useState<VsmFactorySetup>(emptyFactorySetup);
  // Project-level lists (V2): value-stream team and the product–process matrix.
  const [team, setTeam] = useState<VsmTeamMember[]>([]);
  const [productMatrix, setProductMatrix] = useState<VsmProductMatrix>({ steps: [], products: [], similarityPct: 80, familyProductIds: [] });

  // İş Gücü Analizi (Norm Kadro) — which method the dashboard's workforce section uses to
  // derive "Gerekli İş Gücü" per process from the existing VSM data (no new inputs required).
  const [workforceMethod, setWorkforceMethod] = useState<"takt" | "capacity">("takt");

  // Fetch VSM Projects
  const fetchProjects = () => {
    if (!selectedCustomerId) return;
    setIsLoading(true);
    fetch("/api/business/vsm-projects", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomerId
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setProjects(data.data);
      }
      setIsLoading(false);
    })
    .catch(err => {
      console.error("Failed to load VSM projects", err);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    fetchProjects();
    setSelectedProject(null); // Reset when customer changes
  }, [selectedCustomerId]);

  const handleOpenNewProjectModal = () => {
    setEditingProject(null);
    setProjForm({
      name: "",
      productGroup: "",
      productCode: "",
      productionLine: "",
      department: "",
      leader: "",
      startDate: new Date().toISOString().split("T")[0],
      targetDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
      status: "Aktif",
      description: ""
    });
    setIsProjectModalOpen(true);
  };

  const handleOpenEditProjectModal = (proj: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(proj);
    setProjForm({
      name: proj.name || "",
      productGroup: proj.productGroup || "",
      productCode: proj.productCode || "",
      productionLine: proj.productionLine || "",
      department: proj.department || "",
      leader: proj.leader || "",
      startDate: proj.startDate || "",
      targetDate: proj.targetDate || "",
      status: proj.status || "Aktif",
      description: proj.description || ""
    });
    setIsProjectModalOpen(true);
  };

  const handleSaveProjectForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projForm.name) {
      alert("Lütfen proje adını giriniz.");
      return;
    }

    setIsSavingProject(true);
    const payload = editingProject 
      ? { ...editingProject, ...projForm }
      : { 
          ...projForm,
          vsmProcesses: [],
          // Gemba Tools: figures are typed in (see dataSources/). Opx Suite will store line/product/range here.
          dataSource: { kind: "manual" },
          factorySetup: {
            ...emptyFactorySetup(),
            productFamily: projForm.productGroup || "",
            customerName: selectedCustomer?.companyName || ""
          }
        };

    fetch("/api/business/vsm-projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomerId || ""
      },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (editingProject) {
          setProjects(prev => prev.map(p => p.id === data.data.id ? data.data : p));
          if (selectedProject?.id === data.data.id) {
            setSelectedProject(data.data);
          }
        } else {
          setProjects(prev => [data.data, ...prev]);
        }
        setIsProjectModalOpen(false);
      } else {
        alert(data.error || "VSM projesi kaydedilemedi.");
      }
      setIsSavingProject(false);
    })
    .catch(err => {
      console.error("Failed to save VSM project info", err);
      setIsSavingProject(false);
    });
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Bu VSM projesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;

    fetch(`/api/business/vsm-projects/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setProjects(prev => prev.filter(p => p.id !== id));
        if (selectedProject?.id === id) {
          setSelectedProject(null);
        }
      } else {
        alert(data.error || "VSM projesi silinemedi.");
      }
    })
    .catch(err => {
      console.error("Failed to delete project", err);
    });
  };

  const handleSelectProject = (project: any) => {
    if (selectedProject && isDirty && project?.id !== selectedProject.id &&
        !window.confirm("Kaydedilmemiş değişiklikler var. Kaydetmeden devam edilsin mi?")) return;
    setSelectedProject(project);
    if (project) {
      setVersions(Array.isArray(project.versions) ? project.versions : []);
      setBaselinePending(true);
      const n = normalizeVsmProject(project, {
        customerName: selectedCustomer?.companyName || "",
        productFamily: project.productGroup || ""
      });
      setFactorySetup(n.setup);
      setVsmProcesses(n.processes);
      setTeam(n.team);
      setProductMatrix(n.productMatrix);

      // Older projects kept the future as an overlay of edits; it becomes the future copy on read.
      const legacyEdits = project.simulationEdits && Object.keys(project.simulationEdits).length ? project.simulationEdits : null;
      setSimulationEdits({});
      setFutureProcesses(
        project.futureState?.processes?.length
          ? project.futureState.processes.map(normalizeVsmProcess)
          : legacyEdits ? copyForFuture(n.processes, legacyEdits) : null
      );
      setFutureSetup(project.futureState?.setup || {});
      setDesignAnswers(project.futureState?.designAnswers || {});
      setKaizenBursts(Array.isArray(project.kaizenBursts) ? project.kaizenBursts : []);

      if (project.simulationMode) {
        setSimulationMode(project.simulationMode);
      } else {
        setSimulationMode("current");
      }
    }
  };

  // Push VSM process data into the cost-table `processes` collection (Loss Capacity Analizi's
  // real data source) — both the operational fields the two screens genuinely share (cycleTime,
  // oee, capacity, headcount, shifts, working hours, utilization) AND, for rows this VSM project
  // itself owns (tagged via vsmProjectId), derived cost fields (scrapCost/reworkCost/downtimeCost/
  // waitingLoss) computed from this project's own Tab 4 quantities (scrap/rework) and Fabrika
  // Kurulum Parametreleri unit costs (scrapUnitCost/downtimeHourlyCost/holdingCostPerWipYearly) —
  // the same rates estimatedAnnualWasteCost/simulationComparison already use elsewhere in this
  // file, so this stays consistent with what VSM's own dashboard already tells the user its
  // losses are worth. Previously this only ever UPDATED a pre-existing cost-table row with a
  // matching id and silently did nothing otherwise — meaning a brand-new VSM process (or any
  // project saved while the cost table was still empty, the removed `dbProcesses.length === 0`
  // guard) never made it into Loss Capacity at all. Now creates the row when no match exists.
  const syncVsmProcessesToCostTable = (processesToSync: VsmProcess[], vsmProjectId: string) => {
    const dbById = new Map((dbProcesses || []).map(p => [p.id, p]));
    const su = factorySetup.scrapUnitCost;
    const dh = factorySetup.downtimeHourlyCost;
    const hc = factorySetup.holdingCostPerWipYearly;

    processesToSync.forEach((vp) => {
      const matched = dbById.get(vp.id);
      const perShiftHours = vp.shifts > 0 ? Math.round(vp.workingHours / vp.shifts) : (matched?.workingHours ?? vp.workingHours);

      // Only recompute cost fields for rows this VSM project owns — a matched row belonging to a
      // different origin (untagged legacy process, or another project's own manual cost-table
      // edit) keeps its existing cost figures untouched, exactly as before.
      const ownsCostFields = !matched || matched.vsmProjectId === vsmProjectId;
      // Cost fields only from quantities and unit costs the user actually entered; a missing one is left
      // out (the row keeps whatever it had) instead of being invented.
      const costFields: Record<string, number> = {};
      if (ownsCostFields) {
        if (su > 0 && vp.scrap !== undefined) costFields.scrapCost = vp.scrap * su * workDaysPerYear;
        // 40% of item cost for rework matches the ratio calculateFinancialImpact assumes (helpers.ts).
        if (su > 0 && vp.rework !== undefined) costFields.reworkCost = vp.rework * su * 0.4 * workDaysPerYear;
        if (dh > 0) costFields.downtimeCost = (vp.downtimeMinutes / 60) * dh * workDaysPerYear;
        if (hc > 0) costFields.waitingLoss = vp.inventoryBefore * hc;
      }

      const updatedProcess = {
        ...(matched || {}),
        id: vp.id,
        name: vp.name,
        vsmProjectId,
        cycleTime: vp.cycleTime,
        oee: vp.oee,
        capacity: vp.capacity,
        operatorCount: vp.operatorCount,
        machineCount: vp.machineCount,
        shiftCount: vp.shifts,
        workingHours: perShiftHours,
        utilizationRate: vp.availability,
        ...costFields
      };

      fetch("/api/business/processes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-factory-id": selectedCustomerId || ""
        },
        body: JSON.stringify(updatedProcess)
      }).catch(err => console.error("Failed to sync VSM process into cost table", err));
    });

    // Tell App.tsx to re-fetch processes so Loss Capacity / CI Proje Yönetimi / Executive
    // Dashboard pick up these updated cycle-time/OEE/capacity figures without a factory switch.
    window.dispatchEvent(new CustomEvent("gemba:refresh-factory-data"));
  };

  const handlePersistWorkspaceState = () => {
    if (!selectedProject) return;
    setIsSavingProject(true);
    const updatedPayload = {
      ...selectedProject,
      factorySetup,
      vsmProcesses,
      simulationEdits: {},
      simulationMode,
      team,
      productMatrix,
      futureState: futureProcesses
        ? { processes: futureProcesses, setup: futureSetup, designAnswers, createdAt: selectedProject.futureState?.createdAt || new Date().toISOString() }
        : null,
      kaizenBursts,
      versions
    };

    fetch("/api/business/vsm-projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomerId || ""
      },
      body: JSON.stringify(updatedPayload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setProjects(prev => prev.map(p => p.id === data.data.id ? data.data : p));
        setSelectedProject(data.data);
        if (Array.isArray(data.data.vsmProcesses)) setVsmProcesses(data.data.vsmProcesses);
        if (Array.isArray(data.data.kaizenBursts)) setKaizenBursts(data.data.kaizenBursts);
        // Use the fresh server response's id, not `selectedProject` — React state setters are
        // async, so `selectedProject` in this closure is still the pre-save value here (a real
        // stale-closure bug: a brand-new project's very first save would otherwise sync with an
        // undefined/wrong project id).
        syncVsmProcessesToCostTable(vsmProcesses, data.data.id);
        if (Array.isArray(data.data.versions)) setVersions(data.data.versions);
        setBaselinePending(true);
        try { localStorage.removeItem(draftKey(data.data.id)); } catch { /* storage unavailable */ }
        setJustSavedProject(true);
        setTimeout(() => setJustSavedProject(false), 2000);
      } else {
        alert(data.error || "VSM projesi kaydedilemedi.");
      }
      setIsSavingProject(false);
    })
    .catch(err => {
      console.error("Failed to save project states", err);
      setIsSavingProject(false);
    });
  };

  // Simulation Mode (Current vs Future)
  const [simulationMode, setSimulationMode] = useState<"current" | "future">("current");
  const [simulationEdits, setSimulationEdits] = useState<Record<string, Partial<VsmProcess>>>({});
  // Future state map (V5): its own copy of the processes (null until created), the setup values that
  // differ in the future, the design-question answers, and the kaizen bursts of both maps.
  const [futureProcesses, setFutureProcesses] = useState<VsmProcess[] | null>(null);
  const [futureSetup, setFutureSetup] = useState<Partial<VsmFactorySetup>>({});
  const [designAnswers, setDesignAnswers] = useState<Record<string, string>>({});
  const [kaizenBursts, setKaizenBursts] = useState<VsmKaizenBurst[]>([]);

  // ---- Versions, unsaved-change tracking and local draft (plan step V7) ----
  const [versions, setVersions] = useState<VsmVersion[]>([]);
  const [savedKey, setSavedKey] = useState<string>("");
  const [baselinePending, setBaselinePending] = useState(false);
  const draftKey = (id: string) => `vsm_draft_${id}`;
  const savableState = { factorySetup, vsmProcesses, team, productMatrix, futureProcesses, futureSetup, designAnswers, kaizenBursts, versions };
  const currentKey = savableKey(savableState);
  const isDirty = !!selectedProject && !baselinePending && savedKey !== "" && currentKey !== savedKey;

  // After a project is opened or saved, the state on screen becomes the "saved" baseline.
  useEffect(() => {
    if (!baselinePending) return;
    setSavedKey(currentKey);
    setBaselinePending(false);
    // A newer local draft of this project (left unsaved earlier on this device) can be restored.
    if (!selectedProject?.id) return;
    try {
      const raw = localStorage.getItem(draftKey(selectedProject.id));
      if (!raw) return;
      const draft = JSON.parse(raw);
      const savedAt = selectedProject.updated_at || selectedProject.created_at || "";
      if (draft?.savedAt > savedAt && draft.key !== currentKey &&
          window.confirm(`Bu cihazda ${new Date(draft.savedAt).toLocaleString("tr-TR")} tarihli kaydedilmemiş bir taslak var. Geri yüklensin mi?`)) {
        applyState(draft.state);
      } else if (draft?.savedAt <= savedAt) {
        localStorage.removeItem(draftKey(selectedProject.id));
      }
    } catch { /* storage unavailable */ }
  }, [baselinePending]);

  // Unsaved changes are kept as a local draft (this browser only) a moment after each edit.
  useEffect(() => {
    if (!isDirty || !selectedProject?.id) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey(selectedProject.id), JSON.stringify({ savedAt: new Date().toISOString(), key: currentKey, state: savableState })); } catch { /* full / blocked */ }
    }, 1500);
    return () => clearTimeout(t);
  }, [currentKey, isDirty]);

  // Leaving the page with unsaved changes asks first.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const applyState = (st: any) => {
    if (!st) return;
    if (st.factorySetup) setFactorySetup(st.factorySetup);
    if (Array.isArray(st.vsmProcesses)) setVsmProcesses(st.vsmProcesses);
    if (Array.isArray(st.team)) setTeam(st.team);
    if (st.productMatrix) setProductMatrix(st.productMatrix);
    setFutureProcesses(Array.isArray(st.futureProcesses) ? st.futureProcesses : null);
    setFutureSetup(st.futureSetup || {});
    setDesignAnswers(st.designAnswers || {});
    if (Array.isArray(st.kaizenBursts)) setKaizenBursts(st.kaizenBursts);
    if (Array.isArray(st.versions)) setVersions(st.versions);
  };

  const handleCloseProject = () => {
    if (isDirty && !window.confirm("Kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı?")) return;
    setSelectedProject(null);
  };

  const handleSaveVersion = (label: string) => {
    const v = makeVersion(label, factorySetup, vsmProcesses, futureProcesses ? { processes: futureProcesses, setup: futureSetup } : null, currentUser as any);
    setVersions(prev => [v, ...prev].slice(0, VSM_MAX_VERSIONS));
  };
  const handleDeleteVersion = (id: string) => {
    const v = versions.find(x => x.id === id);
    if (!canDeleteVsmOwned(currentUser, v)) { alert("Yalnızca kendi kaydettiğiniz versiyonu silebilirsiniz."); return; }
    setVersions(prev => prev.filter(x => x.id !== id));
  };
  // Brings a version's maps back as the working state (saved only when the user presses Kaydet).
  const handleRestoreVersion = (id: string) => {
    const v = versions.find(x => x.id === id);
    if (!v || !window.confirm(`"${v.label}" ekrandaki mevcut${v.future ? " ve gelecek" : ""} durumun yerine yüklensin mi? (Kaydedince kalıcı olur.)`)) return;
    setFactorySetup(v.setup);
    setVsmProcesses(v.processes);
    setFutureProcesses(v.future ? v.future.processes : null);
    setFutureSetup(v.future?.setup || {});
  };


  // Canvas View Controls
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [vsmBrightMode, setVsmBrightMode] = useState<boolean>(true);

  // Drag and drop state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Side Drawer & Modals
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Refs for tracking pan operations safely
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // --- FETCH PERSISTED PROCESSES FROM OPERATIONAL DATA ---
  const fetchProcesses = () => {
    if (!selectedCustomerId) return;
    setIsLoading(true);
    fetch("/api/business/processes", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomerId
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setDbProcesses(data.data);
      }
      setIsLoading(false);
    })
    .catch(err => {
      console.error("Failed to load processes for VSM", err);
      setIsLoading(false);
    });
  };

  // dbProcesses (the cost table) is only read to merge the VSM sync into existing rows; it never feeds
  // the map — a VSM project shows exactly the processes stored in it.
  useEffect(() => {
    fetchProcesses();
  }, [selectedCustomerId]);

  // --- CALCULATIONS — all figures come from the engine in vsm/vsmCalc.ts ---
  // Current state = the processes as entered; future state = the same processes with the simulation
  // overlay. `activeProcesses` is whichever of the two the map is showing.
  const currentProcessesCalculated = useMemo(() => computeAll(vsmProcesses), [vsmProcesses]);
  const futureProcessesCalculated = useMemo(
    () => computeAll(futureProcesses ?? vsmProcesses),
    [vsmProcesses, futureProcesses]
  );
  const activeProcesses = simulationMode === "future" ? futureProcessesCalculated : currentProcessesCalculated;

  const companyCurrency = selectedCustomer?.currency || "₺";
  const demand = useMemo(() => demandOf(factorySetup), [factorySetup]);
  const workingDays = factorySetup.workingDays;
  const weeklyDemand = demand.weekly;
  const dailyDemand = demand.daily;
  const monthlyDemand = demand.monthly;
  const workDaysPerYear = demand.workDaysPerYear;

  // Net time uses the first process's shift count until the project-level shift model lands (V2).
  const netAvailableSecondsPerDay = useMemo(
    () => netSecondsPerDay(factorySetup, shiftsForTakt(factorySetup, activeProcesses)),
    [factorySetup, activeProcesses]
  );
  const taktTime = useMemo(() => taktTimeOf(netAvailableSecondsPerDay, dailyDemand), [netAvailableSecondsPerDay, dailyDemand]);

  const processesWithTimeline = useMemo(() => withInventoryDays(activeProcesses, dailyDemand), [activeProcesses, dailyDemand]);

  // --- GRAPH-BASED FLOW (parallel/branching VSM support) ---
  const vsmLeadTime = useMemo(() => leadTimeOf(processesWithTimeline), [processesWithTimeline]);
  const vsmGraphEdges = vsmLeadTime.edges;
  const vsmGraphLayout = vsmLeadTime.layout;
  const isFlowLinear = useMemo(() => isLinearFlow(processesWithTimeline, vsmGraphEdges), [processesWithTimeline, vsmGraphEdges]);
  const vsmCriticalPath = { totalDays: vsmLeadTime.totalDays, criticalPathIds: vsmLeadTime.criticalPathIds };
  // Raw material / finished goods stocks (Kurulum) count in lead time as days of demand.
  const endStocks = useMemo(() => endStockDays(factorySetup, dailyDemand), [factorySetup, dailyDemand]);
  // The setup the map is drawn with: the future map's own stocks / schedule point in future mode.
  const futureFullSetup = useMemo(() => effectiveFutureSetup(factorySetup, futureSetup), [factorySetup, futureSetup]);
  const mapSetup = simulationMode === "future" ? futureFullSetup : factorySetup;
  const mapEndStocks = useMemo(() => endStockDays(mapSetup, dailyDemand), [mapSetup, dailyDemand]);
  const pitchTime = pitchOf(taktTime, factorySetup.packSize);
  const flow = useMemo(() => flowSummary(processesWithTimeline, mapEndStocks), [processesWithTimeline, mapEndStocks]);

  const totalWip = flow.totalWip;
  const totalLeadTimeDays = flow.leadTimeDays;
  const totalLeadTimeSeconds = totalLeadTimeDays * 24 * 3600;
  const totalProcessingTimeSeconds = flow.processingSeconds;
  const totalWaitingTimeHours = Math.round(totalLeadTimeDays * 24 * 10) / 10;
  const valueAddedRatio = Math.round(flow.pcePct * 1000) / 1000;

  // Per-lane breakdown for the graph-mode timeline summary (branches cannot be drawn as one ladder).
  const vsmLaneSummaries = useMemo(() => {
    const byLane = new Map<number, typeof processesWithTimeline>();
    processesWithTimeline.forEach(p => {
      const lane = vsmGraphLayout.positions.get(p.id)?.lane ?? 0;
      if (!byLane.has(lane)) byLane.set(lane, []);
      byLane.get(lane)!.push(p);
    });
    return Array.from(byLane.entries())
      .sort(([a], [b]) => a - b)
      .map(([lane, procs]) => {
        const sorted = [...procs].sort((a, b) => (vsmGraphLayout.positions.get(a.id)?.rank || 0) - (vsmGraphLayout.positions.get(b.id)?.rank || 0));
        const waitDays = sorted.reduce((sum, p) => sum + (p.inventoryDays || 0), 0);
        const processingSeconds = sorted.reduce((sum, p) => sum + p.cycleTime, 0);
        const isCritical = sorted.some(p => vsmLeadTime.criticalPathIds.has(p.id));
        return { lane, processes: sorted, waitDays: Math.round(waitDays * 100) / 100, processingSeconds, isCritical };
      });
  }, [processesWithTimeline, vsmGraphLayout, vsmLeadTime]);

  // Drawn map geometry (vsmMapLayout.ts): grows with the process count / graph columns.
  const mapLayout = useMemo(
    () => isFlowLinear
      ? computeMapLayout(processesWithTimeline.length, 1)
      : computeMapLayout(vsmGraphLayout.maxRank + 1, vsmGraphLayout.laneCount, vsmLaneSummaries.length),
    [isFlowLinear, processesWithTimeline.length, vsmGraphLayout, vsmLaneSummaries.length]
  );

  const count = processesWithTimeline.length;
  const averageOee = count > 0 ? Math.round(processesWithTimeline.reduce((sum, p) => sum + p.oee, 0) / count) : 0;
  const averageCapacity = count > 0 ? processesWithTimeline.reduce((sum, p) => sum + p.capacity, 0) / count : 0;
  const averageCapacityUtilization = averageCapacity > 0 ? Math.min(100, Math.round((dailyDemand / averageCapacity) * 100)) : 0;
  const totalOperators = processesWithTimeline.reduce((sum, p) => sum + p.operatorCount, 0);
  const totalMachines = processesWithTimeline.reduce((sum, p) => sum + p.machineCount, 0);

  // --- BOTTLENECK & CRITICAL KPI DETECTION ---
  const bottleneckProcess = useMemo(() => bottleneckOf(processesWithTimeline), [processesWithTimeline]);
  const highestDowntimeProcess = useMemo(() => highestDowntimeOf(processesWithTimeline), [processesWithTimeline]);
  const highestInventoryProcess = useMemo(() => highestInventoryOf(processesWithTimeline), [processesWithTimeline]);
  const lowestOeeProcess = useMemo(() => lowestOeeOf(processesWithTimeline), [processesWithTimeline]);

  // Annual loss of the state on the map, from the unit costs entered in Kurulum.
  const estimatedAnnualWasteCost = useMemo(
    () => annualWasteCost(processesWithTimeline, factorySetup, workDaysPerYear).total,
    [processesWithTimeline, factorySetup, workDaysPerYear]
  );

  // --- CURRENT VS FUTURE ---
  const dashboardData = useMemo(
    () => compareStates(currentProcessesCalculated, futureProcessesCalculated, dailyDemand, factorySetup, futureFullSetup),
    [currentProcessesCalculated, futureProcessesCalculated, dailyDemand, factorySetup, futureFullSetup]
  );
  const simulationComparison = useMemo(
    () => simulationDeltas(dashboardData, futureProcesses !== null),
    [dashboardData, futureProcesses]
  );

  // --- İŞ GÜCÜ ANALİZİ (NORM KADRO) — current state only ---
  const workforceAnalysis = useMemo(
    () => computeWorkforce(currentProcessesCalculated, workforceMethod, taktTime, dailyDemand, factorySetup),
    [currentProcessesCalculated, workforceMethod, taktTime, dailyDemand, factorySetup]
  );

  // (VSM → CI: kaizen bursts reach CI through the opportunity pool — utils/ciOpportunityPool.ts vsmOpportunities.)

  // --- CANVAS INTERACTIVE NAV HANDLERS ---
  const handleZoomIn = () => setZoom(z => Math.min(2.5, z + 0.1));
  const handleZoomOut = () => setZoom(z => Math.max(0.4, z - 0.1));
  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click pans
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Touch and pen: one pointer pans, two pointers pinch-zoom (around their midpoint).
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; zoom: number; mid: { x: number; y: number }; pan: { x: number; y: number } } | null>(null);
  const clampZoom = (z: number) => Math.min(2.5, Math.max(0.15, z));

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Clicks on process cards / boxes still open them; panning starts on the stage itself.
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, pan };
      setIsPanning(false);
    } else {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const next = clampZoom(pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.dist)));
      const rect = canvasContainerRef.current?.getBoundingClientRect();
      const mx = pinch.mid.x - (rect?.left ?? 0), my = pinch.mid.y - (rect?.top ?? 0);
      // keep the map point under the fingers' midpoint in place
      setPan({ x: mx - ((mx - pinch.pan.x) / pinch.zoom) * next, y: my - ((my - pinch.pan.y) / pinch.zoom) * next });
      setZoom(next);
      return;
    }
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) setIsPanning(false);
  };

  // Ctrl / ⌘ + wheel zooms around the cursor; a plain wheel scrolls the page as usual.
  const handleWheelZoom = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    const mx = e.clientX - (rect?.left ?? 0), my = e.clientY - (rect?.top ?? 0);
    const next = clampZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    setPan({ x: mx - ((mx - pan.x) / zoom) * next, y: my - ((my - pan.y) / zoom) * next });
    setZoom(next);
  };

  // Fit the whole map into the visible stage (also the default when a project's map opens).
  const handleZoomFit = () => {
    const el = canvasContainerRef.current;
    if (!el) return;
    // Phones: fill the stage height and pan sideways (fitting the whole width would make it unreadable).
    const phone = el.clientWidth < 640;
    const z = clampZoom(phone
      ? Math.min(el.clientHeight / mapLayout.height, 1)
      : Math.min(el.clientWidth / mapLayout.width, el.clientHeight / mapLayout.height, 1));
    setZoom(Math.round(z * 100) / 100);
    setPan({ x: phone ? 0 : Math.max(0, (el.clientWidth - mapLayout.width * z) / 2), y: 8 });
  };

  useEffect(() => {
    if (activeTab !== "vsm" || !selectedProject) return;
    const t = setTimeout(handleZoomFit, 60);
    return () => clearTimeout(t);
    // refit when another project / tab opens or the map changes size
  }, [activeTab, selectedProject?.id, mapLayout.width, mapLayout.height]);

  // --- DRAWER OPEN HANDLER ---
  const handleOpenProcessDrawer = (id: string) => {
    setSelectedProcessId(id);
    setIsDrawerOpen(true);
  };

  const activeProcess = useMemo<VsmProcess | null>(() => {
    if (!selectedProcessId) return null;
    return processesWithTimeline.find(p => p.id === selectedProcessId) || null;
  }, [processesWithTimeline, selectedProcessId]);

  // --- UPDATE PROCESS VALUES IN DRAWER OR SIMULATOR ---
  // Current and Future are meant to stay two independent snapshots (as-is baseline vs. simulated
  // improvement) so the dashboard can show a real before/after. This must route edits to exactly
  // ONE of the two stores depending on which mode is active — never both, or Future edits would
  // silently overwrite the Current baseline and destroy the comparison.
  const updateInList = (list: VsmProcess[], id: string, field: keyof VsmProcess, value: any): VsmProcess[] =>
    list.map(p => {
      if (p.id !== id) return p;
      if (field === "shifts") {
        const numShifts = Number(value) || 1;
        const hours = p.shiftHours || [];
        const shiftHours = Array.from({ length: numShifts }, (_, i) => (hours[i] !== undefined ? hours[i] : 8));
        return { ...p, shifts: numShifts, shiftHours, workingHours: shiftHours.reduce((a, h) => a + h, 0) };
      }
      if (field === "shiftHours") {
        const shiftHours = value as number[];
        return { ...p, shiftHours, workingHours: shiftHours.reduce((a, h) => a + h, 0) };
      }
      return { ...p, [field]: value };
    });

  // Current mode edits the as-is data; future mode edits the future map's own copy (created on the first
  // future edit), so the current baseline is never touched by a simulation.
  const handleUpdateProcessField = (id: string, field: keyof VsmProcess, value: any) => {
    if (simulationMode === "current") {
      setVsmProcesses(prev => updateInList(prev, id, field, value));
    } else {
      setFutureProcesses(prev => updateInList(prev ?? copyForFuture(vsmProcesses), id, field, value));
    }
  };

  // Gelecek Durum tab: always edits the future copy, whatever the map's current mode.
  const handleUpdateFutureProcessField = (id: string, field: keyof VsmProcess, value: any) =>
    setFutureProcesses(prev => updateInList(prev ?? copyForFuture(vsmProcesses), id, field, value));
  const handleAddFutureProcess = () => {
    const shifts = factorySetup.shiftsPerDay || 1;
    const hours = factorySetup.shiftDuration || 8;
    setFutureProcesses(prev => [...(prev ?? copyForFuture(vsmProcesses)), {
      id: `proc-${Date.now().toString(36)}`, name: "YENİ ADIM", type: "Manual", productionModel: "Other", machineCount: 0, operatorCount: 0,
      shifts, shiftHours: Array.from({ length: shifts }, () => hours), workingHours: shifts * hours, cycleTime: 0, oee: 0, availability: 0,
      performance: 0, quality: 0, capacity: 0, downtimeMinutes: 0, inventoryBefore: 0, isKanbanEnabled: false, isSupermarket: false,
      notes: "", kaizenOpp: "", createdBy: currentUser?.id
    }]);
  };
  const handleDeleteFutureProcess = (id: string) =>
    setFutureProcesses(prev => (prev ?? copyForFuture(vsmProcesses)).filter(p => p.id !== id));

  const handleCreateFuture = () => {
    setFutureProcesses(prev => prev ?? copyForFuture(vsmProcesses));
  };

  const handleResetFuture = () => {
    if (!window.confirm("Gelecek durum haritası silinip mevcut durumun yeni bir kopyasıyla yeniden başlatılsın mı? (Kaydedince kalıcı olur.)")) return;
    setFutureProcesses(copyForFuture(vsmProcesses));
    setFutureSetup({});
  };

  // Continuous flow: combine adjacent future processes into one step.
  const handleMergeFutureProcesses = (ids: string[]) => {
    const r = mergeProcesses(futureProcesses ?? copyForFuture(vsmProcesses), ids, currentUser?.id);
    if (r.error) { alert(r.error); return; }
    setFutureProcesses(r.list);
    setKaizenBursts(prev => prev.map(b => (b.map === "future" && b.processId && ids.includes(b.processId) ? { ...b, processId: r.mergedId } : b)));
  };

  const handleSetFutureSetup = (patch: Partial<VsmFactorySetup>) => setFutureSetup(prev => ({ ...prev, ...patch }));

  // Kaizen bursts
  const handleSaveBurst = (burst: VsmKaizenBurst) => {
    setKaizenBursts(prev => (prev.some(b => b.id === burst.id) ? prev.map(b => (b.id === burst.id ? burst : b)) : [...prev, { ...burst, createdBy: burst.createdBy ?? currentUser?.id }]));
  };
  const handleDeleteBurst = (id: string) => {
    const b = kaizenBursts.find(x => x.id === id);
    if (!canDeleteVsmBurst(currentUser, b)) { alert("Yalnızca kendi eklediğiniz kaizen patlamalarını silebilirsiniz."); return; }
    setKaizenBursts(prev => prev.filter(x => x.id !== id));
  };

  // --- GRAPH RELATIONSHIP EDITING (Sonraki Proses / Next Process) ---
  // Seeds the edit from whatever's currently in effect (explicit nextProcessIds if set, otherwise
  // the legacy array-order successor) so the first toggle on an existing linear-chain project
  // converts its implicit relationship into an explicit one instead of silently discarding it.
  const handleToggleNextProcess = (processId: string, targetId: string, checked: boolean) => {
    const idx = processesWithTimeline.findIndex(p => p.id === processId);
    const process = processesWithTimeline[idx];
    if (!process) return;
    const currentEffective = getEffectiveSuccessorIds(process, processesWithTimeline, idx);
    const nextSet = new Set(currentEffective);
    if (checked) nextSet.add(targetId); else nextSet.delete(targetId);
    handleUpdateProcessField(processId, "nextProcessIds", Array.from(nextSet));
  };

  const handleSetConnectionType = (processId: string, targetId: string, type: VsmConnectionType) => {
    const process = processesWithTimeline.find(p => p.id === processId);
    const current = process?.connectionTypes || {};
    handleUpdateProcessField(processId, "connectionTypes", { ...current, [targetId]: type });
  };

  // --- EXPORT IMPLEMENTATIONS ---
  // Captures the actual on-screen VSM diagram (1:1, not a reconstruction) via modern-screenshot's
  // domToCanvas, which renders through an SVG <foreignObject> (i.e. the browser's own engine)
  // rather than reimplementing CSS parsing — unlike html2canvas, it correctly handles Tailwind
  // v4's oklch()/color-mix() based palette instead of throwing on it.
  const captureVsmMapCanvas = async (): Promise<HTMLCanvasElement> => {
    if (activeTab !== "vsm") setActiveTab("vsm");
    handleZoomReset();
    // Let React re-render (tab switch / transform reset) before we snapshot the DOM.
    await new Promise(resolve => setTimeout(resolve, 350));

    const target = document.getElementById("vsm_map_capture_target");
    if (!target) throw new Error("VSM canvas not found");

    return domToCanvas(target, {
      scale: 2,
      backgroundColor: vsmBrightMode ? "#f8fafc" : "#0f172a",
      width: mapLayout.width,
      height: mapLayout.height
    });
  };

  // Map images for the PDF report (VsmReportPages renders off-screen while this is set).
  const [reportImages, setReportImages] = useState<{ current: string; future?: string } | null>(null);
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const captureMapIn = async (mode: "current" | "future") => {
    setSimulationMode(mode);
    await wait(400);
    return captureVsmMapCanvas();
  };

  const exportBaseName = () => safeFileName(`VSM_${selectedCustomer?.companyName || ""}_${selectedProject?.name || "Proje"}`);

  const workbookInput = (): VsmWorkbookInput => {
    const ends = endStockDays(factorySetup, dailyDemand);
    const currentT = withInventoryDays(currentProcessesCalculated, dailyDemand);
    const currentFlow = flowSummary(currentT, ends);
    return {
      project: selectedProject || { name: "" },
      customerName: selectedCustomer?.companyName || "",
      currency: companyCurrency,
      setup: factorySetup,
      team,
      current: currentT,
      future: withInventoryDays(futureProcessesCalculated, dailyDemand),
      hasFuture: futureProcesses !== null,
      comparison: dashboardData,
      figures: {
        dailyDemand,
        taktTime,
        pitchTime: pitchOf(taktTime, factorySetup.packSize),
        netSecondsPerDay: netSecondsPerDay(factorySetup, shiftsForTakt(factorySetup, currentProcessesCalculated)),
        leadTimeDays: currentFlow.leadTimeDays,
        rawDays: ends.rawDays,
        fgDays: ends.fgDays,
        pcePct: currentFlow.pcePct,
        processingSeconds: currentFlow.processingSeconds,
        totalWip: currentFlow.totalWip,
        annualLoss: dashboardData.currentWasteCost
      },
      workforce: { ...workforceAnalysis, method: workforceMethod === "takt" ? "Takt bazlı" : "Kapasite bazlı" },
      matrix: productMatrix,
      families: suggestFamilies(productMatrix),
      pacemakerName: vsmProcesses.find(p => p.id === factorySetup.pacemakerProcessId)?.name,
      bursts: kaizenBursts,
      designAnswers,
      processName: (map, id) => (map === "future" ? futureProcessesCalculated : vsmProcesses).find(p => p.id === id)?.name ?? "—"
    };
  };

  const handleTriggerExport = async (format: string) => {
    const modeBefore = simulationMode;
    setExportStatus(format === "Excel" ? "Excel dosyası hazırlanıyor…" : format === "Saha Formu" ? "Saha formu hazırlanıyor…" : "Harita görüntüsü hazırlanıyor…");
    try {
      if (format === "Excel") {
        downloadBlob(await buildVsmWorkbook(workbookInput()), `${exportBaseName()}.xlsx`);
      } else if (format === "Saha Formu") {
        downloadBlob(await buildFieldForm(vsmProcesses, factorySetup, selectedProject?.name || ""), `${exportBaseName()}_Saha_Formu.xlsx`);
      } else if (format === "High Res PNG") {
        const canvas = await captureVsmMapCanvas();
        const link = document.createElement("a");
        link.setAttribute("download", `${exportBaseName()}_${simulationMode === "future" ? "Gelecek" : "Mevcut"}.png`);
        link.setAttribute("href", canvas.toDataURL("image/png", 1.0));
        link.click();
      } else if (format === "PDF Report") {
        // Current map always; the future map only when the simulation has changes.
        const current = (await captureMapIn("current")).toDataURL("image/png", 1.0);
        const future = futureProcesses !== null ? (await captureMapIn("future")).toDataURL("image/png", 1.0) : undefined;
        setSimulationMode(modeBefore);
        setExportStatus("PDF sayfaları oluşturuluyor…");
        setReportImages({ current, future });
        await wait(600);
        const pages = Array.from(document.querySelectorAll<HTMLElement>("#vsm_report_pages .vsm-report-page"));
        if (pages.length === 0) throw new Error("Rapor sayfaları oluşturulamadı");
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        for (let i = 0; i < pages.length; i++) {
          const canvas = await domToCanvas(pages[i], { scale: 2, backgroundColor: "#ffffff" });
          if (i > 0) pdf.addPage("a4", "landscape");
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 297, 210);
        }
        pdf.save(`${exportBaseName()}.pdf`);
      }
    } catch (err) {
      alert("Dışa aktarma sırasında bir hata oluştu. Lütfen tekrar deneyin.");
      console.error("VSM export error:", err);
    } finally {
      setReportImages(null);
      if (format === "PDF Report") setSimulationMode(modeBefore);
      setExportStatus(null);
      setExportModalOpen(false);
    }
  };

  // Field data form upload: updates / adds processes of the CURRENT state and the setup values on the
  // form's Kurulum sheet. Nothing is deleted; the user still saves the project afterwards.
  const handleImportFieldForm = async (file: File) => {
    setExportStatus("Saha formu okunuyor…");
    try {
      const content = await readFieldForm(file);
      if (content.error) { alert(content.error); return; }
      const result = mergeImportedRows(vsmProcesses, content.rows, currentUser?.id);
      const setupPatch = setupPatchFromRows(content.setupRows, result.issues);
      const issueText = result.issues.length
        ? `\n\nUyarılar (${result.issues.length}):\n` + result.issues.slice(0, 12).map(x => `• Satır ${x.row}: ${x.message}`).join("\n")
        : "";
      const ok = window.confirm(
        `Saha formu: ${result.updated} proses güncellenecek, ${result.added} proses eklenecek` +
        `${Object.keys(setupPatch).length ? `, ${Object.keys(setupPatch).length} kurulum değeri yazılacak` : ""}.` +
        " Mevcut durum verisine uygulanır, hiçbir proses silinmez." + issueText + "\n\nUygulansın mı?"
      );
      if (!ok) return;
      setVsmProcesses(result.processes);
      if (Object.keys(setupPatch).length) setFactorySetup(prev => ({ ...prev, ...setupPatch }));
      setSimulationMode("current");
      alert("Saha formu uygulandı. Kalıcı olması için Kaydet'e basın.");
    } catch (err) {
      alert("Saha formu okunamadı. Dosyanın VSM saha formu (.xlsx) olduğundan emin olun.");
      console.error("VSM field form import error:", err);
    } finally {
      setExportStatus(null);
      setExportModalOpen(false);
    }
  };

  // --- TAB ACTION HANDLERS ---
  const handleAddProcess = () => {
    const newId = `proc-${Date.now()}`;
    const newProcess: VsmProcess = {
      id: newId,
      name: `YENİ PROSES ${vsmProcesses.length + 1}`,
      type: "Manual",
      productionModel: "Other",
      machineCount: 0,
      operatorCount: 0,
      shifts: 1,
      shiftHours: [factorySetup.shiftDuration || 8],
      workingHours: factorySetup.shiftDuration || 8,
      cycleTime: 0,
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 0,
      capacity: 0,
      downtimeMinutes: 0,
      inventoryBefore: 0,
      isKanbanEnabled: false,
      isSupermarket: false,
      notes: "",
      kaizenOpp: "",
      createdBy: currentUser?.id
    };
    if (simulationMode === "future") setFutureProcesses(prev => [...(prev ?? copyForFuture(vsmProcesses)), newProcess]);
    else setVsmProcesses(prev => [...prev, newProcess]);
  };

  const handleDeleteProcess = (id: string) => {
    // The future map is a design copy: removing a step there deletes no entered data.
    if (simulationMode === "future") {
      setFutureProcesses(prev => (prev ?? copyForFuture(vsmProcesses)).filter(p => p.id !== id));
      return;
    }
    const target = vsmProcesses.find(p => p.id === id);
    if (!canDeleteVsmProcess(currentUser, target)) {
      alert("Yalnızca kendi eklediğiniz prosesleri silebilirsiniz.");
      return;
    }
    setVsmProcesses(prev => prev.filter(p => p.id !== id));
  };

  const handleMoveProcess = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= vsmProcesses.length) return;
    
    setVsmProcesses(prev => {
      const list = [...prev];
      const temp = list[index];
      list[index] = list[nextIndex];
      list[nextIndex] = temp;
      return list;
    });
  };

  // --- AI EXECUTIVE SUMMARY INSIGHTS ---
  const dynamicAiSummary = useMemo(() => {
    const savings = dashboardData.annualSavings;
    const ltRed = Math.max(0, Math.round(((dashboardData.currentLeadTime - dashboardData.futureLeadTime) / (dashboardData.currentLeadTime || 1)) * 100));
    const wipRed = Math.max(0, Math.round(((dashboardData.currentWip - dashboardData.futureWip) / (dashboardData.currentWip || 1)) * 100));
    
    // Quality improvement summary
    const currQual = currentProcessesCalculated.reduce((sum, p) => sum + p.quality, 0) / (currentProcessesCalculated.length || 1);
    const futQual = futureProcessesCalculated.reduce((sum, p) => sum + p.quality, 0) / (futureProcessesCalculated.length || 1);
    const qualGain = Math.round((futQual - currQual) * 10) / 10;

    return {
      biggestImprovement: `Darboğaz (en yüksek çevrim süresi): mevcut durumda "${dashboardData.currentBottleneckName}" (OEE %${dashboardData.currentBottleneckOee}), gelecek simülasyonda "${dashboardData.futureBottleneckName}" (OEE %${dashboardData.futureBottleneckOee}).`,
      leadTimeReduction: `Simülasyona göre ara stok (WIP) %${wipRed} azalır; toplam bekleme süresi ${dashboardData.currentLeadTime} günden ${dashboardData.futureLeadTime} güne iner (-%${ltRed}).`,
      qualityImpact: qualGain > 0
        ? `Simülasyonda ortalama kalite oranı (FPY) ${qualGain.toFixed(1)} puan yükselir.`
        : `Simülasyonda ortalama kalite oranında (FPY) artış yok.`,
      annualSavingsDesc: savings > 0
        ? `Girilen birim maliyetlerle simülasyonun öngördüğü yıllık kayıp azalışı: ${savings.toLocaleString("tr-TR")} ${companyCurrency}.`
        : `Yıllık kayıp azalışı hesaplanamadı (birim maliyetler girilmedi ya da simülasyonda maliyet etkisi yok).`
    };
  }, [dashboardData, currentProcessesCalculated, futureProcessesCalculated, companyCurrency]);

  // --- HTML5 DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === index) return;

    setVsmProcesses(prev => {
      const list = [...prev];
      const draggedItem = list[draggingIndex];
      list.splice(draggingIndex, 1);
      list.splice(index, 0, draggedItem);
      return list;
    });
    setDraggingIndex(index);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  // --- CUSTOM SVG GAUGES FOR DASHBOARD ---
  const drawSpeedometer = (value: number, title: string) => {
    // Convert percentage (0-100) to rotation angle in degrees (-90 to 90)
    const angle = (value / 100) * 180 - 180; // range from -180 to 0 for a half circle
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs relative h-64 overflow-hidden" id="speedometer_gauge">
        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono absolute top-4 left-4">{title}</h4>
        <div className="relative w-48 h-24 mt-12">
          {/* Background track */}
          <svg className="w-full h-full" viewBox="0 0 100 50">
            <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" />
            {/* Active track color coded by value */}
            <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="url(#speedometerGradient)" strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={125.6 - (value / 100) * 125.6} />
            <defs>
              <linearGradient id="speedometerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>
          {/* Needle */}
          <div 
            className="absolute bottom-0 left-1/2 w-1.5 h-16 bg-slate-800 rounded-full origin-bottom -translate-x-1/2 transition-transform duration-1000 ease-out"
            style={{ transform: `translateX(-50%) rotate(${angle + 90}deg)` }}
          />
          {/* Pin */}
          <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-slate-900 border-2 border-white rounded-full -translate-x-1/2 translate-y-1/2 shadow-sm" />
        </div>
        <div className="text-center mt-2">
          <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">{value}%</span>
          <span className="block text-[10px] text-slate-500 font-bold uppercase mt-1">Darboğaz Verimi (Bottleneck OEE)</span>
        </div>
      </div>
    );
  };

  const drawHalfDonut = (value: number, title: string) => {
    const angle = (value / 100) * 180 - 180;
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs relative h-64 overflow-hidden" id="half_donut_gauge">
        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono absolute top-4 left-4">{title}</h4>
        <div className="relative w-48 h-24 mt-12">
          <svg className="w-full h-full" viewBox="0 0 100 50">
            {/* Gray track */}
            <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="#f1f5f9" strokeWidth="12" strokeLinecap="round" />
            {/* Active blue track */}
            <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="#4f46e5" strokeWidth="12" strokeLinecap="round" strokeDasharray="125.6" strokeDashoffset={125.6 - (value / 100) * 125.6} />
          </svg>
          {/* Needle */}
          <div 
            className="absolute bottom-0 left-1/2 w-1.5 h-16 bg-slate-800 rounded-full origin-bottom -translate-x-1/2 transition-transform duration-1000 ease-out"
            style={{ transform: `translateX(-50%) rotate(${angle + 90}deg)` }}
          />
          {/* Pin */}
          <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-slate-900 border-2 border-white rounded-full -translate-x-1/2 translate-y-1/2 shadow-sm" />
        </div>
        <div className="text-center mt-2">
          <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">{value}%</span>
          <span className="block text-[10px] text-slate-500 font-bold uppercase mt-1">Hat Çalışabilirliği (Availability)</span>
        </div>
      </div>
    );
  };


  return {
    versions,
    isDirty,
    handleCloseProject,
    handleSaveVersion,
    handleDeleteVersion,
    handleRestoreVersion,
    handleUpdateFutureProcessField,
    handleAddFutureProcess,
    handleDeleteFutureProcess,
    futureProcesses,
    futureSetup,
    futureFullSetup,
    mapSetup,
    mapEndStocks,
    designAnswers,
    setDesignAnswers,
    kaizenBursts,
    handleCreateFuture,
    handleResetFuture,
    handleMergeFutureProcesses,
    handleSetFutureSetup,
    handleSaveBurst,
    handleDeleteBurst,
    mapLayout,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheelZoom,
    handleZoomFit,
    reportImages,
    handleImportFieldForm,
    team,
    setTeam,
    productMatrix,
    setProductMatrix,
    endStocks,
    pitchTime,
    valueAddedSeconds,
    selectedCustomerId,
    selectedCustomer,
    token,
    dbProcesses,
    setDbProcesses,
    isLoading,
    setIsLoading,
    projects,
    setProjects,
    selectedProject,
    setSelectedProject,
    isProjectModalOpen,
    setIsProjectModalOpen,
    editingProject,
    setEditingProject,
    isSavingProject,
    setIsSavingProject,
    justSavedProject,
    setJustSavedProject,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    projForm,
    setProjForm,
    vsmProcesses,
    setVsmProcesses,
    activeTab,
    setActiveTab,
    emptyFactorySetup,
    factorySetup,
    setFactorySetup,
    workforceMethod,
    setWorkforceMethod,
    fetchProjects,
    handleOpenNewProjectModal,
    handleOpenEditProjectModal,
    handleSaveProjectForm,
    handleDeleteProject,
    handleSelectProject,
    syncVsmProcessesToCostTable,
    handlePersistWorkspaceState,
    simulationMode,
    setSimulationMode,
    simulationEdits,
    setSimulationEdits,
    zoom,
    setZoom,
    pan,
    setPan,
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,
    isFullScreen,
    setIsFullScreen,
    vsmBrightMode,
    setVsmBrightMode,
    draggingIndex,
    setDraggingIndex,
    selectedProcessId,
    setSelectedProcessId,
    isDrawerOpen,
    setIsDrawerOpen,
    exportModalOpen,
    setExportModalOpen,
    exportStatus,
    setExportStatus,
    canvasContainerRef,
    fetchProcesses,
    currentProcessesCalculated,
    futureProcessesCalculated,
    activeProcesses,
    companyCurrency,
    demand,
    workingDays,
    weeklyDemand,
    dailyDemand,
    monthlyDemand,
    workDaysPerYear,
    netAvailableSecondsPerDay,
    taktTime,
    processesWithTimeline,
    vsmLeadTime,
    vsmGraphEdges,
    vsmGraphLayout,
    isFlowLinear,
    vsmCriticalPath,
    flow,
    totalWip,
    totalLeadTimeDays,
    totalLeadTimeSeconds,
    totalProcessingTimeSeconds,
    totalWaitingTimeHours,
    valueAddedRatio,
    vsmLaneSummaries,
    count,
    averageOee,
    averageCapacity,
    averageCapacityUtilization,
    totalOperators,
    totalMachines,
    bottleneckProcess,
    highestDowntimeProcess,
    highestInventoryProcess,
    lowestOeeProcess,
    estimatedAnnualWasteCost,
    dashboardData,
    simulationComparison,
    workforceAnalysis,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleOpenProcessDrawer,
    activeProcess,
    handleUpdateProcessField,
    handleToggleNextProcess,
    handleSetConnectionType,
    captureVsmMapCanvas,
    handleTriggerExport,
    handleAddProcess,
    handleDeleteProcess,
    handleMoveProcess,
    dynamicAiSummary,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    drawSpeedometer,
    drawHalfDonut,
    currentUser
  };
}

export type VsmWorkspace = ReturnType<typeof useVsmWorkspace>;
