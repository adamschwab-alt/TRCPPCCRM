'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DataCoverage } from '@/lib/sync/coverage';
import { fmtMonthYear, fmtDate, fmtRelative } from '@/lib/format';

type RefreshState = { ok?: boolean; error?: string; message?: string };

/**
 * Top-bar data-freshness pill. Shows the analytic cutoff at a glance; clicking
 * opens a panel with the full span of loaded periods, the record count, and when
 * it was last refreshed. Staff get a "Refresh now" button that triggers a live
 * Acumatica sync; reps see the status read-only.
 */
export function DataRefresh({
  coverage,
  canRefresh,
}: {
  coverage: DataCoverage;
  canRefresh: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<RefreshState>({});

  async function runRefresh() {
    setPending(true);
    setState({});
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        // Surface a hung request as an error instead of spinning forever.
        signal: AbortSignal.timeout(120_000),
      });
      const json: RefreshState = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setState({ error: json.error ?? `Refresh failed (${res.status}). Try again in a minute.` });
      } else {
        setState({ ok: true, message: json.message });
        router.refresh(); // pull the new freshness numbers into view
      }
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      setState({
        error: timedOut
          ? 'The refresh is taking too long — it may still finish in the background. Reload the page in a minute to check.'
          : 'Network error — please try again.',
      });
    } finally {
      setPending(false);
    }
  }

  // Close the panel on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const asOfLabel = coverage.asOf ? fmtMonthYear(coverage.asOf) : 'No data';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border-line text-charcoal-2 hover:bg-canvas flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium"
        title="Data freshness"
        data-tap
      >
        <span className="text-brand-700">↻</span>
        <span className="hidden sm:inline">Data</span>
        <span className="text-muted hidden md:inline">·</span>
        <span className="hidden md:inline">{asOfLabel}</span>
        <span className="text-muted">▾</span>
      </button>

      {open && (
        <div className="border-line bg-surface absolute right-0 z-30 mt-2 w-72 rounded-lg border p-3 shadow-lg">
          <div className="text-charcoal text-sm font-semibold">Live sales data</div>

          <dl className="mt-2 space-y-1.5 text-xs">
            <Row label="As-of cutoff" value={coverage.asOf ? fmtMonthYear(coverage.asOf) : '—'} />
            <Row
              label="Periods loaded"
              value={
                coverage.spanStart && coverage.spanEnd
                  ? `${fmtMonthYear(coverage.spanStart)} → ${fmtMonthYear(coverage.spanEnd)}`
                  : '—'
              }
            />
            <Row
              label="Coverage"
              value={
                coverage.months != null
                  ? `${coverage.months} mo · ${coverage.txnCount.toLocaleString('en-US')} records`
                  : `${coverage.txnCount.toLocaleString('en-US')} records`
              }
            />
            <Row
              label="Last refreshed"
              value={
                coverage.lastRefreshed
                  ? `${fmtRelative(coverage.lastRefreshed)}${
                      coverage.lastInserted != null ? ` · +${coverage.lastInserted}` : ''
                    }`
                  : 'Never'
              }
            />
            {coverage.lastRefreshed && (
              <Row label="" value={`${fmtDate(coverage.lastRefreshed.slice(0, 10))} (UTC)`} muted />
            )}
          </dl>

          {canRefresh ? (
            <div className="mt-3">
              {state.error && (
                <p className="mb-2 text-xs text-[var(--color-atrisk)]">{state.error}</p>
              )}
              {state.ok && state.message && (
                <p className="mb-2 rounded bg-[var(--color-ontrack-bg)] p-1.5 text-xs text-[var(--color-ontrack)]">
                  {state.message}
                </p>
              )}
              <button
                type="button"
                onClick={runRefresh}
                disabled={pending}
                className="btn-primary w-full"
                data-tap
              >
                {pending ? 'Refreshing… (up to a few min)' : 'Refresh now'}
              </button>
              <p className="text-muted mt-1.5 text-[10px]">
                Pulls the latest from Acumatica. Safe anytime — only adds new rows.
              </p>
            </div>
          ) : (
            <p className="text-muted mt-3 text-[10px]">
              Data refresh is managed by your admin.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted whitespace-nowrap">{label}</dt>
      <dd className={`text-right ${muted ? 'text-muted' : 'text-charcoal-2 font-medium'}`}>
        {value}
      </dd>
    </div>
  );
}
