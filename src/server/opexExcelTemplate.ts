// Generates a real "OpEx Assessment" audit report .xlsx by cloning the firm's actual reporting
// template (18 category detail sheets, 41 native radar/bar charts, auditor-summary sheets) and
// writing the assessment's data into the template's single raw-data sheet ("Veriler") — every
// other sheet in the workbook is already a VLOOKUP/table formula view onto that one sheet (see
// the "DenetimCevaplariTablosu"/"DenetlemeBilgileri"/"KategoriSonuc"/"DenetlemeSonuc"/
// "KategorsiYorum"/"Best" Excel Tables defined over it), so filling it in is enough for the whole
// report to update itself once Excel recalculates on open.
//
// Written via direct zip/XML surgery (not ExcelJS) because ExcelJS strips embedded charts on
// write — confirmed by round-tripping the template through it, which silently dropped all 41
// charts. Same technique already used by ptrExcelTemplate.ts for the same reason.
import JSZip from "jszip";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const TEMPLATE_PATH =
  process.env.OPEX_EXCEL_TEMPLATE_PATH ||
  path.join(process.cwd(), "assets", "opex-template.xlsx");

export function isOpexTemplateAvailable(): boolean {
  return fs.existsSync(TEMPLATE_PATH);
}

// "MüşteriKısaAd-YYAA-SS.xlsx" — short customer name, then the report's year+month, then a
// sequence number that counts across every OpEx assessment report in the org's own system (not
// just this customer's), so it reads like a firm-wide report code rather than a per-customer index.
export function buildOpexExportFilename(customerName: string, systemSeqNo: number, date: Date = new Date()): string {
  const shortName = customerName.trim().split(/\s+/)[0] || customerName;
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const seq = String(systemSeqNo).padStart(2, "0");
  return `${shortName}-${yy}${mm}-${seq}.xlsx`;
}

export interface OpexTemplateQuestionInput {
  id: string;
  categoryId: string;
  weight: number;
  idealState: string;
  rubric?: Record<string, string>;
}

export interface OpexTemplateAssessmentInput {
  auditNo?: number;
  auditDate?: string; // ISO "YYYY-MM-DD"
  overallScore: number; // 0-100
  categoryScores: Record<string, number>; // categoryId -> 0-100
  answers: Record<string, number>; // questionId -> 0-5 (-1 unanswered, -2 N/A)
  categoryComments?: Record<string, string>; // categoryId -> "Genel Bölüm Değerlendirmesi"
  customRubrics?: Record<string, string>; // `${questionId}_${score}` -> per-question finding text
  assessorParticipants?: string;
  customerParticipants?: string;
  targetScores?: Record<string, number>; // categoryId -> 0-100
}

// The template's own 164-question master list ("Soru Listesi" sheet) — this is the authoritative
// row order/ID scheme every other report sheet's formulas are hardcoded against (e.g. A-1's
// VLOOKUP(A3,Veriler!A:D,4,0) expects Veriler!A3 to literally contain the template's own "A1.1").
// The live app's question bank has since been renumbered/expanded (extra questions inserted mid-
// category shift IDs like "A2.1" onward), so app IDs can't be written here directly — every
// template question is resolved to its live app equivalent by matching "İdeal Durum" text instead
// (verified stable: 164/164 template questions resolve this way against the current app bank).
// Cached on first use since the template file never changes at runtime.
interface TemplateQuestion { id: string; categoryId: string; weight: number; idealState: string; }
let cachedTemplateQuestions: TemplateQuestion[] | null = null;

async function getTemplateQuestionBank(): Promise<TemplateQuestion[]> {
  if (cachedTemplateQuestions) return cachedTemplateQuestions;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const ws = wb.getWorksheet("Soru Listesi");
  if (!ws) throw new Error("OpEx şablonunda 'Soru Listesi' sayfası bulunamadı.");
  const list: TemplateQuestion[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;
    const id = row.getCell(1).value;
    if (!id) return;
    list.push({
      id: String(id),
      categoryId: String(row.getCell(2).value || ""),
      weight: Number(row.getCell(4).value) || 0,
      idealState: String(row.getCell(5).value || "")
    });
  });
  cachedTemplateQuestions = list;
  return list;
}

function normalizeText(s: string): string {
  return (s || "").trim().toUpperCase().replace(/\s+/g, " ").replace(/[.,]+$/, "");
}

