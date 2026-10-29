// VSM — "Kaynaktan al" (plan step V9): measured values from Yamazumi, SMED and Time Study, matched to
// the VSM processes (stored link or name), applied only to the rows and fields the user ticks. Writes to
// the map shown (current or future), like every other process edit; the value's origin is noted.
import React, { useEffect, useMemo, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { useVsm } from "./VsmContext";
import { SOURCE_LABELS, smedCandidates, timeStudyCandidates, VsmSourceCandidate, VsmSourceKind, yamazumiCandidates } from "./vsmSources";

type Field = "cycleTime" | "valueAddedTime" | "changeoverTime";
const FIELD_LABEL: Record<Field, string> = { cycleTime: "C/T (sn)", valueAddedTime: "Katma değer (sn)", changeoverTime: "C/O (dk)" };

export default function VsmSourcesModal({ onClose }: { onClose: () => void }) {
  const { activeProcesses, handleUpdateProcessField, token, selectedCustomerId, simulationMode } = useVsm();
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState<{ yamazumi: any[]; smed: any[]; timeStudy: any[] }>({ yamazumi: [], smed: [], timeStudy: [] });
  const [kind, setKind] = useState<VsmSourceKind>("yamazumi");
  const [pick, setPick] = useState<Record<string, { target?: string; fields: Field[] }>>({});

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}`, "x-factory-id": selectedCustomerId || "" };
    const get = (u: string) => fetch(u, { headers }).then(r => r.json()).then(d => (d?.success ? d.data || [] : [])).catch(() => []);
    Promise.all([get("/api/business/yamazumi-studies"), get("/api/business/smed-projects"), get("/api/business/time-studies")])
      .then(([yamazumi, smed, timeStudy]) => setRaw({ yamazumi, smed, timeStudy }))
      .finally(() => setLoading(false));
  }, [token, selectedCustomerId]);

  const candidates = useMemo(() => ({
    yamazumi: yamazumiCandidates(raw.yamazumi, activeProcesses),
    smed: smedCandidates(raw.smed, activeProcesses),
    timeStudy: timeStudyCandidates(raw.timeStudy, activeProcesses)
  }), [raw, activeProcesses]);
  const list = candidates[kind];
  const fieldsOf = (c: VsmSourceCandidate): Field[] => (["cycleTime", "valueAddedTime", "changeoverTime"] as Field[]).filter(f => c[f] !== undefined);
  const stateOf = (c: VsmSourceCandidate) => pick[c.key] ?? { target: c.suggestedProcessId, fields: [] };
  const setState = (c: VsmSourceCandidate, patch: Partial<{ target?: string; fields: Field[] }>) => setPick(prev => ({ ...prev, [c.key]: { ...stateOf(c), ...patch } }));
  const chosen = Object.values(candidates).flat().filter(c => { const st = stateOf(c); return st.target && st.fields.length > 0; });

  const apply = () => {
    if (chosen.length === 0) return;
    const today = new Date().toLocaleDateString("tr-TR");
    chosen.forEach(c => {
      const st = stateOf(c);
      st.fields.forEach(f => handleUpdateProcessField(st.target!, f, c[f]));
      handleUpdateProcessField(st.target!, "measuredFrom", `${SOURCE_LABELS[c.kind]}: ${c.label} (${st.fields.map(f => FIELD_LABEL[f]).join(", ")}, ${today})`);
    });
    alert(`${chosen.length} kaynaktan değer ${simulationMode === "future" ? "gelecek" : "mevcut"} duruma yazıldı. Kalıcı olması için Kaydet'e basın.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="bg-slate-950 text-white px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-xs font-black uppercase tracking-wider font-mono flex items-center gap-2"><Download className="w-4 h-4" /> Kaynaktan Al</h3>
          <button onClick={onClose} className="p-1 text-slate-300 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto text-xs">
          <p className="text-slate-500">Diğer modüllerde ölçülen değerler. Hedef prosesi kontrol edin, almak istediğiniz değeri işaretleyin. Yazılan değerin kaynağı prosese not edilir.</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SOURCE_LABELS) as VsmSourceKind[]).map(k => (
              <button key={k} onClick={() => setKind(k)} className={`px-3 py-1.5 rounded-full font-bold border cursor-pointer ${kind === k ? "bg-slate-950 text-white border-slate-950" : "bg-white text-slate-600 border-slate-200"}`}>
                {SOURCE_LABELS[k]} · {candidates[k].length}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…</div>
          ) : list.length === 0 ? (
            <p className="text-slate-500 py-6 text-center">Bu müşteride {SOURCE_LABELS[kind]} kaydı yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[680px]">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="p-2 text-left">Kaynak</th><th className="p-2 text-left">Değerler (almak için işaretleyin)</th><th className="p-2 text-left">Hedef proses</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map(c => {
                    const st = stateOf(c);
                    return (
                      <tr key={c.key}>
                        <td className="p-2"><div className="font-bold text-slate-800">{c.label}</div>{c.date && <div className="text-[10px] text-slate-400">{c.date}</div>}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-3">
                            {fieldsOf(c).map(f => (
                              <label key={f} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={st.fields.includes(f)}
                                  onChange={e => setState(c, { fields: e.target.checked ? [...st.fields, f] : st.fields.filter(x => x !== f) })} />
                                <span>{FIELD_LABEL[f]}: <b className="font-mono">{c[f]}</b></span>
                              </label>
                            ))}
                          </div>
                        </td>
                        <td className="p-2">
                          <select value={st.target ?? ""} onChange={e => setState(c, { target: e.target.value || undefined })} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold w-full">
                            <option value="">— seçiniz —</option>
                            {activeProcesses.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer">Vazgeç</button>
          <button onClick={apply} disabled={chosen.length === 0} className="px-3 py-2 rounded-xl bg-slate-950 disabled:bg-slate-300 text-white text-xs font-bold cursor-pointer">
            {chosen.length} değeri uygula
          </button>
        </div>
      </div>
    </div>
  );
}
