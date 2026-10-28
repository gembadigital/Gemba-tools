import React, { useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Upload, X, CheckCircle2, AlertTriangle, XCircle, Download, MinusCircle } from "lucide-react";
import { KaizenPersonnel } from "./kaizenTypes";
import { KaizenApi } from "./KaizenSuggestionSystem";
import { IMPORT_COLUMNS, buildOrg, ImportRowResult } from "../../utils/kaizenOrg";
import { Button, EmptyState, tableCls, theadCls, thCls, tdCls, trCls } from "./kaizenUi";

// Excel ile personel yükleme (Faz 3.2). The file is parsed in the browser, then sent to the server
// twice: first as a dry run (the server's own validation decides every row and the screen shows it),
// then for real when the user confirms.

const headerRow = IMPORT_COLUMNS.map(c => c.header + (c.required ? " *" : ""));

function instructionsSheet() {
  return XLSX.utils.aoa_to_sheet([
    ["Kaizen personel yükleme şablonu"],
    [],
    ["Sütun", "Zorunlu", "Açıklama"],
    ...IMPORT_COLUMNS.map(c => [c.header, c.required ? "Evet" : "", c.hint || ""]),
    [],
    ["Kurallar"],
    ["• Kişiler sicil no ile eşleşir: listede olan sicil güncellenir, olmayan yeni kişi olarak eklenir."],
    ["• Güncellemede boş hücre o alanı değiştirmez."],
    ["• Amir Sicil No, aynı dosyada daha aşağıda eklenen birini de gösterebilir."],
    ["• Sütun sırası önemli değil; başlık adları yeterli."]
  ]);
}

export function downloadPersonnelTemplate() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headerRow]), "Personel");
  XLSX.utils.book_append_sheet(wb, instructionsSheet(), "Açıklama");
  XLSX.writeFile(wb, "Kaizen_Personel_Sablonu.xlsx");
}

