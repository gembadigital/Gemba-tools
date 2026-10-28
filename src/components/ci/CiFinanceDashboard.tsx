// CI finansal dashboard (plan step C6). Every figure comes from the single finance model in
// ciFinance.ts: expected annual gain (A3 step 3) → reported realized gain (step 7) → consultant-
// confirmed gain, plus investment. Amounts are in the customer currency; other currencies are
// converted with the CI settings rates or left out and counted.
import React, { useMemo, useState } from "react";
import {
  Target, TrendingUp, ShieldCheck, Wallet, Clock, BarChart3, Layers, ListChecks, Info
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar
} from "recharts";
import type { KaizenCard } from "../../types";
import { FxRates } from "./ciMoney";
import { GAIN_LINES, projectMoney, monthRange, monthLabel, paybackMonths } from "./ciFinance";
import { getKaizenCategory } from "./ciCategory";
import { isClosed } from "../../utils/ciLifecycle";
import { Card, SectionTitle, KpiCard, EmptyState, Pill, inputCls, formatAmount, tableCls, theadCls, thCls, tdCls, trCls } from "./ciUi";
import { StageBadge } from "./CiProjectCard";

interface Props {
  projects: KaizenCard[];                       // already filtered by department / phase on the page
  currencySymbol: string;
  baseCurrency: string;                         // customer currency label
  fxRates: FxRates;
  opportunityGain: (k: KaizenCard) => number | undefined;
  projectNo: (k: KaizenCard) => string;
  onOpenProject: (k: KaizenCard) => void;
}

const ALL_YEARS = "all";
const short = (n: number) => Math.abs(n) >= 1e6 ? `${formatAmount(n / 1e6, 1)}\u00a0Mn` : Math.abs(n) >= 1e3 ? `${formatAmount(n / 1e3, 0)}\u00a0B` : formatAmount(n, 0);

