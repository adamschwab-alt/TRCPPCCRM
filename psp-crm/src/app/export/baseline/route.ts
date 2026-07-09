import * as XLSX from 'xlsx';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';
import { wiringFor } from '@/lib/wiring';

export const dynamic = 'force-dynamic';

/**
 * Baseline freeze (blueprint non-negotiable #2): a dated, multi-sheet snapshot
 * of the book BEFORE behavior change — the "before" of every future
 * before/after claim. Download it on rollout day and file it somewhere safe;
 * the audit log records that (and when) it was generated.
 */
export async function GET() {
  await requireRole('admin');
  const supabase = await createClient();

  const [kpis, accounts, whitespace, settings, profiles, opps] = await Promise.all([
    supabase.from('portfolio_kpis').select('*').maybeSingle(),
    supabase.from('account_metrics').select('*').order('ttm_revenue', { ascending: false }),
    supabase.from('whitespace_summary').select('*'),
    supabase.from('app_settings').select('*').eq('id', true).maybeSingle(),
    supabase.from('profiles').select('id,full_name,email'),
    supabase.from('opportunities').select('*'),
  ]);
  const { data: accountRows } = await supabase.from('accounts').select('*');
  const ratingOf = new Map(
    ((accountRows ?? []) as { id: string; relationship_rating?: number }[]).map((a) => [
      a.id,
      a.relationship_rating ?? 2,
    ]),
  );
  const nameOf = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name || p.email]));

  const frozenAt = new Date().toISOString();
  const wb = XLSX.utils.book_new();

  // Meta — what this file is and the exact moment it was frozen.
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Key: 'Frozen at (UTC)', Value: frozenAt },
      { Key: 'Data as-of', Value: settings.data?.as_of_date ?? '' },
      { Key: 'Purpose', Value: 'Pre-rollout baseline — the "before" for all future comparisons' },
      { Key: 'Behavioral metrics note', Value: 'Touch/funnel history begins at rollout; revenue metrics have full history' },
    ]),
    'Meta',
  );

  const k = kpis.data;
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      k
        ? [
            { KPI: 'Current book (TTM)', Value: k.current_book },
            { KPI: 'Prior book', Value: k.prior_book },
            { KPI: 'YoY', Value: k.yoy },
            { KPI: 'GRR', Value: k.grr },
            { KPI: 'NRR', Value: k.nrr },
            { KPI: 'Gross margin %', Value: k.gm_pct },
            { KPI: 'Contraction', Value: k.contraction },
            { KPI: 'Expansion', Value: k.expansion },
            { KPI: 'New business', Value: k.new_business },
            { KPI: 'Lapsed accounts', Value: k.lapsed_accounts },
            { KPI: 'New accounts', Value: k.new_accounts },
          ]
        : [],
    ),
    'Portfolio KPIs',
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (accounts.data ?? []).map((a) => ({
        Account: a.account_name,
        State: a.primary_state ?? '',
        Branches: a.branch_count,
        'TTM revenue': a.ttm_revenue,
        'Prior revenue': a.prior_revenue,
        'Δ%': a.delta_pct,
        Status: a.status,
        Coverage: a.coverage_rag,
        'Days idle': a.days_idle ?? '',
        Rating: ratingOf.get(a.account_id) ?? 2,
        'Wiring size': wiringFor(a.ttm_revenue, ratingOf.get(a.account_id)).size,
        'Touches/yr target': wiringFor(a.ttm_revenue, ratingOf.get(a.account_id)).callsPerYear,
        Owner: a.owner_id ? (nameOf.get(a.owner_id) ?? '') : '',
      })),
    ),
    'Accounts',
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      (whitespace.data ?? []).map((w) => ({
        'White space': w.white_space,
        Branches: w.branch_count,
        'In-line TTM': w.ttm_revenue,
      })),
    ),
    'White-space',
  );

  // Day-0 funnel state (usually near-empty — that emptiness IS the baseline).
  const o = opps.data ?? [];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Metric: 'Open opportunities', Value: o.filter((x) => !['Won', 'Lost'].includes(x.stage)).length },
      { Metric: 'Open pipeline $', Value: o.filter((x) => !['Won', 'Lost'].includes(x.stage)).reduce((s, x) => s + (x.amount ?? 0), 0) },
      { Metric: 'Won (all time)', Value: o.filter((x) => x.stage === 'Won').length },
      { Metric: 'Lost (all time)', Value: o.filter((x) => x.stage === 'Lost').length },
    ]),
    'Funnel day-0',
  );

  await logAudit(supabase, 'baseline_freeze', 'portfolio', null, { frozen_at: frozenAt });

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="psp-baseline-freeze-${frozenAt.slice(0, 10)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
