import React, { useState, useMemo } from "react";
import { CompanyWorkspaceExtended, ProjectTeamMember, ProjectConsultant } from "../../types/workspace";
import { Plus, Trash2, Users, Shield, Briefcase, Mail, UserCheck, AlertCircle, CheckCircle2, UserPlus, Lock } from "lucide-react";

interface ProjectTeamTabProps {
  workspace: CompanyWorkspaceExtended;
  onUpdateTeam: (team: ProjectTeamMember[], consultants?: ProjectConsultant[]) => void;
}

export default function ProjectTeamTab({ workspace, onUpdateTeam }: ProjectTeamTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddConsultantForm, setShowAddConsultantForm] = useState(false);
  const [category, setCategory] = useState<"management" | "member">("management");
  
  // Member Form States
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("Bölüm Müdürü");
  const [email, setEmail] = useState("");
  const [isProjectCoordinator, setIsProjectCoordinator] = useState(false);

  // Consultant Form State
  const [selectedConsultantUser, setSelectedConsultantUser] = useState("");
  const [consultantError, setConsultantError] = useState("");

  const teamList = workspace.projectTeam || [];

  // Get Primary Logged-in User consultant definition
  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("gemba_user_profile") || localStorage.getItem("gemba_active_user");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return { name: "Proje Yönetim Danışmanı (Siz)", email: "danisman@opexconsulting.com" };
  }, []);

  // Primary Consultant
  const consultantsList = useMemo<ProjectConsultant[]>(() => {
    if (workspace.projectConsultants && workspace.projectConsultants.length > 0) {
      return workspace.projectConsultants;
    }
    // Auto assign current user as 1st Consultant
    return [
      {
        id: "cons_1",
        name: currentUser.name || "Baş Danışman",
        email: currentUser.email || "danisman@opexconsulting.com",
        role: "Primary",
        permissions: "FullAccess"
      }
    ];
  }, [workspace.projectConsultants, currentUser]);

  const primaryConsultant = consultantsList.find(c => c.role === "Primary") || consultantsList[0];
  const primaryDomain = primaryConsultant?.email?.split("@")[1] || "opexconsulting.com";

  // Registered system users for additional consultant selection
  const registeredUsers = useMemo(() => {
    try {
      const storedUsers = localStorage.getItem("gemba_admin_users");
      if (storedUsers) {
        const parsed = JSON.parse(storedUsers);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [
      { id: "u2", name: "Selin Yılmaz (Kıdemli Danışman)", email: `selin@${primaryDomain}` },
      { id: "u3", name: "Murat Demir (Proje Danışmanı)", email: `murat@${primaryDomain}` },
      { id: "u4", name: "Ayşe Kaya (Saha Danışmanı)", email: `ayse@diğer-domain.com` }
    ];
  }, [primaryDomain]);

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

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !department.trim() || !role || !email.trim()) return;

    // If marked as coordinator, unmark previous coordinator
    let updatedTeamList = teamList;
    if (isProjectCoordinator) {
      updatedTeamList = teamList.map(m => ({ ...m, isProjectCoordinator: false }));
    }

    const newMember: ProjectTeamMember = {
      id: "tm_" + Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      department: department.trim(),
      role,
      email: email.trim(),
      category,
      isProjectCoordinator
    };

    onUpdateTeam([...updatedTeamList, newMember], consultantsList);

    // Reset Form
    setName("");
    setDepartment("");
    setEmail("");
    setIsProjectCoordinator(false);
    setShowAddForm(false);
  };

  const handleDeleteMember = (id: string) => {
    const updatedTeam = teamList.filter(m => m.id !== id);
    onUpdateTeam(updatedTeam, consultantsList);
  };

  const handleAddAdditionalConsultant = (e: React.FormEvent) => {
    e.preventDefault();
    setConsultantError("");

    if (!selectedConsultantUser) return;
    const selected = registeredUsers.find(u => u.email === selectedConsultantUser);
    if (!selected) return;

    const userDomain = selected.email.split("@")[1];
    if (userDomain !== primaryDomain) {
      setConsultantError(`Seçilen danışmanın e-posta uzantısı (@${userDomain}), 1. Danışmanın e-posta uzantısı (@${primaryDomain}) ile aynı olmalıdır!`);
      return;
    }

    const newConsultant: ProjectConsultant = {
      id: "cons_" + Math.random().toString(36).substring(2, 9),
      userId: selected.id,
      name: selected.name,
      email: selected.email,
      role: "Secondary",
      permissions: "FullAccess"
    };

    const updatedConsultants = [...consultantsList, newConsultant];
    onUpdateTeam(teamList, updatedConsultants);
    setShowAddConsultantForm(false);
    setSelectedConsultantUser("");
    setConsultantError("");
  };

  const handleDeleteConsultant = (id: string) => {
    const updated = consultantsList.filter(c => c.id !== id);
    onUpdateTeam(teamList, updated);
  };

  const projectCoordinator = teamList.find(m => m.isProjectCoordinator);
  const managements = teamList.filter(m => m.category === "management");
  const members = teamList.filter(m => m.category === "member");

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="project-team-module">
      
      {/* SECTION 1: PROJE DANIŞMANLARI PANELİ */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-zinc-900" />
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Proje Danışmanları (Proje Yönetim Ekibi)</h4>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Projeyi oluşturan üye 1. Danışman olarak atanır. İlave danışmanlar aynı e-posta alan adına sahip olmalı ve tam eşit yetkiye sahiptir.
            </p>
          </div>
          {!showAddConsultantForm && (
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
          <form onSubmit={handleAddAdditionalConsultant} className="p-4 bg-gray-50/80 rounded-xl border border-gray-200 space-y-3">
            <h5 className="text-xs font-bold text-gray-800">Sistem Üyelerinden Danışman Seçimi</h5>
            <p className="text-[10px] text-gray-500">
              Yalnızca 1. Danışmanın e-posta alan adı (<strong>@{primaryDomain}</strong>) ile eşleşen kayıtlı danışmanlar eklenebilir.
            </p>

            {consultantError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{consultantError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-9 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Kayıtlı Sistem Kullanıcısı Seçin</label>
                <select
                  value={selectedConsultantUser}
                  onChange={(e) => setSelectedConsultantUser(e.target.value)}
                  className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white font-medium text-gray-800"
                >
                  <option value="">-- Danışman Seçiniz --</option>
                  {registeredUsers.map(u => (
                    <option key={u.id} value={u.email}>
                      {u.name} - {u.email}
                    </option>
                  ))}
                </select>
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
                  className="w-1/2 py-2 bg-zinc-950 text-white rounded-lg text-xs font-medium hover:bg-zinc-800"
                >
                  Ekle
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Danışman Kartları Listesi */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {consultantsList.map((cons, idx) => (
            <div key={cons.id} className="p-3.5 bg-gray-50/70 border border-gray-100 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-xs shadow-2xs ${
                  cons.role === "Primary" ? "bg-zinc-900 text-white" : "bg-blue-600 text-white"
                }`}>
                  {idx + 1}.D
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{cons.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
                      cons.role === "Primary" ? "bg-zinc-100 text-zinc-800 border-zinc-200" : "bg-blue-50 text-blue-800 border-blue-200"
                    }`}>
                      {cons.role === "Primary" ? "1. Danışman (Sisteme Giriş Yapan)" : "İlave Danışman"}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">{cons.email}</div>
                  <div className="text-[9px] text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Eşit Yetkili (Okuma, Yazma, Paylaşma, Silme Tam Erişim)</span>
                  </div>
                </div>
              </div>

              {cons.role !== "Primary" && (
                <button
                  type="button"
                  onClick={() => handleDeleteConsultant(cons.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Danışmanı Kaldır"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
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
          <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
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
        <form onSubmit={handleAddMember} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4 shadow-2xs" id="team-member-form">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h4 className="font-semibold text-gray-900 text-xs">Yeni Ekip Üyesi Tanımlama</h4>
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
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg text-xs font-medium transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 text-xs font-medium transition-colors"
            >
              Kaydet ve Ekle
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
                          <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
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
                  <button
                    onClick={() => handleDeleteMember(m.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
                          <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
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
                  <button
                    onClick={() => handleDeleteMember(m.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
