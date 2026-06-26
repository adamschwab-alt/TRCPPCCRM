import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { BranchMetricsRow } from '@/types/database';
import {
  buildWorklist,
  summarize,
  type ScoredBranch,
  type TouchSummary,
  type MyDaySummary,
} from './score';

export type RepOption = { id: string; name: string; role: string };

/** Active people who can carry a book — for the staff "view as rep" picker. */
export async function getReps(): Promise<RepOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id,full_name,email,role,is_active')
    .order('full_name');
  return (data ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id, name: p.full_name || p.email, role: p.role }));
}

export type MyDayRow = ScoredBranch & {
  account_name: string | null;
  owner_name: string | null;
};

export type MyDayData = {
  rows: MyDayRow[];
  summary: MyDaySummary;
  cadence: number;
};

/**
 * Build a rep's prioritized worklist.
 *
 * RLS already scopes `branch_metrics` to the caller's book, so a rep only ever
 * sees their own branches. For staff (who see everything), `repId` filters to a
 * chosen rep's book by EFFECTIVE owner — the branch's own owner, or, when unset,
 * the parent account's owner.
 */
export async function getMyDayData(repId?: string): Promise<MyDayData> {
  const supabase = await createClient();

  const [{ data: branchRows }, { data: accounts }, { data: targets }] = await Promise.all([
    supabase.from('branch_metrics').select('*'),
    supabase.from('accounts').select('id,name,owner_id'),
    supabase.from('targets').select('cadence_days').eq('id', true).maybeSingle(),
  ]);

  const cadence = targets?.cadence_days ?? 75;
  const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const accountOwner = new Map((accounts ?? []).map((a) => [a.id, a.owner_id]));

  const branches = (branchRows ?? []) as BranchMetricsRow[];
  const effectiveOwner = (b: BranchMetricsRow) =>
    b.owner_id ?? accountOwner.get(b.account_id) ?? null;

  const scoped = repId ? branches.filter((b) => effectiveOwner(b) === repId) : branches;

  // Last touch per branch (RLS-scoped: a rep sees their own touches).
  const touches = new Map<string, TouchSummary>();
  if (scoped.length > 0) {
    const { data: activities } = await supabase
      .from('activities')
      .select('branch_id,type,occurred_at')
      .not('branch_id', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(2000);
    for (const a of activities ?? []) {
      if (!a.branch_id || touches.has(a.branch_id)) continue; // first = most recent
      touches.set(a.branch_id, { lastTouchAt: a.occurred_at, lastTouchType: a.type });
    }
  }

  const now = Date.now();
  const scored = buildWorklist(scoped, cadence, touches, now);

  // Owner display names.
  const { data: profiles } = await supabase.from('profiles').select('id,full_name,email');
  const ownerName = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  const rows: MyDayRow[] = scored.map((s) => ({
    ...s,
    account_name: accountName.get(s.branch.account_id) ?? null,
    owner_name: (() => {
      const oid = effectiveOwner(s.branch);
      return oid ? (ownerName.get(oid) ?? null) : null;
    })(),
  }));

  return { rows, summary: summarize(scored), cadence };
}
