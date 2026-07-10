import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiRecommendationRow, Database, RecStatus } from '@/types/database';
import { RISK_RULES_VERSION } from './risk';

type Db = SupabaseClient<Database>;

export const NBA_RULES_VERSION = 'rules-v1'; // My Day scoring (wiring cadence × $ at stake)

export type RecRef = { id: string; status: RecStatus };

/**
 * Log today's next-best-action queue (top N) as shown recommendations — one row
 * per branch per day per rep. Re-viewing the same day bumps shown_count instead
 * of duplicating, so "ignored" (shown repeatedly, never acted) is measurable.
 * Returns branch_id → recommendation ref so the UI can wire accept/dismiss.
 */
export async function logNbaShown(
  supabase: Db,
  userId: string,
  items: { branchId: string; accountId: string; action: string; reason: string; score: number }[],
): Promise<Map<string, RecRef>> {
  const out = new Map<string, RecRef>();
  if (items.length === 0) return out;
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from('ai_recommendations')
    .select('id,branch_id,status,shown_count')
    .eq('user_id', userId)
    .eq('type', 'next_best_action')
    .gte('shown_at', today + 'T00:00:00Z');

  const byBranch = new Map((existing ?? []).map((r) => [r.branch_id, r]));
  const toInsert: Partial<AiRecommendationRow>[] = [];
  const toBump: string[] = [];

  for (const it of items) {
    const ex = byBranch.get(it.branchId);
    if (ex) {
      out.set(it.branchId, { id: ex.id, status: ex.status });
      if (ex.status === 'shown') toBump.push(ex.id);
    } else {
      toInsert.push({
        type: 'next_best_action',
        user_id: userId,
        branch_id: it.branchId,
        account_id: it.accountId,
        recommended_action: it.action,
        reason: it.reason,
        score: it.score,
        model_version: NBA_RULES_VERSION,
      });
    }
  }

  if (toInsert.length > 0) {
    const { data } = await supabase
      .from('ai_recommendations')
      .insert(toInsert)
      .select('id,branch_id,status');
    for (const r of data ?? []) if (r.branch_id) out.set(r.branch_id, { id: r.id, status: r.status });
  }
  for (const id of toBump) {
    // best-effort; shown_count drift is non-critical
    const ex = (existing ?? []).find((e) => e.id === id);
    await supabase
      .from('ai_recommendations')
      .update({ shown_count: (ex?.shown_count ?? 1) + 1 })
      .eq('id', id);
  }
  return out;
}

/** Log today's deal-risk flags for the viewing user — one row per opp per day. */
export async function logRiskShown(
  supabase: Db,
  userId: string,
  items: { opportunityId: string; accountId: string | null; label: string; detail: string; score: number }[],
): Promise<Map<string, RecRef>> {
  const out = new Map<string, RecRef>();
  if (items.length === 0) return out;
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from('ai_recommendations')
    .select('id,opportunity_id,status')
    .eq('user_id', userId)
    .eq('type', 'deal_risk')
    .gte('shown_at', today + 'T00:00:00Z');
  const byOpp = new Map((existing ?? []).map((r) => [r.opportunity_id, r]));

  const toInsert = items
    .filter((it) => !byOpp.has(it.opportunityId))
    .map((it) => ({
      type: 'deal_risk' as const,
      user_id: userId,
      opportunity_id: it.opportunityId,
      account_id: it.accountId,
      recommended_action: it.label,
      reason: it.detail,
      score: it.score,
      model_version: RISK_RULES_VERSION,
    }));
  if (toInsert.length > 0) {
    const { data } = await supabase
      .from('ai_recommendations')
      .insert(toInsert)
      .select('id,opportunity_id,status');
    for (const r of data ?? [])
      if (r.opportunity_id) out.set(r.opportunity_id, { id: r.id, status: r.status });
  }
  for (const [oppId, r] of byOpp) if (oppId) out.set(oppId, { id: r.id, status: r.status });
  return out;
}

/**
 * Nightly outcome back-fill (runs with the service role from the cron):
 * for recommendations past their 28-day window with no outcome yet, record
 * what actually happened — the raw material for accepted-vs-ignored analysis.
 */
export async function backfillRecOutcomes(admin: Db): Promise<number> {
  const cutoff = new Date(Date.now() - 28 * 86_400_000).toISOString();
  const { data: recs } = await admin
    .from('ai_recommendations')
    .select('id,type,branch_id,opportunity_id,shown_at,status')
    .is('outcome', null)
    .lt('shown_at', cutoff)
    .in('type', ['next_best_action', 'deal_risk'])
    .limit(500);
  if (!recs || recs.length === 0) return 0;

  let updated = 0;
  for (const rec of recs) {
    const windowEnd = new Date(new Date(rec.shown_at).getTime() + 28 * 86_400_000).toISOString();
    const outcome: Record<string, unknown> = {};

    if (rec.type === 'next_best_action' && rec.branch_id) {
      const { data: orders } = await admin
        .from('sales_transactions')
        .select('net_sale')
        .eq('branch_id', rec.branch_id)
        .neq('status', 'Canceled')
        .gte('date', rec.shown_at.slice(0, 10))
        .lte('date', windowEnd.slice(0, 10));
      const total = (orders ?? []).reduce((s, o) => s + o.net_sale, 0);
      outcome.order_within_28d = (orders ?? []).length > 0;
      outcome.order_amount = Math.round(total);
    }

    if (rec.type === 'deal_risk' && rec.opportunity_id) {
      const { data: moves } = await admin
        .from('opportunity_stage_history')
        .select('field,old_value,new_value,changed_at')
        .eq('opportunity_id', rec.opportunity_id)
        .eq('field', 'stage')
        .gt('changed_at', rec.shown_at)
        .lte('changed_at', windowEnd);
      // "Advanced" = moved UP the funnel. A slide from Verbal back to Quoted
      // isn't progress, so compare stage ranks rather than "wasn't Lost".
      const rank: Record<string, number> = { Qualified: 1, Quoted: 2, Verbal: 3, Won: 4 };
      outcome.stage_advanced = (moves ?? []).some(
        (m) =>
          m.new_value != null &&
          m.old_value != null &&
          (rank[m.new_value] ?? 0) > (rank[m.old_value] ?? 0),
      );
      outcome.closed_lost = (moves ?? []).some((m) => m.new_value === 'Lost');
    }

    const { error } = await admin.from('ai_recommendations').update({ outcome }).eq('id', rec.id);
    if (!error) updated++;
  }
  return updated;
}
