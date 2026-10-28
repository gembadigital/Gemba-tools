// Breakdown of a project's realized annual gain over the 17 gain lines (plan step C6). Saving with a
// non-zero total sets the realized gain (customer currency) to that total; an earlier consultant
// confirmation is then voided by the server if the amount changed.
import React, { useState } from "react";
import { X, Save } from "lucide-react";
import type { KaizenCard } from "../../types";
import { GAIN_LINES, breakdownTotal } from "./ciFinance";
import { defaultFinancialsInput } from "./ciTypes";
import { Button, AmountInput, formatAmount } from "./ciUi";

interface Props {
  project: KaizenCard;
  currencySymbol: string;
  currencyValue: string;   // stored label of the customer currency ("TL", "USD", …)
  canEdit: boolean;
  onSave: (changes: Partial<KaizenCard> & { id: string }) => Promise<unknown>;
  onClose: () => void;
}

export default function CiGainBreakdown({ project, currencySymbol, currencyValue, canEdit, onSave, onClose }: Props) {
  const [fi, setFi] = useState<any>(() => ({ ...defaultFinancialsInput(), ...(project.financialsInput || {}) }));
  const [busy, setBusy] = useState(false);
  const total = breakdownTotal(fi);
  const groups = Array.from(new Set(GAIN_LINES.map(l => l.group)));
  const currentRealized = project.realizedGain ?? project.actualSavings ?? 0;
  const setLine = (key: string, patch: { pct?: number; val?: number }) =>
    setFi((prev: any) => ({ ...prev, [key]: { pct: prev[key]?.pct || 0, val: prev[key]?.val || 0, ...patch } }));

  const save = async () => {
    setBusy(true);
    const changes: any = { id: project.id, financialsInput: fi };
    // A breakdown total replaces the realized gain; an empty breakdown leaves it as entered.
    if (total > 0) Object.assign(changes, { realizedGain: total, actualSavings: total, realizedGainCurrency: currencyValue });
    await onSave(changes);
    setBusy(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-label="Kazanç kırılımı">
      <div className="bg-white w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Gerçekleşen kazanç kırılımı</h3>
            <p className="text-sm text-slate-500">{project.title} · yıllık tutarlar, {currencySymbol}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Kapat"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-5">
          {groups.map(g => (
            <div key={g}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{g}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {GAIN_LINES.filter(l => l.group === g).map(l => (
                  <div key={l.key} className="rounded-xl ring-1 ring-slate-200 p-3 grid grid-cols-[minmax(0,1fr)_88px] gap-2 items-center">
                    <span className="col-span-2 text-sm font-semibold text-slate-800">{l.label}</span>
                    <AmountInput value={fi[l.key]?.val || null} onChange={(v) => setLine(l.key, { val: v ?? 0 })} suffix={currencySymbol} disabled={!canEdit} />
                    <AmountInput value={fi[l.key]?.pct || null} onChange={(v) => setLine(l.key, { pct: v ?? 0 })} suffix="%" placeholder="" disabled={!canEdit} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-slate-500">Toplam: </span>
            <span className="text-lg font-black text-slate-900 tabular-nums">{currencySymbol}{formatAmount(total)}</span>
            <p className="text-xs text-slate-500">
              {total > 0
                ? `Kaydedince gerçekleşen kazanç ${currencySymbol}${formatAmount(total)} olur${currentRealized && currentRealized !== total ? ` (şu an ${formatAmount(currentRealized)})` : ""}; değişirse danışman teyidi yenilenmelidir.`
                : "Kırılım boşsa gerçekleşen kazanç değişmez."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Vazgeç</Button>
            {canEdit && <Button variant="brand" onClick={save} disabled={busy}><Save className="w-4 h-4" /> Kaydet</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
