// VSM (Değer Akış Haritalama) — server routes. Own module so VSM can later run outside Gemba Tools
// (plan step V11): authentication and customer scoping come in through `VsmRouteDeps`, storage via `db`.
// Access rules: src/utils/vsmAccess.ts.
import type express from "express";
import { db } from "../db.js";
import {
  canDeleteVsmProject, forbiddenBurstRemovals, forbiddenProcessRemovals, isVsmBlockedSession, normalizeVsmProjectInput,
  stampBurstOwners, stampProcessOwners
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
    } else {
      if (!scope.factoryId) return deny(res, 400, "Müşteri seçilmedi.");
      project.factory_id = scope.factoryId;
      project.vsmProcesses = stampProcessOwners([], project.vsmProcesses || [], user.id);
      project.kaizenBursts = stampBurstOwners([], project.kaizenBursts || [], user.id);
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
    await db.deleteVsmProject(user.organization_id, req.params.id);
    res.json({ success: true });
  });
}
