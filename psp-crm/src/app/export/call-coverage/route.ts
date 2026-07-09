import { requireSession } from '@/lib/auth';
import { getActivityData } from '@/lib/activity/queries';
import { xlsxResponse, stamp } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/** Call-coverage report: every account's cadence, last touch, and due status. */
export async function GET() {
  await requireSession();
  const { rows } = await getActivityData();
  const out = rows.map((r) => ({
    Account: r.account_name,
    Rep: r.owner_name ?? '',
    'TTM revenue': r.ttm_revenue,
    Size: r.wiring.size,
    Rating: r.wiring.rating,
    'Touches/yr plan': r.wiring.callsPerYear,
    'Interval (days)': r.wiring.intervalDays ?? '',
    'Last touch': r.last_touch_at ? r.last_touch_at.slice(0, 10) : 'never',
    'Days since touch': r.days_since_touch ?? '',
    'Due in (days)': r.due_in ?? '',
    Status: r.status === 'ok' ? 'OK' : r.status === 'due' ? 'Due now' : 'Never touched',
    'Touches 90d': r.touches_90d,
  }));
  return xlsxResponse(`psp-call-coverage-${stamp()}.xlsx`, out, 'Call coverage');
}
