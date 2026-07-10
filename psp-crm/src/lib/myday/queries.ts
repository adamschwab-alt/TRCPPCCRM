import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { fetchAll, chunkIds } from '@/lib/supabase/fetch-all';
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

export type CallDue = { status: 'never' | 'due' | 'ok'; dueIn: number | null };

export type MyDayRow = ScoredBranch & {
  account_name: string | null;
  owner_name: string | null;
  wiring: Wiring | null;
  /** account-grain "time to call": TOUCH recency vs the wiring cadence */
  callDue: CallDue | null;
};

export type ContactOption = Pick<ContactRow, 'id' | 'name' | 'title' | 'tier'>;

export type MyDayData = {
  rows: MyDayRow[];
  summary: MyDaySummary;
  cadence: number; // legacy fallback (targets.cadence_days) — used when wiring can't be computed
  /** account_id → contacts, for the touch form's "who did you talk to" picker */
  contactsByAccount: Record<string, ContactOption[]>;
  /** distinct accounts on this list overdue (or never touched) per wiring cadence */
  callDueAccounts: number;
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

  // fetchAll everywhere a table can outgrow PostgREST's silent 1000-row cap —
  // a truncated branch list would simply drop accounts from the worklist.
  const [branchRows, accounts, accountMetrics, { data: targets }] = await Promise.all([
    fetchAll<BranchMetricsRow>((from, to) =>
      supabase.from('branch_metrics').select('*').order('branch_id').range(from, to),
    ),
    fetchAll<AccountLite>((from, to) =>
      supabase.from('accounts').select('*').order('id').range(from, to),
    ),
    fetchAll<Pick<AccountMetricsRow, 'account_id' | 'ttm_revenue'>>((from, to) =>
      supabase
        .from('account_metrics')
        .select('account_id,ttm_revenue')
        .order('account_id')
        .range(from, to),
    ),
    supabase.from('targets').select('cadence_days').eq('id', true).maybeSingle(),
  ]);

  const fallbackCadence = targets?.cadence_days ?? 75;
  const accts = accounts;
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

  const branches = branchRows;
  const effectiveOwner = (b: BranchMetricsRow) =>
    b.owner_id ?? accountOwner.get(b.account_id) ?? null;

  const scoped = repId ? branches.filter((b) => effectiveOwner(b) === repId) : branches;

  // Last touch per branch AND per account (RLS-scoped: a rep sees their own).
  const touches = new Map<string, TouchSummary>();
  const accountLastTouch = new Map<string, string>();
  if (scoped.length > 0) {
    // Page the FULL recent window (400 days ≈ the longest wiring interval plus
    // slack) — a flat `.limit(2000)` starves older branches of their last touch
    // once the team logs a few months of activity, showing "never" wrongly.
    const sinceIso = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const activities = await fetchAll<{
      branch_id: string | null;
      account_id: string | null;
      type: string;
      occurred_at: string;
    }>((from, to) =>
      supabase
        .from('activities')
        .select('branch_id,account_id,type,occurred_at')
        .gte('occurred_at', sinceIso)
        .order('occurred_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
    for (const a of activities) {
      if (a.branch_id && !touches.has(a.branch_id))
        touches.set(a.branch_id, { lastTouchAt: a.occurred_at, lastTouchType: a.type });
      if (a.account_id && !accountLastTouch.has(a.account_id))
        accountLastTouch.set(a.account_id, a.occurred_at);
    }
  }

  // "Time to call" (touch recency vs wiring cadence) at account grain.
  const nowMs = Date.now();
  const callDueOf = (accountId: string): CallDue | null => {
    const w = wiringOf(accountId);
    if (w.intervalDays == null) return null; // no proactive cadence
    const last = accountLastTouch.get(accountId);
    if (!last) return { status: 'never', dueIn: 0 };
    const daysSince = Math.floor((nowMs - new Date(last).getTime()) / 86_400_000);
    const dueIn = w.intervalDays - daysSince;
    return { status: dueIn < 0 ? 'due' : 'ok', dueIn };
  };

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
    callDue: callDueOf(s.branch.account_id),
  }));

  const callDueAccounts = new Set(
    rows
      .filter((r) => r.callDue && r.callDue.status !== 'ok')
      .map((r) => r.branch.account_id),
  ).size;

  // Contacts for the accounts on the list (tolerates the table not existing yet).
  const contactsByAccount: Record<string, ContactOption[]> = {};
  const accountIds = [...new Set(rows.map((r) => r.branch.account_id))];
  if (accountIds.length > 0) {
    // .in() puts the id list in the URL — chunk it (a 500+-id list 400s) and
    // page each chunk past the 1000-row cap.
    for (const chunk of chunkIds(accountIds)) {
      const contacts = await fetchAll<{
        id: string;
        name: string;
        title: string | null;
        tier: number;
        account_id: string;
      }>((from, to) =>
        supabase
          .from('contacts')
          .select('id,name,title,tier,account_id')
          .in('account_id', chunk)
          .order('tier')
          .order('id')
          .range(from, to),
      );
      for (const c of contacts) {
        (contactsByAccount[c.account_id] ??= []).push({
          id: c.id,
          name: c.name,
          title: c.title,
          tier: c.tier,
        });
      }
    }
  }

  return {
    rows,
    summary: summarize(scored),
    cadence: fallbackCadence,
    contactsByAccount,
    callDueAccounts,
  };
}
