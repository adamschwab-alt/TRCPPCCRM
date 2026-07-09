import { describe, it, expect } from 'vitest';
import { oppCompleteness, COMPLETENESS_FIELDS } from '../src/lib/dq/queries';

describe('opportunity completeness score (KPI dictionary)', () => {
  it('scores 7/7 fields present as 1.0', () => {
    expect(
      oppCompleteness({
        amount: 50_000,
        expected_close: '2026-08-01',
        next_step: 'Send quote',
        next_date: '2026-07-15',
        source: 'existing_account',
        primary_contact_id: 'c1',
        product_line: 'Steel',
      }),
    ).toBe(1);
  });

  it('scores an empty opp as 0', () => {
    expect(oppCompleteness({})).toBe(0);
  });

  it('counts each of the 7 fields equally', () => {
    expect(oppCompleteness({ amount: 1 })).toBeCloseTo(1 / COMPLETENESS_FIELDS.length);
    expect(oppCompleteness({ amount: 1, source: 'other' })).toBeCloseTo(2 / 7);
  });

  it('treats empty strings as missing', () => {
    expect(oppCompleteness({ next_step: '' })).toBe(0);
  });
});
