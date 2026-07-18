'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TransitionFormProps {
  branchId: string;
  branchName: string;
  currentOwnerId: string | null;
  onClose?: () => void;
}

interface RepOption {
  id: string;
  name: string;
  utilization: number;
  availableCapacity: number;
}

/**
 * Form to stage a rep transition (planned change).
 * Shows capacity warning if new rep would be overloaded.
 */
export function TransitionForm({ branchId, branchName, currentOwnerId, onClose }: TransitionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    newOwnerId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    reason: 'restructuring' as 'successor' | 'restructuring' | 'rebalance',
    notes: '',
  });

  const [repOptions, setRepOptions] = useState<RepOption[]>([]);
  const [selectedRepCapacity, setSelectedRepCapacity] = useState<{
    utilization: number;
    overloaded: boolean;
    message: string;
  } | null>(null);

  // Load available reps on mount
  useState(() => {
    fetchRepOptions();
  });

  async function fetchRepOptions() {
    try {
      // Would call an API endpoint to get reps with workload info
      // For now, this is a placeholder
      setRepOptions([]);
    } catch (err) {
      setError('Failed to load rep options');
    }
  }

  async function handleRepChange(repId: string) {
    setFormData((prev) => ({ ...prev, newOwnerId: repId }));

    // Validate capacity
    if (repId) {
      try {
        const response = await fetch(`/api/coverage/validate-capacity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repId }),
        });

        if (response.ok) {
          const validation = await response.json();
          setSelectedRepCapacity({
            utilization: validation.afterTransitionUtilization,
            overloaded: validation.overloaded,
            message: validation.message,
          });
        }
      } catch (err) {
        console.error('Capacity validation failed:', err);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/coverage/plan-transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          newOwnerId: formData.newOwnerId,
          scheduledDate: formData.scheduledDate,
          reason: formData.reason,
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create transition');
      }

      // Success
      router.refresh();
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-charcoal block text-sm font-semibold">Branch</label>
        <div className="text-muted mt-1 text-sm">{branchName}</div>
      </div>

      <div>
        <label htmlFor="newOwnerId" className="text-charcoal block text-sm font-semibold">
          New Rep Assignment
        </label>
        <select
          id="newOwnerId"
          value={formData.newOwnerId}
          onChange={(e) => handleRepChange(e.target.value)}
          required
          className="border-line focus:ring-brand text-charcoal mt-1 block w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2"
        >
          <option value="">Select a rep…</option>
          {repOptions.map((rep) => (
            <option key={rep.id} value={rep.id}>
              {rep.name} — {rep.utilization.toFixed(0)}% utilized ({rep.availableCapacity} calls available)
            </option>
          ))}
        </select>
      </div>

      {selectedRepCapacity && (
        <div
          className={`rounded px-3 py-2 text-xs ${
            selectedRepCapacity.overloaded
              ? 'bg-red-50 text-red-700'
              : selectedRepCapacity.utilization >= 95
                ? 'bg-amber-50 text-amber-700'
                : 'bg-green-50 text-green-700'
          }`}
        >
          {selectedRepCapacity.message}
        </div>
      )}

      <div>
        <label htmlFor="scheduledDate" className="text-charcoal block text-sm font-semibold">
          Effective Date
        </label>
        <input
          id="scheduledDate"
          type="date"
          value={formData.scheduledDate}
          onChange={(e) => setFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))}
          required
          className="border-line focus:ring-brand text-charcoal mt-1 block w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      </div>

      <div>
        <label htmlFor="reason" className="text-charcoal block text-sm font-semibold">
          Reason
        </label>
        <select
          id="reason"
          value={formData.reason}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              reason: e.target.value as typeof formData.reason,
            }))
          }
          className="border-line focus:ring-brand text-charcoal mt-1 block w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2"
        >
          <option value="successor">Successor (rep leaving, inheriting book)</option>
          <option value="restructuring">Restructuring (territory realignment)</option>
          <option value="rebalance">Rebalance (capacity management)</option>
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="text-charcoal block text-sm font-semibold">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="border-line focus:ring-brand text-charcoal mt-1 block w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          placeholder="e.g., Ross retiring, Vinnie inheriting full book. Expected transition difficulty: low."
        />
      </div>

      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white rounded px-4 py-2 text-sm font-semibold transition"
        >
          {loading ? 'Creating…' : 'Create Transition'}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-charcoal rounded px-4 py-2 text-sm font-semibold transition"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
