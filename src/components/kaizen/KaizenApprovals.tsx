import React, { useState, useMemo } from "react";
import { CheckCircle, XCircle, Download, X } from "lucide-react";
import { KaizenSuggestion, KaizenCriteria } from "./kaizenTypes";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS, canDecideAsManager, canDecideAsBoard, CURRENCY_OPTIONS } from "./kaizenCalc";
import { KaizenApi } from "./KaizenSuggestionSystem";

interface Props {
  currentUser: any;
  suggestions: KaizenSuggestion[];
  criteria: KaizenCriteria[];
  isBoardMember: boolean;
  api: KaizenApi;
  showToast: (msg: string) => void;
  onReload: () => void;
}

const ALL = "__ALL__";

export default function KaizenApprovals({ currentUser, suggestions, criteria, isBoardMember, api, showToast, onReload }: Props) {
  const [tab, setTab] = useState<"manager" | "board">("manager");
  const myEmail = currentUser?.email || "";
  const myRole = currentUser?.role || "";

  const managerQueue = useMemo(
    () => suggestions.filter(s => s.approvalStatus === "Pending" && canDecideAsManager(myEmail, myRole, s.teamLeaderEmail)),
    [suggestions, myEmail, myRole]
  );
  const managerHistory = useMemo(
    () => suggestions.filter(s => s.approvalStatus !== "Pending" && canDecideAsManager(myEmail, myRole, s.teamLeaderEmail)),
    [suggestions, myEmail, myRole]
  );
  const boardQueue = useMemo(
    () => suggestions.filter(s => s.approvalStatus === "First Approval"),
    [suggestions]
  );
  const boardHistory = useMemo(
    () => suggestions.filter(s => s.approvalStatus === "Second Approval" || s.approvalStatus === "Rejected 2nd"),
    [suggestions]
  );

  const [decisionTarget, setDecisionTarget] = useState<KaizenSuggestion | null>(null);
  const exportUrl = `/api/business/kaizen/suggestions/export-excel`;

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button onClick={() => setTab("manager")} className={tabBtn(tab === "manager")}>Amir Onayı ({managerQueue.length})</button>
        {isBoardMember && <button onClick={() => setTab("board")} className={tabBtn(tab === "board")}>Kurul Onayı ({boardQueue.length})</button>}
      </div>

      {tab === "manager" && (
        <ApprovalTable
          title="Onay Bekleyen Öneriler"
          rows={managerQueue}
          onRowClick={setDecisionTarget}
          extraCol="Amir"
        />
      )}
      {tab === "manager" && managerHistory.length > 0 && (
        <ApprovalTable title="Geçmiş Kararlar" rows={managerHistory} onRowClick={() => {}} extraCol="Amir" muted />
      )}

      {tab === "board" && isBoardMember && (
        <>
          <div className="flex justify-end">
            <a href={exportUrl} className="px-3 py-2 rounded-lg text-xs font-black bg-slate-100 text-slate-700 flex items-center space-x-1.5 cursor-pointer hover:bg-slate-200">
              <Download className="w-3.5 h-3.5" /><span>Rapor İndir</span>
            </a>
          </div>
          <ApprovalTable title="Değerlendirme Bekleyen Öneriler" rows={boardQueue} onRowClick={setDecisionTarget} extraCol="Amir" />
          {boardHistory.length > 0 && <ApprovalTable title="Geçmiş Kararlar" rows={boardHistory} onRowClick={() => {}} extraCol="Amir" muted />}
        </>
      )}

      {decisionTarget && decisionTarget.approvalStatus === "Pending" && (
        <ManagerDecisionModal
          suggestion={decisionTarget}
          api={api}
          showToast={showToast}
          onClose={() => setDecisionTarget(null)}
          onDone={() => { setDecisionTarget(null); onReload(); }}
        />
      )}
      {decisionTarget && decisionTarget.approvalStatus === "First Approval" && (
        <BoardDecisionModal
          suggestion={decisionTarget}
          criteria={criteria}
          api={api}
          showToast={showToast}
          onClose={() => setDecisionTarget(null)}
          onDone={() => { setDecisionTarget(null); onReload(); }}
        />
      )}
    </div>
  );
}

function tabBtn(active: boolean) {
  return `py-1.5 px-3 rounded-lg font-black text-[11px] uppercase cursor-pointer transition-all ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`;
}

