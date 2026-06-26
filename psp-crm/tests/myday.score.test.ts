import { describe, it, expect } from 'vitest';
import { scoreBranch, buildWorklist, summarize, type TouchSummary } from '../src/lib/myday/score';
import type { BranchMetricsRow } from '../src/types/database';

const NOW = Date.parse('2026-06-26T00:00:00Z');
const CADENCE = 75;

// Minimal branch_metrics row factory — only the fields the scorer reads matter.
function branch(over: Partial<BranchMetricsRow>): BranchMetricsRow {
  return {
    branch_id: over.branch_id ?? 'b1',
    account_id: over.account_id ?? 'a1',
    branch_name: over.branch_name ?? 'Branch',
    state: null,
    city: null,
    owner_id: over.owner_id ?? null,
    ttm_revenue: over.ttm_revenue ?? 0,
    prior_revenue: over.prior_revenue ?? 0,
    ttm_margin: 0,
    aluminum_ttm: over.aluminum_ttm ?? 0,
    steel_ttm: over.steel_ttm ?? 0,
    last_order_date: over.last_order_date ?? null,
    delta: over.delta ?? 0,
    delta_pct: over.delta_pct ?? null,
    gm_pct: null,
    days_idle: over.days_idle ?? null,
    status: over.status ?? 'Active',
    coverage_rag: over.coverage_rag ?? 'On-track',
    white_space: over.white_space ?? '—',
  };
}

const noTouch = (): Map<string, TouchSummary> => new Map();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe('scoreBranch — actionability', () => {
  it('returns null for a healthy branch (no signal)', () => {
    const r = scoreBranch(branch({ ttm_revenue: 100_000, status: 'Active' }), CADENCE, undefined, NOW);
    expect(r).toBeNull();
  });

  it('flags a lapsed branch with prior-year revenue as the $ at stake', () => {
    const r = scoreBranch(
      branch({ status: 'Lapsed', prior_revenue: 200_000, ttm_revenue: 0, delta: -200_000 }),
      CADENCE,
      undefined,
      NOW,
    );
    expect(r).not.toBeNull();
    expect(r!.primary).toBe('decline');
    expect(r!.reasons.find((x) => x.key === 'decline')!.dollars).toBe(200_000);
  });

  it('flags a steel gap as a whitespace cross-sell sized by aluminum spend', () => {
    const r = scoreBranch(
      branch({ white_space: 'Steel gap', aluminum_ttm: 80_000, ttm_revenue: 80_000 }),
      CADENCE,
      undefined,
      NOW,
    );
    expect(r).not.toBeNull();
    const ws = r!.reasons.find((x) => x.key === 'whitespace')!;
    expect(ws.label).toBe('No steel');
    expect(ws.dollars).toBe(80_000);
  });

  it('flags overdue only past the cadence window', () => {
    expect(scoreBranch(branch({ days_idle: 60, ttm_revenue: 50_000 }), CADENCE, undefined, NOW)).toBeNull();
    const over = scoreBranch(branch({ days_idle: 120, ttm_revenue: 50_000 }), CADENCE, undefined, NOW);
    expect(over).not.toBeNull();
    expect(over!.reasons.some((x) => x.key === 'overdue')).toBe(true);
  });
});

describe('prioritization', () => {
  it('ranks realized decline above an equal-sized cross-sell opportunity', () => {
    const declining = branch({
      branch_id: 'decl',
      status: 'Declining',
      prior_revenue: 100_000,
      ttm_revenue: 0,
      delta: -100_000,
    });
    const crossSell = branch({
      branch_id: 'xsell',
      white_space: 'Alu gap',
      steel_ttm: 100_000,
      ttm_revenue: 100_000,
    });
    const list = buildWorklist([crossSell, declining], CADENCE, noTouch(), NOW);
    expect(list[0].branch.branch_id).toBe('decl'); // decline weighted fully vs xsell at half
  });

  it('demotes a branch the rep touched within the last two weeks', () => {
    const a = branch({ branch_id: 'a', status: 'Lapsed', prior_revenue: 100_000, delta: -100_000 });
    const b = branch({ branch_id: 'b', status: 'Lapsed', prior_revenue: 90_000, delta: -90_000 });
    // a has bigger loss, but was just touched 3 days ago → should drop below b.
    const touches = new Map<string, TouchSummary>([
      ['a', { lastTouchAt: daysAgo(3), lastTouchType: 'call' }],
    ]);
    const list = buildWorklist([a, b], CADENCE, touches, NOW);
    expect(list[0].branch.branch_id).toBe('b');
  });

  it('urgency lifts a long-overdue branch over a just-overdue one of equal revenue', () => {
    const fresh = branch({ branch_id: 'fresh', days_idle: 80, ttm_revenue: 100_000 });
    const stale = branch({ branch_id: 'stale', days_idle: 200, ttm_revenue: 100_000 });
    const list = buildWorklist([fresh, stale], CADENCE, noTouch(), NOW);
    expect(list[0].branch.branch_id).toBe('stale');
  });
});

describe('summarize', () => {
  it('counts and sums each signal independently', () => {
    const rows = buildWorklist(
      [
        branch({ branch_id: '1', status: 'Lapsed', prior_revenue: 50_000, delta: -50_000 }),
        branch({ branch_id: '2', white_space: 'Steel gap', aluminum_ttm: 30_000, ttm_revenue: 30_000 }),
        branch({ branch_id: '3', days_idle: 120, ttm_revenue: 40_000 }),
      ],
      CADENCE,
      noTouch(),
      NOW,
    );
    const s = summarize(rows);
    expect(s.total).toBe(3);
    expect(s.decliningCount).toBe(1);
    expect(s.decliningDollars).toBe(50_000);
    expect(s.whitespaceCount).toBe(1);
    expect(s.whitespaceDollars).toBe(30_000);
    expect(s.overdueCount).toBe(1);
    expect(s.overdueDollars).toBe(40_000);
    expect(s.needsTouchCount).toBe(3); // none touched
  });
});
