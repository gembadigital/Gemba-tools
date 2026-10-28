// CI project numbers "CIP<yy><mm>-<seq>". Shared by the client and the server (server imports it as
// "../utils/ciProject.js"), so keep it dependency-free.
//
// New projects get a permanent number from the server at creation (`projectNo`, `projectSeq`;
// <seq> runs per customer). Projects created before that have none; they are numbered for display
// by date order among the other unnumbered projects (1..n), which is what the screen always showed.
// A new sequence therefore starts above both that count and the highest stored one, so stored
// numbers never collide with or shift the older display numbers.

interface NumberedProject {
  id: string;
  dateProposed?: string;
  projectNo?: string;
  projectSeq?: number;
}

const yymm = (date: string | undefined) => {
  const d = /^\d{4}-\d{2}/.test(date || "") ? date! : new Date().toISOString();
  return `${d.slice(2, 4)}${d.slice(5, 7)}`;
};

const format = (date: string | undefined, seq: number) => `CIP${yymm(date)}-${String(seq).padStart(2, "0")}`;

// `existing` = all projects of the same customer.
export function nextProjectNumber(existing: NumberedProject[], dateProposed?: string): { projectNo: string; projectSeq: number } {
  const legacyCount = existing.filter(k => !k.projectSeq).length;
  const maxSeq = existing.reduce((m, k) => Math.max(m, Number(k.projectSeq) || 0), 0);
  const projectSeq = Math.max(legacyCount, maxSeq) + 1;
  return { projectNo: format(dateProposed, projectSeq), projectSeq };
}

// Number shown for a project; `all` = all projects of the same customer. Deleting an old,
// unnumbered project still shifts the old ones after it (until they are given stored numbers).
export function displayProjectNo(proj: NumberedProject, all: NumberedProject[]): string {
  if (proj.projectNo) return proj.projectNo;
  const legacy = all.filter(k => !k.projectNo).sort((a, b) => {
    const da = a.dateProposed || "";
    const db = b.dateProposed || "";
    if (da !== db) return da.localeCompare(db);
    return a.id.localeCompare(b.id);
  });
  const index = legacy.findIndex(p => p.id === proj.id);
  return format(proj.dateProposed || new Date().toISOString().split("T")[0], index !== -1 ? index + 1 : 1);
}
