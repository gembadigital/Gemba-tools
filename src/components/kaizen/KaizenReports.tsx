import React, { useMemo } from "react";
import { Download } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { KaizenSuggestion, KaizenEvaluation } from "./kaizenTypes";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS } from "./kaizenCalc";
import { KaizenApi } from "./KaizenSuggestionSystem";

// Native replacement for the legacy app's embedded Power BI tile (Reports.pa.yaml) — that report's
// actual content lived entirely inside an external Power BI workspace and isn't recoverable from
// the .msapp package, so this rebuilds the same kind of KPI/status/category breakdown using
// recharts (already a dependency, same pattern as the other modules' dashboards).
interface Props {
  suggestions: KaizenSuggestion[];
  evaluations: KaizenEvaluation[];
  api: KaizenApi;
}

const COLORS = ["#0f172a", "#3b82f6", "#00A280", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function KaizenReports({ suggestions, evaluations }: Props) {
  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    suggestions.forEach(s => { counts[s.approvalStatus] = (counts[s.approvalStatus] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, label: APPROVAL_STATUS_LABELS[status as keyof typeof APPROVAL_STATUS_LABELS] || status, count }));
  }, [suggestions]);

  const byDepartment = useMemo(() => {
    const counts: Record<string, number> = {};
    suggestions.forEach(s => { const d = s.personnelDepartment || "Belirtilmemiş"; counts[d] = (counts[d] || 0) + 1; });
    return Object.entries(counts).map(([department, count]) => ({ department, count }));
  }, [suggestions]);

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    suggestions.forEach(s => (s.suggestionTypes || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [suggestions]);

  const totalSaving = suggestions.reduce((sum, s) => sum + (s.estimatedSaving || 0), 0);
  const totalPoints = evaluations.reduce((sum, e) => sum + (e.point || 0), 0);
  const completedCount = suggestions.filter(s => s.completed).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Toplam Öneri" value={suggestions.length} />
        <StatCard label="Tamamlanan" value={completedCount} />
        <StatCard label="Toplam Kazanç Puanı" value={totalPoints} />
        <StatCard label="Tahmini Toplam Kazanç" value={totalSaving.toLocaleString("tr-TR")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-black text-xs uppercase text-slate-700 mb-3">Durum Dağılımı</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-black text-xs uppercase text-slate-700 mb-3">Bölüme Göre Öneri Sayısı</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byDepartment}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 lg:col-span-2">
          <h3 className="font-black text-xs uppercase text-slate-700 mb-3">Öneri Sınıfı Dağılımı</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex justify-end">
        <a href="/api/business/kaizen/suggestions/export-excel" className="px-3 py-2 rounded-lg text-xs font-black bg-slate-100 text-slate-700 flex items-center space-x-1.5 cursor-pointer hover:bg-slate-200">
          <Download className="w-3.5 h-3.5" /><span>Excel Raporu İndir</span>
        </a>
      </div>
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
