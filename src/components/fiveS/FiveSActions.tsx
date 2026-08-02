import React, { useState, useMemo } from "react";
import { CheckCircle, XCircle, Filter, X, Save, Mail } from "lucide-react";
import { FiveSDepartment, FiveSArea, FiveSQuestion, FiveSAuditHeader, FiveSTeamAssignment, FiveSAuditAnswer, FiveSActionRow, ActionStatus } from "./fiveSTypes";
import { isOnTime, ACTION_STATUS_OPTIONS } from "./fiveSCalc";
import { FiveSApi } from "./FiveSAuditSystem";

interface Crud<T> {
  save: (record: Partial<T> & { id?: string }) => Promise<any>;
  remove: (id: string) => Promise<any>;
}

interface FiveSActionsProps {
  departments: FiveSDepartment[];
  areas: FiveSArea[];
  questions: FiveSQuestion[];
  audits: FiveSAuditHeader[];
  teamAssignments: FiveSTeamAssignment[];
  answers: FiveSAuditAnswer[];
  currentUser: any;
  isFiveSAdmin: boolean;
  answersCrud: Crud<FiveSAuditAnswer>;
  api: FiveSApi;
  showToast: (msg: string) => void;
}

const ALL = "__ALL__";

export default function FiveSActions({
  departments, areas, questions, audits, teamAssignments, answers, currentUser, isFiveSAdmin, answersCrud, api, showToast
}: FiveSActionsProps) {
  const rows: FiveSActionRow[] = useMemo(() => answers
    .filter(a => a.actionStatus !== "Aksiyon Yok")
    .map(a => {
      const question = questions.find(q => q.id === a.questionId);
      const area = areas.find(ar => ar.id === a.areaId);
      const dept = departments.find(d => d.id === area?.departmentId);
      const audit = audits.find(au => au.id === a.auditId);
      const assignment = teamAssignments.find(t => t.auditId === a.auditId && t.areaId === a.areaId);
      return {
        answerId: a.id,
        auditId: a.auditId,
        auditNo: audit?.auditNo || 0,
        auditDate: audit?.date || "",
        departmentId: area?.departmentId || "",
        departmentName: dept?.name || "-",
        areaId: a.areaId,
        areaName: area?.name || "-",
        category: question ? `${question.questionNo}/${question.level}` : "-",
        action: a.action,
        actionStatus: a.actionStatus,
        dueDate: a.dueDate,
        completedDate: a.completedDate,
        auditorName: assignment?.auditorName || "-",
        ownerName: area?.responsible || "-",
        onTime: isOnTime(a.dueDate, a.completedDate)
      };
    }), [answers, questions, areas, departments, audits, teamAssignments]);

  const [fAuditNo, setFAuditNo] = useState(ALL);
  const [fDept, setFDept] = useState(ALL);
  const [fArea, setFArea] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fAuditor, setFAuditor] = useState(ALL);
  const [fOwner, setFOwner] = useState(ALL);

  const uniq = (vals: (string | number)[]) => Array.from(new Set(vals)).filter(v => v !== "" && v !== "-");

  const filtered = rows.filter(r =>
    (fAuditNo === ALL || String(r.auditNo) === fAuditNo) &&
    (fDept === ALL || r.departmentName === fDept) &&
    (fArea === ALL || r.areaName === fArea) &&
    (fStatus === ALL || r.actionStatus === fStatus) &&
    (fAuditor === ALL || r.auditorName === fAuditor) &&
    (fOwner === ALL || r.ownerName === fOwner)
  );

  const resetFilters = () => { setFAuditNo(ALL); setFDept(ALL); setFArea(ALL); setFStatus(ALL); setFAuditor(ALL); setFOwner(ALL); };

  const [editing, setEditing] = useState<FiveSActionRow | null>(null);
  const [draft, setDraft] = useState<{ action: string; actionStatus: ActionStatus; dueDate: string; completedDate: string }>({ action: "", actionStatus: "Açık", dueDate: "", completedDate: "" });

  const canEdit = (r: FiveSActionRow) => isFiveSAdmin || r.auditorName === currentUser?.full_name || r.ownerName === currentUser?.full_name;

  const openEdit = (r: FiveSActionRow) => {
    setEditing(r);
    setDraft({ action: r.action, actionStatus: r.actionStatus, dueDate: r.dueDate || "", completedDate: r.completedDate || "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    await answersCrud.save({
      id: editing.answerId,
      action: draft.action,
      actionStatus: draft.actionStatus,
      dueDate: draft.dueDate || null,
      completedDate: draft.completedDate || null
    });
    setEditing(null);
  };

  const kpi = {
    total: rows.length,
    open: rows.filter(r => r.actionStatus === "Açık").length,
    inProgress: rows.filter(r => r.actionStatus === "Devam Ediyor").length,
    closed: rows.filter(r => r.actionStatus === "Kapalı").length
  };

  // "Rapor Gönder" mirrors the legacy Aksiyon Listesi behavior — send that Denetim No's audit
  // report by email — available once the Denetim No filter narrows the list to one audit.
  const selectedAudit = fAuditNo !== ALL ? audits.find(a => String(a.auditNo) === fAuditNo) : null;
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const sendReport = async () => {
    if (!selectedAudit) return;
    if (!recipientEmail || !recipientEmail.includes("@")) {
      showToast("Lütfen geçerli bir alıcı e-posta adresi girin.");
      return;
    }
    setSending(true);
    const res = await api.post(`audits/${selectedAudit.id}/send-report`, { recipientEmail });
    setSending(false);
    if (res.success) showToast(`Denetim No ${selectedAudit.auditNo} raporu ${recipientEmail} adresine gönderildi.`);
    else showToast(`Hata: ${res.error || "Rapor gönderilemedi."}`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Toplam", value: kpi.total, color: "text-slate-800" },
          { label: "Açık", value: kpi.open, color: "text-red-600" },
          { label: "Devam Eden", value: kpi.inProgress, color: "text-amber-600" },
          { label: "Kapalı", value: kpi.closed, color: "text-emerald-600" }
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-3.5">
            <p className="text-[10px] font-black uppercase text-slate-400">{c.label}</p>
            <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-xs uppercase text-slate-700 flex items-center space-x-1.5"><Filter className="w-3.5 h-3.5" /><span>Filtreler</span></h3>
          <button onClick={resetFilters} className="text-[10px] font-black text-slate-400 hover:text-slate-700 cursor-pointer">Filtreleri Sıfırla</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          <select value={fAuditNo} onChange={e => setFAuditNo(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Denetim No</option>
            {uniq(rows.map(r => r.auditNo)).sort((a, b) => Number(a) - Number(b)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fDept} onChange={e => setFDept(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Bölüm</option>
            {uniq(rows.map(r => r.departmentName)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fArea} onChange={e => setFArea(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Alan</option>
            {uniq(rows.map(r => r.areaName)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Durum</option>
            {ACTION_STATUS_OPTIONS.filter(s => s !== "Aksiyon Yok").map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fAuditor} onChange={e => setFAuditor(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Denetçi</option>
            {uniq(rows.map(r => r.auditorName)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fOwner} onChange={e => setFOwner(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Aksiyon Sorumlusu</option>
            {uniq(rows.map(r => r.ownerName)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h3 className="font-black text-xs uppercase text-slate-700">Aksiyon Listesi ({filtered.length})</h3>
          {selectedAudit && (
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-slate-400">Denetim No {selectedAudit.auditNo} raporunu gönder:</span>
              <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="ornek@musteri.com" type="email" className="p-1.5 border border-gray-200 rounded-lg text-xs font-bold" />
              <button onClick={sendReport} disabled={sending} className="p-1.5 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-50">
                <Mail className="w-3.5 h-3.5" /><span>{sending ? "Gönderiliyor..." : "Rapor Gönder"}</span>
              </button>
            </div>
          )}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
              <th className="py-1.5">Denetim No</th><th>Bölüm</th><th>Alan</th><th>Kategori</th><th>Aksiyon</th><th>Durum</th><th>Termin</th><th>Sorumlu</th><th>Denetçi</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(r => (
              <tr key={r.answerId} className={canEdit(r) ? "cursor-pointer hover:bg-slate-50" : ""} onClick={() => canEdit(r) && openEdit(r)}>
                <td className="py-2 font-bold">{r.auditNo}</td>
                <td>{r.departmentName}</td>
                <td>{r.areaName}</td>
                <td>{r.category}</td>
                <td className="max-w-[200px] truncate" title={r.action}>{r.action}</td>
                <td>{r.actionStatus}</td>
                <td>{r.dueDate || "-"}</td>
                <td>{r.ownerName}</td>
                <td>{r.auditorName}</td>
                <td>{r.onTime ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={10} className="text-slate-400 py-2">Kayıt bulunamadı.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-800">Aksiyon Güncelle — {editing.areaName}</h3>
              <button onClick={() => setEditing(null)} className="cursor-pointer text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <textarea value={draft.action} onChange={e => setDraft(d => ({ ...d, action: e.target.value }))} className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold" rows={2} placeholder="Aksiyon" />
            <div className="grid grid-cols-3 gap-2">
              <select value={draft.actionStatus} onChange={e => setDraft(d => ({ ...d, actionStatus: e.target.value as ActionStatus }))} className="p-2 border border-gray-200 rounded-lg text-xs font-bold">
                {ACTION_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} className="p-2 border border-gray-200 rounded-lg text-xs font-bold" />
              <input type="date" value={draft.completedDate} onChange={e => setDraft(d => ({ ...d, completedDate: e.target.value }))} className="p-2 border border-gray-200 rounded-lg text-xs font-bold" />
            </div>
            <button onClick={saveEdit} className="p-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer">
              <Save className="w-3.5 h-3.5" /><span>Kaydet</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
