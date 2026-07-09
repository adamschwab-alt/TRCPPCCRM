import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, OpportunityRow } from '@/types/database';
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
  const [{ data: opps }, { data: accounts }, { data: metrics }, { data: profiles }, { data: touches }] =
    await Promise.all([
      supabase.from('opportunities').select('*'),
      supabase.from('accounts').select('*'),
      supabase.from('account_metrics').select('account_id,ttm_revenue'),
      supabase.from('profiles').select('id,full_name,email,is_active'),
      supabase
        .from('activities')
        .select('account_id,occurred_at')
        .not('account_id', 'is', null)
        .order('occurred_at', { ascending: false })
        .limit(5000),
    ]);

  const now = Date.now();
  const name = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
  const ttm = new Map((metrics ?? []).map((m) => [m.account_id, m.ttm_revenue]));
  const rating = new Map(
    ((accounts ?? []) as { id: string; relationship_rating?: number | null }[]).map((a) => [
      a.id,
      a.relationship_rating ?? 2,
    ]),
  );
  const lastTouch = new Map<string, number>();
  for (const t of touches ?? []) {
    if (t.account_id && !lastTouch.has(t.account_id))
      lastTouch.set(t.account_id, new Date(t.occurred_at).getTime());
  }

  // Account freshness: inside wiring window?
  type Fresh = { ok: boolean; ownerId: string | null };
  const freshRows: Fresh[] = [];
  for (const a of (accounts ?? []) as { id: string; owner_id: string | null }[]) {
    const w = wiringFor(ttm.get(a.id) ?? 0, rating.get(a.id));
    if (w.intervalDays == null) continue; // no cadence → excluded
    const lt = lastTouch.get(a.id);
    const ok = lt != null && (now - lt) / DAY <= w.intervalDays;
    freshRows.push({ ok, ownerId: a.owner_id });
  }

  // Opportunity completeness + discipline.
  const active = ((opps ?? []) as OpportunityRow[]).filter(
    (o) => o.stage !== 'Won' && o.stage !== 'Lost',
  );
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
