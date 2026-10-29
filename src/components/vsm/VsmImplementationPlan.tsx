// VSM — future state implementation plan (plan step V6): the kaizen bursts grouped by loop with owner,
// start / due date, progress and status, a week bar per item, the CI project opened from it (CI
// opportunity pool, source "VSM kaizen"), and "Master Plan'a aktar" (one activity per burst).
import React, { useEffect, useMemo, useState } from "react";
import { CalendarRange, Send } from "lucide-react";
import { useVsm } from "./VsmContext";
import { VSM_BURST_STATUSES, VSM_LOOPS, VsmKaizenBurst } from "./vsmTypes";
import { burstPlanStatus, burstProgress, groupByLoop, vsmMasterPlanRow, vsmPlanRowId } from "./vsmPlan";

const cell = "bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800";
const STATUS_TONE: Record<string, string> = {
  Completed: "bg-emerald-500", Delayed: "bg-red-500", "In Progress": "bg-amber-500", Planned: "bg-slate-400"
};
const DAY = 86400000;

export default function VsmImplementationPlan() {
  const { kaizenBursts, handleSaveBurst, futureProcessesCalculated, vsmProcesses, selectedProject, selectedCustomerId, token } = useVsm();
  const [ciMap, setCiMap] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const groups = useMemo(() => groupByLoop(kaizenBursts, VSM_LOOPS), [kaizenBursts]);
  const stepName = (b: VsmKaizenBurst) => (b.map === "future" ? futureProcessesCalculated : vsmProcesses).find(p => p.id === b.processId)?.name ?? "—";
  const projectId = selectedProject?.id as string | undefined;

  // CI projects opened from these bursts (the pool marks converted items).
  useEffect(() => {
    if (!selectedCustomerId || !projectId) return;
    fetch("/api/business/ci/opportunities", { headers: { Authorization: `Bearer ${token}`, "x-factory-id": selectedCustomerId } })
      .then(r => r.json())
      .then(d => {
        const m: Record<string, string> = {};
        (d?.data?.items || []).forEach((o: any) => {
          const prefix = `opp_vsm_${projectId}_`;
          if (o.source === "vsm" && o.id.startsWith(prefix) && o.convertedProjectNo) m[o.id.slice(prefix.length)] = o.convertedProjectNo;
        });
        setCiMap(m);
      })
      .catch(() => {});
  }, [selectedCustomerId, projectId, token]);

  // Week bars: from the earliest start to the latest due date.
  const dated = kaizenBursts.filter(b => b.startDate || b.dueDate);
  const t0 = dated.length ? Math.min(...dated.map(b => new Date(b.startDate || b.dueDate!).getTime())) : 0;
  const t1 = dated.length ? Math.max(...dated.map(b => new Date(b.dueDate || b.startDate!).getTime())) : 0;
  const span = Math.max(DAY, t1 - t0);

  const sendToMasterPlan = async () => {
    if (!projectId) return;
    const items = kaizenBursts.filter(b => b.startDate || b.dueDate);
    if (items.length === 0) { alert("Master Plan'a aktarmak için en az bir maddeye başlangıç ya da termin tarihi girin."); return; }
    if (!window.confirm(`${items.length} madde Master Plan'a faaliyet olarak yazılacak (var olanlar güncellenir, Master Plan'da elle değiştirilen alanlar korunur). Devam edilsin mi?`)) return;
    setSending(true);
    try {
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-factory-id": selectedCustomerId || "" };
      const existing: any[] = (await fetch("/api/business/gantt", { headers }).then(r => r.json()).catch(() => null))?.data || [];
      let n = 0;
      for (const b of items) {
        const old = existing.find(a => a.id === vsmPlanRowId(projectId, b.id));
        const row = vsmMasterPlanRow(projectId, selectedProject.name, b, kaizenBursts.indexOf(b), old);
        const res = await fetch("/api/business/gantt", { method: "POST", headers, body: JSON.stringify(row) }).then(r => r.json());
        if (res?.success) n++;
      }
      window.dispatchEvent(new CustomEvent("gemba:refresh-factory-data"));
      alert(`${n} madde Master Plan'a aktarıldı.`);
    } finally {
      setSending(false);
    }
  };

  if (kaizenBursts.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-indigo-600" /> Uygulama Planı (döngülere göre)
        </h3>
        <button onClick={sendToMasterPlan} disabled={sending || !projectId}
          className="flex items-center gap-1.5 bg-slate-950 disabled:bg-slate-300 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer">
          <Send className="w-4 h-4" /> {sending ? "Aktarılıyor…" : "Master Plan'a aktar"}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Kaizen patlamaları planın maddeleridir. Tamamlanmamış maddeler CI Proje Yönetimi'nde yeni proje açılırken "VSM kaizen" kaynağıyla fırsat
        olarak görünür. Değişikliklerin kalıcı olması için Kaydet'e basın.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse min-w-[980px]">
          <thead className="bg-slate-50 text-slate-500 font-bold">
            <tr>
              <th className="p-2 text-left w-10">#</th><th className="p-2 text-left">Madde</th><th className="p-2 text-left">Adım</th><th className="p-2 text-left">Sorumlu</th>
              <th className="p-2">Başlangıç</th><th className="p-2">Termin</th><th className="p-2">İlerleme %</th><th className="p-2">Durum</th>
              <th className="p-2 text-left w-48">Zaman</th><th className="p-2">CI projesi</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <React.Fragment key={g.loop}>
                <tr><td colSpan={10} className="pt-3 pb-1 px-2 text-[10px] font-black uppercase tracking-wider text-indigo-700">{g.loop}</td></tr>
                {g.items.map(({ burst: b, no }) => {
                  const st = burstPlanStatus(b);
                  const s = b.startDate || b.dueDate, e = b.dueDate || b.startDate;
                  const left = s ? ((new Date(s).getTime() - t0) / span) * 100 : 0;
                  const width = s && e ? Math.max(2, ((new Date(e).getTime() - new Date(s).getTime()) / span) * 100) : 0;
                  return (
                    <tr key={b.id} className="border-t border-slate-100">
                      <td className="p-2 font-black text-red-700">K{no}</td>
                      <td className="p-2 font-bold text-slate-900">{b.title}{b.target && <div className="font-normal text-indigo-700">{b.target}</div>}</td>
                      <td className="p-2 text-slate-600">{stepName(b)}</td>
                      <td className="p-2"><input value={b.owner ?? ""} onChange={ev => handleSaveBurst({ ...b, owner: ev.target.value || undefined })} className={`${cell} w-32`} /></td>
                      <td className="p-2"><input type="date" value={b.startDate ?? ""} onChange={ev => handleSaveBurst({ ...b, startDate: ev.target.value || undefined })} className={cell} /></td>
                      <td className="p-2"><input type="date" value={b.dueDate ?? ""} onChange={ev => handleSaveBurst({ ...b, dueDate: ev.target.value || undefined })} className={cell} /></td>
                      <td className="p-2 text-center">
                        <input type="number" min={0} max={100} value={burstProgress(b)} disabled={b.status === "Tamamlandı"}
                          onChange={ev => handleSaveBurst({ ...b, progress: Math.max(0, Math.min(100, Number(ev.target.value) || 0)) })} className={`${cell} w-16 text-center`} />
                      </td>
                      <td className="p-2">
                        <select value={b.status ?? "Açık"} onChange={ev => handleSaveBurst({ ...b, status: ev.target.value as any })} className={cell}>
                          {VSM_BURST_STATUSES.map(x => <option key={x} value={x}>{x}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <div className="relative h-3 bg-slate-100 rounded">
                          {width > 0 && <div className={`absolute top-0 h-3 rounded ${STATUS_TONE[st]}`} style={{ left: `${left}%`, width: `${Math.min(100 - left, width)}%` }} title={st} />}
                        </div>
                      </td>
                      <td className="p-2 text-center font-mono">{ciMap[b.id] || "—"}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
