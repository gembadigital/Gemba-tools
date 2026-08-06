import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  LayoutDashboard, ClipboardList, Sliders, Coins, CheckSquare,
  Activity, Award, BookOpen, Plus, Trash2, Edit2, TrendingUp,
  Download, ArrowRight, Play, Eye, FileText, CheckCircle2,
  XCircle, AlertCircle, Sparkles, RefreshCw, Send, Check,
  GripVertical, FolderPlus, Archive, Settings, Info, Save, Link2, Unlink,
  ChevronDown, FileSpreadsheet
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { ActivityItem, SmedProject, ActionCard } from "./smed/smedTypes";
import { initialSmedProjects, calculateDurationFromTimes } from "./smed/smedDefaults";
import ActivityListTab from "./smed/ActivityListTab";
import GanttTimelineTab from "./smed/GanttTimelineTab";
import ConversionSimulatorTab from "./smed/ConversionSimulatorTab";
import { Customer, ProcessRecord } from "../types";

interface SmedPageProps {
  selectedCustomer?: Customer;
  vsmProcesses?: ProcessRecord[];
}

export default function SmedPage({ selectedCustomer, vsmProcesses = [] }: SmedPageProps) {
  // Scope all persistence to the active customer so switching factories doesn't leak SMED data across tenants
  const customerId = selectedCustomer?.id || "default";
  const selectedProjectStorageKey = `smed_selected_project_id_${customerId}`;
  const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";

  // Navigation for SMED sub-modules
  const [smedTab, setSmedTab] = useState<
    "dashboard" | "analysis" | "simulator" | "financial" | "actions" | "oee"
  >("dashboard");

  // SMED Analysis sub-tabs
  const [analysisSubTab, setAnalysisSubTab] = useState<"activities" | "timeline" | "conversion">("activities");

  // --- MULTI-PROJECT STATE MANAGEMENT (backend-persisted, list-per-customer like time_studies) ---
  const [projects, setProjects] = useState<SmedProject[]>([]);
  const isInitialLoad = useRef(true);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return localStorage.getItem(selectedProjectStorageKey) || "proj-1";
  });

  // Load saved SMED projects for this customer from the backend. If none exist yet, show the
  // illustrative demo projects locally (not persisted) so the module isn't empty on first use.
  useEffect(() => {
    isInitialLoad.current = true;
    fetch("/api/business/smed-projects", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": customerId
      }
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setProjects(res.data && res.data.length > 0 ? res.data : initialSmedProjects);
        }
      })
      .catch((err) => console.error("Failed to load SMED projects", err))
      .finally(() => {
        setTimeout(() => { isInitialLoad.current = false; }, 0);
      });
  }, [customerId, token]);

  const saveProjectToBackend = (project: SmedProject) => {
    fetch("/api/business/smed-projects", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": customerId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(project)
    })
      .then((res) => res.json())
      .catch((err) => console.error("Failed to save SMED project", err));
  };

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

  // Save selected project ID (a UI pointer, not business data) to localStorage
  useEffect(() => {
    localStorage.setItem(selectedProjectStorageKey, selectedProjectId);
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

  // Debounced autosave: any live edit to the active project (activities, ECRS gains, action
  // cards) persists to the backend a moment after the user stops typing/dragging, mirroring the
  // "live tunable state" autosave pattern used elsewhere (e.g. Spaghetti Sketcher).
  useEffect(() => {
    if (isInitialLoad.current || !activeProject) return;
    const timer = setTimeout(() => saveProjectToBackend(activeProject), 800);
    return () => clearTimeout(timer);
  }, [activeProject]);

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

  // Kaynak (source) mode for the project creation modal: start from a real VSM process
  // (pre-filling machine/setup data from it) or as a standalone SMED project.
  const [projSourceMode, setProjSourceMode] = useState<"vsm" | "standalone">("standalone");
  const [projLinkedProcess, setProjLinkedProcess] = useState<ProcessRecord | null>(null);

  // Open Project Creation Modal
  const handleOpenCreateModal = () => {
    setEditingProjectId(null);
    setProjSourceMode("standalone");
    setProjLinkedProcess(null);
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

  // Selecting a VSM process pre-fills the project form from its real data (machine name, and its
  // changeover time as the baseline setup duration to improve), and keeps the link for OEE tracing.
  const handleSelectVsmProcessForProject = (processId: string) => {
    const proc = vsmProcesses.find((p) => p.id === processId);
    if (!proc) return;
    setProjLinkedProcess(proc);
    setProjForm((f) => ({
      ...f,
      name: f.name || `${proc.name} Setup İyileştirmesi`,
      machineNo: proc.name,
      currentSetupTime: proc.changeoverMinutes && proc.changeoverMinutes > 0 ? proc.changeoverMinutes : f.currentSetupTime,
      targetSetupTime: proc.changeoverMinutes && proc.changeoverMinutes > 0 ? Math.max(5, Math.round(proc.changeoverMinutes * 0.3)) : f.targetSetupTime,
    }));
  };

  // Open Project Edit Modal
  const handleOpenEditModal = () => {
    if (!activeProject) return;
    setEditingProjectId(activeProject.id);
    setProjSourceMode(activeProject.linkedProcessId ? "vsm" : "standalone");
    setProjLinkedProcess(vsmProcesses.find((p) => p.id === activeProject.linkedProcessId) || null);
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

    const linkedFields = projSourceMode === "vsm" && projLinkedProcess
      ? {
          linkedProcessId: projLinkedProcess.id,
          linkedProcessName: projLinkedProcess.name,
          linkedProcessOee: projLinkedProcess.oee,
          linkedProcessDowntimeCost: projLinkedProcess.downtimeCost,
        }
      : { linkedProcessId: undefined, linkedProcessName: undefined, linkedProcessOee: undefined, linkedProcessDowntimeCost: undefined };

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
                ...linkedFields,
              }
            : p
        )
      );
      const updated = projects.find((p) => p.id === editingProjectId);
      if (updated) saveProjectToBackend({ ...updated, ...projForm, ...linkedFields });
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
        actions: [],
        ...linkedFields,
      };
      setProjects((prev) => [...prev, newProj]);
      setSelectedProjectId(newProj.id);
      saveProjectToBackend(newProj);
    }
    setIsProjectModalOpen(false);
  };

  // Archive Project
  const handleArchiveProject = () => {
    if (!activeProject) return;
    if (confirm(`"${activeProject.name}" projesini arşivlemek istediğinize emin misiniz?`)) {
      const archived = { ...activeProject, isArchived: true };
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProject.id ? archived : p))
      );
      saveProjectToBackend(archived);
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

  // Portfolio-wide Dashboard stats: derived from the real projects array (all non-archived SMED
  // projects for this customer), not fabricated demo figures.
  const nonArchivedProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);

  const projectSetupStats = useMemo(() => {
    return nonArchivedProjects
      .map((p) => ({
        id: p.id,
        machineNo: p.machineNo || p.code,
        productCode: p.productCode || p.productName || "—",
        dur: p.activities.reduce((s, a) => s + a.dur, 0),
        target: p.targetSetupTime,
      }))
      .filter((p) => p.dur > 0);
  }, [nonArchivedProjects]);

  const bestSetup = useMemo(
    () => (projectSetupStats.length ? projectSetupStats.reduce((m, p) => (p.dur < m.dur ? p : m)) : null),
    [projectSetupStats]
  );
  const worstSetup = useMemo(
    () => (projectSetupStats.length ? projectSetupStats.reduce((m, p) => (p.dur > m.dur ? p : m)) : null),
    [projectSetupStats]
  );

  // Current setup duration vs the project's originally recorded baseline (currentSetupTime),
  // so the KPI reflects real drift/improvement instead of a fabricated year-over-year figure.
  const setupVsBaselinePercent = useMemo(() => {
    if (!activeProject || activeProject.currentSetupTime <= 0) return 0;
    return Math.round(((totalDuration - activeProject.currentSetupTime) / activeProject.currentSetupTime) * 100);
  }, [activeProject, totalDuration]);

  const projectEcrsGainStats = useMemo(() => {
    return nonArchivedProjects.map((p) => ({
      id: p.id,
      label: p.machineNo || p.code,
      gain: p.activities.reduce((s, a) => {
        if (!a.ecrsGains) return s;
        return s + (a.ecrsGains.E || 0) + (a.ecrsGains.C || 0) + (a.ecrsGains.R || 0) + (a.ecrsGains.S || 0);
      }, 0),
    }));
  }, [nonArchivedProjects]);

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

  // OEE Entegrasyonu: activeProject bir VSM prosesine bağlıysa, o prosesin gerçek OEE'sini ve
  // SMED ile azaltılan setup süresinin OEE üzerindeki etkisini gösterir. Formül, VsmPage.tsx'teki
  // OEE = Availability x Performance x Quality ilkesine dayanır: Performance/Quality sabit kabul
  // edilip, setup süresindeki azalmanın yıllık planlı üretim süresine oranı kadar Availability (ve
  // dolayısıyla OEE) orantılı olarak iyileşir. 250 iş günü/yıl varsayımı, VsmPage.tsx'teki
  // annualizasyon formülleriyle aynıdır.
  const linkedProcess = useMemo(() => {
    if (!activeProject?.linkedProcessId) return null;
    return vsmProcesses.find((p) => p.id === activeProject.linkedProcessId) || null;
  }, [activeProject, vsmProcesses]);

  const oeeProjection = useMemo(() => {
    if (!activeProject?.linkedProcessId) return null;
    const currentOee = linkedProcess?.oee ?? activeProject.linkedProcessOee;
    if (currentOee === undefined || currentOee === null) return null;
    if (!linkedProcess) {
      // Linked process no longer exists in VSM; only the OEE captured at link-time is known.
      return { currentOee, projectedOee: null, gainPoints: null, isSnapshotOnly: true };
    }
    const annualPlannedMinutes = linkedProcess.workingHours * linkedProcess.shiftCount * 250 * 60;
    const annualDowntimeBeforeMin = totalDuration * ns;
    const annualDowntimeAfterMin = targetSetupTime * ns;
    const availabilityGainRatio = annualPlannedMinutes > 0
      ? Math.max(0, annualDowntimeBeforeMin - annualDowntimeAfterMin) / annualPlannedMinutes
      : 0;
    const projectedOee = Math.min(100, Number((currentOee * (1 + availabilityGainRatio)).toFixed(1)));
    return {
      currentOee,
      projectedOee,
      gainPoints: Number((projectedOee - currentOee).toFixed(1)),
      annualDowntimeBeforeHrs: Math.round(annualDowntimeBeforeMin / 60),
      annualDowntimeAfterHrs: Math.round(annualDowntimeAfterMin / 60),
      isSnapshotOnly: false,
    };
  }, [activeProject, linkedProcess, totalDuration, targetSetupTime, ns]);

  // 3. STATE: Actions Tracker — İyileştirme aksiyonları proje bazlıdır (activeProject.actions),
  // aynı activities gibi backend'e otomatik kaydedilir.
  const actions = useMemo(() => activeProject?.actions || [], [activeProject]);

  const handleUpdateActions = (newActions: ActionCard[]) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? { ...p, actions: newActions } : p))
    );
  };

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
    handleUpdateActions([...actions, newCard]);
    setNewActionTitle("");
    setNewActionAssignee("");
    setNewActionDue("");
    setNewActionBenefit("");
  };

  const moveAction = (id: number, targetCol: ActionCard["column"]) => {
    handleUpdateActions(actions.map((a) => (a.id === id ? { ...a, column: targetCol } : a)));
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

  const [isExportOpen, setIsExportOpen] = useState(false);

  // Real, styled PDF report — mirrors the dark-header + autoTable pattern used by Time Study's and
  // Yamazumi's PDF exports: proje özeti, aktivite/Gantt listesi, ECRS kazanım özeti, finansal
  // fizibilite ve (bağlıysa) OEE entegrasyonu tek raporda birleştirilir.
  // jsPDF's standard "Helvetica" font only supports WinAnsi/Latin-1 — İ, ı, Ş, ş, Ğ, ğ aren't in
  // that set and render as garbled digits/symbols (Ç/ç/Ö/ö/Ü/ü are fine, they're valid Latin-1).
  // Transliterate just those five letters rather than embedding a custom Unicode font.
  const pdfSafe = (s: unknown): string => String(s ?? "")
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g");

  const handleExportSmedPdf = () => {
    if (!activeProject) return;
    const doc = new jsPDF();
    doc.setFont("Helvetica");

    doc.setFillColor(154, 52, 18);
    doc.rect(0, 0, 210, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(pdfSafe("SMED ETÜT & SETUP EXCELLENCE RAPORU"), 14, 14);
    doc.setFontSize(10);
    doc.text(pdfSafe(`${selectedCustomer?.companyName || "Müşteri"} | ${activeProject.code} - ${activeProject.name}`), 14, 23);
    doc.text(pdfSafe(`Makine: ${activeProject.machineNo || "—"} | Kalıp: ${activeProject.moldNo || "—"} | Tarih: ${new Date().toLocaleDateString("tr-TR")}`), 14, 30);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(pdfSafe("1. PROJE ÖZETİ"), 14, 44);
    autoTable(doc, {
      body: [
        [pdfSafe("Proje Lideri"), pdfSafe(activeProject.leader || "—"), pdfSafe("Yalın Ekip"), pdfSafe(activeProject.team || "—")],
        [pdfSafe("Fabrika / Hat"), pdfSafe(`${activeProject.factory || "—"} / ${activeProject.productionLine || "—"}`), pdfSafe("Ürün (Mevcut→Yeni)"), pdfSafe(`${activeProject.productCode || "—"} → ${activeProject.productName || "—"}`)],
        [pdfSafe("Mevcut Setup Süresi"), `${totalDuration} dk`, pdfSafe("Hedef Setup Süresi"), `${activeProject.targetSetupTime} dk`],
        [pdfSafe("İç Hazırlık / Dış Hazırlık"), `${internalDuration} dk / ${externalDuration} dk`, pdfSafe("ECRS ile Simüle Edilen Hedef"), `${targetSetupTime} dk (-${totalEcrsGain} dk)`]
      ],
      startY: 48,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [255, 247, 237] }, 2: { fontStyle: "bold", fillColor: [255, 247, 237] } }
    });

    let nextY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(pdfSafe("2. AKTİVİTE LİSTESİ (GÖZLEM SIRASI)"), 14, nextY);
    autoTable(doc, {
      head: [[pdfSafe("No"), pdfSafe("Adım"), pdfSafe("Başlangıç"), pdfSafe("Bitiş"), pdfSafe("Süre (dk)"), pdfSafe("Tip"), pdfSafe("ECRS Kazanım")]],
      body: activities.map((a) => [
        `${a.sequence}`,
        pdfSafe(a.name),
        a.startTime,
        a.endTime,
        `${a.dur}`,
        a.type === "internal" ? pdfSafe("İç Hazırlık") : pdfSafe("Dış Hazırlık"),
        getEcrsGain(a) > 0 ? `-${getEcrsGain(a)} dk` : "—"
      ]),
      startY: nextY + 4,
      theme: "striped",
      styles: { fontSize: 7.5 },
      headStyles: { fillColor: [154, 52, 18] }
    });

    nextY = (doc as any).lastAutoTable.finalY + 10;
    if (nextY > 250) { doc.addPage(); nextY = 16; }
    doc.setFontSize(12);
    doc.text(pdfSafe("3. FİNANSAL FİZİBİLİTE ÖZETİ"), 14, nextY);
    autoTable(doc, {
      body: [
        [pdfSafe("Yıllık Kazanılan Süre"), `${savedHrs} saat`, pdfSafe("Ek Kapasite Kazancı"), `%${capPct}`],
        [pdfSafe("Yıllık Finansal Fayda"), `₺${benefit.toLocaleString("tr-TR")}`, pdfSafe("ROI Oranı"), `%${roi}`],
        [pdfSafe("Geri Ödeme Süresi"), `${payback} ay`, pdfSafe("3 Yıllık Net NPV"), `₺${npv.toLocaleString("tr-TR")}`]
      ],
      startY: nextY + 4,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [255, 247, 237] }, 2: { fontStyle: "bold", fillColor: [255, 247, 237] } }
    });

    if (oeeProjection && !oeeProjection.isSnapshotOnly) {
      nextY = (doc as any).lastAutoTable.finalY + 10;
      if (nextY > 250) { doc.addPage(); nextY = 16; }
      doc.setFontSize(12);
      doc.text(pdfSafe(`4. OEE ENTEGRASYONU (${activeProject.linkedProcessName || "VSM Prosesi"})`), 14, nextY);
      autoTable(doc, {
        body: [
          [pdfSafe("Mevcut OEE"), `%${oeeProjection.currentOee}`, pdfSafe("SMED Sonrası Tahmini OEE"), `%${oeeProjection.projectedOee}`],
          [pdfSafe("OEE Net Kazancı"), `+${oeeProjection.gainPoints} Puan`, pdfSafe("Yıllık Setup Kaynaklı Kayıp (Önce→Sonra)"), `${oeeProjection.annualDowntimeBeforeHrs} sa → ${oeeProjection.annualDowntimeAfterHrs} sa`]
        ],
        startY: nextY + 4,
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: "bold", fillColor: [255, 247, 237] }, 2: { fontStyle: "bold", fillColor: [255, 247, 237] } }
      });
    }

    if (actions.length > 0) {
      nextY = (doc as any).lastAutoTable.finalY + 10;
      if (nextY > 240) { doc.addPage(); nextY = 16; }
      doc.setFontSize(12);
      doc.text(pdfSafe(`${oeeProjection && !oeeProjection.isSnapshotOnly ? "5" : "4"}. İYİLEŞTİRME AKSİYON TAKİP LİSTESİ`), 14, nextY);
      const columnLabel: Record<ActionCard["column"], string> = { open: "Açık", progress: "Devam Ediyor", hold: "Beklemede", done: "Tamamlandı", cancel: "İptal" };
      autoTable(doc, {
        head: [[pdfSafe("Aksiyon"), pdfSafe("Öncelik"), pdfSafe("Sorumlu"), pdfSafe("Hedef Tarih"), pdfSafe("Durum"), pdfSafe("Etki")]],
        body: actions.map((a) => [pdfSafe(a.title), pdfSafe(a.priority), pdfSafe(a.assignee), a.dueDate, pdfSafe(columnLabel[a.column]), pdfSafe(a.benefit)]),
        startY: nextY + 4,
        theme: "striped",
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [154, 52, 18] }
      });
    }

    doc.save(`${activeProject.code}_SMED_Raporu.pdf`);
  };

  // Real .xlsx workbook — mirrors KaizenManager's SheetJS pattern (aoa_to_sheet + multiple sheets).
  const handleExportSmedExcel = () => {
    if (!activeProject) return;
    const summarySheet = [
      ["SMED Etüt Raporu", activeProject.code, activeProject.name],
      ["Müşteri", selectedCustomer?.companyName || ""],
      ["Rapor Tarihi", new Date().toLocaleDateString("tr-TR")],
      [],
      ["Metrik", "Değer"],
      ["Mevcut Setup Süresi (dk)", totalDuration],
      ["Hedef Setup Süresi (dk, proje)", activeProject.targetSetupTime],
      ["ECRS Simülasyonu Hedef Süresi (dk)", targetSetupTime],
      ["İç Hazırlık (dk)", internalDuration],
      ["Dış Hazırlık (dk)", externalDuration],
      ["Yıllık Kazanılan Süre (saat)", savedHrs],
      ["Kapasite Kazancı (%)", capPct],
      ["Yıllık Finansal Fayda (₺)", benefit],
      ["ROI (%)", roi],
      ["Geri Ödeme Süresi (ay)", payback],
      ["3 Yıllık Net NPV (₺)", npv]
    ];
    if (oeeProjection && !oeeProjection.isSnapshotOnly) {
      summarySheet.push(
        [],
        ["OEE Entegrasyonu", activeProject.linkedProcessName || ""],
        ["Mevcut OEE (%)", oeeProjection.currentOee],
        ["SMED Sonrası Tahmini OEE (%)", oeeProjection.projectedOee],
        ["OEE Net Kazancı (Puan)", oeeProjection.gainPoints]
      );
    }

    const activitiesHeaders = ["No", "Adım", "Başlangıç", "Bitiş", "Süre (dk)", "Tip", "Kategori", "ECRS Kazanım (dk)"];
    const activitiesRows = activities.map((a) => [
      a.sequence, a.name, a.startTime, a.endTime, a.dur,
      a.type === "internal" ? "İç Hazırlık" : "Dış Hazırlık", a.category || "—", getEcrsGain(a)
    ]);
    const activitiesSheet = [["Aktivite Listesi"], [], activitiesHeaders, ...activitiesRows];

    const columnLabel: Record<ActionCard["column"], string> = { open: "Açık", progress: "Devam Ediyor", hold: "Beklemede", done: "Tamamlandı", cancel: "İptal" };
    const actionsHeaders = ["Aksiyon", "Öncelik", "Sorumlu", "Hedef Tarih", "Durum", "Etki"];
    const actionsRows = actions.map((a) => [a.title, a.priority, a.assignee, a.dueDate, columnLabel[a.column], a.benefit]);
    const actionsSheet = [["İyileştirme Aksiyon Takip Listesi"], [], actionsHeaders, ...actionsRows];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summarySheet), "Ozet");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(activitiesSheet), "Aktiviteler");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(actionsSheet), "Aksiyonlar");
    XLSX.writeFile(wb, `${activeProject.code}_SMED_Raporu.xlsx`);
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
          {activeProject && (
            <div className="relative">
              <button
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl transition cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Rapor İndir</span>
                <ChevronDown className="w-3 h-3 text-slate-500 ml-0.5" />
              </button>
              {isExportOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 text-xs py-1.5 animate-fade-in">
                    <button
                      onClick={() => { handleExportSmedPdf(); setIsExportOpen(false); }}
                      className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center space-x-2 font-bold cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      <span>SMED Etüt Raporu (.pdf)</span>
                    </button>
                    <button
                      onClick={() => { handleExportSmedExcel(); setIsExportOpen(false); }}
                      className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center space-x-2 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>SMED Etüt Raporu (.xlsx)</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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
            <span className="text-[11px] font-black uppercase text-slate-400 block tracking-wider">Aktif SMED Projesi</span>
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

            {/* KAYNAK SEÇİMİ: VSM'de düşük OEE / uzun setup süresi tespit edilen bir prosesten
                başlat, ya da bağımsız bir SMED projesi olarak devam et. */}
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Kaynak:</span>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setProjSourceMode("vsm")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      projSourceMode === "vsm" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" /> VSM Prosesinden Başlat
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjSourceMode("standalone")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      projSourceMode === "standalone" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Unlink className="w-3.5 h-3.5" /> Bağımsız Proje
                  </button>
                </div>
              </div>
              {projSourceMode === "vsm" && (
                vsmProcesses.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    Bu müşteri için VSM'de kayıtlı proses bulunamadı. Önce VSM Kapasite Analizi modülünde bir akış oluşturun.
                  </p>
                ) : (
                  <select
                    value={projLinkedProcess?.id || ""}
                    onChange={(e) => e.target.value && handleSelectVsmProcessForProject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="" disabled>VSM'de kayıtlı bir proses seçin (düşük OEE / uzun setup öncelikli)...</option>
                    {[...vsmProcesses].sort((a, b) => a.oee - b.oee).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — OEE %{p.oee}{p.changeoverMinutes ? `, Setup: ${p.changeoverMinutes}dk` : ""}
                      </option>
                    ))}
                  </select>
                )
              )}
              {projLinkedProcess && projSourceMode === "vsm" && (
                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> VSM Bağlantılı: {projLinkedProcess.name} (Mevcut OEE %{projLinkedProcess.oee})
                </span>
              )}
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Proje Kodu</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.code}
                    onChange={(e) => setProjForm({ ...projForm, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Proje Adı / Tanımı</label>
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
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Çalışma Lideri / Mühendis</label>
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
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Yalın Ekip Üyeleri</label>
                  <input
                    type="text"
                    placeholder="örn: S. Kaya, T. Demir"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.team}
                    onChange={(e) => setProjForm({ ...projForm, team: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Fabrika / Tesis</label>
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.factory}
                    onChange={(e) => setProjForm({ ...projForm, factory: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Üretim Hattı</label>
                  <input
                    type="text"
                    placeholder="örn: Pres Hattı 2"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.productionLine}
                    onChange={(e) => setProjForm({ ...projForm, productionLine: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Makine / Ekipman No</label>
                  <input
                    type="text"
                    placeholder="örn: PRS-01-200T"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.machineNo}
                    onChange={(e) => setProjForm({ ...projForm, machineNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Kalıp No / ID</label>
                  <input
                    type="text"
                    placeholder="örn: MLD-PRS-001"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.moldNo}
                    onChange={(e) => setProjForm({ ...projForm, moldNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Ürün Kodu (Mevcut)</label>
                  <input
                    type="text"
                    placeholder="örn: PRD-A22"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.productCode}
                    onChange={(e) => setProjForm({ ...projForm, productCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Ürün Kodu (Yeni)</label>
                  <input
                    type="text"
                    placeholder="örn: PRD-B15"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.productName}
                    onChange={(e) => setProjForm({ ...projForm, productName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Baz Kurulum Süresi (dk)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-500"
                    value={projForm.currentSetupTime}
                    onChange={(e) => setProjForm({ ...projForm, currentSetupTime: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Hedef Setup Süresi (dk)</label>
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
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Aktif Proje Setup</span>
              <div className="text-xl font-black text-slate-900 mt-1">{totalDuration} dk</div>
              <div className={`text-[11px] font-bold mt-1 ${setupVsBaselinePercent <= 0 ? "text-green-600" : "text-red-600"}`}>
                {setupVsBaselinePercent === 0 ? "Baz süreyle aynı" : `${setupVsBaselinePercent > 0 ? "+" : ""}${setupVsBaselinePercent}% vs proje başlangıcı`}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-best-setup">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">En İyi Setup</span>
              <div className="text-xl font-black text-slate-900 mt-1">{bestSetup ? `${bestSetup.dur} dk` : "—"}</div>
              <div className="text-[11px] text-slate-500 font-bold mt-1">{bestSetup ? `${bestSetup.machineNo} | ${bestSetup.productCode}` : "Veri yok"}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-worst-setup">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">En Kötü Setup</span>
              <div className="text-xl font-black text-slate-900 mt-1">{worstSetup ? `${worstSetup.dur} dk` : "—"}</div>
              <div className="text-[11px] text-orange-650 font-bold mt-1">{worstSetup ? `${worstSetup.machineNo} | ${worstSetup.productCode}` : "Veri yok"}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-saved-time">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Kazanılan Süre</span>
              <div className="text-xl font-black text-slate-900 mt-1">{savedHrs} sa</div>
              <div className="text-[11px] text-green-600 font-bold mt-1">Yıllık toplam kazanç</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-capacity-gain">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Kapasite Kazancı</span>
              <div className="text-xl font-black text-slate-900 mt-1">+{capPct}%</div>
              <div className="text-[11px] text-slate-500 font-bold mt-1">Setup optimizasyonuyla</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-roi">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">ROI Oranı</span>
              <div className="text-xl font-black text-slate-900 mt-1">%{roi}</div>
              <div className="text-[11px] text-green-600 font-bold mt-1">Yıllık Net ROI</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-total-analyses">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Toplam Analiz</span>
              <div className="text-xl font-black text-slate-900 mt-1">{activities.length} Adet</div>
              <div className="text-[11px] text-slate-500 font-bold mt-1">Kayıtlı operasyon</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" id="kpi-open-actions">
              <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Açık Aksiyon</span>
              <div className="text-xl font-black text-red-600 mt-1">
                {nonArchivedProjects.flatMap((p) => p.actions || []).filter((a) => a.column === "open" || a.column === "progress").length}
              </div>
              <div className="text-[11px] text-slate-500 font-bold mt-1">Tüm projelerde bekleyen</div>
            </div>
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Project Setup Comparison Bar Chart — real data, generated from the projects array */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-2 mb-4">
                <h4 className="text-xs font-black text-slate-800 uppercase">Proje Bazlı Setup Karşılaştırması</h4>
                <p className="text-[10px] text-slate-400 font-bold">Mevcut vs Hedef (dk)</p>
              </div>
              {projectSetupStats.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic text-center py-8">Henüz aktivite verisi girilmiş bir proje yok.</p>
              ) : (
                <div className="h-44 w-full">
                  <svg className="w-full h-full" viewBox="0 0 350 160">
                    <line x1="30" y1="20" x2="330" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="70" x2="330" y2="70" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="120" x2="330" y2="120" stroke="#cbd5e1" strokeWidth="1" />
                    {(() => {
                      const maxVal = Math.max(...projectSetupStats.map((p) => Math.max(p.dur, p.target)), 1);
                      const slotWidth = 300 / Math.max(projectSetupStats.length, 1);
                      return projectSetupStats.slice(0, 6).map((p, i) => {
                        const cx = 35 + i * slotWidth;
                        const durH = (p.dur / maxVal) * 95;
                        const targetH = (p.target / maxVal) * 95;
                        return (
                          <g key={p.id}>
                            <rect x={cx} y={120 - durH} width={Math.min(16, slotWidth / 3)} height={durH} fill="#ef4444" rx="2" />
                            <rect x={cx + Math.min(18, slotWidth / 3 + 2)} y={120 - targetH} width={Math.min(16, slotWidth / 3)} height={targetH} fill="#2563eb" rx="2" />
                            <text x={cx + slotWidth / 4} y="132" className="text-[10px] font-bold fill-slate-500" textAnchor="middle">{p.machineNo.slice(0, 8)}</text>
                          </g>
                        );
                      });
                    })()}
                  </svg>
                </div>
              )}
            </div>

            {/* ECRS Gain by Project — real data, from each project's activity-level ecrsGains */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-2 mb-4">
                <h4 className="text-xs font-black text-slate-800 uppercase">Proje Bazlı ECRS Kazanç Dağılımı</h4>
                <p className="text-[10px] text-slate-400 font-bold">Toplam ECRS kazanımı (dk)</p>
              </div>
              {projectEcrsGainStats.every((p) => p.gain === 0) ? (
                <p className="text-[11px] text-slate-400 italic text-center py-8">Henüz ECRS iyileştirmesi işaretlenmemiş.</p>
              ) : (
                <div className="h-44 w-full">
                  <svg className="w-full h-full" viewBox="0 0 350 160">
                    <line x1="30" y1="20" x2="330" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="70" x2="330" y2="70" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="30" y1="120" x2="330" y2="120" stroke="#cbd5e1" strokeWidth="1" />
                    {(() => {
                      const maxVal = Math.max(...projectEcrsGainStats.map((p) => p.gain), 1);
                      const slotWidth = 300 / Math.max(projectEcrsGainStats.length, 1);
                      return projectEcrsGainStats.slice(0, 6).map((p, i) => {
                        const cx = 35 + i * slotWidth;
                        const h = (p.gain / maxVal) * 95;
                        return (
                          <g key={p.id}>
                            <rect x={cx} y={120 - h} width={Math.min(22, slotWidth / 2)} height={h} fill="#10b981" rx="2" />
                            <text x={cx + Math.min(11, slotWidth / 4)} y={112 - h} className="text-[10px] font-black fill-emerald-700" textAnchor="middle">{p.gain > 0 ? `${p.gain}dk` : ""}</text>
                            <text x={cx + Math.min(11, slotWidth / 4)} y="132" className="text-[10px] font-bold fill-slate-500" textAnchor="middle">{p.label.slice(0, 8)}</text>
                          </g>
                        );
                      });
                    })()}
                  </svg>
                </div>
              )}
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
                    <span className="text-[11px] font-black text-slate-400 uppercase">Toplam</span>
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
              customerId={customerId}
              machineCostPerHour={mc}
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
            customerId={customerId}
            machineCostPerHour={mc}
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
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
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
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
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
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
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
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
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
                  <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
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
                    <span className="text-[11px] text-slate-400 font-black uppercase block">Yıllık Kazanılan Süre</span>
                    <div className="text-lg font-black text-blue-600 mt-1 font-mono">{savedHrs} Saat</div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <span className="text-[11px] text-slate-400 font-black uppercase block">Ek Üretim Kapasitesi</span>
                    <div className="text-lg font-black text-blue-600 mt-1 font-mono">+{capPct}%</div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <span className="text-[11px] text-green-800 font-black uppercase block">Yıllık Finansal Fayda</span>
                    <div className="text-lg font-black text-green-700 mt-1 font-mono">
                      ₺{(benefit / 1000000).toFixed(2)}M
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <span className="text-[11px] text-blue-800 font-black uppercase block">ROI Oranı</span>
                    <div className="text-lg font-black text-blue-700 mt-1 font-mono">%{roi}</div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                    <span className="text-[11px] text-amber-800 font-black uppercase block">Geri Ödeme Süresi</span>
                    <div className="text-lg font-black text-amber-700 mt-1 font-mono">{payback} Ay</div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <span className="text-[11px] text-slate-400 font-black uppercase block">3 Yıllık Net NPV</span>
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
                      <span className="text-[11px] font-black text-slate-400 uppercase">Toplam</span>
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
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-black">
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
                      <div className="flex justify-between items-center border-t border-slate-100 pt-1.5 text-[11px] text-slate-400 font-bold">
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
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-black">
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
                      <div className="flex justify-between items-center border-t border-slate-100 pt-1.5 text-[11px] text-slate-400 font-bold">
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
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-black">
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
                      <div className="flex justify-between items-center border-t border-slate-100 pt-1.5 text-[11px] text-slate-400 font-bold">
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
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-black">
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
                      <div className="border-t border-emerald-100 pt-1 text-[11px] text-emerald-600 font-black">
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
                <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-black">
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
          {!activeProject?.linkedProcessId ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-3">
              <Link2 className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-sm font-black text-slate-700 uppercase">Bu Proje Bir VSM Prosesine Bağlı Değil</h4>
              <p className="text-xs text-slate-450 font-bold max-w-md mx-auto">
                Gerçek OEE verisiyle karşılaştırma yapabilmek için bu SMED projesini VSM Kapasite Analizi'nde kayıtlı bir prosese bağlayın.
              </p>
              <button
                onClick={handleOpenEditModal}
                className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Projeyi Düzenle ve VSM Prosesi Bağla</span>
              </button>
            </div>
          ) : oeeProjection?.isSnapshotOnly ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-2">
              <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
              <p className="text-xs font-bold text-amber-800">
                Bağlı VSM prosesi ("{activeProject.linkedProcessName}") artık bulunamıyor. Sadece bağlantı anında kaydedilen OEE değeri gösteriliyor: %{oeeProjection.currentOee}
              </p>
            </div>
          ) : oeeProjection ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-red-200 rounded-xl p-5 shadow-xs text-center">
                  <span className="text-[10px] text-red-800 font-black uppercase block tracking-wider">Mevcut OEE Oranı ({activeProject.linkedProcessName})</span>
                  <div className="text-4xl font-black text-red-600 mt-2 font-mono">{oeeProjection.currentOee}%</div>
                  <span className="text-[10px] text-slate-400 font-bold block mt-1">VSM Kapasite Analizi'nden canlı veri</span>
                </div>

                <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-xs text-center">
                  <span className="text-[10px] text-emerald-800 font-black uppercase block tracking-wider">SMED Sonrası Tahmini OEE</span>
                  <div className="text-4xl font-black text-emerald-600 mt-2 font-mono">{oeeProjection.projectedOee}%</div>
                  <span className="text-[10px] text-green-600 font-bold block mt-1">{targetSetupTime} dk hedef setup ile</span>
                </div>

                <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-xs text-center">
                  <span className="text-[10px] text-blue-800 font-black uppercase block tracking-wider">OEE Net Kazancı (Tahmini)</span>
                  <div className="text-4xl font-black text-blue-600 mt-2 font-mono">+{oeeProjection.gainPoints} Puan</div>
                  <span className="text-[10px] text-green-600 font-bold block mt-1">Setup kaynaklı kullanılabilirlik artışı</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="text-xs font-black text-slate-800 uppercase border-b border-slate-100 pb-2">
                  Setup Kaynaklı Yıllık Kullanılamama Süresi (Availability Kaybı)
                </div>
                <p className="text-[10px] text-slate-450 font-bold -mt-2">
                  Yıllık {ns} setup üzerinden hesaplanmıştır (Finansal Etki Fizibilitesi sekmesinde değiştirilebilir).
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
                  <div className="text-center">
                    <span className="text-[10px] text-red-500 font-black uppercase block">Mevcut (SMED öncesi)</span>
                    <div className="text-2xl font-black text-red-500 font-mono">{oeeProjection.annualDowntimeBeforeHrs} saat/yıl</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 rotate-90 sm:rotate-0" />
                  <div className="text-center">
                    <span className="text-[10px] text-emerald-500 font-black uppercase block">Hedef (SMED sonrası)</span>
                    <div className="text-2xl font-black text-emerald-500 font-mono">{oeeProjection.annualDowntimeAfterHrs} saat/yıl</div>
                    <span className="text-[11px] text-green-600 font-bold block mt-0.5">-{oeeProjection.annualDowntimeBeforeHrs - oeeProjection.annualDowntimeAfterHrs} saat/yıl kazanım</span>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <div className="relative w-full h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, oeeProjection.projectedOee)}%` }}
                    />
                    <div
                      className="absolute inset-y-0 border-l-2 border-dashed border-slate-500"
                      style={{ left: `${Math.min(100, oeeProjection.currentOee)}%` }}
                      title="Mevcut OEE"
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow">
                      %{oeeProjection.currentOee} → %{oeeProjection.projectedOee}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
