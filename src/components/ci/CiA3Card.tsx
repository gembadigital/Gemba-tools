// One-page A3 presentation card of a CI project (plan step C8, requirements B9–B11). Fixed A4
// landscape size (1123 × 794 px at 96 dpi) so the screen preview, the PDF (captured as an image) and
// print are the same page. Left = PLAN (problem, loss, current state, target), right = DO / CHECK /
// ACT (root cause, actions, results, standardization), optional bottom strip = before / after.
// Everything comes from the A3 fields; long texts are clamped to keep one page.
import React from "react";
import type { KaizenCard, BeforeAfterKaizenStudy } from "../../types";
import { kpiOf, rootCauseOf, fishboneRootCauses, taskStatusOf, stageOf, isClosed, CI_STEPS, CiKpi } from "../../utils/ciLifecycle";
import { formatAmount } from "./ciUi";

export const A3_WIDTH = 1123;
export const A3_HEIGHT = 794;

export interface A3BeforeAfter {
  title: string;
  beforeImage?: string;
  afterImage?: string;
  beforeText?: string;
  afterText?: string;
  benefit?: string;
}

// Bottom strip content: a before-after study of the project, else the project's own photos.
export function beforeAfterOf(p: KaizenCard, study?: BeforeAfterKaizenStudy | null): A3BeforeAfter {
  if (study) {
    return { title: study.subject, beforeImage: study.beforeImage, afterImage: study.afterImage,
      beforeText: study.descriptionBefore, afterText: study.descriptionAfter, benefit: study.benefitDescription };
  }
  return { title: "Önce / Sonra", beforeImage: p.problemPhotos?.[0], afterImage: p.resultPhotos?.[0],
    beforeText: p.problemDefinition || p.descriptionBefore, afterText: p.resultDescription };
}

interface Props {
  project: KaizenCard;
  projectNo: string;
  companyName?: string;
  currencySymbol: string;
  beforeAfter?: A3BeforeAfter | null; // null = no bottom strip
}

const PDCA = {
  PLAN: { label: "PLAN", color: "#2563eb", soft: "#eff6ff" },
  DO: { label: "DO", color: "#d97706", soft: "#fffbeb" },
  CHECK: { label: "CHECK", color: "#7c3aed", soft: "#f5f3ff" },
  ACT: { label: "ACT", color: "#059669", soft: "#ecfdf5" }
} as const;

const fmtDate = (iso?: string | null) => iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("tr-TR") : "—";
const clamp = (lines: number): React.CSSProperties => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" });

function Section({ no, title, pdca, children, style }: { no: number; title: string; pdca: keyof typeof PDCA; children: React.ReactNode; style?: React.CSSProperties }) {
  const c = PDCA[pdca];
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", background: "#fff", display: "flex", flexDirection: "column", minHeight: 0, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ width: 18, height: 18, borderRadius: 9, background: c.color, color: "#fff", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{no}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{title}</span>
        <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, color: c.color, background: c.soft, borderRadius: 4, padding: "1px 5px", letterSpacing: 0.5 }}>{c.label}</span>
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.35, color: "#334155", minHeight: 0, flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// KPI chart: baseline (opening), measurements over time, dashed target line.
function KpiChart({ kpi, start, width = 250, height = 92 }: { kpi: CiKpi; start?: string; width?: number; height?: number }) {
  const pts = [
    ...(kpi.baseline !== null ? [{ date: start || "", value: kpi.baseline, base: true }] : []),
    ...[...kpi.measurements].sort((a, b) => (a.date || "").localeCompare(b.date || "")).map(m => ({ date: m.date, value: m.value, base: false }))
  ];
  if (!pts.length && kpi.target === null) return <div style={{ color: "#94a3b8", fontSize: 10 }}>KPI değeri girilmedi.</div>;
  const values = [...pts.map(p => p.value), ...(kpi.target !== null ? [kpi.target] : [])];
  const min = Math.min(...values, 0), max = Math.max(...values) || 1;
  const pad = { l: 34, r: 8, t: 8, b: 16 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const y = (v: number) => pad.t + h - ((v - min) / (max - min || 1)) * h;
  const x = (i: number) => pad.l + (pts.length > 1 ? (i / (pts.length - 1)) * w : w / 2);
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {[min, (min + max) / 2, max].map((v, i) => (
        <g key={i}>
          <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="#f1f5f9" />
          <text x={pad.l - 4} y={y(v) + 3} fontSize="8" textAnchor="end" fill="#94a3b8">{formatAmount(v, 1)}</text>
        </g>
      ))}
      {kpi.target !== null && (
        <g>
          <line x1={pad.l} x2={width - pad.r} y1={y(kpi.target)} y2={y(kpi.target)} stroke="#059669" strokeDasharray="4 3" strokeWidth="1.5" />
          <text x={width - pad.r} y={y(kpi.target) - 3} fontSize="8" textAnchor="end" fill="#059669" fontWeight="700">Hedef {formatAmount(kpi.target)}</text>
        </g>
      )}
      {pts.length > 1 && <polyline points={pts.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} fill="none" stroke="#2563eb" strokeWidth="2" />}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r="3" fill={p.base ? "#dc2626" : "#2563eb"} />
          <text x={x(i)} y={y(p.value) - 5} fontSize="8" textAnchor="middle" fill="#0f172a" fontWeight="700">{formatAmount(p.value)}</text>
          <text x={x(i)} y={height - 3} fontSize="7.5" textAnchor="middle" fill="#64748b">{p.base ? "Başlangıç" : fmtDate(p.date).slice(0, 5)}</text>
        </g>
      ))}
    </svg>
  );
}

