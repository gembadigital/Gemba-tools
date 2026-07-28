import React, { useState, useEffect, useMemo } from "react";
import Markdown from "react-markdown";
import { 
  Plus, Trash2, Edit2, Download, Upload, RefreshCw, 
  Clock, Check, X, Maximize2, Minimize2, Save, FileText, 
  TrendingUp, Award, HelpCircle, ChevronDown, ListFilter,
  Activity, AlertTriangle, Eye, Sparkles, CheckSquare, Square,
  BarChart3, Printer, Database, Info, Settings, ArrowRight, RotateCcw,
  GripVertical
} from "lucide-react";

interface Customer {
  id: string;
  companyName: string;
  industry: string;
  productionType: string;
}

interface ProcessStep {
  id: number;
  name: string;
  mct: number; // machine CT
  co: number;  // changeover setup
  cy: number[]; // cycle times list
  shapeType?: "process" | "inspection";
}

interface WorkElement {
  id: number;
  seq: number;
  desc: string;
  time: number;
  type: "manual" | "walking" | "machine" | "waiting" | "inspection" | "parallel";
  hasMachineWaiting?: boolean; // checkbox for waiting in automatic job
  operationMode?: "sequential" | "parallel";
  customStartTime?: number;
  operator?: string;
  station?: string;
  machineName?: string;
}

interface StudyRecord {
  id: string;
  customerId: string;
  lineName: string;
  productName: string;
  shiftHours: number;
  taktTime: number;
  createdAt: string;
  processes: ProcessStep[];
  ccAvail: number;
  ccDemand: number;
  ccEls: WorkElement[];
}

interface TimeStudyPageProps {
  selectedCustomer: Customer;
}

const TYPE_CONFIG = {
  manual: { label: "Manuel İş (Manual Work)", color: "#1D6FF2", bg: "bg-blue-50 text-blue-700 border-blue-200", marker: "M" },
  walking: { label: "Yürüme (Walking)", color: "#9333EA", bg: "bg-purple-50 text-purple-700 border-purple-200", marker: "Y" },
  machine: { label: "Makine Çalışması (Machine Running)", color: "#0891B2", bg: "bg-cyan-50 text-cyan-700 border-cyan-200", marker: "A" },
  waiting: { label: "Bekleme (Waiting)", color: "#EF4444", bg: "bg-rose-50 text-rose-750 border-rose-200", marker: "B" },
  inspection: { label: "Kontrol (Inspection)", color: "#D97706", bg: "bg-amber-50 text-amber-700 border-amber-200", marker: "K" },
  parallel: { label: "Paralel İşlem (Parallel Work)", color: "#0D9488", bg: "bg-teal-50 text-teal-700 border-teal-200", marker: "P" }
};

