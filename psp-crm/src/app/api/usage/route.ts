import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Presence heartbeat from UsageTracker (one ping per visible minute + one per
 * navigation). Writes only the CALLER's own row — RLS enforces user_id =
 * auth.uid() — so unlike /api/sync this needs no aal2/role gate; an
 * unauthenticated ping is simply dropped.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let path: string | null = null;
  try {
    const body = (await req.json()) as { path?: unknown };
    if (typeof body.path === 'string') path = body.path.slice(0, 200);
  } catch {
    /* body optional */
  }

  // Errors (e.g. migration 0013 not run yet) come back in the result object —
  // deliberately ignored; presence pings must never surface failures to the UI.
  await supabase.from('usage_events').insert({ user_id: user.id, path });
  return NextResponse.json({ ok: true });
}
