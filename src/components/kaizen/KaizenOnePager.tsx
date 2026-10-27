import React from "react";
import { Printer, X, ArrowRight } from "lucide-react";
import { KaizenSuggestion, KaizenImplementation, KaizenEvaluation } from "./kaizenTypes";
import { percentChange } from "./kaizenCalc";
import { Button } from "./kaizenUi";

// Tek sayfalık "Önce / Sonra" çıktısı (A4). Standart iş / SOP modülü olmadığı için, uygulanan her
// Kaizen'in özeti bu tek sayfada toplanır: problem, çözüm, ölçüm, kazanç ve onaylar. Tarayıcının
// yazdır penceresinden PDF olarak kaydedilebilir; ekstra kütüphane gerektirmez.
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
@page { size: A4 portrait; margin: 8mm; }
@media print {
  body * { visibility: hidden !important; }
  #kaizen-onepager, #kaizen-onepager * { visibility: visible !important; }
  .kaizen-op-overlay { position: absolute !important; inset: 0 !important; overflow: visible !important; background: none !important; padding: 0 !important; }
  #kaizen-onepager { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; margin: 0 !important; }
  .kaizen-op-noprint { display: none !important; }
}
`;

function PhotoGrid({ photos, empty }: { photos: { dataUrl: string; caption?: string }[]; empty: string }) {
  if (!photos.length) {
    return <div className="h-40 border border-dashed border-slate-300 rounded flex items-center justify-center text-xs text-slate-400">{empty}</div>;
  }
  const shown = photos.slice(0, 2);
  return (
    <div className={`grid gap-2 ${shown.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {shown.map((p, i) => (
        <figure key={i} className="m-0">
          <img src={p.dataUrl} alt={p.caption || ""} className="w-full h-40 object-cover rounded border border-slate-200" />
          {p.caption && <figcaption className="text-[10px] text-slate-500 mt-0.5">{p.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

export default function KaizenOnePager({ suggestion: s, implementation: impl, evaluation: ev, companyName, onClose }: Props) {
  const before = impl?.photosBefore?.length ? impl.photosBefore : s.photosCurrent || [];
  const after = impl?.photosAfter?.length ? impl.photosAfter : s.photosPropose || [];
  const bm = impl?.beforeMetric;
  const am = impl?.afterMetric;
  const hasMetric = !!bm && !!am && bm.value !== null && am.value !== null;
  const change = hasMetric ? percentChange(bm!.value, am!.value) : null;
  const verified = impl?.verification?.status === "Doğrulandı";
  const doneActions = (impl?.actions || []).filter(a => a.done);

  return (
    <div className="kaizen-op-overlay fixed inset-0 z-50 bg-slate-900/70 overflow-auto p-4 sm:p-8">
      <style>{PRINT_CSS}</style>
      <div className="kaizen-op-noprint max-w-[210mm] mx-auto mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Tek Sayfa — Önce / Sonra</p>
        <div className="flex gap-2">
          <Button variant="brand" onClick={() => window.print()}><Printer className="w-4 h-4" />Yazdır / PDF</Button>
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4" />Kapat</Button>
        </div>
      </div>

      <div id="kaizen-onepager" className="max-w-[210mm] min-h-[290mm] mx-auto bg-white shadow-2xl p-[9mm] text-slate-900 text-[12px] leading-snug">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{companyName || "Kaizen"} · Kaizen Önce / Sonra</p>
            <h1 className="text-[20px] font-black leading-tight mt-0.5">{s.subject}</h1>
          </div>
          <div className="text-right text-[10px] text-slate-600 shrink-0">
            <p>Kayıt: <b>{s.id.slice(-8).toUpperCase()}</b></p>
            <p>Öneri tarihi: <b>{fmtDate(s.createdAt)}</b></p>
            <p>Tamamlanma: <b>{fmtDate(impl?.completedAt)}</b></p>
          </div>
        </div>

        {/* Who */}
        <div className="grid grid-cols-4 gap-2 mt-2 text-[11px]">
          {[
            ["Öneri Sahibi", s.personnelName],
            ["Bölüm", s.personnelDepartment || "—"],
            ["Uygulama Sorumlusu", impl?.ownerName || s.teamLeaderName || "—"],
            ["Sınıf", (s.suggestionTypes || []).join(", ") || "—"]
          ].map(([k, v]) => (
            <div key={k} className="border border-slate-200 rounded px-2 py-1">
              <p className="text-[9px] uppercase tracking-wide text-slate-500">{k}</p>
              <p className="font-semibold truncate">{v}</p>
            </div>
          ))}
        </div>

        {/* Before / After */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mt-3 items-stretch">
          <section className="border border-red-200 rounded p-2 bg-red-50/40">
            <h2 className="text-[11px] font-black uppercase tracking-wide text-red-700 mb-1">Önce — Mevcut Durum</h2>
            <p className="whitespace-pre-wrap min-h-[40px] mb-2">{s.currentState}</p>
            <PhotoGrid photos={before} empty="Önce görseli yok" />
          </section>
          <div className="flex items-center"><ArrowRight className="w-5 h-5 text-slate-400" /></div>
          <section className="border border-emerald-200 rounded p-2 bg-emerald-50/40">
            <h2 className="text-[11px] font-black uppercase tracking-wide text-emerald-700 mb-1">Sonra — Uygulanan İyileştirme</h2>
            <p className="whitespace-pre-wrap min-h-[40px] mb-2">{s.improvementSuggestion}</p>
            <PhotoGrid photos={after} empty="Sonra görseli yok" />
          </section>
        </div>

        {/* Measurement */}
        <div className="mt-3 border border-slate-200 rounded p-2">
          <h2 className="text-[11px] font-black uppercase tracking-wide text-slate-600 mb-1">Ölçüm</h2>
          {hasMetric ? (
            <div className="flex items-center gap-4">
              <p className="text-[11px] text-slate-600 min-w-[90px]">{bm!.label || am!.label || "Ölçüt"}</p>
              <p className="text-[18px] font-black text-red-600 tabular-nums">{bm!.value} <span className="text-[11px] font-semibold">{bm!.unit}</span></p>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <p className="text-[18px] font-black text-emerald-700 tabular-nums">{am!.value} <span className="text-[11px] font-semibold">{am!.unit || bm!.unit}</span></p>
              {change !== null && (
                <p className="ml-auto text-[14px] font-black tabular-nums">{change > 0 ? "+" : ""}{change.toFixed(1).replace(".", ",")}%</p>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-[11px]">Ölçüm girilmedi.</p>
          )}
        </div>

        {/* Savings */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
          <div className="border border-slate-200 rounded p-2">
            <p className="text-[9px] uppercase tracking-wide text-slate-500">Tahmini Kazanç</p>
            <p className="text-[15px] font-black tabular-nums">{ev?.estimatedIncome ? fmtMoney(ev.estimatedIncome, ev.estimatedIncomeCurrency) : s.estimatedSaving ? fmtMoney(s.estimatedSaving, s.estimatedSavingCurrency) : "—"}</p>
          </div>
          <div className={`border rounded p-2 ${verified ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
            <p className="text-[9px] uppercase tracking-wide text-slate-500">Gerçekleşen Kazanç</p>
            <p className="text-[15px] font-black tabular-nums">{impl && impl.actualSaving ? fmtMoney(impl.actualSaving, impl.actualSavingCurrency) : "—"}</p>
            <p className="text-[10px] text-slate-500">{verified ? `Kurul tarafından doğrulandı (${fmtDate(impl?.verification?.at)})` : "Doğrulama bekliyor"}</p>
          </div>
          <div className="border border-slate-200 rounded p-2">
            <p className="text-[9px] uppercase tracking-wide text-slate-500">Kaizen Puanı</p>
            <p className="text-[15px] font-black tabular-nums">{ev ? `${ev.point} · ${ev.criteriaLabel}` : "—"}</p>
          </div>
        </div>

        {/* Actions + follow-ups */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="border border-slate-200 rounded p-2">
            <h2 className="text-[11px] font-black uppercase tracking-wide text-slate-600 mb-1">Yapılan Aksiyonlar</h2>
            {doneActions.length ? (
              <ul className="space-y-0.5">
                {doneActions.slice(0, 8).map(a => <li key={a.id} className="flex gap-1.5"><span>✓</span><span>{a.text}</span></li>)}
              </ul>
            ) : <p className="text-slate-400 text-[11px]">—</p>}
          </div>
          <div className="border border-slate-200 rounded p-2">
            <h2 className="text-[11px] font-black uppercase tracking-wide text-slate-600 mb-1">Kalıcılık Kontrolü</h2>
            {(impl?.followUps || []).length ? (
              <ul className="space-y-0.5">
                {impl!.followUps.map(f => (
                  <li key={f.days} className="flex justify-between gap-2">
                    <span>{f.days}. gün ({fmtDate(f.dueDate)})</span>
                    <b>{f.result || "Bekliyor"}</b>
                  </li>
                ))}
              </ul>
            ) : <p className="text-slate-400 text-[11px]">—</p>}
          </div>
        </div>

        {/* Yokoten */}
        {ev?.yokoten && (
          <p className="mt-3 text-[11px] border border-amber-200 bg-amber-50 rounded px-2 py-1">
            <b>Yokoten (yaygınlaştırma):</b> {ev.yokotenDescription || "Başka alanlara yayılabilir."} {ev.yokotenImplemented ? "— Uygulandı" : ""}
          </p>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-4 mt-6 text-[10px] text-slate-600">
          {["Hazırlayan", "Takım Lideri / Amir", "Kaizen Kurulu"].map(role => (
            <div key={role} className="pt-8 border-t border-slate-400 text-center">{role}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
