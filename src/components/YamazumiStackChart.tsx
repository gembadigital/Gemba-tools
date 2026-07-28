import React, { useMemo, useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Target, Info, AlertTriangle, ShieldCheck } from "lucide-react";

interface WorkElementRecord {
  id: string;
  seqNo: number;
  processName: string;
  workElement: string;
  workClass: "VA" | "NVA" | "W";
  workType: string;
  cycles: (number | null)[];
  standardCycleTime: number;
}

interface YamazumiStackChartProps {
  elements: WorkElementRecord[];
  taktTime: number;
  lang: "en" | "tr";
}

const TRANSLATIONS = {
  en: {
    title: "Yamazumi Stacked Balance Chart",
    taktTime: "Takt Time Limit",
    bottleneck: "Bottleneck",
    avgTime: "Avg Process Time",
    exceedAlert: "Takt Time Exceeded Alert",
    totalCt: "Total Cycle Time",
    va: "Value Added",
    nva: "Non-Value Added",
    waste: "Walking / Waiting / Loss",
    elements: "Elements",
    zoomX: "Column Width",
    zoomY: "Column Height",
    reset: "Reset View",
    aboveAvg: "above average",
    processName: "Process Name",
    elementDetail: "Work Element Detail",
    workClass: "Work Class",
    cycleTime: "Cycle Time",
    percentage: "Process Share",
    noData: "No data available. Start the video chronometry or upload a CSV above.",
    dragToScroll: "💡 Tip: Click and drag empty space to pan the canvas. Shift + Mouse wheel to scale process columns."
  },
  tr: {
    title: "Yamazumi Proses Dengeleme Grafiği",
    taktTime: "Takt Süre Sınırı",
    bottleneck: "Darboğaz",
    avgTime: "Ort. Süreç Süresi",
    exceedAlert: "Takt Süresi Aşımı Uyarısı",
    totalCt: "Toplam Çevrim Süresi",
    va: "Katma Değer (VA)",
    nva: "Kısmi Katma Değer (NVA)",
    waste: "Yürüme / Bekleme / Kayıp",
    elements: "İş Elemanları",
    zoomX: "Süreç Genişliği",
    zoomY: "Süreç Yüksekliği",
    reset: "Görünümü Sıfırla",
    aboveAvg: "ortalama üzerinde",
    processName: "Proses Adı",
    elementDetail: "İş Elemanı Detayı",
    workClass: "İş Sınıfı",
    cycleTime: "Çevrim Süresi",
    percentage: "Proses Payı",
    noData: "Kayıt bulunmuyor. Sol üst bölümden video kronometresini başlatabilir ya veya CSV verisi yükleyebilirsiniz.",
    dragToScroll: "💡 İpucu: Boş bir alana tıklayıp sürükleyerek grafiği kaydırabilir; Shift + Fare tekerleğiyle genişliği ayarlayabilirsiniz."
  }
};