export default function CiFinanceDashboard({ projects, currencySymbol, baseCurrency, fxRates, opportunityGain, projectNo, onOpenProject }: Props) {
  const [year, setYear] = useState<string>(ALL_YEARS);
  const years = useMemo(() => Array.from(new Set(projects.map(p => (p.dateProposed || "").slice(0, 4)).filter(Boolean))).sort().reverse(), [projects]);
  const cur = currencySymbol;
  const money = (n: number) => `${cur}${formatAmount(Math.round(n))}`;

  const rows = useMemo(() => projects
    .filter(p => p.holdState !== "cancelled")
    .filter(p => year === ALL_YEARS || (p.dateProposed || "").startsWith(year))
    .map(p => ({ p, m: projectMoney(p, baseCurrency, fxRates, opportunityGain(p)) })),
  [projects, year, baseCurrency, fxRates, opportunityGain]);

  const sum = (f: (r: typeof rows[number]) => number | null) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const expected = sum(r => r.m.expected);
  const reported = sum(r => r.m.confirmed ? 0 : r.m.realized);
  const confirmed = sum(r => r.m.confirmed ? r.m.realized : 0);
  const realizedAll = reported + confirmed;
  const investment = sum(r => r.m.investment);
  const excluded = rows.filter(r => r.m.expected === null || r.m.realized === null).length;
  const payback = paybackMonths(investment, realizedAll);
  const realizedPct = expected > 0 ? Math.round((realizedAll / expected) * 100) : null;

  // Monthly cumulative: realized (by confirmation / closing date) vs expected (by target date). A
  // reported gain with no date yet (step 7 still open) counts in the current month.
  const series = useMemo(() => {
    const now = new Date().toISOString().slice(0, 7);
    const gainMonth = (r: typeof rows[number]) => (r.m.gainDate || ((r.m.realized ?? 0) > 0 ? now : "")).slice(0, 7);
    const dates = [...rows.map(gainMonth), ...rows.map(r => (r.p.plannedFinishDate || "").slice(0, 7))].filter(d => /^\d{4}-\d{2}$/.test(d));
    if (!dates.length) return [];
    const months = monthRange(dates.reduce((a, b) => a < b ? a : b), [...dates, now].reduce((a, b) => a > b ? a : b));
    let cumExp = 0, cumConf = 0, cumRep = 0;
    // Amounts before the first shown month start the running totals.
    const first = months[0];
    for (const r of rows) {
      const f = (r.p.plannedFinishDate || "").slice(0, 7);
      if (f && f < first) cumExp += r.m.expected ?? 0;
      const g = gainMonth(r);
      if (g && g < first) r.m.confirmed ? (cumConf += r.m.realized ?? 0) : (cumRep += r.m.realized ?? 0);
    }
    return months.map(ym => {
      for (const r of rows) {
        if ((r.p.plannedFinishDate || "").slice(0, 7) === ym) cumExp += r.m.expected ?? 0;
        if (gainMonth(r) === ym) r.m.confirmed ? (cumConf += r.m.realized ?? 0) : (cumRep += r.m.realized ?? 0);
      }
      return { ay: monthLabel(ym), Beklenen: Math.round(cumExp), Teyitli: Math.round(cumConf), "Teyitli + raporlanan": Math.round(cumConf + cumRep) };
    });
  }, [rows]);

  const byKey = (keyOf: (p: KaizenCard) => string) => {
    const map = new Map<string, { name: string; Beklenen: number; Gerçekleşen: number; adet: number }>();
    for (const r of rows) {
      const k = keyOf(r.p) || "Belirtilmemiş";
      const e = map.get(k) || { name: k, Beklenen: 0, Gerçekleşen: 0, adet: 0 };
      e.Beklenen += r.m.expected ?? 0; e.Gerçekleşen += r.m.realized ?? 0; e.adet++;
      map.set(k, e);
    }
    return Array.from(map.values()).sort((a, b) => (b.Beklenen + b.Gerçekleşen) - (a.Beklenen + a.Gerçekleşen));
  };
  const byCategory = byKey(getKaizenCategory);
  const byDepartment = byKey(p => p.department);

  // 17-line breakdown over the projects that have one (only those in the customer currency).
  const lines = GAIN_LINES.map(l => ({
    name: l.label,
    group: l.group,
    value: rows.reduce((s, r) => s + (r.m.realized !== null ? Number((r.p.financialsInput as any)?.[l.key]?.val) || 0 : 0), 0)
  })).filter(l => l.value > 0).sort((a, b) => b.value - a.value);
  const lineMax = lines[0]?.value || 1;

  const table = [...rows].sort((a, b) => ((b.m.realized ?? 0) + (b.m.expected ?? 0)) - ((a.m.realized ?? 0) + (a.m.expected ?? 0)));

  if (!projects.length) {
    return <Card><EmptyState icon={BarChart3} title="Henüz CI projesi yok" text="Projeler açıldıkça beklenen ve gerçekleşen kazançlar burada izlenir." /></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Finansal dashboard</h3>
          <p className="text-sm text-slate-500 mt-0.5">Yıllık tutarlar, {cur}. Beklenen (3. adım) → raporlanan (7. adım) → danışman teyitli. İptal edilen projeler hariç.</p>
        </div>
        <select className={`${inputCls} sm:w-48`} value={year} onChange={(e) => setYear(e.target.value)} aria-label="Açılış yılı">
          <option value={ALL_YEARS}>Tüm yıllar</option>
          {years.map(y => <option key={y} value={y}>{y} açılışlı</option>)}
        </select>
      </div>

      {excluded > 0 && (
        <div className="text-sm rounded-xl px-4 py-3 bg-amber-50 text-amber-800 ring-1 ring-amber-200 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" /> {excluded} projenin tutarı kuru girilmemiş bir para biriminde; toplamlara dahil değil (Ayarlar → Para birimleri ve kurlar).
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard label="Beklenen kazanç" value={short(expected)} icon={Target} tone="blue" hint={`${rows.length} proje`} />
        <KpiCard label="Teyitli kazanç" value={short(confirmed)} icon={ShieldCheck} tone="emerald" hint={`${rows.filter(r => r.m.confirmed).length} proje`} />
        <KpiCard label="Teyit bekleyen" value={short(reported)} icon={Clock} tone="amber" hint={`${rows.filter(r => !r.m.confirmed && (r.m.realized ?? 0) > 0).length} proje`} />
        <KpiCard label="Yatırım" value={short(investment)} icon={Wallet} tone="slate" hint={payback !== null ? `Geri ödeme ~${formatAmount(payback, 1)} ay` : "Geri ödeme hesaplanamıyor"} />
        <KpiCard label="Gerçekleşme" value={realizedPct === null ? "—" : `%${realizedPct}`} icon={TrendingUp} tone={realizedPct !== null && realizedPct >= 100 ? "emerald" : "slate"} hint="Gerçekleşen ÷ beklenen" />
      </div>

      {/* Funnel */}
      <Card>
        <SectionTitle icon={Layers} title="Kazanç hunisi" hint="Beklenen kazancın ne kadarı gerçekleşti ve teyit edildi." />
        <div className="space-y-3">
          {[
            { label: "Beklenen", value: expected, color: "bg-blue-500" },
            { label: "Gerçekleşen (raporlanan + teyitli)", value: realizedAll, color: "bg-amber-400" },
            { label: "Teyitli", value: confirmed, color: "bg-emerald-500" }
          ].map(b => {
            const max = Math.max(expected, realizedAll, 1);
            return (
              <div key={b.label} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3">
                <span className="text-sm font-semibold text-slate-700 truncate">{b.label}</span>
                <div className="h-7 rounded-lg bg-slate-100 overflow-hidden">
                  <div className={`h-full ${b.color} rounded-lg transition-all`} style={{ width: `${Math.max(b.value > 0 ? 2 : 0, (b.value / max) * 100)}%` }} />
                </div>
                <span className="text-sm font-bold text-slate-900 tabular-nums w-32 text-right">{money(b.value)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Monthly cumulative */}
      <Card>
        <SectionTitle icon={TrendingUp} title="Aylık kümülatif kazanç" hint="Beklenen: hedef bitiş ayında; gerçekleşen: teyit (yoksa kapanış / 7. adım) ayında." />
        {series.length === 0 ? <EmptyState icon={TrendingUp} title="Tarih yok" text="Projelere hedef bitiş tarihi ve gerçekleşen kazanç girildikçe grafik oluşur." /> : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="ay" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={short} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} width={64} />
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Teyitli + raporlanan" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} />
                <Area type="monotone" dataKey="Teyitli" stroke="#10b981" fill="#d1fae5" strokeWidth={2} />
                <Line type="monotone" dataKey="Beklenen" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={BarChart3} title="Kategoriye göre" hint="Kategori proje adı ve fırsat türünden türetilir." />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickFormatter={short} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: "#334155" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: any) => money(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Beklenen" fill="#93c5fd" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Gerçekleşen" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionTitle icon={ListChecks} title="Gerçekleşen kazanç kalemleri" hint="Kazanç kırılımı girilmiş projelerin toplamı." />
          {lines.length === 0 ? <EmptyState icon={ListChecks} title="Kırılım yok" text="Proje kartında 7. adımdaki 'Kazanç kırılımı' ile kalemler girilir." /> : (
            <ul className="space-y-2">
              {lines.map(l => (
                <li key={l.name} className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-3 text-sm">
                  <span className="font-semibold text-slate-700 truncate" title={`${l.name} (${l.group})`}>{l.name}</span>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(l.value / lineMax) * 100}%` }} /></div>
                  <span className="tabular-nums font-semibold text-slate-900">{money(l.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5"><SectionTitle icon={Layers} title="Departmana göre" /></div>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}><tr><th className={thCls}>Departman</th><th className={`${thCls} text-right`}>Proje</th><th className={`${thCls} text-right`}>Beklenen</th><th className={`${thCls} text-right`}>Gerçekleşen</th><th className={`${thCls} text-right`}>Oran</th></tr></thead>
            <tbody>
              {byDepartment.map(d => (
                <tr key={d.name} className={trCls}>
                  <td className={tdCls}>{d.name}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{d.adet}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{money(d.Beklenen)}</td>
                  <td className={`${tdCls} text-right tabular-nums font-semibold`}>{d.Gerçekleşen ? money(d.Gerçekleşen) : "—"}</td>
                  <td className={`${tdCls} text-right tabular-nums`}>{d.Beklenen > 0 && d.Gerçekleşen > 0 ? `%${Math.round((d.Gerçekleşen / d.Beklenen) * 100)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padded={false}>
        <div className="px-5 pt-5"><SectionTitle icon={Target} title="Projeler" hint="Satıra tıklayınca proje kartı açılır." /></div>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={thCls}>Proje</th><th className={thCls}>Adım</th>
                <th className={`${thCls} text-right`}>Beklenen</th><th className={`${thCls} text-right`}>Gerçekleşen</th>
                <th className={`${thCls} text-right`}>Fark</th><th className={thCls}>Teyit</th>
              </tr>
            </thead>
            <tbody>
              {table.map(({ p, m }) => {
                const gap = m.expected && m.realized !== null && (m.realized ?? 0) > 0 ? Math.round(((m.realized! - m.expected) / m.expected) * 100) : null;
                return (
                  <tr key={p.id} className={`${trCls} cursor-pointer`} onClick={() => onOpenProject(p)}>
                    <td className={tdCls}>
                      <p className="font-semibold text-slate-900">{p.title}</p>
                      <p className="text-xs text-slate-500 font-mono">{projectNo(p)} · {p.projectLeader || p.originator || "—"}</p>
                    </td>
                    <td className={tdCls}><StageBadge project={p} /></td>
                    <td className={`${tdCls} text-right tabular-nums`}>{m.expected === null ? "kur yok" : m.expected ? money(m.expected) : "—"}</td>
                    <td className={`${tdCls} text-right tabular-nums font-semibold`}>{m.realized === null ? "kur yok" : m.realized ? money(m.realized) : "—"}</td>
                    <td className={`${tdCls} text-right tabular-nums ${gap !== null && gap < 0 ? "text-red-600" : "text-emerald-700"}`}>{gap === null ? "—" : `${gap > 0 ? "+" : gap < 0 ? "-" : ""}%${Math.abs(gap)}`}</td>
                    <td className={tdCls}>
                      {m.confirmed ? <Pill tone="emerald"><ShieldCheck className="w-3 h-3" /> Teyitli</Pill>
                        : (m.realized ?? 0) > 0 ? <Pill tone="amber">Bekliyor</Pill>
                        : isClosed(p) ? <Pill>Kazanç yok</Pill> : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
