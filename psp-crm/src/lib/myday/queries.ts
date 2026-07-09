import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AccountMetricsRow, BranchMetricsRow, ContactRow } from '@/types/database';
import { wiringFor, type Wiring } from '@/lib/wiring';
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
  wiring: Wiring | null;
};

export type ContactOption = Pick<ContactRow, 'id' | 'name' | 'title' | 'tier'>;

export type MyDayData = {
  rows: MyDayRow[];
  summary: MyDaySummary;
  cadence: number; // legacy fallback (targets.cadence_days) — used when wiring can't be computed
  /** account_id → contacts, for the touch form's "who did you talk to" picker */
  contactsByAccount: Record<string, ContactOption[]>;
};

type AccountLite = {
  id: string;
  name: string;
  owner_id: string | null;
  relationship_rating?: number | null;
};

/**
 * Build a rep's prioritized worklist.
 *
 * Cadence comes from the customer-wiring matrix: account size (TTM revenue)
 * × relationship rating → touches/year → target interval. RLS already scopes
 * everything to the caller's book; for staff, `repId` filters to a chosen
 * rep's book by EFFECTIVE owner (branch owner, else parent-account owner).
 */
export async function getMyDayData(repId?: string): Promise<MyDayData> {
  const supabase = await createClient();

  const [{ data: branchRows }, { data: accounts }, { data: accountMetrics }, { data: targets }] =
    await Promise.all([
      supabase.from('branch_metrics').select('*'),
      supabase.from('accounts').select('*'),
      supabase.from('account_metrics').select('account_id,ttm_revenue'),
      supabase.from('targets').select('cadence_days').eq('id', true).maybeSingle(),
    ]);

  const fallbackCadence = targets?.cadence_days ?? 75;
  const accts = (accounts ?? []) as AccountLite[];
  const accountName = new Map(accts.map((a) => [a.id, a.name]));
  const accountOwner = new Map(accts.map((a) => [a.id, a.owner_id]));
  const accountRating = new Map(accts.map((a) => [a.id, a.relationship_rating ?? 2]));
  const accountTtm = new Map(
    ((accountMetrics ?? []) as Pick<AccountMetricsRow, 'account_id' | 'ttm_revenue'>[]).map(
      (m) => [m.account_id, m.ttm_revenue],
    ),
  );

  const wiringByAccount = new Map<string, Wiring>();
  const wiringOf = (accountId: string): Wiring => {
    let w = wiringByAccount.get(accountId);
    if (!w) {
      w = wiringFor(accountTtm.get(accountId) ?? 0, accountRating.get(accountId));
      wiringByAccount.set(accountId, w);
    }
    return w;
  };

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
  const scored = buildWorklist(
    scoped,
    (b) => wiringOf(b.account_id).intervalDays ?? null,
    touches,
    now,
  );

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
    wiring: wiringOf(s.branch.account_id),
  }));

  // Contacts for the accounts on the list (tolerates the table not existing yet).
  const contactsByAccount: Record<string, ContactOption[]> = {};
  const accountIds = [...new Set(rows.map((r) => r.branch.account_id))];
  if (accountIds.length > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id,name,title,tier,account_id')
      .in('account_id', accountIds.slice(0, 500))
      .order('tier');
    for (const c of contacts ?? []) {
      (contactsByAccount[c.account_id] ??= []).push({
        id: c.id,
        name: c.name,
        title: c.title,
        tier: c.tier,
      });
    }
  }

  return { rows, summary: summarize(scored), cadence: fallbackCadence, contactsByAccount };
}

// ── Rep scorecard (manager view) ─────────────────────────────────────────────

export type ScorecardRow = {
  repId: string;
  repName: string;
  accounts: number;
  ttmRevenue: number;
  growthPct: number | null;
  plannedPerYear: number; // Σ wiring calls/yr across owned accounts
  touches30d: number;
  weeklyPlan: number; // plannedPerYear / 52
  weeklyActual: number; // touches30d / (30/7)
  coveragePct: number | null; // owned accounts touched in last 90d
  overdue: number; // branches past wiring cadence
};

/** Manager scorecard: plan-vs-actual touch activity per rep over their book. */
export async function getScorecard(): Promise<ScorecardRow[]> {
  const supabase = await createClient();
  const [{ data: accounts }, { data: accountMetrics }, { data: branchRows }, { data: profiles }] =
    await Promise.all([
      supabase.from('accounts').select('*'),
      supabase.from('account_metrics').select('account_id,ttm_revenue,prior_revenue'),
      supabase.from('branch_metrics').select('*'),
      supabase.from('profiles').select('id,full_name,email,role,is_active'),
    ]);

  const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: recentTouches } = await supabase
    .from('activities')
    .select('user_id,account_id,occurred_at')
    .gte('occurred_at', since90)
    .limit(5000);

  const accts = (accounts ?? []) as AccountLite[];
  const metric = new Map(
    (
      (accountMetrics ?? []) as Pick<
        AccountMetricsRow,
        'account_id' | 'ttm_revenue' | 'prior_revenue'
      >[]
    ).map((m) => [m.account_id, m]),
  );
  const accountOwner = new Map(accts.map((a) => [a.id, a.owner_id]));
  const branches = (branchRows ?? []) as BranchMetricsRow[];

  const rows: ScorecardRow[] = [];
  for (const p of (profiles ?? []).filter((x) => x.is_active)) {
    const owned = accts.filter((a) => a.owner_id === p.id);
    if (owned.length === 0) continue;

    let ttm = 0;
    let prior = 0;
    let planned = 0;
    const ownedIds = new Set(owned.map((a) => a.id));
    for (const a of owned) {
      const m = metric.get(a.id);
      ttm += m?.ttm_revenue ?? 0;
      prior += m?.prior_revenue ?? 0;
      planned += wiringFor(m?.ttm_revenue ?? 0, a.relationship_rating).callsPerYear;
    }

    const touched90 = new Set<string>();
    let touches30 = 0;
    for (const t of recentTouches ?? []) {
      if (t.user_id !== p.id) continue;
      if (t.account_id && ownedIds.has(t.account_id)) touched90.add(t.account_id);
      if (t.occurred_at >= since30) touches30++;
    }

    const overdue = branches.filter((b) => {
      const owner = b.owner_id ?? accountOwner.get(b.account_id) ?? null;
      if (owner !== p.id) return false;
      const m = metric.get(b.account_id);
      const a = owned.find((x) => x.id === b.account_id);
      const iv = wiringFor(m?.ttm_revenue ?? 0, a?.relationship_rating).intervalDays;
      return iv != null && b.days_idle != null && b.days_idle > iv;
    }).length;

    rows.push({
      repId: p.id,
      repName: p.full_name || p.email,
      accounts: owned.length,
      ttmRevenue: ttm,
      growthPct: prior > 0 ? ttm / prior - 1 : null,
      plannedPerYear: planned,
      touches30d: touches30,
      weeklyPlan: planned / 52,
      weeklyActual: touches30 / (30 / 7),
      coveragePct: owned.length > 0 ? touched90.size / owned.length : null,
      overdue,
    });
  }
  return rows.sort((a, b) => b.ttmRevenue - a.ttmRevenue);
}
