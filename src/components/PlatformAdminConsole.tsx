import React, { useState, useEffect } from "react";
import {
  Building2, Users, ShieldCheck, Mail,
  Sparkles, Search, X, CheckCircle2,
  Plus, Send, Lock, Eye, EyeOff, ShieldAlert,
  ChevronRight
} from "lucide-react";

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
    searchPlaceholder: "Ayarlarda ara (Örn: SMTP, Gemini, SharePoint)...",
    allSystemsOperational: "Tüm Sistemler Çalışıyor",
    headerSubtitle: "Gemba Tools SaaS Merkezi Yönetim ve Entegrasyon Konsolu",
    closeConsole: "Konsoldan Çık",
    inviteModalTitle: "Yeni Kullanıcı Daveti",
    emailLabel: "E-posta",
    emailPlaceholder: "ornek@sirketiniz.com",
    roleLabel: "Rol",
    roleCustomerUser: "Müşteri Kullanıcısı",
    roleConsultant: "Danışman",
    roleAdmin: "Yönetici",
    cancel: "İptal",
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
    sec1Title: "Organization", sec1Desc: "Firma, Logo, Vardiya ve Çalışma Takvimi",
    sec2Title: "User Management", sec2Desc: "Kullanıcılar, Rol, Fabrika ve Proje Atama",
    sec3Title: "Role & Permissions", sec3Desc: "RBAC Matrisi, Modül İzin Yetkileri",
    sec4Title: "Mail Services", sec4Desc: "Microsoft Graph, Exchange, SMTP Sihirbazı",
    sec5Title: "AI Management", sec5Desc: "Gemini API Anahtarı ve Model Seçimi",
    orgHeading: "1. Organization (Kurum & Firma Ayarları)",
    orgSubtitle: "SaaS platformunun kiracı (tenant) düzeyindeki kurumsal kimlik ve takvim yapılandırması.",
    saveChanges: "Değişiklikleri Kaydet",
    orgSaveToast: "Not: Bu bölüm demo ortamında backend'e bağlı değil, değişiklik kalıcı olarak kaydedilmedi.",
    basicCompanyInfo: "Temel Firma Bilgileri",
    companyLegalName: "Firma Ticari Ünvanı",
    companyAddress: "Firma Adresi",
    taxOffice: "Vergi Dairesi",
    taxNumber: "Vergi Numarası",
    opCalendarSettings: "Operasyonel & Takvim Ayarları",
    currencyLabel: "Para Birimi",
    systemLanguageLabel: "Sistem Dili",
    timezoneLabel: "Zaman Dilimi",
    weekStartLabel: "Hafta Başlangıcı",
    workCalendarLabel: "Çalışma Takvimi",
    shiftSystemLabel: "Vardiya Sistemi",
    dayMonday: "Pazartesi", daySunday: "Pazar",
    workCal5: "5 Gün / 40 Saat", workCal6: "6 Gün / 45 Saat", workCal247: "7/24 Sürekli Vardiyalı",
    shift1: "1 Vardiya (08:00 - 17:00)", shift2: "2 Vardiya (08:00 - 16:00 / 16:00 - 00:00)", shift3: "3 Vardiya (24 Saat)",
    userMgmtHeading: "2. User Management (Kullanıcı & Lisans Atama)",
    userMgmtSubtitle: "Kullanıcı hesapları, rol yetkileri, fabrika ve proje erişimlerinin merkezi yönetimi.",
    totalMembers: (n: number) => `Toplam Üye: ${n} / 50 Lisans`,
    searchUsersPlaceholder: "Kullanıcılarda ara...",
    createUser: "Kullanıcı Oluştur",
    colNameEmail: "Adı Soyadı & E-Posta", colRole: "Rol", colFactory: "Atanan Fabrika",
    colStatus: "Durum", colMfa: "MFA", colLastLogin: "Son Giriş", colActions: "Aksiyonlar",
    statusActive: "Aktif", statusInactive: "Pasif", mfaActive: "Aktif (SMS/TOTP)", noLogin: "Giriş Yok",
    resetPasswordTitleAttr: "Şifre Sıfırla",
    rbacHeading: "3. Role & Permission Management (RBAC)",
    rbacSubtitle: "Sistem geneli hazır roller ve modül bazlı yetkilendirme matrisi.",
    saveMatrix: "Matrisi Kaydet",
    rbacSaveToast: "Not: Yetki matrisi backend'e bağlı değil, bu değişiklik kalıcı olarak kaydedilmedi.",
    colModule: "Modül / Uygulama Alanı",
    permRead: "Okuma", permCreate: "Oluşturma", permUpdate: "Güncelleme", permDelete: "Silme", permExport: "Dışa Aktar", permAI: "AI Asistan",
    mailHeading: "4. Mail Services (Kurumsal E-Posta Servisi)",
    mailSubtitle: "E-posta gönderim sağlayıcısı, Microsoft Graph, Exchange ve SMTP sihirbazı.",
    saveSettings: "Ayarları Kaydet",
    mailSaveToast: "Not: Bu workspace'te mail sağlayıcı entegrasyonu yapılandırılmamış, ayar kaydedilmedi.",
    mailProvGraphDesc: "Microsoft 365 Kurumsal Bağlantı",
    mailProvExchangeDesc: "On-Premises / Hybrid Exchange",
    mailProvSmtp: "Standart SMTP", mailProvSmtpDesc: "TLS / SSL SMTP Port 587",
    mailProvGoogleDesc: "Google OAuth2 / Gmail API",
    graphOAuthConfig: "Microsoft Graph OAuth Yapılandırması",
    smtpServerConfig: "SMTP Sunucu Yapılandırması",
    defaultSenderEmail: "Varsayılan Gönderen E-Posta Adresi",
    defaultSenderName: "Varsayılan Gönderen Adı",
    smtpHostLabel: "SMTP Host Sunucu", smtpPortLabel: "SMTP Port",
    oauthClientIdLabel: "OAuth Client ID (Application ID)", oauthClientSecretLabel: "OAuth Client Secret",
    testMailConnection: "Mail Bağlantısını Test Et",
    testMailFailToast: "Bağlantı testi yapılamadı: bu workspace'te gerçek bir mail sunucusu entegrasyonu yok.",
    aiHeading: "5. AI Management Center (Yapay Zekâ Yönetimi)",
    aiSubtitle: "Gemini API anahtarı ve model sağlayıcı seçimi.",
    saveApiKey: "API Anahtarını Kaydet",
    aiSaveToast: "Not: Gemini API anahtarı sunucu tarafında .env üzerinden yönetilir; buradan girilen değer kaydedilmez.",
    secureVaultHeading: "Güvenli API Vault & Model Seçimi",
    geminiApiKeyLabel: "Gemini API Key (process.env.GEMINI_API_KEY)",
    aiInfoNote: "Gemini API anahtarı bu ekrandan değil, sunucu ortam değişkeni olarak (.env dosyasında GEMINI_API_KEY) yönetilir. VSM, Loss Analysis ve Executive Insights modülleri bu anahtarı kullanır.",
    moduleNames: { "VSM Kapasite": "VSM Kapasite", "SMED Değişim": "SMED Değişim", "Time Study": "Time Study", "Loss Analysis": "Loss Analysis", "Hat Dengeleme": "Hat Dengeleme", "CI / Kaizen": "CI / Kaizen", "5S Audit": "5S Audit", "OpEx Assessment": "OpEx Assessment", "Raporlar": "Raporlar" } as Record<string, string>
  },
  en: {
    searchPlaceholder: "Search settings (e.g. SMTP, Gemini, SharePoint)...",
    allSystemsOperational: "All Systems Operational",
    headerSubtitle: "Gemba Tools SaaS Central Management & Integration Console",
    closeConsole: "Close Console",
    inviteModalTitle: "Invite New User",
    emailLabel: "Email",
    emailPlaceholder: "example@yourcompany.com",
    roleLabel: "Role",
    roleCustomerUser: "Customer User",
    roleConsultant: "Consultant",
    roleAdmin: "Admin",
    cancel: "Cancel",
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
    sec1Title: "Organization", sec1Desc: "Company, Logo, Shifts and Work Calendar",
    sec2Title: "User Management", sec2Desc: "Users, Roles, Factory and Project Assignment",
    sec3Title: "Role & Permissions", sec3Desc: "RBAC Matrix, Module Permission Rights",
    sec4Title: "Mail Services", sec4Desc: "Microsoft Graph, Exchange, SMTP Wizard",
    sec5Title: "AI Management", sec5Desc: "Gemini API Key and Model Selection",
    orgHeading: "1. Organization (Company Settings)",
    orgSubtitle: "Tenant-level corporate identity and calendar configuration for the SaaS platform.",
    saveChanges: "Save Changes",
    orgSaveToast: "Note: This section isn't connected to a backend in this demo environment; the change wasn't persisted.",
    basicCompanyInfo: "Basic Company Information",
    companyLegalName: "Company Legal Name",
    companyAddress: "Company Address",
    taxOffice: "Tax Office",
    taxNumber: "Tax Number",
    opCalendarSettings: "Operational & Calendar Settings",
    currencyLabel: "Currency",
    systemLanguageLabel: "System Language",
    timezoneLabel: "Timezone",
    weekStartLabel: "Week Start",
    workCalendarLabel: "Work Calendar",
    shiftSystemLabel: "Shift System",
    dayMonday: "Monday", daySunday: "Sunday",
    workCal5: "5 Days / 40 Hours", workCal6: "6 Days / 45 Hours", workCal247: "24/7 Continuous Shifts",
    shift1: "1 Shift (08:00 - 17:00)", shift2: "2 Shifts (08:00 - 16:00 / 16:00 - 00:00)", shift3: "3 Shifts (24 Hours)",
    userMgmtHeading: "2. User Management (Users & License Assignment)",
    userMgmtSubtitle: "Central management of user accounts, role permissions, factory and project access.",
    totalMembers: (n: number) => `Total Members: ${n} / 50 Licenses`,
    searchUsersPlaceholder: "Search users...",
    createUser: "Create User",
    colNameEmail: "Name & Email", colRole: "Role", colFactory: "Assigned Factory",
    colStatus: "Status", colMfa: "MFA", colLastLogin: "Last Login", colActions: "Actions",
    statusActive: "Active", statusInactive: "Inactive", mfaActive: "Active (SMS/TOTP)", noLogin: "No Login Yet",
    resetPasswordTitleAttr: "Reset Password",
    rbacHeading: "3. Role & Permission Management (RBAC)",
    rbacSubtitle: "System-wide preset roles and module-level permission matrix.",
    saveMatrix: "Save Matrix",
    rbacSaveToast: "Note: The permission matrix isn't connected to a backend; this change wasn't persisted.",
    colModule: "Module / Application Area",
    permRead: "Read", permCreate: "Create", permUpdate: "Update", permDelete: "Delete", permExport: "Export", permAI: "AI Assistant",
    mailHeading: "4. Mail Services (Corporate Email Service)",
    mailSubtitle: "Email delivery provider, Microsoft Graph, Exchange and SMTP wizard.",
    saveSettings: "Save Settings",
    mailSaveToast: "Note: No mail provider integration is configured for this workspace; the setting wasn't saved.",
    mailProvGraphDesc: "Microsoft 365 Corporate Connection",
    mailProvExchangeDesc: "On-Premises / Hybrid Exchange",
    mailProvSmtp: "Standard SMTP", mailProvSmtpDesc: "TLS / SSL SMTP Port 587",
    mailProvGoogleDesc: "Google OAuth2 / Gmail API",
    graphOAuthConfig: "Microsoft Graph OAuth Configuration",
    smtpServerConfig: "SMTP Server Configuration",
    defaultSenderEmail: "Default Sender Email Address",
    defaultSenderName: "Default Sender Name",
    smtpHostLabel: "SMTP Host Server", smtpPortLabel: "SMTP Port",
    oauthClientIdLabel: "OAuth Client ID (Application ID)", oauthClientSecretLabel: "OAuth Client Secret",
    testMailConnection: "Test Mail Connection",
    testMailFailToast: "Connection test failed: this workspace has no real mail server integration.",
    aiHeading: "5. AI Management Center",
    aiSubtitle: "Gemini API key and model provider selection.",
    saveApiKey: "Save API Key",
    aiSaveToast: "Note: The Gemini API key is managed server-side via .env; the value entered here is not saved.",
    secureVaultHeading: "Secure API Vault & Model Selection",
    geminiApiKeyLabel: "Gemini API Key (process.env.GEMINI_API_KEY)",
    aiInfoNote: "The Gemini API key isn't managed from this screen — it's set as a server environment variable (GEMINI_API_KEY in .env). The VSM, Loss Analysis and Executive Insights modules use this key.",
    moduleNames: { "VSM Kapasite": "VSM Capacity", "SMED Değişim": "SMED Changeover", "Time Study": "Time Study", "Loss Analysis": "Loss Analysis", "Hat Dengeleme": "Line Balancing", "CI / Kaizen": "CI / Kaizen", "5S Audit": "5S Audit", "OpEx Assessment": "OpEx Assessment", "Raporlar": "Reports" } as Record<string, string>
  },
  de: {
    searchPlaceholder: "Einstellungen durchsuchen (z.B. SMTP, Gemini, SharePoint)...",
    allSystemsOperational: "Alle Systeme funktionsfähig",
    headerSubtitle: "Gemba Tools SaaS Zentrale Verwaltungs- und Integrationskonsole",
    closeConsole: "Konsole schließen",
    inviteModalTitle: "Neuen Benutzer einladen",
    emailLabel: "E-Mail",
    emailPlaceholder: "beispiel@ihrefirma.com",
    roleLabel: "Rolle",
    roleCustomerUser: "Kundenbenutzer",
    roleConsultant: "Berater",
    roleAdmin: "Administrator",
    cancel: "Abbrechen",
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
    sec1Title: "Organization", sec1Desc: "Firma, Logo, Schichten und Arbeitskalender",
    sec2Title: "User Management", sec2Desc: "Benutzer, Rollen, Fabrik- und Projektzuweisung",
    sec3Title: "Role & Permissions", sec3Desc: "RBAC-Matrix, Modulberechtigungen",
    sec4Title: "Mail Services", sec4Desc: "Microsoft Graph, Exchange, SMTP-Assistent",
    sec5Title: "AI Management", sec5Desc: "Gemini API-Schlüssel und Modellauswahl",
    orgHeading: "1. Organization (Firmeneinstellungen)",
    orgSubtitle: "Mandantenweite Unternehmensidentität und Kalenderkonfiguration der SaaS-Plattform.",
    saveChanges: "Änderungen speichern",
    orgSaveToast: "Hinweis: Dieser Bereich ist in dieser Demo-Umgebung nicht mit einem Backend verbunden; die Änderung wurde nicht dauerhaft gespeichert.",
    basicCompanyInfo: "Grundlegende Firmeninformationen",
    companyLegalName: "Firmenname",
    companyAddress: "Firmenadresse",
    taxOffice: "Finanzamt",
    taxNumber: "Steuernummer",
    opCalendarSettings: "Betriebs- & Kalendereinstellungen",
    currencyLabel: "Währung",
    systemLanguageLabel: "Systemsprache",
    timezoneLabel: "Zeitzone",
    weekStartLabel: "Wochenbeginn",
    workCalendarLabel: "Arbeitskalender",
    shiftSystemLabel: "Schichtsystem",
    dayMonday: "Montag", daySunday: "Sonntag",
    workCal5: "5 Tage / 40 Stunden", workCal6: "6 Tage / 45 Stunden", workCal247: "24/7 Durchgehende Schichten",
    shift1: "1 Schicht (08:00 - 17:00)", shift2: "2 Schichten (08:00 - 16:00 / 16:00 - 00:00)", shift3: "3 Schichten (24 Stunden)",
    userMgmtHeading: "2. User Management (Benutzer & Lizenzzuweisung)",
    userMgmtSubtitle: "Zentrale Verwaltung von Benutzerkonten, Rollenrechten, Fabrik- und Projektzugriffen.",
    totalMembers: (n: number) => `Mitglieder gesamt: ${n} / 50 Lizenzen`,
    searchUsersPlaceholder: "Benutzer suchen...",
    createUser: "Benutzer erstellen",
    colNameEmail: "Name & E-Mail", colRole: "Rolle", colFactory: "Zugewiesene Fabrik",
    colStatus: "Status", colMfa: "MFA", colLastLogin: "Letzte Anmeldung", colActions: "Aktionen",
    statusActive: "Aktiv", statusInactive: "Inaktiv", mfaActive: "Aktiv (SMS/TOTP)", noLogin: "Noch keine Anmeldung",
    resetPasswordTitleAttr: "Passwort zurücksetzen",
    rbacHeading: "3. Role & Permission Management (RBAC)",
    rbacSubtitle: "Systemweite Standardrollen und modulbasierte Berechtigungsmatrix.",
    saveMatrix: "Matrix speichern",
    rbacSaveToast: "Hinweis: Die Berechtigungsmatrix ist nicht mit einem Backend verbunden; diese Änderung wurde nicht dauerhaft gespeichert.",
    colModule: "Modul / Anwendungsbereich",
    permRead: "Lesen", permCreate: "Erstellen", permUpdate: "Aktualisieren", permDelete: "Löschen", permExport: "Exportieren", permAI: "KI-Assistent",
    mailHeading: "4. Mail Services (Unternehmens-E-Mail-Dienst)",
    mailSubtitle: "E-Mail-Zustellanbieter, Microsoft Graph, Exchange und SMTP-Assistent.",
    saveSettings: "Einstellungen speichern",
    mailSaveToast: "Hinweis: Für diesen Workspace ist keine Mail-Anbieter-Integration konfiguriert; die Einstellung wurde nicht gespeichert.",
    mailProvGraphDesc: "Microsoft 365 Unternehmensverbindung",
    mailProvExchangeDesc: "On-Premises / Hybrid Exchange",
    mailProvSmtp: "Standard-SMTP", mailProvSmtpDesc: "TLS / SSL SMTP Port 587",
    mailProvGoogleDesc: "Google OAuth2 / Gmail API",
    graphOAuthConfig: "Microsoft Graph OAuth-Konfiguration",
    smtpServerConfig: "SMTP-Serverkonfiguration",
    defaultSenderEmail: "Standard-Absender-E-Mail-Adresse",
    defaultSenderName: "Standard-Absendername",
    smtpHostLabel: "SMTP-Hostserver", smtpPortLabel: "SMTP-Port",
    oauthClientIdLabel: "OAuth Client ID (Application ID)", oauthClientSecretLabel: "OAuth Client Secret",
    testMailConnection: "Mail-Verbindung testen",
    testMailFailToast: "Verbindungstest fehlgeschlagen: Dieser Workspace hat keine echte Mailserver-Integration.",
    aiHeading: "5. AI Management Center",
    aiSubtitle: "Gemini API-Schlüssel und Auswahl des Modellanbieters.",
    saveApiKey: "API-Schlüssel speichern",
    aiSaveToast: "Hinweis: Der Gemini API-Schlüssel wird serverseitig über .env verwaltet; der hier eingegebene Wert wird nicht gespeichert.",
    secureVaultHeading: "Sicherer API-Vault & Modellauswahl",
    geminiApiKeyLabel: "Gemini API Key (process.env.GEMINI_API_KEY)",
    aiInfoNote: "Der Gemini API-Schlüssel wird nicht über diesen Bildschirm verwaltet, sondern als Server-Umgebungsvariable (GEMINI_API_KEY in .env). Die Module VSM, Loss Analysis und Executive Insights verwenden diesen Schlüssel.",
    moduleNames: { "VSM Kapasite": "VSM-Kapazität", "SMED Değişim": "SMED-Rüstzeit", "Time Study": "Zeitstudie", "Loss Analysis": "Verlustanalyse", "Hat Dengeleme": "Linienabstimmung", "CI / Kaizen": "CI / Kaizen", "5S Audit": "5S-Audit", "OpEx Assessment": "OpEx-Bewertung", "Raporlar": "Berichte" } as Record<string, string>
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
  const [inviteRole, setInviteRole] = useState("Customer User");
  const [userSearch, setUserSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("Tüm Departmanlar");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteFormError, setInviteFormError] = useState<string | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordBusy, setResetPasswordBusy] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  // Section 3: Role & Permissions State
  const [selectedRole, setSelectedRole] = useState<string>("Admin");
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

  // Section 4: Mail Services
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

  // Section 5: AI Management
  const [aiProvider, setAiProvider] = useState<"gemini" | "claude" | "openai" | "azure" | "local">("gemini");
  const [apiKeyShow, setApiKeyShow] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState("AIzaSy_Gemini_Vault_Key_Active");

  // Global Notification Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      }
    })
    .catch(() => {});
  };

  useEffect(() => {
    if (isOpen && token) {
      fetchUsers();
    }
  }, [isOpen, token]);

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
      setInviteEmail("");
      setInviteRole("Customer User");
      setIsInviteModalOpen(false);
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
    { id: 5, title: t.sec5Title, icon: Sparkles, desc: t.sec5Desc }
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
                <h2 className="text-sm font-black tracking-tight text-white uppercase">Platform Management Console</h2>
                <span className="px-2 py-0.5 text-[11px] font-extrabold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 rounded-full uppercase tracking-wider">
                  System Admin Access
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

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">{t.taxOffice}</label>
                          <input
                            type="text"
                            value={orgData.taxOffice}
                            onChange={(e) => setOrgData({ ...orgData, taxOffice: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">{t.taxNumber}</label>
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

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">{t.workCalendarLabel}</label>
                          <select
                            value={orgData.workCalendar}
                            onChange={(e) => setOrgData({ ...orgData, workCalendar: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          >
                            <option value="5 Gün / 40 Saat">{t.workCal5}</option>
                            <option value="6 Gün / 45 Saat">{t.workCal6}</option>
                            <option value="7/24 Sürekli">{t.workCal247}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">{t.shiftSystemLabel}</label>
                          <select
                            value={orgData.shiftSystem}
                            onChange={(e) => setOrgData({ ...orgData, shiftSystem: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                          >
                            <option value="1 Vardiya (08:00 - 17:00)">{t.shift1}</option>
                            <option value="2 Vardiya (08:00 - 16:00 / 16:00 - 00:00)">{t.shift2}</option>
                            <option value="3 Vardiya (24 Saat)">{t.shift3}</option>
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
                      onClick={() => { setInviteFormError(null); setIsInviteModalOpen(true); }}
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
                          <th className="px-4 py-3">{t.colMfa}</th>
                          <th className="px-4 py-3">{t.colLastLogin}</th>
                          <th className="px-4 py-3 text-right">{t.colActions}</th>
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
                                {roleDisplayLabel(u.role)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">Arçelik Pişirici Cihazlar</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                u.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                              }`}>
                                {u.status === "Active" ? t.statusActive : t.statusInactive}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-emerald-600 font-mono text-[10px]">{t.mfaActive}</td>
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
                      <span>{t.rbacHeading}</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      {t.rbacSubtitle}
                    </p>
                  </div>
                  <button
                    onClick={() => showToast(t.rbacSaveToast)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    {t.saveMatrix}
                  </button>
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

                {/* Permissions Matrix Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="min-w-full divide-y divide-slate-100 text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-3">{t.colModule}</th>
                        <th className="px-4 py-3 text-center">{t.permRead}</th>
                        <th className="px-4 py-3 text-center">{t.permCreate}</th>
                        <th className="px-4 py-3 text-center">{t.permUpdate}</th>
                        <th className="px-4 py-3 text-center">{t.permDelete}</th>
                        <th className="px-4 py-3 text-center">{t.permExport}</th>
                        <th className="px-4 py-3 text-center">{t.permAI}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {Object.keys(permissionsMatrix).map((mod) => (
                        <tr key={mod} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-bold text-slate-900">{t.moduleNames[mod] || mod}</td>
                          {["Read", "Create", "Update", "Delete", "Export", "AIAssistant"].map((act) => {
                            const isChecked = permissionsMatrix[mod][act];
                            return (
                              <td key={act} className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedRole === "Admin" ? true : isChecked}
                                  disabled={selectedRole === "Admin"}
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

            {/* 4. MAIL SERVICES */}
            {activeSection === 4 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Mail className="w-5 h-5 text-indigo-600" />
                      <span>{t.mailHeading}</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      {t.mailSubtitle}
                    </p>
                  </div>
                  <button
                    onClick={() => showToast(t.mailSaveToast)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    {t.saveSettings}
                  </button>
                </div>

                {/* Mail Provider Selector Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: "graph", name: "Microsoft Graph API", desc: t.mailProvGraphDesc },
                    { id: "exchange", name: "Exchange Server", desc: t.mailProvExchangeDesc },
                    { id: "smtp", name: t.mailProvSmtp, desc: t.mailProvSmtpDesc },
                    { id: "google", name: "Google Workspace", desc: t.mailProvGoogleDesc }
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
                    {mailProvider === "graph" ? t.graphOAuthConfig : t.smtpServerConfig}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">{t.defaultSenderEmail}</label>
                      <input
                        type="text"
                        value={mailConfig.senderAddress}
                        onChange={(e) => setMailConfig({ ...mailConfig, senderAddress: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">{t.defaultSenderName}</label>
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
                          <label className="block text-slate-600 font-bold mb-1">{t.smtpHostLabel}</label>
                          <input
                            type="text"
                            value={mailConfig.smtpHost}
                            onChange={(e) => setMailConfig({ ...mailConfig, smtpHost: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">{t.smtpPortLabel}</label>
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
                          <label className="block text-slate-600 font-bold mb-1">{t.oauthClientIdLabel}</label>
                          <input
                            type="text"
                            value={mailConfig.clientId}
                            onChange={(e) => setMailConfig({ ...mailConfig, clientId: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">{t.oauthClientSecretLabel}</label>
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
                        showToast(t.testMailFailToast);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer flex items-center space-x-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{t.testMailConnection}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. AI MANAGEMENT */}
            {activeSection === 5 && (
              <div className="space-y-6 max-w-5xl mx-auto">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center space-x-2">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      <span>{t.aiHeading}</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      {t.aiSubtitle}
                    </p>
                  </div>
                  <button
                    onClick={() => showToast(t.aiSaveToast)}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    {t.saveApiKey}
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
                    {t.secureVaultHeading}
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">{t.geminiApiKeyLabel}</label>
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

                    <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-semibold leading-relaxed">
                      ℹ️ {t.aiInfoNote}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
