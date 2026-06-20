'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export type FormState = { error?: string };

const emptyToNull = (v: unknown) => (v === '' || v == null ? null : v);

const schema = z.object({
  account_id: z.string().uuid('Pick an account'),
  branch_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  type: z.preprocess(
    emptyToNull,
    z.enum(['new_branch_activation', 'displacement', 'new_logo', 'expansion']).nullable(),
  ),
  product_line: z.preprocess(emptyToNull, z.enum(['Aluminum', 'Steel', 'Other']).nullable()),
  stage: z.enum(['Qualified', 'Quoted', 'Verbal', 'Won', 'Lost']),
  win_pct: z.preprocess(emptyToNull, z.coerce.number().min(0).max(100).nullable()),
  amount: z.preprocess(emptyToNull, z.coerce.number().min(0).nullable()),
  gm_pct_input: z.preprocess(emptyToNull, z.coerce.number().min(0).max(100).nullable()),
  lead_time_risk: z.preprocess(emptyToNull, z.enum(['Low', 'Med', 'High']).nullable()),
  expected_close: z.preprocess(emptyToNull, z.string().nullable()),
  next_step: z.preprocess(emptyToNull, z.string().nullable()),
  next_date: z.preprocess(emptyToNull, z.string().nullable()),
  notes: z.preprocess(emptyToNull, z.string().nullable()),
});

function toRow(input: z.infer<typeof schema>, ownerId: string) {
  const winProb = input.win_pct == null ? null : input.win_pct / 100;
  const amount = input.amount;
  return {
    account_id: input.account_id,
    branch_id: input.branch_id,
    owner_id: ownerId,
    type: input.type,
    product_line: input.product_line,
    stage: input.stage,
    win_prob: winProb,
    amount,
    gm_pct: input.gm_pct_input == null ? null : input.gm_pct_input / 100,
    weighted_amount:
      amount != null && winProb != null ? Math.round(amount * winProb * 100) / 100 : null,
    lead_time_risk: input.lead_time_risk,
    expected_close: input.expected_close,
    next_step: input.next_step,
    next_date: input.next_date,
    notes: input.notes,
  };
}

function parse(formData: FormData) {
  return schema.safeParse({
    account_id: formData.get('account_id'),
    branch_id: formData.get('branch_id'),
    type: formData.get('type'),
    product_line: formData.get('product_line'),
    stage: formData.get('stage'),
    win_pct: formData.get('win_pct'),
    amount: formData.get('amount'),
    gm_pct_input: formData.get('gm_pct_input'),
    lead_time_risk: formData.get('lead_time_risk'),
    expected_close: formData.get('expected_close'),
    next_step: formData.get('next_step'),
    next_date: formData.get('next_date'),
    notes: formData.get('notes'),
  });
}

export async function createOpportunity(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireSession();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const row = toRow(parsed.data, userId);
  const { data, error } = await supabase.from('opportunities').insert(row).select('id').single();
  if (error) return { error: error.message };
  await logAudit(supabase, 'create', 'opportunity', data?.id ?? null, {
    stage: row.stage,
    amount: row.amount,
  });

  revalidatePath('/pipeline');
  redirect('/pipeline');
}

export async function updateOpportunity(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { userId } = await requireSession();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const row = toRow(parsed.data, userId);
  const { error } = await supabase.from('opportunities').update(row).eq('id', id);
  if (error) return { error: error.message };
  await logAudit(supabase, 'update', 'opportunity', id, { stage: row.stage, amount: row.amount });

  revalidatePath('/pipeline');
  redirect('/pipeline');
}

export async function deleteOpportunity(id: string): Promise<void> {
  await requireSession();
  const supabase = await createClient();
  await supabase.from('opportunities').delete().eq('id', id);
  await logAudit(supabase, 'delete', 'opportunity', id);
  revalidatePath('/pipeline');
  redirect('/pipeline');
}
