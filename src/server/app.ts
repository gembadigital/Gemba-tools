import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { db, hashPassword, verifyPassword, needsRehash, User } from "./db.js";
import jwt from "jsonwebtoken";
import { generatePtrTemplateExcel, isPtrTemplateAvailable, buildPtrExportFilename, PtrTemplateRecord } from "./ptrExcelTemplate.js";
import { generateOpexTemplateExcel, isOpexTemplateAvailable, buildOpexExportFilename } from "./opexExcelTemplate.js";
import { mergeOpexAssessmentSave } from "./opexMerge.js";
import { loadExecutiveReport } from "./opexReport/load.js";
import { analyzePtrRecords } from "./ptrDigest.js";
import { buildFacts, generateConsultantBrief } from "./opexReport/consultantBrief.js";
import { applyFinding, canWriteFinding } from "./opexFindings.js";
import { renderReportHtml } from "./opexReport/render.js";
import { KNOWN_CURRENCIES, normalizeKaizenSettings, KaizenSettings, rewardFor, requiredStagesFor, stagesOf, afterManagerApprovalStatus } from "../utils/kaizenSettings.js";
import { preparePersonnel, buildOrg, effectiveManagerId, managerChain, visibleSuggestionIds, planPersonnelImport } from "../utils/kaizenOrg.js";
import { isPerPiece, parsePerPiece, perPieceSaving } from "../utils/kaizenSaving.js";
import { buildReminders, reminderText } from "../utils/kaizenReminders.js";
import { championsFor, championMonths } from "../utils/kaizenChampions.js";
import { findSimilar, mergeSimilar, cosineVec, embeddingText, textHash } from "../utils/kaizenSimilar.js";
import { pinRequired, findBySicil, pinProblem, newPinCode, isLocked, failedAttempt, codeValid, pinValid, hashSecret, publicPersonnel, stripSecretInput, virtualEmail, isAuthorizedRole, PIN_LOCK_MINUTES, PIN_CODE_DAYS, KIOSK_SESSION, PHONE_SESSION } from "./kaizenAuth.js";
import * as XLSX from "xlsx";

// This module only builds and configures the Express app (all /api/* routes) and exports it —
// it never calls app.listen(). Two different entry points mount it: server.ts (local dev /
// Cloud Run, via app.listen()) and api/index.ts (Vercel, as a serverless function handler).
const app = express();
// Default Express JSON limit is ~100kb — too small for the base64 photo uploads used across this
// app (Kaizen before/after photos, 5S Audit/Gemba Walk evidence photos), which would otherwise be
// silently rejected with a 413 before ever reaching a route handler.
app.use(express.json({ limit: "20mb" }));

// Max team size for a customer: 1 primary consultant + up to 2 secondary consultants.
const MAX_CONSULTANTS_PER_CUSTOMER = 3;
// Max number of Customer User accounts a customer can have invited against it.
const MAX_CUSTOMER_USER_INVITES_PER_CUSTOMER = 2;

// Lazy initialize Gemini API client to prevent crashing if the key is missing on startup
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Please add it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Real outgoing mail via Microsoft Graph (OAuth2 client credentials flow — app-only, no user
// sign-in). Replaces the previous SMTP/nodemailer transport, which was never actually configured
// in production (SMTP_HOST/USER/PASS were never set). Unlike GEMINI_API_KEY/JWT_SECRET this is
// optional at startup — the server still runs without it, and sendMail() below returns a clear,
// honest error per request instead of silently no-oping or claiming success.
//
// Security notes:
// - AZURE_CLIENT_SECRET is read only from process.env, never logged, never sent to the client.
// - The access token is cached in memory only (module-level variable) — never persisted to the
//   database or any other store — and is never logged either.
// - Error logging below only ever includes HTTP status codes and Graph's own error response body
//   (which describes what went wrong, not credentials), so secrets/tokens can't leak into logs.
let graphTokenCache: { accessToken: string; expiresAt: number } | null = null;

async function getGraphAccessToken(): Promise<string> {
  // 60s safety margin before the real expiry so a token doesn't expire mid-request.
  if (graphTokenCache && graphTokenCache.expiresAt > Date.now() + 60_000) {
    return graphTokenCache.accessToken;
  }
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph yapılandırılmamış: AZURE_TENANT_ID/AZURE_CLIENT_ID/AZURE_CLIENT_SECRET eksik.");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text().catch(() => "");
    console.error("Failed to acquire Microsoft Graph access token", tokenRes.status, errBody);
    throw new Error("Microsoft Graph kimlik doğrulaması başarısız oldu.");
  }
  const data = await tokenRes.json() as { access_token: string; expires_in: number };
  graphTokenCache = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return graphTokenCache.accessToken;
}

function toGraphRecipients(addr?: string | string[]): { emailAddress: { address: string } }[] {
  if (!addr) return [];
  return (Array.isArray(addr) ? addr : [addr]).filter(Boolean).map(address => ({ emailAddress: { address } }));
}

async function sendMail(options: {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<{ success: boolean; error?: string }> {
  const mailFrom = process.env.MAIL_FROM || process.env.EMAIL_FROM || "proje@gembapartner.com";
  try {
    const accessToken = await getGraphAccessToken();
    const message: Record<string, any> = {
      subject: options.subject,
      body: {
        contentType: options.html ? "HTML" : "Text",
        content: options.html || options.text || ""
      },
      toRecipients: toGraphRecipients(options.to),
      ccRecipients: toGraphRecipients(options.cc)
    };
    if (options.attachments && options.attachments.length > 0) {
      message.attachments = options.attachments.map(a => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.filename,
        contentBytes: a.content.toString("base64")
      }));
    }

    const sendRes = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailFrom)}/sendMail`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message, saveToSentItems: true })
    });
    if (!sendRes.ok) {
      const errBody = await sendRes.text().catch(() => "");
      console.error("Microsoft Graph sendMail failed", sendRes.status, errBody);
      return { success: false, error: `E-posta gönderilemedi (Graph API hatası, durum ${sendRes.status}).` };
    }
    return { success: true };
  } catch (e: any) {
    console.error("Failed to send email via Microsoft Graph", e?.message || e);
    return { success: false, error: e?.message || "E-posta gönderilemedi." };
  }
}

// SESSION TOKENS: signed + expiring JWTs, not a bare user id. Previously this app's "token" was
// literally the user's own database id (e.g. "usr_arcelik_admin") — unsigned and permanent, so
// anyone who saw/guessed that id anywhere (logs, URLs, devtools) could authenticate as that user
// forever. A JWT is signed with a server-only secret and expires, closing that hole.
// Lazy (checked on first use, not at module load) so this module can be imported by either entry
// point — server.ts (local/Cloud Run) or api/index.ts (Vercel) — regardless of exactly when that
// entry point's dotenv.config() call runs relative to this module's own evaluation.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required but missing. Add it to .env before starting the server.");
  }
  return secret;
}
const SESSION_TOKEN_TTL = "7d";

function signSessionToken(userId: string): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: SESSION_TOKEN_TTL });
}

// Builds an absolute origin (e.g. "https://gemba-tools-....vercel.app") from the incoming request
// so emailed links (invite/reset-password) work outside the app's own SPA — req.protocol reports
// "http" behind Vercel's proxy unless the forwarded-proto header is read explicitly.
function getBaseUrl(req: express.Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol || "https";
  return `${proto}://${req.get("host")}`;
}

// Emails the invite link so onboarding doesn't depend on an admin manually copying/relaying a
// link out-of-band. Errors are logged but non-fatal — the invitation row already exists either
// way, and the caller still returns `link` in its response as a manual-share fallback.
async function sendInvitationEmail(req: express.Request, toEmail: string, organizationName: string, invitationToken: string): Promise<void> {
  const signupLink = `${getBaseUrl(req)}/invite?token=${invitationToken}`;
  const mailResult = await sendMail({
    to: toEmail,
    subject: `Gemba Tools - ${organizationName} Çalışma Alanına Davet`,
    html: `<p>Merhaba,</p>
      <p><strong>${organizationName}</strong> çalışma alanına katılmanız için davet edildiniz.</p>
      <p>Katılmak için aşağıdaki bağlantıya tıklayın (48 saat geçerlidir):</p>
      <p><a href="${signupLink}">${signupLink}</a></p>`
  });
  if (!mailResult.success) {
    console.error(`Invitation email failed for ${toEmail}: ${mailResult.error}`);
  }
}

// Resolves the effective factory/customer id for a business-data request, enforcing Customer
// User isolation. Admin/Consultant requests pass through unrestricted (any consultant can work
// on any customer under the org). A Customer User's requested id is only honored if it's one of
// their own assigned customers; with no id requested, defaults to their first assigned customer;
// otherwise the request is rejected.
function resolveFactoryScope(req: express.Request, requestedId?: string): { allowed: boolean; factoryId?: string } {
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds === null) {
    return { allowed: true, factoryId: requestedId };
  }
  if (allowedCustomerIds.length === 0) {
    return { allowed: false };
  }
  if (!requestedId) {
    return { allowed: true, factoryId: allowedCustomerIds[0] };
  }
  if (!allowedCustomerIds.includes(requestedId)) {
    return { allowed: false };
  }
  return { allowed: true, factoryId: requestedId };
}

// SECURE MIDDLEWARE FOR MULTI-TENANCY ISOLATION
export async function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ success: false, error: "Authentication token is missing. Please log in." });
    return;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  let userId: string;
  let payload: any;
  try {
    payload = jwt.verify(token, getJwtSecret());
    userId = payload.userId;
  } catch (e) {
    res.status(401).json({ success: false, error: "Invalid or expired session. Please sign in again." });
    return;
  }

  // Sicil no session (Faz 3.5): no user account behind it — the request runs as a virtual
  // "Customer User" scoped to that one customer and tied to the personnel record.
  if (payload?.kind === "kaizen") {
    const session = await kaizenSessionUser(payload);
    if ("error" in session) {
      res.status(401).json({ success: false, error: session.error });
      return;
    }
    (req as any).user = session.user;
    (req as any).organization = (await db.getOrganizations()).find(o => o.id === session.user.organization_id);
    (req as any).allowedCustomerIds = [payload.fid];
    next();
    return;
  }

  const users = await db.getUsers();
  const user = users.find(u => u.id === userId);

  if (!user) {
    res.status(401).json({ success: false, error: "Invalid session token. Please sign in again." });
    return;
  }

  if (user.status === "Disabled") {
    res.status(403).json({ success: false, error: "Your account is disabled. Please contact your administrator." });
    return;
  }

  // Attach elements to request context
  (req as any).user = user;
  const orgs = await db.getOrganizations();
  (req as any).organization = orgs.find(o => o.id === user.organization_id);
  // Customer User accounts are hard-scoped to their own assigned customer(s); Admin/Consultant
  // are unrestricted (any consultant can work on any customer under the org).
  (req as any).allowedCustomerIds = user.role === "Customer User" ? (user.assigned_customer_ids || []) : null;

  next();
}

// Generic Microsoft Graph mail-send endpoint. Requires an authenticated app session — this can
// send mail as MAIL_FROM (proje@gembapartner.com), so leaving it unauthenticated would make it an
// open spam relay; every other route in this app is authenticateToken-gated the same way.
app.post("/api/send-email", authenticateToken, async (req, res) => {
  const { to, subject, html } = req.body;
  const toList: string[] = Array.isArray(to) ? to.filter(Boolean) : (to ? [to] : []);
  if (toList.length === 0 || !subject || !html) {
    res.status(400).json({ success: false, error: "to, subject ve html alanları gereklidir." });
    return;
  }
  const result = await sendMail({ to: toList, subject, html });
  if (!result.success) {
    res.status(502).json(result);
    return;
  }
  res.status(200).json({ success: true });
});

// AUTH API ENDPOINTS
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, fullName, organizationName } = req.body;
    if (!email || !password || !fullName) {
      res.status(400).json({ success: false, error: "Please enter your name, email, and password." });
      return;
    }

    const emailClean = email.toLowerCase().trim();
    const existing = (await db.getUsers()).find(u => u.email === emailClean);
    if (existing) {
      res.status(400).json({ success: false, error: "This email is already registered." });
      return;
    }

    // Determine or create tenant organization
    const domain = emailClean.split("@")[1];
    if (!domain) {
      res.status(400).json({ success: false, error: "Invalid email structure." });
      return;
    }

    let org = (await db.getOrganizations()).find(o => o.domain === domain);
    let role: "Admin" | "Consultant" | "Customer User" = "Customer User";

    if (!org) {
      // First user registering under this domain becomes the Admin
      org = await db.createOrganization(organizationName || `${domain.split(".")[0].toUpperCase()} Workspace`, domain);
      role = "Admin";
    }

    const newUser = await db.createUser({
      organization_id: org.id,
      full_name: fullName,
      email: emailClean,
      password_hash: hashPassword(password),
      role,
      status: "Active"
    });

    res.json({
      success: true,
      token: signSessionToken(newUser.id),
      user: {
        id: newUser.id,
        full_name: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        organization_id: newUser.organization_id
      },
      organization: org
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: "Please provide both email and password." });
      return;
    }

    const emailClean = email.toLowerCase().trim();
    const user = (await db.getUsers()).find(u => u.email === emailClean);
    if (!user) {
      res.status(401).json({ success: false, error: "Incorrect email or password." });
      return;
    }

    if (!verifyPassword(password, user.password_hash)) {
      res.status(401).json({ success: false, error: "Incorrect email or password." });
      return;
    }

    if (user.status === "Disabled") {
      res.status(403).json({ success: false, error: "This account has been disabled. Access denied." });
      return;
    }

    // Set last login date, and transparently upgrade any legacy (pre-scrypt) password hash
    // now that we know the plaintext password matched it.
    const updates: Partial<User> = { last_login: new Date().toISOString() };
    if (needsRehash(user.password_hash)) {
      updates.password_hash = hashPassword(password);
    }
    await db.updateUser(user.id, updates);

    const org = (await db.getOrganizations()).find(o => o.id === user.organization_id);

    res.json({
      success: true,
      token: signSessionToken(user.id),
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status,
        organization_id: user.organization_id,
        last_login: user.last_login
      },
      organization: org
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---- Sicil no ile giriş (Faz 3.5) ----
async function kaizenSessionUser(payload: any): Promise<{ user: any } | { error: string }> {
  const roster = await db.getKaizenRecords("kaizen_personnel", payload.org, payload.fid);
  const person = roster.find((p: any) => p.id === payload.pid);
  if (!person) return { error: "Personel kaydı bulunamadı. Lütfen yeniden giriş yapın." };
  const settings = await loadKaizenSettings(payload.org, payload.fid);
  // A PIN reset ends existing PIN sessions; a role that now needs a PIN needs a fresh login.
  if (payload.pin && (Number(person.pinVersion) || 0) !== payload.pv) return { error: "PIN değişti. Lütfen yeniden giriş yapın." };
  if (!payload.pin && pinRequired(person, roster, settings.pinPolicy)) return { error: "Bu hesap için artık PIN gerekiyor. Lütfen yeniden giriş yapın." };
  return {
    user: {
      id: `kaizen:${person.id}`,
      organization_id: payload.org,
      full_name: person.name,
      email: (person.email || virtualEmail(person.id)).toLowerCase(),
      role: "Customer User",
      status: "Active",
      last_login: null,
      assigned_customer_ids: [payload.fid],
      authType: "kaizen",
      // Kiosk (Faz 3.6): shared tablet — the client shows the reduced kiosk screen and signs out itself.
      kaizenDevice: payload.dev === "kiosk" ? "kiosk" : "phone",
      kaizenPersonnelId: person.id,
      employeeNo: person.employeeNo || ""
    }
  };
}

// Public: tells the login page which company the link belongs to (nothing else).
app.get("/api/auth/kaizen-login-info", async (req, res) => {
  try {
    await kaizenLoginInfo(req, res);
  } catch (e: any) {
    console.error("[kaizen-login] login-info failed:", e.message);
    res.status(500).json({ success: false, error: "Sunucu hatası, biraz sonra tekrar deneyin." });
  }
});

async function kaizenLoginInfo(req: express.Request, res: express.Response) {
  const fid = typeof req.query.c === "string" ? req.query.c.slice(0, 100) : "";
  const found = fid ? await db.findKaizenPersonnelByFactory(fid) : null;
  if (!found) {
    // A real customer without a roster is a setup gap, not a broken link — say which one it is.
    const known = fid ? await db.customerExists(fid) : false;
    console.warn(`[kaizen-login] login-info miss for c=${fid.slice(0, 40)} (customer ${known ? "exists, no personnel" : "unknown"})`);
    return res.status(404).json({ success: false, error: known ? "Bu müşteri için henüz personel tanımlanmamış." : "Giriş bağlantısı geçersiz.", reason: known ? "no-personnel" : "unknown" });
  }
  res.json({ success: true, data: { companyName: await db.getCustomerName(found.orgId, fid) } });
}

app.post("/api/auth/kaizen-login", async (req, res) => {
  try {
    const fid = typeof req.body.c === "string" ? req.body.c.slice(0, 100) : "";
    const found = fid ? await db.findKaizenPersonnelByFactory(fid) : null;
    if (!found) return res.status(404).json({ success: false, error: "Giriş bağlantısı geçersiz." });
    const { orgId, personnel } = found;
    const person = findBySicil(personnel, req.body.employeeNo);
    if (!person) return res.status(401).json({ success: false, error: "Bu sicil no kayıtlı değil. Kurul Yöneticinize başvurun." });
    if (isLocked(person)) return res.status(429).json({ success: false, error: `Çok fazla hatalı deneme. ${PIN_LOCK_MINUTES} dakika sonra tekrar deneyin.` });

    const settings = await loadKaizenSettings(orgId, fid);
    const needPin = pinRequired(person, personnel, settings.pinPolicy);
    // Successive saves in one request build on each other (a stale copy would undo the new PIN).
    let current = person;
    const save = async (patch: Record<string, any>) => {
      current = { ...current, ...patch };
      await db.saveKaizenRecord("kaizen_personnel", orgId, fid, current, `kaizen:${person.id}`);
    };
    let pinVersion = Number(person.pinVersion) || 0;

    if (needPin) {
      if (person.pinHash) {
        if (!req.body.pin) return res.json({ success: true, step: "pin", name: person.name });
        if (!pinValid(person, req.body.pin)) {
          await save(failedAttempt(person));
          return res.status(401).json({ success: false, step: "pin", error: "PIN hatalı." });
        }
      } else {
        // First login (or after a reset): one-time code from the Kurul Yöneticisi + own new PIN.
        if (!req.body.code) return res.json({ success: true, step: "setup", name: person.name });
        if (!codeValid(person, req.body.code)) {
          await save(failedAttempt(person));
          return res.status(401).json({ success: false, step: "setup", error: "Giriş kodu hatalı ya da süresi dolmuş. Kurul Yöneticinizden yeni kod isteyin." });
        }
        const problem = pinProblem(req.body.newPin);
        if (problem) return res.status(400).json({ success: false, step: "setup", error: problem });
        pinVersion += 1;
        await save({ pinHash: hashSecret(req.body.newPin), pinCodeHash: "", pinCodeExpires: "", pinVersion, pinSetAt: new Date().toISOString(), pinFailed: 0, pinLockedUntil: "" });
      }
    }
    if (current.pinFailed || current.pinLockedUntil) await save({ pinFailed: 0, pinLockedUntil: "" });

    const kiosk = req.body.device === "kiosk";
    const dev = kiosk ? "kiosk" : "phone";
    const token = jwt.sign({ kind: "kaizen", pid: person.id, org: orgId, fid, pin: needPin, pv: pinVersion, dev }, getJwtSecret(), { expiresIn: kiosk ? KIOSK_SESSION : PHONE_SESSION });
    const session = await kaizenSessionUser({ pid: person.id, org: orgId, fid, pin: needPin, pv: pinVersion, dev });
    if ("error" in session) return res.status(401).json({ success: false, error: session.error });
    const organization = (await db.getOrganizations()).find(o => o.id === orgId);
    res.json({ success: true, step: "done", token, user: session.user, organization });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const organization = (req as any).organization;
    res.json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status,
        organization_id: user.organization_id,
        last_login: user.last_login,
        ...(user.authType === "kaizen" ? { authType: "kaizen", kaizenDevice: user.kaizenDevice, kaizenPersonnelId: user.kaizenPersonnelId, employeeNo: user.employeeNo, assigned_customer_ids: user.assigned_customer_ids } : {})
      },
      organization
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/edit-profile", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.authType === "kaizen") {
      res.status(403).json({ success: false, error: "Sicil no ile giriş yapan hesaplarda bu bilgiler Kurulum > Personel'den değiştirilir. Kurul Yöneticinize başvurun." });
      return;
    }
    const { fullName, email } = req.body;

    if (!fullName || !email) {
      res.status(400).json({ success: false, error: "Full Name and email cannot be empty." });
      return;
    }

    const emailClean = email.toLowerCase().trim();
    // Validate domain consistency (MUST remain in same domain)
    const currentDomain = user.email.split("@")[1];
    const newDomain = emailClean.split("@")[1];
    if (currentDomain !== newDomain) {
      res.status(400).json({ success: false, error: "Changing company domains is prohibited to protect workspace integrity." });
      return;
    }

    const updatedUser = await db.updateUser(user.id, {
      full_name: fullName,
      email: emailClean
    });

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        organization_id: updatedUser.organization_id
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/change-password", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.authType === "kaizen") {
      res.status(403).json({ success: false, error: "Sicil no ile giriş yapan hesaplarda bu bilgiler Kurulum > Personel'den değiştirilir. Kurul Yöneticinize başvurun." });
      return;
    }
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: "Please enter your current and new passwords." });
      return;
    }

    if (!verifyPassword(currentPassword, user.password_hash)) {
      res.status(400).json({ success: false, error: "Current password invalid." });
      return;
    }

    await db.updateUser(user.id, {
      password_hash: hashPassword(newPassword)
    });

    res.json({ success: true, message: "Password updated successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Same generic response whether or not the email exists, so this endpoint can't be used to
// enumerate registered accounts.
const RESET_PASSWORD_GENERIC_MESSAGE = "Bu e-posta sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.";

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: "Please input your email." });
      return;
    }

    const user = (await db.getUsers()).find(u => u.email === email.toLowerCase().trim());
    if (!user) {
      res.json({ success: true, message: RESET_PASSWORD_GENERIC_MESSAGE });
      return;
    }

    // Ownership of the account is proven by clicking the emailed link, not by knowing the email
    // address — the previous version of this endpoint returned a new password directly in the
    // API response (and rendered it on screen) to whoever submitted the email, which let anyone
    // take over any account they knew the email address of.
    const { resetToken } = await db.createPasswordReset(user.id);
    const resetLink = `${getBaseUrl(req)}/reset-password?resetToken=${resetToken}`;
    const mailResult = await sendMail({
      to: user.email,
      subject: "Gemba Tools - Şifre Sıfırlama",
      html: `<p>Merhaba ${user.full_name},</p>
        <p>Hesabınız için bir şifre sıfırlama talebi aldık. Devam etmek için aşağıdaki bağlantıya tıklayın (1 saat geçerlidir):</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz; hesabınızda herhangi bir değişiklik yapılmayacaktır.</p>`
    });
    if (!mailResult.success) {
      console.error(`Password reset email failed for ${user.email}: ${mailResult.error}`);
    }

    res.json({ success: true, message: RESET_PASSWORD_GENERIC_MESSAGE });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/reset-password/confirm", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      res.status(400).json({ success: false, error: "Eksik bilgi." });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ success: false, error: "Şifre en az 6 karakter olmalıdır." });
      return;
    }

    const consumed = await db.consumePasswordReset(resetToken);
    if (!consumed) {
      res.status(400).json({ success: false, error: "Geçersiz veya süresi dolmuş sıfırlama bağlantısı. Lütfen yeni bir talep oluşturun." });
      return;
    }

    const user = await db.updateUser(consumed.userId, { password_hash: hashPassword(newPassword) });
    const org = (await db.getOrganizations()).find(o => o.id === user.organization_id);

    res.json({
      success: true,
      token: signSessionToken(user.id),
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status,
        organization_id: user.organization_id
      },
      organization: org
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// INVITATIONS
app.post("/api/auth/invite", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "Admin") {
      res.status(403).json({ success: false, error: "Only administrators can invite new workspace members." });
      return;
    }

    const { email, role } = req.body;
    if (!email || !role) {
      res.status(400).json({ success: false, error: "Missing email or role." });
      return;
    }

    const emailClean = email.toLowerCase().trim();
    // Domain match is only required for internal staff (Admin/Consultant) invites — a Customer
    // User is expected to use their own company's email domain, not the inviting Admin's.
    if (role !== "Customer User") {
      const adminDomain = user.email.split("@")[1];
      const inviteDomain = emailClean.split("@")[1];
      if (adminDomain !== inviteDomain) {
        res.status(400).json({
          success: false,
          error: `Gireceğiniz e-posta '${adminDomain}' uzantılı olmalıdır. Sadece kendi şirket domaininizdeki çalışanları davet edebilirsiniz.`
        });
        return;
      }
    }

    // Check if user already exists
    const exists = (await db.getUsers()).find(u => u.email === emailClean);
    if (exists) {
      res.status(400).json({ success: false, error: "This email is already registered in the system." });
      return;
    }

    const invitation = await db.createInvitation(user.organization_id, emailClean, role);
    const organization = (await db.getOrganizations()).find(o => o.id === user.organization_id);
    await sendInvitationEmail(req, emailClean, organization?.organization_name || "Gemba Tools", invitation.invitation_token);

    res.json({
      success: true,
      message: "Davet e-postası gönderildi.",
      link: `/invite?token=${invitation.invitation_token}`,
      invitation
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/auth/invitation/:token", async (req, res) => {
  try {
    const invite = (await db.getInvitations()).find(i => i.invitation_token === req.params.token && !i.accepted);
    if (!invite) {
      res.status(400).json({ success: false, error: "Invalid, expired, or accepted invitation." });
      return;
    }

    const org = (await db.getOrganizations()).find(o => o.id === invite.organization_id);

    res.json({
      success: true,
      invitation: invite,
      organization: org
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/auth/accept-invitation", async (req, res) => {
  try {
    const { token, fullName, password } = req.body;
    if (!token || !fullName || !password) {
      res.status(400).json({ success: false, error: "Please enter your full name and password." });
      return;
    }

    const newUser = await db.acceptInvitation(token, password, fullName);
    const org = (await db.getOrganizations()).find(o => o.id === newUser.organization_id);

    res.json({
      success: true,
      token: signSessionToken(newUser.id),
      user: {
        id: newUser.id,
        full_name: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        organization_id: newUser.organization_id
      },
      organization: org
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// USER ADMINISTRATION (Only Admin role)
// Role Module Visibility — GET is available to any authenticated user (the sidebar itself needs
// this to decide what to render for the logged-in user's role); only Admin can change it.
app.get("/api/admin/role-module-visibility", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  res.json({ success: true, data: await db.getRoleModuleVisibility(user.organization_id) });
});

app.post("/api/admin/role-module-visibility", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin") {
    res.status(403).json({ success: false, error: "Access Denied. Administrator role required." });
    return;
  }
  const saved = await db.saveRoleModuleVisibility(user.organization_id, req.body.settings, user.id);
  res.json({ success: true, data: saved });
});

app.get("/api/admin/users", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "Admin") {
      res.status(403).json({ success: false, error: "Access Denied. Administrator role required." });
      return;
    }

    // Get only users in the SAME organization
    const orgUsers = (await db.getUsers()).filter(u => u.organization_id === user.organization_id);
    // Remove password hashes from outputs
    const safeUsers = orgUsers.map(u => ({
      id: u.id,
      organization_id: u.organization_id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      status: u.status,
      last_login: u.last_login,
      created_at: u.created_at,
      assigned_customer_ids: u.assigned_customer_ids || []
    }));

    // Invited consultants/guests only become rows in `users` once they accept — until then there
    // was no way to tell they'd been invited at all. Surface still-pending invitations separately
    // so the admin can see who hasn't accepted yet instead of them silently vanishing from the list.
    const pendingInvitations = (await db.getInvitations())
      .filter(inv => inv.organization_id === user.organization_id && !inv.accepted)
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        customer_id: inv.customer_id,
        expires_at: inv.expires_at
      }));

    res.json({ success: true, users: safeUsers, pendingInvitations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/users/:id/role", authenticateToken, async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (adminUser.role !== "Admin") {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }

    const { role } = req.body;
    const targetUserId = req.params.id;

    if (adminUser.id === targetUserId) {
      res.status(400).json({ success: false, error: "You cannot change your own role layout." });
      return;
    }

    // Ensure they belong to same org
    const targetUser = (await db.getUsers()).find(u => u.id === targetUserId && u.organization_id === adminUser.organization_id);
    if (!targetUser) {
      res.status(404).json({ success: false, error: "User not found in this workspace." });
      return;
    }

    await db.updateUser(targetUserId, { role });
    res.json({ success: true, message: "Role changed successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/users/:id/status", authenticateToken, async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (adminUser.role !== "Admin") {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }

    const { status } = req.body;
    const targetUserId = req.params.id;

    if (adminUser.id === targetUserId) {
      res.status(400).json({ success: false, error: "You cannot disable yourself." });
      return;
    }

    // Ensure same org
    const targetUser = (await db.getUsers()).find(u => u.id === targetUserId && u.organization_id === adminUser.organization_id);
    if (!targetUser) {
      res.status(404).json({ success: false, error: "User not found in this workspace." });
      return;
    }

    await db.updateUser(targetUserId, { status });
    res.json({ success: true, message: "User status updated." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Renaming yourself is fine (unlike role/status above) — there's no privilege or lockout risk in
// an Admin correcting their own display name, so this intentionally skips the "not on yourself" guard.
app.post("/api/admin/users/:id/name", authenticateToken, async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (adminUser.role !== "Admin") {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }

    const fullName = (req.body.full_name || "").trim();
    if (!fullName) {
      res.status(400).json({ success: false, error: "Ad Soyad boş olamaz." });
      return;
    }
    const targetUserId = req.params.id;

    const targetUser = (await db.getUsers()).find(u => u.id === targetUserId && u.organization_id === adminUser.organization_id);
    if (!targetUser) {
      res.status(404).json({ success: false, error: "User not found in this workspace." });
      return;
    }

    await db.updateUser(targetUserId, { full_name: fullName });
    res.json({ success: true, message: "İsim güncellendi." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// One-time cleanup for the "none_default" placeholder-id bug (see App.tsx / db.ts comments) —
// deletes any records that ended up scoped to that literal synthetic id in this org.
app.post("/api/admin/cleanup-orphaned-data", authenticateToken, async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (adminUser.role !== "Admin") {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
    const removed = await db.deleteOrphanedPlaceholderData(adminUser.organization_id);
    res.json({ success: true, removed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/users/:id/reset-password", authenticateToken, async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (adminUser.role !== "Admin") {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }

    const { newPassword } = req.body;
    const targetUserId = req.params.id;

    const targetUser = (await db.getUsers()).find(u => u.id === targetUserId && u.organization_id === adminUser.organization_id);
    if (!targetUser) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    await db.updateUser(targetUserId, {
      password_hash: hashPassword(newPassword)
    });

    res.json({ success: true, message: "User password reset completed." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/users/:id/resend-invite", authenticateToken, async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (adminUser.role !== "Admin") {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }

    const targetUserId = req.params.id;
    const targetUser = (await db.getUsers()).find(u => u.id === targetUserId && u.organization_id === adminUser.organization_id);
    if (!targetUser) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    const invitation = await db.createInvitation(adminUser.organization_id, targetUser.email, targetUser.role);
    const organization = (await db.getOrganizations()).find(o => o.id === adminUser.organization_id);
    await sendInvitationEmail(req, targetUser.email, organization?.organization_name || "Gemba Tools", invitation.invitation_token);

    res.json({ success: true, link: `/invite?token=${invitation.invitation_token}`, message: "Yenileme e-postası gönderildi." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/admin/users/:id", authenticateToken, async (req, res) => {
  try {
    const adminUser = (req as any).user;
    if (adminUser.role !== "Admin") {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }

    const targetUserId = req.params.id;
    if (adminUser.id === targetUserId) {
      res.status(400).json({ success: false, error: "You cannot delete your own account." });
      return;
    }

    // Same org check
    const targetUser = (await db.getUsers()).find(u => u.id === targetUserId && u.organization_id === adminUser.organization_id);
    if (!targetUser) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    await db.deleteUser(targetUserId);
    res.json({ success: true, message: "User deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// TENANT-ISOLATED BUSINESS API ENDPOINTS (COMPANIES, PROCESSES, GANTT, KAIZENS, AUDITS)

// 1. Customers (Companies)
app.get("/api/business/customers", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  let data = await db.getCustomers(user.organization_id);
  if (allowedCustomerIds !== null) {
    data = data.filter((c: any) => allowedCustomerIds.includes(c.id));
  }
  res.json({ success: true, data });
});

app.post("/api/business/customers", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    // Customer User accounts cannot create new customers, and may only edit their own.
    if (!req.body.id || !allowedCustomerIds.includes(req.body.id)) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  const saved = await db.saveCustomer(user.organization_id, req.body, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/customers/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if ((req as any).allowedCustomerIds !== null) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  await db.deleteCustomer(user.organization_id, req.params.id);
  res.json({ success: true });
});

// Consultant team assignment (1 primary + up to 2 secondary per customer)
app.post("/api/business/customers/:id/consultants", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: "Customer not found." });
    return;
  }
  const isAdmin = user.role === "Admin";
  const isPrimary = user.id === customer.primaryConsultantId;
  if (!isAdmin && !isPrimary) {
    res.status(403).json({ success: false, error: "Only an Admin or this customer's Primary Consultant can add a consultant." });
    return;
  }

  const consultantIds: string[] = customer.consultantIds || [];
  const pendingInvites = (await db.getInvitations()).filter(i => !i.accepted && i.customer_id === customer.id && i.role === "Consultant").length;
  const currentCount = (customer.primaryConsultantId ? 1 : 0) + consultantIds.length + pendingInvites;
  if (currentCount >= MAX_CONSULTANTS_PER_CUSTOMER) {
    res.status(400).json({ success: false, error: `Bu müşteride en fazla ${MAX_CONSULTANTS_PER_CUSTOMER} danışman görevli olabilir (bekleyen davetler dahil).` });
    return;
  }

  const emailClean = (req.body.email || "").toLowerCase().trim();
  if (!emailClean) {
    res.status(400).json({ success: false, error: "E-posta adresi gerekli." });
    return;
  }

  const existing = (await db.getUsers()).find(u => u.email === emailClean);
  if (existing) {
    if (existing.role !== "Consultant" && existing.role !== "Admin") {
      res.status(400).json({ success: false, error: "Bu kullanıcı zaten sistemde farklı bir rolle kayıtlı." });
      return;
    }
    if (!consultantIds.includes(existing.id) && existing.id !== customer.primaryConsultantId) {
      consultantIds.push(existing.id);
      await db.saveCustomer(user.organization_id, { id: customer.id, consultantIds }, user.id);
    }
    res.json({ success: true, message: "Danışman eklendi.", added: existing });
    return;
  }

  const invitation = await db.createInvitation(user.organization_id, emailClean, "Consultant", customer.id);
  res.json({ success: true, message: "Davet oluşturuldu.", link: `/invite?token=${invitation.invitation_token}`, invitation });
});

app.delete("/api/business/customers/:id/consultants/:userId", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: "Customer not found." });
    return;
  }
  const isAdmin = user.role === "Admin";
  const isPrimary = user.id === customer.primaryConsultantId;
  if (!isAdmin && !isPrimary) {
    res.status(403).json({ success: false, error: "Only an Admin or this customer's Primary Consultant can remove a consultant." });
    return;
  }
  const consultantIds: string[] = (customer.consultantIds || []).filter((id: string) => id !== req.params.userId);
  await db.saveCustomer(user.organization_id, { id: customer.id, consultantIds }, user.id);
  res.json({ success: true });
});

// Set (or clear) a customer's Primary Consultant. Nothing in this app ever wrote
// `primaryConsultantId` before this route existed — invitation acceptance and the "add consultant"
// route above both only ever add to `consultantIds` (secondary) — so for any customer whose primary
// was never set at creation, there was genuinely no way to assign one. Admin-only: this is an
// org-chart-level change (it changes who has `canManageConsultants` rights on the customer), not a
// routine team edit like adding a secondary consultant.
app.post("/api/business/customers/:id/set-primary-consultant", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin") {
    res.status(403).json({ success: false, error: "Only an Admin can assign the Primary Consultant." });
    return;
  }
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: "Customer not found." });
    return;
  }

  const consultantId = req.body.consultantId || null;
  if (consultantId) {
    const target = (await db.getUsers()).find(u => u.id === consultantId && u.organization_id === user.organization_id);
    if (!target || (target.role !== "Consultant" && target.role !== "Admin")) {
      res.status(400).json({ success: false, error: "Seçilen kullanıcı bu organizasyonda Danışman veya Yönetici rolünde değil." });
      return;
    }
  }

  // If the new primary was already a secondary consultant, drop them from that list — they now
  // occupy the primary slot instead, not both (avoids double-counting against the 3-seat cap).
  const consultantIds: string[] = (customer.consultantIds || []).filter((id: string) => id !== consultantId);
  await db.saveCustomer(user.organization_id, { id: customer.id, primaryConsultantId: consultantId, consultantIds }, user.id);
  res.json({ success: true });
});

// Customer User invitations (max 2 per customer), triggerable by Admin or any assigned consultant
app.post("/api/business/customers/:id/invite-customer-user", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: "Customer not found." });
    return;
  }
  const isAdmin = user.role === "Admin";
  const isAssignedConsultant = user.id === customer.primaryConsultantId || (customer.consultantIds || []).includes(user.id);
  if (!isAdmin && !isAssignedConsultant) {
    res.status(403).json({ success: false, error: "Only an Admin or a consultant assigned to this customer can invite a customer user." });
    return;
  }

  const customerUserIds: string[] = customer.customerUserIds || [];
  const pendingInvites = (await db.getInvitations()).filter(i => !i.accepted && i.customer_id === customer.id && i.role === "Customer User").length;
  if (customerUserIds.length + pendingInvites >= MAX_CUSTOMER_USER_INVITES_PER_CUSTOMER) {
    res.status(400).json({ success: false, error: `Bu müşteri için en fazla ${MAX_CUSTOMER_USER_INVITES_PER_CUSTOMER} müşteri kullanıcısı davet edilebilir (bekleyen davetler dahil).` });
    return;
  }

  const emailClean = (req.body.email || "").toLowerCase().trim();
  if (!emailClean) {
    res.status(400).json({ success: false, error: "E-posta adresi gerekli." });
    return;
  }

  const existing = (await db.getUsers()).find(u => u.email === emailClean);
  if (existing) {
    if (existing.role !== "Customer User") {
      res.status(400).json({ success: false, error: "Bu kullanıcı zaten sistemde farklı bir rolle kayıtlı." });
      return;
    }
    const assigned = new Set(existing.assigned_customer_ids || []);
    assigned.add(customer.id);
    await db.updateUser(existing.id, { assigned_customer_ids: Array.from(assigned) });
    if (!customerUserIds.includes(existing.id)) {
      await db.saveCustomer(user.organization_id, { id: customer.id, customerUserIds: [...customerUserIds, existing.id] }, user.id);
    }
    res.json({ success: true, message: "Müşteri kullanıcısı eklendi.", added: existing });
    return;
  }

  const invitation = await db.createInvitation(user.organization_id, emailClean, "Customer User", customer.id);
  const organization = (await db.getOrganizations()).find(o => o.id === user.organization_id);
  await sendInvitationEmail(req, emailClean, organization?.organization_name || "Gemba Tools", invitation.invitation_token);
  res.json({ success: true, message: "Davet e-postası gönderildi.", link: `/invite?token=${invitation.invitation_token}`, invitation });
});

// Resolves a customer's assigned team (primary/secondary consultants, customer users) into
// displayable name/email — the raw customer record only stores user ids.
app.get("/api/business/customers/:id/team", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null && !allowedCustomerIds.includes(req.params.id)) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: "Customer not found." });
    return;
  }
  const allUsers = await db.getUsers();
  const brief = (u: any) => u && { id: u.id, full_name: u.full_name, email: u.email };
  const primaryConsultant = brief(allUsers.find(u => u.id === customer.primaryConsultantId));
  const consultants = (customer.consultantIds || []).map((id: string) => brief(allUsers.find(u => u.id === id))).filter(Boolean);
  const customerUsers = (customer.customerUserIds || []).map((id: string) => brief(allUsers.find(u => u.id === id))).filter(Boolean);
  const pendingInvites = (await db.getInvitations()).filter(i => !i.accepted && i.customer_id === customer.id && new Date(i.expires_at) > new Date());
  const pendingConsultantInvites = pendingInvites.filter(i => i.role === "Consultant").map(i => ({ email: i.email }));
  const pendingCustomerUserInvites = pendingInvites.filter(i => i.role === "Customer User").map(i => ({ email: i.email }));
  res.json({ success: true, data: { primaryConsultant, consultants, customerUsers, pendingConsultantInvites, pendingCustomerUserInvites } });
});

