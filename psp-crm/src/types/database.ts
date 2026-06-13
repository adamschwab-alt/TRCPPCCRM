/**
 * Hand-authored database types mirroring supabase/migrations/*. In a wired
 * project these come from `supabase gen types typescript`; kept in sync by hand
 * for v0. Covers the tables/views the app reads.
 */
export type UserRole = 'admin' | 'manager' | 'rep';
export type TxnStatus = 'Closed' | 'Open' | 'Canceled';
export type ProductLine = 'Aluminum' | 'Steel' | 'Other';
export type BranchStatus = 'Active' | 'New' | 'Declining' | 'Lapsed';
export type CoverageRag = 'On-track' | 'Watch' | 'At-risk';
export type WhiteSpace = 'Steel gap' | 'Alu gap' | 'Both' | '—';

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AccountRow = {
  id: string;
  name: string;
  primary_state: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export type BranchRow = {
  id: string;
  account_id: string;
  name: string;
  state: string | null;
  city: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export type SalesTransactionRow = {
  id: string;
  date: string;
  net_sale: number;
  quantity: number | null;
  cost: number | null;
  margin: number;
  status: TxnStatus;
  so_type: string | null;
  account_id: string | null;
  branch_id: string | null;
  inventory_id: string | null;
  inventory_description: string | null;
  item_class: string | null;
  product_line: ProductLine;
  sales_person: string | null;
  state: string | null;
  city: string | null;
  invoice_nbr: string | null;
  so_nbr: string | null;
  line_nbr: string | null;
  created_at: string;
}

export type TargetsRow = {
  id: boolean;
  grr_target: number;
  nrr_target: number;
  new_biz_target: number;
  xsell_target: number;
  pipeline_coverage_target: number;
  contraction_ceiling: number;
  retention_floor: number;
  cadence_days: number;
  updated_at: string;
}

export type AppSettingsRow = {
  id: boolean;
  as_of_date: string;
  updated_at: string;
}

export type BranchMetricsRow = {
  branch_id: string;
  account_id: string;
  branch_name: string;
  state: string | null;
  city: string | null;
  owner_id: string | null;
  ttm_revenue: number;
  prior_revenue: number;
  ttm_margin: number;
  aluminum_ttm: number;
  steel_ttm: number;
  last_order_date: string | null;
  delta: number;
  delta_pct: number | null;
  gm_pct: number | null;
  days_idle: number | null;
  status: BranchStatus;
  coverage_rag: CoverageRag;
  white_space: WhiteSpace;
}

export type AccountMetricsRow = {
  account_id: string;
  account_name: string;
  primary_state: string | null;
  owner_id: string | null;
  branch_count: number;
  ttm_revenue: number;
  prior_revenue: number;
  ttm_margin: number;
  aluminum_ttm: number;
  steel_ttm: number;
  last_order_date: string | null;
  delta: number;
  delta_pct: number | null;
  gm_pct: number | null;
  days_idle: number | null;
  status: BranchStatus;
  coverage_rag: CoverageRag;
}

export type PortfolioKpisRow = {
  current_book: number;
  prior_book: number;
  ttm_margin: number;
  lapsed_prior: number;
  contraction: number;
  expansion: number;
  new_business: number;
  lapsed_accounts: number;
  new_accounts: number;
  yoy: number | null;
  grr: number | null;
  nrr: number | null;
  gm_pct: number | null;
}

export type WhitespaceSummaryRow = {
  white_space: WhiteSpace;
  branch_count: number;
  ttm_revenue: number;
}

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type ViewDef<Row> = {
  Row: Row;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow>;
      accounts: TableDef<AccountRow>;
      branches: TableDef<BranchRow>;
      sales_transactions: TableDef<SalesTransactionRow>;
      targets: TableDef<TargetsRow>;
      app_settings: TableDef<AppSettingsRow>;
    };
    Views: {
      branch_metrics: ViewDef<BranchMetricsRow>;
      account_metrics: ViewDef<AccountMetricsRow>;
      portfolio_kpis: ViewDef<PortfolioKpisRow>;
      whitespace_summary: ViewDef<WhitespaceSummaryRow>;
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      txn_status: TxnStatus;
      product_line: ProductLine;
    };
    CompositeTypes: Record<string, never>;
  };
}
