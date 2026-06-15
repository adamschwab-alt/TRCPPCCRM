import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession, isStaff } from '@/lib/auth';
import { getAccountRow, getOwnerOptions } from '@/lib/accounts/queries';
import { AccountForm } from '../../AccountForms';
import { updateAccount } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireSession();
  const staff = isStaff(profile.role);
  const [account, owners] = await Promise.all([
    getAccountRow(id),
    staff ? getOwnerOptions() : Promise.resolve([]),
  ]);
  if (!account) notFound();

  return (
    <div>
      <Link href={`/accounts/${id}`} className="text-brand-700 text-sm hover:underline">
        ← {account.name}
      </Link>
      <h1 className="text-charcoal mt-2 text-xl font-bold tracking-tight">Edit account</h1>
      <AccountForm
        action={updateAccount.bind(null, id)}
        owners={owners}
        canAssignOwner={staff}
        account={account}
        submitLabel="Save changes"
      />
    </div>
  );
}
