import Link from 'next/link';
import { Card, SectionTitle } from '@/components/ui';
import { createClient } from '@/lib/supabase/server';
import { getAccountDistricts, getAccountContactTiers, getAccountTransitionSummary } from '@/lib/coverage/queries';

export default async function AccountCoverageTab({ accountId }: { accountId: string }) {
  const supabase = await createClient();

  const [districts, tiers, transitions] = await Promise.all([
    getAccountDistricts(supabase, accountId),
    getAccountContactTiers(supabase, accountId),
    getAccountTransitionSummary(supabase, accountId),
  ]);

  // Group tiers by tier type for better display
  const tiersByType = tiers.reduce(
    (acc, tier) => {
      if (!acc[tier.tier]) acc[tier.tier] = [];
      acc[tier.tier].push(tier);
      return acc;
    },
    {} as Record<string, typeof tiers>,
  );

  return (
    <div className="space-y-6">
      {/* Districts */}
      <Card className="p-4">
        <SectionTitle>Districts & Structure</SectionTitle>
        {districts.length === 0 ? (
          <p className="text-muted text-sm">No districts assigned yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-line text-muted border-b text-left text-xs uppercase">
                  <th className="px-2 py-2">District</th>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Region</th>
                  <th className="px-2 py-2">District Manager</th>
                  <th className="px-2 py-2">Sales Manager</th>
                </tr>
              </thead>
              <tbody>
                {districts.map((d) => (
                  <tr key={d.id} className="border-line/60 border-b last:border-0">
                    <td className="text-charcoal px-2 py-2 font-medium">{d.name}</td>
                    <td className="text-muted px-2 py-2 text-xs">{d.code || '—'}</td>
                    <td className="text-muted px-2 py-2 text-xs">{d.region_text || '—'}</td>
                    <td className="text-muted px-2 py-2 text-sm">
                      {/* Would need to fetch rep names from profiles; for now show ID */}
                      {d.dm_profile_id ? (
                        <span className="text-xs">{d.dm_profile_id.slice(0, 8)}</span>
                      ) : (
                        <span className="text-xs text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="text-muted px-2 py-2 text-sm">
                      {d.dsm_profile_id ? (
                        <span className="text-xs">{d.dsm_profile_id.slice(0, 8)}</span>
                      ) : (
                        <span className="text-xs text-gray-400">Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Contact Tiers by Type */}
      {Object.entries(tiersByType).map(([tierType, tierList]) => (
        <Card key={tierType} className="p-4">
          <SectionTitle>{tierType} Tier</SectionTitle>
          <p className="text-muted mb-3 text-xs">
            Routing, PSP owner, and planned touches for {tierType.toLowerCase()} contacts
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-line text-muted border-b text-left text-xs uppercase">
                  <th className="px-2 py-2">Contact</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Touches/yr</th>
                  <th className="px-2 py-2">Routing</th>
                  <th className="px-2 py-2">PSP Owner Type</th>
                  <th className="px-2 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {tierList.map((tier) => (
                  <tr key={tier.id} className="border-line/60 border-b last:border-0">
                    <td className="text-charcoal px-2 py-2 font-medium">
                      {/* Contact name would require JOIN; show ID for now */}
                      <span className="text-xs">{tier.contact_id.slice(0, 8)}</span>
                    </td>
                    <td className="text-muted px-2 py-2 text-xs">—</td>
                    <td className="text-charcoal px-2 py-2 font-semibold text-right">
                      {tier.cadence_touches_yr}
                    </td>
                    <td className="text-muted px-2 py-2 text-xs">{tier.routing}</td>
                    <td className="text-muted px-2 py-2 text-xs">{tier.psp_owner_type}</td>
                    <td className="text-muted max-w-[200px] truncate px-2 py-2 text-xs">
                      {tier.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {/* Pending Transitions */}
      {transitions.length > 0 && (
        <Card className="p-4">
          <SectionTitle>Pending Rep Transitions</SectionTitle>
          <p className="text-muted mb-3 text-xs">Staged branch reassignments awaiting execution</p>
          <div className="space-y-3">
            {transitions.map((t) => (
              <div key={t.id} className="rounded border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-charcoal text-sm font-semibold">
                      Branch: <span className="font-mono text-xs">{t.branch_id.slice(0, 8)}</span>
                    </div>
                    <div className="text-muted mt-1 text-xs">
                      From: {t.current_owner_profile_id?.slice(0, 8) || 'Unassigned'} →{' '}
                      <span className="font-semibold">{t.new_owner_profile_id.slice(0, 8)}</span>
                    </div>
                    <div className="text-muted text-xs">
                      Scheduled: <span className="font-medium">{t.scheduled_date}</span> | Reason:{' '}
                      {t.reason}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                        t.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : t.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : t.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {t.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {tiers.length === 0 && districts.length === 0 && transitions.length === 0 && (
        <Card className="p-4">
          <p className="text-muted text-sm">
            No coverage data yet.{' '}
            <Link href="/admin/coverage" className="text-brand-700 hover:underline">
              Go to Coverage Dashboard
            </Link>{' '}
            to set up districts and tiers for this account.
          </p>
        </Card>
      )}
    </div>
  );
}
