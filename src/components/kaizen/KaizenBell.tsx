import React, { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { KaizenApi } from "./KaizenSuggestionSystem";

// Uygulama içi bildirimler (Faz 4.3): every Kaizen notification also lands here, so people who
// sign in with sicil no and have no e-mail still see decisions, messages and weekly reminders.
export interface KaizenNotification { id: string; suggestionId?: string; kind: string; title: string; text: string; createdAt: string; readAt?: string }

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "şimdi";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
};

export default function KaizenBell({ api, onOpen }: { api: KaizenApi; onOpen: (n: KaizenNotification) => void }) {
  const [items, setItems] = useState<KaizenNotification[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = async () => setItems((await api.get("notifications")) || []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // light polling; no push channel yet
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = items.filter(i => !i.readAt).length;
  const markRead = async (ids?: string[]) => {
    await api.post("notifications/read", ids ? { ids } : {});
    const now = new Date().toISOString();
    setItems(prev => prev.map(i => (!ids || ids.includes(i.id) ? { ...i, readAt: i.readAt || now } : i)));
  };

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button onClick={() => setOpen(o => !o)} aria-label={`Bildirimler${unread ? ` (${unread} okunmamış)` : ""}`} aria-expanded={open}
        className="relative h-10 w-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer">
        <Bell className="w-5 h-5" />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center tabular-nums ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[22rem] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 overflow-hidden" role="dialog" aria-label="Bildirimler">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">Bildirimler</p>
            <div className="flex items-center gap-1">
              {unread > 0 && <button onClick={() => markRead()} className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" />Tümünü okundu say</button>}
              <button onClick={() => setOpen(false)} aria-label="Kapat" className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500 px-4 py-8 text-center">Henüz bildirim yok.</p>
          ) : (
            <ul className="max-h-[26rem] overflow-y-auto divide-y divide-slate-100">
              {items.map(n => (
                <li key={n.id}>
                  <button onClick={() => { if (!n.readAt) markRead([n.id]); setOpen(false); onOpen(n); }}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer flex gap-3 ${n.readAt ? "" : "bg-emerald-50/40"}`}>
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : "bg-emerald-500"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900 truncate">{n.title}</span>
                      <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2 whitespace-pre-line">{n.text}</span>
                      <span className="block text-[11px] text-slate-400 mt-1">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
