// VSM dashboard indicators (plan step V4): eight current ↔ future indicators from the calculation engine,
// the C/T – takt balance chart, capacity against daily demand, and one per-process comparison chart with
// a metric switch (replaces the separate lead-time / setup / scrap / defect charts and the gauge cards).
// Money is shown only when unit costs were entered.
import React, { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Cell } from "recharts";
import { useVsm } from "./VsmContext";
import { costsEntered, formatMoney, taktCheck } from "./vsmCalc";

type Metric = "cycleTime" | "changeoverTime" | "scrap" | "defect" | "wipDays" | "oee";
const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: "cycleTime", label: "Çevrim süresi", unit: "sn" },
  { key: "changeoverTime", label: "Model değişim (C/O)", unit: "dk" },
  { key: "wipDays", label: "Stok günü", unit: "gün" },
  { key: "oee", label: "OEE", unit: "%" },
  { key: "scrap", label: "Hurda adedi", unit: "adet" },
  { key: "defect", label: "Hata oranı", unit: "%" }
];

function Indicator({ title, current, future, better, showFuture, note }: {
  title: string; current: string; future?: string; better?: boolean | null; showFuture: boolean; note?: string;
}) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
      <div className="text-[10px] uppercase text-slate-400 font-bold font-mono tracking-wider">{title}</div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <span className="text-xl font-extrabold text-slate-900 font-mono">{current}</span>
        {showFuture && future !== undefined && future !== current && (
          <span className={`text-xs font-bold font-mono ${better === true ? "text-emerald-600" : better === false ? "text-red-600" : "text-slate-500"}`}>
            → {future}
          </span>
        )}
      </div>
      {note && <div className="text-[10px] text-slate-500 mt-1">{note}</div>}
    </div>
  );
}

