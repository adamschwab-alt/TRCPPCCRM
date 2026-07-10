import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, OpportunityRow } from '@/types/database';
import { fetchAll } from '@/lib/supabase/fetch-all';

type Db = SupabaseClient<Database>;

/**
 * Freeze this month's forecast snapshot (org + per-rep) if not already frozen.
 * Runs nightly with the service role; the unique index makes it write-once per
 * period, so the stored numbers are what the pipeline said at month start.
 */
export async function snapshotForecast(admin: Db): Promise<void> {
  const period = new Date().toISOString().slice(0, 7);
  const { data: existing } = await admin
    .from('forecast_snapshots')
    .select('id')
    .eq('period', period)
    .limit(1);
  if (existing && existing.length > 0) return; // already frozen this month

  const opps = await fetchAll<Partial<OpportunityRow>>((from, to) =>
    admin
      .from('opportunities')
      .select('owner_id,stage,amount,weighted_amount,forecast_category')
      .order('id')
      .range(from, to),
  );
  const open = opps.filter((o) => o.stage !== 'Won' && o.stage !== 'Lost');

  type Bucket = {
    pipeline_amount: number;
    best_case_amount: number;
    commit_amount: number;
    weighted_amount: number;
    open_count: number;
  };
  const zero = (): Bucket => ({
    pipeline_amount: 0,
    best_case_amount: 0,
    commit_amount: 0,
    weighted_amount: 0,
    open_count: 0,
  });
  const org = zero();
  const byRep = new Map<string, Bucket>();

  for (const o of open) {
    const add = (b: Bucket) => {
      const amt = o.amount ?? 0;
      if (o.forecast_category === 'commit') b.commit_amount += amt;
      else if (o.forecast_category === 'best_case') b.best_case_amount += amt;
      else b.pipeline_amount += amt;
      b.weighted_amount += o.weighted_amount ?? 0;
      b.open_count++;
    };
    add(org);
    if (o.owner_id) {
      if (!byRep.has(o.owner_id)) byRep.set(o.owner_id, zero());
      add(byRep.get(o.owner_id)!);
    }
  }

  const rows = [
    { period, rep_id: null as string | null, ...org },
    ...[...byRep.entries()].map(([rep_id, b]) => ({ period, rep_id, ...b })),
  ];
  await admin.from('forecast_snapshots').insert(rows);
}

export type ForecastPeriodReport = {
  period: string;
  commit: number;
  bestCase: number;
  pipeline: number;
  weighted: number;
  wonActual: number | null; // null = period not finished yet
  accuracy: number | null; // 1 - |won - commit| / commit (signed bias separate)
  bias: 'over' | 'under' | null;
  inProgress: boolean;
};

/** Month-by-month forecast vs actuals (org grain). */
export async function getForecastReport(supabase: Db): Promise<ForecastPeriodReport[]> {
  const [{ data: snaps }, opps] = await Promise.all([
    supabase
      .from('forecast_snapshots')
      .select('*')
      .is('rep_id', null)
      .order('period', { ascending: false })
      .limit(18),
    fetchAll<{ stage: string; amount: number | null; closed_at?: string | null }>((from, to) =>
      supabase
        .from('opportunities')
        .select('stage,amount,closed_at')
        .eq('stage', 'Won')
        .order('id')
        .range(from, to),
    ),
  ]);

  const wonByPeriod = new Map<string, number>();
  for (const o of opps) {
    const closed = (o as { closed_at?: string | null }).closed_at;
    if (!closed) continue;
    const p = closed.slice(0, 7);
    wonByPeriod.set(p, (wonByPeriod.get(p) ?? 0) + ((o.amount as number | null) ?? 0));
  }

  const thisPeriod = new Date().toISOString().slice(0, 7);
  return (snaps ?? []).map((s) => {
    const inProgress = s.period >= thisPeriod;
    const won = wonByPeriod.get(s.period) ?? 0;
    const commit = Number(s.commit_amount);
    const accuracy =
      !inProgress && commit > 0 ? Math.max(0, 1 - Math.abs(won - commit) / commit) : null;
    return {
      period: s.period,
      commit,
      bestCase: Number(s.best_case_amount),
      pipeline: Number(s.pipeline_amount),
      weighted: Number(s.weighted_amount),
      wonActual: inProgress ? null : won,
      accuracy,
      bias: !inProgress && commit > 0 ? (won >= commit ? 'over' : 'under') : null,
      inProgress,
    };
  });
}

// ── AI adoption report ───────────────────────────────────────────────────────

export type AiTypeStats = {
  type: string;
  shown: number;
  accepted: number;
  dismissed: number;
  acceptanceRate: number | null;
  medianHoursToAction: number | null;
  thumbsUp: number;
  thumbsDown: number;
  orderRateAccepted: number | null; // NBA: accepted recs followed by order in 28d
  orderRateIgnored: number | null;
};

export async function getAiReport(supabase: Db): Promise<{
  byType: AiTypeStats[];
  totalShown: number;
  activeUsers: number;
}> {
  const { data: recs } = await supabase
    .from('ai_recommendations')
    .select('type,status,shown_at,acted_at,outcome,user_id')
    .order('shown_at', { ascending: false })
    .limit(5000);
  const all = recs ?? [];

  const types = ['next_best_action', 'account_summary', 'deal_risk'];
  const byType: AiTypeStats[] = types.map((type) => {
    const t = all.filter((r) => r.type === type);
    const accepted = t.filter((r) => r.status === 'accepted');
    const dismissed = t.filter((r) => r.status === 'dismissed');
    const responded = accepted.length + dismissed.length;

    const hours = accepted
      .filter((r) => r.acted_at)
      .map((r) => (new Date(r.acted_at!).getTime() - new Date(r.shown_at).getTime()) / 3_600_000)
      .sort((a, b) => a - b);
    const median = hours.length ? hours[Math.floor(hours.length / 2)] : null;

    const out = (r: { outcome: unknown }) => (r.outcome ?? {}) as Record<string, unknown>;
    const withOutcome = (rows: typeof t) => rows.filter((r) => out(r).order_within_28d !== undefined);
    const orderRate = (rows: typeof t) => {
      const w = withOutcome(rows);
      return w.length ? w.filter((r) => out(r).order_within_28d === true).length / w.length : null;
    };

    return {
      type,
      shown: t.length,
      accepted: accepted.length,
      dismissed: dismissed.length,
      acceptanceRate: responded > 0 ? accepted.length / responded : null,
      medianHoursToAction: median,
      thumbsUp: t.filter((r) => out(r).rating === 'up').length,
      thumbsDown: t.filter((r) => out(r).rating === 'down').length,
      orderRateAccepted: type === 'next_best_action' ? orderRate(accepted) : null,
      orderRateIgnored:
        type === 'next_best_action' ? orderRate(t.filter((r) => r.status === 'shown')) : null,
    };
  });

  return {
    byType,
    totalShown: all.length,
    activeUsers: new Set(all.map((r) => r.user_id)).size,
  };
}
