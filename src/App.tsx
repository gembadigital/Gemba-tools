import React, { useState, useEffect, useCallback } from "react";
import gembaGIcon from "./assets/images/gemba_g_icon.png";
import gembaDigitalWordmark from "./assets/images/gemba_digital_wordmark.png";
import {
  Customer, ProcessRecord, GanttActivity, FlowSegment, KaizenCard
} from "./types";
import { FactoryProvider } from "./context/FactoryContext";

// Import modules
import CustomerRecords from "./components/CustomerRecords";
import MasterPlanGantt from "./components/MasterPlanGantt";
import FlowImprovement from "./components/FlowImprovement";
import KaizenManager from "./components/KaizenManager";
import FiveSAuditSystem from "./components/fiveS/FiveSAuditSystem";
import LineBalancing from "./components/LineBalancing";
import PtrTimeStudy from "./components/PtrTimeStudy";
import ExecutiveDashboard from "./components/ExecutiveDashboard";
import TimeStudyPage from "./components/TimeStudyPage";
import LossAnalysis from "./components/LossAnalysis";
import SmedPage from "./components/SmedPage";
import VsmPage from "./components/VsmPage";
import OpexAssessment from "./components/OpexAssessment";

// New Auth and Admin modules
import AuthScreen from "./components/AuthScreen";
import UserProfileModal from "./components/UserProfileModal";
import PlatformAdminConsole from "./components/PlatformAdminConsole";

import { 
  Building2, Users, BarChart3, Clock, Map, Sparkles, 
  Settings, FolderKanban, ShieldCheck, AlignLeft, LayoutDashboard, 
  HelpCircle, CheckCircle2, ChevronRight, ChevronLeft, Loader2, RefreshCw, FileText,
  UserCheck, User, LogOut, Lock, Percent, GitCommit, Layers, Award, Cog, Menu, X
} from "lucide-react";

type MenuTab = "customers" | "plan" | "flow" | "vsm" | "kaizen" | "fives" | "balancing" | "ptr" | "dashboard" | "loss-analysis" | "timestudy" | "smed" | "opex-assessment";

