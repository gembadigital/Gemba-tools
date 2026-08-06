// Generates a real "Proje Takip Raporu" .xlsx by cloning the firm's actual reporting template
// (with its native PivotTables and 8 charts intact) and swapping in live PTR data — rather than
// building a from-scratch worksheet that can only ever approximate the real dashboard. The
// template's pivot caches are already configured with refreshOnLoad="1", so once the "RaporTablo"
// table's rows are replaced, Excel refreshes the pivots (and the charts that read them) itself
// when the file is opened — no native pivot/chart XML needs to be hand-built here.
import JSZip from "jszip";
import fs from "fs";
import path from "path";

const TEMPLATE_PATH =
  process.env.PTR_EXCEL_TEMPLATE_PATH ||
  path.join(process.cwd(), "assets", "ptr-template.xlsx");

export interface PtrTemplateRecord {
  visitedWeek: string;
  workDate: string; // DD.MM.YYYY
  activitySubject: string;
  improvementSubject: string;
  workDone: string;
  output: string;
  responsible: string;
  status: string;
  dueDate: string; // DD.MM.YYYY
  actualDate: string; // DD.MM.YYYY
  compliance: string;
  notes: string;
  savingsAmount: string;
  savingsCurrency: string;
  kaizenSavings: string;
  equivalentProduct: string;
  year: number;
}

export function isPtrTemplateAvailable(): boolean {
  return fs.existsSync(TEMPLATE_PATH);
}

