import React, { useState, useEffect } from "react";
import { KaizenCard, ProcessRecord, GanttActivity, Customer, BeforeAfterKaizenStudy, BeforeAfterKaizenBenefits } from "../types";
import { 
  Plus, Layers, Filter, CheckCircle, Trash2, DollarSign, 
  ArrowRight, Edit2, Sparkles, TrendingUp, BarChart2, PieChart, 
  Calendar, List, AlertTriangle, Check, RotateCcw, FileText, 
  ChevronRight, ChevronDown, Info, Users, Clock, Percent, Shield, ArrowDownUp,
  GripVertical, Maximize2, Minimize2, FileUp, File, FileSpreadsheet, Image,
  Camera, Upload, ZoomIn, X, Eye
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

interface KaizenManagerProps {
  kaizens: KaizenCard[];
  onAddKaizen: (k: KaizenCard) => void;
  onUpdateKaizen: (k: KaizenCard) => void;
  onDeleteKaizen: (id: string) => void;
  processes: ProcessRecord[];
  activities: GanttActivity[];
  onAddActivity: (a: GanttActivity) => void;
  onUpdateActivity: (a: GanttActivity) => void;
  onDeleteActivity: (id: string) => void;
  selectedCustomer: Customer;
}

type TabType = "kanban" | "list" | "timeline" | "dashboard" | "beforeafter";

interface CITask {
  id: string;
  name: string;
  responsible: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
  progressPercent: number;
}

interface CIFinancialsInput {
  scrapReduction: { pct: number; val: number };
  reworkReduction: { pct: number; val: number };
  wasteReduction: { pct: number; val: number };
  setupTimeReduction: { pct: number; val: number };
  leadTimeReduction: { pct: number; val: number };
  wipReduction: { pct: number; val: number };
  operatorEfficiency: { pct: number; val: number };
  oeeIncrease: { pct: number; val: number };
  energySavings: { pct: number; val: number };
  qualityImprovement: { pct: number; val: number };
  productionIncrease: { pct: number; val: number };
  deliveryPerformance: { pct: number; val: number };
  ohsGain: { pct: number; val: number };
  spaceSavings: { pct: number; val: number };
  inventoryReduction: { pct: number; val: number };
  maintenanceSavings: { pct: number; val: number };
  otherSavings: { pct: number; val: number };
}

const defaultFinancialsInput = (): CIFinancialsInput => ({
  scrapReduction: { pct: 0, val: 0 },
  reworkReduction: { pct: 0, val: 0 },
  wasteReduction: { pct: 0, val: 0 },
  setupTimeReduction: { pct: 0, val: 0 },
  leadTimeReduction: { pct: 0, val: 0 },
  wipReduction: { pct: 0, val: 0 },
  operatorEfficiency: { pct: 0, val: 0 },
  oeeIncrease: { pct: 0, val: 0 },
  energySavings: { pct: 0, val: 0 },
  qualityImprovement: { pct: 0, val: 0 },
  productionIncrease: { pct: 0, val: 0 },
  deliveryPerformance: { pct: 0, val: 0 },
  ohsGain: { pct: 0, val: 0 },
  spaceSavings: { pct: 0, val: 0 },
  inventoryReduction: { pct: 0, val: 0 },
  maintenanceSavings: { pct: 0, val: 0 },
  otherSavings: { pct: 0, val: 0 }
});

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
  selectedCustomer
}: KaizenManagerProps) {
  const token = localStorage.getItem("gemba_token") || "";
  const [activeTab, setActiveTab] = useState<TabType>("kanban");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("all");
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState("all");
  
  // Selected Product Family filter for Loss Capacity topics
  const [selectedProductFamily, setSelectedProductFamily] = useState<string>("ALL");

  const PRODUCT_FAMILIES = React.useMemo(() => [
    { id: "ALL", name: "Tüm Fabrika Ürün Aileleri (%100 Hacim Payı)", ratio: 1.0, sharePct: 100 },
    { id: "Isıtıcı Grubu", name: "Isıtıcı Ürün Ailesi (%30 Hacim Payı)", ratio: 0.30, sharePct: 30 },
    { id: "Soğutucu Grubu", name: "Soğutucu Ürün Ailesi (%45 Hacim Payı)", ratio: 0.45, sharePct: 45 },
    { id: "Pişirici Grubu", name: "Pişirici Ürün Ailesi (%25 Hacim Payı)", ratio: 0.25, sharePct: 25 },
  ], []);

  // Team-assignment step, shown before a project is actually created — previously
  // handleSelectOpportunity/handleSelectNewProjectTheme created the project immediately with
  // projectTeam permanently [] and no way to assign anyone. This intercepts both entry points.
  const [pendingCreation, setPendingCreation] = useState<{ mode: "opportunity" | "blank"; opp: any | null } | null>(null);
  const [assignLeader, setAssignLeader] = useState<string>("");
  const [assignTeamMembers, setAssignTeamMembers] = useState<string[]>([]);
  const [assignTeamInput, setAssignTeamInput] = useState<string>("");
  const [assignDepartment, setAssignDepartment] = useState<string>("");
  const [assignDeadline, setAssignDeadline] = useState<string>("");
  const [assignTitle, setAssignTitle] = useState<string>("");
  const [editCurrentLoss, setEditCurrentLoss] = useState<number>(0);
  const [isProjectFullScreen, setIsProjectFullScreen] = useState(false);

  // Edit Project Detail States
  const [editingProject, setEditingProject] = useState<KaizenCard | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editProblemDefinition, setEditProblemDefinition] = useState("");
  const [editProblemDetail, setEditProblemDetail] = useState("");
  const [editTargetObjective, setEditTargetObjective] = useState("");
  const [editTargetKpi, setEditTargetKpi] = useState("");
  const [editTargetRatio, setEditTargetRatio] = useState<number>(0);
  const [editTargetCostReduction, setEditTargetCostReduction] = useState<number>(0);
  const [editRootCause, setEditRootCause] = useState("");
  // Structured 5-Why chain — replaces the old single free-text root cause box (which only ever
  // referenced "5 Neden Analizi" by name in its placeholder without actually implementing it).
  const [editRootCauseWhys, setEditRootCauseWhys] = useState<string[]>(["", "", "", "", ""]);

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
  const [editImprovementActions, setEditImprovementActions] = useState("");
  const [editResponsibles, setEditResponsibles] = useState("");
  const [editActionsTaken, setEditActionsTaken] = useState("");
  const [editProjectLeader, setEditProjectLeader] = useState("");
  const [editProjectSponsor, setEditProjectSponsor] = useState("");
  const [editProjectTeam, setEditProjectTeam] = useState<string[]>([]);
  const [editProjectTeamInput, setEditProjectTeamInput] = useState<string>("");
  const [editPlannedFinishDate, setEditPlannedFinishDate] = useState("");
  const [editEstimatedCost, setEditEstimatedCost] = useState(0);
  const [editPhase, setEditPhase] = useState<any>("Faz 1 (1 Ay)");
  const [editDepartment, setEditDepartment] = useState("");
  const [editImpactAnalysis, setEditImpactAnalysis] = useState<Record<string, 'Yüksek' | 'Orta' | 'Düşük'>>({});
  const [editTasks, setEditTasks] = useState<any[]>([]);
  const [editProgressStep, setEditProgressStep] = useState<string>("Tanımlama");
  const [editExpectedGain, setEditExpectedGain] = useState<number>(0);
  const [editExpectedGainCurrency, setEditExpectedGainCurrency] = useState<string>("TL");
  const [editRealizedGain, setEditRealizedGain] = useState<number>(0);
  const [editRealizedGainCurrency, setEditRealizedGainCurrency] = useState<string>("TL");
  const [editRealizedImprovementPct, setEditRealizedImprovementPct] = useState<number>(0);
  const [editStdWorkUpdated, setEditStdWorkUpdated] = useState<boolean>(false);
  const [editInstructionRevised, setEditInstructionRevised] = useState<boolean>(false);
  const [editTrainingGiven, setEditTrainingGiven] = useState<boolean>(false);
  const [editControlPlanUpdated, setEditControlPlanUpdated] = useState<boolean>(false);
  const [editAuditListUpdated, setEditAuditListUpdated] = useState<boolean>(false);
  const [editProjectResult, setEditProjectResult] = useState<string>("Başarılı");
  const [editResultDescription, setEditResultDescription] = useState<string>("");
  const [editDocuments, setEditDocuments] = useState<any[]>([]);

  // Section 2 & 7 Photo States for Mobile/Tablet Camera & Gallery Uploads
  const [editProblemPhotos, setEditProblemPhotos] = useState<string[]>([]);
  const [editResultPhotos, setEditResultPhotos] = useState<string[]>([]);

  // Expand/Collapse state for sub-activities on Gantt Timeline
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});

  // Lightbox Zoom Modal State
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // Screen expansion mode
  const [isExpanded, setIsExpanded] = useState(false);

  // Email status message for simulated notification system
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);

  // Recipient picker for the manual reminder log — lets the user pick from the customer's real
  // registered contacts (mainContactPerson/factoryManager/generalManager) instead of only ever
  // deriving a recipient from the kaizen card's project leader.
  const getCustomerContactOptions = (): { key: string; label: string; name: string; email?: string }[] => {
    const options: { key: string; label: string; name: string; email?: string }[] = [];
    if (selectedCustomer?.mainContactPerson) {
      options.push({ key: "mainContact", label: "Ana İrtibat Kişisi", name: selectedCustomer.mainContactPerson, email: selectedCustomer.mainContactEmail });
    }
    if (selectedCustomer?.factoryManager) {
      options.push({ key: "factoryManager", label: "Fabrika Müdürü", name: selectedCustomer.factoryManager, email: selectedCustomer.factoryManagerEmail });
    }
    if (selectedCustomer?.generalManager) {
      options.push({ key: "generalManager", label: "Genel Müdür", name: selectedCustomer.generalManager, email: selectedCustomer.generalManagerEmail });
    }
    return options;
  };
  const [reminderRecipientKey, setReminderRecipientKey] = useState<string>("leader");

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
        setTeamOptions(names.length > 0 ? names : FALLBACK_TEAM_OPTIONS);
      })
      .catch(err => {
        console.error("Failed to load real team directory in KaizenManager", err);
      });
  }, [selectedCustomer?.id, token]);

  // Financial inputs state for active project editing
  const [editingFinancialsProjId, setEditingFinancialsProjId] = useState<string | null>(null);
  const [financialsInput, setFinancialsInput] = useState<CIFinancialsInput>(defaultFinancialsInput());
  
  // Task management state
  const [activeTasksProjId, setActiveTasksProjId] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskResponsible, setNewTaskResponsible] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"High" | "Medium" | "Low">("Medium");

  // Currency helper
  const currency = selectedCustomer?.currency || "₺";

  // Bi-directional sync with Gantt Master Plan
  const syncWithGantt = (project: KaizenCard, action: 'add' | 'update' | 'delete') => {
    const activityId = `gantt_sync_${project.id}`;
    const existingGantt = activities.find(a => a.id === activityId);
    
    if (action === 'delete') {
      if (existingGantt) {
        onDeleteActivity(activityId);
      }
      return;
    }
    
    const formatGanttDate = (dateStr?: string) => {
      if (!dateStr) return new Date().toISOString().slice(0, 7);
      return dateStr.slice(0, 7); // YYYY-MM
    };
    
    const ganttStatusMap = {
      "Draft": "Planned",
      "Approved": "Planned",
      "In Progress": "In Progress",
      "Completed": "Completed"
    } as const;

    const progressMap = {
      "Draft": 15,
      "Approved": 30,
      "In Progress": 65,
      "Completed": 100
    };

    // Calculate dynamic progress if tasks exist
    let progress = progressMap[project.status];
    if (project.tasks && project.tasks.length > 0) {
      const completedCount = project.tasks.filter((t: any) => t.progressPercent === 100).length;
      progress = Math.round((completedCount / project.tasks.length) * 100);
    }
    if (project.status === "Completed") progress = 100;

    const ganttPayload: GanttActivity = {
      id: activityId,
      name: `[CI] ${project.title}`,
      owner: project.projectLeader || project.originator || "CI Ekibi",
      startDate: formatGanttDate(project.dateProposed),
      endDate: formatGanttDate(project.plannedFinishDate || project.dateProposed),
      progressPercent: progress,
      priority: project.impactLevel,
      status: (project.status === "Completed") ? "Completed" : (project.plannedFinishDate && new Date(project.plannedFinishDate) < new Date()) ? "Delayed" : ganttStatusMap[project.status] || "In Progress",
      notes: project.description || project.descriptionBefore || "CI Proje Portföyü Entegrasyonu"
    };

    if (existingGantt) {
      onUpdateActivity(ganttPayload);
    } else {
      onAddActivity(ganttPayload);
    }
  };

  // Generate opportunities dynamically from Loss Capacity Analysis (COPQ / Cost Deployment Entegrasyonu)
  const generateOpportunities = () => {
    // 1. Read stored Loss Capacity Analysis for the current customer
    const custId = selectedCustomer?.id || "default";
    const savedLcStr = localStorage.getItem(`gemba_loss_capacity_${custId}`);
    let lcData: any = null;
    if (savedLcStr) {
      try {
        lcData = JSON.parse(savedLcStr);
      } catch (e) {
        console.error("Failed to parse gemba_loss_capacity", e);
      }
    }

    // Determine active Product Family Ratio and Label
    let familyRatio = 1.0;
    let familyLabel = "Tüm Fabrika Ürün Aileleri (%100 Hacim Payı)";

    const presetFamily = PRODUCT_FAMILIES.find(p => p.id === selectedProductFamily);
    if (presetFamily) {
      familyRatio = presetFamily.ratio;
      familyLabel = presetFamily.name;
    } else if (lcData && lcData.selectedVsmProject && selectedProductFamily === lcData.selectedVsmProject.productGroup) {
      familyRatio = (lcData.selectedVsmProject.productVolumeShare || 30) / 100;
      familyLabel = `${lcData.selectedVsmProject.name} (${lcData.selectedVsmProject.productGroup} - %${lcData.selectedVsmProject.productVolumeShare || 30} Hacim Payı)`;
    }

    // Detailed problem definition mapping
    const getLossProblemDetail = (subject: string, costGroup?: string) => {
      switch (subject) {
        case "Setup Süreleri (SMED)":
          return "Pres, kalıphane ve montaj hatlarında tip/model değişimlerinde harcanan verimsiz ayar süreleri ve bağlı kapasite kaybı.";
        case "Hurda Maliyeti":
          return "Üretim sürecinde oluşan hatalı parça, ıskarta sac ve hammaddenin neden olduğu doğrudan malzeme ve işçilik kaybı.";
        case "Fire & Malzeme Kayıpları":
          return "Kesim, kenar ve proses içi fireler ile taşıma esnasında ziyan olan doğrudan malzeme maliyeti.";
        case "Plansız Duruşların Önlenmesi":
          return "Mekanik, elektriksel ve otomasyon kaynaklı plansız makine duruşlarının neden olduğu kullanılabilirlik kaybı.";
        case "OEE İyileştirmesi":
          return "OEE 6 büyük kayıp (küçük duruşlar, hız kayıpları, hurda) nedeniyle genel ekipman verimliliğinin hedefin altında kalması.";
        case "Yeniden İşleme (Rework)":
          return "İlk seferde doğru üretilemeyen parçaların tamir ve yeniden işlenmesi için harcanan ek işçilik ve enerji kaybı.";
        case "Operasyonel Verimsizlik":
          return "Hat içi istasyonlar arası yük ve çevrim süresi dengesizlikleri (Yamazumi darboğazları) kaynaklı işçilik israfı.";
        case "Operatör Verimliliği":
          return "Standart dışı hareketler, bekleme süreleri ve OLE (Overall Labor Effectiveness) yetersizliğinden kaynaklı adam-saat kaybı.";
        case "WIP (Yarı Mamul) Azaltımı":
          return "Proses aralarında biriken aşırı yarı mamul stoku, alan işgali ve kilitli çalışma sermayesi finansman maliyeti.";
        case "Lead Time (Sipariş Çevrimi)":
          return "Değer yaratmayan bekleme ve taşıma sürelerinin uzunluğu nedeniyle toplam sipariş teslim süresinin uzaması.";
        case "Fazla Mesai Azaltımı":
          return "Planlama yetersizliği ve verimsizliklerden doğan yüksek maliyetli fazla mesai işçilik yükü.";
        case "Sevkiyat Performansı":
          return "Lojistik, ambalajlama ve OTIF (Zamanında ve Eksiksiz Teslimat) aksamalarından doğan ceza ve gecikme riski.";
        default:
          return `${subject} alanında tespit edilen ve Loss Capacity Analizi ile ortaya çıkarılan finansal kayıp konusu.`;
      }
    };

    const getDeptForSubject = (subject: string) => {
      if (subject.includes("Setup") || subject.includes("SMED")) return "Pres Atölyesi";
      if (subject.includes("Hurda") || subject.includes("Fire") || subject.includes("Rework")) return "Kalite Güvence";
      if (subject.includes("Duruş") || subject.includes("OEE")) return "Bakım Onarım";
      if (subject.includes("Operatör") || subject.includes("Verimsizlik") || subject.includes("Hareket")) return "Endüstri Mühendisliği";
      if (subject.includes("WIP") || subject.includes("Lead") || subject.includes("Sevkiyat") || subject.includes("Bekleme") || subject.includes("Taşıma")) return "Lojistik / Depo";
      if (subject.includes("Fazla Üretim")) return "Üretim Planlama";
      return "Üretim / Montaj";
    };

    // Primary: If Loss Capacity Analysis has computed recoveryMatrixData, use as primary source of truth
    if (lcData && Array.isArray(lcData.recoveryMatrixData) && lcData.recoveryMatrixData.length > 0) {
      return lcData.recoveryMatrixData.map((item: any) => {
        const scaledLoss = Math.round((item.avgLoss || 100000) * familyRatio);
        const scaledGain = Math.round((item.avgGain || 60000) * familyRatio);
        const potPct = scaledLoss > 0 ? Math.round((scaledGain / scaledLoss) * 100) : 60;

        return {
          id: `opp_lc_${item.subject.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`,
          type: item.subject,
          problem: `${item.subject}: ${getLossProblemDetail(item.subject, item.costGroup)}`,
          currentCost: scaledLoss,
          potential: potPct,
          expectedGain: scaledGain,
          priority: item.severity === "Critical" || item.severity === "High" ? "High" : "Medium",
          dept: getDeptForSubject(item.subject),
          leanTool: item.leanTool || "Kaizen & Standart İş",
          source: "Loss Capacity Analizi (COPQ & Cost Deployment)",
          productFamily: familyLabel,
          area: item.area || "Doğrudan Maliyet Azaltma"
        };
      });
    }

    // Secondary source: no Loss Analysis cache found for this customer/browser — instead of jumping
    // straight to fully invented numbers, rank real cost-table (`processes`) records by their actual
    // recorded loss fields. This is real backend data (org+factory scoped), just not run through the
    // full Loss Analysis COPQ model, so it doesn't depend on that tab ever having been opened.
    type CostBucket = { subject: string; field: keyof ProcessRecord; tool: string };
    const costBuckets: CostBucket[] = [
      { subject: "Hurda Maliyeti", field: "scrapCost", tool: "Poka-Yoke & Kalite Otonomasyonu" },
      { subject: "Yeniden İşleme (Rework)", field: "reworkCost", tool: "Matriks Analizi & FTT" },
      { subject: "Plansız Duruşların Önlenmesi", field: "downtimeCost", tool: "Otonom & Planlı Bakım (TPM)" },
      { subject: "Bekleme Kaybı (Waiting Loss)", field: "waitingLoss", tool: "Hat Dengeleme & Yamazumi" },
      { subject: "Taşıma Kaybı (Transportation Loss)", field: "transportationLoss", tool: "Milk-Run & Yerleşim (Layout) İyileştirme" },
      { subject: "Hareket İsrafı (Motion Loss)", field: "motionLoss", tool: "Standart İş & Ergonomi Kaizeni" },
      { subject: "Fazla Üretim Kaybı (Overproduction)", field: "overproductionLoss", tool: "Kanban & Çekme Sistemi" }
    ];

    if (processes && processes.length > 0) {
      const ranked = processes
        .flatMap((proc) =>
          costBuckets.map((bucket) => ({
            proc,
            bucket,
            value: Number(proc[bucket.field]) || 0
          }))
        )
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      if (ranked.length > 0) {
        return ranked.map(({ proc, bucket, value }) => {
          const scaledLoss = Math.round(value * familyRatio);
          // Recovery potential is not measured (no Loss Analysis run for this data yet) — a
          // conservative 60% recoverable-via-Kaizen assumption is used and disclosed via `assumed`.
          const scaledGain = Math.round(scaledLoss * 0.6);
          return {
            id: `opp_proc_${proc.id}_${bucket.field}`,
            type: bucket.subject,
            problem: `${proc.name} — ${bucket.subject}: Maliyet tablosunda (İşlem Kayıtları) bu süreç için kayıtlı gerçek ${bucket.subject.toLowerCase()} tutarı.`,
            currentCost: scaledLoss,
            potential: 60,
            expectedGain: scaledGain,
            priority: scaledLoss > 100000 ? "High" : "Medium",
            dept: getDeptForSubject(bucket.subject),
            leanTool: bucket.tool,
            source: "Maliyet Tablosu / İşlem Kayıtları (gerçek veri — Loss Analysis çalıştırılmadı)",
            productFamily: familyLabel,
            area: "Doğrudan Maliyet Azaltma",
            assumed: true
          };
        });
      }
    }

    // No Loss Capacity Analysis has been run AND no cost-table (`processes`) records exist yet for
    // this customer — there is no real data to build an opportunity list from. This used to fall
    // back to fabricated illustrative loss figures (fixed fake amounts); that data was never real
    // and has been removed. The wizard shows an explicit empty state instead (see isEmptyOpportunityData).
    return [];
  };

  const opportunitiesList = generateOpportunities();
  // All items from a single generateOpportunities() call come from the same tier (the function
  // returns early per tier), so the first item's `source` reflects what's actually active —
  // previously the wizard banner hardcoded "Loss Capacity Analizi" regardless of which tier
  // (real Loss Capacity data or real cost-table data) was really serving.
  const activeOpportunitySource = opportunitiesList[0]?.source || "Veri Kaynağı Yok";
  const isRealLossCapacityData = activeOpportunitySource === "Loss Capacity Analizi (COPQ & Cost Deployment)";
  const isAssumedOpportunityData = opportunitiesList.some(o => o.assumed);
  const isEmptyOpportunityData = opportunitiesList.length === 0;

  // Helper to calculate project number (CIPYYAA-No)
  const getProjectNo = (proj: KaizenCard) => {
    const dateStr = proj.dateProposed || new Date().toISOString().split('T')[0];
    const year = dateStr.substring(2, 4);
    const month = dateStr.substring(5, 7);
    
    // Sort all kaizens to get a stable sequence number for the index
    const sortedAll = [...kaizens].sort((a, b) => {
      const da = a.dateProposed || "";
      const db = b.dateProposed || "";
      if (da !== db) return da.localeCompare(db);
      return a.id.localeCompare(b.id);
    });
    
    const index = sortedAll.findIndex(p => p.id === proj.id);
    const seqNum = index !== -1 ? index + 1 : 1;
    const seqStr = seqNum.toString().padStart(2, '0');
    
    return `CIP${year}${month}-${seqStr}`;
  };

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

  // NOTE: No mail provider is integrated (no SMTP/API credentials configured for this workspace).
  // This does NOT send a real email — it only logs a manual reminder against the project so the
  // team can track that the responsible person was notified (e.g. in person, by phone, or via an
  // external mail client). Do not present this as an actual email dispatch.
  const logManualReminder = (project: KaizenCard, recipientOverride?: { name: string; email?: string }) => {
    const recipientName = recipientOverride?.name || project.projectLeader || project.originator || "Sorumlu Ekip";
    const recipientEmail = recipientOverride?.email;

    const updated: KaizenCard = {
      ...project,
      emailSentCount: (project.emailSentCount || 0) + 1,
      lastEmailSentAt: new Date().toLocaleString()
    };

    onUpdateKaizen(updated);
    syncWithGantt(updated, 'update');

    // If we are currently editing this in detail modal, sync the modal state too
    if (editingProject && editingProject.id === project.id) {
      setEditingProject(updated);
    }

    const recipientLabel = recipientEmail ? `${recipientName} (${recipientEmail})` : recipientName;
    setEmailStatusMessage(`Hatırlatma kaydedildi. Alıcı: ${recipientLabel}. Bu bir e-posta gönderimi DEĞİLDİR — bu workspace'te mail entegrasyonu yapılandırılmamış. Sorumluyu ayrıca kendi iletişim kanalınızdan bilgilendirin: "CI Proje Gecikme Uyarısı: ${project.title}".`);
    setTimeout(() => {
      setEmailStatusMessage(null);
    }, 6000);
  };

  // Open project details/editing modal
  const handleOpenProjectDetails = (proj: KaizenCard) => {
    setEditingProject(proj);
    setEditTitle(proj.title);
    setEditDescription(proj.description || "");
    setEditProblemDefinition(proj.problemDefinition || proj.descriptionBefore || "");
    setEditProblemDetail(proj.problemDetail || "");
    setEditTargetObjective(proj.targetObjective || "");
    setEditTargetKpi(proj.targetKpi || "");
    setEditTargetRatio(proj.targetRatio || 0);
    setEditTargetCostReduction(proj.targetCostReduction || 0);
    setEditRootCause(proj.rootCause || "Kök neden 5 Neden analizi yapılması bekleniyor.");
    // Backward compat: older projects only have the plain-text rootCause, no structured chain yet —
    // seed "Neden 1" with that text so nothing is lost, rather than showing 5 blank boxes.
    setEditRootCauseWhys(
      proj.rootCauseWhys && proj.rootCauseWhys.length > 0
        ? [...proj.rootCauseWhys, "", "", "", "", ""].slice(0, 5)
        : (proj.rootCause ? [proj.rootCause, "", "", "", ""] : ["", "", "", "", ""])
    );
    setEditImprovementActions(proj.improvementActions || "Belirlenen iyileştirme faaliyetleri planlanacaktır.");
    setEditResponsibles(proj.responsibles || proj.projectLeader || "");
    setEditActionsTaken(proj.actionsTaken || "Planlanan faaliyetler yürütülmektedir.");
    setEditProjectLeader(proj.projectLeader || "");
    setEditProjectSponsor(proj.projectSponsor || "");
    setEditProjectTeam(proj.projectTeam || []);
    setEditProjectTeamInput("");
    setEditPlannedFinishDate(proj.plannedFinishDate || "");
    setEditEstimatedCost(proj.estimatedCost || 0);
    setEditCurrentLoss(proj.currentLoss || 0);
    setEditPhase(proj.phase || "Faz 1 (1 Ay)");
    setEditDepartment(proj.department || "Üretim");
    setEditImpactAnalysis(proj.impactAnalysis || {});
    setEditTasks(proj.tasks || []);
    setIsProjectFullScreen(false);
    
    // Set new states
    setEditProgressStep(proj.progressStep || (
      proj.status === "Completed" ? "Kapatıldı" :
      proj.kanbanStatus === "ACT" ? "Standardizasyon" :
      proj.kanbanStatus === "CHECK" ? "Kontrol" :
      proj.kanbanStatus === "DO" ? "Uygulama" :
      proj.kanbanStatus === "PLAN" ? "Planlama" :
      proj.status === "Approved" ? "Analiz" : "Tanımlama"
    ));
    setEditExpectedGain(proj.expectedGain || 0);
    setEditExpectedGainCurrency(proj.expectedGainCurrency || currency || "TL");
    setEditRealizedGain(proj.realizedGain || 0);
    setEditRealizedGainCurrency(proj.realizedGainCurrency || currency || "TL");
    setEditRealizedImprovementPct(proj.realizedImprovementPct || 0);
    setEditStdWorkUpdated(proj.stdWorkUpdated || false);
    setEditInstructionRevised(proj.instructionRevised || false);
    setEditTrainingGiven(proj.trainingGiven || false);
    setEditControlPlanUpdated(proj.controlPlanUpdated || false);
    setEditAuditListUpdated(proj.auditListUpdated || false);
    setEditProjectResult(proj.projectResult || "Başarılı");
    setEditResultDescription(proj.resultDescription || "");
    setEditDocuments(proj.documents || []);
    setEditProblemPhotos(proj.problemPhotos || []);
    setEditResultPhotos(proj.resultPhotos || []);
  };

  const handleOpenProjectFullScreen = (proj: KaizenCard) => {
    handleOpenProjectDetails(proj);
    setIsProjectFullScreen(true);
  };

  // Prefill the Before-After Kaizen form from what's already on the CI card, so the consultant only
  // has to fill in what the form actually needs beyond that (category/area, benefit breakdown).
  const handleOpenBeforeAfterModal = () => {
    if (!editingProject) return;
    setBaSubject(editingProject.title || "");
    setBaTarget(editingProject.targetObjective || "");
    setBaDoneBy(editingProject.projectLeader || editingProject.originator || "");
    setBaDepartment(editingProject.department || "");
    setBaDate(new Date().toISOString().split("T")[0]);
    setBaCategory("Verimlilik");
    setBaArea("5S");
    setBaBeforeImage(editingProject.problemPhotos?.[0] || "");
    setBaAfterImage(editingProject.resultPhotos?.[0] || "");
    setBaDescBefore(editingProject.problemDefinition || editingProject.descriptionBefore || "");
    setBaDescAfter(editingProject.descriptionAfter || editingProject.resultDescription || "");
    setBaBenefitDesc(
      editingProject.actualSavings
        ? `Gerçekleşen tasarruf: ${currency}${editingProject.actualSavings.toLocaleString()}`
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

    const updated: KaizenCard = {
      ...liveProject,
      beforeAfterStudies: [...(liveProject.beforeAfterStudies || []), newStudy]
    };
    onUpdateKaizen(updated);
    setEditingProject(updated);

    exportBeforeAfterKaizenToExcel(newStudy, selectedCustomer?.companyName, currency);
    setIsBeforeAfterModalOpen(false);
  };

  const handleDeleteBeforeAfterStudy = (studyId: string, projectId?: string) => {
    const targetId = projectId || editingProject?.id;
    if (!targetId) return;
    const liveProject = kaizens.find(k => k.id === targetId);
    if (!liveProject) return;
    const updated: KaizenCard = {
      ...liveProject,
      beforeAfterStudies: (liveProject.beforeAfterStudies || []).filter(s => s.id !== studyId)
    };
    onUpdateKaizen(updated);
    if (editingProject?.id === targetId) setEditingProject(updated);
    setEditingProject(updated);
  };

  const handleSaveProjectDetails = () => {
    if (!editingProject) return;

    // Synchronize progress step back to kanbanStatus and status
    let synchedStatus = editingProject.status;
    let synchedKanbanStatus = editingProject.kanbanStatus;

    if (editProgressStep === "Kapatıldı") {
      synchedStatus = "Completed";
      synchedKanbanStatus = "ACT";
    } else if (editProgressStep === "Standardizasyon") {
      synchedStatus = "In Progress";
      synchedKanbanStatus = "ACT";
    } else if (editProgressStep === "Kontrol") {
      synchedStatus = "In Progress";
      synchedKanbanStatus = "CHECK";
    } else if (editProgressStep === "Uygulama") {
      synchedStatus = "In Progress";
      synchedKanbanStatus = "DO";
    } else if (editProgressStep === "Planlama") {
      synchedStatus = "In Progress";
      synchedKanbanStatus = "PLAN";
    } else if (editProgressStep === "Analiz") {
      synchedStatus = "Approved";
      synchedKanbanStatus = "PLAN";
    } else if (editProgressStep === "Tanımlama") {
      synchedStatus = "Draft";
      synchedKanbanStatus = "PLAN";
    }

    // rootCause stays in sync as the last non-empty step of the 5-Why chain, so anything that
    // still just reads the plain-text field (Excel export, list views) keeps working unchanged.
    const filledWhys = editRootCauseWhys.map(w => w.trim()).filter(Boolean);
    const computedRootCause = filledWhys.length > 0 ? filledWhys[filledWhys.length - 1] : editRootCause;

    const updated: KaizenCard = {
      ...editingProject,
      title: editTitle,
      description: editDescription,
      descriptionBefore: editProblemDefinition, // keep both in sync
      problemDefinition: editProblemDefinition,
      problemDetail: editProblemDetail,
      targetObjective: editTargetObjective,
      targetKpi: editTargetKpi,
      targetRatio: Number(editTargetRatio),
      targetCostReduction: Number(editTargetCostReduction),
      rootCause: computedRootCause,
      rootCauseWhys: editRootCauseWhys,
      improvementActions: editImprovementActions,
      responsibles: editResponsibles,
      actionsTaken: editActionsTaken,
      projectLeader: editProjectLeader,
      projectSponsor: editProjectSponsor,
      projectTeam: editProjectTeam,
      plannedFinishDate: editPlannedFinishDate,
      estimatedCost: Number(editEstimatedCost),
      currentLoss: Number(editCurrentLoss),
      phase: editPhase,
      department: editDepartment,
      impactAnalysis: editImpactAnalysis,
      tasks: editTasks,
      status: synchedStatus,
      kanbanStatus: synchedKanbanStatus,
      progressStep: editProgressStep,
      expectedGain: Number(editExpectedGain),
      expectedGainCurrency: editExpectedGainCurrency,
      realizedGain: Number(editRealizedGain),
      realizedGainCurrency: editRealizedGainCurrency,
      realizedImprovementPct: Number(editRealizedImprovementPct),
      stdWorkUpdated: editStdWorkUpdated,
      instructionRevised: editInstructionRevised,
      trainingGiven: editTrainingGiven,
      controlPlanUpdated: editControlPlanUpdated,
      auditListUpdated: editAuditListUpdated,
      projectResult: editProjectResult as any,
      resultDescription: editResultDescription,
      problemPhotos: editProblemPhotos,
      resultPhotos: editResultPhotos,
      documents: editDocuments,
      actualSavings: Number(editRealizedGain) // map realized gain directly to actualSavings for standard dashboards!
    };

    onUpdateKaizen(updated);
    syncWithGantt(updated, 'update');
    setEditingProject(null);
    setIsProjectFullScreen(false);
  };

  // Export CI Improvement Project Card to Excel (.xls) formatted with styled tables and borders
  const exportKaizenCardToExcel = (proj: KaizenCard, customerName?: string, currencySymbol: string = "₺") => {
    const projNo = getProjectNo(proj);
    const fileName = `${projNo}_CI_Proje_Karti.xls`;

    const tasksRows = (proj.tasks && proj.tasks.length > 0)
      ? proj.tasks.map((t, idx) => `
        <tr style="height: 24px;">
          <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10pt; font-family: Calibri, sans-serif;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; font-family: Calibri, sans-serif; padding-left: 6px;">${t.name || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10pt; font-family: Calibri, sans-serif;">${t.responsible || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10pt; font-family: Calibri, sans-serif;">${t.deadline || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 10pt; font-family: Calibri, sans-serif;">%${t.progressPercent ?? 0}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10pt; font-family: Calibri, sans-serif;">${t.status || 'Açık'}</td>
        </tr>
      `).join('')
      : `<tr style="height: 24px;"><td colspan="6" style="border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-style: italic; font-size: 10pt; font-family: Calibri, sans-serif;">Tanımlanmış alt faaliyet bulunmuyor.</td></tr>`;

    const impactAnalysisItems = proj.impactAnalysis 
      ? Object.entries(proj.impactAnalysis).map(([key, val]) => `${key}: ${val}`).join(' | ')
      : 'Belirtilmedi';

    const html = `
      <html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>CI Proje Kartı</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          td { vertical-align: middle; }
        </style>
      </head>
      <body>
        <table border="1" style="border-collapse: collapse; font-family: Calibri, sans-serif; width: 100%;">
          
          <!-- BRAND & HEADER ROW -->
          <tr style="height: 40px; background-color: #1e1b4b;">
            <td colspan="6" style="text-align: center; color: #ffffff; font-size: 15pt; font-weight: bold; font-family: Arial, sans-serif; background-color: #1e1b4b;">
              SÜREKLİ İYİLEŞTİRME (CI) PROJE KARTI & AKSİYON TAKİP FORMU
            </td>
          </tr>

          <!-- META ROW 1 -->
          <tr style="height: 26px; background-color: #f8fafc;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Müşteri / Fabrika:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #1e1b4b; padding-left: 8px;">${customerName || 'Varsayılan Müşteri'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Numarası:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #4338ca; font-family: monospace; padding-left: 8px;">${projNo}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Durumu:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #15803d; padding-left: 8px;">${proj.status === 'Completed' ? 'Tamamlandı (ACT)' : (proj.kanbanStatus || 'PLAN')}</td>
          </tr>

          <!-- 1. PROJE KİMLİĞİ & SORUMLULAR -->
          <tr style="height: 30px; background-color: #312e81;">
            <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
              1. PROJE KİMLİĞİ VE TEMEL BİLGİLER
            </td>
          </tr>
          <tr style="height: 28px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Adı / Konusu:</td>
            <td colspan="5" style="border: 1px solid #cbd5e1; font-weight: bold; font-size: 12pt; color: #0f172a; padding-left: 8px;">${proj.title || '-'}</td>
          </tr>
          <tr style="height: 26px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Departman:</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.department || '-'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Fazı:</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.phase || 'Phase 1'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">İlerleme Aşaması:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px; color: #4338ca;">${proj.progressStep || 'Planlama'}</td>
          </tr>
          <tr style="height: 26px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Lideri:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px;">${proj.projectLeader || proj.originator || '-'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Sponsoru:</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.projectSponsor || '-'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Etki Seviyesi:</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.impactLevel || 'Medium'} Impact</td>
          </tr>
          <tr style="height: 26px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Teklif Tarihi:</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.dateProposed || '-'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Planlanan Bitiş:</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.plannedFinishDate || '-'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Gerçekleşen Bitiş:</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.realizedFinishDate || '-'}</td>
          </tr>

          <!-- 2. PROBLEM TANIMI & MEVCUT DURUM -->
          <tr style="height: 30px; background-color: #312e81;">
            <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
              2. PROBLEM TANIMI VE MEVCUT DURUM (GEMBA İNCELEMESİ)
            </td>
          </tr>
          <tr style="height: 36px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Problem Tanımı:</td>
            <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px 8px; color: #0f172a;">${proj.problemDefinition || proj.descriptionBefore || proj.description || '-'}</td>
          </tr>
          <tr style="height: 36px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Mevcut Durum Detayı:</td>
            <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 8px;">${proj.problemDetail || '-'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Mevcut Yıllık Kayıp:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #b91c1c; padding-left: 8px;">${currencySymbol}${(proj.currentLoss || 0).toLocaleString()}</td>
          </tr>

          <!-- 3. ETKİ ANALİZİ & KÖK NEDEN -->
          <tr style="height: 30px; background-color: #312e81;">
            <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
              3. ETKİ ANALİZİ VE KÖK NEDEN ANALİZİ (5 NEDEN / BALIK KILÇIĞI)
            </td>
          </tr>
          <tr style="height: 28px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Etki Alanları:</td>
            <td colspan="5" style="border: 1px solid #cbd5e1; padding-left: 8px; font-weight: bold; color: #334155;">${impactAnalysisItems}</td>
          </tr>
          <tr style="height: 36px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Kök Neden Analizi:</td>
            <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px 8px;">${proj.rootCause || '-'}</td>
          </tr>

          <!-- 4. HEDEFLER VE FİNANSAL KAZANIMLAR -->
          <tr style="height: 30px; background-color: #312e81;">
            <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
              4. HEDEFLER VE BÜTÇE / NET FİNANSAL KAZANIMLAR
            </td>
          </tr>
          <tr style="height: 28px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Hedeflenen Durum:</td>
            <td colspan="3" style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.targetObjective || '-'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Hedef KPI:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px; color: #1e1b4b;">${proj.targetKpi || '-'}</td>
          </tr>
          <tr style="height: 26px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Hedef İyileştirme %:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px;">%${proj.targetRatio || 0}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Hedef Tasarruf:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px;">${currencySymbol}${(proj.targetCostReduction || 0).toLocaleString()}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Tahmini Bütçe:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px;">${currencySymbol}${(proj.estimatedCost || 0).toLocaleString()}</td>
          </tr>
          <tr style="height: 28px; background-color: #f0fdf4;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #e2e8f0; color: #334155; padding-left: 8px;">Beklenen Kazanım:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #1d4ed8; padding-left: 8px;">${proj.expectedGainCurrency || currencySymbol}${(proj.expectedGain || 0).toLocaleString()}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #dcfce7; color: #14532d; padding-left: 8px;">Gerçekleşen Tasarruf:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #15803d; font-size: 11pt; padding-left: 8px; background-color: #dcfce7;">${proj.realizedGainCurrency || currencySymbol}${(proj.realizedGain || proj.actualSavings || 0).toLocaleString()}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #dcfce7; color: #14532d; padding-left: 8px;">Gerçekleşen İyileştirme:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #15803d; font-size: 11pt; padding-left: 8px; background-color: #dcfce7;">%${proj.realizedImprovementPct || 0}</td>
          </tr>

          <!-- 5. UYGULAMA PLANI (6. ADIM AKSİYON LİSTESİ) -->
          <tr style="height: 30px; background-color: #312e81;">
            <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
              5. UYGULAMA PLANI VE AKSİYON TAKİP TABLOSU (6. UYGULAMA ADIMI)
            </td>
          </tr>
          <tr style="height: 26px; background-color: #e2e8f0;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; width: 6%;">#</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: left; padding-left: 8px; width: 44%;">Alt Faaliyet / Aksiyon Adı</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; width: 18%;">Sorumlu</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; width: 12%;">Termin Tarihi</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; width: 10%;">Tamamlanma %</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; width: 10%;">Durum</td>
          </tr>
          ${tasksRows}

          <!-- 6. STANDARTLAŞTIRMA VE SÜRDÜRÜLEBİLİRLİK -->
          <tr style="height: 30px; background-color: #312e81;">
            <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
              6. STANDARTLAŞTIRMA VE YAYGINLAŞTIRMA ADIMLARI (7. & 8. ADIM)
            </td>
          </tr>
          <tr style="height: 26px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Standart İş Güncellendi:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${proj.stdWorkUpdated ? '#16a34a' : '#64748b'}; padding-left: 8px;">${proj.stdWorkUpdated ? 'EVET [✓]' : 'HAYIR [ ]'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Talimat Revize Edildi:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${proj.instructionRevised ? '#16a34a' : '#64748b'}; padding-left: 8px;">${proj.instructionRevised ? 'EVET [✓]' : 'HAYIR [ ]'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Eğitim Verildi:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${proj.trainingGiven ? '#16a34a' : '#64748b'}; padding-left: 8px;">${proj.trainingGiven ? 'EVET [✓]' : 'HAYIR [ ]'}</td>
          </tr>
          <tr style="height: 26px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Kontrol Planı Güncellendi:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${proj.controlPlanUpdated ? '#16a34a' : '#64748b'}; padding-left: 8px;">${proj.controlPlanUpdated ? 'EVET [✓]' : 'HAYIR [ ]'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Denetim Listesi Güncellendi:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${proj.auditListUpdated ? '#16a34a' : '#64748b'}; padding-left: 8px;">${proj.auditListUpdated ? 'EVET [✓]' : 'HAYIR [ ]'}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Kapanış Sonucu:</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #15803d; padding-left: 8px;">${proj.projectResult || 'Başarılı'}</td>
          </tr>
          <tr style="height: 36px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Kapanış Açıklaması:</td>
            <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px 8px;">${proj.resultDescription || 'Proje başarıyla tamamlanmış ve finansal tasarruf tescil edilmiştir.'}</td>
          </tr>

        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Recreates the real "Kaizen Öncesi Sonrası" (Before-After Kaizen) one-pager the firm already
  // uses on paper/in a standalone Excel template — same HTML-table-to-.xls technique as
  // exportKaizenCardToExcel above, but embeds the before/after photos directly (they're already
  // persisted as base64 data URLs, same as problem/result photos elsewhere on the card).
  const exportBeforeAfterKaizenToExcel = (study: BeforeAfterKaizenStudy, customerName?: string, currencySymbol: string = "₺") => {
    const fileName = `Once_Sonra_Kaizen_${study.subject.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]+/g, "_").slice(0, 40)}.xls`;
    const b = study.benefits || {};
    const checkbox = (checked: boolean) => checked ? "☑" : "☐";

    const html = `
      <html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Once-Sonra Kaizen</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>td { vertical-align: middle; }</style>
      </head>
      <body>
        <table border="1" style="border-collapse: collapse; font-family: Calibri, sans-serif; width: 100%;">

          <tr style="height: 46px; background-color: #1e1b4b;">
            <td colspan="4" style="text-align: center; color: #ffffff; font-size: 16pt; font-weight: bold; font-family: Arial, sans-serif; background-color: #1e1b4b;">
              ÖNCESİ SONRASI İYİLEŞTİRME ÇALIŞMALARI
            </td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">TARİH</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #1e1b4b; padding-left: 8px;">${study.date || "-"}</td>
          </tr>
          <tr style="height: 26px;">
            <td colspan="4" rowspan="2"></td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">ÇALIŞMAYI YAPAN</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${study.doneBy || "-"}</td>
          </tr>
          <tr style="height: 26px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">BÖLÜMÜ</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${study.department || "-"}</td>
          </tr>

          <tr style="height: 32px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">KONU :</td>
            <td colspan="3" style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px;">${study.subject || "-"}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">KATEGORİ</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">
              ${checkbox(study.category === "Verimlilik")} Verimlilik &nbsp; ${checkbox(study.category === "Kalite")} Kalite &nbsp; ${checkbox(study.category === "Güvenlik")} Güvenlik
            </td>
          </tr>
          <tr style="height: 32px;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">HEDEF :</td>
            <td colspan="3" style="border: 1px solid #cbd5e1; padding-left: 8px;">${study.target || "-"}</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">ALAN</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 8px;">
              ${checkbox(study.area === "5S")} 5S &nbsp; ${checkbox(study.area === "Maliyet")} Maliyet
            </td>
          </tr>

          <tr style="height: 30px; background-color: #312e81;">
            <td colspan="3" style="border: 1px solid #1e1b4b; text-align: center; font-weight: bold; color: #ffffff; font-size: 11pt; background-color: #312e81;">İYİLEŞTİRME ÖNCESİ</td>
            <td colspan="3" style="border: 1px solid #1e1b4b; text-align: center; font-weight: bold; color: #ffffff; font-size: 11pt; background-color: #312e81;">İYİLEŞTİRME SONRASI</td>
          </tr>
          <tr style="height: 220px;">
            <td colspan="3" style="border: 1px solid #cbd5e1; text-align: center; background-color: #f8fafc;">
              ${study.beforeImage ? `<img src="${study.beforeImage}" style="max-width: 320px; max-height: 220px;" />` : `<span style="color:#94a3b8; font-style: italic;">Görsel eklenmedi</span>`}
            </td>
            <td colspan="3" style="border: 1px solid #cbd5e1; text-align: center; background-color: #f8fafc;">
              ${study.afterImage ? `<img src="${study.afterImage}" style="max-width: 320px; max-height: 220px;" />` : `<span style="color:#94a3b8; font-style: italic;">Görsel eklenmedi</span>`}
            </td>
          </tr>

          <tr style="height: 24px;">
            <td colspan="3" style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">AÇIKLAMA:</td>
            <td colspan="3" style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">AÇIKLAMA:</td>
          </tr>
          <tr style="height: 70px;">
            <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top;">${study.descriptionBefore || "-"}</td>
            <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top;">${study.descriptionAfter || "-"}</td>
          </tr>

          <tr style="height: 24px;">
            <td colspan="6" style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">
              GETİRİ AÇIKLAMASI : (Parasal veya Oran bazında getirinin rakamsal ifadesi)
            </td>
          </tr>
          <tr style="height: 50px;">
            <td colspan="6" style="border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top;">${study.benefitDescription || "-"}</td>
          </tr>

          <tr style="height: 26px; background-color: #f8fafc;">
            <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; background-color: #e0e7ff; color: #1e1b4b;">Maliyet</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; background-color: #e0e7ff; color: #1e1b4b;">Verimlilik</td>
            <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; background-color: #e0e7ff; color: #1e1b4b;">Kalite</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; background-color: #e0e7ff; color: #1e1b4b;">Güvenlik</td>
          </tr>
          <tr style="height: 24px;">
            <td style="border: 1px solid #cbd5e1; padding-left: 6px;">Enerji: ${b.costEnergy || "-"}</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px;">Makine: ${b.productivityMachine || "-"}</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 6px;">Ürün: ${b.qualityProduct || "-"}</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px;">Risk Derecesi: ${b.safetyRiskDegree || "-"}</td>
          </tr>
          <tr style="height: 24px;">
            <td style="border: 1px solid #cbd5e1; padding-left: 6px;">İş Gücü: ${b.costLabor || "-"}</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px;">Adam: ${b.productivityMan || "-"}</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 6px;">Malzeme: ${b.qualityMaterial || "-"}</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px;">KSO: ${b.safetyKso || "-"}</td>
          </tr>
          <tr style="height: 24px;">
            <td style="border: 1px solid #cbd5e1; padding-left: 6px;">Malzeme: ${b.costMaterial || "-"}</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px;">Malzeme: ${b.productivityMaterial || "-"}</td>
            <td style="border: 1px solid #cbd5e1; padding-left: 6px;">Fire: ${b.qualityScrap || "-"}</td>
            <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px; font-size: 9pt; color: #64748b;">(*Kaza Sıklık Oranı)</td>
          </tr>

          <tr style="height: 20px;">
            <td colspan="6" style="border: 1px solid #cbd5e1; font-size: 8pt; color: #94a3b8; padding-left: 6px;">
              ${customerName || ""} — Gemba Partner CI Proje Yönetimi
            </td>
          </tr>

        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
        proj.rootCause || "", proj.opportunityType || ""
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
        [pdfSafe("Beklenen Kazanç"), `${currency} ${totalExpectedFinancialGain.toLocaleString()}`, pdfSafe("Gerçekleşen Kazanım"), `${currency} ${realizedFinancialGain.toLocaleString()}`]
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
          (proj.estimatedCost || 0).toLocaleString(), (proj.actualSavings || 0).toLocaleString()
        ]),
      startY: (doc as any).lastAutoTable.finalY + 14,
      theme: "striped",
      styles: { fontSize: 7.5 }
    });

    doc.save(`CI_Portfoy_Raporu_${(selectedCustomer?.companyName || "musteri").replace(/\s+/g, "_")}.pdf`);
  };

  const handleExportCurrentEditingProjectToExcel = () => {
    if (!editingProject) return;

    const currentCard: KaizenCard = {
      ...editingProject,
      title: editTitle,
      description: editDescription,
      problemDefinition: editProblemDefinition,
      problemDetail: editProblemDetail,
      targetObjective: editTargetObjective,
      targetKpi: editTargetKpi,
      targetRatio: Number(editTargetRatio),
      targetCostReduction: Number(editTargetCostReduction),
      rootCause: editRootCause,
      improvementActions: editImprovementActions,
      responsibles: editResponsibles,
      actionsTaken: editActionsTaken,
      projectLeader: editProjectLeader,
      projectSponsor: editProjectSponsor,
      projectTeam: editProjectTeam,
      plannedFinishDate: editPlannedFinishDate,
      estimatedCost: Number(editEstimatedCost),
      currentLoss: Number(editCurrentLoss),
      phase: editPhase,
      department: editDepartment,
      impactAnalysis: editImpactAnalysis,
      tasks: editTasks,
      progressStep: editProgressStep,
      expectedGain: Number(editExpectedGain),
      expectedGainCurrency: editExpectedGainCurrency,
      realizedGain: Number(editRealizedGain),
      realizedGainCurrency: editRealizedGainCurrency,
      realizedImprovementPct: Number(editRealizedImprovementPct),
      stdWorkUpdated: editStdWorkUpdated,
      instructionRevised: editInstructionRevised,
      trainingGiven: editTrainingGiven,
      controlPlanUpdated: editControlPlanUpdated,
      auditListUpdated: editAuditListUpdated,
      projectResult: editProjectResult as any,
      resultDescription: editResultDescription,
      problemPhotos: editProblemPhotos,
      resultPhotos: editResultPhotos,
      documents: editDocuments,
      actualSavings: Number(editRealizedGain)
    };

    exportKaizenCardToExcel(currentCard, selectedCustomer?.companyName, currency);
  };

  // Wizard Launch Project Handler
  // These two entry points used to create the project immediately, with projectTeam permanently []
  // and no way to pick a leader/team/deadline. Now they just open a lightweight assignment step
  // (handleConfirmProjectCreation below does the actual creation once that step is filled in).
  const handleSelectOpportunity = (opp: any) => {
    const defaultDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setPendingCreation({ mode: "opportunity", opp });
    setAssignTitle(`${opp.type} Entegrasyonu - ${opp.dept}`);
    setAssignLeader(teamOptions[0] || "");
    setAssignTeamMembers([]);
    setAssignTeamInput("");
    setAssignDepartment(opp.dept || "");
    setAssignDeadline(defaultDate);
  };

  const handleSelectNewProjectTheme = () => {
    const defaultDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setPendingCreation({ mode: "blank", opp: null });
    setAssignTitle("");
    setAssignLeader(teamOptions[0] || "");
    setAssignTeamMembers([]);
    setAssignTeamInput("");
    setAssignDepartment("Üretim");
    setAssignDeadline(defaultDate);
  };

  const handleAddAssignTeamMember = () => {
    const name = assignTeamInput.trim();
    if (!name || assignTeamMembers.includes(name)) return;
    setAssignTeamMembers(prev => [...prev, name]);
    setAssignTeamInput("");
  };

  const handleRemoveAssignTeamMember = (name: string) => {
    setAssignTeamMembers(prev => prev.filter(m => m !== name));
  };

  const handleConfirmProjectCreation = () => {
    if (!pendingCreation || !assignLeader.trim()) return;
    const opp = pendingCreation.opp;
    const leaderName = assignLeader.trim();
    const deadline = assignDeadline || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const newId = `kai_${Math.random().toString(36).substring(2, 9)}`;

    let newK: KaizenCard;

    if (pendingCreation.mode === "opportunity" && opp) {
      // Automatically suggest impact areas based on opportunity type
      const suggestedImpacts: Record<string, 'Yüksek' | 'Orta' | 'Düşük'> = {};
      const typeLower = (opp.type || "").toLowerCase();
      if (typeLower.includes("smed") || typeLower.includes("setup")) {
        suggestedImpacts["Setup"] = "Yüksek";
        suggestedImpacts["OEE"] = "Orta";
        suggestedImpacts["Plansız Duruş"] = "Düşük";
      } else if (typeLower.includes("hurda") || typeLower.includes("scrap")) {
        suggestedImpacts["Hurda"] = "Yüksek";
        suggestedImpacts["Kalite Maliyetleri"] = "Orta";
      } else if (typeLower.includes("rework")) {
        suggestedImpacts["Rework"] = "Yüksek";
        suggestedImpacts["Kalite Maliyetleri"] = "Orta";
      } else if (typeLower.includes("verimlilik") || typeLower.includes("operatör")) {
        suggestedImpacts["Operatör Verimliliği"] = "Yüksek";
        suggestedImpacts["Fazla Mesai"] = "Orta";
      } else if (typeLower.includes("wip")) {
        suggestedImpacts["WIP"] = "Yüksek";
        suggestedImpacts["Lead Time"] = "Orta";
      } else if (typeLower.includes("duruş") || typeLower.includes("plansız")) {
        suggestedImpacts["Plansız Duruş"] = "Yüksek";
        suggestedImpacts["OEE"] = "Yüksek";
      } else {
        suggestedImpacts["OEE"] = "Yüksek";
        suggestedImpacts["Plansız Duruş"] = "Orta";
      }

      newK = {
        id: newId,
        title: assignTitle || `${opp.type} Entegrasyonu - ${opp.dept}`,
        originator: leaderName,
        department: assignDepartment || opp.dept,
        dateProposed: new Date().toISOString().split('T')[0],
        impactLevel: opp.priority || "Medium",
        estimatedCost: Math.round(opp.currentCost * 0.15),
        currentLoss: opp.currentCost || 0,
        actualSavings: 0,
        status: "In Progress",
        descriptionBefore: opp.problem,
        descriptionAfter: "Aksiyon planı uygulanıyor, standartlaşma hedefleniyor.",
        description: `${opp.problem} probleminin giderilmesi amacıyla başlatılan sürekli iyileştirme faaliyetidir.`,
        projectLeader: leaderName,
        projectTeam: assignTeamMembers,
        projectSponsor: "",
        plannedFinishDate: deadline,
        phase: "Faz 1 (1 Ay)",
        opportunityId: opp.id,
        opportunityType: opp.type,
        kanbanStatus: "PLAN",
        tasks: [
          { id: `tsk_1_${Math.random().toString(36).substring(2, 5)}`, name: "Mevcut Durum Standardizasyon Analizi", responsible: leaderName, deadline, priority: "High", progressPercent: 0 },
          { id: `tsk_2_${Math.random().toString(36).substring(2, 5)}`, name: "Kök Neden Analizi & Aksiyon Tasarımı", responsible: leaderName, deadline, priority: "High", progressPercent: 0 }
        ],
        financialsInput: defaultFinancialsInput(),
        problemDefinition: opp.problem,
        problemDetail: "",
        targetObjective: "",
        rootCause: "Kök neden 5 Neden analizi yapılması bekleniyor.",
        improvementActions: "Belirlenen iyileştirme faaliyetleri planlanacaktır.",
        responsibles: leaderName,
        actionsTaken: "Proje başlangıç aşamasında.",
        impactAnalysis: suggestedImpacts
      };
    } else {
      newK = {
        id: newId,
        title: assignTitle,
        originator: leaderName,
        department: assignDepartment || "Üretim",
        dateProposed: new Date().toISOString().split('T')[0],
        impactLevel: "Medium",
        estimatedCost: 0,
        currentLoss: 0,
        actualSavings: 0,
        status: "In Progress",
        descriptionBefore: "",
        descriptionAfter: "Aksiyon planı uygulanıyor, standartlaşma hedefleniyor.",
        description: "",
        projectLeader: leaderName,
        projectTeam: assignTeamMembers,
        projectSponsor: "",
        plannedFinishDate: deadline,
        phase: "Faz 1 (1 Ay)",
        kanbanStatus: "PLAN",
        tasks: [],
        financialsInput: defaultFinancialsInput(),
        problemDefinition: "",
        problemDetail: "",
        targetObjective: "",
        rootCause: "",
        improvementActions: "",
        responsibles: leaderName,
        actionsTaken: ""
      };
    }

    onAddKaizen(newK);
    syncWithGantt(newK, 'add');
    setPendingCreation(null);
    setIsWizardOpen(false);
    handleOpenProjectDetails(newK);
  };

  // Status Change (PLAN -> DO -> CHECK -> ACT)
  // Mirrors handleSaveProjectDetails' progressStep -> (status, kanbanStatus) table, in reverse, for
  // the exact 4 combos this handler can produce — previously dragging a card only updated
  // kanbanStatus/status, leaving progressStep stale and out of sync with the detail modal's view.
  const KANBAN_TO_PROGRESS_STEP: Record<string, string> = {
    PLAN: "Planlama",
    DO: "Uygulama",
    CHECK: "Kontrol",
    ACT: "Kapatıldı"
  };

  const handleKanbanStatusChange = (project: KaizenCard, newKanbanStatus: KaizenCard["kanbanStatus"]) => {
    const updated: KaizenCard = {
      ...project,
      kanbanStatus: newKanbanStatus,
      status: newKanbanStatus === "ACT" ? "Completed" : "In Progress",
      progressStep: (newKanbanStatus && KANBAN_TO_PROGRESS_STEP[newKanbanStatus]) || project.progressStep
    };

    if (newKanbanStatus === "ACT") {
      updated.realizedFinishDate = new Date().toISOString().split('T')[0];
    }

    onUpdateKaizen(updated);
    syncWithGantt(updated, 'update');
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

  const handleDeleteProject = (id: string) => {
    if (window.confirm("Bu sürekli iyileştirme projesini kalıcı olarak silmek istediğinizden emin misiniz?")) {
      const proj = kaizens.find(k => k.id === id);
      onDeleteKaizen(id);
      if (proj) {
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
  const handleOpenFinancials = (proj: KaizenCard) => {
    setEditingFinancialsProjId(proj.id);
    setFinancialsInput(proj.financialsInput || defaultFinancialsInput());
  };

  const handleSaveFinancials = () => {
    if (!editingFinancialsProjId) return;
    const proj = kaizens.find(k => k.id === editingFinancialsProjId);
    if (!proj) return;

    // Calculate dynamic realized savings
    let totalRealizedSavings = 0;
    Object.values(financialsInput).forEach((indicator: any) => {
      totalRealizedSavings += Number(indicator.val || 0);
    });

    const updated: KaizenCard = {
      ...proj,
      financialsInput,
      actualSavings: totalRealizedSavings
    };

    onUpdateKaizen(updated);
    syncWithGantt(updated, 'update');
    setEditingFinancialsProjId(null);
  };

  // Helper calculation for overall Portföy metrics
  const filteredProjects = kaizens.filter(k => {
    const matchesDept = selectedDeptFilter === "all" || k.department === selectedDeptFilter;
    const matchesPhase = selectedPhaseFilter === "all" || k.phase === selectedPhaseFilter;
    return matchesDept && matchesPhase;
  });

  const totalCIProjects = filteredProjects.length;
  const totalBeforeAfterStudies = filteredProjects.reduce((sum, k) => sum + (k.beforeAfterStudies?.length || 0), 0);

  // Flat, portfolio-wide gallery of every saved Önce-Sonra (Before-After) study across all CI
  // projects — previously these were only visible one-by-one inside each project's own detail
  // modal (Section 9), with no way to browse them all in one place.
  const allBeforeAfterStudies = filteredProjects
    .flatMap(k => (k.beforeAfterStudies || []).map(s => ({ study: s, projectId: k.id, projectTitle: k.title })))
    .sort((a, b) => (b.study.date || "").localeCompare(a.study.date || ""));
  const inProgressProjects = filteredProjects.filter(k => k.status === "In Progress" && k.kanbanStatus !== "ACT").length;
  const completedProjects = filteredProjects.filter(k => k.status === "Completed" || k.kanbanStatus === "ACT").length;
  const pendingProjects = filteredProjects.filter(k => k.status === "Draft" || k.kanbanStatus === "PLAN").length;
  
  // Calculate At Risk / Delayed
  const atRiskProjects = filteredProjects.filter(k => k.impactLevel === "High" && k.status === "In Progress").length;
  const delayedProjects = filteredProjects.filter(k => {
    if (k.status === "Completed") return false;
    if (!k.plannedFinishDate) return false;
    return new Date(k.plannedFinishDate) < new Date();
  }).length;

  const totalExpectedFinancialGain = filteredProjects.reduce((sum, k) => {
    const opp = opportunitiesList.find(o => o.id === k.opportunityId);
    return sum + (typeof k.expectedGain === "number" ? k.expectedGain : opp ? opp.expectedGain : (k.actualSavings ? k.actualSavings * 1.2 : 0));
  }, 0);

  const realizedFinancialGain = filteredProjects.reduce((sum, k) => sum + (k.actualSavings || 0), 0);
  const totalCOPQReduction = Math.round(realizedFinancialGain * 0.72); // 72% of gains count as COPQ elimination
  
  // Plant profit increase contribution and customer operating profit
  const estimatedOperatingProfit = selectedCustomer?.annualRevenue 
    ? Math.round(selectedCustomer.annualRevenue * 0.12)
    : 12000000;

  const profitImpactPercentage = estimatedOperatingProfit > 0
    ? ((realizedFinancialGain / estimatedOperatingProfit) * 100).toFixed(2)
    : "0.00";

  // COPQ calculation from VSM process records
  const initialCOPQ = processes && processes.length > 0
    ? processes.reduce((sum, p) => sum + (p.scrapCost || 0) + (p.reworkCost || 0) + (p.downtimeCost || 0), 0)
    : 4500000;

  const copqReductionPercentage = initialCOPQ > 0
    ? ((totalCOPQReduction / initialCOPQ) * 100).toFixed(2)
    : "0.00";

  const averageProjectSuccessRate = totalCIProjects > 0 
    ? Math.round((filteredProjects.filter(k => k.status === "Completed" || k.kanbanStatus === "ACT").length / totalCIProjects) * 100) 
    : 0;

  const totalBudget = filteredProjects.reduce((sum, k) => sum + (k.estimatedCost || 0), 0);
  const realizedToBudgetRatio = totalBudget > 0 
    ? (realizedFinancialGain / totalBudget).toFixed(2)
    : "0.00";
  const netROIAmount = realizedFinancialGain - totalBudget;
  const totalROI = totalBudget > 0 ? ((realizedFinancialGain / totalBudget) * 100).toFixed(1) : "0.0";

  // Category mapping helper for deep insights
  const getKaizenCategory = (proj: KaizenCard) => {
    const title = (proj.title || "").toLowerCase();
    const desc = ((proj.description || "") + " " + (proj.descriptionBefore || "")).toLowerCase();
    const oppType = (proj.opportunityType || "").toLowerCase();
    
    if (oppType.includes("kalite") || title.includes("kalite") || desc.includes("kalite") || desc.includes("rework") || title.includes("hata") || desc.includes("hata") || desc.includes("düzeltme")) {
      return "Kalite";
    }
    if (oppType.includes("isg") || title.includes("isg") || desc.includes("isg") || desc.includes("güvenlik") || title.includes("güvenlik") || desc.includes("iş sağlığı")) {
      return "İSG (HSE)";
    }
    if (oppType.includes("hurda") || title.includes("hurda") || desc.includes("hurda") || oppType.includes("scrap") || title.includes("scrap") || desc.includes("fire") || title.includes("fire") || desc.includes("kayıp")) {
      return "Hurda / Fire";
    }
    if (oppType.includes("verimlilik") || title.includes("verimlilik") || desc.includes("verimlilik") || title.includes("oee") || desc.includes("oee") || title.includes("smed") || desc.includes("smed") || desc.includes("setup")) {
      return "Verimlilik";
    }
    if (oppType.includes("üretkenlik") || title.includes("üretkenlik") || desc.includes("üretkenlik") || desc.includes("kapasite") || desc.includes("hız") || title.includes("hız")) {
      return "Üretkenlik";
    }
    return "Diğer / Operasyonel";
  };

  // Categories Distribution Data
  const categoriesList = ["Kalite", "Verimlilik", "İSG (HSE)", "Hurda / Fire", "Üretkenlik", "Diğer / Operasyonel"];
  const categoryDistributionData = categoriesList.map(cat => {
    const list = filteredProjects.filter(k => getKaizenCategory(k) === cat);
    const count = list.length;
    const gain = list.reduce((sum, k) => sum + (k.actualSavings || 0), 0);
    const totalCount = filteredProjects.length || 1;
    const ratio = Math.round((count / totalCount) * 100);
    return { name: cat, Adet: count, Kazanım: gain, Oran: ratio };
  }).filter(c => c.Adet > 0);

  // Power BI Dashboard Charts Formatting
  const chartStatusData = [
    { name: "Plan", value: pendingProjects, color: "#94a3b8" },
    { name: "Do (Uygulama)", value: inProgressProjects, color: "#3b82f6" },
    { name: "Check (Kontrol)", value: filteredProjects.filter(k => k.kanbanStatus === "CHECK").length, color: "#f59e0b" },
    { name: "Act (Standartlaştır)", value: completedProjects, color: "#10b981" }
  ];

  const chartPhaseData = [
    { name: "Quick Win (0-3m)", value: filteredProjects.filter(k => k.phase?.includes("Phase 1")).length, color: "#10b981" },
    { name: "Capital Improvement (3-12m)", value: filteredProjects.filter(k => k.phase?.includes("Phase 2")).length, color: "#f59e0b" },
    { name: "Strategic Transformation (1-3y)", value: filteredProjects.filter(k => k.phase?.includes("Phase 3")).length, color: "#3b82f6" }
  ];

  const chartExpectedRealized = [
    { name: "Planlanan Hedef", Tutarı: totalExpectedFinancialGain },
    { name: "Gerçekleşen Tasarruf", Tutarı: realizedFinancialGain }
  ];

  // Plant profit increase contribution variable for the KPI grid
  const operatingProfitIncrease = realizedFinancialGain;

  // Phase Maturity Count mappings for the Phase Delivery gauge
  const phase1Count = filteredProjects.filter(k => k.phase?.includes("Phase 1") || !k.phase).length;
  const phase2Count = filteredProjects.filter(k => k.phase?.includes("Phase 2")).length;
  const phase3Count = filteredProjects.filter(k => k.phase?.includes("Phase 3")).length;

  const departmentGainData = Array.from(new Set(kaizens.map(k => k.department))).map(dept => {
    const gain = kaizens.filter(k => k.department === dept).reduce((sum, k) => sum + (k.actualSavings || 0), 0);
    return { name: dept, Kazanım: gain };
  }).filter(d => d.Kazanım > 0);

  const opportunityDistribution = Array.from(new Set(kaizens.map(k => k.opportunityType || "Kaizen"))).map(type => {
    const count = kaizens.filter(k => (k.opportunityType || "Kaizen") === type).length;
    return { name: type, ProjeAdedi: count };
  });

  // Funnel Steps (Opportunities -> Converted -> In Progress -> Completed) — every stage below is a
  // real count from real fields, no invented padding (previously "+4" opportunities and "completed-1
  // approved" were fabricated numbers with no data behind them).
  const inProgressProjectsCount = filteredProjects.filter(k => k.status === "In Progress").length;
  const funnelBase = Math.max(1, opportunitiesList.length);
  const funnelSteps = [
    { name: "Fırsatlar (Opportunities)", count: opportunitiesList.length, percent: 100, desc: "Sistemde tespit edilen israf/iyileştirme kalemleri", color: "bg-slate-700" },
    { name: "Projeye Dönüşen (Converted)", count: totalCIProjects, percent: Math.round((totalCIProjects / funnelBase) * 100), desc: "Kanban tahtasında açılan projeler", color: "bg-indigo-650" },
    { name: "Devam Eden (In Progress)", count: inProgressProjectsCount, percent: Math.round((inProgressProjectsCount / funnelBase) * 100), desc: "Aksiyonları süren projeler", color: "bg-indigo-500" },
    { name: "Tamamlanan (Completed)", count: completedProjects, percent: Math.round((completedProjects / funnelBase) * 100), desc: "Aksiyonları bitip standartlaşanlar", color: "bg-emerald-600" }
  ];

  // Historical trend — the Financial Dashboard was current-state-only (no month-over-month view).
  // Derived entirely from real project dates already on each KaizenCard (dateProposed for when a
  // project was opened, realizedFinishDate + actualSavings for when it actually closed), not a
  // separately-tracked snapshot — no new backend persistence needed for this.
  const monthlyTrendData = React.useMemo(() => {
    const monthMap: Record<string, { opened: number; closed: number; realizedGain: number }> = {};
    const ensure = (key: string) => {
      if (!monthMap[key]) monthMap[key] = { opened: 0, closed: 0, realizedGain: 0 };
      return monthMap[key];
    };
    filteredProjects.forEach(p => {
      if (p.dateProposed) ensure(p.dateProposed.slice(0, 7)).opened += 1;
      if (p.realizedFinishDate) {
        const entry = ensure(p.realizedFinishDate.slice(0, 7));
        entry.closed += 1;
        entry.realizedGain += (p.actualSavings || 0);
      }
    });
    const sortedKeys = Object.keys(monthMap).sort();
    let cumulative = 0;
    return sortedKeys.map(key => {
      cumulative += monthMap[key].realizedGain;
      return {
        Ay: key,
        "Açılan Proje": monthMap[key].opened,
        "Kapanan Proje": monthMap[key].closed,
        "Kümülatif Gerçekleşen Tasarruf": cumulative
      };
    });
  }, [filteredProjects]);

  // Document upload (Section 8) — previously only kept {name, fileType, size, uploadDate} metadata
  // while claiming the file would be "automatically archived on the server". Now genuinely persists
  // the file content (same base64-embed technique renderPhotoUploadSection already uses for photos
  // below), so a document can actually be reopened after a reload.
  const MAX_DOCUMENT_SIZE_MB = 8;
  const handleDocumentFiles = (files: File[]) => {
    const accepted = files.filter(file => {
      if (file.size > MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
        alert(`"${file.name}" dosyası ${MAX_DOCUMENT_SIZE_MB} MB sınırını aşıyor ve yüklenmedi.`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;

    Promise.all(accepted.map(file => new Promise<any>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        resolve({
          id: `doc_${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          fileType: ext,
          size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
          uploadDate: new Date().toISOString().split('T')[0],
          data: typeof reader.result === "string" ? reader.result : ""
        });
      };
      reader.readAsDataURL(file);
    }))).then(newDocs => {
      setEditDocuments(prev => [...prev, ...newDocs]);
    });
  };

  // Photo Upload Helper for Section 2 and Section 7 (Camera & Gallery Support for Tablets/Mobiles)
  const renderPhotoUploadSection = (
    sectionTitle: string,
    sectionSubtitle: string,
    photos: string[],
    onAddPhotos: (newPhotos: string[]) => void,
    onRemovePhoto: (index: number) => void
  ) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const files = Array.from(e.target.files);
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            onAddPhotos([reader.result]);
          }
        };
        reader.readAsDataURL(file);
      });
      e.target.value = "";
    };

    return (
      <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-3 mt-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-indigo-600" />
              <span>{sectionTitle}</span>
            </span>
            <p className="text-[10px] text-slate-500 mt-0.5">{sectionSubtitle}</p>
          </div>
          <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
            {photos.length} Fotoğraf Ekli
          </span>
        </div>

        {/* Buttons for Mobile/Tablet Camera & Gallery Selection */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Camera Capture (Rear Camera for Gemba inspection) */}
          <label className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors">
            <Camera className="w-3.5 h-3.5 text-indigo-100" />
            <span>Kamera ile Fotoğraf Çek</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {/* Photo Gallery Picker */}
          <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Galeriden / Dosyalardan Seç</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Photo Thumbnail Preview Grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative group bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
                <img
                  src={photo}
                  alt={`Görsel ${idx + 1}`}
                  onClick={() => setLightboxPhoto({ url: photo, title: `${sectionTitle} - Fotoğraf #${idx + 1}` })}
                  className="w-full h-20 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(idx)}
                  className="absolute top-2 right-2 bg-rose-600/90 text-white rounded-full p-1 opacity-90 group-hover:opacity-100 hover:bg-rose-700 transition-all cursor-pointer shadow-xs"
                  title="Fotoğrafı Sil"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="mt-1 flex justify-between items-center px-1 text-[11px] text-slate-500 font-mono">
                  <span>Foto #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setLightboxPhoto({ url: photo, title: `${sectionTitle} - Fotoğraf #${idx + 1}` })}
                    className="text-indigo-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <ZoomIn className="w-2.5 h-2.5" />
                    <span>Büyüt</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Shared autocomplete source for all team/assignee text inputs — real consultants/customer
          users from this customer's team, with free text still allowed (e.g. floor staff not in
          the system). Datalist just needs to exist once in the DOM; every input references it by id. */}
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

      {/* HEADER ROW WITH LAUNCH ACTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight text-slate-900 flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
            <span>CI Proje Yönetimi (Continuous Improvement Portfolio)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            VSM, COPQ ve Recovery Matrix çıktılarından filtrelenen fırsatları projeye dönüştürerek yönetin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPortfolioExcel}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer"
            title="Tüm portföyü Excel olarak indir"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportPortfolioPdf}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer"
            title="Tüm portföyü PDF olarak indir"
          >
            <FileText className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ CI Projesi Başlat</span>
          </button>
        </div>
      </div>

      {/* 10 MODERN KPI CARDS (Power BI Style) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Toplam Proje</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-slate-800">{totalCIProjects}</div>
            <span className="text-[11px] text-slate-400">Aktif CI Proje Hacmi</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-300"></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Devam Eden</span>
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-blue-600">{inProgressProjects}</div>
            <span className="text-[11px] text-slate-400">Do/Check Aşamasında</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Tamamlanan</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-emerald-600">{completedProjects}</div>
            <span className="text-[11px] text-slate-400">Standartlaşan Projeler</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Bekleyen</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-amber-600">{pendingProjects}</div>
            <span className="text-[11px] text-slate-400">Planlama Aşamasında</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-purple-500 font-bold uppercase tracking-wider">Geciken</span>
            <Clock className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-purple-600">{delayedProjects}</div>
            <span className="text-[11px] text-slate-400">Termini Geçmiş</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500"></div>
        </div>

        {/* FINANCIAL METRICS ROW */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Beklenen Finansal Kazanç</span>
            <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div>
            <div className="text-xl font-mono font-bold text-indigo-950">
              {currency}{totalExpectedFinancialGain.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400">Fırsat Toplamı</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500"></div>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Gerçekleşen Kazanım</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xl font-mono font-bold text-emerald-700">
              {currency}{realizedFinancialGain.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400">Gerçek P&L Teyidi</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600"></div>
        </div>

        <div className="bg-cyan-50/50 border border-cyan-100 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-cyan-700 font-bold uppercase tracking-wider">Toplam COPQ Azalışı</span>
            <Percent className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div>
            <div className="text-xl font-mono font-bold text-cyan-700">
              {currency}{totalCOPQReduction.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400">Kalitesizlik Maliyeti</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-500"></div>
        </div>

        <div className="bg-violet-50/50 border border-violet-100 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-violet-700 font-bold uppercase tracking-wider">Faaliyet Karı Artışı</span>
            <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <div>
            <div className="text-xl font-mono font-bold text-violet-700">
              +{currency}{operatingProfitIncrease.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400">P&L Katkı Oranı</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-violet-600"></div>
        </div>

        <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Proje Başarı Oranı</span>
            <Percent className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div>
            <div className="text-xl font-mono font-bold text-slate-700">{averageProjectSuccessRate}%</div>
            <span className="text-[11px] text-slate-400">Kapatılma Oranı</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-500"></div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[105px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] text-pink-600 font-bold uppercase tracking-wider">Önce-Sonra Kaizen</span>
            <Camera className="w-3.5 h-3.5 text-pink-500" />
          </div>
          <div>
            <div className="text-2xl font-mono font-bold text-pink-600">{totalBeforeAfterStudies}</div>
            <span className="text-[11px] text-slate-400">Oluşturulan Form Sayısı</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-pink-500"></div>
        </div>

      </div>

      {/* GECİKME TAKİP & HAFTALIK CI UYARI PANELİ */}
      {delayedProjects > 0 && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
              <h3 className="font-bold text-sm text-rose-950 tracking-tight">Gecikme & Haftalık Takip Uyarı Paneli (Weekly Alert Hub)</h3>
            </div>
            <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
              {delayedProjects} Kritik Gecikme Saptanmıştır
            </span>
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">
            Aşağıdaki sürekli iyileştirme projelerinde planlanan bitiş tarihleri aşılmıştır. Sistem haftalık süreç takibi verilerine göre gecikme sürelerini hesaplamış ve uyarı durumunu aktif etmiştir:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredProjects.filter(k => {
              if (k.status === "Completed") return false;
              if (!k.plannedFinishDate) return false;
              return new Date(k.plannedFinishDate) < new Date();
            }).map(proj => {
              const weeks = getDelayWeeksSinceDeadline(proj.plannedFinishDate!);
              return (
                <div key={proj.id} className="bg-white border border-rose-150 rounded-xl p-3.5 flex flex-col justify-between space-y-3 shadow-3xs hover:shadow-2xs transition-all border-l-4 border-l-red-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="bg-red-100 text-red-800 text-[11px] font-bold uppercase px-1.5 py-0.2 rounded">Kritik Gecikme</span>
                        <span className="text-[10px] font-bold text-slate-500 font-mono">{getProjectNo(proj)}</span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-800 tracking-tight mt-1">{proj.title}</h4>
                    </div>
                    <span className="bg-red-100 text-red-800 text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-lg flex items-center space-x-1 animate-pulse">
                      <span>{weeks} Hafta Gecikti</span>
                    </span>
                  </div>
                  
                  {/* Miniature Weekly Progress Bar */}
                  <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-100">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Haftalık Otomatik Süreç Takip Durumu</span>
                      <span className="text-red-600 font-bold">Planlanandan +{weeks} Hafta Sapma</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full" style={{ width: `${Math.min(100, weeks * 12)}%` }}></div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                    <span>Sorumlu Lider: <strong className="text-slate-700">{proj.projectLeader || proj.originator}</strong></span>
                    <span>Planlanan Termin: <strong className="text-slate-700">{proj.plannedFinishDate}</strong></span>
                  </div>
                  
                  <div className="flex space-x-2 pt-2.5 border-t border-slate-100 justify-end">
                    <button
                      type="button"
                      onClick={() => handleOpenProjectDetails(proj)}
                      className="text-[10px] font-bold text-slate-600 hover:text-slate-800 px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer transition-all hover:bg-slate-100"
                    >
                      Kartı Aç & Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => logManualReminder(proj)}
                      className="text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-3.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer shadow-sm transition-all"
                    >
                      <span>📌 Hatırlatma Kaydet</span>
                      {proj.emailSentCount && proj.emailSentCount > 0 && (
                        <span className="bg-white/20 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full">
                          {proj.emailSentCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER & CONTROL TOOLBAR */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* View selection tabs */}
        <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("kanban")}
            className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "kanban" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Kanban (PDCA) Panosu
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "list" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Liste Görünümü
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "timeline" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Timeline (Gantt)
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "dashboard" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Finansal Dashboard
          </button>
          <button
            onClick={() => setActiveTab("beforeafter")}
            className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "beforeafter" ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Önce-Sonra Galerisi
          </button>
        </div>

        {/* Global Select Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none text-slate-700 font-bold"
            >
              <option value="all">Tüm Departmanlar</option>
              {Array.from(new Set(kaizens.map(k => k.department))).map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <select
            value={selectedPhaseFilter}
            onChange={(e) => setSelectedPhaseFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none text-slate-700 font-bold"
          >
            <option value="all">Tüm Fazlar</option>
            <option value="Phase 1: Quick Win">Phase 1: Quick Win (0-3 Ay)</option>
            <option value="Phase 2: Capital Improvement">Phase 2: Capital Improvement (3-12 Ay)</option>
            <option value="Phase 3: Strategic Transformation">Phase 3: Strategic Transformation (1-3 Yıl)</option>
          </select>
        </div>

      </div>

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
                      const opp = opportunitiesList.find(o => o.id === proj.opportunityId);
                      const expected = typeof proj.expectedGain === "number" ? proj.expectedGain : opp ? opp.expectedGain : (proj.actualSavings ? proj.actualSavings * 1.2 : 0);
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
                          
                          {/* Phase tag & Edit button */}
                          <div className="flex justify-between items-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                              proj.phase?.includes("Quick") ? "bg-emerald-100 text-emerald-800" :
                              proj.phase?.includes("Capital") ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                            }`}>
                              {proj.phase || "Phase 1: Quick Win"}
                            </span>
                            
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
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm("Bu sürekli iyileştirme projesini silmek istediğinizden emin misiniz?")) {
                                    onDeleteKaizen(proj.id);
                                    syncWithGantt(proj, 'delete');
                                  }
                                }}
                                className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-slate-100 transition-all cursor-pointer"
                                title="Projeyi Sil"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
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
                              <span className="font-bold text-slate-700">{currency}{expected.toLocaleString()}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] text-slate-400 block uppercase">Gerçekleşen</span>
                              <span className="font-bold text-emerald-600">{currency}{realized.toLocaleString()}</span>
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
                const opp = opportunitiesList.find(o => o.id === proj.opportunityId);
                const expected = typeof proj.expectedGain === "number" ? proj.expectedGain : opp ? opp.expectedGain : (proj.actualSavings ? proj.actualSavings * 1.2 : 0);
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
                      <span className="font-mono text-slate-600">Bütçe: {currency}{(proj.estimatedCost || 0).toLocaleString()}</span>
                      <span className="font-mono font-bold text-emerald-600">Gerçekleşen: {currency}{realized.toLocaleString()}</span>
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
                      <button onClick={() => handleDeleteProject(proj.id)} className="p-1.5 text-red-500" title="Sil">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                    const opp = opportunitiesList.find(o => o.id === proj.opportunityId);
                    const expected = typeof proj.expectedGain === "number" ? proj.expectedGain : opp ? opp.expectedGain : (proj.actualSavings ? proj.actualSavings * 1.2 : 0);
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
                          proj.phase?.includes("Quick") ? "bg-emerald-100 text-emerald-800" :
                          proj.phase?.includes("Capital") ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {proj.phase?.split(":")[0] || "Phase 1"}
                        </span>
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
                        {currency}{(proj.estimatedCost || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {currency}{realized.toLocaleString()}
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
                        <button 
                          onClick={() => handleDeleteProject(proj.id)}
                          className="p-2 text-slate-400 hover:text-red-500 inline-block"
                          title="Projeyi Sil"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* 4. FINANCIAL & ANALYTICAL DASHBOARD VIEW (Power BI Style) */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          
          {/* Summary Bar - Deep Financial Business Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Faaliyet Karı Etkisi */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[125px]">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Faaliyet Karı Etkisi</span>
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-slate-900">+{profitImpactPercentage}%</div>
                <div className="text-xs font-semibold text-indigo-600 mt-0.5">+{currency}{realizedFinancialGain.toLocaleString()} Toplam Getiri</div>
              </div>
              <span className="text-[11px] text-slate-400">Fabrika Yıllık Faaliyet Karı Katkısı ({currency}{estimatedOperatingProfit.toLocaleString()})</span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600"></div>
            </div>

            {/* COPQ Etkisi */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[125px]">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">COPQ (Kötü Kalite Maliyeti) Azaltımı</span>
                <Percent className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-slate-900">-{copqReductionPercentage}% COPQ</div>
                <div className="text-xs font-semibold text-emerald-600 mt-0.5">-{currency}{totalCOPQReduction.toLocaleString()} Kalite Tasarrufu</div>
              </div>
              <span className="text-[11px] text-slate-400">VSM ve Hurda Kaynaklı COPQ Etkisi ({currency}{initialCOPQ.toLocaleString()})</span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"></div>
            </div>

            {/* Yatırım Getiri Katsayısı ve ROI Miktarı */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-2xs relative overflow-hidden flex flex-col justify-between h-[125px]">
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Yatırım Getirisi & ROI Katsayısı</span>
                <DollarSign className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-slate-900">{realizedToBudgetRatio}x Katsayı</div>
                <div className="text-xs font-semibold text-amber-600 mt-0.5">Net ROI: +{currency}{netROIAmount.toLocaleString()}</div>
              </div>
              <span className="text-[11px] text-slate-400">Toplam Yatırım Bütçesi: {currency}{totalBudget.toLocaleString()}</span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500"></div>
            </div>

          </div>

          {/* Categories & Phase Maturity Distributions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left/Middle Card: Category Breakdown and Savings (Quality, Efficiency, HSE, Scrap, Productivity) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Kategorilere Göre İyileştirme Oranları & Dağılımı</h3>
                  <p className="text-[10px] text-slate-400">Kalite, Verimlilik, İSG, Hurda ve Üretkenlik kırılımlı CI performansları</p>
                </div>
                <BarChart2 className="w-4 h-4 text-slate-400" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                {/* Horizontal progress indicators */}
                <div className="space-y-3.5">
                  {categoryDistributionData.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic">Kategoriye ait proje bulunamadı.</div>
                  ) : (
                    categoryDistributionData.map(c => {
                      const percentWidth = Math.max(8, c.Oran);
                      return (
                        <div key={c.name} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-700 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${
                                c.name === "Kalite" ? "bg-rose-500" :
                                c.name === "Verimlilik" ? "bg-indigo-500" :
                                c.name === "İSG (HSE)" ? "bg-emerald-500" :
                                c.name === "Hurda / Fire" ? "bg-amber-500" :
                                c.name === "Üretkenlik" ? "bg-cyan-500" : "bg-slate-400"
                              }`}></span>
                              {c.name} ({c.Adet} Proje)
                            </span>
                            <span className="text-slate-900">{currency}{c.Kazanım.toLocaleString()} ({c.Oran}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                            <div 
                              className={`h-full rounded-full ${
                                c.name === "Kalite" ? "bg-rose-500" :
                                c.name === "Verimlilik" ? "bg-indigo-500" :
                                c.name === "İSG (HSE)" ? "bg-emerald-500" :
                                c.name === "Hurda / Fire" ? "bg-amber-500" :
                                c.name === "Üretkenlik" ? "bg-cyan-500" : "bg-slate-400"
                              }`}
                              style={{ width: `${percentWidth}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Visual Chart representation */}
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <Tooltip formatter={(value) => [`${currency}${Number(value).toLocaleString()}`, "Birikimli Kazanım"]} />
                      <Bar dataKey="Kazanım" radius={[6, 6, 0, 0]}>
                        {categoryDistributionData.map((entry, index) => {
                          let color = "#94a3b8";
                          if (entry.name === "Kalite") color = "#f43f5e";
                          if (entry.name === "Verimlilik") color = "#6366f1";
                          if (entry.name === "İSG (HSE)") color = "#10b981";
                          if (entry.name === "Hurda / Fire") color = "#f59e0b";
                          if (entry.name === "Üretkenlik") color = "#06b6d4";
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right Card: Phase Maturity Levels (Maturity progression) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">CI Olgunluk Seviyesi (Phase Tracker)</h3>
                  <p className="text-[10px] text-slate-400">Takımın karmaşık iyileştirme seviyelerine ilerleme analizi</p>
                </div>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>

              <div className="space-y-4 py-2">
                {/* Phase 1 */}
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase">Faz 1: Quick Win</span>
                    <p className="text-[11px] text-slate-500">Hızlı kazanımlı, düşük maliyetli kaizenler</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-mono font-bold text-emerald-600">{phase1Count}</span>
                    <span className="text-[10px] text-slate-400 block">Proje Adedi</span>
                  </div>
                </div>

                {/* Phase 2 */}
                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase">Faz 2: Capital Improvement</span>
                    <p className="text-[11px] text-slate-500">Orta vadeli verimlilik ve ekipman yatırımı</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-mono font-bold text-amber-600">{phase2Count}</span>
                    <span className="text-[10px] text-slate-400 block">Proje Adedi</span>
                  </div>
                </div>

                {/* Phase 3 */}
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase">Faz 3: Strategic Transformation</span>
                    <p className="text-[11px] text-slate-500">Uzun vadeli, VSM köklü yapısal değişim</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-mono font-bold text-blue-600">{phase3Count}</span>
                    <span className="text-[10px] text-slate-400 block">Proje Adedi</span>
                  </div>
                </div>

                {/* Growth insight */}
                <div className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-indigo-500" />
                  <span>
                    {phase2Count + phase3Count > 0 
                      ? `Fabrika ekibiniz ${phase2Count + phase3Count} adet orta/ileri seviye (Faz 2 & 3) iyileştirme yürüterek metodolojik yetkinliğini artırmaktadır.`
                      : "Gelişim Seviyesi İzlenimi: Henüz başlangıç aşamasındaki Quick-Win projelerine odaklanılmış durumdadır. Faz 2 projeleri teşvik edilmelidir."}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Project Success & Conversion Target Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Açılan ve Kapatılan Proje Oranı (Success Rate) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Proje Açılış vs Kapanış Oranı</h3>
                  <p className="text-[10px] text-slate-400">Hattın problem çözme hızı ve proje sonlandırma başarısı</p>
                </div>
                <CheckCircle className="w-4 h-4 text-slate-400" />
              </div>

              <div className="grid grid-cols-3 gap-4 items-center pt-2">
                
                {/* Visual Circle Gauge */}
                <div className="col-span-1 flex flex-col items-center justify-center relative">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                      <circle cx="48" cy="48" r="40" stroke="#10b981" strokeWidth="8" fill="transparent"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * averageProjectSuccessRate) / 100}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-mono font-bold text-slate-900">{averageProjectSuccessRate}%</span>
                      <span className="text-[11px] text-slate-400 font-bold uppercase">Başarı</span>
                    </div>
                  </div>
                </div>

                {/* Pipeline Stats List */}
                <div className="col-span-2 space-y-3 font-sans text-xs">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                    <span className="text-slate-500 font-medium">Toplam Açılan (Converted)</span>
                    <span className="font-mono font-bold text-slate-900">{totalCIProjects} Adet</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                    <span className="text-slate-500 font-medium">Aktif Devam Eden (In Progress)</span>
                    <span className="font-mono font-bold text-blue-600">{inProgressProjects} Adet</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                    <span className="text-slate-500 font-medium">Kapatılan & Onaylanan (Closed)</span>
                    <span className="font-mono font-bold text-emerald-600">{completedProjects} Adet</span>
                  </div>
                  <p className="text-[10px] italic text-slate-400">
                    * Hedeflenen OEE ve setup süresi kazanımlarının standartlaşması için açılan projelerin en az %60'ının kapatılması esastır.
                  </p>
                </div>

              </div>
            </div>

            {/* Target vs Realized savings */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Finansal Hedef vs Gerçekleşen Tasarruf</h3>
                  <p className="text-[10px] text-slate-400">Fizibilite hedeflerine karşılık fiili olarak kaydedilen kazançlar</p>
                </div>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>

              <div className="h-[150px] pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartExpectedRealized}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(val) => [`${currency}${Number(val).toLocaleString()}`, "Değer"]} />
                    <Bar dataKey="Tutarı" radius={[8, 8, 0, 0]}>
                      <Cell fill="#6366f1" />
                      <Cell fill="#10b981" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Visual Improvement Funnel (İyileştirme Hunisi) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Improvement Funnel — İyileştirme Hunisi</h3>
                <p className="text-[10px] text-slate-400">Kayıp fırsatlarının analizden başlayıp kesinleşen finansal tasdik aşamasına dönüşüm hunisi</p>
              </div>
              <Filter className="w-4 h-4 text-slate-500" />
            </div>

            {/* Horizontal Stacked Visual Funnel */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 pt-3">
              {funnelSteps.map((step, index) => {
                // Width gets progressivly smaller in visual representation
                const funnelWidths = ["w-full", "w-11/12 mx-auto", "w-5/6 mx-auto", "w-3/4 mx-auto", "w-2/3 mx-auto"];
                return (
                  <div key={step.name} className="flex flex-col justify-between items-center text-center space-y-2 relative">
                    
                    {/* Visual Funnel Segment */}
                    <div className={`${funnelWidths[index]} ${step.color} p-4 rounded-xl shadow-xs transition-all flex flex-col justify-center items-center min-h-[95px] text-white`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-85">{step.name.split(" ")[0]}</span>
                      <span className="text-2xl font-mono font-bold mt-1">{step.count} <span className="text-xs">Adet</span></span>
                      <span className="text-[11px] mt-1 font-semibold block bg-white/20 px-1.5 py-0.5 rounded">
                        {index === 0 ? "Giriş: %100" : `Dönüşüm: %${step.percent}`}
                      </span>
                    </div>

                    {/* Step description */}
                    <div className="px-2">
                      <span className="text-[10px] text-slate-500 font-medium block leading-tight">{step.desc}</span>
                    </div>

                    {/* Funnel separator arrow for desktop */}
                    {index < 4 && (
                      <div className="hidden md:block absolute top-[30px] -right-[15px] z-10 bg-white border border-slate-200 rounded-full p-0.5 shadow-3xs">
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historical Trend — real month-over-month data (project dateProposed/realizedFinishDate),
              not a current-state-only snapshot. Needs at least 2 distinct months to be meaningful. */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-tight">Zaman İçinde Gelişim — Aylık Trend</h3>
                <p className="text-[10px] text-slate-400">Açılan/kapanan proje sayısı ve kümülatif gerçekleşen tasarruf, gerçek proje tarihlerinden türetilmiştir</p>
              </div>
              <Calendar className="w-4 h-4 text-slate-500" />
            </div>

            {monthlyTrendData.length >= 2 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyTrendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="Ay" tick={{ fill: "#475569", fontSize: 9 }} />
                    <YAxis yAxisId="left" tick={{ fill: "#475569", fontSize: 9 }} label={{ value: 'Proje Adedi', angle: -90, position: 'insideLeft', fill: "#475569", fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: "#475569", fontSize: 9 }} label={{ value: `Kümülatif (${currency})`, angle: 90, position: 'insideRight', fill: "#475569", fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: "0.75rem", fontSize: "11px" }} />
                    <Legend wrapperStyle={{ fontSize: "10px" }} />
                    <Bar yAxisId="left" dataKey="Açılan Proje" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar yAxisId="left" dataKey="Kapanan Proje" fill="#10b981" radius={[4, 4, 0, 0]} barSize={18} />
                    <Line yAxisId="right" type="monotone" dataKey="Kümülatif Gerçekleşen Tasarruf" stroke="#be123c" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-10 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                <Info className="w-6 h-6 text-slate-350 mb-2" />
                <p className="text-xs font-bold text-slate-500">
                  {monthlyTrendData.length === 0
                    ? "Henüz tarihli proje verisi yok."
                    : "Trend grafiği için en az 2 farklı ay gerekli."}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-md">
                  Projeler açıldıkça ve tamamlandıkça bu grafik zaman içindeki gelişimi gösterecek.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 5. ÖNCE-SONRA (BEFORE-AFTER) KAIZEN GALLERY — every saved "Kaizen Öncesi Sonrası"
          one-pager across all CI projects, browsable in one place instead of buried one-by-one
          inside each project's own detail modal. */}
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

      {/* LAUNCH CI PROJECT WIZARD MODAL */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden border border-slate-200">
            
            {/* Wizard Header */}
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight">
                  CI Proje Başlatma ve Fırsat Seçim Paneli
                </h3>
              </div>
              <button 
                onClick={() => { setIsWizardOpen(false); }} 
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-0 flex flex-col">
              {pendingCreation ? (
                <>
                  {/* TEAM ASSIGNMENT STEP — shown before the project is actually created, so it
                      never ends up with an empty projectTeam and no leader picked. */}
                  <div className="p-6 space-y-4 max-h-[520px] overflow-y-auto">
                    <div className="bg-indigo-50/80 border border-indigo-200/90 rounded-2xl p-4">
                      <h4 className="text-xs font-black text-indigo-900 uppercase mb-1">
                        {pendingCreation.mode === "opportunity" ? `Fırsat: ${pendingCreation.opp?.type}` : "Yeni Proje"}
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        Proje oluşturulmadan önce sorumlu lider, ekip ve termin bilgilerini girin.
                      </p>
                    </div>

                    {pendingCreation.mode === "blank" && (
                      <div className="space-y-1">
                        <label className="block text-slate-500 font-bold text-xs mb-1">Proje Başlığı *</label>
                        <input
                          type="text"
                          value={assignTitle}
                          onChange={(e) => setAssignTitle(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-slate-500 font-bold text-xs mb-1">Proje Lideri *</label>
                        <input
                          type="text"
                          list="ci-team-directory"
                          value={assignLeader}
                          onChange={(e) => setAssignLeader(e.target.value)}
                          placeholder="Lider seçin veya yazın"
                          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-500 font-bold text-xs mb-1">Departman</label>
                        <input
                          type="text"
                          value={assignDepartment}
                          onChange={(e) => setAssignDepartment(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-slate-500 font-bold text-xs mb-1">Proje Ekibi</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          list="ci-team-directory"
                          value={assignTeamInput}
                          onChange={(e) => setAssignTeamInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAssignTeamMember(); } }}
                          placeholder="Ekip üyesi seçin veya yazın, Enter'a basın"
                          className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={handleAddAssignTeamMember}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                        >
                          Ekle
                        </button>
                      </div>
                      {assignTeamMembers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {assignTeamMembers.map(member => (
                            <span key={member} className="text-[11px] bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg flex items-center gap-1.5">
                              {member}
                              <button type="button" onClick={() => handleRemoveAssignTeamMember(member)} className="text-slate-400 hover:text-rose-600 cursor-pointer font-bold">✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-slate-500 font-bold text-xs mb-1">Hedef Bitiş Tarihi</label>
                      <input
                        type="date"
                        value={assignDeadline}
                        onChange={(e) => setAssignDeadline(e.target.value)}
                        className="w-full sm:w-1/2 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setPendingCreation(null)}
                      className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      Geri
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmProjectCreation}
                      disabled={!assignLeader.trim() || (pendingCreation.mode === "blank" && !assignTitle.trim())}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                    >
                      Projeyi Oluştur ve Ata
                    </button>
                  </div>
                </>
              ) : (
              <>
              {/* Selection Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50/50">
                <button
                  type="button"
                  className="flex-1 py-4 text-center text-xs font-bold transition-all border-b-2 border-indigo-600 text-indigo-600 bg-white flex items-center justify-center space-x-2"
                >
                  <span>📂 Fırsat Havuzu Konuları (VSM & Loss Capacity)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectNewProjectTheme()}
                  className="flex-1 py-4 text-center text-xs font-bold transition-all border-b-2 border-transparent text-slate-500 hover:text-indigo-600 hover:bg-slate-50 flex items-center justify-center space-x-2 cursor-pointer"
                  title="Boş bir CI Proje Tanımlama formu başlatır."
                >
                  <span>✨ Yeni Proje Teması (Boş Form)</span>
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[520px] overflow-y-auto">
                {/* Data Source & Product Family Selector Banner */}
                <div className="bg-indigo-50/80 border border-indigo-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-200/60 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className={`font-bold px-2.5 py-1 rounded-md text-[10px] font-mono border flex items-center gap-1.5 shadow-3xs ${
                        isRealLossCapacityData
                          ? "text-emerald-700 bg-emerald-100 border-emerald-300"
                          : isEmptyOpportunityData
                            ? "text-slate-500 bg-slate-100 border-slate-300"
                            : isAssumedOpportunityData
                              ? "text-amber-700 bg-amber-100 border-amber-300"
                              : "text-slate-700 bg-slate-100 border-slate-300"
                      }`}>
                        {isRealLossCapacityData ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        <span>Veri Kaynağı: {activeOpportunitySource}</span>
                      </span>
                      <span className="text-xs text-indigo-900 font-bold hidden sm:inline">
                        — CI Proje Yönetimi Fırsat Havuzu
                      </span>
                    </div>

                    {/* Product Family Dropdown Selector */}
                    <div className="flex items-center space-x-2">
                      <label htmlFor="product-family-select" className="font-bold text-slate-700 text-xs flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Ürün Ailesi Kapsamı:</span>
                      </label>
                      <select
                        id="product-family-select"
                        value={selectedProductFamily}
                        onChange={(e) => setSelectedProductFamily(e.target.value)}
                        className="bg-white border border-indigo-300 rounded-xl text-xs font-bold px-3 py-1.5 text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer hover:border-indigo-400 transition-colors"
                      >
                        {PRODUCT_FAMILIES.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {isRealLossCapacityData ? (
                      <>Sistem, <strong>Loss Capacity Analizi (COPQ & Cost Deployment)</strong> modülünden elde edilen finansal kayıp konularını ve yalın gelişim potansiyellerini listelemektedir. <strong>Seçili Ürün Ailesi</strong> değiştiğinde, ilgili ürün grubunun üretim ve hacim payı oranına göre mevcut maliyet kayıpları ve kazanç potansiyelleri <strong>otomatik olarak ölçeklenmektedir</strong>.</>
                    ) : isEmptyOpportunityData ? (
                      <>Bu müşteri için henüz kayıtlı bir <strong>Loss Capacity Analizi</strong> ya da <strong>Maliyet Tablosu (İşlem Kayıtları)</strong> verisi bulunmuyor, bu yüzden gösterilecek bir fırsat listesi yok. Fırsat havuzunun oluşması için önce İşlem Kayıtları'na maliyet verisi girin veya bu müşteri için Loss Capacity Analizi çalıştırın — ya da sağdaki <strong>"Yeni Proje Teması (Boş Form)"</strong> sekmesinden boş bir proje başlatın.</>
                    ) : (
                      <>Sistem, saha maliyet kayıtlarından (İşlem Kayıtları / Maliyet Tablosu) türetilen <strong>gerçek maliyet tutarlarını</strong> listelemektedir; bu müşteri için henüz Loss Capacity Analizi çalıştırılmadığından, geri kazanım potansiyeli %60'lık standart bir Kaizen varsayımıyla hesaplanmıştır (gerçek geri kazanım oranı değildir). Daha detaylı ve doğru bir kırılım için <strong>Loss Capacity Analizi</strong> modülünün bu müşteri için çalıştırılması önerilir.</>
                    )}
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                        <th className="py-2.5 px-3">Kayıp Konusu / Metot</th>
                        <th className="py-2.5 px-3">Loss Capacity Problem Açıklaması</th>
                        <th className="py-2.5 px-3">Ürün Ailesi Kapsamı</th>
                        <th className="py-2.5 px-3 text-right">Mevcut Kayıp</th>
                        <th className="py-2.5 px-3 text-right">Geri Kazanım Potansiyeli</th>
                        <th className="py-2.5 px-3 text-center">Önem</th>
                        <th className="py-2.5 px-3 text-right">Eylem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                      {isEmptyOpportunityData && (
                        <tr>
                          <td colSpan={7} className="py-8 px-3 text-center text-slate-400 italic">
                            Gösterilecek fırsat kaydı yok — Loss Capacity Analizi veya Maliyet Tablosu verisi bekleniyor.
                          </td>
                        </tr>
                      )}
                      {opportunitiesList.map(opp => (
                        <tr key={opp.id} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-indigo-700">{opp.type}</div>
                            {opp.leanTool && (
                              <div className="text-[10px] text-emerald-700 font-medium font-mono bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                🛠️ {opp.leanTool}
                              </div>
                            )}
                            {(opp as any).assumed && (
                              <div
                                className="text-[11px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mt-0.5 inline-block ml-1"
                                title={(opp as any).source}
                              >
                                ⚠️ Tahmini/Varsayım Verisi
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 max-w-[280px]">
                            <div className="font-medium text-slate-900 text-[11px] leading-snug">{opp.problem}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Sorumlu Birim: {opp.dept}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md block text-center">
                              {opp.productFamily}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-600">
                            {currency}{opp.currentCost.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                            {currency}{opp.expectedGain.toLocaleString()}
                            <span className="text-[10px] text-emerald-700 font-semibold block font-sans">
                              (%{opp.potential} Kazanım)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                              opp.priority === "High" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                            }`}>
                              {opp.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleSelectOpportunity(opp)}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center space-x-1 ml-auto cursor-pointer transition-all hover:scale-102 shadow-xs"
                            >
                              <span>Projeye Dönüştür</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Simple Footer */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsWizardOpen(false)}
                  className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Kapat
                </button>
              </div>
              </>
              )}

            </div>

          </div>
        </div>
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
      {editingFinancialsProjId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-200">
            
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm uppercase">
                Proje Gerçekleşen Finansal Sonuçlar Giriş Paneli (CIFinancials)
              </h3>
              <button onClick={() => setEditingFinancialsProjId(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
              <p className="text-xs text-slate-500">
                Lütfen proje kapatıldığında veya ara dönemlerde gerçekleşen tasarruf / verimlilik oranlarını hem yüzde (%) hem de yıllık değer ({currency}) bazında giriniz:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                
                {/* 1. Scrap */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Hurda Azalışı (Scrap)</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.scrapReduction?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        scrapReduction: { pct: Number(e.target.value), val: financialsInput.scrapReduction?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.scrapReduction?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        scrapReduction: { pct: financialsInput.scrapReduction?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 2. Rework */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Rework Azalışı</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.reworkReduction?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        reworkReduction: { pct: Number(e.target.value), val: financialsInput.reworkReduction?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.reworkReduction?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        reworkReduction: { pct: financialsInput.reworkReduction?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 3. Waste */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Fire Azalışı (Waste)</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.wasteReduction?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        wasteReduction: { pct: Number(e.target.value), val: financialsInput.wasteReduction?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.wasteReduction?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        wasteReduction: { pct: financialsInput.wasteReduction?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 4. Setup */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Setup Süresi Kazancı (SMED)</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.setupTimeReduction?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        setupTimeReduction: { pct: Number(e.target.value), val: financialsInput.setupTimeReduction?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.setupTimeReduction?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        setupTimeReduction: { pct: financialsInput.setupTimeReduction?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 5. Lead Time */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Lead Time Azalışı</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.leadTimeReduction?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        leadTimeReduction: { pct: Number(e.target.value), val: financialsInput.leadTimeReduction?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.leadTimeReduction?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        leadTimeReduction: { pct: financialsInput.leadTimeReduction?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 6. WIP */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">WIP Azalışı</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.wipReduction?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        wipReduction: { pct: Number(e.target.value), val: financialsInput.wipReduction?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.wipReduction?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        wipReduction: { pct: financialsInput.wipReduction?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 7. Operator */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Operatör Verimlilik Artışı</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.operatorEfficiency?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        operatorEfficiency: { pct: Number(e.target.value), val: financialsInput.operatorEfficiency?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.operatorEfficiency?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        operatorEfficiency: { pct: financialsInput.operatorEfficiency?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 8. OEE */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">OEE Artışı</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.oeeIncrease?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        oeeIncrease: { pct: Number(e.target.value), val: financialsInput.oeeIncrease?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.oeeIncrease?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        oeeIncrease: { pct: financialsInput.oeeIncrease?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 9. Energy */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Enerji Tasarrufu</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.energySavings?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        energySavings: { pct: Number(e.target.value), val: financialsInput.energySavings?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.energySavings?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        energySavings: { pct: financialsInput.energySavings?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 10. Quality */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Kalite Artış Kazancı</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.qualityImprovement?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        qualityImprovement: { pct: Number(e.target.value), val: financialsInput.qualityImprovement?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.qualityImprovement?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        qualityImprovement: { pct: financialsInput.qualityImprovement?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 11. Production */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Üretim Artışı Kazanımı</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.productionIncrease?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        productionIncrease: { pct: Number(e.target.value), val: financialsInput.productionIncrease?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.productionIncrease?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        productionIncrease: { pct: financialsInput.productionIncrease?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 12. Delivery */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Teslimat Performans Getirisi</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.deliveryPerformance?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        deliveryPerformance: { pct: Number(e.target.value), val: financialsInput.deliveryPerformance?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.deliveryPerformance?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        deliveryPerformance: { pct: financialsInput.deliveryPerformance?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 13. OHS */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">İSG Kazancı (OHS)</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.ohsGain?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        ohsGain: { pct: Number(e.target.value), val: financialsInput.ohsGain?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.ohsGain?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        ohsGain: { pct: financialsInput.ohsGain?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 14. Space */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Alan Kazanımı (M2)</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.spaceSavings?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        spaceSavings: { pct: Number(e.target.value), val: financialsInput.spaceSavings?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.spaceSavings?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        spaceSavings: { pct: financialsInput.spaceSavings?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 15. Inventory */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Stok Azalışı</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.inventoryReduction?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        inventoryReduction: { pct: Number(e.target.value), val: financialsInput.inventoryReduction?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.inventoryReduction?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        inventoryReduction: { pct: financialsInput.inventoryReduction?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 16. Maintenance */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Bakım Gider Tasarrufu</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.maintenanceSavings?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        maintenanceSavings: { pct: Number(e.target.value), val: financialsInput.maintenanceSavings?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.maintenanceSavings?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        maintenanceSavings: { pct: financialsInput.maintenanceSavings?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

                {/* 17. Other */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 uppercase text-[11px] block">Diğer Kazanımlar</span>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      placeholder="%"
                      value={financialsInput.otherSavings?.pct || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        otherSavings: { pct: Number(e.target.value), val: financialsInput.otherSavings?.val || 0 }
                      })}
                      className="w-1/3 bg-white border border-slate-200 rounded p-1"
                    />
                    <input 
                      type="number" 
                      placeholder={currency}
                      value={financialsInput.otherSavings?.val || 0}
                      onChange={(e) => setFinancialsInput({
                        ...financialsInput,
                        otherSavings: { pct: financialsInput.otherSavings?.pct || 0, val: Number(e.target.value) }
                      })}
                      className="w-2/3 bg-white border border-slate-200 rounded p-1 font-mono"
                    />
                  </div>
                </div>

              </div>

            </div>

            <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex justify-end space-x-2">
              <button 
                onClick={() => setEditingFinancialsProjId(null)} 
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold"
              >
                Kapat
              </button>
              <button 
                onClick={handleSaveFinancials} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm"
              >
                Finansal Sonuçları Kaydet
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EDIT KAIZEN / CI PROJECT DETAILS MODAL */}
      {editingProject && (
        <div className={isProjectFullScreen ? "fixed inset-0 bg-white z-50 flex flex-col h-screen w-screen overflow-hidden" : "fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"}>
          <div className={isProjectFullScreen ? "bg-white w-full h-full flex flex-col overflow-hidden" : "bg-white rounded-2xl shadow-xl w-full max-w-6xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"}>
            
            <div className="bg-indigo-900 text-white px-5 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-200" />
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-200">CI Proje Kartı Tanımlama ve Aksiyon Takip Formu</h3>
                  <p className="text-[11px] text-indigo-100 font-mono mt-0.5">Proje No: {getProjectNo(editingProject)} (Ref: #{editingProject.id})</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  type="button"
                  onClick={() => setIsProjectFullScreen(!isProjectFullScreen)}
                  className="text-white hover:text-indigo-200 p-1.5 rounded hover:bg-white/10 transition-colors flex items-center space-x-1 text-[11px] font-bold cursor-pointer"
                  title={isProjectFullScreen ? "Normal Boyuta Dön" : "Tam Ekran Yap"}
                >
                  {isProjectFullScreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Küçült</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Tam Ekran</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={() => { setEditingProject(null); setIsProjectFullScreen(false); }} 
                  className="text-white hover:text-indigo-100 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className={isProjectFullScreen ? "p-6 space-y-5 flex-1 overflow-y-auto text-xs font-sans bg-slate-50/40" : "p-5 space-y-5 max-h-[70vh] overflow-y-auto text-xs font-sans"}>
              
              {/* Progress Indicator */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="shrink-0">
                  <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Proje İlerleme Durumu</span>
                  <span className="text-xs font-black text-slate-800 mt-0.5 block">Mevcut Aşama: {editProgressStep}</span>
                </div>
                <div className="flex-1 w-full max-w-3xl">
                  <div className="flex items-center justify-between relative">
                    {/* Background line */}
                    <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 -z-10" />
                    
                    {/* Active colored line segment */}
                    {(() => {
                      const steps = ["Tanımlama", "Analiz", "Planlama", "Uygulama", "Kontrol", "Standardizasyon", "Kapatıldı"];
                      const activeIdx = steps.indexOf(editProgressStep);
                      const pct = activeIdx >= 0 ? (activeIdx / (steps.length - 1)) * 100 : 0;
                      return (
                        <div 
                          className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-500 transition-all duration-300 -z-10"
                          style={{ width: `calc(${pct}% - ${activeIdx === steps.length - 1 ? '12px' : '0px'})` }}
                        />
                      );
                    })()}

                    {["Tanımlama", "Analiz", "Planlama", "Uygulama", "Kontrol", "Standardizasyon", "Kapatıldı"].map((step, idx) => {
                      const steps = ["Tanımlama", "Analiz", "Planlama", "Uygulama", "Kontrol", "Standardizasyon", "Kapatıldı"];
                      const activeIdx = steps.indexOf(editProgressStep);
                      const isCompleted = idx < activeIdx;
                      const isActive = idx === activeIdx;
                      
                      let bgClass = "bg-slate-200 border-slate-300 text-slate-500";
                      if (isCompleted) {
                        bgClass = "bg-emerald-500 border-emerald-600 text-white shadow-xs";
                      } else if (isActive) {
                        bgClass = "bg-blue-600 border-blue-700 text-white shadow-md ring-4 ring-blue-100";
                      }

                      return (
                        <button
                          key={step}
                          type="button"
                          onClick={() => setEditProgressStep(step)}
                          className="flex flex-col items-center group relative cursor-pointer focus:outline-none"
                        >
                          <div className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${bgClass} font-bold text-[11px]`}>
                            {isCompleted ? "✓" : idx + 1}
                          </div>
                          <span className={`mt-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${isActive ? "text-blue-600" : isCompleted ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"}`}>
                            {step}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Sol Sütun: Temel Proje Künyesi */}
                <div className="lg:col-span-4 space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
                  <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block font-mono">1. Proje Künyesi (General Metadata)</span>
                  
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Proje Başlığı (Title) *</label>
                    <input 
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Açıklama & Amacı</label>
                    <textarea 
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Lider (Leader) *</label>
                      <input
                        type="text"
                        list="ci-team-directory"
                        value={editProjectLeader}
                        onChange={(e) => setEditProjectLeader(e.target.value)}
                        placeholder="Lider seçin veya yazın"
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-slate-700 focus:outline-none font-medium text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Sponsor (Sponsor)</label>
                      <input
                        type="text"
                        list="ci-team-directory"
                        value={editProjectSponsor}
                        onChange={(e) => setEditProjectSponsor(e.target.value)}
                        placeholder="Sponsor seçin veya yazın"
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-700 text-[11px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Proje Ekibi</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        list="ci-team-directory"
                        value={editProjectTeamInput}
                        onChange={(e) => setEditProjectTeamInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const name = editProjectTeamInput.trim();
                            if (name && !editProjectTeam.includes(name)) {
                              setEditProjectTeam([...editProjectTeam, name]);
                            }
                            setEditProjectTeamInput("");
                          }
                        }}
                        placeholder="Ekip üyesi seçin veya yazın, Enter'a basın"
                        className="flex-1 bg-white border border-slate-200 rounded p-1.5 text-slate-700 focus:outline-none text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const name = editProjectTeamInput.trim();
                          if (name && !editProjectTeam.includes(name)) {
                            setEditProjectTeam([...editProjectTeam, name]);
                          }
                          setEditProjectTeamInput("");
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 rounded cursor-pointer"
                      >
                        Ekle
                      </button>
                    </div>
                    {editProjectTeam.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {editProjectTeam.map(member => (
                          <span key={member} className="text-[10.5px] bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded-lg flex items-center gap-1.5">
                            {member}
                            <button
                              type="button"
                              onClick={() => setEditProjectTeam(editProjectTeam.filter(m => m !== member))}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer font-bold"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Departman *</label>
                      <input 
                        type="text"
                        required
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Yatırım Bütçesi ({currency})</label>
                      <input 
                        type="number"
                        value={editEstimatedCost}
                        onChange={(e) => setEditEstimatedCost(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Mevcut Yıllık Kayıp Tutarı ({currency})</label>
                      <input 
                        type="number"
                        value={editCurrentLoss}
                        onChange={(e) => setEditCurrentLoss(Number(e.target.value))}
                        className="w-full bg-rose-50 border border-rose-200 rounded p-1.5 focus:outline-none font-mono font-bold text-rose-700 focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Planlanan Bitiş *</label>
                      <input 
                        type="date"
                        required
                        value={editPlannedFinishDate}
                        onChange={(e) => setEditPlannedFinishDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Proje Fazı *</label>
                      <select
                        value={editPhase}
                        onChange={(e) => setEditPhase(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-indigo-700 font-bold focus:outline-none"
                      >
                        <option value="Faz 1 (1 Ay)">Faz 1 (Hızlı Kazanım - 1 Ay)</option>
                        <option value="Faz 2 (2-3 Ay)">Faz 2 (Yatırım & Verimlilik - 2-3 Ay)</option>
                        <option value="Faz 3 (6-12 Ay)">Faz 3 (Stratejik Dönüşüm - 6-12 Ay)</option>
                      </select>
                    </div>
                  </div>

                </div>

                {/* Sağ Sütun: Sürekli İyileştirme Faaliyet Kartı */}
                <div className="lg:col-span-8 space-y-3.5 bg-white p-4 rounded-xl border border-slate-200 shadow-3xs font-sans">
                  <span className="font-bold text-[10px] text-indigo-950 uppercase tracking-wider block font-mono">2. Sürekli İyileştirme Detayları</span>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-indigo-900 font-bold mb-1">1 - Problem Tanımı (Problem Definition)</label>
                      <textarea 
                        rows={2}
                        value={editProblemDefinition}
                        onChange={(e) => setEditProblemDefinition(e.target.value)}
                        placeholder="Mevcut kayıp ve problemin net tanımı..."
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-850"
                      />
                    </div>

                    <div>
                      <label className="block text-indigo-900 font-bold mb-1">2 - Problemin Detaylı Bilgisi (Detailed Problem Info)</label>
                      <textarea 
                        rows={2}
                        value={editProblemDetail}
                        onChange={(e) => setEditProblemDetail(e.target.value)}
                        placeholder="Mevcut durum verileri, duruş süreleri veya kayıp miktarları..."
                        className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-850"
                      />
                      {renderPhotoUploadSection(
                        "Problem Görselleri & Saha Fotoğrafları (Gemba Foto)",
                        "Problemin mevcut durumunu belgelemek için galeriden görsel seçin veya direkt cihaz kamerası ile fotoğraf çekin.",
                        editProblemPhotos,
                        (newP) => setEditProblemPhotos([...editProblemPhotos, ...newP]),
                        (idx) => setEditProblemPhotos(editProblemPhotos.filter((_, i) => i !== idx))
                      )}
                    </div>

                    {/* 3 - Etki Analizi (Impact Analysis) */}
                    <div className="bg-indigo-50/30 border border-indigo-100 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="block text-indigo-950 font-bold">3 - Etki Analizi (Impact Analysis)</label>
                        <span className="text-[10px] text-indigo-500 font-mono font-bold bg-indigo-100/60 px-2 py-0.5 rounded-md">Çoklu COPQ Alanı İlişkilendirme</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Bir problem yalnızca tek bir maliyet kalemini değil, aynı anda birden fazla COPQ alanını etkileyebilir. Problemin etkilediği alanları ve önem seviyesini seçin:
                      </p>
                      
                      <div className="flex flex-wrap gap-2.5">
                        {[
                          "Hurda",
                          "Rework",
                          "Fazla Mesai",
                          "OEE",
                          "Setup",
                          "Plansız Duruş",
                          "Operatör Verimliliği",
                          "Lead Time",
                          "WIP",
                          "Sevkiyat Performansı",
                          "Kalite Maliyetleri"
                        ].map((area) => {
                          const isSelected = !!editImpactAnalysis[area];
                          const level = editImpactAnalysis[area] || "Orta";
                          
                          return (
                            <div 
                              key={area}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-3xs ${
                                isSelected 
                                  ? "bg-indigo-600 border-indigo-600 text-white" 
                                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...editImpactAnalysis };
                                  if (isSelected) {
                                    delete updated[area];
                                  } else {
                                    updated[area] = "Orta";
                                  }
                                  setEditImpactAnalysis(updated);
                                }}
                                className="flex items-center gap-1.5 focus:outline-none cursor-pointer"
                              >
                                <span>{isSelected ? "☑" : "☐"}</span>
                                <span>{area}</span>
                              </button>
                              
                              {isSelected && (
                                <div className="flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded-lg border border-white/15 ml-1">
                                  {(["Düşük", "Orta", "Yüksek"] as const).map((lvl, idx) => {
                                    const currentLevelIdx = level === "Düşük" ? 0 : level === "Orta" ? 1 : 2;
                                    const isStarFilled = idx <= currentLevelIdx;
                                    
                                    return (
                                      <button
                                        type="button"
                                        key={lvl}
                                        onClick={() => {
                                          const updated = { ...editImpactAnalysis };
                                          updated[area] = lvl;
                                          setEditImpactAnalysis(updated);
                                        }}
                                        title={`${lvl} Derecede Etkili`}
                                        className={`text-[13px] leading-none transition-colors ${
                                          isStarFilled ? "text-amber-300 hover:text-amber-400" : "text-white/30 hover:text-white/60"
                                        }`}
                                      >
                                        ★
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4 - Hedef Durum (Target State) */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="block text-indigo-950 font-bold">4 - Hedef Durum (Target Condition)</label>
                        <span className="text-[10px] text-indigo-500 font-mono font-bold bg-indigo-100/60 px-2 py-0.5 rounded-md">Hedef KPI & Kazanım Metrikleri</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Projenin başarıya ulaşması durumunda elde edilmesi planlanan değerleri, oranları ve finansal katkıları tanımlayın:
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="md:col-span-2">
                          <label className="block text-slate-500 font-bold mb-1">Ulaşılmak İstenen Hedef (Target Objective) *</label>
                          <textarea 
                            rows={2}
                            value={editTargetObjective}
                            onChange={(e) => setEditTargetObjective(e.target.value)}
                            placeholder="Örn: Pres sökme-takma sürelerinin dünya standartlarına çekilmesi, bekleme israfının bitirilmesi..."
                            className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-500 font-bold mb-1">Hedef KPI (Target KPI) *</label>
                          <input 
                            type="text"
                            value={editTargetKpi}
                            onChange={(e) => setEditTargetKpi(e.target.value)}
                            placeholder="Örn: SMED Hazırlık Süresi (Dakika)"
                            className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800 font-semibold"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Hedef Oran / Değer (%)</label>
                            <input 
                              type="number"
                              value={editTargetRatio}
                              onChange={(e) => setEditTargetRatio(Number(e.target.value))}
                              placeholder="75"
                              className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none font-mono font-semibold text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Hedef Maliyet Azaltımı ({currency})</label>
                            <input 
                              type="number"
                              value={editTargetCostReduction}
                              onChange={(e) => setEditTargetCostReduction(Number(e.target.value))}
                              placeholder="50000"
                              className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none font-mono font-semibold text-slate-800"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                      <label className="block text-indigo-900 font-bold mb-1">5 - Kök Neden Analizi (5 Neden / 5-Why)</label>
                      {editRootCauseWhys.map((why, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-1">{idx + 1}</span>
                          <input
                            type="text"
                            value={why}
                            onChange={(e) => {
                              const updated = [...editRootCauseWhys];
                              updated[idx] = e.target.value;
                              setEditRootCauseWhys(updated);
                            }}
                            placeholder={
                              idx === 0
                                ? "Neden 1: Problem neden oluştu?"
                                : `Neden ${idx + 1}: "${editRootCauseWhys[idx - 1] || "önceki neden"}" neden oldu?`
                            }
                            className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800 text-[11px]"
                          />
                        </div>
                      ))}
                      <p className="text-[10px] text-slate-400 pl-7">
                        Zincirin en son doldurulan adımı, projenin kök nedeni olarak kaydedilir.
                      </p>
                    </div>

                    {/* 6 - Uygulama Planı (Action Plan Editable Table) */}
                    <div className="space-y-2 border border-slate-200 p-4 rounded-xl bg-slate-50/50">
                      <div className="flex justify-between items-center">
                        <div>
                          <label className="block text-indigo-900 font-bold">6 - Uygulama Planı (Action Plan)</label>
                          <span className="text-[10px] text-slate-400 font-medium block">Kanban ve Timeline entegrasyonu için faaliyet listesi</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newId = `tsk_${Math.random().toString(36).substring(2, 5)}`;
                            setEditTasks([
                              ...editTasks,
                              {
                                id: newId,
                                name: "",
                                responsible: editProjectLeader || "",
                                deadline: editPlannedFinishDate || "",
                                status: "Açık",
                                progressPercent: 0
                              }
                            ]);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-3xs cursor-pointer transition-colors"
                        >
                          <span>➕ Satır Ekle</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-[11px] text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
                              <th className="px-3 py-2 w-12 text-center">No</th>
                              <th className="px-3 py-2">Faaliyet (Activity)</th>
                              <th className="px-3 py-2 w-48">Sorumlu (Owner)</th>
                              <th className="px-3 py-2 w-32 font-medium">Termin (Due Date)</th>
                              <th className="px-3 py-2 w-32 font-medium">Durum (Status)</th>
                              <th className="px-3 py-2 w-12 text-center"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {editTasks.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                                  Henüz bir faaliyet planlanmamış. Yeni satır eklemek için "+ Satır Ekle" butonuna basın.
                                </td>
                              </tr>
                            ) : (
                              editTasks.map((task, idx) => {
                                const currentStatus = task.status || (task.progressPercent === 100 ? "Yapıldı" : task.progressPercent > 0 ? "Devam Ediyor" : "Açık");
                                
                                return (
                                  <tr key={task.id} className="border-b border-slate-150 hover:bg-slate-50/40">
                                    <td className="px-3 py-2 font-mono font-bold text-center text-slate-500">
                                      {idx + 1}
                                    </td>
                                    <td className="px-2 py-1">
                                      <input 
                                        type="text"
                                        required
                                        value={task.name}
                                        placeholder="Faaliyet açıklamasını yazın..."
                                        onChange={(e) => {
                                          const updated = editTasks.map(t => {
                                            if (t.id === task.id) {
                                              return { ...t, name: e.target.value };
                                            }
                                            return t;
                                          });
                                          setEditTasks(updated);
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 text-[11px]"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="text"
                                        list="ci-team-directory"
                                        value={task.responsible}
                                        onChange={(e) => {
                                          const updated = editTasks.map(t => {
                                            if (t.id === task.id) {
                                              return { ...t, responsible: e.target.value };
                                            }
                                            return t;
                                          });
                                          setEditTasks(updated);
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-[11px]"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input 
                                        type="date"
                                        value={task.deadline || ""}
                                        onChange={(e) => {
                                          const updated = editTasks.map(t => {
                                            if (t.id === task.id) {
                                              return { ...t, deadline: e.target.value };
                                            }
                                            return t;
                                          });
                                          setEditTasks(updated);
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded px-1 py-1 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800 text-[11px]"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <select
                                        value={currentStatus}
                                        onChange={(e) => {
                                          const val = e.target.value as any;
                                          let pct = 0;
                                          if (val === "Yapıldı") pct = 100;
                                          else if (val === "Devam Ediyor") pct = 50;

                                          const updated = editTasks.map(t => {
                                            if (t.id === task.id) {
                                              return { ...t, status: val, progressPercent: pct };
                                            }
                                            return t;
                                          });
                                          setEditTasks(updated);
                                        }}
                                        className={`w-full border rounded px-1.5 py-1 focus:outline-none font-bold text-[10px] ${
                                          currentStatus === "Yapıldı" ? "bg-emerald-50 border-emerald-300 text-emerald-800" :
                                          currentStatus === "Devam Ediyor" ? "bg-amber-50 border-amber-300 text-amber-700" :
                                          currentStatus === "İptal" ? "bg-slate-100 border-slate-300 text-slate-500" :
                                          "bg-slate-50 border-slate-200 text-slate-600"
                                        }`}
                                      >
                                        <option value="Açık">Açık</option>
                                        <option value="Devam Ediyor">Devam Ediyor</option>
                                        <option value="Yapıldı">Yapıldı</option>
                                        <option value="İptal">İptal</option>
                                      </select>
                                    </td>
                                    <td className="px-2 py-1 text-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = editTasks.filter(t => t.id !== task.id);
                                          setEditTasks(updated);
                                        }}
                                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                        title="Satırı Sil"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 7 - Proje Sonucu ve Kazanımlar (Results & Gains) */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="block text-indigo-950 font-bold text-xs uppercase tracking-wider font-mono">
                          7 - Proje Sonucu ve Elde Edilen Kazanımlar
                        </label>
                        <span className="text-[10px] text-emerald-600 font-mono font-bold bg-emerald-100/60 px-2 py-0.5 rounded-md">
                          Kapanış & Finansal Kazanımlar
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Proje tamamlandığında elde edilen tasarrufları, standartlaştırma adımlarını ve genel kapanış sonucunu buraya işleyin:
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        {/* Expected Gain */}
                        <div className="space-y-1">
                          <label className="block text-slate-500 font-bold">Beklenen Kazanım</label>
                          <div className="flex rounded-md shadow-3xs">
                            <input 
                              type="number"
                              value={editExpectedGain}
                              onChange={(e) => setEditExpectedGain(Number(e.target.value))}
                              placeholder="0"
                              className="w-full bg-white border border-slate-200 border-r-0 rounded-l p-1.5 focus:outline-none font-mono font-semibold"
                            />
                            <select
                              value={editExpectedGainCurrency}
                              onChange={(e) => setEditExpectedGainCurrency(e.target.value)}
                              className="bg-slate-100 border border-slate-200 rounded-r px-1.5 text-[10px] font-bold focus:outline-none text-slate-600"
                            >
                              <option value="TL">₺ (TL)</option>
                              <option value="USD">$ (USD)</option>
                              <option value="EUR">€ (EUR)</option>
                            </select>
                          </div>
                        </div>

                        {/* Realized Gain */}
                        <div className="space-y-1">
                          <label className="block text-slate-500 font-bold">Gerçekleşen Kazanım (Net Tasarruf)</label>
                          <div className="flex rounded-md shadow-3xs">
                            <input 
                              type="number"
                              value={editRealizedGain}
                              onChange={(e) => setEditRealizedGain(Number(e.target.value))}
                              placeholder="0"
                              className="w-full bg-emerald-50 border border-emerald-200 border-r-0 rounded-l p-1.5 focus:outline-none font-mono font-bold text-emerald-700"
                            />
                            <select
                              value={editRealizedGainCurrency}
                              onChange={(e) => setEditRealizedGainCurrency(e.target.value)}
                              className="bg-emerald-100 border border-emerald-200 rounded-r px-1.5 text-[10px] font-bold focus:outline-none text-emerald-700"
                            >
                              <option value="TL">₺ (TL)</option>
                              <option value="USD">$ (USD)</option>
                              <option value="EUR">€ (EUR)</option>
                            </select>
                          </div>
                        </div>

                        {/* Realized Improvement Pct */}
                        <div className="space-y-1">
                          <label className="block text-slate-500 font-bold">Gerçekleşen İyileştirme (%)</label>
                          <div className="flex rounded-md shadow-3xs relative">
                            <input 
                              type="number"
                              value={editRealizedImprovementPct}
                              onChange={(e) => setEditRealizedImprovementPct(Number(e.target.value))}
                              placeholder="0"
                              className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none font-mono font-semibold"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-[10px]">%</span>
                          </div>
                        </div>
                      </div>

                      {/* Standardization Checkboxes */}
                      <div className="bg-slate-100/50 p-3.5 rounded-xl border border-slate-200/60 space-y-2">
                        <label className="block text-indigo-950 font-bold text-[11px] uppercase tracking-wide font-mono">
                          Standardizasyon ve Yaygınlaştırma Adımları
                        </label>
                        <p className="text-[10px] text-slate-500 mb-2">
                          İyileştirmenin kalıcı olmasını sağlamak için hangi döküman ve süreç güncellemeleri tamamlandı?
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                          <label className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 select-none">
                            <input 
                              type="checkbox"
                              checked={editStdWorkUpdated}
                              onChange={(e) => setEditStdWorkUpdated(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                            />
                            <span className="text-slate-700 font-medium">Standart İş Güncellendi</span>
                          </label>

                          <label className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 select-none">
                            <input 
                              type="checkbox"
                              checked={editInstructionRevised}
                              onChange={(e) => setEditInstructionRevised(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                            />
                            <span className="text-slate-700 font-medium">Talimat Revize Edildi</span>
                          </label>

                          <label className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 select-none">
                            <input 
                              type="checkbox"
                              checked={editTrainingGiven}
                              onChange={(e) => setEditTrainingGiven(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                            />
                            <span className="text-slate-700 font-medium">Eğitim Verildi</span>
                          </label>

                          <label className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 select-none">
                            <input 
                              type="checkbox"
                              checked={editControlPlanUpdated}
                              onChange={(e) => setEditControlPlanUpdated(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                            />
                            <span className="text-slate-700 font-medium">Kontrol Planı Güncellendi</span>
                          </label>

                          <label className="flex items-center space-x-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 select-none">
                            <input 
                              type="checkbox"
                              checked={editAuditListUpdated}
                              onChange={(e) => setEditAuditListUpdated(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                            />
                            <span className="text-slate-700 font-medium">Denetim Listesi Güncellendi</span>
                          </label>
                        </div>
                      </div>

                      {/* Dropdown Result & Textarea Description */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                        <div className="md:col-span-1">
                          <label className="block text-slate-500 font-bold mb-1">Proje Sonucu</label>
                          <select
                            value={editProjectResult}
                            onChange={(e) => setEditProjectResult(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 focus:outline-none"
                          >
                            <option value="Başarılı">🟢 Başarılı (Sustained)</option>
                            <option value="Revizyon Gerekli">🟡 Revizyon Gerekli</option>
                            <option value="Askıya Alındı">⚪ Askıya Alındı (On-Hold)</option>
                            <option value="İptal">🔴 İptal (Cancelled)</option>
                          </select>
                        </div>

                        <div className="md:col-span-3">
                          <label className="block text-slate-500 font-bold mb-1">Sonuç ve Karar Açıklaması (Decision / Result Notes)</label>
                          <textarea 
                            rows={2}
                            value={editResultDescription}
                            onChange={(e) => setEditResultDescription(e.target.value)}
                            placeholder="Elde edilen tasarrufun tescili, sürdürülebilirlik planları ve genel değerlendirmeler..."
                            className="w-full bg-white border border-slate-200 rounded p-1.5 focus:outline-none text-slate-800 font-medium"
                          />
                        </div>
                      </div>

                      {/* Photo Upload Section for Section 7 Project Results */}
                      {renderPhotoUploadSection(
                        "Sonuç & Kazanım Kanıt Fotoğrafları (İyileştirilmiş Durum)",
                        "Proje sonucu elde edilen kazanımları ve standartlaşmayı belgelemek için galeriden görsel seçin veya direkt cihaz kamerası ile fotoğraf çekin.",
                        editResultPhotos,
                        (newP) => setEditResultPhotos([...editResultPhotos, ...newP]),
                        (idx) => setEditResultPhotos(editResultPhotos.filter((_, i) => i !== idx))
                      )}
                    </div>

                    {/* 8 - Belgeler ve Görseller (Documents & Attachments) */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="block text-indigo-950 font-bold text-xs uppercase tracking-wider font-mono">
                          8 - Belgeler ve Görseller (Documents & Attachments)
                        </label>
                        <span className="text-[10px] text-indigo-600 font-mono font-bold bg-indigo-100/60 px-2 py-0.5 rounded-md">
                          Dosya Havuzu Entegrasyonu
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Projenin saha fotoğrafları, standart iş dökümanları ve analiz raporlarını (PDF, Word, Excel, JPG, PNG) yükleyin:
                      </p>

                      {/* Storage location note — previously this claimed files would be "automatically
                          archived on the server" while only the file name/size were ever kept. Files
                          now genuinely persist (base64-embedded in this project's own record), so the
                          note reflects that instead of an unbuilt separate file-server path. */}
                      <div className="bg-slate-100 p-3 rounded-lg border border-slate-200/60 font-mono text-[10px] text-slate-600 space-y-1.5 shadow-3xs">
                        <div className="flex items-center text-slate-500">
                          <span className="font-bold text-indigo-700 mr-1">Saklama Konumu:</span>
                          <span>Bu CI projesi kaydının içinde (KAI-{editingProject?.id || "Proje"}) — ayrı bir dosya sunucusuna değil.</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Dosya başına en fazla {MAX_DOCUMENT_SIZE_MB} MB. Büyük dosyalar (video, yüksek çözünürlüklü taramalar) için harici bir paylaşım bağlantısı kullanmanız önerilir.
                        </div>
                      </div>

                      {/* Drag & Drop File Zone */}
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!e.dataTransfer.files) return;
                          handleDocumentFiles(Array.from(e.dataTransfer.files));
                        }}
                        className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-100/50 hover:border-indigo-400 transition-colors cursor-pointer relative group"
                      >
                        <input
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
                          onChange={(e) => {
                            if (!e.target.files) return;
                            handleDocumentFiles(Array.from(e.target.files));
                            e.target.value = "";
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="p-3 bg-white rounded-full shadow-3xs group-hover:scale-105 transition-transform">
                            <FileUp className="w-5 h-5 text-indigo-600" />
                          </div>
                          <p className="text-[11px] font-bold text-slate-700">
                            Dosyayı buraya sürükleyip bırakın veya <span className="text-indigo-600 underline">Göz Atın</span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Desteklenen Dosya Biçimleri: PDF, Word (DOC, DOCX), Excel (XLS, XLSX), Görseller (JPG, PNG)
                          </p>
                        </div>
                      </div>

                      {/* Document List */}
                      {editDocuments.length > 0 && (
                        <div className="space-y-2">
                          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                            Yüklenen Belgeler ({editDocuments.length})
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {editDocuments.map((doc) => {
                              const isImage = ["jpg", "jpeg", "png", "gif"].includes(doc.fileType?.toLowerCase());
                              const isExcel = ["xls", "xlsx"].includes(doc.fileType?.toLowerCase());
                              const isPdf = doc.fileType?.toLowerCase() === "pdf";

                              return (
                                <div 
                                  key={doc.id}
                                  className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                                >
                                  <div className="flex items-center space-x-2 min-w-0">
                                    <div className={`p-1.5 rounded ${
                                      isImage ? "bg-amber-50 text-amber-600" :
                                      isExcel ? "bg-emerald-50 text-emerald-600" :
                                      isPdf ? "bg-rose-50 text-rose-600" :
                                      "bg-blue-50 text-blue-600"
                                    }`}>
                                      {isImage ? <Image className="w-4 h-4" /> :
                                       isExcel ? <FileSpreadsheet className="w-4 h-4" /> :
                                       <FileText className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-700 truncate text-[11px]" title={doc.name}>
                                        {doc.name}
                                      </p>
                                      <p className="text-[11px] text-slate-400 font-mono">
                                        {doc.size} • {doc.uploadDate}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-0.5 shrink-0 ml-2">
                                    {doc.data && (
                                      <a
                                        href={doc.data}
                                        download={doc.name}
                                        className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                                        title="Dosyayı İndir / Görüntüle"
                                      >
                                        <FileUp className="w-3.5 h-3.5 rotate-180" />
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditDocuments(editDocuments.filter(d => d.id !== doc.id));
                                      }}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                                      title="Dosyayı Kaldır"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 9 - Önce-Sonra Kaizen Formu (Before-After Kaizen) — recreates the real
                      "Kaizen Öncesi Sonrası" one-pager template on demand, from data already on
                      this card, and keeps every generated study as a persisted list entry. */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-indigo-950 font-bold text-xs uppercase tracking-wider font-mono">
                        9 - Önce-Sonra Kaizen Formu (Before-After Kaizen)
                      </label>
                      <button
                        type="button"
                        onClick={handleOpenBeforeAfterModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Önce-Sonra Formu Oluştur
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Projenin önce/sonra fotoğrafları, problem tanımı ve kazanımlarından, firmanın standart "Kaizen Öncesi Sonrası" formatında bir tek-sayfalık Excel raporu üretir. Her oluşturma bir liste kaydı olarak saklanır.
                    </p>

                    {(editingProject.beforeAfterStudies?.length || 0) > 0 ? (
                      <div className="space-y-1.5">
                        {editingProject.beforeAfterStudies!.map(study => (
                          <div key={study.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-700 text-[11px] truncate">{study.subject}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{study.date} • {study.category} / {study.area}</p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
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
                                onClick={() => handleDeleteBeforeAfterStudy(study.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                                title="Kaydı Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Henüz önce-sonra formu oluşturulmadı.</p>
                    )}
                  </div>

                  {/* Mail Reminder Infrastructure UI */}
                  <div className="pt-2 border-t border-indigo-200/50 flex items-center justify-between">
                    <div className="text-[10px] text-slate-500 font-medium">
                      <span>Hatırlatma Kaydı & Excel Kart Aktarımı</span>
                      {editingProject.lastEmailSentAt && (
                        <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 font-mono">Son Hatırlatma Kaydı: {editingProject.lastEmailSentAt}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Recipient picker — sourced from the customer card's real contacts */}
                      <select
                        value={reminderRecipientKey}
                        onChange={(e) => setReminderRecipientKey(e.target.value)}
                        className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 focus:outline-none cursor-pointer"
                        title="Hatırlatma alıcısı"
                      >
                        <option value="leader">Proje Lideri ({editingProject.projectLeader || editingProject.originator || "Sorumlu Ekip"})</option>
                        {getCustomerContactOptions().map(opt => (
                          <option key={opt.key} value={opt.key}>{opt.label} ({opt.name})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const contact = getCustomerContactOptions().find(o => o.key === reminderRecipientKey);
                          logManualReminder(editingProject, contact ? { name: contact.name, email: contact.email } : undefined);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow-xs cursor-pointer text-[10px]"
                      >
                        <span>📌 Hatırlatma Kaydet</span>
                        {editingProject.emailSentCount && editingProject.emailSentCount > 0 && (
                          <span className="bg-white/20 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full">
                            {editingProject.emailSentCount}
                          </span>
                        )}
                      </button>

                      {/* XLS EXPORT ICON BUTTON (Icon only) */}
                      <button
                        type="button"
                        onClick={handleExportCurrentEditingProjectToExcel}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg flex items-center justify-center shadow-xs cursor-pointer transition-colors"
                        title="CI Proje Kartını Excel (XLS) Olarak Dışarı Aktar"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>

              </div>

            </div>

            <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex justify-end space-x-2">
              <button 
                onClick={() => setEditingProject(null)} 
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl font-bold cursor-pointer text-xs"
              >
                İptal
              </button>
              <button 
                onClick={handleSaveProjectDetails} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold shadow-sm cursor-pointer text-xs"
              >
                CI Değişikliklerini Kaydet
              </button>
            </div>

          </div>
        </div>
      )}

      {/* LIGHTBOX PHOTO ZOOM MODAL */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
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
