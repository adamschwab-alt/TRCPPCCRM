'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import type { OpportunityRow } from '@/types/database';
import type { AccountOption, BranchOption, ContactPickOption } from '@/lib/pipeline/queries';
import type { FormState } from './actions';

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function OpportunityForm({
  action,
  accounts,
  branches,
  contacts = [],
  stageWinProb,
  opp,
  submitLabel,
}: {
  action: Action;
  accounts: AccountOption[];
  branches: BranchOption[];
  contacts?: ContactPickOption[];
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
  const accountContacts = useMemo(
    () => contacts.filter((c) => c.account_id === accountId),
    [contacts, accountId],
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
        <Field label="Source *">
          <select name="source" required className="input" defaultValue={opp?.source ?? ''}>
            <option value="">Where did this come from?</option>
            <option value="existing_account">Existing account</option>
            <option value="new_branch">New branch activation</option>
            <option value="referral">Referral</option>
            <option value="inbound">Inbound call/web</option>
            <option value="event">Trade show / event</option>
            <option value="cold">Cold outreach</option>
            <option value="other">Other</option>
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
        <Field label={stage === 'Verbal' ? 'Primary contact *' : 'Primary contact'}>
          <select
            name="primary_contact_id"
            className="input"
            defaultValue={opp?.primary_contact_id ?? ''}
          >
            <option value="">— none —</option>
            {accountContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.title ? ` (${c.title})` : ''}
              </option>
            ))}
          </select>
          {stage === 'Verbal' && accountContacts.length === 0 && (
            <span className="mt-1 block text-xs text-[var(--color-watch)]">
              No contacts on this account yet — add one from the account page first.
            </span>
          )}
        </Field>
        <Field label="Forecast category">
          <select
            name="forecast_category"
            className="input"
            defaultValue={opp?.forecast_category ?? ''}
          >
            <option value="">Auto (from stage)</option>
            <option value="pipeline">Pipeline</option>
            <option value="best_case">Best case</option>
            <option value="commit">Commit</option>
          </select>
        </Field>
        <Field label="Competitor (if any)">
          <input
            name="competitor"
            className="input"
            defaultValue={opp?.competitor ?? ''}
            placeholder="e.g. United Trench"
          />
        </Field>
      </div>

      {stage === 'Lost' && (
        <div className="rounded-md bg-[var(--color-atrisk-bg)] p-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Lost reason *">
              <select
                name="lost_reason"
                className="input"
                defaultValue={opp?.lost_reason ?? ''}
              >
                <option value="">Why did we lose?</option>
                <option value="price">Price</option>
                <option value="availability">Availability / stock</option>
                <option value="lead_time">Lead time</option>
                <option value="spec">Spec / product fit</option>
                <option value="relationship">Relationship</option>
                <option value="no_decision">No decision / went quiet</option>
                <option value="competitor">Chose competitor</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Lost note (optional)">
              <input
                name="lost_note"
                className="input"
                defaultValue={opp?.lost_note ?? ''}
                placeholder="One line of color for win/loss review"
              />
            </Field>
          </div>
        </div>
      )}
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
