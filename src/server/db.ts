import crypto from "crypto";
import { Pool } from "pg";
import { OPEX_SEED_CATEGORIES, OPEX_SEED_QUESTIONS } from "./opexSeedData.js";
import { FIVE_S_DEFAULT_DEPARTMENTS, FIVE_S_DEFAULT_QUESTIONS } from "./fiveSSeedData.js";
import { DEFAULT_ROLE_MODULE_VISIBILITY, RoleModuleVisibility } from "../constants/sidebarModules.js";

// Schema Definitions
export interface Organization {
  id: string;
  organization_name: string;
  domain: string;
  created_at: string;
}

export interface User {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: "Admin" | "Consultant" | "Customer User";
  status: "Active" | "Disabled";
  last_login: string | null;
  created_at: string;
  // Only populated for role "Customer User" — the specific customer(s) this account may access.
  assigned_customer_ids?: string[];
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: "Admin" | "Consultant" | "Customer User";
  invitation_token: string;
  expires_at: string;
  accepted: boolean;
  // Set when the invite is scoped to one customer (Consultant or Customer User assignment).
  customer_id?: string;
}

export interface YamazumiStudy {
  id: string;
  organization_id: string;
  customerId: string;
  customerName?: string;
  studyTitle: string;
  elements: any[];
  stats: any;
  aiReport?: string;
  taktTime: number;
  created_at: string;
  updated_at: string;
}

// Every loosely-typed business collection (customers, processes, activities, segments, kaizens,
// vsm_projects, opex_assessments, yamazumi_studies, copq_snapshots, loss_capacity_settings,
// spaghetti_flow_settings, time_studies, smed_projects, ptr_records, company_workspaces,
// five_s_* x10, gemba_walk_findings) lives as one row per record in a single generic Postgres table (see
// supabase/schema.sql), keyed by `collection` — the same pattern this file already used for just
// the 5S module (FIVE_S_COLLECTIONS below), now generalized to the whole app. `data` holds the
// full record exactly as the app already shapes it (id/organization_id/factory_id duplicated
// inside), so the get/save/delete methods below barely change in shape — only the storage
// primitive underneath changed from an in-memory array to a SQL query.
const FIVE_S_COLLECTIONS = [
  "five_s_departments", "five_s_areas", "five_s_personnel", "five_s_questions",
  "five_s_audits", "five_s_team_assignments", "five_s_answers", "five_s_results",
  "five_s_problem_categories", "gemba_walk_findings"
] as const;
type FiveSCollection = typeof FIVE_S_COLLECTIONS[number];

// Kaizen Suggestions module — same generic collection-CRUD pattern as FIVE_S_COLLECTIONS above.
const KAIZEN_COLLECTIONS = [
  "kaizen_personnel", "kaizen_criteria", "kaizen_suggestions", "kaizen_approvals", "kaizen_evaluations"
] as const;
type KaizenCollection = typeof KAIZEN_COLLECTIONS[number];

// Lazily create the pool (same pattern as getGeminiClient/getMailTransporter below) so importing
// this module never fails module resolution order — dotenv.config() runs in the entry point
// (server.ts / api/index.ts), which may be evaluated after this file's imports are resolved.
// One small pool per warm process/container — the Supabase connection-pooler (pgbouncer) URL is
// expected here, not the direct Postgres port, since serverless invocations can't each hold a
// full direct connection without quickly exhausting Postgres' connection limit.
let poolInstance: Pool | null = null;
function getPool(): Pool {
  if (!poolInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required but missing. Add your Supabase Postgres connection string (pooler, port 6543) to .env before starting the server.");
    }
    poolInstance = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  }
  return poolInstance;
}

// Lazily creates the password_resets table on first use (memoized per process) so a code-only
// deploy doesn't require a manual SQL step against the already-provisioned production database —
// see supabase/schema.sql for the same definition, kept for fresh installs/documentation.
let passwordResetsTableEnsured = false;
async function ensurePasswordResetsTable(): Promise<void> {
  if (passwordResetsTableEnsured) return;
  await getPool().query(`
    create table if not exists password_resets (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      reset_token text not null unique,
      expires_at timestamptz not null,
      used boolean not null default false,
      created_at timestamptz not null default now()
    )
  `);
  passwordResetsTableEnsured = true;
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

function isoOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function rowToOrganization(row: any): Organization {
  return {
    id: row.id,
    organization_name: row.organization_name,
    domain: row.domain,
    created_at: row.created_at.toISOString()
  };
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    organization_id: row.organization_id,
    full_name: row.full_name,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    status: row.status,
    last_login: isoOrNull(row.last_login),
    created_at: row.created_at.toISOString(),
    assigned_customer_ids: row.assigned_customer_ids ?? undefined
  };
}

function rowToInvitation(row: any): Invitation {
  return {
    id: row.id,
    organization_id: row.organization_id,
    email: row.email,
    role: row.role,
    invitation_token: row.invitation_token,
    expires_at: row.expires_at.toISOString(),
    accepted: row.accepted,
    customer_id: row.customer_id ?? undefined
  };
}

// Password hashing: scrypt with a random per-user salt (Node's built-in crypto — no extra
// dependency). Stored as "scrypt:<saltHex>:<hashHex>".
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

