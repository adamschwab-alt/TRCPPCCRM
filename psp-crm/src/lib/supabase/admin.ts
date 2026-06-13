import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { env } from '@/lib/env';

/**
 * Service-role client — BYPASSES RLS. Server-only. Use exclusively for trusted
 * operations: the importer/seed and admin-issued invites. Never expose the key
 * or import this into a Client Component.
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
