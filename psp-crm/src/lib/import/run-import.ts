// Server-only logic, but not guarded with 'server-only' because the seed script
// imports it under plain Node (where that guard throws).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ImportDataset } from '@/lib/adapters';
import { fetchAll } from '@/lib/supabase/fetch-all';

export interface ImportSummary {
  accounts: { inserted: number; existing: number };
  branches: { inserted: number; existing: number };
  transactions: { inserted: number; skippedDuplicates: number; total: number };
  asOfDate: string;
  unmappedHeaders: string[];
}

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const dedupeKey = (invoice: string | null, so: string | null, line: string | null) =>
  `${invoice ?? ''}␟${so ?? ''}␟${line ?? ''}`;

/**
 * Idempotent upsert of a normalized dataset (§6). Uses the service-role client to
 * bypass RLS. Dedupes accounts by name, branches by (account, name), and
 * transactions by (invoice_nbr + so_nbr + line_nbr).
 */
export async function runImport(
  supabase: SupabaseClient<Database>,
  dataset: ImportDataset,
  opts: { asOfDate?: string; sinceDate?: string } = {},
): Promise<ImportSummary> {
  // ── accounts ──────────────────────────────────────────────────────────────
  // fetchAll: an unpaged select caps at 1000 rows — a missed existing account
  // would be re-inserted and abort the whole import on the unique name index.
  const existingAccounts = await fetchAll<{ id: string; name: string }>((from, to) =>
    supabase.from('accounts').select('id,name').order('id').range(from, to),
  );
  const accountIdByName = new Map<string, string>(
    existingAccounts.map((a) => [a.name.toLowerCase(), a.id]),
  );
  const newAccounts = dataset.accounts.filter((a) => !accountIdByName.has(a.name.toLowerCase()));
  for (const batch of chunk(newAccounts, 500)) {
    const { data, error } = await supabase
      .from('accounts')
      .insert(batch.map((a) => ({ name: a.name, primary_state: a.primary_state })))
      .select('id,name');
    if (error) throw error;
    for (const a of data ?? []) accountIdByName.set(a.name.toLowerCase(), a.id);
  }

  // ── branches ──────────────────────────────────────────────────────────────
  const existingBranches = await fetchAll<{ id: string; account_id: string; name: string }>(
    (from, to) => supabase.from('branches').select('id,account_id,name').order('id').range(from, to),
  );
  const branchKey = (accountId: string, name: string) => `${accountId}␟${name.toLowerCase()}`;
  const branchIdByKey = new Map<string, string>(
    existingBranches.map((b) => [branchKey(b.account_id, b.name), b.id]),
  );
  const newBranches = dataset.branches
    .map((b) => ({ ...b, account_id: accountIdByName.get(b.account_name.toLowerCase()) }))
    .filter((b) => b.account_id && !branchIdByKey.has(branchKey(b.account_id!, b.name)));
  for (const batch of chunk(newBranches, 500)) {
    const { data, error } = await supabase
      .from('branches')
      .insert(
        batch.map((b) => ({
          account_id: b.account_id!,
          name: b.name,
          state: b.state,
          city: b.city,
        })),
      )
      .select('id,account_id,name');
    if (error) throw error;
    for (const b of data ?? []) branchIdByKey.set(branchKey(b.account_id, b.name), b.id);
  }

  // ── transactions (dedupe on invoice+so+line) ───────────────────────────────
  // On incremental syncs every incoming row is dated >= sinceDate, so only
  // existing keys in that window can collide — scoping the scan avoids paging
  // the entire history on every refresh.
  const existingKeys = new Set<string>();
  {
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      // Stable order is required for correct pagination — without it Postgres
      // may return rows in a different order per page and keys get skipped.
      let q = supabase
        .from('sales_transactions')
        .select('invoice_nbr,so_nbr,line_nbr')
        .order('id')
        .range(from, from + pageSize - 1);
      if (opts.sinceDate) q = q.gte('date', opts.sinceDate);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const t of data) existingKeys.add(dedupeKey(t.invoice_nbr, t.so_nbr, t.line_nbr));
      if (data.length < pageSize) break;
    }
  }

  let skippedDuplicates = 0;
  const seenInBatch = new Set<string>();
  const toInsert = dataset.transactions
    .map((t) => {
      const accountId = accountIdByName.get(t.account_name.toLowerCase()) ?? null;
      const branchId = accountId
        ? (branchIdByKey.get(branchKey(accountId, t.branch_name)) ?? null)
        : null;
      return { t, accountId, branchId };
    })
    .filter(({ t }) => {
      const k = dedupeKey(t.invoice_nbr, t.so_nbr, t.line_nbr);
      if (existingKeys.has(k) || seenInBatch.has(k)) {
        skippedDuplicates++;
        return false;
      }
      seenInBatch.add(k);
      return true;
    });

  // Insert with conflict tolerance. The pre-scan catches most duplicates, but
  // the dedupe key is a unique EXPRESSION index (PostgREST upsert can't target
  // it), so a residual collision aborts its whole batch with 23505. Recover by
  // bisecting the failed batch — conflicting single rows are counted as
  // duplicates and skipped, everything else still lands.
  type InsertRow = Database['public']['Tables']['sales_transactions']['Insert'];
  async function insertTolerant(rows: InsertRow[]): Promise<{ ins: number; dup: number }> {
    if (rows.length === 0) return { ins: 0, dup: 0 };
    const { error } = await supabase.from('sales_transactions').insert(rows);
    if (!error) return { ins: rows.length, dup: 0 };
    const isConflict = error.code === '23505' || /duplicate key/i.test(error.message);
    if (!isConflict) throw error;
    if (rows.length === 1) return { ins: 0, dup: 1 };
    const mid = rows.length >> 1;
    const a = await insertTolerant(rows.slice(0, mid));
    const b = await insertTolerant(rows.slice(mid));
    return { ins: a.ins + b.ins, dup: a.dup + b.dup };
  }

  let inserted = 0;
  for (const batch of chunk(toInsert, 1000)) {
    const rows: InsertRow[] = batch.map(({ t, accountId, branchId }) => ({
      date: t.date,
      net_sale: t.net_sale,
      quantity: t.quantity,
      cost: t.cost,
      margin: t.margin,
      status: t.status,
      so_type: t.so_type,
      account_id: accountId,
      branch_id: branchId,
      inventory_id: t.inventory_id,
      inventory_description: t.inventory_description,
      item_class: t.item_class,
      product_line: t.product_line,
      sales_person: t.sales_person,
      state: t.state,
      city: t.city,
      invoice_nbr: t.invoice_nbr,
      so_nbr: t.so_nbr,
      line_nbr: t.line_nbr,
    }));
    const r = await insertTolerant(rows);
    inserted += r.ins;
    skippedDuplicates += r.dup;
  }

  // ── as_of_date = newest booked transaction date ─────────────────────────────
  // NOT the month-end: rounding a July-2 sync up to July-31 future-dates the
  // metric window — days_idle inflates by the rest of the month (a branch that
  // ordered yesterday shows ~30d idle) and TTM includes weeks that haven't
  // happened yet, biasing status toward Declining. Rolling windows anchored on
  // the real data edge measure honestly. (Seed/oracle paths still pass an
  // explicit month-end via opts.asOfDate.)
  const bookedDates = dataset.transactions
    .filter((t) => t.status !== 'Canceled')
    .map((t) => t.date)
    .sort();
  const maxDate = bookedDates[bookedDates.length - 1];
  const asOfDate = opts.asOfDate ?? maxDate ?? new Date().toISOString().slice(0, 10);
  // updated_at doubles as the "last refreshed" timestamp (no trigger on this
  // table), so stamp it explicitly.
  const { error: settErr } = await supabase
    .from('app_settings')
    .update({ as_of_date: asOfDate, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (settErr) throw settErr;

  return {
    accounts: { inserted: newAccounts.length, existing: accountIdByName.size - newAccounts.length },
    branches: { inserted: newBranches.length, existing: branchIdByKey.size - newBranches.length },
    transactions: { inserted, skippedDuplicates, total: dataset.transactions.length },
    asOfDate,
    unmappedHeaders: dataset.unmappedHeaders,
  };
}
