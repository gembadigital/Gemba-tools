import React, { useState, useEffect, useRef } from "react";
import { 
  BarChart3, Clock, Sparkles, TrendingUp, HelpCircle, 
  Settings, CheckCircle2, AlertTriangle, Play, RefreshCw, 
  Layers, Plus, Trash2, ChevronDown, ChevronUp, DollarSign, 
  Percent, ShieldAlert, BookOpen, MessageSquare, Compass, 
  Activity, Layout, Sun, Moon, ArrowRight, Zap, Award, BarChart2,
  Save, Loader2, Info, ArrowDownUp, Check, ShieldCheck, Eye, EyeOff,
  Cpu, Sliders, Filter, Target, X, Building2, Crosshair, PieChart as PieChartIcon,
  FileSpreadsheet, FileText, Wrench
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Legend, LineChart, AreaChart, Area, BarChart, Treemap } from "recharts";
import ExcelJS from "exceljs";
import { domToCanvas } from "modern-screenshot";

import { useFactory } from "../context/FactoryContext";
import { ProcessItem, CalculatedProcess, IndustryType, LossInputField, LOSS_INPUT_FIELDS } from "./loss-analysis/types";
import {
  INDUSTRY_BENCHMARKS,
  calculateProcessesData,
  calculateFinancialImpact,
  calculateCOPQ,
  calculateHiddenFactory,
  COPQ_ENTERED_CATEGORIES,
  CopqEnteredKey,
  mapCostTableRow,
  dailyDemandOf
} from "./loss-analysis/helpers";
import {
  LossUnitCosts,
  CardCostBasis,
  ProcessRates,
  RateSource,
  FACTORY_LINE_KEY,
  deriveFromCard,
  resolveProcessRates,
  calculateLossCosts
} from "./loss-analysis/lossCosting";
import { JIPM_LOSSES, JipmStationInputs, JipmLine, computeJipmStation, stationOeeOf } from "./loss-analysis/jipmLossCost";
import type { LossReportModel, LossReportStation, LossReportLine, LossReportRecoveryRow } from "../utils/lossReportModel";

import AnalysisViews from "./loss-analysis/AnalysisViews";
import CopilotEngine from "./loss-analysis/CopilotEngine";

export const INDUSTRY_OPTIONS: { id: IndustryType; labelTr: string; labelEn: string }[] = [
  { id: "Automotive", labelTr: "Otomotiv", labelEn: "Automotive" },
  { id: "White Goods", labelTr: "Beyaz Eşya", labelEn: "White Goods" },
  { id: "Electric Motor", labelTr: "Elektrik Motoru", labelEn: "Electric Motor" },
  { id: "Casting", labelTr: "Döküm", labelEn: "Casting" },
  { id: "Machining", labelTr: "Talaşlı İmalat", labelEn: "Machining" },
  { id: "Metal Forming", labelTr: "Metal Şekillendirme", labelEn: "Metal Forming" },
  { id: "Food", labelTr: "Gıda", labelEn: "Food" },
  { id: "Plastic Injection", labelTr: "Plastik Enjeksiyon", labelEn: "Plastic Injection" },
  { id: "Textile", labelTr: "Tekstil", labelEn: "Textile" },
  { id: "Electronics", labelTr: "Elektronik", labelEn: "Electronics" },
  { id: "Other", labelTr: "Diğer (Elle Giriniz)", labelEn: "Other (Manual Input)" }
];

