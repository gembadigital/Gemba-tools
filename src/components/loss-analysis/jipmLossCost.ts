// JIPM-style TPM Loss Cost Analysis: the 16 major losses per station, in time and money.
// When the station has an OEE, its loss (loading time × (1 − OEE)) is distributed over the equipment
// losses: availability loss → breakdown, setup & adjustment, tool change, start-up (measured / entered
// minutes; the unexplained rest stays a named "other availability loss"); performance loss → minor
// stops, the rest is speed loss; quality loss → defects & rework. Without A/P/Q only the measured
// minutes are placed and the rest of the OEE loss is shown as "not split". Without an OEE, only
// measured / entered minutes are listed. Human and resource losses come from measured data or the
// consultant's entries. Costs use the rates resolved in lossCosting.ts — nothing is assumed.
import { CalculatedProcess } from "./types";
import { ProcessRates } from "./lossCosting";

export type JipmGroup = "Ekipman" | "İnsan" | "Kaynak";

export interface JipmLossDef {
  no: number;
  key: string;
  name: string;
  group: JipmGroup;
  oeePart?: "availability" | "performance" | "quality";
  tool: string; // lean / TPM tool for the Kobetsu Kaizen project
}

export const JIPM_LOSSES: JipmLossDef[] = [
  { no: 1, key: "breakdown", name: "Arıza", group: "Ekipman", oeePart: "availability", tool: "TPM: Otonom & Planlı Bakım" },
  { no: 2, key: "setup", name: "Setup ve ayar", group: "Ekipman", oeePart: "availability", tool: "SMED" },
  { no: 3, key: "toolChange", name: "Takım / bıçak değişimi", group: "Ekipman", oeePart: "availability", tool: "SMED, takım ömrü yönetimi" },
  { no: 4, key: "startup", name: "Başlangıç (devreye alma)", group: "Ekipman", oeePart: "availability", tool: "Standart devreye alma, SMED" },
  { no: 5, key: "minorStops", name: "Küçük duruş ve boşta çalışma", group: "Ekipman", oeePart: "performance", tool: "Kobetsu Kaizen, Poka-Yoke" },
  { no: 6, key: "speed", name: "Hız kaybı", group: "Ekipman", oeePart: "performance", tool: "Kobetsu Kaizen, darboğaz yönetimi" },
  { no: 7, key: "defects", name: "Hata ve yeniden işleme", group: "Ekipman", oeePart: "quality", tool: "Kalite Bakımı, kök neden analizi" },
  { no: 8, key: "shutdown", name: "Planlı duruş (bakım)", group: "Ekipman", tool: "Planlı Bakım" },
  { no: 9, key: "management", name: "Yönetim kaybı (malzeme / talimat bekleme)", group: "İnsan", tool: "Günlük yönetim, planlama" },
  { no: 10, key: "motion", name: "Hareket kaybı", group: "İnsan", tool: "Standart iş, ergonomi, 5S" },
  { no: 11, key: "lineOrganization", name: "Hat organizasyonu kaybı", group: "İnsan", tool: "Hat dengeleme, Yamazumi" },
  { no: 12, key: "logistics", name: "Lojistik kaybı", group: "İnsan", tool: "Milk-run, yerleşim" },
  { no: 13, key: "measurement", name: "Ölçme ve ayar kaybı", group: "İnsan", tool: "Poka-Yoke, ölçüm standardı" },
  { no: 14, key: "yield", name: "Verim (malzeme) kaybı", group: "Kaynak", tool: "Kalite Bakımı, fire azaltma" },
  { no: 15, key: "energy", name: "Enerji kaybı", group: "Kaynak", tool: "Enerji yönetimi" },
  { no: 16, key: "dieTool", name: "Kalıp / takım / aparat kaybı", group: "Kaynak", tool: "Takım ömrü yönetimi" }
];

// Consultant entries per station for losses VSM does not measure. Saved in loss-capacity-settings.
export interface JipmStationInputs {
  toolChangeMinutesPerDay?: number;
  startupMinutesPerDay?: number;
  minorStopsMinutesPerDay?: number;  // overrides the VSM value
  motionPersonHoursPerDay?: number;
  logisticsPersonHoursPerDay?: number;
  measurementPersonHoursPerDay?: number;
  energyLossPerYear?: number;
  dieToolLossPerYear?: number;
}

export type JipmSource = "ölçüm" | "giriş" | "OEE dağılımı" | null;

