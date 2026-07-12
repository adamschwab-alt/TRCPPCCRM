import Link from 'next/link';
import { Card, SectionTitle } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { getActivityReport } from '@/lib/usage/queries';
import { fmtMinutes } from '@/lib/usage/summarize';

export const dynamic = 'force-dynamic';

const fmtWhen = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles',
      })
    : '—';

/** Admin-only: who is using the CRM, for how long, and what they changed. */
export default async function ActivityPage() {
  await requireRole('admin');
  const { users, changes, trackingLive } = await getActivityReport();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-charcoal text-xl font-bold tracking-tight">User activity</h1>
        <Link href="/admin" className="text-brand-700 text-sm hover:underline">
          ← Back to Admin
        </Link>
      </div>

      <Card className="p-4">
        <SectionTitle>Usage (last 30 days)</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          Time on site counts minutes a tab was open and visible — idle background tabs don&rsquo;t
          count. Visits are sessions separated by 30+ minutes away. Times shown in Pacific.
        </p>
        {!trackingLive && (
          <p className="mb-3 rounded-md bg-[var(--color-watch-bg)] px-3 py-2 text-xs text-[var(--color-watch)]">
            No usage pings recorded yet — time-on-site starts accruing from the first visit after
            this feature is deployed (and migration 0013 is applied).
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Last seen</th>
                <th className="px-2 py-2 text-right">Time (7d)</th>
                <th className="px-2 py-2 text-right">Time (30d)</th>
                <th className="px-2 py-2 text-right">Days active</th>
                <th className="px-2 py-2 text-right">Visits</th>
                <th className="px-2 py-2 text-right">Changes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId} className="border-line/60 border-b last:border-0">
                  <td className="px-2 py-2">
                    <div className="text-charcoal font-medium">{u.name}</div>
                    <div className="text-muted text-xs">{u.email}</div>
                  </td>
                  <td className="text-muted px-2 py-2 capitalize">
                    {u.role}
                    {!u.isActive && ' (inactive)'}
                  </td>
                  <td className="text-muted px-2 py-2 whitespace-nowrap">{fmtWhen(u.lastSeenAt)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtMinutes(u.minutes7d)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtMinutes(u.minutes30d)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{u.activeDays30d || '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{u.sessions30d || '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{u.changes30d || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Changes made (last 30 days)</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          Every create, edit, delete, sync, and logged touch — newest first, up to 200.
        </p>
        {changes.length === 0 ? (
          <p className="text-muted text-sm">No changes recorded in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-line text-muted border-b text-left text-xs uppercase">
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Who</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">What</th>
                  <th className="px-2 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.id} className="border-line/60 border-b last:border-0">
                    <td className="text-muted px-2 py-2 whitespace-nowrap">{fmtWhen(c.at)}</td>
                    <td className="px-2 py-2">{c.actorName ?? 'System'}</td>
                    <td className="px-2 py-2 capitalize">{c.action.replace(/_/g, ' ')}</td>
                    <td className="text-muted px-2 py-2 capitalize">{c.entity ?? '—'}</td>
                    <td className="text-muted max-w-[280px] truncate px-2 py-2 text-xs">
                      {c.detail ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
