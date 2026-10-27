import React, { useState, useMemo } from "react";
import { Plus, Trash2, Users, Star, Search, Pencil, X, Save } from "lucide-react";
import { KaizenPersonnel, KaizenCriteria } from "./kaizenTypes";
import { Card, Button, EmptyState, tableCls, theadCls, thCls, tdCls, trCls } from "./kaizenUi";

interface Crud<T> {
  save: (record: Partial<T> & { id?: string }) => Promise<any>;
  remove: (id: string) => Promise<any>;
}

interface Props {
  personnel: KaizenPersonnel[];
  criteria: KaizenCriteria[];
  personnelCrud: Crud<KaizenPersonnel>;
  criteriaCrud: Crud<KaizenCriteria>;
}

const inputCls = "w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>{children}</div>;
}

export default function KaizenSetup({ personnel, criteria, personnelCrud, criteriaCrud }: Props) {
  const [tab, setTab] = useState<"personnel" | "criteria">("personnel");
  return (
    <div className="space-y-6">
      <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
        {([["personnel", "Personel Listesi", Users, personnel.length], ["criteria", "Değerlendirme Kriterleri", Star, criteria.length]] as const).map(([k, l, Icon, n]) => (
          <button key={k} onClick={() => setTab(k)} className={`h-10 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer transition-all ${tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
            <Icon className="w-4 h-4" />{l}<span className="text-xs text-slate-400 tabular-nums">{n}</span>
          </button>
        ))}
      </div>
      {tab === "personnel" && <PersonnelTab personnel={personnel} personnelCrud={personnelCrud} />}
      {tab === "criteria" && <CriteriaTab criteria={criteria} criteriaCrud={criteriaCrud} />}
    </div>
  );
}

const blankPersonnel: Partial<KaizenPersonnel> = {
  name: "", email: "", department: "", jobTitle: "", shift: "",
  teamLeaderName: "", teamLeaderEmail: "", machineLeaderName: "", machineLeaderEmail: "", isBoardMember: false
};

function PersonnelTab({ personnel, personnelCrud }: { personnel: KaizenPersonnel[]; personnelCrud: Crud<KaizenPersonnel> }) {
  const [form, setForm] = useState<Partial<KaizenPersonnel> | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return personnel.filter(p => !q || `${p.name} ${p.email} ${p.department} ${p.jobTitle}`.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [personnel, query]);

  const set = (k: keyof KaizenPersonnel, v: any) => setForm(f => ({ ...(f || {}), [k]: v }));
  const canSave = !!form?.name?.trim() && !!form?.email?.trim();

  const save = async () => {
    if (!form || !canSave) return;
    setSaving(true);
    const res = await personnelCrud.save(form);
    setSaving(false);
    if (res?.success) setForm(null);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <Card padded={false} className="xl:col-span-2 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 flex-wrap">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ad, e-posta veya bölüm ara…" className={`${inputCls} pl-10`} />
          </div>
          <Button variant="primary" onClick={() => setForm({ ...blankPersonnel })}><Plus className="w-4 h-4" />Personel Ekle</Button>
        </div>
        {list.length === 0 ? <EmptyState icon={Users} title="Personel bulunamadı" text="Personel ekleyerek amir ve Kurul üyeliği ilişkilerini tanımlayın." /> : (
          <div className="overflow-x-auto max-h-[70vh]">
            <table className={tableCls}>
              <thead className={`${theadCls} sticky top-0`}><tr><th className={thCls}>Ad Soyad</th><th className={thCls}>Bölüm / Görev</th><th className={thCls}>Amir</th><th className={thCls}>Rol</th><th className={thCls}></th></tr></thead>
              <tbody>{list.map(p => (
                <tr key={p.id} className={`${trCls} cursor-pointer`} onClick={() => setForm(p)}>
                  <td className={tdCls}><p className="font-semibold text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{p.email}</p></td>
                  <td className={tdCls}>{p.department || "—"}<span className="text-slate-400"> · {p.jobTitle || "—"}</span></td>
                  <td className={tdCls}>{p.teamLeaderName || "—"}</td>
                  <td className={tdCls}>{p.isBoardMember && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">★ Kurul Üyesi</span>}</td>
                  <td className={`${tdCls} text-right whitespace-nowrap`}>
                    <button className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" title="Düzenle"><Pencil className="w-4 h-4" /></button>
                    <button onClick={e => { e.stopPropagation(); if (window.confirm(`"${p.name}" kaydını silmek istediğinizden emin misiniz?`)) personnelCrud.remove(p.id); }} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 cursor-pointer" title="Sil"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="xl:sticky xl:top-2">
        {!form ? (
          <EmptyState icon={Pencil} title="Bir kayıt seçin veya yeni ekleyin" text="Seçtiğiniz personelin bilgileri burada düzenlenir." />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-black text-slate-900">{form.id ? "Personeli Düzenle" : "Yeni Personel"}</h3><button onClick={() => setForm(null)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button></div>
            <Field label="Ad Soyad *"><input value={form.name || ""} onChange={e => set("name", e.target.value)} className={inputCls} /></Field>
            <Field label="E-posta *"><input value={form.email || ""} onChange={e => set("email", e.target.value)} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bölüm"><input value={form.department || ""} onChange={e => set("department", e.target.value)} className={inputCls} /></Field>
              <Field label="Görev"><input value={form.jobTitle || ""} onChange={e => set("jobTitle", e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label="Vardiya"><input value={form.shift || ""} onChange={e => set("shift", e.target.value)} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amir Adı"><input value={form.teamLeaderName || ""} onChange={e => set("teamLeaderName", e.target.value)} className={inputCls} /></Field>
              <Field label="Amir E-posta"><input value={form.teamLeaderEmail || ""} onChange={e => set("teamLeaderEmail", e.target.value)} className={inputCls} /></Field>
              <Field label="Makine Lideri"><input value={form.machineLeaderName || ""} onChange={e => set("machineLeaderName", e.target.value)} className={inputCls} /></Field>
              <Field label="Makine Lideri E-posta"><input value={form.machineLeaderEmail || ""} onChange={e => set("machineLeaderEmail", e.target.value)} className={inputCls} /></Field>
            </div>
            <label className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer ${form.isBoardMember ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
              <input type="checkbox" className="w-4 h-4 mt-0.5 accent-amber-600" checked={!!form.isBoardMember} onChange={e => set("isBoardMember", e.target.checked)} />
              <span><span className="block text-sm font-bold text-slate-800">Kaizen Kurulu Üyesi</span><span className="block text-xs text-slate-500 mt-0.5">Değerlendirme, Yokoten/Ödül takibi ve Rapor erişimi verir.</span></span>
            </label>
            <Button variant="brand" onClick={save} disabled={!canSave || saving} className="w-full"><Save className="w-4 h-4" />{saving ? "Kaydediliyor…" : form.id ? "Güncelle" : "Ekle"}</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

const blankCriteria: Partial<KaizenCriteria> = { criteria: "", description: "", point: 0, category: "", minIncome: 0, maxIncome: 0 };

function CriteriaTab({ criteria, criteriaCrud }: { criteria: KaizenCriteria[]; criteriaCrud: Crud<KaizenCriteria> }) {
  const [form, setForm] = useState<Partial<KaizenCriteria> | null>(null);
  const [saving, setSaving] = useState(false);
  const sorted = useMemo(() => [...criteria].sort((a, b) => a.point - b.point), [criteria]);
  const set = (k: keyof KaizenCriteria, v: any) => setForm(f => ({ ...(f || {}), [k]: v }));

  const save = async () => {
    if (!form?.criteria?.trim()) return;
    setSaving(true);
    const res = await criteriaCrud.save(form);
    setSaving(false);
    if (res?.success) setForm(null);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-500">Kurul, önerileri bu kademelere göre puanlar. Gelir aralığı, değerlendirme ekranında kademe önerisi için kullanılır.</p>
          <Button variant="primary" onClick={() => setForm({ ...blankCriteria })}><Plus className="w-4 h-4" />Kriter Ekle</Button>
        </div>
        {sorted.length === 0 ? <Card><EmptyState icon={Star} title="Henüz kriter yok" text="D / C / B / A / A+ gibi puan kademelerini tanımlayın." /></Card> : sorted.map(c => (
          <Card key={c.id} className="flex items-center gap-5 !p-4 cursor-pointer hover:border-slate-300" >
            <div onClick={() => setForm(c)} className="flex items-center gap-5 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0"><span className="text-lg font-black leading-none">{c.point}</span><span className="text-[11px] opacity-70 mt-0.5">puan</span></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{c.category ? <span className="text-amber-600">{c.category} · </span> : null}{c.criteria}</p>
                {c.description && <p className="text-sm text-slate-500 mt-0.5">{c.description}</p>}
              </div>
              <p className="text-sm font-semibold text-slate-600 tabular-nums whitespace-nowrap hidden md:block">{c.minIncome.toLocaleString("tr-TR")} – {c.maxIncome ? c.maxIncome.toLocaleString("tr-TR") : "∞"}</p>
            </div>
            <button onClick={() => { if (window.confirm(`"${c.criteria}" kriterini silmek istediğinizden emin misiniz?`)) criteriaCrud.remove(c.id); }} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 cursor-pointer shrink-0" title="Sil"><Trash2 className="w-4 h-4" /></button>
          </Card>
        ))}
      </div>

      <Card className="xl:sticky xl:top-2">
        {!form ? <EmptyState icon={Pencil} title="Bir kriter seçin veya yeni ekleyin" /> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-black text-slate-900">{form.id ? "Kriteri Düzenle" : "Yeni Kriter"}</h3><button onClick={() => setForm(null)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button></div>
            <Field label="Kriter adı *"><input value={form.criteria || ""} onChange={e => set("criteria", e.target.value)} className={inputCls} placeholder="Örn. Hızlı uygulama / minimum yatırım" /></Field>
            <Field label="Açıklama"><textarea value={form.description || ""} onChange={e => set("description", e.target.value)} rows={3} className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Puan"><input type="number" value={form.point ?? 0} onChange={e => set("point", Number(e.target.value))} className={inputCls} /></Field>
              <Field label="Seviye (D, C, B…)"><input value={form.category || ""} onChange={e => set("category", e.target.value)} className={inputCls} /></Field>
              <Field label="Min. gelir (TL)"><input type="number" value={form.minIncome ?? 0} onChange={e => set("minIncome", Number(e.target.value))} className={inputCls} /></Field>
              <Field label="Maks. gelir (TL, 0 = sınırsız)"><input type="number" value={form.maxIncome ?? 0} onChange={e => set("maxIncome", Number(e.target.value))} className={inputCls} /></Field>
            </div>
            <Button variant="brand" onClick={save} disabled={!form.criteria?.trim() || saving} className="w-full"><Save className="w-4 h-4" />{saving ? "Kaydediliyor…" : form.id ? "Güncelle" : "Ekle"}</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
