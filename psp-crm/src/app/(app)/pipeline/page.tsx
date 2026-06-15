import Link from 'next/link';
import { Card, KpiTile, SectionTitle } from '@/components/ui';
import { getOpportunities, getTargets, type EnrichedOpportunity } from '@/lib/pipeline/queries';
import { fmtCurrencyShort, fmtDate, fmtPct } from '@/lib/format';
import type { OppStage } from '@/types/database';

export const dynamic = 'force-dynamic';

const STAGES: OppStage[] = ['Qualified', 'Quoted', 'Verbal', 'Won', 'Lost'];
const OPEN: OppStage[] = ['Qualified', 'Quoted', 'Verbal'];

export default async function PipelinePage() {
  const [opps, targets] = await Promise.all([getOpportunities(), getTargets()]);

  const open = opps.filter((o) => OPEN.includes(o.stage));
  const totalAmount = open.reduce((s, o) => s + (o.amount ?? 0), 0);
  const weighted = open.reduce((s, o) => s + (o.weighted_amount ?? 0), 0);
  const quarterlyTarget = (targets?.new_biz_target ?? 10_000_000) / 4;
  const coverage = quarterlyTarget > 0 ? weighted / quarterlyTarget : null;
  const covTarget = targets?.pipeline_coverage_target ?? 1.5;

  const byStage = (s: OppStage) => opps.filter((o) => o.stage === s);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-charcoal text-xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted text-sm">
            {open.length} open · {opps.length} total opportunities
          </p>
        </div>
        <Link href="/pipeline/new" className="btn-primary" data-tap>
          + New opportunity
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Open pipeline"
          value={fmtCurrencyShort(totalAmount)}
          sub={`${open.length} opportunities`}
        />
        <KpiTile
          label="Weighted pipeline"
          value={fmtCurrencyShort(weighted)}
          sub="amount × win %"
        />
        <KpiTile
          label="Coverage ratio"
          value={coverage == null ? '—' : coverage.toFixed(2) + '×'}
          tone={
            coverage == null
              ? 'neutral'
              : coverage >= covTarget
                ? 'good'
                : coverage >= covTarget * 0.7
                  ? 'warn'
                  : 'bad'
          }
          sub={`Target ${covTarget}× · vs ${fmtCurrencyShort(quarterlyTarget)}/qtr`}
        />
        <KpiTile
          label="Closed-won"
          value={String(byStage('Won').length)}
          sub="won opportunities"
          tone="good"
        />
      </div>

      {/* Kanban */}
      <section className="mt-6">
        <SectionTitle>Board</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STAGES.map((s) => {
            const col = byStage(s);
            const sum = col.reduce((a, o) => a + (o.amount ?? 0), 0);
            return (
              <div key={s} className="border-line bg-canvas rounded-lg border p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-charcoal-2 text-xs font-bold tracking-wide uppercase">
                    {s}
                  </span>
                  <span className="text-muted text-xs">
                    {col.length} · {fmtCurrencyShort(sum)}
                  </span>
                </div>
                <div className="space-y-2">
                  {col.map((o) => (
                    <OppCard key={o.id} o={o} />
                  ))}
                  {col.length === 0 && <p className="text-muted px-1 py-2 text-xs">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Table */}
      <section className="mt-6">
        <SectionTitle>All opportunities</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-4 py-2.5">Account</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Stage</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Win %</th>
                <th className="px-4 py-2.5 text-right">Weighted</th>
                <th className="px-4 py-2.5">Close</th>
                <th className="px-4 py-2.5">Next step</th>
              </tr>
            </thead>
            <tbody>
              {opps.map((o) => (
                <tr key={o.id} className="border-line/60 hover:bg-canvas border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/pipeline/${o.id}`}
                      className="text-brand-700 font-medium hover:underline"
                    >
                      {o.account_name ?? '—'}
                    </Link>
                    {o.branch_name && <div className="text-muted text-xs">{o.branch_name}</div>}
                  </td>
                  <td className="text-muted px-4 py-2.5">{labelType(o.type)}</td>
                  <td className="px-4 py-2.5">{o.stage}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtCurrencyShort(o.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {o.win_prob != null ? fmtPct(o.win_prob, 0) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtCurrencyShort(o.weighted_amount)}
                  </td>
                  <td className="text-muted px-4 py-2.5">{fmtDate(o.expected_close)}</td>
                  <td className="text-muted px-4 py-2.5">{o.next_step ?? '—'}</td>
                </tr>
              ))}
              {opps.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted px-4 py-8 text-center">
                    No opportunities yet — click “New opportunity”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

function OppCard({ o }: { o: EnrichedOpportunity }) {
  return (
    <Link
      href={`/pipeline/${o.id}`}
      className="border-line bg-surface hover:border-brand block rounded-md border p-2"
    >
      <div className="text-charcoal text-sm font-medium">{o.account_name ?? '—'}</div>
      <div className="text-muted mt-1 flex items-center justify-between text-xs">
        <span>{fmtCurrencyShort(o.amount)}</span>
        <span>{o.win_prob != null ? fmtPct(o.win_prob, 0) : ''}</span>
      </div>
    </Link>
  );
}

function labelType(t: string | null) {
  return t === 'new_branch_activation'
    ? 'Branch activation'
    : t === 'displacement'
      ? 'Displacement'
      : t === 'new_logo'
        ? 'New logo'
        : t === 'expansion'
          ? 'Expansion'
          : '—';
}
