import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AuditLogRow, ProfileRow, TargetsRow } from '@/types/database';

export async function getTargets(): Promise<TargetsRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('targets').select('*').eq('id', true).maybeSingle();
  return data;
}

export async function getProfiles(): Promise<ProfileRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('*').order('email');
  return data ?? [];
}

export async function getAuditLog(limit = 100): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}
