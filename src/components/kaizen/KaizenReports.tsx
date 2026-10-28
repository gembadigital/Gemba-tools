import React, { useMemo, useState } from "react";
import { FileText, Gem, Download, ShieldAlert, Leaf, Sparkles, Trophy, Lightbulb, BadgeCheck, Award, Coins, RotateCcw, Users, Wallet, TrendingUp, Building2, ArrowUpDown } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadialBarChart, RadialBar, PolarAngleAxis
} from "recharts";
import { KaizenSuggestion, KaizenEvaluation, KaizenPersonnel, KaizenImplementation, ApprovalStatus } from "./kaizenTypes";
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS, actionProgress, statusLabel, opportunityPool, expectedSaving } from "./kaizenCalc";
import { KaizenApi } from "./KaizenSuggestionSystem";
import { KaizenSettings, toBaseCurrency, optionChoices, stagesOf, awaitingFirstDecision } from "../../utils/kaizenSettings";
import { Card, KpiCard, Button, EmptyState, PageHeader, tableCls, theadCls, thCls, tdCls, trCls } from "./kaizenUi";
import { suggestionRoi } from "./KaizenRoi";
import KaizenReportPdf from "./KaizenReportPdf";
import { exportReportExcel, ReportPack, Cell as XCell } from "./kaizenReportExport";
import { recurrenceOf } from "../../utils/kaizenRoi";
import { portfolioRoi, paybackText } from "../../utils/kaizenRoi";

// Native replacement for the legacy Power BI report (two pages: a KPI/chart dashboard with five
// filters, and a per-suggestion "Personel Bazlı Kaizen Puan Tablosu"). Same grouping, plus the
// departmental treemap and the "Toplam Getiri" tile that the original had.
interface Props {
  settings: KaizenSettings;
  suggestions: KaizenSuggestion[];
  evaluations: KaizenEvaluation[];
  personnel: KaizenPersonnel[];
  implementations: KaizenImplementation[];
  api: KaizenApi;
  companyName?: string;
  // Amir raporu (Faz 5.6): the lists above are already limited to the manager's team; the ranking
  // groups by sub-team (direct report's branch) instead of department, and there is no Excel export.
  team?: { leaderName: string; groupTitle: string; groupOf: (s: KaizenSuggestion) => string; headcount: Map<string, number> };
}

const ALL = "__ALL__";
const COLORS = ["#0f172a", "#3b82f6", "#00A280", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];
const TREEMAP_COLORS = ["#0ea5e9", "#3b82f6", "#1e3a8a", "#8b5cf6", "#ec4899", "#ef4444", "#14b8a6", "#f59e0b"];
const BUCKET = { approved: "#00A280", pending: "#facc15", rejected: "#ef4444" };
const TICK = { fontSize: 12, fill: "#64748b" };

function statusBucket(s: KaizenSuggestion): "approved" | "pending" | "rejected" {
  if (awaitingFirstDecision(s)) return "pending";
  if (s.approvalStatus === "Rejected" || s.approvalStatus === "Rejected 2nd") return "rejected";
  return "approved";
}

const selectCls = "h-11 w-full px-3 rounded-xl bg-slate-50/80 ring-1 ring-inset ring-slate-200 text-sm text-slate-800 transition-all focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600/40";

