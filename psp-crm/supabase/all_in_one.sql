-- ════════════════════════════════════════════════════════════════════
-- Pacific Shoring Coverage CRM — COMPLETE database setup (paste & Run)
-- Generated from supabase/migrations/*. Safe to run once on a new project.
-- ════════════════════════════════════════════════════════════════════

-- ╔═══ supabase/migrations/0001_schema.sql ═══╗

-- ════════════════════════════════════════════════════════════════════════════
-- Pacific Shoring Coverage CRM — 0001 Full schema
-- Single-tenant. Builds EVERY table from the brief (§3) now — including the ones
-- v0 only reads from or leaves empty — so the pivot to the full build is purely
-- additive (no schema migration churn).
-- ════════════════════════════════════════════════════════════════════════════

-- gen_random_uuid() is in core Postgres (>= 13); no pgcrypto extension needed.

-- ── Enums ───────────────────────────────────────────────────────────────────
create type user_role       as enum ('admin', 'manager', 'rep');
create type txn_status       as enum ('Closed', 'Open', 'Canceled');
create type product_line     as enum ('Aluminum', 'Steel', 'Other');
create type opp_type         as enum ('new_branch_activation', 'displacement', 'new_logo', 'expansion');
create type opp_stage        as enum ('Qualified', 'Quoted', 'Verbal', 'Won', 'Lost');
create type lead_time_risk   as enum ('Low', 'Med', 'High');
create type activity_type    as enum ('call', 'visit', 'email', 'note');
create type task_status       as enum ('open', 'done');

-- ── profiles ────────────────────────────────────────────────────────────────
-- id == auth.users.id. Created on invite acceptance (see handle_new_user trigger).
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text not null,
  role        user_role not null default 'rep',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── accounts (parent) ───────────────────────────────────────────────────────
create table accounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  primary_state text,
  owner_id      uuid references profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index accounts_name_key on accounts (lower(name));
create index accounts_owner_idx on accounts (owner_id);

-- ── branches (ship-to) ──────────────────────────────────────────────────────
create table branches (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts (id) on delete cascade,
  name        text not null,
  state       text,
  city        text,
  owner_id    uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index branches_account_idx on branches (account_id);
create index branches_owner_idx on branches (owner_id);
create unique index branches_account_name_key on branches (account_id, lower(name));

-- ── sales_transactions (canonical: workbook Data tab) ───────────────────────
create table sales_transactions (
  id                    uuid primary key default gen_random_uuid(),
  date                  date not null,
  net_sale              numeric(14, 2) not null default 0,
  quantity              numeric(14, 2),
  cost                  numeric(14, 2),
  margin                numeric(14, 2) not null default 0,
  status                txn_status not null default 'Closed',
  so_type               text,
  account_id            uuid references accounts (id) on delete set null,
  branch_id             uuid references branches (id) on delete set null,
  inventory_id          text,
  inventory_description text,
  item_class            text,
  product_line          product_line not null default 'Other',
  sales_person          text,
  state                 text,
  city                  text,
  invoice_nbr           text,
  so_nbr                text,
  line_nbr              text,            -- 3rd part of the dedupe key
  created_at            timestamptz not null default now()
);
-- Idempotent import dedupe key (invoice_nbr + so_nbr + line). Treat NULLs as ''.
create unique index sales_txn_dedupe_key
  on sales_transactions (coalesce(invoice_nbr, ''), coalesce(so_nbr, ''), coalesce(line_nbr, ''));
create index sales_txn_branch_date_idx  on sales_transactions (branch_id, date);
create index sales_txn_account_date_idx on sales_transactions (account_id, date);
create index sales_txn_status_idx       on sales_transactions (status);
create index sales_txn_product_line_idx on sales_transactions (product_line);

-- ── opportunities (EMPTY in v0; full schema + FKs + RLS in place) ───────────
create table opportunities (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid references accounts (id) on delete cascade,
  branch_id       uuid references branches (id) on delete set null,
  owner_id        uuid references profiles (id) on delete set null,
  type            opp_type,
  product_line    product_line,
  stage           opp_stage not null default 'Qualified',
  win_prob        numeric(5, 4),
  amount          numeric(14, 2),
  gm_pct          numeric(6, 4),
  weighted_amount numeric(14, 2),
  lead_time_risk  lead_time_risk,
  expected_close  date,
  status          text,
  last_contact    date,
  next_step       text,
  next_date       date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index opportunities_account_idx on opportunities (account_id);
create index opportunities_owner_idx on opportunities (owner_id);
create index opportunities_stage_idx on opportunities (stage);

-- ── activities (EMPTY in v0) ────────────────────────────────────────────────
create table activities (
  id              uuid primary key default gen_random_uuid(),
  type            activity_type not null,
  account_id      uuid references accounts (id) on delete cascade,
  branch_id       uuid references branches (id) on delete set null,
  opportunity_id  uuid references opportunities (id) on delete set null,
  user_id         uuid references profiles (id) on delete set null,
  occurred_at     timestamptz not null default now(),
  body            text,
  created_at      timestamptz not null default now()
);
create index activities_account_idx on activities (account_id);
create index activities_user_idx on activities (user_id);

-- ── tasks (EMPTY in v0) ─────────────────────────────────────────────────────
create table tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  due_date        date,
  assignee_id     uuid references profiles (id) on delete set null,
  account_id      uuid references accounts (id) on delete cascade,
  branch_id       uuid references branches (id) on delete set null,
  opportunity_id  uuid references opportunities (id) on delete set null,
  status          task_status not null default 'open',
  created_by      uuid references profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tasks_assignee_idx on tasks (assignee_id);

-- ── targets (singleton; edited via Supabase dashboard in v0) ────────────────
create table targets (
  id                       boolean primary key default true,             -- singleton guard
  grr_target               numeric(6, 4)  not null default 0.88,
  nrr_target               numeric(6, 4)  not null default 1.18,
  new_biz_target           numeric(14, 2) not null default 10000000,
  xsell_target             integer        not null default 30,
  pipeline_coverage_target numeric(6, 2)  not null default 1.5,
  contraction_ceiling      numeric(14, 2) not null default 5000000,
  retention_floor          numeric(6, 4)  not null default 0.85,
  cadence_days             integer        not null default 75,
  updated_at               timestamptz not null default now(),
  constraint targets_singleton check (id = true)
);

-- ── app_settings (singleton) ────────────────────────────────────────────────
create table app_settings (
  id          boolean primary key default true,
  as_of_date  date not null,                       -- default = latest complete month-end (set at seed)
  updated_at  timestamptz not null default now(),
  constraint app_settings_singleton check (id = true)
);

-- ── stage_win_prob (seed; unused UI in v0) ──────────────────────────────────
create table stage_win_prob (
  stage     opp_stage primary key,
  win_prob  numeric(5, 4) not null
);

-- ── audit_log (table only in v0) ────────────────────────────────────────────
create table audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references profiles (id) on delete set null,
  action      text not null,
  entity      text,
  entity_id   text,
  diff        jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_created_idx on audit_log (created_at);

-- ── updated_at trigger ──────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated      before update on profiles      for each row execute function set_updated_at();
create trigger accounts_set_updated      before update on accounts      for each row execute function set_updated_at();
create trigger branches_set_updated      before update on branches      for each row execute function set_updated_at();
create trigger opportunities_set_updated before update on opportunities for each row execute function set_updated_at();
create trigger tasks_set_updated         before update on tasks         for each row execute function set_updated_at();

-- ── New-user → profile bootstrap (invite-only flow) ─────────────────────────
-- On auth.users insert, mirror into profiles. Role/full_name come from the
-- invite metadata set by an admin (raw_user_meta_data). Defaults to 'rep'.
create or replace function handle_new_user() returns trigger as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'rep')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ╔═══ supabase/migrations/0002_rls.sql ═══╗

-- ════════════════════════════════════════════════════════════════════════════
-- 0002 Row-Level Security (§5)
-- admin  : everything
-- manager: read ALL data, no user admin
-- rep    : read/write only OWNED records (owner_id / user_id / assignee_id)
-- Keyed on auth.uid() + profiles.role + ownership.
-- ════════════════════════════════════════════════════════════════════════════

-- Helper: current user's role. SECURITY DEFINER so reading `profiles` here does
-- NOT recurse into profiles' own RLS policies.
create or replace function app_role() returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function is_admin() returns boolean as $$
  select app_role() = 'admin';
$$ language sql stable;

-- managers + admins see all data
create or replace function is_staff() returns boolean as $$
  select app_role() in ('admin', 'manager');
$$ language sql stable;

-- Branches owned (directly or via owned parent account) by current rep
create or replace function rep_owns_branch(b_id uuid, a_id uuid) returns boolean as $$
  select exists (select 1 from public.branches b
                 where b.id = b_id and b.owner_id = auth.uid())
      or exists (select 1 from public.accounts a
                 where a.id = a_id and a.owner_id = auth.uid());
$$ language sql stable security definer set search_path = public;

-- Enable RLS everywhere
alter table profiles           enable row level security;
alter table accounts           enable row level security;
alter table branches           enable row level security;
alter table sales_transactions enable row level security;
alter table opportunities      enable row level security;
alter table activities         enable row level security;
alter table tasks              enable row level security;
alter table targets            enable row level security;
alter table app_settings       enable row level security;
alter table stage_win_prob     enable row level security;
alter table audit_log          enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
-- Names are needed to render owners; any authenticated user may read profiles.
create policy profiles_select on profiles
  for select to authenticated using (true);
create policy profiles_update_self on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on profiles
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── accounts ────────────────────────────────────────────────────────────────
create policy accounts_select on accounts
  for select to authenticated using (is_staff() or owner_id = auth.uid());
create policy accounts_rep_write on accounts
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy accounts_staff_write on accounts
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── branches ────────────────────────────────────────────────────────────────
create policy branches_select on branches
  for select to authenticated using (is_staff() or owner_id = auth.uid());
create policy branches_rep_write on branches
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy branches_staff_write on branches
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── sales_transactions ──────────────────────────────────────────────────────
create policy sales_txn_select on sales_transactions
  for select to authenticated
  using (is_staff() or rep_owns_branch(branch_id, account_id));
create policy sales_txn_staff_write on sales_transactions
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── opportunities ───────────────────────────────────────────────────────────
create policy opportunities_select on opportunities
  for select to authenticated using (is_staff() or owner_id = auth.uid());
create policy opportunities_rep_write on opportunities
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy opportunities_staff_write on opportunities
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── activities ──────────────────────────────────────────────────────────────
create policy activities_select on activities
  for select to authenticated using (is_staff() or user_id = auth.uid());
create policy activities_rep_write on activities
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy activities_staff_write on activities
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── tasks ───────────────────────────────────────────────────────────────────
create policy tasks_select on tasks
  for select to authenticated
  using (is_staff() or assignee_id = auth.uid() or created_by = auth.uid());
create policy tasks_rep_write on tasks
  for all to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid())
  with check (assignee_id = auth.uid() or created_by = auth.uid());
create policy tasks_staff_write on tasks
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── singletons / reference (read for all authenticated; write admin only) ────
create policy targets_select on targets for select to authenticated using (true);
create policy targets_admin on targets for all to authenticated using (is_admin()) with check (is_admin());

create policy app_settings_select on app_settings for select to authenticated using (true);
create policy app_settings_admin on app_settings for all to authenticated using (is_admin()) with check (is_admin());

create policy stage_win_prob_select on stage_win_prob for select to authenticated using (true);
create policy stage_win_prob_admin on stage_win_prob for all to authenticated using (is_admin()) with check (is_admin());

-- ── audit_log (admins read; inserts via service role / definer fns) ─────────
create policy audit_log_admin_select on audit_log for select to authenticated using (is_admin());

-- ╔═══ supabase/migrations/0003_metrics.sql ═══╗

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
-- ttm_revenue here is the IN-LINE revenue for the gap (the cross-sell base):
-- for aluminum-only branches it's their aluminum TTM, for steel-only it's steel TTM.
create view whitespace_summary with (security_invoker = on) as
select
  white_space,
  count(*) as branch_count,
  coalesce(
    sum(
      case
        when white_space = 'Steel gap' then aluminum_ttm
        when white_space = 'Alu gap' then steel_ttm
        when white_space = '—' then aluminum_ttm + steel_ttm
        else 0
      end
    ),
    0
  ) as ttm_revenue
from branch_metrics
group by white_space;

-- ╔═══ supabase/migrations/0004_seed_static.sql ═══╗

-- ════════════════════════════════════════════════════════════════════════════
-- 0004 Static seed — singletons & reference data (§3)
-- Idempotent. The importer (seed.ts) overwrites app_settings.as_of_date with the
-- latest complete month-end found in the workbook.
-- ════════════════════════════════════════════════════════════════════════════

insert into targets (id) values (true)
on conflict (id) do nothing;   -- defaults encode the brief's thresholds

-- Placeholder as_of; seed.ts replaces this with the workbook's latest month-end.
insert into app_settings (id, as_of_date) values (true, date_trunc('month', now())::date - 1)
on conflict (id) do nothing;

insert into stage_win_prob (stage, win_prob) values
  ('Qualified', 0.10),
  ('Quoted',    0.30),
  ('Verbal',    0.60),
  ('Won',       1.00),
  ('Lost',      0.00)
on conflict (stage) do update set win_prob = excluded.win_prob;

-- ╔═══ supabase/migrations/0005_grants.sql ═══╗

-- ════════════════════════════════════════════════════════════════════════════
-- 0005 Grants — privileges for the Supabase auth roles.
-- RLS (0002) decides WHICH ROWS; these GRANTs decide table/column access at all.
-- Runs after views (0003) so the view grants are included.
-- ════════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;

-- Tables + views (GRANT ... ON ALL TABLES includes views). RLS still applies.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Keep future objects covered.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ╔═══ supabase/migrations/0006_audit.sql ═══╗

-- ════════════════════════════════════════════════════════════════════════════
-- 0006 Audit logging
-- A SECURITY DEFINER helper so any authenticated user can append an audit entry
-- (the audit_log table itself stays admin-read-only via RLS). Server actions
-- call this after every create/update/delete.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function log_audit(
  p_action text,
  p_entity text,
  p_entity_id text,
  p_diff jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (actor_id, action, entity, entity_id, diff)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_diff);
end;
$$;

grant execute on function log_audit(text, text, text, jsonb) to authenticated;
