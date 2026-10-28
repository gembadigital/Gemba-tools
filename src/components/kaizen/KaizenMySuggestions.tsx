import React, { useState, useMemo } from "react";
import {
  Edit3, X, Undo2, Search, Check, Circle, XCircle, Lightbulb, MessageSquare, Trophy, ChevronRight,
  Users, User, Coins, Wrench, Calendar, ImageIcon, ArrowRight, ShieldAlert, Leaf, Smile
} from "lucide-react";
import { KaizenSuggestion, KaizenApproval, KaizenEvaluation, KaizenPersonnel } from "./kaizenTypes";
import { personOfSuggestion } from "../../utils/kaizenOrg";
import { canEditSuggestion, isRejected, journeyOf } from "./kaizenCalc";
import { KaizenApi, useFullRecord } from "./KaizenSuggestionSystem";
import { KaizenSettings, rewardFor, awaitingFirstDecision } from "../../utils/kaizenSettings";
import { Card, StatusBadge, Button, EmptyState, MiniJourney, Avatar, inputCls } from "./kaizenUi";

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
  personnel: KaizenPersonnel[];
  teamIds: Set<string>; // everyone below me in the hierarchy, any depth
}

// Status groups in plain words — what people actually ask: "is it waiting, accepted, done?"
const GROUPS: { key: string; label: string; test: (s: KaizenSuggestion) => boolean }[] = [
  { key: "all", label: "Tümü", test: () => true },
  { key: "waiting", label: "Karar bekliyor", test: s => awaitingFirstDecision(s) },
  { key: "board", label: "Kurul'da", test: s => s.approvalStatus === "First Approval" && !awaitingFirstDecision(s) },
  { key: "accepted", label: "Kabul edildi", test: s => s.approvalStatus === "Second Approval" && !s.completed },
  { key: "done", label: "Uygulandı", test: s => !!s.completed },
  { key: "rejected", label: "Reddedildi", test: s => isRejected(s.approvalStatus) }
];

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "—");
const money = (n: number, cur: string) => `${(n || 0).toLocaleString("tr-TR")} ${cur || ""}`.trim();

