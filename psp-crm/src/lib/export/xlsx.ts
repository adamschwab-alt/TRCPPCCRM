import 'server-only';
import * as XLSX from 'xlsx';

/**
 * Build a downloadable .xlsx Response from an array of plain-object rows.
 * Column order follows the keys of the first row. Runs server-side behind auth,
 * so exports respect the caller's RLS (a rep only exports their own book).
 */
export function xlsxResponse(
  filename: string,
  rows: Record<string, unknown>[],
  sheetName = 'Export',
): Response {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const stamp = () => new Date().toISOString().slice(0, 10);
