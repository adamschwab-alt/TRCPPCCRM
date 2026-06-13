import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ProfileRow, UserRole } from '@/types/database';

export interface SessionContext {
  userId: string;
  email: string;
  profile: ProfileRow;
}

/**
 * Resolve the authenticated user + profile for a Server Component / action.
 * Redirects to /login when there is no session. The proxy already enforces MFA,
 * so anything past it is aal2.
 */
export async function requireSession(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  return { userId: user.id, email: user.email ?? profile.email, profile };
}

export async function requireRole(...roles: UserRole[]): Promise<SessionContext> {
  const ctx = await requireSession();
  if (!roles.includes(ctx.profile.role)) redirect('/dashboard');
  return ctx;
}

export const isStaff = (role: UserRole) => role === 'admin' || role === 'manager';
