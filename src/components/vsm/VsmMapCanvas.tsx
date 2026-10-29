// VSM map drawing (plan step V3): the stage inside the pan / zoom wrapper. Geometry from vsmMapLayout.ts,
// so the stage grows with the process count. Keeps the established look (cards, boxes, colours) and adds
// the standard VSM symbols: push arrow, FIFO lane, supermarket with pull arrow, kanban, electronic vs.
// manual information flow, trucks, raw material / finished goods triangles, pacemaker, and a timeline
// ladder aligned to the stock zones (wait) and process cards (value-added time).
import React from "react";
import { Settings } from "lucide-react";
import { useVsm } from "./VsmContext";
import { MAP, infoPath } from "./vsmMapLayout";
import type { VsmInventoryType, VsmProcess } from "./vsmTypes";

type Tl = VsmProcess & { inventoryDays: number };

const stockTypeOf = (p: VsmProcess): VsmInventoryType => p.inventoryType ?? (p.isSupermarket ? "supermarket" : "pile");

// ---------- small SVG symbols (drawn in map coordinates) ----------

function Triangle({ cx, y, label, qty, days, bright }: { cx: number; y: number; label: string; qty?: number; days?: number; bright: boolean }) {
  return (
    <g>
      <polygon points={`${cx},${y} ${cx - 22},${y + 38} ${cx + 22},${y + 38}`} fill="#fef08a" stroke="#ca8a04" strokeWidth="2.5" />
      <text x={cx} y={y + 32} textAnchor="middle" fontSize="16" fontWeight="900" fill="#854d0e" fontFamily="ui-monospace, monospace">{label}</text>
      {qty !== undefined && (
        <text x={cx} y={y + 54} textAnchor="middle" fontSize="11" fontWeight="800" fill={bright ? "#334155" : "#cbd5e1"} fontFamily="ui-monospace, monospace">{qty} AD</text>
      )}
      {days !== undefined && days > 0 && (
        <text x={cx} y={y + 67} textAnchor="middle" fontSize="10" fontWeight="700" fill={bright ? "#b45309" : "#fbbf24"} fontFamily="ui-monospace, monospace">{days} gün</text>
      )}
    </g>
  );
}

function Truck({ x, y, label, bright }: { x: number; y: number; label?: string; bright: boolean }) {
  const c = bright ? "#047857" : "#34d399";
  return (
    <g>
      <rect x={x} y={y} width="26" height="15" rx="2" fill={bright ? "#ecfdf5" : "#064e3b"} stroke={c} strokeWidth="1.8" />
      <path d={`M ${x + 26},${y + 4} L ${x + 34},${y + 4} L ${x + 38},${y + 10} L ${x + 38},${y + 15} L ${x + 26},${y + 15} Z`} fill={bright ? "#ecfdf5" : "#064e3b"} stroke={c} strokeWidth="1.8" />
      <circle cx={x + 8} cy={y + 18} r="3.2" fill={c} />
      <circle cx={x + 30} cy={y + 18} r="3.2" fill={c} />
      {label && <text x={x + 44} y={y + 13} fontSize="10" fontWeight="700" fill={c} fontFamily="ui-monospace, monospace">{label}</text>}
    </g>
  );
}

// Material flow into a process, drawn according to the stock type in front of it.
function MaterialLink({ x1, x2, y, type, bright }: { x1: number; x2: number; y: number; type: VsmInventoryType; bright: boolean }) {
  const blue = bright ? "#0284c7" : "#38bdf8";
  if (type === "fifo") {
    return (
      <g>
        <line x1={x1} y1={y - 9} x2={x2 - 4} y2={y - 9} stroke={blue} strokeWidth="2" />
        <line x1={x1} y1={y + 9} x2={x2 - 4} y2={y + 9} stroke={blue} strokeWidth="2" />
        <line x1={x1 + 6} y1={y} x2={x2 - 6} y2={y} stroke={blue} strokeWidth="2" markerEnd="url(#solid-arrow)" />
      </g>
    );
  }
  if (type === "supermarket") {
    return <line x1={x1} y1={y} x2={x2 - 4} y2={y} stroke={blue} strokeWidth="2.5" markerEnd="url(#solid-arrow)" />;
  }
  // push: striped arrow
  const h = 12;
  const head = Math.min(14, (x2 - x1) / 3);
  return (
    <g>
      <rect x={x1} y={y - h / 2} width={Math.max(0, x2 - x1 - head)} height={h} fill="url(#push-stripes)" stroke={blue} strokeWidth="1.2" />
      <polygon points={`${x2 - head},${y - h} ${x2},${y} ${x2 - head},${y + h}`} fill={blue} />
    </g>
  );
}

