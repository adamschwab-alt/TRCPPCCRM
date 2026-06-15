import Link from 'next/link';
import { requireSession, isStaff } from '@/lib/auth';
import { getOwnerOptions } from '@/lib/accounts/queries';
import { AccountForm } from '../AccountForms';
import { createAccount } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewAccountPage() {
  const { profile } = await requireSession();
  const staff = isStaff(profile.role);
  const owners = staff ? await getOwnerOptions() : [];
  return (
    <div>
      <Link href="/accounts" className="text-brand-700 text-sm hover:underline">
        ← Accounts
      </Link>
      <h1 className="text-charcoal mt-2 text-xl font-bold tracking-tight">New account</h1>
      <AccountForm
        action={createAccount}
        owners={owners}
        canAssignOwner={staff}
        submitLabel="Create account"
      />
    </div>
  );
}
