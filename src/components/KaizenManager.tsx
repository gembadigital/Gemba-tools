import React, { useState, useEffect } from "react";
import { KaizenCard, ProcessRecord, GanttActivity, Customer, BeforeAfterKaizenStudy, BeforeAfterKaizenBenefits } from "../types";
import { 
  Plus, Layers, Filter, CheckCircle, Trash2, DollarSign, 
  ArrowRight, Edit2, Sparkles, TrendingUp, BarChart2, PieChart, 
  Calendar, List, AlertTriangle, Check, RotateCcw, FileText, 
  ChevronRight, ChevronDown, Info, Users, Clock, Percent, Shield, ArrowDownUp,
  GripVertical, Maximize2, Minimize2, FileUp, File, FileSpreadsheet, Image,
  Camera, Upload, ZoomIn, X, Eye, LayoutDashboard, Columns3, CalendarRange, ListChecks, BarChart3, Images, Settings
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell,
  LineChart as ReLineChart, Line, AreaChart, Area, ScatterChart, Scatter, ZAxis,
  ComposedChart
} from "recharts";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { CITask, defaultFinancialsInput } from "./ci/ciTypes";
import { getKaizenCategory, COPQ_CATEGORIES } from "./ci/ciCategory";
import CiNewProject from "./ci/CiNewProject";
import { useCiOpportunities } from "./ci/useCiOpportunities";
import { displayProjectNo } from "../utils/ciProject";
import { phaseNumber, choicesWith, CI_CURRENCY_SYMBOLS } from "../utils/ciSettings";
import { ciMasterPlanRow, masterPlanRowId } from "../utils/ciPlan";
import { normalizeCurrency } from "./ci/ciMoney";
import { useCiSettings } from "./ci/useCiSettings";
import CiSettingsPanel from "./ci/CiSettingsPanel";
import CiProjectCard, { CiPerson, StageBadge } from "./ci/CiProjectCard";
import CiMyTasks from "./ci/CiMyTasks";
import CiGainBreakdown from "./ci/CiGainBreakdown";
import CiFinanceDashboard from "./ci/CiFinanceDashboard";
import CiOverview from "./ci/CiOverview";
import { PageHeader, TabBar, Button } from "./ci/ciUi";
import {
  CI_STEPS, CiStageAction, CiUserLike, stageOf, isClosed, pdcaOfStage, stageRequirements, canApproveStage, isCiStaffUser,
  isTaskFinished, personKey, canEditProject, rootCauseOf
} from "../utils/ciLifecycle";
import { sumExpected, sumRealized, realizedInCurrency, excludedNote } from "./ci/ciMoney";
import { exportKaizenCardToExcel as exportCiProjectCardExcel, exportBeforeAfterKaizenToExcel as exportCiBeforeAfterExcel } from "./ci/ciExcelExport";

interface KaizenManagerProps {
  kaizens: KaizenCard[];
  // Resolves to the saved record (with its server-assigned project number), or undefined on failure.
  onAddKaizen: (k: KaizenCard) => Promise<KaizenCard | undefined>;
  // Saves (the server merges the fields sent); resolves to the saved record, or undefined on failure.
  onUpdateKaizen: (k: Partial<KaizenCard> & { id: string }) => Promise<KaizenCard | undefined>;
  // Puts a record returned by the server (e.g. after a lifecycle action) into the app's list.
  onKaizenChanged: (k: KaizenCard) => void;
  // Resolves to false when the server refused (e.g. customer users may not delete projects).
  onDeleteKaizen: (id: string) => Promise<boolean>;
  processes: ProcessRecord[];
  activities: GanttActivity[];
  onAddActivity: (a: GanttActivity) => void;
  onUpdateActivity: (a: GanttActivity) => void;
  onDeleteActivity: (id: string) => void;
  selectedCustomer: Customer;
  currentUser?: CiUserLike | null;
}

type TabType = "overview" | "kanban" | "list" | "timeline" | "mytasks" | "dashboard" | "beforeafter" | "settings";


