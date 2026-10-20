// Master Plan Excel import — tolerant reader for plan sheets that are NOT in the app's own export
// format. The old importer matched ~40 exact header spellings on row 1 of the first sheet only, so
// a real-world plan ("Faaliyet Konusu", "Başlangıç Tarihi", a cover sheet first, …) matched
// nothing and the UI then reported "0 faaliyet aktarıldı" as if it had succeeded. This version:
//   • looks at every sheet and keeps the one that yields the most activities,
//   • finds the header row anywhere in the first 30 rows,
//   • recognises columns by meaning (accent/case/punctuation-insensitive keywords), not exact text,
//   • turns start/finish DATES into week numbers (the Gantt works in weeks),
//   • and always reports what it saw, so a failure can be explained instead of staying silent.
// Pure functions over plain 2-D arrays (no XLSX import) so they can be tested without a browser.

export type CellGrid = any[][];

export interface ImportedActivity {
  name: string;
  category: string;
  phase: string;
  consultant: string;
  priority: string;
  progressPercent: number;
  status: string;
  notes: string;
  plannedManDays: number;
  plannedStartWeek: number;
  plannedFinishWeek: number;
  actualStartWeek: number;
  actualFinishWeek: number;
}

export interface ImportReport {
  sheetName: string;
  headerRow: number; // 1-based, 0 when no header row was found
  detectedColumns: { header: string; role: string }[];
  unrecognizedHeaders: string[];
  skippedRows: number;
  weeksFromDates: boolean;
  defaultedWeeks: boolean; // no usable week/date columns → default 24–28 window was applied
  headerGuessed: boolean; // no activity header recognised; the text-heaviest column was assumed to be the name
  sheetsTried: string[];
}

export interface ImportResult {
  activities: ImportedActivity[];
  report: ImportReport;
}

const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
export const normalizeHeader = (v: unknown): string =>
  String(v ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, c => TR[c] || c)
    .replace(/[^a-z0-9]/g, "");

type Role =
  | "name" | "category" | "phase" | "consultant" | "priority" | "progress" | "status" | "manDays"
  | "plannedStart" | "plannedFinish" | "actualStart" | "actualFinish" | "notes" | "type" | "no";

const has = (h: string, words: string[]) => words.some(w => h.includes(w));

// Role of one header cell (normalised), or null. Order matters: the most specific rules first.
function roleOf(h: string): Role | null {
  if (!h) return null;
  if (h === "tur" || h === "type") return "type"; // "PLANLANAN"/"GERÇEKLEŞEN" marker of the app's own export
  const actual = has(h, ["gerceklesen", "actual", "fiili", "fiil"]);
  const start = has(h, ["baslangic", "baslama", "start", "begin"]);
  const finish = has(h, ["bitis", "bitim", "finish", "end", "teslim", "termin"]);
  if (start && !finish) return actual ? "actualStart" : "plannedStart";
  if (finish && !start) return actual ? "actualFinish" : "plannedFinish";
  if (has(h, ["adamgun", "manday", "mangun", "efor", "adamsaat", "suregun", "gunsayisi", "adetgun"])) return "manDays";
  if (has(h, ["ilerleme", "tamamlanma", "progress", "yuzde", "gerceklesmeorani"])) return "progress";
  if (has(h, ["oncelik", "priority"])) return "priority";
  if (has(h, ["faz", "phase"]) && !has(h, ["faaliyet", "aktivite"])) return "phase";
  if (has(h, ["durum", "status"])) return "status";
  if (has(h, ["danisman", "consultant", "sorumlu", "gorevli", "owner", "atanan"])) return "consultant";
  if (has(h, ["kategori", "category", "sinif", "yalinmodul", "modul"])) return "category";
  if (has(h, ["not", "aciklama", "yorum", "remark", "note"]) && !has(h, ["faaliyet", "aktivite"])) return "notes";
  if (h === "no" || h === "sira" || h === "sirano" || h === "faaliyetno" || h === "aktiviteno" || h === "id" || h === "s") return "no";
  if (has(h, ["faaliyetadi", "aktiviteadi", "gorevadi", "isadi", "projeadi", "yalinfaaliyet", "faaliyetkonusu", "faaliyetaciklamasi"])) return "name";
  if (has(h, ["faaliyet", "aktivite", "gorev", "konu", "ispaketi", "isacilimi", "name", "activity", "task"])) return "name";
  return null;
}

// ---- value parsing ----

const isDate = (v: unknown): v is Date => v instanceof Date && !Number.isNaN(v.getTime());

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Excel serial day → local Date (1900 date system; serial 25569 = 1970-01-01).
const fromSerial = (n: number): Date => {
  const ms = Math.floor(n - 25569) * 86400000; // whole days only: a time-of-day part must not roll the date
  const u = new Date(ms);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
};

