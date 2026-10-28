import React, { useEffect, useRef, useState } from "react";
import { MessagesSquare, Send, Hourglass, CheckCheck, HelpCircle, Megaphone } from "lucide-react";
import { KaizenSuggestion, KaizenMessage, KaizenRequestType } from "./kaizenTypes";
import { KaizenApi } from "./KaizenSuggestionSystem";
import { Avatar, areaCls } from "./kaizenUi";

// Öneri altı yazışma (Faz 4.2): the conversation about one suggestion, plus the submitter's
// ready-made requests. Who gets notified is decided by the server from the suggestion's stage.

const REQUESTS: { type: KaizenRequestType; label: string; icon: any }[] = [
  { type: "evaluation", label: "Değerlendirme talebi", icon: Hourglass },
  { type: "approval", label: "Onay talebi", icon: CheckCheck },
  { type: "status", label: "Durum teyidi", icon: HelpCircle }
];

// Which requests make sense at this stage.
function requestsFor(s: KaizenSuggestion): KaizenRequestType[] {
  if (s.approvalStatus === "Pending") return ["evaluation", "status"];
  if (s.approvalStatus === "First Approval") return ["evaluation", "approval", "status"];
  return ["status"];
}

const when = (iso: string) => new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function KaizenThread({ suggestion, messages, api, currentUser, isAuthor, onPosted, showToast, compact }: {
  suggestion: KaizenSuggestion; messages: KaizenMessage[]; api: KaizenApi; currentUser: any; isAuthor: boolean;
  onPosted: (m: KaizenMessage) => void; showToast: (m: string) => void; compact?: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const list = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const myEmail = (currentUser?.email || "").toLowerCase();
  const mine = (m: KaizenMessage) => (!!currentUser?.kaizenPersonnelId && m.authorPersonnelId === currentUser.kaizenPersonnelId) || (m.authorEmail || "").toLowerCase() === myEmail;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [list.length]);

  const send = async (requestType?: KaizenRequestType) => {
    if (!requestType && !text.trim()) return;
    setSending(true);
    const res = await api.post(`suggestions/${suggestion.id}/messages`, requestType ? { requestType, text: text.trim() || undefined } : { text });
    setSending(false);
    if (res.success) {
      onPosted(res.data);
      setText("");
      showToast(requestType ? `${REQUESTS.find(r => r.type === requestType)!.label} gönderildi${res.notified ? ` (${res.notified} kişiye bildirildi)` : ""}.` : "Mesaj gönderildi.");
    } else showToast(`Hata: ${res.error || "Gönderilemedi."}`);
  };

  const recentRequest = (t: KaizenRequestType) => list.some(m => m.requestType === t && Date.now() - Date.parse(m.createdAt) < 24 * 3600_000);

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><MessagesSquare className="w-4 h-4" />Yazışma{list.length ? ` (${list.length})` : ""}</p>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">{isAuthor ? "Amirinize ya da Kurul'a bir not bırakabilir veya aşağıdaki hazır taleplerden birini gönderebilirsiniz." : "Henüz yazışma yok."}</p>
      ) : (
        <ol className={`space-y-3 ${compact ? "max-h-72" : "max-h-96"} overflow-y-auto pr-1`}>
          {list.map(m => {
            const own = mine(m);
            return (
              <li key={m.id} className={`flex gap-2.5 ${own ? "flex-row-reverse" : ""}`}>
                <Avatar name={m.authorName} size="sm" />
                <div className={`max-w-[85%] ${own ? "items-end text-right" : ""} flex flex-col`}>
                  <p className="text-[11px] text-slate-500 mb-1">{m.authorName} · {m.authorRole} · {when(m.createdAt)}</p>
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed text-left whitespace-pre-wrap ${m.kind === "request" ? "bg-amber-50 ring-1 ring-amber-200 text-amber-950" : own ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                    {m.kind === "request" && <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 mb-1"><Megaphone className="w-3.5 h-3.5" />{REQUESTS.find(r => r.type === m.requestType)?.label || "Talep"}</span>}
                    {m.text}
                  </div>
                </div>
              </li>
            );
          })}
          <div ref={endRef} />
        </ol>
      )}

      {isAuthor && (
        <div className="flex flex-wrap gap-2">
          {REQUESTS.filter(r => requestsFor(suggestion).includes(r.type)).map(r => {
            const blocked = recentRequest(r.type);
            return (
              <button key={r.type} type="button" disabled={sending || blocked} onClick={() => send(r.type)} title={blocked ? "Bu talep son 24 saatte gönderildi" : undefined}
                className="h-9 px-3 rounded-full text-xs font-semibold ring-1 ring-inset ring-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5">
                <r.icon className="w-3.5 h-3.5" />{r.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <textarea value={text} onChange={e => setText(e.target.value.slice(0, 2000))} rows={2}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
          placeholder={isAuthor ? "Amirinize / Kurul'a not yazın…" : "Öneri sahibine yazın…"} className={`${areaCls} flex-1`} aria-label="Mesaj" />
        <button onClick={() => send()} disabled={sending || !text.trim()} aria-label="Gönder"
          className="h-12 w-12 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer hover:bg-emerald-500"><Send className="w-5 h-5" /></button>
      </div>
    </div>
  );
}
