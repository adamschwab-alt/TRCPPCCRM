'use client';

import { useActionState } from 'react';
import {
  updateTargets,
  inviteUser,
  syncNow,
  rebuildData,
  dedupeData,
  restoreFromWorkbook,
  addEvidence,
  importWiring,
  type FormState,
} from './actions';
import type { TargetsRow } from '@/types/database';

export function SyncForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(syncNow, {});
  return (
    <form action={action} className="space-y-3">
      <p className="text-muted text-xs">
        Pulls new sales from the Acumatica OData feed and refreshes every metric. Safe to run
        anytime — it only adds rows it hasn&rsquo;t seen.
      </p>
      {state.error && <p className="text-sm text-[var(--color-atrisk)]">{state.error}</p>}
      {state.ok && (
        <p className="rounded-md bg-[var(--color-ontrack-bg)] p-2 text-sm text-[var(--color-ontrack)]">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary" data-tap>
        {pending ? 'Syncing…' : 'Sync now'}
      </button>
    </form>
  );
}

export function WiringImportForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(importWiring, {});
  return (
    <form action={action} className="space-y-3">
      <input
        type="file"
        name="file"
        accept=".xlsx,.xls"
        className="border-line block w-full rounded-md border p-2 text-sm"
      />
      {state.error && (
        <p className="rounded-md bg-[var(--color-atrisk-bg)] p-2 text-sm text-[var(--color-atrisk)]">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-md bg-[var(--color-ontrack-bg)] p-2 text-sm text-[var(--color-ontrack)]">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary" data-tap>
        {pending ? 'Importing…' : 'Import wiring workbook'}
      </button>
    </form>
  );
}

export function EvidenceForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addEvidence, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Type</span>
          <select name="kind" className="input" defaultValue="market">
            <option value="market">Market event (chart footnote)</option>
            <option value="testimonial">Testimonial (dated quote)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Date</span>
          <input name="event_date" type="date" className="input" />
        </label>
      </div>
      <label className="block">
        <span className="text-charcoal-2 mb-1 block text-xs font-medium">
          Event / quote
        </span>
        <input
          name="title"
          className="input"
          placeholder='e.g. "Steel price increase announced" or "My Day tells me exactly who to call — Brandon"'
        />
      </label>
      <label className="block">
        <span className="text-charcoal-2 mb-1 block text-xs font-medium">Detail (optional)</span>
        <input name="note" className="input" placeholder="Context, attribution, expected impact…" />
      </label>
      {state.error && <p className="text-sm text-[var(--color-atrisk)]">{state.error}</p>}
      {state.ok && <p className="text-sm text-[var(--color-ontrack)]">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-secondary" data-tap>
        {pending ? 'Logging…' : 'Log evidence'}
      </button>
    </form>
  );
}

export function RestoreForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(restoreFromWorkbook, {});
  return (
    <form action={action} className="space-y-3">
      <p className="text-muted text-xs">
        Recovery: reload the sales table from your PSP workbook (.xlsx) — the file you originally
        uploaded. Use this if the sales data was emptied. No Acumatica needed. Accounts, owners,
        pipeline, and activities are untouched.
      </p>
      <input
        type="file"
        name="file"
        accept=".xlsx,.xls"
        className="border-line block w-full rounded-md border p-2 text-sm"
      />
      {state.error && (
        <p className="rounded-md bg-[var(--color-atrisk-bg)] p-2 text-sm text-[var(--color-atrisk)]">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-md bg-[var(--color-ontrack-bg)] p-2 text-sm text-[var(--color-ontrack)]">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary" data-tap>
        {pending ? 'Restoring… (up to a few min — don’t close)' : 'Restore from workbook'}
      </button>
    </form>
  );
}

export function DedupeForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(dedupeData, {});
  return (
    <form action={action} className="space-y-3">
      <p className="text-muted text-xs">
        Removes duplicate sales rows left by the original data load — the cause of the doubled
        figures. Runs entirely in the database (no Acumatica call), so it&rsquo;s fast and
        won&rsquo;t hang. Keeps one clean copy of every sale; accounts, owners, pipeline, and
        activities are untouched.
      </p>
      {state.error && (
        <p className="rounded-md bg-[var(--color-atrisk-bg)] p-2 text-sm text-[var(--color-atrisk)]">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-md bg-[var(--color-ontrack-bg)] p-2 text-sm text-[var(--color-ontrack)]">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary" data-tap>
        {pending ? 'Removing duplicates…' : 'Remove duplicate rows'}
      </button>
    </form>
  );
}

export function RebuildForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(rebuildData, {});
  return (
    <form action={action} className="space-y-3">
      <p className="text-muted text-xs">
        Fixes doubled sales figures. Re-pulls the <strong>entire</strong> Acumatica feed, then
        replaces the sales table with that single clean copy — so duplicate rows from the original
        data load are removed. Your accounts, owners, pipeline, and activities are{' '}
        <strong>not</strong> affected. Safe: nothing is deleted until the full pull succeeds.
      </p>
      {state.error && (
        <p className="rounded-md bg-[var(--color-atrisk-bg)] p-2 text-sm text-[var(--color-atrisk)]">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-md bg-[var(--color-ontrack-bg)] p-2 text-sm text-[var(--color-ontrack)]">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="border-line text-charcoal-2 hover:bg-canvas rounded-md border px-4 py-2 text-sm font-semibold"
        data-tap
      >
        {pending ? 'Rebuilding… (up to a few min — don’t close)' : 'Rebuild sales data from Acumatica'}
      </button>
    </form>
  );
}

function Num({
  label,
  name,
  defaultValue,
  step,
  suffix,
}: {
  label: string;
  name: string;
  defaultValue: number | string;
  step?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-charcoal-2 mb-1 block text-xs font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <input
          name={name}
          type="number"
          step={step ?? 'any'}
          defaultValue={defaultValue}
          className="input"
        />
        {suffix && <span className="text-muted text-xs">{suffix}</span>}
      </div>
    </label>
  );
}

export function TargetsForm({ targets }: { targets: TargetsRow }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateTargets, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Num
          label="GRR target"
          name="grr_target"
          defaultValue={Math.round(targets.grr_target * 100)}
          suffix="%"
        />
        <Num
          label="NRR target"
          name="nrr_target"
          defaultValue={Math.round(targets.nrr_target * 100)}
          suffix="%"
        />
        <Num
          label="Retention floor"
          name="retention_floor"
          defaultValue={Math.round(targets.retention_floor * 100)}
          suffix="%"
        />
        <Num
          label="New business / yr"
          name="new_biz_target"
          defaultValue={targets.new_biz_target}
          suffix="$"
        />
        <Num
          label="Contraction ceiling"
          name="contraction_ceiling"
          defaultValue={targets.contraction_ceiling}
          suffix="$"
        />
        <Num
          label="Cross-sell target"
          name="xsell_target"
          defaultValue={targets.xsell_target}
          suffix="#"
        />
        <Num
          label="Pipeline coverage"
          name="pipeline_coverage_target"
          defaultValue={targets.pipeline_coverage_target}
          suffix="×"
        />
        <Num
          label="Cadence days"
          name="cadence_days"
          defaultValue={targets.cadence_days}
          suffix="d"
        />
      </div>
      {state.error && <p className="text-sm text-[var(--color-atrisk)]">{state.error}</p>}
      {state.ok && <p className="text-sm text-[var(--color-ontrack)]">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary" data-tap>
        {pending ? 'Saving…' : 'Save targets'}
      </button>
    </form>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteUser, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Email</span>
          <input name="email" type="email" required className="input" placeholder="rep@psp.com" />
        </label>
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Full name</span>
          <input name="full_name" className="input" placeholder="Dana Rep" />
        </label>
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Role</span>
          <select name="role" className="input" defaultValue="rep">
            <option value="rep">Rep</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>
      {state.error && <p className="text-sm text-[var(--color-atrisk)]">{state.error}</p>}
      {state.ok && (
        <p className="rounded-md bg-[var(--color-ontrack-bg)] p-2 text-sm text-[var(--color-ontrack)]">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary" data-tap>
        {pending ? 'Creating…' : 'Create user'}
      </button>
    </form>
  );
}
