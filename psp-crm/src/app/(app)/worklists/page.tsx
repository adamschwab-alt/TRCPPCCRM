import Link from 'next/link';
import { Card, RagBadge, StatusBadge } from '@/components/ui';
import {
  getAtRiskBranches,
  getPastCadenceBranches,
  getWhitespaceBranches,
  getLapsedAccounts,
  getWorklistCounts,
  type WorklistKey,
} from '@/lib/worklists/queries';
import { fmtCurrencyShort, fmtDeltaPct, fmtDate, whiteSpaceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TABS: { key: WorklistKey; label: string }[] = [
  { key: 'at-risk', label: 'At-risk' },
  { key: 'cadence', label: 'Past cadence' },
  { key: 'whitespace', label: 'Cross-sell' },
  { key: 'lapsed', label: 'Lapsed' },
];

export default async function WorklistsPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const sp = await searchParams;
  const active = (TABS.find((t) => t.key === sp.list)?.key ?? 'at-risk') as WorklistKey;
  const counts = await getWorklistCounts();

  return (
    <div>
      <h1 className="text-charcoal text-xl font-bold tracking-tight">Worklists</h1>
      <p className="text-muted text-sm">Action lists generated from your coverage data.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/worklists?list=${t.key}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              active === t.key
                ? 'bg-brand text-white'
                : 'border-line bg-surface text-charcoal-2 hover:bg-canvas border'
            }`}
            data-tap
          >
            {t.label}{' '}
            <span className={active === t.key ? 'opacity-80' : 'text-muted'}>{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      <div className="mt-5">
        {active === 'at-risk' && <AtRisk />}
        {active === 'cadence' && <Cadence />}
        {active === 'whitespace' && <Whitespace />}
        {active === 'lapsed' && <Lapsed />}
      </div>
    </div>
  );
}

async function AtRisk() {
  const rows = await getAtRiskBranches();
  return (
    <Wrap
      title="At-risk branches"
      hint="Lapsed, declining, or idle past cadence — prioritize outreach."
    >
      <table className="w-full min-w-[720px] text-sm">
        <Head cols={['Branch', 'Account state', 'TTM', 'Δ%', 'Idle', 'Status', 'Coverage']} />
        <tbody>
          {rows.map((b) => (
            <tr key={b.branch_id} className="border-line/60 hover:bg-canvas border-b last:border-0">
              <td className="px-4 py-2.5">
                <Link
                  href={`/branches/${b.branch_id}`}
                  className="text-brand-700 font-medium hover:underline"
                >
                  {b.branch_name}
                </Link>
              </td>
              <td className="text-muted px-4 py-2.5">
                {[b.city, b.state].filter(Boolean).join(', ') || '—'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {fmtCurrencyShort(b.ttm_revenue)}
              </td>
              <td
                className={`px-4 py-2.5 text-right tabular-nums ${b.delta < 0 ? 'text-[var(--color-atrisk)]' : ''}`}
              >
                {fmtDeltaPct(b.delta_pct)}
              </td>
              <td className="text-muted px-4 py-2.5 text-right tabular-nums">
                {b.days_idle != null ? `${b.days_idle}d` : '—'}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={b.status} />
              </td>
              <td className="px-4 py-2.5">
                <RagBadge rag={b.coverage_rag} />
              </td>
            </tr>
          ))}
          <Empty show={rows.length === 0} cols={7} msg="No at-risk branches. 🎉" />
        </tbody>
      </table>
    </Wrap>
  );
}

async function Cadence() {
  const { rows, cadence } = await getPastCadenceBranches();
  return (
    <Wrap
      title="Past reorder cadence"
      hint={`Branches with no order in more than ${cadence} days.`}
    >
      <table className="w-full min-w-[680px] text-sm">
        <Head cols={['Branch', 'Location', 'Last order', 'Idle', 'TTM', 'Status']} />
        <tbody>
          {rows.map((b) => (
            <tr key={b.branch_id} className="border-line/60 hover:bg-canvas border-b last:border-0">
              <td className="px-4 py-2.5">
                <Link
                  href={`/branches/${b.branch_id}`}
                  className="text-brand-700 font-medium hover:underline"
                >
                  {b.branch_name}
                </Link>
              </td>
              <td className="text-muted px-4 py-2.5">
                {[b.city, b.state].filter(Boolean).join(', ') || '—'}
              </td>
              <td className="text-muted px-4 py-2.5">{fmtDate(b.last_order_date)}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-[var(--color-watch)] tabular-nums">
                {b.days_idle}d
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {fmtCurrencyShort(b.ttm_revenue)}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={b.status} />
              </td>
            </tr>
          ))}
          <Empty show={rows.length === 0} cols={6} msg="Everyone's ordered recently. 🎉" />
        </tbody>
      </table>
    </Wrap>
  );
}

async function Whitespace() {
  const rows = await getWhitespaceBranches();
  return (
    <Wrap title="Cross-sell white-space" hint="Branches buying one product line but not the other.">
      <table className="w-full min-w-[680px] text-sm">
        <Head cols={['Branch', 'Location', 'Aluminum TTM', 'Steel TTM', 'Gap', 'Status']} />
        <tbody>
          {rows.map((b) => (
            <tr key={b.branch_id} className="border-line/60 hover:bg-canvas border-b last:border-0">
              <td className="px-4 py-2.5">
                <Link
                  href={`/branches/${b.branch_id}`}
                  className="text-brand-700 font-medium hover:underline"
                >
                  {b.branch_name}
                </Link>
              </td>
              <td className="text-muted px-4 py-2.5">
                {[b.city, b.state].filter(Boolean).join(', ') || '—'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {fmtCurrencyShort(b.aluminum_ttm)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {fmtCurrencyShort(b.steel_ttm)}
              </td>
              <td className="px-4 py-2.5">
                <span className="bg-brand-50 text-brand-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                  {whiteSpaceLabel(b.white_space)}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={b.status} />
              </td>
            </tr>
          ))}
          <Empty show={rows.length === 0} cols={6} msg="No cross-sell gaps." />
        </tbody>
      </table>
    </Wrap>
  );
}

async function Lapsed() {
  const rows = await getLapsedAccounts();
  return (
    <Wrap title="Lapsed accounts" hint="Bought last year, nothing this year — win-back targets.">
      <table className="w-full min-w-[620px] text-sm">
        <Head cols={['Account', 'State', 'Branches', 'Prior revenue', 'Last order']} />
        <tbody>
          {rows.map((a) => (
            <tr
              key={a.account_id}
              className="border-line/60 hover:bg-canvas border-b last:border-0"
            >
              <td className="px-4 py-2.5">
                <Link
                  href={`/accounts/${a.account_id}`}
                  className="text-brand-700 font-medium hover:underline"
                >
                  {a.account_name}
                </Link>
              </td>
              <td className="text-muted px-4 py-2.5">{a.primary_state ?? '—'}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{a.branch_count}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-[var(--color-atrisk)] tabular-nums">
                {fmtCurrencyShort(a.prior_revenue)}
              </td>
              <td className="text-muted px-4 py-2.5">{fmtDate(a.last_order_date)}</td>
            </tr>
          ))}
          <Empty show={rows.length === 0} cols={5} msg="No lapsed accounts. 🎉" />
        </tbody>
      </table>
    </Wrap>
  );
}

function Wrap({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-x-auto">
      <div className="border-line border-b px-4 py-3">
        <h2 className="text-charcoal text-sm font-semibold">{title}</h2>
        <p className="text-muted text-xs">{hint}</p>
      </div>
      {children}
    </Card>
  );
}

function Head({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-line text-muted border-b text-left text-xs uppercase">
        {cols.map((c, i) => (
          <th key={c} className={`px-4 py-2.5 ${i >= 2 ? 'text-right' : ''}`}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Empty({ show, cols, msg }: { show: boolean; cols: number; msg: string }) {
  if (!show) return null;
  return (
    <tr>
      <td colSpan={cols} className="text-muted px-4 py-8 text-center">
        {msg}
      </td>
    </tr>
  );
}