// Matches the firm's own file-naming convention (e.g. "Müşteri ismi-202607-27.xlsx" —
// customer name, then year+month run together, then day) for both direct downloads and emailed
// report attachments, so a file lands with the same name however it reaches the consultant.
export function buildPtrExportFilename(customerName: string, date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${customerName}-${yyyy}${mm}-${dd}.xlsx`;
}

function parseTurkishDateToExcelSerial(dateStr: string): number | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(".");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  const utcMs = Date.UTC(year, month - 1, day);
  const excelEpochMs = Date.UTC(1899, 11, 30); // Excel's (buggy) day-0 epoch
  return Math.round((utcMs - excelEpochMs) / 86400000);
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function inlineStrCell(ref: string, style: number, value: string): string {
  if (!value) return "";
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(ref: string, style: number, value: number): string {
  if (isNaN(value)) return "";
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function dateCell(ref: string, style: number, serial: number | null): string {
  return serial === null ? `<c r="${ref}" s="${style}"/>` : `<c r="${ref}" s="${style}"><v>${serial}</v></c>`;
}

// Replaces the header/summary block's dxf-numbered cell content is left entirely untouched — only
// the RaporTablo data rows (spreadsheet rows 9..N) are regenerated.
export async function generatePtrTemplateExcel(records: PtrTemplateRecord[], customerName: string): Promise<Buffer> {
  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuffer);

  const rowsXml = records
    .map((r, idx) => {
      const rowNum = 9 + idx;
      const siraNo = idx + 1;
      const styleA = idx === 0 ? 85 : idx === records.length - 1 ? 87 : 86;
      const weekNum = parseInt(r.visitedWeek, 10);
      const workDateSerial = parseTurkishDateToExcelSerial(r.workDate);
      const dueDateSerial = parseTurkishDateToExcelSerial(r.dueDate);
      const actualDateSerial = parseTurkishDateToExcelSerial(r.actualDate);
      const savingsVal = parseFloat((r.savingsAmount || "").replace(/[^0-9.-]+/g, ""));
      const kaizenVal = parseFloat((r.kaizenSavings || "").replace(/[^0-9.-]+/g, ""));
      const eslestirme = `${r.year}${r.visitedWeek}${r.activitySubject}`;

      const cells = [
        numberCell(`A${rowNum}`, styleA, siraNo),
        !isNaN(weekNum) ? numberCell(`B${rowNum}`, 7, weekNum) : "",
        dateCell(`C${rowNum}`, 8, workDateSerial),
        inlineStrCell(`D${rowNum}`, 7, r.activitySubject),
        inlineStrCell(`E${rowNum}`, 7, r.improvementSubject),
        inlineStrCell(`F${rowNum}`, 7, r.workDone),
        inlineStrCell(`G${rowNum}`, 7, r.output),
        inlineStrCell(`H${rowNum}`, 7, r.responsible),
        inlineStrCell(`I${rowNum}`, 7, r.status),
        dateCell(`J${rowNum}`, 8, dueDateSerial),
        dateCell(`K${rowNum}`, 8, actualDateSerial),
        inlineStrCell(`L${rowNum}`, 7, r.compliance),
        inlineStrCell(`M${rowNum}`, 7, r.notes),
        !isNaN(savingsVal) && savingsVal !== 0 ? numberCell(`N${rowNum}`, 7, savingsVal) : "",
        inlineStrCell(`O${rowNum}`, 7, r.savingsCurrency),
        !isNaN(kaizenVal) && kaizenVal !== 0 ? numberCell(`P${rowNum}`, 7, kaizenVal) : "",
        inlineStrCell(`Q${rowNum}`, 7, r.equivalentProduct),
        numberCell(`R${rowNum}`, 7, r.year),
        numberCell(`S${rowNum}`, 7, siraNo),
        inlineStrCell(`T${rowNum}`, 7, eslestirme)
      ].join("");

      return `<row r="${rowNum}" spans="1:20" x14ac:dyDescent="0.2">${cells}</row>`;
    })
    .join("");

  const lastRow = 8 + records.length;

  // 1. Proje Raporu (sheet1): swap the RaporTablo data rows
  const sheet1Path = "xl/worksheets/sheet1.xml";
  let sheet1 = await zip.file(sheet1Path)!.async("string");
  const dataStart = sheet1.indexOf('<row r="9"');
  const sheetDataEnd = sheet1.indexOf("</sheetData>");
  sheet1 = sheet1.slice(0, dataStart) + rowsXml + sheet1.slice(sheetDataEnd);
  sheet1 = sheet1.replace(/<dimension ref="A1:T\d+"\/>/, `<dimension ref="A1:T${lastRow}"/>`);
  zip.file(sheet1Path, sheet1);

  // 2. RaporTablo table + autoFilter range must match the new row count
  const table1Path = "xl/tables/table1.xml";
  let table1 = await zip.file(table1Path)!.async("string");
  table1 = table1.replace(/ref="B8:T\d+"/g, `ref="B8:T${lastRow}"`);
  zip.file(table1Path, table1);

  // 3. Bilgiler!A2 — real customer name (A1 on Proje Raporu is a formula pulling this cell)
  const sheet4Path = "xl/worksheets/sheet4.xml";
  let sheet4 = await zip.file(sheet4Path)!.async("string");
  sheet4 = sheet4.replace(/<c r="A2"[^>]*>.*?<\/c>/, `<c r="A2" t="inlineStr"><is><t xml:space="preserve">${escapeXml(customerName)}</t></is></c>`);
  zip.file(sheet4Path, sheet4);

  // 4. Force full recalculation on open (VLOOKUP/pivot summary formulas in Proje Raporu rows 1-7)
  const workbookPath = "xl/workbook.xml";
  let workbook = await zip.file(workbookPath)!.async("string");
  workbook = workbook.replace(/<calcPr calcId="(\d+)"\/>/, '<calcPr calcId="$1" fullCalcOnLoad="1"/>');
  // "Pivot" and "Bilgiler" are internal/technical sheets (raw pivot workings, the customer-name
  // lookup cell) — not meant for the customer to see. Hidden, not removed: DashBoard's pivot
  // tables still read live from them, and Proje Raporu's A1 formula still reads Bilgiler!A2.
  workbook = workbook.replace(/<sheet name="Pivot"([^>]*)\/>/, '<sheet name="Pivot"$1 state="hidden"/>');
  workbook = workbook.replace(/<sheet name="Bilgiler"([^>]*)\/>/, '<sheet name="Bilgiler"$1 state="hidden"/>');
  zip.file(workbookPath, workbook);

  // 5. Strip the now-stale calcChain (Excel rebuilds it silently; leaving it risks a "repair" prompt)
  zip.remove("xl/calcChain.xml");
  const relsPath = "xl/_rels/workbook.xml.rels";
  let rels = await zip.file(relsPath)!.async("string");
  rels = rels.replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/, "");
  zip.file(relsPath, rels);
  const contentTypesPath = "[Content_Types].xml";
  let contentTypes = await zip.file(contentTypesPath)!.async("string");
  contentTypes = contentTypes.replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/, "");
  zip.file(contentTypesPath, contentTypes);

  return zip.generateAsync({ type: "nodebuffer" });
}