// Stock zone in front of a process: triangle (push), FIFO label, or supermarket with its pull arrow.
function StockZone({ x, lineY, p, bright, wipDaysWarning = 0 }: { x: number; lineY: number; p: Tl; bright: boolean; wipDaysWarning?: number }) {
  const cx = x + MAP.stockW / 2;
  const type = stockTypeOf(p);
  const qtyColor = bright ? "#334155" : "#cbd5e1";
  const over = wipDaysWarning > 0 && p.inventoryDays > wipDaysWarning;
  const dayColor = over ? "#dc2626" : bright ? "#b45309" : "#fbbf24";
  return (
    <g>
      {type === "pile" && <Triangle cx={cx} y={lineY - 72} label="I" bright={bright} />}
      {type === "fifo" && (
        <text x={cx} y={lineY - 18} textAnchor="middle" fontSize="11" fontWeight="900" fill={bright ? "#0369a1" : "#7dd3fc"} fontFamily="ui-monospace, monospace">
          FIFO{p.fifoMax ? ` ≤${p.fifoMax}` : ""}
        </text>
      )}
      {type === "supermarket" && (
        <g>
          <path d={`M ${cx - 20},${lineY - 70} L ${cx + 20},${lineY - 70} L ${cx + 20},${lineY - 30} L ${cx - 20},${lineY - 30}`} fill="#fef9c3" stroke="#ca8a04" strokeWidth="2.5" />
          <line x1={cx - 20} y1={lineY - 57} x2={cx + 20} y2={lineY - 57} stroke="#ca8a04" strokeWidth="2" />
          <line x1={cx - 20} y1={lineY - 44} x2={cx + 20} y2={lineY - 44} stroke="#ca8a04" strokeWidth="2" />
          {/* withdrawal (pull) arrow: from the downstream process back to the supermarket */}
          <path d={`M ${cx + 30},${lineY - 22} C ${cx + 40},${lineY - 96} ${cx - 34},${lineY - 100} ${cx - 26},${lineY - 64}`}
            fill="none" stroke={bright ? "#475569" : "#94a3b8"} strokeWidth="2" markerEnd="url(#pull-arrow)" />
        </g>
      )}
      {p.isKanbanEnabled && (
        <g>
          <rect x={cx - 26} y={lineY + 50} width="52" height="16" rx="3" fill="#facc15" stroke="#a16207" strokeWidth="1.2" />
          <text x={cx} y={lineY + 62} textAnchor="middle" fontSize="9" fontWeight="900" fill="#1e293b" fontFamily="ui-monospace, monospace">KANBAN</text>
        </g>
      )}
      <text x={cx} y={lineY + 30} textAnchor="middle" fontSize="11" fontWeight="800" fill={qtyColor} fontFamily="ui-monospace, monospace">{p.inventoryBefore} AD</text>
      <text x={cx} y={lineY + 43} textAnchor="middle" fontSize="10" fontWeight="700" fill={dayColor} fontFamily="ui-monospace, monospace">{p.inventoryDays} gün</text>
    </g>
  );
}

// ---------- process card (same look as before + C/O and batch row, pacemaker badge) ----------

