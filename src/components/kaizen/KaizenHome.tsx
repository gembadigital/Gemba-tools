import React, { useMemo } from "react";
import { Plus, ListChecks, Star, Trophy, CheckCircle2, XCircle, Clock, BadgeCheck, Lightbulb, ArrowRight, Hourglass } from "lucide-react";
import { KaizenSuggestion, KaizenEvaluation, KaizenPersonnel } from "./kaizenTypes";
import { isRejected } from "./kaizenCalc";
import { Card, SectionTitle, KpiCard, StatusBadge, Button, EmptyState, tableCls, theadCls, thCls, tdCls, trCls } from "./kaizenUi";

interface Props {
  currentUser: any;
  personnelRecord?: KaizenPersonnel;
  suggestions: KaizenSuggestion[];
  evaluations: KaizenEvaluation[];
  managerQueueCount: number;
  boardQueueCount: number;
  oldestWaitingDays: number;
  waitingWarningDays: number;
  waitingOverdueDays: number;
  onNewSuggestion: () => void;
  onShowMine: () => void;
  onShowApprovals: () => void;
  canSeeApprovals: boolean;
}

// Personal landing page: who am I, how am I doing, what needs my attention. The legacy Power Apps
// home showed an empty profile strip, an overflowing score and a table of everybody's pending
// suggestions; here every number is scoped to the signed-in user and the right-hand column turns
// the approval queues into an actionable to-do list.
export default function KaizenHome({
  currentUser, personnelRecord, suggestions, evaluations, managerQueueCount, boardQueueCount,
  oldestWaitingDays, waitingWarningDays, waitingOverdueDays, onNewSuggestion, onShowMine, onShowApprovals, canSeeApprovals
}: Props) {
  const myEmail = (currentUser?.email || "").toLowerCase();
  const mine = useMemo(() => suggestions.filter(s => (s.authorEmail || "").toLowerCase() === myEmail), [suggestions, myEmail]);

  const total = mine.length;
  const approved = mine.filter(s => s.approvalStatus === "First Approval" || s.approvalStatus === "Second Approval").length;
  const rejected = mine.filter(s => isRejected(s.approvalStatus)).length;
  const pending = mine.filter(s => s.approvalStatus === "Pending").length;
  const completed = mine.filter(s => s.completed).length;

  const myPoints = useMemo(() => {
    const ids = new Set(mine.map(s => s.id));
    return evaluations.filter(e => ids.has(e.suggestionId)).reduce((sum, e) => sum + (e.point || 0), 0);
  }, [evaluations, mine]);

  const recent = useMemo(
    () => [...mine].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 8),
    [mine]
  );

  const initials = (currentUser?.full_name || "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
  const profileFacts = [
    { label: "Bölüm", value: personnelRecord?.department },
    { label: "Görev", value: personnelRecord?.jobTitle },
    { label: "Vardiya", value: personnelRecord?.shift },
    { label: "Amir", value: personnelRecord?.teamLeaderName }
  ];
  const todoTotal = managerQueueCount + boardQueueCount;

  return (
    <div className="space-y-6">
      {/* Profile + score + primary action */}
      <Card className="flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex items-center gap-4 min-w-0 lg:flex-1">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl font-black shrink-0">{initials}</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hoş geldiniz</p>
            <h2 className="text-2xl font-black text-slate-900 truncate">{currentUser?.full_name}</h2>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-slate-600">
              {profileFacts.map(f => (
                <span key={f.label}><span className="text-slate-400">{f.label}: </span><span className="font-semibold">{f.value || "—"}</span></span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 lg:gap-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Öneri Puanı</p>
            <p className="text-4xl font-black text-amber-500 tabular-nums leading-none mt-1.5 flex items-center justify-center gap-2">
              <Trophy className="w-7 h-7" />{myPoints}
            </p>
          </div>
          <Button variant="brand" onClick={onNewSuggestion} className="h-12 px-6 text-base">
            <Plus className="w-5 h-5" />Yeni Öneri
          </Button>
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard label="Toplam Önerim" value={total} icon={Lightbulb} tone="slate" onClick={onShowMine} />
        <KpiCard label="Onaylanan" value={approved} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Reddedilen" value={rejected} icon={XCircle} tone="red" />
        <KpiCard label="Onay Bekleyen" value={pending} icon={Clock} tone="amber" />
        <KpiCard label="Uygulanan" value={completed} icon={BadgeCheck} tone="teal" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent suggestions */}
        <Card padded={false} className="xl:col-span-2 overflow-hidden">
          <div className="px-5 pt-5">
            <SectionTitle
              icon={ListChecks}
              title="Son Önerilerim"
              hint="En son gönderdiğiniz 8 öneri"
              right={<Button variant="ghost" onClick={onShowMine} className="h-9">Tümünü gör<ArrowRight className="w-4 h-4" /></Button>}
            />
          </div>
          {recent.length === 0 ? (
            <EmptyState icon={Lightbulb} title="Henüz öneriniz yok" text="İlk Kaizen önerinizi oluşturun; sürecinizi her adımda buradan izleyin." />
          ) : (
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead className={theadCls}>
                  <tr><th className={thCls}>Tarih</th><th className={thCls}>Öneri Konusu</th><th className={thCls}>Sınıf</th><th className={thCls}>Durum</th></tr>
                </thead>
                <tbody>
                  {recent.map(s => (
                    <tr key={s.id} className={trCls}>
                      <td className={`${tdCls} whitespace-nowrap tabular-nums`}>{(s.createdAt || "").slice(0, 10)}</td>
                      <td className={`${tdCls} font-semibold text-slate-900`}>{s.subject}</td>
                      <td className={`${tdCls} text-slate-500`}>{(s.suggestionTypes || []).join(", ")}</td>
                      <td className={tdCls}><StatusBadge status={s.approvalStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* To-do column */}
        <div className="space-y-6">
          {canSeeApprovals && (
            <Card>
              <SectionTitle icon={Star} title="Bekleyen İşlerim" hint={todoTotal === 0 ? "Şu an bekleyen kararınız yok" : `${todoTotal} öneri kararınızı bekliyor`} />
              <div className="space-y-2.5">
                <button onClick={onShowApprovals} className="w-full flex items-center justify-between rounded-xl bg-slate-50 hover:bg-slate-100 px-4 py-3 cursor-pointer transition-colors">
                  <span className="text-sm font-semibold text-slate-700">Amir onayı bekleyen</span>
                  <span className="text-lg font-black text-slate-900 tabular-nums">{managerQueueCount}</span>
                </button>
                <button onClick={onShowApprovals} className="w-full flex items-center justify-between rounded-xl bg-slate-50 hover:bg-slate-100 px-4 py-3 cursor-pointer transition-colors">
                  <span className="text-sm font-semibold text-slate-700">Kurul değerlendirmesi bekleyen</span>
                  <span className="text-lg font-black text-slate-900 tabular-nums">{boardQueueCount}</span>
                </button>
                {oldestWaitingDays >= waitingWarningDays && (
                  <p className={`flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 ${oldestWaitingDays >= waitingOverdueDays ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                    <Hourglass className="w-4 h-4 shrink-0" />En eski öneri {oldestWaitingDays} gündür bekliyor
                  </p>
                )}
              </div>
            </Card>
          )}
          <Card>
            <SectionTitle icon={Lightbulb} title="Nasıl çalışır?" />
            <ol className="space-y-3 text-sm text-slate-600">
              {[
                ["Öneriyi yazın", "Mevcut durumu, iyileştirmeyi ve tahmini kazancı girin."],
                ["Amir onayı", "Takım liderinizin onayı ile süreç ilerler."],
                ["Kurul değerlendirmesi", "Kaizen Kurulu puanlar, kazancı ve yokoten fırsatını belirler."],
                ["Uygulama ve ödül", "Uygulanan öneriler puan ve ödül için takip edilir."]
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span><span className="font-semibold text-slate-900">{t}.</span> {d}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
