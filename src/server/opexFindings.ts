// ".js" required in imports: Vercel runs this server as native ESM.

// Consultant / auditor findings ("Danışman Yorumları") of an OpEx audit: the major problem topics
// and the on-site context each consultant wants the AI summary to respect (e.g. "SMED scores low
// but the customer has very little equipment, so it is not a priority"). One entry per author,
// stored on the assessment as `consultantFindings[userId]`. Kept apart from the scoring merge so
// that two consultants saving at the same time never overwrite each other's answers, and so a
// comment can still be added or refined after the audit is locked (it changes no score).

export interface ConsultantFinding { userId: string; name: string; text: string; updatedAt: string }
export const MAX_FINDING_LENGTH = 4000;

type User = { id: string; role: string; full_name?: string };

// Who may write: the Admin, and a consultant who is on the customer's team or was assigned
// categories in this audit. A Customer User never can (and never sees them).
export function canWriteFinding(user: User, assessment: any, customer: any): boolean {
  if (user.role === "Admin") return true;
  if (user.role !== "Consultant") return false;
  const team = [customer?.primaryConsultantId, ...(customer?.consultantIds || [])].filter(Boolean);
  const assessors = Object.values(assessment?.assessorAssignments || {});
  return team.includes(user.id) || assessors.includes(user.id);
}

// Returns the new `consultantFindings` map with only the caller's own entry changed (empty text
// removes it). Never touches other authors' entries.
export function applyFinding(existing: Record<string, ConsultantFinding> | undefined, user: User, text: string, now = new Date().toISOString()): Record<string, ConsultantFinding> {
  const map: Record<string, ConsultantFinding> = { ...(existing || {}) };
  const clean = String(text ?? "").replace(/\r/g, "").trim().slice(0, MAX_FINDING_LENGTH);
  if (!clean) delete map[user.id];
  else map[user.id] = { userId: user.id, name: user.full_name || "Danışman", text: clean, updatedAt: now };
  return map;
}

export const listFindings = (assessment: any): ConsultantFinding[] =>
  Object.values((assessment?.consultantFindings || {}) as Record<string, ConsultantFinding>)
    .filter(f => f && typeof f.text === "string" && f.text.trim())
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
