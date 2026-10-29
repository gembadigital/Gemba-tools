// A3 presentation card dialog (plan steps C8 / C8b): preview scaled to fit the window (width and
// height, so the whole page is visible), PDF (A4 landscape, the card captured as an image — same technique as the dashboard PDF) and
// Excel (structured sheet with the same sections).
import React, { useEffect, useRef, useState } from "react";
import { X, FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { domToCanvas } from "modern-screenshot";
import { jsPDF } from "jspdf";
import type { KaizenCard } from "../../types";
import CiA3Card, { A3_WIDTH, A3_HEIGHT } from "./CiA3Card";
import { exportA3Excel } from "./ciExcelExport";
import { Button } from "./ciUi";

interface Props {
  project: KaizenCard;
  projectNo: string;
  companyName?: string;
  currencySymbol: string;
  onClose: () => void;
}

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ_-]+/g, "_").slice(0, 60);

export default function CiA3Dialog({ project, projectNo, companyName, currencySymbol, onClose }: Props) {
  const [busy, setBusy] = useState<"pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    // padding of the frame: 2 × 16 px (sm:p-4)
    const fit = () => setScale(Math.max(0.2, Math.min(1, (el.clientWidth - 34) / A3_WIDTH, (el.clientHeight - 34) / A3_HEIGHT)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const downloadPdf = async () => {
    if (!cardRef.current) return;
    setBusy("pdf");
    setError(null);
    try {
      const canvas = await domToCanvas(cardRef.current, { scale: 2, backgroundColor: "#f8fafc", width: A3_WIDTH, height: A3_HEIGHT });
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 297, 210);
      doc.save(`${safeName(projectNo)}_A3_${safeName(project.title || "proje")}.pdf`);
    } catch (e) {
      console.error("A3 PDF export failed", e);
      setError("PDF oluşturulamadı. Sayfayı yenileyip tekrar deneyin.");
    }
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-label="A3 sunum kartı">
      <div className="bg-slate-50 w-full sm:max-w-[1240px] sm:rounded-2xl shadow-2xl flex flex-col h-screen sm:h-[94vh]">
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3 border-b border-slate-200 bg-white sm:rounded-t-2xl">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900">A3 sunum kartı</h3>
            <p className="text-xs text-slate-500 truncate">{projectNo} · {project.title}</p>
          </div>
          <Button variant="outline" onClick={() => exportA3Excel(project, projectNo, { companyName, currencySymbol })}>
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
          <Button variant="brand" onClick={downloadPdf} disabled={busy !== null}>
            {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF
          </Button>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Kapat"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="mx-4 mt-3 text-sm rounded-xl px-4 py-2 bg-red-50 text-red-700 ring-1 ring-red-200">{error}</div>}
        <div ref={frameRef} className="overflow-auto p-4 flex-1 min-h-0">
          {/* The card keeps its real size (that is what the PDF captures); only this wrapper is scaled. */}
          <div style={{ width: A3_WIDTH * scale, height: A3_HEIGHT * scale }} className="mx-auto shadow-lg rounded-md overflow-hidden ring-1 ring-slate-200">
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: A3_WIDTH, height: A3_HEIGHT }}>
              <div ref={cardRef}>
                <CiA3Card project={project} projectNo={projectNo} companyName={companyName} currencySymbol={currencySymbol} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
