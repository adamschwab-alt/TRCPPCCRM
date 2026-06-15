'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import type { OpportunityRow } from '@/types/database';
import type { AccountOption, BranchOption } from '@/lib/pipeline/queries';
import type { FormState } from './actions';

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function OpportunityForm({
  action,
  accounts,
  branches,
  stageWinProb,
  opp,
  submitLabel,
}: {
  action: Action;
  accounts: AccountOption[];
  branches: BranchOption[];
  stageWinProb: Record<string, number>;
  opp?: OpportunityRow;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [accountId, setAccountId] = useState(opp?.account_id ?? '');
  const [closeDate, setCloseDate] = useState(opp?.expected_close ?? '');
  const [stage, setStage] = useState(opp?.stage ?? 'Qualified');
  const todayIso = new Date().toISOString().slice(0, 10);
  const pastClose = closeDate !== '' && closeDate < todayIso;
  const [winPct, setWinPct] = useState(
    opp?.win_prob != null
      ? String(Math.round(opp.win_prob * 100))
      : String(Math.round((stageWinProb['Qualified'] ?? 0.1) * 100)),
  );

  const accountBranches = useMemo(
    () => branches.filter((b) => b.account_id === accountId),
    [branches, accountId],
  );

  function onStageChange(s: string) {
    setStage(s as typeof stage);
    const def = stageWinProb[s];
    if (def != null) setWinPct(String(Math.round(def * 100)));
  }

  return (
    <form action={formAction} className="mt-5 max-w-2xl space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-charcoal-2 mb-1 flex items-center justify-between text-xs font-medium">
            <span>Account *</span>
            <Link href="/accounts/new" className="text-brand-700 hover:underline" target="_blank">
              + New account
            </Link>
          </span>
          <select
            name="account_id"
            required
            className="input"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="Branch (optional)">
          <select name="branch_id" className="input" defaultValue={opp?.branch_id ?? ''}>
            <option value="">— none —</option>
            {accountBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select name="type" className="input" defaultValue={opp?.type ?? ''}>
            <option value="">—</option>
            <option value="new_branch_activation">New branch activation</option>
            <option value="displacement">Displacement</option>
            <option value="new_logo">New logo</option>
            <option value="expansion">Expansion</option>
          </select>
        </Field>
        <Field label="Product line">
          <select name="product_line" className="input" defaultValue={opp?.product_line ?? ''}>
            <option value="">—</option>
            <option value="Aluminum">Aluminum</option>
            <option value="Steel">Steel</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Stage *">
          <select
            name="stage"
            required
            className="input"
            value={stage}
            onChange={(e) => onStageChange(e.target.value)}
          >
            {['Qualified', 'Quoted', 'Verbal', 'Won', 'Lost'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Win %">
          <input
            name="win_pct"
            type="number"
            min="0"
            max="100"
            className="input"
            value={winPct}
            onChange={(e) => setWinPct(e.target.value)}
          />
        </Field>
        <Field label="Amount ($)">
          <input
            name="amount"
            type="number"
            min="0"
            step="1"
            className="input"
            defaultValue={opp?.amount ?? ''}
            placeholder="e.g. 50000"
          />
        </Field>
        <Field label="Gross margin %">
          <input
            name="gm_pct_input"
            type="number"
            min="0"
            max="100"
            className="input"
            defaultValue={opp?.gm_pct != null ? Math.round(opp.gm_pct * 100) : ''}
          />
        </Field>
        <Field label="Lead-time risk">
          <select name="lead_time_risk" className="input" defaultValue={opp?.lead_time_risk ?? ''}>
            <option value="">—</option>
            <option value="Low">Low</option>
            <option value="Med">Med</option>
            <option value="High">High</option>
          </select>
        </Field>
        <Field label="Expected close">
          <input
            name="expected_close"
            type="date"
            className="input"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
          />
          {pastClose && (
            <span className="mt-1 block text-xs text-[var(--color-watch)]">
              ⚠️ This close date is in the past — that&rsquo;s allowed, just double-check it.
            </span>
          )}
        </Field>
        <Field label="Next step">
          <input
            name="next_step"
            className="input"
            defaultValue={opp?.next_step ?? ''}
            placeholder="e.g. Send revised quote"
          />
        </Field>
        <Field label="Next step date">
          <input
            name="next_date"
            type="date"
            className="input"
            defaultValue={opp?.next_date ?? ''}
          />
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" rows={3} className="input" defaultValue={opp?.notes ?? ''} />
      </Field>

      {state.error && <p className="text-sm text-[var(--color-atrisk)]">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary" data-tap>
          {pending ? 'Saving…' : submitLabel}
        </button>
        <Link href="/pipeline" className="btn-secondary" data-tap>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-charcoal-2 mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
