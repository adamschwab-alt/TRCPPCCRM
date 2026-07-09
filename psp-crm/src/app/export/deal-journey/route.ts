import * as XLSX from 'xlsx';
import { type NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Deal journey (blueprint §9): the full timeline of one opportunity — every
 * stage/amount/close-date change, every touch, every AI recommendation — merged
 * chronologically. The single most persuasive case-study artifact: "here is a
 * deal, and here is everything that happened to it."
 */
export async function GET(request: NextRequest) {
  await requireSession();
  const oppId = request.nextUrl.searchParams.get('opp');
  if (!oppId) return new Response('Missing ?opp=<id>', { status: 400 });

  const supabase = await createClient();
  const [{ data: opp }, { data: history }, { data: recs }, { data: profiles }, { data: contacts }] =
    await Promise.all([
      supabase.from('opportunities').select('*').eq('id', oppId).maybeSingle(),
      supabase
        .from('opportunity_stage_history')
        .select('*')
        .eq('opportunity_id', oppId)
        .order('changed_at'),
      supabase
        .from('ai_recommendations')
        .select('*')
        .eq('opportunity_id', oppId)
        .order('shown_at'),
      supabase.from('profiles').select('id,full_name,email'),
      supabase.from('contacts').select('id,name'),
    ]);
  if (!opp) return new Response('Opportunity not found (or not in your book)', { status: 404 });

  const { data: account } = opp.account_id
    ? await supabase.from('accounts').select('name').eq('id', opp.account_id).maybeSingle()
    : { data: null };
  const { data: touches } = opp.account_id
    ? await supabase
        .from('activities')
        .select('*')
        .eq('account_id', opp.account_id)
        .gte('occurred_at', opp.created_at)
        .order('occurred_at')
    : { data: [] };

  const who = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
  const contactName = new Map((contacts ?? []).map((c) => [c.id, c.name]));

  type Event = { When: string; What: string; Who: string; Detail: string };
  const events: Event[] = [];
  for (const h of history ?? []) {
    events.push({
      When: h.changed_at,
      What: h.field === 'created' ? 'Deal created' : `${h.field} changed`,
      Who: h.changed_by ? (who.get(h.changed_by) ?? '') : 'system',
      Detail:
        h.field === 'created'
          ? `at stage ${h.new_value}`
          : `${h.old_value ?? '—'} → ${h.new_value ?? '—'}`,
    });
  }
  for (const t of touches ?? []) {
    events.push({
      When: t.occurred_at,
      What: `Touch: ${t.type}${t.outcome ? ` (${t.outcome})` : ''}`,
      Who: t.user_id ? (who.get(t.user_id) ?? '') : '',
      Detail: [t.contact_id ? `w/ ${contactName.get(t.contact_id) ?? 'contact'}` : '', t.body ?? '']
        .filter(Boolean)
        .join(' — '),
    });
  }
  for (const r of recs ?? []) {
    events.push({
      When: r.shown_at,
      What: `AI ${r.type} (${r.status})`,
      Who: who.get(r.user_id) ?? '',
      Detail: [r.recommended_action ?? '', r.reason ?? ''].filter(Boolean).join(' — '),
    });
  }
  events.sort((a, b) => a.When.localeCompare(b.When));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Field: 'Account', Value: account?.name ?? '' },
      { Field: 'Stage', Value: opp.stage },
      { Field: 'Amount', Value: opp.amount ?? '' },
      { Field: 'Source', Value: (opp as { source?: string }).source ?? '' },
      { Field: 'Created', Value: opp.created_at },
      { Field: 'Closed', Value: (opp as { closed_at?: string }).closed_at ?? '' },
      { Field: 'Lost reason', Value: (opp as { lost_reason?: string }).lost_reason ?? '' },
      { Field: 'Owner', Value: opp.owner_id ? (who.get(opp.owner_id) ?? '') : '' },
    ]),
    'Deal',
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      events.map((e) => ({ ...e, When: e.When.slice(0, 16).replace('T', ' ') })),
    ),
    'Timeline',
  );

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="psp-deal-journey-${oppId.slice(0, 8)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
