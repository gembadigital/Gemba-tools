import React, { useEffect, useState } from "react";
import { Trophy, ChevronLeft, ChevronRight, Users, Building2, PartyPopper } from "lucide-react";
import type { KaizenApi } from "./KaizenSuggestionSystem";
import { Card, PageHeader, SectionTitle, Avatar } from "./kaizenUi";

// Ayın Kaizen Şampiyonları (Faz 5.5): top people and departments of a month by Kurul points, then
// by number of suggestions; any past month with activity can be picked.

interface Row { name: string; department: string; points: number; count: number; scored: number }
interface Board { month: string; months: string[]; people: Row[]; departments: Row[] }

const monthLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
const MEDAL = ["bg-amber-400 text-amber-950", "bg-slate-200 text-slate-700", "bg-orange-200 text-orange-900"];
const PODIUM_H = ["h-28", "h-20", "h-14"];

export default function KaizenChampions({ api }: { api: KaizenApi }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [board, setBoard] = useState<Board | null>(null);

  useEffect(() => {
    let alive = true;
    setBoard(null);
    api.one(`champions/board?month=${month}`).then(d => { if (alive) setBoard(d || { month, months: [month], people: [], departments: [] }); });
    return () => { alive = false; };
  }, [month]);

  const months = board?.months || [month];
  const i = months.indexOf(month);
  const older = i >= 0 && i < months.length - 1 ? months[i + 1] : null;
  const newer = i > 0 ? months[i - 1] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ayın Kaizen Şampiyonları"
        subtitle="Kurul puanına, eşitlikte öneri sayısına göre"
        actions={
          <div className="flex items-center gap-1.5">
            <button onClick={() => older && setMonth(older)} disabled={!older} aria-label="Önceki ay" className="w-10 h-10 rounded-xl ring-1 ring-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
            <select value={month} onChange={e => setMonth(e.target.value)} aria-label="Ay" className="h-10 px-3 rounded-xl ring-1 ring-slate-200 bg-white text-sm font-semibold text-slate-800 capitalize">
              {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <button onClick={() => newer && setMonth(newer)} disabled={!newer} aria-label="Sonraki ay" className="w-10 h-10 rounded-xl ring-1 ring-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
          </div>
        }
      />
      {!board ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">{[0, 1].map(k => <div key={k} className="h-80 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Ranking title="Kişiler" icon={Users} rows={board.people} person month={monthLabel(board.month)} />
          <Ranking title="Bölümler" icon={Building2} rows={board.departments} month={monthLabel(board.month)} />
        </div>
      )}
      <p className="text-xs text-slate-500">Puan: o ay Kurul'un verdiği değerlendirme puanları. Öneri: o ay gönderilen öneriler. Ödül tutarı ve katılım puanı bu sıralamaya girmez.</p>
    </div>
  );
}

function Ranking({ title, icon, rows, person, month }: { title: string; icon: any; rows: Row[]; person?: boolean; month: string }) {
  const top = rows.slice(0, 3);
  // Podium order: 2nd, 1st, 3rd.
  const podium = [top[1], top[0], top[2]].map((r, k) => ({ r, place: [1, 0, 2][k] })).filter(x => x.r);
  return (
    <Card>
      <SectionTitle icon={icon} title={title} hint={month} />
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 flex items-center gap-2 py-6"><PartyPopper className="w-4 h-4 text-amber-500" />Bu ay henüz öneri ya da puan yok.</p>
      ) : (
        <>
          <div className="flex items-end justify-center gap-3 sm:gap-5 pt-2 pb-5" aria-label={`${title}: ilk üç`}>
            {podium.map(({ r, place }) => (
              <div key={r.name} className="flex flex-col items-center w-28 sm:w-32 text-center">
                {person ? <Avatar name={r.name} size={place === 0 ? "lg" : "md"} /> : <span className={`${place === 0 ? "w-16 h-16" : "w-10 h-10"} rounded-2xl bg-slate-900 text-white flex items-center justify-center`}><Building2 className={place === 0 ? "w-7 h-7" : "w-5 h-5"} /></span>}
                <p className="text-sm font-bold text-slate-900 mt-2 line-clamp-2">{r.name}</p>
                {person && <p className="text-[11px] text-slate-500 truncate max-w-full">{r.department}</p>}
                <p className="text-xs font-semibold text-slate-700 tabular-nums mt-0.5">{r.points} puan · {r.count} öneri</p>
                <div className={`mt-2 w-full ${PODIUM_H[place]} rounded-t-xl flex items-start justify-center pt-2 ${MEDAL[place]}`}>
                  {place === 0 ? <Trophy className="w-6 h-6" /> : <span className="text-lg font-black">{place + 1}</span>}
                </div>
              </div>
            ))}
          </div>
          {rows.length > 3 && (
            <ol start={4} className="divide-y divide-slate-100 border-t border-slate-100">
              {rows.slice(3).map((r, k) => (
                <li key={r.name} className="flex items-center gap-3 py-2.5">
                  <span className="w-7 text-sm font-bold text-slate-400 tabular-nums">{k + 4}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 truncate">{r.name}</span>
                    {person && <span className="block text-xs text-slate-500 truncate">{r.department}</span>}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">{r.count} öneri</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums w-16 text-right">{r.points}<span className="text-xs font-medium text-slate-400 ml-0.5">p</span></span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Card>
  );
}