// 1.1 Yamazumi Studies (Per Customer)
app.get("/api/business/yamazumi-studies", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.query.customerId as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getYamazumiStudies(user.organization_id, scope.factoryId) });
});

app.post("/api/business/yamazumi-studies", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.body.customerId);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const payload = { ...req.body, customerId: scope.factoryId || req.body.customerId };
  const saved = await db.saveYamazumiStudy(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/yamazumi-studies/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getYamazumiStudies(user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.customerId)) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  await db.deleteYamazumiStudy(user.organization_id, req.params.id);
  res.json({ success: true });
});

// 2. Processes
app.get("/api/business/processes", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getProcesses(user.organization_id, scope.factoryId) });
});

app.post("/api/business/processes", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const payload = { ...req.body };
  if (scope.factoryId && !payload.factory_id) {
    payload.factory_id = scope.factoryId;
  }
  const saved = await db.saveProcess(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/processes/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getProcesses(user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.factory_id || "arcelik_bolu")) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  await db.deleteProcess(user.organization_id, req.params.id);
  res.json({ success: true });
});

// 3. Gantt Activities (Timeline)
app.get("/api/business/gantt", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getActivities(user.organization_id, scope.factoryId) });
});

app.post("/api/business/gantt", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const payload = { ...req.body };
  if (scope.factoryId && !payload.factory_id) {
    payload.factory_id = scope.factoryId;
  }
  const saved = await db.saveActivity(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/gantt/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getActivities(user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.factory_id || "arcelik_bolu")) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  await db.deleteActivity(user.organization_id, req.params.id);
  res.json({ success: true });
});

// 4. Spaghetti Flow Segments
app.get("/api/business/segments", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getSegments(user.organization_id, scope.factoryId) });
});

app.post("/api/business/segments", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const payload = { ...req.body };
  if (scope.factoryId && !payload.factory_id) {
    payload.factory_id = scope.factoryId;
  }
  const saved = await db.saveSegment(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/segments/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getSegments(user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.factory_id || "arcelik_bolu")) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  await db.deleteSegment(user.organization_id, req.params.id);
  res.json({ success: true });
});

app.post("/api/business/segments/clear", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  await db.clearSegments(user.organization_id, scope.factoryId);
  res.json({ success: true });
});

// 5. Kaizens (Ideas Board)
app.get("/api/business/kaizens", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getKaizens(user.organization_id, scope.factoryId) });
});

app.post("/api/business/kaizens", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const payload = { ...req.body };
  // The customer comes from the scoped x-factory-id header, never from the body — a restricted user
  // could otherwise write into another customer by naming its id. Unrestricted users (no header)
  // keep the body's value, as before.
  if (scope.factoryId) payload.factory_id = scope.factoryId;
  const existing = payload.id ? await db.getKaizenById(user.organization_id, String(payload.id)) : null;
  if (existing) {
    // An update may not move a project to another customer, nor touch one the caller can't see.
    const existingFactory = existing.factory_id || "arcelik_bolu";
    if (!canAccessFactory(req, existingFactory) || (payload.factory_id && payload.factory_id !== existingFactory)) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
    // Server-owned fields: the project number is fixed at creation.
    payload.projectNo = existing.projectNo;
    payload.projectSeq = existing.projectSeq;
    payload.created_by = existing.created_by;
    payload.created_at = existing.created_at;
  } else {
    Object.assign(payload, await db.nextKaizenProjectNo(user.organization_id, payload.factory_id, payload.dateProposed));
  }
  const saved = await db.saveKaizen(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/kaizens/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  // CI projects are deleted only by Admin / Consultant; customer users (project leader or member)
  // edit and remove items inside a project but never the project itself.
  if (!isStaff(user)) {
    res.status(403).json({ success: false, error: "CI projesini yalnızca Admin veya Danışman silebilir." });
    return;
  }
  const existing = await db.getKaizenById(user.organization_id, req.params.id);
  if (!existing || !canAccessFactory(req, existing.factory_id || "arcelik_bolu")) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  await db.deleteKaizen(user.organization_id, req.params.id);
  res.json({ success: true });
});

// 5b. COPQ Snapshots (Loss Capacity Analizi historical trend tracking)
app.get("/api/business/copq-snapshots", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getCopqSnapshots(user.organization_id, scope.factoryId) });
});

app.post("/api/business/copq-snapshots", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const payload = { ...req.body };
  if (scope.factoryId && !payload.factory_id) {
    payload.factory_id = scope.factoryId;
  }
  const saved = await db.saveCopqSnapshot(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/copq-snapshots/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getCopqSnapshots(user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.factory_id)) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  await db.deleteCopqSnapshot(user.organization_id, req.params.id);
  res.json({ success: true });
});

// 5c. Loss Capacity Analizi module settings — one record per customer (unit cost rates, industry
// benchmark choice, COPQ/improvement/investment overrides, real financial data overrides, what-if
// sliders — the module's entire tunable state, so it survives session resets per customer)
app.get("/api/business/loss-capacity-settings", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getLossCapacitySettings(user.organization_id, scope.factoryId) });
});

app.post("/api/business/loss-capacity-settings", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  if (!scope.factoryId) {
    res.status(400).json({ success: false, error: "x-factory-id header is required." });
    return;
  }
  const saved = await db.saveLossCapacitySettings(user.organization_id, scope.factoryId, req.body.settings || {}, user.id);
  res.json({ success: true, data: saved });
});

// 5d. Master Plan Gantt module state — weekly consulting-package capacity + custom project plans
// (soft-deleted ones kept inline for the trash bin), one blob per customer.
app.get("/api/business/master-plan-state", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getMasterPlanState(user.organization_id, scope.factoryId) });
});

app.post("/api/business/master-plan-state", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  if (!scope.factoryId) {
    res.status(400).json({ success: false, error: "x-factory-id header is required." });
    return;
  }
  const saved = await db.saveMasterPlanState(user.organization_id, scope.factoryId, req.body.state || {}, user.id);
  res.json({ success: true, data: saved });
});

// Company Workspace (Proje Ekibi / Şirket Profili / Varlık Kaydı / Zaman Çizelgesi / Doküman
// Kasası / Proje Portföyü) — one record per customer. See db.ts for why this replaced the
// client-only localStorage version.
app.get("/api/business/company-workspace", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getCompanyWorkspace(user.organization_id, scope.factoryId) });
});

app.post("/api/business/company-workspace", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  if (!scope.factoryId) {
    res.status(400).json({ success: false, error: "x-factory-id header is required." });
    return;
  }
  const saved = await db.saveCompanyWorkspace(user.organization_id, scope.factoryId, req.body.workspace || {}, user.id);
  res.json({ success: true, data: saved });
});

// 5d. Spaghetti Akış Sketcher module state — one record per customer (scenarios/layouts/nodes/
// flows drawing model, editable flow-type & vertical-transfer cost coefficients, financial
// parameters), so the whole module survives session resets per customer.
app.get("/api/business/spaghetti-flow-settings", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getSpaghettiFlowSettings(user.organization_id, scope.factoryId) });
});

app.post("/api/business/spaghetti-flow-settings", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  if (!scope.factoryId) {
    res.status(400).json({ success: false, error: "x-factory-id header is required." });
    return;
  }
  const saved = await db.saveSpaghettiFlowSettings(user.organization_id, scope.factoryId, req.body.data || {}, user.id);
  res.json({ success: true, data: saved });
});

// 6b. Time Study saved studies (Zaman Etüdü) — one record per saved measurement, optionally
// linked back to a VSM process/station for traceability.
app.get("/api/business/time-studies", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getTimeStudies(user.organization_id, scope.factoryId) });
});

app.post("/api/business/time-studies", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const payload = { ...req.body };
  if (scope.factoryId && !payload.factory_id) {
    payload.factory_id = scope.factoryId;
  }
  const saved = await db.saveTimeStudy(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/time-studies/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getTimeStudies(user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.factory_id)) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  await db.deleteTimeStudy(user.organization_id, req.params.id);
  res.json({ success: true });
});

// 6c. SMED projects — one record per kalıp/setup değişim project (activities + action cards
// embedded), optionally linked back to a VSM process for OEE/setup-time traceability.
app.get("/api/business/smed-projects", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getSmedProjects(user.organization_id, scope.factoryId) });
});

app.post("/api/business/smed-projects", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const payload = { ...req.body };
  if (scope.factoryId && !payload.factory_id) {
    payload.factory_id = scope.factoryId;
  }
  const saved = await db.saveSmedProject(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/smed-projects/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getSmedProjects(user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.factory_id)) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  await db.deleteSmedProject(user.organization_id, req.params.id);
  res.json({ success: true });
});

// 6d. Proje Takip Raporu (PTR) — one record per weekly visit/action row, list-per-customer.
app.get("/api/business/ptr-records", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getPtrRecords(user.organization_id, scope.factoryId) });
});

// Accepts either a single record object (row-level save) or an array (debounced full-list sync
// from the spreadsheet-style table, so 100+ edited rows can be persisted in one request).
app.post("/api/business/ptr-records", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const applyScope = async (record: any) => {
    const payload = { ...record };
    if (scope.factoryId && !payload.factory_id) {
      payload.factory_id = scope.factoryId;
    }
    return await db.savePtrRecord(user.organization_id, payload, user.id);
  };
  if (Array.isArray(req.body)) {
    const saved = await Promise.all(req.body.map(applyScope));
    res.json({ success: true, data: saved });
    return;
  }
  const saved = await applyScope(req.body);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/ptr-records/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getPtrRecords(user.organization_id)).find((r: any) => String(r.id) === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.factory_id)) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  await db.deletePtrRecord(user.organization_id, req.params.id);
  res.json({ success: true });
});

// Danışman Faaliyet Özeti — per-consultant free-text note for a given ISO week, shown in PTR's
// Haftalık OPEX Faaliyet Raporu tab and folded into the weekly report email body.
app.get("/api/business/weekly-consultant-notes", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const week = req.query.week as string;
  const year = parseInt(req.query.year as string, 10);
  if (!week || !year) {
    res.status(400).json({ success: false, error: "week and year query params are required." });
    return;
  }
  res.json({ success: true, data: await db.getWeeklyConsultantNotes(user.organization_id, scope.factoryId, week, year) });
});

app.post("/api/business/weekly-consultant-notes", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const { week, year, runs, note } = req.body;
  if (!week || !year) {
    res.status(400).json({ success: false, error: "week and year are required." });
    return;
  }
  // Prefer structured `runs` from the rich-text editor (see buildNoteHtmlFromRuns — the client
  // never sends raw HTML); fall back to a plain-text `note` string for any caller that doesn't.
  const noteHtml = runs !== undefined
    ? buildNoteHtmlFromRuns(runs)
    : buildNoteHtmlFromPlainText(typeof note === "string" ? note : "");
  const saved = await db.saveWeeklyConsultantNote(
    user.organization_id,
    { factory_id: scope.factoryId, week, year, note: noteHtml },
    user.id,
    user.full_name
  );
  res.json({ success: true, data: saved });
});

app.delete("/api/business/weekly-consultant-notes/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  const existing = await db.getWeeklyConsultantNoteById(user.organization_id, req.params.id);
  if (existing) {
    if (allowedCustomerIds !== null && !allowedCustomerIds.includes(existing.factory_id)) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
    if (existing.consultant_id !== user.id && user.role !== "Admin") {
      res.status(403).json({ success: false, error: "Sadece kendi notunuzu silebilirsiniz." });
      return;
    }
  }
  await db.deleteWeeklyConsultantNote(user.organization_id, req.params.id);
  res.json({ success: true });
});

// Ticket / İyileştirme Takip — internal feedback about gemba-tools itself, org-wide (not per
// customer/factory). Admin + Consultant only; a Customer User hitting these directly (not just
// via a hidden UI tab) is rejected here too.
app.get("/api/business/tickets", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin" && user.role !== "Consultant") {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getTickets(user.organization_id) });
});

app.post("/api/business/tickets", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin" && user.role !== "Consultant") {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const saved = await db.saveTicket(user.organization_id, req.body, user.id, user.full_name);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/tickets/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin" && user.role !== "Consultant") {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  await db.deleteTicket(user.organization_id, req.params.id);
  res.json({ success: true });
});

// 6e. Proje Takip Raporu — real Excel export cloned from the firm's actual reporting template
// (native PivotTables + charts intact, live PTR data injected). Optional ?week=NN filters to a
// single visit week (used by the "Mail Gönder" attachment).
app.get("/api/business/ptr-records/export-template-excel", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  if (!isPtrTemplateAvailable()) {
    res.status(503).json({ success: false, error: "Proje Takip Raporu şablon dosyası bulunamadı. PTR_EXCEL_TEMPLATE_PATH ortam değişkenini kontrol edin." });
    return;
  }
  let records: PtrTemplateRecord[] = await db.getPtrRecords(user.organization_id, scope.factoryId);
  const weekFilter = req.query.week as string | undefined;
  if (weekFilter) {
    records = records.filter(r => r.visitedWeek === weekFilter);
  }
  if (records.length === 0) {
    res.status(400).json({ success: false, error: "Aktarılacak kayıt bulunamadı." });
    return;
  }
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === scope.factoryId);
  const customerName = customer?.companyName || "Müşteri";
  try {
    const buffer = await generatePtrTemplateExcel(records, customerName);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(buildPtrExportFilename(customerName))}"`);
    res.send(buffer);
  } catch (e: any) {
    console.error("Failed to generate PTR template Excel", e);
    res.status(500).json({ success: false, error: "Excel raporu oluşturulamadı: " + (e.message || "bilinmeyen hata") });
  }
});

// Plain text (consultant names, fixed template wording) interpolated into the HTML email body
// below — the Danışman Faaliyet Özeti note itself never needs this, see buildNoteHtmlFromRuns.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Danışman Faaliyet Özeti's basic-rich-text note (bold/italic/underline/font size/color — see
// PtrTimeStudy.tsx's contentEditable editor + toolbar): the client never sends raw HTML. It sends
// "runs" — plain text pieces tagged with which formatting applies — and this function is the ONLY
// place that ever builds real markup, entirely from validated primitives (text is always escaped;
// color/fontSize are checked against a strict pattern/range, anything else is silently dropped).
// This is deliberately not "sanitize arbitrary HTML the client sent" (that needs a real HTML
// parser/sanitizer library) but "validate data and build safe HTML ourselves" — there's no
// attacker-controlled markup to parse in the first place. Matters because this note is (a) rendered
// to other logged-in users via dangerouslySetInnerHTML and (b) becomes the HTML body of the real
// weekly report email sent to the customer once "Gönder" is used.
interface NoteRun { text?: unknown; break?: unknown; bold?: unknown; italic?: unknown; underline?: unknown; color?: unknown; fontSize?: unknown }
const NOTE_COLOR_PATTERN = /^(#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i;
const MAX_NOTE_RUNS = 2000;
const MAX_NOTE_RUN_TEXT = 5000;

function buildNoteHtmlFromRuns(runs: unknown): string {
  if (!Array.isArray(runs)) return "";
  let html = "";
  let count = 0;
  for (const raw of runs) {
    if (count >= MAX_NOTE_RUNS) break;
    if (!raw || typeof raw !== "object") continue;
    const run = raw as NoteRun;
    if (run.break) { html += "<br>"; count++; continue; }
    const text = typeof run.text === "string" ? run.text.slice(0, MAX_NOTE_RUN_TEXT) : "";
    if (!text) continue;
    let inner = escapeHtml(text);
    if (run.underline) inner = `<u>${inner}</u>`;
    if (run.italic) inner = `<i>${inner}</i>`;
    if (run.bold) inner = `<b>${inner}</b>`;
    const styles: string[] = [];
    if (typeof run.color === "string" && NOTE_COLOR_PATTERN.test(run.color.trim())) {
      styles.push(`color:${run.color.trim()}`);
    }
    if (typeof run.fontSize === "number" && Number.isFinite(run.fontSize) && run.fontSize >= 8 && run.fontSize <= 40) {
      styles.push(`font-size:${Math.round(run.fontSize)}px`);
    }
    if (styles.length > 0) inner = `<span style="${styles.join(";")}">${inner}</span>`;
    html += inner;
    count++;
  }
  return html;
}

// Legacy fallback for a plain-text `note` string (notes saved before this feature existed, or any
// direct API caller that doesn't send `runs`) — escaped and newline-converted, never parsed as HTML.
function buildNoteHtmlFromPlainText(note: string): string {
  return escapeHtml(note).replace(/\r\n|\r|\n/g, "<br>");
}

// Shared by the actual send route and the preview-only route below, so the preview the user sees
// in the Danışman Faaliyet Özeti card is guaranteed to be exactly what gets emailed — no separate
// template copy to drift out of sync. Returns an HTML body (not plain text) so the Danışman Faaliyet
// Özeti's rich-text formatting survives into the actual email, not just the in-app preview.
async function buildWeeklyReportEmailContent(orgId: string, factoryId: string, week: string, year: number | null, customerName: string): Promise<{ subject: string; body: string }> {
  const shortName = customerName.trim().split(/\s+/)[0] || customerName;
  const subject = `[PTR] ${shortName} W${week} Proje Raporu`;

  // Danışman Faaliyet Özeti: fold each consultant's free-text weekly note directly into the email
  // body (not just the Excel attachment) so the customer sees this week's work without opening the
  // file. Only ever populated when `week`/`year` match a week consultants actually wrote notes for.
  let notesSection = "";
  if (year) {
    // note is already safe HTML (built by buildNoteHtmlFromRuns/buildNoteHtmlFromPlainText at save
    // time — see the POST route) — strip tags just for the "is this actually empty" check, a
    // visually-empty contentEditable note can still serialize as e.g. a lone "<br>".
    const weeklyNotes = (await db.getWeeklyConsultantNotes(orgId, factoryId, String(week), Number(year)))
      .filter((n: any) => (n.note || "").replace(/<[^>]+>/g, "").trim());
    if (weeklyNotes.length > 0) {
      const notesList = weeklyNotes
        .map((n: any) => `<p><strong>${escapeHtml(n.consultant_name || "Danışman")}:</strong><br>${n.note}</p>`)
        .join("");
      notesSection = `<p><strong>${escapeHtml(week)}. Hafta Danışman Faaliyet Özeti:</strong></p>${notesList}`;
    }
  }

  const body = `<p>Sayın İlgililer,</p><p>${escapeHtml(week)}. hafta ziyareti sırasında yapılan çalışma ve aksiyon raporu ektedir. Lütfen termin tarihlerine uyum sağlamaya özen gösteriniz.</p>${notesSection}<p>Saygılarımızla,<br>Gemba Partner</p>`;
  return { subject, body };
}

// 6f-preview. Preview only — returns the exact subject/body the send route below would email, with
// no PTR template/records requirement, so the UI (Haftalık OPEX Faaliyet Raporu tab's Danışman
// Faaliyet Özeti card) can show a WYSIWYG preview before actually sending anything.
app.get("/api/business/ptr-records/weekly-report-preview", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const week = req.query.week as string;
  const year = parseInt(req.query.year as string, 10);
  if (!week || !year) {
    res.status(400).json({ success: false, error: "week and year query params are required." });
    return;
  }
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === scope.factoryId);
  const customerName = customer?.companyName || "Müşteri";
  const { subject, body } = await buildWeeklyReportEmailContent(user.organization_id, scope.factoryId, week, year, customerName);
  res.json({ success: true, data: { subject, body } });
});

