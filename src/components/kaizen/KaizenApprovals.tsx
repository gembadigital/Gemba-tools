import React, { useState, useMemo, useEffect } from "react";
import { CheckCircle2, XCircle, Download, Share2, Gift, Clock, Inbox, ClipboardCheck, Users, Award, Sparkles, MessageSquare, LayoutPanelLeft, TableProperties, ChevronLeft, ChevronRight, X, ArrowUp, ArrowDown, ArrowUpDown, RotateCcw, Filter, FlaskConical } from "lucide-react";
import { KaizenSuggestion, KaizenCriteria, KaizenApproval, KaizenEvaluation, KaizenPersonnel, KaizenMessage } from "./kaizenTypes";
import KaizenThread from "./KaizenThread";
import KaizenSavingRevision from "./KaizenSavingRevision";
import { canDecideAsManager, daysWaiting, WAITING_SEVERITY_COLORS, statusLabel, feasibilityOverdue, expectedSaving } from "./kaizenCalc";
import { KaizenSettings, currencyChoices, toBaseCurrency, waitingSeverityFor, rewardFor, stagesOf } from "../../utils/kaizenSettings";

const fmtReward = (r: { amount: number; currency: string }) => `${r.amount.toLocaleString("tr-TR")} ${r.currency}`;
import { KaizenApi, useFullRecord } from "./KaizenSuggestionSystem";
import { perPieceText } from "../../utils/kaizenSaving";
import { Card, StatusBadge, Button, EmptyState, KpiCard, PageHeader, TabBar, Avatar, inputCls, areaCls, tableCls, theadCls, thCls, tdCls, trCls } from "./kaizenUi";

interface Props {
  currentUser: any;
  suggestions: KaizenSuggestion[];
  approvals: KaizenApproval[];
  evaluations: KaizenEvaluation[];
  criteria: KaizenCriteria[];
  isBoardMember: boolean;
  api: KaizenApi;
  showToast: (msg: string) => void;
  onReload: () => void;
  settings: KaizenSettings;
  personnel: KaizenPersonnel[];
  messages: KaizenMessage[];
  onMessagePosted: (m: KaizenMessage) => void;
}

type Tab = "manager" | "board" | "yokoten" | "reward";


export default function KaizenApprovals({ currentUser, suggestions, approvals, evaluations, criteria, isBoardMember, api, showToast, onReload, settings, personnel, messages, onMessagePosted }: Props) {
  const [tab, setTab] = useState<Tab>("manager");
  const myEmail = currentUser?.email || "";
  const myRole = currentUser?.role || "";
  const myPersonnelId = currentUser?.kaizenPersonnelId as string | undefined;

  const managerApprovalBySuggestion = useMemo(() => {
    const map = new Map<string, string>();
    approvals.filter(a => a.stage === "Manager" && a.approved).forEach(a => map.set(a.suggestionId, a.createdAt));
    return map;
  }, [approvals]);

  const managerQueue = useMemo(() => suggestions.filter(s => s.approvalStatus === "Pending" && canDecideAsManager(myEmail, myRole, s.teamLeaderEmail, s.teamLeaderId, myPersonnelId)), [suggestions, myEmail, myRole]);
  const managerHistory = useMemo(() => suggestions.filter(s => s.approvalStatus !== "Pending" && canDecideAsManager(myEmail, myRole, s.teamLeaderEmail, s.teamLeaderId, myPersonnelId)), [suggestions, myEmail, myRole]);
  const boardQueue = useMemo(() => suggestions.filter(s => s.approvalStatus === "First Approval"), [suggestions]);
  const boardHistory = useMemo(() => suggestions.filter(s => s.approvalStatus === "Second Approval" || s.approvalStatus === "Rejected 2nd"), [suggestions]);

  const yokotenOpen = evaluations.filter(e => e.yokoten && !e.yokotenImplemented).length;
  const rewardOpen = evaluations.filter(e => (e.rewardStatus || "Bekliyor") !== "Ödendi" && suggestions.find(s => s.id === e.suggestionId)?.approvalStatus === "Second Approval").length;

  const tabs: { key: Tab; label: string; icon: any; count: number; show: boolean }[] = [
    { key: "manager", label: "Amir Onayı", icon: ClipboardCheck, count: managerQueue.length, show: true },
    { key: "board", label: "Kurul Değerlendirmesi", icon: Users, count: boardQueue.length, show: isBoardMember },
    { key: "yokoten", label: "Yokoten Takibi", icon: Share2, count: yokotenOpen, show: isBoardMember },
    { key: "reward", label: "Ödül Takibi", icon: Gift, count: rewardOpen, show: isBoardMember }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Değerlendirmeler"
        subtitle={isBoardMember ? "Amir onayı, Kurul değerlendirmesi, yaygınlaştırma ve ödül takibi tek yerde." : "Ekibinizden gelen önerileri inceleyin ve kararınızı verin."}
        actions={isBoardMember ? (
          <Button variant="outline" onClick={() => api.download("suggestions/export-excel", "Kaizen_Onerileri.xlsx").catch(() => showToast("Hata: Rapor indirilemedi."))}>
            <Download className="w-4 h-4" />Excel indir
          </Button>
        ) : undefined}
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Amir onayı bekleyen" value={managerQueue.length} icon={ClipboardCheck} tone="amber" onClick={() => setTab("manager")} />
        {isBoardMember && <KpiCard label="Kurul bekleyen" value={boardQueue.length} icon={Users} tone="blue" onClick={() => setTab("board")} />}
        {isBoardMember && <KpiCard label="Yayılımı bekleyen" value={yokotenOpen} icon={Share2} tone="teal" onClick={() => setTab("yokoten")} />}
        {isBoardMember && <KpiCard label="Ödenecek ödül" value={rewardOpen} icon={Gift} tone="emerald" onClick={() => setTab("reward")} />}
      </div>

      <TabBar<Tab> tabs={tabs.filter(t => t.show)} value={tab} onChange={setTab} />

      {tab === "manager" && (
        <DecisionWorkspace
          settings={settings}
          personnel={personnel}
          messages={messages}
          onMessagePosted={onMessagePosted}
          currentUser={currentUser}
          stage="manager" queue={managerQueue} history={managerHistory} criteria={criteria}
          approvals={approvals} evaluations={evaluations}
          waitingSince={s => s.createdAt}
          api={api} showToast={showToast} onReload={onReload}
        />
      )}
      {tab === "board" && isBoardMember && (
        <DecisionWorkspace
          settings={settings}
          personnel={personnel}
          messages={messages}
          onMessagePosted={onMessagePosted}
          currentUser={currentUser}
          stage="board" queue={boardQueue} history={boardHistory} criteria={criteria}
          approvals={approvals} evaluations={evaluations}
          waitingSince={s => managerApprovalBySuggestion.get(s.id) || s.createdAt}
          api={api} showToast={showToast} onReload={onReload}
        />
      )}
      {tab === "yokoten" && isBoardMember && <YokotenTab suggestions={suggestions} evaluations={evaluations} api={api} showToast={showToast} onReload={onReload} />}
      {tab === "reward" && isBoardMember && <RewardTab suggestions={suggestions} evaluations={evaluations} api={api} showToast={showToast} onReload={onReload} settings={settings} />}
    </div>
  );
}

