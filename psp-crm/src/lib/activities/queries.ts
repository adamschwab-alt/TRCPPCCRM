import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ActivityRow, TaskRow } from '@/types/database';

export type AccountOption = { id: string; name: string };

export async function getAccountOptions(): Promise<AccountOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('accounts').select('id,name').order('name');
  return (data ?? []) as AccountOption[];
}

async function nameMaps() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: profiles }] = await Promise.all([
    supabase.from('accounts').select('id,name'),
    supabase.from('profiles').select('id,full_name,email'),
  ]);
  return {
    aName: new Map((accounts ?? []).map((a) => [a.id, a.name])),
    pName: new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email])),
  };
}

export type EnrichedActivity = ActivityRow & {
  account_name: string | null;
  user_name: string | null;
  contact_name: string | null;
};

export async function getRecentActivities(limit = 50): Promise<EnrichedActivity[]> {
  const supabase = await createClient();
  const [{ data }, maps, contactsRes] = await Promise.all([
    supabase.from('activities').select('*').order('occurred_at', { ascending: false }).limit(limit),
    nameMaps(),
    supabase.from('contacts').select('id,name'), // tolerated pre-0007 (empty on error)
  ]);
  const cName = new Map((contactsRes.data ?? []).map((c) => [c.id, c.name]));
  return (data ?? []).map((a) => ({
    ...a,
    account_name: a.account_id ? (maps.aName.get(a.account_id) ?? null) : null,
    user_name: a.user_id ? (maps.pName.get(a.user_id) ?? null) : null,
    contact_name: a.contact_id ? (cName.get(a.contact_id) ?? null) : null,
  }));
}

export type EnrichedTask = TaskRow & { account_name: string | null };

export async function getMyTasks(userId: string): Promise<EnrichedTask[]> {
  const supabase = await createClient();
  const [{ data }, maps] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .or(`assignee_id.eq.${userId},created_by.eq.${userId}`)
      .order('due_date', { ascending: true, nullsFirst: false }),
    nameMaps(),
  ]);
  return (data ?? []).map((t) => ({
    ...t,
    account_name: t.account_id ? (maps.aName.get(t.account_id) ?? null) : null,
  }));
}