// 6f-log. Archived history of actually-sent weekly report emails (subject/body/recipients
// snapshot, one row per week/year) — see db.saveWeeklyReportMailLogEntry. Kept separate from the
// live-editable Danışman Faaliyet Özeti draft notes so what was actually sent stays visible even
// if a consultant later edits or deletes their draft note for that week.
app.get("/api/business/ptr-records/weekly-report-mail-log", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getWeeklyReportMailLog(user.organization_id, scope.factoryId) });
});

// 6f. "Mail Gönder" — sends that week's visit report (real template Excel attached) to the
// customer from the shared project mailbox. Honestly reports when SMTP isn't configured rather
// than pretending success (see sendMail()).
app.post("/api/business/ptr-records/send-weekly-report", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const { week, year, to, cc } = req.body;
  const toList: string[] = Array.isArray(to) ? to.filter(Boolean) : (to ? [to] : []);
  if (!week || toList.length === 0) {
    res.status(400).json({ success: false, error: "Hafta ve en az bir alıcı (proje ekibi) gereklidir." });
    return;
  }
  if (!isPtrTemplateAvailable()) {
    res.status(503).json({ success: false, error: "Proje Takip Raporu şablon dosyası bulunamadı. PTR_EXCEL_TEMPLATE_PATH ortam değişkenini kontrol edin." });
    return;
  }
  // Full cumulative log, not just this week's rows — the real template's Dashboard/Pivot sheets
  // summarize the whole project, so feeding them only one week's slice left those sheets (and the
  // report as a whole) looking empty/incomplete. "week" is still used below for the subject line
  // ("as of week N"), just no longer filters which rows go into the attachment.
  const records: PtrTemplateRecord[] = await db.getPtrRecords(user.organization_id, scope.factoryId);
  if (records.length === 0) {
    res.status(400).json({ success: false, error: "Gönderilecek proje takip kaydı bulunamadı." });
    return;
  }
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === scope.factoryId);
  const customerName = customer?.companyName || "Müşteri";

  // Cc always carries the customer's assigned consultants (real assignment — primaryConsultantId
  // + consultantIds, same as the weekly digest cron) plus a.zehir@gembapartner.com, on every send.
  const allUsers = await db.getUsers();
  const consultantIds: string[] = [
    ...(customer?.primaryConsultantId ? [customer.primaryConsultantId] : []),
    ...(customer?.consultantIds || [])
  ];
  const consultantEmails = consultantIds
    .map(id => allUsers.find(u => u.id === id)?.email)
    .filter((e): e is string => !!e);
  const ccList = Array.from(new Set([
    ...(Array.isArray(cc) ? cc.filter(Boolean) : (cc ? [cc] : [])),
    ...consultantEmails,
    "a.zehir@gembapartner.com"
  ]));

  try {
    const buffer = await generatePtrTemplateExcel(records, customerName);
    const { subject, body } = await buildWeeklyReportEmailContent(user.organization_id, scope.factoryId!, week, year ? Number(year) : null, customerName);
    const result = await sendMail({
      to: toList,
      cc: ccList,
      subject,
      html: body,
      attachments: [{ filename: buildPtrExportFilename(customerName), content: buffer }]
    });
    if (!result.success) {
      res.status(503).json(result);
      return;
    }
    // Archive exactly what was sent, keyed by week/year, so it stays visible even if the
    // Danışman Faaliyet Özeti draft notes it was built from are later edited/deleted.
    if (year) {
      await db.saveWeeklyReportMailLogEntry(
        user.organization_id,
        { factory_id: scope.factoryId!, week: String(week), year: Number(year), subject, body, to: toList, cc: ccList },
        user.id,
        user.full_name
      );
    }
    res.json({ success: true });
  } catch (e: any) {
    console.error("Failed to send PTR weekly report email", e);
    res.status(500).json({ success: false, error: "Rapor e-postası gönderilemedi: " + (e.message || "bilinmeyen hata") });
  }
});

// 6g. Weekly consultant digest — Vercel Cron hits this on a schedule (see vercel.json "crons"),
// no logged-in user involved, so it's gated by CRON_SECRET instead of authenticateToken. For
// every customer, mails each assigned @gembapartner.com consultant (customer.primaryConsultantId
// + customer.consultantIds — the real assignment, not a name-matching heuristic) a summary of:
//   1. 30+ gündür kapanmayan aksiyonlar (same staleness rule as the in-app weekly report tab)
//   2. Termini geçmiş, henüz kapanmamış iyileştirme projeleri (dueDate < today, status açık)
//   3. Kritik öneme sahip açık maddeler (the Outlook-style red flag toggled on in the PTR table)
// One email per (consultant, customer) pair — subject line is per-customer, so this can't be
// collapsed into one aggregate email per consultant. Customers with nothing to report are
// skipped entirely — no empty "all clear" emails. Sent from proje@gembapartner.com (sendMail's
// own default, matching the existing "Mail Gönder" PTR export).
// The rules themselves (and the tolerant date/status reading) live in ptrDigest.ts so this job and
// the admin diagnostics endpoint below can never disagree.

// Consultants of a customer that the digest will actually mail: the real assignment (primary +
// secondary), restricted to @gembapartner.com addresses.
function digestRecipients(customer: any, allUsers: User[]) {
  const ids: string[] = [...(customer.primaryConsultantId ? [customer.primaryConsultantId] : []), ...(customer.consultantIds || [])];
  return ids.map(id => {
    const u = allUsers.find(x => x.id === id);
    if (!u) return { id, name: "(kullanıcı bulunamadı)", email: "", eligible: false, reason: "Atanmış danışman kullanıcı kaydı yok" };
    const ok = u.email.toLowerCase().endsWith("@gembapartner.com");
    return { id, name: u.full_name, email: u.email, eligible: ok, reason: ok ? "" : "E-posta @gembapartner.com değil" };
  });
}

app.get("/api/cron/weekly-consultant-digest", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(503).json({ success: false, error: "CRON_SECRET ortam değişkeni tanımlı değil." });
    return;
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ success: false, error: "Unauthorized." });
    return;
  }

  try {
    const allUsers = await db.getUsers();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results: { consultant: string; customer: string; success: boolean; error?: string }[] = [];
    const skipped: { customer: string; reason: string }[] = [];
    const formatItem = (r: any) => `   - ${r.workDone || r.improvementSubject || "(açıklama yok)"} — Sorumlu: ${r.responsible || "—"}, Termin: ${r.dueDate || "belirtilmemiş"}`;

    const organizations = await db.getOrganizations();
    for (const org of organizations) {
      const customers = await db.getCustomers(org.id);
      for (const customer of customers) {
        const customerName = customer.companyName || "Müşteri";
        // One customer's bad data or failure must never stop the customers after it — previously a
        // single record with an unreadable date threw out of the whole loop and every later
        // customer silently got nothing.
        try {
          const recipients = digestRecipients(customer, allUsers);
          if (recipients.length === 0) { skipped.push({ customer: customerName, reason: "Müşteriye atanmış danışman yok" }); continue; }
          const consultants = recipients.filter(r => r.eligible).map(r => allUsers.find(u => u.id === r.id)!) as User[];
          if (consultants.length === 0) { skipped.push({ customer: customerName, reason: "Atanmış danışmanların hiçbiri @gembapartner.com e-postalı değil" }); continue; }

          const records = await db.getPtrRecords(org.id, customer.id);
          const { overdue, missedTermin, critical } = analyzePtrRecords(records, today);
          if (overdue.length === 0 && missedTermin.length === 0 && critical.length === 0) {
            skipped.push({ customer: customerName, reason: records.length === 0 ? "Bu müşteriye bağlı PTR kaydı yok" : "Kurala uyan madde yok" });
            continue;
          }

          // "Çelikel Tarım Ekipmanları San. Tic. A.Ş." -> "Çelikel", "Mazsan Makina San Tic A.Ş" ->
          // "Mazsan" — same first-word rule used by the "Mail Gönder" report subject.
          const shortName = customerName.trim().split(/\s+/)[0] || customerName;

          const parts: string[] = [];
          if (overdue.length > 0) {
            parts.push(`🔴 30+ Gündür Kapanmayan Aksiyonlar (${overdue.length}):`, ...overdue.map(formatItem));
          }
          if (missedTermin.length > 0) {
            parts.push(`⏰ Termini Geçmiş İyileştirme Projeleri (${missedTermin.length}):`, ...missedTermin.map(formatItem));
          }
          if (critical.length > 0) {
            parts.push(`🚩 Kritik Öneme Sahip Açık Maddeler (${critical.length}):`, ...critical.map(formatItem));
          }

          for (const consultant of consultants) {
            const body = `Sayın ${consultant.full_name},\n\n${customerName} için takip gerektiren maddeler bulunmaktadır:\n\n${parts.join("\n")}\n\nBu otomatik haftalık hatırlatma Proje Takip Raporu modülünden gönderilmiştir.`;
            const result = await sendMail({
              to: consultant.email,
              subject: `[${shortName}- ] Haftalık Özet`,
              text: body
            });
            results.push({ consultant: consultant.email, customer: customerName, success: result.success, error: result.error });
          }
        } catch (e: any) {
          console.error(`Weekly digest failed for customer "${customerName}"`, e);
          results.push({ consultant: "-", customer: customerName, success: false, error: e?.message || "bilinmeyen hata" });
        }
      }
    }

    res.json({ success: true, sent: results.filter(r => r.success).length, results, skipped });
  } catch (e: any) {
    console.error("Failed to run weekly consultant digest", e);
    res.status(500).json({ success: false, error: e.message || "Haftalık hatırlatma çalıştırılamadı." });
  }
});

// Admin-only dry run of the digest: for every customer of the organization, shows who would be
// mailed, what the rules found, and — when nothing would be sent — exactly which gate stopped it
// (no consultant / not @gembapartner.com / no PTR records under this customer / no matching item /
// dates the reader could not understand). Sends nothing.
app.get("/api/admin/weekly-digest-diagnostics", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin") {
    res.status(403).json({ success: false, error: "Yalnızca Admin görüntüleyebilir." });
    return;
  }
  try {
    const [allUsers, customers, allRecords] = await Promise.all([db.getUsers(), db.getCustomers(user.organization_id), db.getPtrRecords(user.organization_id)]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const customerIds = new Set(customers.map((c: any) => c.id));

    const rows = customers.map((customer: any) => {
      const recipients = digestRecipients(customer, allUsers);
      const records = allRecords.filter((r: any) => r.factory_id === customer.id);
      const a = analyzePtrRecords(records, today);
      const eligible = recipients.filter(r => r.eligible);
      let blockedBy: string | null = null;
      if (recipients.length === 0) blockedBy = "Müşteri kartında atanmış danışman yok";
      else if (eligible.length === 0) blockedBy = "Atanmış danışmanların hiçbiri @gembapartner.com e-postalı değil";
      else if (records.length === 0) blockedBy = "Bu müşteri koduna bağlı PTR kaydı yok (kayıtlar başka bir kod altında olabilir — aşağıdaki sahipsiz kayıtlara bakın)";
      else if (a.overdue.length + a.missedTermin.length + a.critical.length === 0) {
        blockedBy = a.unparsableDueDates + a.unparsableWorkDates > 0
          ? "Kurala uyan madde bulunamadı, ancak bazı tarihler okunamadı (aşağıdaki örneklere bakın)"
          : "Kurala uyan madde yok";
      }
      return {
        customerId: customer.id,
        customerName: customer.companyName || "Müşteri",
        recipients,
        recordCount: records.length,
        statusCounts: a.statusCounts,
        overdue30: a.overdue.length,
        missedTermin: a.missedTermin.length,
        critical: a.critical.length,
        unparsableWorkDates: a.unparsableWorkDates,
        unparsableDueDates: a.unparsableDueDates,
        badDateSamples: a.badDateSamples,
        wouldSend: blockedBy === null,
        blockedBy,
      };
    });

    const orphans: Record<string, number> = {};
    allRecords.filter((r: any) => !customerIds.has(r.factory_id)).forEach((r: any) => {
      const k = String(r.factory_id ?? "(boş)");
      orphans[k] = (orphans[k] || 0) + 1;
    });

    res.json({ success: true, data: { customers: rows, orphanRecords: Object.entries(orphans).map(([factoryId, count]) => ({ factoryId, count })) } });
  } catch (e: any) {
    console.error("Weekly digest diagnostics failed", e);
    res.status(500).json({ success: false, error: e.message || "Teşhis çalıştırılamadı." });
  }
});

// 6f. 5S Audit module — ported from a legacy Power Apps app that ran this same facility-hierarchy
// / question-bank / audit-scoring / Gemba Walk workflow for one plant. Simple entities (setup data)
// use the generic FiveS collection CRUD in db.ts directly; the audit-scoring workflow gets its own
// routes below since saving answers/completing an audit involves real server-side computation
// (score rollups, one-way status transitions) that a plain CRUD upsert can't express.

async function fiveSAccessCheck(req: express.Request, res: express.Response, collection: Parameters<typeof db.getFiveSRecords>[0], id: string): Promise<boolean> {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds === null) return true;
  const existing = (await db.getFiveSRecords(collection, user.organization_id)).find((r: any) => r.id === id);
  if (!existing || !allowedCustomerIds.includes(existing.factory_id)) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return false;
  }
  return true;
}

// -- Departments (Bölüm), Areas (Alan), Personnel (Ekip Listesi), Questions (Denetim Soruları),
//    Problem Categories, Gemba Walk findings: identical generic CRUD shape.
const FIVE_S_SIMPLE_ENTITIES: { path: string; collection: Parameters<typeof db.getFiveSRecords>[0] }[] = [
  { path: "departments", collection: "five_s_departments" },
  { path: "areas", collection: "five_s_areas" },
  { path: "personnel", collection: "five_s_personnel" },
  { path: "questions", collection: "five_s_questions" },
  { path: "problem-categories", collection: "five_s_problem_categories" },
  { path: "gemba-walk", collection: "gemba_walk_findings" }
];

for (const { path, collection } of FIVE_S_SIMPLE_ENTITIES) {
  app.get(`/api/business/five-s/${path}`, authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
    if (path === "departments" && scope.factoryId) {
      await db.ensureFiveSDefaults(user.organization_id, scope.factoryId, user.id);
    }
    res.json({ success: true, data: await db.getFiveSRecords(collection, user.organization_id, scope.factoryId) });
  });

  app.post(`/api/business/five-s/${path}`, authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
    const saved = await db.saveFiveSRecord(collection, user.organization_id, scope.factoryId || "", { ...req.body }, user.id);
    res.json({ success: true, data: saved });
  });

  app.delete(`/api/business/five-s/${path}/:id`, authenticateToken, async (req, res) => {
    const user = (req as any).user;
    if (!(await fiveSAccessCheck(req, res, collection, req.params.id))) return;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (scope.factoryId) {
      const blockReason = await db.getFiveSDeleteBlockReason(collection, user.organization_id, req.params.id, scope.factoryId);
      if (blockReason) {
        res.status(400).json({ success: false, error: blockReason });
        return;
      }
    }
    await db.deleteFiveSRecord(collection, user.organization_id, req.params.id);
    res.json({ success: true });
  });
}

// -- Audits (Denetimler): list, bulk-generate (Denetim Takvimi), delete (cascades), complete.
app.get("/api/business/five-s/audits", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getFiveSRecords("five_s_audits", user.organization_id, scope.factoryId) });
});

app.post("/api/business/five-s/audits/bulk-generate", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const { startDate, endDate, frequencyDays } = req.body;
  if (!startDate || !endDate || !frequencyDays) {
    res.status(400).json({ success: false, error: "Başlangıç/bitiş tarihi ve frekans gereklidir." });
    return;
  }
  const created = await db.bulkGenerateFiveSAudits(user.organization_id, scope.factoryId, startDate, endDate, Number(frequencyDays), user.id);
  res.json({ success: true, data: created });
});

app.delete("/api/business/five-s/audits/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (!(await fiveSAccessCheck(req, res, "five_s_audits", req.params.id))) return;
  await db.deleteFiveSAudit(user.organization_id, req.params.id);
  res.json({ success: true });
});

app.post("/api/business/five-s/audits/:id/complete", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (!(await fiveSAccessCheck(req, res, "five_s_audits", req.params.id))) return;
  const result = await db.completeFiveSAudit(user.organization_id, req.params.id);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json({ success: true, data: result.audit });
});

// -- Team assignments (Denetim Ekibi): list + batch save (one auditor per area per audit).
app.get("/api/business/five-s/team-assignments", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getFiveSRecords("five_s_team_assignments", user.organization_id, scope.factoryId) });
});

app.post("/api/business/five-s/audits/:auditId/team", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const assignments = req.body.assignments as { areaId: string; auditorName: string; auditorId?: string }[];
  if (!Array.isArray(assignments)) {
    res.status(400).json({ success: false, error: "assignments dizisi gereklidir." });
    return;
  }
  const saved = await db.saveFiveSTeamAssignments(user.organization_id, scope.factoryId, req.params.auditId, assignments, user.id);
  res.json({ success: true, data: saved });
});

// -- Answers (Denetim Cevapları) + Results (Denetim Sonuçları): read routes for both, plus the
//    single "save this area's scored questions for one S-level" write operation.
app.get("/api/business/five-s/answers", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getFiveSRecords("five_s_answers", user.organization_id, scope.factoryId) });
});

// Lets the global Actions List edit a single answer's remediation fields (action/status/dates)
// without re-running the whole scoring save — a partial payload with the record's id merges in.
app.post("/api/business/five-s/answers", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const saved = await db.saveFiveSRecord("five_s_answers", user.organization_id, scope.factoryId || "", { ...req.body }, user.id);
  res.json({ success: true, data: saved });
});

app.get("/api/business/five-s/results", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getFiveSRecords("five_s_results", user.organization_id, scope.factoryId) });
});

app.post("/api/business/five-s/audits/:auditId/areas/:areaId/save-answers", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const { level, answers } = req.body;
  if (!level || !Array.isArray(answers) || answers.length === 0) {
    res.status(400).json({ success: false, error: "Seviye ve en az bir cevap gereklidir." });
    return;
  }
  if (answers.some((a: any) => a.score === undefined || a.score === null)) {
    res.status(400).json({ success: false, error: "Tüm sorular puanlanmadan kaydedilemez." });
    return;
  }
  const result = await db.saveFiveSAreaLevelAnswers(
    user.organization_id, scope.factoryId, req.params.auditId, req.params.areaId, level, answers, user.id
  );
  res.json({ success: true, data: result });
});

// -- Report emailing: the legacy app called out to a Power Automate flow that rendered a Word
// template and attached it; there's no Flow infrastructure here, so this generates a plain .xlsx
// summary (same "real file, real email" approach already proven for the PTR weekly report) and
// sends it via the shared sendMail() helper.
// Shared report builders — used by both the "Mail Gönder" (email attachment) and "İndir" (direct
// download) routes for each report, so the two paths can never drift into showing different content.
async function buildFiveSAuditReportBuffer(orgId: string, factoryId: string, auditId: string): Promise<{ buffer: Buffer; filename: string; customerName: string; error?: string; status?: number } > {
  const audit = (await db.getFiveSRecords("five_s_audits", orgId, factoryId)).find((a: any) => a.id === auditId);
  const customer = (await db.getCustomers(orgId)).find((c: any) => c.id === factoryId);
  const customerName = customer?.companyName || "Müşteri";
  if (!audit) return { buffer: Buffer.alloc(0), filename: "", customerName, error: "Denetim bulunamadı.", status: 404 };
  if (audit.status !== "Tamamlandı") return { buffer: Buffer.alloc(0), filename: "", customerName, error: "Sadece tamamlanmış denetimler için rapor alınabilir.", status: 400 };

  const areas = await db.getFiveSRecords("five_s_areas", orgId, factoryId);
  const departments = await db.getFiveSRecords("five_s_departments", orgId, factoryId);
  const results = (await db.getFiveSRecords("five_s_results", orgId, factoryId)).filter((r: any) => r.auditId === audit.id);
  const assignments = (await db.getFiveSRecords("five_s_team_assignments", orgId, factoryId)).filter((a: any) => a.auditId === audit.id);

  const headerRows = [
    ["5S Denetim Raporu", customerName],
    ["Denetim No", audit.auditNo],
    ["Denetim Tarihi", audit.date],
    ["Genel Puan (1-5)", audit.overallScore ?? ""],
    []
  ];
  const tableHeader = ["Bölüm", "Alan", "Denetçi", "S Seviyesi", "Puan", "Önceki Puan"];
  const tableRows = results
    .sort((a: any, b: any) => (a.areaId + a.level).localeCompare(b.areaId + b.level))
    .map((r: any) => {
      const area = areas.find((a: any) => a.id === r.areaId);
      const dept = departments.find((d: any) => d.id === area?.departmentId);
      const assignment = assignments.find((a: any) => a.areaId === r.areaId);
      return [dept?.name || "-", area?.name || "-", assignment?.auditorName || "-", r.level, r.score, r.previousScore ?? "-"];
    });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...headerRows, tableHeader, ...tableRows]), "5S Denetim Raporu");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, filename: `5S_Denetim_${audit.auditNo}_${customerName.replace(/\s+/g, "_")}.xlsx`, customerName };
}

async function buildFiveSGembaWalkReportBuffer(orgId: string, factoryId: string, findingIds?: string[]): Promise<{ buffer: Buffer; filename: string; customerName: string; error?: string; status?: number }> {
  const customer = (await db.getCustomers(orgId)).find((c: any) => c.id === factoryId);
  const customerName = customer?.companyName || "Müşteri";
  let findings = await db.getFiveSRecords("gemba_walk_findings", orgId, factoryId);
  if (Array.isArray(findingIds) && findingIds.length > 0) {
    findings = findings.filter((f: any) => findingIds.includes(f.id));
  }
  if (findings.length === 0) return { buffer: Buffer.alloc(0), filename: "", customerName, error: "Aktarılacak Gemba Walk kaydı bulunamadı.", status: 400 };

  const areas = await db.getFiveSRecords("five_s_areas", orgId, factoryId);
  const tableHeader = ["Alan", "Problem Kategorisi", "Problem Tarihi", "Problem Tanımı", "Aksiyon", "Sorumlu", "Durum", "Termin", "Gerçekleşme"];
  const tableRows = findings.map((f: any) => {
    const area = areas.find((a: any) => a.id === f.areaId);
    return [area?.name || "-", f.problemCategory, f.problemDate, f.problemDescription, f.action, f.responsible, f.status, f.dueDate || "-", f.completedDate || "-"];
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Gemba Walk Raporu", customerName], [], tableHeader, ...tableRows]), "Gemba Walk");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, filename: `GembaWalk_${customerName.replace(/\s+/g, "_")}.xlsx`, customerName };
}

async function buildFiveSDashboardReportBuffer(orgId: string, factoryId: string): Promise<{ buffer: Buffer; filename: string; customerName: string }> {
  const customer = (await db.getCustomers(orgId)).find((c: any) => c.id === factoryId);
  const customerName = customer?.companyName || "Müşteri";
  const [departments, areas, audits, results, answers, gembaFindings] = await Promise.all([
    db.getFiveSRecords("five_s_departments", orgId, factoryId),
    db.getFiveSRecords("five_s_areas", orgId, factoryId),
    db.getFiveSRecords("five_s_audits", orgId, factoryId),
    db.getFiveSRecords("five_s_results", orgId, factoryId),
    db.getFiveSRecords("five_s_answers", orgId, factoryId),
    db.getFiveSRecords("gemba_walk_findings", orgId, factoryId)
  ]);

  const deptScoreRows = departments.map((d: any) => {
    const deptAreaIds = new Set(areas.filter((a: any) => a.departmentId === d.id).map((a: any) => a.id));
    const deptResults = results.filter((r: any) => deptAreaIds.has(r.areaId));
    const avg = deptResults.length > 0 ? Math.round((deptResults.reduce((s: number, r: any) => s + Number(r.score || 0), 0) / deptResults.length) * 100) / 100 : "-";
    return [d.name, deptResults.length, avg];
  });

  const auditStatusCounts = ["Başlanmadı", "Devam Ediyor", "Tamamlandı"].map(s => [s, audits.filter((a: any) => a.status === s).length]);
  const actionStatusCounts = ["Açık", "Devam Ediyor", "Kapalı"].map(s => [s, answers.filter((a: any) => a.actionStatus === s).length]);
  const gembaCategoryCounts = Object.entries(
    gembaFindings.reduce((acc: Record<string, number>, f: any) => { acc[f.problemCategory] = (acc[f.problemCategory] || 0) + 1; return acc; }, {})
  ).map(([cat, count]) => [cat, count]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["5S Dashboard Özeti", customerName], [],
    ["Bölüm Bazlı Ortalama Puan"], ["Bölüm", "Sonuç Sayısı", "Ortalama Puan"], ...deptScoreRows, [],
    ["Denetim Durumu"], ["Durum", "Adet"], ...auditStatusCounts, [],
    ["Aksiyon Durumu"], ["Durum", "Adet"], ...actionStatusCounts, [],
    ["Gemba Walk - Problem Kategorisi Dağılımı"], ["Kategori", "Adet"], ...gembaCategoryCounts
  ]), "Dashboard Özeti");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, filename: `5S_Dashboard_Ozeti_${customerName.replace(/\s+/g, "_")}.xlsx`, customerName };
}

async function buildFiveSAuditListReportBuffer(orgId: string, factoryId: string): Promise<{ buffer: Buffer; filename: string; customerName: string }> {
  const customer = (await db.getCustomers(orgId)).find((c: any) => c.id === factoryId);
  const customerName = customer?.companyName || "Müşteri";
  const audits = await db.getFiveSRecords("five_s_audits", orgId, factoryId);
  const tableHeader = ["Denetim No", "Tarih", "Durum", "Genel Puan"];
  const tableRows = [...audits].sort((a: any, b: any) => a.auditNo - b.auditNo).map((a: any) => [a.auditNo, a.date, a.status, a.overallScore ?? "-"]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["5S Denetim Takvimi", customerName], [], tableHeader, ...tableRows]), "Denetim Takvimi");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, filename: `5S_Denetim_Takvimi_${customerName.replace(/\s+/g, "_")}.xlsx`, customerName };
}

function sendXlsxDownload(res: express.Response, buffer: Buffer, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(buffer);
}

app.post("/api/business/five-s/audits/:id/send-report", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const { recipientEmail } = req.body;
  if (!recipientEmail) {
    res.status(400).json({ success: false, error: "Alıcı e-posta adresi gereklidir." });
    return;
  }
  const report = await buildFiveSAuditReportBuffer(user.organization_id, scope.factoryId || "", req.params.id);
  if (report.error) {
    res.status(report.status || 400).json({ success: false, error: report.error });
    return;
  }
  const audit = (await db.getFiveSRecords("five_s_audits", user.organization_id, scope.factoryId)).find((a: any) => a.id === req.params.id);
  const subject = `${report.customerName} - 5S Denetim Raporu - Denetim No ${audit?.auditNo}`;
  const body = `Sayın İlgililer,\n\n${audit?.date} tarihli, ${audit?.auditNo} numaralı 5S denetiminin sonuç raporu ektedir.\n\nSaygılarımızla,\nGemba Partner`;
  const result = await sendMail({ to: recipientEmail, subject, text: body, attachments: [{ filename: report.filename, content: report.buffer }] });
  if (!result.success) {
    res.status(503).json(result);
    return;
  }
  res.json({ success: true });
});

app.get("/api/business/five-s/audits/:id/report.xlsx", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const report = await buildFiveSAuditReportBuffer(user.organization_id, scope.factoryId || "", req.params.id);
  if (report.error) {
    res.status(report.status || 400).json({ success: false, error: report.error });
    return;
  }
  sendXlsxDownload(res, report.buffer, report.filename);
});

app.post("/api/business/five-s/gemba-walk/send-report", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const { recipientEmail, findingIds } = req.body;
  if (!recipientEmail) {
    res.status(400).json({ success: false, error: "Alıcı e-posta adresi gereklidir." });
    return;
  }
  const report = await buildFiveSGembaWalkReportBuffer(user.organization_id, scope.factoryId || "", findingIds);
  if (report.error) {
    res.status(report.status || 400).json({ success: false, error: report.error });
    return;
  }
  const subject = `${report.customerName} - Gemba Walk Raporu`;
  const body = `Sayın İlgililer,\n\nGemba Walk saha gözlem raporu ektedir.\n\nSaygılarımızla,\nGemba Partner`;
  const result = await sendMail({ to: recipientEmail, subject, text: body, attachments: [{ filename: report.filename, content: report.buffer }] });
  if (!result.success) {
    res.status(503).json(result);
    return;
  }
  res.json({ success: true });
});

app.post("/api/business/five-s/gemba-walk/report.xlsx", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const { findingIds } = req.body;
  const report = await buildFiveSGembaWalkReportBuffer(user.organization_id, scope.factoryId || "", findingIds);
  if (report.error) {
    res.status(report.status || 400).json({ success: false, error: report.error });
    return;
  }
  sendXlsxDownload(res, report.buffer, report.filename);
});

app.get("/api/business/five-s/dashboard-report.xlsx", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const report = await buildFiveSDashboardReportBuffer(user.organization_id, scope.factoryId || "");
  sendXlsxDownload(res, report.buffer, report.filename);
});

