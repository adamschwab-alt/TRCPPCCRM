// Server-only logic, but not guarded with 'server-only' because the seed script
// imports it under plain Node (where that guard throws).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ImportDataset } from '@/lib/adapters';

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

/** Last calendar day of a yyyy-mm-dd date's month. */
function endOfMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}

/**
 * Idempotent upsert of a normalized dataset (§6). Uses the service-role client to
 * bypass RLS. Dedupes accounts by name, branches by (account, name), and
 * transactions by (invoice_nbr + so_nbr + line_nbr).
 */
export async function runImport(
  supabase: SupabaseClient<Database>,
  dataset: ImportDataset,
  opts: { asOfDate?: string } = {},
): Promise<ImportSummary> {
  // ── accounts ──────────────────────────────────────────────────────────────
  const { data: existingAccounts, error: aErr } = await supabase.from('accounts').select('id,name');
  if (aErr) throw aErr;
  const accountIdByName = new Map<string, string>(
    (existingAccounts ?? []).map((a) => [a.name.toLowerCase(), a.id]),
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
  const { data: existingBranches, error: bErr } = await supabase
    .from('branches')
    .select('id,account_id,name');
  if (bErr) throw bErr;
  const branchKey = (accountId: string, name: string) => `${accountId}␟${name.toLowerCase()}`;
  const branchIdByKey = new Map<string, string>(
    (existingBranches ?? []).map((b) => [branchKey(b.account_id, b.name), b.id]),
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
  const existingKeys = new Set<string>();
  {
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('sales_transactions')
        .select('invoice_nbr,so_nbr,line_nbr')
        .range(from, from + pageSize - 1);
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

  let inserted = 0;
  for (const batch of chunk(toInsert, 500)) {
    const { error, count } = await supabase.from('sales_transactions').insert(
      batch.map(({ t, accountId, branchId }) => ({
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
      })),
      { count: 'exact' },
    );
    if (error) throw error;
    inserted += count ?? batch.length;
  }

  // ── as_of_date = latest complete month-end across booked transactions ──────
  const bookedDates = dataset.transactions
    .filter((t) => t.status !== 'Canceled')
    .map((t) => t.date)
    .sort();
  const maxDate = bookedDates[bookedDates.length - 1];
  const asOfDate =
    opts.asOfDate ?? (maxDate ? endOfMonth(maxDate) : new Date().toISOString().slice(0, 10));
  const { error: settErr } = await supabase
    .from('app_settings')
    .update({ as_of_date: asOfDate })
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
