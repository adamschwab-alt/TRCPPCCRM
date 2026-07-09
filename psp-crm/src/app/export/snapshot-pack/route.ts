import * as XLSX from 'xlsx';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getForecastReport, getAiReport } from '@/lib/forecast/queries';
import { computeDq } from '@/lib/dq/queries';
import { getActivityData } from '@/lib/activity/queries';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * Monthly snapshot pack (blueprint §9): one dated workbook assembling the whole
 * measurement record — portfolio KPIs, funnel, activity, AI adoption, DQ,
 * forecast history, and the evidence log. Download at each month end and file
 * next to the baseline freeze; the sequence of packs IS the case-study dataset.
 */
export async function GET() {
  await requireRole('admin', 'manager');
  const supabase = await createClient();

  const [kpisRes, forecast, ai, dq, activity, evidenceRes, oppsRes] = await Promise.all([
    supabase.from('portfolio_kpis').select('*').maybeSingle(),
    getForecastReport(supabase).catch(() => []),
    getAiReport(supabase).catch(() => ({ byType: [], totalShown: 0, activeUsers: 0 })),
    computeDq(supabase).catch(() => null),
    getActivityData().catch(() => null),
    supabase.from('exogenous_events').select('*').order('event_date', { ascending: false }),
    supabase.from('opportunities').select('*'),
  ]);

  const stampIso = new Date().toISOString();
  const wb = XLSX.utils.book_new();
  const sheet = (name: string, rows: Record<string, unknown>[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));

  sheet('Meta', [
    { Key: 'Generated (UTC)', Value: stampIso },
    { Key: 'Purpose', Value: 'Monthly measurement snapshot — file, never edit' },
  ]);

  const k = kpisRes.data;
  sheet(
    'Portfolio KPIs',
    k
      ? Object.entries(k).map(([KPI, Value]) => ({ KPI, Value: Value as number | null }))
      : [],
  );

  const opps = oppsRes.data ?? [];
  const open = opps.filter((o) => o.stage !== 'Won' && o.stage !== 'Lost');
  const monthStart = stampIso.slice(0, 7) + '-01';
  sheet('Funnel', [
    { Metric: 'Open opportunities', Value: open.length },
    { Metric: 'Open pipeline $', Value: open.reduce((s, o) => s + (o.amount ?? 0), 0) },
    {
      Metric: 'Created this month $',
      Value: opps
        .filter((o) => o.created_at >= monthStart)
        .reduce((s, o) => s + (o.amount ?? 0), 0),
    },
    { Metric: 'Won (all time)', Value: opps.filter((o) => o.stage === 'Won').length },
    { Metric: 'Lost (all time)', Value: opps.filter((o) => o.stage === 'Lost').length },
  ]);

  if (activity) {
    sheet(
      'Rep scorecard',
      activity.scorecard.map((r) => ({
        Rep: r.repName,
        Accounts: r.accounts,
        'Wk plan': Number(r.weeklyPlan.toFixed(2)),
        'Wk actual': r.weeklyActual,
        '4wk avg': Number(r.weekly4Avg.toFixed(2)),
        'Coverage %': r.coveragePct != null ? Math.round(r.coveragePct * 100) : '',
        Overdue: r.overdue,
        'TTM rev': r.ttmRevenue,
        'Growth %': r.growthPct != null ? Math.round(r.growthPct * 1000) / 10 : '',
        'Retention %': r.retentionPct != null ? Math.round(r.retentionPct * 100) : '',
      })),
    );
  }

  sheet(
    'AI adoption',
    ai.byType.map((t) => ({
      Feature: t.type,
      Shown: t.shown,
      Accepted: t.accepted,
      Dismissed: t.dismissed,
      'Accept rate %': t.acceptanceRate != null ? Math.round(t.acceptanceRate * 100) : '',
      'Median hrs to act': t.medianHoursToAction?.toFixed(1) ?? '',
      '👍': t.thumbsUp,
      '👎': t.thumbsDown,
      'Order 28d accepted %': t.orderRateAccepted != null ? Math.round(t.orderRateAccepted * 100) : '',
      'Order 28d ignored %': t.orderRateIgnored != null ? Math.round(t.orderRateIgnored * 100) : '',
    })),
  );

  if (dq) {
    sheet('Data quality', [
      { Metric: 'Opp completeness %', Value: dq.completeness != null ? Math.round(dq.completeness * 100) : '' },
      { Metric: 'Touch freshness %', Value: dq.freshness != null ? Math.round(dq.freshness * 100) : '' },
      { Metric: 'Stalled deals', Value: dq.stalled },
      { Metric: 'Gate violations', Value: dq.gateViolations },
    ]);
  }

  sheet(
    'Forecast history',
    forecast.map((f) => ({
      Month: f.period,
      Commit: f.commit,
      'Best case': f.bestCase,
      Pipeline: f.pipeline,
      'Won actual': f.wonActual ?? '',
      'Accuracy %': f.accuracy != null ? Math.round(f.accuracy * 100) : '',
      Bias: f.bias ?? '',
    })),
  );

  sheet(
    'Evidence log',
    (evidenceRes.data ?? []).map((e) => ({
      Date: e.event_date,
      Kind: (e as { kind?: string }).kind ?? 'market',
      'Event / quote': e.title,
      Detail: e.note ?? '',
    })),
  );

  await logAudit(supabase, 'snapshot_pack', 'portfolio', null, { generated_at: stampIso });

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="psp-snapshot-pack-${stampIso.slice(0, 10)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
