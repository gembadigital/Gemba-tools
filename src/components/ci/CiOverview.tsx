// "Genel Bakış" — the CI module's landing dashboard (plan step C7, requirements A1 / A2 / A8): four
// headline figures, what waits for the signed-in user's approval, what needs attention, where the
// projects stand in the 8 A3 steps and how each project leader is doing against the step plan.
import React from "react";
import { Activity, AlertTriangle, ShieldCheck, CheckCircle2, Clock, Users, Layers, ChevronRight, Hourglass } from "lucide-react";
import type { KaizenCard } from "../../types";
import { CiUserLike, isClosed } from "../../utils/ciLifecycle";
import { FxRates } from "./ciMoney";
import { projectMoney } from "./ciFinance";
import { attentionFor, awaitingMyApproval, leaderPerformance, onTimePct, stageDistribution, isActive, Attention } from "./ciPerformance";
import { Card, SectionTitle, KpiCard, EmptyState, Pill, formatAmount, tableCls, theadCls, thCls, tdCls, trCls } from "./ciUi";
import { StageBadge } from "./CiProjectCard";

interface Props {
  projects: KaizenCard[];
  currentUser: CiUserLike | null;
  currencySymbol: string;
  fxRates: FxRates;
  projectNo: (k: KaizenCard) => string;
  onOpenProject: (k: KaizenCard) => void;
  onShowFinance: () => void;
}

const short = (n: number) => Math.abs(n) >= 1e6 ? `${formatAmount(n / 1e6, 1)}\u00a0Mn` : Math.abs(n) >= 1e3 ? `${formatAmount(n / 1e3, 0)}\u00a0B` : formatAmount(n, 0);
const KIND_TONE: Record<Attention["kind"], "red" | "amber" | "slate" | "violet"> = {
  approval: "violet", stageLate: "amber", projectLate: "red", actionsLate: "red", stale: "slate"
};

