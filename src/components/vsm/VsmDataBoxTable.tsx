// VSM — standard data-box fields per process (plan step V2): batch size, EPEI, variants, value-added
// time and transport time. Shown under Üretim & Kapasite; edits follow the Current / Future mode like
// every other process field.
import React from "react";
import { useVsm } from "./VsmContext";

const optionalNumber = (raw: string): number | undefined => (raw.trim() === "" ? undefined : Number(raw));
const cell = "w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-800 text-xs";

export default function VsmDataBoxTable() {
  const { activeProcesses, handleUpdateProcessField } = useVsm();
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-extrabold text-slate-900">Veri Kutusu: Parti, EPEI, Çeşit, Katma Değer ve Taşıma</h3>
        <p className="text-xs text-slate-500">
          Katma değer süresi girilmezse çevrim süresi katma değer sayılır (PCE hesabı). Taşıma süresi bilgi amaçlıdır, lead time'a eklenmez.
        </p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3 w-12 text-center">Sıra</th>
              <th className="p-3">Proses</th>
              <th className="p-3 text-center">Parti (adet)</th>
              <th className="p-3 text-center">EPEI</th>
              <th className="p-3 text-center">Çeşit sayısı</th>
              <th className="p-3 text-center">Katma değer (sn)</th>
              <th className="p-3 text-center">Taşıma (dk)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeProcesses.map((p, idx) => (
              <tr key={p.id} className="hover:bg-slate-50/50">
                <td className="p-3 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                <td className="p-3 font-bold text-slate-900">{p.name}</td>
                <td className="p-3 text-center">
                  <input type="number" min={0} value={p.batchSize ?? ""} className={cell}
                    onChange={e => handleUpdateProcessField(p.id, "batchSize", optionalNumber(e.target.value))} />
                </td>
                <td className="p-3 text-center">
                  <input type="text" value={p.epei ?? ""} placeholder="ör. 2 gün" className={cell}
                    onChange={e => handleUpdateProcessField(p.id, "epei", e.target.value || undefined)} />
                </td>
                <td className="p-3 text-center">
                  <input type="number" min={0} value={p.variantCount ?? ""} className={cell}
                    onChange={e => handleUpdateProcessField(p.id, "variantCount", optionalNumber(e.target.value))} />
                </td>
                <td className="p-3 text-center">
                  <input type="number" min={0} value={p.valueAddedTime ?? ""} placeholder={String(p.cycleTime || "")} className={cell}
                    onChange={e => handleUpdateProcessField(p.id, "valueAddedTime", optionalNumber(e.target.value))} />
                </td>
                <td className="p-3 text-center">
                  <input type="number" min={0} value={p.transportTime ?? ""} className={cell}
                    onChange={e => handleUpdateProcessField(p.id, "transportTime", optionalNumber(e.target.value))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
