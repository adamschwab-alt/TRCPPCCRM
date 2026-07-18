import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactTier, PspOwnerType, RoutingType, TransitionStatus } from '@/types/database';
import { logAudit } from '@/lib/audit';

/**
 * Create or update a district.
 */
export async function upsertDistrict(
  supabase: SupabaseClient,
  accountId: string,
  name: string,
  dmProfileId?: string | null,
  dsmProfileId?: string | null,
  regionText?: string | null,
) {
  const { data, error } = await supabase
    .from('districts')
    .upsert(
      {
        account_id: accountId,
        name,
        dm_profile_id: dmProfileId || null,
        dsm_profile_id: dsmProfileId || null,
        region_text: regionText || null,
      },
      {
        onConflict: 'account_id,name',
      },
    )
    .select()
    .single();

  if (error) throw error;

  await logAudit(supabase, 'upsert_district', 'district', data.id, {
    account_id: accountId,
    name,
    dm_profile_id: dmProfileId,
    dsm_profile_id: dsmProfileId,
  });

  return data;
}

/**
 * Link a branch to a district (or unlink if districtId is null).
 */
export async function updateBranchDistrict(
  supabase: SupabaseClient,
  branchId: string,
  districtId: string | null,
) {
  const { data: oldBranch } = await supabase
    .from('branches')
    .select('district_id')
    .eq('id', branchId)
    .single();

  const { data, error } = await supabase
    .from('branches')
    .update({ district_id: districtId })
    .eq('id', branchId)
    .select()
    .single();

  if (error) throw error;

  await logAudit(supabase, 'update_branch_district', 'branch', branchId, {
    old_district_id: oldBranch?.district_id || null,
    new_district_id: districtId,
  });

  return data;
}

/**
 * Create or update a contact tier entry (routing, cadence, PSP owner).
 */
export async function upsertContactTier(
  supabase: SupabaseClient,
  contactId: string,
  accountId: string,
  tier: ContactTier,
  cadencePerYear: number,
  routing: RoutingType,
  pspOwnerType: PspOwnerType,
  notes?: string,
) {
  const { data, error } = await supabase
    .from('contact_tiers')
    .upsert(
      {
        contact_id: contactId,
        account_id: accountId,
        tier,
        cadence_touches_yr: cadencePerYear,
        routing,
        psp_owner_type: pspOwnerType,
        notes: notes || null,
      },
      {
        onConflict: 'contact_id,account_id,tier',
      },
    )
    .select()
    .single();

  if (error) throw error;

  await logAudit(supabase, 'upsert_contact_tier', 'contact_tier', data.id, {
    contact_id: contactId,
    account_id: accountId,
    tier,
    cadence_touches_yr: cadencePerYear,
    routing,
    psp_owner_type: pspOwnerType,
  });

  return data;
}

/**
 * Stage a rep transition (creates a planned_change record).
 * The transition will be executed by a cron job on the scheduled_date.
 */
