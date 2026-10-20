// Weekly consultant digest ("Haftalık Özet" reminder e-mail) — the rules, kept in one pure module
// so the cron job and the admin diagnostics screen evaluate a customer's PTR records identically.
//
// THE RULE — once a week (Monday 05:00 UTC, Vercel Cron), for every customer that has an assigned
// consultant with a @gembapartner.com address, one e-mail per such consultant is sent if the
// customer's Proje Takip Raporu records (factory_id = the customer's id) contain any of:
//   1. 30+ gündür kapanmayan aksiyon : status Açık / Devam Ediyor AND visit date (Çalışma Tarihi)
//                                       at least 30 days ago;
//   2. Termini geçmiş madde            : status NOT Kapalı / İptal AND target date (Termin) < today;
//   3. Kritik madde                    : red-flagged AND status NOT Kapalı / İptal.
// A customer with none of the three gets no e-mail at all. Anything the reader cannot understand
// (an unparsable date, an unknown status spelling) silently drops that record out of the rules —
// which is why this module reports what it could not parse.

export const PTR_EXCLUDED_STATUSES = ["iptal"];

const TR_ASCII: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
// "Açık " / "AÇIK" / "Acik" → "acik" — status spellings drift when records are typed or imported.
export const statusKey = (s: unknown): string =>
  String(s ?? "").toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, c => TR_ASCII[c] || c).replace(/[^a-z]/g, "");

const isOpen = (s: unknown) => { const k = statusKey(s); return k === "acik" || k === "devamediyor"; };
const isClosedOrCancelled = (s: unknown) => { const k = statusKey(s); return k === "kapali" || PTR_EXCLUDED_STATUSES.includes(k); };

const validYmd = (y: number, m: number, d: number): Date | null => {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
};

// Accepts what real PTR data contains: "22.06.2026", "22/06/2026", "22-6-26", "2026-06-22",
// "22.06.2026 00:00", an Excel serial (46195 or "46195"). Returns local midnight, or null.
export function parseTrDate(v: unknown): Date | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) {
      const u = new Date(Math.floor(v - 25569) * 86400000);
      return validYmd(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate());
    }
    return null;
  }
  const s = String(v).trim();
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseTrDate(Number(s));
  let m = s.match(/^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2}|\d{4})(?:\D.*)?$/);
  if (m) return validYmd(Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})(?:\D.*)?$/);
  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

const DAY = 24 * 60 * 60 * 1000;

export interface DigestAnalysis {
  overdue: any[];       // rule 1
  missedTermin: any[];  // rule 2
  critical: any[];      // rule 3
  statusCounts: Record<string, number>;
  unparsableWorkDates: number;
  unparsableDueDates: number;
  badDateSamples: string[]; // raw values the reader could not understand (max 5)
}

export function analyzePtrRecords(records: any[], today: Date): DigestAnalysis {
  const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
  const out: DigestAnalysis = { overdue: [], missedTermin: [], critical: [], statusCounts: {}, unparsableWorkDates: 0, unparsableDueDates: 0, badDateSamples: [] };
  const noteBad = (raw: unknown) => { if (out.badDateSamples.length < 5 && !out.badDateSamples.includes(String(raw))) out.badDateSamples.push(String(raw)); };

  for (const r of records) {
    const status = String(r?.status ?? "").trim() || "(boş)";
    out.statusCounts[status] = (out.statusCounts[status] || 0) + 1;

    const workD = parseTrDate(r?.workDate);
    if (!workD && r?.workDate) { out.unparsableWorkDates++; noteBad(r.workDate); }
    if (isOpen(r?.status) && workD && Math.floor((t0.getTime() - workD.getTime()) / DAY) >= 30) out.overdue.push(r);

    const due = parseTrDate(r?.dueDate);
    if (!due && r?.dueDate) { out.unparsableDueDates++; noteBad(r.dueDate); }
    if (!isClosedOrCancelled(r?.status) && due && due.getTime() < t0.getTime()) out.missedTermin.push(r);

    if (r?.flagged && !isClosedOrCancelled(r?.status)) out.critical.push(r);
  }
  return out;
}
