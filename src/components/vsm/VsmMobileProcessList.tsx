// VSM — phone view of the process tabs (plan step V3, user decision 8): a card per process and a full
// process form in a bottom sheet instead of the wide tables. Field list = the Excel field form columns
// (vsmExcel.ts), so phone entry, Excel form and tables stay in step. Edits follow Current / Future mode.
import React, { useState } from "react";
import { Plus, Trash2, X, ChevronRight } from "lucide-react";
import { useVsm } from "./VsmContext";
import { VSM_PROCESS_COLUMNS } from "./vsmExcel";
import { VSM_INVENTORY_TYPES, VsmProcess } from "./vsmTypes";
import { canDeleteVsmProcess } from "../../utils/vsmAccess";

const GROUPS: { title: string; keys: (keyof VsmProcess)[] }[] = [
  { title: "Temel", keys: ["name", "type", "machineCount", "operatorCount", "shifts"] },
  { title: "Üretim", keys: ["cycleTime", "idealCycleTime", "plannedQuantity", "actualQuantity", "changeoverTime", "breakdownTime", "firstPieceApproval"] },
  { title: "Kalite", keys: ["goodParts", "scrap", "rework"] },
  { title: "Stok (proses önü)", keys: ["inventoryBefore", "inventoryType", "fifoMax"] },
  { title: "Veri kutusu", keys: ["batchSize", "epei", "variantCount", "valueAddedTime", "transportTime"] },
  { title: "Not", keys: ["notes"] }
];
const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-900";

export default function VsmMobileProcessList() {
  const { activeProcesses, vsmProcesses, handleUpdateProcessField, handleAddProcess, handleDeleteProcess, currentUser, simulationMode } = useVsm();
  const [openId, setOpenId] = useState<string | null>(null);
  const p = activeProcesses.find(x => x.id === openId) || null;
  const col = (k: keyof VsmProcess) => VSM_PROCESS_COLUMNS.find(c => c.key === k);

  const field = (k: keyof VsmProcess) => {
    if (!p) return null;
    const c = col(k);
    const label = c?.header.replace(/ \(.*?\)$/, "") ?? String(k);
    const v = p[k] as any;
    if (k === "type") {
      return (
        <select value={p.type} onChange={e => handleUpdateProcessField(p.id, "type", e.target.value)} className={inputCls}>
          <option value="Manual">Manuel</option><option value="Semi Automatic">Yarı otomatik</option><option value="Automatic">Otomatik</option>
        </select>
      );
    }
    if (k === "inventoryType") {
      return (
        <select value={p.inventoryType ?? (p.isSupermarket ? "supermarket" : "pile")} className={inputCls}
          onChange={e => { handleUpdateProcessField(p.id, "inventoryType", e.target.value); handleUpdateProcessField(p.id, "isSupermarket", e.target.value === "supermarket"); }}>
          {VSM_INVENTORY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (c?.kind === "number") {
      return (
        <input type="number" inputMode="decimal" min={0} value={v ?? ""} placeholder={label} className={inputCls}
          onChange={e => {
            const raw = e.target.value.trim();
            const required = k === "machineCount" || k === "operatorCount" || k === "shifts" || k === "cycleTime" || k === "inventoryBefore";
            handleUpdateProcessField(p.id, k, raw === "" ? (required ? 0 : undefined) : Math.max(0, Number(raw)));
          }} />
      );
    }
    return k === "notes"
      ? <textarea value={v ?? ""} rows={3} className={inputCls} onChange={e => handleUpdateProcessField(p.id, k, e.target.value)} />
      : <input value={v ?? ""} className={inputCls} onChange={e => handleUpdateProcessField(p.id, k, e.target.value || (k === "name" ? "" : undefined))} />;
  };

  return (
    <div className="p-4 space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-900">Prosesler {simulationMode === "future" && <span className="text-amber-600">(gelecek simülasyon)</span>}</h2>
        {simulationMode === "current" && (
          <button onClick={handleAddProcess} className="flex items-center gap-1 bg-slate-950 text-white text-xs font-bold px-3 py-2 rounded-xl">
            <Plus className="w-4 h-4" /> Proses
          </button>
        )}
      </div>
      {activeProcesses.length === 0 && <p className="text-xs text-slate-500">Henüz proses yok.</p>}
      {activeProcesses.map((x, i) => (
        <button key={x.id} onClick={() => setOpenId(x.id)} className="w-full text-left bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3 shadow-xs">
          <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-extrabold text-slate-900 truncate">{x.name || "—"}</span>
            <span className="block text-[11px] font-mono text-slate-500">C/T {x.cycleTime} sn · OEE %{x.oee} · WIP {x.inventoryBefore}</span>
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      ))}

      {p && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setOpenId(null)} />
          <div className="relative w-full max-h-[88vh] overflow-y-auto bg-white rounded-t-3xl p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between sticky top-0 bg-white pb-2 border-b border-slate-100">
              <span className="text-sm font-black text-slate-900 truncate">{p.name || "Proses"}</span>
              <button onClick={() => setOpenId(null)} className="p-2 text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
              <div className="bg-slate-50 rounded-xl p-2"><div className="text-slate-400">OEE</div><div className="font-black">%{p.oee}</div></div>
              <div className="bg-slate-50 rounded-xl p-2"><div className="text-slate-400">Kapasite</div><div className="font-black">{p.capacity}</div></div>
              <div className="bg-slate-50 rounded-xl p-2"><div className="text-slate-400">Uptime</div><div className="font-black">%{p.availability}</div></div>
            </div>
            {GROUPS.map(g => (
              <div key={g.title} className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">{g.title}</div>
                <div className="grid grid-cols-2 gap-2">
                  {g.keys.filter(k => k !== "fifoMax" || p.inventoryType === "fifo").map(k => (
                    <label key={String(k)} className={`space-y-1 ${k === "name" || k === "notes" || k === "type" || k === "inventoryType" ? "col-span-2" : ""}`}>
                      <span className="block text-[11px] font-bold text-slate-500">{col(k)?.header ?? (k === "type" ? "Tip" : String(k))}</span>
                      {field(k)}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {simulationMode === "current" && canDeleteVsmProcess(currentUser, vsmProcesses.find(x => x.id === p.id)) && (
              <button onClick={() => { handleDeleteProcess(p.id); setOpenId(null); }} className="w-full flex items-center justify-center gap-2 text-red-600 border border-red-200 rounded-xl py-2.5 text-sm font-bold">
                <Trash2 className="w-4 h-4" /> Prosesi sil
              </button>
            )}
            <button onClick={() => setOpenId(null)} className="w-full bg-slate-950 text-white rounded-xl py-3 text-sm font-bold">Tamam</button>
          </div>
        </div>
      )}
    </div>
  );
}
