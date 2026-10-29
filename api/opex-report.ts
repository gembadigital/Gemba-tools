// Dedicated Vercel function for the OpEx executive report (headless Chromium). Kept separate from
// api/index.ts so the ~60 MB Chromium package only loads here. ".js" extensions are required —
// Vercel runs this as native ESM (see api/index.ts).
import express from "express";
import { authenticateToken } from "../src/server/app.js";
import { executiveReportRouter } from "../src/server/opexReport/route.js";
import { lossReportRouter } from "../src/server/lossReport/route.js";

const app = express();
app.use(executiveReportRouter(authenticateToken));
app.use(lossReportRouter(authenticateToken));

export default app;
