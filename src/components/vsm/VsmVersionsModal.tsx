// VSM — versions (plan step V7): save the maps as a named version, compare any two (or a version with
// the screen), restore one as the working state, delete own versions.
import React, { useMemo, useState } from "react";
import { History, X, Save, RotateCcw, Trash2 } from "lucide-react";
import { useVsm } from "./VsmContext";
import { stateMetrics, VSM_VERSION_ROWS, VsmVersionMetrics } from "./vsmVersions";
import { formatMoney } from "./vsmCalc";
import { canDeleteVsmOwned } from "../../utils/vsmAccess";

const NOW = "__now";

export default function VsmVersionsModal({ onClose }: { onClose: () => void }) {
  const { versions, handleSaveVersion, handleDeleteVersion, handleRestoreVersion, factorySetup, vsmProcesses, futureProcesses, futureSetup, currentUser, companyCurrency } = useVsm();
  const month = new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  const [label, setLabel] = useState(`Mevcut v${versions.length + 1} – ${month}`);
  const nowMetrics = useMemo(() => stateMetrics(factorySetup, vsmProcesses, futureProcesses ? { processes: futureProcesses, setup: futureSetup } : null),
    [factorySetup, vsmProcesses, futureProcesses, futureSetup]);

  // Options: each version's current map, its future map (if any), and the screen.
  const options = useMemo(() => {
    const o: { key: string; label: string; m: VsmVersionMetrics }[] = [{ key: `${NOW}:c`, label: "Ekrandaki mevcut durum", m: nowMetrics.current }];
    if (nowMetrics.future) o.push({ key: `${NOW}:f`, label: "Ekrandaki gelecek durum", m: nowMetrics.future });
    versions.forEach(v => {
      o.push({ key: `${v.id}:c`, label: `${v.label} — mevcut`, m: v.metrics.current });
      if (v.metrics.future) o.push({ key: `${v.id}:f`, label: `${v.label} — gelecek`, m: v.metrics.future });
    });
    return o;
  }, [versions, nowMetrics]);
  const [a, setA] = useState(options[options.length > 1 ? 1 : 0]?.key ?? `${NOW}:c`);
  const [b, setB] = useState(`${NOW}:c`);
  const A = options.find(o => o.key === a)?.m, B = options.find(o => o.key === b)?.m;
  const fmt = (k: keyof VsmVersionMetrics, v: any) =>
    v === undefined || v === null ? "—" : k === "annualLoss" ? (v > 0 ? formatMoney(v, companyCurrency) : "—") : typeof v === "number" ? v.toLocaleString("tr-TR", { maximumFractionDigits: 3 }) : String(v);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-950 text-white px-4 py-3 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider font-mono flex items-center gap-2"><History className="w-4 h-4" /> Versiyonlar</h3>
          <button onClick={onClose} className="p-1 text-slate-300 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 md:p-5 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={label} onChange={e => setLabel(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold" placeholder="Versiyon adı" />
            <button onClick={() => handleSaveVersion(label)} className="flex items-center justify-center gap-1.5 bg-slate-950 text-white font-bold px-3 py-2 rounded-xl cursor-pointer">
              <Save className="w-4 h-4" /> Ekrandaki haritaları versiyon olarak ekle
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Versiyon, mevcut (ve varsa gelecek) durumun salt okunur kopyasıdır; projeyle birlikte Kaydet'e basınca saklanır (en fazla 12).</p>

          <div className="space-y-2">
            {versions.length === 0 && <p className="text-slate-500">Henüz versiyon yok.</p>}
            {versions.map(v => (
              <div key={v.id} className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
                <span className="font-bold text-slate-900 flex-1 min-w-[180px]">{v.label}</span>
                <span className="text-slate-500">{new Date(v.createdAt).toLocaleDateString("tr-TR")}{v.createdByName ? ` · ${v.createdByName}` : ""}</span>
                <span className="font-mono text-slate-600">LT {fmt("leadTimeDays", v.metrics.current?.leadTimeDays)} g{v.metrics.future ? ` → ${fmt("leadTimeDays", v.metrics.future.leadTimeDays)} g` : ""}</span>
                <button onClick={() => handleRestoreVersion(v.id)} className="p-1.5 text-indigo-600 cursor-pointer" title="Ekrana geri yükle"><RotateCcw className="w-4 h-4" /></button>
                {canDeleteVsmOwned(currentUser, v) && <button onClick={() => handleDeleteVersion(v.id)} className="p-1.5 text-red-500 cursor-pointer" title="Sil"><Trash2 className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="font-extrabold text-slate-800">Karşılaştır</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select value={a} onChange={e => setA(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 font-semibold">
                {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <select value={b} onChange={e => setB(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 font-semibold">
                {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr className="bg-slate-50 text-slate-500"><th className="p-2 text-left">Gösterge</th><th className="p-2 text-right">A</th><th className="p-2 text-right">B</th><th className="p-2 text-right">Fark</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {VSM_VERSION_ROWS.map(r => {
                    const va = A?.[r.key] as any, vb = B?.[r.key] as any;
                    const num = typeof va === "number" && typeof vb === "number";
                    const diff = num ? vb - va : null;
                    const good = diff === null || diff === 0 ? null : r.lowerIsBetter ? diff < 0 : diff > 0;
                    return (
                      <tr key={r.key}>
                        <td className="p-2 font-bold text-slate-800">{r.label}</td>
                        <td className="p-2 text-right font-mono">{fmt(r.key, va)}</td>
                        <td className="p-2 text-right font-mono">{fmt(r.key, vb)}</td>
                        <td className={`p-2 text-right font-mono font-bold ${good === true ? "text-emerald-600" : good === false ? "text-red-600" : "text-slate-400"}`}>
                          {diff === null ? (va !== vb ? "değişti" : "—") : `${diff > 0 ? "+" : ""}${fmt(r.key, Math.round(diff * 1000) / 1000)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
