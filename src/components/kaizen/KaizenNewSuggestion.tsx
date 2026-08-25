import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Save, Camera, X } from "lucide-react";
import { KaizenPersonnel, KaizenSuggestion, KaizenSuggestionPhoto } from "./kaizenTypes";
import { SUGGESTION_TYPE_OPTIONS, STAGE_OPTIONS, PAYBACK_PERIOD_OPTIONS, CURRENCY_OPTIONS } from "./kaizenCalc";
import { KaizenApi } from "./KaizenSuggestionSystem";

interface Props {
  currentUser: any;
  personnel: KaizenPersonnel[];
  editingSuggestion: KaizenSuggestion | null;
  api: KaizenApi;
  showToast: (msg: string) => void;
  onSaved: (s: KaizenSuggestion) => void;
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
  onBehalfOfId: "",
  suggestionTypes: [],
  subject: "",
  currentState: "",
  photosCurrent: [],
  improvementSuggestion: "",
  photosPropose: [],
  stage: "",
  paybackPeriod: "",
  estimatedSaving: "",
  estimatedSavingCurrency: "TL",
  estimatedCost: "",
  estimatedCostCurrency: "TL",
  isg: false,
  cevre: false,
  motivasyon: false
};

const STEP_LABELS = ["Personel", "Mevcut Durum", "Öneri", "Kazanç", "Önizleme"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export default function KaizenNewSuggestion({ currentUser, personnel, editingSuggestion, api, showToast, onSaved }: Props) {
  const isEdit = !!editingSuggestion;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [form, setForm] = useState<FormState>(blank);

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
        estimatedSavingCurrency: editingSuggestion.estimatedSavingCurrency || "TL",
        estimatedCost: String(editingSuggestion.estimatedCost || ""),
        estimatedCostCurrency: editingSuggestion.estimatedCostCurrency || "TL",
        isg: editingSuggestion.isg,
        cevre: editingSuggestion.cevre,
        motivasyon: editingSuggestion.motivasyon
      });
    } else {
      setForm(blank);
    }
  }, [editingSuggestion]);

  const myEmail = (currentUser?.email || "").toLowerCase();
  const myPersonnelRecord = personnel.find(p => (p.email || "").toLowerCase() === myEmail);
  // Legacy app: a normal user can only submit "on behalf of" people they are the team leader of;
  // Admin/Consultant can pick anyone. Replaces the source's hard-coded admin-email bypass.
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

  const step1Valid = form.suggestionTypes.length > 0 && form.subject.trim().length > 0;
  const step2Valid = form.currentState.trim().length > 0;
  const step3Valid = form.improvementSuggestion.trim().length > 0;
  const step4Valid = !!form.stage && !!form.paybackPeriod && !!form.estimatedSavingCurrency && !!form.estimatedCostCurrency;

  const next = () => {
    setAttempted(true);
    if (step === 1 && !step1Valid) return;
    if (step === 2 && !step2Valid) return;
    if (step === 3 && !step3Valid) return;
    if (step === 4 && !step4Valid) return;
    setAttempted(false);
    setStep(s => s + 1);
  };
  const back = () => setStep(s => Math.max(1, s - 1));

  const addPhoto = async (which: "photosCurrent" | "photosPropose", file: File | undefined) => {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setForm(f => ({ ...f, [which]: [...f[which], { dataUrl }] }));
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

  const inputCls = "w-full p-2 border border-gray-200 rounded-lg text-xs font-bold";
  const errCls = "border-red-400";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
        {STEP_LABELS.map((l, i) => (
          <div key={l} className={`flex-1 text-center pb-2 border-b-2 ${step === i + 1 ? "border-slate-900 text-slate-900" : "border-gray-100"}`}>
            {i + 1}. {l}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          {!isEdit && selectablePersonnel.length > 0 && (
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Kimin Adına? (opsiyonel)</label>
              <select value={form.onBehalfOfId} onChange={e => setForm(f => ({ ...f, onBehalfOfId: e.target.value }))} className={inputCls}>
                <option value="">Kendi adıma ({currentUser?.full_name})</option>
                {selectablePersonnel.map(p => <option key={p.id} value={p.id}>{p.name} — {p.department}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-lg p-3">
            <div><span className="text-slate-400 font-bold">Ad Soyad: </span>{resolvedPersonnel.name || "-"}</div>
            <div><span className="text-slate-400 font-bold">Bölüm: </span>{resolvedPersonnel.department || "-"}</div>
            <div><span className="text-slate-400 font-bold">Görev: </span>{resolvedPersonnel.jobTitle || "-"}</div>
            <div><span className="text-slate-400 font-bold">Vardiya: </span>{resolvedPersonnel.shift || "-"}</div>
            <div><span className="text-slate-400 font-bold">Amir: </span>{resolvedPersonnel.teamLeaderName || "-"}</div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Öneri Sınıfı *</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SUGGESTION_TYPE_OPTIONS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer ${form.suggestionTypes.includes(t) ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {attempted && form.suggestionTypes.length === 0 && <p className="text-red-500 text-[11px] mt-1">Lütfen en az bir öneri sınıfı seçiniz.</p>}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Öneri Konusu *</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className={`${inputCls} ${attempted && !form.subject.trim() ? errCls : ""}`}
              placeholder="Öneri konusunu kısaca yazın"
            />
            {attempted && !form.subject.trim() && <p className="text-red-500 text-[11px] mt-1">Lütfen öneri konusu yazınız.</p>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Mevcut Durum Açıklaması *</label>
            <textarea
              value={form.currentState}
              onChange={e => setForm(f => ({ ...f, currentState: e.target.value }))}
              rows={5}
              className={`${inputCls} ${attempted && !form.currentState.trim() ? errCls : ""}`}
              placeholder="Mevcut durumu / problemi açıklayın"
            />
            {attempted && !form.currentState.trim() && <p className="text-red-500 text-[11px] mt-1">Lütfen mevcut durumu yazınız.</p>}
          </div>
          <PhotoUploader label="Mevcut Durum Görseli" photos={form.photosCurrent} onAdd={f => addPhoto("photosCurrent", f)} onRemove={i => removePhoto("photosCurrent", i)} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Önerilen İyileştirme *</label>
            <textarea
              value={form.improvementSuggestion}
              onChange={e => setForm(f => ({ ...f, improvementSuggestion: e.target.value }))}
              rows={5}
              className={`${inputCls} ${attempted && !form.improvementSuggestion.trim() ? errCls : ""}`}
              placeholder="Önerdiğiniz iyileştirmeyi açıklayın"
            />
            {attempted && !form.improvementSuggestion.trim() && <p className="text-red-500 text-[11px] mt-1">Lütfen önerinizi yazınız.</p>}
          </div>
          <PhotoUploader label="Öneri Görseli" photos={form.photosPropose} onAdd={f => addPhoto("photosPropose", f)} onRemove={i => removePhoto("photosPropose", i)} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Öneri Aşaması *</label>
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} className={`${inputCls} ${attempted && !form.stage ? errCls : ""}`}>
                <option value="">Seçiniz...</option>
                {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400">Kazanç Süresi *</label>
              <select value={form.paybackPeriod} onChange={e => setForm(f => ({ ...f, paybackPeriod: e.target.value }))} className={`${inputCls} ${attempted && !form.paybackPeriod ? errCls : ""}`}>
                <option value="">Seçiniz...</option>
                {PAYBACK_PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex space-x-1">
              <input type="number" value={form.estimatedSaving} onChange={e => setForm(f => ({ ...f, estimatedSaving: e.target.value }))} placeholder="Tahmini Kazanç" className={inputCls} />
              <select value={form.estimatedSavingCurrency} onChange={e => setForm(f => ({ ...f, estimatedSavingCurrency: e.target.value }))} className={`${inputCls} w-20`}>
                {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex space-x-1">
              <input type="number" value={form.estimatedCost} onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))} placeholder="Tahmini Maliyet" className={inputCls} />
              <select value={form.estimatedCostCurrency} onChange={e => setForm(f => ({ ...f, estimatedCostCurrency: e.target.value }))} className={`${inputCls} w-20`}>
                {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            {[["isg", "İş Sağlığı ve Güvenliği"], ["cevre", "Çevre"], ["motivasyon", "Motivasyon"]].map(([key, label]) => (
              <label key={key} className="flex items-center space-x-1.5 text-xs font-bold cursor-pointer">
                <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-2 text-xs bg-slate-50 rounded-lg p-4">
          <p><span className="font-bold text-slate-400">Ad Soyad: </span>{resolvedPersonnel.name}</p>
          <p><span className="font-bold text-slate-400">Öneri Sınıfı: </span>{form.suggestionTypes.join(", ")}</p>
          <p><span className="font-bold text-slate-400">Öneri Konusu: </span>{form.subject}</p>
          <p><span className="font-bold text-slate-400">Mevcut Durum: </span>{form.currentState}</p>
          <p><span className="font-bold text-slate-400">Önerilen İyileştirme: </span>{form.improvementSuggestion}</p>
          <p><span className="font-bold text-slate-400">Öneri Aşaması: </span>{form.stage} · <span className="font-bold text-slate-400">Kazanç Süresi: </span>{form.paybackPeriod}</p>
          <p><span className="font-bold text-slate-400">Tahmini Kazanç: </span>{form.estimatedSaving || 0} {form.estimatedSavingCurrency} · <span className="font-bold text-slate-400">Tahmini Maliyet: </span>{form.estimatedCost || 0} {form.estimatedCostCurrency}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <button onClick={back} disabled={step === 1} className="px-3 py-2 rounded-lg text-xs font-black bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer flex items-center space-x-1">
          <ChevronLeft className="w-3.5 h-3.5" /><span>Geri</span>
        </button>
        {step < 5 ? (
          <button onClick={next} className="px-3 py-2 rounded-lg text-xs font-black bg-slate-900 text-white cursor-pointer flex items-center space-x-1">
            <span>İleri</span><ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button onClick={save} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-black bg-emerald-800 hover:bg-emerald-700 text-white cursor-pointer flex items-center space-x-1.5 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /><span>{saving ? "Kaydediliyor..." : "Kaydet"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function PhotoUploader({ label, photos, onAdd, onRemove }: { label: string; photos: KaizenSuggestionPhoto[]; onAdd: (f: File | undefined) => void; onRemove: (i: number) => void }) {
  return (
    <div className="space-y-2">
      <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer w-fit">
        <Camera className="w-3.5 h-3.5" />
        <span>{label}</span>
        <input type="file" accept="image/*" className="hidden" onChange={e => onAdd(e.target.files?.[0])} />
      </label>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              <img src={p.dataUrl} alt={label} className="h-14 rounded-lg border border-gray-200" />
              <button onClick={() => onRemove(i)} className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
