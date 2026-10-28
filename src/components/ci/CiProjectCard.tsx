// CI project card — the 8-step A3 (Toyota) view of one project (plan step C2). Replaces the old
// detail modal. Left: the 8 steps with state and dates; right: the selected step's fields and the
// requirements / approval controls of the current step. Rules live in utils/ciLifecycle.ts and are
// enforced by the server; this screen only mirrors them.
//
// Editing works on a local draft; "Kaydet" sends only the fields that changed, so two people
// editing different parts of the same project don't overwrite each other.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Save, FileSpreadsheet, CheckCircle2, Circle, Clock, Lock, Send, Undo2, PauseCircle,
  PlayCircle, XCircle, Users, Paperclip, History, ListChecks, Plus, Trash2, Camera, Download,
  ShieldCheck, Target, AlertTriangle, ChevronLeft, Layers, BarChart3, RotateCcw, Star, ArrowRightLeft, Presentation,
  BellRing, Repeat, X
} from "lucide-react";
import type { KaizenCard, BeforeAfterKaizenStudy } from "../../types";
import {
  CI_STEPS, CI_LAST_STAGE, CiKpi, CiStageAction, stageOf, isClosed, kpiOf, latestMeasurement, kpiProgressPct,
  stageRequirements, canEditProject, canApproveStage, canManageHold, isCiStaffUser, taskStatusOf, rootCauseOf, fishboneRootCauses,
  CiUserLike
} from "../../utils/ciLifecycle";
import { choicesWith } from "../../utils/ciSettings";
import { taskProgress } from "../../utils/ciPlan";
import CiTaskGantt from "./CiTaskGantt";
import CiFishbone from "./CiFishbone";
import CiA3Dialog from "./CiA3Dialog";
import {
  Card, SectionTitle, Button, FormField, ChoiceChip, Avatar, EmptyState, TabBar, AmountInput, Pill, inputCls, areaCls,
  readAndShrink, formatAmount
} from "./ciUi";

export interface CiPerson { id: string; name: string; label: string }

interface CiProjectCardProps {
  project: KaizenCard;
  projectNo: string;
  currentUser: CiUserLike | null;
  people: CiPerson[];                         // customer's team directory (consultants, customer users)
  departments: string[];
  phases: string[];
  fishboneCategories: string[];               // bones of the step-4 fishbone (CI settings)
  currencySymbol: string;                     // customer currency, e.g. "₺"
  companyName?: string;                       // shown on the A3 presentation card
  currencyOptions: { value: string; label: string }[];
  currencyChoices: (current: string) => { value: string; label: string }[];
  onSave: (changes: Partial<KaizenCard> & { id: string }) => Promise<KaizenCard | undefined>;
  onStageAction: (action: CiStageAction, note?: string) => Promise<{ ok: boolean; error?: string }>;
  // Sustainability check result (closed projects) and manual reminder e-mail (plan step C9).
  onFollowUp: (input: { index: number; value: number | null; sustained: boolean; note: string }) => Promise<{ ok: boolean; error?: string }>;
  onRemind: (to: "leader" | "team", note: string) => Promise<{ ok: boolean; error?: string; sent?: number }>;
  onClose: () => void;
  onExportExcel: () => void;
  onOpenFinancials: () => void;
  onCreateBeforeAfter: (taskId?: string) => void; // optional: link the new study to this action
  onExportBeforeAfter: (study: BeforeAfterKaizenStudy) => void;
  onDeleteBeforeAfter: (studyId: string) => void;
  // Kaizen ↔ CI bridge (plan C10): present only when the customer uses the Kaizen suggestion system.
  kaizenActive?: boolean;
  onShareToKaizen?: (study: BeforeAfterKaizenStudy, share: boolean) => Promise<{ ok: boolean; error?: string }>;
}

// Fields this card edits; the diff for "Kaydet" is taken over these.
const EDITABLE_FIELDS = [
  "title", "department", "phase", "problemDefinition", "descriptionBefore", "problemDetail", "currentLoss",
  "problemPhotos", "kpi", "targetObjective", "plannedFinishDate", "expectedGain", "expectedGainCurrency",
  "rootCauseWhys", "rootCause", "fishbone", "tasks", "estimatedCost", "kpiTargetMet", "realizedGain", "realizedGainCurrency",
  "actualSavings", "realizedImprovementPct", "resultPhotos", "stdWorkUpdated", "instructionRevised", "trainingGiven",
  "controlPlanUpdated", "auditListUpdated", "horizontalDeployment", "lessonsLearned", "projectResult",
  "resultDescription", "projectLeader", "projectLeaderId", "projectTeam", "projectTeamIds", "projectSponsor",
  "stageDates", "documents"
] as const;
type Draft = Partial<KaizenCard>;

const STANDARDIZATION_ITEMS: { key: keyof KaizenCard; label: string }[] = [
  { key: "stdWorkUpdated", label: "Standart iş güncellendi" },
  { key: "instructionRevised", label: "Talimat revize edildi" },
  { key: "controlPlanUpdated", label: "Kontrol planı güncellendi" },
  { key: "trainingGiven", label: "Eğitim verildi" },
  { key: "auditListUpdated", label: "Denetim listesi güncellendi" }
];

const RESULT_OPTIONS = ["Başarılı", "Revizyon Gerekli", "Askıya Alındı", "İptal"];
const TASK_STATUSES = ["Açık", "Devam Ediyor", "Yapıldı", "İptal"] as const;
const MAX_DOCUMENT_MB = 3; // stays under Vercel's ~4.5 MB request body limit with the rest of the record
const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const todayIso = () => new Date().toISOString().split("T")[0];
const fmtDate = (iso?: string | null) => iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("tr-TR") : "";

function draftFrom(p: KaizenCard): Draft {
  const d: any = {};
  for (const f of EDITABLE_FIELDS) d[f] = (p as any)[f];
  d.problemDefinition = p.problemDefinition ?? p.descriptionBefore ?? "";
  d.kpi = kpiOf(p);
  d.rootCauseWhys = Array.from({ length: 5 }, (_, i) => p.rootCauseWhys?.[i] ?? "");
  d.fishbone = Array.isArray(p.fishbone) ? p.fishbone : [];
  d.realizedGain = p.realizedGain ?? p.actualSavings;
  d.tasks = Array.isArray(p.tasks) ? p.tasks : [];
  return d;
}

