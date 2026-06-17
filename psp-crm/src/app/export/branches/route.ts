import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { xlsxResponse, stamp } from '@/lib/export/xlsx';
import { whiteSpaceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireSession();
  const supabase = await createClient();
  const [{ data: branches }, { data: accounts }] = await Promise.all([
    supabase.from('branch_metrics').select('*').order('ttm_revenue', { ascending: false }),
    supabase.from('accounts').select('id,name'),
  ]);
  const aName = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const rows = (branches ?? []).map((b) => ({
    Branch: b.branch_name,
    Account: aName.get(b.account_id) ?? '',
    City: b.city ?? '',
    State: b.state ?? '',
    'TTM revenue': b.ttm_revenue,
    'Prior revenue': b.prior_revenue,
    'Change %': b.delta_pct != null ? Math.round(b.delta_pct * 1000) / 10 : '',
    'Aluminum TTM': b.aluminum_ttm,
    'Steel TTM': b.steel_ttm,
    'GM %': b.gm_pct != null ? Math.round(b.gm_pct * 1000) / 10 : '',
    'Last order': b.last_order_date ?? '',
    'Days idle': b.days_idle ?? '',
    Status: b.status,
    Coverage: b.coverage_rag,
    'White-space': whiteSpaceLabel(b.white_space),
  }));
  return xlsxResponse(`psp-branches-${stamp()}.xlsx`, rows, 'Branches');
}
