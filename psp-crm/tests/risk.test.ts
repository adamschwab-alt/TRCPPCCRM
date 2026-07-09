import { describe, it, expect } from 'vitest';
import { riskFlags, riskScore, type RiskInput } from '../src/lib/ai/risk';

const TODAY = '2026-07-04';

function input(over: Partial<RiskInput['opp']>, daysInStage = 5, slipCount = 0): RiskInput {
  return {
    opp: {
      id: 'o1',
      stage: 'Quoted',
      next_step: 'Send revised quote',
      next_date: '2026-07-10',
      primary_contact_id: 'c1',
      amount: 50_000,
      ...over,
    },
    daysInStage,
    slipCount,
  };
}

describe('deal-risk rules-v1', () => {
  it('healthy deal → no flags', () => {
    expect(riskFlags(input({}), TODAY)).toEqual([]);
  });

  it('closed deals never flag', () => {
    expect(riskFlags(input({ stage: 'Won', next_step: null, next_date: null }), TODAY)).toEqual([]);
    expect(riskFlags(input({ stage: 'Lost', next_step: null, next_date: null }), TODAY)).toEqual([]);
  });

  it('stage staleness thresholds: Quoted flags after 21d, Verbal after 14d', () => {
    expect(riskFlags(input({}, 22), TODAY).map((f) => f.key)).toContain('stage_stale');
    expect(riskFlags(input({}, 21), TODAY).map((f) => f.key)).not.toContain('stage_stale');
    expect(riskFlags(input({ stage: 'Verbal' }, 15), TODAY).map((f) => f.key)).toContain(
      'stage_stale',
    );
  });

  it('missing or overdue next step flags (mutually exclusive)', () => {
    const missing = riskFlags(input({ next_step: null, next_date: null }), TODAY);
    expect(missing.map((f) => f.key)).toContain('no_next_step');
    const overdue = riskFlags(input({ next_date: '2026-06-30' }), TODAY);
    expect(overdue.map((f) => f.key)).toContain('next_step_overdue');
    expect(overdue.map((f) => f.key)).not.toContain('no_next_step');
  });

  it('late-stage deal without a linked contact is single-threaded', () => {
    expect(riskFlags(input({ primary_contact_id: null }), TODAY).map((f) => f.key)).toContain(
      'single_threaded',
    );
    expect(
      riskFlags(input({ stage: 'Qualified', primary_contact_id: null }), TODAY).map((f) => f.key),
    ).not.toContain('single_threaded');
  });

  it('two or more close-date slips flag', () => {
    expect(riskFlags(input({}, 5, 2), TODAY).map((f) => f.key)).toContain('slipped');
    expect(riskFlags(input({}, 5, 1), TODAY).map((f) => f.key)).not.toContain('slipped');
  });

  it('risk score accumulates and caps at 100', () => {
    const all = riskFlags(
      input({ next_step: null, next_date: null, primary_contact_id: null }, 40, 3),
      TODAY,
    );
    expect(riskScore(all)).toBe(95); // 30+25+15+25
    expect(riskScore([...all, ...all])).toBe(100);
  });
});
