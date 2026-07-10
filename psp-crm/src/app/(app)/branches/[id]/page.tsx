import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, KpiTile, SectionTitle, StatusBadge, RagBadge } from '@/components/ui';
import { getBranch, getBranchTransactions } from '@/lib/metrics/queries';
import { createClient } from '@/lib/supabase/server';
import { fmtCurrencyShort, fmtDeltaPct, fmtPct, fmtDate, whiteSpaceLabel } from '@/lib/format';
import { OrderHistoryTable } from '../OrderHistoryTable';

export const dynamic = 'force-dynamic';

const TIER_LABELS: Record<number, string> = {
  1: 'Executive',
  2: 'Regional/District',
  3: 'Ops/Fleet',
  4: 'Purchasing/Finance',
  5: 'Branch',
};

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const branch = await getBranch(id);
  if (!branch) notFound();
  const txns = await getBranchTransactions(id, 100);

  // People at THIS branch (contacts carry branch_id from the wiring import).
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('branch_id', id)
    .order('tier');

  return (
    <div>
      <Link
        href={`/accounts/${branch.account_id}`}
        className="text-brand-700 text-sm hover:underline"
      >
        ← Account
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-charcoal text-xl font-bold tracking-tight">{branch.branch_name}</h1>
        <StatusBadge status={branch.status} />
        <RagBadge rag={branch.coverage_rag} />
        <span className="text-muted text-sm">
          {[branch.city, branch.state].filter(Boolean).join(', ')}
        </span>
        <Link
          href={`/branches/${branch.branch_id}/edit`}
          className="btn-secondary ml-auto px-3 py-1 text-xs"
          data-tap
        >
          Edit
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="TTM revenue" value={fmtCurrencyShort(branch.ttm_revenue)} />
        <KpiTile
          label="Prior revenue"
          value={fmtCurrencyShort(branch.prior_revenue)}
          sub={`${fmtDeltaPct(branch.delta_pct)} YoY`}
          tone={branch.delta < 0 ? 'bad' : 'good'}
        />
        <KpiTile label="Gross margin" value={fmtPct(branch.gm_pct)} />
        <KpiTile
          label="Cadence"
          value={branch.days_idle !== null ? `${branch.days_idle}d idle` : '—'}
          sub={`Last order ${fmtDate(branch.last_order_date)}`}
          tone={branch.coverage_rag === 'At-risk' ? 'bad' : 'neutral'}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Aluminum (TTM)" value={fmtCurrencyShort(branch.aluminum_ttm)} />
        <KpiTile label="Steel (TTM)" value={fmtCurrencyShort(branch.steel_ttm)} />
        <KpiTile
          label="White-space"
          value={whiteSpaceLabel(branch.white_space)}
          tone={branch.white_space === '—' ? 'good' : 'warn'}
        />
      </div>

      <div className="mt-6">
        <SectionTitle>Contacts at this branch ({(contacts ?? []).length})</SectionTitle>
        <Card className="p-4">
          {(contacts ?? []).length === 0 ? (
            <p className="text-muted text-sm">
              None yet — add contacts on the{' '}
              <Link
                href={`/accounts/${branch.account_id}`}
                className="text-brand-700 hover:underline"
              >
                account page
              </Link>{' '}
              and pick this branch.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(contacts ?? []).map((c) => (
                <li key={c.id} className="bg-canvas rounded-md px-3 py-2">
                  <div className="text-charcoal text-sm font-medium">
                    {c.name}
                    {c.title && <span className="text-muted font-normal"> · {c.title}</span>}
                  </div>
                  <div className="text-muted text-xs">
                    Tier {c.tier} — {TIER_LABELS[c.tier] ?? '—'}
                    {c.covered_by && <> · covered by {c.covered_by}</>}
                  </div>
                  <div className="text-muted text-xs">
                    {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted mt-3 text-[11px]">
            Manage (edit/remove) contacts from the{' '}
            <Link
              href={`/accounts/${branch.account_id}`}
              className="text-brand-700 hover:underline"
            >
              account page
            </Link>
            .
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle>Order history (latest {txns.length})</SectionTitle>
        {txns.length === 0 ? (
          <Card className="text-muted p-8 text-center text-sm">No transactions.</Card>
        ) : (
          <OrderHistoryTable rows={txns} />
        )}
      </div>
    </div>
  );
}
