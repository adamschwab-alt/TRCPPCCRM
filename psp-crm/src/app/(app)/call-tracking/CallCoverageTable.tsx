'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/DataTable';
import { logActivity, type FormState } from '../activities/actions';
import { fmtCurrencyShort, fmtDate } from '@/lib/format';
import type { CallCoverageRow } from '@/lib/activity/queries';

/** Manager quick-log: a small modal to record a touch straight from the row. */
function QuickLog({ row }: { row: CallCoverageRow }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(logActivity, {});
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.ok && open) {
      router.refresh();
      const t = setTimeout(() => setOpen(false), 700);
      return () => clearTimeout(t);
    }
  }, [state.ok, open, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary px-2.5 py-1 text-xs"
        data-tap
      >
        Log
      </button>
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface w-full max-w-md rounded-lg p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-charcoal text-sm font-semibold">
              Log touch — {row.account_name}
            </h3>
            <form action={action} className="mt-3 space-y-3">
              <input type="hidden" name="account_id" value={row.account_id} />
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-charcoal-2 mb-1 block text-xs font-medium">Type</span>
                  <select name="type" className="input py-1.5" defaultValue="call">
                    <option value="call">📞 Call</option>
                    <option value="visit">🚗 Visit</option>
                    <option value="email">✉️ Email</option>
                    <option value="note">📝 Note</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-charcoal-2 mb-1 block text-xs font-medium">Outcome</span>
                  <select name="outcome" className="input py-1.5" defaultValue="">
                    <option value="">—</option>
                    <option value="connected">Connected</option>
                    <option value="left_msg">Left message</option>
                    <option value="no_response">No response</option>
                    <option value="meeting_booked">Meeting booked</option>
                    <option value="meeting_held">Meeting held</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-charcoal-2 mb-1 block text-xs font-medium">When</span>
                  <input
                    name="occurred_on"
                    type="date"
                    className="input py-1.5"
                    defaultValue={today}
                    max={today}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-charcoal-2 mb-1 block text-xs font-medium">Note</span>
                <input name="body" className="input py-1.5" placeholder="What happened?" />
              </label>
              {state.error && (
                <p className="text-xs text-[var(--color-atrisk)]">{state.error}</p>
              )}
              {state.ok && <p className="text-xs text-[var(--color-ontrack)]">Logged ✓</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary px-3 py-1.5 text-sm"
                  data-tap
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary px-4 py-1.5 text-sm"
                  data-tap
                >
                  {pending ? 'Saving…' : 'Save touch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function DuePill({ r }: { r: CallCoverageRow }) {
  if (r.wiring.intervalDays == null)
    return <span className="text-muted text-xs">no cadence</span>;
  if (r.status === 'never')
    return (
      <span className="rounded-full bg-[var(--color-atrisk-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-atrisk)]">
        Never touched
      </span>
    );
  if (r.status === 'due')
    return (
      <span className="rounded-full bg-[var(--color-watch-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-watch)]">
        Due now · {Math.abs(r.due_in ?? 0)}d over
      </span>
    );
  return (
    <span className="rounded-full bg-[var(--color-ontrack-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-ontrack)]">
      OK · next in {r.due_in}d
    </span>
  );
}

export function CallCoverageTable({ rows, showOwner }: { rows: CallCoverageRow[]; showOwner: boolean }) {
  const columns: Column<CallCoverageRow>[] = [
    {
      key: 'account',
      header: 'Account',
      sort: (r) => r.account_name,
      filter: (r) => `${r.account_name} ${r.owner_name ?? ''} ${r.status}`,
      cell: (r) => (
        <Link href={`/accounts/${r.account_id}`} className="text-brand-700 font-medium hover:underline">
          {r.account_name}
        </Link>
      ),
    },
    ...(showOwner
      ? ([
          {
            key: 'rep',
            header: 'Rep',
            sort: (r) => r.owner_name,
            filter: (r) => r.owner_name ?? '',
            cell: (r) => <span className="text-muted">{r.owner_name ?? '—'}</span>,
          },
        ] as Column<CallCoverageRow>[])
      : []),
    {
      key: 'ttm',
      header: 'TTM',
      align: 'right',
      sort: (r) => r.ttm_revenue,
      cell: (r) => <span className="tabular-nums">{fmtCurrencyShort(r.ttm_revenue)}</span>,
    },
    {
      key: 'cadence',
      header: 'Cadence',
      sort: (r) => r.wiring.callsPerYear,
      cell: (r) => (
        <span className="text-muted tabular-nums">
          {r.wiring.intervalDays == null
            ? '—'
            : `${r.wiring.callsPerYear}×/yr · ${r.wiring.intervalDays}d`}
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Last touch',
      sort: (r) => r.last_touch_at,
      cell: (r) =>
        r.last_touch_at ? (
          <span className="text-muted">
            {fmtDate(r.last_touch_at.slice(0, 10))} · {r.last_touch_type}
          </span>
        ) : (
          <span className="text-[var(--color-atrisk)]">never</span>
        ),
    },
    {
      key: 't90',
      header: '90d',
      align: 'right',
      sort: (r) => r.touches_90d,
      cell: (r) => <span className="tabular-nums">{r.touches_90d}</span>,
    },
    {
      key: 'due',
      header: 'Status',
      sort: (r) => (r.status === 'never' ? -10000 : (r.due_in ?? 10000)),
      filter: (r) => r.status,
      cell: (r) => <DuePill r={r} />,
    },
    {
      key: 'log',
      header: '',
      cell: (r) => <QuickLog row={r} />,
    },
  ];

  const onMobile = new Set(['account', 'ttm', 'due', 'log']);
  for (const c of columns) c.hideOnMobile = !onMobile.has(c.key);

  return (
    <DataTable
      rows={rows}
      columns={columns}
      initialSortKey="due"
      initialDir="asc"
      searchPlaceholder="Filter accounts, reps, status…"
      rowKey={(r) => r.account_id}
      compact
    />
  );
}
