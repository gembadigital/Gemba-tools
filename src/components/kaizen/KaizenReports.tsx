import React, { useMemo, useState } from "react";
import { Gem, Download, ShieldAlert, Leaf, Sparkles, Trophy, Lightbulb, BadgeCheck, Award, Coins, RotateCcw } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadialBarChart, RadialBar, PolarAngleAxis
} from "recharts";
import { KaizenSuggestion, KaizenEvaluation, KaizenPersonnel, KaizenImplementation, ApprovalStatus } from "./kaizenTypes";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS, actionProgress, statusLabel, opportunityPool } from "./kaizenCalc";
import { KaizenApi } from "./KaizenSuggestionSystem";
import { KaizenSettings, toBaseCurrency, optionChoices, stagesOf, awaitingFirstDecision } from "../../utils/kaizenSettings";
import { Card, KpiCard, Button, EmptyState, PageHeader, tableCls, theadCls, thCls, tdCls, trCls } from "./kaizenUi";

// Native replacement for the legacy Power BI report (two pages: a KPI/chart dashboard with five
// filters, and a per-suggestion "Personel Bazlı Kaizen Puan Tablosu"). Same grouping, plus the
// departmental treemap and the "Toplam Getiri" tile that the original had.
interface Props {
  settings: KaizenSettings;
  suggestions: KaizenSuggestion[];
  evaluations: KaizenEvaluation[];
  personnel: KaizenPersonnel[];
  implementations: KaizenImplementation[];
  api: KaizenApi;
}

const ALL = "__ALL__";
const COLORS = ["#0f172a", "#3b82f6", "#00A280", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];
const TREEMAP_COLORS = ["#0ea5e9", "#3b82f6", "#1e3a8a", "#8b5cf6", "#ec4899", "#ef4444", "#14b8a6", "#f59e0b"];
const BUCKET = { approved: "#00A280", pending: "#facc15", rejected: "#ef4444" };
const TICK = { fontSize: 12, fill: "#64748b" };

function statusBucket(s: KaizenSuggestion): "approved" | "pending" | "rejected" {
  if (awaitingFirstDecision(s)) return "pending";
  if (s.approvalStatus === "Rejected" || s.approvalStatus === "Rejected 2nd") return "rejected";
  return "approved";
}

const selectCls = "h-11 w-full px-3 rounded-xl bg-slate-50/80 ring-1 ring-inset ring-slate-200 text-sm text-slate-800 transition-all focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600/40";

