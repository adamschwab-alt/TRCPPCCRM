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

/**
 * Coverage Tracker — the in-app equivalent of the workbook's per-branch tab:
 * every branch with days-since-last-order and cross-sell white-space. Sortable
 * and filterable; supports ?ws= drill-throughs from the dashboard.
 */
export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>;
}) {
  const sp = await searchParams;
  const wsFilter = sp.ws ? WS_FILTERS[sp.ws] : undefined;

  const supabase = await createClient();
  const [{ data: branches }, { data: accounts }] = await Promise.all([
    supabase.from('branch_metrics').select('*').order('ttm_revenue', { ascending: false }),
    supabase.from('accounts').select('id,name'),
  ]);
  const aName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const all: CoverageRow[] = (branches ?? []).map((b) => ({
    ...b,
    account_name: b.account_id ? (aName.get(b.account_id) ?? null) : null,
  }));
  const rows = wsFilter ? all.filter((b) => b.white_space === wsFilter.ws) : all;

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

      {wsFilter && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="bg-brand-50 text-brand-700 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
            Cross-sell: {wsFilter.label} · {rows.length}
            <Link href="/coverage" className="hover:text-charcoal font-bold" aria-label="Clear filter">
              ✕
            </Link>
          </span>
          <span className="text-muted text-xs">
            These branches buy one product line but not the other — each is a cross-sell call.
          </span>
        </div>
      )}

      <div className="mt-5">
        <CoverageTable rows={rows} />
      </div>
    </div>
  );
}
