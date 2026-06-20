import { Card, SectionTitle } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { getProfiles, getTargets, getAuditLog, getLastSync } from '@/lib/admin/queries';
import { updateUser } from './actions';
import { TargetsForm, InviteForm, SyncForm } from './AdminForms';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { userId } = await requireRole('admin');
  const [targets, profiles, audit, lastSync] = await Promise.all([
    getTargets(),
    getProfiles(),
    getAuditLog(100),
    getLastSync(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-charcoal text-xl font-bold tracking-tight">Admin</h1>

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
        <SectionTitle>Add a user</SectionTitle>
        <p className="text-muted mb-3 text-xs">
          Creates an account with a temporary password. They set up 2FA on first login.
        </p>
        <InviteForm />
      </Card>

      <Card className="p-4">
        <SectionTitle>Users ({profiles.length})</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-line text-muted border-b text-left text-xs uppercase">
                <th className="px-3 py-2">Name / email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-line/60 border-b last:border-0">
                  <td className="px-3 py-2">
                    <div className="text-charcoal font-medium">{p.full_name || '—'}</div>
                    <div className="text-muted text-xs">
                      {p.email}
                      {p.id === userId && ' (you)'}
                    </div>
                  </td>
                  <td colSpan={3} className="px-3 py-2">
                    <form action={updateUser} className="flex items-center gap-3">
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
        <SectionTitle>Audit log</SectionTitle>
        {audit.length === 0 ? (
          <p className="text-muted text-sm">
            No audit entries yet. (The table is wired and ready to record changes.)
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-line text-muted border-b text-left text-xs uppercase">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Who</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Entity</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-line/60 border-b last:border-0">
                    <td className="text-muted px-3 py-2">{fmtDate(a.created_at.slice(0, 10))}</td>
                    <td className="px-3 py-2">{a.actor_name ?? '—'}</td>
                    <td className="px-3 py-2 capitalize">{a.action}</td>
                    <td className="text-muted px-3 py-2">
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
