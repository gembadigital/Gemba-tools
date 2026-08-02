import React, { useState, useEffect } from "react";
import gembaLogo from "../assets/images/gemba_g_icon.png";
import gembaDigitalWordmark from "../assets/images/gemba_digital_wordmark.png";
import { Building2, Sparkles, Key, Mail, User, ShieldCheck, ArrowRight, Check, Eye, EyeOff } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess: (token: string, userData: any, orgData: any) => void;
  inviteToken?: string | null;
}

export default function AuthScreen({ onAuthSuccess, inviteToken }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "invite">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Invitation-specific loading state
  const [invitationData, setInvitationData] = useState<any>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // General alerting state
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Parse invitation metadata if token is present
  useEffect(() => {
    if (inviteToken) {
      setMode("invite");
      setIsLoading(true);
      fetch(`/api/auth/invitation/${inviteToken}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setInvitationData(data.invitation);
            setEmail(data.invitation.email);
            setOrganizationName(data.organization?.organization_name || "");
          } else {
            setInvitationError(data.error || "Davetiye geçersiz veya süresi dolmuş.");
            setMode("login");
          }
        })
        .catch(() => {
          setInvitationError("Davetiye yüklenirken hata oluştu.");
          setMode("login");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      if (mode === "login") {
        const resp = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await resp.json();
        if (data.success) {
          if (rememberMe) {
            localStorage.setItem("gemba_token", data.token);
          } else {
            sessionStorage.setItem("gemba_token", data.token);
          }
          onAuthSuccess(data.token, data.user, data.organization);
        } else {
          setError(data.error || "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
        }
      } 
      else if (mode === "register") {
        const resp = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName, organizationName })
        });
        const data = await resp.json();
        if (data.success) {
          localStorage.setItem("gemba_token", data.token);
          onAuthSuccess(data.token, data.user, data.organization);
        } else {
          setError(data.error || "Kayıt işlemi başarısız.");
        }
      } 
      else if (mode === "invite") {
        const resp = await fetch("/api/auth/accept-invitation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken, fullName, password })
        });
        const data = await resp.json();
        if (data.success) {
          localStorage.setItem("gemba_token", data.token);
          onAuthSuccess(data.token, data.user, data.organization);
        } else {
          setError(data.error || "Davetiye kabul edilemedi.");
        }
      } 
      else if (mode === "forgot") {
        const resp = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        const data = await resp.json();
        if (data.success) {
          setMessage(data.message);
          if (data.tempPassword) {
            // Fill in password automatically for extreme review comfort
            setPassword(data.tempPassword);
            setMessage(`Şifreniz geçici olarak sıfırlandı: "${data.tempPassword}". Şimdi bu şifre ile giriş yapabilirsiniz!`);
            setMode("login");
          }
        } else {
          setError(data.error || "Şifre sıfırlama talebi gönderilemedi.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Bir internet bağlantısı problemi oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        
        {/* LOGO FRAMEWORK — icon on top, "Gemba Tools" wordmark stacked directly below it */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="bg-white px-8 py-5 rounded-2xl border border-slate-200/60 shadow-sm inline-flex flex-col items-center justify-center">
            <img
              src={gembaLogo}
              alt="Gemba Tools Logo"
              className="h-14 w-auto object-contain select-none"
            />
            <span className="text-xl font-black text-gray-900 tracking-tight mt-1.5">Gemba Tools</span>
          </div>
          <span className="text-[11px] text-slate-400 uppercase tracking-widest font-black mt-2">
            Yalın CoPX & Çoklu Kiracı Yönetimi
          </span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 border border-slate-200/80 rounded-2xl shadow-xl sm:px-10 relative overflow-hidden">
          
          {/* Subtle top indicator bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-900" />

          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 border-b border-slate-100 pb-2">
              {mode === "login" && "Giriş Yapın (Sign In)"}
              {mode === "register" && "Yeni Şirket Oluştur / Üye Ol"}
              {mode === "invite" && "Çalışma Alanına Katılın"}
              {mode === "forgot" && "Şifremi Sıfırla (Password Reset)"}
            </h3>
          </div>

          {/* Invitation Alerts */}
          {invitationError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl mb-4">
              ⚠️ {invitationError}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl mb-4">
              {message}
            </div>
          )}

          <form className="space-y-4 text-xs font-semibold text-slate-700" onSubmit={handleSubmit}>
            
            {/* Invite Info Box */}
            {mode === "invite" && invitationData && (
              <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-3 rounded-xl mb-4 leading-relaxed">
                <span>Davet edilen e-posta: <strong>{invitationData.email}</strong></span>
                <br />
                <span>Katılacağınız Alan: <strong>{organizationName}</strong></span>
              </div>
            )}

            {/* FULL NAME */}
            {(mode === "register" || mode === "invite") && (
              <div className="space-y-1">
                <label className="block text-slate-655 text-xs font-bold uppercase">Adınız Soyadınız (Full Name)</label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs font-bold text-slate-800 placeholder-slate-400"
                    placeholder="E.g. Ali Yılmaz"
                  />
                </div>
              </div>
            )}

            {/* EMAIL */}
            {mode !== "invite" && (
              <div className="space-y-1">
                <label className="block text-slate-655 text-xs font-bold uppercase">Kullanıcı Adı (E-posta)</label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs font-bold text-slate-800 placeholder-slate-400"
                    placeholder="E.g. mudur@sirketiniz.com"
                  />
                </div>
                {mode === "register" && (
                  <span className="text-[10px] text-slate-400 font-normal block leading-tight pt-1">
                    * Aynı e-posta uzantısına sahip meslektaşlarınızla otomatik olarak aynı çalışma alanını paylaşırsınız.
                  </span>
                )}
              </div>
            )}

            {/* CUSTOM ORGANIZATION NAME */}
            {mode === "register" && (
              <div className="space-y-1">
                <label className="block text-slate-655 text-xs font-bold uppercase">Şirket / Tesis Adı (Workspace Name)</label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs font-bold text-slate-800 placeholder-slate-400"
                    placeholder="E.g. Vestel Vestcity Fabrikası"
                  />
                </div>
              </div>
            )}

            {/* PASSWORD */}
            {mode !== "forgot" && (
              <div className="space-y-1">
                <label className="block text-slate-655 text-xs font-bold uppercase">Giriş Şifresi (Password)</label>
                <div className="relative rounded-md shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs font-bold text-slate-800 placeholder-slate-400"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                    aria-label={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* REMEMBER ME & FORGOT LINK */}
            {mode === "login" && (
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 accent-gray-900 rounded border-gray-300"
                  />
                  <label htmlFor="remember-me" className="ml-1.5 block text-[11px] text-slate-600 select-none">
                    Beni Hatırla
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="font-bold text-[11px] text-slate-800 hover:underline cursor-pointer"
                >
                  Şifremi Unuttum?
                </button>
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-extrabold text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 cursor-pointer pt-3 pb-3"
            >
              {isLoading ? "İşlem yapılıyor..." : (
                <span className="flex items-center space-x-1">
                  <span>
                    {mode === "login" && "Çalışma Alanına Bağlan"}
                    {mode === "register" && "Hesap ve Şirket Oluştur"}
                    {mode === "invite" && "Çalışma Alanına Kayıl"}
                    {mode === "forgot" && "Sıfırlama Bağlantısı / Şifre Al"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </span>
              )}
            </button>

          </form>

          {/* TOGGLE AUTH SCREEN VIEWS */}
          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-500 font-medium">
            {mode === "login" ? (
              <p>
                Şirketiniz kayıtlı değil mi?{" "}
                <button
                  onClick={() => setMode("register")}
                  className="font-bold text-slate-800 hover:underline cursor-pointer"
                >
                  Kayıt Ol
                </button>
              </p>
            ) : mode === "register" || mode === "forgot" ? (
              <p>
                Zaten bir hesabınız var mı?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="font-bold text-slate-800 hover:underline cursor-pointer"
                >
                  Giriş Yapın
                </button>
              </p>
            ) : (
              <p>
                Ayrı bir hesap açmak için{" "}
                <button
                  onClick={() => setMode("login")}
                  className="font-bold text-slate-800 hover:underline cursor-pointer"
                >
                  buraya tıklayın
                </button>
              </p>
            )}
          </div>

        </div>
      </div>

      {/* GEMBA DIGITAL Corporate Brand Signature — bottom of the login screen */}
      <div className="mt-10 flex flex-col items-center justify-center select-none">
        <img
          src={gembaDigitalWordmark}
          alt="Gemba Digital Logo"
          className="h-10 w-auto object-contain max-w-[180px] opacity-80"
        />
        <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase mt-1.5">
          Corporate Signature
        </span>
      </div>
    </div>
  );
}
