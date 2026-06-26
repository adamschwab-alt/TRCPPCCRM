import type { BranchMetricsRow } from '@/types/database';

/**
 * Rep-workstream prioritization (pure / unit-tested).
 *
 * Strategy: rank the branches a rep should work by DOLLARS AT STAKE, not by
 * count — so the biggest-value problems float up — then bias by urgency and
 * suppress anything the rep touched recently so the queue rotates instead of
 * nagging.
 *
 * Three signals (the ones PSP cares about), each carrying a $ figure:
 *   • decline    — realized YoY contraction (prior − ttm). Weighted fully:
 *                  it's money already walking out the door.
 *   • whitespace — cross-sell prize: the in-line revenue they already buy
 *                  (aluminum for a steel gap, steel for an alu gap). Upside,
 *                  not loss, so weighted at half.
 *   • overdue    — idle past the reorder cadence. A relationship-at-risk proxy
 *                  on the branch's annual revenue, weighted at a quarter.
 *
 * impact$ blends the three; an urgency multiplier (how far past cadence) and a
 * recency factor (recently touched → demote) produce the final priority.
 */

export type TouchSummary = {
  lastTouchAt: string | null; // ISO timestamp of the rep's most recent touch
  lastTouchType: string | null;
};

export type ReasonKey = 'decline' | 'whitespace' | 'overdue';

export type Reason = {
  key: ReasonKey;
  label: string;
  dollars: number; // $ associated with this reason
};

export type ScoredBranch = {
  branch: BranchMetricsRow;
  reasons: Reason[];
  primary: ReasonKey;
  impact: number; // blended $ impact
  priority: number; // impact × urgency × recency (raw, for sorting)
  daysSinceTouch: number | null;
  needsTouch: boolean; // not touched in >= 30 days (or never)
};

const DECLINE_WEIGHT = 1.0;
const WHITESPACE_WEIGHT = 0.5;
const OVERDUE_WEIGHT = 0.25;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function daysBetween(fromIso: string, now: number): number {
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((now - t) / 86_400_000);
}

/** Recency factor: freshly-worked branches drop down the queue. */
function recencyFactor(daysSinceTouch: number | null): number {
  if (daysSinceTouch == null) return 1; // never touched → full weight
  if (daysSinceTouch < 14) return 0.2; // worked this fortnight → strong demote
  if (daysSinceTouch < 30) return 0.6; // worked this month → mild demote
  return 1;
}

/**
 * Score one branch. Returns null when the branch has no actionable signal —
 * those don't belong on a rep's "to work" list.
 */
export function scoreBranch(
  b: BranchMetricsRow,
  cadenceDays: number,
  touch: TouchSummary | undefined,
  now: number,
): ScoredBranch | null {
  const reasons: Reason[] = [];

  // ── decline ───────────────────────────────────────────────────────────────
  const declineDollars =
    b.status === 'Lapsed'
      ? b.prior_revenue
      : b.delta < 0 && b.prior_revenue > 0
        ? -b.delta
        : 0;
  if (declineDollars > 0) {
    reasons.push({
      key: 'decline',
      label: b.status === 'Lapsed' ? 'Lapsed' : 'Declining',
      dollars: declineDollars,
    });
  }

  // ── whitespace (no steel OR no aluminum) ────────────────────────────────────
  const wsDollars =
    b.white_space === 'Steel gap'
      ? b.aluminum_ttm
      : b.white_space === 'Alu gap'
        ? b.steel_ttm
        : 0;
  if (b.white_space === 'Steel gap' || b.white_space === 'Alu gap') {
    reasons.push({
      key: 'whitespace',
      label: b.white_space === 'Steel gap' ? 'No steel' : 'No aluminum',
      dollars: wsDollars,
    });
  }

  // ── overdue (idle past cadence) ─────────────────────────────────────────────
  const overdue = b.days_idle != null && b.days_idle > cadenceDays;
  if (overdue) {
    reasons.push({ key: 'overdue', label: `Idle ${b.days_idle}d`, dollars: b.ttm_revenue });
  }

  if (reasons.length === 0) return null;

  const impact =
    DECLINE_WEIGHT * declineDollars +
    WHITESPACE_WEIGHT * wsDollars +
    OVERDUE_WEIGHT * (overdue ? b.ttm_revenue : 0);

  // Urgency: 1× at cadence, ramping to 2× at 2× cadence and beyond.
  const urgency =
    b.days_idle != null ? 1 + clamp((b.days_idle - cadenceDays) / cadenceDays, 0, 1) : 1;

  const daysSinceTouch = touch?.lastTouchAt != null ? daysBetween(touch.lastTouchAt, now) : null;
  const priority = impact * urgency * recencyFactor(daysSinceTouch);

  // Dominant reason = biggest $ contribution (decline ties win — it's realized loss).
  const primary = [...reasons].sort((x, y) => y.dollars - x.dollars)[0].key;

  return {
    branch: b,
    reasons,
    primary,
    impact,
    priority,
    daysSinceTouch,
    needsTouch: daysSinceTouch == null || daysSinceTouch >= 30,
  };
}

export type MyDaySummary = {
  total: number;
  overdueCount: number;
  overdueDollars: number; // ttm revenue of idle branches
  decliningCount: number;
  decliningDollars: number; // realized $ lost
  whitespaceCount: number;
  whitespaceDollars: number; // cross-sell base
  needsTouchCount: number;
};

export function summarize(scored: ScoredBranch[]): MyDaySummary {
  const s: MyDaySummary = {
    total: scored.length,
    overdueCount: 0,
    overdueDollars: 0,
    decliningCount: 0,
    decliningDollars: 0,
    whitespaceCount: 0,
    whitespaceDollars: 0,
    needsTouchCount: 0,
  };
  for (const r of scored) {
    if (r.needsTouch) s.needsTouchCount++;
    for (const reason of r.reasons) {
      if (reason.key === 'overdue') {
        s.overdueCount++;
        s.overdueDollars += reason.dollars;
      } else if (reason.key === 'decline') {
        s.decliningCount++;
        s.decliningDollars += reason.dollars;
      } else if (reason.key === 'whitespace') {
        s.whitespaceCount++;
        s.whitespaceDollars += reason.dollars;
      }
    }
  }
  return s;
}

/** Score, drop non-actionable, sort by priority desc. */
export function buildWorklist(
  branches: BranchMetricsRow[],
  cadenceDays: number,
  touches: Map<string, TouchSummary>,
  now: number,
): ScoredBranch[] {
  return branches
    .map((b) => scoreBranch(b, cadenceDays, touches.get(b.branch_id), now))
    .filter((x): x is ScoredBranch => x !== null)
    .sort((a, b) => b.priority - a.priority);
}
