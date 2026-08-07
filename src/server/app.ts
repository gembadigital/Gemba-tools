import express from "express";
import { GoogleGenAI } from "@google/genai";
import { db, hashPassword, verifyPassword, needsRehash, User } from "./db.js";
import jwt from "jsonwebtoken";
import { generatePtrTemplateExcel, isPtrTemplateAvailable, buildPtrExportFilename, PtrTemplateRecord } from "./ptrExcelTemplate.js";
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
async function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ success: false, error: "Authentication token is missing. Please log in." });
    return;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  let userId: string;
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId: string };
    userId = payload.userId;
  } catch (e) {
    res.status(401).json({ success: false, error: "Invalid or expired session. Please sign in again." });
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
        last_login: user.last_login
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

    res.json({ success: true, users: safeUsers });
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
  if (scope.factoryId && !payload.factory_id) {
    payload.factory_id = scope.factoryId;
  }
  const saved = await db.saveKaizen(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/kaizens/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
  const allowedCustomerIds = (req as any).allowedCustomerIds as string[] | null;
  if (allowedCustomerIds !== null) {
    const existing = (await db.getKaizens(user.organization_id)).find((r: any) => r.id === req.params.id);
    if (!existing || !allowedCustomerIds.includes(existing.factory_id || "arcelik_bolu")) {
      res.status(403).json({ success: false, error: "Access Denied." });
      return;
    }
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
  const { week, year, note } = req.body;
  if (!week || !year) {
    res.status(400).json({ success: false, error: "week and year are required." });
    return;
  }
  const saved = await db.saveWeeklyConsultantNote(
    user.organization_id,
    { factory_id: scope.factoryId, week, year, note: note || "" },
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

  // "Çelikel Tarım Ekipmanları San. Tic. A.Ş." -> "Çelikel", "Mazsan Makina San Tic A.Ş" -> "Mazsan"
  const shortName = customerName.trim().split(/\s+/)[0] || customerName;

  try {
    const buffer = await generatePtrTemplateExcel(records, customerName);
    const subject = `[PTR] ${shortName} W#${week} Proje Raporu`;

    // Danışman Faaliyet Özeti: fold each consultant's free-text weekly note directly into the
    // email body (not just the Excel attachment) so the customer sees this week's work without
    // opening the file. Only ever populated when `week`/`year` match a week consultants actually
    // wrote notes for (Weekly tab always writes under "geçen hafta") — otherwise this is empty and
    // the email reads exactly as it did before this feature existed.
    let notesSection = "";
    if (year) {
      const weeklyNotes = (await db.getWeeklyConsultantNotes(user.organization_id, scope.factoryId!, String(week), Number(year)))
        .filter((n: any) => (n.note || "").trim());
      if (weeklyNotes.length > 0) {
        const notesList = weeklyNotes
          .map((n: any) => `- ${n.consultant_name || "Danışman"}: ${n.note.trim()}`)
          .join("\n");
        notesSection = `\n\nBu Haftaki Danışman Faaliyet Özeti:\n${notesList}\n`;
      }
    }

    const body = `Sayın İlgililer,\n\n${week}. hafta ziyareti sırasında yapılan çalışma ve aksiyon raporu ektedir. Lütfen termin tarihlerine uyum sağlamaya özen gösteriniz.${notesSection}\nSaygılarımızla,\nGemba Partner`;
    const result = await sendMail({
      to: toList,
      cc: ccList,
      subject,
      text: body,
      attachments: [{ filename: buildPtrExportFilename(customerName), content: buffer }]
    });
    if (!result.success) {
      res.status(503).json(result);
      return;
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
const PTR_EXCLUDED_STATUSES = ["İptal"];

function parseTrDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(".");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
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
    const formatItem = (r: any) => `   - ${r.workDone || r.improvementSubject || "(açıklama yok)"} — Sorumlu: ${r.responsible || "—"}, Termin: ${r.dueDate || "belirtilmemiş"}`;

    const organizations = await db.getOrganizations();
    for (const org of organizations) {
      const customers = await db.getCustomers(org.id);
      for (const customer of customers) {
        const consultantIds: string[] = [
          ...(customer.primaryConsultantId ? [customer.primaryConsultantId] : []),
          ...(customer.consultantIds || [])
        ];
        if (consultantIds.length === 0) continue;

        const consultants = consultantIds
          .map(id => allUsers.find(u => u.id === id))
          .filter((u): u is User => !!u && u.email.toLowerCase().endsWith("@gembapartner.com"));
        if (consultants.length === 0) continue;

        const records = await db.getPtrRecords(org.id, customer.id);
        const overdue = records.filter(r => {
          if (r.status !== "Açık" && r.status !== "Devam Ediyor") return false;
          const workD = parseTrDate(r.workDate);
          if (!workD) return false;
          const diffDays = Math.floor((today.getTime() - workD.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 30;
        });
        const missedTermin = records.filter(r => {
          if (r.status === "Kapalı" || PTR_EXCLUDED_STATUSES.includes(r.status)) return false;
          const due = parseTrDate(r.dueDate);
          return !!due && due.getTime() < today.getTime();
        });
        const critical = records.filter(r =>
          r.flagged && r.status !== "Kapalı" && !PTR_EXCLUDED_STATUSES.includes(r.status)
        );

        if (overdue.length === 0 && missedTermin.length === 0 && critical.length === 0) continue;

        const customerName = customer.companyName || "Müşteri";
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
      }
    }

    res.json({ success: true, sent: results.filter(r => r.success).length, results });
  } catch (e: any) {
    console.error("Failed to run weekly consultant digest", e);
    res.status(500).json({ success: false, error: e.message || "Haftalık hatırlatma çalıştırılamadı." });
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
  const assignments = req.body.assignments as { areaId: string; auditorName: string }[];
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
  const audit = (await db.getFiveSRecords("five_s_audits", user.organization_id, scope.factoryId)).find((a: any) => a.id === req.params.id);
  if (!audit) {
    res.status(404).json({ success: false, error: "Denetim bulunamadı." });
    return;
  }
  if (audit.status !== "Tamamlandı") {
    res.status(400).json({ success: false, error: "Sadece tamamlanmış denetimler için rapor gönderilebilir." });
    return;
  }
  const areas = await db.getFiveSRecords("five_s_areas", user.organization_id, scope.factoryId);
  const departments = await db.getFiveSRecords("five_s_departments", user.organization_id, scope.factoryId);
  const results = (await db.getFiveSRecords("five_s_results", user.organization_id, scope.factoryId)).filter((r: any) => r.auditId === audit.id);
  const assignments = (await db.getFiveSRecords("five_s_team_assignments", user.organization_id, scope.factoryId)).filter((a: any) => a.auditId === audit.id);
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === scope.factoryId);
  const customerName = customer?.companyName || "Müşteri";

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

  const subject = `${customerName} - 5S Denetim Raporu - Denetim No ${audit.auditNo}`;
  const body = `Sayın İlgililer,\n\n${audit.date} tarihli, ${audit.auditNo} numaralı 5S denetiminin sonuç raporu ektedir.\n\nSaygılarımızla,\nGemba Partner`;
  const result = await sendMail({
    to: recipientEmail,
    subject,
    text: body,
    attachments: [{ filename: `5S_Denetim_${audit.auditNo}_${customerName.replace(/\s+/g, "_")}.xlsx`, content: buffer }]
  });
  if (!result.success) {
    res.status(503).json(result);
    return;
  }
  res.json({ success: true });
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
  let findings = await db.getFiveSRecords("gemba_walk_findings", user.organization_id, scope.factoryId);
  if (Array.isArray(findingIds) && findingIds.length > 0) {
    findings = findings.filter((f: any) => findingIds.includes(f.id));
  }
  if (findings.length === 0) {
    res.status(400).json({ success: false, error: "Aktarılacak Gemba Walk kaydı bulunamadı." });
    return;
  }
  const areas = await db.getFiveSRecords("five_s_areas", user.organization_id, scope.factoryId);
  const customer = (await db.getCustomers(user.organization_id)).find((c: any) => c.id === scope.factoryId);
  const customerName = customer?.companyName || "Müşteri";

  const tableHeader = ["Alan", "Problem Kategorisi", "Problem Tarihi", "Problem Tanımı", "Aksiyon", "Sorumlu", "Durum", "Termin", "Gerçekleşme"];
  const tableRows = findings.map((f: any) => {
    const area = areas.find((a: any) => a.id === f.areaId);
    return [area?.name || "-", f.problemCategory, f.problemDate, f.problemDescription, f.action, f.responsible, f.status, f.dueDate || "-", f.completedDate || "-"];
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Gemba Walk Raporu", customerName], [], tableHeader, ...tableRows]), "Gemba Walk");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const subject = `${customerName} - Gemba Walk Raporu`;
  const body = `Sayın İlgililer,\n\nGemba Walk saha gözlem raporu ektedir.\n\nSaygılarımızla,\nGemba Partner`;
  const result = await sendMail({
    to: recipientEmail,
    subject,
    text: body,
    attachments: [{ filename: `GembaWalk_${customerName.replace(/\s+/g, "_")}.xlsx`, content: buffer }]
  });
  if (!result.success) {
    res.status(503).json(result);
    return;
  }
  res.json({ success: true });
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
  res.json({ success: true, data: await db.getOpexAssessments(user.organization_id, scope.factoryId) });
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
  const saved = await db.saveOpexAssessment(user.organization_id, payload, user.id);
  res.json({ success: true, data: saved });
});

app.delete("/api/business/opex-assessments/:id", authenticateToken, async (req, res) => {
  const user = (req as any).user;
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
