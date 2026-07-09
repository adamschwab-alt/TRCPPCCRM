'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/DataTable';
import { fmtCurrencyShort, fmtDate, fmtPct } from '@/lib/format';
import type { EnrichedOpportunity, OppRisk } from '@/lib/pipeline/queries';

const typeLabel = (t: string | null) =>
  t === 'new_branch_activation'
    ? 'Branch activation'
    : t === 'displacement'
      ? 'Displacement'
      : t === 'new_logo'
        ? 'New logo'
        : t === 'expansion'
          ? 'Expansion'
          : '—';

export function PipelineTable({
  rows,
  riskByOpp = {},
}: {
  rows: EnrichedOpportunity[];
  riskByOpp?: Record<string, OppRisk>;
}) {
  const columns: Column<EnrichedOpportunity>[] = [
    {
      key: 'risk',
      header: '⚠',
      sort: (o) => riskByOpp[o.id]?.score ?? 0,
      filter: (o) => (riskByOpp[o.id] ? 'at-risk ' + riskByOpp[o.id].flags.map((f) => f.label).join(' ') : ''),
      cell: (o) => {
        const r = riskByOpp[o.id];
        if (!r) return <span className="text-muted">—</span>;
        return (
          <span
            className="inline-block rounded-full bg-[var(--color-watch-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-watch)]"
            title={r.flags.map((f) => `${f.label}: ${f.detail}`).join('\n')}
          >
            ⚠ {r.flags[0].label}
            {r.flags.length > 1 ? ` +${r.flags.length - 1}` : ''}
          </span>
        );
      },
    },
    {
      key: 'account',
      header: 'Account',
      sort: (o) => o.account_name,
      filter: (o) => `${o.account_name ?? ''} ${o.branch_name ?? ''} ${o.next_step ?? ''}`,
      cell: (o) => (
        <span>
          <Link href={`/pipeline/${o.id}`} className="text-brand-700 font-medium hover:underline">
            {o.account_name ?? '—'}
          </Link>
          {o.branch_name && <span className="text-muted block text-xs">{o.branch_name}</span>}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sort: (o) => typeLabel(o.type),
      filter: (o) => typeLabel(o.type),
      cell: (o) => <span className="text-muted">{typeLabel(o.type)}</span>,
    },
    {
      key: 'stage',
      header: 'Stage',
      sort: (o) => o.stage,
      filter: (o) => o.stage,
      cell: (o) => o.stage,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sort: (o) => o.amount,
      cell: (o) => <span className="tabular-nums">{fmtCurrencyShort(o.amount)}</span>,
    },
    {
      key: 'win',
      header: 'Win %',
      align: 'right',
      sort: (o) => o.win_prob,
      cell: (o) => (
        <span className="tabular-nums">{o.win_prob != null ? fmtPct(o.win_prob, 0) : '—'}</span>
      ),
    },
    {
      key: 'weighted',
      header: 'Weighted',
      align: 'right',
      sort: (o) => o.weighted_amount,
      cell: (o) => <span className="tabular-nums">{fmtCurrencyShort(o.weighted_amount)}</span>,
    },
    {
      key: 'close',
      header: 'Close',
      sort: (o) => o.expected_close,
      cell: (o) => <span className="text-muted">{fmtDate(o.expected_close)}</span>,
    },
    {
      key: 'next',
      header: 'Next step',
      sort: (o) => o.next_step,
      cell: (o) => <span className="text-muted">{o.next_step ?? '—'}</span>,
    },
  ];

  const onMobile = new Set(['account', 'stage', 'amount', 'risk']);
  for (const c of columns) c.hideOnMobile = !onMobile.has(c.key);

  return (
    <DataTable
      rows={rows}
      columns={columns}
      initialSortKey="close"
      initialDir="asc"
      searchPlaceholder="Filter opportunities…"
      rowKey={(o) => o.id}
      compact
    />
  );
}
