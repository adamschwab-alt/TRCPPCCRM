import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { summarizeUsage, type UserUsage } from './summarize';

export type ActivityReportRow = UserUsage & {
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  changes30d: number;
};

export type ChangeEntry = {
  id: number;
  at: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
};

/** One-line human summary of an audit diff ("stage: Quoted, amount: 45000"). */
function describeDiff(diff: unknown): string | null {
  if (!diff || typeof diff !== 'object') return null;
  const parts = Object.entries(diff as Record<string, unknown>)
    .filter(([, v]) => v != null && typeof v !== 'object')
    .slice(0, 4)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Admin-only usage + change report. RLS enforces the restriction — reps and
 * managers get zero rows back from usage_events/audit_log, and the page itself
 * is behind requireRole('admin').
 */
export async function getActivityReport(): Promise<{
  users: ActivityReportRow[];
  changes: ChangeEntry[];
  trackingLive: boolean;
  /** Read failures, verbatim — shown on the page instead of a silently empty table. */
  warnings: string[];
}> {
  const supabase = await createClient();
  const sinceIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const warnings: string[] = [];
  const errMsg = (e: unknown) =>
    (e as { message?: string } | null)?.message ?? String(e);

  const [profilesRes, eventsRes, auditRes] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,role,is_active'),
    // A missing usage_events table (migration 0013 not applied) surfaces as a
    // warning, not a silently empty column.
    fetchAll<{ user_id: string; occurred_at: string }>((from, to) =>
      supabase
        .from('usage_events')
        .select('user_id,occurred_at')
        .gte('occurred_at', sinceIso)
        .order('occurred_at')
        .order('id')
        .range(from, to),
    ).catch((e) => {
      warnings.push(`Time-on-site unavailable — usage_events read failed: ${errMsg(e)}`);
      return [] as { user_id: string; occurred_at: string }[];
    }),
    fetchAll<{
      id: number;
      actor_id: string | null;
      action: string;
      entity: string | null;
      entity_id: string | null;
      diff: unknown;
      created_at: string;
    }>((from, to) =>
      supabase
        .from('audit_log')
        .select('*')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
    ).catch((e) => {
      warnings.push(`Change history unavailable — audit_log read failed: ${errMsg(e)}`);
      return [];
    }),
  ]);
  if (profilesRes.error) warnings.push(`Profiles read failed: ${profilesRes.error.message}`);

  const profiles = profilesRes.data ?? [];
  const usage = summarizeUsage(eventsRes, Date.now());

  const changesByUser = new Map<string, number>();
  for (const a of auditRes) {
    if (a.actor_id) changesByUser.set(a.actor_id, (changesByUser.get(a.actor_id) ?? 0) + 1);
  }

  const name = new Map(profiles.map((p) => [p.id, p.full_name || p.email]));
  const users: ActivityReportRow[] = profiles
    .map((p) => {
      const u = usage.get(p.id);
      return {
        userId: p.id,
        name: p.full_name || p.email,
        email: p.email,
        role: p.role,
        isActive: p.is_active,
        lastSeenAt: u?.lastSeenAt ?? null,
        minutes7d: u?.minutes7d ?? 0,
        minutes30d: u?.minutes30d ?? 0,
        activeDays30d: u?.activeDays30d ?? 0,
        sessions30d: u?.sessions30d ?? 0,
        changes30d: changesByUser.get(p.id) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? '') || b.changes30d - a.changes30d,
    );

  const changes: ChangeEntry[] = auditRes.slice(0, 200).map((a) => ({
    id: a.id,
    at: a.created_at,
    actorId: a.actor_id,
    actorName: a.actor_id ? (name.get(a.actor_id) ?? null) : null,
    action: a.action,
    entity: a.entity,
    entityId: a.entity_id,
    detail: describeDiff(a.diff),
  }));

  return { users, changes, trackingLive: eventsRes.length > 0, warnings };
}
