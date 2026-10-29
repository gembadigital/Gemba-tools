// VSM (Değer Akış Haritalama) — server routes. Own module so VSM can later run outside Gemba Tools
// (plan step V11): authentication and customer scoping come in through `VsmRouteDeps`, storage via `db`.
// Access rules: src/utils/vsmAccess.ts.
import type express from "express";
import { db } from "../db.js";
import { generateVsmAnalysis, VsmOtherModules } from "./vsmAnalysis.js";
import { computeAll } from "../../components/vsm/vsmCalc.js";
import { normalizeVsmProject } from "../../components/vsm/vsmNormalize.js";
import {
  canDeleteVsmProject, forbiddenBurstRemovals, forbiddenOwnedRemovals, forbiddenProcessRemovals, isVsmBlockedSession,
  normalizeVsmProjectInput, stampBurstOwners, stampOwnedItems, stampProcessOwners
} from "../../utils/vsmAccess.js";

export interface VsmRouteDeps {
  authenticateToken: express.RequestHandler;
  resolveFactoryScope: (req: express.Request, requestedId?: string) => { allowed: boolean; factoryId?: string };
  canAccessFactory: (req: express.Request, factoryId?: string) => boolean;
}

// Legacy records saved without a customer belong to the old default factory id.
const factoryOf = (record: any) => record.factory_id || "arcelik_bolu";

function deny(res: express.Response, status = 403, error = "Access Denied.") {
  res.status(status).json({ success: false, error });
}

