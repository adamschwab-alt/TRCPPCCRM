'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export type TouchState = { error?: string; ok?: boolean };

const emptyToNull = (v: unknown) => (v === '' || v == null ? null : v);

const touchSchema = z.object({
  branch_id: z.string().uuid(),
  account_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  contact_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  type: z.enum(['call', 'visit', 'email', 'note']),
  body: z.preprocess(emptyToNull, z.string().max(2000).nullable()),
});

/**
 * Log an outreach touch against a branch from the My Day worklist. Recorded as
 * an activity (the rep's own, per RLS); the branch then drops down the queue for
 * ~2 weeks so the rep's focus rotates.
 */
export async function logTouch(_prev: TouchState, formData: FormData): Promise<TouchState> {
  const { userId } = await requireSession();
  const parsed = touchSchema.safeParse({
    branch_id: formData.get('branch_id'),
    account_id: formData.get('account_id'),
    contact_id: formData.get('contact_id'),
    type: formData.get('type'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const insert: Record<string, unknown> = {
    type: parsed.data.type,
    branch_id: parsed.data.branch_id,
    account_id: parsed.data.account_id,
    body: parsed.data.body,
    user_id: userId,
    occurred_at: new Date().toISOString(),
  };
  // contact_id column arrives with migration 0007 — only send it when used, so
  // touch logging keeps working on databases that haven't run it yet.
  if (parsed.data.contact_id) insert.contact_id = parsed.data.contact_id;
  const { error } = await supabase.from('activities').insert(insert);
  if (error) return { error: error.message };

  await logAudit(supabase, 'touch', 'branch', parsed.data.branch_id, { type: parsed.data.type });
  revalidatePath('/my-day');
  revalidatePath('/activities');
  return { ok: true };
}
