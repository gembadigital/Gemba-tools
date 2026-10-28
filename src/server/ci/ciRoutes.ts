// CI Proje Yönetimi — server routes. Kept in their own module so the CI module can later run outside
// Gemba Tools (plan step C11): everything it needs from the host app (authentication, customer
// scoping) comes in through `CiRouteDeps`; storage goes through `db`.
//
// Paths stay /api/business/kaizens for compatibility — the CI projects have always been stored in
// the `kaizens` collection (unrelated to the Kaizen suggestion system's own collections).
import type express from "express";
import { db } from "../db.js";
import { normalizeCiSettings } from "../../utils/ciSettings.js";
import {
  CiStageAction, CI_SERVER_OWNED_FIELDS, applyStageAction, canEditProject, canViewProject, derivedStatusFields,
  isCiStaffUser, isClosed, isLeader, stageOf, withHistory
} from "../../utils/ciLifecycle.js";

import {
  lossOpportunities, costOpportunities, opexOpportunities, kaizenOpportunities, ptrOpportunities, markConverted
} from "../../utils/ciOpportunityPool.js";
import { displayProjectNo } from "../../utils/ciProject.js";

const STAGE_ACTIONS: CiStageAction[] = ["submit", "approve", "return", "stepBack", "reopen", "hold", "cancel", "resume", "confirmGain"];
// Changing any of these voids an earlier consultant confirmation of the realized gain.
const GAIN_FIELDS = ["realizedGain", "realizedGainCurrency", "actualSavings"];
// Leader / team changes: only Admin / Consultant or the current leader (a member must not be able
// to make themself the approver).
const LEADERSHIP_FIELDS = ["projectLeader", "projectLeaderId", "projectTeam", "projectTeamIds"];
const sameValue = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export interface CiRouteDeps {
  authenticateToken: express.RequestHandler;
  // Scope check for the x-factory-id header (see app.ts resolveFactoryScope).
  resolveFactoryScope: (req: express.Request, requestedId?: string) => { allowed: boolean; factoryId?: string };
  canAccessFactory: (req: express.Request, factoryId?: string) => boolean;
}

