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

  /** @param since optional ISO date — pull only records dated/modified on/after it (incremental). */
  async load(since?: string): Promise<ImportDataset> {
    const { url, username, password, modifiedField } = this.config();
    const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    // Build the first page URL. Normalizing through URL() percent-encodes spaces
    // in the inquiry name and requests JSON explicitly. Acumatica's
    // /OData/<tenant> feed is OData v3, so the incremental $filter uses the
    // datetime'...' literal. When no modified field is configured we filter on
    // the inquiry's Date column — this is what keeps routine refreshes small.
    const buildFirstUrl = (withFilter: boolean, fieldOverride?: string) => {
      const u = new URL(url);
      if (!u.searchParams.has('$format')) u.searchParams.set('$format', 'json');
      if (withFilter && since) {
        const field = fieldOverride ?? modifiedField ?? 'Date';
        u.searchParams.set('$filter', `${field} ge datetime'${since}T00:00:00'`);
      }
      return u.toString();
    };

    let filtered = !!since;
    let firstPage = true;
    let triedDateField = false;
    let next: string | null = buildFirstUrl(filtered);

    const records: Record<string, unknown>[] = [];
    let guard = 0;
    while (next && guard++ < 1000) {
      let res: Response;
      try {
        res = await fetch(next, {
          headers: { Authorization: auth, Accept: 'application/json' },
          cache: 'no-store',
          // Fail fast with a clear error instead of hanging the whole request
          // when the feed stalls. The first page gets extra room — a filtered
          // GI query can take Acumatica a while to compute server-side.
          signal: AbortSignal.timeout(firstPage ? 120_000 : 60_000),
        });
      } catch (e) {
        // NB: AbortSignal.timeout throws a DOMException, which is NOT
        // `instanceof Error` in Node — detect by name, and unwrap fetch's
        // wrapped `cause`, so the caller gets a real message instead of a
        // generic failure.
        const name = (e as { name?: string } | null)?.name;
        const causeName = (e as { cause?: { name?: string } } | null)?.cause?.name;
        if (
          name === 'TimeoutError' ||
          name === 'AbortError' ||
          causeName === 'TimeoutError' ||
          causeName === 'AbortError'
        ) {
          throw new Error(
            'Acumatica did not respond in time — the feed may be slow or down. Try again in a few minutes.',
          );
        }
        if (e instanceof Error) {
          const causeMsg = (e as { cause?: { message?: string } }).cause?.message;
          throw new Error(`Acumatica request failed: ${e.message}${causeMsg ? ` (${causeMsg})` : ''}`);
        }
        throw new Error(`Acumatica request failed: ${String(e)}`);
      }
      if (!res.ok) {
        // If the first filtered page fails for ANY reason, retry: first with
        // the default Date filter (a misconfigured modified-field env var
        // yields a 500 "Could not find a property named ..."), then with no
        // filter at all. A slow full pull beats a failed sync.
        if (filtered && firstPage) {
          if (modifiedField && !triedDateField) {
            triedDateField = true;
            next = buildFirstUrl(true, 'Date');
            continue;
          }
          filtered = false;
          next = buildFirstUrl(false);
          continue;
        }
        const body = await res.text().catch(() => '');
        throw new Error(`Acumatica OData ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
      }
      firstPage = false;
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
