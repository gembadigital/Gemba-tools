import React, { useState } from "react";
import { History, PencilLine, X, Loader2 } from "lucide-react";
import type { KaizenApi } from "./KaizenSuggestionSystem";
import type { KaizenSuggestion, KaizenEvaluation, KaizenSavingSnapshot } from "./kaizenTypes";
import { expectedSaving } from "./kaizenCalc";
import { Button, inputCls, areaCls } from "./kaizenUi";
import { KaizenSettings, currencyChoices } from "../../utils/kaizenSettings";
import { isPerPiece, perPieceSaving } from "../../utils/kaizenSaving";

// Beklenen kazanç revizyonu (Faz 5.1). Shows the current expected saving with its revision history
// and, for the Kurul (or the approving manager while it waits for them), a form to revise it with a
// mandatory reason. The server keeps the history; reports use the latest figure (expectedSaving).

const money = (n: number, c: string) => `${(n || 0).toLocaleString("tr-TR")} ${c || ""}`.trim();
const snapText = (x: KaizenSavingSnapshot) =>
  x.unitSaving && x.annualVolume
    ? `${money(x.estimatedSaving, x.estimatedSavingCurrency)}/yıl (${money(x.unitSaving, x.estimatedSavingCurrency)} × ${x.annualVolume.toLocaleString("tr-TR")} adet)`
    : money(x.estimatedSaving, x.estimatedSavingCurrency);

export default function KaizenSavingRevision({ s, evaluation, settings, api, canRevise, onSaved, showToast }: {
  s: KaizenSuggestion; evaluation?: KaizenEvaluation | null; settings: KaizenSettings; api: KaizenApi;
  canRevise: boolean; onSaved: () => void; showToast: (m: string) => void;
}) {
  const perPiece = isPerPiece(s.paybackPeriod);
  const current = expectedSaving(s, evaluation);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(current.amount || ""));
  const [currency, setCurrency] = useState(current.currency || settings.baseCurrency);
  const [unit, setUnit] = useState(String(s.unitSaving || ""));
  const [volume, setVolume] = useState(String(s.annualVolume || ""));
  const [years, setYears] = useState(String(s.productionYears || ""));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const revisions = [...(s.savingRevisions || [])].reverse();
  const calc = perPiece ? perPieceSaving({ unitSaving: Number(unit), annualVolume: Number(volume), productionYears: Number(years) }) : null;

  const submit = async () => {
    setBusy(true);
    const body = perPiece
      ? { unitSaving: unit, annualVolume: volume, productionYears: years, estimatedSavingCurrency: currency, reason }
      : { estimatedSaving: amount, estimatedSavingCurrency: currency, reason };
    const res = await api.post(`suggestions/${s.id}/saving-revision`, body);
    setBusy(false);
    if (!res?.success) { showToast(res?.error || "Revizyon kaydedilemedi."); return; }
    showToast("Beklenen kazanç revize edildi.");
    setOpen(false); setReason("");
    onSaved();
  };

  if (!canRevise && !revisions.length) return null;
  return (
    <div className="rounded-xl ring-1 ring-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <History className="w-4 h-4 text-slate-400" />Beklenen kazanç
          <span className="font-bold text-slate-900 tabular-nums ml-1">{money(current.amount, current.currency)}</span>
          {current.source === "revised" && <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">revize edildi</span>}
          {current.source === "board" && <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Kurul onaylı</span>}
        </p>
        {canRevise && !open && <Button variant="outline" onClick={() => setOpen(true)}><PencilLine className="w-4 h-4" />Revize et</Button>}
      </div>

      {open && (
        <div className="rounded-xl bg-slate-50 p-3.5 space-y-3">
          {perPiece ? (
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs font-semibold text-slate-600">Parça başı<input type="number" min={0} step="any" value={unit} onChange={e => setUnit(e.target.value)} className={`${inputCls} mt-1`} /></label>
              <label className="text-xs font-semibold text-slate-600">Yıllık adet<input type="number" min={0} step={1} value={volume} onChange={e => setVolume(e.target.value)} className={`${inputCls} mt-1`} /></label>
              <label className="text-xs font-semibold text-slate-600">Yıl<input type="number" min={0} step="any" value={years} onChange={e => setYears(e.target.value)} className={`${inputCls} mt-1`} /></label>
            </div>
          ) : (
            <label className="block text-xs font-semibold text-slate-600">Yeni beklenen kazanç
              <input type="number" min={0} step="any" value={amount} onChange={e => setAmount(e.target.value)} className={`${inputCls} mt-1`} />
            </label>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-600">Para birimi
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={`${inputCls} mt-1`}>
                {currencyChoices(settings, currency).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {calc && <p className="text-xs text-emerald-800 pb-2.5 tabular-nums">Yıllık {money(calc.annual, currency)} · toplam {money(calc.lifetime, currency)}</p>}
          </div>
          <label className="block text-xs font-semibold text-slate-600">Gerekçe *
            <textarea value={reason} onChange={e => setReason(e.target.value.slice(0, 500))} rows={2} placeholder="Örn. Ölçüm sonrası çevrim kazancı yeniden hesaplandı" className={`${areaCls} mt-1`} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}><X className="w-4 h-4" />Vazgeç</Button>
            <Button variant="brand" onClick={submit} disabled={busy || !reason.trim()}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Kaydet</Button>
          </div>
        </div>
      )}

      {revisions.length > 0 && (
        <ol className="space-y-2">
          {revisions.map(r => (
            <li key={r.at} className="text-xs text-slate-600 border-l-2 border-amber-300 pl-3">
              <p><span className="font-semibold text-slate-800">{r.byName}</span> · {new Date(r.at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}</p>
              <p className="tabular-nums"><span className="line-through text-slate-400">{snapText(r.from)}</span> → <b className="text-slate-900">{snapText(r.to)}</b></p>
              <p className="italic">"{r.reason}"</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