function ProcessCard({ p, style, graphBadge }: { p: Tl; style: React.CSSProperties; graphBadge?: boolean }) {
  const { vsmBrightMode, bottleneckProcess, highestDowntimeProcess, lowestOeeProcess, vsmCriticalPath, handleOpenProcessDrawer, mapSetup: factorySetup, vsmSettings } = useVsm();
  const isBottleneck = p.id === bottleneckProcess?.id;
  const isHighDowntime = p.id === highestDowntimeProcess?.id;
  // Customer OEE target (VSM settings) when set; otherwise the lowest-OEE process is highlighted.
  const isLowOee = vsmSettings.oeeTarget > 0 ? p.oee < vsmSettings.oeeTarget : p.id === lowestOeeProcess?.id;
  const isOnCriticalPath = vsmCriticalPath.criticalPathIds.has(p.id);
  const isPacemaker = factorySetup.scheduleMode === "pacemaker" && factorySetup.pacemakerProcessId === p.id;

  let borderClass = vsmBrightMode ? "border-slate-200 hover:border-sky-500" : "border-slate-800 hover:border-sky-500";
  let bgHeader = vsmBrightMode ? "bg-slate-100 text-slate-800 border-b border-slate-200" : "bg-slate-950/90 text-slate-100";
  if (isBottleneck) {
    borderClass = "border-red-500 hover:border-red-400 ring-2 ring-red-500/20";
    bgHeader = vsmBrightMode ? "bg-red-50 text-red-800 border-b border-red-200" : "bg-red-950/90 text-red-100";
  } else if (isLowOee || isHighDowntime) {
    borderClass = "border-amber-500 hover:border-amber-400";
    bgHeader = vsmBrightMode ? "bg-amber-50 text-amber-800 border-b border-amber-200" : "bg-amber-950/90 text-amber-100";
  }
  const lbl = vsmBrightMode ? "text-slate-400 text-[11px] uppercase" : "text-slate-500 text-[11px] uppercase";
  const val = vsmBrightMode ? "text-slate-800" : "text-slate-200";
  const line = vsmBrightMode ? "border-slate-100" : "border-slate-800/80";

  return (
    <div
      onClick={() => handleOpenProcessDrawer(p.id)}
      className={`absolute ${vsmBrightMode ? "bg-white text-slate-800 shadow-md border" : "bg-slate-950/95 text-white border shadow-2xl"} ${borderClass} rounded-2xl w-[220px] z-10 transition-all transform hover:-translate-y-1 cursor-pointer flex flex-col overflow-hidden font-sans`}
      style={style}
    >
      <div className={`px-3 py-2 ${bgHeader} flex justify-between items-center gap-1`}>
        <span className="text-[10px] font-black tracking-wider truncate uppercase">{p.name}</span>
        <span className="flex items-center gap-1 shrink-0">
          {isPacemaker && <span className="text-[9px] font-black bg-indigo-600 text-white px-1 rounded">PACEMAKER</span>}
          {!!p.mergedFrom?.length && p.mergedFrom.length > 1 && <span className="text-[9px] font-black bg-emerald-600 text-white px-1 rounded" title="Birleştirilmiş adım (sürekli akış)">AKIŞ</span>}
          <span className={`text-[11px] font-mono ${vsmBrightMode ? "bg-slate-200 text-slate-700" : "bg-slate-800 text-slate-300"} px-1.5 rounded font-extrabold uppercase`}>
            {p.type === "Manual" ? "MNL" : "OTO"}
          </span>
        </span>
      </div>

      <div className={`p-3 grid grid-cols-2 gap-1.5 text-[10px] font-mono ${vsmBrightMode ? "bg-white text-slate-600" : "bg-slate-950 text-slate-400"}`}>
        <div className="flex flex-col">
          <span className={lbl}>Mak / Op</span>
          <span className={`font-bold mt-0.5 ${val}`}>{p.machineCount} M / {p.operatorCount} O</span>
        </div>
        <div className={`flex flex-col border-l ${line} pl-2`}>
          <span className={lbl}>Çevrim (C/T)</span>
          <span className={`font-bold mt-0.5 ${isBottleneck ? "text-red-500 text-[11px]" : val}`}>{p.cycleTime} sn</span>
        </div>
        <div className={`flex flex-col border-t ${line} pt-1`}>
          <span className={lbl}>OEE Skoru</span>
          <span className={`font-bold mt-0.5 ${isLowOee ? "text-amber-500" : val}`}>%{p.oee}</span>
        </div>
        <div className={`flex flex-col border-t border-l ${line} pt-1 pl-2`}>
          <span className={lbl}>Kapasite</span>
          <span className="font-bold text-emerald-600 mt-0.5">{p.capacity} ad/g</span>
        </div>
        <div className={`flex flex-col border-t ${line} pt-1`}>
          <span className={lbl}>C/O · Parti</span>
          <span className={`font-bold mt-0.5 ${val}`}>{p.changeoverTime !== undefined ? `${p.changeoverTime} dk` : "—"} · {p.batchSize ?? "—"}</span>
        </div>
        <div className={`flex flex-col border-t border-l ${line} pt-1 pl-2`}>
          <span className={lbl}>Uptime</span>
          <span className={`font-bold mt-0.5 ${val}`}>%{p.availability}</span>
        </div>
        <div className={`flex flex-col border-t ${line} pt-1`}>
          <span className={lbl}>Vardiya</span>
          <span className={`font-bold mt-0.5 ${val}`}>{p.shifts}v x {p.workingHours}sa</span>
        </div>
        <div className={`flex flex-col border-t border-l ${line} pt-1 pl-2`}>
          <span className={lbl}>Duruş</span>
          <span className={`font-bold mt-0.5 ${isHighDowntime ? "text-amber-500" : val}`}>{p.downtimeMinutes} dk/g</span>
        </div>
      </div>

      {graphBadge && (
        <div className={`px-3 py-1.5 border-t flex justify-between items-center text-[11px] font-mono font-bold ${
          isOnCriticalPath ? "bg-red-50 border-red-200 text-red-700" : (vsmBrightMode ? "bg-amber-50 border-slate-100 text-amber-700" : "bg-slate-900/65 border-slate-800/60 text-amber-400")
        }`}>
          <span>{stockTypeOf(p) === "supermarket" ? "⊞" : stockTypeOf(p) === "fifo" ? "FIFO" : "△"} {p.inventoryBefore} AD</span>
          <span>{p.inventoryDays} gün{isOnCriticalPath ? " ⚠" : ""}</span>
        </div>
      )}

      <div className={`px-3 py-1.5 border-t ${vsmBrightMode ? "bg-slate-50 border-slate-100 text-slate-500" : "bg-slate-900/65 border-slate-800/60 text-slate-400"} flex justify-between items-center text-[11px] font-mono font-bold`}>
        <span>FPY Oranı: %{p.quality}</span>
        {isBottleneck && <span className="text-red-600 border border-red-200/50 rounded px-1 animate-pulse">DARBOĞAZ</span>}
      </div>
    </div>
  );
}

