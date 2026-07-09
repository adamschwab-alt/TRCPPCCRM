import Link from 'next/link';
import { Card, KpiTile, SectionTitle } from '@/components/ui';
import {
  getOpportunities,
  getTargets,
  getOppRisk,
  type EnrichedOpportunity,
} from '@/lib/pipeline/queries';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logRiskShown } from '@/lib/ai/recs';
import { fmtCurrencyShort, fmtPct } from '@/lib/format';
import type { OppStage } from '@/types/database';
import { PipelineTable } from './PipelineTable';

export const dynamic = 'force-dynamic';

const STAGES: OppStage[] = ['Qualified', 'Quoted', 'Verbal', 'Won', 'Lost'];
const OPEN: OppStage[] = ['Qualified', 'Quoted', 'Verbal'];

export default async function PipelinePage() {
  const { userId } = await requireSession();
  const [opps, targets] = await Promise.all([getOpportunities(), getTargets()]);
  const riskByOpp = await getOppRisk(opps);

  // Flags the viewer saw today = AI exposure (logged once per opp per day).
  if (Object.keys(riskByOpp).length > 0) {
    const supabase = await createClient();
    await logRiskShown(
      supabase,
      userId,
      Object.entries(riskByOpp).map(([oppId, r]) => ({
        opportunityId: oppId,
        accountId: opps.find((o) => o.id === oppId)?.account_id ?? null,
        label: r.flags.map((f) => f.label).join(' · '),
        detail: r.flags.map((f) => f.detail).join(' '),
        score: r.score,
      })),
    ).catch(() => {}); // pre-0009 database → skip silently
  }

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
        <div className="flex items-center gap-2">
          <a href="/export/pipeline" className="btn-secondary" data-tap>
            ⬇ Excel
          </a>
          <Link href="/pipeline/new" className="btn-primary" data-tap>
            + New opportunity
          </Link>
        </div>
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
        {opps.length === 0 ? (
          <Card className="text-muted p-8 text-center text-sm">
            No opportunities yet — click “New opportunity”.
          </Card>
        ) : (
          <PipelineTable rows={opps} riskByOpp={riskByOpp} />
        )}
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
