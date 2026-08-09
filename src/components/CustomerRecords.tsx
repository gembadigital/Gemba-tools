import React, { useState, useEffect } from "react";
import { Customer } from "../types";
import { 
  Users, Search, Plus, Filter, Maximize2, Minimize2, 
  Trash2, Edit, ChevronRight, PlusCircle, Building, CheckCircle2
} from "lucide-react";

// Workspace imports
import { getWorkspaceData } from "../data/workspaceDefaults";
import { CompanyWorkspaceExtended, FactoryAsset, ProjectPortfolioItem, TimelineMilestone, DocumentItem, KpiHistoryPoint, ProjectTeamMember } from "../types/workspace";
import CompanyProfileTab from "./workspace/CompanyProfileTab";
import CompanyDashboardTab from "./workspace/CompanyDashboardTab";
import DocumentVaultTab from "./workspace/DocumentVaultTab";
import ProjectPortfolioTab from "./workspace/ProjectPortfolioTab";
import AssetRegistryTab from "./workspace/AssetRegistryTab";
import TimelineTab from "./workspace/TimelineTab";
import ProjectTeamTab from "./workspace/ProjectTeamTab";

interface CustomerRecordsProps {
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onSelectCustomer: (customer: Customer) => void;
  selectedCustomer: Customer | null;
  token?: string;
  currentUser?: any;
  onRefreshCustomers?: () => void;
}

