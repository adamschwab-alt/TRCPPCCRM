import Link from 'next/link';
import { Card, StatusBadge, RagBadge } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/metrics/queries';
import { fmtCurrencyShort, fmtDeltaPct } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const accounts = await getAccounts();

  // Owner names
  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('id,full_name,email');
  const ownerName = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-charcoal text-xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted text-sm">{accounts.length} parent accounts</p>
        </div>
        <Link href="/accounts/new" className="btn-primary" data-tap>
          + New account
        </Link>
      </div>

      <Card className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-line text-muted border-b text-left text-xs uppercase">
              <th className="px-4 py-2.5">Account</th>
              <th className="px-4 py-2.5">State</th>
              <th className="px-4 py-2.5 text-right">Branches</th>
              <th className="px-4 py-2.5 text-right">TTM</th>
              <th className="px-4 py-2.5 text-right">Prior</th>
              <th className="px-4 py-2.5 text-right">Δ%</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Coverage</th>
              <th className="px-4 py-2.5">Owner</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr
                key={a.account_id}
                className="border-line/60 hover:bg-canvas border-b last:border-0"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/accounts/${a.account_id}`}
                    className="text-brand-700 font-medium hover:underline"
                  >
                    {a.account_name}
                  </Link>
                </td>
                <td className="text-muted px-4 py-2.5">{a.primary_state ?? '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{a.branch_count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {fmtCurrencyShort(a.ttm_revenue)}
                </td>
                <td className="text-muted px-4 py-2.5 text-right tabular-nums">
                  {fmtCurrencyShort(a.prior_revenue)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right tabular-nums ${
                    a.delta < 0 ? 'text-[var(--color-atrisk)]' : 'text-[var(--color-ontrack)]'
                  }`}
                >
                  {fmtDeltaPct(a.delta_pct)}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-4 py-2.5">
                  <RagBadge rag={a.coverage_rag} />
                </td>
                <td className="text-muted px-4 py-2.5">
                  {a.owner_id ? (ownerName.get(a.owner_id) ?? '—') : '—'}
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={9} className="text-muted px-4 py-8 text-center">
                  No accounts yet — seed the workbook.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
