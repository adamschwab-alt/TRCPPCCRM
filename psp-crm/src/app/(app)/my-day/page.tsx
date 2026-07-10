import Link from 'next/link';
import { KpiTile, Card, SectionTitle } from '@/components/ui';
import { requireSession, isStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getMyDayData, getReps } from '@/lib/myday/queries';
import {
  getAccountOptions,
  getMyTasks,
  getRecentActivities,
  type EnrichedTask,
} from '@/lib/activities/queries';
import { setTaskStatus } from '../activities/actions';
import { LogActivityForm, AddTaskForm } from '../activities/ActivityForms';
import { logNbaShown, type RecRef } from '@/lib/ai/recs';
import { fmtCurrencyShort, fmtDate } from '@/lib/format';
import { RepPicker } from './RepPicker';
import { MyDayTable } from './MyDayTable';

const TYPE_ICON: Record<string, string> = { call: '📞', visit: '🚗', email: '✉️', note: '📝' };

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

  const [data, reps, accountOptions, tasks, recent] = await Promise.all([
    getMyDayData(repId),
    staff ? getReps() : Promise.resolve([]),
    getAccountOptions(),
    getMyTasks(userId),
    getRecentActivities(12),
  ]);
  const { rows, summary, contactsByAccount, callDueAccounts } = data;

  const today = new Date().toISOString().slice(0, 10);
  const openTasks = tasks.filter((t) => t.status === 'open');
  const overdueTasks = openTasks.filter((t) => t.due_date && t.due_date < today);
  const doneTasks = tasks.filter((t) => t.status === 'done').slice(0, 5);

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
          label="Order overdue"
          value={String(summary.overdueCount)}
          sub={`${fmtCurrencyShort(summary.overdueDollars)} TTM with no order past cadence`}
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

      {overdueTasks.length > 0 && (
        <a
          href="#tasks"
          className="mt-4 flex items-center gap-2 rounded-md bg-[var(--color-watch-bg)] px-3 py-2 text-sm font-medium text-[var(--color-watch)]"
          data-tap
        >
          ⚠ {overdueTasks.length} overdue task{overdueTasks.length === 1 ? '' : 's'} — oldest:
          &ldquo;{overdueTasks[0].title}&rdquo; (due {overdueTasks[0].due_date}) · jump to tasks ↓
        </a>
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

      {/* Tasks + history (merged from the old Activities page) */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className="p-4">
            <SectionTitle>Log activity</SectionTitle>
            <p className="text-muted mb-2 text-xs">
              Account-level note — branch touches log faster from the queue above.
            </p>
            <LogActivityForm accounts={accountOptions} />
          </Card>
          <Card className="p-4">
            <SectionTitle>Add task</SectionTitle>
            <AddTaskForm accounts={accountOptions} />
          </Card>
        </div>

        <Card className="scroll-mt-20 p-4" id="tasks">
          <SectionTitle>My open tasks ({openTasks.length})</SectionTitle>
          <ul className="space-y-2">
            {openTasks.map((t) => (
              <TaskItem key={t.id} t={t} today={today} />
            ))}
            {openTasks.length === 0 && <li className="text-muted text-sm">Nothing open. 🎉</li>}
          </ul>
          {doneTasks.length > 0 && (
            <>
              <div className="text-muted mt-4 mb-2 text-xs font-semibold uppercase">
                Recently done
              </div>
              <ul className="space-y-1">
                {doneTasks.map((t) => (
                  <li key={t.id} className="text-muted flex items-center justify-between text-sm">
                    <span className="line-through">{t.title}</span>
                    <form action={setTaskStatus.bind(null, t.id, 'open')}>
                      <button className="text-brand-700 text-xs hover:underline" data-tap>
                        undo
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle>Recent activity</SectionTitle>
          <ul className="space-y-3">
            {recent.map((a) => (
              <li key={a.id} className="border-line/60 border-b pb-3 last:border-0">
                <div className="flex items-center gap-2 text-sm">
                  <span>{TYPE_ICON[a.type] ?? '•'}</span>
                  <span className="text-charcoal font-medium capitalize">{a.type}</span>
                  {a.account_name && <span className="text-muted">· {a.account_name}</span>}
                  {a.contact_name && <span className="text-muted">· {a.contact_name}</span>}
                </div>
                {a.body && <p className="text-charcoal-2 mt-1 text-sm">{a.body}</p>}
                <div className="text-muted mt-1 text-xs">
                  {a.user_name ?? 'Someone'} · {fmtDate(a.occurred_at.slice(0, 10))}
                </div>
              </li>
            ))}
            {recent.length === 0 && <li className="text-muted text-sm">No activity logged yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function TaskItem({ t, today }: { t: EnrichedTask; today: string }) {
  const overdue = t.due_date && t.due_date < today;
  return (
    <li className="bg-canvas flex items-start justify-between gap-2 rounded-md px-3 py-2">
      <div>
        <div className="text-charcoal text-sm font-medium">{t.title}</div>
        <div className="text-muted text-xs">
          {t.account_name && <span>{t.account_name} · </span>}
          {t.due_date ? (
            <span className={overdue ? 'font-semibold text-[var(--color-atrisk)]' : ''}>
              due {fmtDate(t.due_date)}
            </span>
          ) : (
            'no due date'
          )}
        </div>
      </div>
      <form action={setTaskStatus.bind(null, t.id, 'done')}>
        <button
          className="border-line bg-surface rounded-md border px-2 py-1 text-xs font-medium hover:bg-white"
          data-tap
        >
          Done
        </button>
      </form>
    </li>
  );
}
