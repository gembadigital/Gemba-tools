// Loss costing — Gemba Tools adaptation of the Gemba QLA engine (Gemba-QLA src/engine/qla.ts).
// Every rate a loss is priced with is resolved per station in this order:
//   1. "birim" — unit cost the consultant entered on the Loss screen
//   2. "vsm"   — unit cost entered in the station's VSM project setup
//   3. "kart"  — derived from the customer card (revenue, annual volume, cost structure %), QLA formulas
// A rate none of these can give stays unresolved: the loss it prices is not counted and is listed as
// "hesaplanamadı" — no assumed value is used. Pure functions, no React.
import { CalculatedProcess, ProcessItem } from "./types";

export type RateSource = "birim" | "vsm" | "kart";

export interface ResolvedRate {
  value: number;
  source: RateSource | null; // null = not resolvable
  note: string;              // formula / where it came from, or what is missing
}

// Saved per customer in loss-capacity-settings (`unitCosts`). Empty = not entered.
export interface LossUnitCosts {
  scrapUnitCost?: number;           // per scrapped piece
  reworkUnitCost?: number;          // per reworked piece
  laborHourlyRate?: number;         // fully loaded direct labor, per person-hour
  holdingCostPerWipYearly?: number; // per WIP piece per year
  // Machine hour cost per line: key = VSM project id (one VSM project = one line / product group),
  // FACTORY_LINE_KEY for stations that are not part of a VSM project.
  machineHourlyByLine?: Record<string, number>;
}

export const FACTORY_LINE_KEY = "_factory";

// Customer-card inputs of method B. Percentages of revenue; 0 = not entered.
export interface CardCostBasis {
  revenue: number;
  annualVolume: number;
  materialPct: number;
  laborPct: number;
  energyPct: number;
  maintenancePct: number;
  holdingRatePct: number;   // stock carrying rate, % per year (financing + storage + obsolescence)
  directHeadcount: number;  // blue-collar headcount on the card
  hoursPerPersonYear: number; // shift hours × working days / week × 52 from the card
}

// QLA assumptions kept as-is (same names as ASSUMPTIONS in qla.ts).
export const QLA_ASSUMPTIONS = {
  /** Share of labor + energy already put into a scrapped piece (average degree of processing) */
  scrapConversionShare: 0.5,
  /** Labor + energy a reworked piece consumes, relative to first processing */
  reworkEffort: 0.5,
  /** WIP is valued at material + half of conversion (material at the start, conversion along the way) */
  wipConversionShare: 0.5
};

export interface CardDerived {
  unitMaterial: number | null;
  unitConversion: number | null;
  scrapUnit: ResolvedRate;
  reworkUnit: ResolvedRate;
  laborHour: ResolvedRate;
  machineHour: ResolvedRate; // factory-wide (card cannot tell lines apart)
  wipHolding: ResolvedRate;  // per WIP piece per year
}

const unresolved = (note: string): ResolvedRate => ({ value: 0, source: null, note });
const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);

// Machine-hours per year of the given stations: machines × shifts × hours × working days × 52.
export function machineHoursPerYear(processes: ProcessItem[]): number {
  return processes.reduce((s, p) => s + Math.max(0, p.machineCount ?? 0) * p.shiftsPerDay * p.workingHoursPerShift * p.workingDaysPerWeek * 52, 0);
}

