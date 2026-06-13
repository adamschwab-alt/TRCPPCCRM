import 'server-only';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import {
  type DataSourceAdapter,
  type ImportDataset,
  type NormalizedTransaction,
  normalizedTransactionSchema,
} from './types';

/**
 * FileImportAdapter — parses the PSP workbook's `Data` tab into the normalized
 * dataset. Header matching is alias-based + normalized (lowercase, alnum-only)
 * so small naming differences don't break the import. Unrecognised headers are
 * reported so the mapping can be tuned once the real workbook lands.
 *
 * Column → schema mapping is documented in README §Importer.
 */

// target field → accepted header aliases (already normalized: lowercase, alnum)
const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'invoicedate', 'trandate', 'transactiondate', 'orderdate', 'docdate'],
  net_sale: [
    'netsale',
    'netsales',
    'amount',
    'extprice',
    'extendedprice',
    'sales',
    'revenue',
    'linetotal',
    'saleamount',
    'extsales',
    'netamount',
  ],
  quantity: ['quantity', 'qty', 'qtyshipped', 'qtyordered'],
  cost: ['cost', 'extcost', 'extendedcost', 'totalcost', 'cogs'],
  margin: ['margin', 'grossmargin', 'gm', 'grossprofit', 'profit', 'gp'],
  status: ['status', 'orderstatus', 'sostatus', 'docstatus', 'invoicestatus'],
  so_type: ['sotype', 'ordertype', 'documenttype', 'doctype', 'type'],
  account_name: [
    'parentcustomername',
    'parentcustomer',
    'parentaccount',
    'parent',
    'nationalaccount',
    'accountname',
    'company',
    'account',
  ],
  branch_name: [
    'customer2',
    'shipto',
    'shiptoname',
    'branch',
    'branchname',
    'location',
    'site',
    'store',
    'customername',
    'customer',
  ],
  inventory_id: ['inventoryid', 'itemid', 'item', 'sku', 'partnumber', 'partno', 'inventory'],
  inventory_description: [
    'inventorydescription',
    'description',
    'itemdescription',
    'itemdesc',
    'desc',
  ],
  item_class: ['itemclass2', 'itemclass', 'class', 'category', 'productclass'],
  product_line: ['cat', 'productline', 'prodline', 'product', 'plgroup', 'familygroup'],
  sales_person: ['salespers', 'salesperson', 'salesrep', 'salesman', 'accountmanager', 'rep'],
  state: ['state', 'shiptostate', 'st', 'province'],
  city: ['city', 'shiptocity'],
  invoice_nbr: ['invoicenbr', 'invoice', 'invoiceno', 'invoicenumber', 'invno'],
  so_nbr: ['sonbr', 'so', 'sonumber', 'sono', 'salesorder', 'salesordernbr', 'ordernbr', 'orderno'],
  line_nbr: ['linenbr', 'line', 'lineno', 'linenumber', 'lineid'],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(
    String(v)
      .replace(/[$,()\s]/g, (m) => (m === '(' || m === ')' ? '' : ''))
      .replace(/,/g, ''),
  );
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function toISODate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    // Excel serial date → JS date
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function classifyProductLine(raw: string | null, itemClass: string | null, desc: string | null) {
  // An explicit product-line column (e.g. the workbook's `Cat`) is authoritative.
  const r = raw?.trim().toLowerCase();
  if (r === 'aluminum' || r === 'aluminium') return 'Aluminum' as const;
  if (r === 'steel') return 'Steel' as const;
  if (r === 'other') return 'Other' as const;
  if (raw && /^alum/i.test(raw.trim())) return 'Aluminum' as const;
  if (raw && /^steel/i.test(raw.trim())) return 'Steel' as const;
  // No usable explicit value → infer from item class / description.
  const hay = `${itemClass ?? ''} ${desc ?? ''}`.toLowerCase();
  if (/\balum|\baluminium|\baluminum/.test(hay)) return 'Aluminum' as const;
  if (/\bsteel/.test(hay)) return 'Steel' as const;
  return 'Other' as const;
}

