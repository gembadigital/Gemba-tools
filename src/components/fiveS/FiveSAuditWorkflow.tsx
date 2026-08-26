import React, { useState, useMemo } from "react";
import { Calendar, Users, ClipboardList, CheckCircle2, Trash2, Save, TrendingUp, TrendingDown, Minus, Sparkles, Mail, Camera, X, Download } from "lucide-react";
import {
  FiveSDepartment, FiveSArea, FiveSPersonnel, FiveSQuestion, FiveSAuditHeader,
  FiveSTeamAssignment, FiveSAuditAnswer, FiveSAuditResult, FIVE_S_LEVELS, FiveSLevel
} from "./fiveSTypes";
import { scoreTrend } from "./fiveSCalc";
import { FiveSApi } from "./FiveSAuditSystem";

interface FiveSAuditWorkflowProps {
  currentUser: any;
  isFiveSAdmin: boolean;
  departments: FiveSDepartment[];
  areas: FiveSArea[];
  personnel: FiveSPersonnel[];
  questions: FiveSQuestion[];
  audits: FiveSAuditHeader[];
  teamAssignments: FiveSTeamAssignment[];
  answers: FiveSAuditAnswer[];
  results: FiveSAuditResult[];
  api: FiveSApi;
  showToast: (msg: string) => void;
  onReload: () => Promise<any>;
  setAudits: React.Dispatch<React.SetStateAction<FiveSAuditHeader[]>>;
  setTeamAssignments: React.Dispatch<React.SetStateAction<FiveSTeamAssignment[]>>;
  setAnswers: React.Dispatch<React.SetStateAction<FiveSAuditAnswer[]>>;
  setResults: React.Dispatch<React.SetStateAction<FiveSAuditResult[]>>;
}

const tabBtn = (active: boolean) =>
  `py-1.5 px-3 rounded-lg font-black text-[11px] uppercase flex items-center space-x-1.5 cursor-pointer transition-all ${
    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
  }`;

const TrendIcon = ({ trend }: { trend: ReturnType<typeof scoreTrend> }) => {
  if (trend === "improved") return <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />;
  if (trend === "declined") return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  if (trend === "same") return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  return <Sparkles className="w-3.5 h-3.5 text-sky-500" />;
};

