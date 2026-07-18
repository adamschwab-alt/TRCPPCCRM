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
export type OppType = 'new_branch_activation' | 'displacement' | 'new_logo' | 'expansion';
export type OppStage = 'Qualified' | 'Quoted' | 'Verbal' | 'Won' | 'Lost';
export type LeadTimeRisk = 'Low' | 'Med' | 'High';
export type ActivityType = 'call' | 'visit' | 'email' | 'note';
export type TaskStatus = 'open' | 'done';
export type OppSource =
  | 'existing_account'
  | 'new_branch'
  | 'referral'
  | 'inbound'
  | 'event'
  | 'cold'
  | 'other';
export type LostReason =
  | 'price'
  | 'availability'
  | 'lead_time'
  | 'spec'
  | 'relationship'
  | 'no_decision'
  | 'competitor'
  | 'other';
export type ForecastCategory = 'pipeline' | 'best_case' | 'commit';
export type ActivityOutcome =
  | 'connected'
  | 'left_msg'
  | 'no_response'
  | 'meeting_booked'
  | 'meeting_held';
export type RecType = 'next_best_action' | 'account_summary' | 'deal_risk';
export type RecStatus = 'shown' | 'accepted' | 'dismissed';

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  hired_at: string | null;
  rollout_wave: number;
  ai_enabled_at: string | null;
  training_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountRow = {
  id: string;
  name: string;
  primary_state: string | null;
  owner_id: string | null;
  /** Customer-wiring relationship rating: 1 strategic · 2 important · 3 transactional. */
  relationship_rating: number;
  created_at: string;
  updated_at: string;
};

/** Contact tiers: 1 Executive · 2 Regional/District · 3 Ops/Fleet · 4 Purchasing/Finance · 5 Branch */
export type ContactRow = {
  id: string;
  account_id: string;
  branch_id: string | null;
  name: string;
  title: string | null;
  tier: number;
  phone: string | null;
  email: string | null;
  covered_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BranchRow = {
  id: string;
  account_id: string;
  name: string;
  state: string | null;
  city: string | null;
  owner_id: string | null;
  district_id: string | null;
  created_at: string;
  updated_at: string;
};

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
};

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
};

export type AppSettingsRow = {
  id: boolean;
  as_of_date: string;
  updated_at: string;
};

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
};

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
};

// ── District & Tier Coverage Types (from migrations 0014-0015) ────────────────

export type ContactTier =
  | 'Corporate'
  | 'Regional-VP'
  | 'Regional-Fleet'
  | 'District'
  | 'Fleet'
  | 'Branch-GM'
  | 'Europe'
  | 'Purchasing/Finance';

export type PspOwnerType = 'Senior PS Leadership' | 'Territory Rep' | 'District Manager' | 'District Sales Manager';
export type RoutingType = 'Territory Rep' | 'Defer to Branch' | 'Through District' | 'Senior PS Leadership' | '—';
export type TransitionStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled';

