'use client';

import { DataTable, type Column } from '@/components/DataTable';
import { fmtCurrency, fmtDate } from '@/lib/format';
import type { SalesTransactionRow } from '@/types/database';

export function OrderHistoryTable({ rows }: { rows: SalesTransactionRow[] }) {
  const columns: Column<SalesTransactionRow>[] = [
    {
      key: 'date',
      header: 'Date',
      sort: (t) => t.date,
      cell: (t) => <span className="tabular-nums">{fmtDate(t.date)}</span>,
    },
    {
      key: 'invoice',
      header: 'Invoice',
      sort: (t) => t.invoice_nbr ?? t.so_nbr,
      filter: (t) => `${t.invoice_nbr ?? ''} ${t.so_nbr ?? ''}`,
      cell: (t) => <span className="text-muted">{t.invoice_nbr ?? t.so_nbr ?? '—'}</span>,
    },
    {
      key: 'item',
      header: 'Item',
      sort: (t) => t.inventory_description ?? t.inventory_id,
      filter: (t) => `${t.inventory_description ?? ''} ${t.inventory_id ?? ''}`,
      cell: (t) => t.inventory_description ?? t.inventory_id ?? '—',
    },
    {
      key: 'line',
      header: 'Line',
      sort: (t) => t.product_line,
      filter: (t) => t.product_line,
      cell: (t) => (
        <span className="bg-canvas rounded px-1.5 py-0.5 text-xs">{t.product_line}</span>
      ),
    },
    {
      key: 'net',
      header: 'Net sale',
      align: 'right',
      sort: (t) => t.net_sale,
      cell: (t) => <span className="tabular-nums">{fmtCurrency(t.net_sale)}</span>,
    },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sort: (t) => t.margin,
      cell: (t) => <span className="text-muted tabular-nums">{fmtCurrency(t.margin)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sort: (t) => t.status,
      filter: (t) => t.status,
      cell: (t) => <span className="text-muted">{t.status}</span>,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      initialSortKey="date"
      initialDir="desc"
      searchPlaceholder="Filter orders by item, invoice, line…"
      minWidth={760}
      rowKey={(t) => t.id}
    />
  );
}
