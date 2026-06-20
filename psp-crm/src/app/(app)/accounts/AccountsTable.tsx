'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/DataTable';
import { StatusBadge, RagBadge } from '@/components/ui';
import { fmtCurrencyShort, fmtDeltaPct } from '@/lib/format';
import type { AccountMetricsRow } from '@/types/database';

export type AccountVM = AccountMetricsRow & { owner_name: string | null };

export function AccountsTable({
  rows,
  initialSortKey = 'ttm',
  initialDir = 'desc',
}: {
  rows: AccountVM[];
  initialSortKey?: string;
  initialDir?: 'asc' | 'desc';
}) {
  const columns: Column<AccountVM>[] = [
    {
      key: 'account',
      header: 'Account',
      sort: (a) => a.account_name,
      filter: (a) => `${a.account_name} ${a.primary_state ?? ''} ${a.owner_name ?? ''} ${a.status}`,
      cell: (a) => (
        <Link
          href={`/accounts/${a.account_id}`}
          className="text-brand-700 font-medium hover:underline"
        >
          {a.account_name}
        </Link>
      ),
    },
    {
      key: 'state',
      header: 'State',
      sort: (a) => a.primary_state,
      cell: (a) => <span className="text-muted">{a.primary_state ?? '—'}</span>,
    },
    {
      key: 'branches',
      header: 'Branches',
      align: 'right',
      sort: (a) => a.branch_count,
      cell: (a) => <span className="tabular-nums">{a.branch_count}</span>,
    },
    {
      key: 'ttm',
      header: 'TTM',
      align: 'right',
      sort: (a) => a.ttm_revenue,
      cell: (a) => <span className="tabular-nums">{fmtCurrencyShort(a.ttm_revenue)}</span>,
    },
    {
      key: 'prior',
      header: 'Prior',
      align: 'right',
      sort: (a) => a.prior_revenue,
      cell: (a) => (
        <span className="text-muted tabular-nums">{fmtCurrencyShort(a.prior_revenue)}</span>
      ),
    },
    {
      key: 'delta',
      header: 'Δ%',
      align: 'right',
      sort: (a) => a.delta_pct,
      cell: (a) => (
        <span
          className={`tabular-nums ${a.delta < 0 ? 'text-[var(--color-atrisk)]' : 'text-[var(--color-ontrack)]'}`}
        >
          {fmtDeltaPct(a.delta_pct)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sort: (a) => a.status,
      filter: (a) => a.status,
      cell: (a) => <StatusBadge status={a.status} />,
    },
    {
      key: 'coverage',
      header: 'Coverage',
      sort: (a) => a.coverage_rag,
      filter: (a) => a.coverage_rag,
      cell: (a) => <RagBadge rag={a.coverage_rag} />,
    },
    {
      key: 'owner',
      header: 'Owner',
      sort: (a) => a.owner_name,
      filter: (a) => a.owner_name ?? '',
      cell: (a) => <span className="text-muted">{a.owner_name ?? '—'}</span>,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      initialSortKey={initialSortKey}
      initialDir={initialDir}
      searchPlaceholder="Filter accounts, owner, status…"
      minWidth={820}
      rowKey={(a) => a.account_id}
    />
  );
}
