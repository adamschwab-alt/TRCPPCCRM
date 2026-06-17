// NOTE: server-only module (uses node:fs + xlsx). Not guarded with 'server-only'
// because the seed/generator scripts import it under plain Node.
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { type DataSourceAdapter, type ImportDataset } from './types';
import { datasetFromRecords, norm } from './mapping';

/**
 * FileImportAdapter — parses the PSP workbook's `Data` tab into the normalized
 * dataset via the shared `datasetFromRecords` mapping (alias-based matching).
 * Column → schema mapping is documented in README §Importer.
 */
export interface FileImportOptions {
  filePath?: string;
  buffer?: ArrayBuffer | Buffer;
  /** Override the data sheet name (default: a sheet whose name contains "data"). */
  sheetName?: string;
}

export class FileImportAdapter implements DataSourceAdapter {
  readonly name = 'file-import';
  constructor(private readonly opts: FileImportOptions) {}

  async load(): Promise<ImportDataset> {
    const wb = this.opts.buffer
      ? XLSX.read(this.opts.buffer, { type: 'buffer' })
      : XLSX.read(readFileSync(this.opts.filePath!), { type: 'buffer' });

    const sheetName =
      this.opts.sheetName ??
      wb.SheetNames.find((n) => norm(n).includes('data')) ??
      wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet)
      throw new Error(`Sheet not found: ${sheetName}. Sheets: ${wb.SheetNames.join(', ')}`);

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
    return datasetFromRecords(rows);
  }
}
