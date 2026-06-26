'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession, isStaff } from '@/lib/auth';
import { performSync } from '@/lib/sync/run-sync';

export type RefreshState = { error?: string; ok?: boolean; message?: string };

/**
 * Top-bar "Refresh data" action. Staff-only (a full Acumatica re-sync changes
 * everyone's numbers), so reps see the freshness status but can't trigger it.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function refreshData(_prev: RefreshState, _formData: FormData): Promise<RefreshState> {
  const { profile } = await requireSession();
  if (!isStaff(profile.role)) {
    return { error: 'Only managers and admins can refresh the data feed.' };
  }

  const supabase = await createClient();
  try {
    const result = await performSync(supabase);
    revalidatePath('/', 'layout'); // refresh the freshness pill everywhere
    return { ok: true, message: result.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Refresh failed' };
  }
}
