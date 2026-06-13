import { z } from 'zod';

/**
 * Source-agnostic shape the importer upserts into Postgres. Every DataSourceAdapter
 * (file import today, Acumatica OData in phase 2) resolves to this.
 */
export const productLineSchema = z.enum(['Aluminum', 'Steel', 'Other']);
export const txnStatusSchema = z.enum(['Closed', 'Open', 'Canceled']);

export const normalizedTransactionSchema = z.object({
  date: z.string(), // ISO yyyy-mm-dd
  net_sale: z.number(),
  quantity: z.number().nullable(),
  cost: z.number().nullable(),
  margin: z.number(),
  status: txnStatusSchema,
  so_type: z.string().nullable(),
  account_name: z.string().min(1),
  branch_name: z.string().min(1),
  inventory_id: z.string().nullable(),
  inventory_description: z.string().nullable(),
  item_class: z.string().nullable(),
  product_line: productLineSchema,
  sales_person: z.string().nullable(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  invoice_nbr: z.string().nullable(),
  so_nbr: z.string().nullable(),
  line_nbr: z.string().nullable(),
});

export type NormalizedTransaction = z.infer<typeof normalizedTransactionSchema>;

export interface NormalizedAccount {
  name: string;
  primary_state: string | null;
}

export interface NormalizedBranch {
  account_name: string;
  name: string;
  state: string | null;
  city: string | null;
}

export interface ImportDataset {
  accounts: NormalizedAccount[];
  branches: NormalizedBranch[];
  transactions: NormalizedTransaction[];
  /** Headers in the source the adapter did not recognise — surfaced for mapping fixes. */
  unmappedHeaders: string[];
}

/**
 * The seam that makes phase-2 Acumatica sync additive: swap the implementation,
 * keep the importer. v0 ships FileImportAdapter; AcumaticaODataAdapter is a stub.
 */
export interface DataSourceAdapter {
  readonly name: string;
  load(): Promise<ImportDataset>;
}
