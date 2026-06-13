import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { bootDb } from './helpers/pglite';
import { FileImportAdapter } from '../src/lib/adapters/file-import';

/**
 * End-to-end proof of the §4 oracles using the REAL workbook, run entirely in
 * PGlite — no Supabase required. Loads data/PSP_Account_Coverage_Tracker.xlsx
 * through the production FileImportAdapter + the real migration SQL, sets the
 * workbook's as-of (2026-05-31), then asserts the dashboard numbers tie.
 *
 * Skips when the (gitignored) workbook isn't present, so CI stays green.
 */
const WORKBOOK = 'data/PSP_Account_Coverage_Tracker.xlsx';
const present = existsSync(WORKBOOK);

const near = (actual: number, expected: number, relTol = 0.02) =>
  Math.abs(actual - expected) <= Math.abs(expected) * relTol;

describe.skipIf(!present)('§4 oracles (real workbook via PGlite)', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await bootDb();

    const dataset = await new FileImportAdapter({ buffer: readFileSync(WORKBOOK) }).load();

    // accounts
    const accountId = new Map<string, string>();
    for (const a of dataset.accounts) accountId.set(a.name.toLowerCase(), randomUUID());
    await bulkInsert(
      db,
      'accounts',
      ['id', 'name', 'primary_state'],
      dataset.accounts.map((a) => [accountId.get(a.name.toLowerCase()), a.name, a.primary_state]),
    );

    // branches
    const branchId = new Map<string, string>();
    const bkey = (acc: string, name: string) => `${acc.toLowerCase()}␟${name.toLowerCase()}`;
    for (const b of dataset.branches) branchId.set(bkey(b.account_name, b.name), randomUUID());
    await bulkInsert(
      db,
      'branches',
      ['id', 'account_id', 'name', 'state', 'city'],
      dataset.branches.map((b) => [
        branchId.get(bkey(b.account_name, b.name)),
        accountId.get(b.account_name.toLowerCase()),
        b.name,
        b.state,
        b.city,
      ]),
    );

    // transactions
    await bulkInsert(
      db,
      'sales_transactions',
      [
        'date',
        'net_sale',
        'quantity',
        'cost',
        'margin',
        'status',
        'so_type',
        'account_id',
        'branch_id',
        'inventory_id',
        'inventory_description',
        'item_class',
        'product_line',
        'sales_person',
        'state',
        'city',
        'invoice_nbr',
        'so_nbr',
        'line_nbr',
      ],
      dataset.transactions.map((t) => [
        t.date,
        t.net_sale,
        t.quantity,
        t.cost,
        t.margin,
        t.status,
        t.so_type,
        accountId.get(t.account_name.toLowerCase()) ?? null,
        branchId.get(bkey(t.account_name, t.branch_name)) ?? null,
        t.inventory_id,
        t.inventory_description,
        t.item_class,
        t.product_line,
        t.sales_person,
        t.state,
        t.city,
        t.invoice_nbr,
        t.so_nbr,
        t.line_nbr,
      ]),
    );

    await db.exec(`update app_settings set as_of_date = '2026-05-31';`);
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  it('portfolio KPIs tie to the workbook', async () => {
    const k = (await db.query<Record<string, string>>('select * from portfolio_kpis')).rows[0];
    const v = (key: string) => Number(k[key]);
    // Surface the actuals for visibility in the test log.
    console.log('KPIs:', {
      current_book: v('current_book'),
      prior_book: v('prior_book'),
      yoy: v('yoy'),
      grr: v('grr'),
      nrr: v('nrr'),
      contraction: v('contraction'),
      expansion: v('expansion'),
      new_business: v('new_business'),
    });
    expect(near(v('current_book'), 65_400_000, 0.03)).toBe(true);
    expect(near(v('prior_book'), 47_380_000, 0.03)).toBe(true);
    expect(near(v('yoy'), 0.38, 0.08)).toBe(true);
    expect(near(v('grr'), 0.784, 0.03)).toBe(true);
    expect(near(v('nrr'), 1.21, 0.03)).toBe(true);
    expect(near(v('contraction'), 10_000_000, 0.08)).toBe(true);
    expect(near(v('expansion'), 20_200_000, 0.08)).toBe(true);
    expect(near(v('new_business'), 8_070_000, 0.08)).toBe(true);
  });

  it('largest single-account contraction is Trench Shoring Company (~ -$4.87M)', async () => {
    const top = (
      await db.query<{ account_name: string; delta: string }>(
        'select account_name, delta from account_metrics order by delta asc limit 1',
      )
    ).rows[0];
    console.log('largest contraction:', top);
    expect(top.account_name).toMatch(/trench shoring/i);
    expect(near(Number(top.delta), -4_870_000, 0.08)).toBe(true);
  });

  it('white-space: 136 aluminum-only (~$8.96M), 21 steel-only', async () => {
    const rows = (await db.query<Record<string, string>>('select * from whitespace_summary')).rows;
    const by = Object.fromEntries(rows.map((r) => [r.white_space, r]));
    console.log(
      'whitespace:',
      rows.map((r) => `${r.white_space}=${r.branch_count} ($${Number(r.ttm_revenue).toFixed(0)})`),
    );
    expect(Number(by['Steel gap']?.branch_count)).toBe(136);
    expect(near(Number(by['Steel gap']?.ttm_revenue), 8_960_000, 0.05)).toBe(true);
    expect(Number(by['Alu gap']?.branch_count)).toBe(21);
  });
});

async function bulkInsert(
  db: PGlite,
  table: string,
  cols: string[],
  rows: unknown[][],
  chunk = 1000,
) {
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk);
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const row of batch) {
      values.push(`(${row.map(() => `$${p++}`).join(',')})`);
      params.push(...row);
    }
    await db.query(`insert into ${table} (${cols.join(',')}) values ${values.join(',')}`, params);
  }
}
