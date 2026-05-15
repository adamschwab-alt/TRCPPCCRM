import { Opportunity, Stage } from "./types";

export function daysSince(iso: string | Date | null | undefined): number | null {
  if (!iso) return null;
  const t = typeof iso === "string" ? new Date(iso) : iso;
  return (Date.now() - t.getTime()) / 86_400_000;
}

export function rottingDays(stage: Stage, settings: Record<string, string>): number {
  const v = settings[`rot_${stage}`];
  return v ? parseFloat(v) : 0;
}

export function isRotting(o: Opportunity, settings: Record<string, string>): boolean {
  const threshold = rottingDays(o.stage, settings);
  if (!threshold) return false;
  const idle = daysSince(o.lastActivityAt);
  return idle !== null && idle >= threshold;
}

export function hasNoNextAction(o: Opportunity): boolean {
  const open = !["WON", "LOST", "NO_BID", "WITHDRAWN"].includes(o.stage);
  return open && !o.nextActionDate;
}

export function nextActionStatus(o: Opportunity): "ok" | "due" | "overdue" | "none" {
  if (!o.nextActionDate) return "none";
  const due = new Date(o.nextActionDate);
  const now = new Date();
  const sameDay = due.toDateString() === now.toDateString();
  if (due < now && !sameDay) return "overdue";
  if (sameDay || due.getTime() - now.getTime() < 86_400_000) return "due";
  return "ok";
}
