// CI project shapes that live inside a KaizenCard (tasks, 17-line financial breakdown). Moved out of
// KaizenManager (plan step C1).

// One action of the project's implementation plan (A3 steps 5–6).
export interface CITask {
  id: string;
  name: string;
  responsible: string;        // display name
  responsibleId?: string;     // user account (C2+); older actions have only the name
  startDate?: string;         // YYYY-MM-DD (C3+)
  deadline: string;           // YYYY-MM-DD
  priority: "High" | "Medium" | "Low";
  progressPercent: number;    // 0–100
  status?: "Açık" | "Devam Ediyor" | "Yapıldı" | "İptal";
  beforeAfterIds?: string[];  // before-after studies this action produced (C3+)
}

export interface CIFinancialsInput {
  scrapReduction: { pct: number; val: number };
  reworkReduction: { pct: number; val: number };
  wasteReduction: { pct: number; val: number };
  setupTimeReduction: { pct: number; val: number };
  leadTimeReduction: { pct: number; val: number };
  wipReduction: { pct: number; val: number };
  operatorEfficiency: { pct: number; val: number };
  oeeIncrease: { pct: number; val: number };
  energySavings: { pct: number; val: number };
  qualityImprovement: { pct: number; val: number };
  productionIncrease: { pct: number; val: number };
  deliveryPerformance: { pct: number; val: number };
  ohsGain: { pct: number; val: number };
  spaceSavings: { pct: number; val: number };
  inventoryReduction: { pct: number; val: number };
  maintenanceSavings: { pct: number; val: number };
  otherSavings: { pct: number; val: number };
}

export const defaultFinancialsInput = (): CIFinancialsInput => ({
  scrapReduction: { pct: 0, val: 0 },
  reworkReduction: { pct: 0, val: 0 },
  wasteReduction: { pct: 0, val: 0 },
  setupTimeReduction: { pct: 0, val: 0 },
  leadTimeReduction: { pct: 0, val: 0 },
  wipReduction: { pct: 0, val: 0 },
  operatorEfficiency: { pct: 0, val: 0 },
  oeeIncrease: { pct: 0, val: 0 },
  energySavings: { pct: 0, val: 0 },
  qualityImprovement: { pct: 0, val: 0 },
  productionIncrease: { pct: 0, val: 0 },
  deliveryPerformance: { pct: 0, val: 0 },
  ohsGain: { pct: 0, val: 0 },
  spaceSavings: { pct: 0, val: 0 },
  inventoryReduction: { pct: 0, val: 0 },
  maintenanceSavings: { pct: 0, val: 0 },
  otherSavings: { pct: 0, val: 0 }
});
