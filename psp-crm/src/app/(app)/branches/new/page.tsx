import Link from 'next/link';
import { requireSession, isStaff } from '@/lib/auth';
import { getAccountOptions, getOwnerOptions } from '@/lib/accounts/queries';
import { BranchForm } from '../../accounts/AccountForms';
import { createBranch } from '../../accounts/actions';

export const dynamic = 'force-dynamic';

export default async function NewBranchPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { account } = await searchParams;
  const { profile } = await requireSession();
  const staff = isStaff(profile.role);
  const [accounts, owners] = await Promise.all([
    getAccountOptions(),
    staff ? getOwnerOptions() : Promise.resolve([]),
  ]);
  return (
    <div>
      <Link
        href={account ? `/accounts/${account}` : '/accounts'}
        className="text-brand-700 text-sm hover:underline"
      >
        ← Back
      </Link>
      <h1 className="text-charcoal mt-2 text-xl font-bold tracking-tight">New branch</h1>
      <BranchForm
        action={createBranch}
        accounts={accounts}
        owners={owners}
        canAssignOwner={staff}
        defaultAccountId={account}
        lockAccount={Boolean(account)}
        submitLabel="Create branch"
      />
    </div>
  );
}
