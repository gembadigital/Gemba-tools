import express from "express";
import { normalizeLossReportModel } from "../../utils/lossReportModel.js";
import { renderLossReportHtml } from "./render.js";
import { renderReportPdf } from "../opexReport/pdf.js";

// POST /api/opex-report/loss-capacity?format=pdf|html — Loss Capacity executive report. The body is
// the report model the Loss screen built from its own figures (src/utils/lossReportModel.ts); it is
// normalized here, rendered to HTML and printed by the same headless-Chromium pipeline as the OpEx
// executive report. Lives under /api/opex-report so it runs in the dedicated Chromium function.
export function lossReportRouter(authenticate: express.RequestHandler): express.Router {
  const router = express.Router();
  router.post("/api/opex-report/loss-capacity", express.json({ limit: "2mb" }), authenticate, async (req, res) => {
    // Same customer isolation as the business API: a Customer User only for their own customers.
    const allowed = (req as any).allowedCustomerIds as string[] | null;
    const factoryId = String(req.headers["x-factory-id"] || "");
    if (allowed !== null && allowed !== undefined && (!factoryId || !allowed.includes(factoryId))) {
      res.status(403).json({ success: false, error: "Bu müşterinin raporuna erişiminiz yok." });
      return;
    }
    const model = normalizeLossReportModel(req.body);
    const asHtml = req.query.format === "html";
    try {
      const out = await renderReportPdf(() => renderLossReportHtml(model, { autoPrint: asHtml && req.query.autoprint !== "0" }), { pdf: !asHtml });
      res.setHeader("X-Report-Warnings", encodeURIComponent(JSON.stringify(out.layoutIssues)));
      res.setHeader("X-Report-Pages", String(out.pageCount));
      if (asHtml) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(out.html);
        return;
      }
      const short = (model.firm.trim().split(/\s+/)[0] || "Musteri").replace(/[^\p{L}\p{N}_-]/gu, "");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(`${short}-${model.reportNo || "Kayip"}-Kayip-Maliyet-Raporu`)}.pdf"`);
      res.send(out.pdf);
    } catch (e: any) {
      console.error("Loss report rendering failed", e?.message || e);
      res.status(500).json({ success: false, error: "PDF oluşturulamadı: " + (e?.message || "bilinmeyen hata") });
    }
  });
  return router;
}
