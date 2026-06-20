import type { DataSourceAdapter, ImportDataset } from './types';
import { datasetFromRecords } from './mapping';

/**
 * AcumaticaODataAdapter — pulls sales lines from an Acumatica OData feed (a
 * Generic Inquiry or contract-based endpoint exposed as OData) and runs them
 * through the SAME normalization as the spreadsheet import.
 *
 * Config (env, server-only — never in code):
 *   ACUMATICA_ODATA_URL       full endpoint, e.g.
 *                             https://<site>/odata/<tenant>/<InquiryName>
 *   ACUMATICA_ODATA_USERNAME  basic-auth user (often user@tenant)
 *   ACUMATICA_ODATA_PASSWORD  basic-auth password
 *   ACUMATICA_ODATA_MODIFIED_FIELD  (optional) field for incremental sync,
 *                             e.g. LastModifiedDateTime
 *
 * Field names from your inquiry are matched to schema fields by the shared
 * alias map; if your inquiry uses different names, we extend HEADER_ALIASES
 * once (one place) — no other code changes.
 */
export class AcumaticaODataAdapter implements DataSourceAdapter {
  readonly name = 'acumatica-odata';

  private config() {
    const url = process.env.ACUMATICA_ODATA_URL;
    const username = process.env.ACUMATICA_ODATA_USERNAME;
    const password = process.env.ACUMATICA_ODATA_PASSWORD;
    if (!url || !username || !password) {
      throw new Error(
        'Acumatica OData is not configured. Set ACUMATICA_ODATA_URL, ACUMATICA_ODATA_USERNAME, and ACUMATICA_ODATA_PASSWORD.',
      );
    }
    return { url, username, password, modifiedField: process.env.ACUMATICA_ODATA_MODIFIED_FIELD };
  }

  /** @param since optional ISO date — pull only records modified on/after it (incremental). */
  async load(since?: string): Promise<ImportDataset> {
    const { url, username, password, modifiedField } = this.config();
    const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    // Build the first page URL (add an incremental $filter when configured).
    let next: string | null = url;
    if (since && modifiedField) {
      const u = new URL(url);
      u.searchParams.set('$filter', `${modifiedField} ge ${since}T00:00:00Z`);
      next = u.toString();
    }

    const records: Record<string, unknown>[] = [];
    let guard = 0;
    while (next && guard++ < 1000) {
      const res: Response = await fetch(next, {
        headers: { Authorization: auth, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Acumatica OData ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
      }
      // Acumatica's /OData/<tenant>/ feed is OData v3. Depending on the
      // negotiated format the rows live under `value` (light) or `d.results`
      // (verbose), and paging is `@odata.nextLink` or `d.__next`.
      const json: {
        value?: Record<string, unknown>[];
        ['@odata.nextLink']?: string;
        d?: { results?: Record<string, unknown>[]; __next?: string };
      } = await res.json();

      const page = Array.isArray(json.value)
        ? json.value
        : Array.isArray(json.d?.results)
          ? json.d!.results!
          : Array.isArray(json)
            ? (json as unknown as Record<string, unknown>[])
            : [];
      records.push(...page);
      next = json['@odata.nextLink'] ?? json.d?.__next ?? null;
    }

    return datasetFromRecords(records);
  }
}