function WaitingBadge({ since, settings }: { since: string; settings: KaizenSettings }) {
  const days = daysWaiting(since);
  const color = WAITING_SEVERITY_COLORS[waitingSeverityFor(days, settings)];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap" style={{ color }}>
      <Clock className="w-3.5 h-3.5" />{days} gün
    </span>
  );
}

// ---------- Master/detail workspace: queue on the left, decision form on the right ----------

function DecisionWorkspace({ stage, queue, history, criteria, approvals, evaluations, waitingSince, api, showToast, onReload, settings, personnel, messages, onMessagePosted, currentUser }: {
  settings: KaizenSettings; personnel: KaizenPersonnel[]; messages: KaizenMessage[]; onMessagePosted: (m: KaizenMessage) => void; currentUser: any;
  stage: "manager" | "board"; queue: KaizenSuggestion[]; history: KaizenSuggestion[]; criteria: KaizenCriteria[];
  approvals: KaizenApproval[]; evaluations: KaizenEvaluation[]; waitingSince: (s: KaizenSuggestion) => string;
  api: KaizenApi; showToast: (m: string) => void; onReload: () => void;
}) {
  const [view, setView] = useState<"queue" | "history">("queue");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(
    () => [...(view === "queue" ? queue : history)].sort((a, b) => (view === "queue" ? (waitingSince(a) || "").localeCompare(waitingSince(b) || "") : (b.updatedAt || "").localeCompare(a.updatedAt || ""))),
    [view, queue, history]
  );
  const selected = list.find(s => s.id === selectedId) || null;

  // "split": queue + decision side by side; "table": full-width sortable/filterable list, the
  // decision opens in a side drawer. The choice is remembered per browser.
  const [layout, setLayoutState] = useState<"split" | "table">(() => {
    try { return localStorage.getItem("kaizen_decision_layout") === "table" ? "table" : "split"; } catch { return "split"; }
  });
  const setLayout = (l: "split" | "table") => {
    setLayoutState(l);
    setSelectedId(null);
    try { localStorage.setItem("kaizen_decision_layout", l); } catch { /* per-viewer convenience only */ }
  };

  useEffect(() => { setSelectedId(null); }, [stage, view]);
  // Split view: auto-open the first waiting item so the right pane is never empty when there is work to do.
  useEffect(() => { if (layout === "split" && !selectedId && list.length > 0 && view === "queue") setSelectedId(list[0].id); }, [list, selectedId, view, layout]);

  // Drawer prev/next follows the table's current sort + filter order.
  const [order, setOrder] = useState<string[]>([]);
  const nav = order.length ? order : list.map(x => x.id);

  const panel = selected && (
    <DecisionPanel
      settings={settings}
      personnel={personnel}
      messages={messages.filter(m => m.suggestionId === selected.id)}
      onMessagePosted={onMessagePosted}
      currentUser={currentUser}
      key={selected.id} suggestion={selected} stage={stage} criteria={criteria}
      approvals={approvals.filter(a => a.suggestionId === selected.id)}
      evaluations={evaluations.filter(e => e.suggestionId === selected.id)}
      readOnly={view === "history"} api={api} showToast={showToast} onDone={() => { setSelectedId(null); onReload(); }} onChanged={onReload}
    />
  );

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
        {([["queue", "Bekleyen", queue.length], ["history", "Geçmiş", history.length]] as const).map(([k, l, n]) => (
          <button key={k} onClick={() => setView(k)} className={`h-8 px-3 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-1.5 transition-all ${view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{l}<span className="text-xs tabular-nums text-slate-400">{n}</span></button>
        ))}
      </div>
      <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1" role="group" aria-label="Görünüm">
        {([["split", "Kart", LayoutPanelLeft], ["table", "Liste", TableProperties]] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setLayout(k)} aria-pressed={layout === k} className={`h-8 px-3 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-1.5 transition-all ${layout === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}><Icon className="w-4 h-4" />{l}</button>
        ))}
      </div>
    </div>
  );

  if (layout === "table") {
    return (
      <>
        <Card padded={false} className="overflow-hidden">
          {toolbar}
          <QueueTable
            list={list} view={view} settings={settings} evaluations={evaluations} waitingSince={waitingSince}
            selectedId={selectedId} onOpen={(id, ids) => { setOrder(ids); setSelectedId(id); }}
          />
        </Card>
        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setSelectedId(null)} role="dialog" aria-modal="true" aria-label={stage === "board" ? "Kurul değerlendirmesi" : "Amir onayı"}>
            <aside className="bg-[#fafafa] w-full max-w-3xl h-full overflow-y-auto shadow-2xl animate-toast-in" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-white/95 backdrop-blur border-b border-slate-200/70">
                <p className="text-sm font-bold text-slate-900">{stage === "board" ? "Kurul değerlendirmesi" : "Amir onayı"}<span className="text-slate-400 font-medium"> · {nav.indexOf(selected.id) + 1} / {nav.length}</span></p>
                <div className="flex items-center gap-1">
                  {([[-1, ChevronLeft, "Önceki"], [1, ChevronRight, "Sonraki"]] as const).map(([d, Icon, l]) => {
                    const i = nav.indexOf(selected.id) + d;
                    return <button key={l} disabled={i < 0 || i >= nav.length} onClick={() => setSelectedId(nav[i])} aria-label={l} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><Icon className="w-5 h-5" /></button>;
                  })}
                  <button onClick={() => setSelectedId(null)} aria-label="Kapat" className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-4 sm:p-5">{panel}</div>
            </aside>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      <Card padded={false} className="xl:col-span-2 overflow-hidden">
        {toolbar}
        {list.length === 0 ? (
          <EmptyState icon={Inbox} title={view === "queue" ? "Bekleyen öneri yok" : "Geçmiş kayıt yok"} text={view === "queue" ? "Tüm kararlar verilmiş görünüyor." : undefined} />
        ) : (
          <ul className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
            {list.map(s => (
              <li key={s.id}>
                <button onClick={() => setSelectedId(s.id)} aria-current={selectedId === s.id ? "true" : undefined} className={`w-full text-left px-5 py-4 cursor-pointer transition-colors flex gap-3 ${selectedId === s.id ? "bg-emerald-50/60 shadow-[inset_3px_0_0_#059669]" : "hover:bg-slate-50/70"}`}>
                  <Avatar name={s.personnelName} size="sm" />
                  <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 leading-snug">{s.subject}{s.feasibility?.status === "open" && <FeasTag s={s} />}<RequestTag thread={messages.filter(m => m.suggestionId === s.id)} /></p>
                    {view === "queue" ? <WaitingBadge since={waitingSince(s)} settings={settings} /> : <StatusBadge status={s.approvalStatus} requiredStages={s.requiredStages} feasibility={s.feasibility?.status === "open"} />}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{s.personnelName} · {s.personnelDepartment || "—"}</p>
                  <p className="text-xs text-slate-400 mt-1 tabular-nums">{(s.createdAt || "").slice(0, 10)} · {(s.suggestionTypes || []).join(", ")}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="xl:col-span-3">
        {panel || <Card><EmptyState icon={ClipboardCheck} title="Bir öneri seçin" text="Soldaki listeden bir öneri seçerek detayını inceleyin ve kararınızı verin." /></Card>}
      </div>
    </div>
  );
}

// ---------- List view: sortable, filterable columns ----------

// Same reference number the one-pager prints ("Kayıt …"), so a printout can be found in the list.
const refNo = (s: KaizenSuggestion) => s.id.slice(-8).toUpperCase();

type ColKey = "no" | "date" | "name" | "dept" | "type" | "subject" | "saving" | "stage" | "status";

function QueueTable({ list, view, settings, evaluations, waitingSince, selectedId, onOpen }: {
  list: KaizenSuggestion[]; view: "queue" | "history"; settings: KaizenSettings; evaluations: KaizenEvaluation[];
  waitingSince: (s: KaizenSuggestion) => string; selectedId: string | null; onOpen: (id: string, orderedIds: string[]) => void;
}) {
  const [sort, setSort] = useState<{ key: ColKey; dir: 1 | -1 }>({ key: "date", dir: view === "queue" ? 1 : -1 });
  const [f, setF] = useState<Partial<Record<ColKey, string>>>({});
  // Filter row is hidden until the filter icon is pressed; filters stay applied while hidden.
  const [showFilters, setShowFilters] = useState(false);
  const evalBy = useMemo(() => new Map(evaluations.map(e => [e.suggestionId, e])), [evaluations]);

  // Getiri: the income the Kurul approved if any, else the suggestion's own estimate.
  const saving = (s: KaizenSuggestion) => {
    const x = expectedSaving(s, evalBy.get(s.id));
    return { n: x.amount, cur: x.currency };
  };
  const value = (s: KaizenSuggestion, k: ColKey): string | number => {
    switch (k) {
      case "no": return refNo(s);
      case "date": return s.createdAt || "";
      case "name": return s.personnelName || "";
      case "dept": return s.personnelDepartment || "";
      case "type": return (s.suggestionTypes || []).join(", ");
      case "subject": return s.subject || "";
      case "saving": { const v = saving(s); return toBaseCurrency(v.n, v.cur, settings) ?? -1; }
      case "stage": return s.stage || "";
      case "status": return statusLabel(s.approvalStatus, s.requiredStages, s.feasibility?.status === "open");
    }
  };

  const options = (k: ColKey) => Array.from(new Set(list.flatMap(s => k === "type" ? (s.suggestionTypes || []) : [String(value(s, k))]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"));

  const rows = useMemo(() => {
    const has = (s: KaizenSuggestion, k: ColKey, q: string) => {
      if (k === "type") return (s.suggestionTypes || []).includes(q);
      if (k === "saving") return (value(s, k) as number) >= (Number(q) || 0);
      if (k === "date") return (s.createdAt || "").slice(0, 10) >= q;
      return String(value(s, k)).toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"));
    };
    return list
      .filter(s => (Object.entries(f) as [ColKey, string][]).every(([k, q]) => !q || has(s, k, q)))
      .sort((a, b) => {
        const va = value(a, sort.key), vb = value(b, sort.key);
        return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "tr")) * sort.dir;
      });
  }, [list, f, sort, settings, evalBy]);

  const cols: { key: ColKey; label: string; filter: "text" | "select" | "date" | "min"; cls?: string }[] = [
    { key: "no", label: "No", filter: "text", cls: "w-24" },
    { key: "date", label: "Tarih", filter: "date", cls: "w-32" },
    { key: "name", label: "İsim", filter: "select" },
    { key: "dept", label: "Bölüm", filter: "select" },
    { key: "type", label: "Kategori", filter: "select" },
    { key: "subject", label: "Konu", filter: "text", cls: "min-w-[14rem]" },
    { key: "saving", label: "Getiri", filter: "min", cls: "text-right" },
    { key: "stage", label: "Aşama", filter: "select" },
    { key: "status", label: view === "queue" ? "Bekleme" : "Durum", filter: "select" }
  ];
  const activeFilters = Object.values(f).filter(Boolean).length;
  const filterCls = "w-full h-8 px-2 rounded-lg bg-white ring-1 ring-inset ring-slate-200 text-xs font-normal normal-case tracking-normal text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/40";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs text-slate-500 bg-slate-50/60 border-b border-slate-100">
        <span>{rows.length} / {list.length} öneri · sıralamak için başlığa tıklayın</span>
        <div className="flex items-center gap-2">
          {activeFilters > 0 && <button onClick={() => setF({})} className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" />Temizle</button>}
          <button
            onClick={() => setShowFilters(v => !v)}
            aria-pressed={showFilters}
            aria-label={showFilters ? "Süzgeçleri gizle" : "Süzgeçleri göster"}
            title={showFilters ? "Süzgeçleri gizle" : "Süz"}
            className={`relative h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all ${showFilters || activeFilters > 0 ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:ring-slate-300"}`}
          >
            <Filter className="w-4 h-4" />Süz
            {activeFilters > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-white text-emerald-700 text-[11px] font-bold flex items-center justify-center tabular-nums">{activeFilters}</span>}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[70vh]">
        <table className={tableCls}>
          <thead className={`${theadCls} sticky top-0 z-10`}>
            <tr>
              {cols.map(c => (
                <th key={c.key} className={`${thCls} ${c.cls || ""} whitespace-nowrap`} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                  <button onClick={() => setSort(p => ({ key: c.key, dir: p.key === c.key ? (p.dir === 1 ? -1 : 1) : 1 }))} className={`inline-flex items-center gap-1 uppercase cursor-pointer hover:text-slate-900 ${sort.key === c.key ? "text-slate-900" : ""}`}>
                    {c.label}
                    {sort.key === c.key ? (sort.dir === 1 ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                  </button>
                </th>
              ))}
            </tr>
            {showFilters && <tr className="bg-slate-50">
              {cols.map(c => (
                <th key={c.key} className="px-4 pb-2.5 pt-0 font-normal">
                  {c.filter === "select" ? (
                    <select value={f[c.key] || ""} onChange={e => setF(p => ({ ...p, [c.key]: e.target.value }))} className={filterCls} aria-label={`${c.label} süz`}>
                      <option value="">Tümü</option>
                      {options(c.key).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : c.filter === "date" ? (
                    <input type="date" value={f[c.key] || ""} onChange={e => setF(p => ({ ...p, [c.key]: e.target.value }))} className={filterCls} aria-label="Bu tarihten sonra" title="Bu tarihten sonra" />
                  ) : c.filter === "min" ? (
                    <input type="number" min={0} value={f[c.key] || ""} onChange={e => setF(p => ({ ...p, [c.key]: e.target.value }))} placeholder={`≥ ${settings.baseCurrency}`} className={`${filterCls} text-right`} aria-label={`En az getiri (${settings.baseCurrency})`} />
                  ) : (
                    <input value={f[c.key] || ""} onChange={e => setF(p => ({ ...p, [c.key]: e.target.value }))} placeholder="Ara…" className={filterCls} aria-label={`${c.label} ara`} />
                  )}
                </th>
              ))}
            </tr>}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length}><EmptyState icon={Inbox} title={list.length === 0 ? (view === "queue" ? "Bekleyen öneri yok" : "Geçmiş kayıt yok") : "Süzgece uyan öneri yok"} /></td></tr>
            ) : rows.map(s => {
              const v = saving(s);
              return (
                <tr key={s.id} onClick={() => onOpen(s.id, rows.map(r => r.id))} onKeyDown={e => { if (e.key === "Enter") onOpen(s.id, rows.map(r => r.id)); }} tabIndex={0}
                  className={`${trCls} cursor-pointer focus-visible:outline-none focus-visible:bg-emerald-50/60 ${selectedId === s.id ? "bg-emerald-50/60" : ""}`}>
                  <td className={`${tdCls} font-mono text-xs text-slate-500`}>{refNo(s)}</td>
                  <td className={`${tdCls} whitespace-nowrap tabular-nums`}>{(s.createdAt || "").slice(0, 10).split("-").reverse().join(".")}</td>
                  <td className={`${tdCls} whitespace-nowrap font-medium text-slate-900`}>{s.personnelName}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{s.personnelDepartment || "—"}</td>
                  <td className={tdCls}><div className="flex flex-wrap gap-1">{(s.suggestionTypes || []).map(t => <span key={t} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">{t}</span>)}</div></td>
                  <td className={`${tdCls} font-semibold text-slate-900`}><span className="line-clamp-2">{s.subject}{s.feasibility?.status === "open" && <FeasTag s={s} />}</span></td>
                  <td className={`${tdCls} text-right whitespace-nowrap tabular-nums`}>{v.n ? `${v.n.toLocaleString("tr-TR")} ${v.cur}` : "—"}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{s.stage || "—"}</td>
                  <td className={`${tdCls} whitespace-nowrap`}>{view === "queue" ? <WaitingBadge since={waitingSince(s)} settings={settings} /> : <StatusBadge status={s.approvalStatus} requiredStages={s.requiredStages} feasibility={s.feasibility?.status === "open"} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{children || "—"}</div></div>;
}

function DecisionPanel({ suggestion: s, stage, criteria, approvals, evaluations, readOnly, api, showToast, onDone, onChanged, settings, personnel, messages, onMessagePosted, currentUser }: {
  settings: KaizenSettings; personnel: KaizenPersonnel[]; messages: KaizenMessage[]; onMessagePosted: (m: KaizenMessage) => void; currentUser: any;
  suggestion: KaizenSuggestion; stage: "manager" | "board"; criteria: KaizenCriteria[]; approvals: KaizenApproval[]; evaluations: KaizenEvaluation[];
  readOnly: boolean; api: KaizenApi; showToast: (m: string) => void; onDone: () => void; onChanged: () => void;
}) {
  // Photos are not in the list record (Faz 3.4) — fetch the full suggestion when it has any.
  const photoCount = (s.photoCounts?.photosCurrent || 0) + (s.photoCounts?.photosPropose || 0);
  const { data: full } = useFullRecord<KaizenSuggestion>(api, photoCount ? `suggestions/${s.id}` : null);
  const photos = [...(full?.photosCurrent || []), ...(full?.photosPropose || [])];
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [criteriaId, setCriteriaId] = useState("");
  // Prefill the Board's income from the suggestion's own estimate, in the estimate's currency.
  const [income, setIncome] = useState(s.estimatedSaving ? String(s.estimatedSaving) : "");
  const [incomeCurrency, setIncomeCurrency] = useState(s.estimatedSaving && s.estimatedSavingCurrency ? s.estimatedSavingCurrency : settings.baseCurrency);
  const [yokoten, setYokoten] = useState(false);
  const [yokotenDescription, setYokotenDescription] = useState("");
  // Fizibilite (Faz 4.1)
  const feas = s.feasibility?.status === "open" ? s.feasibility : undefined;
  const [feasOpen, setFeasOpen] = useState(false);
  const [feasOwner, setFeasOwner] = useState(feas?.ownerId || "");
  const [feasDue, setFeasDue] = useState(feas?.dueDate || "");
  const [feasNote, setFeasNote] = useState(feas?.note || "");
  const saveFeasibility = async () => {
    if (!feasOwner || !feasDue) { showToast("Sorumlu ve hedef tarih seçiniz."); return; }
    setSaving(true);
    const res = await api.post(`suggestions/${s.id}/feasibility`, { ownerId: feasOwner, dueDate: feasDue, note: feasNote });
    setSaving(false);
    if (res.success) { showToast(feas ? "Fizibilite güncellendi." : "Öneri fizibiliteye alındı."); setFeasOpen(false); onDone(); }
    else showToast(`Hata: ${res.error || "Kaydedilemedi."}`);
  };

  const sortedCriteria = useMemo(() => [...criteria].sort((a, b) => a.point - b.point), [criteria]);
  const incomeNum = Number(income) || 0;
  // Suggest the rubric tier whose income band (in the base currency) contains the entered income —
  // converted with the customer's fixed rate when entered in another currency, none if not convertible.
  const incomeBase = toBaseCurrency(incomeNum, incomeCurrency, settings);
  const suggestedTier = incomeBase !== null && incomeBase > 0
    ? sortedCriteria.find(c => incomeBase >= c.minIncome && (c.maxIncome === 0 || incomeBase <= c.maxIncome))
    : undefined;
  const selectedCriteria = criteria.find(c => c.id === criteriaId);

  const decide = async (approved: boolean) => {
    if (!approved && !comment.trim()) { showToast("Lütfen red nedeni giriniz."); return; }
    if (stage === "board" && approved && settings.boardScoreRequired && !selectedCriteria) { showToast("Onaylamak için bir değerlendirme kriteri seçiniz."); return; }
    setSaving(true);
    const res = stage === "manager"
      ? await api.post(`suggestions/${s.id}/manager-decision`, { approved, comment })
      : await api.post(`suggestions/${s.id}/board-decision`, {
          approved, criteriaId, criteriaLabel: selectedCriteria?.criteria || "", point: selectedCriteria?.point || 0,
          yokoten, yokotenDescription, estimatedIncome: incomeNum, estimatedIncomeCurrency: incomeCurrency, comment
        });
    setSaving(false);
    if (res.success) { showToast(approved ? "Öneri onaylandı." : "Öneri reddedildi."); onDone(); }
    else showToast(`Hata: ${res.error || "İşlem başarısız."}`);
  };

  return (
    <Card padded={false} className="overflow-hidden">
      <header className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage === "manager" ? "Amir Onayı" : "Kurul Değerlendirmesi"}</p>
          <h3 className="text-xl font-black text-slate-900 mt-1">{s.subject}</h3>
          <p className="text-sm text-slate-500 mt-1">{s.personnelName} · {s.personnelDepartment || "—"} · {s.personnelJobTitle || "—"} · Amir: {s.teamLeaderName || "—"}</p>
          {stage === "manager" && !stagesOf(s).includes("Board") && !readOnly && (
            <p className="text-xs font-semibold text-teal-700 bg-teal-50 rounded-full px-3 py-1 mt-2 inline-block">Kurul eşiğinin altında: onayınız son karardır</p>
          )}
          {stage === "board" && !stagesOf(s).includes("Manager") && (
            <p className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-full px-3 py-1 mt-2 inline-block">Amir aşaması olmadan doğrudan Kurul'a geldi</p>
          )}
        </div>
        <StatusBadge status={s.approvalStatus} requiredStages={s.requiredStages} feasibility={s.feasibility?.status === "open"} />
      </header>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Fact label="Mevcut Durum">{s.currentState}</Fact>
          <Fact label="Önerilen İyileştirme">{s.improvementSuggestion}</Fact>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-700">Tahmini Kazanç{perPieceText(s) ? " (yıllık)" : ""}</p><p className="font-black text-emerald-900 tabular-nums mt-0.5">{s.estimatedSaving.toLocaleString("tr-TR")} {s.estimatedSavingCurrency}</p></div>
          <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-semibold text-slate-600">Tahmini Maliyet</p><p className="font-black text-slate-900 tabular-nums mt-0.5">{s.estimatedCost.toLocaleString("tr-TR")} {s.estimatedCostCurrency}</p></div>
          <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-semibold text-slate-600">Aşama</p><p className="font-bold text-slate-900 mt-0.5 text-sm">{s.stage || "—"}</p></div>
          <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-semibold text-slate-600">Kazanç Süresi</p><p className="font-bold text-slate-900 mt-0.5 text-sm">{s.paybackPeriod || "—"}</p></div>
        </div>
        {perPieceText(s) && <p className="text-sm text-emerald-800 bg-emerald-50/60 ring-1 ring-emerald-200/60 rounded-xl px-3.5 py-2.5 -mt-2 tabular-nums">Parça başı hesap: {perPieceText(s)}</p>}
        <KaizenSavingRevision s={s} evaluation={evaluations[0]} settings={settings} api={api} showToast={showToast} onSaved={onChanged}
          canRevise={s.approvalStatus !== "Rejected" && s.approvalStatus !== "Rejected 2nd" && (stage === "board" || (!readOnly && s.approvalStatus === "Pending"))} />
        {photoCount > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {photos.length
              ? photos.map((p, i) => <a key={i} href={p.dataUrl} target="_blank" rel="noreferrer"><img src={p.dataUrl} alt="" className="w-full h-28 object-cover rounded-xl ring-1 ring-slate-200" /></a>)
              : Array.from({ length: photoCount }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        )}

        {approvals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Önceki kararlar</p>
            {approvals.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "")).map(a => (
              <div key={a.id} className="flex gap-3 text-sm">
                {a.approved ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                <div><span className="font-semibold">{a.stage === "Manager" ? "Amir" : "Kurul"} · {a.approverName}</span> <span className="text-slate-400 tabular-nums">{(a.createdAt || "").slice(0, 10)}</span>
                  {a.comment && <p className="text-slate-600 mt-0.5 flex gap-1.5"><MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />{a.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        {evaluations.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm space-y-1">
            {evaluations.map(e => <p key={e.id}><span className="font-bold">{e.criteriaLabel || "Kriter seçilmedi"}</span> — {e.point} puan{e.estimatedIncome ? ` · Getiri ${e.estimatedIncome.toLocaleString("tr-TR")} ${e.estimatedIncomeCurrency}` : ""}{e.yokoten ? " · Yokoten uygulanabilir" : ""}</p>)}
          </div>
        )}

        <div className="rounded-2xl ring-1 ring-slate-200/80 p-4">
          <KaizenThread suggestion={s} messages={messages} api={api} currentUser={currentUser} isAuthor={false} onPosted={onMessagePosted} showToast={showToast} compact />
        </div>

        {stage === "board" && feas && (
          <div className={`rounded-xl ring-1 px-4 py-3 text-sm ${feasibilityOverdue(s) ? "bg-red-50 ring-red-200 text-red-800" : "bg-violet-50 ring-violet-200 text-violet-900"}`}>
            <p className="font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4" />Fizibilitede · Sorumlu: {feas.ownerName} · Hedef: {feas.dueDate.split("-").reverse().join(".")}{feasibilityOverdue(s) ? " · Gecikti" : ""}</p>
            {feas.note && <p className="mt-1 opacity-90">{feas.note}</p>}
            <p className="text-xs opacity-70 mt-1">Başlatan {feas.startedBy || "—"} · {new Date(feas.startedAt).toLocaleDateString("tr-TR")} — Kurul kararı verildiğinde çalışma kapanır.</p>
          </div>
        )}

        {!readOnly && stage === "board" && feasOpen && (
          <div className="rounded-2xl ring-1 ring-violet-200 bg-violet-50/40 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><FlaskConical className="w-4 h-4 text-violet-600" />{feas ? "Fizibiliteyi güncelle" : "Fizibiliteye al"}</p>
            <p className="text-xs text-slate-500">Karar vermeden önce öneri incelensin: sorumlu ve hedef tarih belirleyin. Öneri Kurul kuyruğunda "Fizibilitede" olarak bekler.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={feasOwner} onChange={e => setFeasOwner(e.target.value)} className={inputCls} aria-label="Fizibilite sorumlusu">
                <option value="">Sorumlu seçin…</option>
                {[...personnel].sort((a, b) => a.name.localeCompare(b.name, "tr")).map(p => <option key={p.id} value={p.id}>{p.name}{p.department ? ` — ${p.department}` : ""}</option>)}
              </select>
              <input type="date" value={feasDue} min={new Date().toISOString().slice(0, 10)} onChange={e => setFeasDue(e.target.value)} className={inputCls} aria-label="Hedef tarih" />
            </div>
            <textarea value={feasNote} onChange={e => setFeasNote(e.target.value)} rows={2} placeholder="Ne incelenecek? (maliyet teklifi, deneme, ölçüm…)" className={areaCls} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setFeasOpen(false)}>Vazgeç</Button>
              <Button variant="primary" onClick={saveFeasibility} disabled={saving}>{feas ? "Güncelle" : "Fizibiliteye al"}</Button>
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="border-t border-slate-100 pt-6 space-y-5">
            {stage === "board" && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2"><Award className="w-4 h-4" />Değerlendirme kriteri{!settings.boardScoreRequired && <span className="font-normal text-slate-500">(isteğe bağlı)</span>}</p>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {suggestedTier && <span className="text-xs font-semibold bg-teal-50 text-teal-700 rounded-full px-3 py-1 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Gelire göre önerilen: {suggestedTier.category} ({suggestedTier.point} puan)</span>}
                      {selectedCriteria && settings.rewardPerPoint > 0 && <span className="text-xs font-semibold bg-amber-50 text-amber-700 rounded-full px-3 py-1">Ödül: {fmtReward(rewardFor({ point: selectedCriteria.point }, settings)!)}</span>}
                    </div>
                  </div>
                  {sortedCriteria.length === 0 ? (
                    <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">Henüz kriter tanımlanmamış. Kurulum &gt; Değerlendirme Kriterleri bölümünden ekleyin.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {sortedCriteria.map(c => {
                        const on = criteriaId === c.id;
                        return (
                          <button key={c.id} onClick={() => setCriteriaId(c.id)} className={`text-left rounded-xl border p-3.5 cursor-pointer transition-all ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:border-slate-400"}`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold">{c.category ? `${c.category} · ` : ""}{c.criteria}</span>
                              <span className={`text-sm font-black tabular-nums ${on ? "text-amber-300" : "text-amber-600"}`}>{c.point} p</span>
                            </div>
                            {c.description && <p className={`text-xs mt-1 ${on ? "text-slate-300" : "text-slate-500"}`}>{c.description}</p>}
                            {(c.minIncome > 0 || c.maxIncome > 0) && <p className={`text-xs mt-1 tabular-nums ${on ? "text-slate-400" : "text-slate-400"}`}>{c.minIncome.toLocaleString("tr-TR")} – {c.maxIncome ? c.maxIncome.toLocaleString("tr-TR") : "∞"} {settings.baseCurrency}</p>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Onaylanan getiri</label>
                    <div className="flex gap-2">
                      <input type="number" min={0} value={income} onChange={e => setIncome(e.target.value)} placeholder="0" className={inputCls} />
                      <select value={incomeCurrency} onChange={e => setIncomeCurrency(e.target.value)} className={`${inputCls} !w-36`}>{currencyChoices(settings, incomeCurrency).map(c => <option key={c} value={c}>{c}</option>)}</select>
                    </div>
                  </div>
                  <div>
                    <p className="block text-sm font-semibold text-slate-700 mb-1.5">Yokoten (yatay yayılım)</p>
                    <div className="inline-flex bg-slate-100 rounded-xl p-1">
                      {([[true, "Yapılabilir"], [false, "Yapılamaz"]] as const).map(([v, l]) => (
                        <button key={l} onClick={() => setYokoten(v)} className={`h-9 px-4 rounded-lg text-sm font-semibold cursor-pointer ${yokoten === v ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
                {yokoten && <textarea value={yokotenDescription} onChange={e => setYokotenDescription(e.target.value)} rows={2} placeholder="Hangi hat/bölümlere yayılabilir?" className={areaCls} />}
              </>
            )}
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Yorum — reddederken gerekçe zorunludur" className={areaCls} />
            <div className="flex gap-3">
              <Button variant="brand" onClick={() => decide(true)} disabled={saving} className="flex-1 h-12"><CheckCircle2 className="w-5 h-5" />Onayla</Button>
              <Button variant="danger" onClick={() => decide(false)} disabled={saving} className="flex-1 h-12"><XCircle className="w-5 h-5" />Reddet</Button>
            </div>
            {stage === "board" && !feasOpen && (
              <button onClick={() => setFeasOpen(true)} className="w-full h-11 rounded-xl text-sm font-semibold text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50 flex items-center justify-center gap-2 cursor-pointer">
                <FlaskConical className="w-4 h-4" />{feas ? "Fizibiliteyi güncelle" : "Karar vermeden önce fizibiliteye al"}
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------- Yokoten & reward follow-ups ----------

function YokotenTab({ suggestions, evaluations, api, showToast, onReload }: { suggestions: KaizenSuggestion[]; evaluations: KaizenEvaluation[]; api: KaizenApi; showToast: (m: string) => void; onReload: () => void }) {
  const rows = useMemo(() => evaluations.filter(e => e.yokoten).map(e => ({ evaluation: e, suggestion: suggestions.find(s => s.id === e.suggestionId) })).filter(r => !!r.suggestion), [evaluations, suggestions]);
  const toggle = async (id: string, implemented: boolean) => {
    const res = await api.post(`evaluations/${id}/yokoten-implemented`, { implemented });
    if (res.success) { showToast(implemented ? "Yokoten uygulaması işaretlendi." : "Yokoten uygulaması geri alındı."); onReload(); }
    else showToast(`Hata: ${res.error || "İşlem başarısız."}`);
  };
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-black text-slate-900">Yokoten Fırsatları ({rows.length})</h3><p className="text-sm text-slate-500">Kurulun yatay yayılıma uygun gördüğü fikirlerin diğer alanlara uygulanma durumu.</p></div>
      {rows.length === 0 ? <EmptyState icon={Share2} title="Yokoten olarak işaretlenmiş öneri yok" /> : (
        <div className="overflow-x-auto"><table className={tableCls}>
          <thead className={theadCls}><tr><th className={thCls}>Konu</th><th className={thCls}>Bölüm</th><th className={thCls}>Açıklama</th><th className={thCls}>Durum</th></tr></thead>
          <tbody>{rows.map(({ evaluation: e, suggestion: s }) => (
            <tr key={e.id} className={trCls}>
              <td className={`${tdCls} font-semibold text-slate-900`}>{s!.subject}</td>
              <td className={tdCls}>{s!.personnelDepartment || "—"}</td>
              <td className={`${tdCls} text-slate-500 max-w-md`}>{e.yokotenDescription || "—"}</td>
              <td className={tdCls}>
                <button onClick={() => toggle(e.id, !e.yokotenImplemented)} className={`h-9 px-3.5 rounded-full text-sm font-semibold cursor-pointer ${e.yokotenImplemented ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{e.yokotenImplemented ? "Uygulandı" : "Bekliyor"}</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Card>
  );
}

function RewardTab({ suggestions, evaluations, api, showToast, onReload, settings }: { suggestions: KaizenSuggestion[]; evaluations: KaizenEvaluation[]; api: KaizenApi; showToast: (m: string) => void; onReload: () => void; settings: KaizenSettings }) {
  const rows = useMemo(() => evaluations.map(e => ({ evaluation: e, suggestion: suggestions.find(s => s.id === e.suggestionId) }))
    .filter(r => !!r.suggestion && r.suggestion!.approvalStatus === "Second Approval")
    .sort((a, b) => (b.evaluation.createdAt || "").localeCompare(a.evaluation.createdAt || "")), [evaluations, suggestions]);
  const toggle = async (id: string, paid: boolean) => {
    const res = await api.post(`evaluations/${id}/reward-status`, { status: paid ? "Ödendi" : "Bekliyor" });
    if (res.success) { showToast(paid ? "Ödül ödendi olarak işaretlendi." : "Ödül durumu bekliyor olarak güncellendi."); onReload(); }
    else showToast(`Hata: ${res.error || "İşlem başarısız."}`);
  };
  const pendingPoints = rows.filter(r => (r.evaluation.rewardStatus || "Bekliyor") !== "Ödendi").reduce((sum, r) => sum + (r.evaluation.point || 0), 0);
  const pending = rows.filter(r => (r.evaluation.rewardStatus || "Bekliyor") !== "Ödendi").length;
  // Amount owed per row: the amount fixed at approval/payment, else point × the current rate.
  const rewards = new Map(rows.map(r => [r.evaluation.id, rewardFor(r.evaluation, settings)]));
  const showAmounts = Array.from(rewards.values()).some(Boolean);
  const pendingAmount = rows
    .filter(r => (r.evaluation.rewardStatus || "Bekliyor") !== "Ödendi")
    .reduce((sum, r) => { const w = rewards.get(r.evaluation.id); return w && w.currency === settings.baseCurrency ? sum + w.amount : sum; }, 0);
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div><h3 className="font-black text-slate-900">Ödül Takibi ({rows.length})</h3><p className="text-sm text-slate-500">Onaylanan önerilerin ödül/prim ödemesi.</p></div>
        <p className="text-sm font-semibold text-amber-700 bg-amber-50 rounded-full px-4 py-1.5">{pending} ödeme bekliyor · {pendingPoints} puan{showAmounts && pendingAmount > 0 ? ` · ${pendingAmount.toLocaleString("tr-TR")} ${settings.baseCurrency}` : ""}</p>
      </div>
      {rows.length === 0 ? <EmptyState icon={Gift} title="Onaylanmış öneri bulunamadı" /> : (
        <div className="overflow-x-auto"><table className={tableCls}>
          <thead className={theadCls}><tr><th className={thCls}>Konu</th><th className={thCls}>Ad Soyad</th><th className={thCls}>Puan</th>{showAmounts && <th className={thCls}>Ödül Tutarı</th>}<th className={thCls}>Onaylanan Getiri</th><th className={thCls}>Ödül Durumu</th></tr></thead>
          <tbody>{rows.map(({ evaluation: e, suggestion: s }) => {
            const paid = (e.rewardStatus || "Bekliyor") === "Ödendi";
            return (
              <tr key={e.id} className={trCls}>
                <td className={`${tdCls} font-semibold text-slate-900`}>{s!.subject}</td>
                <td className={tdCls}>{s!.personnelName}</td>
                <td className={`${tdCls} font-bold tabular-nums`}>{e.point}</td>
                {showAmounts && (() => {
                  const w = rewards.get(e.id);
                  return <td className={`${tdCls} tabular-nums`} title={w && !w.snapshot ? "Güncel puan başı ödüle göre; ödendi olarak işaretlenince sabitlenir" : undefined}>{w ? `${fmtReward(w)}${w.snapshot ? "" : " *"}` : "—"}</td>;
                })()}
                <td className={`${tdCls} tabular-nums`}>{e.estimatedIncome ? `${e.estimatedIncome.toLocaleString("tr-TR")} ${e.estimatedIncomeCurrency}` : "—"}</td>
                <td className={tdCls}><button onClick={() => toggle(e.id, !paid)} className={`h-9 px-3.5 rounded-full text-sm font-semibold cursor-pointer ${paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{paid ? "Ödendi" : "Bekliyor"}</button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </Card>
  );
}

function FeasTag({ s }: { s: KaizenSuggestion }) {
  const late = feasibilityOverdue(s);
  return <span className={`ml-2 align-middle inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${late ? "bg-red-50 text-red-600" : "bg-violet-50 text-violet-700"}`} title={`Sorumlu: ${s.feasibility?.ownerName} · Hedef: ${s.feasibility?.dueDate}`}><FlaskConical className="w-3 h-3" />{late ? "Fizibilite gecikti" : "Fizibilitede"}</span>;
}

// The submitter's last word was a ready-made request → show it on the queue item.
function RequestTag({ thread }: { thread: KaizenMessage[] }) {
  if (!thread.length) return null;
  const last = thread.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  if (last.kind !== "request") return null;
  return <span className="ml-2 align-middle inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700" title={last.text}><MessageSquare className="w-3 h-3" />Talep</span>;
}
