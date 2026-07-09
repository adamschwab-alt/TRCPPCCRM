'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/DataTable';
import { fmtCurrencyShort, fmtDate } from '@/lib/format';
import type { CallCoverageRow } from '@/lib/activity/queries';

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
  ];

  const onMobile = new Set(['account', 'ttm', 'due']);
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
