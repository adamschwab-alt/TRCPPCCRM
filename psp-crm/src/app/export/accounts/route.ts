import { requireSession } from '@/lib/auth';
import { getAccounts } from '@/lib/metrics/queries';
import { createClient } from '@/lib/supabase/server';
import { xlsxResponse, stamp } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireSession();
  const accounts = await getAccounts();
  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('id,full_name,email');
  const ownerName = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  const rows = accounts.map((a) => ({
    Account: a.account_name,
    State: a.primary_state ?? '',
    Branches: a.branch_count,
    'TTM revenue': a.ttm_revenue,
    'Prior revenue': a.prior_revenue,
    Change: a.delta,
    'Change %': a.delta_pct != null ? Math.round(a.delta_pct * 1000) / 10 : '',
    'GM %': a.gm_pct != null ? Math.round(a.gm_pct * 1000) / 10 : '',
    Status: a.status,
    Coverage: a.coverage_rag,
    'Last order': a.last_order_date ?? '',
    'Days idle': a.days_idle ?? '',
    Owner: a.owner_id ? (ownerName.get(a.owner_id) ?? '') : '',
  }));
  return xlsxResponse(`psp-accounts-${stamp()}.xlsx`, rows, 'Accounts');
}
