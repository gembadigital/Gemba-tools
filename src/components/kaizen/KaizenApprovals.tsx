import React, { useState, useMemo, useEffect } from "react";
import { CheckCircle2, XCircle, Download, Share2, Gift, Clock, Inbox, ClipboardCheck, Users, Award, Sparkles, MessageSquare } from "lucide-react";
import { KaizenSuggestion, KaizenCriteria, KaizenApproval, KaizenEvaluation } from "./kaizenTypes";
import { canDecideAsManager, daysWaiting, WAITING_SEVERITY_COLORS } from "./kaizenCalc";
import { KaizenSettings, currencyChoices, toBaseCurrency, waitingSeverityFor, rewardFor, stagesOf } from "../../utils/kaizenSettings";

const fmtReward = (r: { amount: number; currency: string }) => `${r.amount.toLocaleString("tr-TR")} ${r.currency}`;
import { KaizenApi } from "./KaizenSuggestionSystem";
import { Card, StatusBadge, Button, EmptyState, KpiCard, tableCls, theadCls, thCls, tdCls, trCls } from "./kaizenUi";

interface Props {
  currentUser: any;
  suggestions: KaizenSuggestion[];
  approvals: KaizenApproval[];
  evaluations: KaizenEvaluation[];
  criteria: KaizenCriteria[];
  isBoardMember: boolean;
  api: KaizenApi;
  showToast: (msg: string) => void;
  onReload: () => void;
  settings: KaizenSettings;
}

type Tab = "manager" | "board" | "yokoten" | "reward";

const areaCls = "w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400";
const inputCls = "h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400";

