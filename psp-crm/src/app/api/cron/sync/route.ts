import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { performSync } from '@/lib/sync/run-sync';

export const dynamic = 'force-dynamic';
// Full pulls upsert tens of thousands of rows; allow the Pro-plan ceiling (300s).
// Must not exceed the deployment plan's limit or the Vercel build fails.
export const maxDuration = 300;

/**
 * Scheduled live sync. Triggered by Vercel Cron (see vercel.json). Secured by
 * CRON_SECRET: Vercel sends it as `Authorization: Bearer <CRON_SECRET>`.
 * Runs with the service role (no user session), so SUPABASE_SERVICE_ROLE_KEY
 * must be set in the deployment.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const result = await performSync(supabase);
    // Nightly AI-outcome back-fill (blueprint §4) — best-effort, never fails the sync.
    let outcomesFilled = 0;
    try {
      const { backfillRecOutcomes } = await import('@/lib/ai/recs');
      outcomesFilled = await backfillRecOutcomes(supabase);
    } catch {
      /* pre-0009 database or transient error — next night catches up */
    }
    // Nightly DQ snapshot (blueprint Phase 2) — current month, frozen when it closes.
    try {
      const { snapshotDq } = await import('@/lib/dq/queries');
      await snapshotDq(supabase);
    } catch {
      /* pre-0010 database — next night catches up */
    }
    // Month-start forecast freeze (blueprint Phase 4) — write-once per period.
    try {
      const { snapshotForecast } = await import('@/lib/forecast/queries');
      await snapshotForecast(supabase);
    } catch {
      /* pre-0011 database — next night catches up */
    }
    return NextResponse.json({ ok: true, result, outcomesFilled });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'sync failed' },
      { status: 500 },
    );
  }
}
