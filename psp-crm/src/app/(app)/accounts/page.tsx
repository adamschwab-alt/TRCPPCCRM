import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/metrics/queries';
import { AccountsTable, type AccountVM } from './AccountsTable';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const accounts = await getAccounts();
  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('id,full_name,email');
  const ownerName = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));

  const rows: AccountVM[] = accounts.map((a) => ({
    ...a,
    owner_name: a.owner_id ? (ownerName.get(a.owner_id) ?? null) : null,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-charcoal text-xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted text-sm">{accounts.length} parent accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/export/accounts" className="btn-secondary" data-tap>
            ⬇ Accounts
          </a>
          <a href="/export/branches" className="btn-secondary" data-tap>
            ⬇ Branches
          </a>
          <Link href="/accounts/new" className="btn-primary" data-tap>
            + New account
          </Link>
        </div>
      </div>

      <div className="mt-5">
        <AccountsTable rows={rows} />
      </div>
    </div>
  );
}
