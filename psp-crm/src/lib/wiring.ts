/**
 * Customer-wiring cadence engine — ported from the PSP workbook's Customer
 * Wiring tab (and the KPI dashboard's lib/crm.js implementation).
 *
 * Account size class comes from TTM revenue; crossed with the relationship
 * rating (1 = strategic/invest, 3 = transactional/maintain) it yields a target
 * touch frequency:
 *
 *            rel 1   rel 2   rel 3
 *   A ≥ $6M    12      12      6     touches / year
 *   B ≥ $2M     8       8      4
 *   C ≥ $1M     6       4      2
 *   D ≥ $200K   4       2      1
 *   E < $200K   2       1      0    (0 = no proactive cadence)
 */

export type SizeClass = 'A' | 'B' | 'C' | 'D' | 'E';
export type RelationshipRating = 1 | 2 | 3;

export const SIZE_THRESHOLDS: { size: SizeClass; min: number }[] = [
  { size: 'A', min: 6_000_000 },
  { size: 'B', min: 2_000_000 },
  { size: 'C', min: 1_000_000 },
  { size: 'D', min: 200_000 },
  { size: 'E', min: 0 },
];

export const WIRING_FREQ: Record<SizeClass, [number, number, number]> = {
  A: [12, 12, 6],
  B: [8, 8, 4],
  C: [6, 4, 2],
  D: [4, 2, 1],
  E: [2, 1, 0],
};

export const RATING_LABELS: Record<RelationshipRating, string> = {
  1: 'Strategic',
  2: 'Important',
  3: 'Transactional',
};

export const DEFAULT_RATING: RelationshipRating = 2;

export function sizeForRevenue(ttmRevenue: number): SizeClass {
  for (const { size, min } of SIZE_THRESHOLDS) {
    if (ttmRevenue >= min) return size;
  }
  return 'E';
}

export function callsPerYear(size: SizeClass, rating: RelationshipRating): number {
  return WIRING_FREQ[size][rating - 1];
}

/** Target interval between touches in days, or null when no cadence applies. */
export function intervalDays(size: SizeClass, rating: RelationshipRating): number | null {
  const cpy = callsPerYear(size, rating);
  if (cpy <= 0) return null;
  return Math.round(365 / cpy);
}

export type Wiring = {
  size: SizeClass;
  rating: RelationshipRating;
  callsPerYear: number;
  intervalDays: number | null;
};

export function wiringFor(ttmRevenue: number, rating: number | null | undefined): Wiring {
  const r = (rating === 1 || rating === 2 || rating === 3 ? rating : DEFAULT_RATING) as RelationshipRating;
  const size = sizeForRevenue(ttmRevenue);
  return {
    size,
    rating: r,
    callsPerYear: callsPerYear(size, r),
    intervalDays: intervalDays(size, r),
  };
}

/** "A×1 · 12/yr · every 30d" — compact label for UI chips. */
export function wiringLabel(w: Wiring): string {
  return w.intervalDays == null
    ? `${w.size}×${w.rating} · no cadence`
    : `${w.size}×${w.rating} · ${w.callsPerYear}/yr · every ${w.intervalDays}d`;
}
