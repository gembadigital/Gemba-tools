import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { QrCode, X, Download, Printer, Smartphone, MonitorSmartphone, Lightbulb } from "lucide-react";
import { Button, inputCls } from "./kaizenUi";

// Yazdırılabilir QR (Faz 3.7). The QR encodes the customer's sicil no login link (phone or kiosk),
// optionally with a place label (&yer=…) that the login screen shows, so a QR on line 2's board
// says "Montaj Hattı 2". The label is display-only. Download as PNG or print an A4 portrait poster.

export function loginUrl(base: string, kiosk: boolean, place: string) {
  const p = place.trim();
  return `${base}${kiosk ? "&kiosk=1" : ""}${p ? `&yer=${encodeURIComponent(p.slice(0, 60))}` : ""}`;
}

const POSTER_CSS = `
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  body > *:not(.kaizen-qr-print) { display: none !important; }
  .kaizen-qr-print { position: static !important; background: none !important; padding: 0 !important; overflow: visible !important; }
  .kaizen-qr-noprint { display: none !important; }
  #kaizen-qr-poster { box-shadow: none !important; margin: 0 !important; }
  #kaizen-qr-poster * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

export default function KaizenQrPoster({ baseLink, companyName, onClose }: { baseLink: string; companyName: string; onClose: () => void }) {
  const [kiosk, setKiosk] = useState(false);
  const [place, setPlace] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [poster, setPoster] = useState(false);
  const url = loginUrl(baseLink, kiosk, place);

  useEffect(() => {
    let alive = true;
    // High error correction: survives a laminated, slightly scratched poster on the shop floor.
    QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 1, width: 1024, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(d => { if (alive) setDataUrl(d); });
    return () => { alive = false; };
  }, [url]);

  const download = () => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `Kaizen_QR_${kiosk ? "kiosk" : "telefon"}${place.trim() ? "_" + place.trim().replace(/[^\p{L}\p{N}]+/gu, "_") : ""}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return createPortal(
    <div className="kaizen-qr-print fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-[2px] overflow-auto p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Giriş QR kodu">
      <style>{POSTER_CSS}</style>
      {!poster ? (
        <div className="kaizen-qr-noprint bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-auto p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><QrCode className="w-5 h-5" /></span>
              <div><h3 className="text-lg font-bold text-slate-900">Giriş QR kodu</h3><p className="text-xs text-slate-500">Panoya asın; çalışanlar telefonla okutup sicil no ile girer.</p></div>
            </div>
            <button onClick={onClose} aria-label="Kapat" className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_15rem] gap-6 mt-6 items-start">
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Nerede kullanılacak?</p>
                <div className="grid grid-cols-2 gap-2">
                  {([[false, "Telefon", "Kişisel telefon, 30 gün açık kalır", Smartphone], [true, "Kiosk", "Ortak tablet, kısa oturum", MonitorSmartphone]] as const).map(([k, l, t, Icon]) => (
                    <button key={l} type="button" aria-pressed={kiosk === k} onClick={() => setKiosk(k)}
                      className={`text-left rounded-xl p-3 cursor-pointer transition-all ${kiosk === k ? "ring-2 ring-emerald-500 bg-emerald-50/50" : "ring-1 ring-slate-200 hover:ring-slate-300"}`}>
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon className="w-4 h-4" />{l}</span>
                      <span className="block text-xs text-slate-500 mt-0.5">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Yer / hat adı <span className="font-normal text-slate-400">(isteğe bağlı)</span></label>
                <input value={place} onChange={e => setPlace(e.target.value.slice(0, 60))} placeholder="Örn. Montaj Hattı 2" className={inputCls} />
                <p className="text-xs text-slate-500 mt-1.5">Giriş ekranında ve afişte görünür; her hat için ayrı afiş basabilirsiniz.</p>
              </div>
              <p className="text-xs text-slate-400 break-all">{url}</p>
            </div>
            <div className="rounded-2xl ring-1 ring-slate-200 p-3 bg-white">
              {dataUrl ? <img src={dataUrl} alt="Giriş QR kodu" className="w-full aspect-square" /> : <div className="w-full aspect-square bg-slate-100 animate-pulse rounded-xl" />}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 mt-6">
            <Button variant="outline" onClick={download} disabled={!dataUrl}><Download className="w-4 h-4" />PNG indir</Button>
            <Button variant="brand" onClick={() => setPoster(true)} disabled={!dataUrl}><Printer className="w-4 h-4" />A4 afiş</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="kaizen-qr-noprint w-[210mm] max-w-full mx-auto mb-3 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setPoster(false)}>Geri</Button>
            <div className="flex gap-2">
              <Button variant="brand" onClick={() => window.print()}><Printer className="w-4 h-4" />Yazdır / PDF</Button>
              <Button variant="ghost" onClick={onClose}><X className="w-4 h-4" />Kapat</Button>
            </div>
          </div>
          <Poster dataUrl={dataUrl} companyName={companyName} place={place.trim()} kiosk={kiosk} url={url} />
        </>
      )}
    </div>,
    document.body
  );
}

// A4 portrait, readable from a couple of metres: big headline, big QR, three steps.
function Poster({ dataUrl, companyName, place, kiosk, url }: { dataUrl: string; companyName: string; place: string; kiosk: boolean; url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div id="kaizen-qr-poster" ref={ref} className="w-[210mm] h-[297mm] mx-auto bg-white shadow-2xl overflow-hidden flex flex-col text-slate-900">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-900 text-white px-[16mm] pt-[16mm] pb-[12mm]">
        <div className="flex items-center gap-[5mm]">
          <span className="w-[16mm] h-[16mm] rounded-[4mm] bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center"><Lightbulb className="w-[9mm] h-[9mm]" /></span>
          <div>
            <p className="text-[13pt] text-emerald-200 font-semibold">{companyName || "Kaizen Öneri Sistemi"}</p>
            {place && <p className="text-[11pt] text-white/70">{place}</p>}
          </div>
        </div>
        <h1 className="text-[34pt] font-bold leading-tight mt-[10mm]">Bir fikriniz mi var?</h1>
        <p className="text-[17pt] text-white/85 mt-[3mm]">Kaizen önerinizi {kiosk ? "bu tabletten" : "telefonunuzdan"} 2 dakikada verin.</p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-[16mm]">
        {dataUrl && <img src={dataUrl} alt="QR" className="w-[105mm] h-[105mm]" />}
        <p className="text-[13pt] font-semibold text-slate-500 mt-[4mm]">{kiosk ? "Kiosk girişi" : "Telefon kamerasıyla okutun"}</p>
      </div>
      <div className="px-[16mm] pb-[14mm]">
        <ol className="grid grid-cols-3 gap-[5mm]">
          {[["Okutun", "QR kodu telefonunuzun kamerasıyla okutun."], ["Giriş yapın", "Sicil numaranızla girin."], ["Önerinizi yazın", "Sorunu ve iyileştirmeyi anlatın, fotoğraf ekleyin."]].map(([t, d], i) => (
            <li key={t} className="rounded-[4mm] bg-slate-50 border border-slate-200 p-[5mm]">
              <span className="w-[9mm] h-[9mm] rounded-full bg-emerald-600 text-white text-[13pt] font-bold flex items-center justify-center">{i + 1}</span>
              <p className="text-[13pt] font-bold mt-[3mm]">{t}</p>
              <p className="text-[10.5pt] text-slate-600 mt-[1mm] leading-snug">{d}</p>
            </li>
          ))}
        </ol>
        <p className="text-[8pt] text-slate-400 mt-[6mm] break-all text-center">{url}</p>
      </div>
    </div>
  );
}
