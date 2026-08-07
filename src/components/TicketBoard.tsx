import React, { useState, useEffect } from "react";
import { Ticket as TicketIcon, PlusCircle, Trash2 } from "lucide-react";

interface TicketBoardProps {
  token: string;
  currentUser: any;
}

const MODULE_OPTIONS = [
  "Müşteri Kartı / Workspace",
  "Yönetici Dashboard",
  "OpEx Assessment",
  "Proje Master Plan",
  "VSM Kapasite Analizi",
  "Loss Capacity Analizi",
  "Kaizen Yönetimi",
  "Spaghetti Akış Sketcher",
  "Time Study",
  "Hat Dengeleme & Yamazumi",
  "SMED Analizi",
  "Proje Takip Raporu",
  "5S Olgunluk Auditler",
  "Platform Admin / Sistem Ayarları",
  "Diğer / Genel"
];

const STATUS_OPTIONS = ["Devam Ediyor", "Yapıldı", "İptal"];

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function TicketBoard({ token, currentUser }: TicketBoardProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [module, setModule] = useState(MODULE_OPTIONS[0]);
  const [subject, setSubject] = useState("");
  const [reportDate, setReportDate] = useState(todayIso());
  const [isSaving, setIsSaving] = useState(false);

  const fetchTickets = () => {
    setIsLoading(true);
    fetch("/api/business/tickets", { headers: { "Authorization": `Bearer ${token}` } })
      .then(res => res.json())
      .then(res => {
        if (res.success) setTickets(res.data || []);
        else setError(res.error || "Kayıtlar alınamadı.");
      })
      .catch(() => setError("Bağlantı hatası oluştu."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchTickets(); }, [token]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    setIsSaving(true);
    fetch("/api/business/tickets", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ module, subject: subject.trim(), reportDate, status: "Devam Ediyor" })
    })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setTickets(prev => [...prev, res.data]);
          setSubject("");
          setReportDate(todayIso());
        } else {
          setError(res.error || "Kayıt eklenemedi.");
        }
      })
      .catch(() => setError("Bağlantı hatası oluştu."))
      .finally(() => setIsSaving(false));
  };

  const handleStatusChange = (ticket: any, status: string) => {
    const updated = { ...ticket, status };
    setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
    fetch("/api/business/tickets", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    }).catch(() => setError("Durum güncellenemedi."));
  };

  const handleDelete = (id: string) => {
    setTickets(prev => prev.filter(t => t.id !== id));
    fetch(`/api/business/tickets/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    }).catch(() => setError("Kayıt silinemedi."));
  };

  const statusBadgeClass = (status: string) =>
    status === "Yapıldı" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : status === "İptal" ? "bg-slate-100 text-slate-500 border-slate-200"
    : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
          <TicketIcon className="w-4 h-4 text-slate-600" />
          <span>Yeni Şikayet / İyileştirme Kaydı</span>
        </h4>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-end">
          <div className="md:col-span-1">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">İyileşilmesi Gereken Modül</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
            >
              {MODULE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">İyileştirme Konusu / Şikayet</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Karşılaştığınız sorunu veya iyileştirme önerisini yazın..."
              className="w-full text-xs p-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="md:col-span-1 flex items-end space-x-2">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Bildirim Tarihi</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white font-bold p-2 rounded-lg disabled:opacity-50"
              title="Kaydı Ekle"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl font-medium text-xs">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2 px-3">No</th>
                <th className="py-2 px-3">Modül</th>
                <th className="py-2 px-3">İyileştirme Konusu</th>
                <th className="py-2 px-3">Bildiren</th>
                <th className="py-2 px-3">Bildirim Tarihi</th>
                <th className="py-2 px-3">Durum</th>
                <th className="py-2 px-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Yükleniyor…</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Henüz kayıt yok.</td></tr>
              ) : (
                tickets.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{String(t.orderNo).padStart(2, "0")}</td>
                    <td className="py-2.5 px-3">
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">{t.module}</span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 max-w-md">{t.subject}</td>
                    <td className="py-2.5 px-3 text-slate-500">{t.reportedBy || "—"}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{t.reportDate || "—"}</td>
                    <td className="py-2.5 px-3">
                      <select
                        value={t.status}
                        onChange={(e) => handleStatusChange(t, e.target.value)}
                        className={`text-[10.5px] font-bold uppercase rounded-full border px-2 py-0.5 ${statusBadgeClass(t.status)}`}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {(currentUser?.role === "Admin" || t.created_by === currentUser?.id) && (
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
