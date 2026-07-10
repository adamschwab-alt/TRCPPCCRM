import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { fetchAll, chunkIds } from '@/lib/supabase/fetch-all';
import { riskFlags, riskScore, type RiskFlag } from '@/lib/ai/risk';
import type { OpportunityRow, StageWinProbRow, TargetsRow } from '@/types/database';

export type EnrichedOpportunity = OpportunityRow & {
  account_name: string | null;
  branch_name: string | null;
};

export type AccountOption = { id: string; name: string };
export type BranchOption = { id: string; account_id: string; name: string };
export type ContactPickOption = { id: string; account_id: string; name: string; title: string | null };

async function nameMaps() {
  const supabase = await createClient();
  // fetchAll: both tables exceed PostgREST's 1000-row cap at real book size —
  // a truncated map would render blank account/branch names on later rows.
  const [accounts, branches] = await Promise.all([
    fetchAll<AccountOption>((from, to) =>
      supabase.from('accounts').select('id,name').order('name').order('id').range(from, to),
    ),
    fetchAll<BranchOption>((from, to) =>
      supabase.from('branches').select('id,account_id,name').order('name').order('id').range(from, to),
    ),
  ]);
  return { accounts, branches };
}

export async function getPipelineOptions() {
  const supabase = await createClient();
  const [maps, contacts] = await Promise.all([
    nameMaps(),
    // Tolerate a database that hasn't run migration 0007 yet (no contacts table).
    fetchAll<ContactPickOption>((from, to) =>
      supabase.from('contacts').select('id,account_id,name,title').order('name').order('id').range(from, to),
    ).catch(() => [] as ContactPickOption[]),
  ]);
  return { ...maps, contacts };
}

export async function getOpportunities(): Promise<EnrichedOpportunity[]> {
  const supabase = await createClient();
  const [opps, { accounts, branches }] = await Promise.all([
    fetchAll<OpportunityRow>((from, to) =>
      supabase
        .from('opportunities')
        .select('*')
        .order('expected_close', { ascending: true })
        .order('id')
        .range(from, to),
    ),
    nameMaps(),
  ]);
  const aName = new Map(accounts.map((a) => [a.id, a.name]));
  const bName = new Map(branches.map((b) => [b.id, b.name]));
  return opps.map((o) => ({
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

// ── Deal-risk flags (rules-v1) ───────────────────────────────────────────────
export type OppRisk = { flags: RiskFlag[]; score: number };

/**
 * Compute risk flags for open opportunities using stage history for
 * days-in-stage and close-date slips. Tolerates a pre-0008 database (no
 * history) by falling back to created_at and zero slips.
 */
export async function getOppRisk(opps: EnrichedOpportunity[]): Promise<Record<string, OppRisk>> {
  const open = opps.filter((o) => o.stage !== 'Won' && o.stage !== 'Lost');
  if (open.length === 0) return {};
  const supabase = await createClient();

  // Chunk the id list (.in() rides in the URL — hundreds of uuids overflow it)
  // and page each chunk; tolerate a pre-0008 database with no history table.
  type HistRow = {
    opportunity_id: string;
    field: string;
    old_value: string | null;
    new_value: string | null;
    changed_at: string;
  };
  const hist: HistRow[] = [];
  for (const chunk of chunkIds(open.map((o) => o.id))) {
    const rows = await fetchAll<HistRow>((from, to) =>
      supabase
        .from('opportunity_stage_history')
        .select('opportunity_id,field,old_value,new_value,changed_at')
        .in('opportunity_id', chunk)
        .order('id')
        .range(from, to),
    ).catch(() => [] as HistRow[]);
    hist.push(...rows);
  }

  const lastStageChange = new Map<string, string>();
  const slips = new Map<string, number>();
  for (const h of hist) {
    if (h.field === 'stage' || h.field === 'created') {
      const prev = lastStageChange.get(h.opportunity_id);
      if (!prev || h.changed_at > prev) lastStageChange.set(h.opportunity_id, h.changed_at);
    }
    if (h.field === 'expected_close' && h.old_value && h.new_value && h.new_value > h.old_value) {
      slips.set(h.opportunity_id, (slips.get(h.opportunity_id) ?? 0) + 1);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const out: Record<string, OppRisk> = {};
  for (const o of open) {
    const since = lastStageChange.get(o.id) ?? o.created_at;
    const daysInStage = Math.floor((now - new Date(since).getTime()) / 86_400_000);
    const flags = riskFlags({ opp: o, daysInStage, slipCount: slips.get(o.id) ?? 0 }, today);
    if (flags.length > 0) out[o.id] = { flags, score: riskScore(flags) };
  }
  return out;
}
