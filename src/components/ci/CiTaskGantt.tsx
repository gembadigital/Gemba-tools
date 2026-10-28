// Gantt of a CI project's actions (plan step C3): one bar per action from its start to its deadline,
// filled by progress; today line and the project's target date. Read-only — dates are edited in the
// action rows below it.
import React from "react";
import { taskStatusOf } from "../../utils/ciLifecycle";
import { taskProgress } from "../../utils/ciPlan";

const DAY = 86400000;
const toTime = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(`${iso.slice(0, 10)}T00:00:00`).getTime() : NaN);
const fmt = (t: number) => new Date(t).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });

export default function CiTaskGantt({ tasks, projectStart, targetDate }: { tasks: any[]; projectStart?: string; targetDate?: string }) {
  const today = new Date(new Date().toDateString()).getTime();
  const rows = tasks.map(t => {
    const end = toTime(t.deadline);
    // No start date (older actions) → a one-week bar ending at the deadline.
    const start = Math.min(isNaN(toTime(t.startDate)) ? end - 7 * DAY : toTime(t.startDate), end);
    return { t, start, end };
  });
  const dated = rows.filter(r => !isNaN(r.end));
  if (!dated.length) {
    return <p className="text-sm text-slate-500">Gantt için aksiyonlara termin girin.</p>;
  }

  const candidates = [...dated.flatMap(r => [r.start, r.end]), today, toTime(projectStart), toTime(targetDate)].filter(n => !isNaN(n));
  // Pad to whole weeks (Monday) so the ticks line up.
  const rawMin = Math.min(...candidates);
  const minMonday = rawMin - ((new Date(rawMin).getDay() + 6) % 7) * DAY;
  const max = Math.max(...candidates) + 7 * DAY;
  const span = max - minMonday;
  const pos = (t: number) => `${((t - minMonday) / span) * 100}%`;
  const weeks = Math.ceil(span / (7 * DAY));
  const tickEvery = weeks > 26 ? 4 : weeks > 12 ? 2 : 1;
  const ticks = Array.from({ length: Math.ceil(weeks / tickEvery) }, (_, i) => minMonday + i * tickEvery * 7 * DAY);
  const target = toTime(targetDate);

  return (
    <div className="rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden">
      <div className="grid grid-cols-[minmax(110px,32%)_1fr] text-xs">
        <div className="px-3 py-2 font-semibold text-slate-500 bg-slate-50 border-b border-slate-200">Aksiyon</div>
        <div className="relative h-8 bg-slate-50 border-b border-slate-200">
          {ticks.map(t => (
            <span key={t} className="absolute top-2 -translate-x-1/2 text-slate-500 whitespace-nowrap tabular-nums" style={{ left: pos(t) }}>{fmt(t)}</span>
          ))}
        </div>
        {rows.map(({ t, start, end }) => {
          const status = taskStatusOf(t);
          const progress = taskProgress(t);
          const overdue = !isNaN(end) && end < today && !["Yapıldı", "İptal"].includes(status);
          const color = status === "Yapıldı" ? "bg-emerald-500" : status === "İptal" ? "bg-slate-300" : overdue ? "bg-red-500" : "bg-blue-500";
          const tint = status === "Yapıldı" ? "bg-emerald-100" : status === "İptal" ? "bg-slate-100" : overdue ? "bg-red-100" : "bg-blue-100";
          return (
            <React.Fragment key={t.id}>
              <div className="px-3 py-2 border-b border-slate-100 min-w-0">
                <p className={`font-semibold truncate ${status === "İptal" ? "line-through text-slate-400" : "text-slate-800"}`}>{t.name || "Adsız aksiyon"}</p>
                <p className="text-slate-500 truncate">{t.responsible || "Sorumlu yok"}</p>
              </div>
              <div className="relative border-b border-slate-100 min-h-[44px]">
                {ticks.map(tk => <span key={tk} className="absolute inset-y-0 w-px bg-slate-100" style={{ left: pos(tk) }} />)}
                {!isNaN(target) && <span className="absolute inset-y-0 border-l-2 border-dashed border-slate-400" style={{ left: pos(target + DAY) }} title="Hedef bitiş" />}
                <span className="absolute inset-y-0 w-0.5 bg-amber-400" style={{ left: pos(today) }} title="Bugün" />
                {isNaN(end) ? (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">termin yok</span>
                ) : (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-md ${tint} overflow-hidden ring-1 ring-inset ${overdue ? "ring-red-400" : "ring-black/5"}`}
                    style={{ left: pos(start), width: `max(6px, calc(${pos(end + DAY)} - ${pos(start)}))` }}
                    title={`${fmt(start)} – ${fmt(end)} · ${status} · %${progress}`}
                  >
                    <div className={`h-full ${color}`} style={{ width: `${status === "İptal" ? 100 : progress}%`, opacity: status === "İptal" ? 0.5 : 1 }} />
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Devam</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Yapıldı</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" /> Termin geçti</span>
        <span className="flex items-center gap-1.5 tabular-nums"><span className="w-0.5 h-3 bg-amber-400" /> Bugün {fmt(today)}</span>
        {!isNaN(target) && <span className={`flex items-center gap-1.5 tabular-nums ${target < today ? "text-red-600 font-semibold" : ""}`}><span className="h-3 border-l-2 border-dashed border-slate-400" /> Hedef bitiş {fmt(target)}</span>}
      </div>
    </div>
  );
}
