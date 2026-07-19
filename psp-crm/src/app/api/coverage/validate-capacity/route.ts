import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { validateTransitionCapacity } from '@/lib/coverage/routing';

/**
 * POST /api/coverage/validate-capacity
 * Validate if assigning a branch to a rep would overload them.
 * Returns capacity info and warning/error if overloaded.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole('admin', 'manager');
    const supabase = await createClient();

    const { repId } = await req.json();

    if (!repId) {
      return NextResponse.json({ error: 'repId required' }, { status: 400 });
    }

    const validation = await validateTransitionCapacity(supabase, repId, 'go-forward');

    return NextResponse.json({
      repName: validation.repName,
      currentUtilization: validation.currentUtilization,
      afterTransitionUtilization: validation.afterTransitionUtilization,
      overloaded: validation.overloaded,
      capacityRemaining: validation.capacityRemaining,
      message: validation.message,
    });
  } catch (error) {
    console.error('[coverage] validate-capacity error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 },
    );
  }
}
