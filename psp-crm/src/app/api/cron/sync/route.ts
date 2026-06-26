import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { performSync } from '@/lib/sync/run-sync';

export const dynamic = 'force-dynamic';
// No explicit maxDuration — setting one above the deployment plan's limit fails
// the Vercel build. Use incremental syncs (ACUMATICA_ODATA_MODIFIED_FIELD) to
// keep runs well within the default. On Pro you can add `export const maxDuration`.

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
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'sync failed' },
      { status: 500 },
    );
  }
}
