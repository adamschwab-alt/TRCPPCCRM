import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { wiringFor, type Wiring } from '@/lib/wiring';

/**
 * Activity & Call Tracking (manager view) — call frequency vs plan, per-account
 * call due-ness, rep scorecard, weekly touch series. All from data already
 * captured (touches + wiring); "time to call" is TOUCH recency vs the account's
 * wiring cadence (never-touched = due now). RLS scopes reps to their own book.
 */

export type CallStatus = 'never' | 'due' | 'ok';

export type CallCoverageRow = {
  account_id: string;
  account_name: string;
  owner_id: string | null;
  owner_name: string | null;
  ttm_revenue: number;
  prior_revenue: number;
  wiring: Wiring;
  last_touch_at: string | null;
  last_touch_type: string | null;
  days_since_touch: number | null;
  /** days until next touch is due (negative = overdue); null = no cadence */
  due_in: number | null;
  status: CallStatus;
  touches_90d: number;
};

export type RepScorecardRow = {
  repId: string;
  repName: string;
  accounts: number;
  ttmRevenue: number;
  growthPct: number | null;
  retentionPct: number | null; // TTM of accounts that bought last year ÷ their prior revenue
  weeklyPlan: number; // Σ wiring calls/yr ÷ 52
  weeklyActual: number; // touches last 7d
  weekly4Avg: number; // touches last 28d ÷ 4
  coveragePct: number | null; // cadenced accounts currently inside their window
  overdue: number; // accounts due/never (call-based)
};

export type WeeklySeries = {
  weeks: string[]; // ISO week-start dates, oldest → newest (12)
  reps: { repId: string; repName: string; counts: number[] }[];
};

export type ActivityData = {
  rows: CallCoverageRow[];
  scorecard: RepScorecardRow[];
  series: WeeklySeries;
  kpis: {
    dueNow: number;
    touchesThisWeek: number;
    planPerWeek: number;
    coveragePct: number | null;
    bookTtm: number;
    accounts: number;
    growthPct: number | null;
  };
};

const DAY = 86_400_000;

type TouchLite = {
  account_id: string | null;
  user_id: string | null;
  type: string;
  occurred_at: string;
};

