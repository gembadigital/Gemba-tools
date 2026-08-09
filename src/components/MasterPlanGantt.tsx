import React, { useState, useEffect, useMemo, useRef } from "react";
import { GanttActivity } from "../types";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { 
  Calendar, List, KanbanSquare, Clock, Plus, Trash2, Edit3, 
  CheckCircle2, AlertTriangle, Play, HelpCircle, ArrowRight, User,
  Settings, FileSpreadsheet, BrainCircuit, RefreshCw, Layers,
  ChevronUp, ChevronDown, Check, Zap, Info, ShieldCheck, Download, Upload, Maximize2, Minimize2, X, TrendingUp
} from "lucide-react";

interface MasterPlanGanttProps {
  activities: GanttActivity[];
  kaizens?: any[];
  audits5S?: any[];
  processes?: any[];
  onAddActivity: (activity: any) => void;
  onUpdateActivity: (activity: any) => void;
  onDeleteActivity: (id: string) => void;
  activeCustomerId?: string;
  customerName?: string;
}

type ViewType = "timeline" | "table" | "kanban";

interface ContractPackage {
  id: string;
  name: string;
  value: number; // Man-Days per week
}

// ISO 8601 week/year from an ISO date string (YYYY-MM-DD) — same algorithm PtrTimeStudy.tsx's
// getWeekAndYearFromDateString uses (kept consistent so "Hafta N" means the same calendar week
// across the app), just taking an ISO date directly instead of a Turkish DD.MM.YYYY string.
function getIsoWeekAndYearFromDateString(isoDateStr?: string): { week: number; year: number } | null {
  if (!isoDateStr) return null;
  const d = new Date(`${isoDateStr}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { week, year };
}

export default function MasterPlanGantt({
  activities,
  kaizens = [],
  audits5S = [],
  processes = [],
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity,
  activeCustomerId: propActiveCustomerId,
  customerName
}: MasterPlanGanttProps) {
  const [activeView, setActiveView] = useState<ViewType>("timeline");
  const [isAdding, setIsAdding] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);

  // State for plan delete confirmation dialog
  const [planToDelete, setPlanToDelete] = useState<{ id: string; name: string } | null>(null);
  const [formActualWeeksStr, setFormActualWeeksStr] = useState("");

  // Helper to convert array of active week numbers into contiguous blocks
  const getWeekBlocks = (weeks: number[]) => {
    if (!weeks || weeks.length === 0) return [];
    const sorted = Array.from(new Set(weeks)).sort((a, b) => a - b);
    const blocks: { start: number; finish: number }[] = [];
    let currentStart = sorted[0];
    let currentPrev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === currentPrev + 1) {
        currentPrev = sorted[i];
      } else {
        blocks.push({ start: currentStart, finish: currentPrev });
        currentStart = sorted[i];
        currentPrev = sorted[i];
      }
    }
    blocks.push({ start: currentStart, finish: currentPrev });
    return blocks;
  };

  // States for creating a custom project plan name
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [newPlanInputName, setNewPlanInputName] = useState("");

  // Active Customer ID/Key for this module's server-persisted per-customer state.
  const activeCustomerId = propActiveCustomerId || "";
  // Real active customer's display name for reports/exports — falls back to the id only if the
  // parent hasn't resolved a name yet, never to a different customer's hardcoded name.
  const activeCustomerName = customerName || activeCustomerId;
  const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";

  // Load Proje Takip Raporu (PTR) records for syncing actual weeks. PTR is backend-persisted
  // (previously read a `gemba_ptr_records_*` localStorage key that PTR itself no longer writes).
  const [ptrRecords, setPtrRecords] = useState<any[]>([]);

  useEffect(() => {
    const loadPtr = () => {
      fetch("/api/business/ptr-records", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-factory-id": activeCustomerId
        }
      })
        .then(res => res.json())
        .then(res => setPtrRecords(res.success && Array.isArray(res.data) ? res.data : []))
        .catch(() => setPtrRecords([]));
    };
    loadPtr();
  }, [activeCustomerId]);

  // Records from the rest of the gemba-tools toolset, loaded here (not passed as props — App.tsx
  // doesn't centralize these) purely so "İlişkili Yalın Modül" / "İlişkili Kayıt" can link a Master
  // Plan activity to a real record from any tool, not just 5S/Kaizen/Processes.
  const [smedProjects, setSmedProjects] = useState<any[]>([]);
  const [vsmProjects, setVsmProjects] = useState<any[]>([]);
  const [timeStudies, setTimeStudies] = useState<any[]>([]);
  const [yamazumiStudies, setYamazumiStudies] = useState<any[]>([]);
  const [opexAssessments, setOpexAssessments] = useState<any[]>([]);

  useEffect(() => {
    if (!activeCustomerId || !token) return;
    const authHeaders = { "Authorization": `Bearer ${token}`, "x-factory-id": activeCustomerId };
    const loadList = (url: string, setter: (v: any[]) => void) => {
      fetch(url, { headers: authHeaders })
        .then(res => res.json())
        .then(res => setter(res.success && Array.isArray(res.data) ? res.data : []))
        .catch(() => setter([]));
    };
    loadList("/api/business/smed-projects", setSmedProjects);
    loadList("/api/business/vsm-projects", setVsmProjects);
    loadList("/api/business/time-studies", setTimeStudies);
    loadList("/api/business/yamazumi-studies", setYamazumiStudies);
    loadList("/api/business/opex-assessments", setOpexAssessments);
  }, [activeCustomerId, token]);

  // Generic label picker for cross-module record dropdowns — each tool names its own record field
  // differently (project/study/line name), so try the common ones in order.
  const getRecordLabel = (r: any): string =>
    r.name || r.projectName || r.title || r.lineName || r.productName || r.studyName || `Kayıt ${String(r.id).slice(-6)}`;

  // Top Tabbed Navigation State
  const [currentTopTab, setCurrentTopTab] = useState<string>("master");

  // Module state persisted server-side as one blob per customer (weekly consulting-package
  // capacity + custom project plans) — previously entirely localStorage-only
  // (gemba_contract_pkg_*, gemba_custom_project_plans_*, gemba_deleted_custom_project_plans_*),
  // so it only ever existed in whichever browser last edited it and was invisible to the rest of
  // the team. Deleted plans stay in `customPlans` with `deletedAt` set (soft delete) so the trash
  // bin in Sistem Ayarları can restore or permanently delete them.
  const [customPlans, setCustomPlans] = useState<{ id: string; name: string; activities: any[]; deletedAt?: string }[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("pkg_2");
  const [customCapacity, setCustomCapacity] = useState<number>(4);
  const [masterPlanStateReady, setMasterPlanStateReady] = useState(false);

  const fetchMasterPlanState = () => {
    if (!activeCustomerId || !token) return;
    setMasterPlanStateReady(false);
    fetch("/api/business/master-plan-state", {
      headers: { "Authorization": `Bearer ${token}`, "x-factory-id": activeCustomerId }
    })
      .then(res => res.json())
      .then(data => {
        const s = (data.success && data.data) ? data.data : null;
        setCustomPlans(s?.customPlans ?? []);
        setSelectedPackageId(s?.contractPackageId ?? "pkg_2");
        setCustomCapacity(s?.customCapacity ?? 4);
        setMasterPlanStateReady(true);
      })
      .catch(err => {
        console.error("Failed to load Master Plan state", err);
        setMasterPlanStateReady(true);
      });
  };

  useEffect(fetchMasterPlanState, [activeCustomerId, token]);

  // Debounced auto-save whenever the module's persisted state changes (mirrors the pattern used
  // by Loss Capacity Analizi / Company Workspace) — `masterPlanStateReady` gates this so it never
  // fires with default/empty values before the real saved state (or "nothing saved yet") arrives.
  useEffect(() => {
    if (!masterPlanStateReady || !activeCustomerId || !token) return;
    const timeoutId = setTimeout(() => {
      fetch("/api/business/master-plan-state", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-factory-id": activeCustomerId,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ state: { contractPackageId: selectedPackageId, customCapacity, customPlans } })
      }).catch(err => console.error("Failed to save Master Plan state", err));
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [customPlans, selectedPackageId, customCapacity, masterPlanStateReady, activeCustomerId, token]);

  // Listen for external changes (e.g. trash restore/permanent-delete from Sistem Ayarları) and
  // reload from the server so this view stays in sync.
  useEffect(() => {
    window.addEventListener("CustomPlansChanged", fetchMasterPlanState);
    return () => window.removeEventListener("CustomPlansChanged", fetchMasterPlanState);
  }, [activeCustomerId, token]);

  // Only non-deleted plans are shown as tabs / selectable.
  const activePlans = customPlans.filter(p => !p.deletedAt);

  // Dynamic selector for current active activities list
  const activeCustomPlan = activePlans.find(p => p.id === currentTopTab);
  const currentActivities = currentTopTab === "master" ? activities : (activeCustomPlan ? activeCustomPlan.activities : []);

  // Trigger naming modal
  const handleCreateProjectPlan = () => {
    setNewPlanInputName(`Proje Planı ${activePlans.length + 1}`);
    setIsCreatingPlan(true);
  };

  // Creator function that clones the current master plan activities as a starting template with selected name
  const handleCreateProjectPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newPlanInputName.trim() || `Proje Planı ${activePlans.length + 1}`;
    const newPlanId = "plan_" + Math.random().toString(36).substring(2, 9);

    // Copy current master plan's activities to act as a template copy
    const clonedActivities = activities.map(act => ({
      ...act,
      id: "act_" + Math.random().toString(36).substring(2, 9) // avoid id collision
    }));

    const newPlan = {
      id: newPlanId,
      name: trimmedName,
      activities: clonedActivities
    };

    setCustomPlans(prev => [...prev, newPlan]);
    setCurrentTopTab(newPlanId);
    setIsCreatingPlan(false);
    setNewPlanInputName("");
  };

  // Wrapper mutation handlers that direct to either master props or local state
  const onAddActivityLocal = (act: any) => {
    if (currentTopTab === "master") {
      onAddActivity(act);
    } else {
      setCustomPlans(prev => prev.map(p => {
        if (p.id === currentTopTab) {
          return { ...p, activities: [...p.activities, act] };
        }
        return p;
      }));
    }
  };

  const onUpdateActivityLocal = (act: any) => {
    if (currentTopTab === "master") {
      onUpdateActivity(act);
    } else {
      setCustomPlans(prev => prev.map(p => {
        if (p.id === currentTopTab) {
          return { ...p, activities: p.activities.map(item => item.id === act.id ? act : item) };
        }
        return p;
      }));
    }
  };

  const onDeleteActivityLocal = (id: string) => {
    if (currentTopTab === "master") {
      onDeleteActivity(id);
    } else {
      setCustomPlans(prev => prev.map(p => {
        if (p.id === currentTopTab) {
          return { ...p, activities: p.activities.filter(item => item.id !== id) };
        }
        return p;
      }));
    }
  };

  // Settings: Project Time Range (Zaman Aralığı) — Başlangıç/Bitiş Yıl+Hafta, the actual chart
  // zoom window. Kept narrow by default ("this ISO week -> +15 weeks") regardless of how long the
  // customer's overall project runs — the Proje Portföyü span (which can be a full year or more)
  // is shown separately, read-only, above the chart (see projectPortfolioRange below) instead of
  // forcing this editable window that wide. Fully user-editable afterward.
  const nowIsoWeek = getIsoWeekAndYearFromDateString(new Date().toISOString().split("T")[0]);
  const [startWeek, setStartWeek] = useState(nowIsoWeek?.week ?? 1);
  const [startYear, setStartYear] = useState(nowIsoWeek?.year ?? new Date().getFullYear());
  const [endWeek, setEndWeek] = useState(Math.min(52, (nowIsoWeek?.week ?? 1) + 15));
  const [endYear, setEndYear] = useState(nowIsoWeek?.year ?? new Date().getFullYear());

  // Absolute week index (each calendar year treated as exactly 52 weeks — the same approximation
  // already implicit in every "1-52" week input in this module) so the chart can correctly span a
  // year boundary, e.g. Başlangıç 2026/H32 -> Bitiş 2027/H20, instead of endWeek-startWeek going
  // negative and collapsing the whole axis to a single giant column (the reported bug: cells
  // widening and nothing rendering past week 32). Individual activities only ever store a bare
  // 1-52 week number with no year of their own, so toAbsWeek() resolves a raw week onto this axis
  // by assuming it belongs to startYear unless that would place it before the axis start, in which
  // case it's assumed to be the following year — correct for the common "spans one year boundary"
  // case; a plan spanning 2+ years is a rarer edge case this single-wrap heuristic doesn't fully
  // disambiguate.
  const absStart = startYear * 52 + startWeek;
  const absEnd = endYear * 52 + endWeek;
  const totalWeeks = Math.max(1, absEnd - absStart + 1);
  const toAbsWeek = (rawWeek: number) => {
    const sameYear = startYear * 52 + rawWeek;
    return sameYear >= absStart ? sameYear : sameYear + 52;
  };

  // Read-only "Proje Süresi" info line shown above the chart — earliest Proje Portföyü project
  // start date to latest end date (customer card > Proje Portföyü), converted to ISO week/year.
  // Purely informational: doesn't drive the editable Zaman Aralığı chart window above.
  const [projectPortfolioRange, setProjectPortfolioRange] = useState<{
    startWeek: number; startYear: number; endWeek: number; endYear: number;
  } | null>(null);

  useEffect(() => {
    if (!activeCustomerId || !token) return;
    fetch("/api/business/company-workspace", {
      headers: { "Authorization": `Bearer ${token}`, "x-factory-id": activeCustomerId }
    })
      .then(res => res.json())
      .then(res => {
        const projects: any[] = (res.success && res.data?.projects) || [];
        const starts = projects.map((p: any) => p.startDate).filter(Boolean).sort();
        const ends = projects.map((p: any) => p.endDate).filter(Boolean).sort();
        if (starts.length === 0) { setProjectPortfolioRange(null); return; }
        const startInfo = getIsoWeekAndYearFromDateString(starts[0]);
        const endInfo = getIsoWeekAndYearFromDateString(ends.length > 0 ? ends[ends.length - 1] : starts[starts.length - 1]);
        setProjectPortfolioRange(startInfo && endInfo ? {
          startWeek: startInfo.week, startYear: startInfo.year,
          endWeek: endInfo.week, endYear: endInfo.year
        } : null);
      })
      .catch(() => setProjectPortfolioRange(null));
  }, [activeCustomerId, token]);

  // 1. Consulting Package Contract State (selectedPackageId/customCapacity are declared above,
  // loaded from and auto-saved to the server as part of the module's persisted state)
  const packages: ContractPackage[] = [
    { id: "pkg_1", name: "Haftalık 1 Adam-Gün (Weekly 1 Man-Day)", value: 1 },
    { id: "pkg_2", name: "Haftalık 2 Adam-Gün (Weekly 2 Man-Days)", value: 2 },
    { id: "pkg_3", name: "Haftalık 3 Adam-Gün (Weekly 3 Man-Days)", value: 3 },
    { id: "pkg_5", name: "Haftalık 5 Adam-Gün (Weekly 5 Man-Days)", value: 5 },
    { id: "pkg_custom", name: "Özel Paket (Custom)", value: 4 }
  ];

  const activePackage = packages.find(p => p.id === selectedPackageId) || packages[1];
  const weeklyCapacity = selectedPackageId === "pkg_custom" ? customCapacity : activePackage.value;

  // 3. Screen Expansion State
  const [isExpanded, setIsExpanded] = useState(false);

  // AI Assistant Copilot State (unused)
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const handleGenerateAiSummary = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/gemini/masterplan-analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || ""}`
        },
        body: JSON.stringify({
          activities: currentActivities.map((a, index) => ({
            ...a,
            activityNo: (a as any).activityNo || String(index + 1).padStart(2, "0"),
            category: (a as any).category || "Yalın Danışmanlık",
            plannedStartWeek: (a as any).plannedStartWeek || 24,
            plannedFinishWeek: (a as any).plannedFinishWeek || 28,
            actualStartWeek: (a as any).actualStartWeek || 24,
            actualFinishWeek: (a as any).actualFinishWeek || 29,
            responsibleConsultant: (a as any).responsibleConsultant || "OpEx Team",
          })),
          visits: ptrRecords.map((r: any) => ({
            date: r.workDate,
            consultant: r.responsible,
            duration: 1,
            activitiesPerformed: [r.activitySubject].filter(Boolean),
            deliverables: r.output
          })),
          contractPackage: {
            name: activePackage.name,
            value: weeklyCapacity
          },
          stats: {
            totalPlannedManDays: kpis.totalPlannedManDays,
            consumedManDays: kpis.consumedManDays,
            remainingManDays: kpis.remainingManDays
          },
          language: "tr"
        })
      });

      const data = await response.json();
      if (data.success) {
        setAiReport(data.report);
      } else {
        setAiError(data.error || "Gemini analysis failed.");
      }
    } catch (e: any) {
      setAiError(e.message || "Network error requesting Gemini analysis.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // 4. Form States for Add/Edit Activity
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("5S Audit");
  const [formPhase, setFormPhase] = useState("F1");
  const [formPriority, setFormPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [formStatus, setFormStatus] = useState<any>("Planned");
  const [formProgress, setFormProgress] = useState(0);
  const [formNotes, setFormNotes] = useState("");
  const [formPlannedStartWeek, setFormPlannedStartWeek] = useState(24);
  const [formPlannedFinishWeek, setFormPlannedFinishWeek] = useState(28);
  const [formActualStartWeek, setFormActualStartWeek] = useState(24);
  const [formActualFinishWeek, setFormActualFinishWeek] = useState(28);
  const [formPlannedManDays, setFormPlannedManDays] = useState(5);
  const [formConsultant, setFormConsultant] = useState("Ahmet Yılmaz");
  const [formMilestone, setFormMilestone] = useState(false);
  const [formDependencies, setFormDependencies] = useState<string>("");
  const [formRelatedModule, setFormRelatedModule] = useState("");
  const [formLinkedItemId, setFormLinkedItemId] = useState("");
  const [formParallelWith, setFormParallelWith] = useState<string>("");
  const [pendingParentActivityId, setPendingParentActivityId] = useState<string>("");

  // Which top-level activities have their alt faaliyet (sub-activity) rows hidden. Starts empty
  // (everything expanded) — collapsing is opt-in per activity via the "alt ›" / "‹" toggle.
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());

  // Filters State
  const [filterConsultant, setFilterConsultant] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Auto-upgrade activities structure from standard database items & sync PTR actual weeks
  const upgradedActivities = currentActivities.map((act, index) => {
    // Determine weeks based on startDate/endDate month strings if missing
    let pStart = (act as any).plannedStartWeek;
    let pFinish = (act as any).plannedFinishWeek;
    if (!pStart || !pFinish) {
      const sDate = act.startDate || "2026-06";
      const eDate = act.endDate || "2026-08";
      if (sDate.includes("-06")) pStart = 24;
      else if (sDate.includes("-07")) pStart = 28;
      else if (sDate.includes("-08")) pStart = 32;
      else pStart = 24;

      if (eDate.includes("-06")) pFinish = 27;
      else if (eDate.includes("-07")) pFinish = 31;
      else if (eDate.includes("-08")) pFinish = 35;
      else pFinish = 32;
    }

    const actNo = (act as any).activityNo || String(index + 1).padStart(2, "0");
    const category = (act as any).category || (act.name.toLowerCase().includes("5s") ? "5S Audit" : act.name.toLowerCase().includes("smed") ? "SMED" : "Kaizen");
    const resolvedConsultant = (act as any).responsibleConsultant || "Ahmet Yılmaz";

    // Collect actual active weeks from PTR records if available. Case-insensitive EXACT name
    // match only — the previous bidirectional substring test on activitySubject/workDone/category
    // (e.g. "5S", "TPM", "SMED") could attach an unrelated activity's PTR weeks to this one just
    // because one name/category contained the other's short fragment.
    //
    // `manualActualOverride`: once the user manually sets the actual dates (via the timeline's
    // kaydırma/shift arrows or the edit form's "Gerçekleşen Dönem" fields), that choice must win
    // going forward. Without this flag, PTR sync re-merged in every render and any manual edit was
    // silently discarded the moment PTR records existed for that activity's exact name — the range
    // could only ever grow (via set-union), never actually move, so "kaydırma" had no lasting
    // effect for any activity with logged visits.
    let rawActualWeeks: number[] = (act as any).actualWeeks || [];
    if (!(act as any).manualActualOverride && ptrRecords && ptrRecords.length > 0) {
      const actNameUpper = act.name.toUpperCase().trim();
      const matchedPtr = ptrRecords.filter(r => (r.activitySubject || "").toUpperCase().trim() === actNameUpper);
      if (matchedPtr.length > 0) {
        const ptrWeeks = Array.from(new Set(matchedPtr.map(r => parseInt(r.visitedWeek, 10)).filter(w => !isNaN(w)))).sort((a, b) => a - b);
        rawActualWeeks = Array.from(new Set([...rawActualWeeks, ...ptrWeeks])).sort((a, b) => a - b);
      }
    }

    if (rawActualWeeks.length === 0 && (act as any).actualStartWeek && (act as any).actualFinishWeek) {
      for (let w = (act as any).actualStartWeek; w <= (act as any).actualFinishWeek; w++) {
        rawActualWeeks.push(w);
      }
    }

    const resolvedActualStart = rawActualWeeks.length > 0 ? Math.min(...rawActualWeeks) : ((act as any).actualStartWeek || pStart);
    const resolvedActualFinish = rawActualWeeks.length > 0 ? Math.max(...rawActualWeeks) : ((act as any).actualFinishWeek || (act.status === "Delayed" ? pFinish + 2 : pFinish));

    return {
      ...act,
      activityNo: actNo,
      category: category,
      plannedStartWeek: pStart,
      plannedFinishWeek: pFinish,
      actualStartWeek: resolvedActualStart,
      actualFinishWeek: resolvedActualFinish,
      actualWeeks: rawActualWeeks,
      plannedManDays: (act as any).plannedManDays ?? 5,
      consumedManDays: (act as any).consumedManDays || 0,
      responsibleConsultant: resolvedConsultant,
      // "Müşteri Sahibi" segment was removed — `owner` now always mirrors the responsible
      // consultant, which is what ExecutiveDashboard/OpexProjectDashboard already read `.owner` as.
      owner: resolvedConsultant,
      milestone: (act as any).milestone || false,
      dependencies: (act as any).dependencies || [],
      relatedModule: (act as any).relatedModule || "",
      linkedItemId: (act as any).linkedItemId || "",
      parallelWith: (act as any).parallelWith || "",
      parentActivityId: (act as any).parentActivityId || "",
      phase: (act as any).phase || "",
      manualActualOverride: (act as any).manualActualOverride || false
    };
  }).sort((a, b) => (parseInt(a.activityNo, 10) || 0) - (parseInt(b.activityNo, 10) || 0));

  // Faz No (phase) options: F1, F2, F3... year 1 starts with 3 phases available; once an activity
  // uses the last available phase (e.g. F4), F5 automatically becomes selectable too — the list is
  // always "highest phase used so far, plus one", never capped, never requiring a manual add step.
  const maxPhaseUsed = upgradedActivities.reduce((max, a) => {
    const m = /^F(\d+)$/.exec((a as any).phase || "");
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  const availablePhases = Array.from({ length: Math.max(3, maxPhaseUsed + 1) }, (_, i) => `F${i + 1}`);
  const defaultPhase = maxPhaseUsed > 0 ? `F${maxPhaseUsed}` : "F1";

  // Schedule Deviation calculation
  const devStats = useMemo(() => {
    let totalDeviatedTasks = 0;
    let maxDelayWeeks = 0;
    let totalDelayWeeks = 0;

    upgradedActivities.forEach(act => {
      const maxActual = act.actualWeeks && act.actualWeeks.length > 0 ? Math.max(...act.actualWeeks) : act.actualFinishWeek;
      const diff = maxActual - act.plannedFinishWeek;
      if (diff > 0) {
        totalDeviatedTasks++;
        totalDelayWeeks += diff;
        if (diff > maxDelayWeeks) maxDelayWeeks = diff;
      }
    });

    return { totalDeviatedTasks, maxDelayWeeks, totalDelayWeeks };
  }, [upgradedActivities]);

  // Calculate KPIs
  // Activities flagged as "Paralel Faaliyet" (running at the same time as another activity, e.g.
  // two consultants working simultaneously) don't add their man-days again to the project total —
  // that capacity was already counted on the activity they run parallel to.
  const totalPlannedManDays = upgradedActivities.reduce((acc, a) => acc + (a.parallelWith ? 0 : (a.plannedManDays || 0)), 0);
  // Consumed effort is sourced entirely from Proje Takip Raporu (synced onto each activity's consumedManDays), never entered directly here.
  const consumedManDays = upgradedActivities.reduce((acc, a) => acc + (a.consumedManDays || 0), 0);
  const remainingManDays = Math.max(0, totalPlannedManDays - consumedManDays);
  
  // Consulting Package calculations
  const totalContractWeeks = totalWeeks;
  const totalConsultingCapacity = totalContractWeeks * weeklyCapacity;
  const unusedCapacity = Math.max(0, totalConsultingCapacity - consumedManDays);
  const capacityOverrun = consumedManDays > totalConsultingCapacity;

  // Status counts
  const totalActivities = upgradedActivities.length;
  const completedActivities = upgradedActivities.filter(a => a.status === "Completed").length;
  const inProgressActivities = upgradedActivities.filter(a => a.status === "In Progress").length;
  const openActivities = upgradedActivities.filter(a => a.status === "Planned").length;
  const delayedActivities = upgradedActivities.filter(a => a.status === "Delayed").length;

  const projectProgressPercent = totalActivities > 0 
    ? Math.round(upgradedActivities.reduce((acc, a) => acc + a.progressPercent, 0) / totalActivities)
    : 0;

  // Completion forecast & Health
  const projectHealth = delayedActivities > 0 ? "Yellow" : completedActivities > 0.5 * totalActivities ? "Green" : "Green";
  const projectCompletionForecast = projectProgressPercent === 100 ? "Tamamlandı" : `Hafta ${endWeek + (delayedActivities > 0 ? 2 : 0)}`;

  const kpis = {
    progress: projectProgressPercent,
    completed: completedActivities,
    inProgress: inProgressActivities,
    open: openActivities,
    delayed: delayedActivities,
    total: totalActivities,
    totalPlannedManDays,
    consumedManDays,
    remainingManDays,
    forecast: projectCompletionForecast,
    health: projectHealth
  };

  // 5. Automatic Integration Sync logic
  useEffect(() => {
    let changed = false;
    const syncedList = upgradedActivities.map(act => {
      if (!act.relatedModule || !act.linkedItemId) return act;
      
      let targetCompleted = false;
      let targetProgress = act.progressPercent;

      if (act.relatedModule === "5S Audits") {
        // audits5S now holds 5S Audit headers (1-5 scale, only scored once "Tamamlandı") rather
        // than the old per-area 0-100% record — convert to a percentage for the same progress sync.
        const audit = audits5S.find(a => a.id === act.linkedItemId);
        if (audit) {
          targetProgress = Math.round(((audit.overallScore || 0) / 5) * 100);
          targetCompleted = audit.status === "Tamamlandı" && targetProgress >= 80;
        }
      } else if (act.relatedModule === "Kaizen Projects") {
        const kaizen = kaizens.find(k => k.id === act.linkedItemId);
        if (kaizen) {
          targetCompleted = kaizen.status === "Completed";
          targetProgress = targetCompleted ? 100 : kaizen.status === "In Progress" ? 50 : 10;
        }
      } else if (act.relatedModule === "OEE Improvement" || act.relatedModule === "Capacity Analysis") {
        const proc = processes.find(p => p.id === act.linkedItemId);
        if (proc) {
          targetProgress = Math.round(proc.oee || 0);
          targetCompleted = targetProgress >= 85;
        }
      }

      const updatedStatus = targetCompleted ? "Completed" : act.progressPercent > 0 ? "In Progress" : "Planned";
      
      if (act.progressPercent !== targetProgress || act.status !== updatedStatus) {
        changed = true;
        return {
          ...act,
          progressPercent: targetProgress,
          status: updatedStatus
        };
      }
      return act;
    });

    if (changed) {
      syncedList.forEach(act => {
        const original = currentActivities.find(o => o.id === act.id);
        if (original && (original.progressPercent !== act.progressPercent || original.status !== act.status)) {
          onUpdateActivityLocal(act);
        }
      });
    }
  }, [kaizens, audits5S, processes]);

  // Handle Save (Add Activity)
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    const newActNo = String(currentActivities.length + 1).padStart(2, "0");
    const newAct: any = {
      id: "act_" + Math.random().toString(36).substring(2, 9),
      name: formName,
      owner: formConsultant,
      startDate: "2026-06", // Compatibility fallback
      endDate: "2026-08",
      progressPercent: Number(formProgress),
      priority: formPriority,
      status: formStatus,
      notes: formNotes,

      // Extended fields
      activityNo: newActNo,
      category: formCategory,
      phase: formPhase,
      plannedStartWeek: Number(formPlannedStartWeek),
      plannedFinishWeek: Number(formPlannedFinishWeek),
      actualStartWeek: Number(formActualStartWeek),
      actualFinishWeek: Number(formActualFinishWeek),
      plannedManDays: Number(formPlannedManDays),
      consumedManDays: 0,
      responsibleConsultant: formConsultant,
      milestone: formMilestone,
      dependencies: formDependencies ? formDependencies.split(",").map(d => d.trim()) : [],
      relatedModule: formRelatedModule,
      linkedItemId: formLinkedItemId,
      parallelWith: formParallelWith.trim(),
      parentActivityId: pendingParentActivityId || ""
    };

    onAddActivityLocal(newAct);
    if (pendingParentActivityId) {
      setCollapsedParents(prev => {
        const next = new Set(prev);
        next.delete(pendingParentActivityId);
        return next;
      });
    }
    setIsAdding(false);
    resetForm();
  };

  // Handle Edit Save
  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity || !formName) return;

    const actualStartWeekNum = Number(formActualStartWeek);
    const actualFinishWeekNum = Number(formActualFinishWeek);
    // Only treat this as a manual override if the user actually changed the "Gerçekleşen Dönem"
    // fields from what was showing (the PTR-resolved values) — otherwise every unrelated edit
    // (priority, notes, etc.) would silently lock in whatever actual dates happened to be
    // displayed at open-time and permanently disable PTR auto-sync for that activity.
    const actualDatesChanged = actualStartWeekNum !== editingActivity.actualStartWeek || actualFinishWeekNum !== editingActivity.actualFinishWeek;

    const updatedAct = {
      ...editingActivity,
      name: formName,
      owner: formConsultant,
      progressPercent: Number(formProgress),
      priority: formPriority,
      status: formStatus,
      notes: formNotes,
      category: formCategory,
      phase: formPhase,
      plannedStartWeek: Number(formPlannedStartWeek),
      plannedFinishWeek: Number(formPlannedFinishWeek),
      actualStartWeek: actualStartWeekNum,
      actualFinishWeek: actualFinishWeekNum,
      plannedManDays: Number(formPlannedManDays),
      responsibleConsultant: formConsultant,
      milestone: formMilestone,
      dependencies: formDependencies ? formDependencies.split(",").map(d => d.trim()) : [],
      relatedModule: formRelatedModule,
      linkedItemId: formLinkedItemId,
      parallelWith: formParallelWith.trim(),
      ...(actualDatesChanged ? {
        manualActualOverride: true,
        actualWeeks: Array.from({ length: Math.max(0, actualFinishWeekNum - actualStartWeekNum + 1) }, (_, i) => actualStartWeekNum + i)
      } : {})
    };

    onUpdateActivityLocal(updatedAct);
    setEditingActivity(null);
    resetForm();
  };

  const openEditModal = (act: any) => {
    setEditingActivity(act);
    setFormName(act.name);
    setFormCategory(act.category || "Kaizen");
    setFormPhase(act.phase || "F1");
    setFormPriority(act.priority);
    setFormStatus(act.status);
    setFormProgress(act.progressPercent);
    setFormNotes(act.notes || "");
    setFormPlannedStartWeek(act.plannedStartWeek || 24);
    setFormPlannedFinishWeek(act.plannedFinishWeek || 28);
    setFormActualStartWeek(act.actualStartWeek || act.plannedStartWeek || 24);
    setFormActualFinishWeek(act.actualFinishWeek || act.plannedFinishWeek || 28);
    setFormPlannedManDays(act.plannedManDays ?? 5);
    setFormConsultant(act.responsibleConsultant || "Ahmet Yılmaz");
    setFormMilestone(act.milestone || false);
    setFormDependencies(act.dependencies ? act.dependencies.join(", ") : "");
    setFormRelatedModule(act.relatedModule || "");
    setFormLinkedItemId(act.linkedItemId || "");
    setFormParallelWith(act.parallelWith || "");
  };

  const openAddSubActivityModal = (parentId: string) => {
    resetForm();
    setPendingParentActivityId(parentId);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormName("");
    setFormNotes("");
    setFormProgress(0);
    setFormDependencies("");
    setFormRelatedModule("");
    setFormLinkedItemId("");
    setFormParallelWith("");
    setPendingParentActivityId("");
    // New activities default to the phase already in progress (the highest phase used so far),
    // not always back to F1 — keeps consecutive adds in the same phase unless bumped manually.
    setFormPhase(defaultPhase);
  };

  // Reorder activities. Operates on `filteredActivities` (the list actually rendered, and the
  // source of the `idx` the Up/Down buttons pass in) rather than the unfiltered `upgradedActivities`
  // — using the unfiltered list here would move/renumber the wrong activity whenever a filter is
  // active, since the two lists' indices don't line up.
  const handleMoveActivity = (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= filteredActivities.length) return;

    const listCopy = [...filteredActivities];
    const item = listCopy[index];
    listCopy.splice(index, 1);
    listCopy.splice(nextIndex, 0, item);

    // Re-index activity numbers and save all. Activities are always displayed sorted by
    // activityNo (see upgradedActivities' .sort() above), so renumbering here is what actually
    // moves the row on screen — the row follows its number, not the other way around.
    listCopy.forEach((act, idx) => {
      onUpdateActivityLocal({
        ...act,
        activityNo: String(idx + 1).padStart(2, "0")
      });
    });
  };

  // Mouse drag-to-reorder via the Sıra No badge (native HTML5 drag-and-drop — no extra
  // dependency), alongside the Up/Down buttons above. Same renumber-and-save logic as
  // handleMoveActivity, just for an arbitrary distance instead of a single adjacent swap.
  const [draggingActivityId, setDraggingActivityId] = useState<string | null>(null);
  const [dragOverActivityId, setDragOverActivityId] = useState<string | null>(null);

  const handleReorderActivity = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const listCopy = [...filteredActivities];
    const fromIdx = listCopy.findIndex(a => a.id === draggedId);
    const toIdx = listCopy.findIndex(a => a.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [item] = listCopy.splice(fromIdx, 1);
    listCopy.splice(toIdx, 0, item);
    listCopy.forEach((act, idx) => {
      onUpdateActivityLocal({
        ...act,
        activityNo: String(idx + 1).padStart(2, "0")
      });
    });
  };

  // Precise week shifting arrows
  const handleShiftWeek = (act: any, type: 'planned' | 'actual', edge: 'start' | 'finish', amount: number) => {
    const updated = { ...act };
    if (type === 'planned') {
      if (edge === 'start') {
        const val = Math.min(updated.plannedFinishWeek - 1, Math.max(1, updated.plannedStartWeek + amount));
        updated.plannedStartWeek = val;
      } else {
        const val = Math.max(updated.plannedStartWeek + 1, Math.min(52, updated.plannedFinishWeek + amount));
        updated.plannedFinishWeek = val;
      }
    } else {
      if (edge === 'start') {
        const val = Math.min(updated.actualFinishWeek - 1, Math.max(1, updated.actualStartWeek + amount));
        updated.actualStartWeek = val;
      } else {
        const val = Math.max(updated.actualStartWeek + 1, Math.min(52, updated.actualFinishWeek + amount));
        updated.actualFinishWeek = val;
      }
      // Manual shift wins from now on for this activity — rebuild actualWeeks as a plain
      // contiguous range and stop auto-merging PTR-derived weeks (see manualActualOverride in the
      // upgrade step above), otherwise the very next render silently pulls the range back to
      // whatever PTR visit weeks were previously matched, undoing the shift.
      updated.manualActualOverride = true;
      updated.actualWeeks = Array.from(
        { length: Math.max(0, updated.actualFinishWeek - updated.actualStartWeek + 1) },
        (_, i) => updated.actualStartWeek + i
      );
    }
    onUpdateActivityLocal(updated);
  };

  // Drag-to-move / drag-to-resize for the Plan and Actual bars. Mutable drag session state lives
  // in a ref (not React state) so every mousemove reads/writes it synchronously without waiting on
  // a render; `dragPreview` (state) exists purely to repaint the bar at its live position while
  // dragging. The commit (persisting to the server) only happens once, on mouseup.
  const dragRef = useRef<{
    actId: string;
    type: 'planned' | 'actual';
    mode: 'move' | 'resize-start' | 'resize-end';
    startClientX: number;
    pxPerWeek: number;
    origStart: number;
    origFinish: number;
    liveStart: number;
    liveFinish: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ actId: string; type: 'planned' | 'actual'; start: number; finish: number } | null>(null);

  const onBarDragMove = (e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const deltaWeeks = Math.round((e.clientX - d.startClientX) / d.pxPerWeek);
    let newStart = d.origStart;
    let newFinish = d.origFinish;
    if (d.mode === 'move') {
      const duration = d.origFinish - d.origStart;
      newStart = Math.max(1, Math.min(52 - duration, d.origStart + deltaWeeks));
      newFinish = newStart + duration;
    } else if (d.mode === 'resize-start') {
      newStart = Math.max(1, Math.min(d.origFinish - 1, d.origStart + deltaWeeks));
    } else {
      newFinish = Math.min(52, Math.max(d.origStart + 1, d.origFinish + deltaWeeks));
    }
    if (newStart === d.liveStart && newFinish === d.liveFinish) return;
    d.liveStart = newStart;
    d.liveFinish = newFinish;
    setDragPreview({ actId: d.actId, type: d.type, start: newStart, finish: newFinish });
  };

  const onBarDragEnd = () => {
    const d = dragRef.current;
    window.removeEventListener('mousemove', onBarDragMove);
    window.removeEventListener('mouseup', onBarDragEnd);
    if (d) {
      const currentAct = filteredActivities.find(a => a.id === d.actId);
      if (currentAct && (d.liveStart !== d.origStart || d.liveFinish !== d.origFinish)) {
        const updated = { ...currentAct };
        if (d.type === 'planned') {
          updated.plannedStartWeek = d.liveStart;
          updated.plannedFinishWeek = d.liveFinish;
        } else {
          updated.actualStartWeek = d.liveStart;
          updated.actualFinishWeek = d.liveFinish;
          // Same manual-override rule as handleShiftWeek — a drag is an explicit manual edit and
          // must win over PTR auto-sync from now on, or the next render silently snaps it back.
          updated.manualActualOverride = true;
          updated.actualWeeks = Array.from({ length: d.liveFinish - d.liveStart + 1 }, (_, i) => d.liveStart + i);
        }
        onUpdateActivityLocal(updated);
      }
    }
    dragRef.current = null;
    setDragPreview(null);
  };

  const beginBarDrag = (e: React.MouseEvent, act: any, type: 'planned' | 'actual', mode: 'move' | 'resize-start' | 'resize-end') => {
    if (e.button !== 0) return; // left click only
    e.preventDefault();
    e.stopPropagation();
    const track = (e.currentTarget as HTMLElement).closest('[data-week-track]') as HTMLElement | null;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pxPerWeek = rect.width / totalWeeks || 1;
    const origStart = type === 'planned' ? act.plannedStartWeek : act.actualStartWeek;
    const origFinish = type === 'planned' ? act.plannedFinishWeek : act.actualFinishWeek;
    dragRef.current = { actId: act.id, type, mode, startClientX: e.clientX, pxPerWeek, origStart, origFinish, liveStart: origStart, liveFinish: origFinish };
    window.addEventListener('mousemove', onBarDragMove);
    window.addEventListener('mouseup', onBarDragEnd);
  };

  // Filter logic. `upgradedActivities` is already sorted by activityNo, so `.filter()` (which
  // preserves relative order) keeps that ordering. Sub-activities are then pulled to sit directly
  // under their parent regardless of their own activityNo, so the "alt ›" collapse toggle always
  // shows a contiguous block instead of children scattered wherever their own number landed.
  const filteredActivities = (() => {
    const base = upgradedActivities.filter(act => {
      if (filterConsultant && act.responsibleConsultant !== filterConsultant) return false;
      if (filterCategory && act.category !== filterCategory) return false;
      if (filterPriority && act.priority !== filterPriority) return false;
      if (filterStatus && act.status !== filterStatus) return false;
      return true;
    });
    const childrenByParent: Record<string, any[]> = {};
    const roots: any[] = [];
    base.forEach(act => {
      const pid = (act as any).parentActivityId;
      if (pid) {
        if (!childrenByParent[pid]) childrenByParent[pid] = [];
        childrenByParent[pid].push(act);
      } else {
        roots.push(act);
      }
    });
    const ordered: any[] = [];
    roots.forEach(r => {
      ordered.push(r);
      (childrenByParent[r.id] || []).forEach(c => ordered.push(c));
    });
    // Orphans: a sub-activity whose parent got filtered out or deleted still needs to be shown.
    const includedIds = new Set(ordered.map(a => a.id));
    base.forEach(act => { if (!includedIds.has(act.id)) ordered.push(act); });
    return ordered;
  })();

  // Extract unique consultants & categories for filter options
  const uniqueConsultants = Array.from(new Set(upgradedActivities.map(a => a.responsibleConsultant)));
  const uniqueCategories = Array.from(new Set(upgradedActivities.map(a => a.category)));

  // Alt Faaliyet (sub-activity) hierarchy: how many children a given parent has, so its row can
  // show the "alt ›" / "‹" toggle only when it actually has sub-activities.
  const childCountByParent = useMemo(() => {
    const m: Record<string, number> = {};
    upgradedActivities.forEach(a => {
      const pid = (a as any).parentActivityId;
      if (pid) m[pid] = (m[pid] || 0) + 1;
    });
    return m;
  }, [upgradedActivities]);

  const toggleParentCollapsed = (parentId: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  // A sub-activity row is hidden while its parent is collapsed.
  const isRowHidden = (act: any) => !!act.parentActivityId && collapsedParents.has(act.parentActivityId);

  // Excel Gantt Export with actual visual 2-line stacked Gantt chart representation in grid cells
  // Real visual Gantt chart export — bordered week-grid cells with fill colors for planned vs
  // actual weeks (the previous version used plain text glyphs like "█ PLAN █" because the `xlsx`
  // (SheetJS community) package cannot write cell borders/fills at all; ExcelJS supports both).
  const handleExportXlsx = async () => {
    const INFO_COLS = 13; // No..Sapma, before the "Tür" column
    const TYPE_COL = INFO_COLS + 1;
    const FIRST_WEEK_COL = TYPE_COL + 1;
    const totalCols = FIRST_WEEK_COL + (endWeek - startWeek);

    const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFB0B7C3" } };
    const CELL_BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
    const PLAN_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF60A5FA" } };
    const ACTUAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF34D399" } };
    const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };

    const wb = new ExcelJS.Workbook();
    wb.creator = "Gemba Tools";
    wb.created = new Date();
    const ws = wb.addWorksheet("Master Plan Gantt", { views: [{ state: "frozen", xSplit: 2, ySplit: 9 }] });

    const titleRow = ws.addRow(["GEMBA PARTNER - YALIN PROJE MASTER PLAN GANTT ŞEMASI"]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FF1E293B" } };

    ws.addRow(["Müşteri", activeCustomerName]);
    ws.addRow(["Rapor Oluşturma Tarihi", new Date().toLocaleDateString("tr-TR")]);
    ws.addRow(["Proje Genel İlerleme Oranı", `%${kpis.progress}`]);
    ws.addRow(["Faaliyet Özeti", `Toplam: ${kpis.total} | Tamamlanan: ${kpis.completed} | Yürütülen: ${kpis.inProgress} | Geciken: ${kpis.delayed}`]);
    ws.addRow(["Sapma Özeti", `${devStats.totalDeviatedTasks} Faaliyet Plana Göre Sapmalı (Maks Sapma: +${devStats.maxDelayWeeks} Hafta)`]);
    const legendRow = ws.addRow(["Gantt Göstergesi", "Mavi hücre = Planlanan hafta  |  Yeşil hücre = Fiili gerçekleşen hafta"]);
    legendRow.getCell(2).font = { italic: true, color: { argb: "FF64748B" } };
    ws.addRow([]);

    // Column Headers
    const headers = [
      "No", "Yalın Faaliyet / Proje Adı", "Kategori", "Sorumlu Danışman",
      "Öncelik", "Durum", "İlerleme", "Adam-Gün", "Plan Başlangıç", "Plan Bitiş",
      "Gerçekleşen Başlangıç", "Gerçekleşen Bitiş", "Plan/Gerçek Sapması", "Tür"
    ];
    for (let w = startWeek; w <= endWeek; w++) headers.push(`H${w}`);
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cell.fill = HEADER_FILL;
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    ws.getRow(headerRow.number).height = 28;

    // Populate rows (2 rows per activity: Plan row & Actual row, forming a real stacked Gantt block)
    filteredActivities.forEach((act) => {
      const maxActual = act.actualWeeks && act.actualWeeks.length > 0 ? Math.max(...act.actualWeeks) : act.actualFinishWeek;
      const dev = maxActual - act.plannedFinishWeek;
      const devStr = dev > 0 ? `+${dev} Hafta Sapma` : dev < 0 ? `${Math.abs(dev)} Hafta Erken` : "Plana Tam Uygun";

      const planRow = ws.addRow([
        act.activityNo, act.name, act.category, act.responsibleConsultant,
        act.priority, act.status, `%${act.progressPercent}`, act.plannedManDays,
        `W${act.plannedStartWeek}`, `W${act.plannedFinishWeek}`, `W${act.actualStartWeek}`, `W${act.actualFinishWeek}`,
        devStr, "PLANLANAN"
      ]);
      planRow.eachCell((cell, colNumber) => {
        cell.border = CELL_BORDER;
        cell.font = { size: 9 };
        if (colNumber === TYPE_COL) cell.font = { size: 9, bold: true, color: { argb: "FF2563EB" } };
        if (colNumber === INFO_COLS && dev > 0) cell.font = { size: 9, bold: true, color: { argb: "FFDC2626" } };
      });
      for (let w = startWeek; w <= endWeek; w++) {
        const cell = planRow.getCell(FIRST_WEEK_COL + (w - startWeek));
        cell.border = CELL_BORDER;
        if (w >= act.plannedStartWeek && w <= act.plannedFinishWeek) cell.fill = PLAN_FILL;
      }

      const actWeeksList = act.actualWeeks && act.actualWeeks.length > 0
        ? act.actualWeeks
        : Array.from({ length: Math.max(0, act.actualFinishWeek - act.actualStartWeek + 1) }, (_, i) => act.actualStartWeek + i);

      const actualRow = ws.addRow([
        "", act.name, act.category, "", "", "", "", act.consumedManDays || 0,
        "", "", `W${act.actualStartWeek}`, `W${act.actualFinishWeek}`, "", "GERÇEKLEŞEN"
      ]);
      actualRow.eachCell((cell, colNumber) => {
        cell.border = { ...CELL_BORDER, bottom: { style: "medium", color: { argb: "FF475569" } } };
        cell.font = { size: 9 };
        if (colNumber === TYPE_COL) cell.font = { size: 9, bold: true, color: { argb: "FF059669" } };
      });
      for (let w = startWeek; w <= endWeek; w++) {
        const cell = actualRow.getCell(FIRST_WEEK_COL + (w - startWeek));
        cell.border = { ...CELL_BORDER, bottom: { style: "medium", color: { argb: "FF475569" } } };
        if (actWeeksList.includes(w)) cell.fill = ACTUAL_FILL;
      }
    });

    // Column widths
    const widths = [6, 38, 16, 18, 10, 12, 10, 10, 12, 12, 16, 16, 18, 12];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    for (let w = startWeek; w <= endWeek; w++) ws.getColumn(FIRST_WEEK_COL + (w - startWeek)).width = 5;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `proje_master_plan_gantt_sema_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Excel Activities Import Parser
  const handleImportXlsx = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const ws = workbook.Sheets[sheetName];

        // The Gantt export (and any hand-made template with a title/notes block above the table)
        // doesn't have its real column headers on row 1 — sheet_to_json defaults to treating row 1
        // as the header, so every row silently failed to match any known column and "0 faaliyet
        // aktarıldı" was shown even for a well-formed file. Scan the first 20 rows for the one that
        // actually contains a recognizable "activity name" header, and parse from there.
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const nameHeaderCandidates = ["Yalın Faaliyet / Proje Adı", "Aktivite Adı", "Faaliyet Adı", "Aktivite", "Faaliyet", "Name", "Activity"];
        let headerRowIndex = rawRows.findIndex((r, i) => i < 20 && Array.isArray(r) && r.some(cell => nameHeaderCandidates.includes(String(cell ?? "").trim())));
        if (headerRowIndex === -1) headerRowIndex = 0;

        const rows = XLSX.utils.sheet_to_json<any>(ws, { range: headerRowIndex });

        if (rows.length === 0) {
          alert("Excel dosyasında faaliyet bulunamadı.");
          return;
        }

        // Helper: pulls a week number out of either a plain number or the exported "W24" text format.
        const parseWeek = (v: any): number | undefined => {
          if (v === undefined || v === null || v === "") return undefined;
          const m = /(\d+)/.exec(String(v));
          return m ? parseInt(m[1], 10) : undefined;
        };

        let importedCount = 0;
        rows.forEach((row) => {
          // The Gantt export writes two rows per activity (Plan + Actual, marked by "Tür") — only
          // the Plan row carries the full activity data, so the Actual row must be skipped, not
          // imported as a second (empty) activity.
          if (row["Tür"] === "GERÇEKLEŞEN") return;

          // Check Turkish/English column aliases
          const name = row["Yalın Faaliyet / Proje Adı"] || row["Aktivite Adı"] || row["Faaliyet Adı"] || row["Aktivite"] || row["Faaliyet"] || row["Name"] || row["Activity"];
          if (!name) return; // Skip invalid rows

          const category = row["Kategori"] || row["Yalın Sınıfı"] || row["Yalın Modül"] || row["Category"] || "Kaizen";
          const phase = row["Faz No"] || row["Faz"] || row["Phase"] || "";
          const consultant = row["Sorumlu Danışman"] || row["Danışman"] || row["Sorumlu"] || row["Consultant"] || "Ahmet Yılmaz";
          const priority = row["Öncelik"] || row["Priority"] || "Medium";

          let progressPercent = 0;
          const progVal = row["İlerleme"] || row["Progress"] || row["Tamamlanma Oranı"] || row["Tamamlanma"];
          if (progVal !== undefined) {
            if (typeof progVal === "string") {
              progressPercent = parseInt(progVal.replace("%", ""), 10) || 0;
            } else if (typeof progVal === "number") {
              progressPercent = progVal <= 1 ? Math.round(progVal * 100) : progVal;
            }
          }

          // `??` (not `||`) so an intentionally-entered 0 (e.g. Adam-Gün) survives the import.
          const rawManDays = row["Planlanan Adam-Gün"] ?? row["Planlanan Gün"] ?? row["Adam-Gün"] ?? row["Man Days"] ?? row["Planned Man Days"];
          const plannedManDays = rawManDays === undefined || rawManDays === "" ? 5 : Number(rawManDays);
          const plannedStartWeek = parseWeek(row["Plan Başlangıç (Hafta)"] ?? row["Planlanan Başlangıç"] ?? row["Başlangıç Haftası"] ?? row["Start Week"] ?? row["Planned Start Week"] ?? row["Plan Başlangıç"]) ?? 24;
          const plannedFinishWeek = parseWeek(row["Plan Bitiş (Hafta)"] ?? row["Planlanan Bitiş"] ?? row["Bitiş Haftası"] ?? row["Finish Week"] ?? row["Planned Finish Week"] ?? row["Plan Bitiş"]) ?? 28;

          const actualStartWeek = parseWeek(row["Gerçekleşen Başlangıç (Hafta)"] ?? row["Gerçekleşen Başlangıç"] ?? row["Actual Start Week"] ?? row["Actual Start"]) ?? plannedStartWeek;
          const actualFinishWeek = parseWeek(row["Gerçekleşen Bitiş (Hafta)"] ?? row["Gerçekleşen Bitiş"] ?? row["Actual Finish Week"] ?? row["Actual Finish"]) ?? plannedFinishWeek;

          const statusVal = row["Durum"] || row["Status"];
          let status = "Planned";
          if (statusVal) {
            status = statusVal;
          } else {
            status = progressPercent === 100 ? "Completed" : progressPercent > 0 ? "In Progress" : "Planned";
          }

          const notes = row["Notlar"] || row["Açıklama"] || row["Notes"] || "";

          const newAct: any = {
            id: "act_" + Math.random().toString(36).substring(2, 9),
            name,
            owner: consultant,
            startDate: "2026-06",
            endDate: "2026-08",
            progressPercent,
            priority,
            status,
            notes,
            activityNo: String(activities.length + importedCount + 1).padStart(2, "0"),
            category,
            plannedStartWeek,
            plannedFinishWeek,
            actualStartWeek,
            actualFinishWeek,
            plannedManDays,
            consumedManDays: 0,
            responsibleConsultant: consultant,
            milestone: false,
            dependencies: [],
            relatedModule: "",
            linkedItemId: "",
            parallelWith: "",
            parentActivityId: "",
            phase
          };

          onAddActivityLocal(newAct);
          importedCount++;
        });

        alert(`${importedCount} adet faaliyet başarıyla içe aktarıldı!`);
      } catch (err: any) {
        console.error("Excel import failed:", err);
        alert(`Excel dosyası ayrıştırılırken bir hata oluştu: ${err?.message || err}`);
      }
    };
    reader.onerror = () => alert("Excel dosyası okunamadı (dosya bozuk olabilir).");
    reader.readAsArrayBuffer(file);
  };

  // Simple Markdown Renderer
  const renderMarkdownText = (text: string) => {
    return text.split("\n").map((line, idx) => {
      if (line.startsWith("### ")) {
        return <h3 key={idx} className="text-xs font-bold text-gray-900 mt-4 mb-2 flex items-center border-b pb-1 font-sans">{line.replace("### ", "")}</h3>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={idx} className="text-sm font-bold text-gray-900 mt-5 mb-2 flex items-center font-sans">{line.replace("## ", "")}</h2>;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const clean = line.substring(2);
        return <li key={idx} className="text-[11px] text-gray-700 ml-4 list-disc my-1 leading-relaxed">{clean}</li>;
      }
      if (line.trim() === "") {
        return <div key={idx} className="h-1" />;
      }
      return <p key={idx} className="text-[11px] text-gray-700 leading-relaxed my-1 font-sans">{line}</p>;
    });
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* TOP NAVIGATION TABS (PROJE MASTER PLANI / PROJE PLANI) */}
      <div className="flex border-b border-gray-200 items-center justify-between flex-wrap gap-2">
        <div className="flex items-center overflow-x-auto scrollbar-none">
          <button
            onClick={() => setCurrentTopTab("master")}
            className={`py-2 px-4 text-xs font-bold transition-all border-b-2 -mb-[2px] cursor-pointer flex items-center space-x-1.5 whitespace-nowrap ${
              currentTopTab === "master"
                ? "border-emerald-600 text-emerald-600 font-extrabold"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Proje Master Planı</span>
          </button>

          {/* Dynamic custom project plans tabs */}
          {activePlans.map((plan) => {
            const isActive = currentTopTab === plan.id;
            return (
              <div 
                key={plan.id} 
                className={`flex items-center border-b-2 -mb-[2px] transition-all whitespace-nowrap ${
                  isActive 
                    ? "border-emerald-600 text-emerald-600 font-extrabold" 
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setCurrentTopTab(plan.id)}
                  className={`py-2 pl-4 pr-2 text-xs font-bold cursor-pointer flex items-center space-x-1.5 transition-all ${
                    isActive ? "text-emerald-600 font-extrabold" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{plan.name}</span>
                </button>
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setPlanToDelete(plan);
                  }}
                  className="py-1 px-2.5 mr-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full cursor-pointer transition-colors flex items-center justify-center"
                  title="Proje Planını Sil"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Create Project Plan Link/Button */}
        <button
          onClick={handleCreateProjectPlan}
          className="py-1 px-3 text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center space-x-1 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer mr-2 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Proje Planı Oluştur</span>
        </button>
      </div>

      {/* 1. TOP SUMMARY DASHBOARD */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Proje İlerlemesi */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all flex justify-between items-start min-h-[110px]">
          <div className="space-y-1 flex-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Proje İlerlemesi</span>
            <span className="text-2xl font-extrabold font-mono text-gray-900 block">%{kpis.progress}</span>
            <div className="w-full bg-gray-150 h-1.5 rounded-full overflow-hidden mt-2">
              <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${kpis.progress}%` }}></div>
            </div>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 ml-1.5 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
        </div>

        {/* Faaliyet Özeti */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all flex justify-between items-start min-h-[110px]">
          <div className="space-y-1 flex-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Faaliyet Özeti</span>
            <div className="flex items-baseline space-x-1 mt-1 text-gray-900 font-bold">
              <span className="text-2xl font-mono">{kpis.completed}</span>
              <span className="text-xs text-gray-400">/ {kpis.total} Bitti</span>
            </div>
            <span className="text-[10px] text-gray-500 block font-medium mt-1">
              {kpis.inProgress} Süratlenen • {kpis.open} Açık
            </span>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 ml-1.5 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Plan vs Gerçekleşen Sapma */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all flex justify-between items-start min-h-[110px]">
          <div className="space-y-1 flex-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Plan/Gerçekleşen Sapma</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className={`text-2xl font-mono font-bold ${devStats.totalDeviatedTasks > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {devStats.maxDelayWeeks > 0 ? `+${devStats.maxDelayWeeks} Hafta` : "0 Hafta"}
              </span>
            </div>
            <span className={`text-[10px] block font-bold uppercase mt-1 ${devStats.totalDeviatedTasks > 0 ? "text-red-500" : "text-emerald-600"}`}>
              {devStats.totalDeviatedTasks > 0 ? `${devStats.totalDeviatedTasks} Görevde Sapma` : "Plana Tam Uygun"}
            </span>
          </div>
          <div className={`p-2 rounded-lg ml-1.5 shrink-0 ${devStats.totalDeviatedTasks > 0 ? "bg-red-50 text-red-600 animate-pulse" : "bg-emerald-50 text-emerald-600"}`}>
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        {/* Geciken Görev */}
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all flex justify-between items-start min-h-[110px]">
          <div className="space-y-1 flex-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Geciken Görev</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className={`text-2xl font-mono font-bold ${kpis.delayed > 0 ? "text-red-600" : "text-gray-900"}`}>{kpis.delayed}</span>
              <span className="text-[10px] font-bold text-gray-450 uppercase ml-1">Görev</span>
            </div>
            <span className={`text-[10px] block font-bold uppercase mt-1 ${kpis.delayed > 0 ? "text-red-500" : "text-emerald-500"}`}>
              {kpis.delayed > 0 ? "Gecikme Var" : "Gecikme Yok"}
            </span>
          </div>
          <div className={`p-2 rounded-lg ml-1.5 shrink-0 ${kpis.delayed > 0 ? "bg-red-50 text-red-600 animate-pulse" : "bg-gray-50 text-gray-450"}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Tüketilen Efor */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex justify-between items-start min-h-[110px]">
          <div className="space-y-1 flex-1">
            <span className="text-[11px] uppercase font-bold tracking-wider text-gray-400 block">Tüketilen Efor</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-2xl font-mono font-bold text-gray-900">{kpis.consumedManDays}</span>
              <span className="text-[10px] text-gray-500 font-medium ml-1">/ {kpis.totalPlannedManDays} Gün</span>
            </div>
            <span className="text-[10px] text-gray-500 block font-medium mt-1">
              Kalan: {kpis.remainingManDays} Adam-Gün
            </span>
          </div>
          <div className="p-2 bg-orange-50 rounded-lg text-orange-600 ml-2 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Proje Sağlığı */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex justify-between items-start min-h-[110px]">
          <div className="space-y-1 flex-1">
            <span className="text-[11px] uppercase font-bold tracking-wider text-gray-400 block">Proje Sağlığı</span>
            <div className="flex items-center space-x-1.5 mt-2">
              <span className={`w-3 h-3 rounded-full ${
                kpis.health === "Green" ? "bg-emerald-500" : kpis.health === "Yellow" ? "bg-amber-500" : "bg-red-500"
              }`}></span>
              <span className="text-xs font-bold text-gray-800">
                {kpis.health === "Green" ? "Stabil" : kpis.health === "Yellow" ? "Riskli" : "Kritik"}
              </span>
            </div>
            <span className="text-[10px] text-gray-500 block font-medium mt-1">
              Öngörü: {kpis.forecast}
            </span>
          </div>
          <div className="p-2 bg-teal-50 rounded-lg text-teal-600 ml-2 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. CONSULTING PACKAGE & EXPORT CONTROLS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Package configuration card */}
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-2 mb-2">
            <h4 className="text-xs font-bold text-gray-800 uppercase flex items-center space-x-2">
              <Settings className="w-4 h-4 text-gray-600" />
              <span>Danışmanlık Kontrat Yönetimi</span>
            </h4>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Haftalık Adam-Gün:</span>
              <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono border border-slate-200">
                {weeklyCapacity} AG / Hafta
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Selection dropdown */}
            <div className="sm:col-span-6">
              <label className="block text-gray-500 font-bold mb-1 text-[10px] uppercase">Haftalık Paket Seçimi</label>
              <select
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg py-1 px-2 text-xs font-medium text-gray-700 focus:ring-2 focus:ring-slate-200 focus:outline-none"
              >
                {packages.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {selectedPackageId === "pkg_custom" && (
              <div className="sm:col-span-6">
                <label className="block text-gray-500 font-bold mb-1 text-[10px] uppercase">Özel Efor Tanımı</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="7"
                    className="w-16 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs font-bold text-gray-800"
                    value={customCapacity}
                    onChange={(e) => setCustomCapacity(Number(e.target.value))}
                  />
                  <span className="text-[10px] text-gray-500 font-medium">Adam-Gün</span>
                </div>
              </div>
            )}
            
            {/* Quick stats inline */}
            <div className={`grid grid-cols-3 gap-2 text-center bg-slate-50/50 p-2 rounded-lg ${selectedPackageId === "pkg_custom" ? "sm:col-span-12" : "sm:col-span-6"}`}>
              <div>
                <span className="text-[11px] text-gray-400 block font-bold uppercase">Sözleşme Kapasitesi</span>
                <span className="text-xs font-extrabold font-mono text-slate-800 mt-0.5 block">{totalConsultingCapacity} AG</span>
              </div>
              <div>
                <span className="text-[11px] text-gray-400 block font-bold uppercase">Kullanılan Adam-Gün</span>
                <span className="text-xs font-extrabold font-mono text-slate-800 mt-0.5 block">{consumedManDays} AG</span>
              </div>
              <div>
                <span className="text-[11px] text-gray-400 block font-bold uppercase">Kalan Adam-Gün</span>
                <span className={`text-xs font-extrabold font-mono mt-0.5 block ${capacityOverrun ? "text-red-600" : "text-emerald-600"}`}>
                  {unusedCapacity} AG
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Reports Export Card */}
        <div className="md:col-span-1 bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
          <div>
            <h4 className="text-xs font-bold text-gray-800 uppercase flex items-center space-x-1.5 border-b border-gray-100 pb-2 mb-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Zaman Planı İşlemleri</span>
            </h4>
            
            <button
              onClick={handleExportXlsx}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer border border-emerald-700 mt-1"
            >
              <Download className="w-4 h-4" />
              <span>Zaman Planı (XLS) İndir</span>
            </button>

            <button
              onClick={() => { setShowAiPanel(true); handleGenerateAiSummary(); }}
              disabled={isAiLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer border border-indigo-700 mt-2"
            >
              <BrainCircuit className={`w-4 h-4 ${isAiLoading ? "animate-pulse" : ""}`} />
              <span>{isAiLoading ? "Analiz Ediliyor..." : "Yapay Zeka Analizi"}</span>
            </button>
          </div>

          <div className="text-[11px] text-gray-400 italic text-right mt-1 pt-1 border-t border-gray-100">
            * Gerçekleşen veriler Proje Takip Raporu'ndan senkronize edilir
          </div>
        </div>

      </div>

      {/* AI INSIGHTS PANEL */}
      {showAiPanel && (
        <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
            <h4 className="text-xs font-bold text-gray-800 uppercase flex items-center space-x-1.5">
              <BrainCircuit className="w-4 h-4 text-indigo-600" />
              <span>Yapay Zeka Proje Analizi</span>
            </h4>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleGenerateAiSummary}
                disabled={isAiLoading}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isAiLoading ? "animate-spin" : ""}`} />
                <span>Yenile</span>
              </button>
              <button
                onClick={() => setShowAiPanel(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {isAiLoading && (
            <div className="text-xs text-gray-500 italic py-4 text-center">Proje verileri analiz ediliyor, lütfen bekleyin...</div>
          )}

          {!isAiLoading && aiError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{aiError}</div>
          )}

          {!isAiLoading && !aiError && aiReport && (
            <div className="max-h-96 overflow-y-auto pr-2">{renderMarkdownText(aiReport)}</div>
          )}

          {!isAiLoading && !aiError && !aiReport && (
            <div className="text-xs text-gray-400 italic py-4 text-center">Analiz sonucu bulunamadı.</div>
          )}
        </div>
      )}

      {/* 3. VIEW TABS & FILTERS BAR */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-xs">
        
        {/* Toggle subtabs */}
        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveView("timeline")}
            className={`flex items-center space-x-1.5 py-1 px-3 text-xs rounded transition-all font-semibold cursor-pointer ${
              activeView === "timeline" ? "bg-emerald-600 text-white shadow-xs" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${activeView === "timeline" ? "text-white" : "text-gray-500"}`} />
            <span>Proje Zaman Çizelgesi</span>
          </button>

          <button
            onClick={() => setActiveView("table")}
            className={`flex items-center space-x-1.5 py-1 px-3 text-xs rounded transition-all font-semibold cursor-pointer ${
              activeView === "table" ? "bg-emerald-600 text-white shadow-xs" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <List className={`w-3.5 h-3.5 ${activeView === "table" ? "text-white" : "text-gray-500"}`} />
            <span>Tablo Esaslı Yönetim</span>
          </button>

          <button
            onClick={() => setActiveView("kanban")}
            className={`flex items-center space-x-1.5 py-1 px-3 text-xs rounded transition-all font-semibold cursor-pointer ${
              activeView === "kanban" ? "bg-emerald-600 text-white shadow-xs" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <KanbanSquare className={`w-3.5 h-3.5 ${activeView === "kanban" ? "text-white" : "text-gray-500"}`} />
            <span>Kanban Panosu</span>
          </button>
        </div>

        {/* Action button to add activities */}
        <div className="flex items-center space-x-2">
          <label 
            className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-750 p-2 rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer"
            title="Excel'den İçe Aktar"
          >
            <Upload className="w-4 h-4 text-gray-500" />
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleImportXlsx}
            />
          </label>
          {isAdding ? null : (
            <button
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Faaliyet Ekle</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER ROW PANEL */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block text-gray-500 font-bold mb-1">Sorumlu Danışman</label>
          <select
            value={filterConsultant}
            onChange={(e) => setFilterConsultant(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs text-gray-700"
          >
            <option value="">Tümü (All)</option>
            {uniqueConsultants.map((c: any) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-500 font-bold mb-1">Yalın Modül</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs text-gray-700"
          >
            <option value="">Tümü (All)</option>
            {uniqueCategories.map((cat: any) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-500 font-bold mb-1">Öncelik Seviyesi</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs text-gray-700"
          >
            <option value="">Tümü (All)</option>
            <option value="High">Yüksek (High)</option>
            <option value="Medium">Orta (Medium)</option>
            <option value="Low">Düşük (Low)</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-500 font-bold mb-1">Durum</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded p-1.5 text-xs text-gray-700"
          >
            <option value="">Tümü (All)</option>
            <option value="Planned">Planned</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Delayed">Delayed</option>
          </select>
        </div>
      </div>

      {/* 4. MAIN VIEWS SWITCH CONTAINER */}

      {/* Immersive Fullscreen Backdrop Overlay */}
      {isExpanded && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 transition-opacity" onClick={() => setIsExpanded(false)} />
      )}

      {/* VIEW 1: ADVANCED TIMELINE GANTT CALENDAR WEEK VIEW */}
      {activeView === "timeline" && (
        <div className={`bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-300 ${
          isExpanded 
            ? "fixed inset-4 md:inset-8 z-50 flex flex-col bg-white border-2 border-slate-300 shadow-2xl rounded-2xl p-2 md:p-4 overflow-hidden animate-fadeIn" 
            : "overflow-hidden"
        }`}>

          {projectPortfolioRange && (
            <div className="px-4 pt-3 pb-1 text-[11px] text-gray-500 font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>Proje Süresi (Proje Portföyü):</span>
              <span className="text-gray-800 font-bold">
                {projectPortfolioRange.startYear}/H{projectPortfolioRange.startWeek} → {projectPortfolioRange.endYear}/H{projectPortfolioRange.endWeek}
              </span>
            </div>
          )}

          <div className="p-4 border-b border-gray-150 bg-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              {isExpanded && (
                <span className="bg-slate-900 text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase font-sans mr-2">
                  Tam Ekran Gantt Şeması
                </span>
              )}
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              <span className="text-[11px] font-bold text-gray-600">Planlanan Dönem (Planned)</span>
              <span className="w-3 h-3 bg-emerald-500 rounded-full ml-2"></span>
              <span className="text-[11px] font-bold text-gray-600">Gerçekleşme / Mevcut Durum (Actual)</span>
            </div>

            <div className="flex items-center space-x-3 text-xs w-full sm:w-auto justify-between sm:justify-end">
              {/* Chart zoom window — independent of the read-only Proje Süresi banner above. */}
              <div className="flex items-center space-x-1.5">
                <span className="text-gray-500 font-medium">Zaman Aralığı:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="2020"
                    max="2100"
                    title="Başlangıç Yılı"
                    className="w-16 bg-white border border-gray-300 rounded px-1.5 py-0.5 font-bold focus:ring-1 focus:ring-slate-300 focus:outline-none text-center text-xs"
                    value={startYear}
                    onChange={(e) => setStartYear(Number(e.target.value))}
                  />
                  <span className="text-gray-400">/H</span>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    title="Başlangıç Haftası"
                    className="w-12 bg-white border border-gray-300 rounded px-1.5 py-0.5 font-bold focus:ring-1 focus:ring-slate-300 focus:outline-none text-center text-xs"
                    value={startWeek}
                    onChange={(e) => setStartWeek(Number(e.target.value))}
                  />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="2020"
                    max="2100"
                    title="Bitiş Yılı"
                    className="w-16 bg-white border border-gray-300 rounded px-1.5 py-0.5 font-bold focus:ring-1 focus:ring-slate-300 focus:outline-none text-center text-xs"
                    value={endYear}
                    onChange={(e) => setEndYear(Number(e.target.value))}
                  />
                  <span className="text-gray-400">/H</span>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    title="Bitiş Haftası"
                    className="w-12 bg-white border border-gray-300 rounded px-1.5 py-0.5 font-bold focus:ring-1 focus:ring-slate-300 focus:outline-none text-center text-xs"
                    value={endWeek}
                    onChange={(e) => setEndWeek(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Screen Expansion Trigger */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  isExpanded 
                    ? "bg-slate-800 text-white border-slate-700 hover:bg-slate-900" 
                    : "bg-white hover:bg-gray-50 text-gray-750 border-gray-300"
                }`}
                title={isExpanded ? "Normal ekrana dön" : "Tam ekran / genişletilmiş görünüm"}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isExpanded ? "Daralt" : "Ekranı Genişlet"}</span>
              </button>
            </div>
          </div>

          <div className={`overflow-x-auto overflow-y-auto ${isExpanded ? "flex-1 min-h-0" : ""}`}>
            <div className="min-w-[1000px] divide-y divide-gray-100">
              
              {/* Grid Header row */}
              <div className="grid grid-cols-12 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2.5 items-center">
                <div className="col-span-5 px-4">Yalın Faaliyet Bilgileri</div>
                
                {/* Generated Weeks Header */}
                <div className="col-span-7 grid grid-flow-col auto-cols-fr text-center border-l border-gray-200">
                  {Array.from({ length: totalWeeks }).map((_, i) => {
                    const absW = absStart + i;
                    // Unwrap the absolute index back to a real calendar week/year for display.
                    const realWeek = ((absW - 1) % 52) + 1;
                    const realYear = Math.floor((absW - 1) / 52);
                    return (
                      <div key={absW} className="border-r border-gray-100 last:border-0 font-mono text-[10px] py-1 text-gray-600 font-bold">
                        W{realWeek}
                        {realYear !== startYear && <span className="block text-[8px] text-gray-400 font-normal">'{String(realYear).slice(-2)}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid Content Rows */}
              {filteredActivities.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">Aranan kriterlerde faaliyet bulunmamaktadır.</div>
              ) : (
                filteredActivities.map((act, idx) => {
                  if (isRowHidden(act)) return null;
                  const childCount = childCountByParent[act.id] || 0;
                  const isCollapsed = collapsedParents.has(act.id);
                  const isSubActivity = !!(act as any).parentActivityId;

                  // While this bar is being dragged, show the live drag position instead of the
                  // last-saved values — commit only happens on mouseup (see onBarDragEnd above).
                  const isDraggingPlanned = dragPreview && dragPreview.actId === act.id && dragPreview.type === 'planned';
                  const isDraggingActual = dragPreview && dragPreview.actId === act.id && dragPreview.type === 'actual';

                  // Compute planned relative positions in percentage
                  const pStartRel = isDraggingPlanned ? dragPreview!.start : act.plannedStartWeek;
                  const pFinishRel = isDraggingPlanned ? dragPreview!.finish : act.plannedFinishWeek;
                  const aStartRel = isDraggingActual ? dragPreview!.start : act.actualStartWeek;
                  const aFinishRel = isDraggingActual ? dragPreview!.finish : act.actualFinishWeek;

                  // Routed through toAbsWeek() so positions stay correct when the chart's Zaman
                  // Aralığı spans a year boundary (raw week numbers alone can't tell 2026's week 5
                  // from 2027's week 5).
                  const pLeftPercent = Math.max(0, ((toAbsWeek(pStartRel) - absStart) / totalWeeks) * 100);
                  const pWidthPercent = Math.max(5, (((toAbsWeek(pFinishRel) - toAbsWeek(pStartRel) + 1)) / totalWeeks) * 100);

                  const aLeftPercent = Math.max(0, ((toAbsWeek(aStartRel) - absStart) / totalWeeks) * 100);
                  const aWidthPercent = Math.max(5, (((toAbsWeek(aFinishRel) - toAbsWeek(aStartRel) + 1)) / totalWeeks) * 100);

                  // Colors based on status
                  let actualColor = "bg-gray-400/80";
                  if (act.status === "Completed") actualColor = "bg-emerald-500 shadow-xs shadow-emerald-500/10";
                  else if (act.status === "In Progress") actualColor = "bg-orange-500 shadow-xs shadow-orange-500/10";
                  else if (act.status === "Delayed") actualColor = "bg-red-500 shadow-xs shadow-red-500/10";

                  const isDragOverRow = dragOverActivityId === act.id && draggingActivityId !== act.id;

                  return (
                    <div
                      key={act.id}
                      className={`grid grid-cols-12 py-3 items-center group hover:bg-slate-50/40 transition-colors ${
                        draggingActivityId === act.id ? "opacity-40" : ""
                      } ${isDragOverRow ? "border-t-2 border-emerald-500" : ""}`}
                      onDragOver={(e) => {
                        if (!draggingActivityId) return;
                        e.preventDefault();
                        if (dragOverActivityId !== act.id) setDragOverActivityId(act.id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggingActivityId) handleReorderActivity(draggingActivityId, act.id);
                        setDraggingActivityId(null);
                        setDragOverActivityId(null);
                      }}
                    >

                      {/* Left: Info Card */}
                      <div className="col-span-5 px-4 flex items-start space-x-2.5">

                        {/* Drag handles & Order Controls */}
                        <div className="flex flex-col items-center justify-center space-y-0.5 shrink-0">
                          <button
                            onClick={() => handleMoveActivity(idx, "up")}
                            disabled={idx === 0}
                            className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                          >
                            <ChevronUp className="w-3.5 h-3.5 text-gray-600" />
                          </button>
                          <span
                            draggable
                            onDragStart={(e) => {
                              setDraggingActivityId(act.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => {
                              setDraggingActivityId(null);
                              setDragOverActivityId(null);
                            }}
                            title="Sürükleyerek sırasını değiştirin"
                            className="font-mono text-[11px] font-bold text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-700 hover:bg-gray-100 rounded px-0.5"
                          >
                            {act.activityNo}
                          </span>
                          <button
                            onClick={() => handleMoveActivity(idx, "down")}
                            disabled={idx === filteredActivities.length - 1}
                            className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30"
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                          </button>
                        </div>

                        {/* Title, Category and Linked Badge */}
                        <div className={`space-y-1 overflow-hidden ${isSubActivity ? "pl-4" : ""}`}>
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            {!isSubActivity && childCount > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleParentCollapsed(act.id)}
                                className="text-[10px] font-mono font-bold text-blue-600 hover:text-blue-800 shrink-0"
                                title={isCollapsed ? "Alt faaliyetleri göster" : "Alt faaliyetleri gizle"}
                              >
                                {isCollapsed ? "alt ›" : "‹"}
                              </button>
                            )}
                            {isSubActivity && <span className="text-gray-300 shrink-0">↳</span>}
                            <span
                              onClick={() => openEditModal(act)}
                              className="font-bold text-[12px] text-gray-900 hover:text-blue-600 cursor-pointer block truncate"
                            >
                              {act.name}
                            </span>
                            {act.milestone && (
                              <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-1 rounded uppercase">Milestone</span>
                            )}
                            {!isSubActivity && (
                              <button
                                type="button"
                                onClick={() => openAddSubActivityModal(act.id)}
                                className="text-[10px] text-gray-400 hover:text-blue-600 font-bold shrink-0"
                                title="Alt Faaliyet Ekle"
                              >
                                + Alt Faaliyet
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDeleteActivityLocal(act.id)}
                              className="text-gray-300 hover:text-red-500 shrink-0 ml-auto"
                              title="Faaliyeti Sil"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center space-x-2 text-[10px] text-gray-500 flex-wrap gap-y-1">
                            {act.phase && (
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-1 rounded text-[11px]">{act.phase}</span>
                            )}
                            <span className="bg-gray-100 text-gray-700 font-bold px-1 rounded text-[11px]">{act.category}</span>
                            {act.parallelWith && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-1 rounded text-[11px]" title="Bu faaliyet paralel yürütülüyor, adam-gün toplamına dahil edilmiyor">
                                ∥ No {act.parallelWith}
                              </span>
                            )}
                            <span>•</span>
                            <span className="flex items-center">
                              <User className="w-3 h-3 text-gray-400 mr-0.5" />
                              {act.responsibleConsultant}
                            </span>
                            <span>•</span>
                            <span className={`font-bold ${
                              act.priority === "High" ? "text-red-500" :
                              act.priority === "Medium" ? "text-amber-500" : "text-gray-400"
                            }`}>{act.priority}</span>

                            {/* Schedule Deviation Badge */}
                            {(() => {
                              const maxActual = act.actualWeeks && act.actualWeeks.length > 0 ? Math.max(...act.actualWeeks) : act.actualFinishWeek;
                              const deviation = maxActual - act.plannedFinishWeek;
                              if (deviation > 0) {
                                return (
                                  <span className="bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-1" title="Planlanan Bitiş Tarihinden Sapma Var">
                                    <AlertTriangle className="w-2.5 h-2.5 text-red-500 shrink-0" />
                                    <span>+{deviation} Hafta Sapma</span>
                                  </span>
                                );
                              } else if (deviation < 0) {
                                return (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-1">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                    <span>{Math.abs(deviation)} Hafta Erken</span>
                                  </span>
                                );
                              }
                              return (
                                <span className="bg-gray-50 text-gray-500 border border-gray-200 text-[11px] font-bold px-1 py-0.5 rounded">
                                  Plana Uygun
                                </span>
                              );
                            })()}
                          </div>

                          {/* Linked Module Integration Badge */}
                          {act.relatedModule && act.linkedItemId && (
                            <div className="flex items-center space-x-1 bg-blue-50/50 border border-blue-100 rounded px-1.5 py-0.5 w-max">
                              <Zap className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                              <span className="text-[11px] font-bold text-blue-700 uppercase">
                                Entegre: {act.relatedModule} (Otomatik Senkron)
                              </span>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Right: Dual timeline grid container */}
                      <div className="col-span-7 h-16 relative border-l border-gray-200 flex flex-col justify-center px-1">
                        
                        {/* Weekly vertical lines background layer */}
                        <div className="absolute inset-0 grid grid-flow-col auto-cols-fr pointer-events-none">
                          {Array.from({ length: totalWeeks }).map((_, i) => (
                            <div key={i} className="border-r border-gray-100/60 last:border-0 h-full"></div>
                          ))}
                        </div>

                        {/* RENDER DIAMOND MILESTONE OR SCHEDULE BARS */}
                        {act.milestone ? (
                          <div className="relative h-12 w-full flex items-center">
                            
                            {/* Milestone diamond representation */}
                            <div 
                              className="absolute z-10 w-4 h-4 bg-amber-500 rotate-45 border border-white flex items-center justify-center shadow-xs cursor-pointer group-hover:scale-110 transition-transform"
                              style={{ left: `calc(${pLeftPercent}% - 8px)` }}
                              title={`Milestone: ${act.name} (Hafta ${act.plannedStartWeek})`}
                              onClick={() => openEditModal(act)}
                            >
                            </div>
                            
                            <div className="absolute text-[11px] text-gray-400 font-mono" style={{ left: `calc(${pLeftPercent}% + 12px)` }}>
                              Hafta {act.plannedStartWeek}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2.5 relative z-10">
                            
                            {/* Track 1: Planned (Blue) */}
                            <div className="relative h-4 w-full group/bar" data-week-track>

                              <div
                                className="absolute bg-blue-500 rounded h-2.5 flex items-center justify-between text-[11px] text-white font-mono px-1 select-none transition-all cursor-grab active:cursor-grabbing"
                                style={{ left: `${pLeftPercent}%`, width: `${pWidthPercent}%` }}
                                title={`Planlanan: Hafta ${act.plannedStartWeek} - Hafta ${act.plannedFinishWeek} (sürükleyerek taşıyın)`}
                                onMouseDown={(e) => beginBarDrag(e, act, 'planned', 'move')}
                              >
                                {/* Left resize handle (drag) + shift-by-1 arrow */}
                                <div
                                  onMouseDown={(e) => beginBarDrag(e, act, 'planned', 'resize-start')}
                                  className="absolute -left-1 top-0 h-full w-2 cursor-ew-resize z-10"
                                />
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleShiftWeek(act, 'planned', 'start', -1); }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="absolute -left-3.5 bg-blue-100 hover:bg-blue-200 text-blue-700 w-3 h-3.5 rounded flex items-center justify-center text-[11px] font-bold opacity-0 group-hover/bar:opacity-100 transition-opacity"
                                >
                                  ‹
                                </button>

                                <span className="truncate block leading-none font-bold scale-90 pointer-events-none">Plan W{act.plannedStartWeek}</span>

                                {/* Right resize handle (drag) + shift-by-1 arrow */}
                                <div
                                  onMouseDown={(e) => beginBarDrag(e, act, 'planned', 'resize-end')}
                                  className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize z-10"
                                />
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleShiftWeek(act, 'planned', 'finish', 1); }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="absolute -right-3.5 bg-blue-100 hover:bg-blue-200 text-blue-700 w-3 h-3.5 rounded flex items-center justify-center text-[11px] font-bold opacity-0 group-hover/bar:opacity-100 transition-opacity"
                                >
                                  ›
                                </button>
                              </div>

                            </div>

                            {/* Track 2: Actual (Status-Based Color & Discrete Week Blocks) */}
                            <div className="relative h-4 w-full group/actual" data-week-track>
                              {(() => {
                                const blocks = getWeekBlocks(act.actualWeeks || []);
                                // A single (or empty) contiguous range always renders as one draggable bar.
                                // While a drag is live, force this branch too — otherwise the static
                                // multi-block view below wouldn't visually track the mouse (its segments
                                // are keyed to the last-saved actualWeeks, not the live drag preview).
                                if (blocks.length <= 1 || isDraggingActual) {
                                  return (
                                    <div
                                      className={`absolute rounded h-2.5 flex items-center justify-between text-[11px] text-white font-mono px-1 transition-all cursor-grab active:cursor-grabbing ${actualColor}`}
                                      style={{ left: `${aLeftPercent}%`, width: `${aWidthPercent}%` }}
                                      title={`Gerçekleşen: Hafta ${act.actualStartWeek} - Hafta ${act.actualFinishWeek} (${act.status}) — sürükleyerek taşıyın`}
                                      onMouseDown={(e) => beginBarDrag(e, act, 'actual', 'move')}
                                    >
                                      <div
                                        onMouseDown={(e) => beginBarDrag(e, act, 'actual', 'resize-start')}
                                        className="absolute -left-1 top-0 h-full w-2 cursor-ew-resize z-10"
                                      />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleShiftWeek(act, 'actual', 'start', -1); }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className="absolute -left-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 w-3 h-3.5 rounded flex items-center justify-center text-[11px] font-bold opacity-0 group-hover/actual:opacity-100 transition-opacity"
                                      >
                                        ‹
                                      </button>
                                      <span className="truncate block leading-none font-bold scale-90 pointer-events-none">Fiili W{act.actualStartWeek} (%{act.progressPercent})</span>
                                      <div
                                        onMouseDown={(e) => beginBarDrag(e, act, 'actual', 'resize-end')}
                                        className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize z-10"
                                      />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleShiftWeek(act, 'actual', 'finish', 1); }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className="absolute -right-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 w-3 h-3.5 rounded flex items-center justify-center text-[11px] font-bold opacity-0 group-hover/actual:opacity-100 transition-opacity"
                                      >
                                        ›
                                      </button>
                                    </div>
                                  );
                                }
                                // Genuinely non-contiguous actual weeks (e.g. gaps from PTR visit data):
                                // every segment can still be dragged to move the whole envelope, and the
                                // first/last segment carry the resize handles. A drag/resize here commits
                                // through the same manualActualOverride path as the single-bar case above,
                                // which rebuilds actualWeeks as one plain range — so the next render
                                // collapses back to the simpler single-bar view.
                                return blocks.map((b, bIdx) => {
                                  const bLeft = Math.max(0, ((toAbsWeek(b.start) - absStart) / totalWeeks) * 100);
                                  const bWidth = Math.max(2.5, (((toAbsWeek(b.finish) - toAbsWeek(b.start) + 1) / totalWeeks) * 100));
                                  return (
                                    <div
                                      key={bIdx}
                                      className={`absolute rounded h-2.5 flex items-center justify-between text-[11px] text-white font-mono px-1 transition-all cursor-grab active:cursor-grabbing ${actualColor}`}
                                      style={{ left: `${bLeft}%`, width: `${bWidth}%` }}
                                      title={`Gerçekleşen Uygulama: Hafta ${b.start}${b.finish > b.start ? ' - Hafta ' + b.finish : ''} — sürükleyerek tek parça haline getirebilirsiniz`}
                                      onMouseDown={(e) => beginBarDrag(e, act, 'actual', 'move')}
                                    >
                                      {bIdx === 0 && (
                                        <div
                                          onMouseDown={(e) => beginBarDrag(e, act, 'actual', 'resize-start')}
                                          className="absolute -left-1 top-0 h-full w-2 cursor-ew-resize z-10"
                                        />
                                      )}
                                      {bIdx === 0 && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleShiftWeek(act, 'actual', 'start', -1); }}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          className="absolute -left-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 w-3 h-3.5 rounded flex items-center justify-center text-[11px] font-bold opacity-0 group-hover/actual:opacity-100 transition-opacity"
                                        >
                                          ‹
                                        </button>
                                      )}
                                      <span className="truncate block leading-none font-bold scale-90 font-mono pointer-events-none">
                                        W{b.start}{b.finish > b.start ? `-${b.finish}` : ''}
                                      </span>
                                      {bIdx === blocks.length - 1 && (
                                        <div
                                          onMouseDown={(e) => beginBarDrag(e, act, 'actual', 'resize-end')}
                                          className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize z-10"
                                        />
                                      )}
                                      {bIdx === blocks.length - 1 && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleShiftWeek(act, 'actual', 'finish', 1); }}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          className="absolute -right-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 w-3 h-3.5 rounded flex items-center justify-center text-[11px] font-bold opacity-0 group-hover/actual:opacity-100 transition-opacity"
                                        >
                                          ›
                                        </button>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                            </div>

                          </div>
                        )}

                      </div>

                    </div>
                  );
                })
              )}

            </div>
          </div>

        </div>
      )}

      {/* VIEW 2: EXCEL SPREADSHEET TABLE VIEW */}
      {activeView === "table" && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">Faaliyet Adı</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Danışman</th>
                  <th className="py-2.5 px-3 text-center">Plan Hafta</th>
                  <th className="py-2.5 px-3 text-center">Gerçekleşen Hafta</th>
                  <th className="py-2.5 px-3 text-center">İlerleme Oranı</th>
                  <th className="py-2.5 px-3">Öncelik</th>
                  <th className="py-2.5 px-3">Durum</th>
                  <th className="py-2.5 px-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredActivities.map(act => {
                  if (isRowHidden(act)) return null;
                  const childCount = childCountByParent[act.id] || 0;
                  const isCollapsed = collapsedParents.has(act.id);
                  const isSubActivity = !!(act as any).parentActivityId;
                  return (
                  <tr key={act.id} className={`hover:bg-gray-50/50 ${isSubActivity ? "bg-slate-50/40" : ""}`}>
                    <td className="py-3 px-3 font-mono font-bold text-gray-400">{act.activityNo}</td>
                    <td className={`py-3 px-3 font-bold text-gray-900 ${isSubActivity ? "pl-8" : ""}`}>
                      <div className="flex items-center space-x-1.5">
                        {!isSubActivity && childCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleParentCollapsed(act.id)}
                            className="text-[10px] font-mono font-bold text-blue-600 hover:text-blue-800 shrink-0"
                            title={isCollapsed ? "Alt faaliyetleri göster" : "Alt faaliyetleri gizle"}
                          >
                            {isCollapsed ? "alt ›" : "‹"}
                          </button>
                        )}
                        {isSubActivity && <span className="text-gray-300 shrink-0">↳</span>}
                        <span>{act.name}</span>
                        {!isSubActivity && (
                          <button
                            type="button"
                            onClick={() => openAddSubActivityModal(act.id)}
                            className="text-[10px] text-gray-400 hover:text-blue-600 font-bold shrink-0"
                            title="Alt Faaliyet Ekle"
                          >
                            + Alt Faaliyet
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {act.phase && (
                        <span className="mr-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.5 rounded text-[10px] font-semibold">{act.phase}</span>
                      )}
                      <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">{act.category}</span>
                      {act.parallelWith && (
                        <span className="ml-1 bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.5 rounded text-[10px] font-semibold" title="Bu faaliyet paralel yürütülüyor, adam-gün toplamına dahil edilmiyor">
                          ∥ No {act.parallelWith}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">{act.responsibleConsultant}</td>
                    <td className="py-3 px-3 font-mono text-center">W{act.plannedStartWeek} - W{act.plannedFinishWeek}</td>
                    <td className="py-3 px-3 font-mono text-center text-gray-500">W{act.actualStartWeek} - W{act.actualFinishWeek}</td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <span className="font-mono font-semibold">%{act.progressPercent}</span>
                        <div className="w-12 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-1.5 rounded" style={{ width: `${act.progressPercent}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-[4px] font-bold text-[10px] uppercase ${
                        act.priority === "High" ? "bg-red-50 text-red-700 border border-red-100" :
                        act.priority === "Medium" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {act.priority}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-[4px] font-bold text-[10px] uppercase ${
                        act.status === "Completed" ? "bg-emerald-100 text-emerald-800" :
                        act.status === "In Progress" ? "bg-blue-100 text-blue-800" :
                        act.status === "Delayed" ? "bg-red-100 text-red-800" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {act.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openEditModal(act)}
                          className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                          title="Düzenle"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteActivityLocal(act.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
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

      {/* VIEW 3: KANBAN BOARD VIEW */}
      {activeView === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Planned Column */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="font-bold text-xs text-gray-600 uppercase">Plana Alınanlar</span>
              <span className="bg-gray-200 text-gray-800 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
                {filteredActivities.filter(a => a.status === "Planned").length}
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[400px]">
              {filteredActivities.filter(a => a.status === "Planned").map(act => (
                <div key={act.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-xs space-y-2 hover:border-gray-300 cursor-pointer" onClick={() => openEditModal(act)}>
                  <div className="flex items-center justify-between">
                    <span className="bg-gray-100 text-gray-750 px-1 rounded text-[11px] font-bold font-mono">{act.category}</span>
                    <span className="flex items-center space-x-1.5">
                      <span className="text-gray-400 text-[11px] font-bold font-mono">#{act.activityNo}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteActivityLocal(act.id); }}
                        className="text-gray-300 hover:text-red-500 shrink-0"
                        title="Faaliyeti Sil"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                  <span className="font-bold text-[12px] text-gray-900 block leading-tight">{(act as any).parentActivityId ? "↳ " : ""}{act.name}</span>
                  <div className="flex justify-between items-center text-[10px] pt-1 text-gray-500 border-t border-gray-100">
                    <span>{act.responsibleConsultant}</span>
                    <span className="font-mono font-bold text-blue-600 text-[11px]">W{act.plannedStartWeek}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-3 space-y-3">
            <div className="flex justify-between items-center border-b border-blue-200 pb-2">
              <span className="font-bold text-xs text-blue-950 uppercase">Yürütülüyor</span>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
                {filteredActivities.filter(a => a.status === "In Progress").length}
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[400px]">
              {filteredActivities.filter(a => a.status === "In Progress").map(act => (
                <div key={act.id} className="bg-white border border-blue-100 rounded-lg p-3 shadow-xs space-y-2 hover:border-blue-300 cursor-pointer" onClick={() => openEditModal(act)}>
                  <div className="flex items-center justify-between">
                    <span className="bg-blue-50 text-blue-750 px-1 rounded text-[11px] font-bold font-mono">{act.category}</span>
                    <span className="flex items-center space-x-1.5">
                      <span className="text-gray-400 text-[11px] font-bold font-mono">#{act.activityNo}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteActivityLocal(act.id); }}
                        className="text-gray-300 hover:text-red-500 shrink-0"
                        title="Faaliyeti Sil"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                  <span className="font-bold text-[12px] text-gray-900 block leading-tight">{(act as any).parentActivityId ? "↳ " : ""}{act.name}</span>
                  
                  {/* Progress Line */}
                  <div className="w-full bg-gray-100 h-1 rounded overflow-hidden">
                    <div className="bg-blue-500 h-1" style={{ width: `${act.progressPercent}%` }}></div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] pt-1 text-gray-500 border-t border-gray-100">
                    <span>{act.responsibleConsultant}</span>
                    <span className="font-mono font-bold text-emerald-600 text-[11px]">% {act.progressPercent}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Completed Column */}
          <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-3 space-y-3">
            <div className="flex justify-between items-center border-b border-emerald-200 pb-2">
              <span className="font-bold text-xs text-emerald-950 uppercase">Tamamlananlar</span>
              <span className="bg-emerald-100 text-emerald-855 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
                {filteredActivities.filter(a => a.status === "Completed").length}
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[400px]">
              {filteredActivities.filter(a => a.status === "Completed").map(act => (
                <div key={act.id} className="bg-white border border-emerald-100 rounded-lg p-3 shadow-xs space-y-2 opacity-85 hover:opacity-100 cursor-pointer" onClick={() => openEditModal(act)}>
                  <div className="flex items-center justify-between">
                    <span className="bg-emerald-50 text-emerald-750 px-1 rounded text-[11px] font-bold font-mono">{act.category}</span>
                    <span className="flex items-center space-x-1.5">
                      <span className="text-gray-400 text-[11px] font-bold font-mono">#{act.activityNo}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteActivityLocal(act.id); }}
                        className="text-gray-300 hover:text-red-500 shrink-0"
                        title="Faaliyeti Sil"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                  <span className="font-bold text-[12px] text-gray-800 line-through block leading-tight">{act.name}</span>
                  <div className="flex justify-between items-center text-[10px] pt-1 text-gray-400 border-t border-gray-150">
                    <span>{act.responsibleConsultant}</span>
                    <span className="text-emerald-600 font-bold flex items-center text-[11px]">
                      ✓ Ok
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delayed Column */}
          <div className="bg-red-50/40 border border-red-200 rounded-xl p-3 space-y-3">
            <div className="flex justify-between items-center border-b border-red-200 pb-2">
              <span className="font-bold text-xs text-red-950 uppercase">Tarihi Gecikenler</span>
              <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
                {filteredActivities.filter(a => a.status === "Delayed").length}
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[400px]">
              {filteredActivities.filter(a => a.status === "Delayed").map(act => (
                <div key={act.id} className="bg-white border border-red-100 rounded-lg p-3 shadow-xs space-y-2 hover:border-red-300 cursor-pointer" onClick={() => openEditModal(act)}>
                  <div className="flex items-center justify-between">
                    <span className="bg-red-50 text-red-750 px-1 rounded text-[11px] font-bold font-mono">{act.category}</span>
                    <span className="flex items-center space-x-1.5">
                      <span className="text-gray-400 text-[11px] font-bold font-mono">#{act.activityNo}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteActivityLocal(act.id); }}
                        className="text-gray-300 hover:text-red-500 shrink-0"
                        title="Faaliyeti Sil"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                  <span className="font-bold text-[12px] text-red-900 block leading-tight">{act.name}</span>
                  <div className="flex justify-between items-center text-[10px] pt-1 text-red-700 border-t border-red-100">
                    <span>{act.responsibleConsultant}</span>
                    <span className="font-bold font-mono text-[11px]">Gecikti</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* 7. QUICK ADD & EDIT DIALOG MODALS */}
      {(isAdding || editingActivity) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 max-h-[90vh] flex flex-col overflow-hidden">

            <div className="bg-gray-55 px-5 py-3 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-xs font-bold text-gray-900 uppercase">
                {editingActivity ? `Yalın Faaliyeti Revize Et [No: ${editingActivity.activityNo}]` : pendingParentActivityId ? "Alt Faaliyet Ekle" : "Yeni Yalın Faaliyet Planla"}
              </h3>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingActivity(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={editingActivity ? handleEditSave : handleSave} className="p-5 space-y-3.5 text-xs overflow-y-auto">

              <div>
                <label className="block text-gray-500 font-bold mb-1">Aktivite / Kaizen / Proje Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: 5S Temizlik Standartları, Pres SMED Hızlı Kalıp Değişimi vb."
                  className="w-full bg-white border border-gray-300 rounded p-2 focus:outline-none focus:ring-1 focus:ring-slate-700"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-500 font-bold mb-1">Yalın Sınıfı (Lean Category)</label>
                  <select
                    className="w-full bg-white border border-gray-300 rounded p-2 text-xs"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    <option value="5S Audit">5S Audit / Standart İş</option>
                    <option value="SMED">SMED (Hızlı Kalıp Değişimi)</option>
                    <option value="Yamazumi">Yamazumi (Hat Dengeleme)</option>
                    <option value="VSM">VSM (Değer Akış Haritalama)</option>
                    <option value="Spaghetti">Spaghetti Diyagramı</option>
                    <option value="Time Study">Kronometraj / Zaman Etüdü</option>
                    <option value="Kaizen">Kaizen Projesi</option>
                    <option value="OEE">OEE İyileştirme</option>
                    <option value="Capacity Analysis">Kapasite Analizi</option>
                    <option value="Saha Gözlemi">Saha Gözlemi</option>
                    <option value="Süreç Analizi">Süreç Analizi</option>
                    <option value="Kick Off">Kick Off</option>
                    <option value="Eğitim">Eğitim</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Yalın Danışman</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-white border border-gray-300 rounded p-2"
                    value={formConsultant}
                    onChange={(e) => setFormConsultant(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-500 font-bold mb-1">Faz No</label>
                  <select
                    className="w-full bg-white border border-gray-300 rounded p-2 font-bold text-gray-700"
                    value={formPhase}
                    onChange={(e) => setFormPhase(e.target.value)}
                  >
                    {availablePhases.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Öncelik Seviyesi</label>
                  <select
                    className="w-full bg-white border border-gray-300 rounded p-2 font-semibold text-gray-700"
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                  >
                    <option value="High">Yüksek (High)</option>
                    <option value="Medium">Orta (Medium)</option>
                    <option value="Low">Düşük (Low)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Planlanan Man-Day</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-white border border-gray-300 rounded p-2"
                    value={formPlannedManDays}
                    onChange={(e) => setFormPlannedManDays(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Weeks ranges */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-150">
                <div>
                  <h4 className="font-bold text-gray-700 uppercase text-[11px] mb-1">Planlanan Dönem (Hafta)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-gray-400">Başlangıç</span>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        className="w-full bg-white border border-gray-300 rounded p-1 font-mono font-bold"
                        value={formPlannedStartWeek}
                        onChange={(e) => setFormPlannedStartWeek(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-400">Bitiş</span>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        className="w-full bg-white border border-gray-300 rounded p-1 font-mono font-bold"
                        value={formPlannedFinishWeek}
                        onChange={(e) => setFormPlannedFinishWeek(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-gray-700 uppercase text-[11px] mb-1">Gerçekleşen Dönem (Hafta)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-gray-400">Başlangıç</span>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        className="w-full bg-white border border-gray-300 rounded p-1 font-mono font-bold"
                        value={formActualStartWeek}
                        onChange={(e) => setFormActualStartWeek(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-400">Bitiş</span>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        className="w-full bg-white border border-gray-300 rounded p-1 font-mono font-bold"
                        value={formActualFinishWeek}
                        onChange={(e) => setFormActualFinishWeek(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and milestones */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-500 font-bold mb-1">Durum</label>
                  <select
                    className="w-full bg-white border border-gray-300 rounded p-2 font-bold"
                    value={formStatus}
                    onChange={(e) => {
                      const st = e.target.value;
                      setFormStatus(st);
                      if (st === "Completed") setFormProgress(100);
                    }}
                  >
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Delayed">Delayed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">İlerleme Oranı</label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      className="w-full cursor-pointer accent-gray-850"
                      value={formProgress}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormProgress(val);
                        if (val === 100) setFormStatus("Completed");
                        else if (val > 0 && formStatus === "Planned") setFormStatus("In Progress");
                      }}
                    />
                    <span className="font-mono font-bold text-gray-700">% {formProgress}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center pt-4">
                  <label className="flex items-center space-x-2 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={formMilestone}
                      onChange={(e) => setFormMilestone(e.target.checked)}
                    />
                    <span>Milestone Diamond?</span>
                  </label>
                </div>
              </div>

              {/* Linked Module Integration Selectors */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 space-y-2">
                <h4 className="font-bold text-blue-900 uppercase text-[11px] flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-blue-500 animate-pulse" />
                  <span>Sistemler Arası Otomatik Entegrasyon (No Duplicate Entry)</span>
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-500 font-bold mb-1">İlişkili Yalın Modül</label>
                    <select
                      className="w-full bg-white border border-gray-300 rounded p-1.5"
                      value={formRelatedModule}
                      onChange={(e) => {
                        setFormRelatedModule(e.target.value);
                        setFormLinkedItemId("");
                      }}
                    >
                      <option value="">Bağlantı Yok</option>
                      <option value="5S Audits">5S Audits (Değerlendirmeler)</option>
                      <option value="Kaizen Projects">Kaizen Projects (Panosu)</option>
                      <option value="OEE Improvement">OEE Improvement / Kayıp Analizi</option>
                      <option value="Capacity Analysis">Kapasite Analizi (Süreç Verileri)</option>
                      <option value="SMED Projects">SMED (Hızlı Kalıp Değişimi Projeleri)</option>
                      <option value="Yamazumi Studies">Yamazumi (Hat Dengeleme Etütleri)</option>
                      <option value="VSM Projects">VSM (Değer Akış Haritaları)</option>
                      <option value="Time Studies">Time Study (Zaman Etütleri)</option>
                      <option value="OpEx Assessments">OpEx Assessment (Olgunluk Denetimleri)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-500 font-bold mb-1">İlişkili Kayıt</label>
                    <select
                      className="w-full bg-white border border-gray-300 rounded p-1.5"
                      value={formLinkedItemId}
                      onChange={(e) => setFormLinkedItemId(e.target.value)}
                      disabled={!formRelatedModule}
                    >
                      <option value="">Seçiniz...</option>

                      {formRelatedModule === "5S Audits" && audits5S.map(a => (
                        <option key={a.id} value={a.id}>Denetim No {a.auditNo} ({a.status}{a.overallScore !== null && a.overallScore !== undefined ? ` — ${a.overallScore}/5` : ""})</option>
                      ))}

                      {formRelatedModule === "Kaizen Projects" && kaizens.map(k => (
                        <option key={k.id} value={k.id}>{k.title} ({k.status})</option>
                      ))}

                      {(formRelatedModule === "OEE Improvement" || formRelatedModule === "Capacity Analysis") && processes.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (OEE: % {p.oee})</option>
                      ))}

                      {formRelatedModule === "SMED Projects" && smedProjects.map(s => (
                        <option key={s.id} value={s.id}>{getRecordLabel(s)}</option>
                      ))}

                      {formRelatedModule === "Yamazumi Studies" && yamazumiStudies.map(y => (
                        <option key={y.id} value={y.id}>{getRecordLabel(y)}</option>
                      ))}

                      {formRelatedModule === "VSM Projects" && vsmProjects.map(v => (
                        <option key={v.id} value={v.id}>{getRecordLabel(v)}</option>
                      ))}

                      {formRelatedModule === "Time Studies" && timeStudies.map(t => (
                        <option key={t.id} value={t.id}>{getRecordLabel(t)}</option>
                      ))}

                      {formRelatedModule === "OpEx Assessments" && opexAssessments.map(o => (
                        <option key={o.id} value={o.id}>{getRecordLabel(o)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <span className="text-[11px] text-blue-800 leading-normal block">
                  * "İlişkili Kayıt", bu faaliyeti seçilen modüldeki gerçek bir kayda bağlar (aynı çalışmayı
                  iki yerde ayrı ayrı girmek yerine tek kayıttan referans verirsiniz). 5S / Kaizen / OEE-Kapasite
                  için kayıt tamamlandığında bu faaliyet de otomatik "Completed" olur; diğer modüller (SMED,
                  Yamazumi, VSM, Time Study, OpEx Assessment) için bağlantı referans amaçlıdır, otomatik senkron
                  henüz o modüllere eklenmedi.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-500 font-bold mb-1">Öncüller (Dependencies - Örn: 01,02)</label>
                  <input
                    type="text"
                    placeholder="01, 02 vb."
                    className="w-full bg-white border border-gray-300 rounded p-1.5 font-mono"
                    value={formDependencies}
                    onChange={(e) => setFormDependencies(e.target.value)}
                  />
                  <span className="text-[10px] text-gray-400 block mt-0.5">Bu faaliyetin hangi faaliyet no'larından sonra başlaması gerektiğini not eder (bilgi amaçlı; tarihleri otomatik kaydırmaz).</span>
                </div>

                <div>
                  <label className="block text-gray-500 font-bold mb-1">Paralel Faaliyet No (Adam-Gün Tekrar Sayılmasın)</label>
                  <input
                    type="text"
                    placeholder="Örn: 03"
                    className="w-full bg-white border border-gray-300 rounded p-1.5 font-mono"
                    value={formParallelWith}
                    onChange={(e) => setFormParallelWith(e.target.value)}
                  />
                  <span className="text-[10px] text-gray-400 block mt-0.5">Bu faaliyet, girilen numaralı faaliyetle aynı anda yürütülüyorsa doldurun — adam-gün toplamına ikinci kez eklenmez.</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-500 font-bold mb-1">Açıklama / Gemba Notları</label>
                <textarea
                  placeholder="Gerekçe, kilit kayıplar ve beklenen dönüşüm çıktısı..."
                  rows={2}
                  className="w-full bg-white border border-gray-300 rounded p-2 text-gray-800 focus:outline-none focus:ring-1 focus:ring-slate-700"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingActivity(null);
                    resetForm();
                  }}
                  className="bg-gray-100 text-gray-600 font-semibold px-4 py-1.5 rounded-lg"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-5 py-1.5 rounded-lg"
                >
                  {editingActivity ? "Planı Güncelle" : "Gantt Planına Ekle"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* NEW CUSTOM PROJECT PLAN NAME MODAL */}
      {isCreatingPlan && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
            
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xs font-bold text-gray-900 uppercase flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Yeni Proje Planı Tanımla</span>
              </h3>
              <button 
                onClick={() => {
                  setIsCreatingPlan(false);
                  setNewPlanInputName("");
                }} 
                className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProjectPlanSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 font-bold mb-2 uppercase tracking-wider text-[10px]">
                  Proje Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Pres Hattı Yalın Dönüşüm Projesi"
                  className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  value={newPlanInputName}
                  onChange={(e) => setNewPlanInputName(e.target.value)}
                  autoFocus
                />
                <p className="text-[10px] text-gray-400 mt-1.5 leading-normal">
                  * Yeni plan oluşturulduğunda, master plandaki yerleşim ve faaliyet şablonu otomatik olarak yeni plana kopyalanacaktır.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingPlan(false);
                    setNewPlanInputName("");
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  Proje Planı Oluştur
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* DELETE PLAN CONFIRMATION MODAL */}
      {planToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 text-red-600 border-b border-gray-100 pb-3">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-900">Proje Planını Sil</h3>
                <p className="text-xs text-gray-500">Bu işlem için onayınız gerekmektedir</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <strong className="text-gray-900">"{planToDelete.name}"</strong> adlı proje planını silmek istediğinizden emin misiniz?
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-medium">
                Silinen plan çöp kutusuna kaldırılacak ve Sistem Ayarları panelinden dilediğiniz zaman geri yüklenebilecektir.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setPlanToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  const plan = planToDelete;
                  // Soft delete: mark deletedAt inline rather than moving to a separate list — the
                  // debounced auto-save effect persists this to the server, where the trash bin in
                  // Sistem Ayarları reads it from the same per-customer state.
                  setCustomPlans(prev => prev.map(p => p.id === plan.id ? { ...p, deletedAt: new Date().toISOString() } : p));

                  if (currentTopTab === plan.id) {
                    setCurrentTopTab("master");
                  }

                  window.dispatchEvent(new CustomEvent("CustomPlansChanged"));
                  setPlanToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Evet, Planı Sil</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