const same = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export default function CiProjectCard(props: CiProjectCardProps) {
  const { project, currentUser, people } = props;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(project));
  type View = "steps" | "team" | "files" | "history";
  const [view, setView] = useState<View>("steps");
  const stage = stageOf(project);
  const closed = isClosed(project);
  const [selected, setSelected] = useState<number>(stage);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [note, setNote] = useState("");
  const [showA3, setShowA3] = useState(false);
  const [showRemind, setShowRemind] = useState(false);

  // A fresh project version (after save / action / someone else's change) refreshes the draft but
  // keeps the fields this user changed and hasn't saved yet.
  const lastOriginal = useRef<Draft>(draftFrom(project));
  useEffect(() => {
    const fresh = draftFrom(project);
    setDraft(prev => {
      const next: any = { ...fresh };
      for (const f of EDITABLE_FIELDS) {
        if (!same((prev as any)[f], (lastOriginal.current as any)[f])) next[f] = (prev as any)[f];
      }
      return next;
    });
    lastOriginal.current = fresh;
  }, [project]);
  useEffect(() => { setSelected(stageOf(project)); }, [project.id, project.stage]);
  // Phones: keep the selected step's chip visible in the horizontal strip.
  useEffect(() => {
    document.querySelector(`[data-ci-step="${selected}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selected]);

  const canEdit = canEditProject(currentUser, project) && !closed && project.holdState !== "cancelled";
  const canApprove = canApproveStage(currentUser, project);
  const staff = isCiStaffUser(currentUser);

  const original = useMemo(() => draftFrom(project), [project]);
  const changedKeys = EDITABLE_FIELDS.filter(f => !same((draft as any)[f], (original as any)[f]));
  const dirty = changedKeys.length > 0;

  const set = <K extends keyof KaizenCard>(key: K, value: KaizenCard[K]) => setDraft(prev => ({ ...prev, [key]: value }));
  const kpi = draft.kpi as CiKpi;
  const setKpi = (patch: Partial<CiKpi>) => set("kpi", { ...kpi, ...patch });

  // The draft as the project would look after saving — requirements are checked against it.
  const preview = { ...project, ...draft } as KaizenCard;
  const missing = stageRequirements(preview, stage);

  const save = async (): Promise<boolean> => {
    if (!dirty) return true;
    setBusy(true);
    const changes: any = { id: project.id };
    for (const f of changedKeys) changes[f] = (draft as any)[f];
    // Older readers use these copies; keep them in step with the A3 fields.
    if ("problemDefinition" in changes) changes.descriptionBefore = changes.problemDefinition;
    if ("realizedGain" in changes) changes.actualSavings = changes.realizedGain ?? 0;
    if ("kpi" in changes) changes.targetKpi = (draft.kpi as CiKpi).name;
    // `rootCause` holds only what the user wrote; readers use rootCauseOf (written → last why → marked
    // fishbone causes), so the derived value follows later edits of the chain / fishbone.
    const saved = await props.onSave(changes);
    setBusy(false);
    setMessage(saved ? { ok: true, text: "Kaydedildi." } : { ok: false, text: "Kaydedilemedi — yetkinizi ve bağlantınızı kontrol edin." });
    return !!saved;
  };

  const act = async (action: CiStageAction) => {
    if (dirty && canEdit && !(await save())) return;
    setBusy(true);
    const r = await props.onStageAction(action, note);
    setBusy(false);
    if (r.ok) setNote("");
    setMessage(r.ok ? { ok: true, text: "İşlem kaydedildi." } : { ok: false, text: r.error || "İşlem yapılamadı." });
  };

  const close = () => {
    if (dirty && !window.confirm("Kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı?")) return;
    props.onClose();
  };

  const leaderName = draft.projectLeader || project.originator || "—";
  const pending = project.pendingApproval;

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto" role="dialog" aria-label="CI proje kartı">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200/70">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={close} aria-label="Kartı kapat"><ArrowLeft className="w-4 h-4" /> Geri</Button>
          <div className="min-w-0 order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-semibold text-slate-500">{props.projectNo}</span>
              <StageBadge project={project} />
              {pending && <Pill tone="violet"><Clock className="w-3 h-3" /> Adım {pending.stage} onay bekliyor</Pill>}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 sm:truncate">{draft.title || "Adsız proje"}</h2>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="hidden md:flex items-center gap-2 mr-2">
              <Avatar name={leaderName} size="sm" />
              <div className="text-xs leading-tight">
                <div className="font-semibold text-slate-800">{leaderName}</div>
                <div className="text-slate-500">Proje lideri</div>
              </div>
            </div>
            {(staff || canApprove) && (
              <Button variant="outline" onClick={() => setShowRemind(true)} title="Lidere ya da ekibe hatırlatma e-postası gönder"><BellRing className="w-4 h-4" /><span className="hidden lg:inline">Hatırlat</span></Button>
            )}
            <Button variant="outline" onClick={() => setShowA3(true)} title="Tek sayfa A3 sunum kartı (PDF / Excel)"><Presentation className="w-4 h-4" /><span className="hidden sm:inline">A3 sunum</span></Button>
            <Button variant="outline" onClick={props.onExportExcel} title="Proje kartını Excel olarak indir"><FileSpreadsheet className="w-4 h-4" /><span className="hidden sm:inline">Excel</span></Button>
            {canEdit && (
              <Button variant="brand" onClick={save} disabled={!dirty || busy}>
                <Save className="w-4 h-4" /> {dirty ? `Kaydet (${changedKeys.length})` : "Kaydedildi"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-4">
        {message && (
          <div className={`text-sm rounded-xl px-4 py-3 ${message.ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"}`}>
            {message.text}
          </div>
        )}
        {!canEditProject(currentUser, project) && (
          <div className="text-sm rounded-xl px-4 py-3 bg-slate-100 text-slate-600 flex items-center gap-2"><Lock className="w-4 h-4" /> Bu projeyi yalnızca görüntüleyebilirsiniz.</div>
        )}
        {project.holdState && (
          <div className="text-sm rounded-xl px-4 py-3 bg-amber-50 text-amber-800 ring-1 ring-amber-200 flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2"><PauseCircle className="w-4 h-4" /> Proje {project.holdState === "cancelled" ? "iptal edildi" : "askıda"}.</span>
            {canManageHold(currentUser, project) && <Button variant="outline" onClick={() => act("resume")} disabled={busy}><PlayCircle className="w-4 h-4" /> Devam ettir</Button>}
          </div>
        )}

        <TabBar<View>
          value={view}
          onChange={setView}
          tabs={[
            { key: "steps", label: "A3 Adımları", icon: Layers },
            { key: "team", label: "Künye & Ekip", icon: Users },
            { key: "files", label: "Ekler", icon: Paperclip, count: (draft.documents || []).length },
            { key: "history", label: "Geçmiş", icon: History, count: (project.history || []).length }
          ]}
        />

        {view === "steps" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Stepper — phones: a horizontal strip; desktop: the vertical list */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CI_STEPS.map(st => {
                const done = closed || st.no < stage;
                const current = !closed && st.no === stage;
                return (
                  <button key={st.no} type="button" data-ci-step={st.no} onClick={() => setSelected(st.no)} aria-current={selected === st.no ? "step" : undefined}
                    className={`shrink-0 h-10 pl-1.5 pr-3 rounded-full flex items-center gap-2 text-sm font-semibold cursor-pointer ring-1 ring-inset ${
                      selected === st.no ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200"
                    }`}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      done ? "bg-emerald-600 text-white" : current ? "bg-amber-400 text-slate-900" : "bg-slate-100 text-slate-500"
                    }`}>{done ? <CheckCircle2 className="w-4 h-4" /> : st.no}</span>
                    {st.short}
                  </button>
                );
              })}
            </div>
            <Card className="hidden lg:block lg:col-span-4 xl:col-span-3 self-start" padded={false}>
              <ol className="p-2">
                {CI_STEPS.map(st => {
                  const done = closed || st.no < stage;
                  const current = !closed && st.no === stage;
                  const dates = project.stageDates?.[st.no];
                  return (
                    <li key={st.no}>
                      <button
                        type="button"
                        onClick={() => setSelected(st.no)}
                        aria-current={selected === st.no ? "step" : undefined}
                        className={`w-full text-left flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors cursor-pointer ${selected === st.no ? "bg-slate-100" : "hover:bg-slate-50"}`}
                      >
                        <span className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          done ? "bg-emerald-600 text-white" : current ? "bg-amber-400 text-slate-900 ring-4 ring-amber-100" : "bg-slate-100 text-slate-500"
                        }`}>
                          {done ? <CheckCircle2 className="w-4 h-4" /> : st.no}
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-sm font-semibold ${current ? "text-slate-900" : done ? "text-slate-700" : "text-slate-500"}`}>{st.title}</span>
                          <span className="block text-xs text-slate-500">
                            {st.pdca}
                            {dates?.completed ? ` · ${fmtDate(dates.completed)} onaylandı` : dates?.planned ? ` · plan ${fmtDate(dates.planned)}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {/* Step content */}
            <div className="lg:col-span-8 xl:col-span-9 space-y-4">
              <Card>
                <SectionTitle
                  icon={stepIcon(selected)}
                  title={`${selected}. ${CI_STEPS[selected - 1].title}`}
                  hint={CI_STEPS[selected - 1].hint}
                  right={<Pill tone={selected < stage || closed ? "emerald" : selected === stage ? "amber" : "slate"}>
                    {selected < stage || closed ? "Tamamlandı" : selected === stage ? "Aktif adım" : "Sırada"}
                  </Pill>}
                />
                <fieldset disabled={!canEdit} className="space-y-5 disabled:opacity-90">
                  <StepFields step={selected} draft={draft} set={set} kpi={kpi} setKpi={setKpi} props={props} canEdit={canEdit} staff={staff} busy={busy} act={act} project={project} />
                </fieldset>
              </Card>

              {/* Requirements + approval for the current step */}
              {selected === stage && !closed && !project.holdState && (
                <Card>
                  <SectionTitle icon={ShieldCheck} title={`Adım ${stage}'i tamamla`} hint="Şartlar sağlanınca adım proje liderinin onayıyla kapanır ve sonraki adım açılır." />
                  {missing.length === 0 ? (
                    <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Tüm şartlar sağlandı{dirty ? " (kaydedilmemiş değişikliklerle)" : ""}.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {missing.map(m => <li key={m} className="text-sm text-slate-700 flex items-center gap-2"><Circle className="w-3.5 h-3.5 text-amber-500" /> {m}</li>)}
                    </ul>
                  )}
                  {pending && (
                    <p className="mt-3 text-sm text-violet-700 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> {pending.by} {fmtDate(pending.at)} tarihinde onaya gönderdi.
                    </p>
                  )}
                  {(canEdit || canApprove) && (
                    <div className="mt-4 space-y-3">
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Not (isteğe bağlı) — geçmişe yazılır" className={areaCls} />
                      <div className="flex flex-wrap gap-2">
                        {canApprove ? (
                          <Button variant="brand" onClick={() => act(pending ? "approve" : "submit")} disabled={busy || missing.length > 0}>
                            <CheckCircle2 className="w-4 h-4" /> {stage === CI_LAST_STAGE ? "Onayla ve projeyi kapat" : `Onayla → Adım ${stage + 1}`}
                          </Button>
                        ) : (
                          <Button variant="brand" onClick={() => act("submit")} disabled={busy || missing.length > 0 || !!pending}>
                            <Send className="w-4 h-4" /> {pending ? "Onay bekleniyor" : "Proje liderinin onayına gönder"}
                          </Button>
                        )}
                        {canApprove && pending && <Button variant="outline" onClick={() => act("return")} disabled={busy}><Undo2 className="w-4 h-4" /> Geri gönder</Button>}
                        {(canApprove || staff) && stage > 1 && <Button variant="outline" onClick={() => act("stepBack")} disabled={busy}><ChevronLeft className="w-4 h-4" /> Önceki adıma dön</Button>}
                        {canManageHold(currentUser, project) && (
                          <>
                            <Button variant="ghost" onClick={() => act("hold")} disabled={busy}><PauseCircle className="w-4 h-4" /> Askıya al</Button>
                            <Button variant="ghost" onClick={() => window.confirm("Proje iptal edilsin mi?") && act("cancel")} disabled={busy}><XCircle className="w-4 h-4" /> İptal et</Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {closed && (project.followUps || []).length > 0 && (
                <FollowUpsCard project={project} kpi={kpi} canRecord={staff || canApprove} onRecord={async (input) => {
                  const r = await props.onFollowUp(input);
                  setMessage(r.ok ? { ok: true, text: "Kontrol kaydedildi." } : { ok: false, text: r.error || "Kaydedilemedi." });
                  return r.ok;
                }} />
              )}

              {closed && (
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Proje {fmtDate(project.closedAt)} tarihinde kapatıldı.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="brand" onClick={() => setShowA3(true)}><Presentation className="w-4 h-4" /> A3 sunum kartı</Button>
                      {(canApprove || staff) && <Button variant="outline" onClick={() => act("reopen")} disabled={busy}><RotateCcw className="w-4 h-4" /> Yeniden aç</Button>}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {view === "team" && (
          <TeamView draft={draft} set={set} people={people} canEdit={canEdit && (staff || canApproveStage(currentUser, project))} canEditDates={canEdit} project={project} />
        )}
        {view === "files" && <FilesView draft={draft} set={set} canEdit={canEdit} />}
        {view === "history" && <HistoryView project={project} />}
      </div>

      {showRemind && (
        <RemindDialog project={project} onClose={() => setShowRemind(false)} onSend={async (to, note) => {
          const r = await props.onRemind(to, note);
          setMessage(r.ok ? { ok: true, text: `Hatırlatma e-postası gönderildi (${r.sent ?? 0} kişi).` } : { ok: false, text: r.error || "Gönderilemedi." });
          if (r.ok) setShowRemind(false);
        }} />
      )}

      {showA3 && (
        <CiA3Dialog
          project={{ ...project, ...draft } as KaizenCard}
          projectNo={props.projectNo}
          companyName={props.companyName}
          currencySymbol={props.currencySymbol}
          onClose={() => setShowA3(false)}
        />
      )}
    </div>
  );
}

function stepIcon(step: number) {
  return [AlertTriangle, BarChart3, Target, ListChecks, ListChecks, PlayCircle, CheckCircle2, ShieldCheck][step - 1];
}

export function StageBadge({ project }: { project: KaizenCard }) {
  const s = stageOf(project);
  if (project.holdState === "cancelled") return <Pill tone="red">İptal</Pill>;
  if (project.holdState === "onHold") return <Pill tone="amber">Askıda</Pill>;
  if (isClosed(project)) return <Pill tone="emerald"><CheckCircle2 className="w-3 h-3" /> Kapandı</Pill>;
  return <Pill tone="blue">Adım {s}/{CI_LAST_STAGE} · {CI_STEPS[s - 1].short}</Pill>;
}

// ---------- step fields ----------

function StepFields({ step, draft, set, kpi, setKpi, props, canEdit, staff, busy, act, project }: {
  step: number; draft: Draft; set: <K extends keyof KaizenCard>(k: K, v: KaizenCard[K]) => void;
  kpi: CiKpi; setKpi: (p: Partial<CiKpi>) => void; props: CiProjectCardProps; canEdit: boolean; staff: boolean;
  busy: boolean; act: (a: CiStageAction) => void; project: KaizenCard;
}) {
  const cur = props.currencySymbol;
  switch (step) {
    case 1:
      return (
        <>
          <FormField label="Proje adı" required>
            <input className={inputCls} value={draft.title || ""} onChange={(e) => set("title", e.target.value)} />
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Departman">
              <input className={inputCls} list="ci-card-departments" value={draft.department || ""} onChange={(e) => set("department", e.target.value)} />
              <datalist id="ci-card-departments">{props.departments.map(d => <option key={d} value={d} />)}</datalist>
            </FormField>
            <FormField label="Proje fazı">
              <select className={inputCls} value={draft.phase || props.phases[0]} onChange={(e) => set("phase", e.target.value)}>
                {choicesWith(props.phases, draft.phase).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Problem tanımı" required hint="Ne, nerede, ne zaman, ne kadar? Yorum değil, gözlenen durum.">
            <textarea className={areaCls} rows={4} value={draft.problemDefinition || ""} onChange={(e) => set("problemDefinition", e.target.value)} />
          </FormField>
          <FormField label="Kayıp boyutu (yıllık)" hint="Problemin bugünkü maliyeti. Parasal değilse 3. adımda KPI başlangıç değerini girin.">
            <AmountInput value={draft.currentLoss ?? null} onChange={(v) => set("currentLoss", v ?? 0)} suffix={cur} />
          </FormField>
          {project.impactAnalysis && Object.keys(project.impactAnalysis).length > 0 && (
            <FormField label="Etki alanları">
              <div className="flex flex-wrap gap-2">
                {Object.entries(project.impactAnalysis).map(([k, v]) => <Pill key={k} tone={v === "Yüksek" ? "red" : v === "Orta" ? "amber" : "slate"}>{k}: {v}</Pill>)}
              </div>
            </FormField>
          )}
          <PhotoField label="Problem fotoğrafları" photos={draft.problemPhotos || []} onChange={(p) => set("problemPhotos", p)} canEdit={canEdit} />
        </>
      );
    case 2:
      return (
        <>
          {project.opportunityType && (
            <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 text-sm text-slate-700">
              <span className="font-semibold">Kaynak fırsat:</span> {project.opportunityType}
              {project.currentLoss ? ` · kayıp ${cur}${formatAmount(project.currentLoss)}` : ""}
            </div>
          )}
          <FormField label="Mevcut durum ve problemin parçalanması" required hint="Veri, gemba gözlemi, Pareto; hangi alt problem öncelikli ve neden?">
            <textarea className={areaCls} rows={8} value={draft.problemDetail || ""} onChange={(e) => set("problemDetail", e.target.value)} />
          </FormField>
        </>
      );
    case 3:
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Hedef KPI" required>
              <input className={inputCls} value={kpi.name} placeholder="ör. Hurda oranı" onChange={(e) => setKpi({ name: e.target.value })} />
            </FormField>
            <FormField label="Birim">
              <input className={inputCls} value={kpi.unit} placeholder="ör. %, dk, adet/gün" onChange={(e) => setKpi({ unit: e.target.value })} />
            </FormField>
          </div>
          <FormField label="İyi yön">
            <div className="flex flex-wrap gap-2">
              <ChoiceChip on={kpi.direction === "decrease"} onClick={() => canEdit && setKpi({ direction: "decrease" })}>Düşmesi iyi</ChoiceChip>
              <ChoiceChip on={kpi.direction === "increase"} onClick={() => canEdit && setKpi({ direction: "increase" })}>Artması iyi</ChoiceChip>
            </div>
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Başlangıç değeri" required>
              <AmountInput value={kpi.baseline} onChange={(v) => setKpi({ baseline: v })} suffix={kpi.unit} placeholder="" />
            </FormField>
            <FormField label="Hedef değer" required>
              <AmountInput value={kpi.target} onChange={(v) => setKpi({ target: v })} suffix={kpi.unit} placeholder="" />
            </FormField>
            <FormField label="Hedef tarih" required>
              <input type="date" className={inputCls} value={draft.plannedFinishDate || ""} onChange={(e) => set("plannedFinishDate", e.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Beklenen yıllık kazanç">
              <MoneyWithCurrency amount={draft.expectedGain} currency={draft.expectedGainCurrency || props.currencyOptions[0]?.value}
                onAmount={(v) => set("expectedGain", v ?? 0)} onCurrency={(c) => set("expectedGainCurrency", c)} choices={props.currencyChoices} disabled={!canEdit} />
            </FormField>
            <FormField label="Hedef açıklaması">
              <input className={inputCls} value={draft.targetObjective || ""} onChange={(e) => set("targetObjective", e.target.value)} />
            </FormField>
          </div>
        </>
      );
    case 4:
      return <RootCauseStep draft={draft} set={set} canEdit={canEdit} categories={props.fishboneCategories} />;
    case 5:
    case 6:
      return <TasksEditor step={step} draft={draft} set={set} people={props.people} canEdit={canEdit} props={props} project={project} />;
    case 7: {
      const last = latestMeasurement(kpi);
      const pct = kpiProgressPct(kpi);
      const gain = draft.realizedGain ?? 0;
      return (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Başlangıç" value={kpi.baseline === null ? "—" : `${formatAmount(kpi.baseline)} ${kpi.unit}`} />
            <Stat label="Hedef" value={kpi.target === null ? "—" : `${formatAmount(kpi.target)} ${kpi.unit}`} />
            <Stat label="Son ölçüm" value={last ? `${formatAmount(last.value)} ${kpi.unit}` : "—"} hint={pct === null ? undefined : `Hedeflenen iyileşmenin %${pct}'i`} />
          </div>
          <MeasurementsEditor kpi={kpi} setKpi={setKpi} canEdit={canEdit} />
          <FormField label="Hedefe ulaşıldı mı?" required>
            <div className="flex flex-wrap gap-2">
              <ChoiceChip on={draft.kpiTargetMet === true} onClick={() => canEdit && set("kpiTargetMet", true)}>Evet</ChoiceChip>
              <ChoiceChip on={draft.kpiTargetMet === false} onClick={() => canEdit && set("kpiTargetMet", false)}>Hayır</ChoiceChip>
            </div>
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Gerçekleşen yıllık kazanç" hint="Sistem raporlar → danışman teyit eder → proje lideri 7. adımı onaylar.">
              <MoneyWithCurrency amount={draft.realizedGain} currency={draft.realizedGainCurrency || props.currencyOptions[0]?.value}
                onAmount={(v) => set("realizedGain", v ?? 0)} onCurrency={(c) => set("realizedGainCurrency", c)} choices={props.currencyChoices} disabled={!canEdit} />
            </FormField>
            <FormField label="Gerçekleşen iyileşme (%)">
              <AmountInput value={draft.realizedImprovementPct ?? null} onChange={(v) => set("realizedImprovementPct", v ?? 0)} suffix="%" />
            </FormField>
          </div>
          <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              {project.gainConfirmedAt
                ? <span className="text-emerald-700 font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Kazanç {project.gainConfirmedBy} tarafından {fmtDate(project.gainConfirmedAt)} tarihinde teyit edildi.</span>
                : <span className="text-slate-600">{gain > 0 ? "Gerçekleşen kazanç henüz danışman tarafından teyit edilmedi." : "Gerçekleşen kazanç girilmedi."}</span>}
            </div>
            <div className="flex gap-2">
              {staff && !project.gainConfirmedAt && (project.realizedGain ?? project.actualSavings ?? 0) > 0 && (
                <Button variant="outline" type="button" onClick={() => act("confirmGain")} disabled={busy}><ShieldCheck className="w-4 h-4" /> Kazancı teyit et</Button>
              )}
              <Button variant="ghost" type="button" onClick={props.onOpenFinancials}><BarChart3 className="w-4 h-4" /> Kazanç kırılımı</Button>
            </div>
          </div>
          <PhotoField label="Sonuç fotoğrafları" photos={draft.resultPhotos || []} onChange={(p) => set("resultPhotos", p)} canEdit={canEdit} />
        </>
      );
    }
    case 8:
      return (
        <>
          <FormField label="Standartlaştırma" required hint="En az biri: standart iş, talimat ya da kontrol planı.">
            <div className="flex flex-wrap gap-2">
              {STANDARDIZATION_ITEMS.map(it => (
                <ChoiceChip key={String(it.key)} on={!!draft[it.key]} onClick={() => canEdit && set(it.key, !draft[it.key] as any)}>{it.label}</ChoiceChip>
              ))}
            </div>
          </FormField>
          <FormField label="Yaygınlaştırma" hint="Aynı iyileştirmenin uygulanacağı diğer hat / alan / ürünler.">
            <textarea className={areaCls} rows={3} value={draft.horizontalDeployment || ""} onChange={(e) => set("horizontalDeployment", e.target.value)} />
          </FormField>
          <FormField label="Öğrenilen dersler">
            <textarea className={areaCls} rows={3} value={draft.lessonsLearned || ""} onChange={(e) => set("lessonsLearned", e.target.value)} />
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Proje sonucu" required>
              <select className={inputCls} value={draft.projectResult || ""} onChange={(e) => set("projectResult", (e.target.value || undefined) as any)}>
                <option value="">Seçin</option>
                {RESULT_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Sonuç açıklaması" required>
                <textarea className={areaCls} rows={3} value={draft.resultDescription || ""} onChange={(e) => set("resultDescription", e.target.value)} />
              </FormField>
            </div>
          </div>
          {(draft.projectResult === "İptal" || draft.projectResult === "Askıya Alındı") && (
            <p className="text-sm text-amber-700">Projeyi durdurmak için alttaki "Askıya al" / "İptal et" işlemlerini kullanın; bu sonuçla adım kapatılamaz.</p>
          )}
        </>
      );
  }
  return null;
}

// Toggle chip that keeps working inside a disabled <fieldset> (same look as ChoiceChip).
function ViewChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <span role="tab" tabIndex={0} aria-selected={on} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
        on ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/20" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:ring-slate-300 hover:bg-slate-50"
      }`}>
      {children}
    </span>
  );
}

// A3 step 4: 5-Why chain and / or fishbone (6M). Both are kept; the toggle only picks the view.
function RootCauseStep({ draft, set, canEdit, categories }: {
  draft: Draft; set: <K extends keyof KaizenCard>(k: K, v: KaizenCard[K]) => void; canEdit: boolean; categories: string[];
}) {
  const whys = draft.rootCauseWhys || ["", "", "", "", ""];
  const fishbone = draft.fishbone || [];
  const [method, setMethod] = useState<"why" | "fishbone">(() => fishbone.length && !whys.some(w => w.trim()) ? "fishbone" : "why");
  const marked = fishboneRootCauses({ fishbone });
  const suggested = rootCauseOf({ rootCauseWhys: whys, fishbone });
  const deepen = (text: string) => {
    if (whys[0].trim() && whys[0].trim() !== text.trim() && !window.confirm(`5 Neden zincirinin ilk nedeni "${whys[0]}" — "${text}" ile değiştirilsin mi?`)) return;
    set("rootCauseWhys", [text, ...whys.slice(1)]);
    setMethod("why");
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* View switch, not an edit: plain elements so the read-only fieldset (closed project) doesn't disable it. */}
        <ViewChip on={method === "why"} onClick={() => setMethod("why")}>5 Neden{whys.some(w => w.trim()) ? ` · ${whys.filter(w => w.trim()).length}` : ""}</ViewChip>
        <ViewChip on={method === "fishbone"} onClick={() => setMethod("fishbone")}>Balık Kılçığı (6M){fishbone.length ? ` · ${fishbone.length}` : ""}</ViewChip>
        <span className="text-xs text-slate-500">İkisi birlikte kullanılabilir; ikisinin verisi de saklanır.</span>
      </div>
      {method === "why" ? (
        <>
          <p className="text-sm text-slate-600">Problemden başlayıp her cevaba yeniden "neden?" diye sorun; son cevap genellikle kök nedendir.</p>
          <ol className="space-y-3">
            {whys.map((w, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-3 w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <input className={inputCls} value={w} placeholder={i === 0 ? "Problem neden oluşuyor?" : `Neden ${i}'in nedeni?`}
                  onChange={(e) => set("rootCauseWhys", whys.map((x, j) => j === i ? e.target.value : x))} />
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">Olası nedenleri kategorilere yazın; kök neden olduğunu düşündüklerinizi <Star className="w-3.5 h-3.5 inline -mt-0.5 text-amber-500" fill="currentColor" /> ile işaretleyin, gerekirse <ArrowRightLeft className="w-3.5 h-3.5 inline -mt-0.5" /> ile 5 Neden'e taşıyıp derinleştirin.</p>
          <CiFishbone causes={fishbone} categories={categories} problem={draft.problemDefinition || ""} canEdit={canEdit}
            onChange={(c) => set("fishbone", c)} onDeepen={deepen} />
        </>
      )}
      {marked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Balık kılçığında işaretlenen kök nedenler:</span>
          {marked.map(c => <Pill key={c.id} tone="amber"><Star className="w-3 h-3" fill="currentColor" /> {c.text} · {c.category}</Pill>)}
        </div>
      )}
      <FormField label="Seçilen kök neden" required
        hint={suggested && !(draft.rootCause || "").trim() ? `Boş bırakılırsa kullanılır: "${suggested}"` : "5 Neden'in son cevabı ya da balık kılçığında işaretlenen nedenler önerilir."}>
        <textarea className={areaCls} rows={2} value={draft.rootCause || ""} onChange={(e) => set("rootCause", e.target.value)} />
      </FormField>
    </>
  );
}

// Sustainability checks after closing: due date, result (KPI value, held / not held, note).
function FollowUpsCard({ project, kpi, canRecord, onRecord }: {
  project: KaizenCard; kpi: CiKpi; canRecord: boolean;
  onRecord: (input: { index: number; value: number | null; sustained: boolean; note: string }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [sustained, setSustained] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const today = todayIso();
  const list = project.followUps || [];
  return (
    <Card>
      <SectionTitle icon={Repeat} title="Sürdürülebilirlik takibi" hint={`Kapanıştan sonra KPI tekrar ölçülür${kpi.target !== null ? ` (hedef ${formatAmount(kpi.target)} ${kpi.unit})` : ""}; sürmeyen iyileştirme Genel Bakış'ta uyarı olarak kalır.`} />
      <ul className="space-y-2">
        {list.map((f, i) => {
          const due = !f.checkedAt && f.dueDate <= today;
          return (
            <li key={i} className={`rounded-xl ring-1 p-3 ${f.checkedAt ? (f.sustained ? "ring-emerald-200 bg-emerald-50/40" : "ring-red-200 bg-red-50/40") : due ? "ring-amber-200 bg-amber-50/40" : "ring-slate-200 bg-white"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold text-slate-900">{f.days}. gün</span>
                <span className="text-sm text-slate-600 tabular-nums">{fmtDate(f.dueDate)}</span>
                {f.checkedAt
                  ? <Pill tone={f.sustained ? "emerald" : "red"}>{f.sustained ? "İyileştirme sürüyor" : "İyileştirme sürmüyor"}{typeof f.value === "number" ? ` · ${formatAmount(f.value)} ${kpi.unit}` : ""}</Pill>
                  : <Pill tone={due ? "amber" : "slate"}>{due ? "Zamanı geldi" : "Bekliyor"}</Pill>}
                {f.checkedAt && <span className="text-xs text-slate-500">{f.checkedBy} · {fmtDate(f.checkedAt)}</span>}
                {!f.checkedAt && canRecord && open !== i && (
                  <Button variant="outline" className="ml-auto" onClick={() => { setOpen(i); setValue(null); setSustained(null); setNote(""); }}>Sonucu kaydet</Button>
                )}
              </div>
              {f.note && <p className="text-sm text-slate-600 mt-1">{f.note}</p>}
              {open === i && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[180px_auto_1fr_auto] gap-2 items-center">
                  <AmountInput value={value} onChange={setValue} suffix={kpi.unit} placeholder="KPI değeri" />
                  <div className="flex gap-2">
                    <ChoiceChip on={sustained === true} onClick={() => setSustained(true)}>Sürüyor</ChoiceChip>
                    <ChoiceChip on={sustained === false} onClick={() => setSustained(false)}>Sürmüyor</ChoiceChip>
                  </div>
                  <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not (isteğe bağlı)" />
                  <Button variant="brand" disabled={sustained === null} onClick={async () => { if (await onRecord({ index: i, value, sustained: sustained!, note })) setOpen(null); }}>Kaydet</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function RemindDialog({ project, onClose, onSend }: { project: KaizenCard; onClose: () => void; onSend: (to: "leader" | "team", note: string) => Promise<void> }) {
  const [to, setTo] = useState<"leader" | "team">("leader");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-label="Hatırlatma gönder">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Hatırlatma e-postası</h3>
            <p className="text-sm text-slate-500">{project.title} — projenin durumu (adım, onay, geciken aksiyonlar) e-postaya eklenir.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Kapat"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          <ChoiceChip on={to === "leader"} onClick={() => setTo("leader")}>Proje lideri ({(project.projectLeader || "—").replace(/\s*\([^)]*\)\s*$/, "")})</ChoiceChip>
          <ChoiceChip on={to === "team"} onClick={() => setTo("team")}>Tüm ekip ve aksiyon sorumluları</ChoiceChip>
        </div>
        <textarea className={areaCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mesaj (isteğe bağlı)" />
        <p className="text-xs text-slate-500">Yalnızca kullanıcı hesabı olan kişilere gider.{project.lastEmailSentAt ? ` Son hatırlatma: ${new Date(project.lastEmailSentAt).toLocaleString("tr-TR")}.` : ""}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          <Button variant="brand" disabled={busy} onClick={async () => { setBusy(true); await onSend(to, note); setBusy(false); }}><BellRing className="w-4 h-4" /> {busy ? "Gönderiliyor…" : "Gönder"}</Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-black text-slate-900 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function MoneyWithCurrency({ amount, currency, onAmount, onCurrency, choices, disabled }: {
  amount: number | undefined | null; currency: string; onAmount: (v: number | null) => void; onCurrency: (c: string) => void;
  choices: (current: string) => { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <AmountInput
      value={amount ?? null}
      onChange={onAmount}
      disabled={disabled}
      suffix={
        <select value={currency} disabled={disabled} onChange={(e) => onCurrency(e.target.value)}
          className="bg-transparent text-sm font-semibold text-slate-600 focus:outline-none cursor-pointer">
          {choices(currency).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      }
    />
  );
}

function MeasurementsEditor({ kpi, setKpi, canEdit }: { kpi: CiKpi; setKpi: (p: Partial<CiKpi>) => void; canEdit: boolean }) {
  const [date, setDate] = useState(todayIso());
  const [value, setValue] = useState<number | null>(null);
  const [mNote, setMNote] = useState("");
  const sorted = [...kpi.measurements].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return (
    <FormField label={`KPI ölçümleri${kpi.name ? ` — ${kpi.name}` : ""}`} required>
      <div className="space-y-2">
        {sorted.length === 0 && <p className="text-sm text-slate-500">Henüz ölçüm yok.</p>}
        {sorted.map(m => (
          <div key={m.id} className="flex items-center gap-3 text-sm rounded-xl bg-white ring-1 ring-slate-200 px-4 py-2.5">
            <span className="w-24 text-slate-500 tabular-nums">{fmtDate(m.date)}</span>
            <span className="font-bold text-slate-900 tabular-nums">{formatAmount(m.value)} {kpi.unit}</span>
            <span className="flex-1 text-slate-500 truncate">{m.note}</span>
            {canEdit && (
              <button type="button" onClick={() => setKpi({ measurements: kpi.measurements.filter(x => x.id !== m.id) })}
                className="p-2 text-slate-400 hover:text-red-600 cursor-pointer" aria-label="Ölçümü sil"><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        ))}
        {canEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[160px_160px_minmax(0,1fr)_auto] gap-2">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            <AmountInput value={value} onChange={setValue} suffix={kpi.unit} placeholder="Değer" />
            <input className={inputCls} value={mNote} placeholder="Not (isteğe bağlı)" onChange={(e) => setMNote(e.target.value)} />
            <Button type="button" variant="outline" className="h-12" disabled={value === null || !date}
              onClick={() => { setKpi({ measurements: [...kpi.measurements, { id: newId("m"), date, value: value!, note: mNote.trim() || undefined }] }); setValue(null); setMNote(""); }}>
              <Plus className="w-4 h-4" /> Ekle
            </Button>
          </div>
        )}
      </div>
    </FormField>
  );
}

function TasksEditor({ step, draft, set, people, canEdit, props, project }: {
  step: number; draft: Draft; set: <K extends keyof KaizenCard>(k: K, v: KaizenCard[K]) => void; people: CiPerson[];
  canEdit: boolean; props: CiProjectCardProps; project: KaizenCard;
}) {
  const tasks: any[] = draft.tasks || [];
  const update = (id: string, patch: any) => set("tasks", tasks.map(t => t.id === id ? { ...t, ...patch } : t));
  const today = todayIso();
  const active = tasks.filter(t => taskStatusOf(t) !== "İptal");
  const overall = active.length ? Math.round(active.reduce((s2, t) => s2 + taskProgress(t), 0) / active.length) : 0;
  const studies = project.beforeAfterStudies || [];
  const legacyText = [project.improvementActions, project.responsibles, project.actionsTaken].filter(t => (t || "").trim());
  const setStatus = (t: any, status: string) =>
    update(t.id, { status, progressPercent: status === "Yapıldı" ? 100 : status === "Açık" ? 0 : Math.min(Math.max(t.progressPercent || 0, 25), 75) });
  const setProgress = (t: any, pct: number) => {
    const status = taskStatusOf(t) === "İptal" ? "İptal" : pct >= 100 ? "Yapıldı" : pct > 0 ? "Devam Ediyor" : "Açık";
    update(t.id, { progressPercent: pct, status });
  };
  const toggleStudy = (t: any, studyId: string) => {
    const ids: string[] = t.beforeAfterIds || [];
    update(t.id, { beforeAfterIds: ids.includes(studyId) ? ids.filter(x => x !== studyId) : [...ids, studyId] });
  };

  return (
    <>
      {tasks.length > 0 && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-semibold text-slate-700">Uygulama planı ilerlemesi</span>
              <span className="tabular-nums text-slate-600">%{overall} · {tasks.filter(t => taskStatusOf(t) === "Yapıldı").length}/{tasks.length} aksiyon</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${overall}%` }} /></div>
          </div>
          <CiTaskGantt tasks={tasks} projectStart={project.dateProposed} targetDate={draft.plannedFinishDate} />
        </div>
      )}
      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="Henüz aksiyon yok" text={step === 5 ? "Kök nedeni gideren karşı önlemleri ekleyin; her birine sorumlu, başlangıç ve termin verin." : "Aksiyonlar 5. adımda planlanır."} />
      ) : (
        <div className="space-y-2">
          {tasks.map((t, idx) => {
            const status = taskStatusOf(t);
            const overdue = t.deadline && t.deadline < today && !["Yapıldı", "İptal"].includes(status);
            const badDates = t.startDate && t.deadline && t.startDate > t.deadline;
            const linked: string[] = t.beforeAfterIds || [];
            return (
              <div key={t.id} className={`rounded-xl ring-1 p-3 space-y-2 ${overdue ? "ring-red-200 bg-red-50/40" : "ring-slate-200 bg-white"}`}>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                  <input className={inputCls} value={t.name || ""} placeholder="Aksiyon" onChange={(e) => update(t.id, { name: e.target.value })} />
                  {canEdit && (
                    <button type="button" onClick={() => set("tasks", tasks.filter(x => x.id !== t.id))} className="p-2 text-slate-400 hover:text-red-600 cursor-pointer shrink-0" aria-label="Aksiyonu sil">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)] gap-2 items-end">
                  <label className="col-span-2 xl:col-span-1 text-xs font-semibold text-slate-500 space-y-1">
                    <span>Sorumlu</span>
                    <select className={inputCls} value={t.responsibleId || ""} onChange={(e) => {
                      const p = people.find(x => x.id === e.target.value);
                      update(t.id, { responsibleId: p?.id || undefined, responsible: p?.name || (e.target.value ? t.responsible : "") });
                    }}>
                      <option value="">{t.responsible && !t.responsibleId ? t.responsible : "Seçin"}</option>
                      {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500 space-y-1">
                    <span>Başlangıç</span>
                    <input type="date" className={inputCls} value={t.startDate || ""} onChange={(e) => update(t.id, { startDate: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-slate-500 space-y-1">
                    <span>Termin</span>
                    <input type="date" className={inputCls} value={t.deadline || ""} onChange={(e) => update(t.id, { deadline: e.target.value })} />
                  </label>
                  <label className="text-xs font-semibold text-slate-500 space-y-1">
                    <span>Durum</span>
                    <select className={inputCls} value={status} onChange={(e) => setStatus(t, e.target.value)}>
                      {TASK_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500 space-y-1">
                    <span>İlerleme</span>
                    <select className={inputCls} value={String(taskProgress(t))} disabled={status === "İptal"} onChange={(e) => setProgress(t, Number(e.target.value))}>
                      {[0, 25, 50, 75, 100].concat([taskProgress(t)]).filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y)
                        .map(v => <option key={v} value={v}>%{v}</option>)}
                    </select>
                  </label>
                </div>
                {(overdue || badDates) && (
                  <p className="text-xs font-semibold text-red-600">{badDates ? "Başlangıç terminden sonra." : "Termin geçti."}</p>
                )}
                {step === 6 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs font-semibold text-slate-500">Önce-sonra:</span>
                    {studies.map(st => (
                      <button key={st.id} type="button" disabled={!canEdit} onClick={() => toggleStudy(t, st.id)} aria-pressed={linked.includes(st.id)}
                        className={`h-8 px-3 rounded-full text-xs font-semibold ring-1 ring-inset cursor-pointer ${linked.includes(st.id) ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-600 ring-slate-200 hover:ring-slate-300"}`}>
                        {st.subject}
                      </button>
                    ))}
                    {canEdit && (
                      <button type="button" onClick={() => props.onCreateBeforeAfter(t.id)}
                        className="h-8 px-3 rounded-full text-xs font-semibold border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Bu aksiyon için önce-sonra
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {canEdit && (
        <Button type="button" variant="outline" onClick={() => set("tasks", [...tasks, { id: newId("tsk"), name: "", responsible: "", startDate: todayIso(), deadline: "", priority: "Medium", progressPercent: 0, status: "Açık" }])}>
          <Plus className="w-4 h-4" /> Aksiyon ekle
        </Button>
      )}
      {step === 5 && legacyText.length > 0 && (
        <div className="rounded-xl bg-amber-50/60 ring-1 ring-amber-200 p-4 text-sm text-slate-700 space-y-1">
          <p className="font-semibold text-amber-800">Eski serbest metin kayıtları (salt okunur)</p>
          {legacyText.map((t, i) => <p key={i} className="whitespace-pre-wrap">{t}</p>)}
        </div>
      )}
      {step === 6 && (
        <>
          <FormField label="Yatırım bütçesi">
            <AmountInput value={draft.estimatedCost ?? null} onChange={(v) => set("estimatedCost", v ?? 0)} suffix={props.currencySymbol} />
          </FormField>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">Önce-sonra kayıtları</span>
              {canEdit && <Button type="button" variant="outline" onClick={() => props.onCreateBeforeAfter()}><Plus className="w-4 h-4" /> Önce-sonra formu</Button>}
            </div>
            {studies.length === 0 && <p className="text-sm text-slate-500">Henüz önce-sonra kaydı yok. Bir aksiyonun altındaki düğmeyle o aksiyona bağlı kayıt açabilirsiniz.</p>}
            {studies.map(st => {
              const byTasks = tasks.filter(t => (t.beforeAfterIds || []).includes(st.id)).map(t => t.name || "Adsız aksiyon");
              return (
                <div key={st.id} className="flex items-center gap-3 rounded-xl ring-1 ring-slate-200 bg-white px-4 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{st.subject}</p>
                    <p className="text-xs text-slate-500 truncate">{byTasks.length ? `Aksiyon: ${byTasks.join(", ")}` : "Aksiyona bağlı değil"}</p>
                  </div>
                  <span className="text-slate-500 shrink-0">{fmtDate(st.date)}</span>
                  {props.kaizenActive && props.onShareToKaizen && (
                    st.sharedToKaizenAt ? (
                      <button type="button" disabled={!canEdit} onClick={() => window.confirm("Bu kayıt Kaizen sergisinden kaldırılsın mı?") && props.onShareToKaizen!(st, false).then(r => { if (!r.ok) alert(r.error); })} title="Kaizen Önce-Sonra sergisinden kaldır"
                        className="shrink-0"><Pill tone="amber"><Star className="w-3 h-3" fill="currentColor" /> Kaizen sergisinde</Pill></button>
                    ) : canEdit && (
                      <button type="button" onClick={() => props.onShareToKaizen!(st, true).then(r => { if (!r.ok) alert(r.error); })} title="Kaizen öneri sisteminin Önce-Sonra sergisine gönder"
                        className="shrink-0 h-8 px-3 rounded-full text-xs font-semibold ring-1 ring-inset ring-amber-300 text-amber-800 hover:bg-amber-50 cursor-pointer">Kaizen sergisine gönder</button>
                    )
                  )}
                  <button type="button" onClick={() => props.onExportBeforeAfter(st)} className="p-2 text-slate-500 hover:text-emerald-700 cursor-pointer" aria-label="Excel indir"><Download className="w-4 h-4" /></button>
                  {canEdit && <button type="button" onClick={() => props.onDeleteBeforeAfter(st.id)} className="p-2 text-slate-400 hover:text-red-600 cursor-pointer" aria-label="Sil"><Trash2 className="w-4 h-4" /></button>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function PhotoField({ label, photos, onChange, canEdit }: { label: string; photos: string[]; onChange: (p: string[]) => void; canEdit: boolean }) {
  const add = async (files: FileList | null) => {
    if (!files) return;
    const shrunk = await Promise.all(Array.from(files).map(f => readAndShrink(f).catch(() => "")));
    onChange([...photos, ...shrunk.filter(Boolean)]);
  };
  return (
    <FormField label={label}>
      <div className="flex flex-wrap gap-3">
        {photos.map((src, i) => (
          <div key={i} className="relative w-28 h-28 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-slate-100">
            <img src={src} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
            {canEdit && (
              <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-white/90 text-slate-600 hover:text-red-600 flex items-center justify-center cursor-pointer" aria-label="Fotoğrafı kaldır">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <label className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-1 text-xs font-semibold text-slate-500 cursor-pointer transition-colors">
            <Camera className="w-5 h-5" /> Fotoğraf ekle
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        {!canEdit && photos.length === 0 && <p className="text-sm text-slate-500">Fotoğraf yok.</p>}
      </div>
    </FormField>
  );
}

// ---------- side views ----------

function TeamView({ draft, set, people, canEdit, canEditDates, project }: {
  draft: Draft; set: <K extends keyof KaizenCard>(k: K, v: KaizenCard[K]) => void; people: CiPerson[];
  canEdit: boolean; canEditDates: boolean; project: KaizenCard;
}) {
  const teamIds = draft.projectTeamIds || [];
  const legacyTeam = (draft.projectTeam || []).filter(n => !people.some(p => p.name === n.replace(/\s*\([^)]*\)\s*$/, "")));
  const toggleMember = (p: CiPerson) => {
    const on = teamIds.includes(p.id);
    const ids = on ? teamIds.filter(x => x !== p.id) : [...teamIds, p.id];
    set("projectTeamIds", ids);
    set("projectTeam", people.filter(x => ids.includes(x.id)).map(x => x.name));
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <SectionTitle icon={Users} title="Proje ekibi" hint="Proje lideri adımları onaylar. Lider ve üyeleri yalnızca lider ya da danışman değiştirebilir." />
        <fieldset disabled={!canEdit} className="space-y-5">
          <FormField label="Proje lideri" required hint={draft.projectLeader && !draft.projectLeaderId ? `Kayıtlı ad: ${draft.projectLeader} (hesabı yok — adımları danışman onaylar)` : undefined}>
            <select className={inputCls} value={draft.projectLeaderId || ""} onChange={(e) => {
              const p = people.find(x => x.id === e.target.value);
              set("projectLeaderId", p?.id);
              set("projectLeader", p?.name || draft.projectLeader || "");
            }}>
              <option value="">{draft.projectLeader && !draft.projectLeaderId ? draft.projectLeader : "Lider seçin"}</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </FormField>
          <FormField label="Ekip üyeleri">
            <div className="flex flex-wrap gap-2">
              {people.filter(p => p.id !== draft.projectLeaderId).map(p => (
                <ChoiceChip key={p.id} on={teamIds.includes(p.id)} onClick={() => canEdit && toggleMember(p)}>{p.label}</ChoiceChip>
              ))}
              {people.length === 0 && <p className="text-sm text-slate-500">Müşteri kartında atanmış danışman ya da müşteri kullanıcısı yok.</p>}
            </div>
            {legacyTeam.length > 0 && <p className="text-xs text-slate-500 mt-2">Eski kayıtta hesabı olmayan üyeler: {legacyTeam.join(", ")}</p>}
          </FormField>
          <FormField label="Sponsor">
            <input className={inputCls} value={draft.projectSponsor || ""} onChange={(e) => set("projectSponsor", e.target.value)} />
          </FormField>
        </fieldset>
      </Card>
      <Card>
        <SectionTitle icon={Clock} title="Adım planı" hint="Her adımın planlanan bitiş tarihi; onay tarihi otomatik yazılır." />
        <fieldset disabled={!canEditDates} className="space-y-2">
          {CI_STEPS.map(st => {
            const d = draft.stageDates?.[st.no] || {};
            const late = d.planned && !d.completed && d.planned < todayIso() && stageOf(project) >= st.no && !isClosed(project);
            return (
              <div key={st.no} className="grid grid-cols-[1fr_170px] items-center gap-3">
                <div className="text-sm">
                  <span className="font-semibold text-slate-800">{st.no}. {st.title}</span>
                  {d.completed && <span className="block text-xs text-emerald-700">{fmtDate(d.completed)} onaylandı{d.approvedBy ? ` — ${d.approvedBy}` : ""}</span>}
                  {late && <span className="block text-xs text-red-600">Planlanan tarih geçti</span>}
                </div>
                <input type="date" className={inputCls} value={d.planned || ""}
                  onChange={(e) => set("stageDates", { ...(draft.stageDates || {}), [st.no]: { ...d, planned: e.target.value } })} />
              </div>
            );
          })}
        </fieldset>
        <p className="text-xs text-slate-500 mt-3">Açılış: {fmtDate(project.dateProposed)} · Hedef bitiş: {fmtDate(draft.plannedFinishDate) || "—"}</p>
      </Card>
    </div>
  );
}

function FilesView({ draft, set, canEdit }: { draft: Draft; set: <K extends keyof KaizenCard>(k: K, v: KaizenCard[K]) => void; canEdit: boolean }) {
  const docs: any[] = draft.documents || [];
  const add = (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter(f => {
      if (f.size <= MAX_DOCUMENT_MB * 1024 * 1024) return true;
      alert(`"${f.name}" ${MAX_DOCUMENT_MB} MB sınırını aşıyor ve eklenmedi. Büyük dosyalar için paylaşım bağlantısı kullanın.`);
      return false;
    });
    Promise.all(accepted.map(f => new Promise<any>(resolve => {
      const r = new FileReader();
      r.onloadend = () => resolve({
        id: newId("doc"), name: f.name, fileType: f.name.split(".").pop()?.toLowerCase() || "",
        size: (f.size / (1024 * 1024)).toFixed(2) + " MB", uploadDate: todayIso(), data: typeof r.result === "string" ? r.result : ""
      });
      r.readAsDataURL(f);
    }))).then(newDocs => set("documents", [...docs, ...newDocs]));
  };
  return (
    <Card>
      <SectionTitle icon={Paperclip} title="Ekler" hint={`Dosya başına en fazla ${MAX_DOCUMENT_MB} MB; dosyalar proje kaydının içinde saklanır. Eklemeden sonra Kaydet'e basın.`} />
      <div className="space-y-2">
        {docs.length === 0 && <EmptyState icon={Paperclip} title="Ek yok" />}
        {docs.map(d => (
          <div key={d.id} className="flex items-center gap-3 rounded-xl ring-1 ring-slate-200 bg-white px-4 py-2.5 text-sm">
            <span className="flex-1 font-semibold text-slate-800 truncate">{d.name}</span>
            <span className="text-slate-500">{d.size}</span>
            {d.data
              ? <a href={d.data} download={d.name} className="p-2 text-slate-500 hover:text-emerald-700" aria-label="İndir"><Download className="w-4 h-4" /></a>
              : <span className="text-xs text-slate-400">içerik yok</span>}
            {canEdit && <button type="button" onClick={() => set("documents", docs.filter(x => x.id !== d.id))} className="p-2 text-slate-400 hover:text-red-600 cursor-pointer" aria-label="Sil"><Trash2 className="w-4 h-4" /></button>}
          </div>
        ))}
        {canEdit && (
          <label className="flex items-center justify-center gap-2 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40 text-sm font-semibold text-slate-600 cursor-pointer transition-colors">
            <Plus className="w-4 h-4" /> Dosya ekle (PDF, Word, Excel, görsel)
            <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
    </Card>
  );
}

function HistoryView({ project }: { project: KaizenCard }) {
  const entries = [...(project.history || [])].reverse();
  return (
    <Card>
      <SectionTitle icon={History} title="Geçmiş" hint="Adım onayları, geri gönderimler ve kayıtlar — kim, ne zaman." />
      {entries.length === 0 ? <EmptyState icon={History} title="Kayıt yok" text="Geçmiş, bu sürümden sonraki işlemlerle dolmaya başlar." /> : (
        <ol className="relative border-l-2 border-slate-100 ml-3 space-y-4">
          {entries.map((h, i) => (
            <li key={i} className="pl-5 relative">
              <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white" />
              <p className="text-sm font-semibold text-slate-800">{h.action}</p>
              <p className="text-xs text-slate-500">{h.by} · {new Date(h.at).toLocaleString("tr-TR")}</p>
              {h.note && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{h.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
