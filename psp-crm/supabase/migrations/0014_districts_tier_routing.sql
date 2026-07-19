-- ════════════════════════════════════════════════════════════════════════════
-- 0014 Districts, tier routing, and rep transition planning
-- ════════════════════════════════════════════════════════════════════════════
-- Adds explicit district entities (United Rentals 11-district model + direct accounts).
-- Extends contacts/tiers with routing logic (Senior PS Leadership vs Territory Rep vs District Manager).
-- Adds planned_changes for rep transitions and succession planning.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────────────
create type contact_tier as enum (
  'Corporate',           -- C-suite / strategic
  'Regional-VP',         -- Regional / division VP
  'Regional-Fleet',      -- Regional fleet director
  'District',            -- District manager (rental company district)
  'Fleet',               -- Fleet director (company-wide)
  'Branch-GM',           -- Branch general manager
  'Europe',              -- International executive
  'Purchasing/Finance'   -- Procurement / finance
);

create type psp_owner_type as enum ('Senior PS Leadership', 'Territory Rep', 'District Manager', 'District Sales Manager');
create type routing_type as enum ('Territory Rep', 'Defer to Branch', 'Through District', 'Senior PS Leadership', '—');
create type transition_status as enum ('pending', 'scheduled', 'completed', 'cancelled');

-- ── districts ────────────────────────────────────────────────────────────────
-- One per account per region (e.g., 11 for United Rentals, 1 "Direct" for single-location accounts).
create table districts (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references accounts (id) on delete cascade,
  name              text not null,      -- e.g., "United Rentals — Southeast", "Direct"
  code              text,               -- e.g., "401", "402" (United's numbering), or NULL for Direct
  dm_profile_id     uuid references profiles (id) on delete set null,      -- District Manager
  dsm_profile_id    uuid references profiles (id) on delete set null,     -- District Sales Manager
  region_text       text,               -- e.g., "Southeast", "Northwest", "Direct" (for UI)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index districts_account_idx on districts (account_id);
create unique index districts_account_name_key on districts (account_id, lower(name));
create trigger districts_set_updated before update on districts
  for each row execute function set_updated_at();

-- ── branches → district ──────────────────────────────────────────────────────
-- Links each branch to its district (nullable; Direct branches stay null until assigned).
alter table branches
  add column if not exists district_id uuid references districts (id) on delete set null;
create index if not exists branches_district_idx on branches (district_id);

-- ── contact_tiers ───────────────────────────────────────────────────────────
-- One row per contact × account × tier combination.
-- Replaces the flat contacts.tier + covered_by model with explicit routing.
create table contact_tiers (
  id                uuid primary key default gen_random_uuid(),
  contact_id        uuid not null references contacts (id) on delete cascade,
  account_id        uuid not null references accounts (id) on delete cascade,
  -- tier (from contact_tier enum) describes the contact's organizational level at this account.
  tier              contact_tier not null,
  -- cadence_touches_yr: how many times PSP should touch this tier per year (e.g., 4 for Corporate, 2 for Fleet).
  cadence_touches_yr smallint not null default 1,
  -- routing: who owns the touches to this tier (Senior PS Leadership for execs, Territory Rep for field DMs, etc.).
  routing           routing_type not null default 'Territory Rep',
  -- psp_owner_type: explicit classification of the PSP resource (for capacity planning).
  psp_owner_type    psp_owner_type not null default 'Territory Rep',
  -- notes: e.g., "Sole decision-maker for purchasing", "Physically writes PO".
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index contact_tiers_contact_idx on contact_tiers (contact_id);
create index contact_tiers_account_idx on contact_tiers (account_id);
create unique index contact_tiers_unique_key on contact_tiers (contact_id, account_id, tier);
create trigger contact_tiers_set_updated before update on contact_tiers
  for each row execute function set_updated_at();

-- ── planned_changes ─────────────────────────────────────────────────────────
-- Stages rep transitions per branch (for successor planning & workload balancing).
create table planned_changes (
  id                        uuid primary key default gen_random_uuid(),
  branch_id                 uuid not null references branches (id) on delete cascade,
  current_owner_profile_id  uuid references profiles (id) on delete set null,   -- snapshot at creation time
  new_owner_profile_id      uuid not null references profiles (id) on delete restrict,
  scheduled_date            date not null,       -- when the transition takes effect
  reason                    text,                -- e.g., "successor", "restructuring", "capacity rebalance"
  status                    transition_status not null default 'pending',
  notes                     text,
  created_by_profile_id     uuid not null references profiles (id) on delete restrict,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index planned_changes_branch_idx on planned_changes (branch_id);
create index planned_changes_scheduled_idx on planned_changes (scheduled_date);
create index planned_changes_status_idx on planned_changes (status);
create trigger planned_changes_set_updated before update on planned_changes
  for each row execute function set_updated_at();

-- ── RLS: districts (staff only) ───────────────────────────────────────────────
alter table districts enable row level security;

drop policy if exists districts_select on districts;
create policy districts_select on districts
  for select to authenticated
  using (is_staff() or rep_owns_account(account_id));

drop policy if exists districts_staff_write on districts;
create policy districts_staff_write on districts
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── RLS: contact_tiers (staff only; reps see via contacts they own) ────────────
alter table contact_tiers enable row level security;

drop policy if exists contact_tiers_select on contact_tiers;
create policy contact_tiers_select on contact_tiers
  for select to authenticated
  using (is_staff() or rep_owns_account(account_id));

drop policy if exists contact_tiers_staff_write on contact_tiers;
create policy contact_tiers_staff_write on contact_tiers
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── RLS: planned_changes (managers + admins only) ────────────────────────────
alter table planned_changes enable row level security;

drop policy if exists planned_changes_select on planned_changes;
create policy planned_changes_select on planned_changes
  for select to authenticated
  using (is_staff() or rep_owns_branch(branch_id, NULL));

drop policy if exists planned_changes_staff_write on planned_changes;
create policy planned_changes_staff_write on planned_changes
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── Helper: rep_owns_account (for district/tier RLS) ────────────────────────
-- Returns true if the current user is the account owner or owns any branch in the account.
create or replace function rep_owns_account(account_id uuid) returns boolean as $$
declare
  user_id uuid := auth.uid();
begin
  if user_id is null then return false; end if;

  -- Admin/manager: always true
  if (select role from profiles where id = user_id) in ('admin', 'manager') then
    return true;
  end if;

  -- Account owner
  if (select owner_id from accounts where id = account_id) = user_id then
    return true;
  end if;

  -- Owns any branch in the account
  if exists (select 1 from branches where account_id = $1 and owner_id = user_id) then
    return true;
  end if;

  return false;
end;
$$ language plpgsql stable security definer set search_path = public;
