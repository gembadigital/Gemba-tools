import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Save, Camera, X, Check, User, FileText, Lightbulb, Coins, Eye } from "lucide-react";
import { KaizenPersonnel, KaizenSuggestion, KaizenSuggestionPhoto } from "./kaizenTypes";
import { KaizenSettings, currencyChoices, optionChoices } from "../../utils/kaizenSettings";
import { KaizenApi } from "./KaizenSuggestionSystem";
import { Card, Button } from "./kaizenUi";

interface Props {
  currentUser: any;
  personnel: KaizenPersonnel[];
  editingSuggestion: KaizenSuggestion | null;
  api: KaizenApi;
  showToast: (msg: string) => void;
  onSaved: (s: KaizenSuggestion) => void;
  settings: KaizenSettings;
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
  isg: false, cevre: false, motivasyon: false
};

const STEPS = [
  { label: "Personel", icon: User },
  { label: "Mevcut Durum", icon: FileText },
  { label: "Öneri", icon: Lightbulb },
  { label: "Kazanç", icon: Coins },
  { label: "Önizleme", icon: Eye }
];

// Photos are stored inline as data URLs, so downscale before upload: a raw phone photo is
// 3–8 MB; 1600px / JPEG 0.8 is ~200–400 KB and plenty for a Kaizen before/after picture.
function readAndShrink(file: File, maxEdge = 1600, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const original = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(original);
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 400_000) { resolve(original); return; }
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(original); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

const inputCls = "w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400";
const areaCls = "w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400";
const errCls = "!border-red-400 !ring-red-100";

function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}{required && <span className="text-red-500"> *</span>}</label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

