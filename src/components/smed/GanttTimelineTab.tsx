import React, { useState, useMemo } from "react";
import { 
  ZoomIn, 
  ZoomOut, 
  Check, 
  ChevronRight, 
  X, 
  AlertCircle, 
  Trash2, 
  Sliders, 
  Clock, 
  Sparkles, 
  Maximize2, 
  Minimize2,
  Plus
} from "lucide-react";
import { ActivityItem } from "./smedTypes";

interface GanttTimelineTabProps {
  activities: ActivityItem[];
  onChangeActivities: (newActivities: ActivityItem[]) => void;
}

export default function GanttTimelineTab({ activities, onChangeActivities }: GanttTimelineTabProps) {
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [viewMode, setViewMode] = useState<"current" | "improved">("current");
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // ECRS Gain helper
  const getEcrsGain = (a: ActivityItem): number => {
    if (!a.ecrsGains) return 0;
    return (a.ecrsGains.E || 0) + (a.ecrsGains.C || 0) + (a.ecrsGains.R || 0) + (a.ecrsGains.S || 0);
  };

  // 1. Calculations - CURRENT VIEW
  const totalDuration = useMemo(() => activities.reduce((sum, a) => sum + a.dur, 0), [activities]);

  const currentMappedActivities = useMemo(() => {
    let currentMinute = 0;
    return activities.map((act) => {
      const startMin = currentMinute;
      const endMin = currentMinute + act.dur;
      currentMinute = endMin;
      return {
        ...act,
        startMin,
        endMin,
      };
    });
  }, [activities]);

  // 2. Calculations - IMPROVED VIEW (Single continuous timeline with External first, then Internal)
  const externalActivities = useMemo(() => activities.filter((a) => a.type === "external"), [activities]);
  const internalActivities = useMemo(() => activities.filter((a) => a.type === "internal"), [activities]);

  const totalExternalDur = useMemo(() => {
    return externalActivities.reduce((sum, act) => sum + Math.max(0, act.dur - getEcrsGain(act)), 0);
  }, [externalActivities]);

  const totalInternalDur = useMemo(() => {
    return internalActivities.reduce((sum, act) => sum + Math.max(0, act.dur - getEcrsGain(act)), 0);
  }, [internalActivities]);

  const mappedImprovedActivities = useMemo(() => {
    let currentMinute = 0;
    const ordered = [...externalActivities, ...internalActivities];
    return ordered.map((act) => {
      const dur = Math.max(0, act.dur - getEcrsGain(act));
      const startMin = currentMinute;
      const endMin = currentMinute + dur;
      currentMinute = endMin;
      return {
        ...act,
        improvedDur: dur,
        startMin,
        endMin,
      };
    });
  }, [externalActivities, internalActivities]);

  // Total Max Grid Duration based on active view mode
  const gridMaxDuration = useMemo(() => {
    if (viewMode === "current") {
      return totalDuration;
    } else {
      return Math.max(totalExternalDur + totalInternalDur, 5);
    }
  }, [viewMode, totalDuration, totalExternalDur, totalInternalDur]);

  // Zoom scale mapping
  const pxPerMin = 20 * zoomLevel;
  const ganttWidth = gridMaxDuration * pxPerMin;

  // Selected Activity reference
  const selectedActivity = useMemo(() => {
    return activities.find((a) => a.id === selectedActivityId);
  }, [activities, selectedActivityId]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev * 1.2, 4.0));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev / 1.2, 0.4));
  };

  // Field updater
  const updateActivityField = <K extends keyof ActivityItem>(key: K, value: ActivityItem[K]) => {
    const updated = activities.map((a) => {
      if (a.id === selectedActivityId) {
        return { ...a, [key]: value };
      }
      return a;
    });
    onChangeActivities(updated);
  };

  // ECRS data updater
  const updateEcrsStepData = (
    step: "E" | "C" | "R" | "S",
    enabled: boolean,
    gainVal?: number,
    descVal?: string
  ) => {
    const updated = activities.map((a) => {
      if (a.id === selectedActivityId) {
        const currentSteps = a.ecrsSteps || [];
        let nextSteps = [...currentSteps];
        if (enabled) {
          if (!nextSteps.includes(step)) nextSteps.push(step);
        } else {
          nextSteps = nextSteps.filter((s) => s !== step);
        }

        const currentGains = a.ecrsGains || {};
        const nextGains = { ...currentGains };
        if (enabled) {
          if (gainVal !== undefined) {
            nextGains[step] = gainVal;
          } else if (nextGains[step] === undefined) {
            nextGains[step] = Math.min(2, a.dur);
          }
        } else {
          delete nextGains[step];
        }

        const currentDescs = a.ecrsDescriptions || {};
        const nextDescs = { ...currentDescs };
        if (enabled) {
          if (descVal !== undefined) {
            nextDescs[step] = descVal;
          }
        } else {
          delete nextDescs[step];
        }

        const totalGain = Object.keys(nextGains).reduce(
          (sum, k) => sum + (nextGains[k as keyof typeof nextGains] || 0),
          0
        );

        return {
          ...a,
          ecrsSteps: nextSteps,
          ecrsGains: nextGains,
          ecrsDescriptions: nextDescs,
          ecrsGain: Math.min(totalGain, a.dur),
        };
      }
      return a;
    });
    onChangeActivities(updated);
  };

  // Grid tick interval calculation
  const ticks = useMemo(() => {
    const baseInterval =
      gridMaxDuration < 15 ? 0.5 : gridMaxDuration <= 60 ? 1 : gridMaxDuration <= 120 ? 2 : 5;
    const list = [];
    const tickCount = Math.ceil(gridMaxDuration / baseInterval);
    for (let i = 0; i <= tickCount; i++) {
      const val = i * baseInterval;
      if (val <= gridMaxDuration) {
        list.push(val);
      }
    }
    return list;
  }, [gridMaxDuration]);

  const formatTickLabel = (min: number) => {
    if (min % 1 === 0) return `${min} dk`;
    const seconds = Math.round((min % 1) * 60);
    return `${Math.floor(min)} dk ${seconds} sn`;
  };

  // Reusable Gantt Chart Content
  const renderGanttChart = () => (
    <div className="flex-1 overflow-auto relative border border-slate-150 rounded-xl bg-slate-50/50">
      <div className="p-5 relative" style={{ minWidth: `${ganttWidth + 240}px` }}>
        {/* Horizontal Grid Header */}
        <div className="relative h-10 border-b border-slate-200 mb-4 bg-white/80 rounded-t-lg shadow-2xs">
          {ticks.map((tick) => {
            const leftOffset = tick * pxPerMin;
            return (
              <div
                key={tick}
                className="absolute top-0 bottom-0 border-l border-slate-200/70"
                style={{ left: `${leftOffset + 200}px` }}
              >
                <span className="absolute left-1.5 top-1.5 text-[8px] font-black text-slate-400 whitespace-nowrap font-mono uppercase tracking-wider">
                  {formatTickLabel(tick)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Vertical Red Intersection Line for Improved View */}
        {viewMode === "improved" && totalExternalDur > 0 && (
          <div
            className="absolute top-5 bottom-5 z-20 pointer-events-none flex flex-col items-center"
            style={{ left: `${totalExternalDur * pxPerMin + 200}px` }}
          >
            <div className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase tracking-wider -translate-x-1/2 -translate-y-3 whitespace-nowrap z-30">
              MAKİNE DURDURULDU 🛑 {totalExternalDur}. dk
            </div>
            <div className="h-full border-l-2 border-dashed border-red-600" />
          </div>
        )}

        {viewMode === "current" ? (
          /* ================= MEVCUT ANALİZ (SEQUENTIAL TIMELINE) ================= */
          <div className="space-y-6">
            {/* Total Duration Track */}
            <div className="flex items-center h-10 relative">
              <div className="w-[200px] text-[10px] font-black text-blue-800 uppercase pr-4 shrink-0 truncate flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 animate-pulse" />
                <span>TOPLAM SETUP SÜRESİ</span>
              </div>
              <div className="relative flex-1 h-full flex items-center">
                <div
                  className="h-7 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md flex items-center px-4 text-white text-[10px] font-black transition-all cursor-default"
                  style={{ width: `${ganttWidth}px` }}
                >
                  <span className="truncate">Mevcut Çevrim: {totalDuration} Dakika (Makine Duruşu)</span>
                </div>
              </div>
            </div>

            {/* Individual Operation Rows */}
            <div className="space-y-3 relative border-t border-slate-200 pt-4">
              {currentMappedActivities.map((act) => {
                const leftOffset = act.startMin * pxPerMin;
                const width = act.dur * pxPerMin;
                const isSelected = act.id === selectedActivityId;

                // Internal (Red/Rose), External (Emerald/Green)
                const barColorClass =
                  act.type === "internal"
                    ? "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 border border-red-300 shadow-sm"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border border-emerald-300 shadow-sm";

                return (
                  <div key={act.id} className="flex items-center h-8 group relative">
                    {/* Step label on left */}
                    <button
                      onClick={() => setSelectedActivityId(act.id)}
                      className={`w-[200px] text-[11px] font-black text-left pr-4 shrink-0 truncate transition text-slate-700 hover:text-slate-900 cursor-pointer ${
                        isSelected ? "text-blue-650 font-black" : ""
                      }`}
                    >
                      {act.sequence}. {act.name}
                    </button>

                    {/* Timeline Track */}
                    <div className="relative flex-1 h-full flex items-center">
                      {/* Grid line backdrop */}
                      {ticks.map((tick) => {
                        const tickLeft = tick * pxPerMin;
                        return (
                          <div
                            key={`grid-${tick}`}
                            className="absolute top-0 bottom-0 border-l border-slate-200/30 pointer-events-none"
                            style={{ left: `${tickLeft}px` }}
                          />
                        );
                      })}

                      {/* Bar */}
                      <button
                        onClick={() => setSelectedActivityId(act.id)}
                        className={`h-6.5 rounded-lg flex items-center justify-between px-2.5 cursor-pointer transition-all ${barColorClass} ${
                          isSelected ? "ring-3 ring-blue-500 ring-offset-1 scale-[1.01]" : ""
                        }`}
                        style={{
                          left: `${leftOffset}px`,
                          width: `${Math.max(width, 24)}px`,
                          position: "absolute",
                        }}
                      >
                        <span className="text-[9px] font-black text-white truncate">
                          {act.dur} dk
                        </span>
                        {act.ecrsSteps && act.ecrsSteps.length > 0 && (
                          <span className="text-[8px] bg-purple-950/80 text-purple-100 font-extrabold px-1 rounded-sm ml-1 shrink-0">
                            {act.ecrsSteps.join("")}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ================= İYİLEŞTİRİLMİŞ ANALİZ (CONSECUTIVE SINGLE TIMELINE) ================= */
          <div className="space-y-6">
            {/* Total Duration Track with split colors representing Running (Green) vs. Shutdown (Red) */}
            <div className="flex items-center h-10 relative">
              <div className="w-[200px] text-[10px] font-black text-emerald-800 uppercase pr-4 shrink-0 truncate flex items-center space-x-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0 animate-pulse" />
                <span>TOPLAM PROSES SÜRESİ</span>
              </div>
              <div className="relative flex-1 h-full flex items-center">
                {totalExternalDur > 0 && (
                  <div
                    className={`h-7 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md flex items-center px-4 text-white text-[10px] font-black transition-all cursor-default ${
                      totalInternalDur > 0 ? "rounded-l-xl" : "rounded-xl"
                    }`}
                    style={{ width: `${totalExternalDur * pxPerMin}px` }}
                  >
                    <span className="truncate">Dış Hazırlık: {totalExternalDur} dk (Makine Çalışıyor)</span>
                  </div>
                )}
                {totalInternalDur > 0 && (
                  <div
                    className={`h-7 bg-gradient-to-r from-red-600 to-rose-600 shadow-md flex items-center px-4 text-white text-[10px] font-black transition-all cursor-default ${
                      totalExternalDur > 0 ? "rounded-r-xl" : "rounded-xl"
                    }`}
                    style={{ width: `${totalInternalDur * pxPerMin}px` }}
                  >
                    <span className="truncate">İç Hazırlık: {totalInternalDur} dk (Makine Durduruldu)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Individual Operation Rows in consecutive order */}
            <div className="space-y-3 relative border-t border-slate-200 pt-4">
              {mappedImprovedActivities.map((act) => {
                const leftOffset = act.startMin * pxPerMin;
                const width = act.improvedDur * pxPerMin;
                const isSelected = act.id === selectedActivityId;
                const isEliminated = act.improvedDur === 0;

                // Color based on type: external (green/emerald) vs internal (red/rose)
                const barColorClass =
                  act.type === "internal"
                    ? "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 border border-red-300 shadow-sm"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border border-emerald-300 shadow-sm";

                return (
                  <div key={act.id} className={`flex items-center h-8 group relative ${isEliminated ? "opacity-45" : ""}`}>
                    {/* Step label on left */}
                    <button
                      onClick={() => setSelectedActivityId(act.id)}
                      className={`w-[200px] text-[11px] font-black text-left pr-4 shrink-0 truncate transition text-slate-700 hover:text-slate-900 cursor-pointer ${
                        isSelected ? "text-blue-650 font-black" : ""
                      }`}
                    >
                      {act.sequence}. <span className={isEliminated ? "line-through" : ""}>{act.name}</span>
                    </button>

                    {/* Timeline Track */}
                    <div className="relative flex-1 h-full flex items-center">
                      {/* Grid line backdrop */}
                      {ticks.map((tick) => {
                        const tickLeft = tick * pxPerMin;
                        return (
                          <div
                            key={`grid-improved-${tick}`}
                            className="absolute top-0 bottom-0 border-l border-slate-200/30 pointer-events-none"
                            style={{ left: `${tickLeft}px` }}
                          />
                        );
                      })}

                      {isEliminated ? (
                        <button
                          onClick={() => setSelectedActivityId(act.id)}
                          className={`h-6 border border-dashed border-slate-300 rounded-lg flex items-center px-2.5 text-slate-400 text-[8px] font-bold cursor-pointer hover:bg-slate-100 absolute`}
                          style={{ left: `${leftOffset}px` }}
                        >
                          Elimine Edildi (-100%)
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedActivityId(act.id)}
                          className={`h-6.5 rounded-lg flex items-center justify-between px-2.5 cursor-pointer transition-all ${barColorClass} ${
                            isSelected ? "ring-3 ring-blue-500 ring-offset-1 scale-[1.01]" : ""
                          }`}
                          style={{
                            left: `${leftOffset}px`,
                            width: `${Math.max(width, 24)}px`,
                            position: "absolute",
                          }}
                        >
                          <span className="text-[9px] font-black text-white truncate">
                            {act.improvedDur} dk
                          </span>
                          {act.ecrsSteps && act.ecrsSteps.length > 0 && (
                            <span className="text-[8px] bg-purple-950/80 text-purple-100 font-extrabold px-1 rounded-sm ml-1 shrink-0">
                              {act.ecrsSteps.join("")}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const mainView = (
    <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col h-full overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
        <div className="space-y-1">
          <h4 className="text-sm font-black text-slate-900 uppercase flex items-center space-x-2">
            <span>SMED Zaman Çizelgesi (Gantt)</span>
            <span className="text-[10px] bg-blue-150 text-blue-800 px-3 py-0.5 rounded-full font-black normal-case">
              {viewMode === "current"
                ? `Mevcut: ${totalDuration} dk`
                : `İyileştirilmiş: ${totalExternalDur + totalInternalDur} dk (Duruş: ${totalInternalDur} dk)`}
            </span>
          </h4>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            {viewMode === "current"
              ? "Kritik yol setup operasyon adımlarının gözlem sırasına göre zaman akışı."
              : "Duruş sürelerini sıfıra yaklaştırmak için hazırlanan ECRS gruplanmış görsel yol haritası."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200 shadow-2xs shrink-0">
            <button
              onClick={() => setViewMode("current")}
              className={`px-4 py-2 rounded-lg text-xs font-black flex items-center space-x-2 transition cursor-pointer ${
                viewMode === "current"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-250/60"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Mevcut Durum</span>
            </button>
            <button
              onClick={() => setViewMode("improved")}
              className={`px-4 py-2 rounded-lg text-xs font-black flex items-center space-x-2 transition cursor-pointer ${
                viewMode === "improved"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-250/60"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
              <span>İyileştirilmiş Durum</span>
            </button>
          </div>

          {/* Zoom */}
          <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200 shadow-2xs shrink-0">
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-slate-600 hover:bg-white hover:shadow-2xs rounded-lg cursor-pointer transition"
              title="Küçült (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-slate-600 hover:bg-white hover:shadow-2xs rounded-lg cursor-pointer transition"
              title="Büyüt (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Full Screen */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition cursor-pointer shadow-2xs"
            title="Tam Ekran"
          >
            {isFullScreen ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>

      {/* Gantt Timeline View Area */}
      {renderGanttChart()}
    </div>
  );

  return (
    <div className="w-full h-full relative">
      {/* Normal view / Fullscreen wrapper */}
      {isFullScreen ? (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 p-6 flex items-center justify-center">
          <div className="bg-slate-50 w-full h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden max-w-[97vw] max-h-[97vh] relative p-5 border border-slate-200">
            {mainView}
          </div>
        </div>
      ) : (
        <div className="h-[650px] flex flex-col">
          {mainView}
        </div>
      )}

      {/* RIGHT SIDE DRAWER OVERLAY (VSM STYLE) */}
      {selectedActivityId !== null && selectedActivity && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 transition-opacity animate-fade-in"
            onClick={() => setSelectedActivityId(null)}
          />
          
          {/* Drawer panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out border-l border-slate-250 animate-slide-in">
            {/* Header */}
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-black tracking-wider text-blue-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800 font-mono">
                    ADIM EDİTÖRÜ & ECRS İYİLEŞTİRME
                  </span>
                </div>
                <h3 className="text-base font-black uppercase tracking-tight text-white line-clamp-1">
                  {selectedActivity.sequence}. {selectedActivity.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedActivityId(null)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer border border-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body Scroll */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Process Operational parameters (Input cards style) */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
                  <Sliders className="w-4 h-4 text-blue-500" />
                  <span>Proses Operasyonel Parametreleri</span>
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 font-extrabold block uppercase mb-1">İşlem Süresi (dk)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={selectedActivity.dur}
                      onChange={(e) => updateActivityField("dur", Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-extrabold block uppercase mb-1">Operatör / Setter Sayısı</label>
                    <input
                      type="number"
                      min={1}
                      value={selectedActivity.operatorCount || 1}
                      onChange={(e) => updateActivityField("operatorCount", Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 font-extrabold block uppercase mb-1">Operatör Tanımı</label>
                    <input
                      type="text"
                      value={selectedActivity.operator || ""}
                      onChange={(e) => updateActivityField("operator", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-extrabold block uppercase mb-1">Faaliyet Kategorisi</label>
                    <select
                      value={selectedActivity.category || "Diğer"}
                      onChange={(e) => updateActivityField("category", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition"
                    >
                      <option value="Kalıp Sökme/Takma">Kalıp Sökme/Takma</option>
                      <option value="Temizlik ve Cihaz Bakımı">Temizlik ve Cihaz Bakımı</option>
                      <option value="Ayarlama ve Kalibrasyon">Ayarlama ve Kalibrasyon</option>
                      <option value="Ölçüm ve Kalite Kontrol">Ölçüm ve Kalite Kontrol</option>
                      <option value="Malzeme Taşıma / Lojistik">Malzeme Taşıma / Lojistik</option>
                      <option value="Besleme ve Hazırlık">Besleme ve Hazırlık</option>
                      <option value="Ön Isıtma ve Parametre Ayarı">Ön Isıtma ve Parametre Ayarı</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                </div>

                {/* Setup Type */}
                <div>
                  <label className="text-[10px] text-slate-400 font-extrabold block uppercase mb-1.5">İşlem Tipi</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateActivityField("type", "internal")}
                      className={`py-2.5 px-3 text-xs font-black rounded-xl border transition-all cursor-pointer text-center ${
                        selectedActivity.type === "internal"
                          ? "bg-red-500 border-red-500 text-white shadow-md shadow-red-100"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      İç Hazırlık (Duruş)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateActivityField("type", "external")}
                      className={`py-2.5 px-3 text-xs font-black rounded-xl border transition-all cursor-pointer text-center ${
                        selectedActivity.type === "external"
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-100"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      Dış Hazırlık (Çalışırken)
                    </button>
                  </div>
                </div>
              </div>

              {/* ECRS Improvement & Descriptions Section */}
              <div className="space-y-4 pt-4 border-t border-slate-150">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>ECRS İyileştirme ve Aksiyon Tanımları</span>
                </h4>

                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  Bu adımın süresini azaltmak için ECRS ilkelerini seçin, süre kazancını girin ve iyileştirme adımlarını detaylandırın.
                </p>

                <div className="space-y-4">
                  {/* E - Eleme */}
                  <div className={`border rounded-2xl p-4 transition-all ${
                    (selectedActivity.ecrsSteps || []).includes("E") ? "bg-purple-50/50 border-purple-200" : "border-slate-150 hover:bg-slate-50/50"
                  }`}>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-purple-600 border-slate-300 rounded focus:ring-purple-500 cursor-pointer"
                        checked={(selectedActivity.ecrsSteps || []).includes("E")}
                        onChange={(e) => updateEcrsStepData("E", e.target.checked)}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-purple-950">E — Eleme (Eliminate)</span>
                        <span className="text-[9px] text-slate-400 font-bold">Faaliyeti tamamen ortadan kaldırın</span>
                      </div>
                    </label>

                    {(selectedActivity.ecrsSteps || []).includes("E") && (
                      <div className="mt-3 pl-8 space-y-3 border-t border-dashed border-purple-200 pt-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] text-purple-850 font-extrabold uppercase">Süre Kazancı (dk):</span>
                          <input
                            type="number"
                            min={0}
                            max={selectedActivity.dur}
                            step={0.5}
                            className="w-24 px-2 py-1 border border-purple-250 rounded-lg text-xs font-bold text-purple-900 bg-white"
                            value={selectedActivity.ecrsGains?.E ?? 0}
                            onChange={(e) => updateEcrsStepData("E", true, Math.min(selectedActivity.dur, parseFloat(e.target.value) || 0), selectedActivity.ecrsDescriptions?.E)}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-purple-850 font-extrabold uppercase block mb-1">Eleme İyileştirme Tanımı:</label>
                          <textarea
                            rows={2}
                            className="w-full px-3 py-1.5 border border-purple-200 rounded-lg text-xs text-purple-950 bg-white placeholder-purple-300"
                            placeholder="Örn: Cıvatalar iptal edilerek geçmeli sisteme geçildi..."
                            value={selectedActivity.ecrsDescriptions?.E || ""}
                            onChange={(e) => updateEcrsStepData("E", true, selectedActivity.ecrsGains?.E, e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* C - Birleştirme */}
                  <div className={`border rounded-2xl p-4 transition-all ${
                    (selectedActivity.ecrsSteps || []).includes("C") ? "bg-purple-50/50 border-purple-200" : "border-slate-150 hover:bg-slate-50/50"
                  }`}>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-purple-600 border-slate-300 rounded focus:ring-purple-500 cursor-pointer"
                        checked={(selectedActivity.ecrsSteps || []).includes("C")}
                        onChange={(e) => updateEcrsStepData("C", e.target.checked)}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-purple-950">C — Birleştirme (Combine)</span>
                        <span className="text-[9px] text-slate-440 font-bold">Aynı anda paralel yapılacak işleri birleştirin</span>
                      </div>
                    </label>

                    {(selectedActivity.ecrsSteps || []).includes("C") && (
                      <div className="mt-3 pl-8 space-y-3 border-t border-dashed border-purple-200 pt-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] text-purple-850 font-extrabold uppercase">Süre Kazancı (dk):</span>
                          <input
                            type="number"
                            min={0}
                            max={selectedActivity.dur}
                            step={0.5}
                            className="w-24 px-2 py-1 border border-purple-250 rounded-lg text-xs font-bold text-purple-900 bg-white"
                            value={selectedActivity.ecrsGains?.C ?? 0}
                            onChange={(e) => updateEcrsStepData("C", true, Math.min(selectedActivity.dur, parseFloat(e.target.value) || 0), selectedActivity.ecrsDescriptions?.C)}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-purple-850 font-extrabold uppercase block mb-1">Birleştirme İyileştirme Tanımı:</label>
                          <textarea
                            rows={2}
                            className="w-full px-3 py-1.5 border border-purple-200 rounded-lg text-xs text-purple-950 bg-white placeholder-purple-300"
                            placeholder="Örn: 2. Operatör devreye girerek paralel söküm yapacak..."
                            value={selectedActivity.ecrsDescriptions?.C || ""}
                            onChange={(e) => updateEcrsStepData("C", true, selectedActivity.ecrsGains?.C, e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* R - Yeniden Düzenleme */}
                  <div className={`border rounded-2xl p-4 transition-all ${
                    (selectedActivity.ecrsSteps || []).includes("R") ? "bg-purple-50/50 border-purple-200" : "border-slate-150 hover:bg-slate-50/50"
                  }`}>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-purple-600 border-slate-300 rounded focus:ring-purple-500 cursor-pointer"
                        checked={(selectedActivity.ecrsSteps || []).includes("R")}
                        onChange={(e) => updateEcrsStepData("R", e.target.checked)}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-purple-950">R — Yeniden Düzenleme (Rearrange)</span>
                        <span className="text-[9px] text-slate-440 font-bold">Operasyonların sırasını veya yerini optimize edin</span>
                      </div>
                    </label>

                    {(selectedActivity.ecrsSteps || []).includes("R") && (
                      <div className="mt-3 pl-8 space-y-3 border-t border-dashed border-purple-200 pt-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] text-purple-850 font-extrabold uppercase">Süre Kazancı (dk):</span>
                          <input
                            type="number"
                            min={0}
                            max={selectedActivity.dur}
                            step={0.5}
                            className="w-24 px-2 py-1 border border-purple-250 rounded-lg text-xs font-bold text-purple-900 bg-white"
                            value={selectedActivity.ecrsGains?.R ?? 0}
                            onChange={(e) => updateEcrsStepData("R", true, Math.min(selectedActivity.dur, parseFloat(e.target.value) || 0), selectedActivity.ecrsDescriptions?.R)}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-purple-850 font-extrabold uppercase block mb-1">Düzenleme İyileştirme Tanımı:</label>
                          <textarea
                            rows={2}
                            className="w-full px-3 py-1.5 border border-purple-200 rounded-lg text-xs text-purple-950 bg-white placeholder-purple-300"
                            placeholder="Örn: Kalıp ısıtma işlemi hattan bağımsız, ön hazırlık odasında yapılacak..."
                            value={selectedActivity.ecrsDescriptions?.R || ""}
                            onChange={(e) => updateEcrsStepData("R", true, selectedActivity.ecrsGains?.R, e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* S - Basitleştirme */}
                  <div className={`border rounded-2xl p-4 transition-all ${
                    (selectedActivity.ecrsSteps || []).includes("S") ? "bg-purple-50/50 border-purple-200" : "border-slate-150 hover:bg-slate-50/50"
                  }`}>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-purple-600 border-slate-300 rounded focus:ring-purple-500 cursor-pointer"
                        checked={(selectedActivity.ecrsSteps || []).includes("S")}
                        onChange={(e) => updateEcrsStepData("S", e.target.checked)}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-purple-950">S — Basitleştirme (Simplify)</span>
                        <span className="text-[9px] text-slate-440 font-bold">Aparat, pin, hızlı kaplin, hızlı kelepçe kullanın</span>
                      </div>
                    </label>

                    {(selectedActivity.ecrsSteps || []).includes("S") && (
                      <div className="mt-3 pl-8 space-y-3 border-t border-dashed border-purple-200 pt-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] text-purple-850 font-extrabold uppercase">Süre Kazancı (dk):</span>
                          <input
                            type="number"
                            min={0}
                            max={selectedActivity.dur}
                            step={0.5}
                            className="w-24 px-2 py-1 border border-purple-250 rounded-lg text-xs font-bold text-purple-900 bg-white"
                            value={selectedActivity.ecrsGains?.S ?? 0}
                            onChange={(e) => updateEcrsStepData("S", true, Math.min(selectedActivity.dur, parseFloat(e.target.value) || 0), selectedActivity.ecrsDescriptions?.S)}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-purple-850 font-extrabold uppercase block mb-1">Basitleştirme İyileştirme Tanımı:</label>
                          <textarea
                            rows={2}
                            className="w-full px-3 py-1.5 border border-purple-200 rounded-lg text-xs text-purple-950 bg-white placeholder-purple-300"
                            placeholder="Örn: Bağlantı kabloları için hızlı bağlantı soketleri kullanılabilir..."
                            value={selectedActivity.ecrsDescriptions?.S || ""}
                            onChange={(e) => updateEcrsStepData("S", true, selectedActivity.ecrsGains?.S, e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer (Kapat ve Değişiklikleri Uygula) */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0 flex justify-end">
              <button
                onClick={() => setSelectedActivityId(null)}
                className="w-full bg-slate-950 hover:bg-slate-850 text-white font-black text-xs py-3.5 px-6 rounded-xl cursor-pointer transition shadow-md shadow-slate-200 flex items-center justify-center space-x-2"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Kapat ve Değişiklikleri Uygula</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