export default function CustomerRecords({
  customers,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onSelectCustomer,
  selectedCustomer,
  token = "",
  currentUser,
  onRefreshCustomers
}: CustomerRecordsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Thousand-separator display only (e.g. 1000000 -> "1.000.000") — the underlying state always
  // holds the real numeric value, this never gets written to the record as a formatted string.
  const formatThousands = (n: number): string => n > 0 ? n.toLocaleString("tr-TR") : "";
  const parseThousands = (s: string): number => parseInt(s.replace(/\D/g, ""), 10) || 0;

  // Active Workspace tab
  const [activeTab, setActiveTab] = useState<"dashboard" | "profile" | "projects" | "team" | "assets" | "timeline" | "documents">("dashboard");

  // Extended Workspace state for active customer
  const [workspace, setWorkspace] = useState<CompanyWorkspaceExtended | null>(null);

  // Form State for adding a new customer
  const [newCustState, setNewCustState] = useState({
    companyName: "",
    address: "",
    industry: "Otomotiv",
    productionType: "Seri İmalat (Mass)",
    annualRevenue: 0,
    currency: "₺",
    employeeCount: 0,
    mainContactPerson: "",
    mainContactEmail: "",
    notes: ""
  });

  // Load and sync extended workspace whenever selectedCustomer changes. Backend-persisted
  // (company_workspaces table via /api/business/company-workspace) — was localStorage-only
  // before, which meant "Proje Ekibi" and the rest of this data only existed in whichever
  // browser last edited it and was invisible to the server (Mail Gönder recipients, dashboards).
  useEffect(() => {
    if (!selectedCustomer) {
      setWorkspace(null);
      return;
    }
    let cancelled = false;
    fetch("/api/business/company-workspace", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": selectedCustomer.id
      }
    })
      .then(res => res.json())
      .then(res => {
        if (cancelled) return;
        if (res.success && res.data) {
          // Backfill for workspaces saved before "Yıllık Ciro" existed on this tab — otherwise
          // an existing customer's real Customer.annualRevenue would show as blank here until
          // the profile is saved once.
          const loaded = res.data as CompanyWorkspaceExtended;
          setWorkspace(loaded.annualRevenue !== undefined ? loaded : { ...loaded, annualRevenue: selectedCustomer.annualRevenue || 0 });
          return;
        }
        // One-time migration: nothing in the backend yet — if this browser has real,
        // previously-entered data under the old localStorage key, upload it instead of silently
        // discarding it in favor of freshly-generated template defaults.
        const legacyCached = localStorage.getItem(`gemba_company_workspace_${selectedCustomer.id}`);
        if (legacyCached) {
          try {
            const parsed = JSON.parse(legacyCached);
            setWorkspace(parsed);
            persistWorkspace(selectedCustomer.id, parsed);
            localStorage.removeItem(`gemba_company_workspace_${selectedCustomer.id}`);
            return;
          } catch (e) {
            // fall through to fresh defaults
          }
        }
        initializeWorkspace(selectedCustomer);
      })
      .catch(e => {
        console.error("Failed to load company workspace", e);
        if (!cancelled) initializeWorkspace(selectedCustomer);
      });
    return () => { cancelled = true; };
  }, [selectedCustomer, token]);

  const persistWorkspace = (customerId: string, data: CompanyWorkspaceExtended) => {
    fetch("/api/business/company-workspace", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-factory-id": customerId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ workspace: data })
    }).catch(e => console.error("Failed to save company workspace", e));
  };

  const initializeWorkspace = (cust: Customer) => {
    // Build a new workspace from real customer-card fields only — no fabricated fallback
    // numbers/names for anything the consultant hasn't actually entered yet.
    const template = getWorkspaceData(cust.id);
    const customized: CompanyWorkspaceExtended = {
      ...template,
      companyName: cust.companyName,
      industry: cust.industry,
      productionType: cust.productionType,
      taxNumber: "",
      taxOffice: cust.address || "",
      shortName: cust.companyName.substring(0, 10),
      website: "",
      country: "Türkiye",
      city: "",
      annualRevenue: cust.annualRevenue || 0,
      operational: {
        ...template.operational,
        productFamilies: cust.productionType ? [cust.productionType] : []
      },
      workforce: {
        ...template.workforce,
        totalEmployees: cust.employeeCount || 0,
        blueCollar: cust.employeeCount ? Math.round(cust.employeeCount * 0.8) : 0,
        whiteCollar: cust.employeeCount ? Math.round(cust.employeeCount * 0.2) : 0,
      },
      opex: {
        ...template.opex,
        leanMaturity: cust.copexScore || 0,
        oee: cust.copexScore || 0,
        opexScore: cust.copexScore || 0
      },
      contacts: {
        ...template.contacts,
        generalManager: cust.generalManager || "",
        factoryManager: cust.factoryManager || "",
        primaryContactName: cust.mainContactPerson || "",
        primaryContactEmail: cust.mainContactEmail || ""
      }
    };
    setWorkspace(customized);
    persistWorkspace(cust.id, customized);
  };

  const saveWorkspaceData = (updated: CompanyWorkspaceExtended) => {
    if (!selectedCustomer) return;
    setWorkspace(updated);
    persistWorkspace(selectedCustomer.id, updated);

    // Sync back critical core fields to the main Customer state in App.tsx
    onUpdateCustomer({
      ...selectedCustomer,
      companyName: updated.companyName || selectedCustomer.companyName,
      industry: updated.industry || selectedCustomer.industry,
      productionType: updated.productionType || selectedCustomer.productionType,
      copexScore: updated.opex.opexScore || selectedCustomer.copexScore,
      employeeCount: updated.workforce.totalEmployees || selectedCustomer.employeeCount,
      // Explicit undefined/null check (not `||`) so an intentionally-entered 0 isn't silently
      // overwritten back to the previous value — same `??`-vs-`||` bug class fixed elsewhere.
      annualRevenue: updated.annualRevenue ?? selectedCustomer.annualRevenue,
      notes: updated.opex.currentImprovementProgram || selectedCustomer.notes
    });
  };

  const industries = ["all", ...new Set(customers.map(c => c.industry))];

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.mainContactPerson.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIndustry = industryFilter === "all" || c.industry === industryFilter;
    return matchesSearch && matchesIndustry;
  });

  const handleAddNewCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustState.companyName) return;

    const newCust: Customer = {
      id: Math.random().toString(36).substring(2, 9),
      companyName: newCustState.companyName,
      address: newCustState.address,
      industry: newCustState.industry,
      productionType: newCustState.productionType,
      annualRevenue: Number(newCustState.annualRevenue) || 0,
      currency: newCustState.currency || "₺",
      employeeCount: Number(newCustState.employeeCount) || 0,
      mainContactPerson: newCustState.mainContactPerson,
      mainContactEmail: newCustState.mainContactEmail,
      factoryManager: "",
      factoryManagerEmail: "",
      generalManager: "",
      generalManagerEmail: "",
      copexScore: 0,
      assessmentDate: new Date().toISOString().split('T')[0],
      preliminaryAssessmentReport: "",
      notes: newCustState.notes,
      audits: []
    };

    onAddCustomer(newCust);
    setIsAdding(false);
    onSelectCustomer(newCust); // auto-select the newly added customer

    // Reset Form state
    setNewCustState({
      companyName: "",
      address: "",
      industry: "Otomotiv",
      productionType: "Seri İmalat (Mass)",
      annualRevenue: 0,
      currency: "₺",
      employeeCount: 0,
      mainContactPerson: "",
      mainContactEmail: "",
      notes: ""
    });
  };

  const workspaceTabs = [
    { id: "dashboard", label: "Yönetici Paneli", icon: Building },
    { id: "profile", label: "Şirket Profili", icon: Building },
    { id: "projects", label: "Proje Portföyü", icon: Building },
    { id: "team", label: "Proje Ekibi", icon: Users },
    { id: "assets", label: "Fabrika Varlıkları", icon: Building },
    { id: "timeline", label: "Proje Geçmişi", icon: Building },
    { id: "documents", label: "Belgeler", icon: Building }
  ] as const;

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${isFullscreen ? "fixed inset-0 bg-gray-50 z-50 p-6 overflow-y-auto" : ""}`} id="customers-module">
      {/* Left Sidebar - Customer Master List */}
      <div className="lg:col-span-3 bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-4 shadow-2xs h-[calc(100vh-220px)] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-xs flex items-center gap-1.5">
            <Users className="w-4 h-4 text-zinc-600" />
            Müşteri Kartı ({filteredCustomers.length})
          </h3>
          <button
            id="btn-add-customer-modal-trigger"
            onClick={() => setIsAdding(true)}
            className="p-1.5 hover:bg-gray-50 text-zinc-950 hover:text-zinc-700 rounded-lg transition-colors"
            title="Yeni Müşteri Ekle"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            id="input-sidebar-search"
            type="text"
            placeholder="Müşteri ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden focus:border-zinc-400 transition-all bg-gray-50/50"
          />
        </div>

        {/* Industry Filter */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1 border-b border-gray-50">
          {industries.map((ind) => (
            <button
              id={`industry-filter-btn-${ind}`}
              key={ind}
              onClick={() => setIndustryFilter(ind)}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md border whitespace-nowrap transition-all ${
                industryFilter === ind
                  ? "bg-zinc-950 text-white border-zinc-950"
                  : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
              }`}
            >
              {ind === "all" ? "Tüm Sektörler" : ind}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1 scrollbar-thin" id="sidebar-customers-list">
          {filteredCustomers.map((cust) => {
            const isSelected = selectedCustomer?.id === cust.id;
            return (
              <div
                id={`customer-card-${cust.id}`}
                key={cust.id}
                onClick={() => onSelectCustomer(cust)}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  isSelected
                    ? "bg-zinc-950 border-zinc-950 text-white shadow-xs"
                    : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/30 text-gray-700"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-xs line-clamp-1">{cust.companyName}</h4>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-sm font-semibold ${
                    isSelected ? "bg-zinc-800 text-zinc-300" : "bg-gray-100 text-gray-500"
                  }`}>
                    %{cust.copexScore || 50}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] opacity-80">
                  <span>{cust.industry}</span>
                  <span>{cust.employeeCount || 0} Çalışan</span>
                </div>
              </div>
            );
          })}
          {filteredCustomers.length === 0 && (
            <div className="text-center py-8 text-xs text-gray-400 italic">Müşteri bulunamadı.</div>
          )}
        </div>
      </div>

      {/* Right Content - Enterprise Company Workspace */}
      <div className="lg:col-span-9 flex flex-col gap-6" id="workspace-container">
        {selectedCustomer && workspace ? (
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-2xs flex flex-col gap-6">
            {/* Header / Active Customer Context Display */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                {workspace.logoUrl ? (
                  <img src={workspace.logoUrl} alt="Logo" referrerPolicy="no-referrer" className="w-12 h-12 rounded-xl object-cover border border-gray-100" />
                ) : (
                  <div className="w-12 h-12 bg-zinc-950 text-white rounded-xl flex items-center justify-center font-bold text-sm">
                    {workspace.companyName.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    {workspace.companyName}
                    <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-100 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Aktif Çalışma Alanı
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {workspace.industry} • {workspace.productionType} • {workspace.city}, {workspace.country}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Window Fullscreen */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  id="btn-toggle-fullscreen"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  title={isFullscreen ? "Küçült" : "Tam Ekran Yap"}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {currentUser?.role !== "Customer User" && (
                  <button
                    id="btn-delete-selected-customer"
                    onClick={() => onDeleteCustomer(selectedCustomer.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Müşteri Kartını Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-none gap-2">
              {workspaceTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    id={`workspace-tab-btn-${tab.id}`}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-xs font-bold transition-all whitespace-nowrap border-b-2 ${
                      isActive
                        ? "border-zinc-950 text-zinc-950 font-bold"
                        : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Panes */}
            <div className="flex-1" id="workspace-tab-panes">
              {activeTab === "profile" && (
                <CompanyProfileTab
                  workspace={workspace}
                  onSave={saveWorkspaceData}
                />
              )}

              {activeTab === "dashboard" && (
                <CompanyDashboardTab
                  workspace={workspace}
                  onUpdateKpiHistory={(updatedHistory) => {
                    saveWorkspaceData({ ...workspace, kpiHistory: updatedHistory });
                  }}
                />
              )}

              {activeTab === "documents" && (
                <DocumentVaultTab
                  workspace={workspace}
                  onUpdateDocuments={(updatedDocs) => {
                    saveWorkspaceData({ ...workspace, documents: updatedDocs });
                  }}
                />
              )}

              {activeTab === "projects" && (
                <ProjectPortfolioTab
                  workspace={workspace}
                  defaultCurrency={selectedCustomer?.currency}
                  token={token}
                  currentUser={currentUser}
                  onUpdateProjects={(updatedProjects) => {
                    saveWorkspaceData({ ...workspace, projects: updatedProjects });
                  }}
                />
              )}

              {activeTab === "team" && selectedCustomer && (
                <ProjectTeamTab
                  workspace={workspace}
                  customer={selectedCustomer}
                  token={token}
                  currentUser={currentUser}
                  onRefreshCustomers={onRefreshCustomers}
                  onUpdateTeam={(updatedTeam) => {
                    saveWorkspaceData({ ...workspace, projectTeam: updatedTeam });
                  }}
                />
              )}

              {activeTab === "assets" && (
                <AssetRegistryTab
                  workspace={workspace}
                  onUpdateAssets={(updatedAssets) => {
                    saveWorkspaceData({ ...workspace, assets: updatedAssets });
                  }}
                />
              )}

              {activeTab === "timeline" && (
                <TimelineTab
                  workspace={workspace}
                  onUpdateTimeline={(updatedTimeline) => {
                    saveWorkspaceData({ ...workspace, timeline: updatedTimeline });
                  }}
                />
              )}

            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center shadow-2xs h-[400px] flex flex-col justify-center items-center" id="workspace-welcome-pane">
            <Building className="w-12 h-12 text-gray-300 mb-4 animate-pulse" />
            <h3 className="text-base font-bold text-gray-900">Kurumsal Çalışma Alanı (Company Workspace)</h3>
            <p className="text-xs text-gray-500 max-w-sm mt-2 leading-relaxed">
              Lütfen sol listeden bir kurumsal müşteri seçin veya sağ üstteki artı butonunu kullanarak yeni bir firma kaydı açın.
            </p>
          </div>
        )}
      </div>

      {/* Add New Customer modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4" id="add-customer-modal">
          <div className="bg-white rounded-xl border border-gray-100 p-6 w-full max-w-lg shadow-xl animate-in fade-in zoom-in duration-150">
            <h3 className="font-bold text-gray-900 text-sm mb-4">Yeni Müşteri & Firma Tescil Formu</h3>
            <form onSubmit={handleAddNewCustomer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Firma Adı</label>
                  <input
                    id="input-modal-companyName"
                    type="text"
                    required
                    placeholder="Örn: Vestel Elektronik A.Ş."
                    value={newCustState.companyName}
                    onChange={(e) => setNewCustState({ ...newCustState, companyName: e.target.value })}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Sektör</label>
                  <input
                    id="input-modal-industry"
                    type="text"
                    required
                    placeholder="Örn: Dayanıklı Tüketim"
                    value={newCustState.industry}
                    onChange={(e) => setNewCustState({ ...newCustState, industry: e.target.value })}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Üretim Tipi</label>
                  <input
                    id="input-modal-productionType"
                    type="text"
                    placeholder="Örn: Seri İmalat, Hücresel"
                    value={newCustState.productionType}
                    onChange={(e) => setNewCustState({ ...newCustState, productionType: e.target.value })}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
                  />
                </div>
                {/* Para Birimi is its own field, chosen before the revenue amount — every other
                    module (VSM, Loss Analizi, Master Plan) reads this customer's `currency` for
                    every financial figure it shows, so it needs to be a deliberate, visible choice
                    at creation time rather than a small inline selector easy to leave at the
                    default and never revisit. */}
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Para Birimi</label>
                  <select
                    id="input-modal-currency"
                    value={newCustState.currency}
                    onChange={(e) => setNewCustState({ ...newCustState, currency: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden bg-white font-bold"
                    title="Para Birimi — bu müşterinin tüm modüllerdeki (VSM, Loss Analizi vb.) finansal alanları bu birimi kullanır"
                  >
                    <option value="₺">₺ TRY</option>
                    <option value="$">$ USD</option>
                    <option value="€">€ EUR</option>
                    <option value="£">£ GBP</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Yıllık Ciro ({newCustState.currency})</label>
                  <input
                    id="input-modal-annualRevenue"
                    type="text"
                    inputMode="numeric"
                    placeholder="Örn: 1.000.000"
                    value={formatThousands(newCustState.annualRevenue)}
                    onChange={(e) => setNewCustState({ ...newCustState, annualRevenue: parseThousands(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Çalışan Sayısı</label>
                  <input
                    id="input-modal-employeeCount"
                    type="number"
                    value={newCustState.employeeCount}
                    onChange={(e) => setNewCustState({ ...newCustState, employeeCount: parseInt(e.target.value) || 0 })}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Birincil Kontak Adı</label>
                  <input
                    id="input-modal-contactPerson"
                    type="text"
                    placeholder="Örn: Ali Yılmaz"
                    value={newCustState.mainContactPerson}
                    onChange={(e) => setNewCustState({ ...newCustState, mainContactPerson: e.target.value })}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Birincil Kontak E-posta</label>
                  <input
                    id="input-modal-contactEmail"
                    type="email"
                    placeholder="ali@vestel.com"
                    value={newCustState.mainContactEmail}
                    onChange={(e) => setNewCustState({ ...newCustState, mainContactEmail: e.target.value })}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Adres / Konum</label>
                  <input
                    id="input-modal-address"
                    type="text"
                    value={newCustState.address}
                    onChange={(e) => setNewCustState({ ...newCustState, address: e.target.value })}
                    className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-50">
                <button
                  id="btn-modal-cancel"
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  id="btn-modal-save"
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-zinc-950 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Firmayı Tescil Et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
