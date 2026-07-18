import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DistrictRow,
  ContactTierRow,
  PlannedChangeRow,
  RepWorkloadRow,
  AccountInvestmentRow,
  DistrictCoverageRow,
} from '@/types/database';
import { fetchAll } from '@/lib/supabase/fetch-all';

/**
 * Get all districts for an account. Includes DM/DSM info and branch count.
 */
export async function getAccountDistricts(
  supabase: SupabaseClient,
  accountId: string,
): Promise<DistrictRow[]> {
  const { data, error } = await supabase
    .from('districts')
    .select('*')
    .eq('account_id', accountId)
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Get a single district with related info.
 */
export async function getDistrict(
  supabase: SupabaseClient,
  districtId: string,
): Promise<DistrictRow | null> {
  const { data, error } = await supabase
    .from('districts')
    .select('*')
    .eq('id', districtId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data || null;
}

/**
 * Get all contact tiers for an account. Includes contact info and routing.
 */
export async function getAccountContactTiers(
  supabase: SupabaseClient,
  accountId: string,
): Promise<ContactTierRow[]> {
  const { data, error } = await supabase
    .from('contact_tiers')
    .select('*')
    .eq('account_id', accountId)
    .order('tier, contact_id');

  if (error) throw error;
  return data || [];
}

/**
 * Get contact tiers for a specific contact.
 */
export async function getContactTiers(
  supabase: SupabaseClient,
  contactId: string,
): Promise<ContactTierRow[]> {
  const { data, error } = await supabase
    .from('contact_tiers')
    .select('*')
    .eq('contact_id', contactId)
    .order('account_id, tier');

  if (error) throw error;
  return data || [];
}

/**
 * Get rep workload for all reps or a specific rep.
 * Shows branch calls, tier touches, total load, and utilization % vs 420-call capacity.
 */
export async function getRepWorkload(
  supabase: SupabaseClient,
  repId?: string,
): Promise<RepWorkloadRow[]> {
  let query = supabase.from('v_rep_workload').select('*');

  if (repId) {
    query = query.eq('rep_id', repId);
  }

  const { data, error } = await query.order('rep_name');

  if (error) throw error;
  return data || [];
}

/**
 * Get total touches by account for coverage investment analysis.
 */
export async function getAccountInvestment(
  supabase: SupabaseClient,
  accountId?: string,
): Promise<AccountInvestmentRow[]> {
  let query = supabase.from('v_account_investment').select('*');

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query.order('total_touches_yr', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get United Rentals district-level coverage (DM, DSM, branches, calls, routing).
 */
export async function getUnitedDistrictCoverage(
  supabase: SupabaseClient,
): Promise<DistrictCoverageRow[]> {
  const { data, error } = await supabase
    .from('v_district_coverage')
    .select('*')
    .eq('account_name', 'United Rentals')
    .order('district_name');

  if (error) throw error;
  return data || [];
}

/**
 * Get planned rep transitions (staged changes awaiting execution).
 */
export async function getPlannedChanges(
  supabase: SupabaseClient,
  filters?: {
    branchId?: string;
    status?: 'pending' | 'scheduled' | 'completed' | 'cancelled';
    scheduledAfter?: Date;
  },
): Promise<PlannedChangeRow[]> {
  let query = supabase.from('planned_changes').select('*');

  if (filters?.branchId) {
    query = query.eq('branch_id', filters.branchId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.scheduledAfter) {
    query = query.gte('scheduled_date', filters.scheduledAfter.toISOString().split('T')[0]);
  }

  const { data, error } = await query.order('scheduled_date');

  if (error) throw error;
  return data || [];
}

/**
 * Get planned changes for a specific rep (as new owner).
 */
export async function getRepTransitionsIn(
  supabase: SupabaseClient,
  repId: string,
): Promise<PlannedChangeRow[]> {
  const { data, error } = await supabase
    .from('planned_changes')
    .select('*')
    .eq('new_owner_profile_id', repId)
    .eq('status', 'pending')
    .order('scheduled_date');

  if (error) throw error;
  return data || [];
}

/**
 * Get scheduled touches for a contact tier.
 * Filters to upcoming touches if touchesAfter is provided.
 */
export async function getScheduledTouches(
  supabase: SupabaseClient,
  contactTierId: string,
  touchesAfter?: Date,
) {
  let query = supabase.from('scheduled_touches').select('*').eq('contact_tier_id', contactTierId);

  if (touchesAfter) {
    query = query.gte('scheduled_date', touchesAfter.toISOString().split('T')[0]);
  }

  const { data, error } = await query.order('scheduled_date');

  if (error) throw error;
  return data || [];
}

/**
 * Get summary of rep transitions for an account.
 * Shows what's scheduled, who's inheriting what, and effective dates.
 */
export async function getAccountTransitionSummary(
  supabase: SupabaseClient,
  accountId: string,
) {
  // Get all branches for the account
  const { data: branches, error: branchError } = await supabase
    .from('branches')
    .select('id, name, owner_id')
    .eq('account_id', accountId);

  if (branchError) throw branchError;
  if (!branches || branches.length === 0) return [];

  const branchIds = branches.map((b) => b.id);

  // Get planned changes for these branches
  const changes = await fetchAll<PlannedChangeRow>((from, to) =>
    supabase
      .from('planned_changes')
      .select('*')
      .in('branch_id', branchIds)
      .eq('status', 'pending')
      .range(from, to),
  );

  return changes;
}

/**
 * Analyze rep capacity utilization across the book.
 * Returns reps sorted by utilization (highest first).
 * Useful for capacity rebalancing decisions.
 */
export async function getCapacityAnalysis(supabase: SupabaseClient) {
  const workload = await getRepWorkload(supabase);

  return workload
    .map((w) => ({
      ...w,
      available_calls: Math.max(0, w.capacity_per_rep - w.total_load_yr),
      overloaded: w.utilization_pct > 100,
      at_risk: w.utilization_pct > 95,
    }))
    .sort((a, b) => b.utilization_pct - a.utilization_pct);
}
