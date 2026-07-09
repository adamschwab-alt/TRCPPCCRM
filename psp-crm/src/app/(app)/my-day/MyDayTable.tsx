'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { logTouch, dismissRecommendation, type TouchState } from './actions';
import type { MyDayRow, ContactOption } from '@/lib/myday/queries';
import type { RecRef } from '@/lib/ai/recs';
import type { ReasonKey } from '@/lib/myday/score';
import { fmtCurrencyShort, fmtDeltaPct } from '@/lib/format';

type SortKey = 'priority' | 'stake' | 'idle' | 'trend';

const REASON_STYLE: Record<ReasonKey, string> = {
  decline: 'bg-[var(--color-atrisk-bg)] text-[var(--color-atrisk)]',
  overdue: 'bg-[var(--color-watch-bg)] text-[var(--color-watch)]',
  whitespace: 'bg-brand-50 text-brand-700',
};

export function MyDayTable({
  rows,
  showOwner,
  contactsByAccount = {},
  recByBranch = {},
}: {
  rows: MyDayRow[];
  showOwner: boolean;
  contactsByAccount?: Record<string, ContactOption[]>;
  recByBranch?: Record<string, RecRef>;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('priority');

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((r) =>
          `${r.branch.branch_name} ${r.account_name ?? ''} ${r.branch.state ?? ''} ${r.owner_name ?? ''}`
            .toLowerCase()
            .includes(needle),
        )
      : rows;
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sort === 'stake') return b.impact - a.impact;
      if (sort === 'idle') return (b.branch.days_idle ?? -1) - (a.branch.days_idle ?? -1);
      if (sort === 'trend') return (a.branch.delta_pct ?? 0) - (b.branch.delta_pct ?? 0);
      return b.priority - a.priority;
    });
    return arr;
  }, [rows, q, sort]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter branches, accounts, state…"
          className="input max-w-xs"
        />
        <div className="flex items-center gap-2">
          <span className="text-muted text-xs">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="input py-1.5"
          >
            <option value="priority">Priority</option>
            <option value="stake">$ at stake</option>
            <option value="idle">Days idle</option>
            <option value="trend">Worst trend</option>
          </select>
          <span className="text-muted text-xs whitespace-nowrap">
            {view.length} of {rows.length}
          </span>
        </div>
      </div>

      {view.length === 0 ? (
        <div className="border-line bg-surface text-muted rounded-lg border p-8 text-center text-sm">
          Nothing to work right now — every branch in this book is on track. 🎉
        </div>
      ) : (
        <ul className="space-y-2">
          {view.map((r, i) => (
            <WorkCard
              key={r.branch.branch_id}
              row={r}
              rank={i + 1}
              showOwner={showOwner}
              contacts={contactsByAccount[r.branch.account_id] ?? []}
              rec={recByBranch[r.branch.branch_id]}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function WorkCard({
  row,
  rank,
  showOwner,
  contacts,
  rec,
}: {
  row: MyDayRow;
  rank: number;
  showOwner: boolean;
  contacts: ContactOption[];
  rec?: RecRef;
}) {
  const [open, setOpen] = useState(false);
  const [dismissing, startDismiss] = useTransition();
  const b = row.branch;

  return (
    <li className="border-line bg-surface rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
        <span className="text-muted w-6 text-center text-sm font-bold tabular-nums">{rank}</span>

        <div className="min-w-[180px] flex-1">
          <Link
            href={`/branches/${b.branch_id}`}
            className="text-brand-700 font-medium hover:underline"
          >
            {b.branch_name}
          </Link>
          <div className="text-muted text-xs">
            {row.account_name ?? '—'}
            {b.state ? ` · ${b.state}` : ''}
            {showOwner && row.owner_name ? ` · ${row.owner_name}` : ''}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {row.reasons.map((reason) => (
              <span
                key={reason.key}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${REASON_STYLE[reason.key]}`}
              >
                {reason.label}
              </span>
            ))}
            {row.wiring && row.wiring.intervalDays != null && (
              <span
                className="bg-canvas text-muted rounded-full px-2 py-0.5 text-[11px] font-semibold"
                title="Customer wiring: account size × relationship → target touch frequency"
              >
                {row.wiring.size}×{row.wiring.rating} · every {row.wiring.intervalDays}d
              </span>
            )}
          </div>
        </div>

        <Metric label="At stake" value={fmtCurrencyShort(row.impact)} strong />
        <Metric
          label="Trend"
          value={fmtDeltaPct(b.delta_pct)}
          tone={b.delta < 0 ? 'bad' : 'neutral'}
        />
        <Metric
          label="Idle"
          value={b.days_idle != null ? `${b.days_idle}d` : '—'}
          tone={row.reasons.some((x) => x.key === 'overdue') ? 'warn' : 'neutral'}
        />
        <Metric
          label="Last touch"
          value={row.daysSinceTouch == null ? 'never' : `${row.daysSinceTouch}d ago`}
          tone={row.needsTouch ? 'warn' : 'neutral'}
        />

        <div className="flex items-center gap-2">
          {rec?.status === 'shown' && (
            <button
              type="button"
              disabled={dismissing}
              onClick={() => startDismiss(() => dismissRecommendation(rec.id))}
              className="text-muted hover:text-charcoal text-xs"
              title="Not relevant — dismiss this suggestion (logged)"
              data-tap
            >
              ✕ Skip
            </button>
          )}
          {rec?.status === 'dismissed' && (
            <span className="text-muted text-xs" title="You dismissed this suggestion today">
              skipped
            </span>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-secondary px-3 py-1.5 text-sm"
            data-tap
          >
            {open ? 'Close' : 'Log touch'}
          </button>
        </div>
      </div>

      {open && <TouchForm row={row} contacts={contacts} rec={rec} onDone={() => setOpen(false)} />}
    </li>
  );
}

function Metric({
  label,
  value,
  strong,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'bad' | 'warn' | 'neutral';
}) {
  const accent =
    tone === 'bad'
      ? 'text-[var(--color-atrisk)]'
      : tone === 'warn'
        ? 'text-[var(--color-watch)]'
        : 'text-charcoal-2';
  return (
    <div className="w-20 text-right">
      <div className="text-muted text-[10px] tracking-wide uppercase">{label}</div>
      <div className={`text-sm tabular-nums ${strong ? 'text-charcoal font-bold' : accent}`}>
        {value}
      </div>
    </div>
  );
}

function TouchForm({
  row,
  contacts,
  rec,
  onDone,
}: {
  row: MyDayRow;
  contacts: ContactOption[];
  rec?: RecRef;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<TouchState, FormData>(logTouch, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
  }, [state.ok, onDone]);

  return (
    <form ref={ref} action={action} className="border-line bg-canvas/60 border-t p-3">
      <input type="hidden" name="branch_id" value={row.branch.branch_id} />
      <input type="hidden" name="account_id" value={row.branch.account_id} />
      {rec && rec.status === 'shown' && (
        <input type="hidden" name="recommendation_id" value={rec.id} />
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Type</span>
          <select name="type" className="input py-1.5" defaultValue="call">
            <option value="call">📞 Call</option>
            <option value="visit">🚗 Visit</option>
            <option value="email">✉️ Email</option>
            <option value="note">📝 Note</option>
          </select>
        </label>
        {contacts.length > 0 && (
          <label className="block">
            <span className="text-charcoal-2 mb-1 block text-xs font-medium">Who (optional)</span>
            <select name="contact_id" className="input py-1.5" defaultValue="">
              <option value="">— contact —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.title ? ` (${c.title})` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block flex-1">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Note (optional)</span>
          <input
            name="body"
            className="input py-1.5"
            placeholder="e.g. Reached buyer — reorder steel plate next week"
          />
        </label>
        <button type="submit" disabled={pending} className="btn-primary px-4 py-1.5" data-tap>
          {pending ? 'Saving…' : 'Save touch'}
        </button>
      </div>
      {state.error && <p className="mt-2 text-xs text-[var(--color-atrisk)]">{state.error}</p>}
      {state.ok && (
        <p className="mt-2 text-xs text-[var(--color-ontrack)]">
          Logged ✓ — this branch will rotate down your list.
        </p>
      )}
    </form>
  );
}