const isStaff = (user: any) => isCiStaffUser(user);
// Kaizen sicil-no sessions (virtual customer users of the suggestion system) have no CI access.
const isKaizenSession = (user: any) => user?.authType === "kaizen";
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
    if (!scope.allowed || isKaizenSession(user)) return deny(res);
    const all = await db.getKaizens(user.organization_id, scope.factoryId);
    // Customer users see only the projects they lead or are a member of.
    res.json({ success: true, data: isStaff(user) ? all : all.filter(k => canViewProject(user, k)) });
  });

  app.post("/api/business/kaizens", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed || isKaizenSession(user)) return deny(res);
    const payload = { ...req.body };
    // The customer comes from the scoped x-factory-id header, never from the body — a restricted
    // user could otherwise write into another customer by naming its id. Unrestricted users (no
    // header) keep the body's value, as before.
    if (scope.factoryId) payload.factory_id = scope.factoryId;
    const existing = payload.id ? await db.getKaizenById(user.organization_id, String(payload.id)) : null;
    const now = new Date().toISOString();
    const who = user.full_name || user.email;

    if (!existing) {
      // A customer user may only create a project they lead or belong to (otherwise it would vanish
      // from their list at once).
      if (!isStaff(user) && !canViewProject(user, payload)) {
        return deny(res, 403, "Proje lideri ya da ekip üyesi olarak kendinizi seçmelisiniz.");
      }
      // An opportunity of the pool turns into one project only.
      if (payload.opportunityId) {
        const sameCustomer = await db.getKaizens(user.organization_id, payload.factory_id);
        const taken = sameCustomer.find(k => k.opportunityId === payload.opportunityId && k.holdState !== "cancelled");
        if (taken) return deny(res, 409, `Bu fırsat zaten ${displayProjectNo(taken, sameCustomer)} projesine dönüştürüldü.`);
      }
      // Every new project starts at step 1, whatever the client sent (status / kanban / stage).
      for (const f of CI_SERVER_OWNED_FIELDS) delete payload[f];
      Object.assign(payload, { stage: 1, closedAt: null, holdState: null, pendingApproval: null }, derivedStatusFields(1, false, null));
      const created = withHistory(payload, { at: now, by: who, byId: user.id, action: "Proje açıldı" });
      res.json({ success: true, data: await db.createKaizenWithNumber(user.organization_id, payload.factory_id, created, user.id) });
      return;
    }

    // An update may not move a project to another customer, nor touch one the caller can't see/edit.
    const existingFactory = factoryOf(existing);
    if (!canAccessFactory(req, existingFactory) || (payload.factory_id && payload.factory_id !== existingFactory)) return deny(res);
    if (!canEditProject(user, existing)) return deny(res, 403, "Bu projede değişiklik yetkiniz yok.");
    if (!isStaff(user) && !isLeader(user, existing) && LEADERSHIP_FIELDS.some(f => f in payload && !sameValue(payload[f], existing[f]))) {
      return deny(res, 403, "Proje lideri ve ekibini yalnızca proje lideri ya da danışman değiştirebilir.");
    }

    // Lifecycle state, approvals and the project number change only through the stage actions.
    for (const f of CI_SERVER_OWNED_FIELDS) {
      if (f in existing) payload[f] = existing[f];
      else delete payload[f];
    }
    // Step dates: the planned dates are editable, completion / approval stamps are not.
    if (payload.stageDates && typeof payload.stageDates === "object") {
      const merged: Record<string, any> = { ...(existing.stageDates || {}) };
      for (const [k, v] of Object.entries<any>(payload.stageDates)) {
        merged[k] = { ...(merged[k] || {}), planned: typeof v?.planned === "string" ? v.planned : merged[k]?.planned };
      }
      payload.stageDates = merged;
    }
    const changed = Object.keys(payload).filter(f => !["id", "factory_id", "updated_at", "updated_by"].includes(f) && !sameValue(payload[f], existing[f]));
    if (changed.some(f => GAIN_FIELDS.includes(f)) && existing.gainConfirmedAt) {
      Object.assign(payload, { gainConfirmedAt: null, gainConfirmedBy: null, gainConfirmedById: null });
    }
    // Projects on the 8-step model keep their derived status fields consistent with the stage.
    if (existing.stage) Object.assign(payload, derivedStatusFields(stageOf(existing), isClosed(existing), existing.holdState));
    const record = changed.length
      ? withHistory({ ...existing, ...payload }, { at: now, by: who, byId: user.id, action: `Güncellendi (${changed.length} alan)` })
      : { ...existing, ...payload };
    res.json({ success: true, data: await db.saveKaizen(user.organization_id, record, user.id) });
  });

  // Lifecycle actions: submit / approve a step, return, step back, reopen, hold, cancel, resume,
  // confirm the realized gain. Rules in utils/ciLifecycle.ts (applyStageAction).
  app.post("/api/business/kaizens/:id/stage", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (isKaizenSession(user)) return deny(res);
    const action = req.body?.action as CiStageAction;
    if (!STAGE_ACTIONS.includes(action)) return deny(res, 400, "Geçersiz işlem.");
    const existing = await db.getKaizenById(user.organization_id, req.params.id);
    if (!existing || !canAccessFactory(req, factoryOf(existing)) || !canViewProject(user, existing)) return deny(res);
    const result = applyStageAction(existing, action, user, new Date(), req.body?.note);
    if (!result.project) return deny(res, 409, result.error);
    res.json({ success: true, data: await db.saveKaizen(user.organization_id, result.project, user.id) });
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

  // Opportunity pool (plan step C5): improvement points from the other modules, each marked with the
  // project it was already turned into. Read-only; everyone with CI access to the customer.
  app.get("/api/business/ci/opportunities", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed || !scope.factoryId || isKaizenSession(user)) return deny(res);
    const org = user.organization_id, fid = scope.factoryId;
    const [projects, loss, processes, assessments, questions, categories, suggestions, ptr] = await Promise.all([
      db.getKaizens(org, fid), db.getCiLossSnapshot(org, fid), db.getProcesses(org, fid),
      db.getOpexAssessments(org, fid), db.getOpexQuestions(org), db.getOpexCategories(org),
      db.getKaizenRecords("kaizen_suggestions", org, fid), db.getPtrRecords(org, fid)
    ]);
    const items = [
      ...lossOpportunities(loss), ...costOpportunities(processes), ...opexOpportunities(assessments, questions, categories),
      ...kaizenOpportunities(suggestions), ...ptrOpportunities(ptr)
    ];
    res.json({
      success: true,
      data: {
        items: markConverted(items, projects, p => displayProjectNo(p, projects)),
        lossProductFamily: loss ? { name: loss.productFamilyName || null, ratio: Number(loss.productFamilyRatio) || 1, updatedAt: loss.updatedAt || null } : null
      }
    });
  });

  // Loss Analysis screen saves its computed recovery matrix here (only the fields the pool uses).
  app.post("/api/business/ci/loss-snapshot", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed || !scope.factoryId || isKaizenSession(user)) return deny(res);
    const rows = Array.isArray(req.body?.recoveryMatrixData) ? req.body.recoveryMatrixData.slice(0, 60) : [];
    const clean = rows.filter((r: any) => r && typeof r.subject === "string").map((r: any) => ({
      subject: String(r.subject).slice(0, 120),
      avgLoss: Number(r.avgLoss) || 0,
      avgGain: Number(r.avgGain) || 0,
      severity: typeof r.severity === "string" ? r.severity.slice(0, 20) : undefined,
      leanTool: typeof r.leanTool === "string" ? r.leanTool.slice(0, 120) : undefined,
      area: typeof r.area === "string" ? r.area.slice(0, 120) : undefined
    }));
    await db.saveCiLossSnapshot(user.organization_id, scope.factoryId, {
      recoveryMatrixData: clean,
      productFamilyName: typeof req.body?.productFamilyName === "string" ? req.body.productFamilyName.slice(0, 120) : null,
      productFamilyRatio: Number(req.body?.productFamilyRatio) > 0 ? Number(req.body.productFamilyRatio) : 1,
      updatedAt: typeof req.body?.updatedAt === "string" ? req.body.updatedAt : new Date().toISOString()
    }, user.id);
    res.json({ success: true });
  });

  // Per-customer CI settings. Everyone with access to the customer reads them (the forms need the
  // lists); only Admin / Consultant change them.
  app.get("/api/business/ci/settings", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed || !scope.factoryId || isKaizenSession(user)) return deny(res);
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
