import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  useFactory, 
} from "../context/FactoryContext";
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
import { ProcessRecord, Customer } from "../types";
import { domToCanvas } from "modern-screenshot";
import { jsPDF } from "jspdf";

// --- VSM-SPECIFIC TYPES ---

// Connection types between processes in the flow graph. Only "Normal" is drawn/handled specially
// today — the union is intentionally wide open so future types can be added without a schema
// change (they'd just fall back to "Normal" styling until specific handling is written for them).
type VsmConnectionType =
  | "Normal"
  | "Parallel"
  | "Merge"
  | "Split"
  | "Rework"
  | "Kanban"
  | "Supermarket"
  | "External Supplier";

interface VsmProcess {
  id: string;
  name: string;
  type: "Manual" | "Semi Automatic" | "Automatic";
  productionModel: "Cell" | "Assembly Line" | "Batch" | "Other";
  machineCount: number;
  operatorCount: number;
  shifts: number;
  shiftHours?: number[];
  workingHours: number;
  cycleTime: number; // in seconds (CT)
  oee: number; // percentage
  availability: number; // percentage
  performance: number; // percentage
  quality: number; // percentage (FPY)
  capacity: number; // units/day
  downtimeMinutes: number;
  inventoryBefore: number; // WIP quantity before this process
  inventoryDays?: number; // calculated inventory days
  isKanbanEnabled: boolean;
  isSupermarket: boolean;
  notes: string;
  kaizenOpp: string;

  // Tab 2 Process Definition extra fields
  planningFrequency?: string;
  prevProcessId?: string;
  nextProcessId?: string;

  // Graph-based process relationships (multi-successor). When undefined/empty on every
  // process in the project, the flow is treated as a legacy linear chain and renders/derives
  // successors from array order exactly as before (full backward compatibility, no migration).
  nextProcessIds?: string[];
  // Connection type per outgoing edge, keyed by target process id. Only "Normal" is used by the
  // drawing engine today; the type is kept open-ended so future types (Kanban, Supermarket,
  // Rework, External Supplier, ...) can be added without touching the data model again.
  connectionTypes?: Record<string, VsmConnectionType>;

  // Tab 3 Production & Capacity data entry fields
  plannedQuantity?: number;
  actualQuantity?: number;
  idealCycleTime?: number;
  productionTime?: number; // in minutes
  changeoverTime?: number; // in minutes
  changeoverFrequency?: string;
  firstPieceApproval?: number; // in minutes
  breakdownTime?: number; // in minutes
  waitingTime?: number; // in minutes
  minorStops?: number; // in minutes

  // Tab 4 Quality & Inventory fields
  goodParts?: number;
  scrap?: number;
  rework?: number;
  wipQuantity?: number;
  inventoryBetweenProcesses?: number;
  leadTimeContribution?: number;
  changeoverMinutes?: number;
}

// --- GRAPH-BASED PROCESS FLOW HELPERS ---
// Pure functions turning the flat `vsmProcesses` array into a directed graph, so the drawing
// engine and the lead-time rollup can support branching/parallel flows. When no process in a
// project has `nextProcessIds` set, every helper below falls back to the legacy index-based
// linear chain — existing single-chain VSM projects keep rendering and calculating exactly as
// before (see isLinearFlow), with zero migration needed.

interface VsmGraphEdge {
  fromId: string;
  toId: string;
  type: VsmConnectionType;
}

function getEffectiveSuccessorIds(process: VsmProcess, allProcesses: VsmProcess[], idx: number): string[] {
  if (process.nextProcessIds && process.nextProcessIds.length > 0) {
    const validIds = new Set(allProcesses.map(p => p.id));
    return process.nextProcessIds.filter(id => validIds.has(id) && id !== process.id);
  }
  // Legacy fallback: sequential chain, same as today's array order.
  return idx < allProcesses.length - 1 ? [allProcesses[idx + 1].id] : [];
}

function buildProcessGraph(processes: VsmProcess[]): { edges: VsmGraphEdge[] } {
  const edges: VsmGraphEdge[] = [];
  processes.forEach((p, idx) => {
    getEffectiveSuccessorIds(p, processes, idx).forEach(toId => {
      edges.push({ fromId: p.id, toId, type: (p.connectionTypes && p.connectionTypes[toId]) || "Normal" });
    });
  });
  return { edges };
}

// True when the effective graph is a single straight chain (every process has at most one
// predecessor and at most one successor) — no branching exists yet, so the classic single-row
// rendering and flat lead-time sum are already exactly correct and must be used unchanged.
function isLinearFlow(processes: VsmProcess[], edges: VsmGraphEdge[]): boolean {
  if (processes.length <= 1) return true;
  const outCount = new Map<string, number>();
  const inCount = new Map<string, number>();
  edges.forEach(e => {
    outCount.set(e.fromId, (outCount.get(e.fromId) || 0) + 1);
    inCount.set(e.toId, (inCount.get(e.toId) || 0) + 1);
  });
  return processes.every(p => (outCount.get(p.id) || 0) <= 1 && (inCount.get(p.id) || 0) <= 1);
}

interface VsmGraphLayout {
  positions: Map<string, { x: number; y: number; rank: number; lane: number }>;
  predecessors: Map<string, string[]>;
  successors: Map<string, string[]>;
  rank: Map<string, number>;
  laneCount: number;
  maxRank: number;
}

// Layered graph-drawing layout: rank = column (longest path from any root — a node can never sit
// left of any of its predecessors), lane = row. Lanes are assigned greedily per rank so a
// continuing chain keeps its lane and new branches get their own — this keeps left-to-right flow
// and avoids overlap without needing a full crossing-minimization solver.
function computeGraphLayout(processes: VsmProcess[], edges: VsmGraphEdge[]): VsmGraphLayout {
  const ids = processes.map(p => p.id);
  const idSet = new Set(ids);
  const predecessors = new Map<string, string[]>(ids.map(id => [id, []]));
  const successors = new Map<string, string[]>(ids.map(id => [id, []]));
  edges.forEach(e => {
    if (!idSet.has(e.fromId) || !idSet.has(e.toId)) return;
    successors.get(e.fromId)!.push(e.toId);
    predecessors.get(e.toId)!.push(e.fromId);
  });

  // 1. Rank via topological (Kahn's algorithm) longest-path-from-root.
  const rank = new Map<string, number>();
  const remainingIndegree = new Map<string, number>(ids.map(id => [id, predecessors.get(id)!.length]));
  const queue: string[] = ids.filter(id => remainingIndegree.get(id) === 0);
  queue.forEach(id => rank.set(id, 0));
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const currentRank = rank.get(current) || 0;
    successors.get(current)!.forEach(nextId => {
      const candidateRank = currentRank + 1;
      if ((rank.get(nextId) ?? -1) < candidateRank) rank.set(nextId, candidateRank);
      const remaining = (remainingIndegree.get(nextId) || 0) - 1;
      remainingIndegree.set(nextId, remaining);
      if (remaining === 0) queue.push(nextId);
    });
  }
  // Any node never reached (e.g. a Rework cycle feeding back on itself) just falls back to rank 0
  // instead of being left undefined — keeps the layout from breaking on future connection types.
  ids.forEach(id => { if (!rank.has(id)) rank.set(id, 0); });

  // 2. Lane assignment, rank by rank: keep a node in its first predecessor's lane when free,
  // otherwise hand it the next free lane at that rank.
  const lane = new Map<string, number>();
  const maxRank = ids.length > 0 ? Math.max(...Array.from(rank.values())) : 0;
  let laneCounter = 0;
  for (let r = 0; r <= maxRank; r++) {
    const nodesAtRank = ids.filter(id => rank.get(id) === r);
    const usedLanesThisRank = new Set<number>();
    nodesAtRank.forEach(id => {
      const preds = predecessors.get(id) || [];
      let assigned: number | undefined;
      if (preds.length > 0) {
        const preferredLane = lane.get(preds[0]);
        if (preferredLane !== undefined && !usedLanesThisRank.has(preferredLane)) {
          assigned = preferredLane;
        }
      }
      if (assigned === undefined) {
        while (usedLanesThisRank.has(laneCounter)) laneCounter++;
        assigned = laneCounter;
        laneCounter++;
      }
      lane.set(id, assigned);
      usedLanesThisRank.add(assigned);
    });
  }

  // 3. Pixel coordinates — column/row spacing kept close to the legacy single-row scale so card
  // sizing and the fixed supplier/customer/production-control boxes don't need to change.
  const COLUMN_WIDTH = 280;
  const LANE_HEIGHT = 270; // process cards are ~230px tall; leaves a clear gap between lanes
  const START_X = 310;
  const START_Y = 265; // matches the legacy single-row card top offset (top-[265px])
  const positions = new Map<string, { x: number; y: number; rank: number; lane: number }>();
  ids.forEach(id => {
    const r = rank.get(id) || 0;
    const l = lane.get(id) || 0;
    positions.set(id, { x: START_X + r * COLUMN_WIDTH, y: START_Y + l * LANE_HEIGHT, rank: r, lane: l });
  });

  return { positions, predecessors, successors, rank, laneCount: laneCounter, maxRank };
}

// Critical-path (longest path) total lead time in days — the correct rollup once branches exist:
// parallel lanes run in the same calendar time, so their WIP-wait days must NOT be added together
// (that would double/triple-count elapsed time). Each node's own inventoryDays (its WIP wait
// before that station) is still tracked and shown per-process; only the top-level total switches
// from a flat sum to "longest path through the graph." For any existing linear-chain project this
// is mathematically identical to the old flat sum (there is only one path), so there is no
// behavior change for today's single-chain VSMs.
function computeCriticalPath(
  processesWithTimeline: Array<VsmProcess & { inventoryDays?: number }>,
  rank: Map<string, number>,
  predecessors: Map<string, string[]>
): { totalDays: number; criticalPathIds: Set<string> } {
  const byId = new Map(processesWithTimeline.map(p => [p.id, p]));
  const orderedIds = processesWithTimeline.map(p => p.id).sort((a, b) => (rank.get(a) || 0) - (rank.get(b) || 0));
  const pathValue = new Map<string, number>();
  const bestPredOf = new Map<string, string | null>();
  orderedIds.forEach(id => {
    const preds = predecessors.get(id) || [];
    let bestPred: string | null = null;
    let bestVal = 0;
    preds.forEach(predId => {
      const v = pathValue.get(predId) || 0;
      if (v >= bestVal) { bestVal = v; bestPred = predId; }
    });
    bestPredOf.set(id, bestPred);
    pathValue.set(id, (byId.get(id)?.inventoryDays || 0) + bestVal);
  });

  let maxVal = 0;
  let maxId: string | null = null;
  pathValue.forEach((v, id) => { if (v >= maxVal) { maxVal = v; maxId = id; } });

  // Walk back through each node's best predecessor from the winning sink to mark every process
  // that actually sits on the longest path — used to visually highlight what's driving lead time.
  const criticalPathIds = new Set<string>();
  let cursor = maxId;
  while (cursor) {
    criticalPathIds.add(cursor);
    cursor = bestPredOf.get(cursor) || null;
  }

  return { totalDays: Math.round(maxVal * 100) / 100, criticalPathIds };
}

