import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bootDb } from './helpers/pglite';

/**
 * Proves the metric SQL (views in 0003) computes §4 definitions correctly,
 * using a tiny synthetic dataset whose KPIs are hand-computed below.
 *
 * Scenario (as_of = 2025-12-31, retention_floor = 0.85, cadence = 75):
 *   Expand Co  prior 100 (2024-06) → ttm 150 (2025-12, Aluminum)  → Active,  +50 expansion
 *   Shrink Co  prior 200 (2024-06) → ttm 100 (2025-06, Steel)     → Declining, -100 contraction
 *   Lapsed Co  prior  80 (2024-03) → ttm   0                      → Lapsed,  80 lapsed_prior
 *   New Co     prior   0           → ttm  60 (2025-09, Aluminum)  → New,     60 new_business
 *
 *   current_book = 150+100+0+60 = 310
 *   prior_book   = 100+200+80+0 = 380
 *   lapsed_prior = 80 ; contraction = 100 ; expansion = 50 ; new_business = 60
 *   yoy = 310/380 - 1            = -0.184210…
 *   grr = (380-80-100)/380       =  0.526315…
 *   nrr = (380-80-100+50)/380    =  0.657894…
 *   gm  = 93/310 (margins 45+30+0+18) = 0.30
 */
let db: PGlite;

beforeAll(async () => {
  db = await bootDb();

  await db.exec(`
    update app_settings set as_of_date = '2025-12-31';

    insert into accounts (id, name) values
      ('00000000-0000-0000-0000-0000000000a1','Expand Co'),
      ('00000000-0000-0000-0000-0000000000a2','Shrink Co'),
      ('00000000-0000-0000-0000-0000000000a3','Lapsed Co'),
      ('00000000-0000-0000-0000-0000000000a4','New Co');

    insert into branches (id, account_id, name) values
      ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','Expand HQ'),
      ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2','Shrink HQ'),
      ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000a3','Lapsed HQ'),
      ('00000000-0000-0000-0000-0000000000b4','00000000-0000-0000-0000-0000000000a4','New HQ');

    insert into sales_transactions
      (date, net_sale, margin, status, account_id, branch_id, product_line, invoice_nbr, line_nbr) values
      -- prior-TTM
      ('2024-06-01', 100, 25, 'Closed','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','Aluminum','P1','1'),
      ('2024-06-01', 200, 40, 'Closed','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000b2','Steel','P2','1'),
      ('2024-03-01',  80, 20, 'Closed','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000b3','Steel','P3','1'),
      -- TTM
      ('2025-12-01', 150, 45, 'Closed','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','Aluminum','T1','1'),
      ('2025-06-01', 100, 30, 'Closed','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000b2','Steel','T2','1'),
      ('2025-09-01',  60, 18, 'Closed','00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000b4','Aluminum','T4','1'),
      -- a Canceled row that must be excluded from "booked"
      ('2025-07-01', 999, 999,'Canceled','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','Aluminum','X1','1');
  `);
});

afterAll(async () => {
  await db?.close();
});

const kpis = () =>
  db.query<Record<string, string>>('select * from portfolio_kpis').then((r) => r.rows[0]);

describe('portfolio KPIs', () => {
  it('current_book / prior_book / yoy', async () => {
    const k = await kpis();
    expect(Number(k.current_book)).toBeCloseTo(310, 6);
    expect(Number(k.prior_book)).toBeCloseTo(380, 6);
    expect(Number(k.yoy)).toBeCloseTo(310 / 380 - 1, 6);
  });

  it('GRR / NRR computed at account grain', async () => {
    const k = await kpis();
    expect(Number(k.lapsed_prior)).toBeCloseTo(80, 6);
    expect(Number(k.contraction)).toBeCloseTo(100, 6);
    expect(Number(k.expansion)).toBeCloseTo(50, 6);
    expect(Number(k.new_business)).toBeCloseTo(60, 6);
    expect(Number(k.grr)).toBeCloseTo((380 - 80 - 100) / 380, 6);
    expect(Number(k.nrr)).toBeCloseTo((380 - 80 - 100 + 50) / 380, 6);
  });

  it('gm_pct excludes Canceled rows', async () => {
    const k = await kpis();
    expect(Number(k.gm_pct)).toBeCloseTo(93 / 310, 6);
  });
});

describe('branch statuses & white-space', () => {
  it('classifies status + coverage_rag + white_space', async () => {
    const rows = await db.query<Record<string, string>>(
      'select branch_name, status, coverage_rag, white_space from branch_metrics order by branch_name',
    );
    const by = Object.fromEntries(rows.rows.map((r) => [r.branch_name, r]));
    expect(by['Expand HQ'].status).toBe('Active');
    expect(by['Expand HQ'].coverage_rag).toBe('On-track'); // recent order, +delta
    expect(by['Expand HQ'].white_space).toBe('Steel gap'); // aluminum-only
    expect(by['Shrink HQ'].status).toBe('Declining');
    expect(by['Shrink HQ'].coverage_rag).toBe('At-risk');
    expect(by['Shrink HQ'].white_space).toBe('Alu gap'); // steel-only
    expect(by['Lapsed HQ'].status).toBe('Lapsed');
    expect(by['Lapsed HQ'].white_space).toBe('Both');
    expect(by['New HQ'].status).toBe('New');
  });

  it('whitespace_summary aggregates branch grain', async () => {
    const rows = await db.query<Record<string, string>>('select * from whitespace_summary');
    const by = Object.fromEntries(rows.rows.map((r) => [r.white_space, Number(r.branch_count)]));
    expect(by['Steel gap']).toBe(2); // Expand + New (aluminum-only)
    expect(by['Alu gap']).toBe(1); // Shrink (steel-only)
    expect(by['Both']).toBe(1); // Lapsed
  });
});