export default function KaizenManager({
  kaizens,
  onAddKaizen,
  onUpdateKaizen,
  onDeleteKaizen,
  processes,
  activities,
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity,
  selectedCustomer,
  onKaizenChanged,
  currentUser = null
}: KaizenManagerProps) {
  const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";
  // Admin / Consultant: may delete a whole CI project and change the CI settings (enforced by the
  // server too).
  const isCiStaff = isCiStaffUser(currentUser);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("all");
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState("all");
  
  // Selected Product Family filter for Loss Capacity topics

  // Per-customer CI settings (lists, product families, rates, default duration) — utils/ciSettings.ts.
  const { settings: ciSettings, save: saveCiSettings } = useCiSettings(selectedCustomer?.id);
  const defaultPhase = ciSettings.phases[0];
  // Money fields offer the customer's own currency first, then the configured others. Turkish lira
  // is stored as "TL" (the label the forms always used).
  const baseCurrencyCode = normalizeCurrency(selectedCustomer?.currency, "TRY");
  const currencyOptions = [baseCurrencyCode, ...ciSettings.currencies.filter(c => c !== baseCurrencyCode)]
    .map(code => ({ value: code === "TRY" ? "TL" : code, label: `${CI_CURRENCY_SYMBOLS[code] || code} (${code === "TRY" ? "TL" : code})` }));
  const currencyChoices = (current: string) =>
    currencyOptions.some(o => normalizeCurrency(o.value, baseCurrencyCode) === normalizeCurrency(current, baseCurrencyCode))
      ? currencyOptions
      : [...currencyOptions, { value: current, label: current }];


  // Edit Project Detail States
  const [editingProject, setEditingProject] = useState<KaizenCard | null>(null);
  // Structured 5-Why chain — replaces the old single free-text root cause box (which only ever
  // referenced "5 Neden Analizi" by name in its placeholder without actually implementing it).

  // Section 9 — "Önce-Sonra Kaizen Formu" (Before-After Kaizen), matching the real
  // "Kaizen Öncesi Sonrası" template used by the firm. Creation modal form state.
  const [isBeforeAfterModalOpen, setIsBeforeAfterModalOpen] = useState(false);
  const [baSubject, setBaSubject] = useState("");
  const [baTarget, setBaTarget] = useState("");
  const [baDoneBy, setBaDoneBy] = useState("");
  const [baDepartment, setBaDepartment] = useState("");
  const [baDate, setBaDate] = useState("");
  const [baCategory, setBaCategory] = useState<"Verimlilik" | "Kalite" | "Güvenlik">("Verimlilik");
  const [baArea, setBaArea] = useState<"5S" | "Maliyet">("5S");
  const [baBeforeImage, setBaBeforeImage] = useState("");
  const [baAfterImage, setBaAfterImage] = useState("");
  const [baDescBefore, setBaDescBefore] = useState("");
  const [baDescAfter, setBaDescAfter] = useState("");
  const [baBenefitDesc, setBaBenefitDesc] = useState("");
  const [baBenefits, setBaBenefits] = useState<BeforeAfterKaizenBenefits>({});

  // Section 2 & 7 Photo States for Mobile/Tablet Camera & Gallery Uploads

  // Expand/Collapse state for sub-activities on Gantt Timeline
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});

  // Lightbox Zoom Modal State
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // Screen expansion mode
  const [isExpanded, setIsExpanded] = useState(false);

  // Email status message for simulated notification system
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);


  // Drag and Drop States
  const [draggedProjId, setDraggedProjId] = useState<string | null>(null);
  const [activeDropCol, setActiveDropCol] = useState<string | null>(null);

  // Team/assignee directory — fetched from /api/business/customers/{id}/team (the same endpoint
  // ProjectTeamTab.tsx uses), which resolves the customer's real assigned primary consultant,
  // secondary consultants, and customer users. No fictional fallback names: when the customer
  // genuinely has no one assigned yet, this stays empty and the leader/team fields are plain free
  // text (via the "ci-team-directory" datalist) so nothing gets silently pre-filled with a fake person.
  const FALLBACK_TEAM_OPTIONS: string[] = [];
  const [teamOptions, setTeamOptions] = useState<string[]>(FALLBACK_TEAM_OPTIONS);
  // Same directory with user ids — the A3 card links leader / members / task owners to accounts.
  const [teamPeople, setTeamPeople] = useState<CiPerson[]>([]);

  useEffect(() => {
    if (!selectedCustomer?.id) return;
    fetch(`/api/business/customers/${selectedCustomer.id}/team`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.data) return;
        const { primaryConsultant, consultants, customerUsers } = data.data;
        const names: string[] = [];
        if (primaryConsultant) names.push(`${primaryConsultant.full_name} (Baş Danışman)`);
        (consultants || []).forEach((c: any) => names.push(`${c.full_name} (Danışman)`));
        (customerUsers || []).forEach((u: any) => names.push(`${u.full_name} (Müşteri Kullanıcısı)`));
        const people: CiPerson[] = [];
        const addPerson = (u: any, label: string) => {
          if (u?.id && !people.some(p => p.id === u.id)) people.push({ id: u.id, name: u.full_name, label: `${u.full_name} (${label})` });
        };
        addPerson(primaryConsultant, "Baş Danışman");
        (consultants || []).forEach((c: any) => addPerson(c, "Danışman"));
        (customerUsers || []).forEach((u: any) => addPerson(u, "Müşteri Kullanıcısı"));
        setTeamPeople(people);
        setTeamOptions(names.length > 0 ? names : FALLBACK_TEAM_OPTIONS);
      })
      .catch(err => {
        console.error("Failed to load real team directory in KaizenManager", err);
      });
  }, [selectedCustomer?.id, token]);

  // Financial inputs state for active project editing
  const [editingFinancialsProjId, setEditingFinancialsProjId] = useState<string | null>(null);
  
  // Task management state
  const [activeTasksProjId, setActiveTasksProjId] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskResponsible, setNewTaskResponsible] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"High" | "Medium" | "Low">("Medium");

  // Currency helper
  const currency = selectedCustomer?.currency || "₺";

  // Master Plan row of a CI project (utils/ciPlan.ts): week-based dates, leader, link, progress.
  // One row per project (id gantt_sync_<projectId>); fields edited in the Master Plan itself are kept.
  // Written only when something it shows actually changed.
  const syncWithGantt = (project: KaizenCard, action: 'add' | 'update' | 'delete') => {
    const rowId = masterPlanRowId(project.id);
    const existing = activities.find(a => a.id === rowId);
    if (action === 'delete') {
      if (existing) onDeleteActivity(rowId);
      return;
    }
    const row = ciMasterPlanRow(project, existing) as unknown as GanttActivity;
    if (!existing) onAddActivity(row);
    else if (JSON.stringify(row) !== JSON.stringify(existing)) onUpdateActivity(row);
  };

  // Opportunity pool (server, plan step C5) — used by the new-project screen and as the expected-gain
  // fallback of projects opened from an opportunity before they had their own figure.
  const opportunityPool = useCiOpportunities(selectedCustomer?.id);
  const opportunityGain = (k: KaizenCard) => opportunityPool.pool.items.find(o => o.id === k.opportunityId)?.expectedGain;
  // Expected annual gain: own figure → older targetCostReduction → opportunity estimate (as ci/ciFinance.ts).
  const expectedOf = (k: KaizenCard) => (k.expectedGain || 0) > 0 ? k.expectedGain! : (k.targetCostReduction || 0) > 0 ? k.targetCostReduction! : opportunityGain(k) || 0;

  // Project number: stored permanent number, or the legacy date-order number (utils/ciProject.ts).
  const getProjectNo = (proj: KaizenCard) => displayProjectNo(proj, kaizens);

  // Helper function for delay calculations
  const getDelayWeeksSinceDeadline = (deadlineStr?: string) => {
    if (!deadlineStr) return 0;
    const deadlineDate = new Date(deadlineStr);
    const today = new Date();
    if (today < deadlineDate) return 0;
    const diffTime = Math.abs(today.getTime() - deadlineDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.floor(diffDays / 7));
  };

  // Manual reminder e-mail (POST /api/business/kaizens/:id/remind, plan step C9) — sent for real now;
  // the server records it in the project's history and counters.
  const sendReminder = async (project: KaizenCard, to: "leader" | "team" = "leader", note = ""): Promise<{ ok: boolean; error?: string; sent?: number }> => {
    try {
      const res = await fetch(`/api/business/kaizens/${project.id}/remind`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "x-factory-id": selectedCustomer?.id || "" },
        body: JSON.stringify({ to, note })
      }).then(r => r.json());
      if (!res.success) return { ok: false, error: res.error || "Hatırlatma gönderilemedi." };
      onKaizenChanged(res.data);
      return { ok: true, sent: res.sent };
    } catch {
      return { ok: false, error: "Sunucuya ulaşılamadı." };
    }
  };
  const logManualReminder = async (project: KaizenCard) => {
    const r = await sendReminder(project, "leader");
    setEmailStatusMessage(r.ok ? `Hatırlatma e-postası proje liderine gönderildi: ${project.title}` : (r.error || "Hatırlatma gönderilemedi."));
    setTimeout(() => setEmailStatusMessage(null), 6000);
  };

  // Sustainability check result of a closed project.
  const recordFollowUp = async (project: KaizenCard, input: { index: number; value: number | null; sustained: boolean; note: string }) => {
    try {
      const res = await fetch(`/api/business/kaizens/${project.id}/follow-up`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "x-factory-id": selectedCustomer?.id || "" },
        body: JSON.stringify(input)
      }).then(r => r.json());
      if (!res.success) return { ok: false, error: res.error || "Kaydedilemedi." };
      onKaizenChanged(res.data);
      return { ok: true };
    } catch {
      return { ok: false, error: "Sunucuya ulaşılamadı." };
    }
  };

  // The A3 project card (ci/CiProjectCard.tsx) — opened by id so it always shows the live record.
  const [cardProjectId, setCardProjectId] = useState<string | null>(null);
  const cardProject = cardProjectId ? kaizens.find(k => k.id === cardProjectId) || null : null;
  const handleOpenProjectDetails = (proj: KaizenCard) => setCardProjectId(proj.id);
  const handleOpenProjectFullScreen = handleOpenProjectDetails;

  // Open actions assigned to the signed-in user (badge on the Görevlerim tab).
  const myOpenTaskCount = kaizens
    .filter(k => !k.holdState && !isClosed(k))
    .flatMap(k => k.tasks || [])
    .filter((t: any) => !isTaskFinished(t) && (t.responsibleId ? t.responsibleId === currentUser?.id
      : !!currentUser?.full_name && personKey(t.responsible) === personKey(currentUser.full_name))).length;

  // Lifecycle action on the server (submit / approve / return / …), then refresh the app's copy and
  // the linked Master Plan row.
  const runStageAction = async (project: KaizenCard, action: CiStageAction, note?: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/business/kaizens/${project.id}/stage`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "x-factory-id": selectedCustomer?.id || "" },
        body: JSON.stringify({ action, note })
      }).then(r => r.json());
      if (!res.success) return { ok: false, error: res.error || "İşlem yapılamadı." };
      onKaizenChanged(res.data);
      syncWithGantt(res.data, 'update');
      return { ok: true };
    } catch {
      return { ok: false, error: "Sunucuya ulaşılamadı." };
    }
  };

  // Prefill the Before-After Kaizen form from what's already on the CI card, so the consultant only
  // has to fill in what the form actually needs beyond that (category/area, benefit breakdown).
  // Action the before-after form was opened from (A3 step 6); the new study is linked to it.
  const [baTaskId, setBaTaskId] = useState<string | null>(null);
  const handleOpenBeforeAfterModal = (proj: KaizenCard, taskId?: string) => {
    setEditingProject(proj);
    setBaTaskId(taskId || null);
    const task = taskId ? (proj.tasks || []).find((t: any) => t.id === taskId) : null;
    setBaSubject(task?.name || proj.title || "");
    setBaTarget(proj.targetObjective || "");
    setBaDoneBy(proj.projectLeader || proj.originator || "");
    setBaDepartment(proj.department || "");
    setBaDate(new Date().toISOString().split("T")[0]);
    setBaCategory("Verimlilik");
    setBaArea("5S");
    setBaBeforeImage(proj.problemPhotos?.[0] || "");
    setBaAfterImage(proj.resultPhotos?.[0] || "");
    setBaDescBefore(proj.problemDefinition || proj.descriptionBefore || "");
    setBaDescAfter(proj.descriptionAfter || proj.resultDescription || "");
    setBaBenefitDesc(
      proj.actualSavings
        ? `Gerçekleşen tasarruf: ${currency}${proj.actualSavings.toLocaleString("tr-TR")}`
        : ""
    );
    setBaBenefits({});
    setIsBeforeAfterModalOpen(true);
  };

  // Persists the new study onto the LIVE project (read from `kaizens`, not the possibly-stale
  // `editingProject` snapshot — same pattern handleAddTask/handleToggleTaskProgress already use so
  // this doesn't get clobbered by an unrelated unsaved edit sitting in the detail-modal form), then
  // triggers the real Excel download. This is also what makes it show up in "bir liste olarak
  // saklansın": beforeAfterStudies is a genuine persisted array field, not a one-off local action.
  const handleGenerateBeforeAfterStudy = () => {
    if (!editingProject || !baSubject.trim()) return;
    const liveProject = kaizens.find(k => k.id === editingProject.id) || editingProject;

    const newStudy: BeforeAfterKaizenStudy = {
      id: `ba_${Math.random().toString(36).substring(2, 9)}`,
      date: baDate || new Date().toISOString().split("T")[0],
      subject: baSubject.trim(),
      target: baTarget.trim(),
      doneBy: baDoneBy.trim(),
      department: baDepartment.trim(),
      category: baCategory,
      area: baArea,
      beforeImage: baBeforeImage,
      afterImage: baAfterImage,
      descriptionBefore: baDescBefore.trim(),
      descriptionAfter: baDescAfter.trim(),
      benefitDescription: baBenefitDesc.trim(),
      benefits: baBenefits,
      createdAt: new Date().toISOString()
    };

    // Only the changed fields are sent, so unrelated unsaved edits elsewhere aren't overwritten.
    const changes: Partial<KaizenCard> & { id: string } = {
      id: liveProject.id,
      beforeAfterStudies: [...(liveProject.beforeAfterStudies || []), newStudy]
    };
    if (baTaskId && (liveProject.tasks || []).some((t: any) => t.id === baTaskId)) {
      changes.tasks = (liveProject.tasks || []).map((t: any) =>
        t.id === baTaskId ? { ...t, beforeAfterIds: [...(t.beforeAfterIds || []), newStudy.id] } : t);
    }
    onUpdateKaizen(changes);
    setEditingProject({ ...liveProject, ...changes });
    setBaTaskId(null);

    exportBeforeAfterKaizenToExcel(newStudy, selectedCustomer?.companyName, currency);
    setIsBeforeAfterModalOpen(false);
  };

  const handleDeleteBeforeAfterStudy = (studyId: string, projectId?: string) => {
    const targetId = projectId || editingProject?.id;
    if (!targetId) return;
    const liveProject = kaizens.find(k => k.id === targetId);
    if (!liveProject) return;
    if (!window.confirm("Bu önce-sonra kaydı silinsin mi?")) return;
    // Also drop the study from the actions linked to it; only these two fields are sent.
    const changes: Partial<KaizenCard> & { id: string } = {
      id: liveProject.id,
      beforeAfterStudies: (liveProject.beforeAfterStudies || []).filter(s => s.id !== studyId)
    };
    if ((liveProject.tasks || []).some((t: any) => (t.beforeAfterIds || []).includes(studyId))) {
      changes.tasks = (liveProject.tasks || []).map((t: any) => ({ ...t, beforeAfterIds: (t.beforeAfterIds || []).filter((x: string) => x !== studyId) }));
    }
    onUpdateKaizen(changes);
    if (editingProject?.id === targetId) setEditingProject({ ...liveProject, ...changes });
  };

  // Excel exports live in ci/ciExcelExport.ts; these wrappers supply the project number.
  const exportKaizenCardToExcel = (proj: KaizenCard, customerName?: string, currencySymbol: string = "₺") =>
    exportCiProjectCardExcel(proj, getProjectNo(proj), customerName, currencySymbol);
  const exportBeforeAfterKaizenToExcel = exportCiBeforeAfterExcel;

  // Portfolio-wide export — previously only a single project's card could be exported
  // (exportKaizenCardToExcel above); the whole CI portfolio had no export at all despite
  // jspdf/xlsx already being used elsewhere in this app for exactly this kind of report.
  const handleExportPortfolioExcel = () => {
    const summaryData = [
      ["CI Proje Yönetimi Portföy Raporu", selectedCustomer?.companyName || ""],
      ["Rapor Tarihi", new Date().toLocaleDateString("tr-TR")],
      [],
      ["KPI", "Değer"],
      ["Toplam Proje", totalCIProjects],
      ["Tamamlanan", completedProjects],
      ["Beklenen Finansal Kazanç", totalExpectedFinancialGain],
      ["Gerçekleşen Kazanım", realizedFinancialGain]
    ];

    const projectHeaders = ["Proje No", "Başlık", "Departman", "Lider", "Ekip", "Faz", "Durum", "Kanban", "Termin", `Tahmini Bütçe (${currency})`, `Gerçekleşen (${currency})`, "Kök Neden", "Opportunity Type"];
    const projectRows = [...filteredProjects]
      .sort((a, b) => getProjectNo(a).localeCompare(getProjectNo(b), undefined, { numeric: true, sensitivity: 'base' }))
      .map(proj => [
        getProjectNo(proj), proj.title, proj.department, proj.projectLeader || proj.originator,
        (proj.projectTeam || []).join(", "), proj.phase, proj.status, proj.kanbanStatus,
        proj.plannedFinishDate, proj.estimatedCost || 0, proj.actualSavings || 0,
        rootCauseOf(proj), proj.opportunityType || ""
      ]);
    const projectSheetData = [["CI Proje Portföyü"], [], projectHeaders, ...projectRows];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Ozet");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projectSheetData), "Proje_Portfoyu");
    XLSX.writeFile(wb, `CI_Portfoy_Raporu_${(selectedCustomer?.companyName || "musteri").replace(/\s+/g, "_")}.xlsx`);
  };

  // jsPDF's standard "Helvetica" font only supports WinAnsi/Latin-1 — İ, ı, Ş, ş, Ğ, ğ aren't in
  // that set and render as garbled digits/symbols (Ç/ç/Ö/ö/Ü/ü are fine, they're valid Latin-1).
  // Transliterate just those five letters rather than embedding a custom Unicode font.
  const pdfSafe = (s: unknown): string => String(s ?? "")
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g");

  const handleExportPortfolioPdf = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica");

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(pdfSafe("CI PROJE YÖNETİMİ PORTFÖY RAPORU"), 14, 15);
    doc.setFontSize(9);
    doc.text(pdfSafe(`${selectedCustomer?.companyName || ""} | ${new Date().toLocaleDateString("tr-TR")}`), 14, 23);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text(pdfSafe("GENEL ÖZET"), 14, 42);
    autoTable(doc, {
      body: [
        [pdfSafe("Toplam Proje"), String(totalCIProjects), pdfSafe("Tamamlanan"), String(completedProjects)],
        [pdfSafe("Beklenen Kazanç"), `${currency} ${totalExpectedFinancialGain.toLocaleString("tr-TR")}`, pdfSafe("Gerçekleşen Kazanım"), `${currency} ${realizedFinancialGain.toLocaleString("tr-TR")}`]
      ],
      startY: 46,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [240, 240, 240] }, 2: { fontStyle: "bold", fillColor: [240, 240, 240] } }
    });

    doc.text(pdfSafe("PROJE PORTFÖYÜ"), 14, (doc as any).lastAutoTable.finalY + 10);
    autoTable(doc, {
      head: [[pdfSafe("No"), pdfSafe("Başlık"), pdfSafe("Lider"), pdfSafe("Durum"), pdfSafe(`Bütçe (${currency})`), pdfSafe(`Gerçekleşen (${currency})`)]],
      body: [...filteredProjects]
        .sort((a, b) => getProjectNo(a).localeCompare(getProjectNo(b), undefined, { numeric: true, sensitivity: 'base' }))
        .map(proj => [
          pdfSafe(getProjectNo(proj)), pdfSafe(proj.title), pdfSafe(proj.projectLeader || proj.originator || "-"), pdfSafe(proj.kanbanStatus || proj.status),
          (proj.estimatedCost || 0).toLocaleString("tr-TR"), (proj.actualSavings || 0).toLocaleString("tr-TR")
        ]),
      startY: (doc as any).lastAutoTable.finalY + 14,
      theme: "striped",
      styles: { fontSize: 7.5 }
    });

    doc.save(`CI_Portfoy_Raporu_${(selectedCustomer?.companyName || "musteri").replace(/\s+/g, "_")}.pdf`);
  };

  // Kanban drop: projects move one A3 step at a time (utils/ciLifecycle.ts). Dropping a card on the
  // next PDCA column finishes the step that leads into it (submit, or approve when the caller is the
  // approver); any other move is refused with the reason. Older projects without a stage are moved
  // by the same rule from their derived step.
  const handleKanbanStatusChange = async (project: KaizenCard, newKanbanStatus: KaizenCard["kanbanStatus"]) => {
    const stage = stageOf(project);
    const targetStage = ({ PLAN: 1, DO: 6, CHECK: 7, ACT: 8 } as Record<string, number>)[newKanbanStatus || "PLAN"];
    if (pdcaOfStage(stage) === newKanbanStatus || isClosed(project)) return;
    if (targetStage !== stage + 1) {
      alert(`Projeler A3 adımlarıyla tek tek ilerler. "${project.title}" şu an Adım ${stage} (${CI_STEPS[stage - 1].title}); kartı açıp adımı tamamlayın.`);
      return;
    }
    const missing = stageRequirements(project, stage);
    if (missing.length) {
      alert(`Adım ${stage} tamamlanamaz, eksikler:\n• ${missing.join("\n• ")}`);
      return;
    }
    const r = await runStageAction(project, canApproveStage(currentUser, project) ? "approve" : "submit");
    if (!r.ok) alert(r.error);
  };

  const handleDrop = (newKanbanStatus: KaizenCard["kanbanStatus"]) => {
    if (!draggedProjId) return;
    const project = kaizens.find(k => k.id === draggedProjId);
    if (project) {
      handleKanbanStatusChange(project, newKanbanStatus);
    }
    setDraggedProjId(null);
    setActiveDropCol(null);
  };

  const handleDeleteProject = async (id: string) => {
    if (window.confirm("Bu sürekli iyileştirme projesini kalıcı olarak silmek istediğinizden emin misiniz?")) {
      const proj = kaizens.find(k => k.id === id);
      // Remove the linked Master Plan row only once the server has actually deleted the project.
      if ((await onDeleteKaizen(id)) && proj) {
        syncWithGantt(proj, 'delete');
      }
    }
  };

  // Project Task Operations
  const handleAddTask = (projId: string) => {
    if (!newTaskName) return;
    const proj = kaizens.find(k => k.id === projId);
    if (!proj) return;

    const updatedTasks = [...(proj.tasks || [])];
    updatedTasks.push({
      id: `tsk_${Math.random().toString(36).substring(2, 5)}`,
      name: newTaskName,
      responsible: newTaskResponsible,
      deadline: newTaskDeadline || proj.plannedFinishDate || "",
      priority: newTaskPriority,
      progressPercent: 0
    });

    const updated = {
      ...proj,
      tasks: updatedTasks
    };

    onUpdateKaizen(updated);
    syncWithGantt(updated, 'update');
    
    // reset form
    setNewTaskName("");
    setNewTaskDeadline("");
  };

  const handleToggleTaskProgress = (projId: string, taskId: string) => {
    const proj = kaizens.find(k => k.id === projId);
    if (!proj) return;

    const updatedTasks = (proj.tasks || []).map((t: any) => {
      if (t.id === taskId) {
        return { ...t, progressPercent: t.progressPercent === 100 ? 0 : 100 };
      }
      return t;
    });

    const updated = {
      ...proj,
      tasks: updatedTasks
    };

    onUpdateKaizen(updated);
    syncWithGantt(updated, 'update');
  };

  const handleDeleteTask = (projId: string, taskId: string) => {
    const proj = kaizens.find(k => k.id === projId);
    if (!proj) return;

    const updated = {
      ...proj,
      tasks: (proj.tasks || []).filter((t: any) => t.id !== taskId)
    };

    onUpdateKaizen(updated);
    syncWithGantt(updated, 'update');
  };

  // Financial Results Save
  // 17-line realized gain breakdown (ci/CiGainBreakdown.tsx).
  const handleOpenFinancials = (proj: KaizenCard) => setEditingFinancialsProjId(proj.id);
  const financialsProject = editingFinancialsProjId ? kaizens.find(k => k.id === editingFinancialsProjId) || null : null;

  // Helper calculation for overall Portföy metrics
  const filteredProjects = kaizens.filter(k => {
    const matchesDept = selectedDeptFilter === "all" || k.department === selectedDeptFilter;
    // Grouped by phase number: stored labels differ by era ("Faz 1 (1 Ay)", "Phase 1: Quick Win").
    const matchesPhase = selectedPhaseFilter === "all" || phaseNumber(k.phase) === Number(selectedPhaseFilter);
    return matchesDept && matchesPhase;
  });

  const totalCIProjects = filteredProjects.length;

  // Flat, portfolio-wide gallery of every saved Önce-Sonra (Before-After) study across all CI
  // projects — previously these were only visible one-by-one inside each project's own detail
  // modal (Section 9), with no way to browse them all in one place.
  const allBeforeAfterStudies = filteredProjects
    .flatMap(k => (k.beforeAfterStudies || []).map(s => ({ study: s, projectId: k.id, projectTitle: k.title })))
    .sort((a, b) => (b.study.date || "").localeCompare(a.study.date || ""));
  const completedProjects = filteredProjects.filter(k => k.status === "Completed" || k.kanbanStatus === "ACT").length;
  

  // Money totals only add amounts in the customer's currency (see ci/ciMoney.ts); projects in
  // another currency are counted in `*.excluded` and named under the figure.
  // Expected gain: the project's own figure; a project created from an opportunity that has no
  // figure yet falls back to that opportunity's estimate (customer currency). No invented values.
  const expectedSum = sumExpected(filteredProjects, currency, ciSettings.fxRates);
  const totalExpectedFinancialGain = expectedSum.total + filteredProjects
    .filter(k => !((k.expectedGain || 0) > 0) && !((k.targetCostReduction || 0) > 0))
    .reduce((sum, k) => sum + (opportunityGain(k) || 0), 0);

  const realizedSum = sumRealized(filteredProjects, currency, ciSettings.fxRates);
  const realizedFinancialGain = realizedSum.total;
  

















  return (
    <div className="space-y-6">

      {/* Shared autocomplete source for all team/assignee text inputs — real consultants/customer
          users from this customer's team, with free text still allowed (e.g. floor staff not in
          the system). Datalist just needs to exist once in the DOM; every input references it by id. */}
      <datalist id="ci-departments">
        {ciSettings.departments.map(d => <option key={d} value={d} />)}
      </datalist>
      <datalist id="ci-team-directory">
        {teamOptions.map(member => (
          <option key={member} value={member} />
        ))}
      </datalist>

      {/* FLOATING TOAST FOR MANUAL REMINDER LOGGING (no real email is sent) */}
      {emailStatusMessage && (
        <div className="bg-emerald-600 text-white p-4 rounded-xl shadow-md flex items-center justify-between transition-all duration-300 animate-pulse">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-white" />
            <span className="text-xs font-bold">{emailStatusMessage}</span>
          </div>
          <button onClick={() => setEmailStatusMessage(null)} className="text-white hover:text-emerald-100 font-bold text-sm">✕</button>
        </div>
      )}

      {/* Header + tabs (Kaizen module design). The old 10-card KPI strip, financial row and alert
          panel were replaced by the Genel Bakış tab (plan step C7). */}
      <PageHeader
        title="CI Proje Yönetimi"
        subtitle={`${selectedCustomer?.companyName ? `${selectedCustomer.companyName} · ` : ""}Sürekli iyileştirme projeleri — Toyota 8 adım A3`}
        actions={<>
          <Button variant="outline" onClick={handleExportPortfolioExcel} title="Portföyü Excel olarak indir"><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Button variant="outline" onClick={handleExportPortfolioPdf} title="Portföyü PDF olarak indir"><FileText className="w-4 h-4" /> PDF</Button>
          <Button variant="brand" onClick={() => setIsWizardOpen(true)}><Plus className="w-4 h-4" /> Yeni CI projesi</Button>
        </>}
      />

      <TabBar<TabType>
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: "overview", label: "Genel Bakış", icon: LayoutDashboard },
          { key: "kanban", label: "Kanban (PDCA)", icon: Columns3 },
          { key: "list", label: "Liste", icon: List },
          { key: "timeline", label: "Zaman Çizelgesi", icon: CalendarRange },
          { key: "mytasks", label: "Görevlerim", icon: ListChecks, count: myOpenTaskCount },
          { key: "dashboard", label: "Finans", icon: BarChart3 },
          { key: "beforeafter", label: "Önce-Sonra", icon: Images },
          ...(isCiStaff ? [{ key: "settings" as TabType, label: "Ayarlar", icon: Settings }] : [])
        ]}
      />

      {activeTab !== "mytasks" && activeTab !== "settings" && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={selectedDeptFilter} onChange={(e) => setSelectedDeptFilter(e.target.value)} aria-label="Departman"
            className="h-10 px-3 rounded-xl bg-white ring-1 ring-inset ring-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/40">
            <option value="all">Tüm departmanlar</option>
            {Array.from(new Set(kaizens.map(k => k.department).filter(Boolean))).map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <select value={selectedPhaseFilter} onChange={(e) => setSelectedPhaseFilter(e.target.value)} aria-label="Faz"
            className="h-10 px-3 rounded-xl bg-white ring-1 ring-inset ring-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/40">
            <option value="all">Tüm fazlar</option>
            {ciSettings.phases.map(label => (
              <option key={label} value={String(phaseNumber(label))}>{label}</option>
            ))}
          </select>
          {(selectedDeptFilter !== "all" || selectedPhaseFilter !== "all") && (
            <button type="button" onClick={() => { setSelectedDeptFilter("all"); setSelectedPhaseFilter("all"); }}
              className="h-10 px-3 text-sm font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">Filtreyi temizle</button>
          )}
          <span className="text-sm text-slate-500 ml-auto">{filteredProjects.length} / {kaizens.length} proje</span>
        </div>
      )}

      {activeTab === "overview" && (
        <CiOverview
          projects={filteredProjects}
          currentUser={currentUser}
          currencySymbol={currency}
          fxRates={ciSettings.fxRates}
          projectNo={getProjectNo}
          onOpenProject={handleOpenProjectDetails}
          onShowFinance={() => setActiveTab("dashboard")}
        />
      )}

      {/* VIEW PANEL RENDERINGS */}

      {/* 1. KANBAN (PDCA) VIEW */}
      {activeTab === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {(["PLAN", "DO", "CHECK", "ACT"] as const).map(colStatus => {
            const list = filteredProjects.filter(k => {
              if (colStatus === "PLAN") return k.kanbanStatus === "PLAN" || !k.kanbanStatus || k.status === "Draft";
              if (colStatus === "DO") return k.kanbanStatus === "DO" || (k.status === "In Progress" && !k.kanbanStatus);
              return k.kanbanStatus === colStatus;
            });

            const columnMeta = {
              "PLAN": { title: "PLAN (Planlama / Taslak)", color: "border-t-slate-400 bg-slate-50/50" },
              "DO": { title: "DO (Uygulama / Geliştirme)", color: "border-t-blue-500 bg-blue-50/10" },
              "CHECK": { title: "CHECK (Kontrol / Doğrulama)", color: "border-t-amber-500 bg-amber-50/10" },
              "ACT": { title: "ACT (Standartlaştırma / Kapat)", color: "border-t-emerald-500 bg-emerald-50/10" }
            };

            const isCurrentDropCol = activeDropCol === colStatus;

            return (
              <div 
                key={colStatus} 
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDragEnter={() => setActiveDropCol(colStatus)}
                onDragLeave={() => {
                  // Keep it highlighted as long as mouse is in area
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(colStatus);
                }}
                className={`bg-slate-50/50 border rounded-2xl p-3.5 space-y-3.5 border-t-4 transition-all duration-200 ${
                  isCurrentDropCol 
                    ? "border-indigo-400 bg-indigo-50/30 ring-2 ring-indigo-200/50 shadow-xs scale-[1.01]" 
                    : "border-slate-200"
                } ${columnMeta[colStatus].color}`}
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="font-bold text-xs text-slate-800 tracking-tight uppercase">
                    {columnMeta[colStatus].title}
                  </span>
                  <span className="bg-slate-200 text-slate-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg">
                    {list.length}
                  </span>
                </div>

                <div className="space-y-3 min-h-[300px]">
                  {list.length === 0 ? (
                    <div className="text-slate-400 text-center py-12 text-[11px] italic">Sürükleyip bırakarak bu aşamaya proje ekleyin.</div>
                  ) : (
                    list.map(proj => {
                      const expected = expectedOf(proj);
                      const realized = proj.actualSavings || 0;
                      const hasTasks = proj.tasks && proj.tasks.length > 0;
                      const completedTasks = hasTasks ? proj.tasks?.filter((t: any) => t.progressPercent === 100).length : 0;
                      const progressPct = hasTasks ? Math.round((completedTasks! / proj.tasks!.length) * 100) : 0;

                      const isOverdue = proj.status !== "Completed" && proj.plannedFinishDate && (new Date(proj.plannedFinishDate) < new Date());
                      const delayWeeks = isOverdue ? getDelayWeeksSinceDeadline(proj.plannedFinishDate) : 0;

                      return (
                        <div 
                          key={proj.id} 
                          draggable
                          onDragStart={(e) => {
                            setDraggedProjId(proj.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggedProjId(null);
                            setActiveDropCol(null);
                          }}
                          className={`bg-white border rounded-xl p-3.5 space-y-3.5 shadow-3xs hover:shadow-2xs transition-all relative cursor-grab active:cursor-grabbing ${
                            draggedProjId === proj.id ? "opacity-35 border-dashed scale-95" : ""
                          } ${
                            isOverdue ? "border-rose-350 ring-1 ring-rose-200" : "border-slate-150"
                          }`}
                        >
                          
                          {/* Phase tag, A3 step & Edit button */}
                          <div className="flex flex-wrap gap-1.5 justify-between items-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                              phaseNumber(proj.phase) === 1 ? "bg-emerald-100 text-emerald-800" :
                              phaseNumber(proj.phase) === 2 ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                            }`}>
                              {proj.phase || defaultPhase}
                            </span>
                            <StageBadge project={proj} />
                            {proj.pendingApproval && <span className="text-[10px] font-bold text-violet-700" title="Proje liderinin onayını bekliyor">● onay</span>}
                            
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase flex items-center gap-0.5" title="Sürüklemek için basılı tutun">
                                <GripVertical className="w-3 h-3 text-slate-300" />
                                <span>{getProjectNo(proj)}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => exportKaizenCardToExcel(proj, selectedCustomer?.companyName, currency)}
                                className="text-slate-400 hover:text-emerald-600 p-0.5 rounded hover:bg-slate-100 transition-all cursor-pointer"
                                title="CI Kartını Excel (XLS) Olarak İndir"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenProjectFullScreen(proj)}
                                className="text-slate-400 hover:text-emerald-600 p-0.5 rounded hover:bg-slate-100 transition-all cursor-pointer"
                                title="Tam Ekranda Yönet"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenProjectDetails(proj)}
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-100 transition-all cursor-pointer"
                                title="Projeyi Düzenle"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              {isCiStaff && <button
                                type="button"
                                onClick={() => handleDeleteProject(proj.id)}
                                className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-slate-100 transition-all cursor-pointer"
                                title="Projeyi Sil"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>}
                            </div>
                          </div>

                          {/* Overdue alert badge on card */}
                          {isOverdue && (
                            <div className="bg-red-50 border border-red-100 rounded-lg p-1.5 flex items-center justify-between text-[11px] text-red-700 font-medium">
                              <span className="flex items-center space-x-1">
                                <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />
                                <span>{delayWeeks} Hafta Gecikme</span>
                              </span>
                              <div className="flex items-center space-x-1">
                                <button 
                                  type="button"
                                  onClick={() => logManualReminder(proj)}
                                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-1.5 py-0.5 rounded text-[11px] flex items-center space-x-0.5 transition-all cursor-pointer"
                                  title="Hatırlatma Kaydı Oluştur (e-posta gönderilmez)"
                                >
                                  <span>📌 Hatırlat</span>
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => exportKaizenCardToExcel(proj, selectedCustomer?.companyName, currency)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded text-[11px] flex items-center justify-center transition-all cursor-pointer"
                                  title="CI Kartını Excel (XLS) Olarak İndir"
                                >
                                  <FileSpreadsheet className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Title & Desc (Clickable to Edit) */}
                          <div className="space-y-1 cursor-pointer group" onClick={() => handleOpenProjectDetails(proj)}>
                            <h4 className="font-bold text-sm text-slate-900 tracking-tight leading-snug line-clamp-2 group-hover:text-indigo-600 transition-all">
                              {proj.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {proj.description || proj.descriptionBefore}
                            </p>
                          </div>

                          {/* Leader & Team */}
                          <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-bold text-slate-700">{proj.projectLeader || proj.originator}</span>
                          </div>

                          {/* Sub-tasks Progress */}
                          {hasTasks && (
                            <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <div className="flex justify-between text-[11px] text-slate-500">
                                <span>Alt Görevler ({completedTasks}/{proj.tasks?.length})</span>
                                <span className="font-bold text-slate-700">{progressPct}%</span>
                              </div>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full transition-all" style={{ width: `${progressPct}%` }}></div>
                              </div>
                            </div>
                          )}

                          {/* Financial summary */}
                          <div className="flex justify-between items-center text-[10px] bg-slate-50/50 p-2 rounded-lg border border-slate-100 font-mono">
                            <div>
                              <span className="text-[11px] text-slate-400 block uppercase">Planlanan</span>
                              <span className="font-bold text-slate-700">{currency}{expected.toLocaleString("tr-TR")}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] text-slate-400 block uppercase">Gerçekleşen</span>
                              <span className="font-bold text-emerald-600">{currency}{realized.toLocaleString("tr-TR")}</span>
                            </div>
                          </div>

                          {/* Actions Footer */}
                          <div className="flex justify-between items-center border-t border-slate-100 pt-2.5 text-[10px]">
                            
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleOpenFinancials(proj)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer flex items-center space-x-0.5"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>Finansallar</span>
                              </button>

                              <button
                                onClick={() => setActiveTasksProjId(activeTasksProjId === proj.id ? null : proj.id)}
                                className="text-slate-600 hover:text-slate-800 font-bold hover:underline cursor-pointer"
                              >
                                Görevler ({proj.tasks?.length || 0})
                              </button>
                            </div>

                            <div className="flex items-center space-x-1 bg-slate-50 text-slate-400 border border-slate-200/50 px-2 py-0.5 rounded-md text-[11px] font-medium select-none">
                              <GripVertical className="w-2.5 h-2.5" />
                              <span>Sürükle</span>
                            </div>
                          </div>

                          {/* Inner task expanded panel */}
                          {activeTasksProjId === proj.id && (
                            <div className="border-t border-slate-200 pt-3 mt-3 space-y-2.5 bg-slate-50/50 p-2.5 rounded-xl">
                              <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                                <span>Aksiyon & Görev Yönetimi</span>
                                <button onClick={() => setActiveTasksProjId(null)} className="text-slate-400">✕</button>
                              </div>

                              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                                {(proj.tasks || []).map((t: any) => (
                                  <div key={t.id} className="flex justify-between items-center bg-white p-2 border border-slate-150 rounded-lg text-[10px]">
                                    <div className="flex items-center space-x-2">
                                      <input 
                                        type="checkbox" 
                                        checked={t.progressPercent === 100}
                                        onChange={() => handleToggleTaskProgress(proj.id, t.id)}
                                        className="rounded text-indigo-600"
                                      />
                                      <span className={t.progressPercent === 100 ? "line-through text-slate-400" : "text-slate-700 font-medium"}>
                                        {t.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-[11px] text-slate-400">{t.responsible.split(" ")[0]}</span>
                                      <button onClick={() => handleDeleteTask(proj.id, t.id)} className="text-slate-400 hover:text-red-500">✕</button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Task Add Form */}
                              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                                <input 
                                  type="text"
                                  placeholder="Yeni görev adı..."
                                  value={newTaskName}
                                  onChange={(e) => setNewTaskName(e.target.value)}
                                  className="w-full text-[10px] bg-white border border-slate-200 rounded p-1.5"
                                />
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input
                                    type="text"
                                    list="ci-team-directory"
                                    value={newTaskResponsible}
                                    onChange={(e) => setNewTaskResponsible(e.target.value)}
                                    placeholder="Sorumlu seçin veya yazın"
                                    className="text-[11px] bg-white border border-slate-200 rounded p-1"
                                  />
                                  <button
                                    onClick={() => handleAddTask(proj.id)}
                                    className="bg-indigo-600 text-white font-bold text-[11px] py-1 rounded"
                                  >
                                    Ekle
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

        </div>
      )}

      {/* 2. LIST VIEW */}
      {activeTab === "list" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden text-xs">
          {/* Mobile card fallback (below md) — the full table below is desktop-only (overflow-x-auto
              alone isn't usable on a phone for a 9-column table). Same data, condensed per project. */}
          <div className="md:hidden divide-y divide-slate-100">
            {[...filteredProjects]
              .sort((a, b) => getProjectNo(a).localeCompare(getProjectNo(b), undefined, { numeric: true, sensitivity: 'base' }))
              .map(proj => {
                const expected = expectedOf(proj);
                const realized = proj.actualSavings || 0;
                const successPct = expected > 0 ? Math.round((realized / expected) * 100) : 0;
                const isOverdue = proj.status !== "Completed" && proj.plannedFinishDate && (new Date(proj.plannedFinishDate) < new Date());
                const delayWeeks = isOverdue ? getDelayWeeksSinceDeadline(proj.plannedFinishDate) : 0;

                return (
                  <div key={proj.id} className="p-3.5 space-y-2" onClick={() => handleOpenProjectDetails(proj)}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono font-bold text-indigo-950">{getProjectNo(proj)}</div>
                        <div className="font-bold text-slate-900 text-[13px] leading-snug flex items-center gap-1.5 flex-wrap">
                          <span>{proj.title}</span>
                          {isOverdue && (
                            <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                              {delayWeeks}H Gecikme
                            </span>
                          )}
                        </div>
                      </div>
                      <select
                        value={proj.kanbanStatus || "PLAN"}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleKanbanStatusChange(proj, e.target.value as any)}
                        className="bg-white border border-slate-200 rounded px-1.5 py-1 text-[10px] font-bold text-slate-700 shrink-0"
                      >
                        <option value="PLAN">PLAN</option>
                        <option value="DO">DO</option>
                        <option value="CHECK">CHECK</option>
                        <option value="ACT">ACT</option>
                      </select>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {proj.projectLeader || proj.originator} • {proj.department}
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-600">Bütçe: {currency}{(proj.estimatedCost || 0).toLocaleString("tr-TR")}</span>
                      <span className="font-mono font-bold text-emerald-600">Gerçekleşen: {currency}{realized.toLocaleString("tr-TR")}</span>
                      <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                        successPct >= 100 ? "bg-emerald-100 text-emerald-800" :
                        successPct > 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        %{successPct}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => exportKaizenCardToExcel(proj, selectedCustomer?.companyName, currency)} className="p-1.5 text-emerald-600" title="Excel İndir">
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleOpenFinancials(proj)} className="p-1.5 text-indigo-600" title="Finansal Kayıt">
                        <DollarSign className="w-4 h-4" />
                      </button>
                      {isCiStaff && <button onClick={() => handleDeleteProject(proj.id)} className="p-1.5 text-red-500" title="Sil">
                        <Trash2 className="w-4 h-4" />
                      </button>}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Proje No</th>
                  <th className="py-3 px-4">Proje Tanımı (CI Project)</th>
                  <th className="py-3 px-4">Lider / Sponsor</th>
                  <th className="py-3 px-4">Faz / Önem</th>
                  <th className="py-3 px-4 text-right">Tahmini Bütçe</th>
                  <th className="py-3 px-4 text-right">Gerçekleşen Tasarruf</th>
                  <th className="py-3 px-4 text-center">Başarı %</th>
                  <th className="py-3 px-4">Aşama</th>
                  <th className="py-3 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                {[...filteredProjects]
                  .sort((a, b) => getProjectNo(a).localeCompare(getProjectNo(b), undefined, { numeric: true, sensitivity: 'base' }))
                  .map(proj => {
                    const expected = expectedOf(proj);
                    const realized = proj.actualSavings || 0;
                    const successPct = expected > 0 ? Math.round((realized / expected) * 100) : 0;

                    const isOverdue = proj.status !== "Completed" && proj.plannedFinishDate && (new Date(proj.plannedFinishDate) < new Date());
                    const delayWeeks = isOverdue ? getDelayWeeksSinceDeadline(proj.plannedFinishDate) : 0;

                    return (
                      <tr key={proj.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-950">
                          {getProjectNo(proj)}
                        </td>
                        <td 
                          onClick={() => handleOpenProjectDetails(proj)}
                          className="py-3 px-4 font-semibold text-slate-900 max-w-[250px] cursor-pointer group"
                        >
                        <div className="font-bold text-[13px] group-hover:text-indigo-600 transition-colors flex items-center gap-1.5 flex-wrap">
                          <span>{proj.title}</span>
                          {isOverdue && (
                            <span className="bg-red-100 text-red-800 text-[11px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                              {delayWeeks}H Gecikme
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Departman: {proj.department} | Başlangıç: {proj.dateProposed}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{proj.projectLeader || proj.originator}</div>
                        <div className="text-[10px] text-slate-400">Sponsor: {proj.projectSponsor || "Atanmamış"}</div>
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                          phaseNumber(proj.phase) === 1 ? "bg-emerald-100 text-emerald-800" :
                          phaseNumber(proj.phase) === 2 ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {`Faz ${phaseNumber(proj.phase)}`}
                        </span>
                        <div><StageBadge project={proj} /></div>
                        <div>
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[11px] font-bold ${
                            proj.impactLevel === "High" ? "bg-rose-100 text-rose-800" :
                            proj.impactLevel === "Medium" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                          }`}>
                            {proj.impactLevel} Impact
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                        {currency}{(proj.estimatedCost || 0).toLocaleString("tr-TR")}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {currency}{realized.toLocaleString("tr-TR")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                          successPct >= 100 ? "bg-emerald-100 text-emerald-800" :
                          successPct > 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          %{successPct}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={proj.kanbanStatus || "PLAN"}
                          onChange={(e) => handleKanbanStatusChange(proj, e.target.value as any)}
                          className="bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-bold text-slate-700"
                        >
                          <option value="PLAN">PLAN</option>
                          <option value="DO">DO</option>
                          <option value="CHECK">CHECK</option>
                          <option value="ACT">ACT (Completed)</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button 
                          onClick={() => exportKaizenCardToExcel(proj, selectedCustomer?.companyName, currency)}
                          className="p-2 text-slate-400 hover:text-emerald-600 inline-block cursor-pointer"
                          title="CI Kartını Excel (XLS) Olarak İndir"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        </button>
                        <button 
                          onClick={() => handleOpenProjectDetails(proj)}
                          className="p-2 text-slate-400 hover:text-indigo-600 inline-block"
                          title="Kartı Aç & Detaylı Düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleOpenFinancials(proj)}
                          className="p-2 text-slate-400 hover:text-indigo-600 inline-block"
                          title="Finansal Kayıt Girişi"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        {isCiStaff && <button 
                          onClick={() => handleDeleteProject(proj.id)}
                          className="p-2 text-slate-400 hover:text-red-500 inline-block"
                          title="Projeyi Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TIMELINE (GANTT) VIEW — MASTER PLAN ENTEGRASYONU */}
      {activeTab === "timeline" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
          
          {/* Header & Control Bar */}
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 pb-3 border-b border-slate-150">
            <div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  CI Projeleri Master Plan Gantt Şeması & Aksiyon Takip Çizelgesi
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Planlanan ve gerçekleşen zaman dilimleri, plan sapmaları (kırmızı gösterim) ve 6. Uygulama Planı alt faaliyet takibi
              </p>
            </div>

            {/* Legend & Expand All Controls */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-blue-500 inline-block"></span>
                  <span className="text-slate-700">Planlanan Dönem</span>
                </span>
                <span className="flex items-center space-x-1 ml-2">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
                  <span className="text-slate-700">Gerçekleşen / Tamamlanan</span>
                </span>
                <span className="flex items-center space-x-1 ml-2">
                  <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
                  <span className="text-slate-700">Devam Eden</span>
                </span>
                <span className="flex items-center space-x-1 ml-2">
                  <span className="w-3 h-3 rounded bg-rose-600 inline-block"></span>
                  <span className="text-rose-700 font-black">Plan Sapması (Kırmızı)</span>
                </span>
              </div>

              {/* Expand / Collapse All Sub-Activities Button */}
              <button
                type="button"
                onClick={() => {
                  const allExpanded = filteredProjects.every(p => expandedProjectIds[p.id]);
                  const newMap: Record<string, boolean> = {};
                  filteredProjects.forEach(p => {
                    newMap[p.id] = !allExpanded;
                  });
                  setExpandedProjectIds(newMap);
                }}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              >
                {filteredProjects.every(p => expandedProjectIds[p.id]) ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Alt Faaliyetleri Daralt</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>Tüm Alt Faaliyetleri Göster ({filteredProjects.reduce((acc, p) => acc + (p.tasks?.length || 0), 0)})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mobile fallback (below md) — a 12-month Gantt grid genuinely doesn't fit a phone
              screen (industry-standard limitation, not something a responsive grid tweak fixes),
              so this shows the same projects as a simple stacked timeline list instead. */}
          <div className="md:hidden space-y-2">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-10 text-slate-400 italic">Zaman çizelgesi için kayıtlı proje bulunmamaktadır.</div>
            ) : (
              filteredProjects.map(proj => {
                const isCompleted = proj.status === "Completed" || proj.kanbanStatus === "ACT";
                const isOverdue = !isCompleted && proj.plannedFinishDate && (new Date(proj.plannedFinishDate) < new Date());
                return (
                  <div key={proj.id} className="border border-slate-200 rounded-xl p-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-slate-900 text-[12.5px] leading-snug">{proj.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        isCompleted ? "bg-emerald-100 text-emerald-800" :
                        isOverdue ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {isCompleted ? "Tamamlandı" : isOverdue ? "Gecikti" : "Devam Ediyor"}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Başlangıç: {proj.dateProposed || "-"} → Hedef Bitiş: {proj.plannedFinishDate || "-"}</span>
                    </div>
                    {(proj.tasks?.length || 0) > 0 && (
                      <div className="text-[10.5px] text-slate-400 mt-1">{proj.tasks!.length} alt faaliyet</div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block space-y-3 overflow-x-auto">
            {/* Gantt Header Grid */}
            <div className="grid grid-cols-12 gap-3 text-[10px] text-slate-500 font-bold pb-2 font-mono border-b border-slate-200 min-w-[850px]">
              <div className="col-span-4 pl-1">PROJE KONUSU & ALT FAALİYETLER (6 UYGULAMA PLANILARI)</div>
              <div className="col-span-8 grid grid-cols-12 text-center divide-x divide-slate-100 bg-slate-50/80 rounded-lg py-1 border border-slate-200">
                {["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"].map((m, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <span className="text-slate-800 font-bold">{m}</span>
                    <span className="text-[11px] text-slate-400 font-normal">2026</span>
                  </div>
                ))}
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="text-center py-10 text-slate-400 italic">Gantt grafiği için kayıtlı proje bulunmamaktadır.</div>
            ) : (
              filteredProjects.map(proj => {
                const isExpanded = !!expandedProjectIds[proj.id];
                const tasksList = proj.tasks || [];
                
                // Main project dates
                const pStart = Math.min(12, Math.max(1, Number(proj.dateProposed?.split("-")[1]) || 1));
                const pEnd = Math.min(12, Math.max(pStart, Number((proj.plannedFinishDate || proj.dateProposed)?.split("-")[1]) || 12));
                
                const isCompleted = proj.status === "Completed" || proj.kanbanStatus === "ACT";
                const isOverdue = !isCompleted && proj.plannedFinishDate && (new Date(proj.plannedFinishDate) < new Date());
                
                // Actual finish month (if completed or overdue)
                let aEnd = pEnd;
                if (isCompleted && proj.realizedFinishDate) {
                  aEnd = Math.min(12, Math.max(pStart, Number(proj.realizedFinishDate.split("-")[1]) || pEnd));
                } else if (isOverdue) {
                  const currentMonth = new Date().getMonth() + 1; // 1-12
                  aEnd = Math.max(pEnd + 1, currentMonth);
                }

                // Check deviation
                const hasDeviation = isOverdue || aEnd > pEnd;
                const delayWeeks = isOverdue ? getDelayWeeksSinceDeadline(proj.plannedFinishDate) : 0;

                return (
                  <div key={proj.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs min-w-[850px]">
                    
                    {/* MAIN PROJECT ROW */}
                    <div className="grid grid-cols-12 gap-3 items-center p-2.5 bg-slate-50/60 hover:bg-indigo-50/30 transition-colors border-b border-slate-100">
                      
                      {/* Left: Project Metadata */}
                      <div className="col-span-4 flex items-start space-x-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => setExpandedProjectIds(prev => ({ ...prev, [proj.id]: !prev[proj.id] }))}
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors mt-0.5 cursor-pointer shrink-0"
                          title="Alt faaliyetleri göster/gizle"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </button>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="bg-indigo-100 text-indigo-900 font-mono text-[11px] font-extrabold px-1.5 py-0.2 rounded border border-indigo-200">
                              {getProjectNo(proj)}
                            </span>
                            <span 
                              onClick={() => handleOpenProjectDetails(proj)}
                              className="font-bold text-slate-900 truncate hover:text-indigo-600 transition-colors cursor-pointer text-xs"
                              title={proj.title}
                            >
                              {proj.title}
                            </span>
                            {tasksList.length > 0 && (
                              <span className="bg-slate-200 text-slate-700 text-[11px] font-bold px-1.5 py-0.2 rounded-full font-mono">
                                {tasksList.length} Alt Faaliyet
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-2 flex-wrap">
                            <span>Sorumlu: <strong className="text-slate-700">{proj.projectLeader || proj.originator}</strong></span>
                            <span>• {proj.department}</span>
                            {hasDeviation && (
                              <span className="bg-rose-100 text-rose-700 font-extrabold px-1.5 py-0.2 rounded text-[11px] flex items-center gap-0.5 animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>{delayWeeks > 0 ? `${delayWeeks} Hafta Sapma` : 'Tarih Sapması (Gecikme)'}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Dual Track Gantt Bars (Planlanan vs Gerçekleşen & Kırmızı Sapma) */}
                      <div className="col-span-8 grid grid-cols-12 relative bg-slate-100/50 rounded-lg p-1 min-h-[44px] items-center">
                        
                        {/* Background Grid Lines */}
                        <div className="absolute inset-0 grid grid-cols-12 pointer-events-none divide-x divide-slate-200/50">
                          {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="h-full"></div>
                          ))}
                        </div>

                        {/* TRACK 1: PLANLANAN ZAMAN DİLİMİ (Blue Bar) */}
                        <div 
                          className="h-4 rounded bg-blue-500/90 hover:bg-blue-600 text-[11px] text-white font-bold flex items-center px-1.5 transition-all shadow-3xs z-10 my-0.5 border border-blue-400"
                          style={{ 
                            gridColumnStart: pStart,
                            gridColumnEnd: Math.min(13, pEnd + 1)
                          }}
                          title={`Planlanan Dönem: Ay ${pStart} - Ay ${pEnd}`}
                        >
                          <span className="truncate">Plan: Ay {pStart}-{pEnd}</span>
                        </div>

                        {/* TRACK 2: GERÇEKLEŞEN ZAMAN DİLİMİ (Status Color & Red Deviation Extension) */}
                        <div 
                          className={`h-4 rounded text-[11px] text-white font-bold flex items-center justify-between px-1.5 transition-all shadow-3xs z-10 my-0.5 ${
                            isCompleted ? "bg-emerald-500 border border-emerald-400" :
                            hasDeviation ? "bg-rose-600 border border-rose-500 animate-pulse" :
                            "bg-amber-500 border border-amber-400"
                          }`}
                          style={{ 
                            gridColumnStart: pStart,
                            gridColumnEnd: Math.min(13, (hasDeviation ? Math.max(pEnd + 1, aEnd + 1) : aEnd + 1))
                          }}
                          title={`Gerçekleşen / Mevcut Durum: ${isCompleted ? 'Tamamlandı' : hasDeviation ? 'Plan Sapması (Gecikme Var)' : 'Devam Ediyor'}`}
                        >
                          <span className="truncate">{isCompleted ? "Fiili: Tamamlandı" : hasDeviation ? "Fiili: Sapma Var (Gecikme)" : "Fiili: Devam Ediyor"}</span>
                          {hasDeviation && (
                            <span className="bg-white/30 text-white font-black px-1 rounded text-[11px] font-mono shrink-0 ml-1">
                              SAPMA 🔴
                            </span>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* SUB-ACTIVITIES CHILD ROWS (Requirement 4: 6 Uygulama Planı Maddeleri) */}
                    {isExpanded && (
                      <div className="bg-slate-50/70 border-t border-slate-150 divide-y divide-slate-100 pl-4 py-1">
                        {tasksList.length === 0 ? (
                          <div className="py-2.5 px-4 text-slate-400 italic text-[11px] flex items-center space-x-2">
                            <span>↳ Henüz alt faaliyet tanımlanmadı. Kart düzenleme formundaki <strong>"6 Uygulama Planı"</strong> bölümünden proje alt faaliyetleri eklenebilir.</span>
                          </div>
                        ) : (
                          tasksList.map((task: CITask, tIdx: number) => {
                            const isTaskDone = task.progressPercent === 100 || (task as any).status === "Yapıldı" || (task as any).status === "Completed";
                            
                            // Task deadline month calculation
                            const taskEndMonth = task.deadline ? Math.min(12, Math.max(pStart, Number(task.deadline.split("-")[1]) || pEnd)) : pEnd;
                            const isTaskOverdue = !isTaskDone && task.deadline && new Date(task.deadline) < new Date();

                            return (
                              <div key={task.id || tIdx} className="grid grid-cols-12 gap-3 items-center p-2 text-[11px] hover:bg-white transition-colors">
                                
                                {/* Sub-activity Name & Owner */}
                                <div className="col-span-4 pl-4 flex items-center space-x-2 min-w-0">
                                  <span className="text-slate-400 font-mono font-bold shrink-0">↳</span>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-800 truncate flex items-center gap-1.5">
                                      <span>{tIdx + 1}. {task.name}</span>
                                      <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${
                                        isTaskDone ? "bg-emerald-100 text-emerald-800" :
                                        isTaskOverdue ? "bg-rose-100 text-rose-800 font-black animate-pulse" :
                                        "bg-amber-100 text-amber-800"
                                      }`}>
                                        {isTaskDone ? "Yapıldı" : isTaskOverdue ? "Gecikti" : "Devam Ediyor"}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono">
                                      Sorumlu: {task.responsible || proj.projectLeader} | Termin: {task.deadline || "Belirtilmedi"}
                                    </div>
                                  </div>
                                </div>

                                {/* Sub-activity Gantt Bar */}
                                <div className="col-span-8 grid grid-cols-12 relative bg-white rounded border border-slate-200/70 p-0.5 min-h-[26px] items-center">
                                  <div className="absolute inset-0 grid grid-cols-12 pointer-events-none divide-x divide-slate-100">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                      <div key={i} className="h-full"></div>
                                    ))}
                                  </div>

                                  {/* Task Bar */}
                                  <div 
                                    className={`h-3.5 rounded text-[7.5px] text-white font-bold flex items-center justify-between px-1.5 transition-all z-10 ${
                                      isTaskDone ? "bg-emerald-600" :
                                      isTaskOverdue ? "bg-rose-600 animate-pulse" :
                                      "bg-indigo-500"
                                    }`}
                                    style={{ 
                                      gridColumnStart: pStart,
                                      gridColumnEnd: Math.min(13, taskEndMonth + 1)
                                    }}
                                    title={`Alt Faaliyet: ${task.name} | Sorumlu: ${task.responsible}`}
                                  >
                                    <span className="truncate">{task.name}</span>
                                    {isTaskOverdue && (
                                      <span className="bg-white text-rose-700 font-black px-1 rounded text-[6.5px]">
                                        GECİKME
                                      </span>
                                    )}
                                  </div>
                                </div>

                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. FINANCIAL DASHBOARD — ci/CiFinanceDashboard.tsx */}
      {activeTab === "dashboard" && (
        <CiFinanceDashboard
          projects={filteredProjects}
          currencySymbol={currency}
          baseCurrency={currency}
          fxRates={ciSettings.fxRates}
          opportunityGain={opportunityGain}
          projectNo={getProjectNo}
          onOpenProject={handleOpenProjectDetails}
        />
      )}

      {/* 5. ÖNCE-SONRA (BEFORE-AFTER) KAIZEN GALLERY — every saved "Kaizen Öncesi Sonrası"
          one-pager across all CI projects, browsable in one place instead of buried one-by-one
          inside each project's own detail modal. */}
      {activeTab === "mytasks" && (
        <CiMyTasks
          projects={kaizens}
          currentUser={currentUser}
          people={teamPeople}
          projectNo={getProjectNo}
          onOpenProject={handleOpenProjectDetails}
          onUpdateTasks={async (project, tasks) => {
            const saved = await onUpdateKaizen({ id: project.id, tasks });
            if (saved) syncWithGantt(saved, 'update');
            return saved;
          }}
        />
      )}

      {activeTab === "settings" && isCiStaff && (
        <CiSettingsPanel customerId={selectedCustomer?.id} settings={ciSettings} baseCurrencyCode={baseCurrencyCode} onSave={saveCiSettings} />
      )}

      {activeTab === "beforeafter" && (
        <div className="space-y-4">
          {allBeforeAfterStudies.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
              <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">Henüz kayıtlı Önce-Sonra Kaizen formu yok.</p>
              <p className="text-xs text-slate-400 mt-1">Bir CI projesinin detayına girip "9 - Önce-Sonra Kaizen Formu" bölümünden oluşturabilirsiniz.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {allBeforeAfterStudies.map(({ study, projectId, projectTitle }) => (
                <div key={study.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs flex flex-col">
                  <div className="grid grid-cols-2 gap-px bg-slate-200">
                    <div className="bg-slate-100 aspect-video flex items-center justify-center overflow-hidden">
                      {study.beforeImage ? (
                        <img src={study.beforeImage} alt="Önce" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">ÖNCE Fotoğrafı Yok</span>
                      )}
                    </div>
                    <div className="bg-slate-100 aspect-video flex items-center justify-center overflow-hidden">
                      {study.afterImage ? (
                        <img src={study.afterImage} alt="Sonra" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">SONRA Fotoğrafı Yok</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3.5 space-y-2 flex-1 flex flex-col">
                    <div>
                      <p className="font-bold text-slate-900 text-xs truncate">{study.subject}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{projectTitle}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{study.category}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{study.area}</span>
                      <span className="text-[9px] text-slate-400 font-mono">{study.date}</span>
                    </div>
                    {study.benefitDescription && (
                      <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1.5 line-clamp-2">{study.benefitDescription}</p>
                    )}
                    <div className="flex items-center justify-between pt-1.5 mt-auto border-t border-slate-100">
                      <span className="text-[10px] text-slate-400">{study.doneBy || "—"}</span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const proj = kaizens.find(k => k.id === projectId);
                            if (proj) handleOpenProjectDetails(proj);
                          }}
                          className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                          title="Projeye Git"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => exportBeforeAfterKaizenToExcel(study, selectedCustomer?.companyName, currency)}
                          className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                          title="Tekrar İndir"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBeforeAfterStudy(study.id, projectId)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                          title="Kaydı Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NEW PROJECT — ci/CiNewProject.tsx (full-screen, opportunity pool or blank) */}
      {isWizardOpen && (
        <CiNewProject
          companyName={selectedCustomer?.companyName}
          currentUser={currentUser}
          people={teamPeople}
          departments={ciSettings.departments}
          phases={ciSettings.phases}
          defaultDurationDays={ciSettings.defaultDurationDays}
          productFamilies={ciSettings.productFamilies}
          currencySymbol={currency}
          currencyOptions={currencyOptions}
          pool={opportunityPool.pool}
          poolLoading={opportunityPool.loading}
          poolError={opportunityPool.error}
          onReloadPool={opportunityPool.reload}
          onCreate={async (project) => {
            const saved = await onAddKaizen(project);
            if (!saved) { opportunityPool.reload(); return undefined; }
            syncWithGantt(saved, 'add');
            setIsWizardOpen(false);
            opportunityPool.reload();
            handleOpenProjectDetails(saved);
            return saved;
          }}
          onClose={() => setIsWizardOpen(false)}
        />
      )}


      {/* ÖNCE-SONRA KAIZEN FORMU OLUŞTURMA MODALİ — z-[60]: renders nested on top of the project
          detail modal (z-50 below), which stays open behind it since this reads/writes the same
          editingProject. Without the higher z-index this was rendered earlier in the DOM than the
          detail modal, so it painted underneath it and the "Önce-Sonra Formu Oluştur" button
          appeared to do nothing when clicked. */}
      {isBeforeAfterModalOpen && editingProject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">

            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Camera className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight">Önce-Sonra Kaizen Formu</h3>
              </div>
              <button onClick={() => setIsBeforeAfterModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Konu *</label>
                  <input type="text" value={baSubject} onChange={(e) => setBaSubject(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800" />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Tarih</label>
                  <input type="date" value={baDate} onChange={(e) => setBaDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800" />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Çalışmayı Yapan</label>
                  <input type="text" list="ci-team-directory" value={baDoneBy} onChange={(e) => setBaDoneBy(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800" />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1">Bölümü</label>
                  <input type="text" value={baDepartment} onChange={(e) => setBaDepartment(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Hedef</label>
                <input type="text" value={baTarget} onChange={(e) => setBaTarget(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold mb-1.5">Kategori</label>
                  <div className="flex items-center gap-3">
                    {(["Verimlilik", "Kalite", "Güvenlik"] as const).map(cat => (
                      <label key={cat} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={baCategory === cat} onChange={() => setBaCategory(cat)} className="accent-indigo-600" />
                        <span className="text-slate-700 font-medium">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-1.5">Alan</label>
                  <div className="flex items-center gap-3">
                    {(["5S", "Maliyet"] as const).map(a => (
                      <label key={a} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={baArea === a} onChange={() => setBaArea(a)} className="accent-indigo-600" />
                        <span className="text-slate-700 font-medium">{a}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <label className="block text-indigo-950 font-bold">İYİLEŞTİRME ÖNCESİ</label>
                  {baBeforeImage ? (
                    <img src={baBeforeImage} alt="Önce" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-white rounded-lg border border-dashed border-slate-300 text-slate-400 italic">Görsel yok</div>
                  )}
                  <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Değiştir / Yükle</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => { if (typeof reader.result === "string") setBaBeforeImage(reader.result); };
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  <textarea rows={2} value={baDescBefore} onChange={(e) => setBaDescBefore(e.target.value)} placeholder="Açıklama..." className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800" />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <label className="block text-indigo-950 font-bold">İYİLEŞTİRME SONRASI</label>
                  {baAfterImage ? (
                    <img src={baAfterImage} alt="Sonra" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-white rounded-lg border border-dashed border-slate-300 text-slate-400 italic">Görsel yok</div>
                  )}
                  <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Değiştir / Yükle</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => { if (typeof reader.result === "string") setBaAfterImage(reader.result); };
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  <textarea rows={2} value={baDescAfter} onChange={(e) => setBaDescAfter(e.target.value)} placeholder="Açıklama..." className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">Getiri Açıklaması (Parasal veya Oran Bazında)</label>
                <textarea rows={2} value={baBenefitDesc} onChange={(e) => setBaBenefitDesc(e.target.value)} className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800" />
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-4 bg-indigo-50 text-indigo-900 font-bold text-[10.5px] text-center py-1.5">
                  <span>Maliyet</span><span>Verimlilik</span><span>Kalite</span><span>Güvenlik</span>
                </div>
                <div className="grid grid-cols-4 gap-2 p-2.5">
                  <div className="space-y-1.5">
                    <input type="text" placeholder="Enerji" value={baBenefits.costEnergy || ""} onChange={(e) => setBaBenefits({ ...baBenefits, costEnergy: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                    <input type="text" placeholder="İş Gücü" value={baBenefits.costLabor || ""} onChange={(e) => setBaBenefits({ ...baBenefits, costLabor: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                    <input type="text" placeholder="Malzeme" value={baBenefits.costMaterial || ""} onChange={(e) => setBaBenefits({ ...baBenefits, costMaterial: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                  </div>
                  <div className="space-y-1.5">
                    <input type="text" placeholder="Makine" value={baBenefits.productivityMachine || ""} onChange={(e) => setBaBenefits({ ...baBenefits, productivityMachine: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                    <input type="text" placeholder="Adam" value={baBenefits.productivityMan || ""} onChange={(e) => setBaBenefits({ ...baBenefits, productivityMan: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                    <input type="text" placeholder="Malzeme" value={baBenefits.productivityMaterial || ""} onChange={(e) => setBaBenefits({ ...baBenefits, productivityMaterial: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                  </div>
                  <div className="space-y-1.5">
                    <input type="text" placeholder="Ürün" value={baBenefits.qualityProduct || ""} onChange={(e) => setBaBenefits({ ...baBenefits, qualityProduct: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                    <input type="text" placeholder="Malzeme" value={baBenefits.qualityMaterial || ""} onChange={(e) => setBaBenefits({ ...baBenefits, qualityMaterial: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                    <input type="text" placeholder="Fire" value={baBenefits.qualityScrap || ""} onChange={(e) => setBaBenefits({ ...baBenefits, qualityScrap: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                  </div>
                  <div className="space-y-1.5">
                    <input type="text" placeholder="Risk Derecesi" value={baBenefits.safetyRiskDegree || ""} onChange={(e) => setBaBenefits({ ...baBenefits, safetyRiskDegree: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                    <input type="text" placeholder="KSO" value={baBenefits.safetyKso || ""} onChange={(e) => setBaBenefits({ ...baBenefits, safetyKso: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10.5px]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsBeforeAfterModalOpen(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs rounded-xl transition-all cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleGenerateBeforeAfterStudy}
                disabled={!baSubject.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Formu Oluştur ve İndir
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EDIT FINANCIALS RESULTS MODAL (17 INDICATORS IN % & CURRENCY) */}
      {financialsProject && (
        <CiGainBreakdown
          project={financialsProject}
          currencySymbol={currency}
          currencyValue={currencyOptions[0].value}
          canEdit={canEditProject(currentUser, financialsProject) && !isClosed(financialsProject)}
          onSave={async (changes) => {
            const saved = await onUpdateKaizen(changes);
            if (saved) syncWithGantt(saved, 'update');
            return saved;
          }}
          onClose={() => setEditingFinancialsProjId(null)}
        />
      )}

      {/* EDIT KAIZEN / CI PROJECT DETAILS MODAL */}
      {cardProject && (
        <CiProjectCard
          project={cardProject}
          projectNo={getProjectNo(cardProject)}
          currentUser={currentUser}
          people={teamPeople}
          departments={ciSettings.departments}
          phases={ciSettings.phases}
          fishboneCategories={ciSettings.fishboneCategories}
          currencySymbol={currency}
          companyName={selectedCustomer?.companyName}
          currencyOptions={currencyOptions}
          currencyChoices={currencyChoices}
          onSave={async (changes) => {
            const saved = await onUpdateKaizen(changes as KaizenCard);
            if (saved) syncWithGantt(saved, 'update');
            return saved;
          }}
          onStageAction={(action, note) => runStageAction(cardProject, action, note)}
          onFollowUp={(input) => recordFollowUp(cardProject, input)}
          onRemind={(to, note) => sendReminder(cardProject, to, note)}
          onClose={() => setCardProjectId(null)}
          onExportExcel={() => exportKaizenCardToExcel(cardProject, selectedCustomer?.companyName, currency)}
          onOpenFinancials={() => handleOpenFinancials(cardProject)}
          onCreateBeforeAfter={(taskId) => handleOpenBeforeAfterModal(cardProject, taskId)}
          onExportBeforeAfter={(study) => exportBeforeAfterKaizenToExcel(study, selectedCustomer?.companyName, currency)}
          onDeleteBeforeAfter={(studyId) => handleDeleteBeforeAfterStudy(studyId, cardProject.id)}
        />
      )}

      {/* LIGHTBOX PHOTO ZOOM MODAL */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center">
              <span className="font-bold text-xs text-slate-200 truncate pr-4">{lightboxPhoto.title}</span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center overflow-auto flex-1">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
