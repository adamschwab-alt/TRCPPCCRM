import * as XLSX from 'xlsx';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── Placeholder cost anchors (blueprint 10★): swap in real numbers when known.
// Every assumption is marked; nothing here pretends to be measured.
const PLACEHOLDER = {
  FULLY_LOADED_REP_COST_PER_YEAR: 120_000,
  ADMIN_HOURS_SAVED_PER_REP_PER_WEEK: 2,
  WORK_HOURS_PER_YEAR: 2_080,
  REP_COUNT: 6,
};

/**
 * ROI / EBITDA bridge TEMPLATE (blueprint §9). Measured inputs come live from
 * the CRM; assumption cells are explicitly marked [PLACEHOLDER]. The bridge is
 * a starting frame for the case study, not a claim — replace placeholders and
 * the deltas fill in as post-rollout months accrue.
 */
export async function GET() {
  await requireRole('admin', 'manager');
  const supabase = await createClient();
  const { data: k } = await supabase.from('portfolio_kpis').select('*').maybeSingle();
  const { data: opps } = await supabase
    .from('opportunities')
    .select('stage,amount,type,product_line');
  const wonCrossSell = (opps ?? [])
    .filter((o) => o.stage === 'Won' && (o.type === 'expansion' || o.type === 'new_branch_activation'))
    .reduce((s, o) => s + (o.amount ?? 0), 0);

  const gm = k?.gm_pct ?? 0.55;
  const priorBook = k?.prior_book ?? 0;
  const hourlyCost =
    PLACEHOLDER.FULLY_LOADED_REP_COST_PER_YEAR / PLACEHOLDER.WORK_HOURS_PER_YEAR;
  const productivityValue =
    PLACEHOLDER.ADMIN_HOURS_SAVED_PER_REP_PER_WEEK * 52 * PLACEHOLDER.REP_COUNT * hourlyCost;

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Assumption: 'Fully-loaded rep cost / yr', Value: PLACEHOLDER.FULLY_LOADED_REP_COST_PER_YEAR, Status: '[PLACEHOLDER — replace]' },
      { Assumption: 'Admin hrs saved / rep / wk', Value: PLACEHOLDER.ADMIN_HOURS_SAVED_PER_REP_PER_WEEK, Status: '[PLACEHOLDER — survey reps]' },
      { Assumption: 'Rep count', Value: PLACEHOLDER.REP_COUNT, Status: '[PLACEHOLDER — confirm]' },
      { Assumption: 'Gross margin % (measured)', Value: Math.round(gm * 1000) / 10, Status: 'MEASURED (portfolio KPIs)' },
      { Assumption: 'Prior-year book (measured)', Value: priorBook, Status: 'MEASURED' },
    ]),
    'Assumptions',
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Lever: '1. Retention lift',
        Basis: 'GRR delta post-rollout × prior book × GM%',
        'How measured': 'GRR from monthly snapshot packs vs baseline freeze (baseline GRR ≈ 84%)',
        'Annual value': '= (GRR_post − GRR_baseline) × prior book × GM% — fills in after 2+ quarters',
        Status: 'AWAITING POST-PERIOD DATA',
      },
      {
        Lever: '2. Cross-sell conversion',
        Basis: 'Won expansion / branch-activation deals × GM%',
        'How measured': `Won cross-sell to date: $${Math.round(wonCrossSell).toLocaleString('en-US')} (live)`,
        'Annual value': Math.round(wonCrossSell * gm),
        Status: wonCrossSell > 0 ? 'MEASURED (live)' : 'AWAITING FIRST WINS',
      },
      {
        Lever: '3. Rep productivity',
        Basis: 'Admin hours saved × loaded hourly cost',
        'How measured': 'Placeholder hrs × measured rep count; validate by survey',
        'Annual value': Math.round(productivityValue),
        Status: '[PLACEHOLDER-DRIVEN]',
      },
      {
        Lever: '4. Forecast reliability',
        Basis: 'Planning/working-capital benefit of accuracy trend',
        'How measured': 'MAPE trend from forecast snapshots (Reports page)',
        'Annual value': 'Qualitative — narrate, do not book',
        Status: 'QUALITATIVE',
      },
    ]),
    'ROI bridge',
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      { Note: 'Levers 1–2 use measured CRM data; lever 3 is placeholder-driven until the rep survey; lever 4 stays qualitative.' },
      { Note: 'Never present placeholder-driven values without the [PLACEHOLDER] label — credibility is the product.' },
      { Note: 'Pair this bridge with: baseline freeze, monthly snapshot packs, dose-response chart, 3–5 deal journeys, dated testimonials.' },
    ]),
    'Read me',
  );

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="psp-roi-bridge-template.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
