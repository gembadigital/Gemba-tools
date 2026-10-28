// Parça başı kazanç (2026-10-28). When the saving recurs per produced piece ("Kazanç Süresi" =
// Parça Başı), the submitter enters the saving per piece, the annual production volume and how many
// years the product will still be produced; the system derives the saving. `estimatedSaving` then
// holds the ANNUAL saving (comparable with "Senelik" suggestions, and what reports, the Kurul
// threshold and tier suggestions use); the lifetime total is stored alongside for information.
// Shared by the client and the server (server imports "../utils/kaizenSaving.js").

// The option list is customer-editable, so match the meaning rather than the exact label.
export const isPerPiece = (period?: string) => (period || "").toLocaleLowerCase("tr").includes("parça");

export interface PerPieceInput { unitSaving: number; annualVolume: number; productionYears: number }

const round2 = (n: number) => Math.round(n * 100) / 100;

export function perPieceSaving(i: PerPieceInput): { annual: number; lifetime: number } {
  const raw = (Number(i.unitSaving) || 0) * (Number(i.annualVolume) || 0);
  return { annual: round2(raw), lifetime: round2(raw * (Number(i.productionYears) || 0)) };
}

// Server-side validation: returns the clean numbers or a Turkish error message.
export function parsePerPiece(body: any): { value?: PerPieceInput; error?: string } {
  const unitSaving = Number(body?.unitSaving);
  const annualVolume = Number(body?.annualVolume);
  const productionYears = Number(body?.productionYears);
  if (!Number.isFinite(unitSaving) || unitSaving <= 0) return { error: "Parça başı kazancı giriniz." };
  if (!Number.isFinite(annualVolume) || annualVolume <= 0 || annualVolume > 1e9) return { error: "Yıllık üretim hacmini (adet) giriniz." };
  if (!Number.isFinite(productionYears) || productionYears <= 0 || productionYears > 50) return { error: "Üretim süresini (yıl, en fazla 50) giriniz." };
  return { value: { unitSaving: round2(unitSaving), annualVolume: Math.round(annualVolume), productionYears: round2(productionYears) } };
}

// One-line breakdown for detail screens and the one-pager; "" when not a per-piece suggestion.
export function perPieceText(s: { paybackPeriod?: string; unitSaving?: number; annualVolume?: number; productionYears?: number; estimatedLifetimeSaving?: number; estimatedSavingCurrency?: string }): string {
  if (!isPerPiece(s.paybackPeriod) || !s.unitSaving || !s.annualVolume) return "";
  const n = (v: number) => v.toLocaleString("tr-TR");
  const cur = s.estimatedSavingCurrency || "";
  const years = s.productionYears || 0;
  const total = s.estimatedLifetimeSaving || perPieceSaving({ unitSaving: s.unitSaving, annualVolume: s.annualVolume, productionYears: years }).lifetime;
  return `${n(s.unitSaving)} ${cur}/parça × ${n(s.annualVolume)} adet/yıl${years ? ` × ${n(years)} yıl = ${n(total)} ${cur} toplam` : ""}`;
}
