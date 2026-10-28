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
  CiStageAction, CI_SERVER_OWNED_FIELDS, CI_STEPS, applyStageAction, applyFollowUp, canEditProject, canViewProject,
  derivedStatusFields, isCiStaffUser, isClosed, isLeader, isTaskFinished, stageOf, withHistory
} from "../../utils/ciLifecycle.js";
import { buildCiDigests, ciDigestText } from "../../utils/ciReminders.js";

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
  // Outgoing e-mail of the host app (Microsoft Graph in Gemba Tools).
  sendMail: (o: { to: string | string[]; subject: string; text: string }) => Promise<{ success: boolean; error?: string }>;
  // Link to the app put in e-mails.
  appUrl: (req: express.Request) => string;
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
  const { authenticateToken, resolveFactoryScope, canAccessFactory, sendMail, appUrl } = deps;

  // ---- notifications (plan step C9) ----
  // E-mail to user accounts of the organization; a failure is logged and never fails the request.
  // Off when the customer's CI settings say so.
  const remindersOn = async (orgId: string, factoryId: string) =>
    normalizeCiSettings(await db.getCiSettingsRecord(orgId, factoryId)).remindersEnabled;

  async function mailUsers(orgId: string, factoryId: string, userIds: (string | undefined)[], subject: string, text: string, exceptUserId?: string): Promise<number> {
    const ids = new Set(userIds.filter((x): x is string => !!x && x !== exceptUserId));
    if (!ids.size || !(await remindersOn(orgId, factoryId))) return 0;
    const to = (await db.getUsers())
      .filter(u => u.organization_id === orgId && ids.has(u.id) && u.status !== "Disabled" && u.email)
      .map(u => u.email);
    if (!to.length) return 0;
    try {
      const r = await sendMail({ to, subject, text });
      if (!r.success) console.warn("[ci-notify] mail failed:", r.error);
      return r.success ? to.length : 0;
    } catch (e: any) {
      console.warn("[ci-notify] mail failed:", e?.message);
      return 0;
    }
  }

  const projectLine = (p: any, all: any[]) => `${displayProjectNo(p, all)} · ${p.title || "Adsız proje"}`;
  const footer = (req: express.Request) => `\n\nGemba Tools → CI Proje Yönetimi: ${appUrl(req)}`;

  // Short status of a project for the manual reminder.
  function statusText(p: any, todayIso: string): string {
    const stage = stageOf(p);
    const lines = [isClosed(p) ? "Durum: kapandı" : `Durum: Adım ${stage}/8 — ${CI_STEPS[stage - 1].title}`];
    const planned = p.stageDates?.[stage]?.planned;
    if (!isClosed(p) && planned) lines.push(`Bu adımın planlanan tarihi: ${planned}${planned < todayIso ? " (geçti)" : ""}`);
    if (p.pendingApproval) lines.push(`Adım ${p.pendingApproval.stage} proje liderinin onayını bekliyor.`);
    const late = (p.tasks || []).filter((t: any) => t.deadline && t.deadline < todayIso && !isTaskFinished(t));
    if (late.length) lines.push(`Termini geçen aksiyonlar:\n${late.map((t: any) => `  - ${t.name} (${t.responsible || "sorumlu yok"}, ${t.deadline})`).join("\n")}`);
    if (p.plannedFinishDate) lines.push(`Hedef bitiş: ${p.plannedFinishDate}`);
    return lines.join("\n");
  }

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
      const saved = await db.createKaizenWithNumber(user.organization_id, payload.factory_id, created, user.id);
      if (saved.factory_id) {
        await mailUsers(user.organization_id, saved.factory_id, [saved.projectLeaderId, ...(saved.projectTeamIds || [])],
          `CI projesi: ${saved.projectNo} ${saved.title || ""}`.trim(),
          `${who} yeni bir CI projesi açtı; proje lideri ya da ekip üyesi olarak eklendiniz.\n\n${saved.projectNo} · ${saved.title || ""}\nProje lideri: ${saved.projectLeader || "—"}\nHedef bitiş: ${saved.plannedFinishDate || "—"}${footer(req)}`,
          user.id);
      }
      res.json({ success: true, data: saved });
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
    const saved = await db.saveKaizen(user.organization_id, record, user.id);
    // Actions newly assigned to someone (new action, or a different responsible) → tell them.
    if (Array.isArray(payload.tasks)) {
      const before = new Map<string, string | undefined>((existing.tasks || []).map((t: any) => [t.id, t.responsibleId]));
      const assigned = payload.tasks.filter((t: any) => t?.responsibleId && before.get(t.id) !== t.responsibleId && !isTaskFinished(t));
      const all = await db.getKaizens(user.organization_id, existingFactory);
      const assignees: string[] = Array.from(new Set<string>(assigned.map((t: any) => String(t.responsibleId))));
      for (const uid of assignees) {
        const mine = assigned.filter((t: any) => t.responsibleId === uid);
        await mailUsers(user.organization_id, existingFactory, [uid], `CI aksiyonu atandı: ${saved.title || ""}`.trim(),
          `${who} size ${mine.length} aksiyon atadı.\n\n${projectLine(saved, all)}\n${mine.map((t: any) => `  - ${t.name || "Adsız aksiyon"}${t.deadline ? ` (termin ${t.deadline})` : ""}`).join("\n")}${footer(req)}`,
          user.id);
      }
    }
    res.json({ success: true, data: saved });
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
    const factory = factoryOf(existing);
    const settings = normalizeCiSettings(await db.getCiSettingsRecord(user.organization_id, factory));
    const result = applyStageAction(existing, action, user, new Date(), req.body?.note, { followUpDays: settings.followUpDays });
    if (!result.project) return deny(res, 409, result.error);
    const saved = await db.saveKaizen(user.organization_id, result.project, user.id);
    const who = user.full_name || user.email;
    const all = await db.getKaizens(user.organization_id, factory);
    const line = projectLine(saved, all);
    const note = (req.body?.note || "").trim();
    const prev = existing.pendingApproval;
    if (action === "submit" && saved.pendingApproval) {
      await mailUsers(user.organization_id, factory, [saved.projectLeaderId], `Onayınız bekleniyor: ${saved.title || ""}`.trim(),
        `${who}, Adım ${saved.pendingApproval.stage} (${CI_STEPS[saved.pendingApproval.stage - 1].title}) için onayınızı istiyor.\n\n${line}${note ? `\nNot: ${note}` : ""}${footer(req)}`, user.id);
    } else if ((action === "approve" || action === "submit") && prev?.byId) {
      await mailUsers(user.organization_id, factory, [prev.byId], `Adım onaylandı: ${saved.title || ""}`.trim(),
        `${who}, Adım ${prev.stage} (${CI_STEPS[prev.stage - 1].title}) onayladı.${isClosed(saved) ? " Proje kapatıldı." : ` Sıradaki adım: ${CI_STEPS[stageOf(saved) - 1].title}.`}\n\n${line}${note ? `\nNot: ${note}` : ""}${footer(req)}`, user.id);
    } else if (action === "return" && prev?.byId) {
      await mailUsers(user.organization_id, factory, [prev.byId], `Adım geri gönderildi: ${saved.title || ""}`.trim(),
        `${who}, Adım ${prev.stage} (${CI_STEPS[prev.stage - 1].title}) onayını geri gönderdi.\n\n${line}${note ? `\nNot: ${note}` : ""}${footer(req)}`, user.id);
    }
    res.json({ success: true, data: saved });
  });

  // Sustainability check result of a closed project (utils/ciLifecycle.ts applyFollowUp).
  app.post("/api/business/kaizens/:id/follow-up", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (isKaizenSession(user)) return deny(res);
    const existing = await db.getKaizenById(user.organization_id, req.params.id);
    if (!existing || !canAccessFactory(req, factoryOf(existing)) || !canViewProject(user, existing)) return deny(res);
    const result = applyFollowUp(existing, user, new Date(), {
      index: Number(req.body?.index), value: req.body?.value === null || req.body?.value === undefined ? null : Number(req.body.value),
      sustained: req.body?.sustained, note: req.body?.note
    });
    if (!result.project) return deny(res, 409, result.error);
    const saved = await db.saveKaizen(user.organization_id, result.project, user.id);
    // A check that didn't hold is worth telling the leader and the team about.
    if (req.body?.sustained === false) {
      const all = await db.getKaizens(user.organization_id, factoryOf(existing));
      await mailUsers(user.organization_id, factoryOf(existing), [saved.projectLeaderId, ...(saved.projectTeamIds || [])],
        `Sürdürülebilirlik uyarısı: ${saved.title || ""}`.trim(),
        `${user.full_name || user.email} sürdürülebilirlik kontrolünde iyileştirmenin sürmediğini kaydetti.\n\n${projectLine(saved, all)}${req.body?.note ? `\nNot: ${req.body.note}` : ""}${footer(req)}`, user.id);
    }
    res.json({ success: true, data: saved });
  });

  // Manual reminder (replaces the old counter-only "hatırlatma kaydı"): e-mails the leader or the
  // whole team a status summary. Admin / Consultant or the project leader.
  app.post("/api/business/kaizens/:id/remind", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (isKaizenSession(user)) return deny(res);
    const existing = await db.getKaizenById(user.organization_id, req.params.id);
    if (!existing || !canAccessFactory(req, factoryOf(existing))) return deny(res);
    if (!isStaff(user) && !isLeader(user, existing)) return deny(res, 403, "Hatırlatmayı proje lideri ya da danışman gönderebilir.");
    const factory = factoryOf(existing);
    const to = req.body?.to === "team"
      ? [existing.projectLeaderId, ...(existing.projectTeamIds || []), ...(existing.tasks || []).map((t: any) => t.responsibleId)]
      : [existing.projectLeaderId];
    if (!(await remindersOn(user.organization_id, factory))) return deny(res, 409, "Bu müşteri için CI e-postaları kapalı (CI Ayarları).");
    const all = await db.getKaizens(user.organization_id, factory);
    const note = String(req.body?.note || "").trim().slice(0, 1000);
    const today = new Date().toISOString().slice(0, 10);
    const sent = await mailUsers(user.organization_id, factory, to, `CI projesi hatırlatma: ${existing.title || ""}`.trim(),
      `${user.full_name || user.email} bu proje için hatırlatma gönderdi.${note ? `\n\n${note}` : ""}\n\n${projectLine(existing, all)}\n${statusText(existing, today)}${footer(req)}`, user.id);
    if (!sent) return deny(res, 409, "Gönderilecek e-posta adresi bulunamadı (lider / ekip kullanıcı hesabı yok ya da gönderim başarısız).");
    const now = new Date().toISOString();
    const saved = await db.saveKaizen(user.organization_id, withHistory({
      ...existing, emailSentCount: (existing.emailSentCount || 0) + 1, lastEmailSentAt: now
    }, { at: now, by: user.full_name || user.email, byId: user.id, action: `Hatırlatma e-postası gönderildi (${sent} kişi)`, note: note || undefined }), user.id);
    res.json({ success: true, data: saved, sent });
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

  // Weekly reminder digests: preview (no sending) and "send now" for Admin / Consultant, and the
  // weekly cron (CRON_SECRET, every customer with CI projects).
  async function ciDigests(orgId: string, factoryId: string) {
    const [projects, users] = await Promise.all([db.getKaizens(orgId, factoryId), db.getUsers()]);
    return buildCiDigests(projects, users.filter(u => u.organization_id === orgId), new Date().toISOString().slice(0, 10));
  }

  async function sendCiDigests(orgId: string, factoryId: string, link: string): Promise<{ sent: number; skipped?: string }> {
    if (!(await remindersOn(orgId, factoryId))) return { sent: 0, skipped: "CI e-postaları bu müşteri için kapalı." };
    const company = await db.getCustomerName(orgId, factoryId);
    let sent = 0;
    for (const d of await ciDigests(orgId, factoryId)) {
      try {
        const r = await sendMail({ to: d.email, subject: `CI hatırlatma: ${d.items.length} konu ilginizi bekliyor`, text: ciDigestText(d, company, link) });
        if (r.success) sent++;
      } catch (e: any) {
        console.warn("[ci-notify] digest mail failed:", e?.message);
      }
    }
    return { sent };
  }

  app.get("/api/business/ci/reminders/preview", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed || !scope.factoryId || !isStaff(user)) return deny(res);
    res.json({ success: true, data: await ciDigests(user.organization_id, scope.factoryId) });
  });

  app.post("/api/business/ci/reminders/send", authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed || !scope.factoryId || !isStaff(user)) return deny(res);
    const result = await sendCiDigests(user.organization_id, scope.factoryId, appUrl(req));
    console.info(`[ci-audit] reminders sent manually by ${user.email}: ${JSON.stringify(result)}`);
    res.json({ success: true, data: result });
  });

  app.get("/api/cron/ci-reminders", async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return deny(res, 503, "CRON_SECRET ortam değişkeni tanımlı değil.");
    if (req.headers.authorization !== `Bearer ${cronSecret}`) return deny(res, 401, "Unauthorized.");
    const results: any[] = [];
    for (const { orgId, factoryId } of await db.listCiFactories()) {
      try {
        results.push({ factoryId, ...(await sendCiDigests(orgId, factoryId, process.env.APP_URL || appUrl(req))) });
      } catch (e: any) {
        results.push({ factoryId, error: e.message }); // one customer's bad data must not stop the others
      }
    }
    res.json({ success: true, data: results });
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
