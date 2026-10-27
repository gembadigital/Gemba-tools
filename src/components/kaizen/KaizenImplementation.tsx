import React, { useEffect, useMemo, useState } from "react";
import { Hammer, CalendarClock, CheckCircle2, AlertTriangle, ShieldCheck, Plus, Trash2, Camera, FileText, Search, Clock } from "lucide-react";
import {
  KaizenSuggestion, KaizenImplementation as Impl, KaizenEvaluation, KaizenPersonnel, KaizenAction, ImplementationStatus
} from "./kaizenTypes";
import {
  IMPLEMENTATION_STATUSES, IMPLEMENTATION_STATUS_COLORS, isImplementationOverdue, actionProgress, pendingFollowUps, percentChange, todayIso
} from "./kaizenCalc";
import { readAndShrink } from "./kaizenImage";
import { KaizenApi } from "./KaizenSuggestionSystem";
import KaizenOnePager from "./KaizenOnePager";
import { Card, KpiCard, SectionTitle, Button, EmptyState } from "./kaizenUi";

// Uygulama Takibi (Faz 2-A): Kurulca onaylanan her öneri için plan (sorumlu, hedef tarih, aksiyon
// listesi), önce/sonra ölçüm + fotoğraf, gerçekleşen kazanç, Kurul doğrulaması ve 30/90 gün
// kalıcılık kontrolü. "Uygulandı" artık tek bir tik değil; kanıtla kapanır.
interface Props {
  currentUser: any;
  suggestions: KaizenSuggestion[];
  implementations: Impl[];
  evaluations: KaizenEvaluation[];
  personnel: KaizenPersonnel[];
  isBoardMember: boolean;
  api: KaizenApi;
  showToast: (msg: string) => void;
  onSaved: (impl: Impl) => void;
  onReload: () => Promise<void> | void;
  companyName?: string;
}

type Draft = {
  ownerName: string; ownerEmail: string; targetDate: string; status: ImplementationStatus;
  actions: KaizenAction[];
  beforeMetric: Impl["beforeMetric"]; afterMetric: Impl["afterMetric"];
  photosBefore: Impl["photosBefore"]; photosAfter: Impl["photosAfter"];
  actualSaving: number; actualSavingCurrency: string; note: string;
  benefitDescription: string; benefits: Record<string, string>;
};

const CURRENCIES = ["TL", "USD", "EUR", "Eş Değer Ürün"];
const inputCls = "h-10 w-full px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "block text-xs font-semibold text-slate-500 mb-1";
const emptyMetric = { label: "", value: null as number | null, unit: "" };
const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "—");

function draftFrom(s: KaizenSuggestion, impl?: Impl): Draft {
  return {
    ownerName: impl?.ownerName ?? s.teamLeaderName ?? "",
    ownerEmail: impl?.ownerEmail ?? s.teamLeaderEmail ?? "",
    targetDate: impl?.targetDate ?? "",
    status: impl?.status ?? "Planlandı",
    actions: impl?.actions ?? [],
    beforeMetric: impl?.beforeMetric ?? { ...emptyMetric },
    afterMetric: impl?.afterMetric ?? { ...emptyMetric },
    photosBefore: impl?.photosBefore ?? [],
    photosAfter: impl?.photosAfter ?? [],
    actualSaving: impl?.actualSaving ?? 0,
    actualSavingCurrency: impl?.actualSavingCurrency ?? "TL",
    note: impl?.note ?? "",
    benefitDescription: impl?.benefitDescription ?? "",
    benefits: impl?.benefits ?? {}
  };
}

function StatusPill({ status, overdue }: { status: ImplementationStatus | "Plan yok"; overdue?: boolean }) {
  const color = status === "Plan yok" ? "#a16207" : IMPLEMENTATION_STATUS_COLORS[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: `${color}1f`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {status}{overdue ? " · Gecikti" : ""}
    </span>
  );
}