export default function VsmPage() {
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
  const [activeTab, setActiveTab] = useState<"setup" | "definition" | "production" | "quality" | "vsm" | "dashboard">("vsm");
  
  const [factorySetup, setFactorySetup] = useState({
    workingDays: 5,
    shiftStructure: "2 Vardiya",
    shiftDuration: 8,
    breakTimes: 75,
    plannedMaintenance: 15,
    weeklyDemand: 3000,
    productFamily: "Isıtıcı Grubu",
    customerName: "Beko Global",
    shippingFrequency: "Günlük (Daily)",
    productVolumeShare: 30,
    scrapUnitCost: 450,
    holdingCostPerWipYearly: 150,
    downtimeHourlyCost: 2500
  });

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
          vsmProcesses: defaultVsmProcesses, // initialize with defaults
          factorySetup: {
            workingDays: 5,
            shiftStructure: "2 Vardiya",
            shiftDuration: 8,
            breakTimes: 75,
            plannedMaintenance: 15,
            weeklyDemand: selectedCustomer?.employeeCount ? Math.round(selectedCustomer.employeeCount * 12) : 3000,
            productFamily: projForm.productGroup || "Ürün Grubu",
            customerName: selectedCustomer?.companyName || "Fabrika",
            shippingFrequency: "Günlük (Daily)",
            productVolumeShare: 30
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
      }
    })
    .catch(err => {
      console.error("Failed to delete project", err);
    });
  };

  const handleSelectProject = (project: any) => {
    setSelectedProject(project);
    if (project) {
      if (project.factorySetup) {
        setFactorySetup({
          workingDays: project.factorySetup.workingDays ?? 5,
          shiftStructure: project.factorySetup.shiftStructure || "2 Vardiya",
          shiftDuration: project.factorySetup.shiftDuration ?? 8,
          breakTimes: project.factorySetup.breakTimes ?? 75,
          plannedMaintenance: project.factorySetup.plannedMaintenance ?? 15,
          weeklyDemand: project.factorySetup.weeklyDemand ?? 3000,
          productFamily: project.factorySetup.productFamily || "Ürün Grubu",
          customerName: project.factorySetup.customerName || "Fabrika",
          shippingFrequency: project.factorySetup.shippingFrequency || "Günlük (Daily)",
          productVolumeShare: project.factorySetup.productVolumeShare ?? 30,
          scrapUnitCost: project.factorySetup.scrapUnitCost ?? 45,
          holdingCostPerWipYearly: project.factorySetup.holdingCostPerWipYearly ?? 18,
          downtimeHourlyCost: project.factorySetup.downtimeHourlyCost ?? 350
        });
      } else {
        setFactorySetup({
          workingDays: 5,
          shiftStructure: "2 Vardiya",
          shiftDuration: 8,
          breakTimes: 75,
          plannedMaintenance: 15,
          weeklyDemand: selectedCustomer?.employeeCount ? Math.round(selectedCustomer.employeeCount * 12) : 3000,
          productFamily: project.productGroup || "Ürün Grubu",
          customerName: selectedCustomer?.companyName || "Fabrika",
          shippingFrequency: "Günlük (Daily)",
          productVolumeShare: 30,
          scrapUnitCost: 45,
          holdingCostPerWipYearly: 18,
          downtimeHourlyCost: 350
        });
      }

      if (project.vsmProcesses && project.vsmProcesses.length > 0) {
        setVsmProcesses(project.vsmProcesses);
      } else {
        setVsmProcesses(defaultVsmProcesses);
      }

      if (project.simulationEdits) {
        setSimulationEdits(project.simulationEdits);
      } else {
        setSimulationEdits({});
      }

      if (project.simulationMode) {
        setSimulationMode(project.simulationMode);
      } else {
        setSimulationMode("current");
      }
    }
  };

  // Push the operational fields VSM and the cost-table `processes` collection genuinely share
  // (cycleTime, oee, capacity, headcount, shifts, working hours, utilization) back into the
  // matching ProcessRecord, for any VSM process that originated from that table (same id).
  // Cost fields (scrapCost/laborCost/etc.) are intentionally left untouched — VSM doesn't
  // collect cost data, so there is no reliable source value to sync for those.
  const syncVsmProcessesToCostTable = (processesToSync: VsmProcess[]) => {
    if (!dbProcesses || dbProcesses.length === 0) return;
    const dbById = new Map(dbProcesses.map(p => [p.id, p]));

    processesToSync.forEach((vp) => {
      const matched = dbById.get(vp.id);
      if (!matched) return; // Not sourced from the cost table (fallback/manual VSM-only process) — nothing to sync.

      const perShiftHours = vp.shifts > 0 ? Math.round(vp.workingHours / vp.shifts) : matched.workingHours;
      const updatedProcess = {
        ...matched,
        cycleTime: vp.cycleTime,
        oee: vp.oee,
        capacity: vp.capacity,
        operatorCount: vp.operatorCount,
        machineCount: vp.machineCount,
        shiftCount: vp.shifts,
        workingHours: perShiftHours,
        utilizationRate: vp.availability
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
      simulationEdits,
      simulationMode
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
        syncVsmProcessesToCostTable(vsmProcesses);
        setJustSavedProject(true);
        setTimeout(() => setJustSavedProject(false), 2000);
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

  // Canvas View Controls
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [vsmBrightMode, setVsmBrightMode] = useState<boolean>(false);

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

  // --- MAPPED RAW PROCESSES FOR VSM COMPATIBILITY ---
  const defaultVsmProcesses = useMemo<VsmProcess[]>(() => {
    // Standard backup set of processes if no operational data exists yet
    const fallbackList: VsmProcess[] = [
      {
        id: "vsm_p1",
        name: "KESME & PRE-FORM",
        type: "Automatic",
        productionModel: "Batch",
        machineCount: 1,
        operatorCount: 1,
        shifts: 2,
        workingHours: 8,
        cycleTime: 45,
        oee: 75,
        availability: 85,
        performance: 90,
        quality: 98,
        capacity: 1000,
        downtimeMinutes: 15,
        inventoryBefore: 1200,
        isKanbanEnabled: false,
        isSupermarket: false,
        notes: "Lazer kesim toleransı ±0.1mm. Kalıp ayar süresi yüksek.",
        kaizenOpp: "SMED çalışması ile kalıp değişim süresi 45 dk'dan 15 dk'ya indirilebilir."
      },
      {
        id: "vsm_p2",
        name: "PRES FORM VERME",
        type: "Automatic",
        productionModel: "Batch",
        machineCount: 1,
        operatorCount: 1,
        shifts: 2,
        workingHours: 8,
        cycleTime: 50,
        oee: 70,
        availability: 80,
        performance: 90,
        quality: 97,
        capacity: 900,
        downtimeMinutes: 25,
        inventoryBefore: 650,
        isKanbanEnabled: true,
        isSupermarket: true,
        notes: "250 Ton hidrolik pres gövde bükümü gerçekleştirir.",
        kaizenOpp: "Malzeme besleme milk-run sistemine geçilerek bekleme elenebilir."
      },
      {
        id: "vsm_p3",
        name: "ROBOTİK KAYNAK",
        type: "Semi Automatic",
        productionModel: "Cell",
        machineCount: 2,
        operatorCount: 2,
        shifts: 2,
        workingHours: 8,
        cycleTime: 72,
        oee: 84,
        availability: 92,
        performance: 95,
        quality: 96,
        capacity: 1100,
        downtimeMinutes: 10,
        inventoryBefore: 300,
        isKanbanEnabled: false,
        isSupermarket: false,
        notes: "Gövde birleştirme kaynak robot hücresi.",
        kaizenOpp: "Fikstür yükleme ergonomisi iyileştirilerek çevrim süresi 8sn kısaltılabilir."
      },
      {
        id: "vsm_p4",
        name: "BOYAHANE / KAPLAMA",
        type: "Automatic",
        productionModel: "Assembly Line",
        machineCount: 1,
        operatorCount: 2,
        shifts: 2,
        workingHours: 8,
        cycleTime: 110, // Exceeds Takt Time
        oee: 68,
        availability: 78,
        performance: 90,
        quality: 97,
        capacity: 480,
        downtimeMinutes: 45,
        inventoryBefore: 1600, // Large bottleneck inventory
        isKanbanEnabled: false,
        isSupermarket: false,
        notes: "Toz boya fırın kürlenme süresi kısıtlıdır.",
        kaizenOpp: "Fırın askılama yoğunluğu optimize edilerek kapasite %25 artırılabilir."
      },
      {
        id: "vsm_p5",
        name: "MONTAJ HATTI",
        type: "Manual",
        productionModel: "Assembly Line",
        machineCount: 0,
        operatorCount: 8,
        shifts: 2,
        workingHours: 8,
        cycleTime: 65,
        oee: 78,
        availability: 88,
        performance: 92,
        quality: 96,
        capacity: 1400,
        downtimeMinutes: 8,
        inventoryBefore: 180,
        isKanbanEnabled: true,
        isSupermarket: true,
        notes: "Hücresel montaj hattı düzeni.",
        kaizenOpp: "Hat dengeleme (Yamazumi) çalışması ile operatör verimi artırılabilir."
      },
      {
        id: "vsm_p6",
        name: "KALİTE KONTROL & SEVK",
        type: "Manual",
        productionModel: "Cell",
        machineCount: 1,
        operatorCount: 2,
        shifts: 2,
        workingHours: 8,
        cycleTime: 55,
        oee: 88,
        availability: 95,
        performance: 96,
        quality: 97,
        capacity: 1200,
        downtimeMinutes: 2,
        inventoryBefore: 90,
        isKanbanEnabled: false,
        isSupermarket: false,
        notes: "Kamera destekli sızdırmazlık kontrolü ve paketleme.",
        kaizenOpp: "Poka-Yoke entegrasyonu ile manuel kontrol süreleri azaltılabilir."
      }
    ];

    if (dbProcesses && dbProcesses.length > 0) {
      // Map existing Operational Data processes into beautiful, comprehensive VSM processes!
      return dbProcesses.map((p, index) => {
        const qualityRate = p.scrapCost > 0 ? Math.max(80, 100 - (p.scrapCost / 4000)) : 98;
        const downtimeMin = p.downtimeCost > 0 ? Math.min(120, Math.round(p.downtimeCost / 1200)) : 15;
        
        // Formulate reasonable VSM mapping fields
        return {
          id: p.id,
          name: p.name.toUpperCase(),
          type: p.machineCount === 0 ? "Manual" : (p.operatorCount === 0 ? "Automatic" : "Semi Automatic"),
          productionModel: p.machineCount > 2 ? "Cell" : "Assembly Line",
          machineCount: p.machineCount || 1,
          operatorCount: p.operatorCount || 2,
          shifts: p.shiftCount || 2,
          shiftHours: Array.from({ length: p.shiftCount || 2 }, () => p.workingHours || 8),
          workingHours: (p.shiftCount || 2) * (p.workingHours || 8),
          cycleTime: p.cycleTime || 60,
          oee: p.oee || 75,
          availability: p.utilizationRate || 85,
          performance: 90,
          quality: qualityRate,
          capacity: p.capacity || 1000,
          downtimeMinutes: downtimeMin,
          inventoryBefore: index === 0 ? 1200 : (index === 3 ? 1500 : 250), // Realistic WIP layout
          isKanbanEnabled: index % 2 === 1,
          isSupermarket: index === 1 || index === 4,
          notes: `${p.name} operasyon süreci. OEE seviyesi %${p.oee}.`,
          kaizenOpp: p.scrapCost > 40000 
            ? "Yüksek fire oranını düşürmek için Pokayoke veya kalite Kaizeni tasarlanmalı." 
            : "Standart iş adımları tescil edilerek dengesizlik giderilebilir."
        };
      });
    }
    
    return fallbackList;
  }, [dbProcesses]);

  useEffect(() => {
    fetchProcesses();
  }, [selectedCustomerId]);

  // --- SYNC FACTORY SETUP WITH SELECTED CUSTOMER ---
  useEffect(() => {
    if (selectedCustomer) {
      setFactorySetup(prev => ({
        ...prev,
        customerName: selectedCustomer.companyName || prev.customerName,
        productFamily: selectedCustomer.productionType || prev.productFamily,
        weeklyDemand: selectedCustomer.employeeCount ? Math.round(selectedCustomer.employeeCount * 12) : prev.weeklyDemand
      }));
    }
  }, [selectedCustomer]);

  // --- INITIALIZE VSMPROCESSES FROM DEFAULTVSMPROCESSES ---
  useEffect(() => {
    if (defaultVsmProcesses && defaultVsmProcesses.length > 0) {
      const initialized = defaultVsmProcesses.map((p, idx, arr) => {
        const calculatedOee = p.oee || 75;
        const calculatedAvail = p.availability || 85;
        const calculatedQuality = p.quality || 98;
        const actualQuantity = p.capacity || 1000;
        const plannedQuantity = Math.round(actualQuantity * 1.1);
        const idealCycleTime = p.cycleTime || 45;
        
        // Setup shift hours and daily total working hours
        const shiftHours = p.shiftHours || Array.from({ length: p.shifts || 2 }, () => p.workingHours || 8);
        const totalWorkingHours = shiftHours.reduce((sum, h) => sum + h, 0);
        const productionTime = totalWorkingHours * 60; // in minutes
        
        const changeoverTime = 30; // default changeover mins
        const breakdownTime = p.downtimeMinutes || 15;
        const firstPieceApproval = 10;
        const waitingTime = 15;
        const minorStops = 5;
        
        const goodParts = Math.round(actualQuantity * (calculatedQuality / 100));
        const scrap = actualQuantity - goodParts;
        const rework = Math.round(actualQuantity * 0.05);
        
        return {
          ...p,
          shiftHours,
          workingHours: totalWorkingHours,
          planningFrequency: p.isKanbanEnabled ? "Daily" : "Weekly",
          prevProcessId: idx > 0 ? arr[idx - 1].id : undefined,
          nextProcessId: idx < arr.length - 1 ? arr[idx + 1].id : undefined,
          plannedQuantity,
          actualQuantity,
          idealCycleTime,
          productionTime,
          changeoverTime,
          changeoverFrequency: "1/Vardiya",
          firstPieceApproval,
          breakdownTime,
          waitingTime,
          minorStops,
          goodParts,
          scrap,
          rework,
          wipQuantity: p.inventoryBefore,
          inventoryBetweenProcesses: p.inventoryBefore
        };
      });
      setVsmProcesses(initialized);
    }
  }, [defaultVsmProcesses]);



  // --- AUTOMATED MANUFACTURING CALCULATIONS ---
  const activeProcesses = useMemo<VsmProcess[]>(() => {
    const baseList = vsmProcesses.length > 0 ? vsmProcesses : defaultVsmProcesses;
    
    return baseList.map((p) => {
      // 1. Merge edits if in simulationMode and edits exist
      const edits = simulationMode === "future" ? (simulationEdits[p.id] || {}) : {};
      const merged = { ...p, ...edits };
      
      // 2. Perform automated manufacturing calculations
      const finalGoodParts = merged.goodParts !== undefined ? merged.goodParts : Math.round((merged.actualQuantity || 900) * ((merged.quality || 98) / 100));
      const finalScrap = merged.scrap !== undefined ? merged.scrap : Math.round((merged.actualQuantity || 900) * (1 - (merged.quality || 98) / 100));
      const calculatedQuality = (finalGoodParts + finalScrap) > 0 
        ? Math.round((finalGoodParts / (finalGoodParts + finalScrap)) * 1000) / 10 
        : (merged.quality || 98);

      const finalShiftHours = merged.shiftHours || Array.from({ length: merged.shifts || 2 }, () => 8);
      const totalHours = finalShiftHours.reduce((sum, h) => sum + h, 0);
      const finalProdTime = totalHours * 60;
      const finalCOTime = merged.changeoverTime || 0;
      const finalBDTime = merged.breakdownTime || merged.downtimeMinutes || 0;
      const finalFPApproval = merged.firstPieceApproval || 0;

      // Availability = (Production Time - Changeover - Breakdown - First Piece Approval) / Production Time * 100
      const availTime = finalProdTime - finalCOTime - finalBDTime - finalFPApproval;
      const calculatedAvailability = finalProdTime > 0 
        ? Math.max(0, Math.min(100, Math.round((availTime / finalProdTime) * 1000) / 10)) 
        : (merged.availability || 85);

      // Performance = (Actual Quantity * Ideal Cycle Time) / (Avail Time * 60) * 100
      const idealCT = merged.idealCycleTime || merged.cycleTime;
      const calculatedPerformance = (availTime > 0 && merged.actualQuantity !== undefined) 
        ? Math.max(0, Math.min(100, Math.round(((merged.actualQuantity * idealCT) / (availTime * 60)) * 1000) / 10)) 
        : (merged.performance || 90);

      // OEE = Availability * Performance * Quality / 10000
      const calculatedOee = Math.round((calculatedAvailability * calculatedPerformance * calculatedQuality) / 10000 * 10) / 10;

      // Capacity = (Avail Time * 60) / Ideal Cycle Time (units per day)
      const calculatedCapacity = idealCT > 0
        ? Math.round((availTime * 60) / idealCT)
        : (merged.capacity || 1000);

      return {
        ...merged,
        shiftHours: finalShiftHours,
        workingHours: totalHours,
        quality: calculatedQuality,
        availability: calculatedAvailability,
        performance: calculatedPerformance,
        oee: calculatedOee,
        capacity: calculatedCapacity,
        // cycleTime is intentionally NOT recomputed here — it must stay whatever the user set
        // directly (drawer / table edit), in whichever mode (Current or Future) they set it in.
        // It previously got silently overwritten by (availTime*60)/actualQuantity on every
        // render, which meant a direct cycle-time edit had no visible effect anywhere (map
        // cards, bottleneck detection, dashboards) — this is what broke the Future-state
        // "boyahane 110→100" simulation. Performance/Capacity above already correctly compare
        // idealCT against actual output, so that diagnostic isn't lost.
        cycleTime: merged.cycleTime,
        downtimeMinutes: finalBDTime,
        goodParts: finalGoodParts,
        scrap: finalScrap
      };
    });
  }, [vsmProcesses, defaultVsmProcesses, simulationMode, simulationEdits]);

  // --- CORE SYSTEM METRICS & DEMAND ---
  const companyCurrency = selectedCustomer?.currency || "₺";
  const workingDays = factorySetup.workingDays;
  const weeklyDemand = factorySetup.weeklyDemand;
  
  const dailyDemand = useMemo(() => {
    return Math.round(weeklyDemand / workingDays);
  }, [weeklyDemand, workingDays]);

  const monthlyDemand = useMemo(() => {
    return Math.round(dailyDemand * 22);
  }, [dailyDemand]);

  // Net Available time for calculation (usually based on bottleneck shift parameters)
  const netAvailableSecondsPerDay = useMemo(() => {
    const activeShifts = activeProcesses[0]?.shifts || 2;
    const activeHours = factorySetup.shiftDuration || 8;
    const breakTimes = factorySetup.breakTimes || 75;
    const plannedMaint = factorySetup.plannedMaintenance || 15;
    const netMinsPerShift = (activeHours * 60) - breakTimes - plannedMaint;
    return activeShifts * netMinsPerShift * 60;
  }, [activeProcesses, factorySetup]);

  const taktTime = useMemo(() => {
    if (dailyDemand <= 0) return 0;
    return Math.round((netAvailableSecondsPerDay / dailyDemand) * 10) / 10;
  }, [dailyDemand, netAvailableSecondsPerDay]);

  // --- INVENTORY DAYS & TIMELINE CALCULATIONS ---
  const processesWithTimeline = useMemo(() => {
    return activeProcesses.map((p, idx, arr) => {
      // Ensure we bind wipQuantity or inventoryBetweenProcesses
      const wip = p.wipQuantity !== undefined ? p.wipQuantity : p.inventoryBefore;
      // Inventory Days = Inventory Quantity / Daily Demand
      const invDays = dailyDemand > 0 ? Math.round((wip / dailyDemand) * 100) / 100 : 0;
      
      return {
        ...p,
        inventoryBefore: wip,
        inventoryDays: invDays,
        prevProcessId: p.prevProcessId || (idx > 0 ? arr[idx - 1].id : undefined),
        nextProcessId: p.nextProcessId || (idx < arr.length - 1 ? arr[idx + 1].id : undefined)
      };
    });
  }, [activeProcesses, dailyDemand]);

  // --- GRAPH-BASED FLOW (parallel/branching VSM support) ---
  // Builds the process relationship graph and its layout from `processesWithTimeline`. When no
  // process has explicit `nextProcessIds`, `isFlowLinear` is true and the map/drawing tab renders
  // exactly as it always has — this only activates multi-lane mode when a real branch exists.
  const vsmGraphEdges = useMemo(() => buildProcessGraph(processesWithTimeline).edges, [processesWithTimeline]);
  const isFlowLinear = useMemo(() => isLinearFlow(processesWithTimeline, vsmGraphEdges), [processesWithTimeline, vsmGraphEdges]);
  const vsmGraphLayout = useMemo(() => computeGraphLayout(processesWithTimeline, vsmGraphEdges), [processesWithTimeline, vsmGraphEdges]);

  // Summary Metrics
  const totalWip = useMemo(() => {
    // Additive across every process/lane on purpose: unlike elapsed time, simultaneously-held WIP
    // in parallel lanes is real, concurrent tied-up capital — it does not "overlap away."
    return processesWithTimeline.reduce((sum, p) => sum + p.inventoryBefore, 0);
  }, [processesWithTimeline]);

  const vsmCriticalPath = useMemo(
    () => computeCriticalPath(processesWithTimeline, vsmGraphLayout.rank, vsmGraphLayout.predecessors),
    [processesWithTimeline, vsmGraphLayout]
  );

  const totalLeadTimeDays = useMemo(() => {
    // Critical-path (longest path) rollup — see computeCriticalPath for why. For a linear chain
    // this is mathematically identical to the old flat sum (only one path exists).
    return vsmCriticalPath.totalDays;
  }, [vsmCriticalPath]);

  // Per-lane breakdown for the graph-mode timeline summary (replaces the single-row VA/NVA ladder,
  // which is inherently a one-path visualization and can't represent branches). Each lane's own
  // WIP-wait + processing time is shown separately, per the requirement that stock/lead-time
  // effects stay visible per process flow rather than collapsing into one number.
  const vsmLaneSummaries = useMemo(() => {
    const byLane = new Map<number, typeof processesWithTimeline>();
    processesWithTimeline.forEach(p => {
      const pos = vsmGraphLayout.positions.get(p.id);
      const lane = pos?.lane ?? 0;
      if (!byLane.has(lane)) byLane.set(lane, []);
      byLane.get(lane)!.push(p);
    });
    return Array.from(byLane.entries())
      .sort(([a], [b]) => a - b)
      .map(([lane, procs]) => {
        const sorted = [...procs].sort((a, b) => (vsmGraphLayout.positions.get(a.id)?.rank || 0) - (vsmGraphLayout.positions.get(b.id)?.rank || 0));
        const waitDays = sorted.reduce((sum, p) => sum + (p.inventoryDays || 0), 0);
        const processingSeconds = sorted.reduce((sum, p) => sum + p.cycleTime, 0);
        const isCritical = sorted.some(p => vsmCriticalPath.criticalPathIds.has(p.id));
        return { lane, processes: sorted, waitDays: Math.round(waitDays * 100) / 100, processingSeconds, isCritical };
      });
  }, [processesWithTimeline, vsmGraphLayout, vsmCriticalPath]);

  const totalLeadTimeSeconds = useMemo(() => {
    // Lead time converted to equivalent seconds (assuming 24 hour warehouse days)
    return totalLeadTimeDays * 24 * 3600;
  }, [totalLeadTimeDays]);

  const totalProcessingTimeSeconds = useMemo(() => {
    return processesWithTimeline.reduce((sum, p) => sum + p.cycleTime, 0);
  }, [processesWithTimeline]);

  const totalWaitingTimeHours = useMemo(() => {
    // Approx waiting time derived from non-value added inventory days
    return Math.round(totalLeadTimeDays * 24 * 10) / 10;
  }, [totalLeadTimeDays]);

  const valueAddedRatio = useMemo(() => {
    if (totalLeadTimeSeconds <= 0) return 0;
    const ratio = (totalProcessingTimeSeconds / totalLeadTimeSeconds) * 100;
    // Real-world value stream maps have tiny VA ratios, e.g., 0.05% to 5%. Let's display with high precision
    return Math.round(ratio * 1000) / 1000;
  }, [totalLeadTimeSeconds, totalProcessingTimeSeconds]);

  const averageOee = useMemo(() => {
    if (processesWithTimeline.length === 0) return 0;
    return Math.round(processesWithTimeline.reduce((sum, p) => sum + p.oee, 0) / processesWithTimeline.length);
  }, [processesWithTimeline]);

  const averageCapacityUtilization = useMemo(() => {
    if (processesWithTimeline.length === 0) return 0;
    // Derive approximate capacity utilization based on daily demand vs capacity
    const totalCap = processesWithTimeline.reduce((sum, p) => sum + p.capacity, 0);
    const avgCap = totalCap / processesWithTimeline.length;
    return avgCap > 0 ? Math.min(100, Math.round((dailyDemand / avgCap) * 100)) : 0;
  }, [processesWithTimeline, dailyDemand]);

  const totalOperators = useMemo(() => {
    return processesWithTimeline.reduce((sum, p) => sum + p.operatorCount, 0);
  }, [processesWithTimeline]);

  const totalMachines = useMemo(() => {
    return processesWithTimeline.reduce((sum, p) => sum + p.machineCount, 0);
  }, [processesWithTimeline]);

  // --- BOTTLENECK & CRITICAL KPI DETECTION ---
  const bottleneckProcess = useMemo(() => {
    if (processesWithTimeline.length === 0) return null;
    // Lean definition: Bottleneck is the station with the highest Cycle Time (CT) or lowest capacity
    return processesWithTimeline.reduce((worst, current) => {
      return (current.cycleTime > worst.cycleTime) ? current : worst;
    }, processesWithTimeline[0]);
  }, [processesWithTimeline]);

  const highestDowntimeProcess = useMemo(() => {
    if (processesWithTimeline.length === 0) return null;
    return processesWithTimeline.reduce((worst, current) => {
      return (current.downtimeMinutes > worst.downtimeMinutes) ? current : worst;
    }, processesWithTimeline[0]);
  }, [processesWithTimeline]);

  const highestInventoryProcess = useMemo(() => {
    if (processesWithTimeline.length === 0) return null;
    return processesWithTimeline.reduce((worst, current) => {
      return (current.inventoryBefore > worst.inventoryBefore) ? current : worst;
    }, processesWithTimeline[0]);
  }, [processesWithTimeline]);

  const lowestOeeProcess = useMemo(() => {
    if (processesWithTimeline.length === 0) return null;
    return processesWithTimeline.reduce((worst, current) => {
      return (current.oee < worst.oee) ? current : worst;
    }, processesWithTimeline[0]);
  }, [processesWithTimeline]);

  // Sync VSM simulation bottleneck & improvement topics directly to CI Project Management (Kaizens)
  const handleSyncToCiProjects = async () => {
    try {
      const generatedKaizens: any[] = [];
      const factoryId = selectedCustomerId || factorySetup.customerName || "default";

      activeProcesses.forEach((p) => {
        // 1. Bottleneck OEE Check
        if (p.oee < 75 || p.id === bottleneckProcess?.id) {
          generatedKaizens.push({
            title: `[VSM Simülasyon] ${p.name} OEE %${p.oee} Darboğaz İyileştirme`,
            description: `${p.name} prosesi %${p.oee} OEE verimi ile hattın ana dar boğazıdır. Çevrim süresini optimize etme ve arıza/setup duruşlarının elenmesi gereklidir.`,
            type: "Kaizen",
            status: "New Idea",
            originator: "VSM Simülasyon Motoru",
            department: "Üretim & Metot",
            estimatedCost: 12000,
            expectedGain: Math.round((estimatedAnnualWasteCost || 50000) * 0.35),
            priority: "High",
            factory_id: factoryId
          });
        }

        // 2. High C/O (Setup/SMED)
        if (p.changeoverMinutes && p.changeoverMinutes > 15) {
          generatedKaizens.push({
            title: `[VSM Simülasyon] ${p.name} SMED Hızlı Kalıp/Ayar Değişimi`,
            description: `${p.name} operasyonunda ${p.changeoverMinutes} dk setup/kalıp değişim süresi mevcuttur. SMED metodolojisi ile %50 süre düşürme hedeflenmelidir.`,
            type: "SMED",
            status: "New Idea",
            originator: "VSM Simülasyon Motoru",
            department: "Pres Atölyesi / Kalıphane",
            estimatedCost: 8000,
            expectedGain: Math.round((p.changeoverMinutes * 250 * 50) * 0.8),
            priority: "High",
            factory_id: factoryId
          });
        }

        // 3. High Cycle Time vs Takt Time
        if (p.cycleTime > taktTime) {
          generatedKaizens.push({
            title: `[VSM Simülasyon] ${p.name} Çevrim Zamanı (${p.cycleTime}s > Takt ${taktTime}s) Düşürme`,
            description: `${p.name} çevrim zamanı (${p.cycleTime} sn) takt zamanını (${taktTime} sn) aştığı için müşteri talebi karşılanamıyor. Yamazumi hat dengeleme uygulanmalı.`,
            type: "Hat Dengeleme",
            status: "New Idea",
            originator: "VSM Simülasyon Motoru",
            department: "Endüstri Mühendisliği",
            estimatedCost: 5000,
            expectedGain: 45000,
            priority: "High",
            factory_id: factoryId
          });
        }

        // 4. Scrap & Quality / Rework
        if (p.quality < 98) {
          generatedKaizens.push({
            title: `[VSM Simülasyon] ${p.name} Poka-Yoke & Hurda/Iskarta Azaltma`,
            description: `${p.name} prosesindeki kalite oranı %${p.quality}. Hatalı üretimi ve rework oranını engellemek için süreç içi Poka-Yoke sensör sistemi kurulmalı.`,
            type: "Kalite / Poka-Yoke",
            status: "New Idea",
            originator: "VSM Simülasyon Motoru",
            department: "Kalite Güvence",
            estimatedCost: 15000,
            expectedGain: 65000,
            priority: "Medium",
            factory_id: factoryId
          });
        }

        // 5. High WIP Inventory
        if (p.inventoryBefore > 400) {
          generatedKaizens.push({
            title: `[VSM Simülasyon] ${p.name} Süpermarket & Ara Stok (WIP: ${p.inventoryBefore} ad) Düşürme`,
            description: `${p.name} öncesinde ${p.inventoryBefore} adet yığılmış ara stok bulunmaktadır. Kanban/Pull akış çekme sistemi kurulmalıdır.`,
            type: "Süpermarket / Pull",
            status: "New Idea",
            originator: "VSM Simülasyon Motoru",
            department: "Lojistik / Malzeme",
            estimatedCost: 3000,
            expectedGain: 38000,
            priority: "High",
            factory_id: factoryId
          });
        }

        // 6. High Downtime
        if (p.downtimeMinutes > 15) {
          generatedKaizens.push({
            title: `[VSM Simülasyon] ${p.name} TPM Otonom Bakım & Arıza Duruş Önleme`,
            description: `${p.name} makinesinde günlük ${p.downtimeMinutes} dk arıza/plansız duruş yaşanmaktadır. TPM Otonom ve Kestirimci Bakım devreye alınmalı.`,
            type: "TPM Bakım",
            status: "New Idea",
            originator: "VSM Simülasyon Motoru",
            department: "Bakım Onarım",
            estimatedCost: 10000,
            expectedGain: 52000,
            priority: "High",
            factory_id: factoryId
          });
        }
      });

      let count = 0;
      for (const k of generatedKaizens) {
        await fetch("/api/business/kaizens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("gemba_token") || ""}`,
            "x-factory-id": factoryId
          },
          body: JSON.stringify(k)
        });
        count++;
      }

      // Tell App.tsx to re-fetch kaizens so the new cards show up in CI Proje Yönetimi immediately.
      window.dispatchEvent(new CustomEvent("gemba:refresh-factory-data"));

      alert(`VSM Simülasyonundaki ${count} adet dar boğaz ve iyileştirme konusu CI Proje Yönetimi sekmesine başarıyla aktarıldı!`);
    } catch (err: any) {
      alert("CI Proje Yönetimine aktarım esnasında bir hata oluştu: " + err.message);
    }
  };

  // Apply standard Lean Target simulation edits with one click
  const handleApplyLeanSimulation = () => {
    const edits: Record<string, Partial<VsmProcess>> = {};
    const baseList = vsmProcesses.length > 0 ? vsmProcesses : defaultVsmProcesses;
    
    baseList.forEach((p) => {
      edits[p.id] = {
        inventoryBefore: Math.round(p.inventoryBefore * 0.5), // %50 WIP azaltımı (Süpermarket & Kanban)
        changeoverTime: Math.round((p.changeoverTime || 30) * 0.5), // %50 SMED hızlı kalıp değişimi
        breakdownTime: Math.round((p.breakdownTime || p.downtimeMinutes || 15) * 0.35), // %65 Duruş azaltımı (TPM)
        downtimeMinutes: Math.round((p.downtimeMinutes || 15) * 0.35),
        quality: Math.min(99.5, (p.quality || 95) + 3), // +%3 FPY iyileşmesi (Poka-yoke)
        cycleTime: Math.round((p.cycleTime || 60) * 0.88), // %12 Çevrim süresi optimizasyonu (Yamazumi)
        isKanbanEnabled: true,
        isSupermarket: true
      };
    });
    setSimulationEdits(edits);
    setSimulationMode("future");
  };

  // Annual Waste Cost Estimation
  const estimatedAnnualWasteCost = useMemo(() => {
    const holdingCostPerWipUnitYearly = factorySetup.holdingCostPerWipYearly || 150;
    const scrapUnitCost = factorySetup.scrapUnitCost || 450;
    const downtimeHourlyCost = factorySetup.downtimeHourlyCost || 2500;

    const totalHoldingLoss = totalWip * holdingCostPerWipUnitYearly;
    const scrapLoss = processesWithTimeline.reduce((sum, p) => {
      // Real annual scrap volume is driven by what's actually produced, not by theoretical
      // capacity. Using capacity here meant a Future-state improvement that RAISES capacity
      // (a good thing) perversely inflated the calculated waste cost, since a bigger capacity
      // number times the same defect rate yields more "scrap units" even though nothing is
      // actually run beyond real demand/output.
      const dailyOutput = p.actualQuantity ?? p.capacity;
      const scrapQuantityYearly = dailyOutput * (1 - (p.quality / 100)) * 250;
      return sum + (scrapQuantityYearly * scrapUnitCost);
    }, 0);

    const downtimeLoss = processesWithTimeline.reduce((sum, p) => {
      const annualDowntimeHours = (p.downtimeMinutes / 60) * 250;
      return sum + (annualDowntimeHours * downtimeHourlyCost);
    }, 0);

    return Math.round(totalHoldingLoss + scrapLoss + downtimeLoss);
  }, [processesWithTimeline, totalWip, factorySetup]);

  // --- SIMULATION COMPARISON STATS (CURRENT VS FUTURE STATE) ---
  const simulationComparison = useMemo(() => {
    const hasEdits = Object.keys(simulationEdits).length > 0;
    
    // Holding, scrap, and downtime unit rates from Fabrika Kurulum Parametreleri
    const holdingRate = factorySetup.holdingCostPerWipYearly || 150;
    const scrapRate = factorySetup.scrapUnitCost || 450;
    const downtimeRate = factorySetup.downtimeHourlyCost || 2500;

    const baseList = vsmProcesses.length > 0 ? vsmProcesses : defaultVsmProcesses;
    const currentWip = baseList.reduce((sum, p) => sum + p.inventoryBefore, 0);
    const currentLeadTime = baseList.reduce((sum, p) => {
      const invDays = dailyDemand > 0 ? (p.inventoryBefore / dailyDemand) : 0;
      return sum + invDays;
    }, 0);
    const currentVaSecs = baseList.reduce((sum, p) => sum + p.cycleTime, 0);
    const currentWasteCost = baseList.reduce((sum, p) => {
      const holding = p.inventoryBefore * holdingRate;
      const dailyOutput = (p as any).actualQuantity ?? p.capacity;
      const scrap = dailyOutput * (1 - (p.quality / 100)) * 250 * scrapRate;
      const downtime = (p.downtimeMinutes / 60) * 250 * downtimeRate;
      return sum + holding + scrap + downtime;
    }, 0);

    // Strict mathematical rule: If user has not yet entered or applied simulation edits, deltas MUST BE 0!
    if (!hasEdits) {
      return {
        hasEdits: false,
        leadTimeReduction: 0,
        inventoryReduction: 0,
        costSavings: 0,
        capacityIncrease: 0,
        co2Reduction: 0
      };
    }

    const futureWip = activeProcesses.reduce((sum, p) => sum + p.inventoryBefore, 0);
    const futureLeadTime = processesWithTimeline.reduce((sum, p) => sum + p.inventoryDays, 0);
    const futureVaSecs = activeProcesses.reduce((sum, p) => sum + p.cycleTime, 0);
    const futureWasteCost = estimatedAnnualWasteCost;

    const leadTimeReduction = currentLeadTime > 0 ? ((currentLeadTime - futureLeadTime) / currentLeadTime) * 100 : 0;
    const inventoryReduction = currentWip > 0 ? ((currentWip - futureWip) / currentWip) * 100 : 0;
    const costSavings = currentWasteCost - futureWasteCost;
    const capacityIncrease = currentVaSecs > 0 ? ((currentVaSecs - futureVaSecs) / currentVaSecs) * 15 : 0;
    const co2Reduction = leadTimeReduction * 0.4;

    return {
      hasEdits: true,
      leadTimeReduction: Math.max(0, Math.round(leadTimeReduction)),
      inventoryReduction: Math.max(0, Math.round(inventoryReduction)),
      costSavings: Math.max(0, Math.round(costSavings)),
      capacityIncrease: Math.max(0, Math.round(capacityIncrease)),
      co2Reduction: Math.max(0, Math.round(co2Reduction * 10) / 10)
    };
  }, [defaultVsmProcesses, vsmProcesses, activeProcesses, processesWithTimeline, dailyDemand, estimatedAnnualWasteCost, simulationEdits, factorySetup]);

  // --- DETAILED SIMULATION CALCULATIONS (CURRENT VS FUTURE) ---
  const currentProcessesCalculated = useMemo(() => {
    const baseList = vsmProcesses.length > 0 ? vsmProcesses : defaultVsmProcesses;
    return baseList.map((p) => {
      const merged = { ...p };
      const finalGoodParts = merged.goodParts !== undefined ? merged.goodParts : Math.round((merged.actualQuantity || 900) * ((merged.quality || 98) / 100));
      const finalScrap = merged.scrap !== undefined ? merged.scrap : Math.round((merged.actualQuantity || 900) * (1 - (merged.quality || 98) / 100));
      const calculatedQuality = (finalGoodParts + finalScrap) > 0 
        ? Math.round((finalGoodParts / (finalGoodParts + finalScrap)) * 1000) / 10 
        : (merged.quality || 98);

      const finalShiftHours = merged.shiftHours || Array.from({ length: merged.shifts || 2 }, () => 8);
      const totalHours = finalShiftHours.reduce((sum, h) => sum + h, 0);
      const finalProdTime = totalHours * 60;
      const finalCOTime = merged.changeoverTime || 0;
      const finalBDTime = merged.breakdownTime || merged.downtimeMinutes || 0;
      const finalFPApproval = merged.firstPieceApproval || 0;

      const availTime = finalProdTime - finalCOTime - finalBDTime - finalFPApproval;
      const calculatedAvailability = finalProdTime > 0 
        ? Math.max(0, Math.min(100, Math.round((availTime / finalProdTime) * 1000) / 10)) 
        : (merged.availability || 85);

      const idealCT = merged.idealCycleTime || merged.cycleTime;
      const calculatedPerformance = (availTime > 0 && merged.actualQuantity !== undefined) 
        ? Math.max(0, Math.min(100, Math.round(((merged.actualQuantity * idealCT) / (availTime * 60)) * 1000) / 10)) 
        : (merged.performance || 90);

      const calculatedOee = Math.round((calculatedAvailability * calculatedPerformance * calculatedQuality) / 10000 * 10) / 10;

      const calculatedCapacity = idealCT > 0
        ? Math.round((availTime * 60) / idealCT)
        : (merged.capacity || 1000);

      return {
        ...merged,
        shiftHours: finalShiftHours,
        workingHours: totalHours,
        quality: calculatedQuality,
        availability: calculatedAvailability,
        performance: calculatedPerformance,
        oee: calculatedOee,
        capacity: calculatedCapacity,
        cycleTime: merged.cycleTime,
        downtimeMinutes: finalBDTime,
        goodParts: finalGoodParts,
        scrap: finalScrap
      };
    });
  }, [vsmProcesses, defaultVsmProcesses]);

  const futureProcessesCalculated = useMemo(() => {
    const baseList = vsmProcesses.length > 0 ? vsmProcesses : defaultVsmProcesses;
    return baseList.map((p) => {
      const edits = simulationEdits[p.id] || {};
      const merged = { ...p, ...edits };
      
      const finalGoodParts = merged.goodParts !== undefined ? merged.goodParts : Math.round((merged.actualQuantity || 900) * ((merged.quality || 98) / 100));
      const finalScrap = merged.scrap !== undefined ? merged.scrap : Math.round((merged.actualQuantity || 900) * (1 - (merged.quality || 98) / 100));
      const calculatedQuality = (finalGoodParts + finalScrap) > 0 
        ? Math.round((finalGoodParts / (finalGoodParts + finalScrap)) * 1000) / 10 
        : (merged.quality || 98);

      const finalShiftHours = merged.shiftHours || Array.from({ length: merged.shifts || 2 }, () => 8);
      const totalHours = finalShiftHours.reduce((sum, h) => sum + h, 0);
      const finalProdTime = totalHours * 60;
      const finalCOTime = merged.changeoverTime || 0;
      const finalBDTime = merged.breakdownTime || merged.downtimeMinutes || 0;
      const finalFPApproval = merged.firstPieceApproval || 0;

      const availTime = finalProdTime - finalCOTime - finalBDTime - finalFPApproval;
      const calculatedAvailability = finalProdTime > 0 
        ? Math.max(0, Math.min(100, Math.round((availTime / finalProdTime) * 1000) / 10)) 
        : (merged.availability || 85);

      const idealCT = merged.idealCycleTime || merged.cycleTime;
      const calculatedPerformance = (availTime > 0 && merged.actualQuantity !== undefined) 
        ? Math.max(0, Math.min(100, Math.round(((merged.actualQuantity * idealCT) / (availTime * 60)) * 1000) / 10)) 
        : (merged.performance || 90);

      const calculatedOee = Math.round((calculatedAvailability * calculatedPerformance * calculatedQuality) / 10000 * 10) / 10;

      const calculatedCapacity = idealCT > 0
        ? Math.round((availTime * 60) / idealCT)
        : (merged.capacity || 1000);

      return {
        ...merged,
        shiftHours: finalShiftHours,
        workingHours: totalHours,
        quality: calculatedQuality,
        availability: calculatedAvailability,
        performance: calculatedPerformance,
        oee: calculatedOee,
        capacity: calculatedCapacity,
        cycleTime: merged.cycleTime,
        downtimeMinutes: finalBDTime,
        goodParts: finalGoodParts,
        scrap: finalScrap
      };
    });
  }, [vsmProcesses, defaultVsmProcesses, simulationEdits]);

  // --- DASHBOARD AGGREGATED METRICS & DATA ---
  const dashboardData = useMemo(() => {
    const currWip = currentProcessesCalculated.reduce((sum, p) => sum + p.inventoryBefore, 0);
    const currLeadTime = currentProcessesCalculated.reduce((sum, p) => {
      const invDays = dailyDemand > 0 ? (p.inventoryBefore / dailyDemand) : 0;
      return sum + invDays;
    }, 0);
    const currOees = currentProcessesCalculated.map(p => p.oee);
    const currAvgOee = currentProcessesCalculated.length > 0 
      ? Math.round(currOees.reduce((s, o) => s + o, 0) / currentProcessesCalculated.length * 10) / 10
      : 0;
    
    // Bottleneck detection in Current
    const currBottleneck = currentProcessesCalculated.reduce((worst, current) => {
      return (!worst || current.cycleTime > worst.cycleTime) ? current : worst;
    }, currentProcessesCalculated[0] || null);
    const currBottleneckOee = currBottleneck ? currBottleneck.oee : 0;
    const currAvgAvail = currentProcessesCalculated.length > 0
      ? Math.round(currentProcessesCalculated.reduce((s, p) => s + p.availability, 0) / currentProcessesCalculated.length * 10) / 10
      : 0;
      
    // Future Stats
    const futWip = futureProcessesCalculated.reduce((sum, p) => sum + p.inventoryBefore, 0);
    const futLeadTime = futureProcessesCalculated.reduce((sum, p) => {
      const invDays = dailyDemand > 0 ? (p.inventoryBefore / dailyDemand) : 0;
      return sum + invDays;
    }, 0);
    const futOees = futureProcessesCalculated.map(p => p.oee);
    const futAvgOee = futureProcessesCalculated.length > 0 
      ? Math.round(futOees.reduce((s, o) => s + o, 0) / futureProcessesCalculated.length * 10) / 10
      : 0;
      
    // Bottleneck detection in Future
    const futBottleneck = futureProcessesCalculated.reduce((worst, current) => {
      return (!worst || current.cycleTime > worst.cycleTime) ? current : worst;
    }, futureProcessesCalculated[0] || null);
    const futBottleneckOee = futBottleneck ? futBottleneck.oee : 0;
    const futAvgAvail = futureProcessesCalculated.length > 0
      ? Math.round(futureProcessesCalculated.reduce((s, p) => s + p.availability, 0) / futureProcessesCalculated.length * 10) / 10
      : 0;

    // Waste Cost Current vs Future
    const holdingCostPerWipUnitYearly = factorySetup.holdingCostPerWipYearly || 150;
    const scrapUnitCost = factorySetup.scrapUnitCost || 450;
    const downtimeHourlyCost = factorySetup.downtimeHourlyCost || 2500;

    const currHolding = currWip * holdingCostPerWipUnitYearly;
    const currScrapCost = currentProcessesCalculated.reduce((sum, p) => sum + ((p.actualQuantity ?? p.capacity) * (1 - (p.quality / 100)) * 250 * scrapUnitCost), 0);
    const currDowntimeCost = currentProcessesCalculated.reduce((sum, p) => sum + ((p.downtimeMinutes / 60) * 250 * downtimeHourlyCost), 0);
    const currWasteCostTotal = currHolding + currScrapCost + currDowntimeCost;

    const futHolding = futWip * holdingCostPerWipUnitYearly;
    const futScrapCost = futureProcessesCalculated.reduce((sum, p) => sum + ((p.actualQuantity ?? p.capacity) * (1 - (p.quality / 100)) * 250 * scrapUnitCost), 0);
    const futDowntimeCost = futureProcessesCalculated.reduce((sum, p) => sum + ((p.downtimeMinutes / 60) * 250 * downtimeHourlyCost), 0);
    const futWasteCostTotal = futHolding + futScrapCost + futDowntimeCost;
    
    const annualSavingsTotal = Math.max(0, Math.round(currWasteCostTotal - futWasteCostTotal));

    // Operator Productivity (capacity / operator)
    const currTotalCap = currentProcessesCalculated.reduce((sum, p) => sum + p.capacity, 0);
    const currOperators = currentProcessesCalculated.reduce((sum, p) => sum + p.operatorCount, 0);
    const currOperatorProductivity = currOperators > 0 ? Math.round(currTotalCap / currOperators) : 0;

    const futTotalCap = futureProcessesCalculated.reduce((sum, p) => sum + p.capacity, 0);
    const futOperators = futureProcessesCalculated.reduce((sum, p) => sum + p.operatorCount, 0);
    const futOperatorProductivity = futOperators > 0 ? Math.round(futTotalCap / futOperators) : 0;

    // Transport Distance (simulated based on Kanban and Supermarket counts)
    const currKanbanCount = currentProcessesCalculated.filter(p => p.isKanbanEnabled).length;
    const currSuperCount = currentProcessesCalculated.filter(p => p.isSupermarket).length;
    const futKanbanCount = futureProcessesCalculated.filter(p => p.isKanbanEnabled).length;
    const futSuperCount = futureProcessesCalculated.filter(p => p.isSupermarket).length;
    
    const currTransportDist = 480; // Baseline in meters
    const transportReductionCoeff = Math.min(0.6, (futKanbanCount - currKanbanCount) * 0.08 + (futSuperCount - currSuperCount) * 0.12);
    const futTransportDist = Math.max(120, Math.round(currTransportDist * (1 - Math.max(0, transportReductionCoeff))));

    // Space Utilization (simulated based on Production Model changes)
    const currCellCount = currentProcessesCalculated.filter(p => p.productionModel === "Cell" || p.productionModel === "Assembly Line").length;
    const futCellCount = futureProcessesCalculated.filter(p => p.productionModel === "Cell" || p.productionModel === "Assembly Line").length;
    
    const currSpaceUtil = 55; // 55% space utilization
    const spaceUtilImprovement = Math.min(35, (futCellCount - currCellCount) * 5);
    const futSpaceUtil = Math.min(95, currSpaceUtil + Math.max(0, spaceUtilImprovement));

    // Scrap Reduction data per process
    const scrapChartData = currentProcessesCalculated.map((p, idx) => {
      const futP = futureProcessesCalculated[idx] || p;
      return {
        name: p.name,
        Mevcut: p.scrap || 0,
        Gelecek: futP.scrap || 0
      };
    });

    // Defect (Scrap Rate) Reduction per process
    const defectChartData = currentProcessesCalculated.map((p, idx) => {
      const futP = futureProcessesCalculated[idx] || p;
      const currDefectRate = Math.round((100 - p.quality) * 10) / 10;
      const futDefectRate = Math.round((100 - futP.quality) * 10) / 10;
      return {
        name: p.name,
        Mevcut: currDefectRate,
        Gelecek: futDefectRate
      };
    });

    // Setup Improvement Trend
    const setupChartData = currentProcessesCalculated.map((p, idx) => {
      const futP = futureProcessesCalculated[idx] || p;
      return {
        name: p.name,
        Mevcut: p.changeoverTime || 0,
        Gelecek: futP.changeoverTime || 0
      };
    });

    // VA / Waste Ratio: value-added (processing) time as a share of total Lead Time.
    // The remainder is NVA waste (waiting/holding).
    const currVaSeconds = currentProcessesCalculated.reduce((sum, p) => sum + (p.cycleTime || 0), 0);
    const futVaSeconds = futureProcessesCalculated.reduce((sum, p) => sum + (p.cycleTime || 0), 0);
    const currVaRatio = currLeadTime > 0 ? Math.min(100, Math.round((currVaSeconds / 86400 / currLeadTime) * 1000) / 10) : 0;
    const futVaRatio = futLeadTime > 0 ? Math.min(100, Math.round((futVaSeconds / 86400 / futLeadTime) * 1000) / 10) : 0;

    // Operation Count — under the current data model, Future mode edits existing processes'
    // fields but cannot add/remove operations, so this always equals the Current count. It's
    // still surfaced here (ready to reflect real simplification once that capability exists).
    const currOpCount = currentProcessesCalculated.length;
    const futOpCount = futureProcessesCalculated.length;

    // CT Balance (Yamazumi-style line balance): how close the busiest and lightest stations
    // are to each other. 100% = perfectly balanced line, lower = one station dominates.
    const currCts = currentProcessesCalculated.map(p => p.cycleTime || 0).filter(ct => ct > 0);
    const futCts = futureProcessesCalculated.map(p => p.cycleTime || 0).filter(ct => ct > 0);
    const currCtBalance = currCts.length > 0 ? Math.round((Math.min(...currCts) / Math.max(...currCts)) * 100) : 0;
    const futCtBalance = futCts.length > 0 ? Math.round((Math.min(...futCts) / Math.max(...futCts)) * 100) : 0;

    // Kaizen / CI Theme Count — auto-derived from meaningful Current -> Future deltas per
    // process (headcount reduction, OEE gain, stock/day reduction), per the definition agreed
    // with the customer: each detected improvement type on a process counts as one CI theme.
    const kaizenThemes: { process: string; theme: string; detail: string }[] = [];
    currentProcessesCalculated.forEach((p, idx) => {
      const futP = futureProcessesCalculated[idx];
      if (!futP) return;
      const currInvDays = dailyDemand > 0 ? p.inventoryBefore / dailyDemand : 0;
      const futInvDays = dailyDemand > 0 ? futP.inventoryBefore / dailyDemand : 0;
      if (futP.operatorCount < p.operatorCount) {
        kaizenThemes.push({ process: p.name, theme: "Adam Azaltma", detail: `${p.operatorCount} -> ${futP.operatorCount} operatör` });
      }
      if (futP.oee - p.oee >= 1) {
        kaizenThemes.push({ process: p.name, theme: "Verimlilik (OEE)", detail: `%${p.oee} -> %${futP.oee}` });
      }
      if (currInvDays - futInvDays >= 0.1) {
        kaizenThemes.push({ process: p.name, theme: "Stok Azaltma", detail: `${Math.round(currInvDays * 10) / 10} -> ${Math.round(futInvDays * 10) / 10} gün` });
      }
    });

    return {
      currentWip: currWip,
      futureWip: futWip,
      currentLeadTime: Math.round(currLeadTime * 10) / 10,
      futureLeadTime: Math.round(futLeadTime * 10) / 10,
      currentBottleneckName: currBottleneck ? currBottleneck.name : "N/A",
      futureBottleneckName: futBottleneck ? futBottleneck.name : "N/A",
      currentBottleneckOee: currBottleneckOee,
      futureBottleneckOee: futBottleneckOee,
      currentAvgAvail: currAvgAvail,
      futureAvgAvail: futAvgAvail,
      annualSavings: annualSavingsTotal,
      currentOperatorProductivity: currOperatorProductivity,
      futureOperatorProductivity: futOperatorProductivity,
      currentTransportDist: currTransportDist,
      futureTransportDist: futTransportDist,
      currentSpaceUtil: currSpaceUtil,
      futureSpaceUtil: futSpaceUtil,
      currentBlueCollar: currOperators,
      futureBlueCollar: futOperators,
      currentVaRatio: currVaRatio,
      futureVaRatio: futVaRatio,
      currentOpCount: currOpCount,
      futureOpCount: futOpCount,
      currentCtBalance: currCtBalance,
      futureCtBalance: futCtBalance,
      kaizenThemes,
      scrapChartData,
      defectChartData,
      setupChartData
    };
  }, [currentProcessesCalculated, futureProcessesCalculated, dailyDemand, factorySetup]);

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
  const handleUpdateProcessField = (id: string, field: keyof VsmProcess, value: any) => {
    if (simulationMode === "current") {
      // Editing the actual as-is factory data — this IS the baseline, write it directly.
      setVsmProcesses(prev =>
        prev.map(p => {
          if (p.id !== id) return p;
          if (field === "shifts") {
            const numShifts = Number(value) || 1;
            const currentShiftHours = p.shiftHours || [];
            const newShiftHours = Array.from({ length: numShifts }, (_, idx) =>
              currentShiftHours[idx] !== undefined ? currentShiftHours[idx] : 8
            );
            const totalHours = newShiftHours.reduce((sum, h) => sum + h, 0);
            return { ...p, shifts: numShifts, shiftHours: newShiftHours, workingHours: totalHours };
          } else if (field === "shiftHours") {
            const hoursArray = value as number[];
            const totalHours = hoursArray.reduce((sum, h) => sum + h, 0);
            return { ...p, shiftHours: hoursArray, workingHours: totalHours };
          } else {
            return { ...p, [field]: value };
          }
        })
      );
    } else {
      // Future simulation — record as an overlay edit only. vsmProcesses (Current) is never
      // touched here, so switching back to Current always shows the untouched original data.
      setSimulationEdits(prev => {
        const currentEdit = prev[id] || {};
        let updatedEdit = { ...currentEdit, [field]: value };
        if (field === "shifts") {
          const numShifts = Number(value) || 1;
          const currentShiftHours = (currentEdit.shiftHours || []) as number[];
          const newShiftHours = Array.from({ length: numShifts }, (_, idx) =>
            currentShiftHours[idx] !== undefined ? currentShiftHours[idx] : 8
          );
          const totalHours = newShiftHours.reduce((sum, h) => sum + h, 0);
          updatedEdit = {
            ...updatedEdit,
            shifts: numShifts,
            shiftHours: newShiftHours,
            workingHours: totalHours
          };
        } else if (field === "shiftHours") {
          const hoursArray = value as number[];
          const totalHours = hoursArray.reduce((sum, h) => sum + h, 0);
          updatedEdit = {
            ...updatedEdit,
            shiftHours: hoursArray,
            workingHours: totalHours
          };
        }
        return {
          ...prev,
          [id]: updatedEdit
        };
      });
    }
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

    const captureHeight = isFlowLinear
      ? 640
      : 265 + (vsmGraphLayout.laneCount * (270 + 44)) + 110;

    return domToCanvas(target, {
      scale: 2,
      backgroundColor: vsmBrightMode ? "#f8fafc" : "#0f172a",
      width: 2240,
      height: captureHeight
    });
  };

  const handleTriggerExport = async (format: string) => {
    setExportStatus(`Preparing high resolution ${format} report...`);
    try {
      if (format === "Excel") {
        // Create direct CSV download of VSM data
        const header = "Process Name,Cycle Time (CT),OEE (%),Availability,Performance,Quality,Capacity,WIP Inventory,WIP Days,Is Kanban\n";
        const rows = processesWithTimeline.map(p =>
          `"${p.name}",${p.cycleTime},${p.oee},${p.availability},${p.performance},${p.quality},${p.capacity},${p.inventoryBefore},${p.inventoryDays},${p.isKanbanEnabled ? 'YES' : 'NO'}`
        ).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `VSM_Report_${selectedCustomer?.companyName || "Factory"}.csv`);
        link.click();
        URL.revokeObjectURL(url);
      } else if (format === "High Res PNG") {
        const canvas = await captureVsmMapCanvas();
        const link = document.createElement("a");
        link.setAttribute("download", `VSM_Sema_${selectedProject?.name || "Proje"}.png`);
        link.setAttribute("href", canvas.toDataURL("image/png", 1.0));
        link.click();
      } else if (format === "PDF Report") {
        const canvas = await captureVsmMapCanvas();
        const imgData = canvas.toDataURL("image/png", 1.0);
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`VSM_Rapor_${selectedProject?.name || "Proje"}.pdf`);
      }
    } catch (err) {
      alert("Export sırasında bir hata oluştu. Lütfen tekrar deneyin.");
      console.error("VSM export error:", err);
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
      type: "Semi Automatic",
      productionModel: "Assembly Line",
      machineCount: 1,
      operatorCount: 2,
      shifts: 2,
      shiftHours: [8, 8],
      workingHours: 16,
      cycleTime: 60,
      oee: 80,
      availability: 90,
      performance: 95,
      quality: 98,
      capacity: 1000,
      downtimeMinutes: 10,
      inventoryBefore: 200,
      isKanbanEnabled: false,
      isSupermarket: false,
      notes: "Yeni proses tanımlandı.",
      kaizenOpp: "İyileştirme fırsatı araştırılacak.",
      planningFrequency: "Weekly",
      plannedQuantity: 1000,
      actualQuantity: 900,
      idealCycleTime: 55,
      productionTime: 960,
      changeoverTime: 15,
      changeoverFrequency: "1/Vardiya",
      firstPieceApproval: 5,
      breakdownTime: 10,
      waitingTime: 10,
      minorStops: 5,
      goodParts: 882,
      scrap: 18,
      rework: 10,
      wipQuantity: 200,
      inventoryBetweenProcesses: 200
    };
    setVsmProcesses(prev => [...prev, newProcess]);
  };

  const handleDeleteProcess = (id: string) => {
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
      biggestImprovement: `Darboğaz istasyonu olan "${dashboardData.currentBottleneckName}" operasyonunda verimliliğin %${dashboardData.currentBottleneckOee}'den %${dashboardData.futureBottleneckOee}'ye çıkarılmasıyla hat hızı arttırıldı ve kapasite limiti genişletildi.`,
      leadTimeReduction: `Ara stok (WIP) seviyelerindeki %${wipRed} oranındaki agresif düşüş sayesinde, toplam değer akış süresi (Lead Time) ${dashboardData.currentLeadTime} günden ${dashboardData.futureLeadTime} güne indirildi (-%${ltRed}).`,
      qualityImpact: qualGain > 0 
        ? `Süreç içi hata önleme (Poka-Yoke) ve Kanban uygulamaları ile ortalama ürün kalitesi (FPY) %${qualGain.toFixed(1)} oranında iyileştirilerek hurda/fire maliyetlerinde ciddi tasarruf sağlandı.`
        : `Kalite oranları tescil edilerek fire kaynaklı malzeme erozyonları asgari düzeye indirildi.`,
      annualSavingsDesc: `Uygulanan yalın üretim dönüşüm aksiyonları sonucunda, işletmenizde yıllık toplam ${companyCurrency}${savings.toLocaleString()} tutarında kayıp maliyet elenmesi ve doğrudan kârlılık artışı öngörülmektedir.`
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

  if (!selectedProject) {
    const activeCount = projects.filter(p => p.status === "Aktif").length;
    const completedCount = projects.filter(p => p.status === "Tamamlandı").length;
    const suspendedCount = projects.filter(p => p.status === "Askıda").length;
    const companyCurrency = selectedCustomer?.currency || "₺";

    const totalSavings = projects.reduce((acc, p) => {
      const val = p.status === "Tamamlandı" ? 85000 : (p.status === "Aktif" ? 45000 : 15000);
      return acc + val;
    }, 0);

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
                VSM PORTAL
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <GitCommit className="w-6 h-6 text-slate-800 animate-pulse" />
              VSM Proje Portalı &amp; Yolculuk Paneli
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {selectedCustomer?.companyName || "Müşteri"} fabrikası için tanımlanmış değer akış çalışmaları ve kümülatif kazanımlar.
            </p>
          </div>
          <button 
            onClick={handleOpenNewProjectModal}
            className="flex items-center space-x-2 bg-slate-950 text-white hover:bg-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md shadow-slate-100"
            id="btn_create_project"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni VSM Projesi</span>
          </button>
        </div>

        {/* TRANSFORMATION JOURNEY DASHBOARD (Bento Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5" id="transformation_journey_bento">
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

          <div className="bg-slate-950 text-white rounded-2xl p-5 shadow-lg shadow-slate-100 flex flex-col justify-between h-32 lg:col-span-2" id="card_financial_savings">
            <div className="space-y-1">
              <span className="text-[10px] text-amber-400 font-mono font-bold uppercase block tracking-wider">KÜMÜLATİF MALİ YALIN KAZANIM</span>
              <span className="text-3xl font-mono font-black text-amber-400">{totalSavings.toLocaleString()} {companyCurrency} <span className="text-xs text-white">/ yıl</span></span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Değer akışı israf azaltımından elde edilen tasarruf</span>
            </div>
          </div>
        </div>

        {/* TRANSFORMATION PROGRESS ROADMAP SUMMARY */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-6" id="transformation_milestone_summary">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">MÜŞTERİ YALIN DÖNÜŞÜM OLGUNLUĞU</h3>
            <p className="text-[11px] text-slate-500">Kümülatif değer akışı israf seviyeleri, bekleme süreleri ve OEE optimizasyon tescil durumu.</p>
          </div>
          <div className="flex flex-wrap gap-8 items-center justify-center">
            <div className="text-center">
              <span className="text-xs font-bold text-slate-400 block uppercase font-mono">ORT. LEAD TIME İYİLEŞME</span>
              <span className="text-xl font-mono font-black text-indigo-600">%41.2 <span className="text-xs text-slate-400 font-normal">Azalış</span></span>
            </div>
            <div className="text-center">
              <span className="text-xs font-bold text-slate-400 block uppercase font-mono">ORT. WIP (STOK) DÜŞÜŞÜ</span>
              <span className="text-xl font-mono font-black text-emerald-600">%38.5 <span className="text-xs text-slate-400 font-normal">Azalış</span></span>
            </div>
            <div className="text-center">
              <span className="text-xs font-bold text-slate-400 block uppercase font-mono">KAPASİTE ARTIŞI (TEORİK)</span>
              <span className="text-xl font-mono font-black text-amber-600">%18.7 <span className="text-xs text-slate-400 font-normal">Artış</span></span>
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
                            <button 
                              onClick={(e) => handleDeleteProject(proj.id, e)}
                              className="p-1.5 border border-red-150 bg-white hover:bg-red-50 rounded-lg text-red-500 hover:text-red-700 transition cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

  return (
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
      {activeTab === "setup" && (
        <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
          
          {/* 1. KPI TABLOSU VE KAPASİTE GÖSTERGELERİ (KURULUM PARAMETRELERİNİN ÜZERİNE TAŞINDI) */}
          <div className="space-y-4" id="vsm_kpi_table_section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <span>Kapasite &amp; Takt Zamanı Temel Gösterge Tablosu (KPI Table)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fabrika kurulum parametreleri ve ürün hacim payına göre anlık hesaplanan temel kapasite, takt ve maliyet kayıp verileri.
                </p>
              </div>
              <span className="text-xs font-mono font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-auto shadow-2xs">
                Ürün Hacim Payı: %{factorySetup.productVolumeShare ?? 30}
              </span>
            </div>

            {/* KPI CARDS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <div className="bg-slate-950 text-white rounded-2xl p-4 border border-slate-800 space-y-1 shadow-xs">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase block">GÜNLÜK TALEP</span>
                <div className="text-2xl font-mono font-black text-amber-400">
                  {dailyDemand} <span className="text-xs font-normal text-slate-300">adet/gün</span>
                </div>
                <p className="text-[10px] text-slate-400">Haftalık {weeklyDemand} / {workingDays} gün</p>
              </div>

              <div className="bg-indigo-950 text-white rounded-2xl p-4 border border-indigo-900 space-y-1 shadow-xs">
                <span className="text-[10px] text-indigo-300 font-mono font-bold uppercase block">ÜRÜN HACİM PAYI</span>
                <div className="text-2xl font-mono font-black text-indigo-200">
                  %{factorySetup.productVolumeShare ?? 30}
                </div>
                <p className="text-[10px] text-indigo-300 truncate">Fabrika Geneli: ~{Math.round(dailyDemand / ((factorySetup.productVolumeShare || 30) / 100)).toLocaleString()} ad/gün</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-xs">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase block">TEMİZ SÜRE / VARDİYA</span>
                <div className="text-2xl font-mono font-black text-slate-900">
                  {((factorySetup.shiftDuration * 60) - factorySetup.breakTimes - factorySetup.plannedMaintenance)} <span className="text-xs font-normal text-slate-500">dk</span>
                </div>
                <p className="text-[10px] text-slate-500">Molalar &amp; Bakım düşülmüş</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-xs">
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase block">GÜNLÜK NET SÜRE</span>
                <div className="text-2xl font-mono font-black text-slate-900">
                  {netAvailableSecondsPerDay.toLocaleString()} <span className="text-xs font-normal text-slate-500">sn</span>
                </div>
                <p className="text-[10px] text-slate-500">Net çalışma saniye havuzu</p>
              </div>

              <div className="bg-amber-600 text-white rounded-2xl p-4 shadow-md shadow-amber-50 space-y-1">
                <span className="text-[10px] text-amber-100 font-mono font-bold uppercase block">TAKTI ZAMANI (TAKT)</span>
                <div className="text-2xl font-mono font-black text-white">
                  {taktTime} <span className="text-xs font-semibold text-amber-100">sn/ad</span>
                </div>
                <p className="text-[10px] text-amber-50">Hedef çıkış ritmi</p>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-1 shadow-xs">
                <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase block">ÜRÜN KAYIP MALİYETİ</span>
                <div className="text-xl font-mono font-black text-emerald-400 truncate">
                  {companyCurrency}{estimatedAnnualWasteCost.toLocaleString()}
                </div>
                <p className="text-[10px] text-slate-400">Yıllık tahsis edilen israf</p>
              </div>
            </div>

            {/* DETAILED KPI METRICS SUMMARY TABLE */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-600" />
                  <span>Kapasite &amp; İsraf Kayıp Analizi KPI Özet Tablosu</span>
                </h3>
                <span className="text-[11px] text-indigo-600 font-bold font-mono">Otomatik Dinamik Model</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-500 font-bold border-b border-slate-200 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Performans Metriği (KPI)</th>
                      <th className="py-2.5 px-4 text-center">İlgili Ürün Adet/Süre</th>
                      <th className="py-2.5 px-4 text-center">Ürünün Hacim Payı</th>
                      <th className="py-2.5 px-4 text-center">Fabrika Geneli Toplam Hacim</th>
                      <th className="py-2.5 px-4 text-right">Analitik Etki &amp; Açıklama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-xs">
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Günlük Üretim Talebi</span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-amber-600">{dailyDemand} adet/gün</td>
                      <td className="py-2.5 px-4 text-center font-mono font-extrabold text-indigo-700 bg-indigo-50/70 rounded-lg">%{factorySetup.productVolumeShare ?? 30}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">~{Math.round(dailyDemand / ((factorySetup.productVolumeShare || 30) / 100)).toLocaleString()} adet/gün</td>
                      <td className="py-2.5 px-4 text-right text-slate-500 text-[11px]">Haftalık {weeklyDemand} talebe göre hesaplanmıştır</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span>Takt Zamanı (Takt Time)</span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-amber-600">{taktTime} sn/adet</td>
                      <td className="py-2.5 px-4 text-center font-mono text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-700">{netAvailableSecondsPerDay.toLocaleString()} sn net süre</td>
                      <td className="py-2.5 px-4 text-right text-slate-500 text-[11px]">Müşteri talep ritmi gereksinimi</td>
                    </tr>
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Yıllık İsraf &amp; Kayıp Maliyeti Tahsisi</span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-600">{companyCurrency}{estimatedAnnualWasteCost.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-extrabold text-indigo-700 bg-indigo-50/70 rounded-lg">%{factorySetup.productVolumeShare ?? 30} Pay</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-900">{companyCurrency}{Math.round(estimatedAnnualWasteCost / ((factorySetup.productVolumeShare || 30) / 100)).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right text-slate-500 text-[11px]">Hurda, bekleme, stok taşıma kayıpları</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 2. FABRİKA SEVİYESİ KURULUM PARAMETRELERİ (ŞİMDİ KPI TABLOSUNUN ALTINDA YER ALIYOR) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4" id="vsm_setup_parameters_section">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-4">
              <Building2 className="w-5 h-5 text-slate-800" />
              <h2 className="text-base font-extrabold text-slate-900">Fabrika Seviyesi Kurulum Parametreleri</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Müşteri / Fabrika Adı</label>
                <input 
                  type="text" 
                  value={factorySetup.customerName}
                  onChange={e => setFactorySetup(p => ({ ...p, customerName: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Ürün Ailesi (Product Family)</label>
                <input 
                  type="text" 
                  value={factorySetup.productFamily}
                  onChange={e => setFactorySetup(p => ({ ...p, productFamily: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>

              {/* YENİ FİELD: İLGİLİ ÜRÜNÜN FABRİKA TOPLAM ÜRÜN ADETLERİ İÇERİSİNDEKİ PAYI (% 30) */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-slate-800 block">
                  <span>Ürünün Fabrika Üretimindeki Payı (%) *</span>
                </label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1"
                    max="100"
                    value={factorySetup.productVolumeShare ?? 30}
                    onChange={e => setFactorySetup(p => ({ ...p, productVolumeShare: Number(e.target.value) }))}
                    className="w-full bg-indigo-50/30 border border-indigo-200 focus:border-indigo-600 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-hidden transition-all font-mono"
                    placeholder="30"
                  />
                  <span className="absolute right-3 top-2 text-xs font-black text-indigo-600 font-mono">%</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  İlgili ürünün fabrikanın toplam ürün adetleri içerisindeki payı (Kapasiteyi ve maliyetlerdeki kayıpları anlamak için kritik veri).
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Haftalık Talep (Weekly Demand)</label>
                <input 
                  type="number" 
                  value={factorySetup.weeklyDemand}
                  onChange={e => setFactorySetup(p => ({ ...p, weeklyDemand: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Haftalık Çalışma Günü</label>
                <input 
                  type="number" 
                  value={factorySetup.workingDays}
                  onChange={e => setFactorySetup(p => ({ ...p, workingDays: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Vardiya Yapısı (Shift Structure)</label>
                <input 
                  type="text" 
                  value={factorySetup.shiftStructure}
                  onChange={e => setFactorySetup(p => ({ ...p, shiftStructure: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Vardiya Süresi (Saat)</label>
                <input 
                  type="number" 
                  value={factorySetup.shiftDuration}
                  onChange={e => setFactorySetup(p => ({ ...p, shiftDuration: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Planlı Molalar (Dakika / Vardiya)</label>
                <input 
                  type="number" 
                  value={factorySetup.breakTimes}
                  onChange={e => setFactorySetup(p => ({ ...p, breakTimes: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Planlı Bakımlar (Dakika / Vardiya)</label>
                <input 
                  type="number" 
                  value={factorySetup.plannedMaintenance}
                  onChange={e => setFactorySetup(p => ({ ...p, plannedMaintenance: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 block">Sevk Sıklığı (Shipping Frequency)</label>
                <input 
                  type="text" 
                  value={factorySetup.shippingFrequency}
                  onChange={e => setFactorySetup(p => ({ ...p, shippingFrequency: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-950 outline-hidden"
                />
              </div>
            </div>

            {/* FINANCIAL & WASTE UNIT COST PARAMETERS SECTION */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider">İsraf &amp; Finansal Birim Maliyet Parametreleri (Finansal Veri Modeli)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block flex items-center justify-between">
                    <span>Hurda / Iskarta Birim Maliyeti ({companyCurrency}/adet)</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">Örnek: 450 {companyCurrency}</span>
                  </label>
                  <input 
                    type="number" 
                    value={factorySetup.scrapUnitCost}
                    onChange={e => setFactorySetup(p => ({ ...p, scrapUnitCost: Number(e.target.value) }))}
                    className="w-full bg-emerald-50/30 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500">
                    Proseslerdeki hurda ve tamir edilen hatalı ürünlerin birim maliyet kaybı.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block flex items-center justify-between">
                    <span>WIP Stok Birim Maliyeti ({companyCurrency}/adet/yıl)</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">Örnek: 150 {companyCurrency}</span>
                  </label>
                  <input
                    type="number"
                    value={factorySetup.holdingCostPerWipYearly}
                    onChange={e => setFactorySetup(p => ({ ...p, holdingCostPerWipYearly: Number(e.target.value) }))}
                    className="w-full bg-emerald-50/30 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500">
                    Prosesler arası ara stokların (WIP) 1 adedinin yıllık sermaye bağlama ve alan/depo maliyeti — bu birim maliyet, VSM'de hesaplanan toplam WIP adediyle çarpılarak toplam stok maliyetini verir.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block flex items-center justify-between">
                    <span>Saatlik Duruş Kayıp Maliyeti ({companyCurrency}/saat)</span>
                    <span className="text-[10px] text-emerald-600 font-mono font-bold">Örnek: 2500 {companyCurrency}</span>
                  </label>
                  <input 
                    type="number" 
                    value={factorySetup.downtimeHourlyCost}
                    onChange={e => setFactorySetup(p => ({ ...p, downtimeHourlyCost: Number(e.target.value) }))}
                    className="w-full bg-emerald-50/30 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500">
                    Plansız makine arızaları ve uzun kalıp değişimlerinin (setup) saatlik duruş maliyeti.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2 — PROSES TANIMLAMA */}
      {activeTab === "definition" && (
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
                      <button 
                        onClick={() => handleDeleteProcess(p.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Prosesi Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
      )}

      {/* TAB 3 — ÜRETİM & KAPASİTE */}
      {activeTab === "production" && (
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
                          value={p.plannedQuantity ?? 1000}
                          onChange={e => handleUpdateProcessField(p.id, "plannedQuantity", Number(e.target.value))}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <input
                            type="number"
                            value={p.actualQuantity ?? 900}
                            onChange={e => handleUpdateProcessField(p.id, "actualQuantity", Number(e.target.value))}
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
                          onChange={e => handleUpdateProcessField(p.id, "idealCycleTime", Number(e.target.value))}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={p.changeoverTime ?? 0}
                          onChange={e => handleUpdateProcessField(p.id, "changeoverTime", Number(e.target.value))}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={p.breakdownTime ?? 0}
                          onChange={e => handleUpdateProcessField(p.id, "breakdownTime", Number(e.target.value))}
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
        </div>
      )}

      {/* TAB 4 — KALİTE & ENVANTER */}
      {activeTab === "quality" && (
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
                  <th className="p-4 text-center w-28">Sağlam Adet (Good)</th>
                  <th className="p-4 text-center w-28">Hurda / Fire (Scrap)</th>
                  <th className="p-4 text-center w-28">Yeniden İşlem (Rework)</th>
                  <th className="p-4 text-center w-28">Kalite Oranı FPY</th>
                  <th className="p-4 text-center w-28">Ara Stok WIP (Adet)</th>
                  <th className="p-4 text-center w-28">Stok Bekleme Günü</th>
                  <th className="p-4 text-center w-28">Kanban Sinyali</th>
                  <th className="p-4 text-center w-28">Süpermarket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {activeProcesses.map((p, idx) => {
                  const actual = p.actualQuantity || 900;
                  const scrapVal = p.scrap ?? 10;
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
                          onChange={e => handleUpdateProcessField(p.id, "goodParts", Number(e.target.value))}
                          className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={scrapVal}
                          onChange={e => handleUpdateProcessField(p.id, "scrap", Number(e.target.value))}
                          className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          value={p.rework ?? 5}
                          onChange={e => handleUpdateProcessField(p.id, "rework", Number(e.target.value))}
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
                        <button 
                          onClick={() => handleUpdateProcessField(p.id, "isSupermarket", !isSuper)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                            isSuper 
                              ? "bg-amber-100 text-amber-800 border border-amber-200" 
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {isSuper ? "VAR" : "YOK"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5 — DEĞER AKIŞ ŞEMASI (MAP VISUALIZATION) */}
      {activeTab === "vsm" && (
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
                {!simulationComparison.hasEdits && (
                  <button
                    onClick={handleApplyLeanSimulation}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition shadow-sm flex items-center space-x-1.5 cursor-pointer"
                    title="Standart Yalın Dönüşüm Senaryosunu Otomatik Yükle (%50 SMED, %50 Stok Düşüşü, %65 Duruş Önleme)"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-200" />
                    <span>⚡ Yalın Gelecek Durum Şablonu Uygula</span>
                  </button>
                )}
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase font-mono">Lead Time Azalışı</span>
                  <span className="text-emerald-700 font-extrabold text-sm font-mono">-{simulationComparison.leadTimeReduction}%</span>
                </div>
                <div className="border-l border-amber-200 pl-6 flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase font-mono">Ara Stok (WIP) Azalışı</span>
                  <span className="text-emerald-700 font-extrabold text-sm font-mono">-{simulationComparison.inventoryReduction}%</span>
                </div>
                <div className="border-l border-amber-200 pl-6 flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase font-mono">İşçilik Verimi</span>
                  <span className="text-emerald-700 font-extrabold text-sm font-mono">+{simulationComparison.capacityIncrease}%</span>
                </div>
                <div className="border-l border-amber-200 pl-6 flex flex-col">
                  <span className="text-slate-500 text-[10px] uppercase font-mono">Sürdürülebilirlik CO₂</span>
                  <span className="text-emerald-700 font-extrabold text-sm font-mono">-{simulationComparison.co2Reduction}%</span>
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
                    <p className={`text-[10px] ${vsmBrightMode ? 'text-slate-500' : 'text-slate-400'} truncate max-w-[160px]`}>{selectedCustomer?.companyName || "Beko Global"}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Ürün Ailesi:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{selectedCustomer?.productionType || "Isıtıcı Grubu"}</span>
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
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">{taktTime} sn</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sevk Sıklığı:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>Günlük (Daily)</span>
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
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Süreç Yönetimi</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>Yarı-Haftalık</span>
                  </div>
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Planlama Sıklığı</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>Haftalık Dağıtım</span>
                  </div>
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sıralama Rejimi</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>FIFO & Kanban</span>
                  </div>
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Üretim Takvimi</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>5 Gün - 2 Vardiya</span>
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
                    <p className={`text-[10px] ${vsmBrightMode ? 'text-slate-500' : 'text-slate-400'} truncate max-w-[160px]`}>{selectedCustomer?.companyName ? selectedCustomer.companyName + " Tedarikçisi" : "Ereğli Demir Çelik A.Ş."}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Malzeme Rejimi:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>Rulo Sac / Profil</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sevk Sıklığı:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>Haftada 2 Sefer</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Parti Büyüklüğü:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>3000 Kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Tedarik Temin:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>3 Gün (Lead Time)</span>
                  </div>
                  <div className={`flex justify-between border-t ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pt-1.5 mt-1.5`}>
                    <span className={vsmBrightMode ? 'text-slate-500 font-bold' : 'text-slate-400 font-bold'}>Lojistik Yöntemi:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">Truck Milk-Run</span>
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
              Müşteri: {selectedCustomer?.companyName || "Beko Global"} • Sektör: {selectedCustomer?.industry || "Beyaz Eşya"}
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
    )}

    {/* ========================================== */}
    {/* TAB 6 — VSM REAL-TIME COMPARATIVE DASHBOARD */}
    {/* ========================================== */}
    {activeTab === "dashboard" && (
      <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans" id="vsm_dashboard_panel">
        
        {/* HEADER ROW WITH SIMULATION MODE CONTROL IN DASHBOARD TOO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-wider font-mono">VSM EXECUTIVE REPORT</span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight mt-1">Yalın Değer Akışı Simülasyon Analiz Paneli</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fabrika mevcut durum (baseline) verileri ile gelecek yalın durum simülasyonunun karşılaştırmalı analizi</p>
          </div>
          
          <div className="bg-indigo-950/80 border border-indigo-800/80 px-4 py-2 rounded-xl flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-indigo-200">
              Mevcut (Baseline) vs Gelecek Durum (Simülasyon) Yan Yana Karşılaştırma
            </span>
          </div>
        </div>

        {/* FIRST ROW: PRIMARY HIGH-IMPACT KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* KPI 1: Bottleneck OEE */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200 relative overflow-hidden" id="kpi_bottleneck_oee">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Darboğaz OEE verimi</span>
                <div className="flex items-baseline space-x-2 mt-2">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">{dashboardData.futureBottleneckOee}%</span>
                  <span className="text-xs text-slate-400 line-through font-mono">{dashboardData.currentBottleneckOee}%</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Değişim Oranı</span>
              {dashboardData.futureBottleneckOee >= dashboardData.currentBottleneckOee ? (
                <span className="text-emerald-600 font-extrabold flex items-center bg-emerald-50 px-2 py-0.5 rounded-full">
                  <ArrowUp className="w-3 h-3 mr-0.5" />
                  +{Math.round((dashboardData.futureBottleneckOee - dashboardData.currentBottleneckOee) * 10) / 10}%
                </span>
              ) : (
                <span className="text-rose-600 font-extrabold flex items-center bg-rose-50 px-2 py-0.5 rounded-full">
                  <ArrowDown className="w-3 h-3 mr-0.5" />
                  {Math.round((dashboardData.futureBottleneckOee - dashboardData.currentBottleneckOee) * 10) / 10}%
                </span>
              )}
            </div>
          </div>

          {/* KPI 2: Average Availability */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200 relative overflow-hidden" id="kpi_availability">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Ort. Kullanılabilirlik</span>
                <div className="flex items-baseline space-x-2 mt-2">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">{dashboardData.futureAvgAvail}%</span>
                  <span className="text-xs text-slate-400 line-through font-mono">{dashboardData.currentAvgAvail}%</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Değişim Oranı</span>
              {dashboardData.futureAvgAvail >= dashboardData.currentAvgAvail ? (
                <span className="text-emerald-600 font-extrabold flex items-center bg-emerald-50 px-2 py-0.5 rounded-full">
                  <ArrowUp className="w-3 h-3 mr-0.5" />
                  +{Math.round((dashboardData.futureAvgAvail - dashboardData.currentAvgAvail) * 10) / 10}%
                </span>
              ) : (
                <span className="text-rose-600 font-extrabold flex items-center bg-rose-50 px-2 py-0.5 rounded-full">
                  <ArrowDown className="w-3 h-3 mr-0.5" />
                  {Math.round((dashboardData.futureAvgAvail - dashboardData.currentAvgAvail) * 10) / 10}%
                </span>
              )}
            </div>
          </div>

          {/* KPI 3: Total Lead Time */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200 relative overflow-hidden" id="kpi_leadtime">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Değer Akış Süresi (LT)</span>
                <div className="flex items-baseline space-x-2 mt-2">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">{dashboardData.futureLeadTime} G</span>
                  <span className="text-xs text-slate-400 line-through font-mono">{dashboardData.currentLeadTime} G</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Termin İyileşmesi</span>
              {dashboardData.futureLeadTime <= dashboardData.currentLeadTime ? (
                <span className="text-emerald-600 font-extrabold flex items-center bg-emerald-50 px-2 py-0.5 rounded-full">
                  <ArrowDown className="w-3 h-3 mr-0.5" />
                  -{Math.round(((dashboardData.currentLeadTime - dashboardData.futureLeadTime) / (dashboardData.currentLeadTime || 1)) * 100)}%
                </span>
              ) : (
                <span className="text-rose-600 font-extrabold flex items-center bg-rose-50 px-2 py-0.5 rounded-full">
                  <ArrowUp className="w-3 h-3 mr-0.5" />
                  +{Math.round(((dashboardData.futureLeadTime - dashboardData.currentLeadTime) / (dashboardData.currentLeadTime || 1)) * 100)}%
                </span>
              )}
            </div>
          </div>

          {/* KPI 4: Hero Annual Savings */}
          <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md relative overflow-hidden text-white" id="kpi_annual_savings">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl" />
            <div className="flex justify-between items-start relative z-10">
              <div>
                <span className="text-[10px] uppercase text-indigo-300 font-bold font-mono tracking-wider block">Yıllık Kayıp Tasarrufu</span>
                <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight mt-2.5">
                  {companyCurrency}{dashboardData.annualSavings.toLocaleString()}
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-indigo-900/40 flex items-center justify-between text-xs relative z-10">
              <span className="text-slate-400 font-medium">Finansal Etki Sınıfı</span>
              <span className="text-emerald-400 font-extrabold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg text-[10px] tracking-wider uppercase font-mono">
                EXECUTIVE VALUE
              </span>
            </div>
          </div>
        </div>

        {/* GAUGES PANEL: speedometer for bottleneck, half-donut for availability */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Speedometer Gauge for Bottleneck */}
          {drawSpeedometer(dashboardData.futureBottleneckOee, `Darboğaz İstasyonu OEE Gecikme Sınırı (${dashboardData.futureBottleneckName})`)}
          
          {/* Half Donut Gauge for Availability */}
          {drawHalfDonut(dashboardData.futureAvgAvail, "Hat Boyunca Ortalama Çalışabilirlik Kapasitesi")}
        </div>

        {/* SECOND ROW: DETAILED HISTOGRAM AND TREND CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CHART 1: Lead Time reduction per Station */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-80" id="chart_leadtime_reduction">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">Değer Akış ve Çevrim Süresi (Lead Time)</h4>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">sn / istasyon</span>
            </div>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentProcessesCalculated.map((p, idx) => ({
                  name: p.name.split(" ")[0],
                  Mevcut: p.cycleTime,
                  Gelecek: (futureProcessesCalculated[idx] || p).cycleTime
                }))} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Mevcut" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gelecek" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 2: Setup (Changeover) improvement trend */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-80" id="chart_setup_improvements">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">Setup (Değişim) Süresi İyileşme Eğrisi</h4>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">dk / istasyon</span>
            </div>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboardData.setupChartData.map(d => ({
                  name: d.name.split(" ")[0],
                  Mevcut: d.Mevcut,
                  Gelecek: d.Gelecek
                }))} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="Mevcut" stroke="#94a3b8" strokeWidth={2} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Gelecek" stroke="#4f46e5" strokeWidth={3} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 3: Scrap reduction comparison */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-80" id="chart_scrap_reduction">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">Süreç İçi Fire (Scrap) Adet Karşılaştırması</h4>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Adet / Gün</span>
            </div>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.scrapChartData.map(d => ({
                  name: d.name.split(" ")[0],
                  Mevcut: d.Mevcut,
                  Gelecek: d.Gelecek
                }))} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Mevcut" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gelecek" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* THIRD ROW: DEFECT REDUCTION CHART AND ADDITIONAL KPIS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Defect reduction chart */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-80 lg:col-span-1" id="chart_defect_reduction">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">İstasyon Bazlı Hata Oranı (% Defect Rate)</h4>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">FPY Kaybı %</span>
            </div>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.defectChartData.map(d => ({
                  name: d.name.split(" ")[0],
                  Mevcut: d.Mevcut,
                  Gelecek: d.Gelecek
                }))} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Mevcut" fill="#fecdd3" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gelecek" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ADDITIONAL KPI CARDS (WIP reduction, Operator Productivity, Transport Distance, Space Util) */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
            
            {/* WIP Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_wip_reduction">
              <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">WIP (Ara Stok) Toplamı</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{dashboardData.futureWip} Adet</span>
                <span className="text-xs text-slate-400 line-through font-mono">{dashboardData.currentWip} Adet</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Toplam Stok Düşüşü</span>
                <span className="text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full">
                  -{Math.max(0, Math.round(((dashboardData.currentWip - dashboardData.futureWip) / (dashboardData.currentWip || 1)) * 100))}%
                </span>
              </div>
            </div>

            {/* Operator Productivity Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_operator_productivity">
              <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Operatör Başına Çıktı</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{dashboardData.futureOperatorProductivity} birim</span>
                <span className="text-xs text-slate-400 line-through font-mono">{dashboardData.currentOperatorProductivity} birim</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Verimlilik Artışı</span>
                <span className="text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full">
                  +{Math.max(0, Math.round(((dashboardData.futureOperatorProductivity - dashboardData.currentOperatorProductivity) / (dashboardData.currentOperatorProductivity || 1)) * 100))}%
                </span>
              </div>
            </div>

            {/* Transport Distance Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_transport_reduction">
              <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Yıllık İç Lojistik Taşıma Mesafesi</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{dashboardData.futureTransportDist} m</span>
                <span className="text-xs text-slate-400 line-through font-mono">{dashboardData.currentTransportDist} m</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Lojistik Israf Azalışı</span>
                <span className="text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full">
                  -{Math.max(0, Math.round(((dashboardData.currentTransportDist - dashboardData.futureTransportDist) / (dashboardData.currentTransportDist || 1)) * 100))}%
                </span>
              </div>
            </div>

            {/* Space Utilization Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_space_utilization">
              <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Fabrika Alanı Yerleşim Verimi</span>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{dashboardData.futureSpaceUtil}%</span>
                <span className="text-xs text-slate-400 line-through font-mono">{dashboardData.currentSpaceUtil}%</span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">M2 Başına Yoğunluk</span>
                <span className="text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full">
                  +{Math.max(0, Math.round(((dashboardData.futureSpaceUtil - dashboardData.currentSpaceUtil) / (dashboardData.currentSpaceUtil || 1)) * 100))}%
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* FOURTH ROW: WORKFORCE, FLOW & CI PROGRAM KPIS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5" id="vsm_dashboard_extra_kpis">

          {/* Blue-Collar Headcount Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_blue_collar_headcount">
            <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Mavi Yaka Sayısı (Operatör)</span>
            <div className="flex items-baseline space-x-2 mt-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{dashboardData.futureBlueCollar}</span>
              <span className="text-xs text-slate-400 line-through font-mono">{dashboardData.currentBlueCollar}</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">İşgücü Değişimi</span>
              {dashboardData.futureBlueCollar <= dashboardData.currentBlueCollar ? (
                <span className="text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full">
                  -{Math.max(0, Math.round(((dashboardData.currentBlueCollar - dashboardData.futureBlueCollar) / (dashboardData.currentBlueCollar || 1)) * 100))}%
                </span>
              ) : (
                <span className="text-rose-600 font-extrabold bg-rose-50 px-2 py-0.5 rounded-full">
                  +{Math.round(((dashboardData.futureBlueCollar - dashboardData.currentBlueCollar) / (dashboardData.currentBlueCollar || 1)) * 100)}%
                </span>
              )}
            </div>
          </div>

          {/* VA / Waste Ratio Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_va_waste_ratio">
            <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Katma Değer (VA) Oranı</span>
            <div className="flex items-baseline space-x-2 mt-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">%{dashboardData.futureVaRatio}</span>
              <span className="text-xs text-slate-400 line-through font-mono">%{dashboardData.currentVaRatio}</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">İsraf (NVA) Payı</span>
              <span className="text-slate-700 font-extrabold bg-slate-100 px-2 py-0.5 rounded-full">
                %{Math.round((100 - dashboardData.futureVaRatio) * 10) / 10}
              </span>
            </div>
          </div>

          {/* Takt Time Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_takt_time_dashboard">
            <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Takt Zamanı (Müşteri Talebi)</span>
            <div className="flex items-baseline space-x-2 mt-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{taktTime} sn</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Darboğaz Çevrimi (Gelecek)</span>
              <span className={`font-extrabold px-2 py-0.5 rounded-full ${dashboardData.futureBottleneckOee > 0 && futureProcessesCalculated.some(p => p.cycleTime > taktTime) ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                {futureProcessesCalculated.length > 0 ? Math.max(...futureProcessesCalculated.map(p => p.cycleTime || 0)) : 0} sn
              </span>
            </div>
          </div>

          {/* Operation Count Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_operation_count">
            <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Operasyon Sayısı</span>
            <div className="flex items-baseline space-x-2 mt-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{dashboardData.futureOpCount}</span>
              <span className="text-xs text-slate-400 line-through font-mono">{dashboardData.currentOpCount}</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Sadeleşme Oranı</span>
              <span className="text-slate-700 font-extrabold bg-slate-100 px-2 py-0.5 rounded-full">
                -{Math.max(0, Math.round(((dashboardData.currentOpCount - dashboardData.futureOpCount) / (dashboardData.currentOpCount || 1)) * 100))}%
              </span>
            </div>
          </div>

          {/* CT Balance (Yamazumi) Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_ct_balance">
            <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">CT Dengesi (Yamazumi)</span>
            <div className="flex items-baseline space-x-2 mt-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">%{dashboardData.futureCtBalance}</span>
              <span className="text-xs text-slate-400 line-through font-mono">%{dashboardData.currentCtBalance}</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Denge İyileşmesi</span>
              {dashboardData.futureCtBalance >= dashboardData.currentCtBalance ? (
                <span className="text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full">
                  +{dashboardData.futureCtBalance - dashboardData.currentCtBalance} puan
                </span>
              ) : (
                <span className="text-rose-600 font-extrabold bg-rose-50 px-2 py-0.5 rounded-full">
                  {dashboardData.futureCtBalance - dashboardData.currentCtBalance} puan
                </span>
              )}
            </div>
          </div>

          {/* Kaizen / CI Theme Count Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition duration-200" id="kpi_kaizen_theme_count">
            <span className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider block">Kaizen / CI Proje Tema Sayısı</span>
            <div className="flex items-baseline space-x-2 mt-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">{dashboardData.kaizenThemes.length}</span>
              <span className="text-xs text-slate-400 font-mono">tema (Current -&gt; Future farkı)</span>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 max-h-20 overflow-y-auto space-y-1">
              {dashboardData.kaizenThemes.length === 0 ? (
                <span>Gelecek durumda henüz tespit edilmiş bir iyileştirme teması yok.</span>
              ) : (
                dashboardData.kaizenThemes.slice(0, 4).map((t, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 truncate mr-2">{t.theme}</span>
                    <span className="text-slate-400 truncate">{t.process.split(" ")[0]}: {t.detail}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* AI EXECUTIVE SUMMARY BOTTOM PANEL */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-indigo-500/20 relative overflow-hidden" id="ai_executive_summary_panel">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center space-x-2.5 mb-5 border-b border-white/10 pb-4">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider font-mono text-indigo-300">AI Değer Akışı Yönetici Özeti (AI Executive Summary)</h3>
              <p className="text-[10px] text-slate-400">Veri analitik algoritmaları tarafından oluşturulan stratejik yönetim ve yalın dönüşüm raporu</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 text-xs font-medium leading-relaxed text-slate-200">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 font-mono block">En Büyük İyileşme Potansiyeli</span>
                <p className="text-slate-300">{dynamicAiSummary.biggestImprovement}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 font-mono block">Termin Süresi ve Envanter Analizi</span>
                <p className="text-slate-300">{dynamicAiSummary.leadTimeReduction}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 font-mono block">Kalite Güvence ve Pokayoke Etkisi</span>
                <p className="text-slate-300">{dynamicAiSummary.qualityImpact}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 font-mono block">Tahmini Yıllık Finansal Kazanç</span>
                <p className="text-slate-100 font-semibold">{dynamicAiSummary.annualSavingsDesc}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-white/5 text-[10px] text-slate-500 flex items-center justify-between font-mono">
            <span>Rapor No: VSM-SIM-{(selectedCustomerId || "DEMO").toUpperCase()}</span>
            <span>Gerçek Zamanlı Endüstriyel Analitik</span>
          </div>
        </div>

      </div>
    )}

      {/* ========================================== */}
      {/* SIDE DRAWER FOR DETAILED PROCESS ANALYSIS    */}
      {/* ========================================== */}
      {isDrawerOpen && activeProcess && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Content Area */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-950 text-white flex justify-between items-center">
              <div>
                <span className="text-[11px] bg-slate-800 text-slate-300 font-mono font-bold px-2 py-0.5 rounded uppercase">
                  OPERASYON DETAY VE KAYIP ANALİZİ
                </span>
                <h3 className="text-base font-black tracking-tight mt-1">{activeProcess.name}</h3>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white font-black cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Metrics List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-700">
              
              {/* Dynamic Warning if Bottleneck */}
              {activeProcess.id === bottleneckProcess?.id && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <div className="space-y-1">
                    <span className="font-extrabold text-red-900 uppercase">KRİTİK HAT DARBOĞAZI (BOTTLENECK)</span>
                    <p className="text-slate-700 leading-relaxed">
                      Bu istasyonun çevrim hızı ({activeProcess.cycleTime} saniye) hat genelindeki en yüksek süredir. Hattın nihai çıkış temposunu ve sevkiyat hacmini tamamen bu istasyon belirler.
                    </p>
                  </div>
                </div>
              )}

              {/* 1. Complete Process Information Form */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-1.5">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span>Proses Operasyonel Parametreler</span>
                </h4>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Operatör Sayısı (HC)</label>
                    <input 
                      type="number"
                      value={activeProcess.operatorCount}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "operatorCount", Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Makine Sayısı</label>
                    <input 
                      type="number"
                      value={activeProcess.machineCount}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "machineCount", Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Çevrim Süresi (CT - Saniye)</label>
                    <input 
                      type="number"
                      value={activeProcess.cycleTime}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "cycleTime", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Mevcut OEE Oranı (%)</label>
                    <input 
                      type="number"
                      value={activeProcess.oee}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "oee", Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Ara Stok Seviyesi (WIP)</label>
                    <input 
                      type="number"
                      value={activeProcess.inventoryBefore}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "inventoryBefore", Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Arıza Duruşu (dk / gün)</label>
                    <input 
                      type="number"
                      value={activeProcess.downtimeMinutes}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "downtimeMinutes", Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* NEXT PROCESS / GRAPH RELATIONSHIP EDITOR */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-1.5">
                  <GitCommit className="w-4 h-4 text-slate-500" />
                  <span>Süreç Akışı — Sonraki Proses</span>
                </h4>
                <p className="text-[10px] text-slate-500 -mt-1 leading-relaxed">
                  Bu prosesten sonra hangi proses(ler) devam ediyor? Birden fazla seçim paralel akış (split) oluşturur; birden fazla proses aynı hedefi seçerse orada otomatik birleşme (merge) noktası oluşur. Ok çizmenize gerek yok — şema otomatik oluşur.
                </p>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {processesWithTimeline.filter(p => p.id !== activeProcess.id).length === 0 && (
                    <div className="p-3 text-[11px] text-slate-400 italic">Bağlanacak başka proses yok.</div>
                  )}
                  {processesWithTimeline.filter(p => p.id !== activeProcess.id).map(p => {
                    const activeIdx = processesWithTimeline.findIndex(pp => pp.id === activeProcess.id);
                    const effectiveSuccessors = getEffectiveSuccessorIds(activeProcess, processesWithTimeline, activeIdx);
                    const isChecked = effectiveSuccessors.includes(p.id);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-2.5">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleToggleNextProcess(activeProcess.id, p.id, e.target.checked)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                        {isChecked && (
                          <select
                            value={(activeProcess.connectionTypes && activeProcess.connectionTypes[p.id]) || "Normal"}
                            onChange={(e) => handleSetConnectionType(activeProcess.id, p.id, e.target.value as VsmConnectionType)}
                            className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none shrink-0 cursor-pointer"
                          >
                            <option value="Normal">Normal</option>
                            <option value="Parallel">Paralel</option>
                            <option value="Merge">Birleşme</option>
                            <option value="Split">Dağılım</option>
                            <option value="Rework">Yeniden İşlem</option>
                            <option value="Kanban">Kanban</option>
                            <option value="Supermarket">Süpermarket</option>
                            <option value="External Supplier">Dış Tedarikçi</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Lead time contribution + critical path indicator */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold ${
                  vsmCriticalPath.criticalPathIds.has(activeProcess.id)
                    ? "bg-red-50 border border-red-200 text-red-700"
                    : "bg-slate-50 border border-slate-200 text-slate-600"
                }`}>
                  <span>Bu prosesin Lead Time katkısı (stok bekleme):</span>
                  <span className="font-mono">{activeProcess.inventoryDays} gün</span>
                </div>
                {vsmCriticalPath.criticalPathIds.has(activeProcess.id) && (
                  <p className="text-[10px] text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Bu proses, toplam Lead Time'ı belirleyen kritik yol (critical path) üzerinde.
                  </p>
                )}
              </div>

              {/* 2. OEE BREAKDOWN & SIX BIG LOSSES */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-1.5">
                  <Percent className="w-4 h-4 text-slate-500" />
                  <span>Altı Büyük Kayıp &amp; OEE Analizi (Six Big Losses)</span>
                </h4>

                <div className="space-y-3 text-xs">
                  {/* Availability */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">1. KULLANILABİLİRLİK (AVAILABILITY)</span>
                      <span className="text-slate-800">{activeProcess.availability}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full" style={{ width: `${activeProcess.availability}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400">Ekipmanın duruş kayıpları ve kalıp değişim (changeover) kayıplarını içerir.</p>
                  </div>

                  {/* Performance */}
                  <div className="space-y-1 pt-1.5">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">2. PERFORMANS ORANI (PERFORMANCE)</span>
                      <span className="text-slate-800">{activeProcess.performance}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full" style={{ width: `${activeProcess.performance}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400">Küçük duruşlar (micro-stops) ve hız kayıplarını (slow running) temsil eder.</p>
                  </div>

                  {/* Quality */}
                  <div className="space-y-1 pt-1.5">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-500">3. KALİTE ORANI (FPY YIELD)</span>
                      <span className="text-slate-800">{activeProcess.quality}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full" style={{ width: `${activeProcess.quality}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400">Iskarta (scrap), hurda ve yeniden işlem (rework) kayıplarını süzerek hesaplanır.</p>
                  </div>
                </div>
              </div>

              {/* 3. CAPACITY ANALYSIS & TIME STUDY */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-1.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Kapasite ve Standart İş Analizi</span>
                </h4>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Teorik Çıkış Kapasitesi:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {Math.round(activeProcess.capacity * 1.35)} Adet/Gün
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/60 pt-2">
                    <span className="text-slate-500 font-semibold">Net Fiili Kapasite:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {activeProcess.capacity} Adet/Gün
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/60 pt-2">
                    <span className="text-slate-500 font-semibold">Hedef Piyasa Talebi:</span>
                    <span className="font-mono font-bold text-amber-600">
                      {dailyDemand} Adet/Gün
                    </span>
                  </div>
                  <div className="border-t border-slate-200/60 pt-2">
                    <span className="text-[10px] text-slate-450 block font-mono">
                      *Talebe yetişme katsayısı: <span className="font-bold text-slate-800">{Math.round((activeProcess.capacity / (dailyDemand || 1)) * 100)}%</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. KAIZEN OPPORTUNITIES & IMPROVEMENT NOTES */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono flex items-center space-x-1.5 border-b border-slate-100 pb-1.5">
                  <Sparkles className="w-4 h-4 text-slate-500" />
                  <span>Kaizen Fırsatları &amp; İyileştirme Notları</span>
                </h4>

                <div className="space-y-2.5 text-xs font-semibold">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                    <span className="text-amber-800 text-[10px] uppercase font-mono block">Mevcut Tespit (Problem)</span>
                    <textarea 
                      value={activeProcess.notes}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "notes", e.target.value)}
                      className="w-full bg-transparent border-0 font-medium mt-1 leading-relaxed text-xs text-slate-800 focus:ring-0 focus:outline-none resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                    <span className="text-emerald-800 text-[10px] uppercase font-mono block">Kaizen Proje Teklifi</span>
                    <textarea 
                      value={activeProcess.kaizenOpp}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "kaizenOpp", e.target.value)}
                      className="w-full bg-transparent border-0 font-medium mt-1 leading-relaxed text-xs text-slate-800 focus:ring-0 focus:outline-none resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Close */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50 gap-2 shrink-0">
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                Kapat ve Değişiklikleri Uygula
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* EXPORT OPTIONS MODAL                       */}
      {/* ========================================== */}
      {exportModalOpen && (
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
      )}

    </div>
  );
}
