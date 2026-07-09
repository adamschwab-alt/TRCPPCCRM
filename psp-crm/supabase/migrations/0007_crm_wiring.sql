-- ════════════════════════════════════════════════════════════════════════════
-- 0007 CRM consolidation: customer wiring + contacts
-- Ports the KPI dashboard's activity-CRM data model into the system of record:
--   • accounts.relationship_rating (1 strategic / 2 important / 3 transactional)
--     — crossed with TTM size class it drives the per-account touch cadence.
--   • contacts — people at the customer, tiered 1–5, with PSP-side coverage.
--   • activities.contact_id — touches can reference the person contacted.
-- ════════════════════════════════════════════════════════════════════════════

alter table accounts
  add column if not exists relationship_rating smallint not null default 2
  check (relationship_rating between 1 and 3);

create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts (id) on delete cascade,
  branch_id   uuid references branches (id) on delete set null,
  name        text not null,
  title       text,
  -- 1 Executive · 2 Regional/District · 3 Ops/Fleet · 4 Purchasing/Finance · 5 Branch
  tier        smallint not null default 3 check (tier between 1 and 5),
  phone       text,
  email       text,
  covered_by  text,             -- PSP-side coverage (rep/manager/CFO) — deliberately not 1:1
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists contacts_account_idx on contacts (account_id);

drop trigger if exists contacts_set_updated on contacts;
create trigger contacts_set_updated before update on contacts
  for each row execute function set_updated_at();

alter table activities
  add column if not exists contact_id uuid references contacts (id) on delete set null;

-- RLS: staff see/edit all; reps only on accounts they own (directly or via branch).
alter table contacts enable row level security;

drop policy if exists contacts_select on contacts;
create policy contacts_select on contacts
  for select to authenticated
  using (is_staff() or rep_owns_branch(branch_id, account_id));

drop policy if exists contacts_rep_write on contacts;
create policy contacts_rep_write on contacts
  for all to authenticated
  using (rep_owns_branch(branch_id, account_id))
  with check (rep_owns_branch(branch_id, account_id));

drop policy if exists contacts_staff_write on contacts;
create policy contacts_staff_write on contacts
  for all to authenticated using (is_staff()) with check (is_staff());