app.post("/api/business/five-s/dashboard-report/send", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const { recipientEmail } = req.body;
  if (!recipientEmail) {
    res.status(400).json({ success: false, error: "Alıcı e-posta adresi gereklidir." });
    return;
  }
  const report = await buildFiveSDashboardReportBuffer(user.organization_id, scope.factoryId || "");
  const result = await sendMail({
    to: recipientEmail,
    subject: `${report.customerName} - 5S Dashboard Özeti`,
    text: `Sayın İlgililer,\n\n5S Dashboard özet raporu ektedir.\n\nSaygılarımızla,\nGemba Partner`,
    attachments: [{ filename: report.filename, content: report.buffer }]
  });
  if (!result.success) {
    res.status(503).json(result);
    return;
  }
  res.json({ success: true });
});

app.get("/api/business/five-s/audit-list-report.xlsx", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const report = await buildFiveSAuditListReportBuffer(user.organization_id, scope.factoryId || "");
  sendXlsxDownload(res, report.buffer, report.filename);
});

app.post("/api/business/five-s/audit-list-report/send", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const { recipientEmail } = req.body;
  if (!recipientEmail) {
    res.status(400).json({ success: false, error: "Alıcı e-posta adresi gereklidir." });
    return;
  }
  const report = await buildFiveSAuditListReportBuffer(user.organization_id, scope.factoryId || "");
  const result = await sendMail({
    to: recipientEmail,
    subject: `${report.customerName} - 5S Denetim Takvimi`,
    text: `Sayın İlgililer,\n\n5S denetim takvimi ektedir.\n\nSaygılarımızla,\nGemba Partner`,
    attachments: [{ filename: report.filename, content: report.buffer }]
  });
  if (!result.success) {
    res.status(503).json(result);
    return;
  }
  res.json({ success: true });
});

// 6h. Kaizen Suggestions module — ported from a legacy Power Apps app ("KaizenSuite") that ran an
// employee suggestion-box workflow: submit -> team-leader (Manager) approval -> Kaizen Board
// evaluation/approval -> tracked to completion. Personnel/Criteria are simple factory-scoped
// rosters (generic CRUD, mirrors the 5S module's FIVE_S_SIMPLE_ENTITIES pattern); the suggestion
// workflow gets its own routes since each decision is a real state transition with authorization,
// not a plain upsert. See src/components/kaizen/kaizenTypes.ts for the fixes this port makes vs.
// the legacy app's confirmed bugs (silent-reassignment-on-edit, Manager-reject-doesn't-reject,
// no real server-side authorization, ISG/Çevre/Motivasyon discarded on save).

// ---- Kaizen security helpers (Faz 0) ----
// Every Kaizen id-based endpoint must (a) stay inside the caller's organization (db layer already
// does that), (b) stay inside the caller's customer/factory scope, and (c) check the caller's role
// on the server — the UI hiding a button is not authorization.
const isStaff = (user: any) => user.role === "Admin" || user.role === "Consultant";
const sameEmail = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

function canAccessFactory(req: express.Request, factoryId?: string): boolean {
  const allowed = (req as any).allowedCustomerIds as string[] | null;
  if (allowed === null) return true;
  return !!factoryId && allowed.includes(factoryId);
}

function denyKaizen(res: express.Response, status = 403, error = "Access Denied.") {
  res.status(status).json({ success: false, error });
}

// Loads a suggestion and verifies the caller may see it (factory scope). Replies and returns null on failure.
async function loadKaizenSuggestion(req: express.Request, res: express.Response): Promise<any | null> {
  const user = (req as any).user;
  const suggestion = (await db.getKaizenRecords("kaizen_suggestions", user.organization_id)).find((s: any) => s.id === req.params.id);
  if (!suggestion || !canAccessFactory(req, suggestion.factory_id)) {
    denyKaizen(res, 404, "Öneri bulunamadı.");
    return null;
  }
  return suggestion;
}

// "Is this personnel record me?" — by the sicil session's personnel id, else by account e-mail.
const isMe = (user: any, p: any) => (!!user.kaizenPersonnelId && p?.id === user.kaizenPersonnelId) || sameEmail(p?.email, user.email);
async function myKaizenPersonnel(user: any, factoryId?: string): Promise<any | undefined> {
  return (await db.getKaizenRecords("kaizen_personnel", user.organization_id, factoryId)).find((p: any) => isMe(user, p));
}
// Is the caller this suggestion's 1st-degree supervisor? By the stored e-mail, or (supervisors
// without e-mail, Faz 3.5) by the supervisor's personnel id stored on the suggestion.
async function isSuggestionManager(user: any, suggestion: any): Promise<boolean> {
  if (sameEmail(suggestion.teamLeaderEmail, user.email)) return true;
  if (!suggestion.teamLeaderId) return false;
  return (await myKaizenPersonnel(user, suggestion.factory_id))?.id === suggestion.teamLeaderId;
}
const isAuthorOf = (user: any, suggestion: any) =>
  sameEmail(suggestion.authorEmail, user.email) || (!!user.kaizenPersonnelId && suggestion.authorPersonnelId === user.kaizenPersonnelId);

async function isKaizenBoardMember(user: any, factoryId?: string): Promise<boolean> {
  if (isStaff(user)) return true;
  const personnel = await db.getKaizenRecords("kaizen_personnel", user.organization_id, factoryId);
  return personnel.some((p: any) => isMe(user, p) && (!!p.isBoardMember || !!p.isBoardAdmin));
}

// Kurul Yöneticisi (Faz 3.3): the customer's own Kaizen administrator — a personnel record flagged
// isBoardAdmin. Inside the Kaizen module they have the same powers as Gemba staff (all screens,
// Kurulum, Ayarlar, any decision stage) without being a Gemba Tools Admin. Only staff can grant it.
async function isKaizenAdmin(user: any, factoryId?: string): Promise<boolean> {
  if (isStaff(user)) return true;
  const personnel = await db.getKaizenRecords("kaizen_personnel", user.organization_id, factoryId);
  return personnel.some((p: any) => isMe(user, p) && !!p.isBoardAdmin);
}

const MAX_PHOTOS_PER_GROUP = 8;
const MAX_PHOTO_CHARS = 1_500_000; // ~1.1 MB of binary as a base64 data URL; the client already downsizes to ~300 KB
function sanitizePhotos(input: any): { photos: { dataUrl: string; caption?: string }[]; error?: string } {
  if (input === undefined || input === null) return { photos: [] };
  if (!Array.isArray(input) || input.length > MAX_PHOTOS_PER_GROUP) {
    return { photos: [], error: `En fazla ${MAX_PHOTOS_PER_GROUP} görsel eklenebilir.` };
  }
  const photos: { dataUrl: string; caption?: string }[] = [];
  for (const p of input) {
    const dataUrl = typeof p?.dataUrl === "string" ? p.dataUrl : "";
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(dataUrl)) return { photos: [], error: "Geçersiz görsel biçimi." };
    if (dataUrl.length > MAX_PHOTO_CHARS) return { photos: [], error: "Görsel çok büyük (en fazla ~1 MB)." };
    photos.push({ dataUrl, caption: typeof p.caption === "string" ? p.caption.slice(0, 200) : undefined });
  }
  return { photos };
}

const clip = (v: any, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
// Any known currency is accepted (the customer's list only narrows the form choices, see
// kaizenSettings.ts); a missing/unknown value falls back to the customer's base currency.
const asCurrency = (v: any, base = "TL") => ((KNOWN_CURRENCIES as readonly string[]).includes(v) ? v : base);
const asAmount = (v: any) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

// Müşteri bazında Kaizen ayarları (Faz 2-B) — one record per customer, defaults when none saved.
const kaizenSettingsId = (factoryId: string) => `kaizen_settings_${factoryId}`;
async function loadKaizenSettings(orgId: string, factoryId?: string): Promise<KaizenSettings> {
  if (!factoryId) return normalizeKaizenSettings(null);
  const rows = await db.getKaizenRecords("kaizen_settings", orgId, factoryId);
  return normalizeKaizenSettings(rows.find((r: any) => r.id === kaizenSettingsId(factoryId)) || rows[0]);
}

// Personnel / Criteria rosters. Reads are open to anyone in scope (the UI needs the roster to resolve
// team leaders); writes change who can approve things, so they are Admin/Consultant only.
const KAIZEN_SIMPLE_ENTITIES: { path: string; collection: Parameters<typeof db.getKaizenRecords>[0] }[] = [
  { path: "personnel", collection: "kaizen_personnel" },
  { path: "criteria", collection: "kaizen_criteria" }
];

for (const { path, collection } of KAIZEN_SIMPLE_ENTITIES) {
  app.get(`/api/business/kaizen/${path}`, authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed) return denyKaizen(res);
    const rows = await db.getKaizenRecords(collection, user.organization_id, scope.factoryId);
    res.json({ success: true, data: collection === "kaizen_personnel" ? rows.map(publicPersonnel) : rows });
  });

  app.post(`/api/business/kaizen/${path}`, authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed || !scope.factoryId) return denyKaizen(res);
    if (!(await isKaizenAdmin(user, scope.factoryId))) return denyKaizen(res, 403, "Bu işlem için Kurul Yöneticisi yetkisi gereklidir.");
    // PIN secrets are only ever written by the login / PIN-code routes.
    let body = stripSecretInput({ ...req.body });
    // Personnel (Faz 3.1): sicil no required + unique, supervisor by record id, no loops.
    const roster = collection === "kaizen_personnel" ? await db.getKaizenRecords("kaizen_personnel", user.organization_id, scope.factoryId) : [];
    if (collection === "kaizen_personnel") {
      // Only Gemba staff grant or revoke Kurul Yöneticisi; a Kurul Yöneticisi cannot escalate anyone.
      if (!isStaff(user)) {
        const prev = roster.find((p: any) => p.id === body.id);
        body.isBoardAdmin = !!prev?.isBoardAdmin;
      }
      const prepared = preparePersonnel(body, roster);
      if (!prepared.record) return denyKaizen(res, 400, prepared.error);
      body = prepared.record;
    }
    if (body.id) {
      // An id from another customer must never be overwritten through this customer's scope.
      const existing = (await db.getKaizenRecords(collection, user.organization_id)).find((r: any) => r.id === body.id);
      if (existing && existing.factory_id !== scope.factoryId) return denyKaizen(res, 404, "Kayıt bulunamadı.");
      if (collection === "kaizen_personnel" && existing && !!existing.isBoardMember !== !!body.isBoardMember) {
        console.info(`[kaizen-audit] board membership of ${existing.email} set to ${!!body.isBoardMember} by ${user.email}`);
        body.boardChangedBy = user.email;
        body.boardChangedAt = new Date().toISOString();
      }
    }
    const saved = await db.saveKaizenRecord(collection, user.organization_id, scope.factoryId, body, user.id);
    // Keep the direct reports' denormalized supervisor name/e-mail (still used for approval routing
    // and notifications) in step with this record, and give legacy e-mail links a real managerId.
    if (collection === "kaizen_personnel") {
      const people = roster.filter((p: any) => p.id !== saved.id).concat(saved);
      for (const p of people) {
        if (p.id === saved.id || effectiveManagerId(p, people) !== saved.id) continue;
        const email = (saved.email || "").toLowerCase();
        if (p.managerId === saved.id && p.teamLeaderName === saved.name && (p.teamLeaderEmail || "") === email) continue;
        await db.saveKaizenRecord(collection, user.organization_id, scope.factoryId, { ...p, managerId: saved.id, teamLeaderName: saved.name, teamLeaderEmail: email }, user.id);
      }
    }
    res.json({ success: true, data: collection === "kaizen_personnel" ? publicPersonnel(saved) : saved });
  });

  app.delete(`/api/business/kaizen/${path}/:id`, authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const existing = (await db.getKaizenRecords(collection, user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !canAccessFactory(req, existing.factory_id)) return denyKaizen(res, 404, "Kayıt bulunamadı.");
    if (!(await isKaizenAdmin(user, existing.factory_id))) return denyKaizen(res, 403, "Bu işlem için Kurul Yöneticisi yetkisi gereklidir.");
    if (collection === "kaizen_personnel" && existing.isBoardAdmin && !isStaff(user)) {
      return denyKaizen(res, 403, "Kurul Yöneticisi kaydını yalnızca Gemba danışmanı silebilir.");
    }
    if (collection === "kaizen_personnel") {
      // Deleting a supervisor would silently orphan their team (and its approval routing).
      const people = await db.getKaizenRecords("kaizen_personnel", user.organization_id, existing.factory_id);
      const reports = buildOrg(people).reportsOf.get(existing.id) || [];
      if (reports.length > 0) {
        return denyKaizen(res, 400, `${existing.name} ${reports.length} kişinin amiri. Önce bu kişileri başka bir amire bağlayın.`);
      }
    }
    await db.deleteKaizenRecord(collection, user.organization_id, req.params.id);
    res.json({ success: true });
  });
}

// ---- Görünürlük (Faz 3.4) ----
// List endpoints return only what the caller may see (staff/Kurul: all; others: own + team, see
// visibleSuggestionIds) and never carry photos — those are base64 and made phone lists heavy. Lists
// get photo counts instead; the full record (with photos) comes from the /:id detail endpoints.
async function kaizenVisibleIds(user: any, factoryId?: string): Promise<Set<string> | null> {
  if (await isKaizenBoardMember(user, factoryId)) return null;
  const [roster, suggestions, implementations] = await Promise.all([
    db.getKaizenRecords("kaizen_personnel", user.organization_id, factoryId),
    db.getKaizenRecords("kaizen_suggestions", user.organization_id, factoryId),
    db.getKaizenRecords("kaizen_implementations", user.organization_id, factoryId)
  ]);
  return visibleSuggestionIds(user.email, roster, suggestions, implementations, user.kaizenPersonnelId);
}

async function canSeeKaizenSuggestion(user: any, suggestion: any): Promise<boolean> {
  const visible = await kaizenVisibleIds(user, suggestion.factory_id);
  return visible === null || visible.has(suggestion.id);
}

const PHOTO_FIELDS: Record<string, string[]> = {
  kaizen_suggestions: ["photosCurrent", "photosPropose"],
  kaizen_implementations: ["photosBefore", "photosAfter"]
};
function withoutPhotos(collection: string, record: any) {
  const fields = PHOTO_FIELDS[collection];
  if (!fields) return record;
  const out: any = { ...record, photoCounts: {} };
  for (const f of fields) {
    out.photoCounts[f] = Array.isArray(record[f]) ? record[f].length : 0;
    delete out[f];
  }
  return out;
}

for (const [path, collection] of [["suggestions", "kaizen_suggestions"], ["approvals", "kaizen_approvals"], ["evaluations", "kaizen_evaluations"], ["implementations", "kaizen_implementations"], ["messages", "kaizen_messages"]] as const) {
  app.get(`/api/business/kaizen/${path}`, authenticateToken, async (req, res) => {
    const user = (req as any).user;
    const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
    if (!scope.allowed) return denyKaizen(res);
    const [records, visible] = await Promise.all([
      db.getKaizenRecords(collection, user.organization_id, scope.factoryId),
      kaizenVisibleIds(user, scope.factoryId)
    ]);
    const idOf = (r: any) => (collection === "kaizen_suggestions" ? r.id : r.suggestionId);
    const data = (visible === null ? records : records.filter((r: any) => visible.has(idOf(r)))).map((r: any) => withoutPhotos(collection, r));
    res.json({ success: true, data });
  });
}

// Ayın şampiyonları: company-wide, but only name / department / points / count — no suggestion
// content, so it is safe for everyone in the customer's scope despite the visibility rule above.
// Ayın Kaizen Şampiyonları (Faz 5.5) — visible to everyone in the customer (motivation board):
// names, departments, points and counts only. Rules in src/utils/kaizenChampions.ts.
async function kaizenChampionData(req: express.Request) {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) return null;
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
  const [suggestions, evaluations] = await Promise.all([
    db.getKaizenRecords("kaizen_suggestions", user.organization_id, scope.factoryId),
    db.getKaizenRecords("kaizen_evaluations", user.organization_id, scope.factoryId)
  ]);
  const strip = ({ key, ...r }: any) => r;
  return { month, suggestions, evaluations, ...championsFor(suggestions, evaluations, month), strip };
}

// Home card: this month's top people (scored only, as before).
app.get("/api/business/kaizen/champions", authenticateToken, async (req, res) => {
  const d = await kaizenChampionData(req);
  if (!d) return denyKaizen(res);
  const limit = Math.min(10, Number(req.query.limit) || 3);
  res.json({ success: true, data: d.people.filter(r => r.points > 0).slice(0, limit).map(d.strip) });
});

// Şampiyonlar sekmesi: people and departments for a month, plus the months that have activity.
app.get("/api/business/kaizen/champions/board", authenticateToken, async (req, res) => {
  const d = await kaizenChampionData(req);
  if (!d) return denyKaizen(res);
  const months = championMonths(d.suggestions, d.evaluations);
  if (!months.includes(d.month)) months.unshift(d.month);
  res.json({ success: true, data: { month: d.month, months, people: d.people.slice(0, 10).map(d.strip), departments: d.departments.slice(0, 10).map(d.strip) } });
});

// Full records (with photos), same visibility rule as the lists.
app.get("/api/business/kaizen/suggestions/:id", authenticateToken, async (req, res, next) => {
  if (req.params.id === "export-excel") return next();
  const user = (req as any).user;
  const suggestion = await loadKaizenSuggestion(req, res);
  if (!suggestion) return;
  if (!(await canSeeKaizenSuggestion(user, suggestion))) return denyKaizen(res, 404, "Öneri bulunamadı.");
  res.json({ success: true, data: suggestion });
});

app.get("/api/business/kaizen/implementations/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const loaded = await loadKaizenImplementation(req, res);
  if (!loaded) return;
  if (!(await canSeeKaizenSuggestion(user, loaded.suggestion))) return denyKaizen(res, 404, "Uygulama kaydı bulunamadı.");
  res.json({ success: true, data: loaded.impl });
});

// İlk giriş / PIN sıfırlama kodu (Faz 3.5): the Kurul Yöneticisi creates a one-time 6-digit code
// (valid PIN_CODE_DAYS days) and hands it to the person, who then chooses their own PIN at login.
// Creating a code also clears any existing PIN and ends that person's PIN sessions.
app.post("/api/business/kaizen/personnel/:id/pin-code", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const person = (await db.getKaizenRecords("kaizen_personnel", user.organization_id)).find((p: any) => p.id === req.params.id);
  if (!person || !canAccessFactory(req, person.factory_id)) return denyKaizen(res, 404, "Kayıt bulunamadı.");
  if (!(await isKaizenAdmin(user, person.factory_id))) return denyKaizen(res, 403, "Bu işlem için Kurul Yöneticisi yetkisi gereklidir.");
  if (!person.employeeNo) return denyKaizen(res, 400, "Önce bu kişiye sicil no girin.");
  if (person.isBoardAdmin && !isStaff(user) && person.id !== (user.kaizenPersonnelId || "")) {
    return denyKaizen(res, 403, "Kurul Yöneticisinin PIN'ini yalnızca kendisi ya da Gemba danışmanı sıfırlayabilir.");
  }
  const code = newPinCode();
  const expires = new Date(Date.now() + PIN_CODE_DAYS * 86_400_000).toISOString();
  await db.saveKaizenRecord("kaizen_personnel", user.organization_id, person.factory_id, {
    ...person, pinHash: "", pinCodeHash: hashSecret(code), pinCodeExpires: expires,
    pinVersion: (Number(person.pinVersion) || 0) + 1, pinFailed: 0, pinLockedUntil: ""
  }, user.id);
  console.info(`[kaizen-audit] PIN code issued for ${person.employeeNo} by ${user.email}`);
  res.json({ success: true, data: { code, expires } });
});

// Excel ile personel yükleme (Faz 3.2). dryRun:true returns the per-row plan without saving, so
// the screen can show exactly what will happen; the same body without dryRun applies it.
app.post("/api/business/kaizen/personnel/import", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) return denyKaizen(res);
  if (!(await isKaizenAdmin(user, scope.factoryId))) return denyKaizen(res, 403, "Bu işlem için Kurul Yöneticisi yetkisi gereklidir.");
  if (!Array.isArray(req.body.rows)) return denyKaizen(res, 400, "Satır listesi bekleniyor.");
  const rows = req.body.rows.filter((r: any) => r && typeof r === "object" && !Array.isArray(r));
  const roster = await db.getKaizenRecords("kaizen_personnel", user.organization_id, scope.factoryId);
  const plan = planPersonnelImport(rows, roster, () => `kaizen_personnel_${crypto.randomUUID().slice(0, 12)}`);
  const summary = {
    created: plan.results.filter(r => r.action === "create").length,
    updated: plan.results.filter(r => r.action === "update").length,
    unchanged: plan.results.filter(r => r.action === "unchanged").length,
    errors: plan.results.filter(r => r.action === "error").length,
    warnings: plan.results.filter(r => r.action !== "error" && r.messages.length > 0).length,
    // Records outside the file whose supervisor name/e-mail is refreshed as a side effect.
    cascaded: plan.toSave.length - plan.results.filter(r => r.action === "create" || r.action === "update").length
  };
  if (req.body.dryRun !== true) {
    for (const rec of plan.toSave) {
      await db.saveKaizenRecord("kaizen_personnel", user.organization_id, scope.factoryId, rec, user.id);
    }
    console.info(`[kaizen-audit] personnel import by ${user.email}: ${JSON.stringify(summary)}`);
  }
  res.json({ success: true, data: { dryRun: req.body.dryRun === true, summary, results: plan.results } });
});

// Reads are open to anyone in the customer's scope (forms and reports need them); writes are staff-only.
app.get("/api/business/kaizen/settings", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) return denyKaizen(res);
  res.json({ success: true, data: await loadKaizenSettings(user.organization_id, scope.factoryId) });
});

app.post("/api/business/kaizen/settings", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) return denyKaizen(res);
  if (!(await isKaizenAdmin(user, scope.factoryId))) return denyKaizen(res, 403, "Bu işlem için Kurul Yöneticisi yetkisi gereklidir.");
  const settings = normalizeKaizenSettings({ ...req.body, updatedAt: new Date().toISOString(), updatedBy: user.email });
  await db.saveKaizenRecord("kaizen_settings", user.organization_id, scope.factoryId, { id: kaizenSettingsId(scope.factoryId), ...settings }, user.id);
  res.json({ success: true, data: settings });
});

// Parça başı kazanç: the server derives the annual saving (per piece × annual volume) and the
// lifetime total itself; any other recurrence clears the per-piece fields.
function savingFields(paybackPeriod: string, body: any): { fields?: Record<string, number>; error?: string } {
  if (!isPerPiece(paybackPeriod)) return { fields: { unitSaving: 0, annualVolume: 0, productionYears: 0, estimatedLifetimeSaving: 0 } };
  const parsed = parsePerPiece(body);
  if (!parsed.value) return { error: parsed.error };
  const { annual, lifetime } = perPieceSaving(parsed.value);
  return { fields: { ...parsed.value, estimatedSaving: annual, estimatedLifetimeSaving: lifetime } };
}

app.post("/api/business/kaizen/suggestions", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) return denyKaizen(res);
  const subject = clip(req.body.subject, 200);
  const currentState = clip(req.body.currentState, 5000);
  const improvementSuggestion = clip(req.body.improvementSuggestion, 5000);
  if (!subject || !currentState || !improvementSuggestion) {
    res.status(400).json({ success: false, error: "Öneri Konusu, Mevcut Durum ve Önerilen İyileştirme alanları zorunludur." });
    return;
  }
  const cur = sanitizePhotos(req.body.photosCurrent);
  const prop = sanitizePhotos(req.body.photosPropose);
  if (cur.error || prop.error) {
    res.status(400).json({ success: false, error: cur.error || prop.error });
    return;
  }

  // Who the suggestion is for, and who approves it, is decided from the server-side personnel roster —
  // never from the request body (a client could otherwise name itself as its own team leader).
  const personnel = await db.getKaizenRecords("kaizen_personnel", user.organization_id, scope.factoryId);
  const settings = await loadKaizenSettings(user.organization_id, scope.factoryId);
  const myRecord = personnel.find((p: any) => isMe(user, p));
  const kaizenAdmin = isStaff(user) || !!myRecord?.isBoardAdmin;
  // On behalf of someone else: picked by roster id (Faz 3.1; older clients send the name). Allowed
  // for staff and for any supervisor above that person — not only the direct one.
  const wantedId = clip(req.body.personnelId, 80);
  const wantedName = clip(req.body.personnelName, 120).toLowerCase();
  let subjectRecord = myRecord;
  const other = wantedId
    ? personnel.find((p: any) => p.id === wantedId)
    : wantedName && wantedName !== (myRecord?.name || user.full_name || "").toLowerCase()
      ? personnel.find((p: any) => (p.name || "").toLowerCase() === wantedName)
      : undefined;
  if ((wantedId || (wantedName && wantedName !== (myRecord?.name || user.full_name || "").toLowerCase())) && other?.id !== myRecord?.id) {
    if (!other) {
      if (!kaizenAdmin) return denyKaizen(res, 403, "Seçilen personel kayıtlı değil.");
    } else if (!kaizenAdmin && !(myRecord && managerChain(other.id, buildOrg(personnel)).includes(myRecord.id))) {
      return denyKaizen(res, 403, "Sadece ekibinizdeki personel adına öneri girebilirsiniz.");
    } else {
      subjectRecord = other;
    }
  }
  const perPieceCreate = savingFields(clip(req.body.paybackPeriod, 60), req.body);
  if (perPieceCreate.error) return denyKaizen(res, 400, perPieceCreate.error);
  const payload = {
    authorPersonnelId: myRecord?.id || "",
    // 1st-degree supervisor by id too, so a supervisor without e-mail can still approve (Faz 3.5).
    teamLeaderId: subjectRecord ? effectiveManagerId(subjectRecord, personnel) || "" : "",
    personnelId: subjectRecord?.id || "",
    personnelEmployeeNo: subjectRecord?.employeeNo || "",
    personnelName: subjectRecord?.name || user.full_name,
    personnelDepartment: subjectRecord?.department || "",
    personnelJobTitle: subjectRecord?.jobTitle || "",
    shift: subjectRecord?.shift || "",
    teamLeaderName: subjectRecord?.teamLeaderName || "",
    teamLeaderEmail: subjectRecord?.teamLeaderEmail || "",
    machineLeaderName: subjectRecord?.machineLeaderName || "",
    machineLeaderEmail: subjectRecord?.machineLeaderEmail || "",
    subject,
    suggestionTypes: Array.isArray(req.body.suggestionTypes) ? req.body.suggestionTypes.filter((t: any) => typeof t === "string").slice(0, 10) : [],
    currentState,
    improvementSuggestion,
    stage: clip(req.body.stage, 60),
    paybackPeriod: clip(req.body.paybackPeriod, 60),
    estimatedSaving: asAmount(req.body.estimatedSaving),
    ...perPieceCreate.fields,
    estimatedSavingCurrency: asCurrency(req.body.estimatedSavingCurrency, settings.baseCurrency),
    estimatedCost: asAmount(req.body.estimatedCost),
    estimatedCostCurrency: asCurrency(req.body.estimatedCostCurrency, settings.baseCurrency),
    isg: !!req.body.isg, cevre: !!req.body.cevre, motivasyon: !!req.body.motivasyon,
    photosCurrent: cur.photos, photosPropose: prop.photos,
    // Which stages (Amir / Kurul) this suggestion needs is decided now and frozen on the record.
    requiredStages: requiredStagesFor(perPieceCreate.fields?.estimatedSaving ?? asAmount(req.body.estimatedSaving), asCurrency(req.body.estimatedSavingCurrency, settings.baseCurrency), settings)
  };
  const suggestion = await db.createKaizenSuggestion(user.organization_id, scope.factoryId, payload, user.id, user.email, user.full_name);
  await refreshKaizenEmbedding(user.organization_id, scope.factoryId, suggestion);

  if (suggestion.approvalStatus === "First Approval") {
    // No Amir stage for this customer: the suggestion goes straight to the Kurul.
    notifyKaizen(user.organization_id, scope.factoryId, {
      ids: personnel.filter((p: any) => p.isBoardMember || p.isBoardAdmin).map((p: any) => p.id),
      subject: `Değerlendirmeye Hazır: ${suggestion.subject}`,
      text: `${suggestion.personnelName} tarafından gönderilen ${suggestion.subject} konulu öneri Kaizen Kurulu değerlendirmesini bekliyor.`,
      suggestionId: suggestion.id, kind: "board-queue"
    }).catch(() => {});
  } else if (suggestion.teamLeaderEmail || suggestion.teamLeaderId) {
    notifyKaizen(user.organization_id, scope.factoryId, {
      ids: [suggestion.teamLeaderId], emails: [suggestion.teamLeaderEmail], suggestionId: suggestion.id, kind: "manager-queue",
      subject: `Yeni Kaizen Önerisi: ${suggestion.subject}`,
      text: `${suggestion.personnelName} tarafından yeni bir Kaizen önerisi gönderildi ve onayınızı bekliyor.\n\nKonu: ${suggestion.subject}\n\nGemba Tools üzerinden inceleyip onaylayabilirsiniz.`
    }).catch(() => {});
  }
  res.json({ success: true, data: suggestion });
});

// Edit + resubmit a rejected suggestion: only its author (or staff), and only the content fields.
// ---- Anlamsal benzerlik (Faz 6.2) ----
// Opt-in per customer (Ayarlar → aiSimilarity): suggestion texts are sent to Gemini for embeddings.
// Vectors live in kaizen_embeddings (one row per suggestion, never in list responses) and are only
// ever compared with the same customer's suggestions. Any AI failure falls back to text similarity.
// `kaizenAi.embed` is swappable so tests run without the network.
export const kaizenAi = {
  model: "gemini-embedding-001",
  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 100) {
      const r = await getGeminiClient().models.embedContent({
        model: kaizenAi.model, contents: texts.slice(i, i + 100), config: { taskType: "SEMANTIC_SIMILARITY", outputDimensionality: 768 }
      });
      (r.embeddings || []).forEach(e => out.push((e.values || []).map(v => Math.round(v * 1e5) / 1e5)));
    }
    if (out.length !== texts.length) throw new Error("embedding count mismatch");
    return out;
  }
};
const embeddingId = (suggestionId: string) => `kaizen_embeddings_${suggestionId}`;
const withTimeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

