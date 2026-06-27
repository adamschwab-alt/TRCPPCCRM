'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge, RagBadge } from '@/components/ui';
import { fmtCurrencyShort, fmtDeltaPct, fmtPct, fmtDate, whiteSpaceLabel } from '@/lib/format';
import type { BranchMetricsRow } from '@/types/database';

export type CoverageRow = BranchMetricsRow & { account_name: string | null };

export function CoverageTable({
  rows,
  initialSortKey = 'ttm',
  initialDir = 'desc',
}: {
  rows: CoverageRow[];
  initialSortKey?: string;
  initialDir?: 'asc' | 'desc';
}) {
  const columns: Column<CoverageRow>[] = [
    {
      key: 'branch',
      header: 'Branch',
      sort: (b) => b.branch_name,
      filter: (b) => `${b.branch_name} ${b.account_name ?? ''} ${b.city ?? ''} ${b.state ?? ''}`,
      cell: (b) => (
        <Link
          href={`/branches/${b.branch_id}`}
          className="text-brand-700 font-medium hover:underline"
        >
          {b.branch_name}
        </Link>
      ),
    },
    {
      key: 'account',
      header: 'Account',
      sort: (b) => b.account_name,
      filter: (b) => b.account_name ?? '',
      cell: (b) => <span className="text-muted">{b.account_name ?? '—'}</span>,
    },
    {
      key: 'state',
      header: 'State',
      sort: (b) => b.state,
      cell: (b) => <span className="text-muted">{b.state ?? '—'}</span>,
    },
    {
      key: 'ttm',
      header: 'TTM',
      align: 'right',
      sort: (b) => b.ttm_revenue,
      cell: (b) => <span className="tabular-nums">{fmtCurrencyShort(b.ttm_revenue)}</span>,
    },
    {
      key: 'delta',
      header: 'Δ%',
      align: 'right',
      sort: (b) => b.delta_pct,
      cell: (b) => (
        <span className={`tabular-nums ${b.delta < 0 ? 'text-[var(--color-atrisk)]' : ''}`}>
          {fmtDeltaPct(b.delta_pct)}
        </span>
      ),
    },
    {
      key: 'gm',
      header: 'GM%',
      align: 'right',
      sort: (b) => b.gm_pct,
      cell: (b) => <span className="text-muted tabular-nums">{fmtPct(b.gm_pct, 0)}</span>,
    },
    {
      key: 'last',
      header: 'Last order',
      sort: (b) => b.last_order_date,
      cell: (b) => <span className="text-muted">{fmtDate(b.last_order_date)}</span>,
    },
    {
      key: 'idle',
      header: 'Days idle',
      align: 'right',
      sort: (b) => b.days_idle,
      cell: (b) => (
        <span
          className={`font-semibold tabular-nums ${b.days_idle != null && b.days_idle > 75 ? 'text-[var(--color-watch)]' : 'text-muted'}`}
        >
          {b.days_idle != null ? `${b.days_idle}d` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sort: (b) => b.status,
      filter: (b) => b.status,
      cell: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: 'coverage',
      header: 'Coverage',
      sort: (b) => b.coverage_rag,
      filter: (b) => b.coverage_rag,
      cell: (b) => <RagBadge rag={b.coverage_rag} />,
    },
    {
      key: 'ws',
      header: 'White-space',
      sort: (b) => b.white_space,
      filter: (b) => whiteSpaceLabel(b.white_space),
      cell: (b) =>
        b.white_space === '—' ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-xs font-semibold">
            {whiteSpaceLabel(b.white_space)}
          </span>
        ),
    },
  ];

  const onMobile = new Set(['branch', 'ttm', 'idle', 'ws']);
  for (const c of columns) c.hideOnMobile = !onMobile.has(c.key);

  return (
    <DataTable
      rows={rows}
      columns={columns}
      initialSortKey={initialSortKey}
      initialDir={initialDir}
      searchPlaceholder="Filter branches, accounts, status…"
      rowKey={(b) => b.branch_id}
      compact
    />
  );
}
