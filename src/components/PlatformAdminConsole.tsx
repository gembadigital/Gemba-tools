import React, { useState, useEffect } from "react";
import { 
  Building2, Users, ShieldCheck, FolderKanban, Database, Mail, HardDrive, 
  Sparkles, Network, Bell, FileText, Activity, CreditCard, Archive, Code2, 
  Search, X, CheckCircle2, AlertTriangle, RefreshCw, Key, ExternalLink, 
  Plus, Edit3, Trash2, Send, Lock, Eye, EyeOff, ShieldAlert, Cpu, Server, 
  Layers, ChevronRight, Check, HelpCircle, Download, Upload, Play, Terminal, 
  Radio, CheckSquare, Clock, Globe, Laptop, Smartphone, FileSpreadsheet, RotateCcw
} from "lucide-react";

import ArchitectureHub from "./ArchitectureHub";

interface PlatformAdminConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentOrg: any;
  token: string;
}

export default function PlatformAdminConsole({
  isOpen,
  onClose,
  currentUser,
  currentOrg,
  token
}: PlatformAdminConsoleProps) {
  const [activeSection, setActiveSection] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Section 1: Organization State
  const [orgData, setOrgData] = useState({
    name: currentOrg?.organization_name || "Arçelik A.Ş.",
    logoUrl: "",
    address: "Organize Sanayi Bölgesi 1. Cadde No: 4 Bolu / Türkiye",
    taxOffice: "Bolu V.D.",
    taxNumber: "0790012345",
    currency: "₺",
    language: "TR",
    timezone: "UTC+03:00 (İstanbul)",
    weekStart: "Pazartesi",
    workCalendar: "5 Gün / 40 Saat",
    shiftSystem: "3 Vardiya (24 Saat)"
  });

  // Section 2: User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("User");
  const [userSearch, setUserSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("Tüm Departmanlar");

  // Section 3: Role & Permissions State
  const [selectedRole, setSelectedRole] = useState<string>("System Admin");
  const [permissionsMatrix, setPermissionsMatrix] = useState<Record<string, Record<string, boolean>>>({
    "VSM Kapasite": { Read: true, Create: true, Update: true, Delete: true, Export: true, AIAssistant: true },
    "SMED Değişim": { Read: true, Create: true, Update: true, Delete: true, Export: true, AIAssistant: true },
    "Time Study": { Read: true, Create: true, Update: true, Delete: true, Export: true, AIAssistant: true },
    "Loss Analysis": { Read: true, Create: true, Update: true, Delete: true, Export: true, AIAssistant: true },
    "Hat Dengeleme": { Read: true, Create: true, Update: true, Delete: true, Export: true, AIAssistant: true },
    "CI / Kaizen": { Read: true, Create: true, Update: true, Delete: true, Export: true, AIAssistant: true },
    "5S Audit": { Read: true, Create: true, Update: true, Delete: true, Export: true, AIAssistant: true },
    "OpEx Assessment": { Read: true, Create: true, Update: true, Delete: true, Export: true, AIAssistant: true },
    "Raporlar": { Read: true, Create: true, Update: true, Delete: true, Export: true, AIAssistant: true },
  });

  // Section 4: Project Templates
  const [templates, setTemplates] = useState([
    { id: "tmpl_vsm", name: "VSM Capacity Template", category: "VSM", steps: 8, status: "Aktif", description: "Değer akışı haritalama ve taktı süresi senkronizasyonu şablonu." },
    { id: "tmpl_smed", name: "SMED Quick Changeover Template", category: "SMED", steps: 6, status: "Aktif", description: "İç/Dış hazırlık dönüşümü ve hedef daralma şablonu." },
    { id: "tmpl_ci", name: "CI Project DMAIC Template", category: "Kaizen", steps: 5, status: "Aktif", description: "A3 ve DMAIC odaklı sürekli iyileştirme yönetim şablonu." },
    { id: "tmpl_plan", name: "Master Plan 52-Week Template", category: "Master Plan", steps: 12, status: "Aktif", description: "Yıllık OpEx dönüşüm yol haritası ve man-day şablonu." },
    { id: "tmpl_time", name: "Time Study Standard Observation", category: "Time Study", steps: 4, status: "Aktif", description: "Gözlemlenen süre ve tempo takdir cetveli şablonu." },
    { id: "tmpl_stdwork", name: "Standard Work Combination Sheet", category: "Standard Work", steps: 7, status: "Aktif", description: "Standart iş kombinasyon ve çevrim çizelgesi." },
    { id: "tmpl_spaghetti", name: "Spaghetti Flow & Motion Template", category: "Spaghetti", steps: 3, status: "Aktif", description: "Yürüme mesafesi ve iç lojistik israf haritası." },
    { id: "tmpl_assessment", name: "OpEx Maturity 100-Point Assessment", category: "Assessment", steps: 10, status: "Aktif", description: "10 Kategori 100 soru olgunluk değerlendirme şablonu." },
    { id: "tmpl_kaizen", name: "Kobetsu Kaizen 8-Step Template", category: "Kaizen", steps: 8, status: "Aktif", description: "Odaklanmış iyileştirme 8 adım kök neden şablonu." }
  ]);

  // Section 5: Master Data State
  const [activeMasterTab, setActiveMasterTab] = useState<"dept" | "lines" | "machines" | "procs" | "products" | "factories">("dept");
  const [departments, setDepartments] = useState(["Preshane", "Kaynak Atölyesi", "Boyahane", "Montaj Hattı 1", "Montaj Hattı 2", "Kalite Güvence", "Lojistik & Depo", "Bakım Onarım"]);
  const [lines, setLines] = useState(["Hat-01 (Ana Montaj)", "Hat-02 (Yan Sanayi)", "Hat-03 (Özel İmalat)", "Otomatik Boyathane"]);
  const [machines, setMachines] = useState(["Enjeksiyon 01 (500 Ton)", "Robotik Kaynak Cell A", "Abkant Pres 03", "CNC İşleme Merkezi 02"]);

  // Section 6: Mail Services
  const [mailProvider, setMailProvider] = useState<"graph" | "exchange" | "smtp" | "google">("graph");
  const [mailConfig, setMailConfig] = useState({
    senderAddress: "noreply@gemba.ai",
    senderName: "Gemba Tools System",
    smtpHost: "smtp.office365.com",
    smtpPort: "587",
    useSsl: true,
    clientId: "app_908123847_graph",
    clientSecret: "••••••••••••••••••••",
    signatureText: "Gemba Tools SaaS Operational Excellence Platform - Sent via Automated System"
  });
  const [testMailStatus, setTestMailStatus] = useState<string | null>(null);

  // Section 7: Document Storage
  const [storageProvider, setStorageProvider] = useState<"sharepoint" | "onedrive" | "azure" | "gdrive" | "s3" | "supabase" | "local">("sharepoint");
  const [storageConfig, setStorageConfig] = useState({
    sharepointSiteUrl: "https://arcelik.sharepoint.com/sites/OpExVault",
    rootFolderPath: "/Müşteriler/GembaTools_Archive",
    syncStatus: "Connected",
    lastSyncTime: "Bugün, 12:45"
  });

  // Section 8: AI Management
  const [aiProvider, setAiProvider] = useState<"gemini" | "claude" | "openai" | "azure" | "local">("gemini");
  const [apiKeyShow, setApiKeyShow] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(process.env.GEMINI_API_KEY || "AIzaSy_Gemini_Vault_Key_Active");
  const [activeExperts, setActiveExperts] = useState([
    { id: "lean", name: "Lean Expert", status: "Aktif", promptCount: 42, icon: "🧘" },
    { id: "tpm", name: "TPM Expert", status: "Aktif", promptCount: 28, icon: "⚙️" },
    { id: "smed", name: "SMED Expert", status: "Aktif", promptCount: 19, icon: "🔄" },
    { id: "vsm", name: "VSM Expert", status: "Aktif", promptCount: 35, icon: "📈" },
    { id: "opex", name: "OPEX Consultant", status: "Aktif", promptCount: 50, icon: "🏆" },
    { id: "cost", name: "Cost Control Expert", status: "Aktif", promptCount: 22, icon: "💰" }
  ]);

  // Section 9: Integration Center
  const [integrations, setIntegrations] = useState([
    { id: "sap", name: "SAP S/4HANA ERP", category: "ERP", status: "Connected", ping: "24 ms", lastSync: "10 dk önce" },
    { id: "logo", name: "Logo Tiger Enterprise", category: "ERP", status: "Connected", ping: "18 ms", lastSync: "15 dk önce" },
    { id: "mes", name: "ShopFloor MES", category: "MES/SCADA", status: "Connected", ping: "8 ms", lastSync: "Anlık (Realtime)" },
    { id: "powerbi", name: "Microsoft Power BI", category: "Analytics", status: "Connected", ping: "45 ms", lastSync: "1 saat önce" },
    { id: "teams", name: "Microsoft Teams Bot", category: "Collaboration", status: "Connected", ping: "12 ms", lastSync: "Anlık" },
    { id: "automate", name: "Power Automate Webhook", category: "Workflow", status: "Standby", ping: "--", lastSync: "Dün" },
    { id: "restapi", name: "External REST API Ingress", category: "API Gateway", status: "Connected", ping: "5 ms", lastSync: "2 dk önce" }
  ]);

  // Section 10: Notification Center
  const [notifChannels, setNotifChannels] = useState({
    email: true,
    teams: true,
    mobilePush: false,
    weeklyReport: true,
    delayedActions: true,
    upcomingDeadlines: true,
    aiSuggestions: true,
    storageLimitAlert: true,
    licenseExpiryAlert: true
  });

  // Section 11: Audit Logs
  const [logs, setLogs] = useState([
    { id: "log_101", user: "Hakan Bulgurlu", action: "Rol Yetki Güncellemesi", time: "2026-07-26 12:40", oldVal: "User", newVal: "Admin", ip: "192.168.1.45", browser: "Chrome / Windows", result: "Başarılı" },
    { id: "log_102", user: "Ahmet Yılmaz", action: "AI Model Değişikliği", time: "2026-07-26 11:15", oldVal: "Gemini 1.5", newVal: "Gemini 2.0 Flash", ip: "10.0.4.12", browser: "Safari / macOS", result: "Başarılı" },
    { id: "log_103", user: "System Auto", action: "Otomatik Yedekleme", time: "2026-07-26 02:00", oldVal: "db_v2026_07_25.json", newVal: "db_v2026_07_26.json", ip: "127.0.0.1", browser: "Internal Worker", result: "Başarılı" },
    { id: "log_104", user: "Merve Kaya", action: "SMTP Mail Ayarı Testi", time: "2026-07-25 16:30", oldVal: "smtp.gmail.com", newVal: "smtp.office365.com", ip: "176.234.11.2", browser: "Firefox / Linux", result: "Başarılı" }
  ]);

  // Section 12: System Health
  const [healthMetrics, setHealthMetrics] = useState({
    dbStatus: "Healthy",
    apiStatus: "Healthy",
    aiStatus: "Healthy",
    mailStatus: "Healthy",
    sharepointStatus: "Healthy",
    cpuLoad: 18,
    ramUsage: 42,
    responseTimeMs: 28,
    errorRate: 0.02,
    activeUsers: 14,
    totalCompanies: 8,
    totalProjects: 64
  });

  // Section 13: License & Subscription
  const [licenseInfo, setLicenseInfo] = useState({
    planType: "Enterprise SaaS Unlimited Tier",
    maxUsers: 50,
    currentUsers: 14,
    storageLimitGb: 500,
    storageUsedGb: 84.5,
    aiTokenLimitMonth: 10000000,
    aiTokenUsedMonth: 1420500,
    expiryDate: "31.12.2026",
    status: "Active (Otomatik Yenileme)"
  });

  // Section 14: Backup Center
  const [backups, setBackups] = useState([
    { id: "bk_20260726", name: "Sistem_Yedek_20260726_0200.json", size: "14.2 MB", date: "2026-07-26 02:00", type: "Otomatik" },
    { id: "bk_20260725", name: "Sistem_Yedek_20260725_0200.json", size: "13.9 MB", date: "2026-07-25 02:00", type: "Otomatik" },
    { id: "bk_20260724", name: "Sistem_Yedek_20260724_0200.json", size: "13.5 MB", date: "2026-07-24 02:00", type: "Otomatik" }
  ]);

  // Global Notification Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch live users for User Management section
  useEffect(() => {
    if (isOpen && token) {
      fetch("/api/admin/users", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsers(data.users);
        }
      })
      .catch(() => {});
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  // Filter sections based on search query
  const sectionsList = [
    { id: 1, title: "Organization", icon: Building2, desc: "Firma, Logo, Vardiya ve Çalışma Takvimi" },
    { id: 2, title: "User Management", icon: Users, desc: "Kullanıcılar, Rol, Fabrika ve Proje Atama" },
    { id: 3, title: "Role & Permissions", icon: ShieldCheck, desc: "RBAC Matrisi, Modül İzin Yetkileri" },
    { id: 4, title: "Project Templates", icon: FolderKanban, desc: "VSM, SMED, Kaizen Proje Şablonları" },
    { id: 5, title: "Master Data", icon: Database, desc: "Departman, Makine, Proses ve Hat Tanımları" },
    { id: 6, title: "Mail Services", icon: Mail, desc: "Microsoft Graph, Exchange, SMTP Wizard" },
    { id: 7, title: "Document Storage", icon: HardDrive, desc: "SharePoint, OneDrive, S3, Azure Storage" },
    { id: 8, title: "AI Management", icon: Sparkles, desc: "Gemini, Prompt Kütüphanesi & Uzman Profilleri" },
    { id: 9, title: "Integration Center", icon: Network, desc: "SAP, Logo, MES, SCADA, Power BI" },
    { id: 10, title: "Notification Center", icon: Bell, desc: "E-Posta, Teams, Push Alarm Kuralları" },
    { id: 11, title: "Audit Logs", icon: FileText, desc: "Sistem İşlem Günlüğü, Güvenlik Kayıtları" },
    { id: 12, title: "System Health", icon: Activity, desc: "Gerçek Zamanlı Sunucu, DB & API Telemetri" },
    { id: 13, title: "License & Subscription", icon: CreditCard, desc: "Paket Tipi, Kullanıcı Limiti & AI Token" },
    { id: 14, title: "Backup Center", icon: Archive, desc: "Anlık Manuel / Otomatik Yedekleme & Restore" },
    { id: 15, title: "Developer Console", icon: Code2, desc: "SaaS Sistem Mimarisi & ER Diyagramı" }
  ];

  const filteredSections = sectionsList.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-hidden select-none font-sans antialiased">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden relative">
        
        {/* TOP BAR (MICROSOFT 365 ADMIN CENTER HEADER STYLE) */}
        <header className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-800 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black shadow-xs">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-black tracking-tight text-white uppercase">Platform Management Console</h2>
                <span className="px-2 py-0.5 text-[9px] font-extrabold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 rounded-full uppercase tracking-wider">
                  System Admin Access
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                Gemba Tools SaaS Merkezi Yönetim ve Entegrasyon Konsolu • {orgData.name}
              </p>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="hidden md:flex items-center space-x-2 bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 w-72 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ayarlarda ara (Örn: SMTP, Gemini, SharePoint)..."
              className="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick System Status & Close Button */}
          <div className="flex items-center space-x-3">
            <div className="hidden lg:flex items-center space-x-2 bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 px-3 py-1 rounded-full text-[10px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>All Systems Operational</span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700"
              title="Konsoldan Çık"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* FEEDBACK TOAST */}
        {toastMessage && (
          <div className="absolute top-16 right-6 z-50 bg-slate-900 text-white border border-emerald-500/50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 animate-bounce text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* MAIN CONSOLE BODY GRID (SIDEBAR + CONTENT AREA) */}
        <div className="flex flex-1 overflow-hidden bg-slate-50/50">
          
          {/* LEFT CONSOLE SIDEBAR NAVIGATION */}
          <aside className="w-72 bg-white border-r border-slate-200 p-3 shrink-0 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-1">
              <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-2">
                PLATFORM YÖNETİM MENÜSÜ ({filteredSections.length})
              </div>

              {filteredSections.map((sec) => {
                const IconComponent = sec.icon;
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isActive 
                        ? "bg-slate-900 text-white shadow-xs font-bold" 
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                      <div className="truncate">
                        <div className="text-xs truncate leading-tight">{sec.title}</div>
                      </div>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Admin Badge Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 px-3 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Gemba Console v3.4</span>
              <span className="font-bold text-slate-600">Enterprise</span>
            </div>
          </aside>

          {/* RIGHT CONTENT DISPLAY PANEL */}
          <main className="flex-1 overflow-y-auto p-6 bg-[#fafafa]">
            
            {/* 1. ORGANIZATION */}
            {activeSection === 1 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                      <span>1. Organization (Kurum & Firma Ayarları)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      SaaS platformunun kiracı (tenant) düzeyindeki kurumsal kimlik ve takvim yapılandırması.
                    </p>
                  </div>
                  <button
                    onClick={() => showToast("Firma bilgileri başarıyla kaydedildi!")}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Değişiklikleri Kaydet
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* General Info Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                    <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                      Temel Firma Bilgileri
                    </h4>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Firma Ticari Ünvanı</label>
                        <input
                          type="text"
                          value={orgData.name}
                          onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Firma Adresi</label>
                        <textarea
                          rows={2}
                          value={orgData.address}
                          onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Vergi Dairesi</label>
                          <input
                            type="text"
                            value={orgData.taxOffice}
                            onChange={(e) => setOrgData({ ...orgData, taxOffice: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Vergi Numarası</label>
                          <input
                            type="text"
                            value={orgData.taxNumber}
                            onChange={(e) => setOrgData({ ...orgData, taxNumber: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Settings Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                    <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                      Operasyonel & Takvim Ayarları
                    </h4>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Para Birimi</label>
                          <select
                            value={orgData.currency}
                            onChange={(e) => setOrgData({ ...orgData, currency: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          >
                            <option value="₺">₺ (Türk Lirası)</option>
                            <option value="$">$ (USD)</option>
                            <option value="€">€ (EUR)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Sistem Dili</label>
                          <select
                            value={orgData.language}
                            onChange={(e) => setOrgData({ ...orgData, language: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          >
                            <option value="TR">Türkçe (TR)</option>
                            <option value="EN">English (EN)</option>
                            <option value="DE">Deutsch (DE)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Zaman Dilimi</label>
                          <input
                            type="text"
                            readOnly
                            value={orgData.timezone}
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Hafta Başlangıcı</label>
                          <select
                            value={orgData.weekStart}
                            onChange={(e) => setOrgData({ ...orgData, weekStart: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          >
                            <option value="Pazartesi">Pazartesi</option>
                            <option value="Pazar">Pazar</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Çalışma Takvimi</label>
                          <select
                            value={orgData.workCalendar}
                            onChange={(e) => setOrgData({ ...orgData, workCalendar: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          >
                            <option value="5 Gün / 40 Saat">5 Gün / 40 Saat</option>
                            <option value="6 Gün / 45 Saat">6 Gün / 45 Saat</option>
                            <option value="7/24 Sürekli">7/24 Sürekli Vardiyalı</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Vardiya Sistemi</label>
                          <select
                            value={orgData.shiftSystem}
                            onChange={(e) => setOrgData({ ...orgData, shiftSystem: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          >
                            <option value="1 Vardiya (08:00 - 17:00)">1 Vardiya (08:00 - 17:00)</option>
                            <option value="2 Vardiya (08:00 - 16:00 / 16:00 - 00:00)">2 Vardiya</option>
                            <option value="3 Vardiya (24 Saat)">3 Vardiya (24 Saat)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. USER MANAGEMENT */}
            {activeSection === 2 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      <span>2. User Management (Kullanıcı & Lisans Atama)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Kullanıcı hesapları, rol yetkileri, fabrika ve proje erişimlerinin merkezi yönetimi.
                    </p>
                  </div>
                  <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    Toplam Üye: {users.length} / 50 Lisans
                  </div>
                </div>

                {/* User List Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <input
                      type="text"
                      placeholder="Kullanıcılarda ara..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none w-64"
                    />
                    <button
                      onClick={() => showToast("Yeni kullanıcı daveti oluşturuldu.")}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Kullanıcı Oluştur</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-3">Adı Soyadı & E-Posta</th>
                          <th className="px-4 py-3">Rol</th>
                          <th className="px-4 py-3">Atanan Fabrika</th>
                          <th className="px-4 py-3">Durum</th>
                          <th className="px-4 py-3">MFA</th>
                          <th className="px-4 py-3">Son Giriş</th>
                          <th className="px-4 py-3 text-right">Aksiyonlar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900">{u.full_name}</div>
                              <div className="text-[10px] font-mono text-slate-400">{u.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">Arçelik Pişirici Cihazlar</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                u.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                              }`}>
                                {u.status === "Active" ? "Aktif" : "Pasif"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-emerald-600 font-mono text-[10px]">Aktif (SMS/TOTP)</td>
                            <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                              {u.last_login ? new Date(u.last_login).toLocaleString("tr-TR") : "Giriş Yok"}
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => showToast(`${u.full_name} için şifre sıfırlama e-postası gönderildi.`)}
                                className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
                                title="Şifre Sıfırla"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. ROLE & PERMISSIONS */}
            {activeSection === 3 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      <span>3. Role & Permission Management (RBAC)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Sistem geneli hazır roller ve modül bazlı yetkilendirme matrisi.
                    </p>
                  </div>
                  <button
                    onClick={() => showToast("Yetki matrisi başarıyla güncellendi.")}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    Matrisi Kaydet
                  </button>
                </div>

                {/* Role Selector Tabs */}
                <div className="flex flex-wrap gap-2">
                  {["System Admin", "Company Admin", "Consultant", "Project Manager", "Engineer", "Viewer", "Customer User"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRole(r)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        selectedRole === r 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-xs" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {/* Permissions Matrix Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Modül / Uygulama Alanı</th>
                        <th className="px-4 py-3 text-center">Read</th>
                        <th className="px-4 py-3 text-center">Create</th>
                        <th className="px-4 py-3 text-center">Update</th>
                        <th className="px-4 py-3 text-center">Delete</th>
                        <th className="px-4 py-3 text-center">Export</th>
                        <th className="px-4 py-3 text-center">AI Assistant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {Object.keys(permissionsMatrix).map((mod) => (
                        <tr key={mod} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-900">{mod}</td>
                          {["Read", "Create", "Update", "Delete", "Export", "AIAssistant"].map((act) => {
                            const isChecked = permissionsMatrix[mod][act];
                            return (
                              <td key={act} className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedRole === "System Admin" ? true : isChecked}
                                  disabled={selectedRole === "System Admin"}
                                  onChange={() => {
                                    setPermissionsMatrix(prev => ({
                                      ...prev,
                                      [mod]: { ...prev[mod], [act]: !prev[mod][act] }
                                    }));
                                  }}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
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

            {/* 4. PROJECT TEMPLATES */}
            {activeSection === 4 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <FolderKanban className="w-5 h-5 text-indigo-600" />
                      <span>4. Project Templates (Hazır Proje Şablonları)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Danışmanların yeni müşteri açarken kod yazmadan tek tıkla kullanabileceği hazır metodoloji şablonları.
                    </p>
                  </div>
                  <button
                    onClick={() => showToast("Yeni proje şablonu eklendi.")}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Yeni Şablon Oluştur</span>
                  </button>
                </div>

                {/* Templates Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {templates.map((tmpl) => (
                    <div key={tmpl.id} className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all shadow-xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                            {tmpl.category}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            {tmpl.status}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-900 mt-2">{tmpl.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{tmpl.description}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>{tmpl.steps} Aşama / Adım</span>
                        <button 
                          onClick={() => showToast(`"${tmpl.name}" şablonu düzenleme modunda açıldı.`)}
                          className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                        >
                          Düzenle →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. MASTER DATA CENTER */}
            {activeSection === 5 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Database className="w-5 h-5 text-indigo-600" />
                      <span>5. Master Data Center (Merkezi Veri Havuzu)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Bütün modüllerin ortak kullandığı tek nokta (Single Source of Truth) temel veri tanımları.
                    </p>
                  </div>
                </div>

                {/* Master Data Tabs */}
                <div className="flex space-x-2 border-b border-slate-200 pb-2">
                  {[
                    { id: "dept", title: "Departmanlar" },
                    { id: "lines", title: "Hatlar" },
                    { id: "machines", title: "Makinalar" },
                    { id: "procs", title: "Prosesler" },
                    { id: "products", title: "Ürün Grupları & Aileleri" },
                    { id: "factories", title: "Fabrikalar & Lokasyonlar" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveMasterTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        activeMasterTab === tab.id 
                          ? "bg-slate-900 text-white shadow-xs" 
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {tab.title}
                    </button>
                  ))}
                </div>

                {/* Master Data Items Box */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="font-extrabold text-xs text-slate-900 uppercase">
                      Tanımlı Öğe Listesi ({activeMasterTab === "dept" ? departments.length : activeMasterTab === "lines" ? lines.length : machines.length})
                    </span>
                    <button
                      onClick={() => showToast("Yeni master data öğesi eklendi.")}
                      className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-lg cursor-pointer"
                    >
                      + Yeni Öğe Ekle
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(activeMasterTab === "dept" ? departments : activeMasterTab === "lines" ? lines : machines).map((item, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 flex justify-between items-center">
                        <span className="truncate">{item}</span>
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500 cursor-pointer shrink-0 ml-1" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 6. MAIL SERVICES */}
            {activeSection === 6 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Mail className="w-5 h-5 text-indigo-600" />
                      <span>6. Mail Services (Kurumsal E-Posta Servisi)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      E-posta gönderim sağlayıcısı, Microsoft Graph, Exchange ve SMTP sihirbazı.
                    </p>
                  </div>
                  <button
                    onClick={() => showToast("Mail yapılandırması kaydedildi.")}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    Ayarları Kaydet
                  </button>
                </div>

                {/* Mail Provider Selector Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: "graph", name: "Microsoft Graph API", desc: "Microsoft 365 Kurumsal Bağlantı" },
                    { id: "exchange", name: "Exchange Server", desc: "On-Premises / Hybrid Exchange" },
                    { id: "smtp", name: "Standart SMTP", desc: "TLS / SSL SMTP Port 587" },
                    { id: "google", name: "Google Workspace", desc: "Google OAuth2 / Gmail API" }
                  ].map((prov) => (
                    <button
                      key={prov.id}
                      onClick={() => setMailProvider(prov.id as any)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        mailProvider === prov.id 
                          ? "bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20" 
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-extrabold text-xs text-slate-900">{prov.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{prov.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Mail Wizard Input Panel */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    {mailProvider === "graph" ? "Microsoft Graph OAuth Configuration" : "SMTP Server Configuration"}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Varsayılan Gönderen E-Posta Adresi</label>
                      <input
                        type="text"
                        value={mailConfig.senderAddress}
                        onChange={(e) => setMailConfig({ ...mailConfig, senderAddress: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Varsayılan Gönderen Adı</label>
                      <input
                        type="text"
                        value={mailConfig.senderName}
                        onChange={(e) => setMailConfig({ ...mailConfig, senderName: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                      />
                    </div>

                    {mailProvider === "smtp" ? (
                      <>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">SMTP Host Sunucu</label>
                          <input
                            type="text"
                            value={mailConfig.smtpHost}
                            onChange={(e) => setMailConfig({ ...mailConfig, smtpHost: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">SMTP Port</label>
                          <input
                            type="text"
                            value={mailConfig.smtpPort}
                            onChange={(e) => setMailConfig({ ...mailConfig, smtpPort: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">OAuth Client ID (Application ID)</label>
                          <input
                            type="text"
                            value={mailConfig.clientId}
                            onChange={(e) => setMailConfig({ ...mailConfig, clientId: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">OAuth Client Secret</label>
                          <input
                            type="password"
                            value={mailConfig.clientSecret}
                            onChange={(e) => setMailConfig({ ...mailConfig, clientSecret: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => {
                        setTestMailStatus("Test e-postası başarıyla iletildi! 🟢");
                        showToast("Mail Bağlantı Testi Başarılı!");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Mail Bağlantısını Test Et</span>
                    </button>
                    {testMailStatus && <span className="text-xs font-bold text-emerald-600">{testMailStatus}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* 7. DOCUMENT STORAGE */}
            {activeSection === 7 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <HardDrive className="w-5 h-5 text-indigo-600" />
                      <span>7. Document Storage (Bulut Doküman Depolama Mimarisi)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Belgelerin veritabanında tutulmayıp cloud depolama servislerinde otomatik klasörlenmesi.
                    </p>
                  </div>
                </div>

                {/* Storage Provider Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: "sharepoint", name: "Microsoft SharePoint", status: "Aktif" },
                    { id: "onedrive", name: "OneDrive for Business", status: "Hazır" },
                    { id: "azure", name: "Azure Blob Storage", status: "Hazır" },
                    { id: "gdrive", name: "Google Drive Enterprise", status: "Hazır" },
                    { id: "s3", name: "AWS S3 Bucket", status: "Hazır" },
                    { id: "supabase", name: "Supabase Storage", status: "Hazır" },
                    { id: "local", name: "Local Server Storage", status: "Yedek" }
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStorageProvider(s.id as any)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        storageProvider === s.id 
                          ? "bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20" 
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="font-extrabold text-xs text-slate-900">{s.name}</div>
                      <div className="text-[10px] font-bold text-indigo-600 mt-1">{s.status}</div>
                    </button>
                  ))}
                </div>

                {/* Folder Structure Preview Box */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Otomatik Oluşturulan Hiyerarşik Klasör Yapısı
                  </h4>

                  <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-4 rounded-xl space-y-1">
                    <div>Müşteriler/</div>
                    <div className="ml-4">└── ABC Otomotiv/</div>
                    <div className="ml-8">├── VSM/</div>
                    <div className="ml-8">├── SMED/</div>
                    <div className="ml-8">├── Time Study/</div>
                    <div className="ml-8">├── CI Projects/</div>
                    <div className="ml-8">├── Assessments/</div>
                    <div className="ml-8">├── Reports/</div>
                    <div className="ml-8">├── Contracts/</div>
                    <div className="ml-8">└── Other Documents/</div>
                  </div>

                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-950 font-semibold leading-relaxed">
                    ℹ️ Sistem doğrudan veritabanına büyük dosyalar kaydetmez. Yalnızca SharePoint / AWS S3 dosya referans ID'si ve erişim linkini saklar. Böylece veritabanı boyutu hafif kalır.
                  </div>
                </div>
              </div>
            )}

            {/* 8. AI MANAGEMENT */}
            {activeSection === 8 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      <span>8. AI Management Center (Yapay Zekâ Yönetimi)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Gemini, OpenAI, Claude API anahtarları vault'u, Prompt kütüphanesi ve AI uzman profilleri.
                    </p>
                  </div>
                  <button
                    onClick={() => showToast("AI Yapılandırması ve API anahtarları kaydedildi.")}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    API Anahtarını Kaydet
                  </button>
                </div>

                {/* AI Provider Selector */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { id: "gemini", name: "Google Gemini", active: true },
                    { id: "claude", name: "Anthropic Claude", active: false },
                    { id: "openai", name: "OpenAI GPT-4o", active: false },
                    { id: "azure", name: "Azure OpenAI", active: false },
                    { id: "local", name: "Local LLM (Ollama)", active: false }
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setAiProvider(p.id as any)}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        aiProvider === p.id 
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" 
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-extrabold text-xs">{p.name}</div>
                    </button>
                  ))}
                </div>

                {/* API Vault Input Box */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    Güvenli API Vault & Model Seçimi
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Gemini API Key (process.env.GEMINI_API_KEY)</label>
                      <div className="flex space-x-2">
                        <input
                          type={apiKeyShow ? "text" : "password"}
                          value={geminiApiKey}
                          onChange={(e) => setGeminiApiKey(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900 font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => setApiKeyShow(!apiKeyShow)}
                          className="p-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-200 cursor-pointer"
                        >
                          {apiKeyShow ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expert Profiles Grid */}
                    <div className="pt-3 border-t border-slate-100">
                      <label className="block text-slate-600 font-bold mb-2">Modül Bazlı Aktif AI Uzman Profilleri</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {activeExperts.map((exp) => (
                          <div key={exp.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{exp.icon} {exp.name}</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">{exp.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 9. INTEGRATION CENTER */}
            {activeSection === 9 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Network className="w-5 h-5 text-indigo-600" />
                      <span>9. Integration Center (Kurumsal Entegrasyon Merkezi)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      ERP, MES, SCADA, Power BI, Teams, Power Automate ve Webhook servis durumları.
                    </p>
                  </div>
                </div>

                {/* Integration Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {integrations.map((ing) => (
                    <div key={ing.id} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-extrabold text-sm text-slate-900">{ing.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{ing.category}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ing.status === "Connected" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {ing.status === "Connected" ? "🟢 Bağlı" : "🟡 Beklemede"}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-100 pt-2 font-mono">
                        <span>Gecikme (Ping): {ing.ping}</span>
                        <span>Son Senkron: {ing.lastSync}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 10. NOTIFICATION CENTER */}
            {activeSection === 10 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Bell className="w-5 h-5 text-indigo-600" />
                      <span>10. Notification Center (Bildirim & Alarm Kuralları)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      E-posta, MS Teams ve Push bildirim tetikleyicileri.
                    </p>
                  </div>
                  <button
                    onClick={() => showToast("Bildirim ayarları güncellendi.")}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    Kaydet
                  </button>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                    {[
                      { key: "email", label: "E-Posta Bildirim Kanalı" },
                      { key: "teams", label: "Microsoft Teams Bot Bildirimleri" },
                      { key: "mobilePush", label: "Mobil Push Notification" },
                      { key: "weeklyReport", label: "Haftalık Otomatik Yönetici Özeti" },
                      { key: "delayedActions", label: "Geciken Aksiyon ve Termin Uyarıları" },
                      { key: "upcomingDeadlines", label: "Yaklaşan Proje Bitiş Tarihi Hatırlatıcısı" },
                      { key: "aiSuggestions", label: "Yapay Zeka Otomatik İyileştirme Önerileri" },
                      { key: "storageLimitAlert", label: "Depolama Doluluk Uyarısı (>%80)" },
                      { key: "licenseExpiryAlert", label: "Lisans Bitiş Tarihi Hatırlatıcı (30 Gün Kala)" }
                    ].map((item) => (
                      <label key={item.key} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(notifChannels as any)[item.key]}
                          onChange={() => setNotifChannels(prev => ({ ...prev, [item.key]: !(prev as any)[item.key] }))}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 11. AUDIT LOGS */}
            {activeSection === 11 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <span>11. Audit Logs (Sistem Denetim Günlüğü)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Kritik işlem kayıtları, yetki ve ayar değişikliklerinin izleme kaydı.
                    </p>
                  </div>
                  <button
                    onClick={() => showToast("Audit log kayıtları CSV olarak indirildi.")}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center space-x-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV Dışa Aktar</span>
                  </button>
                </div>

                {/* Audit Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs text-left font-mono">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-3">Kim (User)</th>
                          <th className="px-4 py-3">Ne Yaptı (Action)</th>
                          <th className="px-4 py-3">Tarih</th>
                          <th className="px-4 py-3">Eski / Yeni Değer</th>
                          <th className="px-4 py-3">IP Adresi</th>
                          <th className="px-4 py-3">Sonuç</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {logs.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-bold text-slate-900 font-sans">{l.user}</td>
                            <td className="px-4 py-3 text-indigo-700 font-extrabold">{l.action}</td>
                            <td className="px-4 py-3 text-slate-400 text-[10px]">{l.time}</td>
                            <td className="px-4 py-3 text-[10px]">
                              <span className="text-red-600">{l.oldVal}</span> → <span className="text-emerald-600 font-bold">{l.newVal}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-[10px]">{l.ip}</td>
                            <td className="px-4 py-3">
                              <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                                {l.result}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 12. SYSTEM HEALTH */}
            {activeSection === 12 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Activity className="w-5 h-5 text-indigo-600" />
                      <span>12. System Health Dashboard (Gerçek Zamanlı Durum)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Veritabanı, API, AI ve sunucu kaynaklarının anlık durum telemetrisi.
                    </p>
                  </div>
                </div>

                {/* Services Status Badges */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { name: "Database", status: "Healthy 🟢" },
                    { name: "API Endpoint", status: "Healthy 🟢" },
                    { name: "AI Gemini Engine", status: "Healthy 🟢" },
                    { name: "Mail Service", status: "Healthy 🟢" },
                    { name: "SharePoint Link", status: "Healthy 🟢" }
                  ].map((s, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-2xl text-center shadow-xs">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{s.name}</div>
                      <div className="text-xs font-black text-emerald-600 mt-1">{s.status}</div>
                    </div>
                  ))}
                </div>

                {/* Telemetry Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">CPU Yükü</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{healthMetrics.cpuLoad}%</div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">RAM Kullanımı</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{healthMetrics.ramUsage}%</div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Ortalama Yanıt Süresi</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">{healthMetrics.responseTimeMs} ms</div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-xs">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Hata Oranı (Error Rate)</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">%{healthMetrics.errorRate}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 13. LICENSE & SUBSCRIPTION */}
            {activeSection === 13 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                      <span>13. License & Subscription (Lisans Yönetimi)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      SaaS abonelik paketinizin detayları, modül lisansları ve kullanım limitleri.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase">Abonelik Planı</div>
                      <div className="text-lg font-black text-slate-900">{licenseInfo.planType}</div>
                    </div>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-extrabold">
                      {licenseInfo.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-500 font-bold">Kullanıcı Limiti</div>
                      <div className="text-base font-black text-slate-900 mt-1">{licenseInfo.currentUsers} / {licenseInfo.maxUsers} Koltuk</div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-500 font-bold">Bulut Depolama</div>
                      <div className="text-base font-black text-slate-900 mt-1">{licenseInfo.storageUsedGb} GB / {licenseInfo.storageLimitGb} GB</div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-500 font-bold">Aylık AI Token Kullanımı</div>
                      <div className="text-base font-black text-slate-900 mt-1">{(licenseInfo.aiTokenUsedMonth / 1000000).toFixed(2)}M / 10M Token</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 14. BACKUP CENTER */}
            {activeSection === 14 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Archive className="w-5 h-5 text-indigo-600" />
                      <span>14. Backup Center (Yedekleme & Geri Yükleme)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      Veritabanı anlık manuel yedekleme, otomatik zamanlanmış yedekler ve geri yükleme.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newBk = {
                        id: `bk_${Date.now()}`,
                        name: `Sistem_Anlik_Yedek_${new Date().toISOString().slice(0,10)}.json`,
                        size: "14.5 MB",
                        date: new Date().toLocaleString("tr-TR"),
                        type: "Manuel Anlık"
                      };
                      setBackups([newBk, ...backups]);
                      showToast("Anlık sistem yedeği başarıyla oluşturuldu.");
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer flex items-center space-x-1"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Anlık Manuel Yedek Al</span>
                  </button>
                </div>

                {/* Backups Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800">
                    Yedek Geçmişi ({backups.length})
                  </div>
                  <table className="min-w-full divide-y divide-slate-100 text-xs text-left font-mono">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Yedek Dosya Adı</th>
                        <th className="px-4 py-3">Boyut</th>
                        <th className="px-4 py-3">Tarih</th>
                        <th className="px-4 py-3">Tip</th>
                        <th className="px-4 py-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {backups.map((bk) => (
                        <tr key={bk.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-900 font-sans">{bk.name}</td>
                          <td className="px-4 py-3 text-slate-500">{bk.size}</td>
                          <td className="px-4 py-3 text-slate-400">{bk.date}</td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                              {bk.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => showToast(`"${bk.name}" yedek dosyasına geri dönme simüle edildi.`)}
                              className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer font-sans"
                            >
                              Geri Yükle (Restore)
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 15. DEVELOPER CONSOLE (EMBEDDED SAAS SISTEM MIMARISI / ARCHITECTUREHUB) */}
            {activeSection === 15 && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Code2 className="w-5 h-5 text-indigo-600" />
                      <span>15. Developer Console (SaaS Sistem Mimarisi & Geliştirici Konsolu)</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      API mimarisi, ER diyagramları, REST servisleri, veritabanı ilişkileri ve debug araçları.
                    </p>
                  </div>
                </div>

                {/* EMBED ARCHITECTURE HUB COMPONENT HERE */}
                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
                  <ArchitectureHub />
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}
