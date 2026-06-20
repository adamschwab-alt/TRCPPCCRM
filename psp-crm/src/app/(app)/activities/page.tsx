import { Card, SectionTitle } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import {
  getAccountOptions,
  getMyTasks,
  getRecentActivities,
  type EnrichedTask,
} from '@/lib/activities/queries';
import { setTaskStatus } from './actions';
import { LogActivityForm, AddTaskForm } from './ActivityForms';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TYPE_ICON: Record<string, string> = { call: '📞', visit: '🚗', email: '✉️', note: '📝' };

export default async function ActivitiesPage() {
  const { userId } = await requireSession();
  const [accounts, tasks, activities] = await Promise.all([
    getAccountOptions(),
    getMyTasks(userId),
    getRecentActivities(50),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const open = tasks.filter((t) => t.status === 'open');
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const done = tasks.filter((t) => t.status === 'done').slice(0, 10);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-charcoal text-xl font-bold tracking-tight">Activities &amp; tasks</h1>
          <p className="text-muted text-sm">
            Your day: {open.length} open task{open.length === 1 ? '' : 's'}
            {overdue.length > 0 && (
              <span className="text-[var(--color-atrisk)]"> · {overdue.length} overdue</span>
            )}
          </p>
        </div>
        <a href="/export/activities" className="btn-secondary" data-tap>
          ⬇ Excel
        </a>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: quick add forms */}
        <div className="space-y-6">
          <Card className="p-4">
            <SectionTitle>Log activity</SectionTitle>
            <LogActivityForm accounts={accounts} />
          </Card>
          <Card className="p-4">
            <SectionTitle>Add task</SectionTitle>
            <AddTaskForm accounts={accounts} />
          </Card>
        </div>

        {/* Middle: My Day tasks */}
        <Card className="p-4">
          <SectionTitle>My open tasks</SectionTitle>
          <ul className="space-y-2">
            {open.map((t) => (
              <TaskItem key={t.id} t={t} today={today} />
            ))}
            {open.length === 0 && <li className="text-muted text-sm">Nothing open. 🎉</li>}
          </ul>
          {done.length > 0 && (
            <>
              <div className="text-muted mt-4 mb-2 text-xs font-semibold uppercase">
                Recently done
              </div>
              <ul className="space-y-1">
                {done.map((t) => (
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

        {/* Right: activity feed */}
        <Card className="p-4">
          <SectionTitle>Recent activity</SectionTitle>
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="border-line/60 border-b pb-3 last:border-0">
                <div className="flex items-center gap-2 text-sm">
                  <span>{TYPE_ICON[a.type] ?? '•'}</span>
                  <span className="text-charcoal font-medium capitalize">{a.type}</span>
                  {a.account_name && <span className="text-muted">· {a.account_name}</span>}
                </div>
                {a.body && <p className="text-charcoal-2 mt-1 text-sm">{a.body}</p>}
                <div className="text-muted mt-1 text-xs">
                  {a.user_name ?? 'Someone'} · {fmtDate(a.occurred_at.slice(0, 10))}
                </div>
              </li>
            ))}
            {activities.length === 0 && (
              <li className="text-muted text-sm">No activity logged yet.</li>
            )}
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
