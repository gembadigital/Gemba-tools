import React, { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Send, Camera, X, Check, User, FileText, Lightbulb, Coins, Eye, PencilLine,
  ShieldAlert, Leaf, Smile, Tag, Gauge, BadgeCheck, Zap, Sparkles, Wrench, PiggyBank, CircleCheckBig, ListChecks, Plus, LogOut, Save, WifiOff, Aperture
} from "lucide-react";
import { KaizenPersonnel, KaizenSuggestion, KaizenSuggestionPhoto } from "./kaizenTypes";
import { KaizenSettings, currencyChoices, optionChoices, requiredStagesFor } from "../../utils/kaizenSettings";
import { isPerPiece, perPieceSaving, parsePerPiece } from "../../utils/kaizenSaving";
import { computeRoi, recurrenceOf, paybackText } from "../../utils/kaizenRoi";
import KaizenSimilar from "./KaizenSimilar";
import { KaizenApi } from "./KaizenSuggestionSystem";
import { readAndShrink } from "./kaizenImage";
import { Card, Button, FormField, ChoiceChip, inputCls, areaCls, errCls } from "./kaizenUi";

interface Props {
  currentUser: any;
  personnel: KaizenPersonnel[];
  editingSuggestion: KaizenSuggestion | null;
  teamIds: Set<string>; // people I may submit for (my team at any depth)
  api: KaizenApi;
  showToast: (msg: string) => void;
  // stay=true: the user chose "Yeni öneri ver" on the success screen (stay in the wizard).
  onSaved: (s: KaizenSuggestion, stay?: boolean) => void;
  settings: KaizenSettings;
  kiosk?: boolean;          // shared tablet: after submitting, sign out automatically
  onKioskExit?: () => void;
}

interface FormState {
  onBehalfOfId: string;
  suggestionTypes: string[];
  subject: string;
  currentState: string;
  photosCurrent: KaizenSuggestionPhoto[];
  improvementSuggestion: string;
  photosPropose: KaizenSuggestionPhoto[];
  stage: string;
  paybackPeriod: string;
  estimatedSaving: string;
  estimatedSavingCurrency: string;
  // Parça başı: saving per piece × annual volume (× years for the lifetime total)
  unitSaving: string;
  annualVolume: string;
  productionYears: string;
  estimatedCost: string;
  estimatedCostCurrency: string;
  isg: boolean;
  cevre: boolean;
  motivasyon: boolean;
}

const blank: FormState = {
  onBehalfOfId: "", suggestionTypes: [], subject: "", currentState: "", photosCurrent: [],
  improvementSuggestion: "", photosPropose: [], stage: "", paybackPeriod: "",
  estimatedSaving: "", estimatedSavingCurrency: "", estimatedCost: "", estimatedCostCurrency: "",
  unitSaving: "", annualVolume: "", productionYears: "",
  isg: false, cevre: false, motivasyon: false
};

const STEPS = [
  { label: "Konu", icon: User, title: "Öneriniz ne hakkında?", hint: "Kimin adına olduğunu, sınıfını ve kısa bir başlık seçin." },
  { label: "Mevcut durum", icon: FileText, title: "Şu an ne oluyor?", hint: "Problemi gördüğünüz gibi anlatın; bir fotoğraf bin kelimeye bedel." },
  { label: "Öneri", icon: Lightbulb, title: "Nasıl iyileştirirdiniz?", hint: "Ne değişecek, nasıl uygulanacak, sonuç ne olacak?" },
  { label: "Kazanç", icon: Coins, title: "Kazanç ve etki", hint: "Tahmin yeterli; Kurul değerlendirmede netleştirir." },
  { label: "Gönder", icon: Eye, title: "Son kontrol", hint: "Her şey doğruysa gönderin." }
];

// Known Öneri Sınıfı values get an icon; customer-defined ones fall back to a tag.
const TYPE_ICONS: Record<string, any> = {
  "Maliyet Azaltma": PiggyBank, "Kalite": BadgeCheck, "ISG": ShieldAlert, "5S": Sparkles, "Verimlilik": Gauge, "Enerji": Zap
};

const PROMPTS: Record<number, string[]> = {
  2: ["Ne oluyor?", "Nerede?", "Ne sıklıkla?", "Kimi etkiliyor?"],
  3: ["Ne değişecek?", "Nasıl uygulanır?", "Ne gerekir?", "Beklenen sonuç?"]
};

function CharCount({ value, min = 30 }: { value: string; min?: number }) {
  const n = value.trim().length;
  return <span className={`text-xs tabular-nums ${n === 0 ? "text-slate-400" : n < min ? "text-amber-600" : "text-emerald-600"}`}>{n < min && n > 0 ? `${n} karakter — biraz daha ayrıntı iyi olur` : `${n} karakter`}</span>;
}