export default function KaizenNewSuggestion({ currentUser, personnel, editingSuggestion, api, showToast, onSaved, settings }: Props) {
  // A new form starts in the customer's base currency.
  const blankForm: FormState = { ...blank, estimatedSavingCurrency: settings.baseCurrency, estimatedCostCurrency: settings.baseCurrency };
  const isEdit = !!editingSuggestion;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);

  useEffect(() => {
    setStep(1);
    setAttempted(false);
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
        estimatedSavingCurrency: editingSuggestion.estimatedSavingCurrency || settings.baseCurrency,
        estimatedCost: String(editingSuggestion.estimatedCost || ""),
        estimatedCostCurrency: editingSuggestion.estimatedCostCurrency || settings.baseCurrency,
        isg: editingSuggestion.isg,
        cevre: editingSuggestion.cevre,
        motivasyon: editingSuggestion.motivasyon
      });
    } else {
      setForm(blankForm);
    }
  }, [editingSuggestion]);

  const myEmail = (currentUser?.email || "").toLowerCase();
  const myPersonnelRecord = personnel.find(p => (p.email || "").toLowerCase() === myEmail);
  // A normal user can only submit "on behalf of" people they are the team leader of;
  // Admin/Consultant can pick anyone.
  const isAdmin = currentUser?.role === "Admin" || currentUser?.role === "Consultant";
  const selectablePersonnel = personnel.filter(p => isAdmin || (p.teamLeaderEmail || "").toLowerCase() === myEmail);
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
    !!form.stage && !!form.paybackPeriod && !!form.estimatedSavingCurrency && !!form.estimatedCostCurrency,
    true
  ];

  const next = () => {
    setAttempted(true);
    if (!valid[step - 1]) return;
    setAttempted(false);
    setStep(s => s + 1);
  };
  const back = () => setStep(s => Math.max(1, s - 1));

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
      estimatedSaving: Number(form.estimatedSaving) || 0,
      estimatedSavingCurrency: form.estimatedSavingCurrency,
      estimatedCost: Number(form.estimatedCost) || 0,
      estimatedCostCurrency: form.estimatedCostCurrency,
      isg: form.isg,
      cevre: form.cevre,
      motivasyon: form.motivasyon
    };
    const res = isEdit
      ? await api.post(`suggestions/${editingSuggestion!.id}`, payload)
      : await api.post("suggestions", payload);
    setSaving(false);
    if (res.success) {
      showToast(isEdit ? "Öneri başarıyla düzenlendi." : "Öneri başarıyla oluşturuldu.");
      onSaved(res.data);
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

  const savingNum = Number(form.estimatedSaving) || 0;
  const costNum = Number(form.estimatedCost) || 0;
  const sameCurrency = form.estimatedSavingCurrency === form.estimatedCostCurrency && form.estimatedSavingCurrency !== "Eş Değer Ürün";
  const net = savingNum - costNum;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      {/* Form column */}
      <Card padded={false} className="xl:col-span-2 overflow-hidden">
        {/* Stepper */}
        <ol className="flex items-center px-6 pt-6 pb-5 border-b border-slate-100 overflow-x-auto gap-2">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            const Icon = s.icon;
            return (
              <React.Fragment key={s.label}>
                <li
                  onClick={() => { if (n < step) setStep(n); }}
                  className={`flex items-center gap-2.5 shrink-0 ${n < step ? "cursor-pointer" : ""}`}
                >
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${done ? "bg-emerald-600 text-white" : active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}>
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </span>
                  <span className={`text-sm font-semibold hidden sm:inline ${active ? "text-slate-900" : done ? "text-slate-700" : "text-slate-400"}`}>{s.label}</span>
                </li>
                {i < STEPS.length - 1 && <span className={`flex-1 h-0.5 min-w-4 rounded ${step > n ? "bg-emerald-600" : "bg-slate-100"}`} />}
              </React.Fragment>
            );
          })}
        </ol>

        <div className="p-6 min-h-[420px] space-y-5">
          {isEdit && (
            <p className="text-sm bg-amber-50 text-amber-800 rounded-xl px-4 py-3">Reddedilen öneriyi düzenliyorsunuz. Kaydettiğinizde öneri yeniden Amir onayına gönderilir.</p>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h3 className="text-lg font-black text-slate-900">Personel Bilgileri</h3>
              {!isEdit && selectablePersonnel.length > 0 && (
                <Field label="Kimin adına?" hint="Boş bırakırsanız öneri kendi adınıza oluşturulur.">
                  <select value={form.onBehalfOfId} onChange={e => setForm(f => ({ ...f, onBehalfOfId: e.target.value }))} className={inputCls}>
                    <option value="">Kendi adıma ({currentUser?.full_name})</option>
                    {selectablePersonnel.map(p => <option key={p.id} value={p.id}>{p.name} — {p.department}</option>)}
                  </select>
                </Field>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 bg-slate-50 rounded-2xl p-5">
                {[["Ad Soyad", resolvedPersonnel.name], ["Bölüm", resolvedPersonnel.department], ["Görev", resolvedPersonnel.jobTitle], ["Vardiya", resolvedPersonnel.shift], ["Amir", resolvedPersonnel.teamLeaderName], ["Makine Lideri", resolvedPersonnel.machineLeaderName]].map(([l, v]) => (
                  <div key={l}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{l}</p><p className="text-sm font-semibold text-slate-900 mt-1">{v || "—"}</p></div>
                ))}
              </div>
              {!isEdit && !resolvedPersonnel.teamLeaderEmail && (
                <p className="text-sm bg-amber-50 text-amber-800 rounded-xl px-4 py-3">Amir bilgisi bulunamadı: öneri onay için bir amire atanmayacak. Kurulum &gt; Personel Listesi'nde kaydınızı tamamlatın.</p>
              )}

              <Field label="Öneri Sınıfı" required error={attempted && form.suggestionTypes.length === 0 ? "En az bir sınıf seçiniz." : undefined}>
                <div className="flex flex-wrap gap-2">
                  {optionChoices(settings.suggestionTypes, editingSuggestion?.suggestionTypes).map(t => {
                    const on = form.suggestionTypes.includes(t);
                    return (
                      <button key={t} type="button" onClick={() => toggleType(t)} className={`h-10 px-4 rounded-full text-sm font-semibold cursor-pointer transition-colors ${on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                        {on && <Check className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}{t}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Öneri Konusu" required error={attempted && !form.subject.trim() ? "Öneri konusunu yazınız." : undefined}>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={`${inputCls} ${attempted && !form.subject.trim() ? errCls : ""}`} placeholder="Önerinizi tek cümleyle özetleyin" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h3 className="text-lg font-black text-slate-900">Mevcut Durum</h3>
              <Field label="Mevcut durum / problem" required error={attempted && !form.currentState.trim() ? "Mevcut durumu yazınız." : undefined} hint="Problem nedir, nerede ve ne sıklıkla yaşanıyor?">
                <textarea value={form.currentState} onChange={e => setForm(f => ({ ...f, currentState: e.target.value }))} rows={7} className={`${areaCls} ${attempted && !form.currentState.trim() ? errCls : ""}`} placeholder="Mevcut durumu açıklayın" />
              </Field>
              <PhotoUploader label="Mevcut durum görselleri" photos={form.photosCurrent} onAdd={f => addPhotos("photosCurrent", f)} onRemove={i => removePhoto("photosCurrent", i)} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h3 className="text-lg font-black text-slate-900">Önerilen İyileştirme</h3>
              <Field label="İyileştirme önerisi" required error={attempted && !form.improvementSuggestion.trim() ? "Önerinizi yazınız." : undefined} hint="Ne değişecek, nasıl uygulanacak, beklenen sonuç ne?">
                <textarea value={form.improvementSuggestion} onChange={e => setForm(f => ({ ...f, improvementSuggestion: e.target.value }))} rows={7} className={`${areaCls} ${attempted && !form.improvementSuggestion.trim() ? errCls : ""}`} placeholder="Önerdiğiniz iyileştirmeyi açıklayın" />
              </Field>
              <PhotoUploader label="Öneri görselleri" photos={form.photosPropose} onAdd={f => addPhotos("photosPropose", f)} onRemove={i => removePhoto("photosPropose", i)} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h3 className="text-lg font-black text-slate-900">Kazanç ve Etki</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Öneri Aşaması (PDCA)" required error={attempted && !form.stage ? "Seçiniz." : undefined}>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className={`${inputCls} ${attempted && !form.stage ? errCls : ""}`}>
                    <option value="">Seçiniz…</option>
                    {optionChoices(settings.stages, editingSuggestion?.stage).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Kazanç Süresi" required hint="Kazanç ne sıklıkla oluşuyor?" error={attempted && !form.paybackPeriod ? "Seçiniz." : undefined}>
                  <select value={form.paybackPeriod} onChange={e => setForm(f => ({ ...f, paybackPeriod: e.target.value }))} className={`${inputCls} ${attempted && !form.paybackPeriod ? errCls : ""}`}>
                    <option value="">Seçiniz…</option>
                    {optionChoices(settings.paybackPeriods, editingSuggestion?.paybackPeriod).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Tahmini Kazanç">
                  <div className="flex gap-2">
                    <input type="number" min={0} value={form.estimatedSaving} onChange={e => setForm(f => ({ ...f, estimatedSaving: e.target.value }))} placeholder="0" className={inputCls} />
                    <select value={form.estimatedSavingCurrency} onChange={e => setForm(f => ({ ...f, estimatedSavingCurrency: e.target.value }))} className={`${inputCls} !w-36`}>
                      {currencyChoices(settings, form.estimatedSavingCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </Field>
                <Field label="Tahmini Maliyet">
                  <div className="flex gap-2">
                    <input type="number" min={0} value={form.estimatedCost} onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))} placeholder="0" className={inputCls} />
                    <select value={form.estimatedCostCurrency} onChange={e => setForm(f => ({ ...f, estimatedCostCurrency: e.target.value }))} className={`${inputCls} !w-36`}>
                      {currencyChoices(settings, form.estimatedCostCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </Field>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Ek etkiler</p>
                <div className="flex flex-wrap gap-3">
                  {([["isg", "İş Sağlığı ve Güvenliği"], ["cevre", "Çevre"], ["motivasyon", "Motivasyon"]] as const).map(([key, label]) => (
                    <label key={key} className={`h-11 px-4 rounded-xl border flex items-center gap-2.5 text-sm font-semibold cursor-pointer transition-colors ${form[key] ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                      <input type="checkbox" className="w-4 h-4 accent-emerald-700" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-900">Göndermeden önce kontrol edin</h3>
              <p className="text-sm text-slate-500">Sağdaki özet kartında tüm alanları görebilirsiniz. Değiştirmek için ilgili adıma dönün; Kaydet'e bastığınızda öneri amirinize onaya gider.</p>
              <div className="flex flex-wrap gap-2">
                {STEPS.slice(0, 4).map((s, i) => (
                  <button key={s.label} onClick={() => setStep(i + 1)} className="h-9 px-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-700 cursor-pointer">{s.label} adımını düzenle</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <Button variant="ghost" onClick={back} disabled={step === 1}><ChevronLeft className="w-4 h-4" />Geri</Button>
          {step < 5 ? (
            <Button variant="primary" onClick={next}>İleri<ChevronRight className="w-4 h-4" /></Button>
          ) : (
            <Button variant="brand" onClick={save} disabled={saving}><Save className="w-4 h-4" />{saving ? "Kaydediliyor…" : isEdit ? "Yeniden Gönder" : "Öneriyi Gönder"}</Button>
          )}
        </div>
      </Card>

      {/* Live summary */}
      <div className="xl:sticky xl:top-2 space-y-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Canlı Özet</p>
          <h3 className="text-lg font-black text-slate-900 mt-1 break-words">{form.subject || <span className="text-slate-300">Öneri konusu…</span>}</h3>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {form.suggestionTypes.map(t => <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{t}</span>)}
            {form.isg && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600">İSG</span>}
            {form.cevre && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Çevre</span>}
            {form.motivasyon && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Motivasyon</span>}
          </div>
          <dl className="mt-5 space-y-4 text-sm">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Öneren</dt><dd className="mt-1 font-semibold text-slate-900">{resolvedPersonnel.name || "—"}<span className="font-normal text-slate-500"> · {resolvedPersonnel.department || "—"}</span></dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mevcut Durum</dt><dd className="mt-1 text-slate-700 whitespace-pre-wrap line-clamp-4">{form.currentState || "—"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Önerilen İyileştirme</dt><dd className="mt-1 text-slate-700 whitespace-pre-wrap line-clamp-4">{form.improvementSuggestion || "—"}</dd></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 p-3"><dt className="text-xs font-semibold text-emerald-700">Tahmini Kazanç</dt><dd className="font-black text-emerald-900 mt-0.5 tabular-nums">{savingNum.toLocaleString("tr-TR")} {form.estimatedSavingCurrency}</dd></div>
              <div className="rounded-xl bg-slate-100 p-3"><dt className="text-xs font-semibold text-slate-600">Tahmini Maliyet</dt><dd className="font-black text-slate-900 mt-0.5 tabular-nums">{costNum.toLocaleString("tr-TR")} {form.estimatedCostCurrency}</dd></div>
            </div>
            {sameCurrency && (savingNum > 0 || costNum > 0) && (
              <div className={`rounded-xl p-3 ${net >= 0 ? "bg-teal-50 text-teal-800" : "bg-red-50 text-red-700"}`}>
                <dt className="text-xs font-semibold">Net etki</dt>
                <dd className="font-black tabular-nums mt-0.5">{net.toLocaleString("tr-TR")} {form.estimatedSavingCurrency}</dd>
              </div>
            )}
            <div className="text-slate-600"><span className="font-semibold">Aşama:</span> {form.stage || "—"} · <span className="font-semibold">Süre:</span> {form.paybackPeriod || "—"}</div>
            <div className="text-slate-600"><span className="font-semibold">Görseller:</span> {form.photosCurrent.length + form.photosPropose.length} adet</div>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function PhotoUploader({ label, photos, onAdd, onRemove }: { label: string; photos: KaizenSuggestionPhoto[]; onAdd: (f: FileList | null) => void; onRemove: (i: number) => void }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 mb-1.5">{label} <span className="font-normal text-slate-400">(isteğe bağlı)</span></p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {photos.map((p, i) => (
          <div key={i} className="relative group aspect-[4/3]">
            <img src={p.dataUrl} alt={label} className="w-full h-full object-cover rounded-xl border border-slate-200" />
            <button onClick={() => onRemove(i)} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-slate-900/80 text-white flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" title="Kaldır">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-500 hover:bg-slate-50 flex flex-col items-center justify-center gap-1.5 text-slate-500 cursor-pointer transition-colors">
          <Camera className="w-6 h-6" />
          <span className="text-xs font-semibold">Görsel ekle</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => { onAdd(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}
