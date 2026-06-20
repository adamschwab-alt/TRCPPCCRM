import { requireSession } from '@/lib/auth';
import { getRecentActivities } from '@/lib/activities/queries';
import { xlsxResponse, stamp } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireSession();
  const activities = await getRecentActivities(1000);
  const rows = activities.map((a) => ({
    When: a.occurred_at.slice(0, 10),
    Type: a.type,
    Account: a.account_name ?? '',
    By: a.user_name ?? '',
    Note: a.body ?? '',
  }));
  return xlsxResponse(`psp-activities-${stamp()}.xlsx`, rows, 'Activities');
}