export default function YamazumiStackChart({ elements, taktTime, lang }: YamazumiStackChartProps) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Zoom & Pan states
  const [zoomScaleX, setZoomScaleX] = useState<number>(1.0);
  const [zoomScaleY, setZoomScaleY] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startDrag, setStartDrag] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hover Tooltip States
  const [hoveredElement, setHoveredElement] = useState<{
    processName: string;
    element: WorkElementRecord;
    pct: number;
    x: number;
    y: number;
  } | null>(null);

  // Group elements by unique process names preserving first sequence order
  const processesGrouped = useMemo(() => {
    const groups: Record<string, {
      processName: string;
      elements: WorkElementRecord[];
      totalCycleTime: number;
      vaTime: number;
      nvaTime: number;
      wTime: number;
      seqMin: number;
    }> = {};

    elements.forEach(el => {
      const name = el.processName.trim() || (lang === "tr" ? "Tanımsız Proses" : "Unspecified Process");
      if (!groups[name]) {
        groups[name] = {
          processName: name,
          elements: [],
          totalCycleTime: 0,
          vaTime: 0,
          nvaTime: 0,
          wTime: 0,
          seqMin: el.seqNo
        };
      }
      groups[name].elements.push(el);
      groups[name].totalCycleTime += el.standardCycleTime;
      
      if (el.workClass === "VA") groups[name].vaTime += el.standardCycleTime;
      else if (el.workClass === "NVA") groups[name].nvaTime += el.standardCycleTime;
      else if (el.workClass === "W") groups[name].wTime += el.standardCycleTime;
      
      if (el.seqNo < groups[name].seqMin) {
        groups[name].seqMin = el.seqNo;
      }
    });

    // Sort by sequence appearance to keep industrial engineering process flow logical
    return Object.values(groups).sort((a, b) => a.seqMin - b.seqMin);
  }, [elements, lang]);

  // Bottleneck & Stats Calculations
  const bottleneckProcess = useMemo(() => {
    if (processesGrouped.length === 0) return null;
    let maxTime = -1;
    let maxProc = null;
    processesGrouped.forEach(g => {
      if (g.totalCycleTime > maxTime) {
        maxTime = g.totalCycleTime;
        maxProc = g;
      }
    });
    return maxProc;
  }, [processesGrouped]);

  const averageProcessCycleTime = useMemo(() => {
    if (processesGrouped.length === 0) return 0;
    const sum = processesGrouped.reduce((acc, g) => acc + g.totalCycleTime, 0);
    return sum / processesGrouped.length;
  }, [processesGrouped]);

  const bottleneckPctAboveAvg = useMemo(() => {
    if (!bottleneckProcess || averageProcessCycleTime === 0) return 0;
    const diff = bottleneckProcess.totalCycleTime - averageProcessCycleTime;
    return Math.round((diff / averageProcessCycleTime) * 100);
  }, [bottleneckProcess, averageProcessCycleTime]);

  // Dimensions & Coordinate Specs
  const baseColWidth = 140;
  const baseColumnGap = 28;
  const leftMargin = 70;
  const rightMargin = 40;
  const topMargin = 90;
  const bottomMargin = 60;
  const baseChartHeight = 360;

  // Compute calculated dimensions based on scaling
  const colWidth = baseColWidth * zoomScaleX;
  const colGap = baseColumnGap * zoomScaleX;
  const chartHeight = baseChartHeight * zoomScaleY;
  const svgHeight = chartHeight + topMargin + bottomMargin;

  const totalContentWidth = leftMargin + rightMargin + (colWidth + colGap) * processesGrouped.length;
  // Use parent bounding rect width or fit-content
  const [containerWidth, setContainerWidth] = useState<number>(800);

  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const svgWidth = Math.max(containerWidth, totalContentWidth);

  // Maximum value calculation for Y-Axis scaling
  const maxYValue = useMemo(() => {
    const list = [...processesGrouped.map(p => p.totalCycleTime), taktTime, 10];
    return Math.max(...list) * 1.15; // padding top so numbers read well
  }, [processesGrouped, taktTime]);

  // Convert cycle time value to responsive Y pixel coordinate
  const valToY = (val: number) => {
    const plotHeight = chartHeight;
    const ratio = val / maxYValue;
    return topMargin + plotHeight - ratio * plotHeight;
  };

  // Convert Y pixel length of continuous blocks
  const elapsedToHeight = (val: number) => {
    return (val / maxYValue) * chartHeight;
  };

  // Mouse Wheel Zoom handler (supports Shift+Wheel to scale Horizontal)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.shiftKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      setZoomScaleX(prev => Math.min(2.5, Math.max(0.6, prev * zoomFactor)));
    }
  };

  // Drag to Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only capture left click on background elements to initiate pan
    const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
    if (targetTag === "rect" || targetTag === "text") {
      // Allow tooltip click or bar hover, but do not pan if clicking specific elements
      if ((e.target as HTMLElement).classList.contains("bar-segment")) return;
    }
    setIsPanning(true);
    setStartDrag({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanX(e.clientX - startDrag.x);
    // restrict vertical panning within viewport logical boundaries
    setPanY(e.clientY - startDrag.y);
  };

  const handleMouseEnd = () => {
    setIsPanning(false);
  };

  const resetView = () => {
    setZoomScaleX(1.0);
    setZoomScaleY(1.0);
    setPanX(0);
    setPanY(0);
  };

  // Render Horizontal Reference Gridlines
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = maxYValue > 60 ? 10 : maxYValue > 30 ? 5 : 2;
    for (let i = 0; i <= maxYValue; i += step) {
      ticks.push(Math.round(i * 10) / 10);
    }
    return ticks;
  }, [maxYValue]);

  // Handle segments details hover positioning
  const handleMouseEnterSegment = (e: React.MouseEvent, processName: string, element: WorkElementRecord, pct: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setHoveredElement({
        processName,
        element,
        pct,
        x: e.clientX - rect.left + 14,
        y: e.clientY - rect.top - 50
      });
    }
  };

  const handleMouseMoveSegment = (e: React.MouseEvent) => {
    if (hoveredElement && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setHoveredElement(prev => prev ? {
        ...prev,
        x: e.clientX - rect.left + 14,
        y: e.clientY - rect.top - 50
      } : null);
    }
  };

  const handleMouseLeaveSegment = () => {
    setHoveredElement(null);
  };

  return (
    <div className="flex flex-col space-y-3 w-full" ref={containerRef}>
      {/* Zoom and configuration header bar */}
      <div className="flex flex-col space-y-2 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
              {t.title}
            </span>
          </div>

          {/* Scalers */}
          <div className="flex flex-wrap items-center gap-4 text-xs w-full sm:w-auto justify-between sm:justify-start">
            {/* ZoomX Control */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-500 font-bold text-[10px] uppercase">{t.zoomX}:</span>
              <input
                type="range"
                min="0.6"
                max="2.5"
                step="0.1"
                value={zoomScaleX}
                onChange={(e) => setZoomScaleX(parseFloat(e.target.value))}
                className="accent-emerald-500 w-16 sm:w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="font-mono text-slate-600 font-bold w-10 text-right">{Math.round(zoomScaleX * 100)}%</span>
            </div>

            {/* ZoomY Control */}
            <div className="flex items-center space-x-2">
              <span className="text-slate-500 font-bold text-[10px] uppercase">{t.zoomY}:</span>
              <input
                type="range"
                min="0.6"
                max="2.5"
                step="0.1"
                value={zoomScaleY}
                onChange={(e) => setZoomScaleY(parseFloat(e.target.value))}
                className="accent-emerald-500 w-16 sm:w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="font-mono text-slate-600 font-bold w-10 text-right">{Math.round(zoomScaleY * 100)}%</span>
            </div>

            {/* Reset button */}
            <button
              onClick={resetView}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-605 font-black uppercase tracking-wider hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t.reset}</span>
            </button>
          </div>
        </div>

        {/* Legend bar for T1, T2, T3 work types */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
          <span className="font-black text-slate-700 uppercase tracking-wide text-[10px]">İş Tipi (TIP) Katmanları:</span>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <div className="flex items-center space-x-1.5 font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#10b981] inline-block" />
              <span className="w-2.5 h-2.5 rounded-xs bg-[#fbbf24] inline-block" />
              <span className="w-2.5 h-2.5 rounded-xs bg-[#f43f5e] inline-block" />
              <span>T1: Sürekli / Tekrarlı İşler (%100 Sütun Genişliği)</span>
            </div>
            <div className="flex items-center space-x-1.5 font-extrabold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 shadow-2xs">
              <span className="w-3 h-3 rounded-xs bg-[#7c3aed] inline-block" />
              <span>T2: Periyodik İşler (%70 Dar Sütun)</span>
            </div>
            <div className="flex items-center space-x-1.5 font-extrabold text-sky-900 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 shadow-2xs">
              <span className="w-3 h-3 rounded-xs bg-[#0284c7] inline-block" />
              <span>T3: Çevrim Dışı İşler (%45 En Dar Sütun)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main active plotting area */}
      <div 
        className="w-full relative overflow-hidden bg-slate-50 border border-slate-200 rounded-xl"
        onWheel={handleWheel}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        {processesGrouped.length > 0 ? (
          <div className="w-full overflow-x-auto scrollbar-thin">
            <svg
              ref={svgRef}
              width={svgWidth}
              height={svgHeight}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseEnd}
              onMouseLeave={handleMouseEnd}
              className="bg-slate-50 select-none overflow-hidden transition-all duration-75 block"
            >
              {/* GLOW DEFS */}
              <defs>
                <filter id="bottleneck-glow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f97316" floodOpacity="0.45" />
                </filter>
                <filter id="stack-item-glow" x="-5%" y="-5%" width="110%" height="110%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.5" />
                </filter>
                <pattern id="diagonal-hash" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#f43f5e" strokeWidth="2.5" strokeOpacity="0.35" />
                </pattern>
                
                {/* SVG Clipping Path to hide translated contents outside boundary lines */}
                <clipPath id="chart-viewport">
                  <rect x={leftMargin} y={topMargin - 15} width={svgWidth - leftMargin - rightMargin} height={chartHeight + 20} />
                </clipPath>
              </defs>

              {/* Translate and scale transform g element representing panning */}
              <g transform={`translate(${panX}, ${panY})`}>
                
                {/* 1. HORIZONTAL BACKGROUND GRIDLINES */}
                <g className="grid-lines-group">
                  {yTicks.map((tick, index) => {
                    const yPos = valToY(tick);
                    return (
                      <g key={index} className="opacity-80">
                        <line
                          x1={leftMargin}
                          y1={yPos}
                          x2={svgWidth - rightMargin}
                          y2={yPos}
                          stroke="#e2e8f0"
                          strokeWidth={1}
                          strokeDasharray={tick === 0 ? "none" : "2 2"}
                        />
                        {/* Grid labels pinned to the left edge of the grid */}
                        <text
                          x={leftMargin - 12}
                          y={yPos + 4}
                          textAnchor="end"
                          className="fill-slate-500 font-mono font-bold text-[10px]"
                        >
                          {tick}s
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* 2. TAKT TIME LIMIT REFERENCE LINE (Draw on background) */}
                {(() => {
                  const yTakt = valToY(taktTime);
                  return (
                    <g className="takt-line-element">
                      <line
                        x1={leftMargin}
                        y1={yTakt}
                        x2={svgWidth - rightMargin}
                        y2={yTakt}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        className="animate-pulse"
                      />
                      {/* Pill indicator representing Takt value at the right axis border */}
                      <rect
                        x={svgWidth - rightMargin - 95}
                        y={yTakt - 9}
                        width={95}
                        height={18}
                        rx={4}
                        fill="#eff6ff"
                        stroke="#3b82f6"
                        strokeWidth={1}
                      />
                      <text
                        x={svgWidth - rightMargin - 47}
                        y={yTakt + 3}
                        textAnchor="middle"
                        className="fill-blue-800 font-sans font-black text-[9px] uppercase tracking-wider"
                      >
                        ⏱️ Takt: {taktTime.toFixed(1)}s
                      </text>
                    </g>
                  );
                })()}

                {/* 3. PROCESS COLUMNS */}
                {processesGrouped.map((group, colIdx) => {
                  const xColLeft = leftMargin + colIdx * (colWidth + colGap) + colGap / 2;
                  const xColCenter = xColLeft + colWidth / 2;
                  
                  const isBottleneck = bottleneckProcess?.processName === group.processName;
                  const exceedsTakt = group.totalCycleTime > taktTime;

                  // Compute vertical coordinates for elements stack items
                  let stackOffsetAccumulator = 0;

                  return (
                    <g key={group.processName} className="process-column-group">
                      
                      {/* background highlight if exceeds Takt time limit */}
                      {exceedsTakt && (
                        <g className="takt-exceeded-highlight">
                          <rect
                            x={xColLeft - colGap / 4}
                            y={topMargin - 10}
                            width={colWidth + colGap / 2}
                            height={chartHeight + bottomMargin - 10}
                            rx={12}
                            fill="#f43f5e"
                            fillOpacity={0.03}
                            stroke="#f43f5e"
                            strokeWidth={1}
                            strokeDasharray="4 4"
                            strokeOpacity={0.25}
                          />
                          {/* Alert Badge placed below columns */}
                          <text
                            x={xColCenter}
                            y={topMargin + chartHeight + bottomMargin - 12}
                            textAnchor="middle"
                            className="fill-rose-400 font-sans font-black text-[8px] tracking-wide uppercase animate-pulse"
                          >
                            ⚠️ EXCEEDS TAKT
                          </text>
                        </g>
                      )}

                      {/* T1, T2, T3 TIERED WORK ELEMENT STACKS */}
                      {(() => {
                        const isT2 = (wt: string) => {
                          const s = (wt || "").toUpperCase().trim();
                          return s === "T2" || s.startsWith("T2") || s.includes("PERIOD") || s.includes("PERİYODİK") || s.includes("PERIYODIK");
                        };

                        const isT3 = (wt: string) => {
                          const s = (wt || "").toUpperCase().trim();
                          return s === "T3" || s.startsWith("T3") || s.includes("EVENT") || s.includes("SHIFT") || s.includes("ÇEVRİM DIŞI") || s.includes("CEVRIM DISI") || s.includes("OFF-CYCLE");
                        };

                        const t1List = group.elements.filter(el => !isT2(el.workType) && !isT3(el.workType));
                        const t2List = group.elements.filter(el => isT2(el.workType));
                        const t3List = group.elements.filter(el => isT3(el.workType));

                        const tiers = [
                          { list: t1List, widthFactor: 1.0, defaultColor: null, labelPrefix: "" },
                          { list: t2List, widthFactor: 0.70, defaultColor: "#7c3aed", labelPrefix: "T2: " },
                          { list: t3List, widthFactor: 0.45, defaultColor: "#0284c7", labelPrefix: "T3: " }
                        ];

                        return tiers.map((tier) => {
                          const currentWidth = colWidth * tier.widthFactor;
                          const currentX = xColCenter - currentWidth / 2;

                          return tier.list.map((el) => {
                            const hItem = elapsedToHeight(el.standardCycleTime);
                            const yItem = valToY(0) - stackOffsetAccumulator - hItem;
                            stackOffsetAccumulator += hItem;

                            const durationPct = Math.round((el.standardCycleTime / group.totalCycleTime) * 100);

                            let itemColor = tier.defaultColor;
                            if (!itemColor) {
                              if (el.workClass === "VA") itemColor = "#10b981"; // VA green
                              else if (el.workClass === "NVA") itemColor = "#fbbf24"; // NVA amber
                              else itemColor = "#f43f5e"; // Waste rose
                            }

                            const isCurrentlyHovered = hoveredElement?.element.id === el.id;

                            return (
                              <g key={el.id} className="stack-segment">
                                <rect
                                  x={currentX}
                                  y={yItem}
                                  width={currentWidth}
                                  height={hItem}
                                  rx={4}
                                  fill={itemColor}
                                  stroke={isCurrentlyHovered ? "#3b82f6" : "#ffffff"}
                                  strokeWidth={isCurrentlyHovered ? 2.5 : 1.5}
                                  filter={isCurrentlyHovered ? "url(#stack-item-glow)" : undefined}
                                  className="bar-segment hover:fill-opacity-90 active:fill-opacity-95 transition-all duration-100 ease-out cursor-pointer"
                                  onMouseEnter={(e) => handleMouseEnterSegment(e, group.processName, el, durationPct)}
                                  onMouseMove={handleMouseMoveSegment}
                                  onMouseLeave={handleMouseLeaveSegment}
                                />

                                {hItem > 14 && currentWidth > 30 && (
                                  <g className="pointer-events-none select-none">
                                    <text
                                      x={xColCenter}
                                      y={yItem + hItem / 2 - (hItem > 28 ? 4 : -3)}
                                      textAnchor="middle"
                                      className={`font-sans font-extrabold text-[9px] tracking-tight truncate leading-none ${
                                        tier.defaultColor ? "fill-white" : "fill-slate-950"
                                      }`}
                                    >
                                      {tier.labelPrefix}
                                      {el.workElement.length > (currentWidth / 6.5)
                                        ? el.workElement.slice(0, Math.floor(currentWidth / 7)) + ".."
                                        : el.workElement
                                      }
                                    </text>
                                    {hItem > 28 && (
                                      <text
                                        x={xColCenter}
                                        y={yItem + hItem / 2 + 8}
                                        textAnchor="middle"
                                        className={`font-mono font-black text-[9px] ${
                                          tier.defaultColor ? "fill-white/90" : "fill-slate-950/80"
                                        }`}
                                      >
                                        {el.standardCycleTime.toFixed(1)}s ({durationPct}%)
                                      </text>
                                    )}
                                  </g>
                                )}
                              </g>
                            );
                          });
                        });
                      })()}

                      {/* 4. BOTTLENECK GLOW BOX (Draws surrounding dashed outer vector) */}
                      {isBottleneck && (
                        <g className="pointer-events-none">
                          <rect
                            x={xColLeft - 5}
                            y={valToY(group.totalCycleTime) - 5}
                            width={colWidth + 10}
                            height={elapsedToHeight(group.totalCycleTime) + 10}
                            rx={8}
                            fill="none"
                            stroke="#f97316"
                            strokeWidth={2.5}
                            strokeDasharray="4 2"
                            filter="url(#bottleneck-glow)"
                          />
                          {/* Top-aligned Bottleneck orange badge */}
                          <g transform={`translate(${xColLeft}, ${valToY(group.totalCycleTime) - 44})`}>
                            <rect
                              x={0}
                              y={0}
                              width={colWidth}
                              height={16}
                              rx={4}
                              fill="#f97316"
                            />
                            <text
                              x={colWidth / 2}
                              y={12}
                              textAnchor="middle"
                              className="fill-slate-950 font-sans font-black text-[8px] uppercase tracking-wider"
                            >
                              🔥 {t.bottleneck} (+{bottleneckPctAboveAvg}%)
                            </text>
                          </g>
                        </g>
                      )}

                      {/* 5. COLUMN TOP PROCESS SUMMARY PILL */}
                      {(() => {
                        const summaryY = valToY(group.totalCycleTime) - 24;
                        const vaPct = Math.round((group.vaTime / group.totalCycleTime) * 100) || 0;
                        const nvaPct = Math.round((group.nvaTime / group.totalCycleTime) * 100) || 0;
                        const wPct = Math.round((group.wTime / group.totalCycleTime) * 100) || 0;

                        return (
                          <g transform={`translate(${xColLeft}, ${summaryY})`} className="process-summary-pill pointer-events-none">
                            <rect
                              x={0}
                              y={0}
                              width={colWidth}
                              height={20}
                              rx={5}
                              fill="#f8fafc"
                              stroke={isBottleneck ? "#f97316" : exceedsTakt ? "#f43f5e" : "#cbd5e1"}
                              strokeWidth={1}
                            />
                            <text
                              x={4}
                              y={13}
                              textAnchor="start"
                              className="fill-slate-800 font-mono font-black text-[9px]"
                            >
                              {group.totalCycleTime.toFixed(1)}s
                            </text>
                            {colWidth > 90 && (
                              <text
                                x={colWidth - 4}
                                y={12}
                                textAnchor="end"
                                className="font-sans font-bold text-[8px]"
                              >
                                <tspan fill="#10b981">{vaPct}%</tspan>
                                <tspan fill="#64748b" className="mx-0.5">·</tspan>
                                <tspan fill="#fbbf24">{nvaPct}%</tspan>
                                <tspan fill="#64748b" className="mx-0.5">·</tspan>
                                <tspan fill="#f43f5e">{wPct}%</tspan>
                              </text>
                            )}
                          </g>
                        );
                      })()}

                      {/* 6. X-AXIS LABELS (Process name centered) */}
                      <g className="x-axis-labels pointer-events-none">
                        <text
                          x={xColCenter}
                          y={topMargin + chartHeight + 20}
                          textAnchor="middle"
                          className="fill-slate-700 font-sans font-black text-[11px] tracking-tight"
                        >
                          {group.processName.length > 18 ? group.processName.slice(0, 16) + ".." : group.processName}
                        </text>
                        {/* Summary caption containing number of work elements in this process */}
                        <text
                          x={xColCenter}
                          y={topMargin + chartHeight + 35}
                          textAnchor="middle"
                          className="fill-slate-500 font-mono font-bold text-[10px]"
                        >
                          {group.elements.length} {lang === "tr" ? "Eleman" : "Elements"}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 italic p-6 gap-2">
            <Info className="w-8 h-8 text-slate-400" />
            <p className="text-center">{t.noData}</p>
          </div>
        )}

                          {/* FULLY INTERACTIVE ABSOLUM POSITION HOVER TOOLTIP */}
            {hoveredElement && (
              <div 
                className="absolute pointer-events-none z-50 bg-white/95 backdrop-blur-md border border-slate-200 p-3 rounded-xl shadow-2xl text-[11px] space-y-2 w-56 text-slate-805 shadow-xl"
                style={{ left: `${hoveredElement.x}px`, top: `${hoveredElement.y}px` }}
              >
                {/* Header */}
                <div className="border-b border-slate-100 pb-1.5 flex justify-between items-center bg-white">
                  <div className="flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredElement.element.workClass === "VA" ? "#10b981" : hoveredElement.element.workClass === "NVA" ? "#fbbf24" : "#f43f5e" }} />
                    <span className="font-sans font-black text-slate-550 text-[10px] uppercase">
                      {hoveredElement.element.workClass === "VA" ? t.va : hoveredElement.element.workClass === "NVA" ? t.nva : t.waste}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 font-bold">Seq {hoveredElement.element.seqNo}</span>
                </div>

                <div className="space-y-1 bg-white">
                  <div>
                    <span className="text-slate-400 text-[9px] uppercase font-bold block">{t.processName}</span>
                    <span className="font-sans font-black text-slate-850">{hoveredElement.processName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[9px] uppercase font-bold block">{t.elementDetail}</span>
                    <span className="font-sans font-bold text-slate-700 leading-tight block">{hoveredElement.element.workElement}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 mt-1 bg-white">
                    <div>
                      <span className="text-slate-450 text-[9px] uppercase font-bold block">{t.cycleTime}</span>
                      <span className="font-mono font-black text-emerald-700 text-xs">{hoveredElement.element.standardCycleTime.toFixed(2)}s</span>
                    </div>
                    <div>
                      <span className="text-slate-450 text-[9px] uppercase font-bold block">{t.percentage}</span>
                      <span className="font-mono font-black text-slate-800 text-xs">%{hoveredElement.pct}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

      {/* Tip footer */}
      <span className="text-[10px] text-slate-400 italic leading-snug font-medium pl-1">
        {t.dragToScroll}
      </span>
    </div>
  );
}
