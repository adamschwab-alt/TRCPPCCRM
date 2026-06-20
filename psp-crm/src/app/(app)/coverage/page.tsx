import { createClient } from '@/lib/supabase/server';
import { CoverageTable, type CoverageRow } from './CoverageTable';

export const dynamic = 'force-dynamic';

/**
 * Coverage Tracker — the in-app equivalent of the workbook's per-branch tab:
 * every branch with days-since-last-order and cross-sell white-space. Sortable
 * and filterable.
 */
export default async function CoveragePage() {
  const supabase = await createClient();
  const [{ data: branches }, { data: accounts }] = await Promise.all([
    supabase.from('branch_metrics').select('*').order('ttm_revenue', { ascending: false }),
    supabase.from('accounts').select('id,name'),
  ]);
  const aName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const rows: CoverageRow[] = (branches ?? []).map((b) => ({
    ...b,
    account_name: b.account_id ? (aName.get(b.account_id) ?? null) : null,
  }));

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

      <div className="mt-5">
        <CoverageTable rows={rows} />
      </div>
    </div>
  );
}
