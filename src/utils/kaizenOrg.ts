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
  implementations: { suggestionId: string; ownerEmail?: string }[],
  myPersonnelId?: string // sicil session (Faz 3.5): identity by record id, e-mail may be absent
): Set<string> {
  const e = lc(email);
  const me = (myPersonnelId && roster.find(p => p.id === myPersonnelId)) || findByEmail(roster, e);
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

// ---- Excel ile personel yükleme (Faz 3.2) ----
// One template, read by header name (order and extra columns do not matter; Turkish and common
// alternative spellings accepted). Rows are matched to the roster by sicil no: a known sicil
// updates that person (empty cells leave the field as it is), an unknown one creates a person.
// "Amir Sicil No" may point at someone created further down in the same file.
export const IMPORT_COLUMNS: { key: string; header: string; aliases: string[]; required?: boolean; hint?: string }[] = [
  { key: "employeeNo", header: "Sicil No", aliases: ["sicil", "sicil numarası", "sicil numarasi", "personel no", "employee no"], required: true },
  { key: "name", header: "Ad Soyad", aliases: ["adı soyadı", "adi soyadi", "ad", "isim", "personel", "name"], required: true },
  { key: "email", header: "E-posta", aliases: ["eposta", "e posta", "email", "e-mail", "mail"] },
  { key: "department", header: "Bölüm", aliases: ["bolum", "departman", "department"] },
  { key: "jobTitle", header: "Görev", aliases: ["gorev", "unvan", "pozisyon", "job title"] },
  { key: "shift", header: "Vardiya", aliases: ["shift"] },
  { key: "managerNo", header: "Amir Sicil No", aliases: ["amir sicil", "amir sicili", "amir sicil numarası", "amir no", "manager no"], hint: "Boş bırakılırsa mevcut amir değişmez. Amiri kaldırmak için - yazın." },
  { key: "machineLeaderName", header: "Makine Lideri", aliases: ["makine lideri adı"] },
  { key: "machineLeaderEmail", header: "Makine Lideri E-posta", aliases: ["makine lideri eposta", "makine lideri email"] },
  { key: "isBoardMember", header: "Kurul Üyesi", aliases: ["kurul", "kurul uyesi", "kaizen kurulu"], hint: "Evet / Hayır" }
];
export const MAX_IMPORT_ROWS = 2000;

const normHeader = (h: string) => h.toLocaleLowerCase("tr").replace(/\*/g, "").replace(/\s+/g, " ").trim()
  .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");
const HEADER_INDEX: Map<string, string> = new Map(
  IMPORT_COLUMNS.flatMap(c => [c.header, ...c.aliases].map(a => [normHeader(a), c.key] as [string, string]))
);

export function mapImportRow(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [h, v] of Object.entries(raw || {})) {
    const key = HEADER_INDEX.get(normHeader(String(h)));
    if (key && v !== null && v !== undefined && String(v).trim() !== "") out[key] = String(v).trim();
  }
  return out;
}

const parseYesNo = (v: string): boolean | undefined => {
  const t = normHeader(v);
  if (["evet", "e", "1", "x", "var", "true", "yes", "y"].includes(t)) return true;
  if (["hayir", "h", "0", "yok", "false", "no", "n", "-"].includes(t)) return false;
  return undefined;
};

export type ImportAction = "create" | "update" | "unchanged" | "error";
export interface ImportRowResult { row: number; employeeNo: string; name: string; action: ImportAction; messages: string[] }

