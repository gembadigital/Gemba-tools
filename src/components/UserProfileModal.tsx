import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  X,
  LogOut,
  Users,
  Settings,
  Trash2,
  RotateCcw,
  Globe,
  Check
} from "lucide-react";
import AdminUsers from "./AdminUsers";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentOrg: any;
  token: string;
  onUpdateUser: (updatedUser: any) => void;
  onSignOut: () => void;
  activeCustomerId?: string;
  currentLang?: "tr" | "en" | "de";
  onChangeLanguage?: (lang: "tr" | "en" | "de") => void;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  currentOrg,
  token,
  onUpdateUser,
  onSignOut,
  activeCustomerId,
  currentLang,
  onChangeLanguage
}: UserProfileModalProps) {
  const roleLabels: Record<string, Record<string, string>> = {
    tr: { Admin: "Yönetici (Admin)", Consultant: "Danışman", "Customer User": "Müşteri Kullanıcısı" },
    en: { Admin: "Administrator", Consultant: "Consultant", "Customer User": "Customer User" },
    de: { Admin: "Administrator", Consultant: "Berater", "Customer User": "Kundenbenutzer" }
  };
  const roleLabel = (role?: string) => roleLabels[currentLang || "tr"][role || "Customer User"] || role;

  const [activeSubTab, setActiveSubTab] = useState<"profile" | "language" | "password" | "users" | "settings">("profile");

  const [fullName, setFullName] = useState(currentUser?.full_name || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [isEditing, setIsEditing] = useState(false);

  const [errorProfile, setErrorProfile] = useState<string | null>(null);
  const [successProfile, setSuccessProfile] = useState<string | null>(null);

  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [successPassword, setSuccessPassword] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  // Language preferences state
  const [selectedLang, setSelectedLang] = useState<string>("tr");
  const [langSuccess, setLangSuccess] = useState<string | null>(null);

  // Trash bin (soft-deleted Master Plan Gantt custom project plans) — server-persisted per
  // customer via /api/business/master-plan-state, same blob Master Plan Gantt itself reads/writes.
  const customerId = activeCustomerId || "";
  const [masterPlanCustomPlans, setMasterPlanCustomPlans] = useState<any[]>([]);
  const deletedPlans = masterPlanCustomPlans.filter((p: any) => p.deletedAt);

  const loadMasterPlanState = () => {
    if (!customerId || !token) {
      setMasterPlanCustomPlans([]);
      return;
    }
    fetch("/api/business/master-plan-state", {
      headers: { "Authorization": `Bearer ${token}`, "x-factory-id": customerId }
    })
      .then(res => res.json())
      .then(data => setMasterPlanCustomPlans(data.success && data.data?.customPlans ? data.data.customPlans : []))
      .catch(() => setMasterPlanCustomPlans([]));
  };

  useEffect(() => {
    if (isOpen) {
      loadMasterPlanState();
    }
  }, [isOpen, customerId]);

  // Listen for CustomPlansChanged globally to keep Trash Bin sync up-to-date
  useEffect(() => {
    window.addEventListener("CustomPlansChanged", loadMasterPlanState);
    return () => {
      window.removeEventListener("CustomPlansChanged", loadMasterPlanState);
    };
  }, [customerId]);

  // Persists an updated customPlans array back to the shared per-customer blob (preserving the
  // contract-package fields Master Plan Gantt also stores there) and notifies it to refresh.
  const saveMasterPlanCustomPlans = (updatedCustomPlans: any[]) => {
    if (!customerId || !token) return;
    fetch("/api/business/master-plan-state", {
      headers: { "Authorization": `Bearer ${token}`, "x-factory-id": customerId }
    })
      .then(res => res.json())
      .then(data => {
        const prevState = (data.success && data.data) ? data.data : {};
        return fetch("/api/business/master-plan-state", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "x-factory-id": customerId, "Content-Type": "application/json" },
          body: JSON.stringify({ state: { ...prevState, customPlans: updatedCustomPlans } })
        });
      })
      .then(() => {
        setMasterPlanCustomPlans(updatedCustomPlans);
        window.dispatchEvent(new CustomEvent("CustomPlansChanged"));
      })
      .catch(() => {});
  };

  // Sync state with incoming user on open & load persisted settings
  useEffect(() => {
    if (isOpen && currentUser) {
      setActiveSubTab("profile");
      setFullName(currentUser?.full_name || "");
      setEmail(currentUser?.email || "");
      setCurrentPassword("");
      setNewPassword("");
      setIsEditing(false);
      setErrorProfile(null);
      setSuccessProfile(null);
      setErrorPassword(null);
      setSuccessPassword(null);

      // Load language preference from the app's real, active language state (App.tsx's
      // `currentLang`, persisted under "gemba_lang") rather than a separate, disconnected key.
      setSelectedLang(currentLang || "tr");

      // The old "Mail Connection" tab stored SMTP/Exchange credentials (including plaintext
      // passwords) in localStorage without ever sending them anywhere — purely cosmetic, but a
      // real credential-exposure risk for anyone who'd typed a real password into it. Purge any
      // leftover entry now that the tab is removed.
      localStorage.removeItem(`gemba_mail_config_${currentUser.id}`);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Initials generator
  const getInitials = (name: string) => {
    if (!name) return "GP";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
  };

  const handleRestorePlan = (plan: any) => {
    const updated = masterPlanCustomPlans.map((p: any) => p.id === plan.id ? { ...p, deletedAt: undefined } : p);
    saveMasterPlanCustomPlans(updated);
  };

  const handlePermanentDeletePlan = (plan: any) => {
    const confirmed = window.confirm(`"${plan.name}" planını kalıcı olarak silmek istediğinizden emin misiniz?\nBu plan ve içindeki tüm faaliyetler kurtarılamayacak şekilde silinecektir.`);
    if (confirmed) {
      const updated = masterPlanCustomPlans.filter((p: any) => p.id !== plan.id);
      saveMasterPlanCustomPlans(updated);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorProfile(null);
    setSuccessProfile(null);
    setIsLoading(true);

    try {
      const resp = await fetch("/api/auth/edit-profile", {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           "Authorization": `Bearer ${token}`
         },
         body: JSON.stringify({ fullName, email })
      });
      const data = await resp.json();
      if (data.success) {
        onUpdateUser(data.user);
        setSuccessProfile("Profiliniz başarıyla güncellendi.");
        setIsEditing(false);
      } else {
        setErrorProfile(data.error || "Geliştirici hatası oluştu.");
      }
    } catch (err: any) {
      setErrorProfile(err.message || "Bağlantı hatası.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPassword(null);
    setSuccessPassword(null);
    setIsLoading(true);

    try {
      const resp = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await resp.json();
      if (data.success) {
        setSuccessPassword("Şifreniz başarıyla güncellendi.");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        setErrorPassword(data.error || "Mevcut şifreniz yanlış.");
      }
    } catch (err: any) {
      setErrorPassword(err.message || "Bağlantı hatası.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLanguage = () => {
    if (!onChangeLanguage) return;
    onChangeLanguage(selectedLang as "tr" | "en" | "de");
    setLangSuccess("Dil tercihiniz kaydedildi. Not: Şu an yalnızca sol menü etiketleri bu dile çevriliyor, modül içerikleri henüz Türkçedir.");
    setTimeout(() => setLangSuccess(null), 4000);
  };

  const isUsersTab = activeSubTab === "users";

  const languageOptions = [
    { id: "tr", name: "Türkçe", flag: "🇹🇷" },
    { id: "en", name: "English", flag: "🇬🇧" }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 font-sans select-none antialiased">
      {/* 
        CRITICAL FIX: Modal Container maintains a strictly fixed dimension (w-full max-w-4xl h-[660px] max-h-[90vh])
        so tab switching or field expansions never cause the window to constantly change size or jump!
      */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden relative flex flex-col w-full max-w-4xl h-[660px] max-h-[90vh]">
        {/* Top visual tab line branding */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-900" />
        
        {/* Header toolbar */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-slate-700" />
            <span className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">
              {isUsersTab ? "Ortak Kullanıcı Yönetimi" : "Kullanıcı Hesabı & Profil Ayarları"}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUBTAB CONTROLS */}
        <div className="flex border-b border-slate-200 px-6 pt-3 space-x-6 select-none shrink-0 bg-white">
          <button
            onClick={() => setActiveSubTab("profile")}
            className={`pb-2 px-0.5 font-black text-[11px] transition-all border-b-2 uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === "profile" 
                ? "border-slate-900 text-slate-900" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profil Bilgileri</span>
          </button>

          <button
            onClick={() => setActiveSubTab("language")}
            className={`pb-2 px-0.5 font-black text-[11px] transition-all border-b-2 uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === "language" 
                ? "border-slate-900 text-slate-900" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Dil & Bölge</span>
          </button>

          <button
            onClick={() => setActiveSubTab("password")}
            className={`pb-2 px-0.5 font-black text-[11px] transition-all border-b-2 uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === "password" 
                ? "border-slate-900 text-slate-900" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Şifre Değiştir</span>
          </button>

          {currentUser?.role === "Admin" && (
            <>
              <button
                onClick={() => setActiveSubTab("users")}
                className={`pb-2 px-0.5 font-black text-[11px] transition-all border-b-2 uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer ${
                  activeSubTab === "users" 
                    ? "border-slate-950 text-slate-950 font-black" 
                    : "border-transparent text-slate-400 hover:text-slate-650"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Ortak Kullanıcılar</span>
              </button>
              <button
                onClick={() => setActiveSubTab("settings")}
                className={`pb-2 px-0.5 font-black text-[11px] transition-all border-b-2 uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer ${
                  activeSubTab === "settings" 
                    ? "border-slate-950 text-slate-950 font-black" 
                    : "border-transparent text-slate-400 hover:text-slate-650"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Sistem Ayarları</span>
              </button>
            </>
          )}
        </div>

        {/* INNER SCROLL CONTAINER - Fixed height view area that scrolls internally */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs bg-slate-50/50">
          
          {/* User Header Avatar Card - Compact header shown on non-table views */}
          {!isUsersTab && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs shrink-0">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 text-white font-black text-base flex items-center justify-center shadow-sm shrink-0 border border-slate-200">
                  {getInitials(currentUser?.full_name)}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-gray-900 leading-tight">{currentUser?.full_name}</h4>
                  <p className="text-[11px] text-slate-500 font-medium">{currentUser?.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold uppercase">
                      {roleLabel(currentUser?.role)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">| {currentOrg?.organization_name}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: PROFILE */}
          {activeSubTab === "profile" && (
            <div className="space-y-4">
              {errorProfile && <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl font-medium">{errorProfile}</div>}
              {successProfile && <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-medium">{successProfile}</div>}

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">Hesap Profil Kartı</span>
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="text-[11px] font-bold text-slate-900 hover:underline cursor-pointer"
                    >
                      Düzenle
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setIsEditing(false); setErrorProfile(null); }}
                      className="text-[11px] font-bold text-slate-400 hover:underline cursor-pointer"
                    >
                      İptal Et
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl">
                      <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Tam Ad Soyad:</span>
                      <span className="font-bold text-slate-900 text-xs">{currentUser?.full_name}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl">
                      <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Giriş E-Posta Adresi:</span>
                      <span className="font-bold text-slate-900 text-xs">{currentUser?.email}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl">
                      <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Şirket Organizasyonu:</span>
                      <span className="font-bold text-slate-900 text-xs">{currentOrg?.organization_name}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl">
                      <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Sistem Yetkisi:</span>
                      <span className="font-bold text-slate-900 text-xs">{roleLabel(currentUser?.role)}</span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold uppercase text-slate-600">Ad Soyad</span>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold uppercase text-slate-600">Giriş E-Posta</span>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-normal">
                      * Güvenlik protokolleri gereği şirket domain yapısı değişemez. Sadece bağlı bulunduğunuz uzantıdaki adresleri kullanabilirsiniz.
                    </p>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold px-4 py-2 text-xs transition-colors cursor-pointer"
                    >
                      {isLoading ? "Kaydediliyor..." : "Profili Güncelle"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: LANGUAGE PREFERENCES */}
          {activeSubTab === "language" && (
            <div className="space-y-4">
              {langSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-medium flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{langSuccess}</span>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-2">
                    <Globe className="w-4 h-4 text-slate-600" />
                    <span>Dil Tercihleri ve Arayüz Bölge Ayarları</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Sistem genelinde kullanılacak varsayılan dil tercihinizi seçiniz.
                  </p>
                </div>

                <div className="pt-2 space-y-1 max-w-xs">
                  <label className="block text-[10px] font-bold uppercase text-slate-600">Arayüz Dili</label>
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900 cursor-pointer"
                  >
                    {languageOptions.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={handleSaveLanguage}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg px-4 py-2 text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Dil Tercihini Kaydet</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: PASSWORD */}
          {activeSubTab === "password" && (
            <div className="space-y-4">
              {errorPassword && <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl font-medium">{errorPassword}</div>}
              {successPassword && <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-medium">{successPassword}</div>}

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-2">
                  <Lock className="w-4 h-4 text-slate-600" />
                  <span>Şifre Güncelleme Formu</span>
                </h4>

                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase text-slate-600">Mevcut Şifreniz</span>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase text-slate-600">Yeni Şifreniz</span>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-slate-900"
                      placeholder="Minimum 6 karakter"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-slate-950 hover:bg-slate-900 text-white rounded-lg font-bold px-4 py-2 text-xs transition-colors cursor-pointer mt-2"
                  >
                    {isLoading ? "Şifre Güncelleniyor..." : "Şifreyi Güncelle"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB CONTENT: ADMIN USERS SECTOR */}
          {isUsersTab && currentUser?.role === "Admin" && (
            <div className="w-full py-1">
              <AdminUsers 
                token={token} 
                currentUser={currentUser} 
                currentOrg={currentOrg} 
              />
            </div>
          )}

          {/* TAB CONTENT: SYSTEM SETTINGS (TRASH BIN) */}
          {activeSubTab === "settings" && currentUser?.role === "Admin" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-4 shadow-xs">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
                    <Settings className="w-4 h-4 text-slate-600" />
                    <span>Genel Sistem Tercihleri</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Fabrika genel parametreleri ve proje yetkilendirmeleri otomatik olarak ana sunucudan yönetilmektedir.
                  </p>
                </div>

                <div className="pt-2">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2 mb-3">
                    <Trash2 className="w-4 h-4 text-red-500" />
                    <span>Geri Dönüşüm Kutusu (Çöp Kutusu)</span>
                  </h4>
                  
                  {deletedPlans.length === 0 ? (
                    <div className="text-center py-8 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-400">
                      <Trash2 className="w-8 h-8 mx-auto mb-2 opacity-35" />
                      <p className="text-[11px] font-semibold">Çöp kutusu boş.</p>
                      <p className="text-[10px] opacity-75 mt-0.5">Silinen herhangi bir proje planı bulunmuyor.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {deletedPlans.map((plan) => (
                        <div 
                          key={plan.id} 
                          className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between gap-2 transition-all hover:border-slate-300"
                        >
                          <div>
                            <span className="font-bold text-xs text-slate-800 block">{plan.name}</span>
                            <div className="flex items-center space-x-3 mt-0.5 text-[10px] text-slate-400 font-mono">
                              <span>Süreç / Faaliyet: {plan.activities?.length || 0} adet</span>
                              <span>{plan.deletedAt ? new Date(plan.deletedAt).toLocaleDateString("tr-TR") : "Bilinmiyor"}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => handleRestorePlan(plan)}
                              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded-lg py-1 px-2.5 text-[10px] transition-all flex items-center space-x-1 cursor-pointer"
                              title="Planı Aktif Duruma Geri Yükle"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Geri Yükle</span>
                            </button>
                            <button
                              onClick={() => handlePermanentDeletePlan(plan)}
                              className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold rounded-lg p-1.5 text-[10px] transition-all flex items-center justify-center cursor-pointer"
                              title="Kalıcı Olarak Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* BOTTOM SIGN OUT FOOTER */}
          {!isUsersTab && (
            <div className="pt-3 border-t border-slate-200 flex justify-between items-center bg-white rounded-xl p-3 shadow-xs shrink-0">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Sistem Oturumu & Çalışma Alanı
              </div>
              
              <button
                onClick={onSignOut}
                className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-lg px-3.5 py-1.5 text-xs shadow-xs shrink-0 cursor-pointer transition-all uppercase"
              >
                <LogOut className="w-3.5 h-3.5 text-white" />
                <span>Oturumu Kapat</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

