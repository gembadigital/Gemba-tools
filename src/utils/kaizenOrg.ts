// Kaizen personel organizasyonu (Faz 3.1). A person is identified by their sicil no (employeeNo,
// unique per customer) and points at their direct supervisor by record id (managerId) — no longer
// by e-mail. Following managerId upwards gives the chain of command; following it downwards gives a
// person's whole team at any depth (a hat yöneticisi sees the teams of the takım liderleri under them).
//
// Records saved before Faz 3.1 have no managerId; their supervisor is resolved from the old
// teamLeaderEmail, so existing data keeps working without a migration. Shared by the client and the
// server (server imports "../utils/kaizenOrg.js"), so keep it dependency-free.

export interface OrgPerson {
  id: string;
  name?: string;
  email?: string;
  employeeNo?: string;
  managerId?: string;
  teamLeaderEmail?: string;
}

const lc = (v?: string) => (v || "").trim().toLowerCase();

// Sicil no is compared trimmed and case-insensitively ("a-102" == "A-102 ").
export const normEmployeeNo = (v: unknown) => String(v ?? "").trim().toUpperCase();

export function findByEmail<T extends OrgPerson>(people: T[], email?: string): T | undefined {
  const e = lc(email);
  return e ? people.find(p => lc(p.email) === e) : undefined;
}

// Direct supervisor id: the explicit reference, else the legacy e-mail link.
export function effectiveManagerId(p: OrgPerson, people: OrgPerson[]): string | undefined {
  if (p.managerId) return people.some(x => x.id === p.managerId) ? p.managerId : undefined;
  const legacy = findByEmail(people, p.teamLeaderEmail);
  return legacy && legacy.id !== p.id ? legacy.id : undefined;
}

export interface Org {
  managerOf: Map<string, string>;
  reportsOf: Map<string, string[]>;
}

export function buildOrg(people: OrgPerson[]): Org {
  const managerOf = new Map<string, string>();
  const reportsOf = new Map<string, string[]>();
  for (const p of people) {
    const m = effectiveManagerId(p, people);
    if (!m) continue;
    managerOf.set(p.id, m);
    reportsOf.set(m, [...(reportsOf.get(m) || []), p.id]);
  }
  return { managerOf, reportsOf };
}

