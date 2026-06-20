'use client';

import { useMemo, useState, type ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  align?: 'right';
  /** Return a sortable value; omit to make the column non-sortable. */
  sort?: (row: T) => string | number | null;
  /** Text included in the search filter. */
  filter?: (row: T) => string;
  cell: (row: T) => ReactNode;
};

/**
 * Reusable client table with a text filter + clickable column sorting.
 * Operates on already-loaded rows (client-side), so it's instant.
 */
export function DataTable<T>({
  rows,
  columns,
  initialSortKey,
  initialDir = 'asc',
  searchPlaceholder = 'Filter…',
  minWidth = 720,
  rowKey,
}: {
  rows: T[];
  columns: Column<T>[];
  initialSortKey?: string;
  initialDir?: 'asc' | 'desc';
  searchPlaceholder?: string;
  minWidth?: number;
  rowKey?: (row: T, i: number) => string;
}) {
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [dir, setDir] = useState<'asc' | 'desc'>(initialDir);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      columns.some((c) => c.filter && c.filter(r).toLowerCase().includes(needle)),
    );
  }, [rows, columns, q]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return filtered;
    const f = col.sort;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = f(a);
      const bv = f(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls last
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (dir === 'desc') arr.reverse();
    return arr;
  }, [filtered, columns, sortKey, dir]);

  function toggleSort(key: string) {
    const col = columns.find((c) => c.key === key);
    if (!col?.sort) return;
    if (sortKey === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setDir('asc');
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="input max-w-xs"
        />
        <span className="text-muted text-xs whitespace-nowrap">
          {sorted.length} of {rows.length}
        </span>
      </div>
      <div className="border-line bg-surface overflow-x-auto rounded-lg border">
        <table className="w-full text-sm" style={{ minWidth }}>
          <thead>
            <tr className="border-line text-muted border-b text-left text-xs uppercase">
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`px-3 py-2.5 ${c.align === 'right' ? 'text-right' : ''} ${
                    c.sort ? 'hover:text-charcoal cursor-pointer select-none' : ''
                  }`}
                >
                  {c.header}
                  {sortKey === c.key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={rowKey ? rowKey(r, i) : i}
                className="border-line/60 hover:bg-canvas border-b last:border-0"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : ''}`}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-muted px-3 py-8 text-center">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
