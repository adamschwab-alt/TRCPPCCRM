import Link from 'next/link';
import { Card, KpiTile, SectionTitle } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { getActivityData } from '@/lib/activity/queries';
import { getRecentActivities } from '@/lib/activities/queries';
import { fmtCurrencyShort, fmtPct, fmtDeltaPct, fmtDate } from '@/lib/format';
import { CallCoverageTable } from './CallCoverageTable';
import { ReportsSection } from './ReportsSection';

export const dynamic = 'force-dynamic';

const REP_COLORS = ['#b45f2f', '#3f6f5a', '#5a6b8c', '#8c5a7d', '#7d7d46', '#46707d', '#a04848'];

function Tabs({ active }: { active: 'activity' | 'reports' }) {
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium ${
      on ? 'bg-brand text-white' : 'border-line bg-surface text-charcoal-2 hover:bg-canvas border'
    }`;
  return (
    <div className="mt-4 flex gap-2">
      <Link href="/call-tracking" className={pill(active === 'activity')} data-tap>
        Call tracking
      </Link>
      <Link href="/call-tracking?tab=reports" className={pill(active === 'reports')} data-tap>
        Reports
      </Link>
    </div>
  );
}

export default async function CallTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole('admin', 'manager');
  const sp = await searchParams;

  if (sp.tab === 'reports') {
    return (
      <div>
        <div>
          <h1 className="text-charcoal text-xl font-bold tracking-tight">
            Activity &amp; Call Tracking
          </h1>
          <p className="text-muted text-sm">
            Forecast accuracy · AI adoption · data-quality history — the measurement record behind
            the case study.
          </p>
        </div>
        <Tabs active="reports" />
        <div className="mt-5">
          <ReportsSection />
        </div>
      </div>
    );
  }

  const [data, recent] = await Promise.all([getActivityData(), getRecentActivities(15)]);
  const { rows, scorecard, series, kpis } = data;
  const maxWeek = Math.max(1, ...series.weeks.map((_, i) => series.reps.reduce((s, r) => s + r.counts[i], 0)));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-charcoal text-xl font-bold tracking-tight">
            Activity &amp; Call Tracking
          </h1>
          <p className="text-muted text-sm">
            Call frequency vs plan · touchpoints · rep coverage — cadence from the Customer Wiring
            matrix
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/export/call-coverage" className="btn-secondary" data-tap>
            ⬇ Coverage
          </a>
          <a href="/export/touches" className="btn-secondary" data-tap>
            ⬇ Touches
          </a>
        </div>
      </div>
      <Tabs active="activity" />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile
          label="Due now"
          value={String(kpis.dueNow)}
          sub="accounts overdue for a touch"
          tone={kpis.dueNow > 0 ? 'warn' : 'good'}
        />
        <KpiTile
          label="Touches this week"
          value={String(kpis.touchesThisWeek)}
          sub={`plan pace ≈ ${kpis.planPerWeek.toFixed(1)} / week`}
        />
        <KpiTile
          label="Coverage"
          value={fmtPct(kpis.coveragePct, 0)}
          sub="accounts inside their cadence window"
          tone={(kpis.coveragePct ?? 0) >= 0.8 ? 'good' : 'warn'}
        />
        <KpiTile
          label="Book value (TTM)"
          value={fmtCurrencyShort(kpis.bookTtm)}
          sub={`${kpis.accounts} accounts`}
        />
        <KpiTile
          label="Growth YoY"
          value={fmtDeltaPct(kpis.growthPct)}
          sub="TTM vs prior 12 months"
          tone={(kpis.growthPct ?? 0) >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Touches per week — stacked by rep */}
        <Card className="p-4">
          <SectionTitle>Touches per week — by rep</SectionTitle>
          <p className="text-muted mb-3 text-xs">Last 12 weeks · logged touchpoints</p>
          {series.reps.length === 0 ? (
            <p className="text-muted text-sm">No touches logged yet.</p>
          ) : (
            <>
              <div className="flex h-36 items-end gap-1.5">
                {series.weeks.map((w, i) => {
                  const total = series.reps.reduce((s, r) => s + r.counts[i], 0);
                  return (
                    <div
                      key={w}
                      // h-full is load-bearing: without an explicit column height,
                      // the %-sized bar segments collapse to zero.
                      className="flex h-full flex-1 flex-col justify-end gap-px"
                      title={`${w}: ${total}`}
                    >
                      {series.reps.map((r, ri) =>
                        r.counts[i] > 0 ? (
                          <div
                            key={r.repId}
                            style={{
                              height: `${(r.counts[i] / maxWeek) * 100}%`,
                              backgroundColor: REP_COLORS[ri % REP_COLORS.length],
                            }}
                            className="w-full rounded-sm"
                            title={`${r.repName}: ${r.counts[i]}`}
                          />
                        ) : null,
                      )}
                      {total === 0 && <div className="bg-canvas h-px w-full" />}
                    </div>
                  );
                })}
              </div>
              <div className="text-muted mt-1 flex justify-between text-[10px]">
                <span>{fmtDate(series.weeks[0])}</span>
                <span>{fmtDate(series.weeks[series.weeks.length - 1])}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {series.reps.map((r, ri) => (
                  <span key={r.repId} className="text-muted flex items-center gap-1 text-xs">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: REP_COLORS[ri % REP_COLORS.length] }}
                    />
                    {r.repName}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Rep scorecard */}
        <Card className="p-4">
          <SectionTitle>Rep scorecard</SectionTitle>
          <p className="text-muted mb-3 text-xs">Coverage, pace vs plan, retention &amp; growth by rep</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-line text-muted border-b text-left uppercase">
                  <th className="px-2 py-2">Rep</th>
                  <th className="px-2 py-2 text-right">Accts</th>
                  <th className="px-2 py-2 text-right">Wk plan</th>
                  <th className="px-2 py-2 text-right">Wk act</th>
                  <th className="px-2 py-2 text-right">4wk</th>
                  <th className="px-2 py-2 text-right">Coverage</th>
                  <th className="px-2 py-2 text-right">Overdue</th>
                  <th className="px-2 py-2 text-right">TTM rev</th>
                  <th className="px-2 py-2 text-right">Growth</th>
                  <th className="px-2 py-2 text-right">Retention</th>
                </tr>
              </thead>
              <tbody>
                {scorecard.map((r) => (
                  <tr key={r.repId} className="border-line/60 border-b last:border-0">
                    <td className="text-charcoal px-2 py-2 font-medium">{r.repName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.accounts}</td>
                    <td className="text-muted px-2 py-2 text-right tabular-nums">
                      {r.weeklyPlan.toFixed(1)}
                    </td>
                    <td
                      className={`px-2 py-2 text-right font-semibold tabular-nums ${
                        r.weeklyActual >= r.weeklyPlan
                          ? 'text-[var(--color-ontrack)]'
                          : 'text-[var(--color-watch)]'
                      }`}
                    >
                      {r.weeklyActual}
                    </td>
                    <td className="text-muted px-2 py-2 text-right tabular-nums">
                      {r.weekly4Avg.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtPct(r.coveragePct, 0)}</td>
                    <td
                      className={`px-2 py-2 text-right tabular-nums ${
                        r.overdue > 0 ? 'font-semibold text-[var(--color-watch)]' : 'text-muted'
                      }`}
                    >
                      {r.overdue}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {fmtCurrencyShort(r.ttmRevenue)}
                    </td>
                    <td
                      className={`px-2 py-2 text-right tabular-nums ${
                        (r.growthPct ?? 0) < 0
                          ? 'text-[var(--color-atrisk)]'
                          : 'text-[var(--color-ontrack)]'
                      }`}
                    >
                      {fmtDeltaPct(r.growthPct)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtPct(r.retentionPct, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted mt-2 text-[11px]">
            Retention = TTM revenue of accounts that bought last year ÷ their prior-year revenue
            (over 100% = net expansion). Growth = whole book TTM vs prior 12 months. Wk plan = the
            wiring matrix summed over the rep&rsquo;s book.
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle>Accounts — call coverage</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          Sorted by urgency. Click an account to log a touch or manage contacts.
        </p>
        <CallCoverageTable rows={rows} showOwner />
      </div>

      <div className="mt-6">
        <SectionTitle>Recent activity</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Rep</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Outcome</th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-line/60 border-b last:border-0">
                  <td className="text-muted px-3 py-2 whitespace-nowrap">
                    {fmtDate(a.occurred_at.slice(0, 10))}
                  </td>
                  <td className="px-3 py-2">{a.user_name ?? '—'}</td>
                  <td className="text-charcoal px-3 py-2 font-medium">{a.account_name ?? '—'}</td>
                  <td className="text-muted px-3 py-2">{a.contact_name ?? '—'}</td>
                  <td className="px-3 py-2 capitalize">{a.type}</td>
                  <td className="text-muted px-3 py-2">{a.outcome?.replace('_', ' ') ?? '—'}</td>
                  <td className="text-muted max-w-[320px] truncate px-3 py-2">{a.body ?? ''}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted px-3 py-6 text-center">
                    No touches logged yet — they&rsquo;ll appear here the moment reps start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <p className="text-muted mt-4 text-xs">
        Reps see their own call queue with the same due-dates on{' '}
        <Link href="/my-day" className="text-brand-700 hover:underline">
          My Day
        </Link>
        .
      </p>
    </div>
  );
}
