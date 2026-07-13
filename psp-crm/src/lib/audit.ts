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
    const { error } = await supabase.rpc('log_audit', {
      p_action: action,
      p_entity: entity,
      p_entity_id: entityId ?? '',
      p_diff: diff ?? null,
    });
    // supabase-js does NOT throw on Postgres errors — it returns them. Without
    // this line a broken audit pipeline (missing function, bad grant) is
    // completely invisible; at least leave the cause in the server logs.
    if (error) console.error(`[audit] log_audit(${action}, ${entity}) failed:`, error.message);
  } catch (e) {
    /* logging must never break the actual write */
    console.error('[audit] log_audit threw:', e);
  }
}
