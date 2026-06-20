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
