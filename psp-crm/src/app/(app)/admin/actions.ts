'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth';

export type FormState = { error?: string; ok?: boolean; message?: string };

const num = (v: unknown) => z.coerce.number().parse(v);

const targetsSchema = z.object({
  grr_target: z.coerce.number().min(0).max(2),
  nrr_target: z.coerce.number().min(0).max(3),
  new_biz_target: z.coerce.number().min(0),
  xsell_target: z.coerce.number().int().min(0),
  pipeline_coverage_target: z.coerce.number().min(0),
  contraction_ceiling: z.coerce.number().min(0),
  retention_floor: z.coerce.number().min(0).max(1),
  cadence_days: z.coerce.number().int().min(1),
});

export async function updateTargets(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('admin');
  // GRR/NRR/retention entered as percentages in the UI → store as ratios.
  const parsed = targetsSchema.safeParse({
    grr_target: num(formData.get('grr_target')) / 100,
    nrr_target: num(formData.get('nrr_target')) / 100,
    new_biz_target: formData.get('new_biz_target'),
    xsell_target: formData.get('xsell_target'),
    pipeline_coverage_target: formData.get('pipeline_coverage_target'),
    contraction_ceiling: formData.get('contraction_ceiling'),
    retention_floor: num(formData.get('retention_floor')) / 100,
    cadence_days: formData.get('cadence_days'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.from('targets').update(parsed.data).eq('id', true);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Targets saved.' };
}

export async function updateUser(formData: FormData): Promise<void> {
  await requireRole('admin');
  const id = String(formData.get('id'));
  const role = z.enum(['admin', 'manager', 'rep']).parse(formData.get('role'));
  const is_active = formData.get('is_active') === 'on';
  const supabase = await createClient();
  await supabase.from('profiles').update({ role, is_active }).eq('id', id);
  revalidatePath('/admin');
}

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().optional().default(''),
  role: z.enum(['admin', 'manager', 'rep']),
});

function tempPassword() {
  // readable-ish strong temp password
  return (
    'PSP-' +
    Math.random().toString(36).slice(2, 8) +
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    '!9'
  );
}

export async function inviteUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('admin');
  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name') ?? '',
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        'Service role key not configured — create the user from the Supabase dashboard instead (Authentication → Users).',
    };
  }

  const password = tempPassword();
  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name, role: parsed.data.role },
  });
  if (error) return { error: error.message };

  revalidatePath('/admin');
  return {
    ok: true,
    message: `User created. Temporary password: ${password} — share it securely; they'll set up 2FA on first login.`,
  };
}