// Verifies a password against either the current salted-scrypt format or the legacy bare
// SHA-256 digest this app used before (kept only so existing accounts don't get locked out —
// see needsRehash below, which flags legacy hashes for upgrading on next successful login).
export function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash.startsWith("scrypt:")) {
    const parts = storedHash.split(":");
    const salt = parts[1];
    const hash = parts[2];
    if (!salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
  // Legacy unsalted SHA-256 digest.
  const legacyHash = crypto.createHash("sha256").update(password).digest("hex");
  const a = Buffer.from(legacyHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function needsRehash(storedHash: string): boolean {
  return !storedHash.startsWith("scrypt:");
}

export class GeminiDb {
  // --- Generic "records" table helpers (shared by every loosely-typed collection) ---

  private async listCollection(collection: string, orgId: string): Promise<any[]> {
    const { rows } = await getPool().query(
      `select data from records where collection = $1 and organization_id = $2`,
      [collection, orgId]
    );
    return rows.map(r => r.data);
  }

  private async getRecordById(collection: string, id: string, orgId: string): Promise<any | null> {
    const { rows } = await getPool().query(
      `select data from records where collection = $1 and id = $2 and organization_id = $3`,
      [collection, id, orgId]
    );
    return rows.length ? rows[0].data : null;
  }

  // Mirrors the in-memory array's upsert-by-id semantics: if a record with this id already
  // exists, the incoming fields are merged onto it (partial updates preserve untouched fields);
  // otherwise the incoming record is inserted as-is.
  private async upsertMerged(collection: string, orgId: string, record: any): Promise<any> {
    const existing = record.id ? await this.getRecordById(collection, record.id, orgId) : null;
    const merged = existing ? { ...existing, ...record } : record;
    await getPool().query(
      `insert into records (id, collection, organization_id, factory_id, data, updated_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (id) do update set data = $5, factory_id = $4, organization_id = $3, updated_at = now()`,
      [merged.id, collection, orgId, merged.factory_id ?? null, merged]
    );
    return merged;
  }

  private async removeOne(collection: string, orgId: string, id: string): Promise<void> {
    await getPool().query(
      `delete from records where collection = $1 and organization_id = $2 and id = $3`,
      [collection, orgId, id]
    );
  }

  // One-time cleanup for a specific known bug: App.tsx's "no real customer selected" placeholder
  // used to have a truthy sentinel id ("none_default"), which silently flowed into every module as
  // a real x-factory-id whenever an org had zero real customers — so test/demo records could get
  // created and then resurface under that literal id for any brand-new org. Different collections
  // store their scoping key under different field names (top-level `factory_id` column vs
  // `customerId`/`factory_id` inside the JSONB `data`), so this checks all three rather than
  // guessing per collection. Scoped to the caller's own org; "none_default" is specific enough that
  // it can never collide with a real id. Admin-triggered only (see /api/admin/cleanup-orphaned-data).
  public async deleteOrphanedPlaceholderData(orgId: string): Promise<{ collection: string; count: number }[]> {
    const { rows } = await getPool().query(
      `delete from records
       where organization_id = $1
         and (factory_id = 'none_default' or data->>'customerId' = 'none_default' or data->>'factory_id' = 'none_default')
       returning collection`,
      [orgId]
    );
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.collection, (counts.get(row.collection) || 0) + 1);
    return Array.from(counts.entries()).map(([collection, count]) => ({ collection, count }));
  }

  private async removeByIds(collection: string, orgId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await getPool().query(
      `delete from records where collection = $1 and organization_id = $2 and id = any($3::text[])`,
      [collection, orgId, ids]
    );
  }

  // --- Organizations ---
  public async getOrganizations(): Promise<Organization[]> {
    const { rows } = await getPool().query(`select * from organizations`);
    return rows.map(rowToOrganization);
  }

  public async createOrganization(name: string, domain: string): Promise<Organization> {
    const org: Organization = { id: randomId("org"), organization_name: name, domain, created_at: new Date().toISOString() };
    await getPool().query(
      `insert into organizations (id, organization_name, domain, created_at) values ($1, $2, $3, $4)`,
      [org.id, org.organization_name, org.domain, org.created_at]
    );
    return org;
  }

  // Find or create organization based on domain
  public async getOrCreateOrgByDomain(email: string): Promise<Organization> {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) {
      throw new Error("Invalid email domain");
    }
    const { rows } = await getPool().query(`select * from organizations where domain = $1`, [domain]);
    if (rows.length > 0) return rowToOrganization(rows[0]);

    let prettyName = domain.split(".")[0];
    prettyName = prettyName.charAt(0).toUpperCase() + prettyName.slice(1) + " Workspace";
    return this.createOrganization(prettyName, domain);
  }

  // --- Users ---
  public async getUsers(): Promise<User[]> {
    const { rows } = await getPool().query(`select * from users`);
    return rows.map(rowToUser);
  }

  public async createUser(user: Omit<User, "id" | "created_at" | "last_login">): Promise<User> {
    const newUser: User = { ...user, id: randomId("usr"), created_at: new Date().toISOString(), last_login: null };
    await getPool().query(
      `insert into users (id, organization_id, full_name, email, password_hash, role, status, last_login, created_at, assigned_customer_ids)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [newUser.id, newUser.organization_id, newUser.full_name, newUser.email, newUser.password_hash, newUser.role, newUser.status, newUser.last_login, newUser.created_at, newUser.assigned_customer_ids ?? null]
    );
    return newUser;
  }

  public async updateUser(userId: string, updates: Partial<Omit<User, "id" | "created_at">>): Promise<User> {
    const { rows } = await getPool().query(`select * from users where id = $1`, [userId]);
    if (rows.length === 0) {
      throw new Error("User not found");
    }
    const merged: User = { ...rowToUser(rows[0]), ...updates };
    await getPool().query(
      `update users set organization_id=$2, full_name=$3, email=$4, password_hash=$5, role=$6, status=$7, last_login=$8, assigned_customer_ids=$9 where id=$1`,
      [userId, merged.organization_id, merged.full_name, merged.email, merged.password_hash, merged.role, merged.status, merged.last_login, merged.assigned_customer_ids ?? null]
    );
    return merged;
  }

  public async deleteUser(userId: string): Promise<void> {
    await getPool().query(`delete from users where id = $1`, [userId]);
  }

  // --- Invitations ---
  public async getInvitations(): Promise<Invitation[]> {
    const { rows } = await getPool().query(`select * from invitations`);
    return rows.map(rowToInvitation);
  }

  public async createInvitation(orgId: string, email: string, role: "Admin" | "Consultant" | "Customer User", customerId?: string): Promise<Invitation> {
    const invitationToken = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // Expires in 48 hours

    // Deactivate previous invitations to same email
    await getPool().query(`delete from invitations where email = $1`, [email]);

    const newInvite: Invitation = {
      id: randomId("inv"),
      organization_id: orgId,
      email: email.toLowerCase().trim(),
      role,
      invitation_token: invitationToken,
      expires_at: expiresAt.toISOString(),
      accepted: false,
      customer_id: customerId
    };
    await getPool().query(
      `insert into invitations (id, organization_id, email, role, invitation_token, expires_at, accepted, customer_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [newInvite.id, newInvite.organization_id, newInvite.email, newInvite.role, newInvite.invitation_token, newInvite.expires_at, newInvite.accepted, newInvite.customer_id ?? null]
    );
    return newInvite;
  }

  public async acceptInvitation(token: string, passwordPlain: string, fullName: string): Promise<User> {
    const { rows } = await getPool().query(`select * from invitations where invitation_token = $1 and accepted = false`, [token]);
    if (rows.length === 0) {
      throw new Error("Invalid or already accepted invitation token.");
    }
    const invite = rowToInvitation(rows[0]);

    if (new Date() > new Date(invite.expires_at)) {
      throw new Error("Invitation token is expired.");
    }

    const existingUser = await getPool().query(`select id from users where email = $1`, [invite.email]);
    if (existingUser.rows.length > 0) {
      throw new Error("User already registered with this email.");
    }

    const newUser = await this.createUser({
      organization_id: invite.organization_id,
      full_name: fullName,
      email: invite.email,
      password_hash: hashPassword(passwordPlain),
      role: invite.role,
      status: "Active",
      assigned_customer_ids: invite.role === "Customer User" && invite.customer_id ? [invite.customer_id] : undefined
    });

    // If this was a consultant invite tied to a specific customer, register them as a secondary consultant.
    if (invite.role === "Consultant" && invite.customer_id) {
      const customer = await this.getRecordById("customers", invite.customer_id, invite.organization_id);
      if (customer) {
        customer.consultantIds = customer.consultantIds || [];
        if (!customer.consultantIds.includes(newUser.id)) {
          customer.consultantIds.push(newUser.id);
          await this.upsertMerged("customers", invite.organization_id, customer);
        }
      }
    }
    // If this was a customer-user invite, register them against the customer's invite quota list.
    if (invite.role === "Customer User" && invite.customer_id) {
      const customer = await this.getRecordById("customers", invite.customer_id, invite.organization_id);
      if (customer) {
        customer.customerUserIds = customer.customerUserIds || [];
        if (!customer.customerUserIds.includes(newUser.id)) {
          customer.customerUserIds.push(newUser.id);
          await this.upsertMerged("customers", invite.organization_id, customer);
        }
      }
    }

    await getPool().query(`update invitations set accepted = true where id = $1`, [invite.id]);
    return newUser;
  }

  // --- Password resets ---
  // Self-migrating: this table was added after supabase/schema.sql had already been run once
  // against production, so it's created lazily here (idempotent CREATE TABLE IF NOT EXISTS)
  // instead of requiring a manual SQL step against the live database. Also mirrored in
  // schema.sql for fresh installs.
  public async createPasswordReset(userId: string): Promise<{ resetToken: string; expiresAt: string }> {
    await ensurePasswordResetsTable();
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Short-lived: 1 hour

    // Invalidate any earlier outstanding reset requests for this user.
    await getPool().query(`delete from password_resets where user_id = $1`, [userId]);
    await getPool().query(
      `insert into password_resets (id, user_id, reset_token, expires_at) values ($1, $2, $3, $4)`,
      [randomId("pwr"), userId, resetToken, expiresAt.toISOString()]
    );
    return { resetToken, expiresAt: expiresAt.toISOString() };
  }

  public async consumePasswordReset(token: string): Promise<{ userId: string } | null> {
    await ensurePasswordResetsTable();
    const { rows } = await getPool().query(
      `select * from password_resets where reset_token = $1 and used = false`,
      [token]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    if (new Date() > new Date(row.expires_at)) return null;

    await getPool().query(`update password_resets set used = true where id = $1`, [row.id]);
    return { userId: row.user_id };
  }

  // --- BUSINESS RECORD MUTATORS (Isolated per organization) ---

  // Customers
  public async getCustomers(orgId: string): Promise<any[]> {
    return this.listCollection("customers", orgId);
  }

  public async saveCustomer(orgId: string, cust: any, userId: string): Promise<any> {
    if (!cust.id) {
      cust.id = randomId("cust");
      cust.organization_id = orgId;
      cust.created_by = userId;
      cust.created_at = new Date().toISOString();
    }
    cust.updated_by = userId;
    cust.updated_at = new Date().toISOString();
    cust.organization_id = orgId; // force matching
    return this.upsertMerged("customers", orgId, cust);
  }

  public async deleteCustomer(orgId: string, id: string): Promise<void> {
    await this.removeOne("customers", orgId, id);
  }

  // Processes
  public async getProcesses(orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection("processes", orgId);
    return all.filter(p => {
      if (!factoryId) return true;
      const recordFactoryId = p.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  public async saveProcess(orgId: string, proc: any, userId: string): Promise<any> {
    if (!proc.id) {
      proc.id = randomId("proc");
      proc.organization_id = orgId;
      proc.created_by = userId;
      proc.created_at = new Date().toISOString();
    }
    proc.updated_by = userId;
    proc.updated_at = new Date().toISOString();
    proc.organization_id = orgId; // force matching
    return this.upsertMerged("processes", orgId, proc);
  }

  public async deleteProcess(orgId: string, id: string): Promise<void> {
    await this.removeOne("processes", orgId, id);
  }

  // Gantt Activities
  public async getActivities(orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection("activities", orgId);
    return all.filter(a => {
      if (!factoryId) return true;
      const recordFactoryId = a.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  public async saveActivity(orgId: string, act: any, userId: string): Promise<any> {
    if (!act.id) {
      act.id = randomId("act");
      act.organization_id = orgId;
      act.created_by = userId;
      act.created_at = new Date().toISOString();
    }
    act.updated_by = userId;
    act.updated_at = new Date().toISOString();
    act.organization_id = orgId; // force matching
    return this.upsertMerged("activities", orgId, act);
  }

  public async deleteActivity(orgId: string, id: string): Promise<void> {
    await this.removeOne("activities", orgId, id);
  }

  // Flow Segments (Spaghetti)
  public async getSegments(orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection("segments", orgId);
    return all.filter(s => {
      if (!factoryId) return true;
      const recordFactoryId = s.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  public async saveSegment(orgId: string, seg: any, userId: string): Promise<any> {
    if (!seg.id) {
      seg.id = randomId("seg");
      seg.organization_id = orgId;
    }
    seg.organization_id = orgId;
    return this.upsertMerged("segments", orgId, seg);
  }

  public async deleteSegment(orgId: string, id: string): Promise<void> {
    await this.removeOne("segments", orgId, id);
  }

  public async clearSegments(orgId: string, factoryId?: string): Promise<void> {
    const all = await this.listCollection("segments", orgId);
    const toDelete = all.filter(s => {
      if (!factoryId) return true; // delete all for this org if no factoryId
      const recordFactoryId = s.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
    await this.removeByIds("segments", orgId, toDelete.map(s => s.id));
  }

  // Kaizens
  public async getKaizens(orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection("kaizens", orgId);
    return all.filter(k => {
      if (!factoryId) return true;
      const recordFactoryId = k.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  public async saveKaizen(orgId: string, kaizen: any, userId: string): Promise<any> {
    if (!kaizen.id) {
      kaizen.id = randomId("kai");
      kaizen.organization_id = orgId;
      kaizen.created_by = userId;
      kaizen.created_at = new Date().toISOString();
    }
    kaizen.updated_by = userId;
    kaizen.updated_at = new Date().toISOString();
    kaizen.organization_id = orgId; // force matching
    return this.upsertMerged("kaizens", orgId, kaizen);
  }

  public async deleteKaizen(orgId: string, id: string): Promise<void> {
    await this.removeOne("kaizens", orgId, id);
  }

  // Time Study saved-studies list — one record per saved measurement (a study can optionally link
  // back to a VSM process/station via linked_vsm_process_id for traceability), same list-per-
  // customer pattern as vsm_projects.
  public async getTimeStudies(orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection("time_studies", orgId);
    return all.filter(s => !factoryId || s.factory_id === factoryId);
  }

  public async saveTimeStudy(orgId: string, study: any, userId: string): Promise<any> {
    if (!study.id) {
      study.id = randomId("std");
      study.organization_id = orgId;
      study.created_by = userId;
      study.created_at = new Date().toISOString();
    }
    study.updated_by = userId;
    study.updated_at = new Date().toISOString();
    study.organization_id = orgId; // force matching
    return this.upsertMerged("time_studies", orgId, study);
  }

  public async deleteTimeStudy(orgId: string, id: string): Promise<void> {
    await this.removeOne("time_studies", orgId, id);
  }

  // SMED projects list — one record per kalıp/setup değişim project (with its activities and
  // ECRS-derived action cards embedded), same list-per-customer pattern as time_studies.
  public async getSmedProjects(orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection("smed_projects", orgId);
    return all.filter(s => !factoryId || s.factory_id === factoryId);
  }

  public async saveSmedProject(orgId: string, project: any, userId: string): Promise<any> {
    if (!project.id) {
      project.id = randomId("smed");
      project.organization_id = orgId;
      project.created_by = userId;
      project.created_at = new Date().toISOString();
    }
    project.updated_by = userId;
    project.updated_at = new Date().toISOString();
    project.organization_id = orgId; // force matching
    return this.upsertMerged("smed_projects", orgId, project);
  }

  public async deleteSmedProject(orgId: string, id: string): Promise<void> {
    await this.removeOne("smed_projects", orgId, id);
  }

  // Proje Takip Raporu (PTR) — one record per weekly visit/action row, list-per-customer pattern
  // like time_studies/smed_projects. Records keep a client-generated numeric id.
  public async getPtrRecords(orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection("ptr_records", orgId);
    return all.filter(r => !factoryId || r.factory_id === factoryId);
  }

  public async savePtrRecord(orgId: string, record: any, userId: string): Promise<any> {
    const isNew = record.id === undefined || record.id === null || !(await this.getRecordById("ptr_records", String(record.id), orgId));
    if (isNew) {
      if (record.id === undefined || record.id === null) record.id = Date.now();
      record.organization_id = orgId;
      record.created_by = userId;
      record.created_at = new Date().toISOString();
    }
    record.updated_by = userId;
    record.updated_at = new Date().toISOString();
    record.organization_id = orgId; // force matching
    return this.upsertMerged("ptr_records", orgId, record);
  }

  public async deletePtrRecord(orgId: string, id: string): Promise<void> {
    await this.removeOne("ptr_records", orgId, String(Number(id)));
  }

  // Danışman Faaliyet Özeti — one free-text note per consultant per ISO week, surfaced (with the
  // author's name) in PTR's Haftalık OPEX Faaliyet Raporu tab and folded into the weekly report
  // email body. Multiple consultants can each have their own note for the same week; a consultant
  // re-saving updates their own note in place instead of creating a duplicate.
  public async getWeeklyConsultantNotes(orgId: string, factoryId: string, week: string, year: number): Promise<any[]> {
    const all = await this.listCollection("weekly_consultant_notes", orgId);
    return all.filter(n => n.factory_id === factoryId && String(n.week) === String(week) && Number(n.year) === Number(year));
  }

  public async saveWeeklyConsultantNote(orgId: string, payload: { factory_id: string; week: string; year: number; note: string }, userId: string, userName: string): Promise<any> {
    const all = await this.listCollection("weekly_consultant_notes", orgId);
    const existing = all.find(n =>
      n.factory_id === payload.factory_id &&
      String(n.week) === String(payload.week) &&
      Number(n.year) === Number(payload.year) &&
      n.consultant_id === userId
    );
    const record: any = {
      id: existing ? existing.id : randomId("wcn"),
      factory_id: payload.factory_id,
      week: payload.week,
      year: payload.year,
      note: payload.note,
      consultant_id: userId,
      consultant_name: userName,
      organization_id: orgId,
      created_at: existing ? existing.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return this.upsertMerged("weekly_consultant_notes", orgId, record);
  }

  public async getWeeklyConsultantNoteById(orgId: string, id: string): Promise<any | null> {
    return this.getRecordById("weekly_consultant_notes", id, orgId);
  }

  public async deleteWeeklyConsultantNote(orgId: string, id: string): Promise<void> {
    await this.removeOne("weekly_consultant_notes", orgId, id);
  }

  // Weekly report mail archive — one row per (factory, week, year), snapshotting the exact
  // subject/body/recipients of the weekly report email (Danışman Faaliyet Özeti + PTR attachment)
  // every time it's actually sent, so past send content stays visible even after the live
  // Danışman Faaliyet Özeti draft notes for that week are later edited or a consultant deletes
  // their note. Re-sending the same week updates the snapshot in place and bumps sentCount.
  public async getWeeklyReportMailLog(orgId: string, factoryId: string): Promise<any[]> {
    const all = await this.listCollection("weekly_report_mail_log", orgId);
    return all
      .filter((r: any) => r.factory_id === factoryId)
      .sort((a: any, b: any) => (Number(b.year) - Number(a.year)) || (Number(b.week) - Number(a.week)));
  }

  public async saveWeeklyReportMailLogEntry(orgId: string, payload: {
    factory_id: string; week: string; year: number; subject: string; body: string;
    to: string[]; cc: string[];
  }, userId: string, userName: string): Promise<any> {
    const id = `wrml_${payload.factory_id}_${payload.year}_${payload.week}`;
    const existing = await this.getRecordById("weekly_report_mail_log", id, orgId);
    const record: any = {
      id,
      factory_id: payload.factory_id,
      week: payload.week,
      year: payload.year,
      subject: payload.subject,
      body: payload.body,
      to: payload.to,
      cc: payload.cc,
      sentBy: userName,
      sentById: userId,
      organization_id: orgId,
      firstSentAt: existing ? existing.firstSentAt : new Date().toISOString(),
      sentAt: new Date().toISOString(),
      sentCount: (existing?.sentCount || 0) + 1
    };
    return this.upsertMerged("weekly_report_mail_log", orgId, record);
  }

  // Ticket / İyileştirme Takip — internal feedback & improvement backlog about gemba-tools itself
  // (not tied to any customer/factory, unlike almost everything else in this file). Admin +
  // Consultant only; enforced both in the API handlers (app.ts) and hidden in the UI for
  // Customer User. orderNo is assigned server-side as the next sequential number per organization.
  public async getTickets(orgId: string): Promise<any[]> {
    const all = await this.listCollection("tickets", orgId);
    return all.sort((a, b) => (a.orderNo || 0) - (b.orderNo || 0));
  }

  public async saveTicket(orgId: string, ticket: any, userId: string, userName: string): Promise<any> {
    const isNew = !ticket.id || !(await this.getRecordById("tickets", ticket.id, orgId));
    if (isNew) {
      ticket.id = ticket.id || randomId("ticket");
      ticket.created_by = userId;
      ticket.reportedBy = userName;
      ticket.created_at = new Date().toISOString();
      const existing = await this.listCollection("tickets", orgId);
      ticket.orderNo = existing.length > 0 ? Math.max(...existing.map((t: any) => t.orderNo || 0)) + 1 : 1;
    }
    ticket.organization_id = orgId;
    ticket.updated_at = new Date().toISOString();
    return this.upsertMerged("tickets", orgId, ticket);
  }

  public async deleteTicket(orgId: string, id: string): Promise<void> {
    await this.removeOne("tickets", orgId, id);
  }

  // 5S Audit module — every entity (departments, areas, personnel, questions, audits, team
  // assignments, answers, results, problem categories, Gemba Walk findings) is a flat array with
  // the same factory-scoped CRUD lifecycle, so one generic implementation backs all of them
  // instead of 10 near-identical get/save/delete methods.
  public async getFiveSRecords(collection: FiveSCollection, orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection(collection, orgId);
    return all.filter(r => !factoryId || r.factory_id === factoryId);
  }

  public async saveFiveSRecord(collection: FiveSCollection, orgId: string, factoryId: string, record: any, userId: string): Promise<any> {
    const isNew = !record.id || !(await this.getRecordById(collection, record.id, orgId));
    if (isNew) {
      if (!record.id) record.id = randomId(collection);
      record.created_by = userId;
      record.created_at = new Date().toISOString();
    }
    record.organization_id = orgId;
    record.factory_id = factoryId;
    record.updated_by = userId;
    record.updated_at = new Date().toISOString();
    const saved = await this.upsertMerged(collection, orgId, record);
    if (collection === "five_s_personnel" && !isNew) {
      await this.cascadeFiveSPersonnelRename(orgId, factoryId, saved.id, saved.name);
    }
    return saved;
  }

  // Areas/team-assignments/Gemba Walk findings store a denormalized personnel *name* alongside the
  // real *Id* (responsibleId/auditorId) so existing name-matching UI (myAreas, "my actions", the
  // auditor leaderboard) keeps working without a wider rewrite — but that only stays correct if the
  // name is re-synced whenever the personnel record it points to is renamed. Without this, editing
  // someone's name in Ekip Listesi would silently orphan every place that used to match them by the
  // old name (the exact fragility this Id linkage was added to fix).
  private async cascadeFiveSPersonnelRename(orgId: string, factoryId: string, personnelId: string, newName: string): Promise<void> {
    const areas = (await this.getFiveSRecords("five_s_areas", orgId, factoryId)).filter((a: any) => a.responsibleId === personnelId && a.responsible !== newName);
    for (const a of areas) {
      await this.upsertMerged("five_s_areas", orgId, { ...a, responsible: newName });
    }
    const assignments = (await this.getFiveSRecords("five_s_team_assignments", orgId, factoryId)).filter((t: any) => t.auditorId === personnelId && t.auditorName !== newName);
    for (const t of assignments) {
      await this.upsertMerged("five_s_team_assignments", orgId, { ...t, auditorName: newName });
    }
    const findings = (await this.getFiveSRecords("gemba_walk_findings", orgId, factoryId)).filter((f: any) => f.responsibleId === personnelId && f.responsible !== newName);
    for (const f of findings) {
      await this.upsertMerged("gemba_walk_findings", orgId, { ...f, responsible: newName });
    }
  }

  public async deleteFiveSRecord(collection: FiveSCollection, orgId: string, id: string): Promise<void> {
    await this.removeOne(collection, orgId, id);
  }

  // Referential-integrity guard for the FIVE_S_SIMPLE_ENTITIES delete routes: departments/areas/
  // questions/personnel have no DB-level foreign keys (everything lives in one generic JSONB
  // `records` table), so nothing stopped a delete from silently orphaning real audit history —
  // an area/question referenced by past scored answers, or a department still holding areas/
  // questions. Returns a Turkish error message to show the user if the delete should be blocked,
  // or null if it's safe. Personnel is guarded softly (name-matched, not a real FK — see
  // FiveSArea.responsible/FiveSTeamAssignment.auditorName) since deleting them just silently breaks
  // "my areas"/"my actions" matching for that person rather than orphaning a hard reference.
  public async getFiveSDeleteBlockReason(collection: FiveSCollection, orgId: string, id: string, factoryId: string): Promise<string | null> {
    if (collection === "five_s_departments") {
      const [areas, questions] = await Promise.all([
        this.getFiveSRecords("five_s_areas", orgId, factoryId),
        this.getFiveSRecords("five_s_questions", orgId, factoryId)
      ]);
      const areaCount = areas.filter((a: any) => a.departmentId === id).length;
      const questionCount = questions.filter((q: any) => q.departmentId === id).length;
      if (areaCount > 0 || questionCount > 0) {
        return `Bu bölüm silinemez: ${areaCount} alan ve ${questionCount} soru bu bölüme bağlı. Önce onları başka bir bölüme taşıyın veya silin.`;
      }
    } else if (collection === "five_s_areas") {
      const [assignments, answers, findings] = await Promise.all([
        this.getFiveSRecords("five_s_team_assignments", orgId, factoryId),
        this.getFiveSRecords("five_s_answers", orgId, factoryId),
        this.getFiveSRecords("gemba_walk_findings", orgId, factoryId)
      ]);
      const hasHistory = assignments.some((a: any) => a.areaId === id) || answers.some((a: any) => a.areaId === id) || findings.some((f: any) => f.areaId === id);
      if (hasHistory) {
        return "Bu alan silinemez: geçmiş denetim ataması, puanlanmış cevap veya Gemba Walk kaydı bu alana bağlı.";
      }
    } else if (collection === "five_s_questions") {
      const answers = await this.getFiveSRecords("five_s_answers", orgId, factoryId);
      if (answers.some((a: any) => a.questionId === id)) {
        return "Bu soru silinemez: geçmiş bir denetimde bu soruya verilmiş puanlanmış cevap var.";
      }
    } else if (collection === "five_s_personnel") {
      const personnel = await this.getFiveSRecords("five_s_personnel", orgId, factoryId);
      const person = personnel.find((p: any) => p.id === id);
      if (person) {
        const [areas, assignments] = await Promise.all([
          this.getFiveSRecords("five_s_areas", orgId, factoryId),
          this.getFiveSRecords("five_s_team_assignments", orgId, factoryId)
        ]);
        const usedAsResponsible = areas.some((a: any) => a.responsible === person.name);
        const usedAsAuditor = assignments.some((a: any) => a.auditorName === person.name);
        if (usedAsResponsible || usedAsAuditor) {
          return `${person.name} silinemez: bir alanın sorumlusu veya bir denetim ekibinin denetçisi olarak atanmış. Önce o atamaları değiştirin.`;
        }
      }
    }
    return null;
  }

  // Bootstraps a brand-new customer's 5S module with Gemba Digital's real 5S audit methodology
  // (FIVE_S_DEFAULT_DEPARTMENTS/FIVE_S_DEFAULT_QUESTIONS, ported 1:1 from the legacy Power Apps
  // app's SharePoint list — see fiveSSeedData.ts) instead of leaving it empty. Guarded by "only if
  // this factory has zero departments yet" so it never touches a customer who already has any real
  // 5S setup, and only ever runs once per factory. Unlike the old seedIfEmpty bug (removed
  // 2026-08-07 for silently writing fabricated personnel/areas), this content is genuine real
  // methodology, not invented placeholder data — and it's inserted as normal editable rows, so
  // consultants can still add/edit/remove via Kurulum afterward. Uses two bulk multi-row INSERTs
  // (not 606 round trips) so it stays well within a serverless function's execution budget.
  public async ensureFiveSDefaults(orgId: string, factoryId: string, userId: string): Promise<void> {
    const existingDepts = await this.getFiveSRecords("five_s_departments", orgId, factoryId);
    if (existingDepts.length > 0) return;

    const nowIso = new Date().toISOString();
    const deptIdByName: Record<string, string> = {};
    const deptRows = FIVE_S_DEFAULT_DEPARTMENTS.map(name => {
      const id = randomId("five_s_departments");
      deptIdByName[name] = id;
      const data = { id, organization_id: orgId, factory_id: factoryId, name, created_by: userId, created_at: nowIso, updated_by: userId, updated_at: nowIso };
      return { id, data };
    });

    const questionRows = FIVE_S_DEFAULT_QUESTIONS.map(q => {
      const id = randomId("five_s_questions");
      const data = {
        id, organization_id: orgId, factory_id: factoryId,
        departmentId: deptIdByName[q.department], level: q.level, difficultyLevel: q.difficultyLevel,
        questionNo: q.questionNo, text: q.text,
        created_by: userId, created_at: nowIso, updated_by: userId, updated_at: nowIso
      };
      return { id, data };
    });

    await this.bulkInsertRecords("five_s_departments", orgId, deptRows);
    await this.bulkInsertRecords("five_s_questions", orgId, questionRows);
  }

  // Single multi-row INSERT for a batch of brand-new records (no upsert/merge — callers must
  // guarantee these ids don't already exist), used where inserting one-row-at-a-time would blow a
  // serverless function's execution budget (e.g. seeding hundreds of rows at once).
  private async bulkInsertRecords(collection: string, orgId: string, rows: { id: string; data: any; factoryId?: string }[]): Promise<void> {
    if (rows.length === 0) return;
    const values: string[] = [];
    const params: any[] = [];
    rows.forEach((row, i) => {
      const base = i * 5;
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, now())`);
      params.push(row.id, collection, orgId, row.factoryId ?? row.data.factory_id ?? null, row.data);
    });
    await getPool().query(
      `insert into records (id, collection, organization_id, factory_id, data, updated_at) values ${values.join(", ")}`,
      params
    );
  }

  // Deleting an audit header also drops everything that only makes sense in its context
  // (team assignments, scored answers, per-level results) so they don't pile up as orphans —
  // the legacy Power Apps app didn't bother with this, but there's no reason to carry the bug forward.
  public async deleteFiveSAudit(orgId: string, auditId: string): Promise<void> {
    await this.removeOne("five_s_audits", orgId, auditId);
    for (const collection of ["five_s_team_assignments", "five_s_answers", "five_s_results"] as const) {
      const all = await this.listCollection(collection, orgId);
      const toDelete = all.filter(r => r.auditId === auditId);
      await this.removeByIds(collection, orgId, toDelete.map(r => r.id));
    }
  }

  // "Denetim Takvimi Oluştur" — bulk-generates a sequence of audit headers evenly spaced by
  // frequencyDays between startDate/endDate (weekly = 7*n, monthly ≈ 30*n, chosen by the caller),
  // matching the legacy TakvimOlustur formula: sequential app-wide audit numbers, and one
  // unassigned team-assignment placeholder per existing area for every new audit.
  public async bulkGenerateFiveSAudits(
    orgId: string,
    factoryId: string,
    startDate: string,
    endDate: string,
    frequencyDays: number,
    userId: string
  ): Promise<any[]> {
    const existingForScope = (await this.listCollection("five_s_audits", orgId)).filter(a => a.factory_id === factoryId);
    let nextAuditNo = existingForScope.reduce((max, a) => Math.max(max, a.auditNo || 0), 0) + 1;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const areas = await this.getFiveSRecords("five_s_areas", orgId, factoryId);
    const created: any[] = [];

    let cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      const auditId = randomId("five_s_audits");
      const nowIso = new Date().toISOString();
      const audit = {
        id: auditId,
        organization_id: orgId,
        factory_id: factoryId,
        auditNo: nextAuditNo,
        date: cursor.toISOString().slice(0, 10),
        status: "Başlanmadı",
        overallScore: null,
        created_by: userId,
        created_at: nowIso,
        updated_by: userId,
        updated_at: nowIso
      };
      await this.upsertMerged("five_s_audits", orgId, audit);
      created.push(audit);

      for (const area of areas) {
        const assignment = {
          id: randomId("five_s_team_assignments"),
          organization_id: orgId,
          factory_id: factoryId,
          auditId,
          areaId: area.id,
          auditorName: "",
          created_by: userId,
          created_at: nowIso,
          updated_by: userId,
          updated_at: nowIso
        };
        await this.upsertMerged("five_s_team_assignments", orgId, assignment);
      }

      nextAuditNo++;
      cursor = new Date(cursor.getTime() + frequencyDays * 24 * 60 * 60 * 1000);
    }

    return created;
  }

  // "Denetim Ekibi Kaydet" — batch-assigns/reassigns an auditor per area for one audit.
  public async saveFiveSTeamAssignments(
    orgId: string,
    factoryId: string,
    auditId: string,
    assignments: { areaId: string; auditorName: string; auditorId?: string }[],
    userId: string
  ): Promise<any[]> {
    const existingAssignments = await this.listCollection("five_s_team_assignments", orgId);
    const saved: any[] = [];
    for (const a of assignments) {
      const existing = existingAssignments.find(r => r.auditId === auditId && r.areaId === a.areaId);
      const nowIso = new Date().toISOString();
      if (existing) {
        const updated = { ...existing, auditorName: a.auditorName, auditorId: a.auditorId || "", updated_by: userId, updated_at: nowIso };
        await this.upsertMerged("five_s_team_assignments", orgId, updated);
        saved.push(updated);
      } else {
        const record = {
          id: randomId("five_s_team_assignments"),
          organization_id: orgId,
          factory_id: factoryId,
          auditId,
          areaId: a.areaId,
          auditorName: a.auditorName,
          auditorId: a.auditorId || "",
          created_by: userId,
          created_at: nowIso,
          updated_by: userId,
          updated_at: nowIso
        };
        await this.upsertMerged("five_s_team_assignments", orgId, record);
        saved.push(record);
      }
    }
    return saved;
  }

  // "Alan Denetimini Kaydet" — saves every scored question for one (audit, area, S-level) session
  // in a single atomic operation, then recomputes the legacy scoring formulas verbatim:
  // Sonuc = unweighted average of the 1-5 question scores (rounded to 2dp, still on a 1-5 scale);
  // previousScore ("HedefPuan") = the same area+level's Sonuc from the most recent EARLIER audit
  // (by auditNo) — a trend baseline, not a fixed target. Also flips a fresh audit's status from
  // Başlanmadı to Devam Ediyor (one-way, never regresses an already-in-progress/completed audit).
  public async saveFiveSAreaLevelAnswers(
    orgId: string,
    factoryId: string,
    auditId: string,
    areaId: string,
    level: string,
    answers: { questionId: string; score: number; comment: string; action: string; dueDate: string | null; photo?: string }[],
    userId: string
  ): Promise<{ answers: any[]; result: any; audit: any }> {
    const nowIso = new Date().toISOString();
    const existingAnswers = await this.listCollection("five_s_answers", orgId);
    const savedAnswers: any[] = [];
    for (const a of answers) {
      const existing = existingAnswers.find(r => r.auditId === auditId && r.areaId === areaId && r.questionId === a.questionId);
      const hasAction = !!(a.action && a.action.trim());
      const actionStatus = hasAction ? "Açık" : "Aksiyon Yok";
      const dueDate = a.dueDate || (hasAction ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : null);
      const record = {
        id: existing?.id || randomId("five_s_answers"),
        organization_id: orgId,
        factory_id: factoryId,
        auditId,
        areaId,
        questionId: a.questionId,
        score: a.score,
        comment: a.comment || "",
        action: a.action || "",
        actionStatus,
        dueDate,
        completedDate: existing?.completedDate ?? null,
        photo: a.photo !== undefined ? a.photo : existing?.photo,
        created_by: existing?.created_by || userId,
        created_at: existing?.created_at || nowIso,
        updated_by: userId,
        updated_at: nowIso
      };
      await this.upsertMerged("five_s_answers", orgId, record);
      savedAnswers.push(record);
    }

    const scoreAvg = savedAnswers.length > 0
      ? Math.round((savedAnswers.reduce((s, a) => s + Number(a.score || 0), 0) / savedAnswers.length) * 100) / 100
      : 0;

    const audits = await this.listCollection("five_s_audits", orgId);
    const currentAudit = audits.find(a => a.id === auditId);
    const currentAuditNo = currentAudit?.auditNo ?? 0;

    const allResults = await this.listCollection("five_s_results", orgId);
    const priorCandidates = allResults
      .filter(r => r.areaId === areaId && r.level === level && r.auditId !== auditId)
      .map(r => {
        const audit = audits.find(a => a.id === r.auditId);
        return { ...r, _auditNo: audit?.auditNo ?? -1 };
      })
      .filter(r => r._auditNo < currentAuditNo)
      .sort((a, b) => b._auditNo - a._auditNo);
    const previousScore = priorCandidates.length > 0 ? priorCandidates[0].score : null;

    const existingResult = allResults.find(r => r.auditId === auditId && r.areaId === areaId && r.level === level);
    const resultRecord = {
      id: existingResult?.id || randomId("five_s_results"),
      organization_id: orgId,
      factory_id: factoryId,
      auditId,
      areaId,
      level,
      score: scoreAvg,
      previousScore
    };
    await this.upsertMerged("five_s_results", orgId, resultRecord);

    let updatedAudit = currentAudit;
    if (currentAudit && currentAudit.status === "Başlanmadı") {
      updatedAudit = { ...currentAudit, status: "Devam Ediyor", updated_by: userId, updated_at: nowIso };
      await this.upsertMerged("five_s_audits", orgId, updatedAudit);
    }

    return { answers: savedAnswers, result: resultRecord, audit: updatedAudit };
  }

  // "Denetimi Tamamla" — one-way completion: requires every area assigned to this audit to have
  // all 5 S-level results recorded, then stamps DenetimPuani as the straight average of every
  // (area × level) Sonuc for this audit (still 1-5 scale, no weighting), matching the legacy math.
  public async completeFiveSAudit(orgId: string, auditId: string): Promise<{ success: boolean; error?: string; audit?: any }> {
    const audits = await this.listCollection("five_s_audits", orgId);
    const audit = audits.find(a => a.id === auditId);
    if (!audit) return { success: false, error: "Denetim bulunamadı." };
    if (audit.status === "Tamamlandı") return { success: false, error: "Denetim zaten tamamlanmış." };

    const results = (await this.listCollection("five_s_results", orgId)).filter(r => r.auditId === auditId);
    const assignments = (await this.listCollection("five_s_team_assignments", orgId)).filter(r => r.auditId === auditId);
    const areaCount = new Set(assignments.map(a => a.areaId)).size;
    if (areaCount === 0 || results.length < areaCount * 5) {
      return { success: false, error: "Denetim tamamlanamaz: tüm alanların 5 S seviyesi de puanlanmalıdır." };
    }

    const avg = results.reduce((s, r) => s + Number(r.score || 0), 0) / results.length;
    const updatedAudit = { ...audit, status: "Tamamlandı", overallScore: Math.round(avg * 100) / 100, updated_at: new Date().toISOString() };
    await this.upsertMerged("five_s_audits", orgId, updatedAudit);
    return { success: true, audit: updatedAudit };
  }

  // Kaizen Suggestions module — ported from a legacy Power Apps app ("KaizenSuite") that ran an
  // employee suggestion-box workflow for one plant: submit -> team-leader (Manager) approval ->
  // Kaizen Board evaluation/approval -> tracked to completion. Personnel/Criteria are simple
  // factory-scoped rosters (generic CRUD, same shape as the 5S module); Suggestions/Approvals/
  // Evaluations get their own routes below since the approve/reject actions involve real
  // server-side state transitions + authorization, not a plain upsert.
  public async getKaizenRecords(collection: KaizenCollection, orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection(collection, orgId);
    return all.filter(r => !factoryId || r.factory_id === factoryId);
  }

  public async saveKaizenRecord(collection: KaizenCollection, orgId: string, factoryId: string, record: any, userId: string): Promise<any> {
    const isNew = !record.id || !(await this.getRecordById(collection, record.id, orgId));
    if (isNew) {
      if (!record.id) record.id = randomId(collection);
      record.created_by = userId;
      record.created_at = new Date().toISOString();
    }
    record.organization_id = orgId;
    record.factory_id = factoryId;
    record.updated_by = userId;
    record.updated_at = new Date().toISOString();
    return this.upsertMerged(collection, orgId, record);
  }

  public async deleteKaizenRecord(collection: KaizenCollection, orgId: string, id: string): Promise<void> {
    await this.removeOne(collection, orgId, id);
  }

  // "Yeni Öneri Kaydet" — creates a suggestion in Pending status. Unlike the legacy app, the
  // submitter identity is captured once here and never silently reassigned on later edits (see
  // updateKaizenSuggestion below), and ISG/Çevre/Motivasyon are actually persisted (legacy captured
  // them in the UI but discarded them on save — see kaizenTypes.ts header comment).
  public async createKaizenSuggestion(orgId: string, factoryId: string, payload: any, userId: string, userEmail: string, userName: string): Promise<any> {
    const nowIso = new Date().toISOString();
    const record = {
      id: randomId("kaizen_suggestions"),
      organization_id: orgId,
      factory_id: factoryId,
      authorEmail: userEmail,
      authorName: userName,
      personnelName: payload.personnelName || userName,
      personnelDepartment: payload.personnelDepartment || "",
      personnelJobTitle: payload.personnelJobTitle || "",
      shift: payload.shift || "",
      teamLeaderName: payload.teamLeaderName || "",
      teamLeaderEmail: payload.teamLeaderEmail || "",
      machineLeaderName: payload.machineLeaderName || "",
      machineLeaderEmail: payload.machineLeaderEmail || "",
      subject: payload.subject || "",
      suggestionTypes: payload.suggestionTypes || [],
      currentState: payload.currentState || "",
      improvementSuggestion: payload.improvementSuggestion || "",
      stage: payload.stage || "",
      paybackPeriod: payload.paybackPeriod || "",
      estimatedSaving: Number(payload.estimatedSaving) || 0,
      estimatedSavingCurrency: payload.estimatedSavingCurrency || "TL",
      estimatedCost: Number(payload.estimatedCost) || 0,
      estimatedCostCurrency: payload.estimatedCostCurrency || "TL",
      isg: !!payload.isg,
      cevre: !!payload.cevre,
      motivasyon: !!payload.motivasyon,
      photosCurrent: payload.photosCurrent || [],
      photosPropose: payload.photosPropose || [],
      approvalStatus: "Pending",
      completed: false,
      created_by: userId,
      createdBy: userName,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await this.upsertMerged("kaizen_suggestions", orgId, record);
    return record;
  }

  // "Öneriyi Düzenle" — only reachable while Rejected/Rejected 2nd (enforced by the route). Resets
  // the suggestion back to Pending so it re-enters the Manager queue, matching the legacy resubmit
  // flow. The submitter identity is preserved (legacy app bug: it overwrote `Personel` with
  // whoever last saved the record, even a team leader editing someone else's rejected suggestion).
  public async updateKaizenSuggestion(orgId: string, id: string, payload: any, userId: string): Promise<any> {
    const existing = await this.getRecordById("kaizen_suggestions", id, orgId);
    if (!existing) return null;
    const updated = {
      ...existing,
      personnelJobTitle: payload.personnelJobTitle ?? existing.personnelJobTitle,
      subject: payload.subject ?? existing.subject,
      suggestionTypes: payload.suggestionTypes ?? existing.suggestionTypes,
      currentState: payload.currentState ?? existing.currentState,
      improvementSuggestion: payload.improvementSuggestion ?? existing.improvementSuggestion,
      stage: payload.stage ?? existing.stage,
      paybackPeriod: payload.paybackPeriod ?? existing.paybackPeriod,
      estimatedSaving: payload.estimatedSaving !== undefined ? Number(payload.estimatedSaving) : existing.estimatedSaving,
      estimatedSavingCurrency: payload.estimatedSavingCurrency ?? existing.estimatedSavingCurrency,
      estimatedCost: payload.estimatedCost !== undefined ? Number(payload.estimatedCost) : existing.estimatedCost,
      estimatedCostCurrency: payload.estimatedCostCurrency ?? existing.estimatedCostCurrency,
      isg: payload.isg !== undefined ? !!payload.isg : existing.isg,
      cevre: payload.cevre !== undefined ? !!payload.cevre : existing.cevre,
      motivasyon: payload.motivasyon !== undefined ? !!payload.motivasyon : existing.motivasyon,
      photosCurrent: payload.photosCurrent ?? existing.photosCurrent,
      photosPropose: payload.photosPropose ?? existing.photosPropose,
      approvalStatus: "Pending",
      updated_by: userId,
      updatedAt: new Date().toISOString()
    };
    await this.upsertMerged("kaizen_suggestions", orgId, updated);
    return updated;
  }

  // Manager (team-leader) decision. Fixes a confirmed legacy bug where rejecting still wrote
  // "First Approval" regardless of the decision (see analysis notes) — here the status genuinely
  // branches on `approved`.
  public async decideKaizenManager(
    orgId: string, suggestionId: string, approved: boolean, comment: string,
    approverName: string, approverEmail: string
  ): Promise<{ suggestion: any; approval: any } | null> {
    const suggestion = await this.getRecordById("kaizen_suggestions", suggestionId, orgId);
    if (!suggestion || suggestion.approvalStatus !== "Pending") return null;
    const nowIso = new Date().toISOString();
    const approval = {
      id: randomId("kaizen_approvals"),
      organization_id: orgId,
      factory_id: suggestion.factory_id,
      suggestionId,
      stage: "Manager",
      approverName,
      approverEmail,
      approved,
      comment: comment || "",
      createdAt: nowIso
    };
    await this.upsertMerged("kaizen_approvals", orgId, approval);
    const updatedSuggestion = {
      ...suggestion,
      approvalStatus: approved ? "First Approval" : "Rejected",
      updatedAt: nowIso
    };
    await this.upsertMerged("kaizen_suggestions", orgId, updatedSuggestion);
    return { suggestion: updatedSuggestion, approval };
  }

  // Kaizen Board decision — creates the Evaluation record and advances/rejects the suggestion in
  // one atomic step, matching the legacy app's one-popup-does-both design (Section 3c of the
  // analysis). `criteria`/`point` are snapshotted onto the Evaluation row so a later edit to the
  // Criteria rubric doesn't retroactively change historical scores.
  public async decideKaizenBoard(
    orgId: string, suggestionId: string, approved: boolean,
    evaluation: { criteriaId: string; criteriaLabel: string; point: number; yokoten: boolean; yokotenDescription: string; estimatedIncome: number; estimatedIncomeCurrency: string; comment: string },
    approverName: string, approverEmail: string
  ): Promise<{ suggestion: any; approval: any; evaluation: any } | null> {
    const suggestion = await this.getRecordById("kaizen_suggestions", suggestionId, orgId);
    if (!suggestion || suggestion.approvalStatus !== "First Approval") return null;
    const nowIso = new Date().toISOString();

    const approvalRecord = {
      id: randomId("kaizen_approvals"),
      organization_id: orgId,
      factory_id: suggestion.factory_id,
      suggestionId,
      stage: "Board",
      approverName,
      approverEmail,
      approved,
      comment: evaluation.comment || "",
      createdAt: nowIso
    };
    await this.upsertMerged("kaizen_approvals", orgId, approvalRecord);

    const evaluationRecord = {
      id: randomId("kaizen_evaluations"),
      organization_id: orgId,
      factory_id: suggestion.factory_id,
      suggestionId,
      criteriaId: evaluation.criteriaId || "",
      criteriaLabel: evaluation.criteriaLabel || "",
      point: Number(evaluation.point) || 0,
      yokoten: !!evaluation.yokoten,
      yokotenDescription: evaluation.yokotenDescription || "",
      estimatedIncome: Number(evaluation.estimatedIncome) || 0,
      estimatedIncomeCurrency: evaluation.estimatedIncomeCurrency || "TL",
      comment: evaluation.comment || "",
      createdAt: nowIso
    };
    await this.upsertMerged("kaizen_evaluations", orgId, evaluationRecord);

    const updatedSuggestion = {
      ...suggestion,
      approvalStatus: approved ? "Second Approval" : "Rejected 2nd",
      updatedAt: nowIso
    };
    await this.upsertMerged("kaizen_suggestions", orgId, updatedSuggestion);

    return { suggestion: updatedSuggestion, approval: approvalRecord, evaluation: evaluationRecord };
  }

  // "Uygulandı olarak işaretle" — only meaningful once the Board has approved (Second Approval);
  // a standalone action rather than folded into the Board decision, since implementation usually
  // happens well after the suggestion is approved.
  public async markKaizenCompleted(orgId: string, suggestionId: string): Promise<any | null> {
    const suggestion = await this.getRecordById("kaizen_suggestions", suggestionId, orgId);
    if (!suggestion || suggestion.approvalStatus !== "Second Approval") return null;
    const updated = { ...suggestion, completed: true, updatedAt: new Date().toISOString() };
    await this.upsertMerged("kaizen_suggestions", orgId, updated);
    return updated;
  }

  // COPQ Snapshots (Loss Capacity Analizi historical trend tracking)
  public async getCopqSnapshots(orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection("copq_snapshots", orgId);
    return all.filter(s => !factoryId || s.factory_id === factoryId);
  }

  public async saveCopqSnapshot(orgId: string, snapshot: any, userId: string): Promise<any> {
    if (!snapshot.id) {
      snapshot.id = randomId("copqsnap");
      snapshot.organization_id = orgId;
      snapshot.created_by = userId;
      snapshot.created_at = new Date().toISOString();
    }
    snapshot.organization_id = orgId; // force matching
    return this.upsertMerged("copq_snapshots", orgId, snapshot);
  }

  public async deleteCopqSnapshot(orgId: string, id: string): Promise<void> {
    await this.removeOne("copq_snapshots", orgId, id);
  }

  // Loss Capacity Analizi module settings — one record per customer/factory (not a list): every
  // tunable the consultant enters for that customer (unit cost rates, industry benchmark choice,
  // COPQ/improvement/investment rate overrides, real financial data overrides, what-if sliders...)
  // lives in a single `settings` blob so it all persists together and survives session resets.
  public async getLossCapacitySettings(orgId: string, factoryId?: string): Promise<any | null> {
    const all = await this.listCollection("loss_capacity_settings", orgId);
    return all.find(r => !factoryId || r.factory_id === factoryId) || null;
  }

  public async saveLossCapacitySettings(orgId: string, factoryId: string, settings: Record<string, any>, userId: string): Promise<any> {
    const all = await this.listCollection("loss_capacity_settings", orgId);
    const existing = all.find(r => r.factory_id === factoryId);
    const record = {
      id: existing ? existing.id : randomId("lcset"),
      organization_id: orgId,
      factory_id: factoryId,
      settings,
      updated_by: userId,
      updated_at: new Date().toISOString()
    };
    await this.upsertMerged("loss_capacity_settings", orgId, record);
    return record;
  }

  // Master Plan Gantt module state (weekly consulting-package capacity + custom project plans,
  // with soft-deleted plans kept inline via a `deletedAt` marker for the trash bin) — one record
  // per customer/factory. Previously entirely client-only (gemba_contract_pkg_*,
  // gemba_custom_project_plans_*, gemba_deleted_custom_project_plans_* localStorage keys), so
  // contract capacity and custom plans only existed in whichever browser last edited them.
  public async getMasterPlanState(orgId: string, factoryId?: string): Promise<any | null> {
    const all = await this.listCollection("master_plan_state", orgId);
    const found = all.find(r => !factoryId || r.factory_id === factoryId);
    return found ? found.state : null;
  }

  public async saveMasterPlanState(orgId: string, factoryId: string, state: Record<string, any>, userId: string): Promise<any> {
    const all = await this.listCollection("master_plan_state", orgId);
    const existing = all.find(r => r.factory_id === factoryId);
    const record = {
      id: existing ? existing.id : randomId("mpstate"),
      organization_id: orgId,
      factory_id: factoryId,
      state,
      updated_by: userId,
      updated_at: new Date().toISOString()
    };
    await this.upsertMerged("master_plan_state", orgId, record);
    return record.state;
  }

  // Company Workspace (Proje Ekibi, Şirket Profili, Varlık Kaydı, Zaman Çizelgesi, Doküman
  // Kasası, Proje Portföyü tabs on the customer card) — one record per customer/factory, was
  // previously client-only (gemba_company_workspace_${customerId} localStorage), so it only
  // existed in whichever browser last edited it and nothing server-side (Mail Gönder recipients,
  // dashboards) could read it reliably.
  public async getCompanyWorkspace(orgId: string, factoryId?: string): Promise<any | null> {
    const all = await this.listCollection("company_workspaces", orgId);
    const found = all.find(r => !factoryId || r.factory_id === factoryId);
    return found ? found.workspace : null;
  }

  public async saveCompanyWorkspace(orgId: string, factoryId: string, workspace: Record<string, any>, userId: string): Promise<any> {
    const all = await this.listCollection("company_workspaces", orgId);
    const existing = all.find(r => r.factory_id === factoryId);
    const record = {
      id: existing ? existing.id : randomId("workspace"),
      organization_id: orgId,
      factory_id: factoryId,
      workspace,
      updated_by: userId,
      updated_at: new Date().toISOString()
    };
    await this.upsertMerged("company_workspaces", orgId, record);
    return record.workspace;
  }

  // Spaghetti Akış Sketcher module state — one record per customer/factory (not a list): the
  // full scenario/layout/node/flow drawing model, the editable flow-type & vertical-transfer
  // cost coefficients, and the financial parameters (labor rate inputs, area unit price...) all
  // live in a single `data` blob so the whole module survives session resets per customer.
  public async getSpaghettiFlowSettings(orgId: string, factoryId?: string): Promise<any | null> {
    const all = await this.listCollection("spaghetti_flow_settings", orgId);
    return all.find(r => !factoryId || r.factory_id === factoryId) || null;
  }

  public async saveSpaghettiFlowSettings(orgId: string, factoryId: string, data: Record<string, any>, userId: string): Promise<any> {
    const all = await this.listCollection("spaghetti_flow_settings", orgId);
    const existing = all.find(r => r.factory_id === factoryId);
    const record = {
      id: existing ? existing.id : randomId("sfset"),
      organization_id: orgId,
      factory_id: factoryId,
      data,
      updated_by: userId,
      updated_at: new Date().toISOString()
    };
    await this.upsertMerged("spaghetti_flow_settings", orgId, record);
    return record;
  }

  public async getVsmProjects(orgId: string, factoryId?: string): Promise<any[]> {
    const all = await this.listCollection("vsm_projects", orgId);
    return all.filter(p => {
      if (!factoryId) return true;
      const recordFactoryId = p.factory_id || "arcelik_bolu";
      return recordFactoryId === factoryId;
    });
  }

  public async saveVsmProject(orgId: string, project: any, userId: string): Promise<any> {
    if (!project.id) {
      project.id = randomId("vsm_proj");
      project.organization_id = orgId;
      project.created_by = userId;
      project.created_at = new Date().toISOString();
    }
    project.updated_by = userId;
    project.updated_at = new Date().toISOString();
    project.organization_id = orgId; // force matching
    return this.upsertMerged("vsm_projects", orgId, project);
  }

  public async deleteVsmProject(orgId: string, id: string): Promise<void> {
    await this.removeOne("vsm_projects", orgId, id);
  }

  public async getOpexAssessments(orgId: string, customerId?: string): Promise<any[]> {
    const all = await this.listCollection("opex_assessments", orgId);
    return all.filter(a => !customerId || a.customerId === customerId);
  }

  public async getOpexAssessmentById(orgId: string, id: string): Promise<any | null> {
    const all = await this.listCollection("opex_assessments", orgId);
    return all.find(a => a.id === id) || null;
  }

  public async saveOpexAssessment(orgId: string, assessment: any, userId: string): Promise<any> {
    if (!assessment.id) {
      assessment.id = randomId("opex_ass");
      assessment.organization_id = orgId;
      assessment.created_by = userId;
      assessment.created_at = new Date().toISOString();
    }
    assessment.updated_at = new Date().toISOString();
    assessment.organization_id = orgId; // force matching
    return this.upsertMerged("opex_assessments", orgId, assessment);
  }

  public async deleteOpexAssessment(orgId: string, id: string): Promise<void> {
    await this.removeOne("opex_assessments", orgId, id);
  }

  // Yamazumi Studies
  public async getYamazumiStudies(orgId: string, customerId?: string): Promise<YamazumiStudy[]> {
    const all = await this.listCollection("yamazumi_studies", orgId);
    return all.filter(s => !customerId || s.customerId === customerId);
  }

  public async saveYamazumiStudy(orgId: string, study: any, userId: string): Promise<YamazumiStudy> {
    if (!study.id) {
      study.id = randomId("yam_study");
      study.organization_id = orgId;
      study.created_at = new Date().toISOString();
    }
    study.updated_at = new Date().toISOString();
    study.organization_id = orgId;
    return this.upsertMerged("yamazumi_studies", orgId, study);
  }

  public async deleteYamazumiStudy(orgId: string, id: string): Promise<void> {
    await this.removeOne("yamazumi_studies", orgId, id);
  }

  // OpEx Assessment question bank — shared org-wide (not per-factory), since it represents the
  // assessment methodology itself, not a customer's data. Auto-seeded from the verified original
  // question set (ported from the Power Apps source) the first time an org has none, so the
  // module works immediately; from then on the DB records are the only source of truth and are
  // editable via the admin Soru Bankası screen.
  public async getOpexCategories(orgId: string): Promise<any[]> {
    const existing = await this.listCollection("opex_categories", orgId);
    if (existing.length > 0) return existing;
    for (const cat of OPEX_SEED_CATEGORIES) {
      await this.upsertMerged("opex_categories", orgId, { ...cat, organization_id: orgId });
    }
    for (const q of OPEX_SEED_QUESTIONS) {
      await this.upsertMerged("opex_questions", orgId, { ...q, organization_id: orgId });
    }
    return this.listCollection("opex_categories", orgId);
  }

  public async saveOpexCategory(orgId: string, cat: any, userId: string): Promise<any> {
    if (!cat.id) cat.id = randomId("opexcat");
    cat.organization_id = orgId;
    cat.updated_by = userId;
    cat.updated_at = new Date().toISOString();
    return this.upsertMerged("opex_categories", orgId, cat);
  }

  public async deleteOpexCategory(orgId: string, id: string): Promise<void> {
    await this.removeOne("opex_categories", orgId, id);
  }

  public async getOpexQuestions(orgId: string): Promise<any[]> {
    // Piggyback on getOpexCategories' seeding so a fresh org gets both in one call regardless of
    // which endpoint the frontend happens to hit first.
    await this.getOpexCategories(orgId);
    return this.listCollection("opex_questions", orgId);
  }

  public async saveOpexQuestion(orgId: string, q: any, userId: string): Promise<any> {
    if (!q.id) q.id = randomId("opexq");
    q.organization_id = orgId;
    q.updated_by = userId;
    q.updated_at = new Date().toISOString();
    return this.upsertMerged("opex_questions", orgId, q);
  }

  public async deleteOpexQuestion(orgId: string, id: string): Promise<void> {
    await this.removeOne("opex_questions", orgId, id);
  }

  // Role Module Visibility — real, backend-enforced replacement for the Platform Admin Console's
  // old "Role & Permissions" matrix, which was pure unpersisted UI state (a toggle would revert
  // the moment the console was reopened, since nothing was ever saved). One settings row per
  // organization; Admin is intentionally not stored here — always full access, non-configurable.
  public async getRoleModuleVisibility(orgId: string): Promise<RoleModuleVisibility> {
    const all = await this.listCollection("role_module_visibility", orgId);
    const existing = all[0];
    if (!existing) return DEFAULT_ROLE_MODULE_VISIBILITY;
    return {
      Consultant: { ...DEFAULT_ROLE_MODULE_VISIBILITY.Consultant, ...(existing.settings?.Consultant || {}) },
      "Customer User": { ...DEFAULT_ROLE_MODULE_VISIBILITY["Customer User"], ...(existing.settings?.["Customer User"] || {}) }
    };
  }

  public async saveRoleModuleVisibility(orgId: string, settings: RoleModuleVisibility, userId: string): Promise<RoleModuleVisibility> {
    const all = await this.listCollection("role_module_visibility", orgId);
    const existing = all[0];
    const record = {
      id: existing?.id || randomId("rolevis"),
      organization_id: orgId,
      settings,
      updated_by: userId,
      updated_at: new Date().toISOString()
    };
    await this.upsertMerged("role_module_visibility", orgId, record);
    return this.getRoleModuleVisibility(orgId);
  }
}

// Global database instance
export const db = new GeminiDb();