export default function LossAnalysis() {
  const { selectedCustomerId, selectedCustomer, globalState } = useFactory();
  const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";

  const isDarkMode = false; // Dark mode completely disabled per request
  const [activeTab, setActiveTab] = useState<"cost_model" | "opportunity_matrix" | "recovery_matrix" | "simulation" | "tpm_loss" | "ai_copilot" | "executive_dashboard">("executive_dashboard");
  
  // Real database connection & synchronization states
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  // Sector Benchmark Dropdown Custom Option
  const [customIndustryName, setCustomIndustryName] = useState<string>("");

  // VSM Project Filter & Product Group Cost Model States (Cost Control Manager Role)
  const [isVsmFilterOpen, setIsVsmFilterOpen] = useState<boolean>(false);
  const [vsmProjects, setVsmProjects] = useState<any[]>([]);
  const [selectedVsmProject, setSelectedVsmProject] = useState<any | null>(null);
  const [kaizens, setKaizens] = useState<any[]>([]);

  // "Proje Olarak Ata" — lets the manager push a Recovery Matrix / Pareto loss item directly into
  // CI Proje Yönetimi as a real, assigned Kaizen project, instead of relying only on the passive
  // opportunity-suggestion cache KaizenManager already reads from localStorage.
  const [assignModalRow, setAssignModalRow] = useState<any | null>(null);
  const [assignLeader, setAssignLeader] = useState<string>("");
  const [assignDepartment, setAssignDepartment] = useState<string>("");
  const [assignDeadline, setAssignDeadline] = useState<string>("");
  const [isAssigningProject, setIsAssigningProject] = useState<boolean>(false);
  const [assignSuccessMessage, setAssignSuccessMessage] = useState<string | null>(null);

  const [copqSnapshots, setCopqSnapshots] = useState<any[]>([]);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [costModelScope, setCostModelScope] = useState<"factory" | "product_group">("factory");
  const [productVolumeShare, setProductVolumeShare] = useState<number>(100);

  // Financial Cost Model Parameter States (User Editable in Product Cost Model Tab)
  // Loss unit costs the consultant enters (method A); empty = not entered, the rate then comes from
  // the VSM project setup or is derived from the customer card (method B) — see lossCosting.ts.
  const [unitCosts, setUnitCosts] = useState<LossUnitCosts>({});
  const [holdingRatePct, setHoldingRatePct] = useState<number>(0); // stock carrying rate, %/year (card basis)
  // JIPM loss tree (tab 6): consultant entries per station for the losses VSM does not measure.
  const [jipmInputs, setJipmInputs] = useState<Record<string, JipmStationInputs>>({});
  const [jipmStationFilter, setJipmStationFilter] = useState<string>("all");
  // Customer's annual quality-cost figures the screen cannot measure (COPQ external / appraisal).
  const [copqEntered, setCopqEntered] = useState<Partial<Record<CopqEnteredKey, number>>>({});
  // Customer card (company workspace) figures used by method B.
  const [cardWorkspace, setCardWorkspace] = useState<{ annualVolume: number; blueCollar: number; shiftHours: number; workingDays: number }>({ annualVolume: 0, blueCollar: 0, shiftHours: 0, workingDays: 0 });

  // Actual Financial Data Override Layer: when the consultant/customer has real annual cost
  // figures for a loss category (from the customer's own accounting), that real number replaces
  // this module's revenue-ratio estimate for that category only — categories left untoggled keep
  // using the ratio-based estimate. This is the opt-in alternative to the "rounded by revenue
  // share" approach the whole module otherwise relies on.
  const COST_OVERRIDE_CATEGORIES: { key: string; label: string }[] = [
    { key: "scrap", label: "Hurda Maliyeti" },
    { key: "rework", label: "Yeniden İşleme (Rework)" },
    { key: "downtime", label: "Plansız Duruşlar" },
    { key: "setup", label: "Setup / Kalıp Değişimi" },
    { key: "laborLoss", label: "Fazla İşçilik (Norm Fazlası)" },
    { key: "overtime", label: "Fazla Mesai" },
    { key: "energy", label: "Enerji Maliyeti" },
    { key: "maintenance", label: "Bakım Maliyeti" },
    { key: "inventory", label: "Stok Taşıma Maliyeti" },
    { key: "lateDelivery", label: "Geç Teslimat / Ceza" }
  ];
  const [actualCostOverrides, setActualCostOverrides] = useState<Record<string, { enabled: boolean; annualValue: number }>>({});

  const handleUpdateCostOverride = (key: string, field: "enabled" | "annualValue", value: boolean | number) => {
    setActualCostOverrides(prev => ({
      ...prev,
      [key]: {
        enabled: field === "enabled" ? (value as boolean) : (prev[key]?.enabled ?? false),
        annualValue: field === "annualValue" ? Math.max(0, value as number) : (prev[key]?.annualValue ?? 0)
      }
    }));
  };

  // Local reset only — the auto-save effect further down persists the cleared state to the
  // customer's record automatically (actualCostOverrides is in its dependency list).
  const handleResetCostOverrides = () => {
    setActualCostOverrides({});
  };

  // Whole-module persistence: every tunable the consultant sets for this customer (unit cost
  // rates, industry benchmark choice, cost-tree %, COPQ/improvement/investment overrides, real
  // financial data overrides, what-if sliders) is saved to /api/business/loss-capacity-settings
  // as one blob per customer, and restored here on customer select — so nothing resets on reload
  // or when the session ends. `settingsReady` gates the auto-save effect below so it never fires
  // with default values before the real saved settings (or the "nothing saved yet" case) arrive.
  const [moduleSettingsSaveStatus, setModuleSettingsSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [settingsReady, setSettingsReady] = useState<boolean>(false);
  const [pendingVsmProjectId, setPendingVsmProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCustomerId) return;
    setSettingsReady(false);
    fetch("/api/business/loss-capacity-settings", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomerId
      }
    })
    .then(res => res.json())
    .then(data => {
      const s = (data.success && data.data && data.data.settings) ? data.data.settings : null;
      // Sector benchmark selection
      setSelectedIndustry(s?.selectedIndustry ?? "Automotive");
      setCustomIndustryName(s?.customIndustryName ?? "");
      // VSM product-group cost model scope
      setCostModelScope(s?.costModelScope ?? "factory");
      setProductVolumeShare(s?.productVolumeShare ?? 100);
      setPendingVsmProjectId(s?.selectedVsmProjectId ?? null);
      if (!s?.selectedVsmProjectId) setSelectedVsmProject(null);
      // Unit cost component parameters
      // (Earlier hourlyLaborRate / materialCostFactor / machineOverheadHour were auto-saved with their
      // built-in defaults, so they are not carried over as if the consultant had entered them.)
      setUnitCosts(s?.unitCosts ?? {});
      setHoldingRatePct(s?.holdingRatePct ?? 0);
      setJipmInputs(s?.jipmInputs ?? {});
      setCopqEntered(s?.copqEntered ?? {});
      // Product cost tree breakdown %
      setDirectMaterialPercent(s?.directMaterialPercent ?? 0);
      setDirectLaborPercent(s?.directLaborPercent ?? 0);
      setOvertimeBurdenPercent(s?.overtimeBurdenPercent ?? 0);
      setEnergyPercent(s?.energyPercent ?? 0);
      setMaintenancePercent(s?.maintenancePercent ?? 0);
      setOverheadPercent(s?.overheadPercent ?? 0);
      setOperatingProfitPercent(s?.operatingProfitPercent ?? 0);
      // COPQ / Recovery Matrix / ROI rate overrides
      setCustomImprovementRates(s?.customImprovementRates ?? {});
      setOpexMaturity(s?.opexMaturity ?? 40);
      setCustomInvestmentPercent(s?.customInvestmentPercent ?? {});
      // Real financial data overrides
      setActualCostOverrides(s?.actualCostOverrides ?? {});
      // What-if simulation sliders
      setSimSetup(s?.simSetup ?? 30);
      setSimScrap(s?.simScrap ?? 25);
      setSimOee(s?.simOee ?? 8);
      setSimLaborOpt(s?.simLaborOpt ?? 15);
      setSimOvertimeRed(s?.simOvertimeRed ?? 40);
      setSimLeadTimeAccel(s?.simLeadTimeAccel ?? 20);
      setSettingsReady(true);
    })
    .catch(err => {
      console.error("Failed to load Loss Capacity settings", err);
      setSettingsReady(true);
    });
  }, [selectedCustomerId, token]);

  // Once the customer's VSM projects list has loaded, resolve the saved product-group selection
  // (stored as just an id) back into the full project object the UI/calculations expect.
  useEffect(() => {
    if (!pendingVsmProjectId) return;
    const match = vsmProjects.find((p: any) => p.id === pendingVsmProjectId);
    if (match) {
      setSelectedVsmProject(match);
      setPendingVsmProjectId(null);
    }
  }, [vsmProjects, pendingVsmProjectId]);

  const [annualRevenue, setAnnualRevenue] = useState<number>(12000000);
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryType>("Automotive");
  const [currencySymbol, setCurrencySymbol] = useState<string>("TL");

  // Cost Control Expert - Editable finished product cost distribution benchmarks by industry
  const INDUSTRY_COST_BENCHMARKS: Record<IndustryType, {
    directMaterial: number;
    directLabor: number;
    overtimeBurden: number; // % of labor cost
    energy: number;
    maintenance: number;
    overhead: number;
    operatingProfit: number;
  }> = {
    "Automotive": {
      directMaterial: 40.5,
      directLabor: 13.5,
      overtimeBurden: 8.5,
      energy: 18.0,
      maintenance: 7.2,
      overhead: 10.8,
      operatingProfit: 10.0
    },
    "White Goods": {
      directMaterial: 52.0,
      directLabor: 12.0,
      overtimeBurden: 7.5,
      energy: 11.0,
      maintenance: 6.5,
      overhead: 10.5,
      operatingProfit: 8.0
    },
    "Electric Motor": {
      directMaterial: 46.0,
      directLabor: 14.0,
      overtimeBurden: 9.0,
      energy: 13.0,
      maintenance: 8.0,
      overhead: 10.0,
      operatingProfit: 9.0
    },
    "Casting": {
      directMaterial: 30.0,
      directLabor: 15.0,
      overtimeBurden: 10.0,
      energy: 26.0,
      maintenance: 11.0,
      overhead: 8.0,
      operatingProfit: 10.0
    },
    "Machining": {
      directMaterial: 35.0,
      directLabor: 18.0,
      overtimeBurden: 8.0,
      energy: 14.5,
      maintenance: 9.5,
      overhead: 13.0,
      operatingProfit: 10.0
    },
    "Metal Forming": {
      directMaterial: 42.5,
      directLabor: 13.5,
      overtimeBurden: 8.5,
      energy: 16.0,
      maintenance: 8.0,
      overhead: 10.0,
      operatingProfit: 10.0
    },
    "Food": {
      directMaterial: 54.0,
      directLabor: 8.5,
      overtimeBurden: 6.5,
      energy: 11.0,
      maintenance: 6.0,
      overhead: 11.5,
      operatingProfit: 9.0
    },
    "Plastic Injection": {
      directMaterial: 44.0,
      directLabor: 12.5,
      overtimeBurden: 7.5,
      energy: 18.0,
      maintenance: 8.0,
      overhead: 9.5,
      operatingProfit: 8.0
    },
    "Textile": {
      directMaterial: 36.5,
      directLabor: 22.0,
      overtimeBurden: 12.0,
      energy: 13.0,
      maintenance: 6.0,
      overhead: 12.5,
      operatingProfit: 10.0
    },
    "Electronics": {
      directMaterial: 58.0,
      directLabor: 10.0,
      overtimeBurden: 6.5,
      energy: 8.0,
      maintenance: 5.5,
      overhead: 10.0,
      operatingProfit: 8.0
    },
    "Other": {
      directMaterial: 45.0,
      directLabor: 15.0,
      overtimeBurden: 8.0,
      energy: 15.0,
      maintenance: 7.0,
      overhead: 10.0,
      operatingProfit: 10.0
    },
    "Diğer": {
      directMaterial: 45.0,
      directLabor: 15.0,
      overtimeBurden: 8.0,
      energy: 15.0,
      maintenance: 7.0,
      overhead: 10.0,
      operatingProfit: 10.0
    }
  };

  const [directMaterialPercent, setDirectMaterialPercent] = useState<number>(0);
  const [directLaborPercent, setDirectLaborPercent] = useState<number>(0);
  const [overtimeBurdenPercent, setOvertimeBurdenPercent] = useState<number>(0);
  const [energyPercent, setEnergyPercent] = useState<number>(0);
  const [maintenancePercent, setMaintenancePercent] = useState<number>(0);
  const [overheadPercent, setOverheadPercent] = useState<number>(0);
  const [operatingProfitPercent, setOperatingProfitPercent] = useState<number>(0);

  const [customImprovementRates, setCustomImprovementRates] = useState<Record<string, { min: number, max: number }>>({});
  const [opexMaturity, setOpexMaturity] = useState<number>(40);

  // Typical implementation (investment) cost of each Lean/WCM tool, expressed as a % of the
  // subject's own average annual loss. Grounded in the well-known Lean/Six Sigma project-scoping
  // heuristic that improvement-project investment is normally a fraction of first-year savings
  // (this is precisely why these projects are attractive) — low-cost behavioral/standard-work
  // tools sit near 4-6%, tooling/equipment-heavy programs (SMED, TPM) sit near 12-15%. Same
  // "rounded estimate, editable by the consultant" approach already used for improvement rates,
  // since — as with COPQ — the customer's real implementation cost line items are not known upfront.
  const DEFAULT_INVESTMENT_PERCENT: Record<string, number> = {
    "Hurda Maliyeti": 8,
    "Fire & Malzeme Kayıpları": 4,
    "Fazla Mesai Azaltımı": 5,
    "Yeniden İşleme (Rework)": 7,
    "Operasyonel Verimsizlik": 4,
    "Setup Süreleri (SMED)": 12,
    "Plansız Duruşların Önlenmesi": 15,
    "OEE İyileştirmesi": 8,
    "Operatör Verimliliği": 5,
    "Lead Time (Sipariş Çevrimi)": 10,
    "WIP (Yarı Mamul) Azaltımı": 6,
    "Sevkiyat Performansı": 8
  };
  const [customInvestmentPercent, setCustomInvestmentPercent] = useState<Record<string, number>>({});

  const handleUpdateInvestmentPercent = (subject: string, val: number) => {
    setCustomInvestmentPercent(prev => ({
      ...prev,
      [subject]: Math.max(0, Math.min(100, val))
    }));
  };

  const handleResetInvestmentPercent = () => {
    setCustomInvestmentPercent({});
  };

  const handleUpdateImprovementRate = (subject: string, field: "min" | "max", val: number) => {
    setCustomImprovementRates(prev => {
      const existing = prev[subject] || { min: 0, max: 0 };
      return {
        ...prev,
        [subject]: {
          min: field === "min" ? Math.max(0, Math.min(100, val)) : existing.min,
          max: field === "max" ? Math.max(0, Math.min(100, val)) : existing.max
        }
      };
    });
  };

  const handleResetImprovementRates = () => {
    setCustomImprovementRates({});
  };

  // The cost structure is no longer overwritten from the sector table when the industry changes (it
  // used to be, on every load): sector averages are applied only with the explicit button below.

  const handleResetToSectorBenchmarks = () => {
    const b = INDUSTRY_COST_BENCHMARKS[selectedIndustry];
    if (b) {
      setDirectMaterialPercent(b.directMaterial);
      setDirectLaborPercent(b.directLabor);
      setOvertimeBurdenPercent(b.overtimeBurden);
      setEnergyPercent(b.energy);
      setMaintenancePercent(b.maintenance);
      setOverheadPercent(b.overhead);
      setOperatingProfitPercent(b.operatingProfit);
    }
  };

  const handleAutoBalance = () => {
    const sumOthers = directMaterialPercent + directLaborPercent + energyPercent + maintenancePercent + overheadPercent;
    const balancedProfit = Math.max(0, 100 - sumOthers);
    setOperatingProfitPercent(parseFloat(balancedProfit.toFixed(1)));
  };

  const totalSumPercent = directMaterialPercent + directLaborPercent + energyPercent + maintenancePercent + overheadPercent + operatingProfitPercent;

  // Fetch process data from database VSM / Operational Data
  useEffect(() => {
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
      if (data.success && data.data && data.data.length > 0) {
        // Map ProcessRecord[] to ProcessItem[]
        const mapped: ProcessItem[] = data.data.map(mapCostTableRow);
        setProcesses(mapped);
      } else {
        // No real process records for this factory yet — show a genuinely empty state, not a
        // silent stand-in dataset that renders as if it were this customer's real loss figures.
        setProcesses([]);
      }
      setIsLoading(false);
    })
    .catch(err => {
      console.error("Failed to load processes in LossAnalysis", err);
      setProcesses([]);
      setIsLoading(false);
    });
  }, [selectedCustomerId, token]);

  // Customer card figures for method B (lossCosting.ts): annual volume, blue-collar headcount, shift hours.
  useEffect(() => {
    if (!selectedCustomerId) return;
    setCardWorkspace({ annualVolume: 0, blueCollar: 0, shiftHours: 0, workingDays: 0 });
    fetch("/api/business/company-workspace", {
      headers: { "Authorization": `Bearer ${token}`, "x-factory-id": selectedCustomerId }
    })
    .then(res => res.json())
    .then(res => {
      const w = res.success ? res.data : null;
      const n = (v: any) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
      setCardWorkspace({
        annualVolume: n(w?.operational?.annualProductionQuantity),
        blueCollar: n(w?.workforce?.blueCollar),
        shiftHours: n(w?.workforce?.shiftWorkingHours),
        workingDays: n(w?.workforce?.workingDays)
      });
    })
    .catch(err => console.error("Failed to load company workspace in LossAnalysis", err));
  }, [selectedCustomerId, token]);

  // Fetch VSM Projects for the selected customer
  useEffect(() => {
    if (!selectedCustomerId) return;
    fetch("/api/business/vsm-projects", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomerId
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data) {
        setVsmProjects(data.data);
      }
    })
    .catch(err => {
      console.error("Failed to load VSM projects in LossAnalysis", err);
    });
  }, [selectedCustomerId, token]);

  // Fetch Kaizen/CI Projects for the selected customer, to close the loop on realized savings
  // (Recovery Matrix shows theoretical potential; completed Kaizen projects show what was actually
  // recovered) and to know which Recovery Matrix subjects already have a project assigned.
  const fetchKaizens = React.useCallback(() => {
    if (!selectedCustomerId) return;
    fetch("/api/business/kaizens", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomerId
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data) {
        setKaizens(data.data);
      }
    })
    .catch(err => {
      console.error("Failed to load Kaizen projects in LossAnalysis", err);
    });
  }, [selectedCustomerId, token]);

  useEffect(() => {
    fetchKaizens();
  }, [fetchKaizens]);

  // Fetch historical COPQ snapshots for the selected customer (real trend tracking — each point is
  // a manually saved snapshot of the calculated COPQ at that moment, not a fabricated series)
  const fetchCopqSnapshots = React.useCallback(() => {
    if (!selectedCustomerId) return;
    fetch("/api/business/copq-snapshots", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomerId
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data) {
        setCopqSnapshots(data.data);
      }
    })
    .catch(err => {
      console.error("Failed to load COPQ snapshots in LossAnalysis", err);
    });
  }, [selectedCustomerId, token]);

  useEffect(() => {
    fetchCopqSnapshots();
  }, [fetchCopqSnapshots]);

  // Compute effective revenue based on Product Group Share (Cost Control Manager Role)
  const effectiveRevenue = costModelScope === "product_group" 
    ? annualRevenue * (productVolumeShare / 100) 
    : annualRevenue;

  // Synchronize annual revenue with customer details if present
  useEffect(() => {
    if (selectedCustomer) {
      // Explicit null/undefined check (not truthy) — a real customer with annualRevenue: 0
      // (e.g. the "no company yet" placeholder) must still overwrite this component's
      // hardcoded 12,000,000 starting default, not silently keep it forever.
      if (selectedCustomer.annualRevenue !== undefined && selectedCustomer.annualRevenue !== null) {
        setAnnualRevenue(selectedCustomer.annualRevenue);
      }
      if (selectedCustomer.currency) {
        setCurrencySymbol(selectedCustomer.currency);
      }
      if (selectedCustomer.industry) {
        // Resolve closest industry enum
        const matched = Object.keys(INDUSTRY_BENCHMARKS).find(
          ind => ind.toLowerCase() === selectedCustomer.industry.toLowerCase() ||
                 selectedCustomer.industry.toLowerCase().includes(ind.toLowerCase())
        );
        if (matched) {
          setSelectedIndustry(matched as IndustryType);
        }
      }
    }
  }, [selectedCustomer]);

  // Handler to persist live edited processes back to VSM database
  const handleSaveToDatabase = async () => {
    setSaveStatus("saving");
    try {
      // Iterate over `calculatedProcesses` (not the raw `processes` input) so the persisted `oee`
      // is the same Availability x Performance x Quality figure this screen already computes and
      // displays — previously this recomputed a different, cruder produced/planned ratio here and
      // silently overwrote whatever real OEE VsmPage had calculated for the same process record.
      for (const p of calculatedProcesses) {
        const missing = new Set(p.missingFields ?? []);
        const has = (f: LossInputField) => !missing.has(f);
        // Only values entered/corrected on this screen are stored (`lossOverrides`); values measured in
        // VSM stay VSM's and are re-read on every sync. The record is merged server-side, so a field
        // shown as "girilmedi" is simply not sent.
        const lossOverrides: Partial<Record<LossInputField, number>> = {};
        for (const f of LOSS_INPUT_FIELDS) if (has(f) && p.fieldSources?.[f] === "loss") lossOverrides[f] = p[f];
        const payload: Record<string, any> = { id: p.id, name: p.name, lossOverrides };
        // Rows that are not VSM stations are mirrored to the shared process fields other modules read;
        // VSM stations keep VSM's own measured values there.
        if (!p.vsmProjectId) {
          if (has("operatorsPerShift")) payload.operatorCount = p.operatorsPerShift;
          if (has("theoreticalCycleTime")) payload.cycleTime = p.theoreticalCycleTime;
          if (has("shiftsPerDay")) payload.shiftCount = p.shiftsPerDay;
          if (has("workingHoursPerShift")) payload.workingHours = p.workingHoursPerShift;
          if (has("producedQtyPerDay")) payload.capacity = p.producedQtyPerDay;
          if (missing.size === 0) {
            payload.oee = Math.round(p.oee);
            payload.utilizationRate = Math.round(p.availability * 100);
          }
        }
        // Annual loss amounts priced with the resolved unit costs (read by CI Proje's opportunity
        // pool as yearly figures); a line whose unit cost is unresolved or whose input is missing is
        // not written. (Earlier: fixed ×800 / ×350 / ×2.500 and WIP ×50 / ×10.)
        const priced = lossCosts.byStation[p.id] ?? {};
        if (has("scrapQty") && priced.scrap !== undefined) payload.scrapCost = Math.round(priced.scrap);
        if (has("reworkQty") && priced.rework !== undefined) payload.reworkCost = Math.round(priced.rework);
        if (has("breakdownMinutesPerShift") && priced.downtime !== undefined) payload.downtimeCost = Math.round(priced.downtime);
        if (has("operatorsPerShift") && has("shiftsPerDay") && has("workingHoursPerShift")) {
          const labor = ratesById[p.id]?.laborHour;
          if (labor?.source) payload.laborCost = p.operatorsPerShift * p.shiftsPerDay * labor.value * p.workingHoursPerShift;
        }

        await fetch("/api/business/processes", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-factory-id": selectedCustomerId
          },
          body: JSON.stringify(payload)
        });
      }
      
      // Notify App.tsx to re-fetch processes so Executive Dashboard / VSM / CI Proje Yönetimi
      // pick up these updates immediately. ("FactoryChanged" dispatched with the SAME factoryId
      // is a no-op — FactoryContext only reacts when the id actually differs from the current one.)
      window.dispatchEvent(new CustomEvent("gemba:refresh-factory-data"));
      
      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Failed to save edited processes to database", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const LOSS_EDITOR_COLUMNS: { field: LossInputField; label: string; min?: number }[] = [
    { field: "operatorsPerShift", label: "Operatör Sayısı", min: 1 },
    { field: "theoreticalCycleTime", label: "İdeal Çevrim Süresi (sn)", min: 1 },
    { field: "shiftsPerDay", label: "Vardiya / Gün" },
    { field: "workingHoursPerShift", label: "Saat / Vardiya" },
    { field: "workingDaysPerWeek", label: "Çalışma Günü / Hafta" },
    { field: "breakTimeMinutes", label: "Mola (dk/vardiya)" },
    { field: "plannedMaintenanceMinutes", label: "Planlı Bakım (dk/vardiya)" },
    { field: "plannedQtyPerDay", label: "Planlanan Adet / Gün" },
    { field: "producedQtyPerDay", label: "Üretilen Adet / Gün" },
    { field: "breakdownMinutesPerShift", label: "Arıza Duruşu (dk/vardiya)" },
    { field: "setupTimeMinutes", label: "Setup Süresi (dk)" },
    { field: "setupFrequencyPerWeek", label: "Setup Sıklığı / Hafta" },
    { field: "machineAdjustmentMinutes", label: "Makine Ayarı (dk/setup)" },
    { field: "scrapQty", label: "Günlük Hurda Adedi" },
    { field: "reworkQty", label: "Günlük Rework Adedi" },
    { field: "interProcessInventory", label: "WIP Stok (Adet)" }
  ];

  // Clearing an input marks it "girilmedi" again (0 in the formulas) instead of forcing a minimum.
  const handleUpdateProcessInput = (id: string, field: LossInputField, raw: string, min = 0) => {
    setProcesses(prev => prev.map(p => {
      if (p.id !== id) return p;
      const missing = (p.missingFields ?? []).filter(f => f !== field);
      const updated: ProcessItem = raw.trim() === ""
        ? { ...p, [field]: 0, missingFields: [...missing, field], fieldSources: { ...p.fieldSources, [field]: undefined } }
        : { ...p, [field]: Math.max(min, parseFloat(raw) || 0), missingFields: missing, fieldSources: { ...p.fieldSources, [field]: "loss" } };
      updated.totalProdTimePerDayMinutes = updated.shiftsPerDay * updated.workingHoursPerShift * 60;
      updated.defectiveParts = updated.scrapQty + updated.reworkQty;
      return updated;
    }));
  };

  // "product_group" scope filters down to just the selected VSM project's own real stations
  // (tagged via vsmProjectId when VsmPage.tsx syncs them) instead of the whole customer's combined
  // process list — the previous behavior used ALL processes and only rescaled the $ output by a
  // flat percentage, which meant "seçili ürün grubu" never actually reflected that product's real
  // losses. "factory" scope is unaffected: still every process, tagged or not.
  const activeProcesses = costModelScope === "product_group" && selectedVsmProject
    ? processes.filter(p => p.vsmProjectId === selectedVsmProject.id)
    : processes;
  // A selected product group with zero tagged processes reads as a genuine "0 TL kayıp" unless
  // called out explicitly — most likely the VSM project just hasn't been re-saved since sync
  // started tagging rows, not that the product group truly has no losses.
  const isScopedWithNoData = costModelScope === "product_group" && !!selectedVsmProject && activeProcesses.length === 0;

  // Run analytical models & algorithms
  // Daily customer demand from the VSM projects in scope (weekly demand / working days). No assumed
  // volume: 0 means takt, WIP days and the revenue-based unit cost estimate are not computed.
  const defaultDemand = dailyDemandOf(activeProcesses);
  const repProcess = activeProcesses[0] ?? { shiftsPerDay: 0, workingHoursPerShift: 0, breakTimeMinutes: 0, plannedMaintenanceMinutes: 0 };
  const dailyNetAvailableSeconds = (repProcess.workingHoursPerShift * 60 - repProcess.breakTimeMinutes - repProcess.plannedMaintenanceMinutes) * repProcess.shiftsPerDay * 60;
  const computedTaktTime = defaultDemand > 0 ? parseFloat((dailyNetAvailableSeconds / defaultDemand).toFixed(1)) : 0;

  const calculatedProcesses = calculateProcessesData(activeProcesses, defaultDemand, computedTaktTime);
  // Computed directly from the already-scoped process set and revenue — activeProcesses is now
  // genuinely filtered to the selected product group's own stations when in "product_group" scope
  // (see activeProcesses above), so there's no separate factory-wide pass to rescale down from
  // anymore. This used to compute at full-factory scale first, then uniformly multiply every
  // downstream $ figure by effectiveRevenue/annualRevenue — a proxy that never reflected the
  // selected product group's real measured losses, only a percentage slice of the whole factory's.
  // Loss pricing (L3): per station, unit cost entered here → VSM project unit cost → customer card.
  // Card figures follow the model scope (product group = its share of revenue and volume).
  const scopeShare = costModelScope === "product_group" ? productVolumeShare / 100 : 1;
  const cardBasis: CardCostBasis = {
    revenue: effectiveRevenue,
    annualVolume: cardWorkspace.annualVolume * scopeShare,
    materialPct: directMaterialPercent,
    laborPct: directLaborPercent,
    energyPct: energyPercent,
    maintenancePct: maintenancePercent,
    holdingRatePct,
    directHeadcount: cardWorkspace.blueCollar,
    hoursPerPersonYear: cardWorkspace.shiftHours * cardWorkspace.workingDays * 52
  };
  const cardDerived = deriveFromCard(cardBasis, processes);
  const ratesById: Record<string, ProcessRates> = {};
  for (const p of activeProcesses) ratesById[p.id] = resolveProcessRates(p, unitCosts, cardDerived);
  const lossCosts = calculateLossCosts(calculatedProcesses, ratesById);
  // Factory-level labor rate for the remaining labor-based lines (overtime): entered → card.
  const factoryLaborRate = (unitCosts.laborHourlyRate ?? 0) > 0
    ? { value: unitCosts.laborHourlyRate as number, source: "birim" as RateSource, note: "Girilen işçilik saat maliyeti" }
    : cardDerived.laborHour;
  const updateUnitCost = (key: Exclude<keyof LossUnitCosts, "machineHourlyByLine">, raw: string) => {
    const v = parseFloat(raw);
    setUnitCosts(prev => ({ ...prev, [key]: raw.trim() === "" || !(v > 0) ? undefined : v }));
  };
  const updateLineMachineRate = (lineKey: string, raw: string) => {
    const v = parseFloat(raw);
    setUnitCosts(prev => {
      const next = { ...(prev.machineHourlyByLine ?? {}) };
      if (raw.trim() === "" || !(v > 0)) delete next[lineKey]; else next[lineKey] = v;
      return { ...prev, machineHourlyByLine: next };
    });
  };
  // Lines for the machine hour cost: one per VSM project (= line / product group) with stations in
  // the table, plus one for stations outside any VSM project.
  const costLines: { key: string; label: string }[] = [
    ...vsmProjects
      .filter((vp: any) => processes.some(p => p.vsmProjectId === vp.id))
      .map((vp: any) => ({ key: vp.id as string, label: [vp.productionLine, vp.productGroup || vp.name].filter(Boolean).join(" · ") || vp.id })),
    ...(processes.some(p => !p.vsmProjectId) ? [{ key: FACTORY_LINE_KEY, label: "VSM dışı istasyonlar" }] : [])
  ];
  const sourceLabel: Record<RateSource, string> = { birim: "Girilen", vsm: "VSM", kart: "Şirket kartı" };
  const lossCostUnresolved = (["scrap", "rework", "downtime", "setup", "laborLoss", "inventory"] as const)
    .map(key => [key, lossCosts[key]] as const)
    .filter(([, l]) => l.unresolved.length > 0);
  // JIPM 16-loss tree per station (jipmLossCost.ts). Lost contribution per piece from the card:
  // (revenue − material − energy) / annual volume; only shown where output is short of plan.
  const contributionPerUnit = cardBasis.revenue > 0 && cardBasis.annualVolume > 0 && cardBasis.materialPct > 0
    ? cardBasis.revenue * (1 - (cardBasis.materialPct + cardBasis.energyPct) / 100) / cardBasis.annualVolume
    : null;
  const jipmResults = calculatedProcesses.map(p =>
    computeJipmStation(p, stationOeeOf(p), jipmInputs[p.id] ?? {}, ratesById[p.id], { unitMaterial: cardDerived.unitMaterial, contributionPerUnit })
  );
  const jipmScope = jipmStationFilter === "all" ? jipmResults : jipmResults.filter(r => r.id === jipmStationFilter);
  const jipmTotals = JIPM_LOSSES.map(def => {
    const ls = jipmScope.map(r => r.lines.find(l => l.def.no === def.no)).filter(Boolean) as JipmLine[];
    const sum = (f: (l: JipmLine) => number) => ls.reduce((acc, l) => acc + f(l), 0);
    return {
      def,
      minutesPerDay: sum(l => l.minutesPerDay),
      personHoursPerDay: sum(l => l.personHoursPerDay),
      sources: Array.from(new Set(ls.map(l => l.source).filter(Boolean))) as string[],
      labor: sum(l => l.labor), machine: sum(l => l.machine), material: sum(l => l.material), direct: sum(l => l.direct),
      total: sum(l => l.total), contribution: sum(l => l.contribution),
      unpricedAt: ls.map((l, i) => (!l.priced ? jipmScope[i]?.name : null)).filter(Boolean) as string[]
    };
  });
  const jipmUnexplained = {
    minutes: jipmScope.reduce((acc, r) => acc + r.unexplainedMinutesPerDay, 0),
    cost: jipmScope.reduce((acc, r) => acc + r.unexplainedCost, 0)
  };
  const jipmGrandTotal = jipmTotals.reduce((acc, t) => acc + t.total, 0) + jipmUnexplained.cost;
  const jipmPareto = [...jipmTotals].filter(t => t.total > 0).sort((a, b) => b.total - a.total);
  const updateJipmInput = (stationId: string, key: keyof JipmStationInputs, raw: string) => {
    const v = parseFloat(raw);
    setJipmInputs(prev => {
      const station = { ...(prev[stationId] ?? {}) };
      if (raw.trim() === "" || !(v >= 0)) delete station[key]; else station[key] = v;
      return { ...prev, [stationId]: station };
    });
  };
  const avgShiftHours = activeProcesses.length > 0 ? activeProcesses.reduce((s2, p) => s2 + p.workingHoursPerShift, 0) / activeProcesses.length : 0;
  const financialImpactBase = calculateFinancialImpact(calculatedProcesses, effectiveRevenue, lossCosts);
  const copqDataBase = calculateCOPQ(calculatedProcesses, effectiveRevenue, financialImpactBase, copqEntered);
  // Hidden-factory equivalents: labor cost per person-year (resolved labor hour × yearly hours from the
  // card, else from the stations) and OEE loss share of the stations that have an OEE (JIPM tab).
  const avgDaysPerWeek = activeProcesses.length > 0 ? activeProcesses.reduce((s2, p) => s2 + p.workingDaysPerWeek, 0) / activeProcesses.length : 0;
  const hoursPerPersonYear = cardBasis.hoursPerPersonYear > 0 ? cardBasis.hoursPerPersonYear : avgShiftHours * avgDaysPerWeek * 52;
  const laborCostPerPersonYear = factoryLaborRate.source ? factoryLaborRate.value * hoursPerPersonYear : 0;
  const oeeStations = jipmResults.filter(r => r.oee !== null && r.loadingMinutesPerDay > 0);
  const oeeLossSharePct = oeeStations.length > 0
    ? oeeStations.reduce((a2, r) => a2 + r.oeeLossMinutesPerDay, 0) / oeeStations.reduce((a2, r) => a2 + r.loadingMinutesPerDay, 0) * 100
    : null;
  const hiddenFactoryDataBase = calculateHiddenFactory(calculatedProcesses, effectiveRevenue, copqDataBase, financialImpactBase, laborCostPerPersonYear, oeeLossSharePct);

  // --- Actual Financial Data Override Layer ---
  // If the consultant has enabled a real annual figure for a category, it replaces the
  // ratio-based estimate for that category only; everything else keeps estimating from revenue.
  // The categories summed into totalOperationalLosses mirror calculateFinancialImpact's own
  // dailyTotal composition (maintenance and waiting are derived/excluded there too, see helpers.ts).
  const TOTAL_LOSS_OVERRIDE_KEYS = ["scrap", "rework", "downtime", "setup", "laborLoss", "inventory", "overtime", "lateDelivery", "energy"];
  const hasActiveCostOverrides = COST_OVERRIDE_CATEGORIES.some(c => actualCostOverrides[c.key]?.enabled);
  const distributeAnnualValue = (annualValue: number) => ({
    day: annualValue / 260,
    week: annualValue / 52,
    month: annualValue / (260 / 22),
    year: annualValue
  });

  const financialImpact: typeof financialImpactBase = !hasActiveCostOverrides ? financialImpactBase : (() => {
    const merged: any = { ...financialImpactBase };
    COST_OVERRIDE_CATEGORIES.forEach(({ key }) => {
      const ov = actualCostOverrides[key];
      if (ov?.enabled) {
        merged[key] = distributeAnnualValue(ov.annualValue);
      }
    });
    const totalYear = TOTAL_LOSS_OVERRIDE_KEYS.reduce((sum, key) => sum + (merged[key]?.year || 0), 0);
    merged.totalOperationalLosses = distributeAnnualValue(totalYear);
    return merged;
  })();

  // Recomputed fully from the overridden financialImpact via the same pure calculation functions
  // (mathematically equivalent to the factory-scale + scaleMoneyBlock path above when no override
  // is active, since every term in both functions is linear in `revenue` or in a financialImpact
  // category's .year value — confirmed against helpers.ts before wiring this in).
  const copqData: typeof copqDataBase = !hasActiveCostOverrides ? copqDataBase : calculateCOPQ(calculatedProcesses, effectiveRevenue, financialImpact, copqEntered);
  const hiddenFactoryData: typeof hiddenFactoryDataBase = !hasActiveCostOverrides ? hiddenFactoryDataBase : calculateHiddenFactory(calculatedProcesses, effectiveRevenue, copqData, financialImpact, laborCostPerPersonYear, oeeLossSharePct);

  // Guarded so a zero-revenue empty state (no company data entered yet) reads as 0%, not
  // "%Infinity"/"%NaN" — reused everywhere this ratio is displayed below.
  const lossToRevenuePercent = effectiveRevenue > 0 ? (financialImpact.totalOperationalLosses.year / effectiveRevenue) * 100 : 0;

  // Global Lean summaries
  const avgOee = calculatedProcesses.reduce((s, p) => s + p.oee, 0) / Math.max(1, calculatedProcesses.length);
  const totalWip = calculatedProcesses.reduce((s, p) => s + p.interProcessInventory, 0);

  // Find system bottleneck Node
  const sortedByCycle = [...calculatedProcesses].sort((a,b) => b.actualCycleTimeSeconds - a.actualCycleTimeSeconds);
  const bottleneckProcess = sortedByCycle[0] || { id: "", name: "—", actualCycleTimeSeconds: 0, producedQtyPerDay: 0 };

  const averageCycleTime = calculatedProcesses.length > 0 ? (calculatedProcesses.reduce((sum, p) => sum + p.actualCycleTimeSeconds, 0) / calculatedProcesses.length) : 0;
  const lineBalanceEfficiency = bottleneckProcess.actualCycleTimeSeconds > 0 ? (averageCycleTime / bottleneckProcess.actualCycleTimeSeconds) * 100 : 0;

  // Overall system Lead time = lead days preset + WIP items / Daily demand
  // Little's law over the stations' WIP; 0 (not computed) without daily demand. (Earlier: + a fixed 4,2 days.)
  const computedLeadTimeDays = defaultDemand > 0 ? totalWip / defaultDemand : 0;

  // Overall Labor Effectiveness (OLE)
  const totalRealOperators = calculatedProcesses.reduce((sum, p) => sum + p.totalOperatorsPerDay, 0);
  const totalIdealOperators = calculatedProcesses.reduce((sum, p) => sum + p.targetWorkforce, 0);
  const overallOLE = totalRealOperators > 0 ? (totalIdealOperators / totalRealOperators) * 100 : 0;

  // Fazla İşçilik / Norm Kadro Fazlası — already-calculated per-process figures (helpers.ts
  // excessLaborHeadcount/targetWorkforceTakt) that weren't yet surfaced anywhere on the
  // dashboard. Reused as-is here, not recomputed, so this stays consistent with the Overall
  // Labor Effectiveness card above and with financialImpact.laborLoss (which already prices
  // excessLaborHeadcount at hourlyLaborRate and is scope/override-scaled).
  const totalExcessLaborHeadcount = calculatedProcesses.reduce((sum, p) => sum + p.excessLaborHeadcount, 0);
  const totalTargetWorkforceTakt = calculatedProcesses.reduce((sum, p) => sum + p.targetWorkforceTakt, 0);

  // Overall Value Stream Efficiency (OVSE)
  // Value-adding share of lead time: average C/T over one working day (shifts × hours of the representative station).
  const workingDaySeconds = repProcess.shiftsPerDay * repProcess.workingHoursPerShift * 3600;
  const overallOVSE = computedLeadTimeDays > 0 && workingDaySeconds > 0 ? ((averageCycleTime / workingDaySeconds) / computedLeadTimeDays) * 100 : 0;

  // What-If Simulation State (COPQ & Product Cost Model Linked)
  const [simSetup, setSimSetup] = useState<number>(30); // SMED Setup Süresi Azaltımı %
  const [simScrap, setSimScrap] = useState<number>(25); // Hurda Oranı Azaltımı %
  const [simOee, setSimOee] = useState<number>(8); // OEE Artışı %
  const [simLaborOpt, setSimLaborOpt] = useState<number>(15); // İş Gücü Optimizasyonu & Üretkenlik Artırımı %
  const [simOvertimeRed, setSimOvertimeRed] = useState<number>(40); // Fazla Mesai Azaltımı %
  const [simLeadTimeAccel, setSimLeadTimeAccel] = useState<number>(20); // Lead Time Hızlandırma %

  const handleResetSliders = () => {
    setSimSetup(30);
    setSimScrap(25);
    setSimOee(8);
    setSimLaborOpt(15);
    setSimOvertimeRed(40);
    setSimLeadTimeAccel(20);
  };

  // Debounced auto-save: whenever any module setting changes for the current customer, persist
  // the whole bundle ~1s after the last change. Gated on `settingsReady` so this never fires with
  // stale/default values before the customer's saved settings (or "nothing saved yet") have loaded.
  useEffect(() => {
    if (!selectedCustomerId || !settingsReady) return;
    const settingsToSave = {
      selectedIndustry, customIndustryName,
      costModelScope, productVolumeShare, selectedVsmProjectId: selectedVsmProject?.id ?? null,
      unitCosts, holdingRatePct, jipmInputs, copqEntered,
      directMaterialPercent, directLaborPercent, overtimeBurdenPercent, energyPercent, maintenancePercent, overheadPercent, operatingProfitPercent,
      customImprovementRates, opexMaturity, customInvestmentPercent,
      actualCostOverrides,
      simSetup, simScrap, simOee, simLaborOpt, simOvertimeRed, simLeadTimeAccel
    };
    const timeoutId = setTimeout(() => {
      setModuleSettingsSaveStatus("saving");
      fetch("/api/business/loss-capacity-settings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-factory-id": selectedCustomerId,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ settings: settingsToSave })
      })
      .then(res => res.json())
      .then(data => {
        setModuleSettingsSaveStatus(data.success ? "success" : "error");
        setTimeout(() => setModuleSettingsSaveStatus("idle"), 2000);
      })
      .catch(err => {
        console.error("Failed to save Loss Capacity settings", err);
        setModuleSettingsSaveStatus("error");
        setTimeout(() => setModuleSettingsSaveStatus("idle"), 2000);
      });
    }, 900);
    return () => clearTimeout(timeoutId);
  }, [
    selectedCustomerId, settingsReady, token,
    selectedIndustry, customIndustryName,
    costModelScope, productVolumeShare, selectedVsmProject,
    unitCosts, holdingRatePct, jipmInputs, copqEntered,
    directMaterialPercent, directLaborPercent, overtimeBurdenPercent, energyPercent, maintenancePercent, overheadPercent, operatingProfitPercent,
    customImprovementRates, opexMaturity, customInvestmentPercent,
    actualCostOverrides,
    simSetup, simScrap, simOee, simLaborOpt, simOvertimeRed, simLeadTimeAccel
  ]);

  // Format currency output
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(val) + " " + currencySymbol;
  };

  const benchmark = INDUSTRY_BENCHMARKS[selectedIndustry] || INDUSTRY_BENCHMARKS.Automotive;

  // -------------------------------------------------------------
  // LOSS MAPPING ENGINE (AUTOMATED FINANCIALLY MAPPED CATEGORIES)
  // -------------------------------------------------------------
  const lossMapping = React.useMemo(() => {
    // Three opportunity groups as plain sums of the priced loss lines — no split ratios.
    // (Earlier: scrap 75/25 material/labor, rework 50/20/30, breakdown 50/15/35, WIP × 22 logistics.)
    const directCostReduction = financialImpact.scrap.year + financialImpact.rework.year + financialImpact.laborLoss.year;
    const capacityCreation = financialImpact.setup.year + financialImpact.downtime.year;
    const strategicGain = financialImpact.inventory.year + financialImpact.lateDelivery.year + financialImpact.overtime.year;
    return { directCostReduction, capacityCreation, strategicGain, grandTotalLoss: directCostReduction + capacityCreation + strategicGain };
  }, [financialImpact]);

  // COPQ Finansal Matrisi Veri Modeli (VSM Entegrasyonlu & Maliyet Dağılım İlintili)
  const copqMatrixRows = React.useMemo(() => {
    // Every row is a measured / priced loss (or the customer's real figure where overridden) — no
    // revenue- or sector-percentage fallbacks, no rate × multiplier on top of a measured amount.
    // Range = ±20 % uncertainty band (Gemba QLA lossBand). Rows another row already covers stay 0
    // so the Recovery Matrix does not count the same money twice.
    // (Earlier: material budget × sector scrap %, revenue × 2,5 / 2 / 1,8 / 1,5 %, labor budget × 8 %
    // floors, OEE gap × revenue × 0,25, then × 15–25 % × 1,2–1,8 per row; and × product-group share
    // on top of losses that were already scoped to the product group.)
    const BAND = 0.2;
    const jipmSum = (nos: number[]) => jipmResults.reduce((acc, r) => acc + r.lines.filter(l => nos.includes(l.def.no)).reduce((a2, l) => a2 + l.total, 0), 0);
    const jipmUnexplainedCost = jipmResults.reduce((acc, r) => acc + r.unexplainedCost, 0);
    const row = (area: string, subject: string, costGroup: string, base: number, basis: string) =>
      ({ area, subject, costGroup, rate: basis, basis, min: base * (1 - BAND), max: base * (1 + BAND) });
    return [
      row("Doğrudan Maliyet Azaltma", "Hurda Maliyeti", "Direkt Malzeme / Hammadde", financialImpact.scrap.year, "Hurda adedi × hurda birim maliyeti"),
      row("Doğrudan Maliyet Azaltma", "Fire & Malzeme Kayıpları", "Direkt Malzeme / Hammadde", 0, "Hurda satırında (birim maliyet malzemeyi içerir)"),
      row("Doğrudan Maliyet Azaltma", "Fazla Mesai Azaltımı", "Direkt İşçilik & Fazla Mesai", financialImpact.overtime.year, "Yalnızca girilen gerçek fazla mesai tutarı"),
      row("Doğrudan Maliyet Azaltma", "Yeniden İşleme (Rework)", "Direkt İşçilik", financialImpact.rework.year, "Rework adedi × rework birim maliyeti"),
      row("Doğrudan Maliyet Azaltma", "Operasyonel Verimsizlik", "Direkt İşçilik & Hat Dengeleme", financialImpact.laborLoss.year, "Norm fazlası kişi × saat × işçilik saati"),
      row("Kapasite Yaratma", "Setup Süreleri (SMED)", "Makine Zamanı", financialImpact.setup.year, "Setup + ayar saati × (makine + işçilik saati)"),
      row("Kapasite Yaratma", "Plansız Duruşların Önlenmesi", "Bakım & Makine Zamanı", financialImpact.downtime.year, "Arıza saati × (makine + işçilik saati)"),
      row("Kapasite Yaratma", "OEE İyileştirmesi", "Makine Zamanı (performans)", jipmSum([5, 6]) + jipmUnexplainedCost, "Loss Cost 5 küçük duruş + 6 hız kaybı + dağıtılamayan OEE kaybı"),
      row("Kapasite Yaratma", "Operatör Verimliliği", "Direkt İşçilik (OLE)", jipmSum([9, 10, 12, 13]), "Loss Cost 9 yönetim + 10 hareket + 12 lojistik + 13 ölçme kayıpları"),
      row("Stratejik Operasyonel Kazanç", "Lead Time (Sipariş Çevrimi)", "Stok Finansmanı / Çalışma Sermayesi", 0, "WIP satırında (aynı stok)"),
      row("Stratejik Operasyonel Kazanç", "WIP (Yarı Mamul) Azaltımı", "Stok Finansmanı / Yarı Mamul", financialImpact.inventory.year, "Ara stok × yıllık taşıma maliyeti"),
      row("Stratejik Operasyonel Kazanç", "Sevkiyat Performansı", "Lojistik & Müşteri", financialImpact.lateDelivery.year, "Yalnızca girilen gerçek geç teslimat tutarı")
    ];
  }, [financialImpact, jipmResults]);

  // COPQ Geri Kazanım Hesaplama Modeli (Opportunity Engine)
  const recoveryMatrixData = React.useMemo(() => {
    const benchmarkRanges: Record<string, [number, number]> = {
      "Hurda Maliyeti": [15, 20],
      "Fire & Malzeme Kayıpları": [12, 30],
      "Fazla Mesai Azaltımı": [15, 25],
      "Yeniden İşleme (Rework)": [10, 30],
      "Operasyonel Verimsizlik": [15, 30],
      "Setup Süreleri (SMED)": [20, 40],
      "Plansız Duruşların Önlenmesi": [10, 25],
      "OEE İyileştirmesi": [15, 30],
      "Operatör Verimliliği": [15, 30],
      "Lead Time (Sipariş Çevrimi)": [20, 40],
      "WIP (Yarı Mamul) Azaltımı": [10, 30],
      "Sevkiyat Performansı": [10, 20]
    };

    const LEAN_TOOLS_MAP: Record<string, string> = {
      "Hurda Maliyeti": "Poka-Yoke & Kalite Otonomasyonu",
      "Fire & Malzeme Kayıpları": "Standardize İş & Malzeme Fire Kaizeni",
      "Fazla Mesai Azaltımı": "Yük Dengeleme (Heijunka) & OLE",
      "Yeniden İşleme (Rework)": "Matriks Analizi & İlk Seferde Doğru (FTT)",
      "Operasyonel Verimsizlik": "Hat Dengeleme & Yamazumi Çizelgeleme",
      "Setup Süreleri (SMED)": "SMED (Hızlı Kalıp Değişimi)",
      "Plansız Duruşların Önlenmesi": "Otonom & Planlı Bakım (TPM)",
      "OEE İyileştirmesi": "OEE 6 Büyük Kayıp & Kobetsu Kaizen",
      "Operatör Verimliliği": "Ergonomi & Standart İş Kombinasyon",
      "Lead Time (Sipariş Çevrimi)": "VSM Değer Akış Haritalama & Çekme",
      "WIP (Yarı Mamul) Azaltımı": "Kanban & Sürekli Akış (One-Piece)",
      "Sevkiyat Performansı": "Mizusumashi & Lojistik OTIF Takibi"
    };

    const mNorm = opexMaturity / 100;
    const oeeNorm = Math.max(0, Math.min(100, avgOee)) / 100;
    
    // Low maturity & low OEE -> high improvement rate (f is close to 1)
    // High maturity & high OEE -> low improvement rate (f is close to 0)
    const f = Math.max(0, Math.min(1, 1 - (mNorm * 0.4 + oeeNorm * 0.4)));

    const rawData = copqMatrixRows.map((row) => {
      const range = benchmarkRanges[row.subject] || [10, 20];
      const [bMin, bMax] = range;

      const autoMin = bMin + (bMax - bMin) * (f * 0.85);
      const autoMax = bMin + (bMax - bMin) * f;

      const custom = customImprovementRates[row.subject];
      const improvementMin = custom ? custom.min : autoMin;
      const improvementMax = custom ? custom.max : autoMax;

      const potentialGainMin = row.min * (improvementMin / 100);
      const potentialGainMax = row.max * (improvementMax / 100);
      const avgLoss = (row.min + row.max) / 2;
      const avgGain = (potentialGainMin + potentialGainMax) / 2;

      const ebitdaImpactPercent = effectiveRevenue > 0 ? (avgGain / effectiveRevenue) * 100 : 0;

      return {
        area: row.area,
        subject: row.subject,
        costGroup: row.costGroup,
        leanTool: LEAN_TOOLS_MAP[row.subject] || "Kaizen & Standart İş",
        avgLoss,
        improvementMin,
        improvementMax,
        potentialGainMin,
        potentialGainMax,
        avgGain,
        ebitdaImpactPercent,
        isCustom: !!custom
      };
    });

    // Sort to determine importance dynamically relative to average loss
    const sortedByLoss = [...rawData].sort((a, b) => b.avgLoss - a.avgLoss);
    
    return rawData.map((item) => {
      const index = sortedByLoss.findIndex(s => s.subject === item.subject);
      let severity: "Critical" | "High" | "Medium" | "Low" = "Low";
      if (index < 2) severity = "Critical";
      else if (index < 5) severity = "High";
      else if (index < 9) severity = "Medium";

      return {
        ...item,
        severity
      };
    });
  }, [copqMatrixRows, opexMaturity, avgOee, customImprovementRates, effectiveRevenue]);

  // Realized Savings Feedback Loop: sums actualSavings from Completed Kaizen/CI projects that
  // originated from this Recovery Matrix (linked via opportunityType === row.subject, set when
  // KaizenManager.generateOpportunities() converts a Loss Capacity opportunity into a real project).
  // This closes the loop between theoretical improvement potential and what was actually recovered.
  const realizedSavingsBySubject = React.useMemo(() => {
    const map: Record<string, number> = {};
    kaizens.forEach((k) => {
      if (k.status !== "Completed" || !k.opportunityType) return;
      map[k.opportunityType] = (map[k.opportunityType] || 0) + (Number(k.actualSavings) || 0);
    });
    return map;
  }, [kaizens]);

  const recoveryMatrixDataWithRealized = React.useMemo(() => {
    return recoveryMatrixData.map((row) => {
      const realized = realizedSavingsBySubject[row.subject] || 0;

      const investmentPercent = customInvestmentPercent[row.subject] ?? (DEFAULT_INVESTMENT_PERCENT[row.subject] ?? 8);
      const investmentCost = row.avgLoss * (investmentPercent / 100);
      // Payback: how many months of the average recovered gain it takes to earn back the investment.
      const paybackMonths = row.avgGain > 0 ? (investmentCost / (row.avgGain / 12)) : null;
      const roiPercent = investmentCost > 0 ? ((row.avgGain - investmentCost) / investmentCost) * 100 : 0;
      const roiMinPercent = investmentCost > 0 ? ((row.potentialGainMin - investmentCost) / investmentCost) * 100 : 0;
      const roiMaxPercent = investmentCost > 0 ? ((row.potentialGainMax - investmentCost) / investmentCost) * 100 : 0;

      return {
        ...row,
        realizedSavings: realized,
        remainingPotential: Math.max(0, row.avgGain - realized),
        investmentPercent,
        investmentCost,
        paybackMonths,
        roiPercent,
        roiMinPercent,
        roiMaxPercent,
        isInvestmentCustom: customInvestmentPercent[row.subject] !== undefined
      };
    });
  }, [recoveryMatrixData, realizedSavingsBySubject, customInvestmentPercent]);

  // How many CI/Kaizen projects (any status) already exist for each Recovery Matrix subject —
  // shown as a badge so the manager can see at a glance what's already been assigned.
  const kaizenCountBySubject = React.useMemo(() => {
    const map: Record<string, number> = {};
    kaizens.forEach((k) => {
      if (!k.opportunityType) return;
      map[k.opportunityType] = (map[k.opportunityType] || 0) + 1;
    });
    return map;
  }, [kaizens]);

  const handleOpenAssignModal = (row: any) => {
    setAssignModalRow(row);
    setAssignLeader("");
    setAssignDepartment(row.costGroup || "");
    const defaultDeadline = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setAssignDeadline(defaultDeadline);
  };

  const handleSubmitAssignProject = async () => {
    if (!assignModalRow || !selectedCustomerId || !assignLeader.trim()) return;
    setIsAssigningProject(true);
    const row = assignModalRow;
    const today = new Date().toISOString().split("T")[0];
    const newProject = {
      id: `kai_${Math.random().toString(36).substr(2, 9)}`,
      title: `${row.subject} İyileştirme Projesi`,
      originator: assignLeader.trim(),
      department: assignDepartment.trim() || row.costGroup,
      dateProposed: today,
      impactLevel: (row.severity === "Critical" || row.severity === "High") ? "High" : row.severity === "Medium" ? "Medium" : "Low",
      estimatedCost: Math.round(row.investmentCost),
      currentLoss: Math.round(row.avgLoss),
      actualSavings: 0,
      status: "In Progress",
      descriptionBefore: `${row.subject} kaynaklı yıllık kayıp: ${formatMoney(row.avgLoss)} (Maliyet Grubu: ${row.costGroup}).`,
      descriptionAfter: "Aksiyon planı uygulanıyor, standartlaşma hedefleniyor.",
      description: `Loss Capacity Analizi Geri Kazanım Matrisi'nden atanan iyileştirme projesi. Önerilen yalın araç: ${row.leanTool}. Ortalama beklenen tasarruf: ${formatMoney(row.avgGain)} (Aralık: ${formatMoney(row.potentialGainMin)} - ${formatMoney(row.potentialGainMax)}).`,
      projectLeader: assignLeader.trim(),
      projectTeam: [],
      projectSponsor: "",
      plannedFinishDate: assignDeadline,
      phase: "Faz 1 (1 Ay)",
      opportunityId: `lc_${selectedCustomerId}_${row.subject.replace(/[^a-zA-Z0-9]+/g, "_")}`,
      opportunityType: row.subject,
      kanbanStatus: "PLAN",
      expectedGain: Math.round(row.avgGain),
      tasks: [
        { id: `tsk_1_${Math.random().toString(36).substring(2, 5)}`, name: "Mevcut Durum Standardizasyon Analizi", responsible: assignLeader.trim(), deadline: assignDeadline, priority: "High", progressPercent: 0 },
        { id: `tsk_2_${Math.random().toString(36).substring(2, 5)}`, name: "Kök Neden Analizi & Aksiyon Tasarımı", responsible: assignLeader.trim(), deadline: assignDeadline, priority: "High", progressPercent: 0 }
      ],
      problemDefinition: `${row.subject} kaynaklı yıllık kayıp: ${formatMoney(row.avgLoss)}.`,
      rootCause: "Kök neden 5 Neden analizi yapılması bekleniyor.",
      improvementActions: "Belirlenen iyileştirme faaliyetleri planlanacaktır.",
      responsibles: assignLeader.trim(),
      actionsTaken: "Proje başlangıç aşamasında."
    };

    try {
      const res = await fetch("/api/business/kaizens", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-factory-id": selectedCustomerId,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newProject)
      });
      const data = await res.json();
      if (data.success) {
        fetchKaizens();
        // CI Proje Yönetimi (KaizenManager) is fed by App.tsx's own kaizens state, fetched once —
        // it won't know about this new project unless told to refetch (same event VsmPage/the VSM
        // live editor already use for this exact "wrote to a shared backend row from elsewhere" case).
        window.dispatchEvent(new CustomEvent("gemba:refresh-factory-data"));
        setAssignModalRow(null);
        setAssignSuccessMessage(`"${row.subject}" için proje CI Proje Yönetimi'ne atandı.`);
        setTimeout(() => setAssignSuccessMessage(null), 4000);
      }
    } catch (err) {
      console.error("Failed to assign Recovery Matrix item as a project", err);
    }
    setIsAssigningProject(false);
  };

  const totalRealizedSavingsExport = recoveryMatrixDataWithRealized.reduce((sum, item) => sum + item.realizedSavings, 0);
  const totalAverageRecoveryExport = recoveryMatrixDataWithRealized.reduce((sum, item) => sum + item.avgGain, 0);
  const companyNameExport = selectedCustomer?.companyName || "Fabrika";
  const scopeLabelExport = costModelScope === "product_group"
    ? `${selectedVsmProject?.productGroup || "Özel Ürün Grubu"} (%${productVolumeShare} Ciro Payı)`
    : "Fabrika Geneli (%100 Ciro)";

  // Real Recharts DOM captures (not redrawn approximations) for both the PDF and XLS exports —
  // same modern-screenshot/domToCanvas technique already used by VsmPage/OpexProjectDashboard.
  // "wide" charts span the full grid width instead of one of the 3 columns.
  const CHART_CAPTURE_LIST: { id: string; title: string; wide?: boolean }[] = [
    { id: "lc-chart-waterfall", title: "1. Toplam Finansal Geri Kazanım (Şelale)" },
    { id: "lc-chart-area-earnings", title: "2. Fırsat Alanlarına Göre Kazanç" },
    { id: "lc-chart-direct-donut", title: "3. Doğrudan Maliyet Azaltma Dağılımı" },
    { id: "lc-chart-capacity-donut", title: "4. Kapasite Kazanım Dağılımı" },
    { id: "lc-chart-treemap", title: "5. Stratejik Kazanç Dağılımı" },
    { id: "lc-chart-minmax", title: "6. Min / Max Kazanç Karşılaştırması" },
    { id: "lc-chart-profit-before-after", title: "7. Faaliyet Karı Öncesi / Sonrası" },
    { id: "lc-chart-pareto", title: "8. En Büyük İlk 5 Fırsat (Pareto)" },
    { id: "lc-chart-once-sonra", title: "9. Önce / Sonra Kazanım Karşılaştırması" },
    { id: "lc-chart-profit-curve", title: "10. İyileştirmelerin Faaliyet Kâr Marjına Etki Eğrisi", wide: true }
  ];

  const captureChartImage = async (elementId: string): Promise<{ dataUrl: string; aspectRatio: number } | null> => {
    const el = document.getElementById(elementId);
    if (!el) return null;
    try {
      const canvas = await domToCanvas(el, { scale: 2, backgroundColor: "#ffffff" });
      if (canvas.width === 0 || canvas.height === 0) return null;
      return { dataUrl: canvas.toDataURL("image/png", 1.0), aspectRatio: canvas.width / canvas.height };
    } catch (e) {
      console.error(`Failed to capture chart ${elementId} for export`, e);
      return null;
    }
  };

  // The "10 Power BI Charts" grid + the historical COPQ trend chart only exist in the DOM while
  // the "Dashboard" tab is active. Both export buttons live in the global header, reachable from
  // any tab, so this temporarily switches there, waits for Recharts to paint, captures, then
  // restores whatever tab the user was actually on.
  const captureDashboardCharts = async (): Promise<{
    trend: { dataUrl: string; aspectRatio: number } | null;
    charts: Record<string, { dataUrl: string; aspectRatio: number } | null>;
  }> => {
    const previousTab = activeTab;
    const needsSwitch = activeTab !== "executive_dashboard";
    if (needsSwitch) {
      setActiveTab("executive_dashboard");
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const trend = await captureChartImage("lc-chart-copq-trend");
    const charts = Object.fromEntries(
      await Promise.all(CHART_CAPTURE_LIST.map(async c => [c.id, await captureChartImage(c.id)] as const))
    ) as Record<string, { dataUrl: string; aspectRatio: number } | null>;
    if (needsSwitch) setActiveTab(previousTab);
    return { trend, charts };
  };

  // Cell styling shared by every sheet — plain `xlsx` (SheetJS community) can't write borders or
  // fills at all; ExcelJS supports both (same pattern MasterPlanGantt.tsx's export already uses).
  const XLS_THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFCBD5E1" } };
  const XLS_BORDER: Partial<ExcelJS.Borders> = { top: XLS_THIN, left: XLS_THIN, bottom: XLS_THIN, right: XLS_THIN };
  const XLS_HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9F1239" } };
  const XLS_TITLE_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  const XLS_ALT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF2F4" } };
  const XLS_SEVERITY_FILL: Record<string, ExcelJS.Fill> = {
    Critical: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4E6" } },
    High: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEDD5" } },
    Medium: { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } },
    Low: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }
  };
  const XLS_SEVERITY_FONT: Record<string, string> = {
    Critical: "FFBE123C", High: "FFC2410C", Medium: "FF1D4ED8", Low: "FF334155"
  };

  const addTitleRow = (ws: ExcelJS.Worksheet, text: string, cols: number) => {
    const row = ws.addRow([text]);
    ws.mergeCells(row.number, 1, row.number, cols);
    row.getCell(1).font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    row.getCell(1).fill = XLS_TITLE_FILL;
    row.getCell(1).alignment = { vertical: "middle" };
    ws.getRow(row.number).height = 24;
  };

  const addHeaderRow = (ws: ExcelJS.Worksheet, headers: string[]) => {
    const row = ws.addRow(headers);
    row.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
      cell.fill = XLS_HEADER_FILL;
      cell.border = XLS_BORDER;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    ws.getRow(row.number).height = 26;
  };

  const addDataRow = (ws: ExcelJS.Worksheet, values: (string | number)[], rowIndex: number) => {
    const row = ws.addRow(values);
    row.eachCell(cell => {
      cell.border = XLS_BORDER;
      cell.font = { size: 9.5 };
      if (rowIndex % 2 === 1) cell.fill = XLS_ALT_FILL;
    });
    return row;
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const { trend, charts } = await captureDashboardCharts();

      const wb = new ExcelJS.Workbook();
      wb.creator = "Gemba Tools";
      wb.created = new Date();

      // 1. Özet (Summary) sheet
      const wsSummary = wb.addWorksheet("Ozet", { views: [{ state: "frozen", ySplit: 1 }] });
      wsSummary.getColumn(1).width = 34;
      wsSummary.getColumn(2).width = 30;
      addTitleRow(wsSummary, `KAYIP MALİYET ANALİZİ — ${companyNameExport}`, 2);
      wsSummary.addRow(["Maliyet Modeli Kapsamı", scopeLabelExport]);
      wsSummary.addRow(["Rapor Tarihi", new Date().toLocaleDateString("tr-TR")]);
      wsSummary.addRow(["Model Cirosu", `${currencySymbol}${effectiveRevenue.toLocaleString()}`]);
      wsSummary.addRow([]);
      addHeaderRow(wsSummary, ["KPI Metrik Adı", "Değer"]);
      [
        ["Toplam COPQ Kaybı", `${currencySymbol}${copqData.totalCOPQ_TL.toLocaleString()}`],
        ["COPQ / Ciro Oranı", `%${copqData.copqPercentOfRevenue.toFixed(2)}`],
        ["Benchmark Durumu", copqData.benchmarkStatus],
        ["Ortalama Beklenen Kazanç", `${currencySymbol}${totalAverageRecoveryExport.toLocaleString()}`],
        ["Gerçekleşen Tasarruf (Tamamlanan Kaizen)", `${currencySymbol}${totalRealizedSavingsExport.toLocaleString()}`],
        ["Gerçekleşme Oranı", `%${(totalAverageRecoveryExport > 0 ? (totalRealizedSavingsExport / totalAverageRecoveryExport) * 100 : 0).toFixed(1)}`]
      ].forEach((r, i) => addDataRow(wsSummary, r, i));

      // 2. COPQ Matrisi sheet
      const wsCopq = wb.addWorksheet("COPQ_Matrisi", { views: [{ state: "frozen", ySplit: 2 }] });
      const copqHeaders = ["Maliyet Konusu", "Fırsat Alanı", "Maliyet Grubu", "Kaynak / formül", `Min (${currencySymbol})`, `Max (${currencySymbol})`];
      wsCopq.columns = [{ width: 32 }, { width: 26 }, { width: 26 }, { width: 46 }, { width: 18 }, { width: 18 }];
      addTitleRow(wsCopq, "COPQ FİNANSAL KAYIP MATRİSİ (ölçülen kayıp, ±%20 bant)", copqHeaders.length);
      addHeaderRow(wsCopq, copqHeaders);
      copqMatrixRows.forEach((r, i) => addDataRow(wsCopq, [r.subject, r.area, r.costGroup, r.basis, Math.round(r.min), Math.round(r.max)], i));

      // Same model as the executive PDF, so the workbook and the report agree line by line.
      const rm = buildLossReportModel();
      const srcLabel = (v: string | null) => (v === "birim" ? "Girilen" : v === "vsm" ? "VSM" : v === "kart" ? "Şirket kartı" : "Yok");

      const wsPool = wb.addWorksheet("Kayip_Havuzu", { views: [{ state: "frozen", ySplit: 2 }] });
      const poolHeaders = ["Kayıp kalemi", `Günlük (${currencySymbol})`, `Aylık (${currencySymbol})`, `Yıllık (${currencySymbol})`, "Gerçek veri", "Hesaplanamayan istasyonlar"];
      wsPool.columns = [{ width: 30 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 12 }, { width: 50 }];
      addTitleRow(wsPool, "KAYIP HAVUZU (ölçülen kayıp × birim maliyet)", poolHeaders.length);
      addHeaderRow(wsPool, poolHeaders);
      rm.lossLines.forEach((l, i) => addDataRow(wsPool, [l.label, Math.round(l.year / 260), Math.round(l.year * 22 / 260), Math.round(l.year), l.real ? "Evet" : "", l.unresolved.join(", ")], i));

      const wsSt = wb.addWorksheet("Istasyonlar", { views: [{ state: "frozen", ySplit: 2, xSplit: 1 }] });
      const stHeaders = ["İstasyon", "Hat / VSM", "OEE (%)", "OEE kaynağı", "Hurda adet/gün", "Rework adet/gün", "Arıza dk/gün", "Setup dk/gün", "WIP",
        "Hurda", "Rework", "Arıza", "Setup", "Norm fazlası", "Stok", "Eksik girdi", "Hurda birim kaynağı", "Rework birim kaynağı", "İşçilik saat kaynağı", "Makine saat kaynağı", "Stok kaynağı"];
      wsSt.columns = stHeaders.map((_, i) => ({ width: i === 0 || i === 1 ? 26 : 14 }));
      addTitleRow(wsSt, `İSTASYON BAZINDA KAYIPLAR (tutarlar yıllık, ${currencySymbol})`, stHeaders.length);
      addHeaderRow(wsSt, stHeaders);
      rm.stations.forEach((st, i) => addDataRow(wsSt, [
        st.name, st.line, st.oee !== null ? Number(st.oee.toFixed(1)) : "-", st.oeeSource ?? "-", st.scrapQty, st.reworkQty, Math.round(st.breakdownMinPerDay), Math.round(st.setupMinPerDay), st.wip,
        ...(["scrap", "rework", "downtime", "setup", "laborLoss", "inventory"] as const).map(k => st.costs[k] !== undefined ? Math.round(st.costs[k] as number) : "-"),
        st.missingInputs, srcLabel(st.rates.scrap), srcLabel(st.rates.rework), srcLabel(st.rates.labor), srcLabel(st.rates.machine), srcLabel(st.rates.wip)
      ], i));

      const wsTpm = wb.addWorksheet("Loss_Cost_16_Kayip", { views: [{ state: "frozen", ySplit: 2 }] });
      const tpmHeaders = ["No", "Kayıp", "Grup", "Dk/gün", "Kişi-saat/gün", "Kaynak", `İşçilik (${currencySymbol})`, `Makine (${currencySymbol})`, `Malzeme (${currencySymbol})`, `Enerji/Takım (${currencySymbol})`, `Toplam (${currencySymbol})`, `Kayıp katkı payı (${currencySymbol})`, "Fiyatlanamayan istasyonlar", "Yalın / TPM aracı"];
      wsTpm.columns = [{ width: 6 }, { width: 34 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 30 }, { width: 30 }];
      addTitleRow(wsTpm, "LOSS COST ANALİZİ — 16 BÜYÜK KAYIP (yıllık)", tpmHeaders.length);
      addHeaderRow(wsTpm, tpmHeaders);
      rm.jipm.lines.forEach((l, i) => addDataRow(wsTpm, [l.no, l.name, l.group, Number(l.minutesPerDay.toFixed(1)), Number(l.personHoursPerDay.toFixed(1)), l.sources.join(", "),
        Math.round(l.labor), Math.round(l.machine), Math.round(l.material), Math.round(l.direct), Math.round(l.total), Math.round(l.contribution), l.unpricedAt.join(", "), l.tool], i));
      if (rm.jipm.unexplained.minutes > 0.05) addDataRow(wsTpm, ["", "Dağıtılamayan OEE kaybı", "Ekipman", Number(rm.jipm.unexplained.minutes.toFixed(1)), "", "OEE − ölçülen", "", "", "", "", Math.round(rm.jipm.unexplained.cost), "", "", ""], rm.jipm.lines.length);

      const wsGaps = wb.addWorksheet("Veri_Bosluklari");
      wsGaps.getColumn(1).width = 120;
      addTitleRow(wsGaps, "TAMAMLANMASI GEREKEN VERİLER", 1);
      (rm.warnings.length ? rm.warnings : ["Kritik veri boşluğu yok."]).forEach((w, i) => addDataRow(wsGaps, [w], i));

      // 3. Geri Kazanım Matrisi sheet — severity column gets a real traffic-light fill/font
      const wsRecovery = wb.addWorksheet("Geri_Kazanim_Matrisi", { views: [{ state: "frozen", ySplit: 2, xSplit: 2 }] });
      const recoveryHeaders = ["Fırsat Alanı", "Maliyet Konusu", "Yalın/WCM Aracı", `Ort. Kayıp (${currencySymbol})`, "İyileştirme Min (%)", "İyileştirme Max (%)", `Ort. Tasarruf (${currencySymbol})`, `Yatırım (${currencySymbol})`, "Geri Ödeme (Ay)", "ROI (%)", `Gerçekleşen (${currencySymbol})`, `Kalan Potansiyel (${currencySymbol})`, "Önem Derecesi"];
      wsRecovery.columns = [{ width: 20 }, { width: 30 }, { width: 26 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 18 }, { width: 14 }];
      addTitleRow(wsRecovery, "FİNANSAL GERİ KAZANIM VE İYİLEŞTİRME FIRSATLARI MATRİSİ", recoveryHeaders.length);
      addHeaderRow(wsRecovery, recoveryHeaders);
      recoveryMatrixDataWithRealized.forEach((r, i) => {
        const row = addDataRow(wsRecovery, [
          r.area, r.subject, r.leanTool, Math.round(r.avgLoss), r.improvementMin, r.improvementMax, Math.round(r.avgGain),
          Math.round(r.investmentCost), r.paybackMonths !== null ? Number(r.paybackMonths.toFixed(1)) : "-", Number(r.roiPercent.toFixed(0)),
          Math.round(r.realizedSavings), Math.round(r.remainingPotential), r.severity
        ], i);
        const severityCell = row.getCell(recoveryHeaders.length);
        severityCell.fill = XLS_SEVERITY_FILL[r.severity] || XLS_SEVERITY_FILL.Low;
        severityCell.font = { bold: true, size: 9.5, color: { argb: XLS_SEVERITY_FONT[r.severity] || XLS_SEVERITY_FONT.Low } };
        severityCell.alignment = { horizontal: "center" };
      });

      // 4. Grafikler sheet — embeds the live Power BI-style Recharts captures as real images
      const wsCharts = wb.addWorksheet("Grafikler");
      wsCharts.getColumn(1).width = 4;
      addTitleRow(wsCharts, "PANO GRAFİKLERİ (DASHBOARD SEKMESİNDEN CANLI YAKALAMA)", 12);
      let chartRowCursor = 3;
      const embedChart = (chart: { dataUrl: string; aspectRatio: number } | null, title: string) => {
        if (!chart) return;
        const titleRow = wsCharts.getRow(chartRowCursor);
        titleRow.getCell(2).value = title;
        titleRow.getCell(2).font = { bold: true, size: 10, color: { argb: "FF9F1239" } };
        const widthCols = 12;
        const heightRows = Math.max(14, Math.round(widthCols * (1 / chart.aspectRatio) * 5.5));
        const imageId = wb.addImage({ base64: chart.dataUrl, extension: "png" });
        wsCharts.addImage(imageId, {
          tl: { col: 1, row: chartRowCursor + 0.2 },
          ext: { width: widthCols * 64, height: heightRows * 15.5 }
        });
        chartRowCursor += heightRows + 2;
      };
      embedChart(trend, "Tarihsel COPQ Trend Analizi");
      embedChart(charts["lc-chart-profit-curve"], "İyileştirmelerin Faaliyet Kâr Marjına Etki Eğrisi");
      embedChart(charts["lc-chart-waterfall"], "Toplam Finansal Geri Kazanım (Şelale)");
      embedChart(charts["lc-chart-pareto"], "En Büyük İlk 5 Fırsat (Pareto)");
      if (chartRowCursor === 3) {
        wsCharts.getRow(3).getCell(2).value = "Grafikler yakalanamadı — dışa aktarmadan önce Dashboard sekmesini ziyaret etmeyi deneyin.";
        wsCharts.getRow(3).getCell(2).font = { italic: true, color: { argb: "FF94A3B8" } };
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Loss_Capacity_Analizi_${companyNameExport.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Executive report ("Kayıp Maliyet Analizi — Yönetici Raporu", L7): the figures this screen shows
  // are collected into one model (src/utils/lossReportModel.ts) and printed server-side by the same
  // Chromium pipeline and design as the OpEx executive report (src/server/lossReport). Always for
  // the whole selected scope — the JIPM station filter on tab 6 does not narrow the report.
  const buildLossReportModel = (): LossReportModel => {
    const today = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    const lineName = (id?: string) => {
      if (!id) return "";
      const vp: any = vsmProjects.find((x: any) => x.id === id);
      return vp ? [vp.productionLine, vp.productGroup || vp.name].filter(Boolean).join(" · ") : "";
    };
    const rateCount = { birim: 0, vsm: 0, kart: 0, none: 0 };
    const stations: LossReportStation[] = calculatedProcesses.map(p => {
      const r = ratesById[p.id];
      const so = stationOeeOf(p);
      const rates = { scrap: r?.scrapUnit.source ?? null, rework: r?.reworkUnit.source ?? null, labor: r?.laborHour.source ?? null, machine: r?.machineHour.source ?? null, wip: r?.wipHolding.source ?? null };
      Object.values(rates).forEach(v => { rateCount[v ?? "none"] += 1; });
      return {
        name: p.name,
        line: lineName(p.vsmProjectId),
        oee: so?.oee ?? null,
        oeeSource: so?.source ?? null,
        scrapQty: p.scrapQty,
        reworkQty: p.reworkQty,
        breakdownMinPerDay: p.breakdownMinutesPerShift * p.shiftsPerDay,
        setupMinPerDay: p.workingDaysPerWeek > 0 ? (p.setupTimeMinutes + p.machineAdjustmentMinutes) * p.setupFrequencyPerWeek / p.workingDaysPerWeek : 0,
        wip: p.interProcessInventory,
        costs: lossCosts.byStation[p.id] ?? {},
        missingInputs: p.missingFields?.length ?? 0,
        rates
      };
    });
    const lossKeys = ["scrap", "rework", "downtime", "setup", "laborLoss", "inventory", "overtime", "lateDelivery", "energy", "maintenance"] as const;
    const lossLines: LossReportLine[] = lossKeys
      .map(key => ({
        key,
        label: COST_OVERRIDE_CATEGORIES.find(c => c.key === key)?.label ?? key,
        year: (financialImpact as any)[key]?.year ?? 0,
        real: !!actualCostOverrides[key]?.enabled,
        unresolved: (lossCosts as any)[key]?.unresolved ?? []
      }))
      .filter(l => ["scrap", "rework", "downtime", "setup", "laborLoss", "inventory"].includes(l.key) || l.real || l.year > 0);
    const jipmLines = JIPM_LOSSES.map(def => {
      const ls = jipmResults.map(r => ({ r, l: r.lines.find(x => x.def.no === def.no)! }));
      const sum = (f: (l: JipmLine) => number) => ls.reduce((acc, x) => acc + f(x.l), 0);
      return {
        no: def.no, name: def.name, group: def.group, tool: def.tool,
        minutesPerDay: sum(l => l.minutesPerDay), personHoursPerDay: sum(l => l.personHoursPerDay),
        sources: Array.from(new Set(ls.map(x => x.l.source).filter(Boolean))) as string[],
        labor: sum(l => l.labor), machine: sum(l => l.machine), material: sum(l => l.material), direct: sum(l => l.direct),
        total: sum(l => l.total), contribution: sum(l => l.contribution),
        unpricedAt: ls.filter(x => !x.l.priced).map(x => x.r.name)
      };
    });
    const jipmUnexplainedAll = { minutes: jipmResults.reduce((a2, r) => a2 + r.unexplainedMinutesPerDay, 0), cost: jipmResults.reduce((a2, r) => a2 + r.unexplainedCost, 0) };
    const jipmTotalAll = jipmLines.reduce((a2, l) => a2 + l.total, 0) + jipmUnexplainedAll.cost;
    const minutesOf = (r: typeof jipmResults[number], nos: number[]) => r.lines.filter(l => nos.includes(l.def.no)).reduce((a2, l) => a2 + l.minutesPerDay, 0);
    const entered = (k: CopqEnteredKey) => (copqEntered[k] ?? 0) > 0;
    const copq: LossReportModel["copq"] = [
      { label: "Hurda", group: "İç hata", year: copqData.scrapCost, entered: false },
      { label: "Yeniden işleme (rework)", group: "İç hata", year: copqData.reworkCost, entered: false },
      { label: "Müşteri iadeleri", group: "Dış hata", year: copqData.customerReturns, entered: entered("customerReturns") },
      { label: "Garanti giderleri", group: "Dış hata", year: copqData.warrantyCost, entered: entered("warranty") },
      { label: "Müşteri şikâyeti işleme", group: "Dış hata", year: copqData.customerComplaints, entered: entered("customerComplaints") },
      { label: "Ek / acil nakliye", group: "Dış hata", year: copqData.extraFreight, entered: entered("extraFreight") },
      { label: "Acil sevkiyat / hızlandırma", group: "Dış hata", year: copqData.expeditingCost, entered: entered("expediting") },
      { label: "Kayıp satış (katkı payı)", group: "Dış hata", year: copqData.lostSalesCost, entered: entered("lostSales") },
      { label: "Muayene / kontrol", group: "Muayene", year: copqData.inspectionCost, entered: entered("inspection") },
      { label: "Kalite personeli", group: "Muayene", year: copqData.qualityPersonnelCost, entered: entered("qualityPersonnel") },
      { label: "Ayıklama / sınıflama", group: "Muayene", year: copqData.sortingCost, entered: entered("sorting") },
      { label: "Kayıp kapasite (arıza + setup)", group: "Kapasite & akış", year: copqData.lostCapacityCost, entered: false },
      { label: "Fazla stok (WIP taşıma)", group: "Kapasite & akış", year: copqData.excessInventoryCost, entered: false },
      { label: "Geç teslimat", group: "Kapasite & akış", year: copqData.lateDeliveryCost, entered: !!actualCostOverrides.lateDelivery?.enabled },
      { label: "Acil fazla mesai", group: "Kapasite & akış", year: copqData.emergencyOvertimeCost, entered: !!actualCostOverrides.overtime?.enabled }
    ];
    const recovery: LossReportRecoveryRow[] = recoveryMatrixDataWithRealized.map((r: any) => {
      const mrow: any = copqMatrixRows.find(x => x.subject === r.subject);
      return {
        area: r.area, subject: r.subject, costGroup: r.costGroup, leanTool: r.leanTool, basis: mrow?.basis ?? "",
        lossMin: mrow?.min ?? 0, lossMax: mrow?.max ?? 0, avgLoss: r.avgLoss,
        improvementMin: r.improvementMin, improvementMax: r.improvementMax,
        gainMin: r.potentialGainMin, gainMax: r.potentialGainMax, avgGain: r.avgGain,
        investment: r.investmentCost, paybackMonths: r.paybackMonths, roiPercent: r.roiPercent,
        severity: r.severity, realizedSavings: r.realizedSavings, projects: kaizenCountBySubject[r.subject] || 0
      };
    });
    const warnings: string[] = [];
    if (effectiveRevenue <= 0) warnings.push("Yıllık ciro girilmedi (şirket kartı) — ciroya oranlar ve karttan türetilen birim maliyetler hesaplanamıyor.");
    if (cardBasis.annualVolume <= 0) warnings.push("Yıllık üretim adedi girilmedi (şirket kartı → Operasyon) — karttan birim malzeme/hurda maliyeti türetilemiyor.");
    if (directMaterialPercent + directLaborPercent + energyPercent + maintenancePercent <= 0) warnings.push("Maliyet yapısı (%) girilmedi (Ürün Maliyet Modeli).");
    if (cardWorkspace.blueCollar <= 0) warnings.push("Mavi yaka sayısı / vardiya saati girilmedi (şirket kartı → İş Gücü) — işçilik saat maliyeti karttan türetilemiyor.");
    if (defaultDemand <= 0) warnings.push("Günlük talep yok (VSM Kurulum'da haftalık talep ve çalışma günü) — takt ve stok günü hesaplanamıyor.");
    const missingTotal = activeProcesses.reduce((a2, p) => a2 + (p.missingFields?.length ?? 0), 0);
    if (missingTotal > 0) warnings.push(`${activeProcesses.filter(p => (p.missingFields?.length ?? 0) > 0).length} istasyonda toplam ${missingTotal} girdi "girilmedi" — bu girdiler hesapta 0 sayıldı.`);
    lossCostUnresolved.forEach(([key, l]) => warnings.push(`${COST_OVERRIDE_CATEGORIES.find(c => c.key === key)?.label ?? key}: birim maliyet bulunamadı — ${l.unresolved.join(", ")}.`));
    const noOee = jipmResults.filter(r => r.oee === null).length;
    if (noOee > 0) warnings.push(`${noOee} istasyonda OEE yok — bu istasyonlarda OEE kaybı 16 kayba dağıtılamadı.`);
    const totalLossYear = financialImpact.totalOperationalLosses.year;
    return {
      firm: companyNameExport,
      reportDate: today.toISOString(),
      reportNo: `LC-${String(today.getFullYear()).slice(-2)}${p2(today.getMonth() + 1)}${p2(today.getDate())}`,
      preparedBy: globalState?.CurrentUser?.name || globalState?.CurrentUser?.fullName || globalState?.CurrentUser?.email || "",
      currency: currencySymbol,
      scopeLabel: scopeLabelExport,
      industry: INDUSTRY_OPTIONS.find(o => o.id === selectedIndustry)?.labelTr || customIndustryName || "",
      revenue: effectiveRevenue,
      annualRevenue,
      annualVolume: cardBasis.annualVolume,
      costStructure: { material: directMaterialPercent, labor: directLaborPercent, overtimeBurden: overtimeBurdenPercent, energy: energyPercent, maintenance: maintenancePercent, overhead: overheadPercent, operatingProfit: operatingProfitPercent },
      dailyDemand: defaultDemand,
      totals: {
        lossYear: totalLossYear,
        lossPctOfRevenue: lossToRevenuePercent,
        copqYear: copqData.totalCOPQ_TL,
        copqPctOfRevenue: copqData.copqPercentOfRevenue,
        benchmarkStatus: copqData.benchmarkStatus,
        recoveryAvg: recoveryMatrixDataWithRealized.reduce((a2: number, r: any) => a2 + r.avgGain, 0),
        recoveryMin: recoveryMatrixDataWithRealized.reduce((a2: number, r: any) => a2 + r.potentialGainMin, 0),
        recoveryMax: recoveryMatrixDataWithRealized.reduce((a2: number, r: any) => a2 + r.potentialGainMax, 0),
        investment: recoveryMatrixDataWithRealized.reduce((a2: number, r: any) => a2 + r.investmentCost, 0),
        realizedSavings: totalRealizedSavingsExport,
        hiddenCostYear: hiddenFactoryData.hiddenCostYear,
        equivalentOperators: hiddenFactoryData.equivalentOperators,
        oeeLossSharePct,
        avgOee: oeeStations.length > 0 ? oeeStations.reduce((a2, r) => a2 + (r.oee ?? 0), 0) / oeeStations.length : null,
        stationCount: calculatedProcesses.length,
        stationsWithOee: oeeStations.length,
        jipmTotal: jipmTotalAll,
        jipmContribution: jipmLines.reduce((a2, l) => a2 + l.contribution, 0)
      },
      lossLines,
      stations,
      rateSourceCounts: rateCount,
      cardBasis: {
        scrapUnit: cardDerived.scrapUnit.source ? `${formatMoney(cardDerived.scrapUnit.value)} — ${cardDerived.scrapUnit.note}` : cardDerived.scrapUnit.note,
        reworkUnit: cardDerived.reworkUnit.source ? `${formatMoney(cardDerived.reworkUnit.value)} — ${cardDerived.reworkUnit.note}` : cardDerived.reworkUnit.note,
        laborHour: cardDerived.laborHour.source ? `${formatMoney(cardDerived.laborHour.value)} — ${cardDerived.laborHour.note}` : cardDerived.laborHour.note,
        machineHour: cardDerived.machineHour.source ? `${formatMoney(cardDerived.machineHour.value)} — ${cardDerived.machineHour.note}` : cardDerived.machineHour.note,
        wipHolding: cardDerived.wipHolding.source ? `${formatMoney(cardDerived.wipHolding.value)} — ${cardDerived.wipHolding.note}` : cardDerived.wipHolding.note,
        holdingRatePct,
        blueCollar: cardWorkspace.blueCollar,
        hoursPerPersonYear: cardBasis.hoursPerPersonYear
      },
      jipm: {
        lines: jipmLines,
        unexplained: jipmUnexplainedAll,
        stations: jipmResults.map(r => ({
          name: r.name, oee: r.oee, oeeSource: r.oeeSource, loadingMinutesPerDay: r.loadingMinutesPerDay, oeeLossMinutesPerDay: r.oeeLossMinutesPerDay,
          availabilityLoss: minutesOf(r, [1, 2, 3, 4]), performanceLoss: minutesOf(r, [5, 6]), qualityLoss: minutesOf(r, [7]),
          unexplainedMinutesPerDay: r.unexplainedMinutesPerDay
        }))
      },
      copq,
      recovery,
      profitCurve: operatingProfitCurve.map((x: any) => ({ stage: x.stage, margin: x["Faaliyet Kâr Marjı %"] })),
      warnings
    };
  };

  const handleExportPdf = async () => {
    if (!selectedCustomerId) return;
    setIsExportingPdf(true);
    try {
      const res = await fetch("/api/opex-report/loss-capacity?format=pdf", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "x-factory-id": selectedCustomerId },
        body: JSON.stringify(buildLossReportModel())
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Sunucu yanıtı ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      const name = m ? decodeURIComponent(m[1]) : `Kayip-Maliyet-Raporu.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("Loss executive report failed", e);
      alert(`Yönetici raporu oluşturulamadı: ${e?.message || "bilinmeyen hata"}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Saves a point-in-time snapshot of the currently calculated COPQ so the Dashboard can plot a
  // real historical trend, instead of a fabricated series (see removed calculateCOPQ `trend` field).
  const handleSaveCopqSnapshot = () => {
    if (!selectedCustomerId) return;
    setIsSavingSnapshot(true);
    const snapshot = {
      date: new Date().toISOString().slice(0, 10),
      totalCOPQ: copqData.totalCOPQ_TL,
      copqPercentOfRevenue: copqData.copqPercentOfRevenue,
      effectiveRevenue,
      costModelScope,
      productFamilyName: scopeLabelExport,
      internalFailure: copqData.internalFailure,
      totalRealizedSavings: totalRealizedSavingsExport
    };
    fetch("/api/business/copq-snapshots", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomerId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(snapshot)
    })
    .then(res => res.json())
    .then(() => {
      fetchCopqSnapshots();
    })
    .catch(err => {
      console.error("Failed to save COPQ snapshot", err);
    })
    .finally(() => {
      setIsSavingSnapshot(false);
    });
  };

  // Real historical COPQ trend data, sorted chronologically, deduplicated to the latest snapshot
  // saved per calendar day (repeated saves on the same day update that day's point, not add noise).
  const copqTrendData = React.useMemo(() => {
    const byDate: Record<string, any> = {};
    copqSnapshots.forEach((s) => {
      const existing = byDate[s.date];
      if (!existing || new Date(s.created_at) >= new Date(existing.created_at)) {
        byDate[s.date] = s;
      }
    });
    return Object.values(byDate)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .map((s: any) => ({
        date: s.date,
        "COPQ Toplam": Math.round(s.totalCOPQ),
        "COPQ / Ciro %": parseFloat((s.copqPercentOfRevenue || 0).toFixed(2))
      }));
  }, [copqSnapshots]);

  // COPQ - Ürün Maliyet Grubu İyileştirme Özeti
  const costGroupCopqSummary = React.useMemo(() => {
    let materialLoss = 0, materialGain = 0;
    let laborLoss = 0, laborGain = 0;
    let overheadLoss = 0, overheadGain = 0;
    let strategicLoss = 0, strategicGain = 0;

    recoveryMatrixData.forEach(r => {
      if (r.subject === "Hurda Maliyeti" || r.subject === "Fire & Malzeme Kayıpları") {
        materialLoss += r.avgLoss;
        materialGain += r.avgGain;
      } else if (r.subject === "Fazla Mesai Azaltımı" || r.subject === "Yeniden İşleme (Rework)" || r.subject === "Operasyonel Verimsizlik" || r.subject === "Operatör Verimliliği") {
        laborLoss += r.avgLoss;
        laborGain += r.avgGain;
      } else if (r.subject === "Setup Süreleri (SMED)" || r.subject === "Plansız Duruşların Önlenmesi" || r.subject === "OEE İyileştirmesi") {
        overheadLoss += r.avgLoss;
        overheadGain += r.avgGain;
      } else {
        strategicLoss += r.avgLoss;
        strategicGain += r.avgGain;
      }
    });

    return {
      materialLoss, materialGain,
      laborLoss, laborGain,
      overheadLoss, overheadGain,
      strategicLoss, strategicGain,
      totalGain: materialGain + laborGain + overheadGain + strategicGain
    };
  }, [recoveryMatrixData]);

  // Last Loss Capacity snapshot sent to the server (CI opportunity pool) and its pending debounce.
  const lossSnapshotSent = useRef<string>("");
  const lossSnapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Automatically synchronize calculated Loss Capacity Analysis to local storage for CI Project Management & Executive Dashboards
  useEffect(() => {
    if (!selectedCustomerId) return;
    const dataToSave = {
      effectiveRevenue,
      annualRevenue,
      costModelScope,
      productVolumeShare,
      selectedVsmProject: selectedVsmProject ? {
        id: selectedVsmProject.id,
        name: selectedVsmProject.name,
        productGroup: selectedVsmProject.productGroup,
        productVolumeShare: selectedVsmProject.productVolumeShare
      } : null,
      productFamilyName: selectedVsmProject ? selectedVsmProject.productGroup : (costModelScope === "product_group" ? "Özel Ürün Grubu" : "Tüm Fabrika"),
      productFamilyRatio: costModelScope === "product_group" ? (productVolumeShare / 100) : 1,
      copqMatrixRows,
      recoveryMatrixData,
      costGroupCopqSummary,
      copqTotal: copqData.totalCOPQ_TL,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(`gemba_loss_capacity_${selectedCustomerId}`, JSON.stringify(dataToSave));
    window.dispatchEvent(new CustomEvent("LossCapacityUpdated", { detail: { customerId: selectedCustomerId } }));

    // Also on the server, for the CI opportunity pool (so every device sees the same opportunities).
    // Debounced, and only when the matrix itself changed — this effect re-runs on many inputs.
    const snapshot = {
      recoveryMatrixData: (recoveryMatrixData || []).map((r: any) => ({
        subject: r.subject, avgLoss: r.avgLoss, avgGain: r.avgGain, severity: r.severity, leanTool: r.leanTool, area: r.area
      })),
      productFamilyName: dataToSave.productFamilyName,
      productFamilyRatio: dataToSave.productFamilyRatio
    };
    const key = `${selectedCustomerId}:${JSON.stringify(snapshot)}`;
    if (key !== lossSnapshotSent.current) {
      if (lossSnapshotTimer.current) clearTimeout(lossSnapshotTimer.current);
      lossSnapshotTimer.current = setTimeout(() => {
        fetch("/api/business/ci/loss-snapshot", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "x-factory-id": selectedCustomerId },
          body: JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() })
        }).then(r => { if (r.ok) lossSnapshotSent.current = key; }).catch(() => {});
      }, 3000);
    }
  }, [
    selectedCustomerId,
    effectiveRevenue,
    annualRevenue,
    costModelScope,
    productVolumeShare,
    selectedVsmProject,
    copqMatrixRows,
    recoveryMatrixData,
    costGroupCopqSummary,
    copqData.totalCOPQ_TL
  ]);

  // What-If Simulation: Product Cost Model Impact & Pie Chart Analysis
  const simulatedCostModel = React.useMemo(() => {
    // Current Product Cost Model Amounts (based on effectiveRevenue for active VSM/Factory scope)
    const directMaterialOrig = effectiveRevenue * (directMaterialPercent / 100);
    const directLaborOrig = effectiveRevenue * (directLaborPercent / 100);
    const overtimeBurdenOrig = directLaborOrig * (overtimeBurdenPercent / 100);
    const energyOrig = effectiveRevenue * (energyPercent / 100);
    const maintenanceOrig = effectiveRevenue * (maintenancePercent / 100);
    const overheadOrig = effectiveRevenue * (overheadPercent / 100);
    const totalOverheadOrig = energyOrig + maintenanceOrig + overheadOrig;
    const operatingProfitOrig = effectiveRevenue * (operatingProfitPercent / 100);
    const totalProductCostOrig = directMaterialOrig + directLaborOrig + totalOverheadOrig;

    // COPQ Base losses
    // Measured loss pools only (Recovery Matrix groups). Earlier, an empty pool fell back to 12 % of
    // material, 20 % of labor, 25 % of overhead and 2 % of revenue.
    const matLossBase = costGroupCopqSummary.materialLoss;
    const laborLossBase = costGroupCopqSummary.laborLoss;
    const overheadLossBase = costGroupCopqSummary.overheadLoss;
    const strategicLossBase = costGroupCopqSummary.strategicLoss;
    const setupLossBase = recoveryMatrixData.find(r => r.subject === "Setup Süreleri (SMED)")?.avgLoss ?? 0;

    // Simulated Savings by Lever
    const scrapSavings = matLossBase * (simScrap / 100);
    const overtimeSavings = overtimeBurdenOrig * (simOvertimeRed / 100);
    const productivitySavings = laborLossBase * (simLaborOpt / 100);
    const totalLaborSavings = overtimeSavings + productivitySavings;

    // SMED acts on the setup loss, OEE on the rest of the machine-time pool (breakdown, performance).
    const smedSavings = setupLossBase * (simSetup / 100);
    const oeeSavings = Math.max(0, overheadLossBase - setupLossBase) * (simOee / 100);
    const totalOverheadSavings = smedSavings + oeeSavings;

    const leadTimeSavings = strategicLossBase * (simLeadTimeAccel / 100);

    // Simulated Amounts
    const directMaterialSim = Math.max(0, directMaterialOrig - scrapSavings);
    const directLaborSim = Math.max(0, directLaborOrig - totalLaborSavings);
    const totalOverheadSim = Math.max(0, totalOverheadOrig - totalOverheadSavings);
    const totalProductCostSim = directMaterialSim + directLaborSim + totalOverheadSim;

    const totalProductCostSavings = totalProductCostOrig - totalProductCostSim;
    const totalNetGain = totalProductCostSavings + leadTimeSavings;

    const operatingProfitSim = operatingProfitOrig + totalNetGain;
    const operatingProfitPercentSim = effectiveRevenue > 0 ? (operatingProfitSim / effectiveRevenue) * 100 : operatingProfitPercent;

    // Percentages of Revenue
    const simMaterialPercent = effectiveRevenue > 0 ? (directMaterialSim / effectiveRevenue) * 100 : directMaterialPercent;
    const simLaborPercent = effectiveRevenue > 0 ? (directLaborSim / effectiveRevenue) * 100 : directLaborPercent;
    const simOverheadPercent = effectiveRevenue > 0 ? (totalOverheadSim / effectiveRevenue) * 100 : (energyPercent + maintenancePercent + overheadPercent);

    // Pie Chart Datasets
    const pieDataOriginal = [
      { name: "Direkt Malzeme", value: Math.round(directMaterialOrig), percent: directMaterialPercent, color: "#f43f5e" },
      { name: "Direkt İşçilik", value: Math.round(directLaborOrig), percent: directLaborPercent, color: "#6366f1" },
      { name: "Genel Üretim Overhead", value: Math.round(totalOverheadOrig), percent: (energyPercent + maintenancePercent + overheadPercent), color: "#f59e0b" },
      { name: "Faaliyet Kârı (EBITDA)", value: Math.round(operatingProfitOrig), percent: operatingProfitPercent, color: "#10b981" },
    ];

    const pieDataSimulated = [
      { name: "Direkt Malzeme", value: Math.round(directMaterialSim), percent: parseFloat(simMaterialPercent.toFixed(1)), color: "#f43f5e" },
      { name: "Direkt İşçilik", value: Math.round(directLaborSim), percent: parseFloat(simLaborPercent.toFixed(1)), color: "#6366f1" },
      { name: "Genel Üretim Overhead", value: Math.round(totalOverheadSim), percent: parseFloat(simOverheadPercent.toFixed(1)), color: "#f59e0b" },
      { name: "Faaliyet Kârı (EBITDA)", value: Math.round(operatingProfitSim), percent: parseFloat(operatingProfitPercentSim.toFixed(1)), color: "#10b981" },
    ];

    const barDataComparison = [
      {
        name: "Direkt Malzeme",
        Mevcut: Math.round(directMaterialOrig),
        İyileştirilmiş: Math.round(directMaterialSim),
        Tasarruf: Math.round(scrapSavings),
      },
      {
        name: "Direkt İşçilik",
        Mevcut: Math.round(directLaborOrig),
        İyileştirilmiş: Math.round(directLaborSim),
        Tasarruf: Math.round(totalLaborSavings),
      },
      {
        name: "Genel Üretim Overhead",
        Mevcut: Math.round(totalOverheadOrig),
        İyileştirilmiş: Math.round(totalOverheadSim),
        Tasarruf: Math.round(totalOverheadSavings),
      },
      {
        name: "Faaliyet Kârı (EBITDA)",
        Mevcut: Math.round(operatingProfitOrig),
        İyileştirilmiş: Math.round(operatingProfitSim),
        Kazanım: Math.round(totalNetGain),
      },
    ];

    return {
      directMaterialOrig,
      directMaterialSim,
      scrapSavings,
      simMaterialPercent,

      directLaborOrig,
      directLaborSim,
      totalLaborSavings,
      overtimeSavings,
      productivitySavings,
      simLaborPercent,

      totalOverheadOrig,
      totalOverheadSim,
      totalOverheadSavings,
      smedSavings,
      oeeSavings,
      simOverheadPercent,

      totalProductCostOrig,
      totalProductCostSim,
      totalProductCostSavings,

      leadTimeSavings,
      totalNetGain,

      operatingProfitOrig,
      operatingProfitSim,
      operatingProfitPercentSim,

      pieDataOriginal,
      pieDataSimulated,
      barDataComparison
    };
  }, [
    effectiveRevenue,
    directMaterialPercent,
    directLaborPercent,
    overtimeBurdenPercent,
    energyPercent,
    maintenancePercent,
    overheadPercent,
    operatingProfitPercent,
    costGroupCopqSummary,
    recoveryMatrixData,
    simSetup,
    simScrap,
    simOee,
    simLaborOpt,
    simOvertimeRed,
    simLeadTimeAccel
  ]);

  // Pareto Grafiği Veri Modeli
  const paretoChartData = React.useMemo(() => {
    const sorted = [...recoveryMatrixData].sort((a, b) => b.avgLoss - a.avgLoss);
    const totalLoss = sorted.reduce((sum, item) => sum + item.avgLoss, 0);

    let cumulativeSum = 0;
    return sorted.map((item) => {
      cumulativeSum += item.avgLoss;
      const cumulativePercent = totalLoss > 0 ? (cumulativeSum / totalLoss) * 100 : 0;
      return {
        name: item.subject,
        [`Kayıp (Bin ${currencySymbol})`]: Math.round(item.avgLoss / 1000),
        "Kümülatif %": parseFloat(cumulativePercent.toFixed(1))
      };
    });
  }, [recoveryMatrixData, currencySymbol]);

  const pieData = [
    { name: "Direkt Malzeme", value: directMaterialPercent, amount: effectiveRevenue * (directMaterialPercent / 100), color: "#f97316" },
    { name: "Direkt İşçilik", value: directLaborPercent, amount: effectiveRevenue * (directLaborPercent / 100), color: "#6366f1" },
    { name: "Enerji Giderleri", value: energyPercent, amount: effectiveRevenue * (energyPercent / 100), color: "#eab308" },
    { name: "Bakım Giderleri", value: maintenancePercent, amount: effectiveRevenue * (maintenancePercent / 100), color: "#3b82f6" },
    { name: "Genel Üretim (Overhead)", value: overheadPercent, amount: effectiveRevenue * (overheadPercent / 100), color: "#a855f7" },
    { name: "Faaliyet Kârı", value: operatingProfitPercent, amount: effectiveRevenue * (operatingProfitPercent / 100), color: "#10b981" }
  ];

  // 10 POWER BI STYLE CHART DATA MODELS
  // 1. Toplam Finansal Geri Kazanım (Şelale)
  const waterfallChartData = React.useMemo(() => {
    const totalLoss = copqData.totalCOPQ_TL;
    const directGain = recoveryMatrixData.filter(r => r.area === "Doğrudan Maliyet Azaltma").reduce((sum, item) => sum + item.avgGain, 0);
    const capacityGain = recoveryMatrixData.filter(r => r.area === "Kapasite Yaratma").reduce((sum, item) => sum + item.avgGain, 0);
    const strategicGain = recoveryMatrixData.filter(r => r.area === "Stratejik Operasyonel Kazanç").reduce((sum, item) => sum + item.avgGain, 0);
    const remainingLoss = Math.max(0, totalLoss - directGain - capacityGain - strategicGain);

    return [
      { name: "Mevcut COPQ", bottom: 0, height: totalLoss, displayVal: totalLoss, color: "#ef4444" },
      { name: "Doğrudan Maliyet", bottom: Math.max(0, totalLoss - directGain), height: directGain, displayVal: -directGain, color: "#f97316" },
      { name: "Kapasite Kazanımı", bottom: Math.max(0, totalLoss - directGain - capacityGain), height: capacityGain, displayVal: -capacityGain, color: "#6366f1" },
      { name: "Stratejik Kazanç", bottom: Math.max(0, totalLoss - directGain - capacityGain - strategicGain), height: strategicGain, displayVal: -strategicGain, color: "#10b981" },
      { name: "Kalan COPQ", bottom: 0, height: remainingLoss, displayVal: remainingLoss, color: "#475569" }
    ];
  }, [copqData.totalCOPQ_TL, recoveryMatrixData]);

  // 2. Fırsat Alanlarına Göre Kazanç (Yatay Çubuk)
  const areaEarningsData = React.useMemo(() => {
    const directGain = recoveryMatrixData.filter(r => r.area === "Doğdan Maliyet Azaltma" || r.area === "Doğrudan Maliyet Azaltma").reduce((sum, item) => sum + item.avgGain, 0);
    const capacityGain = recoveryMatrixData.filter(r => r.area === "Kapasite Yaratma").reduce((sum, item) => sum + item.avgGain, 0);
    const strategicGain = recoveryMatrixData.filter(r => r.area === "Stratejik Operasyonel Kazanç").reduce((sum, item) => sum + item.avgGain, 0);

    return [
      { name: "Doğrudan Maliyet Azaltma", [`Geri Kazanım (Bin ${currencySymbol})`]: Math.round(directGain / 1000), fill: "#f97316" },
      { name: "Kapasite Yaratma", [`Geri Kazanım (Bin ${currencySymbol})`]: Math.round(capacityGain / 1000), fill: "#6366f1" },
      { name: "Stratejik Operasyonel Kazanç", [`Geri Kazanım (Bin ${currencySymbol})`]: Math.round(strategicGain / 1000), fill: "#10b981" }
    ];
  }, [recoveryMatrixData, currencySymbol]);

  // 3. Doğrudan Maliyet Azaltma Dağılımı (Halka)
  const directMaliyetDonut = React.useMemo(() => {
    return recoveryMatrixData
      .filter(r => (r.area === "Doğdan Maliyet Azaltma" || r.area === "Doğrudan Maliyet Azaltma") && r.avgGain > 0)
      .map(r => ({
        name: r.subject,
        value: Math.round(r.avgGain / 1000)
      }));
  }, [recoveryMatrixData]);

  // 4. Kapasite Kazanım Dağılımı (Halka)
  const kapasiteDonut = React.useMemo(() => {
    return recoveryMatrixData
      .filter(r => r.area === "Kapasite Yaratma" && r.avgGain > 0)
      .map(r => ({
        name: r.subject,
        value: Math.round(r.avgGain / 1000)
      }));
  }, [recoveryMatrixData]);

  // 5. Stratejik Kazanç Dağılımı (Treemap / Donut)
  const strategicDonut = React.useMemo(() => {
    return recoveryMatrixData
      .filter(r => r.area === "Stratejik Operasyonel Kazanç" && r.avgGain > 0)
      .map(r => ({
        name: r.subject,
        value: Math.round(r.avgGain / 1000)
      }));
  }, [recoveryMatrixData]);

  // 6. Minimum / Maksimum Kazanç Karşılaştırması (Gruplu Sütun)
  const minMaxComparison = React.useMemo(() => {
    return recoveryMatrixData.map(r => ({
      name: r.subject,
      [`Min Geri Kazanım (Bin ${currencySymbol})`]: Math.round(r.potentialGainMin / 1000),
      [`Max Geri Kazanım (Bin ${currencySymbol})`]: Math.round(r.potentialGainMax / 1000)
    }));
  }, [recoveryMatrixData, currencySymbol]);

  // 7. Faaliyet Karı Öncesi / Sonrası (Şelale / Sütun)
  const operatingProfitBeforeAfter = React.useMemo(() => {
    const currentProfit = effectiveRevenue * (operatingProfitPercent / 100);
    const totalAverageRecovery = recoveryMatrixData.reduce((sum, item) => sum + item.avgGain, 0);
    const afterOperatingProfit = currentProfit + totalAverageRecovery;

    return [
      { name: "Mevcut Faaliyet Kârı", [`Tutar (Bin ${currencySymbol})`]: Math.round(currentProfit / 1000), fill: "#ef4444" },
      { name: "Geri Kazanım Etkisi", [`Tutar (Bin ${currencySymbol})`]: Math.round(totalAverageRecovery / 1000), fill: "#6366f1" },
      { name: "İyileştirilmiş Kâr", [`Tutar (Bin ${currencySymbol})`]: Math.round(afterOperatingProfit / 1000), fill: "#10b981" }
    ];
  }, [effectiveRevenue, operatingProfitPercent, recoveryMatrixData, currencySymbol]);

  // 8. En Büyük İlk 5 Fırsat (Pareto)
  const first5Pareto = React.useMemo(() => {
    const sorted = [...recoveryMatrixData].sort((a,b) => b.avgLoss - a.avgLoss).slice(0, 5);
    const totalTop5 = sorted.reduce((sum, item) => sum + item.avgLoss, 0);
    let cumulative = 0;
    return sorted.map(item => {
      cumulative += item.avgLoss;
      return {
        name: item.subject,
        [`Kayıp (Bin ${currencySymbol})`]: Math.round(item.avgLoss / 1000),
        "Kümülatif %": Math.round((cumulative / totalTop5) * 100)
      };
    });
  }, [recoveryMatrixData, currencySymbol]);

  // 9. Önce Sonra Kazanım Karşılaştırması
  const onceSonraComparison = React.useMemo(() => {
    return recoveryMatrixData.map(r => ({
      name: r.subject,
      [`Mevcut Kayıp (Bin ${currencySymbol})`]: Math.round(r.avgLoss / 1000),
      [`Sonrası Kalan Kayıp (Bin ${currencySymbol})`]: Math.round(Math.max(0, r.avgLoss - r.avgGain) / 1000)
    }));
  }, [recoveryMatrixData, currencySymbol]);

  // 10. İyileştirmelerin Faaliyet karına etki grafiği Hedef
  const operatingProfitCurve = React.useMemo(() => {
    // Margin after the largest opportunities in turn (Recovery Matrix average gains) — no fixed
    // phase shares. (Earlier: 20 % / 55 % / 85 % of the total labelled 5S / SMED / TPM.)
    const gains = recoveryMatrixData.map(r => ({ subject: r.subject, gain: r.avgGain })).filter(g => g.gain > 0).sort((x, y) => y.gain - x.gain);
    const marginAfter = (n: number) => {
      const g = gains.slice(0, n).reduce((acc, x) => acc + x.gain, 0);
      return parseFloat((operatingProfitPercent + (effectiveRevenue > 0 ? (g / effectiveRevenue) * 100 : 0)).toFixed(1));
    };
    const stages = [{ stage: "Mevcut", "Faaliyet Kâr Marjı %": parseFloat(operatingProfitPercent.toFixed(1)) }];
    if (gains.length >= 1) stages.push({ stage: `+ ${gains[0].subject}`, "Faaliyet Kâr Marjı %": marginAfter(1) });
    if (gains.length >= 3) stages.push({ stage: "+ ilk 3 fırsat", "Faaliyet Kâr Marjı %": marginAfter(3) });
    if (gains.length > 0) stages.push({ stage: "Hedef (tümü)", "Faaliyet Kâr Marjı %": marginAfter(gains.length) });
    return stages;
  }, [effectiveRevenue, operatingProfitPercent, recoveryMatrixData]);

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`p-3 rounded-xl border shadow-lg font-sans text-xs ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"}`}>
          <div className="font-bold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            {data.name}
          </div>
          <div className="mt-1 font-mono">Oran: <span className="font-bold">%{data.value.toFixed(1)}</span></div>
          <div className="font-mono">Tutar: <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">{formatMoney(data.amount)}</span></div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`p-5 space-y-6 rounded-3xl transition-all duration-300 font-sans ${
      isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50/50 text-slate-900"
    }`}>
      
      {/* PROFESSIONAL LOGO COCKPIT HEADER */}
      <div className={`rounded-2xl border p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 transition-all ${
        isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      }`}>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-rose-700 rounded-lg text-white">
              <Activity className="w-5 h-5 animate-pulse" />
            </span>
            <h2 className="text-xl font-black tracking-tight font-sans uppercase">
              Economic Loss Intelligence Center (Financial Twin)
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-4xl leading-relaxed">
            Saha VSM ve OEE verilerini anlık finansal kayıplara eşleyen, WCM maliyet yayılım algoritmalarıyla donatılmış gelişmiş Finansal Dijital İkiz kokpiti.
          </p>
        </div>

        {/* Global Configuration Controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {moduleSettingsSaveStatus !== "idle" && (
            <span className={`text-[11px] font-bold flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
              moduleSettingsSaveStatus === "saving" ? "text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400" :
              moduleSettingsSaveStatus === "success" ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400" :
              "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400"
            }`}>
              {moduleSettingsSaveStatus === "saving" && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Ayarlar Kaydediliyor...</>}
              {moduleSettingsSaveStatus === "success" && <><Check className="w-3.5 h-3.5" /> Müşteri Kaydına Kaydedildi</>}
              {moduleSettingsSaveStatus === "error" && "Kaydedilemedi"}
            </span>
          )}
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel || isExportingPdf}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-wait"
          >
            {isExportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            <span>{isExportingExcel ? "Grafikler Yakalanıyor..." : "Excel (XLS)"}</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isExportingExcel || isExportingPdf}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-wait"
          >
            {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span>{isExportingPdf ? "Rapor Hazırlanıyor..." : "Yönetici Raporu (PDF)"}</span>
          </button>

          <button
            onClick={() => setIsEditorOpen(!isEditorOpen)}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
              isEditorOpen 
                ? "bg-rose-500 border-rose-600 text-white" 
                : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {isEditorOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{isEditorOpen ? "VSM Veri Editörünü Kapat" : "VSM Canlı Veri Düzenleyicisi"}</span>
          </button>

          <div className="flex flex-wrap items-center space-x-1.5 border rounded-xl bg-slate-100 border-slate-200 px-3 py-1.5 text-xs">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase">Sektör ölçütü:</span>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value as IndustryType)}
              className="bg-transparent font-black text-rose-800 focus:outline-none focus:ring-0 cursor-pointer"
            >
              {INDUSTRY_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.labelTr}
                </option>
              ))}
            </select>

            {(selectedIndustry === "Other" || selectedIndustry === "Diğer") && (
              <input 
                type="text" 
                placeholder="Sektör adını elle giriniz..." 
                value={customIndustryName} 
                onChange={(e) => setCustomIndustryName(e.target.value)}
                className="ml-2 px-2.5 py-1 text-xs border border-rose-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-bold text-rose-900 w-44"
              />
            )}
          </div>
        </div>
      </div>

      {/* COLLAPSIBLE LIVE VSM DATA SOURCE & EDIT ENGINE */}
      {isEditorOpen && (
        <div className="bg-white border-2 border-dashed border-rose-200 rounded-2xl p-5 space-y-4 shadow-sm animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center border-b border-rose-100 pb-2">
            <div className="space-y-0.5">
              <h3 className="text-sm font-black text-rose-800 uppercase flex items-center">
                <Settings className="w-4 h-4 mr-1.5 animate-spin-slow" />
                Saha VSM Veri Kaynağı & Canlı Editör
              </h3>
              <p className="text-[10px] text-slate-400">
                Aşağıdaki alanları düzenleyerek VSM verilerini anında değiştirebilirsiniz. Değişiklikler finansal formüllere gerçek zamanlı yansır.
              </p>
              {activeProcesses.some(p => (p.missingFields?.length ?? 0) > 0) && (
                <p className="text-[10px] font-bold text-amber-700">
                  "girilmedi" görünen alanlar için gerçek veri yok; hesaplarda 0 kabul edilir ve kayıp tutarları eksik çıkar. Değeri girip kaydedin.
                </p>
              )}
              <p className="text-[10px] text-slate-400">
                <span className="font-bold text-sky-600">VSM</span> = VSM projesinde ölçülen değer (proje her kaydedildiğinde yenilenir), <span className="font-bold">Loss</span> = bu ekranda girilen/düzeltilen değer (VSM'deki değerin önüne geçer). VSM'den gelen setup ve makine ayarı süresi günlük toplam dakikadır; sıklık bu yüzden haftalık çalışma günü sayısıdır.
              </p>
              {activeProcesses.length > 0 && defaultDemand === 0 && (
                <p className="text-[10px] font-bold text-amber-700">
                  Günlük talep yok (VSM Kurulum'da haftalık talep ve çalışma günü girilmemiş): takt, WIP günü ve talebe dayalı birim maliyet hesaplanamıyor.
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {saveStatus === "saving" && (
                <span className="text-xs text-slate-500 flex items-center space-x-1">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                  <span>Veritabanına Kaydediliyor...</span>
                </span>
              )}
              {saveStatus === "success" && (
                <span className="text-xs text-emerald-600 font-bold flex items-center space-x-1 bg-emerald-50 px-2 py-1 border rounded-md">
                  <Check className="w-4 h-4" />
                  <span>Başarıyla Kaydedildi!</span>
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-xs text-rose-600 font-bold flex items-center space-x-1 bg-rose-50 px-2 py-1 border rounded-md">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Kayıt Başarısız.</span>
                </span>
              )}
              <button
                onClick={handleSaveToDatabase}
                disabled={saveStatus === "saving"}
                className="bg-rose-700 hover:bg-rose-800 text-white font-black text-xs py-1.5 px-3.5 rounded-xl flex items-center space-x-1 shadow-md transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Değişiklikleri Veritabanına Kaydet</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-450 font-extrabold uppercase text-[9.5px]">
                  <th className="py-2 px-3">İstasyon Adı (VSM Node)</th>
                  {LOSS_EDITOR_COLUMNS.map(c => (
                    <th key={c.field} className={`py-2 px-3 text-center ${c.field === "scrapQty" ? "font-bold text-rose-700" : ""}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeProcesses.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-all font-mono">
                    <td className="py-2 px-3 font-sans font-bold text-slate-800">{p.name}</td>
                    {LOSS_EDITOR_COLUMNS.map(c => {
                      const isMissing = p.missingFields?.includes(c.field) ?? false;
                      return (
                        <td key={c.field} className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min={c.min ?? 0}
                            value={isMissing ? "" : p[c.field]}
                            placeholder="girilmedi"
                            onChange={(e) => handleUpdateProcessInput(p.id, c.field, e.target.value, c.min ?? 0)}
                            className={`w-20 text-center border rounded py-0.5 placeholder:italic placeholder:text-amber-600 placeholder:font-sans placeholder:text-[10px] ${isMissing ? "border-amber-300 bg-amber-50/50" : ""} ${c.field === "scrapQty" ? "text-rose-700 font-extrabold" : ""}`}
                          />
                          {!isMissing && p.fieldSources?.[c.field] && (
                            <div className={`text-[8.5px] font-sans font-bold mt-0.5 ${p.fieldSources[c.field] === "vsm" ? "text-sky-600" : "text-slate-400"}`}>
                              {p.fieldSources[c.field] === "vsm" ? "VSM" : "Loss"}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CORE 5 COCKPIT TABS SWITCHER */}
      <div className="flex flex-wrap border-b border-slate-200 gap-1 pb-1">
        {[
          { id: "executive_dashboard", label: "1. Dashboard", icon: Layout },
          { id: "cost_model", label: "2. Ürün Maliyet Modeli", icon: DollarSign },
          { id: "opportunity_matrix", label: "3. COPQ Finansal Matrisi", icon: BarChart2 },
          { id: "recovery_matrix", label: "4. Geri Kazanım Matrisi", icon: Award },
          { id: "simulation", label: "5. What-if Simülasyonu", icon: Zap },
          { id: "tpm_loss", label: "6. Loss Cost Analizi", icon: Wrench }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center space-x-1.5 px-4 py-3 text-xs font-black tracking-tight transition-all cursor-pointer rounded-t-xl border-b-2 ${
                activeTab === t.id 
                  ? "bg-slate-900 border-rose-700 text-white shadow-sm" 
                  : "text-slate-600 border-transparent hover:bg-slate-200/50 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4 text-rose-600" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ACTIVE TAB VIEWS */}
      <div className="space-y-6">

        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {activeTab === "executive_dashboard" && (
          <div className="space-y-6 animate-in fade-in duration-200">

            {isScopedWithNoData && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/45 rounded-xl flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                  <strong>{selectedVsmProject?.productGroup || "Bu ürün grubu"}</strong> için VSM'den senkronize edilmiş süreç verisi yok — aşağıdaki kartlar bu yüzden 0 görünüyor, ürün grubunun gerçekten kaybı olmadığı anlamına gelmez. VSM sayfasından ilgili projeyi yeniden kaydedin.
                </p>
              </div>
            )}

            {/* CEO EXECUTIVE HIGHLIGHTS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-xs flex flex-col justify-between h-32">
                <div className="flex justify-between items-center text-[10px] opacity-70 font-black uppercase tracking-wider">
                  <span>Yıllık Ciro</span>
                  <DollarSign className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-xl font-black font-mono tracking-tight">{formatMoney(annualRevenue)}</div>
                <div className="text-[10px] opacity-80 font-bold">12 Aylık Tesis Ciro Modeli</div>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs flex flex-col justify-between h-32">
                <div className="flex justify-between items-center text-[10px] opacity-70 font-black uppercase tracking-wider">
                  <span>Toplam Kârlılık Sızıntısı (FAVÖK kaybı)</span>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-xl font-black font-mono tracking-tight text-rose-400">{formatMoney(financialImpact.totalOperationalLosses.year)}</div>
                <div className="text-[10px] opacity-80 text-rose-350 font-black">Cironun %{lossToRevenuePercent.toFixed(1)} kadarını israflarla kaybediyorsunuz</div>
              </div>

              <div className="bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between h-32 border-slate-200 text-slate-900">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-wider">
                  <span>COPQ (Kalitesizlik Maliyeti)</span>
                  <Percent className="w-4 h-4 text-rose-700" />
                </div>
                <div>
                  <div className="text-xl font-black font-mono tracking-tight text-slate-850">{formatMoney(copqData.totalCOPQ_TL)}</div>
                  <div className="text-[10.5px] font-black text-rose-700 font-mono mt-0.5">COPQ Oranı: %{copqData.copqPercentOfRevenue.toFixed(1)}</div>
                </div>
                <div className="flex items-center gap-1.5 self-start">
                  <span className="text-[9.5px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 border rounded-md">Kategori: {copqData.benchmarkStatus}</span>
                  {hasActiveCostOverrides && (
                    <span className="text-[9.5px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 border border-amber-300 rounded-md">Gerçek Veri Dahil</span>
                  )}
                </div>
              </div>

              <div className="bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between h-32 border-slate-200 text-slate-900">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-wider">
                  <span>Genel OEE Ortalaması</span>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-xl font-black font-mono tracking-tight text-emerald-600">%{avgOee.toFixed(1)}</div>
                <div className="text-[10px] text-slate-450 font-bold uppercase">Dünya Klası OEE Hedefi: %85</div>
              </div>

            </div>

            {/* İŞ GÜCÜ FİNANSAL ETKİSİ (FAZLA İŞÇİLİK / NORM KADRO) */}
            <div className="bg-white border rounded-2xl p-5 shadow-xs border-slate-200" id="dashboard_workforce_financial_impact">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-black tracking-tight text-slate-800 uppercase">İş Gücü Finansal Etkisi (Fazla İşçilik / Norm Kadro)</h3>
                </div>
                <span className="text-[10px] text-slate-400">Mevcut kapasite &amp; OLE verilerinden hesaplanır — ek veri girişi gerekmez</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">Mevcut İş Gücü</span>
                  <div className="text-xl font-black font-mono tracking-tight text-slate-900 mt-1">{totalRealOperators.toFixed(0)} kişi</div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">Norm (Hedef) İş Gücü</span>
                  <div className="text-xl font-black font-mono tracking-tight text-slate-900 mt-1">{totalIdealOperators.toFixed(1)} kişi</div>
                  <p className="text-[10px] text-slate-400 mt-1">Takt bazlı: {defaultDemand > 0 ? `${totalTargetWorkforceTakt.toFixed(1)} kişi` : "hesaplanamadı (VSM talebi girilmedi)"}</p>
                </div>

                <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <span className="text-[10px] uppercase text-rose-500 font-bold tracking-wider block">Fazla İşçilik (Norm Fazlası)</span>
                  <div className="text-xl font-black font-mono tracking-tight text-rose-700 mt-1">{totalExcessLaborHeadcount.toFixed(1)} kişi</div>
                  <p className="text-[10px] text-rose-400 mt-1">Yeniden kullanım / redeploy potansiyeli</p>
                </div>

                <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <span className="text-[10px] uppercase text-rose-500 font-bold tracking-wider block">Yıllık Fazla İşçilik Maliyeti</span>
                  <div className="text-xl font-black font-mono tracking-tight text-rose-700 mt-1">{formatMoney(financialImpact.laborLoss.year)}</div>
                  <p className="text-[10px] text-rose-400 mt-1">Toplam Kârlılık Sızıntısı'nın %{financialImpact.totalOperationalLosses.year > 0 ? ((financialImpact.laborLoss.year / financialImpact.totalOperationalLosses.year) * 100).toFixed(1) : "0.0"} kadarı</p>
                </div>
              </div>
            </div>

            {/* ADVANCED LEAN EFFECTIVENESS CHARTS */}
            <div className={`rounded-2xl border p-5 bg-white border-slate-200 shadow-xs`}>
              <span className="font-extrabold text-[10px] uppercase text-rose-800 tracking-wider">Tesis Yalın Etkinlik Çarpanları</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
                
                <div className="p-4 bg-slate-50 rounded-xl space-y-2 border">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="font-bold">Toplam Ekipman Etkinliği (OEE)</span>
                    <span className="font-black text-slate-800 font-mono">%{avgOee.toFixed(1)}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div style={{ width: `${avgOee}%` }} className="h-full bg-rose-700 rounded-full" />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">Makinelerin plansız duruşlar olmadan en yüksek hızla kaliteli parça üretme performansı.</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl space-y-2 border">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="font-bold">Toplam İşgücü Etkinliği (OLE)</span>
                    <span className="font-black text-slate-800 font-mono">%{overallOLE.toFixed(1)}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div style={{ width: `${overallOLE}%` }} className="h-full bg-indigo-650 rounded-full" />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">Yamazumi dengesine göre norm iş gücü fazlası olmadan insan kaynağını değerlendirme oranınız.</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl space-y-2 border">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="font-bold">Değer Akışı Verimliliği (OVSE)</span>
                    <span className="font-black text-slate-800 font-mono">%{overallOVSE.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div style={{ width: `${overallOVSE}%` }} className="h-full bg-amber-600 rounded-full" />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">Net katma değerli çevrim süresinin tüm WIP envanter bekleme sürelerine (Lead Time) oranı.</p>
                </div>

              </div>
            </div>

            {/* HISTORICAL COPQ TREND (REAL SNAPSHOTS, NOT SIMULATED) */}
            <div className="bg-white border rounded-xl p-5 shadow-xs border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-black tracking-tight text-rose-800 uppercase flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1.5 text-rose-700" />
                    Tarihsel COPQ Trend Analizi
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Her nokta, o tarihte kaydedilen gerçek bir COPQ anlık görüntüsüdür. Fabrikanızın kalitesizlik maliyetindeki gerçek zaman içindeki değişimi izler.
                  </p>
                </div>
                <button
                  onClick={handleSaveCopqSnapshot}
                  disabled={isSavingSnapshot}
                  className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all bg-rose-700 border-rose-800 text-white hover:bg-rose-800 disabled:opacity-60 shrink-0"
                >
                  {isSavingSnapshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Bugünün Anlık Görüntüsünü Kaydet</span>
                </button>
              </div>

              {copqTrendData.length >= 2 ? (
                <div id="lc-chart-copq-trend" className="h-64 w-full bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={copqTrendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 9 }} />
                      <YAxis yAxisId="left" tick={{ fill: "#475569", fontSize: 9 }} label={{ value: `COPQ (${currencySymbol})`, angle: -90, position: 'insideLeft', fill: "#475569", fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#475569", fontSize: 9 }} label={{ value: 'COPQ / Ciro %', angle: 90, position: 'insideRight', fill: "#475569", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "0.75rem" }}
                        itemStyle={{ fontSize: "11px" }}
                        labelStyle={{ fontWeight: "bold", fontSize: "11px" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "10px" }} />
                      <Line yAxisId="left" type="monotone" dataKey="COPQ Toplam" stroke="#be123c" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line yAxisId="right" type="monotone" dataKey="COPQ / Ciro %" stroke="#4f46e5" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-10 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                  <Info className="w-6 h-6 text-slate-350 mb-2" />
                  <p className="text-xs font-bold text-slate-500">
                    {copqTrendData.length === 0
                      ? "Henüz kayıtlı bir COPQ anlık görüntüsü yok."
                      : "Trend grafiği için en az 2 anlık görüntü gerekli (şu an: 1)."}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-md">
                    Zaman içindeki gerçek COPQ değişimini görmek için düzenli aralıklarla (örn. her ay) "Anlık Görüntüyü Kaydet" butonuna basın.
                  </p>
                </div>
              )}
            </div>

            {/* BENCHMARK DATABASE COMPARISON */}
            <div className="bg-white border rounded-xl p-5 shadow-xs border-slate-200">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-black tracking-tight text-rose-800 uppercase flex items-center">
                    <Award className="w-4 h-4 mr-1.5 text-rose-700" />
                    Sektör Benchmark Karşılaştırma Analizi ({selectedIndustry})
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    OEE, setup, COPQ ve stok tur hızınızı küresel endüstriyel benchmarklarla otomatik olarak kıyaslar.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(() => {
                  const n = calculatedProcesses.length;
                  const avgSetup = n > 0 ? Math.round(calculatedProcesses.reduce((sum, p) => sum + p.setupTimeMinutes, 0) / n) : 0;
                  const box = (title: string, value: string, note: string) => (
                    <div className="p-4 border rounded-lg bg-slate-50">
                      <span className="text-[11px] text-slate-400 font-extrabold uppercase">{title}</span>
                      <div className="text-base font-black font-mono mt-1 text-slate-800">{value}</div>
                      <span className="text-[10px] text-rose-600 font-bold block mt-1">{note}</span>
                    </div>
                  );
                  return (
                    <>
                      {box("OEE farkı", n > 0 ? `Mevcut: %${avgOee.toFixed(1)} / Sektör: %${benchmark.oee}` : `Mevcut: — / Sektör: %${benchmark.oee}`,
                        n > 0 ? `Fark: ${(benchmark.oee - avgOee).toFixed(1)} puan geride` : "İstasyon verisi yok")}
                      {box("Setup süresi farkı", n > 0 ? `Mevcut: ${avgSetup} dk / Sektör: ${benchmark.setup} dk` : `Mevcut: — / Sektör: ${benchmark.setup} dk`,
                        n > 0 ? `Fark: ${Math.max(0, avgSetup - benchmark.setup)} dk iyileştirme hedefi` : "İstasyon verisi yok")}
                      {box("Kalitesizlik maliyeti farkı", `Mevcut: %${copqData.copqPercentOfRevenue.toFixed(1)} / Sektör: %${benchmark.copq}`,
                        `Sektör üstü yıllık kayıp: ${formatMoney(Math.max(0, copqData.totalCOPQ_TL - (effectiveRevenue * (benchmark.copq / 100))))}`)}
                      {/* Inventory turns need cost of goods sold / stock value, which the screen does not have (was a fixed "12"). */}
                      {box("Stok devir hızı", `Mevcut: — / Sektör: ${benchmark.inventoryTurns} devir`, "Ölçülmedi (stok değeri ve satılan malın maliyeti gerekir)")}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* 📊 MODERN POWER BI DASHBOARD CHARTS */}
            <div className="bg-white border rounded-2xl p-6 shadow-xs border-slate-200">
              <div className="border-b border-slate-100 pb-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div>
                  <h3 className="text-sm font-black tracking-tight text-rose-800 uppercase flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-rose-700" />
                    Gelişmiş Yalın Finansal Gösterge Paneli
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    OEE ve VSM kayıplarının geri kazanım süreçleriyle birleştiğinde fabrikanın mali tablolarına ve kâr marjlarına olan kümülatif etkisini gösteren dinamik analitik paneli.
                  </p>
                </div>
                <span className="text-[11px] bg-slate-100 font-extrabold px-2.5 py-1 rounded text-slate-600 uppercase tracking-wide">
                  10 Kritik Finansal Rapor
                </span>
              </div>

              {/* Grid of 10 Power BI Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 1. Toplam Finansal Geri Kazanım (Şelale) */}
                <div id="lc-chart-waterfall" className="border border-slate-150 rounded-xl p-4 bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-2">1. Toplam Finansal Geri Kazanım (Şelale)</span>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={waterfallChartData} margin={{ top: 15, right: 10, left: 10, bottom: 10 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                        <YAxis tick={{ fontSize: 9 }} width={40} />
                        <Tooltip formatter={(value, name, props) => formatMoney(Math.abs(props.payload.displayVal))} />
                        <Bar dataKey="bottom" stackId="a" fill="transparent" />
                        <Bar dataKey="height" stackId="a" fill="#3b82f6">
                          {waterfallChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Fırsat Alanlarına Göre Kazanç (Yatay Çubuk) */}
                <div id="lc-chart-area-earnings" className="border border-slate-150 rounded-xl p-4 bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-2">2. Fırsat Alanlarına Göre Kazanç (Yatay Çubuk)</span>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={areaEarningsData} margin={{ top: 10, right: 15, left: 15, bottom: 10 }}>
                        <XAxis type="number" tick={{ fontSize: 8 }} />
                        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 8 }} />
                        <Tooltip formatter={(v) => `${v} Bin ${currencySymbol}`} />
                        <Bar dataKey={`Geri Kazanım (Bin ${currencySymbol})`} radius={[0, 4, 4, 0]}>
                          {areaEarningsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Doğrudan Maliyet Azaltma Dağılımı (Halka) */}
                <div id="lc-chart-direct-donut" className="border border-slate-150 rounded-xl p-4 bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-2">3. Doğrudan Maliyet Azaltma Dağılımı (Halka)</span>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={directMaliyetDonut} innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                          {directMaliyetDonut.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={["#f97316", "#fdba74", "#ea580c", "#ffedd5"][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => `${v} Bin ${currencySymbol}`} />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Kapasite Kazanım Dağılımı (Halka) */}
                <div id="lc-chart-capacity-donut" className="border border-slate-150 rounded-xl p-4 bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-2">4. Kapasite Kazanım Dağılımı (Halka)</span>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={kapasiteDonut} innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                          {kapasiteDonut.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={["#6366f1", "#818cf8", "#4f46e5", "#e0e7ff"][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => `${v} Bin ${currencySymbol}`} />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 5. Stratejik Kazanç Dağılımı (Ağaç Haritası) */}
                <div id="lc-chart-treemap" className="border border-slate-150 rounded-xl p-4 bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-2">5. Stratejik Kazanç Dağılımı (Ağaç Haritası)</span>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={strategicDonut}
                        dataKey="value"
                        aspectRatio={4 / 3}
                        stroke="#fff"
                        fill="#10b981"
                        style={{ fontSize: 9 }}
                      />
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 6. Minimum / Maksimum Kazanç Karşılaştırması (Gruplu Sütun) */}
                <div id="lc-chart-minmax" className="border border-slate-150 rounded-xl p-4 bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-2">6. Min / Max Kazanç Karşılaştırması (Gruplu Sütun)</span>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={minMaxComparison} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 7 }} />
                        <YAxis tick={{ fontSize: 8 }} width={35} />
                        <Tooltip formatter={(v) => `${v} Bin ${currencySymbol}`} />
                        <Legend wrapperStyle={{ fontSize: 8 }} />
                        <Bar dataKey={`Min Geri Kazanım (Bin ${currencySymbol})`} fill="#f43f5e" />
                        <Bar dataKey={`Max Geri Kazanım (Bin ${currencySymbol})`} fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 7. Faaliyet Karı Öncesi / Sonrası (Şelale / Sütun) */}
                <div id="lc-chart-profit-before-after" className="border border-slate-150 rounded-xl p-4 bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-2">7. Faaliyet Karı Öncesi / Sonrası (Şelale / Sütun)</span>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={operatingProfitBeforeAfter} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                        <YAxis tick={{ fontSize: 8 }} width={35} />
                        <Tooltip formatter={(v) => `${v} Bin ${currencySymbol}`} />
                        <Bar dataKey={`Tutar (Bin ${currencySymbol})`} radius={[4, 4, 0, 0]}>
                          {operatingProfitBeforeAfter.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 8. En Büyük İlk 5 Fırsat (Pareto) */}
                <div id="lc-chart-pareto" className="border border-slate-150 rounded-xl p-4 bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-2">8. En Büyük İlk 5 Fırsat (Pareto)</span>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={first5Pareto} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 7 }} />
                        <YAxis tick={{ fontSize: 8 }} width={35} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8 }} />
                        <Tooltip formatter={(value, name) => name === "Kümülatif %" ? `%${value}` : `${value} Bin ${currencySymbol}`} />
                        <Bar dataKey={`Kayıp (Bin ${currencySymbol})`} fill="#f97316" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="Kümülatif %" stroke="#ef4444" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 9. Önce Sonra Kazanım Karşılaştırması */}
                <div id="lc-chart-once-sonra" className="border border-slate-150 rounded-xl p-4 bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-2">9. Önce / Sonra Kazanım Karşılaştırması</span>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={onceSonraComparison} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 7 }} />
                        <YAxis tick={{ fontSize: 8 }} width={35} />
                        <Tooltip formatter={(v) => `${v} Bin ${currencySymbol}`} />
                        <Legend wrapperStyle={{ fontSize: 8 }} />
                        <Bar dataKey={`Mevcut Kayıp (Bin ${currencySymbol})`} fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey={`Sonrası Kalan Kayıp (Bin ${currencySymbol})`} fill="#475569" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 10. İyileştirmelerin Faaliyet Karına Etki Grafiği Hedef */}
                <div id="lc-chart-profit-curve" className="border border-slate-150 rounded-xl p-4 bg-slate-50/40 col-span-1 md:col-span-2 lg:col-span-3">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-2">10. İyileştirmelerin Faaliyet Kâr Marjına Etki Eğrisi (Yalın Olgunluk Fazları Hedefi)</span>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={operatingProfitCurve} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                        <XAxis dataKey="stage" tick={{ fontSize: 8 }} />
                        <YAxis tick={{ fontSize: 8 }} domain={[0, 'auto']} width={25} />
                        <Tooltip formatter={(v) => `%${v}`} />
                        <defs>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="Faaliyet Kâr Marjı %" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>

            {/* 🤖 GEMBA AI COPILOT SECTION */}
            <CopilotEngine
              calculated={calculatedProcesses}
              revenue={effectiveRevenue}
              copq={copqData}
              financialImpact={financialImpact}
              hiddenFactory={hiddenFactoryData}
              currency={currencySymbol}
              isDarkMode={isDarkMode}
              recoveryData={recoveryMatrixData}
              factoryId={selectedCustomerId}
              costStructure={{ material: directMaterialPercent, labor: directLaborPercent, energy: energyPercent, maintenance: maintenancePercent, overhead: overheadPercent, operatingProfit: operatingProfitPercent }}
              contributionPerUnit={contributionPerUnit}
            />

          </div>
        )}

        {/* TAB 2: PRODUCT COST MODEL */}
        {activeTab === "cost_model" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* COST CONTROL EXPERT SUMMARY & MAIN BENCHMARK TABLE */}
            <div className="border rounded-2xl p-6 space-y-6 transition-all bg-white border-slate-200 shadow-sm">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b pb-4 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-rose-700 rounded-lg text-white">
                      <Sliders className="w-5 h-5" />
                    </span>
                    <h3 className="text-base font-black uppercase tracking-tight text-rose-900">
                      Operasyonel Maliyet Kontrol Analizi (Bitmiş Ürün Kırılımı)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
                    Maliyet Kontrol Yöneticisi olarak, OpEx uzmanının VSM saha verilerinden beslenen ürün maliyet modeli oluşturulmaktadır. 
                    {costModelScope === "product_group" ? (
                      <span className="font-bold text-indigo-700 ml-1">
                        Seçilen Ürün Grubu: <span className="underline">{selectedVsmProject?.productGroup || "VSM Grubu"}</span> (Fabrika Üretim Payı: %{productVolumeShare})
                      </span>
                    ) : (
                      <span className="text-slate-600 ml-1">Modelleme Fabrika Geneli (%100 Ciro) üzerinden yürütülmektedir.</span>
                    )}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  {/* VSM FILTER BUTTON */}
                  <button
                    onClick={() => setIsVsmFilterOpen(true)}
                    className={`text-xs font-black px-3.5 py-2 rounded-xl border transition-all flex items-center space-x-2 cursor-pointer shadow-xs ${
                      costModelScope === "product_group"
                        ? "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-700"
                        : "bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100"
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span>
                      {costModelScope === "product_group"
                        ? `Ürün Grubu VSM Filtresi (%${productVolumeShare})`
                        : "Ürün Grubu Maliyet Modeli Oluştur (VSM Filtresi)"}
                    </span>
                  </button>

                  <div className="flex items-center space-x-2 border rounded-xl px-3 py-1.5 text-xs bg-slate-50 border-slate-200">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase">
                      {costModelScope === "product_group" ? "ÜRÜN GRUBU CİRO PAYI:" : "YILLIK FABRİKA CİROSU:"}
                    </span>
                    <span className="font-black font-mono text-rose-800 pr-1">
                      {formatMoney(effectiveRevenue)}
                    </span>
                  </div>
                  
                  <button
                    onClick={handleResetToSectorBenchmarks}
                    className="text-[10.5px] font-black px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sektör Ortalamasını Uygula</span>
                  </button>
                </div>
              </div>

              {/* COST CONTROL MANAGER NUMERICAL TARGET COCKPIT FOR OPEX SPECIALIST */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-md border border-slate-800 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-3 gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-rose-600 rounded-lg text-white">
                      <Target className="w-4 h-4" />
                    </span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-rose-400">
                      Cost Control Yöneticisi -&gt; OpEx Uzmanı Sayısal Hedef Karnesi
                    </h4>
                  </div>
                  <span className="text-[10px] bg-indigo-900/60 border border-indigo-700 text-indigo-200 font-bold px-2.5 py-1 rounded-md">
                    Scope: {costModelScope === "product_group" ? `Ürün Grubu (%${productVolumeShare} Pay)` : "Fabrika Geneli (%100)"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase font-sans block">Model Baz Ciro Hedefi</span>
                    <span className="text-sm font-black text-white block">{formatMoney(effectiveRevenue)}</span>
                    <span className="text-[9.5px] text-slate-400 block font-sans">
                      {costModelScope === "product_group" ? `Top. Ciromuzun %${productVolumeShare}'i` : "Fabrika Toplam Ciro"}
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[10px] text-amber-400 font-extrabold uppercase font-sans block">Yıllık VSM Kayıp Toleransı</span>
                    <span className="text-sm font-black text-rose-400 block">
                      {formatMoney(financialImpact.totalOperationalLosses.year)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block font-sans">
                      Cironun %{lossToRevenuePercent.toFixed(1)} erimesi
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[10px] text-emerald-400 font-extrabold uppercase font-sans block">Net Kâr İyileştirme Hedefi</span>
                    <span className="text-sm font-black text-emerald-400 block">
                      +{formatMoney(recoveryMatrixData.reduce((acc, r) => acc + r.avgGain, 0))}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block font-sans">
                      Geri Kazanım Matrisi ortalama kazancı
                    </span>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[10px] text-indigo-300 font-extrabold uppercase font-sans block">Hedeflenen Yeni Kâr Marjı</span>
                    <span className="text-sm font-black text-indigo-300 block">
                      %{(operatingProfitPercent + lossToRevenuePercent / 2).toFixed(1)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 block font-sans">
                      Mevcut: %{operatingProfitPercent.toFixed(1)} -&gt; Hedef: +%{(lossToRevenuePercent / 2).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* VISUAL PIE CHART & OPEX ALIGNMENT COCKPIT */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* PIE CHART VIEW */}
                <div className="lg:col-span-5 border rounded-2xl p-6 flex flex-col justify-between transition-all bg-slate-50/50 border-slate-200 shadow-xs">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-450 mb-1">
                      Ürün Maliyet Modeli Dağılımı
                    </h4>
                    <h3 className="text-xs font-extrabold text-rose-800 uppercase">
                      Finansal Dağılım Pasta Grafiği (%)
                    </h3>
                  </div>

                  <div className="h-60 w-full flex items-center justify-center relative my-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Central Text inside Donut */}
                    <div className="absolute flex flex-col items-center justify-center text-center px-2">
                      <span className="text-[11px] text-slate-400 font-extrabold uppercase">Model Ciro</span>
                      <span className="text-xs font-black font-mono text-slate-800">{formatMoney(effectiveRevenue)}</span>
                    </div>
                  </div>

                  {/* Grid of Mini Legend items */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] border-t pt-4 mt-2 border-slate-200">
                    {pieData.map((item, idx) => (
                      <div key={idx} className="flex items-center space-x-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-500 font-medium truncate">{item.name}:</span>
                        <span className="font-bold font-mono text-slate-800">%{item.value.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* OPEX ALIGNMENT & FINANCIAL TWIN ANALYSIS */}
                <div className="lg:col-span-7 border rounded-2xl p-6 flex flex-col justify-between transition-all bg-slate-50/50 border-slate-200 shadow-xs">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] bg-rose-50 text-rose-800 border border-rose-200 font-black px-2.5 py-1 rounded-md uppercase">
                          Finansal &amp; Operasyonel Paralellik (VSM)
                        </span>
                        <h3 className="text-xs font-black text-slate-800 uppercase mt-2">
                          Yalın İyileştirme Potansiyeli ve Maliyet Sızıntısı
                        </h3>
                      </div>
                      <span className="p-1.5 bg-rose-100 rounded-xl text-rose-700 shrink-0">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-white p-4 rounded-xl border border-slate-200">
                      <strong>Operasyonel Maliyet Kontrol Özeti:</strong>
                      <br />
                      Saha VSM (Değer Akış Haritalama) ve kayıp verilerimiz doğrudan bu finansal modelle paralel çalışmaktadır. 
                      Hesaplanan yıllık toplam kaybımız <span className="font-bold text-rose-600 font-mono">{formatMoney(financialImpact.totalOperationalLosses.year)}</span> olup, bu durum ciromuzun <span className="font-bold font-mono">%{lossToRevenuePercent.toFixed(1)}</span> oranında erimesine yol açmaktadır.
                      Yalın projelerle bu kayıpları geri kazanmak, faaliyet kârımızı <span className="font-black text-emerald-600 font-mono">%{operatingProfitPercent.toFixed(1)}</span> seviyesinden teorik olarak <span className="font-black text-indigo-600 font-mono">%{(operatingProfitPercent + lossToRevenuePercent).toFixed(1)}</span> oranına taşıyabilir.
                    </p>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-2 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[11px] text-slate-400 font-bold uppercase block">VSM Model Kayıp</span>
                        <span className="text-[11px] font-black font-mono text-rose-600 mt-0.5 block truncate">
                          {formatMoney(financialImpact.totalOperationalLosses.year)}
                        </span>
                      </div>

                      <div className="p-2 bg-white border border-slate-200 rounded-lg">
                        <span className="text-[11px] text-slate-400 font-bold uppercase block">Mevcut Kâr Hedefi</span>
                        <span className="text-[11px] font-black font-mono text-slate-800 mt-0.5 block truncate">
                          {formatMoney(effectiveRevenue * (operatingProfitPercent / 100))}
                        </span>
                      </div>

                      <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-[11px] text-emerald-800 font-black uppercase block">Maksimum Potansiyel</span>
                        <span className="text-[11px] font-black font-mono text-emerald-600 mt-0.5 block truncate">
                          {formatMoney((effectiveRevenue * (operatingProfitPercent / 100)) + financialImpact.totalOperationalLosses.year)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* DYNAMIC COST STRUCTURE TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b text-[10px] font-extrabold uppercase font-sans bg-slate-50 text-slate-500">
                      <th className="py-3 px-4">Maliyet Kalemi</th>
                      <th className="py-3 px-4 text-center w-40">Oran (%)</th>
                      <th className="py-3 px-4 text-right w-64">Parasal Karşılık ({currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    
                    {/* 1. Direkt Malzeme */}
                    <tr className="hover:bg-slate-50/60 transition-all">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-slate-800">Direkt Malzeme Giderleri</div>
                        <div className="text-[10px] text-slate-400">Üretimde sarf edilen hammadde, komponent, yarı mamul ve ambalaj giderleri.</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 rounded font-bold">
                            COPQ Malzeme Kaybı: {formatMoney(costGroupCopqSummary.materialLoss)}
                          </span>
                          <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold">
                            Potansiyel Kazanım: -{formatMoney(costGroupCopqSummary.materialGain)} (-%{(effectiveRevenue > 0 ? (costGroupCopqSummary.materialGain / effectiveRevenue * 100) : 0).toFixed(2)})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <span className="text-[10px] text-slate-400 font-sans">%</span>
                          <input 
                            type="number"
                            step="0.1"
                            value={directMaterialPercent}
                            onChange={(e) => setDirectMaterialPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-18 text-center border rounded-lg py-1 px-1.5 text-xs font-bold focus:ring-1 focus:ring-rose-500 bg-transparent text-slate-850"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatMoney(effectiveRevenue * (directMaterialPercent / 100))}
                      </td>
                    </tr>

                    {/* 2. Direkt İşçilik */}
                    <tr className="hover:bg-slate-50/60 transition-all">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-slate-800">Direkt İşçilik Giderleri</div>
                        <div className="text-[10.5px] text-indigo-700 font-sans font-semibold bg-indigo-50 py-1 px-2.5 rounded-lg mt-1 inline-block border border-indigo-100">
                          Dahili Fazla Mesai Yükü (%{overtimeBurdenPercent.toFixed(1)}): {formatMoney((effectiveRevenue * (directLaborPercent / 100)) * (overtimeBurdenPercent / 100))}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 rounded font-bold">
                            COPQ İşçilik Kaybı: {formatMoney(costGroupCopqSummary.laborLoss)}
                          </span>
                          <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold">
                            Potansiyel Kazanım: -{formatMoney(costGroupCopqSummary.laborGain)} (-%{(effectiveRevenue > 0 ? (costGroupCopqSummary.laborGain / effectiveRevenue * 100) : 0).toFixed(2)})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <span className="text-[10px] text-slate-400 font-sans">%</span>
                          <input 
                            type="number"
                            step="0.1"
                            value={directLaborPercent}
                            onChange={(e) => setDirectLaborPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-18 text-center border rounded-lg py-1 px-1.5 text-xs font-bold focus:ring-1 focus:ring-rose-500 bg-transparent text-slate-850"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatMoney(effectiveRevenue * (directLaborPercent / 100))}
                      </td>
                    </tr>

                    {/* 3. Enerji Giderleri */}
                    <tr className="hover:bg-slate-50/60 transition-all">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-slate-800">Enerji Giderleri</div>
                        <div className="text-[10px] text-slate-400">Üretim hatları, fırınlar, kompresörler ve fabrikanın genel elektrik/yakıt tüketimi.</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <span className="text-[10px] text-slate-400 font-sans">%</span>
                          <input 
                            type="number"
                            step="0.1"
                            value={energyPercent}
                            onChange={(e) => setEnergyPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-18 text-center border rounded-lg py-1 px-1.5 text-xs font-bold focus:ring-1 focus:ring-rose-500 bg-transparent text-slate-850"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatMoney(effectiveRevenue * (energyPercent / 100))}
                      </td>
                    </tr>

                    {/* 4. Bakım Giderleri */}
                    <tr className="hover:bg-slate-50/60 transition-all">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-slate-800">Bakım Giderleri</div>
                        <div className="text-[10px] text-slate-400">Yedek parça, makine revizyonları, kalıp bakımları ve TPM dış kaynaklı bakım operasyonları.</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <span className="text-[10px] text-slate-400 font-sans">%</span>
                          <input 
                            type="number"
                            step="0.1"
                            value={maintenancePercent}
                            onChange={(e) => setMaintenancePercent(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-18 text-center border rounded-lg py-1 px-1.5 text-xs font-bold focus:ring-1 focus:ring-rose-500 bg-transparent text-slate-850"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatMoney(effectiveRevenue * (maintenancePercent / 100))}
                      </td>
                    </tr>

                    {/* 5. Genel Üretim Giderleri (Overhead) */}
                    <tr className="hover:bg-slate-50/60 transition-all">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-slate-800">Genel Üretim Giderleri (Overhead)</div>
                        <div className="text-[10px] text-slate-400">Dolaylı işçilik (mavi yaka formenler, lojistik), amortismanlar, bina kirası, sarf malzeme amortismanı.</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 rounded font-bold">
                            COPQ Kapasite / Makine Kaybı: {formatMoney(costGroupCopqSummary.overheadLoss)}
                          </span>
                          <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold">
                            Potansiyel Kazanım: -{formatMoney(costGroupCopqSummary.overheadGain)} (-%{(effectiveRevenue > 0 ? (costGroupCopqSummary.overheadGain / effectiveRevenue * 100) : 0).toFixed(2)})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <span className="text-[10px] text-slate-400 font-sans">%</span>
                          <input 
                            type="number"
                            step="0.1"
                            value={overheadPercent}
                            onChange={(e) => setOverheadPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-18 text-center border rounded-lg py-1 px-1.5 text-xs font-bold focus:ring-1 focus:ring-rose-500 bg-transparent text-slate-850"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatMoney(effectiveRevenue * (overheadPercent / 100))}
                      </td>
                    </tr>

                    {/* 6. Faaliyet Karı (Tahmini) */}
                    <tr className="hover:bg-slate-50/60 transition-all">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-emerald-800">Faaliyet Kârı (Tahmini)</div>
                        <div className="text-[10px] text-slate-400">Tüm üretim ve genel işletim maliyetlerinden sonra kalan vergiler ve faiz öncesi işletme net kârı.</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="bg-emerald-100 border border-emerald-300 text-emerald-900 px-2.5 py-0.5 rounded font-black">
                            Toplam İyileştirilmiş Kâr Katkısı: +{formatMoney(costGroupCopqSummary.totalGain)} (Kâr Marjı: %{operatingProfitPercent.toFixed(1)} &rarr; %{(operatingProfitPercent + (effectiveRevenue > 0 ? (costGroupCopqSummary.totalGain / effectiveRevenue * 100) : 0)).toFixed(1)})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <span className="text-[10px] text-slate-400 font-sans">%</span>
                          <input 
                            type="number"
                            step="0.1"
                            value={operatingProfitPercent}
                            onChange={(e) => setOperatingProfitPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-18 text-center border rounded-lg py-1 px-1.5 text-xs font-bold focus:ring-1 focus:ring-rose-500 bg-emerald-50/35 text-emerald-850"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-800">
                        {formatMoney(effectiveRevenue * (operatingProfitPercent / 100))}
                      </td>
                    </tr>

                    {/* 7. TOPLAM CİRO */}
                    <tr className="text-xs font-sans bg-slate-900 text-white">
                      <td className="py-4 px-4 font-extrabold uppercase tracking-wide">
                        TOPLAM MODEL DEĞERİ (CİRO)
                      </td>
                      <td className="py-4 px-4 text-center font-bold font-mono text-[13px]">
                        %{totalSumPercent.toFixed(1)}
                      </td>
                      <td className="py-4 px-4 text-right font-black font-mono text-[13px] text-rose-400">
                        {formatMoney(effectiveRevenue)}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>

              {/* OVERTIME BURDEN CONTROLLER */}
              <div className="p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 border-slate-100">
                <div className="space-y-1">
                  <span className="text-xs text-indigo-700 font-extrabold uppercase flex items-center">
                    <Clock className="w-4 h-4 mr-1.5" />
                    Dahili Fazla Mesai Yükü Düzenleyicisi
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Direkt işçilik maliyetleri içindeki fazla mesai yük oranını ayarlayarak işçilik bütçe simülasyonunu yönetin.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-bold">%</span>
                  <input 
                    type="number"
                    step="0.1"
                    value={overtimeBurdenPercent}
                    onChange={(e) => setOvertimeBurdenPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-18 text-center border rounded-lg py-1 px-1.5 text-xs font-bold font-mono focus:ring-1 focus:ring-rose-500 bg-white border-slate-200 text-slate-800"
                  />
                  <span className="text-[10px] text-slate-450 font-bold uppercase">işçilik payı</span>
                </div>
              </div>

              {/* VALIDATION MESSAGE & AUTO BALANCE ACTION */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-3 gap-3">
                <div>
                  {Math.abs(totalSumPercent - 100) < 0.05 ? (
                    <span className="text-xs text-emerald-600 font-bold flex items-center space-x-2 bg-emerald-50 px-3.5 py-2 border border-emerald-200 rounded-xl">
                      <Check className="w-4 h-4" />
                      <span>Maliyet Dağılım Dengesi: %100 Uyumlu</span>
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 font-bold flex items-center space-x-2 bg-amber-50 px-3.5 py-2 border border-amber-200 rounded-xl">
                      <AlertTriangle className="w-4 h-4 animate-pulse text-amber-500" />
                      <span>Maliyet Dağılım Toplamı %100 olmalıdır (Şu an: %{totalSumPercent.toFixed(1)}). Lütfen oranları düzenleyin.</span>
                    </span>
                  )}
                </div>
                {Math.abs(totalSumPercent - 100) >= 0.05 && (
                  <button
                    onClick={handleAutoBalance}
                    className="text-xs bg-rose-700 hover:bg-rose-800 text-white font-black px-4.5 py-2 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                    <span>Farkı Otomatik Kârdan Dengele</span>
                  </button>
                )}
              </div>
            </div>

            {/* LOSS UNIT COSTS (L3): entered → VSM → customer card */}
            <div className="border rounded-2xl p-6 space-y-5 transition-all bg-white border-slate-200 shadow-sm">
              <div className="border-b pb-3">
                <h3 className="text-sm font-black text-rose-800 uppercase flex items-center">
                  <Sliders className="w-4 h-4 mr-1.5" />
                  Kayıp Birim Maliyetleri
                </h3>
                <p className="text-xs text-slate-500 max-w-4xl">
                  Kayıplar her istasyonda şu sırayla fiyatlanır: <strong>buraya girilen birim tutar</strong> → <strong>VSM projesi Kurulum'daki birim maliyet</strong> → <strong>şirket kartından türetilen</strong> (ciro, yıllık üretim adedi, maliyet yapısı %; Gemba QLA formülleri). Hiçbirinden bulunamayan tutarla fiyatlanacak kayıp toplama girmez ve "hesaplanamadı" olarak listelenir. Değişiklikler otomatik kaydedilir.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase text-slate-600">1 · Girilen birim tutarlar</h4>
                  {([
                    { key: "scrapUnitCost", label: `Hurda birim maliyeti (${currencySymbol}/adet)`, derived: cardDerived.scrapUnit },
                    { key: "reworkUnitCost", label: `Rework birim maliyeti (${currencySymbol}/adet)`, derived: cardDerived.reworkUnit },
                    { key: "laborHourlyRate", label: `İşçilik saat maliyeti (${currencySymbol}/kişi-saat)`, derived: cardDerived.laborHour },
                    { key: "holdingCostPerWipYearly", label: `Stok taşıma maliyeti (${currencySymbol}/adet/yıl)`, derived: cardDerived.wipHolding }
                  ] as const).map(row => (
                    <div key={row.key} className="grid grid-cols-[1fr_auto] items-center gap-3">
                      <div>
                        <div className="text-[11px] font-bold text-slate-700">{row.label}</div>
                        <div className="text-[10px] text-slate-400">
                          {row.derived.source ? `Kart: ${formatMoney(row.derived.value)} — ${row.derived.note}` : row.derived.note}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={unitCosts[row.key] ?? ""}
                        placeholder="girilmedi"
                        onChange={(e) => updateUnitCost(row.key, e.target.value)}
                        className="w-28 text-xs px-2 py-1.5 border rounded-lg text-right placeholder:italic placeholder:text-amber-600"
                      />
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="text-[11px] font-bold text-slate-700">Makine saat maliyeti — hat bazında ({currencySymbol}/makine-saat)</div>
                    <div className="text-[10px] text-slate-400 mb-2">
                      {cardDerived.machineHour.source ? `Kart (fabrika ortalaması): ${formatMoney(cardDerived.machineHour.value)} — ${cardDerived.machineHour.note}` : cardDerived.machineHour.note}
                    </div>
                    {costLines.length === 0 ? (
                      <div className="text-[10px] text-slate-400 italic">Maliyet tablosunda istasyon yok.</div>
                    ) : costLines.map(line => (
                      <div key={line.key} className="grid grid-cols-[1fr_auto] items-center gap-3 py-0.5">
                        <span className="text-[11px] text-slate-600">{line.label}</span>
                        <input
                          type="number"
                          min={0}
                          value={unitCosts.machineHourlyByLine?.[line.key] ?? ""}
                          placeholder="girilmedi"
                          onChange={(e) => updateLineMachineRate(line.key, e.target.value)}
                          className="w-28 text-xs px-2 py-1.5 border rounded-lg text-right placeholder:italic placeholder:text-amber-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[11px] font-black uppercase text-slate-600">2 · Şirket kartı tabanı (girilmeyen tutarlar için)</h4>
                  <table className="w-full text-[11px]">
                    <tbody className="divide-y">
                      <tr><td className="py-1.5 text-slate-600">Yıllık ciro{costModelScope === "product_group" ? ` (ürün grubu payı %${productVolumeShare})` : ""}</td><td className="py-1.5 text-right font-mono">{effectiveRevenue > 0 ? formatMoney(effectiveRevenue) : <span className="italic text-amber-600">girilmedi</span>}</td></tr>
                      <tr><td className="py-1.5 text-slate-600">Yıllık üretim adedi (şirket kartı → Operasyon)</td><td className="py-1.5 text-right font-mono">{cardBasis.annualVolume > 0 ? new Intl.NumberFormat("tr-TR").format(Math.round(cardBasis.annualVolume)) : <span className="italic text-amber-600">girilmedi</span>}</td></tr>
                      <tr><td className="py-1.5 text-slate-600">Maliyet yapısı (Ürün Maliyet Modeli): malzeme / işçilik / enerji / bakım</td><td className="py-1.5 text-right font-mono">%{directMaterialPercent} / %{directLaborPercent} / %{energyPercent} / %{maintenancePercent}</td></tr>
                      <tr><td className="py-1.5 text-slate-600">Mavi yaka × vardiya saati × haftalık gün (şirket kartı → İş Gücü)</td><td className="py-1.5 text-right font-mono">{cardWorkspace.blueCollar || "—"} × {cardWorkspace.shiftHours || "—"} × {cardWorkspace.workingDays || "—"}</td></tr>
                      <tr>
                        <td className="py-1.5 text-slate-600">Stok taşıma oranı (%/yıl: finansman + depolama + eskime)</td>
                        <td className="py-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            value={holdingRatePct || ""}
                            placeholder="girilmedi"
                            onChange={(e) => setHoldingRatePct(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-20 text-xs px-2 py-1 border rounded-lg text-right placeholder:italic placeholder:text-amber-600"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[10px] text-slate-400">
                    Türetme (QLA): birim malzeme = ciro × malzeme % / adet; hurda = malzeme + %50 × (işçilik + enerji); rework = %50 × (işçilik + enerji); makine saati = ciro × (enerji + bakım) % / istasyonların yıllık makine-saati; işçilik saati = ciro × işçilik % / (mavi yaka × yıllık saat); stok = (malzeme + %50 dönüşüm) × taşıma oranı. Duruş ve setup saati: makine saati × makine sayısı + işçilik saati × operatör.
                  </p>
                </div>
              </div>

              {/* Per-station: which rate is used and where it came from */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] font-extrabold uppercase text-slate-500">
                      <th className="py-2 px-2">İstasyon</th>
                      <th className="py-2 px-2 text-right">Hurda /adet</th>
                      <th className="py-2 px-2 text-right">Rework /adet</th>
                      <th className="py-2 px-2 text-right">İşçilik /saat</th>
                      <th className="py-2 px-2 text-right">Makine /saat</th>
                      <th className="py-2 px-2 text-right">Stok /adet/yıl</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeProcesses.map(p => {
                      const r = ratesById[p.id];
                      const cell = (rate: typeof r.scrapUnit) => (
                        <td className="py-1.5 px-2 text-right" title={rate.note}>
                          {rate.source ? (
                            <>
                              <span className="font-mono">{formatMoney(rate.value)}</span>
                              <span className={`ml-1 text-[8.5px] font-bold ${rate.source === "birim" ? "text-slate-500" : rate.source === "vsm" ? "text-sky-600" : "text-violet-600"}`}>{sourceLabel[rate.source]}</span>
                            </>
                          ) : <span className="italic text-amber-600">hesaplanamadı</span>}
                        </td>
                      );
                      return (
                        <tr key={p.id}>
                          <td className="py-1.5 px-2 font-bold text-slate-700">{p.name}{p.machineCount === undefined ? <span className="ml-1 text-[9px] font-normal text-amber-600">(makine sayısı yok → 1)</span> : null}</td>
                          {cell(r.scrapUnit)}{cell(r.reworkUnit)}{cell(r.laborHour)}{cell(r.machineHour)}{cell(r.wipHolding)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {lossCostUnresolved.length > 0 && (
                <div className="text-[10px] font-bold text-amber-700 space-y-0.5">
                  {lossCostUnresolved.map(([key, l]) => (
                    <div key={key}>{COST_OVERRIDE_CATEGORIES.find(c => c.key === key)?.label ?? key}: birim maliyet bulunamadığı için toplama girmedi — {l.unresolved.join(", ")}</div>
                  ))}
                </div>
              )}
            </div>

            {/* ACTUAL FINANCIAL DATA OVERRIDE LAYER */}
            <div className={`border rounded-2xl p-6 space-y-4 transition-all ${
              isDarkMode ? "bg-slate-900 border-amber-900/40" : "bg-amber-50/20 border-amber-200"
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-amber-200 dark:border-amber-900/40 pb-3">
                <div>
                  <h3 className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase flex items-center">
                    <DollarSign className="w-4 h-4 mr-1.5" />
                    Gerçek Mali Veriler (Opsiyonel — Hesaplanan Tutar Yerine)
                  </h3>
                  <p className="text-xs text-slate-500 max-w-3xl mt-0.5">
                    Kayıp tutarları ölçülen kayıplar × birim maliyetlerle (yukarıdaki panel) hesaplanır. Müşterinin muhasebesinden bir kalemin <strong className="text-amber-800 dark:text-amber-400">gerçek yıllık tutarı</strong> biliniyorsa kalemi açıp girin — o kalem hesaplanan tutar yerine bunu kullanır. Açılmayan kalemler hesaplanan tutarda kalır.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 italic">Değişiklikler otomatik kaydedilir</span>
                  {hasActiveCostOverrides && (
                    <button
                      onClick={handleResetCostOverrides}
                      className="text-xs bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Tümünü Hesaplanana Döndür
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {COST_OVERRIDE_CATEGORIES.map(({ key, label }) => {
                  const override = actualCostOverrides[key] || { enabled: false, annualValue: 0 };
                  const estimatedYear = (financialImpactBase as any)[key]?.year || 0;
                  return (
                    <div
                      key={key}
                      className={`p-3 rounded-xl border transition-all ${
                        override.enabled
                          ? "bg-amber-100/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                          : "bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <label className="flex items-center justify-between gap-2 cursor-pointer">
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide">{label}</span>
                        <input
                          type="checkbox"
                          checked={override.enabled}
                          onChange={(e) => handleUpdateCostOverride(key, "enabled", e.target.checked)}
                          className="w-4 h-4 accent-amber-700 cursor-pointer"
                        />
                      </label>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 shrink-0">{currencySymbol}/yıl</span>
                        <input
                          type="number"
                          min={0}
                          disabled={!override.enabled}
                          value={override.enabled ? override.annualValue : Math.round(estimatedYear)}
                          onChange={(e) => handleUpdateCostOverride(key, "annualValue", parseFloat(e.target.value) || 0)}
                          className={`w-full text-xs px-2.5 py-1.5 border rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                            override.enabled
                              ? "bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 font-bold text-amber-800 dark:text-amber-300"
                              : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                          }`}
                        />
                      </div>
                      {!override.enabled && (
                        <div className="text-[9.5px] text-slate-400 mt-1">Hesaplanan: {formatMoney(estimatedYear)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COPQ — customer's own quality-cost figures */}
            <div className="border rounded-2xl p-6 space-y-3 bg-white border-slate-200 shadow-sm">
              <div className="border-b pb-2">
                <h3 className="text-sm font-black text-rose-800 uppercase flex items-center">
                  <DollarSign className="w-4 h-4 mr-1.5" />
                  Kalite Maliyetleri — Müşteri Verisi (yıllık)
                </h3>
                <p className="text-xs text-slate-500 max-w-4xl">
                  İç hata (hurda + rework), kayıp kapasite, stok, geç teslimat ve mesai COPQ'ya ölçülen kayıplardan gelir. Aşağıdaki dış hata ve muayene kalemleri ölçülemez; müşterinin muhasebesinden yıllık tutar girilmezse 0 sayılır (eskiden iç hatanın / cironun sabit yüzdeleriyle tahmin ediliyordu). Değişiklikler otomatik kaydedilir.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {COPQ_ENTERED_CATEGORIES.map(c => (
                  <label key={c.key} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-slate-700">{c.label} ({currencySymbol}/yıl)</span>
                    <input
                      type="number"
                      min={0}
                      value={copqEntered[c.key] ?? ""}
                      placeholder="girilmedi"
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setCopqEntered(prev => {
                          const next = { ...prev };
                          if (e.target.value.trim() === "" || !(v > 0)) delete next[c.key]; else next[c.key] = v;
                          return next;
                        });
                      }}
                      className="w-32 text-xs px-2 py-1.5 border rounded-lg text-right placeholder:italic placeholder:text-amber-600"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* PROCESS COST TABLE */}
            <div className={`border rounded-2xl p-6 space-y-4 transition-all ${
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            }`}>
              <span className="font-extrabold text-[10px] uppercase text-rose-800 dark:text-rose-400 tracking-wider block border-b pb-2 mb-2">
                Süreçlere Dağıtılmış Standart Parça Maliyet Kırılımı (Unit Product Cost Model)
              </span>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className={`border-b text-[11px] font-extrabold uppercase font-sans ${
                      isDarkMode ? "bg-slate-950/40 text-slate-400" : "bg-slate-50 text-slate-500"
                    }`}>
                      <th className="py-2.5 px-3">İstasyon (VSM Prosesi)</th>
                      <th className="py-2.5 px-3 text-right">Direkt Malzeme</th>
                      <th className="py-2.5 px-3 text-right">Direkt İşçilik</th>
                      <th className="py-2.5 px-3 text-right">Makine Zamanı</th>
                      <th className="py-2.5 px-3 text-right">Fire Toleransı</th>
                      <th className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">Birim Maliyet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {calculatedProcesses.map((p) => {
                      // Per-piece cost from the resolved rates (lossCosting.ts): material from the card,
                      // labor and machine time over the actual cycle time, scrap spread over good output.
                      const r = ratesById[p.id];
                      const hours = p.actualCycleTimeSeconds / 3600;
                      const directMaterial = cardDerived.unitMaterial ?? 0;
                      const directLabor = r?.laborHour.source ? hours * r.laborHour.value * p.operatorsPerShift : 0;
                      const machineOverhead = r?.machineHour.source ? hours * r.machineHour.value * (p.machineCount ?? 1) : 0;
                      const scrapCostAllocated = r?.scrapUnit.source && p.producedQtyPerDay > 0 ? p.scrapQty * r.scrapUnit.value / p.producedQtyPerDay : 0;
                      const totalUnitCost = directMaterial + directLabor + machineOverhead + scrapCostAllocated;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-all">
                          <td className="py-2.5 px-3 font-sans font-bold text-slate-800 dark:text-slate-200">{p.name}</td>
                          <td className="py-2.5 px-3 text-right">{formatMoney(directMaterial)}</td>
                          <td className="py-2.5 px-3 text-right">{formatMoney(directLabor)}</td>
                          <td className="py-2.5 px-3 text-right">{formatMoney(machineOverhead)}</td>
                          <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold">{formatMoney(scrapCostAllocated)}</td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white bg-slate-50/40 dark:bg-slate-950/20">{formatMoney(totalUnitCost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: OPPORTUNITY MATRIX & LOSS MAPPING ENGINE */}
        {activeTab === "opportunity_matrix" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* THREE CORE STRATEGIC OPPORTUNITY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              <div className="bg-white border rounded-2xl p-5 shadow-xs border-slate-200 flex flex-col justify-between h-44">
                <div className="space-y-2">
                  <span className="text-[9.5px] bg-rose-50 border border-rose-200 text-rose-700 font-black px-2.5 py-1 rounded-md uppercase">
                    1. Direkt Maliyet Düşüşü (Direct Cost Reduction)
                  </span>
                  <p className="text-[11px] text-slate-450 leading-relaxed">
                    Hurda + rework + norm fazlası işçilik kayıplarının yıllık tutarı (Kayıp Birim Maliyetleri ile fiyatlanmış).
                  </p>
                </div>
                <div className="border-t pt-3 flex justify-between items-baseline">
                  <span className="text-xs text-slate-400 font-bold">Yıllık Fırsat:</span>
                  <span className="text-lg font-black font-mono text-rose-700">{formatMoney(lossMapping.directCostReduction)}</span>
                </div>
              </div>

              <div className="bg-white border rounded-2xl p-5 shadow-xs border-slate-200 flex flex-col justify-between h-44">
                <div className="space-y-2">
                  <span className="text-[9.5px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-black px-2.5 py-1 rounded-md uppercase">
                    2. Kapasite Oluşturma (Capacity Creation)
                  </span>
                  <p className="text-[11px] text-slate-450 leading-relaxed">
                    Setup / model değişimi ve plansız arıza süresinin (makine + işçilik saati ile fiyatlanmış) yıllık tutarı.
                  </p>
                </div>
                <div className="border-t pt-3 flex justify-between items-baseline">
                  <span className="text-xs text-slate-400 font-bold">Yıllık Kayıp:</span>
                  <span className="text-lg font-black font-mono text-indigo-700">{formatMoney(lossMapping.capacityCreation)}</span>
                </div>
              </div>

              <div className="bg-white border rounded-2xl p-5 shadow-xs border-slate-200 flex flex-col justify-between h-44">
                <div className="space-y-2">
                  <span className="text-[9.5px] bg-amber-50 border border-amber-200 text-amber-700 font-black px-2.5 py-1 rounded-md uppercase">
                    3. Stratejik Operasyonel Kazanım
                  </span>
                  <p className="text-[11px] text-slate-450 leading-relaxed">
                    WIP stok taşıma maliyeti ile (girildiyse) gerçek geç teslimat ve fazla mesai tutarları.
                  </p>
                </div>
                <div className="border-t pt-3 flex justify-between items-baseline">
                  <span className="text-xs text-slate-400 font-bold">Finansal Kazanım:</span>
                  <span className="text-lg font-black font-mono text-amber-700">{formatMoney(lossMapping.strategicGain)}</span>
                </div>
              </div>

            </div>

            {/* HIGH-FIDELITY RENDER OF ECONOMIC LOSS TREE & WATERFALL */}
            <AnalysisViews
              calculated={calculatedProcesses}
              revenue={effectiveRevenue}
              copq={copqData}
              financialImpact={financialImpact}
              industry={selectedIndustry}
              currency={currencySymbol}
              isDarkMode={isDarkMode}
            />

            {/* COPQ FINANSAL MATRİSİ TABLOSU */}
            <div className={`border rounded-xl p-5 shadow-xs transition-all ${
              isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            }`}>
              {/* VSM Projesi / Ürün Grubu Model Kapsamı Bilgi Bandı */}
              <div className="mb-4 p-3 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-xs">
                    <Filter className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-slate-300">Model Hesaplama Kapsamı:</span>
                      <span className="text-xs font-black text-rose-400 bg-rose-950/60 border border-rose-800/80 px-2 py-0.5 rounded">
                        {costModelScope === "product_group" && selectedVsmProject 
                          ? `VSM Projesi: ${selectedVsmProject.productGroup} (%${productVolumeShare} Pay)` 
                          : "Tüm Fabrika Geneli (%100 Ciro)"}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      COPQ Finansal Matrisi değerleri seçili {costModelScope === "product_group" ? "ürün grubu" : "fabrika"} cirosuna (<span className="font-mono font-bold text-slate-200">{formatMoney(effectiveRevenue)}</span>) ve VSM süreç verilerine göre otomatik güncellenir.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsVsmFilterOpen(true)}
                  className="text-xs bg-rose-700 hover:bg-rose-800 text-white font-black px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Kapsamı / VSM Projesini Değiştir</span>
                </button>
              </div>

              {isScopedWithNoData && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/45 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                    <strong>{selectedVsmProject?.productGroup || "Bu ürün grubu"}</strong> için VSM'den senkronize edilmiş süreç verisi yok — aşağıdaki değerler bu yüzden 0 görünüyor, ürün grubunun gerçekten kaybı olmadığı anlamına gelmez. VSM sayfasından ilgili projeyi yeniden kaydedin.
                  </p>
                </div>
              )}

              <div className="border-b pb-3 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-sm font-black text-rose-800 dark:text-rose-400 uppercase flex items-center">
                    <Layers className="w-4 h-4 mr-1.5 text-rose-700" />
                    COPQ Finansal Matrisi (VSM Entegrasyonlu)
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    Saha VSM verilerine ve seçilen maliyet modeline göre kalitesizlik maliyetlerinin nerede oluştuğunu, hangi stratejik fırsat alanına etki ettiğini ve kâr potansiyelinizi gösterir. <span className="font-semibold text-rose-700 dark:text-rose-400">Tutarlar ölçülen kayıplardan gelir; aralık Gemba QLA ±%20 belirsizlik bandıdır.</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 font-black px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-900/45">
                    Maliyet Dağılım Modeli
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[10px] tracking-wide uppercase border-b border-slate-800">
                      <th className="py-3 px-4 border-r border-slate-800">Fırsat Alanı</th>
                      <th className="py-3 px-4 border-r border-slate-800">Maliyet Konusu</th>
                      <th className="py-3 px-4 border-r border-slate-800 text-center w-48">Kaynak (aralık ±%20)</th>
                      <th className="py-3 px-4 border-r border-slate-800 text-right">Min Maliyet</th>
                      <th className="py-3 px-4 text-right">Max Maliyet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    
                    {/* DOĞRUDAN MALİYET AZALTMA */}
                    {copqMatrixRows.filter(r => r.area === "Doğrudan Maliyet Azaltma").map((row, idx, arr) => (
                      <tr key={`dir-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all font-sans">
                        {idx === 0 && (
                          <td rowSpan={arr.length} className="py-4 px-4 font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 text-center align-middle w-[250px]">
                            Doğrudan Maliyet Azaltma
                          </td>
                        )}
                        <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 font-medium">
                          <div className="font-bold text-slate-900 dark:text-white">{row.subject}</div>
                          <div className="text-[10px] text-rose-700 dark:text-rose-400 font-semibold mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                            {row.costGroup}
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-500">
                          {row.basis}
                        </td>
                        <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 text-right font-mono font-bold text-slate-800 dark:text-slate-355">
                          {formatMoney(row.min)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatMoney(row.max)}
                        </td>
                      </tr>
                    ))}

                    {/* KAPASİTE YARATMA */}
                    {copqMatrixRows.filter(r => r.area === "Kapasite Yaratma").map((row, idx, arr) => (
                      <tr key={`cap-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all font-sans">
                        {idx === 0 && (
                          <td rowSpan={arr.length} className="py-4 px-4 font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 text-center align-middle w-[250px]">
                            Kapasite Yaratma
                          </td>
                        )}
                        <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 font-medium">
                          <div className="font-bold text-slate-900 dark:text-white">{row.subject}</div>
                          <div className="text-[10px] text-indigo-700 dark:text-indigo-400 font-semibold mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span>
                            {row.costGroup}
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-500">
                          {row.basis}
                        </td>
                        <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 text-right font-mono font-bold text-slate-800 dark:text-slate-355">
                          {formatMoney(row.min)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatMoney(row.max)}
                        </td>
                      </tr>
                    ))}

                    {/* STRATEJİK OPERASYONEL KAZANÇ */}
                    {copqMatrixRows.filter(r => r.area === "Stratejik Operasyonel Kazanç").map((row, idx, arr) => (
                      <tr key={`strat-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all font-sans">
                        {idx === 0 && (
                          <td rowSpan={arr.length} className="py-4 px-4 font-black text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 text-center align-middle w-[250px]">
                            Stratejik Operasyonel Kazanç
                          </td>
                        )}
                        <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 font-medium">
                          <div className="font-bold text-slate-900 dark:text-white">{row.subject}</div>
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                            {row.costGroup}
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-500">
                          {row.basis}
                        </td>
                        <td className="py-3 px-4 border-r border-slate-200 dark:border-slate-800 text-right font-mono font-bold text-slate-800 dark:text-slate-355">
                          {formatMoney(row.min)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatMoney(row.max)}
                        </td>
                      </tr>
                    ))}

                    {/* BOTTOM TOTAL MODELING ROW */}
                    <tr className="bg-rose-50/40 dark:bg-slate-950/40 font-extrabold text-[12px] text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                      <td colSpan={2} className="py-3.5 px-4 font-black text-rose-850 dark:text-rose-400 uppercase">
                        COPQ Toplam maliyet modellemesi
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-500 italic text-[11px]">
                        Dinamik Modelleme Toplamı
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-rose-700 dark:text-rose-400 border-r border-slate-200 dark:border-slate-800">
                        {formatMoney(copqMatrixRows.reduce((sum, r) => sum + r.min, 0))}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-rose-800 dark:text-rose-450">
                        {formatMoney(copqMatrixRows.reduce((sum, r) => sum + r.max, 0))}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: RECOVERY MATRIX (WCM COST DEPLOYMENT) */}
        {activeTab === "recovery_matrix" && (() => {
          const totalCopqLoss = recoveryMatrixData.reduce((sum, item) => sum + item.avgLoss, 0);
          const totalPotentialGainMin = recoveryMatrixData.reduce((sum, item) => sum + item.potentialGainMin, 0);
          const totalPotentialGainMax = recoveryMatrixData.reduce((sum, item) => sum + item.potentialGainMax, 0);
          const totalAverageRecovery = recoveryMatrixData.reduce((sum, item) => sum + item.avgGain, 0);
          const totalRealizedSavings = recoveryMatrixDataWithRealized.reduce((sum, item) => sum + item.realizedSavings, 0);
          const realizedVsPotentialPercent = totalAverageRecovery > 0 ? (totalRealizedSavings / totalAverageRecovery) * 100 : 0;
          const totalInvestmentCost = recoveryMatrixDataWithRealized.reduce((sum, item) => sum + item.investmentCost, 0);
          const blendedPaybackMonths = totalAverageRecovery > 0 ? (totalInvestmentCost / (totalAverageRecovery / 12)) : null;
          const blendedRoiPercent = totalInvestmentCost > 0 ? ((totalAverageRecovery - totalInvestmentCost) / totalInvestmentCost) * 100 : 0;

          const currentOperatingProfit = effectiveRevenue * (operatingProfitPercent / 100);
          const newOperatingProfit = currentOperatingProfit + totalAverageRecovery;
          const operatingProfitPercentIncrease = currentOperatingProfit > 0 ? (totalAverageRecovery / currentOperatingProfit) * 100 : 0;

          const areaGroupings = [
            { id: "direct", name: "Doğrudan Maliyet Azaltma", items: recoveryMatrixDataWithRealized.filter(r => r.area === "Doğrudan Maliyet Azaltma") },
            { id: "capacity", name: "Kapasite Yaratma", items: recoveryMatrixDataWithRealized.filter(r => r.area === "Kapasite Yaratma") },
            { id: "strategic", name: "Stratejik Operasyonel Kazanç", items: recoveryMatrixDataWithRealized.filter(r => r.area === "Stratejik Operasyonel Kazanç") }
          ];

          return (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* INPUT PANEL: OPEX MATURITY & OEE */}
              <div className={`p-6 rounded-2xl border transition-all ${
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-xs"
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-rose-800 dark:text-rose-400 uppercase flex items-center">
                      <Cpu className="w-4 h-4 mr-1.5 animate-spin" style={{ animationDuration: '3s' }} />
                      Lean-OPEX Opportunity Engine & Karar Destek Sistemi
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-2xl">
                      Mevcut fabrika olgunluk parametrelerine göre kayıplardan elde edilebilecek finansal geri kazanım oranlarını akıllı algoritmalarla hesaplar.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-6">
                    {/* OPEX Maturity Level Input */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-slate-600 dark:text-slate-300">OPEX Olgunluk Seviyesi</span>
                        <span className="text-rose-600 dark:text-rose-400 font-mono">%{opexMaturity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="range"
                          min="0"
                          max="100"
                          value={opexMaturity}
                          onChange={(e) => setOpexMaturity(parseInt(e.target.value) || 0)}
                          className="w-36 md:w-44 accent-rose-700 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                        />
                        <input 
                          type="number"
                          min="0"
                          max="100"
                          value={opexMaturity}
                          onChange={(e) => setOpexMaturity(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                          className="w-12 text-center border rounded-md py-0.5 text-xs font-black bg-transparent dark:border-slate-700 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    {/* Factory OEE (Fetched from VSM, non-editable) */}
                    <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 px-4 py-2.5 rounded-xl flex flex-col justify-center">
                      <span className="text-[11px] font-extrabold uppercase text-slate-450 dark:text-slate-400 tracking-wider">
                        Fabrika OEE (VSM Analizi)
                      </span>
                      <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                        %{avgOee > 0 ? avgOee.toFixed(1) : "60.0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* POWER BI KPI GRIDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">

                {/* CARD 1 */}
                <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                }`}>
                  <div className="text-slate-450 dark:text-slate-400 text-[11px] font-black uppercase tracking-wider">
                    Toplam COPQ Kaybı
                  </div>
                  <div className="text-lg font-black text-slate-850 dark:text-slate-100 mt-2 font-mono">
                    {formatMoney(totalCopqLoss)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Saha Analizindeki Toplam Kayıp
                  </div>
                </div>

                {/* CARD 2 */}
                <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                }`}>
                  <div className="text-slate-450 dark:text-slate-400 text-[11px] font-black uppercase tracking-wider">
                    Geri Kazanım Aralığı
                  </div>
                  <div className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-2 font-mono tracking-tight leading-tight">
                    {formatMoney(totalPotentialGainMin)} <span className="text-slate-400 text-xs font-normal">ve</span> {formatMoney(totalPotentialGainMax)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Lean Optimizasyon Aralığı
                  </div>
                </div>

                {/* CARD 3 */}
                <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  isDarkMode ? "bg-slate-950 border-rose-500/20" : "bg-rose-50/20 border-rose-100"
                }`}>
                  <div className="text-rose-800 dark:text-rose-450 text-[11px] font-black uppercase tracking-wider">
                    Ortalama Beklenen Kazanç
                  </div>
                  <div className="text-lg font-black text-rose-700 dark:text-rose-400 mt-2 font-mono">
                    {formatMoney(totalAverageRecovery)}
                  </div>
                  <div className="text-[10px] text-rose-600/70 dark:text-rose-400/70 mt-1">
                    Ortalama Tahmini Tasarruf
                  </div>
                </div>

                {/* CARD 4 */}
                <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                }`}>
                  <div className="text-slate-450 dark:text-slate-400 text-[11px] font-black uppercase tracking-wider">
                    Mevcut Faaliyet Kârı
                  </div>
                  <div className="text-lg font-black text-slate-700 dark:text-slate-300 mt-2 font-mono">
                    {formatMoney(currentOperatingProfit)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Ciro Oranı: %{operatingProfitPercent.toFixed(1)}
                  </div>
                </div>

                {/* CARD 5 */}
                <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  isDarkMode ? "bg-slate-900 border-emerald-500/20" : "bg-emerald-50/20 border-emerald-100"
                }`}>
                  <div className="text-emerald-800 dark:text-emerald-400 text-[11px] font-black uppercase tracking-wider flex justify-between items-center">
                    <span>Yeni Faaliyet Kârı</span>
                    <span className="bg-emerald-500 text-white font-black text-[11px] px-1.5 py-0.5 rounded-md">
                      +{operatingProfitPercentIncrease.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-450 mt-2 font-mono">
                    {formatMoney(newOperatingProfit)}
                  </div>
                  <div className="text-[10px] text-emerald-600/70 dark:text-emerald-450/70 mt-1">
                    Tasarruf Dahil EBITDA Etkisi
                  </div>
                </div>

                {/* CARD 6: REALIZED SAVINGS FEEDBACK LOOP */}
                <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  isDarkMode ? "bg-slate-900 border-teal-500/20" : "bg-teal-50/20 border-teal-100"
                }`}>
                  <div className="text-teal-800 dark:text-teal-400 text-[11px] font-black uppercase tracking-wider flex justify-between items-center">
                    <span>Gerçekleşen Tasarruf</span>
                    <span className="bg-teal-500 text-white font-black text-[11px] px-1.5 py-0.5 rounded-md">
                      %{realizedVsPotentialPercent.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-lg font-black text-teal-600 dark:text-teal-400 mt-2 font-mono">
                    {formatMoney(totalRealizedSavings)}
                  </div>
                  <div className="text-[10px] text-teal-600/70 dark:text-teal-400/70 mt-1">
                    Tamamlanan Kaizen Projelerinden (Potansiyelin %{realizedVsPotentialPercent.toFixed(1)}'i)
                  </div>
                </div>

              </div>

              {/* PARETO CHART */}
              <div className={`p-5 rounded-2xl border ${
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-xs"
              }`}>
                <div className="mb-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1.5 text-rose-600" />
                    Kayıp Analizi Pareto Grafiği (80/20 Kuralı)
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Maliyet kalemi kayıplarının boyutlarına ve kümülatif etki yüzdesine göre dağılımı. En yüksek öncelikli maliyet konularını belirlemede yardımcı olur.
                  </p>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={paretoChartData} margin={{ top: 15, right: 10, left: 10, bottom: 15 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: isDarkMode ? "#94a3b8" : "#475569", fontSize: 9 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        yAxisId="left"
                        label={{ value: `Kayıp (Bin ${currencySymbol})`, angle: -90, position: 'insideLeft', fill: isDarkMode ? "#94a3b8" : "#475569", fontSize: 10, offset: -5 }}
                        tick={{ fill: isDarkMode ? "#94a3b8" : "#475569", fontSize: 9 }}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right"
                        domain={[0, 100]}
                        label={{ value: 'Kümülatif %', angle: 90, position: 'insideRight', fill: isDarkMode ? "#94a3b8" : "#475569", fontSize: 10, offset: -5 }}
                        tick={{ fill: isDarkMode ? "#94a3b8" : "#475569", fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDarkMode ? "#0f172a" : "#ffffff",
                          borderColor: isDarkMode ? "#1e293b" : "#e2e8f0",
                          borderRadius: "0.75rem",
                          color: isDarkMode ? "#f1f5f9" : "#0f172a"
                        }}
                        itemStyle={{ fontSize: "11px" }}
                        labelStyle={{ fontWeight: "bold", fontSize: "11px" }}
                      />
                      <Bar yAxisId="left" dataKey={`Kayıp (Bin ${currencySymbol})`} fill="#e11d48" radius={[4, 4, 0, 0]} barSize={24} name={`Ortalama Kayıp (Bin ${currencySymbol})`} />
                      <Line yAxisId="right" type="monotone" dataKey="Kümülatif %" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#0f172a" }} activeDot={{ r: 6 }} name="Kümülatif %" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* RECOVERY MATRIX TABLE */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-xs"
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center">
                      <Award className="w-4 h-4 mr-1.5 text-rose-700" />
                      Finansal Geri Kazanım ve İyileştirme Fırsatları Matrisi
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Kayıpların COPQ sayfasındaki maliyet dağılım modeline göre kurgulanmış, Lean/WCM uygulamaları ile finansal olarak geri kazanılabilecek kazanç potansiyelleri. <strong className="text-slate-700 dark:text-slate-300">Tablodaki İyileştirme Oranı (%) ve Yatırım Maliyeti (%) değerlerini elle değiştirebilirsiniz.</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {Object.keys(customImprovementRates).length > 0 && (
                      <button
                        onClick={handleResetImprovementRates}
                        className="text-xs bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        İyileştirme Oranlarını Sıfırla
                      </button>
                    )}
                    {Object.keys(customInvestmentPercent).length > 0 && (
                      <button
                        onClick={handleResetInvestmentPercent}
                        className="text-xs bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Yatırım Maliyetlerini Sıfırla
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-900 text-white font-black text-[10px] tracking-wide uppercase border-b border-slate-800">
                        <th className="py-3 px-3 border-r border-slate-800 text-center w-[160px]">Fırsat Alanı</th>
                        <th className="py-3 px-3 border-r border-slate-800">Maliyet Konusu & Yalın/WCM Aracı</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-right">Ortalama Kayıp ({currencySymbol})</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-center w-[170px]">İyileştirme Oranı (%) [Elle Düzenlenebilir]</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-right">Ortalama Tasarruf ({currencySymbol})</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-right w-[140px]">Yatırım Maliyeti (Tahmini)</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-center">Geri Ödeme / ROI</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-right">Gerçekleşen Tasarruf ({currencySymbol})</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-center">EBITDA Katkısı</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-center">Önem Derecesi</th>
                        <th className="py-3 px-3 text-center">Aksiyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaGroupings.map((group) => (
                        <React.Fragment key={group.id}>
                          {group.items.map((row, idx, arr) => {
                            const severityColors = {
                              Critical: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40",
                              High: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/40",
                              Medium: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40",
                              Low: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700/40"
                            };

                            return (
                              <tr key={row.subject} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all font-sans border-b border-slate-200/60 dark:border-slate-800/60">
                                {idx === 0 && (
                                  <td rowSpan={arr.length} className="py-4 px-3 font-black text-slate-900 dark:text-white bg-slate-50/40 dark:bg-slate-950/30 border-r border-slate-200 dark:border-slate-800 text-center align-middle text-xs">
                                    {group.name}
                                  </td>
                                )}
                                <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800">
                                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    {row.subject}
                                    {row.isCustom && (
                                      <span className="text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded font-black border border-amber-200 dark:border-amber-800">Elle Değiştirildi</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {row.costGroup}
                                  </div>
                                  <div className="mt-1">
                                    <span className="inline-block text-[9.5px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50">
                                      {row.leanTool}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-right font-mono font-medium text-slate-600 dark:text-slate-400">
                                  {formatMoney(row.avgLoss)}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-center bg-indigo-50/20 dark:bg-indigo-950/20">
                                  <div className="flex items-center justify-center space-x-1 font-sans">
                                    <input 
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={Math.round(row.improvementMin * 10) / 10}
                                      onChange={(e) => handleUpdateImprovementRate(row.subject, "min", parseFloat(e.target.value) || 0)}
                                      className="w-12 text-center border rounded-md py-0.5 text-[11px] font-bold bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <span className="text-slate-400 text-[10px]">%</span>
                                    <span className="text-slate-400 text-xs px-0.5">-</span>
                                    <input 
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={Math.round(row.improvementMax * 10) / 10}
                                      onChange={(e) => handleUpdateImprovementRate(row.subject, "max", parseFloat(e.target.value) || 0)}
                                      className="w-12 text-center border rounded-md py-0.5 text-[11px] font-bold bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <span className="text-slate-400 text-[10px]">%</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-right bg-emerald-50/10 dark:bg-emerald-950/10">
                                  <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                    {formatMoney(row.avgGain)}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                    Min: {formatMoney(row.potentialGainMin)} | Max: {formatMoney(row.potentialGainMax)}
                                  </div>
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-right bg-amber-50/20 dark:bg-amber-950/10">
                                  <div className="font-mono font-bold text-amber-700 dark:text-amber-400">
                                    {formatMoney(row.investmentCost)}
                                  </div>
                                  <div className="flex items-center justify-end gap-1 mt-1">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={Math.round(row.investmentPercent * 10) / 10}
                                      onChange={(e) => handleUpdateInvestmentPercent(row.subject, parseFloat(e.target.value) || 0)}
                                      className="w-12 text-center border rounded-md py-0.5 text-[11px] font-bold bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                    <span className="text-slate-400 text-[10px]">% kayıp</span>
                                    {row.isInvestmentCustom && (
                                      <span className="text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1 py-0.2 rounded font-black border border-amber-200 dark:border-amber-800">Elle</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-center">
                                  <div className="font-mono font-black text-slate-800 dark:text-slate-200">
                                    {row.paybackMonths !== null ? `${row.paybackMonths < 0.1 ? "<0.1" : row.paybackMonths.toFixed(1)} Ay` : "—"}
                                  </div>
                                  <div className={`text-[10px] font-bold mt-0.5 ${row.roiPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                    ROI: {row.roiPercent >= 0 ? "+" : ""}{row.roiPercent.toFixed(0)}%
                                  </div>
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-right bg-teal-50/10 dark:bg-teal-950/10">
                                  {row.realizedSavings > 0 ? (
                                    <>
                                      <div className="font-mono font-bold text-teal-700 dark:text-teal-400">
                                        {formatMoney(row.realizedSavings)}
                                      </div>
                                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                        Kalan: {formatMoney(row.remainingPotential)}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-[11px] font-mono text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-center font-mono">
                                  <span className="inline-block text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    +{row.ebitdaImpactPercent.toFixed(2)}% EBITDA
                                  </span>
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 border text-[10px] font-bold rounded-md ${severityColors[row.severity as keyof typeof severityColors] || severityColors.Low}`}>
                                    {row.severity}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <button
                                      onClick={() => handleOpenAssignModal(row)}
                                      className="text-[10px] font-black px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                    >
                                      <Target className="w-3 h-3" />
                                      Proje Olarak Ata
                                    </button>
                                    {kaizenCountBySubject[row.subject] > 0 && (
                                      <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                        {kaizenCountBySubject[row.subject]} Proje Açık
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}

                      {/* TOTALS ROW */}
                      <tr className="bg-rose-50/40 dark:bg-slate-950/40 font-extrabold text-[12px] text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                        <td colSpan={2} className="py-3.5 px-4 font-black text-rose-850 dark:text-rose-450 uppercase text-xs">
                          Toplam Geri Kazanım Potansiyeli
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-slate-800 dark:text-slate-200">
                          {formatMoney(totalCopqLoss)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-black text-indigo-700 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20">
                          %{(totalAverageRecovery / totalCopqLoss * 100).toFixed(1)} Ortalama İyileştirme
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/30">
                          {formatMoney(totalAverageRecovery)}
                          <div className="text-[11px] font-normal text-emerald-800/80 dark:text-emerald-300/80">
                            Aralık: {formatMoney(totalPotentialGainMin)} - {formatMoney(totalPotentialGainMax)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/30">
                          {formatMoney(totalInvestmentCost)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-black text-slate-800 dark:text-slate-200">
                          {blendedPaybackMonths !== null ? `${blendedPaybackMonths.toFixed(1)} Ay` : "—"}
                          <div className={`text-[11px] font-normal ${blendedRoiPercent >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                            ROI: {blendedRoiPercent >= 0 ? "+" : ""}{blendedRoiPercent.toFixed(0)}%
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-teal-700 dark:text-teal-400 bg-teal-50/30 dark:bg-teal-950/30 border-r border-slate-200 dark:border-slate-800">
                          {formatMoney(totalRealizedSavings)}
                          <div className="text-[11px] font-normal text-teal-800/80 dark:text-teal-300/80">
                            %{realizedVsPotentialPercent.toFixed(1)} Gerçekleşme
                          </div>
                        </td>
                        <td colSpan={3} className="py-3.5 px-4 text-center font-sans font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/40">
                          Net EBITDA Katkısı: +{operatingProfitPercentIncrease.toFixed(1)}% (Kâr Marjı: %{operatingProfitPercent.toFixed(1)} &rarr; %{(operatingProfitPercent + (effectiveRevenue > 0 ? (totalAverageRecovery / effectiveRevenue * 100) : 0)).toFixed(1)})
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FOOTNOTE / ACADEMIC & BENCHMARK METHODOLOGY REFERENCE BOX */}
              <div className={`p-6 rounded-2xl border transition-all ${
                isDarkMode ? "bg-slate-900/90 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span>Dipnot: İyileştirme Oranlarının Kaynağı ve Güvenilir Veri Metodolojisi</span>
                        <span className="text-[11px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-extrabold border border-indigo-200 dark:border-indigo-800">
                          Akademik & Sanayi Standartları
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        Yukarıdaki matriste kullanılan geri kazanım ve tasarruf katsayıları, imalat sanayinde küresel kabul görmüş WCM (World Class Manufacturing) Cost Deployment yöntemleri ve bağımsız araştırma kurumlarının imalat performans veri tabanlarından türetilmiştir.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* Box 1 */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10.5px]">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          1. WCM Cost Deployment (Yamashina Metodolojisi)
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 leading-normal">
                          Prof. Hajime Yamashina tarafından geliştirilen WCM Cost Deployment standardına göre, her kayıp türü (Hurda, Setup, Duruş, Verimsizlik) doğrudan ilgili imalat maliyet bütçesine (Direkt Malzeme, İşçilik, Amortisman) bağlanır ve Kaizen projeleriyle ilk yılda ortalama <strong>%15 - %35</strong> oranında bertaraf edilebilir.
                        </p>
                      </div>

                      {/* Box 2 */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10.5px]">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          2. Lean Enterprise Institute (LEI) Sektör Benchmarkları
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 leading-normal">
                          500+ otomotiv, beyaz eşya ve makine fabrikasının kaizen çıktılarından elde edilen ortalama tasarruf aralıkları:
                          <br />• <strong>Poka-Yoke & Kalite:</strong> %15 - %25 Hurda/Fire düşüşü.
                          <br />• <strong>SMED:</strong> %20 - %40 Kalıp değişim süresi kazanımı.
                          <br />• <strong>TPM:</strong> %15 - %30 OEE & Duruş önleme kapasitesi.
                        </p>
                      </div>

                      {/* Box 3 */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10.5px]">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          3. Dinamik Tesis Olgunluk Katsayısı (f)
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 leading-normal">
                          Geri kazanım oranları tesisinizin <strong>OPEX Olgunluk Seviyesi (%{opexMaturity})</strong> ve <strong>Mevcut OEE (%{avgOee > 0 ? avgOee.toFixed(1) : "60.0"})</strong> değerlerine göre dinamik olarak ölçeklenir. Düşük olgunluktaki tesislerde "düşük asılı meyve" potansiyeli yüksek olduğu için oranlar üst banda yaklaşır.
                        </p>
                      </div>

                      {/* Box 4 */}
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10.5px]">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          4. Kullanıcı Tarafından Elle Düzenleme
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 leading-normal">
                          Fabrikanızın özel kaizen hedeflerine veya geçmiş proje tecrübelerine göre tablodaki <strong>İyileştirme Oranı (%)</strong> hücresine tıklayarak Min/Max yüzdelerini değiştirebilirsiniz. Yapılan değişiklikler anında Ürün Maliyet Modeline ve EBITDA hesabına yansır.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

        {/* TAB 5: WHAT-IF SIMULATION */}
        {activeTab === "tpm_loss" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border rounded-2xl p-6 space-y-4 bg-white border-slate-200 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b pb-4">
                <div className="space-y-1 max-w-4xl">
                  <h3 className="text-base font-black uppercase tracking-tight text-rose-900 flex items-center">
                    <Wrench className="w-5 h-5 mr-2" />
                    Loss Cost Analizi (16 Büyük Kayıp)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    İstasyonun OEE'si varsa (VSM ölçümü ya da tüm girdileri tamam olan Loss hesabı) OEE kaybı yükleme süresi × (1 − OEE) olarak alınır ve dağıtılır: kullanılabilirlik kaybı → arıza, setup ve ayar, takım değişimi, başlangıç; performans kaybı → küçük duruş, kalanı hız kaybı; kalite kaybı → hata ve yeniden işleme. Ölçülen süreler kaybı aşarsa oranlanır, açıklanamayan kalan "dağıtılamayan OEE kaybı" olarak ayrı görünür. İnsan ve kaynak kayıpları ölçüm ya da aşağıdaki girişlerden gelir. Ekipman süresi makine saati × makine sayısı + işçilik saati × operatörle, insan kaybı işçilik saatiyle, verim kaybı birim malzemeyle fiyatlanır (Kayıp Birim Maliyetleri). Fiyatlanamayan kayıp toplama girmez.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-black uppercase text-slate-500">İstasyon</span>
                  <select
                    value={jipmStationFilter}
                    onChange={(e) => setJipmStationFilter(e.target.value)}
                    className="text-xs border rounded-lg px-2 py-1.5 bg-white"
                  >
                    <option value="all">Tümü ({jipmResults.length})</option>
                    {jipmResults.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              {jipmResults.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Maliyet tablosunda istasyon yok. VSM projesine proses girip kaydedin.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {jipmScope.map(r => (
                    <div key={r.id} className="p-3 rounded-xl border bg-slate-50 border-slate-200 text-[11px]">
                      <div className="font-black text-slate-800 truncate">{r.name}</div>
                      {r.oee !== null ? (
                        <div className="text-slate-600 mt-1">
                          OEE <span className="font-mono font-bold">%{r.oee.toFixed(1)}</span> <span className={`text-[9px] font-bold ${r.oeeSource === "VSM" ? "text-sky-600" : "text-slate-400"}`}>{r.oeeSource}</span>
                          <div>Yükleme {Math.round(r.loadingMinutesPerDay)} dk/gün · OEE kaybı {Math.round(r.oeeLossMinutesPerDay)} dk/gün</div>
                          {r.unexplainedMinutesPerDay > 0.05 && <div className="text-amber-700">Dağıtılamayan: {r.unexplainedMinutesPerDay.toFixed(1)} dk/gün</div>}
                        </div>
                      ) : (
                        <div className="italic text-amber-600 mt-1">OEE girilmedi — dağıtım yok</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* LOSS × COST ELEMENT MATRIX */}
            <div className="border rounded-2xl p-6 space-y-3 bg-white border-slate-200 shadow-sm">
              <span className="font-extrabold text-[10px] uppercase text-rose-800 tracking-wider block border-b pb-2">
                Kayıp × Maliyet Unsuru Matrisi (yıllık, {currencySymbol})
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] font-extrabold uppercase text-slate-500">
                      <th className="py-2 px-2">No</th>
                      <th className="py-2 px-2">Kayıp</th>
                      <th className="py-2 px-2">Grup</th>
                      <th className="py-2 px-2 text-right">Süre / gün</th>
                      <th className="py-2 px-2">Kaynak</th>
                      <th className="py-2 px-2 text-right">İşçilik</th>
                      <th className="py-2 px-2 text-right">Makine</th>
                      <th className="py-2 px-2 text-right">Malzeme</th>
                      <th className="py-2 px-2 text-right">Enerji / Takım</th>
                      <th className="py-2 px-2 text-right font-black text-slate-800">Toplam</th>
                      <th className="py-2 px-2 text-right" title="Plana göre eksik üretim varsa, kayıp sürede üretilebilecek adet × katkı payı (şirket kartı). Toplama dahil değildir.">Kayıp katkı payı*</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {jipmTotals.map(t => {
                      const timeText = t.def.no <= 8
                        ? (t.minutesPerDay > 0 ? `${t.minutesPerDay.toFixed(1)} dk` : "—")
                        : t.def.no <= 13 ? (t.personHoursPerDay > 0 ? `${t.personHoursPerDay.toFixed(1)} kişi-saat` : "—") : "—";
                      return (
                        <tr key={t.def.no} className={t.def.no === 9 || t.def.no === 14 ? "border-t-2 border-slate-200" : ""}>
                          <td className="py-1.5 px-2 font-mono text-slate-400">{t.def.no}</td>
                          <td className="py-1.5 px-2 font-bold text-slate-700">{t.def.name}</td>
                          <td className="py-1.5 px-2 text-slate-500">{t.def.group}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{timeText}</td>
                          <td className="py-1.5 px-2 text-[10px] text-slate-500">
                            {t.sources.length > 0 ? t.sources.join(", ") : <span className="italic text-slate-300">veri yok</span>}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono">{t.labor > 0 ? formatMoney(t.labor) : "—"}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{t.machine > 0 ? formatMoney(t.machine) : "—"}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{t.material > 0 ? formatMoney(t.material) : "—"}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{t.direct > 0 ? formatMoney(t.direct) : "—"}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-black text-slate-900">
                            {t.total > 0 ? formatMoney(t.total) : t.unpricedAt.length > 0 ? <span className="italic font-normal text-amber-600" title={`Birim maliyet yok: ${t.unpricedAt.join(", ")}`}>hesaplanamadı</span> : "—"}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-500">{t.contribution > 0 ? formatMoney(t.contribution) : "—"}</td>
                          <td className="py-1.5 px-2 text-right">
                            {t.total > 0 && (
                              <button
                                onClick={() => handleOpenAssignModal({
                                  subject: `TPM ${t.def.no}. ${t.def.name}`,
                                  costGroup: `TPM — ${t.def.group} kayıpları`,
                                  severity: jipmGrandTotal > 0 && t.total / jipmGrandTotal >= 0.2 ? "High" : "Medium",
                                  investmentCost: 0,
                                  avgLoss: t.total,
                                  avgGain: 0,
                                  potentialGainMin: 0,
                                  potentialGainMax: 0,
                                  leanTool: t.def.tool
                                })}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 whitespace-nowrap cursor-pointer"
                                title="Kobetsu Kaizen projesi olarak CI Proje Yönetimi'ne ata"
                              >
                                CI'ye ata{kaizenCountBySubject[`TPM ${t.def.no}. ${t.def.name}`] ? ` (${kaizenCountBySubject[`TPM ${t.def.no}. ${t.def.name}`]})` : ""}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {jipmUnexplained.minutes > 0.05 && (
                      <tr className="bg-amber-50/40">
                        <td className="py-1.5 px-2"></td>
                        <td className="py-1.5 px-2 font-bold text-amber-800">Dağıtılamayan OEE kaybı</td>
                        <td className="py-1.5 px-2 text-slate-500">Ekipman</td>
                        <td className="py-1.5 px-2 text-right font-mono">{jipmUnexplained.minutes.toFixed(1)} dk</td>
                        <td className="py-1.5 px-2 text-[10px] text-slate-500">OEE − ölçülen kayıplar</td>
                        <td className="py-1.5 px-2" colSpan={4}></td>
                        <td className="py-1.5 px-2 text-right font-mono font-black">{jipmUnexplained.cost > 0 ? formatMoney(jipmUnexplained.cost) : "—"}</td>
                        <td className="py-1.5 px-2" colSpan={2}></td>
                      </tr>
                    )}
                    <tr className="bg-slate-900 text-white font-black">
                      <td className="py-2 px-2" colSpan={9}>TOPLAM YILLIK KAYIP MALİYETİ</td>
                      <td className="py-2 px-2 text-right font-mono">{formatMoney(jipmGrandTotal)}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatMoney(jipmTotals.reduce((acc, t) => acc + t.contribution, 0))}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400">
                * Kayıp katkı payı: istasyonun gerçekleşen üretimi planın altındaysa (talep var), ekipman kayıplarında (1–7) kaybedilen sürede ideal C/T ile üretilebilecek adet × birim katkı payı (ciro − malzeme − enerji) / yıllık adet; plan açığıyla sınırlanır. Doğrudan maliyete eklenmez, fırsat olarak gösterilir.
              </p>
            </div>

            {/* PARETO */}
            <div className="border rounded-2xl p-6 space-y-3 bg-white border-slate-200 shadow-sm">
              <span className="font-extrabold text-[10px] uppercase text-rose-800 tracking-wider block border-b pb-2">Kayıp Pareto'su</span>
              {jipmPareto.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Fiyatlanmış kayıp yok — Kayıp Birim Maliyetleri'ni ve istasyon verilerini tamamlayın.</p>
              ) : (() => {
                const total = jipmPareto.reduce((acc, t) => acc + t.total, 0);
                let cum = 0;
                return (
                  <div className="space-y-1.5">
                    {jipmPareto.map(t => {
                      cum += t.total;
                      const pct = total > 0 ? (t.total / total) * 100 : 0;
                      return (
                        <div key={t.def.no} className="grid grid-cols-[14rem_1fr_6rem_4rem] items-center gap-2 text-[11px]">
                          <span className="truncate font-bold text-slate-700">{t.def.no}. {t.def.name}</span>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-600 rounded-full" style={{ width: `${Math.max(1, pct)}%` }} />
                          </div>
                          <span className="text-right font-mono">{formatMoney(t.total)}</span>
                          <span className="text-right font-mono text-slate-400">%{(total > 0 ? (cum / total) * 100 : 0).toFixed(0)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* INPUTS FOR LOSSES VSM DOES NOT MEASURE */}
            <div className="border rounded-2xl p-6 space-y-3 bg-white border-slate-200 shadow-sm">
              <div className="border-b pb-2">
                <span className="font-extrabold text-[10px] uppercase text-rose-800 tracking-wider block">Ölçülmeyen kayıplar için giriş (istasyon başına, günlük)</span>
                <p className="text-[10px] text-slate-400">Arıza, setup, küçük duruş, bekleme, hurda ve norm fazlası VSM / Loss verisinden gelir. Küçük duruşu buradan girerseniz VSM değerinin yerine geçer. Değişiklikler otomatik kaydedilir.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] font-extrabold uppercase text-slate-500">
                      <th className="py-2 px-2">İstasyon</th>
                      <th className="py-2 px-2 text-center">Takım değişimi (dk)</th>
                      <th className="py-2 px-2 text-center">Başlangıç (dk)</th>
                      <th className="py-2 px-2 text-center">Küçük duruş (dk)</th>
                      <th className="py-2 px-2 text-center">Hareket (kişi-saat)</th>
                      <th className="py-2 px-2 text-center">Lojistik (kişi-saat)</th>
                      <th className="py-2 px-2 text-center">Ölçme / ayar (kişi-saat)</th>
                      <th className="py-2 px-2 text-center">Enerji kaybı ({currencySymbol}/yıl)</th>
                      <th className="py-2 px-2 text-center">Kalıp / takım ({currencySymbol}/yıl)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {calculatedProcesses.map(p => {
                      const inp = jipmInputs[p.id] ?? {};
                      const field = (key: keyof JipmStationInputs, placeholder = "girilmedi") => (
                        <td className="py-1.5 px-2 text-center">
                          <input
                            type="number"
                            min={0}
                            value={inp[key] ?? ""}
                            placeholder={placeholder}
                            onChange={(e) => updateJipmInput(p.id, key, e.target.value)}
                            className="w-20 text-center border rounded py-0.5 placeholder:italic placeholder:text-amber-600 placeholder:text-[10px]"
                          />
                        </td>
                      );
                      return (
                        <tr key={p.id}>
                          <td className="py-1.5 px-2 font-bold text-slate-700">{p.name}</td>
                          {field("toolChangeMinutesPerDay")}
                          {field("startupMinutesPerDay")}
                          {field("minorStopsMinutesPerDay", p.minorStopsMinutesPerDay !== undefined ? `VSM: ${p.minorStopsMinutesPerDay}` : "girilmedi")}
                          {field("motionPersonHoursPerDay")}
                          {field("logisticsPersonHoursPerDay")}
                          {field("measurementPersonHoursPerDay")}
                          {field("energyLossPerYear")}
                          {field("dieToolLossPerYear")}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {jipmScope.some(r => r.warnings.length > 0) && (
              <div className="border rounded-2xl p-4 bg-amber-50/40 border-amber-200 text-[10px] text-amber-800 space-y-1">
                {jipmScope.flatMap(r => r.warnings.map((w, i) => <div key={`${r.id}_${i}`}><strong>{r.name}:</strong> {w}</div>))}
              </div>
            )}
          </div>
        )}

        {activeTab === "simulation" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* SCOPE & HEADER BANNER */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <span className="p-3 bg-white/10 rounded-xl text-rose-400">
                  <Sliders className="w-6 h-6" />
                </span>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black uppercase tracking-wide">
                      What-If Simülasyonu &amp; İyileştirilmiş Ürün Maliyet Modeli
                    </h3>
                    <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold px-2 py-0.5 rounded-md">
                      {costModelScope === "product_group" ? "VSM Ürün Grubu Scope" : "Fabrika Geneli Scope"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {costModelScope === "product_group" && selectedVsmProject ? (
                      <>Seçili VSM Ürün Grubu: <strong className="text-white">{selectedVsmProject.projectName || selectedVsmProject.name}</strong> (Ciro Payı: %{productVolumeShare} &rarr; Model Cirosu: {formatMoney(effectiveRevenue)})</>
                    ) : (
                      <>Fabrika Geneli Konsolide Ciro (%100 Pay &rarr; Model Cirosu: {formatMoney(effectiveRevenue)})</>
                    )}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsVsmFilterOpen(true)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Filter className="w-4 h-4 text-rose-300" />
                <span>Scope / Ürün Grubu Değiştir</span>
              </button>
            </div>

            {/* TOP KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wide block">Net Finansal Kazanım (EBITDA)</span>
                <span className="text-xl font-black font-mono text-emerald-700 mt-1 block">
                  +{formatMoney(simulatedCostModel.totalNetGain)}
                </span>
                <span className="text-[10.5px] font-bold text-emerald-800 mt-1 block">
                  EBITDA: %{operatingProfitPercent.toFixed(1)} &rarr; %{simulatedCostModel.operatingProfitPercentSim.toFixed(1)} (+{(simulatedCostModel.operatingProfitPercentSim - operatingProfitPercent).toFixed(1)} Puan)
                </span>
              </div>

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200">
                <span className="text-[10px] text-indigo-800 font-extrabold uppercase tracking-wide block">İmalat Maliyeti Tasarrufu</span>
                <span className="text-xl font-black font-mono text-indigo-700 mt-1 block">
                  -{formatMoney(simulatedCostModel.totalProductCostSavings)}
                </span>
                <span className="text-[10.5px] font-bold text-indigo-800 mt-1 block">
                  Maliyet Payı: %{(directMaterialPercent + directLaborPercent + energyPercent + maintenancePercent + overheadPercent).toFixed(1)} &rarr; %{(simulatedCostModel.simMaterialPercent + simulatedCostModel.simLaborPercent + simulatedCostModel.simOverheadPercent).toFixed(1)}
                </span>
              </div>

              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200">
                <span className="text-[10px] text-rose-800 font-extrabold uppercase tracking-wide block">Malzeme &amp; İşçilik Tasarrufu</span>
                <span className="text-xl font-black font-mono text-rose-700 mt-1 block">
                  -{formatMoney(simulatedCostModel.scrapSavings + simulatedCostModel.totalLaborSavings)}
                </span>
                <span className="text-[10.5px] font-bold text-rose-800 mt-1 block">
                  Hurda: -{formatMoney(simulatedCostModel.scrapSavings)} | İşçilik: -{formatMoney(simulatedCostModel.totalLaborSavings)}
                </span>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                <span className="text-[10px] text-amber-800 font-extrabold uppercase tracking-wide block">Lead Time &amp; Sermaye Kazanımı</span>
                <span className="text-xl font-black font-mono text-amber-700 mt-1 block">
                  +{formatMoney(simulatedCostModel.leadTimeSavings)}
                </span>
                <span className="text-[10.5px] font-bold text-amber-800 mt-1 block">
                  Stok / Çevrim Hızlandırma (%{simLeadTimeAccel})
                </span>
              </div>
            </div>

            {/* UPPER SECTION: IMPROVED PRODUCT COST TABLE & SIDE-BY-SIDE PIE CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* TABLE: IMPROVED PRODUCT COST MODEL */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Award className="w-4 h-4 text-indigo-600" />
                      İyileştirilmiş Ürün Maliyet Modeli Tablosu
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Geri kazanım parametreleri hayata geçtiğinde ürün birim maliyet kalemlerindeki net değişim.
                    </p>
                  </div>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg border border-indigo-200">
                    Model Cirosu: {formatMoney(effectiveRevenue)}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-900 text-white font-black text-[10px] tracking-wide uppercase">
                        <th className="py-3 px-3 border-r border-slate-800">Maliyet Kalemi</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-right">Mevcut Tutar &amp; Oran</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-right text-emerald-400">Simüle Edilen Tasarruf</th>
                        <th className="py-3 px-3 border-r border-slate-800 text-right">İyileştirilmiş Tutar &amp; Oran</th>
                        <th className="py-3 px-3 text-center">İlgili Yalın Sürgü</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-sans">
                      
                      {/* 1. Direkt Malzeme */}
                      <tr className="hover:bg-slate-50/70 transition-all">
                        <td className="py-3 px-3 font-bold text-slate-900">
                          <div>Direkt Malzeme Giderleri</div>
                          <div className="text-[9.5px] text-slate-400 font-normal">Hammadde, yarı mamul &amp; fire</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <div className="font-bold text-slate-800">{formatMoney(simulatedCostModel.directMaterialOrig)}</div>
                          <div className="text-[9.5px] text-slate-400">%{directMaterialPercent.toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 bg-emerald-50/20">
                          -{formatMoney(simulatedCostModel.scrapSavings)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/10">
                          <div>{formatMoney(simulatedCostModel.directMaterialSim)}</div>
                          <div className="text-[9.5px] text-indigo-600">%{simulatedCostModel.simMaterialPercent.toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[9.5px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Hurda Azaltımı: -%{simScrap}
                          </span>
                        </td>
                      </tr>

                      {/* 2. Direkt İşçilik */}
                      <tr className="hover:bg-slate-50/70 transition-all">
                        <td className="py-3 px-3 font-bold text-slate-900">
                          <div>Direkt İşçilik Giderleri</div>
                          <div className="text-[9.5px] text-slate-400 font-normal">İşçilik, verimsizlik &amp; fazla mesai</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <div className="font-bold text-slate-800">{formatMoney(simulatedCostModel.directLaborOrig)}</div>
                          <div className="text-[9.5px] text-slate-400">%{directLaborPercent.toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 bg-emerald-50/20">
                          -{formatMoney(simulatedCostModel.totalLaborSavings)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/10">
                          <div>{formatMoney(simulatedCostModel.directLaborSim)}</div>
                          <div className="text-[9.5px] text-indigo-600">%{simulatedCostModel.simLaborPercent.toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[9.5px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            FM: -%{simOvertimeRed} | Üretkenlik: +%{simLaborOpt}
                          </span>
                        </td>
                      </tr>

                      {/* 3. Genel Üretim Overhead */}
                      <tr className="hover:bg-slate-50/70 transition-all">
                        <td className="py-3 px-3 font-bold text-slate-900">
                          <div>Genel Üretim Overhead</div>
                          <div className="text-[9.5px] text-slate-400 font-normal">Enerji, bakım &amp; sabit duruş yükü</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <div className="font-bold text-slate-800">{formatMoney(simulatedCostModel.totalOverheadOrig)}</div>
                          <div className="text-[9.5px] text-slate-400">%{(energyPercent + maintenancePercent + overheadPercent).toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 bg-emerald-50/20">
                          -{formatMoney(simulatedCostModel.totalOverheadSavings)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/10">
                          <div>{formatMoney(simulatedCostModel.totalOverheadSim)}</div>
                          <div className="text-[9.5px] text-indigo-600">%{simulatedCostModel.simOverheadPercent.toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[9.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            SMED: -%{simSetup} | OEE: +%{simOee}
                          </span>
                        </td>
                      </tr>

                      {/* TOTAL PRODUCT COST ROW */}
                      <tr className="bg-slate-100 font-black text-slate-900 border-t border-b border-slate-300">
                        <td className="py-3 px-3 uppercase text-xs">
                          Toplam İmalat Maliyeti
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <div>{formatMoney(simulatedCostModel.totalProductCostOrig)}</div>
                          <div className="text-[9.5px] font-normal text-slate-500">%{(directMaterialPercent + directLaborPercent + energyPercent + maintenancePercent + overheadPercent).toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-700 bg-emerald-100/60">
                          -{formatMoney(simulatedCostModel.totalProductCostSavings)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-indigo-800 bg-indigo-100/60">
                          <div>{formatMoney(simulatedCostModel.totalProductCostSim)}</div>
                          <div className="text-[9.5px] font-normal text-indigo-700">%{(simulatedCostModel.simMaterialPercent + simulatedCostModel.simLaborPercent + simulatedCostModel.simOverheadPercent).toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-3 text-center text-[10px] text-slate-600 font-bold">
                          Maliyet Düşüşü: %{simulatedCostModel.totalProductCostOrig > 0 ? (((simulatedCostModel.totalProductCostSavings) / simulatedCostModel.totalProductCostOrig) * 100).toFixed(1) : 0}
                        </td>
                      </tr>

                      {/* 4. Faaliyet Kârı (EBITDA) */}
                      <tr className="bg-emerald-50/40 hover:bg-emerald-50/70 transition-all font-bold">
                        <td className="py-3 px-3 font-black text-emerald-900">
                          <div>Faaliyet Kârı (EBITDA)</div>
                          <div className="text-[9.5px] text-emerald-700 font-normal">Tüm kaizen projelerinin net kâr katkısı</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-800">
                          <div>{formatMoney(simulatedCostModel.operatingProfitOrig)}</div>
                          <div className="text-[9.5px] text-slate-500">%{operatingProfitPercent.toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 bg-emerald-100">
                          +{formatMoney(simulatedCostModel.totalNetGain)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-800 bg-emerald-200/50">
                          <div>{formatMoney(simulatedCostModel.operatingProfitSim)}</div>
                          <div className="text-[9.5px] text-emerald-800">%{simulatedCostModel.operatingProfitPercentSim.toFixed(1)}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                            +{(simulatedCostModel.operatingProfitPercentSim - operatingProfitPercent).toFixed(1)} Puan EBITDA
                          </span>
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>
              </div>

              {/* PIE CHARTS: MEVCUT VS İYİLEŞTİRİLMİŞ ÜRÜN MALİYET DAĞILIMI */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-indigo-600" />
                    Ürün Maliyet Yapısı Karşılaştırması
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Mevcut vs İyileştirilmiş ürün maliyet payı pasta grafikleri.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 my-auto">
                  
                  {/* CHART 1: MEVCUT */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-black text-slate-700 uppercase block mb-1">Mevcut Maliyet Yapısı</span>
                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={simulatedCostModel.pieDataOriginal}
                            cx="50%"
                            cy="50%"
                            innerRadius={28}
                            outerRadius={46}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {simulatedCostModel.pieDataOriginal.map((entry, index) => (
                              <Cell key={`cell-orig-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: any) => [formatMoney(value), "Miktar"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-[10px] font-bold text-slate-600 mt-1">
                      Faaliyet Kârı: <span className="text-emerald-600 font-mono">%{operatingProfitPercent.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* CHART 2: İYİLEŞTİRİLMİŞ */}
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[10px] font-black text-emerald-900 uppercase block mb-1">İyileştirilmiş Maliyet Yapısı</span>
                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={simulatedCostModel.pieDataSimulated}
                            cx="50%"
                            cy="50%"
                            innerRadius={28}
                            outerRadius={46}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {simulatedCostModel.pieDataSimulated.map((entry, index) => (
                              <Cell key={`cell-sim-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: any) => [formatMoney(value), "Miktar"]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-[10px] font-black text-emerald-800 mt-1">
                      İyileştirilmiş Kâr: <span className="text-emerald-700 font-mono">%{simulatedCostModel.operatingProfitPercentSim.toFixed(1)}</span>
                    </div>
                  </div>

                </div>

                {/* LEGEND BOX */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                    <span className="text-slate-600 font-medium">Direkt Malzeme: <strong className="font-mono text-slate-800">%{directMaterialPercent.toFixed(1)} &rarr; %{simulatedCostModel.simMaterialPercent.toFixed(1)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0"></span>
                    <span className="text-slate-600 font-medium">Direkt İşçilik: <strong className="font-mono text-slate-800">%{directLaborPercent.toFixed(1)} &rarr; %{simulatedCostModel.simLaborPercent.toFixed(1)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                    <span className="text-slate-600 font-medium">Overhead: <strong className="font-mono text-slate-800">%{(energyPercent + maintenancePercent + overheadPercent).toFixed(1)} &rarr; %{simulatedCostModel.simOverheadPercent.toFixed(1)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="text-slate-600 font-medium">EBITDA: <strong className="font-mono text-emerald-700">%{operatingProfitPercent.toFixed(1)} &rarr; %{simulatedCostModel.operatingProfitPercentSim.toFixed(1)}</strong></span>
                  </div>
                </div>

              </div>

            </div>

            {/* LOWER SECTION: SIMULATION INPUTS (SLIDERS) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-rose-700" />
                    Simülasyon Girdileri (Yalın &amp; WCM Dönüşüm Parametreleri)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sürgüleri kaydırarak fabrikanızın hedeflerine göre imalat maliyet modeli ve EBITDA etkisini canlı simüle edin.
                  </p>
                </div>
                <button
                  onClick={handleResetSliders}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Varsayılan Sürgülere Sıfırla</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                
                {/* Slider 1: SMED Setup Süresi Azaltımı */}
                <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      SMED Setup Süresi Azaltımı (%)
                    </span>
                    <span className="font-black text-rose-700 font-mono bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      -%{simSetup}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="80"
                    value={simSetup}
                    onChange={(e) => setSimSetup(parseInt(e.target.value) || 0)}
                    className="w-full accent-rose-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9.5px] text-slate-400 font-mono">
                    <span>%0 (Mevcut)</span>
                    <span>%80 (Dünya Sınıfı SMED)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-200/80">
                    Genel Üretim Overhead ve kalıp değişim kapasite kaybını azaltır.
                  </div>
                </div>

                {/* Slider 2: Hurda Oranı Azaltımı */}
                <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      Hurda Oranı Azaltımı (%)
                    </span>
                    <span className="font-black text-rose-700 font-mono bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      -%{simScrap}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="90"
                    value={simScrap}
                    onChange={(e) => setSimScrap(parseInt(e.target.value) || 0)}
                    className="w-full accent-rose-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9.5px] text-slate-400 font-mono">
                    <span>%0 (Mevcut)</span>
                    <span>%90 (Sıfır Hata Poka-Yoke)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-200/80">
                    Direkt Malzeme Giderlerindeki hurda ve fire kayıplarını doğrudan düşürür.
                  </div>
                </div>

                {/* Slider 3: OEE Artışı */}
                <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-600" />
                      OEE Artışı (%)
                    </span>
                    <span className="font-black text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      +%{simOee} Puan
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="25"
                    value={simOee}
                    onChange={(e) => setSimOee(parseInt(e.target.value) || 0)}
                    className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9.5px] text-slate-400 font-mono">
                    <span>+0 Puan</span>
                    <span>+25 Puan (TPM Otonom Bakım)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-200/80">
                    Plansız duruşları engelleyerek makine sabit overhead yükünü düşürür.
                  </div>
                </div>

                {/* Slider 4: İş Gücü Optimizasyonu & Üretkenlik Artırımı */}
                <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-indigo-600" />
                      İş Gücü Optimizasyonu &amp; Üretkenlik (%)
                    </span>
                    <span className="font-black text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      +%{simLaborOpt}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="50"
                    value={simLaborOpt}
                    onChange={(e) => setSimLaborOpt(parseInt(e.target.value) || 0)}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9.5px] text-slate-400 font-mono">
                    <span>%0 (Mevcut)</span>
                    <span>%50 (Yamazumi Hat Dengeleme)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-200/80">
                    Operasyonel verimsizliği azaltarak Direkt İşçilik birim maliyetini düşürür.
                  </div>
                </div>

                {/* Slider 5: Fazla Mesai Azaltımı */}
                <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-600" />
                      Fazla Mesai Azaltımı (%)
                    </span>
                    <span className="font-black text-rose-700 font-mono bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      -%{simOvertimeRed}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="80"
                    value={simOvertimeRed}
                    onChange={(e) => setSimOvertimeRed(parseInt(e.target.value) || 0)}
                    className="w-full accent-rose-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9.5px] text-slate-400 font-mono">
                    <span>%0 (Mevcut)</span>
                    <span>%80 (Heijunka Yük Dengeleme)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-200/80">
                    Direkt İşçilik bünyesindeki fazla mesai ek maliyet yükünü bertaraf eder.
                  </div>
                </div>

                {/* Slider 6: Lead Time Hızlandırma */}
                <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                      Lead Time Hızlandırma (%)
                    </span>
                    <span className="font-black text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      +%{simLeadTimeAccel}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="50"
                    value={simLeadTimeAccel}
                    onChange={(e) => setSimLeadTimeAccel(parseInt(e.target.value) || 0)}
                    className="w-full accent-amber-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9.5px] text-slate-400 font-mono">
                    <span>%0 (Mevcut)</span>
                    <span>%50 (VSM Akış &amp; Kanban)</span>
                  </div>
                  <div className="text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-200/80">
                    Sipariş çevrim süresini ve WIP stok taşıma maliyetini düşürür.
                  </div>
                </div>

              </div>

              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center gap-2 text-[11px] text-indigo-900">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Maliyet Bağlantı Notu:</strong> Sürgülerdeki değişiklikler COPQ (Kalitesizlik Maliyeti) ve VSM (Değer Akış Haritası) veri tabanı ile doğrudan senkronize biçimde Ürün Maliyet Modelindeki Malzeme, İşçilik, Overhead ve EBITDA kalemlerine yansımaktadır.
                </span>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* VSM PRODUCT GROUP FILTER MODAL (Cost Control Manager Tool) */}
      {isVsmFilterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-rose-900 via-rose-800 to-indigo-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <span className="p-2 bg-white/10 rounded-xl">
                  <Filter className="w-5 h-5 text-rose-200" />
                </span>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">
                    VSM Ürün Grubu Maliyet Modeli Seçimi
                  </h3>
                  <p className="text-xs text-rose-200/80">
                    Cost Control Uzmanı Kokpiti: Değer Akış Haritalama (VSM) projelerindeki ürün gruplarına göre maliyet modeli oluşturun.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsVsmFilterOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              
              <p className="text-xs text-slate-600 leading-relaxed bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                <strong>Model Çalışma Mantığı:</strong> VSM sayfasında tanımlanan fabrika seviyesi kurulum parametrelerindeki 
                <span className="font-bold text-rose-800"> "Ürünün Üretimdeki Payı (%)" </span> 
                metriği doğrudan finansal model ciro paylaşımında kullanılır. Örn: VSM&apos;de ürün payı %30 ise, cironun %30&apos;u baz alınarak Operasyonel Maliyet Kontrol Analizi oluşturulur.
              </p>

              {/* Option 1: Factory Wide */}
              <div 
                onClick={() => {
                  setCostModelScope("factory");
                  setSelectedVsmProject(null);
                  setProductVolumeShare(100);
                  setIsVsmFilterOpen(false);
                }}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                  costModelScope === "factory"
                    ? "border-rose-600 bg-rose-50/50 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`p-2.5 rounded-xl ${costModelScope === "factory" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Building2 className="w-5 h-5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase">Fabrika Geneli Modeli (%100 Ciro)</h4>
                    <p className="text-[11px] text-slate-500">Tüm fabrikanın konsolide ciro ve maliyet yapısını baz alır.</p>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs font-black text-rose-800 block">{formatMoney(annualRevenue)}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Pay: %100</span>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center">
                  <Crosshair className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  Müşteriye Ait VSM Projeleri &amp; Ürün Grupları:
                </h4>

                {vsmProjects.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 space-y-2">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">Bu müşteriye ait kayıtlı VSM Projesi bulunamadı.</p>
                    <p className="text-[11px] text-slate-400">VSM sayfasından yeni bir Değer Akış Projesi kaydedebilirsiniz.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {vsmProjects.map((proj) => {
                      // No assumed share: a project without "ürün grubu payı" models 0 revenue until it is entered in VSM.
                      const share = proj.factorySetup?.productVolumeShare || proj.productVolumeShare || 0;
                      const isSelected = costModelScope === "product_group" && selectedVsmProject?.id === proj.id;
                      const modelRev = annualRevenue * (share / 100);

                      return (
                        <div
                          key={proj.id}
                          onClick={() => {
                            setCostModelScope("product_group");
                            setSelectedVsmProject(proj);
                            setProductVolumeShare(share);
                            setIsVsmFilterOpen(false);
                          }}
                          className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/50 shadow-md"
                              : "border-slate-200 hover:border-indigo-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <span className={`p-2.5 rounded-xl shrink-0 ${isSelected ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
                              <Target className="w-5 h-5" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2">
                                <h4 className="text-xs font-black text-slate-900 truncate uppercase">{proj.projectName || proj.name}</h4>
                                <span className="text-[11px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-bold shrink-0">
                                  {proj.productGroup || "Ürün Grubu"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                Hedef Takt Time: {proj.taktTime ? `${proj.taktTime} sn` : "—"} | Tesis: {proj.factorySetup?.factoryName || selectedCustomer?.companyName || "—"}
                              </p>
                            </div>
                          </div>

                          <div className="text-right font-mono shrink-0 pl-3">
                            <span className="text-xs font-black text-indigo-700 block">{formatMoney(modelRev)}</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md inline-block uppercase font-sans mt-0.5">
                              Ürün Payı: %{share}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setIsVsmFilterOpen(false)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs rounded-xl transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ASSIGN RECOVERY MATRIX ITEM AS A CI PROJECT */}
      {assignModalRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            <div className="p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <span className="p-2 bg-white/10 rounded-xl">
                  <Target className="w-5 h-5 text-indigo-200" />
                </span>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">
                    İyileştirme Projesi Olarak Ata
                  </h3>
                  <p className="text-xs text-indigo-200/80">
                    {assignModalRow.subject} — CI Proje Yönetimi&apos;ne gerçek bir proje olarak oluşturulacak
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalRow(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <div><strong>Yıllık Kayıp:</strong> {formatMoney(assignModalRow.avgLoss)}</div>
                <div><strong>Ortalama Beklenen Tasarruf:</strong> {formatMoney(assignModalRow.avgGain)}</div>
                <div><strong>Önerilen Yalın Araç:</strong> {assignModalRow.leanTool}</div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Sorumlu Kişi *</label>
                <input
                  type="text"
                  value={assignLeader}
                  onChange={(e) => setAssignLeader(e.target.value)}
                  placeholder="Örn. Mustafa Çelik (Usta)"
                  className="w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-transparent dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Departman</label>
                <input
                  type="text"
                  value={assignDepartment}
                  onChange={(e) => setAssignDepartment(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-transparent dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Hedef Bitiş Tarihi</label>
                <input
                  type="date"
                  value={assignDeadline}
                  onChange={(e) => setAssignDeadline(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-transparent dark:border-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setAssignModalRow(null)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black text-xs rounded-xl transition-all cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleSubmitAssignProject}
                disabled={!assignLeader.trim() || isAssigningProject}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isAssigningProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Projeyi Oluştur ve Ata
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ASSIGN SUCCESS TOAST */}
      {assignSuccessMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="w-4 h-4" />
          {assignSuccessMessage}
        </div>
      )}

    </div>
  );
}
