import { KpiTile, Card, SectionTitle } from '@/components/ui';
import { requireSession, isStaff } from '@/lib/auth';
import { getMyDayData, getReps, getScorecard, type ScorecardRow } from '@/lib/myday/queries';
import { fmtCurrencyShort, fmtPct, fmtDeltaPct } from '@/lib/format';
import { RepPicker } from './RepPicker';
import { MyDayTable } from './MyDayTable';

export const dynamic = 'force-dynamic';

export default async function MyDayPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>;
}) {
  const sp = await searchParams;
  const { userId, profile } = await requireSession();
  const staff = isStaff(profile.role);

  // Reps are locked to their own book; staff can toggle to any rep (or all).
  const repId = staff ? sp.rep || undefined : userId;

  const [data, reps, scorecard] = await Promise.all([
    getMyDayData(repId),
    staff ? getReps() : Promise.resolve([]),
    staff ? getScorecard() : Promise.resolve([] as ScorecardRow[]),
  ]);
  const { rows, summary, contactsByAccount } = data;

  const selectedRepName = staff && repId ? reps.find((r) => r.id === repId)?.name : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-charcoal text-xl font-bold tracking-tight">My Day</h1>
          <p className="text-muted text-sm">
            {staff
              ? selectedRepName
                ? `${selectedRepName}'s prioritized branches to work — highest value at stake first.`
                : 'Prioritized branches to work across all reps — highest value at stake first.'
              : 'Your prioritized branches to work today — highest value at stake first.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {staff && <RepPicker reps={reps} current={repId} />}
          <a
            href={`/export/my-day${staff && repId ? `?rep=${repId}` : ''}`}
            className="btn-secondary"
            data-tap
          >
            ⬇ Excel
          </a>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Cadence overdue"
          value={String(summary.overdueCount)}
          sub={`${fmtCurrencyShort(summary.overdueDollars)} TTM idle past wiring cadence`}
          tone={summary.overdueCount > 0 ? 'warn' : 'neutral'}
        />
        <KpiTile
          label="Declining"
          value={String(summary.decliningCount)}
          sub={`${fmtCurrencyShort(summary.decliningDollars)} lost YoY`}
          tone={summary.decliningCount > 0 ? 'bad' : 'neutral'}
        />
        <KpiTile
          label="Cross-sell"
          value={String(summary.whitespaceCount)}
          sub={`${fmtCurrencyShort(summary.whitespaceDollars)} in-line base`}
        />
        <KpiTile
          label="Needs a touch"
          value={String(summary.needsTouchCount)}
          sub="no contact in 30d+"
        />
      </div>

      {staff && !repId && scorecard.length > 0 && (
        <div className="mt-6">
          <SectionTitle>Rep scorecard — plan vs. actual (wiring cadence)</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-line text-muted border-b text-left text-xs uppercase">
                  <th className="px-3 py-2">Rep</th>
                  <th className="px-3 py-2 text-right">Accounts</th>
                  <th className="px-3 py-2 text-right">TTM</th>
                  <th className="px-3 py-2 text-right">YoY</th>
                  <th className="px-3 py-2 text-right">Plan / wk</th>
                  <th className="px-3 py-2 text-right">Actual / wk</th>
                  <th className="px-3 py-2 text-right">Coverage 90d</th>
                  <th className="px-3 py-2 text-right">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {scorecard.map((r) => (
                  <tr key={r.repId} className="border-line/60 border-b last:border-0">
                    <td className="px-3 py-2">
                      <a
                        href={`/my-day?rep=${r.repId}`}
                        className="text-brand-700 font-medium hover:underline"
                      >
                        {r.repName}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.accounts}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtCurrencyShort(r.ttmRevenue)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        (r.growthPct ?? 0) < 0
                          ? 'text-[var(--color-atrisk)]'
                          : 'text-[var(--color-ontrack)]'
                      }`}
                    >
                      {fmtDeltaPct(r.growthPct)}
                    </td>
                    <td className="text-muted px-3 py-2 text-right tabular-nums">
                      {r.weeklyPlan.toFixed(1)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-semibold tabular-nums ${
                        r.weeklyActual >= r.weeklyPlan
                          ? 'text-[var(--color-ontrack)]'
                          : 'text-[var(--color-watch)]'
                      }`}
                    >
                      {r.weeklyActual.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(r.coveragePct, 0)}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        r.overdue > 0 ? 'font-semibold text-[var(--color-watch)]' : 'text-muted'
                      }`}
                    >
                      {r.overdue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-muted mt-2 text-xs">
            Plan = each account&rsquo;s wiring cadence (size × relationship → touches/yr) summed
            over the rep&rsquo;s book, per week. Actual = touches logged in the last 30 days.
            Coverage = share of accounts touched in the last 90 days.
          </p>
        </div>
      )}

      <p className="text-muted mt-4 mb-3 text-xs">
        Ranked by dollars at stake × urgency against each account&rsquo;s wiring cadence. Branches
        you&rsquo;ve touched in the last two weeks drop down automatically. Log a touch to keep the
        queue moving.
      </p>

      <MyDayTable rows={rows} showOwner={staff && !repId} contactsByAccount={contactsByAccount} />
    </div>
  );
}
