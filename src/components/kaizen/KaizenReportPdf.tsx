import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Lightbulb } from "lucide-react";
import { Button } from "./kaizenUi";
import type { ReportPack, Cell } from "./kaizenReportExport";

// Yönetici özeti PDF'i (Faz 5.7): one A4 portrait page rendered from the same ReportPack as the
// Excel file, printed with the browser's "Save as PDF". Like the one-pager, the overlay is the only
// thing printed and the sheet is scaled with `zoom` to fit the printable area instead of being cut.
const PAGE_W_MM = 198;
const PAGE_H_MM = 285;
const MM = 96 / 25.4;
const PRINT_CSS = `
@page { size: A4 portrait; margin: 6mm; }
@media print {
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  body > *:not(.kaizen-rp-overlay) { display: none !important; }
  .kaizen-rp-overlay { position: static !important; overflow: visible !important; background: none !important; padding: 0 !important; }
  .kaizen-rp-noprint { display: none !important; }
  #kaizen-report-pdf { width: ${PAGE_W_MM}mm !important; min-height: 0 !important; box-shadow: none !important; margin: 0 !important; zoom: var(--rp-scale, 1); break-inside: avoid; page-break-inside: avoid; }
  #kaizen-report-pdf * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

function fitScale(el: HTMLElement): number {
  const prev = el.style.minHeight;
  el.style.minHeight = "0";
  const h = el.scrollHeight;
  el.style.minHeight = prev;
  return Math.min(1, (PAGE_H_MM * MM * 0.985) / h);
}

const fmt = (v: Cell) => (typeof v === "number" ? v.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : v ?? "—");
const th = "text-left font-bold text-[8.5px] uppercase tracking-wide text-slate-500 px-1.5 py-1 border-b border-slate-300";
const td = "px-1.5 py-1 text-[9.5px] border-b border-slate-100 tabular-nums";

function Table({ columns, rows, numericFrom = 1 }: { columns: string[]; rows: Cell[][]; numericFrom?: number }) {
  return (
    <table className="w-full border-collapse">
      <thead><tr>{columns.map((c, i) => <th key={c} className={`${th} ${i >= numericFrom ? "text-right" : ""}`}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, k) => <tr key={k}>{r.map((v, i) => <td key={i} className={`${td} ${i >= numericFrom ? "text-right" : "text-slate-800"} ${i === 0 ? "font-semibold" : ""}`}>{fmt(v)}</td>)}</tr>)}</tbody>
    </table>
  );
}

export default function KaizenReportPdf({ pack, onClose }: { pack: ReportPack; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const applyFit = () => { if (ref.current) ref.current.style.setProperty("--rp-scale", String(fitScale(ref.current))); };
  useEffect(() => {
    window.addEventListener("beforeprint", applyFit);
    return () => window.removeEventListener("beforeprint", applyFit);
  }, []);
  const print = () => {
    applyFit();
    const prev = document.title;
    document.title = pack.title + (pack.company ? ` — ${pack.company}` : ""); // default PDF file name
    window.print();
    document.title = prev;
  };
  const maxStatus = Math.max(1, ...pack.statusCounts.map(s => s.count));

  return createPortal(
    <div className="kaizen-rp-overlay fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-[2px] overflow-auto p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Rapor PDF önizleme">
      <style>{PRINT_CSS}</style>
      <div className="kaizen-rp-noprint w-[210mm] max-w-full mx-auto mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-white/90">Yazdır penceresinde hedef olarak <b>PDF olarak kaydet</b>'i seçin.</p>
        <div className="flex gap-2">
          <Button variant="brand" onClick={print}><Printer className="w-4 h-4" />Yazdır / PDF</Button>
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4" />Kapat</Button>
        </div>
      </div>

      <div id="kaizen-report-pdf" ref={ref} className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl text-slate-900 p-[8mm] flex flex-col gap-[4mm]">
        <header className="rounded-[3mm] bg-gradient-to-br from-slate-900 to-emerald-900 text-white px-[6mm] py-[5mm] flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><span className="w-7 h-7 rounded-lg bg-amber-400 text-amber-950 flex items-center justify-center"><Lightbulb className="w-4 h-4" /></span><p className="text-[10px] font-semibold text-emerald-200">{pack.company || "Kaizen Öneri Sistemi"}</p></div>
            <h1 className="text-[20px] font-bold mt-2 leading-tight">{pack.title} — yönetici özeti</h1>
            <p className="text-[10px] text-white/80 mt-0.5">{pack.scope}</p>
          </div>
          <div className="text-right text-[9px] text-white/80 shrink-0">
            <p>{new Date(pack.generatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p className="mt-0.5">Tutarlar: {pack.base}</p>
          </div>
        </header>
        <p className="text-[9px] text-slate-600 -mt-[1mm]"><b>Filtreler:</b> {pack.filters.length ? pack.filters.join(" · ") : "yok (tüm kayıtlar)"}</p>

        <section className="grid grid-cols-5 gap-[2mm]">
          {pack.kpis.map(k => (
            <div key={k.label} className="rounded-[2mm] border border-slate-200 px-[2.5mm] py-[2mm]">
              <p className="text-[7.5px] font-bold uppercase tracking-wide text-slate-500 leading-tight">{k.label}</p>
              <p className="text-[15px] font-black tabular-nums mt-0.5">{fmt(k.value)}{k.unit && <span className="text-[8px] font-semibold text-slate-500 ml-0.5">{k.unit}</span>}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-[1.25fr_1fr] gap-[4mm]">
          <div>
            <h2 className="text-[11px] font-bold mb-1">Geri dönüş</h2>
            <Table columns={["", "Beklenen", "Gerçekleşen"]} rows={pack.roi.map(r => [r.label, r.expected === null ? "—" : `${fmt(r.expected)}${r.unit ? " " + r.unit : ""}`, r.actual === null ? "—" : `${fmt(r.actual)}${r.unit ? " " + r.unit : ""}`])} />
            <p className="text-[7.5px] text-slate-500 mt-1">Beklenen: Kurul'un kabul ettikleri · Gerçekleşen: Kurul'un doğruladığı uygulamalar. Parça başı / senelik kazanç yıllık, diğerleri tek seferlik; ROI ilk yıl.</p>
          </div>
          <div>
            <h2 className="text-[11px] font-bold mb-1">Durum dağılımı</h2>
            <ul className="space-y-[1.2mm]">
              {pack.statusCounts.map(s => (
                <li key={s.label} className="text-[9px]">
                  <div className="flex justify-between"><span>{s.label}</span><b className="tabular-nums">{s.count}</b></div>
                  <div className="h-[1.6mm] rounded bg-slate-100 mt-[0.4mm]"><div className="h-full rounded bg-emerald-600" style={{ width: `${(s.count / maxStatus) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {pack.ranking.rows.length > 0 && (
          <section>
            <h2 className="text-[11px] font-bold mb-1">{pack.ranking.title}{pack.ranking.rows.length > 10 ? " (ilk 10)" : ""}</h2>
            <Table columns={pack.ranking.columns} rows={pack.ranking.rows.slice(0, 10)} />
          </section>
        )}

        {pack.top.rows.length > 0 && (
          <section>
            <h2 className="text-[11px] font-bold mb-1">{pack.top.title}</h2>
            <Table columns={pack.top.columns} rows={pack.top.rows} numericFrom={4} />
          </section>
        )}

        <footer className="mt-auto pt-[2mm] border-t border-slate-200 text-[7.5px] text-slate-400 flex justify-between">
          <span>Gemba Tools · Kaizen Öneri Sistemi</span>
          <span>{new Date(pack.generatedAt).toLocaleString("tr-TR")} · ayrıntılı liste Excel çıktısındadır</span>
        </footer>
      </div>
    </div>,
    document.body
  );
}
