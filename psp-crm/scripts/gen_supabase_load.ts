/**
 * Generates everything needed to load PSP into Supabase WITHOUT this sandbox
 * touching the project (it's network-blocked). Produces:
 *
 *   supabase/setup_full.sql      schema + RLS + views + targets + the ~40 accounts
 *                                and ~400 branches (with fixed UUIDs) + as_of date
 *   data/sales_transactions.csv  the 45k transactions, FK UUIDs already resolved
 *
 * The user pastes setup_full.sql into the Supabase SQL Editor (one Run), then
 * imports the CSV into the sales_transactions table via the Table Editor.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { FileImportAdapter } from '../src/lib/adapters/file-import';

const WORKBOOK = 'data/PSP_Account_Coverage_Tracker.xlsx';
const AS_OF = '2026-05-31';

const sq = (v: string | null) => (v === null ? 'null' : `'${v.replace(/'/g, "''")}'`);

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const dataset = await new FileImportAdapter({ buffer: readFileSync(WORKBOOK) }).load();

  const accountId = new Map<string, string>();
  for (const a of dataset.accounts) accountId.set(a.name.toLowerCase(), randomUUID());
  const branchId = new Map<string, string>();
  const bkey = (acc: string, name: string) => `${acc.toLowerCase()}␟${name.toLowerCase()}`;
  for (const b of dataset.branches) branchId.set(bkey(b.account_name, b.name), randomUUID());

  // ── setup_full.sql ─────────────────────────────────────────────────────────
  let sql = readFileSync('supabase/all_in_one.sql', 'utf8');
  sql += `\n\n-- ╔═══ Seeded accounts (${dataset.accounts.length}) ═══╗\n`;
  for (const a of dataset.accounts) {
    sql += `insert into accounts (id, name, primary_state) values ('${accountId.get(
      a.name.toLowerCase(),
    )}', ${sq(a.name)}, ${sq(a.primary_state)});\n`;
  }
  sql += `\n-- ╔═══ Seeded branches (${dataset.branches.length}) ═══╗\n`;
  for (const b of dataset.branches) {
    sql += `insert into branches (id, account_id, name, state, city) values ('${branchId.get(
      bkey(b.account_name, b.name),
    )}', '${accountId.get(b.account_name.toLowerCase())}', ${sq(b.name)}, ${sq(b.state)}, ${sq(
      b.city,
    )});\n`;
  }
  sql += `\n-- ╔═══ as-of (drives the TTM windows) ═══╗\n`;
  sql += `update app_settings set as_of_date = '${AS_OF}';\n`;
  writeFileSync('supabase/setup_full.sql', sql);

  // ── sales_transactions.csv ─────────────────────────────────────────────────
  const cols = [
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
  ];
  const lines = [cols.join(',')];
  for (const t of dataset.transactions) {
    lines.push(
      [
        t.date,
        t.net_sale,
        t.quantity,
        t.cost,
        t.margin,
        t.status,
        t.so_type,
        accountId.get(t.account_name.toLowerCase()) ?? '',
        branchId.get(bkey(t.account_name, t.branch_name)) ?? '',
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
      ]
        .map(csvCell)
        .join(','),
    );
  }
  writeFileSync('data/sales_transactions.csv', lines.join('\n'));

  console.log(
    `setup_full.sql: ${dataset.accounts.length} accounts, ${dataset.branches.length} branches`,
  );
  console.log(`sales_transactions.csv: ${dataset.transactions.length} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
