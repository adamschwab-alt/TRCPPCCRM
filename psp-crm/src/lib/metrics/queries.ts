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

export type PipelineKpis = {
  openCount: number;
  openAmount: number;
  weightedAmount: number;
  coverage: number | null; // weighted ÷ quarterly new-biz target
  created90: number; // $ pipeline created in last 90 days
  winRate: number | null; // Won ÷ (Won+Lost) closed in last 365d
};

/** Pipeline KPIs for the dashboard tiles. */
export async function getPipelineKpis(newBizTarget: number): Promise<PipelineKpis> {
  const supabase = await createClient();
  const { data: opps } = await supabase
    .from('opportunities')
    .select('stage,amount,weighted_amount,created_at,closed_at');
  const all = opps ?? [];
  const open = all.filter((o) => o.stage !== 'Won' && o.stage !== 'Lost');
  const openAmount = open.reduce((s, o) => s + (o.amount ?? 0), 0);
  const weightedAmount = open.reduce((s, o) => s + (o.weighted_amount ?? 0), 0);
  const quarterTarget = newBizTarget / 4;

  const d90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const created90 = all
    .filter((o) => o.created_at >= d90)
    .reduce((s, o) => s + (o.amount ?? 0), 0);

  const d365 = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const closed = all.filter(
    (o) =>
      (o.stage === 'Won' || o.stage === 'Lost') &&
      (o as { closed_at?: string | null }).closed_at != null &&
      (o as { closed_at?: string | null }).closed_at! >= d365,
  );
  const won = closed.filter((o) => o.stage === 'Won').length;

  return {
    openCount: open.length,
    openAmount,
    weightedAmount,
    coverage: quarterTarget > 0 ? weightedAmount / quarterTarget : null,
    created90,
    winRate: closed.length > 0 ? won / closed.length : null,
  };
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
