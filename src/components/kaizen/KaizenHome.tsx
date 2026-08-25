import React, { useMemo } from "react";
import { Plus, ListChecks, Star, TrendingUp } from "lucide-react";
import { KaizenSuggestion, KaizenEvaluation } from "./kaizenTypes";
import { APPROVAL_STATUS_LABELS, isRejected } from "./kaizenCalc";

interface Props {
  currentUser: any;
  suggestions: KaizenSuggestion[];
  evaluations: KaizenEvaluation[];
  onNewSuggestion: () => void;
  onShowMine: () => void;
  onShowApprovals: () => void;
  canSeeApprovals: boolean;
}

// Legacy Home's four personal KPI tiles (Toplam/Onaylanan/Reddedilen/Onay Bekleyen Önerilerim) plus
// "Öneri Puanı" (sum of Criteria.Point across the user's evaluated suggestions) — the dead org-wide
// KPI row from the source app (never actually wired to real data) is not ported.
export default function KaizenHome({ currentUser, suggestions, evaluations, onNewSuggestion, onShowMine, onShowApprovals, canSeeApprovals }: Props) {
  const myEmail = (currentUser?.email || "").toLowerCase();
  const mine = useMemo(() => suggestions.filter(s => (s.authorEmail || "").toLowerCase() === myEmail), [suggestions, myEmail]);

  const total = mine.length;
  const approved = mine.filter(s => s.approvalStatus === "First Approval" || s.approvalStatus === "Second Approval").length;
  const rejected = mine.filter(s => isRejected(s.approvalStatus)).length;
  const pending = mine.filter(s => s.approvalStatus === "Pending").length;
  const completed = mine.filter(s => s.completed).length;

  const myPoints = useMemo(() => {
    const mySubjectIds = new Set(mine.map(s => s.id));
    return evaluations.filter(e => mySubjectIds.has(e.suggestionId)).reduce((sum, e) => sum + (e.point || 0), 0);
  }, [evaluations, mine]);

  const KPI_CARDS = [
    { label: "Toplam Önerilerim", value: total, color: "bg-slate-900" },
    { label: "Onaylanan Önerilerim", value: approved, color: "bg-emerald-700" },
    { label: "Reddedilen Önerilerim", value: rejected, color: "bg-red-600" },
    { label: "Onay Bekleyen Önerilerim", value: pending, color: "bg-amber-500" },
    { label: "Tamamlanmış Önerilerim", value: completed, color: "bg-teal-700" }
  ];

  const recent = useMemo(
    () => [...mine].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 8),
    [mine]
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">{currentUser?.full_name}</p>
            <p className="text-2xl font-black text-slate-800">Öneri Puanı: {myPoints}</p>
          </div>
          <TrendingUp className="w-8 h-8 text-amber-500" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {KPI_CARDS.map(c => (
            <div key={c.label} className={`${c.color} text-white rounded-xl p-3`}>
              <p className="text-[10px] font-black uppercase opacity-80">{c.label}</p>
              <p className="text-2xl font-black">{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button onClick={onNewSuggestion} className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-slate-400 transition-all cursor-pointer">
          <Plus className="w-5 h-5 text-slate-700 mb-2" />
          <p className="font-black text-sm text-slate-800">Yeni Öneri Oluştur</p>
          <p className="text-xs text-slate-500">Fikirlerinizi paylaşın ve süreçleri geliştirin.</p>
        </button>
        <button onClick={onShowMine} className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-slate-400 transition-all cursor-pointer">
          <ListChecks className="w-5 h-5 text-slate-700 mb-2" />
          <p className="font-black text-sm text-slate-800">Önerilerimi Göster</p>
          <p className="text-xs text-slate-500">Gönderdiğiniz önerileri inceleyin ve takip edin.</p>
        </button>
        {canSeeApprovals && (
          <button onClick={onShowApprovals} className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-slate-400 transition-all cursor-pointer">
            <Star className="w-5 h-5 text-slate-700 mb-2" />
            <p className="font-black text-sm text-slate-800">Değerlendirmeleri Göster</p>
            <p className="text-xs text-slate-500">Gönderilen önerileri inceleyin ve değerlendirin.</p>
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-black text-xs uppercase text-slate-700 mb-2">Son Önerilerim</h3>
        <div className="divide-y divide-gray-100 text-xs">
          {recent.map(s => (
            <div key={s.id} className="py-2 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-700">{s.subject}</p>
                <p className="text-slate-400">{(s.createdAt || "").slice(0, 10)} · {(s.suggestionTypes || []).join(", ")}</p>
              </div>
              <span className="font-black text-[10px] uppercase px-2 py-1 rounded-full" style={{ color: "#fff", backgroundColor: "#0f172a" }}>
                {APPROVAL_STATUS_LABELS[s.approvalStatus]}
              </span>
            </div>
          ))}
          {recent.length === 0 && <p className="text-slate-400 py-2">Henüz öneriniz yok.</p>}
        </div>
      </div>
    </div>
  );
}
