import { db } from "../db.js";
import { buildReportModel, ReportModel } from "./model.js";
import { generateQuickWins } from "./quickWins.js";

// Loads one assessment as a report model, enforcing who may download the executive report:
//  - Admin: any time (also drafts, as a preview);
//  - Consultant: once the audit is completed, if they are on the customer card's consultant
//    team (primary / secondary) or were assigned categories in this audit;
//  - Customer User: never.
// Deliberately free of any Chromium import so the main API function can use it too.

export type ReportLoad =
  | { ok: true; model: ReportModel; fileBase: string }
  | { ok: false; status: number; error: string };

export async function loadExecutiveReport(user: any, assessmentId: string, opts: { refreshQuickWins?: boolean; skipQuickWins?: boolean; allowDraft?: boolean } = {}): Promise<ReportLoad> {
  const orgId = user.organization_id;
  const assessment = await db.getOpexAssessmentById(orgId, assessmentId);
  if (!assessment) return { ok: false, status: 404, error: "Denetim bulunamadı." };

  const customer = (await db.getCustomers(orgId)).find((c: any) => c.id === assessment.customerId);
  if (user.role !== "Admin") {
    const team = [customer?.primaryConsultantId, ...(customer?.consultantIds || [])].filter(Boolean);
    const assessors = Object.values(assessment.assessorAssignments || {});
    const isTeam = user.role === "Consultant" && (team.includes(user.id) || assessors.includes(user.id));
    if (!isTeam) {
      return { ok: false, status: 403, error: "Yönetici raporunu yalnızca Admin ile müşteri kartındaki danışmanlar ve bu denetimin denetçileri indirebilir." };
    }
    if (assessment.status !== "completed" && !opts.allowDraft) {
      return { ok: false, status: 403, error: "Yönetici raporu denetim tamamlanıp kilitlendikten sonra indirilebilir." };
    }
  }

  const [categories, questions, all] = await Promise.all([
    db.getOpexCategories(orgId),
    db.getOpexQuestions(orgId),
    db.getOpexAssessments(orgId),
  ]);

  // Report no = YYAA + firm-wide sequence (same numbering as the Excel export's file name).
  const reportDate = assessment.completed_at || new Date().toISOString();
  const ordered = [...all].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const seq = ordered.findIndex((a: any) => a.id === assessment.id) + 1 || all.length;
  const d = new Date(reportDate);
  const reportNo = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(seq).padStart(2, "0")}`;

  const customerName = customer?.companyName || "Müşteri";
  const model = buildReportModel({
    assessment,
    questions,
    categories: [...categories].sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))),
    customerName,
    reportNo,
    reportDate,
  });

  // "Hızlı Kazanım" page: drafted by AI from the whole audit the first time the report is built
  // (or when an Admin asks for a refresh), then stored on the assessment so every later download
  // prints the same page. A failure never blocks the report — the page is just left out and the
  // reason is added to the report warnings.
  if (!opts.skipQuickWins && (model.quickWins.length === 0 || (opts.refreshQuickWins && user.role === "Admin"))) {
    try {
      const items = await generateQuickWins(model);
      model.quickWins = items;
      // Only the new field is written (upsert merges onto the stored record), so a concurrent assessor save is not clobbered.
      await db.saveOpexAssessment(orgId, { id: assessment.id, quickWins: { items, generatedAt: new Date().toISOString(), source: "ai" } }, user.id);
    } catch (e: any) {
      model.warnings.push(`Hızlı Kazanım sayfası oluşturulamadı (${e?.message || "bilinmeyen hata"}); rapordan çıkarıldı.`);
    }
  }
  const shortName = customerName.trim().split(/\s+/)[0] || "Musteri";
  return { ok: true, model, fileBase: `${shortName}-${reportNo}-Yonetici-Raporu` };
}
