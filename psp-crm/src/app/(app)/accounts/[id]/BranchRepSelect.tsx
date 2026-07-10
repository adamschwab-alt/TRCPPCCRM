'use client';

import { useState, useTransition } from 'react';
import { setBranchOwner } from '../actions';

export type RepChoice = { id: string; name: string };

/** Inline rep dropdown on the branch table (staff only). */
export function BranchRepSelect({
  branchId,
  ownerId,
  fallbackLabel,
  reps,
}: {
  branchId: string;
  ownerId: string | null;
  /** what the Rep column shows when unassigned (account owner / covered-by) */
  fallbackLabel: string | null;
  reps: RepChoice[];
}) {
  const [value, setValue] = useState(ownerId ?? '');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: string) {
    const prev = value;
    setValue(next);
    setError(null);
    start(async () => {
      const res = await setBranchOwner(branchId, next || null);
      if (res.error) {
        setValue(prev);
        setError(res.error);
      }
    });
  }

  return (
    <span>
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
        className="border-line bg-surface text-charcoal-2 w-full max-w-[150px] rounded-md border px-1.5 py-1 text-xs"
        title="Assign the rep responsible for this branch"
      >
        <option value="">{fallbackLabel ? `↳ ${fallbackLabel}` : '— unassigned —'}</option>
        {reps.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      {error && <span className="block text-[10px] text-[var(--color-atrisk)]">{error}</span>}
    </span>
  );
}
