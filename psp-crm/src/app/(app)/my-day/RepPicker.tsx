'use client';

import { useRouter } from 'next/navigation';
import type { RepOption } from '@/lib/myday/queries';

/** Staff-only "view as rep" toggle. Navigates with ?rep=<id> (or clears it). */
export function RepPicker({ reps, current }: { reps: RepOption[]; current?: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Viewing</span>
      <select
        value={current ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `/my-day?rep=${v}` : '/my-day');
        }}
        className="input max-w-[220px] py-1.5"
      >
        <option value="">All reps</option>
        {reps.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.role !== 'rep' ? ` (${r.role})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
