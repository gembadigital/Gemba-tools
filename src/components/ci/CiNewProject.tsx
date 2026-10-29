// New CI project — full-screen, step-by-step start (plan step C5, requirements B1–B3). Replaces the
// old small wizard + team modal. 1 Source: an opportunity from the pool (other modules' findings) or
// a blank project · 2 Definition · 3 Team & plan (8 step dates spread to the target date) · 4 Summary.
// Nothing is invented: amounts are prefilled only from what the source recorded.
import React, { useMemo, useState } from "react";
import {
  X, ArrowLeft, ArrowRight, Check, Search, Sparkles, FilePlus2, Lock, RefreshCw, Target, Users, ClipboardCheck, Layers
} from "lucide-react";
import type { KaizenCard } from "../../types";
import { CI_OPPORTUNITY_SOURCES, CiOpportunity, CiOpportunitySource } from "../../utils/ciOpportunityPool";
import { CI_STEPS, CiUserLike, isCiStaffUser } from "../../utils/ciLifecycle";
import { distributeStagePlan } from "../../utils/ciPlan";
import type { CiProductFamily } from "../../utils/ciSettings";
import type { CiOpportunityPool } from "./useCiOpportunities";
import type { CiPerson } from "./CiProjectCard";
import { defaultFinancialsInput } from "./ciTypes";
import { Card, Button, FormField, ChoiceChip, AmountInput, Pill, EmptyState, inputCls, areaCls, formatAmount } from "./ciUi";

interface Props {
  companyName?: string;
  currentUser: CiUserLike | null;
  people: CiPerson[];
  departments: string[];
  phases: string[];
  defaultDurationDays: number;
  productFamilies: CiProductFamily[];
  currencySymbol: string;
  currencyOptions: { value: string; label: string }[];
  pool: CiOpportunityPool;
  poolLoading: boolean;
  poolError: string | null;
  onReloadPool: () => void;
  onCreate: (project: KaizenCard) => Promise<KaizenCard | undefined>;
  onClose: () => void;
}

const STEPS = [
  { key: "source", label: "Kaynak", icon: Sparkles },
  { key: "define", label: "Tanım", icon: Target },
  { key: "team", label: "Ekip ve plan", icon: Users },
  { key: "summary", label: "Özet", icon: ClipboardCheck }
] as const;

const ALL = "all";
const todayIso = () => new Date().toISOString().split("T")[0];
const addDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split("T")[0];
const fmtDate = (iso?: string) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR") : "—";

