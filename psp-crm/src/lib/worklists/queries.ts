import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AccountMetricsRow, BranchMetricsRow, TargetsRow } from '@/types/database';

export type WorklistKey = 'at-risk' | 'cadence' | 'whitespace' | 'lapsed';

async function targets(): Promise<TargetsRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('targets').select('*').eq('id', true).maybeSingle();
  return data;
}

export async function getAtRiskBranches(): Promise<BranchMetricsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('branch_metrics')
    .select('*')
    .eq('coverage_rag', 'At-risk')
    .order('ttm_revenue', { ascending: false })
    .limit(300);
  return data ?? [];
}

export async function getPastCadenceBranches(): Promise<{
  rows: BranchMetricsRow[];
  cadence: number;
}> {
  const t = await targets();
  const cadence = t?.cadence_days ?? 75;
  const supabase = await createClient();
  const { data } = await supabase
    .from('branch_metrics')
    .select('*')
    .gt('days_idle', cadence)
    .order('days_idle', { ascending: false })
    .limit(300);
  return { rows: data ?? [], cadence };
}

export async function getWhitespaceBranches(): Promise<BranchMetricsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('branch_metrics')
    .select('*')
    .in('white_space', ['Steel gap', 'Alu gap'])
    .order('ttm_revenue', { ascending: false })
    .limit(300);
  return data ?? [];
}

export async function getLapsedAccounts(): Promise<AccountMetricsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('account_metrics')
    .select('*')
    .eq('status', 'Lapsed')
    .order('prior_revenue', { ascending: false })
    .limit(300);
  return data ?? [];
}

export async function getWorklistCounts() {
  const supabase = await createClient();
  const t = await targets();
  const cadence = t?.cadence_days ?? 75;
  const [atRisk, cadenceC, whitespace, lapsed] = await Promise.all([
    supabase
      .from('branch_metrics')
      .select('branch_id', { count: 'exact', head: true })
      .eq('coverage_rag', 'At-risk'),
    supabase
      .from('branch_metrics')
      .select('branch_id', { count: 'exact', head: true })
      .gt('days_idle', cadence),
    supabase
      .from('branch_metrics')
      .select('branch_id', { count: 'exact', head: true })
      .in('white_space', ['Steel gap', 'Alu gap']),
    supabase
      .from('account_metrics')
      .select('account_id', { count: 'exact', head: true })
      .eq('status', 'Lapsed'),
  ]);
  return {
    'at-risk': atRisk.count ?? 0,
    cadence: cadenceC.count ?? 0,
    whitespace: whitespace.count ?? 0,
    lapsed: lapsed.count ?? 0,
  } as Record<WorklistKey, number>;
}
