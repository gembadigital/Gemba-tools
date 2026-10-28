// "Görevlerim" — every CI action assigned to a person, across the customer's projects (plan step
// C3). Customer users see their own; Admin / Consultant can switch to anyone or everyone. Status and
// progress can be updated in place (only the project's `tasks` field is sent).
import React, { useMemo, useState } from "react";
import { ListChecks, AlertTriangle, CalendarClock, CalendarRange, CircleDashed, CheckCircle2, ExternalLink } from "lucide-react";
import type { KaizenCard } from "../../types";
import { CiUserLike, isCiStaffUser, personKey, taskStatusOf, canEditProject, isClosed } from "../../utils/ciLifecycle";
import { taskProgress } from "../../utils/ciPlan";
import { Card, SectionTitle, EmptyState, KpiCard, inputCls } from "./ciUi";
import type { CiPerson } from "./CiProjectCard";
import { StageBadge } from "./CiProjectCard";

interface CiMyTasksProps {
  projects: KaizenCard[];
  currentUser: CiUserLike | null;
  people: CiPerson[];
  projectNo: (p: KaizenCard) => string;
  onOpenProject: (p: KaizenCard) => void;
  onUpdateTasks: (project: KaizenCard, tasks: any[]) => Promise<unknown>;
}

const ME = "__me__";
const ALL = "__all__";
const DAY = 86400000;
const fmtDate = (iso?: string) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR") : "—";

// Does action `t` belong to person (id + name)? Older actions carry only a name.
const ownedBy = (t: any, id?: string, name?: string) =>
  t.responsibleId ? t.responsibleId === id : !!name && personKey(t.responsible) === personKey(name);

type Group = "overdue" | "week" | "later" | "undated" | "done";
const GROUPS: { key: Group; title: string; icon: any; tone: string }[] = [
  { key: "overdue", title: "Termini geçmiş", icon: AlertTriangle, tone: "text-red-600" },
  { key: "week", title: "Bu hafta", icon: CalendarClock, tone: "text-amber-600" },
  { key: "later", title: "Sonra", icon: CalendarRange, tone: "text-slate-600" },
  { key: "undated", title: "Termini yok", icon: CircleDashed, tone: "text-slate-500" },
  { key: "done", title: "Tamamlanan", icon: CheckCircle2, tone: "text-emerald-600" }
];

