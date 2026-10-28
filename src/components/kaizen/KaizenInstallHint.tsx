import React, { useEffect, useState } from "react";
import { Smartphone, X, Share, WifiOff } from "lucide-react";

// PWA (Faz 6.3). Android/Chrome: the browser's install prompt is captured in main.tsx and offered
// here as a button. iPhone/iPad Safari has no prompt: explain "Paylaş → Ana Ekrana Ekle". Shown on
// phones and tablets only, never once the app already runs from the home screen, and dismissible.

const DISMISS_KEY = "kaizen_install_hint_dismissed";
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isTouch = () => !!window.matchMedia?.("(pointer: coarse)").matches;

export default function KaizenInstallHint() {
  const [prompt, setPrompt] = useState<any>(() => (window as any).__gembaInstallPrompt || null);
  const [hidden, setHidden] = useState(() => {
    try { return standalone() || !isTouch() || localStorage.getItem(DISMISS_KEY) === "1"; } catch { return true; }
  });
  useEffect(() => {
    const ready = () => setPrompt((window as any).__gembaInstallPrompt || null);
    window.addEventListener("gemba-installable", ready);
    return () => window.removeEventListener("gemba-installable", ready);
  }, []);
  const dismiss = () => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ } };
  if (hidden || (!prompt && !isIos())) return null;

  const install = async () => {
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    (window as any).__gembaInstallPrompt = null;
    setPrompt(null);
    if (choice?.outcome === "accepted") dismiss();
  };
  return (
    <div className="relative rounded-2xl bg-slate-900 text-white p-4 pr-12 flex items-start gap-3">
      <span className="w-10 h-10 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center shrink-0"><Smartphone className="w-5 h-5" /></span>
      <div className="min-w-0">
        <p className="text-sm font-bold">Kaizen'i ana ekrana ekleyin</p>
        {prompt ? (
          <>
            <p className="text-xs text-white/75 mt-0.5">Uygulama gibi tek dokunuşla açılır; giriş bilgileriniz hatırlanır.</p>
            <button onClick={install} className="mt-2.5 h-9 px-3.5 rounded-lg bg-white text-slate-900 text-sm font-semibold cursor-pointer">Ana ekrana ekle</button>
          </>
        ) : (
          <p className="text-xs text-white/80 mt-0.5 leading-relaxed">Safari'de alttaki <Share className="inline w-3.5 h-3.5 -mt-0.5" /> <b>Paylaş</b> düğmesine, sonra <b>Ana Ekrana Ekle</b>'ye dokunun.</p>
        )}
      </div>
      <button onClick={dismiss} aria-label="Kapat" className="absolute top-2 right-2 w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
    </div>
  );
}

// Thin banner while the device is offline; the new-suggestion draft keeps working meanwhile.
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="rounded-xl bg-amber-100 text-amber-900 ring-1 ring-amber-200 px-3.5 py-2 text-sm font-medium flex items-center gap-2">
      <WifiOff className="w-4 h-4 shrink-0" />Bağlantı yok. Yazdığınız öneri bu cihazda taslak olarak saklanır; bağlantı gelince gönderebilirsiniz.
    </div>
  );
}
