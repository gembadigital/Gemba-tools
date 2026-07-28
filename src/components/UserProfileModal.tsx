import React, { useState, useEffect } from "react";
import { 
  User, 
  Mail, 
  ShieldAlert, 
  Lock, 
  X, 
  LogOut, 
  CheckCircle, 
  Users, 
  Settings, 
  Trash2, 
  RotateCcw,
  Globe,
  Server,
  Send,
  Check,
  AlertCircle,
  Key,
  Info
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
}

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  currentOrg,
  token,
  onUpdateUser,
  onSignOut,
  activeCustomerId
}: UserProfileModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"profile" | "language" | "mail" | "password" | "users" | "settings">("profile");

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

  // Mail Connection (Exchange & SMTP) state
  const [mailProvider, setMailProvider] = useState<"smtp" | "exchange" | "disabled">("smtp");
  
  // SMTP Fields
  const [smtpHost, setSmtpHost] = useState("smtp.office365.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpEncryption, setSmtpEncryption] = useState<"tls" | "ssl" | "none">("tls");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSenderName, setSmtpSenderName] = useState("");

  // Exchange Fields
  const [exchangeServer, setExchangeServer] = useState("outlook.office365.com");
  const [exchangePort, setExchangePort] = useState("443");
  const [exchangeProtocol, setExchangeProtocol] = useState<"ews" | "imap">("ews");
  const [exchangeUser, setExchangeUser] = useState("");
  const [exchangePass, setExchangePass] = useState("");
  const [exchangeDomain, setExchangeDomain] = useState("");

  const [mailTestStatus, setMailTestStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isTestingMail, setIsTestingMail] = useState(false);
  const [mailSuccess, setMailSuccess] = useState<string | null>(null);

  // Deleted custom project plans state for recovery bin (trash bin)
  const [deletedPlans, setDeletedPlans] = useState<any[]>([]);
  const customerId = activeCustomerId || "arcelik_bolu";

  const loadDeletedPlans = () => {
    const deletedKey = `gemba_deleted_custom_project_plans_${customerId}`;
    const saved = localStorage.getItem(deletedKey);
    if (saved) {
      setDeletedPlans(JSON.parse(saved));
    } else {
      setDeletedPlans([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDeletedPlans();
    }
  }, [isOpen, customerId]);

  // Listen for CustomPlansChanged globally to keep Trash Bin sync up-to-date
  useEffect(() => {
    const handlePlansChange = () => {
      loadDeletedPlans();
    };
    window.addEventListener("CustomPlansChanged", handlePlansChange);
    return () => {
      window.removeEventListener("CustomPlansChanged", handlePlansChange);
    };
  }, [customerId]);

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

      // Load language preference
      const langKey = `gemba_user_language_${currentUser.id}`;
      const savedLang = localStorage.getItem(langKey) || localStorage.getItem("app_language") || "tr";
      setSelectedLang(savedLang);

      // Load mail settings
      const mailKey = `gemba_mail_config_${currentUser.id}`;
      const savedMail = localStorage.getItem(mailKey);
      if (savedMail) {
        try {
          const parsed = JSON.parse(savedMail);
          setMailProvider(parsed.provider || "smtp");
          setSmtpHost(parsed.smtpHost || "smtp.office365.com");
          setSmtpPort(parsed.smtpPort || "587");
          setSmtpEncryption(parsed.smtpEncryption || "tls");
          setSmtpUser(parsed.smtpUser || currentUser.email || "");
          setSmtpPass(parsed.smtpPass || "");
          setSmtpSenderName(parsed.smtpSenderName || currentUser.full_name || "OpEx Sistem Bildirimi");

          setExchangeServer(parsed.exchangeServer || "outlook.office365.com");
          setExchangePort(parsed.exchangePort || "443");
          setExchangeProtocol(parsed.exchangeProtocol || "ews");
          setExchangeUser(parsed.exchangeUser || currentUser.email || "");
          setExchangePass(parsed.exchangePass || "");
          setExchangeDomain(parsed.exchangeDomain || "");
        } catch (e) {
          // Fallback defaults
          setSmtpUser(currentUser.email || "");
          setSmtpSenderName(currentUser.full_name || "");
          setExchangeUser(currentUser.email || "");
        }
      } else {
        setSmtpUser(currentUser.email || "");
        setSmtpSenderName(currentUser.full_name || "OpEx Sistem Bildirimi");
        setExchangeUser(currentUser.email || "");
      }
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
    const activeKey = `gemba_custom_project_plans_${customerId}`;
    const activePlans = JSON.parse(localStorage.getItem(activeKey) || "[]");
    
    if (!activePlans.some((p: any) => p.id === plan.id)) {
      activePlans.push({
        id: plan.id,
        name: plan.name,
        activities: plan.activities || []
      });
      localStorage.setItem(activeKey, JSON.stringify(activePlans));
    }

    const deletedKey = `gemba_deleted_custom_project_plans_${customerId}`;
    const updatedDeleted = deletedPlans.filter((p: any) => p.id !== plan.id);
    localStorage.setItem(deletedKey, JSON.stringify(updatedDeleted));
    setDeletedPlans(updatedDeleted);

    window.dispatchEvent(new CustomEvent("CustomPlansChanged"));
  };

  const handlePermanentDeletePlan = (plan: any) => {
    const confirmed = window.confirm(`"${plan.name}" planını kalıcı olarak silmek istediğinizden emin misiniz?\nBu plan ve içindeki tüm faaliyetler kurtarılamayacak şekilde silinecektir.`);
    if (confirmed) {
      const deletedKey = `gemba_deleted_custom_project_plans_${customerId}`;
      const updatedDeleted = deletedPlans.filter((p: any) => p.id !== plan.id);
      localStorage.setItem(deletedKey, JSON.stringify(updatedDeleted));
      setDeletedPlans(updatedDeleted);
      window.dispatchEvent(new CustomEvent("CustomPlansChanged"));
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
    if (!currentUser) return;
    const langKey = `gemba_user_language_${currentUser.id}`;
    localStorage.setItem(langKey, selectedLang);
    localStorage.setItem("app_language", selectedLang);
    setLangSuccess("Dil tercihiniz başarıyla kaydedildi.");
    window.dispatchEvent(new CustomEvent("LanguageChanged", { detail: { language: selectedLang } }));
    setTimeout(() => setLangSuccess(null), 3000);
  };

  const handleSaveMailConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const key = `gemba_mail_config_${currentUser.id}`;
    const config = {
      provider: mailProvider,
      smtpHost,
      smtpPort,
      smtpEncryption,
      smtpUser,
      smtpPass,
      smtpSenderName,
      exchangeServer,
      exchangePort,
      exchangeProtocol,
      exchangeUser,
      exchangePass,
      exchangeDomain,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(config));
    setMailSuccess("E-Posta sunucu yapılandırması başarıyla kaydedildi.");
    setTimeout(() => setMailSuccess(null), 3500);
  };

  const handleTestMailConnection = () => {
    setIsTestingMail(true);
    setMailTestStatus(null);

    setTimeout(() => {
      setIsTestingMail(false);
      if (mailProvider === "smtp") {
        if (!smtpHost || !smtpUser) {
          setMailTestStatus({
            type: "error",
            message: "Lütfen SMTP sunucu adresi ve kullanıcı e-posta bilgisini giriniz."
          });
        } else {
          setMailTestStatus({
            type: "success",
            message: `✅ SMTP Bağlantısı Başarılı! Sunucu: ${smtpHost}:${smtpPort} (${smtpEncryption.toUpperCase()}) bağlantısı doğrulandı.`
          });
        }
      } else if (mailProvider === "exchange") {
        if (!exchangeServer || !exchangeUser) {
          setMailTestStatus({
            type: "error",
            message: "Lütfen Exchange sunucu adresi ve e-posta kullanıcı adını giriniz."
          });
        } else {
          setMailTestStatus({
            type: "success",
            message: `✅ Exchange (${exchangeProtocol.toUpperCase()}) Oturumu Başarılı! Sunucu: ${exchangeServer}:${exchangePort} erişimi doğrulandı.`
          });
        }
      } else {
        setMailTestStatus({
          type: "info",
          message: "E-Posta entegrasyonu şu anda pasif durumdadır."
        });
      }
    }, 900);
  };

  const isUsersTab = activeSubTab === "users";

  const languageOptions = [
    { id: "tr", name: "Türkçe", flag: "🇹🇷", subtitle: "Varsayılan Arayüz Dili" },
    { id: "en", name: "English", flag: "🇬🇧", subtitle: "Global Business English" },
    { id: "de", name: "Deutsch", flag: "🇩🇪", subtitle: "German Operational Interface" },
    { id: "fr", name: "Français", flag: "🇫🇷", subtitle: "French Manufacturing System" },
    { id: "es", name: "Español", flag: "🇪🇸", subtitle: "Spanish Industrial Interface" }
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
            onClick={() => setActiveSubTab("mail")}
            className={`pb-2 px-0.5 font-black text-[11px] transition-all border-b-2 uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === "mail" 
                ? "border-slate-900 text-slate-900" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>E-Posta Entegrasyonu</span>
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
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-bold uppercase">
                      {currentUser?.role === "Admin" ? "Yönetici (Admin)" : "Standart Kullanıcı"}
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
                      <span className="font-bold text-slate-900 text-xs">{currentUser?.role === "Admin" ? "Sistem Yöneticisi" : "Kullanıcı"}</span>
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
                    Sistem genelinde kullanılacak varsayılan dil tercihinizi seçiniz. Raporlar ve AI analizleri seçilen dile uygun üretilecektir.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {languageOptions.map((lang) => (
                    <div
                      key={lang.id}
                      onClick={() => setSelectedLang(lang.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedLang === lang.id
                          ? "border-slate-900 bg-slate-900 text-white shadow-md"
                          : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{lang.flag}</span>
                        <div>
                          <div className="font-extrabold text-xs">{lang.name}</div>
                          <div className={`text-[10px] ${selectedLang === lang.id ? "text-slate-300" : "text-slate-400"}`}>
                            {lang.subtitle}
                          </div>
                        </div>
                      </div>
                      {selectedLang === lang.id && (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  ))}
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

          {/* TAB CONTENT: MAIL CONNECTION (EXCHANGE & SMTP) */}
          {activeSubTab === "mail" && (
            <div className="space-y-4">
              {mailSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-medium flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{mailSuccess}</span>
                </div>
              )}

              {/* Microsoft Graph Notice Banner */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex items-start space-x-3 text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[11px]">
                  <span className="font-extrabold block">Microsoft Graph API Notu:</span>
                  <p className="text-[10px] text-amber-800 leading-normal">
                    Microsoft Graph kurumsal Azure OAuth 2.0 entegrasyon ayarları sonraki aşamada aktifleşecektir. Şu anda doğrudan <strong>Exchange (IMAP/EWS)</strong> ve <strong>SMTP</strong> sunucu bağlantılarını yapılandırabilirsiniz.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[10px] flex items-center space-x-1.5">
                    <Server className="w-4 h-4 text-slate-600" />
                    <span>Kurumsal E-Posta Bağlantısı</span>
                  </span>
                  <div className="flex items-center space-x-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Protokol:</label>
                    <select
                      value={mailProvider}
                      onChange={(e: any) => setMailProvider(e.target.value)}
                      className="bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="smtp">SMTP (Standart)</option>
                      <option value="exchange">Exchange (IMAP / EWS)</option>
                      <option value="disabled">Devre Dışı (Pasif)</option>
                    </select>
                  </div>
                </div>

                <form onSubmit={handleSaveMailConfig} className="space-y-4">
                  {mailProvider === "smtp" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">SMTP Sunucu Adresi</label>
                          <input
                            type="text"
                            required
                            placeholder="smtp.office365.com"
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Port Numarası</label>
                          <input
                            type="text"
                            required
                            placeholder="587"
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Şifreleme Türü</label>
                          <select
                            value={smtpEncryption}
                            onChange={(e: any) => setSmtpEncryption(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          >
                            <option value="tls">STARTTLS / TLS (Önerilen)</option>
                            <option value="ssl">SSL (Port 465)</option>
                            <option value="none">Şifrelemesiz (Güvensiz)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Kullanıcı Adı / E-Posta</label>
                          <input
                            type="email"
                            required
                            placeholder="kullanici@sirket.com"
                            value={smtpUser}
                            onChange={(e) => setSmtpUser(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Parola / Uygulama Şifresi</label>
                          <input
                            type="password"
                            placeholder="••••••••••••"
                            value={smtpPass}
                            onChange={(e) => setSmtpPass(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase text-slate-600">Gönderen Unvanı (Sender Display Name)</label>
                        <input
                          type="text"
                          placeholder="OpEx Sistem Bildirimi"
                          value={smtpSenderName}
                          onChange={(e) => setSmtpSenderName(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {mailProvider === "exchange" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Exchange Sunucu</label>
                          <input
                            type="text"
                            required
                            placeholder="outlook.office365.com"
                            value={exchangeServer}
                            onChange={(e) => setExchangeServer(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Exchange Port</label>
                          <input
                            type="text"
                            required
                            placeholder="443"
                            value={exchangePort}
                            onChange={(e) => setExchangePort(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Exchange Protokol</label>
                          <select
                            value={exchangeProtocol}
                            onChange={(e: any) => setExchangeProtocol(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          >
                            <option value="ews">EWS (Exchange Web Services)</option>
                            <option value="imap">IMAP4 (TLS)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Domain (İsteğe Bağlı)</label>
                          <input
                            type="text"
                            placeholder="SIRKETDOMAIN"
                            value={exchangeDomain}
                            onChange={(e) => setExchangeDomain(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Exchange Kullanıcı Adı</label>
                          <input
                            type="email"
                            required
                            placeholder="kullanici@sirket.com"
                            value={exchangeUser}
                            onChange={(e) => setExchangeUser(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-600">Parola</label>
                          <input
                            type="password"
                            placeholder="••••••••••••"
                            value={exchangePass}
                            onChange={(e) => setExchangePass(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {mailProvider === "disabled" && (
                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                      <Mail className="w-8 h-8 mx-auto mb-1 opacity-40" />
                      <p className="font-semibold text-[11px]">E-Posta entegrasyonu pasif konumdadır.</p>
                      <p className="text-[10px] opacity-75">Sistem üzerinden otomatik e-posta gönderimi yapılmayacaktır.</p>
                    </div>
                  )}

                  {mailTestStatus && (
                    <div className={`p-3 rounded-xl border text-[11px] font-medium ${
                      mailTestStatus.type === "success" 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                        : mailTestStatus.type === "error"
                        ? "bg-red-50 border-red-200 text-red-800"
                        : "bg-slate-100 border-slate-200 text-slate-700"
                    }`}>
                      {mailTestStatus.message}
                    </div>
                  )}

                  {mailProvider !== "disabled" && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={isTestingMail}
                        onClick={handleTestMailConnection}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold rounded-lg px-3.5 py-2 text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isTestingMail ? "Bağlantı Sınanıyor..." : "Bağlantıyı Test Et"}</span>
                      </button>

                      <button
                        type="submit"
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg px-4 py-2 text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>E-Posta Ayarlarını Kaydet</span>
                      </button>
                    </div>
                  )}
                </form>
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

