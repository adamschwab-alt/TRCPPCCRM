import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Data-freshness snapshot for the top-bar status pill and the Admin sync card.
 *
 * Everything goes through the RLS-scoped server client, so a rep sees the span
 * and record count of THEIR book while staff see the whole dataset. The as-of
 * cutoff (the analytic month-end the metrics are computed against) is global.
 */
export type DataCoverage = {
  asOf: string | null; // app_settings.as_of_date — analytic cutoff
  spanStart: string | null; // earliest transaction date present
  spanEnd: string | null; // latest transaction date present
  months: number | null; // distinct calendar months spanned
  txnCount: number; // visible transaction rows
  lastRefreshed: string | null; // last successful sync timestamp
  lastInserted: number | null; // rows added on that sync
};

function monthsBetween(start: string, end: string): number {
  const a = new Date(start + 'T00:00:00Z');
  const b = new Date(end + 'T00:00:00Z');
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1
  );
}

export async function getDataCoverage(): Promise<DataCoverage> {
  const supabase = await createClient();

  const [settings, earliest, latest, count, lastSync] = await Promise.all([
    supabase.from('app_settings').select('as_of_date,updated_at').eq('id', true).maybeSingle(),
    supabase
      .from('sales_transactions')
      .select('date')
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sales_transactions')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('sales_transactions').select('id', { count: 'exact', head: true }),
    supabase
      .from('audit_log')
      .select('created_at,diff')
      .eq('action', 'sync')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const spanStart = earliest.data?.date ?? null;
  const spanEnd = latest.data?.date ?? null;
  const diff = (lastSync.data?.diff ?? {}) as { inserted?: number };

  return {
    asOf: settings.data?.as_of_date ?? null,
    spanStart,
    spanEnd,
    months: spanStart && spanEnd ? monthsBetween(spanStart, spanEnd) : null,
    txnCount: count.count ?? 0,
    // Audit log is the richest source, but its backing SQL function may not be
    // installed; every sync also stamps app_settings.updated_at, so fall back
    // to that rather than showing "Never" after a successful refresh.
    lastRefreshed: lastSync.data?.created_at ?? settings.data?.updated_at ?? null,
    lastInserted: typeof diff.inserted === 'number' ? diff.inserted : null,
  };
}