// Resolves each template question to its live-app equivalent: exact "İdeal Durum" text match
// first, then exact ID match (covers the rare case where wording drifted slightly but the ID
// didn't move), then a prefix-fuzzy match as a last resort (covers the one known case where a
// question's stored text was truncated in the app's seed data).
function buildTemplateToAppMap(
  templateQuestions: TemplateQuestion[],
  appQuestions: OpexTemplateQuestionInput[]
): Map<string, OpexTemplateQuestionInput> {
  const appByIdeal = new Map<string, OpexTemplateQuestionInput>();
  const appById = new Map<string, OpexTemplateQuestionInput>();
  appQuestions.forEach(q => {
    appByIdeal.set(normalizeText(q.idealState), q);
    appById.set(q.id, q);
  });

  const map = new Map<string, OpexTemplateQuestionInput>();
  templateQuestions.forEach(tq => {
    const key = normalizeText(tq.idealState);
    let hit = appByIdeal.get(key) || appById.get(tq.id);
    if (!hit && key.length >= 25) {
      const prefix = key.slice(0, 40);
      hit = appQuestions.find(q => {
        const qKey = normalizeText(q.idealState);
        return qKey.length >= 25 && (qKey.startsWith(prefix) || key.startsWith(qKey.slice(0, 40)));
      });
    }
    if (hit) map.set(tq.id, hit);
  });
  return map;
}

function getSystemLevelText(score: number): string {
  if (score < 40) return "İSRAF YOĞUN";
  if (score < 60) return "GELİŞMEKTE OLAN";
  if (score < 80) return "SİSTEMATİK UYGULAMA";
  return "MÜKEMMELLİK (WORLD CLASS)";
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const colLetterOf = (ref: string) => ref.match(/^[A-Z]+/)![0];
function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function inlineStrCell(ref: string, value: string | undefined | null, style?: number): string {
  if (!value) return "";
  const s = style !== undefined ? ` s="${style}"` : "";
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(ref: string, value: number | undefined | null, style?: number): string {
  if (value === undefined || value === null || isNaN(value)) return "";
  const s = style !== undefined ? ` s="${style}"` : "";
  return `<c r="${ref}"${s}><v>${value}</v></c>`;
}

function excelSerialFromIsoDate(iso: string): number | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const excelEpochMs = Date.UTC(1899, 11, 30); // Excel's (buggy) day-0 epoch
  return Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - excelEpochMs) / 86400000);
}

