import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CoverageTable, type CoverageRow } from './CoverageTable';
import type { WhiteSpace } from '@/types/database';

export const dynamic = 'force-dynamic';

// Drill-through filters (linked from the dashboard's white-space card).
const WS_FILTERS: Record<string, { ws: WhiteSpace; label: string }> = {
  'steel-gap': { ws: 'Steel gap', label: 'Aluminum-only (no steel)' },
  'alu-gap': { ws: 'Alu gap', label: 'Steel-only (no aluminum)' },
  both: { ws: 'Both', label: 'No aluminum or steel' },
};
const RAG_FILTERS: Record<string, { rag: string; label: string; hint: string }> = {
  'at-risk': {
    rag: 'At-risk',
    label: 'At-risk branches',
    hint: 'Lapsed, declining, or idle past cadence — what drags GRR.',
  },
  watch: { rag: 'Watch', label: 'Watch branches', hint: 'Softening — worth an early call.' },
};

/**
 * Coverage Tracker — the in-app equivalent of the workbook's per-branch tab:
 * every branch with days-since-last-order and cross-sell white-space. Sortable
 * and filterable; supports ?ws= / ?rag= / ?idle=over drill-throughs from the
 * dashboard (these replaced the old Worklists page).
 */
export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string; rag?: string; idle?: string }>;
}) {
  const sp = await searchParams;
  const wsFilter = sp.ws ? WS_FILTERS[sp.ws] : undefined;
  const ragFilter = sp.rag ? RAG_FILTERS[sp.rag] : undefined;
  const idleOver = sp.idle === 'over';

  const supabase = await createClient();
  const [{ data: branches }, { data: accounts }, { data: targets }] = await Promise.all([
    supabase.from('branch_metrics').select('*').order('ttm_revenue', { ascending: false }),
    supabase.from('accounts').select('id,name'),
    supabase.from('targets').select('cadence_days').eq('id', true).maybeSingle(),
  ]);
  const cadenceDays = targets?.cadence_days ?? 75;
  const aName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const all: CoverageRow[] = (branches ?? []).map((b) => ({
    ...b,
    account_name: b.account_id ? (aName.get(b.account_id) ?? null) : null,
  }));
  let rows = wsFilter ? all.filter((b) => b.white_space === wsFilter.ws) : all;
  if (ragFilter) rows = rows.filter((b) => b.coverage_rag === ragFilter.rag);
  if (idleOver) rows = rows.filter((b) => b.days_idle != null && b.days_idle > cadenceDays);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-charcoal text-xl font-bold tracking-tight">Coverage Tracker</h1>
          <p className="text-muted text-sm">
            {rows.length} branches · days since last order &amp; cross-sell white-space
          </p>
        </div>
        <a href="/export/branches" className="btn-secondary" data-tap>
          ⬇ Excel
        </a>
      </div>

      {(wsFilter || ragFilter || idleOver) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="bg-brand-50 text-brand-700 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
            {wsFilter
              ? `Cross-sell: ${wsFilter.label}`
              : ragFilter
                ? ragFilter.label
                : `Idle > ${cadenceDays}d`}{' '}
            · {rows.length}
            <Link href="/coverage" className="hover:text-charcoal font-bold" aria-label="Clear filter">
              ✕
            </Link>
          </span>
          <span className="text-muted text-xs">
            {wsFilter
              ? 'These branches buy one product line but not the other — each is a cross-sell call.'
              : ragFilter
                ? ragFilter.hint
                : 'No order beyond the reorder window — win the next order back.'}
          </span>
        </div>
      )}

      <div className="mt-5">
        <CoverageTable rows={rows} initialSortKey={idleOver ? 'idle' : 'ttm'} initialDir="desc" />
      </div>
    </div>
  );
}
