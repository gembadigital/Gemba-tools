import React, { useEffect, useRef, useState } from "react";
import { IdCard, KeyRound, ArrowRight, ShieldCheck, ArrowLeft, Lightbulb, Loader2 } from "lucide-react";

// Sicil no ile giriş (Faz 3.5). Opened from the customer's login link / QR: /?kaizen=<customerId>
// (&kiosk=1 on shared tablets). Step 1 asks the sicil no; the server then either signs the person
// in, asks their PIN (authorized roles, per the customer's PIN policy), or — first login / after a
// reset — asks the one-time code from the Kurul Yöneticisi plus a new PIN of their choosing.

type Step = "sicil" | "pin" | "setup";
export const KAIZEN_LINK_KEY = "gemba_kaizen_link";

export default function KaizenLogin({ customerId, kiosk, onAuthSuccess }: {
  customerId: string; kiosk: boolean; onAuthSuccess: (token: string, user: any, organization: any) => void;
}) {
  const [company, setCompany] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("sicil");
  const [employeeNo, setEmployeeNo] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/auth/kaizen-login-info?c=${encodeURIComponent(customerId)}`)
      .then(r => r.json())
      .then(d => (d.success ? setCompany(d.data.companyName || "") : setLinkError(d.error || "Giriş bağlantısı geçersiz.")))
      .catch(() => setLinkError("Sunucuya ulaşılamadı."));
  }, [customerId]);
  useEffect(() => { firstInput.current?.focus(); }, [step, company]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (step === "setup") {
      if (newPin !== newPin2) { setError("Yeni PIN'ler aynı değil."); return; }
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/kaizen-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          c: customerId, employeeNo, device: kiosk ? "kiosk" : "phone",
          ...(step === "pin" ? { pin } : {}),
          ...(step === "setup" ? { code, newPin } : {})
        })
      }).then(r => r.json());
      if (res.success && res.step === "done") {
        // Phone: stays signed in (30 days). Kiosk: this tab only; the session itself is short.
        (kiosk ? sessionStorage : localStorage).setItem("gemba_token", res.token);
        try { localStorage.setItem(KAIZEN_LINK_KEY, JSON.stringify({ c: customerId, kiosk })); } catch { /* optional */ }
        onAuthSuccess(res.token, res.user, res.organization);
        return;
      }
      if (res.success && (res.step === "pin" || res.step === "setup")) {
        setName(res.name || "");
        setStep(res.step);
      } else {
        setError(res.error || "Giriş yapılamadı.");
        if (res.step === "pin") setPin("");
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    }
    setBusy(false);
  };

  const back = () => { setStep("sicil"); setPin(""); setCode(""); setNewPin(""); setNewPin2(""); setError(null); };
  const big = kiosk ? "h-16 text-2xl" : "h-14 text-xl";
  const inputCls = `w-full ${big} px-5 rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-200 font-semibold tracking-wider text-slate-900 placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600/50 text-center`;
  const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-900 flex flex-col items-center justify-center px-4 py-10 font-sans">
      <div aria-hidden className="pointer-events-none fixed -top-24 -right-16 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="text-center text-white mb-6">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-900/30"><Lightbulb className="w-7 h-7" /></span>
          <h1 className="text-2xl font-bold mt-4 tracking-tight">Kaizen Öneri Sistemi</h1>
          <p className="text-sm text-emerald-100/80 mt-1">{linkError ? " " : company === null ? "Yükleniyor…" : company || "Hoş geldiniz"}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
          {linkError ? (
            <p className="text-center text-sm text-red-600 py-6">{linkError}<br /><span className="text-slate-500">Bağlantıyı Kurul Yöneticinizden yeniden isteyin.</span></p>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {step === "sicil" && (
                <>
                  <div className="text-center">
                    <span className="mx-auto w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><IdCard className="w-5 h-5" /></span>
                    <h2 className="text-lg font-bold text-slate-900 mt-3">Sicil numaranızı girin</h2>
                    <p className="text-sm text-slate-500 mt-1">Yaka kartınızdaki numara</p>
                  </div>
                  <input ref={firstInput} value={employeeNo} onChange={e => setEmployeeNo(e.target.value.toUpperCase().slice(0, 40))} inputMode="text" autoComplete="username" placeholder="Sicil no" className={inputCls} aria-label="Sicil no" />
                </>
              )}
              {step === "pin" && (
                <>
                  <div className="text-center">
                    <span className="mx-auto w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><KeyRound className="w-5 h-5" /></span>
                    <h2 className="text-lg font-bold text-slate-900 mt-3">Merhaba {name.split(" ")[0]}</h2>
                    <p className="text-sm text-slate-500 mt-1">Yetkili rolünüz olduğu için PIN gerekiyor.</p>
                  </div>
                  <input ref={firstInput} value={pin} onChange={e => setPin(digits(e.target.value, 6))} type="password" inputMode="numeric" autoComplete="current-password" placeholder="PIN" className={`${inputCls} tracking-[0.5em]`} aria-label="PIN" />
                </>
              )}
              {step === "setup" && (
                <>
                  <div className="text-center">
                    <span className="mx-auto w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></span>
                    <h2 className="text-lg font-bold text-slate-900 mt-3">İlk giriş, {name.split(" ")[0]}</h2>
                    <p className="text-sm text-slate-500 mt-1">Kurul Yöneticisinden aldığınız 6 haneli kodu girin ve kendi PIN'inizi belirleyin.</p>
                  </div>
                  <input ref={firstInput} value={code} onChange={e => setCode(digits(e.target.value, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Giriş kodu" className={inputCls} aria-label="Giriş kodu" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={newPin} onChange={e => setNewPin(digits(e.target.value, 6))} type="password" inputMode="numeric" autoComplete="new-password" placeholder="Yeni PIN" className={`${inputCls} !text-lg`} aria-label="Yeni PIN" />
                    <input value={newPin2} onChange={e => setNewPin2(digits(e.target.value, 6))} type="password" inputMode="numeric" autoComplete="new-password" placeholder="Tekrar" className={`${inputCls} !text-lg`} aria-label="Yeni PIN tekrar" />
                  </div>
                  <p className="text-xs text-slate-500 text-center">4–6 rakam; 1234 ya da 1111 gibi kolay tahmin edilen PIN'ler kabul edilmez.</p>
                </>
              )}

              {error && <p role="alert" className="text-sm font-medium text-red-600 bg-red-50 rounded-xl px-4 py-3 text-center">{error}</p>}

              <button
                type="submit"
                disabled={busy || (step === "sicil" ? !employeeNo.trim() : step === "pin" ? pin.length < 4 : code.length < 6 || newPin.length < 4 || newPin2.length < 4)}
                className={`w-full ${kiosk ? "h-16 text-lg" : "h-14 text-base"} rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-all active:scale-[0.99]`}
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{step === "setup" ? "PIN'i kaydet ve gir" : "Devam"}<ArrowRight className="w-5 h-5" /></>}
              </button>
              {step !== "sicil" && (
                <button type="button" onClick={back} className="w-full text-sm font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"><ArrowLeft className="w-4 h-4" />Farklı sicil no</button>
              )}
            </form>
          )}
        </div>
        <p className="text-center text-xs text-white/50 mt-6">PIN'inizi unuttuysanız Kurul Yöneticinizden yeni giriş kodu isteyin.</p>
      </div>
    </div>
  );
}
