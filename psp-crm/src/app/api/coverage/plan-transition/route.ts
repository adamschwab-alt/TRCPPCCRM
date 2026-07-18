import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { createPlannedChange } from '@/lib/coverage/mutations';
import { validateTransitionCapacity } from '@/lib/coverage/routing';

/**
 * POST /api/coverage/plan-transition
 * Stage a rep transition (creates a planned_change record).
 * Optionally validates that new rep won't be overloaded.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole('admin', 'manager');
    const supabase = await createClient();

    const { branchId, newOwnerId, scheduledDate, reason, notes, validateCapacity } =
      await req.json();

    // Validate inputs
    if (!branchId || !newOwnerId || !scheduledDate) {
      return NextResponse.json(
        { error: 'branchId, newOwnerId, and scheduledDate required' },
        { status: 400 },
      );
    }

    // Optional: validate capacity
    if (validateCapacity !== false) {
      const validation = await validateTransitionCapacity(supabase, newOwnerId);
      if (validation.overloaded) {
        return NextResponse.json(
          {
            error: `Cannot stage transition: ${validation.message}`,
            validation,
          },
          { status: 400 },
        );
      }
    }

    // Create the planned change
    const plannedChange = await createPlannedChange(
      supabase,
      branchId,
      newOwnerId,
      new Date(scheduledDate),
      reason || 'restructuring',
      notes,
    );

    return NextResponse.json(plannedChange, { status: 201 });
  } catch (error) {
    console.error('[coverage] plan-transition error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create transition' },
      { status: 500 },
    );
  }
}