export default function CiNewProject(props: Props) {
  const { pool, currentUser, people } = props;
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"pool" | "blank" | null>(null);
  const [opp, setOpp] = useState<CiOpportunity | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState<string>(ALL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Definition
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [department, setDepartment] = useState(props.departments[0] || "");
  const [phase, setPhase] = useState(props.phases[0]);
  const [currentLoss, setCurrentLoss] = useState<number | null>(null);
  const [expectedGain, setExpectedGain] = useState<number | null>(null);
  const [kpiName, setKpiName] = useState("");
  // Team & plan — a customer user starts as leader of their own project.
  const meIsPerson = people.some(p => p.id === currentUser?.id);
  const [leaderId, setLeaderId] = useState<string>(!isCiStaffUser(currentUser) && meIsPerson ? currentUser!.id! : "");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState(addDays(props.defaultDurationDays));
  const [spreadPlan, setSpreadPlan] = useState(true);

  const ratioOf = (name: string) => name === ALL ? 1 : (props.productFamilies.find(f => f.name === name)?.sharePct || 100) / 100;
  const familyRatio = ratioOf(family);
  const scaled = (o: CiOpportunity, v?: number, ratio = familyRatio) => v === undefined ? undefined : Math.round(o.scalable ? v * ratio : v);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of pool.items) c[o.source] = (c[o.source] || 0) + 1;
    return c;
  }, [pool.items]);
  const visible = pool.items
    .filter(o => sourceFilter === ALL || o.source === sourceFilter)
    .filter(o => !search.trim() || `${o.title} ${o.detail} ${o.department || ""}`.toLocaleLowerCase("tr").includes(search.trim().toLocaleLowerCase("tr")))
    .sort((a, b) => Number(!!a.convertedProjectId) - Number(!!b.convertedProjectId) || (a.priority === "High" ? -1 : 0) - (b.priority === "High" ? -1 : 0));

  const pick = (o: CiOpportunity | null, ratio = familyRatio) => {
    setOpp(o);
    setMode(o ? "pool" : "blank");
    // Prefill from the source (only what it recorded)
    setTitle(o ? o.title : "");
    setProblem(o ? o.detail : "");
    if (o?.department) setDepartment(o.department);
    setCurrentLoss(o ? scaled(o, o.currentLoss, ratio) ?? null : null);
    setExpectedGain(o ? scaled(o, o.expectedGain, ratio) ?? null : null);
  };

  const leader = people.find(p => p.id === leaderId);
  const staff = isCiStaffUser(currentUser);
  const selfIncluded = staff || leaderId === currentUser?.id || memberIds.includes(currentUser?.id || "");
  const plan = spreadPlan ? distributeStagePlan(todayIso(), targetDate) : null;

  const stepErrors = [
    mode === null ? "Bir fırsat seçin ya da boş proje başlatın." : mode === "pool" && !opp ? "Listeden bir fırsat seçin." : "",
    !title.trim() ? "Proje adı gerekli." : !problem.trim() ? "Problem tanımı gerekli." : "",
    !leaderId ? "Proje lideri seçin." : !selfIncluded ? "Kendinizi proje lideri ya da ekip üyesi olarak seçmelisiniz (aksi halde projeyi göremezsiniz)." : !targetDate || targetDate < todayIso() ? "Hedef tarih bugünden sonra olmalı." : "",
    ""
  ];

  const create = async () => {
    setBusy(true);
    setError(null);
    const members = people.filter(p => memberIds.includes(p.id) && p.id !== leaderId);
    const project = {
      id: `kai_${Math.random().toString(36).slice(2, 9)}`,
      title: title.trim(),
      originator: leader?.name || "",
      department: department.trim(),
      dateProposed: todayIso(),
      impactLevel: opp?.priority || "Medium",
      estimatedCost: 0,
      actualSavings: 0,
      status: "Draft",
      descriptionBefore: problem.trim(),
      descriptionAfter: "",
      problemDefinition: problem.trim(),
      problemDetail: "",
      currentLoss: currentLoss || 0,
      ...(expectedGain ? { expectedGain, expectedGainCurrency: props.currencyOptions[0]?.value } : {}),
      phase,
      projectLeader: leader?.name || "",
      projectLeaderId: leader?.id,
      projectTeam: members.map(m => m.name),
      projectTeamIds: members.map(m => m.id),
      projectSponsor: "",
      plannedFinishDate: targetDate,
      ...(plan ? { stageDates: plan } : {}),
      ...(kpiName.trim() ? { kpi: { name: kpiName.trim(), unit: "", direction: "decrease", baseline: null, target: null, measurements: [] }, targetKpi: kpiName.trim() } : {}),
      ...(opp ? { opportunityId: opp.id, opportunityType: opp.title, opportunitySource: opp.source } : {}),
      tasks: [],
      financialsInput: defaultFinancialsInput()
    } as unknown as KaizenCard;
    const saved = await props.onCreate(project);
    setBusy(false);
    if (!saved) setError("Proje oluşturulamadı. Bu fırsat başka bir projeye dönüştürülmüş olabilir — havuzu yenileyin.");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto" role="dialog" aria-label="Yeni CI projesi">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200/70">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Yeni CI projesi</h2>
            <p className="text-xs text-slate-500 truncate">{props.companyName || ""}{props.companyName ? " · " : ""}Toyota 8 adım A3</p>
          </div>
          <button type="button" onClick={props.onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Kapat"><X className="w-5 h-5" /></button>
        </div>
        {/* Step indicator */}
        <ol className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step, current = i === step;
            return (
              <li key={s.key} className="flex items-center gap-2 shrink-0">
                <span className={`h-9 pl-1.5 pr-3 rounded-full flex items-center gap-2 text-sm font-semibold ring-1 ring-inset ${current ? "bg-slate-900 text-white ring-slate-900" : done ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white text-slate-500 ring-slate-200"}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center ${current ? "bg-white/15" : done ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </span>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="w-4 h-px bg-slate-300" />}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 pb-28 space-y-4">
        {step === 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SourceChoice on={mode === "pool"} icon={Sparkles} title="Fırsat havuzundan başlat"
                text={`Diğer modüllerin bulduğu iyileşme noktaları (${pool.items.filter(o => !o.convertedProjectId).length} açık fırsat).`}
                onClick={() => { setMode("pool"); if (opp?.convertedProjectId) setOpp(null); }} />
              <SourceChoice on={mode === "blank"} icon={FilePlus2} title="Boş proje başlat" text="Problemi kendiniz tanımlayın." onClick={() => pick(null)} />
            </div>

            {mode === "pool" && (
              <Card>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
                  <div className="flex flex-wrap gap-2 flex-1">
                    <ChoiceChip on={sourceFilter === ALL} onClick={() => setSourceFilter(ALL)}>Tümü · {pool.items.length}</ChoiceChip>
                    {(Object.keys(CI_OPPORTUNITY_SOURCES) as CiOpportunitySource[]).map(src => (
                      <ChoiceChip key={src} on={sourceFilter === src} onClick={() => setSourceFilter(src)}>{CI_OPPORTUNITY_SOURCES[src].label} · {counts[src] || 0}</ChoiceChip>
                    ))}
                  </div>
                  <Button variant="ghost" onClick={props.onReloadPool} disabled={props.poolLoading}><RefreshCw className={`w-4 h-4 ${props.poolLoading ? "animate-spin" : ""}`} /> Yenile</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 mb-4">
                  <label className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input className={`${inputCls} pl-11`} placeholder="Fırsatlarda ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </label>
                  {props.productFamilies.length > 0 && counts.loss > 0 && (
                    <select className={`${inputCls} md:w-72`} value={family} onChange={(e) => { setFamily(e.target.value); if (opp) pick(opp, ratioOf(e.target.value)); }} aria-label="Ürün ailesi">
                      <option value={ALL}>Loss tutarları: tüm fabrika</option>
                      {props.productFamilies.map(f => <option key={f.name} value={f.name}>Loss tutarları: {f.name} (%{f.sharePct})</option>)}
                    </select>
                  )}
                </div>
                {props.poolError && <p className="text-sm text-red-600 mb-3">{props.poolError}</p>}
                {props.poolLoading && !pool.items.length ? (
                  <p className="text-sm text-slate-500">Fırsatlar yükleniyor…</p>
                ) : visible.length === 0 ? (
                  <EmptyState icon={Layers} title="Bu kaynakta fırsat yok"
                    text={sourceFilter !== ALL ? CI_OPPORTUNITY_SOURCES[sourceFilter as CiOpportunitySource].hint : "Diğer modüllerde analiz yapıldıkça fırsatlar burada belirir. Boş proje de başlatabilirsiniz."} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {visible.map(o => {
                      const selected = opp?.id === o.id;
                      const locked = !!o.convertedProjectId;
                      const loss = scaled(o, o.currentLoss), gain = scaled(o, o.expectedGain);
                      return (
                        <button key={o.id} type="button" disabled={locked} onClick={() => pick(o)} aria-pressed={selected}
                          className={`text-left rounded-2xl p-4 ring-1 transition-all flex flex-col gap-2 ${locked ? "bg-slate-50 ring-slate-200 opacity-70 cursor-not-allowed" : selected ? "bg-emerald-50 ring-2 ring-emerald-500 cursor-pointer" : "bg-white ring-slate-200 hover:ring-slate-300 hover:shadow-sm cursor-pointer"}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Pill tone={o.source === "loss" ? "blue" : o.source === "opex" ? "violet" : o.source === "kaizen" ? "amber" : o.source === "ptr" ? "red" : o.source === "vsm" ? "emerald" : "slate"}>{CI_OPPORTUNITY_SOURCES[o.source].label}</Pill>
                            {o.priority === "High" && <Pill tone="red">Öncelikli</Pill>}
                            {selected && <Check className="w-4 h-4 text-emerald-600 ml-auto" />}
                          </div>
                          <p className="text-sm font-bold text-slate-900 leading-snug">{o.title}</p>
                          <p className="text-xs text-slate-600 line-clamp-3">{o.detail}</p>
                          {(loss || gain) && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                              {loss ? <span className="text-slate-500">Kayıp <b className="text-red-600 tabular-nums">{props.currencySymbol}{formatAmount(loss)}</b></span> : null}
                              {gain ? <span className="text-slate-500">Potansiyel <b className="text-emerald-700 tabular-nums">{props.currencySymbol}{formatAmount(gain)}</b></span> : null}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 mt-auto">
                            {locked ? <span className="flex items-center gap-1 font-semibold text-slate-600"><Lock className="w-3 h-3" /> {o.convertedProjectNo} projesine dönüştü</span>
                              : [o.department, o.leanTool, o.ref].filter(Boolean).join(" · ")}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        {step === 1 && (
          <Card>
            {opp && <div className="mb-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-sm text-slate-700"><b>Kaynak:</b> {CI_OPPORTUNITY_SOURCES[opp.source].label} — {opp.title}{opp.ref ? ` (${opp.ref})` : ""}</div>}
            <div className="space-y-5">
              <FormField label="Proje adı" required>
                <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ör. Pres hattında kalıp değişim süresinin düşürülmesi" />
              </FormField>
              <FormField label="Problem tanımı" required hint="Ne, nerede, ne zaman, ne kadar? 1. adımda geliştirilir.">
                <textarea className={areaCls} rows={4} value={problem} onChange={(e) => setProblem(e.target.value)} />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Departman">
                  <input className={inputCls} list="ci-new-departments" value={department} onChange={(e) => setDepartment(e.target.value)} />
                  <datalist id="ci-new-departments">{props.departments.map(d => <option key={d} value={d} />)}</datalist>
                </FormField>
                <FormField label="Proje fazı">
                  <select className={inputCls} value={phase} onChange={(e) => setPhase(e.target.value)}>
                    {props.phases.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Yıllık kayıp" hint={opp?.currentLoss ? "Kaynaktan geldi" : "Biliniyorsa"}>
                  <AmountInput value={currentLoss} onChange={setCurrentLoss} suffix={props.currencySymbol} />
                </FormField>
                <FormField label="Beklenen yıllık kazanç" hint={opp?.expectedGain ? "Kaynaktan geldi" : "3. adımda kesinleşir"}>
                  <AmountInput value={expectedGain} onChange={setExpectedGain} suffix={props.currencySymbol} />
                </FormField>
                <FormField label="Hedef KPI" hint="İsteğe bağlı; 3. adımda değerleri girilir">
                  <input className={inputCls} value={kpiName} onChange={(e) => setKpiName(e.target.value)} placeholder="ör. Kalıp değişim süresi" />
                </FormField>
              </div>
            </div>
          </Card>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <div className="space-y-5">
                <FormField label="Proje lideri" required hint="Adımları onaylayan kişi.">
                  <select className={inputCls} value={leaderId} onChange={(e) => { setLeaderId(e.target.value); setMemberIds(ids => ids.filter(x => x !== e.target.value)); }}>
                    <option value="">Seçin</option>
                    {people.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </FormField>
                <FormField label="Ekip üyeleri">
                  <div className="flex flex-wrap gap-2">
                    {people.filter(p => p.id !== leaderId).map(p => (
                      <ChoiceChip key={p.id} on={memberIds.includes(p.id)} onClick={() => setMemberIds(ids => ids.includes(p.id) ? ids.filter(x => x !== p.id) : [...ids, p.id])}>{p.label}</ChoiceChip>
                    ))}
                    {people.length === 0 && <p className="text-sm text-slate-500">Müşteri kartında atanmış danışman ya da müşteri kullanıcısı yok.</p>}
                  </div>
                </FormField>
              </div>
            </Card>
            <Card>
              <div className="space-y-4">
                <FormField label="Hedef bitiş tarihi" required hint={`Varsayılan: bugünden ${props.defaultDurationDays} gün sonra (CI ayarları).`}>
                  <input type="date" className={inputCls} value={targetDate} min={todayIso()} onChange={(e) => setTargetDate(e.target.value)} />
                </FormField>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 mt-0.5 accent-emerald-600" checked={spreadPlan} onChange={(e) => setSpreadPlan(e.target.checked)} />
                  <span className="text-sm text-slate-700"><b>Adım planını hedef tarihe göre dağıt</b><br /><span className="text-slate-500">8 adımın planlanan tarihleri eşit aralıklarla yazılır; sorumlu performansı bu plana göre izlenir. Lider sonra değiştirebilir.</span></span>
                </label>
                {plan && (
                  <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {CI_STEPS.map(st => <li key={st.no} className="flex justify-between gap-2"><span className="text-slate-600 truncate">{st.no}. {st.short}</span><span className="tabular-nums font-semibold text-slate-800">{fmtDate(plan[st.no].planned)}</span></li>)}
                  </ol>
                )}
              </div>
            </Card>
          </div>
        )}

        {step === 3 && (
          <Card>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ["Proje adı", title],
                ["Kaynak", opp ? `${CI_OPPORTUNITY_SOURCES[opp.source].label} — ${opp.title}` : "Boş proje"],
                ["Departman / faz", `${department || "—"} / ${phase}`],
                ["Proje lideri", leader?.label || "—"],
                ["Ekip", people.filter(p => memberIds.includes(p.id)).map(p => p.name).join(", ") || "—"],
                ["Hedef bitiş", fmtDate(targetDate)],
                ["Yıllık kayıp", currentLoss ? `${props.currencySymbol}${formatAmount(currentLoss)}` : "—"],
                ["Beklenen yıllık kazanç", expectedGain ? `${props.currencySymbol}${formatAmount(expectedGain)}` : "—"],
                ["Hedef KPI", kpiName || "—"],
                ["Adım planı", plan ? "Hedef tarihe göre dağıtıldı" : "Girilmedi"]
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt><dd className="text-slate-900 font-semibold mt-0.5">{v}</dd></div>
              ))}
              <div className="md:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Problem</dt><dd className="text-slate-800 mt-0.5 whitespace-pre-wrap">{problem}</dd></div>
            </dl>
            <p className="text-sm text-slate-500 mt-5">Proje 1. adımda (Problemi Netleştir) açılır; ardından proje kartı açılır.</p>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          </Card>
        )}
      </div>

      {/* Footer navigation */}
      <div className="fixed bottom-0 inset-x-0 z-10 bg-white/95 backdrop-blur border-t border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <p className="text-sm text-amber-700 flex-1 min-w-0 truncate">{stepErrors[step]}</p>
          {step > 0 && <Button variant="outline" onClick={() => setStep(s => s - 1)}><ArrowLeft className="w-4 h-4" /> Geri</Button>}
          {step < STEPS.length - 1
            ? <Button variant="primary" onClick={() => setStep(s => s + 1)} disabled={!!stepErrors[step]}>İleri <ArrowRight className="w-4 h-4" /></Button>
            : <Button variant="brand" onClick={create} disabled={busy}><Check className="w-4 h-4" /> {busy ? "Oluşturuluyor…" : "Projeyi oluştur"}</Button>}
        </div>
      </div>
    </div>
  );
}

function SourceChoice({ on, icon: Icon, title, text, onClick }: { on: boolean; icon: any; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`text-left rounded-2xl p-5 ring-1 transition-all flex items-start gap-4 cursor-pointer ${on ? "bg-emerald-50 ring-2 ring-emerald-500" : "bg-white ring-slate-200 hover:ring-slate-300 hover:shadow-sm"}`}>
      <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${on ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}><Icon className="w-6 h-6" /></span>
      <span>
        <span className="block text-base font-bold text-slate-900">{title}</span>
        <span className="block text-sm text-slate-600 mt-0.5">{text}</span>
      </span>
    </button>
  );
}