function GainBars({ expected, realized, confirmed, cur }: { expected: number; realized: number; confirmed: boolean; cur: string }) {
  const max = Math.max(expected, realized, 1);
  const row = (label: string, v: number, color: string, mark?: string) => (
    <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 92px", alignItems: "center", gap: 6, marginTop: 2 }}>
      <span style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>{label}{mark && <b style={{ color: confirmed ? "#059669" : "#b45309" }}> {mark}</b>}</span>
      <div style={{ height: 10, background: "#f1f5f9", borderRadius: 5, overflow: "hidden" }}><div style={{ height: "100%", width: `${(v / max) * 100}%`, background: color, borderRadius: 5 }} /></div>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#0f172a", textAlign: "right" }}>{v ? `${cur}${formatAmount(Math.round(v))}` : "—"}</span>
    </div>
  );
  return (
    <div>
      {row("Beklenen", expected, "#93c5fd")}
      {/* ✔ = confirmed by the consultant, ? = waiting for confirmation */}
      {row("Gerçekleşen", realized, confirmed ? "#059669" : "#f59e0b", realized ? (confirmed ? "✔" : "?") : undefined)}
    </div>
  );
}

export default function CiA3Card({ project: p, projectNo, companyName, currencySymbol: cur, beforeAfter }: Props) {
  const kpi = kpiOf(p);
  const stage = stageOf(p);
  const closed = isClosed(p);
  const tasks: any[] = (p.tasks || []).filter((t: any) => (t.name || "").trim());
  const shownTasks = tasks.slice(0, beforeAfter ? 4 : 8);
  const whys = (p.rootCauseWhys || []).map(w => (w || "").trim()).filter(Boolean);
  const marked = fishboneRootCauses(p);
  const expected = p.expectedGain || p.targetCostReduction || 0;
  const realized = p.realizedGain ?? p.actualSavings ?? 0;
  const lastM = [...kpi.measurements].sort((a, b) => (a.date || "").localeCompare(b.date || "")).slice(-1)[0];
  const std = [
    ["Standart iş", p.stdWorkUpdated], ["Talimat", p.instructionRevised], ["Kontrol planı", p.controlPlanUpdated],
    ["Eğitim", p.trainingGiven], ["Denetim listesi", p.auditListUpdated]
  ] as const;
  const status = p.holdState === "cancelled" ? "İptal" : p.holdState === "onHold" ? "Askıda" : closed ? `Kapandı ${fmtDate(p.closedAt)}` : `Adım ${stage}/8 · ${CI_STEPS[stage - 1].short}`;
  const mainHeight = beforeAfter ? 456 : 640;

  return (
    <div style={{ width: A3_WIDTH, height: A3_HEIGHT, background: "#f8fafc", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", color: "#0f172a", padding: 18, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, background: "#0f172a", color: "#fff", borderRadius: 12, padding: "10px 14px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, color: "#94a3b8", fontWeight: 700 }}>CI PROJESİ · A3 · {projectNo}{companyName ? ` · ${companyName}` : ""}</div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2, ...clamp(1) }}>{p.title || "Adsız proje"}</div>
          <div style={{ fontSize: 10.5, color: "#cbd5e1", marginTop: 3 }}>
            Lider: <b style={{ color: "#fff" }}>{(p.projectLeader || p.originator || "—").replace(/\s*\([^)]*\)\s*$/, "")}</b>
            {(p.projectTeam || []).length > 0 && <> · Ekip: {(p.projectTeam || []).map(n => n.replace(/\s*\([^)]*\)\s*$/, "")).join(", ")}</>}
            {p.department && <> · {p.department}</>}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 10.5, color: "#cbd5e1", flexShrink: 0 }}>
          <div style={{ display: "inline-block", background: closed ? "#059669" : "#2563eb", color: "#fff", borderRadius: 6, padding: "2px 8px", fontWeight: 800, fontSize: 11 }}>{status}</div>
          <div style={{ marginTop: 4 }}>Açılış {fmtDate(p.dateProposed)} · Hedef {fmtDate(p.plannedFinishDate)}</div>
          {p.projectResult && <div style={{ marginTop: 2 }}>Sonuç: <b style={{ color: "#fff" }}>{p.projectResult}</b></div>}
        </div>
      </div>

      {/* Main: PLAN | DO-CHECK-ACT */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 10, height: mainHeight }}>
        <div style={{ display: "grid", gridTemplateRows: beforeAfter ? "1.1fr 0.6fr 1.3fr" : "1.3fr 0.9fr 1.4fr", gap: 8, minHeight: 0 }}>
          <Section no={1} title="Problem ve kayıp boyutu" pdca="PLAN">
            <div style={clamp(beforeAfter ? 4 : 7)}>{p.problemDefinition || p.descriptionBefore || "—"}</div>
            {(p.currentLoss || 0) > 0 && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 10, color: "#64748b" }}>Yıllık kayıp</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#dc2626" }}>{cur}{formatAmount(p.currentLoss!)}</span>
              </div>
            )}
          </Section>
          <Section no={2} title="Mevcut durum" pdca="PLAN">
            <div style={clamp(beforeAfter ? 3 : 5)}>{p.problemDetail || "—"}</div>
          </Section>
          <Section no={3} title="Hedef" pdca="PLAN">
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <b style={{ fontSize: 12 }}>{kpi.name || "KPI"}</b>
              <span style={{ fontSize: 11 }}>{kpi.baseline !== null ? formatAmount(kpi.baseline) : "—"} → <b style={{ color: "#059669" }}>{kpi.target !== null ? formatAmount(kpi.target) : "—"}</b> {kpi.unit}</span>
              <span style={{ fontSize: 10, color: "#64748b" }}>({kpi.direction === "increase" ? "artması iyi" : "düşmesi iyi"})</span>
            </div>
            <KpiChart kpi={{ ...kpi, measurements: [] }} start={p.dateProposed} width={470} height={beforeAfter ? 70 : 100} />
            {expected > 0 && <div style={{ fontSize: 10.5, marginTop: 2 }}>Beklenen yıllık kazanç: <b>{cur}{formatAmount(expected)}</b>{p.targetObjective ? ` · ${p.targetObjective}` : ""}</div>}
          </Section>
        </div>

        <div style={{ display: "grid", gridTemplateRows: beforeAfter ? "0.75fr 0.95fr 1.5fr" : "0.9fr 1.25fr 1.65fr", gap: 8, minHeight: 0 }}>
          <Section no={4} title="Kök neden" pdca="PLAN">
            <div style={{ fontWeight: 800, color: "#0f172a", ...clamp(2) }}>{rootCauseOf(p) || "—"}</div>
            {whys.length > 0 && (
              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
                {whys.slice(0, 5).map((w, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span style={{ color: "#94a3b8" }}>→</span>}
                    <span style={{ background: "#f1f5f9", borderRadius: 4, padding: "1px 5px", fontSize: 9.5, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {w}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
            {marked.length > 0 && <div style={{ marginTop: 4, fontSize: 10 }}>Balık kılçığı: {marked.map(c => `★ ${c.text} (${c.category})`).join(" · ")}</div>}
          </Section>
          <Section no={5} title="Karşı önlemler ve uygulama" pdca="DO">
            {shownTasks.length === 0 ? "—" : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead><tr style={{ color: "#64748b", textAlign: "left" }}><th style={{ paddingBottom: 2 }}>Aksiyon</th><th>Sorumlu</th><th>Termin</th><th style={{ textAlign: "center" }}>Durum</th></tr></thead>
                <tbody>
                  {shownTasks.map((t, i) => {
                    const st = taskStatusOf(t);
                    return (
                      <tr key={t.id || i} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "2px 4px 2px 0", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</td>
                        <td style={{ whiteSpace: "nowrap", paddingRight: 4 }}>{(t.responsible || "—").replace(/\s*\([^)]*\)\s*$/, "")}</td>
                        <td style={{ whiteSpace: "nowrap", paddingRight: 4 }}>{fmtDate(t.deadline)}</td>
                        <td style={{ textAlign: "center", fontWeight: 800, color: st === "Yapıldı" ? "#059669" : st === "İptal" ? "#94a3b8" : "#d97706" }}>{st === "Yapıldı" ? "✔" : st === "İptal" ? "—" : st === "Devam Ediyor" ? "◐" : "○"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {tasks.length > shownTasks.length && <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 2 }}>+{tasks.length - shownTasks.length} aksiyon daha</div>}
          </Section>
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 8, minHeight: 0 }}>
            <Section no={7} title="Sonuçlar" pdca="CHECK">
              <KpiChart kpi={kpi} start={p.dateProposed} width={300} height={beforeAfter ? 60 : 104} />
              <div style={{ fontSize: 10.5, marginTop: 2 }}>
                {lastM ? <>Son ölçüm <b>{formatAmount(lastM.value)} {kpi.unit}</b> ({fmtDate(lastM.date)}) · </> : null}
                Hedefe ulaşıldı: <b style={{ color: p.kpiTargetMet ? "#059669" : p.kpiTargetMet === false ? "#dc2626" : "#64748b" }}>{p.kpiTargetMet === true ? "Evet" : p.kpiTargetMet === false ? "Hayır" : "—"}</b>
              </div>
              <GainBars expected={expected} realized={realized} confirmed={!!p.gainConfirmedAt} cur={cur} />
            </Section>
            <Section no={8} title="Standart ve yaygınlaştırma" pdca="ACT">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {std.map(([label, on]) => (
                  <span key={label} style={{ fontSize: 9.5, borderRadius: 4, padding: "1px 5px", background: on ? "#ecfdf5" : "#f8fafc", color: on ? "#047857" : "#94a3b8", border: `1px solid ${on ? "#a7f3d0" : "#e2e8f0"}`, fontWeight: 700 }}>{on ? "✔" : "○"} {label}</span>
                ))}
              </div>
              {p.horizontalDeployment && <div style={{ marginTop: 4, ...clamp(beforeAfter ? 1 : 2) }}><b>Yaygınlaştırma:</b> {p.horizontalDeployment}</div>}
              {p.lessonsLearned && <div style={{ marginTop: 3, ...clamp(beforeAfter ? 1 : 2) }}><b>Dersler:</b> {p.lessonsLearned}</div>}
              {p.resultDescription && <div style={{ marginTop: 3, ...clamp(beforeAfter ? 2 : 4) }}><b>Sonuç:</b> {p.resultDescription}</div>}
            </Section>
          </div>
        </div>
      </div>

      {/* Optional before / after strip */}
      {beforeAfter && (
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr", gap: 10, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 8 }}>
          {([["ÖNCE", beforeAfter.beforeImage, beforeAfter.beforeText, "#dc2626"], ["SONRA", beforeAfter.afterImage, beforeAfter.afterText, "#059669"]] as const).map(([label, img, text, color]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 8, minHeight: 0 }}>
              <div style={{ background: "#f1f5f9", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 10 }}>
                {img ? <img src={img} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "Fotoğraf yok"}
              </div>
              <div style={{ minHeight: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color }}>{label}</div>
                <div style={{ fontSize: 10.5, color: "#334155", ...clamp(7) }}>{text || "—"}</div>
              </div>
            </div>
          ))}
          <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 10, minHeight: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#0f172a", ...clamp(2) }}>{beforeAfter.title}</div>
            <div style={{ fontSize: 10.5, color: "#334155", marginTop: 4, ...clamp(7) }}>{beforeAfter.benefit || "—"}</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#94a3b8", marginTop: beforeAfter ? 0 : "auto" }}>
        <span>Toyota 8 adım A3 · Plan → Do → Check → Act</span>
        <span>Oluşturma: {new Date().toLocaleDateString("tr-TR")}</span>
      </div>
    </div>
  );
}
