// One-page A3 presentation card of a CI project (plan steps C8 / C8b, requirements B9–B11). Fixed A4
// landscape size (1123 × 794 px at 96 dpi) so the screen preview, the PDF (captured as an image) and
// print are the same page. Charts first, little text: step strip (8 steps with dates), left = PLAN
// (problem + loss, current state as a bar chart when it lists figures, target as columns with the
// gap to the target line), right = root cause (fishbone, else the 5-Why chain), action plan (mini
// Gantt with progress), results (before / after columns + follow-ups, expected vs realized gain) and
// standardization. Everything comes from the A3 fields; long texts are clamped to keep one page.
import React from "react";
import type { KaizenCard } from "../../types";
import { kpiOf, rootCauseOf, taskStatusOf, stageOf, isClosed, latestMeasurement, CI_STEPS, CiKpi, CiFishboneCause } from "../../utils/ciLifecycle";
import { taskProgress } from "../../utils/ciPlan";
import { formatAmount } from "./ciUi";

export const A3_WIDTH = 1123;
export const A3_HEIGHT = 794;

interface Props {
  project: KaizenCard;
  projectNo: string;
  companyName?: string;
  currencySymbol: string;
}

// Plan–Do–Check–Act in Turkish (no English labels on the card).
const PDCA = {
  PLAN: { label: "PLANLA", color: "#2563eb", soft: "#eff6ff" },
  DO: { label: "UYGULA", color: "#d97706", soft: "#fffbeb" },
  CHECK: { label: "KONTROL ET", color: "#7c3aed", soft: "#f5f3ff" },
  ACT: { label: "ÖNLEM AL", color: "#059669", soft: "#ecfdf5" }
} as const;

const C = { ink: "#0f172a", text: "#334155", mute: "#64748b", faint: "#94a3b8", line: "#e2e8f0", grid: "#f1f5f9", blue: "#2563eb", red: "#dc2626", green: "#059669", amber: "#d97706" };

// Fixed layout (px) — the charts are drawn for these sizes.
const PAD = 16, GAP = 8;
const LEFT_W = 455;
const RIGHT_W = A3_WIDTH - 2 * PAD - LEFT_W - GAP; // 626
const INNER = (w: number) => w - 22;                 // section padding + border
const RESULT_W = 350;

