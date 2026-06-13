import type { CoverageRag, BranchStatus, WhiteSpace } from '@/types/database';

/** $65.4M / $1.2M / $940K / $312 */
export function fmtCurrencyShort(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

/** delta_pct stored as a ratio; null → "n/m" (no prior). */
export function fmtPct(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function fmtDeltaPct(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return 'n/m';
  const pct = ratio * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : '')).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const RAG_CLASS: Record<CoverageRag, string> = {
  'On-track': 'bg-[var(--color-ontrack-bg)] text-[var(--color-ontrack)]',
  Watch: 'bg-[var(--color-watch-bg)] text-[var(--color-watch)]',
  'At-risk': 'bg-[var(--color-atrisk-bg)] text-[var(--color-atrisk)]',
};
export const ragClass = (rag: CoverageRag) => RAG_CLASS[rag] ?? '';

const STATUS_CLASS: Record<BranchStatus, string> = {
  Active: 'bg-[var(--color-ontrack-bg)] text-[var(--color-ontrack)]',
  New: 'bg-blue-100 text-blue-700',
  Declining: 'bg-[var(--color-watch-bg)] text-[var(--color-watch)]',
  Lapsed: 'bg-[var(--color-atrisk-bg)] text-[var(--color-atrisk)]',
};
export const statusClass = (s: BranchStatus) => STATUS_CLASS[s] ?? '';

export const whiteSpaceLabel = (w: WhiteSpace) =>
  w === 'Steel gap' ? 'No steel' : w === 'Alu gap' ? 'No aluminum' : w === 'Both' ? 'No alu/steel' : '—';
