import React, { useMemo, useState } from "react";
import { Download, ShieldAlert, Leaf, Sparkles } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { KaizenSuggestion, KaizenEvaluation, ApprovalStatus } from "./kaizenTypes";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS, SUGGESTION_TYPE_OPTIONS } from "./kaizenCalc";
import { KaizenApi } from "./KaizenSuggestionSystem";

// Native replacement for the legacy app's embedded Power BI tile (Reports.pa.yaml) — that report's
// actual content lived entirely inside an external Power BI workspace and isn't recoverable from
// the .msapp package. The legacy report was described as a set of indicators grouped by topic
// (durum, bölüm, kategori, finansal etki, İSG/Çevre/Motivasyon) behind a shared filter bar — this
// rebuilds that same grouping with recharts (already a dependency) and real, wired-up filters
// instead of a static embed.
interface Props {
  suggestions: KaizenSuggestion[];
  evaluations: KaizenEvaluation[];
  api: KaizenApi;
}

const ALL = "__ALL__";
const COLORS = ["#0f172a", "#3b82f6", "#00A280", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];

export default function KaizenReports({ suggestions, evaluations }: Props) {
  const [fDepartment, setFDepartment] = useState(ALL);
  const [fType, setFType] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const departments = useMemo(
    () => Array.from(new Set(suggestions.map(s => s.personnelDepartment).filter(Boolean))).sort(),
    [suggestions]
  );

  const filtered = useMemo(() => suggestions.filter(s => {
    if (fDepartment !== ALL && s.personnelDepartment !== fDepartment) return false;
    if (fType !== ALL && !(s.suggestionTypes || []).includes(fType)) return false;
    if (fStatus !== ALL && s.approvalStatus !== fStatus) return false;
    const created = (s.createdAt || "").slice(0, 10);
    if (fFrom && created < fFrom) return false;
    if (fTo && created > fTo) return false;
    return true;
  }), [suggestions, fDepartment, fType, fStatus, fFrom, fTo]);

  const filteredIds = useMemo(() => new Set(filtered.map(s => s.id)), [filtered]);
  const filteredEvaluations = useMemo(() => evaluations.filter(e => filteredIds.has(e.suggestionId)), [evaluations, filteredIds]);

  const resetFilters = () => { setFDepartment(ALL); setFType(ALL); setFStatus(ALL); setFFrom(""); setFTo(""); };

  // ---- Topic: Genel Özet ----
  const totalSaving = filtered.reduce((sum, s) => sum + (s.estimatedSaving || 0), 0);
  const totalPoints = filteredEvaluations.reduce((sum, e) => sum + (e.point || 0), 0);
  const completedCount = filtered.filter(s => s.completed).length;

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

  // ---- Topic: Finansal Etki (aylık trend) ----
  const monthlyTrend = useMemo(() => {
    const byMonth: Record<string, { month: string; count: number; saving: number }> = {};
    filtered.forEach(s => {
      const month = (s.createdAt || "").slice(0, 7); // YYYY-MM
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

  const exportUrl = "/api/business/kaizen/suggestions/export-excel";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-xs uppercase text-slate-700">Filtreler</h3>
          <button onClick={resetFilters} className="text-[10px] font-black text-slate-400 hover:text-slate-700 cursor-pointer">Filtreleri Sıfırla</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
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

      {/* Topic: İSG / Çevre / Motivasyon */}
      <TopicSection title="İSG / Çevre / Motivasyon Dağılımı">
        <div className="grid grid-cols-3 gap-3">
          <FlagCard icon={ShieldAlert} label="İş Sağlığı ve Güvenliği" value={flagCounts.isg} color="text-red-600 bg-red-50" />
          <FlagCard icon={Leaf} label="Çevre" value={flagCounts.cevre} color="text-emerald-700 bg-emerald-50" />
          <FlagCard icon={Sparkles} label="Motivasyon" value={flagCounts.motivasyon} color="text-amber-600 bg-amber-50" />
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