// Make sure up to `max` of these suggestions have a current vector; returns suggestionId → vector.
async function ensureKaizenEmbeddings(orgId: string, factoryId: string, suggestions: any[], max = 40): Promise<Map<string, number[]>> {
  const stored = new Map<string, any>((await db.getKaizenRecords("kaizen_embeddings", orgId, factoryId)).map((r: any) => [r.suggestionId, r]));
  const vectors = new Map<string, number[]>();
  const todo: { s: any; text: string; hash: string }[] = [];
  for (const s of suggestions) {
    const text = embeddingText(s);
    if (!text) continue;
    const hash = textHash(text);
    const row = stored.get(s.id);
    if (row && row.hash === hash && row.model === kaizenAi.model && Array.isArray(row.v)) vectors.set(s.id, row.v);
    else if (todo.length < max) todo.push({ s, text, hash });
  }
  if (todo.length) {
    const vs = await kaizenAi.embed(todo.map(t => t.text));
    for (let i = 0; i < todo.length; i++) {
      vectors.set(todo[i].s.id, vs[i]);
      await db.saveKaizenRecord("kaizen_embeddings", orgId, factoryId, {
        id: embeddingId(todo[i].s.id), suggestionId: todo[i].s.id, model: kaizenAi.model, hash: todo[i].hash, v: vs[i], createdAt: new Date().toISOString()
      }, "system");
    }
  }
  return vectors;
}

// After a suggestion is created or edited: refresh its vector (best effort, never blocks the save).
async function refreshKaizenEmbedding(orgId: string, factoryId: string, suggestion: any) {
  try {
    if (!process.env.GEMINI_API_KEY || !(await loadKaizenSettings(orgId, factoryId)).aiSimilarity) return;
    await withTimeout(ensureKaizenEmbeddings(orgId, factoryId, [suggestion], 1), 5000);
  } catch (e: any) {
    console.warn("[kaizen-ai] embedding refresh failed:", e.message);
  }
}

// Benzer öneriler (Faz 6.1). Registered before POST suggestions/:id so "similar" is not taken as an
// id. Everyone in the customer may learn THAT a similar idea exists (subject, department, date,
// status) so ideas are not submitted twice; who wrote it and the record itself are only returned
// for suggestions the caller may see anyway (Faz 3.4 rule).
app.post("/api/business/kaizen/suggestions/similar", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) return denyKaizen(res);
  const b = req.body || {};
  const query = {
    subject: clip(b.subject, 200), currentState: clip(b.currentState, 5000), improvementSuggestion: clip(b.improvementSuggestion, 5000),
    personnelDepartment: clip(b.department, 120), suggestionTypes: Array.isArray(b.suggestionTypes) ? b.suggestionTypes.filter((t: any) => typeof t === "string").slice(0, 10) : []
  };
  const corpus = await db.getKaizenRecords("kaizen_suggestions", user.organization_id, scope.factoryId);
  const excludeId = clip(b.excludeId, 120) || undefined;
  const textHits = findSimilar(query, corpus as any[], { excludeId, limit: 5 });
  // Faz 6.2: add meaning-based hits when the customer turned it on; any failure → text only.
  let semHits: { item: any; cos: number }[] = [];
  const settings = await loadKaizenSettings(user.organization_id, scope.factoryId);
  if (settings.aiSimilarity && process.env.GEMINI_API_KEY && embeddingText(query).length >= 12) {
    try {
      const others = (corpus as any[]).filter(x => x.id !== excludeId);
      const [qv] = await withTimeout(kaizenAi.embed([embeddingText(query)]), 5000);
      const vectors = await withTimeout(ensureKaizenEmbeddings(user.organization_id, scope.factoryId, others, 40), 8000);
      semHits = others.filter(x => vectors.has(x.id)).map(x => ({ item: x, cos: cosineVec(qv, vectors.get(x.id)!) }));
    } catch (e: any) {
      console.warn("[kaizen-ai] semantic similarity skipped:", e.message);
    }
  }
  const hits = mergeSimilar(textHits as any[], semHits, 5);
  const data = [];
  for (const { item: x, score, semantic } of hits as { item: any; score: number; semantic: boolean }[]) {
    const visible = await canSeeKaizenSuggestion(user, x);
    data.push({
      score, semantic, subject: x.subject, department: x.personnelDepartment || "", createdAt: x.createdAt || "",
      approvalStatus: x.approvalStatus, requiredStages: x.requiredStages, feasibilityOpen: x.feasibility?.status === "open", completed: !!x.completed,
      ...(visible ? { id: x.id, personnelName: x.personnelName || "" } : {})
    });
  }
  res.json({ success: true, data });
});

// Ayarlar → "Mevcut önerileri hazırla": vectors for older suggestions, 100 per call (Kurul Yöneticisi).
app.post("/api/business/kaizen/suggestions/embeddings/backfill", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) return denyKaizen(res);
  if (!(await isKaizenAdmin(user, scope.factoryId))) return denyKaizen(res, 403, "Bu işlem için Kurul Yöneticisi yetkisi gereklidir.");
  if (!(await loadKaizenSettings(user.organization_id, scope.factoryId)).aiSimilarity) return denyKaizen(res, 400, "Önce Ayarlar'da yapay zekâ ile benzerliği açıp kaydedin.");
  if (!process.env.GEMINI_API_KEY) return denyKaizen(res, 503, "Yapay zekâ servisi yapılandırılmamış (GEMINI_API_KEY).");
  const corpus = (await db.getKaizenRecords("kaizen_suggestions", user.organization_id, scope.factoryId)).filter((s: any) => embeddingText(s));
  try {
    const vectors = await ensureKaizenEmbeddings(user.organization_id, scope.factoryId, corpus, 100);
    res.json({ success: true, data: { total: corpus.length, ready: vectors.size, remaining: corpus.length - vectors.size } });
  } catch (e: any) {
    console.warn("[kaizen-ai] backfill failed:", e.message);
    res.status(502).json({ success: false, error: "Yapay zekâ servisine ulaşılamadı, biraz sonra tekrar deneyin." });
  }
});

app.post("/api/business/kaizen/suggestions/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const existing = await loadKaizenSuggestion(req, res);
  if (!existing) return;
  if (!isAuthorOf(user, existing) && !(await isKaizenAdmin(user, existing.factory_id))) {
    return denyKaizen(res, 403, "Sadece kendi öneriniz düzenleyebilirsiniz.");
  }
  if (existing.approvalStatus !== "Rejected" && existing.approvalStatus !== "Rejected 2nd") {
    res.status(400).json({ success: false, error: "Sadece reddedilen öneriler yeniden düzenlenip gönderilebilir." });
    return;
  }
  const cur = req.body.photosCurrent === undefined ? { photos: undefined as any } : sanitizePhotos(req.body.photosCurrent);
  const prop = req.body.photosPropose === undefined ? { photos: undefined as any } : sanitizePhotos(req.body.photosPropose);
  if ((cur as any).error || (prop as any).error) {
    res.status(400).json({ success: false, error: (cur as any).error || (prop as any).error });
    return;
  }
  const b = req.body;
  const settings = await loadKaizenSettings(user.organization_id, existing.factory_id);
  const { baseCurrency } = settings;
  const effectivePeriod = b.paybackPeriod !== undefined ? clip(b.paybackPeriod, 60) : existing.paybackPeriod;
  // Per-piece numbers not resent keep their stored values.
  const perPieceEdit = savingFields(effectivePeriod, {
    unitSaving: b.unitSaving ?? existing.unitSaving, annualVolume: b.annualVolume ?? existing.annualVolume, productionYears: b.productionYears ?? existing.productionYears
  });
  if (perPieceEdit.error) return denyKaizen(res, 400, perPieceEdit.error);
  const payload = {
    subject: b.subject !== undefined ? clip(b.subject, 200) : undefined,
    suggestionTypes: Array.isArray(b.suggestionTypes) ? b.suggestionTypes.filter((t: any) => typeof t === "string").slice(0, 10) : undefined,
    currentState: b.currentState !== undefined ? clip(b.currentState, 5000) : undefined,
    improvementSuggestion: b.improvementSuggestion !== undefined ? clip(b.improvementSuggestion, 5000) : undefined,
    stage: b.stage !== undefined ? clip(b.stage, 60) : undefined,
    paybackPeriod: b.paybackPeriod !== undefined ? clip(b.paybackPeriod, 60) : undefined,
    estimatedSaving: b.estimatedSaving !== undefined ? asAmount(b.estimatedSaving) : undefined,
    ...perPieceEdit.fields,
    estimatedSavingCurrency: b.estimatedSavingCurrency !== undefined ? asCurrency(b.estimatedSavingCurrency, baseCurrency) : undefined,
    estimatedCost: b.estimatedCost !== undefined ? asAmount(b.estimatedCost) : undefined,
    estimatedCostCurrency: b.estimatedCostCurrency !== undefined ? asCurrency(b.estimatedCostCurrency, baseCurrency) : undefined,
    isg: b.isg, cevre: b.cevre, motivasyon: b.motivasyon,
    photosCurrent: cur.photos, photosPropose: prop.photos,
    // Stages are decided again from the (possibly edited) estimate and the current settings.
    requiredStages: requiredStagesFor(
      perPieceEdit.fields?.estimatedSaving ?? (b.estimatedSaving !== undefined ? asAmount(b.estimatedSaving) : Number(existing.estimatedSaving) || 0),
      b.estimatedSavingCurrency !== undefined ? asCurrency(b.estimatedSavingCurrency, baseCurrency) : existing.estimatedSavingCurrency,
      settings
    )
  };
  const updated = await db.updateKaizenSuggestion(user.organization_id, req.params.id, payload, user.id);
  if (updated) await refreshKaizenEmbedding(user.organization_id, existing.factory_id, updated);
  res.json({ success: true, data: updated });
});

// Beklenen kazanç revizyonu (Faz 5.1): after submission the estimate is no longer edited in place —
// the Kurul (or the approving manager while it waits for them) revises it with a reason, and the
// previous figures are kept in savingRevisions. Reports read the current estimatedSaving, i.e. the
// latest revision. requiredStages stay as fixed at submit (Faz 2-B.3).
const SAVING_SNAPSHOT_KEYS = ["estimatedSaving", "estimatedSavingCurrency", "unitSaving", "annualVolume", "productionYears", "estimatedLifetimeSaving"] as const;
const savingSnapshot = (s: any) => Object.fromEntries(SAVING_SNAPSHOT_KEYS.map(k => [k, s[k] ?? (k === "estimatedSavingCurrency" ? "" : 0)]));

app.post("/api/business/kaizen/suggestions/:id/saving-revision", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const existing = await loadKaizenSuggestion(req, res);
  if (!existing) return;
  if (existing.approvalStatus === "Rejected" || existing.approvalStatus === "Rejected 2nd") {
    return denyKaizen(res, 400, "Reddedilen önerinin kazancı revize edilmez; öneri sahibi düzenleyip yeniden gönderir.");
  }
  const allowed = (await isKaizenBoardMember(user, existing.factory_id))
    || (existing.approvalStatus === "Pending" && (await isSuggestionManager(user, existing)));
  if (!allowed) return denyKaizen(res, 403, "Kazancı yalnızca Kurul (ya da onay bekleyen öneride amir) revize edebilir.");
  const reason = clip(req.body.reason, 500);
  if (!reason) return denyKaizen(res, 400, "Revizyon gerekçesi zorunludur.");

  const settings = await loadKaizenSettings(user.organization_id, existing.factory_id);
  const per = savingFields(existing.paybackPeriod, req.body);
  if (per.error) return denyKaizen(res, 400, per.error);
  const next = {
    ...per.fields,
    estimatedSaving: per.fields?.estimatedSaving ?? asAmount(req.body.estimatedSaving),
    estimatedSavingCurrency: asCurrency(req.body.estimatedSavingCurrency, existing.estimatedSavingCurrency || settings.baseCurrency)
  };
  const from = savingSnapshot(existing);
  const to = savingSnapshot({ ...existing, ...next });
  if (JSON.stringify(from) === JSON.stringify(to)) return denyKaizen(res, 400, "Kazanç değişmedi.");

  const me = await myKaizenPersonnel(user, existing.factory_id);
  const revision = { at: new Date().toISOString(), byName: me?.name || user.full_name || user.email, byEmail: user.email || "", reason, from, to };
  const saved = await db.saveKaizenRecord("kaizen_suggestions", user.organization_id, existing.factory_id, {
    ...existing, ...next, savingRevisions: [...(existing.savingRevisions || []), revision].slice(-50), updatedAt: revision.at
  }, user.id);
  console.info(`[kaizen-audit] saving of ${existing.id} revised by ${user.email}: ${from.estimatedSaving} ${from.estimatedSavingCurrency} -> ${to.estimatedSaving} ${to.estimatedSavingCurrency}`);
  const fmt = (v: any) => `${Number(v.estimatedSaving || 0).toLocaleString("tr-TR")} ${v.estimatedSavingCurrency}`;
  await notifyKaizen(user.organization_id, existing.factory_id, {
    ids: [existing.authorPersonnelId], emails: [existing.authorEmail], suggestionId: existing.id, kind: "decision", exceptEmail: user.email,
    subject: `Kaizen: "${existing.subject}" önerinizin beklenen kazancı revize edildi`,
    text: `${revision.byName} beklenen kazancı ${fmt(from)} → ${fmt(to)} olarak güncelledi.\nGerekçe: ${reason}`
  });
  const { photosCurrent, photosPropose, ...rest } = saved;
  res.json({ success: true, data: rest });
});

app.post("/api/business/kaizen/suggestions/:id/manager-decision", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const suggestion = await loadKaizenSuggestion(req, res);
  if (!suggestion) return;
  // The direct supervisor decides; a Kurul Yöneticisi (or staff) can step in for any suggestion.
  const isManager = (await isSuggestionManager(user, suggestion)) || (await isKaizenAdmin(user, suggestion.factory_id));
  if (!isManager) return denyKaizen(res, 403, "Bu öneriyi onaylama/reddetme yetkiniz yok.");
  if (!isStaff(user) && isAuthorOf(user, suggestion)) {
    return denyKaizen(res, 403, "Kendi önerinizi onaylayamazsınız.");
  }
  const approved = req.body.approved === true;
  const comment = clip(req.body.comment, 2000);
  if (!approved && !comment) {
    res.status(400).json({ success: false, error: "Lütfen red nedeni giriniz." });
    return;
  }
  const stages = stagesOf(suggestion);
  const needsBoard = stages.includes("Board");
  const result = await db.decideKaizenManager(
    user.organization_id, req.params.id, approved, comment, user.full_name, user.email, afterManagerApprovalStatus(stages)
  );
  if (!result) {
    res.status(400).json({ success: false, error: "Bu öneri artık Amir onayı bekleyen durumda değil." });
    return;
  }

  // Board notification stays inside the suggestion's own factory (was: every board member in the org).
  // Below the Kurul threshold the Amir's approval is final, so the author is told directly.
  const boardIds = (await db.getKaizenRecords("kaizen_personnel", user.organization_id, suggestion.factory_id)).filter((p: any) => p.isBoardMember || p.isBoardAdmin).map((p: any) => p.id);
  {
    notifyKaizen(user.organization_id, suggestion.factory_id, {
      ...(approved && needsBoard ? { ids: boardIds } : { ids: [result.suggestion.authorPersonnelId], emails: [result.suggestion.authorEmail] }),
      suggestionId: suggestion.id, kind: approved && needsBoard ? "board-queue" : "decision",
      subject: !approved ? `Öneriniz Reddedildi: ${result.suggestion.subject}`
        : needsBoard ? `Değerlendirmeye Hazır: ${result.suggestion.subject}` : `Öneriniz Onaylandı: ${result.suggestion.subject}`,
      text: !approved
        ? `${result.suggestion.subject} konulu öneriniz amiriniz tarafından reddedildi.\n\nGerekçe: ${comment || "-"}`
        : needsBoard
          ? `${result.suggestion.subject} konulu öneri amir onayından geçti ve Kaizen Kurulu değerlendirmesini bekliyor.`
          : `Tebrikler! ${result.suggestion.subject} konulu Kaizen öneriniz amiriniz tarafından onaylandı.`
    }).catch(() => {});
  }
  res.json({ success: true, data: result });
});

// ---- Bildirim katmanı (Faz 4.3) ----
// One entry point for every Kaizen notification. Recipients are given as roster ids and/or e-mails;
// each person gets an in-app notification (so sicil no users without e-mail see it too, under the
// bell) and everyone with a real address gets the e-mail. New channels (WhatsApp, SMS, push) plug
// in here without touching the routes.
const VIRTUAL_MAIL = /@kaizen\.local$/i;
async function notifyKaizen(orgId: string, factoryId: string, n: {
  ids?: (string | undefined)[]; emails?: (string | undefined)[]; subject: string; text: string; suggestionId?: string; kind: string; exceptEmail?: string;
}): Promise<number> {
  const roster = await db.getKaizenRecords("kaizen_personnel", orgId, factoryId);
  const ids = new Set((n.ids || []).filter(Boolean) as string[]);
  const emails = new Set((n.emails || []).map(e => (e || "").trim().toLowerCase()).filter(e => e && !VIRTUAL_MAIL.test(e)));
  const except = (n.exceptEmail || "").toLowerCase();
  const people = roster.filter((p: any) => ids.has(p.id) || (p.email && emails.has(p.email.toLowerCase())));
  people.forEach((p: any) => { if (p.email) emails.add(p.email.toLowerCase()); });
  emails.delete(except);
  const nowIso = new Date().toISOString();
  for (const p of people) {
    if (except && (p.email || "").toLowerCase() === except) continue;
    await db.saveKaizenRecord("kaizen_notifications", orgId, factoryId, {
      id: `kaizen_notifications_${crypto.randomUUID().slice(0, 12)}`,
      personnelId: p.id, suggestionId: n.suggestionId || "", kind: n.kind,
      title: n.subject, text: n.text.slice(0, 2000), createdAt: nowIso, readAt: ""
    }, "system");
  }
  if (emails.size) await sendMail({ to: Array.from(emails), subject: n.subject, text: n.text }).catch(() => {});
  return Math.max(emails.size, people.length);
}

// ---- Haftalık hatırlatmalar (Faz 4.4) ----
async function kaizenReminderDigests(orgId: string, factoryId: string) {
  const [suggestions, implementations, roster, settings] = await Promise.all([
    db.getKaizenRecords("kaizen_suggestions", orgId, factoryId),
    db.getKaizenRecords("kaizen_implementations", orgId, factoryId),
    db.getKaizenRecords("kaizen_personnel", orgId, factoryId),
    loadKaizenSettings(orgId, factoryId)
  ]);
  return { settings, digests: buildReminders({ suggestions, implementations, roster, settings }) };
}

async function sendKaizenReminders(orgId: string, factoryId: string, link: string): Promise<{ sent: number; skipped?: string }> {
  const { settings, digests } = await kaizenReminderDigests(orgId, factoryId);
  if (!settings.remindersEnabled) return { sent: 0, skipped: "Hatırlatmalar bu müşteri için kapalı." };
  const company = await db.getCustomerName(orgId, factoryId);
  for (const d of digests) {
    await notifyKaizen(orgId, factoryId, {
      ids: [d.personnelId], emails: [d.email], kind: "reminder",
      subject: `Kaizen hatırlatma: ${d.items.length} konu ilginizi bekliyor`,
      text: reminderText(d, company, link)
    });
  }
  return { sent: digests.length };
}

// Weekly, every customer (Vercel Cron, CRON_SECRET) — same protection as the consultant digest.
app.get("/api/cron/kaizen-reminders", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(503).json({ success: false, error: "CRON_SECRET ortam değişkeni tanımlı değil." });
  if (req.headers.authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ success: false, error: "Unauthorized." });
  const results: any[] = [];
  for (const { orgId, factoryId } of await db.listKaizenFactories()) {
    try {
      results.push({ factoryId, ...(await sendKaizenReminders(orgId, factoryId, process.env.APP_URL || getBaseUrl(req))) });
    } catch (e: any) {
      results.push({ factoryId, error: e.message }); // one customer's bad data must not stop the others
    }
  }
  res.json({ success: true, data: results });
});

// Kurulum → Ayarlar: what this week's reminders would say (no sending), and "send now".
app.get("/api/business/kaizen/reminders/preview", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) return denyKaizen(res);
  if (!(await isKaizenAdmin(user, scope.factoryId))) return denyKaizen(res, 403, "Bu işlem için Kurul Yöneticisi yetkisi gereklidir.");
  const { digests } = await kaizenReminderDigests(user.organization_id, scope.factoryId);
  res.json({ success: true, data: digests });
});

app.post("/api/business/kaizen/reminders/send", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) return denyKaizen(res);
  if (!(await isKaizenAdmin(user, scope.factoryId))) return denyKaizen(res, 403, "Bu işlem için Kurul Yöneticisi yetkisi gereklidir.");
  const result = await sendKaizenReminders(user.organization_id, scope.factoryId, getBaseUrl(req));
  console.info(`[kaizen-audit] reminders sent manually by ${user.email}: ${JSON.stringify(result)}`);
  res.json({ success: true, data: result });
});

// My in-app notifications (by my roster record) and marking them read.
app.get("/api/business/kaizen/notifications", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) return denyKaizen(res);
  const me = await myKaizenPersonnel(user, scope.factoryId);
  if (!me) return res.json({ success: true, data: [] });
  const mine = (await db.getKaizenRecords("kaizen_notifications", user.organization_id, scope.factoryId))
    .filter((x: any) => x.personnelId === me.id)
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 60);
  res.json({ success: true, data: mine });
});

app.post("/api/business/kaizen/notifications/read", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed || !scope.factoryId) return denyKaizen(res);
  const me = await myKaizenPersonnel(user, scope.factoryId);
  if (!me) return res.json({ success: true, data: 0 });
  const only = Array.isArray(req.body.ids) ? new Set(req.body.ids) : null;
  const nowIso = new Date().toISOString();
  const unread = (await db.getKaizenRecords("kaizen_notifications", user.organization_id, scope.factoryId))
    .filter((x: any) => x.personnelId === me.id && !x.readAt && (!only || only.has(x.id)));
  for (const x of unread) await db.saveKaizenRecord("kaizen_notifications", user.organization_id, scope.factoryId, { ...x, readAt: nowIso }, user.id);
  res.json({ success: true, data: unread.length });
});

// ---- Öneri altı yazışma ve hazır talepler (Faz 4.2) ----
// Everyone who can see a suggestion can read and write its thread. The submitter can also send a
// ready-made request (değerlendirme / onay / durum teyidi) — at most once per type per 24 hours —
// which notifies whoever holds the suggestion now: the Amir while it waits for them, the Kurul
// (and the feasibility owner) in the Kurul stage, the implementation owner once accepted.
const REQUEST_TYPES: Record<string, string> = {
  evaluation: "Değerlendirme talebi",
  approval: "Onay talebi",
  status: "Durum teyidi talebi"
};
const REQUEST_TEXT: Record<string, string> = {
  evaluation: "Önerimin değerlendirilmesini rica ediyorum.",
  approval: "Önerim için onay kararınızı bekliyorum.",
  status: "Önerimin şu anki durumu hakkında bilgi verebilir misiniz?"
};

async function kaizenThreadRole(user: any, suggestion: any): Promise<string> {
  if (isAuthorOf(user, suggestion)) return "Öneri sahibi";
  if (await isSuggestionManager(user, suggestion)) return "Amir";
  if (isStaff(user)) return "Danışman";
  if (await isKaizenBoardMember(user, suggestion.factory_id)) return "Kurul";
  return "Ekip";
}

// Who should hear about new activity on this suggestion, given its stage (the writer is excluded
// by notifyKaizen via exceptEmail). Returned as roster ids + e-mails for the notification layer.
async function kaizenThreadRecipients(orgId: string, suggestion: any, toResponsible: boolean): Promise<{ ids: string[]; emails: string[] }> {
  const roster = await db.getKaizenRecords("kaizen_personnel", orgId, suggestion.factory_id);
  if (!toResponsible) return { ids: [suggestion.authorPersonnelId].filter(Boolean), emails: [suggestion.authorEmail].filter(Boolean) };
  if (suggestion.approvalStatus === "Pending") return { ids: [suggestion.teamLeaderId].filter(Boolean), emails: [suggestion.teamLeaderEmail].filter(Boolean) };
  if (suggestion.approvalStatus === "First Approval") {
    return {
      ids: [...roster.filter((p: any) => p.isBoardMember || p.isBoardAdmin).map((p: any) => p.id), suggestion.feasibility?.status === "open" ? suggestion.feasibility.ownerId : ""].filter(Boolean),
      emails: []
    };
  }
  const impl = (await db.getKaizenRecords("kaizen_implementations", orgId, suggestion.factory_id)).find((i: any) => i.suggestionId === suggestion.id);
  return { ids: [suggestion.teamLeaderId].filter(Boolean), emails: [impl?.ownerEmail || suggestion.teamLeaderEmail].filter(Boolean) };
}

app.post("/api/business/kaizen/suggestions/:id/messages", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const suggestion = await loadKaizenSuggestion(req, res);
  if (!suggestion) return;
  if (!(await canSeeKaizenSuggestion(user, suggestion))) return denyKaizen(res, 404, "Öneri bulunamadı.");
  const requestType = typeof req.body.requestType === "string" && REQUEST_TYPES[req.body.requestType] ? req.body.requestType : "";
  const text = clip(req.body.text, 2000) || (requestType ? REQUEST_TEXT[requestType] : "");
  if (!text) return denyKaizen(res, 400, "Mesaj boş olamaz.");
  const isAuthor = isAuthorOf(user, suggestion);
  if (requestType && !isAuthor) return denyKaizen(res, 403, "Hazır talepleri yalnızca öneri sahibi gönderebilir.");

  const thread = (await db.getKaizenRecords("kaizen_messages", user.organization_id, suggestion.factory_id)).filter((m: any) => m.suggestionId === suggestion.id);
  if (requestType) {
    const last = thread.filter((m: any) => m.requestType === requestType).sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
    if (last && Date.now() - Date.parse(last.createdAt) < 24 * 3600_000) {
      return denyKaizen(res, 429, `${REQUEST_TYPES[requestType]} son 24 saat içinde zaten gönderildi.`);
    }
  }
  const nowIso = new Date().toISOString();
  const message = {
    id: `kaizen_messages_${crypto.randomUUID().slice(0, 12)}`,
    suggestionId: suggestion.id,
    authorName: user.full_name || user.email,
    authorEmail: (user.email || "").toLowerCase(),
    authorPersonnelId: user.kaizenPersonnelId || (await myKaizenPersonnel(user, suggestion.factory_id))?.id || "",
    authorRole: await kaizenThreadRole(user, suggestion),
    kind: requestType ? "request" : "message",
    requestType,
    text,
    createdAt: nowIso
  };
  const saved = await db.saveKaizenRecord("kaizen_messages", user.organization_id, suggestion.factory_id, message, user.id);

  // Author writes / requests → the party holding the suggestion; anyone else → the author.
  const rcpt = await kaizenThreadRecipients(user.organization_id, suggestion, isAuthor);
  const notified = await notifyKaizen(user.organization_id, suggestion.factory_id, {
      ...rcpt, exceptEmail: user.email, suggestionId: suggestion.id, kind: requestType ? "request" : "message",
      subject: `${requestType ? REQUEST_TYPES[requestType] : "Yeni mesaj"}: ${suggestion.subject}`,
      text: `${message.authorName} (${message.authorRole}) "${suggestion.subject}" konulu Kaizen önerisine yazdı:\n\n${text}\n\nYanıtlamak için: ${getBaseUrl(req)}`
  }).catch(() => 0);
  res.json({ success: true, data: saved, notified });
});

// Değerlendiriliyor / fizibilite (Faz 4.1): instead of deciding at once, the Kurul can put a
// suggestion under a feasibility study with an owner and a due date. The suggestion stays in the
// Kurul queue ("First Approval") and the next Kurul decision closes the study.
app.post("/api/business/kaizen/suggestions/:id/feasibility", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const suggestion = await loadKaizenSuggestion(req, res);
  if (!suggestion) return;
  if (!(await isKaizenBoardMember(user, suggestion.factory_id))) return denyKaizen(res, 403, "Fizibilite kararı Kaizen Kurulu yetkisi gerektirir.");
  if (suggestion.approvalStatus !== "First Approval") return denyKaizen(res, 400, "Yalnızca Kurul değerlendirmesindeki öneriler fizibiliteye alınabilir.");
  const roster = await db.getKaizenRecords("kaizen_personnel", user.organization_id, suggestion.factory_id);
  const owner = roster.find((p: any) => p.id === req.body.ownerId);
  if (!owner) return denyKaizen(res, 400, "Fizibilite sorumlusunu personel listesinden seçiniz.");
  const dueDate = asDate(req.body.dueDate);
  if (!dueDate) return denyKaizen(res, 400, "Hedef tarih giriniz.");
  const nowIso = new Date().toISOString();
  const prev = suggestion.feasibility?.status === "open" ? suggestion.feasibility : null;
  const feasibility = {
    status: "open",
    ownerId: owner.id, ownerName: owner.name || "", ownerEmail: (owner.email || "").toLowerCase(),
    dueDate, note: clip(req.body.note, 1000),
    startedAt: prev?.startedAt || nowIso, startedBy: prev?.startedBy || user.full_name || user.email,
    updatedAt: nowIso
  };
  const updated = { ...suggestion, feasibility, updatedAt: nowIso };
  await db.saveKaizenRecord("kaizen_suggestions", user.organization_id, suggestion.factory_id, updated, user.id);
  if (!prev || prev.ownerId !== owner.id) {
    notifyKaizen(user.organization_id, suggestion.factory_id, {
      ids: [owner.id], suggestionId: suggestion.id, kind: "feasibility",
      subject: `Fizibilite sorumlusu oldunuz: ${suggestion.subject}`,
      text: `${suggestion.subject} konulu Kaizen önerisinin fizibilite çalışması size atandı.\nHedef tarih: ${dueDate}${feasibility.note ? `\n\nNot: ${feasibility.note}` : ""}`
    }).catch(() => {});
  }
  res.json({ success: true, data: withoutPhotos("kaizen_suggestions", updated) });
});

