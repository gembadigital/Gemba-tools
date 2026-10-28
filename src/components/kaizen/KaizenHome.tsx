import React, { useMemo, useState, useEffect } from "react";
import type { KaizenApi } from "./KaizenSuggestionSystem";
import {
  Plus, ListChecks, Trophy, Clock, Lightbulb, ArrowRight, Hourglass, Sparkles, PencilLine,
  Users, Gavel, Hammer, CheckCircle2, XCircle, Send, Medal, PartyPopper
} from "lucide-react";
import { KaizenSuggestion, KaizenEvaluation, KaizenPersonnel } from "./kaizenTypes";
import { isRejected, journeyOf } from "./kaizenCalc";
import { awaitingFirstDecision } from "../../utils/kaizenSettings";
import { Card, SectionTitle, StatusBadge, Button, EmptyState, MiniJourney, Avatar } from "./kaizenUi";

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
  onShowImplementation: () => void;
  onEditSuggestion: (s: KaizenSuggestion) => void;
  canSeeApprovals: boolean;
  api: KaizenApi;
  kiosk?: boolean; // shared tablet: only the person's own next steps
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar";
};
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "—");

// Personal landing page, built around one question: "what is my next step?". Top to bottom:
// a hero with the primary action, the things waiting on me (if any), where my suggestions are in
// the flow, my recent suggestions with their progress, and this month's champions for motivation.
// Every number is scoped to the signed-in user except the champions card.
export default function KaizenHome({
  currentUser, personnelRecord, suggestions, evaluations, managerQueueCount, boardQueueCount,
  oldestWaitingDays, waitingWarningDays, waitingOverdueDays, onNewSuggestion, onShowMine, onShowApprovals,
  onShowImplementation, onEditSuggestion, canSeeApprovals, api, kiosk
}: Props) {
  const myEmail = (currentUser?.email || "").toLowerCase();
  const mine = useMemo(() => suggestions.filter(s => (s.authorEmail || "").toLowerCase() === myEmail), [suggestions, myEmail]);

  const pipeline = useMemo(() => {
    const waiting = mine.filter(s => awaitingFirstDecision(s)).length;
    const inBoard = mine.filter(s => s.approvalStatus === "First Approval" && !awaitingFirstDecision(s)).length;
    const accepted = mine.filter(s => s.approvalStatus === "Second Approval" && !s.completed).length;
    const done = mine.filter(s => s.completed).length;
    const rejected = mine.filter(s => isRejected(s.approvalStatus)).length;
    return { waiting, inBoard, accepted, done, rejected };
  }, [mine]);

  const myPoints = useMemo(() => {
    const ids = new Set(mine.map(s => s.id));
    return evaluations.filter(e => ids.has(e.suggestionId)).reduce((sum, e) => sum + (e.point || 0), 0);
  }, [evaluations, mine]);

  const monthKey = new Date().toISOString().slice(0, 7);
  const thisMonthMine = mine.filter(s => (s.createdAt || "").startsWith(monthKey)).length;

  // Ayın şampiyonları comes from the server company-wide (the lists here only hold what this person
  // may see since Faz 3.4).
  const [champions, setChampions] = useState<{ name: string; department: string; points: number; count: number }[]>([]);
  useEffect(() => {
    let alive = true;
    api.get(`champions?month=${monthKey}`).then(rows => { if (alive) setChampions(rows || []); });
    return () => { alive = false; };
  }, [monthKey]);

  const recent = useMemo(
    () => [...mine].sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")).slice(0, 6),
    [mine]
  );
  const toRevise = mine.filter(s => isRejected(s.approvalStatus));

  // "Sizden beklenenler": concrete next actions, most urgent first.
  const actions: { key: string; icon: any; tone: string; title: string; text: string; cta: string; onClick: () => void }[] = [];
  if (canSeeApprovals && managerQueueCount > 0) actions.push({
    key: "mgr", icon: Users, tone: "amber", title: `${managerQueueCount} öneri onayınızı bekliyor`,
    text: "Ekibinizden gelen öneriler için Amir kararı.", cta: "Değerlendir", onClick: onShowApprovals
  });
  if (canSeeApprovals && boardQueueCount > 0) actions.push({
    key: "board", icon: Gavel, tone: "blue", title: `${boardQueueCount} öneri Kurul'da`,
    text: "Kurul değerlendirmesi ve puanlama bekliyor.", cta: "Kurula git", onClick: onShowApprovals
  });
  if (toRevise.length > 0) actions.push({
    key: "revise", icon: PencilLine, tone: "red", title: `${toRevise.length} önerinizi güncelleyebilirsiniz`,
    text: "Reddedilen öneriyi gerekçeye göre düzenleyip yeniden gönderin.", cta: "Düzenle", onClick: () => onEditSuggestion(toRevise[0])
  });
  if (pipeline.accepted > 0 && !kiosk) actions.push({
    key: "impl", icon: Hammer, tone: "emerald", title: `${pipeline.accepted} kabul edilen öneri uygulamada`,
    text: "Uygulama planını ve önce/sonra ölçümünü takip edin.", cta: "Uygulamaya git", onClick: onShowImplementation
  });
  const toneCls: Record<string, string> = {
    amber: "bg-amber-50 text-amber-600 ring-amber-200/70",
    blue: "bg-blue-50 text-blue-600 ring-blue-200/70",
    red: "bg-red-50 text-red-600 ring-red-200/70",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-200/70"
  };

  const stages: { key: string; label: string; value: number; icon: any; color: string }[] = [
    { key: "waiting", label: "Onay bekliyor", value: pipeline.waiting, icon: Send, color: "text-amber-600 bg-amber-50" },
    { key: "board", label: "Kurul'da", value: pipeline.inBoard, icon: Gavel, color: "text-blue-600 bg-blue-50" },
    { key: "accepted", label: "Kabul / Uygulamada", value: pipeline.accepted, icon: Hammer, color: "text-teal-600 bg-teal-50" },
    { key: "done", label: "Uygulandı", value: pipeline.done, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" }
  ];

  const facts = [personnelRecord?.employeeNo && `Sicil ${personnelRecord.employeeNo}`, personnelRecord?.department, personnelRecord?.jobTitle, personnelRecord?.shift && `${personnelRecord.shift} vardiyası`].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-900 text-white p-6 sm:p-8 shadow-[0_24px_48px_-24px_rgba(6,78,59,0.55)]">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-emerald-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 w-72 h-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
          <div className="flex items-center gap-4 min-w-0 lg:flex-1">
            <Avatar name={currentUser?.full_name} size="lg" className="!from-white/15 !to-white/5 ring-1 ring-white/20 backdrop-blur" />
            <div className="min-w-0">
              <p className="text-sm text-emerald-200/90 font-medium">{greeting()},</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{currentUser?.full_name || "Hoş geldiniz"}</h2>
              <div className="flex flex-wrap gap-2 mt-3">
                {(facts.length ? facts : ["Personel kaydı bulunamadı"]).map(f => (
                  <span key={f} className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 ring-1 ring-white/15 text-white/85">{f}</span>
                ))}
                {personnelRecord?.teamLeaderName && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10 ring-1 ring-white/15 text-white/85">Amir: {personnelRecord.teamLeaderName}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-stretch gap-3">
            <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur px-5 py-4 min-w-[8.5rem]">
              <p className="text-xs text-white/70 font-medium flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-amber-300" />Öneri puanım</p>
              <p className="text-3xl font-bold tabular-nums mt-1">{myPoints}</p>
            </div>
            <div className="rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur px-5 py-4 min-w-[8.5rem]">
              <p className="text-xs text-white/70 font-medium flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-amber-300" />Bu ay</p>
              <p className="text-3xl font-bold tabular-nums mt-1">{thisMonthMine}<span className="text-sm font-medium text-white/60 ml-1">öneri</span></p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onNewSuggestion}
            className="group inline-flex items-center justify-center gap-2.5 h-12 px-6 rounded-2xl bg-white text-slate-900 text-base font-bold shadow-lg shadow-black/20 hover:bg-emerald-50 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center group-hover:rotate-90 transition-transform"><Plus className="w-4 h-4" /></span>
            Yeni öneri ver
          </button>
          <button
            onClick={onShowMine}
            className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl text-sm font-semibold text-white/90 ring-1 ring-white/20 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ListChecks className="w-4 h-4" />Önerilerimi gör ({mine.length})
          </button>
        </div>
      </section>

      {/* Next actions */}
      {(actions.length > 0 || (canSeeApprovals && oldestWaitingDays >= waitingWarningDays)) && (
        <section aria-label="Sizden beklenenler" className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 px-1">Sizden beklenenler</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {actions.map(a => (
              <button key={a.key} onClick={a.onClick} className="group text-left bg-white rounded-2xl p-4 ring-1 ring-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.25)] transition-all cursor-pointer flex gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40">
                <span className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center shrink-0 ${toneCls[a.tone]}`}><a.icon className="w-5 h-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">{a.title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{a.text}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 mt-2">{a.cta}<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" /></span>
                </span>
              </button>
            ))}
          </div>
          {canSeeApprovals && oldestWaitingDays >= waitingWarningDays && (
            <p className={`flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 ${oldestWaitingDays >= waitingOverdueDays ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
              <Hourglass className="w-4 h-4 shrink-0" />Kuyruktaki en eski öneri {oldestWaitingDays} gündür karar bekliyor
            </p>
          )}
        </section>
      )}

      {/* Where my suggestions are */}
      <Card>
        <SectionTitle
          icon={Sparkles}
          title="Önerilerim nerede?"
          hint={mine.length === 0 ? "İlk önerinizi verdiğinizde süreç burada görünür" : `${mine.length} önerinin süreçteki dağılımı`}
          right={pipeline.rejected > 0 ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-3 py-1"><XCircle className="w-3.5 h-3.5" />{pipeline.rejected} reddedildi</span> : undefined}
        />
        <ol className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stages.map((st, i) => (
            <li key={st.key}>
              <button onClick={st.key === "accepted" || st.key === "done" ? onShowImplementation : onShowMine} className="relative w-full text-left rounded-2xl bg-slate-50/80 ring-1 ring-slate-200/60 p-4 hover:bg-white hover:ring-slate-300 transition-all cursor-pointer">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${st.color}`}><st.icon className="w-4.5 h-4.5" /></span>
                <span className="block text-3xl font-bold text-slate-900 tabular-nums mt-3 leading-none">{st.value}</span>
                <span className="block text-sm font-medium text-slate-600 mt-1.5">{st.label}</span>
                {i < stages.length - 1 && (
                  <ArrowRight aria-hidden className="hidden lg:block absolute top-1/2 -right-[1.05rem] -translate-y-1/2 w-4 h-4 text-slate-300" />
                )}
              </button>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent suggestions with their progress */}
        <Card className="xl:col-span-2">
          <SectionTitle
            icon={Clock}
            title="Son hareketler"
            hint="En son güncellenen önerileriniz"
            right={mine.length > 0 ? <Button variant="outline" onClick={onShowMine} className="h-9">Tümü<ArrowRight className="w-4 h-4" /></Button> : undefined}
          />
          {recent.length === 0 ? (
            <div className="flex flex-col items-center text-center py-6">
              <EmptyState icon={Lightbulb} title="Henüz öneriniz yok" text="Çalıştığınız yerde gördüğünüz bir israfı ya da iyileştirme fikrini yazın — birkaç dakika sürer." />
              <Button variant="brand" onClick={onNewSuggestion} className="h-11 px-5"><Plus className="w-4 h-4" />İlk önerimi ver</Button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 -mx-1">
              {recent.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => (isRejected(s.approvalStatus) ? onEditSuggestion(s) : onShowMine())}
                    className="w-full text-left flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-1 py-3.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900 truncate">{s.subject}</span>
                      <span className="block text-xs text-slate-500 mt-0.5 truncate">
                        {fmtDate(s.createdAt)}{(s.suggestionTypes || []).length ? ` · ${(s.suggestionTypes || []).join(", ")}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <MiniJourney steps={journeyOf(s)} />
                      <StatusBadge status={s.approvalStatus} requiredStages={s.requiredStages} feasibility={s.feasibility?.status === "open"} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {/* Champions of the month */}
          <Card className="relative overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-200/40 blur-2xl" />
            <div className="relative">
              <SectionTitle icon={Medal} title="Ayın Kaizen şampiyonları" hint={new Date().toLocaleDateString("tr-TR", { month: "long", year: "numeric" })} />
              {champions.length === 0 ? (
                <p className="text-sm text-slate-500 flex items-center gap-2"><PartyPopper className="w-4 h-4 text-amber-500" />Bu ay henüz puanlanan öneri yok — ilk siz olun.</p>
              ) : (
                <ol className="space-y-2.5">
                  {champions.map((c, i) => (
                    <li key={c.name} className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? "bg-amber-400 text-amber-950" : i === 1 ? "bg-slate-200 text-slate-700" : "bg-orange-200 text-orange-900"}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 truncate">{c.name}</span>
                        <span className="block text-xs text-slate-500 truncate">{c.department || "—"} · {c.count} öneri</span>
                      </span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{c.points}<span className="text-xs font-medium text-slate-400 ml-0.5">p</span></span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>

          {/* How it works */}
          <Card>
            <SectionTitle icon={Lightbulb} title="Nasıl çalışır?" />
            <ol className="relative space-y-4 before:absolute before:left-[0.9rem] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
              {[
                ["Öneriyi yazın", "Mevcut durum, iyileştirme ve tahmini kazanç."],
                ["Amir onayı", "Takım lideriniz değerlendirir."],
                ["Kurul değerlendirmesi", "Puan, kazanç ve yaygınlaştırma kararı."],
                ["Uygulama ve ödül", "Uygulanan öneri puan ve ödüle dönüşür."]
              ].map(([t, d], i) => (
                <li key={t} className="relative flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-white ring-2 ring-emerald-500 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0 z-10">{i + 1}</span>
                  <span className="text-sm text-slate-600 pt-0.5"><span className="font-semibold text-slate-900">{t}</span> — {d}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