export function deriveFromCard(card: CardCostBasis, stationsForMachineHours: ProcessItem[]): CardDerived {
  const A = QLA_ASSUMPTIONS;
  const C = card.revenue > 0 ? card.revenue : 0;
  const V = card.annualVolume > 0 ? card.annualVolume : 0;
  const malzeme = C * card.materialPct / 100;
  const iscilik = C * card.laborPct / 100;
  const enerji = C * card.energyPct / 100;
  const bakim = C * card.maintenancePct / 100;

  const missingBase: string[] = [];
  if (!C) missingBase.push("yıllık ciro");
  if (!V) missingBase.push("yıllık üretim adedi");
  const unitMaterial = C && V && card.materialPct > 0 ? malzeme / V : null;
  const unitConversion = C && V && (card.laborPct > 0 || card.energyPct > 0) ? (iscilik + enerji) / V : null;

  const scrapUnit = unitMaterial !== null && unitConversion !== null
    ? { value: unitMaterial + A.scrapConversionShare * unitConversion, source: "kart" as const,
        note: `Malzeme ${fmt(unitMaterial)} + %${A.scrapConversionShare * 100} × (İşçilik + Enerji) ${fmt(unitConversion)} / adet` }
    : unresolved(`Karttan türetilemedi — eksik: ${[...missingBase, ...(card.materialPct > 0 ? [] : ["malzeme %"]), ...(card.laborPct > 0 || card.energyPct > 0 ? [] : ["işçilik/enerji %"])].join(", ")}`);

  const reworkUnit = unitConversion !== null
    ? { value: A.reworkEffort * unitConversion, source: "kart" as const,
        note: `%${A.reworkEffort * 100} × (İşçilik + Enerji) ${fmt(unitConversion)} / adet` }
    : unresolved(`Karttan türetilemedi — eksik: ${[...missingBase, ...(card.laborPct > 0 || card.energyPct > 0 ? [] : ["işçilik/enerji %"])].join(", ")}`);

  const personHours = card.directHeadcount * card.hoursPerPersonYear;
  const laborHour = iscilik > 0 && personHours > 0
    ? { value: iscilik / personHours, source: "kart" as const,
        note: `Ciro × işçilik %${card.laborPct} / (${card.directHeadcount} mavi yaka × ${fmt(card.hoursPerPersonYear)} saat/yıl)` }
    : unresolved(`Karttan türetilemedi — eksik: ${[...(C ? [] : ["yıllık ciro"]), ...(card.laborPct > 0 ? [] : ["işçilik %"]), ...(personHours > 0 ? [] : ["mavi yaka sayısı / vardiya saati / haftalık gün"])].join(", ")}`);

  const mh = machineHoursPerYear(stationsForMachineHours);
  const machineHour = (enerji + bakim) > 0 && mh > 0
    ? { value: (enerji + bakim) / mh, source: "kart" as const,
        note: `Ciro × (enerji %${card.energyPct} + bakım %${card.maintenancePct}) / ${fmt(mh)} makine-saat/yıl (tablodaki istasyonlar)` }
    : unresolved(`Karttan türetilemedi — eksik: ${[...(C ? [] : ["yıllık ciro"]), ...((card.energyPct > 0 || card.maintenancePct > 0) ? [] : ["enerji/bakım %"]), ...(mh > 0 ? [] : ["istasyonların makine sayısı / vardiya / saat / gün"])].join(", ")}`);

  const wipValue = unitMaterial !== null ? unitMaterial + A.wipConversionShare * (unitConversion ?? 0) : null;
  const wipHolding = wipValue !== null && card.holdingRatePct > 0
    ? { value: wipValue * card.holdingRatePct / 100, source: "kart" as const,
        note: `Yarı mamul değeri ${fmt(wipValue)} × taşıma oranı %${card.holdingRatePct} / yıl` }
    : unresolved(`Karttan türetilemedi — eksik: ${[...(wipValue !== null ? [] : [...missingBase, "malzeme %"]), ...(card.holdingRatePct > 0 ? [] : ["stok taşıma oranı %"])].join(", ")}`);

  return { unitMaterial, unitConversion, scrapUnit, reworkUnit, laborHour, machineHour, wipHolding };
}

export interface ProcessRates {
  scrapUnit: ResolvedRate;
  reworkUnit: ResolvedRate;
  laborHour: ResolvedRate;
  machineHour: ResolvedRate;
  wipHolding: ResolvedRate;
}

const pick = (entered: number | undefined, enteredNote: string, vsm: number | undefined, vsmNote: string, card: ResolvedRate): ResolvedRate => {
  if (typeof entered === "number" && entered > 0) return { value: entered, source: "birim", note: enteredNote };
  if (typeof vsm === "number" && vsm > 0) return { value: vsm, source: "vsm", note: vsmNote };
  return card;
};

