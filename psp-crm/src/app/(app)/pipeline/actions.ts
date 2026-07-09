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
  source: z.preprocess(
    emptyToNull,
    z
      .enum(['existing_account', 'new_branch', 'referral', 'inbound', 'event', 'cold', 'other'])
      .nullable(),
  ),
  win_pct: z.preprocess(emptyToNull, z.coerce.number().min(0).max(100).nullable()),
  amount: z.preprocess(emptyToNull, z.coerce.number().min(0).nullable()),
  gm_pct_input: z.preprocess(emptyToNull, z.coerce.number().min(0).max(100).nullable()),
  lead_time_risk: z.preprocess(emptyToNull, z.enum(['Low', 'Med', 'High']).nullable()),
  expected_close: z.preprocess(emptyToNull, z.string().nullable()),
  next_step: z.preprocess(emptyToNull, z.string().nullable()),
  next_date: z.preprocess(emptyToNull, z.string().nullable()),
  primary_contact_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  competitor: z.preprocess(emptyToNull, z.string().nullable()),
  forecast_category: z.preprocess(
    emptyToNull,
    z.enum(['pipeline', 'best_case', 'commit']).nullable(),
  ),
  lost_reason: z.preprocess(
    emptyToNull,
    z
      .enum([
        'price',
        'availability',
        'lead_time',
        'spec',
        'relationship',
        'no_decision',
        'competitor',
        'other',
      ])
      .nullable(),
  ),
  lost_note: z.preprocess(emptyToNull, z.string().nullable()),
  notes: z.preprocess(emptyToNull, z.string().nullable()),
});

/**
 * Stage gates (blueprint §6) — the 5 things a rep must supply, enforced at the
 * moment of stage advancement so downstream metrics are computable:
 *   Quoted+  → amount + expected close
 *   Verbal   → + next step + next date + primary contact (decision-maker discipline)
 *   Lost     → lost reason
 *   any opp  → source
 */
function gateError(d: z.infer<typeof schema>): string | null {
  if (!d.source) return 'Pick a source — where did this opportunity come from?';
  if (['Quoted', 'Verbal', 'Won'].includes(d.stage)) {
    if (d.amount == null) return `An amount is required at ${d.stage}.`;
    if (!d.expected_close) return `An expected close date is required at ${d.stage}.`;
  }
  if (d.stage === 'Verbal') {
    if (!d.next_step || !d.next_date)
      return 'Verbal deals need a concrete next step AND its date.';
    if (!d.primary_contact_id)
      return 'Verbal deals need a primary contact — who gave the verbal? (Add one on the account page if the list is empty.)';
  }
  if (d.stage === 'Lost' && !d.lost_reason) return 'Pick a lost reason — this feeds win/loss analysis.';
  return null;
}

function toRow(input: z.infer<typeof schema>, ownerId: string) {
  const winProb = input.win_pct == null ? null : input.win_pct / 100;
  const amount = input.amount;
  const row: Partial<import('@/types/database').OpportunityRow> = {
    account_id: input.account_id,
    branch_id: input.branch_id,
    owner_id: ownerId,
    type: input.type,
    product_line: input.product_line,
    stage: input.stage,
    source: input.source,
    win_prob: winProb,
    amount,
    gm_pct: input.gm_pct_input == null ? null : input.gm_pct_input / 100,
    weighted_amount:
      amount != null && winProb != null ? Math.round(amount * winProb * 100) / 100 : null,
    lead_time_risk: input.lead_time_risk,
    expected_close: input.expected_close,
    next_step: input.next_step,
    next_date: input.next_date,
    primary_contact_id: input.primary_contact_id,
    competitor: input.competitor,
    lost_reason: input.stage === 'Lost' ? input.lost_reason : null,
    lost_note: input.stage === 'Lost' ? input.lost_note : null,
    notes: input.notes,
  };
  // forecast_category: only send an explicit override — omitting it lets the
  // DB trigger auto-map from stage (and record overrides in history).
  if (input.forecast_category) row.forecast_category = input.forecast_category;
  return row;
}

function parse(formData: FormData) {
  return schema.safeParse({
    account_id: formData.get('account_id'),
    branch_id: formData.get('branch_id'),
    type: formData.get('type'),
    product_line: formData.get('product_line'),
    stage: formData.get('stage'),
    source: formData.get('source'),
    win_pct: formData.get('win_pct'),
    amount: formData.get('amount'),
    gm_pct_input: formData.get('gm_pct_input'),
    lead_time_risk: formData.get('lead_time_risk'),
    expected_close: formData.get('expected_close'),
    next_step: formData.get('next_step'),
    next_date: formData.get('next_date'),
    primary_contact_id: formData.get('primary_contact_id'),
    competitor: formData.get('competitor'),
    forecast_category: formData.get('forecast_category'),
    lost_reason: formData.get('lost_reason'),
    lost_note: formData.get('lost_note'),
    notes: formData.get('notes'),
  });
}

export async function createOpportunity(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireSession();
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const gate = gateError(parsed.data);
  if (gate) return { error: gate };

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
  const gate = gateError(parsed.data);
  if (gate) return { error: gate };

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
