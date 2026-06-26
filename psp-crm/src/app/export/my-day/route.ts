import { type NextRequest } from 'next/server';
import { requireSession, isStaff } from '@/lib/auth';
import { getMyDayData } from '@/lib/myday/queries';
import { xlsxResponse, stamp } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/**
 * Excel export of the My Day worklist. Mirrors the page's scoping: reps export
 * their own book (RLS-enforced); staff may pass ?rep=<id> to export one rep's
 * queue, or omit it for everyone.
 */
export async function GET(request: NextRequest) {
  const { userId, profile } = await requireSession();
  const staff = isStaff(profile.role);
  const repParam = request.nextUrl.searchParams.get('rep') || undefined;
  const repId = staff ? repParam : userId;

  const { rows } = await getMyDayData(repId);

  const out = rows.map((r, i) => ({
    Rank: i + 1,
    Branch: r.branch.branch_name,
    Account: r.account_name ?? '',
    State: r.branch.state ?? '',
    Owner: r.owner_name ?? '',
    Reasons: r.reasons.map((x) => x.label).join('; '),
    'Primary driver': r.primary,
    '$ at stake': Math.round(r.impact),
    'TTM revenue': r.branch.ttm_revenue,
    'Prior revenue': r.branch.prior_revenue,
    Change: r.branch.delta,
    'Change %': r.branch.delta_pct != null ? Math.round(r.branch.delta_pct * 1000) / 10 : '',
    'White space': r.branch.white_space === '—' ? '' : r.branch.white_space,
    'Last order': r.branch.last_order_date ?? '',
    'Days idle': r.branch.days_idle ?? '',
    'Days since touch': r.daysSinceTouch ?? '',
    'Needs touch': r.needsTouch ? 'Yes' : '',
  }));

  return xlsxResponse(`psp-my-day-${stamp()}.xlsx`, out, 'My Day');
}