export default function App() {
  // STATE GATEKEEPER REPRESENTATIONS
  // isAuthorized: null = still checking the stored session, false = no valid session (show
  // login), true = confirmed valid session. Previously this started `true` unconditionally and
  // auto-provisioned a default admin token if none existed — meaning anyone who opened the app,
  // with zero credentials, was silently logged in as the Arçelik admin. There was no real login
  // gate and "sign out" merely reset back to that same default account.
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";
  });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentOrg, setCurrentOrg] = useState<any>(null);
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAdminConsoleOpen, setIsAdminConsoleOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // MULTI-LANGUAGE SUPPORT (TR, EN, DE)
  const [currentLang, setCurrentLang] = useState<"tr" | "en" | "de">(() => {
    return (localStorage.getItem("gemba_lang") as "tr" | "en" | "de") || "tr";
  });

  const changeLanguage = (lang: "tr" | "en" | "de") => {
    setCurrentLang(lang);
    localStorage.setItem("gemba_lang", lang);
  };

  const menuTranslations = {
    tr: {
      activeFactory: "AKTİF FABRİKA:",
      selectModule: "MODÜL SEÇİNİZ",
      customers: "Müşteri Kartı",
      dashboard: "Executive Dashboard",
      opexAssessment: "OpEx Assessment",
      plan: "Proje Master Plan",
      vsm: "VSM Kapasite Analizi",
      lossAnalysis: "Loss Capacity Analizi",
      timestudy: "Çevrim Süresi Etüdü",
      balancing: "Hat Dengeleme & Yamazumi",
      smed: "SMED Model Değişim",
      kaizen: "Kaizen Yönetimi",
      fives: "5S İyileştirme",
      flow: "Akış / Spagetti Düzeni",
      architecture: "Kurumsal Mimari",
      adminUsers: "Kullanıcı Yönetimi",
      roleAdmin: "YÖNETİCİ",
      roleConsultant: "DANIŞMAN",
      roleCustomerUser: "MÜŞTERİ KULLANICISI"
    },
    en: {
      activeFactory: "ACTIVE FACTORY:",
      selectModule: "SELECT MODULE",
      customers: "Customer Records",
      dashboard: "Executive Dashboard",
      opexAssessment: "OpEx Assessment",
      plan: "Project Master Plan",
      vsm: "VSM Capacity Analysis",
      lossAnalysis: "Loss Capacity Analysis",
      timestudy: "Cycle Time Study",
      balancing: "Line Balancing & Yamazumi",
      smed: "SMED Changeover",
      kaizen: "Kaizen Management",
      fives: "5S Audit & Improvement",
      flow: "Flow & Spaghetti Layout",
      architecture: "Enterprise Architecture",
      adminUsers: "User Management",
      roleAdmin: "ADMINISTRATOR",
      roleConsultant: "CONSULTANT",
      roleCustomerUser: "CUSTOMER USER"
    },
    de: {
      activeFactory: "AKTIVE FABRIK:",
      selectModule: "MODUL WÄHLEN",
      customers: "Kundenkartei",
      dashboard: "Vorstands-Dashboard",
      opexAssessment: "OpEx-Bewertung",
      plan: "Projekt-Masterplan",
      vsm: "VSM-Kapazitätsanalyse",
      lossAnalysis: "Verlustkapazitätsanalyse",
      timestudy: "Zykluszeitstudie",
      balancing: "Linienabstimmung & Yamazumi",
      smed: "SMED-Rüstzeitoptimierung",
      kaizen: "Kaizen-Management",
      fives: "5S-Audit & Optimierung",
      flow: "Fluss & Spaghetti-Diagramm",
      architecture: "Unternehmensarchitektur",
      adminUsers: "Benutzerverwaltung",
      roleAdmin: "ADMINISTRATOR",
      roleConsultant: "BERATER",
      roleCustomerUser: "KUNDENBENUTZER"
    }
  };

  const t = menuTranslations[currentLang];

  // PRIMARY ACTION PANEL ACTIVE TAB
  const [activeTab, setActiveTab] = useState<MenuTab>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("gemba_sidebar_collapsed") === "true";
  });
  // Off-canvas nav drawer for narrow (mobile/tablet) viewports — the sidebar is fixed-width and
  // was previously always in normal flow, so on small screens it pushed all page content into a
  // horizontal scroll instead of collapsing into a toggleable drawer.
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Icon-only "collapsed" mode is a desktop-only preference — on mobile the drawer always shows
  // full labels, regardless of what was last chosen on desktop, since icon-only makes no sense
  // inside a temporary overlay.
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const effectivelyCollapsed = isSidebarCollapsed && isDesktop;

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("gemba_sidebar_collapsed", String(next));
      return next;
    });
  };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  // BUSINESS LOGICAL DATA REPRESENTATIONS
  const [processes, setProcesses] = useState<ProcessRecord[]>([]);
  const [activities, setActivities] = useState<GanttActivity[]>([]);
  const [segments, setSegments] = useState<FlowSegment[]>([]);
  const [kaizens, setKaizens] = useState<KaizenCard[]>([]);
  // Read-only cache of 5S Audit headers (owned/mutated by the FiveSAuditSystem module itself) —
  // only kept here so Master Plan can offer a "5S Audits" link target for its progress-sync logic.
  const [audits5S, setAudits5S] = useState<any[]>([]);

  // AI STATUS STRIP HANDLERS
  const [reportText, setReportText] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // STARTUP ORCHESTRATION HANDLER
  useEffect(() => {
    // 1. Intercept invitation parameter tokens automatically
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setInviteToken(t);
    }

    // 2. Resolve any existing session — only ever grant access if the server actually confirms
    // the stored token is a valid, unexpired session for a real user. No token → no auto-login.
    const savedToken = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token");

    if (!savedToken) {
      setIsAuthorized(false);
      return;
    }

    setToken(savedToken);
    fetch("/api/auth/me", {
      headers: { "Authorization": `Bearer ${savedToken}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setCurrentUser(data.user);
        setCurrentOrg(data.organization);
        setIsAuthorized(true);
      } else {
        localStorage.removeItem("gemba_token");
        sessionStorage.removeItem("gemba_token");
        setIsAuthorized(false);
      }
    })
    .catch(() => {
      // Network/server issue — never fall back to "authorized" on an inconclusive check.
      setIsAuthorized(false);
    });
  }, []);

  // SYNCHRONIZED TENANT BUSINESS FETCH ENGINE
  const fetchTenantData = () => {
    if (!token) return;
    const baseHeaders = { "Authorization": `Bearer ${token}` };

    // 1. Fetch customers list first
    fetch("/api/business/customers", { headers: baseHeaders })
      .then(res => res.json())
      .then(custRes => {
        if (custRes.success) {
          setCustomers(custRes.data);
          
          // 2. Resolve active factory ID from local storage scoped to this user
          const storedKey = `gemba_active_factory_id_${currentUser?.id || "default"}`;
          const storedId = localStorage.getItem(storedKey);
          let activeId = "";
          
          if (storedId && custRes.data.some((c: any) => c.id === storedId)) {
            activeId = storedId;
          } else if (custRes.data.length > 0) {
            activeId = custRes.data[0].id;
          }
          
          if (activeId) {
            setSelectedCustomerId(activeId);
          }
        }
      })
      .catch((err) => {
        console.error("Critical: Failed to sync workspace records.", err);
      });
  };

  // Lightweight re-fetch of just the customer list (e.g. after a consultant/customer-user
  // assignment changes a customer's team fields server-side) — does not touch the active selection.
  const refreshCustomers = () => {
    if (!token) return;
    fetch("/api/business/customers", { headers: { "Authorization": `Bearer ${token}` } })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setCustomers(res.data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (isAuthorized && token) {
      fetchTenantData();
    }
  }, [isAuthorized, token]);

  // Reloads all factory-scoped data for the currently selected customer. Used both on factory
  // switch and as a manual refresh (see "gemba:refresh-factory-data" listener below) — modules
  // like VsmPage/PtrTimeStudy/LossAnalysis write to these same backend rows directly and need a
  // way to tell App.tsx to re-fetch without actually changing the selected factory.
  const refreshFactoryData = useCallback(() => {
    if (isAuthorized && token && selectedCustomerId) {
      const headers = {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomerId
      };

      Promise.all([
        fetch("/api/business/processes", { headers }).then(res => res.json()),
        fetch("/api/business/gantt", { headers }).then(res => res.json()),
        fetch("/api/business/segments", { headers }).then(res => res.json()),
        fetch("/api/business/kaizens", { headers }).then(res => res.json()),
        fetch("/api/business/five-s/audits", { headers }).then(res => res.json())
      ])
      .then(([procRes, ganttRes, segRes, kaiRes, audRes]) => {
        if (procRes.success) setProcesses(procRes.data);
        if (ganttRes.success) setActivities(ganttRes.data);
        if (segRes.success) setSegments(segRes.data);
        if (kaiRes.success) setKaizens(kaiRes.data);
        if (audRes.success) setAudits5S(audRes.data);

        // Publish the global event FactoryChanged
        window.dispatchEvent(new CustomEvent("FactoryChanged", { detail: { factoryId: selectedCustomerId } }));
      })
      .catch((err) => {
        console.error("Failed to reload factory-scoped data", err);
      });

      if (currentUser?.id) {
        localStorage.setItem(`gemba_active_factory_id_${currentUser.id}`, selectedCustomerId);
      }
    }
  }, [isAuthorized, token, selectedCustomerId, currentUser?.id]);

  // Reactive listener to reload factory-specific data when factory changes
  useEffect(() => {
    refreshFactoryData();
  }, [refreshFactoryData]);

  // Lets modules that write directly to the shared processes/kaizens backend rows (VSM, PTR,
  // Loss Analysis) request a refetch without needing an actual factory-id change.
  useEffect(() => {
    window.addEventListener("gemba:refresh-factory-data", refreshFactoryData);
    return () => window.removeEventListener("gemba:refresh-factory-data", refreshFactoryData);
  }, [refreshFactoryData]);

  const handleAuthSuccess = (newToken: string, user: any, organization: any) => {
    setToken(newToken);
    setCurrentUser(user);
    setCurrentOrg(organization);
    setIsAuthorized(true);
    // Clear url query token cleanly
    if (window.history.pushState) {
      const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.pushState({ path: newurl }, '', newurl);
    }
  };

  const handleSignOut = () => {
    // Actually sign out — previously this reset back to the same default admin account instead
    // of ending the session, so there was no real way to log out of this app.
    localStorage.removeItem("gemba_token");
    sessionStorage.removeItem("gemba_token");
    window.location.reload();
  };

  // Safe selected customer resolving (provides beautiful default empty states to welcome fresh registers)
  const selectedCustomer = (customers.find(c => c.id === selectedCustomerId) || customers[0] || {
    id: "none_default",
    companyName: "Yeni Tesis / Boş Çalışma Alanı",
    address: "Lütfen Müşteri Kartoteksine gidip yeni tesis ekleyin.",
    industry: "Tanımsız Sektör",
    productionType: "Tanımsız Operasyon",
    annualRevenue: 0,
    currency: "$",
    employeeCount: 0,
    mainContactPerson: "Atanmamış",
    mainContactEmail: "",
    copexScore: 0,
    notes: "Ortak çalışma alanınız için ilk fabrika verisini eklemek üzere Müşteri Kartoteksi sekmesine gidin.",
    audits: [],
    factoryManager: "",
    factoryManagerEmail: "",
    generalManager: "",
    generalManagerEmail: "",
    consultantName: "",
    consultantEmail: "",
    createdAt: "01.01.2026",
    projectName: "Yalın Dönüşüm Projesi"
  }) as Customer;

  // FULL-STACK MUTATION WRAPPER HANDLERS

  // 1. Customers
  const handleAddCustomer = async (newC: any) => {
    const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
    const res = await fetch("/api/business/customers", {
      method: "POST",
      headers,
      body: JSON.stringify(newC)
    }).then(r => r.json());
    if (res.success) {
      setCustomers(prev => [...prev, res.data]);
      setSelectedCustomerId(res.data.id);
      window.dispatchEvent(new CustomEvent("FactoryChanged", { detail: { factoryId: res.data.id } }));
    }
  };

  const handleUpdateCustomer = async (updC: any) => {
    const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
    const res = await fetch("/api/business/customers", {
      method: "POST",
      headers,
      body: JSON.stringify(updC)
    }).then(r => r.json());
    if (res.success) {
      setCustomers(prev => prev.map(c => c.id === res.data.id ? res.data : c));
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm("Bu tesisi ve ona ait değerlendirmeleri silmek istediğinizden emin misiniz?")) return;
    const headers = { "Authorization": `Bearer ${token}` };
    const res = await fetch(`/api/business/customers/${id}`, {
      method: "DELETE",
      headers
    }).then(r => r.json());
    if (res.success) {
      setCustomers(prev => prev.filter(c => c.id !== id));
      if (selectedCustomerId === id) {
        setSelectedCustomerId("");
      }
    }
  };

  // 3. Gantt Activities
  const handleAddActivity = async (act: any) => {
    const headers = { 
      "Authorization": `Bearer ${token}`, 
      "Content-Type": "application/json",
      "x-factory-id": selectedCustomerId 
    };
    const res = await fetch("/api/business/gantt", {
      method: "POST",
      headers,
      body: JSON.stringify(act)
    }).then(r => r.json());
    if (res.success) {
      setActivities(prev => [...prev, res.data]);
    }
  };

  const handleUpdateActivity = async (act: any) => {
    const headers = { 
      "Authorization": `Bearer ${token}`, 
      "Content-Type": "application/json",
      "x-factory-id": selectedCustomerId 
    };
    const res = await fetch("/api/business/gantt", {
      method: "POST",
      headers,
      body: JSON.stringify(act)
    }).then(r => r.json());
    if (res.success) {
      setActivities(prev => prev.map(item => item.id === res.data.id ? res.data : item));
    }
  };

  const handleDeleteActivity = async (id: string) => {
    const headers = { 
      "Authorization": `Bearer ${token}`,
      "x-factory-id": selectedCustomerId 
    };
    const res = await fetch(`/api/business/gantt/${id}`, {
      method: "DELETE",
      headers
    }).then(r => r.json());
    if (res.success) {
      setActivities(prev => prev.filter(a => a.id !== id));
    }
  };


  // 5. Kaizen Manager
  const handleAddKaizen = async (kaizen: any) => {
    const headers = { 
      "Authorization": `Bearer ${token}`, 
      "Content-Type": "application/json",
      "x-factory-id": selectedCustomerId 
    };
    const res = await fetch("/api/business/kaizens", {
      method: "POST",
      headers,
      body: JSON.stringify(kaizen)
    }).then(r => r.json());
    if (res.success) {
      setKaizens(prev => [...prev, res.data]);
    }
  };

  const handleUpdateKaizen = async (kaizen: any) => {
    const headers = { 
      "Authorization": `Bearer ${token}`, 
      "Content-Type": "application/json",
      "x-factory-id": selectedCustomerId 
    };
    const res = await fetch("/api/business/kaizens", {
      method: "POST",
      headers,
      body: JSON.stringify(kaizen)
    }).then(r => r.json());
    if (res.success) {
      setKaizens(prev => prev.map(item => item.id === res.data.id ? res.data : item));
    }
  };

  const handleDeleteKaizen = async (id: string) => {
    const headers = { 
      "Authorization": `Bearer ${token}`,
      "x-factory-id": selectedCustomerId 
    };
    const res = await fetch(`/api/business/kaizens/${id}`, {
      method: "DELETE",
      headers
    }).then(r => r.json());
    if (res.success) {
      setKaizens(prev => prev.filter(k => k.id !== id));
    }
  };

  const handleTriggerAiAudit = async () => {
    if (!token) return;

    setIsAiLoading(true);
    setAiError(null);
    setReportText(null);

    // Compute basic payload aggregates
    const bottleneck = [...processes].sort((a,b) => b.cycleTime - a.cycleTime)[0];

    try {
      const resp = await fetch("/api/gemini/audit", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          factoryData: {
            stations: processes.map(p => ({
              id: p.id,
              name: p.name,
              cycleTime: p.cycleTime,
              downtimeHours: p.downtimeCost / 15000, 
              scrapRate: p.scrapCost / 120000,
              overtimeHours: p.overtimeRatio * 10,
              excessHeadcount: p.excessLabor
            })),
            taktTime: 65, 
          },
          financials: {
            sector: selectedCustomer.industry || "General",
            turnover: selectedCustomer.annualRevenue || 10000000,
            headcount: selectedCustomer.employeeCount || 200,
            targetProfitPercent: 10,
            currency: selectedCustomer.currency || "$",
            overtimeHourlyRate: 250,
            excessOperatorAnnualCost: 450000,
            scrapUnitCost: 180,
            annualProductionVolume: 400000,
            downtimeHourlyCost: 15000
          },
          ganttActivities: activities,
          spaghettiData: {
            rawMaterialDistance: segments.filter(s => s.flowType === "Raw Material").reduce((acc, c) => acc + c.distanceMeters, 0),
            wipDistance: segments.filter(s => s.flowType === "WIP").reduce((acc, c) => acc + c.distanceMeters, 0),
            operatorDistance: 1200
          },
          calculatedMetrics: {
            taktTime: 65,
            bottleneckStation: bottleneck ? bottleneck.name : "N/A",
            bottleneckCycleTime: bottleneck ? bottleneck.cycleTime : 0,
            totalLossCost: processes.reduce((acc, p) => acc + p.scrapCost + p.downtimeCost, 0) || 120000,
            lossToTurnoverPercent: Math.round(((processes.reduce((acc, p) => acc + p.scrapCost + p.downtimeCost, 0) || 120000) / (selectedCustomer.annualRevenue || 10000000)) * 1000) / 10
          }
        })
      });

      const res = await resp.json();
      if (res.success) {
        setReportText(res.report);
      } else {
        setAiError(res.error || "Rapor oluşturulamadı. Lütfen sunucu bağlantısını doğrulayın.");
      }
    } catch (err: any) {
      setAiError(err.message || "Bilinmeyen sunucu bağlantı hatası.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const renderMarkdownText = (rawText: string) => {
    const lines = rawText.split("\n");
    return lines.map((line, index) => {
      if (line.startsWith("###")) {
        return (
          <h4 key={index} className="text-xs font-black text-gray-900 mt-4 mb-2 border-b border-slate-100 pb-1 uppercase tracking-wide">
            {line.replaceAll("###", "").trim()}
          </h4>
        );
      }
      if (line.startsWith("##")) {
        return (
          <h3 key={index} className="text-sm font-black text-gray-950 mt-6 mb-3 font-sans border-b border-slate-200 pb-1.5 uppercase">
            {line.replaceAll("##", "").trim()}
          </h3>
        );
      }
      if (line.startsWith("-") || line.startsWith("*")) {
        return (
          <li key={index} className="text-[11px] text-gray-700 ml-4 list-disc mb-1 leading-relaxed">
            {line.substring(1).trim()}
          </li>
        );
      }
      if (line.trim() === "") {
        return <div key={index} className="h-1"></div>;
      }
      return (
        <p key={index} className="text-[11px] text-gray-750 leading-relaxed mb-2">
          {line}
        </p>
      );
    });
  };

  // GATED AUTHENTICATION CHECK RENDERS
  // isAuthorized === null while the stored session is still being verified — show a neutral
  // loading state instead of flashing the login screen for users who are actually signed in.
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <img src={gembaGIcon} alt="Gemba Tools" className="h-14 w-auto object-contain animate-pulse" />
      </div>
    );
  }

  if (!isAuthorized) {
    return <AuthScreen inviteToken={inviteToken} onAuthSuccess={handleAuthSuccess} />;
  }

  // Initials generator
  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
  };

  return (
    <FactoryProvider
      currentUser={currentUser}
      customers={customers}
      setCustomers={setCustomers}
      selectedCustomerId={selectedCustomerId}
      setSelectedCustomerId={setSelectedCustomerId}
      selectedCustomer={selectedCustomer}
      currentLanguage={currentLang}
      setCurrentLanguage={(lang) => changeLanguage(lang as "tr" | "en" | "de")}
    >
      <div className="min-h-screen bg-[#fafafa] text-gray-800 flex flex-col font-sans select-none antialiased">
      
      {/* PROFESSIONAL LOGO HEADER */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 shrink-0 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-1.5 sm:space-x-1.5">
          <button
            onClick={() => setIsMobileNavOpen(true)}
            className="md:hidden mr-1 -ml-1 w-11 h-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer shrink-0"
            title="Menüyü Aç"
            aria-label="Menüyü Aç"
          >
            <Menu className="w-6 h-6" />
          </button>
          <img
            src={gembaGIcon}
            alt="Gemba Tools Logo"
            className="h-10 sm:h-12 w-auto object-contain shrink-0 select-none"
          />
          <h1 className="text-base sm:text-xl font-black text-gray-900 tracking-tight leading-none">GEMBA TOOLS</h1>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4">
          
          {/* Tenant / Factory selection dropdown */}
          {customers.length > 0 && (
            <div className="hidden md:flex items-center space-x-1.5">
              <span className="text-[11px] uppercase font-extrabold text-slate-400 tracking-wider">{t.activeFactory}</span>
              <select
                id="header-factory-dropdown"
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none text-slate-800 font-bold transition-all cursor-pointer shadow-2xs hover:border-slate-300"
                value={selectedCustomerId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedCustomerId(newId);
                  window.dispatchEvent(new CustomEvent("FactoryChanged", { detail: { factoryId: newId } }));
                }}
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Multi-Language Dropdown Selector */}
          <div className="flex items-center space-x-1">
            <select
              id="header-language-dropdown"
              value={currentLang}
              onChange={(e) => changeLanguage(e.target.value as "tr" | "en" | "de")}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none text-slate-800 font-bold transition-all cursor-pointer shadow-2xs hover:border-slate-300"
              title="Dil Seçimi / Language / Sprache"
            >
              <option value="tr">🇹🇷 TR</option>
              <option value="en">🇬🇧 EN</option>
              <option value="de">🇩🇪 DE</option>
            </select>
          </div>

          {/* ADMIN PLATFORM CONSOLE GEAR BUTTON */}
          {currentUser?.role === "Admin" && (
            <button
              onClick={() => setIsAdminConsoleOpen(true)}
              className="min-h-11 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 shadow-xs flex items-center justify-center transition-all cursor-pointer"
              title="Platform Management Console (System Admin)"
            >
              <Cog className="w-4 h-4 text-amber-400 animate-spin-slow" />
            </button>
          )}

          {/* CONSTANT VISIBLE USER AVATAR BADGE */}
          <div className="flex items-center space-x-2 border-l border-slate-150 pl-3 sm:pl-4 py-1.5">
            <div className="text-right leading-none hidden md:block">
              <div className="font-black text-xs text-gray-900">{currentUser?.full_name}</div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wide mt-0.2">
                {currentUser?.role === "Admin" ? t.roleAdmin : currentUser?.role === "Consultant" ? t.roleConsultant : t.roleCustomerUser}
              </div>
            </div>
            
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="w-11 h-11 rounded-full bg-slate-950 text-white border border-slate-200 font-black text-xs flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 transition-all"
              title="Profil & Hesap Ayarları"
            >
              {getInitials(currentUser?.full_name)}
            </button>
          </div>

        </div>
      </header>
 
      {/* CORE FRAMEWORK SIDEBAR GRID */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Mobile nav backdrop — tap to close the drawer */}
        {isMobileNavOpen && (
          <div
            onClick={() => setIsMobileNavOpen(false)}
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            aria-hidden="true"
          />
        )}

        {/* Left menu sidebar */}
        <aside className={`bg-white border-r border-gray-200 p-4 shrink-0 flex flex-col justify-between shadow-xs transition-all duration-300 z-40
            absolute inset-y-0 left-0 w-72 ${isMobileNavOpen ? "translate-x-0" : "-translate-x-full"}
            md:static md:translate-x-0 md:inset-auto ${effectivelyCollapsed ? "md:w-16 md:px-2" : "md:w-60"}`}>
          <button
            onClick={() => setIsMobileNavOpen(false)}
            className="md:hidden absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            title="Menüyü Kapat"
            aria-label="Menüyü Kapat"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="space-y-4">
            
            <nav className="space-y-0.8 text-xs" onClick={() => setIsMobileNavOpen(false)}>
              
              {/* 1. Müşteri Kartoteksi */}
              <button
                onClick={() => setActiveTab("customers")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "customers" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title={t.customers}
              >
                <Users className={`w-4 h-4 shrink-0 ${activeTab === "customers" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>{t.customers}</span>}
              </button>

              {/* 2. Executive Dashboard */}
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "dashboard" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title={t.dashboard}
              >
                <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === "dashboard" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>{t.dashboard}</span>}
              </button>

              {/* 2.5. OpEx Assessment */}
              <button
                onClick={() => setActiveTab("opex-assessment")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "opex-assessment" 
                    ? "bg-emerald-950 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title={t.opexAssessment}
              >
                <Award className={`w-4 h-4 shrink-0 ${activeTab === "opex-assessment" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>{t.opexAssessment}</span>}
              </button>

              {/* 3. Proje Master Plan */}
              <button
                onClick={() => setActiveTab("plan")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "plan" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title={t.plan}
              >
                <FolderKanban className={`w-4 h-4 shrink-0 ${activeTab === "plan" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>{t.plan}</span>}
              </button>

              {/* 4. VSM Kapasite Analizi */}
              <button
                onClick={() => setActiveTab("vsm")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "vsm" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title="VSM Kapasite Analizi"
              >
                <GitCommit className={`w-4 h-4 shrink-0 ${activeTab === "vsm" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>VSM Kapasite Analizi</span>}
              </button>

              {/* 5. Loss Capacity Analizi */}
              <button
                onClick={() => setActiveTab("loss-analysis")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "loss-analysis" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title="Loss Capacity Analizi"
              >
                <Percent className={`w-4 h-4 shrink-0 ${activeTab === "loss-analysis" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>Loss Capacity Analizi</span>}
              </button>

              {/* 11. CI Proje Yönetimi */}
              <button
                onClick={() => setActiveTab("kaizen")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "kaizen" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title="CI Proje Yönetimi"
              >
                <Sparkles className={`w-4 h-4 shrink-0 ${activeTab === "kaizen" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>CI Proje Yönetimi</span>}
              </button>

              {/* 6. Spaghetti Akış Sketcher */}
              <button
                onClick={() => setActiveTab("flow")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "flow" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title="Spaghetti Akış Sketcher"
              >
                <Map className={`w-4 h-4 shrink-0 ${activeTab === "flow" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>Spaghetti Akış Sketcher</span>}
              </button>

              {/* 7. Time Study */}
              <button
                onClick={() => setActiveTab("timestudy")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "timestudy" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title="Time Study"
              >
                <Clock className={`w-4 h-4 shrink-0 ${activeTab === "timestudy" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>Time Study</span>}
              </button>

              {/* 8. Yamazumi Aı Analizer */}
              <button
                onClick={() => setActiveTab("balancing")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "balancing" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title="Yamazumi Aı Analizer"
              >
                <AlignLeft className={`w-4 h-4 shrink-0 ${activeTab === "balancing" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>Yamazumi Aı Analizer</span>}
              </button>

              {/* 9. SMED Analizi */}
              <button
                onClick={() => setActiveTab("smed")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "smed" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title="SMED Analizi"
              >
                <RefreshCw className={`w-4 h-4 shrink-0 ${activeTab === "smed" ? "text-white animate-spin-slow" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>SMED Analizi</span>}
              </button>

              {/* 10. Proje Takip Raporu */}
              <button
                onClick={() => setActiveTab("ptr")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "ptr" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title="Proje Takip Raporu"
              >
                <Clock className={`w-4 h-4 shrink-0 ${activeTab === "ptr" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>Proje Takip Raporu</span>}
              </button>

              {/* 12. 5S Olgunluk Auditler */}
              <button
                onClick={() => setActiveTab("fives")}
                className={`w-full flex items-center rounded-xl font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "fives" 
                    ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50 hover:text-gray-900"
                } ${effectivelyCollapsed ? "justify-center p-2.5" : "space-x-2.5 px-3 py-2"}`}
                title="5S Olgunluk Auditler"
              >
                <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === "fives" ? "text-white" : "text-slate-400"}`} />
                {!effectivelyCollapsed && <span>5S Olgunluk Auditler</span>}
              </button>

            </nav>
          </div>

          {/* User Workspace Info panel and Toggle Button */}
          <div className="mt-auto pt-3 border-t border-slate-100 space-y-3">
            <div className={`flex ${effectivelyCollapsed ? "flex-col items-center space-y-3" : "items-center justify-between"}`}>
              {!effectivelyCollapsed ? (
                <>
                  <div className="flex flex-col space-y-0.5 max-w-[80%]">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">AKTIF HESAP:</span>
                    <span className="text-[10px] text-slate-700 font-extrabold truncate" title={currentUser?.email}>{currentUser?.email}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-red-500 hover:text-red-700 w-11 h-11 flex items-center justify-center rounded hover:bg-red-50 cursor-pointer"
                    title="Güvenli Çıkış (Logout)"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleSignOut}
                  className="text-red-500 hover:text-red-750 p-2 rounded-xl bg-red-50 hover:bg-red-100/80 cursor-pointer border border-red-100/50 transition-all flex items-center justify-center"
                  title="Güvenli Çıkış (Logout)"
                >
                  <LogOut className="w-4.5 h-4.5" />
                </button>
              )}
            </div>

            {/* Compact collapse/expand toggle — desktop only, icon-only mode has no meaning in the mobile drawer */}
            <div className="hidden md:flex justify-center pt-1">
              <button
                onClick={toggleSidebar}
                className="w-full flex items-center justify-center py-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-50 border border-dashed border-slate-200/60 transition-all duration-200 cursor-pointer text-xs font-mono font-bold"
                title={effectivelyCollapsed ? "Menüyü Genişlet" : "Menüyü Daralt"}
              >
                {effectivelyCollapsed ? ">" : "<"}
              </button>
            </div>

            {/* GEMBA DIGITAL Corporate Brand Signature Logo */}
            <div className="pt-3.5 mt-1 border-t border-slate-100/80 flex flex-col items-center justify-center">
              {!effectivelyCollapsed ? (
                <div className="flex flex-col items-center space-y-1.5 px-2 py-1 select-none pointer-events-none w-full">
                  <div className="h-16 w-full flex items-center justify-center overflow-hidden">
                    <img
                      src={gembaDigitalWordmark}
                      alt="Gemba Digital Logo"
                      className="h-16 w-auto object-contain max-w-[220px] opacity-90 hover:opacity-100 transition-opacity duration-300"
                    />
                  </div>
                  <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase leading-none mt-0.5">
                    Corporate Signature
                  </span>
                </div>
              ) : (
                <div className="w-11 h-11 flex items-center justify-center select-none" title="Gemba Digital">
                  <img
                    src={gembaGIcon}
                    alt="Gemba Digital Symbol"
                    className="w-10 h-10 object-contain select-none"
                  />
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Inner dashboard panels */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Render target layouts */}
          <div className="transition-all duration-200">
            {activeTab === "customers" && (
              <div key={selectedCustomerId}>
                <CustomerRecords
                  customers={customers}
                  selectedCustomer={selectedCustomer}
                  token={token}
                  currentUser={currentUser}
                  onRefreshCustomers={refreshCustomers}
                  onSelectCustomer={(c) => {
                    setSelectedCustomerId(c.id);
                    window.dispatchEvent(new CustomEvent("FactoryChanged", { detail: { factoryId: c.id } }));
                  }}
                  onAddCustomer={handleAddCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                  onTriggerAiAudit={handleTriggerAiAudit}
                  isAiLoading={isAiLoading}
                  reportText={reportText}
                  setReportText={setReportText}
                  aiError={aiError}
                />
              </div>
            )}

            {activeTab === "plan" && (
              <div key={selectedCustomerId}>
                <MasterPlanGantt
                  activities={activities}
                  kaizens={kaizens}
                  audits5S={audits5S}
                  processes={processes}
                  onAddActivity={handleAddActivity}
                  onUpdateActivity={handleUpdateActivity}
                  onDeleteActivity={handleDeleteActivity}
                  activeCustomerId={selectedCustomerId}
                  customerName={selectedCustomer?.companyName}
                />
              </div>
            )}

            {activeTab === "flow" && (
              <div key={selectedCustomerId}>
                <FlowImprovement
                  selectedCustomer={selectedCustomer}
                />
              </div>
            )}

            {activeTab === "vsm" && (
              <div key={selectedCustomerId}>
                <VsmPage />
              </div>
            )}

            {activeTab === "kaizen" && (
              <div key={selectedCustomerId}>
                <KaizenManager
                  kaizens={kaizens}
                  onAddKaizen={handleAddKaizen}
                  onUpdateKaizen={handleUpdateKaizen}
                  onDeleteKaizen={handleDeleteKaizen}
                  processes={processes}
                  activities={activities}
                  onAddActivity={handleAddActivity}
                  onUpdateActivity={handleUpdateActivity}
                  onDeleteActivity={handleDeleteActivity}
                  selectedCustomer={selectedCustomer}
                />
              </div>
            )}

            {activeTab === "fives" && (
              <div key={selectedCustomerId}>
                <FiveSAuditSystem />
              </div>
            )}

            {activeTab === "balancing" && (
              <div key={selectedCustomerId}>
                <LineBalancing selectedCustomer={selectedCustomer} />
              </div>
            )}

            {activeTab === "timestudy" && (
              <div key={selectedCustomerId}>
                <TimeStudyPage selectedCustomer={selectedCustomer} vsmProcesses={processes} />
              </div>
            )}

            {activeTab === "smed" && (
              <div key={selectedCustomerId}>
                <SmedPage selectedCustomer={selectedCustomer} vsmProcesses={processes} />
              </div>
            )}

            {activeTab === "ptr" && (
              <div key={selectedCustomerId}>
                <PtrTimeStudy
                  activities={activities}
                  onAddActivity={handleAddActivity}
                  onUpdateActivity={handleUpdateActivity}
                  onAddKaizen={handleAddKaizen}
                  kaizens={kaizens}
                />
              </div>
            )}

            {activeTab === "loss-analysis" && (
              <div key={selectedCustomerId}>
                <LossAnalysis />
              </div>
            )}

            {activeTab === "dashboard" && (
              <div key={selectedCustomerId}>
                <ExecutiveDashboard
                  customers={customers}
                  processes={processes}
                  activities={activities}
                  segments={segments}
                  kaizens={kaizens}
                />
              </div>
            )}

            {activeTab === "opex-assessment" && (
              <div key={selectedCustomerId}>
                <OpexAssessment
                  selectedCustomer={selectedCustomer}
                  customers={customers}
                  onUpdateCustomer={handleUpdateCustomer}
                />
              </div>
            )}
          </div>

        </main>
      </div>

      {/* COMPACT MODULARISED USER PROFILE HOVER DIALOGUE */}
      <UserProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        currentOrg={currentOrg}
        token={token}
        onUpdateUser={(updatedUser) => setCurrentUser(updatedUser)}
        onSignOut={handleSignOut}
        activeCustomerId={selectedCustomerId}
        currentLang={currentLang}
        onChangeLanguage={changeLanguage}
      />

      {/* SYSTEM ADMIN PLATFORM MANAGEMENT CONSOLE OVERLAY */}
      <PlatformAdminConsole
        isOpen={isAdminConsoleOpen}
        onClose={() => setIsAdminConsoleOpen(false)}
        currentUser={currentUser}
        currentOrg={currentOrg}
        token={token}
        currentLang={currentLang}
      />

    </div>
    </FactoryProvider>
  );
}