export type DistrictRow = {
  id: string;
  account_id: string;
  name: string;
  code: string | null;
  dm_profile_id: string | null;
  dsm_profile_id: string | null;
  region_text: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactTierRow = {
  id: string;
  contact_id: string;
  account_id: string;
  tier: ContactTier;
  cadence_touches_yr: number;
  routing: RoutingType;
  psp_owner_type: PspOwnerType;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PlannedChangeRow = {
  id: string;
  branch_id: string;
  current_owner_profile_id: string | null;
  new_owner_profile_id: string;
  scheduled_date: string;
  reason: string | null;
  status: TransitionStatus;
  notes: string | null;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
};

export type ScheduledTouchRow = {
  id: string;
  contact_tier_id: string;
  assigned_to_id: string | null;
  scheduled_date: string;
  touch_type: string;
  outcome_status: string | null;
  outcome_notes: string | null;
  activity_id: string | null;
  created_at: string;
  updated_at: string;
};

// ── View Rows ────────────────────────────────────────────────────────────────

export type RepWorkloadRow = {
  rep_id: string;
  rep_name: string | null;
  scenario: string;
  branch_count: number;
  branch_calls_yr: number;
  tier_touches_yr: number;
  total_load_yr: number;
  capacity_per_rep: number;
  utilization_pct: number;
};

export type AccountInvestmentRow = {
  account_id: string;
  account_name: string;
  branch_count: number;
  branch_calls_yr: number;
  tier_touches_yr: number;
  total_touches_yr: number;
};

export type DistrictCoverageRow = {
  district_id: string;
  district_name: string;
  district_code: string | null;
  account_id: string;
  account_name: string;
  branch_count: number;
  branch_calls_yr: number;
  dm_name: string | null;
  dsm_name: string | null;
  dm_tier_touches_yr: number;
  dsm_tier_touches_yr: number;
};

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
};

export type WhitespaceSummaryRow = {
  white_space: WhiteSpace;
  branch_count: number;
  ttm_revenue: number;
};

export type OpportunityRow = {
  id: string;
  account_id: string | null;
  branch_id: string | null;
  owner_id: string | null;
  type: OppType | null;
  product_line: ProductLine | null;
  stage: OppStage;
  win_prob: number | null;
  amount: number | null;
  gm_pct: number | null;
  weighted_amount: number | null;
  lead_time_risk: LeadTimeRisk | null;
  expected_close: string | null;
  status: string | null;
  last_contact: string | null;
  next_step: string | null;
  next_date: string | null;
  notes: string | null;
  source: OppSource | null;
  lost_reason: LostReason | null;
  lost_note: string | null;
  forecast_category: ForecastCategory | null;
  closed_at: string | null;
  primary_contact_id: string | null;
  competitor: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityStageHistoryRow = {
  id: number;
  opportunity_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
};

export type ExogenousEventRow = {
  id: string;
  event_date: string;
  title: string;
  note: string | null;
  kind: string; // 'market' | 'testimonial'
  created_by: string | null;
  created_at: string;
};

export type ForecastSnapshotRow = {
  id: number;
  period: string; // 'YYYY-MM'
  rep_id: string | null; // null = org
  pipeline_amount: number;
  best_case_amount: number;
  commit_amount: number;
  weighted_amount: number;
  open_count: number;
  created_at: string;
};

export type DqSnapshotRow = {
  id: number;
  period: string; // 'YYYY-MM'
  completeness: number | null;
  freshness: number | null;
  stalled: number;
  gate_violations: number;
  detail: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AiRecommendationRow = {
  id: string;
  type: RecType;
  user_id: string;
  account_id: string | null;
  branch_id: string | null;
  opportunity_id: string | null;
  contact_id: string | null;
  recommended_action: string | null;
  reason: string | null;
  score: number | null;
  model_version: string;
  prompt_version: string | null;
  status: RecStatus;
  shown_at: string;
  shown_count: number;
  acted_at: string | null;
  action_activity_id: string | null;
  override_note: string | null;
  outcome: Record<string, unknown> | null;
};

export type ActivityRow = {
  id: string;
  type: ActivityType;
  account_id: string | null;
  branch_id: string | null;
  opportunity_id: string | null;
  contact_id: string | null;
  user_id: string | null;
  occurred_at: string;
  body: string | null;
  outcome: ActivityOutcome | null;
  source: string; // 'manual' | 'outlook' | 'system'
  created_at: string;
};

export type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  assignee_id: string | null;
  account_id: string | null;
  branch_id: string | null;
  opportunity_id: string | null;
  status: TaskStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StageWinProbRow = { stage: OppStage; win_prob: number };

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  diff: unknown;
  created_at: string;
};

export type UsageEventRow = {
  id: number;
  user_id: string;
  path: string | null;
  occurred_at: string;
};

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
      contacts: TableDef<ContactRow>;
      sales_transactions: TableDef<SalesTransactionRow>;
      opportunities: TableDef<OpportunityRow>;
      activities: TableDef<ActivityRow>;
      tasks: TableDef<TaskRow>;
      stage_win_prob: TableDef<StageWinProbRow>;
      opportunity_stage_history: TableDef<OpportunityStageHistoryRow>;
      exogenous_events: TableDef<ExogenousEventRow>;
      ai_recommendations: TableDef<AiRecommendationRow>;
      dq_snapshots: TableDef<DqSnapshotRow>;
      forecast_snapshots: TableDef<ForecastSnapshotRow>;
      audit_log: TableDef<AuditLogRow>;
      usage_events: TableDef<UsageEventRow>;
      targets: TableDef<TargetsRow>;
      app_settings: TableDef<AppSettingsRow>;
    };
    Views: {
      branch_metrics: ViewDef<BranchMetricsRow>;
      account_metrics: ViewDef<AccountMetricsRow>;
      portfolio_kpis: ViewDef<PortfolioKpisRow>;
      whitespace_summary: ViewDef<WhitespaceSummaryRow>;
    };
    Functions: {
      log_audit: {
        Args: { p_action: string; p_entity: string; p_entity_id: string; p_diff?: unknown };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      txn_status: TxnStatus;
      product_line: ProductLine;
    };
    CompositeTypes: Record<string, never>;
  };
}