// Current roster in the same format — edit and upload back for bulk changes.
export function exportPersonnel(personnel: KaizenPersonnel[]) {
  const org = buildOrg(personnel);
  const byId = new Map(personnel.map(p => [p.id, p]));
  const rows = [...personnel].sort((a, b) => a.name.localeCompare(b.name, "tr")).map(p => [
    p.employeeNo || "", p.name, p.email || "", p.department || "", p.jobTitle || "", p.shift || "",
    byId.get(org.managerOf.get(p.id) || "")?.employeeNo || "", p.machineLeaderName || "", p.machineLeaderEmail || "", p.isBoardMember ? "Evet" : "Hayır"
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headerRow, ...rows]), "Personel");
  XLSX.utils.book_append_sheet(wb, instructionsSheet(), "Açıklama");
  XLSX.writeFile(wb, `Kaizen_Personel_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

type Summary = { created: number; updated: number; unchanged: number; errors: number; warnings: number; cascaded: number };

const ACTION: Record<ImportRowResult["action"], { label: string; cls: string; icon: any }> = {
  create: { label: "Yeni", cls: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  update: { label: "Güncellenecek", cls: "bg-blue-50 text-blue-700", icon: CheckCircle2 },
  unchanged: { label: "Değişiklik yok", cls: "bg-slate-100 text-slate-500", icon: MinusCircle },
  error: { label: "Hata", cls: "bg-red-50 text-red-600", icon: XCircle }
};

export default function KaizenPersonnelImport({ api, onClose, onDone, showToast }: {
  api: KaizenApi; onClose: () => void; onDone: () => void; showToast: (m: string) => void;
}) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [plan, setPlan] = useState<{ summary: Summary; results: ImportRowResult[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);

  const readFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true); setPlan(null); setFileName(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      // Prefer a sheet named "Personel", else the first one.
      const ws = wb.Sheets[wb.SheetNames.find(n => n.toLocaleLowerCase("tr") === "personel") || wb.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
      setRows(parsed);
      const res = await api.post("personnel/import", { rows: parsed, dryRun: true });
      if (res.success) setPlan(res.data);
      else showToast(`Hata: ${res.error || "Dosya kontrol edilemedi."}`);
    } catch {
      showToast("Hata: Dosya okunamadı. Excel (.xlsx) şablonunu kullanın.");
    }
    setBusy(false);
  };

  const apply = async () => {
    if (!rows) return;
    setBusy(true);
    const res = await api.post("personnel/import", { rows });
    setBusy(false);
    if (res.success) {
      const s: Summary = res.data.summary;
      showToast(`${s.created} kişi eklendi, ${s.updated} kişi güncellendi.`);
      onDone();
      onClose();
    } else showToast(`Hata: ${res.error || "İçe aktarılamadı."}`);
  };

  const s = plan?.summary;
  const applicable = s ? s.created + s.updated : 0;
  const shown = (plan?.results || []).filter(r => !onlyIssues || r.action === "error" || r.messages.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-modal="true" aria-label="Excel'den personel yükle">
      <aside className="bg-[#fafafa] w-full max-w-4xl h-full overflow-y-auto shadow-2xl flex flex-col animate-toast-in" onClick={e => e.stopPropagation()}>
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200/70 flex items-center justify-between gap-3 px-5 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><FileSpreadsheet className="w-5 h-5" /></span>
            <div><h3 className="text-lg font-bold text-slate-900">Excel'den personel yükle</h3><p className="text-xs text-slate-500">Sicil no ile eşleşir: olan güncellenir, olmayan eklenir.</p></div>
          </div>
          <button onClick={onClose} aria-label="Kapat" className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
        </header>

        <div className="p-5 sm:p-6 space-y-5 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-stretch">
            <label className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 p-5 cursor-pointer transition-colors"
              onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); readFile(e.dataTransfer.files?.[0]); }}>
              <span className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><Upload className="w-6 h-6" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{fileName || "Dosyayı seçin ya da buraya sürükleyin"}</span>
                <span className="block text-xs text-slate-500 mt-0.5">.xlsx · ilk satır başlık · en fazla 2000 satır</span>
              </span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <Button variant="outline" className="h-auto py-3" onClick={downloadPersonnelTemplate}><Download className="w-4 h-4" />Boş şablon</Button>
          </div>

          {busy && <div className="h-24 rounded-2xl bg-slate-200/60 animate-pulse" aria-busy="true" />}

          {s && !busy && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([["Yeni", s.created, "text-emerald-700"], ["Güncellenecek", s.updated, "text-blue-700"], ["Değişiklik yok", s.unchanged, "text-slate-500"], ["Hatalı satır", s.errors, "text-red-600"]] as const).map(([l, v, c]) => (
                  <div key={l} className="rounded-2xl bg-white ring-1 ring-slate-200/70 p-4"><p className="text-xs font-semibold text-slate-500">{l}</p><p className={`text-2xl font-bold tabular-nums mt-1 ${c}`}>{v}</p></div>
                ))}
              </div>
              {(s.warnings > 0 || s.cascaded > 0) && (
                <p className="text-sm text-amber-800 bg-amber-50 ring-1 ring-amber-200/70 rounded-xl px-4 py-3 flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{s.warnings > 0 && `${s.warnings} satır uyarılı yüklenecek (ör. amir bulunamadı, amir değişmez). `}{s.cascaded > 0 && `Dosyada olmayan ${s.cascaded} kişinin amir adı/e-postası da güncellenecek.`}</span>
                </p>
              )}

              <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900">{shown.length} satır</p>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer"><input type="checkbox" className="accent-emerald-600" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />Yalnızca hata ve uyarılar</label>
                </div>
                {shown.length === 0 ? <EmptyState icon={CheckCircle2} title="Gösterilecek satır yok" /> : (
                  <div className="overflow-x-auto max-h-[50vh]">
                    <table className={tableCls}>
                      <thead className={`${theadCls} sticky top-0`}><tr><th className={thCls}>Satır</th><th className={thCls}>Sicil</th><th className={thCls}>Ad Soyad</th><th className={thCls}>İşlem</th><th className={thCls}>Açıklama</th></tr></thead>
                      <tbody>{shown.map(r => {
                        const a = ACTION[r.action];
                        return (
                          <tr key={r.row} className={trCls}>
                            <td className={`${tdCls} tabular-nums text-slate-400`}>{r.row || "—"}</td>
                            <td className={`${tdCls} font-mono text-xs`}>{r.employeeNo || "—"}</td>
                            <td className={`${tdCls} font-medium text-slate-900`}>{r.name || "—"}</td>
                            <td className={tdCls}><span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${a.cls}`}><a.icon className="w-3.5 h-3.5" />{a.label}</span></td>
                            <td className={`${tdCls} text-xs ${r.action === "error" ? "text-red-600" : "text-amber-700"}`}>{r.messages.join(" ")}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <footer className="sticky bottom-0 px-5 sm:px-6 py-4 border-t border-slate-200 bg-white/95 backdrop-blur flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{s ? (s.errors > 0 ? "Hatalı satırlar atlanır; diğerleri yüklenir." : "Tüm satırlar geçerli.") : "Önce dosyayı seçin; hiçbir şey kaydedilmeden kontrol edilir."}</p>
          <Button variant="brand" className="h-11 px-5" disabled={!s || applicable === 0 || busy} onClick={apply}>
            <Upload className="w-4 h-4" />{applicable > 0 ? `${applicable} kaydı içe aktar` : "İçe aktar"}
          </Button>
        </footer>
      </aside>
    </div>
  );
}
