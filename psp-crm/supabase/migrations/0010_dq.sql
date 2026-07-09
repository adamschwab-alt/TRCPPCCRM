-- ════════════════════════════════════════════════════════════════════════════
-- 0010 Data quality (blueprint Phase 2) + activities-visibility fix
--   • dq_snapshots: monthly frozen data-quality scores (completeness /
--     freshness / stalled / gate violations, org + per-rep detail) — written by
--     the nightly job with the service role; the case study's DQ time axis.
--   • activities visibility: reps could only see THEIR OWN touches, so a
--     manager's call on a rep's account didn't reset the rep's "call due"
--     clock. Widen SELECT to touches on accounts/branches the rep owns.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists dq_snapshots (
  id            bigint generated always as identity primary key,
  period        text not null unique,      -- 'YYYY-MM' (current month, refreshed nightly until it closes)
  completeness  numeric,                   -- 0–1 avg across active opps
  freshness     numeric,                   -- 0–1 share of cadenced accounts inside their window
  stalled       integer not null default 0,
  gate_violations integer not null default 0,
  detail        jsonb,                     -- per-rep breakdown
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table dq_snapshots enable row level security;
drop policy if exists dq_snapshots_select on dq_snapshots;
create policy dq_snapshots_select on dq_snapshots
  for select to authenticated using (is_staff());
-- Writes only via the service role (nightly job) — no authenticated write policy.

-- ── activities: reps see all touches on their book ──────────────────────────
drop policy if exists activities_select on activities;
create policy activities_select on activities
  for select to authenticated
  using (is_staff() or user_id = auth.uid() or rep_owns_branch(branch_id, account_id));
