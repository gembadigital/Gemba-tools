// HTML → PDF with headless Chromium (A4 landscape, zero margins — same as the reference report).
// On Vercel the Chromium binary comes from @sparticuz/chromium; locally it uses an installed
// Chrome (CHROME_PATH, or the default macOS/Linux locations).

import fs from "fs";
import type { LayoutOptions } from "./render.js";

export interface PdfResult {
  pdf: Buffer;
  pageCount: number;
  // Pages whose content overflows the A4 frame or lost their footer (should be empty).
  layoutIssues: string[];
  html: string;
}

async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean) as string[];
  const executablePath = candidates.find(p => fs.existsSync(p));
  if (!executablePath) throw new Error("Chrome bulunamadı (CHROME_PATH ortam değişkenini ayarlayın).");
  return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
}

// Every .page must keep its content inside the A4 box; body pages must still show their footer.
const LAYOUT_CHECK = `(() => {
  const issues = [];
  const overflow = [];
  document.querySelectorAll("section.page").forEach((p, i) => {
    const n = i + 1;
    if (p.scrollHeight > p.clientHeight + 2 || p.scrollWidth > p.clientWidth + 2) {
      issues.push("Sayfa " + n + ": içerik taşıyor");
      overflow.push({ kind: p.dataset.kind || "", key: p.dataset.key || "" });
    }
    const isCover = p.classList.contains("cover") || p.classList.contains("back");
    const f = p.querySelector("footer.pf");
    if (!isCover) {
      if (!f) { issues.push("Sayfa " + n + ": altbilgi yok"); return; }
      const pr = p.getBoundingClientRect(), fr = f.getBoundingClientRect();
      if (fr.bottom > pr.bottom + 1 || fr.height < 4) issues.push("Sayfa " + n + ": altbilgi görünmüyor");
      // Nothing may reach into the footer band, and boxes must not overflow their own frame.
      const flag = (why) => { issues.push("Sayfa " + n + ": " + why); overflow.push({ kind: p.dataset.kind || "", key: p.dataset.key || "" }); };
      let hit = false;
      p.querySelectorAll(".card, .bp, .wave, .step, .tgt-note, table, h2").forEach(el => {
        if (hit || f.contains(el)) return;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom > fr.top + 1) { hit = true; flag("içerik altbilgiye biniyor"); }
        else if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflow !== "visible") { hit = true; flag("kutu içi taşma"); }
        else if (el.classList.contains("step") && el.scrollHeight > el.clientHeight + 2) { hit = true; flag("basamak metni taşıyor"); }
      });
    }
  });
  return { issues, overflow, pages: document.querySelectorAll("section.page").length };
})()`;

type Check = { issues: string[]; overflow: { kind: string; key: string }[]; pages: number };

// Renders the report, measures every page in Chromium and — while any page overflows — tightens
// the layout for exactly those pages (split an area over more pages, fewer best-practice cards
// per page, shorter summary-table findings), up to a few passes. The final layout is also what
// the browser print view uses, so PDF and print match.
export async function renderReportPdf(build: (o: LayoutOptions) => string, opt: { pdf?: boolean } = {}): Promise<PdfResult> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1123, height: 794 });
    const opts: LayoutOptions = { areaBudget: {} };
    let html = "";
    let check: Check = { issues: [], overflow: [], pages: 0 };
    for (let pass = 0; pass < 6; pass++) {
      html = build(opts);
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 }).catch(async () => {
        await page.setContent(html, { waitUntil: "load", timeout: 20000 });
      });
      await page.evaluate("document.fonts && document.fonts.ready");
      await page.emulateMediaType("print");
      check = (await page.evaluate(LAYOUT_CHECK)) as Check;
      if (check.overflow.length === 0) break;
      let changed = false;
      for (const o of check.overflow) {
        if (o.kind === "area" && o.key) {
          const cur = opts.areaBudget![o.key] ?? 1;
          if (cur > 0.3) { opts.areaBudget![o.key] = cur * 0.85; changed = true; }
        } else if (o.kind === "bp") {
          const cur = opts.bpPerPage ?? 4;
          if (cur > 1) { opts.bpPerPage = Math.max(1, Math.floor(cur / 2)); changed = true; }
        } else if (o.kind === "exec") {
          const cur = opts.strongCount ?? 3;
          if (cur > 1) { opts.strongCount = cur - 1; changed = true; }
        } else if (o.kind === "summary") {
          const cur = opts.summaryLimit ?? 100;
          if (cur > 40) { opts.summaryLimit = cur - 20; changed = true; }
        }
      }
      if (!changed) break;
    }
    if (opt.pdf === false) return { pdf: Buffer.alloc(0), pageCount: check.pages, layoutIssues: check.issues, html };
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    });
    return { pdf: Buffer.from(pdf), pageCount: check.pages, layoutIssues: check.issues, html };
  } finally {
    await browser.close();
  }
}

export async function renderPdf(html: string): Promise<PdfResult> {
  return renderReportPdf(() => html);
}
