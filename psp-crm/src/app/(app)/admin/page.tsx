import { Card, SectionTitle } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { computeDq } from '@/lib/dq/queries';
import { fmtPct } from '@/lib/format';
import { getProfiles, getTargets, getAuditLog, getLastSync } from '@/lib/admin/queries';
import { updateUser } from './actions';
import { isPendingEmail } from '@/lib/roster';
import {
  TargetsForm,
  InviteForm,
  SyncForm,
  RebuildForm,
  DedupeForm,
  RestoreForm,
  EvidenceForm,
  WiringImportForm,
  AddRepForm,
  ConnectEmailForm,
} from './AdminForms';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
// A full reload upserts tens of thousands of rows; give the "Sync now" server
// action room to finish (Pro plan ceiling is 300s).
export const maxDuration = 300;

export default async function AdminPage() {
  const { userId } = await requireRole('admin');
  const supabase = await createClient();
  const [targets, profiles, audit, lastSync, dq] = await Promise.all([
    getTargets(),
    getProfiles(),
    getAuditLog(100),
    getLastSync(),
    computeDq(supabase).catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-charcoal text-xl font-bold tracking-tight">Admin</h1>







      <Card className="p-4">
        <SectionTitle>Data sync (Acumatica OData)</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          {lastSync
            ? `Last sync: ${new Date(lastSync.created_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC${
                lastSync.inserted != null ? ` · +${lastSync.inserted} new rows` : ''
              }`
            : 'Never synced yet.'}
        </p>
        <SyncForm />
      </Card>

      <Card className="p-4">
        <SectionTitle>Import Customer Wiring workbook</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          Repeatable template: maintain PSP_Customer_Wiring.xlsx and re-upload anytime — existing
          contacts are skipped, only new/changed data is written. Tick what to load:{' '}
          <strong>contacts</strong> (Contact/Email columns on the Branch tab + region roster),{' '}
          <strong>ratings</strong> (Relationship 1–3 on the Customer Wiring tab), and{' '}
          <strong>rep assignments</strong> (Assigned Rep column — needs logins whose full names
          match exactly; unmatched reps are listed). Contact edits made in the app win: a re-upload
          never overwrites a contact that already exists.
        </p>
        <WiringImportForm />
      </Card>

      <Card className="p-4">
        <SectionTitle>Sales rep roster</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          Beta flow: add reps by <strong>name</strong> now — branches can be assigned to them
          immediately and the wiring import matches them. When you&rsquo;re ready to launch,
          connect each rep&rsquo;s real email and they get a set-your-password link (or set a
          temporary password in Supabase if email delivery isn&rsquo;t configured yet).
        </p>
        <AddRepForm />
        {profiles.filter((p) => p.role === 'rep').length > 0 && (
          <ul className="mt-4 space-y-2">
            {profiles
              .filter((p) => p.role === 'rep')
              .map((p) => (
                <li
                  key={p.id}
                  className="bg-canvas flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2"
                >
                  <div>
                    <span className="text-charcoal text-sm font-medium">{p.full_name || '—'}</span>{' '}
                    {isPendingEmail(p.email) ? (
                      <span className="rounded-full bg-[var(--color-watch-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-watch)]">
                        name only — no login yet
                      </span>
                    ) : (
                      <span className="text-muted text-xs">{p.email}</span>
                    )}
                  </div>
                  {isPendingEmail(p.email) && <ConnectEmailForm profileId={p.id} />}
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle>Add a user</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          Creates an account with a temporary password. They set up 2FA on first login.
        </p>
        <InviteForm />
      </Card>

      <Card className="p-4">
        <SectionTitle>Users ({profiles.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-2 py-2">Name / email</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Active</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-line/60 border-b last:border-0">
                  <td className="px-2 py-2">
                    <div className="text-charcoal font-medium">{p.full_name || '—'}</div>
                    <div className="text-muted text-xs">
                      {p.email}
                      {p.id === userId && ' (you)'}
                    </div>
                  </td>
                  <td colSpan={3} className="px-2 py-2">
                    <form action={updateUser} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <select
                        name="role"
                        defaultValue={p.role}
                        className="input max-w-[140px] py-1"
                      >
                        <option value="rep">Rep</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <label className="text-charcoal-2 flex items-center gap-1 text-xs">
                        <input type="checkbox" name="is_active" defaultChecked={p.is_active} />{' '}
                        active
                      </label>
                      <button className="btn-secondary px-3 py-1 text-xs" data-tap>
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle>Targets &amp; thresholds</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          These drive the dashboard scoring and worklist rules.
        </p>
        {targets ? (
          <TargetsForm targets={targets} />
        ) : (
          <p className="text-muted text-sm">No targets row found.</p>
        )}
      </Card>

      <h2 className="text-charcoal pt-2 text-sm font-bold tracking-wide uppercase">Measurement</h2>

      {dq && (
        <Card className="p-4">
          <SectionTitle>Data quality</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-muted text-xs uppercase">Opp completeness</div>
              <div className="text-charcoal text-xl font-bold tabular-nums">
                {fmtPct(dq.completeness, 0)}
              </div>
              <div className="text-muted text-[11px]">of 7 key fields on active deals</div>
            </div>
            <div>
              <div className="text-muted text-xs uppercase">Touch freshness</div>
              <div className="text-charcoal text-xl font-bold tabular-nums">
                {fmtPct(dq.freshness, 0)}
              </div>
              <div className="text-muted text-[11px]">accounts inside wiring cadence</div>
            </div>
            <div>
              <div className="text-muted text-xs uppercase">Stalled deals</div>
              <div
                className={`text-xl font-bold tabular-nums ${dq.stalled > 0 ? 'text-[var(--color-watch)]' : 'text-charcoal'}`}
              >
                {dq.stalled}
              </div>
              <div className="text-muted text-[11px]">no future next step</div>
            </div>
            <div>
              <div className="text-muted text-xs uppercase">Gate violations</div>
              <div
                className={`text-xl font-bold tabular-nums ${dq.gateViolations > 0 ? 'text-[var(--color-atrisk)]' : 'text-charcoal'}`}
              >
                {dq.gateViolations}
              </div>
              <div className="text-muted text-[11px]">active deals missing required fields</div>
            </div>
          </div>
          {dq.perRep.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-line text-muted border-b text-left uppercase">
                    <th className="px-2 py-1.5">Rep</th>
                    <th className="px-2 py-1.5 text-right">Active opps</th>
                    <th className="px-2 py-1.5 text-right">Completeness</th>
                    <th className="px-2 py-1.5 text-right">Freshness</th>
                    <th className="px-2 py-1.5 text-right">Stalled</th>
                  </tr>
                </thead>
                <tbody>
                  {dq.perRep.map((r) => (
                    <tr key={r.repId} className="border-line/60 border-b last:border-0">
                      <td className="px-2 py-1.5 font-medium">{r.repName}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.activeOpps}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtPct(r.completeness, 0)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {fmtPct(r.freshness, 0)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right tabular-nums ${r.stalled > 0 ? 'font-semibold text-[var(--color-watch)]' : ''}`}
                      >
                        {r.stalled}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-muted mt-2 text-[11px]">
            Scored, not subjective — definitions in the KPI dictionary. A monthly snapshot is
            frozen automatically for the before/after record.
          </p>
        </Card>
      )}

      <Card className="p-4">
        <SectionTitle>Baseline freeze (measurement)</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          Downloads a dated snapshot of the entire book — KPIs, every account with its wiring
          cadence, white-space, and day-0 funnel. Run this ONCE on rollout day and file it: it is
          the &ldquo;before&rdquo; in every future before/after comparison. Generating it is logged.
        </p>
        <a href="/export/baseline" className="btn-primary" data-tap>
          ⬇ Download baseline freeze
        </a>
      </Card>

      <Card className="p-4">
        <SectionTitle>Case-study evidence log</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          Two kinds of contemporaneous evidence: <strong>market events</strong> (price changes,
          competitor moves — they become footnotes on before/after charts so results are honest)
          and <strong>testimonials</strong> (a rep or manager says something good — capture the
          quote WITH its date; dated quotes are credible, remembered ones aren&rsquo;t).
        </p>
        <EvidenceForm />
      </Card>

      <details className="border-line bg-surface rounded-lg border p-4">
        <summary className="text-charcoal cursor-pointer text-sm font-semibold">
          Data repair (advanced) — one-time recovery tools, rarely needed
        </summary>
        <div className="mt-4 space-y-6">
          <div>
            <h3 className="text-charcoal mb-1 text-sm font-semibold">Remove duplicate sales rows</h3>
            <DedupeForm />
          </div>
          <div className="border-line border-t pt-4">
            <h3 className="text-charcoal mb-1 text-sm font-semibold">Restore sales data from workbook</h3>
            <RestoreForm />
          </div>
          <div className="border-line border-t pt-4">
            <h3 className="text-charcoal mb-1 text-sm font-semibold">Full rebuild from Acumatica</h3>
            <RebuildForm />
          </div>
        </div>
      </details>

      <Card className="p-4">
        <SectionTitle>Audit log</SectionTitle>
        {audit.length === 0 ? (
          <p className="text-muted text-sm">
            No audit entries yet. (The table is wired and ready to record changes.)
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-line text-muted border-b text-left text-xs uppercase">
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Who</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Entity</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-line/60 border-b last:border-0">
                    <td className="text-muted px-2 py-2">{fmtDate(a.created_at.slice(0, 10))}</td>
                    <td className="px-2 py-2">{a.actor_name ?? '—'}</td>
                    <td className="px-2 py-2 capitalize">{a.action}</td>
                    <td className="text-muted px-2 py-2">
                      {a.entity ?? '—'} {a.entity_id ? a.entity_id.slice(0, 8) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