export default function FiveSAuditWorkflow(props: FiveSAuditWorkflowProps) {
  const [tab, setTab] = useState<"calendar" | "team" | "score" | "complete">("score");
  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button className={tabBtn(tab === "score")} onClick={() => setTab("score")}><ClipboardList className="w-3.5 h-3.5" /><span>5S Audit</span></button>
        <button className={tabBtn(tab === "complete")} onClick={() => setTab("complete")}><CheckCircle2 className="w-3.5 h-3.5" /><span>Denetimi Tamamla</span></button>
        {props.isFiveSAdmin && <button className={tabBtn(tab === "team")} onClick={() => setTab("team")}><Users className="w-3.5 h-3.5" /><span>Denetim Ekibi</span></button>}
        {props.isFiveSAdmin && <button className={tabBtn(tab === "calendar")} onClick={() => setTab("calendar")}><Calendar className="w-3.5 h-3.5" /><span>Denetim Takvimi</span></button>}
      </div>
      {tab === "score" && <ScoreTab {...props} />}
      {tab === "complete" && <CompleteTab {...props} />}
      {tab === "team" && props.isFiveSAdmin && <TeamTab {...props} />}
      {tab === "calendar" && props.isFiveSAdmin && <CalendarTab {...props} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function CalendarTab({ audits, api, showToast, onReload }: FiveSAuditWorkflowProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [weeklyFreq, setWeeklyFreq] = useState(1);
  const [monthlyFreq, setMonthlyFreq] = useState(1);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const generate = async (frequencyDays: number) => {
    const res = await api.post("audits/bulk-generate", { startDate, endDate, frequencyDays });
    if (res.success) {
      showToast(`${res.data.length} yeni denetim oluşturuldu.`);
      await onReload();
    } else {
      showToast(`Hata: ${res.error || "Denetim takvimi oluşturulamadı."}`);
    }
  };

  const downloadListReport = async () => {
    setDownloading(true);
    const res = await api.download("audit-list-report.xlsx");
    setDownloading(false);
    if (!res.success) showToast(`Hata: ${res.error || "Rapor indirilemedi."}`);
  };

  const sendListReport = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      showToast("Lütfen geçerli bir alıcı e-posta adresi girin.");
      return;
    }
    setSending(true);
    const res = await api.post("audit-list-report/send", { recipientEmail });
    setSending(false);
    if (res.success) showToast(`Rapor ${recipientEmail} adresine gönderildi.`);
    else showToast(`Hata: ${res.error || "Rapor gönderilemedi."}`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="font-black text-xs uppercase text-slate-700">Denetim Takvimi Oluştur</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs items-end">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Başlangıç</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400">Bitiş</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg font-bold" />
          </div>
          <div className="flex space-x-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Sıklık (Hafta)</label>
              <select value={weeklyFreq} onChange={e => setWeeklyFreq(Number(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg font-bold">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={() => generate(weeklyFreq * 7)} className="p-2 px-3 bg-slate-900 text-white rounded-lg font-black text-[11px] cursor-pointer whitespace-nowrap">Oluştur (Hafta)</button>
          </div>
          <div className="flex space-x-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-black uppercase text-slate-400">Sıklık (Ay)</label>
              <select value={monthlyFreq} onChange={e => setMonthlyFreq(Number(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg font-bold">
                {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={() => generate(monthlyFreq * 30)} className="p-2 px-3 bg-slate-900 text-white rounded-lg font-black text-[11px] cursor-pointer whitespace-nowrap">Oluştur (Ay)</button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h3 className="font-black text-xs uppercase text-slate-700">Denetim Listesi ({audits.length})</h3>
          <div className="flex items-center space-x-2">
            <button onClick={downloadListReport} disabled={downloading} className="p-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-50">
              <Download className="w-3.5 h-3.5" /><span>{downloading ? "İndiriliyor..." : "İndir (XLS)"}</span>
            </button>
            <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="ornek@musteri.com" type="email" className="p-1.5 border border-gray-200 rounded-lg text-xs font-bold w-40" />
            <button onClick={sendListReport} disabled={sending} className="p-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-50">
              <Mail className="w-3.5 h-3.5" /><span>{sending ? "Gönderiliyor..." : "Gönder"}</span>
            </button>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
              <th className="py-1.5">Denetim No</th><th>Tarih</th><th>Durum</th><th>Puan</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...audits].sort((a, b) => a.auditNo - b.auditNo).map(a => (
              <tr key={a.id}>
                <td className="py-2 font-bold">{a.auditNo}</td>
                <td>{a.date}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    a.status === "Tamamlandı" ? "bg-emerald-50 text-emerald-700" : a.status === "Devam Ediyor" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                  }`}>{a.status}</span>
                </td>
                <td>{a.overallScore ?? "-"}</td>
                <td className="text-right">
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Denetim No ${a.auditNo} kalıcı olarak silinecek (ekip ataması, cevaplar ve sonuçlar dahil). Emin misiniz?`)) return;
                      const res = await api.del(`audits/${a.id}`);
                      if (res.success) { showToast(`Denetim No ${a.auditNo} silindi.`); await onReload(); }
                      else showToast(`Hata: ${res.error || "Silinemedi."}`);
                    }}
                    className="text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline" />
                  </button>
                </td>
              </tr>
            ))}
            {audits.length === 0 && <tr><td colSpan={5} className="text-slate-400 py-2">Henüz denetim oluşturulmadı.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function TeamTab({ departments, areas, personnel, audits, teamAssignments, api, showToast, setTeamAssignments }: FiveSAuditWorkflowProps) {
  const openAudits = audits.filter(a => a.status !== "Tamamlandı").sort((a, b) => a.auditNo - b.auditNo);
  const [auditId, setAuditId] = useState(openAudits[0]?.id || "");
  const auditors = personnel.filter(p => p.isAuditor || p.isAdmin);
  const rows = teamAssignments.filter(t => t.auditId === auditId);
  const [draft, setDraft] = useState<Record<string, string>>({});

  React.useEffect(() => {
    const initial: Record<string, string> = {};
    rows.forEach(r => { initial[r.areaId] = r.auditorName; });
    setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId, teamAssignments.length]);

  const save = async () => {
    const assignments = rows.map(r => ({ areaId: r.areaId, auditorName: draft[r.areaId] ?? r.auditorName }));
    const res = await api.post(`audits/${auditId}/team`, { assignments });
    if (res.success) {
      setTeamAssignments(prev => {
        const others = prev.filter(p => p.auditId !== auditId);
        return [...others, ...res.data];
      });
      showToast("Denetim ekibi kaydedildi.");
    } else {
      showToast(`Hata: ${res.error || "Kaydedilemedi."}`);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-xs uppercase text-slate-700">Denetim Ekibi Atama</h3>
        <select value={auditId} onChange={e => setAuditId(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-xs font-bold">
          <option value="">Denetim Seçiniz...</option>
          {openAudits.map(a => <option key={a.id} value={a.id}>Denetim No {a.auditNo} ({a.date})</option>)}
        </select>
      </div>
      {auditId && (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
                <th className="py-1.5">Bölüm</th><th>Alan</th><th>Denetçi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => {
                const area = areas.find(a => a.id === r.areaId);
                const dept = departments.find(d => d.id === area?.departmentId);
                return (
                  <tr key={r.id}>
                    <td className="py-2 font-bold">{dept?.name || "-"}</td>
                    <td>{area?.name || "-"}</td>
                    <td>
                      <select value={draft[r.areaId] ?? ""} onChange={e => setDraft(d => ({ ...d, [r.areaId]: e.target.value }))} className="p-1.5 border border-gray-200 rounded-lg font-bold">
                        <option value="">Atanmadı</option>
                        {auditors.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={3} className="text-slate-400 py-2">Bu denetim için tanımlı alan bulunamadı.</td></tr>}
            </tbody>
          </table>
          <button onClick={save} className="p-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer">
            <Save className="w-3.5 h-3.5" /><span>Ekibi Kaydet</span>
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function ScoreTab({
  currentUser, isFiveSAdmin, departments, areas, questions, audits, teamAssignments, answers, results,
  api, showToast, setAnswers, setResults, setAudits
}: FiveSAuditWorkflowProps) {
  const [auditId, setAuditId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [level, setLevel] = useState<FiveSLevel>("1S");
  const [draftAnswers, setDraftAnswers] = useState<Record<string, { score?: number; comment: string; action: string; dueDate: string | null; photo?: string }>>({});
  const [sessionStarted, setSessionStarted] = useState(false);
  const [saving, setSaving] = useState(false);

  const openAudits = audits.filter(a => a.status !== "Tamamlandı").sort((a, b) => a.auditNo - b.auditNo);

  const myAreaIds = useMemo(() => {
    if (isFiveSAdmin) return null; // null = no restriction
    return new Set(teamAssignments.filter(t => t.auditId === auditId && t.auditorName === currentUser?.full_name).map(t => t.areaId));
  }, [teamAssignments, auditId, isFiveSAdmin, currentUser]);

  const scoreableAreas = areas.filter(a => !myAreaIds || myAreaIds.has(a.id));

  const selectedArea = areas.find(a => a.id === areaId);
  const bankQuestions = selectedArea
    ? questions.filter(q => q.departmentId === selectedArea.departmentId && q.difficultyLevel === selectedArea.difficultyLevel && q.level === level)
    : [];

  const startSession = () => {
    if (!auditId || !areaId) return;
    const initial: typeof draftAnswers = {};
    for (const q of bankQuestions) {
      const existing = answers.find(a => a.auditId === auditId && a.areaId === areaId && a.questionId === q.id);
      initial[q.id] = existing
        ? { score: existing.score, comment: existing.comment, action: existing.action, dueDate: existing.dueDate, photo: existing.photo }
        : { score: undefined, comment: "", action: "", dueDate: null };
    }
    setDraftAnswers(initial);
    setSessionStarted(true);
    if (bankQuestions.length === 0) {
      showToast("Bu alan + zorluk seviyesi + S adımı için tanımlı soru bulunamadı. Kurulum > Soru Listesi'nden ekleyebilirsiniz.");
    }
  };

  const areaResults = results.filter(r => r.auditId === auditId && r.areaId === areaId);

  const save = async () => {
    if (bankQuestions.some(q => draftAnswers[q.id]?.score === undefined)) {
      showToast("Tüm sorular puanlanmadan kaydedilemez.");
      return;
    }
    setSaving(true);
    const payload = bankQuestions.map(q => ({
      questionId: q.id,
      score: draftAnswers[q.id].score,
      comment: draftAnswers[q.id].comment,
      action: draftAnswers[q.id].action,
      dueDate: draftAnswers[q.id].dueDate,
      photo: draftAnswers[q.id].photo
    }));
    const res = await api.post(`audits/${auditId}/areas/${areaId}/save-answers`, { level, answers: payload });
    setSaving(false);
    if (res.success) {
      setAnswers(prev => {
        const others = prev.filter(a => !(a.auditId === auditId && a.areaId === areaId && bankQuestions.some(q => q.id === a.questionId)));
        return [...others, ...res.data.answers];
      });
      setResults(prev => {
        const others = prev.filter(r => r.id !== res.data.result.id);
        return [...others, res.data.result];
      });
      if (res.data.audit) {
        setAudits(prev => prev.map(a => a.id === res.data.audit.id ? res.data.audit : a));
      }
      showToast(`Kaydedildi. ${level} Sonuç: ${res.data.result.score}/5`);
    } else {
      showToast(`Hata: ${res.error || "Kaydedilemedi."}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-black text-xs uppercase text-slate-700">Denetim Seçimi</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <select value={auditId} onChange={e => { setAuditId(e.target.value); setAreaId(""); setDraftAnswers({}); setSessionStarted(false); }} className="p-2 border border-gray-200 rounded-lg font-bold">
              <option value="">Denetim No Seçiniz...</option>
              {openAudits.map(a => <option key={a.id} value={a.id}>Denetim No {a.auditNo} ({a.date})</option>)}
            </select>
            <select value={areaId} onChange={e => { setAreaId(e.target.value); setDraftAnswers({}); setSessionStarted(false); }} disabled={!auditId} className="p-2 border border-gray-200 rounded-lg font-bold disabled:opacity-50">
              <option value="">Alan Seçiniz...</option>
              {scoreableAreas.map(a => <option key={a.id} value={a.id}>{departments.find(d => d.id === a.departmentId)?.name} — {a.name}</option>)}
            </select>
            <select value={level} onChange={e => { setLevel(e.target.value as FiveSLevel); setDraftAnswers({}); setSessionStarted(false); }} className="p-2 border border-gray-200 rounded-lg font-bold">
              {FIVE_S_LEVELS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <button
            disabled={!auditId || !areaId}
            onClick={startSession}
            className="p-2 px-3 bg-slate-900 text-white rounded-lg text-xs font-black cursor-pointer disabled:opacity-40"
          >
            Alan Denetimine Başla
          </button>
        </div>

        {sessionStarted && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <h3 className="font-black text-xs uppercase text-slate-700">{level} — {bankQuestions.length} Soru</h3>
            {bankQuestions.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Bu alan (<strong>{selectedArea?.name}</strong>, Zorluk Seviyesi {selectedArea?.difficultyLevel}) + <strong>{level}</strong> adımı için tanımlı soru bulunamadı.
                Kurulum &gt; Soru Listesi'nden bu bölüm/zorluk/seviye kombinasyonuna uygun soru ekleyebilirsiniz.
              </p>
            )}
            {bankQuestions.map((q, idx) => (
              <div key={q.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold text-slate-700">{idx + 1}. {q.text}</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs items-start">
                  <select
                    value={draftAnswers[q.id]?.score ?? ""}
                    onChange={e => setDraftAnswers(d => ({ ...d, [q.id]: { ...d[q.id], score: Number(e.target.value) } }))}
                    className="p-2 border border-gray-200 rounded-lg font-bold"
                  >
                    <option value="">Puan</option>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <input
                    value={draftAnswers[q.id]?.comment || ""}
                    onChange={e => setDraftAnswers(d => ({ ...d, [q.id]: { ...d[q.id], comment: e.target.value } }))}
                    placeholder="Yorum"
                    className="p-2 border border-gray-200 rounded-lg font-bold md:col-span-2"
                  />
                  <input
                    value={draftAnswers[q.id]?.action || ""}
                    onChange={e => setDraftAnswers(d => ({ ...d, [q.id]: { ...d[q.id], action: e.target.value } }))}
                    placeholder="Aksiyon (varsa)"
                    className="p-2 border border-gray-200 rounded-lg font-bold"
                  />
                  <input
                    type="date"
                    value={draftAnswers[q.id]?.dueDate || ""}
                    onChange={e => setDraftAnswers(d => ({ ...d, [q.id]: { ...d[q.id], dueDate: e.target.value || null } }))}
                    className="p-2 border border-gray-200 rounded-lg font-bold"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer w-fit">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{draftAnswers[q.id]?.photo ? "Fotoğrafı Değiştir" : "Fotoğraf Çek / Yükle"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setDraftAnswers(d => ({ ...d, [q.id]: { ...d[q.id], photo: reader.result as string } }));
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {draftAnswers[q.id]?.photo && (
                    <div className="relative">
                      <img src={draftAnswers[q.id].photo} alt="Kanıt" className="h-14 rounded-lg border border-gray-200" />
                      <button
                        onClick={() => setDraftAnswers(d => ({ ...d, [q.id]: { ...d[q.id], photo: undefined } }))}
                        className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 cursor-pointer"
                        title="Fotoğrafı Kaldır"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {bankQuestions.length > 0 && (
              <button onClick={save} disabled={saving} className="p-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /><span>{saving ? "Kaydediliyor..." : "Alan Denetimini Kaydet"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 h-fit">
        <h3 className="font-black text-xs uppercase text-slate-700">Alan Durumu</h3>
        {!areaId && <p className="text-xs text-slate-400">Bir alan seçin.</p>}
        {areaId && FIVE_S_LEVELS.map(l => {
          const r = areaResults.find(x => x.level === l.code);
          return (
            <div key={l.code} className="flex items-center justify-between text-xs border-b border-gray-50 py-1.5">
              <span className="font-bold text-slate-600">{l.code}</span>
              <span className="text-slate-400">{r ? `${r.score}/5` : "—"}</span>
              {r && <TrendIcon trend={scoreTrend(r.score, r.previousScore)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function CompleteTab({ areas, departments, audits, teamAssignments, results, api, showToast, setAudits }: FiveSAuditWorkflowProps) {
  const fiveSAudits = audits.slice().sort((a, b) => b.auditNo - a.auditNo);
  const [auditId, setAuditId] = useState(fiveSAudits[0]?.id || "");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const audit = audits.find(a => a.id === auditId);

  const areaRows = teamAssignments
    .filter(t => t.auditId === auditId)
    .map(t => t.areaId)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map(areaIdVal => {
      const area = areas.find(a => a.id === areaIdVal);
      const dept = departments.find(d => d.id === area?.departmentId);
      const areaResults = results.filter(r => r.auditId === auditId && r.areaId === areaIdVal);
      const n = areaResults.length;
      const tp = n > 0 ? Math.round((areaResults.reduce((s, r) => s + r.score, 0) / n) * 100) / 100 : 0;
      const priorScores = areaResults.filter(r => r.previousScore !== null).map(r => r.previousScore as number);
      const op = priorScores.length > 0 ? Math.round((priorScores.reduce((s, v) => s + v, 0) / priorScores.length) * 100) / 100 : null;
      const completion = Math.round((n / 5) * 100);
      return { areaId: areaIdVal, areaName: area?.name || "-", deptName: dept?.name || "-", n, tp, op, completion };
    });

  const allComplete = areaRows.length > 0 && areaRows.every(r => r.completion === 100);
  const canComplete = allComplete && audit?.status !== "Tamamlandı";

  const complete = async () => {
    if (!window.confirm(`Denetim No ${audit?.auditNo} tamamlanacaktır. Bu işlem geri alınamaz. Emin misiniz?`)) return;
    const res = await api.post(`audits/${auditId}/complete`, {});
    if (res.success) {
      setAudits(prev => prev.map(a => a.id === res.data.id ? res.data : a));
      showToast(`Denetim No ${audit?.auditNo} tamamlandı. Genel Puan: ${res.data.overallScore}/5`);
    } else {
      showToast(`Hata: ${res.error || "Denetim tamamlanamadı."}`);
    }
  };

  const sendReport = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      showToast("Lütfen geçerli bir alıcı e-posta adresi girin.");
      return;
    }
    setSending(true);
    const res = await api.post(`audits/${auditId}/send-report`, { recipientEmail });
    setSending(false);
    if (res.success) showToast(`Rapor ${recipientEmail} adresine gönderildi.`);
    else showToast(`Hata: ${res.error || "Rapor gönderilemedi."}`);
  };

  const [downloading, setDownloading] = useState(false);
  const downloadReport = async () => {
    setDownloading(true);
    const res = await api.download(`audits/${auditId}/report.xlsx`);
    setDownloading(false);
    if (!res.success) showToast(`Hata: ${res.error || "Rapor indirilemedi."}`);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-black text-xs uppercase text-slate-700">Denetim Özeti</h3>
        <select value={auditId} onChange={e => setAuditId(e.target.value)} className="p-2 border border-gray-200 rounded-lg text-xs font-bold">
          <option value="">Denetim Seçiniz...</option>
          {fiveSAudits.map(a => <option key={a.id} value={a.id}>Denetim No {a.auditNo} ({a.status})</option>)}
        </select>
      </div>

      {auditId && (
        <>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 uppercase text-[10px] border-b">
                <th className="py-1.5">Bölüm</th><th>Alan</th><th>Tamamlanma</th><th>Toplam Puan</th><th>Önceki Denetim Puanı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {areaRows.map(r => (
                <tr key={r.areaId}>
                  <td className="py-2 font-bold">{r.deptName}</td>
                  <td>{r.areaName}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${r.completion === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>%{r.completion}</span>
                  </td>
                  <td>{r.n > 0 ? r.tp : "-"}</td>
                  <td>{r.op ?? "-"}</td>
                </tr>
              ))}
              {areaRows.length === 0 && <tr><td colSpan={5} className="text-slate-400 py-2">Bu denetim için atanmış alan bulunamadı.</td></tr>}
            </tbody>
          </table>

          {audit?.status !== "Tamamlandı" ? (
            <button onClick={complete} disabled={!canComplete} className="p-2 px-3 bg-slate-900 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-40">
              <CheckCircle2 className="w-3.5 h-3.5" /><span>Denetimi Tamamla{!allComplete && " (tüm alanlar %100 olmalı)"}</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2 pt-2 border-t border-gray-100 flex-wrap gap-y-2">
              <p className="text-xs font-black text-emerald-700">Tamamlandı — Genel Puan: {audit.overallScore}/5</p>
              <button onClick={downloadReport} disabled={downloading} className="p-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-50">
                <Download className="w-3.5 h-3.5" /><span>{downloading ? "İndiriliyor..." : "İndir (XLS)"}</span>
              </button>
              <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="ornek@musteri.com" type="email" className="p-1.5 border border-gray-200 rounded-lg text-xs font-bold flex-1 max-w-xs" />
              <button onClick={sendReport} disabled={sending} className="p-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center space-x-1.5 cursor-pointer disabled:opacity-50">
                <Mail className="w-3.5 h-3.5" /><span>{sending ? "Gönderiliyor..." : "Rapor Gönder"}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