// Builds the import plan. `newId` makes ids for new people (they may be referenced as Amir by
// later rows). Returns per-row results and the records to save (only created/changed ones).
export function planPersonnelImport<T extends OrgPerson & Record<string, any>>(
  rawRows: Record<string, unknown>[],
  roster: T[],
  newId: () => string
): { results: ImportRowResult[]; toSave: Record<string, any>[] } {
  const working: Record<string, any>[] = roster.map(p => ({ ...p }));
  // "Changed?" compares the meaningful fields only (normalization may add empty defaults).
  const sig = (p: Record<string, any>) => JSON.stringify([
    normEmployeeNo(p.employeeNo), p.name || "", lc(p.email), p.department || "", p.jobTitle || "", p.shift || "",
    p.machineLeaderName || "", lc(p.machineLeaderEmail), !!p.isBoardMember, p.managerId || "", p.teamLeaderName || "", lc(p.teamLeaderEmail)
  ]);
  const original = new Map(roster.map(p => [p.id, sig(p)]));
  const results: ImportRowResult[] = [];
  const seen = new Map<string, number>();
  const pendingManager: { res: ImportRowResult; id: string; managerNo: string }[] = [];
  const bySicil = () => new Map(working.map(p => [normEmployeeNo(p.employeeNo), p]));

  if (rawRows.length > MAX_IMPORT_ROWS) {
    return { results: [{ row: 0, employeeNo: "", name: "", action: "error", messages: [`En fazla ${MAX_IMPORT_ROWS} satır yüklenebilir (dosyada ${rawRows.length}).`] }], toSave: [] };
  }

  rawRows.forEach((raw, i) => {
    const rowNo = i + 2; // row 1 is the header in the sheet
    const r = mapImportRow(raw);
    if (Object.keys(r).length === 0) return; // blank line
    const employeeNo = normEmployeeNo(r.employeeNo);
    const res: ImportRowResult = { row: rowNo, employeeNo, name: r.name || "", action: "error", messages: [] };
    results.push(res);
    if (!employeeNo) { res.messages.push("Sicil no boş."); return; }
    if (seen.has(employeeNo)) { res.messages.push(`Bu sicil no dosyada ${seen.get(employeeNo)}. satırda da var.`); return; }
    seen.set(employeeNo, rowNo);

    const existing = bySicil().get(employeeNo);
    const input: Record<string, any> = { ...(existing || {}), employeeNo };
    for (const k of ["name", "email", "department", "jobTitle", "shift", "machineLeaderName", "machineLeaderEmail"]) {
      if (r[k] !== undefined) input[k] = r[k];
    }
    if (r.isBoardMember !== undefined) {
      const yn = parseYesNo(r.isBoardMember);
      if (yn === undefined) { res.messages.push(`Kurul Üyesi değeri anlaşılamadı: "${r.isBoardMember}" (Evet/Hayır).`); return; }
      input.isBoardMember = yn || !!input.isBoardAdmin;
    }
    if (!existing) input.id = newId();
    delete input.managerId; // supervisor is resolved in the second pass (may be later in the file)
    const prepared = preparePersonnel(input, working as any);
    if (!prepared.record) { res.messages.push(prepared.error || "Geçersiz satır."); return; }
    const rec: Record<string, any> = { ...prepared.record, managerId: existing?.managerId, teamLeaderName: existing?.teamLeaderName || "", teamLeaderEmail: existing?.teamLeaderEmail || "" };
    if (rec.managerId === undefined) delete rec.managerId;
    if (existing) Object.assign(working.find(p => p.id === existing.id)!, rec);
    else working.push(rec);
    res.action = existing ? "update" : "create";
    res.name = rec.name;
    if (r.managerNo !== undefined) pendingManager.push({ res, id: rec.id, managerNo: r.managerNo });
  });

  // Second pass: supervisors by sicil, now that every row of the file is known.
  for (const { res, id, managerNo } of pendingManager) {
    const person = working.find(p => p.id === id)!;
    if (managerNo.trim() === "-") { person.managerId = ""; person.teamLeaderName = ""; person.teamLeaderEmail = ""; continue; }
    const manager = bySicil().get(normEmployeeNo(managerNo));
    if (!manager) { res.messages.push(`Amir sicil no ${normEmployeeNo(managerNo)} bulunamadı; amir değiştirilmedi.`); continue; }
    if (wouldCycle(id, manager.id, working as OrgPerson[])) { res.messages.push(`${manager.name} bu kişinin ekibinde; döngü oluşacağı için amir değiştirilmedi.`); continue; }
    person.managerId = manager.id;
  }

  // Keep every denormalized supervisor name/e-mail in step (names may have changed in this file).
  for (const p of working) {
    if (!p.managerId) continue;
    const m = working.find(x => x.id === p.managerId);
    if (m) { p.teamLeaderName = m.name || ""; p.teamLeaderEmail = (m.email || "").toLowerCase(); }
  }

  const toSave = working.filter(p => original.get(p.id) !== sig(p));
  const changed = new Set(toSave.map(p => p.id));
  for (const res of results) {
    if (res.action === "update") {
      const p = working.find(x => normEmployeeNo(x.employeeNo) === res.employeeNo);
      if (p && !changed.has(p.id)) res.action = "unchanged";
    }
  }
  return { results, toSave };
}
