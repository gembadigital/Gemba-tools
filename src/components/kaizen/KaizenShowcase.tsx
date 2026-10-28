// Önce-Sonra sergisi — completed (and not rejected) Kaizen implementations together with before /
// after studies shared from CI projects (CI ↔ Kaizen bridge, plan C10). The list carries no photos;
// each card loads its two pictures when it scrolls into view (GET showcase/:key/media).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Images, Search, ShieldCheck, X, ArrowRight } from "lucide-react";
import type { KaizenApi } from "./KaizenSuggestionSystem";
import { Card, PageHeader, EmptyState, ChoiceChip, inputCls } from "./kaizenUi";

interface ShowcaseSide { label: string; value: number | null; unit: string; text: string }
interface ShowcaseItem {
  key: string;
  source: "kaizen" | "ci";
  title: string;
  department: string;
  person: string;
  date: string;
  before: ShowcaseSide;
  after: ShowcaseSide;
  benefit: string;
  saving: number;
  savingCurrency: string;
  verified: boolean;
  ciProjectNo: string;
  hasMedia: boolean;
}

const fmtDate = (iso: string) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR") : "";
const metric = (m: ShowcaseSide) => m.value === null || m.value === undefined ? "" : `${m.label ? m.label + ": " : ""}${m.value.toLocaleString("tr-TR")} ${m.unit}`.trim();

function useMedia(api: KaizenApi, item: ShowcaseItem, visible: boolean) {
  const [media, setMedia] = useState<{ before: string; after: string } | null>(null);
  useEffect(() => {
    if (!visible || !item.hasMedia || media) return;
    let alive = true;
    api.one(`showcase/${item.key}/media`).then(d => { if (alive) setMedia(d || { before: "", after: "" }); });
    return () => { alive = false; };
  }, [visible, item.key]);
  return media;
}

function Photo({ src, label, tone }: { src?: string; label: string; tone: "red" | "emerald" }) {
  return (
    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200">
      {src ? <img src={src} alt={label} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Fotoğraf yok</div>}
      <span className={`absolute top-2 left-2 text-[11px] font-black tracking-wide px-2 py-0.5 rounded-md text-white ${tone === "red" ? "bg-red-600" : "bg-emerald-600"}`}>{label}</span>
    </div>
  );
}

function ShowcaseCard({ api, item, onOpen }: { api: KaizenApi; item: ShowcaseItem; onOpen: (media: { before: string; after: string } | null) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const media = useMedia(api, item, visible);
  return (
    <button ref={ref} type="button" onClick={() => onOpen(media)}
      className="text-left bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.25)] transition-all p-3 flex flex-col gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40">
      <div className="grid grid-cols-2 gap-2">
        <Photo src={media?.before} label="ÖNCE" tone="red" />
        <Photo src={media?.after} label="SONRA" tone="emerald" />
      </div>
      <div className="px-1 pb-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.source === "ci" ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-800"}`}>
            {item.source === "ci" ? `CI projesi${item.ciProjectNo ? ` ${item.ciProjectNo}` : ""}` : "Kaizen önerisi"}
          </span>
          {item.verified && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Doğrulandı</span>}
          {item.source === "kaizen" && item.ciProjectNo && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">CI {item.ciProjectNo}</span>}
        </div>
        <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{item.title}</p>
        {(metric(item.before) || metric(item.after)) && (
          <p className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap"><span>{metric(item.before) || "—"}</span><ArrowRight className="w-3 h-3" /><b className="text-emerald-700">{metric(item.after) || "—"}</b></p>
        )}
        <p className="text-xs text-slate-500">{[item.department, item.person, fmtDate(item.date)].filter(Boolean).join(" · ")}</p>
      </div>
    </button>
  );
}

export default function KaizenShowcase({ api }: { api: KaizenApi }) {
  const [items, setItems] = useState<ShowcaseItem[] | null>(null);
  const [filter, setFilter] = useState<"all" | "kaizen" | "ci">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<{ item: ShowcaseItem; media: { before: string; after: string } | null } | null>(null);
  useEffect(() => { api.get("showcase").then(d => setItems(d as ShowcaseItem[])); }, []);

  const shown = useMemo(() => (items || [])
    .filter(i => filter === "all" || i.source === filter)
    .filter(i => !q.trim() || `${i.title} ${i.department} ${i.person}`.toLocaleLowerCase("tr").includes(q.trim().toLocaleLowerCase("tr"))), [items, filter, q]);
  const count = (s: "kaizen" | "ci") => (items || []).filter(i => i.source === s).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Önce-Sonra" subtitle="Tamamlanan Kaizen uygulamaları ve CI projelerinden paylaşılan önce-sonra çalışmaları." />
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <ChoiceChip on={filter === "all"} onClick={() => setFilter("all")}>Tümü · {(items || []).length}</ChoiceChip>
          <ChoiceChip on={filter === "kaizen"} onClick={() => setFilter("kaizen")}>Kaizen önerileri · {count("kaizen")}</ChoiceChip>
          <ChoiceChip on={filter === "ci"} onClick={() => setFilter("ci")}>CI projeleri · {count("ci")}</ChoiceChip>
        </div>
        <label className="relative md:ml-auto md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input className={`${inputCls} pl-11`} placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {items === null ? (
        <p className="text-sm text-slate-500">Yükleniyor…</p>
      ) : shown.length === 0 ? (
        <Card><EmptyState icon={Images} title="Henüz önce-sonra yok" text="Tamamlanan uygulamalar ve CI projelerinden gönderilen önce-sonra çalışmaları burada sergilenir." /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map(i => <ShowcaseCard key={i.key} api={api} item={i} onOpen={(media) => setOpen({ item: i, media })} />)}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-label={open.item.title} onClick={() => setOpen(null)}>
          <div className="bg-white w-full sm:max-w-4xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[94vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{open.item.title}</h3>
                <p className="text-sm text-slate-500">{[open.item.source === "ci" ? `CI projesi ${open.item.ciProjectNo}` : "Kaizen önerisi", open.item.department, open.item.person, fmtDate(open.item.date)].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Kapat"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {([["ÖNCE", open.media?.before, open.item.before, "red"], ["SONRA", open.media?.after, open.item.after, "emerald"]] as const).map(([label, src, side, tone]) => (
                <div key={label} className="space-y-2">
                  <Photo src={src} label={label} tone={tone} />
                  {metric(side) && <p className="text-sm font-semibold text-slate-800">{metric(side)}</p>}
                  {side.text && <p className="text-sm text-slate-600 whitespace-pre-wrap">{side.text}</p>}
                </div>
              ))}
            </div>
            {(open.item.benefit || open.item.saving > 0) && (
              <div className="px-5 pb-5">
                <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-4 text-sm text-slate-800">
                  <b>Fayda:</b> {open.item.benefit}{open.item.saving > 0 ? `${open.item.benefit ? " · " : ""}Gerçekleşen kazanç ${open.item.saving.toLocaleString("tr-TR")} ${open.item.savingCurrency}` : ""}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
