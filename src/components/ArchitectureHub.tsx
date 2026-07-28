import React, { useState } from "react";
import { 
  Database, Layers, Cpu, ShieldCheck, Terminal, Network, 
  RefreshCw, FileCode2, GitFork, Smartphone, Share2, KeyRound, 
  History, FileSpreadsheet, Eye, Settings2, ArrowRight, Lock, 
  User, Check, Plus, Search, Building2, Play, AlertTriangle, HelpCircle
} from "lucide-react";

// --- ARCHITECTURE SCHEMAS & DATA STRUCTURES ---

interface SchemaTable {
  name: string;
  description: string;
  category: "core" | "security" | "analytics" | "operations" | "system";
  columns: {
    name: string;
    type: string;
    constraints: string;
    description: string;
  }[];
  relations: {
    column: string;
    targetTable: string;
    targetColumn: string;
    type: "1:1" | "1:N" | "N:M";
  }[];
}

const SCHEMA_TABLES: SchemaTable[] = [
  {
    name: "Companies",
    description: "Merkezi Müşteri/Şirket tanımları. SaaS platformunun ana kiracı (tenant) kartıdır.",
    category: "core",
    columns: [
      { name: "id", type: "UUID (PK)", constraints: "NOT NULL", description: "Benzersiz şirket ID" },
      { name: "company_name", type: "VARCHAR(255)", constraints: "NOT NULL", description: "Şirket ticari ünvanı" },
      { name: "group_company", type: "VARCHAR(255)", constraints: "NULL", description: "Holding veya grup şirket adı" },
      { name: "industry", type: "VARCHAR(100)", constraints: "NOT NULL", description: "Çalıştığı ana sektör (Otomotiv, Beyaz Eşya vs.)" },
      { name: "production_type", type: "VARCHAR(100)", constraints: "NOT NULL", description: "Üretim tipi (Seri, Sipariş Üzerine, Sürekli)" },
      { name: "employee_count", type: "INTEGER", constraints: "DEFAULT 0", description: "Toplam çalışan sayısı" },
      { name: "revenue", type: "NUMERIC(15,2)", constraints: "NULL", description: "Yıllık ciro (EUR/USD bazlı)" },
      { name: "opex_level", type: "VARCHAR(50)", constraints: "DEFAULT 'Beginner'", description: "Mevcut OPEX olgunluk seviyesi" },
      { name: "created_at", type: "TIMESTAMP", constraints: "DEFAULT NOW()", description: "Kayıt oluşturulma zamanı" }
    ],
    relations: []
  },
  {
    name: "Factories",
    description: "Şirketlere bağlı bağımsız üretim tesisleri. Tüm analizler bu tabloya bağlıdır.",
    category: "core",
    columns: [
      { name: "id", type: "UUID (PK)", constraints: "NOT NULL", description: "Benzersiz fabrika ID (FactoryID)" },
      { name: "company_id", type: "UUID (FK)", constraints: "NOT NULL", description: "İlişkili şirket ID" },
      { name: "factory_name", type: "VARCHAR(255)", constraints: "NOT NULL", description: "Fabrika veya lokasyon adı (Örn: Bolu Tesisleri)" },
      { name: "location_city", type: "VARCHAR(100)", constraints: "NOT NULL", description: "Bulunduğu şehir/bölge" },
      { name: "timezone", type: "VARCHAR(50)", constraints: "DEFAULT 'UTC'", description: "Tesisin yerel saat dilimi" },
      { name: "created_at", type: "TIMESTAMP", constraints: "DEFAULT NOW()", description: "Kayıt oluşturulma zamanı" }
    ],
    relations: [
      { column: "company_id", targetTable: "Companies", targetColumn: "id", type: "1:N" }
    ]
  },
  {
    name: "Users",
    description: "SaaS platformunun tüm kullanıcıları. Çoklu cihaz ve tekil kimlik doğrulama sağlar.",
    category: "security",
    columns: [
      { name: "id", type: "UUID (PK)", constraints: "NOT NULL", description: "Benzersiz kullanıcı ID" },
      { name: "email", type: "VARCHAR(255)", constraints: "UNIQUE, NOT NULL", description: "Kurumsal e-posta adresi (Single Source of Truth)" },
      { name: "full_name", type: "VARCHAR(255)", constraints: "NOT NULL", description: "Ad Soyad" },
      { name: "password_hash", type: "VARCHAR(255)", constraints: "NOT NULL", description: "Bcrypt hash şifresi" },
      { name: "role_id", type: "UUID (FK)", constraints: "NOT NULL", description: "Kullanıcı ana yetki rolü" },
      { name: "last_login", type: "TIMESTAMP", constraints: "NULL", description: "Son başarılı oturum açma zamanı" },
      { name: "status", type: "VARCHAR(50)", constraints: "DEFAULT 'Active'", description: "Kullanıcı durumu (Active, Suspended, Invited)" }
    ],
    relations: [
      { column: "role_id", targetTable: "Roles", targetColumn: "id", type: "1:N" }
    ]
  },
  {
    name: "Roles",
    description: "RBAC yapısını destekleyen kurumsal roller (Super Admin, Lean Manager vb.)",
    category: "security",
    columns: [
      { name: "id", type: "UUID (PK)", constraints: "NOT NULL", description: "Rol benzersiz ID" },
      { name: "role_name", type: "VARCHAR(100)", constraints: "UNIQUE, NOT NULL", description: "Rol ismi (Örn: Lean Manager)" },
      { name: "role_key", type: "VARCHAR(50)", constraints: "UNIQUE, NOT NULL", description: "Sistem seviyesindeki anahtar (LEAN_MANAGER)" },
      { name: "description", type: "TEXT", constraints: "NULL", description: "Rol yetki sınırları açıklaması" }
    ],
    relations: []
  },
  {
    name: "Permissions",
    description: "İnce taneli (Fine-grained) yetkilendirme yetenekleri matrisi.",
    category: "security",
    columns: [
      { name: "id", type: "UUID (PK)", constraints: "NOT NULL", description: "Yetki ID" },
      { name: "module", type: "VARCHAR(100)", constraints: "NOT NULL", description: "İlişkili sistem modülü (Örn: Kaizen)" },
      { name: "action", type: "VARCHAR(50)", constraints: "NOT NULL", description: "İzin tipi (CREATE, READ, UPDATE, DELETE)" },
      { name: "role_id", type: "UUID (FK)", constraints: "NOT NULL", description: "İlişkili rol ID" }
    ],
    relations: [
      { column: "role_id", targetTable: "Roles", targetColumn: "id", type: "1:N" }
    ]
  },
  {
    name: "Kaizens",
    description: "İyileştirme fikir havuzu. FactoryID bazlı Single Source of Truth iyileştirme yönetim tablosudur.",
    category: "analytics",
    columns: [
      { name: "id", type: "UUID (PK)", constraints: "NOT NULL", description: "Benzersiz Kaizen ID" },
      { name: "factory_id", type: "UUID (FK)", constraints: "NOT NULL", description: "İlgili fabrika ID (Asla firma adı kullanılmaz)" },
      { name: "title", type: "VARCHAR(255)", constraints: "NOT NULL", description: "Kaizen başlığı" },
      { name: "kaizen_type", type: "VARCHAR(100)", constraints: "DEFAULT 'Önce-Sonra'", description: "Kaizen kategorisi (Hızlı Kaizen, Kobetsu Kaizen vb.)" },
      { name: "author_id", type: "UUID (FK)", constraints: "NOT NULL", description: "Öneren kullanıcı" },
      { name: "before_image_url", type: "VARCHAR(512)", constraints: "NULL", description: "Mevcut Durum Görseli CDN adresi" },
      { name: "after_image_url", type: "VARCHAR(512)", constraints: "NULL", description: "Sonraki Durum Görseli CDN adresi" },
      { name: "benefit_score", type: "INTEGER", constraints: "DEFAULT 1", description: "Kazanç skoru (Maliyet, Ergonomi, Kalite, İSG)" },
      { name: "status", type: "VARCHAR(50)", constraints: "DEFAULT 'Draft'", description: "Onay durumu (Draft, Approved, Completed, Rejected)" }
    ],
    relations: [
      { column: "factory_id", targetTable: "Factories", targetColumn: "id", type: "1:N" },
      { column: "author_id", targetTable: "Users", targetColumn: "id", type: "1:N" }
    ]
  },
  {
    name: "SystemLogs",
    description: "Denetim izleri (Audit Trail) ve kullanıcı hareket geçmişi. IP ve eski/yeni değerlerle saklanır.",
    category: "system",
    columns: [
      { name: "id", type: "BIGSERIAL (PK)", constraints: "NOT NULL", description: "Ardışık büyük log ID" },
      { name: "user_id", type: "UUID (FK)", constraints: "NOT NULL", description: "Değişikliği yapan kullanıcı" },
      { name: "factory_id", type: "UUID (FK)", constraints: "NULL", description: "İşlem anındaki aktif tesis" },
      { name: "action_type", type: "VARCHAR(100)", constraints: "NOT NULL", description: "Gerçekleşen işlem (INSERT, UPDATE, DELETE, LOGIN)" },
      { name: "target_table", type: "VARCHAR(100)", constraints: "NOT NULL", description: "Etkilenen veri tabanı tablosu" },
      { name: "record_id", type: "VARCHAR(255)", constraints: "NOT NULL", description: "Etkilenen satırın anahtarı" },
      { name: "old_value", type: "JSONB", constraints: "NULL", description: "Değişiklik öncesi veri durumu" },
      { name: "new_value", type: "JSONB", constraints: "NULL", description: "Değişiklik sonrası veri durumu" },
      { name: "ip_address", type: "VARCHAR(45)", constraints: "NOT NULL", description: "Kullanıcı IPv4 veya IPv6 adresi" },
      { name: "user_agent", type: "VARCHAR(512)", constraints: "NULL", description: "İşlemin yapıldığı tarayıcı ve cihaz detayı" },
      { name: "created_at", type: "TIMESTAMP", constraints: "DEFAULT NOW()", description: "Olay zamanı" }
    ],
    relations: [
      { column: "user_id", targetTable: "Users", targetColumn: "id", type: "1:N" },
      { column: "factory_id", targetTable: "Factories", targetColumn: "id", type: "1:N" }
    ]
  }
];