export function registerVsmRoutes(app: express.Express, deps: VsmRouteDeps) {
  const { authenticateToken, resolveFactoryScope, canAccessFactory } = deps;

  const findProject = async (orgId: string, id: string) =>
    (await db.getVsmProjects(orgId)).find((r: any) => r.id === id) || null;

  app.get("/api/business/vsm-projects", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (isVsmBlockedSession(user)) return deny(res);
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed) return deny(res);
    res.json({ success: true, data: await db.getVsmProjects(user.organization_id, scope.factoryId) });
  });

  app.post("/api/business/vsm-projects", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (isVsmBlockedSession(user)) return deny(res);
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed) return deny(res);

    const input = normalizeVsmProjectInput(req.body);
    if (input.ok === false) return deny(res, 400, input.error);
    const project = input.project;

    const existing = project.id ? await findProject(user.organization_id, project.id) : null;
    if (project.id && !existing) return deny(res, 404, "VSM projesi bulunamadı.");

    if (existing) {
      // An existing project never changes customer, and only users of that customer may write it.
      if (!canAccessFactory(req, factoryOf(existing))) return deny(res);
      if (scope.factoryId && factoryOf(existing) !== scope.factoryId) return deny(res);
      project.factory_id = factoryOf(existing);
      if (project.vsmProcesses !== undefined) {
        const blocked = forbiddenProcessRemovals(user, existing.vsmProcesses || [], project.vsmProcesses);
        if (blocked.length) {
          return deny(res, 403, `Yalnızca kendi eklediğiniz prosesleri silebilirsiniz: ${blocked.join(", ")}`);
        }
        project.vsmProcesses = stampProcessOwners(existing.vsmProcesses || [], project.vsmProcesses, user.id);
      }
      if (project.kaizenBursts !== undefined) {
        const blocked = forbiddenBurstRemovals(user, existing.kaizenBursts || [], project.kaizenBursts);
        if (blocked.length) {
          return deny(res, 403, `Yalnızca kendi eklediğiniz kaizen patlamalarını silebilirsiniz: ${blocked.join(", ")}`);
        }
        project.kaizenBursts = stampBurstOwners(existing.kaizenBursts || [], project.kaizenBursts, user.id);
      }
      if (project.versions !== undefined) {
        const blocked = forbiddenOwnedRemovals(user, existing.versions || [], project.versions);
        if (blocked.length) return deny(res, 403, `Yalnızca kendi kaydettiğiniz versiyonları silebilirsiniz: ${blocked.join(", ")}`);
        project.versions = stampOwnedItems(existing.versions || [], project.versions, user.id);
      }
    } else {
      if (!scope.factoryId) return deny(res, 400, "Müşteri seçilmedi.");
      project.factory_id = scope.factoryId;
      project.vsmProcesses = stampProcessOwners([], project.vsmProcesses || [], user.id);
      project.kaizenBursts = stampBurstOwners([], project.kaizenBursts || [], user.id);
      project.versions = stampOwnedItems([], project.versions || [], user.id);
    }

    const saved = await db.saveVsmProject(user.organization_id, project, user.id);
    res.json({ success: true, data: saved });
  });

  app.delete("/api/business/vsm-projects/:id", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (isVsmBlockedSession(user)) return deny(res);
    const existing = await findProject(user.organization_id, req.params.id);
    if (!existing) return deny(res, 404, "VSM projesi bulunamadı.");
    if (!canAccessFactory(req, factoryOf(existing))) return deny(res);
    if (!canDeleteVsmProject(user, existing)) return deny(res, 403, "Yalnızca kendi açtığınız VSM projesini silebilirsiniz.");
    // ?withProcesses=1 also removes the cost-table rows this project created (Loss Capacity), after the user agreed.
    let removedRows = 0;
    if (req.query.withProcesses === "1") {
      const rows = (await db.getProcesses(user.organization_id, factoryOf(existing))).filter((r: any) => r.vsmProjectId === existing.id);
      for (const r of rows) { await db.deleteProcess(user.organization_id, r.id); removedRows++; }
    }
    await db.deleteVsmProject(user.organization_id, req.params.id);
    res.json({ success: true, removedRows });
  });

  // AI analysis (plan step V12): computed from the SAVED project (unsaved screen edits are not included),
  // stored on the project so every viewer sees the same text until it is regenerated.
  app.post("/api/business/vsm-projects/:id/ai-analysis", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (isVsmBlockedSession(user)) return deny(res);
    const existing = await findProject(user.organization_id, req.params.id);
    if (!existing) return deny(res, 404, "VSM projesi bulunamadı.");
    const fid = factoryOf(existing);
    if (!canAccessFactory(req, fid)) return deny(res);
    try {
      const org = user.organization_id;
      const [customerName, loss, assessments, kaizens] = await Promise.all([
        db.getCustomerName(org, fid).catch(() => ""), db.getCiLossSnapshot(org, fid).catch(() => null),
        db.getOpexAssessments(org, fid).catch(() => []), db.getKaizens(org, fid).catch(() => [])
      ]);
      const latestOpex = [...(assessments || [])].sort((a: any, b: any) => String(b.updated_at || b.date || "").localeCompare(String(a.updated_at || a.date || "")))[0];
      const other: VsmOtherModules = {
        lossTop: (loss?.recoveryMatrixData || []).slice().sort((a: any, b: any) => (b.avgLoss || 0) - (a.avgLoss || 0)).slice(0, 5)
          .map((r: any) => ({ subject: r.subject, avgLoss: Math.round(r.avgLoss || 0) })),
        opexOverall: typeof latestOpex?.overallScore === "number" ? Math.round(latestOpex.overallScore * 10) / 10 : null,
        openCiProjects: (kaizens || []).filter((k: any) => k.status !== "Kapatıldı" && k.holdState !== "cancelled").length
      };
      const analysis = await generateVsmAnalysis(existing, customerName || "", other, user.full_name || user.email);
      const saved = await db.saveVsmProject(user.organization_id, { id: existing.id, factory_id: fid, aiAnalysis: analysis }, user.id);
      res.json({ success: true, data: saved.aiAnalysis });
    } catch (e: any) {
      console.warn("[vsm-ai] analysis failed:", e?.message);
      res.status(502).json({ success: false, error: `Analiz üretilemedi: ${e?.message || "bilinmeyen hata"}` });
    }
  });

  // Cost-table sync (plan step V9): writes the SAVED project's measured process figures into the
  // `processes` collection that Loss Capacity reads (one row per VSM process, tagged vsmProjectId).
  // Only measured fields are written — scrap / downtime / waiting costs belong to the Loss screen and are
  // never touched. Rows of another VSM project are left alone. Returns tagged rows whose process no
  // longer exists in the project, so the user can decide to delete them.
  app.post("/api/business/vsm-projects/:id/sync-cost-table", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (isVsmBlockedSession(user)) return deny(res);
    const existing = await findProject(user.organization_id, req.params.id);
    if (!existing) return deny(res, 404, "VSM projesi bulunamadı.");
    const fid = factoryOf(existing);
    if (!canAccessFactory(req, fid)) return deny(res);
    const org = user.organization_id;
    const processes = computeAll(normalizeVsmProject(existing).processes);
    const rows = await db.getProcesses(org, fid);
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    let written = 0, skipped = 0;
    for (const vp of processes) {
      const old: any = byId.get(vp.id);
      if (old && old.vsmProjectId && old.vsmProjectId !== existing.id) { skipped++; continue; }
      await db.saveProcess(org, {
        ...(old || {}),
        id: vp.id,
        name: vp.name,
        factory_id: fid,
        vsmProjectId: existing.id,
        cycleTime: vp.cycleTime,
        oee: vp.oee,
        capacity: vp.capacity,
        operatorCount: vp.operatorCount,
        machineCount: vp.machineCount,
        shiftCount: vp.shifts,
        workingHours: vp.shifts > 0 ? Math.round((vp.workingHours / vp.shifts) * 10) / 10 : vp.workingHours,
        utilizationRate: vp.availability,
        ...(vp.changeoverTime !== undefined ? { changeoverTime: vp.changeoverTime } : {})
      }, user.id);
      written++;
    }
    const ids = new Set(processes.map(p => p.id));
    const orphans = rows.filter((r: any) => r.vsmProjectId === existing.id && !ids.has(r.id)).map((r: any) => ({ id: r.id, name: r.name }));
    res.json({ success: true, data: { written, skipped, orphans } });
  });
}
