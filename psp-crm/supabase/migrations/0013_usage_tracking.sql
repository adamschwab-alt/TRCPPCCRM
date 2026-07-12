-- ════════════════════════════════════════════════════════════════════════════
-- 0013 Usage tracking — who is in the app, and for how long.
-- The client pings once per minute while a tab is open and visible; each ping
-- is one row here. "Time on site" = count of distinct active minutes, so the
-- math stays honest (background tabs don't ping, so they don't count).
-- Reads are ADMIN-ONLY (same posture as audit_log); users can only insert
-- their own heartbeats. Rows older than 90 days are pruned by the nightly cron.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists usage_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  path        text,
  occurred_at timestamptz not null default now()
);
create index if not exists usage_events_user_time_idx on usage_events (user_id, occurred_at);
create index if not exists usage_events_time_idx on usage_events (occurred_at);

alter table usage_events enable row level security;

-- Everyone writes their own presence; only admins read anyone's.
drop policy if exists usage_events_insert_own on usage_events;
create policy usage_events_insert_own on usage_events
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists usage_events_admin_select on usage_events;
create policy usage_events_admin_select on usage_events
  for select to authenticated using (is_admin());

-- No update/delete policies: append-only for users; pruning runs as service role.
