import Link from 'next/link';
import { KpiTile } from '@/components/ui';
import { requireSession, isStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMyDayData, getReps } from '@/lib/myday/queries';
import { logNbaShown, type RecRef } from '@/lib/ai/recs';
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

  const [data, reps] = await Promise.all([
    getMyDayData(repId),
    staff ? getReps() : Promise.resolve([]),
  ]);
  const { rows, summary, contactsByAccount, callDueAccounts } = data;

  // A rep viewing their own queue = an AI exposure event. Log today's top 10 as
  // next-best-action recommendations (dedup per day) and wire accept/dismiss.
  // Staff browsing other books is not exposure and is not logged.
  let recByBranch: Record<string, RecRef> = {};
  if (!staff && rows.length > 0) {
    const supabase = await createClient();
    const map = await logNbaShown(
      supabase,
      userId,
      rows.slice(0, 10).map((r) => ({
        branchId: r.branch.branch_id,
        accountId: r.branch.account_id,
        action: `Work ${r.branch.branch_name}: ${r.reasons.map((x) => x.label).join(', ')}`,
        reason: r.wiring
          ? `${r.wiring.size}×${r.wiring.rating} wiring · $${Math.round(r.impact).toLocaleString('en-US')} at stake`
          : `$${Math.round(r.impact).toLocaleString('en-US')} at stake`,
        score: Math.round(r.priority),
      })),
    ).catch(() => new Map<string, RecRef>()); // pre-0009 database → skip silently
    recByBranch = Object.fromEntries(map);
  }

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
          label="Call due now"
          value={String(callDueAccounts)}
          sub="accounts past their wiring call cadence"
          tone={callDueAccounts > 0 ? 'warn' : 'good'}
        />
      </div>

      {staff && (
        <p className="text-muted mt-4 text-xs">
          Rep scorecard, touches-per-week, and call-coverage exports live on{' '}
          <Link href="/call-tracking" className="text-brand-700 hover:underline">
            Activity &amp; Call Tracking
          </Link>
          .
        </p>
      )}

      <p className="text-muted mt-4 mb-3 text-xs">
        Ranked by dollars at stake × urgency against each account&rsquo;s wiring cadence. Branches
        you&rsquo;ve touched in the last two weeks drop down automatically. Log a touch to keep the
        queue moving.
      </p>

      <MyDayTable
        rows={rows}
        showOwner={staff && !repId}
        contactsByAccount={contactsByAccount}
        recByBranch={recByBranch}
      />
    </div>
  );
}
