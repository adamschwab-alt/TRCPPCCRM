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