export async function generateOpexTemplateExcel(
  assessment: OpexTemplateAssessmentInput,
  appQuestions: OpexTemplateQuestionInput[],
  customerName: string
): Promise<Buffer> {
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const templateQuestions = await getTemplateQuestionBank();
  const questionMap = buildTemplateToAppMap(templateQuestions, appQuestions);

  // Accumulate every cell to write, grouped by row, so the final <row> elements can be emitted
  // with cells in column order (some rows carry both a question row and a topic-summary row).
  const rowCells = new Map<number, string[]>();
  const addCell = (row: number, xml: string) => {
    if (!xml) return;
    const list = rowCells.get(row) || [];
    list.push(xml);
    rowCells.set(row, list);
  };

  // A:D — one row per template question ("DenetimCevaplariTablosu": ID / PUAN / SONUÇ / NOTLAR)
  templateQuestions.forEach((tq, idx) => {
    const row = idx + 2;
    addCell(row, inlineStrCell(`A${row}`, tq.id));
    const appQ = questionMap.get(tq.id);
    if (!appQ) return;
    const score = assessment.answers?.[appQ.id];
    if (score === undefined || score === null || score < 0) return; // -1 unanswered, -2 N/A
    addCell(row, numberCell(`B${row}`, score));
    addCell(row, numberCell(`C${row}`, Math.round(score * appQ.weight * 100) / 100));
    const finding = assessment.customRubrics?.[`${appQ.id}_${score}`] || appQ.rubric?.[String(score)] || "";
    addCell(row, inlineStrCell(`D${row}`, finding));
  });

  // Q:R + X:Y — one row per topic letter ("KategoriSonuc" + "KategorsiYorum"), 18 rows (A-S, no Q)
  const topicLetters = Array.from(new Set(templateQuestions.map(q => q.categoryId))).sort();
  topicLetters.forEach((letter, idx) => {
    const row = idx + 2;
    addCell(row, inlineStrCell(`Q${row}`, letter));
    const score = assessment.categoryScores?.[letter];
    if (typeof score === "number") addCell(row, numberCell(`R${row}`, Math.round(score * 100) / 100));
    addCell(row, inlineStrCell(`X${row}`, letter));
    addCell(row, inlineStrCell(`Y${row}`, assessment.categoryComments?.[letter]));
  });

  // F:O — report metadata ("DenetlemeBilgileri", single row)
  addCell(2, inlineStrCell("F2", customerName));
  const todaySerial = excelSerialFromIsoDate(new Date().toISOString().split("T")[0]);
  addCell(2, numberCell("G2", todaySerial ?? undefined, 22));
  addCell(2, numberCell("H2", assessment.auditNo || 1));
  if (assessment.auditDate) {
    const serial = excelSerialFromIsoDate(assessment.auditDate);
    if (serial !== null) addCell(2, numberCell("I2", serial, 22));
  }
  const targetVals = Object.values(assessment.targetScores || {}).filter(v => typeof v === "number");
  if (targetVals.length > 0) {
    addCell(2, numberCell("J2", Math.round(targetVals.reduce((a, b) => a + b, 0) / targetVals.length)));
  }
  addCell(2, inlineStrCell("K2", assessment.customerParticipants));
  addCell(2, inlineStrCell("L2", assessment.assessorParticipants));
  addCell(2, numberCell("M2", Math.round(assessment.overallScore * 100) / 100));

  // T:V — overall result ("DenetlemeSonuc", single row)
  addCell(2, numberCell("T2", assessment.auditNo || 1));
  addCell(2, numberCell("U2", Math.round(assessment.overallScore * 100) / 100));
  addCell(2, inlineStrCell("V2", getSystemLevelText(assessment.overallScore)));

  // AA2 — best-performing topic ("Best")
  const scoredLetters = topicLetters.filter(l => typeof assessment.categoryScores?.[l] === "number");
  if (scoredLetters.length > 0) {
    const best = scoredLetters.reduce((a, b) => (assessment.categoryScores[b] > assessment.categoryScores[a] ? b : a));
    addCell(2, inlineStrCell("AA2", best));
  }

  const rowsXml = Array.from(rowCells.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([row, cells]) => {
      const sorted = cells
        .filter(Boolean)
        .sort((a, c) => colIndex(colLetterOf(a.match(/r="([A-Z]+)\d+"/)![1])) - colIndex(colLetterOf(c.match(/r="([A-Z]+)\d+"/)![1])));
      return `<row r="${row}" spans="1:27">${sorted.join("")}</row>`;
    })
    .join("");

  // Veriler = xl/worksheets/sheet2.xml (r:id="rId2" in workbook.xml.rels). Only row 1 (headers)
  // is left untouched; rows 2+ are fully regenerated from the assessment data above.
  const sheetPath = "xl/worksheets/sheet2.xml";
  let sheetXml = await zip.file(sheetPath)!.async("string");
  const row1Match = sheetXml.match(/<row r="1"[^>]*>.*?<\/row>/s);
  const row1Xml = row1Match ? row1Match[0] : "";
  const sheetDataStart = sheetXml.indexOf("<sheetData>") + "<sheetData>".length;
  const sheetDataEnd = sheetXml.indexOf("</sheetData>");
  sheetXml = sheetXml.slice(0, sheetDataStart) + row1Xml + rowsXml + sheetXml.slice(sheetDataEnd);
  zip.file(sheetPath, sheetXml);

  // Force full recalculation on open (every visible report sheet is a formula view onto Veriler)
  const workbookPath = "xl/workbook.xml";
  let workbook = await zip.file(workbookPath)!.async("string");
  workbook = workbook.replace(/<calcPr calcId="(\d+)"(?: fullCalcOnLoad="1")?\/>/, '<calcPr calcId="$1" fullCalcOnLoad="1"/>');
  zip.file(workbookPath, workbook);

  // Strip the now-stale calcChain (Excel rebuilds it silently; leaving it risks a "repair" prompt)
  zip.remove("xl/calcChain.xml");
  const relsPath = "xl/_rels/workbook.xml.rels";
  let rels = await zip.file(relsPath)?.async("string");
  if (rels) {
    rels = rels.replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/, "");
    zip.file(relsPath, rels);
  }
  const contentTypesPath = "[Content_Types].xml";
  let contentTypes = await zip.file(contentTypesPath)!.async("string");
  contentTypes = contentTypes.replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/, "");
  zip.file(contentTypesPath, contentTypes);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
