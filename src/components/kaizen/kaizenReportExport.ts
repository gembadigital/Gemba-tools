import * as XLSX from "xlsx";

// Rapor çıktıları (Faz 5.7). The report screen assembles one ReportPack from exactly what it shows
// (filters applied, team scope in the manager report), and both the Excel file and the PDF
// executive summary are rendered from that pack — so the downloads always match the screen.

export type Cell = string | number | null;

export interface ReportPack {
  title: string;              // "Kaizen raporu" / "Ekip raporu"
  company: string;
  scope: string;              // e.g. "Ayşe Yılmaz ekibi (alt kademeler dahil)" or "Tüm müşteri"
  generatedAt: string;        // ISO
  base: string;               // base currency
  filters: string[];          // human-readable active filters; empty = none
  kpis: { label: string; value: number | string; unit?: string; hint?: string }[];
  roi: { label: string; expected: Cell; actual: Cell; unit?: string }[];
  ranking: { title: string; columns: string[]; rows: Cell[][] };
  statusCounts: { label: string; count: number }[];
  top: { title: string; columns: string[]; rows: Cell[][] }; // PDF highlight: largest expected savings
  detailColumns: string[];
  detailRows: Cell[][];
}

const stamp = (iso: string) => new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });

export function reportFileName(pack: ReportPack, ext: "xlsx" | "pdf") {
  const safe = (v: string) => v.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
  return `${safe(pack.title)}${pack.company ? "_" + safe(pack.company) : ""}_${pack.generatedAt.slice(0, 10)}.${ext}`;
}

// Numbers stay numeric cells (summable in Excel); units go in their own column.
export function exportReportExcel(pack: ReportPack) {
  const wb = XLSX.utils.book_new();
  const summary: Cell[][] = [
    [pack.title], [pack.company], [pack.scope], [`Oluşturulma: ${stamp(pack.generatedAt)}`],
    [pack.filters.length ? `Filtreler: ${pack.filters.join(" · ")}` : "Filtre yok (tüm kayıtlar)"], [],
    ["Gösterge", "Değer", "Birim", "Açıklama"],
    ...pack.kpis.map(k => [k.label, k.value, k.unit || "", k.hint || ""]),
    [], ["Geri dönüş", "Beklenen", "Gerçekleşen", "Birim"],
    ...pack.roi.map(r => [r.label, r.expected, r.actual, r.unit || ""]),
    [], ["Durum", "Öneri sayısı"],
    ...pack.statusCounts.map(s => [s.label, s.count])
  ];
  const sum = XLSX.utils.aoa_to_sheet(summary);
  sum["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, sum, "Özet");

  const detail = XLSX.utils.aoa_to_sheet([pack.detailColumns, ...pack.detailRows]);
  detail["!cols"] = pack.detailColumns.map(c => ({ wch: Math.max(10, Math.min(40, c.length + 4)) }));
  detail["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: pack.detailRows.length, c: pack.detailColumns.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, detail, "Öneriler");

  const rank = XLSX.utils.aoa_to_sheet([pack.ranking.columns, ...pack.ranking.rows]);
  rank["!cols"] = pack.ranking.columns.map((c, i) => ({ wch: i === 0 ? 24 : Math.max(10, c.length + 2) }));
  XLSX.utils.book_append_sheet(wb, rank, pack.ranking.title.slice(0, 31));

  XLSX.writeFile(wb, reportFileName(pack, "xlsx"));
}