function parseDateString(s: string): Date | null {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// A week number from a plain week ("24", "W24", "H24", "24. hafta"), a Date, an Excel serial or a date string.
export function toWeek(v: unknown): { week: number; fromDate: boolean } | null {
  if (v === undefined || v === null || v === "") return null;
  if (isDate(v)) return { week: isoWeek(v), fromDate: true };
  if (typeof v === "number") {
    if (v >= 1 && v <= 53 && Number.isInteger(v)) return { week: v, fromDate: false };
    if (v > 20000 && v < 80000) return { week: isoWeek(fromSerial(v)), fromDate: true };
    return null;
  }
  const s = String(v).trim();
  const d = parseDateString(s);
  if (d) return { week: isoWeek(d), fromDate: true };
  const m = s.match(/^(?:w|h|hafta|week)?\s*\.?\s*(\d{1,2})\b/i);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 53) return { week: Number(m[1]), fromDate: false };
  return null;
}

const text = (v: unknown): string => (isDate(v) ? "" : String(v ?? "").replace(/\s+/g, " ").trim());

function toPercent(v: unknown): number {
  if (typeof v === "number") return Math.max(0, Math.min(100, Math.round(v <= 1 ? v * 100 : v)));
  const n = parseInt(String(v ?? "").replace("%", ""), 10);
  return Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

const STATUS_MAP: [RegExp, string][] = [
  [/^(completed|tamam|bitti|yapildi|kapali|tamamlandi)/, "Completed"],
  [/^(in ?progress|devam|surec|yurut)/, "In Progress"],
  [/^(delayed|gecik|ertel)/, "Delayed"],
  [/^(planned|plan|acik|baslamadi|bekl)/, "Planned"],
];
function toStatus(v: unknown, progress: number): string {
  const n = normalizeHeader(v);
  for (const [re, out] of STATUS_MAP) if (n && re.test(n)) return out;
  return progress === 100 ? "Completed" : progress > 0 ? "In Progress" : "Planned";
}
function toPriority(v: unknown): string {
  const n = normalizeHeader(v);
  if (/^(high|yuksek|1|acil)/.test(n)) return "High";
  if (/^(low|dusuk|3)/.test(n)) return "Low";
  return "Medium";
}

// ---- sheet parsing ----

interface Mapped { col: number; header: string; role: Role }

function findHeaderRow(grid: CellGrid): { rowIdx: number; mapped: Mapped[]; unrecognized: string[] } | null {
  const limit = Math.min(grid.length, 30);
  let best: { rowIdx: number; mapped: Mapped[]; unrecognized: string[]; score: number } | null = null;
  for (let r = 0; r < limit; r++) {
    const row = grid[r] || [];
    const mapped: Mapped[] = [];
    const used = new Set<Role>();
    const unrecognized: string[] = [];
    row.forEach((cell, col) => {
      const raw = text(cell);
      if (!raw || raw.length > 60) return;
      const role = roleOf(normalizeHeader(raw));
      if (role && !used.has(role)) { mapped.push({ col, header: raw, role }); used.add(role); }
      else if (!role) unrecognized.push(raw);
    });
    if (!used.has("name")) continue;
    const score = used.size;
    if (!best || score > best.score) best = { rowIdx: r, mapped, unrecognized, score };
  }
  return best;
}

function parseSheet(sheetName: string, grid: CellGrid): ImportResult {
  const report: ImportReport = {
    sheetName, headerRow: 0, detectedColumns: [], unrecognizedHeaders: [], skippedRows: 0,
    weeksFromDates: false, defaultedWeeks: true, headerGuessed: false, sheetsTried: [],
  };
  let header = findHeaderRow(grid);

  // Fallback: no recognisable "activity" header — use the first row with ≥ 2 text cells as the
  // header and take the text-heaviest column as the activity name.
  if (!header) {
    const rowIdx = grid.findIndex((r, i) => (r || []).some(c => text(c)) && grid.slice(i + 1).some(rr => (rr || []).some(c => typeof c === "string" && text(c))));
    if (rowIdx >= 0) {
      const row = grid[rowIdx];
      const mapped: Mapped[] = [];
      const used = new Set<Role>();
      row.forEach((cell, col) => {
        const raw = text(cell);
        const role = raw ? roleOf(normalizeHeader(raw)) : null;
        if (role && !used.has(role)) { mapped.push({ col, header: raw, role }); used.add(role); }
      });
      const textScore = (col: number) => grid.slice(rowIdx + 1).reduce((s, r) => s + (typeof (r || [])[col] === "string" ? String(r[col]).trim().length : 0), 0);
      const candidates = row.map((_, col) => col).filter(col => !used.has("no") || mapped.find(m => m.col === col)?.role !== "no");
      const nameCol = candidates.filter(c => !mapped.some(m => m.col === c)).sort((a, b) => textScore(b) - textScore(a))[0];
      if (nameCol !== undefined && textScore(nameCol) > 0) {
        mapped.push({ col: nameCol, header: text(row[nameCol]) || `Sütun ${nameCol + 1}`, role: "name" });
        header = { rowIdx, mapped, unrecognized: [] };
        report.headerGuessed = true;
      }
    }
  }
  if (!header) return { activities: [], report };

  const colOf = (role: Role) => header!.mapped.find(m => m.role === role)?.col;
  report.headerRow = header.rowIdx + 1;
  report.detectedColumns = header.mapped.map(m => ({ header: m.header, role: m.role }));
  report.unrecognizedHeaders = header.unrecognized.slice(0, 12);

  const nameCol = colOf("name")!;
  const out: ImportedActivity[] = [];
  let fromDates = false;
  let usedWeeks = false;

  for (let r = header.rowIdx + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    if (row.every(c => text(c) === "")) continue; // blank spacer row
    const typeCol = colOf("type");
    if (typeCol !== undefined && /gerceklesen|actual/.test(normalizeHeader(row[typeCol]))) continue; // app export's second row per activity
    const name = text(row[nameCol]);
    if (!name || normalizeHeader(name) === normalizeHeader(header.mapped.find(m => m.role === "name")!.header)) { report.skippedRows++; continue; }

    const get = (role: Role) => { const c = colOf(role); return c === undefined ? undefined : row[c]; };
    const week = (role: Role): number | null => {
      const w = toWeek(get(role));
      if (!w) return null;
      if (w.fromDate) fromDates = true;
      usedWeeks = true;
      return w.week;
    };
    let ps = week("plannedStart");
    let pf = week("plannedFinish");
    const as = week("actualStart");
    const af = week("actualFinish");
    if (ps !== null && pf !== null && pf < ps) pf = ps; // same-week or year-wrapped finish → single week, never inverted
    if (ps === null && pf !== null) ps = pf;
    if (pf === null && ps !== null) pf = ps;
    const progress = toPercent(get("progress"));
    const rawMd = get("manDays");
    const md = rawMd === undefined || rawMd === "" ? 5 : Number(String(rawMd).replace(",", "."));
    const startW = ps ?? 24;
    const finishW = pf ?? (ps !== null ? ps : 28);

    out.push({
      name,
      category: text(get("category")) || "Kaizen",
      phase: text(get("phase")),
      consultant: text(get("consultant")) || "Ahmet Yılmaz",
      priority: toPriority(get("priority")),
      progressPercent: progress,
      status: toStatus(get("status"), progress),
      notes: text(get("notes")),
      plannedManDays: Number.isFinite(md) ? md : 5,
      plannedStartWeek: startW,
      plannedFinishWeek: Math.max(startW, finishW),
      actualStartWeek: as ?? startW,
      actualFinishWeek: Math.max(as ?? startW, af ?? Math.max(startW, finishW)),
    });
  }
  report.weeksFromDates = fromDates;
  report.defaultedWeeks = !usedWeeks;
  return { activities: out, report };
}

// Tries every sheet, returns the one that produced the most activities (ties → earlier sheet).
export function parseMasterPlanWorkbook(sheets: { name: string; grid: CellGrid }[]): ImportResult {
  // A sheet whose header was actually recognised always beats one where the name column was only
  // guessed (e.g. a cover sheet), however many rows the guess happened to produce.
  const parsed = sheets.map(sh => parseSheet(sh.name, sh.grid));
  // If any sheet has a properly recognised header (even an empty template), guessed sheets such as
  // a cover page are ignored altogether instead of being imported as junk rows.
  const anyRecognized = parsed.some(r => r.report.headerRow > 0 && !r.report.headerGuessed);
  const pool = anyRecognized ? parsed.filter(r => !r.report.headerGuessed) : parsed;
  let best: ImportResult | null = null;
  const rank = (r: ImportResult) => (r.activities.length === 0 ? 0 : r.report.headerGuessed ? 1 : 2);
  for (const res of pool) {
    if (!best || rank(res) > rank(best) || (rank(res) === rank(best) && res.activities.length > best.activities.length)) best = res;
  }
  const result = best || { activities: [], report: { sheetName: "", headerRow: 0, detectedColumns: [], unrecognizedHeaders: [], skippedRows: 0, weeksFromDates: false, defaultedWeeks: true, headerGuessed: false, sheetsTried: [] } };
  result.report.sheetsTried = sheets.map(s => s.name);
  return result;
}

// Human-readable explanation for the alert shown when nothing could be imported.
export function explainEmptyImport(report: ImportReport): string {
  const seen = report.detectedColumns.length
    ? `Okunan sütunlar: ${report.detectedColumns.map(c => c.header).join(", ")}.`
    : report.unrecognizedHeaders.length
      ? `Dosyadaki başlıklar: ${report.unrecognizedHeaders.join(", ")}.`
      : "Dosyada okunabilir bir başlık satırı bulunamadı.";
  return `Excel dosyasından hiç faaliyet aktarılamadı.\n\n${seen}\nTaranan sayfalar: ${report.sheetsTried.join(", ") || "—"}.\n\nDosyada en az bir "Faaliyet Adı" (veya Faaliyet / Aktivite / Görev / Konu) sütunu ve altında dolu satırlar olmalı. Tarih yerine hafta ya da tarih sütunları (Başlangıç / Bitiş) kullanabilirsiniz. Emin değilseniz sistemin "Excel Gantt İndir" çıktısını şablon olarak kullanın.`;
}