export interface JipmLine {
  def: JipmLossDef;
  minutesPerDay: number;      // equipment time (losses 1–8)
  personHoursPerDay: number;  // human time (losses 9–13)
  source: JipmSource;
  labor: number;              // annual cost elements
  machine: number;
  material: number;
  direct: number;             // energy / die-tool amounts entered as money
  total: number;
  priced: boolean;            // false: time known but a rate is missing
  contribution: number;       // lost contribution margin if output is short of plan (not in total)
  note: string;
}

export interface JipmStationResult {
  id: string;
  name: string;
  oeeSource: "VSM" | "Loss" | null;
  oee: number | null;         // %
  loadingMinutesPerDay: number;
  oeeLossMinutesPerDay: number;
  unexplainedMinutesPerDay: number; // OEE loss not tied to a named loss
  unexplainedCost: number;          // that time priced like an equipment stop (annual)
  lines: JipmLine[];
  warnings: string[];
}

export interface StationOee {
  oee?: number;          // %
  availability?: number; // %
  performance?: number;  // %
  quality?: number;      // %
  source: "VSM" | "Loss";
  loadingMinutesPerDay: number;
}

export interface JipmContext {
  unitMaterial: number | null;      // card: material per piece
  contributionPerUnit: number | null; // card: (revenue − material − energy) / volume
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// Scales measured minutes down to the bucket when they exceed it (data does not add up).
function fit(measured: number[], bucket: number): { values: number[]; over: boolean } {
  const sum = measured.reduce((s, v) => s + v, 0);
  if (sum <= bucket || sum === 0) return { values: measured, over: false };
  return { values: measured.map(v => v * bucket / sum), over: true };
}

export function computeJipmStation(
  p: CalculatedProcess,
  oeeData: StationOee | null,
  inputs: JipmStationInputs,
  rates: ProcessRates,
  ctx: JipmContext
): JipmStationResult {
  const warnings: string[] = [];
  const daysYear = p.workingDaysPerWeek * 52;
  if (!daysYear) warnings.push("Haftalık çalışma günü girilmedi — yıllık tutarlar hesaplanamıyor.");
  const n = (v: number | undefined) => (typeof v === "number" && v > 0 ? v : 0);

  // Measured / entered equipment minutes per day.
  const perDayFromWeek = (weekly: number) => (p.workingDaysPerWeek > 0 ? weekly / p.workingDaysPerWeek : 0);
  const measured: Record<string, { min: number; src: JipmSource }> = {
    breakdown: { min: p.breakdownMinutesPerShift * p.shiftsPerDay, src: "ölçüm" },
    setup: { min: perDayFromWeek((p.setupTimeMinutes + p.machineAdjustmentMinutes) * p.setupFrequencyPerWeek), src: "ölçüm" },
    toolChange: { min: n(inputs.toolChangeMinutesPerDay), src: "giriş" },
    startup: { min: n(inputs.startupMinutesPerDay), src: "giriş" },
    minorStops: inputs.minorStopsMinutesPerDay !== undefined
      ? { min: n(inputs.minorStopsMinutesPerDay), src: "giriş" }
      : { min: n(p.minorStopsMinutesPerDay), src: "ölçüm" }
  };
  const minutes: Record<string, { min: number; src: JipmSource }> = { ...measured, speed: { min: 0, src: null }, defects: { min: 0, src: null } };
  let unexplained = 0;
  let oeeLoss = 0;
  const L = oeeData?.loadingMinutesPerDay ?? 0;
  const oee = oeeData?.oee !== undefined && oeeData.oee > 0 ? oeeData.oee / 100 : null;

  if (oee !== null && L > 0) {
    oeeLoss = L * (1 - oee);
    const A = oeeData?.availability ? oeeData.availability / 100 : null;
    const P = oeeData?.performance ? oeeData.performance / 100 : null;
    const Q = oeeData?.quality ? oeeData.quality / 100 : null;
    if (A !== null && P !== null && Q !== null) {
      const availLoss = L * (1 - A);
      const perfLoss = L * A * (1 - P);
      const qualLoss = L * A * P * (1 - Q);
      const availKeys = ["breakdown", "setup", "toolChange", "startup"];
      const fa = fit(availKeys.map(k => minutes[k].min), availLoss);
      availKeys.forEach((k, i) => { minutes[k] = { min: fa.values[i], src: minutes[k].min > 0 ? minutes[k].src : null }; });
      if (fa.over) warnings.push("Ölçülen arıza + setup + takım değişimi + başlangıç süresi, OEE'nin kullanılabilirlik kaybını aşıyor; oranlanarak sığdırıldı. Verileri kontrol edin.");
      const otherAvail = Math.max(0, availLoss - fa.values.reduce((s, v) => s + v, 0));
      if (otherAvail > 0.05) {
        // Availability loss no named loss accounts for: kept apart (shown and priced as "dağıtılamayan").
        unexplained += otherAvail;
        warnings.push(`Kullanılabilirlik kaybının ${r1(otherAvail)} dk/gün'ü ölçülen kayıplarla açıklanmıyor (takım değişimi / başlangıç girilmediyse buraya düşer).`);
      }
      const fm = fit([minutes.minorStops.min], perfLoss);
      minutes.minorStops = { min: fm.values[0], src: minutes.minorStops.min > 0 ? minutes.minorStops.src : null };
      if (fm.over) warnings.push("Küçük duruş süresi OEE'nin performans kaybını aşıyor; performans kaybına sığdırıldı.");
      minutes.speed = { min: Math.max(0, perfLoss - fm.values[0]), src: "OEE dağılımı" };
      minutes.defects = { min: qualLoss, src: "OEE dağılımı" };
    } else {
      // Only the total OEE: place measured minutes, the rest is not split.
      const keys = ["breakdown", "setup", "toolChange", "startup", "minorStops"];
      const f = fit(keys.map(k => minutes[k].min), oeeLoss);
      keys.forEach((k, i) => { minutes[k] = { min: f.values[i], src: minutes[k].min > 0 ? minutes[k].src : null }; });
      unexplained = Math.max(0, oeeLoss - f.values.reduce((s, v) => s + v, 0));
      warnings.push("OEE bileşenleri (kullanılabilirlik / performans / kalite) yok; OEE kaybının ölçülen kayıplarla açıklanmayan kısmı dağıtılamadı.");
    }
  } else {
    warnings.push("OEE girilmedi — yalnızca ölçülen / girilen kayıp süreleri listeleniyor (OEE dağılımı yapılmadı).");
    for (const k of Object.keys(minutes)) if (minutes[k].min <= 0) minutes[k].src = null;
  }
  minutes.shutdown = { min: p.plannedMaintenanceMinutes * p.shiftsPerDay, src: p.plannedMaintenanceMinutes > 0 ? "ölçüm" : null };

  // Human losses (person-hours/day).
  const human: Record<string, { h: number; src: JipmSource }> = {
    management: { h: n(p.waitingMinutesPerDay) / 60 * p.operatorsPerShift, src: n(p.waitingMinutesPerDay) > 0 ? "ölçüm" : null },
    motion: { h: n(inputs.motionPersonHoursPerDay), src: n(inputs.motionPersonHoursPerDay) > 0 ? "giriş" : null },
    lineOrganization: { h: p.excessLaborHeadcount * p.workingHoursPerShift, src: p.excessLaborHeadcount > 0 ? "ölçüm" : null },
    logistics: { h: n(inputs.logisticsPersonHoursPerDay), src: n(inputs.logisticsPersonHoursPerDay) > 0 ? "giriş" : null },
    measurement: { h: n(inputs.measurementPersonHoursPerDay), src: n(inputs.measurementPersonHoursPerDay) > 0 ? "giriş" : null }
  };

  const machineRate = rates.machineHour.source ? rates.machineHour.value * (p.machineCount ?? 1) : null;
  const laborRate = rates.laborHour.source ? rates.laborHour.value : null;
  const idealCT = p.theoreticalCycleTime;
  // Lost contribution: only where output is short of plan (demand evidence), capped to the plan gap.
  const planGapUnits = Math.max(0, p.plannedQtyPerDay - p.producedQtyPerDay);

  const lines: JipmLine[] = JIPM_LOSSES.map(def => {
    let labor = 0, machine = 0, material = 0, direct = 0, priced = true, contribution = 0, note = "";
    let minutesPerDay = 0, personHoursPerDay = 0;
    let source: JipmSource = null;
    if (def.no <= 8) {
      const m = minutes[def.key];
      minutesPerDay = m?.min ?? 0;
      source = m?.src ?? null;
      if (minutesPerDay > 0) {
        const hYear = minutesPerDay / 60 * daysYear;
        if (machineRate === null && laborRate === null) priced = false;
        machine = machineRate !== null ? hYear * machineRate : 0;
        labor = laborRate !== null ? hYear * laborRate * p.operatorsPerShift : 0;
        note = `${r1(minutesPerDay)} dk/gün × ${daysYear} gün × (makine saati${machineRate === null ? " yok" : ""} + işçilik saati${laborRate === null ? " yok" : ""} × ${p.operatorsPerShift} operatör)`;
        if (def.no <= 7 && planGapUnits > 0 && idealCT > 0 && ctx.contributionPerUnit) {
          contribution = Math.min(minutesPerDay * 60 / idealCT, planGapUnits) * ctx.contributionPerUnit * daysYear;
        }
      }
    } else if (def.no <= 13) {
      const h = human[def.key];
      personHoursPerDay = h.h;
      source = h.src;
      if (personHoursPerDay > 0) {
        if (laborRate === null) priced = false;
        labor = laborRate !== null ? personHoursPerDay * laborRate * daysYear : 0;
        note = `${r1(personHoursPerDay)} kişi-saat/gün × ${daysYear} gün × işçilik saati${laborRate === null ? " (yok)" : ""}`;
      }
    } else if (def.key === "yield") {
      if (p.scrapQty > 0) {
        source = "ölçüm";
        // Material lost per scrapped piece: the card's average material cost, but never more than this
        // station's own resolved scrap unit cost (a small plastic part is not an average product).
        const unitMat = ctx.unitMaterial !== null && rates.scrapUnit.source ? Math.min(ctx.unitMaterial, rates.scrapUnit.value)
          : ctx.unitMaterial !== null ? ctx.unitMaterial : rates.scrapUnit.source ? rates.scrapUnit.value : null;
        if (unitMat === null) priced = false;
        material = unitMat !== null ? p.scrapQty * unitMat * daysYear : 0;
        note = `Hurda ${p.scrapQty} adet/gün × birim malzeme${unitMat === null ? " (bulunamadı)" : ""} × ${daysYear} gün`;
      }
    } else {
      const v = def.key === "energy" ? n(inputs.energyLossPerYear) : n(inputs.dieToolLossPerYear);
      if (v > 0) { source = "giriş"; direct = v; note = "Girilen yıllık tutar"; }
    }
    // A loss with no time / quantity at all is simply not present — not "unpriced".
    if (!source) priced = true;
    const total = labor + machine + material + direct;
    return { def, minutesPerDay, personHoursPerDay, source, labor, machine, material, direct, total, priced, contribution, note };
  });

  if (lines.some(l => l.contribution > 0)) {
    // The same lost minutes cannot fill the plan gap twice: scale contributions to the gap.
    const units = lines.filter(l => l.def.no <= 7).reduce((s, l) => s + (idealCT > 0 ? l.minutesPerDay * 60 / idealCT : 0), 0);
    const scale = units > planGapUnits && units > 0 ? planGapUnits / units : 1;
    lines.forEach(l => { if (l.def.no <= 7) l.contribution = idealCT > 0 && ctx.contributionPerUnit ? (l.minutesPerDay * 60 / idealCT) * scale * ctx.contributionPerUnit * daysYear : 0; });
  }

  return {
    id: p.id,
    name: p.name,
    oeeSource: oee !== null ? oeeData!.source : null,
    oee: oee !== null ? oee * 100 : null,
    loadingMinutesPerDay: L,
    oeeLossMinutesPerDay: oeeLoss,
    unexplainedMinutesPerDay: unexplained,
    unexplainedCost: unexplained / 60 * daysYear * ((machineRate ?? 0) + (laborRate ?? 0) * p.operatorsPerShift),
    lines,
    warnings
  };
}

// OEE of a station: the VSM-measured OEE (with its A/P/Q) when the station comes from VSM, else the
// OEE this screen computes — only when none of its inputs is missing.
export function stationOeeOf(p: CalculatedProcess): StationOee | null {
  if (p.vsmOee && p.vsmOee.oee && p.vsmOee.oee > 0) {
    return {
      oee: p.vsmOee.oee, availability: p.vsmOee.availability, performance: p.vsmOee.performance, quality: p.vsmOee.quality,
      source: "VSM",
      // VSM's OEE base is the shift time (production minutes), see vsmCalc.computeProcessMetrics.
      loadingMinutesPerDay: p.shiftsPerDay * p.workingHoursPerShift * 60
    };
  }
  if ((p.missingFields?.length ?? 0) === 0 && p.oee > 0) {
    return {
      oee: p.oee, availability: p.availability * 100, performance: p.performance * 100, quality: p.quality * 100,
      source: "Loss",
      loadingMinutesPerDay: p.dailyNetWorkingTimeAvailable
    };
  }
  return null;
}
