import { requireSession } from '@/lib/auth';
import { getRecentActivities } from '@/lib/activities/queries';
import { xlsxResponse, stamp } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/** Full touch log export (RLS-scoped: reps get their own; staff get everyone's). */
export async function GET() {
  await requireSession();
  const touches = await getRecentActivities(5000);
  const rows = touches.map((t) => ({
    Date: t.occurred_at.slice(0, 10),
    Time: t.occurred_at.slice(11, 16),
    Rep: t.user_name ?? '',
    Account: t.account_name ?? '',
    Contact: t.contact_name ?? '',
    Type: t.type,
    Outcome: t.outcome ?? '',
    Source: t.source ?? 'manual',
    Note: t.body ?? '',
  }));
  return xlsxResponse(`psp-touches-${stamp()}.xlsx`, rows, 'Touches');
}
