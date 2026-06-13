import Link from 'next/link';
import { KpiTile, Card, SectionTitle } from '@/components/ui';
import { requireSession } from '@/lib/auth';
import {
  getPortfolioKpis,
  getTargets,
  getAppSettings,
  getTopContractingAccounts,
  getWhitespaceSummary,
  getPastCadenceCount,
} from '@/lib/metrics/queries';
import { fmtCurrencyShort, fmtPct, fmtDeltaPct, fmtDate, fmtCurrency } from '@/lib/format';

export const dynamic = 'force-dynamic';

function tone(value: number | null, target: number, dir: 'gte' | 'lte') {
  if (value === null) return 'neutral' as const;
  if (dir === 'gte') return value >= target ? 'good' : value >= target * 0.9 ? 'warn' : 'bad';
  return value <= target ? 'good' : value <= target * 1.3 ? 'warn' : 'bad';
}

export default async function DashboardPage() {
  const { profile } = await requireSession();
  const [kpis, targets, settings] = await Promise.all([
    getPortfolioKpis(),
    getTargets(),
    getAppSettings(),
  ]);

  // Empty state — workbook not yet seeded.
  if (!kpis || kpis.prior_book === 0) {
    return (
      <div>
        <PageHeader role={profile.role} asOf={settings?.as_of_date} />
        <Card className="mt-6 p-8 text-center">
          <p className="text-charcoal text-lg font-semibold">No coverage data yet</p>
          <p className="text-muted mx-auto mt-2 max-w-md text-sm">
            Import <code className="bg-canvas rounded px-1">PSP_Account_Coverage_Tracker.xlsx</code>{' '}
            to populate the dashboard. Run{' '}
            <code className="bg-canvas rounded px-1">
              npm run db:seed -- ./data/PSP_Account_Coverage_Tracker.xlsx
            </code>
            .
          </p>
        </Card>
      </div>
    );
  }

  const [leak, whitespace, pastCadence] = await Promise.all([
    getTopContractingAccounts(8),
    getWhitespaceSummary(),
    getPastCadenceCount(targets?.cadence_days ?? 75),
  ]);

  const grrTarget = targets?.grr_target ?? 0.88;
  const nrrTarget = targets?.nrr_target ?? 1.18;
  const ceiling = targets?.contraction_ceiling ?? 5_000_000;
  const newBizTarget = targets?.new_biz_target ?? 10_000_000;

  const ws = Object.fromEntries(whitespace.map((w) => [w.white_space, w]));
  const steelGap = ws['Steel gap'];
  const aluGap = ws['Alu gap'];

  return (
    <div>
      <PageHeader role={profile.role} asOf={settings?.as_of_date} />

      {/* KPI tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Current book (TTM)"
          value={fmtCurrencyShort(kpis.current_book)}
          sub={
            <span>
              Prior {fmtCurrencyShort(kpis.prior_book)} ·{' '}
              <span
                className={
                  kpis.yoy && kpis.yoy >= 0
                    ? 'text-[var(--color-ontrack)]'
                    : 'text-[var(--color-atrisk)]'
                }
              >
                {fmtDeltaPct(kpis.yoy)} YoY
              </span>
            </span>
          }
        />
        <KpiTile
          label="GRR"
          flagship
          value={fmtPct(kpis.grr)}
          tone={tone(kpis.grr, grrTarget, 'gte')}
          sub={`Target ${fmtPct(grrTarget, 0)}`}
        />
        <KpiTile
          label="NRR"
          value={fmtPct(kpis.nrr)}
          tone={tone(kpis.nrr, nrrTarget, 'gte')}
          sub={`Target ${fmtPct(nrrTarget, 0)}`}
        />
        <KpiTile label="Gross margin" value={fmtPct(kpis.gm_pct)} sub="TTM blended" />
        <KpiTile
          label="Contraction"
          value={fmtCurrencyShort(kpis.contraction)}
          tone={tone(kpis.contraction, ceiling, 'lte')}
          sub={`Ceiling ${fmtCurrencyShort(ceiling)}`}
        />
        <KpiTile
          label="Expansion"
          value={fmtCurrencyShort(kpis.expansion)}
          tone="good"
          sub="Growth in retained"
        />
        <KpiTile
          label="New business"
          value={fmtCurrencyShort(kpis.new_business)}
          tone={tone(kpis.new_business, newBizTarget, 'gte')}
          sub={`${kpis.new_accounts} new · target ${fmtCurrencyShort(newBizTarget)}`}
        />
        <KpiTile
          label="Past reorder cadence"
          value={String(pastCadence)}
          tone={pastCadence > 0 ? 'warn' : 'good'}
          sub={`Branches idle > ${targets?.cadence_days ?? 75}d`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Where the leak is */}
        <Card className="p-4 lg:col-span-2">
          <SectionTitle>Where the leak is — top contracting accounts</SectionTitle>
          {leak.length === 0 ? (
            <p className="text-muted text-sm">No contracting accounts. 🎉</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-line text-muted border-b text-left text-xs uppercase">
                  <th className="py-2">Account</th>
                  <th className="py-2 text-right">TTM</th>
                  <th className="py-2 text-right">Prior</th>
                  <th className="py-2 text-right">Δ</th>
                  <th className="py-2 text-right">Δ%</th>
                </tr>
              </thead>
              <tbody>
                {leak.map((a) => (
                  <tr key={a.account_id} className="border-line/60 border-b last:border-0">
                    <td className="py-2">
                      <Link
                        href={`/accounts/${a.account_id}`}
                        className="text-brand-700 font-medium hover:underline"
                      >
                        {a.account_name}
                      </Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {fmtCurrencyShort(a.ttm_revenue)}
                    </td>
                    <td className="text-muted py-2 text-right tabular-nums">
                      {fmtCurrencyShort(a.prior_revenue)}
                    </td>
                    <td className="py-2 text-right font-semibold text-[var(--color-atrisk)] tabular-nums">
                      {fmtCurrency(a.delta)}
                    </td>
                    <td className="text-muted py-2 text-right tabular-nums">
                      {fmtDeltaPct(a.delta_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Cross-sell white-space */}
        <Card className="p-4">
          <SectionTitle>Cross-sell white-space</SectionTitle>
          <ul className="space-y-3 text-sm">
            <WsRow
              label="Aluminum-only (no steel)"
              count={steelGap?.branch_count}
              value={steelGap?.ttm_revenue}
            />
            <WsRow
              label="Steel-only (no aluminum)"
              count={aluGap?.branch_count}
              value={aluGap?.ttm_revenue}
            />
          </ul>
          <p className="text-muted mt-4 text-xs">
            White-space = branches buying one product line but not the other — the clearest
            cross-sell openings.
          </p>
        </Card>
      </div>
    </div>
  );
}

function WsRow({ label, count, value }: { label: string; count?: number; value?: number }) {
  return (
    <li className="bg-canvas flex items-center justify-between rounded-md px-3 py-2">
      <span className="text-charcoal-2">{label}</span>
      <span className="text-right">
        <span className="text-charcoal font-bold tabular-nums">{count ?? 0}</span>
        <span className="text-muted ml-2 text-xs">{fmtCurrencyShort(value ?? 0)}</span>
      </span>
    </li>
  );
}

function PageHeader({ role, asOf }: { role: string; asOf?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-charcoal text-xl font-bold tracking-tight">Coverage Dashboard</h1>
        <p className="text-muted text-sm">
          {role === 'rep' ? 'Your book' : 'Full portfolio'} · as of {fmtDate(asOf)}
        </p>
      </div>
    </div>
  );
}
