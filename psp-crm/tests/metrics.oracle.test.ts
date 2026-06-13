import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

/**
 * §4 ORACLES — v0 is not correct until these tie. Runs against a live Supabase
 * project that has been migrated + seeded with PSP_Account_Coverage_Tracker.xlsx.
 * Skips (does not fail) when the project env isn't configured, so CI without a
 * seeded DB stays green; run locally after `npm run db:seed`.
 *
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && key);

// Relative tolerance for dollar/ratio oracles (workbook ties "within rounding").
const near = (actual: number, expected: number, relTol = 0.02) =>
  Math.abs(actual - expected) <= Math.abs(expected) * relTol;

describe.skipIf(!configured)('§4 oracles (live seeded DB)', () => {
  let supabase: SupabaseClient<Database>;
  let seeded = false;

  beforeAll(async () => {
    supabase = createClient<Database>(url!, key!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await supabase.from('portfolio_kpis').select('prior_book').maybeSingle();
    seeded = Boolean(data && data.prior_book > 0);
    if (!seeded) {
      console.warn('[oracles] DB not seeded (prior_book = 0). Run `npm run db:seed` first.');
    }
  });

  it('portfolio KPIs tie to the workbook', async () => {
    if (!seeded) return;
    const { data: k } = await supabase.from('portfolio_kpis').select('*').single();
    expect(k).toBeTruthy();
    expect(near(k!.current_book, 65_400_000), `current_book=${k!.current_book}`).toBe(true);
    expect(near(k!.prior_book, 47_380_000), `prior_book=${k!.prior_book}`).toBe(true);
    expect(near(k!.yoy ?? 0, 0.38, 0.05), `yoy=${k!.yoy}`).toBe(true);
    expect(near(k!.grr ?? 0, 0.784, 0.02), `grr=${k!.grr}`).toBe(true);
    expect(near(k!.nrr ?? 0, 1.21, 0.02), `nrr=${k!.nrr}`).toBe(true);
    expect(near(k!.contraction, 10_000_000, 0.05), `contraction=${k!.contraction}`).toBe(true);
    expect(near(k!.expansion, 20_200_000, 0.05), `expansion=${k!.expansion}`).toBe(true);
    expect(near(k!.new_business, 8_070_000, 0.05), `new_business=${k!.new_business}`).toBe(true);
  });

  it('largest single-account contraction is Trench Shoring Company (~ -$4.87M)', async () => {
    if (!seeded) return;
    const { data } = await supabase
      .from('account_metrics')
      .select('account_name,delta')
      .order('delta', { ascending: true })
      .limit(1);
    const top = data?.[0];
    expect(top?.account_name ?? '').toMatch(/trench shoring/i);
    expect(near(top!.delta, -4_870_000, 0.05), `delta=${top?.delta}`).toBe(true);
  });

  it('white-space counts: 136 aluminum-only (~$8.96M), 21 steel-only', async () => {
    if (!seeded) return;
    const { data } = await supabase.from('whitespace_summary').select('*');
    const by = Object.fromEntries((data ?? []).map((w) => [w.white_space, w]));
    expect(by['Steel gap']?.branch_count, 'aluminum-only count').toBe(136);
    expect(near(by['Steel gap']?.ttm_revenue ?? 0, 8_960_000, 0.05)).toBe(true);
    expect(by['Alu gap']?.branch_count, 'steel-only count').toBe(21);
  });
});