// ---------- the stage ----------

export default function VsmMapCanvas() {
  const {
    vsmBrightMode, mapLayout: L, processesWithTimeline, isFlowLinear, vsmGraphEdges, vsmGraphLayout, mapSetup: factorySetup, mapEndStocks: endStocks,
    kaizenBursts, simulationMode, vsmSettings,
    valueAddedSeconds, totalLeadTimeDays, totalProcessingTimeSeconds, valueAddedRatio, vsmLaneSummaries,
    selectedCustomer, dailyDemand, weeklyDemand, monthlyDemand, taktTime, pitchTime
  } = useVsm();
  const bright = vsmBrightMode;
  const procs = processesWithTimeline as Tl[];
  const amber = bright ? "#b45309" : "#fbbf24";
  const green = bright ? "#059669" : "#10b981";
  const blue = bright ? "#0284c7" : "#38bdf8";
  const lineY = L.lineY;
  const s = factorySetup;

  const supplierCx = MAP.supplierX + MAP.boxW / 2;
  const planningCx = L.planning.x + L.planning.w / 2;
  const customerCx = L.customer.x + L.customer.w / 2;
  const receivesSchedule = (id: string) => s.scheduleMode !== "pacemaker" || !s.pacemakerProcessId || s.pacemakerProcessId === id;
  const label = (freq?: string, ch?: string) => [freq, ch].filter(Boolean).join(" · ");

  // Card positions for both modes.
  const posOf = (p: Tl, idx: number) => {
    if (isFlowLinear) return { x: L.cardX(idx), y: MAP.cardTop };
    const g = vsmGraphLayout.positions.get(p.id);
    return g ? { x: g.x, y: g.y } : { x: L.cardX(idx), y: MAP.cardTop };
  };
  const first = procs[0];
  const firstPos = first ? posOf(first, 0) : { x: MAP.startX, y: MAP.cardTop };
  const lastIdx = procs.length - 1;
  // Graph mode: the last column's first-lane card feeds the customer.
  const sinkIdx = isFlowLinear ? lastIdx : procs.reduce((best, p, i) => ((vsmGraphLayout.positions.get(p.id)?.rank ?? 0) > (vsmGraphLayout.positions.get(procs[best]?.id)?.rank ?? -1) ? i : best), 0);
  const sinkPos = procs[sinkIdx] ? posOf(procs[sinkIdx], sinkIdx) : { x: L.lastRight - MAP.cardW, y: MAP.cardTop };
  const sourceY = firstPos.y + 110;
  const sinkY = sinkPos.y + 110;
  const rawCx = MAP.rawZoneX + MAP.stockW / 2;
  const fgCx = L.fgZoneX + MAP.stockW / 2;

  return (
    <>
      <svg className="absolute inset-0 pointer-events-none z-0" width={L.width} height={L.height}>
        <defs>
          <marker id="solid-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill={blue} />
          </marker>
          <marker id="dashed-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill={amber} />
          </marker>
          <marker id="supplier-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill={green} />
          </marker>
          <marker id="pull-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill={bright ? "#475569" : "#94a3b8"} />
          </marker>
          <pattern id="push-stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill={bright ? "#e0f2fe" : "#0c4a6e"} />
            <rect width="3" height="8" fill={blue} />
          </pattern>
        </defs>

        {/* INFORMATION FLOW: customer → production control → supplier (electronic = zig-zag) */}
        <path d={infoPath(L.customer.x, L.planning.x + L.planning.w + 4, MAP.infoY, s.customerOrderChannel === "Elektronik")}
          fill="none" stroke={amber} strokeWidth="1.6" strokeDasharray={s.customerOrderChannel === "Elektronik" ? undefined : "5,5"} markerEnd="url(#dashed-arrow)" />
        <path d={infoPath(L.planning.x, MAP.supplierX + MAP.boxW + 4, MAP.infoY, s.supplierOrderChannel === "Elektronik")}
          fill="none" stroke={amber} strokeWidth="1.6" strokeDasharray={s.supplierOrderChannel === "Elektronik" ? undefined : "5,5"} markerEnd="url(#dashed-arrow)" />
        {label(s.customerOrderFrequency, s.customerOrderChannel) && (
          <text x={(L.customer.x + L.planning.x + L.planning.w) / 2} y={MAP.infoY - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill={bright ? "#92400e" : "#fcd34d"} fontFamily="ui-monospace, monospace">
            {label(s.customerOrderFrequency, s.customerOrderChannel)}
          </text>
        )}
        {label(s.supplierOrderFrequency, s.supplierOrderChannel) && (
          <text x={(L.planning.x + MAP.supplierX + MAP.boxW) / 2} y={MAP.infoY - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill={bright ? "#92400e" : "#fcd34d"} fontFamily="ui-monospace, monospace">
            {label(s.supplierOrderFrequency, s.supplierOrderChannel)}
          </text>
        )}

        {/* SCHEDULE: production control → every process (push) or only the pacemaker */}
        {(() => {
          const targets = procs.map((p, i) => ({ p, pos: posOf(p, i) })).filter(t => receivesSchedule(t.p.id));
          if (targets.length === 0) return null;
          const xs = targets.map(t => t.pos.x + MAP.cardW / 2);
          const minX = Math.min(planningCx, ...xs), maxX = Math.max(planningCx, ...xs);
          return (
            <g stroke={amber} strokeWidth="1.2" strokeDasharray="4,4" fill="none">
              <path d={`M ${planningCx},175 L ${planningCx},${MAP.scheduleBusY}`} />
              <path d={`M ${minX},${MAP.scheduleBusY} L ${maxX},${MAP.scheduleBusY}`} />
              {targets.map(t => (
                <path key={t.p.id} d={`M ${t.pos.x + MAP.cardW / 2},${MAP.scheduleBusY} L ${t.pos.x + MAP.cardW / 2},${t.pos.y - 6}`} markerEnd="url(#dashed-arrow)" />
              ))}
            </g>
          );
        })()}

        {/* SUPPLIER → (truck) → raw material → first process */}
        <path d={`M ${rawCx},250 L ${rawCx},${sourceY - 74}`} fill="none" stroke={green} strokeWidth="2.5" strokeDasharray="6,4" markerEnd="url(#supplier-arrow)" />
        <Truck x={rawCx + 6} y={268} label={s.supplierDelivery || undefined} bright={bright} />
        {s.rawMaterialQty
          ? <Triangle cx={rawCx} y={sourceY - 72} label="I" qty={s.rawMaterialQty} days={endStocks.rawDays} bright={bright} />
          : <text x={rawCx} y={sourceY - 40} textAnchor="middle" fontSize="10" fill={bright ? "#94a3b8" : "#64748b"} fontFamily="ui-monospace, monospace">hammadde —</text>}
        {first && isFlowLinear && <MaterialLink x1={rawCx + 26} x2={L.stockZoneX(0)} y={sourceY} type="pile" bright={bright} />}
        {first && !isFlowLinear && <MaterialLink x1={rawCx + 26} x2={firstPos.x} y={sourceY} type="pile" bright={bright} />}

        {/* LINEAR FLOW: stock zone in front of each process + material link drawn by its stock type */}
        {isFlowLinear && procs.map((p, i) => (
          <g key={`flow-${p.id}`}>
            <StockZone x={L.stockZoneX(i)} lineY={lineY} p={p} bright={bright} wipDaysWarning={vsmSettings.wipDaysWarning} />
            <MaterialLink x1={i === 0 ? L.stockZoneX(0) : L.cardX(i - 1) + MAP.cardW} x2={L.cardX(i)} y={lineY} type={stockTypeOf(p)} bright={bright} />
          </g>
        ))}

        {/* GRAPH FLOW: one arrow per edge (stock shown inside the cards) */}
        {!isFlowLinear && vsmGraphEdges.map((edge, i) => {
          const from = vsmGraphLayout.positions.get(edge.fromId);
          const to = vsmGraphLayout.positions.get(edge.toId);
          if (!from || !to) return null;
          const x1 = from.x + MAP.cardW, y1 = from.y + 110, x2 = to.x, y2 = to.y + 110;
          const dashed = edge.type === "Kanban" || edge.type === "Supermarket";
          const d = from.lane === to.lane ? `M ${x1},${y1} L ${x2},${y2}` : `M ${x1},${y1} C ${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
          return <path key={`edge-${i}`} d={d} fill="none" stroke={blue} strokeWidth="3" strokeDasharray={dashed ? "6,4" : undefined} markerEnd="url(#solid-arrow)" />;
        })}

        {/* LAST PROCESS → finished goods → (truck) → customer */}
        {procs.length > 0 && <MaterialLink x1={sinkPos.x + MAP.cardW} x2={fgCx - 26} y={sinkY} type="pile" bright={bright} />}
        {s.finishedGoodsQty
          ? <Triangle cx={fgCx} y={sinkY - 72} label="I" qty={s.finishedGoodsQty} days={endStocks.fgDays} bright={bright} />
          : <text x={fgCx} y={sinkY - 40} textAnchor="middle" fontSize="10" fill={bright ? "#94a3b8" : "#64748b"} fontFamily="ui-monospace, monospace">mamul —</text>}
        <path d={`M ${fgCx + 26},${sinkY} L ${customerCx},${sinkY} L ${customerCx},280`} fill="none" stroke={green} strokeWidth="2.5" strokeDasharray="6,4" markerEnd="url(#supplier-arrow)" />
        <Truck x={customerCx + 8} y={Math.min(sinkY - 40, 320)} label={s.shippingFrequency || undefined} bright={bright} />

        {/* TIMELINE LADDER (linear): wait over each stock zone, value-added time under each card */}
        {isFlowLinear && procs.length > 0 && (() => {
          const top = L.timelineTop, hi = top + 8, lo = top + 46;
          const segs: { x1: number; x2: number; level: "hi" | "lo"; text: string }[] = [];
          if (endStocks.rawDays > 0) segs.push({ x1: MAP.rawZoneX, x2: L.stockZoneX(0), level: "hi", text: `${endStocks.rawDays} g` });
          procs.forEach((p, i) => {
            segs.push({ x1: L.stockZoneX(i), x2: L.cardX(i), level: "hi", text: `${p.inventoryDays} g` });
            segs.push({ x1: L.cardX(i), x2: L.cardX(i) + MAP.cardW, level: "lo", text: `${valueAddedSeconds(p)} sn${p.valueAddedTime !== undefined ? " VA" : ""}` });
          });
          if (endStocks.fgDays > 0) segs.push({ x1: L.lastRight, x2: L.fgZoneX + MAP.stockW, level: "hi", text: `${endStocks.fgDays} g` });
          const yOf = (lv: "hi" | "lo") => (lv === "hi" ? hi : lo);
          let d = "";
          segs.forEach((g, i) => { d += `${i === 0 ? "M" : "L"} ${g.x1},${yOf(g.level)} L ${g.x2},${yOf(g.level)} `; });
          const totalX = L.fgZoneX + MAP.stockW + 16;
          return (
            <g fontFamily="ui-monospace, monospace">
              <path d={d} fill="none" stroke={bright ? "#475569" : "#94a3b8"} strokeWidth="2" />
              {segs.map((g, i) => (
                <text key={i} x={(g.x1 + g.x2) / 2} y={g.level === "hi" ? hi - 6 : lo + 16} textAnchor="middle" fontSize="11" fontWeight="800"
                  fill={g.level === "hi" ? amber : blue}>{g.text}</text>
              ))}
              <text x={MAP.rawZoneX} y={top - 14} fontSize="10" fontWeight="900" fill={bright ? "#64748b" : "#94a3b8"}>BEKLEME (NVA) ↑ · KATMA DEĞER (VA) ↓</text>
              <g>
                <rect x={totalX} y={top - 6} width="190" height="68" rx="8" fill={bright ? "#ffffff" : "#0f172a"} stroke={bright ? "#cbd5e1" : "#334155"} />
                <text x={totalX + 10} y={top + 12} fontSize="11" fontWeight="800" fill={amber}>Lead time: {totalLeadTimeDays} gün</text>
                <text x={totalX + 10} y={top + 30} fontSize="11" fontWeight="800" fill={blue}>Katma değer: {totalProcessingTimeSeconds} sn</text>
                <text x={totalX + 10} y={top + 48} fontSize="11" fontWeight="800" fill={green}>PCE: %{valueAddedRatio}</text>
              </g>
            </g>
          );
        })()}
      </svg>

              {/* ========================================== */}
              {/* 1. CUSTOMER AREA (TOP RIGHT)               */}
              {/* ========================================== */}
              <div 
                className={`absolute ${vsmBrightMode ? 'bg-white border-slate-200 text-slate-800 shadow-lg' : 'bg-slate-950/90 border-slate-800 text-white shadow-xl'} p-4 rounded-2xl w-[260px] border z-10 font-sans`}
                style={{ top: MAP.boxTop, left: L.customer.x }}
              >
                <div className={`flex items-center space-x-2 border-b ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pb-2 mb-2`}>
                  <div className="bg-emerald-600 p-1.5 rounded-lg">
                    {/* Castle / Sawtooth Lean factory logo */}
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 21h18M3 10l4-4h10l4 4M5 10v11M19 10v11M12 10v11" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wide uppercase">MÜŞTERİ</h3>
                    <p className={`text-[10px] ${vsmBrightMode ? 'text-slate-500' : 'text-slate-400'} truncate max-w-[160px]`}>{factorySetup.customerName || selectedCustomer?.companyName || "—"}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Ürün Ailesi:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.productFamily || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Günlük Talep:</span>
                    <span className="font-bold text-amber-550 dark:text-amber-400">{dailyDemand} ad/gün</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Haftalık Talep:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{weeklyDemand} ad</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Aylık Sipariş:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{monthlyDemand} ad</span>
                  </div>
                  <div className={`flex justify-between border-t ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pt-1.5 mt-1.5`}>
                    <span className={vsmBrightMode ? 'text-slate-500 font-bold' : 'text-slate-400 font-bold'}>Takt Süresi:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">{taktTime > 0 ? `${taktTime} sn` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sevk Sıklığı:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.shippingFrequency || "—"}</span>
                  </div>
                  {factorySetup.orderType && (
                    <div className="flex justify-between">
                      <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sipariş Tipi:</span>
                      <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.orderType.split(" ")[0]}</span>
                    </div>
                  )}
                  {factorySetup.customerShipmentBatch && (
                    <div className="flex justify-between">
                      <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sevk Partisi:</span>
                      <span className={`font-bold truncate max-w-[130px] ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.customerShipmentBatch}</span>
                    </div>
                  )}
                  {pitchTime > 0 && (
                    <div className="flex justify-between">
                      <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Pitch:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{Math.round(pitchTime / 6) / 10} dk</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ========================================== */}
              {/* 2. PLANNING / PRODUCTION CONTROL (TOP CENTER) */}
              {/* ========================================== */}
              <div 
                className={`absolute ${vsmBrightMode ? 'bg-white border-slate-200 text-slate-800 shadow-lg' : 'bg-slate-950/90 border-slate-800 text-white shadow-xl'} p-4 rounded-2xl w-[280px] border z-10 text-center`}
                style={{ top: MAP.boxTop, left: L.planning.x }}
              >
                <div className={`flex items-center justify-center space-x-2 border-b ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pb-2 mb-2`}>
                  <div className="bg-yellow-500 p-1.5 rounded-lg text-slate-950">
                    <Settings className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-black tracking-wide uppercase">ÜRETİM PLANLAMA & MRP / ERP</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left text-[10px] font-mono">
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Planlama Sistemi</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>{factorySetup.planningSystem || "—"}</span>
                  </div>
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Planlama Sıklığı</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>{factorySetup.planningFrequency || "—"}</span>
                  </div>
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sıralama Rejimi</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>{factorySetup.planningSequencing || "—"}</span>
                  </div>
                  <div className={`${vsmBrightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'} p-2 rounded-lg border`}>
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Üretim Takvimi</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'} block mt-0.5`}>{factorySetup.planningCalendar || "—"}</span>
                  </div>
                </div>
              </div>

              {/* ========================================== */}
              {/* 3. SUPPLIER AREA (TOP LEFT)                */}
              {/* ========================================== */}
              <div 
                className={`absolute ${vsmBrightMode ? 'bg-white border-slate-200 text-slate-800 shadow-lg' : 'bg-slate-950/90 border-slate-800 text-white shadow-xl'} p-4 rounded-2xl w-[260px] border z-10 font-sans`}
                style={{ top: MAP.boxTop, left: MAP.supplierX }}
              >
                <div className={`flex items-center space-x-2 border-b ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pb-2 mb-2`}>
                  <div className="bg-indigo-600 p-1.5 rounded-lg">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 21h18M3 10l4-4h10l4 4M5 10v11M19 10v11M12 10v11" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wide uppercase">TEDARİKÇİ</h3>
                    <p className={`text-[10px] ${vsmBrightMode ? 'text-slate-500' : 'text-slate-400'} truncate max-w-[160px]`}>{factorySetup.supplierName || "—"}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Malzeme Rejimi:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.supplierMaterial || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Sevk Sıklığı:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.supplierDelivery || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Parti Büyüklüğü:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.supplierBatch || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={vsmBrightMode ? 'text-slate-450' : 'text-slate-500'}>Tedarik Temin:</span>
                    <span className={`font-bold ${vsmBrightMode ? 'text-slate-800' : 'text-slate-200'}`}>{factorySetup.supplierLeadTime || "—"}</span>
                  </div>
                  <div className={`flex justify-between border-t ${vsmBrightMode ? 'border-slate-100' : 'border-slate-800'} pt-1.5 mt-1.5`}>
                    <span className={vsmBrightMode ? 'text-slate-500 font-bold' : 'text-slate-400 font-bold'}>Lojistik Yöntemi:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">{factorySetup.supplierLogistics || "—"}</span>
                  </div>
                </div>
              </div>


      {/* PROCESS CARDS */}
      {procs.map((p, i) => {
        const pos = posOf(p, i);
        return <ProcessCard key={p.id} p={p} style={{ left: pos.x, top: pos.y }} graphBadge={!isFlowLinear} />;
      })}

      {/* KAIZEN BURSTS of this map, pinned above the process they belong to */}
      {(() => {
        const mine = kaizenBursts.filter(b => b.map === simulationMode && b.processId);
        const perProcess = new Map<string, number>();
        return mine.map(b => {
          const idx = procs.findIndex(p => p.id === b.processId);
          if (idx < 0) return null;
          const pos = posOf(procs[idx], idx);
          const k = perProcess.get(b.processId!) ?? 0;
          perProcess.set(b.processId!, k + 1);
          const no = kaizenBursts.indexOf(b) + 1;
          return (
            <div key={b.id} className="absolute z-20 flex items-center gap-1 pointer-events-none" style={{ left: pos.x + 120 - k * 30, top: pos.y - 46 }} title={b.title}>
              <svg width="40" height="40" viewBox="0 0 40 40">
                <polygon points="20,1 24,12 35,6 29,16 39,20 29,24 35,34 24,28 20,39 16,28 5,34 11,24 1,20 11,16 5,6 16,12"
                  fill={b.status === "Tamamlandı" ? "#bbf7d0" : "#fde047"} stroke="#dc2626" strokeWidth="2" />
                <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="900" fill="#991b1b" fontFamily="ui-monospace, monospace">K{no}</text>
              </svg>
              {k === 0 && <span className="text-[10px] font-black text-red-700 bg-white/90 border border-red-200 rounded px-1 max-w-[150px] truncate">{b.title}</span>}
            </div>
          );
        });
      })()}

      {/* GRAPH MODE: per-lane lead time summary (critical path highlighted) */}
      {!isFlowLinear && (
        <div className={`absolute border-t ${bright ? "border-slate-200" : "border-slate-800"} pt-4`}
          style={{ left: MAP.rawZoneX, top: L.timelineTop, width: L.width - 2 * MAP.rawZoneX }}>
          <h4 className={`text-[10px] font-black uppercase tracking-wider font-mono mb-2 ${bright ? "text-slate-500" : "text-slate-400"}`}>
            Hat Bazlı Lead Time Özeti (Kritik Yol Vurgulu) — toplam {totalLeadTimeDays} gün
          </h4>
          <div className="space-y-1.5">
            {vsmLaneSummaries.map(({ lane, processes, waitDays, processingSeconds, isCritical }) => (
              <div key={lane} className={`flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-mono ${
                isCritical ? "bg-red-50 border border-red-200 text-red-700" : (bright ? "bg-slate-50 border border-slate-200 text-slate-600" : "bg-slate-900/60 border border-slate-800 text-slate-400")
              }`}>
                <span className="font-bold truncate">{isCritical && "⚠ "}Hat {lane + 1}: {processes.map(p => p.name).join(" → ")}</span>
                <span className="shrink-0 ml-3">Bekleme: <b>{waitDays} gün</b> • İşleme: <b>{processingSeconds} sn</b></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