export default function VsmIndicatorPanel() {
  const {
    dashboardData: c, simulationComparison, currentProcessesCalculated, futureProcessesCalculated, taktTime, pitchTime,
    dailyDemand, factorySetup, companyCurrency, workforceAnalysis
  } = useVsm();
  const hasFuture = simulationComparison.hasEdits;
  const [state, setState] = useState<"current" | "future">("current");
  const [metric, setMetric] = useState<Metric>("cycleTime");
  const procs = state === "future" && hasFuture ? futureProcessesCalculated : currentProcessesCalculated;
  const takt = useMemo(() => taktCheck(procs, taktTime, dailyDemand), [procs, taktTime, dailyDemand]);
  const money = costsEntered(factorySetup);
  const n1 = (v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  const lower = (a: number, b: number) => (a === b ? null : b < a);

  const metricValue = (p: any, key: Metric) => {
    if (key === "defect") return Math.round((100 - p.quality) * 10) / 10;
    if (key === "wipDays") return dailyDemand > 0 ? Math.round((p.inventoryBefore / dailyDemand) * 100) / 100 : 0;
    return p[key] ?? 0;
  };
  const metricInfo = METRICS.find(m => m.key === metric)!;
  const compareData = currentProcessesCalculated.map((p, i) => ({
    name: p.name.split(" ")[0],
    Mevcut: metricValue(p, metric),
    ...(hasFuture ? { Gelecek: metricValue(futureProcessesCalculated[i] || p, metric) } : {})
  }));

  return (
    <div className="space-y-5">
      {/* EIGHT INDICATORS — current, and the future value when the simulation has changes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="vsm_indicators">
        <Indicator title="Lead time" current={`${n1(c.currentLeadTime)} gün`} future={`${n1(c.futureLeadTime)} gün`} better={lower(c.currentLeadTime, c.futureLeadTime)} showFuture={hasFuture} note="hammadde + kritik yol + mamul" />
        <Indicator title="Katma değer oranı (PCE)" current={`%${c.currentVaRatio}`} future={`%${c.futureVaRatio}`} better={c.currentVaRatio === c.futureVaRatio ? null : c.futureVaRatio > c.currentVaRatio} showFuture={hasFuture} />
        <Indicator title="Toplam WIP" current={`${c.currentWip.toLocaleString("tr-TR")} ad`} future={`${c.futureWip.toLocaleString("tr-TR")} ad`} better={lower(c.currentWip, c.futureWip)} showFuture={hasFuture}
          note={dailyDemand > 0 ? `${n1(c.currentWip / dailyDemand)} günlük talep` : undefined} />
        <Indicator title="Takt / pitch" current={taktTime > 0 ? `${n1(taktTime)} sn` : "—"} showFuture={false}
          note={taktTime > 0 ? (pitchTime > 0 ? `pitch ${n1(pitchTime / 60)} dk · günlük talep ${dailyDemand}` : `günlük talep ${dailyDemand}`) : "Haftalık talep ve vardiya girilince hesaplanır"} />
        <Indicator title="Darboğaz (en yüksek C/T)" current={c.currentBottleneckName} future={c.futureBottleneckName} showFuture={hasFuture}
          note={takt.constraintName ? `${takt.constraintCt} sn${taktTime > 0 ? (takt.constraintOverTakt ? " — takt'ın üstünde" : " — takt'ın altında") : ""}` : undefined} />
        <Indicator title="Ortalama OEE" current={`%${n1(c.currentAvgOee)}`} future={`%${n1(c.futureAvgOee)}`} better={c.currentAvgOee === c.futureAvgOee ? null : c.futureAvgOee > c.currentAvgOee} showFuture={hasFuture} />
        <Indicator title="Operatör / norm kadro" current={`${c.currentBlueCollar}`} future={`${c.futureBlueCollar}`} better={lower(c.currentBlueCollar, c.futureBlueCollar)} showFuture={hasFuture}
          note={`norm kadro (mevcut durum): ${workforceAnalysis.totalGerekli}`} />
        <Indicator title="Yıllık kayıp" current={money ? formatMoney(c.currentWasteCost, companyCurrency) : "—"} future={money ? formatMoney(c.futureWasteCost, companyCurrency) : undefined}
          better={money ? lower(c.currentWasteCost, c.futureWasteCost) : null} showFuture={hasFuture && money}
          note={money ? "stok taşıma + hurda + duruş" : "Kurulum'da birim maliyet girilmedi"} />
      </div>
      {hasFuture && <p className="text-[11px] text-slate-500">→ ile gösterilen değerler gelecek durum simülasyonudur, gerçekleşmiş sonuç değildir.</p>}

      {/* C/T – TAKT BALANCE + CAPACITY VS DEMAND */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-80" id="chart_ct_takt">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">Operatör Dengesi: C/T ↔ Takt</h4>
            {hasFuture && (
              <div className="flex bg-slate-100 rounded-full p-0.5 text-[11px] font-bold">
                {(["current", "future"] as const).map(k => (
                  <button key={k} onClick={() => setState(k)} className={`px-3 py-1 rounded-full cursor-pointer ${state === k ? "bg-white shadow-sm text-indigo-600" : "text-slate-500"}`}>
                    {k === "current" ? "Mevcut" : "Gelecek"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={takt.rows.map(r => ({ name: r.name.split(" ")[0], "C/T (sn)": r.cycleTime, over: r.overTakt }))} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                {/* keep the takt line inside the scale even when every C/T is below it */}
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} domain={[0, (max: number) => Math.ceil(Math.max(max, taktTime * 1.1))]} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: "1px solid #e2e8f0" }} />
                {taktTime > 0 && <ReferenceLine y={taktTime} stroke="#dc2626" strokeDasharray="5 4" label={{ value: `Takt ${taktTime} sn`, position: "insideTopRight", fontSize: 10, fill: "#dc2626" }} />}
                <Bar dataKey="C/T (sn)" radius={[4, 4, 0, 0]}>
                  {takt.rows.map(r => <Cell key={r.id} fill={r.overTakt ? "#ef4444" : "#6366f1"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {taktTime > 0
              ? (takt.overTaktCount > 0 ? `${takt.overTaktCount} proses takt'ın üstünde (kırmızı): talebi bu ayarla karşılayamaz.` : "Tüm prosesler takt'ın altında.")
              : "Takt hesaplanmadı — Kurulum'da haftalık talep ve vardiya girin."}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-80 overflow-hidden" id="table_capacity_demand">
          <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono mb-3">Kapasite ↔ Günlük Talep</h4>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-[11px] table-fixed">
              <thead className="text-slate-400 text-[10px] uppercase"><tr><th className="text-left pb-2 w-[44%]">Proses</th><th className="text-right pb-2">Adet/gün</th><th className="text-right pb-2">Talep %</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {takt.rows.map(r => (
                  <tr key={r.id}>
                    <td className="py-1.5 font-bold text-slate-800 truncate">{r.name}</td>
                    <td className="py-1.5 text-right font-mono">{r.capacity.toLocaleString("tr-TR")}</td>
                    <td className={`py-1.5 text-right font-mono font-bold ${dailyDemand > 0 && r.capacity < dailyDemand ? "text-red-600" : "text-emerald-600"}`}>
                      {dailyDemand > 0 ? `%${r.demandCoverPct}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {dailyDemand > 0 ? `Günlük talep ${dailyDemand} adet; %100 altı kırmızı.` : "Günlük talep girilmedi."}
          </p>
        </div>
      </div>

      {/* ONE PER-PROCESS COMPARISON CHART WITH A METRIC SWITCH */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-80" id="chart_process_compare">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">Proses Bazında {hasFuture ? "Mevcut ↔ Gelecek" : "Değerler"}</h4>
          <select value={metric} onChange={e => setMetric(e.target.value as Metric)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700">
            {METRICS.map(m => <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>)}
          </select>
        </div>
        <div className="flex-1 min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compareData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: "1px solid #e2e8f0" }} formatter={(v: any) => `${v} ${metricInfo.unit}`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Mevcut" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              {hasFuture && <Bar dataKey="Gelecek" fill="#f59e0b" radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