export function resolveProcessRates(p: ProcessItem, unit: LossUnitCosts, card: CardDerived): ProcessRates {
  const v = p.vsmUnitCosts ?? {};
  const lineKey = p.vsmProjectId || FACTORY_LINE_KEY;
  return {
    scrapUnit: pick(unit.scrapUnitCost, "Girilen hurda birim maliyeti", v.scrapUnitCost, "VSM Kurulum: hurda birim maliyeti", card.scrapUnit),
    reworkUnit: pick(unit.reworkUnitCost, "Girilen rework birim maliyeti", undefined, "", card.reworkUnit),
    laborHour: pick(unit.laborHourlyRate, "Girilen işçilik saat maliyeti", undefined, "", card.laborHour),
    machineHour: pick(unit.machineHourlyByLine?.[lineKey], "Girilen hat makine saat maliyeti", v.downtimeHourlyCost, "VSM Kurulum: duruş saat maliyeti", card.machineHour),
    wipHolding: pick(unit.holdingCostPerWipYearly, "Girilen stok taşıma maliyeti (adet/yıl)", v.holdingCostPerWipYearly, "VSM Kurulum: WIP yıllık taşıma maliyeti", card.wipHolding)
  };
}

export interface LossCostLine { year: number; unresolved: string[] }

export type LossCostKey = "scrap" | "rework" | "downtime" | "setup" | "laborLoss" | "inventory";

export interface ProcessLossCosts {
  // Annual amount per station and line; a line is absent when its rate did not resolve.
  byStation: Record<string, Partial<Record<LossCostKey, number>>>;
  scrap: LossCostLine;
  rework: LossCostLine;
  downtime: LossCostLine;
  setup: LossCostLine;
  laborLoss: LossCostLine;
  inventory: LossCostLine;
}

// Annual cost of the measured losses, per station, from the resolved rates. Days per year = working
// days per week × 52 of each station. Stop time (breakdown, setup + adjustment) is priced at
// machine hour × machines + labor hour × operators (the crew waits during the stop); a station whose
// machine count is unknown is priced with one machine and says so.
export function calculateLossCosts(calculated: CalculatedProcess[], ratesById: Record<string, ProcessRates>): ProcessLossCosts {
  const lines: ProcessLossCosts = {
    byStation: {},
    scrap: { year: 0, unresolved: [] }, rework: { year: 0, unresolved: [] }, downtime: { year: 0, unresolved: [] },
    setup: { year: 0, unresolved: [] }, laborLoss: { year: 0, unresolved: [] }, inventory: { year: 0, unresolved: [] }
  };
  // quantity × rate when the rate resolved; a loss with quantity but no rate is listed, not counted.
  const add = (key: LossCostKey, p: CalculatedProcess, quantity: number, rate: number | null) => {
    if (rate !== null) {
      const amount = Math.max(0, quantity) * rate;
      lines[key].year += amount;
      (lines.byStation[p.id] ??= {})[key] = amount;
    } else if (quantity > 0 && !lines[key].unresolved.includes(p.name)) lines[key].unresolved.push(p.name);
  };
  const rateOf = (r: ResolvedRate) => (r.source ? r.value : null);
  for (const p of calculated) {
    const r = ratesById[p.id];
    if (!r) continue;
    const daysYear = p.workingDaysPerWeek * 52;
    const machines = p.machineCount ?? 1;
    const stopRate = r.machineHour.source || r.laborHour.source
      ? (r.machineHour.source ? r.machineHour.value * machines : 0) + (r.laborHour.source ? r.laborHour.value * p.operatorsPerShift : 0)
      : null;

    add("scrap", p, p.scrapQty * daysYear, rateOf(r.scrapUnit));
    add("rework", p, p.reworkQty * daysYear, rateOf(r.reworkUnit));
    add("downtime", p, p.breakdownMinutesPerShift * p.shiftsPerDay * daysYear / 60, stopRate);
    add("setup", p, (p.setupTimeMinutes + p.machineAdjustmentMinutes) * p.setupFrequencyPerWeek * 52 / 60, stopRate);
    add("laborLoss", p, p.excessLaborHeadcount * p.workingHoursPerShift * daysYear, rateOf(r.laborHour));
    add("inventory", p, p.interProcessInventory, rateOf(r.wipHolding));
  }
  return lines;
}