export async function getActivityData(): Promise<ActivityData> {
  const supabase = await createClient();
  // fetchAll: accounts/metrics/branches exceed the 1000-row PostgREST cap at
  // real book size; activities are paged over a bounded 400-day window (longest
  // wiring interval plus slack) instead of a flat limit that starves old touches.
  const sinceIso = new Date(Date.now() - 400 * DAY).toISOString();
  const [accounts, metrics, { data: profiles }, touches, branchMetrics] = await Promise.all([
    fetchAll<{ id: string; name: string; owner_id: string | null; relationship_rating?: number | null }>(
      (from, to) => supabase.from('accounts').select('*').order('id').range(from, to),
    ),
    fetchAll<{ account_id: string; account_name: string; ttm_revenue: number; prior_revenue: number }>(
      (from, to) =>
        supabase
          .from('account_metrics')
          .select('account_id,account_name,ttm_revenue,prior_revenue')
          .order('account_id')
          .range(from, to),
    ),
    supabase.from('profiles').select('id,full_name,email,is_active'),
    fetchAll<TouchLite>((from, to) =>
      supabase
        .from('activities')
        .select('account_id,user_id,type,occurred_at')
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

  const now = Date.now();
  const name = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
  const metric = new Map(metrics.map((m) => [m.account_id, m]));
  const rating = new Map(accounts.map((a) => [a.id, a.relationship_rating ?? 2]));

  // Attribution: the rep who owns most of the account's branch TTM (effective
  // owner = branch owner, else parent-account owner). Multi-rep accounts like
  // United Rentals have accounts.owner_id null — attributing by account owner
  // alone would drop their whole book from every scorecard.
  const accountOwner = new Map(accounts.map((a) => [a.id, a.owner_id]));
  const ttmByAccountRep = new Map<string, Map<string, number>>();
  for (const b of branchMetrics) {
    const eff = b.owner_id ?? accountOwner.get(b.account_id) ?? null;
    if (!eff) continue;
    let perRep = ttmByAccountRep.get(b.account_id);
    if (!perRep) ttmByAccountRep.set(b.account_id, (perRep = new Map()));
    perRep.set(eff, (perRep.get(eff) ?? 0) + (b.ttm_revenue ?? 0));
  }
  const dominantOwner = (accountId: string): string | null => {
    const perRep = ttmByAccountRep.get(accountId);
    if (!perRep || perRep.size === 0) return accountOwner.get(accountId) ?? null;
    let best: string | null = null;
    let bestTtm = -1;
    for (const [rep, ttm] of perRep) {
      if (ttm > bestTtm) {
        best = rep;
        bestTtm = ttm;
      }
    }
    return best;
  };

  // Per-account touch aggregates (touches are newest-first).
  const lastTouch = new Map<string, { at: string; type: string }>();
  const touches90 = new Map<string, number>();
  for (const t of touches) {
    if (!t.account_id) continue;
    if (!lastTouch.has(t.account_id)) lastTouch.set(t.account_id, { at: t.occurred_at, type: t.type });
    if (now - new Date(t.occurred_at).getTime() <= 90 * DAY)
      touches90.set(t.account_id, (touches90.get(t.account_id) ?? 0) + 1);
  }

  const rows: CallCoverageRow[] = [];
  for (const a of accounts) {
    const m = metric.get(a.id);
    const w = wiringFor(m?.ttm_revenue ?? 0, rating.get(a.id));
    const lt = lastTouch.get(a.id) ?? null;
    const daysSince = lt ? Math.floor((now - new Date(lt.at).getTime()) / DAY) : null;
    let dueIn: number | null = null;
    let status: CallStatus = 'ok';
    if (w.intervalDays != null) {
      if (daysSince == null) {
        status = 'never';
        dueIn = 0;
      } else {
        dueIn = w.intervalDays - daysSince;
        status = dueIn < 0 ? 'due' : 'ok';
      }
    }
    const ownerId = dominantOwner(a.id);
    rows.push({
      account_id: a.id,
      account_name: a.name,
      owner_id: ownerId,
      owner_name: ownerId ? (name.get(ownerId) ?? null) : null,
      ttm_revenue: m?.ttm_revenue ?? 0,
      prior_revenue: m?.prior_revenue ?? 0,
      wiring: w,
      last_touch_at: lt?.at ?? null,
      last_touch_type: lt?.type ?? null,
      days_since_touch: daysSince,
      due_in: dueIn,
      status,
      touches_90d: touches90.get(a.id) ?? 0,
    });
  }
  // Urgency sort: never → most-overdue → soonest-due; no-cadence last.
  rows.sort((x, y) => {
    const rank = (r: CallCoverageRow) =>
      r.status === 'never' ? -10_000 : r.due_in == null ? 10_000 : r.due_in;
    return rank(x) - rank(y) || y.ttm_revenue - x.ttm_revenue;
  });

  // ── Weekly series (12 ISO weeks, Monday starts) ────────────────────────────
  const weekStart = (d: Date) => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dow = (x.getUTCDay() + 6) % 7;
    x.setUTCDate(x.getUTCDate() - dow);
    return x.toISOString().slice(0, 10);
  };
  const weeks: string[] = [];
  {
    const cur = new Date(weekStart(new Date()));
    for (let i = 11; i >= 0; i--) {
      const w = new Date(cur.getTime() - i * 7 * DAY);
      weeks.push(w.toISOString().slice(0, 10));
    }
  }
  const weekIdx = new Map(weeks.map((w, i) => [w, i]));
  const perRepCounts = new Map<string, number[]>();
  for (const t of touches) {
    if (!t.user_id) continue;
    const wk = weekStart(new Date(t.occurred_at));
    const idx = weekIdx.get(wk);
    if (idx == null) continue;
    if (!perRepCounts.has(t.user_id)) perRepCounts.set(t.user_id, Array(12).fill(0));
    perRepCounts.get(t.user_id)![idx]++;
  }
  const series: WeeklySeries = {
    weeks,
    reps: [...perRepCounts.entries()].map(([repId, counts]) => ({
      repId,
      repName: name.get(repId) ?? 'Unknown',
      counts,
    })),
  };

  // ── Rep scorecard ──────────────────────────────────────────────────────────
  const scorecard: RepScorecardRow[] = [];
  for (const p of (profiles ?? []).filter((x) => x.is_active)) {
    const owned = rows.filter((r) => r.owner_id === p.id);
    if (owned.length === 0) continue;
    const ttm = owned.reduce((s, r) => s + r.ttm_revenue, 0);
    const prior = owned.reduce((s, r) => s + r.prior_revenue, 0);
    const retBase = owned.filter((r) => r.prior_revenue > 0);
    const retPrior = retBase.reduce((s, r) => s + r.prior_revenue, 0);
    const retTtm = retBase.reduce((s, r) => s + r.ttm_revenue, 0);
    const planned = owned.reduce((s, r) => s + r.wiring.callsPerYear, 0);
    const cadenced = owned.filter((r) => r.wiring.intervalDays != null);
    const inWindow = cadenced.filter((r) => r.status === 'ok');

    let wk = 0;
    let wk4 = 0;
    for (const t of touches) {
      if (t.user_id !== p.id) continue;
      const age = now - new Date(t.occurred_at).getTime();
      if (age <= 7 * DAY) wk++;
      if (age <= 28 * DAY) wk4++;
    }

    scorecard.push({
      repId: p.id,
      repName: name.get(p.id) ?? p.email ?? 'Unknown',
      accounts: owned.length,
      ttmRevenue: ttm,
      growthPct: prior > 0 ? ttm / prior - 1 : null,
      retentionPct: retPrior > 0 ? retTtm / retPrior : null,
      weeklyPlan: planned / 52,
      weeklyActual: wk,
      weekly4Avg: wk4 / 4,
      coveragePct: cadenced.length > 0 ? inWindow.length / cadenced.length : null,
      overdue: cadenced.length - inWindow.length,
    });
  }
  scorecard.sort((a, b) => b.ttmRevenue - a.ttmRevenue);

  // ── Portfolio KPI tiles ────────────────────────────────────────────────────
  const cadenced = rows.filter((r) => r.wiring.intervalDays != null);
  const dueNow = cadenced.filter((r) => r.status !== 'ok').length;
  const bookTtm = rows.reduce((s, r) => s + r.ttm_revenue, 0);
  const bookPrior = rows.reduce((s, r) => s + r.prior_revenue, 0);
  const touchesThisWeek = touches.filter(
    (t) => now - new Date(t.occurred_at).getTime() <= 7 * DAY,
  ).length;

  return {
    rows,
    scorecard,
    series,
    kpis: {
      dueNow,
      touchesThisWeek,
      planPerWeek: rows.reduce((s, r) => s + r.wiring.callsPerYear, 0) / 52,
      coveragePct: cadenced.length > 0 ? (cadenced.length - dueNow) / cadenced.length : null,
      bookTtm,
      accounts: rows.length,
      growthPct: bookPrior > 0 ? bookTtm / bookPrior - 1 : null,
    },
  };
}
