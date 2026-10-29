// VSM — Gelecek Durum (plan step V5): the future map as its own copy (merge adjacent steps into continuous
// flow, add / remove steps, change stock type), the future values of stocks / schedule point / pack size,
// the eight design questions, and the kaizen bursts of both maps.
import React, { useMemo, useState } from "react";
import { GitMerge, Plus, Trash2, Map as MapIcon, RotateCcw, Zap, Pencil } from "lucide-react";
import { useVsm } from "./VsmContext";
import { VSM_DESIGN_QUESTIONS } from "./vsmFuture";
import { VSM_BURST_METRICS, VSM_BURST_STATUSES, VSM_INVENTORY_TYPES, VSM_LOOPS, VsmKaizenBurst } from "./vsmTypes";
import { canDeleteVsmBurst } from "../../utils/vsmAccess";

const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800";
const card = "bg-white border border-slate-200 rounded-2xl p-4 md:p-5 space-y-3";
const h3 = "text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider";
const newId = () => `kb_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const emptyBurst = (): VsmKaizenBurst => ({ id: newId(), title: "", map: "future", status: "Açık" });

export default function VsmFutureTab() {
  const {
    futureProcesses, futureProcessesCalculated, vsmProcesses, futureSetup, futureFullSetup, handleCreateFuture, handleResetFuture,
    handleMergeFutureProcesses, handleSetFutureSetup, handleUpdateFutureProcessField, handleAddFutureProcess, handleDeleteFutureProcess,
    simulationMode, setSimulationMode, setActiveTab, designAnswers, setDesignAnswers, kaizenBursts, handleSaveBurst,
    handleDeleteBurst, currentUser, taktTime, pitchTime, dashboardData, simulationComparison
  } = useVsm();
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<VsmKaizenBurst | null>(null);
  const hasFuture = futureProcesses !== null;
  const inFuture = simulationMode === "future";

  const showOnMap = () => { setSimulationMode("future"); setActiveTab("vsm"); };

  const hints: Record<string, string> = useMemo(() => ({
    takt: taktTime > 0 ? `Hesaplanan takt: ${taktTime} sn` : "Takt için Kurulum'da talep ve vardiya girin.",
    pacemaker: futureFullSetup.scheduleMode === "pacemaker" && futureFullSetup.pacemakerProcessId
      ? `Seçili pacemaker: ${futureProcessesCalculated.find(p => p.id === futureFullSetup.pacemakerProcessId)?.name ?? "—"}`
      : "Aşağıdaki 'Gelecek durum değerleri'nden seçin.",
    pitch: pitchTime > 0 ? `Pitch: ${Math.round(pitchTime / 6) / 10} dk (takt × paket)` : "Paket miktarı girilince hesaplanır.",
    improvements: `${kaizenBursts.filter(b => b.map === "future").length} kaizen patlaması tanımlı.`
  }), [taktTime, pitchTime, futureFullSetup, futureProcessesCalculated, kaizenBursts]);

  const procName = (map: "current" | "future", id?: string) =>
    (map === "future" ? futureProcessesCalculated : vsmProcesses).find(p => p.id === id)?.name ?? "—";

  if (!hasFuture) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className={`${card} text-center py-10`}>
          <MapIcon className="w-8 h-8 text-indigo-600 mx-auto" />
          <h2 className="text-base font-extrabold text-slate-900">Gelecek durum haritası henüz yok</h2>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            Gelecek durum, mevcut durumun ayrı bir kopyası olarak başlar. Kopyada adımları birleştirebilir (sürekli akış),
            ekleyip çıkarabilir, stok tiplerini çekme sistemine çevirebilir ve kaizen patlamalarını yerleştirebilirsiniz.
            Mevcut durum verisi değişmez.
          </p>
          <button onClick={handleCreateFuture} className="bg-slate-950 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer">
            Gelecek durum haritası oluştur
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Gelecek Durum Tasarımı</h2>
          <p className="text-xs text-slate-500">
            {futureProcessesCalculated.length} adım (mevcut: {vsmProcesses.length}) · lead time {dashboardData.currentLeadTime} → {dashboardData.futureLeadTime} gün
            {simulationComparison.hasEdits && simulationComparison.leadTimeReduction > 0 ? ` (−%${simulationComparison.leadTimeReduction})` : ""} · simülasyondur.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={showOnMap} className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"><MapIcon className="w-4 h-4" /> Haritada göster</button>
          <button onClick={handleResetFuture} className="flex items-center gap-1.5 border border-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"><RotateCcw className="w-4 h-4" /> Mevcuttan yeniden başlat</button>
        </div>
      </div>

      {/* FUTURE PROCESSES */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={h3}>Gelecek Durum Adımları</h3>
          <div className="flex flex-wrap gap-2">
            <button disabled={selected.length < 2} onClick={() => { handleMergeFutureProcesses(selected); setSelected([]); }}
              className="flex items-center gap-1.5 bg-emerald-600 disabled:bg-slate-300 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer">
              <GitMerge className="w-4 h-4" /> Seçilenleri birleştir (sürekli akış)
            </button>
            <button onClick={handleAddFutureProcess} className="flex items-center gap-1.5 bg-slate-950 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer">
              <Plus className="w-4 h-4" /> Adım ekle
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Art arda gelen adımları seçip birleştirin: iş içerikleri ve kadro toplanır, aralarındaki stok kalkar. Ardından C/T ve operatörü dengeleyin.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[760px]">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="p-2 w-8" /><th className="p-2 text-left">Adım</th><th className="p-2">C/T (sn)</th><th className="p-2">Operatör</th>
                <th className="p-2">Makine</th><th className="p-2">Önündeki stok</th><th className="p-2">Stok tipi</th><th className="p-2">Kanban</th><th className="p-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {futureProcessesCalculated.map(p => (
                <tr key={p.id} className={selected.includes(p.id) ? "bg-emerald-50/60" : ""}>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={selected.includes(p.id)} className="w-4 h-4 cursor-pointer"
                      onChange={() => setSelected(s => (s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id]))} />
                  </td>
                  <td className="p-2">
                    <input value={p.name} onChange={e => { handleUpdateFutureProcessField(p.id, "name", e.target.value); }} className={`${inputCls} min-w-[160px]`} />
                    {!!p.mergedFrom && p.mergedFrom.length > 1 && <div className="text-[10px] text-emerald-700 mt-0.5">birleşik: {p.mergedFrom.map(id => procName("current", id)).join(" + ")}</div>}
                  </td>
                  {(["cycleTime", "operatorCount", "machineCount", "inventoryBefore"] as const).map(k => (
                    <td key={k} className="p-2 text-center">
                      <input type="number" min={0} value={p[k] ?? 0} className={`${inputCls} w-20 text-center font-mono`}
                        onChange={e => { handleUpdateFutureProcessField(p.id, k, Math.max(0, Number(e.target.value) || 0)); }} />
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    <select value={p.inventoryType ?? (p.isSupermarket ? "supermarket" : "pile")} className={`${inputCls} w-36`}
                      onChange={e => { handleUpdateFutureProcessField(p.id, "inventoryType", e.target.value); handleUpdateFutureProcessField(p.id, "isSupermarket", e.target.value === "supermarket"); }}>
                      {VSM_INVENTORY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={!!p.isKanbanEnabled} className="w-4 h-4 cursor-pointer"
                      onChange={e => { handleUpdateFutureProcessField(p.id, "isKanbanEnabled", e.target.checked); }} />
                  </td>
                  <td className="p-2 text-center">
                    <button onClick={() => { if (window.confirm(`"${p.name}" gelecek durumdan çıkarılsın mı?`)) { handleDeleteFutureProcess(p.id); } }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer" title="Gelecek durumdan çıkar"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FUTURE SETUP VALUES */}
      <div className={card}>
        <h3 className={h3}>Gelecek Durum Değerleri</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Hammadde stoku (adet)</span>
            <input type="number" min={0} value={futureSetup.rawMaterialQty ?? ""} placeholder={String(futureFullSetup.rawMaterialQty ?? "")} className={inputCls}
              onChange={e => handleSetFutureSetup({ rawMaterialQty: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })} /></label>
          <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Mamul stoku (adet)</span>
            <input type="number" min={0} value={futureSetup.finishedGoodsQty ?? ""} placeholder={String(futureFullSetup.finishedGoodsQty ?? "")} className={inputCls}
              onChange={e => handleSetFutureSetup({ finishedGoodsQty: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })} /></label>
          <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Mamul stok tipi</span>
            <select value={futureFullSetup.finishedGoodsType ?? ""} className={inputCls} onChange={e => handleSetFutureSetup({ finishedGoodsType: (e.target.value || undefined) as any })}>
              <option value="">—</option>{VSM_INVENTORY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select></label>
          <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Paket miktarı (pitch için)</span>
            <input type="number" min={0} value={futureSetup.packSize ?? ""} placeholder={String(futureFullSetup.packSize ?? "")} className={inputCls}
              onChange={e => handleSetFutureSetup({ packSize: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })} /></label>
          <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Çizelge</span>
            <select value={futureFullSetup.scheduleMode ?? "each"} className={inputCls} onChange={e => handleSetFutureSetup({ scheduleMode: e.target.value as any })}>
              <option value="each">Her prosese (push)</option><option value="pacemaker">Tek noktaya — pacemaker</option>
            </select></label>
          {futureFullSetup.scheduleMode === "pacemaker" && (
            <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Pacemaker adım</span>
              <select value={futureFullSetup.pacemakerProcessId ?? ""} className={inputCls} onChange={e => handleSetFutureSetup({ pacemakerProcessId: e.target.value || undefined })}>
                <option value="">— seçiniz —</option>{futureProcessesCalculated.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></label>
          )}
        </div>
        <p className="text-[11px] text-slate-500">Boş bırakılan değer mevcut durumdaki değeri kullanır.</p>
      </div>

      {/* DESIGN QUESTIONS */}
      <div className={card}>
        <h3 className={h3}>Gelecek Durum Tasarım Soruları</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {VSM_DESIGN_QUESTIONS.map(q => (
            <label key={q.key} className="space-y-1">
              <span className="text-xs font-bold text-slate-800">{q.question}</span>
              {hints[q.key] && <span className="block text-[10px] text-indigo-700">{hints[q.key]}</span>}
              <textarea rows={2} value={designAnswers[q.key] ?? ""} className={inputCls}
                onChange={e => setDesignAnswers({ ...designAnswers, [q.key]: e.target.value })} />
            </label>
          ))}
        </div>
      </div>

      {/* KAIZEN BURSTS */}
      <div className={card}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={`${h3} flex items-center gap-2`}><Zap className="w-4 h-4 text-red-600" /> Kaizen Patlamaları</h3>
          <button onClick={() => setEditing(emptyBurst())} className="flex items-center gap-1 text-xs font-bold text-indigo-700 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Ekle</button>
        </div>
        {kaizenBursts.length === 0 && !editing && <p className="text-[11px] text-slate-500">Henüz kaizen patlaması yok. Gelecek duruma ulaşmak için gereken her iyileştirmeyi ilgili adıma ekleyin.</p>}
        <div className="space-y-2">
          {kaizenBursts.map((b, i) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-xs">
              <span className="font-black text-red-700">K{i + 1}</span>
              <span className="font-bold text-slate-900 flex-1 min-w-[160px]">{b.title}</span>
              <span className="text-slate-500">{b.map === "future" ? "Gelecek" : "Mevcut"} · {procName(b.map, b.processId)}</span>
              {b.target && <span className="text-indigo-700">{b.target}</span>}
              {b.owner && <span className="text-slate-600">{b.owner}</span>}
              {b.dueDate && <span className="font-mono text-slate-500">{b.dueDate}</span>}
              <span className={`px-2 py-0.5 rounded-full font-bold ${b.status === "Tamamlandı" ? "bg-emerald-100 text-emerald-800" : b.status === "Devam ediyor" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{b.status ?? "Açık"}</span>
              <button onClick={() => setEditing(b)} className="p-1 text-slate-500 cursor-pointer" title="Düzenle"><Pencil className="w-3.5 h-3.5" /></button>
              {canDeleteVsmBurst(currentUser, b) && <button onClick={() => handleDeleteBurst(b.id)} className="p-1 text-red-500 cursor-pointer" title="Sil"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
        </div>

        {editing && (
          <div className="border-2 border-indigo-200 rounded-2xl p-3 space-y-3 bg-indigo-50/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="space-y-1 sm:col-span-2 lg:col-span-1"><span className="text-[11px] font-bold text-slate-500">Başlık *</span>
                <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className={inputCls} placeholder="ör. Pres SMED" /></label>
              <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Harita</span>
                <select value={editing.map} onChange={e => setEditing({ ...editing, map: e.target.value as any, processId: undefined })} className={inputCls}>
                  <option value="future">Gelecek durum</option><option value="current">Mevcut durum</option>
                </select></label>
              <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Adım</span>
                <select value={editing.processId ?? ""} onChange={e => setEditing({ ...editing, processId: e.target.value || undefined })} className={inputCls}>
                  <option value="">— seçiniz —</option>
                  {(editing.map === "future" ? futureProcessesCalculated : vsmProcesses).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
              <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Etki alanı</span>
                <select value={editing.metric ?? ""} onChange={e => setEditing({ ...editing, metric: e.target.value || undefined })} className={inputCls}>
                  <option value="">—</option>{VSM_BURST_METRICS.map(m => <option key={m} value={m}>{m}</option>)}
                </select></label>
              <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Hedef</span>
                <input value={editing.target ?? ""} onChange={e => setEditing({ ...editing, target: e.target.value || undefined })} className={inputCls} placeholder="ör. C/O 45 → 15 dk" /></label>
              <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Döngü</span>
                <select value={editing.loop ?? ""} onChange={e => setEditing({ ...editing, loop: e.target.value || undefined })} className={inputCls}>
                  <option value="">—</option>{VSM_LOOPS.map(m => <option key={m} value={m}>{m}</option>)}
                </select></label>
              <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Sorumlu</span>
                <input value={editing.owner ?? ""} onChange={e => setEditing({ ...editing, owner: e.target.value || undefined })} className={inputCls} /></label>
              <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Termin</span>
                <input type="date" value={editing.dueDate ?? ""} onChange={e => setEditing({ ...editing, dueDate: e.target.value || undefined })} className={inputCls} /></label>
              <label className="space-y-1"><span className="text-[11px] font-bold text-slate-500">Durum</span>
                <select value={editing.status ?? "Açık"} onChange={e => setEditing({ ...editing, status: e.target.value as any })} className={inputCls}>
                  {VSM_BURST_STATUSES.map(m => <option key={m} value={m}>{m}</option>)}
                </select></label>
              <label className="space-y-1 sm:col-span-2 lg:col-span-3"><span className="text-[11px] font-bold text-slate-500">Açıklama</span>
                <textarea rows={2} value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value || undefined })} className={inputCls} /></label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 cursor-pointer">Vazgeç</button>
              <button disabled={!editing.title.trim()} onClick={() => { handleSaveBurst({ ...editing, title: editing.title.trim() }); setEditing(null); }}
                className="text-xs font-bold px-3 py-2 rounded-xl bg-slate-950 disabled:bg-slate-300 text-white cursor-pointer">Tamam</button>
            </div>
          </div>
        )}
        <p className="text-[11px] text-slate-500">Değişikliklerin kalıcı olması için Kaydet'e basın.</p>
      </div>
    </div>
  );
}
