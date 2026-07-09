-- ════════════════════════════════════════════════════════════════════════════
-- 0008 Measurement layer (blueprint Phase 1)
--   • opportunities: source, lost_reason(+note), forecast_category, closed_at,
--     primary_contact_id, competitor
--   • opportunity_stage_history: append-only shadow of every change to
--     stage/amount/expected_close/owner/forecast_category, written by trigger —
--     the un-gameable basis for funnel conversion, cycle time, and slippage.
--   • closed_at + forecast_category maintained by a BEFORE trigger (derived,
--     never rep-entered; category auto-maps from stage unless explicitly set).
--   • activities: outcome + source (ready for later Outlook passive capture)
--   • profiles: cohort fields (hired_at, rollout_wave, ai_enabled_at,
--     training_completed_at)
--   • exogenous_events: admin log of market shocks for case-study footnotes
-- ════════════════════════════════════════════════════════════════════════════

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type opp_source as enum
    ('existing_account','new_branch','referral','inbound','event','cold','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lost_reason as enum
    ('price','availability','lead_time','spec','relationship','no_decision','competitor','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type forecast_category as enum ('pipeline','best_case','commit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_outcome as enum
    ('connected','left_msg','no_response','meeting_booked','meeting_held');
exception when duplicate_object then null; end $$;

-- ── opportunities extensions ────────────────────────────────────────────────
alter table opportunities
  add column if not exists source             opp_source,
  add column if not exists lost_reason        lost_reason,
  add column if not exists lost_note          text,
  add column if not exists forecast_category  forecast_category,
  add column if not exists closed_at          timestamptz,
  add column if not exists primary_contact_id uuid references contacts (id) on delete set null,
  add column if not exists competitor         text;

-- ── activities extensions ───────────────────────────────────────────────────
alter table activities
  add column if not exists outcome activity_outcome,
  add column if not exists source  text not null default 'manual';

-- ── profiles cohort fields ──────────────────────────────────────────────────
alter table profiles
  add column if not exists hired_at              date,
  add column if not exists rollout_wave          smallint not null default 1,
  add column if not exists ai_enabled_at         timestamptz,
  add column if not exists training_completed_at timestamptz;

-- ── opportunity_stage_history (append-only) ─────────────────────────────────
create table if not exists opportunity_stage_history (
  id          bigint generated always as identity primary key,
  opportunity_id uuid not null references opportunities (id) on delete cascade,
  field       text not null,       -- stage | amount | expected_close | owner_id | forecast_category | created
  old_value   text,
  new_value   text,
  changed_by  uuid,                -- auth.uid() at time of change (null for service role)
  changed_at  timestamptz not null default now()
);
create index if not exists opp_history_opp_idx on opportunity_stage_history (opportunity_id, changed_at);

-- ── BEFORE trigger: derived closed_at + auto forecast_category ──────────────
create or replace function opp_before_change() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.forecast_category is null then
      new.forecast_category := case new.stage
        when 'Qualified' then 'pipeline'::forecast_category
        when 'Quoted'    then 'best_case'::forecast_category
        when 'Verbal'    then 'commit'::forecast_category
        else null end;
    end if;
    if new.stage in ('Won','Lost') then
      new.closed_at := coalesce(new.closed_at, now());
    end if;
    return new;
  end if;

  if new.stage is distinct from old.stage then
    if new.stage in ('Won','Lost') then
      new.closed_at := coalesce(new.closed_at, now());
    elsif old.stage in ('Won','Lost') then
      new.closed_at := null;  -- reopened
    end if;
    -- Auto-map the forecast category on stage change unless the same statement
    -- explicitly set it (an override, which stage history records).
    if new.forecast_category is not distinct from old.forecast_category then
      new.forecast_category := case new.stage
        when 'Qualified' then 'pipeline'::forecast_category
        when 'Quoted'    then 'best_case'::forecast_category
        when 'Verbal'    then 'commit'::forecast_category
        else new.forecast_category end;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists opportunities_before_change on opportunities;
create trigger opportunities_before_change
  before insert or update on opportunities
  for each row execute function opp_before_change();

-- ── AFTER trigger: append-only history (SECURITY DEFINER so it always writes) ─
create or replace function opp_log_history() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into opportunity_stage_history (opportunity_id, field, old_value, new_value, changed_by)
    values (new.id, 'created', null, new.stage::text, auth.uid());
    return new;
  end if;

  if new.stage is distinct from old.stage then
    insert into opportunity_stage_history (opportunity_id, field, old_value, new_value, changed_by)
    values (new.id, 'stage', old.stage::text, new.stage::text, auth.uid());
  end if;
  if new.amount is distinct from old.amount then
    insert into opportunity_stage_history (opportunity_id, field, old_value, new_value, changed_by)
    values (new.id, 'amount', old.amount::text, new.amount::text, auth.uid());
  end if;
  if new.expected_close is distinct from old.expected_close then
    insert into opportunity_stage_history (opportunity_id, field, old_value, new_value, changed_by)
    values (new.id, 'expected_close', old.expected_close::text, new.expected_close::text, auth.uid());
  end if;
  if new.owner_id is distinct from old.owner_id then
    insert into opportunity_stage_history (opportunity_id, field, old_value, new_value, changed_by)
    values (new.id, 'owner_id', old.owner_id::text, new.owner_id::text, auth.uid());
  end if;
  if new.forecast_category is distinct from old.forecast_category then
    insert into opportunity_stage_history (opportunity_id, field, old_value, new_value, changed_by)
    values (new.id, 'forecast_category', old.forecast_category::text, new.forecast_category::text, auth.uid());
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists opportunities_log_history on opportunities;
create trigger opportunities_log_history
  after insert or update on opportunities
  for each row execute function opp_log_history();

-- ── exogenous_events (case-study footnotes) ─────────────────────────────────
create table if not exists exogenous_events (
  id          uuid primary key default gen_random_uuid(),
  event_date  date not null,
  title       text not null,
  note        text,
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table opportunity_stage_history enable row level security;
drop policy if exists opp_history_select on opportunity_stage_history;
create policy opp_history_select on opportunity_stage_history
  for select to authenticated
  using (is_staff() or exists (
    select 1 from opportunities o
    where o.id = opportunity_id and o.owner_id = auth.uid()
  ));
-- No insert/update/delete policies: rows arrive only via the definer trigger.

alter table exogenous_events enable row level security;
drop policy if exists exo_select on exogenous_events;
create policy exo_select on exogenous_events for select to authenticated using (true);
drop policy if exists exo_admin on exogenous_events;
create policy exo_admin on exogenous_events
  for all to authenticated using (is_admin()) with check (is_admin());
