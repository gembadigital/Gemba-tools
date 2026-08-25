import React, { useState } from "react";
import { Plus, Trash2, Users, Star } from "lucide-react";
import { KaizenPersonnel, KaizenCriteria } from "./kaizenTypes";

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

const tabBtn = (active: boolean) =>
  `py-1.5 px-3 rounded-lg font-black text-[11px] uppercase flex items-center space-x-1.5 cursor-pointer transition-all ${
    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
  }`;

export default function KaizenSetup({ personnel, criteria, personnelCrud, criteriaCrud }: Props) {
  const [tab, setTab] = useState<"personnel" | "criteria">("personnel");
  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button className={tabBtn(tab === "personnel")} onClick={() => setTab("personnel")}><Users className="w-3.5 h-3.5" /><span>Personel Listesi</span></button>
        <button className={tabBtn(tab === "criteria")} onClick={() => setTab("criteria")}><Star className="w-3.5 h-3.5" /><span>Değerlendirme Kriterleri</span></button>
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
  const [form, setForm] = useState<Partial<KaizenPersonnel>>(blankPersonnel);

  const save = async () => {
    if (!form.name?.trim() || !form.email?.trim()) return;
    await personnelCrud.save(form);
    setForm(blankPersonnel);
  };

  const inputCls = "p-2 border border-gray-200 rounded-lg text-xs font-bold";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <h3 className="font-black text-xs uppercase text-slate-700">{form.id ? "Personeli Düzenle" : "Yeni Personel Ekle"}</h3>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ad Soyad" className={inputCls} />
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="E-posta" className={inputCls} />
          <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Bölüm" className={inputCls} />
          <input value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="Görev" className={inputCls} />
          <input value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))} placeholder="Vardiya" className={inputCls} />
          <input value={form.teamLeaderName} onChange={e => setForm(f => ({ ...f, teamLeaderName: e.target.value }))} placeholder="Amir Adı" className={inputCls} />
          <input value={form.teamLeaderEmail} onChange={e => setForm(f => ({ ...f, teamLeaderEmail: e.target.value }))} placeholder="Amir E-posta" className={inputCls} />
          <input value={form.machineLeaderName} onChange={e => setForm(f => ({ ...f, machineLeaderName: e.target.value }))} placeholder="Makine Lideri" className={inputCls} />
          <input value={form.machineLeaderEmail} onChange={e => setForm(f => ({ ...f, machineLeaderEmail: e.target.value }))} placeholder="Makine Lideri E-posta" className={inputCls} />
        </div>
        <label className="flex items-center space-x-1.5 text-xs font-bold cursor-pointer pt-1">
          <input type="checkbox" checked={!!form.isBoardMember} onChange={e => setForm(f => ({ ...f, isBoardMember: e.target.checked }))} />
          <span>Kaizen Kurulu Üyesi (Değerlendirme + Rapor erişimi)</span>
        </label>
        <div className="flex space-x-2 pt-1">
          <button onClick={save} className="p-2 px-3 bg-slate-900 text-white rounded-lg text-xs font-black cursor-pointer">{form.id ? "Güncelle" : "Ekle"}</button>
          {form.id && <button onClick={() => setForm(blankPersonnel)} className="p-2 px-3 bg-slate-100 rounded-lg text-xs font-black cursor-pointer">Vazgeç</button>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-black text-xs uppercase text-slate-700 mb-2">Personel Listesi ({personnel.length})</h3>
        <div className="divide-y divide-gray-100 text-xs max-h-[28rem] overflow-y-auto">
          {personnel.map(p => (
            <div key={p.id} className="py-2 flex items-center justify-between">
              <div className="cursor-pointer" onClick={() => setForm(p)}>
                <p className="font-bold text-slate-700">{p.name} {p.isBoardMember && <span className="text-amber-500">★</span>}</p>
                <p className="text-slate-400">{p.department} · {p.email}</p>
              </div>
              <button onClick={() => { if (window.confirm(`"${p.name}" kaydını silmek istediğinizden emin misiniz?`)) personnelCrud.remove(p.id); }} className="text-red-500 hover:text-red-700 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {personnel.length === 0 && <p className="text-slate-400 py-2">Henüz personel eklenmedi.</p>}
        </div>
      </div>
    </div>
  );
}

const blankCriteria: Partial<KaizenCriteria> = { criteria: "", description: "", point: 0, category: "", minIncome: 0, maxIncome: 0 };

function CriteriaTab({ criteria, criteriaCrud }: { criteria: KaizenCriteria[]; criteriaCrud: Crud<KaizenCriteria> }) {
  const [form, setForm] = useState<Partial<KaizenCriteria>>(blankCriteria);

  const save = async () => {
    if (!form.criteria?.trim()) return;
    await criteriaCrud.save(form);
    setForm(blankCriteria);
  };

  const inputCls = "p-2 border border-gray-200 rounded-lg text-xs font-bold";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <h3 className="font-black text-xs uppercase text-slate-700">{form.id ? "Kriteri Düzenle" : "Yeni Kriter Ekle"}</h3>
        <input value={form.criteria} onChange={e => setForm(f => ({ ...f, criteria: e.target.value }))} placeholder="Kriter Adı" className={`w-full ${inputCls}`} />
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Açıklama" rows={2} className={`w-full ${inputCls}`} />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={form.point} onChange={e => setForm(f => ({ ...f, point: Number(e.target.value) }))} placeholder="Puan" className={inputCls} />
          <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Kategori" className={inputCls} />
          <input type="number" value={form.minIncome} onChange={e => setForm(f => ({ ...f, minIncome: Number(e.target.value) }))} placeholder="Min. Kazanç" className={inputCls} />
          <input type="number" value={form.maxIncome} onChange={e => setForm(f => ({ ...f, maxIncome: Number(e.target.value) }))} placeholder="Maks. Kazanç" className={inputCls} />
        </div>
        <div className="flex space-x-2 pt-1">
          <button onClick={save} className="p-2 px-3 bg-slate-900 text-white rounded-lg text-xs font-black cursor-pointer">{form.id ? "Güncelle" : "Ekle"}</button>
          {form.id && <button onClick={() => setForm(blankCriteria)} className="p-2 px-3 bg-slate-100 rounded-lg text-xs font-black cursor-pointer">Vazgeç</button>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-black text-xs uppercase text-slate-700 mb-2">Kriter Listesi ({criteria.length})</h3>
        <div className="divide-y divide-gray-100 text-xs max-h-[28rem] overflow-y-auto">
          {criteria.map(c => (
            <div key={c.id} className="py-2 flex items-center justify-between">
              <div className="cursor-pointer" onClick={() => setForm(c)}>
                <p className="font-bold text-slate-700">{c.point} - {c.criteria}</p>
                <p className="text-slate-400">{c.category} · {c.description}</p>
              </div>
              <button onClick={() => { if (window.confirm(`"${c.criteria}" kriterini silmek istediğinizden emin misiniz?`)) criteriaCrud.remove(c.id); }} className="text-red-500 hover:text-red-700 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {criteria.length === 0 && <p className="text-slate-400 py-2">Henüz kriter eklenmedi.</p>}
        </div>
      </div>
    </div>
  );
}
