import { Card, SectionTitle } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  generateCapacitySummary,
  checkRepUtilizationAlerts,
  checkTransitionCapacityAlerts,
  getPendingTransitionsByRep,
} from '@/lib/coverage/alerts';
import { getAccountInvestment, getUnitedDistrictCoverage } from '@/lib/coverage/queries';

export const dynamic = 'force-dynamic';

export default async function CoverageDashboard() {
  await requireRole('admin');
  const supabase = await createClient();

  // Fetch all data in parallel
  const [summary, alerts, transitionAlerts, transitionsByRep, accountInvestment, urDistricts] =
    await Promise.all([
      generateCapacitySummary(supabase),
      checkRepUtilizationAlerts(supabase),
      checkTransitionCapacityAlerts(supabase),
      getPendingTransitionsByRep(supabase),
      getAccountInvestment(supabase),
      getUnitedDistrictCoverage(supabase),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-charcoal text-xl font-bold tracking-tight">Coverage Planning</h1>
      </div>

      {/* Capacity Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card className="p-4">
          <div className="text-muted text-xs font-semibold uppercase">Book Utilization</div>
          <div className="mt-2 text-2xl font-bold text-charcoal">
            {Math.round(summary.bookUtilization)}%
          </div>
          <div className="text-muted mt-1 text-xs">
            {Math.round(summary.totalLoad)} / {summary.totalCapacity} calls/yr
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-muted text-xs font-semibold uppercase">Reps: Healthy</div>
          <div className="mt-2 text-2xl font-bold text-green-700">{summary.healthy}</div>
          <div className="text-muted mt-1 text-xs">of {summary.totalReps} reps</div>
        </Card>

        <Card className="p-4">
          <div className="text-muted text-xs font-semibold uppercase">At Risk ⚠️</div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{summary.atRisk}</div>
          <div className="text-muted mt-1 text-xs">95-110% utilization</div>
        </Card>

        <Card className="p-4">
          <div className="text-muted text-xs font-semibold uppercase">Overloaded 🔴</div>
          <div className="mt-2 text-2xl font-bold text-red-600">{summary.overloaded}</div>
          <div className="text-muted mt-1 text-xs">&gt;110% utilization</div>
        </Card>

        <Card className="p-4">
          <div className="text-muted text-xs font-semibold uppercase">Pending Transitions</div>
          <div className="mt-2 text-2xl font-bold text-charcoal">
            {Object.keys(transitionsByRep).length}
          </div>
          <div className="text-muted mt-1 text-xs">awaiting execution</div>
        </Card>
      </div>

      {/* Alerts */}
      {(alerts.length > 0 || transitionAlerts.length > 0) && (
        <Card className="p-4">
          <SectionTitle>Alerts</SectionTitle>
          {alerts.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-sm font-semibold text-amber-700">Rep Utilization</div>
              {alerts.map((alert) => (
                <div
                  key={alert.repId}
                  className={`rounded px-3 py-2 text-xs ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <span className="font-semibold">{alert.repName}</span> — {alert.utilization.toFixed(0)}%
                  utilization ({alert.totalLoad} / {alert.capacity} calls/yr)
                </div>
              ))}
            </div>
          )}

          {transitionAlerts.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-red-700">Transition Capacity Issues</div>
              {transitionAlerts.map((alert) => (
                <div key={alert.plannedChangeId} className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">
                  <span className="font-semibold">{alert.newRepName}</span> would be at{' '}
                  {alert.projectedUtilization}% if transition executes on {alert.scheduledDate}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Rep Workload Detail */}
      <Card className="p-4">
        <SectionTitle>Rep Workload Details</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-2 py-2">Rep</th>
                <th className="px-2 py-2 text-right">Branches</th>
                <th className="px-2 py-2 text-right">Branch Calls</th>
                <th className="px-2 py-2 text-right">Tier Touches</th>
                <th className="px-2 py-2 text-right">Total Load</th>
                <th className="px-2 py-2 text-right">Capacity</th>
                <th className="px-2 py-2 text-right">Utilization</th>
                <th className="px-2 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.reps.map((rep) => (
                <tr key={rep.rep_id} className="border-line/60 border-b last:border-0">
                  <td className="text-charcoal px-2 py-2 font-medium">{rep.rep_name}</td>
                  <td className="text-muted px-2 py-2 text-right tabular-nums">{rep.branch_count}</td>
                  <td className="text-muted px-2 py-2 text-right tabular-nums">{rep.branch_calls_yr}</td>
                  <td className="text-muted px-2 py-2 text-right tabular-nums">{rep.tier_touches_yr}</td>
                  <td className="text-charcoal px-2 py-2 text-right font-semibold tabular-nums">
                    {rep.total_load_yr}
                  </td>
                  <td className="text-muted px-2 py-2 text-right tabular-nums">{rep.capacity_per_rep}</td>
                  <td
                    className={`px-2 py-2 text-right font-semibold tabular-nums ${
                      rep.utilization_pct >= 110
                        ? 'text-red-600'
                        : rep.utilization_pct >= 95
                          ? 'text-amber-600'
                          : 'text-green-700'
                    }`}
                  >
                    {rep.utilization_pct.toFixed(0)}%
                  </td>
                  <td className="px-2 py-2 text-right text-xs">
                    {rep.utilization_pct >= 110 ? (
                      <span className="inline-block rounded bg-red-100 px-2 py-1 text-red-700">Overloaded</span>
                    ) : rep.utilization_pct >= 95 ? (
                      <span className="inline-block rounded bg-amber-100 px-2 py-1 text-amber-700">At Risk</span>
                    ) : (
                      <span className="inline-block rounded bg-green-100 px-2 py-1 text-green-700">Healthy</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Account Investment */}
      <Card className="p-4">
        <SectionTitle>Account Investment (Coverage)</SectionTitle>
        <p className="text-muted mb-3 text-xs">Total touches/year by account (branch calls + tier touches)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-2 py-2">Account</th>
                <th className="px-2 py-2 text-right">Branches</th>
                <th className="px-2 py-2 text-right">Branch Calls/yr</th>
                <th className="px-2 py-2 text-right">Tier Touches/yr</th>
                <th className="px-2 py-2 text-right">Total Investment</th>
              </tr>
            </thead>
            <tbody>
              {accountInvestment.slice(0, 20).map((account) => (
                <tr key={account.account_id} className="border-line/60 border-b last:border-0">
                  <td className="text-charcoal px-2 py-2 font-medium">{account.account_name}</td>
                  <td className="text-muted px-2 py-2 text-right tabular-nums">{account.branch_count}</td>
                  <td className="text-muted px-2 py-2 text-right tabular-nums">{account.branch_calls_yr}</td>
                  <td className="text-muted px-2 py-2 text-right tabular-nums">{account.tier_touches_yr}</td>
                  <td className="text-charcoal px-2 py-2 text-right font-semibold tabular-nums">
                    {account.total_touches_yr}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {accountInvestment.length > 20 && (
          <p className="text-muted mt-2 text-xs">{accountInvestment.length - 20} more accounts…</p>
        )}
      </Card>

      {/* United Rentals District Breakdown */}
      <Card className="p-4">
        <SectionTitle>United Rentals — District Coverage</SectionTitle>
        <p className="text-muted mb-3 text-xs">Branch calls & tier touches by district (DM, DSM, routing)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-2 py-2">District</th>
                <th className="px-2 py-2 text-right">Code</th>
                <th className="px-2 py-2 text-right">Branches</th>
                <th className="px-2 py-2 text-right">Calls/yr</th>
                <th className="px-2 py-2">District Manager</th>
                <th className="px-2 py-2">Sales Manager</th>
                <th className="px-2 py-2 text-right">DM Touches/yr</th>
                <th className="px-2 py-2 text-right">DSM Touches/yr</th>
              </tr>
            </thead>
            <tbody>
              {urDistricts.map((district) => (
                <tr key={district.district_id} className="border-line/60 border-b last:border-0">
                  <td className="text-charcoal px-2 py-2 font-medium">{district.district_name}</td>
                  <td className="text-muted px-2 py-2 text-right text-xs">{district.district_code}</td>
                  <td className="text-muted px-2 py-2 text-right tabular-nums">{district.branch_count}</td>
                  <td className="text-charcoal px-2 py-2 text-right font-semibold tabular-nums">
                    {district.branch_calls_yr}
                  </td>
                  <td className="text-muted px-2 py-2 text-xs">{district.dm_name || '—'}</td>
                  <td className="text-muted px-2 py-2 text-xs">{district.dsm_name || '—'}</td>
                  <td className="text-muted px-2 py-2 text-right tabular-nums">{district.dm_tier_touches_yr}</td>
                  <td className="text-muted px-2 py-2 text-right tabular-nums">{district.dsm_tier_touches_yr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pending Transitions */}
      {Object.keys(transitionsByRep).length > 0 && (
        <Card className="p-4">
          <SectionTitle>Pending Transitions (by target rep)</SectionTitle>
          <div className="space-y-4">
            {Object.entries(transitionsByRep).map(([repId, changes]) => (
              <div key={repId} className="rounded border border-gray-200 p-3">
                <div className="text-charcoal mb-2 font-semibold">
                  Incoming to {changes[0].profiles?.full_name || repId}
                </div>
                <div className="space-y-1">
                  {changes.map((change) => (
                    <div key={change.id} className="text-muted text-xs">
                      <span className="font-mono">Branch ID {change.branch_id.slice(0, 8)}</span> —{' '}
                      <span className="text-gray-600">{change.reason}</span> — Scheduled:{' '}
                      <span className="font-medium">{change.scheduled_date}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
