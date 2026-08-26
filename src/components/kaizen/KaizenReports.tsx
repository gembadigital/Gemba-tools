import React, { useMemo, useState } from "react";
import { Download, ShieldAlert, Leaf, Sparkles, Trophy } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadialBarChart, RadialBar, PolarAngleAxis
} from "recharts";
import { KaizenSuggestion, KaizenEvaluation, KaizenPersonnel, ApprovalStatus } from "./kaizenTypes";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS, SUGGESTION_TYPE_OPTIONS, STAGE_OPTIONS } from "./kaizenCalc";
import { KaizenApi } from "./KaizenSuggestionSystem";

// Native replacement for the legacy app's embedded Power BI tile (Reports.pa.yaml). Confirmed
// directly against the live KaizenSuite app's actual Power BI report (its content lives in an
// external Power BI workspace and isn't part of the .msapp package, but the report itself was
// viewable in Power Apps Studio's preview): two pages — a topic-grouped KPI/chart dashboard with a
// 5-filter sidebar (Personel, Departman, Öneri Sınıfı, Öneri Durumu, Öneri Aşaması), and a detailed
// per-suggestion "Personel Bazlı Kaizen Puan Tablosu". Rebuilt here with recharts using the same
// grouping, plus the two rate gauges (Kabul Edilen Öneri Oranı, Katılım Oranı) and the monthly/
// per-person status-stacked breakdowns the real report showed.
interface Props {
  suggestions: KaizenSuggestion[];
  evaluations: KaizenEvaluation[];
  personnel: KaizenPersonnel[];
  api: KaizenApi;
}

const ALL = "__ALL__";
const COLORS = ["#0f172a", "#3b82f6", "#00A280", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];
const STATUS_BUCKET_COLORS = { approved: "#00A280", pending: "#facc15", rejected: "#ef4444" };

function statusBucket(status: ApprovalStatus): "approved" | "pending" | "rejected" {
  if (status === "Pending") return "pending";
  if (status === "Rejected" || status === "Rejected 2nd") return "rejected";
  return "approved";
}

