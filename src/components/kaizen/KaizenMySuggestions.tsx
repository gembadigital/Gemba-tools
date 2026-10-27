import React, { useState, useMemo } from "react";
import { Edit3, X, Undo2, Search, Check, Circle, XCircle, Lightbulb, MessageSquare, Trophy } from "lucide-react";
import { KaizenSuggestion, KaizenApproval, KaizenEvaluation, ApprovalStatus } from "./kaizenTypes";
import { APPROVAL_STATUS_LABELS, canEditSuggestion, isRejected } from "./kaizenCalc";
import { KaizenApi } from "./KaizenSuggestionSystem";
import { KaizenSettings, rewardFor } from "../../utils/kaizenSettings";
import { Card, StatusBadge, Button, EmptyState, tableCls, theadCls, thCls, tdCls, trCls } from "./kaizenUi";

interface Props {
  currentUser: any;
  suggestions: KaizenSuggestion[];
  approvals: KaizenApproval[];
  evaluations: KaizenEvaluation[];
  onEdit: (s: KaizenSuggestion) => void;
  api: KaizenApi;
  showToast: (msg: string) => void;
  onReload: () => void;
  settings: KaizenSettings;
}

const ALL = "__ALL__";

export default function KaizenMySuggestions({ currentUser, suggestions, approvals, evaluations, onEdit, api, showToast, onReload, settings }: Props) {
  const myEmail = (currentUser?.email || "").toLowerCase();
  // A suggestion shows here if I authored it OR I am its team leader (team leaders track their
  // team's submissions in the same list).
  const mine = useMemo(
    () => suggestions.filter(s => (s.authorEmail || "").toLowerCase() === myEmail || (s.teamLeaderEmail || "").toLowerCase() === myEmail),
    [suggestions, myEmail]
  );

  const [fStatus, setFStatus] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<KaizenSuggestion | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { [ALL]: mine.length };
    mine.forEach(s => { c[s.approvalStatus] = (c[s.approvalStatus] || 0) + 1; });
    return c;
  }, [mine]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine
      .filter(s => fStatus === ALL || s.approvalStatus === fStatus)
      .filter(s => !q || `${s.subject} ${s.personnelName} ${s.personnelDepartment}`.toLowerCase().includes(q))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [mine, fStatus, query]);

  const withdraw = async (s: KaizenSuggestion) => {
    if (!window.confirm(`"${s.subject}" önerisini geri çekmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
    const res = await api.post(`suggestions/${s.id}/withdraw`, {});
    if (res.success) { showToast("Öneri geri çekildi."); setDetail(null); onReload(); }
    else showToast(`Hata: ${res.error || "Geri çekilemedi."}`);
  };

  const chips: { key: string; label: string }[] = [
    { key: ALL, label: "Tümü" },
    ...(Object.keys(APPROVAL_STATUS_LABELS) as ApprovalStatus[]).map(k => ({ key: k, label: APPROVAL_STATUS_LABELS[k] }))
  ];

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">Önerilerim</h3>
            <p className="text-sm text-slate-500">{filtered.length} / {mine.length} öneri gösteriliyor</p>
          </div>
          <div className="relative md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Konu, kişi veya bölüm ara…"
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map(c => {
            const active = fStatus === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setFStatus(c.key)}
                className={`h-9 px-3.5 rounded-full text-sm font-semibold cursor-pointer transition-colors flex items-center gap-2 ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {c.label}
                <span className={`text-xs tabular-nums ${active ? "text-slate-300" : "text-slate-400"}`}>{counts[c.key] || 0}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card padded={false} className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Lightbulb} title="Kayıt bulunamadı" text="Filtreleri değiştirin veya yeni bir öneri oluşturun." />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={thCls}>Tarih</th>
                  <th className={thCls}>Ad Soyad</th>
                  <th className={thCls}>Öneri Konusu</th>
                  <th className={thCls}>Sınıf</th>
                  <th className={thCls}>Durum</th>
                  <th className={`${thCls} text-right`}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isMine = (s.authorEmail || "").toLowerCase() === myEmail;
                  return (
                    <tr key={s.id} className={`${trCls} cursor-pointer`} onClick={() => setDetail(s)}>
                      <td className={`${tdCls} whitespace-nowrap tabular-nums`}>{(s.createdAt || "").slice(0, 10)}</td>
                      <td className={tdCls}>{s.personnelName}</td>
                      <td className={`${tdCls} font-semibold text-slate-900 max-w-md truncate`} title={s.subject}>{s.subject}</td>
                      <td className={`${tdCls} text-slate-500`}>{(s.suggestionTypes || []).join(", ")}</td>
                      <td className={tdCls}><StatusBadge status={s.approvalStatus} /></td>
                      <td className={`${tdCls} text-right whitespace-nowrap`}>
                        {canEditSuggestion(s.approvalStatus) && isMine && (
                          <button onClick={e => { e.stopPropagation(); onEdit(s); }} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer" title="Düzenle ve yeniden gönder">
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {s.approvalStatus === "Pending" && isMine && (
                          <button onClick={e => { e.stopPropagation(); withdraw(s); }} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 cursor-pointer" title="Öneriyi geri çek">
                            <Undo2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detail && (
        <DetailDrawer
          settings={settings}
          suggestion={detail}
          approvals={approvals.filter(a => a.suggestionId === detail.id).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))}
          evaluations={evaluations.filter(e => e.suggestionId === detail.id)}
          canEdit={canEditSuggestion(detail.approvalStatus) && (detail.authorEmail || "").toLowerCase() === myEmail}
          canWithdraw={detail.approvalStatus === "Pending" && (detail.authorEmail || "").toLowerCase() === myEmail}
          onEdit={() => { const s = detail; setDetail(null); onEdit(s); }}
          onWithdraw={() => withdraw(detail)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

type StepState = "done" | "current" | "todo" | "rejected";

function buildSteps(s: KaizenSuggestion): { label: string; state: StepState }[] {
  const st = s.approvalStatus;
  const managerState: StepState = st === "Rejected" ? "rejected" : st === "Pending" ? "current" : "done";
  const boardState: StepState = st === "Rejected 2nd" ? "rejected" : st === "Second Approval" ? "done" : st === "First Approval" ? "current" : "todo";
  const implState: StepState = s.completed ? "done" : st === "Second Approval" ? "current" : "todo";
  return [
    { label: "Gönderildi", state: "done" },
    { label: "Amir Onayı", state: managerState },
    { label: "Kurul Değerlendirmesi", state: isRejected(st) && st === "Rejected" ? "todo" : boardState },
    { label: "Uygulama", state: implState }
  ];
}

function DetailDrawer({ suggestion, approvals, evaluations, canEdit, canWithdraw, onEdit, onWithdraw, onClose, settings }: {
  settings: KaizenSettings;
  suggestion: KaizenSuggestion; approvals: KaizenApproval[]; evaluations: KaizenEvaluation[];
  canEdit: boolean; canWithdraw: boolean; onEdit: () => void; onWithdraw: () => void; onClose: () => void;
}) {
  const steps = buildSteps(suggestion);
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{children || "—"}</div></div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Öneri Detayı</p>
            <h3 className="text-xl font-black text-slate-900 mt-1">{suggestion.subject}</h3>
            <div className="mt-2"><StatusBadge status={suggestion.approvalStatus} /></div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
        </header>

        <div className="p-6 space-y-6 flex-1">
          {/* Progress */}
          <ol className="grid grid-cols-4 gap-2">
            {steps.map(step => {
              const color = step.state === "done" ? "bg-emerald-600 text-white" : step.state === "current" ? "bg-amber-400 text-slate-900" : step.state === "rejected" ? "bg-red-500 text-white" : "bg-slate-100 text-slate-400";
              const Icon = step.state === "done" ? Check : step.state === "rejected" ? XCircle : Circle;
              return (
                <li key={step.label} className="flex flex-col items-center text-center gap-2">
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></span>
                  <span className={`text-xs font-semibold ${step.state === "todo" ? "text-slate-400" : "text-slate-700"}`}>{step.label}</span>
                </li>
              );
            })}
          </ol>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-slate-50 rounded-2xl p-5">
            <Field label="Ad Soyad">{suggestion.personnelName}</Field>
            <Field label="Bölüm">{suggestion.personnelDepartment}</Field>
            <Field label="Görev">{suggestion.personnelJobTitle}</Field>
            <Field label="Vardiya">{suggestion.shift}</Field>
            <Field label="Amir">{suggestion.teamLeaderName}</Field>
            <Field label="Öneri Tarihi">{(suggestion.createdAt || "").slice(0, 10)}</Field>
            <Field label="Sınıf">{(suggestion.suggestionTypes || []).join(", ")}</Field>
            <Field label="Aşama / Kazanç Süresi">{[suggestion.stage, suggestion.paybackPeriod].filter(Boolean).join(" · ")}</Field>
          </div>

          <div className="space-y-4">
            <Field label="Mevcut Durum">{suggestion.currentState}</Field>
            <Field label="Önerilen İyileştirme">{suggestion.improvementSuggestion}</Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tahmini Kazanç">{`${suggestion.estimatedSaving.toLocaleString("tr-TR")} ${suggestion.estimatedSavingCurrency}`}</Field>
              <Field label="Tahmini Maliyet">{`${suggestion.estimatedCost.toLocaleString("tr-TR")} ${suggestion.estimatedCostCurrency}`}</Field>
            </div>
            {(suggestion.isg || suggestion.cevre || suggestion.motivasyon) && (
              <div className="flex gap-2 flex-wrap">
                {suggestion.isg && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600">İSG</span>}
                {suggestion.cevre && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Çevre</span>}
                {suggestion.motivasyon && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Motivasyon</span>}
              </div>
            )}
          </div>

          {(suggestion.photosCurrent.length > 0 || suggestion.photosPropose.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {[["Mevcut Durum Görselleri", suggestion.photosCurrent], ["Öneri Görselleri", suggestion.photosPropose]].map(([label, photos]) =>
                (photos as any[]).length > 0 ? (
                  <div key={label as string}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{label as string}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(photos as any[]).map((p, i) => <img key={i} src={p.dataUrl} alt="" className="w-full h-28 object-cover rounded-xl border border-slate-200" />)}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}

          {approvals.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Onay Geçmişi</p>
              <ul className="space-y-3">
                {approvals.map(a => (
                  <li key={a.id} className="flex gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a.approved ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {a.approved ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {a.stage === "Manager" ? "Amir" : "Kaizen Kurulu"} · {a.approverName}
                        <span className={`ml-2 text-xs font-bold ${a.approved ? "text-emerald-700" : "text-red-600"}`}>{a.approved ? "Onayladı" : "Reddetti"}</span>
                      </p>
                      <p className="text-xs text-slate-400 tabular-nums">{(a.createdAt || "").slice(0, 10)}</p>
                      {a.comment && (
                        <p className="mt-1.5 text-sm text-slate-600 bg-slate-50 rounded-xl px-3.5 py-2.5 flex gap-2"><MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />{a.comment}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evaluations.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 flex items-center gap-1.5"><Trophy className="w-4 h-4" />Kurul Değerlendirmesi</p>
              {evaluations.map(e => (
                <div key={e.id} className="text-sm text-slate-700 space-y-0.5">
                  <p><span className="font-bold text-slate-900">{e.criteriaLabel || "Kriter seçilmedi"}</span> — {e.point} puan</p>
                  {!!e.estimatedIncome && <p>Onaylanan getiri: {e.estimatedIncome.toLocaleString("tr-TR")} {e.estimatedIncomeCurrency}</p>}
                  <p>Yokoten: {e.yokoten ? (e.yokotenImplemented ? "Uygulandı" : "Uygulanabilir, bekliyor") : "Uygulanamaz"} · Ödül: {e.rewardStatus || "Bekliyor"}{(() => { const w = rewardFor(e, settings); return w ? ` · ${w.amount.toLocaleString("tr-TR")} ${w.currency}` : ""; })()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {(canEdit || canWithdraw) && (
          <footer className="px-6 py-4 border-t border-slate-200 flex gap-3 sticky bottom-0 bg-white">
            {canEdit && <Button variant="primary" onClick={onEdit} className="flex-1"><Edit3 className="w-4 h-4" />Düzenle ve yeniden gönder</Button>}
            {canWithdraw && <Button variant="ghost" onClick={onWithdraw} className="flex-1 !text-red-600"><Undo2 className="w-4 h-4" />Öneriyi geri çek</Button>}
          </footer>
        )}
      </aside>
    </div>
  );
}
