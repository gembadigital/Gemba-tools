// Ayın Kaizen Şampiyonları (Faz 5.5). Ranking is by Kurul points (no separate participation score —
// decision 2026-10-28), then by number of suggestions. For a month YYYY-MM:
// - points: Kurul evaluations scored in that month (point > 0), credited to the suggestion's person;
// - count: suggestions submitted in that month.
// Shared by the server route and the tests; pure and dependency-free.

export interface ChampionRow { key: string; name: string; department: string; points: number; count: number; scored: number }

const add = (m: Map<string, ChampionRow>, key: string, name: string, department: string, patch: Partial<ChampionRow>) => {
  const r = m.get(key) || { key, name, department, points: 0, count: 0, scored: 0 };
  r.points += patch.points || 0;
  r.count += patch.count || 0;
  r.scored += patch.scored || 0;
  m.set(key, r);
};
const rank = (rows: ChampionRow[]) =>
  rows.filter(r => r.points > 0 || r.count > 0).sort((a, b) => b.points - a.points || b.count - a.count || a.name.localeCompare(b.name, "tr"));

export function championsFor(suggestions: any[], evaluations: any[], month: string): { people: ChampionRow[]; departments: ChampionRow[] } {
  const people = new Map<string, ChampionRow>();
  const depts = new Map<string, ChampionRow>();
  const personOf = (s: any) => ({ key: s.personnelId || s.personnelName || "—", name: s.personnelName || "—", dept: s.personnelDepartment || "Belirtilmemiş" });
  for (const s of suggestions) {
    if (!(s.createdAt || "").startsWith(month)) continue;
    const p = personOf(s);
    add(people, p.key, p.name, p.dept, { count: 1 });
    add(depts, p.dept, p.dept, p.dept, { count: 1 });
  }
  const byId = new Map(suggestions.map(s => [s.id, s]));
  for (const e of evaluations) {
    const point = Number(e.point) || 0;
    if (!(e.createdAt || "").startsWith(month) || point <= 0) continue;
    const s = byId.get(e.suggestionId);
    if (!s) continue;
    const p = personOf(s);
    add(people, p.key, p.name, p.dept, { points: point, scored: 1 });
    add(depts, p.dept, p.dept, p.dept, { points: point, scored: 1 });
  }
  return { people: rank([...people.values()]), departments: rank([...depts.values()]) };
}

// Months that have any activity, newest first (for the month picker).
export function championMonths(suggestions: any[], evaluations: any[]): string[] {
  const set = new Set<string>();
  for (const x of [...suggestions, ...evaluations]) {
    const m = (x.createdAt || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(m)) set.add(m);
  }
  return [...set].sort().reverse();
}
