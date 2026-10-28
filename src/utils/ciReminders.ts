// Weekly CI reminder digests (plan step C9): per person, what needs them this week. Shared and pure
// (server cron / "send now" / preview, and tests); dependency-free apart from ciLifecycle.
// Only people with a user account are addressed — older actions / leaders stored as a name only
// can't be mailed (the digest preview lists them as "hesabı yok").
import { CI_STEPS, isClosed, isTaskFinished, stageOf } from "./ciLifecycle.js";

export interface CiDigestItem {
  kind: "taskOverdue" | "taskDue" | "approval" | "stageLate" | "followUp";
  projectId: string;
  projectTitle: string;
  text: string;
}

export interface CiDigest { userId: string; name: string; email: string; items: CiDigestItem[] }

interface UserLike { id: string; full_name?: string; email?: string; status?: string }

const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const fmt = (iso?: string) => iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "";

export function buildCiDigests(projects: any[], users: UserLike[], todayIso: string): CiDigest[] {
  const weekEnd = addDays(todayIso, 7);
  const byUser = new Map<string, CiDigestItem[]>();
  const add = (userId: string | undefined, item: CiDigestItem) => {
    if (!userId) return;
    byUser.set(userId, [...(byUser.get(userId) || []), item]);
  };
  for (const p of projects || []) {
    if (!p || p.holdState) continue;
    const base = { projectId: p.id, projectTitle: p.title || "Adsız proje" };
    if (isClosed(p)) {
      for (const f of p.followUps || []) {
        if (!f.checkedAt && f.dueDate && f.dueDate <= weekEnd) {
          add(p.projectLeaderId, { ...base, kind: "followUp", text: `${f.days}. gün sürdürülebilirlik kontrolü ${f.dueDate < todayIso ? "gecikti" : "zamanı geldi"} (${fmt(f.dueDate)})` });
        }
      }
      continue;
    }
    for (const t of p.tasks || []) {
      if (!t?.responsibleId || isTaskFinished(t) || !t.deadline) continue;
      if (t.deadline < todayIso) add(t.responsibleId, { ...base, kind: "taskOverdue", text: `Aksiyon termini geçti: ${t.name || "Adsız aksiyon"} (${fmt(t.deadline)})` });
      else if (t.deadline <= weekEnd) add(t.responsibleId, { ...base, kind: "taskDue", text: `Bu hafta termin: ${t.name || "Adsız aksiyon"} (${fmt(t.deadline)})` });
    }
    if (p.pendingApproval && p.projectLeaderId) {
      add(p.projectLeaderId, { ...base, kind: "approval", text: `Adım ${p.pendingApproval.stage} onayınızı bekliyor (${p.pendingApproval.by})` });
    }
    const stage = stageOf(p);
    const planned = p.stageDates?.[stage]?.planned;
    if (planned && planned < todayIso && p.projectLeaderId) {
      add(p.projectLeaderId, { ...base, kind: "stageLate", text: `Adım ${stage} (${CI_STEPS[stage - 1].title}) planlanan tarihi geçti (${fmt(planned)})` });
    }
  }
  const order: CiDigestItem["kind"][] = ["approval", "taskOverdue", "stageLate", "followUp", "taskDue"];
  return Array.from(byUser.entries())
    .map(([userId, items]) => {
      const u = users.find(x => x.id === userId);
      return { userId, name: u?.full_name || "", email: (u?.status === "Disabled" ? "" : u?.email) || "", items: items.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)) };
    })
    .filter(d => d.email);
}

export function ciDigestText(d: CiDigest, company: string, link: string): string {
  const byProject = new Map<string, CiDigestItem[]>();
  for (const it of d.items) byProject.set(it.projectTitle, [...(byProject.get(it.projectTitle) || []), it]);
  const lines = [`Merhaba ${d.name || ""},`.trim(), "", `${company ? company + " — " : ""}CI projelerinde bu hafta ilginizi bekleyen ${d.items.length} konu var:`, ""];
  for (const [title, items] of byProject) {
    lines.push(`• ${title}`);
    items.forEach(i => lines.push(`   - ${i.text}`));
  }
  lines.push("", `Gemba Tools → CI Proje Yönetimi: ${link}`, "", "Bu e-posta haftalık otomatik hatırlatmadır; CI Ayarları'ndan kapatılabilir.");
  return lines.join("\n");
}