export default function KaizenNewSuggestion({ currentUser, personnel, editingSuggestion, teamIds, api, showToast, onSaved, settings, kiosk, onKioskExit }: Props) {
  // A new form starts in the customer's base currency.
  const blankForm: FormState = { ...blank, estimatedSavingCurrency: settings.baseCurrency, estimatedCostCurrency: settings.baseCurrency };
  const isEdit = !!editingSuggestion;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);
  const [submitted, setSubmitted] = useState<KaizenSuggestion | null>(null);
  // Taslak (Faz 6.3): a new suggestion is kept on this device while it is written, so a dropped
  // connection, a phone call or a closed tab does not lose it. Not on the shared kiosk tablet.
  const draftKey = !kiosk && currentUser ? `kaizen_draft_${currentUser.kaizenPersonnelId || currentUser.id || currentUser.email}` : "";
  const [draftInfo, setDraftInfo] = useState<{ restoredAt?: string; photosDropped?: boolean } | null>(null);

  useEffect(() => {
    setStep(1);
    setAttempted(false);
    setSubmitted(null);
    if (editingSuggestion) {
      setForm({
        onBehalfOfId: "",
        suggestionTypes: editingSuggestion.suggestionTypes,
        subject: editingSuggestion.subject,
        currentState: editingSuggestion.currentState,
        photosCurrent: editingSuggestion.photosCurrent || [],
        improvementSuggestion: editingSuggestion.improvementSuggestion,
        photosPropose: editingSuggestion.photosPropose || [],
        stage: editingSuggestion.stage,
        paybackPeriod: editingSuggestion.paybackPeriod,
        estimatedSaving: String(editingSuggestion.estimatedSaving || ""),
        unitSaving: editingSuggestion.unitSaving ? String(editingSuggestion.unitSaving) : "",
        annualVolume: editingSuggestion.annualVolume ? String(editingSuggestion.annualVolume) : "",
        productionYears: editingSuggestion.productionYears ? String(editingSuggestion.productionYears) : "",
        estimatedSavingCurrency: editingSuggestion.estimatedSavingCurrency || settings.baseCurrency,
        estimatedCost: String(editingSuggestion.estimatedCost || ""),
        estimatedCostCurrency: editingSuggestion.estimatedCostCurrency || settings.baseCurrency,
        isg: editingSuggestion.isg,
        cevre: editingSuggestion.cevre,
        motivasyon: editingSuggestion.motivasyon
      });
    } else {
      let restored = false;
      if (draftKey) {
        try {
          const d = JSON.parse(localStorage.getItem(draftKey) || "null");
          if (d?.form) {
            setForm({ ...blankForm, ...d.form });
            setStep(Math.min(Math.max(1, d.step || 1), STEPS.length));
            setDraftInfo({ restoredAt: d.savedAt, photosDropped: d.photosDropped });
            restored = true;
          }
        } catch { /* unreadable draft: start fresh */ }
      }
      if (!restored) { setForm(blankForm); setDraftInfo(null); }
    }
  }, [editingSuggestion]);

  // Save the draft shortly after each change (new suggestions only). Photos can exceed the browser's
  // storage quota; then the text is kept and the person is told to re-add the photos.
  useEffect(() => {
    if (!draftKey || isEdit || submitted) return;
    const hasContent = !!(form.subject.trim() || form.currentState.trim() || form.improvementSuggestion.trim());
    if (!hasContent) return;
    const t = setTimeout(() => {
      const savedAt = new Date().toISOString();
      try {
        localStorage.setItem(draftKey, JSON.stringify({ form, step, savedAt }));
      } catch {
        try { localStorage.setItem(draftKey, JSON.stringify({ form: { ...form, photosCurrent: [], photosPropose: [] }, step, savedAt, photosDropped: true })); } catch { /* storage unavailable */ }
      }
    }, 800);
    return () => clearTimeout(t);
  }, [form, step, draftKey, isEdit, submitted]);
  const clearDraft = () => { if (draftKey) try { localStorage.removeItem(draftKey); } catch { /* ignore */ } };
  const discardDraft = () => { clearDraft(); setDraftInfo(null); setForm(blankForm); setStep(1); };

  const myEmail = (currentUser?.email || "").toLowerCase();
  const myPersonnelRecord = personnel.find(p => (p.email || "").toLowerCase() === myEmail);
  // A normal user can submit "on behalf of" anyone in their team (any depth, Faz 3.1);
  // Admin/Consultant can pick anyone.
  const isAdmin = currentUser?.role === "Admin" || currentUser?.role === "Consultant";
  const selectablePersonnel = personnel
    .filter(p => p.id !== myPersonnelRecord?.id && (isAdmin || teamIds.has(p.id)))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const onBehalfOf = personnel.find(p => p.id === form.onBehalfOfId) || myPersonnelRecord;

  const resolvedPersonnel = isEdit
    ? {
        name: editingSuggestion!.personnelName, department: editingSuggestion!.personnelDepartment,
        jobTitle: editingSuggestion!.personnelJobTitle, shift: editingSuggestion!.shift,
        teamLeaderName: editingSuggestion!.teamLeaderName, teamLeaderEmail: editingSuggestion!.teamLeaderEmail,
        machineLeaderName: editingSuggestion!.machineLeaderName, machineLeaderEmail: editingSuggestion!.machineLeaderEmail
      }
    : {
        name: onBehalfOf?.name || currentUser?.full_name || "",
        department: onBehalfOf?.department || "",
        jobTitle: onBehalfOf?.jobTitle || "",
        shift: onBehalfOf?.shift || "",
        teamLeaderName: onBehalfOf?.teamLeaderName || "",
        teamLeaderEmail: onBehalfOf?.teamLeaderEmail || "",
        machineLeaderName: onBehalfOf?.machineLeaderName || "",
        machineLeaderEmail: onBehalfOf?.machineLeaderEmail || ""
      };

  const valid = [
    form.suggestionTypes.length > 0 && form.subject.trim().length > 0,
    form.currentState.trim().length > 0,
    form.improvementSuggestion.trim().length > 0,
    !!form.stage && !!form.paybackPeriod && !!form.estimatedSavingCurrency && !!form.estimatedCostCurrency
      && (!isPerPiece(form.paybackPeriod) || !parsePerPiece(form).error),
    true
  ];

  const goTo = (n: number) => { setStep(n); document.getElementById("app-main-scroll")?.scrollTo({ top: 0, behavior: "smooth" }); };
  const next = () => {
    setAttempted(true);
    if (!valid[step - 1]) return;
    setAttempted(false);
    goTo(step + 1);
  };
  const back = () => goTo(Math.max(1, step - 1));

  const addPhotos = async (which: "photosCurrent" | "photosPropose", files: FileList | null) => {
    if (!files) return;
    const added: KaizenSuggestionPhoto[] = [];
    for (const f of Array.from(files)) added.push({ dataUrl: await readAndShrink(f) });
    setForm(f => ({ ...f, [which]: [...f[which], ...added] }));
  };
  const removePhoto = (which: "photosCurrent" | "photosPropose", idx: number) => {
    setForm(f => ({ ...f, [which]: f[which].filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      personnelId: isEdit ? undefined : onBehalfOf?.id,
      personnelName: resolvedPersonnel.name,
      personnelDepartment: resolvedPersonnel.department,
      personnelJobTitle: resolvedPersonnel.jobTitle,
      shift: resolvedPersonnel.shift,
      teamLeaderName: resolvedPersonnel.teamLeaderName,
      teamLeaderEmail: resolvedPersonnel.teamLeaderEmail,
      machineLeaderName: resolvedPersonnel.machineLeaderName,
      machineLeaderEmail: resolvedPersonnel.machineLeaderEmail,
      subject: form.subject,
      suggestionTypes: form.suggestionTypes,
      currentState: form.currentState,
      photosCurrent: form.photosCurrent,
      improvementSuggestion: form.improvementSuggestion,
      photosPropose: form.photosPropose,
      stage: form.stage,
      paybackPeriod: form.paybackPeriod,
      estimatedSaving: savingNum,
      ...(perPiece ? { unitSaving: Number(form.unitSaving), annualVolume: Number(form.annualVolume), productionYears: Number(form.productionYears) } : {}),
      estimatedSavingCurrency: form.estimatedSavingCurrency,
      estimatedCost: Number(form.estimatedCost) || 0,
      estimatedCostCurrency: form.estimatedCostCurrency,
      isg: form.isg,
      cevre: form.cevre,
      motivasyon: form.motivasyon
    };
    let res: any;
    try {
      res = isEdit
        ? await api.post(`suggestions/${editingSuggestion!.id}`, payload)
        : await api.post("suggestions", payload);
    } catch {
      // No connection: nothing is lost — the draft stays on this device.
      setSaving(false);
      showToast(draftKey && !isEdit
        ? "Bağlantı yok. Öneriniz bu cihazda taslak olarak saklandı; bağlantı gelince Gönder'e tekrar basın."
        : "Bağlantı yok. Bağlantı gelince tekrar deneyin.");
      return;
    }
    setSaving(false);
    if (res.success) {
      if (!isEdit) { clearDraft(); setDraftInfo(null); }
      setSubmitted(res.data);
      document.getElementById("app-main-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showToast(`Hata: ${res.error || "Kaydedilemedi."}`);
    }
  };

  const toggleType = (t: string) => {
    setForm(f => ({
      ...f,
      suggestionTypes: f.suggestionTypes.includes(t) ? f.suggestionTypes.filter(x => x !== t) : [...f.suggestionTypes, t]
    }));
  };

  // Parça başı: the annual saving is derived; otherwise it is what was typed.
  const perPiece = isPerPiece(form.paybackPeriod);
  const perPieceCalc = perPieceSaving({ unitSaving: Number(form.unitSaving), annualVolume: Number(form.annualVolume), productionYears: Number(form.productionYears) });
  const savingNum = perPiece ? perPieceCalc.annual : Number(form.estimatedSaving) || 0;
  const costNum = Number(form.estimatedCost) || 0;
  const sameCurrency = form.estimatedSavingCurrency === form.estimatedCostCurrency && form.estimatedSavingCurrency !== "Eş Değer Ürün";
  const net = savingNum - costNum;

  // Who decides next — the same rule the server applies at submit (Faz 2-B.3).
  const route = requiredStagesFor(savingNum, form.estimatedSavingCurrency, settings);
  const nextStop = route.includes("Manager")
    ? `Amirinize${resolvedPersonnel.teamLeaderName ? ` (${resolvedPersonnel.teamLeaderName})` : ""} onaya gider${route.includes("Board") ? ", ardından Kaizen Kurulu değerlendirir" : "; amir onayı son karardır"}.`
    : "Doğrudan Kaizen Kurulu'na değerlendirmeye gider.";

  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto text-center !py-10 sm:!py-14 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="relative">
          <span className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-900/25"><CircleCheckBig className="w-8 h-8" /></span>
          <h2 className="text-2xl font-bold text-slate-900 mt-5">{isEdit ? "Öneriniz yeniden gönderildi" : "Teşekkürler, öneriniz alındı!"}</h2>
          <p className="text-slate-600 mt-2 max-w-md mx-auto">"{submitted.subject}"</p>
          <div className="mt-6 mx-auto max-w-md rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-4 text-left text-sm text-slate-700 flex gap-3">
            <Send className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>{submitted.approvalStatus === "First Approval" ? "Doğrudan Kaizen Kurulu'na değerlendirmeye gitti." : nextStop} Durumunu <b>Önerilerim</b> ekranından takip edebilirsiniz.</span>
          </div>
          {kiosk && <KioskExitCountdown seconds={settings.kioskAfterSubmitSeconds} onExit={() => onKioskExit?.()} />}
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            {kiosk && <Button variant="primary" className="h-12 px-6" onClick={() => onKioskExit?.()}><LogOut className="w-4 h-4" />Bitir ve çık</Button>}
            <Button variant="brand" className="h-12 px-6" onClick={() => onSaved(submitted)}><ListChecks className="w-4 h-4" />Önerilerime git</Button>
            <Button variant="outline" className="h-12 px-6" onClick={() => { onSaved(submitted, true); setSubmitted(null); setForm(blankForm); setStep(1); }}><Plus className="w-4 h-4" />Yeni öneri ver</Button>
          </div>
        </div>
      </Card>
    );
  }

  const current = STEPS[step - 1];
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      {/* Form column */}
      <Card padded={false} className="xl:col-span-2 overflow-hidden">
        {/* Header + stepper */}
        <div className="px-5 sm:px-7 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{isEdit ? "Öneriyi düzenle" : "Yeni Kaizen önerisi"}</p>
            <p className="text-xs font-semibold text-slate-500 tabular-nums">Adım {step} / {STEPS.length}</p>
          </div>
          {draftInfo && !isEdit && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-xs text-amber-900">
              <span className="flex items-center gap-1.5"><Save className="w-3.5 h-3.5" />Yarım kalan taslağınız geri yüklendi{draftInfo.restoredAt ? ` (${new Date(draftInfo.restoredAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})` : ""}.{draftInfo.photosDropped ? " Fotoğraflar sığmadığı için saklanamadı; yeniden ekleyin." : ""}</span>
              <button onClick={discardDraft} className="font-semibold underline cursor-pointer">Taslağı sil, baştan başla</button>
            </div>
          )}
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${Math.max(progress, 4)}%` }} />
          </div>
          <ol className="mt-4 hidden sm:flex items-center justify-between gap-2">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              const Icon = s.icon;
              return (
                <li key={s.label}>
                  <button
                    type="button"
                    disabled={n > step}
                    onClick={() => goTo(n)}
                    aria-current={active ? "step" : undefined}
                    className={`flex items-center gap-2 rounded-xl px-2 py-1.5 -mx-2 text-sm font-semibold transition-colors ${n < step ? "cursor-pointer hover:bg-slate-50" : "cursor-default"} ${active ? "text-slate-900" : done ? "text-emerald-700" : "text-slate-400"}`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
                      {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    </span>
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="px-5 sm:px-7 py-6 min-h-[440px] space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{current.title}</h2>
            <p className="text-sm text-slate-500 mt-1">{current.hint}</p>
          </div>

          {isEdit && step === 1 && (
            <p className="text-sm bg-amber-50 text-amber-800 ring-1 ring-amber-200/70 rounded-xl px-4 py-3 flex gap-2.5"><PencilLine className="w-4 h-4 shrink-0 mt-0.5" />Reddedilen öneriyi düzenliyorsunuz. Gönderdiğinizde öneri baştan değerlendirmeye girer.</p>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/40 ring-1 ring-slate-200/70 p-4 sm:p-5">
                {!isEdit && selectablePersonnel.length > 0 ? (
                  <FormField label="Kimin adına?" hint="Boş bırakırsanız öneri kendi adınıza oluşturulur.">
                    <select value={form.onBehalfOfId} onChange={e => setForm(f => ({ ...f, onBehalfOfId: e.target.value }))} className={`${inputCls} !bg-white`}>
                      <option value="">Kendi adıma ({currentUser?.full_name})</option>
                      {selectablePersonnel.map(p => <option key={p.id} value={p.id}>{p.name}{p.employeeNo ? ` · ${p.employeeNo}` : ""}{p.department ? ` — ${p.department}` : ""}</option>)}
                    </select>
                  </FormField>
                ) : null}
                <div className={`flex flex-wrap gap-x-6 gap-y-2 text-sm ${!isEdit && selectablePersonnel.length > 0 ? "mt-4" : ""}`}>
                  {[["Öneren", resolvedPersonnel.name], ["Sicil", isEdit ? editingSuggestion!.personnelEmployeeNo : onBehalfOf?.employeeNo], ["Bölüm", resolvedPersonnel.department], ["Görev", resolvedPersonnel.jobTitle], ["Vardiya", resolvedPersonnel.shift], ["Amir", resolvedPersonnel.teamLeaderName]].map(([l, v]) => (
                    <span key={l}><span className="text-slate-500">{l}: </span><span className="font-semibold text-slate-900">{v || "—"}</span></span>
                  ))}
                </div>
              </div>
              {!isEdit && settings.managerStageEnabled && !resolvedPersonnel.teamLeaderEmail && (
                <p className="text-sm bg-amber-50 text-amber-800 ring-1 ring-amber-200/70 rounded-xl px-4 py-3">Amir bilgisi bulunamadı: öneri bir amire atanmayacak. Kurulum &gt; Personel Listesi'nde kaydınızı tamamlatın.</p>
              )}

              <FormField label="Öneri sınıfı" required hint="Birden fazla seçebilirsiniz." error={attempted && form.suggestionTypes.length === 0 ? "En az bir sınıf seçiniz." : undefined}>
                <div className="flex flex-wrap gap-2">
                  {optionChoices(settings.suggestionTypes, editingSuggestion?.suggestionTypes).map(t => (
                    <ChoiceChip key={t} on={form.suggestionTypes.includes(t)} onClick={() => toggleType(t)} icon={TYPE_ICONS[t] || Tag}>{t}</ChoiceChip>
                  ))}
                </div>
              </FormField>
              <FormField label="Öneri konusu" required error={attempted && !form.subject.trim() ? "Öneri konusunu yazınız." : undefined} aside={<span className="text-xs text-slate-400 tabular-nums">{form.subject.length}/200</span>}>
                <input value={form.subject} maxLength={200} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={`${inputCls} ${attempted && !form.subject.trim() ? errCls : ""}`} placeholder="Örn. Montaj hattında vida besleme aparatı" />
              </FormField>
            </div>
          )}

          {(step === 2 || step === 3) && (() => {
            const key = step === 2 ? "currentState" : "improvementSuggestion";
            const photoKey = step === 2 ? "photosCurrent" : "photosPropose";
            const value = form[key];
            return (
              <div className="space-y-6">
                <FormField
                  label={step === 2 ? "Mevcut durum / problem" : "İyileştirme önerisi"}
                  required
                  error={attempted && !value.trim() ? (step === 2 ? "Mevcut durumu yazınız." : "Önerinizi yazınız.") : undefined}
                  aside={<CharCount value={value} />}
                >
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {PROMPTS[step].map(p => <span key={p} className="text-xs font-medium text-slate-600 bg-slate-100 rounded-full px-2.5 py-1">{p}</span>)}
                  </div>
                  <textarea
                    value={value}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    rows={8}
                    className={`${areaCls} ${attempted && !value.trim() ? errCls : ""}`}
                    placeholder={step === 2 ? "Örn. Vidalar kutudan elle alınıyor; her üründe ~8 sn arama kaybı, düşen vidalar hatta kalıyor." : "Örn. Titreşimli vida besleyici takılsın; operatör vidayı tek hamlede alır, düşme biter."}
                  />
                </FormField>
                <KaizenSimilar api={api} excludeId={editingSuggestion?.id}
                  query={{ subject: form.subject, currentState: form.currentState, improvementSuggestion: step === 3 ? form.improvementSuggestion : "", department: resolvedPersonnel.department, suggestionTypes: form.suggestionTypes }}
                  hint="Bu fikir daha önce verilmiş olabilir. Aynıysa önerinizde neyin farklı olduğunu yazın." />
                <PhotoUploader
                  label={step === 2 ? "Mevcut durum fotoğrafları" : "Öneri / çizim fotoğrafları"}
                  photos={form[photoKey]}
                  onAdd={f => addPhotos(photoKey, f)}
                  onRemove={i => removePhoto(photoKey, i)}
                />
              </div>
            );
          })()}

          {step === 4 && (
            <div className="space-y-6">
              <FormField label="Kazanç ne sıklıkla oluşuyor?" required error={attempted && !form.paybackPeriod ? "Seçiniz." : undefined}
                hint={perPiece ? "Parça başı kazancı, yıllık üretim adedini ve ürünün kaç yıl daha üretileceğini girin; sistem hesaplar." : undefined}>
                <div className="flex flex-wrap gap-2">
                  {optionChoices(settings.paybackPeriods, editingSuggestion?.paybackPeriod).map(p => (
                    <ChoiceChip key={p} on={form.paybackPeriod === p} onClick={() => setForm(f => ({ ...f, paybackPeriod: p }))}>{p}</ChoiceChip>
                  ))}
                </div>
              </FormField>

              {perPiece && (
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/40 ring-1 ring-emerald-200/70 p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <MoneyField label="Parça başı kazanç *" icon={PiggyBank} value={form.unitSaving} currency={form.estimatedSavingCurrency} currencies={currencyChoices(settings, form.estimatedSavingCurrency)}
                      onValue={v => setForm(f => ({ ...f, unitSaving: v }))} onCurrency={c => setForm(f => ({ ...f, estimatedSavingCurrency: c }))} />
                    <FormField label="Yıllık üretim hacmi *" error={attempted && !(Number(form.annualVolume) > 0) ? "Adet giriniz." : undefined}>
                      <div className="flex items-center rounded-xl bg-white ring-1 ring-inset ring-slate-200 focus-within:ring-2 focus-within:ring-emerald-600/40">
                        <input type="number" inputMode="numeric" min={1} value={form.annualVolume} onChange={e => setForm(f => ({ ...f, annualVolume: e.target.value }))} placeholder="0"
                          className="flex-1 min-w-0 h-12 px-4 bg-transparent text-sm font-semibold tabular-nums focus:outline-none" />
                        <span className="pr-4 text-sm text-slate-500">adet/yıl</span>
                      </div>
                    </FormField>
                    <FormField label="Üretim süresi *" error={attempted && !(Number(form.productionYears) > 0 && Number(form.productionYears) <= 50) ? "1–50 yıl." : undefined}>
                      <div className="flex items-center rounded-xl bg-white ring-1 ring-inset ring-slate-200 focus-within:ring-2 focus-within:ring-emerald-600/40">
                        <input type="number" inputMode="decimal" min={0.5} max={50} step="0.5" value={form.productionYears} onChange={e => setForm(f => ({ ...f, productionYears: e.target.value }))} placeholder="0"
                          className="flex-1 min-w-0 h-12 px-4 bg-transparent text-sm font-semibold tabular-nums focus:outline-none" />
                        <span className="pr-4 text-sm text-slate-500">yıl</span>
                      </div>
                    </FormField>
                  </div>
                  {attempted && !(Number(form.unitSaving) > 0) && <p className="text-xs font-medium text-red-600">Parça başı kazancı giriniz.</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white ring-1 ring-emerald-200/70 p-3.5">
                      <p className="text-xs font-semibold text-emerald-700">Yıllık kazanç</p>
                      <p className="text-xl font-bold text-emerald-900 tabular-nums mt-0.5">{perPieceCalc.annual.toLocaleString("tr-TR")} <span className="text-sm">{form.estimatedSavingCurrency}</span></p>
                      <p className="text-xs text-slate-500 mt-1 tabular-nums">{(Number(form.unitSaving) || 0).toLocaleString("tr-TR")} × {(Number(form.annualVolume) || 0).toLocaleString("tr-TR")} adet</p>
                    </div>
                    <div className="rounded-xl bg-white ring-1 ring-emerald-200/70 p-3.5">
                      <p className="text-xs font-semibold text-emerald-700">Toplam kazanç ({Number(form.productionYears) || 0} yıl)</p>
                      <p className="text-xl font-bold text-emerald-900 tabular-nums mt-0.5">{perPieceCalc.lifetime.toLocaleString("tr-TR")} <span className="text-sm">{form.estimatedSavingCurrency}</span></p>
                      <p className="text-xs text-slate-500 mt-1">Değerlendirme ve raporlarda yıllık kazanç kullanılır.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {!perPiece && (
                  <MoneyField label="Tahmini kazanç" icon={PiggyBank} value={form.estimatedSaving} currency={form.estimatedSavingCurrency} currencies={currencyChoices(settings, form.estimatedSavingCurrency)}
                    onValue={v => setForm(f => ({ ...f, estimatedSaving: v }))} onCurrency={c => setForm(f => ({ ...f, estimatedSavingCurrency: c }))} />
                )}
                <MoneyField label="Tahmini maliyet / yatırım" icon={Wrench} value={form.estimatedCost} currency={form.estimatedCostCurrency} currencies={currencyChoices(settings, form.estimatedCostCurrency)}
                  onValue={v => setForm(f => ({ ...f, estimatedCost: v }))} onCurrency={c => setForm(f => ({ ...f, estimatedCostCurrency: c }))} />
                <FormField label="Öneri aşaması (PDCA)" required error={attempted && !form.stage ? "Seçiniz." : undefined}>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className={`${inputCls} ${attempted && !form.stage ? errCls : ""}`}>
                    <option value="">Seçiniz…</option>
                    {optionChoices(settings.stages, editingSuggestion?.stage).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Ek etkiler" hint="Parasal olmayan faydaları da işaretleyin.">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([["isg", "İş sağlığı ve güvenliği", ShieldAlert, "text-red-600 bg-red-50"], ["cevre", "Çevre", Leaf, "text-emerald-600 bg-emerald-50"], ["motivasyon", "Motivasyon", Smile, "text-amber-600 bg-amber-50"]] as const).map(([key, label, Icon, tint]) => (
                    <button key={key} type="button" aria-pressed={form[key]} onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                      className={`flex items-center gap-3 rounded-xl p-3.5 text-left text-sm font-semibold cursor-pointer transition-all ${form[key] ? "ring-2 ring-emerald-600 bg-emerald-50/60 text-slate-900" : "ring-1 ring-slate-200 text-slate-700 hover:ring-slate-300"}`}>
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tint}`}><Icon className="w-4 h-4" /></span>
                      <span className="flex-1">{label}</span>
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center ${form[key] ? "bg-emerald-600 text-white" : "ring-1 ring-slate-300"}`}>{form[key] && <Check className="w-3.5 h-3.5" />}</span>
                    </button>
                  ))}
                </div>
              </FormField>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              {[
                { n: 1, title: "Konu", body: <><p className="font-semibold text-slate-900">{form.subject}</p><p className="text-slate-500 mt-0.5">{form.suggestionTypes.join(", ")} · {resolvedPersonnel.name}</p></> },
                { n: 2, title: "Mevcut durum", body: <p className="text-slate-700 whitespace-pre-wrap line-clamp-4">{form.currentState}</p>, photos: form.photosCurrent.length },
                { n: 3, title: "Öneri", body: <p className="text-slate-700 whitespace-pre-wrap line-clamp-4">{form.improvementSuggestion}</p>, photos: form.photosPropose.length },
                { n: 4, title: "Kazanç", body: <p className="text-slate-700">{perPiece && <>{(Number(form.unitSaving) || 0).toLocaleString("tr-TR")} {form.estimatedSavingCurrency}/parça × {(Number(form.annualVolume) || 0).toLocaleString("tr-TR")} adet/yıl × {Number(form.productionYears) || 0} yıl = <b>{perPieceCalc.lifetime.toLocaleString("tr-TR")} {form.estimatedSavingCurrency}</b> toplam · </>}{savingNum.toLocaleString("tr-TR")} {form.estimatedSavingCurrency} {perPiece ? "yıllık " : ""}kazanç · {costNum.toLocaleString("tr-TR")} {form.estimatedCostCurrency} maliyet · {form.paybackPeriod} · {form.stage}</p> }
              ].map(sec => (
                <div key={sec.n} className="rounded-2xl ring-1 ring-slate-200/80 p-4 text-sm flex gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{sec.title}{sec.photos ? <span className="normal-case tracking-normal font-medium"> · {sec.photos} fotoğraf</span> : null}</p>
                    {sec.body}
                  </div>
                  <button onClick={() => goTo(sec.n)} className="self-start shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"><PencilLine className="w-3.5 h-3.5" />Düzenle</button>
                </div>
              ))}
              <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200/70 p-4 text-sm text-emerald-900 flex gap-3">
                <Send className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                <span><b>Gönderince:</b> {nextStop}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action bar — sticks to the bottom of the screen on phones */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-t border-slate-100 bg-white/95 backdrop-blur">
          <Button variant="outline" onClick={back} disabled={step === 1} className="h-11"><ChevronLeft className="w-4 h-4" />Geri</Button>
          {step < STEPS.length ? (
            <Button variant="primary" onClick={next} className="h-11 px-6">Devam<ChevronRight className="w-4 h-4" /></Button>
          ) : (
            <Button variant="brand" onClick={save} disabled={saving} className="h-11 px-6"><Send className="w-4 h-4" />{saving ? "Gönderiliyor…" : isEdit ? "Yeniden gönder" : "Öneriyi gönder"}</Button>
          )}
        </div>
      </Card>

      {/* Live preview */}
      <div className="xl:sticky xl:top-20 space-y-4">
        <Card padded={false} className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-amber-400 via-emerald-500 to-teal-400" />
          <div className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Canlı önizleme</p>
            <h3 className="text-lg font-bold text-slate-900 mt-1.5 break-words">{form.subject || <span className="text-slate-300">Öneri konusu…</span>}</h3>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {form.suggestionTypes.map(t => <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{t}</span>)}
              {form.isg && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600">İSG</span>}
              {form.cevre && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Çevre</span>}
              {form.motivasyon && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Motivasyon</span>}
            </div>
            {(form.photosCurrent[0] || form.photosPropose[0]) && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {[form.photosCurrent[0], form.photosPropose[0]].map((p, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100">
                    {p ? <img src={p.dataUrl} alt="" className="w-full h-full object-cover" /> : null}
                    <span className="absolute bottom-1.5 left-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-900/70 text-white">{i === 0 ? "Önce" : "Sonra"}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-700">{perPiece ? "Yıllık kazanç" : "Kazanç"}</p><p className="font-bold text-emerald-900 mt-0.5 tabular-nums">{savingNum.toLocaleString("tr-TR")} <span className="text-xs">{form.estimatedSavingCurrency}</span></p>{perPiece && perPieceCalc.lifetime > 0 && <p className="text-[11px] text-emerald-700 mt-0.5 tabular-nums">{Number(form.productionYears)} yılda {perPieceCalc.lifetime.toLocaleString("tr-TR")}</p>}</div>
              <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-semibold text-slate-600">Maliyet</p><p className="font-bold text-slate-900 mt-0.5 tabular-nums">{costNum.toLocaleString("tr-TR")} <span className="text-xs">{form.estimatedCostCurrency}</span></p></div>
            </div>
            {sameCurrency && (savingNum > 0 || costNum > 0) && (
              <div className={`rounded-xl p-3 mt-3 ${net >= 0 ? "bg-teal-50 text-teal-800" : "bg-red-50 text-red-700"}`}>
                <p className="text-xs font-semibold">Net etki{recurrenceOf(form.paybackPeriod) === "annual" ? " (ilk yıl)" : ""}</p>
                <p className="font-bold tabular-nums mt-0.5">{net.toLocaleString("tr-TR")} {form.estimatedSavingCurrency}</p>
                {costNum > 0 && <p className="text-[11px] mt-0.5">Geri ödeme: {paybackText(computeRoi({ saving: savingNum, cost: costNum, recurrence: recurrenceOf(form.paybackPeriod) }).paybackMonths)}</p>}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-4 flex gap-2"><Send className="w-3.5 h-3.5 shrink-0 mt-0.5" />{nextStop}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MoneyField({ label, icon: Icon, value, currency, currencies, onValue, onCurrency }: {
  label: string; icon: any; value: string; currency: string; currencies: string[]; onValue: (v: string) => void; onCurrency: (c: string) => void;
}) {
  return (
    <FormField label={label}>
      <div className="flex items-center rounded-xl bg-slate-50/80 ring-1 ring-inset ring-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/40 transition-all">
        <Icon className="w-4 h-4 text-slate-400 ml-4 shrink-0" />
        <input type="number" inputMode="decimal" min={0} value={value} onChange={e => onValue(e.target.value)} placeholder="0"
          className="flex-1 min-w-0 h-12 px-3 bg-transparent text-sm font-semibold text-slate-900 tabular-nums placeholder:text-slate-400 focus:outline-none" />
        <select value={currency} onChange={e => onCurrency(e.target.value)} aria-label={`${label} para birimi`}
          className="h-9 mr-1.5 pl-2.5 pr-1 rounded-lg bg-white ring-1 ring-slate-200 text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer">
          {currencies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </FormField>
  );
}

function PhotoUploader({ label, photos, onAdd, onRemove }: { label: string; photos: KaizenSuggestionPhoto[]; onAdd: (f: FileList | null) => void; onRemove: (i: number) => void }) {
  const isTouch = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
  return (
    <FormField label={label} aside={<span className="text-xs text-slate-400">İsteğe bağlı · en fazla 8</span>}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {photos.map((p, i) => (
          <div key={i} className="relative group aspect-[4/3]">
            <img src={p.dataUrl} alt={`${label} ${i + 1}`} className="w-full h-full object-cover rounded-xl ring-1 ring-slate-200" />
            <button onClick={() => onRemove(i)} aria-label="Fotoğrafı kaldır" className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        {photos.length < 8 && (
          <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 hover:border-emerald-400 hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-emerald-700 cursor-pointer transition-colors">
            <Camera className="w-6 h-6" />
            <span className="text-xs font-semibold">{isTouch ? "Galeriden ekle" : "Fotoğraf çek / ekle"}</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => { onAdd(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        {photos.length < 8 && isTouch && (
          <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 flex flex-col items-center justify-center gap-1.5 text-emerald-700 cursor-pointer">
            <Aperture className="w-6 h-6" />
            <span className="text-xs font-semibold">Kamerayı aç</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { onAdd(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
    </FormField>
  );
}

// Kiosk: after a submission the next person is waiting — sign out unless someone touches the screen.
function KioskExitCountdown({ seconds, onExit }: { seconds: number; onExit: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const reset = () => setLeft(seconds);
    window.addEventListener("pointerdown", reset);
    const t = setInterval(() => setLeft(l => l - 1), 1000);
    return () => { clearInterval(t); window.removeEventListener("pointerdown", reset); };
  }, [seconds]);
  const done = React.useRef(false);
  useEffect(() => { if (left <= 0 && !done.current) { done.current = true; onExit(); } }, [left]);
  return <p className="mt-5 text-sm font-semibold text-slate-500" aria-live="polite">{Math.max(left, 0)} saniye içinde oturum kapanacak</p>;
}
