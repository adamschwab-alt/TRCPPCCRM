import { KpiTile } from '@/components/ui';
import { requireSession, isStaff } from '@/lib/auth';
import { getMyDayData, getReps } from '@/lib/myday/queries';
import { fmtCurrencyShort } from '@/lib/format';
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

  const [data, reps] = await Promise.all([getMyDayData(repId), staff ? getReps() : Promise.resolve([])]);
  const { rows, summary, cadence } = data;

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
          label="Reorder overdue"
          value={String(summary.overdueCount)}
          sub={`${fmtCurrencyShort(summary.overdueDollars)} TTM idle · >${cadence}d`}
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

      <p className="text-muted mt-4 mb-3 text-xs">
        Ranked by dollars at stake × urgency. Branches you&rsquo;ve touched in the last two weeks
        drop down automatically. Log a touch to keep the queue moving.
      </p>

      <MyDayTable rows={rows} showOwner={staff && !repId} />
    </div>
  );
}
