-- ════════════════════════════════════════════════════════════════════════════
-- 0003 Coverage metric layer (§4)
--
-- Implemented as `security_invoker` VIEWS so they respect the querying user's
-- RLS on the underlying tables. Net effect: a rep querying these views sees
-- metrics for ONLY their owned book — role-scoping comes free, no per-role code.
--
-- as_of            = app_settings.as_of_date
-- TTM window       = [as_of - 12mo + 1d, as_of]
-- Prior-TTM window = the 12 months before that = [as_of - 24mo + 1d, as_of - 12mo]
-- "Booked"         = status <> 'Canceled'
--
-- NOTE: retention is computed at ACCOUNT grain (sum a parent's branches, THEN
-- evaluate status on the totals). It is NOT aggregated from branch-level deltas,
-- which would double-count gross movement.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Shared window + thresholds (single row) ─────────────────────────────────
create view metric_window with (security_invoker = on) as
select
  s.as_of_date                                                  as as_of,
  (s.as_of_date - interval '12 months' + interval '1 day')::date as ttm_start,
  s.as_of_date                                                  as ttm_end,
  (s.as_of_date - interval '24 months' + interval '1 day')::date as prior_start,
  (s.as_of_date - interval '12 months')::date                   as prior_end,
  t.retention_floor,
  t.cadence_days
from app_settings s
cross join targets t;

-- ── Per-branch metrics ──────────────────────────────────────────────────────
create view branch_metrics with (security_invoker = on) as
with base as (
  select
    b.id          as branch_id,
    b.account_id,
    b.name        as branch_name,
    b.state,
    b.city,
    b.owner_id,
    coalesce(sum(st.net_sale) filter (where st.date between w.ttm_start   and w.ttm_end),   0) as ttm_revenue,
    coalesce(sum(st.net_sale) filter (where st.date between w.prior_start and w.prior_end), 0) as prior_revenue,
    coalesce(sum(st.margin)   filter (where st.date between w.ttm_start   and w.ttm_end),   0) as ttm_margin,
    coalesce(sum(st.net_sale) filter (where st.product_line = 'Aluminum'
                                        and st.date between w.ttm_start and w.ttm_end), 0)     as aluminum_ttm,
    coalesce(sum(st.net_sale) filter (where st.product_line = 'Steel'
                                        and st.date between w.ttm_start and w.ttm_end), 0)     as steel_ttm,
    max(st.date)        as last_order_date,
    w.as_of,
    w.retention_floor,
    w.cadence_days
  from branches b
  cross join metric_window w
  left join sales_transactions st
    on st.branch_id = b.id
   and st.status <> 'Canceled'
  group by b.id, b.account_id, b.name, b.state, b.city, b.owner_id,
           w.as_of, w.retention_floor, w.cadence_days
),
calc as (
  select
    base.*,
    (ttm_revenue - prior_revenue) as delta,
    case when prior_revenue = 0 then null
         else (ttm_revenue - prior_revenue) / prior_revenue end as delta_pct,
    case when ttm_revenue = 0 then null
         else ttm_margin / ttm_revenue end as gm_pct,
    case when last_order_date is null then null
         else (as_of - last_order_date) end as days_idle
  from base
)
select
  calc.*,
  case
    when ttm_revenue = 0 and prior_revenue > 0 then 'Lapsed'
    when prior_revenue = 0 and ttm_revenue > 0 then 'New'
    when prior_revenue > 0 and ttm_revenue < retention_floor * prior_revenue then 'Declining'
    else 'Active'
  end as status,
  case
    when (ttm_revenue = 0 and prior_revenue > 0)                                    -- Lapsed
      or (prior_revenue > 0 and ttm_revenue < retention_floor * prior_revenue)      -- Declining
      or (days_idle is not null and days_idle > cadence_days)
      then 'At-risk'
    when delta < 0 or (prior_revenue = 0 and ttm_revenue > 0)                       -- declining-ish or New
      then 'Watch'
    else 'On-track'
  end as coverage_rag,
  case
    when aluminum_ttm > 0 and steel_ttm = 0 then 'Steel gap'   -- aluminum-only
    when steel_ttm > 0 and aluminum_ttm = 0 then 'Alu gap'     -- steel-only
    when aluminum_ttm = 0 and steel_ttm = 0 then 'Both'
    else '—'
  end as white_space
