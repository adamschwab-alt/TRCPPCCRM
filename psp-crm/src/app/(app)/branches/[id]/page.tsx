import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, KpiTile, SectionTitle, StatusBadge, RagBadge } from '@/components/ui';
import { getBranch, getBranchTransactions } from '@/lib/metrics/queries';
import {
  fmtCurrency,
  fmtCurrencyShort,
  fmtDeltaPct,
  fmtPct,
  fmtDate,
  whiteSpaceLabel,
} from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const branch = await getBranch(id);
  if (!branch) notFound();
  const txns = await getBranchTransactions(id, 100);

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
        <SectionTitle>Order history (latest {txns.length})</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Invoice</th>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Line</th>
                <th className="px-4 py-2.5 text-right">Net sale</th>
                <th className="px-4 py-2.5 text-right">Margin</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="border-line/60 border-b last:border-0">
                  <td className="px-4 py-2 tabular-nums">{fmtDate(t.date)}</td>
                  <td className="text-muted px-4 py-2">{t.invoice_nbr ?? t.so_nbr ?? '—'}</td>
                  <td className="px-4 py-2">{t.inventory_description ?? t.inventory_id ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className="bg-canvas rounded px-1.5 py-0.5 text-xs">
                      {t.product_line}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtCurrency(t.net_sale)}</td>
                  <td className="text-muted px-4 py-2 text-right tabular-nums">
                    {fmtCurrency(t.margin)}
                  </td>
                  <td className="text-muted px-4 py-2">{t.status}</td>
                </tr>
              ))}
              {txns.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted px-4 py-8 text-center">
                    No transactions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
