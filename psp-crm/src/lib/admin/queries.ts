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

export type AuditEntry = AuditLogRow & { actor_name: string | null };

export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const [{ data }, { data: profiles }] = await Promise.all([
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit),
    supabase.from('profiles').select('id,full_name,email'),
  ]);
  const name = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
  return (data ?? []).map((a) => ({
    ...a,
    actor_name: a.actor_id ? (name.get(a.actor_id) ?? null) : null,
  }));
}
