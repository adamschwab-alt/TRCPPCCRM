/**
 * PostgREST silently caps unbounded selects at 1000 rows — reads that "work in
 * testing" truncate arbitrarily once a table grows. fetchAll pages any query to
 * completion. Always pair with a stable .order(...) inside the builder so pages
 * don't skip/duplicate rows.
 *
 *   const rows = await fetchAll<Row>((from, to) =>
 *     supabase.from('t').select('a,b').order('id').range(from, to));
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

/** Split ids into URL-safe chunks for .in() filters. */
export function chunkIds(ids: string[], size = 150): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}
