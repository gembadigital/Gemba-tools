import express from "express";
import { loadExecutiveReport } from "./load.js";
import { renderReportHtml } from "./render.js";
import { renderReportPdf } from "./pdf.js";

// GET /api/opex-report/:id?format=pdf|html — executive report rendered and measured in headless
// Chromium. format=html returns the same (layout-checked) pages with an auto print dialog, for
// "Yazdır". Mounted only by the dedicated Vercel function api/opex-report.ts (and the local dev
// server) so the Chromium dependency never ends up in the main API function.
export function executiveReportRouter(authenticate: express.RequestHandler): express.Router {
  const router = express.Router();
  router.get("/api/opex-report/:id", authenticate, async (req, res) => {
    const loaded = await loadExecutiveReport((req as any).user, req.params.id);
    if (loaded.ok === false) {
      res.status(loaded.status).json({ success: false, error: loaded.error });
      return;
    }
    const asHtml = req.query.format === "html";
    try {
      const out = await renderReportPdf(o => renderReportHtml(loaded.model, { ...o, autoPrint: asHtml }), { pdf: !asHtml });
      const warnings = [...loaded.model.warnings, ...out.layoutIssues];
      res.setHeader("X-Report-Warnings", encodeURIComponent(JSON.stringify(warnings)));
      res.setHeader("X-Report-Pages", String(out.pageCount));
      if (asHtml) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(out.html);
        return;
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(loaded.fileBase)}.pdf"`);
      res.send(out.pdf);
    } catch (e: any) {
      console.error("Executive report rendering failed", e?.message || e);
      res.status(500).json({ success: false, error: "PDF oluşturulamadı: " + (e?.message || "bilinmeyen hata") });
    }
  });
  return router;
}
