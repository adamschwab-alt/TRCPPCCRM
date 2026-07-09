import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { wiringFor, wiringLabel } from '@/lib/wiring';

type Db = SupabaseClient<Database>;

export const BRIEF_PROMPT_VERSION = 'brief-v1';
const MODEL = () => process.env.AI_MODEL ?? 'claude-sonnet-5';

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * "Brief me" — a 5-bullet pre-call brief for an account, generated from the
 * CRM's own data (metrics, recent orders, touches, open deals, contacts) and
 * logged to ai_recommendations with model/prompt versions and token cost.
 */
export async function generateAccountBrief(
  supabase: Db,
  userId: string,
  accountId: string,
): Promise<{ text: string; recId: string } | { error: string }> {
  if (!aiConfigured()) {
    return {
      error:
        'AI briefs are not configured yet — an admin needs to add ANTHROPIC_API_KEY in Vercel.',
    };
  }

  const [{ data: metrics }, { data: branches }, { data: touches }, { data: opps }, { data: contacts }] =
    await Promise.all([
      supabase.from('account_metrics').select('*').eq('account_id', accountId).maybeSingle(),
      supabase
        .from('branch_metrics')
        .select('branch_name,ttm_revenue,days_idle,white_space,coverage_rag')
        .eq('account_id', accountId)
        .order('ttm_revenue', { ascending: false })
        .limit(8),
      supabase
        .from('activities')
        .select('type,occurred_at,body,outcome')
        .eq('account_id', accountId)
        .order('occurred_at', { ascending: false })
        .limit(8),
      supabase
        .from('opportunities')
        .select('stage,amount,expected_close,next_step,product_line')
        .eq('account_id', accountId)
        .not('stage', 'in', '("Won","Lost")'),
      supabase.from('contacts').select('name,title,tier').eq('account_id', accountId).limit(8),
    ]);
  const { data: accountRow } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle();

  if (!metrics) return { error: 'Account not found or not in your book.' };

  const rating = (accountRow as { relationship_rating?: number } | null)?.relationship_rating ?? 2;
  const wiring = wiringFor(metrics.ttm_revenue, rating);

  const context = {
    account: metrics.account_name,
    ttm_revenue: metrics.ttm_revenue,
    prior_revenue: metrics.prior_revenue,
    yoy_pct: metrics.delta_pct,
    status: metrics.status,
    coverage: metrics.coverage_rag,
    days_since_last_order: metrics.days_idle,
    wiring: wiringLabel(wiring),
    top_branches: branches ?? [],
    recent_touches: (touches ?? []).map((t) => ({
      type: t.type,
      when: t.occurred_at.slice(0, 10),
      outcome: t.outcome,
      note: t.body?.slice(0, 140),
    })),
    open_opportunities: opps ?? [],
    contacts: contacts ?? [],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You are prepping a Pacific Shoring Products sales rep for a call with a customer. From this CRM data, write a pre-call brief: exactly 5 short bullets — (1) the relationship in one line, (2) revenue trend and what's driving it, (3) the single biggest risk or opening (white-space, idle branches, stalled deal), (4) what happened last touch, (5) the ONE thing to accomplish on this call. Plain language, no preamble, no headers.\n\n${JSON.stringify(context)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch((e) => {
    throw new Error(
      e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')
        ? 'The AI took too long to respond — try again.'
        : 'Could not reach the AI service.',
    );
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { error: `AI error ${res.status}: ${body.slice(0, 160)}` };
  }
  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (json.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n')
    .trim();
  if (!text) return { error: 'The AI returned an empty brief — try again.' };

  const { data: rec } = await supabase
    .from('ai_recommendations')
    .insert({
      type: 'account_summary',
      user_id: userId,
      account_id: accountId,
      recommended_action: text,
      model_version: MODEL(),
      prompt_version: BRIEF_PROMPT_VERSION,
      outcome: { tokens_in: json.usage?.input_tokens ?? null, tokens_out: json.usage?.output_tokens ?? null },
    })
    .select('id')
    .single();

  return { text, recId: rec?.id ?? '' };
}
