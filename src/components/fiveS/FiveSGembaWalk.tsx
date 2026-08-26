import React, { useState, useMemo } from "react";
import { Footprints, ListChecks, Plus, Save, X, Edit, Trash2, CheckCircle, XCircle, Mail, Camera, Download } from "lucide-react";
import { FiveSDepartment, FiveSArea, FiveSPersonnel, FiveSProblemCategory, GembaWalkFinding } from "./fiveSTypes";
import { isOnTime, GEMBA_WALK_STATUS_OPTIONS, DIFFICULTY_LEVEL_OPTIONS } from "./fiveSCalc";
import { FiveSApi } from "./FiveSAuditSystem";

interface Crud<T> {
  save: (record: Partial<T> & { id?: string }) => Promise<any>;
  remove: (id: string) => Promise<any>;
}

interface FiveSGembaWalkProps {
  departments: FiveSDepartment[];
  areas: FiveSArea[];
  personnel: FiveSPersonnel[];
  problemCategories: FiveSProblemCategory[];
  findings: GembaWalkFinding[];
  currentUser: any;
  isFiveSAdmin: boolean;
  gembaWalkCrud: Crud<GembaWalkFinding>;
  problemCategoriesCrud: Crud<FiveSProblemCategory>;
  areasCrud: Crud<FiveSArea>;
  api: FiveSApi;
  showToast: (msg: string) => void;
}

const ALL = "__ALL__";
const tabBtn = (active: boolean) =>
  `py-1.5 px-3 rounded-lg font-black text-[11px] uppercase flex items-center space-x-1.5 cursor-pointer transition-all ${
    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
  }`;

interface LogForm {
  id?: string;
  areaId: string;
  problemCategory: string;
  problemDate: string;
  problemDescription: string;
  photo?: string;
  action: string;
  responsible: string;
  responsibleId: string;
  status: string;
  dueDate: string;
  completedDate: string;
}

const blankForm: LogForm = {
  id: undefined,
  areaId: "",
  problemCategory: "",
  problemDate: new Date().toISOString().slice(0, 10),
  problemDescription: "",
  photo: undefined,
  action: "",
  responsible: "",
  responsibleId: "",
  status: "Açık",
  dueDate: "",
  completedDate: ""
};

