// Haftalık hatırlatmalar (Faz 4.4) — who should be reminded of what, as one digest per person.
// Pure (no I/O) so the weekly cron, the Kurulum preview and the tests share it. Recipients are keyed
// by roster id when known (in-app + e-mail), else by e-mail.
import type { KaizenSettings } from "./kaizenSettings.js";
import { effectiveManagerId } from "./kaizenOrg.js";

export type ReminderKind = "manager-pending" | "manager-escalation" | "board-pending" | "feasibility-overdue" | "accepted-noplan" | "impl-overdue" | "followup-due";

export const REMINDER_LABELS: Record<ReminderKind, string> = {
  "manager-pending": "Amir onayınızı bekleyen öneriler",
  "manager-escalation": "Ekibinizde gecikmiş amir onayları",
  "board-pending": "Kurul değerlendirmesi bekleyen öneriler",
  "feasibility-overdue": "Hedef tarihi geçen fizibilite çalışmaları",
  "accepted-noplan": "Kabul edildi, uygulama planı yok",
  "impl-overdue": "Hedef tarihi geçen uygulamalar",
  "followup-due": "Kalıcılık kontrolü zamanı gelen uygulamalar"
};

export interface ReminderItem { kind: ReminderKind; suggestionId: string; subject: string; days: number }
export interface ReminderDigest { key: string; personnelId?: string; email?: string; name: string; items: ReminderItem[] }

const DAY = 86_400_000;
const daysSince = (iso: string | undefined, now: number) => {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY)) : 0;
};
const lc = (v?: string) => (v || "").trim().toLowerCase();

export function buildReminders(input: {
  suggestions: any[]; implementations: any[]; roster: any[]; settings: KaizenSettings; now?: number;
}): ReminderDigest[] {
  const { suggestions, implementations, roster, settings } = input;
  const now = input.now ?? Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const byId = new Map(roster.map(p => [p.id, p]));
  const byEmail = new Map(roster.filter(p => p.email).map(p => [lc(p.email), p]));
  const board = roster.filter(p => p.isBoardMember || p.isBoardAdmin);
  const boardAdmins = roster.filter(p => p.isBoardAdmin);
  const implBy = new Map(implementations.map(i => [i.suggestionId, i]));
  const digests = new Map<string, ReminderDigest>();

  // Add an item for a person (by id or e-mail); unknown / virtual addresses are skipped.
  const push = (who: { id?: string; email?: string }, item: ReminderItem) => {
    const person = (who.id && byId.get(who.id)) || (who.email && byEmail.get(lc(who.email))) || undefined;
    const email = lc(person?.email || who.email);
    if (!person && (!email || email.endsWith("@kaizen.local"))) return;
    const key = person ? `p:${person.id}` : `e:${email}`;
    const d = digests.get(key) || { key, personnelId: person?.id, email: email || undefined, name: person?.name || email, items: [] };
    if (!d.items.some(i => i.kind === item.kind && i.suggestionId === item.suggestionId)) d.items.push(item);
    digests.set(key, d);
  };

  for (const s of suggestions) {
    const base = { suggestionId: s.id, subject: s.subject || "(konu yok)" };
    if (s.approvalStatus === "Pending") {
      const days = daysSince(s.createdAt, now);
      if (days >= settings.waitingWarningDays) push({ id: s.teamLeaderId, email: s.teamLeaderEmail }, { ...base, kind: "manager-pending", days });
      // Eskalasyon: past the "gecikmiş" threshold, the approving manager's own manager sees it too.
      if (days >= settings.waitingOverdueDays) {
        const mgr = (s.teamLeaderId && byId.get(s.teamLeaderId)) || byEmail.get(lc(s.teamLeaderEmail));
        const up = mgr ? effectiveManagerId(mgr, roster) : undefined;
        if (mgr && up && up !== mgr.id) push({ id: up }, { ...base, kind: "manager-escalation", days });
      }
    } else if (s.approvalStatus === "First Approval") {
      const f = s.feasibility?.status === "open" ? s.feasibility : null;
      if (f) {
        if (f.dueDate && f.dueDate < today) {
          const days = daysSince(`${f.dueDate}T00:00:00Z`, now);
          push({ id: f.ownerId, email: f.ownerEmail }, { ...base, kind: "feasibility-overdue", days });
          boardAdmins.forEach(p => push({ id: p.id }, { ...base, kind: "feasibility-overdue", days }));
        }
      } else {
        const days = daysSince(s.updatedAt || s.createdAt, now);
        if (days >= settings.waitingWarningDays) board.forEach(p => push({ id: p.id }, { ...base, kind: "board-pending", days }));
      }
    } else if (s.approvalStatus === "Second Approval" && !s.completed) {
      const impl = implBy.get(s.id);
      if (!impl) {
        const days = daysSince(s.updatedAt || s.createdAt, now);
        if (days >= settings.noPlanReminderDays) {
          push({ id: s.teamLeaderId, email: s.teamLeaderEmail }, { ...base, kind: "accepted-noplan", days });
          boardAdmins.forEach(p => push({ id: p.id }, { ...base, kind: "accepted-noplan", days }));
        }
      } else if ((impl.status === "Planlandı" || impl.status === "Sürüyor") && impl.targetDate && impl.targetDate < today) {
        const days = daysSince(`${impl.targetDate}T00:00:00Z`, now);
        push({ email: impl.ownerEmail }, { ...base, kind: "impl-overdue", days });
        push({ id: s.teamLeaderId, email: s.teamLeaderEmail }, { ...base, kind: "impl-overdue", days });
      }
    }
    const impl = implBy.get(s.id);
    if (impl?.status === "Tamamlandı") {
      const due = (impl.followUps || []).filter((f: any) => !f.result && f.dueDate && f.dueDate <= today);
      for (const f of due) push({ email: impl.ownerEmail }, { ...base, kind: "followup-due", days: daysSince(`${f.dueDate}T00:00:00Z`, now) });
    }
  }
  return Array.from(digests.values()).filter(d => d.items.length > 0);
}

// Plain-text digest body, grouped by reminder kind, oldest first.
export function reminderText(d: ReminderDigest, companyName: string, link: string): string {
  const groups = (Object.keys(REMINDER_LABELS) as ReminderKind[])
    .map(k => ({ k, items: d.items.filter(i => i.kind === k).sort((a, b) => b.days - a.days) }))
    .filter(g => g.items.length);
  const lines = [`Merhaba ${d.name},`, "", `${companyName ? companyName + " — " : ""}Kaizen Öneri Sistemi'nde ilginizi bekleyen ${d.items.length} konu var:`, ""];
  for (const g of groups) {
    lines.push(`${REMINDER_LABELS[g.k]} (${g.items.length}):`);
    g.items.forEach(i => lines.push(`  • ${i.subject} — ${i.days} gün`));
    lines.push("");
  }
  if (link) lines.push(`Gemba Tools: ${link}`);
  return lines.join("\n");
}
