import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession, isStaff } from '@/lib/auth';
import { getBranchRow, getAccountOptions, getOwnerOptions } from '@/lib/accounts/queries';
import { BranchForm } from '../../../accounts/AccountForms';
import { updateBranch } from '../../../accounts/actions';

export const dynamic = 'force-dynamic';

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireSession();
  const staff = isStaff(profile.role);
  const branch = await getBranchRow(id);
  if (!branch) notFound();
  const [accounts, owners] = await Promise.all([
    getAccountOptions(),
    staff ? getOwnerOptions() : Promise.resolve([]),
  ]);

  return (
    <div>
      <Link href={`/branches/${id}`} className="text-brand-700 text-sm hover:underline">
        ← {branch.name}
      </Link>
      <h1 className="text-charcoal mt-2 text-xl font-bold tracking-tight">Edit branch</h1>
      <BranchForm
        action={updateBranch.bind(null, id, branch.account_id)}
        accounts={accounts}
        owners={owners}
        canAssignOwner={staff}
        branch={branch}
        lockAccount
        submitLabel="Save changes"
      />
    </div>
  );
}
