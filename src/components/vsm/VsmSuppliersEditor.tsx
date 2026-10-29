// VSM Kurulum — up to three key raw-material suppliers (user request 2026-10-29). The first one is also
// written to the older single supplier fields so exports and older readers keep working.
import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useVsm } from "./VsmContext";
import { VSM_MAX_SUPPLIERS, VsmSupplier, suppliersOf } from "./vsmTypes";

const FIELDS: { key: keyof VsmSupplier; label: string; placeholder: string }[] = [
  { key: "name", label: "Tedarikçi", placeholder: "ör. Sac tedarikçisi" },
  { key: "material", label: "Malzeme", placeholder: "ör. Rulo sac" },
  { key: "delivery", label: "Sevk sıklığı", placeholder: "ör. Haftada 2" },
  { key: "batch", label: "Parti", placeholder: "ör. 1 haftalık" },
  { key: "leadTime", label: "Temin süresi", placeholder: "ör. 5 gün" },
  { key: "logistics", label: "Lojistik", placeholder: "ör. Kamyon" }
];
const cell = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold";

export default function VsmSuppliersEditor() {
  const { factorySetup, setFactorySetup } = useVsm();
  const list = suppliersOf(factorySetup);
  const write = (next: VsmSupplier[]) => setFactorySetup(p => {
    const first = next[0];
    return {
      ...p,
      suppliers: next,
      supplierName: first?.name || "", supplierMaterial: first?.material || "", supplierDelivery: first?.delivery || "",
      supplierBatch: first?.batch || "", supplierLeadTime: first?.leadTime || "", supplierLogistics: first?.logistics || ""
    };
  });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-slate-800">Hammadde tedarikçileri (en fazla {VSM_MAX_SUPPLIERS})</span>
        {list.length < VSM_MAX_SUPPLIERS && (
          <button type="button" onClick={() => write([...list, { name: "" }])} className="flex items-center gap-1 text-xs font-bold text-indigo-700 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Tedarikçi ekle
          </button>
        )}
      </div>
      {list.length === 0 && <p className="text-[11px] text-slate-500">Henüz tedarikçi girilmedi.</p>}
      {list.map((sup, i) => (
        <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-500">TEDARİKÇİ {i + 1}</span>
            <button type="button" onClick={() => write(list.filter((_, j) => j !== i))} className="p-1 text-red-500 cursor-pointer" title="Kaldır"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {FIELDS.map(f => (
              <label key={f.key} className="space-y-1">
                <span className="block text-[11px] font-bold text-slate-500">{f.label}</span>
                <input value={(sup[f.key] as string) ?? ""} placeholder={f.placeholder} className={cell}
                  onChange={e => write(list.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
