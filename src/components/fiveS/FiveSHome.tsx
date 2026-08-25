import React, { useMemo } from "react";
import { ClipboardCheck, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { FiveSDepartment, FiveSArea, FiveSPersonnel, FiveSAuditHeader, FiveSTeamAssignment, FiveSAuditAnswer, FiveSAuditResult, GembaWalkFinding, FiveSPersonalActionRow } from "./fiveSTypes";
import { personalActionStatus } from "./fiveSCalc";

interface FiveSHomeProps {
  currentUser: any;
  departments: FiveSDepartment[];
  areas: FiveSArea[];
  personnel: FiveSPersonnel[];
  audits: FiveSAuditHeader[];
  teamAssignments: FiveSTeamAssignment[];
  answers: FiveSAuditAnswer[];
  results: FiveSAuditResult[];
  gembaWalkFindings: GembaWalkFinding[];
}

export default function FiveSHome({ currentUser, areas, personnel, audits, results, answers, gembaWalkFindings }: FiveSHomeProps) {
  const myName = currentUser?.full_name;

  const personalActions: FiveSPersonalActionRow[] = useMemo(() => {
    const fromAudits: FiveSPersonalActionRow[] = answers
      .filter(a => a.actionStatus !== "Aksiyon Yok")
      .filter(a => areas.find(ar => ar.id === a.areaId)?.responsible === myName)
      .map(a => {
        const area = areas.find(ar => ar.id === a.areaId);
        return {
          source: "5S Audit" as const,
          date: audits.find(au => au.id === a.auditId)?.date || "",
          areaName: area?.name || "-",
          category: a.actionStatus,
          action: a.action,
          actionStatus: a.actionStatus,
          dueDate: a.dueDate,
          completedDate: a.completedDate,
          status: personalActionStatus(a.dueDate, a.completedDate)
        };
      });
    const fromGemba: FiveSPersonalActionRow[] = gembaWalkFindings
      .filter(f => f.responsible === myName)
      .map(f => ({
        source: "Gemba Walk" as const,
        date: f.problemDate,
        areaName: areas.find(a => a.id === f.areaId)?.name || "-",
        category: f.problemCategory,
        action: f.action,
        actionStatus: f.status,
        dueDate: f.dueDate,
        completedDate: f.completedDate,
        status: personalActionStatus(f.dueDate, f.completedDate)
      }));
    return [...fromAudits, ...fromGemba];
  }, [answers, areas, audits, gembaWalkFindings, myName]);

  const personalKpi = {
    total: personalActions.length,
    open: personalActions.filter(r => r.actionStatus === "Açık").length,
    inProgress: personalActions.filter(r => r.actionStatus === "Devam Ediyor").length,
    closed: personalActions.filter(r => r.actionStatus === "Kapalı").length
  };

  const teamSummary = useMemo(() => personnel.map(p => {
    const myAreas = areas.filter(a => a.responsible === p.name);
    const areaIds = new Set(myAreas.map(a => a.id));
    const touchedAuditIds = new Set(results.filter(r => areaIds.has(r.areaId)).map(r => r.auditId));
    const touchedAudits = audits.filter(a => touchedAuditIds.has(a.id));
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      department: p.department,
      areaNames: myAreas.map(a => a.name).join(", ") || "-",
      completed: touchedAudits.filter(a => a.status === "Tamamlandı").length,
      open: touchedAudits.filter(a => a.status !== "Tamamlandı").length
    };
  }), [personnel, areas, results, audits]);

  const completedAudits = audits.filter(a => a.status === "Tamamlandı" && a.overallScore !== null).sort((a, b) => a.auditNo - b.auditNo);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardCheck} label="Toplam Denetim" value={audits.length} color="text-slate-800" />
        <KpiCard icon={CheckCircle2} label="Tamamlanan Denetim" value={completedAudits.length} color="text-emerald-600" />
        <KpiCard icon={AlertTriangle} label="Açık Kişisel Aksiyon" value={personalKpi.open} color="text-red-600" />
        <KpiCard icon={TrendingUp} label="Son Denetim Puanı" value={completedAudits.length > 0 ? `${completedAudits[completedAudits.length - 1].overallScore}/5` : "-"} color="text-sky-600" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-black text-xs uppercase text-slate-700 mb-3">Kişisel Aksiyonlarım ({personalKpi.total})</h3>
        <div className="flex space-x-4 text-[11px] font-bold text-slate-500 mb-2">
          <span>Açık: <span className="text-red-600">{personalKpi.open}</span></span>
          <span>Devam Eden: <span className="text-amber-600">{personalKpi.inProgress}</span></span>
          <span>Kapalı: <span className="text-emerald-600">{personalKpi.closed}</span></span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
              <th className="py-1.5">Kaynak</th><th>Tarih</th><th>Alan</th><th>Aksiyon</th><th>Durum</th><th>Termin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {personalActions.map((r, i) => (
              <tr key={i}>
                <td className="py-2 font-bold">{r.source}</td>
                <td>{r.date}</td>
                <td>{r.areaName}</td>
                <td className="max-w-[220px] truncate" title={r.action}>{r.action}</td>
                <td>{r.actionStatus}</td>
                <td>
                  <span className={`inline-flex items-center space-x-1.5 ${
                    r.status === 2 ? "text-emerald-600" : r.status === 1 ? "text-slate-600" : "text-red-600"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      r.status === 2 ? "bg-emerald-500" : r.status === 1 ? "bg-slate-400" : "bg-red-500"
                    }`} />
                    <span>{r.dueDate || "-"}</span>
                  </span>
                </td>
              </tr>
            ))}
            {personalActions.length === 0 && <tr><td colSpan={6} className="text-slate-400 py-2">Size atanmış açık bir aksiyon bulunmuyor.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-black text-xs uppercase text-slate-700 mb-2">Ekip &amp; Alan Özeti</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
              <th className="py-1.5">Ad</th><th>Görev</th><th>Bölüm</th><th>Sorumlu Olduğu Alanlar</th><th>Tamamlanan Denetim</th><th>Açık Denetim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {teamSummary.map(t => (
              <tr key={t.id}>
                <td className="py-2 font-bold">{t.name}</td>
                <td>{t.role}</td>
                <td>{t.department}</td>
                <td>{t.areaNames}</td>
                <td>{t.completed}</td>
                <td>{t.open}</td>
              </tr>
            ))}
            {teamSummary.length === 0 && <tr><td colSpan={6} className="text-slate-400 py-2">Henüz personel kaydı yok.</td></tr>}
          </tbody>
        </table>
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