from calc;

-- ── Per-account (parent) rollups — retention computed on account TOTALS ──────
create view account_metrics with (security_invoker = on) as
with agg as (
  select
    a.id            as account_id,
    a.name          as account_name,
    a.primary_state,
    a.owner_id,
    count(bm.branch_id)                       as branch_count,
    coalesce(sum(bm.ttm_revenue), 0)          as ttm_revenue,
    coalesce(sum(bm.prior_revenue), 0)        as prior_revenue,
    coalesce(sum(bm.ttm_margin), 0)           as ttm_margin,
    coalesce(sum(bm.aluminum_ttm), 0)         as aluminum_ttm,
    coalesce(sum(bm.steel_ttm), 0)            as steel_ttm,
    max(bm.last_order_date)                   as last_order_date
  from accounts a
  left join branch_metrics bm on bm.account_id = a.id
  group by a.id, a.name, a.primary_state, a.owner_id
),
calc as (
  select
    agg.*,
    w.as_of,
    w.retention_floor,
    w.cadence_days,
    (ttm_revenue - prior_revenue) as delta,
    case when prior_revenue = 0 then null
         else (ttm_revenue - prior_revenue) / prior_revenue end as delta_pct,
    case when ttm_revenue = 0 then null
         else ttm_margin / ttm_revenue end as gm_pct,
    case when last_order_date is null then null
         else (w.as_of - last_order_date) end as days_idle
  from agg
  cross join metric_window w
)
select
  calc.*,
  case
    when ttm_revenue = 0 and prior_revenue > 0 then 'Lapsed'
    when prior_revenue = 0 and ttm_revenue > 0 then 'New'
    when prior_revenue > 0 and ttm_revenue < retention_floor * prior_revenue then 'Declining'
    else 'Active'
  end as status,
  case
    when (ttm_revenue = 0 and prior_revenue > 0)
      or (prior_revenue > 0 and ttm_revenue < retention_floor * prior_revenue)
      or (days_idle is not null and days_idle > cadence_days)
      then 'At-risk'
    when delta < 0 or (prior_revenue = 0 and ttm_revenue > 0)
      then 'Watch'
    else 'On-track'
  end as coverage_rag
from calc;

-- ── Portfolio KPIs (account grain) — single row, role-scoped ────────────────
create view portfolio_kpis with (security_invoker = on) as
with k as (
  select
    coalesce(sum(ttm_revenue), 0)                                              as current_book,
    coalesce(sum(prior_revenue), 0)                                            as prior_book,
    coalesce(sum(ttm_margin), 0)                                               as ttm_margin,
    coalesce(sum(prior_revenue) filter (where status = 'Lapsed'), 0)           as lapsed_prior,
    -coalesce(sum(delta) filter (where delta < 0 and status <> 'Lapsed'), 0)   as contraction,
    coalesce(sum(delta) filter (where delta > 0 and status <> 'New'), 0)       as expansion,
    coalesce(sum(ttm_revenue) filter (where status = 'New'), 0)                as new_business,
    count(*) filter (where status = 'Lapsed')                                  as lapsed_accounts,
    count(*) filter (where status = 'New')                                     as new_accounts
  from account_metrics
)
select
  k.*,
  case when prior_book = 0 then null else current_book / prior_book - 1 end                              as yoy,
  case when prior_book = 0 then null else (prior_book - lapsed_prior - contraction) / prior_book end      as grr,
  case when prior_book = 0 then null
       else (prior_book - lapsed_prior - contraction + expansion) / prior_book end                       as nrr,
  case when current_book = 0 then null else ttm_margin / current_book end                                 as gm_pct
from k;

-- ── Cross-sell white-space summary (branch grain), role-scoped ──────────────
create view whitespace_summary with (security_invoker = on) as
select
  white_space,
  count(*)                  as branch_count,
  coalesce(sum(ttm_revenue), 0) as ttm_revenue
from branch_metrics
group by white_space;
