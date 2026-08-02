import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, GripVertical, AlertCircle, RefreshCw, Check, X } from "lucide-react";
import { ActivityItem } from "./smedTypes";
import { calculateDurationFromTimes } from "./smedDefaults";

interface ActivityListTabProps {
  activities: ActivityItem[];
  onChangeActivities: (newActivities: ActivityItem[]) => void;
}

export default function ActivityListTab({ activities, onChangeActivities }: ActivityListTabProps) {
  // Form State
  const [seqNo, setSeqNo] = useState<number>(activities.length + 1);
  const [actName, setActName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dur, setDur] = useState<number>(0);
  const [actType, setActType] = useState<"internal" | "external">("internal");
  const [operatorCount, setOperatorCount] = useState<number>(1);
  const [operator, setOperator] = useState("Op.1");
  const [category, setCategory] = useState("Hazırlık");
  const [waste, setWaste] = useState("—");
  const [opportunity, setOpportunity] = useState("⭐⭐");

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);

  // Auto calculate duration when startTime or endTime change
  useEffect(() => {
    if (startTime && endTime) {
      const calculated = calculateDurationFromTimes(startTime, endTime);
      setDur(calculated);
    }
  }, [startTime, endTime]);

  // Handle sequence defaults
  useEffect(() => {
    if (editingId === null) {
      setSeqNo(activities.length + 1);
    }
  }, [activities, editingId]);

  // Derived KPIs
  const totalDuration = useMemo(() => activities.reduce((sum, a) => sum + a.dur, 0), [activities]);
  const internalDuration = useMemo(() => activities.filter((a) => a.type === "internal").reduce((sum, a) => sum + a.dur, 0), [activities]);
  const externalDuration = useMemo(() => activities.filter((a) => a.type === "external").reduce((sum, a) => sum + a.dur, 0), [activities]);

  const internalPercent = useMemo(() => (totalDuration > 0 ? Math.round((internalDuration / totalDuration) * 100) : 0), [internalDuration, totalDuration]);
  const externalPercent = useMemo(() => (totalDuration > 0 ? Math.round((externalDuration / totalDuration) * 100) : 0), [externalDuration, totalDuration]);

  // Submit add or edit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actName.trim()) return;

    const computedDur = startTime && endTime ? calculateDurationFromTimes(startTime, endTime) : (dur || 0);

    if (editingId !== null) {
      // Edit mode
      const updated = activities.map((a) => {
        if (a.id === editingId) {
          return {
            ...a,
            sequence: seqNo,
            name: actName,
            startTime,
            endTime,
            dur: computedDur,
            type: actType,
            operatorCount,
            operator,
            category,
            waste,
            opportunity,
          };
        }
        return a;
      });
      // Sort updated activities by sequence
      updated.sort((a, b) => a.sequence - b.sequence);
      onChangeActivities(updated);
      resetForm();
    } else {
      // Create mode
      const newItem: ActivityItem = {
        id: Date.now(),
        sequence: seqNo,
        name: actName,
        startTime,
        endTime,
        dur: computedDur,
        type: actType,
        originalType: actType,
        operatorCount,
        operator,
        category,
        waste,
        opportunity,
        ecrsSteps: [],
        ecrsGains: {},
      };
      const newList = [...activities, newItem].sort((a, b) => a.sequence - b.sequence);
      onChangeActivities(newList);
      resetForm();
    }
  };

  const handleRowClick = (act: ActivityItem) => {
    setEditingId(act.id);
    setSeqNo(act.sequence);
    setActName(act.name);
    setStartTime(act.startTime || "");
    setEndTime(act.endTime || "");
    setDur(act.dur);
    setActType(act.type);
    setOperatorCount(act.operatorCount || 1);
    setOperator(act.operator);
    setCategory(act.category);
    setWaste(act.waste || "—");
    setOpportunity(act.opportunity || "—");
  };

  const resetForm = () => {
    setEditingId(null);
    setActName("");
    setStartTime("");
    setEndTime("");
    setDur(0);
    setActType("internal");
    setOperatorCount(1);
    setOperator("Op.1");
    setCategory("Hazırlık");
    setWaste("—");
    setOpportunity("⭐⭐");
    setSeqNo(activities.length + 1);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeActivities(activities.filter((a) => a.id !== id));
    if (editingId === id) {
      resetForm();
    }
  };

  const toggleType = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeActivities(
      activities.map((a) => {
        if (a.id === id) {
          const newT = a.type === "internal" ? "external" : "internal";
          return { ...a, type: newT };
        }
        return a;
      })
    );
  };

  // Drag and drop sorting
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...activities];
    const draggedItem = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);

    // re-assign sequences after dragging to match array order
    const sequenced = updated.map((item, idx) => ({
      ...item,
      sequence: idx + 1,
    }));

    setDraggedIndex(index);
    onChangeActivities(sequenced);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-6">
      {/* Upper KPI Area */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">İşlem Sayısı</span>
          <div className="text-xl font-extrabold text-slate-800 mt-1">{activities.length} Adet</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <span className="text-[10px] text-blue-800 font-black block uppercase tracking-wider">Setup Süresi</span>
          <div className="text-xl font-extrabold text-blue-600 mt-1">{totalDuration} dk</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <span className="text-[10px] text-red-800 font-black block uppercase tracking-wider">İç Hazırlık</span>
          <div className="text-xl font-extrabold text-red-600 mt-1">{internalDuration} dk</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <span className="text-[10px] text-emerald-800 font-black block uppercase tracking-wider">Dış Hazırlık</span>
          <div className="text-xl font-extrabold text-emerald-600 mt-1">{externalDuration} dk</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">İç Hazırlık %</span>
          <div className="text-xl font-extrabold text-slate-800 mt-1">%{internalPercent}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <span className="text-[10px] text-slate-450 font-black block uppercase tracking-wider">Dış Hazırlık %</span>
          <div className="text-xl font-extrabold text-slate-800 mt-1">%{externalPercent}</div>
        </div>
      </div>

      {/* Observation Steps Input / Edit Panel */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h4 className="text-xs font-black text-slate-800 uppercase flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse" />
            <span>{editingId !== null ? "Gözlem Adımını Düzenle" : "Yeni Gözlem Adımı Ekle"}</span>
          </h4>
          {editingId !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-black text-red-500 hover:underline flex items-center space-x-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Düzenlemeyi İptal Et</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Sıra No</label>
            <input
              type="number"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-slate-50"
              value={seqNo}
              onChange={(e) => setSeqNo(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="lg:col-span-3">
            <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Gözlenen İşlem Adımı</label>
            <input
              type="text"
              required
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              placeholder="örn: Civataların sökülmesi, vinç hazırlığı"
              value={actName}
              onChange={(e) => setActName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Başlangıç Saati</label>
            <input
              type="text"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              placeholder="örn: 15:30"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Bitiş Saati</label>
            <input
              type="text"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              placeholder="örn: 15:38"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Süre (Dakika)</label>
            <div className="relative">
              <input
                type="number"
                className={`w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 ${
                  startTime && endTime ? "bg-slate-100 text-slate-500" : ""
                }`}
                placeholder="Örn: 8"
                value={dur || ""}
                onChange={(e) => setDur(parseFloat(e.target.value) || 0)}
                disabled={!!(startTime && endTime)}
              />
              {startTime && endTime && (
                <span className="absolute right-2 top-2 text-[11px] bg-green-100 text-green-800 font-extrabold px-1 py-0.5 rounded">
                  Oto Hesap
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Operatör / Setter Sayısı</label>
            <input
              type="number"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              value={operatorCount}
              onChange={(e) => setOperatorCount(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Operatör Tanımı</label>
            <input
              type="text"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              placeholder="Op.1, Setter A"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">Faaliyet Kategorisi</label>
            <select
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Hazırlık">Hazırlık</option>
              <option value="Sökme">Sökme</option>
              <option value="Taşıma">Taşıma</option>
              <option value="Temizlik">Temizlik</option>
              <option value="Kurulum">Kurulum</option>
              <option value="Ayarlama">Ayarlama</option>
              <option value="Doğrulama">Doğrulama</option>
              <option value="Deneme">Deneme</option>
              <option value="İlk Parça Onayı">İlk Parça Onayı</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <div>
            {editingId !== null && (
              <button
                type="button"
                onClick={() => {
                  if (editingId) {
                    onChangeActivities(activities.filter((a) => a.id !== editingId));
                    resetForm();
                  }
                }}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>İşlemi Sil</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-650 hover:bg-slate-50 cursor-pointer"
              >
                Temizle
              </button>
            )}
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 px-6 rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              {editingId !== null ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingId !== null ? "Adımı Güncelle" : "Yeni Gözlem Ekle"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Activities Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
        <table className="w-full text-left border-collapse text-xs text-slate-800">
          <thead className="bg-slate-50 text-slate-500 font-extrabold border-b border-slate-200 uppercase tracking-wider">
            <tr>
              <th className="p-3 w-10 text-center">#</th>
              <th className="p-3 w-12 text-center">Sırala</th>
              <th className="p-3">Gözlenen İşlem Adımı</th>
              <th className="p-3 text-center">Başlangıç Saati</th>
              <th className="p-3 text-center">Bitiş Saati</th>
              <th className="p-3 text-center">Süre (dk)</th>
              <th className="p-3 text-center">İşlem Tipi</th>
              <th className="p-3 text-center">Operatör / Setter</th>
              <th className="p-3">Faaliyet Kategorisi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {activities.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-450 font-bold">
                  Henüz gözlem adımı eklenmemiş. Üstteki formdan yeni adımlar ekleyebilirsiniz.
                </td>
              </tr>
            ) : (
              activities.map((act, idx) => (
                <tr
                  key={act.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleRowClick(act)}
                  className={`cursor-pointer hover:bg-slate-50/70 transition-all duration-150 ${
                    draggedIndex === idx ? "opacity-30 bg-blue-50/50" : ""
                  } ${editingId === act.id ? "bg-blue-50/40 border-l-4 border-blue-500" : ""}`}
                >
                  <td className="p-3 text-center text-slate-400 font-black">{act.sequence || idx + 1}</td>
                  <td
                    className="p-3 text-center text-slate-400 cursor-grab active:cursor-grabbing select-none"
                    title="Satırı taşımak için sürükleyin"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="w-4 h-4 mx-auto text-slate-400 hover:text-slate-600 transition-colors" />
                  </td>
                  <td className="p-3 font-semibold text-slate-900">
                    <div className="flex flex-col">
                      <span>{act.name}</span>
                      {act.ecrsSteps && act.ecrsSteps.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {act.ecrsSteps.map((step) => (
                            <span key={step} className="text-[11px] bg-purple-100 text-purple-800 px-1 py-0.2 rounded font-black">
                              ECRS: {step === "E" ? "Eleme" : step === "C" ? "Birleştirme" : step === "R" ? "Yeniden Düzenleme" : "Basitleştirme"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-slate-600">{act.startTime || "—"}</td>
                  <td className="p-3 text-center font-mono font-bold text-slate-600">{act.endTime || "—"}</td>
                  <td className="p-3 text-center font-black font-mono text-slate-800">{act.dur} dk</td>
                  <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => toggleType(act.id, e)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer border select-none ${
                        act.type === "internal"
                          ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {act.type === "internal" ? "İç Hazırlık" : "Dış Hazırlık"}
                    </button>
                  </td>
                  <td className="p-3 text-center font-medium text-slate-600">
                    {act.operator} {act.operatorCount ? `(${act.operatorCount} Setter)` : ""}
                  </td>
                  <td className="p-3">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                      {act.category}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dynamic Recommendation Card */}
      {activities.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <div className="font-extrabold uppercase">SMED Optimizasyon Tavsiyesi:</div>
            <p className="leading-relaxed font-semibold">
              Kalıp değişim gözlemlerine göre makine kapalıyken yapılan hazırlık, taşıma ve temizlik adımları 
              <strong className="text-amber-950 font-black"> Dış Hazırlık (External Setup)</strong> olarak planlanmalıdır. 
              Örneğin forklift ile malzeme getirme veya kalıp yüzeyini silme gibi adımları makine çalışırken 
              yaparak setup süresinde anında büyük oranda kısalma sağlayabilirsiniz.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
