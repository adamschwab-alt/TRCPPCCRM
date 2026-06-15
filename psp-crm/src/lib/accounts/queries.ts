import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AccountRow, BranchRow } from '@/types/database';

export type OwnerOption = { id: string; name: string };
export type AccountOption = { id: string; name: string };

export async function getOwnerOptions(): Promise<OwnerOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id,full_name,email,is_active')
    .order('email');
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email }));
}

export async function getAccountOptions(): Promise<AccountOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('accounts').select('id,name').order('name');
  return (data ?? []) as AccountOption[];
}

export async function getAccountRow(id: string): Promise<AccountRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('accounts').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function getBranchRow(id: string): Promise<BranchRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('branches').select('*').eq('id', id).maybeSingle();
  return data;
}
