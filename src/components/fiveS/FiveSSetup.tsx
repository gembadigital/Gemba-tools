import React, { useState } from "react";
import { Plus, Trash2, Edit, Save, X, Building2, HelpCircle, Users } from "lucide-react";
import { FiveSDepartment, FiveSArea, FiveSPersonnel, FiveSQuestion, FIVE_S_LEVELS, FiveSLevel } from "./fiveSTypes";
import { DIFFICULTY_LEVEL_OPTIONS } from "./fiveSCalc";

interface Crud<T> {
  save: (record: Partial<T> & { id?: string }) => Promise<any>;
  remove: (id: string) => Promise<any>;
}

interface FiveSSetupProps {
  departments: FiveSDepartment[];
  areas: FiveSArea[];
  personnel: FiveSPersonnel[];
  questions: FiveSQuestion[];
  departmentsCrud: Crud<FiveSDepartment>;
  areasCrud: Crud<FiveSArea>;
  personnelCrud: Crud<FiveSPersonnel>;
  questionsCrud: Crud<FiveSQuestion>;
}

const tabBtn = (active: boolean) =>
  `py-1.5 px-3 rounded-lg font-black text-[11px] uppercase flex items-center space-x-1.5 cursor-pointer transition-all ${
    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
  }`;

export default function FiveSSetup({
  departments, areas, personnel, questions,
  departmentsCrud, areasCrud, personnelCrud, questionsCrud
}: FiveSSetupProps) {
  const [tab, setTab] = useState<"facility" | "questions" | "personnel">("facility");

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button className={tabBtn(tab === "facility")} onClick={() => setTab("facility")}>
          <Building2 className="w-3.5 h-3.5" /><span>Tesis Yapısı</span>
        </button>
        <button className={tabBtn(tab === "questions")} onClick={() => setTab("questions")}>
          <HelpCircle className="w-3.5 h-3.5" /><span>Soru Listesi</span>
        </button>
        <button className={tabBtn(tab === "personnel")} onClick={() => setTab("personnel")}>
          <Users className="w-3.5 h-3.5" /><span>Ekip Listesi</span>
        </button>
      </div>

      {tab === "facility" && <FacilityTab departments={departments} areas={areas} personnel={personnel} departmentsCrud={departmentsCrud} areasCrud={areasCrud} />}
      {tab === "questions" && <QuestionsTab departments={departments} questions={questions} questionsCrud={questionsCrud} />}
      {tab === "personnel" && <PersonnelTab departments={departments} personnel={personnel} personnelCrud={personnelCrud} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function FacilityTab({ departments, areas, personnel, departmentsCrud, areasCrud }: {
  departments: FiveSDepartment[]; areas: FiveSArea[]; personnel: FiveSPersonnel[];
  departmentsCrud: Crud<FiveSDepartment>; areasCrud: Crud<FiveSArea>;
}) {
  const [newDept, setNewDept] = useState("");
  const [areaForm, setAreaForm] = useState<{ id?: string; departmentId: string; name: string; responsible: string; difficultyLevel: string }>({
    departmentId: "", name: "", responsible: "", difficultyLevel: "1"
  });

  const resetAreaForm = () => setAreaForm({ departmentId: "", name: "", responsible: "", difficultyLevel: "1" });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="font-black text-xs uppercase text-slate-700">Bölümler</h3>
        <div className="flex space-x-2">
          <input
            value={newDept}
            onChange={e => setNewDept(e.target.value)}
            placeholder="Örn: Üretim"
            className="flex-1 p-2 border border-gray-200 rounded-lg text-xs font-bold"
          />
          <button
            onClick={async () => { if (!newDept.trim()) return; await departmentsCrud.save({ name: newDept.trim() }); setNewDept(""); }}
            className="p-2 px-3 bg-slate-900 text-white rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="divide-y divide-gray-100 text-xs">
          {departments.map(d => (
            <div key={d.id} className="flex items-center justify-between py-2">
              <span className="font-bold text-slate-700">{d.name}</span>
              <button onClick={() => { if (window.confirm(`"${d.name}" bölümünü silmek istediğinizden emin misiniz?`)) departmentsCrud.remove(d.id); }} className="text-red-500 hover:text-red-700 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {departments.length === 0 && <p className="text-slate-400 py-2">Henüz bölüm tanımlanmadı.</p>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="font-black text-xs uppercase text-slate-700">{areaForm.id ? "Alanı Düzenle" : "Yeni Alan Ekle"}</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <select value={areaForm.departmentId} onChange={e => setAreaForm(f => ({ ...f, departmentId: e.target.value }))} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value="">Bölüm Seçiniz...</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input value={areaForm.name} onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))} placeholder="Alan Adı" className="p-2 border border-gray-200 rounded-lg font-bold" />
          <input
            list="five-s-personnel-names"
            value={areaForm.responsible}
            onChange={e => setAreaForm(f => ({ ...f, responsible: e.target.value }))}
            placeholder="Sorumlu Kişi"
            className="p-2 border border-gray-200 rounded-lg font-bold"
          />
          <datalist id="five-s-personnel-names">
            {personnel.map(p => <option key={p.id} value={p.name} />)}
          </datalist>
          <select value={areaForm.difficultyLevel} onChange={e => setAreaForm(f => ({ ...f, difficultyLevel: e.target.value }))} className="p-2 border border-gray-200 rounded-lg font-bold">
            {DIFFICULTY_LEVEL_OPTIONS.map(l => <option key={l} value={l}>Zorluk Seviyesi {l}</option>)}
          </select>
        </div>
        <div className="flex space-x-2">
          <button
            disabled={!areaForm.departmentId || !areaForm.name}
            onClick={async () => { await areasCrud.save(areaForm); resetAreaForm(); }}
            className="p-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" /><span>{areaForm.id ? "Güncelle" : "Ekle"}</span>
          </button>
          {areaForm.id && (
            <button onClick={resetAreaForm} className="p-2 px-3 bg-slate-100 rounded-lg text-xs font-black cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-100 text-xs max-h-80 overflow-y-auto">
          {areas.map(a => (
            <div key={a.id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-bold text-slate-700">{a.name}</span>
                <span className="text-slate-400"> — {departments.find(d => d.id === a.departmentId)?.name || "-"} — Sorumlu: {a.responsible || "-"} — Zorluk: {a.difficultyLevel}</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button onClick={() => setAreaForm({ id: a.id, departmentId: a.departmentId, name: a.name, responsible: a.responsible, difficultyLevel: a.difficultyLevel })} className="text-slate-500 hover:text-slate-800 cursor-pointer">
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { if (window.confirm(`"${a.name}" alanını silmek istediğinizden emin misiniz?`)) areasCrud.remove(a.id); }} className="text-red-500 hover:text-red-700 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {areas.length === 0 && <p className="text-slate-400 py-2">Henüz alan tanımlanmadı.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function QuestionsTab({ departments, questions, questionsCrud }: {
  departments: FiveSDepartment[]; questions: FiveSQuestion[]; questionsCrud: Crud<FiveSQuestion>;
}) {
  const blank = { departmentId: "", level: "1S" as FiveSLevel, difficultyLevel: "1", questionNo: (questions.length + 1), text: "" };
  const [form, setForm] = useState<{ id?: string; departmentId: string; level: FiveSLevel; difficultyLevel: string; questionNo: number; text: string }>(blank);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="font-black text-xs uppercase text-slate-700">{form.id ? "Soruyu Düzenle" : "Yeni Soru Ekle"}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <input type="number" value={form.questionNo} onChange={e => setForm(f => ({ ...f, questionNo: Number(e.target.value) }))} placeholder="Soru No" className="p-2 border border-gray-200 rounded-lg font-bold" />
        <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value as FiveSLevel }))} className="p-2 border border-gray-200 rounded-lg font-bold">
          {FIVE_S_LEVELS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} className="p-2 border border-gray-200 rounded-lg font-bold">
          <option value="">Bölüm Seçiniz...</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={form.difficultyLevel} onChange={e => setForm(f => ({ ...f, difficultyLevel: e.target.value }))} className="p-2 border border-gray-200 rounded-lg font-bold">
          {DIFFICULTY_LEVEL_OPTIONS.map(l => <option key={l} value={l}>Zorluk Seviyesi {l}</option>)}
        </select>
      </div>
      <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} placeholder="Soru metni" className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold" rows={2} />
      <div className="flex space-x-2">
        <button
          disabled={!form.departmentId || !form.text.trim()}
          onClick={async () => { await questionsCrud.save(form); setForm({ ...blank, questionNo: questions.length + 2 }); }}
          className="p-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-40"
        >
          <Save className="w-3.5 h-3.5" /><span>{form.id ? "Güncelle" : "Ekle"}</span>
        </button>
        {form.id && <button onClick={() => setForm(blank)} className="p-2 px-3 bg-slate-100 rounded-lg text-xs font-black cursor-pointer"><X className="w-3.5 h-3.5" /></button>}
      </div>

      <table className="w-full text-xs mt-2">
        <thead>
          <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
            <th className="py-1.5">No</th><th>S Seviyesi</th><th>Bölüm</th><th>Zorluk</th><th>Soru</th><th></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {questions.sort((a, b) => a.questionNo - b.questionNo).map(q => (
            <tr key={q.id}>
              <td className="py-2 font-bold">{q.questionNo}</td>
              <td>{q.level}</td>
              <td>{departments.find(d => d.id === q.departmentId)?.name || "-"}</td>
              <td>{q.difficultyLevel}</td>
              <td className="max-w-xs truncate" title={q.text}>{q.text}</td>
              <td className="text-right space-x-2 whitespace-nowrap">
                <button onClick={() => setForm(q)} className="text-slate-500 hover:text-slate-800 cursor-pointer"><Edit className="w-3.5 h-3.5 inline" /></button>
                <button onClick={() => { if (window.confirm("Bu soruyu silmek istediğinizden emin misiniz?")) questionsCrud.remove(q.id); }} className="text-red-500 hover:text-red-700 cursor-pointer"><Trash2 className="w-3.5 h-3.5 inline" /></button>
              </td>
            </tr>
          ))}
          {questions.length === 0 && <tr><td colSpan={6} className="text-slate-400 py-2">Henüz soru eklenmedi.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function PersonnelTab({ departments, personnel, personnelCrud }: {
  departments: FiveSDepartment[]; personnel: FiveSPersonnel[]; personnelCrud: Crud<FiveSPersonnel>;
}) {
  const blank = { name: "", role: "", email: "", department: "", isAuditor: false, isAdmin: false };
  const [form, setForm] = useState<{ id?: string; name: string; role: string; email: string; department: string; isAuditor: boolean; isAdmin: boolean }>(blank);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="font-black text-xs uppercase text-slate-700">{form.id ? "Personeli Düzenle" : "Yeni Personel Ekle"}</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ad Soyad" className="p-2 border border-gray-200 rounded-lg font-bold" />
        <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Görev" className="p-2 border border-gray-200 rounded-lg font-bold" />
        <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="E-posta" type="email" className="p-2 border border-gray-200 rounded-lg font-bold" />
        <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="p-2 border border-gray-200 rounded-lg font-bold">
          <option value="">Bölüm Seçiniz...</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <div className="flex items-center space-x-3 px-1">
          <label className="flex items-center space-x-1 font-bold cursor-pointer">
            <input type="checkbox" checked={form.isAuditor} onChange={e => setForm(f => ({ ...f, isAuditor: e.target.checked }))} />
            <span>Denetçi</span>
          </label>
          <label className="flex items-center space-x-1 font-bold cursor-pointer">
            <input type="checkbox" checked={form.isAdmin} onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))} />
            <span>Admin</span>
          </label>
        </div>
      </div>
      <div className="flex space-x-2">
        <button
          disabled={!form.name.trim()}
          onClick={async () => { await personnelCrud.save(form); setForm(blank); }}
          className="p-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-40"
        >
          <Save className="w-3.5 h-3.5" /><span>{form.id ? "Güncelle" : "Ekle"}</span>
        </button>
        {form.id && <button onClick={() => setForm(blank)} className="p-2 px-3 bg-slate-100 rounded-lg text-xs font-black cursor-pointer"><X className="w-3.5 h-3.5" /></button>}
      </div>

      <table className="w-full text-xs mt-2">
        <thead>
          <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
            <th className="py-1.5">Ad</th><th>Görev</th><th>Bölüm</th><th>E-posta</th><th>Denetçi</th><th>Admin</th><th></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {personnel.map(p => (
            <tr key={p.id}>
              <td className="py-2 font-bold">{p.name}</td>
              <td>{p.role}</td>
              <td>{p.department}</td>
              <td>{p.email}</td>
              <td>{p.isAuditor ? "✓" : "-"}</td>
              <td>{p.isAdmin ? "✓" : "-"}</td>
              <td className="text-right space-x-2 whitespace-nowrap">
                <button onClick={() => setForm(p)} className="text-slate-500 hover:text-slate-800 cursor-pointer"><Edit className="w-3.5 h-3.5 inline" /></button>
                <button onClick={() => { if (window.confirm(`"${p.name}" adlı personeli silmek istediğinizden emin misiniz?`)) personnelCrud.remove(p.id); }} className="text-red-500 hover:text-red-700 cursor-pointer"><Trash2 className="w-3.5 h-3.5 inline" /></button>
              </td>
            </tr>
          ))}
          {personnel.length === 0 && <tr><td colSpan={7} className="text-slate-400 py-2">Henüz personel eklenmedi.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