app.post("/api/business/kaizen/suggestions/:id/board-decision", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const suggestion = await loadKaizenSuggestion(req, res);
  if (!suggestion) return;
  if (!(await isKaizenBoardMember(user, suggestion.factory_id))) {
    return denyKaizen(res, 403, "Kurul değerlendirmesi yapma yetkiniz yok.");
  }
  if (!isStaff(user) && isAuthorOf(user, suggestion)) {
    return denyKaizen(res, 403, "Kendi önerinizi değerlendiremezsiniz.");
  }
  const approved = req.body.approved === true;
  const comment = clip(req.body.comment, 2000);
  if (!approved && !comment) {
    res.status(400).json({ success: false, error: "Lütfen red nedeni giriniz." });
    return;
  }
  // Score comes from the server's own criteria table, never from the request body.
  const settings = await loadKaizenSettings(user.organization_id, suggestion.factory_id);
  const { baseCurrency } = settings;
  let criteriaId = "", criteriaLabel = "", point = 0;
  // A criteria is mandatory unless this customer made Kurul scoring optional; one that is sent must exist.
  if (approved && (settings.boardScoreRequired || req.body.criteriaId)) {
    const criteria = (await db.getKaizenRecords("kaizen_criteria", user.organization_id, suggestion.factory_id)).find((c: any) => c.id === req.body.criteriaId);
    if (!criteria) {
      res.status(400).json({ success: false, error: "Onaylamak için geçerli bir değerlendirme kriteri seçiniz." });
      return;
    }
    criteriaId = criteria.id; criteriaLabel = criteria.criteria || ""; point = Number(criteria.point) || 0;
  }
  const result = await db.decideKaizenBoard(
    user.organization_id, req.params.id, approved,
    {
      criteriaId, criteriaLabel, point,
      yokoten: req.body.yokoten === true, yokotenDescription: clip(req.body.yokotenDescription, 1000),
      estimatedIncome: asAmount(req.body.estimatedIncome), estimatedIncomeCurrency: asCurrency(req.body.estimatedIncomeCurrency, baseCurrency),
      // Reward owed is fixed at approval so a later rate change does not rewrite it.
      reward: approved ? rewardFor({ point }, settings) : null,
      comment
    },
    user.full_name, user.email
  );
  if (!result) {
    res.status(400).json({ success: false, error: "Bu öneri artık Kurul onayı bekleyen durumda değil." });
    return;
  }
  {
    notifyKaizen(user.organization_id, suggestion.factory_id, {
      ids: [result.suggestion.authorPersonnelId], emails: [result.suggestion.authorEmail], suggestionId: suggestion.id, kind: "decision",
      subject: approved ? `Öneriniz Onaylandı: ${result.suggestion.subject}` : `Öneriniz Reddedildi: ${result.suggestion.subject}`,
      text: approved
        ? `Tebrikler! ${result.suggestion.subject} konulu Kaizen öneriniz Kaizen Kurulu tarafından onaylandı.`
        : `${result.suggestion.subject} konulu öneriniz Kaizen Kurulu tarafından reddedildi.\n\nGerekçe: ${comment || "-"}`
    }).catch(() => {});
  }
  res.json({ success: true, data: result });
});

// "Uygulandı": the Board, staff, or the suggestion's own team leader — it used to be open to any signed-in user.
app.post("/api/business/kaizen/suggestions/:id/complete", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const suggestion = await loadKaizenSuggestion(req, res);
  if (!suggestion) return;
  if (!(await isSuggestionManager(user, suggestion)) && !(await isKaizenBoardMember(user, suggestion.factory_id))) {
    return denyKaizen(res, 403, "Bu işlem için yetkiniz yok.");
  }
  const updated = await db.markKaizenCompleted(user.organization_id, req.params.id);
  if (!updated) {
    res.status(400).json({ success: false, error: "Sadece Kurul tarafından onaylanmış öneriler tamamlandı olarak işaretlenebilir." });
    return;
  }
  res.json({ success: true, data: updated });
});

// "Öneriyi Geri Çek" — only the submitter, only while still Pending.
app.post("/api/business/kaizen/suggestions/:id/withdraw", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const suggestion = await loadKaizenSuggestion(req, res);
  if (!suggestion) return;
  const result = await db.withdrawKaizenSuggestion(user.organization_id, req.params.id, user.email);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json({ success: true });
});

// Yokoten and reward follow-ups: Board/staff only, inside the evaluation's own factory.
async function loadKaizenEvaluationForBoard(req: express.Request, res: express.Response): Promise<any | null> {
  const user = (req as any).user;
  const evaluation = (await db.getKaizenRecords("kaizen_evaluations", user.organization_id)).find((e: any) => e.id === req.params.id);
  if (!evaluation || !canAccessFactory(req, evaluation.factory_id)) {
    denyKaizen(res, 404, "Değerlendirme bulunamadı.");
    return null;
  }
  if (!(await isKaizenBoardMember(user, evaluation.factory_id))) {
    denyKaizen(res, 403, "Bu işlem için Kaizen Kurulu yetkisi gereklidir.");
    return null;
  }
  return evaluation;
}

app.post("/api/business/kaizen/evaluations/:id/yokoten-implemented", authenticateToken, async (req, res) => {
  if (!(await loadKaizenEvaluationForBoard(req, res))) return;
  const user = (req as any).user;
  const updated = await db.setKaizenYokotenImplemented(user.organization_id, req.params.id, req.body.implemented === true);
  if (!updated) return denyKaizen(res, 404, "Değerlendirme bulunamadı.");
  res.json({ success: true, data: updated });
});

app.post("/api/business/kaizen/evaluations/:id/reward-status", authenticateToken, async (req, res) => {
  const evaluation = await loadKaizenEvaluationForBoard(req, res);
  if (!evaluation) return;
  const user = (req as any).user;
  const status = req.body.status === "Ödendi" ? "Ödendi" : "Bekliyor";
  // Evaluations approved before a reward rate existed get their amount fixed when first paid.
  const reward = status === "Ödendi"
    ? rewardFor(evaluation, await loadKaizenSettings(user.organization_id, evaluation.factory_id))
    : null;
  const updated = await db.setKaizenRewardStatus(user.organization_id, req.params.id, status, reward && !reward.snapshot ? reward : null);
  if (!updated) return denyKaizen(res, 404, "Değerlendirme bulunamadı.");
  res.json({ success: true, data: updated });
});

// ---- Uygulama takibi (Faz 2-A) ----
// One implementation record per Board-approved suggestion: plan (owner/target date/actions),
// before/after measurement + photos, the actual saving, the Board's verification of it and the
// persistence checks (30/90 days by default, per-customer in kaizen_settings). Completion also flips the suggestion's `completed` flag.
const IMPL_STATUSES = ["Planlandı", "Sürüyor", "Tamamlandı", "İptal"];
const asDate = (v: any) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const addDaysIso = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const BENEFIT_KEYS = ["costEnergy", "costLabor", "costMaterial", "productivityMachine", "productivityMan", "productivityMaterial", "qualityProduct", "qualityMaterial", "qualityScrap", "safetyRiskDegree", "safetyKso"];
const sanitizeBenefits = (b: any) => {
  const out: Record<string, string> = {};
  for (const k of BENEFIT_KEYS) { const v = clip(b?.[k], 80); if (v) out[k] = v; }
  return out;
};
const sanitizeMetric = (m: any) => {
  const n = m && m.value !== null && m.value !== "" && m.value !== undefined ? Number(m.value) : null;
  return { label: clip(m?.label, 80), value: n !== null && Number.isFinite(n) ? n : null, unit: clip(m?.unit, 20) };
};

async function loadKaizenImplementation(req: express.Request, res: express.Response): Promise<{ impl: any; suggestion: any } | null> {
  const user = (req as any).user;
  const impl = (await db.getKaizenRecords("kaizen_implementations", user.organization_id)).find((i: any) => i.id === req.params.id);
  if (!impl || !canAccessFactory(req, impl.factory_id)) {
    denyKaizen(res, 404, "Uygulama kaydı bulunamadı.");
    return null;
  }
  const suggestion = (await db.getKaizenRecords("kaizen_suggestions", user.organization_id)).find((x: any) => x.id === impl.suggestionId);
  if (!suggestion) {
    denyKaizen(res, 404, "Öneri bulunamadı.");
    return null;
  }
  return { impl, suggestion };
}

async function canManageKaizenImplementation(user: any, suggestion: any, impl?: any): Promise<boolean> {
  return (await isSuggestionManager(user, suggestion)) || sameEmail(impl?.ownerEmail, user.email) || (await isKaizenBoardMember(user, suggestion.factory_id));
}

app.post("/api/business/kaizen/suggestions/:id/implementation", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const suggestion = await loadKaizenSuggestion(req, res);
  if (!suggestion) return;
  if (suggestion.approvalStatus !== "Second Approval") {
    return denyKaizen(res, 400, "Uygulama planı yalnızca Kurul tarafından onaylanmış öneriler için açılabilir.");
  }
  const existing = (await db.getKaizenRecords("kaizen_implementations", user.organization_id)).find((i: any) => i.suggestionId === suggestion.id);
  if (!(await canManageKaizenImplementation(user, suggestion, existing))) return denyKaizen(res, 403, "Bu işlem için yetkiniz yok.");

  // Photos not sent (e.g. a client holding the photo-less list record) keep the stored ones.
  const before = req.body.photosBefore === undefined ? { photos: existing?.photosBefore || [] } as ReturnType<typeof sanitizePhotos> : sanitizePhotos(req.body.photosBefore);
  const after = req.body.photosAfter === undefined ? { photos: existing?.photosAfter || [] } as ReturnType<typeof sanitizePhotos> : sanitizePhotos(req.body.photosAfter);
  if (before.error || after.error) return denyKaizen(res, 400, before.error || after.error);

  const status = IMPL_STATUSES.includes(req.body.status) ? req.body.status : (existing?.status || "Planlandı");
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const actions = (Array.isArray(req.body.actions) ? req.body.actions : []).slice(0, 50).map((a: any, i: number) => ({
    id: clip(a?.id, 40) || `a${i}_${Date.now().toString(36)}`,
    text: clip(a?.text, 300),
    done: a?.done === true,
    dueDate: asDate(a?.dueDate)
  })).filter((a: any) => a.text);

  const actualSaving = asAmount(req.body.actualSaving);
  const settings = await loadKaizenSettings(user.organization_id, suggestion.factory_id);
  const actualSavingCurrency = asCurrency(req.body.actualSavingCurrency, settings.baseCurrency);
  // Gerçekleşen yatırım / maliyet (Faz 5.1) — what implementing it actually cost.
  const actualCost = asAmount(req.body.actualCost);
  const actualCostCurrency = asCurrency(req.body.actualCostCurrency, settings.baseCurrency);
  const beforeMetric = sanitizeMetric(req.body.beforeMetric);
  const afterMetric = sanitizeMetric(req.body.afterMetric);

  let completedAt = existing?.completedAt || "";
  let followUps = existing?.followUps || [];
  if (status === "Tamamlandı") {
    if (!existing || existing.status !== "Tamamlandı" || !completedAt) completedAt = today;
    if (!followUps.length) {
      // Check days are snapshotted at completion; a later settings change does not move them.
      followUps = settings.followUpDays.map(days => ({ days, dueDate: addDaysIso(completedAt, days), result: "", checkedAt: "", checkedBy: "", note: "" }));
    }
  } else {
    completedAt = "";
    followUps = [];
  }

  // A saving figure that changed after the Board verified it has to be verified again.
  let verification = existing?.verification || { status: "Bekliyor", by: "", at: "", note: "" };
  if (verification.status !== "Bekliyor" && (
    existing?.actualSaving !== actualSaving || existing?.actualSavingCurrency !== actualSavingCurrency || status !== "Tamamlandı" ||
    (existing?.actualCost || 0) !== actualCost || (existing?.actualCostCurrency || actualCostCurrency) !== actualCostCurrency
  )) {
    verification = { status: "Bekliyor", by: "", at: "", note: "" };
  }

  const record = {
    ...(existing || {}),
    id: existing?.id || `kaizen_implementations_${suggestion.id}`,
    suggestionId: suggestion.id,
    ownerName: clip(req.body.ownerName, 120) || existing?.ownerName || suggestion.teamLeaderName || suggestion.personnelName || "",
    ownerEmail: clip(req.body.ownerEmail, 200) || existing?.ownerEmail || suggestion.teamLeaderEmail || suggestion.authorEmail || "",
    targetDate: asDate(req.body.targetDate),
    status,
    actions,
    beforeMetric,
    afterMetric,
    photosBefore: before.photos,
    photosAfter: after.photos,
    actualSaving,
    actualSavingCurrency,
    actualCost,
    actualCostCurrency,
    note: clip(req.body.note, 2000),
    benefitDescription: clip(req.body.benefitDescription, 1000),
    benefits: sanitizeBenefits(req.body.benefits),
    startedAt: existing?.startedAt || (status !== "Planlandı" ? today : ""),
    completedAt,
    verification,
    followUps,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso
  };
  const saved = await db.saveKaizenRecord("kaizen_implementations", user.organization_id, suggestion.factory_id, record, user.id);
  if (status === "Tamamlandı" && !suggestion.completed) await db.markKaizenCompleted(user.organization_id, suggestion.id);
  res.json({ success: true, data: saved });
});

// Board verification of the actual saving — not the owner, not the submitter (unless staff).
app.post("/api/business/kaizen/implementations/:id/verify", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const loaded = await loadKaizenImplementation(req, res);
  if (!loaded) return;
  const { impl, suggestion } = loaded;
  if (!(await isKaizenBoardMember(user, impl.factory_id))) return denyKaizen(res, 403, "Doğrulama için Kaizen Kurulu yetkisi gereklidir.");
  if (!isStaff(user) && (sameEmail(impl.ownerEmail, user.email) || isAuthorOf(user, suggestion))) {
    return denyKaizen(res, 403, "Kendi uygulamanızı doğrulayamazsınız.");
  }
  if (impl.status !== "Tamamlandı") return denyKaizen(res, 400, "Yalnızca tamamlanmış uygulamalar doğrulanabilir.");
  const decision = req.body.decision === "Doğrulandı" ? "Doğrulandı" : req.body.decision === "Reddedildi" ? "Reddedildi" : "";
  if (!decision) return denyKaizen(res, 400, "Geçersiz karar.");
  const note = clip(req.body.note, 1000);
  if (decision === "Reddedildi" && !note) return denyKaizen(res, 400, "Reddetmek için gerekçe yazın.");
  const updated = { ...impl, verification: { status: decision, by: user.name || user.email, at: new Date().toISOString(), note }, updatedAt: new Date().toISOString() };
  await db.saveKaizenRecord("kaizen_implementations", user.organization_id, impl.factory_id, updated, user.id);
  res.json({ success: true, data: updated });
});

// Persistence ("is the improvement still in place?") check — days come from the customer's settings.
app.post("/api/business/kaizen/implementations/:id/followup", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const loaded = await loadKaizenImplementation(req, res);
  if (!loaded) return;
  const { impl, suggestion } = loaded;
  if (!(await canManageKaizenImplementation(user, suggestion, impl))) return denyKaizen(res, 403, "Bu işlem için yetkiniz yok.");
  if (impl.status !== "Tamamlandı") return denyKaizen(res, 400, "Kalıcılık kontrolü yalnızca tamamlanmış uygulamalar için yapılır.");
  const days = Number(req.body.days);
  const result = req.body.result === "Sürüyor" ? "Sürüyor" : req.body.result === "Bozuldu" ? "Bozuldu" : "";
  const followUps = (impl.followUps || []).map((f: any) => f.days === days
    ? { ...f, result, checkedAt: result ? new Date().toISOString() : "", checkedBy: result ? (user.name || user.email) : "", note: clip(req.body.note, 500) }
    : f);
  if (!followUps.some((f: any) => f.days === days)) return denyKaizen(res, 400, "Geçersiz kontrol günü.");
  const updated = { ...impl, followUps, updatedAt: new Date().toISOString() };
  await db.saveKaizenRecord("kaizen_implementations", user.organization_id, impl.factory_id, updated, user.id);
  res.json({ success: true, data: updated });
});

app.get("/api/business/kaizen/suggestions/export-excel", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) return denyKaizen(res);
  if (!(await isKaizenBoardMember(user, scope.factoryId))) return denyKaizen(res, 403, "Bu rapor için Kaizen Kurulu yetkisi gereklidir.");
  const suggestions = await db.getKaizenRecords("kaizen_suggestions", user.organization_id, scope.factoryId);
  // Amounts are real numeric cells with their own currency column (they used to be "1000 TL" text,
  // which Excel cannot sum, and mixed currencies were indistinguishable).
  const tableHeader = ["Tarih", "Sicil No", "Ad Soyad", "Bölüm", "Konu", "Kategori", "Durum", "Kazanç Süresi", "Tahmini Kazanç (yıllık / tek)", "Kazanç Para Birimi", "Parça Başı Kazanç", "Yıllık Üretim (adet)", "Üretim Süresi (yıl)", "Toplam Kazanç", "Tahmini Maliyet", "Maliyet Para Birimi"];
  const tableRows = suggestions
    .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .map((s: any) => [
      (s.createdAt || "").slice(0, 10), s.personnelEmployeeNo || "", s.personnelName, s.personnelDepartment, s.subject,
      (s.suggestionTypes || []).join(", "), s.approvalStatus,
      s.paybackPeriod || "", Number(s.estimatedSaving) || 0, s.estimatedSavingCurrency || "TL",
      Number(s.unitSaving) || "", Number(s.annualVolume) || "", Number(s.productionYears) || "", Number(s.estimatedLifetimeSaving) || "",
      Number(s.estimatedCost) || 0, s.estimatedCostCurrency || "TL"
    ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Kaizen Önerileri Raporu"], [], tableHeader, ...tableRows]), "Kaizen Önerileri");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="Kaizen_Onerileri.xlsx"`);
  res.send(buffer);
});

// 7. VSM Projects
app.get("/api/business/vsm-projects", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  res.json({ success: true, data: await db.getVsmProjects(user.organization_id, scope.factoryId) });
});

app.post("/api/business/vsm-projects", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const payload = { ...req.body };
  if (scope.factoryId && !payload.factory_id) {
    payload.factory_id = scope.factoryId;
  }
  const saved = await db.saveVsmProject(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/vsm-projects/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getVsmProjects(user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.factory_id || "arcelik_bolu")) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  await db.deleteVsmProject(user.organization_id, req.params.id);
  res.json({ success: true });
});


// 8. OpEx Assessments
app.get("/api/business/opex-assessments", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const list = await db.getOpexAssessments(user.organization_id, scope.factoryId);
  // Consultant comments and the AI brief are internal working material — never sent to a Customer User.
  res.json({ success: true, data: user.role === "Customer User" ? list.map((a: any) => { const { consultantFindings, aiBrief, ...rest } = a; return rest; }) : list });
});

app.post("/api/business/opex-assessments", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const scope = resolveFactoryScope(req, req.headers["x-factory-id"] as string);
  if (!scope.allowed) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const payload = { ...req.body };
  if (scope.factoryId && !payload.customerId) {
    payload.customerId = scope.factoryId;
  }
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  const existing = payload.id ? await db.getOpexAssessmentById(user.organization_id, payload.id) : null;
  if (payload.id && !existing) {
    res.status(404).json({ success: false, error: "Denetim bulunamadı." });
    return;
  }
  if (existing && allowedCustomerIds !== null && !allowedCustomerIds.includes(existing.customerId)) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  // Multi-assessor merge + role rules (Admin sets up/locks, assessors edit only their categories).
  const [categories, questions] = await Promise.all([
    db.getOpexCategories(user.organization_id),
    db.getOpexQuestions(user.organization_id),
  ]);
  const merged = mergeOpexAssessmentSave({ existing, payload, user, questions, categories });
  if (merged.ok === false) {
    res.status(merged.status).json({ success: false, error: merged.error, unanswered: merged.unanswered });
    return;
  }
  const saved = await db.saveOpexAssessment(user.organization_id, merged.record, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/opex-assessments/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin") {
    res.status(403).json({ success: false, error: "Denetimi yalnızca Admin silebilir." });
    return;
  }
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getOpexAssessments(user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.customerId)) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
  }
  await db.deleteOpexAssessment(user.organization_id, req.params.id);
  res.json({ success: true });
});

// 6g. "Excel'e Aktar" — clones the firm's real "OpEx Assessment" reporting template (18 category
// detail sheets, native radar/bar charts) and injects this one assessment's data into it, so the
// download is the actual client-facing report, not a from-scratch approximation.
app.get("/api/business/opex-assessments/:id/export-excel", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin") {
    res.status(403).json({ success: false, error: "Raporu yalnızca Admin indirebilir." });
    return;
  }
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  const assessment = await db.getOpexAssessmentById(user.organization_id, req.params.id);
  if (!assessment) {
    res.status(404).json({ success: false, error: "Denetim bulunamadı." });
    return;
  }
  if (allowedCustomerIds !== null && !allowedCustomerIds.includes(assessment.customerId)) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  if (!isOpexTemplateAvailable()) {
    res.status(503).json({ success: false, error: "OpEx Assessment şablon dosyası bulunamadı. OPEX_EXCEL_TEMPLATE_PATH ortam değişkenini kontrol edin." });
    return;
  }
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === assessment.customerId);
  const customerName = customer?.companyName || "Müşteri";
  const questions = await db.getOpexQuestions(user.organization_id);
  // Filename's sequence number counts across every OpEx assessment ever recorded in this org
  // (any customer), by creation order — not just this customer's own auditNo — so it reads as a
  // firm-wide report code (e.g. "Acme-2608-06.xlsx" = the 6th assessment report in the system).
  const allOrgAssessments = await db.getOpexAssessments(user.organization_id);
  const bySeqOrder = [...allOrgAssessments].sort((a: any, b: any) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const systemSeqNo = bySeqOrder.findIndex((a: any) => a.id === assessment.id) + 1 || allOrgAssessments.length;
  try {
    const buffer = await generateOpexTemplateExcel(assessment, questions, customerName);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(buildOpexExportFilename(customerName, systemSeqNo))}"`);
    res.send(buffer);
  } catch (e: any) {
    console.error("Failed to generate OpEx template Excel", e);
    res.status(500).json({ success: false, error: "Excel raporu oluşturulamadı: " + (e.message || "bilinmeyen hata") });
  }
});

// Danışman Yorumları: each consultant/auditor writes their own major-problem topics and on-site
// context; the AI brief treats them as the primary reference. Only the caller's own entry changes
// (empty text deletes it). Allowed on a locked audit too — a comment changes no score.
app.put("/api/business/opex-assessments/:id/consultant-findings", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const assessment = await db.getOpexAssessmentById(user.organization_id, req.params.id);
  if (!assessment) { res.status(404).json({ success: false, error: "Denetim bulunamadı." }); return; }
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null && !allowedCustomerIds.includes(assessment.customerId)) {
    res.status(403).json({ success: false, error: "Access Denied." });
    return;
  }
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === assessment.customerId);
  if (!canWriteFinding(user, assessment, customer)) {
    res.status(403).json({ success: false, error: "Yorum yalnızca Admin ile bu müşterinin danışmanları ve bu denetimin denetçileri tarafından girilebilir." });
    return;
  }
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const consultantFindings = applyFinding(assessment.consultantFindings, user, text);
  await db.saveOpexAssessment(user.organization_id, { id: assessment.id, consultantFindings }, user.id);
  res.json({ success: true, data: consultantFindings });
});

// "Danışman Özet Sunumu": AI brief built from THIS audit only (scores, evaluator comments, field
// findings, best practices, roadmap, the previous audit) — what the OpEx screen's AI button calls.
// Same access rules as the executive report, except a team consultant may also preview an audit
// that is still open (the brief then says how many criteria are unanswered). The brief is stored on
// the assessment, and its quick wins also become the report's "Hızlı Kazanım" page, so the screen
// and the PDF never show two different lists.
app.post("/api/business/opex-assessments/:id/ai-brief", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const loaded = await loadExecutiveReport(user, req.params.id, { skipQuickWins: true, allowDraft: true });
  if (loaded.ok === false) {
    res.status(loaded.status).json({ success: false, error: loaded.error });
    return;
  }
  try {
    const assessment = await db.getOpexAssessmentById(user.organization_id, req.params.id);
    const siblings = (await db.getOpexAssessments(user.organization_id))
      .filter((a: any) => a.customerId === assessment.customerId && a.id !== assessment.id && a.status === "completed" && new Date(a.created_at).getTime() < new Date(assessment.created_at).getTime())
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const prev = siblings[0];
    const previous = prev ? { name: prev.auditName || "Önceki denetim", date: prev.auditDate || "", overall: Math.round((prev.overallScore || 0) * 10) / 10 } : null;
    const facts = buildFacts(loaded.model, previous, assessment.status === "completed");
    const brief = await generateConsultantBrief(loaded.model, facts);
    await db.saveOpexAssessment(user.organization_id, {
      id: assessment.id,
      aiBrief: brief,
      quickWins: { items: brief.quickWins, generatedAt: brief.generatedAt, source: "ai" },
    }, user.id);
    res.json({ success: true, data: brief });
  } catch (e: any) {
    console.error("OpEx AI brief failed", e);
    res.status(500).json({ success: false, error: `Danışman özet sunumu oluşturulamadı: ${e?.message || "bilinmeyen hata"}` });
  }
});

// Executive report print view without Chromium measurement — fallback for when the dedicated PDF
// function (api/opex-report.ts → /api/opex-report/:id) is unavailable. Same access rules.
app.get("/api/business/opex-assessments/:id/executive-report.html", authenticateToken, async (req, res) => {
  const loaded = await loadExecutiveReport((req as any).user, req.params.id, { refreshQuickWins: req.query.quickWins === "refresh" });
  if (loaded.ok === false) {
    res.status(loaded.status).json({ success: false, error: loaded.error });
    return;
  }
  res.setHeader("X-Report-Warnings", encodeURIComponent(JSON.stringify(loaded.model.warnings)));
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderReportHtml(loaded.model, { autoPrint: req.query.autoprint !== "0" }));
});

// OpEx question bank (categories + questions) — org-wide, not per-factory: it's the assessment
// methodology itself, shared by every customer's audits, not a customer's data. Read is open to
// any authenticated user; edits are Admin-only.
app.get("/api/business/opex-categories", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  res.json({ success: true, data: await db.getOpexCategories(user.organization_id) });
});

app.post("/api/business/opex-categories", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin") {
    res.status(403).json({ success: false, error: "Sadece yöneticiler soru bankasını düzenleyebilir." });
    return;
  }
  const saved = await db.saveOpexCategory(user.organization_id, { ...req.body }, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/opex-categories/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin") {
    res.status(403).json({ success: false, error: "Sadece yöneticiler soru bankasını düzenleyebilir." });
    return;
  }
  await db.deleteOpexCategory(user.organization_id, req.params.id);
  res.json({ success: true });
});

app.get("/api/business/opex-questions", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  res.json({ success: true, data: await db.getOpexQuestions(user.organization_id) });
});

app.post("/api/business/opex-questions", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin") {
    res.status(403).json({ success: false, error: "Sadece yöneticiler soru bankasını düzenleyebilir." });
    return;
  }
  const saved = await db.saveOpexQuestion(user.organization_id, { ...req.body }, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/opex-questions/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  if (user.role !== "Admin") {
    res.status(403).json({ success: false, error: "Sadece yöneticiler soru bankasını düzenleyebilir." });
    return;
  }
  await db.deleteOpexQuestion(user.organization_id, req.params.id);
  res.json({ success: true });
});


