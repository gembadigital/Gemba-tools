import crypto from "crypto";
import { Pool } from "pg";

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
// spaghetti_flow_settings, time_studies, smed_projects, ptr_records, five_s_* x10,
// gemba_walk_findings) lives as one row per record in a single generic Postgres table (see
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
    return this.upsertMerged(collection, orgId, record);
  }

  public async deleteFiveSRecord(collection: FiveSCollection, orgId: string, id: string): Promise<void> {
    await this.removeOne(collection, orgId, id);
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
    assignments: { areaId: string; auditorName: string }[],
    userId: string
  ): Promise<any[]> {
    const existingAssignments = await this.listCollection("five_s_team_assignments", orgId);
    const saved: any[] = [];
    for (const a of assignments) {
      const existing = existingAssignments.find(r => r.auditId === auditId && r.areaId === a.areaId);
      const nowIso = new Date().toISOString();
      if (existing) {
        const updated = { ...existing, auditorName: a.auditorName, updated_by: userId, updated_at: nowIso };
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
}

// Global database instance
export const db = new GeminiDb();
