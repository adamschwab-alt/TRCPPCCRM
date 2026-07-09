import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/metrics/queries';
import { AccountsTable, type AccountVM } from './AccountsTable';
import { CoverageTable, type CoverageRow } from '../coverage/CoverageTable';
import type { WhiteSpace } from '@/types/database';

export const dynamic = 'force-dynamic';

// ── Account-grain drill-through filters (dashboard KPI tiles) ────────────────
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

// ── Branch-grain drill-through filters ───────────────────────────────────────
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

type Search = {
  view?: string;
  filter?: string;
  ws?: string;
  rag?: string;
  idle?: string;
};

/**
 * The book — one page, two grains. "Accounts" (parents) and "Branches"
 * (ship-tos, the coverage tracker) as a toggle; each grain keeps its own
 * drill-through filters from the dashboard.
 */
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const branchView = sp.view === 'branches';

  const supabase = await createClient();
  const accounts = await getAccounts();
  const { data: profiles } = await supabase.from('profiles').select('id,full_name,email');
  const ownerName = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  // ── Branch grain ────────────────────────────────────────────────────────────
  let branchRows: CoverageRow[] = [];
  let branchTotal = 0;
  let branchChip: { label: string; hint: string } | null = null;
  let cadenceDays = 75;
  if (branchView) {
    const [{ data: branches }, { data: targets }] = await Promise.all([
      supabase.from('branch_metrics').select('*').order('ttm_revenue', { ascending: false }),
      supabase.from('targets').select('cadence_days').eq('id', true).maybeSingle(),
    ]);
    cadenceDays = targets?.cadence_days ?? 75;
    const aName = new Map(accounts.map((a) => [a.account_id, a.account_name]));
    const all: CoverageRow[] = (branches ?? []).map((b) => ({
      ...b,
      account_name: b.account_id ? (aName.get(b.account_id) ?? null) : null,
    }));
    branchTotal = all.length;
    const wsFilter = sp.ws ? WS_FILTERS[sp.ws] : undefined;
    const ragFilter = sp.rag ? RAG_FILTERS[sp.rag] : undefined;
    const idleOver = sp.idle === 'over';
    branchRows = all;
    if (wsFilter) {
      branchRows = branchRows.filter((b) => b.white_space === wsFilter.ws);
      branchChip = {
        label: `Cross-sell: ${wsFilter.label}`,
        hint: 'These branches buy one product line but not the other — each is a cross-sell call.',
      };
    }
    if (ragFilter) {
      branchRows = branchRows.filter((b) => b.coverage_rag === ragFilter.rag);
      branchChip = { label: ragFilter.label, hint: ragFilter.hint };
    }
    if (idleOver) {
      branchRows = branchRows.filter((b) => b.days_idle != null && b.days_idle > cadenceDays);
      branchChip = {
        label: `Idle > ${cadenceDays}d`,
        hint: 'No order beyond the reorder window — win the next order back.',
      };
    }
  }

  // ── Account grain ───────────────────────────────────────────────────────────
  const filter = !branchView && sp.filter ? FILTERS[sp.filter] : undefined;
  const all: AccountVM[] = accounts.map((a) => ({
    ...a,
    owner_name: a.owner_id ? (ownerName.get(a.owner_id) ?? null) : null,
  }));
  const rows = filter ? all.filter(filter.test) : all;

  const count = branchView ? branchRows.length : rows.length;
  const total = branchView ? branchTotal : all.length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-charcoal text-xl font-bold tracking-tight">
            {branchView ? 'Branches — coverage tracker' : 'Accounts'}
          </h1>
          <p className="text-muted text-sm">
            {count}
            {count !== total ? ` of ${total}` : ''}{' '}
            {branchView ? 'branches · days since last order & white-space' : 'parent accounts'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={branchView ? '/export/branches' : '/export/accounts'}
            className="btn-secondary"
            data-tap
          >
            ⬇ Excel
          </a>
          {!branchView && (
            <Link href="/accounts/new" className="btn-primary" data-tap>
              + New account
            </Link>
          )}
        </div>
      </div>

      {/* Grain toggle */}
      <div className="mt-4 flex gap-2">
        <Link
          href="/accounts"
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            !branchView
              ? 'bg-brand text-white'
              : 'border-line bg-surface text-charcoal-2 hover:bg-canvas border'
          }`}
          data-tap
        >
          Accounts
        </Link>
        <Link
          href="/accounts?view=branches"
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            branchView
              ? 'bg-brand text-white'
              : 'border-line bg-surface text-charcoal-2 hover:bg-canvas border'
          }`}
          data-tap
        >
          Branches
        </Link>
      </div>

      {/* Filter chips */}
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
      {branchView && branchChip && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="bg-brand-50 text-brand-700 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
            {branchChip.label} · {branchRows.length}
            <Link
              href="/accounts?view=branches"
              className="hover:text-charcoal font-bold"
              aria-label="Clear filter"
            >
              ✕
            </Link>
          </span>
          <span className="text-muted text-xs">{branchChip.hint}</span>
        </div>
      )}

      <div className="mt-5">
        {branchView ? (
          <CoverageTable
            rows={branchRows}
            initialSortKey={sp.idle === 'over' ? 'idle' : 'ttm'}
            initialDir="desc"
          />
        ) : (
          <AccountsTable
            rows={rows}
            initialSortKey={filter?.sortKey ?? 'ttm'}
            initialDir={filter?.sortKey === 'delta' ? 'asc' : 'desc'}
          />
        )}
      </div>
    </div>
  );
}
