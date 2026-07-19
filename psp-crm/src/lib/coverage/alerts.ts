import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getRepWorkload, getPlannedChanges } from '@/lib/coverage/queries';
import { executePlannedChange } from '@/lib/coverage/mutations';

/**
 * Alert threshold: rep utilization ≥ 95% is "at risk", ≥ 110% is "overloaded"
 */

/**
 * Check all reps for utilization alerts (95%+).
 * Typically called by nightly sync cron.
 */
export async function checkRepUtilizationAlerts(supabase: SupabaseClient) {
  const workload = await getRepWorkload(supabase);

  const alerts = workload.filter((w) => w.utilization_pct >= 95);

  return alerts
    .map((w) => ({
      repId: w.rep_id,
      repName: w.rep_name,
      utilization: w.utilization_pct,
      branchCount: w.branch_count,
      totalLoad: w.total_load_yr,
      capacity: w.capacity_per_rep,
      severity: w.utilization_pct >= 110 ? 'critical' : 'warning',
    }))
    .sort((a, b) => b.utilization - a.utilization);
}

/**
 * Check if any planned transitions would cause overload.
 * Transitions scheduled for a specific date or all pending transitions.
 */
export async function checkTransitionCapacityAlerts(
  supabase: SupabaseClient,
  scheduledAfter?: Date,
) {
  const changes = await getPlannedChanges(supabase, {
    status: 'pending',
    scheduledAfter,
  });

  const alerts = [];

  for (const change of changes) {
    // Get new owner's current workload
    const { data: workload } = await supabase
      .from('v_rep_workload')
      .select('utilization_pct, total_load_yr, capacity_per_rep, rep_name')
      .eq('rep_id', change.new_owner_profile_id)
      .single();

    if (!workload) continue;

    // Estimate impact: +3 calls/yr per branch
    const estimatedNewLoad = workload.total_load_yr + 3;
    const newUtilization = (estimatedNewLoad / workload.capacity_per_rep) * 100;

    if (newUtilization > 110) {
      alerts.push({
        plannedChangeId: change.id,
        branchId: change.branch_id,
        newRepId: change.new_owner_profile_id,
        newRepName: workload.rep_name,
        scheduledDate: change.scheduled_date,
        currentUtilization: workload.utilization_pct,
        projectedUtilization: Math.round(newUtilization * 10) / 10,
        issue: `Would overload rep at ${Math.round(newUtilization)}%`,
      });
    }
  }

  return alerts;
}

/**
 * Execute all pending planned changes whose scheduled_date has arrived.
 * Logs successes and failures; continues on individual failures.
 */
export async function executeScheduledTransitions(
  supabase: SupabaseClient,
  asOfDate: Date = new Date(),
) {
  const today = asOfDate.toISOString().split('T')[0];

  // Get all pending changes due on or before today
  const { data: changes, error } = await supabase
    .from('planned_changes')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_date', today)
    .order('scheduled_date');

  if (error) {
    console.error('[coverage] Failed to fetch pending transitions:', error);
    return { executed: 0, failed: 0, errors: [] };
  }

  if (!changes || changes.length === 0) {
    return { executed: 0, failed: 0, errors: [] };
  }

  let executed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const change of changes) {
    try {
      const result = await executePlannedChange(supabase, change.id);
      if (result.success) {
        executed++;
        console.log(`[coverage] Executed transition for branch ${change.branch_id}`);
      } else {
        failed++;
        errors.push(`Branch ${change.branch_id}: ${result.message}`);
        console.warn(`[coverage] Failed to execute transition: ${result.message}`);
      }
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Branch ${change.branch_id}: ${message}`);
      console.error('[coverage] Transition execution error:', err);
    }
  }

  return { executed, failed, errors };
}

/**
 * Generate a capacity summary report (for admin dashboard).
 * Shows utilization by rep, highlights over/under capacity.
 */
export async function generateCapacitySummary(supabase: SupabaseClient) {
  const workload = await getRepWorkload(supabase);

  const summary = {
    totalReps: workload.length,
    overloaded: 0,
    atRisk: 0,
    healthy: 0,
    totalCapacity: 0,
    totalLoad: 0,
    bookUtilization: 0,
    reps: [] as typeof workload,
  };

  for (const w of workload) {
    if (w.utilization_pct >= 110) {
      summary.overloaded++;
    } else if (w.utilization_pct >= 95) {
      summary.atRisk++;
    } else {
      summary.healthy++;
    }

    summary.totalCapacity += w.capacity_per_rep;
    summary.totalLoad += w.total_load_yr;
  }

  summary.bookUtilization = (summary.totalLoad / summary.totalCapacity) * 100;
  summary.reps = workload;

  return summary;
}

/**
 * Get pending transitions grouped by target rep.
 * Useful for showing each rep's incoming workload.
 */
export async function getPendingTransitionsByRep(supabase: SupabaseClient) {
  const { data: changes, error } = await supabase
    .from('planned_changes')
    .select('*, profiles:new_owner_profile_id(full_name)')
    .eq('status', 'pending')
    .order('scheduled_date');

  if (error) throw error;

  // Group by new_owner_profile_id
  const grouped: Record<
    string,
    Array<typeof changes[0]>
  > = {};

  for (const change of changes || []) {
    if (!grouped[change.new_owner_profile_id]) {
      grouped[change.new_owner_profile_id] = [];
    }
    grouped[change.new_owner_profile_id].push(change);
  }

  return grouped;
}
