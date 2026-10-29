// VSM — Ürün Ailesi: product–process (PQ/PR) matrix. Products with their weekly volume and routing,
// family suggestions by routing similarity (vsmProductMatrix.ts), and taking the chosen family's volume
// into Kurulum (weekly demand, family name, volume share). User decision 7 (plan step V2).
import React, { useMemo, useState } from "react";
import { Plus, Trash2, Layers, ArrowRight, CheckCircle2 } from "lucide-react";
import { useVsm } from "./VsmContext";
import { familyTotals, suggestFamilies } from "./vsmProductMatrix";
import type { VsmMatrixProduct, VsmProductMatrix } from "./vsmTypes";

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const inputCls = "bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800";

export default function VsmProductMatrixTab() {
  const { productMatrix, setProductMatrix, vsmProcesses, factorySetup, setFactorySetup } = useVsm();
  const [newStep, setNewStep] = useState("");
  const m = productMatrix;
  const update = (patch: Partial<VsmProductMatrix>) => setProductMatrix({ ...m, ...patch });
  const updateProduct = (id: string, patch: Partial<VsmMatrixProduct>) =>
    update({ products: m.products.map(p => (p.id === id ? { ...p, ...patch } : p)) });

  const families = useMemo(() => suggestFamilies(m), [m]);
  const chosen = m.familyProductIds || [];
  const chosenTotals = useMemo(() => familyTotals(m, chosen), [m, chosen]);
  const totalVolume = m.products.reduce((s, p) => s + (p.weeklyVolume ?? 0), 0);
  const stepName = new Map(m.steps.map(s => [s.id, s.name]));

  const addMapProcesses = () => {
    const have = new Set(m.steps.map(s => s.id));
    const added = vsmProcesses.filter(p => !have.has(p.id)).map(p => ({ id: p.id, name: p.name }));
    if (added.length) update({ steps: [...m.steps, ...added] });
  };
  const addStep = () => {
    const name = newStep.trim();
    if (!name) return;
    update({ steps: [...m.steps, { id: newId("step"), name }] });
    setNewStep("");
  };
  const removeStep = (id: string) => update({
    steps: m.steps.filter(s => s.id !== id),
    products: m.products.map(p => ({ ...p, stepIds: p.stepIds.filter(x => x !== id) }))
  });
  const toggleStep = (product: VsmMatrixProduct, stepId: string) => updateProduct(product.id, {
    stepIds: product.stepIds.includes(stepId) ? product.stepIds.filter(x => x !== stepId) : [...product.stepIds, stepId]
  });

  const applyToSetup = () => {
    if (chosen.length === 0) return;
    if (factorySetup.weeklyDemand > 0 && factorySetup.weeklyDemand !== chosenTotals.weeklyVolume &&
        !window.confirm(`Kurulumdaki haftalık talep (${factorySetup.weeklyDemand}) ailenin haftalık hacmiyle (${chosenTotals.weeklyVolume}) değiştirilsin mi?`)) {
      return;
    }
    setFactorySetup(p => ({
      ...p,
      productFamily: chosenTotals.names.join(", "),
      weeklyDemand: chosenTotals.weeklyVolume,
      productVolumeShare: chosenTotals.sharePct
    }));
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div>
        <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" /> Ürün Ailesi Seçimi (Ürün–Proses Matrisi)
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl">
          Ürünleri haftalık hacimleriyle girin ve her ürünün geçtiği adımları işaretleyin. Rotası yeterince benzeyen ürünler
          bir aile olarak önerilir; harita seçilen aile için çizilir.
        </p>
      </div>

      {/* STEPS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider">Proses Adımları (matris sütunları)</h3>
          <button type="button" onClick={addMapProcesses} className="text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer">
            + Haritadaki prosesleri ekle
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.steps.length === 0 && <span className="text-[11px] text-slate-500">Henüz adım yok.</span>}
          {m.steps.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full pl-3 pr-1 py-1 text-[11px] font-bold text-slate-700">
              {s.name}
              <button type="button" onClick={() => removeStep(s.id)} className="p-0.5 text-slate-400 hover:text-red-600 cursor-pointer" title="Adımı kaldır">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newStep} onChange={e => setNewStep(e.target.value)} onKeyDown={e => e.key === "Enter" && addStep()}
            placeholder="Yeni adım adı" className={`${inputCls} flex-1 sm:flex-none sm:w-64 py-2`} />
          <button type="button" onClick={addStep} className="bg-slate-950 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer">Ekle</button>
        </div>
      </div>

      {/* MATRIX */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-100">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider">
            Ürünler {totalVolume > 0 && <span className="text-slate-500 normal-case font-sans">· toplam {totalVolume.toLocaleString("tr-TR")} adet/hafta</span>}
          </h3>
          <button type="button" onClick={() => update({ products: [...m.products, { id: newId("prd"), name: "", stepIds: [] }] })}
            className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Ürün ekle
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="p-2 text-left min-w-[160px]">Ürün</th>
                <th className="p-2 text-left w-24">Kod</th>
                <th className="p-2 text-right w-28">Adet / hafta</th>
                <th className="p-2 text-right w-16">Pay</th>
                {m.steps.map(s => <th key={s.id} className="p-2 text-center min-w-[70px] text-[10px]">{s.name}</th>)}
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {m.products.length === 0 && (
                <tr><td colSpan={5 + m.steps.length} className="p-4 text-center text-slate-500">Henüz ürün girilmedi.</td></tr>
              )}
              {m.products.map(p => (
                <tr key={p.id} className={chosen.includes(p.id) ? "bg-indigo-50/50" : ""}>
                  <td className="p-2"><input value={p.name} placeholder="Ürün adı" onChange={e => updateProduct(p.id, { name: e.target.value })} className={`${inputCls} w-full`} /></td>
                  <td className="p-2"><input value={p.code ?? ""} onChange={e => updateProduct(p.id, { code: e.target.value || undefined })} className={`${inputCls} w-full`} /></td>
                  <td className="p-2 text-right">
                    <input type="number" min={0} value={p.weeklyVolume ?? ""}
                      onChange={e => updateProduct(p.id, { weeklyVolume: e.target.value.trim() === "" ? undefined : Math.max(0, Number(e.target.value)) })}
                      className={`${inputCls} w-24 text-right font-mono`} />
                  </td>
                  <td className="p-2 text-right font-mono text-slate-600">
                    {totalVolume > 0 && p.weeklyVolume ? `%${Math.round((p.weeklyVolume / totalVolume) * 1000) / 10}` : "—"}
                  </td>
                  {m.steps.map(s => (
                    <td key={s.id} className="p-2 text-center">
                      <input type="checkbox" checked={p.stepIds.includes(s.id)} onChange={() => toggleStep(p, s.id)} className="w-4 h-4 cursor-pointer" />
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    <button type="button" title="Ürünü sil" className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                      onClick={() => update({ products: m.products.filter(x => x.id !== p.id), familyProductIds: chosen.filter(x => x !== p.id) })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAMILIES */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 font-mono tracking-wider">Önerilen Aileler</h3>
          <label className="text-xs text-slate-600 flex items-center gap-2">
            Rota benzerliği en az
            <input type="number" min={10} max={100} value={m.similarityPct ?? 80}
              onChange={e => update({ similarityPct: Math.min(100, Math.max(10, Number(e.target.value) || 80)) })}
              className={`${inputCls} w-16 text-right font-mono`} />
            %
          </label>
        </div>
        {families.length === 0 && <p className="text-[11px] text-slate-500">Rotası işaretlenmiş ürün yok.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {families.map((f, i) => {
            const isChosen = f.productIds.length === chosen.length && f.productIds.every(id => chosen.includes(id));
            return (
              <div key={f.key} className={`border rounded-xl p-3 space-y-2 ${isChosen ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-900">Aile {i + 1} · %{f.sharePct} hacim</span>
                  <span className="text-[11px] font-mono text-slate-600">{f.weeklyVolume.toLocaleString("tr-TR")} adet/hafta</span>
                </div>
                <p className="text-[11px] text-slate-700">{f.names.join(", ")}</p>
                <p className="text-[10px] text-slate-500">Adımlar: {f.stepIds.map(id => stepName.get(id) || id).join(" → ")}</p>
                <button type="button" onClick={() => update({ familyProductIds: f.productIds })}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 ${isChosen ? "bg-indigo-600 text-white" : "bg-slate-950 text-white"}`}>
                  {isChosen ? <><CheckCircle2 className="w-3.5 h-3.5" /> Seçili aile</> : "Bu aileyi seç"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHOSEN FAMILY → KURULUM */}
      {chosen.length > 0 && (
        <div className="bg-slate-950 text-white rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="text-xs space-y-1">
            <div className="font-extrabold">Seçili aile: {chosenTotals.names.join(", ")}</div>
            <div className="text-slate-300">
              {chosenTotals.weeklyVolume.toLocaleString("tr-TR")} adet/hafta · toplam hacmin %{chosenTotals.sharePct}'i
            </div>
          </div>
          <button type="button" onClick={applyToSetup}
            className="bg-amber-400 text-slate-950 text-xs font-extrabold px-4 py-2 rounded-xl cursor-pointer flex items-center gap-1 self-start md:self-auto">
            Kuruluma aktar (talep, aile adı, hacim payı) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