export default function KaizenMySuggestions({ currentUser, suggestions, approvals, evaluations, onEdit, api, showToast, onReload, settings, personnel, teamIds }: Props) {
  const myEmail = (currentUser?.email || "").toLowerCase();
  // A suggestion shows here if I authored it, I am its direct supervisor, or its person is anywhere
  // in my team (Faz 3.1, any depth). The scope switch separates mine from my team's.
  const mineAll = useMemo(
    () => suggestions.filter(s => {
      if ((s.authorEmail || "").toLowerCase() === myEmail || (s.teamLeaderEmail || "").toLowerCase() === myEmail) return true;
      const person = teamIds.size ? personOfSuggestion(s, personnel) : undefined;
      return !!person && teamIds.has(person.id);
    }),
    [suggestions, myEmail, teamIds, personnel]
  );
  const hasTeam = mineAll.some(s => (s.authorEmail || "").toLowerCase() !== myEmail);

  const [scope, setScope] = useState<"all" | "me" | "team">("all");
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<KaizenSuggestion | null>(null);

  const scoped = useMemo(() => mineAll.filter(s => {
    const isMine = (s.authorEmail || "").toLowerCase() === myEmail;
    return scope === "all" || (scope === "me" ? isMine : !isMine);
  }), [mineAll, scope, myEmail]);

  const counts = useMemo(() => Object.fromEntries(GROUPS.map(g => [g.key, scoped.filter(g.test).length])), [scoped]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const test = GROUPS.find(g => g.key === group)!.test;
    return scoped
      .filter(test)
      .filter(s => !q || `${s.subject} ${s.personnelName} ${s.personnelDepartment}`.toLocaleLowerCase("tr").includes(q))
      .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
  }, [scoped, group, query]);

  const pointsBySuggestion = useMemo(() => {
    const m = new Map<string, number>();
    evaluations.forEach(e => m.set(e.suggestionId, (m.get(e.suggestionId) || 0) + (e.point || 0)));
    return m;
  }, [evaluations]);

  const withdraw = async (s: KaizenSuggestion) => {
    if (!window.confirm(`"${s.subject}" önerisini geri çekmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
    const res = await api.post(`suggestions/${s.id}/withdraw`, {});
    if (res.success) { showToast("Öneri geri çekildi."); setDetail(null); onReload(); }
    else showToast(`Hata: ${res.error || "Geri çekilemedi."}`);
  };

  return (
    <div className="space-y-5">
      {/* Header + filters */}
      <Card className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Önerilerim</h2>
            <p className="text-sm text-slate-500 mt-1">
              {hasTeam ? "Kendi önerileriniz ve ekibinizin önerileri." : "Verdiğiniz öneriler ve süreçteki yerleri."} {filtered.length} / {scoped.length} gösteriliyor.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 lg:w-auto">
            {hasTeam && (
              <div role="tablist" aria-label="Kapsam" className="inline-flex bg-slate-100 rounded-xl p-1 gap-1 shrink-0">
                {([["all", "Tümü", null], ["me", "Benim", User], ["team", "Ekibim", Users]] as const).map(([k, l, Icon]) => (
                  <button key={k} role="tab" aria-selected={scope === k} onClick={() => setScope(k)}
                    className={`h-9 px-3.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${scope === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                    {Icon && <Icon className="w-4 h-4" />}{l}
                  </button>
                ))}
              </div>
            )}
            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Konu, kişi veya bölüm ara…" className={`${inputCls} !h-11 pl-10`} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {GROUPS.map(g => {
            const active = group === g.key;
            return (
              <button key={g.key} onClick={() => setGroup(g.key)} aria-pressed={active}
                className={`shrink-0 h-9 px-3.5 rounded-full text-sm font-semibold cursor-pointer transition-all flex items-center gap-2 ${active ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:ring-slate-300"}`}>
                {g.label}
                <span className={`min-w-5 h-5 px-1.5 rounded-full text-xs tabular-nums flex items-center justify-center ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>{counts[g.key] || 0}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card><EmptyState icon={Lightbulb} title="Bu filtrede öneri yok" text="Filtreyi değiştirin ya da yeni bir öneri verin." /></Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map(s => {
            const isMine = (s.authorEmail || "").toLowerCase() === myEmail;
            const pts = pointsBySuggestion.get(s.id);
            const photoCount = (s.photoCounts?.photosCurrent || 0) + (s.photoCounts?.photosPropose || 0);
            return (
              <li key={s.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetail(s)}
                  onKeyDown={e => { if (e.key === "Enter") setDetail(s); }}
                  className="group bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.25)] hover:ring-slate-300 transition-all cursor-pointer p-4 sm:p-5 flex gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                >
                  <div className={`hidden sm:flex w-16 h-16 rounded-xl shrink-0 flex-col items-center justify-center gap-0.5 ${photoCount ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-300"}`} title={photoCount ? `${photoCount} fotoğraf` : "Fotoğraf yok"}>
                    <ImageIcon className="w-6 h-6" />
                    {photoCount > 0 && <span className="text-[11px] font-bold tabular-nums">{photoCount}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-900 leading-snug line-clamp-2">{s.subject}</p>
                        <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{fmtDate(s.createdAt)}</span>
                          {!isMine && <span className="inline-flex items-center gap-1 font-semibold text-slate-700"><Users className="w-3.5 h-3.5" />{s.personnelName}</span>}
                          {(s.suggestionTypes || []).length > 0 && <span>{(s.suggestionTypes || []).join(" · ")}</span>}
                        </p>
                      </div>
                      <StatusBadge status={s.approvalStatus} requiredStages={s.requiredStages} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-sm">
                        <MiniJourney steps={journeyOf(s)} />
                        {s.estimatedSaving > 0 && <span className="text-slate-600 tabular-nums"><span className="text-slate-400">Kazanç </span><b className="text-slate-900">{money(s.estimatedSaving, s.estimatedSavingCurrency)}</b></span>}
                        {!!pts && <span className="inline-flex items-center gap-1 text-amber-600 font-semibold tabular-nums"><Trophy className="w-3.5 h-3.5" />{pts} p</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {canEditSuggestion(s.approvalStatus) && isMine && (
                          <Button variant="outline" className="h-9 px-3" onClick={e => { e.stopPropagation(); onEdit(s); }}><Edit3 className="w-4 h-4" />Düzenle</Button>
                        )}
                        {awaitingFirstDecision(s) && isMine && (
                          <button onClick={e => { e.stopPropagation(); withdraw(s); }} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer" title="Öneriyi geri çek">
                            <Undo2 className="w-4 h-4" /><span className="hidden sm:inline">Geri çek</span>
                          </button>
                        )}
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {detail && (
        <DetailDrawer
          api={api}
          settings={settings}
          suggestion={detail}
          approvals={approvals.filter(a => a.suggestionId === detail.id).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))}
          evaluations={evaluations.filter(e => e.suggestionId === detail.id)}
          canEdit={canEditSuggestion(detail.approvalStatus) && (detail.authorEmail || "").toLowerCase() === myEmail}
          canWithdraw={awaitingFirstDecision(detail) && (detail.authorEmail || "").toLowerCase() === myEmail}
          onEdit={() => { const s = detail; setDetail(null); onEdit(s); }}
          onWithdraw={() => withdraw(detail)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function DetailDrawer({ suggestion: listItem, approvals, evaluations, canEdit, canWithdraw, onEdit, onWithdraw, onClose, settings, api }: {
  settings: KaizenSettings; api: KaizenApi;
  suggestion: KaizenSuggestion; approvals: KaizenApproval[]; evaluations: KaizenEvaluation[];
  canEdit: boolean; canWithdraw: boolean; onEdit: () => void; onWithdraw: () => void; onClose: () => void;
}) {
  // The list item has no photos (Faz 3.4); show it right away and swap in the full record.
  const { data: full, loading } = useFullRecord<KaizenSuggestion>(api, `suggestions/${listItem.id}`);
  const s = full || listItem;
  const steps = journeyOf(s);
  const facts: [string, string | undefined][] = [
    ["Sicil no", s.personnelEmployeeNo], ["Bölüm", s.personnelDepartment], ["Görev", s.personnelJobTitle], ["Vardiya", s.shift], ["Amir", s.teamLeaderName],
    ["Aşama", s.stage], ["Kazanç süresi", s.paybackPeriod]
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-modal="true" aria-label="Öneri detayı">
      <aside className="bg-[#fafafa] w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col animate-toast-in" onClick={e => e.stopPropagation()}>
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200/70">
          <div className="h-1 bg-gradient-to-r from-amber-400 via-emerald-500 to-teal-400" />
          <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4">
            <div className="min-w-0 flex items-start gap-3">
              <Avatar name={s.personnelName} />
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900 leading-snug">{s.subject}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{s.personnelName} · {fmtDate(s.createdAt)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                  <StatusBadge status={s.approvalStatus} requiredStages={s.requiredStages} />
                  {(s.suggestionTypes || []).map(t => <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{t}</span>)}
                </div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Kapat" className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="p-5 sm:p-6 space-y-5 flex-1">
          {/* Journey */}
          <Card>
            <ol className="flex items-start">
              {steps.map((step, i) => {
                const color = step.state === "done" ? "bg-emerald-600 text-white" : step.state === "current" ? "bg-amber-400 text-amber-950 ring-4 ring-amber-100" : step.state === "rejected" ? "bg-red-500 text-white" : "bg-slate-100 text-slate-400";
                const Icon = step.state === "done" ? Check : step.state === "rejected" ? XCircle : Circle;
                return (
                  <li key={step.key} className="flex-1 flex flex-col items-center text-center gap-2 relative">
                    {i > 0 && <span className={`absolute top-[1.05rem] right-1/2 w-full h-0.5 -z-0 ${step.state === "todo" ? "bg-slate-200" : "bg-emerald-500"}`} />}
                    <span className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></span>
                    <span className={`text-xs font-semibold px-1 ${step.state === "todo" ? "text-slate-400" : "text-slate-700"}`}>{step.label}</span>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Before / after */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([["Önce — mevcut durum", s.currentState, s.photosCurrent, "bg-red-50/70 ring-red-100 text-red-700"], ["Sonra — önerilen iyileştirme", s.improvementSuggestion, s.photosPropose, "bg-emerald-50/70 ring-emerald-100 text-emerald-700"]] as const).map(([label, text, photos, tint]) => (
              <div key={label} className={`rounded-2xl ring-1 p-4 ${tint.split(" ").slice(0, 2).join(" ")}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${tint.split(" ")[2]}`}>{label}</p>
                <p className="text-sm text-slate-800 mt-2 whitespace-pre-wrap leading-relaxed">{text || "—"}</p>
                {loading && <div className="h-20 rounded-xl bg-white/60 animate-pulse mt-3" />}
                {(photos || []).length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {(photos || []).map((p, i) => (
                      <a key={i} href={p.dataUrl} target="_blank" rel="noreferrer" className="block"><img src={p.dataUrl} alt="" className="w-full aspect-[4/3] object-cover rounded-xl ring-1 ring-white" /></a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Money + facts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 p-4"><p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5"><Coins className="w-3.5 h-3.5 text-emerald-600" />Tahmini kazanç</p><p className="text-xl font-bold text-slate-900 tabular-nums mt-1">{money(s.estimatedSaving, s.estimatedSavingCurrency)}</p></div>
            <div className="rounded-2xl bg-white ring-1 ring-slate-200/70 p-4"><p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-slate-500" />Tahmini maliyet</p><p className="text-xl font-bold text-slate-900 tabular-nums mt-1">{money(s.estimatedCost, s.estimatedCostCurrency)}</p></div>
          </div>
          <Card>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3">
              {facts.map(([l, v]) => <div key={l}><dt className="text-xs text-slate-500">{l}</dt><dd className="text-sm font-semibold text-slate-900 mt-0.5">{v || "—"}</dd></div>)}
            </dl>
            {(s.isg || s.cevre || s.motivasyon) && (
              <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-slate-100">
                {s.isg && <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600"><ShieldAlert className="w-3.5 h-3.5" />İSG</span>}
                {s.cevre && <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700"><Leaf className="w-3.5 h-3.5" />Çevre</span>}
                {s.motivasyon && <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700"><Smile className="w-3.5 h-3.5" />Motivasyon</span>}
              </div>
            )}
          </Card>

          {evaluations.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 ring-1 ring-amber-200/70 p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5"><Trophy className="w-4 h-4" />Kurul değerlendirmesi</p>
              {evaluations.map(e => {
                const w = rewardFor(e, settings);
                return (
                  <div key={e.id} className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-amber-800/70">Kriter</p><p className="font-semibold text-slate-900">{e.criteriaLabel || "—"}</p></div>
                    <div><p className="text-xs text-amber-800/70">Puan</p><p className="font-bold text-slate-900 tabular-nums">{e.point}</p></div>
                    <div><p className="text-xs text-amber-800/70">Onaylanan getiri</p><p className="font-semibold text-slate-900 tabular-nums">{e.estimatedIncome ? money(e.estimatedIncome, e.estimatedIncomeCurrency) : "—"}</p></div>
                    <div><p className="text-xs text-amber-800/70">Ödül</p><p className="font-semibold text-slate-900">{e.rewardStatus || "Bekliyor"}{w ? ` · ${money(w.amount, w.currency)}` : ""}</p></div>
                    {e.yokoten && <p className="col-span-full text-xs text-amber-900/80 flex items-center gap-1.5"><ArrowRight className="w-3.5 h-3.5" />Yaygınlaştırma: {e.yokotenImplemented ? "uygulandı" : "uygulanabilir, bekliyor"}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {approvals.length > 0 && (
            <Card>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Karar geçmişi</p>
              <ol className="relative space-y-4 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                {approvals.map(a => (
                  <li key={a.id} className="relative flex gap-3">
                    <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ring-4 ring-white ${a.approved ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                      {a.approved ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {a.stage === "Manager" ? "Amir" : "Kaizen Kurulu"} · {a.approverName}
                        <span className={`ml-2 text-xs font-bold ${a.approved ? "text-emerald-700" : "text-red-600"}`}>{a.approved ? "onayladı" : "reddetti"}</span>
                      </p>
                      <p className="text-xs text-slate-400">{fmtDate(a.createdAt)}</p>
                      {a.comment && (
                        <p className="mt-2 text-sm text-slate-700 bg-slate-50 rounded-xl px-3.5 py-2.5 flex gap-2"><MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />{a.comment}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        {(canEdit || canWithdraw) && (
          <footer className="px-5 sm:px-6 py-4 border-t border-slate-200 flex gap-3 sticky bottom-0 bg-white/95 backdrop-blur">
            {canEdit && <Button variant="brand" onClick={onEdit} className="flex-1 h-11"><Edit3 className="w-4 h-4" />Düzenle ve yeniden gönder</Button>}
            {canWithdraw && <Button variant="outline" onClick={onWithdraw} className="flex-1 h-11 !text-red-600"><Undo2 className="w-4 h-4" />Öneriyi geri çek</Button>}
          </footer>
        )}
      </aside>
    </div>
  );
}
