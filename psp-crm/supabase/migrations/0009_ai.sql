-- ════════════════════════════════════════════════════════════════════════════
-- 0009 AI instrumentation (blueprint Phase 3, non-negotiable #4)
-- ai_recommendations: append-only log of every AI suggestion shown to a user —
-- what, to whom, from which model/rules version, what they did about it, and
-- (back-filled) what happened afterward. This is what makes "AI-assisted vs
-- not" measurable at the recommendation level instead of anecdote.
-- ════════════════════════════════════════════════════════════════════════════

do $$ begin
  create type rec_type as enum ('next_best_action','account_summary','deal_risk');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rec_status as enum ('shown','accepted','dismissed');
exception when duplicate_object then null; end $$;

create table if not exists ai_recommendations (
  id                 uuid primary key default gen_random_uuid(),
  type               rec_type not null,
  user_id            uuid not null references profiles (id) on delete cascade,
  account_id         uuid references accounts (id) on delete cascade,
  branch_id          uuid references branches (id) on delete set null,
  opportunity_id     uuid references opportunities (id) on delete cascade,
  contact_id         uuid references contacts (id) on delete set null,
  recommended_action text,            -- NBA: the action; summary: the generated brief; risk: the flag text
  reason             text,            -- why (score drivers / flag rule)
  score              numeric,         -- priority or risk score at time shown
  model_version      text not null default 'rules-v1',
  prompt_version     text,
  status             rec_status not null default 'shown',
  shown_at           timestamptz not null default now(),
  shown_count        integer not null default 1,
  acted_at           timestamptz,
  action_activity_id uuid references activities (id) on delete set null,
  override_note      text,            -- dismiss reason / thumbs feedback
  outcome            jsonb            -- back-filled: {order_within_28d, order_amount, stage_advanced, rating}
);
create index if not exists ai_rec_user_idx on ai_recommendations (user_id, shown_at);
create index if not exists ai_rec_type_idx on ai_recommendations (type, shown_at);
create index if not exists ai_rec_branch_idx on ai_recommendations (branch_id);
create index if not exists ai_rec_opp_idx on ai_recommendations (opportunity_id);

alter table ai_recommendations enable row level security;

drop policy if exists ai_rec_select on ai_recommendations;
create policy ai_rec_select on ai_recommendations
  for select to authenticated using (is_staff() or user_id = auth.uid());

drop policy if exists ai_rec_insert on ai_recommendations;
create policy ai_rec_insert on ai_recommendations
  for insert to authenticated with check (user_id = auth.uid());

-- Users may update ONLY their own recommendation's response fields (accept/
-- dismiss/feedback); rows are never deleted. Outcome back-fill runs as the
-- service role (bypasses RLS).
drop policy if exists ai_rec_update on ai_recommendations;
create policy ai_rec_update on ai_recommendations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
