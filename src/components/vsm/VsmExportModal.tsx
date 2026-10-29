// VSM — export / import dialog (plan step V8): multi-page PDF report, Excel workbook, map PNG, and the
// Excel field data form (download, fill on the floor, upload).
import React, { useRef } from "react";
import { Share2, Loader2, FileText, FileSpreadsheet, Image as ImageIcon, Download, Upload } from "lucide-react";
import { useVsm } from "./VsmContext";

const Option = ({ icon, color, title, note, onClick }: { icon: React.ReactNode; color: string; title: string; note: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition text-left flex flex-col gap-2 font-bold cursor-pointer"
  >
    <div className={`${color} p-1 rounded-lg self-start`}>{icon}</div>
    <span className="text-slate-800">{title}</span>
    <span className="text-[10px] font-normal text-slate-500">{note}</span>
  </button>
);

export default function VsmExportModal() {
  const { setExportModalOpen, exportStatus, handleTriggerExport, handleImportFieldForm, simulationMode } = useVsm();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={() => setExportModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs" />

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto z-10 animate-in zoom-in-95 duration-150">
        <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
          <h3 className="text-xs font-black uppercase tracking-wider font-mono flex items-center space-x-1.5">
            <Share2 className="w-4 h-4 text-slate-200" />
            <span>Dışa Aktar &amp; Saha Formu</span>
          </h3>
          <button onClick={() => setExportModalOpen(false)} className="text-slate-400 hover:text-white font-black cursor-pointer text-xs">✕</button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-600">
          {exportStatus ? (
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-center space-x-3">
              <Loader2 className="w-5 h-5 text-slate-900 animate-spin" />
              <span className="font-bold text-slate-800 font-mono text-[11px]">{exportStatus}</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Option icon={<FileText className="w-5 h-5" />} color="bg-red-100 text-red-600" title="PDF Raporu"
                  note="Özet, mevcut (ve varsa gelecek) harita, proses verileri, göstergeler, norm kadro, ürün ailesi."
                  onClick={() => handleTriggerExport("PDF Report")} />
                <Option icon={<FileSpreadsheet className="w-5 h-5" />} color="bg-emerald-100 text-emerald-600" title="Excel Çalışma Kitabı"
                  note="Proje, mevcut/gelecek durum, zaman çizelgesi, göstergeler, norm kadro, ürün matrisi."
                  onClick={() => handleTriggerExport("Excel")} />
                <Option icon={<ImageIcon className="w-5 h-5" />} color="bg-blue-100 text-blue-600" title="Harita PNG"
                  note={`Ekrandaki ${simulationMode === "future" ? "gelecek" : "mevcut"} durum haritası.`}
                  onClick={() => handleTriggerExport("High Res PNG")} />
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <div className="font-extrabold text-slate-800 text-xs">Saha Veri Formu (Excel)</div>
                <p className="text-[11px]">
                  Formu indirin, sahada doldurun, buradan yükleyin. Yükleme mevcut durum proseslerini günceller ve yeni satırları ekler;
                  hiçbir prosesi silmez. Ardından Kaydet'e basın.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleTriggerExport("Saha Formu")}
                    className="flex items-center gap-1.5 bg-slate-950 text-white px-3 py-2 rounded-xl font-bold cursor-pointer">
                    <Download className="w-4 h-4" /> Formu indir
                  </button>
                  <button onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-800 px-3 py-2 rounded-xl font-bold cursor-pointer">
                    <Upload className="w-4 h-4" /> Doldurulmuş formu yükle
                  </button>
                  <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleImportFieldForm(f); }} />
                </div>
              </div>

              <p className="text-[10px] text-slate-400">
                PDF sayfaları görüntü olarak üretilir (Türkçe karakterler korunur, metin seçilemez).
              </p>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button onClick={() => setExportModalOpen(false)}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl font-bold text-xs cursor-pointer transition text-slate-700">
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
