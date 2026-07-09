/**
 * Deal-risk flags — rules-v1 (blueprint §4). Pure and unit-tested; every rule
 * is explainable in one sentence, which is what makes the flag actionable and
 * the false-positive rate measurable.
 */
import type { OpportunityRow } from '@/types/database';

export const RISK_RULES_VERSION = 'rules-v1';

export type RiskFlag = {
  key: 'stage_stale' | 'no_next_step' | 'next_step_overdue' | 'single_threaded' | 'slipped';
  label: string;
  detail: string;
};

export type RiskInput = {
  opp: Pick<
    OpportunityRow,
    'id' | 'stage' | 'next_step' | 'next_date' | 'primary_contact_id' | 'amount'
  >;
  /** days since the opportunity last changed stage (from stage history; fall back to created) */
  daysInStage: number | null;
  /** number of expected_close slips (history rows where the date moved later) */
  slipCount: number;
};

const STAGE_STALE_DAYS: Record<string, number> = {
  Qualified: 30,
  Quoted: 21,
  Verbal: 14,
};

export function riskFlags(input: RiskInput, todayIso: string): RiskFlag[] {
  const { opp, daysInStage, slipCount } = input;
  if (opp.stage === 'Won' || opp.stage === 'Lost') return [];
  const flags: RiskFlag[] = [];

  const staleAfter = STAGE_STALE_DAYS[opp.stage];
  if (staleAfter != null && daysInStage != null && daysInStage > staleAfter) {
    flags.push({
      key: 'stage_stale',
      label: `${daysInStage}d in ${opp.stage}`,
      detail: `Deals healthy at this stage move within ~${staleAfter} days.`,
    });
  }
  if (!opp.next_step || !opp.next_date) {
    flags.push({
      key: 'no_next_step',
      label: 'No next step',
      detail: 'Every active deal needs a concrete next step with a date.',
    });
  } else if (opp.next_date < todayIso) {
    flags.push({
      key: 'next_step_overdue',
      label: 'Next step overdue',
      detail: `The promised next step was due ${opp.next_date}.`,
    });
  }
  if (!opp.primary_contact_id && (opp.stage === 'Quoted' || opp.stage === 'Verbal')) {
    flags.push({
      key: 'single_threaded',
      label: 'No contact linked',
      detail: 'Late-stage deal with no named contact — single-threaded risk.',
    });
  }
  if (slipCount >= 2) {
    flags.push({
      key: 'slipped',
      label: `Close slipped ×${slipCount}`,
      detail: 'The expected close date has moved later two or more times.',
    });
  }
  return flags;
}

/** 0–100 risk score for sorting: base per flag, weighted by amount presence. */
export function riskScore(flags: RiskFlag[]): number {
  const weights: Record<RiskFlag['key'], number> = {
    stage_stale: 30,
    no_next_step: 25,
    next_step_overdue: 20,
    single_threaded: 15,
    slipped: 25,
  };
  return Math.min(
    100,
    flags.reduce((s, f) => s + weights[f.key], 0),
  );
}
