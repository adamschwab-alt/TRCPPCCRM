import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OpportunityRow, StageWinProbRow, TargetsRow } from '@/types/database';

export type EnrichedOpportunity = OpportunityRow & {
  account_name: string | null;
  branch_name: string | null;
};

export type AccountOption = { id: string; name: string };
export type BranchOption = { id: string; account_id: string; name: string };

async function nameMaps() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: branches }] = await Promise.all([
    supabase.from('accounts').select('id,name').order('name'),
    supabase.from('branches').select('id,account_id,name').order('name'),
  ]);
  return {
    accounts: (accounts ?? []) as AccountOption[],
    branches: (branches ?? []) as BranchOption[],
  };
}

export async function getPipelineOptions() {
  return nameMaps();
}

export async function getOpportunities(): Promise<EnrichedOpportunity[]> {
  const supabase = await createClient();
  const [{ data: opps }, { accounts, branches }] = await Promise.all([
    supabase.from('opportunities').select('*').order('expected_close', { ascending: true }),
    nameMaps(),
  ]);
  const aName = new Map(accounts.map((a) => [a.id, a.name]));
  const bName = new Map(branches.map((b) => [b.id, b.name]));
  return (opps ?? []).map((o) => ({
    ...o,
    account_name: o.account_id ? (aName.get(o.account_id) ?? null) : null,
    branch_name: o.branch_id ? (bName.get(o.branch_id) ?? null) : null,
  }));
}

export async function getOpportunity(id: string): Promise<OpportunityRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('opportunities').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function getStageWinProb(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from('stage_win_prob').select('*');
  return Object.fromEntries(
    ((data ?? []) as StageWinProbRow[]).map((r) => [r.stage, Number(r.win_prob)]),
  );
}

export async function getTargets(): Promise<TargetsRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('targets').select('*').eq('id', true).maybeSingle();
  return data;
}
