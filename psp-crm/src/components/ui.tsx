import type { ReactNode } from 'react';
import { ragClass, statusClass } from '@/lib/format';
import type { CoverageRag, BranchStatus } from '@/types/database';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-line bg-surface ${className}`}>{children}</div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold tracking-tight text-charcoal">{children}</h2>;
}

export function RagBadge({ rag }: { rag: CoverageRag }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ragClass(rag)}`}>
      {rag}
    </span>
  );
}

export function StatusBadge({ status }: { status: BranchStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(status)}`}
    >
      {status}
    </span>
  );
}

/** KPI tile with optional RAG accent + target context. */
export function KpiTile({
  label,
  value,
  sub,
  tone = 'neutral',
  flagship = false,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  flagship?: boolean;
}) {
  const accent =
    tone === 'good'
      ? 'text-[var(--color-ontrack)]'
      : tone === 'warn'
        ? 'text-[var(--color-watch)]'
        : tone === 'bad'
          ? 'text-[var(--color-atrisk)]'
          : 'text-charcoal';
  return (
    <Card className={`p-4 ${flagship ? 'ring-2 ring-brand/40' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {flagship && (
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700">
            Flagship
          </span>
        )}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}