export default function KaizenReports({ suggestions, evaluations, personnel, api }: Props) {
  const [fDepartment, setFDepartment] = useState(ALL);
  const [fType, setFType] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fStage, setFStage] = useState(ALL);
  const [fPersonnel, setFPersonnel] = useState(ALL);
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const departments = useMemo(
    () => Array.from(new Set(suggestions.map(s => s.personnelDepartment).filter(Boolean))).sort(),
    [suggestions]
  );
  const personnelNames = useMemo(
    () => Array.from(new Set(suggestions.map(s => s.personnelName).filter(Boolean))).sort(),
    [suggestions]
  );

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

  // ---- Topic: Genel Özet ----
  const totalSaving = filtered.reduce((sum, s) => sum + (s.estimatedSaving || 0), 0);
  const totalPoints = filteredEvaluations.reduce((sum, e) => sum + (e.point || 0), 0);
  const completedCount = filtered.filter(s => s.completed).length;

  // "Kabul Edilen Öneri Oranı" — of suggestions that have actually been decided (i.e. not still
  // Pending), what share ended up approved. Matches the live report's acceptance-rate gauge.
  const decided = filtered.filter(s => s.approvalStatus !== "Pending");
  const acceptedCount = decided.filter(s => statusBucket(s.approvalStatus) === "approved").length;
  const acceptanceRate = decided.length > 0 ? Math.round((acceptedCount / decided.length) * 100) : 0;

  // "Katılım Oranı" — share of the personnel roster who have submitted at least one suggestion.
  const participants = new Set(filtered.map(s => s.personnelName)).size;
  const participationRate = personnel.length > 0 ? Math.round((participants / personnel.length) * 100) : 0;

  // ---- Topic: Durum Analizi ----
  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(s => { counts[s.approvalStatus] = (counts[s.approvalStatus] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      status, label: APPROVAL_STATUS_LABELS[status as ApprovalStatus] || status, count,
      fill: APPROVAL_STATUS_COLORS[status as ApprovalStatus] || "#64748b"
    }));
  }, [filtered]);

  // ---- Topic: Bölüm Analizi ----
  const byDepartment = useMemo(() => {
    const counts: Record<string, { department: string; total: number; completed: number }> = {};
    filtered.forEach(s => {
      const d = s.personnelDepartment || "Belirtilmemiş";
      if (!counts[d]) counts[d] = { department: d, total: 0, completed: 0 };
      counts[d].total++;
      if (s.completed) counts[d].completed++;
    });
    return Object.values(counts);
  }, [filtered]);

  // ---- Topic: Kategori Analizi ----
  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(s => (s.suggestionTypes || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ---- Topic: Kaizen Sayısı / Ay — monthly count stacked by status bucket ----
  const byMonth = useMemo(() => {
    const buckets: Record<string, { month: string; approved: number; pending: number; rejected: number }> = {};
    filtered.forEach(s => {
      const month = (s.createdAt || "").slice(0, 7);
      if (!month) return;
      if (!buckets[month]) buckets[month] = { month, approved: 0, pending: 0, rejected: 0 };
      buckets[month][statusBucket(s.approvalStatus)]++;
    });
    return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  // ---- Topic: Kaizen Sayısı / Adam — per-person count stacked by status bucket ----
  const byPerson = useMemo(() => {
    const buckets: Record<string, { name: string; approved: number; pending: number; rejected: number }> = {};
    filtered.forEach(s => {
      const name = s.personnelName || "Belirtilmemiş";
      if (!buckets[name]) buckets[name] = { name, approved: 0, pending: 0, rejected: 0 };
      buckets[name][statusBucket(s.approvalStatus)]++;
    });
    return Object.values(buckets);
  }, [filtered]);

  // ---- Topic: Finansal Etki (aylık trend) ----
  const monthlyTrend = useMemo(() => {
    const byMonth: Record<string, { month: string; count: number; saving: number }> = {};
    filtered.forEach(s => {
      const month = (s.createdAt || "").slice(0, 7);
      if (!month) return;
      if (!byMonth[month]) byMonth[month] = { month, count: 0, saving: 0 };
      byMonth[month].count++;
      byMonth[month].saving += s.estimatedSaving || 0;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  // ---- Topic: İSG / Çevre / Motivasyon ----
  const flagCounts = {
    isg: filtered.filter(s => s.isg).length,
    cevre: filtered.filter(s => s.cevre).length,
    motivasyon: filtered.filter(s => s.motivasyon).length
  };

  // ---- Topic: Lider Panosu — en çok öneri veren / en yüksek puanı toplayan kişiler. Legacy
  // uygulamada motivasyon unsuru olarak hiçbir sıralama/ödüllendirme görünürlüğü yoktu. ----
  const leaderboard = useMemo(() => {
    const byPersonMap: Record<string, { name: string; department: string; count: number; points: number }> = {};
    filtered.forEach(s => {
      const name = s.personnelName || "Belirtilmemiş";
      if (!byPersonMap[name]) byPersonMap[name] = { name, department: s.personnelDepartment, count: 0, points: 0 };
      byPersonMap[name].count++;
    });
    filteredEvaluations.forEach(e => {
      const s = filtered.find(x => x.id === e.suggestionId);
      if (!s) return;
      const name = s.personnelName || "Belirtilmemiş";
      if (byPersonMap[name]) byPersonMap[name].points += e.point || 0;
    });
    return Object.values(byPersonMap).sort((a, b) => b.points - a.points || b.count - a.count).slice(0, 10);
  }, [filtered, filteredEvaluations]);

  // ---- Personel Bazlı Kaizen Puan Tablosu ----
  const detailRows = useMemo(
    () => [...filtered].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [filtered]
  );

  const exportUrl = "/api/business/kaizen/suggestions/export-excel";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-xs uppercase text-slate-700">Filtreler</h3>
          <button onClick={resetFilters} className="text-[10px] font-black text-slate-400 hover:text-slate-700 cursor-pointer">Filtreleri Sıfırla</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <select value={fPersonnel} onChange={e => setFPersonnel(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Tüm Personel</option>
            {personnelNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={fDepartment} onChange={e => setFDepartment(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Tüm Bölümler</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={fType} onChange={e => setFType(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Tüm Kategoriler</option>
            {SUGGESTION_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Tüm Durumlar</option>
            {Object.entries(APPROVAL_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={fStage} onChange={e => setFStage(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Tüm Aşamalar</option>
            {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold" placeholder="Başlangıç" />
          <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold" placeholder="Bitiş" />
        </div>
      </div>

      {/* Topic: Genel Özet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Toplam Öneri" value={filtered.length} />
        <StatCard label="Tamamlanan" value={completedCount} />
        <StatCard label="Toplam Kazanç Puanı" value={totalPoints} />
        <StatCard label="Tahmini Toplam Kazanç (TL)" value={totalSaving.toLocaleString("tr-TR")} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GaugeCard label="Kabul Edilen Öneri Oranı" value={acceptanceRate} color="#3b82f6" />
        <GaugeCard label="Katılım Oranı" value={participationRate} color="#00A280" />
      </div>

      {/* Topic: Durum Analizi */}
      <TopicSection title="Durum Analizi">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byStatus}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {byStatus.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </TopicSection>

      {/* Topic: Kaizen Sayısı / Ay */}
      <TopicSection title="Kaizen Sayısı / Ay">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="approved" name="Onaylandı" stackId="s" fill={STATUS_BUCKET_COLORS.approved} />
            <Bar dataKey="pending" name="Onay Bekliyor" stackId="s" fill={STATUS_BUCKET_COLORS.pending} />
            <Bar dataKey="rejected" name="Reddedildi" stackId="s" fill={STATUS_BUCKET_COLORS.rejected} />
          </BarChart>
        </ResponsiveContainer>
      </TopicSection>

      {/* Topic: Kaizen Sayısı / Adam */}
      <TopicSection title="Kaizen Sayısı / Adam">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byPerson}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={70} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="approved" name="Onaylandı" stackId="s" fill={STATUS_BUCKET_COLORS.approved} />
            <Bar dataKey="pending" name="Onay Bekliyor" stackId="s" fill={STATUS_BUCKET_COLORS.pending} />
            <Bar dataKey="rejected" name="Reddedildi" stackId="s" fill={STATUS_BUCKET_COLORS.rejected} />
          </BarChart>
        </ResponsiveContainer>
      </TopicSection>

      {/* Topic: Bölüm Analizi */}
      <TopicSection title="Bölüm Analizi">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byDepartment}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="department" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" name="Toplam Öneri" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="completed" name="Tamamlanan" fill="#00A280" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </TopicSection>

      {/* Topic: Kategori Analizi */}
      <TopicSection title="Kategori Analizi (Öneri Sınıfı)">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ResponsiveContainer>
      </TopicSection>

      {/* Topic: Finansal Etki */}
      <TopicSection title="Finansal Etki (Aylık Trend)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="count" name="Öneri Sayısı" stroke="#3b82f6" strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="saving" name="Tahmini Kazanç (TL)" stroke="#00A280" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </TopicSection>

      {/* Topic: Lider Panosu */}
      <TopicSection title="Lider Panosu">
        <div className="divide-y divide-gray-100 text-xs">
          {leaderboard.map((row, i) => (
            <div key={row.name} className="py-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`w-6 text-center font-black ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-slate-300"}`}>
                  {i < 3 ? <Trophy className="w-4 h-4 inline" /> : i + 1}
                </span>
                <div>
                  <p className="font-bold text-slate-700">{row.name}</p>
                  <p className="text-slate-400">{row.department}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-slate-800">{row.points} puan</p>
                <p className="text-slate-400">{row.count} öneri</p>
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && <p className="text-slate-400 py-2">Kayıt bulunamadı.</p>}
        </div>
      </TopicSection>

      {/* Topic: İSG / Çevre / Motivasyon */}
      <TopicSection title="İSG / Çevre / Motivasyon Dağılımı">
        <div className="grid grid-cols-3 gap-3">
          <FlagCard icon={ShieldAlert} label="ISG" value={flagCounts.isg} color="text-red-600 bg-red-50" />
          <FlagCard icon={Leaf} label="Çevre" value={flagCounts.cevre} color="text-emerald-700 bg-emerald-50" />
          <FlagCard icon={Sparkles} label="Motivasyon" value={flagCounts.motivasyon} color="text-amber-600 bg-amber-50" />
        </div>
      </TopicSection>

      {/* Personel Bazlı Kaizen Puan Tablosu */}
      <TopicSection title="Personel Bazlı Kaizen Puan Tablosu">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
                <th className="py-1.5 pr-2">Ad Soyad</th>
                <th className="pr-2">Bölüm</th>
                <th className="pr-2">Görev</th>
                <th className="pr-2">Öneri Tarihi</th>
                <th className="pr-2">Kategori</th>
                <th className="pr-2">Öneri Durumu</th>
                <th className="pr-2">Öneri Getirisi</th>
                <th>Öneri Puanı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detailRows.map(s => {
                const evalRow = evaluationBySuggestion.get(s.id);
                return (
                  <tr key={s.id}>
                    <td className="py-1.5 pr-2 font-bold">{s.personnelName}</td>
                    <td className="pr-2">{s.personnelDepartment}</td>
                    <td className="pr-2">{s.personnelJobTitle}</td>
                    <td className="pr-2">{(s.createdAt || "").slice(0, 10)}</td>
                    <td className="pr-2">{(s.suggestionTypes || []).join(", ")}</td>
                    <td className="pr-2">{APPROVAL_STATUS_LABELS[s.approvalStatus]}</td>
                    <td className="pr-2">{evalRow?.estimatedIncome ? `${evalRow.estimatedIncome.toLocaleString("tr-TR")} ${evalRow.estimatedIncomeCurrency}` : "-"}</td>
                    <td>{evalRow?.point ?? "-"}</td>
                  </tr>
                );
              })}
              {detailRows.length === 0 && <tr><td colSpan={8} className="text-slate-400 py-3">Kayıt bulunamadı.</td></tr>}
            </tbody>
          </table>
        </div>
      </TopicSection>

      <div className="flex justify-end">
        <a href={exportUrl} className="px-3 py-2 rounded-lg text-xs font-black bg-slate-100 text-slate-700 flex items-center space-x-1.5 cursor-pointer hover:bg-slate-200">
          <Download className="w-3.5 h-3.5" /><span>Excel Raporu İndir</span>
        </a>
      </div>
    </div>
  );
}

function TopicSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="font-black text-xs uppercase text-slate-700 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="text-2xl font-black text-slate-800">{value}</p>
    </div>
  );
}

function FlagCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-4 flex items-center space-x-3 ${color}`}>
      <Icon className="w-6 h-6 shrink-0" />
      <div>
        <p className="text-2xl font-black">{value}</p>
        <p className="text-[10px] font-black uppercase opacity-80">{label}</p>
      </div>
    </div>
  );
}

// Matches the live Power BI report's "Kabul Edilen Öneri Oranı"/"Katılım Oranı" radial gauges.
function GaugeCard({ label, value, color }: { label: string; value: number; color: string }) {
  const data = [{ value, fill: color }];
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center space-x-4">
      <div className="relative w-28 h-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            width={112} height={112} innerRadius="70%" outerRadius="100%"
            data={data} startAngle={90} endAngle={-270} barSize={12}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={6} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black text-slate-800">%{value}</span>
        </div>
      </div>
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
    </div>
  );
}
