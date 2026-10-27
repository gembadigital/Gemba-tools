import React from "react";
import { Printer, X, ArrowRight } from "lucide-react";
import { KaizenSuggestion, KaizenImplementation, KaizenEvaluation } from "./kaizenTypes";
import { percentChange } from "./kaizenCalc";
import { Button } from "./kaizenUi";

// Yatay (A4 landscape) "Öncesi / Sonrası İyileştirme Çalışmaları" formu. Düzen, Gemba Tools CI Proje
// Yönetimi'ndeki "Kaizen Öncesi Sonrası" formuyla aynıdır (başlık + tarih/yapan/bölüm, konu/hedef,
// kategori/alan, önce-sonra görsel ve açıklama, getiri açıklaması, maliyet/verimlilik/kalite/güvenlik
// tablosu). Tarayıcının yazdır penceresinden PDF olarak kaydedilir.
interface Props {
  suggestion: KaizenSuggestion;
  implementation?: KaizenImplementation;
  evaluation?: KaizenEvaluation;
  companyName?: string;
  onClose: () => void;
}

const fmtMoney = (n: number, cur: string) => `${(n || 0).toLocaleString("tr-TR")} ${cur || "TL"}`;
const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "—");

const PRINT_CSS = `
@page { size: A4 landscape; margin: 6mm; }
@media print {
  body * { visibility: hidden !important; }
  #kaizen-onepager, #kaizen-onepager * { visibility: visible !important; }
  .kaizen-op-overlay { position: absolute !important; inset: 0 !important; overflow: visible !important; background: none !important; padding: 0 !important; }
  #kaizen-onepager { position: absolute; left: 0; top: 0; width: 285mm !important; max-width: none !important; height: 197mm !important; min-height: 0 !important; box-shadow: none !important; margin: 0 !important; }
  .kaizen-op-noprint { display: none !important; }
  #kaizen-onepager * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

// Suggestion classes -> the CI form's Kategori / Alan checkboxes.
function categoryOf(types: string[]): "Verimlilik" | "Kalite" | "Güvenlik" {
  if (types.includes("ISG")) return "Güvenlik";
  if (types.includes("Kalite")) return "Kalite";
  return "Verimlilik";
}
const box = (on: boolean) => (on ? "☑" : "☐");

function Photo({ photos, empty }: { photos: { dataUrl: string; caption?: string }[]; empty: string }) {
  if (!photos.length) {
    return <div className="h-full min-h-[48mm] border border-dashed border-slate-300 rounded flex items-center justify-center text-[10px] italic text-slate-400">{empty}</div>;
  }
  const shown = photos.slice(0, 2);
  return (
    <div className={`grid gap-1.5 h-full ${shown.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {shown.map((p, i) => <img key={i} src={p.dataUrl} alt={p.caption || ""} className="w-full h-full max-h-[62mm] object-contain bg-slate-50 rounded border border-slate-200" />)}
    </div>
  );
}

const lbl = "bg-slate-100 text-slate-700 font-bold text-[9px] uppercase tracking-wide px-1.5 py-1 border border-slate-300";
const cell = "border border-slate-300 px-1.5 py-1 text-[10.5px]";