// Same effect groups as the CI Proje Yönetimi "Kaizen Öncesi Sonrası" form.
const BENEFIT_GROUPS: { title: string; fields: [string, string][] }[] = [
  { title: "Maliyet", fields: [["costEnergy", "Enerji"], ["costLabor", "İş Gücü"], ["costMaterial", "Malzeme"]] },
  { title: "Verimlilik", fields: [["productivityMachine", "Makine"], ["productivityMan", "Adam"], ["productivityMaterial", "Malzeme"]] },
  { title: "Kalite", fields: [["qualityProduct", "Ürün"], ["qualityMaterial", "Malzeme"], ["qualityScrap", "Fire"]] },
  { title: "Güvenlik", fields: [["safetyRiskDegree", "Risk Derecesi"], ["safetyKso", "KSO"]] }
];

type Filter = "all" | "noplan" | "active" | "done" | "overdue" | "verify";

export default function KaizenImplementation({
  currentUser, suggestions, implementations, evaluations, personnel, isBoardMember, api, showToast, onSaved, onReload, companyName
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const approved = useMemo(() => suggestions.filter(s => s.approvalStatus === "Second Approval"), [suggestions]);
  const implBySuggestion = useMemo(() => {
    const m = new Map<string, Impl>();
    implementations.forEach(i => m.set(i.suggestionId, i));
    return m;
  }, [implementations]);

  const rows = useMemo(() => approved.map(s => ({ s, impl: implBySuggestion.get(s.id) })), [approved, implBySuggestion]);

  const counts = {
    noplan: rows.filter(r => !r.impl).length,
    active: rows.filter(r => r.impl && (r.impl.status === "Planlandı" || r.impl.status === "Sürüyor")).length,
    done: rows.filter(r => r.impl?.status === "Tamamlandı").length,
    overdue: rows.filter(r => isImplementationOverdue(r.impl)).length,
    verify: rows.filter(r => r.impl?.status === "Tamamlandı" && r.impl.verification?.status === "Bekliyor").length
  };

  const visible = rows.filter(({ s, impl }) => {
    if (query && !`${s.subject} ${s.personnelName} ${impl?.ownerName || ""}`.toLowerCase().includes(query.toLowerCase())) return false;
    switch (filter) {
      case "noplan": return !impl;
      case "active": return !!impl && (impl.status === "Planlandı" || impl.status === "Sürüyor");
      case "done": return impl?.status === "Tamamlandı";
      case "overdue": return isImplementationOverdue(impl);
      case "verify": return impl?.status === "Tamamlandı" && impl.verification?.status === "Bekliyor";
      default: return true;
    }
  }).sort((a, b) => (b.s.updatedAt || "").localeCompare(a.s.updatedAt || ""));

  const selected = rows.find(r => r.s.id === selectedId);

  const chips: { key: Filter; label: string; n?: number }[] = [
    { key: "all", label: "Tümü", n: rows.length },
    { key: "noplan", label: "Plan bekliyor", n: counts.noplan },
    { key: "active", label: "Devam eden", n: counts.active },
    { key: "overdue", label: "Geciken", n: counts.overdue },
    { key: "done", label: "Tamamlanan", n: counts.done },
    { key: "verify", label: "Doğrulama bekliyor", n: counts.verify }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Plan Bekleyen" value={counts.noplan} icon={Clock} tone="amber" hint="Onaylandı, uygulama planı yok" onClick={() => setFilter("noplan")} />
        <KpiCard label="Devam Eden" value={counts.active} icon={Hammer} tone="blue" onClick={() => setFilter("active")} />
        <KpiCard label="Geciken" value={counts.overdue} icon={AlertTriangle} tone="red" hint="Hedef tarihi geçti" onClick={() => setFilter("overdue")} />
        <KpiCard label="Doğrulama Bekleyen" value={counts.verify} icon={ShieldCheck} tone="teal" hint="Gerçek kazanç Kurul onayında" onClick={() => setFilter("verify")} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
        <Card padded={false} className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">Kurul Onaylı Öneriler</p>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">{rows.length} öneri</span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Öneri, kişi veya sorumlu ara…" className={`${inputCls} pl-9`} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map(c => (
                <button
                  key={c.key}
                  onClick={() => setFilter(c.key)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold cursor-pointer transition-colors ${filter === c.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {c.label}{c.n !== undefined ? ` · ${c.n}` : ""}
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={Hammer} title="Kayıt yok" text="Yalnızca Kurulca onaylanan öneriler bu listede görünür." />
          ) : (
            <ul>
              {visible.map(({ s, impl }) => {
                const p = actionProgress(impl);
                const active = s.id === selectedId;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full text-left px-4 py-3.5 border-b border-slate-100 last:border-0 cursor-pointer transition-colors ${active ? "bg-slate-50" : "hover:bg-slate-50/70"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900 leading-snug">{s.subject}</p>
                        <StatusPill status={impl ? impl.status : "Plan yok"} overdue={isImplementationOverdue(impl)} />
                      </div>
                      <p className="text-[11px] font-semibold text-emerald-700 mt-1">✓ Kurul onaylı</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {s.personnelName}{impl?.ownerName ? ` · Sorumlu: ${impl.ownerName}` : ""}
                        {impl?.targetDate ? ` · Hedef: ${fmtDate(impl.targetDate)}` : ""}
                        {p.total ? ` · ${p.done}/${p.total} aksiyon` : ""}
                      </p>
                      {impl?.status === "Tamamlandı" && (
                        <p className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className={impl.verification?.status === "Doğrulandı" ? "text-emerald-700 font-semibold" : impl.verification?.status === "Reddedildi" ? "text-red-600 font-semibold" : "text-slate-500"}>
                            Kazanç: {impl.verification?.status}
                          </span>
                          {pendingFollowUps(impl).length > 0 && <span className="text-amber-600 font-semibold">Kalıcılık kontrolü gerekli</span>}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {selected ? (
          <ImplementationDetail
            key={selected.s.id}
            suggestion={selected.s}
            impl={selected.impl}
            evaluation={evaluations.find(e => e.suggestionId === selected.s.id)}
            currentUser={currentUser}
            personnel={personnel}
            isBoardMember={isBoardMember}
            api={api}
            showToast={showToast}
            onSaved={onSaved}
            onReload={onReload}
            companyName={companyName}
          />
        ) : (
          <Card><EmptyState icon={FileText} title="Bir öneri seçin" text="Plan, kanıt ve doğrulama adımları burada görünür." /></Card>
        )}
      </div>
    </div>
  );
}

function ImplementationDetail({
  suggestion: s, impl, evaluation, currentUser, personnel, isBoardMember, api, showToast, onSaved, onReload, companyName
}: {
  suggestion: KaizenSuggestion; impl?: Impl; evaluation?: KaizenEvaluation; currentUser: any; personnel: KaizenPersonnel[];
  isBoardMember: boolean; api: KaizenApi; showToast: (m: string) => void; onSaved: (i: Impl) => void; onReload: () => Promise<void> | void; companyName?: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(s, impl));
  const [saving, setSaving] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [verifyNote, setVerifyNote] = useState("");
  const [showOnePager, setShowOnePager] = useState(false);

  // Re-sync when the server record changes (save, verification, follow-up) but not while typing.
  useEffect(() => { setDraft(draftFrom(s, impl)); }, [impl?.updatedAt]);

  const email = (currentUser?.email || "").toLowerCase();
  const isStaffUser = currentUser?.role === "Admin" || currentUser?.role === "Consultant";
  const canEdit = isBoardMember || isStaffUser || (s.teamLeaderEmail || "").toLowerCase() === email || (impl?.ownerEmail || "").toLowerCase() === email;
  const canVerify = isBoardMember && (isStaffUser || ((impl?.ownerEmail || "").toLowerCase() !== email && (s.authorEmail || "").toLowerCase() !== email));

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));
  const estimated = evaluation?.estimatedIncome ? { v: evaluation.estimatedIncome, c: evaluation.estimatedIncomeCurrency } : s.estimatedSaving ? { v: s.estimatedSaving, c: s.estimatedSavingCurrency } : null;
  const change = percentChange(draft.beforeMetric.value, draft.afterMetric.value);

  const save = async (patch?: Partial<Draft>) => {
    const body = { ...draft, ...patch };
    if (body.status === "Tamamlandı" && !body.actions.every(a => a.done) && body.actions.length > 0) {
      showToast("Tamamlandı olarak kaydetmeden önce tüm aksiyonları işaretleyin.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`suggestions/${s.id}/implementation`, body);
      if (res.success) { onSaved(res.data); showToast("Uygulama kaydı güncellendi."); await onReload(); }
      else showToast(`Hata: ${res.error || "Kaydedilemedi."}`);
    } catch { showToast("Hata: Kaydedilemedi."); }
    setSaving(false);
  };

  const addAction = () => {
    const text = newAction.trim();
    if (!text) return;
    set("actions", [...draft.actions, { id: `a${Date.now().toString(36)}`, text, done: false, dueDate: "" }]);
    setNewAction("");
  };

  const addPhotos = async (which: "photosBefore" | "photosAfter", files: FileList | null) => {
    if (!files) return;
    const added: { dataUrl: string }[] = [];
    for (const f of Array.from(files)) added.push({ dataUrl: await readAndShrink(f) });
    set(which, [...draft[which], ...added].slice(0, 8));
  };

  const verify = async (decision: "Doğrulandı" | "Reddedildi") => {
    const res = await api.post(`implementations/${impl!.id}/verify`, { decision, note: verifyNote });
    if (res.success) { onSaved(res.data); setVerifyNote(""); showToast(decision === "Doğrulandı" ? "Gerçek kazanç doğrulandı." : "Kazanç beyanı reddedildi."); }
    else showToast(`Hata: ${res.error || "İşlem başarısız."}`);
  };

  const followUp = async (days: number, result: "Sürüyor" | "Bozuldu" | "") => {
    const res = await api.post(`implementations/${impl!.id}/followup`, { days, result });
    if (res.success) { onSaved(res.data); showToast("Kalıcılık kontrolü kaydedildi."); }
    else showToast(`Hata: ${res.error || "İşlem başarısız."}`);
  };

  const owners = personnel.filter(p => p.email);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uygulama Takibi</p>
            <h3 className="text-lg font-black text-slate-900 leading-tight">{s.subject}</h3>
            <p className="text-sm text-slate-500 mt-1">{s.personnelName}{s.personnelDepartment ? ` · ${s.personnelDepartment}` : ""}</p>
          </div>
          <Button variant="ghost" onClick={() => setShowOnePager(true)}><FileText className="w-4 h-4" />Tek Sayfa Önce/Sonra</Button>
        </div>
        {!canEdit && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3">Bu kaydı yalnızca sorumlu, takım lideri veya Kurul düzenleyebilir.</p>}
      </Card>

      <Card>
        <SectionTitle icon={CalendarClock} title="Plan" hint="Kim, ne zamana kadar, hangi durumda" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Sorumlu</label>
            <select
              className={inputCls}
              disabled={!canEdit}
              value={draft.ownerEmail}
              onChange={e => { const p = owners.find(o => o.email === e.target.value); setDraft(d => ({ ...d, ownerEmail: e.target.value, ownerName: p?.name || d.ownerName })); }}
            >
              {draft.ownerEmail && !owners.some(o => o.email === draft.ownerEmail) && <option value={draft.ownerEmail}>{draft.ownerName || draft.ownerEmail}</option>}
              {!draft.ownerEmail && <option value="">Seçin…</option>}
              {owners.map(o => <option key={o.id} value={o.email}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Hedef Tarih</label>
            <input type="date" className={inputCls} disabled={!canEdit} value={draft.targetDate} onChange={e => set("targetDate", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Durum</label>
            <select className={inputCls} disabled={!canEdit} value={draft.status} onChange={e => set("status", e.target.value as ImplementationStatus)}>
              {IMPLEMENTATION_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Aksiyonlar</label>
          <ul className="space-y-2">
            {draft.actions.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2">
                <input
                  type="checkbox" className="w-4 h-4 accent-emerald-600 cursor-pointer" checked={a.done} disabled={!canEdit}
                  onChange={e => set("actions", draft.actions.map((x, j) => j === i ? { ...x, done: e.target.checked } : x))}
                />
                <span className={`flex-1 text-sm ${a.done ? "line-through text-slate-400" : "text-slate-800"}`}>{a.text}</span>
                <input
                  type="date" className="h-9 px-2 rounded-lg border border-slate-200 text-xs w-36" disabled={!canEdit} value={a.dueDate}
                  onChange={e => set("actions", draft.actions.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x))}
                />
                {canEdit && (
                  <button onClick={() => set("actions", draft.actions.filter((_, j) => j !== i))} className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer flex items-center justify-center" aria-label="Aksiyonu sil">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="flex gap-2 mt-2">
              <input className={inputCls} placeholder="Yeni aksiyon…" value={newAction} onChange={e => setNewAction(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAction(); } }} />
              <Button variant="ghost" onClick={addAction}><Plus className="w-4 h-4" />Ekle</Button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Camera} title="Önce / Sonra Kanıtı" hint="Ölçüm ve fotoğraf; tek sayfa çıktıya bu bilgiler girer" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["beforeMetric", "afterMetric"] as const).map(k => (
            <div key={k} className="rounded-xl border border-slate-200 p-3 space-y-2">
              <p className={`text-xs font-bold uppercase tracking-wide ${k === "beforeMetric" ? "text-red-600" : "text-emerald-700"}`}>{k === "beforeMetric" ? "Önce" : "Sonra"}</p>
              <input className={inputCls} disabled={!canEdit} placeholder="Ölçüt (ör. Çevrim süresi)" value={draft[k].label} onChange={e => set(k, { ...draft[k], label: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className={inputCls} disabled={!canEdit} placeholder="Değer" value={draft[k].value ?? ""} onChange={e => set(k, { ...draft[k], value: e.target.value === "" ? null : Number(e.target.value) })} />
                <input className={inputCls} disabled={!canEdit} placeholder="Birim (sn, adet…)" value={draft[k].unit} onChange={e => set(k, { ...draft[k], unit: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
        {change !== null && <p className="text-sm font-semibold text-slate-700 mt-3">Değişim: <span className="tabular-nums">{change > 0 ? "+" : ""}{change.toFixed(1).replace(".", ",")}%</span></p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {(["photosBefore", "photosAfter"] as const).map(k => (
            <div key={k}>
              <p className={labelCls}>{k === "photosBefore" ? "Önce fotoğrafları" : "Sonra fotoğrafları"}</p>
              <div className="flex flex-wrap gap-2">
                {draft[k].map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p.dataUrl} alt="" className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                    {canEdit && (
                      <button onClick={() => set(k, draft[k].filter((_, j) => j !== i))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-900 text-white text-xs cursor-pointer" aria-label="Fotoğrafı sil">×</button>
                    )}
                  </div>
                ))}
                {canEdit && draft[k].length < 8 && (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 flex flex-col items-center justify-center text-xs cursor-pointer">
                    <Camera className="w-5 h-5 mb-1" />Ekle
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => { addPhotos(k, e.target.files); e.target.value = ""; }} />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Camera} title="Getiri Açıklaması" hint="Tek sayfa çıktının alt bölümü (CI Önce/Sonra formuyla aynı alanlar)" />
        <textarea className="w-full min-h-[64px] px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50" disabled={!canEdit} value={draft.benefitDescription} onChange={e => set("benefitDescription", e.target.value)} placeholder="Parasal veya oran bazında getirinin rakamsal ifadesi" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
          {BENEFIT_GROUPS.map(g => (
            <div key={g.title} className="rounded-xl border border-slate-200 p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{g.title}</p>
              {g.fields.map(([key, label]) => (
                <input key={key} className={inputCls} disabled={!canEdit} placeholder={label} value={draft.benefits[key] || ""} onChange={e => set("benefits", { ...draft.benefits, [key]: e.target.value })} />
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={CheckCircle2} title="Gerçekleşen Kazanç" hint="Tahmini ile yan yana; Kurul doğrulayınca raporlara girer" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className={labelCls}>Tahmini</label>
            <p className="h-10 flex items-center text-sm font-semibold text-slate-700 tabular-nums">{estimated ? `${estimated.v.toLocaleString("tr-TR")} ${estimated.c}` : "—"}</p>
          </div>
          <div>
            <label className={labelCls}>Gerçekleşen</label>
            <input type="number" min={0} className={inputCls} disabled={!canEdit} value={draft.actualSaving || ""} onChange={e => set("actualSaving", Number(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelCls}>Para birimi</label>
            <select className={inputCls} disabled={!canEdit} value={draft.actualSavingCurrency} onChange={e => set("actualSavingCurrency", e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className={labelCls}>Not</label>
          <textarea className="w-full min-h-[72px] px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50" disabled={!canEdit} value={draft.note} onChange={e => set("note", e.target.value)} placeholder="Hesaplama yöntemi, varsayımlar…" />
        </div>
        {canEdit && (
          <div className="flex justify-end mt-4">
            <Button variant="brand" onClick={() => save()} disabled={saving}>{saving ? "Kaydediliyor…" : impl ? "Kaydet" : "Planı Oluştur"}</Button>
          </div>
        )}
      </Card>

      {impl?.status === "Tamamlandı" && (
        <Card>
          <SectionTitle icon={ShieldCheck} title="Kurul Doğrulaması" hint="Beyan edilen gerçek kazanç Kurul tarafından teyit edilir" />
          <p className="text-sm text-slate-700">
            Durum: <b className={impl.verification.status === "Doğrulandı" ? "text-emerald-700" : impl.verification.status === "Reddedildi" ? "text-red-600" : "text-slate-700"}>{impl.verification.status}</b>
            {impl.verification.by ? ` · ${impl.verification.by} (${fmtDate(impl.verification.at)})` : ""}
          </p>
          {impl.verification.note && <p className="text-sm text-slate-500 mt-1">“{impl.verification.note}”</p>}
          {canVerify && impl.verification.status !== "Doğrulandı" && (
            <div className="mt-3 space-y-2">
              <input className={inputCls} placeholder="Not (reddederken zorunlu)" value={verifyNote} onChange={e => setVerifyNote(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="brand" onClick={() => verify("Doğrulandı")}><ShieldCheck className="w-4 h-4" />Doğrula</Button>
                <Button variant="danger" onClick={() => verify("Reddedildi")}>Reddet</Button>
              </div>
            </div>
          )}
          {isBoardMember && !canVerify && impl.verification.status !== "Doğrulandı" && (
            <p className="text-xs text-slate-500 mt-2">Kendi uygulamanızı doğrulayamazsınız; başka bir Kurul üyesi doğrulamalıdır.</p>
          )}
        </Card>
      )}

      {impl?.status === "Tamamlandı" && (
        <Card>
          <SectionTitle icon={Clock} title="Kalıcılık Kontrolü" hint="İyileştirme hâlâ yerinde mi? 30. ve 90. günde bakılır" />
          <ul className="space-y-2">
            {impl.followUps.map(f => {
              const due = f.dueDate <= todayIso();
              return (
                <li key={f.days} className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{f.days}. gün kontrolü</p>
                    <p className="text-xs text-slate-500">Tarih: {fmtDate(f.dueDate)}{f.checkedBy ? ` · ${f.checkedBy}` : ""}</p>
                  </div>
                  {f.result ? (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${f.result === "Sürüyor" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{f.result === "Sürüyor" ? "Yerinde" : "Bozuldu"}</span>
                      {canEdit && <button onClick={() => followUp(f.days, "")} className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer underline">Geri al</button>}
                    </div>
                  ) : canEdit ? (
                    <div className="flex gap-2">
                      <Button variant="ghost" className="h-9" onClick={() => followUp(f.days, "Sürüyor")}>Yerinde</Button>
                      <Button variant="ghost" className="h-9 text-red-600" onClick={() => followUp(f.days, "Bozuldu")}>Bozuldu</Button>
                    </div>
                  ) : (
                    <span className={`text-xs font-semibold ${due ? "text-amber-600" : "text-slate-400"}`}>{due ? "Kontrol gerekli" : "Bekliyor"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {showOnePager && (
        <KaizenOnePager suggestion={s} implementation={impl} evaluation={evaluation} companyName={companyName} onClose={() => setShowOnePager(false)} />
      )}
    </div>
  );
}