export default function CiMyTasks({ projects, currentUser, people, projectNo, onOpenProject, onUpdateTasks }: CiMyTasksProps) {
  const staff = isCiStaffUser(currentUser);
  const [who, setWho] = useState<string>(ME);
  const [showDone, setShowDone] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const person = who === ME ? { id: currentUser?.id, name: currentUser?.full_name }
    : who === ALL ? null : { id: who, name: people.find(p => p.id === who)?.name };

  const today = new Date(new Date().toDateString());
  const todayIso = today.toISOString().split("T")[0];
  const weekEndIso = new Date(today.getTime() + (7 - ((today.getDay() + 6) % 7)) * DAY).toISOString().split("T")[0];

  const items = useMemo(() => projects
    .filter(p => !p.holdState)
    .flatMap(p => (Array.isArray(p.tasks) ? p.tasks : []).map((t: any) => ({ p, t })))
    .filter(({ t }) => taskStatusOf(t) !== "İptal" && (!person || ownedBy(t, person.id, person.name)))
    .map(({ p, t }) => {
      const status = taskStatusOf(t);
      const group: Group = status === "Yapıldı" ? "done" : !t.deadline ? "undated"
        : t.deadline < todayIso ? "overdue" : t.deadline <= weekEndIso ? "week" : "later";
      return { p, t, status, group };
    })
    .sort((a, b) => (a.t.deadline || "9999").localeCompare(b.t.deadline || "9999")),
  [projects, who, currentUser, people, todayIso, weekEndIso]);

  const count = (g: Group) => items.filter(i => i.group === g).length;

  const change = async (p: KaizenCard, taskId: string, patch: any) => {
    setBusyId(taskId);
    await onUpdateTasks(p, (p.tasks || []).map((t: any) => t.id === taskId ? { ...t, ...patch } : t));
    setBusyId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Görevlerim</h3>
          <p className="text-sm text-slate-500 mt-0.5">CI projelerindeki aksiyonlar, termine göre. Askıdaki ya da iptal edilen projeler gösterilmez.</p>
        </div>
        {staff && (
          <select className={`${inputCls} sm:w-72`} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Kimin görevleri">
            <option value={ME}>Benim görevlerim</option>
            <option value={ALL}>Tüm aksiyonlar</option>
            {people.filter(p => p.id !== currentUser?.id).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Termini geçmiş" value={count("overdue")} icon={AlertTriangle} tone={count("overdue") ? "red" : "slate"} />
        <KpiCard label="Bu hafta" value={count("week")} icon={CalendarClock} tone="amber" />
        <KpiCard label="Açık toplam" value={items.filter(i => i.group !== "done").length} icon={ListChecks} tone="blue" />
        <KpiCard label="Tamamlanan" value={count("done")} icon={CheckCircle2} tone="emerald" onClick={() => setShowDone(v => !v)} hint={showDone ? "Gizle" : "Göster"} />
      </div>

      {items.length === 0 ? (
        <Card><EmptyState icon={ListChecks} title="Aksiyon yok" text={who === ME ? "Size atanmış bir CI aksiyonu bulunmuyor." : "Bu seçim için aksiyon bulunmuyor."} /></Card>
      ) : GROUPS.filter(g => g.key !== "done" || showDone).map(g => {
        const list = items.filter(i => i.group === g.key);
        if (!list.length) return null;
        return (
          <Card key={g.key} padded={false}>
            <div className="px-5 pt-5"><SectionTitle icon={g.icon} title={`${g.title} (${list.length})`} /></div>
            <ul className="divide-y divide-slate-100">
              {list.map(({ p, t, status }) => {
                const editable = canEditProject(currentUser, p) && !isClosed(p);
                return (
                  <li key={`${p.id}_${t.id}`} className="px-5 py-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px_150px_110px] gap-2 md:gap-4 items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.name || "Adsız aksiyon"}</p>
                      <button type="button" onClick={() => onOpenProject(p)} className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer max-w-full">
                        <span className="font-mono">{projectNo(p)}</span> · <span className="truncate">{p.title}</span> <ExternalLink className="w-3 h-3 shrink-0" />
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StageBadge project={p} />
                        {who === ALL && <span className="text-xs text-slate-500">{t.responsible || "Sorumlu yok"}</span>}
                      </div>
                    </div>
                    <div className={`text-sm tabular-nums ${g.key === "overdue" ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                      <span className="md:hidden text-xs text-slate-500">Termin: </span>{fmtDate(t.deadline)}
                    </div>
                    <select className={inputCls} value={status} disabled={!editable || busyId === t.id} aria-label="Durum"
                      onChange={(e) => change(p, t.id, { status: e.target.value, progressPercent: e.target.value === "Yapıldı" ? 100 : e.target.value === "Açık" ? 0 : Math.min(Math.max(t.progressPercent || 0, 25), 75) })}>
                      {["Açık", "Devam Ediyor", "Yapıldı", "İptal"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className={inputCls} value={String(taskProgress(t))} disabled={!editable || busyId === t.id || status === "Yapıldı"} aria-label="İlerleme"
                      onChange={(e) => {
                        const pct = Number(e.target.value);
                        change(p, t.id, { progressPercent: pct, status: pct >= 100 ? "Yapıldı" : pct > 0 ? "Devam Ediyor" : "Açık" });
                      }}>
                      {[0, 25, 50, 75, 100].concat([taskProgress(t)]).filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y)
                        .map(v => <option key={v} value={v}>%{v}</option>)}
                    </select>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