export default function FiveSGembaWalk(props: FiveSGembaWalkProps) {
  const [tab, setTab] = useState<"log" | "actions">("log");
  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button className={tabBtn(tab === "log")} onClick={() => setTab("log")}><Footprints className="w-3.5 h-3.5" /><span>Gemba Walk</span></button>
        <button className={tabBtn(tab === "actions")} onClick={() => setTab("actions")}><ListChecks className="w-3.5 h-3.5" /><span>Aksiyonlar</span></button>
      </div>
      {tab === "log" && <LogTab {...props} />}
      {tab === "actions" && <ActionsTab {...props} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function LogTab({ departments, areas, personnel, problemCategories, findings, gembaWalkCrud, problemCategoriesCrud, areasCrud, showToast }: FiveSGembaWalkProps) {
  const [form, setForm] = useState<LogForm>(blankForm);
  const [newCategory, setNewCategory] = useState("");
  const [showAddArea, setShowAddArea] = useState(false);
  const [newArea, setNewArea] = useState({ departmentId: "", name: "", responsible: "", difficultyLevel: "1" });

  const reset = () => setForm(blankForm);

  const save = async () => {
    if (!form.areaId || !form.problemCategory || !form.problemDescription.trim() || !form.action.trim() || !form.responsible || !form.status || !form.dueDate) {
      showToast("Alan, Problem Konusu, Problem Tanımı, Aksiyon, Sorumlu, Durum ve Termin Tarihi zorunludur.");
      return;
    }
    const res = await gembaWalkCrud.save({
      id: form.id,
      areaId: form.areaId,
      problemCategory: form.problemCategory,
      problemDate: form.problemDate,
      problemDescription: form.problemDescription,
      photo: form.photo,
      action: form.action,
      responsible: form.responsible,
      responsibleId: form.responsibleId,
      status: form.status,
      dueDate: form.dueDate || null,
      completedDate: form.completedDate || null
    });
    if (res.success) {
      showToast(form.id ? "Gemba Walk kaydı güncellendi." : "Gemba Walk kaydı oluşturuldu.");
      reset();
    }
  };

  const addArea = async () => {
    if (!newArea.departmentId || !newArea.name) return;
    const res = await areasCrud.save(newArea);
    if (res.success) {
      setForm(f => ({ ...f, areaId: res.data.id }));
      setNewArea({ departmentId: "", name: "", responsible: "", difficultyLevel: "1" });
      setShowAddArea(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h3 className="font-black text-xs uppercase text-slate-700">{form.id ? "Gemba Walk Kaydını Düzenle" : "Yeni Gemba Walk Kaydı"}</h3>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase text-slate-400">Problem Tespit</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <select value={form.problemCategory} onChange={e => setForm(f => ({ ...f, problemCategory: e.target.value }))} className="p-2 border border-gray-200 rounded-lg font-bold">
              <option value="">Problem Konusu Seçiniz...</option>
              {problemCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input type="date" value={form.problemDate} onChange={e => setForm(f => ({ ...f, problemDate: e.target.value }))} className="p-2 border border-gray-200 rounded-lg font-bold" />
          </div>
          <div className="flex space-x-2">
            <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Yeni Problem Konusu Ekle" className="flex-1 p-2 border border-gray-200 rounded-lg text-xs font-bold" />
            <button onClick={async () => { if (!newCategory.trim()) return; await problemCategoriesCrud.save({ name: newCategory.trim() }); setForm(f => ({ ...f, problemCategory: newCategory.trim() })); setNewCategory(""); }} className="p-2 px-3 bg-slate-100 rounded-lg cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
          </div>
          <textarea value={form.problemDescription} onChange={e => setForm(f => ({ ...f, problemDescription: e.target.value }))} placeholder="Problem Tanımı" rows={2} className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold" />
          <div className="flex items-center space-x-2">
            <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer w-fit">
              <Camera className="w-3.5 h-3.5" />
              <span>{form.photo ? "Fotoğrafı Değiştir" : "Fotoğraf Çek / Yükle"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setForm(f => ({ ...f, photo: reader.result as string }));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {form.photo && (
              <div className="relative">
                <img src={form.photo} alt="Görsel" className="h-14 rounded-lg border border-gray-200" />
                <button onClick={() => setForm(f => ({ ...f, photo: undefined }))} className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 cursor-pointer" title="Fotoğrafı Kaldır">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-[10px] font-black uppercase text-slate-400">Alan Bilgisi</p>
          <div className="flex space-x-2">
            <select value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))} className="flex-1 p-2 border border-gray-200 rounded-lg text-xs font-bold">
              <option value="">Alan Seçiniz...</option>
              {areas.map(a => <option key={a.id} value={a.id}>{departments.find(d => d.id === a.departmentId)?.name} — {a.name}</option>)}
            </select>
            <button onClick={() => setShowAddArea(v => !v)} className="p-2 px-3 bg-slate-100 rounded-lg text-[10px] font-black cursor-pointer whitespace-nowrap">+ Alan Ekle</button>
          </div>
          {showAddArea && (
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg text-xs">
              <select value={newArea.departmentId} onChange={e => setNewArea(a => ({ ...a, departmentId: e.target.value }))} className="p-2 border border-gray-200 rounded-lg font-bold">
                <option value="">Bölüm...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input value={newArea.name} onChange={e => setNewArea(a => ({ ...a, name: e.target.value }))} placeholder="Alan Adı" className="p-2 border border-gray-200 rounded-lg font-bold" />
              <select value={newArea.difficultyLevel} onChange={e => setNewArea(a => ({ ...a, difficultyLevel: e.target.value }))} className="p-2 border border-gray-200 rounded-lg font-bold col-span-2">
                {DIFFICULTY_LEVEL_OPTIONS.map(l => <option key={l} value={l}>Zorluk Seviyesi {l}</option>)}
              </select>
              <button onClick={addArea} className="p-2 bg-slate-900 text-white rounded-lg font-black col-span-2 cursor-pointer">Alanı Ekle</button>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-[10px] font-black uppercase text-slate-400">Aksiyon Tespit</p>
          <textarea value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))} placeholder="Aksiyon Tanımı" rows={2} className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold" />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={form.responsibleId}
              onChange={e => {
                const p = personnel.find(pp => pp.id === e.target.value);
                setForm(f => ({ ...f, responsibleId: p?.id || "", responsible: p?.name || "" }));
              }}
              className="p-2 border border-gray-200 rounded-lg text-xs font-bold"
            >
              <option value="">Sorumlu...</option>
              {personnel.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="p-2 border border-gray-200 rounded-lg text-xs font-bold">
              {GEMBA_WALK_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="p-2 border border-gray-200 rounded-lg text-xs font-bold" placeholder="Termin" />
          </div>
          <input type="date" value={form.completedDate} onChange={e => setForm(f => ({ ...f, completedDate: e.target.value }))} className="p-2 border border-gray-200 rounded-lg text-xs font-bold" placeholder="Gerçekleşme Tarihi" />
        </div>

        <div className="flex space-x-2">
          <button onClick={save} className="p-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer">
            <Save className="w-3.5 h-3.5" /><span>{form.id ? "Güncelle" : "Kaydet"}</span>
          </button>
          {form.id && <button onClick={reset} className="p-2 px-3 bg-slate-100 rounded-lg text-xs font-black cursor-pointer"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-black text-xs uppercase text-slate-700 mb-2">Kayıtlar ({findings.length})</h3>
        <div className="divide-y divide-gray-100 text-xs max-h-[32rem] overflow-y-auto">
          {findings.map(f => {
            const area = areas.find(a => a.id === f.areaId);
            return (
              <div key={f.id} className="py-2 flex items-start justify-between space-x-2">
                <div className="flex items-start space-x-2">
                  {f.photo && <img src={f.photo} alt="Kanıt" className="w-10 h-10 object-cover rounded-lg border border-gray-200 shrink-0" />}
                  <div>
                    <p className="font-bold text-slate-700">{area?.name || "-"} — {f.problemCategory}</p>
                    <p className="text-slate-500">{f.problemDescription}</p>
                    <p className="text-slate-400">{f.status} · Sorumlu: {f.responsible} · Termin: {f.dueDate || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button onClick={() => setForm({ ...f, dueDate: f.dueDate || "", completedDate: f.completedDate || "", responsibleId: f.responsibleId || "" })} className="text-slate-500 hover:text-slate-800 cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (window.confirm("Bu Gemba Walk kaydını silmek istediğinizden emin misiniz?")) gembaWalkCrud.remove(f.id); }} className="text-red-500 hover:text-red-700 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
          {findings.length === 0 && <p className="text-slate-400 py-2">Henüz Gemba Walk kaydı yok.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function ActionsTab({ departments, areas, findings, currentUser, isFiveSAdmin, gembaWalkCrud, api, showToast }: FiveSGembaWalkProps) {
  const rows = useMemo(() => findings.map(f => {
    const area = areas.find(a => a.id === f.areaId);
    const dept = departments.find(d => d.id === area?.departmentId);
    return { ...f, areaName: area?.name || "-", departmentName: dept?.name || "-", onTime: isOnTime(f.dueDate, f.completedDate) };
  }), [findings, areas, departments]);

  const [fDept, setFDept] = useState(ALL);
  const [fArea, setFArea] = useState(ALL);
  const [fCategory, setFCategory] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fResponsible, setFResponsible] = useState(ALL);
  const uniq = (vals: string[]) => Array.from(new Set(vals)).filter(v => v && v !== "-");

  const filtered = rows.filter(r =>
    (fDept === ALL || r.departmentName === fDept) &&
    (fArea === ALL || r.areaName === fArea) &&
    (fCategory === ALL || r.problemCategory === fCategory) &&
    (fStatus === ALL || r.status === fStatus) &&
    (fResponsible === ALL || r.responsible === fResponsible)
  );

  const [editing, setEditing] = useState<typeof rows[0] | null>(null);
  const [draft, setDraft] = useState({ status: "Açık", dueDate: "", completedDate: "" });
  const canEdit = (r: typeof rows[0]) => isFiveSAdmin || r.responsible === currentUser?.full_name;

  const saveEdit = async () => {
    if (!editing) return;
    await gembaWalkCrud.save({ id: editing.id, status: draft.status, dueDate: draft.dueDate || null, completedDate: draft.completedDate || null });
    setEditing(null);
  };

  const [recipientEmail, setRecipientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const sendReport = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) { showToast("Lütfen geçerli bir alıcı e-posta adresi girin."); return; }
    setSending(true);
    const res = await api.post("gemba-walk/send-report", { recipientEmail, findingIds: filtered.map(r => r.id) });
    setSending(false);
    if (res.success) showToast(`Gemba Walk raporu ${recipientEmail} adresine gönderildi.`);
    else showToast(`Hata: ${res.error || "Rapor gönderilemedi."}`);
  };

  const [downloading, setDownloading] = useState(false);
  const downloadReport = async () => {
    setDownloading(true);
    const res = await api.download("gemba-walk/report.xlsx", { method: "POST", body: { findingIds: filtered.map(r => r.id) } });
    setDownloading(false);
    if (!res.success) showToast(`Hata: ${res.error || "Rapor indirilemedi."}`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-xs uppercase text-slate-700">Filtreler</h3>
          <button onClick={() => { setFDept(ALL); setFArea(ALL); setFCategory(ALL); setFStatus(ALL); setFResponsible(ALL); }} className="text-[10px] font-black text-slate-400 hover:text-slate-700 cursor-pointer">Filtreleri Sıfırla</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <select value={fDept} onChange={e => setFDept(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Bölüm</option>
            {uniq(rows.map(r => r.departmentName)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fArea} onChange={e => setFArea(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Alan</option>
            {uniq(rows.map(r => r.areaName)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fCategory} onChange={e => setFCategory(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Problem Kategorisi</option>
            {uniq(rows.map(r => r.problemCategory)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Durum</option>
            {uniq(rows.map(r => r.status)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fResponsible} onChange={e => setFResponsible(e.target.value)} className="p-2 border border-gray-200 rounded-lg font-bold">
            <option value={ALL}>Sorumlu</option>
            {uniq(rows.map(r => r.responsible)).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-black text-xs uppercase text-slate-700">Gemba Walk Aksiyonları ({filtered.length})</h3>
          <div className="flex items-center space-x-2">
            <button onClick={downloadReport} disabled={downloading} className="p-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-50">
              <Download className="w-3.5 h-3.5" /><span>{downloading ? "İndiriliyor..." : "İndir"}</span>
            </button>
            <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="ornek@musteri.com" type="email" className="p-1.5 border border-gray-200 rounded-lg text-xs font-bold" />
            <button onClick={sendReport} disabled={sending} className="p-1.5 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-50">
              <Mail className="w-3.5 h-3.5" /><span>{sending ? "Gönderiliyor..." : "Rapor Gönder"}</span>
            </button>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
              <th className="py-1.5">Bölüm</th><th>Alan</th><th>Kategori</th><th>Aksiyon</th><th>Durum</th><th>Termin</th><th>Sorumlu</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(r => (
              <tr key={r.id} className={canEdit(r) ? "cursor-pointer hover:bg-slate-50" : ""} onClick={() => canEdit(r) && (setEditing(r), setDraft({ status: r.status, dueDate: r.dueDate || "", completedDate: r.completedDate || "" }))}>
                <td className="py-2 font-bold">{r.departmentName}</td>
                <td>{r.areaName}</td>
                <td>{r.problemCategory}</td>
                <td className="max-w-[200px] truncate" title={r.action}>{r.action}</td>
                <td>{r.status}</td>
                <td>{r.dueDate || "-"}</td>
                <td>{r.responsible}</td>
                <td>{r.onTime ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="text-slate-400 py-2">Kayıt bulunamadı.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-800">Gemba Walk Aksiyonu Güncelle</h3>
              <button onClick={() => setEditing(null)} className="cursor-pointer text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} className="w-full p-2 border border-gray-200 rounded-lg text-xs font-bold">
              {GEMBA_WALK_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} className="p-2 border border-gray-200 rounded-lg text-xs font-bold" />
              <input type="date" value={draft.completedDate} onChange={e => setDraft(d => ({ ...d, completedDate: e.target.value }))} className="p-2 border border-gray-200 rounded-lg text-xs font-bold" />
            </div>
            <button onClick={saveEdit} className="p-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer">
              <Save className="w-3.5 h-3.5" /><span>Kaydet</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