export default function KaizenReports({ suggestions, evaluations, personnel, implementations, api, settings, team, companyName = "" }: Props) {
  const base = settings.baseCurrency;
  // Filters list the customer's current options plus any older value still present in the data.
  const typeFilterOptions = useMemo(() => optionChoices(settings.suggestionTypes, suggestions.flatMap(s => s.suggestionTypes || [])), [settings, suggestions]);
  const stageFilterOptions = useMemo(() => optionChoices(settings.stages, suggestions.map(s => s.stage)), [settings, suggestions]);
  const [fDepartment, setFDepartment] = useState(ALL);
  const [fType, setFType] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);
  const [fStage, setFStage] = useState(ALL);
  const [fPersonnel, setFPersonnel] = useState(ALL);
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [pdfPack, setPdfPack] = useState<ReportPack | null>(null);

  const departments = useMemo(() => Array.from(new Set(suggestions.map(s => s.personnelDepartment).filter(Boolean))).sort(), [suggestions]);
  const personnelNames = useMemo(() => Array.from(new Set(suggestions.map(s => s.personnelName).filter(Boolean))).sort(), [suggestions]);

  const filtered = useMemo(() => suggestions.filter(s => {
    if (fDepartment !== ALL && s.personnelDepartment !== fDepartment) return false;
    if (fType !== ALL && !(s.suggestionTypes || []).includes(fType)) return false;
    if (fStatus !== ALL && s.approvalStatus !== fStatus) return false;
    if (fStage !== ALL && s.stage !== fStage) return false;
    if (fPersonnel !== ALL && s.personnelName !== fPersonnel) return false;
    const created = (s.createdAt || "").slice(0, 10);
    if (fFrom && created < fFrom) return false;
    if (fTo && created > fTo) return false;
    return true;
  }), [suggestions, fDepartment, fType, fStatus, fStage, fPersonnel, fFrom, fTo]);

  const filteredIds = useMemo(() => new Set(filtered.map(s => s.id)), [filtered]);
  const filteredEvaluations = useMemo(() => evaluations.filter(e => filteredIds.has(e.suggestionId)), [evaluations, filteredIds]);
  const evaluationBySuggestion = useMemo(() => {
    const map = new Map<string, KaizenEvaluation>();
    filteredEvaluations.forEach(e => map.set(e.suggestionId, e));
    return map;
  }, [filteredEvaluations]);

  const resetFilters = () => { setFDepartment(ALL); setFType(ALL); setFStatus(ALL); setFStage(ALL); setFPersonnel(ALL); setFFrom(""); setFTo(""); };
  const hasFilter = [fDepartment, fType, fStatus, fStage, fPersonnel].some(v => v !== ALL) || !!fFrom || !!fTo;

  // ---- KPI row ----
  const totalPoints = filteredEvaluations.reduce((sum, e) => sum + (e.point || 0), 0);
  const completedCount = filtered.filter(s => s.completed).length;
  // Totals are in the customer's base currency. Other currencies are converted with the customer's
  // fixed rates (Kurulum → Ayarlar); in-kind or rate-less amounts are left out and counted instead.
  // Kurul-approved: the income the Kurul approved. Approved by the Amir alone (below the Kurul
  // threshold, no evaluation record): the suggestion's own estimate.
  const approvedIncomeConverted = filtered.filter(s => s.approvalStatus === "Second Approval").flatMap(s => {
    const e = filteredEvaluations.find(ev => ev.suggestionId === s.id);
    if (!e && stagesOf(s).includes("Board")) return [];
    const x = expectedSaving(s, e); // latest revision wins over the Kurul figure (Faz 5.1)
    return x.amount > 0 ? [toBaseCurrency(x.amount, x.currency, settings)] : [];
  });
  const approvedIncomeBase = approvedIncomeConverted.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const approvedIncomeExcluded = approvedIncomeConverted.filter(v => v === null).length;
  // Actual (Board-verified) saving next to the estimate — same conversion rule as above.
  const implBySuggestion = useMemo(() => {
    const map = new Map<string, KaizenImplementation>();
    implementations.forEach(i => map.set(i.suggestionId, i));
    return map;
  }, [implementations]);
  const verifiedConverted = filtered.flatMap(s => {
    const i = implBySuggestion.get(s.id);
    return i && i.verification?.status === "Doğrulandı" && (i.actualSaving || 0) > 0 ? [toBaseCurrency(i.actualSaving, i.actualSavingCurrency, settings)] : [];
  });
  const verifiedActualBase = verifiedConverted.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const verifiedExcluded = verifiedConverted.filter(v => v === null).length;

  // Geri dönüş (Faz 5.2): expected over approved suggestions, actual over Kurul-verified implementations.
  // Same per-suggestion rule as the ROI card; rows whose amounts cannot be converted are left out.
  const portfolio = (kind: "expected" | "actual") => {
    const rows = filtered.flatMap(s => {
      const e = filteredEvaluations.find(ev => ev.suggestionId === s.id);
      const i = implBySuggestion.get(s.id);
      if (kind === "expected" ? s.approvalStatus !== "Second Approval" : i?.verification?.status !== "Doğrulandı") return [];
      const r = suggestionRoi(s, e, i, settings, kind);
      return r ? [r] : [];
    });
    const ok = rows.flatMap(r => ("roi" in r ? [r.roi] : []));
    return { ...portfolioRoi(ok.map(r => ({ saving: r.saving, cost: r.cost, recurrence: r.recurrence }))), skipped: rows.length - ok.length };
  };
  const roiExpected = portfolio("expected");
  const roiActual = portfolio("actual");

  // Faz 5.3 göstergeleri — all from the filtered set, amounts in the base currency.
  // Kazançlı: accepted with a positive current expected saving (convertible or not).
  const accepted = filtered.filter(s => s.approvalStatus === "Second Approval");
  const profitableCount = accepted.filter(s => expectedSaving(s, evaluationBySuggestion.get(s.id)).amount > 0).length;
  const verifiedProfitableCount = filtered.filter(s => { const i = implBySuggestion.get(s.id); return i?.verification?.status === "Doğrulandı" && (i.actualSaving || 0) > 0; }).length;
  const submitters = new Set(filtered.map(s => s.personnelId || s.personnelName).filter(Boolean)).size;
  const perPerson = submitters ? Math.round((filtered.length / submitters) * 10) / 10 : 0;
  const perRoster = personnel.length ? Math.round((filtered.length / personnel.length) * 10) / 10 : 0;
  // Yatırım: accepted suggestions — the actual investment once entered on the implementation, else the estimate.
  const investment = accepted.reduce((acc, s) => {
    const i = implBySuggestion.get(s.id);
    const actual = (i?.actualCost || 0) > 0;
    const v = actual ? toBaseCurrency(i!.actualCost!, i!.actualCostCurrency || base, settings) : toBaseCurrency(s.estimatedCost || 0, s.estimatedCostCurrency, settings);
    if (v === null) return { ...acc, skipped: acc.skipped + 1 };
    return { total: acc.total + v, actual: acc.actual + (actual ? 1 : 0), skipped: acc.skipped };
  }, { total: 0, actual: 0, skipped: 0 });

  // Bölüm sıralaması: one row per department of the filtered suggestions.
  const [deptSort, setDeptSort] = useState<DeptKey>("count");
  const departmentRows = useMemo(() => {
    const headcount = team?.headcount ?? new Map<string, number>();
    if (!team) personnel.forEach(p => { const d = p.department || "Belirtilmemiş"; headcount.set(d, (headcount.get(d) || 0) + 1); });
    const rows = new Map<string, DeptRow>();
    for (const s of filtered) {
      const d = team ? team.groupOf(s) : s.personnelDepartment || "Belirtilmemiş";
      const r = rows.get(d) || { department: d, count: 0, people: new Set<string>(), accepted: 0, decided: 0, completed: 0, points: 0, expected: 0, actual: 0, headcount: headcount.get(d) || 0, perPerson: 0, rate: 0 };
      r.count++;
      r.people.add(s.personnelId || s.personnelName);
      // Kabul oranı counts final outcomes only — a suggestion still waiting for the Kurul is not "decided".
      if (s.approvalStatus === "Second Approval" || s.approvalStatus === "Rejected" || s.approvalStatus === "Rejected 2nd") r.decided++;
      if (s.approvalStatus === "Second Approval") {
        r.accepted++;
        const x = expectedSaving(s, evaluationBySuggestion.get(s.id));
        r.expected += toBaseCurrency(x.amount, x.currency, settings) ?? 0;
      }
      if (s.completed) r.completed++;
      r.points += evaluationBySuggestion.get(s.id)?.point || 0;
      const i = implBySuggestion.get(s.id);
      if (i?.verification?.status === "Doğrulandı") r.actual += toBaseCurrency(i.actualSaving || 0, i.actualSavingCurrency, settings) ?? 0;
      rows.set(d, r);
    }
    const list = Array.from(rows.values()).map(r => ({ ...r, perPerson: r.headcount ? r.count / r.headcount : 0, rate: r.decided ? Math.round((r.accepted / r.decided) * 100) : 0 }));
    return list.sort((a, b) => (b[deptSort] as number) - (a[deptSort] as number) || b.count - a.count);
  }, [filtered, personnel, evaluationBySuggestion, implBySuggestion, settings, deptSort, team]);

  // Fırsat havuzu (Faz 4.5) for the filtered set.
  const pool = useMemo(() => opportunityPool(filtered, evaluations, implementations, settings), [filtered, evaluations, implementations, settings]);
  const decided = filtered.filter(s => s.approvalStatus !== "Pending");
  const acceptedCount = decided.filter(s => statusBucket(s) === "approved").length;
  const acceptanceRate = decided.length > 0 ? Math.round((acceptedCount / decided.length) * 100) : 0;
  const participants = new Set(filtered.map(s => s.personnelName)).size;
  const participationRate = personnel.length > 0 ? Math.min(100, Math.round((participants / personnel.length) * 100)) : 0;

  // ---- Chart data ----
  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(s => { counts[s.approvalStatus] = (counts[s.approvalStatus] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ label: APPROVAL_STATUS_LABELS[status as ApprovalStatus] || status, count, fill: APPROVAL_STATUS_COLORS[status as ApprovalStatus] || "#64748b" }));
  }, [filtered]);

  const byDepartment = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(s => { const d = s.personnelDepartment || "Belirtilmemiş"; counts[d] = (counts[d] || 0) + 1; });
    return Object.entries(counts).map(([name, size], i) => ({ name, size, fill: TREEMAP_COLORS[i % TREEMAP_COLORS.length] })).sort((a, b) => b.size - a.size);
  }, [filtered]);

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(s => (s.suggestionTypes || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byMonth = useMemo(() => {
    const b: Record<string, { month: string; approved: number; pending: number; rejected: number; saving: number }> = {};
    filtered.forEach(s => {
      const month = (s.createdAt || "").slice(0, 7);
      if (!month) return;
      if (!b[month]) b[month] = { month, approved: 0, pending: 0, rejected: 0, saving: 0 };
      b[month][statusBucket(s)]++;
      b[month].saving += toBaseCurrency(s.estimatedSaving || 0, s.estimatedSavingCurrency, settings) ?? 0;
    });
    return Object.values(b).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered, settings]);

  const byPerson = useMemo(() => {
    const b: Record<string, { name: string; approved: number; pending: number; rejected: number }> = {};
    filtered.forEach(s => {
      const name = s.personnelName || "Belirtilmemiş";
      if (!b[name]) b[name] = { name, approved: 0, pending: 0, rejected: 0 };
      b[name][statusBucket(s)]++;
    });
    return Object.values(b).sort((a, b) => (b.approved + b.pending + b.rejected) - (a.approved + a.pending + a.rejected)).slice(0, 20);
  }, [filtered]);

  const flagCounts = { isg: filtered.filter(s => s.isg).length, cevre: filtered.filter(s => s.cevre).length, motivasyon: filtered.filter(s => s.motivasyon).length };

  const leaderboard = useMemo(() => {
    const m: Record<string, { name: string; department: string; count: number; points: number }> = {};
    filtered.forEach(s => {
      const name = s.personnelName || "Belirtilmemiş";
      if (!m[name]) m[name] = { name, department: s.personnelDepartment, count: 0, points: 0 };
      m[name].count++;
    });
    filteredEvaluations.forEach(e => {
      const s = filtered.find(x => x.id === e.suggestionId);
      if (s && m[s.personnelName || "Belirtilmemiş"]) m[s.personnelName || "Belirtilmemiş"].points += e.point || 0;
    });
    return Object.values(m).sort((a, b) => b.points - a.points || b.count - a.count).slice(0, 10);
  }, [filtered, filteredEvaluations]);

  const detailRows = useMemo(() => [...filtered].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")), [filtered]);

  // Rapor çıktıları (Faz 5.7): one pack of exactly what this screen shows (filters, team scope).
  const buildPack = (): ReportPack => {
    const money = (n: number) => Math.round(n);
    const conv = (n: number | undefined, c: string | undefined) => (n ? toBaseCurrency(n, c || base, settings) : 0);
    const filters = [
      fPersonnel !== ALL && `Personel: ${fPersonnel}`,
      fDepartment !== ALL && `Bölüm: ${fDepartment}`,
      fType !== ALL && `Sınıf: ${fType}`,
      fStatus !== ALL && `Durum: ${APPROVAL_STATUS_LABELS[fStatus as ApprovalStatus] || fStatus}`,
      fStage !== ALL && `Aşama: ${fStage}`,
      (fFrom || fTo) && `Tarih: ${fFrom || "…"} – ${fTo || "…"}`
    ].filter(Boolean) as string[];
    const groupLabel = team ? "Alt ekip" : "Bölüm";
    const expectedRoi = (s: KaizenSuggestion) => { const r = suggestionRoi(s, evaluationBySuggestion.get(s.id), implBySuggestion.get(s.id), settings, "expected"); return r && "roi" in r ? r.roi : null; };
    const expectedBase = (s: KaizenSuggestion) => { const x = expectedSaving(s, evaluationBySuggestion.get(s.id)); return toBaseCurrency(x.amount, x.currency, settings); };
    const statusOf = (s: KaizenSuggestion) => statusLabel(s.approvalStatus, s.requiredStages, s.feasibility?.status === "open");
    const statusCounts = new Map<string, number>();
    filtered.forEach(s => statusCounts.set(statusOf(s), (statusCounts.get(statusOf(s)) || 0) + 1));
    const pb = (m: number | null | undefined): XCell => (m === null || m === undefined ? null : m);
    const top = filtered
      .filter(s => s.approvalStatus !== "Rejected" && s.approvalStatus !== "Rejected 2nd")
      .map(s => ({ s, v: expectedBase(s) ?? 0 }))
      .filter(x => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 8);
    return {
      title: team ? "Ekip raporu" : "Kaizen raporu",
      company: companyName,
      scope: team ? `${team.leaderName} ekibi (alt kademeler dahil) · ${filtered.length} öneri` : `Tüm müşteri · ${filtered.length} / ${suggestions.length} öneri`,
      generatedAt: new Date().toISOString(),
      base,
      filters,
      kpis: [
        { label: "Toplam öneri", value: filtered.length },
        { label: "Uygulanan", value: completedCount },
        { label: "Kazançlı öneri", value: profitableCount },
        { label: "Kişi başı öneri", value: perPerson },
        { label: "Kurul puanı", value: totalPoints },
        { label: "Tahmini getiri", value: money(approvedIncomeBase), unit: base, hint: "Onaylanan öneriler" },
        { label: "Bekleyen potansiyel", value: money(pool.total), unit: base, hint: "Kabul edilmiş, uygulanmamış" },
        { label: "Toplam yatırım", value: money(investment.total), unit: base, hint: "Kabul edilenler; gerçekleşen yoksa tahmini" },
        { label: "Doğrulanmış gerçek kazanç", value: money(verifiedActualBase), unit: base },
        { label: "Net gerçek kazanç (ilk yıl)", value: money(roiActual.net), unit: base }
      ],
      roi: [
        { label: "Öneri sayısı", expected: roiExpected.count, actual: roiActual.count },
        { label: "Yıllık kazanç", expected: money(roiExpected.annual), actual: money(roiActual.annual), unit: base },
        { label: "Tek seferlik kazanç", expected: money(roiExpected.oneOff), actual: money(roiActual.oneOff), unit: base },
        { label: "Yatırım / maliyet", expected: money(roiExpected.cost), actual: money(roiActual.cost), unit: base },
        { label: "Net kazanç (ilk yıl)", expected: money(roiExpected.net), actual: money(roiActual.net), unit: base },
        { label: "ROI (%)", expected: roiExpected.roiPct, actual: roiActual.roiPct },
        { label: "Geri ödeme (ay)", expected: pb(roiExpected.paybackMonths), actual: pb(roiActual.paybackMonths) }
      ],
      ranking: {
        title: team ? "Alt Ekip Sıralaması" : "Bölüm Sıralaması",
        columns: [groupLabel, "Öneri", "Kişi başı", "Kabul %", "Uygulanan", "Puan", `Beklenen (${base})`, `Gerçek (${base})`],
        rows: departmentRows.map(r => [r.department, r.count, r.headcount ? Math.round(r.perPerson * 10) / 10 : null, r.decided ? r.rate : null, r.completed, r.points, money(r.expected), money(r.actual)])
      },
      statusCounts: Array.from(statusCounts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      top: {
        title: "En yüksek beklenen kazançlı öneriler",
        columns: ["Konu", "Kişi", groupLabel, "Durum", `Beklenen (${base})`, "Geri ödeme (ay)"],
        rows: top.map(({ s, v }) => [s.subject, s.personnelName, team ? team.groupOf(s) : s.personnelDepartment || "—", statusOf(s), money(v), pb(expectedRoi(s)?.paybackMonths)])
      },
      detailColumns: ["Tarih", "Sicil No", "Ad Soyad", "Bölüm", "Konu", "Sınıf", "Durum", "Kazanç Süresi", "Kazanç türü",
        "Beklenen kazanç", "Kazanç para birimi", `Beklenen kazanç (${base})`, "Tahmini maliyet", "Maliyet para birimi",
        "Gerçekleşen kazanç (doğrulanmış)", "Gerçekleşen yatırım", "Gerçekleşen para birimi",
        `Net kazanç, beklenen (${base})`, "ROI %, beklenen", "Geri ödeme (ay), beklenen", "Kurul puanı", "Uygulama durumu"],
      detailRows: detailRows.map(s => {
        const x = expectedSaving(s, evaluationBySuggestion.get(s.id));
        const i = implBySuggestion.get(s.id);
        const verified = i?.verification?.status === "Doğrulandı";
        const r = expectedRoi(s);
        return [
          (s.createdAt || "").slice(0, 10), s.personnelEmployeeNo || "", s.personnelName, s.personnelDepartment, s.subject,
          (s.suggestionTypes || []).join(", "), statusOf(s), s.paybackPeriod || "", recurrenceOf(s.paybackPeriod) === "annual" ? "Yıllık" : "Tek seferlik",
          x.amount || 0, x.currency || "", expectedBase(s), s.estimatedCost || 0, s.estimatedCostCurrency || "",
          verified ? i!.actualSaving || 0 : null, i?.actualCost || null, i ? i.actualSavingCurrency || "" : "",
          r ? money(r.net) : null, r?.roiPct ?? null, r ? pb(r.paybackMonths) : null,
          evaluationBySuggestion.get(s.id)?.point ?? null, i?.status || (s.approvalStatus === "Second Approval" ? "Plan yok" : "")
        ];
      })
    };
  };
  const download = () => exportReportExcel(buildPack());

  return (
    <div className="space-y-6">
      {pdfPack && <KaizenReportPdf pack={pdfPack} onClose={() => setPdfPack(null)} />}
      <PageHeader
        title={team ? "Ekip raporu" : "Kaizen raporu"}
        subtitle={team
          ? `${team.leaderName} ekibi (alt kademeler dahil) · ${filtered.length} / ${suggestions.length} öneri · ${personnel.length} kişi`
          : `${filtered.length} / ${suggestions.length} öneri · katılım, kazanç ve süreç görünümü`}
        actions={<>
          {hasFilter && <Button variant="outline" onClick={resetFilters}><RotateCcw className="w-4 h-4" />Filtreleri sıfırla</Button>}
          <Button variant="outline" onClick={() => setPdfPack(buildPack())} disabled={!filtered.length}><FileText className="w-4 h-4" />PDF özet</Button>
          <Button variant="primary" onClick={download} disabled={!filtered.length}><Download className="w-4 h-4" />Excel indir</Button>
        </>}
      />
      {/* Filters */}
      <Card className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Filtreler</p>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
          <select value={fPersonnel} onChange={e => setFPersonnel(e.target.value)} className={selectCls}><option value={ALL}>Tüm Personel</option>{personnelNames.map(n => <option key={n} value={n}>{n}</option>)}</select>
          <select value={fDepartment} onChange={e => setFDepartment(e.target.value)} className={selectCls}><option value={ALL}>Tüm Bölümler</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <select value={fType} onChange={e => setFType(e.target.value)} className={selectCls}><option value={ALL}>Tüm Sınıflar</option>{typeFilterOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={selectCls}><option value={ALL}>Tüm Durumlar</option>{Object.entries(APPROVAL_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={fStage} onChange={e => setFStage(e.target.value)} className={selectCls}><option value={ALL}>Tüm Aşamalar</option>{stageFilterOptions.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className={selectCls} aria-label="Başlangıç tarihi" />
          <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} className={selectCls} aria-label="Bitiş tarihi" />
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard label="Toplam Öneri" value={filtered.length} icon={Lightbulb} tone="slate" />
        <KpiCard label="Uygulanan" value={completedCount} icon={BadgeCheck} tone="teal" />
        <KpiCard label="Toplam Kaizen Puanı" value={totalPoints} icon={Award} tone="amber" />
        <KpiCard label={`Tahmini Getiri (${base})`} value={Math.round(approvedIncomeBase).toLocaleString("tr-TR")} icon={Coins} tone="emerald" hint={approvedIncomeExcluded > 0 ? `${approvedIncomeExcluded} kayıt çevrilemeyen para birimiyle, toplama dahil değil` : "Onaylanan öneriler"} />
        <KpiCard label={`Bekleyen Potansiyel (${base})`} value={Math.round(pool.total).toLocaleString("tr-TR")} icon={Gem} tone="amber" hint={`${pool.count} kabul edilmiş, uygulanmamış öneri${pool.buckets[2].count ? ` · ${pool.buckets[2].count} tanesi 90+ gün` : ""}`} />
        <KpiCard label="Kazançlı Öneri" value={profitableCount} icon={TrendingUp} tone="emerald" hint={`Kabul edilen ve beklenen kazancı olan · ${verifiedProfitableCount} tanesi doğrulanmış gerçek kazançlı`} />
        <KpiCard label="Kişi Başı Öneri" value={perPerson.toLocaleString("tr-TR")} icon={Users} tone="slate" hint={`${submitters} öneri veren kişi · tüm personele göre ${perRoster.toLocaleString("tr-TR")}`} />
        <KpiCard label={`Toplam Yatırım (${base})`} value={Math.round(investment.total).toLocaleString("tr-TR")} icon={Wallet} tone="slate" hint={`Kabul edilen öneriler · ${investment.actual} tanesi gerçekleşen tutar, diğerleri tahmini${investment.skipped ? ` · ${investment.skipped} kayıt çevrilemedi` : ""}`} />
        <KpiCard label={`Net Gerçek Kazanç (${base})`} value={Math.round(roiActual.net).toLocaleString("tr-TR")} icon={Coins} tone="teal" hint={`Doğrulanmış uygulamalar, ilk yıl: kazanç − yatırım · beklenen ${Math.round(roiExpected.net).toLocaleString("tr-TR")}`} />
        <KpiCard label={`Doğrulanmış Gerçek Kazanç (${base})`} value={Math.round(verifiedActualBase).toLocaleString("tr-TR")} icon={BadgeCheck} tone="teal" hint={verifiedExcluded > 0 ? `${verifiedExcluded} kayıt çevrilemeyen para birimiyle, toplama dahil değil` : "Uygulama sonrası Kurul tarafından doğrulanan"} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Gauge label="Kabul Edilen Öneri Oranı" hint={`${acceptedCount} / ${decided.length} karar verilen öneri`} value={acceptanceRate} color="#3b82f6" />
        <Gauge label="Katılım Oranı" hint={`${participants} / ${personnel.length} personel`} value={participationRate} color="#00A280" />
      </div>
      <RoiSummary base={base} expected={roiExpected} actual={roiActual} />
      {departmentRows.length > 0 && <DepartmentRanking rows={departmentRows} base={base} sort={deptSort} onSort={setDeptSort}
        title={team?.groupTitle} groupLabel={team ? "Alt ekip" : undefined} headcountHint={team ? "kişi başı = öneri ÷ alt ekipteki kişi" : undefined} />}

      {filtered.length === 0 ? (
        <Card><EmptyState icon={Lightbulb} title="Seçili filtrelerle öneri bulunamadı" /></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ChartCard title="Kaizen Sayısı / Ay">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" tick={TICK} /><YAxis allowDecimals={false} tick={TICK} /><Tooltip /><Legend />
                  <Bar dataKey="approved" name="Onaylandı" stackId="s" fill={BUCKET.approved} /><Bar dataKey="pending" name="Onay Bekliyor" stackId="s" fill={BUCKET.pending} /><Bar dataKey="rejected" name="Reddedildi" stackId="s" fill={BUCKET.rejected} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Departman Bazında Öneri">
              <ResponsiveContainer width="100%" height={300}>
                <Treemap data={byDepartment} dataKey="size" stroke="#fff" content={<TreemapCell />} />
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Kaizen Sayısı / Kişi (ilk 20)">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={byPerson}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ ...TICK, fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={80} /><YAxis allowDecimals={false} tick={TICK} /><Tooltip /><Legend />
                  <Bar dataKey="approved" name="Onaylandı" stackId="s" fill={BUCKET.approved} /><Bar dataKey="pending" name="Onay Bekliyor" stackId="s" fill={BUCKET.pending} /><Bar dataKey="rejected" name="Reddedildi" stackId="s" fill={BUCKET.rejected} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="İyileştirme Kategori Oranları">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart><Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} label={({ name, percent }: any) => `${name} ${Math.round((percent || 0) * 100)}%`}>
                  {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Durum Analizi">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byStatus}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={TICK} /><YAxis allowDecimals={false} tick={TICK} /><Tooltip />
                  <Bar dataKey="count" name="Öneri" radius={[6, 6, 0, 0]}>{byStatus.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title={`Finansal Etki (aylık, tahmini kazanç ${base})`}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={byMonth}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" tick={TICK} /><YAxis tick={TICK} /><Tooltip /><Legend />
                  <Line type="monotone" dataKey="saving" name={`Tahmini Kazanç (${base})`} stroke="#00A280" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <ChartCard title="Lider Panosu" className="xl:col-span-2">
              <ul className="divide-y divide-slate-100">
                {leaderboard.map((row, i) => (
                  <li key={row.name} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 text-center font-black ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-slate-300"}`}>{i < 3 ? <Trophy className="w-5 h-5 inline" /> : i + 1}</span>
                      <div><p className="text-sm font-bold text-slate-800">{row.name}</p><p className="text-xs text-slate-500">{row.department || "—"}</p></div>
                    </div>
                    <div className="text-right"><p className="text-sm font-black text-slate-900 tabular-nums">{row.points} puan</p><p className="text-xs text-slate-500">{row.count} öneri</p></div>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title="İSG / Çevre / Motivasyon">
              <div className="space-y-3">
                <Flag icon={ShieldAlert} label="İSG" value={flagCounts.isg} cls="text-red-600 bg-red-50" />
                <Flag icon={Leaf} label="Çevre" value={flagCounts.cevre} cls="text-emerald-700 bg-emerald-50" />
                <Flag icon={Sparkles} label="Motivasyon" value={flagCounts.motivasyon} cls="text-amber-600 bg-amber-50" />
              </div>
            </ChartCard>
          </div>

          <Card padded={false} className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-black text-slate-900">Personel Bazlı Kaizen Puan Tablosu</h3></div>
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead className={theadCls}><tr>
                  <th className={thCls}>Ad Soyad</th><th className={thCls}>Bölüm</th><th className={thCls}>Görev</th><th className={thCls}>Tarih</th><th className={thCls}>Sınıf</th><th className={thCls}>Durum</th><th className={thCls}>Kontrol Tarihi</th><th className={`${thCls} text-right`}>Tahmini Getiri</th><th className={`${thCls} text-right`}>Gerçek Getiri</th><th className={`${thCls} text-right`}>Geri Ödeme</th><th className={`${thCls} text-right`}>Puan</th><th className={thCls}>Tamamlanma</th>
                </tr></thead>
                <tbody>{detailRows.map(s => {
                  const e = evaluationBySuggestion.get(s.id);
                  const impl = implBySuggestion.get(s.id);
                  return (
                    <tr key={s.id} className={trCls}>
                      <td className={`${tdCls} font-semibold text-slate-900`}>{s.personnelName}</td><td className={tdCls}>{s.personnelDepartment}</td><td className={tdCls}>{s.personnelJobTitle}</td>
                      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>{(s.createdAt || "").slice(0, 10)}</td><td className={tdCls}>{(s.suggestionTypes || []).join(", ")}</td><td className={tdCls}>{statusLabel(s.approvalStatus, s.requiredStages, s.feasibility?.status === "open")}</td>
                      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>{e?.createdAt ? e.createdAt.slice(0, 10) : "—"}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{(() => { const x = expectedSaving(s, e); return e || x.source === "revised" ? `${x.amount.toLocaleString("tr-TR")} ${x.currency}` : "—"; })()}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{impl && impl.verification?.status === "Doğrulandı" ? `${impl.actualSaving.toLocaleString("tr-TR")} ${impl.actualSavingCurrency}` : "—"}</td>
                      <td className={`${tdCls} text-right tabular-nums whitespace-nowrap`}>{(() => {
                        // verified actual if any, else the expectation (Faz 5.2)
                        const r = suggestionRoi(s, e, impl, settings, impl?.verification?.status === "Doğrulandı" ? "actual" : "expected");
                        return r && "roi" in r && r.roi.cost > 0 ? paybackText(r.roi.paybackMonths) : "—";
                      })()}</td>
                      <td className={`${tdCls} text-right font-bold tabular-nums`}>{e?.point ?? "—"}</td>
                      <td className={`${tdCls} whitespace-nowrap`}>{impl ? `${impl.status}${actionProgress(impl).total ? ` · ${actionProgress(impl).done}/${actionProgress(impl).total}` : ""}` : s.completed ? "Uygulandı" : "—"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <Card className={className}><h3 className="font-black text-slate-900 mb-4">{title}</h3>{children}</Card>;
}

function Flag({ icon: Icon, label, value, cls }: { icon: any; label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-xl p-4 flex items-center gap-4 ${cls}`}>
      <Icon className="w-7 h-7 shrink-0" />
      <div><p className="text-2xl font-black tabular-nums leading-none">{value}</p><p className="text-sm font-semibold mt-1 opacity-80">{label}</p></div>
    </div>
  );
}

function Gauge({ label, hint, value, color }: { label: string; hint: string; value: number; color: string }) {
  return (
    <Card className="flex items-center gap-5">
      <div className="relative w-28 h-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value, fill: color }]} startAngle={90} endAngle={-270} barSize={12}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={6} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-black text-slate-900 tabular-nums">%{value}</span></div>
      </div>
      <div><p className="text-sm font-bold text-slate-900">{label}</p><p className="text-sm text-slate-500 mt-1">{hint}</p></div>
    </Card>
  );
}

function TreemapCell(props: any) {
  const { x, y, width, height, name, size, fill } = props;
  if (!name || width < 4 || height < 4) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={4} />
      {width > 70 && height > 40 && (
        <>
          <text x={x + 10} y={y + 22} fill="#fff" fontSize={13} fontWeight={700}>{name}</text>
          <text x={x + 10} y={y + 40} fill="#fff" fontSize={12} opacity={0.85}>{size} öneri</text>
        </>
      )}
    </g>
  );
}

// Geri dönüş özeti (Faz 5.2): expected (approved) next to actual (Kurul-verified), in the base currency.
type Portfolio = ReturnType<typeof portfolioRoi> & { skipped: number };
function RoiSummary({ base, expected, actual }: { base: string; expected: Portfolio; actual: Portfolio }) {
  if (!expected.count && !actual.count) return null;
  const money = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} ${base}`;
  const rows: [string, (p: Portfolio) => string][] = [
    ["Öneri sayısı", p => String(p.count)],
    ["Yıllık kazanç", p => money(p.annual)],
    ["Tek seferlik kazanç", p => money(p.oneOff)],
    ["Yatırım / maliyet", p => money(p.cost)],
    ["Net kazanç (ilk yıl)", p => money(p.net)],
    ["ROI", p => (p.roiPct === null ? "—" : `%${p.roiPct.toLocaleString("tr-TR")}`)],
    ["Geri ödeme süresi", p => paybackText(p.paybackMonths)]
  ];
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-base font-bold text-slate-900">Geri Dönüş</h3>
        <p className="text-xs text-slate-500">Beklenen: Kurul'un kabul ettiği öneriler · Gerçekleşen: Kurul'un doğruladığı uygulamalar</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full max-w-3xl text-sm min-w-[28rem]">
          <thead><tr className="text-xs text-slate-500"><th className="text-left font-semibold pb-2" /><th className="text-right font-semibold pb-2">Beklenen</th><th className="text-right font-semibold pb-2">Gerçekleşen</th></tr></thead>
          <tbody>
            {rows.map(([l, f]) => (
              <tr key={l} className="border-t border-slate-100">
                <td className="py-2 text-slate-600">{l}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{expected.count ? f(expected) : "—"}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{actual.count ? f(actual) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="text-xs text-slate-500 mt-3 space-y-0.5 list-disc list-inside">
        <li>Kazanç Süresi "Parça Başı" ve "Senelik" olanlar yıllık, diğerleri tek seferlik sayılır. ROI ilk yıl içindir: (yıllık + tek seferlik − yatırım) ÷ yatırım.</li>
        <li>Geri ödeme: tek seferlik kazançların karşılamadığı yatırım ÷ yıllık kazanç × 12. Gerçekleşende yatırım girilmemişse tahmini maliyet kullanılır.</li>
        {expected.skipped + actual.skipped > 0 && <li className="text-amber-700">{expected.skipped + actual.skipped} kayıt çevrilemeyen para birimiyle, hesaba dahil değil.</li>}
      </ul>
    </Card>
  );
}

// Bölüm sıralama tablosu (Faz 5.3). Kişi başı öneri uses the department's roster headcount.
type DeptRow = { department: string; count: number; people: Set<string>; accepted: number; decided: number; completed: number; points: number; expected: number; actual: number; headcount: number; perPerson: number; rate: number };
type DeptKey = "count" | "perPerson" | "rate" | "completed" | "points" | "expected" | "actual";
function DepartmentRanking({ rows, base, sort, onSort, title = "Bölüm Sıralaması", groupLabel = "Bölüm", headcountHint = "kişi başı = öneri ÷ bölümdeki personel" }: {
  rows: DeptRow[]; base: string; sort: DeptKey; onSort: (k: DeptKey) => void; title?: string; groupLabel?: string; headcountHint?: string;
}) {
  const money = (n: number) => Math.round(n).toLocaleString("tr-TR");
  const cols: [DeptKey, string, (r: DeptRow) => string][] = [
    ["count", "Öneri", r => String(r.count)],
    ["perPerson", "Kişi başı", r => (r.headcount ? (Math.round(r.perPerson * 10) / 10).toLocaleString("tr-TR") : "—")],
    ["rate", "Kabul oranı", r => (r.decided ? `%${r.rate}` : "—")],
    ["completed", "Uygulanan", r => String(r.completed)],
    ["points", "Puan", r => String(r.points)],
    ["expected", `Beklenen kazanç (${base})`, r => money(r.expected)],
    ["actual", `Gerçek kazanç (${base})`, r => money(r.actual)]
  ];
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-500" />{title}</h3>
        <p className="text-xs text-slate-500">Sütun başlığına basarak sıralayın · {headcountHint}</p>
      </div>
      <div className="overflow-x-auto">
        <table className={tableCls}>
          <thead className={theadCls}><tr>
            <th className={thCls}>#</th><th className={thCls}>{groupLabel}</th>
            {cols.map(([k, l]) => (
              <th key={k} className={`${thCls} text-right`} aria-sort={sort === k ? "descending" : "none"}>
                <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 cursor-pointer hover:text-slate-900 ${sort === k ? "text-slate-900" : ""}`}>{l}<ArrowUpDown className="w-3 h-3" /></button>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.department} className={trCls}>
                <td className={`${tdCls} tabular-nums text-slate-400`}>{i + 1}</td>
                <td className={`${tdCls} font-semibold text-slate-900`}>{r.department}<span className="block text-[11px] font-normal text-slate-400">{r.people.size} kişi öneri verdi{r.headcount ? ` / ${r.headcount}` : ""}</span></td>
                {cols.map(([k, , f]) => <td key={k} className={`${tdCls} text-right tabular-nums ${sort === k ? "font-bold text-slate-900" : ""}`}>{f(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
