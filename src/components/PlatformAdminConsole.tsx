import React, { useState, useEffect } from "react";
import {
  Building2, Users, ShieldCheck, Mail,
  Sparkles, Search, X, CheckCircle2,
  Plus, Lock, ShieldAlert,
  ChevronRight, Trash2, Loader2, AlertTriangle, Save, Pencil, Clock
} from "lucide-react";
import { SIDEBAR_MODULES, DEFAULT_ROLE_MODULE_VISIBILITY, RoleModuleVisibility } from "../constants/sidebarModules";

interface PlatformAdminConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentOrg: any;
  token: string;
  currentLang?: "tr" | "en" | "de";
}

const TRANSLATIONS = {
  tr: {
    consoleTitle: "Platform Yönetim Konsolu",
    systemAdminBadge: "Sistem Yöneticisi Erişimi",
    searchPlaceholder: "Ayarlarda ara (Örn: kullanıcı, rol, yetki)...",
    allSystemsOperational: "Tüm Sistemler Çalışıyor",
    headerSubtitle: "Gemba Tools Merkezi Yönetim Konsolu",
    closeConsole: "Konsoldan Çık",
    inviteModalTitle: "Yeni Kullanıcı Daveti",
    emailLabel: "E-posta",
    emailPlaceholder: "ornek@sirketiniz.com",
    roleLabel: "Rol",
    roleCustomerUser: "Müşteri Kullanıcısı",
    roleConsultant: "Danışman",
    roleAdmin: "Yönetici",
    cancel: "İptal",
    close: "Kapat",
    inviteSending: "Gönderiliyor...",
    inviteSend: "Davet Gönder",
    inviteMissingEmailError: "Lütfen bir e-posta adresi girin.",
    inviteGenericError: "Davet gönderilemedi.",
    inviteSuccessToast: (email: string) => `${email} adresine davet oluşturuldu.`,
    resetPasswordModalTitle: "Şifreyi Sıfırla",
    newPasswordLabel: "Yeni Şifre",
    newPasswordPlaceholder: "En az 6 karakter",
    resetPasswordSaving: "Kaydediliyor...",
    resetPasswordSubmit: "Şifreyi Sıfırla",
    resetPasswordMinLengthError: "Şifre en az 6 karakter olmalıdır.",
    resetPasswordSuccessToast: "Kullanıcının şifresi başarıyla sıfırlandı.",
    resetPasswordGenericError: "Şifre sıfırlanamadı.",
    sidebarMenuLabel: "PLATFORM YÖNETİM MENÜSÜ",
    footerTier: "Kurumsal",
    sec1Title: "Organizasyon", sec1Desc: "Firma Adı, Adres, Para Birimi ve Dil",
    sec2Title: "Kullanıcı Yönetimi", sec2Desc: "Kullanıcılar, Rol ve Müşteri Ataması",
    sec3Title: "Rol ve Yetkiler", sec3Desc: "RBAC Matrisi, Modül İzin Yetkileri",
    sec4Title: "E-posta Servisi", sec4Desc: "Gönderim Altyapısı Durumu",
    sec5Title: "Yapay Zekâ Yönetimi", sec5Desc: "AI Sağlayıcı ve Anahtar Durumu",
    orgHeading: "1. Organizasyon (Kurum & Firma Ayarları)",
    orgSubtitle: "Kurumsal kimlik ve genel çalışma alanı ayarları.",
    saveChanges: "Değişiklikleri Kaydet",
    orgSaveToast: "Not: Bu bölüm henüz backend'e bağlı değil, değişiklik kalıcı olarak kaydedilmedi.",
    basicCompanyInfo: "Temel Firma Bilgileri",
    companyLegalName: "Firma Ticari Ünvanı",
    companyAddress: "Firma Adresi",
    opCalendarSettings: "Genel Ayarlar",
    currencyLabel: "Para Birimi",
    systemLanguageLabel: "Sistem Dili",
    timezoneLabel: "Zaman Dilimi",
    weekStartLabel: "Hafta Başlangıcı",
    dayMonday: "Pazartesi", daySunday: "Pazar",
    userMgmtHeading: "2. Kullanıcı Yönetimi",
    userMgmtSubtitle: "Kullanıcı hesapları, rol yetkileri ve müşteri erişimlerinin merkezi yönetimi.",
    totalMembers: (n: number) => `Toplam Üye: ${n}`,
    searchUsersPlaceholder: "Kullanıcılarda ara...",
    createUser: "Kullanıcı Oluştur",
    colNameEmail: "Adı Soyadı & E-Posta", colRole: "Rol", colFactory: "Atanan Müşteri",
    colStatus: "Durum", colLastLogin: "Son Giriş", colActions: "Aksiyonlar",
    statusActive: "Aktif", statusInactive: "Pasif", noLogin: "Giriş Yok",
    pendingUsersHeading: "Bekleyen Kullanıcılar", pendingUsersCount: (n: number) => `Bekleyen: ${n}`,
    colExpiresAt: "Son Geçerlilik", pendingStatusLabel: "Davet Bekleniyor",
    resetPasswordTitleAttr: "Şifre Sıfırla",
    allCustomersLabel: "Tüm Müşteriler",
    noCustomerAssignedLabel: "Atanmamış",
    youLabel: "(Siz)",
    roleChangeError: "Rol değiştirilemedi.",
    statusChangeError: "Durum değiştirilemedi.",
    editNameTooltip: "Adı Düzenle",
    nameEmptyError: "Ad Soyad boş olamaz.",
    nameChangeError: "İsim güncellenemedi.",
    rbacHeading: "3. Rol ve Yetki Yönetimi (RBAC)",
    rbacSubtitle: "Rol bazlı modül erişim matrisi.",
    adminFullAccessNote: "Yönetici rolü tüm modüllerde tam yetkiye sahiptir.",
    mailHeading: "4. E-posta Servisi",
    mailSubtitle: "Bu workspace'in gerçek e-posta gönderim altyapısının durumu.",
    mailProviderLabel: "Aktif Sağlayıcı",
    mailProviderValue: "Microsoft Graph (Microsoft 365, app-only OAuth2)",
    mailSenderLabel: "Gönderen Adresi",
    mailSenderNote: "Vercel ortam değişkeni MAIL_FROM ile belirlenir (varsayılan: proje@gembapartner.com).",
    mailConfigLabel: "Yapılandırma",
    mailConfigNote: "AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET Vercel proje ayarlarından yönetilir; bu ekrandan değiştirilemez.",
    mailUsedByLabel: "Kullanıldığı Yerler",
    mailUsedByValue: "Kullanıcı davetleri, şifre sıfırlama, PTR raporu gönderimi, haftalık danışman özeti, 5S/Gemba Walk raporları.",
    aiHeading: "5. Yapay Zekâ Yönetim Merkezi",
    aiSubtitle: "Bu workspace'in gerçek AI sağlayıcı yapılandırmasının durumu.",
    aiProviderLabel: "Aktif Sağlayıcı",
    aiProviderValue: "Google Gemini",
    aiConfigLabel: "Yapılandırma",
    aiConfigNote: "GEMINI_API_KEY Vercel proje ayarlarından (ortam değişkeni) yönetilir; anahtar bu ekranda görüntülenmez veya girilmez.",
    aiUsedByLabel: "Kullanıldığı Modüller",
    aiUsedByValue: "VSM, Loss Analysis, Executive Insights, OpEx Coach, SMED Coach ve diğer AI destekli modüller.",
    sec6Title: "Sistem Bakımı", sec6Desc: "Sahipsiz Test Verisi Temizliği",
    maintHeading: "Sistem Bakımı",
    maintSubtitle: "Artık kullanılmayan sistem verilerini kalıcı olarak temizleyin",
    maintOrphanTitle: "Sahipsiz Test/Demo Verisi Temizliği",
    maintOrphanDesc: "Uygulamanın eski bir sürümünde, hiçbir gerçek müşteri kartına bağlı olmayan bir sistem yer tutucusu (\"none_default\") altında test amaçlı kayıtlar (OpEx denetimi, SMED projesi, zaman etüdü vb.) oluşturulabiliyordu. Bu araç yalnızca o bilinen, kesin sistem kimliğine bağlı kayıtları bulur ve kalıcı olarak siler — gerçek müşterilerinizin verilerine kesinlikle dokunulmaz.",
    maintRunButton: "Taramayı Çalıştır ve Temizle",
    maintRunning: "Temizleniyor...",
    maintConfirm: "Sahipsiz test verilerini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
    maintNoneFound: "Temizlenecek sahipsiz veri bulunamadı — sistem zaten temiz.",
    maintSuccessPrefix: "Temizlendi:",
    maintError: "Temizlik sırasında bir hata oluştu."
  },
  en: {
    consoleTitle: "Platform Management Console",
    systemAdminBadge: "System Admin Access",
    searchPlaceholder: "Search settings (e.g. user, role, permission)...",
    allSystemsOperational: "All Systems Operational",
    headerSubtitle: "Gemba Tools Central Management Console",
    closeConsole: "Close Console",
    inviteModalTitle: "Invite New User",
    emailLabel: "Email",
    emailPlaceholder: "example@yourcompany.com",
    roleLabel: "Role",
    roleCustomerUser: "Customer User",
    roleConsultant: "Consultant",
    roleAdmin: "Admin",
    cancel: "Cancel",
    close: "Close",
    inviteSending: "Sending...",
    inviteSend: "Send Invite",
    inviteMissingEmailError: "Please enter an email address.",
    inviteGenericError: "Failed to send invite.",
    inviteSuccessToast: (email: string) => `Invite created for ${email}.`,
    resetPasswordModalTitle: "Reset Password",
    newPasswordLabel: "New Password",
    newPasswordPlaceholder: "At least 6 characters",
    resetPasswordSaving: "Saving...",
    resetPasswordSubmit: "Reset Password",
    resetPasswordMinLengthError: "Password must be at least 6 characters.",
    resetPasswordSuccessToast: "User's password has been reset successfully.",
    resetPasswordGenericError: "Failed to reset password.",
    sidebarMenuLabel: "PLATFORM MANAGEMENT MENU",
    footerTier: "Enterprise",
    sec1Title: "Organization", sec1Desc: "Company Name, Address, Currency and Language",
    sec2Title: "User Management", sec2Desc: "Users, Roles and Customer Assignment",
    sec3Title: "Role & Permissions", sec3Desc: "RBAC Matrix, Module Permission Rights",
    sec4Title: "Mail Services", sec4Desc: "Delivery Infrastructure Status",
    sec5Title: "AI Management", sec5Desc: "AI Provider and Key Status",
    orgHeading: "1. Organization (Company Settings)",
    orgSubtitle: "Corporate identity and general workspace settings.",
    saveChanges: "Save Changes",
    orgSaveToast: "Note: This section isn't connected to a backend yet; the change wasn't persisted.",
    basicCompanyInfo: "Basic Company Information",
    companyLegalName: "Company Legal Name",
    companyAddress: "Company Address",
    opCalendarSettings: "General Settings",
    currencyLabel: "Currency",
    systemLanguageLabel: "System Language",
    timezoneLabel: "Timezone",
    weekStartLabel: "Week Start",
    dayMonday: "Monday", daySunday: "Sunday",
    userMgmtHeading: "2. User Management",
    userMgmtSubtitle: "Central management of user accounts, role permissions and customer access.",
    totalMembers: (n: number) => `Total Members: ${n}`,
    searchUsersPlaceholder: "Search users...",
    createUser: "Create User",
    colNameEmail: "Name & Email", colRole: "Role", colFactory: "Assigned Customer",
    colStatus: "Status", colLastLogin: "Last Login", colActions: "Actions",
    statusActive: "Active", statusInactive: "Inactive", noLogin: "No Login Yet",
    pendingUsersHeading: "Pending Users", pendingUsersCount: (n: number) => `Pending: ${n}`,
    colExpiresAt: "Expires", pendingStatusLabel: "Invite Pending",
    resetPasswordTitleAttr: "Reset Password",
    allCustomersLabel: "All Customers",
    noCustomerAssignedLabel: "Not assigned",
    youLabel: "(You)",
    roleChangeError: "Failed to change role.",
    statusChangeError: "Failed to change status.",
    editNameTooltip: "Edit Name",
    nameEmptyError: "Full name cannot be empty.",
    nameChangeError: "Failed to update name.",
    rbacHeading: "3. Role & Permission Management (RBAC)",
    rbacSubtitle: "Role-based module access matrix.",
    adminFullAccessNote: "The Admin role has full access to every module.",
    mailHeading: "4. Mail Services",
    mailSubtitle: "Status of this workspace's real email delivery infrastructure.",
    mailProviderLabel: "Active Provider",
    mailProviderValue: "Microsoft Graph (Microsoft 365, app-only OAuth2)",
    mailSenderLabel: "Sender Address",
    mailSenderNote: "Set via the Vercel MAIL_FROM environment variable (default: proje@gembapartner.com).",
    mailConfigLabel: "Configuration",
    mailConfigNote: "AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET are managed in Vercel project settings; not editable from this screen.",
    mailUsedByLabel: "Used By",
    mailUsedByValue: "User invites, password reset, PTR report delivery, weekly consultant digest, 5S/Gemba Walk reports.",
    aiHeading: "5. AI Management Center",
    aiSubtitle: "Status of this workspace's real AI provider configuration.",
    aiProviderLabel: "Active Provider",
    aiProviderValue: "Google Gemini",
    aiConfigLabel: "Configuration",
    aiConfigNote: "GEMINI_API_KEY is managed in Vercel project settings (environment variable); the key is never shown or entered on this screen.",
    aiUsedByLabel: "Used By Modules",
    aiUsedByValue: "VSM, Loss Analysis, Executive Insights, OpEx Coach, SMED Coach and other AI-assisted modules.",
    sec6Title: "System Maintenance", sec6Desc: "Orphaned Test Data Cleanup",
    maintHeading: "System Maintenance",
    maintSubtitle: "Permanently clean up system data that's no longer in use",
    maintOrphanTitle: "Orphaned Test/Demo Data Cleanup",
    maintOrphanDesc: "An earlier version of the app could create test records (OpEx assessment, SMED project, time study, etc.) under a system placeholder id (\"none_default\") not linked to any real customer card. This tool finds and permanently deletes only records tied to that exact known system id — your real customers' data is never touched.",
    maintRunButton: "Run Scan and Clean Up",
    maintRunning: "Cleaning up...",
    maintConfirm: "Permanently delete orphaned test data? This cannot be undone.",
    maintNoneFound: "No orphaned data found to clean up — the system is already clean.",
    maintSuccessPrefix: "Cleaned up:",
    maintError: "An error occurred during cleanup."
  },
  de: {
    consoleTitle: "Plattform-Verwaltungskonsole",
    systemAdminBadge: "Systemadministratorzugriff",
    searchPlaceholder: "Einstellungen durchsuchen (z.B. Benutzer, Rolle, Recht)...",
    allSystemsOperational: "Alle Systeme funktionsfähig",
    headerSubtitle: "Gemba Tools Zentrale Verwaltungskonsole",
    closeConsole: "Konsole schließen",
    inviteModalTitle: "Neuen Benutzer einladen",
    emailLabel: "E-Mail",
    emailPlaceholder: "beispiel@ihrefirma.com",
    roleLabel: "Rolle",
    roleCustomerUser: "Kundenbenutzer",
    roleConsultant: "Berater",
    roleAdmin: "Administrator",
    cancel: "Abbrechen",
    close: "Schließen",
    inviteSending: "Wird gesendet...",
    inviteSend: "Einladung senden",
    inviteMissingEmailError: "Bitte geben Sie eine E-Mail-Adresse ein.",
    inviteGenericError: "Einladung konnte nicht gesendet werden.",
    inviteSuccessToast: (email: string) => `Einladung für ${email} erstellt.`,
    resetPasswordModalTitle: "Passwort zurücksetzen",
    newPasswordLabel: "Neues Passwort",
    newPasswordPlaceholder: "Mindestens 6 Zeichen",
    resetPasswordSaving: "Wird gespeichert...",
    resetPasswordSubmit: "Passwort zurücksetzen",
    resetPasswordMinLengthError: "Das Passwort muss mindestens 6 Zeichen lang sein.",
    resetPasswordSuccessToast: "Das Passwort des Benutzers wurde erfolgreich zurückgesetzt.",
    resetPasswordGenericError: "Passwort konnte nicht zurückgesetzt werden.",
    sidebarMenuLabel: "PLATTFORM-VERWALTUNGSMENÜ",
    footerTier: "Enterprise",
    sec1Title: "Organisation", sec1Desc: "Firmenname, Adresse, Währung und Sprache",
    sec2Title: "Benutzerverwaltung", sec2Desc: "Benutzer, Rollen und Kundenzuweisung",
    sec3Title: "Rollen & Rechte", sec3Desc: "RBAC-Matrix, Modulberechtigungen",
    sec4Title: "E-Mail-Dienst", sec4Desc: "Status der Zustellinfrastruktur",
    sec5Title: "KI-Verwaltung", sec5Desc: "KI-Anbieter- und Schlüsselstatus",
    orgHeading: "1. Organisation (Firmeneinstellungen)",
    orgSubtitle: "Unternehmensidentität und allgemeine Workspace-Einstellungen.",
    saveChanges: "Änderungen speichern",
    orgSaveToast: "Hinweis: Dieser Bereich ist noch nicht mit einem Backend verbunden; die Änderung wurde nicht dauerhaft gespeichert.",
    basicCompanyInfo: "Grundlegende Firmeninformationen",
    companyLegalName: "Firmenname",
    companyAddress: "Firmenadresse",
    opCalendarSettings: "Allgemeine Einstellungen",
    currencyLabel: "Währung",
    systemLanguageLabel: "Systemsprache",
    timezoneLabel: "Zeitzone",
    weekStartLabel: "Wochenbeginn",
    dayMonday: "Montag", daySunday: "Sonntag",
    userMgmtHeading: "2. Benutzerverwaltung",
    userMgmtSubtitle: "Zentrale Verwaltung von Benutzerkonten, Rollenrechten und Kundenzugriffen.",
    totalMembers: (n: number) => `Mitglieder gesamt: ${n}`,
    searchUsersPlaceholder: "Benutzer suchen...",
    createUser: "Benutzer erstellen",
    colNameEmail: "Name & E-Mail", colRole: "Rolle", colFactory: "Zugewiesener Kunde",
    colStatus: "Status", colLastLogin: "Letzte Anmeldung", colActions: "Aktionen",
    statusActive: "Aktiv", statusInactive: "Inaktiv", noLogin: "Noch keine Anmeldung",
    pendingUsersHeading: "Ausstehende Benutzer", pendingUsersCount: (n: number) => `Ausstehend: ${n}`,
    colExpiresAt: "Läuft ab", pendingStatusLabel: "Einladung ausstehend",
    resetPasswordTitleAttr: "Passwort zurücksetzen",
    allCustomersLabel: "Alle Kunden",
    noCustomerAssignedLabel: "Nicht zugewiesen",
    youLabel: "(Sie)",
    roleChangeError: "Rolle konnte nicht geändert werden.",
    statusChangeError: "Status konnte nicht geändert werden.",
    editNameTooltip: "Namen bearbeiten",
    nameEmptyError: "Name darf nicht leer sein.",
    nameChangeError: "Name konnte nicht aktualisiert werden.",
    rbacHeading: "3. Rollen- und Rechteverwaltung (RBAC)",
    rbacSubtitle: "Rollenbasierte Modulzugriffsmatrix.",
    adminFullAccessNote: "Die Rolle Administrator hat vollen Zugriff auf alle Module.",
    mailHeading: "4. E-Mail-Dienst",
    mailSubtitle: "Status der echten E-Mail-Zustellinfrastruktur dieses Workspace.",
    mailProviderLabel: "Aktiver Anbieter",
    mailProviderValue: "Microsoft Graph (Microsoft 365, app-only OAuth2)",
    mailSenderLabel: "Absenderadresse",
    mailSenderNote: "Wird über die Vercel-Umgebungsvariable MAIL_FROM festgelegt (Standard: proje@gembapartner.com).",
    mailConfigLabel: "Konfiguration",
    mailConfigNote: "AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET werden in den Vercel-Projekteinstellungen verwaltet; auf diesem Bildschirm nicht änderbar.",
    mailUsedByLabel: "Verwendet für",
    mailUsedByValue: "Benutzereinladungen, Passwort-Zurücksetzung, PTR-Berichtsversand, wöchentliche Berater-Zusammenfassung, 5S/Gemba-Walk-Berichte.",
    aiHeading: "5. KI-Verwaltungszentrale",
    aiSubtitle: "Status der echten KI-Anbieterkonfiguration dieses Workspace.",
    aiProviderLabel: "Aktiver Anbieter",
    aiProviderValue: "Google Gemini",
    aiConfigLabel: "Konfiguration",
    aiConfigNote: "GEMINI_API_KEY wird in den Vercel-Projekteinstellungen (Umgebungsvariable) verwaltet; der Schlüssel wird auf diesem Bildschirm nie angezeigt oder eingegeben.",
    aiUsedByLabel: "Verwendet in Modulen",
    aiUsedByValue: "VSM, Loss Analysis, Executive Insights, OpEx Coach, SMED Coach und weitere KI-gestützte Module.",
    sec6Title: "Systemwartung", sec6Desc: "Bereinigung verwaister Testdaten",
    maintHeading: "Systemwartung",
    maintSubtitle: "Nicht mehr verwendete Systemdaten dauerhaft bereinigen",
    maintOrphanTitle: "Bereinigung verwaister Test-/Demodaten",
    maintOrphanDesc: "Eine frühere Version der App konnte Testdatensätze (OpEx-Bewertung, SMED-Projekt, Zeitstudie usw.) unter einer System-Platzhalter-ID (\"none_default\") anlegen, die mit keiner echten Kundenkarte verknüpft ist. Dieses Tool findet und löscht dauerhaft ausschließlich Datensätze mit dieser exakten bekannten System-ID — die Daten Ihrer echten Kunden bleiben unberührt.",
    maintRunButton: "Scan ausführen und bereinigen",
    maintRunning: "Wird bereinigt...",
    maintConfirm: "Verwaiste Testdaten dauerhaft löschen? Dies kann nicht rückgängig gemacht werden.",
    maintNoneFound: "Keine verwaisten Daten zum Bereinigen gefunden — das System ist bereits sauber.",
    maintSuccessPrefix: "Bereinigt:",
    maintError: "Bei der Bereinigung ist ein Fehler aufgetreten."
  }
};

