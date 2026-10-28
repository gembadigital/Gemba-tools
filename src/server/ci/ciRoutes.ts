// CI Proje Yönetimi — server routes. Kept in their own module so the CI module can later run outside
// Gemba Tools (plan step C11): everything it needs from the host app (authentication, customer
// scoping) comes in through `CiRouteDeps`; storage goes through `db`.
//
// Paths stay /api/business/kaizens for compatibility — the CI projects have always been stored in
// the `kaizens` collection (unrelated to the Kaizen suggestion system's own collections).
import type express from "express";
import { db } from "../db.js";
import { normalizeCiSettings } from "../../utils/ciSettings.js";

export interface CiRouteDeps {
  authenticateToken: express.RequestHandler;
  // Scope check for the x-factory-id header (see app.ts resolveFactoryScope).
  resolveFactoryScope: (req: express.Request, requestedId?: string) => { allowed: boolean; factoryId?: string };
  canAccessFactory: (req: express.Request, factoryId?: string) => boolean;
}

const isStaff = (user: any) => user.role === "Admin" || user.role === "Consultant";
// Legacy records saved without a customer belong to the old default factory id.
const factoryOf = (record: any) => record.factory_id || "arcelik_bolu";

function deny(res: express.Response, status = 403, error = "Access Denied.") {
  res.status(status).json({ success: false, error });
}

export function registerCiRoutes(app: express.Express, deps: CiRouteDeps) {
  const { authenticateToken, resolveFactoryScope, canAccessFactory } = deps;

  app.get("/api/business/kaizens", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed) return deny(res);
    res.json({ success: true, data: await db.getKaizens(user.organization_id, scope.factoryId) });
  });

  app.post("/api/business/kaizens", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed) return deny(res);
    const payload = { ...req.body };
    // The customer comes from the scoped x-factory-id header, never from the body — a restricted
    // user could otherwise write into another customer by naming its id. Unrestricted users (no
    // header) keep the body's value, as before.
    if (scope.factoryId) payload.factory_id = scope.factoryId;
    const existing = payload.id ? await db.getKaizenById(user.organization_id, String(payload.id)) : null;
    if (!existing) {
      res.json({ success: true, data: await db.createKaizenWithNumber(user.organization_id, payload.factory_id, payload, user.id) });
      return;
    }
    // An update may not move a project to another customer, nor touch one the caller can't see.
    const existingFactory = factoryOf(existing);
    if (!canAccessFactory(req, existingFactory) || (payload.factory_id && payload.factory_id !== existingFactory)) return deny(res);
    // Server-owned fields: the project number is fixed at creation.
    payload.projectNo = existing.projectNo;
    payload.projectSeq = existing.projectSeq;
    payload.created_by = existing.created_by;
    payload.created_at = existing.created_at;
    res.json({ success: true, data: await db.saveKaizen(user.organization_id, payload, user.id) });
  });

  app.delete("/api/business/kaizens/:id", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    // CI projects are deleted only by Admin / Consultant; customer users (project leader or member)
    // edit and remove items inside a project but never the project itself.
    if (!isStaff(user)) return deny(res, 403, "CI projesini yalnızca Admin veya Danışman silebilir.");
    const existing = await db.getKaizenById(user.organization_id, req.params.id);
    if (!existing || !canAccessFactory(req, factoryOf(existing))) return deny(res);
    await db.deleteKaizen(user.organization_id, req.params.id);
    res.json({ success: true });
  });

  // Per-customer CI settings. Everyone with access to the customer reads them (the forms need the
  // lists); only Admin / Consultant change them.
  app.get("/api/business/ci/settings", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed || !scope.factoryId) return deny(res);
    res.json({ success: true, data: normalizeCiSettings(await db.getCiSettingsRecord(user.organization_id, scope.factoryId)) });
  });

  app.post("/api/business/ci/settings", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed || !scope.factoryId) return deny(res);
    if (!isStaff(user)) return deny(res, 403, "CI ayarlarını yalnızca Admin veya Danışman değiştirebilir.");
    const settings = normalizeCiSettings({ ...req.body, updatedAt: new Date().toISOString(), updatedBy: user.email });
    await db.saveCiSettingsRecord(user.organization_id, scope.factoryId, settings, user.id);
    res.json({ success: true, data: settings });
  });
}