export default function KaizenApprovals({ currentUser, suggestions, approvals, evaluations, criteria, isBoardMember, api, showToast, onReload, settings }: Props) {
  const [tab, setTab] = useState<Tab>("manager");
  const myEmail = currentUser?.email || "";
  const myRole = currentUser?.role || "";

  const managerApprovalBySuggestion = useMemo(() => {
    const map = new Map<string, string>();
    approvals.filter(a => a.stage === "Manager" && a.approved).forEach(a => map.set(a.suggestionId, a.createdAt));
    return map;
  }, [approvals]);

  const managerQueue = useMemo(() => suggestions.filter(s => s.approvalStatus === "Pending" && canDecideAsManager(myEmail, myRole, s.teamLeaderEmail)), [suggestions, myEmail, myRole]);
  const managerHistory = useMemo(() => suggestions.filter(s => s.approvalStatus !== "Pending" && canDecideAsManager(myEmail, myRole, s.teamLeaderEmail)), [suggestions, myEmail, myRole]);
  const boardQueue = useMemo(() => suggestions.filter(s => s.approvalStatus === "First Approval"), [suggestions]);
  const boardHistory = useMemo(() => suggestions.filter(s => s.approvalStatus === "Second Approval" || s.approvalStatus === "Rejected 2nd"), [suggestions]);

  const yokotenOpen = evaluations.filter(e => e.yokoten && !e.yokotenImplemented).length;
  const rewardOpen = evaluations.filter(e => (e.rewardStatus || "Bekliyor") !== "Ödendi" && suggestions.find(s => s.id === e.suggestionId)?.approvalStatus === "Second Approval").length;

  const tabs: { key: Tab; label: string; icon: any; count: number; show: boolean }[] = [
    { key: "manager", label: "Amir Onayı", icon: ClipboardCheck, count: managerQueue.length, show: true },
    { key: "board", label: "Kurul Değerlendirmesi", icon: Users, count: boardQueue.length, show: isBoardMember },
    { key: "yokoten", label: "Yokoten Takibi", icon: Share2, count: yokotenOpen, show: isBoardMember },
    { key: "reward", label: "Ödül Takibi", icon: Gift, count: rewardOpen, show: isBoardMember }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Amir onayı bekleyen" value={managerQueue.length} icon={ClipboardCheck} tone="amber" onClick={() => setTab("manager")} />
        {isBoardMember && <KpiCard label="Kurul bekleyen" value={boardQueue.length} icon={Users} tone="blue" onClick={() => setTab("board")} />}
        {isBoardMember && <KpiCard label="Yayılımı bekleyen" value={yokotenOpen} icon={Share2} tone="teal" onClick={() => setTab("yokoten")} />}
        {isBoardMember && <KpiCard label="Ödenecek ödül" value={rewardOpen} icon={Gift} tone="emerald" onClick={() => setTab("reward")} />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1 flex-wrap">
          {tabs.filter(t => t.show).map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={`h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all ${tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <Icon className="w-4 h-4" />{t.label}
                {t.count > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center tabular-nums">{t.count}</span>}
              </button>
            );
          })}
        </div>
        {isBoardMember && (
          <Button variant="ghost" onClick={() => api.download("suggestions/export-excel", "Kaizen_Onerileri.xlsx").catch(() => showToast("Hata: Rapor indirilemedi."))}>
            <Download className="w-4 h-4" />Excel Raporu İndir
          </Button>
        )}
      </div>

      {tab === "manager" && (
        <DecisionWorkspace
          settings={settings}
          stage="manager" queue={managerQueue} history={managerHistory} criteria={criteria}
          approvals={approvals} evaluations={evaluations}
          waitingSince={s => s.createdAt}
          api={api} showToast={showToast} onReload={onReload}
        />
      )}
      {tab === "board" && isBoardMember && (
        <DecisionWorkspace
          settings={settings}
          stage="board" queue={boardQueue} history={boardHistory} criteria={criteria}
          approvals={approvals} evaluations={evaluations}
          waitingSince={s => managerApprovalBySuggestion.get(s.id) || s.createdAt}
          api={api} showToast={showToast} onReload={onReload}
        />
      )}
      {tab === "yokoten" && isBoardMember && <YokotenTab suggestions={suggestions} evaluations={evaluations} api={api} showToast={showToast} onReload={onReload} />}
      {tab === "reward" && isBoardMember && <RewardTab suggestions={suggestions} evaluations={evaluations} api={api} showToast={showToast} onReload={onReload} settings={settings} />}
    </div>
  );
}

function WaitingBadge({ since, settings }: { since: string; settings: KaizenSettings }) {
  const days = daysWaiting(since);
  const color = WAITING_SEVERITY_COLORS[waitingSeverityFor(days, settings)];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap" style={{ color }}>
      <Clock className="w-3.5 h-3.5" />{days} gün
    </span>
  );
}

// ---------- Master/detail workspace: queue on the left, decision form on the right ----------

function DecisionWorkspace({ stage, queue, history, criteria, approvals, evaluations, waitingSince, api, showToast, onReload, settings }: {
  settings: KaizenSettings;
  stage: "manager" | "board"; queue: KaizenSuggestion[]; history: KaizenSuggestion[]; criteria: KaizenCriteria[];
  approvals: KaizenApproval[]; evaluations: KaizenEvaluation[]; waitingSince: (s: KaizenSuggestion) => string;
  api: KaizenApi; showToast: (m: string) => void; onReload: () => void;
}) {
  const [view, setView] = useState<"queue" | "history">("queue");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(
    () => [...(view === "queue" ? queue : history)].sort((a, b) => (view === "queue" ? (waitingSince(a) || "").localeCompare(waitingSince(b) || "") : (b.updatedAt || "").localeCompare(a.updatedAt || ""))),
    [view, queue, history]
  );
  const selected = list.find(s => s.id === selectedId) || null;

  useEffect(() => { setSelectedId(null); }, [stage, view]);
  // Auto-open the first waiting item so the right pane is never empty when there is work to do.
  useEffect(() => { if (!selectedId && list.length > 0 && view === "queue") setSelectedId(list[0].id); }, [list, selectedId, view]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      <Card padded={false} className="xl:col-span-2 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            {([["queue", `Bekleyen (${queue.length})`], ["history", `Geçmiş (${history.length})`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={`h-8 px-3 rounded-md text-sm font-semibold cursor-pointer ${view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{l}</button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <EmptyState icon={Inbox} title={view === "queue" ? "Bekleyen öneri yok" : "Geçmiş kayıt yok"} text={view === "queue" ? "Tüm kararlar verilmiş görünüyor." : undefined} />
        ) : (
          <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
            {list.map(s => (
              <li key={s.id}>
                <button onClick={() => setSelectedId(s.id)} className={`w-full text-left px-5 py-4 cursor-pointer transition-colors ${selectedId === s.id ? "bg-slate-50 border-l-4 border-slate-900" : "hover:bg-slate-50/70 border-l-4 border-transparent"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900 leading-snug">{s.subject}</p>
                    {view === "queue" ? <WaitingBadge since={waitingSince(s)} settings={settings} /> : <StatusBadge status={s.approvalStatus} requiredStages={s.requiredStages} />}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{s.personnelName} · {s.personnelDepartment || "—"}</p>
                  <p className="text-xs text-slate-400 mt-1 tabular-nums">{(s.createdAt || "").slice(0, 10)} · {(s.suggestionTypes || []).join(", ")}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="xl:col-span-3">
        {!selected ? (
          <Card><EmptyState icon={ClipboardCheck} title="Bir öneri seçin" text="Soldaki listeden bir öneri seçerek detayını inceleyin ve kararınızı verin." /></Card>
        ) : (
          <DecisionPanel
            settings={settings}
            key={selected.id} suggestion={selected} stage={stage} criteria={criteria}
            approvals={approvals.filter(a => a.suggestionId === selected.id)}
            evaluations={evaluations.filter(e => e.suggestionId === selected.id)}
            readOnly={view === "history"} api={api} showToast={showToast} onDone={() => { setSelectedId(null); onReload(); }}
          />
        )}
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{children || "—"}</div></div>;
}

function DecisionPanel({ suggestion: s, stage, criteria, approvals, evaluations, readOnly, api, showToast, onDone, settings }: {
  settings: KaizenSettings;
  suggestion: KaizenSuggestion; stage: "manager" | "board"; criteria: KaizenCriteria[]; approvals: KaizenApproval[]; evaluations: KaizenEvaluation[];
  readOnly: boolean; api: KaizenApi; showToast: (m: string) => void; onDone: () => void;
}) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [criteriaId, setCriteriaId] = useState("");
  // Prefill the Board's income from the suggestion's own estimate, in the estimate's currency.
  const [income, setIncome] = useState(s.estimatedSaving ? String(s.estimatedSaving) : "");
  const [incomeCurrency, setIncomeCurrency] = useState(s.estimatedSaving && s.estimatedSavingCurrency ? s.estimatedSavingCurrency : settings.baseCurrency);
  const [yokoten, setYokoten] = useState(false);
  const [yokotenDescription, setYokotenDescription] = useState("");

  const sortedCriteria = useMemo(() => [...criteria].sort((a, b) => a.point - b.point), [criteria]);
  const incomeNum = Number(income) || 0;
  // Suggest the rubric tier whose income band (in the base currency) contains the entered income —
  // converted with the customer's fixed rate when entered in another currency, none if not convertible.
  const incomeBase = toBaseCurrency(incomeNum, incomeCurrency, settings);
  const suggestedTier = incomeBase !== null && incomeBase > 0
    ? sortedCriteria.find(c => incomeBase >= c.minIncome && (c.maxIncome === 0 || incomeBase <= c.maxIncome))
    : undefined;
  const selectedCriteria = criteria.find(c => c.id === criteriaId);

  const decide = async (approved: boolean) => {
    if (!approved && !comment.trim()) { showToast("Lütfen red nedeni giriniz."); return; }
    if (stage === "board" && approved && settings.boardScoreRequired && !selectedCriteria) { showToast("Onaylamak için bir değerlendirme kriteri seçiniz."); return; }
    setSaving(true);
    const res = stage === "manager"
      ? await api.post(`suggestions/${s.id}/manager-decision`, { approved, comment })
      : await api.post(`suggestions/${s.id}/board-decision`, {
          approved, criteriaId, criteriaLabel: selectedCriteria?.criteria || "", point: selectedCriteria?.point || 0,
          yokoten, yokotenDescription, estimatedIncome: incomeNum, estimatedIncomeCurrency: incomeCurrency, comment
        });
    setSaving(false);
    if (res.success) { showToast(approved ? "Öneri onaylandı." : "Öneri reddedildi."); onDone(); }
    else showToast(`Hata: ${res.error || "İşlem başarısız."}`);
  };

  return (
    <Card padded={false} className="overflow-hidden">
      <header className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage === "manager" ? "Amir Onayı" : "Kurul Değerlendirmesi"}</p>
          <h3 className="text-xl font-black text-slate-900 mt-1">{s.subject}</h3>
          <p className="text-sm text-slate-500 mt-1">{s.personnelName} · {s.personnelDepartment || "—"} · {s.personnelJobTitle || "—"} · Amir: {s.teamLeaderName || "—"}</p>
          {stage === "manager" && !stagesOf(s).includes("Board") && !readOnly && (
            <p className="text-xs font-semibold text-teal-700 bg-teal-50 rounded-full px-3 py-1 mt-2 inline-block">Kurul eşiğinin altında: onayınız son karardır</p>
          )}
          {stage === "board" && !stagesOf(s).includes("Manager") && (
            <p className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-full px-3 py-1 mt-2 inline-block">Amir aşaması olmadan doğrudan Kurul'a geldi</p>
          )}
        </div>
        <StatusBadge status={s.approvalStatus} requiredStages={s.requiredStages} />
      </header>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Fact label="Mevcut Durum">{s.currentState}</Fact>
          <Fact label="Önerilen İyileştirme">{s.improvementSuggestion}</Fact>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-700">Tahmini Kazanç</p><p className="font-black text-emerald-900 tabular-nums mt-0.5">{s.estimatedSaving.toLocaleString("tr-TR")} {s.estimatedSavingCurrency}</p></div>
          <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-semibold text-slate-600">Tahmini Maliyet</p><p className="font-black text-slate-900 tabular-nums mt-0.5">{s.estimatedCost.toLocaleString("tr-TR")} {s.estimatedCostCurrency}</p></div>
          <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-semibold text-slate-600">Aşama</p><p className="font-bold text-slate-900 mt-0.5 text-sm">{s.stage || "—"}</p></div>
          <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-semibold text-slate-600">Kazanç Süresi</p><p className="font-bold text-slate-900 mt-0.5 text-sm">{s.paybackPeriod || "—"}</p></div>
        </div>
        {(s.photosCurrent.length > 0 || s.photosPropose.length > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[...s.photosCurrent, ...s.photosPropose].map((p, i) => <img key={i} src={p.dataUrl} alt="" className="w-full h-28 object-cover rounded-xl border border-slate-200" />)}
          </div>
        )}

        {approvals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Önceki kararlar</p>
            {approvals.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")).map(a => (
              <div key={a.id} className="flex gap-3 text-sm">
                {a.approved ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                <div><span className="font-semibold">{a.stage === "Manager" ? "Amir" : "Kurul"} · {a.approverName}</span> <span className="text-slate-400 tabular-nums">{(a.createdAt || "").slice(0, 10)}</span>
                  {a.comment && <p className="text-slate-600 mt-0.5 flex gap-1.5"><MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />{a.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {evaluations.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm space-y-1">
            {evaluations.map(e => <p key={e.id}><span className="font-bold">{e.criteriaLabel || "Kriter seçilmedi"}</span> — {e.point} puan{e.estimatedIncome ? ` · Getiri ${e.estimatedIncome.toLocaleString("tr-TR")} ${e.estimatedIncomeCurrency}` : ""}{e.yokoten ? " · Yokoten uygulanabilir" : ""}</p>)}
          </div>
        )}

        {!readOnly && (
          <div className="border-t border-slate-100 pt-6 space-y-5">
            {stage === "board" && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Award className="w-4 h-4" />Değerlendirme kriteri{!settings.boardScoreRequired && <span className="font-normal text-slate-500">(isteğe bağlı)</span>}</p>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {suggestedTier && <span className="text-xs font-semibold bg-teal-50 text-teal-700 rounded-full px-3 py-1 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Gelire göre önerilen: {suggestedTier.category} ({suggestedTier.point} puan)</span>}
                      {selectedCriteria && settings.rewardPerPoint > 0 && <span className="text-xs font-semibold bg-amber-50 text-amber-700 rounded-full px-3 py-1">Ödül: {fmtReward(rewardFor({ point: selectedCriteria.point }, settings)!)}</span>}
                    </div>
                  </div>
                  {sortedCriteria.length === 0 ? (
                    <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">Henüz kriter tanımlanmamış. Kurulum &gt; Değerlendirme Kriterleri bölümünden ekleyin.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {sortedCriteria.map(c => {
                        const on = criteriaId === c.id;
                        return (
                          <button key={c.id} onClick={() => setCriteriaId(c.id)} className={`text-left rounded-xl border p-3.5 cursor-pointer transition-all ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:border-slate-400"}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold">{c.category ? `${c.category} · ` : ""}{c.criteria}</span>
                              <span className={`text-sm font-black tabular-nums ${on ? "text-amber-300" : "text-amber-600"}`}>{c.point} p</span>
                            </div>
                            {c.description && <p className={`text-xs mt-1 ${on ? "text-slate-300" : "text-slate-500"}`}>{c.description}</p>}
                            {(c.minIncome > 0 || c.maxIncome > 0) && <p className={`text-xs mt-1 tabular-nums ${on ? "text-slate-400" : "text-slate-400"}`}>{c.minIncome.toLocaleString("tr-TR")} – {c.maxIncome ? c.maxIncome.toLocaleString("tr-TR") : "∞"} {settings.baseCurrency}</p>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Onaylanan getiri</label>
                    <div className="flex gap-2">
                      <input type="number" min={0} value={income} onChange={e => setIncome(e.target.value)} placeholder="0" className={`${inputCls} w-full`} />
                      <select value={incomeCurrency} onChange={e => setIncomeCurrency(e.target.value)} className={`${inputCls} w-36`}>{currencyChoices(settings, incomeCurrency).map(c => <option key={c} value={c}>{c}</option>)}</select>
                    </div>
                  </div>
                  <div>
                    <p className="block text-sm font-semibold text-slate-700 mb-1.5">Yokoten (yatay yayılım)</p>
                    <div className="inline-flex bg-slate-100 rounded-xl p-1">
                      {([[true, "Yapılabilir"], [false, "Yapılamaz"]] as const).map(([v, l]) => (
                        <button key={l} onClick={() => setYokoten(v)} className={`h-9 px-4 rounded-lg text-sm font-semibold cursor-pointer ${yokoten === v ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
                {yokoten && <textarea value={yokotenDescription} onChange={e => setYokotenDescription(e.target.value)} rows={2} placeholder="Hangi hat/bölümlere yayılabilir?" className={areaCls} />}
              </>
            )}
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Yorum — reddederken gerekçe zorunludur" className={areaCls} />
            <div className="flex gap-3">
              <Button variant="brand" onClick={() => decide(true)} disabled={saving} className="flex-1 h-12"><CheckCircle2 className="w-5 h-5" />Onayla</Button>
              <Button variant="danger" onClick={() => decide(false)} disabled={saving} className="flex-1 h-12"><XCircle className="w-5 h-5" />Reddet</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------- Yokoten & reward follow-ups ----------

function YokotenTab({ suggestions, evaluations, api, showToast, onReload }: { suggestions: KaizenSuggestion[]; evaluations: KaizenEvaluation[]; api: KaizenApi; showToast: (m: string) => void; onReload: () => void }) {
  const rows = useMemo(() => evaluations.filter(e => e.yokoten).map(e => ({ evaluation: e, suggestion: suggestions.find(s => s.id === e.suggestionId) })).filter(r => !!r.suggestion), [evaluations, suggestions]);
  const toggle = async (id: string, implemented: boolean) => {
    const res = await api.post(`evaluations/${id}/yokoten-implemented`, { implemented });
    if (res.success) { showToast(implemented ? "Yokoten uygulaması işaretlendi." : "Yokoten uygulaması geri alındı."); onReload(); }
    else showToast(`Hata: ${res.error || "İşlem başarısız."}`);
  };
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-black text-slate-900">Yokoten Fırsatları ({rows.length})</h3><p className="text-sm text-slate-500">Kurulun yatay yayılıma uygun gördüğü fikirlerin diğer alanlara uygulanma durumu.</p></div>
      {rows.length === 0 ? <EmptyState icon={Share2} title="Yokoten olarak işaretlenmiş öneri yok" /> : (
        <div className="overflow-x-auto"><table className={tableCls}>
          <thead className={theadCls}><tr><th className={thCls}>Konu</th><th className={thCls}>Bölüm</th><th className={thCls}>Açıklama</th><th className={thCls}>Durum</th></tr></thead>
          <tbody>{rows.map(({ evaluation: e, suggestion: s }) => (
            <tr key={e.id} className={trCls}>
              <td className={`${tdCls} font-semibold text-slate-900`}>{s!.subject}</td>
              <td className={tdCls}>{s!.personnelDepartment || "—"}</td>
              <td className={`${tdCls} text-slate-500 max-w-md`}>{e.yokotenDescription || "—"}</td>
              <td className={tdCls}>
                <button onClick={() => toggle(e.id, !e.yokotenImplemented)} className={`h-9 px-3.5 rounded-full text-sm font-semibold cursor-pointer ${e.yokotenImplemented ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{e.yokotenImplemented ? "Uygulandı" : "Bekliyor"}</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  );
}

function RewardTab({ suggestions, evaluations, api, showToast, onReload, settings }: { suggestions: KaizenSuggestion[]; evaluations: KaizenEvaluation[]; api: KaizenApi; showToast: (m: string) => void; onReload: () => void; settings: KaizenSettings }) {
  const rows = useMemo(() => evaluations.map(e => ({ evaluation: e, suggestion: suggestions.find(s => s.id === e.suggestionId) }))
    .filter(r => !!r.suggestion && r.suggestion!.approvalStatus === "Second Approval")
    .sort((a, b) => (b.evaluation.createdAt || "").localeCompare(a.evaluation.createdAt || "")), [evaluations, suggestions]);
  const toggle = async (id: string, paid: boolean) => {
    const res = await api.post(`evaluations/${id}/reward-status`, { status: paid ? "Ödendi" : "Bekliyor" });
    if (res.success) { showToast(paid ? "Ödül ödendi olarak işaretlendi." : "Ödül durumu bekliyor olarak güncellendi."); onReload(); }
    else showToast(`Hata: ${res.error || "İşlem başarısız."}`);
  };
  const pendingPoints = rows.filter(r => (r.evaluation.rewardStatus || "Bekliyor") !== "Ödendi").reduce((sum, r) => sum + (r.evaluation.point || 0), 0);
  const pending = rows.filter(r => (r.evaluation.rewardStatus || "Bekliyor") !== "Ödendi").length;
  // Amount owed per row: the amount fixed at approval/payment, else point × the current rate.
  const rewards = new Map(rows.map(r => [r.evaluation.id, rewardFor(r.evaluation, settings)]));
  const showAmounts = Array.from(rewards.values()).some(Boolean);
  const pendingAmount = rows
    .filter(r => (r.evaluation.rewardStatus || "Bekliyor") !== "Ödendi")
    .reduce((sum, r) => { const w = rewards.get(r.evaluation.id); return w && w.currency === settings.baseCurrency ? sum + w.amount : sum; }, 0);
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div><h3 className="font-black text-slate-900">Ödül Takibi ({rows.length})</h3><p className="text-sm text-slate-500">Onaylanan önerilerin ödül/prim ödemesi.</p></div>
        <p className="text-sm font-semibold text-amber-700 bg-amber-50 rounded-full px-4 py-1.5">{pending} ödeme bekliyor · {pendingPoints} puan{showAmounts && pendingAmount > 0 ? ` · ${pendingAmount.toLocaleString("tr-TR")} ${settings.baseCurrency}` : ""}</p>
      </div>
      {rows.length === 0 ? <EmptyState icon={Gift} title="Onaylanmış öneri bulunamadı" /> : (
        <div className="overflow-x-auto"><table className={tableCls}>
          <thead className={theadCls}><tr><th className={thCls}>Konu</th><th className={thCls}>Ad Soyad</th><th className={thCls}>Puan</th>{showAmounts && <th className={thCls}>Ödül Tutarı</th>}<th className={thCls}>Onaylanan Getiri</th><th className={thCls}>Ödül Durumu</th></tr></thead>
          <tbody>{rows.map(({ evaluation: e, suggestion: s }) => {
            const paid = (e.rewardStatus || "Bekliyor") === "Ödendi";
            return (
              <tr key={e.id} className={trCls}>
                <td className={`${tdCls} font-semibold text-slate-900`}>{s!.subject}</td>
                <td className={tdCls}>{s!.personnelName}</td>
                <td className={`${tdCls} font-bold tabular-nums`}>{e.point}</td>
                {showAmounts && (() => {
                  const w = rewards.get(e.id);
                  return <td className={`${tdCls} tabular-nums`} title={w && !w.snapshot ? "Güncel puan başı ödüle göre; ödendi olarak işaretlenince sabitlenir" : undefined}>{w ? `${fmtReward(w)}${w.snapshot ? "" : " *"}` : "—"}</td>;
                })()}
                <td className={`${tdCls} tabular-nums`}>{e.estimatedIncome ? `${e.estimatedIncome.toLocaleString("tr-TR")} ${e.estimatedIncomeCurrency}` : "—"}</td>
                <td className={tdCls}><button onClick={() => toggle(e.id, !paid)} className={`h-9 px-3.5 rounded-full text-sm font-semibold cursor-pointer ${paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{paid ? "Ödendi" : "Bekliyor"}</button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </Card>
  );
}
