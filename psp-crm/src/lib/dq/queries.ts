import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, OpportunityRow } from '@/types/database';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { wiringFor } from '@/lib/wiring';

type Db = SupabaseClient<Database>;

/** The 7 fields that make an active opportunity analyzable (KPI dictionary). */
export const COMPLETENESS_FIELDS = [
  'amount',
  'expected_close',
  'next_step',
  'next_date',
  'source',
  'primary_contact_id',
  'product_line',
] as const;

export function oppCompleteness(o: Partial<OpportunityRow>): number {
  let present = 0;
  for (const f of COMPLETENESS_FIELDS) if (o[f] != null && o[f] !== '') present++;
  return present / COMPLETENESS_FIELDS.length;
}

export type DqReport = {
  completeness: number | null; // avg across active opps
  freshness: number | null; // cadenced accounts inside their wiring window
  activeOpps: number;
  stalled: number; // active opps: no future next step (missing or >7d past)
  gateViolations: number; // active opps missing stage-gate fields
  perRep: {
    repId: string;
    repName: string;
    completeness: number | null;
    freshness: number | null;
    activeOpps: number;
    stalled: number;
  }[];
};

const DAY = 86_400_000;

/** Live data-quality scores (RLS-scoped to the caller). */
export async function computeDq(supabase: Db): Promise<DqReport> {
  // fetchAll: unbounded selects cap at 1000 rows; activities use a bounded
  // 400-day window (longest wiring interval + slack) instead of a flat limit.
  const nowMs = Date.now();
  const sinceIso = new Date(nowMs - 400 * DAY).toISOString();
  const [opps, accounts, metrics, { data: profiles }, touches, branchMetrics] = await Promise.all([
    fetchAll<OpportunityRow>((from, to) =>
      supabase.from('opportunities').select('*').order('id').range(from, to),
    ),
    fetchAll<{ id: string; owner_id: string | null; relationship_rating?: number | null }>(
      (from, to) => supabase.from('accounts').select('*').order('id').range(from, to),
    ),
    fetchAll<{ account_id: string; ttm_revenue: number }>((from, to) =>
      supabase
        .from('account_metrics')
        .select('account_id,ttm_revenue')
        .order('account_id')
        .range(from, to),
    ),
    supabase.from('profiles').select('id,full_name,email,is_active'),
    fetchAll<{ account_id: string | null; occurred_at: string }>((from, to) =>
      supabase
        .from('activities')
        .select('account_id,occurred_at')
        .not('account_id', 'is', null)
        .gte('occurred_at', sinceIso)
        .order('occurred_at', { ascending: false })
        .order('id')
        .range(from, to),
    ),
    fetchAll<{ account_id: string; owner_id: string | null; ttm_revenue: number }>((from, to) =>
      supabase
        .from('branch_metrics')
        .select('account_id,owner_id,ttm_revenue')
        .order('branch_id')
        .range(from, to),
    ),
  ]);

  const now = nowMs;
  const name = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
  const ttm = new Map(metrics.map((m) => [m.account_id, m.ttm_revenue]));
  const rating = new Map(accounts.map((a) => [a.id, a.relationship_rating ?? 2]));
  const lastTouch = new Map<string, number>();
  for (const t of touches) {
    if (t.account_id && !lastTouch.has(t.account_id))
      lastTouch.set(t.account_id, new Date(t.occurred_at).getTime());
  }

  // Dominant-owner attribution: the rep owning most of the account's branch TTM
  // (effective owner = branch owner else account owner). Multi-rep accounts have
  // accounts.owner_id null, so per-rep freshness would otherwise skip them.
  const accountOwner = new Map(accounts.map((a) => [a.id, a.owner_id]));
  const ttmByAccountRep = new Map<string, Map<string, number>>();
  for (const b of branchMetrics) {
    const eff = b.owner_id ?? accountOwner.get(b.account_id) ?? null;
    if (!eff) continue;
    let perRepTtm = ttmByAccountRep.get(b.account_id);
    if (!perRepTtm) ttmByAccountRep.set(b.account_id, (perRepTtm = new Map()));
    perRepTtm.set(eff, (perRepTtm.get(eff) ?? 0) + (b.ttm_revenue ?? 0));
  }
  const dominantOwner = (accountId: string): string | null => {
    const perRepTtm = ttmByAccountRep.get(accountId);
    if (!perRepTtm || perRepTtm.size === 0) return accountOwner.get(accountId) ?? null;
    let best: string | null = null;
    let bestTtm = -1;
    for (const [rep, t] of perRepTtm) {
      if (t > bestTtm) {
        best = rep;
        bestTtm = t;
      }
    }
    return best;
  };

  // Account freshness: inside wiring window?
  type Fresh = { ok: boolean; ownerId: string | null };
  const freshRows: Fresh[] = [];
  for (const a of accounts) {
    const w = wiringFor(ttm.get(a.id) ?? 0, rating.get(a.id));
    if (w.intervalDays == null) continue; // no cadence → excluded
    const lt = lastTouch.get(a.id);
    const ok = lt != null && (now - lt) / DAY <= w.intervalDays;
    freshRows.push({ ok, ownerId: dominantOwner(a.id) });
  }

  // Opportunity completeness + discipline.
  const active = opps.filter((o) => o.stage !== 'Won' && o.stage !== 'Lost');
  const sevenDaysAgo = new Date(now - 7 * DAY).toISOString().slice(0, 10);
  const isStalled = (o: OpportunityRow) => !o.next_date || o.next_date < sevenDaysAgo;
  const violatesGate = (o: OpportunityRow) => {
    if (!o.source) return true;
    if (['Quoted', 'Verbal'].includes(o.stage) && (o.amount == null || !o.expected_close)) return true;
    if (o.stage === 'Verbal' && (!o.next_step || !o.next_date || !o.primary_contact_id)) return true;
    return false;
  };

  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

  const perRep: DqReport['perRep'] = [];
  for (const p of (profiles ?? []).filter((x) => x.is_active)) {
    const repOpps = active.filter((o) => o.owner_id === p.id);
    const repFresh = freshRows.filter((f) => f.ownerId === p.id);
    if (repOpps.length === 0 && repFresh.length === 0) continue;
    perRep.push({
      repId: p.id,
      repName: name.get(p.id) ?? 'Unknown',
      completeness: avg(repOpps.map(oppCompleteness)),
      freshness: repFresh.length ? repFresh.filter((f) => f.ok).length / repFresh.length : null,
      activeOpps: repOpps.length,
      stalled: repOpps.filter(isStalled).length,
    });
  }
  return {
    completeness: avg(active.map(oppCompleteness)),
    freshness: freshRows.length
      ? freshRows.filter((f) => f.ok).length / freshRows.length
      : null,
    activeOpps: active.length,
    stalled: active.filter(isStalled).length,
    gateViolations: active.filter(violatesGate).length,
    perRep: perRep.sort((a, b) => b.activeOpps - a.activeOpps),
  };
}

/** Nightly (service-role) upsert of the current month's DQ snapshot. */
export async function snapshotDq(admin: Db): Promise<void> {
  const dq = await computeDq(admin);
  const period = new Date().toISOString().slice(0, 7);
  await admin.from('dq_snapshots').upsert(
    {
      period,
      completeness: dq.completeness,
      freshness: dq.freshness,
      stalled: dq.stalled,
      gate_violations: dq.gateViolations,
      detail: { perRep: dq.perRep },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'period' },
  );
}
