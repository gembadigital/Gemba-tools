// One-time production bootstrap: creates the Gemba Partner organization and the real consultant
// accounts against a fresh Supabase Postgres database (run supabase/schema.sql first). Deliberately
// does NOT seed any demo customers/data — production starts clean, per the migration plan.
//
// Usage:
//   1. Fill in CONSULTANTS below with the real name/email for each of the 3 people who'll use the
//      app, replacing the placeholders.
//   2. Make sure DATABASE_URL (Supabase pooler connection string) is set — e.g. run with:
//        DATABASE_URL="postgres://..." npx tsx scripts/bootstrap-production.ts
//   3. Re-running is safe — any email that already has a user account is skipped.
//   4. Temporary passwords are printed once to the console. Relay them to each consultant over a
//      secure channel (not email/Slack in plaintext) and have them change it via "Şifre Değiştir"
//      on first login.
import crypto from "crypto";
import { db, hashPassword } from "../src/server/db";

const ORG_NAME = "Gemba Partner Mühendislik ve Yazılım A.Ş.";
const ORG_DOMAIN = "gembapartner.com";

// Replace with the 3 real consultants before running.
const CONSULTANTS: { full_name: string; email: string; role: "Admin" | "Consultant" }[] = [
  { full_name: "REPLACE ME", email: "replace-me-1@gembapartner.com", role: "Admin" },
  { full_name: "REPLACE ME", email: "replace-me-2@gembapartner.com", role: "Consultant" },
  { full_name: "REPLACE ME", email: "replace-me-3@gembapartner.com", role: "Consultant" }
];

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "");
}

async function main() {
  if (CONSULTANTS.some(c => c.email.startsWith("replace-me"))) {
    console.error("Edit scripts/bootstrap-production.ts and replace the CONSULTANTS placeholders with real names/emails before running.");
    process.exit(1);
  }

  const orgs = await db.getOrganizations();
  let org = orgs.find(o => o.domain === ORG_DOMAIN);
  if (!org) {
    org = await db.createOrganization(ORG_NAME, ORG_DOMAIN);
    console.log(`Created organization: ${org.organization_name} (${org.id})`);
  } else {
    console.log(`Organization already exists: ${org.organization_name} (${org.id})`);
  }

  const existingUsers = await db.getUsers();
  for (const c of CONSULTANTS) {
    if (existingUsers.some(u => u.email === c.email)) {
      console.log(`Skipped (already exists): ${c.email}`);
      continue;
    }
    const tempPassword = generateTempPassword();
    const user = await db.createUser({
      organization_id: org.id,
      full_name: c.full_name,
      email: c.email,
      password_hash: hashPassword(tempPassword),
      role: c.role,
      status: "Active"
    });
    console.log(`Created ${c.role} ${user.full_name} <${user.email}> — temp password: ${tempPassword}`);
  }

  console.log("Done. Relay each temp password securely; consultants should change it on first login.");
  process.exit(0);
}

main().catch(err => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
