// VSM — AI analysis panel (plan step V12). Shows the analysis stored on the project and lets the user
// (re)generate it. The server builds it from the SAVED project, so unsaved edits are not included.
import React, { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { useVsm } from "./VsmContext";

export default function VsmAiAnalysisPanel() {
  const { selectedProject, setSelectedProject, setProjects, token, selectedCustomerId } = useVsm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = selectedProject?.aiAnalysis;

  const generate = async () => {
    if (!selectedProject?.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/vsm-projects/${selectedProject.id}/ai-analysis`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-factory-id": selectedCustomerId || "" }
      }).then(r => r.json());
      if (!res?.success) throw new Error(res?.error || "Analiz üretilemedi.");
      const updated = { ...selectedProject, aiAnalysis: res.data };
      setSelectedProject(updated);
      setProjects((prev: any[]) => prev.map(p => (p.id === updated.id ? { ...p, aiAnalysis: res.data } : p)));
    } catch (e: any) {
      setError(e?.message || "Analiz üretilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const section = "text-[10px] uppercase font-bold tracking-wider font-mono";
  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 md:p-7 shadow-xl border border-indigo-900/40 space-y-5" id="vsm_ai_analysis">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="bg-indigo-500/20 p-2 rounded-xl"><Sparkles className="w-5 h-5 text-indigo-300" /></div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider font-mono text-indigo-300">Yapay Zekâ VSM Analizi</h3>
            <p className="text-[11px] text-slate-400 max-w-xl">
              Kayıtlı projenin verileri (talep, takt, prosesler, stoklar, gelecek durum, kaizen patlamaları) ve müşterinin diğer modül özetleriyle
              üretilir; yalnızca bu verilerdeki sayıları kullanır. Kaydedilmemiş değişiklikler dahil değildir — önce Kaydet'e basın.
            </p>
          </div>
        </div>
        <button onClick={generate} disabled={busy || !selectedProject?.id}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : a ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          {busy ? "Analiz ediliyor…" : a ? "Analizi yenile" : "Analiz üret"}
        </button>
      </div>

      {error && <div className="bg-red-500/15 border border-red-400/30 text-red-200 text-xs rounded-xl px-3 py-2">{error}</div>}
      {!a && !busy && !error && <p className="text-xs text-slate-300">Henüz analiz yok.</p>}

      {a && (
        <div className="space-y-5 text-xs leading-relaxed">
          <p className="text-slate-100 text-sm">{a.summary}</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className={`${section} text-amber-400`}>Bulgular</div>
              {a.findings.map((f: any, i: number) => (
                <div key={i}><div className="font-bold text-white">{f.title}</div><div className="text-slate-300">{f.detail}</div></div>
              ))}
              {a.kaizenPriorities?.length > 0 && <div className={`${section} text-emerald-400 pt-2`}>Kaizen öncelikleri</div>}
              {a.kaizenPriorities?.map((k: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="font-black text-emerald-300 w-6 shrink-0">{i + 1}.</span>
                  <div><span className="font-bold text-white">{k.burst ? `${k.burst} · ` : ""}{k.title}</span><div className="text-slate-300">{k.why}</div></div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className={`${section} text-indigo-300`}>VSM yönlendirmesi</div>
              {a.flowGuidance.map((g: any, i: number) => (
                <div key={i} className="border-l-2 border-indigo-400/50 pl-3">
                  <div className="text-[10px] font-black uppercase text-indigo-300">{g.area}</div>
                  <div className="font-bold text-white">{g.recommendation}</div>
                  {g.why && <div className="text-slate-400">{g.why}</div>}
                </div>
              ))}
              {(a.questions?.length > 0 || a.dataGaps?.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {a.questions?.length > 0 && <div><div className={`${section} text-slate-400`}>Sahada doğrulanacak</div>{a.questions.map((q: string, i: number) => <div key={i} className="text-slate-300">• {q}</div>)}</div>}
                  {a.dataGaps?.length > 0 && <div><div className={`${section} text-slate-400`}>Eksik veri</div>{a.dataGaps.map((q: string, i: number) => <div key={i} className="text-slate-300">• {q}</div>)}</div>}
                </div>
              )}
            </div>
          </div>
          <div className="pt-3 border-t border-white/10 text-[10px] text-slate-400 font-mono flex flex-wrap justify-between gap-2">
            <span>{new Date(a.generatedAt).toLocaleString("tr-TR")}{a.by ? ` · ${a.by}` : ""}</span>
            <span>Yapay zekâ önerisidir; sahada doğrulayın.</span>
          </div>
        </div>
      )}
    </div>
  );
}