export default function TimeStudyPage({ selectedCustomer }: TimeStudyPageProps) {
  const [activeTab, setActiveTab] = useState<"study" | "combination">("study");
  const [lineName, setLineName] = useState<string>("Montaj Hattı A");
  const [productName, setProductName] = useState<string>("Ütü Masası");
  const [shiftHours, setShiftHours] = useState<number>(12);
  const [taktTime, setTaktTime] = useState<number>(60);

  // Available Time and Demand for Tab 2
  const [ccAvail, setCcAvail] = useState<number>(27000);
  const [ccDemand, setCcDemand] = useState<number>(450);

  // List of processes (mirrors HTML default data 100%)
  const [processes, setProcesses] = useState<ProcessStep[]>(() => [
    { id: 1, name: "SÜNGER + KOMPONENT HAZ", mct: 0, co: 0, cy: [8, 12, 10, 9, 11] },
    { id: 2, name: "ÖRTÜ GEÇİRME", mct: 0, co: 0, cy: [8, 9, 8, 8, 9] },
    { id: 3, name: "YAY", mct: 0, co: 0, cy: [10, 11, 10, 12] },
    { id: 4, name: "KISA AYAK + ETİKET", mct: 0, co: 2, cy: [5, 6, 5, 5] },
    { id: 5, name: "SUB AYAK PLASTİK", mct: 0, co: 0, cy: [4, 5, 4] },
    { id: 6, name: "AYAK PLASTİK + GENİŞ", mct: 4, co: 0, cy: [12, 11, 13] },
    { id: 7, name: "SUB GENİŞ AYAK PLASTİK", mct: 0, co: 0, cy: [2, 3, 2, 4] },
    { id: 8, name: "PUL TAKMA", mct: 0, co: 0, cy: [7, 8, 7, 7, 8] },
    { id: 9, name: "MİL GEÇİRME", mct: 0, co: 0, cy: [8, 9, 8] },
    { id: 10, name: "MİL PLASTİK PARÇA", mct: 0, co: 0, cy: [7, 8, 7] },
    { id: 11, name: "BURÇ ÇAKMA", mct: 0, co: 0, cy: [5, 7, 6, 6] },
    { id: 12, name: "KALİTE KONTROL", mct: 0, co: 0, cy: [6, 7, 6, 6] },
    { id: 13, name: "ETİKET", mct: 0, co: 0, cy: [7, 8, 7, 7] },
    { id: 14, name: "SHRİNK KONVEYOR", mct: 0, co: 0, cy: [5, 6, 5] },
    { id: 15, name: "SHRİNK", mct: 2, co: 0, cy: [8, 10, 9] },
    { id: 16, name: "VAKUM", mct: 0, co: 0, cy: [12, 11, 12, 13] },
    { id: 17, name: "ETİKET + KUTUYA HAZ.", mct: 0, co: 0, cy: [5, 6, 5] },
    { id: 18, name: "KUTULAMA", mct: 0, co: 0, cy: [8, 9, 8, 8] },
    { id: 19, name: "PAKET", mct: 0, co: 0, cy: [5, 6, 5] }
  ]);

  // Selected process for measurement
  const [selectedProcessId, setSelectedProcessId] = useState<number>(1);

  // Cycle measurement manual entries
  const [cycleInput, setCycleInput] = useState<string>("");

  // Tab 2 Elements
  const [ccEls, setCcEls] = useState<WorkElement[]>(() => [
    { id: 1, seq: 1, desc: "SÜNGER + KOMPONENT HAZ", time: 10, type: "manual", operationMode: "sequential", operator: "Operatör 1", station: "İstasyon A" },
    { id: 2, seq: 2, desc: "ÖRTÜ GEÇİRME", time: 8, type: "manual", operationMode: "sequential", operator: "Operatör 1", station: "İstasyon A" },
    { id: 3, seq: 3, desc: "YAY TAKMA", time: 10, type: "manual", operationMode: "sequential", operator: "Operatör 1", station: "İstasyon A" },
    { id: 4, seq: 4, desc: "OTOMATİK SHRINKE TAŞIMA", time: 5, type: "walking", operationMode: "sequential", operator: "Operatör 1", station: "İstasyon A" },
    { id: 5, seq: 5, desc: "SHRİNK BASKI SÜRESİ", time: 12, type: "machine", hasMachineWaiting: true, operationMode: "parallel", customStartTime: 10, machineName: "Shrink Makinesi", operator: "Operatör 1", station: "İstasyon A" },
    { id: 6, seq: 6, desc: "SHRİNK SOĞUMA BEKLEME", time: 4, type: "waiting", operationMode: "sequential", operator: "Operatör 1", station: "İstasyon A" }
  ]);

  // Tab 2 Form State
  const [elSeq, setElSeq] = useState<string>("");
  const [elDesc, setElDesc] = useState<string>("");
  const [elTime, setElTime] = useState<string>("");
  const [elType, setElType] = useState<WorkElement["type"]>("manual");
  const [elHasMachineWaiting, setElHasMachineWaiting] = useState<boolean>(false);
  const [editingElId, setEditingElId] = useState<number | null>(null);

  // Advanced SWCT Settings
  const [elOperationMode, setElOperationMode] = useState<"sequential" | "parallel">("sequential");
  const [elCustomStartTime, setElCustomStartTime] = useState<string>("");
  const [elOperator, setElOperator] = useState<string>("Operatör 1");
  const [elStation, setElStation] = useState<string>("İstasyon A");
  const [elMachineName, setElMachineName] = useState<string>("");

  // Zoom & Tooltips
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [hoveredEl, setHoveredEl] = useState<(WorkElement & { startTime: number; endTime: number }) | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // AI recommendations state
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [swctAiReport, setSwctAiReport] = useState<string>("");
  const [aiError, setAiError] = useState<string>("");

  // New process input states
  const [newProcName, setNewProcName] = useState<string>("");
  const [newProcMct, setNewProcMct] = useState<string>("");
  const [newProcCo, setNewProcCo] = useState<string>("");

  // N Cycle addition modal state
  const [isCycleModalOpen, setIsCycleModalOpen] = useState<boolean>(false);
  const [modalCycleCount, setModalCycleCount] = useState<number>(3);
  const [modalCycleValues, setModalCycleValues] = useState<string[]>(["", "", ""]);

  // History / Saved studies state
  const [savedStudies, setSavedStudies] = useState<StudyRecord[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Full screen toggle
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isTableMaximized, setIsTableMaximized] = useState<boolean>(false);
  const [isComparisonMaximized, setIsComparisonMaximized] = useState<boolean>(false);
  const [isDistributionMaximized, setIsDistributionMaximized] = useState<boolean>(false);
  const [isFlowchartMaximized, setIsFlowchartMaximized] = useState<boolean>(false);

  // Sub-tab under Combination (Page 2)
  const [comboSubTab, setComboSubTab] = useState<"elements" | "va" | "insights">("elements");

  // Drag and Drop for Processes
  const [draggedProcessId, setDraggedProcessId] = useState<number | null>(null);

  const handleProcessDragStart = (e: React.DragEvent, id: number) => {
    setDraggedProcessId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id.toString());
  };

  const handleProcessDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedProcessId === null || draggedProcessId === targetId) return;

    const draggedIndex = processes.findIndex(p => p.id === draggedProcessId);
    const targetIndex = processes.findIndex(p => p.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const updated = [...processes];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);

    setDraggedProcessId(targetId);
    setProcesses(updated);
  };

  const handleProcessDragEnd = () => {
    setDraggedProcessId(null);
  };

  // Drag and Drop for Work Elements (Combination Sheet)
  const [draggedElementId, setDraggedElementId] = useState<number | null>(null);

  const handleElDragStart = (e: React.DragEvent, id: number) => {
    setDraggedElementId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id.toString());
  };

  const handleElDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedElementId === null || draggedElementId === targetId) return;

    const sortedEls = [...ccEls].sort((a, b) => a.seq - b.seq);
    const draggedIndex = sortedEls.findIndex(el => el.id === draggedElementId);
    const targetIndex = sortedEls.findIndex(el => el.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedItem] = sortedEls.splice(draggedIndex, 1);
    sortedEls.splice(targetIndex, 0, draggedItem);

    // Re-assign seq sequentially starting from 1
    const sequentialUpdated = sortedEls.map((item, idx) => ({
      ...item,
      seq: idx + 1
    }));

    setDraggedElementId(targetId);
    setCcEls(sequentialUpdated);
  };

  const handleElDragEnd = () => {
    setDraggedElementId(null);
  };

  // Get selected process step
  const activeProcess = useMemo(() => {
    return processes.find(p => p.id === selectedProcessId) || processes[0];
  }, [processes, selectedProcessId]);

  // Local Storage Load
  useEffect(() => {
    const raw = localStorage.getItem("gemba_time_studies");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StudyRecord[];
        setSavedStudies(parsed);
      } catch (e) {
        console.error("Error parsing saved studies", e);
      }
    }
  }, []);

  // Filter studies belonging to the active customer
  const currentCustomerStudies = useMemo(() => {
    return savedStudies.filter(s => s.customerId === selectedCustomer.id);
  }, [savedStudies, selectedCustomer.id]);

  // Recalculate Available Time and Demand when Takt changes
  const calcTakt = useMemo(() => {
    return ccDemand > 0 ? ccAvail / ccDemand : 0;
  }, [ccAvail, ccDemand]);

  // Statistics helper functions
  const getMode = (arr: number[]) => {
    if (!arr || arr.length === 0) return 0;
    const freqs: Record<number, number> = {};
    let maxFreq = 0;
    let modeVal = arr[0];
    arr.forEach(val => {
      freqs[val] = (freqs[val] || 0) + 1;
      if (freqs[val] > maxFreq) {
        maxFreq = freqs[val];
        modeVal = val;
      }
    });
    return modeVal;
  };

  const getAvg = (arr: number[]) => {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((sum, v) => sum + v, 0) / arr.length;
  };

  const getProcessCT = (p: ProcessStep) => {
    const mode = getMode(p.cy) || 0;
    const mct = p.mct || 0;
    return Math.max(mode, mct);
  };

  const getHourlyCapacity = (ct: number) => {
    return ct > 0 ? Math.round(3600 / ct) : 0;
  };

  const getShiftCapacity = (ct: number) => {
    return ct > 0 ? Math.floor((shiftHours * 3600) / ct) : 0;
  };

  const getCoLossAmount = (p: ProcessStep) => {
    const ct = getProcessCT(p);
    return ct > 0 && p.co > 0 ? Math.floor(p.co / ct) : 0;
  };

  // Identify Bottleneck
  const bottleneckInfo = useMemo(() => {
    let maxCT = 0;
    let bnProc: ProcessStep | null = null;
    processes.forEach(p => {
      const ct = getProcessCT(p);
      if (ct > maxCT) {
        maxCT = ct;
        bnProc = p;
      }
    });
    return { maxCT, id: bnProc ? (bnProc as ProcessStep).id : null, name: bnProc ? (bnProc as ProcessStep).name : "" };
  }, [processes]);

  // Add Cycle measurement
  const handleAddCycle = () => {
    if (!cycleInput.trim()) return;
    const val = parseFloat(cycleInput);
    if (isNaN(val) || val <= 0) return;

    setProcesses(prev => prev.map(p => {
      if (p.id === selectedProcessId) {
        return { ...p, cy: [...p.cy, val] };
      }
      return p;
    }));
    setCycleInput("");
  };

  // Quick preset adding
  const addQuickPreset = (val: number) => {
    setProcesses(prev => prev.map(p => {
      if (p.id === selectedProcessId) {
        return { ...p, cy: [...p.cy, val] };
      }
      return p;
    }));
  };

  // Remove individual cycle measurement
  const handleRemoveCycle = (index: number) => {
    setProcesses(prev => prev.map(p => {
      if (p.id === selectedProcessId) {
        const copy = [...p.cy];
        copy.splice(index, 1);
        return { ...p, cy: copy };
      }
      return p;
    }));
  };

  // Add Process Step
  const handleAddProcess = () => {
    if (!newProcName.trim()) return;
    const nextId = processes.length > 0 ? Math.max(...processes.map(p => p.id)) + 1 : 1;
    const mct = parseFloat(newProcMct) || 0;
    const co = parseFloat(newProcCo) || 0;

    const newProc: ProcessStep = {
      id: nextId,
      name: newProcName.toUpperCase().trim(),
      mct,
      co,
      cy: []
    };

    setProcesses([...processes, newProc]);
    setSelectedProcessId(nextId);
    setNewProcName("");
    setNewProcMct("");
    setNewProcCo("");
  };

  // Update existing process field
  const handleUpdateProcessField = (id: number, field: "mct" | "co", val: number) => {
    setProcesses(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, [field]: val };
      }
      return p;
    }));
  };

  // Delete Process Step
  const handleDeleteProcess = (id: number) => {
    if (processes.length <= 1) return;
    setProcesses(prev => prev.filter(p => p.id !== id));
    if (selectedProcessId === id) {
      const remaining = processes.filter(p => p.id !== id);
      setSelectedProcessId(remaining[0].id);
    }
  };

  // Tab 2 Elements sync from active process (copies Mode and MCT)
  const handleSyncFromSelectedProcess = () => {
    const p = activeProcess;
    if (!p) return;
    const mode = getMode(p.cy) || 0;
    const mct = p.mct || 0;

    const syncedList: WorkElement[] = [];
    let nextSeq = ccEls.length > 0 ? Math.max(...ccEls.map(e => e.seq)) + 1 : 1;

    if (mode > 0) {
      syncedList.push({
        id: Date.now(),
        seq: nextSeq++,
        desc: `Manuel İş - ${p.name}`,
        time: mode,
        type: "manual"
      });
    }
    if (mct > 0) {
      syncedList.push({
        id: Date.now() + 1,
        seq: nextSeq++,
        desc: `Otomatik Çalışma - ${p.name}`,
        time: mct,
        type: "machine",
        hasMachineWaiting: false
      });
    }

    setCcEls([...ccEls, ...syncedList]);
  };

  // Elements CRUD
  const handleSaveElement = () => {
    if (!elDesc.trim() || !elTime) return;
    const timeVal = parseFloat(elTime);
    if (isNaN(timeVal) || timeVal <= 0) return;
    const seqVal = parseInt(elSeq) || (ccEls.length > 0 ? Math.max(...ccEls.map(e => e.seq)) + 1 : 1);
    const customStartVal = elCustomStartTime.trim() !== "" ? parseFloat(elCustomStartTime) : undefined;

    if (editingElId !== null) {
      // Edit mode
      setCcEls(prev => prev.map(e => {
        if (e.id === editingElId) {
          return {
            ...e,
            seq: seqVal,
            desc: elDesc,
            time: timeVal,
            type: elType,
            hasMachineWaiting: elType === "machine" ? elHasMachineWaiting : false,
            operationMode: elOperationMode,
            customStartTime: elOperationMode === "parallel" ? customStartVal : undefined,
            operator: elOperator || "Operatör 1",
            station: elStation || "İstasyon A",
            machineName: elType === "machine" ? elMachineName : undefined
          };
        }
        return e;
      }));
      setEditingElId(null);
    } else {
      // Create mode
      const newEl: WorkElement = {
        id: Date.now(),
        seq: seqVal,
        desc: elDesc,
        time: timeVal,
        type: elType,
        hasMachineWaiting: elType === "machine" ? elHasMachineWaiting : false,
        operationMode: elOperationMode,
        customStartTime: elOperationMode === "parallel" ? customStartVal : undefined,
        operator: elOperator || "Operatör 1",
        station: elStation || "İstasyon A",
        machineName: elType === "machine" ? elMachineName : undefined
      };
      setCcEls([...ccEls, newEl]);
    }

    setElSeq("");
    setElDesc("");
    setElTime("");
    setElType("manual");
    setElHasMachineWaiting(false);
    setElOperationMode("sequential");
    setElCustomStartTime("");
    setElOperator("Operatör 1");
    setElStation("İstasyon A");
    setElMachineName("");
  };

  // Edit element trigger
  const handleEditElement = (el: WorkElement) => {
    setEditingElId(el.id);
    setElSeq(el.seq.toString());
    setElDesc(el.desc);
    setElTime(el.time.toString());
    setElType(el.type);
    setElHasMachineWaiting(el.hasMachineWaiting || false);
    setElOperationMode(el.operationMode || "sequential");
    setElCustomStartTime(el.customStartTime !== undefined ? el.customStartTime.toString() : "");
    setElOperator(el.operator || "Operatör 1");
    setElStation(el.station || "İstasyon A");
    setElMachineName(el.machineName || "");
  };

  // Delete element
  const handleDeleteElement = (id: number) => {
    setCcEls(prev => prev.filter(e => e.id !== id));
  };

  // Reset element form
  const handleCancelElementEdit = () => {
    setEditingElId(null);
    setElSeq("");
    setElDesc("");
    setElTime("");
    setElType("manual");
    setElHasMachineWaiting(false);
    setElOperationMode("sequential");
    setElCustomStartTime("");
    setElOperator("Operatör 1");
    setElStation("İstasyon A");
    setElMachineName("");
  };

  // Chronologically resolved elements timeline (handles parallel & sequential overlaps)
  const resolvedElements = useMemo(() => {
    const sorted = [...ccEls].sort((a, b) => a.seq - b.seq);
    let currentSeqTime = 0;
    const resolved: (WorkElement & { startTime: number; endTime: number })[] = [];

    sorted.forEach((el, idx) => {
      let start = 0;
      if (el.operationMode === "parallel") {
        if (el.customStartTime !== undefined && el.customStartTime !== null && !isNaN(el.customStartTime)) {
          start = el.customStartTime;
        } else {
          // Default start time of parallel is the previous sequential element's end time (or 0)
          start = idx > 0 ? resolved[idx - 1].startTime : 0;
        }
      } else {
        start = currentSeqTime;
      }

      const end = start + el.time;
      if (el.operationMode !== "parallel") {
        currentSeqTime = end;
      }

      resolved.push({
        ...el,
        startTime: parseFloat(start.toFixed(1)),
        endTime: parseFloat(end.toFixed(1))
      });
    });
    return resolved;
  }, [ccEls]);

  // Totals for combination tab
  const ccTotals = useMemo(() => {
    const sums = { manual: 0, walking: 0, machine: 0, waiting: 0, inspection: 0, parallel: 0 };
    ccEls.forEach(e => {
      const t = e.type as keyof typeof sums;
      if (sums[t] !== undefined) {
        sums[t] = sums[t] + e.time;
      }
    });
    // Total physical timeline duration
    const total = resolvedElements.length > 0 ? Math.max(...resolvedElements.map(e => e.endTime)) : 0;
    return { ...sums, total };
  }, [ccEls, resolvedElements]);

  // Operator Idle Time (occurs when machines are running but operator is doing nothing)
  const operatorIdleTime = useMemo(() => {
    const machineIntervals = resolvedElements.filter(e => e.type === "machine");
    const operatorIntervals = resolvedElements.filter(e => e.type !== "waiting" && e.type !== "machine");

    if (machineIntervals.length === 0) return 0;

    let idleTime = 0;
    const step = 0.1;

    machineIntervals.forEach(m => {
      for (let t = m.startTime; t < m.endTime; t += step) {
        const isOperatorActive = operatorIntervals.some(op => t >= op.startTime && t < op.endTime);
        if (!isOperatorActive) {
          idleTime += step;
        }
      }
    });

    return parseFloat(idleTime.toFixed(1));
  }, [resolvedElements]);

  // Machine Waiting Time (total cycle duration - machine active runtime)
  const machineWaitingTime = useMemo(() => {
    const totalTime = ccTotals.total;
    const totalMachineTime = ccTotals.machine;
    return parseFloat(Math.max(0, totalTime - totalMachineTime).toFixed(1));
  }, [ccTotals.total, ccTotals.machine]);

  const vaPercent = useMemo(() => {
    const totalTime = ccTotals.total;
    if (totalTime <= 0) return 0;
    // VA = Manual Work + Parallel Work
    return parseFloat((( (ccTotals.manual + ccTotals.parallel) / totalTime ) * 100).toFixed(1));
  }, [ccTotals]);

  const nvaPercent = useMemo(() => {
    const totalTime = ccTotals.total;
    if (totalTime <= 0) return 0;
    // NVA = Walking + Waiting + Inspection (Inspection is NNVA, treated with waste for strict efficiency)
    return parseFloat((( (ccTotals.walking + ccTotals.waiting + ccTotals.inspection) / totalTime ) * 100).toFixed(1));
  }, [ccTotals]);

  const utilizationPercent = useMemo(() => {
    const totalTime = ccTotals.total;
    if (totalTime <= 0) return 0;
    const activeTime = Math.max(0, totalTime - operatorIdleTime);
    return parseFloat(Math.min(100, Math.max(0, (activeTime / totalTime) * 100)).toFixed(1));
  }, [ccTotals.total, operatorIdleTime]);

  // Adjust Modal Cycle Count
  const handleAdjustModalCycleCount = (delta: number) => {
    const nextVal = Math.max(1, Math.min(20, modalCycleCount + delta));
    setModalCycleCount(nextVal);
    
    // adjust string array size
    setModalCycleValues(prev => {
      const copy = [...prev];
      if (nextVal > copy.length) {
        while (copy.length < nextVal) copy.push("");
      } else if (nextVal < copy.length) {
        copy.splice(nextVal);
      }
      return copy;
    });
  };

  const handleModalCycleValChange = (idx: number, val: string) => {
    setModalCycleValues(prev => {
      const copy = [...prev];
      copy[idx] = val;
      return copy;
    });
  };

  const handleSaveModalCycles = () => {
    const added: number[] = [];
    modalCycleValues.forEach(str => {
      const val = parseFloat(str);
      if (!isNaN(val) && val > 0) {
        added.push(val);
      }
    });

    if (added.length > 0) {
      setProcesses(prev => prev.map(p => {
        if (p.id === selectedProcessId) {
          return { ...p, cy: [...p.cy, ...added] };
        }
        return p;
      }));
    }
    setIsCycleModalOpen(false);
    setModalCycleValues(["", "", ""]);
    setModalCycleCount(3);
  };

  const handleElementMouseEnter = (e: React.MouseEvent, el: any) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredEl(el);
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const handleElementMouseLeave = () => {
    setHoveredEl(null);
  };

  const handleAnalyzeSwctWithAi = async () => {
    setIsAiAnalyzing(true);
    setAiError("");
    try {
      const response = await fetch("/api/gemini/swct-analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("opex_auth_token") || ""}`
        },
        body: JSON.stringify({
          elements: ccEls,
          totals: ccTotals
        })
      });
      if (!response.ok) {
        throw new Error(`API hatası: ${response.status}`);
      }
      const data = await response.json();
      setSwctAiReport(data.report || "");
    } catch (err: any) {
      setAiError(err.message || "Bilinmeyen bir hata oluştu.");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Helper to determine step shape type ("process" -> Dikdörtgen, "inspection" -> Üçgen)
  const getStepShape = (p: ProcessStep): "process" | "inspection" => {
    if (p.shapeType) return p.shapeType;
    const upper = p.name.toUpperCase();
    if (
      upper.includes("KALİTE") || 
      upper.includes("KONTROL") || 
      upper.includes("INSPECTION") || 
      upper.includes("TEST") ||
      upper.includes("MUAYENE")
    ) {
      return "inspection";
    }
    return "process";
  };

  const handleToggleStepShape = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcesses(prev => prev.map(p => {
      if (p.id === id) {
        const current = getStepShape(p);
        return { ...p, shapeType: current === "inspection" ? "process" : "inspection" };
      }
      return p;
    }));
  };

  // Metot Mühendisliği - Process Flowchart Diagram Renderer
  const renderProcessFlowchart = (maximized: boolean) => {
    if (processes.length === 0) return null;

    const totalSteps = processes.length;
    const processCount = processes.filter(p => getStepShape(p) === "process").length;
    const inspectionCount = processes.filter(p => getStepShape(p) === "inspection").length;
    const totalLeadTime = processes.reduce((acc, p) => acc + getProcessCT(p), 0);

    return (
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-800 space-y-4">
        {/* Header / Metot Mühendisi Identity */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <span className="p-1.5 bg-sky-600 rounded-xl text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </span>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black tracking-tight uppercase font-sans text-sky-400">
                  METOT MÜHENDİSLİĞİ • PROSES İŞ AKIŞ ŞEMASI
                </h3>
                <span className="text-[9px] bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded-full font-extrabold uppercase">
                  Metot Mühendisi Modu
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              Proses zaman etüdü tablosundaki adımlar referans alınarak oluşturulan soldan sağa yönlü standart iş akışı. 
              (<strong>Yuvarlak/Oval</strong>: Başlangıç/Bitiş • <strong>Dikdörtgen</strong>: Proses • <strong>Üçgen</strong>: Kalite Kontrol)
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
            <button
              onClick={() => setIsFlowchartMaximized(!maximized ? true : false)}
              className="bg-slate-800 hover:bg-slate-750 text-sky-300 font-bold text-xs py-1.5 px-3 rounded-xl border border-slate-700 flex items-center space-x-1.5 cursor-pointer transition"
              title="Şemayı Tam Ekran Büyüt"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{maximized ? "Küçült" : "Tam Ekran Görünüm"}</span>
            </button>
          </div>
        </div>

        {/* Metot Mühendisi KPI summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-xs">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase">Toplam İş Adımı</span>
            <span className="text-sm font-black text-white font-mono mt-0.5">{totalSteps} Adım</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-sky-400 uppercase">Proses (Dikdörtgen)</span>
            <span className="text-sm font-black text-sky-300 font-mono mt-0.5">{processCount} Adım</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-amber-400 uppercase">Kalite Kontrol (Üçgen)</span>
            <span className="text-sm font-black text-amber-300 font-mono mt-0.5">{inspectionCount} Adım</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-emerald-400 uppercase">Toplam Akış Süresi</span>
            <span className="text-sm font-black text-emerald-300 font-mono mt-0.5">{totalLeadTime.toFixed(1)} sn</span>
          </div>
          <div className="flex flex-col col-span-2 sm:col-span-1">
            <span className="text-[9px] font-black text-rose-400 uppercase">Darboğaz Operasyonu</span>
            <span className="text-xs font-black text-rose-300 truncate mt-0.5">
              {bottleneckInfo.name ? `${bottleneckInfo.name} (${bottleneckInfo.maxCT}s)` : "—"}
            </span>
          </div>
        </div>

        {/* Left-To-Right Flow Diagram Canvas */}
        <div className="overflow-x-auto scrollbar-thin p-4 sm:p-5 bg-slate-950 rounded-xl border border-slate-800/90 shadow-inner">
          <div className="flex items-center space-x-2.5 sm:space-x-3 py-3 min-w-max select-none">
            
            {/* 1. START NODE (Yuvarlak / Oval Pill) */}
            <div className="shrink-0 flex items-center space-x-2.5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white px-5 py-3 rounded-full border-2 border-emerald-400 shadow-md h-[80px] select-none">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 border border-emerald-300 shadow-xs">
                <span className="text-xs font-black">▶</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-100">İş Başlangıcı</span>
                <span className="text-[9px] font-semibold text-emerald-200/80">Ham Malzeme / Girdi</span>
              </div>
            </div>

            {/* Connecting Arrow */}
            <div className="shrink-0 flex items-center px-1">
              <ArrowRight className="w-5 h-5 text-sky-400 animate-pulse" />
            </div>

            {/* 2. PROCESS & QUALITY CONTROL NODES */}
            {processes.map((p, idx) => {
              const ct = getProcessCT(p);
              const isBn = p.id === bottleneckInfo.id;
              const isSelected = p.id === selectedProcessId;
              const shape = getStepShape(p);

              return (
                <React.Fragment key={p.id}>
                  {shape === "process" ? (
                    /* PROSES (DİKDÖRTGEN) */
                    <div
                      onClick={() => setSelectedProcessId(p.id)}
                      className={`relative shrink-0 flex flex-col justify-between p-3 rounded-xl border-2 transition-all cursor-pointer min-w-[150px] max-w-[180px] h-[82px] shadow-md group ${
                        isSelected
                          ? "bg-sky-950 border-sky-400 ring-2 ring-sky-400/50 text-white scale-[1.03]"
                          : isBn
                          ? "bg-rose-950/90 border-rose-500 text-white ring-2 ring-rose-500/40 animate-pulse"
                          : "bg-slate-800/90 border-slate-600 hover:border-sky-400 text-slate-100"
                      }`}
                      title={`${idx + 1}. ${p.name} - Tıklayarak seçin ve tablodan inceleyin`}
                    >
                      {/* Top bar */}
                      <div className="flex items-center justify-between">
                        <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md uppercase ${
                          isBn ? "bg-rose-600 text-white" : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                        }`}>
                          #{idx + 1}
                        </span>
                        <span className="text-[11px] font-black font-mono text-emerald-400">
                          {ct > 0 ? `${ct.toFixed(1)}s` : "—"}
                        </span>
                      </div>

                      {/* Name */}
                      <div className="text-[10.5px] font-extrabold uppercase leading-tight line-clamp-2 text-slate-100 my-1">
                        {p.name}
                      </div>

                      {/* Bottom status line */}
                      <div className="flex items-center justify-between border-t border-slate-700/60 pt-1 text-[8.5px] text-slate-400">
                        <span className="font-semibold">{p.mct > 0 ? `Mak: ${p.mct}s` : "Operasyon"}</span>
                        <button
                          onClick={(e) => handleToggleStepShape(p.id, e)}
                          className="hover:text-amber-300 text-slate-400 transition flex items-center space-x-0.5"
                          title="Bu adımı Kalite Kontrol (Üçgen) yap"
                        >
                          <span>🔺 Kontrol Yap</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* KALİTE KONTROL (ÜÇGEN) */
                    <div
                      onClick={() => setSelectedProcessId(p.id)}
                      className={`relative shrink-0 flex flex-col items-center justify-center cursor-pointer select-none min-w-[155px] h-[92px] transition-all group ${
                        isSelected ? "scale-[1.03]" : ""
                      }`}
                      title={`${idx + 1}. Kalite Kontrol: ${p.name}`}
                    >
                      {/* SVG Isosceles Triangle Background */}
                      <svg className="absolute inset-0 w-full h-full drop-shadow-md" viewBox="0 0 100 85" preserveAspectRatio="none">
                        <polygon
                          points="50,4 98,80 2,80"
                          fill={isBn ? "#881337" : isSelected ? "#78350F" : "#1E293B"}
                          stroke={isBn ? "#EF4444" : isSelected ? "#F59E0B" : "#D97706"}
                          strokeWidth={isSelected || isBn ? "3" : "2"}
                          className="transition-all"
                        />
                      </svg>

                      {/* Content inside Triangle */}
                      <div className="relative z-10 flex flex-col items-center justify-center text-center px-3 pt-3.5 text-amber-200">
                        <span className="text-[8.5px] font-black uppercase tracking-wider bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-500/40">
                          #{idx + 1} • Kontrol
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-tight leading-tight line-clamp-2 my-0.5 max-w-[105px] text-amber-100">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-bold font-mono text-emerald-400">
                          {ct > 0 ? `${ct.toFixed(1)}s` : "—"}
                        </span>
                        <button
                          onClick={(e) => handleToggleStepShape(p.id, e)}
                          className="text-[8px] text-amber-400/80 hover:text-white transition mt-0.5"
                          title="Bu adımı Proses (Dikdörtgen) yap"
                        >
                          🟦 Proses Yap
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Connecting Arrow */}
                  <div className="shrink-0 flex items-center px-1">
                    <ArrowRight className="w-5 h-5 text-sky-400 animate-pulse" />
                  </div>
                </React.Fragment>
              );
            })}

            {/* 3. END NODE (Yuvarlak / Oval Pill) */}
            <div className="shrink-0 flex items-center space-x-2.5 bg-gradient-to-r from-rose-700 to-red-800 text-white px-5 py-3 rounded-full border-2 border-rose-400 shadow-md h-[80px] select-none">
              <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center shrink-0 border border-rose-300 shadow-xs">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider text-rose-100">İş Bitişi</span>
                <span className="text-[9px] font-semibold text-rose-200/80">Tamamlanan Ürün</span>
              </div>
            </div>

          </div>
        </div>

        {/* Flowchart Legend & Tips */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[10.5px] text-slate-400 pt-2 border-t border-slate-800/80 font-sans">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-extrabold text-slate-300 uppercase text-[9.5px]">Şema Lejandı:</span>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 border border-emerald-400 inline-block"></span>
              <span>Yuvarlak/Oval = İş Başlangıcı &amp; Bitişi</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-2.5 bg-sky-900 border border-sky-400 rounded-xs inline-block"></span>
              <span>Dikdörtgen = Proses / Operasyon</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-amber-400 font-black">🔺</span>
              <span>Üçgen = Kalite Kontrol</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-2.5 bg-rose-900 border border-rose-500 rounded-xs inline-block animate-pulse"></span>
              <span className="text-rose-300 font-bold">Kırmızı Çerçeve = Darboğaz Operasyonu</span>
            </div>
          </div>
          <span className="text-[9.5px] text-slate-500 italic">
            * Kutulara tıklayarak tablodan detaylı gözlem ölçümlerine geçiş yapabilirsiniz.
          </span>
        </div>
      </div>
    );
  };

  // SVG representation for Page 1 Cycle Bar Chart with a Delta range marker
  const renderCycleChartSvg = (maximized: boolean) => {
    if (!activeProcess || activeProcess.cy.length === 0) return null;
    
    const sortedCycles = [...activeProcess.cy].sort((a, b) => a - b);
    const mn = Math.min(...activeProcess.cy);
    const mx = Math.max(...activeProcess.cy);
    const modeVal = getMode(activeProcess.cy);
    const delta = mx - mn;

    // SVG parameters
    const svgWidth = maximized ? 960 : 460;
    const svgHeight = maximized ? 320 : 175;
    const paddingLeft = 40;
    const paddingRight = maximized ? 110 : 65; // Extra right space for the delta arrow
    const paddingTop = 25;
    const paddingBottom = 25;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    const highestVal = Math.max(mx, taktTime, modeVal, 10) * 1.15;
    const scaleY = chartHeight / highestVal;

    const barWidth = Math.max(maximized ? 24 : 12, Math.min(maximized ? 64 : 32, (chartWidth / sortedCycles.length) * 0.65));
    const barSpacing = (chartWidth - barWidth * sortedCycles.length) / (sortedCycles.length + 1 || 1);

    // Positions for arrow
    const arrowX = svgWidth - paddingRight + (maximized ? 40 : 24);
    const arrowYMin = paddingTop + chartHeight - mn * scaleY;
    const arrowYMax = paddingTop + chartHeight - mx * scaleY;

    return (
      <svg width="100%" height={svgHeight} className="bg-slate-50 border border-slate-200 rounded-xl select-none" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <g>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((p, idx) => {
            const level = highestVal * p;
            const y = paddingTop + chartHeight - level * scaleY;
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={svgWidth - paddingRight} y2={y} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="3,3" />
                <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[9px] font-semibold font-mono fill-slate-400">
                  {Math.round(level)}
                </text>
              </g>
            );
          })}

          {/* Takt Line (Red) */}
          {taktTime > 0 && (
            <g>
              <line 
                x1={paddingLeft} 
                y1={paddingTop + chartHeight - taktTime * scaleY} 
                x2={svgWidth - paddingRight} 
                y2={paddingTop + chartHeight - taktTime * scaleY} 
                stroke="#DC2626" 
                strokeWidth={1.5} 
                strokeDasharray="4,2" 
              />
              <text x={svgWidth - paddingRight + 4} y={paddingTop + chartHeight - taktTime * scaleY + 3} className="text-[8px] font-extrabold fill-red-650">
                Takt {taktTime}s
              </text>
            </g>
          )}

          {/* Mode/CT Line (Blue) */}
          {modeVal > 0 && (
            <g>
              <line 
                x1={paddingLeft} 
                y1={paddingTop + chartHeight - modeVal * scaleY} 
                x2={svgWidth - paddingRight} 
                y2={paddingTop + chartHeight - modeVal * scaleY} 
                stroke="#1D6FF2" 
                strokeWidth={1.5} 
                strokeDasharray="4,2" 
              />
              <text x={svgWidth - paddingRight + 4} y={paddingTop + chartHeight - modeVal * scaleY + 3} className="text-[8px] font-extrabold fill-blue-650">
                Mod {modeVal}s
              </text>
            </g>
          )}

          {/* Cycle Bars */}
          {sortedCycles.map((val, idx) => {
            const barX = paddingLeft + barSpacing + idx * (barWidth + barSpacing);
            const barH = val * scaleY;
            const barY = paddingTop + chartHeight - barH;

            // Determine colors: amber/gold for Mode, red for Max (if > 1 entry), green otherwise
            const isMode = val === modeVal;
            const isHi = val === mx && sortedCycles.length > 1;
            const fillCol = isMode ? "#F59E0B" : isHi ? "#DC2626" : "#16A34A";

            return (
              <g key={idx} className="group">
                <rect 
                  x={barX} 
                  y={barY} 
                  width={barWidth} 
                  height={barH} 
                  fill={fillCol} 
                  rx={2} 
                  opacity={0.8}
                  className="transition-all hover:opacity-100" 
                />
                <text x={barX + barWidth / 2} y={barY - 5} textAnchor="middle" className="text-[9px] font-black font-mono" fill={fillCol}>
                  {val}
                </text>

                {/* Downward pointing arrow above the mode (most frequent) value */}
                {isMode && (
                  <g>
                    <line x1={barX + barWidth / 2} y1={barY - 22} x2={barX + barWidth / 2} y2={barY - 11} stroke="#F59E0B" strokeWidth={1.5} />
                    <polygon points={`${barX + barWidth / 2},${barY - 10} ${barX + barWidth / 2 - 3},${barY - 14} ${barX + barWidth / 2 + 3},${barY - 14}`} fill="#F59E0B" />
                    <text x={barX + barWidth / 2} y={barY - 26} textAnchor="middle" className="text-[7.5px] font-extrabold fill-amber-600 font-sans">EN SIK</text>
                  </g>
                )}

                <text x={barX + barWidth / 2} y={paddingTop + chartHeight + 14} textAnchor="middle" className="text-[8px] font-black fill-slate-400">
                  Ö{idx + 1}
                </text>
              </g>
            );
          })}

          {/* Delta Arrow and Range label */}
          {sortedCycles.length >= 2 && (
            <g>
              <line x1={arrowX} y1={arrowYMin} x2={arrowX} y2={arrowYMax} stroke="#DC2626" strokeWidth={1.5} />
              
              {/* Arrowheads */}
              <polygon points={`${arrowX},${arrowYMax} ${arrowX - 4},${arrowYMax + 7} ${arrowX + 4},${arrowYMax + 7}`} fill="#DC2626" />
              <polygon points={`${arrowX},${arrowYMin} ${arrowX - 4},${arrowYMin - 7} ${arrowX + 4},${arrowYMin - 7}`} fill="#DC2626" />
              
              {/* Text label next to the arrow */}
              <text x={arrowX + 7} y={(arrowYMin + arrowYMax) / 2 + 3} className="text-[10px] font-black fill-red-650 font-sans">
                Δ{delta.toFixed(1)}s
              </text>
            </g>
          )}

          {/* Borders */}
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke="#CBD5E1" strokeWidth={1} />
          <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={svgWidth - paddingRight} y2={paddingTop + chartHeight} stroke="#CBD5E1" strokeWidth={1} />
        </g>
      </svg>
    );
  };

  // SVG representation for All Processes Comparison Chart (Gap between Bottleneck and Min CT)
  const renderComparisonChartSvg = (maximized: boolean) => {
    if (processes.length === 0) return null;

    // SVG parameters
    const svgWidth = maximized ? 960 : 460;
    const svgHeight = maximized ? 320 : 160;
    const paddingLeft = 40;
    const paddingRight = maximized ? 110 : 65;
    const paddingTop = 25;
    const paddingBottom = 25;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    // Get CTs
    const cts = processes.map(p => ({
      id: p.id,
      name: p.name,
      ct: getProcessCT(p),
      hasMeasurements: p.cy.length > 0
    }));

    const maxCT = Math.max(...cts.map(c => c.ct), 5);
    const measuredCts = cts.filter(c => c.hasMeasurements);
    const minCT = measuredCts.length > 0 ? Math.min(...measuredCts.map(c => c.ct)) : 0;

    const highestVal = Math.max(maxCT, taktTime, 10) * 1.15;
    const scaleY = chartHeight / highestVal;

    const barWidth = Math.max(maximized ? 12 : 6, Math.min(maximized ? 48 : 24, (chartWidth / processes.length) * 0.7));
    const barSpacing = (chartWidth - barWidth * processes.length) / (processes.length + 1 || 1);

    return (
      <svg width="100%" height={svgHeight} className="bg-slate-50 border border-slate-200 rounded-xl select-none" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        <g>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((p, idx) => {
            const level = highestVal * p;
            const y = paddingTop + chartHeight - level * scaleY;
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={svgWidth - paddingRight} y2={y} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="3,3" />
                <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[9px] font-semibold font-mono fill-slate-400">
                  {Math.round(level)}
                </text>
              </g>
            );
          })}

          {/* Takt Line (Red) */}
          {taktTime > 0 && (
            <g>
              <line 
                x1={paddingLeft} 
                y1={paddingTop + chartHeight - taktTime * scaleY} 
                x2={svgWidth - paddingRight} 
                y2={paddingTop + chartHeight - taktTime * scaleY} 
                stroke="#DC2626" 
                strokeWidth={1.5} 
                strokeDasharray="4,2" 
              />
              <text x={svgWidth - paddingRight + 4} y={paddingTop + chartHeight - taktTime * scaleY + 3} className="text-[8px] font-extrabold fill-red-650">
                Takt {taktTime}s
              </text>
            </g>
          )}

          {/* Bottleneck Line (Red) */}
          {maxCT > 0 && (
            <g>
              <line 
                x1={paddingLeft} 
                y1={paddingTop + chartHeight - maxCT * scaleY} 
                x2={svgWidth - paddingRight} 
                y2={paddingTop + chartHeight - maxCT * scaleY} 
                stroke="#EF4444" 
                strokeWidth={1} 
                strokeDasharray="2,2" 
              />
              <text x={svgWidth - paddingRight + 4} y={paddingTop + chartHeight - maxCT * scaleY + 3} className="text-[8px] font-bold fill-red-500">
                Darboğaz {maxCT.toFixed(1)}s
              </text>
            </g>
          )}

          {/* Min CT Line (Green/Orange) */}
          {minCT > 0 && (
            <g>
              <line 
                x1={paddingLeft} 
                y1={paddingTop + chartHeight - minCT * scaleY} 
                x2={svgWidth - paddingRight} 
                y2={paddingTop + chartHeight - minCT * scaleY} 
                stroke="#10B981" 
                strokeWidth={1} 
                strokeDasharray="2,2" 
              />
              <text x={svgWidth - paddingRight + 4} y={paddingTop + chartHeight - minCT * scaleY + 3} className="text-[8px] font-bold fill-emerald-600">
                En Hızlı {minCT.toFixed(1)}s
              </text>
            </g>
          )}

          {/* Process Bars */}
          {cts.map((c, idx) => {
            const barX = paddingLeft + barSpacing + idx * (barWidth + barSpacing);
            const barH = c.ct * scaleY;
            const barY = paddingTop + chartHeight - barH;

            const isBottleneck = c.ct === maxCT && maxCT > 0;
            const isMin = c.ct === minCT && minCT > 0;
            const isActive = c.id === selectedProcessId;

            // Colors: Red for Bottleneck, Emerald for Min, Blue for active, Slate for others
            let fillCol = "#94A3B8"; // default Slate
            if (isBottleneck) fillCol = "#EF4444";
            else if (isMin) fillCol = "#10B981";
            else if (isActive) fillCol = "#3B82F6";

            return (
              <g 
                key={c.id} 
                className="group cursor-pointer"
                onClick={() => setSelectedProcessId(c.id)}
              >
                {/* Invisible hover area for easier clicking */}
                <rect
                  x={barX - barSpacing/2}
                  y={paddingTop}
                  width={barWidth + barSpacing}
                  height={chartHeight + paddingBottom}
                  fill="transparent"
                />
                <rect 
                  x={barX} 
                  y={barY} 
                  width={barWidth} 
                  height={barH} 
                  fill={fillCol} 
                  rx={1.5} 
                  className={`transition-all ${isActive ? 'stroke-blue-600 stroke-2 ring-1 ring-blue-500' : 'opacity-80 hover:opacity-100'}`}
                />
                {/* CT label on hover or if important */}
                {(isActive || isBottleneck || isMin) && (
                  <text 
                    x={barX + barWidth / 2} 
                    y={barY - 4} 
                    textAnchor="middle" 
                    className="text-[8px] font-black font-mono" 
                    fill={fillCol}
                  >
                    {c.ct > 0 ? c.ct.toFixed(0) : "0"}
                  </text>
                )}
                <text 
                  x={barX + barWidth / 2} 
                  y={paddingTop + chartHeight + 11} 
                  textAnchor="middle" 
                  className={`text-[7px] font-bold ${isActive ? 'fill-blue-600 font-black' : 'fill-slate-400'}`}
                >
                  P{idx + 1}
                </text>
                {/* Tooltip on SVG */}
                <title>{`Proses ${idx + 1}: ${c.name}\nSüre: ${c.ct.toFixed(1)} sn${isBottleneck ? ' (Darboğaz)' : ''}${isMin ? ' (En Hızlı)' : ''}`}</title>
              </g>
            );
          })}

          {/* Borders */}
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke="#CBD5E1" strokeWidth={1} />
          <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={svgWidth - paddingRight} y2={paddingTop + chartHeight} stroke="#CBD5E1" strokeWidth={1} />
        </g>
      </svg>
    );
  };

  // SVG representation of Standard Work Combination Gantt Chart (Recreated 100% 1-to-1 from HTML)
  const renderCombinationSvg = (maximized: boolean) => {
    const sorted = [...ccEls].sort((a, b) => a.seq - b.seq);
    if (sorted.length === 0) return null;

    const rowHeight = 44;
    const paddingLeft = 230;
    const paddingRight = 80;
    const paddingTop = 44;
    const paddingBottom = 48;

    // Apply zoom multiplier
    const zoomMultiplier = zoomLevel / 100;

    const totalDuration = ccTotals.total;
    const maxT = Math.max(totalDuration * 1.18, calcTakt * 1.25, 10);

    const canvasWidth = (maximized ? 1200 : 760) * zoomMultiplier;
    const chartWidth = canvasWidth - paddingLeft - paddingRight;
    const chartHeight = sorted.length * rowHeight;

    const scaleX = chartWidth / maxT;
    const taktX = paddingLeft + calcTakt * scaleX;

    const svgWidth = canvasWidth;
    const svgHeight = chartHeight + paddingTop + paddingBottom;

    // Tick intervals
    const tickInterval = maxT > 200 ? 60 : maxT > 100 ? 30 : maxT > 60 ? 20 : maxT > 30 ? 10 : 5;

    const ticks = [];
    for (let t = 0; t <= maxT; t += tickInterval) {
      ticks.push(t);
    }

    const drawWalkingLine = (x1: number, y: number, w: number, h: number) => {
      const stepCount = Math.max(3, Math.floor(w / 12));
      const xStep = w / stepCount;
      const yStep = h / stepCount;
      let d = `M ${x1} ${y}`;
      for (let i = 0; i < stepCount; i++) {
        const cx = x1 + i * xStep;
        const cy = y + i * yStep;
        d += ` L ${cx + xStep} ${cy} L ${cx + xStep} ${cy + yStep}`;
      }
      return d;
    };

    return (
      <div className="relative overflow-x-auto w-full border border-slate-200 rounded-2xl bg-slate-50/50 p-2 scrollbar-thin">
        <svg 
          width={svgWidth} 
          height={svgHeight} 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="select-none bg-white rounded-xl shadow-xs transition-all duration-250" 
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          <defs>
            <pattern id="mp2" x="0" y="0" width="8" height="4" patternUnits="userSpaceOnUse">
              <line x1="0" y1="2" x2="8" y2="2" stroke="#0891B2" strokeWidth="1.5" />
              <rect x="1" y="0.5" width="2.5" height="3" fill="#0891B2" opacity="0.2" />
            </pattern>
          </defs>

          {/* Chart Area Background */}
          <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill="#F8FAFC" rx={4} />

          {/* Ticks & Grid Lines */}
          {ticks.map(t => {
            const tx = paddingLeft + t * scaleX;
            return (
              <g key={t}>
                <line x1={tx} y1={paddingTop} x2={tx} y2={paddingTop + chartHeight} stroke="#E2E8F0" strokeWidth={1} />
                <text x={tx} y={paddingTop + chartHeight + 14} textAnchor="middle" className="text-[9px] font-bold fill-slate-450 font-mono">
                  {t}s
                </text>
              </g>
            );
          })}

          {/* Row dividers & backgrounds */}
          {sorted.map((el, idx) => {
            const ry = paddingTop + idx * rowHeight;
            const isEven = idx % 2 === 0;
            return (
              <g key={`bg-${el.id}`}>
                {isEven && (
                  <rect x={paddingLeft} y={ry} width={chartWidth} height={rowHeight} fill="#F1F5F9" opacity={0.35} />
                )}
              </g>
            );
          })}

          {/* Row Headers Text labels */}
          {sorted.map((el, idx) => {
            const ry = paddingTop + idx * rowHeight;
            const centerY = ry + rowHeight / 2;
            const cfg = TYPE_CONFIG[el.type] || TYPE_CONFIG.manual;
            const displayLabel = el.desc.length > 28 ? el.desc.slice(0, 27) + "…" : el.desc;

            return (
              <g key={`lbl-${el.id}`}>
                <text x={paddingLeft - 8} y={centerY - 2} textAnchor="end" className="text-[10.5px] font-black fill-slate-900 tracking-tight">
                  {el.seq}. {displayLabel}
                </text>
                <text x={paddingLeft - 8} y={centerY + 9} textAnchor="end" className="text-[8.5px] font-extrabold uppercase tracking-wider" fill={cfg.color}>
                  {el.operationMode === "parallel" ? "⇅ Paralel" : "⟶ Sıralı"} • {cfg.marker} {cfg.label.split(" ")[0]}
                </text>
              </g>
            );
          })}

          {/* Gantt Bars rendering */}
          {sorted.map((el, idx) => {
            const ry = paddingTop + idx * rowHeight;
            const cfg = TYPE_CONFIG[el.type] || TYPE_CONFIG.manual;
            const barHeight = rowHeight * 0.42;
            const barY = ry + (rowHeight - barHeight) / 2;

            const resolvedEl = resolvedElements.find(r => r.id === el.id);
            const startTime = resolvedEl ? resolvedEl.startTime : 0;
            const endTime = resolvedEl ? resolvedEl.endTime : startTime + el.time;

            const barX = paddingLeft + startTime * scaleX;
            const barWidth = Math.max(el.time * scaleX, 4);

            return (
              <g 
                key={`bar-${el.id}`}
                className="cursor-pointer group"
                onMouseEnter={(e) => handleElementMouseEnter(e, resolvedEl || { ...el, startTime, endTime })}
                onMouseLeave={handleElementMouseLeave}
              >
                {/* Active hover row glow highlight */}
                <rect 
                  x={paddingLeft} 
                  y={ry + 1} 
                  width={chartWidth} 
                  height={rowHeight - 2} 
                  fill={cfg.color} 
                  opacity={0} 
                  className="group-hover:opacity-[0.03] transition-opacity duration-150 pointer-events-none"
                />

                {/* --- MANUEL IS (Manual Work) --- */}
                {el.type === "manual" && (
                  <rect x={barX} y={barY} width={barWidth} height={barHeight} fill={cfg.color} stroke={cfg.color} strokeWidth={1} rx={3} opacity={0.88} />
                )}

                {/* --- YURUME (Walking Toyota step-down zigzag) --- */}
                {el.type === "walking" && (
                  <g>
                    <rect x={barX} y={barY} width={barWidth} height={barHeight} fill={cfg.color} rx={3} opacity={0.06} />
                    <path d={drawWalkingLine(barX, barY + 2, barWidth, barHeight - 4)} fill="none" stroke={cfg.color} strokeWidth={2.5} strokeLinejoin="round" />
                  </g>
                )}

                {/* --- MAKINE CALISMASI (Machine Independent double red arrow) --- */}
                {el.type === "machine" && (
                  <g>
                    <rect x={barX} y={barY + barHeight * 0.15} width={barWidth} height={barHeight * 0.7} fill="#ECFEFF" stroke={cfg.color} strokeWidth={2.5} rx={3} />
                    <text x={barX + barWidth / 2} y={barY + barHeight / 2 + 3} textAnchor="middle" className="text-[12px] font-black pointer-events-none" fill="#EF4444">
                      ⇆
                    </text>
                  </g>
                )}

                {/* --- BEKLEME (Waiting light red dashed) --- */}
                {el.type === "waiting" && (
                  <g>
                    <rect x={barX} y={barY} width={barWidth} height={barHeight} fill="#FEF2F2" stroke="#EF4444" strokeWidth={1.8} strokeDasharray="3,3" rx={3} />
                  </g>
                )}

                {/* --- KONTROL (Inspection amber bar) --- */}
                {el.type === "inspection" && (
                  <rect x={barX} y={barY} width={barWidth} height={barHeight} fill={cfg.color} stroke="#B45309" strokeWidth={1} rx={3} opacity={0.85} />
                )}

                {/* --- PARALEL ISLEM (Parallel emerald bar) --- */}
                {el.type === "parallel" && (
                  <g>
                    <rect x={barX} y={barY} width={barWidth} height={barHeight} fill="#D1FAE5" stroke={cfg.color} strokeWidth={1.8} rx={3} />
                    <line x1={barX} y1={barY} x2={barX + barWidth} y2={barY + barHeight} stroke={cfg.color} strokeWidth={1.5} strokeDasharray="2,2" opacity={0.7} />
                  </g>
                )}

                {/* Start anchor circle for clear visual flow */}
                <circle cx={barX} cy={barY + barHeight / 2} r={3} fill={cfg.color} />

                {/* Duration Text inside or right of the bar */}
                <text 
                  x={barX + barWidth + 4} 
                  y={barY + barHeight / 2 + 3.5} 
                  className="text-[9.5px] font-bold font-mono" 
                  fill={cfg.color}
                >
                  {el.time}s
                </text>
              </g>
            );
          })}

          {/* Takt Target Line */}
          {calcTakt > 0 && (
            <g>
              <line x1={taktX} y1={paddingTop} x2={taktX} y2={paddingTop + chartHeight} stroke="#DC2626" strokeWidth={2.5} strokeDasharray="6,3" />
              <polygon points={`${taktX},${paddingTop - 12} ${taktX - 7},${paddingTop} ${taktX + 7},${paddingTop}`} fill="#DC2626" />
              <text x={taktX} y={paddingTop - 15} textAnchor="middle" className="text-[10px] font-black fill-red-650 tracking-wider">
                TAKT HEDEFİ: {calcTakt.toFixed(1)}s
              </text>
            </g>
          )}

          {/* Total Cycle Time vertical helper */}
          {totalDuration > 0 && (
            <g>
              <line 
                x1={paddingLeft + totalDuration * scaleX} 
                y1={paddingTop} 
                x2={paddingLeft + totalDuration * scaleX} 
                y2={paddingTop + chartHeight} 
                stroke={totalDuration > calcTakt ? "#DC2626" : "#16A34A"} 
                strokeWidth={2} 
                strokeDasharray="4,2" 
                opacity={0.8} 
              />
              <text 
                x={paddingLeft + totalDuration * scaleX + 5} 
                y={paddingTop + 13} 
                className="text-[10px] font-black uppercase tracking-wider" 
                fill={totalDuration > calcTakt ? "#DC2626" : "#16A34A"}
              >
                Çevrim: {totalDuration.toFixed(1)}s {totalDuration > calcTakt ? "(DARBOĞAZ)" : ""}
              </text>
            </g>
          )}

          {/* Grid Axis Base Borders */}
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + chartHeight} stroke="#94A3B8" strokeWidth={1.5} />
          <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={paddingLeft + chartWidth} y2={paddingTop + chartHeight} stroke="#94A3B8" strokeWidth={1.5} />

          {/* X Axis Label */}
          <text x={paddingLeft + chartWidth / 2} y={paddingTop + chartHeight + 42} textAnchor="middle" className="text-[10px] font-black fill-slate-500 uppercase tracking-widest">
            Kümülatif Zaman Ölçeği (Saniye)
          </text>
        </svg>

        {/* Dynamic Absolute Hover HTML Tooltip */}
        {hoveredEl && (
          <div 
            className="absolute bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/50 text-[11px] pointer-events-none z-30 space-y-1 w-56 backdrop-blur-xs animate-fadeIn font-sans"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y}px`, 
              transform: "translate(-50%, -100%)" 
            }}
          >
            <div className="font-extrabold text-[11.5px] border-b border-slate-700 pb-1 mb-1 text-cyan-400 uppercase truncate">
              {hoveredEl.desc}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Sıra No:</span>
              <span className="font-bold">{hoveredEl.seq}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Aktivite Tipi:</span>
              <span className="font-bold uppercase text-[9.5px] text-sky-350">{TYPE_CONFIG[hoveredEl.type]?.label.split(" ")[0] || hoveredEl.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Çalışma Modu:</span>
              <span className="font-bold capitalize">{hoveredEl.operationMode || "sequential"}</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/80 pt-1 mt-1">
              <span className="text-slate-400">Süre (Duration):</span>
              <span className="font-bold font-mono text-emerald-400">{hoveredEl.time}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Başlangıç (Start):</span>
              <span className="font-bold font-mono">{hoveredEl.startTime}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Bitiş (End):</span>
              <span className="font-bold font-mono">{hoveredEl.endTime}s</span>
            </div>
            <div className="flex justify-between border-t border-slate-800/80 pt-1 mt-1">
              <span className="text-slate-400">Lean Sınıfı:</span>
              <span className={`font-bold text-[9.5px] uppercase ${
                hoveredEl.type === "manual" || hoveredEl.type === "parallel"
                  ? "text-emerald-400"
                  : hoveredEl.type === "inspection"
                    ? "text-amber-400"
                    : "text-rose-400"
              }`}>
                {hoveredEl.type === "manual" || hoveredEl.type === "parallel"
                  ? "Değer Katan (VA)"
                  : hoveredEl.type === "inspection"
                    ? "Gerekli İsraf (NNVA)"
                    : "İsraf / Kayıp (NVA)"}
              </span>
            </div>
            {hoveredEl.operator && (
              <div className="flex justify-between border-t border-slate-800/80 pt-1 mt-1">
                <span className="text-slate-400">Operatör:</span>
                <span className="font-bold text-sky-200">{hoveredEl.operator}</span>
              </div>
            )}
            {hoveredEl.station && (
              <div className="flex justify-between">
                <span className="text-slate-400">İstasyon:</span>
                <span className="font-bold">{hoveredEl.station}</span>
              </div>
            )}
            {hoveredEl.machineName && (
              <div className="flex justify-between">
                <span className="text-slate-400">Makine:</span>
                <span className="font-semibold text-rose-300">{hoveredEl.machineName}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Save study to historical list
  const handleSaveStudy = () => {
    const studyId = `std_${Date.now()}`;
    const newStudy: StudyRecord = {
      id: studyId,
      customerId: selectedCustomer.id,
      lineName: lineName.trim() || "Hat A",
      productName: productName.trim() || "Ürün 1",
      shiftHours,
      taktTime,
      createdAt: new Date().toLocaleString("tr-TR"),
      processes,
      ccAvail,
      ccDemand,
      ccEls
    };

    const updated = [newStudy, ...savedStudies];
    setSavedStudies(updated);
    localStorage.setItem("gemba_time_studies", JSON.stringify(updated));
    alert("Zaman etüdü çalışması başarıyla kaydedildi!");
  };

  // Load study from history
  const handleLoadStudy = (record: StudyRecord) => {
    setLineName(record.lineName);
    setProductName(record.productName);
    setShiftHours(record.shiftHours);
    setTaktTime(record.taktTime);
    setProcesses(record.processes);
    setCcAvail(record.ccAvail || 27000);
    setCcDemand(record.ccDemand || 450);
    setCcEls(record.ccEls || []);
    if (record.processes.length > 0) {
      setSelectedProcessId(record.processes[0].id);
    }
    setShowHistoryDropdown(false);
  };

  // Delete saved study from history
  const handleDeleteStudy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Bu kayıtlı zaman etüdünü silmek istediğinize emin misiniz?")) return;
    const updated = savedStudies.filter(s => s.id !== id);
    setSavedStudies(updated);
    localStorage.setItem("gemba_time_studies", JSON.stringify(updated));
  };

  // New Time Study Action
  const handleNewTimeStudy = () => {
    setProductName("Yeni Ürün");
    setLineName("Yeni Hat");
    setShiftHours(8);
    setTaktTime(60);
    setCcAvail(28800);
    setCcDemand(480);
    setProcesses([
      { id: 1, name: "SÜNGER + KOMPONENT HAZ", mct: 0, co: 0, cy: [] },
      { id: 2, name: "ÖRTÜ GEÇİRME", mct: 0, co: 0, cy: [] },
      { id: 3, name: "YAY", mct: 0, co: 0, cy: [] },
      { id: 4, name: "KISA AYAK + ETİKET", mct: 0, co: 0, cy: [] },
      { id: 5, name: "SUB AYAK PLASTİK", mct: 0, co: 0, cy: [] },
      { id: 6, name: "AYAK PLASTİK + GENİŞ", mct: 0, co: 0, cy: [] },
      { id: 7, name: "SUB GENİŞ AYAK PLASTİK", mct: 0, co: 0, cy: [] },
      { id: 8, name: "PUL TAKMA", mct: 0, co: 0, cy: [] },
      { id: 9, name: "MİL GEÇİRME", mct: 0, co: 0, cy: [] },
      { id: 10, name: "MİL PLASTİK PARÇA", mct: 0, co: 0, cy: [] },
      { id: 11, name: "BURÇ ÇAKMA", mct: 0, co: 0, cy: [] },
      { id: 12, name: "KALİTE KONTROL", mct: 0, co: 0, cy: [] },
      { id: 13, name: "ETİKET", mct: 0, co: 0, cy: [] },
      { id: 14, name: "SHRİNK KONVEYOR", mct: 0, co: 0, cy: [] },
      { id: 15, name: "SHRİNK", mct: 0, co: 0, cy: [] },
      { id: 16, name: "VAKUM", mct: 0, co: 0, cy: [] },
      { id: 17, name: "ETİKET + KUTUYA HAZ.", mct: 0, co: 0, cy: [] },
      { id: 18, name: "KUTULAMA", mct: 0, co: 0, cy: [] },
      { id: 19, name: "PAKET", mct: 0, co: 0, cy: [] }
    ]);
    setSelectedProcessId(1);
    setCcEls([]);
    setShowResetConfirm(false);
  };

  // XLS Exporter
  const handleDownloadXLS = () => {
    let html = "";
    let fileName = "";
    
    if (activeTab === "study") {
      fileName = `${productName.replace(/\s+/g, "_")}_Time_Study_Raporu.xls`;
      html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
          <style>
            table { border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; }
            td { border: 1px solid #cbd5e1; padding: 6px; font-size: 11px; }
            .title { font-size: 16px; font-weight: bold; color: #0f172a; padding: 10px 0; }
            .metadata { font-size: 11px; color: #334155; padding: 2px 0; }
            .header-row { height: 30px; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="8" class="title" style="font-size: 18px; font-weight: bold;">ZAMAN ETÜDÜ & KAPASİTE RAPORU</td></tr>
            <tr><td colspan="8" class="metadata"><b>Müşteri:</b> ${selectedCustomer.companyName}</td></tr>
            <tr><td colspan="8" class="metadata"><b>Hat / Lokasyon:</b> ${lineName}</td></tr>
            <tr><td colspan="8" class="metadata"><b>Ürün Adı:</b> ${productName}</td></tr>
            <tr><td colspan="8" class="metadata"><b>Vardiya Çalışma Süresi:</b> ${shiftHours} Saat</td></tr>
            <tr><td colspan="8" class="metadata"><b>Hedef Takt Zamanı:</b> ${taktTime} sn</td></tr>
            <tr><td colspan="8"></td></tr>
            <tr class="header-row">
              <th style="background-color: #0f172a; color: white;">#</th>
              <th style="background-color: #0f172a; color: white; text-align: left;">Proses Adımı</th>
              <th style="background-color: #0f172a; color: white; text-align: right;">CT (sn)</th>
              <th style="background-color: #0f172a; color: white; text-align: right;">Mak. CT (sn)</th>
              <th style="background-color: #0f172a; color: white; text-align: right;">C/O Setup (sn)</th>
              <th style="background-color: #0f172a; color: white; text-align: right;">Saatlik Kapasite</th>
              <th style="background-color: #0f172a; color: white; text-align: right;">Vardiya Kapasitesi</th>
              <th style="background-color: #0f172a; color: white; text-align: right;">C/O Kayıp (ad)</th>
            </tr>
      `;
      
      processes.forEach((p, idx) => {
        const ct = getProcessCT(p);
        html += `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="font-weight: bold; color: #334155;">${p.name}</td>
            <td style="text-align: right; font-weight: bold; color: ${ct > taktTime ? '#dc2626' : '#16a34a'};">${ct > 0 ? ct.toFixed(1) : "—"}</td>
            <td style="text-align: right; color: #0891b2;">${p.mct > 0 ? p.mct.toFixed(1) : "—"}</td>
            <td style="text-align: right; color: #ea580c;">${p.co > 0 ? p.co.toFixed(1) : "—"}</td>
            <td style="text-align: right;">${getHourlyCapacity(ct) > 0 ? getHourlyCapacity(ct) + ' ad' : "—"}</td>
            <td style="text-align: right; font-weight: bold;">${getShiftCapacity(ct) > 0 ? getShiftCapacity(ct) + ' ad' : "—"}</td>
            <td style="text-align: right; color: #ea580c;">${getCoLossAmount(p) > 0 ? getCoLossAmount(p) + ' ad' : "—"}</td>
          </tr>
        `;
      });
      
      html += `
          </table>
        </body>
        </html>
      `;
    } else {
      fileName = `${productName.replace(/\s+/g, "_")}_SWCC_Kombinasyon_Raporu.xls`;
      html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
          <style>
            table { border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; }
            td { border: 1px solid #cbd5e1; padding: 6px; font-size: 11px; }
            .title { font-size: 16px; font-weight: bold; color: #0f172a; padding: 10px 0; }
            .metadata { font-size: 11px; color: #334155; padding: 2px 0; }
            .header-row { height: 30px; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="5" class="title" style="font-size: 18px; font-weight: bold;">STANDART İŞ KOMBİNASYON RAPORU (SWCC)</td></tr>
            <tr><td colspan="5" class="metadata"><b>Müşteri:</b> ${selectedCustomer.companyName}</td></tr>
            <tr><td colspan="5" class="metadata"><b>Hat / Lokasyon:</b> ${lineName}</td></tr>
            <tr><td colspan="5" class="metadata"><b>Ürün Adı:</b> ${productName}</td></tr>
            <tr><td colspan="5"></td></tr>
            <tr class="header-row">
              <th style="background-color: #0f172a; color: white;">Sıra</th>
              <th style="background-color: #0f172a; color: white; text-align: left;">Açıklama</th>
              <th style="background-color: #0f172a; color: white; text-align: right;">Süre (sn)</th>
              <th style="background-color: #0f172a; color: white;">Aktivite Tipi</th>
              <th style="background-color: #0f172a; color: white;">Makine Beklemesi Var mı?</th>
            </tr>
      `;
      
      const sorted = [...ccEls].sort((a, b) => a.seq - b.seq);
      sorted.forEach(el => {
        const typeLabel = el.type === "machine" ? "Otomatik Makine" : el.type === "walking" ? "Yürüme" : el.type === "waiting" ? "Bekleme" : "Manuel İş";
        html += `
          <tr>
            <td style="text-align: center;">${el.seq}</td>
            <td style="font-weight: bold; color: #334155;">${el.desc}</td>
            <td style="text-align: right; font-weight: bold; font-family: monospace;">${el.time}</td>
            <td>${typeLabel}</td>
            <td style="text-align: center; color: ${el.hasMachineWaiting ? '#ea580c' : '#64748b'}; font-weight: bold;">${el.hasMachineWaiting ? "Evet" : "Hayır"}</td>
          </tr>
        `;
      });
      
      html += `
          </table>
        </body>
        </html>
      `;
    }
    
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* TOP HEADER SECTION WITH CUSTOM CUSTOMER SPECIFIC SAVE & LOAD DRAWER */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="p-1.5 bg-rose-600 rounded-lg text-white">
              <Clock className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black tracking-tight uppercase font-sans">
              ZAMAN ETÜDÜ &amp; STANDART İŞ ANALİZÖRÜ
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Gemba Digital standart zaman etüdü ölçümlerini mod değerlerine göre hesaplar, darboğazları izler, otomatik işlerde bekleme analizli Standart İş Kombinasyon Gantt şemaları çizer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0 relative">
          
          {/* HISTORY DROPDOWN LINK */}
          <div className="relative">
            <button
              onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
              className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs py-2 px-3.5 rounded-xl border border-slate-700 flex items-center space-x-2 shadow cursor-pointer transition h-10"
            >
              <Database className="w-4 h-4 text-rose-500" />
              <span>Kayıtlar Linki ({currentCustomerStudies.length})</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {showHistoryDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 max-h-96 overflow-y-auto">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Kayıtlı Zaman Etütleri
                </div>
                {currentCustomerStudies.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-500 italic text-center">
                    Bu müşteriye ait kaydedilmiş zaman etüdü bulunmamaktadır.
                  </div>
                ) : (
                  currentCustomerStudies.map(study => (
                    <div
                      key={study.id}
                      onClick={() => handleLoadStudy(study)}
                      className="px-3 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-b-0 cursor-pointer flex flex-col justify-between text-left group"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-extrabold text-slate-850 group-hover:text-rose-600 transition">
                          {study.lineName}
                        </span>
                        <button
                          onClick={(e) => handleDeleteStudy(study.id, e)}
                          className="text-slate-400 hover:text-red-600 p-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[10px] font-medium text-slate-600 mt-0.5">
                        Ürün: {study.productName} • Takt: {study.taktTime}sn
                      </span>
                      <span className="text-[9px] text-slate-450 font-semibold mt-1">
                        Tarih: {study.createdAt}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {showResetConfirm ? (
            <div className="flex items-center space-x-1.5 h-10 bg-rose-50 border border-rose-300 rounded-xl p-1.5 transition-all shadow-sm">
              <span className="text-[10px] font-black text-rose-700 px-1.5">Sıfırlansın mı?</span>
              <button
                onClick={handleNewTimeStudy}
                className="bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] py-1 px-2.5 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Evet, Sıfırla
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-[10px] py-1 px-2.5 rounded-lg cursor-pointer transition-colors"
              >
                İptal
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow transition h-10 border border-emerald-500"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Zaman Etüdü</span>
            </button>
          )}

          <button
            onClick={handleSaveStudy}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow transition h-10 border border-rose-500"
          >
            <Save className="w-4 h-4" />
            <span>Çalışmayı Sakla</span>
          </button>
        </div>
      </div>

      {/* PARAMETERS CONFIGURATION BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ürün Adı</label>
          <input
            type="text"
            className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:bg-white"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hat Tanımı / Lokasyon</label>
          <input
            type="text"
            className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 focus:bg-white"
            value={lineName}
            onChange={(e) => setLineName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Vardiya Çalışma Süresi (Saat)</label>
          <input
            type="number"
            className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:border-rose-500 focus:bg-white"
            value={shiftHours}
            onChange={(e) => setShiftHours(Math.max(1, parseFloat(e.target.value) || 0))}
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hedef Takt Zamanı (sn)</label>
          <input
            type="number"
            className="w-full mt-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:border-rose-500 focus:bg-white"
            value={taktTime}
            onChange={(e) => setTaktTime(Math.max(1, parseFloat(e.target.value) || 0))}
          />
        </div>
      </div>

      {/* METOT MÜHENDİSLİĞİ - PROSES İŞ AKIŞ ŞEMASI (PROCESS FLOWCHART - AT THE TOP OF THE PAGE) */}
      {renderProcessFlowchart(false)}

      {/* MAIN TWO TABS */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-t-xl">
        <button
          onClick={() => { setActiveTab("study"); }}
          className={`flex-1 sm:flex-initial px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center justify-center space-x-2 ${
            activeTab === "study"
              ? "border-rose-600 text-rose-600 bg-rose-50/20"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>1. Zaman Etüdü &amp; Kapasite</span>
        </button>
        <button
          onClick={() => { setActiveTab("combination"); }}
          className={`flex-1 sm:flex-initial px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center justify-center space-x-2 ${
            activeTab === "combination"
              ? "border-rose-600 text-rose-600 bg-rose-50/20"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>2. Standart İş Kombinasyon Tablosu (SWCC)</span>
        </button>
      </div>

      {/* TAB 1 CONTENT: PROCESS TIMES & MEASUREMENTS */}
      {activeTab === "study" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: GENERAL PROCESS SHEET */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 flex items-center space-x-2">
                  <span>Proses Zaman Etüdü &amp; Kapasite Tablosu</span>
                  {bottleneckInfo.name && (
                    <span className="text-[10px] bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full font-extrabold uppercase animate-pulse">
                      Darboğaz: {bottleneckInfo.name} ({bottleneckInfo.maxCT}sn)
                    </span>
                  )}
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                  Çevrim ölç → kapasiteler otomatik hesaplansın
                </span>
              </div>
              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <button 
                  onClick={handleDownloadXLS}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[11px] py-1.5 px-3 rounded-lg border border-slate-200 flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Raporu İndir (XLS)</span>
                </button>
                <button 
                  onClick={() => setIsTableMaximized(true)}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[11px] p-1.5 rounded-lg border border-slate-200 flex items-center justify-center transition"
                  title="Tabloyu Tam Ekran Yap"
                >
                  <Maximize2 className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Quick Process Step Adder Row (Moved above list table) */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="text-[9px] font-black uppercase text-slate-400">Proses Adı</label>
                <input
                  type="text"
                  placeholder="örn: BURÇ ÇAKMA"
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-800"
                  value={newProcName}
                  onChange={(e) => setNewProcName(e.target.value)}
                />
              </div>
              <div className="w-24">
                <label className="text-[9px] font-black uppercase text-slate-400">Mak. CT (sn)</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-800"
                  value={newProcMct}
                  onChange={(e) => setNewProcMct(e.target.value)}
                />
              </div>
              <div className="w-24">
                <label className="text-[9px] font-black uppercase text-slate-400">C/O (sn)</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-800"
                  value={newProcCo}
                  onChange={(e) => setNewProcCo(e.target.value)}
                />
              </div>
              <button
                onClick={handleAddProcess}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition cursor-pointer"
              >
                + Proses Ekle
              </button>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white max-h-120 shadow-inner">
              <table className="w-full text-left border-collapse text-xs text-slate-800">
                <thead className="bg-slate-50 text-slate-500 font-extrabold sticky top-0 uppercase text-[9px] tracking-widest border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3 w-10 text-center">Sırala</th>
                    <th className="p-3">Proses Adımı</th>
                    <th className="p-3 text-right">CT (sn)</th>
                    <th className="p-3 text-right">Mak. CT</th>
                    <th className="p-3 text-right">C/O Setup</th>
                    <th className="p-3 text-right">Saatlik Kap.</th>
                    <th className="p-3 text-right">Vardiya Kap.</th>
                    <th className="p-3 text-right">C/O Kayıp (ad)</th>
                    <th className="p-3 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {processes.map((p, idx) => {
                    const ct = getProcessCT(p);
                    const isSelected = p.id === selectedProcessId;
                    const isBn = p.id === bottleneckInfo.id;
                    const hCap = getHourlyCapacity(ct);
                    const sCap = getShiftCapacity(ct);
                    const coLossVal = getCoLossAmount(p);

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedProcessId(p.id)}
                        draggable
                        onDragStart={(e) => handleProcessDragStart(e, p.id)}
                        onDragOver={(e) => handleProcessDragOver(e, p.id)}
                        onDragEnd={handleProcessDragEnd}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-rose-50/55 font-bold" : "hover:bg-slate-50/50"
                        } ${draggedProcessId === p.id ? "opacity-30 bg-rose-100" : ""}`}
                      >
                        <td className="p-3 text-center text-slate-400 font-black">
                          {isBn ? "▶" : idx + 1}
                        </td>
                        <td className="p-3 text-center text-slate-400 cursor-grab active:cursor-grabbing select-none" title="Satırı sürükleyip bırakarak taşıyın">
                          <GripVertical className="w-3.5 h-3.5 mx-auto text-slate-450 hover:text-slate-650 transition-colors" />
                        </td>
                        <td className="p-3 font-semibold text-slate-800">
                          {p.name}
                        </td>
                        <td className={`p-3 text-right font-bold font-mono text-xs ${ct > taktTime ? "text-red-600" : "text-emerald-600"}`}>
                          {ct > 0 ? `${ct.toFixed(1)} sn` : "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-cyan-600">
                          {p.mct > 0 ? `${p.mct.toFixed(1)} sn` : "—"}
                        </td>
                        <td className="p-3 text-right font-mono text-orange-650">
                          {p.co > 0 ? `${p.co.toFixed(1)} sn` : "—"}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-700">
                          {hCap > 0 ? `${hCap} ad` : "—"}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-700">
                          {sCap > 0 ? `${sCap} ad` : "—"}
                        </td>
                        <td className="p-3 text-right font-semibold text-orange-650 font-mono">
                          {coLossVal > 0 ? `${coLossVal} ad` : "—"}
                        </td>
                        <td className="p-3 text-center">
                          {isBn ? (
                            <span className="text-[9px] bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                              Darboğaz
                            </span>
                          ) : ct > taktTime ? (
                            <span className="text-[9px] bg-amber-100 text-amber-850 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                              Kritik
                            </span>
                          ) : (
                            <span className="text-[9px] bg-emerald-100 text-emerald-850 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: DETAILED ANALYSIS & MEASUREMENTS FOR ACTIVE STEP */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Process Selection Dropdown Selector */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Aktif Ölçüm Prosesi</label>
              <div className="relative">
                <select
                  value={selectedProcessId}
                  onChange={(e) => setSelectedProcessId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:border-rose-500 appearance-none cursor-pointer pr-10"
                >
                  {processes.map((p, idx) => (
                    <option key={p.id} value={p.id}>
                      {idx + 1}. {p.name} ({p.cy.length} Gözlem {p.cy.length > 0 ? `• Mod: ${getMode(p.cy)}s` : ""})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-450">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* All Processes Cycle Comparison Chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="text-[10px] font-black uppercase text-slate-800 tracking-wide">
                    Tüm Proseslerin Çevrim Süreleri Karşılaştırması
                  </h5>
                  <span className="text-[9px] text-slate-450 block font-semibold">
                    Darboğaz ve En Hızlı Proses Arasındaki Gapler (Seçmek için sütunlara tıklayın)
                  </span>
                </div>
                {processes.length > 0 && (
                  <button
                    onClick={() => setIsComparisonMaximized(true)}
                    className="bg-slate-50 hover:bg-slate-100 p-1 rounded-lg border border-slate-200 text-slate-600 transition shrink-0 ml-2"
                    title="Grafiği Büyüt"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              {processes.length > 0 ? (
                <div>{renderComparisonChartSvg(false)}</div>
              ) : (
                <div className="h-32 flex items-center justify-center text-slate-400 italic text-xs">
                  Grafiği görüntülemek için proses ekleyin.
                </div>
              )}
            </div>

            {/* Cycle Bar Chart Recreated cleanly (Moved to the top of the column) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="text-[10px] font-black uppercase text-slate-800 tracking-wide">
                    Aktif Proses Çevrim Dağılım Grafiği
                  </h5>
                  <span className="text-[9px] text-slate-450 block font-semibold font-sans">Min/Max Sapma &amp; En Çok Tekrar Eden Çevrim Süresi (Mod)</span>
                </div>
                {activeProcess && activeProcess.cy.length > 0 && (
                  <button
                    onClick={() => setIsDistributionMaximized(true)}
                    className="bg-slate-50 hover:bg-slate-100 p-1 rounded-lg border border-slate-200 text-slate-600 transition shrink-0 ml-2"
                    title="Grafiği Büyüt"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              {activeProcess && activeProcess.cy.length > 0 ? (
                <div>{renderCycleChartSvg(false)}</div>
              ) : (
                <div className="h-32 flex items-center justify-center text-slate-400 italic text-xs">
                  Grafiği görüntülemek için çevrim ölçümü ekleyin.
                </div>
              )}
            </div>

            {/* Cycle Measurement Input Box */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black uppercase text-slate-800">
                  Çevrim Ölçümleri
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Aktif Proses: <span className="font-extrabold text-rose-600">{activeProcess?.name}</span>
                </p>
              </div>

              {/* Stats Panel */}
              <div className="grid grid-cols-4 gap-1 text-center bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                <div className="border-r border-slate-200 last:border-0 py-1">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase">Min</span>
                  <div className="text-xs font-black text-emerald-600 font-mono mt-0.5">
                    {activeProcess?.cy.length > 0 ? `${Math.min(...activeProcess.cy)}s` : "—"}
                  </div>
                </div>
                <div className="border-r border-slate-200 last:border-0 py-1">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase">Max</span>
                  <div className="text-xs font-black text-red-500 font-mono mt-0.5">
                    {activeProcess?.cy.length > 0 ? `${Math.max(...activeProcess.cy)}s` : "—"}
                  </div>
                </div>
                <div className="border-r border-slate-200 last:border-0 py-1">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase">Ort</span>
                  <div className="text-xs font-black text-slate-700 font-mono mt-0.5">
                    {activeProcess?.cy.length > 0 ? `${getAvg(activeProcess.cy).toFixed(1)}s` : "—"}
                  </div>
                </div>
                <div className="py-1">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase">Gözlem</span>
                  <div className="text-xs font-black text-rose-600 font-mono mt-0.5">
                    {activeProcess?.cy.length || 0}
                  </div>
                </div>
              </div>

              {/* Mode indicator */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center">
                <span className="text-[9px] font-black text-slate-400 uppercase block tracking-widest">Mod Değeri (CT Referansı)</span>
                <span className="text-2xl font-black text-indigo-600 font-mono block mt-0.5">
                  {getMode(activeProcess?.cy) || "—"}<span className="text-xs font-semibold ml-0.5">sn</span>
                </span>
              </div>

              {/* Chip list of cycles with removal */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400">Gözlem Listesi</span>
                  <span className="text-[9px] text-slate-400 italic">Yıldızlı = Referans Mod</span>
                </div>
                {activeProcess?.cy.length === 0 ? (
                  <span className="text-xs text-slate-400 italic block">Henüz ölçüm girilmemiş.</span>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
                    {activeProcess?.cy.map((val, idx) => {
                      const isMode = val === getMode(activeProcess.cy);
                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[10px] font-black border transition font-mono ${
                            isMode
                              ? "bg-blue-100 border-blue-200 text-blue-700"
                              : "bg-slate-50 border-slate-200 text-slate-600"
                          }`}
                        >
                          <span>{val}sn</span>
                          {isMode && <span className="text-[9px] text-blue-500">★</span>}
                          <button
                            onClick={() => handleRemoveCycle(idx)}
                            className="hover:text-red-600 font-bold ml-1 text-slate-400"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Manual input + Multiple modal adder trigger */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Saniye gir..."
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500"
                    value={cycleInput}
                    onChange={(e) => setCycleInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCycle()}
                  />
                  <button
                    onClick={handleAddCycle}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-1.5 px-3 rounded-xl transition shadow-xs"
                  >
                    + Ekle
                  </button>
                </div>
                <button
                  onClick={() => setIsCycleModalOpen(true)}
                  className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs rounded-xl border border-rose-200 transition"
                >
                  + Çoklu Çevrim Ekle
                </button>
              </div>

              {/* Live process modifications */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-450 uppercase block">Makine CT (sn)</label>
                    <input
                      type="number"
                      className="w-full mt-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs font-mono"
                      value={activeProcess?.mct || ""}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "mct", Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-450 uppercase block">C/O Setup (sn)</label>
                    <input
                      type="number"
                      className="w-full mt-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs font-mono"
                      value={activeProcess?.co || ""}
                      onChange={(e) => handleUpdateProcessField(activeProcess.id, "co", Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Bento grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-blue-500 tracking-wider">Manuel CT</span>
                <div className="text-base font-black font-mono text-blue-700 mt-1">
                  {getMode(activeProcess?.cy) ? `${getMode(activeProcess?.cy)} sn` : "—"}
                </div>
                <span className="text-[9px] text-slate-400 font-semibold block mt-1">Operatör çevrimi</span>
              </div>
              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-cyan-600 tracking-wider">Makine CT</span>
                <div className="text-base font-black font-mono text-cyan-700 mt-1">
                  {activeProcess?.mct ? `${activeProcess.mct} sn` : "—"}
                </div>
                <span className="text-[9px] text-slate-400 font-semibold block mt-1">Otomatik makine</span>
              </div>
              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider">Saatlik Kapasite</span>
                <div className="text-base font-black font-mono text-emerald-700 mt-1">
                  {getProcessCT(activeProcess) ? `${getHourlyCapacity(getProcessCT(activeProcess))} ad` : "—"}
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-purple-600 tracking-wider">Vardiya Kapasite</span>
                <div className="text-base font-black font-mono text-purple-700 mt-1">
                  {getProcessCT(activeProcess) ? `${getShiftCapacity(getProcessCT(activeProcess))} ad` : "—"}
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-xs col-span-2">
                <span className="text-[9px] font-black uppercase text-orange-600 tracking-wider">C/O Kayıp Miktar</span>
                <div className="text-base font-black font-mono text-orange-700 mt-1">
                  {getCoLossAmount(activeProcess) ? `${getCoLossAmount(activeProcess)} adet` : "—"}
                </div>
                <span className="text-[9px] text-slate-450 font-semibold block mt-1">Setup / Model değişiminde kaybedilen üretim</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2 CONTENT: STANDARD WORK COMBINATION TABLE (SWCC) */}
      {activeTab === "combination" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: PARAMETERS AND SUB-TABS (ELEMENTS / VALUE STREAM / INSIGHTS) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
            
            {/* Combo Parameter Takt calc header */}
            <div className="p-4 border-b border-slate-100 space-y-3.5 bg-slate-50/50">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Takt Zamanı Yapılandırma</span>
                <button 
                  onClick={handleSyncFromSelectedProcess}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-[10px] py-1 px-2.5 rounded-lg border border-rose-200 flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Seçilen Prosesten Aktar</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Çalışma Süresi (sn/var.)</label>
                  <input
                    type="number"
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black"
                    value={ccAvail}
                    onChange={(e) => setCcAvail(Math.max(1, parseFloat(e.target.value) || 0))}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Müşteri Talebi (ad/var.)</label>
                  <input
                    type="number"
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black"
                    value={ccDemand}
                    onChange={(e) => setCcDemand(Math.max(1, parseFloat(e.target.value) || 0))}
                  />
                </div>
              </div>
              <div className="bg-white border border-slate-250 p-2.5 rounded-xl flex justify-between items-center">
                <span className="text-[10px] text-slate-500 font-semibold">Hesaplanan Takt = Süre / Talep</span>
                <span className="text-base font-black text-red-600 font-mono">
                  {calcTakt.toFixed(1)} sn
                </span>
              </div>
            </div>

            {/* Left Sub-tabs layout */}
            <div className="flex border-b border-slate-150 text-xs text-center font-extrabold bg-white">
              <button
                onClick={() => setComboSubTab("elements")}
                className={`flex-1 py-3 border-b-2 uppercase tracking-wider transition ${
                  comboSubTab === "elements" ? "border-rose-600 text-rose-600 font-black" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                İş Elemanları
              </button>
              <button
                onClick={() => setComboSubTab("va")}
                className={`flex-1 py-3 border-b-2 uppercase tracking-wider transition ${
                  comboSubTab === "va" ? "border-rose-600 text-rose-600 font-black" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                VA Analizi
              </button>
              <button
                onClick={() => setComboSubTab("insights")}
                className={`flex-1 py-3 border-b-2 uppercase tracking-wider transition ${
                  comboSubTab === "insights" ? "border-rose-600 text-rose-600 font-black" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Öneriler
              </button>
            </div>

            {/* LEFT SUB-TAB CONTENT 1: ELEMENTS LIST AND CRUD */}
            {comboSubTab === "elements" && (
              <div className="flex flex-col flex-1 overflow-hidden">
                
                {/* Create/Edit Form */}
                <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/30">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase text-slate-850 tracking-wider">
                      {editingElId !== null ? "✏️ Eleman Düzenle" : "+ Eleman Ekle"}
                    </span>
                    <div className="flex gap-2">
                      {editingElId !== null && (
                        <button
                          onClick={handleCancelElementEdit}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-slate-150 rounded-lg hover:bg-slate-200 transition"
                        >
                          İptal
                        </button>
                      )}
                      <button
                        onClick={handleSaveElement}
                        className="px-3 py-1 text-[10px] font-black text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition flex items-center space-x-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>{editingElId !== null ? "Güncelle" : "Ekle"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="text-[9px] font-bold text-slate-500 block">Sıra No</label>
                      <input
                        type="number"
                        placeholder="Sıra"
                        className="w-full mt-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                        value={elSeq}
                        onChange={(e) => setElSeq(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] font-bold text-slate-500 block">Süre (sn)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Süre"
                        className="w-full mt-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right"
                        value={elTime}
                        onChange={(e) => setElTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block">İş Açıklaması</label>
                    <input
                      type="text"
                      placeholder="örn: Gövde parçasını yerleştirme"
                      className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                      value={elDesc}
                      onChange={(e) => setElDesc(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">Aktivite Tipi</label>
                      <select
                        className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-rose-500 cursor-pointer"
                        value={elType}
                        onChange={(e) => setElType(e.target.value as any)}
                      >
                        <option value="manual">Manuel İş (Manual)</option>
                        <option value="walking">Yürüme (Walking)</option>
                        <option value="machine">Makine (Machine)</option>
                        <option value="waiting">Bekleme (Waiting)</option>
                        <option value="inspection">Kontrol (Inspection)</option>
                        <option value="parallel">Paralel İş (Parallel)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">Çalışma Modu</label>
                      <select
                        className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-rose-500 cursor-pointer"
                        value={elOperationMode}
                        onChange={(e) => setElOperationMode(e.target.value as any)}
                      >
                        <option value="sequential">Sıralı İş (Sequential)</option>
                        <option value="parallel">Paralel İş (Parallel)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">Operatör</label>
                      <input
                        type="text"
                        placeholder="Örn: Operatör 1"
                        className="w-full mt-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                        value={elOperator}
                        onChange={(e) => setElOperator(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block">İstasyon</label>
                      <input
                        type="text"
                        placeholder="Örn: İstasyon A"
                        className="w-full mt-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                        value={elStation}
                        onChange={(e) => setElStation(e.target.value)}
                      />
                    </div>
                  </div>

                  {elOperationMode === "parallel" && (
                    <div className="bg-sky-50 border border-sky-150 p-2.5 rounded-xl">
                      <label className="text-[9px] font-extrabold text-sky-800 block uppercase">Başlangıç Zamanı Override (sn)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Otomatik hesaplanır (veya sn girin)"
                        className="w-full mt-1 px-2.5 py-1 bg-white border border-sky-200 rounded-lg text-xs font-mono font-bold"
                        value={elCustomStartTime}
                        onChange={(e) => setElCustomStartTime(e.target.value)}
                      />
                      <span className="text-[8.5px] text-sky-650 font-medium block mt-1">Paralel işlerin sıralı elemanlardan bağımsız başlamasını sağlar.</span>
                    </div>
                  )}

                  {elType === "machine" && (
                    <div className="space-y-2 bg-slate-100 border border-slate-250 p-2.5 rounded-xl">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block">Makine / Robot İsmi</label>
                        <input
                          type="text"
                          placeholder="Örn: CNC Pres, Robot A"
                          className="w-full mt-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                          value={elMachineName}
                          onChange={(e) => setElMachineName(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center space-x-2 bg-orange-50 border border-orange-200 rounded-lg p-2">
                        <button
                          onClick={() => setElHasMachineWaiting(!elHasMachineWaiting)}
                          className="text-orange-600 focus:outline-none"
                        >
                          {elHasMachineWaiting ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400 bg-white" />
                          )}
                        </button>
                        <div className="flex flex-col leading-none select-none">
                          <span className="text-[9.5px] font-black text-orange-850">Makinede Bekleme Var Mı?</span>
                          <span className="text-[8.5px] text-orange-600 font-semibold mt-0.5">
                            CNC çevrimi sırasında bekleme oluştuğunu vurgular.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Elements List */}
                <div className="p-2 overflow-y-auto max-h-[300px] divide-y divide-slate-100">
                  {ccEls.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 italic">
                      Henüz iş elemanı girilmemiş.
                    </div>
                  ) : (
                    [...ccEls].sort((a, b) => a.seq - b.seq).map(el => {
                      const cfg = TYPE_CONFIG[el.type] || TYPE_CONFIG.manual;
                      return (
                        <div 
                          key={el.id}
                          draggable
                          onDragStart={(e) => handleElDragStart(e, el.id)}
                          onDragOver={(e) => handleElDragOver(e, el.id)}
                          onDragEnd={handleElDragEnd}
                          className={`p-2.5 rounded-xl flex items-center justify-between group transition ${
                            editingElId === el.id ? "bg-rose-50 border border-rose-200" : "hover:bg-slate-50"
                          } ${draggedElementId === el.id ? "opacity-30 bg-rose-50 border border-dashed border-rose-300" : ""}`}
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <span className="text-slate-400 cursor-grab active:cursor-grabbing select-none" title="Taşımak için sürükleyin">
                              <GripVertical className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                            </span>
                            <span className="text-xs font-black text-slate-400 w-4 text-center">{el.seq}</span>
                            <div className="min-w-0 flex-1 ml-1">
                              <span className="text-xs font-black text-slate-800 block truncate" title={el.desc}>
                                {el.desc}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${cfg.bg}`}>
                                  {cfg.marker} {cfg.label.split(" ")[0]}
                                </span>
                                <span className="text-[8.5px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-bold">
                                  {el.operationMode === "parallel" ? "Paralel" : "Sıralı"}
                                </span>
                                {el.hasMachineWaiting && (
                                  <span className="text-[8.5px] bg-orange-100 border border-orange-200 text-orange-700 px-1.5 py-0.5 rounded-md font-black">
                                    Bekleme Var
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 ml-2">
                            <span className="text-xs font-black text-slate-800 font-mono pr-2">{el.time}s</span>
                            <button
                              onClick={() => handleEditElement(el)}
                              className="p-1 text-slate-400 hover:text-slate-800 rounded transition"
                              title="Düzenle"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteElement(el.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* LEFT SUB-TAB CONTENT 2: VALUE STREAM ANALYSIS */}
            {comboSubTab === "va" && (
              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-center">
                    <span className="text-[10px] font-black uppercase text-emerald-800 block">Değer Katan (VA)</span>
                    <span className="text-2xl font-black text-emerald-700 block mt-1">
                      {vaPercent}%
                    </span>
                    <span className="text-[9px] text-slate-500 font-semibold block mt-1">
                      Katma Değerli: {(ccTotals.manual + ccTotals.parallel).toFixed(1)} sn
                    </span>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 text-center">
                    <span className="text-[10px] font-black uppercase text-red-850 block">Muda (NVA)</span>
                    <span className="text-2xl font-black text-red-700 block mt-1">
                      {nvaPercent}%
                    </span>
                    <span className="text-[9px] text-slate-500 font-semibold block mt-1">
                      İsraf / Kayıplar: {(ccTotals.walking + ccTotals.waiting + ccTotals.inspection).toFixed(1)} sn
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3.5">
                  <h5 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Aktivite Dağılımları</h5>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9.5px] font-semibold">
                      <span className="text-slate-500">Manuel İş (Manuel):</span>
                      <span className="font-mono text-slate-800">{ccTotals.manual}s ({ccTotals.total > 0 ? ((ccTotals.manual/ccTotals.total)*100).toFixed(1) : 0}%)</span>
                    </div>
                    <div className="flex justify-between text-[9.5px] font-semibold">
                      <span className="text-purple-600">Yürüme (Walking):</span>
                      <span className="font-mono text-purple-700">{ccTotals.walking}s ({ccTotals.total > 0 ? ((ccTotals.walking/ccTotals.total)*100).toFixed(1) : 0}%)</span>
                    </div>
                    <div className="flex justify-between text-[9.5px] font-semibold">
                      <span className="text-cyan-600">Makine Çalışması (Machine):</span>
                      <span className="font-mono text-cyan-700">{ccTotals.machine}s ({ccTotals.total > 0 ? ((ccTotals.machine/ccTotals.total)*100).toFixed(1) : 0}%)</span>
                    </div>
                    <div className="flex justify-between text-[9.5px] font-semibold">
                      <span className="text-rose-500">Bekleme (Waiting):</span>
                      <span className="font-mono text-rose-600">{ccTotals.waiting}s ({ccTotals.total > 0 ? ((ccTotals.waiting/ccTotals.total)*100).toFixed(1) : 0}%)</span>
                    </div>
                    <div className="flex justify-between text-[9.5px] font-semibold">
                      <span className="text-amber-600 font-bold">Kontrol (Inspection - NNVA):</span>
                      <span className="font-mono text-amber-700 font-bold">{ccTotals.inspection}s ({ccTotals.total > 0 ? ((ccTotals.inspection/ccTotals.total)*100).toFixed(1) : 0}%)</span>
                    </div>
                    <div className="flex justify-between text-[9.5px] font-semibold">
                      <span className="text-emerald-600 font-bold">Paralel İşlem (Parallel):</span>
                      <span className="font-mono text-emerald-700 font-bold">{ccTotals.parallel}s ({ccTotals.total > 0 ? ((ccTotals.parallel/ccTotals.total)*100).toFixed(1) : 0}%)</span>
                    </div>
                  </div>
                </div>

                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-black text-sky-850 uppercase">
                    <span>Operatör Kullanımı</span>
                    <span className="font-mono">{utilizationPercent}%</span>
                  </div>
                  <div className="w-full bg-sky-200/80 rounded-full h-2">
                    <div 
                      className="bg-sky-600 h-2 rounded-full transition-all"
                      style={{ width: `${utilizationPercent}%` }}
                    />
                  </div>
                  <span className="text-[8.5px] text-sky-650 font-bold block mt-1">Göz önünde bulundurulan Operatör Boşta Süresi: {operatorIdleTime} sn</span>
                </div>
              </div>
            )}

            {/* LEFT SUB-TAB CONTENT 3: AUTOMATIC ADVISOR TIPS & AI COPILOT */}
            {comboSubTab === "insights" && (
              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Metod Mühendisliği Kaizen Önerileri</span>
                  <button
                    onClick={handleAnalyzeSwctWithAi}
                    disabled={isAiAnalyzing || ccEls.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-extrabold text-[9px] py-1 px-2.5 rounded-lg transition-colors flex items-center space-x-1 uppercase"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-200" />
                    <span>{isAiAnalyzing ? "Analiz Ediliyor..." : "AI Mühendis Analizi"}</span>
                  </button>
                </div>

                {/* AI generated report container */}
                {swctAiReport ? (
                  <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-3.5 space-y-2 text-slate-800">
                    <div className="flex items-center space-x-1.5 text-xs text-indigo-850 font-extrabold uppercase border-b border-indigo-150 pb-1.5 mb-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                      <span>Gemini AI Metod Mühendisi Raporu</span>
                    </div>
                    <div className="prose prose-sm prose-indigo text-[11px] leading-relaxed max-h-72 overflow-y-auto pr-1 select-text scrollbar-thin">
                      <Markdown>{swctAiReport}</Markdown>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-center text-slate-500 space-y-2">
                    <p className="text-[10.5px] font-medium leading-relaxed">
                      Mevcut iş kombinasyonu verileri üzerinde gelişmiş israf analizi yapmak ve Lean Kaizen iyileştirme adımları almak için yukarıdaki <strong className="text-indigo-600">AI Mühendis Analizi</strong> butonuna tıklayın.
                    </p>
                  </div>
                )}

                {aiError && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-[10px] text-red-700 font-semibold leading-relaxed">
                    Hata: {aiError}
                  </div>
                )}

                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <span className="text-[9.5px] font-bold text-slate-450 block uppercase tracking-wider">Kural Tabanlı Hızlı Bulgular:</span>
                  
                  {ccTotals.total > calcTakt ? (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start space-x-2 text-xs text-red-800">
                      <AlertTriangle className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black uppercase mb-0.5 text-[10px]">Takt Süresi Aşıldı!</strong>
                        Mevcut iş kombinasyonu takt süresini {(ccTotals.total - calcTakt).toFixed(1)} sn aşıyor. Hatta darboğaz azaltma veya iş dengeleme çalışması yapın.
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-start space-x-2 text-xs text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-650 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black uppercase mb-0.5 text-[10px]">Takt Süresi Uyumlu</strong>
                        Kümülatif çevrim süresi takt sınırının altında. Kapasite müşteri talebini karşılayacak düzeydedir.
                      </div>
                    </div>
                  )}

                  {ccTotals.walking > calcTakt * 0.15 && (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start space-x-2 text-xs text-amber-800">
                      <TrendingUp className="w-4 h-4 text-amber-650 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black uppercase mb-0.5 text-[10px]">Yüksek Yürüme Kaybı</strong>
                        Toplam sürenin %{((ccTotals.walking / ccTotals.total) * 100).toFixed(1)}'i yürüme ile geçiyor. Hat yerleşimini (layout) iyileştirerek israfı azaltabilirsiniz.
                      </div>
                    </div>
                  )}

                  {ccTotals.waiting > 0 && (
                    <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl flex items-start space-x-2 text-xs text-orange-800">
                      <Clock className="w-4 h-4 text-orange-650 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black uppercase mb-0.5 text-[10px]">Operatör Bekleme Kaybı</strong>
                        Operatör {ccTotals.waiting.toFixed(1)} sn boyunca bekleme yapıyor. Beklemeyi yok etmek için paralel işler veya makine besleme planları yapın.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: GANTT CHART REPRESENTATION */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* KPI statistics panel */}
            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-5 xl:grid-cols-7 gap-3">
              <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-blue-500 block leading-none">Manuel</span>
                <span className="text-sm font-black text-slate-800 font-mono block mt-1.5">{ccTotals.manual.toFixed(1)}s</span>
                <span className="text-[8.5px] text-slate-450 font-bold block mt-1">{ccTotals.total > 0 ? ((ccTotals.manual / ccTotals.total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-purple-600 block leading-none">Yürüme</span>
                <span className="text-sm font-black text-slate-800 font-mono block mt-1.5">{ccTotals.walking.toFixed(1)}s</span>
                <span className="text-[8.5px] text-slate-450 font-bold block mt-1">{ccTotals.total > 0 ? ((ccTotals.walking / ccTotals.total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-cyan-600 block leading-none">Makine</span>
                <span className="text-sm font-black text-slate-800 font-mono block mt-1.5">{ccTotals.machine.toFixed(1)}s</span>
                <span className="text-[8.5px] text-slate-450 font-bold block mt-1">{ccTotals.total > 0 ? ((ccTotals.machine / ccTotals.total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-rose-500 block leading-none">Bekleme</span>
                <span className="text-sm font-black text-slate-800 font-mono block mt-1.5">{ccTotals.waiting.toFixed(1)}s</span>
                <span className="text-[8.5px] text-slate-450 font-bold block mt-1">{ccTotals.total > 0 ? ((ccTotals.waiting / ccTotals.total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-amber-500 block leading-none">Kontrol</span>
                <span className="text-sm font-black text-slate-800 font-mono block mt-1.5">{ccTotals.inspection.toFixed(1)}s</span>
                <span className="text-[8.5px] text-slate-450 font-bold block mt-1">{ccTotals.total > 0 ? ((ccTotals.inspection / ccTotals.total) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-xs">
                <span className="text-[9px] font-black uppercase text-emerald-500 block leading-none">Paralel</span>
                <span className="text-sm font-black text-slate-800 font-mono block mt-1.5">{ccTotals.parallel.toFixed(1)}s</span>
                <span className="text-[8.5px] text-slate-450 font-bold block mt-1">{ccTotals.total > 0 ? ((ccTotals.parallel / ccTotals.total) * 100).toFixed(1) : 0}%</span>
              </div>
              
              {/* STATUS CARD (Requirements Green/Yellow/Red indicator matching HTML) */}
              <div className={`p-3 rounded-2xl text-center flex flex-col justify-center border shadow-xs sm:col-span-2 xl:col-span-1 ${
                ccTotals.total === 0 
                  ? "bg-slate-50 border-slate-200 text-slate-500"
                  : ccTotals.total > calcTakt * 1.02
                    ? "bg-red-50 border-red-200 text-red-800"
                    : ccTotals.total >= calcTakt * 0.98
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}>
                <span className="text-[9px] font-black uppercase block tracking-wider leading-none">Takt Durumu</span>
                <span className="text-sm font-black block mt-1.5 font-mono">
                  {ccTotals.total.toFixed(1)}s
                </span>
                <span className="text-[8px] font-extrabold block mt-1">
                  {ccTotals.total === 0 
                    ? "Eleman ekle"
                    : ccTotals.total > calcTakt * 1.02
                      ? "Takt Aşıldı!"
                      : ccTotals.total >= calcTakt * 0.98
                        ? "Sınırda"
                        : "Kapasite OK"}
                </span>
              </div>
            </div>

            {/* Standard Work Combination Chart Gantt box */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wide">
                    Standart İş Kombinasyon Şeması (SWCT)
                  </h4>
                  <span className="text-[10px] text-slate-450 block font-semibold mt-0.5">
                    Mühendislik Çevrim ve Kapasite Analizi Şeması (Toyota Standardı)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Legend */}
                  <div className="flex flex-wrap gap-2 items-center text-[8.5px] font-extrabold text-slate-500 uppercase">
                    <div className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 bg-blue-500 rounded" />
                      <span>Manuel</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 bg-purple-500 rounded" />
                      <span>Yürüme</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 bg-cyan-500 rounded" />
                      <span>Makine</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 bg-rose-500 rounded" />
                      <span>Bekleme</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 bg-amber-500 rounded" />
                      <span>Kontrol</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded" />
                      <span>Paralel</span>
                    </div>
                  </div>

                  {/* Zoom Controller */}
                  <div className="flex items-center space-x-2 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-black text-slate-500 font-mono">ZOOM: {zoomLevel}%</span>
                    <input 
                      type="range" 
                      min="50" 
                      max="200" 
                      step="10"
                      value={zoomLevel} 
                      onChange={(e) => setZoomLevel(Number(e.target.value))}
                      className="w-16 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <button
                    onClick={() => setIsMaximized(true)}
                    className="bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-slate-600 transition"
                    title="Tam Ekran"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Combination chart render */}
              {ccEls.length > 0 ? (
                <div className="overflow-x-auto pr-1">{renderCombinationSvg(false)}</div>
              ) : (
                <div className="h-44 flex items-center justify-center text-slate-400 italic text-xs">
                  SWCT şemasını görüntülemek için sol taraftan iş elemanları ekleyin.
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap gap-2.5 justify-between items-center">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Metod Mühendisliği İşlemleri:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs py-1.5 px-3.5 rounded-xl flex items-center space-x-1 shadow-2xs transition"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Yazdır / PDF Raporu</span>
                </button>
                <button
                  onClick={handleDownloadXLS}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs py-1.5 px-3.5 rounded-xl flex items-center space-x-1 shadow-2xs transition"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Kombinasyon XLS Çıktısı</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: N CYCLES ADDER (Requirements Copied from HTML) */}
      {isCycleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-150 pb-2">
              <h4 className="text-sm font-black uppercase text-slate-900">Çoklu Çevrim Ölçümü Ekle</h4>
              <button 
                onClick={() => setIsCycleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400">Çevrim Gözlem Sayısı</span>
                <div className="flex items-center space-x-3 mt-1.5">
                  <button
                    onClick={() => handleAdjustModalCycleCount(-1)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-250 font-black text-slate-800 flex items-center justify-center border border-slate-200 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-sm font-extrabold text-slate-900 w-24 text-center">
                    {modalCycleCount} Ölçüm
                  </span>
                  <button
                    onClick={() => handleAdjustModalCycleCount(1)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-250 font-black text-slate-800 flex items-center justify-center border border-slate-200 cursor-pointer"
                  >
                    +
                  </button>
                  <span className="text-[10px] text-slate-400 italic">Maks. 20</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {Array.from({ length: modalCycleCount }).map((_, idx) => (
                  <div key={idx}>
                    <label className="text-[9px] font-black text-slate-450 uppercase">Çevrim {idx + 1}</label>
                    <input
                      type="number"
                      placeholder="sn"
                      className="w-full mt-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-right font-mono focus:bg-white"
                      value={modalCycleValues[idx] || ""}
                      onChange={(e) => handleModalCycleValChange(idx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => setIsCycleModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200"
              >
                İptal
              </button>
              <button
                onClick={handleSaveModalCycles}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-xs"
              >
                Gözlemleri Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FULLSCREEN SWCC COMBINATION CHART (Perfect layout) */}
      {isMaximized && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fadeIn select-none">
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
            <div className="space-y-0.5">
              <h4 className="text-sm font-black uppercase tracking-tight">SWCC — Kombinasyon Tablosu Geniş Görünüm</h4>
              <p className="text-[10px] text-slate-400 font-semibold">
                Müşteri: {selectedCustomer.companyName} • Hat: {lineName} • Ürün: {productName}
              </p>
            </div>
            <button
              onClick={() => setIsMaximized(false)}
              className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs py-2 px-4 rounded-xl border border-slate-700 cursor-pointer"
            >
              Kapat
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6 bg-slate-50 flex items-start justify-center">
            <div className="max-w-[95%] w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xl overflow-x-auto">
              {renderCombinationSvg(true)}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: FULLSCREEN PROCESS TABLE (Genişletilmiş Tablo Görünümü) */}
      {isTableMaximized && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fadeIn">
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
            <div className="space-y-0.5">
              <h4 className="text-sm font-black uppercase tracking-tight">Proses Zaman Etüdü &amp; Kapasite Tablosu Geniş Görünüm</h4>
              <p className="text-[10px] text-slate-400 font-semibold">
                Müşteri: {selectedCustomer.companyName} • Hat: {lineName} • Ürün: {productName} • Darboğaz: {bottleneckInfo.name || "—"} ({bottleneckInfo.maxCT || 0}sn)
              </p>
            </div>
            <button
              onClick={() => setIsTableMaximized(false)}
              className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs py-2 px-4 rounded-xl border border-slate-700 cursor-pointer"
            >
              Kapat
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6 bg-slate-50">
            <div className="max-w-[95%] mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
              {/* Quick Process Step Adder Row */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[9px] font-black uppercase text-slate-450">Proses Adı</label>
                  <input
                    type="text"
                    placeholder="örn: BURÇ ÇAKMA"
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-800"
                    value={newProcName}
                    onChange={(e) => setNewProcName(e.target.value)}
                  />
                </div>
                <div className="w-28">
                  <label className="text-[9px] font-black uppercase text-slate-450">Mak. CT (sn)</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-800"
                    value={newProcMct}
                    onChange={(e) => setNewProcMct(e.target.value)}
                  />
                </div>
                <div className="w-28">
                  <label className="text-[9px] font-black uppercase text-slate-450">C/O (sn)</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-800"
                    value={newProcCo}
                    onChange={(e) => setNewProcCo(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleAddProcess}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition cursor-pointer"
                >
                  + Proses Ekle
                </button>
              </div>

              {/* Table list */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-inner">
                <table className="w-full text-left border-collapse text-xs text-slate-800">
                  <thead className="bg-slate-50 text-slate-500 font-extrabold sticky top-0 uppercase text-[9px] tracking-widest border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-4 w-12 text-center">#</th>
                      <th className="p-4 w-10 text-center">Sırala</th>
                      <th className="p-4">Proses Adımı</th>
                      <th className="p-4 text-right">CT (sn)</th>
                      <th className="p-4 text-right">Mak. CT</th>
                      <th className="p-4 text-right">C/O Setup</th>
                      <th className="p-4 text-right">Saatlik Kap.</th>
                      <th className="p-4 text-right">Vardiya Kap.</th>
                      <th className="p-4 text-right">C/O Kayıp (ad)</th>
                      <th className="p-4 text-center">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {processes.map((p, idx) => {
                      const ct = getProcessCT(p);
                      const isSelected = p.id === selectedProcessId;
                      const isBn = p.id === bottleneckInfo.id;
                      const hCap = getHourlyCapacity(ct);
                      const sCap = getShiftCapacity(ct);
                      const coLossVal = getCoLossAmount(p);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedProcessId(p.id)}
                          draggable
                          onDragStart={(e) => handleProcessDragStart(e, p.id)}
                          onDragOver={(e) => handleProcessDragOver(e, p.id)}
                          onDragEnd={handleProcessDragEnd}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-rose-50/55 font-bold" : "hover:bg-slate-50/50"
                          } ${draggedProcessId === p.id ? "opacity-30 bg-rose-100" : ""}`}
                        >
                          <td className="p-4 text-center text-slate-400 font-black">
                            {isBn ? "▶" : idx + 1}
                          </td>
                          <td className="p-4 text-center text-slate-400 cursor-grab active:cursor-grabbing select-none" title="Satırı sürükleyip bırakarak taşıyın">
                            <GripVertical className="w-3.5 h-3.5 mx-auto text-slate-450 hover:text-slate-650 transition-colors" />
                          </td>
                          <td className="p-4 font-semibold text-slate-800">
                            {p.name}
                          </td>
                          <td className={`p-4 text-right font-bold font-mono text-xs ${ct > taktTime ? "text-red-600" : "text-emerald-600"}`}>
                            {ct > 0 ? `${ct.toFixed(1)} sn` : "—"}
                          </td>
                          <td className="p-4 text-right font-mono text-cyan-600">
                            {p.mct > 0 ? `${p.mct.toFixed(1)} sn` : "—"}
                          </td>
                          <td className="p-4 text-right font-mono text-orange-650">
                            {p.co > 0 ? `${p.co.toFixed(1)} sn` : "—"}
                          </td>
                          <td className="p-4 text-right font-semibold text-slate-700">
                            {hCap > 0 ? `${hCap} ad` : "—"}
                          </td>
                          <td className="p-4 text-right font-semibold text-slate-700">
                            {sCap > 0 ? `${sCap} ad` : "—"}
                          </td>
                          <td className="p-4 text-right font-semibold text-orange-650 font-mono">
                            {coLossVal > 0 ? `${coLossVal} ad` : "—"}
                          </td>
                          <td className="p-4 text-center">
                            {isBn ? (
                              <span className="text-[9px] bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                                Darboğaz
                              </span>
                            ) : ct > taktTime ? (
                              <span className="text-[9px] bg-amber-100 text-amber-850 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                                Kritik
                              </span>
                            ) : (
                              <span className="text-[9px] bg-emerald-100 text-emerald-850 px-2.5 py-0.5 rounded-full font-extrabold uppercase">
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: FULLSCREEN COMPARISON CHART */}
      {isComparisonMaximized && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fadeIn select-none">
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
            <div className="space-y-0.5">
              <h4 className="text-sm font-black uppercase tracking-tight">Tüm Proseslerin Çevrim Süreleri Karşılaştırması Geniş Görünüm</h4>
              <p className="text-[10px] text-slate-400 font-semibold">
                Darboğaz ve En Hızlı Proses Arasındaki Gapler
              </p>
            </div>
            <button
              onClick={() => setIsComparisonMaximized(false)}
              className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs py-2 px-4 rounded-xl border border-slate-700 cursor-pointer"
            >
              Kapat
            </button>
          </div>
          <div className="flex-1 overflow-auto p-8 bg-slate-50 flex items-center justify-center">
            <div className="max-w-5xl w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
              {renderComparisonChartSvg(true)}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: FULLSCREEN DISTRIBUTION CHART */}
      {isDistributionMaximized && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fadeIn select-none">
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
            <div className="space-y-0.5">
              <h4 className="text-sm font-black uppercase tracking-tight">Aktif Proses Çevrim Dağılım Grafiği Geniş Görünüm</h4>
              <p className="text-[10px] text-slate-400 font-semibold">
                Aktif Proses: {activeProcess?.name} • Min/Max Sapma &amp; En Çok Tekrar Eden Çevrim Süresi (Mod)
              </p>
            </div>
            <button
              onClick={() => setIsDistributionMaximized(false)}
              className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs py-2 px-4 rounded-xl border border-slate-700 cursor-pointer"
            >
              Kapat
            </button>
          </div>
          <div className="flex-1 overflow-auto p-8 bg-slate-50 flex items-center justify-center">
            <div className="max-w-5xl w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
              {renderCycleChartSvg(true)}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: FULLSCREEN PROCESS FLOWCHART */}
      {isFlowchartMaximized && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col animate-fadeIn select-none">
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0 border-b border-slate-800">
            <div className="space-y-0.5">
              <h4 className="text-sm font-black uppercase tracking-tight text-sky-400">
                METOT MÜHENDİSLİĞİ • PROSES İŞ AKIŞ ŞEMASI (TAM EKRAN GÖRÜNÜM)
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold">
                Ürün: {productName} • Hat: {lineName} • Toplam {processes.length} Operasyon
              </p>
            </div>
            <button
              onClick={() => setIsFlowchartMaximized(false)}
              className="bg-sky-600 hover:bg-sky-500 text-white font-black text-xs py-2 px-4 rounded-xl shadow cursor-pointer transition"
            >
              Tam Ekrandan Çık
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6 bg-slate-950 flex flex-col justify-center">
            <div className="w-full">
              {renderProcessFlowchart(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
