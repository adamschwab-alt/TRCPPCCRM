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
 * Delete sales rows by id in URL-safe chunks. PostgREST puts the id list in the
 * request URL, so a big `.in(...)` overflows it and returns 400 Bad Request.
 * 100 ids per request keeps the URL small; a little concurrency keeps it quick.
 */
export async function deleteSalesByIds(
  supabase: SupabaseClient<Database>,
  ids: string[],
): Promise<void> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const CONCURRENCY = 6;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const results = await Promise.all(
      chunks.slice(i, i + CONCURRENCY).map((c) =>
        supabase
          .from('sales_transactions')
          .delete()
          .in('id', c),
      ),
    );
    for (const r of results) if (r.error) throw new Error(r.error.message);
  }
}

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

/**
 * One-click clean rebuild — the cure for duplicated sales rows that a plain sync
 * can't fix (sync only ADDS rows; it never removes the stale copies from an
 * earlier seed).
 *
 * Order is deliberately pull-first-then-replace so it is SAFE: we only delete the
 * existing sales after a full Acumatica pull has succeeded and passed a sanity
 * floor. Accounts, branches, owners, pipeline, and activities are untouched —
 * only sales_transactions is rebuilt, leaving exactly one clean copy of each sale.
 */
export async function performRebuild(supabase: SupabaseClient<Database>): Promise<SyncResult> {
  // 1) Pull first. Nothing is deleted until we have a good dataset in hand.
  const dataset = await new AcumaticaODataAdapter().load();
  if (dataset.transactions.length < 5000) {
    return {
      ok: true,
      empty: true,
      message: `Aborted for safety: the Acumatica feed returned only ${dataset.transactions.length} rows (expected tens of thousands). Nothing was deleted — check the connection and try again.`,
    };
  }

  // 2) Clear existing sales. IDs go in the request URL, so they must be sent in
  //    small chunks — thousands at once overflows the URL and returns 400.
  let deleted = 0;
  for (;;) {
    const { data: ids, error: selErr } = await supabase
      .from('sales_transactions')
      .select('id')
      .limit(2000);
    if (selErr) throw new Error(`Could not read existing sales to clear them: ${selErr.message}`);
    if (!ids || ids.length === 0) break;
    await deleteSalesByIds(
      supabase,
      ids.map((r) => r.id),
    );
    deleted += ids.length;
  }

  // 3) Load the single clean copy.
  const summary = await runImport(supabase, dataset);
  await logAudit(supabase, 'rebuild', 'sales_transactions', null, {
    removed: deleted,
    loaded: summary.transactions.inserted,
    as_of: summary.asOfDate,
  });

  return {
    ok: true,
    empty: false,
    summary,
    message: `Rebuilt from Acumatica: removed ${deleted} old rows, loaded ${summary.transactions.inserted} clean rows. Data is current through ${summary.asOfDate}.`,
  };
}