const DAY = 86400000;
const toTime = (iso?: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(`${iso.slice(0, 10)}T00:00:00`).getTime() : NaN);
const fmtDate = (iso?: string | null) => iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("tr-TR") : "—";
const fmtShort = (iso?: string | null) => fmtDate(iso).slice(0, 5);
const clamp = (lines: number): React.CSSProperties => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" });
const oneLine: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1)).trimEnd()}…` : s);
const plainName = (s?: string) => (s || "").replace(/\s*\([^)]*\)\s*$/, "");
// Rough width of SVG text, for truncating labels to the space they have.
const charsFor = (px: number, fontSize: number) => Math.max(4, Math.floor(px / (fontSize * 0.54)));

function Section({ no, title, pdca, children, style, aside }: { no: number | string; title: string; pdca: keyof typeof PDCA; children: React.ReactNode; style?: React.CSSProperties; aside?: React.ReactNode }) {
  const c = PDCA[pdca];
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "7px 10px", background: "#fff", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexShrink: 0 }}>
        <span style={{ minWidth: 18, height: 18, padding: "0 4px", boxSizing: "border-box", borderRadius: 9, background: c.color, color: "#fff", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{no}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.ink, whiteSpace: "nowrap" }}>{title}</span>
        {aside && <span style={{ marginLeft: 6, minWidth: 0, ...oneLine }}>{aside}</span>}
        <span style={{ marginLeft: "auto", fontSize: 8.5, fontWeight: 800, color: c.color, background: c.soft, borderRadius: 4, padding: "1px 5px", letterSpacing: 0.4, flexShrink: 0 }}>{c.label}</span>
      </div>
      <div style={{ fontSize: 10.5, lineHeight: 1.35, color: C.text, minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: C.faint, fontSize: 10, fontStyle: "italic" }}>{children}</div>;
}

function Tile({ label, value, color = C.ink, soft = "#f8fafc" }: { label: string; value: React.ReactNode; color?: string; soft?: string }) {
  return (
    <div style={{ background: soft, borderRadius: 7, padding: "3px 7px", minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 8.5, color: C.mute, fontWeight: 700, ...oneLine }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 900, color, ...oneLine }}>{value}</div>
    </div>
  );
}

// ---------- step strip: the 8 A3 steps with planned / completed dates ----------

function StepStrip({ p }: { p: KaizenCard }) {
  const stage = stageOf(p);
  const closed = isClosed(p);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, flexShrink: 0 }}>
      {CI_STEPS.map(s => {
        const c = PDCA[s.pdca as keyof typeof PDCA];
        const d = p.stageDates?.[String(s.no)] || p.stageDates?.[s.no as any];
        const done = closed || s.no < stage || !!d?.completed;
        const current = !closed && s.no === stage;
        const late = !done && d?.planned && toTime(d.planned) < new Date(new Date().toDateString()).getTime();
        return (
          <div key={s.no} style={{ borderRadius: 7, padding: "3px 6px", background: done ? c.soft : "#fff", border: `1px solid ${current ? c.color : done ? c.soft : C.line}`, boxShadow: current ? `inset 0 0 0 1px ${c.color}` : undefined, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 13, height: 13, borderRadius: 7, background: done || current ? c.color : C.line, color: "#fff", fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{done ? "✓" : s.no}</span>
              <span style={{ fontSize: 9, fontWeight: 800, color: done || current ? C.ink : C.faint, ...oneLine }}>{s.short}</span>
            </div>
            <div style={{ fontSize: 8, color: late ? C.red : C.mute, marginTop: 1, ...oneLine }}>
              {d?.completed ? `✓ ${fmtDate(d.completed)}` : d?.planned ? `Plan ${fmtDate(d.planned)}` : current ? "Devam ediyor" : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- 2: current state — "label: 31 dk" items as a Pareto bar chart ----------

interface Figure { label: string; value: number; unit: string }

const parseNumber = (s: string) => /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s.replace(",", "."));

// "Intro: • Kalıp getirme: 31 dk (…) • Bağlama: 24 dk" → intro + figures. Needs at least two figures.
export function figuresOf(text: string): { intro: string; figures: Figure[] } | null {
  const parts = text.split(/\s*(?:•|\n|;)\s*/).map(s => s.trim()).filter(Boolean);
  const figures: Figure[] = [];
  const rest: string[] = [];
  for (const part of parts) {
    const m = part.match(/^(.{2,80}?)\s*[:=–-]\s*(\d[\d.,]*)\s*([^\s(),.;]*)/);
    const value = m ? parseNumber(m[2]) : NaN;
    if (m && Number.isFinite(value)) figures.push({ label: m[1].trim(), value, unit: m[3] || "" });
    else if (!figures.length) rest.push(part);
  }
  if (figures.length < 2) return null;
  return { intro: rest.join(" ").replace(/:\s*$/, ""), figures: figures.sort((a, b) => b.value - a.value) };
}

function FigureBars({ figures, max = 5 }: { figures: Figure[]; max?: number }) {
  const shown = figures.slice(0, max);
  const top = Math.max(...shown.map(f => f.value), 1);
  const total = figures.reduce((s, f) => s + f.value, 0);
  const labelW = 150;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {shown.map((f, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: `${labelW}px 1fr 64px`, alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9.5, color: C.text, ...oneLine }}>{f.label}</span>
          <div style={{ height: 11, background: C.grid, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(f.value / top) * 100}%`, background: i === 0 ? C.red : "#f87171", opacity: 1 - i * 0.12, borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 9.5, fontWeight: 800, color: C.ink, textAlign: "right", whiteSpace: "nowrap" }}>
            {formatAmount(f.value)} {f.unit}{total > 0 && <span style={{ color: C.faint, fontWeight: 600 }}> %{Math.round((f.value / total) * 100)}</span>}
          </span>
        </div>
      ))}
      {figures.length > shown.length && <span style={{ fontSize: 8.5, color: C.mute }}>+{figures.length - shown.length} kalem daha</span>}
    </div>
  );
}

// ---------- 3: target — measured values as columns, target line, gap to the target hatched ----------

const meets = (kpi: CiKpi, v: number) => kpi.target === null ? null : kpi.direction === "decrease" ? v <= kpi.target : v >= kpi.target;

function HatchDef({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
        <rect width="5" height="5" fill="#fee2e2" />
        <line x1="0" y1="0" x2="0" y2="5" stroke="#ef4444" strokeWidth="2" />
      </pattern>
    </defs>
  );
}

interface Bar { label: string; value: number; kind: "base" | "measure" | "after" | "follow"; ok?: boolean | null }

