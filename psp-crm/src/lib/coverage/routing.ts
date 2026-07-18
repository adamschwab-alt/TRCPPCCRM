import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoutingType } from '@/types/database';

/**
 * Evaluate which rep should handle a contact tier touch based on routing rules.
 * Returns the assigned rep ID and routing type used.
 */
export async function routeTierTouch(
  supabase: SupabaseClient,
  contactTierId: string,
): Promise<{
  assignedRepId: string | null;
  routing: RoutingType;
  reason: string;
}> {
  // Get the contact tier and its routing rule
  const { data: tier, error: tierError } = await supabase
    .from('contact_tiers')
    .select('*, contacts(branch_id, account_id)')
    .eq('id', contactTierId)
    .single();

  if (tierError) throw tierError;
  if (!tier) return { assignedRepId: null, routing: '—', reason: 'Contact tier not found' };

  const routing = tier.routing as RoutingType;
  const accountId = tier.account_id;

  // Route based on the tier's routing rule
  switch (routing) {
    case 'Senior PS Leadership':
      // Routes to executive team pool; no specific rep assigned
      return {
        assignedRepId: null,
        routing,
        reason: 'Executive team handles this tier',
      };

    case 'Territory Rep': {
      // Find the territory rep for this account
      // Territory reps are typically reps who own branches in the account
      const { data: branches } = await supabase
        .from('branches')
        .select('owner_id')
        .eq('account_id', accountId)
        .not('owner_id', 'is', null);

      // Use the owner of the first branch as the territory rep
      const territoryRepId = branches?.[0]?.owner_id || null;

      return {
        assignedRepId: territoryRepId,
        routing,
        reason: territoryRepId ? 'Territory rep assigned' : 'No territory rep found',
      };
    }

    case 'Defer to Branch': {
      // Defer to the specific branch's owner
      if (!tier.contacts?.branch_id) {
        return {
          assignedRepId: null,
          routing,
          reason: 'No branch specified; cannot defer',
        };
      }

      const { data: branch } = await supabase
        .from('branches')
        .select('owner_id')
        .eq('id', tier.contacts.branch_id)
        .single();

      return {
        assignedRepId: branch?.owner_id || null,
        routing,
        reason: branch?.owner_id ? 'Branch owner assigned' : 'Branch has no owner',
      };
    }

    case 'Through District': {
      // Route to district manager or district sales manager
      // Find the district this branch belongs to
      const { data: branch } = await supabase
        .from('branches')
        .select('district_id')
        .eq('id', tier.contacts?.branch_id || '')
        .single();

      if (!branch?.district_id) {
        return {
          assignedRepId: null,
          routing,
          reason: 'Branch has no district assigned',
        };
      }

      // Get DM or DSM from district (prefer DM, fall back to DSM)
      const { data: district } = await supabase
        .from('districts')
        .select('dm_profile_id, dsm_profile_id')
        .eq('id', branch.district_id)
        .single();

      const districtRep = district?.dm_profile_id || district?.dsm_profile_id;

      return {
        assignedRepId: districtRep || null,
        routing,
        reason: districtRep ? 'District manager/sales manager assigned' : 'No DM/DSM found',
      };
    }

    case '—':
      return {
        assignedRepId: null,
        routing,
        reason: 'Routing undefined (—)',
      };

    default:
      return {
        assignedRepId: null,
        routing: '—',
        reason: `Unknown routing type: ${routing}`,
      };
  }
}

/**
 * Evaluate whether a planned transition would overload the new rep.
 * Returns capacity info and a boolean flag indicating if the transition is safe.
 */
export async function validateTransitionCapacity(
  supabase: SupabaseClient,
  newRepId: string,
  scenario: 'current' | 'go-forward' = 'go-forward',
): Promise<{
  repName: string | null;
  currentUtilization: number;
  afterTransitionUtilization: number;
  overloaded: boolean;
  capacityRemaining: number;
  message: string;
}> {
  // Get the new rep's current workload
  const { data: workload, error: workloadError } = await supabase
    .from('v_rep_workload')
    .select('rep_name, total_load_yr, capacity_per_rep, utilization_pct')
    .eq('rep_id', newRepId)
    .single();

  if (workloadError) {
    return {
      repName: null,
      currentUtilization: 0,
      afterTransitionUtilization: 0,
      overloaded: true,
      capacityRemaining: 0,
      message: 'Could not fetch workload data',
    };
  }

  if (!workload) {
    return {
      repName: null,
      currentUtilization: 0,
      afterTransitionUtilization: 0,
      overloaded: true,
      capacityRemaining: 0,
      message: 'Rep has no workload data (may be new or inactive)',
    };
  }

  // Estimate new load after transition
  // Average branch adds ~2-4 calls/yr depending on account size
  // For conservative validation, assume +3 calls/yr per branch
  const estimatedBranchCalls = 3;
  const newTotalLoad = workload.total_load_yr + estimatedBranchCalls;
  const newUtilization = (newTotalLoad / workload.capacity_per_rep) * 100;
  const capacityRemaining = Math.max(0, workload.capacity_per_rep - newTotalLoad);

  const overloaded = newUtilization > 110;
  const atRisk = newUtilization > 95;

  let message = `${workload.rep_name} would be at ${Math.round(newUtilization)}% utilization`;
  if (overloaded) {
    message += ` — OVERLOADED (>110%)`;
  } else if (atRisk) {
    message += ` — AT RISK (95-110%)`;
  } else {
    message += ` — OK`;
  }

  return {
    repName: workload.rep_name,
    currentUtilization: workload.utilization_pct,
    afterTransitionUtilization: Math.round(newUtilization * 10) / 10,
    overloaded,
    capacityRemaining,
    message,
  };
}

/**
 * Find the best rep to assign a branch to (for load balancing).
 * Returns the rep with the lowest current utilization.
 */
export async function findBestRepForBranch(
  supabase: SupabaseClient,
  excludeRepId?: string,
): Promise<{
  repId: string;
  repName: string;
  utilization: number;
  availableCapacity: number;
}[]> {
  const { data: workload, error } = await supabase
    .from('v_rep_workload')
    .select('rep_id, rep_name, utilization_pct, total_load_yr, capacity_per_rep')
    .eq('scenario', 'Current')
    .order('utilization_pct');

  if (error) throw error;

  return (workload || [])
    .filter((w) => !excludeRepId || w.rep_id !== excludeRepId)
    .map((w) => ({
      repId: w.rep_id,
      repName: w.rep_name,
      utilization: w.utilization_pct,
      availableCapacity: w.capacity_per_rep - w.total_load_yr,
    }));
}

/**
 * Get routing summary for an account (how each tier is routed).
 */
export async function getAccountRoutingSummary(
  supabase: SupabaseClient,
  accountId: string,
) {
  const { data: tiers, error } = await supabase
    .from('contact_tiers')
    .select('tier, routing, psp_owner_type, cadence_touches_yr')
    .eq('account_id', accountId);

  if (error) throw error;

  // PostgREST can't GROUP BY from the client; aggregate here instead.
  const groups = new Map<
    string,
    (typeof tiers extends (infer T)[] | null ? T : never) & { count: number }
  >();
  for (const t of tiers || []) {
    const key = `${t.tier}|${t.routing}|${t.psp_owner_type}|${t.cadence_touches_yr}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { ...t, count: 1 });
  }
  return [...groups.values()];
}
