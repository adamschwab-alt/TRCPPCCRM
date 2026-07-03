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

export type LastSync = { created_at: string; inserted: number | null } | null;

export async function getLastSync(): Promise<LastSync> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_log')
    .select('created_at,diff')
    .eq('action', 'sync')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) {
    const diff = (data.diff ?? {}) as { inserted?: number };
    return {
      created_at: data.created_at,
      inserted: typeof diff.inserted === 'number' ? diff.inserted : null,
    };
  }
  // Fall back to the app_settings stamp (set on every sync/restore) when the
  // audit log has no entries — e.g. the log_audit function isn't installed.
  const { data: settings } = await supabase
    .from('app_settings')
    .select('updated_at')
    .eq('id', true)
    .maybeSingle();
  return settings ? { created_at: settings.updated_at, inserted: null } : null;
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
