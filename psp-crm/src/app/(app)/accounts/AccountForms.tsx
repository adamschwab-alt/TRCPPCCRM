'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { AccountRow, BranchRow } from '@/types/database';
import type { AccountOption, OwnerOption } from '@/lib/accounts/queries';
import type { FormState } from './actions';

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-charcoal-2 mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function OwnerSelect({
  owners,
  defaultValue,
}: {
  owners: OwnerOption[];
  defaultValue: string | null;
}) {
  return (
    <Field label="Owner (rep)">
      <select name="owner_id" className="input" defaultValue={defaultValue ?? ''}>
        <option value="">— unassigned —</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function AccountForm({
  action,
  owners,
  canAssignOwner,
  account,
  submitLabel,
}: {
  action: Action;
  owners: OwnerOption[];
  canAssignOwner: boolean;
  account?: AccountRow;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className="mt-5 max-w-xl space-y-4">
      <Field label="Account name *">
        <input
          name="name"
          required
          className="input"
          defaultValue={account?.name ?? ''}
          placeholder="e.g. United Rentals"
        />
      </Field>
      <Field label="Primary state">
        <input
          name="primary_state"
          className="input"
          defaultValue={account?.primary_state ?? ''}
          placeholder="e.g. TX"
          maxLength={2}
        />
      </Field>
      {canAssignOwner && <OwnerSelect owners={owners} defaultValue={account?.owner_id ?? null} />}
      {state.error && <p className="text-sm text-[var(--color-atrisk)]">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary" data-tap>
          {pending ? 'Saving…' : submitLabel}
        </button>
        <Link
          href={account ? `/accounts/${account.id}` : '/accounts'}
          className="btn-secondary"
          data-tap
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function BranchForm({
  action,
  accounts,
  owners,
  canAssignOwner,
  branch,
  defaultAccountId,
  lockAccount,
  submitLabel,
}: {
  action: Action;
  accounts: AccountOption[];
  owners: OwnerOption[];
  canAssignOwner: boolean;
  branch?: BranchRow;
  defaultAccountId?: string;
  lockAccount?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const accId = branch?.account_id ?? defaultAccountId ?? '';
  return (
    <form action={formAction} className="mt-5 max-w-xl space-y-4">
      {lockAccount ? (
        <input type="hidden" name="account_id" value={accId} />
      ) : (
        <Field label="Account *">
          <select name="account_id" required className="input" defaultValue={accId}>
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Branch name *">
        <input
          name="name"
          required
          className="input"
          defaultValue={branch?.name ?? ''}
          placeholder="e.g. United Rentals - Dallas, TX"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="City">
          <input name="city" className="input" defaultValue={branch?.city ?? ''} />
        </Field>
        <Field label="State">
          <input name="state" className="input" defaultValue={branch?.state ?? ''} maxLength={2} />
        </Field>
      </div>
      {canAssignOwner && <OwnerSelect owners={owners} defaultValue={branch?.owner_id ?? null} />}
      {state.error && <p className="text-sm text-[var(--color-atrisk)]">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary" data-tap>
          {pending ? 'Saving…' : submitLabel}
        </button>
        <Link
          href={branch ? `/branches/${branch.id}` : accId ? `/accounts/${accId}` : '/accounts'}
          className="btn-secondary"
          data-tap
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
