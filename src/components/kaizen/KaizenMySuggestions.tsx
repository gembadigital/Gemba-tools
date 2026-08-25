import React, { useState, useMemo } from "react";
import { Edit, X } from "lucide-react";
import { KaizenSuggestion, KaizenApproval, KaizenEvaluation } from "./kaizenTypes";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS, canEditSuggestion } from "./kaizenCalc";

interface Props {
  currentUser: any;
  suggestions: KaizenSuggestion[];
  approvals: KaizenApproval[];
  evaluations: KaizenEvaluation[];
  onEdit: (s: KaizenSuggestion) => void;
}

const ALL = "__ALL__";

export default function KaizenMySuggestions({ currentUser, suggestions, approvals, evaluations, onEdit }: Props) {
  const myEmail = (currentUser?.email || "").toLowerCase();
  // Legacy rule: a suggestion shows here if I authored it OR I am its team leader (so team leaders
  // can track their team's submissions in the same list).
  const mine = useMemo(
    () => suggestions.filter(s => (s.authorEmail || "").toLowerCase() === myEmail || (s.teamLeaderEmail || "").toLowerCase() === myEmail),
    [suggestions, myEmail]
  );

  const [fStatus, setFStatus] = useState(ALL);
  const filtered = useMemo(
    () => (fStatus === ALL ? mine : mine.filter(s => s.approvalStatus === fStatus)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [mine, fStatus]
  );

  const [detail, setDetail] = useState<KaizenSuggestion | null>(null);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-black text-xs uppercase text-slate-700">Önerilerim ({filtered.length})</h3>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-xs font-bold">
          <option value={ALL}>Tüm Durumlar</option>
          {Object.entries(APPROVAL_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 uppercase text-[10px] border-b bg-slate-50">
              <th className="py-2 px-3">Tarih</th><th>Ad Soyad</th><th>Öneri Konusu</th><th>Durum</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(s => (
              <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetail(s)}>
                <td className="py-2 px-3">{(s.createdAt || "").slice(0, 10)}</td>
                <td>{s.personnelName}</td>
                <td className="max-w-[240px] truncate" title={s.subject}>{s.subject}</td>
                <td>
                  <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full text-white" style={{ backgroundColor: APPROVAL_STATUS_COLORS[s.approvalStatus] }}>
                    {APPROVAL_STATUS_LABELS[s.approvalStatus]}
                  </span>
                </td>
                <td>
                  {canEditSuggestion(s.approvalStatus) && (s.authorEmail || "").toLowerCase() === myEmail && (
                    <button onClick={(e) => { e.stopPropagation(); onEdit(s); }} className="text-slate-500 hover:text-slate-800 cursor-pointer p-1">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-slate-400 py-3 px-3">Kayıt bulunamadı.</td></tr>}
          </tbody>
        </table>
      </div>

      {detail && (
        <DetailModal
          suggestion={detail}
          approvals={approvals.filter(a => a.suggestionId === detail.id)}
          evaluations={evaluations.filter(e => e.suggestionId === detail.id)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

const PROGRESS_STEPS = [
  { key: "First Approval", label: "İlk Amir Onayı" },
  { key: "Second Approval", label: "Kurul Değerlendirmesi" },
  { key: "Completed", label: "Uygulama" }
];

function DetailModal({ suggestion, approvals, evaluations, onClose }: { suggestion: KaizenSuggestion; approvals: KaizenApproval[]; evaluations: KaizenEvaluation[]; onClose: () => void }) {
  const stepIndex =
    suggestion.completed ? 3 :
    suggestion.approvalStatus === "Second Approval" ? 2 :
    suggestion.approvalStatus === "First Approval" ? 1 : 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-black text-sm text-slate-800">Öneri Detayları</h3>
          <button onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-lg p-3">
          <div><span className="text-slate-400 font-bold">Ad Soyad: </span>{suggestion.personnelName}</div>
          <div><span className="text-slate-400 font-bold">Bölüm: </span>{suggestion.personnelDepartment}</div>
          <div><span className="text-slate-400 font-bold">Görev: </span>{suggestion.personnelJobTitle}</div>
          <div><span className="text-slate-400 font-bold">Vardiya: </span>{suggestion.shift}</div>
          <div><span className="text-slate-400 font-bold">Öneri Tarihi: </span>{(suggestion.createdAt || "").slice(0, 10)}</div>
          <div><span className="text-slate-400 font-bold">Kategori: </span>{(suggestion.suggestionTypes || []).join(", ")}</div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
          {PROGRESS_STEPS.map((s, i) => (
            <div key={s.key} className={`flex-1 text-center pb-2 border-b-2 ${i <= stepIndex ? "border-emerald-600 text-emerald-700" : "border-gray-100"}`}>
              {s.label}
            </div>
          ))}
        </div>

        <div className="text-xs space-y-1">
          <p><span className="font-bold text-slate-400">Mevcut Durum: </span>{suggestion.currentState}</p>
          <p><span className="font-bold text-slate-400">Önerilen İyileştirme: </span>{suggestion.improvementSuggestion}</p>
          <p><span className="font-bold text-slate-400">Tahmini Kazanç: </span>{suggestion.estimatedSaving} {suggestion.estimatedSavingCurrency}</p>
          <p><span className="font-bold text-slate-400">Tahmini Maliyet: </span>{suggestion.estimatedCost} {suggestion.estimatedCostCurrency}</p>
        </div>

        {(suggestion.photosCurrent.length > 0 || suggestion.photosPropose.length > 0) && (
          <div className="grid grid-cols-2 gap-2">
            {suggestion.photosCurrent.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Mevcut Durum</p>
                <div className="flex flex-wrap gap-1.5">{suggestion.photosCurrent.map((p, i) => <img key={i} src={p.dataUrl} className="h-14 rounded-lg border border-gray-200" alt="" />)}</div>
              </div>
            )}
            {suggestion.photosPropose.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Öneri</p>
                <div className="flex flex-wrap gap-1.5">{suggestion.photosPropose.map((p, i) => <img key={i} src={p.dataUrl} className="h-14 rounded-lg border border-gray-200" alt="" />)}</div>
              </div>
            )}
          </div>
        )}

        {approvals.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Onay Geçmişi</p>
            <div className="divide-y divide-gray-100 text-xs">
              {approvals.map(a => (
                <div key={a.id} className="py-1.5 flex items-center justify-between">
                  <span>{a.stage === "Manager" ? "Amir" : "Kaizen Kurulu"} — {a.approverName}</span>
                  <span className={`font-black text-[10px] uppercase ${a.approved ? "text-emerald-700" : "text-red-600"}`}>{a.approved ? "Onaylandı" : "Reddedildi"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {evaluations.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Değerlendirme</p>
            {evaluations.map(e => (
              <p key={e.id} className="text-xs text-slate-600">{e.criteriaLabel} — {e.point} puan{e.yokoten ? " · Yokoten uygulanabilir" : ""}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