// Gemini Audit with Multi-tenant protection
app.post("/api/gemini/audit", authenticateToken, async (req, res) => {
  try {
    const { 
      factoryData, 
      financials, 
      ganttActivities, 
      spaghettiData,
      calculatedMetrics 
    } = req.body;

    const opexClient = getGeminiClient();

    // Construct a rich, corporate-grade Gemba analysis prompt
    const prompt = `
You are a Senior Operational Excellence (OpEx) and Lean Management Consultant with 15+ years of hands-on shop-floor (Gemba) experience. You act as the core analytical engine for an OpEx Project Management Platform analyzing this factory's current state.

Adhere strictly to the following principles:
1. FIELD-ORIENTED TONE: Avoid generic marketing clichés, buzzwords, or standard corporate "AI-sounding" filler (e.g., do not use phrases like "critical turning point," "holistic digital transformation," or "revolutionary synergy"). Speak directly, logically, and focus on practical, concrete factory floor results with professional, blunt, and highly descriptive Gemba terminology.
2. ANALYTICAL RIGOR: Base your evaluations on the real lean metrics provided.

--- FACTORY OPERATIONAL & FINANCIALS DATA ---
- Sector: ${financials.sector}
- Annual Turnover (Ciro): ${financials.currency}${financials.turnover.toLocaleString()}
- Headcount (Mavi+Beyaz Yaka): ${financials.headcount}
- Operating Profit Target (Faaliyet Kâr Hedefi): ${financials.targetProfitPercent}%
- Total Loss Cost (Hesaplanan Kayıp): ${financials.currency}${calculatedMetrics.totalLossCost.toLocaleString()} (${calculatedMetrics.lossToTurnoverPercent}% of turnover)

--- CYCLE TIMES & BOTTLENECK STATION ---
- Stations & Cycle Times:
${factoryData.stations.map((s: any) => `  * Station "${s.name}": Cycle Time = ${s.cycleTime}s, Downtime Loss = ${s.downtimeHours}h, Scrap Rate = ${s.scrapRate}%`).join("\n")}
- Takt Time: ${factoryData.taktTime}s
- Exact Bottleneck Station Identified: Station "${calculatedMetrics.bottleneckStation}" (Cycle Time ${calculatedMetrics.bottleneckCycleTime}s vs Takt Time ${factoryData.taktTime}s)

--- MASTER PLAN SCHEDULE (GANTT ACTIVITIES) ---
- Activities:
${ganttActivities.map((g: any) => `  * ${g.name}: (Status: ${g.status})`).join("\n")}

--- SPAGHETTI DIAGRAM FLOW DATA ---
- Distances Movement:
  * Raw Material Movement: ${spaghettiData.rawMaterialDistance} meters
  * WIP (Semi-finished) Movement: ${spaghettiData.wipDistance} meters
  * Operator/Human Movement: ${spaghettiData.operatorDistance} meters

--- YOUR EXPLICIT REPORT STEPS ---
Address the plant manager directly. Using your 15+ years of shop floor experience, write a concise, razor-sharp Gemba memo with exactly these headings:

### 1. Darboğaz Analizi ve Hat Dengeleme (Station Bottleneck Analysis)
- Analyze the bottleneck station "${calculatedMetrics.bottleneckStation}" in terms of Takt Time exceedance. Propose 2-3 highly concrete Gemba engineering actions (e.g. tool modifications, internal/external setup conversion SMED, work element transfer) to drop the cycle time below Takt Time.

### 2. İyileştirme Havuzu ve Kayıp Odakları (Loss Prioritization & OpEx Pool)
- Address the Total Loss Cost of ${financials.currency}${calculatedMetrics.totalLossCost.toLocaleString()} (${calculatedMetrics.lossToTurnoverPercent}% of turnover) mapped against the Target Profit of ${financials.targetProfitPercent}%. Meticulously justify how eliminating the top waste categories saves direct operating profit.

### 3. Master Plan Yol Haritası Değerlendirmesi (Sequence Critical Risk Warnings)
- Discuss the Gantt chart sequence. Explain WHY scheduling advanced lean tools (like balancing or cellular manufacturing) before stabilizing processes (5S, standard work, basic time studies) fails in real plant deployments. List 2 sharp risk warnings.

### 4. Akış ve Spaghetti İyileştirme Önerileri (Flow & Motion Waste Reduction)
- Analyze the movement wastes (RM: ${spaghettiData.rawMaterialDistance}m, WIP: ${spaghettiData.wipDistance}m, Operator: ${spaghettiData.operatorDistance}m) and give highly practical layout suggestions (such as U-shaped cell, supermarkets closer to point-of-use, single-piece flow transport) to eliminate transportation/motion waste.

Ensure there are no corporate platitudes. Keep the tone clinical, professional, technical, and full of factory floor lean realism. Write the report primarily in Turkish (as Gemba managers and Turkish plant teams love and use these traditional terms, e.g., duruşlar, ıskarta, adam-fazla, hurda, Çevrim Süresi, Takt Süresi, Kaizen, SMED), but pair them with standard English terms in parentheticals where technically precise.
`;

    const response = await opexClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      report: response.text,
    });

  } catch (error: any) {
    console.error("Gemini Audit Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred during the OpEx AI generation.",
    });
  }
});

// Gemini Executive Insights with Multi-tenant protection
app.post("/api/gemini/executive-insights", authenticateToken, async (req, res) => {
  try {
    const { year, consultant, stats, consultantPerformance, capacityData, riskDistribution, portfolioData } = req.body;
    const client = getGeminiClient();

    const prompt = `
You are "Gemba AI", an elite Operational Excellence (OpEx) Senior Consultant, Lean Production Systems Director, and CFO Advisory Partner with 15+ years of experience leading shop-floor transformations across automotive, white goods, and heavy manufacturing.

Please analyze the following executive KPI dashboard data for year "${year || "All Years"}" and consultant focus "${consultant || "All Consultants"}":

--- GLOBAL WORKSPACE METRICS ---
- Year Filtering: ${year || "All Years"}
- Consultant Focus: ${consultant || "All Consultants"}
- Active Customers: ${stats.activeCustomers}
- Ongoing Projects: ${stats.ongoingProjects}
- Completed Projects: ${stats.completedProjects}
- Total Continuous Improvement (CI) Projects: ${stats.totalCiProjects}
- Total Kaizens Proposed/Logged: ${stats.totalKaizens}
- Expected Financial Savings: ₺${stats.expectedSavings.toLocaleString()}
- Realized Financial Savings: ₺${stats.realizedSavings.toLocaleString()}
- Average Project Success Rate: %${stats.avgSuccessRate}

--- PROJECT HEALTH / RISK MATRIX ---
- Healthy Projects (Sağlıklı): ${riskDistribution.healthy}
- Risky Projects (Riskli): ${riskDistribution.risky}
- Critical Projects (Kritik - Urgent Action Needed): ${riskDistribution.critical}

--- CONSULTANT PERFORMANCE LEADERBOARD ---
${consultantPerformance.map((c: any) => `- Consultant: ${c.name} | Active Proj: ${c.activeProjects} | Closed Proj: ${c.closedProjects} | Kaizens: ${c.kaizensCount} | Realized savings: ₺${c.savings.toLocaleString()} | Deadline Success: ${c.deadlineSuccess}% | Cust Rating: ${c.customerRating}/5 | Man-Days: ${c.manDays} | OEE Gain: +%${c.oeeGain} | LT Reduction: -%${c.leadTimeReduction}`).join("\n")}

--- WORKFORCE CAPACITY MANAGEMENT ---
${capacityData.map((cap: any) => `- Consultant: ${cap.name} | Planned Man-Days: ${cap.plannedDays} days | Realized Man-Days: ${cap.realizedDays} days | Free Capacity: ${cap.freeDays} days | Utilization (Doluluk): %${cap.utilization}`).join("\n")}

--- CUSTOMER PORTFOLIO OVERVIEW ---
${portfolioData.map((p: any) => `- Company: ${p.companyName} | Consultant: ${p.consultantName} | Projects: ${p.projectCount} | Kaizens: ${p.kaizenCount} | Financial Gain: ₺${p.savings.toLocaleString()} | Risk Status: ${p.riskStatus} | Progress: %${p.completion}`).join("\n")}

--- OUTPUT DIRECTIVES ---
Please generate a highly professional, clinical, factory-floor-oriented Operational Excellence report in Turkish. Address the plant director and executive committee directly. Avoid any introductory "AI fluff", marketing boilerplate, or conversational greetings (do NOT say "İşte raporunuz", "Harika bir gün dilerim" or "Sizin için hazırladım"). Start directly with these exact markdown headers:

### Haftalık Yönetici Özeti (Weekly Executive Summary)
- Provide a razor-sharp executive summary in 6-8 direct bullet points. Include concrete numbers from the provided metrics (e.g., number of ongoing/completed projects, total kaizens, expected vs realized financial gains, and exact risk distribution). Specify the current week's status and highlight exceptions.

### AI Önerileri & Aksiyon Planı (AI Recommendations & Action Roadmap)
- Provide 4-5 highly specific, actionable, senior-level recommendations based on the data.
- Analyze individual consultant capacity utilization (e.g., if a consultant is over 90% full, warning against new assignments; if someone is under 70%, suggest assigning them new projects).
- Identify which customers or projects are in "Kritik" status or have stagnated, and suggest immediate shop-floor actions.
- Address where the highest financial ROI or OEE improvements are occurring (e.g., SMED, Energy, Quality) and recommend reinforcing those categories.
- Keep the tone blunt, professional, operational, and rich with technical Turkish lean terms paired with English terms in parentheticals where precise (e.g. Çevrim Süresi, Takt Süresi, Kaizen, Israf/Muda, OEE, SMED).

Ensure the output is beautifully structured and instantly readable.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      report: response.text,
    });

  } catch (error: any) {
    console.error("Gemini Executive Insights Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Yönetici analizleri üretilirken bir hata oluştu."
    });
  }
});

// Gemini Customer Summary endpoint with Multi-tenant protection
app.post("/api/gemini/customer-summary", authenticateToken, async (req, res) => {
  try {
    const { 
      companyName,
      industry,
      productionType,
      employeeCount,
      annualRevenue,
      currency,
      copexScore,
      notes,
      preliminaryAssessmentReport,
      opexInfo,
      operationalInfo
    } = req.body;

    const opexClient = getGeminiClient();

    const prompt = `
Lütfen aşağıdaki sanayi firması için profesyonel bir "Yapay Zeka Yönetici Özeti (AI Executive Summary)" hazırlayın.
Rapor tamamen Türkçe olmalı, fabrikada uygulanabilir, gerçekçi, teknik ve yalın üretim terminolojisine uygun (muda, kaizen, gemba, 5S, OEE, SMED, takt time vb.) bir dille yazılmalıdır.

FİRMA BİLGİLERİ:
- Firma Adı: ${companyName}
- Sektör: ${industry}
- Üretim Tipi: ${productionType}
- Çalışan Sayısı: ${employeeCount}
- Yıllık Ciro: ${currency || "₺"}${annualRevenue?.toLocaleString() || "0"}
- Mevcut Olgunluk Skoru (OpEx Score): %${copexScore || "0"}
- Ön Değerlendirme Bulguları: ${preliminaryAssessmentReport || "Giriş yapılmamış"}
- Genel Notlar: ${notes || "Giriş yapılmamış"}

EK OPERASYONEL BİLGİLER:
${operationalInfo ? JSON.stringify(operationalInfo, null, 2) : "Mevcut değil"}

EK OPEX DURUMU:
${opexInfo ? JSON.stringify(opexInfo, null, 2) : "Mevcut değil"}

Lütfen raporda şu ana başlıkları detaylandırarak yazın:
### 1. Mevcut Yalın Olgunluk Seviyesi Analizi (Current Lean Maturity)
- Firmanın olgunluk skorunu değerlendirin. Gelişim potansiyelini özetleyin.

### 2. Güçlü Yönler (Strong Areas)
- Sektör ve üretim düzenine göre öne çıkan pozitif yönleri listeleyin.

### 3. Zayıf Yönler & Kritik İsraflar (Weak Areas & Muda)
- İyileştirilmesi gereken kritik kayıpları ve muda türlerini tanımlayın.

### 4. En Büyük Kayıp Alanları & Darboğazlar (Biggest Losses & Bottlenecks)
- Operasyonel darboğazları ve OEE'yi düşüren en büyük etkenleri tahmin edin/analiz edin.

### 5. Önerilen Sonraki Yalın Proje & Beklenen ROI / Tasarruf (Recommended Next Project & ROI)
- Bir sonraki adımda başlatılması gereken (örneğin SMED, 5S, Değer Akışı Haritalama) projeyi, tahmini yatırım getirisini (ROI) ve yıllık tasarrufu belirtin.

### 6. Öncelik Matrisi & İyileştirme Yol Haritası (Priority Matrix & Roadmap)
- Adım adım bir yalın iyileştirme gelişim planı önerin.

Hiçbir giriş cümlesi, selamlaşma veya yapay zeka jargonu (örn. "İşte raporunuz", "Harika bir gün dilerim") eklemeden, doğrudan başlıklarla konuya girin. Formatı Markdown yapın.
`;

    const response = await opexClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      summary: response.text,
    });
  } catch (error: any) {
    console.error("Gemini Customer Summary Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Yapay zeka özeti üretilirken bir hata oluştu.",
    });
  }
});


// Gemini OpEx Category Analysis endpoint with Multi-tenant protection
app.post("/api/gemini/opex-category-analysis", authenticateToken, async (req, res) => {
  try {
    const { categoryId, categoryName, questions } = req.body;
    const client = getGeminiClient();

    const questionsList = (questions || [])
      .map((q: any) => `- Soru [${q.id}] (${q.subject}): İdeal Durum: "${q.idealState}". Alınan Puan: ${q.score}/5. Puan Tanımı: "${q.rubricText || ""}". Yorum: "${q.comment || ""}"`)
      .join("\n");

    const prompt = `
Sen 15+ yıllık saha tecrübesine sahip kıdemli bir Operasyonel Mükemmellik (OpEx) ve Yalın Yönetim danışmanısın.
Şu anda bir fabrikada yapılan OpEx değerlendirmesinin "${categoryId} - ${categoryName}" bölümünü (kategorisini) analiz ediyorsun.

Bu kategorideki soru başlıkları ve alınan puanlar/saha tespitleri aşağıdadır:
${questionsList}

Senden ricam, bu kategorideki saha olgunluk seviyesini, güçlü ve zayıf yönlerini analiz ederek, tam olarak 3 cümleden oluşan genel bir bölüm değerlendirmesi (özet tespit raporu) yazmandır.
Kesinlikle yapay zeka jargonu ("merhaba", "işte analiziniz", "bu kategorideki durum şöyledir" vb.) veya pazarlama dili kullanma. Doğrudan profesyonel, klinik ve teknik değerlendirmeyle başla ve bitir.
Sadece 3 cümle uzunluğunda olsun, ne eksik ne fazla. Türkçe yaz.

Örnek çıktı formatı:
"Yönetim süreçlerle ilgili farkındalık çalışmalarını başlatmış, ama sistem gelişimini izlemek için bir KPI monitorleme sistemi oluşturmamış ve gerekli bütçeleri ayırmamış. Sahada çalışanların katılımını artırmak için ödüllendirme mekanizmaları tasarlanmalı ancak henüz bir pilot çalışma yapılmamıştır. Bu durum operasyonel iyileştirmelerin tabana yayılmasını ve sürdürülebilirliğini kısıtlamaktadır."
    `;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      analysis: response.text.trim(),
    });
  } catch (error: any) {
    console.error("Gemini OpEx Category Analysis Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Bölüm değerlendirmesi üretilirken bir hata oluştu.",
    });
  }
});


// MASTER PLAN TIMELINE AND RESOURCE UTILIZATION ANALYSIS ENDPOINT
app.post("/api/gemini/masterplan-analyze", authenticateToken, async (req, res) => {
  try {
    const { activities, visits, contractPackage, stats, language } = req.body;
    const client = getGeminiClient();
    
    const isTurkish = language !== "en";
    const prompt = `
You are a Senior Enterprise SaaS Architect, Lean Transformation Consultant, and Project Management UX Expert.
Analyze the following Lean Transformation project's master plan timeline data and consulting utilization to generate an executive-level AI Project Summary:

CONTRACT CONFIGURATION:
- Consulting Package: ${contractPackage?.name || "Not set"} (${contractPackage?.value || 0} Man-Days/Week)
- Weekly Capacity: ${contractPackage?.value || 0} Man-Days
- Total Planned Man-Days: ${stats?.totalPlannedManDays || 0}
- Consumed Man-Days (from recorded visits): ${stats?.consumedManDays || 0}
- Remaining Man-Days: ${stats?.remainingManDays || 0}

ACTIVITIES:
${(activities || []).map((a: any) => `- No: ${a.activityNo || "N/A"}, Name: ${a.name}, Category: ${a.category || "N/A"}, Priority: ${a.priority}, Status: ${a.status}, Progress: %${a.progressPercent}, Planned Week: W${a.plannedStartWeek || "?"}-W${a.plannedFinishWeek || "?"}, Actual Week: W${a.actualStartWeek || "?"}-W${a.actualFinishWeek || "?"}, Responsible: ${a.responsibleConsultant || "N/A"}`).join("\n")}

RECORDED SITE VISITS:
${(visits || []).map((v: any) => `- Date: ${v.date}, Consultant: ${v.consultant}, Duration: ${v.duration} Man-Days, Activities: ${v.activitiesPerformed?.join(", ") || "None"}, Deliverables: ${v.deliverables || "N/A"}`).join("\n")}

Please provide a highly structured, professional, executive-friendly report in ${isTurkish ? "Turkish" : "English"} using professional lean consulting terminology. Include exactly these markdown headers:

### 1. Proje İlerleme ve Tamamlanma Özeti (Project Progress Summary)
- Provide a summary of current project progression, key highlights, and forecasted completion date.

### 2. Geciken ve Riskli Faaliyetler (Delayed & Risky Activities)
- Identify activities that are delayed or behind schedule (Actual Finish Week is greater than Planned Finish Week, or progress is insufficient).

### 3. Kritik Yol ve Yaklaşan Önemli Görevler (Critical Path & Upcoming Key Tasks)
- Identify the next critical activities and milestones (e.g. Current State, SMED, Kaizen) and potential scheduling conflicts.

### 4. Danışmanlık Kapasite ve Kaynak Analizi (Consulting Capacity & Resource Utilization)
- Analyze if the current package of ${contractPackage?.value || 0} man-days/week is sufficient, identify if there are overbooked or underutilized weeks, and list resource conflicts.

### 5. Risk Değerlendirmesi ve Çatışma Analizi (Risk Assessment & Conflicts)
- Discuss potential sequencing risks (e.g., trying to do Line Balancing before Time Study or 5S) and organizational resistance indicators.

### 6. Önerilen Aksiyon Planı ve Yol Haritası (Recommended Action Plan)
- Provide 3-4 concrete next steps for the OpEx consultants and customer owners to get back on track or accelerate progress.

Do NOT include any conversational greetings or introductory/concluding filler words. Start directly with the markdown headers. Use clean, professional typography and visual layout.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      report: response.text,
    });
  } catch (error: any) {
    console.error("Gemini Master Plan Analyze Error:", error);
    res.status(500).json({ success: false, error: error.message || "Yapay zeka analizi oluşturulurken bir hata oluştu." });
  }
});

// AI OPEX Transformation Planner — unlike every other /api/gemini/* route above (all free-text
// markdown), this one drives an editable activity list downstream, so it asks Gemini for
// schema-constrained JSON (responseMimeType/responseSchema) instead of markdown+regex-extraction.
// Week-by-week scheduling is deliberately NOT requested from the model — it returns relative
// durationWeeks/dependencies only; the client computes actual plannedStartWeek/plannedFinishWeek
// (see scheduleAiProposal in MasterPlanGantt.tsx), since LLM week arithmetic isn't reliable enough
// to trust for real Gantt placement.
const OPEX_TRANSFORMATION_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    currentStateSummary: { type: Type.STRING, description: "2-4 sentence summary of the factory's current OPEX maturity, in Turkish." },
    priorityProblems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Ranked list of the most urgent problems to address, in Turkish." },
    phases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          phaseLabel: { type: Type.STRING, description: "Short relative phase label, e.g. F1, F2, F3." },
          phaseName: { type: Type.STRING, description: "Human-readable phase name in Turkish, e.g. 'Temel Veri Toplama'." },
          activities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tempId: { type: Type.STRING, description: "Unique id within this proposal only, e.g. P01, P02." },
                name: { type: Type.STRING },
                category: { type: Type.STRING, description: "One of: 5S Audit, SMED, Yamazumi, VSM, Spaghetti, Time Study, Kaizen, OEE, Capacity Analysis, Saha Gözlemi, Süreç Analizi, Kick Off, Eğitim." },
                durationWeeks: { type: Type.INTEGER, description: "Suggested duration in weeks, relative — not an absolute calendar week." },
                plannedManDays: { type: Type.INTEGER, description: "Suggested consultant man-days for this activity." },
                responsibleRole: { type: Type.STRING, description: "A generic role label (e.g. 'Yalın Danışman', 'Proje Lideri'), never a specific person's name." },
                dependencies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "tempIds of other proposed activities this one depends on, or empty array." },
                rationale: { type: Type.STRING, description: "1-2 sentence explanation in Turkish of why this activity is proposed." }
              },
              required: ["tempId", "name", "category", "durationWeeks", "plannedManDays", "responsibleRole", "dependencies", "rationale"]
            }
          }
        },
        required: ["phaseLabel", "phaseName", "activities"]
      }
    }
  },
  required: ["currentStateSummary", "priorityProblems", "phases"]
};

app.post("/api/gemini/opex-transformation-plan", authenticateToken, async (req, res) => {
  try {
    const { narrative, masterPlanSummary, moduleSnapshots, language } = req.body;
    if (!narrative || !narrative.trim()) {
      res.status(400).json({ success: false, error: "Fabrika mevcut durumu ve hedefleri açıklaması gerekli." });
      return;
    }
    const client = getGeminiClient();
    const isTurkish = language !== "en";
    const snapshots = moduleSnapshots || {};

    // The consultant's own narrative is a genuine current-state input, not a summary to restate —
    // it must be synthesized together with whatever system data exists, not echoed back as if the
    // consultant's own sentences were "findings." OPEX Assessment is the one module this route
    // explicitly branches on (per the user's own scoping): if it's empty, say so and lean on the
    // narrative alone for that dimension; if it has data, both must be reasoned over together.
    const hasOpexAssessmentData = Array.isArray(snapshots.opexAssessments) && snapshots.opexAssessments.length > 0;
    const opexAssessmentInstruction = hasOpexAssessmentData
      ? "OPEX Assessment verisi mevcut — mutlaka aşağıdaki OPEX Assessment kayıtlarını (skor/kategori bilgisi) danışmanın açıklamasıyla BİRLİKTE değerlendirerek analiz yap; ikisi arasında çelişki varsa bunu öncelikli problem olarak belirt."
      : "OPEX Assessment verisi bulunmuyor — bu boşluğun kendisini bir öncelik problemi olarak belirt ve mevcut durum/hedefler için SADECE danışmanın açıklamasına dayan.";

    const prompt = `
You are a Senior OpEx / Lean Transformation Consultant building a phased transformation roadmap for a factory, in ${isTurkish ? "Turkish" : "English"}.

CONSULTANT'S DESCRIPTION OF CURRENT STATE AND GOALS — this is a raw input to analyze, not a summary to repeat. Never copy or lightly reword the consultant's own sentences into "currentStateSummary" or "priorityProblems" — read it, combine it with the system data below, and produce your own synthesized assessment and findings:
"""
${narrative}
"""

OPEX ASSESSMENT DATA RULE: ${opexAssessmentInstruction}
For every OTHER module below that is empty, treat it the same way: an empty module has no data yet, which is itself worth naming as a gap, and for that specific dimension you fall back to the narrative; a module with data must be reasoned over alongside the narrative, not ignored.

EXISTING MASTER PLAN CAPACITY (do not propose more total plannedManDays across all activities than the remaining budget below — treat this as a hard ceiling):
- Weekly consulting capacity: ${masterPlanSummary?.weeklyCapacity ?? "unknown"} man-days/week
- Total contracted capacity so far: ${masterPlanSummary?.totalConsultingCapacity ?? "unknown"} man-days
- Already consumed: ${masterPlanSummary?.consumedManDays ?? 0} man-days
- Remaining budget for new proposed work: ${masterPlanSummary?.unusedCapacity ?? "unknown"} man-days

EXISTING SYSTEM DATA (trimmed, most recent records; use to ground the current-state summary and avoid proposing work that's already done):
- OPEX Assessments: ${JSON.stringify(snapshots.opexAssessments || [])}
- VSM Projects: ${JSON.stringify(snapshots.vsmProjects || [])}
- Loss Capacity Settings: ${JSON.stringify(snapshots.lossCapacitySettings || {})}
- PTR / Time Study records: ${JSON.stringify(snapshots.timeStudies || [])}
- Yamazumi Studies: ${JSON.stringify(snapshots.yamazumiStudies || [])}
- SMED Projects: ${JSON.stringify(snapshots.smedProjects || [])}
- 5S Audits: ${JSON.stringify(snapshots.audits5S || [])}
- Kaizen Projects: ${JSON.stringify(snapshots.kaizens || [])}

Propose a phased transformation roadmap: a current-state summary (your own synthesis, not a restatement of the narrative), ranked priority problems (specific and diagnostic, not generic restatements of what the consultant already said), and 2-5 phases each with a small set of concrete activities (name, category, suggested duration in weeks, suggested man-days, a generic responsible role, dependencies on other proposed activities by tempId, and a short rationale for why each activity is proposed — the rationale must reference the actual data or narrative point that justifies it). Order phases and activities logically (e.g. measurement/data-collection before analysis, current-state analysis before future-state design, foundational work before advanced pull-system work). Keep total proposed man-days within the remaining budget stated above.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: OPEX_TRANSFORMATION_PLAN_SCHEMA
      }
    });

    let parsedPlan: any;
    try {
      parsedPlan = JSON.parse(response.text || "");
    } catch (parseErr) {
      console.error("Gemini OPEX Transformation Plan — failed to parse structured JSON response:", parseErr, response.text);
      res.status(502).json({ success: false, error: "Yapay zeka yanıtı ayrıştırılamadı, lütfen tekrar deneyin." });
      return;
    }

    res.json({ success: true, plan: parsedPlan });
  } catch (error: any) {
    console.error("Gemini OPEX Transformation Plan Error:", error);
    res.status(500).json({ success: false, error: error.message || "Yapay zeka dönüşüm planı oluşturulurken bir hata oluştu." });
  }
});


// YAMAZUMI SYSTEM API ENDPOINTS
app.post("/api/gemini/yamazumi-analyze", authenticateToken, async (req, res) => {
  try {
    const { elements, stats, taktTime, language } = req.body;
    const client = getGeminiClient();

    const isTurkish = language === "tr";
    const wasteElements = (elements || [])
      .filter((e: any) => e.workClass === "W")
      .sort((a: any, b: any) => (b.standardCycleTime || 0) - (a.standardCycleTime || 0));
    const nvaElements = (elements || [])
      .filter((e: any) => e.workClass === "NVA")
      .sort((a: any, b: any) => (b.standardCycleTime || 0) - (a.standardCycleTime || 0));

    const prompt = `
You are an expert Industrial Engineer and Lean Manufacturing Consultant specializing in Motion Studies and Yamazumi Line Balancing (Timer Pro, AviX, OTRS10 style).
Analyze the following process study elements and statistics gathered from video analysis. This is a coaching tool — the operator/consultant needs a clear, prioritized action plan, not just a description of the numbers.

TARGET TAKT TIME: ${taktTime}s

STUDY ELEMENTS (sorted by seq):
${elements.map((e: any) => `- Seq: ${e.seqNo}, Name: ${e.processName}, Element: ${e.workElement}, Class: ${e.workClass}, Type: ${e.workType}, Std Cycle Time: ${e.standardCycleTime}s`).join("\n")}

WASTE (W) ELEMENTS RANKED BY DURATION (largest first):
${wasteElements.length > 0 ? wasteElements.map((e: any) => `- ${e.processName} / ${e.workElement}: ${e.standardCycleTime}s`).join("\n") : "None flagged as Waste."}

NVA ELEMENTS RANKED BY DURATION (largest first):
${nvaElements.length > 0 ? nvaElements.map((e: any) => `- ${e.processName} / ${e.workElement}: ${e.standardCycleTime}s`).join("\n") : "None flagged as NVA."}

AGGREGATE STATISTICS:
- Total Cycle Time: ${stats.totalCycleTime}s
- VA Time: ${stats.vaTime}s (Ratio: ${stats.vaRate}%)
- NVA Time: ${stats.nvaTime}s (Ratio: ${stats.nvaRate}%)
- Walk/Waiting (Loss) Time: ${stats.wTime}s (Ratio: ${stats.wRate}%)
- Average Cycle Time: ${stats.averageCycleTime}s
- Number of Elements: ${stats.numElements}
- Extreme Bottleneck Element: ${stats.bottleneckElement}
- Largest Loss Activity: ${stats.largestLoss}
- Largest Opportunity: ${stats.largestOpportunity}

Please provide a highly structured, professional, dark-themed industrial software style markdown report with exactly these sections, in this order. Avoid any conversational greeting, play right into the facts:

### 1. Takt Time vs Bottleneck Analysis
- State the target takt time and the bottleneck element's cycle time explicitly, and whether the line is currently capable of meeting takt (bottleneck CT <= takt time) or not, and by how much/what %.
- If multiple elements exceed takt time, list them in order of severity.

### 2. Waste (W) & NVA Loss Ranking
- State the total waste (W) time and its % of cycle time.
- Name the single largest-waste process/element explicitly, with its duration and % contribution.
- Do the same for the largest NVA element.
- Explain concretely what about this element makes it non-value-added (motion, waiting, overprocessing, transport).

### 3. Line Balancing Improvement Order
- Give a numbered, prioritized sequence of which elements/stations to fix first, second, third... to bring the line into takt-time balance as efficiently as possible. Base the order on impact (largest takt-time violation and largest waste first), not just element sequence number.
- For each step in the order, state the expected cycle-time reduction if that fix is implemented.

### 4. Kaizen Recommendations (High / Medium / Low Impact)
- Give at least 3 concrete, actionable kaizen recommendations tied directly to the specific elements named above (not generic advice). Follow this style:
  - "Element X consumes Y% of total cycle time and contains Z% non-value-added activity. Combining material supply with a milk-run system reduces A seconds."
  - "Operator walking activity can be eliminated by relocating box positions."
  - "Periodic activities occurring every N cycles can be externalized."

### 5. COPQ Opportunity Loss Calculation
- Provide a rigorous calculation of current total cycle time vs potential eliminated losses. Estimate the Recoverable Time, Expected Future Cycle Time, and % Improvement.

Please write this entire report in ${isTurkish ? "Turkish" : "English"} with professional industrial terminology.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      report: response.text,
    });
  } catch (error: any) {
    console.error("Yamazumi Analyze Error:", error);
    res.status(500).json({ success: false, error: error.message || "Gemini analysis error" });
  }
});