export default function CiOverview({ projects, currentUser, currencySymbol, fxRates, projectNo, onOpenProject, onShowFinance }: Props) {
  const todayIso = new Date().toISOString().split("T")[0];
  const live = projects.filter(k => k.holdState !== "cancelled");
  const active = live.filter(isActive);
  const closed = live.filter(isClosed);
  const attention = active.flatMap(k => attentionFor(k, todayIso));
  const lateProjects = new Set(attention.filter(a => a.kind !== "stale").map(a => a.project.id));
  const mine = awaitingMyApproval(projects, currentUser);
  const money = live.map(k => projectMoney(k, currencySymbol, fxRates));
  const expected = money.reduce((s, m) => s + (m.expected ?? 0), 0);
  const confirmed = money.reduce((s, m) => s + (m.confirmed ? m.realized ?? 0 : 0), 0);
  const closeRate = live.length ? Math.round((closed.length / live.length) * 100) : null;
  const dist = stageDistribution(projects);
  const distMax = Math.max(1, ...dist.steps.map(s => s.count));
  const leaders = leaderPerformance(projects, todayIso);

  // Attention grouped per project, worst first (late project > late step > late actions > stale).
  const order: Attention["kind"][] = ["projectLate", "stageLate", "actionsLate", "stale"];
  const byProject = Array.from(new Set(attention.map(a => a.project.id)))
    .map(id => attention.filter(a => a.project.id === id))
    .sort((a, b) => Math.min(...a.map(x => order.indexOf(x.kind))) - Math.min(...b.map(x => order.indexOf(x.kind))));

  if (!projects.length) {
    return <Card><EmptyState icon={Layers} title="Henüz CI projesi yok" text="Sağ üstteki 'Yeni CI projesi' ile ilk projeyi başlatın." /></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Aktif proje" value={active.length} icon={Activity} tone="blue" hint={dist.onHold ? `${dist.onHold} askıda` : "Askıda proje yok"} />
        <KpiCard label="Geciken" value={lateProjects.size} icon={AlertTriangle} tone={lateProjects.size ? "red" : "slate"} hint="Aşama ya da hedef tarihi geçen" />
        <KpiCard label="Teyitli kazanç" value={`${currencySymbol}${short(confirmed)}`} icon={ShieldCheck} tone="emerald"
          hint={expected ? `Beklenen ${currencySymbol}${short(expected)}` : "Beklenen kazanç girilmedi"} onClick={onShowFinance} />
        <KpiCard label="Kapanış oranı" value={closeRate === null ? "—" : `%${closeRate}`} icon={CheckCircle2} tone="emerald" hint={`${closed.length} / ${live.length} proje kapandı`} />
      </div>

      {mine.length > 0 && (
        <Card>
          <SectionTitle icon={Hourglass} title={`Onayınızı bekleyen adımlar (${mine.length})`} hint="Proje lideri olarak onaylamanız ya da geri göndermeniz gereken adımlar." />
          <ul className="divide-y divide-slate-100 -mx-1">
            {mine.map(k => (
              <li key={k.id}>
                <button type="button" onClick={() => onOpenProject(k)} className="w-full text-left px-1 py-3 flex items-center gap-3 hover:bg-slate-50 rounded-xl cursor-pointer">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{k.title}</p>
                    <p className="text-xs text-slate-500">{projectNo(k)} · Adım {k.pendingApproval!.stage} · {k.pendingApproval!.by} gönderdi</p>
                  </div>
                  <Pill tone="violet"><Clock className="w-3 h-3" /> Onay bekliyor</Pill>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-3">
          <SectionTitle icon={AlertTriangle} title="Dikkat gerektirenler" hint="Aktif projelerde geciken aşama, hedef tarih ve aksiyonlar; 30 gündür hareketsiz projeler." />
          {byProject.length === 0 ? <EmptyState icon={CheckCircle2} title="Her şey planında" text="Geciken aşama, hedef tarih ya da aksiyon yok." /> : (
            <ul className="divide-y divide-slate-100 -mx-1">
              {byProject.slice(0, 12).map(items => {
                const k = items[0].project;
                return (
                  <li key={k.id}>
                    <button type="button" onClick={() => onOpenProject(k)} className="w-full text-left px-1 py-3 flex items-start gap-3 hover:bg-slate-50 rounded-xl cursor-pointer">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">{k.title}</p>
                          <StageBadge project={k} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{projectNo(k)} · {k.projectLeader || k.originator || "Lider yok"}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {items.map((a, i) => <Pill key={i} tone={KIND_TONE[a.kind]}>{a.text}{a.days ? ` · ${a.days} gün` : ""}</Pill>)}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 mt-1" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {byProject.length > 12 && <p className="text-xs text-slate-500 mt-2">+{byProject.length - 12} proje daha — Liste görünümünden süzebilirsiniz.</p>}
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle icon={Layers} title="A3 adımlarında projeler" hint="Aktif projelerin bulunduğu adım." />
          <ul className="space-y-2">
            {dist.steps.map(s => (
              <li key={s.no} className="grid grid-cols-[minmax(0,170px)_1fr_28px] items-center gap-3 text-sm">
                <span className="text-slate-700 truncate"><span className="font-semibold">{s.no}.</span> {s.label}</span>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${s.no <= 5 ? "bg-blue-500" : s.no === 6 ? "bg-amber-400" : s.no === 7 ? "bg-violet-500" : "bg-emerald-500"}`} style={{ width: `${(s.count / distMax) * 100}%` }} /></div>
                <span className="text-right font-bold tabular-nums text-slate-900">{s.count}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 mt-4">
            <Pill tone="emerald"><CheckCircle2 className="w-3 h-3" /> {dist.closed} kapandı</Pill>
            {dist.onHold > 0 && <Pill tone="amber">{dist.onHold} askıda</Pill>}
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <SectionTitle icon={Users} title="Proje sorumlularının performansı"
            hint="Zamanında oranı: planlanan tarihi olan ve onaylanan adımların kaçı planlanan tarihte ya da önce onaylandı. Adım planı proje kartında Künye & Ekip sekmesinden girilir." />
        </div>
        {leaders.length === 0 ? <div className="px-5 pb-5"><EmptyState icon={Users} title="Veri yok" /></div> : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={thCls}>Proje lideri</th>
                  <th className={`${thCls} text-right`}>Aktif</th>
                  <th className={`${thCls} text-right`}>Kapanan</th>
                  <th className={`${thCls} text-right`}>Zamanında adım</th>
                  <th className={`${thCls} text-right`}>Ort. gecikme</th>
                  <th className={`${thCls} text-right`}>Şu an geciken</th>
                  <th className={`${thCls} text-right`}>Geciken aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map(r => {
                  const pct = onTimePct(r);
                  return (
                    <tr key={r.key} className={trCls}>
                      <td className={`${tdCls} font-semibold text-slate-900`}>{r.name}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{r.active}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{r.closed}</td>
                      <td className={`${tdCls} text-right`}>
                        {pct === null ? <span className="text-slate-400" title="Planlanan tarihi olan onaylı adım yok">—</span> : (
                          <span className="inline-flex items-center gap-2 justify-end">
                            <span className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden hidden sm:inline-block"><span className={`block h-full ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${pct}%` }} /></span>
                            <span className="tabular-nums font-semibold">%{pct}</span>
                            <span className="text-xs text-slate-500 tabular-nums">({r.stepsOnTime}/{r.stepsDone})</span>
                          </span>
                        )}
                      </td>
                      <td className={`${tdCls} text-right tabular-nums`}>{r.avgLateDays === null ? "—" : `${r.avgLateDays} gün`}</td>
                      <td className={`${tdCls} text-right tabular-nums ${r.lateNow ? "text-red-600 font-semibold" : ""}`}>{r.lateNow}</td>
                      <td className={`${tdCls} text-right tabular-nums ${r.actionsLate ? "text-red-600 font-semibold" : ""}`}>{r.actionsLate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
