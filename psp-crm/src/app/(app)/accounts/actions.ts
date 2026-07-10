'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession, isStaff } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import type { AccountRow, BranchRow, UserRole } from '@/types/database';

export type FormState = { error?: string };

const emptyToNull = (v: unknown) => (v === '' || v == null ? null : v);

const accountSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  primary_state: z.preprocess(emptyToNull, z.string().nullable()),
  owner_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
});

const branchSchema = z.object({
  account_id: z.string().uuid('Pick an account'),
  name: z.string().min(1, 'Branch name is required'),
  city: z.preprocess(emptyToNull, z.string().nullable()),
  state: z.preprocess(emptyToNull, z.string().nullable()),
  owner_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
});

/** Reps may only own what they create; staff may assign any owner. */
function resolveOwner(role: UserRole, userId: string, requested: string | null): string | null {
  return isStaff(role) ? requested : userId;
}

export async function createAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId, profile } = await requireSession();
  const parsed = accountSchema.safeParse({
    name: formData.get('name'),
    primary_state: formData.get('primary_state'),
    owner_id: formData.get('owner_id'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      name: parsed.data.name,
      primary_state: parsed.data.primary_state,
      owner_id: resolveOwner(profile.role, userId, parsed.data.owner_id),
    })
    .select('id')
    .single();
  if (error) return { error: error.message };
  await logAudit(supabase, 'create', 'account', data?.id ?? null, { name: parsed.data.name });

  revalidatePath('/accounts');
  redirect(`/accounts/${data!.id}`);
}

export async function updateAccount(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { profile } = await requireSession();
  const parsed = accountSchema.safeParse({
    name: formData.get('name'),
    primary_state: formData.get('primary_state'),
    owner_id: formData.get('owner_id'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const patch: Partial<AccountRow> = {
    name: parsed.data.name,
    primary_state: parsed.data.primary_state,
  };
  if (isStaff(profile.role)) patch.owner_id = parsed.data.owner_id; // only staff reassign owners
  const { error } = await supabase.from('accounts').update(patch).eq('id', id);
  if (error) return { error: error.message };
  await logAudit(supabase, 'update', 'account', id, { name: parsed.data.name });

  revalidatePath('/accounts');
  redirect(`/accounts/${id}`);
}

/**
 * Customer-wiring relationship rating (1 strategic / 2 important / 3
 * transactional). Crossed with TTM size it drives the account's touch cadence.
 * RLS limits writes to staff or the owning rep.
 */
export async function setRelationshipRating(
  accountId: string,
  rating: number,
): Promise<{ error?: string }> {
  await requireSession();
  if (![1, 2, 3].includes(rating)) return { error: 'Rating must be 1, 2, or 3' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('accounts')
    .update({ relationship_rating: rating })
    .eq('id', accountId);
  if (error) return { error: error.message };
  await logAudit(supabase, 'update', 'account', accountId, { relationship_rating: rating });
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath('/my-day');
  return {};
}

const contactSchema = z.object({
  account_id: z.string().uuid(),
  branch_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  name: z.string().min(1, 'Name is required'),
  title: z.preprocess(emptyToNull, z.string().nullable()),
  tier: z.coerce.number().int().min(1).max(5),
  phone: z.preprocess(emptyToNull, z.string().nullable()),
  email: z.preprocess(emptyToNull, z.string().email('Invalid email').nullable()),
  covered_by: z.preprocess(emptyToNull, z.string().nullable()),
});

export async function saveContact(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const id = String(formData.get('id') || '');
  const parsed = contactSchema.safeParse({
    account_id: formData.get('account_id'),
    branch_id: formData.get('branch_id'),
    name: formData.get('name'),
    title: formData.get('title'),
    tier: formData.get('tier'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    covered_by: formData.get('covered_by'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('contacts').update(parsed.data).eq('id', id)
    : await supabase.from('contacts').insert(parsed.data);
  if (error) {
    return {
      error: /relation .* does not exist/i.test(error.message)
        ? 'The contacts table is not set up yet — run the 0007 migration in Supabase first.'
        : error.message,
    };
  }
  await logAudit(supabase, id ? 'update' : 'create', 'contact', id || null, {
    account_id: parsed.data.account_id,
    name: parsed.data.name,
  });
  revalidatePath(`/accounts/${parsed.data.account_id}`);
  return {};
}

export async function deleteContact(id: string, accountId: string): Promise<void> {
  await requireSession();
  const supabase = await createClient();
  await supabase.from('contacts').delete().eq('id', id);
  await logAudit(supabase, 'delete', 'contact', id, { account_id: accountId });
  revalidatePath(`/accounts/${accountId}`);
}

export async function createBranch(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId, profile } = await requireSession();
  const parsed = branchSchema.safeParse({
    account_id: formData.get('account_id'),
    name: formData.get('name'),
    city: formData.get('city'),
    state: formData.get('state'),
    owner_id: formData.get('owner_id'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.from('branches').insert({
    account_id: parsed.data.account_id,
    name: parsed.data.name,
    city: parsed.data.city,
    state: parsed.data.state,
    owner_id: resolveOwner(profile.role, userId, parsed.data.owner_id),
  });
  if (error) return { error: error.message };
  await logAudit(supabase, 'create', 'branch', null, {
    name: parsed.data.name,
    account_id: parsed.data.account_id,
  });

  revalidatePath(`/accounts/${parsed.data.account_id}`);
  redirect(`/accounts/${parsed.data.account_id}`);
}

export async function updateBranch(
  id: string,
  accountId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { profile } = await requireSession();
  const parsed = branchSchema.safeParse({
    account_id: accountId,
    name: formData.get('name'),
    city: formData.get('city'),
    state: formData.get('state'),
    owner_id: formData.get('owner_id'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const patch: Partial<BranchRow> = {
    name: parsed.data.name,
    city: parsed.data.city,
    state: parsed.data.state,
  };
  if (isStaff(profile.role)) patch.owner_id = parsed.data.owner_id;
  const { error } = await supabase.from('branches').update(patch).eq('id', id);
  if (error) return { error: error.message };
  await logAudit(supabase, 'update', 'branch', id, { name: parsed.data.name });

  revalidatePath(`/branches/${id}`);
  redirect(`/branches/${id}`);
}
