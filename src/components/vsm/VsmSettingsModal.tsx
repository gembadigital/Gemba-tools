// VSM customer settings dialog (plan step V10) — Admin / Consultant only (server-enforced).
import React, { useState } from "react";
import { Settings, X } from "lucide-react";
import { useVsm } from "./VsmContext";
import type { VsmSettings } from "../../utils/vsmSettings";

const FIELDS: { key: keyof VsmSettings; label: string; hint: string }[] = [
  { key: "defaultWorkingDays", label: "Haftalık çalışma günü", hint: "Yeni projelerin varsayılanı." },
  { key: "defaultShiftsPerDay", label: "Günlük vardiya sayısı", hint: "0 = yeni projede boş bırak." },
  { key: "defaultShiftHours", label: "Vardiya süresi (saat)", hint: "Yeni projelerin varsayılanı." },
  { key: "defaultBreakMinutes", label: "Mola (dk / vardiya)", hint: "Yeni projelerin varsayılanı." },
  { key: "defaultMaintenanceMinutes", label: "Planlı bakım (dk / vardiya)", hint: "Yeni projelerin varsayılanı." },
  { key: "weeksPerYear", label: "Yılda çalışılan hafta", hint: "Yıllık kayıp = günlük kayıp × çalışma günü × bu sayı (yeni projeler)." },
  { key: "oeeTarget", label: "OEE hedefi (%)", hint: "Altındaki prosesler haritada turuncu. 0 = en düşük OEE vurgulanır." },
  { key: "wipDaysWarning", label: "Stok günü uyarısı", hint: "Üstündeki stok bölgeleri haritada kırmızı. 0 = kapalı." }
];

export default function VsmSettingsModal({ onClose }: { onClose: () => void }) {
  const { vsmSettings, handleSaveSettings } = useVsm();
  const [form, setForm] = useState<VsmSettings>(vsmSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    const err = await handleSaveSettings(form);
    setBusy(false);
    if (err) setError(err); else onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-950 text-white px-4 py-3 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider font-mono flex items-center gap-2"><Settings className="w-4 h-4" /> VSM Ayarları (bu müşteri)</h3>
          <button onClick={onClose} className="p-1 text-slate-300 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {FIELDS.map(f => (
            <label key={f.key} className="space-y-1">
              <span className="block font-bold text-slate-700">{f.label}</span>
              <input type="number" min={0} value={form[f.key] as number}
                onChange={e => setForm({ ...form, [f.key]: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold" />
              <span className="block text-[10px] text-slate-500">{f.hint}</span>
            </label>
          ))}
        </div>
        {error && <div className="mx-5 mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400">{vsmSettings.updatedAt ? `Son değişiklik: ${new Date(vsmSettings.updatedAt).toLocaleString("tr-TR")}${vsmSettings.updatedBy ? ` · ${vsmSettings.updatedBy}` : ""}` : ""}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer">Vazgeç</button>
            <button onClick={save} disabled={busy} className="px-3 py-2 rounded-xl bg-slate-950 disabled:bg-slate-300 text-white text-xs font-bold cursor-pointer">{busy ? "Kaydediliyor…" : "Kaydet"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