// Column chart with a dashed target line. Where a column misses the target the space between them
// is hatched red ("improvement gap") and labelled with the difference.
function GapColumns({ kpi, bars, width, height, id, gapLabels = true }: { kpi: CiKpi; bars: Bar[]; width: number; height: number; id: string; gapLabels?: boolean }) {
  const t = kpi.target;
  const dec = kpi.direction === "decrease";
  const max = Math.max(...bars.map(b => b.value), t ?? 0) * 1.08 || 1;
  const min = Math.min(0, ...bars.map(b => b.value));
  const pad = { l: 30, r: t !== null ? 58 : 8, t: 12, b: 16 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const y = (v: number) => pad.t + h - ((v - min) / (max - min || 1)) * h;
  const slot = w / bars.length;
  const bw = Math.min(44, slot * 0.6);
  const base = y(0);
  const lastGap = [...bars].reverse().find(b => meets(kpi, b.value) === false);
  const unit = kpi.unit ? ` ${kpi.unit}` : "";
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <HatchDef id={id} />
      {[0, 0.5, 1].map(f => {
        const v = min + (max / 1.08 - min) * f;
        return (
          <g key={f}>
            <line x1={pad.l} x2={pad.l + w} y1={y(v)} y2={y(v)} stroke={C.grid} />
            <text x={pad.l - 4} y={y(v) + 3} fontSize="8" textAnchor="end" fill={C.faint}>{formatAmount(v, 1)}</text>
          </g>
        );
      })}
      {bars.map((b, i) => {
        const cx = pad.l + slot * i + slot / 2;
        const x = cx - bw / 2;
        const ok = meets(kpi, b.value);
        const fill = b.kind === "base" ? "#94a3b8" : ok === false ? C.blue : ok ? C.green : C.blue;
        const top = y(b.value);
        let gapRect: React.ReactNode = null;
        let gapMid = 0, gapVal = 0;
        if (t !== null && ok === false) {
          const a = y(t);
          // decrease: the part of the column above the target is the gap; increase: the empty space above it
          const y1 = Math.min(a, top), y2 = Math.max(a, top);
          gapMid = (y1 + y2) / 2;
          gapVal = Math.abs(b.value - t);
          gapRect = <rect x={x} y={y1} width={bw} height={Math.max(1, y2 - y1)} fill={`url(#${id})`} stroke="#ef4444" strokeWidth="1" strokeDasharray={dec ? undefined : "3 2"} rx="2" />;
        }
        const solidTop = t !== null && ok === false && dec ? y(t) : top;
        let labelY = Math.min(top, t !== null && ok === false && !dec ? y(t) : top) - 3;
        if (t !== null && Math.abs(labelY - y(t)) < 6) labelY = Math.min(labelY, y(t)) - 6; // keep clear of the target line
        const showGap = gapLabels && gapRect && (i === 0 || b === lastGap) && gapVal > 0;
        return (
          <g key={i}>
            <rect x={x} y={solidTop} width={bw} height={Math.max(0, base - solidTop)} fill={fill} rx="2" />
            {gapRect}
            <text x={cx} y={labelY} fontSize="8.5" textAnchor="middle" fill={C.ink} fontWeight="800">{formatAmount(b.value)}</text>
            {showGap && (
              <g>
                <rect x={cx - 24} y={gapMid - 7} width="48" height="13" rx="3" fill="#fff" stroke="#fecaca" />
                <text x={cx} y={gapMid + 3} fontSize="8" textAnchor="middle" fill={C.red} fontWeight="800">Fark {formatAmount(gapVal)}</text>
              </g>
            )}
            <text x={cx} y={height - 3} fontSize="8" textAnchor="middle" fill={b.kind === "base" ? C.ink : C.mute} fontWeight={b.kind === "base" || b.kind === "after" ? 700 : 400}>{b.label}</text>
          </g>
        );
      })}
      {t !== null && (
        <g>
          <line x1={pad.l} x2={pad.l + w + 4} y1={y(t)} y2={y(t)} stroke={C.green} strokeDasharray="5 3" strokeWidth="1.6" />
          <text x={pad.l + w + 7} y={y(t) - 1} fontSize="8.5" fill={C.green} fontWeight="800">Hedef</text>
          <text x={pad.l + w + 7} y={y(t) + 9} fontSize="8.5" fill={C.green} fontWeight="800">{formatAmount(t)}{unit}</text>
        </g>
      )}
      <line x1={pad.l} x2={pad.l + w} y1={base} y2={base} stroke="#cbd5e1" />
    </svg>
  );
}

function Legend({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 8.5, color: C.mute, alignItems: "center", flexWrap: "wrap" }}>
      {items.map(([label, sw]) => <span key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>{sw}{label}</span>)}
    </div>
  );
}
const swatch = (bg: string, extra?: React.CSSProperties) => <span style={{ width: 10, height: 8, borderRadius: 2, background: bg, display: "inline-block", ...extra }} />;
const hatchSwatch = swatch("repeating-linear-gradient(45deg,#ef4444 0 2px,#fee2e2 2px 4px)", { border: "1px solid #ef4444", boxSizing: "border-box" });
const lineSwatch = <span style={{ width: 12, borderTop: `2px dashed ${C.green}`, display: "inline-block" }} />;

// ---------- 4: root cause — fishbone diagram, else the 5-Why chain ----------