export async function createPlannedChange(
  supabase: SupabaseClient,
  branchId: string,
  newOwnerProfileId: string,
  scheduledDate: Date,
  reason: string,
  notes?: string,
) {
  // Get current branch owner
  const { data: branch } = await supabase
    .from('branches')
    .select('owner_id')
    .eq('id', branchId)
    .single();

  const { data, error } = await supabase
    .from('planned_changes')
    .insert({
      branch_id: branchId,
      current_owner_profile_id: branch?.owner_id || null,
      new_owner_profile_id: newOwnerProfileId,
      scheduled_date: scheduledDate.toISOString().split('T')[0],
      reason,
      notes: notes || null,
      status: 'pending' as const,
      created_by_profile_id: (await supabase.auth.getUser()).data.user?.id || '',
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit(supabase, 'create_planned_change', 'planned_change', data.id, {
    branch_id: branchId,
    current_owner: branch?.owner_id,
    new_owner: newOwnerProfileId,
    scheduled_date: scheduledDate.toISOString().split('T')[0],
    reason,
  });

  return data;
}

/**
 * Update the status of a planned change (e.g., pending → scheduled → completed).
 */
export async function updatePlannedChangeStatus(
  supabase: SupabaseClient,
  plannedChangeId: string,
  newStatus: TransitionStatus,
  notes?: string,
) {
  const { data, error } = await supabase
    .from('planned_changes')
    .update({
      status: newStatus,
      notes: notes || undefined,
    })
    .eq('id', plannedChangeId)
    .select()
    .single();

  if (error) throw error;

  await logAudit(supabase, 'update_planned_change_status', 'planned_change', plannedChangeId, {
    new_status: newStatus,
    notes,
  });

  return data;
}

/**
 * Cancel a planned transition.
 */
export async function cancelPlannedChange(
  supabase: SupabaseClient,
  plannedChangeId: string,
  reason: string,
) {
  return updatePlannedChangeStatus(supabase, plannedChangeId, 'cancelled', reason);
}

/**
 * Execute a pending planned change (moves branch.owner_id to new_owner_profile_id).
 * Typically called by a cron job when scheduled_date is reached.
 * Validates that new owner won't be overloaded (>110% capacity).
 */
export async function executePlannedChange(
  supabase: SupabaseClient,
  plannedChangeId: string,
): Promise<{ success: boolean; message: string }> {
  // Get the planned change
  const { data: plannedChange, error: fetchError } = await supabase
    .from('planned_changes')
    .select('*')
    .eq('id', plannedChangeId)
    .single();

  if (fetchError) throw fetchError;
  if (!plannedChange) return { success: false, message: 'Planned change not found' };
  if (plannedChange.status !== 'pending')
    return { success: false, message: `Cannot execute ${plannedChange.status} change` };

  // Get the new owner's current workload
  const { data: workload, error: workloadError } = await supabase
    .from('v_rep_workload')
    .select('utilization_pct, total_load_yr, capacity_per_rep')
    .eq('rep_id', plannedChange.new_owner_profile_id)
    .single();

  if (workloadError) {
    console.error('[coverage] workload fetch failed:', workloadError);
    // Continue anyway; workload check is advisory
  }

  if (workload && workload.utilization_pct > 110) {
    return {
      success: false,
      message: `New owner ${plannedChange.new_owner_profile_id} would be ${Math.round(workload.utilization_pct)}% utilized (>110%)`,
    };
  }

  // Update branch owner
  const { error: updateError } = await supabase
    .from('branches')
    .update({ owner_id: plannedChange.new_owner_profile_id })
    .eq('id', plannedChange.branch_id);

  if (updateError) throw updateError;

  // Mark planned change as completed
  await updatePlannedChangeStatus(supabase, plannedChangeId, 'completed', 'Executed automatically');

  await logAudit(supabase, 'execute_planned_change', 'planned_change', plannedChangeId, {
    branch_id: plannedChange.branch_id,
    new_owner: plannedChange.new_owner_profile_id,
    executed_at: new Date().toISOString(),
  });

  return { success: true, message: 'Transition executed' };
}

/**
 * Create a scheduled touch for a contact tier.
 * Links the contact tier to a specific PSP resource and date.
 */
export async function createScheduledTouch(
  supabase: SupabaseClient,
  contactTierId: string,
  assignedToId: string | null,
  scheduledDate: Date,
  touchType: string,
) {
  const { data, error } = await supabase
    .from('scheduled_touches')
    .insert({
      contact_tier_id: contactTierId,
      assigned_to_id: assignedToId,
      scheduled_date: scheduledDate.toISOString().split('T')[0],
      touch_type: touchType,
      outcome_status: 'scheduled',
    })
    .select()
    .single();

  if (error) throw error;

  await logAudit(supabase, 'create_scheduled_touch', 'scheduled_touch', data.id, {
    contact_tier_id: contactTierId,
    assigned_to_id: assignedToId,
    scheduled_date,
    touch_type: touchType,
  });

  return data;
}

/**
 * Mark a scheduled touch as completed and link to actual activity.
 */
export async function completeScheduledTouch(
  supabase: SupabaseClient,
  scheduledTouchId: string,
  activityId: string,
  notes?: string,
) {
  const { data, error } = await supabase
    .from('scheduled_touches')
    .update({
      outcome_status: 'completed',
      activity_id: activityId,
      outcome_notes: notes || null,
    })
    .eq('id', scheduledTouchId)
    .select()
    .single();

  if (error) throw error;

  await logAudit(supabase, 'complete_scheduled_touch', 'scheduled_touch', scheduledTouchId, {
    activity_id: activityId,
    notes,
  });

  return data;
}

/**
 * Reschedule a touch to a new date.
 */
export async function rescheduleTouch(
  supabase: SupabaseClient,
  scheduledTouchId: string,
  newDate: Date,
  reason: string,
) {
  const { data, error } = await supabase
    .from('scheduled_touches')
    .update({
      scheduled_date: newDate.toISOString().split('T')[0],
      outcome_status: 'rescheduled',
      outcome_notes: reason,
    })
    .eq('id', scheduledTouchId)
    .select()
    .single();

  if (error) throw error;

  await logAudit(supabase, 'reschedule_touch', 'scheduled_touch', scheduledTouchId, {
    new_date: newDate.toISOString().split('T')[0],
    reason,
  });

  return data;
}
