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
  recommendation_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  type: z.enum(['call', 'visit', 'email', 'note']),
  outcome: z.preprocess(
    emptyToNull,
    z.enum(['connected', 'left_msg', 'no_response', 'meeting_booked', 'meeting_held']).nullable(),
  ),
  occurred_on: z.preprocess(emptyToNull, z.string().nullable()), // yyyy-mm-dd, backdating allowed
  followup_date: z.preprocess(emptyToNull, z.string().nullable()),
  branch_label: z.preprocess(emptyToNull, z.string().max(200).nullable()),
  body: z.preprocess(emptyToNull, z.string().max(2000).nullable()),
});

/**
 * Resolve the touch timestamp. Backdating is allowed (call yesterday, log
 * today) within 60 days; future dates are rejected. Same-day = "now" so intra-
 * day ordering stays natural.
 */
function resolveOccurredAt(occurredOn: string | null): { ts?: string; error?: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (!occurredOn || occurredOn === today) return { ts: new Date().toISOString() };
  if (occurredOn > today) return { error: 'Touch date can’t be in the future.' };
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  if (occurredOn < cutoff) return { error: 'Backdating is limited to the last 60 days.' };
  return { ts: `${occurredOn}T12:00:00.000Z` };
}

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
    recommendation_id: formData.get('recommendation_id'),
    type: formData.get('type'),
    outcome: formData.get('outcome'),
    occurred_on: formData.get('occurred_on'),
    followup_date: formData.get('followup_date'),
    branch_label: formData.get('branch_label'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const when = resolveOccurredAt(parsed.data.occurred_on);
  if (when.error) return { error: when.error };
  const today = new Date().toISOString().slice(0, 10);
  if (parsed.data.followup_date && parsed.data.followup_date < today) {
    return { error: 'Follow-up date should be today or later.' };
  }

  const supabase = await createClient();
  const insert: Record<string, unknown> = {
    type: parsed.data.type,
    branch_id: parsed.data.branch_id,
    account_id: parsed.data.account_id,
    body: parsed.data.body,
    user_id: userId,
    occurred_at: when.ts,
  };
  // Optional columns from later migrations — only send when used, so touch
  // logging keeps working on databases that haven't run them yet.
  if (parsed.data.contact_id) insert.contact_id = parsed.data.contact_id;
  if (parsed.data.outcome) insert.outcome = parsed.data.outcome;
  const { data: created, error } = await supabase
    .from('activities')
    .insert(insert)
    .select('id')
    .single();
  if (error) return { error: error.message };

  // Touch came from an AI next-best-action card → mark the recommendation
  // accepted and link the resulting activity (the attribution edge).
  if (parsed.data.recommendation_id) {
    await supabase
      .from('ai_recommendations')
      .update({
        status: 'accepted',
        acted_at: new Date().toISOString(),
        action_activity_id: created?.id ?? null,
      })
      .eq('id', parsed.data.recommendation_id)
      .eq('user_id', userId);
  }

  // Optional follow-up → a task on the rep's list, due that day.
  if (parsed.data.followup_date) {
    await supabase.from('tasks').insert({
      title: `Follow up — ${parsed.data.branch_label ?? 'branch'}`,
      due_date: parsed.data.followup_date,
      account_id: parsed.data.account_id,
      branch_id: parsed.data.branch_id,
      assignee_id: userId,
      created_by: userId,
      status: 'open',
    });
  }

  await logAudit(supabase, 'touch', 'branch', parsed.data.branch_id, { type: parsed.data.type });
  revalidatePath('/my-day');
  revalidatePath('/activities');
  return { ok: true };
}

/** Rep marks an AI suggestion as not relevant — logged, never deleted. */
export async function dismissRecommendation(recId: string, note?: string): Promise<void> {
  const { userId } = await requireSession();
  const supabase = await createClient();
  await supabase
    .from('ai_recommendations')
    .update({
      status: 'dismissed',
      acted_at: new Date().toISOString(),
      override_note: note ?? null,
    })
    .eq('id', recId)
    .eq('user_id', userId);
  revalidatePath('/my-day');
}
