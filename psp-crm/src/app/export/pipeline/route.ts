import { requireSession } from '@/lib/auth';
import { getOpportunities } from '@/lib/pipeline/queries';
import { xlsxResponse, stamp } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

const typeLabel: Record<string, string> = {
  new_branch_activation: 'New branch activation',
  displacement: 'Displacement',
  new_logo: 'New logo',
  expansion: 'Expansion',
};

export async function GET() {
  await requireSession();
  const opps = await getOpportunities();
  const rows = opps.map((o) => ({
    Account: o.account_name ?? '',
    Branch: o.branch_name ?? '',
    Type: o.type ? (typeLabel[o.type] ?? o.type) : '',
    'Product line': o.product_line ?? '',
    Stage: o.stage,
    Amount: o.amount ?? '',
    'Win %': o.win_prob != null ? Math.round(o.win_prob * 100) : '',
    Weighted: o.weighted_amount ?? '',
    'GM %': o.gm_pct != null ? Math.round(o.gm_pct * 100) : '',
    'Lead-time risk': o.lead_time_risk ?? '',
    'Expected close': o.expected_close ?? '',
    'Next step': o.next_step ?? '',
    'Next date': o.next_date ?? '',
    Notes: o.notes ?? '',
  }));
  return xlsxResponse(`psp-pipeline-${stamp()}.xlsx`, rows, 'Pipeline');
}