app.post("/api/gemini/yamazumi-chat", authenticateToken, async (req, res) => {
  try {
    const { message, history, elements, stats, taktTime, language } = req.body;
    const client = getGeminiClient();

    const isTurkish = language === "tr";
    const historyParts = (history || []).map((h: any) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }]
    }));

    const wasteElements = (elements || [])
      .filter((e: any) => e.workClass === "W")
      .sort((a: any, b: any) => (b.standardCycleTime || 0) - (a.standardCycleTime || 0));

    // Add system context as part of the prompt
    const systemInstruction = `
You are a Yamazumi AI Lean Manufacturing Assistant inside a professional industrial motion study and work-balancing software, acting as an on-demand coach for the consultant using this tool.
You have real-time access to the user's active study data:

TARGET TAKT TIME: ${taktTime}s

STUDY ELEMENTS:
${elements.map((e: any) => `- Seq: ${e.seqNo}, Name: ${e.processName}, Element: ${e.workElement}, Class: ${e.workClass}, Type: ${e.workType}, Std Cycle Time: ${e.standardCycleTime}s`).join("\n")}

WASTE (W) ELEMENTS RANKED BY DURATION:
${wasteElements.length > 0 ? wasteElements.map((e: any) => `- ${e.processName} / ${e.workElement}: ${e.standardCycleTime}s`).join("\n") : "None flagged as Waste."}

AGGREGATE STATISTICS:
- Total Cycle Time: ${stats.totalCycleTime}s (VA: ${stats.vaTime}s / ${stats.vaRate}%, NVA: ${stats.nvaTime}s / ${stats.nvaRate}%, Loss-W: ${stats.wTime}s / ${stats.wRate}%)
- Average Cycle Time: ${stats.averageCycleTime}s
- Bottleneck Element: ${stats.bottleneckElement}
- Largest Loss Category: ${stats.largestLoss}
- Largest Opportunity: ${stats.largestOpportunity}

Answer the user's questions in detail, being concise, technical, and factory-floor-oriented. Use exact stats, times, and percentages.
Whenever relevant, ground your answer in: (1) whether the bottleneck is within takt time or not and by how much, (2) which specific element carries the most waste, (3) what order of fixes would balance the line fastest, and (4) a concrete kaizen action tied to a named element — not generic advice.
Provide solutions using Lean methodologies: 5S, SMED, Line Balancing, Kaizen, Milk-run systems, cell re-layout, visual controls, and single-piece flow.
Speak in ${isTurkish ? "Turkish" : "English"}.
`;

    const chatObj = client.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
      },
      history: historyParts,
    });

    const response = await chatObj.sendMessage({ message });
    res.json({
      success: true,
      reply: response.text,
    });
  } catch (error: any) {
    console.error("Yamazumi Chat Error:", error);
    res.status(500).json({ success: false, error: error.message || "Gemini chat error" });
  }
});


// GEMINI SMED COACH ENDPOINT WITH GOOGLE SEARCH GROUNDING
app.post("/api/gemini/smed-coach", authenticateToken, async (req, res) => {
  try {
    const { project, activities } = req.body;
    const client = getGeminiClient();

    const prompt = `
You are "SMED AI", an elite Operational Excellence (OpEx) Senior Consultant, Lean Production Systems Director, and SMED (Single-Minute Exchange of Die) Master Coach with 20+ years of shop-floor experience across automotive, aerospace, and heavy packaging.

Please analyze the following SMED Project and Activity data to generate a razor-sharp, practical, clinical, and highly actionable SMED Coaching Report.

SMED PROJECT DETAILS:
- Code: ${project?.code || "N/A"}
- Name: ${project?.name || "N/A"}
- Lead: ${project?.leader || "N/A"}
- Machine: ${project?.machineNo || "N/A"}
- Mold/Die: ${project?.moldNo || "N/A"}
- Product Name: ${project?.productName || "N/A"}
- Current Setup Time: ${project?.currentSetupTime || 0} dk
- Target Setup Time: ${project?.targetSetupTime || 0} dk

ACTIVITIES TABLE & SELECTED ECRS SAVINGS:
${(activities || []).map((a: any, i: number) => `
* Sıra ${a.sequence || i+1}: ${a.name}
  - Durasyon: ${a.dur} dk (Tip: ${a.type}, Başlangıç Tipi: ${a.originalType})
  - ECRS Seçimleri: ${a.ecrsSteps?.join(", ") || "Seçilmedi"}
  - ECRS Kazanımları: E:${a.ecrsGains?.E || 0} dk, C:${a.ecrsGains?.C || 0} dk, R:${a.ecrsGains?.R || 0} dk, S:${a.ecrsGains?.S || 0} dk
  - ECRS Aksiyonu: ${a.ecrsAction || "Girilmemiş"}
  - Sorumlu: ${a.ecrsResponsible || "Belirtilmemiş"} | Termin: ${a.ecrsDate || "Girilmemiş"} | Durum: ${a.ecrsStatus || "Açık"}
`).join("\n")}

CRITICAL DIRECTIVES:
1. USE GOOGLE SEARCH GROUNDING: Use the search tool to research modern, world-class quick-changeover solutions, clampings, magnetic clamping plates, quick-couplings, and specialized SMED techniques for a "${project?.machineNo || "die/mold"}" changeover.
2. HIGH-YIELD SUGGESTIONS: Identify the biggest mudas (walking, searching, waiting for forklift, waiting for heating, bolting/unbolting) from the activities table and suggest concrete solutions.
3. STRUCTURE & HEADINGS: Start directly answering the question in Turkish. Avoid any introductory "AI fluff", marketing boilerplate, or conversational greetings. Use exactly these markdown headers:

### 1. Genel SMED ve Kurulum Performans Değerlendirmesi (Performance Overview)
Provide a clinical evaluation of the current setup time (${project?.currentSetupTime || 0} dk) versus target (${project?.targetSetupTime || 0} dk). Evaluate the ratio of internal to external steps, and identify process wastes shown in the data.

### 2. Kritik Darboğazlar ve Öncelikli İyileştirme Odakları (Focus Areas)
Identify 2-3 specific activities from the table that consume the most time and are prime candidates for conversion (Internal to External) or major reduction. Propose mechanical, organizational, or sequence-based changes for these.

### 3. Sektörel Araştırma Bulguları ve Hızlı Kazanç Sağlayacak Alanlar (Quick Wins)
Use your Google Search grounding findings to list 2-3 highly specific, state-of-the-art fast mold/die change technologies (e.g., magnetic clamping systems, quick connection plates, pneumatic quick clamps, or preheating systems) that apply to "${project?.machineNo || "this machine/mold"}".

### 4. Süreç Hızlandırma ve ECRS Yol Haritası (ECRS Roadmap)
Give 4 concrete, numbered steps for the plant team to take immediately. Guide them on Standard Work sheet updates, pre-heating optimization, standardizing die heights, and using standardized tools. Keep the language direct, authoritative, and clinical Turkish lean terminology.

Format the output cleanly in Markdown.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        toolConfig: { includeServerSideToolInvocations: true }
      }
    });

    res.json({
      success: true,
      report: response.text,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    });

  } catch (error: any) {
    console.error("Gemini SMED Coach Error:", error);
    
    // GENERATE A GORGEOUS HIGH-QUALITY CLINICAL TURKISH REPORT AS FALLBACK FOR RESOURCE_EXHAUSTED OR QUOTA ERRORS
    try {
      const { project, activities } = req.body;
      const curTime = project?.currentSetupTime || 55;
      const tarTime = project?.targetSetupTime || 24;
      const machine = project?.machineNo || "Pres Hattı / Enjeksiyon";
      
      const actList = activities || [];
      const longestActs = [...actList]
        .sort((a, b) => b.dur - a.dur)
        .slice(0, 3);
        
      const internalSteps = actList.filter((a: any) => a.originalType === "internal");
      const externalSteps = actList.filter((a: any) => a.originalType === "external");
      const totalGain = actList.reduce((sum: number, a: any) => {
        const gains = a.ecrsGains || {};
        return sum + (gains.E || 0) + (gains.C || 0) + (gains.R || 0) + (gains.S || 0) + (a.originalType === "internal" && a.type === "external" ? a.dur : 0);
      }, 0);

      const fallbackReport = `
> 💡 **Sistem Bilgisi:** *Gemini API Kota limitleri nedeniyle, SMED AI Motoru yerel uzman kütüphanesi ve çevrimdışı analitik motoru kullanılarak hazırlanmış, sahaya özel SMED Koçluk Raporudur.*

### 1. Genel SMED ve Kurulum Performans Değerlendirmesi (Performance Overview)
* **Mevcut Durum Analizi:** Analiz edilen **${machine}** makinesindeki kalıp değişim süreci, mevcut ölçüm verilerine göre **${curTime} dakika** sürmektedir. 
* **Yalın Hedef Performansı:** Belirlenen ECRS ve dönüşüm aksiyonlarıyla setup süresinin **${tarTime} dakikaya** indirilmesi planlanmaktadır (Hedeflenen İyileşme Oranı: **%${Math.round((totalGain / Math.max(1, curTime)) * 100)}**).
* **İç/Dış Hazırlık Dengesi:** Ölçülen adımların **${internalSteps.length} adedi** İç Hazırlık (makine dururken), **${externalSteps.length} adedi** ise Dış Hazırlık (makine çalışırken) olarak sınıflandırılmıştır. İç hazırlık adımlarının toplam içindeki yüksek payı, üretim duruşlarındaki ana kayıptır.

### 2. Kritik Darboğazlar ve Öncelikli İyileştirme Odakları (Focus Areas)
Veritabanındaki süreç verilerine göre, kurulum süresini en çok uzatan ve acil iyileştirme gerektiren **en büyük 3 darboğaz adımı** aşağıda listelenmiştir:

${longestActs.map((act: any, idx: number) => `
${idx + 1}. **${act.name}** (${act.dur} dk - Tip: *${act.originalType === "internal" ? "İç Hazırlık" : "Dış Hazırlık"}*)
   * *Yalın Öneri:* ${act.name.toLowerCase().includes("civata") || act.name.toLowerCase().includes("sıkma") 
     ? "Cıvatalı bağlantıları kaldırıp çeyrek turlu kelepçeler, U-pulları veya manyetik kilitler uygulayın. Dişli sayısını azaltın." 
     : act.name.toLowerCase().includes("hortum") || act.name.toLowerCase().includes("bağlantı")
     ? "Hortum bağlantılarında hızlı kilitli rakor (quick-coupling) ve çoklu medya paneli kullanarak montajı tek harekete indirin."
     : "Süreci standartlaştırın, el aletlerini ve kalıp taşıma aparatlarını önceden tanımlanmış lokasyonlara (gölge panolara) yerleştirin."}
`).join("\n")}

### 3. Sektörel Araştırma Bulguları ve Hızlı Kazanç Sağlayacak Alanlar (Quick Wins)
Dünya standartlarında hızlı kalıp değişimi (SMED) uygulamaları araştırıldığında, **${machine}** gibi sistemlerde en yüksek verim sağlayan "Hızlı Kazanç" (Quick Wins) alanları şunlardır:
1. **Manyetik ve Hidrolik Kalıp Sıkma (Magnetic Clamping):** Mekanik vidalamaları tamamen sıfırlayarak kalıp sabitleme süresini 10 dakikadan 15 saniyeye düşürür.
2. **Kalıp Ön Isıtma İstasyonları (Pre-heating):** Kalıp makineye girmeden önce dışarıda hedef sıcaklığa ulaştırılır. Böylece makine içi bekleme süresi tamamen elimine edilir.
3. **Çoklu Bağlantı Plakaları (Multi-Coupling Plates):** Su, hidrolik ve elektrik hatları tek bir soketle eş zamanlı olarak bağlanır. Hatalı bağlantı riskini sıfırlar.

### 4. Süreç Hızlandırma ve ECRS Yol Haritası (ECRS Roadmap)
Operasyon ekibinin kurulum süresini kısaltması için takip etmesi gereken **4 aşamalı aksiyon planı**:
1. **Dış Hazırlıkların Standartlaştırılması:** Makine durmadan önce yapılacak tüm işleri (yeni kalıbın getirilmesi, ısıtılması, el aletlerinin hazırlanması) kapsayan "Dış Hazırlık Kontrol Listesi" (Checklist) oluşturun.
2. **Vidalamaları El Hamlelerine Dönüştürme:** Dişli cıvataları iptal edin. Mümkün olan her yerde kam mekanizmaları, pimler ve geçmeli kilitleme sistemleri kullanın.
3. **Kalıp Yüksekliklerinin Standardizasyonu:** Ara plakalar (spacers) kullanarak farklı kalıpların yüksekliklerini / strok ayar mesafelerini tek bir ortak seviyeye sabitleyin.
4. **Görsel Yönetim ve Gölge Panolar:** İlgili kalıp değişimi için gerekli olan tüm anahtarları ve aparatları özel renk kodlu arabalarda (SMED Trolley) depolayarak arama kayıplarını sıfırlayın.
`;

      return res.json({
        success: true,
        report: fallbackReport,
        groundingChunks: [{ title: "SMED Offline Expert Library", url: "https://kaizen.org" }]
      });
    } catch (fallbackError) {
      return res.status(429).json({
        success: false,
        error: "Yapay zeka analiz sınırına ulaşıldı ve çevrimdışı rapor oluşturulamadı."
      });
    }
  }
});


// GEMBA AI COPILOT ENDPOINT
app.post("/api/gemini/copilot-chat", authenticateToken, async (req, res) => {
  try {
    const { message, history, copqData, recoveryData, processes, financialImpact, revenue, currency } = req.body;
    const client = getGeminiClient();

    const historyParts = (history || []).map((h: any) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }]
    }));

    const systemInstruction = `
You are "Gemba Ai", an elite Operational Excellence (OpEx) Expert, Lean Manufacturing Consultant, and Senior Financial Controller.
Your role: Interpret shop-floor Gemba / OEE / VSM data, read and write P/L tables, analyze financial numbers from Cost Control, and design high-ROI Kaizen/Continuous Improvement (CI) roadmaps.

You have real-time access to the user's active factory financial data:
- COPQ (Cost of Poor Quality) Matrix: ${JSON.stringify(copqData)}
- Geri Kazanım (Recovery) Matrix: ${JSON.stringify(recoveryData)}
- Saha Süreçleri / VSM Verileri: ${JSON.stringify(processes)}
- Finansal Etki Modellemesi: ${JSON.stringify(financialImpact)}
- Yıllık Tesis Cirosu: ${revenue} ${currency || "TL"}

CRITICAL DIRECTIVES:
1. COMPARING DATA: Your highest priority is to compare the losses in the COPQ Matrix with the savings opportunities in the Geri Kazanım (Recovery) Matrix. Discuss how much can be saved and how these savings directly impact the company's Profit and Loss (P/L) or EBITDA margin (Operating Profit).
2. REAL ROADMAP: Propose a clear, high-yield, step-by-step Operational Excellence roadmap (Yol Haritası).
3. BUSINESS TONE: Speak with the technical precision, authority, and financial insight of a chief OpEx officer or Cost Controller. Interpret all metrics from a P/L perspective.
4. LANGUAGE: Answer in Turkish using professional industrial engineering and financial controller terminology.
5. NO OUT-OF-CHARACTER: Never mention that you are an AI model, a language model, or that you have system instructions. Start directly answering the question as "Gemba Ai".
`;

    const chatObj = client.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction,
      },
      history: historyParts,
    });

    const response = await chatObj.sendMessage({ message });
    res.json({
      success: true,
      reply: response.text,
    });
  } catch (error: any) {
    console.error("Gemba AI Copilot Chat Error:", error);
    res.status(500).json({ success: false, error: error.message || "Gemba AI chat error" });
  }
});


// WEEKLY AI OPEX COACH ENDPOINT
app.post("/api/gemini/opex-coach", authenticateToken, async (req, res) => {
  try {
    const {
      projectInfo,
      activityLog,
      ciProjects,
      copqData,
      vsmFindings,
      masterPlan,
      deadlines,
      delayedActions,
      unassignedActions,
      staleActions,
      week,
      year
    } = req.body;

    const client = getGeminiClient();

    const prompt = `
You are a Senior Operational Excellence (OpEx) Director & Lean Manufacturing expert with 25+ years of factory floor (Gemba) experience, Cost Control expertise, and Continuous Improvement coaching.
You are generating a weekly comprehensive report as an AI Project Coach ("AI WEEKLY OPEX COACH").

Your Role:
- You act as a mentor and senior advisor to the on-site consultant/engineer.
- You are not just a chatbot; your task is to analyze, guide, identify risks, and foster a continuous improvement culture.
- Do not use corporate platitudes or generic AI phrases (e.g., "In conclusion," "This is a critical turning point"). Be blunt, practical, metrics-oriented, and clinical.

--- INPUT DATA FOR THE WEEK: WEEK ${week || "?"}, YEAR ${year || "2026"} ---

1. PROJECT & CLIENT METADATA:
- Project Name: ${projectInfo?.projectName || "Gemba Lean Transformation"}
- Customer: ${projectInfo?.customerName || "Selected Customer"}
- Factory Name: ${projectInfo?.factoryName || "Plant A"}
- Department: ${projectInfo?.departmentName || "All Production"}
- Lead Consultant: ${projectInfo?.consultantName || "OpEx Consultant"}
- Start Date: ${projectInfo?.startDate || "N/A"}
- Key Goals: ${projectInfo?.goals || "Stabilizing process cycle times, reducing waste, 5S, and establishing OEE tracking"}

2. WEEKLY ACTIVITIES (PROJECT ACTIVITY LOGS FROM THIS WEEK):
${(activityLog || []).map((a: any) => `- Row ID: ${a.id}, Date: ${a.workDate}, Activity: ${a.activitySubject}, Work Done: ${a.workDone}, Output: ${a.output}, Responsible: ${a.responsible}, Status: ${a.status}, Savings: ${a.kaizenSavings || "0"} ${a.savingsCurrency || ""}`).join("\n") || "No recorded logs for this week."}

3. CI PROJECTS / THEMES ACTIVE:
${(ciProjects || []).map((p: any) => `- ID: ${p.id}, Theme: ${p.name}, Status: ${p.status}, Progress: ${p.progressPercent}%, Owner: ${p.owner || "Unassigned"}`).join("\n") || "No CI Projects tracked."}

4. COPQ (COST OF POOR QUALITY) IN FOCUS:
${(copqData || []).map((c: any) => `- Area: ${c.name || c.category}, Current Level/Cost: ${c.cost || c.value || "N/A"}, Target: ${c.target || "N/A"}`).join("\n") || "No specific COPQ logs recorded."}

5. VSM (VALUE STREAM MAPPING) PROBLEMS IDENTIFIED:
${(vsmFindings || []).map((v: any) => `- Problem: ${v.problem || v.name || v.description}, Impact: ${v.impact || "N/A"}`).join("\n") || "No active VSM findings listed."}

6. MASTER PLAN TARGETS FOR THIS WEEK:
${(masterPlan || []).map((m: any) => `- Task: ${m.name}, Planned Week: W${m.plannedStartWeek || m.startWeek}-W${m.plannedFinishWeek || m.finishWeek}, Current Status: ${m.status}, Progress: ${m.progressPercent}%`).join("\n") || "No explicit tasks assigned in Master Plan for this week."}

7. TIMELINES & ACTIONS METRICS (ALL OPEN TASKS & ACTIONS):
- Total Open Tasks Analyzed: ${(deadlines || []).length}
- Delayed Actions:
${(delayedActions || []).map((d: any) => `- Task: ${d.workDone || d.taskName || d.activitySubject}, Responsible: ${d.responsible || "None"}, Deadline: ${d.workDate || d.terminDate}, Status: ${d.status}`).join("\n") || "None"}
- Unassigned Actions (Sahipsiz İşler):
${(unassignedActions || []).map((u: any) => `- Task: ${u.workDone || u.activitySubject}, Deadline: ${u.workDate}`).join("\n") || "None"}
- Stale Actions (No Update in 14+ Days):
${(staleActions || []).map((s: any) => `- Task: ${s.workDone || s.activitySubject}, Last Update/Deadline: ${s.workDate}, Owner: ${s.responsible}`).join("\n") || "None"}


You MUST output your report in Turkish.
Structure your report EXACTLY using these 15 headings, without omitting any of them. Each section must be rich, concrete, and highly detailed based on the data above. Do not speak about yourself as an AI. Speak with the voice of the 25+ year veteran Operational Excellence Director.

### 1. Haftanın Yönetici Özeti
Create a bulleted list of AT MOST 8 key high-level accomplishments or milestones for this week (e.g. "✔ 7 faaliyet tamamlandı", "✔ 2 yeni CI projesi başlatıldı", etc.). Use the "✔" symbol for success or simple, crisp indicators.

### 2. Haftalık Genel Değerlendirme
Discuss honestly and professionally: is the project moving forward, stalling, or slowing down? Are there critical risks developing? How is team engagement and management support?

### 3. Gerçekleşen İyileştirmeler
Summarize tangible lean improvements and accomplishments achieved during this week (e.g., "SMED çalışması başladı," "Hurda analizi tamamlandı," "Standart İş hazırlandı," "5S uygulaması yapıldı," "OEE ölçümü başlatıldı").

### 4. Cost Control Analizi
Evaluate how the weekly activities and CI progress affect cost areas (Scrap, Rework, Overtime, WIP, Lead Time, Energy, Maintenance).
CRITICAL: Do not speak as if savings are 100% guaranteed. ALWAYS use terms like "Potansiyel" (Potential), "Beklenen" (Expected), "Tahmini" (Estimated) to describe cost impact.

### 5. Potansiyel Kazanç Analizi
Forecast specific future improvement opportunities and savings percentages if these activities succeed (e.g., "SMED uygulaması başarıyla tamamlanırsa kalıp değişim süresinde %20-30 azalma beklenmektedir" or "Standart iş uygulamasının operatör değişkenliğini azaltması beklenmektedir").

### 6. Geciken Aksiyonlar
List any delayed tasks. Render a clean table or bulleted list showing:
🔴 Görev | Sorumlu | Termin | Gecikme Süresi | Risk Seviyesi.
(If none are delayed, state "Geciken aksiyon bulunmamaktadır.").

### 7. Sahipsiz İşler
Identify any actions that have no responsible owner assigned. List them clearly so they can be assigned. (If none, state "Sahipsiz iş bulunmamaktadır.").

### 8. Uzun Süredir Güncellenmeyen Faaliyetler
List tasks that have not had any updates or modifications for more than 14 days. Include task name, deadline, and owner. (If none, state "Son 14 gündür güncellenmeyen faaliyet bulunmamaktadır.").

### 9. Master Plan Karşılaştırması
Compare what was scheduled in the Master Plan for this week versus what was actually completed. Show:
- Planlanan: (tasks scheduled for this week)
- Gerçekleşen: (tasks actually worked on/finished)
- Eksik kalan: (what was missed)
- İleri alınan işler: (tasks started ahead of schedule)
- Tamamlanma Yüzdesi: (estimate overall completion % of the week's goals)

### 10. CI Proje Sağlığı
Evaluate the current health level of each active CI Project (e.g., 🟢 Sağlıklı (Healthy), 🟡 Riskli (Risky), 🔴 Kritik (Critical)) and explain the specific reasons based on progress, delayed actions, or missing owners.

### 11. Yönetim İçin Uyarılar
Provide highly critical, high-level warnings for plant leadership (e.g., "Yönetim desteği gerekiyor," "Makine yatırımı gerekli," "Kalıp revizyonu gecikiyor," "Kalite ekibi sürece dahil edilmeli"). Keep this focused only on truly crucial roadblocks.

### 12. Danışmana Tavsiyeler
Provide critical, expert mentoring to the on-site lead consultant. Suggest specific tools, analysis techniques, or next steps (e.g., preparing a Pareto analysis on scrap, speeding up operator training, running a 5S audit, reviewing Standard Work).

### 13. Bir Sonraki Hafta İçin Öncelikler
Provide AT MOST 5 concrete, actionable priority items for the coming week to keep the project on track.

### 14. Yönetici Skor Kartı
Provide a score out of 100 for each of the following criteria in a clean text layout:
- Master Plan Uyumu: [score]/100
- Aksiyon Takibi: [score]/100
- Problem Çözme Hızı: [score]/100
- Takım Katılımı: [score]/100
- Termin Performansı: [score]/100
- Risk Seviyesi: [score]/100 (high risk = lower score, or express as a standard score where 100 means perfectly safe/under control)
- Maliyet Azaltma Potansiyeli: [score]/100
- Genel Proje Sağlığı: [score]/100

### 15. Genel Yönetici Yorumu
Write a detailed 3-5 paragraph professional summary.
- Base your analysis strictly on the facts and data.
- Do not claim unconfirmed savings as realized. Explicitly state your assumptions.
- Provide encouraging yet realistic guidance to inspire the plant team while keeping them accountable.

Do not include any greeting or conversational wrapping. Output the markdown content directly.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      report: response.text,
    });
  } catch (error: any) {
    console.error("Gemini Weekly Coach Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Haftalık AI Coach raporu oluşturulurken bir hata oluştu.",
    });
  }
});


// GEMINI STANDARD WORK COMBINATION TABLE (SWCT) ANALYZER
app.post("/api/gemini/swct-analyze", authenticateToken, async (req, res) => {
  try {
    const {
      elements,
      totals,
      taktTime,
      operatorIdle,
      machineWaiting,
      vaPercent,
      nvaPercent,
      utilizationPercent
    } = req.body;

    const client = getGeminiClient();

    const prompt = `
You are a Senior Method Engineer and Operational Excellence (OpEx) Manager with 15+ years of hands-on shop-floor (Gemba) experience in Toyota Production System (TPS) and Lean Manufacturing.
Analyze the following Standard Work Combination Table (SWCT) data from a production station. Your sole focus is eliminating waste (Muda), reducing cycle times, and optimizing operator/machine efficiency.

--- SWCT DATA REPORT ---
- Takt Time: ${taktTime}s
- Total Cycle Time: ${totals?.total || 0}s ${totals?.total > taktTime ? "(TAKT AŞILDI! / Takt Exceeded)" : ""}
- Manual Work Time: ${totals?.manual || 0}s
- Walking Time: ${totals?.walking || 0}s
- Waiting Time: ${totals?.waiting || 0}s
- Inspection Time: ${totals?.inspection || 0}s
- Machine Running Time: ${totals?.machine || 0}s
- Parallel Work Time: ${totals?.parallel || 0}s
- Calculated Operator Idle Time (Makine çalışırken operatör boş kalma süresi): ${operatorIdle || 0}s
- Calculated Machine Waiting Time (Makinenin operatörü bekleme süresi): ${machineWaiting || 0}s
- Value-Added Ratio (VA %): ${vaPercent || 0}%
- Non-Value-Added Ratio (NVA %): ${nvaPercent || 0}%
- Operator Utilization (Operatör Yükleme Oranı %): ${utilizationPercent || 0}%

--- DETAILED WORK ELEMENTS LIST ---
${(elements || []).map((e: any) => `- Sıra ${e.seq}. ${e.desc} (Süre: ${e.time}s, Tip: ${e.type}, Mod: ${e.operationMode || "sequential"}, Başlangıç: ${e.startTime}s, Bitiş: ${e.endTime}s, Sorumlu Operatör: ${e.operator || "Belirtilmemiş"}, İstasyon: ${e.station || "Belirtilmemiş"}, Makine: ${e.machineName || "Belirtilmemiş"})`).join("\n")}

--- OUTPUT DIRECTIVE ---
Write a razor-sharp Gemba method-engineering analysis and list of recommendations in Turkish. Keep your tone direct, clinical, and highly professional — like a seasoned Lean Sensei reporting to a plant manager. Do NOT use generic chatbot filler words, introductory pleasantries (like "İşte analiziniz"), or self-referential phrases (like "Yapısal analizime göre"). Start directly with these Markdown headings:

### 1. Darboğaz ve Çevrim Süresi Analizi (Bottleneck & Cycle Time Analysis)
- Evaluate the station's total cycle time (${totals?.total || 0}s) against the Takt Time (${taktTime}s). If the Takt is exceeded, state clearly that "Bu istasyon dar boğaz kaynağıdır (Bottleneck)."
- Analyze the ratio of non-value-added activities (${nvaPercent || 0}% NVA), specifically highlighting walking (${totals?.walking || 0}s) and waiting (${totals?.waiting || 0}s) times.

### 2. Operatör Boş Zaman ve Makine Etkileşim Analizi (Operator Idle & Machine Interaction)
- Critically evaluate the calculated Operator Idle Time of ${operatorIdle || 0}s occurring while the machine is running.
- Recommend explicit steps to externalize/internalize activities (SMED), or assign parallel operations to utilize this idle time (e.g. "Makine çalışırken... boş operatör zamanı bulunuyor. İş birleştirmeleri yapılmalı, operatörün bekleme zamanı aktif zamana dönüştürülmeli Paralel operasyon atanabilir.").
- Analyze the Machine Waiting Time of ${machineWaiting || 0}s. Discuss the machine's utilization rate and line balancing issues.

### 3. Katma Değer Analizi (Value-Added / Muda Analysis)
- Evaluate the VA/NVA ratio. If non-value-added activities exceed 30%, state clearly: "Çevrim süresinin %X'i katma değer oluşturmayan faaliyetlerden oluşuyor."
- Focus on the Walk/Motion waste (Yürüme/Hareket kaybı) and Operator Waiting.

### 4. Metot Mühendisliği Aksiyon Planı (Method Engineering Actions)
- Give 3-4 concrete, numbered, actionable shop-floor recommendations based strictly on the work elements.
- Examples of required lean language for recommendations:
  - "Operatör çevrimin %X'ini yürüme ile geçiriyor. Yerleşim planı ve akış analizleri yapılmalı, alan kullanımı optimize edilmelidir."
  - "Makine bekleme oranı %Y. Hat dengeleme çalışmasına odaklanılması gerek. Standart iş dengesi gözden geçirilmelidir."
  - Recommend moving storage boxes, relocating controls closer, or parallelizing manual assembly steps.
`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({
      success: true,
      report: response.text,
    });
  } catch (error: any) {
    console.error("Gemini SWCT Analyze Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "SWCT analizi oluşturulurken bir hata oluştu.",
    });
  }
});

export default app;