export default function KaizenReports({ suggestions, evaluations, personnel, implementations, api, settings }: Props) {
  const base = settings.baseCurrency;
  // Filters list the customer's current options plus any older value still present in the data.
  const typeFilterOptions = useMemo(() => optionChoices(settings.suggestionTypes, suggestions.flatMap(s => s.suggestionTypes || [])), [settings, suggestions]);
  const stageFilterOptions = useMemo(() => optionChoices(settings.stages, suggestions.map(s => s.stage)), [settings, suggestions]);
  const [fDepartment, setFDepartment] = useState(ALL);
  const [fType, setFType] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fStage, setFStage] = useState(ALL);
  const [fPersonnel, setFPersonnel] = useState(ALL);
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [downloading, setDownloading] = useState(false);

  const departments = useMemo(() => Array.from(new Set(suggestions.map(s => s.personnelDepartment).filter(Boolean))).sort(), [suggestions]);
  const personnelNames = useMemo(() => Array.from(new Set(suggestions.map(s => s.personnelName).filter(Boolean))).sort(), [suggestions]);

  const filtered = useMemo(() => suggestions.filter(s => {
    if (fDepartment !== ALL && s.personnelDepartment !== fDepartment) return false;
    if (fType !== ALL && !(s.suggestionTypes || []).includes(fType)) return false;
    if (fStatus !== ALL && s.approvalStatus !== fStatus) return false;
    if (fStage !== ALL && s.stage !== fStage) return false;
    if (fPersonnel !== ALL && s.personnelName !== fPersonnel) return false;
    const created = (s.createdAt || "").slice(0, 10);
    if (fFrom && created < fFrom) return false;
    if (fTo && created > fTo) return false;
    return true;
  }), [suggestions, fDepartment, fType, fStatus, fStage, fPersonnel, fFrom, fTo]);

  const filteredIds = useMemo(() => new Set(filtered.map(s => s.id)), [filtered]);
  const filteredEvaluations = useMemo(() => evaluations.filter(e => filteredIds.has(e.suggestionId)), [evaluations, filteredIds]);
  const evaluationBySuggestion = useMemo(() => {
    const map = new Map<string, KaizenEvaluation>();
    filteredEvaluations.forEach(e => map.set(e.suggestionId, e));
    return map;
  }, [filteredEvaluations]);

  const resetFilters = () => { setFDepartment(ALL); setFType(ALL); setFStatus(ALL); setFStage(ALL); setFPersonnel(ALL); setFFrom(""); setFTo(""); };
  const hasFilter = [fDepartment, fType, fStatus, fStage, fPersonnel].some(v => v !== ALL) || !!fFrom || !!fTo;

  // ---- KPI row ----
  const totalPoints = filteredEvaluations.reduce((sum, e) => sum + (e.point || 0), 0);
  const completedCount = filtered.filter(s => s.completed).length;
  // Totals are in the customer's base currency. Other currencies are converted with the customer's
  // fixed rates (Kurulum → Ayarlar); in-kind or rate-less amounts are left out and counted instead.
  // Kurul-approved: the income the Kurul approved. Approved by the Amir alone (below the Kurul
  // threshold, no evaluation record): the suggestion's own estimate.
  const approvedIncomeConverted = filtered.filter(s => s.approvalStatus === "Second Approval").flatMap(s => {
    const e = filteredEvaluations.find(ev => ev.suggestionId === s.id);
    if (e) return (e.estimatedIncome || 0) > 0 ? [toBaseCurrency(e.estimatedIncome, e.estimatedIncomeCurrency, settings)] : [];
    return !stagesOf(s).includes("Board") && (s.estimatedSaving || 0) > 0 ? [toBaseCurrency(s.estimatedSaving, s.estimatedSavingCurrency, settings)] : [];
  });
  const approvedIncomeBase = approvedIncomeConverted.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const approvedIncomeExcluded = approvedIncomeConverted.filter(v => v === null).length;
  // Actual (Board-verified) saving next to the estimate — same conversion rule as above.
  const implBySuggestion = useMemo(() => {
    const map = new Map<string, KaizenImplementation>();
    implementations.forEach(i => map.set(i.suggestionId, i));
    return map;
  }, [implementations]);
  const verifiedConverted = filtered.flatMap(s => {
    const i = implBySuggestion.get(s.id);
    return i && i.verification?.status === "Doğrulandı" && (i.actualSaving || 0) > 0 ? [toBaseCurrency(i.actualSaving, i.actualSavingCurrency, settings)] : [];
  });
  const verifiedActualBase = verifiedConverted.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const verifiedExcluded = verifiedConverted.filter(v => v === null).length;

  // Fırsat havuzu (Faz 4.5) for the filtered set.
  const pool = useMemo(() => opportunityPool(filtered, evaluations, implementations, settings), [filtered, evaluations, implementations, settings]);
  const decided = filtered.filter(s => s.approvalStatus !== "Pending");
  const acceptedCount = decided.filter(s => statusBucket(s) === "approved").length;
  const acceptanceRate = decided.length > 0 ? Math.round((acceptedCount / decided.length) * 100) : 0;
  const participants = new Set(filtered.map(s => s.personnelName)).size;
  const participationRate = personnel.length > 0 ? Math.min(100, Math.round((participants / personnel.length) * 100)) : 0;

  // ---- Chart data ----
  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(s => { counts[s.approvalStatus] = (counts[s.approvalStatus] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ label: APPROVAL_STATUS_LABELS[status as ApprovalStatus] || status, count, fill: APPROVAL_STATUS_COLORS[status as ApprovalStatus] || "#64748b" }));
  }, [filtered]);

  const byDepartment = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(s => { const d = s.personnelDepartment || "Belirtilmemiş"; counts[d] = (counts[d] || 0) + 1; });
    return Object.entries(counts).map(([name, size], i) => ({ name, size, fill: TREEMAP_COLORS[i % TREEMAP_COLORS.length] })).sort((a, b) => b.size - a.size);
  }, [filtered]);

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(s => (s.suggestionTypes || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byMonth = useMemo(() => {
    const b: Record<string, { month: string; approved: number; pending: number; rejected: number; saving: number }> = {};
    filtered.forEach(s => {
      const month = (s.createdAt || "").slice(0, 7);
      if (!month) return;
      if (!b[month]) b[month] = { month, approved: 0, pending: 0, rejected: 0, saving: 0 };
      b[month][statusBucket(s)]++;
      b[month].saving += toBaseCurrency(s.estimatedSaving || 0, s.estimatedSavingCurrency, settings) ?? 0;
    });
    return Object.values(b).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered, settings]);

  const byPerson = useMemo(() => {
    const b: Record<string, { name: string; approved: number; pending: number; rejected: number }> = {};
    filtered.forEach(s => {
      const name = s.personnelName || "Belirtilmemiş";
      if (!b[name]) b[name] = { name, approved: 0, pending: 0, rejected: 0 };
      b[name][statusBucket(s)]++;
    });
    return Object.values(b).sort((a, b) => (b.approved + b.pending + b.rejected) - (a.approved + a.pending + a.rejected)).slice(0, 20);
  }, [filtered]);

  const flagCounts = { isg: filtered.filter(s => s.isg).length, cevre: filtered.filter(s => s.cevre).length, motivasyon: filtered.filter(s => s.motivasyon).length };

  const leaderboard = useMemo(() => {
    const m: Record<string, { name: string; department: string; count: number; points: number }> = {};
    filtered.forEach(s => {
      const name = s.personnelName || "Belirtilmemiş";
      if (!m[name]) m[name] = { name, department: s.personnelDepartment, count: 0, points: 0 };
      m[name].count++;
    });
    filteredEvaluations.forEach(e => {
      const s = filtered.find(x => x.id === e.suggestionId);
      if (s && m[s.personnelName || "Belirtilmemiş"]) m[s.personnelName || "Belirtilmemiş"].points += e.point || 0;
    });
    return Object.values(m).sort((a, b) => b.points - a.points || b.count - a.count).slice(0, 10);
  }, [filtered, filteredEvaluations]);

  const detailRows = useMemo(() => [...filtered].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")), [filtered]);

  const download = async () => {
    setDownloading(true);
    try { await api.download("suggestions/export-excel", "Kaizen_Onerileri.xlsx"); } catch { /* surfaced by the disabled state resetting; toast lives in the shell */ }
    setDownloading(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kaizen raporu"
        subtitle={`${filtered.length} / ${suggestions.length} öneri · katılım, kazanç ve süreç görünümü`}
        actions={<>
          {hasFilter && <Button variant="outline" onClick={resetFilters}><RotateCcw className="w-4 h-4" />Filtreleri sıfırla</Button>}
          <Button variant="primary" onClick={download} disabled={downloading}><Download className="w-4 h-4" />{downloading ? "Hazırlanıyor…" : "Excel indir"}</Button>
        </>}
      />
      {/* Filters */}
      <Card className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Filtreler</p>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
          <select value={fPersonnel} onChange={e => setFPersonnel(e.target.value)} className={selectCls}><option value={ALL}>Tüm Personel</option>{personnelNames.map(n => <option key={n} value={n}>{n}</option>)}</select>
          <select value={fDepartment} onChange={e => setFDepartment(e.target.value)} className={selectCls}><option value={ALL}>Tüm Bölümler</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <select value={fType} onChange={e => setFType(e.target.value)} className={selectCls}><option value={ALL}>Tüm Sınıflar</option>{typeFilterOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={selectCls}><option value={ALL}>Tüm Durumlar</option>{Object.entries(APPROVAL_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={fStage} onChange={e => setFStage(e.target.value)} className={selectCls}><option value={ALL}>Tüm Aşamalar</option>{stageFilterOptions.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className={selectCls} aria-label="Başlangıç tarihi" />
          <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} className={selectCls} aria-label="Bitiş tarihi" />
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Toplam Öneri" value={filtered.length} icon={Lightbulb} tone="slate" />
        <KpiCard label="Uygulanan" value={completedCount} icon={BadgeCheck} tone="teal" />
        <KpiCard label="Toplam Kaizen Puanı" value={totalPoints} icon={Award} tone="amber" />
        <KpiCard label={`Tahmini Getiri (${base})`} value={Math.round(approvedIncomeBase).toLocaleString("tr-TR")} icon={Coins} tone="emerald" hint={approvedIncomeExcluded > 0 ? `${approvedIncomeExcluded} kayıt çevrilemeyen para birimiyle, toplama dahil değil` : "Onaylanan öneriler"} />
        <KpiCard label={`Bekleyen Potansiyel (${base})`} value={Math.round(pool.total).toLocaleString("tr-TR")} icon={Gem} tone="amber" hint={`${pool.count} kabul edilmiş, uygulanmamış öneri${pool.buckets[2].count ? ` · ${pool.buckets[2].count} tanesi 90+ gün` : ""}`} />
        <KpiCard label={`Doğrulanmış Gerçek Kazanç (${base})`} value={Math.round(verifiedActualBase).toLocaleString("tr-TR")} icon={BadgeCheck} tone="teal" hint={verifiedExcluded > 0 ? `${verifiedExcluded} kayıt çevrilemeyen para birimiyle, toplama dahil değil` : "Uygulama sonrası Kurul tarafından doğrulanan"} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Gauge label="Kabul Edilen Öneri Oranı" hint={`${acceptedCount} / ${decided.length} karar verilen öneri`} value={acceptanceRate} color="#3b82f6" />
        <Gauge label="Katılım Oranı" hint={`${participants} / ${personnel.length} personel`} value={participationRate} color="#00A280" />
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={Lightbulb} title="Seçili filtrelerle öneri bulunamadı" /></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Kaizen Sayısı / Ay">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" tick={TICK} /><YAxis allowDecimals={false} tick={TICK} /><Tooltip /><Legend />
                  <Bar dataKey="approved" name="Onaylandı" stackId="s" fill={BUCKET.approved} /><Bar dataKey="pending" name="Onay Bekliyor" stackId="s" fill={BUCKET.pending} /><Bar dataKey="rejected" name="Reddedildi" stackId="s" fill={BUCKET.rejected} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Departman Bazında Öneri">
              <ResponsiveContainer width="100%" height={300}>
                <Treemap data={byDepartment} dataKey="size" stroke="#fff" content={<TreemapCell />} />
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Kaizen Sayısı / Kişi (ilk 20)">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={byPerson}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ ...TICK, fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={80} /><YAxis allowDecimals={false} tick={TICK} /><Tooltip /><Legend />
                  <Bar dataKey="approved" name="Onaylandı" stackId="s" fill={BUCKET.approved} /><Bar dataKey="pending" name="Onay Bekliyor" stackId="s" fill={BUCKET.pending} /><Bar dataKey="rejected" name="Reddedildi" stackId="s" fill={BUCKET.rejected} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="İyileştirme Kategori Oranları">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart><Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} label={({ name, percent }: any) => `${name} ${Math.round((percent || 0) * 100)}%`}>
                  {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Durum Analizi">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byStatus}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={TICK} /><YAxis allowDecimals={false} tick={TICK} /><Tooltip />
                  <Bar dataKey="count" name="Öneri" radius={[6, 6, 0, 0]}>{byStatus.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={`Finansal Etki (aylık, tahmini kazanç ${base})`}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={byMonth}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" tick={TICK} /><YAxis tick={TICK} /><Tooltip /><Legend />
                  <Line type="monotone" dataKey="saving" name={`Tahmini Kazanç (${base})`} stroke="#00A280" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <ChartCard title="Lider Panosu" className="xl:col-span-2">
              <ul className="divide-y divide-slate-100">
                {leaderboard.map((row, i) => (
                  <li key={row.name} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 text-center font-black ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-slate-300"}`}>{i < 3 ? <Trophy className="w-5 h-5 inline" /> : i + 1}</span>
                      <div><p className="text-sm font-bold text-slate-800">{row.name}</p><p className="text-xs text-slate-500">{row.department || "—"}</p></div>
                    </div>
                    <div className="text-right"><p className="text-sm font-black text-slate-900 tabular-nums">{row.points} puan</p><p className="text-xs text-slate-500">{row.count} öneri</p></div>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title="İSG / Çevre / Motivasyon">
              <div className="space-y-3">
                <Flag icon={ShieldAlert} label="İSG" value={flagCounts.isg} cls="text-red-600 bg-red-50" />
                <Flag icon={Leaf} label="Çevre" value={flagCounts.cevre} cls="text-emerald-700 bg-emerald-50" />
                <Flag icon={Sparkles} label="Motivasyon" value={flagCounts.motivasyon} cls="text-amber-600 bg-amber-50" />
              </div>
            </ChartCard>
          </div>

          <Card padded={false} className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-black text-slate-900">Personel Bazlı Kaizen Puan Tablosu</h3></div>
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead className={theadCls}><tr>
                  <th className={thCls}>Ad Soyad</th><th className={thCls}>Bölüm</th><th className={thCls}>Görev</th><th className={thCls}>Tarih</th><th className={thCls}>Sınıf</th><th className={thCls}>Durum</th><th className={thCls}>Kontrol Tarihi</th><th className={`${thCls} text-right`}>Tahmini Getiri</th><th className={`${thCls} text-right`}>Gerçek Getiri</th><th className={`${thCls} text-right`}>Puan</th><th className={thCls}>Tamamlanma</th>
                </tr></thead>
                <tbody>{detailRows.map(s => {
                  const e = evaluationBySuggestion.get(s.id);
                  const impl = implBySuggestion.get(s.id);
                  return (
                    <tr key={s.id} className={trCls}>
                      <td className={`${tdCls} font-semibold text-slate-900`}>{s.personnelName}</td><td className={tdCls}>{s.personnelDepartment}</td><td className={tdCls}>{s.personnelJobTitle}</td>
                      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>{(s.createdAt || "").slice(0, 10)}</td><td className={tdCls}>{(s.suggestionTypes || []).join(", ")}</td><td className={tdCls}>{statusLabel(s.approvalStatus, s.requiredStages, s.feasibility?.status === "open")}</td>
                      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>{e?.createdAt ? e.createdAt.slice(0, 10) : "—"}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{e?.estimatedIncome ? `${e.estimatedIncome.toLocaleString("tr-TR")} ${e.estimatedIncomeCurrency}` : "—"}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{impl && impl.verification?.status === "Doğrulandı" ? `${impl.actualSaving.toLocaleString("tr-TR")} ${impl.actualSavingCurrency}` : "—"}</td>
                      <td className={`${tdCls} text-right font-bold tabular-nums`}>{e?.point ?? "—"}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>{impl ? `${impl.status}${actionProgress(impl).total ? ` · ${actionProgress(impl).done}/${actionProgress(impl).total}` : ""}` : s.completed ? "Uygulandı" : "—"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <Card className={className}><h3 className="font-black text-slate-900 mb-4">{title}</h3>{children}</Card>;
}

function Flag({ icon: Icon, label, value, cls }: { icon: any; label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-xl p-4 flex items-center gap-4 ${cls}`}>
      <Icon className="w-7 h-7 shrink-0" />
      <div><p className="text-2xl font-black tabular-nums leading-none">{value}</p><p className="text-sm font-semibold mt-1 opacity-80">{label}</p></div>
    </div>
  );
}

function Gauge({ label, hint, value, color }: { label: string; hint: string; value: number; color: string }) {
  return (
    <Card className="flex items-center gap-5">
      <div className="relative w-28 h-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value, fill: color }]} startAngle={90} endAngle={-270} barSize={12}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={6} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-black text-slate-900 tabular-nums">%{value}</span></div>
      </div>
      <div><p className="text-sm font-bold text-slate-900">{label}</p><p className="text-sm text-slate-500 mt-1">{hint}</p></div>
    </Card>
  );
}

function TreemapCell(props: any) {
  const { x, y, width, height, name, size, fill } = props;
  if (!name || width < 4 || height < 4) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 70 && height > 40 && (
        <>
          <text x={x + 10} y={y + 22} fill="#fff" fontSize={13} fontWeight={700}>{name}</text>
          <text x={x + 10} y={y + 40} fill="#fff" fontSize={12} opacity={0.85}>{size} öneri</text>
        </>
      )}
    </g>
  );
}
