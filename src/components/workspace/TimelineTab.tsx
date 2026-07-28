import React, { useState } from "react";
import { CompanyWorkspaceExtended, TimelineMilestone } from "../../types/workspace";
import { Plus, Calendar, Tag, Check, Trash2, Clock } from "lucide-react";

interface TimelineTabProps {
  workspace: CompanyWorkspaceExtended;
  onUpdateTimeline: (timeline: TimelineMilestone[]) => void;
}

export default function TimelineTab({ workspace, onUpdateTimeline }: TimelineTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [type, setType] = useState<TimelineMilestone["type"]>("workshop");
  const [description, setDescription] = useState("");
  const [operator, setOperator] = useState("");

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    const newMilestone: TimelineMilestone = {
      id: "milestone_" + Math.random().toString(36).substring(2, 9),
      date,
      title,
      type,
      description,
      operator: operator || undefined,
    };

    const updated = [...workspace.timeline, newMilestone].sort((a, b) => b.date.localeCompare(a.date));
    onUpdateTimeline(updated);

    // Reset Form
    setTitle("");
    setDate(new Date().toISOString().split("T")[0]);
    setDescription("");
    setOperator("");
    setShowForm(false);
  };

  const handleDeleteMilestone = (id: string) => {
    onUpdateTimeline(workspace.timeline.filter((t) => t.id !== id));
  };

  const getMilestoneColorClass = (t: TimelineMilestone["type"]) => {
    switch (t) {
      case "creation":
        return "bg-slate-900 border-slate-900 text-white";
      case "audit":
        return "bg-zinc-800 border-zinc-800 text-white";
      case "analysis":
        return "bg-zinc-700 border-zinc-700 text-white";
      case "ai_report":
        return "bg-zinc-950 border-zinc-950 text-white";
      default:
        return "bg-gray-100 border-gray-300 text-gray-700";
    }
  };

  return (
    <div className="space-y-6" id="timeline-module">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tarihsel Yol Haritası & Gemba Geçmişi (Project History)</h4>
          <p className="text-[10px] text-gray-500 mt-1">Bu firmada yapılan denetimler, zaman etütleri, AI analizleri ve tüm OpEx aktiviteleri.</p>
        </div>
        {!showForm && (
          <button
            id="btn-add-timeline-trigger"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Yeni Olay Ekle
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAddMilestone} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4 shadow-xs" id="timeline-form">
          <h4 className="font-semibold text-gray-900 text-xs">Yeni Gemba Yol Haritası Gelişmesi Ekle</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Gelişme Başlığı</label>
              <input
                id="input-timeline-title"
                type="text"
                required
                placeholder="Örn: 5S Eğitimi Tamamlandı"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Gelişme Tarihi</label>
              <input
                id="input-timeline-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Olay Türü / Etiketi</label>
              <select
                id="select-timeline-type"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-hidden"
              >
                <option value="workshop">Workshop (Yalın Kaizen Atölyesi)</option>
                <option value="audit">Audit (Gözlem & Sahanlık Denetimi)</option>
                <option value="analysis">Analysis (Zaman Etüdü / Akış Analizi)</option>
                <option value="ai_report">AI Report (Yapay Zeka Analiz Raporu)</option>
                <option value="creation">Creation (Firma Tescil/Başlangıç)</option>
                <option value="other">Other (Diğer Sürdürülebilir Çalışma)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Gerçekleştiren Danışman / Operatör</label>
              <input
                id="input-timeline-operator"
                type="text"
                placeholder="Örn: Barış Gökdemir"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Detaylı Gelişme Açıklaması</label>
              <textarea
                id="input-timeline-description"
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              id="btn-timeline-cancel"
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              id="btn-timeline-save"
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-950 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Gelişmeyi Kaydet
            </button>
          </div>
        </form>
      )}

      {/* Chronological Vertical Timeline UI */}
      <div className="relative pl-6 border-l border-gray-100 space-y-6 ml-4 py-2" id="timeline-list">
        {workspace.timeline.map((milestone) => (
          <div key={milestone.id} className="relative group">
            {/* Timeline dot */}
            <div className={`absolute -left-[31px] top-1 w-4.5 h-4.5 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${getMilestoneColorClass(milestone.type)}`}>
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-4.5 hover:shadow-2xs transition-shadow relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <h5 className="font-semibold text-gray-900 text-xs">{milestone.title}</h5>
                  <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md font-mono uppercase font-bold">
                    {milestone.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {milestone.date}
                  </span>
                  {milestone.operator && (
                    <span className="bg-zinc-50 px-2 py-0.5 rounded border border-zinc-100 font-semibold text-zinc-600">
                      Danışman: {milestone.operator}
                    </span>
                  )}
                  <button
                    id={`btn-delete-timeline-${milestone.id}`}
                    onClick={() => handleDeleteMilestone(milestone.id)}
                    className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed font-normal">{milestone.description}</p>
            </div>
          </div>
        ))}

        {workspace.timeline.length === 0 && (
          <div className="text-center py-12 bg-white border border-dashed border-gray-100 rounded-xl">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">Bu firma için henüz bir gemba geçmiş kaydı bulunmamaktadır.</p>
          </div>
        )}
      </div>
    </div>
  );
}