function Fishbone({ causes, width, height }: { causes: CiFishboneCause[]; width: number; height: number }) {
  const cats: string[] = [];
  causes.forEach(c => { if (!cats.includes(c.category)) cats.push(c.category); });
  const top = cats.slice(0, Math.ceil(cats.length / 2));
  const bottom = cats.slice(top.length);
  const spineY = height / 2;
  const x0 = 4, x1 = width - 2;
  const cols = Math.max(top.length, bottom.length, 1);
  const step = (x1 - x0 - 8) / cols;
  const slant = Math.min(34, step * 0.28);
  const perBone = Math.max(1, Math.min(4, Math.floor((spineY - 26) / 12)));
  const textChars = charsFor(step - slant - 12, 8.5);

  const bone = (cat: string, i: number, up: boolean) => {
    const list = causes.filter(c => c.category === cat).sort((a, b) => Number(!!b.root) - Number(!!a.root));
    const xEnd = x0 + step * (i + 1);
    const xStart = xEnd - slant;
    const yStart = up ? 16 : height - 16;
    const shown = list.slice(0, perBone);
    const color = list.some(c => c.root) ? C.red : "#475569";
    return (
      <g key={cat}>
        <line x1={xStart} y1={yStart} x2={xEnd} y2={spineY} stroke={color} strokeWidth="1.6" />
        <rect x={xStart - 4 - Math.min(step - 10, cat.length * 5.3 + 10) / 2} y={up ? 1 : height - 14} width={Math.min(step - 10, cat.length * 5.3 + 10)} height="13" rx="6.5" fill={list.some(c => c.root) ? "#fee2e2" : "#f1f5f9"} />
        <text x={xStart - 4} y={up ? 10.5 : height - 4.5} fontSize="8.5" fontWeight="800" textAnchor="middle" fill={color}>
          {cut(cat, charsFor(step - 18, 8.5))}{list.length > shown.length ? ` +${list.length - shown.length}` : ""}
        </text>
        {shown.map((c, j) => {
          const f = (j + 1) / (shown.length + 1);
          const yy = yStart + (spineY - yStart) * f;
          const xb = xStart + (xEnd - xStart) * f;
          return (
            <g key={c.id || j}>
              <line x1={xb - 7} y1={yy} x2={xb} y2={yy} stroke={c.root ? C.red : "#94a3b8"} strokeWidth="1" />
              <text x={xb - 9} y={yy + 3} fontSize="8.5" textAnchor="end" fill={c.root ? C.red : C.text} fontWeight={c.root ? 800 : 400}>
                {c.root ? "★ " : ""}{cut(c.text.trim(), textChars - (c.root ? 2 : 0))}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <line x1={x0} y1={spineY} x2={x1} y2={spineY} stroke="#334155" strokeWidth="3" />
      <polygon points={`${x1 - 8},${spineY - 6} ${x1 + 2},${spineY} ${x1 - 8},${spineY + 6}`} fill="#334155" />
      {top.map((c, i) => bone(c, i, true))}
      {bottom.map((c, i) => bone(c, i, false))}
    </svg>
  );
}

function WhyChain({ whys, width }: { whys: string[]; width: number }) {
  const n = whys.length;
  const bw = (width - (n - 1) * 12) / n;
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 0, height: "100%" }}>
      {whys.map((w, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ width: 12, display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontWeight: 800 }}>›</span>}
          <div style={{ width: bw, borderRadius: 7, padding: "4px 6px", background: i === n - 1 ? "#fef2f2" : "#f8fafc", border: `1px solid ${i === n - 1 ? "#fecaca" : C.line}`, boxSizing: "border-box" }}>
            <div style={{ fontSize: 8.5, fontWeight: 800, color: i === n - 1 ? C.red : C.mute }}>Neden {i + 1}</div>
            <div style={{ fontSize: 9.5, color: C.ink, ...clamp(6) }}>{w}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------- 5: action plan — mini Gantt with progress ----------

function MiniGantt({ tasks, projectStart, targetDate, width, rows }: { tasks: any[]; projectStart?: string; targetDate?: string; width: number; rows: number }) {
  const today = new Date(new Date().toDateString()).getTime();
  const all = tasks.map(t => {
    const end = toTime(t.deadline);
    const start = Math.min(isNaN(toTime(t.startDate)) ? end - 7 * DAY : toTime(t.startDate), end);
    return { t, start, end };
  });
  const shown = all.slice(0, rows);
  const dated = all.filter(r => !isNaN(r.end));
  const labelW = 196, pctW = 40;
  const trackW = width - labelW - pctW;
  if (!dated.length) {
    return <Empty>Aksiyonlara termin girilmedi.</Empty>;
  }
  const cands = [...dated.flatMap(r => [r.start, r.end]), toTime(projectStart), toTime(targetDate)].filter(n => !isNaN(n));
  const min = Math.min(...cands), max = Math.max(...cands) + DAY;
  const span = max - min || DAY;
  const pos = (v: number) => ((v - min) / span) * trackW;
  const ticks = Array.from({ length: 5 }, (_, i) => min + (span * i) / 4);
  const target = toTime(targetDate);
  const showToday = today >= min && today <= max;
  const done = tasks.filter(t => taskStatusOf(t) === "Yapıldı").length;
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: `${labelW}px ${trackW}px ${pctW}px`, height: 12 }}>
        <span style={{ fontSize: 8.5, color: C.mute, fontWeight: 700 }}>{done}/{tasks.length} aksiyon tamamlandı</span>
        <div style={{ position: "relative" }}>
          {ticks.map((t, i) => (
            <span key={i} style={{ position: "absolute", left: pos(t), transform: i === 0 ? "none" : i === 4 ? "translateX(-100%)" : "translateX(-50%)", fontSize: 8, color: C.faint, whiteSpace: "nowrap" }}>{fmtShort(new Date(t).toISOString().slice(0, 10))}</span>
          ))}
        </div>
        <span style={{ fontSize: 8, color: C.faint, textAlign: "right" }}>İlerleme</span>
      </div>
      {shown.map(({ t, start, end }, i) => {
        const status = taskStatusOf(t);
        const pct = taskProgress(t);
        const overdue = !isNaN(end) && end < today && !["Yapıldı", "İptal"].includes(status);
        const color = status === "Yapıldı" ? C.green : status === "İptal" ? "#cbd5e1" : overdue ? C.red : C.blue;
        const tint = status === "Yapıldı" ? "#d1fae5" : status === "İptal" ? C.grid : overdue ? "#fee2e2" : "#dbeafe";
        const left = isNaN(end) ? 0 : pos(start);
        const barW = isNaN(end) ? 0 : Math.max(5, pos(end + DAY) - left);
        return (
          <div key={t.id || i} style={{ display: "grid", gridTemplateColumns: `${labelW}px ${trackW}px ${pctW}px`, alignItems: "center", height: 21, borderTop: `1px solid ${C.grid}` }}>
            <div style={{ minWidth: 0, paddingRight: 6, lineHeight: 1.15 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: status === "İptal" ? C.faint : C.ink, textDecoration: status === "İptal" ? "line-through" : undefined, ...oneLine }}>{t.name}</div>
              <div style={{ fontSize: 8, color: C.mute, ...oneLine }}>{plainName(t.responsible) || "Sorumlu yok"} · {fmtShort(t.deadline)}</div>
            </div>
            <div style={{ position: "relative", height: "100%" }}>
              {ticks.map((tk, k) => <span key={k} style={{ position: "absolute", top: 0, bottom: 0, left: pos(tk), width: 1, background: C.grid }} />)}
              {!isNaN(target) && <span style={{ position: "absolute", top: 0, bottom: 0, left: pos(target + DAY), borderLeft: `1.5px dashed ${C.faint}` }} />}
              {showToday && <span style={{ position: "absolute", top: 0, bottom: 0, left: pos(today), borderLeft: `1.5px solid ${C.amber}` }} />}
              {barW > 0 && (
                <div style={{ position: "absolute", top: 5, height: 10, left, width: barW, background: tint, borderRadius: 3, overflow: "hidden", border: `1px solid ${color}`, boxSizing: "border-box" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color }} />
                </div>
              )}
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 800, color, textAlign: "right" }}>%{pct}</span>
          </div>
        );
      })}
      {all.length > shown.length && <div style={{ fontSize: 8.5, color: C.mute, marginTop: 1 }}>+{all.length - shown.length} aksiyon daha (tam liste proje kartında ve Excel'de)</div>}
      <Legend items={[["Tamamlandı", swatch(C.green)], ["Devam ediyor", swatch(C.blue)], ["Gecikmiş", swatch(C.red)], ["Hedef bitiş", <span style={{ height: 9, borderLeft: `1.5px dashed ${C.faint}`, display: "inline-block" }} />], ...(showToday ? [["Bugün", <span style={{ height: 9, borderLeft: `1.5px solid ${C.amber}`, display: "inline-block" }} />] as [string, React.ReactNode]] : [])]} />
    </div>
  );
}

// ---------- 7: gain bars ----------

function GainBars({ expected, realized, confirmed, cur }: { expected: number; realized: number; confirmed: boolean; cur: string }) {
  const max = Math.max(expected, realized, 1);
  const row = (label: string, v: number, color: string, mark?: string) => (
    <div style={{ display: "grid", gridTemplateColumns: "74px 1fr 80px", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 9.5, color: C.mute, whiteSpace: "nowrap" }}>{label}{mark && <b style={{ color: confirmed ? C.green : "#b45309" }}> {mark}</b>}</span>
      <div style={{ height: 10, background: C.grid, borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${(v / max) * 100}%`, background: color, borderRadius: 5 }} /></div>
      <span style={{ fontSize: 10.5, fontWeight: 800, color: C.ink, textAlign: "right" }}>{v ? `${cur}${formatAmount(Math.round(v))}` : "—"}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, color: C.mute }}>Yıllık kazanç</div>
      {row("Beklenen", expected, "#93c5fd")}
      {/* ✔ = confirmed by the consultant, ? = waiting for confirmation */}
      {row("Gerçekleşen", realized, confirmed ? C.green : "#f59e0b", realized ? (confirmed ? "✔" : "?") : undefined)}
    </div>
  );
}

// ---------- card ----------

export default function CiA3Card({ project: p, projectNo, companyName, currencySymbol: cur }: Props) {
  const kpi = kpiOf(p);
  const stage = stageOf(p);
  const closed = isClosed(p);
  const tasks: any[] = (p.tasks || []).filter((t: any) => (t.name || "").trim());
  const whys = (p.rootCauseWhys || []).map(w => (w || "").trim()).filter(Boolean);
  const causes = (Array.isArray(p.fishbone) ? p.fishbone : []).filter(c => (c?.text || "").trim());
  const rootCause = rootCauseOf(p);
  const expected = p.expectedGain || p.targetCostReduction || 0;
  const realized = p.realizedGain ?? p.actualSavings ?? 0;
  const measurements = [...kpi.measurements].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const last = latestMeasurement(kpi);
  const unit = kpi.unit ? ` ${kpi.unit}` : "";
  const std = [
    ["Standart iş", p.stdWorkUpdated], ["Talimat", p.instructionRevised], ["Kontrol planı", p.controlPlanUpdated],
    ["Eğitim", p.trainingGiven], ["Denetim listesi", p.auditListUpdated]
  ] as const;
  const status = p.holdState === "cancelled" ? "İptal" : p.holdState === "onHold" ? "Askıda" : closed ? `Kapandı ${fmtDate(p.closedAt)}` : `Adım ${stage}/8 · ${CI_STEPS[stage - 1].short}`;
  const current = figuresOf(p.problemDetail || "");
  const plannedPct = kpi.baseline && kpi.target !== null ? Math.round(((kpi.target - kpi.baseline) / kpi.baseline) * 100) : null;
  const realizedPct = kpi.baseline && last ? Math.round(((last.value - kpi.baseline) / kpi.baseline) * 100) : null;
  const goodPct = (pct: number | null) => pct !== null && (kpi.direction === "decrease" ? pct < 0 : pct > 0);
  const followUps = (p.followUps || []).filter(f => f && f.days);

  // Step 3 — baseline + measured values (latest 7) against the target.
  const targetBars: Bar[] = [
    ...(kpi.baseline !== null ? [{ label: "Başlangıç", value: kpi.baseline, kind: "base" as const }] : []),
    ...measurements.slice(-7).map(m => ({ label: fmtShort(m.date), value: m.value, kind: "measure" as const }))
  ];
  // Step 7 — before (baseline) vs after (latest measurement), then the sustainability checks.
  const resultBars: Bar[] = [
    ...(kpi.baseline !== null ? [{ label: "Önce", value: kpi.baseline, kind: "base" as const }] : []),
    ...(last ? [{ label: "Sonra", value: last.value, kind: "after" as const }] : []),
    ...followUps.filter(f => typeof f.value === "number").map(f => ({ label: `${f.days}. gün`, value: f.value as number, kind: "follow" as const }))
  ];

  const MAIN_H = A3_HEIGHT - 2 * PAD - 58 - 38 - 10 - 3 * GAP; // header, step strip, footer
  const ROW1 = 128, ROW2 = 114;                                  // left: problem, current state
  const R4 = 210, R5 = 196;                                      // right: root cause, action plan
  const R7 = MAIN_H - R4 - R5 - 2 * GAP;
  const ganttRows = Math.max(3, Math.floor((R5 - 32 - 12 - 13 - 15) / 21)); // header + padding, axis, "+n more", legend

  return (
    <div style={{ width: A3_WIDTH, height: A3_HEIGHT, background: "#f8fafc", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", color: C.ink, padding: PAD, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: GAP, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ height: 58, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 14, background: C.ink, color: "#fff", borderRadius: 12, padding: "6px 14px", flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, letterSpacing: 1, color: C.faint, fontWeight: 700, ...oneLine }}>SÜREKLİ İYİLEŞTİRME PROJESİ · A3 · {projectNo}{companyName ? ` · ${companyName}` : ""}</div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 1, ...oneLine }}>{p.title || "Adsız proje"}</div>
          <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 1, ...oneLine }}>
            Lider: <b style={{ color: "#fff" }}>{plainName(p.projectLeader || p.originator) || "—"}</b>
            {(p.projectTeam || []).length > 0 && <> · Ekip: {(p.projectTeam || []).map(plainName).join(", ")}</>}
            {p.department && <> · {p.department}</>}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 10, color: "#cbd5e1", flexShrink: 0 }}>
          <div style={{ display: "inline-block", background: closed ? C.green : C.blue, color: "#fff", borderRadius: 6, padding: "2px 8px", fontWeight: 800, fontSize: 10.5 }}>{status}</div>
          <div style={{ marginTop: 3 }}>Açılış {fmtDate(p.dateProposed)} · Hedef {fmtDate(p.plannedFinishDate)}{p.projectResult ? <> · Sonuç: <b style={{ color: "#fff" }}>{p.projectResult}</b></> : null}</div>
        </div>
      </div>

      <div style={{ height: 38 }}><StepStrip p={p} /></div>

      {/* Main: PLAN | root cause → actions → results → standard */}
      <div style={{ display: "grid", gridTemplateColumns: `${LEFT_W}px ${RIGHT_W}px`, gap: GAP, height: MAIN_H, flexShrink: 0 }}>
        <div style={{ display: "grid", gridTemplateRows: `${ROW1}px ${ROW2}px 1fr`, gap: GAP, minHeight: 0 }}>
          <Section no={1} title="Problem ve kayıp boyutu" pdca="PLAN">
            <div style={clamp(3)}>{p.problemDefinition || p.descriptionBefore || "—"}</div>
            <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
              {(p.currentLoss || 0) > 0 && <Tile label="Yıllık kayıp" value={`${cur}${formatAmount(p.currentLoss!)}`} color={C.red} soft="#fef2f2" />}
              {kpi.baseline !== null && <Tile label={kpi.name || "Gösterge"} value={`${formatAmount(kpi.baseline)}${unit}`} />}
            </div>
          </Section>
          <Section no={2} title="Mevcut durum" pdca="PLAN">
            {current ? (
              <>
                {current.intro && <div style={{ fontSize: 9.5, color: C.mute, marginBottom: 3, ...oneLine }}>{current.intro}</div>}
                <FigureBars figures={current.figures} max={current.intro ? 4 : 5} />
              </>
            ) : <div style={clamp(5)}>{p.problemDetail || "—"}</div>}
          </Section>
          <Section no={3} title="Hedef" pdca="PLAN" aside={kpi.name ? <span style={{ fontSize: 10, color: C.mute }}>{kpi.name} ({kpi.direction === "increase" ? "artması iyi" : "düşmesi iyi"})</span> : null}>
            <div style={{ display: "flex", gap: 6 }}>
              <Tile label="Başlangıç" value={kpi.baseline !== null ? `${formatAmount(kpi.baseline)}${unit}` : "—"} />
              <Tile label="Hedef" value={kpi.target !== null ? `${formatAmount(kpi.target)}${unit}` : "—"} color={C.green} soft="#ecfdf5" />
              <Tile label="Hedeflenen iyileşme" value={plannedPct !== null ? `%${Math.abs(plannedPct)}` : "—"} color={C.blue} soft="#eff6ff" />
              <Tile label="Beklenen kazanç" value={expected > 0 ? `${cur}${formatAmount(expected)}` : "—"} />
            </div>
            {targetBars.length ? (
              <>
                <div style={{ marginTop: 6 }}>
                  <GapColumns kpi={kpi} bars={targetBars} width={INNER(LEFT_W)} height={MAIN_H - ROW1 - ROW2 - 2 * GAP - 38 - 44 - 36} id="a3gapTarget" />
                </div>
                <div style={{ marginTop: "auto" }}>
                  <Legend items={[["Başlangıç", swatch("#94a3b8")], ["Ölçüm", swatch(C.blue)], ["Hedefe ulaşan", swatch(C.green)], ["İyileştirme alanı (hedefe kalan fark)", hatchSwatch], ["Hedef", lineSwatch]]} />
                  <div style={{ fontSize: 9, color: C.mute, marginTop: 1 }}>Hedef tarih {fmtDate(p.plannedFinishDate)}{p.targetObjective ? <> · {cut(p.targetObjective, 70)}</> : null}</div>
                </div>
              </>
            ) : <Empty>Gösterge başlangıç / hedef değeri girilmedi.</Empty>}
          </Section>
        </div>

        <div style={{ display: "grid", gridTemplateRows: `${R4}px ${R5}px ${R7}px`, gap: GAP, minHeight: 0 }}>
          <Section no={4} title="Kök neden" pdca="PLAN" aside={causes.length ? <span style={{ fontSize: 9.5, color: C.mute }}>Balık kılçığı · ★ kök neden</span> : whys.length ? <span style={{ fontSize: 9.5, color: C.mute }}>5 Neden</span> : null}>
            {causes.length || whys.length ? (
              <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {causes.length
                    ? <Fishbone causes={causes} width={INNER(RIGHT_W) - 140} height={R4 - 40} />
                    : <WhyChain whys={whys.slice(0, 5)} width={INNER(RIGHT_W) - 140} />}
                </div>
                <div style={{ width: 132, flexShrink: 0, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 8px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: 8.5, fontWeight: 900, color: C.red, letterSpacing: 0.5 }}>KÖK NEDEN</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.ink, marginTop: 2, ...clamp(8) }}>{rootCause || "—"}</div>
                </div>
              </div>
            ) : <div style={{ fontWeight: 800, color: C.ink, ...clamp(4) }}>{rootCause || "—"}</div>}
          </Section>

          <Section no="5–6" title="Uygulama planı" pdca="DO">
            {tasks.length ? <MiniGantt tasks={tasks} projectStart={p.dateProposed} targetDate={p.plannedFinishDate} width={INNER(RIGHT_W)} rows={ganttRows} /> : <Empty>Aksiyon girilmedi.</Empty>}
          </Section>

          <div style={{ display: "grid", gridTemplateColumns: `${RESULT_W}px 1fr`, gap: GAP, minHeight: 0 }}>
            <Section no={7} title="Sonuçlar" pdca="CHECK" aside={p.kpiTargetMet !== undefined && p.kpiTargetMet !== null
              ? <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "1px 5px", color: p.kpiTargetMet ? C.green : C.red, background: p.kpiTargetMet ? "#ecfdf5" : "#fef2f2" }}>{p.kpiTargetMet ? "✔ Hedefe ulaşıldı" : "✕ Hedefe ulaşılmadı"}</span> : null}>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flex: 1, minHeight: 0 }}>
                {resultBars.length ? <GapColumns kpi={kpi} bars={resultBars} width={INNER(RESULT_W) - 72} height={R7 - 40 - 52} id="a3gapResult" gapLabels={false} /> : <Empty>Ölçüm yok.</Empty>}
                <div style={{ width: 66, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ background: goodPct(realizedPct) ? "#ecfdf5" : C.grid, borderRadius: 7, padding: "3px 5px", textAlign: "center" }}>
                    <div style={{ fontSize: 8, color: C.mute, fontWeight: 700 }}>İyileşme</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: goodPct(realizedPct) ? C.green : C.mute }}>{realizedPct !== null ? `${realizedPct < 0 ? "↓" : "↑"}%${Math.abs(realizedPct)}` : "—"}</div>
                  </div>
                  <div style={{ background: C.grid, borderRadius: 7, padding: "3px 5px", textAlign: "center" }}>
                    <div style={{ fontSize: 8, color: C.mute, fontWeight: 700 }}>Son ölçüm</div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: C.ink }}>{last ? `${formatAmount(last.value)}${unit}` : "—"}</div>
                  </div>
                </div>
              </div>
              <GainBars expected={expected} realized={realized} confirmed={!!p.gainConfirmedAt} cur={cur} />
            </Section>
            <Section no={8} title="Standartlaştırma" pdca="ACT">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {std.map(([label, on]) => (
                  <span key={label} style={{ fontSize: 9, borderRadius: 4, padding: "1px 5px", background: on ? "#ecfdf5" : "#f8fafc", color: on ? "#047857" : C.faint, border: `1px solid ${on ? "#a7f3d0" : C.line}`, fontWeight: 700 }}>{on ? "✔" : "○"} {label}</span>
                ))}
              </div>
              {followUps.length > 0 && (
                <div style={{ marginTop: 5 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 800, color: C.mute }}>Sürdürülebilirlik kontrolleri</div>
                  <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                    {followUps.map(f => {
                      const st = f.sustained === true ? ["✔", C.green, "#ecfdf5"] : f.sustained === false ? ["✕", C.red, "#fef2f2"] : ["…", C.faint, "#f8fafc"];
                      return (
                        <div key={f.days} style={{ flex: 1, borderRadius: 5, background: st[2], padding: "2px 4px", textAlign: "center", border: `1px solid ${C.line}` }}>
                          <div style={{ fontSize: 8.5, fontWeight: 800, color: st[1] }}>{st[0]} {f.days}. gün</div>
                          <div style={{ fontSize: 8, color: C.mute }}>{typeof f.value === "number" ? `${formatAmount(f.value)}${unit}` : fmtShort(f.dueDate)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {p.horizontalDeployment && <div style={{ marginTop: 5, fontSize: 9.5, ...clamp(2) }}><b>Yaygınlaştırma:</b> {p.horizontalDeployment}</div>}
              {p.lessonsLearned && <div style={{ marginTop: 3, fontSize: 9.5, ...clamp(2) }}><b>Dersler:</b> {p.lessonsLearned}</div>}
            </Section>
          </div>
        </div>
      </div>

      <div style={{ height: 10, display: "flex", justifyContent: "space-between", fontSize: 8.5, color: C.faint, flexShrink: 0 }}>
        <span>Toyota 8 adım A3 · Planla → Uygula → Kontrol et → Önlem al</span>
        <span>Oluşturma: {new Date().toLocaleDateString("tr-TR")}</span>
      </div>
    </div>
  );
}