export default function ArchitectureHub() {
  const [activeTab, setActiveTab] = useState<"eia" | "er" | "state" | "security" | "api" | "infra" | "plugin">("eia");
  const [selectedTable, setSelectedTable] = useState<string>("Companies");
  const [simulatedLogs, setSimulatedLogs] = useState<any[]>([
    {
      id: "10984",
      user: "hakan.bulgurlu@arcelik.com",
      action: "UPDATE",
      table: "Factories",
      record: "fac_eskisehir_01",
      old_val: '{"capacity_hour": 340, "shift_pattern": "3-Shift"}',
      new_val: '{"capacity_hour": 400, "shift_pattern": "4-Shift"}',
      ip: "192.168.12.87",
      agent: "Chrome / Windows 11 Desktop",
      time: "2026-07-02 11:21:05"
    },
    {
      id: "10983",
      user: "levent.cakiroglu@koc.com.tr",
      action: "INSERT",
      table: "Kaizens",
      record: "kz_b_904",
      old_val: "null",
      new_val: '{"title": "Bolu Depo Malzeme Ergonomik Raf", "factory_id": "fac_bolu_01"}',
      ip: "10.0.4.15",
      agent: "Safari / Apple iPad Pro",
      time: "2026-07-02 10:45:12"
    },
    {
      id: "10982",
      user: "operator.veli@arcelik.com",
      action: "INSERT",
      table: "SystemLogs",
      record: "log_34",
      old_val: "null",
      new_val: '{"action_type": "LOGIN", "status": "Success"}',
      ip: "176.234.19.12",
      agent: "Samsung Web Browser / Android Mobile",
      time: "2026-07-02 09:12:30"
    }
  ]);

  const [activeStateMock, setActiveStateMock] = useState({
    CurrentCompany: { id: "comp_arcelik", name: "Arçelik A.Ş.", industry: "Consumer Electronics" },
    CurrentFactory: { id: "fac_eskisehir", name: "Eskişehir Kompresör Fabrikası", location: "Eskişehir" },
    CurrentUser: { id: "usr_hakan", email: "hakan.bulgurlu@arcelik.com", name: "Hakan Bulgurlu" },
    CurrentRole: "Factory Manager",
    CurrentLanguage: "TR",
    CurrentYear: 2026,
    CurrentAudit: { id: "aud_5s_june", name: "Q2 5S Genel Denetimi" }
  });

  const handleStateChange = (field: string, val: string) => {
    setActiveStateMock(prev => {
      if (field === 'CurrentFactory') {
        const name = val === 'fac_bolu' ? 'Bolu Pişirici Cihazlar' : val === 'fac_eskisehir' ? 'Eskişehir Kompresör Fabrikası' : 'Romanya Arctic';
        return { ...prev, CurrentFactory: { id: val, name, location: "Türkiye" } };
      }
      if (field === 'CurrentRole') {
        return { ...prev, CurrentRole: val };
      }
      if (field === 'CurrentLanguage') {
        return { ...prev, CurrentLanguage: val };
      }
      if (field === 'CurrentYear') {
        return { ...prev, CurrentYear: parseInt(val) };
      }
      return prev;
    });
  };

  const handleSimulateLog = () => {
    const newLog = {
      id: Math.floor(Math.random() * 10000 + 11000).toString(),
      user: activeStateMock.CurrentUser.email,
      action: "UPDATE",
      table: "SystemSettings",
      record: "set_global_rules",
      old_val: JSON.stringify({ activeYear: activeStateMock.CurrentYear }),
      new_val: JSON.stringify({ activeYear: activeStateMock.CurrentYear + 1 }),
      ip: "172.56.24.11",
      agent: "Firefox / macOS (Apple Silicon)",
      time: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    setSimulatedLogs(prev => [newLog, ...prev]);
  };

  return (
    <div id="architecture-hub-container" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md uppercase tracking-wider">Solution Architect Vision</span>
            <span className="text-xs text-emerald-400 font-mono">• Multi-Tenant Enterprise SaaS</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1 flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-400 animate-pulse" />
            SaaS Sistem Mimari Merkezi <span className="text-xs font-normal text-slate-400">(Architecture Hub)</span>
          </h1>
          <p className="text-slate-300 text-xs mt-1 max-w-3xl leading-relaxed">
            Lean Manufacturing, OPEX, Kaizen ve Factory Analytics platformunun Microsoft Enterprise kalitesindeki ölçeklenebilir, ilişkisel, rol tabanlı, Single Source of Truth tabanlı merkezi mimari tasarımı.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          <a 
            href="#live-playground" 
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" /> Mimaride Gezin
          </a>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-wrap border-b border-slate-200 gap-1 bg-white p-1 rounded-xl shadow-xs">
        <button
          onClick={() => setActiveTab("eia")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "eia" 
              ? "bg-slate-900 text-white shadow-xs" 
              : "text-slate-600 hover:bg-slate-55 hover:text-slate-900"
          }`}
        >
          <Network className="w-4 h-4" /> Enterprise Bilgi Mimarisi
        </button>
        <button
          onClick={() => setActiveTab("er")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "er" 
              ? "bg-slate-900 text-white shadow-xs" 
              : "text-slate-600 hover:bg-slate-55 hover:text-slate-900"
          }`}
        >
          <Database className="w-4 h-4" /> İlişkisel ER Model & Veri Tabanı
        </button>
        <button
          onClick={() => setActiveTab("state")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "state" 
              ? "bg-slate-900 text-white shadow-xs" 
              : "text-slate-600 hover:bg-slate-55 hover:text-slate-900"
          }`}
        >
          <RefreshCw className="w-4 h-4" /> Global Context State
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "security" 
              ? "bg-slate-900 text-white shadow-xs" 
              : "text-slate-600 hover:bg-slate-55 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> RBAC Yetki & Veri Görünürlüğü
        </button>
        <button
          onClick={() => setActiveTab("api")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "api" 
              ? "bg-slate-900 text-white shadow-xs" 
              : "text-slate-600 hover:bg-slate-55 hover:text-slate-900"
          }`}
        >
          <Terminal className="w-4 h-4" /> API Tasarımı & Akış
        </button>
        <button
          onClick={() => setActiveTab("infra")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "infra" 
              ? "bg-slate-900 text-white shadow-xs" 
              : "text-slate-600 hover:bg-slate-55 hover:text-slate-900"
          }`}
        >
          <Cpu className="w-4 h-4" /> Altyapı, AI & Mobil Offline
        </button>
        <button
          onClick={() => setActiveTab("plugin")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "plugin" 
              ? "bg-slate-900 text-white shadow-xs" 
              : "text-slate-600 hover:bg-slate-55 hover:text-slate-900"
          }`}
        >
          <FileCode2 className="w-4 h-4" /> SaaS Modül Plug-In Motoru
        </button>
      </div>

      {/* Main Content Areas */}
      <div id="live-playground" className="transition-all duration-300">
        
        {/* TAB 1: Enterprise Information Architecture */}
        {activeTab === "eia" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Visual Architecture Hierarchy Canvas */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Network className="w-4.5 h-4.5 text-indigo-600" />
                  Müşteri &amp; Fabrika Hiyerarşik Dağılım Mimarisi
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-mono bg-indigo-50 text-indigo-600 rounded">Single Source of Truth (SSOT)</span>
              </div>

              {/* Hierarchy Visualizer */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <div className="space-y-4 max-w-lg mx-auto">
                  {/* SaaS Core Node */}
                  <div className="p-4 bg-slate-900 text-white rounded-xl shadow-sm text-center border-2 border-indigo-500">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none">PLATFORM CORE SEVIYESI</p>
                    <h4 className="text-sm font-black mt-1">Unified SaaS Multi-Tenant Database</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">1 DB • 1000+ Şirket • 100.000+ Kullanıcı</p>
                  </div>

                  <div className="flex justify-center">
                    <div className="w-0.5 h-6 bg-slate-300 border-dashed border-l"></div>
                  </div>

                  {/* Company Level */}
                  <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-xs text-center relative">
                    <div className="absolute top-2 left-3 flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                      <span className="text-[8px] text-blue-600 font-bold">COMANY_ID</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">ŞİRKET / HOLDİNG SEVİYESİ</p>
                    <h4 className="text-sm font-extrabold text-slate-800 mt-1">Müşteri Tanımı (Örn: Arçelik A.Ş.)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Sektör, Ciro, Çalışan Sayısı, OPEX Olgunluk Düzeyi</p>
                  </div>

                  <div className="flex justify-between px-12">
                    <div className="w-0.5 h-6 bg-slate-300"></div>
                    <div className="w-0.5 h-6 bg-slate-300"></div>
                    <div className="w-0.5 h-6 bg-slate-300"></div>
                  </div>

                  {/* Factories (The core partitioning element) */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 bg-indigo-50 border-2 border-indigo-600 text-indigo-900 rounded-lg text-center relative shadow-xs">
                      <span className="text-[9px] font-extrabold block">Bolu Fabrikası</span>
                      <span className="text-[8px] font-mono block text-indigo-600 mt-0.5">FactoryID: 01</span>
                    </div>
                    <div className="p-2.5 bg-indigo-50 border border-slate-300 text-slate-800 rounded-lg text-center relative">
                      <span className="text-[9px] font-bold block">Eskişehir Fabrikası</span>
                      <span className="text-[8px] font-mono block text-slate-500 mt-0.5">FactoryID: 02</span>
                    </div>
                    <div className="p-2.5 bg-indigo-50 border border-slate-300 text-slate-800 rounded-lg text-center relative">
                      <span className="text-[9px] font-bold block">Romanya Arctic</span>
                      <span className="text-[8px] font-mono block text-slate-500 mt-0.5">FactoryID: 03</span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="w-0.5 h-6 bg-slate-300 border-dashed border-l"></div>
                  </div>

                  {/* Global context & Module binding */}
                  <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-lg text-center">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest block">GLOBAL CONTEXT BINDING</span>
                    <h5 className="text-xs font-extrabold mt-0.5">FactoryID 01 Yüklendi (Bolu)</h5>
                    <div className="grid grid-cols-4 gap-1 mt-2 text-[8px] text-emerald-800 font-mono">
                      <span className="bg-emerald-100 p-1 rounded">5S Audit</span>
                      <span className="bg-emerald-100 p-1 rounded">SMED</span>
                      <span className="bg-emerald-100 p-1 rounded">Kaizen</span>
                      <span className="bg-emerald-100 p-1 rounded">OEE</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-900 uppercase">Enterprise Prensibimiz</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                    <div className="flex items-center space-x-2 text-rose-700">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider">Kesin Yasaklar</span>
                    </div>
                    <p className="text-[11px] text-rose-900 leading-relaxed">
                      Hiçbir modül kendi müşteri bilgisini oluşturamaz, kendi kullanıcısını tanımlayamaz ve bağımsız fabrika kaydı açamaz. Tüm modüller merkezi referanstan beslenir.
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                    <div className="flex items-center space-x-2 text-emerald-700">
                      <Check className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider">Korelasyon Kuralı</span>
                    </div>
                    <p className="text-[11px] text-emerald-900 leading-relaxed">
                      Asla firma adı, unvanı veya harici etiketlerle veri ilişkisi kurulmaz. Bütün analiz verileri doğrudan tekil <code className="font-mono bg-emerald-100 px-1 py-0.5 text-xs text-emerald-800 font-black">FactoryID</code> üzerinden ilişkilendirilir.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Architectural Explanations */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <HelpCircle className="w-4.5 h-4.5 text-slate-500" />
                Müşteri Yapısı Özellikleri
              </h3>

              <div className="space-y-4">
                <div className="border-l-4 border-indigo-500 pl-3">
                  <h4 className="text-xs font-black text-slate-800 uppercase">Multi-Tiers (Çok Katmanlılık)</h4>
                  <p className="text-[11px] text-slate-550 mt-1 leading-relaxed">
                    Sistem; Holding, Grup Şirketi, Şirket, Fabrika, Lokasyon, Departman, Proses ve Hat hiyerarşisini en ince ayrıntısına kadar destekler.
                  </p>
                </div>

                <div className="border-l-4 border-indigo-500 pl-3">
                  <h4 className="text-xs font-black text-slate-800 uppercase">Single Database Design</h4>
                  <p className="text-[11px] text-slate-550 mt-1 leading-relaxed">
                    Veritabanı düzeyinde fiziksel şema ayrımı yerine "Shared Database, Shared Schema" mantığı uygulanmıştır. Veri yalıtımı Row-Level Security (RLS) kuralları ve indekslenmiş kiracı alanları ile sağlanır.
                  </p>
                </div>

                <div className="border-l-4 border-indigo-500 pl-3">
                  <h4 className="text-xs font-black text-slate-800 uppercase">Dinamik Operasyon Profilleme</h4>
                  <p className="text-[11px] text-slate-550 mt-1 leading-relaxed">
                    Müşteri kartı sadece adres barındırmaz; üretim tipi (Seri, Sürekli), mevcut OPEX seviyesi, ciro, çalışan sayısı ve ürün grupları gibi stratejik metrikleri de tutar.
                  </p>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white uppercase">Teknik Başarı Hedefi</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Mimarimiz, PostgreSQL indeks optimizasyonları ve verimli JSONB veri tipleri kullanarak 1000+ firma ve 10 milyon+ satırı milisaniye seviyesinde arama ve listeleme performansı ile sorgulayabilir.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Relational ER Model & Veri Tabanı */}
        {activeTab === "er" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Table Details Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <Database className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">İlişkisel Veri Yapısı</h3>
              </div>
              <p className="text-[11px] text-slate-550 leading-relaxed">
                Aşağıdan SaaS mimarimizin ana tablolarından birini seçerek detaylı şema yapısını, veri tiplerini ve yabancı anahtar (FK) ilişkilerini inceleyebilirsiniz.
              </p>

              {/* Table Selector Buttons */}
              <div className="space-y-1.5 overflow-y-auto max-h-[380px] pr-1">
                {SCHEMA_TABLES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setSelectedTable(t.name)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedTable === t.name 
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm" 
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <span className={`w-2 h-2 rounded-full ${
                        t.category === 'core' ? "bg-blue-500" :
                        t.category === 'security' ? "bg-red-500" :
                        t.category === 'analytics' ? "bg-yellow-500" :
                        t.category === 'system' ? "bg-indigo-500" : "bg-emerald-500"
                      }`} />
                      <span className="text-xs font-extrabold font-mono truncate">{t.name}</span>
                    </div>
                    <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${selectedTable === t.name ? "text-white" : "text-slate-400"}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Table Fields Detail */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              {(() => {
                const tbl = SCHEMA_TABLES.find(t => t.name === selectedTable) || SCHEMA_TABLES[0];
                return (
                  <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">TABLE: {tbl.name}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Kategori: {tbl.category}</span>
                        </div>
                        <p className="text-xs text-slate-550 mt-1">{tbl.description}</p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 font-bold shrink-0">{tbl.columns.length} Sütun Tanımlı</span>
                    </div>

                    {/* Columns Grid */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 font-bold">
                            <th className="py-2.5 px-3">Kolon Adı</th>
                            <th className="py-2.5 px-3">Veri Tipi</th>
                            <th className="py-2.5 px-3">Kısıtlar (Constraints)</th>
                            <th className="py-2.5 px-3">Açıklama</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
                          {tbl.columns.map((c, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-extrabold text-slate-900">{c.name}</td>
                              <td className="py-2 px-3 text-indigo-600 font-medium">{c.type}</td>
                              <td className="py-2 px-3"><span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">{c.constraints}</span></td>
                              <td className="py-2 px-3 font-sans text-slate-500 text-xs">{c.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Relationships diagram representation */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                        <GitFork className="w-4 h-4 text-indigo-500" />
                        İlişki ve Bağlar (Entity Relations)
                      </h4>
                      {tbl.relations.length === 0 ? (
                        <p className="text-[11px] text-slate-500">Bu tablo ana bağımsız referans tablodur, başka bir tabloya bağımlı yabancı anahtar barındırmaz.</p>
                      ) : (
                        <div className="space-y-2">
                          {tbl.relations.map((rel, idx) => (
                            <div key={idx} className="flex items-center space-x-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-slate-200 shadow-3xs">
                              <span className="text-indigo-600 font-extrabold">{tbl.name}.{rel.column}</span>
                              <span className="text-slate-400">───({rel.type})───▶</span>
                              <span className="text-emerald-600 font-extrabold">{rel.targetTable}.{rel.targetColumn}</span>
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto">Fiziksel FK</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

          </div>
        )}

        {/* TAB 3: Global Context State */}
        {activeTab === "state" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Live State Controller Playground */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <Settings2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Global State Simülatörü</h3>
              </div>
              <p className="text-[11px] text-slate-550 leading-relaxed">
                Aşağıdaki alanları değiştirerek sistemin arkasındaki <code className="bg-slate-100 px-1 py-0.5 font-mono">Global State</code> yapısının nasıl anlık güncellendiğini ve tüm modüllerin bu veriye nasıl senkronize olduğunu test edebilirsiniz.
              </p>

              <div className="space-y-4">
                {/* Factory Switcher */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Aktif Tesis (CurrentFactory)</label>
                  <select 
                    value={activeStateMock.CurrentFactory.id}
                    onChange={(e) => handleStateChange('CurrentFactory', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="fac_eskisehir">Eskişehir Kompresör Fabrikası</option>
                    <option value="fac_bolu">Bolu Pişirici Cihazlar Fabrikası</option>
                    <option value="fac_arctic">Romanya Arctic Fabrikası</option>
                  </select>
                </div>

                {/* Role Switcher */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Kullanıcı Rolü (CurrentRole)</label>
                  <select 
                    value={activeStateMock.CurrentRole}
                    onChange={(e) => handleStateChange('CurrentRole', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Super Admin">Super Admin</option>
                    <option value="Factory Manager">Factory Manager</option>
                    <option value="Lean Manager">Lean Manager</option>
                    <option value="Operator">Operator</option>
                    <option value="Viewer">Viewer (Salt Okunur)</option>
                  </select>
                </div>

                {/* Language Switcher */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Sistem Dili (CurrentLanguage)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["TR", "EN", "DE"].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => handleStateChange('CurrentLanguage', lang)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          activeStateMock.CurrentLanguage === lang 
                            ? "bg-slate-900 border-slate-900 text-white" 
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Year Switcher */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Mali/Audit Yılı (CurrentYear)</label>
                  <select 
                    value={activeStateMock.CurrentYear}
                    onChange={(e) => handleStateChange('CurrentYear', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026 (Aktif Dönem)</option>
                    <option value="2027">2027 (Planlanan)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Context Output Tree */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Terminal className="w-4.5 h-4.5 text-indigo-600" />
                  Global Context React State Tree
                </h3>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>

              {/* State Tree Viewer */}
              <div className="bg-slate-950 text-emerald-400 font-mono text-xs p-5 rounded-2xl overflow-x-auto shadow-inner border border-slate-900">
                <div className="text-slate-500 mb-2">// GlobalContextState.ts - Live Readout</div>
                <pre className="leading-relaxed">
{JSON.stringify(activeStateMock, null, 2)}
                </pre>
              </div>

              {/* Explanation of how state is consumed */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-950">
                  <Layers className="w-4 h-4" />
                  <span className="text-xs font-black uppercase">React Context &amp; Custom Hooks</span>
                </div>
                <p className="text-[11px] text-indigo-900 leading-relaxed">
                  Tüm bağımsız sayfa ve alt modüller (Kaizen, 5S, SMED, Spaghetti vb.) <code className="bg-indigo-100/50 px-1 py-0.5 rounded font-mono font-bold text-indigo-950">useGlobalContext()</code> hook'unu kullanarak aktif fabrikanın verisini tüketirler. Şirket veya Tesis değiştiğinde, state üzerinden beslenen tüm veritabanı sorguları otomatik olarak yeni <code className="font-mono font-bold">FactoryID</code>'ye göre reaktif olarak yeniden çekilir.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: RBAC Yetki & Veri Görünürlüğü */}
        {activeTab === "security" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* RBAC Table Matrix */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-4.5 h-4.5 text-indigo-600" />
                  Rol Tabanlı Erişim Kontrolü (RBAC) Matrisi
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-mono bg-indigo-50 text-indigo-600 rounded">9 Farklı Kurumsal Rol</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold">
                      <th className="py-2.5 px-3">Sistem Rolü (Role Key)</th>
                      <th className="py-2.5 px-3">Erişim Seviyesi</th>
                      <th className="py-2.5 px-3 text-center">Create</th>
                      <th className="py-2.5 px-3 text-center">Read</th>
                      <th className="py-2.5 px-3 text-center">Update</th>
                      <th className="py-2.5 px-3 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700 font-mono">
                    <tr className="bg-indigo-50/20">
                      <td className="py-2.5 px-3 font-extrabold text-indigo-950">SUPER_ADMIN</td>
                      <td className="py-2.5 px-3 text-indigo-700">Tüm Platform Kayıtları</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-800">COMPANY_ADMIN</td>
                      <td className="py-2.5 px-3 text-slate-600">Aynı Şirketin Tüm Kayıtları</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">✘</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-800">FACTORY_MANAGER</td>
                      <td className="py-2.5 px-3 text-slate-600">Kendi Fabrikasının Kayıtları</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">✘</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-800">LEAN_MANAGER</td>
                      <td className="py-2.5 px-3 text-slate-600">Kendi Fabrikasının Kayıtları</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">✘</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-800">ENGINEER</td>
                      <td className="py-2.5 px-3 text-slate-600">Kendi Departman Kayıtları</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">✘</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-bold text-slate-800">OPERATOR</td>
                      <td className="py-2.5 px-3 text-slate-600">Kendi Fabrikası / Atanan İşler</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">✘</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">✘</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-800">VIEWER</td>
                      <td className="py-2.5 px-3 text-slate-600">Sadece İzleme (Read-Only)</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">✘</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">✔</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">✘</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">✘</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-900 uppercase">Veri Görünürlük Limitasyonu Seçenekleri (Data Visibility Controls)</h4>
                <p className="text-xs text-slate-550 leading-relaxed">
                  SaaS sistem yöneticileri, her bir kullanıcı veya rol seviyesi için veritabanındaki görünürlük kapsamını aşağıdaki seçeneklerle dinamik olarak kısıtlayabilir. Bu kısıtlama backend veritabanı sorgularındaki <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">WHERE</code> koşulunu dinamik olarak etkiler.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase block">1. Sadece Kendi</span>
                    <p className="text-[10px] text-slate-500 mt-1">Kullanıcı sadece kendi oluşturduğu kayıtları görür.</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase block">2. Aynı Fabrika</span>
                    <p className="text-[10px] text-slate-500 mt-1">Sadece aynı FactoryID'ye sahip kayıtları görür.</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase block">3. Aynı Şirket</span>
                    <p className="text-[10px] text-slate-500 mt-1">Şirketin tüm fabrikalarındaki verileri görür.</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase block">4. Tüm Platform</span>
                    <p className="text-[10px] text-slate-500 mt-1">Yalnızca Super Admin yetkisiyle tüm platformu görür.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Log Tracker Sandbox */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <History className="w-4.5 h-4.5 text-indigo-600" />
                  Merkezi Audit Log Sistemi
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-mono bg-indigo-50 text-indigo-600 rounded">Anlık Kayıt</span>
              </div>
              
              <p className="text-[11px] text-slate-550 leading-relaxed">
                Yasa gereği ve operasyonel mükemmellik gereğince sistemde yapılan her CRUD işlemi eski/yeni değerler, IP adresi ve tarayıcı bilgisi ile kaydedilir.
              </p>

              <button
                onClick={handleSimulateLog}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-85 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" /> Yeni Sistem Değişikliği Simüle Et
              </button>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {simulatedLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 shadow-2xs text-[11px]">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-slate-500">{log.time}</span>
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[9px] ${
                        log.action === 'UPDATE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>{log.action}</span>
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-700 block">Kullanıcı: {log.user}</span>
                      <span className="text-slate-500 block font-mono text-[10px]">Etkilenen Tablo: {log.table} ({log.record})</span>
                    </div>
                    <div className="bg-slate-900 text-slate-300 font-mono text-[9px] p-2 rounded-lg space-y-0.5 overflow-x-auto">
                      <div className="text-slate-500">// Değer Karşılaştırması</div>
                      <div>Eski: {log.old_val}</div>
                      <div className="text-emerald-400">Yeni: {log.new_val}</div>
                    </div>
                    <div className="text-[9px] text-slate-450 font-mono">
                      IP: {log.ip} • Cihaz: {log.agent}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: API Tasarımı & Akış */}
        {activeTab === "api" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* API Directory */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <Terminal className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">SaaS API Kataloğu</h3>
              </div>
              <p className="text-[11px] text-slate-550 leading-relaxed">
                Tüm modüller aynı backend sunucu katmanındaki API uç noktalarını (REST API) kullanır. JSON veri şemaları değişmez birer sözleşmedir.
              </p>

              <div className="space-y-2">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono text-[9px] font-bold rounded">GET</span>
                    <span className="text-[10px] font-mono text-emerald-800 font-bold">/api/business/customers</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Global müşteri, holding ve fabrika listesini döner.</p>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 bg-blue-600 text-white font-mono text-[9px] font-bold rounded">POST</span>
                    <span className="text-[10px] font-mono text-blue-800 font-bold">/api/auth/login</span>
                  </div>
                  <p className="text-[10px] text-slate-500">JWT token üretimi ile kimlik doğrulaması sağlar.</p>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 bg-amber-600 text-white font-mono text-[9px] font-bold rounded">PUT</span>
                    <span className="text-[10px] font-mono text-amber-800 font-bold">/api/business/kaizens</span>
                  </div>
                  <p className="text-[10px] text-slate-550">Kaizen verilerini günceller ve Audit Log yazar.</p>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 bg-purple-600 text-white font-mono text-[9px] font-bold rounded">POST</span>
                    <span className="text-[10px] font-mono text-purple-800 font-bold">/api/ai/analyze</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Gemini motoru üzerinden OEE ve VSM analizi üretir.</p>
                </div>
              </div>
            </div>

            {/* API Sandbox / Payload Reviewer */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <FileCode2 className="w-4.5 h-4.5 text-indigo-600" />
                  API Payload Sözleşmesi (Request/Response Örneği)
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-mono bg-indigo-50 text-indigo-600 rounded">RESTful Standard</span>
              </div>

              {/* REST specs */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 font-mono text-xs">
                  <span className="px-2.5 py-1 bg-amber-600 text-white font-black rounded-lg">PUT</span>
                  <span className="text-slate-800 font-black">/api/business/factories/:factoryId</span>
                  <span className="text-slate-400 ml-auto">Headers: [Authorization: Bearer JWT]</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Request JSON */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Request Body (JSON)</span>
                    <div className="bg-slate-950 text-slate-300 font-mono text-[11px] p-4 rounded-xl shadow-inner overflow-x-auto h-[260px] border border-slate-900">
<pre className="leading-relaxed">
{`{
  "factory_name": "Bolu Pişirici",
  "location_city": "Bolu",
  "metadata": {
    "opex_level": "Intermediate",
    "updated_by": "usr_hakan"
  },
  "audit_reason": "Yıllık revizyon"
}`}
</pre>
                    </div>
                  </div>

                  {/* Response JSON */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Response Payload (JSON)</span>
                    <div className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-xl shadow-inner overflow-x-auto h-[260px] border border-slate-900">
<pre className="leading-relaxed">
{`{
  "success": true,
  "message": "Factory updated",
  "data": {
    "id": "fac_bolu_01",
    "company_id": "comp_arcelik",
    "factory_name": "Bolu Pişirici",
    "location_city": "Bolu",
    "updated_at": "2026-07-02T11:21:05Z"
  },
  "audit_log_id": 10984
}`}
</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 6: Altyapı, AI & Mobil Offline */}
        {activeTab === "infra" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Visual Infrastructure diagram */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Cpu className="w-4.5 h-4.5 text-indigo-600" />
                  Cloud Run, AI Entegrasyon ve Veri Akış Mimarisi
                </h3>
                <span className="text-xs text-indigo-600 font-mono">Modern Cloud Engine</span>
              </div>

              {/* Flowchart description */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                    <div className="flex items-center space-x-1.5 text-slate-900">
                      <Smartphone className="w-4 h-4 text-slate-600" />
                      <span className="text-[11px] font-extrabold uppercase">1. Mobil &amp; Tablet Offline</span>
                    </div>
                    <p className="text-[10px] text-slate-550 leading-relaxed">
                      İnternet koptuğunda veriler yerel cihazdaki <strong>IndexedDB</strong> belleğinde şifreli olarak tutulur. Bağlantı algılandığı an otomatik <strong>fon senkronizasyonu</strong> başlar.
                    </p>
                  </div>

                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1 shadow-2xs">
                    <div className="flex items-center space-x-1.5 text-indigo-900">
                      <Share2 className="w-4 h-4 text-indigo-600" />
                      <span className="text-[11px] font-extrabold uppercase">2. API Gateway &amp; CDN</span>
                    </div>
                    <p className="text-[10px] text-slate-550 leading-relaxed">
                      Görsel ve dosyalar (pdf, ppt, video) doğrudan <strong>FactoryID</strong> ile ilişkilendirilerek CDN üzerinden şifreli linklerle servis edilir.
                    </p>
                  </div>

                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1 shadow-2xs">
                    <div className="flex items-center space-x-1.5 text-purple-900">
                      <Cpu className="w-4 h-4 text-purple-600 animate-pulse" />
                      <span className="text-[11px] font-extrabold uppercase">3. Gemini AI Core</span>
                    </div>
                    <p className="text-[10px] text-slate-550 leading-relaxed">
                      Yapay Zeka bağımsız bir veri deposu barındırmaz. Sadece mevcut VSM, OEE, SMED ve 5S verilerini güvenli tünelle analiz edip raporlar üretir.
                    </p>
                  </div>

                </div>

                {/* AI prompt Orchestration logic visualization */}
                <div className="border border-slate-200 bg-white rounded-xl p-4 space-y-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">AI Orchestration Engine Workflow</span>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 text-xs">
                    <div className="flex-1 p-2.5 bg-slate-100 rounded-lg font-mono text-[10px] text-slate-700">
                      <strong>Veri Toplama (SSOT)</strong>
                      <span className="block text-[9px] text-slate-500 mt-1">Aktif FactoryID'ye bağlı 5S, OEE, Kaizen verileri derlenir.</span>
                    </div>
                    <div className="flex items-center justify-center text-slate-400">➔</div>
                    <div className="flex-1 p-2.5 bg-indigo-50 rounded-lg font-mono text-[10px] text-indigo-900">
                      <strong>Prompt Sentezi</strong>
                      <span className="block text-[9px] text-indigo-600 mt-1">Görünürlük izinleri (RBAC) kontrol edilerek güvenli prompt şablonu oluşturulur.</span>
                    </div>
                    <div className="flex items-center justify-center text-slate-400">➔</div>
                    <div className="flex-1 p-2.5 bg-purple-100 text-purple-950 rounded-lg font-mono text-[10px]">
                      <strong>Gemini 2.5 Flash Analizi</strong>
                      <span className="block text-[9px] text-purple-700 mt-1">Milisaniyeler içinde OPEX aksiyon planı ve OEE analizi üretilir.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification and file management specs */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Share2 className="w-4.5 h-4.5 text-slate-500" />
                Yardımcı Sistem Yapıları
              </h3>

              <div className="space-y-4 text-xs">
                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <h4 className="font-extrabold text-slate-800">Bildirim Sistemi (Notifications)</h4>
                  <p className="text-[11px] text-slate-550 leading-relaxed">
                    Kaizen onayları, 5S denetim planları veya SMED hedefleri aşıldığında sistem içi anlık push bildirimleri ve e-posta tetiklenir. Tüm bildirimler <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px]">FactoryID</code> seviyesinde hedeflenir.
                  </p>
                </div>

                <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <h4 className="font-extrabold text-slate-800">Dosya Yönetim Sistemi (Files CDN)</h4>
                  <p className="text-[11px] text-slate-550 leading-relaxed">
                    Müşteri tesislerine ait fotoğraf, pdf, excel, word, video gibi dosyalar güvenli bir obje depolama ünitesinde tutulur. Her dosya meta-verisinde ilişkili <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px]">FactoryID</code> ve <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px]">CompanyID</code> barındırır.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 7: SaaS Modül Plug-In Motoru */}
        {activeTab === "plugin" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Code example */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <FileCode2 className="w-4.5 h-4.5 text-indigo-600" />
                  SaaS Modül Kayıt Sistemi (Plugin Registration Engine)
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-mono bg-indigo-50 text-indigo-600 rounded">Modüler Tasarım</span>
              </div>

              <p className="text-xs text-slate-550 leading-relaxed">
                Platformumuz, gelecekte eklenecek düzinelerce yeni Lean Manufacturing modülünün (OEE, Risk Analysis, COPQ vb.) tek bir satır kod değiştirmeden sisteme entegre olabilmesini sağlayan bir <strong>Plugin Mimarisini</strong> destekler.
              </p>

              <div className="bg-slate-950 text-slate-300 font-mono text-xs p-5 rounded-2xl overflow-x-auto shadow-inner border border-slate-900 space-y-1">
                <div className="text-slate-500">// opex-plugin-registry.ts - Yeni Modül Ekleme Örneği</div>
                <pre className="leading-relaxed">
{`interface OPEXModulePlugin {
  moduleId: string;
  moduleName: string;
  iconName: string;
  requiredPermissions: string[];
  renderComponent: React.ComponentType<{ factoryId: string }>;
}

// Yeni Bir OEE Modülü Eklemek Bu Kadar Kolay!
export const OEEModule: OPEXModulePlugin = {
  moduleId: "oee-analyzer",
  moduleName: "OEE Performans Takibi",
  iconName: "Activity",
  requiredPermissions: ["OEE_READ", "OEE_WRITE"],
  renderComponent: (props) => {
    // Tüm alt analizler global gelen factoryId üzerinden beslenir!
    return <OeePerformanceDashboard factoryId={props.factoryId} />;
  }
};`}
                </pre>
              </div>
            </div>

            {/* Plugin visual benefits */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-slate-500" />
                Plugin Mimarisinin Gücü
              </h3>

              <div className="space-y-4">
                <div className="flex items-start space-x-3 text-xs">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold shrink-0">01</div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 uppercase text-[11px]">Düşük Bağımlılık (Decoupling)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Modüller birbirinin kodunu bozmaz, izole şekilde geliştirilebilir.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-xs">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold shrink-0">02</div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 uppercase text-[11px]">Dinamik Yükleme (Code Splitting)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Modüller yalnızca kullanıcı o sekmeye tıkladığında yüklenerek sistem ilk açılış hızını korur.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 text-xs">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold shrink-0">03</div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 uppercase text-[11px]">Merkezi Veri Entegrasyonu</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Her yeni modül sisteme eklenirken, global state üzerinden otomatik olarak aktif fabrikanın verisine (<code className="font-mono">FactoryID</code>) bağlanır.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
