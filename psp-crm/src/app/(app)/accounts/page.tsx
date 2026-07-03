import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/metrics/queries';
import { AccountsTable, type AccountVM } from './AccountsTable';

export const dynamic = 'force-dynamic';

// Drill-through filters (linked from the dashboard KPI tiles). Predicates
// mirror the portfolio_kpis definitions so the list ties to the tile's number.
const FILTERS: Record<
  string,
  { label: string; hint: string; test: (a: AccountVM) => boolean; sortKey?: string }
> = {
  new: {
    label: 'New business',
    hint: 'Accounts with revenue this year and none in the prior year.',
    test: (a) => a.status === 'New',
  },
  contracting: {
    label: 'Contracting',
    hint: 'Retained accounts buying less than last year — the contraction number.',
    test: (a) => a.delta < 0 && a.status !== 'Lapsed',
    sortKey: 'delta',
  },
  expanding: {
    label: 'Expanding',
    hint: 'Retained accounts growing over last year — what drives NRR.',
    test: (a) => a.delta > 0 && a.status !== 'New',
  },
  lapsed: {
    label: 'Lapsed',
    hint: 'Bought last year, nothing this year — win-back targets.',
    test: (a) => a.status === 'Lapsed',
    sortKey: 'prior',
  },
};

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.filter ? FILTERS[sp.filter] : undefined;

  const accounts = await getAccounts();
  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('id,full_name,email');
  const ownerName = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  const all: AccountVM[] = accounts.map((a) => ({
    ...a,
    owner_name: a.owner_id ? (ownerName.get(a.owner_id) ?? null) : null,
  }));
  const rows = filter ? all.filter(filter.test) : all;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-charcoal text-xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted text-sm">
            {rows.length} {filter ? `of ${all.length}` : ''} parent accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/export/accounts" className="btn-secondary" data-tap>
            ⬇ Accounts
          </a>
          <a href="/export/branches" className="btn-secondary" data-tap>
            ⬇ Branches
          </a>
          <Link href="/accounts/new" className="btn-primary" data-tap>
            + New account
          </Link>
        </div>
      </div>

      {filter && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="bg-brand-50 text-brand-700 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
            {filter.label} · {rows.length}
            <Link href="/accounts" className="hover:text-charcoal font-bold" aria-label="Clear filter">
              ✕
            </Link>
          </span>
          <span className="text-muted text-xs">{filter.hint}</span>
        </div>
      )}

      <div className="mt-5">
        <AccountsTable
          rows={rows}
          initialSortKey={filter?.sortKey ?? 'ttm'}
          initialDir={filter?.sortKey === 'delta' ? 'asc' : 'desc'}
        />
      </div>
    </div>
  );
}
