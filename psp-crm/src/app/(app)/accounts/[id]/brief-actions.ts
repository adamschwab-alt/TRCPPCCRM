'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { generateAccountBrief } from '@/lib/ai/brief';

export type BriefResult = { text?: string; recId?: string; error?: string };

export async function briefAccount(accountId: string): Promise<BriefResult> {
  const { userId } = await requireSession();
  const supabase = await createClient();
  try {
    const res = await generateAccountBrief(supabase, userId, accountId);
    return res as BriefResult;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Brief generation failed' };
  }
}

/** 👍/👎 on a generated brief — the quality-metric loop. */
export async function rateBrief(recId: string, up: boolean): Promise<void> {
  const { userId } = await requireSession();
  const supabase = await createClient();
  const { data: rec } = await supabase
    .from('ai_recommendations')
    .select('outcome')
    .eq('id', recId)
    .eq('user_id', userId)
    .maybeSingle();
  await supabase
    .from('ai_recommendations')
    .update({
      status: up ? 'accepted' : 'dismissed',
      acted_at: new Date().toISOString(),
      outcome: { ...((rec?.outcome as Record<string, unknown>) ?? {}), rating: up ? 'up' : 'down' },
    })
    .eq('id', recId)
    .eq('user_id', userId);
}