export default function KaizenOnePager({ suggestion: s, implementation: impl, evaluation: ev, companyName, onClose }: Props) {
  const before = impl?.photosBefore?.length ? impl.photosBefore : s.photosCurrent || [];
  const after = impl?.photosAfter?.length ? impl.photosAfter : s.photosPropose || [];
  const bm = impl?.beforeMetric;
  const am = impl?.afterMetric;
  const hasMetric = !!bm && !!am && bm.value !== null && am.value !== null;
  const change = hasMetric ? percentChange(bm!.value, am!.value) : null;
  const verified = impl?.verification?.status === "Doğrulandı";
  const doneActions = (impl?.actions || []).filter(a => a.done);
  const b = impl?.benefits || {};
  const types = s.suggestionTypes || [];
  const category = categoryOf(types);
  const estimated = ev?.estimatedIncome ? fmtMoney(ev.estimatedIncome, ev.estimatedIncomeCurrency) : s.estimatedSaving ? fmtMoney(s.estimatedSaving, s.estimatedSavingCurrency) : "—";
  const actual = impl && impl.actualSaving ? fmtMoney(impl.actualSaving, impl.actualSavingCurrency) : "—";
  const benefitText = [
    impl?.benefitDescription,
    hasMetric ? `${bm!.label || "Ölçüt"}: ${bm!.value} ${bm!.unit} → ${am!.value} ${am!.unit || bm!.unit}${change !== null ? ` (${change > 0 ? "+" : ""}${change.toFixed(1).replace(".", ",")}%)` : ""}` : "",
    `Tahmini kazanç: ${estimated} · Gerçekleşen: ${actual}${verified ? " (Kurul doğruladı)" : impl ? " (doğrulama bekliyor)" : ""}`
  ].filter(Boolean).join("  |  ");
  const followText = (impl?.followUps || []).map(f => `${f.days}. gün: ${f.result === "Sürüyor" ? "yerinde" : f.result === "Bozuldu" ? "bozuldu" : "bekliyor"}`).join(" · ");

  return (
    <div className="kaizen-op-overlay fixed inset-0 z-50 bg-slate-900/70 overflow-auto p-4 sm:p-8">
      <style>{PRINT_CSS}</style>
      <div className="kaizen-op-noprint max-w-[297mm] mx-auto mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Öncesi / Sonrası — Yatay A4</p>
        <div className="flex gap-2">
          <Button variant="brand" onClick={() => window.print()}><Printer className="w-4 h-4" />Yazdır / PDF</Button>
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4" />Kapat</Button>
        </div>
      </div>

      <div id="kaizen-onepager" className="max-w-[297mm] w-full min-h-[200mm] mx-auto bg-white shadow-2xl p-[6mm] text-slate-900 flex flex-col gap-1.5">
        {/* Title row */}
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <div className="bg-[#1e1b4b] text-white flex items-center justify-center px-3 py-2 rounded-sm">
            <h1 className="text-[16px] font-black tracking-wide text-center">ÖNCESİ SONRASI İYİLEŞTİRME ÇALIŞMALARI</h1>
          </div>
          <table className="border-collapse text-[10.5px] min-w-[78mm]">
            <tbody>
              <tr><td className={lbl}>TARİH</td><td className={`${cell} font-semibold`}>{fmtDate(impl?.completedAt || s.updatedAt)}</td></tr>
              <tr><td className={lbl}>ÇALIŞMAYI YAPAN</td><td className={cell}>{impl?.ownerName || s.personnelName}</td></tr>
              <tr><td className={lbl}>BÖLÜMÜ</td><td className={cell}>{s.personnelDepartment || "—"}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Konu / Hedef / Kategori / Alan */}
        <table className="border-collapse w-full">
          <tbody>
            <tr>
              <td className={`${lbl} w-[16mm]`}>KONU :</td>
              <td className={`${cell} font-bold`}>{s.subject}</td>
              <td className={`${lbl} w-[22mm]`}>KATEGORİ</td>
              <td className={`${cell} w-[78mm]`}>{box(category === "Verimlilik")} Verimlilik &nbsp; {box(category === "Kalite")} Kalite &nbsp; {box(category === "Güvenlik")} Güvenlik</td>
            </tr>
            <tr>
              <td className={lbl}>HEDEF :</td>
              <td className={cell}>{hasMetric && bm!.label ? `${bm!.label}: ${bm!.value} ${bm!.unit} → ${am!.value} ${am!.unit || bm!.unit}` : s.improvementSuggestion.slice(0, 140)}</td>
              <td className={lbl}>ALAN</td>
              <td className={cell}>{box(types.includes("5S"))} 5S &nbsp; {box(types.includes("Maliyet Azaltma"))} Maliyet</td>
            </tr>
          </tbody>
        </table>

        {/* Before / After */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 flex-1 min-h-0">
          <section className="flex flex-col border border-slate-300 rounded-sm min-h-0">
            <h2 className="bg-[#312e81] text-white text-center text-[10.5px] font-bold py-1">İYİLEŞTİRME ÖNCESİ</h2>
            <div className="flex-1 p-1.5 min-h-0"><Photo photos={before} empty="Görsel eklenmedi" /></div>
            <p className={`${lbl} border-x-0`}>AÇIKLAMA:</p>
            <p className="px-1.5 py-1 text-[10.5px] whitespace-pre-wrap min-h-[16mm] max-h-[24mm] overflow-hidden">{s.currentState}</p>
          </section>
          <div className="flex items-center"><ArrowRight className="w-5 h-5 text-slate-400" /></div>
          <section className="flex flex-col border border-slate-300 rounded-sm min-h-0">
            <h2 className="bg-[#312e81] text-white text-center text-[10.5px] font-bold py-1">İYİLEŞTİRME SONRASI</h2>
            <div className="flex-1 p-1.5 min-h-0"><Photo photos={after} empty="Görsel eklenmedi" /></div>
            <p className={`${lbl} border-x-0`}>AÇIKLAMA:</p>
            <p className="px-1.5 py-1 text-[10.5px] whitespace-pre-wrap min-h-[16mm] max-h-[24mm] overflow-hidden">{s.improvementSuggestion}{doneActions.length ? `\nYapılan: ${doneActions.slice(0, 5).map(a => a.text).join("; ")}` : ""}</p>
          </section>
        </div>

        {/* Getiri */}
        <table className="border-collapse w-full">
          <tbody>
            <tr><td className={lbl} colSpan={4}>GETİRİ AÇIKLAMASI : (Parasal veya oran bazında getirinin rakamsal ifadesi)</td></tr>
            <tr><td className={`${cell} min-h-[10mm]`} colSpan={4}>{benefitText}</td></tr>
            <tr>
              {["Maliyet", "Verimlilik", "Kalite", "Güvenlik"].map(h => (
                <td key={h} className={`${cell} bg-indigo-50 text-[#1e1b4b] font-bold text-center w-1/4`}>{h}</td>
              ))}
            </tr>
            <tr>
              <td className={cell}>Enerji: {b.costEnergy || "-"} &nbsp; İş Gücü: {b.costLabor || "-"} &nbsp; Malzeme: {b.costMaterial || "-"}</td>
              <td className={cell}>Makine: {b.productivityMachine || "-"} &nbsp; Adam: {b.productivityMan || "-"} &nbsp; Malzeme: {b.productivityMaterial || "-"}</td>
              <td className={cell}>Ürün: {b.qualityProduct || "-"} &nbsp; Malzeme: {b.qualityMaterial || "-"} &nbsp; Fire: {b.qualityScrap || "-"}</td>
              <td className={cell}>Risk Derecesi: {b.safetyRiskDegree || "-"} &nbsp; KSO: {b.safetyKso || "-"}</td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex items-end justify-between gap-4 text-[9px] text-slate-500">
          <p>{companyName ? `${companyName} — ` : ""}Gemba Partner Kaizen Öneri Sistemi · Kayıt {s.id.slice(-8).toUpperCase()}{ev ? ` · Puan: ${ev.point} (${ev.criteriaLabel})` : ""}{followText ? ` · Kalıcılık: ${followText}` : ""}</p>
          <div className="flex gap-6 shrink-0">
            {["Hazırlayan", "Takım Lideri", "Kaizen Kurulu"].map(r => <span key={r} className="border-t border-slate-400 pt-0.5 min-w-[26mm] text-center">{r}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
