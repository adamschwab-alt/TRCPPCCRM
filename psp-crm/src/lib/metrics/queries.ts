import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  AccountMetricsRow,
  AppSettingsRow,
  BranchMetricsRow,
  PortfolioKpisRow,
  SalesTransactionRow,
  TargetsRow,
  WhitespaceSummaryRow,
} from '@/types/database';

/**
 * All reads go through the RLS-enforced server client, so every result is already
 * scoped to the caller's book (rep) or full portfolio (manager/admin).
 */

export async function getTargets(): Promise<TargetsRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('targets').select('*').eq('id', true).maybeSingle();
  return data;
}

export async function getAppSettings(): Promise<AppSettingsRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('*').eq('id', true).maybeSingle();
  return data;
}

export async function getPortfolioKpis(): Promise<PortfolioKpisRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('portfolio_kpis').select('*').maybeSingle();
  return data;
}

/** "Where the leak is" — biggest contracting accounts (delta < 0, excl. brand-new). */
export async function getTopContractingAccounts(limit = 8): Promise<AccountMetricsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('account_metrics')
    .select('*')
    .lt('delta', 0)
    .order('delta', { ascending: true })
    .limit(limit);
  return data ?? [];
}

export async function getWhitespaceSummary(): Promise<WhitespaceSummaryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('whitespace_summary').select('*');
  return data ?? [];
}

/** Count of branches past the reorder cadence (days_idle > cadence_days). */
export async function getPastCadenceCount(cadenceDays: number): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('branch_metrics')
    .select('branch_id', { count: 'exact', head: true })
    .gt('days_idle', cadenceDays);
  return count ?? 0;
}

export async function getAccounts(): Promise<AccountMetricsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('account_metrics')
    .select('*')
    .order('ttm_revenue', { ascending: false });
  return data ?? [];
}

export async function getAccount(accountId: string): Promise<AccountMetricsRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('account_metrics')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  return data;
}

export async function getBranchesForAccount(accountId: string): Promise<BranchMetricsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('branch_metrics')
    .select('*')
    .eq('account_id', accountId)
    .order('ttm_revenue', { ascending: false });
  return data ?? [];
}

export async function getBranch(branchId: string): Promise<BranchMetricsRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('branch_metrics')
    .select('*')
    .eq('branch_id', branchId)
    .maybeSingle();
  return data;
}

export async function getBranchTransactions(
  branchId: string,
  limit = 100,
): Promise<SalesTransactionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('sales_transactions')
    .select('*')
    .eq('branch_id', branchId)
    .order('date', { ascending: false })
    .limit(limit);
  return data ?? [];
}
