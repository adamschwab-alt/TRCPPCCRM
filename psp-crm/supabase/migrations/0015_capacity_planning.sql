-- ════════════════════════════════════════════════════════════════════════════
-- 0015 Capacity planning views, touch scheduling, and coverage metrics
-- ════════════════════════════════════════════════════════════════════════════
-- Adds computed views for rep workload vs 420-call/yr capacity.
-- Adds scheduled_touches table for touch tracking & fulfillment.
-- Adds computed views for coverage metrics (account investment, district coverage).
-- ════════════════════════════════════════════════════════════════════════════

-- ── scheduled_touches ────────────────────────────────────────────────────────
-- Tracks planned touches per contact_tier, assigned PSP resource, and outcome.
create table scheduled_touches (
  id                uuid primary key default gen_random_uuid(),
  contact_tier_id   uuid not null references contact_tiers (id) on delete cascade,
  assigned_to_id    uuid references profiles (id) on delete set null,   -- who will do the touch
  scheduled_date    date not null,
  touch_type        text not null,  -- 'call', 'qbr', 'dm_meeting', 'field_visit', etc.
  outcome_status    text,           -- 'scheduled', 'completed', 'rescheduled', 'cancelled'
  outcome_notes     text,
  activity_id       uuid references activities (id) on delete set null,  -- links to the actual touch once logged
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index scheduled_touches_contact_tier_idx on scheduled_touches (contact_tier_id);
create index scheduled_touches_assigned_to_idx on scheduled_touches (assigned_to_id);
create index scheduled_touches_scheduled_idx on scheduled_touches (scheduled_date);
create trigger scheduled_touches_set_updated before update on scheduled_touches
  for each row execute function set_updated_at();

-- ── RLS: scheduled_touches (same as contact_tiers) ───────────────────────────
alter table scheduled_touches enable row level security;

drop policy if exists scheduled_touches_select on scheduled_touches;
create policy scheduled_touches_select on scheduled_touches
  for select to authenticated
  using (
    is_staff() or
    assigned_to_id = auth.uid() or
    exists (
      select 1 from contact_tiers ct
      where ct.id = contact_tier_id and rep_owns_account(ct.account_id)
    )
  );

drop policy if exists scheduled_touches_rep_write on scheduled_touches;
create policy scheduled_touches_rep_write on scheduled_touches
  for update to authenticated
  using (assigned_to_id = auth.uid() or is_staff())
  with check (assigned_to_id = auth.uid() or is_staff());

drop policy if exists scheduled_touches_staff_write on scheduled_touches;
create policy scheduled_touches_staff_write on scheduled_touches
  for insert to authenticated
  with check (is_staff());

-- ── v_rep_workload: field rep capacity & utilization ────────────────────────
-- Aggregates branch calls/yr + tier touches/yr by assigned rep, across scenarios.
drop view if exists v_rep_workload cascade;
create view v_rep_workload as
with branch_calls as (
  -- Per-rep branch calls (field calls, from branches.owner_id)
  select
    b.owner_id as rep_id,
    'Current' as scenario,
    count(distinct b.id) as branch_count,
    coalesce(sum(
      case
        when ar.relationship_rating = 1 then
          case
            when ttm_size.size_class = 'Large' then 6
            when ttm_size.size_class = 'Medium' then 4
            when ttm_size.size_class = 'Small' then 2
            else 1
          end
        when ar.relationship_rating = 2 then
          case
            when ttm_size.size_class = 'Large' then 4
            when ttm_size.size_class = 'Medium' then 3
            when ttm_size.size_class = 'Small' then 1
            else 1
          end
        else 1  -- relationship_rating = 3 (transactional)
      end
    ), 0) as branch_calls_yr
  from branches b
  join accounts ar on b.account_id = ar.id
  left join lateral (
    select
      case
        when (select coalesce(sum(net_sale), 0) from sales_transactions st
              where st.account_id = ar.id
              and st.date >= now()::date - interval '365 days') >= 6000000 then 'Large'
        when (select coalesce(sum(net_sale), 0) from sales_transactions st
              where st.account_id = ar.id
              and st.date >= now()::date - interval '365 days') >= 2000000 then 'Medium'
        else 'Small'
      end as size_class
  ) ttm_size on true
  where b.owner_id is not null
  group by b.owner_id
),
tier_touches as (
  -- Territory Rep tier touches (from contact_tiers with psp_owner_type = 'Territory Rep')
  select
    p.id as rep_id,
    'Current' as scenario,
    coalesce(sum(ct.cadence_touches_yr), 0) as tier_touches_yr
  from profiles p
  left join contact_tiers ct on ct.psp_owner_type = 'Territory Rep'
    and p.full_name = (select covered_by from contacts c where c.id = ct.contact_id limit 1)
  where p.role = 'rep' and p.is_active
  group by p.id
)
select
  coalesce(bc.rep_id, tt.rep_id) as rep_id,
  (select full_name from profiles where id = coalesce(bc.rep_id, tt.rep_id)) as rep_name,
  coalesce(bc.scenario, tt.scenario) as scenario,
  coalesce(bc.branch_count, 0) as branch_count,
  coalesce(bc.branch_calls_yr, 0) as branch_calls_yr,
  coalesce(tt.tier_touches_yr, 0) as tier_touches_yr,
  (coalesce(bc.branch_calls_yr, 0) + coalesce(tt.tier_touches_yr, 0)) as total_load_yr,
  420 as capacity_per_rep,
  round(
    100.0 * (coalesce(bc.branch_calls_yr, 0) + coalesce(tt.tier_touches_yr, 0)) / 420,
    1
  ) as utilization_pct
from branch_calls bc
full outer join tier_touches tt on bc.rep_id = tt.rep_id
order by rep_name, scenario;

-- ── v_account_investment: total touches by account ───────────────────────────
-- Aggregates branch calls + tier touches per account.
drop view if exists v_account_investment cascade;
create view v_account_investment as
select
  a.id as account_id,
  a.name as account_name,
  count(distinct b.id) as branch_count,
  coalesce(sum(
    case
      when a.relationship_rating = 1 then
        case
          when ttm.size_class = 'Large' then 6 * 1
          when ttm.size_class = 'Medium' then 4 * 1
          when ttm.size_class = 'Small' then 2 * 1
          else 1
        end
      when a.relationship_rating = 2 then
        case
          when ttm.size_class = 'Large' then 4
          when ttm.size_class = 'Medium' then 3
          when ttm.size_class = 'Small' then 1
          else 1
        end
      else 1
    end
  ), 0) as branch_calls_yr,
  coalesce(sum(ct.cadence_touches_yr), 0) as tier_touches_yr,
  (
    coalesce(sum(
      case
        when a.relationship_rating = 1 then
          case
            when ttm.size_class = 'Large' then 6
            when ttm.size_class = 'Medium' then 4
            when ttm.size_class = 'Small' then 2
            else 1
          end
        when a.relationship_rating = 2 then
          case
            when ttm.size_class = 'Large' then 4
            when ttm.size_class = 'Medium' then 3
            when ttm.size_class = 'Small' then 1
            else 1
          end
        else 1
      end
    ), 0) + coalesce(sum(ct.cadence_touches_yr), 0)
  ) as total_touches_yr
from accounts a
left join branches b on b.account_id = a.id
left join lateral (
  select
    case
      when (select coalesce(sum(net_sale), 0) from sales_transactions
            where account_id = a.id and date >= now()::date - interval '365 days') >= 6000000 then 'Large'
      when (select coalesce(sum(net_sale), 0) from sales_transactions
            where account_id = a.id and date >= now()::date - interval '365 days') >= 2000000 then 'Medium'
      else 'Small'
    end as size_class
) ttm on true
left join contact_tiers ct on ct.account_id = a.id
group by a.id, a.name
order by total_touches_yr desc;

-- ── v_district_coverage: United Rentals district workload ─────────────────────
-- Tracks district-level branch count, calls, DM/DSM contacts, and routing logic.
drop view if exists v_district_coverage cascade;
create view v_district_coverage as
select
  d.id as district_id,
  d.name as district_name,
  d.code as district_code,
  d.account_id,
  a.name as account_name,
  count(distinct b.id) as branch_count,
  coalesce(sum(
    case
      when a.relationship_rating = 1 then
        case
          when ttm.size_class = 'Large' then 6
          when ttm.size_class = 'Medium' then 4
          when ttm.size_class = 'Small' then 2
          else 1
        end
      when a.relationship_rating = 2 then
        case
          when ttm.size_class = 'Large' then 4
          when ttm.size_class = 'Medium' then 3
          when ttm.size_class = 'Small' then 1
          else 1
        end
      else 1
    end
  ), 0) as branch_calls_yr,
  (select full_name from profiles where id = d.dm_profile_id) as dm_name,
  (select full_name from profiles where id = d.dsm_profile_id) as dsm_name,
  coalesce(sum(ct.cadence_touches_yr) filter (where ct.psp_owner_type = 'District Manager'), 0) as dm_tier_touches_yr,
  coalesce(sum(ct.cadence_touches_yr) filter (where ct.psp_owner_type = 'District Sales Manager'), 0) as dsm_tier_touches_yr
from districts d
left join accounts a on d.account_id = a.id
left join branches b on b.district_id = d.id
left join lateral (
  select
    case
      when (select coalesce(sum(net_sale), 0) from sales_transactions
            where account_id = a.id and date >= now()::date - interval '365 days') >= 6000000 then 'Large'
      when (select coalesce(sum(net_sale), 0) from sales_transactions
            where account_id = a.id and date >= now()::date - interval '365 days') >= 2000000 then 'Medium'
      else 'Small'
    end as size_class
) ttm on true
left join contact_tiers ct on ct.account_id = d.account_id
  and ct.tier in ('District', 'Regional-VP')
  and ct.psp_owner_type in ('District Manager', 'District Sales Manager')
group by d.id, d.name, d.code, d.account_id, a.name
order by a.name, d.name;

-- ── Grant reads on views to authenticated users ───────────────────────────────
grant select on v_rep_workload to authenticated;
grant select on v_account_investment to authenticated;
grant select on v_district_coverage to authenticated;
