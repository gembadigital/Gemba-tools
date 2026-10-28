import React, { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import type { KaizenApi } from "./KaizenSuggestionSystem";
import type { ApprovalStatus } from "./kaizenTypes";
import { statusLabel } from "./kaizenCalc";

// Benzer öneriler (Faz 6.1): earlier suggestions of this customer that look like the one being
// written / decided, with their status and outcome. The server decides how much is shown about each
// (names and ids only for suggestions the viewer may see).

export interface SimilarQuery { subject: string; currentState?: string; improvementSuggestion?: string; department?: string; suggestionTypes?: string[] }
interface Hit {
  score: number; subject: string; department: string; createdAt: string; approvalStatus: ApprovalStatus;
  requiredStages?: ("Manager" | "Board")[]; feasibilityOpen: boolean; completed: boolean; id?: string; personnelName?: string;
}

const enough = (q: SimilarQuery) => `${q.subject} ${q.currentState || ""} ${q.improvementSuggestion || ""}`.trim().length >= 12;

export default function KaizenSimilar({ api, query, excludeId, hint }: { api: KaizenApi; query: SimilarQuery; excludeId?: string; hint?: string }) {
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify(query);

  useEffect(() => {
    if (!enough(query)) { setHits(null); return; }
    let alive = true;
    // Debounced: the wizard calls this while the person types.
    const t = setTimeout(async () => {
      setBusy(true);
      const res = await api.post("suggestions/similar", { ...query, excludeId });
      if (!alive) return;
      setBusy(false);
      setHits(res?.success ? res.data : []);
    }, 700);
    return () => { alive = false; clearTimeout(t); };
  }, [key, excludeId]);

  if (!hits?.length) return busy ? <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Benzer öneriler aranıyor…</p> : null;
  return (
    <section aria-label="Benzer öneriler" className="rounded-xl bg-sky-50/70 ring-1 ring-sky-200/70 p-3.5">
      <p className="text-sm font-semibold text-sky-900 flex items-center gap-1.5"><Copy className="w-4 h-4" />Benzer {hits.length} öneri var</p>
      {hint && <p className="text-xs text-sky-800/80 mt-0.5">{hint}</p>}
      <ul className="mt-2.5 space-y-2">
        {hits.map((h, i) => (
          <li key={h.id || i} className="flex items-start gap-3 text-sm">
            <span className="shrink-0 mt-0.5 text-[11px] font-bold text-sky-800 bg-white ring-1 ring-sky-200 rounded-full px-2 py-0.5 tabular-nums" title="Metin benzerliği">%{Math.round(h.score * 100)}</span>
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">{h.subject}</span>
              <span className="block text-xs text-slate-600">
                {[h.personnelName, h.department, h.createdAt ? new Date(h.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : ""].filter(Boolean).join(" · ")}
                {" · "}<b className={h.completed ? "text-emerald-700" : "text-slate-800"}>{h.completed ? "Uygulandı" : statusLabel(h.approvalStatus, h.requiredStages, h.feasibilityOpen)}</b>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