function mapStatus(raw: string | null): 'Closed' | 'Open' | 'Canceled' {
  const s = (raw ?? '').toLowerCase();
  if (/cancel|void/.test(s)) return 'Canceled';
  if (/open|hold|backorder|pending/.test(s)) return 'Open';
  return 'Closed';
}

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
    if (rows.length === 0)
      return { accounts: [], branches: [], transactions: [], unmappedHeaders: [] };

    // Resolve which source header feeds each target field (exact normalized match).
    const headers = Object.keys(rows[0]);
    const normToHeader = new Map(headers.map((h) => [norm(h), h]));
    const fieldHeader: Record<string, string | undefined> = {};
    const usedHeaders = new Set<string>();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      for (const a of aliases) {
        const h = normToHeader.get(a);
        if (h && !usedHeaders.has(h)) {
          fieldHeader[field] = h;
          usedHeaders.add(h);
          break;
        }
      }
    }
    const unmappedHeaders = headers.filter((h) => !usedHeaders.has(h));
    const pick = (row: Record<string, unknown>, field: string) =>
      fieldHeader[field] ? row[fieldHeader[field]!] : null;

    const transactions: NormalizedTransaction[] = [];
    const errors: string[] = [];

    rows.forEach((row, i) => {
      const accountName = str(pick(row, 'account_name'));
      const branchName = str(pick(row, 'branch_name')) ?? accountName; // fall back to account if no branch
      const account = accountName ?? branchName;
      if (!account) return; // skip blank rows

      const itemClass = str(pick(row, 'item_class'));
      const desc = str(pick(row, 'inventory_description'));
      const candidate = {
        date: toISODate(pick(row, 'date')) ?? '',
        net_sale: num(pick(row, 'net_sale')) ?? 0,
        quantity: num(pick(row, 'quantity')),
        cost: num(pick(row, 'cost')),
        margin: num(pick(row, 'margin')) ?? 0,
        status: mapStatus(str(pick(row, 'status'))),
        so_type: str(pick(row, 'so_type')),
        account_name: account,
        branch_name: branchName ?? account,
        inventory_id: str(pick(row, 'inventory_id')),
        inventory_description: desc,
        item_class: itemClass,
        product_line: classifyProductLine(str(pick(row, 'product_line')), itemClass, desc),
        sales_person: str(pick(row, 'sales_person')),
        state: str(pick(row, 'state')),
        city: str(pick(row, 'city')),
        invoice_nbr: str(pick(row, 'invoice_nbr')),
        so_nbr: str(pick(row, 'so_nbr')),
        line_nbr: str(pick(row, 'line_nbr')) ?? String(i + 2), // synthesize a stable line key
      };

      const parsed = normalizedTransactionSchema.safeParse(candidate);
      if (parsed.success) transactions.push(parsed.data);
      else errors.push(`row ${i + 2}: ${parsed.error.issues.map((e) => e.message).join('; ')}`);
    });

    if (errors.length) {
      // Surface a capped sample; the seed script prints the full summary.
      console.warn(
        `[file-import] ${errors.length} rows failed validation. Sample:\n` +
          errors.slice(0, 5).join('\n'),
      );
    }

    // Derive accounts/branches from the transactions (enriched by explicit sheets below).
    const accountMap = new Map<string, { name: string; primary_state: string | null }>();
    const branchMap = new Map<
      string,
      { account_name: string; name: string; state: string | null; city: string | null }
    >();
    for (const t of transactions) {
      if (!accountMap.has(t.account_name)) {
        accountMap.set(t.account_name, { name: t.account_name, primary_state: t.state });
      }
      const bkey = `${t.account_name}␟${t.branch_name}`;
      if (!branchMap.has(bkey)) {
        branchMap.set(bkey, {
          account_name: t.account_name,
          name: t.branch_name,
          state: t.state,
          city: t.city,
        });
      }
    }

    return {
      accounts: [...accountMap.values()],
      branches: [...branchMap.values()],
      transactions,
      unmappedHeaders,
    };
  }
}