export default function PlatformAdminConsole({
  isOpen,
  onClose,
  currentUser,
  currentOrg,
  token,
  currentLang
}: PlatformAdminConsoleProps) {
  const t = TRANSLATIONS[currentLang || "tr"];
  const [activeSection, setActiveSection] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Section 1: Organization State
  const [orgData, setOrgData] = useState({
    name: currentOrg?.organization_name || "",
    address: "",
    currency: "₺",
    language: "TR",
    timezone: "UTC+03:00 (İstanbul)",
    weekStart: "Pazartesi"
  });

  // Section 2: User Management State
  const [users, setUsers] = useState<any[]>([]);
  // Invited consultants/guests who haven't accepted yet — no `users` row exists for these until
  // they do, so they were previously invisible here with no trace that an invite had even gone out.
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Customer User");
  const [userSearch, setUserSearch] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteFormError, setInviteFormError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordBusy, setResetPasswordBusy] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [roleChangeBusyId, setRoleChangeBusyId] = useState<string | null>(null);
  const [statusChangeBusyId, setStatusChangeBusyId] = useState<string | null>(null);
  const [editingNameUserId, setEditingNameUserId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaveBusyId, setNameSaveBusyId] = useState<string | null>(null);

  // Section 3: Role & Module Visibility — real, backend-persisted (GET/POST
  // /api/admin/role-module-visibility), enforced live in App.tsx's sidebar. Admin always has full
  // access and is never stored/editable here.
  const [selectedRole, setSelectedRole] = useState<string>("Admin");
  const [roleModuleVisibility, setRoleModuleVisibility] = useState<RoleModuleVisibility>(DEFAULT_ROLE_MODULE_VISIBILITY);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilitySaved, setVisibilitySaved] = useState(false);
  const [visibilityDirty, setVisibilityDirty] = useState(false);

  const fetchRoleModuleVisibility = () => {
    if (!token) return;
    fetch("/api/admin/role-module-visibility", { headers: { "Authorization": `Bearer ${token}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setRoleModuleVisibility(res.data);
          setVisibilityDirty(false);
        }
      })
      .catch(() => {});
  };

  const handleToggleModuleVisibility = (role: "Consultant" | "Customer User", moduleKey: string) => {
    setRoleModuleVisibility((prev) => ({
      ...prev,
      [role]: { ...prev[role], [moduleKey]: !prev[role][moduleKey] }
    }));
    setVisibilityDirty(true);
    setVisibilitySaved(false);
  };

  const handleSaveModuleVisibility = async () => {
    setVisibilitySaving(true);
    try {
      const res = await fetch("/api/admin/role-module-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ settings: roleModuleVisibility })
      });
      const data = await res.json();
      if (data.success) {
        setRoleModuleVisibility(data.data);
        setVisibilityDirty(false);
        setVisibilitySaved(true);
        setTimeout(() => setVisibilitySaved(false), 3000);
      }
    } finally {
      setVisibilitySaving(false);
    }
  };

  // Global Notification Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ collection: string; count: number }[] | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch live users for User Management section
  const fetchUsers = () => {
    if (!token) return;
    fetch("/api/admin/users", {
      headers: { "Authorization": `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setUsers(data.users);
        setPendingInvitations(data.pendingInvitations || []);
      }
    })
    .catch(() => {});
  };

  // Resolves real assigned-customer names for the "Atanan Müşteri" column (previously hardcoded).
  const fetchCustomers = () => {
    if (!token) return;
    fetch("/api/business/customers", {
      headers: { "Authorization": `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const map: Record<string, string> = {};
        for (const c of data.data) map[c.id] = c.companyName || c.id;
        setCustomersById(map);
      }
    })
    .catch(() => {});
  };

  useEffect(() => {
    if (isOpen && token) {
      fetchUsers();
      fetchCustomers();
      fetchRoleModuleVisibility();
    }
  }, [isOpen, token]);

  const handleChangeRole = async (userId: string, newRole: string) => {
    setRoleChangeBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || t.roleChangeError);
        return;
      }
      fetchUsers();
    } catch (e: any) {
      showToast(e.message || t.roleChangeError);
    } finally {
      setRoleChangeBusyId(null);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    setStatusChangeBusyId(userId);
    const nextStatus = currentStatus === "Active" ? "Disabled" : "Active";
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || t.statusChangeError);
        return;
      }
      fetchUsers();
    } catch (e: any) {
      showToast(e.message || t.statusChangeError);
    } finally {
      setStatusChangeBusyId(null);
    }
  };

  const handleSaveName = async (userId: string) => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      showToast(t.nameEmptyError);
      return;
    }
    setNameSaveBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/name`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ full_name: trimmed })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || t.nameChangeError);
        return;
      }
      setEditingNameUserId(null);
      fetchUsers();
    } catch (e: any) {
      showToast(e.message || t.nameChangeError);
    } finally {
      setNameSaveBusyId(null);
    }
  };

  const handleCleanupOrphanedData = async () => {
    if (!window.confirm(t.maintConfirm)) return;
    setCleanupBusy(true);
    setCleanupResult(null);
    setCleanupError(null);
    try {
      const res = await fetch("/api/admin/cleanup-orphaned-data", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) {
        setCleanupError(data.error || t.maintError);
        return;
      }
      setCleanupResult(data.removed || []);
    } catch (e: any) {
      setCleanupError(e.message || t.maintError);
    } finally {
      setCleanupBusy(false);
    }
  };

  const handleInviteUser = async () => {
    setInviteFormError(null);
    if (!inviteEmail.trim()) {
      setInviteFormError(t.inviteMissingEmailError);
      return;
    }
    setInviteBusy(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
      });
      const data = await res.json();
      if (!data.success) {
        setInviteFormError(data.error || t.inviteGenericError);
        return;
      }
      showToast(t.inviteSuccessToast(inviteEmail.trim()));
      // Keep the modal open showing the invite link as a manual-share fallback, in case the
      // automatic email (Microsoft Graph) fails to deliver for any reason.
      setInviteLink(data.link ? `${window.location.origin}${data.link}` : null);
      setInviteEmail("");
      setInviteRole("Customer User");
      fetchUsers();
    } catch (e: any) {
      setInviteFormError(e.message || t.inviteGenericError);
    } finally {
      setInviteBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId) return;
    setResetPasswordError(null);
    if (resetPasswordValue.trim().length < 6) {
      setResetPasswordError(t.resetPasswordMinLengthError);
      return;
    }
    setResetPasswordBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${resetPasswordUserId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: resetPasswordValue.trim() })
      });
      const data = await res.json();
      if (!data.success) {
        setResetPasswordError(data.error || t.resetPasswordGenericError);
        return;
      }
      showToast(t.resetPasswordSuccessToast);
      setResetPasswordUserId(null);
      setResetPasswordValue("");
    } catch (e: any) {
      setResetPasswordError(e.message || t.resetPasswordGenericError);
    } finally {
      setResetPasswordBusy(false);
    }
  };

  if (!isOpen) return null;

  // Filter sections based on search query
  const sectionsList = [
    { id: 1, title: t.sec1Title, icon: Building2, desc: t.sec1Desc },
    { id: 2, title: t.sec2Title, icon: Users, desc: t.sec2Desc },
    { id: 3, title: t.sec3Title, icon: ShieldCheck, desc: t.sec3Desc },
    { id: 4, title: t.sec4Title, icon: Mail, desc: t.sec4Desc },
    { id: 5, title: t.sec5Title, icon: Sparkles, desc: t.sec5Desc },
    { id: 6, title: t.sec6Title, icon: Trash2, desc: t.sec6Desc }
  ];

  const filteredSections = sectionsList.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const roleDisplayLabel = (role: string) => role === "Admin" ? t.roleAdmin : role === "Consultant" ? t.roleConsultant : t.roleCustomerUser;

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
                <h2 className="text-sm font-black tracking-tight text-white uppercase">{t.consoleTitle}</h2>
                <span className="px-2 py-0.5 text-[11px] font-extrabold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 rounded-full uppercase tracking-wider">
                  {t.systemAdminBadge}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                {t.headerSubtitle} • {orgData.name}
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
              placeholder={t.searchPlaceholder}
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
              <span>{t.allSystemsOperational}</span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700"
              title={t.closeConsole}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* FEEDBACK TOAST */}
        {toastMessage && (
          <div className="absolute top-16 right-6 z-50 bg-slate-900 text-white border border-emerald-500/50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 animate-toast-in text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* INVITE USER MODAL (real POST /api/auth/invite) */}
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
              <h4 className="text-sm font-black text-slate-900">{t.inviteModalTitle}</h4>
              {inviteLink ? (
                <>
                  <div className="text-xs font-semibold text-slate-600 leading-relaxed">
                    Davet e-postası otomatik gönderildi. E-posta ulaşmazsa, bağlantıyı elle de paylaşabilirsiniz:
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={inviteLink}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono bg-slate-50 focus:outline-none"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(inviteLink)}
                      className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800"
                    >
                      Kopyala
                    </button>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => { setIsInviteModalOpen(false); setInviteLink(null); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800"
                    >
                      {t.close}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">{t.emailLabel}</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">{t.roleLabel}</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      <option value="Customer User">{t.roleCustomerUser}</option>
                      <option value="Consultant">{t.roleConsultant}</option>
                      <option value="Admin">{t.roleAdmin}</option>
                    </select>
                  </div>
                  {inviteFormError && (
                    <div className="text-xs font-bold text-red-600">{inviteFormError}</div>
                  )}
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setIsInviteModalOpen(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      {t.cancel}
                    </button>
                    <button
                      onClick={handleInviteUser}
                      disabled={inviteBusy}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                    >
                      {inviteBusy ? t.inviteSending : t.inviteSend}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* RESET PASSWORD MODAL (real POST /api/admin/users/:id/reset-password) */}
        {resetPasswordUserId && (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
              <h4 className="text-sm font-black text-slate-900">{t.resetPasswordModalTitle}</h4>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">{t.newPasswordLabel}</label>
                <input
                  type="password"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  placeholder={t.newPasswordPlaceholder}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              {resetPasswordError && (
                <div className="text-xs font-bold text-red-600">{resetPasswordError}</div>
              )}
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  onClick={() => { setResetPasswordUserId(null); setResetPasswordValue(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resetPasswordBusy}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                >
                  {resetPasswordBusy ? t.resetPasswordSaving : t.resetPasswordSubmit}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONSOLE BODY GRID (SIDEBAR + CONTENT AREA) */}
        <div className="flex flex-1 overflow-hidden bg-slate-50/50">

          {/* LEFT CONSOLE SIDEBAR NAVIGATION */}
          <aside className="w-72 bg-white border-r border-slate-200 p-3 shrink-0 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-1">
              <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-2">
                {t.sidebarMenuLabel} ({filteredSections.length})
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
              <span className="font-bold text-slate-600">{t.footerTier}</span>
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
                      <span>{t.orgHeading}</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      {t.orgSubtitle}
                    </p>
                  </div>
                  <button
                    onClick={() => showToast(t.orgSaveToast)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    {t.saveChanges}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* General Info Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                    <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                      {t.basicCompanyInfo}
                    </h4>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">{t.companyLegalName}</label>
                        <input
                          type="text"
                          value={orgData.name}
                          onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-bold mb-1">{t.companyAddress}</label>
                        <textarea
                          rows={2}
                          value={orgData.address}
                          onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                    </div>
                  </div>

                  {/* Operational Settings Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                    <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                      {t.opCalendarSettings}
                    </h4>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">{t.currencyLabel}</label>
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
                          <label className="block text-slate-600 font-bold mb-1">{t.systemLanguageLabel}</label>
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
                          <label className="block text-slate-600 font-bold mb-1">{t.timezoneLabel}</label>
                          <input
                            type="text"
                            readOnly
                            value={orgData.timezone}
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">{t.weekStartLabel}</label>
                          <select
                            value={orgData.weekStart}
                            onChange={(e) => setOrgData({ ...orgData, weekStart: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          >
                            <option value="Pazartesi">{t.dayMonday}</option>
                            <option value="Pazar">{t.daySunday}</option>
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
                      <span>{t.userMgmtHeading}</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      {t.userMgmtSubtitle}
                    </p>
                  </div>
                  <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    {t.totalMembers(users.length)}
                  </div>
                </div>

                {/* User List Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <input
                      type="text"
                      placeholder={t.searchUsersPlaceholder}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none w-64"
                    />
                    <button
                      onClick={() => { setInviteFormError(null); setInviteLink(null); setIsInviteModalOpen(true); }}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t.createUser}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="px-4 py-3">{t.colNameEmail}</th>
                          <th className="px-4 py-3">{t.colRole}</th>
                          <th className="px-4 py-3">{t.colFactory}</th>
                          <th className="px-4 py-3">{t.colStatus}</th>
                          <th className="px-4 py-3">{t.colLastLogin}</th>
                          <th className="px-4 py-3 text-right">{t.colActions}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {users.filter(u =>
                          !userSearch.trim() ||
                          u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(userSearch.toLowerCase())
                        ).map((u) => {
                          const isSelf = u.id === currentUser?.id;
                          const assignedNames: string[] = u.role === "Customer User"
                            ? (u.assigned_customer_ids || []).map((id: string) => customersById[id] || id)
                            : [];
                          return (
                          <tr key={u.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              {editingNameUserId === u.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={nameDraft}
                                    onChange={(e) => setNameDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveName(u.id);
                                      if (e.key === "Escape") setEditingNameUserId(null);
                                    }}
                                    disabled={nameSaveBusyId === u.id}
                                    className="font-bold text-slate-900 border border-indigo-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveName(u.id)}
                                    disabled={nameSaveBusyId === u.id}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingNameUserId(null)}
                                    disabled={nameSaveBusyId === u.id}
                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded disabled:opacity-50"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="font-bold text-slate-900 flex items-center gap-1.5 group">
                                  <span>{u.full_name} {isSelf && <span className="text-slate-400 font-semibold">{t.youLabel}</span>}</span>
                                  <button
                                    type="button"
                                    onClick={() => { setEditingNameUserId(u.id); setNameDraft(u.full_name); }}
                                    title={t.editNameTooltip}
                                    className="p-0.5 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              <div className="text-[10px] font-mono text-slate-400">{u.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              {isSelf ? (
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                  {roleDisplayLabel(u.role)}
                                </span>
                              ) : (
                                <select
                                  value={u.role}
                                  disabled={roleChangeBusyId === u.id}
                                  onChange={(e) => handleChangeRole(u.id, e.target.value)}
                                  className="bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold px-1.5 py-1 focus:outline-none disabled:opacity-50 cursor-pointer"
                                >
                                  <option value="Admin">{t.roleAdmin}</option>
                                  <option value="Consultant">{t.roleConsultant}</option>
                                  <option value="Customer User">{t.roleCustomerUser}</option>
                                </select>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {u.role === "Customer User"
                                ? (assignedNames.length > 0 ? assignedNames.join(", ") : t.noCustomerAssignedLabel)
                                : t.allCustomersLabel}
                            </td>
                            <td className="px-4 py-3">
                              {isSelf ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {t.statusActive}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(u.id, u.status)}
                                  disabled={statusChangeBusyId === u.id}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer disabled:opacity-50 ${
                                    u.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                                  }`}
                                  title={t.colStatus}
                                >
                                  {u.status === "Active" ? t.statusActive : t.statusInactive}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                              {u.last_login ? new Date(u.last_login).toLocaleString("tr-TR") : t.noLogin}
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => { setResetPasswordError(null); setResetPasswordValue(""); setResetPasswordUserId(u.id); }}
                                className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
                                title={t.resetPasswordTitleAttr}
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pending Invitations — invited but not yet accepted, so no `users` row exists yet */}
                {pendingInvitations.length > 0 && (
                  <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                      <span className="text-xs font-black text-amber-900 uppercase tracking-wide flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span>{t.pendingUsersHeading}</span>
                      </span>
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200">
                        {t.pendingUsersCount(pendingInvitations.length)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="px-4 py-3">{t.colNameEmail}</th>
                            <th className="px-4 py-3">{t.colRole}</th>
                            <th className="px-4 py-3">{t.colStatus}</th>
                            <th className="px-4 py-3">{t.colExpiresAt}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {pendingInvitations.map((inv) => (
                            <tr key={inv.id}>
                              <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{inv.email}</td>
                              <td className="px-4 py-3">{inv.role}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  {t.pendingStatusLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                                {inv.expires_at ? new Date(inv.expires_at).toLocaleString("tr-TR") : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. ROLE & MODULE VISIBILITY */}
            {activeSection === 3 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      <span>{t.rbacHeading}</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      {t.rbacSubtitle}
                    </p>
                  </div>
                  {selectedRole !== "Admin" && (
                    <button
                      onClick={handleSaveModuleVisibility}
                      disabled={!visibilityDirty || visibilitySaving}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      {visibilitySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{visibilitySaved ? "Kaydedildi" : "Kaydet"}</span>
                    </button>
                  )}
                </div>

                <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-semibold leading-relaxed rounded-xl px-4 py-2.5">
                  ℹ️ Bu ayarlar gerçektir ve kaydedildiği anda uygulanır — burada bir modülü kapattığınızda, ilgili roldeki kullanıcılar bir sonraki sayfa yenilemesinde o modülü sol menüde göremez. Yönetici (Admin) rolü her zaman tam erişime sahiptir ve buradan kısıtlanamaz.
                </div>

                {/* Role Selector Tabs */}
                <div className="flex flex-wrap gap-2">
                  {["Admin", "Consultant", "Customer User"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRole(r)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        selectedRole === r
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {roleDisplayLabel(r)}
                    </button>
                  ))}
                </div>

                {selectedRole === "Admin" ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{t.adminFullAccessNote}</span>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
                    {SIDEBAR_MODULES.map((mod) => {
                      const role = selectedRole as "Consultant" | "Customer User";
                      const isVisible = roleModuleVisibility[role][mod.key];
                      return (
                        <label
                          key={mod.key}
                          htmlFor={`module-visibility-${role}-${mod.key}`}
                          className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 cursor-pointer"
                        >
                          <span className="font-bold text-slate-900 text-xs">{mod.label}</span>
                          <span className="flex items-center gap-2">
                            <span className={`text-[10px] font-extrabold uppercase ${isVisible ? "text-emerald-600" : "text-slate-400"}`}>
                              {isVisible ? "Görünür" : "Gizli"}
                            </span>
                            <input
                              id={`module-visibility-${role}-${mod.key}`}
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => handleToggleModuleVisibility(role, mod.key)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 4. MAIL SERVICES — read-only status panel; real config lives in Vercel env vars */}
            {activeSection === 4 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                    <Mail className="w-5 h-5 text-indigo-600" />
                    <span>{t.mailHeading}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {t.mailSubtitle}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-600">{t.mailProviderLabel}</div>
                      <div className="text-slate-900 font-semibold">{t.mailProviderValue}</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-600">{t.mailSenderLabel}</div>
                    <div className="text-slate-500 mt-0.5">{t.mailSenderNote}</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-600">{t.mailConfigLabel}</div>
                    <div className="text-slate-500 mt-0.5">{t.mailConfigNote}</div>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="font-bold text-slate-600">{t.mailUsedByLabel}</div>
                    <div className="text-slate-500 mt-0.5">{t.mailUsedByValue}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. AI MANAGEMENT — read-only status panel; real config lives in Vercel env vars */}
            {activeSection === 5 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <span>{t.aiHeading}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {t.aiSubtitle}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-600">{t.aiProviderLabel}</div>
                      <div className="text-slate-900 font-semibold">{t.aiProviderValue}</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-600">{t.aiConfigLabel}</div>
                    <div className="text-slate-500 mt-0.5">{t.aiConfigNote}</div>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="font-bold text-slate-600">{t.aiUsedByLabel}</div>
                    <div className="text-slate-500 mt-0.5">{t.aiUsedByValue}</div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 6 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                    <Trash2 className="w-5 h-5 text-rose-600" />
                    <span>{t.maintHeading}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {t.maintSubtitle}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <div className="font-bold text-slate-700">{t.maintOrphanTitle}</div>
                      <p className="text-slate-500 leading-relaxed">{t.maintOrphanDesc}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                    <button
                      onClick={handleCleanupOrphanedData}
                      disabled={cleanupBusy}
                      className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                    >
                      {cleanupBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>{cleanupBusy ? t.maintRunning : t.maintRunButton}</span>
                    </button>
                  </div>

                  {cleanupError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">
                      {cleanupError}
                    </div>
                  )}

                  {cleanupResult && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-semibold">
                      {cleanupResult.length === 0
                        ? t.maintNoneFound
                        : `${t.maintSuccessPrefix} ${cleanupResult.map(r => `${r.collection} (${r.count})`).join(", ")}`}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
