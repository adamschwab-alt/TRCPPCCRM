import { Card, SectionTitle } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { getForecastReport, getAiReport } from '@/lib/forecast/queries';
import { fmtCurrencyShort, fmtPct, fmtMonthYear } from '@/lib/format';

const TYPE_LABEL: Record<string, string> = {
  next_best_action: 'Next-best-action (My Day)',
  account_summary: 'Pre-call briefs',
  deal_risk: 'Deal-risk flags',
};

export async function ReportsSection() {
  const supabase = await createClient();
  const [forecast, ai, { data: dqHistory }] = await Promise.all([
    getForecastReport(supabase).catch(() => []),
    getAiReport(supabase).catch(() => ({ byType: [], totalShown: 0, activeUsers: 0 })),
    supabase.from('dq_snapshots').select('*').order('period', { ascending: false }).limit(12),
  ]);

  return (
    <div className="space-y-6">

      {/* ── Forecast accuracy ── */}
      <Card className="p-4">
        <SectionTitle>Forecast vs actual (month-start snapshots)</SectionTitle>
        {forecast.length === 0 ? (
          <p className="text-muted text-sm">
            No snapshots yet — the first one freezes automatically at the start of next month (or
            tonight, for the current month). Accuracy appears once a forecast month completes.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-line text-muted border-b text-left text-xs uppercase">
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Commit</th>
                  <th className="px-3 py-2 text-right">Best case</th>
                  <th className="px-3 py-2 text-right">Pipeline</th>
                  <th className="px-3 py-2 text-right">Won (actual)</th>
                  <th className="px-3 py-2 text-right">Accuracy</th>
                  <th className="px-3 py-2">Bias</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((f) => (
                  <tr key={f.period} className="border-line/60 border-b last:border-0">
                    <td className="px-3 py-2 font-medium">
                      {fmtMonthYear(f.period + '-01')}
                      {f.inProgress && <span className="text-muted text-xs"> (in progress)</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtCurrencyShort(f.commit)}
                    </td>
                    <td className="text-muted px-3 py-2 text-right tabular-nums">
                      {fmtCurrencyShort(f.bestCase)}
                    </td>
                    <td className="text-muted px-3 py-2 text-right tabular-nums">
                      {fmtCurrencyShort(f.pipeline)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {f.wonActual != null ? fmtCurrencyShort(f.wonActual) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {f.accuracy != null ? fmtPct(f.accuracy, 0) : '—'}
                    </td>
                    <td className="text-muted px-3 py-2">
                      {f.bias === 'over' ? 'landed over' : f.bias === 'under' ? 'landed under' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-muted mt-2 text-[11px]">
          Snapshots freeze at month start and are never edited — accuracy = 1 − |won − commit| ÷
          commit for completed months. Category defaults come from stage (overrides are recorded).
        </p>
      </Card>

      {/* ── AI adoption ── */}
      <Card className="p-4">
        <SectionTitle>
          AI adoption — {ai.totalShown.toLocaleString('en-US')} recommendations shown ·{' '}
          {ai.activeUsers} user{ai.activeUsers === 1 ? '' : 's'}
        </SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-3 py-2">Feature</th>
                <th className="px-3 py-2 text-right">Shown</th>
                <th className="px-3 py-2 text-right">Accepted</th>
                <th className="px-3 py-2 text-right">Dismissed</th>
                <th className="px-3 py-2 text-right">Accept rate</th>
                <th className="px-3 py-2 text-right">Median hrs to act</th>
                <th className="px-3 py-2 text-right">👍 / 👎</th>
                <th className="px-3 py-2 text-right">Order 28d (acc vs ign)</th>
              </tr>
            </thead>
            <tbody>
              {ai.byType.map((t) => (
                <tr key={t.type} className="border-line/60 border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{TYPE_LABEL[t.type] ?? t.type}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.shown}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.accepted}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.dismissed}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtPct(t.acceptanceRate, 0)}
                  </td>
                  <td className="text-muted px-3 py-2 text-right tabular-nums">
                    {t.medianHoursToAction != null ? t.medianHoursToAction.toFixed(1) : '—'}
                  </td>
                  <td className="text-muted px-3 py-2 text-right tabular-nums">
                    {t.thumbsUp} / {t.thumbsDown}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {t.orderRateAccepted != null || t.orderRateIgnored != null
                      ? `${fmtPct(t.orderRateAccepted, 0)} vs ${fmtPct(t.orderRateIgnored, 0)}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted mt-2 text-[11px]">
          &ldquo;Order 28d&rdquo; compares accepted vs ignored next-best-actions by whether an order
          followed within 28 days (back-filled nightly) — reported as influenced, never caused.
          Heavier AI users may differ systematically; comparisons are directional.
        </p>
      </Card>

      {/* ── DQ history ── */}
      <Card className="p-4">
        <SectionTitle>Data-quality history (monthly)</SectionTitle>
        {!dqHistory || dqHistory.length === 0 ? (
          <p className="text-muted text-sm">
            First snapshot freezes tonight. Live scores are on the Admin page.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-line text-muted border-b text-left text-xs uppercase">
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Completeness</th>
                  <th className="px-3 py-2 text-right">Freshness</th>
                  <th className="px-3 py-2 text-right">Stalled</th>
                  <th className="px-3 py-2 text-right">Gate violations</th>
                </tr>
              </thead>
              <tbody>
                {dqHistory.map((d) => (
                  <tr key={d.period} className="border-line/60 border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{fmtMonthYear(d.period + '-01')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtPct(d.completeness, 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(d.freshness, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.stalled}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.gate_violations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Export shelf ── */}
      <Card className="p-4">
        <SectionTitle>Report exports</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <a href="/export/snapshot-pack" className="btn-primary" data-tap>⬇ Monthly snapshot pack</a>
          <a href="/export/roi-bridge" className="btn-secondary" data-tap>⬇ ROI bridge template</a>
          <a href="/export/call-coverage" className="btn-secondary" data-tap>⬇ Call coverage</a>
          <a href="/export/touches" className="btn-secondary" data-tap>⬇ Touch log</a>
          <a href="/export/pipeline" className="btn-secondary" data-tap>⬇ Pipeline</a>
          <a href="/export/accounts" className="btn-secondary" data-tap>⬇ Accounts</a>
          <a href="/export/branches" className="btn-secondary" data-tap>⬇ Branches</a>
          <a href="/export/my-day" className="btn-secondary" data-tap>⬇ My Day queue</a>
          <a href="/export/baseline" className="btn-secondary" data-tap>⬇ Baseline freeze</a>
        </div>
        <p className="text-muted mt-2 text-[11px]">
          All exports respect role scoping and reflect live data at download time — except the
          baseline freeze, the permanent &ldquo;before&rdquo; record. Download the{' '}
          <strong>monthly snapshot pack at each month end</strong> and file it with the baseline:
          that sequence is the case-study dataset. Deal journeys export from any opportunity&rsquo;s
          edit page.
        </p>
      </Card>
    </div>
  );
}
