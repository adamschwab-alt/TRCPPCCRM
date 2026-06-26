// Shared sync core used by the Admin "Sync now" button, the top-bar "Refresh
// data" control, and the nightly Vercel cron. Keeping the load → import → audit
// sequence in one place means all three entry points behave identically.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { runImport, type ImportSummary } from '@/lib/import/run-import';
import { AcumaticaODataAdapter } from '@/lib/adapters/acumatica';
import { logAudit } from '@/lib/audit';

export type SyncResult =
  | { ok: true; empty: true; message: string }
  | { ok: true; empty: false; message: string; summary: ImportSummary };

/**
 * Pull the latest sales from Acumatica and upsert them through the shared,
 * oracle-proven mapping. Idempotent — re-running only adds rows it hasn't seen.
 * The caller supplies the Supabase client so this works both with a user's
 * RLS session (manual buttons) and the service role (cron).
 *
 * @param since optional ISO date for an incremental pull (passed to the adapter).
 */
export async function performSync(
  supabase: SupabaseClient<Database>,
  since?: string,
): Promise<SyncResult> {
  const dataset = await new AcumaticaODataAdapter().load(since);

  if (dataset.transactions.length === 0) {
    return {
      ok: true,
      empty: true,
      message: 'Connected, but the feed returned 0 rows — check the inquiry/endpoint.',
    };
  }

  const summary = await runImport(supabase, dataset);
  await logAudit(supabase, 'sync', 'acumatica', null, {
    inserted: summary.transactions.inserted,
    total: summary.transactions.total,
    as_of: summary.asOfDate,
  });

  return {
    ok: true,
    empty: false,
    summary,
    message: `Synced ${summary.transactions.total} rows: +${summary.transactions.inserted} new, ${summary.transactions.skippedDuplicates} already present. Data is current through ${summary.asOfDate}.`,
  };
}
