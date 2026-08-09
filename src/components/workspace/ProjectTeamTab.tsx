import React, { useState, useEffect } from "react";
import { CompanyWorkspaceExtended, ProjectTeamMember } from "../../types/workspace";
import { Customer } from "../../types";
import { Plus, Trash2, Pencil, Users, Shield, Mail, UserCheck, AlertCircle, CheckCircle2, UserPlus, ShieldCheck } from "lucide-react";

interface TeamBrief {
  id: string;
  full_name: string;
  email: string;
}

interface PendingInvite {
  email: string;
}

interface ProjectTeamTabProps {
  workspace: CompanyWorkspaceExtended;
  customer: Customer;
  token: string;
  currentUser: any;
  onRefreshCustomers?: () => void;
  onUpdateTeam: (team: ProjectTeamMember[]) => void;
}

const MAX_CONSULTANTS_PER_CUSTOMER = 3;
const MAX_CUSTOMER_USER_INVITES_PER_CUSTOMER = 2;

export default function ProjectTeamTab({ workspace, customer, token, currentUser, onRefreshCustomers, onUpdateTeam }: ProjectTeamTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [category, setCategory] = useState<"management" | "member">("management");

  // Member Form States
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("Bölüm Müdürü");
  const [email, setEmail] = useState("");
  const [isProjectCoordinator, setIsProjectCoordinator] = useState(false);
  // Set to the member's id while editing an existing entry; null while adding a new one — same
  // form/modal is reused for both so role/category selection works identically in edit mode.
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const teamList = workspace.projectTeam || [];

  // Real consultant/customer-user assignment data, resolved server-side from the customer record.
  const [teamData, setTeamData] = useState<{
    primaryConsultant: TeamBrief | null;
    consultants: TeamBrief[];
    customerUsers: TeamBrief[];
    pendingConsultantInvites: PendingInvite[];
    pendingCustomerUserInvites: PendingInvite[];
  }>({
    primaryConsultant: null,
    consultants: [],
    customerUsers: [],
    pendingConsultantInvites: [],
    pendingCustomerUserInvites: []
  });

  const [showAddConsultantForm, setShowAddConsultantForm] = useState(false);
  const [consultantEmail, setConsultantEmail] = useState("");
  const [consultantError, setConsultantError] = useState("");
  const [consultantBusy, setConsultantBusy] = useState(false);

  const [showInviteCustomerUserForm, setShowInviteCustomerUserForm] = useState(false);
  const [customerUserEmail, setCustomerUserEmail] = useState("");
  const [customerUserError, setCustomerUserError] = useState("");
  const [customerUserBusy, setCustomerUserBusy] = useState(false);

  const [teamSuccessMessage, setTeamSuccessMessage] = useState("");

  const fetchTeam = () => {
    if (!token || !customer?.id) return;
    fetch(`/api/business/customers/${customer.id}/team`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setTeamData({
            primaryConsultant: res.data.primaryConsultant || null,
            consultants: res.data.consultants || [],
            customerUsers: res.data.customerUsers || [],
            pendingConsultantInvites: res.data.pendingConsultantInvites || [],
            pendingCustomerUserInvites: res.data.pendingCustomerUserInvites || []
          });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, token]);

  const isAdmin = currentUser?.role === "Admin";

  // Org-wide Consultant/Admin roster, for the Primary Consultant picker below. Nothing in the app
  // ever writes `customer.primaryConsultantId` on its own — invitation acceptance and "İlave
  // Danışman Ekle" both only ever add to the secondary `consultantIds` list — so for a customer
  // whose primary was never set (e.g. created before this existed, or never assigned), there was
  // genuinely no way to assign one anywhere in the UI. Admin-only, same as the org-chart-level
  // "/role" and "/status" admin actions elsewhere.
  const [orgConsultants, setOrgConsultants] = useState<TeamBrief[]>([]);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);
  const [primaryPickerValue, setPrimaryPickerValue] = useState("");
  const [primaryConsultantBusy, setPrimaryConsultantBusy] = useState(false);
  const [primaryConsultantError, setPrimaryConsultantError] = useState("");

  useEffect(() => {
    if (!isAdmin || !token) return;
    fetch("/api/admin/users", { headers: { "Authorization": `Bearer ${token}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setOrgConsultants((res.users || []).filter((u: any) => u.role === "Consultant" || u.role === "Admin"));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token]);

  const handleSetPrimaryConsultant = async () => {
    if (!primaryPickerValue) return;
    setPrimaryConsultantBusy(true);
    setPrimaryConsultantError("");
    try {
      const res = await fetch(`/api/business/customers/${customer.id}/set-primary-consultant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ consultantId: primaryPickerValue })
      });
      const data = await res.json();
      if (!data.success) {
        setPrimaryConsultantError(data.error || "Birincil danışman atanamadı.");
        return;
      }
      setIsSettingPrimary(false);
      setPrimaryPickerValue("");
      fetchTeam();
      onRefreshCustomers?.();
    } catch (e: any) {
      setPrimaryConsultantError(e.message || "Birincil danışman atanamadı.");
    } finally {
      setPrimaryConsultantBusy(false);
    }
  };
  const isPrimaryConsultant = currentUser?.id === customer.primaryConsultantId;
  const isAssignedConsultant = isPrimaryConsultant || teamData.consultants.some((c) => c.id === currentUser?.id);
  const canManageConsultants = isAdmin || isPrimaryConsultant;
  const canInviteCustomerUser = isAdmin || isAssignedConsultant;

  const consultantCount = (customer.primaryConsultantId ? 1 : 0) + teamData.consultants.length + teamData.pendingConsultantInvites.length;
  const customerUserCount = teamData.customerUsers.length + teamData.pendingCustomerUserInvites.length;

  // Allowed Roles
  const managementRoles = [
    "Genel müdür",
    "GM Yardımcısı",
    "Direktör",
    "Fabrika Müdürü",
    "Operasyon Müdürü",
    "Bölüm Müdürü"
  ];

  const memberRoles = [
    "Bölüm Müdürü",
    "Yönetici",
    "Lider",
    "Uzman",
    "Mühendis",
    "Asistan",
    "Formen",
    "Supervizor"
  ];

  const handleCategoryChange = (cat: "management" | "member") => {
    setCategory(cat);
    if (cat === "management") {
      setRole("Bölüm Müdürü");
    } else {
      setRole("Mühendis");
    }
  };

  const resetMemberForm = () => {
    setName("");
    setDepartment("");
    setEmail("");
    setIsProjectCoordinator(false);
    setEditingMemberId(null);
    setShowAddForm(false);
  };

  const handleStartEditMember = (member: ProjectTeamMember) => {
    setEditingMemberId(member.id);
    setCategory(member.category);
    setName(member.name);
    setDepartment(member.department);
    setRole(member.role);
    setEmail(member.email);
    setIsProjectCoordinator(!!member.isProjectCoordinator);
    setShowAddForm(true);
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !department.trim() || !role || !email.trim()) return;

    // If marked as coordinator, unmark whichever other member previously held it
    let updatedTeamList = teamList;
    if (isProjectCoordinator) {
      updatedTeamList = teamList.map(m => ({ ...m, isProjectCoordinator: m.id === editingMemberId }));
    }

    if (editingMemberId) {
      updatedTeamList = updatedTeamList.map(m =>
        m.id === editingMemberId
          ? { ...m, name: name.trim(), department: department.trim(), role, email: email.trim(), category, isProjectCoordinator }
          : m
      );
    } else {
      const newMember: ProjectTeamMember = {
        id: "tm_" + Math.random().toString(36).substring(2, 9),
        name: name.trim(),
        department: department.trim(),
        role,
        email: email.trim(),
        category,
        isProjectCoordinator
      };
      updatedTeamList = [...updatedTeamList, newMember];
    }

    onUpdateTeam(updatedTeamList);
    resetMemberForm();
  };

  const handleDeleteMember = (id: string) => {
    const updatedTeam = teamList.filter(m => m.id !== id);
    onUpdateTeam(updatedTeam);
  };

  const handleAddConsultant = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsultantError("");
    setTeamSuccessMessage("");
    if (!consultantEmail.trim()) return;
    setConsultantBusy(true);
    try {
      const res = await fetch(`/api/business/customers/${customer.id}/consultants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: consultantEmail.trim() })
      }).then((r) => r.json());
      if (!res.success) {
        setConsultantError(res.error || "Danışman eklenemedi.");
        return;
      }
      setTeamSuccessMessage(res.message || "Danışman eklendi.");
      setConsultantEmail("");
      setShowAddConsultantForm(false);
      fetchTeam();
      onRefreshCustomers?.();
    } catch (err: any) {
      setConsultantError(err.message || "Danışman eklenemedi.");
    } finally {
      setConsultantBusy(false);
    }
  };

  const handleDeleteConsultant = async (userId: string) => {
    try {
      const res = await fetch(`/api/business/customers/${customer.id}/consultants/${userId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      }).then((r) => r.json());
      if (res.success) {
        fetchTeam();
        onRefreshCustomers?.();
      }
    } catch (e) {
      // no-op — transient network failure, user can retry
    }
  };

  const handleInviteCustomerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerUserError("");
    setTeamSuccessMessage("");
    if (!customerUserEmail.trim()) return;
    setCustomerUserBusy(true);
    try {
      const res = await fetch(`/api/business/customers/${customer.id}/invite-customer-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: customerUserEmail.trim() })
      }).then((r) => r.json());
      if (!res.success) {
        setCustomerUserError(res.error || "Davet gönderilemedi.");
        return;
      }
      setTeamSuccessMessage(res.message || "Davet gönderildi.");
      setCustomerUserEmail("");
      setShowInviteCustomerUserForm(false);
      fetchTeam();
    } catch (err: any) {
      setCustomerUserError(err.message || "Davet gönderilemedi.");
    } finally {
      setCustomerUserBusy(false);
    }
  };

  const projectCoordinator = teamList.find(m => m.isProjectCoordinator);
  const managements = teamList.filter(m => m.category === "management");
  const members = teamList.filter(m => m.category === "member");

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="project-team-module">

      {teamSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{teamSuccessMessage}</span>
        </div>
      )}

      {/* SECTION 1: PROJE DANIŞMANLARI PANELİ */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-zinc-900" />
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Proje Danışmanları ({consultantCount}/{MAX_CONSULTANTS_PER_CUSTOMER})
              </h4>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Bu müşteride en fazla {MAX_CONSULTANTS_PER_CUSTOMER} danışman görevli olabilir (1 Birincil + {MAX_CONSULTANTS_PER_CUSTOMER - 1} ilave). Yalnızca Yönetici veya Birincil Danışman ilave danışman ekleyebilir.
            </p>
          </div>
          {!showAddConsultantForm && canManageConsultants && consultantCount < MAX_CONSULTANTS_PER_CUSTOMER && (
            <button
              type="button"
              onClick={() => setShowAddConsultantForm(true)}
              className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              İlave Danışman Ekle
            </button>
          )}
        </div>

        {/* İlave Danışman Ekleme Formu */}
        {showAddConsultantForm && (
          <form onSubmit={handleAddConsultant} className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3">
            <h5 className="text-xs font-bold text-gray-800">Danışman E-Postası</h5>
            <p className="text-[10px] text-gray-500">
              Sistemde zaten kayıtlı bir Danışman/Yönetici e-postası girilirse doğrudan eklenir; kayıtlı değilse gerçek bir davet oluşturulur.
            </p>

            {consultantError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{consultantError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-9 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">E-Posta Adresi</label>
                <input
                  type="email"
                  required
                  value={consultantEmail}
                  onChange={(e) => setConsultantEmail(e.target.value)}
                  placeholder="danisman@gembapartner.com"
                  className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-800"
                />
              </div>

              <div className="sm:col-span-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddConsultantForm(false);
                    setConsultantError("");
                  }}
                  className="w-1/2 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={consultantBusy}
                  className="w-1/2 py-2 bg-zinc-950 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 disabled:opacity-50"
                >
                  {consultantBusy ? "Ekleniyor..." : "Ekle"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Danışman Listesi */}
        <div className="divide-y divide-gray-100">
          {teamData.primaryConsultant ? (
            <div key={teamData.primaryConsultant.id} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-extrabold text-xs shadow-2xs bg-zinc-900 text-white">
                  1.D
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{teamData.primaryConsultant.full_name}</span>
                    <span className="text-[11px] px-1.5 py-0.2 rounded font-bold border bg-zinc-100 text-zinc-800 border-zinc-200">
                      1. Danışman (Birincil)
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">{teamData.primaryConsultant.email}</div>
                </div>
              </div>
              {isAdmin && !isSettingPrimary && (
                <button
                  type="button"
                  onClick={() => { setIsSettingPrimary(true); setPrimaryPickerValue(""); setPrimaryConsultantError(""); }}
                  className="text-[10px] font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 px-2 py-1 rounded-lg transition-colors shrink-0"
                >
                  Değiştir
                </button>
              )}
            </div>
          ) : (
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-extrabold text-xs shadow-2xs bg-gray-100 text-gray-400 border border-dashed border-gray-300">
                  1.D
                </div>
                <span className="text-xs font-semibold text-gray-400">Birincil danışman atanmamış</span>
              </div>
              {isAdmin && !isSettingPrimary && (
                <button
                  type="button"
                  onClick={() => { setIsSettingPrimary(true); setPrimaryPickerValue(""); setPrimaryConsultantError(""); }}
                  className="text-[10px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  Birincil Danışman Ata
                </button>
              )}
            </div>
          )}
          {isSettingPrimary && (
            <div className="py-3 space-y-2 bg-zinc-50/60 -mx-4 px-4">
              <label className="text-[10px] font-bold text-gray-500 uppercase block">
                {teamData.primaryConsultant ? "Yeni Birincil Danışman" : "Birincil Danışman Seç"}
              </label>
              <div className="flex gap-2">
                <select
                  value={primaryPickerValue}
                  onChange={(e) => setPrimaryPickerValue(e.target.value)}
                  className="flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">Danışman seçin…</option>
                  {orgConsultants.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSetPrimaryConsultant}
                  disabled={!primaryPickerValue || primaryConsultantBusy}
                  className="shrink-0 bg-zinc-950 text-white text-xs font-bold px-3 py-2 rounded-lg disabled:opacity-50"
                >
                  {primaryConsultantBusy ? "Atanıyor..." : "Ata"}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsSettingPrimary(false); setPrimaryConsultantError(""); }}
                  disabled={primaryConsultantBusy}
                  className="shrink-0 text-xs font-bold text-gray-500 hover:bg-gray-100 px-3 py-2 rounded-lg disabled:opacity-50"
                >
                  İptal
                </button>
              </div>
              {primaryConsultantError && (
                <p className="text-[10px] text-red-600 font-semibold">{primaryConsultantError}</p>
              )}
            </div>
          )}
          {teamData.consultants.map((cons, idx) => (
            <div key={cons.id} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-extrabold text-xs shadow-2xs bg-blue-600 text-white">
                  {idx + 2}.D
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{cons.full_name}</span>
                    <span className="text-[11px] px-1.5 py-0.2 rounded font-bold border bg-blue-50 text-blue-800 border-blue-200">
                      İlave Danışman
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">{cons.email}</div>
                </div>
              </div>
              {canManageConsultants && (
                <button
                  type="button"
                  onClick={() => handleDeleteConsultant(cons.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  title="Danışmanı Kaldır"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {teamData.pendingConsultantInvites.map((inv) => (
            <div key={inv.email} className="py-3 flex items-center gap-3">
              <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-extrabold text-xs shadow-2xs bg-amber-100 text-amber-700">
                ...
              </div>
              <div>
                <span className="text-xs font-bold text-amber-900">{inv.email}</span>
                <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Davet gönderildi, kabul bekleniyor</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 1.1: MÜŞTERİ KULLANICISI DAVETİ */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-zinc-900" />
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Müşteri Kullanıcıları ({customerUserCount}/{MAX_CUSTOMER_USER_INVITES_PER_CUSTOMER})
              </h4>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Bu müşteri için en fazla {MAX_CUSTOMER_USER_INVITES_PER_CUSTOMER} müşteri kullanıcısı davet edilebilir. Davet edilen kişi sisteme girdiğinde yalnızca bu müşterinin verilerini görür.
            </p>
          </div>
          {!showInviteCustomerUserForm && canInviteCustomerUser && customerUserCount < MAX_CUSTOMER_USER_INVITES_PER_CUSTOMER && (
            <button
              type="button"
              onClick={() => setShowInviteCustomerUserForm(true)}
              className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Müşteri Kullanıcısı Davet Et
            </button>
          )}
        </div>

        {showInviteCustomerUserForm && (
          <form onSubmit={handleInviteCustomerUser} className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3">
            <h5 className="text-xs font-bold text-gray-800">Müşterinin Kendi Personelinin E-Postası</h5>

            {customerUserError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{customerUserError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-9 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">E-Posta Adresi</label>
                <input
                  type="email"
                  required
                  value={customerUserEmail}
                  onChange={(e) => setCustomerUserEmail(e.target.value)}
                  placeholder={`ornek@${customer.companyName ? "musteri-firma.com" : "firma.com"}`}
                  className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-800"
                />
              </div>
              <div className="sm:col-span-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteCustomerUserForm(false);
                    setCustomerUserError("");
                  }}
                  className="w-1/2 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={customerUserBusy}
                  className="w-1/2 py-2 bg-zinc-950 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 disabled:opacity-50"
                >
                  {customerUserBusy ? "Gönderiliyor..." : "Davet Et"}
                </button>
              </div>
            </div>
          </form>
        )}

        {teamData.customerUsers.length === 0 && teamData.pendingCustomerUserInvites.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs flex flex-col items-center justify-center gap-1.5">
            <Users className="w-5 h-5 text-gray-300" />
            Henüz davet edilmiş müşteri kullanıcısı yok.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {teamData.customerUsers.map((cu) => (
              <div key={cu.id} className="py-3 flex items-center gap-3">
                <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-extrabold text-xs shadow-2xs bg-emerald-600 text-white">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">{cu.full_name}</span>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">{cu.email}</div>
                </div>
              </div>
            ))}
            {teamData.pendingCustomerUserInvites.map((inv) => (
              <div key={inv.email} className="py-3 flex items-center gap-3">
                <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-extrabold text-xs shadow-2xs bg-amber-100 text-amber-700">
                  ...
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-900">{inv.email}</span>
                  <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Davet gönderildi, kabul bekleniyor</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PROJE KOORDİNATÖRÜ BİLGİLENDİRME BANNERI */}
      {projectCoordinator && (
        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-blue-900 font-medium">
            <Mail className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Proje Koordinatörü Belirlendi:</strong> {projectCoordinator.name} ({projectCoordinator.email}) — Belge, veri aktarımları ve maillerde otomatik olarak <strong>"KİME (To)"</strong> alıcısı olarak atanacaktır.
            </span>
          </div>
          <span className="text-[11px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
            KİME (To) Alıcısı
          </span>
        </div>
      )}

      {/* SECTION 2: MÜŞTERİ PROJE EKİBİ & YÖNETİM KADROSU */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Müşteri Proje Ekibi & Yönetim Kadrosu</h4>
          <p className="text-[10px] text-gray-500 mt-1">
            Müşteri organizasyon yapısındaki opex yönetim kadrosu ve projeden sorumlu ekip üyeleri.
          </p>
        </div>
        {!showAddForm && (
          <button
            id="btn-add-team-member-trigger"
            onClick={() => {
              setEditingMemberId(null);
              setShowAddForm(true);
              setCategory("management");
              setRole("Bölüm Müdürü");
            }}
            className="px-4 py-2 bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 text-xs font-medium transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            Yeni Üye Ekle
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleSaveMember} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4 shadow-2xs" id="team-member-form">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h4 className="font-semibold text-gray-900 text-xs">{editingMemberId ? "Ekip Üyesini Düzenle" : "Yeni Ekip Üyesi Tanımlama"}</h4>
            <div className="flex gap-1.5 p-0.5 bg-gray-100 rounded-lg">
              <button
                type="button"
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  category === "management" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800"
                }`}
                onClick={() => handleCategoryChange("management")}
              >
                Yönetim Kadrosu
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  category === "member" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800"
                }`}
                onClick={() => handleCategoryChange("member")}
              >
                Proje Ekip Üyesi
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">İsim Soyisim</label>
              <input
                id="input-member-name"
                type="text"
                required
                placeholder="Örn: Ahmet Yılmaz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Bölüm / Departman</label>
              <input
                id="input-member-dept"
                type="text"
                required
                placeholder="Örn: Üretim, Kalite, OPEX"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Görevi / Ünvanı</label>
              <select
                id="select-member-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-zinc-500 font-medium text-gray-800"
              >
                {category === "management"
                  ? managementRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))
                  : memberRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">E-Posta Adresi</label>
              <input
                id="input-member-email"
                type="email"
                required
                placeholder="Örn: ahmet@firma.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          {/* Proje Koordinatörü Checkbox */}
          <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
            <input
              type="checkbox"
              id="chk-project-coordinator"
              checked={isProjectCoordinator}
              onChange={(e) => setIsProjectCoordinator(e.target.checked)}
              className="w-4 h-4 rounded text-zinc-900 border-gray-300 focus:ring-zinc-900 cursor-pointer"
            />
            <label htmlFor="chk-project-coordinator" className="text-xs font-semibold text-gray-800 cursor-pointer flex items-center gap-1.5">
              <span>Proje Koordinatörü Olarak Atansın</span>
              <span className="text-[10px] text-gray-400 font-normal">(Belge, veri aktarımı ve e-postalarda KİME / To alıcısı olur)</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetMemberForm}
              className="px-4 py-2 border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg text-xs font-medium transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 text-xs font-medium transition-colors"
            >
              {editingMemberId ? "Değişiklikleri Kaydet" : "Kaydet ve Ekle"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Yönetim Kadrosu Bölümü */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-3xs space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h5 className="font-bold text-gray-900 text-xs">Yönetim Kadrosu</h5>
              <p className="text-[10px] text-gray-400 mt-0.5">Stratejik karar vericiler ve üst yöneticiler</p>
            </div>
            <span className="ml-auto bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {managements.length} Kişi
            </span>
          </div>

          <div className="divide-y divide-gray-50 overflow-y-auto max-h-[350px] pr-1">
            {managements.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs flex flex-col items-center justify-center gap-1.5">
                <Users className="w-5 h-5 text-gray-300" />
                Henüz yönetim kadrosu üyesi eklenmedi.
              </div>
            ) : (
              managements.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between group hover:bg-gray-50/55 rounded-lg px-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100/70 text-amber-800 flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                      {m.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">{m.name}</span>
                        {m.isProjectCoordinator && (
                          <span className="bg-blue-600 text-white text-[11px] px-1.5 py-0.2 rounded font-bold uppercase">
                            Proje Koordinatörü (KİME)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-gray-500 mt-0.5">
                        <span className="font-semibold text-gray-600">{m.department}</span>
                        <span>•</span>
                        <span className="bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded font-medium">{m.role}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Mail className="w-3 h-3 text-gray-300" />
                        {m.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => handleStartEditMember(m)}
                      className="p-1.5 text-gray-400 hover:text-zinc-900 rounded-lg hover:bg-gray-100"
                      title="Düzenle"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMember(m.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Proje Ekip Üyeleri Bölümü */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-3xs space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h5 className="font-bold text-gray-900 text-xs">Proje Ekip Üyeleri</h5>
              <p className="text-[10px] text-gray-400 mt-0.5">Saha uygulamalarından ve aksiyonlardan sorumlu ekip</p>
            </div>
            <span className="ml-auto bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {members.length} Kişi
            </span>
          </div>

          <div className="divide-y divide-gray-50 overflow-y-auto max-h-[350px] pr-1">
            {members.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs flex flex-col items-center justify-center gap-1.5">
                <Users className="w-5 h-5 text-gray-300" />
                Henüz proje ekip üyesi eklenmedi.
              </div>
            ) : (
              members.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between group hover:bg-gray-50/55 rounded-lg px-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100/70 text-emerald-800 flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                      {m.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">{m.name}</span>
                        {m.isProjectCoordinator && (
                          <span className="bg-blue-600 text-white text-[11px] px-1.5 py-0.2 rounded font-bold uppercase">
                            Proje Koordinatörü (KİME)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-gray-500 mt-0.5">
                        <span className="font-semibold text-gray-600">{m.department}</span>
                        <span>•</span>
                        <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded font-medium">{m.role}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Mail className="w-3 h-3 text-gray-300" />
                        {m.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => handleStartEditMember(m)}
                      className="p-1.5 text-gray-400 hover:text-zinc-900 rounded-lg hover:bg-gray-100"
                      title="Düzenle"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMember(m.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