// Everyone below `rootId`, at any depth (not including rootId). Cycle-safe.
export function subordinateIds(rootId: string, org: Org): Set<string> {
  const out = new Set<string>();
  const queue = [...(org.reportsOf.get(rootId) || [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (id === rootId || out.has(id)) continue;
    out.add(id);
    queue.push(...(org.reportsOf.get(id) || []));
  }
  return out;
}

// Supervisors above `id`, nearest first. Cycle-safe.
export function managerChain(id: string, org: Org): string[] {
  const chain: string[] = [];
  let cur = org.managerOf.get(id);
  while (cur && !chain.includes(cur) && cur !== id) {
    chain.push(cur);
    cur = org.managerOf.get(cur);
  }
  return chain;
}

// Would making `managerId` the supervisor of `personId` create a loop (A → B → … → A)?
export function wouldCycle(personId: string, managerId: string, people: OrgPerson[]): boolean {
  if (!personId) return false;
  if (personId === managerId) return true;
  // A loop appears exactly when the new supervisor already sits somewhere in the person's own team.
  return subordinateIds(personId, buildOrg(people)).has(managerId);
}

// Validates and normalizes a personnel record about to be saved, against the customer's existing
// roster. Returns the record to store (with denormalized teamLeaderName/Email derived from the
// manager, so approval routing that still reads those fields keeps working) or an error message.
export function preparePersonnel<T extends OrgPerson & Record<string, any>>(
  input: Record<string, any>,
  roster: T[]
): { record?: Record<string, any>; error?: string } {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const id = typeof input.id === "string" ? input.id : "";
  const employeeNo = normEmployeeNo(input.employeeNo).slice(0, 40);
  const name = str(input.name, 120);
  if (!employeeNo) return { error: "Sicil no zorunludur." };
  if (!name) return { error: "Ad soyad zorunludur." };
  const others = roster.filter(p => p.id !== id);
  const dup = others.find(p => normEmployeeNo(p.employeeNo) === employeeNo);
  if (dup) return { error: `${employeeNo} sicil no zaten ${dup.name || "başka bir personel"} için kayıtlı.` };
  const email = str(input.email, 160).toLowerCase();
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "E-posta adresi geçersiz." };
    const dupMail = others.find(p => lc(p.email) === email);
    if (dupMail) return { error: `${email} e-postası zaten ${dupMail.name || "başka bir personel"} için kayıtlı.` };
  }

  // managerId: undefined → keep whatever link the record had; "" → no supervisor; id → that person.
  const record: Record<string, any> = {
    ...input,
    employeeNo, name, email,
    department: str(input.department, 120),
    jobTitle: str(input.jobTitle, 120),
    shift: str(input.shift, 40),
    machineLeaderName: str(input.machineLeaderName, 120),
    machineLeaderEmail: str(input.machineLeaderEmail, 160).toLowerCase(),
    // A Kurul Yöneticisi is always also a Kurul member.
    isBoardAdmin: input.isBoardAdmin === true,
    isBoardMember: input.isBoardMember === true || input.isBoardAdmin === true
  };
  if (input.managerId !== undefined) {
    const managerId = typeof input.managerId === "string" ? input.managerId : "";
    if (managerId) {
      const manager = others.find(p => p.id === managerId);
      if (!manager) return { error: "Seçilen amir bu müşterinin personel listesinde yok." };
      if (wouldCycle(id, managerId, roster)) return { error: `${manager.name} zaten bu kişinin ekibinde; döngü oluşur.` };
      record.managerId = managerId;
      record.teamLeaderName = manager.name || "";
      record.teamLeaderEmail = lc(manager.email);
    } else {
      record.managerId = "";
      record.teamLeaderName = "";
      record.teamLeaderEmail = "";
    }
  } else {
    record.teamLeaderName = str(input.teamLeaderName, 120);
    record.teamLeaderEmail = str(input.teamLeaderEmail, 160).toLowerCase();
  }
  return { record };
}

// The roster record a suggestion is about: by stored id, else (older suggestions) by the
// submitter's e-mail when they submitted for themselves, else by exact name.
export function personOfSuggestion<T extends OrgPerson>(
  s: { personnelId?: string; personnelName?: string; authorEmail?: string; authorName?: string },
  people: T[]
): T | undefined {
  if (s.personnelId) {
    const byId = people.find(p => p.id === s.personnelId);
    if (byId) return byId;
  }
  if (s.authorName && s.personnelName === s.authorName) {
    const byMail = findByEmail(people, s.authorEmail);
    if (byMail) return byMail;
  }
  const name = lc(s.personnelName);
  return name ? people.find(p => lc(p.name) === name) : undefined;
}

// ---- Görünürlük (Faz 3.4) ----
// Which suggestions a non-Kurul person may see: their own (as author or as the person it is
// about), the ones they are the direct supervisor of, everything of their team at any depth, and
// the ones whose implementation they own. Kurul members and staff see everything (decided by the
// caller). The server applies this to every Kaizen list endpoint; the UI filter is not the guard.
export function visibleSuggestionIds(
  email: string,
  roster: OrgPerson[],
  suggestions: { id: string; authorEmail?: string; teamLeaderEmail?: string; personnelId?: string; personnelName?: string; authorName?: string }[],
  implementations: { suggestionId: string; ownerEmail?: string }[]
): Set<string> {
  const e = lc(email);
  const me = findByEmail(roster, e);
  const team = me ? subordinateIds(me.id, buildOrg(roster)) : new Set<string>();
  const ownedImpl = new Set(implementations.filter(i => e && lc(i.ownerEmail) === e).map(i => i.suggestionId));
  const out = new Set<string>();
  for (const s of suggestions) {
    if (lc(s.authorEmail) === e || lc(s.teamLeaderEmail) === e || ownedImpl.has(s.id)) { out.add(s.id); continue; }
    const person = personOfSuggestion(s, roster);
    if (person && (person.id === me?.id || team.has(person.id))) out.add(s.id);
  }
  return out;
}
