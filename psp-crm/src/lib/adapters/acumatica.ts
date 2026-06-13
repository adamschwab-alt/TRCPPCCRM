import 'server-only';
import type { DataSourceAdapter, ImportDataset } from './types';
import { env } from '@/lib/env';

/**
 * AcumaticaODataAdapter — PHASE 2 STUB (§1.1). Reads endpoint/creds from env but
 * is intentionally NOT wired in v0. Implementing `load()` against Acumatica's
 * OData feed is the only change needed to switch the importer to live sync —
 * everything downstream (upsert, metric views, dashboard) is unchanged.
 */
export class AcumaticaODataAdapter implements DataSourceAdapter {
  readonly name = 'acumatica-odata';

  private config() {
    return {
      url: process.env.ACUMATICA_ODATA_URL ?? '',
      username: process.env.ACUMATICA_ODATA_USERNAME ?? '',
      password: process.env.ACUMATICA_ODATA_PASSWORD ?? '',
    };
  }

  async load(): Promise<ImportDataset> {
    const { url } = this.config();
    // Use env() so the unused import is meaningful and config is validated lazily
    // when this adapter is actually enabled in phase 2.
    void env;
    throw new Error(
      `AcumaticaODataAdapter is a phase-2 stub and is not wired in v0` +
        (url ? ` (configured endpoint: ${url})` : ' (no ACUMATICA_ODATA_URL set)') +
        `. Use FileImportAdapter for v0.`,
    );
  }
}
