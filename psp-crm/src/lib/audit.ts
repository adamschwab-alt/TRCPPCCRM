import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Append an audit-log entry. Best-effort: if the log_audit function isn't
 * present yet (migration 0006 not run), it silently no-ops so writes never fail.
 */
export async function logAudit(
  supabase: SupabaseClient<Database>,
  action: string,
  entity: string,
  entityId: string | null,
  diff?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.rpc('log_audit', {
      p_action: action,
      p_entity: entity,
      p_entity_id: entityId ?? '',
      p_diff: diff ?? null,
    });
  } catch {
    /* logging must never break the actual write */
  }
}
