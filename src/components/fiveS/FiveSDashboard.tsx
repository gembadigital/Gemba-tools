import React, { useMemo } from "react";
import { ClipboardCheck, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { FiveSDepartment, FiveSArea, FiveSPersonnel, FiveSAuditHeader, FiveSTeamAssignment, FiveSAuditAnswer, FiveSAuditResult, GembaWalkFinding, FIVE_S_LEVELS } from "./fiveSTypes";

interface FiveSDashboardProps {
  departments: FiveSDepartment[];
  areas: FiveSArea[];
  personnel: FiveSPersonnel[];
  audits: FiveSAuditHeader[];
  teamAssignments: FiveSTeamAssignment[];
  answers: FiveSAuditAnswer[];
  results: FiveSAuditResult[];
  gembaWalkFindings: GembaWalkFinding[];
}

const STATUS_COLORS: Record<string, string> = {
  "Açık": "#dc2626",
  "Devam Ediyor": "#d97706",
  "Kapalı": "#059669",
  "Başlanmadı": "#94a3b8",
  "Tamamlandı": "#059669"
};

export default function FiveSDashboard({ departments, areas, personnel, audits, teamAssignments, answers, results, gembaWalkFindings }: FiveSDashboardProps) {
  const completedAudits = audits.filter(a => a.status === "Tamamlandı" && a.overallScore !== null).sort((a, b) => a.auditNo - b.auditNo);

  const deptScores = departments.map(d => {
    const deptAreaIds = new Set(areas.filter(a => a.departmentId === d.id).map(a => a.id));
    const deptResults = results.filter(r => deptAreaIds.has(r.areaId));
    const avg = deptResults.length > 0 ? deptResults.reduce((s, r) => s + r.score, 0) / deptResults.length : 0;
    return { name: d.name, avg: Math.round(avg * 100) / 100 };
  }).filter(d => d.avg > 0);

  const levelScores = FIVE_S_LEVELS.map(l => {
    const levelResults = results.filter(r => r.level === l.code);
    const avg = levelResults.length > 0 ? levelResults.reduce((s, r) => s + r.score, 0) / levelResults.length : 0;
    return { code: l.code, label: l.label, avg: Math.round(avg * 100) / 100, count: levelResults.length };
  });

  const auditStatusBreakdown = useMemo(() => {
    return ["Başlanmadı", "Devam Ediyor", "Tamamlandı"].map(s => ({ status: s, count: audits.filter(a => a.status === s).length }));
  }, [audits]);
  const auditStatusTotal = audits.length;

  const actionStatusBreakdown = useMemo(() => {
    const auditActions = answers.filter(a => a.actionStatus !== "Aksiyon Yok").map(a => a.actionStatus as string);
    const gembaActions = gembaWalkFindings.map(f => f.status);
    const all = [...auditActions, ...gembaActions];
    return ["Açık", "Devam Ediyor", "Kapalı"].map(s => ({ status: s, count: all.filter(v => v === s).length }));
  }, [answers, gembaWalkFindings]);
  const actionTotal = actionStatusBreakdown.reduce((s, r) => s + r.count, 0);

  const gembaCategoryBreakdown = useMemo(() => {
    const categories = Array.from(new Set(gembaWalkFindings.map(f => f.problemCategory)));
    return categories.map(c => ({ category: c, count: gembaWalkFindings.filter(f => f.problemCategory === c).length }))
      .sort((a, b) => b.count - a.count);
  }, [gembaWalkFindings]);
  const gembaTotal = gembaWalkFindings.length;

  const auditorLeaderboard = useMemo(() => {
    return personnel.filter(p => p.isAuditor || p.isAdmin).map(p => {
      const myAssignments = teamAssignments.filter(t => t.auditorName === p.name);
      const scoredLevels = myAssignments.reduce((sum, t) => sum + results.filter(r => r.auditId === t.auditId && r.areaId === t.areaId).length, 0);
      return { name: p.name, scoredLevels };
    }).filter(a => a.scoredLevels > 0).sort((a, b) => b.scoredLevels - a.scoredLevels);
  }, [personnel, teamAssignments, results]);

  const overallAvg = results.length > 0 ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 100) / 100 : null;
  const activeActionCount = actionStatusBreakdown.filter(s => s.status !== "Kapalı").reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardCheck} label="Toplam Denetim" value={audits.length} color="text-slate-800" />
        <KpiCard icon={CheckCircle2} label="Tamamlanan Denetim" value={completedAudits.length} color="text-emerald-600" />
        <KpiCard icon={AlertTriangle} label="Aktif Aksiyon (Tüm Ekip)" value={activeActionCount} color="text-red-600" />
        <KpiCard icon={TrendingUp} label="Genel Ortalama Puan" value={overallAvg !== null ? `${overallAvg}/5` : "-"} color="text-sky-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-black text-xs uppercase text-slate-700 mb-3">Bölüm Bazlı Ortalama Puan (1-5)</h3>
          {deptScores.length === 0 && <p className="text-xs text-slate-400">Henüz puanlanmış sonuç yok.</p>}
          <div className="space-y-2.5">
            {deptScores.map(d => (
              <div key={d.name}>
                <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>{d.name}</span><span>{d.avg}/5</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(d.avg / 5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-black text-xs uppercase text-slate-700 mb-3">5S Seviyesi Bazlı Ortalama Puan</h3>
          {levelScores.every(l => l.count === 0) ? (
            <p className="text-xs text-slate-400">Henüz puanlanmış sonuç yok.</p>
          ) : (
            <div className="space-y-2.5">
              {levelScores.map(l => (
                <div key={l.code}>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>{l.code}</span><span>{l.count > 0 ? `${l.avg}/5` : "—"}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-600 rounded-full" style={{ width: `${(l.avg / 5) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-black text-xs uppercase text-slate-700 mb-3">Denetim Durumu Dağılımı</h3>
          {auditStatusTotal === 0 ? (
            <p className="text-xs text-slate-400">Henüz denetim yok.</p>
          ) : (
            <StackedBar breakdown={auditStatusBreakdown} total={auditStatusTotal} colors={STATUS_COLORS} />
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-black text-xs uppercase text-slate-700 mb-3">Aksiyon Durumu Dağılımı (5S + Gemba Walk)</h3>
          {actionTotal === 0 ? (
            <p className="text-xs text-slate-400">Henüz aksiyon kaydı yok.</p>
          ) : (
            <StackedBar breakdown={actionStatusBreakdown} total={actionTotal} colors={STATUS_COLORS} />
          )}
        </div>
      </div>

      {completedAudits.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-black text-xs uppercase text-slate-700 mb-3">Genel Puan Trendi (Tamamlanan Denetimler)</h3>
          <ScoreTrendChart audits={completedAudits} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-black text-xs uppercase text-slate-700 mb-3">Gemba Walk Problem Kategorisi Dağılımı</h3>
          {gembaTotal === 0 ? (
            <p className="text-xs text-slate-400">Henüz Gemba Walk kaydı yok.</p>
          ) : (
            <div className="space-y-2">
              {gembaCategoryBreakdown.map(c => (
                <div key={c.category}>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>{c.category}</span><span>{c.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(c.count / gembaTotal) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-black text-xs uppercase text-slate-700 mb-3">Denetçi Performans Sıralaması</h3>
          {auditorLeaderboard.length === 0 ? (
            <p className="text-xs text-slate-400">Henüz puanlama yapan denetçi yok.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
                  <th className="py-1.5">Denetçi</th><th>Puanlanan S-Seviyesi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditorLeaderboard.map(a => (
                  <tr key={a.name}>
                    <td className="py-1.5 font-bold">{a.name}</td>
                    <td>{a.scoredLevels}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <p className={`text-xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function StackedBar({ breakdown, total, colors }: { breakdown: { status: string; count: number }[]; total: number; colors: Record<string, string> }) {
  return (
    <>
      <div className="h-3 w-full rounded-full overflow-hidden flex">
        {breakdown.filter(s => s.count > 0).map(s => (
          <div key={s.status} style={{ width: `${(s.count / total) * 100}%`, backgroundColor: colors[s.status] }} className="h-full" />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2.5 text-[11px] font-bold">
        {breakdown.map(s => (
          <span key={s.status} className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: colors[s.status] }} />
            <span className="text-slate-600">{s.status}: {s.count}</span>
          </span>
        ))}
      </div>
    </>
  );
}

// Minimal dependency-free line chart: thin 2px stroke, rounded data-end marker on the last
// point, recessive baseline — deliberately simple given this is a single-series trend.
function ScoreTrendChart({ audits }: { audits: { auditNo: number; overallScore: number | null }[] }) {
  const width = 600;
  const height = 120;
  const padding = 20;
  const max = 5;
  const min = 0;
  const points = audits.map((a, i) => {
    const x = padding + (i / Math.max(audits.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (((a.overallScore || 0) - min) / (max - min)) * (height - padding * 2);
    return { x, y, auditNo: a.auditNo, score: a.overallScore };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth={1} />
      <path d={path} fill="none" stroke="#059669" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={i === points.length - 1 ? 4 : 3} fill="#059669" />
          {(i === points.length - 1 || i === 0) && (
            <text x={p.x} y={p.y - 8} fontSize="10" fontWeight="700" fill="#334155" textAnchor="middle">{p.score}</text>
          )}
        </g>
      ))}
    </svg>
  );
}
