import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { performSync } from '@/lib/sync/run-sync';

export const dynamic = 'force-dynamic';
// Interactive "Refresh now" can upsert tens of thousands of rows on a full pull.
// A dedicated route handler gets its own function budget (Pro ceiling 300s),
// so the toolbar button works from any page — Server Action timeouts are tied
// to the host page, which the toolbar can't control.
export const maxDuration = 300;

/**
 * Staff-triggered live sync from the top-bar "Refresh now" control. Runs as the
 * caller's RLS session (staff may write transactions). Reps are rejected — a
 * full re-sync changes everyone's numbers.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });

  // The proxy's MFA gate skips /api routes, so enforce aal2 here — a stolen
  // password without the TOTP device must not be able to trigger a sync.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') {
    return NextResponse.json({ ok: false, error: 'Two-factor verification required.' }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    return NextResponse.json(
      { ok: false, error: 'Only managers and admins can refresh the data feed.' },
      { status: 403 },
    );
  }

  try {
    const result = await performSync(supabase);
    revalidatePath('/', 'layout');
    return NextResponse.json({ ok: true, message: result.message });
  } catch (e) {
    console.error('[api/sync] refresh failed:', e);
    // DOMExceptions (e.g. fetch timeouts) are not `instanceof Error` in Node —
    // extract a message from whatever shape arrived so the UI shows the cause.
    const msg =
      e instanceof Error
        ? e.message
        : ((e as { message?: string } | null)?.message ?? String(e));
    return NextResponse.json({ ok: false, error: msg || 'Refresh failed' }, { status: 500 });
  }
}
