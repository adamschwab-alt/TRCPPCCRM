import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, KpiTile, SectionTitle, StatusBadge, RagBadge } from '@/components/ui';
import { getAccount, getBranchesForAccount } from '@/lib/metrics/queries';
import { fmtCurrencyShort, fmtDeltaPct, fmtPct, fmtDate, whiteSpaceLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { WiringCard, ContactsCard } from './CrmCards';
import { BriefCard } from './BriefCard';
import { aiConfigured } from '@/lib/ai/brief';
import type { ContactRow } from '@/types/database';

export const dynamic = 'force-dynamic';
// The AI brief server action calls the Claude API (up to ~30s incl. retries).
export const maxDuration = 60;

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();
  const branches = await getBranchesForAccount(id);

  // Wiring + contacts (0007). select('*') and a tolerated contacts error keep
  // the page working on a database that hasn't run the migration yet.
  const supabase = await createClient();
  const [{ data: accountRow }, contactsRes] = await Promise.all([
    supabase.from('accounts').select('*').eq('id', id).maybeSingle(),
    supabase.from('contacts').select('*').eq('account_id', id).order('tier'),
  ]);
  const rating = (accountRow as { relationship_rating?: number } | null)?.relationship_rating ?? 2;
  const contacts: ContactRow[] = contactsRes.data ?? [];

  return (
    <div>
      <Link href="/accounts" className="text-brand-700 text-sm hover:underline">
        ← Accounts
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-charcoal text-xl font-bold tracking-tight">{account.account_name}</h1>
        <StatusBadge status={account.status} />
        <RagBadge rag={account.coverage_rag} />
        <span className="text-muted text-sm">{account.primary_state ?? ''}</span>
        <span className="ml-auto flex gap-2">
          <Link
            href={`/accounts/${account.account_id}/edit`}
            className="btn-secondary px-3 py-1 text-xs"
            data-tap
          >
            Edit
          </Link>
          <Link
            href={`/branches/new?account=${account.account_id}`}
            className="btn-primary px-3 py-1 text-xs"
            data-tap
          >
            + Add branch
          </Link>
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="TTM revenue" value={fmtCurrencyShort(account.ttm_revenue)} />
        <KpiTile
          label="Prior revenue"
          value={fmtCurrencyShort(account.prior_revenue)}
          sub={`${fmtDeltaPct(account.delta_pct)} YoY`}
          tone={account.delta < 0 ? 'bad' : 'good'}
        />
        <KpiTile label="Gross margin" value={fmtPct(account.gm_pct)} />
        <KpiTile
          label="Last order"
          value={fmtDate(account.last_order_date)}
          sub={account.days_idle !== null ? `${account.days_idle}d idle` : '—'}
        />
      </div>

      <div className="mt-6">
        <Card className="p-4">
          <SectionTitle>Pre-call brief (AI)</SectionTitle>
          <BriefCard accountId={account.account_id} configured={aiConfigured()} />
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Relationship &amp; cadence</SectionTitle>
          <WiringCard
            accountId={account.account_id}
            ttmRevenue={account.ttm_revenue}
            rating={rating}
          />
        </Card>
        <Card className="p-4">
          <SectionTitle>Contacts ({contacts.length})</SectionTitle>
          <ContactsCard accountId={account.account_id} contacts={contacts} />
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle>Branches ({branches.length})</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-4 py-2.5">Branch</th>
                <th className="px-4 py-2.5">Location</th>
                <th className="px-4 py-2.5 text-right">TTM</th>
                <th className="px-4 py-2.5 text-right">Δ%</th>
                <th className="px-4 py-2.5 text-right">Idle</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Coverage</th>
                <th className="px-4 py-2.5">White-space</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr
                  key={b.branch_id}
                  className="border-line/60 hover:bg-canvas border-b last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/branches/${b.branch_id}`}
                      className="text-brand-700 font-medium hover:underline"
                    >
                      {b.branch_name}
                    </Link>
                  </td>
                  <td className="text-muted px-4 py-2.5">
                    {[b.city, b.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtCurrencyShort(b.ttm_revenue)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right tabular-nums ${
                      b.delta < 0 ? 'text-[var(--color-atrisk)]' : 'text-[var(--color-ontrack)]'
                    }`}
                  >
                    {fmtDeltaPct(b.delta_pct)}
                  </td>
                  <td className="text-muted px-4 py-2.5 text-right tabular-nums">
                    {b.days_idle !== null ? `${b.days_idle}d` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <RagBadge rag={b.coverage_rag} />
                  </td>
                  <td className="text-muted px-4 py-2.5">{whiteSpaceLabel(b.white_space)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
