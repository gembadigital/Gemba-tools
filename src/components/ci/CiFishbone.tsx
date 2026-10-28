// Fishbone (Ishikawa / 6M) diagram and editor for A3 step 4 (plan step C4). Causes are a flat list
// keyed by category (utils/ciLifecycle.ts CiFishboneCause); the bones come from the CI settings.
// Causes of a category no longer in the settings stay visible under "Diğer kategoriler".
// Desktop: real fishbone (spine → problem head, bones above and below). Phones: stacked cards.
import React, { useState } from "react";
import { Star, Trash2, Plus, ArrowRightLeft, Fish } from "lucide-react";
import type { CiFishboneCause } from "../../utils/ciLifecycle";

interface Props {
  causes: CiFishboneCause[];
  categories: string[];
  problem: string;
  canEdit: boolean;
  onChange: (causes: CiFishboneCause[]) => void;
  onDeepen: (text: string) => void; // continue a cause with the 5-Why chain
}

const newId = () => `fb_${Math.random().toString(36).slice(2, 9)}`;
const OTHER = "__other__";

export default function CiFishbone({ causes, categories, problem, canEdit, onChange, onDeepen }: Props) {
  const others = causes.filter(c => !categories.includes(c.category));
  const top = categories.slice(0, Math.ceil(categories.length / 2));
  const bottom = categories.slice(Math.ceil(categories.length / 2));
  const cols = Math.max(top.length, bottom.length, 1);

  const update = (id: string, patch: Partial<CiFishboneCause>) => onChange(causes.map(c => c.id === id ? { ...c, ...patch } : c));
  const remove = (id: string) => onChange(causes.filter(c => c.id !== id));
  const add = (category: string, text: string) => onChange([...causes, { id: newId(), category, text }]);

  const card = (category: string) => (
    <CategoryCard
      key={category}
      title={category === OTHER ? "Diğer kategoriler" : category}
      causes={category === OTHER ? others : causes.filter(c => c.category === category)}
      showCategory={category === OTHER}
      canEdit={canEdit}
      onAdd={category === OTHER ? undefined : (text) => add(category, text)}
      onUpdate={update}
      onRemove={remove}
      onDeepen={onDeepen}
    />
  );

  return (
    <div className="space-y-3">
      {/* Narrower screens: problem first, then the categories in a grid */}
      <div className="xl:hidden space-y-3">
        <ProblemHead problem={problem} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map(card)}
          {others.length > 0 && card(OTHER)}
        </div>
      </div>

      {/* Desktop: the fishbone. One grid — row 1 upper bones, row 2 spine + problem head, row 3 lower
          bones — so the spine, the arrow and the head line up whatever the card heights. */}
      <div className="hidden xl:grid grid-cols-[minmax(0,1fr)_210px]">
        <div className="grid gap-3 pr-3 items-end" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {top.map(card)}
        </div>
        <div />
        <div className="relative min-h-16">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          {top.map((_, i) => {
            const x = ((i + 0.5) / cols) * 100;
            return <line key={`t${i}`} x1={x - 3} y1="0" x2={x + 3} y2="50" stroke="#94a3b8" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
          })}
          {bottom.map((_, i) => {
            const x = ((i + 0.5) / cols) * 100;
            return <line key={`b${i}`} x1={x - 3} y1="100" x2={x + 3} y2="50" stroke="#94a3b8" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        </div>
        <div className="flex items-center py-2">
          <span className="w-0 h-0 border-y-[10px] border-y-transparent border-l-[14px] border-l-slate-700 shrink-0" />
          <ProblemHead problem={problem} />
        </div>
        <div className="grid gap-3 pr-3 items-start" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {bottom.map(card)}
        </div>
        <div />
      </div>
      {others.length > 0 && <div className="hidden xl:block">{card(OTHER)}</div>}
    </div>
  );
}

function ProblemHead({ problem }: { problem: string }) {
  return (
    <div className="flex-1 rounded-2xl bg-gradient-to-br from-red-50 to-amber-50 ring-1 ring-red-200 p-4 min-h-[96px] flex flex-col justify-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-700 flex items-center gap-1.5"><Fish className="w-3.5 h-3.5" /> Problem</p>
      <p className="text-sm font-semibold text-slate-900 mt-1 line-clamp-5">{problem || "Problem tanımı 1. adımda girilir."}</p>
    </div>
  );
}

function CategoryCard({ title, causes, showCategory, canEdit, onAdd, onUpdate, onRemove, onDeepen }: {
  title: string; causes: CiFishboneCause[]; showCategory: boolean; canEdit: boolean;
  onAdd?: (text: string) => void; onUpdate: (id: string, patch: Partial<CiFishboneCause>) => void;
  onRemove: (id: string) => void; onDeepen: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => { if (draft.trim() && onAdd) { onAdd(draft.trim()); setDraft(""); } };
  return (
    <div className="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm p-3 space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-900 truncate">{title}</span>
        <span className="text-xs font-semibold text-slate-500 tabular-nums">{causes.length}</span>
      </div>
      <ul className="space-y-1.5">
        {causes.map(c => (
          <li key={c.id} className={`group relative flex items-start gap-1 rounded-lg pl-1 pr-1 py-0.5 ${c.root ? "bg-amber-50 ring-1 ring-amber-300" : "bg-slate-50"}`}>
            <button type="button" disabled={!canEdit} onClick={() => onUpdate(c.id, { root: !c.root })} aria-pressed={!!c.root}
              title={c.root ? "Kök neden işaretini kaldır" : "Kök neden olarak işaretle"}
              className={`p-1.5 rounded-md shrink-0 cursor-pointer disabled:cursor-default ${c.root ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}`}>
              <Star className="w-4 h-4" fill={c.root ? "currentColor" : "none"} />
            </button>
            <div className="flex-1 min-w-0">
              <textarea value={c.text} disabled={!canEdit} rows={1} onChange={(e) => onUpdate(c.id, { text: e.target.value })} aria-label="Neden"
                ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }}
                className="block w-full resize-none overflow-hidden bg-transparent text-sm leading-snug text-slate-800 py-1.5 focus:outline-none" />
              {showCategory && <span className="block text-[11px] text-slate-500 -mt-0.5 pb-1">{c.category}</span>}
            </div>
            {canEdit && (
              <span className="absolute right-1 top-1 flex gap-0.5 rounded-md bg-white/95 shadow-sm ring-1 ring-slate-200 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                <button type="button" onClick={() => onDeepen(c.text)} title="5 Neden ile derinleştir" aria-label="5 Neden ile derinleştir"
                  className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 cursor-pointer"><ArrowRightLeft className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => onRemove(c.id)} aria-label="Nedeni sil"
                  className="p-1.5 rounded-md text-slate-500 hover:text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {canEdit && onAdd && (
        <div className="flex items-center gap-1">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            placeholder="Neden ekle…" aria-label={`${title} için neden ekle`}
            className="flex-1 min-w-0 h-9 px-2.5 rounded-lg bg-slate-50 ring-1 ring-inset ring-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/40" />
          <button type="button" onClick={submit} disabled={!draft.trim()} aria-label="Ekle"
            className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center cursor-pointer disabled:opacity-40"><Plus className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
