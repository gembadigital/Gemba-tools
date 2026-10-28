// CI Ayarları — per-customer settings screen (plan step C1). Shown to Admin / Consultant only; the
// server enforces the same rule. Edits a local draft and saves it as a whole.
import React, { useEffect, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { CiSettings, CiProductFamily, CI_CURRENCIES, CI_CURRENCY_SYMBOLS, phaseNumber } from "../../utils/ciSettings";

interface CiSettingsPanelProps {
  settings: CiSettings;
  baseCurrencyCode: string; // the customer card's currency (TRY, USD, …)
  onSave: (next: CiSettings) => Promise<{ ok: boolean; error?: string }>;
}

const lines = (text: string) => text.split("\n").map(l => l.trim()).filter(Boolean);

export default function CiSettingsPanel({ settings, baseCurrencyCode, onSave }: CiSettingsPanelProps) {
  const [currencies, setCurrencies] = useState<string[]>(settings.currencies);
  const [fxRates, setFxRates] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState(settings.departments.join("\n"));
  const [phases, setPhases] = useState(settings.phases.join("\n"));
  const [families, setFamilies] = useState<{ name: string; sharePct: string }[]>([]);
  const [durationDays, setDurationDays] = useState(String(settings.defaultDurationDays));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset the draft whenever the saved settings change (customer switch, load, save).
  useEffect(() => {
    setCurrencies(settings.currencies);
    setFxRates(Object.fromEntries(Object.entries(settings.fxRates).map(([k, v]) => [k, String(v)])));
    setDepartments(settings.departments.join("\n"));
    setPhases(settings.phases.join("\n"));
    setFamilies(settings.productFamilies.map(f => ({ name: f.name, sharePct: String(f.sharePct) })));
    setDurationDays(String(settings.defaultDurationDays));
  }, [settings]);

  const baseSymbol = CI_CURRENCY_SYMBOLS[baseCurrencyCode] || baseCurrencyCode;
  const otherCurrencies = CI_CURRENCIES.filter(c => c !== baseCurrencyCode);
  const familyShareTotal = families.reduce((sum, f) => sum + (Number(f.sharePct) || 0), 0);
  const phaseNumbers = lines(phases).map(phaseNumber);
  const duplicatePhaseNumber = phaseNumbers.some((n, i) => phaseNumbers.indexOf(n) !== i);

  const toggleCurrency = (code: string) =>
    setCurrencies(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    const productFamilies: CiProductFamily[] = families
      .map(f => ({ name: f.name.trim(), sharePct: Math.round(Number(f.sharePct)) }))
      .filter(f => f.name);
    const result = await onSave({
      currencies,
      fxRates: Object.fromEntries(
        Object.entries(fxRates)
          .filter(([code]) => currencies.includes(code))
          .map(([code, v]) => [code, Number(String(v).replace(",", "."))])
      ),
      departments: lines(departments),
      phases: lines(phases),
      productFamilies,
      defaultDurationDays: Number(durationDays)
    });
    setSaving(false);
    setStatus(result.ok
      ? { ok: true, text: "Ayarlar kaydedildi. Geçersiz değerler (ör. 1–100 dışı hacim payı) kaydedilmeden atlandı." }
      : { ok: false, text: result.error || "Ayarlar kaydedilemedi." });
  };

  const box = "bg-white border border-slate-200 rounded-2xl p-5 space-y-3";
  const label = "block text-xs font-bold text-slate-700";
  const hint = "text-[11px] text-slate-500 leading-relaxed";
  const input = "w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">CI Ayarları</h3>
          <p className={hint}>
            Bu müşterinin CI proje ekranlarındaki listeler ve hesaplar. Yalnızca Admin ve Danışman değiştirebilir.
            {settings.updatedAt && ` Son değişiklik: ${new Date(settings.updatedAt).toLocaleString("tr-TR")}${settings.updatedBy ? ` — ${settings.updatedBy}` : ""}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>

      {status && (
        <div className={`text-xs rounded-lg px-3 py-2 ${status.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {status.text}
        </div>
      )}

      <div className={box}>
        <span className={label}>Para birimleri ve kurlar</span>
        <p className={hint}>
          Ana para birimi müşteri kartındaki para birimidir ({baseSymbol} {baseCurrencyCode}). Kazanç alanlarında ayrıca
          seçilebilecek para birimlerini işaretleyin. Kur girilen para birimindeki tutarlar toplamlara çevrilerek eklenir;
          kur girilmemişse toplama dahil edilmez ve ekranda belirtilir.
        </p>
        <div className="space-y-2">
          {otherCurrencies.map(code => (
            <div key={code} className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-2 w-28 cursor-pointer">
                <input type="checkbox" checked={currencies.includes(code)} onChange={() => toggleCurrency(code)} />
                <span className="font-bold">{CI_CURRENCY_SYMBOLS[code]} {code}</span>
              </label>
              {currencies.includes(code) && (
                <label className="flex items-center gap-2">
                  <span className="text-slate-500">1 {code} =</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fxRates[code] ?? ""}
                    onChange={(e) => setFxRates(prev => ({ ...prev, [code]: e.target.value }))}
                    placeholder="kur girilmedi"
                    className="w-28 text-xs border border-slate-200 rounded-lg px-2 py-1 font-mono"
                  />
                  <span className="text-slate-500">{baseSymbol}</span>
                </label>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={box}>
          <label className={label} htmlFor="ci-settings-departments">Departmanlar</label>
          <p className={hint}>Her satıra bir departman. Departman alanlarında öneri olarak çıkar; listede olmayan bir değer de yazılabilir.</p>
          <textarea id="ci-settings-departments" rows={8} value={departments} onChange={(e) => setDepartments(e.target.value)} className={input} />
        </div>

        <div className={box}>
          <label className={label} htmlFor="ci-settings-phases">Proje fazları</label>
          <p className={hint}>
            Her satıra bir faz; ilki yeni projelerin varsayılanıdır. Filtre ve grafikler fazı adın başındaki "Faz 1", "Faz 2"…
            numarasıyla gruplar.
          </p>
          <textarea id="ci-settings-phases" rows={5} value={phases} onChange={(e) => setPhases(e.target.value)} className={input} />
          {duplicatePhaseNumber && (
            <p className="text-[11px] text-amber-700">İki faz aynı numarayla başlıyor; filtre ve grafiklerde birlikte sayılırlar.</p>
          )}
          <label className={label} htmlFor="ci-settings-duration">Varsayılan proje süresi (gün)</label>
          <input id="ci-settings-duration" type="number" min={1} max={1095} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className={`${input} w-32`} />
          <p className={hint}>Yeni projenin termini, başka tarih seçilmezse bugünden bu kadar gün sonrasıdır.</p>
        </div>
      </div>

      <div className={box}>
        <span className={label}>Ürün aileleri</span>
        <p className={hint}>
          Yeni proje sihirbazında fırsatların kayıp tutarı seçilen ailenin hacim payıyla ölçeklenir. Liste boşsa yalnızca
          "Tüm fabrika" seçilebilir.
        </p>
        {families.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={f.name}
              placeholder="Ürün ailesi adı"
              onChange={(e) => setFamilies(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
              className={`${input} flex-1`}
            />
            <span className="text-xs text-slate-500">%</span>
            <input
              type="number"
              min={1}
              max={100}
              value={f.sharePct}
              onChange={(e) => setFamilies(prev => prev.map((x, j) => j === i ? { ...x, sharePct: e.target.value } : x))}
              className={`${input} w-20`}
            />
            <button
              type="button"
              onClick={() => setFamilies(prev => prev.filter((_, j) => j !== i))}
              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
              title="Aileyi kaldır"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFamilies(prev => [...prev, { name: "", sharePct: "" }])}
            className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Ürün ailesi ekle
          </button>
          {families.length > 0 && (
            <span className={`text-[11px] ${familyShareTotal > 100 ? "text-amber-700 font-bold" : "text-slate-500"}`}>
              Toplam hacim payı: %{familyShareTotal}{familyShareTotal > 100 && " — %100'ü aşıyor"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
