'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export type FormState = { error?: string; ok?: boolean };

const emptyToNull = (v: unknown) => (v === '' || v == null ? null : v);

const activitySchema = z.object({
  type: z.enum(['call', 'visit', 'email', 'note']),
  account_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  body: z.preprocess(emptyToNull, z.string().min(1, 'Add a note').nullable()),
});

export async function logActivity(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireSession();
  const parsed = activitySchema.safeParse({
    type: formData.get('type'),
    account_id: formData.get('account_id'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.from('activities').insert({
    type: parsed.data.type,
    account_id: parsed.data.account_id,
    body: parsed.data.body,
    user_id: userId,
    occurred_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  await logAudit(supabase, 'log', 'activity', parsed.data.account_id, { type: parsed.data.type });
  revalidatePath('/my-day');
  return { ok: true };
}

const taskSchema = z.object({
  title: z.string().min(1, 'Add a title'),
  due_date: z.preprocess(emptyToNull, z.string().nullable()),
  account_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
});

export async function addTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireSession();
  const parsed = taskSchema.safeParse({
    title: formData.get('title'),
    due_date: formData.get('due_date'),
    account_id: formData.get('account_id'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.from('tasks').insert({
    title: parsed.data.title,
    due_date: parsed.data.due_date,
    account_id: parsed.data.account_id,
    assignee_id: userId,
    created_by: userId,
    status: 'open',
  });
  if (error) return { error: error.message };
  revalidatePath('/my-day');
  return { ok: true };
}

export async function setTaskStatus(id: string, status: 'open' | 'done'): Promise<void> {
  await requireSession();
  const supabase = await createClient();
  await supabase.from('tasks').update({ status }).eq('id', id);
  await logAudit(supabase, status === 'done' ? 'complete' : 'reopen', 'task', id);
  revalidatePath('/my-day');
}
