/**
 * Seeds the workbook via the FileImportAdapter (§6).
 *
 *   npm run db:seed -- ./data/PSP_Account_Coverage_Tracker.xlsx
 *
 * If no path is given, defaults to ./data/PSP_Account_Coverage_Tracker.xlsx.
 * Best-effort reads optional `Targets`/`Settings` sheets to override thresholds
 * and as_of_date. Idempotent — safe to re-run.
 */
import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });

import * as XLSX from 'xlsx';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';
import { FileImportAdapter } from '../src/lib/adapters/file-import';
import { runImport } from '../src/lib/import/run-import';

const DEFAULT_PATH = './data/PSP_Account_Coverage_Tracker.xlsx';

function readSettingsSheet(buffer: Buffer): { asOfDate?: string } {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const name = wb.SheetNames.find((n) => n.toLowerCase().includes('setting'));
    if (!name) return {};
    // Settings is a label/value layout: scan rows for the "As-of (month-end)" cell
    // and take the adjacent value (an Excel serial date).
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: null });
    for (const row of aoa) {
      const label = String(row?.[0] ?? '');
      if (/as.?of/i.test(label)) {
        const v = row.find((c, i) => i > 0 && typeof c === 'number');
        if (typeof v === 'number') {
          const d = XLSX.SSF.parse_date_code(v);
          if (d)
            return {
              asOfDate: `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`,
            };
        }
      }
    }
  } catch {
    /* optional sheet — ignore */
  }
  return {};
}

async function main() {
  const path = process.argv[2] ?? DEFAULT_PATH;
  if (!existsSync(path)) {
    console.error(
      `Workbook not found at ${path}.\n` +
        `Upload PSP_Account_Coverage_Tracker.xlsx to ./data/ or pass a path:\n` +
        `  npm run db:seed -- /path/to/PSP_Account_Coverage_Tracker.xlsx`,
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

  const buffer = readFileSync(path);
  const adapter = new FileImportAdapter({ buffer });
  const dataset = await adapter.load();
  const { asOfDate } = readSettingsSheet(buffer);

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\nImporting ${dataset.transactions.length} transactions from ${path} ...`);
  const summary = await runImport(supabase, dataset, { asOfDate });

  console.log('\n── Import summary ───────────────────────────────');
  console.log(
    `accounts     : +${summary.accounts.inserted} new, ${summary.accounts.existing} existing`,
  );
  console.log(
    `branches     : +${summary.branches.inserted} new, ${summary.branches.existing} existing`,
  );
  console.log(
    `transactions : +${summary.transactions.inserted} inserted, ` +
      `${summary.transactions.skippedDuplicates} dupes skipped, ${summary.transactions.total} parsed`,
  );
  console.log(`as_of_date   : ${summary.asOfDate}`);
  if (summary.unmappedHeaders.length) {
    console.log(
      `\n⚠️  Unmapped source headers (tune HEADER_ALIASES in file-import.ts if any are needed):`,
    );
    console.log('   ' + summary.unmappedHeaders.join(', '));
  }
  console.log('─────────────────────────────────────────────────\n');
}

main().catch((e) => {
  console.error('Seed failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
