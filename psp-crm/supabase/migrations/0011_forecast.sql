-- ════════════════════════════════════════════════════════════════════════════
-- 0011 Forecast snapshots (blueprint Phase 4)
-- Frozen at the START of each month by the nightly job (insert-if-missing —
-- never updated, so it is a true point-in-time record): what the pipeline said
-- the month would bring, per rep and for the org. Forecast accuracy for month M
-- = Won $ closed during M vs the commit amount in M's snapshot.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists forecast_snapshots (
  id               bigint generated always as identity primary key,
  period           text not null,                 -- 'YYYY-MM' being forecast
  rep_id           uuid references profiles (id) on delete cascade,  -- null = whole org
  pipeline_amount  numeric not null default 0,    -- open $ in category 'pipeline'
  best_case_amount numeric not null default 0,
  commit_amount    numeric not null default 0,
  weighted_amount  numeric not null default 0,    -- Σ weighted_amount of open opps
  open_count       integer not null default 0,
  created_at       timestamptz not null default now()
);
create unique index if not exists forecast_snapshots_key
  on forecast_snapshots (period, coalesce(rep_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table forecast_snapshots enable row level security;
drop policy if exists forecast_snapshots_select on forecast_snapshots;
create policy forecast_snapshots_select on forecast_snapshots
  for select to authenticated using (is_staff() or rep_id = auth.uid());
-- Writes only via the service role (nightly job).