function ApprovalTable({ title, rows, onRowClick, extraCol, muted }: { title: string; rows: KaizenSuggestion[]; onRowClick: (s: KaizenSuggestion) => void; extraCol: string; muted?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <h3 className="font-black text-xs uppercase text-slate-700 px-3 pt-3 pb-2">{title} ({rows.length})</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 uppercase text-[10px] border-b bg-slate-50">
            <th className="py-2 px-3">Tarih</th><th>Ad Soyad</th><th>Konu</th><th>{extraCol}</th><th>Durum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).map(s => (
            <tr key={s.id} className={muted ? "" : "cursor-pointer hover:bg-slate-50"} onClick={() => !muted && onRowClick(s)}>
              <td className="py-2 px-3">{(s.createdAt || "").slice(0, 10)}</td>
              <td>{s.personnelName}</td>
              <td className="max-w-[220px] truncate" title={s.subject}>{s.subject}</td>
              <td>{s.teamLeaderName}</td>
              <td><span className="text-[10px] font-black uppercase px-2 py-1 rounded-full text-white" style={{ backgroundColor: APPROVAL_STATUS_COLORS[s.approvalStatus] }}>{APPROVAL_STATUS_LABELS[s.approvalStatus]}</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="text-slate-400 py-3 px-3">Kayıt bulunamadı.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-black text-sm text-slate-800">{title}</h3>
          <button onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SuggestionSummary({ s }: { s: KaizenSuggestion }) {
  return (
    <div className="text-xs bg-slate-50 rounded-lg p-3 space-y-1">
      <p><span className="font-bold text-slate-400">Ad Soyad: </span>{s.personnelName} · {s.personnelDepartment}</p>
      <p><span className="font-bold text-slate-400">Konu: </span>{s.subject}</p>
      <p><span className="font-bold text-slate-400">Mevcut Durum: </span>{s.currentState}</p>
      <p><span className="font-bold text-slate-400">Önerilen İyileştirme: </span>{s.improvementSuggestion}</p>
      <p><span className="font-bold text-slate-400">Tahmini Kazanç: </span>{s.estimatedSaving} {s.estimatedSavingCurrency} · <span className="font-bold text-slate-400">Tahmini Maliyet: </span>{s.estimatedCost} {s.estimatedCostCurrency}</p>
    </div>
  );
}

function ManagerDecisionModal({ suggestion, api, showToast, onClose, onDone }: { suggestion: KaizenSuggestion; api: KaizenApi; showToast: (m: string) => void; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const decide = async (approved: boolean) => {
    if (!approved && !comment.trim()) { showToast("Lütfen red nedeni giriniz."); return; }
    setSaving(true);
    const res = await api.post(`suggestions/${suggestion.id}/manager-decision`, { approved, comment });
    setSaving(false);
    if (res.success) { showToast(approved ? "Öneri onaylandı." : "Öneri reddedildi."); onDone(); }
    else showToast(`Hata: ${res.error || "İşlem başarısız."}`);
  };

  return (
    <ModalShell title="Amir Onayı" onClose={onClose}>
      <SuggestionSummary s={suggestion} />
      <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Yorum / red nedeni" className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold" />
      <div className="flex space-x-2">
        <button onClick={() => decide(true)} disabled={saving} className="flex-1 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50">
          <CheckCircle className="w-3.5 h-3.5" /><span>Onayla</span>
        </button>
        <button onClick={() => decide(false)} disabled={saving} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50">
          <XCircle className="w-3.5 h-3.5" /><span>Reddet</span>
        </button>
      </div>
    </ModalShell>
  );
}

function BoardDecisionModal({ suggestion, criteria, api, showToast, onClose, onDone }: { suggestion: KaizenSuggestion; criteria: KaizenCriteria[]; api: KaizenApi; showToast: (m: string) => void; onClose: () => void; onDone: () => void }) {
  const [criteriaId, setCriteriaId] = useState("");
  const [yokoten, setYokoten] = useState(false);
  const [yokotenDescription, setYokotenDescription] = useState("");
  const [estimatedIncome, setEstimatedIncome] = useState("");
  const [estimatedIncomeCurrency, setEstimatedIncomeCurrency] = useState("TL");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedCriteria = criteria.find(c => c.id === criteriaId);

  const decide = async (approved: boolean) => {
    if (!approved && !comment.trim()) { showToast("Lütfen red nedeni giriniz."); return; }
    setSaving(true);
    const res = await api.post(`suggestions/${suggestion.id}/board-decision`, {
      approved,
      criteriaId,
      criteriaLabel: selectedCriteria?.criteria || "",
      point: selectedCriteria?.point || 0,
      yokoten,
      yokotenDescription,
      estimatedIncome: Number(estimatedIncome) || 0,
      estimatedIncomeCurrency,
      comment
    });
    setSaving(false);
    if (res.success) { showToast(approved ? "Öneri onaylandı." : "Öneri reddedildi."); onDone(); }
    else showToast(`Hata: ${res.error || "İşlem başarısız."}`);
  };

  return (
    <ModalShell title="Kaizen Kurulu Değerlendirmesi" onClose={onClose}>
      <SuggestionSummary s={suggestion} />

      <div>
        <label className="text-[10px] font-black uppercase text-slate-400">Değerlendirme Kriteri</label>
        <select value={criteriaId} onChange={e => setCriteriaId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold">
          <option value="">Seçiniz...</option>
          {criteria.map(c => <option key={c.id} value={c.id}>{c.point} - {c.criteria}</option>)}
        </select>
        {selectedCriteria && <p className="text-[11px] text-slate-500 mt-1">{selectedCriteria.description}</p>}
      </div>

      <div className="flex space-x-1">
        <input type="number" value={estimatedIncome} onChange={e => setEstimatedIncome(e.target.value)} placeholder="Tahmini Kazanım" className="flex-1 p-2 border border-gray-200 rounded-lg text-xs font-bold" />
        <select value={estimatedIncomeCurrency} onChange={e => setEstimatedIncomeCurrency(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-xs font-bold">
          {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center space-x-1.5 text-xs font-bold cursor-pointer">
          <input type="radio" checked={yokoten} onChange={() => setYokoten(true)} /><span>Yokoten Yapılabilir</span>
        </label>
        <label className="flex items-center space-x-1.5 text-xs font-bold cursor-pointer">
          <input type="radio" checked={!yokoten} onChange={() => setYokoten(false)} /><span>Yokoten Yapılamaz</span>
        </label>
      </div>
      <textarea value={yokotenDescription} onChange={e => setYokotenDescription(e.target.value)} rows={2} placeholder="Yokoten açıklaması (opsiyonel)" className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold" />

      <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Yorum / red nedeni" className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold" />

      <div className="flex space-x-2">
        <button onClick={() => decide(true)} disabled={saving} className="flex-1 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50">
          <CheckCircle className="w-3.5 h-3.5" /><span>Onayla</span>
        </button>
        <button onClick={() => decide(false)} disabled={saving} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50">
          <XCircle className="w-3.5 h-3.5" /><span>Reddet</span>
        </button>
      </div>
    </ModalShell>
  );
}
